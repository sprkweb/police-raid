/** All k-subsets of `items`, in lexicographic index order. */
export function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k < 0 || k > items.length) return [];
  if (k === 0) return [[]];

  const result: T[][] = [];
  const acc: T[] = [];

  const rec = (start: number) => {
    if (acc.length === k) {
      result.push([...acc]);
      return;
    }
    const need = k - acc.length;
    for (let i = start; i <= items.length - need; i++) {
      acc.push(items[i]!);
      rec(i + 1);
      acc.pop();
    }
  };

  rec(0);
  return result;
}

/** Exact for the small n used by bot world spaces (n ≤ 7). */
export function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= kk; i++) {
    result = (result * (n - kk + i)) / i;
  }
  return Math.round(result);
}
