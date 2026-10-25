import { describe, expect, it, vi } from 'vitest'

import {
    createBehavioralStrategyBrain,
    LocalStrategy,
} from '../behavioralStrategy'
import { proposeCtx, raidCtx, voteCtx } from './fixtures'

describe('LocalStrategy.choose', () => {
    const strategy = new LocalStrategy([
        { value: 'impossible', probability: 0 },
        { value: 'A', probability: 0.25 },
        { value: 'B', probability: 0.75 },
    ])
    it.each([
        [0, 'A'],
        [0.249, 'A'],
        [0.25, 'B'],
        [0.999, 'B'],
        [1, 'B'],
    ])('samples %s at the cumulative boundary as %s', (random, expected) => {
        expect(strategy.choose(() => random as number)).toBe(expected)
    })
    it('falls back to the last action for floating point gaps', () => {
        expect(
            new LocalStrategy([
                { value: 'A', probability: 0.4999999999999999 },
                { value: 'B', probability: 0.5 },
            ]).choose(() => 0.9999999999999999),
        ).toBe('B')
    })
})

describe('createBehavioralStrategyBrain', () => {
    it('forwards each context and samples its distribution with the injected random function', () => {
        const strategy = {
            chooseProposedTeam: vi.fn(
                () =>
                    new LocalStrategy([
                        { value: ['A', 'B'], probability: 0.5 },
                        { value: ['C', 'D'], probability: 0.5 },
                    ]),
            ),
            chooseTeamVote: vi.fn(
                () =>
                    new LocalStrategy([
                        { value: 'Approve' as const, probability: 0.5 },
                        { value: 'Reject' as const, probability: 0.5 },
                    ]),
            ),
            chooseRaidAction: vi.fn(
                () =>
                    new LocalStrategy([
                        { value: 'Support' as const, probability: 0.5 },
                        { value: 'Sabotage' as const, probability: 0.5 },
                    ]),
            ),
        }
        const brain = createBehavioralStrategyBrain('custom', strategy)
        const random = vi.fn(() => 0.75)
        const propose = proposeCtx({ random })
        const vote = voteCtx({ random })
        const raid = raidCtx({ random })
        expect(brain.id).toBe('custom')
        expect(brain.chooseProposedTeam(propose)).toEqual(['C', 'D'])
        expect(brain.chooseTeamVote(vote)).toBe('Reject')
        expect(brain.chooseRaidAction(raid)).toBe('Sabotage')
        expect(strategy.chooseProposedTeam).toHaveBeenCalledExactlyOnceWith(
            propose,
        )
        expect(strategy.chooseTeamVote).toHaveBeenCalledExactlyOnceWith(vote)
        expect(strategy.chooseRaidAction).toHaveBeenCalledExactlyOnceWith(raid)
        expect(random).toHaveBeenCalledTimes(3)
    })
})
