export type PlayerId = string;

export const Role = {
  Police: 'Police',
  Mole: 'Mole',
} as const;

export type Role = typeof Role[keyof typeof Role];

export const GamePhase = {
  Lobby: 'Lobby',
  Discussion: 'Discussion',
  ProposingTeam: 'ProposingTeam',
  VotingOnTeam: 'VotingOnTeam',
  Raid: 'Raid',
  RoundEnd: 'RoundEnd',
  GameOver: 'GameOver',
} as const;

export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

export type Vote = 'Approve' | 'Reject';
export type RaidAction = 'Support' | 'Sabotage';

export interface Player {
  id: PlayerId;
  name: string;
  role: Role | null;
}

export interface RaidResult {
  round: number;
  team: PlayerId[];
  sabotageCount: number;
  success: boolean;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  hostId: PlayerId;

  currentRound: number;
  scores: {
    police: number;
    moles: number;
  };
  raidResults: RaidResult[];

  proposerIndex: number;
  consecutiveRejections: number;
  currentProposedTeam: PlayerId[];

  /**
   * Vote value, or `null` when the viewer may only know that a ballot was cast
   * (projected client views). Authoritative host state always stores Vote.
   */
  teamVotes: Record<PlayerId, Vote | null>;
  /**
   * Raid action, or `null` when the value is hidden from this viewer.
   * Authoritative host state always stores RaidAction; UI never shows the value.
   */
  raidActions: Record<PlayerId, RaidAction | null>;

  winner: 'Police' | 'Moles' | null;
}
