import type { GameState, PlayerId } from '../types/game';

export function isViewerSeated(state: GameState, seatId: PlayerId): boolean {
  return (
    state.players.some((p) => p.id === seatId) ||
    state.spectators.some((s) => s.id === seatId)
  );
}

/**
 * Whether a client should apply an incoming GAME_STATE_UPDATE.
 *
 * The transport `from` peer is locked after JOIN_RESPONSE / reclaim — it is
 * **not** compared to `state.hostId`, which is a stable seat id. Stale
 * snapshots (`stateSeq` not greater than the last applied) are dropped.
 */
export function shouldAcceptGameStateUpdate(
  from: PlayerId,
  state: GameState,
  options: {
    seatId: PlayerId | null;
    lockedHostPeerId: PlayerId | null;
    lastSeq: number;
  },
): boolean {
  const { seatId, lockedHostPeerId, lastSeq } = options;
  if (lockedHostPeerId === null || from !== lockedHostPeerId) return false;
  if (!seatId || !isViewerSeated(state, seatId)) return false;
  if (typeof state.stateSeq === 'number' && state.stateSeq <= lastSeq) return false;
  return true;
}
