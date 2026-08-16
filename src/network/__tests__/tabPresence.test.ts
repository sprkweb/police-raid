import { describe, expect, it } from 'vitest';
import {
  announceSeatClaim,
  claimStorageKey,
  claimTakesOverSeat,
  electJoinLeader,
  getTabId,
  subscribeSeatClaims,
  TAB_ID_KEY,
  type ClaimBus,
  type SeatClaim,
} from '../tabPresence';
import type { StorageLike } from '../seatSession';

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

function memoryBus(): ClaimBus {
  const handlers = new Set<(claim: SeatClaim) => void>();
  return {
    post: (claim) => {
      for (const handler of handlers) handler(claim);
    },
    listen: (handler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}

describe('tabPresence', () => {
  it('reuses a stored tab id', () => {
    const store = memory();
    const first = getTabId(store);
    expect(first.length).toBeGreaterThan(0);
    expect(store.data.get(TAB_ID_KEY)).toBe(first);
    expect(getTabId(store)).toBe(first);
  });

  it('treats another tab claiming the same seat as a takeover', () => {
    const current = { roomCode: 'ab12', seatId: 'seat-1', tabId: 'tab-a' };
    expect(claimTakesOverSeat({ roomCode: 'AB12', seatId: 'seat-1', tabId: 'tab-b' }, current)).toBe(true);
    expect(claimTakesOverSeat({ roomCode: 'AB12', seatId: 'seat-1', tabId: 'tab-a' }, current)).toBe(false);
    expect(claimTakesOverSeat({ roomCode: 'AB12', seatId: 'seat-2', tabId: 'tab-b' }, current)).toBe(false);
    expect(claimTakesOverSeat({ roomCode: 'ZZ99', seatId: 'seat-1', tabId: 'tab-b' }, current)).toBe(false);
  });

  it('broadcasts a normalized claim to subscribers', () => {
    const bus = memoryBus();
    const seen: SeatClaim[] = [];
    const unsub = subscribeSeatClaims((claim) => {
      seen.push(claim);
    }, { bus, storage: null });
    announceSeatClaim({ roomCode: 'ab12', seatId: 'seat-1', tabId: 'tab-b' }, { bus, storage: null });
    expect(seen).toEqual([{ roomCode: 'AB12', seatId: 'seat-1', tabId: 'tab-b' }]);
    unsub();
  });

  it('writes the claim so a late tab can persist it', () => {
    const storage = memory();
    announceSeatClaim(
      { roomCode: 'ab12', seatId: 'seat-1', tabId: 'tab-b' },
      { bus: memoryBus(), storage },
    );
    expect(JSON.parse(storage.data.get(claimStorageKey('AB12')) ?? '')).toEqual({
      roomCode: 'AB12',
      seatId: 'seat-1',
      tabId: 'tab-b',
    });
  });

  it('elects a single join leader when two tabs race', async () => {
    const storage = memory();
    const sleep = () => Promise.resolve();
    const [a, b] = await Promise.all([
      electJoinLeader({ roomCode: 'ab12', tabId: 'tab-a', storage, sleep, delayMs: 0 }),
      electJoinLeader({ roomCode: 'ab12', tabId: 'tab-b', storage, sleep, delayMs: 0 }),
    ]);
    const leaders = [a, b].filter((role) => role === 'leader');
    expect(leaders).toHaveLength(1);
    expect([a, b].filter((role) => role === 'follower')).toHaveLength(1);
  });

  it('follows a fresh lock from another tab without overwriting it', async () => {
    const storage = memory();
    storage.setItem('police-raid.joinLock.AB12', JSON.stringify({ tabId: 'tab-a', ts: 1_000 }));
    const role = await electJoinLeader({
      roomCode: 'ab12',
      tabId: 'tab-b',
      storage,
      now: () => 1_100,
      sleep: () => Promise.resolve(),
      delayMs: 0,
    });
    expect(role).toBe('follower');
  });
});
