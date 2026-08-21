import type { PlayerId, RaidAction, Role, Vote } from '../../types/game';
import type { RandomFn } from '../rng';

/** Which `BotBrain` implementation is active. Default in production is `bayesian`. */
export type BotBrainId = 'heuristic' | 'bayesian';

/**
 * Host-only public timeline used by Bayesian bots.
 * Not part of projected `GameState`.
 */
export type BotObservation =
  | {
      kind: 'proposal';
      proposerId: PlayerId;
      team: readonly PlayerId[];
    }
  | {
      kind: 'votes';
      team: readonly PlayerId[];
      votes: Readonly<Record<PlayerId, Vote>>;
      /** Streak before this ballot resolves; nested cop hammer uses this. */
      consecutiveRejections: number;
    }
  | {
      kind: 'raid';
      team: readonly PlayerId[];
      sabotageCount: number;
      proposerId: PlayerId;
      round: number;
    };

export interface BotMatchContext {
  actorId: PlayerId;
  playerIds: readonly PlayerId[];
  moleCount: number;
  currentRound: number;
  consecutiveRejections: number;
  history: readonly BotObservation[];
  random: RandomFn;
}

export interface BotProposeContext extends BotMatchContext {
  teamSize: number;
}

export interface BotVoteContext extends BotMatchContext {
  proposedTeam: readonly PlayerId[];
}

export interface BotRaidContext extends BotMatchContext {
  role: Role | null | undefined;
  proposedTeam: readonly PlayerId[];
  proposerId: PlayerId;
  requiredSabotages: number;
  scores: { police: number; moles: number };
  /** True mole set; used only for raid sabotage, never for propose/vote. */
  trueMoleIds: readonly PlayerId[];
}

/** Pluggable bot decision surface. `GameEngine` must not import a concrete policy. */
export interface BotBrain {
  readonly id: BotBrainId;
  chooseProposedTeam(ctx: BotProposeContext): PlayerId[];
  chooseTeamVote(ctx: BotVoteContext): Vote;
  chooseRaidAction(ctx: BotRaidContext): RaidAction;
}

export interface WorldBelief {
  moles: readonly PlayerId[];
  probability: number;
}
