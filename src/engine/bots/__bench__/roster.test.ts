import { describe, expect, it } from 'vitest';
import { mixedRoster, pairwiseRoster, rotateRoster } from './simulateMixedBotMatches';

describe('rotateRoster', () => {
  it('rotates left by offset', () => {
    expect(rotateRoster(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a']);
    expect(rotateRoster(['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c']);
  });
});

describe('mixedRoster', () => {
  it('cycles kinds then rotates by game index', () => {
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
      'bayesian',
    ]);
  });
});

describe('pairwiseRoster', () => {
  it('gives the extra seat to the left brain, then rotates', () => {
    expect(pairwiseRoster(5, 0, 'bayesian', 'heuristic')).toEqual([
      'bayesian',
      'bayesian',
      'bayesian',
      'heuristic',
      'heuristic',
    ]);
    expect(pairwiseRoster(5, 1, 'bayesian', 'heuristic')).toEqual([
      'bayesian',
      'bayesian',
      'heuristic',
      'heuristic',
      'bayesian',
    ]);
  });
});
