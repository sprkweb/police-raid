import { afterEach, describe, expect, it, vi } from 'vitest'

import { Role, type GameEvent } from '../../../../types/game'
import { BALANCE, type PlayerCount } from '../../../constants'
import { createSeededRandom } from '../../../rng'
import { createPandSBrain } from '../brain'
import { PandSModel } from '../model'
import { context, history } from './fixtures'

describe('PandS decisions', () => {
    it('always proposes itself and uses seat order without evidence', () => {
        const ctx = context({ history: [] })
        expect(
            createPandSBrain().chooseProposedTeam({ ...ctx, teamSize: 3 }),
        ).toEqual(['a', 'b', 'c'])
    })

    it('avoids the inferred spy group after learning the raid history', () => {
        const ctx = context({ history })
        expect(
            createPandSBrain().chooseProposedTeam({ ...ctx, teamSize: 3 }),
        ).toEqual(['a', 'd', 'e'])
    })

    it('fills teams from remaining players when there are too few trusted players', () => {
        const ctx = context({ history })
        const team = createPandSBrain().chooseProposedTeam({
            ...ctx,
            teamSize: 4,
        })
        expect(team.slice(0, 3)).toEqual(['a', 'd', 'e'])
        expect(team).toHaveLength(4)
        expect(new Set(team).size).toBe(4)
        expect(team.every((id) => ctx.playerIds.includes(id))).toBe(true)
    })

    it.each([
        {
            name: 'own proposal before spy checks',
            leader: 'a',
            role: Role.Mole,
            round: 2,
            tries: 1,
            team: ['a', 'c'],
            want: 'Approve',
        },
        {
            name: 'first proposal before spy checks',
            leader: 'd',
            role: Role.Mole,
            round: 1,
            tries: 1,
            team: ['c', 'd'],
            want: 'Approve',
        },
        {
            name: 'spy on a dangerous team',
            leader: 'b',
            role: Role.Mole,
            round: 2,
            tries: 1,
            team: ['b', 'c'],
            want: 'Approve',
        },
        {
            name: 'spy on a clean team',
            leader: 'd',
            role: Role.Mole,
            round: 2,
            tries: 1,
            team: ['c', 'd'],
            want: 'Reject',
        },
        {
            name: 'spy rejects clean hammer',
            leader: 'd',
            role: Role.Mole,
            round: 2,
            tries: 5,
            team: ['c', 'd'],
            want: 'Reject',
        },
        {
            name: 'innocent approves hammer',
            leader: 'b',
            role: Role.Police,
            round: 2,
            tries: 5,
            team: ['b', 'c', 'd'],
            want: 'Approve',
        },
        {
            name: 'innocent outside dangerous three',
            leader: 'c',
            role: Role.Police,
            round: 2,
            tries: 1,
            team: ['c', 'd', 'e'],
            want: 'Reject',
        },
        {
            name: 'suspected player even before evidence',
            leader: 'b',
            role: Role.Police,
            round: 2,
            tries: 1,
            team: ['b', 'd'],
            want: 'Reject',
        },
        {
            name: 'leader omitted itself',
            leader: 'b',
            role: Role.Police,
            round: 2,
            tries: 1,
            team: ['d', 'e'],
            want: 'Reject',
        },
        {
            name: 'other acceptable team',
            leader: 'd',
            role: Role.Police,
            round: 2,
            tries: 1,
            team: ['d', 'e'],
            want: 'Approve',
        },
    ])(
        'preserves vote precedence: $name',
        ({ leader, role, round, tries, team, want }) => {
            const ctx = context({
                role,
                currentRound: round,
                consecutiveRejections: tries - 1,
                proposedTeam: team,
                history: [{ kind: 'proposal', proposerId: leader, team }],
            })
            expect(createPandSBrain().chooseTeamVote(ctx)).toBe(want)
        },
    )

    it('uses player count for the hammer, rather than the fifth proposal', () => {
        const ctx = context({
            playerIds: ['a', 'b', 'c', 'd', 'e', 'f'],
            proposedTeam: ['b', 'c', 'd'],
            consecutiveRejections: 4,
            history: [
                { kind: 'proposal', proposerId: 'b', team: ['b', 'c', 'd'] },
            ],
        })
        expect(createPandSBrain().chooseTeamVote(ctx)).toBe('Reject')
        expect(
            createPandSBrain().chooseTeamVote({
                ...ctx,
                consecutiveRejections: 5,
            }),
        ).toBe('Approve')
    })

    it('requires enough suspected moles to fail a two-sabotage raid', () => {
        const ctx = context({
            playerIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
            moleIds: ['b', 'c', 'd'],
            requiredSabotages: 2,
            proposedTeam: ['b', 'e', 'f', 'g', 'h'],
            history: [
                {
                    kind: 'proposal',
                    proposerId: 'e',
                    team: ['b', 'e', 'f', 'g', 'h'],
                },
            ],
        })
        expect(createPandSBrain().chooseTeamVote(ctx)).toBe('Approve')
        expect(
            createPandSBrain().chooseTeamVote({ ...ctx, requiredSabotages: 1 }),
        ).toBe('Reject')
    })

    it.each([
        { moles: ['a'], threshold: 1, leader: 'a', score: 0, want: 'Sabotage' },
        {
            moles: ['a', 'b'],
            threshold: 1,
            leader: 'a',
            score: 0,
            want: 'Support',
        },
        {
            moles: ['a', 'b'],
            threshold: 1,
            leader: 'b',
            score: 0,
            want: 'Sabotage',
        },
        {
            moles: ['a', 'b'],
            threshold: 1,
            leader: 'a',
            score: 2,
            want: 'Sabotage',
        },
        { moles: ['a'], threshold: 2, leader: 'b', score: 2, want: 'Support' },
        {
            moles: ['a', 'b'],
            threshold: 2,
            leader: 'a',
            score: 0,
            want: 'Sabotage',
        },
        {
            moles: ['a', 'b', 'c'],
            threshold: 2,
            leader: 'a',
            score: 0,
            want: 'Support',
        },
        {
            moles: ['a', 'b', 'c'],
            threshold: 2,
            leader: 'b',
            score: 0,
            want: 'Sabotage',
        },
        {
            moles: ['a', 'b', 'c', 'd'],
            threshold: 3,
            leader: 'a',
            score: 0,
            want: 'Support',
        },
        {
            moles: ['a', 'b', 'c', 'd'],
            threshold: 3,
            leader: 'b',
            score: 0,
            want: 'Sabotage',
        },
    ])(
        'generalises sabotage: $moles / $threshold / $leader / $score',
        ({ moles, threshold, leader, score, want }) => {
            const ctx = context({
                role: Role.Mole,
                moleIds: moles,
                requiredSabotages: threshold,
                proposedTeam: ['a', 'b', 'c', 'd'],
                scores: { police: score, moles: 0 },
            })
            expect(
                createPandSBrain().chooseRaidAction({
                    ...ctx,
                    proposerId: leader,
                }),
            ).toBe(want)
            expect(
                createPandSBrain().chooseRaidAction({
                    ...ctx,
                    role: Role.Police,
                    proposerId: leader,
                }),
            ).toBe('Support')
        },
    )

    it('also sabotages at a deciding mole score', () => {
        const ctx = context({
            role: Role.Mole,
            moleIds: ['a', 'b'],
            proposedTeam: ['a', 'b'],
            scores: { police: 0, moles: 2 },
        })
        expect(
            createPandSBrain().chooseRaidAction({ ...ctx, proposerId: 'a' }),
        ).toBe('Sabotage')
    })

    it('supports synthetic four-mole / three-sabotage votes', () => {
        const ctx = context({
            playerIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
            moleIds: ['b', 'c', 'd', 'e'],
            requiredSabotages: 3,
            proposedTeam: ['b', 'c', 'f', 'g', 'h', 'i', 'j'],
            history: [
                {
                    kind: 'proposal',
                    proposerId: 'f',
                    team: ['b', 'c', 'f', 'g', 'h', 'i', 'j'],
                },
            ],
        })
        expect(createPandSBrain().chooseTeamVote(ctx)).toBe('Approve')
        const spyCtx = { ...ctx, role: Role.Mole }
        expect(createPandSBrain().chooseTeamVote(spyCtx)).toBe('Reject')
        expect(
            createPandSBrain().chooseTeamVote({
                ...spyCtx,
                moleIds: ['b', 'c', 'f', 'g'],
            }),
        ).toBe('Approve')
    })
})

describe('PandS history adapter', () => {
    afterEach(() => vi.restoreAllMocks())

    it('processes every event only once and uses historical rounds, attempts, and thresholds', () => {
        const votes = vi.spyOn(PandSModel.prototype, 'onVoteComplete')
        const raids = vi.spyOn(PandSModel.prototype, 'onMissionComplete')
        const playerIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        const events: GameEvent[] = []
        for (const [round, size, sabotages] of [
            [1, 3, 1],
            [2, 4, 0],
            [3, 4, 1],
            [4, 5, 1],
        ]) {
            const team = playerIds.slice(1, size + 1)
            if (round === 2) {
                events.push(
                    { kind: 'proposal', proposerId: 'c', team },
                    {
                        kind: 'votes',
                        team,
                        votes: Object.fromEntries(
                            playerIds.map((id) => [id, 'Reject' as const]),
                        ),
                        consecutiveRejections: 0,
                    },
                )
            }
            events.push(
                { kind: 'proposal', proposerId: 'b', team },
                {
                    kind: 'votes',
                    team,
                    votes: Object.fromEntries(
                        playerIds.map((id) => [id, 'Approve' as const]),
                    ),
                    consecutiveRejections: round === 2 ? 1 : 0,
                },
                {
                    kind: 'raid',
                    proposerId: 'b',
                    team,
                    sabotageCount: sabotages,
                    round,
                },
            )
        }
        const brain = createPandSBrain()
        const ctx = context({
            playerIds,
            moleIds: ['b', 'c', 'd'],
            history: events,
            currentRound: 5,
        })
        brain.chooseProposedTeam({ ...ctx, teamSize: 5 })
        brain.chooseTeamVote(ctx)
        brain.chooseRaidAction({ ...ctx, proposerId: 'b' })
        expect(
            votes.mock.calls.map(([event]) => [
                event.round,
                event.tries,
                event.requiredSabotages,
                event.leader,
            ]),
        ).toEqual([
            [1, 1, 1, 1],
            [2, 1, 1, 2],
            [2, 2, 1, 1],
            [3, 1, 1, 1],
            [4, 1, 2, 1],
        ])
        expect(
            raids.mock.calls.map(([event]) => [
                event.round,
                event.sabotaged,
                event.requiredSabotages,
            ]),
        ).toEqual([
            [1, 1, 1],
            [2, 0, 1],
            [3, 1, 1],
            [4, 1, 2],
        ])
    })

    it('replays batched events identically to events received between decisions', () => {
        const eager = createPandSBrain()
        const batched = createPandSBrain()
        for (let i = 0; i < history.length; i++) {
            eager.chooseProposedTeam({
                ...context({ history: history.slice(0, i) }),
                teamSize: 3,
            })
        }
        const team = (brain: ReturnType<typeof createPandSBrain>) =>
            brain.chooseProposedTeam({ ...context({ history }), teamSize: 3 })
        expect(team(eager)).toEqual(['a', 'd', 'e'])
        expect(team(eager)).toEqual(team(batched))
    })

    it('does not use secret mole identities for innocent decisions', () => {
        for (const moleIds of [
            ['a', 'c'],
            ['c', 'd'],
            ['d', 'e'],
        ]) {
            const first = createPandSBrain()
            const second = createPandSBrain()
            expect(
                first.chooseProposedTeam({
                    ...context({ history }),
                    teamSize: 3,
                }),
            ).toEqual(
                second.chooseProposedTeam({
                    ...context({ history, moleIds }),
                    teamSize: 3,
                }),
            )
            expect(first.chooseTeamVote(context({ history }))).toBe(
                second.chooseTeamVote(context({ history, moleIds })),
            )
        }
    })

    it.each([5, 6, 7, 8] as PlayerCount[])(
        'returns legal deterministic actions for every round with %i seats',
        (n) => {
            const playerIds = Array.from({ length: n }, (_, i) => `seat-${i}`)
            const balance = BALANCE[n]
            for (let round = 1; round <= 5; round++) {
                const ctx = context({
                    actorId: playerIds[n - 1],
                    playerIds,
                    moleIds: playerIds.slice(0, balance.moles),
                    currentRound: round,
                    requiredSabotages:
                        balance.twoSabotagesRequiredOnRound.includes(round)
                            ? 2
                            : 1,
                    history: [],
                })
                const a = createPandSBrain()
                const b = createPandSBrain()
                const teamSize = balance.teamSizes[round - 1]
                const team = a.chooseProposedTeam({
                    ...ctx,
                    random: createSeededRandom(round),
                    teamSize,
                })
                expect(team).toEqual(
                    b.chooseProposedTeam({
                        ...ctx,
                        random: createSeededRandom(round),
                        teamSize,
                    }),
                )
                expect(team).toHaveLength(teamSize)
                expect(new Set(team).size).toBe(teamSize)
                expect(team).toContain(ctx.actorId)
                const events: GameEvent[] = [
                    { kind: 'proposal', proposerId: playerIds[0], team },
                ]
                expect(['Approve', 'Reject']).toContain(
                    a.chooseTeamVote({
                        ...ctx,
                        history: events,
                        proposedTeam: team,
                    }),
                )
                expect(
                    a.chooseRaidAction({
                        ...ctx,
                        history: events,
                        proposedTeam: team,
                        proposerId: playerIds[0],
                    }),
                ).toBe('Support')
            }
        },
    )
})
