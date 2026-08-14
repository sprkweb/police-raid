import type { PlayerId } from '../types/game';

/** Stable seat id issued by the host. Independent of the transport peer id. */
export function generateSeatId(): PlayerId {
  return crypto.randomUUID();
}

/** Per-seat reclaim secret. Never put this in the URL or in projected state. */
export function generateSecret(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
