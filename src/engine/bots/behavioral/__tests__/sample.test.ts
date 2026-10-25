import { describe, expect, it } from 'vitest'

import { ZERO_EPS } from '../math'
import { SampleSpace } from '../sample'

describe('SampleSpace', () => {
    const space = new SampleSpace([
        { value: 'A', probability: 2 },
        { value: 'B', probability: 6 },
    ])

    it('sums only matching points and maps without mutating the original', () => {
        expect(space.count()).toBe(2)
        expect(space.probability(() => false)).toBe(0)
        expect(space.probability(() => true)).toBe(8)
        const mapped = space.map((s) => ({
            ...s,
            probability: s.probability / 2,
        }))
        expect(mapped.probability((v) => v === 'B')).toBe(3)
        expect(space.probability((v) => v === 'B')).toBe(6)
    })

    it('removes impossible points before normalizing and preserves the source', () => {
        const normalized = new SampleSpace([
            { value: 'negative', probability: -1 },
            { value: 'zero', probability: 0 },
            { value: 'tiny', probability: ZERO_EPS },
            { value: 'A', probability: 2 },
            { value: 'B', probability: 6 },
        ]).normalize()
        expect(normalized.count()).toBe(2)
        expect(normalized.probability((v) => v === 'A')).toBe(0.25)
        expect(normalized.probability(() => true)).toBe(1)
        expect(space.normalize().probability((v) => v === 'B')).toBe(0.75)
        expect(space.probability(() => true)).toBe(8)
    })

    it('returns an empty space when no positive mass remains', () => {
        for (const samples of [
            [],
            [{ value: 'A', probability: ZERO_EPS / 2 }],
        ]) {
            const normalized = new SampleSpace(samples).normalize()
            expect(normalized.count()).toBe(0)
            expect(normalized.probability(() => true)).toBe(0)
        }
    })
})
