import { afterEach, describe, expect, it, vi } from 'vitest'

import { Role, type GameEvent, type PlayerId } from '../../../types/game'
import {
    LevelKPlus1Strategy,
    MoleHypothesesFromHistory,
} from '../behavioral/levelKPlus1'
import { createBotFactory } from '../createBotFactory'
import type { BotConfig, BotVoteContext } from '../types'

const behavioral = (
    level = 1,
    rationality = 2.5,
    expectedOthersRationality = 1.5,
): BotConfig => ({
    algorithm: 'behavioral',
    level,
    rationality,
    expectedOthersRationality,
})
const history: GameEvent[] = [
    { kind: 'proposal', proposerId: 'a', team: ['a', 'b'] },
    {
        kind: 'votes',
        team: ['a', 'b'],
        votes: {
            a: 'Approve',
            b: 'Approve',
            c: 'Approve',
            d: 'Reject',
            e: 'Reject',
        },
        consecutiveRejections: 0,
    },
    {
        kind: 'raid',
        proposerId: 'a',
        team: ['a', 'b'],
        sabotageCount: 1,
        round: 1,
    },
]
const context = (actorId = 'a', events: GameEvent[] = []): BotVoteContext => ({
    actorId,
    role: Role.Police,
    playerIds: ['a', 'b', 'c', 'd', 'e'],
    moleIds: ['b', 'e'],
    currentRound: events.length === 3 ? 2 : 1,
    consecutiveRejections: 0,
    requiredSabotages: 1,
    scores: { police: 0, moles: events.length === 3 ? 1 : 0 },
    history: events,
    random: () => 0.4,
    proposedTeam: ['a', 'c'],
})

afterEach(() => vi.restoreAllMocks())

describe('match bot factory', () => {
    it('supports independent PandS brains and resets their learned history per match', () => {
        const configs = new Map<PlayerId, BotConfig>([
            ['a', { algorithm: 'pands' }],
            ['c', { algorithm: 'pands' }],
        ])
        const factory = createBotFactory(configs)
        const brain = factory.brainFor('a')
        expect(brain.id).toBe('pands')
        expect(factory.brainFor('a')).toBe(brain)
        expect(factory.brainFor('c')).not.toBe(brain)
        const learned = brain.chooseProposedTeam({
            ...context('a', history),
            teamSize: 2,
        })
        expect(learned).not.toContain('b')
        const fresh = createBotFactory(configs).brainFor('a')
        expect(fresh).not.toBe(brain)
        expect(fresh.chooseProposedTeam({ ...context(), teamSize: 2 })).toEqual(
            ['a', 'b'],
        )
    })

    it('keeps one brain per seat, snapshots configs, and rejects unknown seats', () => {
        const config = behavioral(0)
        const configs = new Map([
            ['a', config],
            ['b', config],
        ])
        const factory = createBotFactory(configs)
        if (config.algorithm === 'behavioral') config.level = 2
        configs.clear()
        expect(factory.brainFor('a').id).toBe('level0')
        expect(factory.brainFor('a')).toBe(factory.brainFor('a'))
        expect(factory.brainFor('a')).not.toBe(factory.brainFor('b'))
        expect(() => factory.brainFor('missing')).toThrow(/seat/i)
    })

    it('supports random bots with legal actions', () => {
        const brain = createBotFactory(
            new Map([['a', { algorithm: 'random' }]]),
        ).brainFor('a')
        const ctx = context()
        expect(brain.chooseRaidAction({ ...ctx, proposerId: 'a' })).toBe(
            'Support',
        )
        expect(brain.chooseTeamVote({ ...ctx, random: () => 0.9 })).toBe(
            'Reject',
        )
        const team = brain.chooseProposedTeam({ ...ctx, teamSize: 2 })
        expect(new Set(team).size).toBe(2)
        expect(team.every((id) => ctx.playerIds.includes(id))).toBe(true)
    })

    it.each([
        { ...behavioral(), level: -1 },
        { ...behavioral(), level: 0.5 },
        { ...behavioral(), level: Infinity },
        { ...behavioral(), rationality: -1 },
        { ...behavioral(), rationality: NaN },
        { ...behavioral(), rationality: Infinity },
        { ...behavioral(), expectedOthersRationality: -1 },
        { ...behavioral(), expectedOthersRationality: NaN },
        { ...behavioral(), expectedOthersRationality: Infinity },
        { algorithm: 'unknown' },
    ])('rejects invalid config before any action: %j', (config) => {
        expect(() =>
            createBotFactory(new Map([['a', config as BotConfig]])),
        ).toThrow()
    })

    it.each([0, 1, 2])('uses exactly %i hypothesis levels', (level) => {
        const get = vi.spyOn(MoleHypothesesFromHistory.prototype, 'get')
        createBotFactory(new Map([['a', behavioral(level, 0, 0)]]))
            .brainFor('a')
            .chooseTeamVote(context('a', history))
        expect(new Set(get.mock.contexts).size).toBe(level)
    })

    it('shares hypotheses despite different own rationality, but keeps separate decisions', () => {
        const get = vi.spyOn(MoleHypothesesFromHistory.prototype, 'get')
        const vote = vi.spyOn(LevelKPlus1Strategy.prototype, 'chooseTeamVote')
        const factory = createBotFactory(
            new Map([
                ['a', behavioral(1, 0)],
                ['c', behavioral(1, 3)],
            ]),
        )
        factory.brainFor('a').chooseTeamVote(context('a', history))
        const first = vote.mock.results
            .at(-1)!
            .value.probability((v: string) => v === 'Approve')
        factory.brainFor('c').chooseTeamVote(context('c', history))
        const second = vote.mock.results
            .at(-1)!
            .value.probability((v: string) => v === 'Approve')
        expect(new Set(get.mock.contexts).size).toBe(1)
        expect(first).toBe(0.5)
        expect(second).not.toBeCloseTo(first)
    })

    it('isolates different levels, expectations and matches, including nested caches', () => {
        const get = vi.spyOn(MoleHypothesesFromHistory.prototype, 'get')
        const configs = new Map([
            ['a', behavioral(1)],
            ['c', behavioral(2)],
            ['d', behavioral(1, 2.5, 2)],
        ])
        for (let match = 0; match < 2; match++) {
            const factory = createBotFactory(configs)
            for (const id of configs.keys())
                factory.brainFor(id).chooseTeamVote(context(id, history))
        }
        expect(new Set(get.mock.contexts).size).toBe(8)
    })

    it('does not leak later level 1 knowledge into historical level 2 reasoning', () => {
        const vote = vi.spyOn(LevelKPlus1Strategy.prototype, 'chooseTeamVote')
        const configs = new Map([
            ['a', behavioral(1)],
            ['c', behavioral(2)],
        ])
        const probability = (firstLevelOne: boolean) => {
            const factory = createBotFactory(configs)
            // Both bots have already voted on the first proposal.
            factory
                .brainFor('c')
                .chooseTeamVote(context('c', history.slice(0, 1)))
            factory
                .brainFor('a')
                .chooseTeamVote(context('a', history.slice(0, 1)))
            if (firstLevelOne)
                factory.brainFor('a').chooseTeamVote(context('a', history))
            const resultIndex = vote.mock.results.length
            factory.brainFor('c').chooseTeamVote(context('c', history))
            return vote.mock.results[resultIndex].value.probability(
                (v: string) => v === 'Approve',
            )
        }
        expect(probability(true)).toBeCloseTo(probability(false), 12)
    })
})
