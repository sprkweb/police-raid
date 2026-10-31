import { describe, expect, it } from 'vitest'

import { Probability, Variable } from '../statistics'

describe('PandS accumulators', () => {
    it('averages weighted observations, including the original prior', () => {
        const variable = new Variable(0.4, 1)
        variable.sampleBool(true)
        variable.sampleExt(1, 3)
        expect(variable.estimate()).toBeCloseTo(0.48, 12)
        expect(new Variable(0, 0).estimate()).toBe(0)
    })

    it('accumulates evidence with the original noisy-OR formula', () => {
        const probability = new Probability(0.4)
        probability.sampleExt(1, 2)
        expect(probability.estimate()).toBeCloseTo(0.7, 12)
        probability.sampleExt(1, 4)
        expect(probability.estimate()).toBeCloseTo(0.775, 12)
    })

    it('preserves unnormalised estimates rather than silently clamping them', () => {
        const probability = new Probability(0)
        probability.sampleExt(2, 1)
        expect(probability.estimate()).toBe(2)
    })
})
