import { describe, expect, it } from 'vitest';
import { Role } from '../../../types/game';
import { createBayesianBrain } from '../bayesian/brain';
import type { BotProposeContext, BotRaidContext, BotVoteContext } from '../types';

const brain = createBayesianBrain();
const playerIds = ['A', 'B', 'C', 'D', 'E'] as const;

function proposeCtx(overrides: Partial<BotProposeContext> = {}): BotProposeContext {
  return {
    actorId: 'C',
    playerIds,
    moleCount: 2,
    currentRound: 2,
    consecutiveRejections: 0,
    history: [],
    random: () => 0,
    teamSize: 3,
    ...overrides,
  };
}

function voteCtx(overrides: Partial<BotVoteContext> = {}): BotVoteContext {
  return {
    actorId: 'C',
    playerIds,
    moleCount: 2,
    currentRound: 2,
    consecutiveRejections: 0,
    history: [],
    random: () => 0,
    proposedTeam: ['A', 'B'],
    ...overrides,
  };
}

describe('createBayesianBrain decisions', () => {
  it('proposes self plus the two cleared players after a 2-sabotage pair', () => {
    const team = brain.chooseProposedTeam(
      proposeCtx({
        history: [{ kind: 'raid', team: ['A', 'B'], sabotageCount: 2, proposerId: 'A', round: 1 }],
      }),
    );
    expect(team).toHaveLength(3);
    expect(team).toContain('C');
    expect(team).toContain('D');
    expect(team).toContain('E');
  });

  it('always Approves on hammer', () => {
    expect(
      brain.chooseTeamVote(
        voteCtx({
          consecutiveRejections: 4,
          history: [{ kind: 'raid', team: ['A', 'B'], sabotageCount: 2, proposerId: 'A', round: 1 }],
        }),
      ),
    ).toBe('Approve');
  });

  it('Rejects a proven-dirty team when off it', () => {
    expect(
      brain.chooseTeamVote(
        voteCtx({
          history: [{ kind: 'raid', team: ['A', 'B'], sabotageCount: 2, proposerId: 'A', round: 1 }],
        }),
      ),
    ).toBe('Reject');
  });

  it('Police always Support on raid', () => {
    const ctx: BotRaidContext = {
      ...proposeCtx(),
      role: Role.Police,
      proposedTeam: ['C', 'D'],
      proposerId: 'C',
      requiredSabotages: 1,
      scores: { police: 0, moles: 0 },
      trueMoleIds: ['A', 'B'],
    };
    expect(brain.chooseRaidAction(ctx)).toBe('Support');
  });

  it('the designated mole sabotages and the partner Supports', () => {
    const base: Omit<BotRaidContext, 'actorId'> = {
      playerIds,
      moleCount: 2,
      currentRound: 1,
      consecutiveRejections: 0,
      history: [],
      random: () => 0,
      role: Role.Mole,
      proposedTeam: ['A', 'B'],
      proposerId: 'C',
      requiredSabotages: 1,
      scores: { police: 0, moles: 0 },
      trueMoleIds: ['A', 'B'],
    };
    expect(brain.chooseRaidAction({ ...base, actorId: 'A' })).toBe('Sabotage');
    expect(brain.chooseRaidAction({ ...base, actorId: 'B' })).toBe('Support');
  });
});
