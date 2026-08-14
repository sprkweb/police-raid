import { describe, expect, it } from 'vitest';
import {
  NATO_CALLSIGNS,
  normalizeCallsign,
  pickUnusedCallsign,
  uniquifyCallsign,
} from '../callsigns';
import { MAX_CALLSIGN_LENGTH } from '../constants';

describe('callsigns', () => {
  it('trims, collapses space, and caps length', () => {
    expect(normalizeCallsign('  Alpha  Bravo  ')).toBe('Alpha Bravo');
    expect(normalizeCallsign('x'.repeat(40))).toHaveLength(MAX_CALLSIGN_LENGTH);
  });

  it('picks a free NATO name, then numbered suffixes', () => {
    expect(pickUnusedCallsign([], () => 0)).toBe(NATO_CALLSIGNS[0]);
    const taken = NATO_CALLSIGNS.map((n) => n.toLowerCase());
    expect(pickUnusedCallsign(taken, () => 0)).toBe('Alpha-2');
  });

  it('keeps a free desired name and uniquifies a collision', () => {
    expect(uniquifyCallsign('Kilo', ['Alpha'], () => 0)).toBe('Kilo');
    expect(uniquifyCallsign('Alpha', ['alpha'], () => 0)).toBe('Bravo');
    expect(uniquifyCallsign('   ', ['Alpha'], () => 0)).toBe('Bravo');
  });
});
