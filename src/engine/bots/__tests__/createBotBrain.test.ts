import { describe, expect, it } from 'vitest';
import { createBotBrain } from '../createBotBrain';

describe('createBotBrain', () => {
  it('defaults to bayesian', () => {
    expect(createBotBrain().id).toBe('bayesian');
  });

  it('returns the requested brain', () => {
    expect(createBotBrain('heuristic').id).toBe('heuristic');
    expect(createBotBrain('bayesian').id).toBe('bayesian');
    expect(createBotBrain('random').id).toBe('random');
  });
});
