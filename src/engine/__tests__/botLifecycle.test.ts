import { afterEach, describe, expect, it, vi } from 'vitest'

import { GamePhase } from '../../types/game'
import { Level0Strategy } from '../bots/behavioral/level0'
import { MoleHypothesesFromHistory } from '../bots/behavioral/levelKPlus1'
import { createBotFactory } from '../bots/createBotFactory'
import type { BotConfig, BotFactory, CreateBotFactory } from '../bots/types'
import { BOT_ID_PREFIX, PHASE_DURATION_MS, WINS_NEEDED } from '../constants'
import { HostRoom } from '../hostRoom'
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
        engine.setAdvancedBotsEnabled(false)
        engine.setAdvancedBotsEnabled(true)
        engine.startGame()
        expect(create).not.toHaveBeenCalled()
        engine.startGameWithBots()
        expect(create).toHaveBeenCalledTimes(1)
        expect(create.mock.calls[0][0].get(botId)).toEqual(profile(1))
        engine.startGame()
        engine.startGameWithBots()
        engine.setAdvancedBotsEnabled(false)
        expect(create).toHaveBeenCalledTimes(1)
    })

    it('snapshots overrides and applies the toggle only to unconfigured bots', () => {
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
        const { engine, getState } = createTestEngine('host', 'Host', {
            botConfigsBySeat: overrides,
            createBotFactory: create,
        })
        custom.level = 0
        delete overrides[`${BOT_ID_PREFIX}2`]
        engine.setAdvancedBotsEnabled(false)
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
        expect(getState().advancedBotsEnabled).toBe(false)
    })

    it('recreates injected factories and brains on rematch, retaining settings', () => {
        const { create, factories } = observeFactory()
        const ctx = startWithPlayers(5, {
            advancedBotsEnabled: false,
            createBotFactory: create,
        })
        const oldBrain = factories[0].brainFor('host')
        for (let i = 0; i < WINS_NEEDED; i++) passSuccessfulRaid(ctx)
        expect(ctx.getState().phase).toBe(GamePhase.GameOver)
        ctx.engine.startGame()
        expect(create).toHaveBeenCalledTimes(2)
        expect(factories[1]).not.toBe(factories[0])
        expect(factories[1].brainFor('host')).not.toBe(oldBrain)
        expect(ctx.getState().advancedBotsEnabled).toBe(false)
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
        expect(create.mock.calls[1][0].get(botId)).toEqual(profile(1))
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
        expect(oldCaches.size).toBe(3)
        get.mockClear()
        ctx.engine.startGame()
        for (let i = 0; i < 20 && ctx.getState().scores.police === 0; i++) {
            vi.advanceTimersToNextTimer()
        }
        expect(ctx.getState().scores.police).toBe(1)
        expect(new Set(get.mock.contexts).size).toBe(3)
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
