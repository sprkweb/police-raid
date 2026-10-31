import type {
    GameEvent,
    PlayerId,
    RaidAction,
    Role,
    Vote,
} from '../../types/game'
import type { RandomFn } from '../rng'

export type BotBrainId = string

export type BotConfig =
    | { algorithm: 'random' }
    | { algorithm: 'pands' }
    | {
          algorithm: 'behavioral'
          level: number
          rationality: number
          expectedOthersRationality: number
      }

/** Owns brains and algorithm resources for one match. */
export interface BotFactory {
    brainFor(actorId: PlayerId): BotBrain
}

export type CreateBotFactory = (
    configs: ReadonlyMap<PlayerId, BotConfig>,
) => BotFactory

export interface BotMatchContext {
    actorId: PlayerId
    role: Role | null | undefined
    playerIds: readonly PlayerId[]
    moleIds: readonly PlayerId[]
    currentRound: number
    consecutiveRejections: number
    requiredSabotages: number
    scores: { police: number; moles: number }
    history: readonly GameEvent[]
    random: RandomFn
}

export interface BotProposeContext extends BotMatchContext {
    teamSize: number
}

export interface BotVoteContext extends BotMatchContext {
    proposedTeam: readonly PlayerId[]
}

export interface BotRaidContext extends BotMatchContext {
    proposedTeam: readonly PlayerId[]
    proposerId: PlayerId
}

/**
 * Pluggable bot decision surface. `GameEngine` must not import a concrete
 * policy.
 */
export interface BotBrain {
    id: BotBrainId
    chooseProposedTeam(ctx: BotProposeContext): PlayerId[]
    chooseTeamVote(ctx: BotVoteContext): Vote
    chooseRaidAction(ctx: BotRaidContext): RaidAction
}
