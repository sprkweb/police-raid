import { describe, expect, it } from 'vitest';
import {
  clearSeatSession,
  loadSeatSession,
  saveSeatSession,
  seatSessionKey,
  waitForSeatSession,
  type StorageLike,
} from '../seatSession';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe('seatSession', () => {
  it('round-trips a valid session keyed by normalized room code', () => {
    const storage = memory();
    const session = {
      seatId: 'seat-1',
      secret: 'sekrit',
      hostPeerId: 'host-peer',
      kind: 'player' as const,
    };
    saveSeatSession('ab12', session, storage);
    expect(storage.data.has(seatSessionKey('AB12'))).toBe(true);
    expect(loadSeatSession('ab12', storage)).toEqual(session);
    clearSeatSession('AB12', storage);
    expect(loadSeatSession('ab12', storage)).toBeNull();
  });

  it('rejects malformed JSON and unknown kinds', () => {
    const storage = memory();
    storage.setItem(seatSessionKey('X'), '{');
    expect(loadSeatSession('X', storage)).toBeNull();
    storage.setItem(seatSessionKey('X'), JSON.stringify({ seatId: 'a', secret: 'b', hostPeerId: 'c', kind: 'admin' }));
    expect(loadSeatSession('X', storage)).toBeNull();
  });

  it('waits until a session appears', async () => {
    const storage = memory();
    const session = {
      seatId: 'seat-1',
      secret: 'sekrit',
      hostPeerId: 'host-peer',
      kind: 'player' as const,
    };
    let ticks = 0;
    const pending = waitForSeatSession('ab12', {
      storage,
      timeoutMs: 1_000,
      intervalMs: 1,
      now: () => ticks,
      sleep: async () => {
        ticks += 1;
        if (ticks === 2) saveSeatSession('ab12', session, storage);
      },
    });
    await expect(pending).resolves.toEqual(session);
  });
});
