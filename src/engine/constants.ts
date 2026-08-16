/** Balance configurations based on README.md game rules. */

export interface BalanceConfig {
  moles: number;
  teamSizes: readonly [number, number, number, number, number];
  twoSabotagesRequiredOnRound: readonly number[];
}

export const BALANCE: Record<5 | 6 | 7 | 8, BalanceConfig> = {
  5: { moles: 2, teamSizes: [2, 3, 2, 3, 3], twoSabotagesRequiredOnRound: [] },
  6: { moles: 2, teamSizes: [2, 3, 4, 3, 4], twoSabotagesRequiredOnRound: [] },
  7: { moles: 3, teamSizes: [2, 3, 3, 4, 4], twoSabotagesRequiredOnRound: [4] },
  8: { moles: 3, teamSizes: [3, 4, 4, 5, 5], twoSabotagesRequiredOnRound: [4] },
};

export type PlayerCount = keyof typeof BALANCE;

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 8;
export const MAX_ROUNDS = 5;
export const WINS_NEEDED = 3;

/** Prefixed ids for lobby-fill bots when starting under MIN_PLAYERS. */
export const BOT_ID_PREFIX = 'bot-';

/** How long a disconnected lobby seat is held before it is dropped. */
export const LOBBY_DISCONNECT_GRACE_MS = 15_000;

/** Callsign length after trim. */
export const MAX_CALLSIGN_LENGTH = 24;

/**
 * Per-phase time limits when the host enables timers in the lobby.
 * Easy to tweak without hunting through engine/UI code.
 */
export const PHASE_DURATION_MS = {
  Discussion: 90_000,
  ProposingTeam: 20_000,
  VotingOnTeam: 20_000,
  Raid: 20_000,
} as const;
