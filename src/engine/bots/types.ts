import type { GameEvent, GamePhase, PlayerId, RaidAction, Role, Vote } from '../../types/game';
import type { RandomFn } from '../rng';

export type BotBrainId = 'heuristic' | 'bayesian' | 'random';

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

export interface BotDebugContext {
  players: readonly { id: PlayerId; name: string }[];
  moleCount: number;
  observerIds: readonly PlayerId[];
  history: readonly GameEvent[];
  proposedTeam: readonly PlayerId[];
  phase: GamePhase;
  currentRound: number;
}

/** Pluggable bot decision surface. `GameEngine` must not import a concrete policy. */
export interface BotBrain {
  readonly id: BotBrainId;
  chooseProposedTeam(ctx: BotProposeContext): PlayerId[];
  chooseTeamVote(ctx: BotVoteContext): Vote;
  chooseRaidAction(ctx: BotRaidContext): RaidAction;
  debugBeliefs?(ctx: BotDebugContext): unknown;
}

/** Per-seat policy. A single live brain is `() => brain` for every actor. */
export type BotBrainForSeat = (actorId: PlayerId) => BotBrain;
