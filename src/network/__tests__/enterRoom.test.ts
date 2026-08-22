import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, PlayerId } from '../../types/game';
import { GamePhase } from '../../types/game';
import type { NetworkMessage, NetworkService, SeatKind } from '../../types/network';
import {
  JOIN_RETRY_MS,
  JOIN_TIMEOUT_MS,
  JoinLobbyError,
  enterRoom,
} from '../enterRoom';

function lobbyState(playerIds: PlayerId[], spectators: PlayerId[] = [], seq = 1): GameState {
  return {
    phase: GamePhase.Lobby,
    players: playerIds.map((id) => ({ id, name: id, role: null, connected: true })),
    spectators: spectators.map((id) => ({ id, name: id })),
    hostId: playerIds[0]!,
    stateSeq: seq,
    currentRound: 1,
    scores: { police: 0, moles: 0 },
    raidResults: [],
    proposerIndex: 0,
    consecutiveRejections: 0,
    currentProposedTeam: [],
    teamVotes: {},
    raidActions: {},
    winner: null,
    timersEnabled: false,
    advancedBotsEnabled: true,
    phaseEndsAt: null,
  };
}

class FakeNetwork implements NetworkService {
  isHost = false;
  playerId: PlayerId | null = null;
  roomCode: string | null = null;

  sent: Array<{ to: PlayerId; message: NetworkMessage }> = [];
  disconnects = 0;

  private handler: ((from: PlayerId, message: NetworkMessage) => void) | null = null;
  private readonly assignedId: PlayerId;
  readonly hostPeerId: PlayerId;

  constructor(assignedId: PlayerId = 'peer-me', hostPeerId: PlayerId = 'host-peer') {
    this.assignedId = assignedId;
    this.hostPeerId = hostPeerId;
  }

  initializeAsHost(): Promise<string> {
    throw new Error('not used');
  }

  async initializeAsClient(roomCode: string): Promise<PlayerId> {
    this.roomCode = roomCode;
    this.playerId = this.assignedId;
    return this.assignedId;
  }

  async disconnect(): Promise<void> {
    this.disconnects++;
    this.playerId = null;
    this.roomCode = null;
  }

  sendMessage(to: PlayerId, message: NetworkMessage): void {
    this.sent.push({ to, message });
  }

  broadcast(message: NetworkMessage): void {
    this.sent.push({ to: this.assignedId, message });
  }

  onMessage(handler: (from: PlayerId, message: NetworkMessage) => void): void {
    this.handler = handler;
  }

  onConnection(): void {}
  onDisconnect(): void {}

  hostSend(message: NetworkMessage) {
    this.handler?.(this.hostPeerId, message);
  }

  peerPublish(from: PlayerId, message: NetworkMessage) {
    this.handler?.(from, message);
  }
}

function seat(network: FakeNetwork, seatId: PlayerId, kind: SeatKind = 'player', seq = 1) {
  const players = kind === 'player' ? ['host-seat', seatId] : ['host-seat'];
  const spectators = kind === 'spectator' ? [seatId] : [];
  network.hostSend({
    type: 'JOIN_RESPONSE',
    payload: { seatId, secret: 'sekrit', kind },
  });
  network.hostSend({
    type: 'GAME_STATE_UPDATE',
    payload: lobbyState(players, spectators, seq),
  });
}

describe('enterRoom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes JOIN_REQUEST without a secret, then seats on JOIN_RESPONSE + state', async () => {
    const network = new FakeNetwork();
    const states: GameState[] = [];

    const pending = enterRoom(network, 'PR01', { name: 'Bravo', onGameState: (s) => states.push(s) });
    await vi.advanceTimersByTimeAsync(0);

    expect(network.sent).toEqual([
      { to: 'peer-me', message: { type: 'JOIN_REQUEST', payload: { name: 'Bravo' } } },
    ]);
    expect(JSON.stringify(network.sent)).not.toContain('sekrit');

    seat(network, 'seat-me');

    await expect(pending).resolves.toEqual({
      seatId: 'seat-me',
      roomCode: 'PR01',
      state: lobbyState(['host-seat', 'seat-me']),
      secret: 'sekrit',
      kind: 'player',
      hostPeerId: 'host-peer',
    });
    expect(states).toHaveLength(1);
    expect(network.disconnects).toBe(0);
  });

  it('seats a spectator when the host lists them only in spectators', async () => {
    const network = new FakeNetwork();
    const pending = enterRoom(network, 'PR01', { name: 'Alpha', onGameState: () => {} });
    await vi.advanceTimersByTimeAsync(0);
    seat(network, 'seat-watch', 'spectator');
    await expect(pending).resolves.toMatchObject({
      seatId: 'seat-watch',
      kind: 'spectator',
    });
  });

  it('reclaims with a direct send to the stored host peer, never on the channel', async () => {
    const network = new FakeNetwork();
    const pending = enterRoom(network, 'PR01', {
      name: 'Bravo',
      session: {
        seatId: 'seat-me',
        secret: 'sekrit',
        hostPeerId: 'host-peer',
        kind: 'player',
      },
      onGameState: () => {},
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(network.sent).toEqual([
      {
        to: 'host-peer',
        message: { type: 'RECLAIM', payload: { seatId: 'seat-me', secret: 'sekrit' } },
      },
    ]);
    expect(network.sent.some((s) => s.to === 'peer-me')).toBe(false);

    network.hostSend({
      type: 'GAME_STATE_UPDATE',
      payload: lobbyState(['host-seat', 'seat-me'], [], 4),
    });

    await expect(pending).resolves.toMatchObject({
      seatId: 'seat-me',
      secret: 'sekrit',
      hostPeerId: 'host-peer',
    });
  });

  it('does not fall back to JOIN_REQUEST when reclaim is unanswered', async () => {
    const network = new FakeNetwork();
    const pending = enterRoom(network, 'PR01', {
      name: 'Bravo',
      session: {
        seatId: 'seat-me',
        secret: 'sekrit',
        hostPeerId: 'host-peer',
        kind: 'player',
      },
      onGameState: () => {},
    });
    const assertion = expect(pending).rejects.toThrow(JoinLobbyError);
    await vi.advanceTimersByTimeAsync(JOIN_TIMEOUT_MS);
    await assertion;
    expect(network.sent.every((s) => s.message.type === 'RECLAIM')).toBe(true);
    expect(network.disconnects).toBe(1);
  });

  it('ignores host states this player is not in, then fails and disconnects', async () => {
    const network = new FakeNetwork();
    const states: GameState[] = [];

    const pending = enterRoom(network, 'PR01', { name: 'Me', onGameState: (s) => states.push(s) });
    const assertion = expect(pending).rejects.toThrow(JoinLobbyError);
    await vi.advanceTimersByTimeAsync(0);

    network.hostSend({
      type: 'JOIN_RESPONSE',
      payload: { seatId: 'seat-me', secret: 'sekrit', kind: 'player' },
    });
    network.hostSend({
      type: 'GAME_STATE_UPDATE',
      payload: lobbyState(['host-seat', 'someone-else']),
    });
    await vi.advanceTimersByTimeAsync(JOIN_TIMEOUT_MS);

    await assertion;
    expect(states).toEqual([]);
    expect(network.disconnects).toBe(1);
  });

  it('re-sends JOIN_REQUEST while waiting', async () => {
    const network = new FakeNetwork();

    const pending = enterRoom(network, 'PR01', { name: 'Me', onGameState: () => {} });
    const assertion = expect(pending).rejects.toMatchObject({ failure: 'NO_HOST_RESPONSE' });

    await vi.advanceTimersByTimeAsync(JOIN_RETRY_MS);
    expect(network.sent).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(JOIN_TIMEOUT_MS);
    await assertion;

    const afterFailure = network.sent.length;
    await vi.advanceTimersByTimeAsync(JOIN_RETRY_MS * 3);
    expect(network.sent).toHaveLength(afterFailure);
  });

  it('ignores GAME_STATE_UPDATE before JOIN_RESPONSE has locked the host peer', async () => {
    const network = new FakeNetwork();
    const states: GameState[] = [];

    const pending = enterRoom(network, 'PR01', { name: 'Me', onGameState: (s) => states.push(s) });
    const assertion = expect(pending).rejects.toThrow(JoinLobbyError);
    await vi.advanceTimersByTimeAsync(0);

    network.peerPublish('attacker', {
      type: 'GAME_STATE_UPDATE',
      payload: lobbyState(['host-seat', 'seat-me']),
    });
    await vi.advanceTimersByTimeAsync(JOIN_TIMEOUT_MS);

    await assertion;
    expect(states).toEqual([]);
  });

  it('after seating, ignores forged updates from another room subscriber', async () => {
    const network = new FakeNetwork();
    const states: GameState[] = [];

    const pending = enterRoom(network, 'PR01', { name: 'Me', onGameState: (s) => states.push(s) });
    await vi.advanceTimersByTimeAsync(0);

    seat(network, 'seat-me');
    await expect(pending).resolves.toMatchObject({ seatId: 'seat-me' });

    const forged = lobbyState(['attacker', 'seat-me'], [], 2);
    forged.hostId = 'attacker';
    forged.phase = GamePhase.Discussion;
    forged.players = [
      { id: 'attacker', name: 'Attacker', role: 'Mole', connected: true },
      { id: 'seat-me', name: 'me', role: 'Police', connected: true },
    ];
    network.peerPublish('attacker', { type: 'GAME_STATE_UPDATE', payload: forged });
    network.peerPublish('attacker', {
      type: 'GAME_STATE_UPDATE',
      payload: {
        ...lobbyState(['host-seat', 'seat-me'], [], 2),
        phase: GamePhase.Discussion,
        players: lobbyState(['host-seat', 'seat-me']).players.map((p) => ({
          ...p,
          role: 'Mole' as const,
        })),
      },
    });

    expect(states).toHaveLength(1);
  });

  it('ignores a duplicate snapshot with the same stateSeq', async () => {
    const network = new FakeNetwork();
    const states: GameState[] = [];
    const pending = enterRoom(network, 'PR01', { name: 'Me', onGameState: (s) => states.push(s) });
    await vi.advanceTimersByTimeAsync(0);
    seat(network, 'seat-me', 'player', 5);
    await pending;
    network.hostSend({
      type: 'GAME_STATE_UPDATE',
      payload: lobbyState(['host-seat', 'seat-me'], [], 5),
    });
    network.hostSend({
      type: 'GAME_STATE_UPDATE',
      payload: lobbyState(['host-seat', 'seat-me'], [], 6),
    });
    expect(states.map((s) => s.stateSeq)).toEqual([5, 6]);
  });
});
