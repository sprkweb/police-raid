import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  WINS_NEEDED,
} from '../constants';

describe('BALANCE / constants', () => {
  it('covers player counts 5–8', () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      expect(BALANCE[n as keyof typeof BALANCE]).toBeDefined();
    }
  });

  it('has 5 team sizes (one per round) for every configuration', () => {
    for (const cfg of Object.values(BALANCE)) {
      expect(cfg.teamSizes).toHaveLength(MAX_ROUNDS);
      for (const size of cfg.teamSizes) {
        expect(size).toBeGreaterThan(0);
      }
    }
  });

  it('matches documented mole counts', () => {
    expect(BALANCE[5].moles).toBe(2);
    expect(BALANCE[6].moles).toBe(2);
    expect(BALANCE[7].moles).toBe(3);
    expect(BALANCE[8].moles).toBe(3);
  });

  it('matches documented team size tables', () => {
    expect(BALANCE[5].teamSizes).toEqual([2, 3, 2, 3, 3]);
    expect(BALANCE[6].teamSizes).toEqual([2, 3, 4, 3, 4]);
    expect(BALANCE[7].teamSizes).toEqual([2, 3, 3, 4, 4]);
    expect(BALANCE[8].teamSizes).toEqual([3, 4, 4, 5, 5]);
  });

  it('requires two sabotages only on round 4 for 7–8 players', () => {
    expect(BALANCE[5].twoSabotagesRequiredOnRound).toEqual([]);
    expect(BALANCE[6].twoSabotagesRequiredOnRound).toEqual([]);
    expect(BALANCE[7].twoSabotagesRequiredOnRound).toEqual([4]);
    expect(BALANCE[8].twoSabotagesRequiredOnRound).toEqual([4]);
  });

  it('needs 3 round wins to finish', () => {
    expect(WINS_NEEDED).toBe(3);
  });
});
