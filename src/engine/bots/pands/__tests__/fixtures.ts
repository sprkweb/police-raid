import { Role, type GameEvent } from '../../../../types/game'
import type { BotVoteContext } from '../../types'

export function context(
    overrides: Partial<BotVoteContext> = {},
): BotVoteContext {
    return {
        actorId: 'a',
        role: Role.Police,
        playerIds: ['a', 'b', 'c', 'd', 'e'],
        moleIds: ['b', 'e'],
        currentRound: 2,
        consecutiveRejections: 0,
        requiredSabotages: 1,
        scores: { police: 0, moles: 1 },
        history: [{ kind: 'proposal', proposerId: 'd', team: ['d', 'e'] }],
        proposedTeam: ['d', 'e'],
        random: () => 0,
        ...overrides,
    }
}

export const history: GameEvent[] = [
    { kind: 'proposal', proposerId: 'a', team: ['a', 'b'] },
    {
        kind: 'votes',
        team: ['a', 'b'],
        consecutiveRejections: 0,
        votes: {
            a: 'Approve',
            b: 'Approve',
            c: 'Approve',
            d: 'Approve',
            e: 'Approve',
        },
    },
    {
        kind: 'raid',
        proposerId: 'a',
        team: ['a', 'b'],
        sabotageCount: 1,
        round: 1,
    },
    { kind: 'proposal', proposerId: 'c', team: ['c', 'd', 'e'] },
    {
        kind: 'votes',
        team: ['c', 'd', 'e'],
        consecutiveRejections: 0,
        votes: {
            a: 'Reject',
            b: 'Approve',
            c: 'Approve',
            d: 'Reject',
            e: 'Approve',
        },
    },
    {
        kind: 'raid',
        proposerId: 'c',
        team: ['c', 'd', 'e'],
        sabotageCount: 0,
        round: 2,
    },
]
