import type { PlayerId, RaidAction, Vote } from '../../../types/game'
import type {
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from '../types'
import { LocalStrategy, type BehavioralStrategy } from './behavioralStrategy'

export interface Utility<Action> {
    action: Action
    utility: number
}

function softmax(logits: readonly number[]): number[] {
    if (logits.length === 0) return []

    const exps = logits.map((v) => Math.exp(v))
    const sum = exps.reduce((acc, e) => acc + e, 0)
    return exps.map((e) => e / sum)
}

export class LogitQuantalResponse<Action> extends LocalStrategy<Action> {
    readonly utilities: readonly Utility<Action>[]

    constructor(utilities: readonly Utility<Action>[], precision: number) {
        if (utilities.length === 0) {
            super([])
            this.utilities = []
            return
        }

        const probabilities = softmax(
            utilities.map((u) => u.utility * precision),
        )
        super(
            probabilities.map((probability, i) => ({
                probability,
                value: utilities[i].action,
            })),
        )
        this.utilities = utilities
    }
}

/**
 * ActionUtilityEstimator estimates utilities for each possible action in given
 * circumstances
 */
export interface ActionUtilityEstimator {
    estimateProposedTeam(ctx: BotProposeContext): readonly Utility<PlayerId[]>[]
    estimateTeamVote(ctx: BotVoteContext): readonly Utility<Vote>[]
    estimateRaidAction(ctx: BotRaidContext): readonly Utility<RaidAction>[]
}

/**
 * LogitBehavioralStrategy is a BehavioralStrategy which calculates the
 * probabilities of each action based on their estimated utilities
 */
export class LogitBehavioralStrategy implements BehavioralStrategy {
    readonly precision: number
    readonly estimator: ActionUtilityEstimator

    constructor(precision: number, estimator: ActionUtilityEstimator) {
        this.precision = precision
        this.estimator = estimator
    }

    strategyForTeamProposal(
        ctx: BotProposeContext,
    ): LogitQuantalResponse<PlayerId[]> {
        const utilities = this.estimator.estimateProposedTeam(ctx)
        return new LogitQuantalResponse(utilities, this.precision)
    }

    strategyForTeamVote(ctx: BotVoteContext): LogitQuantalResponse<Vote> {
        const utilities = this.estimator.estimateTeamVote(ctx)
        return new LogitQuantalResponse(utilities, this.precision)
    }

    strategyForRaidAction(
        ctx: BotRaidContext,
    ): LogitQuantalResponse<RaidAction> {
        const utilities = this.estimator.estimateRaidAction(ctx)
        return new LogitQuantalResponse(utilities, this.precision)
    }
}
