import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../../types/game';
import { createBotBrain } from '../createBotBrain';
import { createAllBotEngine, driveAllBotMatchToGameOver } from '../__bench__/simulateAllBotMatches';

describe('all-bot matches', () => {
  it.each(['bayesian', 'heuristic', 'random'] as const)(
    '%s 5-player match reaches GameOver',
    (id) => {
      const engine = createAllBotEngine(5, { botBrain: createBotBrain(id) });
      expect(engine.getState().phase).toBe(GamePhase.Discussion);
      expect(engine.getState().players).toHaveLength(5);
      driveAllBotMatchToGameOver(engine);
      expect(engine.getState().phase).toBe(GamePhase.GameOver);
      expect(engine.getState().winner).toMatch(/Police|Moles/);
    },
  );
});
