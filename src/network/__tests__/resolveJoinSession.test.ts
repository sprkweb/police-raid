import { describe, expect, it } from 'vitest';
import { JoinLobbyError } from '../enterRoom';
import { resolveJoinSeatSession } from '../resolveJoinSession';
import { saveSeatSession, type StorageLike } from '../seatSession';
import { JOIN_LOCK_PREFIX } from '../tabPresence';

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

const session = {
  seatId: 'seat-1',
  secret: 'sekrit',
  hostPeerId: 'host-peer',
  kind: 'player' as const,
};

describe('resolveJoinSeatSession', () => {
  it('returns a stored session without electing', async () => {
    const storage = memory();
    saveSeatSession('ab12', session, storage);
    await expect(resolveJoinSeatSession('ab12', 'tab-b', { storage })).resolves.toEqual(session);
  });

  it('returns null so the join leader can JOIN_REQUEST', async () => {
    const storage = memory();
    await expect(resolveJoinSeatSession('ab12', 'tab-a', { storage, waitTimeoutMs: 0 })).resolves.toBeNull();
  });

  it('lets a follower reclaim once the leader saves a session', async () => {
    const storage = memory();
    storage.setItem(`${JOIN_LOCK_PREFIX}AB12`, JSON.stringify({ tabId: 'tab-a', ts: Date.now() }));
    const pending = resolveJoinSeatSession('ab12', 'tab-b', {
      storage,
      waitTimeoutMs: 1_000,
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 120);
    });
    saveSeatSession('ab12', session, storage);
    await expect(pending).resolves.toEqual(session);
  });

  it('does not JOIN_REQUEST when a follower never sees a session', async () => {
    const storage = memory();
    storage.setItem(`${JOIN_LOCK_PREFIX}AB12`, JSON.stringify({ tabId: 'tab-a', ts: Date.now() }));
    await expect(
      resolveJoinSeatSession('ab12', 'tab-b', { storage, waitTimeoutMs: 20 }),
    ).rejects.toBeInstanceOf(JoinLobbyError);
  });
});
