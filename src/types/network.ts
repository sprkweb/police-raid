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
  myId: string | null;

  initializeAsHost(): Promise<string>;
  initializeAsClient(roomId: string): Promise<string>;

  sendMessage(to: string, message: NetworkMessage): void;
  broadcast(message: NetworkMessage): void;

  onMessage(handler: (from: string, message: NetworkMessage) => void): void;
  onConnection(handler: (id: string) => void): void;
  onDisconnect(handler: (id: string) => void): void;
}
