import type { GameState, PlayerId } from '../types/game';

/**
 * Whether a client should apply an incoming GAME_STATE_UPDATE.
 *
 * The transport `from` peer must be the state's `hostId`. After the first
 * accepted seat, that host id is locked so another room subscriber cannot
 * publish a forged full state (e.g. unredacted roles) and overwrite React.
 */
export function shouldAcceptGameStateUpdate(
  from: PlayerId,
  state: GameState,
  options: {
    viewerId: PlayerId | null;
    lockedHostId: PlayerId | null;
  },
): boolean {
  if (from !== state.hostId) return false;

  const { viewerId, lockedHostId } = options;
  if (lockedHostId !== null) {
    return from === lockedHostId && state.hostId === lockedHostId;
  }

  if (!viewerId) return false;
  return state.players.some((p) => p.id === viewerId);
}
