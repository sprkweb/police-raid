import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../types/game';
import { getBalance, getTeamSize, needsTwoSabotages } from '../selectors';
import { createInitialState } from '../rules';

describe('selectors', () => {
  it('getBalance returns config or undefined', () => {
    expect(getBalance(5)?.moles).toBe(2);
    expect(getBalance(4)).toBeUndefined();
  });

  it('getTeamSize uses current round by default', () => {
    const state = createInitialState('h', 'H');
    // pad to 5 so balance exists
    for (let i = 2; i <= 5; i++) {
      state.players.push({ id: `p${i}`, name: `P${i}`, role: null });
    }
    state.currentRound = 2;
    expect(getTeamSize(state)).toBe(3);
    expect(getTeamSize(state, 1)).toBe(2);
  });

  it('needsTwoSabotages is true only for configured rounds', () => {
    const state = createInitialState('h', 'H');
    for (let i = 2; i <= 7; i++) {
      state.players.push({ id: `p${i}`, name: `P${i}`, role: null });
    }
    expect(state.players).toHaveLength(7);
    expect(needsTwoSabotages(state, 4)).toBe(true);
    expect(needsTwoSabotages(state, 1)).toBe(false);
  });

  it('getTeamSize returns 0 for unsupported lobby sizes', () => {
    const state = createInitialState('h', 'H');
    expect(getTeamSize(state)).toBe(0);
    expect(state.phase).toBe(GamePhase.Lobby);
  });
});
