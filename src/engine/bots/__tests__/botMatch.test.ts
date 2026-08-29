import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../../types/game';
import { createBotBrain } from '../createBotBrain';
import { createAllBotEngine, driveAllBotMatchToGameOver } from '../__bench__/simulateAllBotMatches';
import {
  mixedRoster,
  resolverForRoster,
  seatIds,
  simulateMixedBotMatches,
} from '../__bench__/simulateMixedBotMatches';

describe('all-bot matches', () => {
  it.each(['bayesian', 'heuristic', 'random'] as const)(
    '%s 5-player match reaches GameOver',
    (id) => {
      const brain = createBotBrain(id);
      const engine = createAllBotEngine(5, { botBrain: () => brain });
      expect(engine.getState().phase).toBe(GamePhase.Discussion);
      expect(engine.getState().players).toHaveLength(5);
      driveAllBotMatchToGameOver(engine);
      expect(engine.getState().phase).toBe(GamePhase.GameOver);
      expect(engine.getState().winner).toMatch(/Police|Moles/);
    },
  );

  it('mixed-brain 5-player match reaches GameOver', () => {
    const roster = mixedRoster(5, 0);
    const engine = createAllBotEngine(5, {
      botBrain: resolverForRoster(roster, seatIds(5)),
    });
    driveAllBotMatchToGameOver(engine);
    expect(engine.getState().phase).toBe(GamePhase.GameOver);
    expect(engine.getState().winner).toMatch(/Police|Moles/);
  });

  it('mixed matchup stats count every seat', () => {
    const stats = simulateMixedBotMatches({
      playerCount: 5,
      games: 2,
      seed: 1,
      rosterForGame: (g) => mixedRoster(5, g),
    });
    expect(stats.games).toBe(2);
    expect(stats.policeWins + stats.moleWins).toBe(2);
    expect(stats.byBrain.reduce((n, row) => n + row.seats, 0)).toBe(10);
    expect(stats.byBrain.every((row) => row.wins <= row.seats)).toBe(true);
  });
});
