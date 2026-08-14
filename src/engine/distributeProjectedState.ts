import type { GameState, PlayerId } from '../types/game';
import type { NetworkService } from '../types/network';
import { BOT_ID_PREFIX } from './constants';
import { projectForPlayer } from './projectState';

const isBot = (id: PlayerId) => id.startsWith(BOT_ID_PREFIX);

type HostNetwork = Pick<NetworkService, 'isHost' | 'sendMessage'>;

export interface SeatRouter {
  peerIdForSeat(seatId: PlayerId): PlayerId | null;
}

export function sendProjectedState(
  network: Pick<NetworkService, 'sendMessage'>,
  state: GameState,
  peerId: PlayerId,
  viewerId: PlayerId,
): void {
  network.sendMessage(peerId, {
    type: 'GAME_STATE_UPDATE',
    payload: projectForPlayer(state, viewerId),
  });
}

/**
 * Fan out a per-viewer projection of authoritative state. Routes by current
 * transport peer (not seat id). Skips the host, bots, and disconnected seats.
 */
export function distributeProjectedState(
  network: HostNetwork,
  state: GameState,
  seats: SeatRouter,
): void {
  if (!network.isHost) return;

  const send = (viewerId: PlayerId) => {
    if (viewerId === state.hostId) return;
    if (isBot(viewerId)) return;
    const peerId = seats.peerIdForSeat(viewerId);
    if (!peerId) return;
    sendProjectedState(network, state, peerId, viewerId);
  };

  for (const player of state.players) send(player.id);
  for (const spectator of state.spectators) send(spectator.id);
}
