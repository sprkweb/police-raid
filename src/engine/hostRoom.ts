import type { GameState, PlayerId } from '../types/game';
import { GamePhase } from '../types/game';
import type { JoinResponsePayload, PlayerActionPayload, ReclaimPayload } from '../types/network';
import { uniquifyCallsign } from './callsigns';
import { LOBBY_DISCONNECT_GRACE_MS } from './constants';
import { applyPlayerAction } from './applyAction';
import { GameEngine, type GameEngineOptions } from './GameEngine';
import { generateSeatId, generateSecret } from './ids';
import { SeatDirectory } from './seatDirectory';

export interface HostRoomOptions extends GameEngineOptions {
  createSeatId?: () => PlayerId;
  createSecret?: () => string;
  graceMs?: number;
}

/**
 * Host-side seating: maps transport peers to stable seats, issues reclaim
 * secrets, and owns the lobby disconnect grace timer.
 */
export class HostRoom {
  public readonly engine: GameEngine;
  public readonly seats = new SeatDirectory();
  public readonly hostSeatId: PlayerId;
  public readonly hostPeerId: PlayerId;

  private readonly createSeatId: () => PlayerId;
  private readonly createSecret: () => string;
  private readonly graceMs: number;
  private readonly graceTimers = new Map<PlayerId, ReturnType<typeof setTimeout>>();

  constructor(
    hostPeerId: PlayerId,
    hostName: string,
    onStateChange: (state: GameState) => void,
    options: HostRoomOptions = {},
  ) {
    this.hostPeerId = hostPeerId;
    this.createSeatId = options.createSeatId ?? generateSeatId;
    this.createSecret = options.createSecret ?? generateSecret;
    this.graceMs = options.graceMs ?? LOBBY_DISCONNECT_GRACE_MS;
    this.hostSeatId = this.createSeatId();

    const engineOptions: GameEngineOptions = {
      random: options.random,
      now: options.now,
      timersEnabled: options.timersEnabled,
      advancedBotsEnabled: options.advancedBotsEnabled,
      botBrain: options.botBrain,
      voteResultDurationMs: options.voteResultDurationMs,
      roundEndDurationMs: options.roundEndDurationMs,
    };
    this.engine = new GameEngine(this.hostSeatId, hostName, onStateChange, engineOptions);

    this.seats.add({
      seatId: this.hostSeatId,
      secret: this.createSecret(),
      peerId: hostPeerId,
      kind: 'player',
      name: hostName,
    });
  }

  public seatIdForPeer(peerId: PlayerId): PlayerId | null {
    return this.seats.byPeerId(peerId)?.seatId ?? null;
  }

  public handleJoinRequest(peerId: PlayerId, rawName: string): JoinResponsePayload | null {
    const existing = this.seats.byPeerId(peerId);
    if (existing) {
      return {
        seatId: existing.seatId,
        secret: existing.secret,
        kind: existing.kind,
      };
    }

    const name = uniquifyCallsign(rawName, this.engine.takenNames());
    const seatId = this.createSeatId();
    const secret = this.createSecret();
    const asPlayer = this.engine.canAddPlayer();
    const kind = asPlayer ? 'player' : 'spectator';

    this.seats.add({ seatId, secret, peerId, kind, name });
    if (asPlayer) this.engine.addPlayer(seatId, name);
    else this.engine.addSpectator(seatId, name);

    return { seatId, secret, kind };
  }

  public handleReclaim(peerId: PlayerId, payload: ReclaimPayload): JoinResponsePayload | null {
    const record = this.seats.reclaim(payload.seatId, payload.secret, peerId);
    if (!record) return null;

    this.clearGrace(record.seatId);

    if (record.kind === 'player') {
      this.engine.setPlayerConnected(record.seatId, true);
    } else {
      const state = this.engine.getState();
      const seated = state.spectators.some((s) => s.id === record.seatId);
      if (!seated) this.engine.addSpectator(record.seatId, record.name);
    }

    return { seatId: record.seatId, secret: record.secret, kind: record.kind };
  }

  public handleDisconnect(peerId: PlayerId): void {
    const record = this.seats.byPeerId(peerId);
    if (!record || record.peerId !== peerId) return;
    if (record.seatId === this.hostSeatId) return;

    this.seats.clearPeer(record.seatId);

    if (record.kind === 'spectator') {
      this.engine.removeSpectator(record.seatId);
      return;
    }

    this.engine.setPlayerConnected(record.seatId, false);
    if (this.engine.getState().phase === GamePhase.Lobby) {
      this.armGrace(record.seatId);
    }
  }

  public handleAction(peerId: PlayerId, payload: PlayerActionPayload): void {
    const record = this.seats.byPeerId(peerId);
    if (!record) return;

    if (payload.type === 'RENAME') {
      if (this.engine.rename(record.seatId, payload.name)) {
        const state = this.engine.getState();
        const named =
          state.players.find((p) => p.id === record.seatId) ??
          state.spectators.find((s) => s.id === record.seatId);
        if (named) this.seats.updateName(record.seatId, named.name);
      }
      return;
    }

    if (record.kind !== 'player') return;
    applyPlayerAction(this.engine, record.seatId, payload);
    if (payload.type === 'START_GAME') this.pruneOrphanPlayerSeats();
  }

  /** Pad with bots and start; drop seat secrets for lobby grace seats the engine dropped. */
  public startGameWithBots(): void {
    this.engine.startGameWithBots();
    this.pruneOrphanPlayerSeats();
  }

  public dispose(): void {
    for (const id of this.graceTimers.keys()) this.clearGrace(id);
  }

  /** Rematch may swap departed humans for bots; drop those seats so secrets die. */
  private pruneOrphanPlayerSeats(): void {
    const live = new Set(this.engine.getState().players.map((p) => p.id));
    for (const record of this.seats.all()) {
      if (record.kind !== 'player') continue;
      if (record.seatId === this.hostSeatId) continue;
      if (!live.has(record.seatId)) {
        this.clearGrace(record.seatId);
        this.seats.drop(record.seatId);
      }
    }
  }

  private armGrace(seatId: PlayerId): void {
    this.clearGrace(seatId);
    const timer = setTimeout(() => {
      this.graceTimers.delete(seatId);
      const record = this.seats.bySeatId(seatId);
      if (!record || record.peerId) return;
      if (this.engine.getState().phase !== GamePhase.Lobby) return;
      this.engine.removePlayer(seatId);
      this.seats.drop(seatId);
    }, this.graceMs);
    this.graceTimers.set(seatId, timer);
  }

  private clearGrace(seatId: PlayerId): void {
    const timer = this.graceTimers.get(seatId);
    if (timer != null) {
      clearTimeout(timer);
      this.graceTimers.delete(seatId);
    }
  }
}
