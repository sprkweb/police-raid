import { afterEach, describe, expect, it, vi } from 'vitest'

import { GamePhase, Role } from '../../types/game'
import { Level0Estimator } from '../bots/behavioral/level0'
import { MoleHypothesesFromHistory } from '../bots/behavioral/levelKPlus1'
import { LogitBehavioralStrategy } from '../bots/behavioral/logitQuantalResponse'
import { createBotFactory } from '../bots/createBotFactory'
import type { BotConfig, BotFactory, CreateBotFactory } from '../bots/types'
import { BOT_ID_PREFIX, PHASE_DURATION_MS, WINS_NEEDED } from '../constants'
import { HostRoom } from '../hostRoom'
import { projectForPlayer } from '../projectState'
import {
    createTestEngine,
    fillLobby,
    passSuccessfulRaid,
    startWithPlayers,
} from './helpers'

const botId = `${BOT_ID_PREFIX}1`
const profile = (level: number): BotConfig => ({
    algorithm: 'behavioral',
    level,
    precision: 2.5,
    expectedOthersPrecision: 1.5,
})
function observeFactory() {
    const factories: BotFactory[] = []
    const create = vi.fn<CreateBotFactory>((configs) => {
        const factory = createBotFactory(configs)
        factories.push(factory)
        return factory
    })
    return { create, factories }
}

afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('bot match lifecycle', () => {
    it('creates once per successful start, never in the lobby or on rejected starts', () => {
        const { create } = observeFactory()
        const { engine } = createTestEngine('host', 'Host', {
            createBotFactory: create,
        })
        engine.startGame()
        expect(create).not.toHaveBeenCalled()
        engine.startGameWithBots()
        expect(create).toHaveBeenCalledTimes(1)
        expect(create.mock.calls[0][0].get(botId)).toEqual(profile(0))
        engine.startGame()
        engine.startGameWithBots()
        expect(create).toHaveBeenCalledTimes(1)
    })

    it('snapshots overrides and defaults unconfigured bots to level 0', () => {
        const { create, factories } = observeFactory()
        const custom: BotConfig = {
            algorithm: 'behavioral',
            level: 2,
            precision: 3,
            expectedOthersPrecision: 0.5,
        }
        const overrides: Record<string, BotConfig> = {
            [botId]: custom,
            [`${BOT_ID_PREFIX}2`]: { algorithm: 'random' },
            host: custom,
        }
        const { engine } = createTestEngine('host', 'Host', {
            botConfigsBySeat: overrides,
            createBotFactory: create,
        })
        custom.level = 0
        delete overrides[`${BOT_ID_PREFIX}2`]
        engine.startGameWithBots()
        const configs = create.mock.calls[0][0]
        expect(configs.get(botId)).toEqual({
            algorithm: 'behavioral',
            level: 2,
            precision: 3,
            expectedOthersPrecision: 0.5,
        })
        expect(configs.get(`${BOT_ID_PREFIX}2`)).toEqual({
            algorithm: 'random',
        })
        expect(configs.get(`${BOT_ID_PREFIX}3`)).toEqual(profile(0))
        expect(configs.get('host')).toEqual(profile(0))
        expect(factories[0].brainFor(botId).id).toBe('level2')
    })

    it('recreates factories and brains on rematch', () => {
        vi.useFakeTimers()
        const { create, factories } = observeFactory()
        const ctx = createTestEngine('host', 'Host', {
            createBotFactory: create,
            timersEnabled: true,
            random: () => 0,
        })
        ctx.engine.startGameWithBots()
        const oldBrain = factories[0].brainFor(botId)
        for (
            let i = 0;
            i < 100 && ctx.getState().phase !== GamePhase.GameOver;
            i++
        ) {
            vi.advanceTimersToNextTimer()
        }
        expect(ctx.getState().phase).toBe(GamePhase.GameOver)
        ctx.engine.startGame()
        expect(create).toHaveBeenCalledTimes(2)
        expect(factories[1]).not.toBe(factories[0])
        expect(factories[1].brainFor(botId)).not.toBe(oldBrain)
        expect(factories[0].brainFor(botId).id).toBe('level0')
        expect(factories[1].brainFor(botId).id).toBe('level0')
        expect(ctx.getState().history).toEqual([])
    })

    it('gives replacements the default instead of the departed human override', () => {
        const { create } = observeFactory()
        const ctx = startWithPlayers(5, {
            botConfigsBySeat: { p2: { algorithm: 'random' } },
            createBotFactory: create,
        })
        for (let i = 0; i < WINS_NEEDED; i++) passSuccessfulRaid(ctx)
        ctx.engine.removePlayer('p2')
        ctx.engine.startGame()
        expect(create.mock.calls[1][0].has('p2')).toBe(false)
        expect(create.mock.calls[1][0].get(botId)).toEqual(profile(0))
    })

    it('discards real behavioral caches after a complete bot match', () => {
        vi.useFakeTimers()
        const get = vi.spyOn(MoleHypothesesFromHistory.prototype, 'get')
        const ctx = createTestEngine('host', 'Host', {
            random: () => 0,
            timersEnabled: true,
            botConfigsBySeat: { [botId]: profile(2) },
        })
        ctx.engine.startGameWithBots()
        for (
            let i = 0;
            i < 100 && ctx.getState().phase !== GamePhase.GameOver;
            i++
        ) {
            vi.advanceTimersToNextTimer()
        }
        expect(ctx.getState().phase).toBe(GamePhase.GameOver)
        const oldCaches = new Set(get.mock.contexts)
        expect(oldCaches.size).toBe(2)
        get.mockClear()
        ctx.engine.startGame()
        for (let i = 0; i < 20 && ctx.getState().scores.police === 0; i++) {
            vi.advanceTimersToNextTimer()
        }
        expect(ctx.getState().scores.police).toBe(1)
        expect(new Set(get.mock.contexts).size).toBe(2)
        expect(get.mock.contexts.every((cache) => !oldCaches.has(cache))).toBe(
            true,
        )
    })

    it('uses cache-free level 0 for all human timeout actions, even with overrides', () => {
        vi.useFakeTimers()
        const propose = vi.spyOn(
            Level0Estimator.prototype,
            'estimateProposedTeam',
        )
        const vote = vi.spyOn(Level0Estimator.prototype, 'estimateTeamVote')
        const raid = vi.spyOn(Level0Estimator.prototype, 'estimateRaidAction')
        const get = vi.spyOn(MoleHypothesesFromHistory.prototype, 'get')
        const ctx = startWithPlayers(5, {
            timersEnabled: true,
            random: () => 0,
            botConfigsBySeat: { host: profile(2), p2: { algorithm: 'random' } },
        })
        ctx.engine.endDiscussion()
        vi.advanceTimersByTime(PHASE_DURATION_MS.ProposingTeam)
        expect(ctx.getState().phase).toBe(GamePhase.VotingOnTeam)
        expect(propose).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(PHASE_DURATION_MS.VotingOnTeam)
        expect(ctx.getState().phase).toBe(GamePhase.Raid)
        expect(vote).toHaveBeenCalledTimes(5)
        vi.advanceTimersByTime(PHASE_DURATION_MS.Raid)
        expect(raid).toHaveBeenCalledTimes(2)
        expect(ctx.getState().raidResults).toHaveLength(1)
        expect(get).not.toHaveBeenCalled()
    })

    it('forwards factory and seat configuration through HostRoom', () => {
        const { create } = observeFactory()
        const room = new HostRoom('peer', 'Host', () => {}, {
            createBotFactory: create,
            botConfigsBySeat: { [botId]: { algorithm: 'random' } },
            timersEnabled: false,
        })
        room.startGameWithBots()
        expect(create.mock.calls[0][0].get(botId)).toEqual({
            algorithm: 'random',
        })
        room.dispose()
    })

    it('keeps a human-only match factory ready for later timeouts', () => {
        const { create } = observeFactory()
        const { engine } = createTestEngine('host', 'Host', {
            createBotFactory: create,
        })
        fillLobby(engine, 5)
        engine.startGame()
        expect([...create.mock.calls[0][0].values()]).toEqual(
            Array.from({ length: 5 }, () => profile(0)),
        )
    })
})

describe('lobby reinforcement tactics', () => {
    it('routes the level1 lobby tactic through the default logit model and private proposal bonus', () => {
        const { create, factories } = observeFactory()
        const { engine } = createTestEngine('host', 'Host', {
            createBotFactory: create,
        })
        engine.setBotBrainId('level1')
        engine.startGameWithBots()
        expect(create.mock.calls[0][0].get(botId)).toEqual(profile(1))
        const brain = factories[0].brainFor(botId)
        const propose = vi.spyOn(
            LogitBehavioralStrategy.prototype,
            'strategyForTeamProposal',
        )
        const vote = vi.spyOn(
            LogitBehavioralStrategy.prototype,
            'strategyForTeamVote',
        )
        const raid = vi.spyOn(
            LogitBehavioralStrategy.prototype,
            'strategyForRaidAction',
        )
        const ctx = {
            actorId: botId,
            role: Role.Police,
            playerIds: ['A', 'B', botId, 'D', 'E'],
            moleIds: ['A', botId],
            currentRound: 2,
            consecutiveRejections: 0,
            requiredSabotages: 1,
            scores: { police: 0, moles: 1 },
            random: () => 0,
            history: [
                {
                    kind: 'proposal' as const,
                    proposerId: 'A',
                    team: ['A', 'B'],
                },
                {
                    kind: 'raid' as const,
                    proposerId: 'A',
                    team: ['A'],
                    sabotageCount: 1,
                    round: 1,
                },
            ],
            teamSize: 2,
        }
        brain.chooseProposedTeam(ctx)
        const police: ReturnType<
            LogitBehavioralStrategy['strategyForTeamProposal']
        > = propose.mock.results.at(-1)!.value
        brain.chooseProposedTeam({ ...ctx, role: Role.Mole })
        const mole: typeof police = propose.mock.results.at(-1)!.value
        const utility = (distribution: typeof police, team: string[]) =>
            distribution.utilities.find(
                ({ action }) => action.join() === team.join(),
            )!.utility
        // Physical evidence fixes A. QR is uniform on AB/AD/AE. The observed
        // proposal has Qall odds AB:AD:AE = exp(-.36):1:1 under beta=1.5.
        expect(utility(police, ['B', botId])).toBeCloseTo(1.378160605, 9)
        expect(utility(police, [botId, 'D'])).toBeCloseTo(1.3109196975, 9)
        expect(utility(mole, ['B', botId])).toBeCloseTo(1.878160605, 9)
        expect(utility(mole, ['B', 'D'])).toBeCloseTo(-0.097471516, 9)
        expect(
            mole.probability((t) => t.join() === ['B', botId].join()) /
                mole.probability((t) => t.join() === 'B,D'),
        ).toBeCloseTo(Math.exp(2.5 * (1.878160605 - -0.097471516)), 7)
        brain.chooseTeamVote({ ...ctx, proposedTeam: ['B', botId] })
        const voteDistribution: ReturnType<
            LogitBehavioralStrategy['strategyForTeamVote']
        > = vote.mock.results.at(-1)!.value
        expect(
            voteDistribution.probability((v) => v === 'Approve'),
        ).toBeCloseTo(0.7201894454, 9)
        brain.chooseRaidAction({
            ...ctx,
            role: Role.Mole,
            proposedTeam: [botId, 'D'],
            proposerId: 'A',
            scores: { police: 2, moles: 1 },
        })
        const raidDistribution: ReturnType<
            LogitBehavioralStrategy['strategyForRaidAction']
        > = raid.mock.results.at(-1)!.value
        expect(
            raidDistribution.probability((a) => a === 'Sabotage'),
        ).toBeCloseTo(0.9914225146, 9)
    })

    it('defaults to level0 and accepts only available tactics in the lobby', () => {
        const { engine } = createTestEngine('host', 'Host')
        expect(engine.getState().botBrainId).toBe('level0')
        engine.setBotBrainId('random')
        expect(engine.getState().botBrainId).toBe('random')
        engine.setBotBrainId('unknown')
        expect(engine.getState().botBrainId).toBe('random')
        engine.startGameWithBots()
        engine.setBotBrainId('level0')
        expect(engine.getState().botBrainId).toBe('random')
    })

    it.each(['random', 'level1', 'pands'] as const)(
        'uses %s for reinforcement but keeps human timeout defaults',
        (algorithm) => {
            const { create, factories } = observeFactory()
            const { engine } = createTestEngine('host', 'Bot Alpha', {
                createBotFactory: create,
                random: () => 0,
            })
            engine.setBotBrainId(algorithm)
            expect(engine.getState().botBrainId).toBe(algorithm)
            expect(projectForPlayer(engine.getState(), 'host').botBrainId).toBe(
                algorithm,
            )
            engine.startGameWithBots()
            for (const player of engine.getState().players.slice(1)) {
                expect(factories[0].brainFor(player.id).id).toBe(algorithm)
            }
            expect(factories[0].brainFor('host').id).toBe('level0')
            engine.setBotBrainId('level0')
            expect(engine.getState().botBrainId).toBe(algorithm)
            const names = engine
                .getState()
                .players.map((p) => p.name.toLowerCase())
            expect(new Set(names).size).toBe(names.length)
            expect(
                engine
                    .getState()
                    .players.slice(1)
                    .every((p) => p.name.startsWith('Bot ')),
            ).toBe(true)
        },
    )
})

describe('reinforcement rematch', () => {
    it.each(['random', 'pands'] as const)(
        'publishes %s selection and retains tactics and names while replacing departed humans',
        (algorithm) => {
            vi.useFakeTimers()
            const { create } = observeFactory()
            const ctx = createTestEngine('host', 'Host', {
                createBotFactory: create,
                timersEnabled: true,
                botConfigsBySeat: { [botId]: profile(0) },
            })
            ctx.engine.addPlayer('p2', 'Human')
            ctx.engine.setBotBrainId(algorithm)
            expect(ctx.latest.botBrainId).toBe(algorithm)
            expect(projectForPlayer(ctx.latest, 'p2').botBrainId).toBe(
                algorithm,
            )
            ctx.engine.startGameWithBots()
            expect(create.mock.calls[0][0].get(botId)).toEqual(profile(0))
            const names = ctx
                .getState()
                .players.slice(2)
                .map((p) => p.name)
            for (
                let i = 0;
                i < 200 && ctx.getState().phase !== GamePhase.GameOver;
                i++
            )
                vi.advanceTimersToNextTimer()
            expect(ctx.getState().phase).toBe(GamePhase.GameOver)
            ctx.engine.removePlayer('p2')
            ctx.engine.startGame()
            expect(ctx.getState().botBrainId).toBe(algorithm)
            expect(
                ctx
                    .getState()
                    .players.slice(2)
                    .map((p) => p.name),
            ).toEqual(names)
            expect(create.mock.calls[1][0].get(`${BOT_ID_PREFIX}4`)).toEqual({
                algorithm,
            })
        },
    )
})
