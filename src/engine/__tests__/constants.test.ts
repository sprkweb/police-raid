import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  PHASE_DURATION_MS,
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

  it('defines phase timer durations', () => {
    expect(PHASE_DURATION_MS.Discussion).toBe(90_000);
    expect(PHASE_DURATION_MS.ProposingTeam).toBe(20_000);
    expect(PHASE_DURATION_MS.VotingOnTeam).toBe(20_000);
    expect(PHASE_DURATION_MS.Raid).toBe(20_000);
  });
});
