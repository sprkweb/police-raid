import type { GameState } from '../types/game';
import { BALANCE } from './constants';

export const getBalance = (playerCount: number) => BALANCE[playerCount as keyof typeof BALANCE];

export const getTeamSize = (state: GameState, round: number = state.currentRound): number =>
  getBalance(state.players.length)?.teamSizes[round - 1] ?? 0;

export const needsTwoSabotages = (state: GameState, round: number): boolean =>
  getBalance(state.players.length)?.twoSabotagesRequiredOnRound.includes(round) ?? false;
