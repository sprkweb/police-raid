/** Treat probabilities at or below this as zero. */
export const ZERO_EPS = 1e-12

/** All k-subsets of `items`, in lexicographic index order. */
export function combinations<T>(items: readonly T[], k: number): T[][] {
    if (k < 0 || k > items.length) return []
    if (k === 0) return [[]]

    const result: T[][] = []
    const acc: T[] = []

    const rec = (start: number) => {
        if (acc.length === k) {
            result.push([...acc])
            return
        }
        const need = k - acc.length
        for (let i = start; i <= items.length - need; i++) {
            acc.push(items[i]!)
            rec(i + 1)
            acc.pop()
        }
    }

    rec(0)
    return result
}
