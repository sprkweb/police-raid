import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GameEvent } from '../../../../types/game'
import { createBehavioralBrainFactory } from '../brain'
import { withBehavioralDebug } from '../debug'
import { Level0Estimator } from '../level0'
import { LevelKPlus1Estimator, MoleHypothesesFromHistory } from '../levelKPlus1'
import { LogitBehavioralStrategy } from '../logitQuantalResponse'
import { proposeCtx, raidCtx, voteCtx } from './fixtures'

function model() {
    return new MoleHypothesesFromHistory(
        new LogitBehavioralStrategy(1, new Level0Estimator()),
    )
}
function level1(hypotheses = model()) {
    return new LogitBehavioralStrategy(2, new LevelKPlus1Estimator(hypotheses))
}

describe('behavioral debug', () => {
    beforeEach(() => {
        vi.spyOn(console, 'table').mockImplementation(() => {})
        vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
        vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    })
    afterEach(() => vi.restoreAllMocks())

    it('prints actual utilities and probabilities for all actions without sampling or replacing results', () => {
        const strategy = new LogitBehavioralStrategy(2, new Level0Estimator())
        const random = vi.fn(() => 0.5)
        const cases = [
            ['strategyForTeamProposal', proposeCtx({ random })],
            ['strategyForTeamVote', voteCtx({ random })],
            ['strategyForRaidAction', raidCtx({ random })],
        ] as const
        const debug = withBehavioralDebug(strategy)
        for (const [method, ctx] of cases) {
            // The fixture intersection supplies each method's required context.
            const context = { ...proposeCtx(), ...raidCtx(), ...ctx }
            const result = strategy[method](context)
            const spy = vi
                .spyOn(strategy, method)
                .mockReturnValue(result as never)
            expect(debug[method](context)).toBe(result)
            expect(spy).toHaveBeenCalledTimes(1)
            expect(console.table).toHaveBeenLastCalledWith(
                result.utilities.map((entry, i) => ({
                    action: Array.isArray(entry.action)
                        ? entry.action.join(', ')
                        : entry.action,
                    utility: entry.utility,
                    probability: result.samplePoints[i].probability,
                })),
            )
            spy.mockRestore()
        }
        expect(random).not.toHaveBeenCalled()
        expect(console.table).toHaveBeenCalledTimes(3)
    })

    it('prints common hypotheses once per model and history length, including raids', () => {
        const hypotheses = model()
        const first = withBehavioralDebug(level1(hypotheses))
        const second = withBehavioralDebug(level1(hypotheses))
        first.strategyForTeamVote(voteCtx())
        expect(console.table).toHaveBeenCalledTimes(2)
        expect(vi.mocked(console.table).mock.calls[0][0]).toEqual(
            hypotheses
                .get(voteCtx())
                .moleHypotheses.samplePoints.map(({ value, probability }) => ({
                    moles: value.join(', '),
                    probability,
                })),
        )
        second.strategyForTeamVote(voteCtx({ actorId: 'D' }))
        expect(console.table).toHaveBeenCalledTimes(3)
        first.strategyForRaidAction(
            raidCtx({
                history: [
                    { kind: 'proposal', proposerId: 'C', team: ['A', 'C'] },
                ],
            }),
        )
        expect(console.table).toHaveBeenCalledTimes(5)
        withBehavioralDebug(level1()).strategyForRaidAction(raidCtx())
        expect(console.table).toHaveBeenCalledTimes(7)
    })

    it('preserves distributions and sampled actions when raids advance the debug model cache', () => {
        const plain = level1()
        const debug = withBehavioralDebug(level1())
        const history: GameEvent[] = [
            { kind: 'proposal', proposerId: 'C', team: ['A', 'C'] },
        ]
        const raid = raidCtx({ history })
        expect(debug.strategyForRaidAction(raid).samplePoints).toEqual(
            plain.strategyForRaidAction(raid).samplePoints,
        )
        history.push({
            kind: 'raid',
            round: 1,
            proposerId: 'C',
            team: ['A', 'C'],
            sabotageCount: 1,
        })
        const ctx = proposeCtx({ history })
        const actual = debug.strategyForTeamProposal(ctx)
        const expected = plain.strategyForTeamProposal(ctx)
        expect(actual.samplePoints).toEqual(expected.samplePoints)
        for (const r of [0, 0.2, 0.5, 0.9]) {
            expect(actual.chooseAction(() => r)).toEqual(
                expected.chooseAction(() => r),
            )
        }
        expect(
            debug.strategyForTeamVote(voteCtx({ history })).samplePoints,
        ).toEqual(plain.strategyForTeamVote(voteCtx({ history })).samplePoints)
    })

    it('logs only the real decision, not nested model calculations', () => {
        const brain = createBehavioralBrainFactory()({
            algorithm: 'behavioral',
            level: 2,
            precision: 2,
            expectedOthersPrecision: 1,
        })
        brain.chooseTeamVote(
            voteCtx({
                history: [
                    { kind: 'proposal', proposerId: 'C', team: ['A', 'C'] },
                ],
            }),
        )
        expect(console.table).toHaveBeenCalledTimes(2)
    })
})
