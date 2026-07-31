/** Returns a float in [0, 1). */
export type RandomFn = () => number;

/** Fisher–Yates shuffle; does not mutate the input. */
export function shuffle<T>(items: readonly T[], random: RandomFn): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Deterministic PRNG (mulberry32) for reproducible tests. */
export function createSeededRandom(seed: number): RandomFn {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns values from `sequence` in order, then `0`.
 * Useful when a test needs exact Fisher–Yates / proposer outcomes.
 */
export function createSequenceRandom(sequence: number[]): RandomFn {
  let index = 0;
  return () => {
    if (index < sequence.length) {
      return sequence[index++]!;
    }
    return 0;
  };
}
