import { describe, expect, it, vi } from 'vitest';
import { GamePhase } from '../../types/game';
import { MAX_PLAYERS, MIN_PLAYERS } from '../constants';
import { HostRoom } from '../hostRoom';
import { fillLobby } from './helpers';

function createHost(hostName = 'Ada') {
  let seq = 0;
  let secrets = 0;
  const room = new HostRoom(
    'host-peer',
    hostName,
    () => {},
    {
      timersEnabled: false,
      createSeatId: () => `seat-${++seq}`,
      createSecret: () => `secret-${++secrets}`,
      graceMs: 15_000,
    },
  );
  return room;
}

describe('HostRoom seating', () => {
  it('seats a new peer as a player in lobby and issues a secret', () => {
    const room = createHost();
    const response = room.handleJoinRequest('peer-a', 'Bravo');
    expect(response).toEqual({ seatId: 'seat-2', secret: 'secret-2', kind: 'player' });
    expect(room.engine.getState().players.map((p) => p.id)).toEqual(['seat-1', 'seat-2']);
    expect(room.engine.getState().players[1]?.name).toBe('Bravo');
    expect(room.seats.peerIdForSeat('seat-2')).toBe('peer-a');
  });

  it('retries JOIN_REQUEST from the same peer without creating a second seat', () => {
    const room = createHost();
    const first = room.handleJoinRequest('peer-a', 'Bravo');
    const second = room.handleJoinRequest('peer-a', 'Charlie');
    expect(second).toEqual(first);
    expect(room.engine.getState().players).toHaveLength(2);
  });

  it('seats overflow and mid-game joiners as spectators', () => {
    const room = createHost();
    for (let i = 0; i < MAX_PLAYERS - 1; i++) {
      room.handleJoinRequest(`peer-${i}`, `P${i}`);
    }
    expect(room.engine.getState().players).toHaveLength(MAX_PLAYERS);
    const overflow = room.handleJoinRequest('peer-full', 'Watch');
    expect(overflow?.kind).toBe('spectator');
    expect(room.engine.getState().spectators).toHaveLength(1);

    const playing = createHost();
    fillLobby(playing.engine, MIN_PLAYERS);
    playing.engine.startGame();
    const late = playing.handleJoinRequest('peer-late', 'Alpha');
    expect(late?.kind).toBe('spectator');
    expect(playing.engine.getState().phase).toBe(GamePhase.Discussion);
    expect(playing.engine.getState().players).toHaveLength(MIN_PLAYERS);
    expect(playing.engine.getState().spectators[0]?.name).toBe('Alpha');
  });

  it('reclaims a seat with the correct secret and remaps the peer', () => {
    const room = createHost();
    const joined = room.handleJoinRequest('peer-a', 'Bravo')!;
    room.handleDisconnect('peer-a');
    expect(room.engine.getState().players.find((p) => p.id === joined.seatId)?.connected).toBe(false);

    expect(room.handleReclaim('peer-b', { seatId: joined.seatId, secret: 'wrong' })).toBeNull();
    expect(room.seats.peerIdForSeat(joined.seatId)).toBeNull();

    const reclaimed = room.handleReclaim('peer-b', {
      seatId: joined.seatId,
      secret: joined.secret,
    });
    expect(reclaimed).toEqual(joined);
    expect(room.seats.peerIdForSeat(joined.seatId)).toBe('peer-b');
    expect(room.engine.getState().players.find((p) => p.id === joined.seatId)?.connected).toBe(true);
    expect(room.engine.getState().players).toHaveLength(2);
  });

  it('last valid claim wins: a second tab with the secret takes the seat', () => {
    const room = createHost();
    const joined = room.handleJoinRequest('peer-a', 'Bravo')!;
    room.handleReclaim('peer-b', { seatId: joined.seatId, secret: joined.secret });
    expect(room.seats.peerIdForSeat(joined.seatId)).toBe('peer-b');
    room.handleDisconnect('peer-a');
    expect(room.seats.peerIdForSeat(joined.seatId)).toBe('peer-b');
    expect(room.engine.getState().players.find((p) => p.id === joined.seatId)?.connected).toBe(true);
  });

  it('drops a lobby seat after the grace period, then the secret no longer works', () => {
    vi.useFakeTimers();
    try {
      const room = createHost();
      const joined = room.handleJoinRequest('peer-a', 'Bravo')!;
      room.handleDisconnect('peer-a');
      expect(room.engine.getState().players.map((p) => p.id)).toContain(joined.seatId);

      vi.advanceTimersByTime(14_999);
      expect(room.engine.getState().players.map((p) => p.id)).toContain(joined.seatId);

      vi.advanceTimersByTime(1);
      expect(room.engine.getState().players.map((p) => p.id)).not.toContain(joined.seatId);
      expect(room.handleReclaim('peer-b', { seatId: joined.seatId, secret: joined.secret })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a disconnected lobby seat when the host starts with enough live officers', () => {
    const room = createHost();
    for (let i = 0; i < MIN_PLAYERS; i++) {
      room.handleJoinRequest(`peer-${i}`, `P${i}`);
    }
    const ghost = room.handleJoinRequest('peer-ghost', 'Ghost')!;
    expect(room.engine.getState().players).toHaveLength(MIN_PLAYERS + 2);

    room.handleDisconnect('peer-ghost');
    room.handleAction('host-peer', { type: 'START_GAME' });

    expect(room.engine.getState().phase).toBe(GamePhase.Discussion);
    expect(room.engine.getState().players.map((p) => p.id)).not.toContain(ghost.seatId);
    expect(room.seats.bySeatId(ghost.seatId)).toBeUndefined();
    expect(room.handleReclaim('peer-back', { seatId: ghost.seatId, secret: ghost.secret })).toBeNull();
  });
});

describe('HostRoom actions', () => {
  it('renames a player over the host action path', () => {
    const room = createHost();
    const joined = room.handleJoinRequest('peer-a', 'Bravo')!;
    room.handleAction('peer-a', { type: 'RENAME', name: 'Kilo' });
    expect(room.engine.getState().players.find((p) => p.id === joined.seatId)?.name).toBe('Kilo');
  });

  it('ignores PLAYER_ACTION from spectators except rename', () => {
    const room = createHost();
    fillLobby(room.engine, MIN_PLAYERS);
    room.engine.startGame();
    const spec = room.handleJoinRequest('peer-watch', 'Alpha')!;
    expect(spec.kind).toBe('spectator');

    room.handleAction('peer-watch', { type: 'START_GAME' });
    expect(room.engine.getState().phase).toBe(GamePhase.Discussion);

    room.handleAction('peer-watch', { type: 'RENAME', name: 'Kilo' });
    expect(room.engine.getState().spectators[0]?.name).toBe('Kilo');
  });
});
