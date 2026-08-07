import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, PlayerId } from '../../types/game';
import { GamePhase } from '../../types/game';
import type { NetworkMessage, NetworkService } from '../../types/network';
import { JOIN_RETRY_MS, JOIN_TIMEOUT_MS, JoinLobbyError, joinLobby } from '../joinLobby';

function lobbyState(playerIds: PlayerId[]): GameState {
  return {
    phase: GamePhase.Lobby,
    players: playerIds.map((id) => ({ id, name: id, role: null })),
    hostId: playerIds[0]!,
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

/** Transport stub: records outbound messages, lets tests fake host broadcasts. */
class FakeNetwork implements NetworkService {
  isHost = false;
  playerId: PlayerId | null = null;
  roomCode: string | null = null;

  sent: NetworkMessage[] = [];
  disconnects = 0;

  private handler: ((from: PlayerId, message: NetworkMessage) => void) | null = null;
  private readonly assignedId: PlayerId;

  constructor(assignedId: PlayerId = 'me') {
    this.assignedId = assignedId;
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

  sendMessage(_to: PlayerId, message: NetworkMessage): void {
    this.sent.push(message);
  }

  broadcast(message: NetworkMessage): void {
    this.sent.push(message);
  }

  onMessage(handler: (from: PlayerId, message: NetworkMessage) => void): void {
    this.handler = handler;
  }

  onConnection(): void {}
  onDisconnect(): void {}

  /** Simulate the host sending this client a (projected) game state. */
  hostBroadcast(state: GameState) {
    this.handler?.(state.hostId, { type: 'GAME_STATE_UPDATE', payload: state });
  }
}

describe('joinLobby', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves once the host sends a state containing this player', async () => {
    const network = new FakeNetwork();
    const states: GameState[] = [];

    const pending = joinLobby(network, 'PR01', 'Me', (state) => states.push(state));
    await vi.advanceTimersByTimeAsync(0);

    expect(network.sent).toEqual([{ type: 'JOIN_REQUEST', payload: { name: 'Me' } }]);

    const seated = lobbyState(['host', 'me']);
    network.hostBroadcast(seated);

    await expect(pending).resolves.toEqual({ playerId: 'me', roomCode: 'PR01', state: seated });
    expect(states).toEqual([seated]);
    expect(network.disconnects).toBe(0);
  });

  it('ignores host states this player is not in, then fails and disconnects', async () => {
    const network = new FakeNetwork();
    const states: GameState[] = [];

    const pending = joinLobby(network, 'PR01', 'Me', (state) => states.push(state));
    const assertion = expect(pending).rejects.toThrow(JoinLobbyError);
    await vi.advanceTimersByTimeAsync(0);

    // A game already in progress keeps sending updates, but never seats us.
    network.hostBroadcast(lobbyState(['host', 'someone-else']));
    await vi.advanceTimersByTimeAsync(JOIN_TIMEOUT_MS);

    await assertion;
    expect(states).toEqual([]);
    expect(network.disconnects).toBe(1);
  });

  it('re-sends JOIN_REQUEST while waiting', async () => {
    const network = new FakeNetwork();

    const pending = joinLobby(network, 'PR01', 'Me', () => {});
    const assertion = expect(pending).rejects.toMatchObject({ failure: 'NO_HOST_RESPONSE' });

    await vi.advanceTimersByTimeAsync(JOIN_RETRY_MS);
    expect(network.sent).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(JOIN_TIMEOUT_MS);
    await assertion;

    // No retries keep firing after the failure.
    const afterFailure = network.sent.length;
    await vi.advanceTimersByTimeAsync(JOIN_RETRY_MS * 3);
    expect(network.sent).toHaveLength(afterFailure);
  });
});
