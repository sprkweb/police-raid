import { describe, expect, it } from 'vitest';
import { normalizeRoomCode } from '../roomCode';

describe('normalizeRoomCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeRoomCode('  ab12  ')).toBe('AB12');
  });
});
