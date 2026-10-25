import { describe, expect, it } from 'vitest'

import { MoleHypothesisSpace } from '../moleHypotheses'
import { SampleSpace } from '../sample'

describe('MoleHypothesisSpace', () => {
    it('assigns equal priors to all possible mole teams', () => {
        const space = MoleHypothesisSpace.forPlayers(['A', 'B', 'C', 'D'], 2)
        expect(space.count()).toBe(6)
        expect(space.probability((h) => h.includes('A'))).toBeCloseTo(0.5)
        expect(
            space.probability((h) => h.includes('A') && h.includes('B')),
        ).toBeCloseTo(1 / 6)
        expect(MoleHypothesisSpace.forPlayers(['A'], 2).count()).toBe(0)
        expect(
            MoleHypothesisSpace.forPlayers(['A'], 0).probability(
                (h) => h.length === 0,
            ),
        ).toBe(1)
    })
    it('applies Bayes rule with unequal priors, removes impossible hypotheses and leaves priors intact', () => {
        const prior = new MoleHypothesisSpace(
            new SampleSpace([
                { value: ['A'], probability: 0.2 },
                { value: ['B'], probability: 0.3 },
                { value: ['C'], probability: 0.5 },
            ]),
        )
        const posterior = prior.bayesianInference((h) =>
            h.includes('A') ? 0.5 : h.includes('B') ? 1 : 0,
        )
        expect(posterior.count()).toBe(2)
        expect(posterior.probability((h) => h.includes('A'))).toBeCloseTo(0.25)
        expect(posterior.probability((h) => h.includes('B'))).toBeCloseTo(0.75)
        expect(prior.probability((h) => h.includes('A'))).toBe(0.2)
        expect(posterior.bayesianInference(() => 0).count()).toBe(0)
    })
})
