import { JoinLobbyError } from './enterRoom';
import { loadSeatSession, waitForSeatSession, type SeatSession, type StorageLike } from './seatSession';
import { electJoinLeader } from './tabPresence';

/**
 * Pick a seat session for a client tab. Existing storage wins; otherwise one
 * tab in this browser JOIN_REQUESTs (null session) and the rest wait to reclaim.
 * A follower that never sees a session must not send JOIN_REQUEST.
 */
export async function resolveJoinSeatSession(
  roomCode: string,
  tabId: string,
  options: {
    storage?: StorageLike | null;
    waitTimeoutMs?: number;
  } = {},
): Promise<SeatSession | null> {
  const existing = loadSeatSession(roomCode, options.storage);
  if (existing) return existing;

  const role = await electJoinLeader({
    roomCode,
    tabId,
    storage: options.storage,
  });
  if (role !== 'follower') return null;

  const session = await waitForSeatSession(roomCode, {
    storage: options.storage,
    timeoutMs: options.waitTimeoutMs ?? 10_000,
  });
  if (!session) {
    throw new JoinLobbyError(
      'NO_HOST_RESPONSE',
      `No seat session appeared for room ${roomCode}`,
    );
  }
  return session;
}
