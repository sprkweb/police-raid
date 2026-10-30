import { describe, expect, it } from 'vitest'

import { Role } from '../../../../types/game'
import { createBehavioralBrainFactory } from '../brain'
import { proposeCtx, raidCtx, voteCtx } from './fixtures'

describe('createBehavioralBrainFactory', () => {
    it.each([0, 1, 2, 3])(
        'creates a level %i brain with legal actions',
        (level) => {
            const brain = createBehavioralBrainFactory()({
                algorithm: 'behavioral',
                level,
                rationality: 2,
                expectedOthersRationality: 1,
            })
            expect(brain.id).toBe(`level${level}`)
            const ctx = proposeCtx({
                history: [
                    { kind: 'proposal', proposerId: 'A', team: ['A', 'B'] },
                ],
            })
            const team = brain.chooseProposedTeam(ctx)
            expect(team).toHaveLength(2)
            expect(new Set(team).size).toBe(2)
            expect(team.every((id) => ctx.playerIds.includes(id))).toBe(true)
            expect(['Approve', 'Reject']).toContain(
                brain.chooseTeamVote(voteCtx(ctx)),
            )
            expect(
                brain.chooseRaidAction(raidCtx({ ...ctx, role: Role.Police })),
            ).toBe('Support')
        },
    )
})
