import { describe, expect, it, vi } from 'vitest';
import { GamePhase, Role, type GameState, type PlayerId } from '../../types/game';
import type { NetworkMessage } from '../../types/network';
import { BOT_ID_PREFIX } from '../constants';
import { distributeProjectedState } from '../distributeProjectedState';
import { createInitialState } from '../rules';

function playingState(): GameState {
  const state = createInitialState('host', 'Host');
  state.players = [
    { id: 'host', name: 'Host', role: Role.Police },
    { id: 'mole1', name: 'Mole One', role: Role.Mole },
    { id: 'cop2', name: 'Cop Two', role: Role.Police },
    { id: `${BOT_ID_PREFIX}1`, name: 'Bot 1', role: Role.Mole },
  ];
  state.phase = GamePhase.VotingOnTeam;
  state.teamVotes = { host: 'Approve', mole1: 'Reject', cop2: 'Approve' };
  state.raidActions = {};
  return state;
}

function roleOf(state: GameState, id: PlayerId) {
  return state.players.find((p) => p.id === id)?.role ?? null;
}

describe('distributeProjectedState', () => {
  it('unicasts a redacted view to each human peer except the host and bots', () => {
    const sent: Array<{ to: PlayerId; message: NetworkMessage }> = [];
    const network = {
      isHost: true,
      playerId: 'host' as PlayerId,
      sendMessage: (to: PlayerId, message: NetworkMessage) => {
        sent.push({ to, message });
      },
    };

    distributeProjectedState(network, playingState());

    expect(sent.map((s) => s.to).sort()).toEqual(['cop2', 'mole1']);

    const toCop = sent.find((s) => s.to === 'cop2')!.message.payload as GameState;
    expect(roleOf(toCop, 'cop2')).toBe(Role.Police);
    expect(roleOf(toCop, 'mole1')).toBeNull();
    expect(roleOf(toCop, 'host')).toBeNull();
    expect(toCop.teamVotes).toEqual({
      host: null,
      mole1: null,
      cop2: 'Approve',
    });

    const toMole = sent.find((s) => s.to === 'mole1')!.message.payload as GameState;
    expect(roleOf(toMole, 'mole1')).toBe(Role.Mole);
    expect(roleOf(toMole, `${BOT_ID_PREFIX}1`)).toBe(Role.Mole);
    expect(roleOf(toMole, 'host')).toBeNull();
    expect(toMole.teamVotes.mole1).toBe('Reject');
    expect(toMole.teamVotes.host).toBeNull();
  });

  it('does nothing when not host', () => {
    const sendMessage = vi.fn();
    distributeProjectedState(
      { isHost: false, playerId: 'cop2', sendMessage },
      playingState(),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
