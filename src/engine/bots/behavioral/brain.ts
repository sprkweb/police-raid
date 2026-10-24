import type { BotBrain } from '../types'
import {
    createBehavioralStrategyBrain,
    type BehavioralStrategy,
} from './behavioralStrategy'
import { Level0Strategy } from './level0'
import { LevelKPlus1Strategy, MoleHypothesesFromHistory } from './levelKPlus1'

const DEFAULT_BOT_RATIONALITY = 2.5
const EXPECTED_OTHERS_RATIONALITY = 1.5

export function createLevel0Brain(): BotBrain {
    return createLevelKBrain(
        0,
        DEFAULT_BOT_RATIONALITY,
        EXPECTED_OTHERS_RATIONALITY,
    )
}

export function createLevel1Brain(): BotBrain {
    return createLevelKBrain(
        1,
        DEFAULT_BOT_RATIONALITY,
        EXPECTED_OTHERS_RATIONALITY,
    )
}

export function createLevel2Brain(): BotBrain {
    return createLevelKBrain(
        2,
        DEFAULT_BOT_RATIONALITY,
        EXPECTED_OTHERS_RATIONALITY,
    )
}

/**
 * CreateLevelKBrain is a factory to create a Level-K bot brain with any
 * rationality and any K. In practice, levels above 2 are probably unneccessary
 */
function createLevelKBrain(
    level: number,
    botRationality: number,
    otherPlayersRationality: number,
): BotBrain {
    if (!Number.isInteger(level) || level < 0) {
        throw new Error(`Level ${level} is not a positive integer.`)
    }

    // first create level 0 strategy
    let levelKStrategy: BehavioralStrategy = new Level0Strategy(
        level === 0 ? botRationality : otherPlayersRationality,
    )

    // then in a loop create level k+1 stategies until the given level
    for (let k = 1; k <= level; k++) {
        levelKStrategy = new LevelKPlus1Strategy(
            k === level ? botRationality : otherPlayersRationality,
            new MoleHypothesesFromHistory(levelKStrategy),
        )
    }

    const botBrainId = `level${level}`
    return createBehavioralStrategyBrain(botBrainId, levelKStrategy)
}
