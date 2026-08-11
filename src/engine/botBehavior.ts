import type { Player, PlayerId, RaidAction, Role, Vote } from '../types/game';
import { Role as Roles } from '../types/game';
import { shuffle, type RandomFn } from './rng';

/** Likely path for “selfish” / mole-like choices (approve when included, sabotage). */
export const BOT_LIKELY_CHANCE = 0.99;
/** Rare noise so role is never 100% predictable from behavior. */
export const BOT_UNLIKELY_CHANCE = 0.01;
/** Round-1 approve rate when the bot is not on the proposed team. */
export const BOT_ROUND1_OUTSIDE_APPROVE_CHANCE = 0.5;

export interface ChooseTeamVoteInput {
  botId: PlayerId;
  proposedTeam: readonly PlayerId[];
  currentRound: number;
  consecutiveRejections: number;
  playerCount: number;
}

export interface ChooseRaidActionInput {
  role: Role | null | undefined;
  currentRound: number;
}

/**
 * Bot proposer always includes itself, then fills with random other players.
 */
export function chooseProposedTeam(
  botId: PlayerId,
  players: readonly Player[],
  size: number,
  random: RandomFn,
): PlayerId[] {
  if (size <= 0) return [];
  if (size === 1) return [botId];

  const others = players.filter((p) => p.id !== botId);
  const picked = shuffle(others, random)
    .slice(0, Math.max(0, size - 1))
    .map((p) => p.id);
  return [botId, ...picked];
}

/**
 * Vote for the proposed team.
 * Last proposal before rejection-limit mole win: always Approve.
 * On team: 99% Approve. Off team: 1% Approve (round 1: 50%).
 */
export function chooseTeamVote(input: ChooseTeamVoteInput, random: RandomFn): Vote {
  const { botId, proposedTeam, currentRound, consecutiveRejections, playerCount } = input;

  // One more rejection would hit molesWinByRejectionLimit — always Approve.
  if (consecutiveRejections >= playerCount - 1) {
    return 'Approve';
  }

  const onTeam = proposedTeam.includes(botId);
  if (onTeam) {
    return random() < BOT_LIKELY_CHANCE ? 'Approve' : 'Reject';
  }

  const approveChance =
    currentRound === 1 ? BOT_ROUND1_OUTSIDE_APPROVE_CHANCE : BOT_UNLIKELY_CHANCE;
  return random() < approveChance ? 'Approve' : 'Reject';
}

/**
 * Raid action for a bot on the team.
 * Police always Support. Mole sabotages with 99% (round 1: 1%).
 */
export function chooseRaidAction(input: ChooseRaidActionInput, random: RandomFn): RaidAction {
  if (input.role !== Roles.Mole) {
    return 'Support';
  }

  const sabotageChance = input.currentRound === 1 ? BOT_UNLIKELY_CHANCE : BOT_LIKELY_CHANCE;
  return random() < sabotageChance ? 'Sabotage' : 'Support';
}
