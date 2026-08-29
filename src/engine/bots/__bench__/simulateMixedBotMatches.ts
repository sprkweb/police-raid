import { Role } from '../../../types/game';
import { WINS_NEEDED } from '../../constants';
import { createSeededRandom } from '../../rng';
import { createBotBrain } from '../createBotBrain';
import type { BotBrain, BotBrainId } from '../types';
import { createAllBotEngine, driveAllBotMatchToGameOver } from './simulateAllBotMatches';

export const BENCH_BRAIN_IDS: readonly BotBrainId[] = ['heuristic', 'bayesian', 'random'];

export function rotateRoster<T>(items: readonly T[], offset: number): T[] {
  if (items.length === 0) return [];
  const shift = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/** Cycle `kinds` around the table; `gameIndex` shifts who sits where and the leftover seats. */
export function mixedRoster(
  playerCount: number,
  gameIndex: number,
  kinds: readonly BotBrainId[] = BENCH_BRAIN_IDS,
): BotBrainId[] {
  return Array.from(
    { length: playerCount },
    (_, i) => kinds[(i + gameIndex) % kinds.length]!,
  );
}

/** Alternate the two brains around the table; `gameIndex` swaps who gets the extra seat. */
export function pairwiseRoster(
  playerCount: number,
  gameIndex: number,
  left: BotBrainId,
  right: BotBrainId,
): BotBrainId[] {
  const pair = [left, right] as const;
  return Array.from({ length: playerCount }, (_, i) => pair[(i + gameIndex) % 2]!);
}

export function seatIds(playerCount: number): string[] {
  return Array.from({ length: playerCount }, (_, i) => `bot-${i + 1}`);
}

export function resolverForRoster(roster: readonly BotBrainId[], playerIds: readonly string[]) {
  const instances = new Map<BotBrainId, BotBrain>();
  const bySeat = new Map<string, BotBrainId>();
  playerIds.forEach((id, i) => {
    bySeat.set(id, roster[i]!);
  });
  return (actorId: string): BotBrain => {
    const kind = bySeat.get(actorId);
    if (!kind) throw new Error(`no brain assigned for ${actorId}`);
    let brain = instances.get(kind);
    if (!brain) {
      brain = createBotBrain(kind);
      instances.set(kind, brain);
    }
    return brain;
  };
}

export interface MixedBrainStats {
  id: BotBrainId;
  seats: number;
  wins: number;
  policeSeats: number;
  policeWins: number;
  moleSeats: number;
  moleWins: number;
}

export interface MixedMatchupStats {
  games: number;
  policeWins: number;
  moleWins: number;
  rejectionWins: number;
  elapsedMs: number;
  byBrain: MixedBrainStats[];
}

function emptyBrainStats(id: BotBrainId): MixedBrainStats {
  return {
    id,
    seats: 0,
    wins: 0,
    policeSeats: 0,
    policeWins: 0,
    moleSeats: 0,
    moleWins: 0,
  };
}

export function simulateMixedBotMatches(input: {
  playerCount: number;
  games: number;
  seed: number;
  rosterForGame: (gameIndex: number) => readonly BotBrainId[];
}): MixedMatchupStats {
  const started = Date.now();
  const playerIds = seatIds(input.playerCount);
  const byBrain = new Map<BotBrainId, MixedBrainStats>();
  let policeWins = 0;
  let moleWins = 0;
  let rejectionWins = 0;

  for (let g = 0; g < input.games; g++) {
    const roster = input.rosterForGame(g);
    const engine = createAllBotEngine(input.playerCount, {
      botBrain: resolverForRoster(roster, playerIds),
      random: createSeededRandom(input.seed + g),
    });
    driveAllBotMatchToGameOver(engine);
    const state = engine.getState();
    if (state.winner === 'Police') policeWins++;
    else moleWins++;
    if (state.winner === 'Moles' && state.scores.moles < WINS_NEEDED) {
      rejectionWins++;
    }

    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i]!;
      const id = roster[i]!;
      let stats = byBrain.get(id);
      if (!stats) {
        stats = emptyBrainStats(id);
        byBrain.set(id, stats);
      }
      const won =
        (state.winner === 'Police' && player.role === Role.Police) ||
        (state.winner === 'Moles' && player.role === Role.Mole);
      stats.seats++;
      if (won) stats.wins++;
      if (player.role === Role.Police) {
        stats.policeSeats++;
        if (won) stats.policeWins++;
      } else if (player.role === Role.Mole) {
        stats.moleSeats++;
        if (won) stats.moleWins++;
      }
    }
  }

  return {
    games: input.games,
    policeWins,
    moleWins,
    rejectionWins,
    elapsedMs: Date.now() - started,
    byBrain: [...byBrain.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
