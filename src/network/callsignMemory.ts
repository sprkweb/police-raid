import { normalizeCallsign, randomCallsign } from '../engine/callsigns';
import type { RandomFn } from '../engine/rng';
import type { StorageLike } from './seatSession';

export const CALLSIGN_STORAGE_KEY = 'police-raid.callsign';

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadLastCallsign(
  storage: StorageLike | null = defaultStorage(),
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CALLSIGN_STORAGE_KEY);
    if (typeof raw !== 'string') return null;
    const name = normalizeCallsign(raw);
    return name || null;
  } catch {
    return null;
  }
}

export function saveLastCallsign(
  name: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  const normalized = normalizeCallsign(name);
  if (!normalized || !storage) return;
  try {
    storage.setItem(CALLSIGN_STORAGE_KEY, normalized);
  } catch {
    // Quota / private mode — next visit just gets a fresh random callsign.
  }
}

/** Confirmed field value, else the last saved callsign, else a random NATO name. */
export function preferredCallsign(
  entered?: string,
  random: RandomFn = Math.random,
  storage: StorageLike | null = defaultStorage(),
): string {
  const fromInput = normalizeCallsign(entered ?? '');
  if (fromInput) return fromInput;
  return loadLastCallsign(storage) || randomCallsign(random);
}

/** Prefill for the check-in input: remembered name, otherwise a random NATO name. */
export function defaultCallsignField(
  storage: StorageLike | null = defaultStorage(),
  random: RandomFn = Math.random,
): string {
  return loadLastCallsign(storage) || randomCallsign(random);
}
