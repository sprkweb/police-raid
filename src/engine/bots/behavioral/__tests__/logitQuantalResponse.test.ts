import { describe, expect, it } from 'vitest'

import { logitQuantalResponse } from '../logitQuantalResponse'

describe('logitQuantalResponse', () => {
    const utilities = [
        { action: 'A', utility: 1 },
        { action: 'B', utility: 3 },
    ]
    it('handles no actions and a single action', () => {
        expect(logitQuantalResponse([], 2).count()).toBe(0)
        expect(
            logitQuantalResponse(utilities.slice(0, 1), 2).probability(
                () => true,
            ),
        ).toBe(1)
    })
    it('is uniform at zero rationality', () => {
        expect(
            logitQuantalResponse(utilities, 0).probability((a) => a === 'A'),
        ).toBe(0.5)
    })
    it('weights actions by exponentiated utility and preserves utility-offset invariance', () => {
        const strategy = logitQuantalResponse(utilities, 2)
        expect(strategy.probability((a) => a === 'B')).toBeCloseTo(
            Math.exp(6) / (Math.exp(2) + Math.exp(6)),
        )
        expect(strategy.probability(() => true)).toBeCloseTo(1)
        const shifted = logitQuantalResponse(
            utilities.map((u) => ({ ...u, utility: u.utility - 4 })),
            2,
        )
        expect(shifted.probability((a) => a === 'B')).toBeCloseTo(
            strategy.probability((a) => a === 'B'),
        )
    })
})
