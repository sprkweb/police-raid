import type { GameState } from '../types/game';
import { BALANCE, type PlayerCount } from './constants';
import { isSupportedPlayerCount, requiredSabotagesForRound, requiredTeamSize } from './rules';

export const getBalance = (playerCount: number) =>
  isSupportedPlayerCount(playerCount) ? BALANCE[playerCount] : undefined;

export const getTeamSize = (state: GameState, round: number = state.currentRound): number => {
  const count = state.players.length;
  return isSupportedPlayerCount(count) ? requiredTeamSize(count, round) : 0;
};

export const needsTwoSabotages = (state: GameState, round: number): boolean => {
  const count = state.players.length;
  if (!isSupportedPlayerCount(count)) return false;
  return requiredSabotagesForRound(count as PlayerCount, round) === 2;
};

/**
 * Identity of the current proposing turn. Local detail picks must reset when
 * this changes — including GameOver → Discussion rematch with the same round
 * and proposer (e.g. a round-1 rejection win).
 */
export function proposingTurnId(
  state: Pick<GameState, 'phase' | 'currentRound' | 'proposerIndex'>,
): string {
  return `${state.phase}:${state.currentRound}:${state.proposerIndex}`;
}
