import { describe, expect, it } from 'vitest';
import { NATO_CALLSIGNS } from '../../engine/callsigns';
import {
  CALLSIGN_STORAGE_KEY,
  defaultCallsignField,
  loadLastCallsign,
  preferredCallsign,
  saveLastCallsign,
} from '../callsignMemory';
import type { StorageLike } from '../seatSession';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe('callsignMemory', () => {
  it('returns null when nothing is stored', () => {
    expect(loadLastCallsign(memory())).toBeNull();
  });

  it('persists a trimmed callsign and prefers it over a random name', () => {
    const storage = memory();
    saveLastCallsign('  Kilo  ', storage);
    expect(storage.data.get(CALLSIGN_STORAGE_KEY)).toBe('Kilo');
    expect(loadLastCallsign(storage)).toBe('Kilo');
    expect(preferredCallsign('', () => 0, storage)).toBe('Kilo');
    expect(preferredCallsign('  Bravo  ', () => 0, storage)).toBe('Bravo');
  });

  it('prefills the field with the last name, otherwise a NATO callsign', () => {
    const storage = memory();
    expect(NATO_CALLSIGNS).toContain(defaultCallsignField(storage, () => 0));
    saveLastCallsign('Sierra', storage);
    expect(defaultCallsignField(storage, () => 0)).toBe('Sierra');
  });
});
