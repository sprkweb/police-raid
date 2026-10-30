import type { PlayerId } from '../../types/game'
import { createBehavioralBrainFactory } from './behavioral/brain'
import { createRandomBrain } from './random'
import type { BotBrain, BotConfig, CreateBotFactory } from './types'

function validateConfig(config: BotConfig): void {
    switch (config.algorithm) {
        case 'random':
            return
        case 'behavioral':
            if (!Number.isInteger(config.level) || config.level < 0) {
                throw new Error('Bot level must be a non-negative integer.')
            }
            for (const value of [
                config.rationality,
                config.expectedOthersRationality,
            ]) {
                if (!Number.isFinite(value) || value < 0) {
                    throw new Error(
                        'Bot rationality must be finite and non-negative.',
                    )
                }
            }
            return
        default:
            throw new Error('Unknown bot algorithm.')
    }
}

/** A fixed roster and one append-only history. Never reuse across matches. */
export const createBotFactory: CreateBotFactory = (configs) => {
    const configMap = new Map<PlayerId, BotConfig>()
    for (const [playerId, config] of configs) {
        validateConfig(config)
        configMap.set(playerId, { ...config })
    }

    const brains = new Map<PlayerId, BotBrain>()
    const createBehavioralBrain = createBehavioralBrainFactory()

    return {
        brainFor(actorId) {
            const config = configMap.get(actorId)
            if (!config) throw new Error(`Unknown bot seat "${actorId}".`)

            let brain = brains.get(actorId)
            if (!brain) {
                switch (config.algorithm) {
                    case 'random':
                        brain = createRandomBrain()
                        break
                    case 'behavioral':
                        brain = createBehavioralBrain(config)
                        break
                }
                brains.set(actorId, brain)
            }

            return brain
        },
    }
}
