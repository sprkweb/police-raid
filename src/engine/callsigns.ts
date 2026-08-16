import { MAX_CALLSIGN_LENGTH } from './constants';
import type { RandomFn } from './rng';

/** NATO phonetic — canonical in-game names so EN/RU clients share one roster. */
export const NATO_CALLSIGNS = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliet',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
  'Whiskey',
  'X-ray',
  'Yankee',
  'Zulu',
] as const;

export function normalizeCallsign(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_CALLSIGN_LENGTH);
}

function takenSet(takenNames: Iterable<string>): Set<string> {
  return new Set([...takenNames].map((n) => n.toLowerCase()));
}

/** Pick a NATO callsign not in `takenNames`, then `Alpha-2`, `Bravo-2`, … */
export function pickUnusedCallsign(
  takenNames: Iterable<string>,
  random: RandomFn = Math.random,
): string {
  const taken = takenSet(takenNames);
  const unused = NATO_CALLSIGNS.filter((name) => !taken.has(name.toLowerCase()));
  if (unused.length > 0) {
    return unused[Math.floor(random() * unused.length)]!;
  }
  for (let n = 2; n < 1000; n++) {
    for (const base of NATO_CALLSIGNS) {
      const candidate = `${base}-${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }
  return `Alpha-${Date.now()}`;
}

export function randomCallsign(random: RandomFn = Math.random): string {
  return NATO_CALLSIGNS[Math.floor(random() * NATO_CALLSIGNS.length)]!;
}

/**
 * Use `desired` when free; otherwise the next unused NATO name / suffix.
 * Empty desired falls through to `pickUnusedCallsign`.
 */
export function uniquifyCallsign(
  desired: string,
  takenNames: Iterable<string>,
  random: RandomFn = Math.random,
): string {
  const taken = takenSet(takenNames);
  const base = normalizeCallsign(desired);
  if (base && !taken.has(base.toLowerCase())) return base;
  return pickUnusedCallsign(takenNames, random);
}
