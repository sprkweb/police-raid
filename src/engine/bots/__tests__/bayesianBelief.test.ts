import { describe, expect, it } from 'vitest';
import {
  beliefsFromRaids,
  cleanProbability,
  level1BeliefsFromHistory,
  moleProbability,
  nestedCopProposeTeams,
  nestedCopVote,
  nestedMoleVote,
} from '../bayesianBelief';
import { CLEAN_VOTE_THRESHOLD, SABOTAGE_PRIOR } from '../bayesianConstants';
import type { BotObservation } from '../types';

const players = ['A', 'B', 'C', 'D', 'E'] as const;
const observer = 'C';

function raid(
  team: readonly string[],
  sabotageCount: number,
  proposerId = 'A',
): BotObservation {
  return { kind: 'raid', team, sabotageCount, proposerId, round: 1 };
}

describe('beliefsFromRaids examples', () => {
  it('k=2 on [A,B] collapses to the world {A,B}', () => {
    const beliefs = beliefsFromRaids(players, 2, observer, [raid(['A', 'B'], 2)]);
    expect(beliefs).toHaveLength(1);
    expect([...beliefs[0]!.moles].sort()).toEqual(['A', 'B']);
    expect(beliefs[0]!.probability).toBeCloseTo(1);

    expect(cleanProbability(beliefs, ['C', 'D', 'E'])).toBeCloseTo(1);
    expect(cleanProbability(beliefs, ['C', 'A', 'D'])).toBeCloseTo(0);
  });

  it('k=1 on [A,B] kills the off-team pair and keeps {A,B} with binomial weight', () => {
    const beliefs = beliefsFromRaids(players, 2, observer, [raid(['A', 'B'], 1)]);
    const byKey = new Map(beliefs.map((b) => [[...b.moles].sort().join(','), b.probability]));

    expect(byKey.get('D,E') ?? 0).toBeCloseTo(0);
    expect(byKey.get('A,B')).toBeGreaterThan(0);

    const mixed = byKey.get('A,D')!;
    const both = byKey.get('A,B')!;
    // Mixed worlds: m=1, k=1 → α. {A,B}: m=2, k=1 → 2 α (1-α). Ratio 2(1-α).
    expect(both / mixed).toBeCloseTo(2 * (1 - SABOTAGE_PRIOR), 5);

    expect(cleanProbability(beliefs, ['C', 'A', 'B'])).toBeCloseTo(0);
    expect(cleanProbability(beliefs, ['C', 'D', 'E'])).toBeLessThan(
      cleanProbability(beliefs, ['C', 'A', 'D']),
    );
    expect(cleanProbability(beliefs, ['C', 'A', 'D'])).toBeGreaterThan(0);
  });

  it('k=0 does not zero worlds that had moles on the team', () => {
    const beliefs = beliefsFromRaids(players, 2, observer, [raid(['A', 'B'], 0)]);
    const byKey = new Map(beliefs.map((b) => [[...b.moles].sort().join(','), b.probability]));
    expect(byKey.get('A,B')).toBeGreaterThan(0);
    expect(byKey.get('A,D')).toBeGreaterThan(0);
    expect(byKey.get('D,E')).toBeGreaterThan(byKey.get('A,B')!);
  });
});

describe('nested cop vote', () => {
  it('Approves on hammer even when the team looks dirty', () => {
    const beliefs = beliefsFromRaids(players, 2, observer, [raid(['A', 'B'], 2)]);
    expect(nestedCopVote(observer, ['A', 'B'], beliefs, 4, 5)).toBe('Approve');
  });

  it('Rejects an on-team proposal with P_clean == 0', () => {
    const beliefs = beliefsFromRaids(players, 2, observer, [raid(['A', 'B'], 2)]);
    expect(cleanProbability(beliefs, ['C', 'A'])).toBeCloseTo(0);
    expect(nestedCopVote(observer, ['C', 'A'], beliefs, 0, 5)).toBe('Reject');
  });

  it('Rejects off-team when P_clean is below the threshold', () => {
    const beliefs = beliefsFromRaids(players, 2, observer, [raid(['A', 'B'], 2)]);
    expect(cleanProbability(beliefs, ['A', 'B'])).toBeLessThan(CLEAN_VOTE_THRESHOLD);
    expect(nestedCopVote(observer, ['A', 'B'], beliefs, 0, 5)).toBe('Reject');
  });
});

describe('level-1 ToM', () => {
  it('penalizes a cop hypothesis when the proposer ignores nested cop teams', () => {
    const raidEvent = raid(['A', 'B'], 1);
    const nested = beliefsFromRaids(players, 2, 'E', [raidEvent]);
    const copBest = nestedCopProposeTeams('E', players, 2, nested);
    expect(copBest.length).toBeGreaterThan(0);

    const dirtyTeam = ['E', 'A'] as const;
    expect(copBest.some((t) => t.includes('A') && t.includes('E'))).toBe(false);

    const matching = level1BeliefsFromHistory(players, 2, observer, [
      raidEvent,
      { kind: 'proposal', proposerId: 'E', team: copBest[0]! },
    ]);
    const mismatching = level1BeliefsFromHistory(players, 2, observer, [
      raidEvent,
      { kind: 'proposal', proposerId: 'E', team: dirtyTeam },
    ]);

    expect(moleProbability(mismatching, 'E')).toBeGreaterThan(moleProbability(matching, 'E'));
  });

  it('treats an off-team Approve of a dirty team as more mole-like', () => {
    const raidEvent = raid(['A', 'B'], 1);
    const nested = beliefsFromRaids(players, 2, 'E', [raidEvent]);
    expect(nestedCopVote('E', ['A', 'B'], nested, 0, 5)).toBe('Reject');
    expect(nestedMoleVote(['A', 'B'], ['A', 'E'])).toBe('Approve');

    const approve = level1BeliefsFromHistory(players, 2, observer, [
      raidEvent,
      {
        kind: 'votes',
        team: ['A', 'B'],
        consecutiveRejections: 0,
        votes: { A: 'Approve', B: 'Approve', C: 'Reject', D: 'Reject', E: 'Approve' },
      },
    ]);
    const reject = level1BeliefsFromHistory(players, 2, observer, [
      raidEvent,
      {
        kind: 'votes',
        team: ['A', 'B'],
        consecutiveRejections: 0,
        votes: { A: 'Approve', B: 'Approve', C: 'Reject', D: 'Reject', E: 'Reject' },
      },
    ]);

    expect(moleProbability(approve, 'E')).toBeGreaterThan(moleProbability(reject, 'E'));
  });
});
