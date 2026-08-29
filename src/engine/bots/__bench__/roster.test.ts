import { describe, expect, it } from 'vitest';
import { mixedRoster, pairwiseRoster, rotateRoster } from './simulateMixedBotMatches';

describe('rotateRoster', () => {
  it('rotates left by offset', () => {
    expect(rotateRoster(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a']);
    expect(rotateRoster(['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c']);
  });
});

describe('mixedRoster', () => {
  it('cycles kinds and shifts the leftover seat with the game index', () => {
    expect(mixedRoster(5, 0, ['bayesian', 'heuristic', 'random'])).toEqual([
      'bayesian',
      'heuristic',
      'random',
      'bayesian',
      'heuristic',
    ]);
    expect(mixedRoster(5, 1, ['bayesian', 'heuristic', 'random'])).toEqual([
      'heuristic',
      'random',
      'bayesian',
      'heuristic',
      'random',
    ]);
  });
});

describe('pairwiseRoster', () => {
  it('alternates the two brains and swaps the extra seat each game', () => {
    expect(pairwiseRoster(5, 0, 'bayesian', 'heuristic')).toEqual([
      'bayesian',
      'heuristic',
      'bayesian',
      'heuristic',
      'bayesian',
    ]);
    expect(pairwiseRoster(5, 1, 'bayesian', 'heuristic')).toEqual([
      'heuristic',
      'bayesian',
      'heuristic',
      'bayesian',
      'heuristic',
    ]);
  });
});
