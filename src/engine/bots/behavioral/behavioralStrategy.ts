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
    // TODO: test this
    choose(random: RandomFn): Action {
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
    chooseProposedTeam(ctx: BotProposeContext): LocalStrategy<PlayerId[]>
    chooseTeamVote(ctx: BotVoteContext): LocalStrategy<Vote>
    chooseRaidAction(ctx: BotRaidContext): LocalStrategy<RaidAction>
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
            return strategy.chooseProposedTeam(ctx).choose(ctx.random)
        },
        chooseTeamVote(ctx: BotVoteContext): Vote {
            return strategy.chooseTeamVote(ctx).choose(ctx.random)
        },
        chooseRaidAction(ctx: BotRaidContext): RaidAction {
            return strategy.chooseRaidAction(ctx).choose(ctx.random)
        },
    }
}
