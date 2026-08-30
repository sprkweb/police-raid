import { describe, expect, it } from 'vitest';
import { GamePhase, type GameEvent } from '../../../../types/game';
import { buildBayesianBeliefsDebugSnapshot } from '../debugSnapshot';

const seats = [
  { id: 'A', name: 'Ada' },
  { id: 'B', name: 'Bea' },
  { id: 'C', name: 'Cy' },
  { id: 'D', name: 'Di' },
  { id: 'E', name: 'Ed' },
] as const;

describe('buildBayesianBeliefsDebugSnapshot', () => {
  it('starts uniform: each other player is a mole with P=0.5, observer is 0', () => {
    const snap = buildBayesianBeliefsDebugSnapshot({
      players: seats,
      moleCount: 2,
      observerIds: ['C'],
      history: [],
      proposedTeam: [],
      phase: GamePhase.Discussion,
      currentRound: 1,
    });

    expect(snap.brain).toBe('bayesian');
    expect(snap.observationCount).toBe(0);
    expect(snap.observers).toHaveLength(1);
    expect(snap.byObserver.Cy.Ada).toBe(0.5);
    expect(snap.byObserver.Cy.Bea).toBe(0.5);
    expect(snap.byObserver.Cy.Cy).toBe(0);
    expect(snap.byObserver.Cy.Di).toBe(0.5);
    expect(snap.byObserver.Cy.Ed).toBe(0.5);
    expect(snap.observers[0]!.worlds).toHaveLength(6);
    expect(snap.pNoMolesOnProposed).toEqual({});
  });

  it('collapses after a 2-sabotage pair and reports P(no moles) for a proposed team', () => {
    const history: GameEvent[] = [
      { kind: 'raid', team: ['A', 'B'], sabotageCount: 2, proposerId: 'A', round: 1 },
    ];
    const snap = buildBayesianBeliefsDebugSnapshot({
      players: seats,
      moleCount: 2,
      observerIds: ['C'],
      history,
      proposedTeam: ['C', 'D', 'E'],
      phase: GamePhase.VotingOnTeam,
      currentRound: 2,
    });

    expect(snap.byObserver.Cy.Ada).toBe(1);
    expect(snap.byObserver.Cy.Bea).toBe(1);
    expect(snap.byObserver.Cy.Di).toBe(0);
    expect(snap.pNoMolesOnProposed.Cy).toBe(1);
    expect(snap.observers[0]!.worlds).toEqual([{ moles: ['Ada', 'Bea'], p: 1 }]);
  });
});
