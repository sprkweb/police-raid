import { describe, expect, it } from 'vitest';
import { simulateAllBotMatches, type BotMatchStats } from '../bench/simulateAllBotMatches';
import type { BotBrainId } from '../types';

const GAMES = 40;
const SEED = 20260821;
const runBench = process.env.BOT_BENCH === '1';

function pct(n: number, total: number): string {
  return `${((n / total) * 100).toFixed(1)}%`;
}

function row(id: BotBrainId, playerCount: number, stats: BotMatchStats): string {
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

describe.skipIf(!runBench)('bot implementation bench', () => {
  it(
    'prints winrate and games/sec for heuristic vs bayesian',
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

      console.log(`\nAll-bot matches × ${GAMES} (seed ${SEED})\n${header}`);

      for (const playerCount of [5, 8] as const) {
        for (const id of ['heuristic', 'bayesian'] as const) {
          const stats = simulateAllBotMatches({
            brain: id,
            playerCount,
            games: GAMES,
            seed: SEED,
          });
          console.log(row(id, playerCount, stats));
          expect(stats.games).toBe(GAMES);
          expect(stats.policeWins + stats.moleWins).toBe(GAMES);
        }
      }
    },
    180_000,
  );
});
