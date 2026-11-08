import { describe, expect, it, vi } from 'vitest'

import {
    LogitBehavioralStrategy,
    LogitQuantalResponse,
} from '../logitQuantalResponse'
import { proposeCtx, voteCtx, raidCtx, logistic } from './fixtures'

describe('LogitQuantalResponse', () => {
    const utilities = [
        { action: 'A', utility: 1 },
        { action: 'B', utility: 3 },
    ]
    it('handles no actions and a single action', () => {
        expect(new LogitQuantalResponse([], 2).count()).toBe(0)
        expect(
            new LogitQuantalResponse(utilities.slice(0, 1), 2).probability(
                () => true,
            ),
        ).toBe(1)
    })
    it('is uniform at zero precision', () => {
        expect(
            new LogitQuantalResponse(utilities, 0).probability(
                (a) => a === 'A',
            ),
        ).toBe(0.5)
    })
    it('weights actions by exponentiated utility and preserves utility-offset invariance', () => {
        const strategy = new LogitQuantalResponse(utilities, 2)
        expect(strategy.probability((a) => a === 'B')).toBeCloseTo(
            Math.exp(6) / (Math.exp(2) + Math.exp(6)),
        )
        expect(strategy.probability(() => true)).toBeCloseTo(1)
        const shifted = new LogitQuantalResponse(
            utilities.map((u) => ({ ...u, utility: u.utility - 4 })),
            2,
        )
        expect(shifted.probability((a) => a === 'B')).toBeCloseTo(
            strategy.probability((a) => a === 'B'),
        )
    })
})

describe('LogitBehavioralStrategy', () => {
    it.each([0, 2])(
        'forwards contexts and converts utilities with precision %s',
        (precision) => {
            const estimator = {
                estimateProposedTeam: vi.fn(() => [
                    { action: ['A', 'B'], utility: 1 },
                    { action: ['C', 'D'], utility: 3 },
                ]),
                estimateTeamVote: vi.fn(() => [
                    { action: 'Approve' as const, utility: 1 },
                    { action: 'Reject' as const, utility: 3 },
                ]),
                estimateRaidAction: vi.fn(() => [
                    { action: 'Support' as const, utility: 1 },
                    { action: 'Sabotage' as const, utility: 3 },
                ]),
            }
            const strategy = new LogitBehavioralStrategy(precision, estimator)
            const proposal = proposeCtx()
            const vote = voteCtx()
            const raid = raidCtx()
            const teams = strategy.strategyForTeamProposal(proposal)
            const votes = strategy.strategyForTeamVote(vote)
            const actions = strategy.strategyForRaidAction(raid)
            expect(
                estimator.estimateProposedTeam,
            ).toHaveBeenCalledExactlyOnceWith(proposal)
            expect(estimator.estimateTeamVote).toHaveBeenCalledExactlyOnceWith(
                vote,
            )
            expect(
                estimator.estimateRaidAction,
            ).toHaveBeenCalledExactlyOnceWith(raid)
            expect(
                teams.probability((team) => team.join() === 'C,D'),
            ).toBeCloseTo(logistic(2 * precision))
            expect(
                votes.probability((action) => action === 'Reject'),
            ).toBeCloseTo(logistic(2 * precision))
            expect(
                actions.probability((action) => action === 'Sabotage'),
            ).toBeCloseTo(logistic(2 * precision))
            for (const distribution of [teams, votes, actions]) {
                expect(distribution.count()).toBe(2)
                expect(distribution.probability(() => true)).toBeCloseTo(1)
            }
        },
    )
})
