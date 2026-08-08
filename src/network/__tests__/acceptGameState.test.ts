import { describe, expect, it } from 'vitest';
import { GamePhase, Role, type GameState, type PlayerId } from '../../types/game';
import { shouldAcceptGameStateUpdate } from '../acceptGameState';

function state(hostId: PlayerId, playerIds: PlayerId[], roles: Array<string | null> = []): GameState {
  return {
    phase: roles.some(Boolean) ? GamePhase.Discussion : GamePhase.Lobby,
    players: playerIds.map((id, i) => ({
      id,
      name: id,
      role: (roles[i] as GameState['players'][number]['role']) ?? null,
    })),
    hostId,
    currentRound: 1,
    scores: { police: 0, moles: 0 },
    raidResults: [],
    proposerIndex: 0,
    consecutiveRejections: 0,
    currentProposedTeam: [],
    teamVotes: {},
    raidActions: {},
    winner: null,
  };
}

describe('shouldAcceptGameStateUpdate', () => {
  it('rejects when transport sender is not state.hostId', () => {
    const s = state('host', ['host', 'me']);
    expect(
      shouldAcceptGameStateUpdate('attacker', s, { viewerId: 'me', lockedHostId: null }),
    ).toBe(false);
  });

  it('accepts the first seat when from matches hostId and viewer is rostered', () => {
    const s = state('host', ['host', 'me']);
    expect(
      shouldAcceptGameStateUpdate('host', s, { viewerId: 'me', lockedHostId: null }),
    ).toBe(true);
  });

  it('rejects first seat when viewer is not in the roster', () => {
    const s = state('host', ['host', 'someone-else']);
    expect(
      shouldAcceptGameStateUpdate('host', s, { viewerId: 'me', lockedHostId: null }),
    ).toBe(false);
  });

  it('after lock, ignores a different peer even if they claim to be host in the payload', () => {
    const forged = state('attacker', ['attacker', 'me'], [Role.Mole, Role.Police]);
    expect(
      shouldAcceptGameStateUpdate('attacker', forged, {
        viewerId: 'me',
        lockedHostId: 'host',
      }),
    ).toBe(false);
  });

  it('after lock, accepts further updates only from the locked host', () => {
    const s = state('host', ['host', 'me'], [Role.Police, Role.Mole]);
    expect(
      shouldAcceptGameStateUpdate('host', s, { viewerId: 'me', lockedHostId: 'host' }),
    ).toBe(true);
  });
});
