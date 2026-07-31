import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../types/game';
import { applyPlayerAction } from '../applyAction';
import { createSequenceRandom } from '../rng';
import {
  beginProposing,
  createTestEngine,
  currentProposerId,
  fillLobby,
  teamOfSize,
} from './helpers';

describe('applyPlayerAction', () => {
  it('routes START_GAME / PROPOSE_TEAM / VOTE_TEAM / RAID_ACTION', () => {
    const ctx = createTestEngine('host', 'Host', {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
    });
    fillLobby(ctx.engine, 5);

    applyPlayerAction(ctx.engine, 'host', { type: 'START_GAME' });
    expect(ctx.getState().phase).toBe(GamePhase.Discussion);

    beginProposing(ctx);
    const proposer = currentProposerId(ctx.getState());
    applyPlayerAction(ctx.engine, proposer, {
      type: 'PROPOSE_TEAM',
      team: teamOfSize(ctx.getState()),
    });
    expect(ctx.getState().phase).toBe(GamePhase.VotingOnTeam);

    for (const p of ctx.getState().players) {
      applyPlayerAction(ctx.engine, p.id, { type: 'VOTE_TEAM', vote: 'Approve' });
    }
    expect(ctx.getState().phase).toBe(GamePhase.Raid);

    for (const id of ctx.getState().currentProposedTeam) {
      applyPlayerAction(ctx.engine, id, { type: 'RAID_ACTION', action: 'Support' });
    }
    expect(ctx.getState().scores.police).toBe(1);
  });

  it('routes SKIP_PROPOSAL', () => {
    const ctx = createTestEngine('host', 'Host', {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
    });
    fillLobby(ctx.engine, 5);
    applyPlayerAction(ctx.engine, 'host', { type: 'START_GAME' });
    beginProposing(ctx);
    const before = ctx.getState().proposerIndex;
    applyPlayerAction(ctx.engine, currentProposerId(ctx.getState()), {
      type: 'SKIP_PROPOSAL',
    });
    expect(ctx.getState().proposerIndex).toBe((before + 1) % 5);
  });
});
