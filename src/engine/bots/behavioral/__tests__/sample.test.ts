import { describe, expect, it } from 'vitest'

import { ZERO_EPS } from '../math'
import { LogSampleSpace, SampleSpace } from '../sample'

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

describe('LogSampleSpace', () => {
    const prior = new SampleSpace([
        { value: 'A', probability: 0.25 },
        { value: 'B', probability: 0.75 },
    ])

    it('retains evidence below floating-point probability range and can recover its odds', () => {
        const initial = LogSampleSpace.from(prior)
        let evidence = initial
        for (let i = 0; i < 100; i++) {
            evidence = evidence.bayesianInference((value) =>
                value === 'A' ? 1e-10 : 1e-20,
            )
        }
        expect(evidence.normalize().probability((value) => value === 'A')).toBe(
            1,
        )
        for (let i = 0; i < 100; i++) {
            evidence = evidence.bayesianInference((value) =>
                value === 'A' ? 1e-20 : 1e-10,
            )
        }
        expect(
            evidence.normalize().probability((value) => value === 'A'),
        ).toBeCloseTo(0.25, 9)
        expect(
            initial.normalize().probability((value) => value === 'A'),
        ).toBeCloseTo(0.25)
    })

    it('conditions raw evidence before normalization without pruning tiny alternatives', () => {
        const evidence = LogSampleSpace.from(prior).bayesianInference(
            (value) => (value === 'A' ? 1e-30 : 1),
        )
        expect(evidence.normalize().count()).toBe(2)
        expect(
            evidence
                .condition((value) => value === 'A')
                .normalize()
                .probability((value) => value === 'A'),
        ).toBe(1)
        expect(
            evidence
                .condition(() => false)
                .normalize()
                .count(),
        ).toBe(0)
        expect(evidence.normalize().probability((value) => value === 'B')).toBe(
            1,
        )
    })

    it('rejects normalization of a nonempty space with zero likelihood everywhere', () => {
        expect(() =>
            LogSampleSpace.from(prior)
                .bayesianInference(() => 0)
                .normalize(),
        ).toThrow('Cannot normalize log weights')
    })
})
