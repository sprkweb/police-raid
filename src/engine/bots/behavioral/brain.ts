import type { BotConfig, BotBrain } from '../types'
import {
    createBehavioralStrategyBrain,
    type BehavioralStrategy,
} from './behavioralStrategy'
import { Level0Strategy } from './level0'
import { LevelKPlus1Strategy, MoleHypothesesFromHistory } from './levelKPlus1'

/** Build hypotheses by modeling other players at each lower reasoning level. */
function createHypotheses(
    level: number,
    expectedOthersRationality: number,
): MoleHypothesesFromHistory {
    let modeledStrategy: BehavioralStrategy = new Level0Strategy(
        expectedOthersRationality,
    )
    for (let k = 1; k < level; k++) {
        modeledStrategy = new LevelKPlus1Strategy(
            expectedOthersRationality,
            new MoleHypothesesFromHistory(modeledStrategy),
        )
    }
    return new MoleHypothesesFromHistory(modeledStrategy)
}

/** Shares hypotheses within one match for bots with the same model of others. */
export function createBehavioralBrainFactory(): (
    config: BotConfig & { algorithm: 'behavioral' },
) => BotBrain {
    const hypothesesByModel = new Map<string, MoleHypothesesFromHistory>()
    return ({ level, rationality, expectedOthersRationality }) => {
        if (level === 0) {
            return createBehavioralStrategyBrain(
                'level0',
                new Level0Strategy(rationality),
            )
        }

        const modelKey = `${level}:${expectedOthersRationality}`
        let hypotheses = hypothesesByModel.get(modelKey)
        if (!hypotheses) {
            // Each model owns its nested hypotheses too; sharing across levels
            // could expose later events while reconstructing an earlier decision.
            hypotheses = createHypotheses(level, expectedOthersRationality)
            hypothesesByModel.set(modelKey, hypotheses)
        }

        return createBehavioralStrategyBrain(
            `level${level}`,
            new LevelKPlus1Strategy(rationality, hypotheses),
        )
    }
}
