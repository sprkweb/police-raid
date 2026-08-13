import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
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
});
