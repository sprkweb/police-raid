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
