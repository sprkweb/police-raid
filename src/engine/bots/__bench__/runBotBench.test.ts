import { describe, expect, it } from 'vitest';
import { simulateAllBotMatches, type BotMatchStats } from './simulateAllBotMatches';
import {
  BENCH_BRAIN_IDS,
  mixedRoster,
  pairwiseRoster,
  simulateMixedBotMatches,
  type MixedBrainStats,
} from './simulateMixedBotMatches';
import type { BotBrainId } from '../types';

const GAMES = 40;
const SEED = 20260821;
const runBench = process.env.BOT_BENCH === '1';

function pct(n: number, total: number): string {
  if (total <= 0) return '  n/a';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function sameBrainRow(id: BotBrainId, playerCount: number, stats: BotMatchStats): string {
  const gps = stats.elapsedMs > 0 ? ((stats.games * 1000) / stats.elapsedMs).toFixed(2) : 'n/a';
  return [
    id.padEnd(10),
    String(playerCount).padStart(2),
    pct(stats.policeWins, stats.games).padStart(7),
    pct(stats.moleWins, stats.games).padStart(7),
    pct(stats.rejectionWins, stats.games).padStart(8),
    gps.padStart(8),
    String(stats.elapsedMs).padStart(6),
  ].join('  ');
}

function mixedRow(stats: MixedBrainStats): string {
  return [
    stats.id.padEnd(10),
    String(stats.seats).padStart(5),
    pct(stats.wins, stats.seats).padStart(7),
    `${pct(stats.policeWins, stats.policeSeats).padStart(7)} n=${String(stats.policeSeats).padStart(3)}`,
    `${pct(stats.moleWins, stats.moleSeats).padStart(7)} n=${String(stats.moleSeats).padStart(3)}`,
  ].join('  ');
}

function rankedByWinrate(brains: MixedBrainStats[]): MixedBrainStats[] {
  return [...brains].sort((a, b) => {
    const aw = a.seats > 0 ? a.wins / a.seats : 0;
    const bw = b.seats > 0 ? b.wins / b.seats : 0;
    return bw - aw || a.id.localeCompare(b.id);
  });
}

describe.skipIf(!runBench)('bot implementation bench', () => {
  it(
    'prints winrate and games/sec for heuristic, bayesian, and random',
    () => {
      const header = [
        'brain'.padEnd(10),
        'N'.padStart(2),
        'police'.padStart(7),
        'moles'.padStart(7),
        'reject'.padStart(8),
        'games/s'.padStart(8),
        'ms'.padStart(6),
      ].join('  ');

      console.log(`\nSame-brain tables × ${GAMES} (seed ${SEED})\n${header}`);

      for (const playerCount of [5, 8] as const) {
        for (const id of BENCH_BRAIN_IDS) {
          const stats = simulateAllBotMatches({
            brain: id,
            playerCount,
            games: GAMES,
            seed: SEED,
          });
          console.log(sameBrainRow(id, playerCount, stats));
          expect(stats.games).toBe(GAMES);
          expect(stats.policeWins + stats.moleWins).toBe(GAMES);
        }
      }
    },
    180_000,
  );

  it(
    'prints personal winrate when different brains share a table',
    () => {
      const header = [
        'brain'.padEnd(10),
        'seats'.padStart(5),
        'win'.padStart(7),
        'as cop'.padStart(14),
        'as mole'.padStart(14),
      ].join('  ');

      console.log(
        `\nMixed table (all brains) × ${GAMES} (seed ${SEED})\n` +
          'win = this seat\'s faction won\n' +
          header,
      );

      for (const playerCount of [5, 8] as const) {
        const stats = simulateMixedBotMatches({
          playerCount,
          games: GAMES,
          seed: SEED,
          rosterForGame: (g) => mixedRoster(playerCount, g),
        });
        console.log(
          `N=${playerCount}  police ${pct(stats.policeWins, stats.games)}  moles ${pct(stats.moleWins, stats.games)}  reject ${pct(stats.rejectionWins, stats.games)}  ${stats.elapsedMs}ms`,
        );
        for (const row of rankedByWinrate(stats.byBrain)) {
          console.log(mixedRow(row));
        }
        expect(stats.games).toBe(GAMES);
        expect(stats.policeWins + stats.moleWins).toBe(GAMES);
        expect(stats.byBrain.reduce((n, b) => n + b.seats, 0)).toBe(GAMES * playerCount);
      }

      const pairs: Array<[BotBrainId, BotBrainId]> = [
        ['bayesian', 'heuristic'],
        ['bayesian', 'random'],
        ['heuristic', 'random'],
      ];

      console.log(`\nPairwise tables × ${GAMES} (seed ${SEED})\n${header}`);

      for (const playerCount of [5, 8] as const) {
        for (const [left, right] of pairs) {
          const stats = simulateMixedBotMatches({
            playerCount,
            games: GAMES,
            seed: SEED,
            rosterForGame: (g) => pairwiseRoster(playerCount, g, left, right),
          });
          console.log(
            `N=${playerCount}  ${left} vs ${right}  police ${pct(stats.policeWins, stats.games)}  moles ${pct(stats.moleWins, stats.games)}  ${stats.elapsedMs}ms`,
          );
          for (const row of rankedByWinrate(stats.byBrain)) {
            console.log(mixedRow(row));
          }
          expect(stats.games).toBe(GAMES);
          expect(stats.byBrain).toHaveLength(2);
        }
      }
    },
    180_000,
  );
});
