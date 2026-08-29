import type { GameEvent, PlayerId, RaidAction, Role, Vote } from '../../types/game';
import type { RandomFn } from '../rng';

/** Brains the live game can select (`createBotBrain` / lobby toggle). */
export type ProductionBotBrainId = 'heuristic' | 'bayesian';

/** Every shipped `BotBrain.id`, including bench-only policies. */
export type BotBrainId = ProductionBotBrainId | 'random';

export interface BotMatchContext {
  actorId: PlayerId;
  playerIds: readonly PlayerId[];
  moleCount: number;
  currentRound: number;
  consecutiveRejections: number;
  history: readonly GameEvent[];
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
