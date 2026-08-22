import { describe, expect, it } from 'vitest';
import { GamePhase, Role, type GameState, type PlayerId } from '../../types/game';
import { shouldAcceptGameStateUpdate } from '../acceptGameState';

function state(
  hostId: PlayerId,
  playerIds: PlayerId[],
  extras: Partial<GameState> = {},
): GameState {
  return {
    phase: extras.phase ?? GamePhase.Lobby,
    players: extras.players ?? playerIds.map((id) => ({
      id,
      name: id,
      role: null,
      connected: true,
    })),
    spectators: extras.spectators ?? [],
    hostId,
    stateSeq: extras.stateSeq ?? 1,
    currentRound: extras.currentRound ?? 1,
    scores: extras.scores ?? { police: 0, moles: 0 },
    raidResults: extras.raidResults ?? [],
    proposerIndex: extras.proposerIndex ?? 0,
    consecutiveRejections: extras.consecutiveRejections ?? 0,
    currentProposedTeam: extras.currentProposedTeam ?? [],
    teamVotes: extras.teamVotes ?? {},
    raidActions: extras.raidActions ?? {},
    winner: extras.winner ?? null,
    timersEnabled: extras.timersEnabled ?? false,
    advancedBotsEnabled: extras.advancedBotsEnabled ?? true,
    phaseEndsAt: extras.phaseEndsAt ?? null,
  };
}

describe('shouldAcceptGameStateUpdate', () => {
  it('rejects when the host peer is not locked yet', () => {
    const s = state('host-seat', ['host-seat', 'me']);
    expect(
      shouldAcceptGameStateUpdate('host-peer', s, {
        seatId: 'me',
        lockedHostPeerId: null,
        lastSeq: 0,
      }),
    ).toBe(false);
  });

  it('rejects when transport sender is not the locked host peer', () => {
    const s = state('host-seat', ['host-seat', 'me']);
    expect(
      shouldAcceptGameStateUpdate('attacker', s, {
        seatId: 'me',
        lockedHostPeerId: 'host-peer',
        lastSeq: 0,
      }),
    ).toBe(false);
  });

  it('accepts when locked peer matches, viewer is rostered, and seq is newer', () => {
    const s = state('host-seat', ['host-seat', 'me']);
    expect(
      shouldAcceptGameStateUpdate('host-peer', s, {
        seatId: 'me',
        lockedHostPeerId: 'host-peer',
        lastSeq: 0,
      }),
    ).toBe(true);
  });

  it('accepts a spectator who is not on the player roster', () => {
    const s = state('host-seat', ['host-seat'], {
      spectators: [{ id: 'watch', name: 'Alpha' }],
    });
    expect(
      shouldAcceptGameStateUpdate('host-peer', s, {
        seatId: 'watch',
        lockedHostPeerId: 'host-peer',
        lastSeq: 0,
      }),
    ).toBe(true);
  });

  it('rejects when the viewer is neither player nor spectator', () => {
    const s = state('host-seat', ['host-seat', 'someone-else']);
    expect(
      shouldAcceptGameStateUpdate('host-peer', s, {
        seatId: 'me',
        lockedHostPeerId: 'host-peer',
        lastSeq: 0,
      }),
    ).toBe(false);
  });

  it('rejects stale or duplicate stateSeq', () => {
    const s = state('host-seat', ['host-seat', 'me'], { stateSeq: 3 });
    expect(
      shouldAcceptGameStateUpdate('host-peer', s, {
        seatId: 'me',
        lockedHostPeerId: 'host-peer',
        lastSeq: 3,
      }),
    ).toBe(false);
    expect(
      shouldAcceptGameStateUpdate('host-peer', s, {
        seatId: 'me',
        lockedHostPeerId: 'host-peer',
        lastSeq: 4,
      }),
    ).toBe(false);
    expect(
      shouldAcceptGameStateUpdate('host-peer', s, {
        seatId: 'me',
        lockedHostPeerId: 'host-peer',
        lastSeq: 2,
      }),
    ).toBe(true);
  });

  it('after lock, ignores a different peer even if they claim to be host in the payload', () => {
    const forged = state('attacker', ['attacker', 'me'], {
      phase: GamePhase.Discussion,
      players: [
        { id: 'attacker', name: 'Attacker', role: Role.Mole, connected: true },
        { id: 'me', name: 'me', role: Role.Police, connected: true },
      ],
      stateSeq: 9,
    });
    expect(
      shouldAcceptGameStateUpdate('attacker', forged, {
        seatId: 'me',
        lockedHostPeerId: 'host-peer',
        lastSeq: 0,
      }),
    ).toBe(false);
  });
});
