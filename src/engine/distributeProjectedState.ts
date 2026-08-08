import type { GameState, PlayerId } from '../types/game';
import type { NetworkService } from '../types/network';
import { BOT_ID_PREFIX } from './constants';
import { projectForPlayer } from './projectState';

const isBot = (id: PlayerId) => id.startsWith(BOT_ID_PREFIX);

type HostNetwork = Pick<NetworkService, 'isHost' | 'playerId' | 'sendMessage'>;

/**
 * Fan out a per-player projection of authoritative state. Skips the host
 * (they apply a local projection themselves) and bots (no network peer).
 */
export function distributeProjectedState(network: HostNetwork, state: GameState): void {
  if (!network.isHost) return;

  for (const player of state.players) {
    if (player.id === network.playerId) continue;
    if (isBot(player.id)) continue;
    network.sendMessage(player.id, {
      type: 'GAME_STATE_UPDATE',
      payload: projectForPlayer(state, player.id),
    });
  }
}
