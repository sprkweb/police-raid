import { describe, expect, it } from 'vitest'

import { Role } from '../../../../types/game'
import { Level0Strategy } from '../level0'
import { logistic, proposeCtx, raidCtx, voteCtx } from './fixtures'

describe('Level0Strategy', () => {
    const strategy = new Level0Strategy(2)

    it('enumerates legal teams and favors including the police actor', () => {
        const teams = strategy.chooseProposedTeam(proposeCtx())
        expect(teams.count()).toBe(10)
        expect(
            teams.probability((t) => t.length === 2 && new Set(t).size === 2),
        ).toBeCloseTo(1)
        expect(teams.probability((t) => t.includes('C'))).toBeCloseTo(
            (4 * Math.exp(2)) / (4 * Math.exp(2) + 6),
        )
    })

    it('balances self-inclusion, sufficient moles and redundant moles when proposing', () => {
        const teams = strategy.chooseProposedTeam(
            proposeCtx({ actorId: 'A', role: Role.Mole }),
        )
        const probability = (team: string[]) =>
            teams.probability((t) => t.join() === team.join())
        // A+C: 0.6 + 0.5; B+C: 0.6; A+B: 0.36 + 0.5; C+D: 0.
        expect(probability(['A', 'C']) / probability(['B', 'C'])).toBeCloseTo(
            Math.exp(1),
        )
        expect(probability(['A', 'B']) / probability(['C', 'D'])).toBeCloseTo(
            Math.exp(2 * 0.86),
        )
        const needsTwo = strategy.chooseProposedTeam(
            proposeCtx({ actorId: 'A', role: Role.Mole, requiredSabotages: 2 }),
        )
        expect(
            needsTwo.probability((t) => t.join() === 'A,B') /
                needsTwo.probability((t) => t.join() === 'A,C'),
        ).toBeCloseTo(Math.exp(1.2))
    })

    it.each([
        { overrides: {}, utility: 0 },
        { overrides: { proposedTeam: ['C', 'D'] }, utility: 1.5 },
        { overrides: { currentRound: 1 }, utility: 1 },
        { overrides: { consecutiveRejections: 3 }, utility: 0 },
        { overrides: { consecutiveRejections: 4 }, utility: 2.5 },
        {
            overrides: {
                role: Role.Mole,
                actorId: 'A',
                proposedTeam: ['A', 'C'],
            },
            utility: 1.5,
        },
        { overrides: { role: Role.Mole, actorId: 'A' }, utility: 1.26 },
        {
            overrides: {
                role: Role.Mole,
                actorId: 'A',
                requiredSabotages: 2,
                proposedTeam: ['B', 'C'],
            },
            utility: 0,
        },
        {
            overrides: {
                role: Role.Mole,
                actorId: 'A',
                proposedTeam: ['C', 'D'],
                consecutiveRejections: 4,
            },
            utility: 1.4,
        },
    ])(
        'assigns approval utility $utility for $overrides',
        ({ overrides, utility }) => {
            expect(
                strategy
                    .chooseTeamVote(voteCtx(overrides))
                    .probability((v) => v === 'Approve'),
            ).toBeCloseTo(logistic(2 * (utility - 1)))
        },
    )

    it('police always support', () => {
        expect(
            strategy
                .chooseRaidAction(raidCtx({ role: Role.Police }))
                .probability((a) => a === 'Support'),
        ).toBe(1)
    })

    it.each([
        { moleIds: ['A'], requiredSabotages: 2, utility: -1 },
        { moleIds: ['A'], requiredSabotages: 1, utility: 1.3 },
        { moleIds: ['A', 'B'], requiredSabotages: 1, utility: 0.2 },
        { moleIds: ['A', 'B', 'C'], requiredSabotages: 1, utility: -0.2 },
    ])(
        'adjusts sabotage for $moleIds and threshold $requiredSabotages',
        ({ moleIds, requiredSabotages, utility }) => {
            const actions = strategy.chooseRaidAction(
                raidCtx({
                    proposedTeam: ['A', 'B', 'C'],
                    moleIds,
                    requiredSabotages,
                }),
            )
            expect(actions.probability((a) => a === 'Sabotage')).toBeCloseTo(
                logistic(2 * utility),
            )
        },
    )
})
