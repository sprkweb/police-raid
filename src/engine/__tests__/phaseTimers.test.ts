import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GamePhase } from '../../types/game';
import { PHASE_DURATION_MS } from '../constants';
import { formatCountdown, countdownLabel } from '../formatCountdown';
import { createSequenceRandom } from '../rng';
import {
  beginProposing,
  createTestEngine,
  currentProposerId,
  fillLobby,
  proposeValidTeam,
  startWithPlayers,
  teamOfSize,
  type TestEngine,
} from './helpers';

function startWithTimers(
  total: number,
  options?: Parameters<typeof createTestEngine>[2],
): TestEngine {
  const ctx = createTestEngine('host', 'Host', options);
  ctx.engine.setTimersEnabled(true);
  fillLobby(ctx.engine, total);
  ctx.engine.startGame();
  return ctx;
}

describe('formatCountdown', () => {
  it('formats whole seconds as M:SS (ceil)', () => {
    expect(formatCountdown(90_000)).toBe('1:30');
    expect(formatCountdown(20_000)).toBe('0:20');
    expect(formatCountdown(1_001)).toBe('0:02');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-500)).toBe('0:00');
  });
});

describe('countdownLabel', () => {
  it('returns null when the deadline is cleared', () => {
    expect(countdownLabel(null, 1_000)).toBeNull();
    expect(countdownLabel(undefined, 1_000)).toBeNull();
  });

  it('uses the new deadline immediately (no sticky previous value)', () => {
    expect(countdownLabel(91_000, 1_000)).toBe('1:30');
    expect(countdownLabel(21_000, 1_000)).toBe('0:20');
  });
});

describe('GameEngine phase timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggles timersEnabled only in Lobby', () => {
    const { engine, getState } = createTestEngine('host', 'Host', { timersEnabled: true });
    expect(getState().timersEnabled).toBe(true);

    engine.setTimersEnabled(false);
    expect(getState().timersEnabled).toBe(false);

    fillLobby(engine, 5);
    engine.startGame();
    engine.setTimersEnabled(true);
    expect(getState().timersEnabled).toBe(false);
  });

  it('does not set phaseEndsAt when timers are off', () => {
    const ctx = startWithPlayers(5);
    expect(ctx.getState().timersEnabled).toBe(false);
    expect(ctx.getState().phaseEndsAt).toBeNull();
  });

  it('arms a Discussion deadline and ends briefing on expiry', () => {
    const ctx = startWithTimers(5);

    expect(ctx.getState().phase).toBe(GamePhase.Discussion);
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.Discussion);

    vi.advanceTimersByTime(PHASE_DURATION_MS.Discussion);
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.ProposingTeam);
  });

  it('still allows the host to end Discussion early and retimes proposing', () => {
    const ctx = startWithTimers(5);
    const discussionEndsAt = ctx.getState().phaseEndsAt;

    ctx.engine.endDiscussion();
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
    expect(ctx.getState().phaseEndsAt).not.toBe(discussionEndsAt);
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.ProposingTeam);
  });

  it('auto-proposes with bot behavior when proposing times out', () => {
    const random = createSequenceRandom([
      // role shuffle for 5
      0, 0, 0, 0,
      // proposer index 0
      0,
      // chooseProposedTeam shuffle draws for size 2 (one other player)
      0,
    ]);
    const ctx = startWithTimers(5, { random });
    beginProposing(ctx);

    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
    expect(ctx.getState().currentProposedTeam).toHaveLength(0);

    vi.advanceTimersByTime(PHASE_DURATION_MS.ProposingTeam);
    expect(ctx.getState().phase).toBe(GamePhase.VotingOnTeam);
    expect(ctx.getState().currentProposedTeam).toHaveLength(2);
    expect(ctx.getState().currentProposedTeam[0]).toBe(currentProposerId(ctx.getState()));
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.VotingOnTeam);
  });

  it('fills missing votes on voting timeout and resolves', () => {
    const ctx = startWithTimers(5, {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
    });
    beginProposing(ctx);
    proposeValidTeam(ctx);

    expect(ctx.getState().phase).toBe(GamePhase.VotingOnTeam);
    ctx.engine.voteTeam('host', 'Approve');
    expect(Object.keys(ctx.getState().teamVotes)).toHaveLength(1);

    vi.advanceTimersByTime(PHASE_DURATION_MS.VotingOnTeam);
    expect([GamePhase.Raid, GamePhase.ProposingTeam, GamePhase.GameOver]).toContain(
      ctx.getState().phase,
    );
    expect(ctx.getState().phase).not.toBe(GamePhase.VotingOnTeam);
  });

  it('fills missing raid actions on raid timeout', () => {
    const ctx = startWithTimers(5, {
      random: createSequenceRandom([0, 0, 0, 0, 0]),
    });
    beginProposing(ctx);
    proposeValidTeam(ctx, teamOfSize(ctx.getState()));
    for (const p of ctx.getState().players) {
      ctx.engine.voteTeam(p.id, 'Approve');
    }
    expect(ctx.getState().phase).toBe(GamePhase.Raid);
    expect(ctx.getState().phaseEndsAt).toBe(Date.now() + PHASE_DURATION_MS.Raid);

    vi.advanceTimersByTime(PHASE_DURATION_MS.Raid);
    expect(ctx.getState().phase).not.toBe(GamePhase.Raid);
    expect(ctx.getState().raidResults).toHaveLength(1);
  });
});
