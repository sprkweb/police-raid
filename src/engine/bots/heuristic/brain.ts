import type { Player, PlayerId, RaidAction, Role, Vote } from '../../../types/game';
import { Role as Roles } from '../../../types/game';
import { shuffle, type RandomFn } from '../../rng';
import type { BotBrain, BotProposeContext, BotRaidContext, BotVoteContext } from '../types';

/**
 * Original selfish heuristics. Bots vote for themselves and barely use history.
 * Kept as a selectable `BotBrain` for benchmarks; not the default.
 */

export const BOT_LIKELY_CHANCE = 0.99;
export const BOT_UNLIKELY_CHANCE = 0.01;
export const BOT_RANDOM_CHANCE = 0.5;

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

/** Bot proposer always includes itself, then fills with random other players. */
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
 * On team: likely to Approve. Off team: unlikely to Approve (round 1: random).
 */
export function chooseTeamVote(input: ChooseTeamVoteInput, random: RandomFn): Vote {
  const { botId, proposedTeam, currentRound, consecutiveRejections, playerCount } = input;

  if (consecutiveRejections >= playerCount - 1) {
    return 'Approve';
  }

  const onTeam = proposedTeam.includes(botId);
  if (onTeam) {
    return random() < BOT_LIKELY_CHANCE ? 'Approve' : 'Reject';
  }

  const approveChance = currentRound === 1 ? BOT_RANDOM_CHANCE : BOT_UNLIKELY_CHANCE;
  return random() < approveChance ? 'Approve' : 'Reject';
}

/**
 * Raid action for a bot on the team.
 * Police always Support. Mole sabotages with likely chance (round 1: unlikely chance).
 */
export function chooseRaidAction(input: ChooseRaidActionInput, random: RandomFn): RaidAction {
  if (input.role !== Roles.Mole) {
    return 'Support';
  }

  const sabotageChance = input.currentRound === 1 ? BOT_UNLIKELY_CHANCE : BOT_LIKELY_CHANCE;
  return random() < sabotageChance ? 'Sabotage' : 'Support';
}

function playersFromIds(playerIds: readonly PlayerId[]): Player[] {
  return playerIds.map((id) => ({ id, name: id, role: null, connected: true }));
}

/** Adapter so `GameEngine` can treat heuristics as a `BotBrain`. */
export function createHeuristicBrain(): BotBrain {
  return {
    id: 'heuristic',
    chooseProposedTeam(ctx: BotProposeContext): PlayerId[] {
      return chooseProposedTeam(ctx.actorId, playersFromIds(ctx.playerIds), ctx.teamSize, ctx.random);
    },
    chooseTeamVote(ctx: BotVoteContext): Vote {
      return chooseTeamVote(
        {
          botId: ctx.actorId,
          proposedTeam: ctx.proposedTeam,
          currentRound: ctx.currentRound,
          consecutiveRejections: ctx.consecutiveRejections,
          playerCount: ctx.playerIds.length,
        },
        ctx.random,
      );
    },
    chooseRaidAction(ctx: BotRaidContext): RaidAction {
      return chooseRaidAction({ role: ctx.role, currentRound: ctx.currentRound }, ctx.random);
    },
  };
}
