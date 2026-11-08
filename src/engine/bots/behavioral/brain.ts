import type { BotConfig, BotBrain } from '../types'
import {
    createBehavioralStrategyBrain,
    type BehavioralStrategy,
} from './behavioralStrategy'
import { Level0Estimator } from './level0'
import { LevelKPlus1Estimator, MoleHypothesesFromHistory } from './levelKPlus1'
import {
    LogitBehavioralStrategy,
    type ActionUtilityEstimator,
} from './logitQuantalResponse'

/** Build hypotheses by modeling other players at each lower reasoning level. */
function createHypotheses(
    level: number,
    expectedOthersPrecision: number,
): MoleHypothesesFromHistory {
    // first create level 0 strategy
    let modeledStrategy: BehavioralStrategy = new LogitBehavioralStrategy(
        expectedOthersPrecision,
        new Level0Estimator(),
    )

    for (let k = 1; k < level; k++) {
        // then create level 1, 2, ... k strategies
        const hypotheses = new MoleHypothesesFromHistory(modeledStrategy)
        const utilityEstimator = new LevelKPlus1Estimator(hypotheses)
        modeledStrategy = new LogitBehavioralStrategy(
            expectedOthersPrecision,
            utilityEstimator,
        )
    }

    return new MoleHypothesesFromHistory(modeledStrategy)
}

/** Shares hypotheses within one match for bots with the same model of others. */
export function createBehavioralBrainFactory(): (
    config: BotConfig & { algorithm: 'behavioral' },
) => BotBrain {
    const hypothesesByModel = new Map<string, MoleHypothesesFromHistory>()
    return ({ level, precision, expectedOthersPrecision }) => {
        let utilityEstimator: ActionUtilityEstimator

        if (level === 0) {
            utilityEstimator = new Level0Estimator()
        } else {
            // create an estimator based on the model of other players at level k reasoning
            const modelKey = `${level}:${expectedOthersPrecision}`
            let hypotheses = hypothesesByModel.get(modelKey)
            if (!hypotheses) {
                // Each model owns its nested hypotheses too; sharing across levels
                // could expose later events while reconstructing an earlier decision.
                hypotheses = createHypotheses(level, expectedOthersPrecision)
                hypothesesByModel.set(modelKey, hypotheses)
            }

            utilityEstimator = new LevelKPlus1Estimator(hypotheses)
        }

        const strategy = new LogitBehavioralStrategy(
            precision,
            utilityEstimator,
        )
        return createBehavioralStrategyBrain(`level${level}`, strategy)
    }
}
