import type { PlayerId, RaidAction, Vote } from '../../../types/game'
import type { RandomFn } from '../../rng'
import type {
    BotBrain,
    BotBrainId,
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from '../types'
import { SampleSpace } from './sample'

export class LocalStrategy<Action> extends SampleSpace<Action> {
    chooseAction(random: RandomFn): Action {
        let r = random()
        for (let i = 0; i < this.samplePoints.length; i++) {
            r -= this.samplePoints[i].probability
            if (r < 0) {
                return this.samplePoints[i].value
            }
        }
        return this.samplePoints[this.samplePoints.length - 1].value
    }
}

/**
 * BehavioralStrategy calculates probabilities for each possible action in given
 * circumstances
 */
export interface BehavioralStrategy {
    strategyForTeamProposal(ctx: BotProposeContext): LocalStrategy<PlayerId[]>
    strategyForTeamVote(ctx: BotVoteContext): LocalStrategy<Vote>
    strategyForRaidAction(ctx: BotRaidContext): LocalStrategy<RaidAction>
}

/**
 * CreateBehavioralStrategyBrain creates a BotBrain which picks its actions
 * randomly based on given probability distributions for each action
 */
export function createBehavioralStrategyBrain(
    id: BotBrainId,
    strategy: BehavioralStrategy,
): BotBrain {
    return {
        id,
        chooseProposedTeam(ctx: BotProposeContext): PlayerId[] {
            return strategy
                .strategyForTeamProposal(ctx)
                .chooseAction(ctx.random)
        },
        chooseTeamVote(ctx: BotVoteContext): Vote {
            return strategy.strategyForTeamVote(ctx).chooseAction(ctx.random)
        },
        chooseRaidAction(ctx: BotRaidContext): RaidAction {
            return strategy.strategyForRaidAction(ctx).chooseAction(ctx.random)
        },
    }
}
