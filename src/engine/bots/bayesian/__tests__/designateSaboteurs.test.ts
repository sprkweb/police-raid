import { describe, expect, it } from 'vitest';
import { designateSaboteurs, priorSaboteursFromHistory } from '../designateSaboteurs';
import type { GameEvent } from '../../../../types/game';

const seats = ['p0', 'p1', 'p2', 'p3', 'p4'] as const;
const moles = ['p2', 'p4'] as const;

describe('designateSaboteurs', () => {
  it('picks a prior saboteur on the raid even if another mole proposed', () => {
    expect(
      designateSaboteurs({
        team: ['p0', 'p2', 'p4'],
        moleIds: moles,
        proposerId: 'p2',
        seatingOrder: seats,
        priorSaboteurs: ['p4'],
        requiredSabotages: 1,
      }),
    ).toEqual(['p4']);
  });

  it('picks the proposing mole when nobody on the raid has sabotaged', () => {
    expect(
      designateSaboteurs({
        team: ['p0', 'p2', 'p4'],
        moleIds: moles,
        proposerId: 'p2',
        seatingOrder: seats,
        priorSaboteurs: [],
        requiredSabotages: 1,
      }),
    ).toEqual(['p2']);
  });

  it('picks the earlier seat when the proposer is a cop', () => {
    expect(
      designateSaboteurs({
        team: ['p0', 'p2', 'p4'],
        moleIds: moles,
        proposerId: 'p0',
        seatingOrder: seats,
        priorSaboteurs: [],
        requiredSabotages: 1,
      }),
    ).toEqual(['p2']);
  });

  it('takes the first two in the same order when two sabotages are required', () => {
    expect(
      designateSaboteurs({
        team: ['p0', 'p2', 'p4'],
        moleIds: moles,
        proposerId: 'p0',
        seatingOrder: seats,
        priorSaboteurs: [],
        requiredSabotages: 2,
      }),
    ).toEqual(['p2', 'p4']);
  });
});

describe('priorSaboteursFromHistory', () => {
  it('credits designated moles when public k > 0', () => {
    const history: GameEvent[] = [
      {
        kind: 'raid',
        team: ['p0', 'p2'],
        sabotageCount: 1,
        proposerId: 'p0',
        round: 1,
      },
    ];
    expect(priorSaboteursFromHistory(moles, seats, history)).toEqual(['p2']);
  });

  it('credits nobody when k = 0', () => {
    const history: GameEvent[] = [
      {
        kind: 'raid',
        team: ['p0', 'p2'],
        sabotageCount: 0,
        proposerId: 'p0',
        round: 1,
      },
    ];
    expect(priorSaboteursFromHistory(moles, seats, history)).toEqual([]);
  });
});
