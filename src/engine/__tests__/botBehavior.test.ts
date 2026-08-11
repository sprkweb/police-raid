import { describe, expect, it } from 'vitest';
import { Role } from '../../types/game';
import {
  BOT_LIKELY_CHANCE,
  BOT_ROUND1_OUTSIDE_APPROVE_CHANCE,
  BOT_UNLIKELY_CHANCE,
  chooseProposedTeam,
  chooseRaidAction,
  chooseTeamVote,
} from '../botBehavior';
import { createSequenceRandom } from '../rng';

const players = [
  { id: 'bot-1', name: 'Bot 1', role: null },
  { id: 'a', name: 'A', role: null },
  { id: 'b', name: 'B', role: null },
  { id: 'c', name: 'C', role: null },
  { id: 'd', name: 'D', role: null },
];

describe('chooseProposedTeam', () => {
  it('always includes the bot and fills to size', () => {
    const team = chooseProposedTeam('bot-1', players, 3, createSequenceRandom([0, 0, 0, 0]));
    expect(team).toHaveLength(3);
    expect(team[0]).toBe('bot-1');
    expect(new Set(team).size).toBe(3);
  });

  it('returns only the bot when size is 1', () => {
    expect(chooseProposedTeam('bot-1', players, 1, () => 0.5)).toEqual(['bot-1']);
  });
});

describe('chooseTeamVote', () => {
  const base = {
    botId: 'bot-1',
    proposedTeam: ['bot-1', 'a'] as const,
    currentRound: 2,
    consecutiveRejections: 0,
    playerCount: 5,
  };

  it('always Approves on the last proposal before rejection limit', () => {
    const vote = chooseTeamVote(
      {
        ...base,
        proposedTeam: ['a', 'b'],
        consecutiveRejections: 4,
        playerCount: 5,
      },
      () => 0.99,
    );
    expect(vote).toBe('Approve');
  });

  it('Approves when on team if random < likely chance', () => {
    expect(chooseTeamVote(base, () => BOT_LIKELY_CHANCE - 0.001)).toBe('Approve');
    expect(chooseTeamVote(base, () => BOT_LIKELY_CHANCE)).toBe('Reject');
  });

  it('rarely Approves when off team after round 1', () => {
    const offTeam = { ...base, proposedTeam: ['a', 'b'] as const, currentRound: 2 };
    expect(chooseTeamVote(offTeam, () => BOT_UNLIKELY_CHANCE - 0.001)).toBe('Approve');
    expect(chooseTeamVote(offTeam, () => BOT_UNLIKELY_CHANCE)).toBe('Reject');
  });

  it('Approves 50% when off team on round 1', () => {
    const offTeam = { ...base, proposedTeam: ['a', 'b'] as const, currentRound: 1 };
    expect(chooseTeamVote(offTeam, () => BOT_ROUND1_OUTSIDE_APPROVE_CHANCE - 0.001)).toBe(
      'Approve',
    );
    expect(chooseTeamVote(offTeam, () => BOT_ROUND1_OUTSIDE_APPROVE_CHANCE)).toBe('Reject');
  });
});

describe('chooseRaidAction', () => {
  it('Police always Support', () => {
    expect(chooseRaidAction({ role: Role.Police, currentRound: 2 }, () => 0)).toBe('Support');
    expect(chooseRaidAction({ role: Role.Police, currentRound: 1 }, () => 0)).toBe('Support');
  });

  it('Mole sabotages with likely chance after round 1', () => {
    expect(
      chooseRaidAction({ role: Role.Mole, currentRound: 2 }, () => BOT_LIKELY_CHANCE - 0.001),
    ).toBe('Sabotage');
    expect(chooseRaidAction({ role: Role.Mole, currentRound: 2 }, () => BOT_LIKELY_CHANCE)).toBe(
      'Support',
    );
  });

  it('Mole sabotages rarely on round 1', () => {
    expect(
      chooseRaidAction({ role: Role.Mole, currentRound: 1 }, () => BOT_UNLIKELY_CHANCE - 0.001),
    ).toBe('Sabotage');
    expect(chooseRaidAction({ role: Role.Mole, currentRound: 1 }, () => BOT_UNLIKELY_CHANCE)).toBe(
      'Support',
    );
  });
});
