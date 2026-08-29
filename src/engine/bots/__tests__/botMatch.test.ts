import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../../types/game';
import { createBotBrain } from '../createBotBrain';
import { createRandomBrain } from '../random';
import { createAllBotEngine, driveAllBotMatchToGameOver } from '../__bench__/simulateAllBotMatches';
import type { BotBrain } from '../types';

function brainFor(id: 'bayesian' | 'heuristic' | 'random'): BotBrain {
  return id === 'random' ? createRandomBrain() : createBotBrain(id);
}

describe('all-bot matches', () => {
  it.each(['bayesian', 'heuristic', 'random'] as const)(
    '%s 5-player match reaches GameOver',
    (id) => {
      const engine = createAllBotEngine(5, { botBrain: brainFor(id) });
      expect(engine.getState().phase).toBe(GamePhase.Discussion);
      expect(engine.getState().players).toHaveLength(5);
      driveAllBotMatchToGameOver(engine);
      expect(engine.getState().phase).toBe(GamePhase.GameOver);
      expect(engine.getState().winner).toMatch(/Police|Moles/);
    },
  );
});
