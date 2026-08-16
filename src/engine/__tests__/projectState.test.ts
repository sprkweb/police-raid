import { describe, expect, it } from 'vitest';
import { GamePhase, Role, type GameState, type PlayerId } from '../../types/game';
import { projectForPlayer } from '../projectState';
import { createInitialState } from '../rules';

function baseState(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('host', 'Host');
  state.players = [
    { id: 'host', name: 'Host', role: Role.Police, connected: true },
    { id: 'mole1', name: 'Mole One', role: Role.Mole, connected: true },
    { id: 'mole2', name: 'Mole Two', role: Role.Mole, connected: true },
    { id: 'cop2', name: 'Cop Two', role: Role.Police, connected: true },
    { id: 'cop3', name: 'Cop Three', role: Role.Police, connected: true },
  ];
  state.phase = GamePhase.VotingOnTeam;
  state.currentProposedTeam = ['host', 'mole1'];
  return { ...state, ...overrides };
}

function roleOf(state: GameState, id: PlayerId) {
  return state.players.find((p) => p.id === id)?.role ?? null;
}

describe('projectForPlayer', () => {
  it('shows a police officer only their own role', () => {
    const view = projectForPlayer(baseState(), 'cop2');
    expect(roleOf(view, 'cop2')).toBe(Role.Police);
    expect(roleOf(view, 'host')).toBeNull();
    expect(roleOf(view, 'mole1')).toBeNull();
    expect(roleOf(view, 'mole2')).toBeNull();
    expect(roleOf(view, 'cop3')).toBeNull();
  });

  it('lets moles see fellow moles and themselves', () => {
    const view = projectForPlayer(baseState(), 'mole1');
    expect(roleOf(view, 'mole1')).toBe(Role.Mole);
    expect(roleOf(view, 'mole2')).toBe(Role.Mole);
    expect(roleOf(view, 'host')).toBeNull();
    expect(roleOf(view, 'cop2')).toBeNull();
  });

  it('reveals every role on GameOver', () => {
    const view = projectForPlayer(
      baseState({ phase: GamePhase.GameOver, winner: 'Police' }),
      'cop2',
    );
    expect(view.players.every((p) => p.role !== null)).toBe(true);
    expect(roleOf(view, 'mole1')).toBe(Role.Mole);
    expect(roleOf(view, 'host')).toBe(Role.Police);
  });

  it('keeps own vote value and redacts others to null while preserving keys', () => {
    const state = baseState({
      teamVotes: {
        host: 'Approve',
        mole1: 'Reject',
        cop2: 'Approve',
      },
    });
    const view = projectForPlayer(state, 'cop2');
    expect(Object.keys(view.teamVotes).sort()).toEqual(['cop2', 'host', 'mole1']);
    expect(view.teamVotes.cop2).toBe('Approve');
    expect(view.teamVotes.host).toBeNull();
    expect(view.teamVotes.mole1).toBeNull();
  });

  it('reveals every vote value on VoteResult and Raid', () => {
    const votes = { host: 'Approve' as const, mole1: 'Reject' as const, cop2: 'Approve' as const };
    const resultView = projectForPlayer(
      baseState({ phase: GamePhase.VoteResult, teamVotes: votes }),
      'cop2',
    );
    expect(resultView.teamVotes).toEqual(votes);

    const raidView = projectForPlayer(
      baseState({ phase: GamePhase.Raid, teamVotes: votes }),
      'cop3',
    );
    expect(raidView.teamVotes).toEqual(votes);

    const spectatorView = projectForPlayer(
      baseState({
        phase: GamePhase.VoteResult,
        teamVotes: votes,
        spectators: [{ id: 'watch', name: 'Alpha' }],
      }),
      'watch',
    );
    expect(spectatorView.teamVotes).toEqual(votes);
  });

  it('redacts all raid action values (UI never shows them)', () => {
    const state = baseState({
      phase: GamePhase.Raid,
      raidActions: {
        host: 'Support',
        mole1: 'Sabotage',
      },
    });
    const view = projectForPlayer(state, 'host');
    expect(Object.keys(view.raidActions).sort()).toEqual(['host', 'mole1']);
    expect(view.raidActions.host).toBeNull();
    expect(view.raidActions.mole1).toBeNull();
  });

  it('does not mutate the authoritative state', () => {
    const state = baseState({
      teamVotes: { host: 'Approve', mole1: 'Reject' },
      raidActions: { host: 'Support' },
      currentProposedTeam: ['host', 'mole1'],
    });
    const view = projectForPlayer(state, 'cop2');
    view.players[0]!.name = 'mutated';
    view.currentProposedTeam.push('cop2');
    view.teamVotes.cop3 = 'Approve';

    expect(state.players[0]!.name).toBe('Host');
    expect(state.currentProposedTeam).toEqual(['host', 'mole1']);
    expect(state.teamVotes).toEqual({ host: 'Approve', mole1: 'Reject' });
    expect(roleOf(state, 'mole1')).toBe(Role.Mole);
  });

  it('hides every role from a spectator until GameOver', () => {
    const state = baseState({
      spectators: [{ id: 'watch', name: 'Alpha' }],
      teamVotes: { host: 'Approve', cop2: 'Reject' },
    });
    const view = projectForPlayer(state, 'watch');
    expect(view.players.every((p) => p.role === null)).toBe(true);
    expect(view.spectators).toEqual([{ id: 'watch', name: 'Alpha' }]);
    expect(view.teamVotes).toEqual({ host: null, cop2: null });

    const over = projectForPlayer(
      baseState({
        phase: GamePhase.GameOver,
        winner: 'Police',
        spectators: [{ id: 'watch', name: 'Alpha' }],
      }),
      'watch',
    );
    expect(over.players.every((p) => p.role !== null)).toBe(true);
  });
});
