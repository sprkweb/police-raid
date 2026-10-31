import { describe, expect, it } from 'vitest'

import { GamePhase, Role, type PlayerId } from '../../types/game'
import { createBotFactory } from '../bots/createBotFactory'
import type { BotConfig, BotFactory } from '../bots/types'
import { BALANCE, type PlayerCount } from '../constants'
import { createSeededRandom } from '../rng'
import { createTestEngine, fillLobby } from './helpers'

describe('PandS match integration', () => {
    it.each([5, 6, 7, 8] as PlayerCount[])(
        'finishes legal %i-player matches and recreates brains on rematch',
        (n) => {
            for (const seed of [1, 23, 42]) {
                const factories: BotFactory[] = []
                const ids = Array.from({ length: n }, (_, i) => `bot-${i + 1}`)
                const configs: Record<PlayerId, BotConfig> = Object.fromEntries(
                    ids.map((id) => [id, { algorithm: 'pands' }]),
                )
                const ctx = createTestEngine(ids[0], 'Bot', {
                    botConfigsBySeat: configs,
                    random: createSeededRandom(seed),
                    createBotFactory(configs) {
                        const factory = createBotFactory(configs)
                        factories.push(factory)
                        return factory
                    },
                })
                fillLobby(ctx.engine, n, 'bot-')
                ctx.engine.startGame()
                const firstBrain = factories[0].brainFor(ids[0])
                expect(firstBrain.id).toBe('pands')
                for (let match = 0; match < 2; match++) {
                    for (
                        let round = 0;
                        round < 5 &&
                        ctx.getState().phase !== GamePhase.GameOver;
                        round++
                    ) {
                        expect(ctx.getState().phase).toBe(GamePhase.Discussion)
                        ctx.engine.endDiscussion()
                    }
                    const state = ctx.getState()
                    expect(state.phase).toBe(GamePhase.GameOver)
                    expect(['Police', 'Moles']).toContain(state.winner)
                    for (const raid of state.raidResults) {
                        expect(new Set(raid.team).size).toBe(
                            BALANCE[n].teamSizes[raid.round - 1],
                        )
                        const moleCount = raid.team.filter(
                            (id) =>
                                state.players.find((p) => p.id === id)?.role ===
                                Role.Mole,
                        ).length
                        expect(raid.sabotageCount).toBeLessThanOrEqual(
                            moleCount,
                        )
                        const threshold = BALANCE[
                            n
                        ].twoSabotagesRequiredOnRound.includes(raid.round)
                            ? 2
                            : 1
                        expect(raid.success).toBe(
                            raid.sabotageCount < threshold,
                        )
                    }
                    if (match === 0) {
                        ctx.engine.startGame()
                        expect(factories).toHaveLength(2)
                        expect(factories[1].brainFor(ids[0])).not.toBe(
                            firstBrain,
                        )
                        expect(ctx.getState().history).toEqual([])
                    }
                }
            }
        },
    )
})
