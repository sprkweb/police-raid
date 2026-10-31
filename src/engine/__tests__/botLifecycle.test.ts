import { afterEach, describe, expect, it, vi } from 'vitest'

import { GamePhase } from '../../types/game'
import { Level0Strategy } from '../bots/behavioral/level0'
import { MoleHypothesesFromHistory } from '../bots/behavioral/levelKPlus1'
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
    rationality: 2.5,
    expectedOthersRationality: 1.5,
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
            rationality: 3,
            expectedOthersRationality: 0.5,
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
            rationality: 3,
            expectedOthersRationality: 0.5,
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
        const propose = vi.spyOn(Level0Strategy.prototype, 'chooseProposedTeam')
        const vote = vi.spyOn(Level0Strategy.prototype, 'chooseTeamVote')
        const raid = vi.spyOn(Level0Strategy.prototype, 'chooseRaidAction')
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

    it('uses random for reinforcement but keeps human timeout defaults', () => {
        const { create, factories } = observeFactory()
        const { engine } = createTestEngine('host', 'Bot Alpha', {
            createBotFactory: create,
            random: () => 0,
        })
        engine.setBotBrainId('random')
        engine.startGameWithBots()
        expect(factories[0].brainFor(botId).id).toBe('random')
        expect(factories[0].brainFor('host').id).toBe('level0')
        const names = engine.getState().players.map((p) => p.name.toLowerCase())
        expect(new Set(names).size).toBe(names.length)
        expect(
            engine
                .getState()
                .players.slice(1)
                .every((p) => p.name.startsWith('Bot ')),
        ).toBe(true)
    })
})

describe('reinforcement rematch', () => {
    it('publishes selection and retains tactics and names while replacing departed humans', () => {
        vi.useFakeTimers()
        const { create } = observeFactory()
        const ctx = createTestEngine('host', 'Host', {
            createBotFactory: create,
            timersEnabled: true,
            botConfigsBySeat: { [botId]: profile(0) },
        })
        ctx.engine.addPlayer('p2', 'Human')
        ctx.engine.setBotBrainId('random')
        expect(ctx.latest.botBrainId).toBe('random')
        expect(projectForPlayer(ctx.latest, 'p2').botBrainId).toBe('random')
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
        expect(ctx.getState().botBrainId).toBe('random')
        expect(
            ctx
                .getState()
                .players.slice(2)
                .map((p) => p.name),
        ).toEqual(names)
        expect(create.mock.calls[1][0].get(`${BOT_ID_PREFIX}4`)).toEqual({
            algorithm: 'random',
        })
    })
})
