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
  VoteResult: 'VoteResult',
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
  /** False while this seat’s current transport peer is gone. */
  connected: boolean;
}

export interface Spectator {
  id: PlayerId;
  name: string;
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
  spectators: Spectator[];
  hostId: PlayerId;
  /**
   * Monotonic revision. Clients ignore `GAME_STATE_UPDATE` payloads whose
   * `stateSeq` is not greater than the last one they applied.
   */
  stateSeq: number;

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

  /** Host lobby toggle: timed phases with auto-actions on expiry. */
  timersEnabled: boolean;
  /**
   * Host lobby toggle: Bayesian bot tactics when true, original selfish
   * heuristics when false. Applies to reserve bots and timer auto-fills.
   */
  advancedBotsEnabled: boolean;
  /**
   * Absolute timestamp (ms since epoch) when the current timed phase ends.
   * `null` when timers are off or the phase has no deadline.
   */
  phaseEndsAt: number | null;
}
