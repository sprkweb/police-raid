import type { PlayerId, Vote, RaidAction } from './game';

export type SeatKind = 'player' | 'spectator';

export type MessageType =
  | 'GAME_STATE_UPDATE'
  | 'JOIN_REQUEST'
  | 'JOIN_RESPONSE'
  | 'RECLAIM'
  | 'PLAYER_ACTION';

export type PlayerActionPayload =
  | { type: 'PROPOSE_TEAM', team: PlayerId[] }
  | { type: 'SKIP_PROPOSAL' }
  | { type: 'VOTE_TEAM', vote: Vote }
  | { type: 'RAID_ACTION', action: RaidAction }
  | { type: 'START_GAME' }
  | { type: 'RENAME', name: string };

export interface JoinRequestPayload {
  name: string;
}

export interface JoinResponsePayload {
  seatId: PlayerId;
  secret: string;
  kind: SeatKind;
}

export interface ReclaimPayload {
  seatId: PlayerId;
  secret: string;
}

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
 * - `playerId` — this tab’s **transport** peer id (Metered `peerId`). The
 *   stable game seat id lives on `GameState.players` / JOIN_RESPONSE and is
 *   not the same string after a reload.
 * - `roomCode` — short shareable lobby code users copy / type
 */
export interface NetworkService {
  isHost: boolean;
  /** Transport peer id for this connection. */
  playerId: PlayerId | null;
  roomCode: string | null;

  /** Host a lobby; resolves to the new `roomCode`. */
  initializeAsHost(): Promise<string>;
  /** Join a lobby by `roomCode`; resolves to this tab’s transport peer id. */
  initializeAsClient(roomCode: string): Promise<PlayerId>;
  /** Leave the room and drop the connection. Safe to call when not connected. */
  disconnect(): Promise<void>;

  sendMessage(to: PlayerId, message: NetworkMessage): void;
  broadcast(message: NetworkMessage): void;

  onMessage(handler: (from: PlayerId, message: NetworkMessage) => void): void;
  onConnection(handler: (playerId: PlayerId) => void): void;
  onDisconnect(handler: (playerId: PlayerId) => void): void;
}
