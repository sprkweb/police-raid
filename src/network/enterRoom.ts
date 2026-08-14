import type { GameState, PlayerId } from '../types/game';
import type {
  JoinResponsePayload,
  NetworkMessage,
  NetworkService,
  SeatKind,
} from '../types/network';
import { shouldAcceptGameStateUpdate } from './acceptGameState';
import type { SeatSession } from './seatSession';

/** How long to wait for the host to seat us and send state back. */
export const JOIN_TIMEOUT_MS = 8_000;
/** Re-send join/reclaim this often while waiting, in case a message was dropped. */
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

export interface EnterRoomResult {
  seatId: PlayerId;
  roomCode: string;
  state: GameState;
  secret: string;
  kind: SeatKind;
  hostPeerId: PlayerId;
}

export interface EnterRoomTiming {
  timeoutMs?: number;
  retryMs?: number;
}

export interface EnterRoomOptions {
  name: string;
  session?: SeatSession | null;
  onGameState: (state: GameState) => void;
}

/**
 * Client handshake: connect, then either reclaim a stored seat (direct send to
 * the known host peer — never publish the secret on the room channel) or ask
 * to join with a callsign. Resolves once JOIN_RESPONSE and a seating
 * GAME_STATE_UPDATE have arrived from the locked host peer.
 */
export async function enterRoom(
  network: NetworkService,
  roomCode: string,
  options: EnterRoomOptions,
  timing: EnterRoomTiming = {},
): Promise<EnterRoomResult> {
  const { timeoutMs = JOIN_TIMEOUT_MS, retryMs = JOIN_RETRY_MS } = timing;
  const session = options.session ?? null;

  let lockedHostPeerId: PlayerId | null = session?.hostPeerId ?? null;
  let seatId: PlayerId | null = session?.seatId ?? null;
  let secret = session?.secret ?? '';
  let kind: SeatKind = session?.kind ?? 'player';
  let lastSeq = 0;
  let seatedState: GameState | null = null;
  let onSeated: ((state: GameState) => void) | null = null;

  const tryResolve = (state: GameState) => {
    if (!seatId || !lockedHostPeerId || !secret) return;
    if (onSeated) {
      onSeated(state);
      onSeated = null;
    }
  };

  network.onMessage((from, msg) => {
    if (msg.type === 'JOIN_RESPONSE') {
      if (lockedHostPeerId && from !== lockedHostPeerId) return;
      const payload = msg.payload as JoinResponsePayload;
      if (typeof payload?.seatId !== 'string' || typeof payload.secret !== 'string') return;
      if (payload.kind !== 'player' && payload.kind !== 'spectator') return;
      if (seatId && payload.seatId !== seatId) return;
      lockedHostPeerId = from;
      seatId = payload.seatId;
      secret = payload.secret;
      kind = payload.kind;
      if (seatedState) tryResolve(seatedState);
      return;
    }

    if (msg.type !== 'GAME_STATE_UPDATE') return;
    const state = msg.payload as GameState;
    const accept = shouldAcceptGameStateUpdate(from, state, {
      seatId,
      lockedHostPeerId,
      lastSeq,
    });
    if (!accept) return;

    lastSeq = state.stateSeq;
    seatedState = state;
    options.onGameState(state);
    tryResolve(state);
  });

  const peerId = await network.initializeAsClient(roomCode);

  const ask = () => {
    if (session) {
      const reclaim: NetworkMessage = {
        type: 'RECLAIM',
        payload: { seatId: session.seatId, secret: session.secret },
      };
      network.sendMessage(session.hostPeerId, reclaim);
      return;
    }
    const joinRequest: NetworkMessage = { type: 'JOIN_REQUEST', payload: { name: options.name } };
    // hostPeerId is unknown until JOIN_RESPONSE. sendMessage falls back to
    // channel publish when `to` is our own id (JOIN_REQUEST is not secret).
    network.sendMessage(peerId, joinRequest);
  };

  let retry: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const state = await new Promise<GameState>((resolve, reject) => {
      onSeated = resolve;
      retry = setInterval(ask, retryMs);
      timeout = setTimeout(
        () => reject(new JoinLobbyError(
          'NO_HOST_RESPONSE',
          `No host answered in room ${network.roomCode ?? roomCode}`,
        )),
        timeoutMs,
      );
      ask();
    });
    return {
      seatId: seatId!,
      roomCode: network.roomCode ?? roomCode,
      state,
      secret,
      kind,
      hostPeerId: lockedHostPeerId!,
    };
  } catch (err) {
    await network.disconnect().catch(() => undefined);
    throw err;
  } finally {
    onSeated = null;
    clearInterval(retry);
    clearTimeout(timeout);
  }
}
