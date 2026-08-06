import { describe, expect, it } from 'vitest';
import { normalizeRoomCode } from '../roomCode';

describe('normalizeRoomCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeRoomCode('  ab12  ')).toBe('AB12');
  });

  it('strips a legacy PR- prefix', () => {
    expect(normalizeRoomCode('pr-ab12')).toBe('AB12');
    expect(normalizeRoomCode('PR-AB12')).toBe('AB12');
  });
});
