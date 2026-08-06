import type { PlayerId, Vote, RaidAction } from './game';

export type MessageType =
  | 'GAME_STATE_UPDATE'
  | 'JOIN_REQUEST'
  | 'JOIN_RESPONSE'
  | 'PLAYER_ACTION';

export type PlayerActionPayload =
  | { type: 'PROPOSE_TEAM', team: PlayerId[] }
  | { type: 'SKIP_PROPOSAL' }
  | { type: 'VOTE_TEAM', vote: Vote }
  | { type: 'RAID_ACTION', action: RaidAction }
  | { type: 'START_GAME' };

export interface NetworkMessage {
  type: MessageType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  senderId?: PlayerId;
}

/**
 * Transport for host-authoritative multiplayer.
 * Implementations may use WebRTC, a managed realtime service, etc.
 *
 * Terminology:
 * - `playerId` — this tab's identity in the game (same as GameState player ids)
 * - `roomCode` — short shareable lobby code users copy / type
 */
export interface NetworkService {
  isHost: boolean;
  playerId: PlayerId | null;
  roomCode: string | null;

  /** Host a lobby; resolves to the new `roomCode`. */
  initializeAsHost(): Promise<string>;
  /** Join a lobby by `roomCode`; resolves to this tab's `playerId`. */
  initializeAsClient(roomCode: string): Promise<PlayerId>;

  sendMessage(to: PlayerId, message: NetworkMessage): void;
  broadcast(message: NetworkMessage): void;

  onMessage(handler: (from: PlayerId, message: NetworkMessage) => void): void;
  onConnection(handler: (playerId: PlayerId) => void): void;
  onDisconnect(handler: (playerId: PlayerId) => void): void;
}
