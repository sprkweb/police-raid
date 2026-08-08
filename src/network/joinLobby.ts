import type { GameState, PlayerId } from '../types/game';
import type { NetworkMessage, NetworkService } from '../types/network';
import { shouldAcceptGameStateUpdate } from './acceptGameState';

/** How long to wait for the host to put us in its roster and send state back. */
export const JOIN_TIMEOUT_MS = 8_000;
/** Re-send `JOIN_REQUEST` this often while waiting, in case a message was dropped. */
export const JOIN_RETRY_MS = 3_000;

export type JoinFailure = 'NO_HOST_RESPONSE';

export class JoinLobbyError extends Error {
  public readonly failure: JoinFailure;

  constructor(failure: JoinFailure, message: string) {
    super(message);
    this.name = 'JoinLobbyError';
    this.failure = failure;
  }
}

export interface JoinLobbyResult {
  playerId: PlayerId;
  roomCode: string;
  state: GameState;
}

export interface JoinLobbyTiming {
  timeoutMs?: number;
  retryMs?: number;
}

/**
 * Client-side join handshake: connect to the room, ask the host to seat us and
 * wait until it sends a (projected) state we are actually in. Rejects with
 * `JoinLobbyError` and disconnects when nothing seats us — a mistyped code, an
 * offline host, or a lobby that is full / already playing all look the same
 * from here.
 *
 * `onGameState` receives every state from the moment we are seated, including
 * the one this resolves with. Only updates whose transport sender is
 * `state.hostId` are applied (and that host id is locked after seating).
 */
export async function joinLobby(
  network: NetworkService,
  roomCode: string,
  playerName: string,
  onGameState: (state: GameState) => void,
  timing: JoinLobbyTiming = {},
): Promise<JoinLobbyResult> {
  const { timeoutMs = JOIN_TIMEOUT_MS, retryMs = JOIN_RETRY_MS } = timing;

  let lockedHostId: PlayerId | null = null;
  let onSeated: ((state: GameState) => void) | null = null;

  network.onMessage((from, msg) => {
    if (msg.type !== 'GAME_STATE_UPDATE') return;
    const state = msg.payload as GameState;
    const accept = shouldAcceptGameStateUpdate(from, state, {
      viewerId: network.playerId,
      lockedHostId,
    });
    if (!accept) return;

    if (lockedHostId === null) {
      lockedHostId = state.hostId;
      onSeated?.(state);
      onSeated = null;
    }
    onGameState(state);
  });

  const playerId = await network.initializeAsClient(roomCode);

  const joinRequest: NetworkMessage = { type: 'JOIN_REQUEST', payload: { name: playerName } };
  // hostId is unknown until the first seated state arrives. sendMessage falls
  // back to channel publish when `to` is our own id (JOIN_REQUEST is not secret).
  const askToJoin = () => network.sendMessage(playerId, joinRequest);

  let retry: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const state = await new Promise<GameState>((resolve, reject) => {
      onSeated = resolve;
      retry = setInterval(askToJoin, retryMs);
      timeout = setTimeout(
        () => reject(new JoinLobbyError(
          'NO_HOST_RESPONSE',
          `No host answered in room ${network.roomCode ?? roomCode}`,
        )),
        timeoutMs,
      );
      askToJoin();
    });
    return { playerId, roomCode: network.roomCode ?? roomCode, state };
  } catch (err) {
    await network.disconnect().catch(() => undefined);
    throw err;
  } finally {
    onSeated = null;
    clearInterval(retry);
    clearTimeout(timeout);
  }
}
