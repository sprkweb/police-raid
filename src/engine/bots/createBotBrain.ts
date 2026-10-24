import {
    createLevel0Brain,
    createLevel1Brain,
    createLevel2Brain,
} from './behavioral'
import { createRandomBrain } from './random'
import type { BotBrain, BotBrainId } from './types'

/** Factory for every shipped brain. */
export function createBotBrain(id: BotBrainId = 'level1'): BotBrain {
    switch (id) {
        case 'level0':
            return createLevel0Brain()
        case 'level1':
            return createLevel1Brain()
        case 'level2':
            return createLevel2Brain()
        case 'random':
            return createRandomBrain()
        default:
            throw new Error(`Bot brain id "${id}" does not exist.`)
    }
}
