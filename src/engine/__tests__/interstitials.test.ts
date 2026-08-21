import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GamePhase } from '../../types/game';
import { BOT_ID_PREFIX, PHASE_DURATION_MS, WINS_NEEDED } from '../constants';
import { createSequenceRandom } from '../rng';
import {
  allRaid,
  allVote,
  beginProposing,
  createTestEngine,
  passSuccessfulRaid,
  proposeValidTeam,
  startWithPlayers,
  teamOfSize,
} from './helpers';

const overlayOptions = {
  voteResultDurationMs: PHASE_DURATION_MS.VoteResult,
  roundEndDurationMs: PHASE_DURATION_MS.RoundEnd,
};

describe('vote and raid result overlays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds VoteResult with phaseEndsAt, then enters Raid on majority', () => {
    const ctx = startWithPlayers(5, {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
      ...overlayOptions,
    });
    beginProposing(ctx);
    proposeValidTeam(ctx);
    allVote(ctx, 'Approve');

    expect(ctx.getState().phase).toBe(GamePhase.VoteResult);
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.VoteResult);
    expect(ctx.getState().consecutiveRejections).toBe(0);
    expect(Object.keys(ctx.getState().teamVotes)).toHaveLength(5);

    vi.advanceTimersByTime(PHASE_DURATION_MS.VoteResult);
    expect(ctx.getState().phase).toBe(GamePhase.Raid);
    expect(ctx.getState().teamVotes.host).toBe('Approve');
  });

  it('holds VoteResult on a rejected detail, then advances the proposer', () => {
    const ctx = startWithPlayers(5, {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
      ...overlayOptions,
    });
    beginProposing(ctx);
    const before = ctx.getState().proposerIndex;
    proposeValidTeam(ctx);
    allVote(ctx, 'Reject');

    expect(ctx.getState().phase).toBe(GamePhase.VoteResult);
    expect(ctx.getState().consecutiveRejections).toBe(1);
    expect(ctx.getState().proposerIndex).toBe(before);

    vi.advanceTimersByTime(PHASE_DURATION_MS.VoteResult);
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
    expect(ctx.getState().proposerIndex).toBe((before + 1) % 5);
    expect(ctx.getState().teamVotes).toEqual({});
  });

  it('skips VoteResult and goes straight to GameOver on the rejection limit', () => {
    const ctx = startWithPlayers(5, {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
      ...overlayOptions,
    });
    for (let i = 0; i < 4; i++) {
      if (ctx.getState().phase === GamePhase.Discussion) ctx.engine.endDiscussion();
      proposeValidTeam(ctx);
      allVote(ctx, 'Reject');
      vi.advanceTimersByTime(PHASE_DURATION_MS.VoteResult);
    }
    if (ctx.getState().phase === GamePhase.Discussion) ctx.engine.endDiscussion();
    proposeValidTeam(ctx);
    allVote(ctx, 'Reject');
    expect(ctx.getState().phase).toBe(GamePhase.GameOver);
    expect(ctx.getState().winner).toBe('Moles');
  });

  it('arms overlay deadlines even when lobby timers are off', () => {
    const ctx = startWithPlayers(5, {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
      timersEnabled: false,
      ...overlayOptions,
    });
    expect(ctx.getState().timersEnabled).toBe(false);
    beginProposing(ctx);
    proposeValidTeam(ctx);
    allVote(ctx, 'Approve');
    expect(ctx.getState().phase).toBe(GamePhase.VoteResult);
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.VoteResult);

    vi.advanceTimersByTime(PHASE_DURATION_MS.VoteResult);
    expect(ctx.getState().phase).toBe(GamePhase.Raid);
    allRaid(ctx, () => 'Support');
    expect(ctx.getState().phase).toBe(GamePhase.RoundEnd);
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.RoundEnd);
    expect(ctx.getState().scores.police).toBe(1);

    vi.advanceTimersByTime(PHASE_DURATION_MS.RoundEnd);
    expect(ctx.getState().phase).toBe(GamePhase.Discussion);
    expect(ctx.getState().currentRound).toBe(2);
  });

  it('skips RoundEnd and goes straight to GameOver on a deciding raid', () => {
    const ctx = startWithPlayers(5, {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
      ...overlayOptions,
    });
    for (let i = 0; i < WINS_NEEDED - 1; i++) {
      beginProposing(ctx);
      proposeValidTeam(ctx);
      allVote(ctx, 'Approve');
      vi.advanceTimersByTime(PHASE_DURATION_MS.VoteResult);
      allRaid(ctx, () => 'Support');
      vi.advanceTimersByTime(PHASE_DURATION_MS.RoundEnd);
    }
    beginProposing(ctx);
    proposeValidTeam(ctx);
    allVote(ctx, 'Approve');
    vi.advanceTimersByTime(PHASE_DURATION_MS.VoteResult);
    allRaid(ctx, () => 'Support');
    expect(ctx.getState().phase).toBe(GamePhase.GameOver);
    expect(ctx.getState().winner).toBe('Police');
    expect(ctx.getState().raidResults).toHaveLength(WINS_NEEDED);
  });

  it('does not let bots skip VoteResult', () => {
    const ctx = createTestEngine('host', 'Host', {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
      ...overlayOptions,
    });
    ctx.engine.startGameWithBots();
    beginProposing(ctx);
    proposeValidTeam(ctx, teamOfSize(ctx.getState()));
    ctx.engine.voteTeam('host', 'Approve');

    expect(ctx.getState().phase).toBe(GamePhase.VoteResult);
    expect(ctx.getState().players.some((p) => p.id.startsWith(BOT_ID_PREFIX))).toBe(true);
    expect(Object.keys(ctx.getState().raidActions)).toHaveLength(0);

    vi.advanceTimersByTime(PHASE_DURATION_MS.VoteResult - 1);
    expect(ctx.getState().phase).toBe(GamePhase.VoteResult);

    vi.advanceTimersByTime(1);
    expect(ctx.getState().phase).not.toBe(GamePhase.VoteResult);
    // Rejected ballots pass the proposer to a bot, who proposes immediately
    // (VotingOnTeam). Approved ballots enter Raid.
    expect([GamePhase.Raid, GamePhase.ProposingTeam, GamePhase.VotingOnTeam]).toContain(
      ctx.getState().phase,
    );
  });
});

describe('zero-duration overlays (test default)', () => {
  it('still reaches Raid after a unanimous approve', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    passSuccessfulRaid(ctx);
    expect(ctx.getState().phase).toBe(GamePhase.Discussion);
    expect(ctx.getState().scores.police).toBe(1);
  });
});
