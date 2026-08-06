import type { GameState, PlayerId } from '../types/game';
import type { NetworkMessage, NetworkService } from '../types/network';

/** How long to wait for the host to put us in its roster and broadcast it back. */
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
 * wait until it broadcasts a state we are actually in. Rejects with
 * `JoinLobbyError` and disconnects when nothing seats us — a mistyped code, an
 * offline host, or a lobby that is full / already playing all look the same
 * from here.
 *
 * `onGameState` receives every state from the moment we are seated, including
 * the one this resolves with.
 */
export async function joinLobby(
  network: NetworkService,
  roomCode: string,
  playerName: string,
  onGameState: (state: GameState) => void,
  timing: JoinLobbyTiming = {},
): Promise<JoinLobbyResult> {
  const { timeoutMs = JOIN_TIMEOUT_MS, retryMs = JOIN_RETRY_MS } = timing;

  let seated = false;
  let onSeated: ((state: GameState) => void) | null = null;

  network.onMessage((_from, msg) => {
    if (msg.type !== 'GAME_STATE_UPDATE') return;
    const state = msg.payload as GameState;
    if (!seated) {
      // Subscribing to the channel is not joining the game: until the host has
      // us in its roster, its broadcasts are none of our business.
      if (!state.players.some((p) => p.id === network.playerId)) return;
      seated = true;
      onSeated?.(state);
      onSeated = null;
    }
    onGameState(state);
  });

  const playerId = await network.initializeAsClient(roomCode);

  const joinRequest: NetworkMessage = { type: 'JOIN_REQUEST', payload: { name: playerName } };
  // Clients publish on the room channel, so `to` is ignored by the transport —
  // the host's id is unknown until its first state arrives anyway.
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
