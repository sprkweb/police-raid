import type { PlayerId } from '../types/game';
import type { SeatKind } from '../types/network';

export interface SeatRecord {
  seatId: PlayerId;
  secret: string;
  peerId: PlayerId | null;
  kind: SeatKind;
  name: string;
}

/**
 * Host-only routing: stable seat ↔ current transport peer + reclaim secret.
 * Must never be copied into projected `GameState`.
 */
export class SeatDirectory {
  private readonly bySeat = new Map<PlayerId, SeatRecord>();
  private readonly byPeer = new Map<PlayerId, PlayerId>();

  public add(record: SeatRecord): void {
    const existing = this.bySeat.get(record.seatId);
    if (existing?.peerId) this.byPeer.delete(existing.peerId);
    this.bySeat.set(record.seatId, record);
    if (record.peerId) {
      const previousSeat = this.byPeer.get(record.peerId);
      if (previousSeat && previousSeat !== record.seatId) {
        const other = this.bySeat.get(previousSeat);
        if (other) other.peerId = null;
      }
      this.byPeer.set(record.peerId, record.seatId);
    }
  }

  public bySeatId(seatId: PlayerId): SeatRecord | undefined {
    return this.bySeat.get(seatId);
  }

  public byPeerId(peerId: PlayerId): SeatRecord | undefined {
    const seatId = this.byPeer.get(peerId);
    return seatId ? this.bySeat.get(seatId) : undefined;
  }

  public peerIdForSeat(seatId: PlayerId): PlayerId | null {
    return this.bySeat.get(seatId)?.peerId ?? null;
  }

  public updateName(seatId: PlayerId, name: string): void {
    const record = this.bySeat.get(seatId);
    if (record) record.name = name;
  }

  public clearPeer(seatId: PlayerId): void {
    const record = this.bySeat.get(seatId);
    if (!record?.peerId) return;
    this.byPeer.delete(record.peerId);
    record.peerId = null;
  }

  /**
   * Bind `newPeerId` to this seat if the secret matches (last claim wins).
   * Returns null when the secret is wrong or the seat is unknown.
   */
  public reclaim(seatId: PlayerId, secret: string, newPeerId: PlayerId): SeatRecord | null {
    const record = this.bySeat.get(seatId);
    if (!record || record.secret !== secret) return null;

    if (record.peerId && record.peerId !== newPeerId) {
      this.byPeer.delete(record.peerId);
    }
    const previousSeat = this.byPeer.get(newPeerId);
    if (previousSeat && previousSeat !== seatId) {
      const other = this.bySeat.get(previousSeat);
      if (other) other.peerId = null;
    }
    record.peerId = newPeerId;
    this.byPeer.set(newPeerId, seatId);
    return record;
  }

  public drop(seatId: PlayerId): void {
    const record = this.bySeat.get(seatId);
    if (!record) return;
    if (record.peerId) this.byPeer.delete(record.peerId);
    this.bySeat.delete(seatId);
  }

  public all(): SeatRecord[] {
    return [...this.bySeat.values()];
  }
}
