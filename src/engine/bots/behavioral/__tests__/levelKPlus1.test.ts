import { describe, expect, it, vi } from 'vitest'

import { Role, type GameEvent } from '../../../../types/game'
import type {
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from '../../types'
import { LocalStrategy } from '../behavioralStrategy'
import { Level0Strategy } from '../level0'
import { LevelKPlus1Strategy, MoleHypothesesFromHistory } from '../levelKPlus1'
import { logistic, proposeCtx, raidCtx, voteCtx } from './fixtures'

describe('LevelKPlus1Strategy', () => {
    const create = () =>
        new LevelKPlus1Strategy(
            2,
            new MoleHypothesesFromHistory(new Level0Strategy(0)),
        )
    // Two moles among the four other players: P(no mole in C+D) = 1/2,
    // P(no mole in A+B) = 1/6, since the actor C is assumed innocent.
    it.each([Role.Police, Role.Mole])(
        'uses an innocent-actor perspective for %s proposals',
        (role) => {
            const teams = create().chooseProposedTeam(proposeCtx({ role }))
            expect(
                teams.probability((t) => t.join() === 'C,D') /
                    teams.probability((t) => t.join() === 'A,B'),
            ).toBeCloseTo(Math.exp(2 / 3))
            expect(teams.probability(() => true)).toBeCloseTo(1)
        },
    )

    it('votes using team safety and the required sabotage threshold', () => {
        expect(
            create()
                .chooseTeamVote(voteCtx())
                .probability((v) => v === 'Approve'),
        ).toBeCloseTo(logistic(-4 / 3))
        expect(
            create()
                .chooseTeamVote(voteCtx({ requiredSabotages: 2 }))
                .probability((v) => v === 'Approve'),
        ).toBeCloseTo(logistic(4 / 3))
    })

    it('falls back to level zero when history proves the actor is a mole', () => {
        const ctx = proposeCtx({
            actorId: 'A',
            role: Role.Mole,
            history: [
                {
                    kind: 'raid',
                    team: ['A'],
                    proposerId: 'B',
                    sabotageCount: 1,
                    round: 1,
                },
            ],
        })
        const higher = create()
        const baseline = new Level0Strategy(2)
        const proposed = higher.chooseProposedTeam(ctx)
        const expected = baseline.chooseProposedTeam(ctx)
        for (const id of ctx.playerIds) {
            expect(proposed.probability((t) => t.includes(id))).toBeCloseTo(
                expected.probability((t) => t.includes(id)),
            )
        }
        const vote = voteCtx(ctx)
        expect(
            higher.chooseTeamVote(vote).probability((v) => v === 'Approve'),
        ).toBeCloseTo(
            baseline.chooseTeamVote(vote).probability((v) => v === 'Approve'),
        )
    })

    it.each([Role.Police, Role.Mole])(
        'uses level zero for %s raid actions',
        (role) => {
            const ctx = raidCtx({ role })
            expect(
                create()
                    .chooseRaidAction(ctx)
                    .probability((a) => a === 'Sabotage'),
            ).toBeCloseTo(
                new Level0Strategy(2)
                    .chooseRaidAction(ctx)
                    .probability((a) => a === 'Sabotage'),
            )
        },
    )
})

function model() {
    return {
        chooseProposedTeam: vi.fn(
            (_ctx: BotProposeContext) =>
                new LocalStrategy([{ value: ['A', 'B'], probability: 1 }]),
        ),
        chooseTeamVote: vi.fn(
            (_ctx: BotVoteContext) =>
                new LocalStrategy([
                    { value: 'Approve' as const, probability: 0.5 },
                    { value: 'Reject' as const, probability: 0.5 },
                ]),
        ),
        chooseRaidAction: vi.fn(
            (_ctx: BotRaidContext) =>
                new LocalStrategy([
                    { value: 'Support' as const, probability: 0.5 },
                    { value: 'Sabotage' as const, probability: 0.5 },
                ]),
        ),
    }
}

const raid = (sabotageCount: number, team = ['A', 'B']): GameEvent => ({
    kind: 'raid',
    team,
    sabotageCount,
    proposerId: 'C',
    round: 1,
})
const votes = (approved: boolean): GameEvent => ({
    kind: 'votes',
    team: ['A', 'B'],
    consecutiveRejections: 0,
    votes: {
        A: approved ? 'Approve' : 'Reject',
        B: 'Approve',
        C: 'Approve',
        D: 'Reject',
        E: 'Reject',
    },
})
const proposal: GameEvent = {
    kind: 'proposal',
    proposerId: 'A',
    team: ['B', 'A'],
}

describe('MoleHypothesesFromHistory', () => {
    it('starts with uniform priors and caches repeated reads', () => {
        const strategy = model()
        const history = new MoleHypothesesFromHistory(strategy)
        const ctx = proposeCtx()
        const prior = history.get(ctx)
        expect(prior.count()).toBe(10)
        expect(prior.probability((h) => h.includes('A'))).toBeCloseTo(0.4)
        expect(history.get(ctx)).toBe(prior)
        expect(strategy.chooseRaidAction).not.toHaveBeenCalled()
        expect(strategy.chooseProposedTeam).not.toHaveBeenCalled()
        expect(strategy.chooseTeamVote).not.toHaveBeenCalled()
    })

    it.each([
        { sabotages: 0, both: 1 / 25, neither: 12 / 25 },
        { sabotages: 1, both: 1 / 7, neither: 0 },
        { sabotages: 2, both: 1, neither: 0 },
    ])(
        'updates raid hypotheses for $sabotages sabotages',
        ({ sabotages, both, neither }) => {
            // Prior counts for 0/1/2 moles on A+B are 3/6/1.
            // With p(sabotage)=1/2, likelihoods are binomial probabilities.
            const history = new MoleHypothesesFromHistory(model())
            const posterior = history.get(
                proposeCtx({ history: [raid(sabotages)] }),
            )
            expect(
                posterior.probability(
                    (h) => h.includes('A') && h.includes('B'),
                ),
            ).toBeCloseTo(both)
            expect(
                posterior.probability(
                    (h) => !h.includes('A') && !h.includes('B'),
                ),
            ).toBeCloseTo(neither)
            expect(posterior.probability(() => true)).toBeCloseTo(1)
        },
    )

    it('uses each mole’s individual sabotage probability', () => {
        const strategy = model()
        strategy.chooseRaidAction.mockImplementation(
            (ctx) =>
                new LocalStrategy([
                    {
                        value: 'Support',
                        probability: ctx.actorId === 'A' ? 0.8 : 0.2,
                    },
                    {
                        value: 'Sabotage',
                        probability: ctx.actorId === 'A' ? 0.2 : 0.8,
                    },
                ]),
        )
        const posterior = new MoleHypothesesFromHistory(strategy).get(
            proposeCtx({ history: [raid(1)] }),
        )
        // A+B: .2*.2 + .8*.8 = .68; A+other: .2; B+other: .8.
        expect(
            posterior.probability((h) => h.includes('A') && h.includes('B')),
        ).toBeCloseTo(0.68 / 3.68)
        for (const [ctx] of strategy.chooseRaidAction.mock.calls) {
            expect(ctx.role).toBe(Role.Mole)
            expect(ctx.moleIds).toContain(ctx.actorId)
            expect(ctx.proposerId).toBe('C')
        }
    })

    it('allows a clean raid without moles and eliminates impossible sabotage evidence', () => {
        const ctx = proposeCtx({ moleIds: [] })
        const clean = new MoleHypothesesFromHistory(model()).get({
            ...ctx,
            history: [raid(0)],
        })
        expect(clean.count()).toBe(1)
        expect(clean.probability(() => true)).toBe(1)
        const impossible = new MoleHypothesesFromHistory(model()).get({
            ...ctx,
            history: [raid(1)],
        })
        expect(impossible.count()).toBe(0)
    })

    it('matches proposed teams regardless of order and infers the proposer’s role', () => {
        const strategy = model()
        strategy.chooseProposedTeam.mockImplementation(
            (ctx) =>
                new LocalStrategy([
                    {
                        value: ['A', 'B'],
                        probability: ctx.role === Role.Mole ? 0.8 : 0.2,
                    },
                    {
                        value: ['C', 'D'],
                        probability: ctx.role === Role.Mole ? 0.2 : 0.8,
                    },
                ]),
        )
        const posterior = new MoleHypothesesFromHistory(strategy).get(
            proposeCtx({ history: [proposal] }),
        )
        expect(posterior.probability((h) => h.includes('A'))).toBeCloseTo(
            (4 * 0.8) / (4 * 0.8 + 6 * 0.2),
        )
        expect(strategy.chooseProposedTeam).toHaveBeenCalledTimes(10)
        for (const [ctx] of strategy.chooseProposedTeam.mock.calls) {
            expect(ctx.actorId).toBe('A')
            expect(ctx.teamSize).toBe(2)
            expect(ctx.role).toBe(
                ctx.moleIds.includes('A') ? Role.Mole : Role.Police,
            )
        }
    })

    it('multiplies the likelihoods of all observed ballots', () => {
        const strategy = model()
        strategy.chooseTeamVote.mockImplementation(
            (ctx) =>
                new LocalStrategy([
                    {
                        value: 'Approve',
                        probability: ctx.role === Role.Mole ? 0.8 : 0.2,
                    },
                    {
                        value: 'Reject',
                        probability: ctx.role === Role.Mole ? 0.2 : 0.8,
                    },
                ]),
        )
        const posterior = new MoleHypothesesFromHistory(strategy).get(
            proposeCtx({ history: [votes(false)] }),
        )
        // Two approvers B,C: both moles have likelihood .8^5;
        // one mole among approvers: .8^3*.2^2 (6 hypotheses);
        // neither: .8*.2^4 (3 hypotheses).
        const likelihood = 0.8 ** 5
        const total = likelihood + 6 * 0.8 ** 3 * 0.2 ** 2 + 3 * 0.8 * 0.2 ** 4
        expect(
            posterior.probability((h) => h.includes('B') && h.includes('C')),
        ).toBeCloseTo(likelihood / total)
        expect(strategy.chooseTeamVote).toHaveBeenCalledTimes(50)
    })

    it('processes appended events once and agrees with a fresh full-history reconstruction', () => {
        const strategy = model()
        const history = new MoleHypothesesFromHistory(strategy)
        const events = [proposal, votes(true), raid(1)]
        history.get(proposeCtx({ history: events.slice(0, 1) }))
        const posterior = history.get(proposeCtx({ history: events }))
        const calls =
            strategy.chooseProposedTeam.mock.calls.length +
            strategy.chooseTeamVote.mock.calls.length +
            strategy.chooseRaidAction.mock.calls.length
        expect(history.get(proposeCtx({ history: [...events] }))).toBe(
            posterior,
        )
        expect(
            strategy.chooseProposedTeam.mock.calls.length +
                strategy.chooseTeamVote.mock.calls.length +
                strategy.chooseRaidAction.mock.calls.length,
        ).toBe(calls)
        const fresh = new MoleHypothesesFromHistory(model()).get(
            proposeCtx({ history: events }),
        )
        for (const id of proposeCtx().playerIds) {
            expect(posterior.probability((h) => h.includes(id))).toBeCloseTo(
                fresh.probability((h) => h.includes(id)),
            )
        }
    })

    it('reconstructs rejections, scores, rounds and history prefixes for modeled decisions', () => {
        const strategy = model()
        const history = new MoleHypothesesFromHistory(strategy)
        const events = [
            votes(false),
            proposal,
            votes(true),
            raid(0),
            proposal,
            raid(1),
            proposal,
        ]
        // Current context is deliberately later than the first historical event.
        history.get(
            proposeCtx({
                history: events,
                currentRound: 3,
                consecutiveRejections: 3,
            }),
        )
        const proposals = strategy.chooseProposedTeam.mock.calls.map(
            ([ctx]) => ctx,
        )
        expect(proposals).toHaveLength(27)
        expect(proposals[0]).toMatchObject({
            currentRound: 1,
            consecutiveRejections: 1,
            history: events.slice(0, 1),
        })
        expect(proposals[10]).toMatchObject({
            currentRound: 2,
            consecutiveRejections: 0,
            history: events.slice(0, 4),
        })
        expect(proposals[20]).toMatchObject({
            currentRound: 3,
            consecutiveRejections: 0,
            history: events.slice(0, 6),
        })
        // Record score values at call time: the model maintains one mutable score object.
        const observed: { police: number; moles: number }[] = []
        strategy.chooseProposedTeam.mockImplementation((ctx) => {
            observed.push({ ...ctx.scores })
            return new LocalStrategy([{ value: ['A', 'B'], probability: 1 }])
        })
        new MoleHypothesesFromHistory(strategy).get(
            proposeCtx({ history: events }),
        )
        expect(observed[0]).toEqual({ police: 0, moles: 0 })
        expect(observed[10]).toEqual({ police: 1, moles: 0 })
        expect(observed[20]).toEqual({ police: 1, moles: 1 })
    })

    it('uses two required sabotages in round four with seven players', () => {
        const strategy = model()
        const events = [raid(0, []), raid(0, []), raid(0, []), proposal]
        new MoleHypothesesFromHistory(strategy).get(
            proposeCtx({
                playerIds: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
                history: events,
            }),
        )
        expect(strategy.chooseProposedTeam.mock.calls[0][0]).toMatchObject({
            currentRound: 4,
            requiredSabotages: 2,
        })
    })
})
