import { describe, expect, it } from 'vitest'

import { combinations } from '../math'

describe('combinations', () => {
    it('enumerates subsets in index order without changing the input', () => {
        const items = Object.freeze(['C', 'A', 'B'])
        expect(combinations(items, 2)).toEqual([
            ['C', 'A'],
            ['C', 'B'],
            ['A', 'B'],
        ])
        expect(combinations(items, 3)).toEqual([['C', 'A', 'B']])
        expect(items).toEqual(['C', 'A', 'B'])
    })

    it('handles empty, zero-sized and impossible subsets', () => {
        expect(combinations([], 0)).toEqual([[]])
        expect(combinations(['A'], 0)).toEqual([[]])
        expect(combinations(['A'], -1)).toEqual([])
        expect(combinations(['A'], 2)).toEqual([])
    })
})
