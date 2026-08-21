import { describe, expect, it } from 'vitest';
import { binomialCoefficient, combinations } from './combinations';

describe('combinations', () => {
  it('returns all k-subsets in index order', () => {
    expect(combinations(['A', 'B', 'C', 'D'], 2)).toEqual([
      ['A', 'B'],
      ['A', 'C'],
      ['A', 'D'],
      ['B', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ]);
  });

  it('handles k = 0 and k = n', () => {
    expect(combinations(['A', 'B'], 0)).toEqual([[]]);
    expect(combinations(['A', 'B'], 2)).toEqual([['A', 'B']]);
  });
});

describe('binomialCoefficient', () => {
  it('matches small nCk', () => {
    expect(binomialCoefficient(2, 1)).toBe(2);
    expect(binomialCoefficient(2, 2)).toBe(1);
    expect(binomialCoefficient(0, 0)).toBe(1);
    expect(binomialCoefficient(7, 3)).toBe(35);
  });
});
