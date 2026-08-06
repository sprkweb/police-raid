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
  senderId?: string;
}

export interface NetworkService {
  isHost: boolean;
  /** Stable peer id for this tab (used as PlayerId). */
  myId: string | null;
  /** Short lobby / share code (e.g. PR-ABCD). Distinct from myId. */
  roomId: string | null;

  /** Creates a room and returns the short room code. */
  initializeAsHost(): Promise<string>;
  /** Joins an existing room; returns this peer's myId. */
  initializeAsClient(roomId: string): Promise<string>;

  sendMessage(to: string, message: NetworkMessage): void;
  broadcast(message: NetworkMessage): void;

  onMessage(handler: (from: string, message: NetworkMessage) => void): void;
  onConnection(handler: (id: string) => void): void;
  onDisconnect(handler: (id: string) => void): void;
}
