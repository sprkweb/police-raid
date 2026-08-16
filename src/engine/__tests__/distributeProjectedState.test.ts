import { describe, expect, it, vi } from 'vitest';
import { GamePhase, Role, type GameState, type PlayerId } from '../../types/game';
import type { NetworkMessage } from '../../types/network';
import { BOT_ID_PREFIX } from '../constants';
import { distributeProjectedState } from '../distributeProjectedState';
import { createInitialState } from '../rules';

function playingState(): GameState {
  const state = createInitialState('host', 'Host');
  state.players = [
    { id: 'host', name: 'Host', role: Role.Police, connected: true },
    { id: 'mole1', name: 'Mole One', role: Role.Mole, connected: true },
    { id: 'cop2', name: 'Cop Two', role: Role.Police, connected: true },
    { id: `${BOT_ID_PREFIX}1`, name: 'Bot 1', role: Role.Mole, connected: true },
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
      sendMessage: (to: PlayerId, message: NetworkMessage) => {
        sent.push({ to, message });
      },
    };
    const seats = {
      peerIdForSeat: (id: PlayerId) => id,
    };

    distributeProjectedState(network, playingState(), seats);

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
      { isHost: false, sendMessage },
      playingState(),
      { peerIdForSeat: (id) => id },
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('routes to the current peer id, not the seat id, and includes spectators', () => {
    const sent: Array<{ to: PlayerId; message: NetworkMessage }> = [];
    const network = {
      isHost: true,
      sendMessage: (to: PlayerId, message: NetworkMessage) => {
        sent.push({ to, message });
      },
    };
    const state = playingState();
    state.spectators = [{ id: 'seat-watch', name: 'Alpha' }];
    const seats = {
      peerIdForSeat: (id: PlayerId) => {
        if (id === 'mole1') return 'peer-mole';
        if (id === 'cop2') return 'peer-cop';
        if (id === 'seat-watch') return 'peer-watch';
        return null;
      },
    };

    distributeProjectedState(network, state, seats);

    expect(sent.map((s) => s.to).sort()).toEqual(['peer-cop', 'peer-mole', 'peer-watch']);
    const toWatch = sent.find((s) => s.to === 'peer-watch')!.message.payload as GameState;
    expect(roleOf(toWatch, 'mole1')).toBeNull();
    expect(roleOf(toWatch, 'cop2')).toBeNull();
  });

  it('skips seats with no live peer', () => {
    const sendMessage = vi.fn();
    distributeProjectedState(
      { isHost: true, sendMessage },
      playingState(),
      { peerIdForSeat: () => null },
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
