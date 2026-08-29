import { describe, expect, it } from 'vitest';
import { Role } from '../../../../types/game';
import { createSeededRandom } from '../../../rng';
import { createRandomBrain } from '../brain';
import type { BotProposeContext, BotRaidContext, BotVoteContext } from '../../types';

const brain = createRandomBrain();
const playerIds = ['A', 'B', 'C', 'D', 'E'] as const;

function proposeCtx(overrides: Partial<BotProposeContext> = {}): BotProposeContext {
  return {
    actorId: 'C',
    playerIds,
    moleCount: 2,
    currentRound: 1,
    consecutiveRejections: 0,
    history: [],
    random: () => 0,
    teamSize: 3,
    ...overrides,
  };
}

function voteCtx(overrides: Partial<BotVoteContext> = {}): BotVoteContext {
  return {
    ...proposeCtx(),
    proposedTeam: ['A', 'B'],
    ...overrides,
  };
}

function raidCtx(overrides: Partial<BotRaidContext> = {}): BotRaidContext {
  return {
    ...proposeCtx(),
    role: Role.Mole,
    proposedTeam: ['A', 'B'],
    proposerId: 'A',
    requiredSabotages: 1,
    scores: { police: 0, moles: 0 },
    trueMoleIds: ['A', 'B'],
    ...overrides,
  };
}

describe('createRandomBrain', () => {
  it('identifies as random', () => {
    expect(brain.id).toBe('random');
  });

  it('proposes a unique team of the required size from the seating', () => {
    const team = brain.chooseProposedTeam(proposeCtx());
    expect(team).toHaveLength(3);
    expect(new Set(team).size).toBe(3);
    const seated = new Set<string>(playerIds);
    expect(team.every((id) => seated.has(id))).toBe(true);
  });

  it('does not force the actor onto the team', () => {
    let excludedActor = false;
    for (let seed = 0; seed < 40; seed++) {
      const team = brain.chooseProposedTeam(
        proposeCtx({ actorId: 'E', teamSize: 2, random: createSeededRandom(seed) }),
      );
      if (!team.includes('E')) {
        excludedActor = true;
        break;
      }
    }
    expect(excludedActor).toBe(true);
  });

  it('Approves when random < 0.5 and Rejects otherwise', () => {
    expect(brain.chooseTeamVote(voteCtx({ random: () => 0 }))).toBe('Approve');
    expect(brain.chooseTeamVote(voteCtx({ random: () => 0.5 }))).toBe('Reject');
  });

  it('Police always Support', () => {
    expect(brain.chooseRaidAction(raidCtx({ role: Role.Police, random: () => 0 }))).toBe('Support');
  });

  it('Mole sabotages when random < 0.5', () => {
    expect(brain.chooseRaidAction(raidCtx({ random: () => 0 }))).toBe('Sabotage');
    expect(brain.chooseRaidAction(raidCtx({ random: () => 0.5 }))).toBe('Support');
  });
});
