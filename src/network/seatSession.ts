import type { PlayerId } from '../types/game';
import type { SeatKind } from '../types/network';
import { normalizeRoomCode } from './roomCode';

export interface SeatSession {
  seatId: PlayerId;
  secret: string;
  hostPeerId: PlayerId;
  kind: SeatKind;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'police-raid.seat.';

export function seatSessionKey(roomCode: string): string {
  return `${PREFIX}${normalizeRoomCode(roomCode)}`;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isSeatSession(value: unknown): value is SeatSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as SeatSession;
  return (
    typeof v.seatId === 'string' &&
    typeof v.secret === 'string' &&
    typeof v.hostPeerId === 'string' &&
    (v.kind === 'player' || v.kind === 'spectator')
  );
}

export function loadSeatSession(
  roomCode: string,
  storage: StorageLike | null = defaultStorage(),
): SeatSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(seatSessionKey(roomCode));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSeatSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSeatSession(
  roomCode: string,
  session: SeatSession,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(seatSessionKey(roomCode), JSON.stringify(session));
  } catch {
    // Quota / private mode — reconnect simply will not survive a reload.
  }
}

export function clearSeatSession(
  roomCode: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(seatSessionKey(roomCode));
  } catch {
    // ignore
  }
}
