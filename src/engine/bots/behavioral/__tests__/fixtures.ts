import { Role } from '../../../../types/game'
import type {
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from '../../types'

export function proposeCtx(
    overrides: Partial<BotProposeContext> = {},
): BotProposeContext {
    return {
        actorId: 'C',
        role: Role.Police,
        playerIds: ['A', 'B', 'C', 'D', 'E'],
        moleIds: ['A', 'B'],
        currentRound: 2,
        consecutiveRejections: 0,
        requiredSabotages: 1,
        scores: { police: 0, moles: 1 },
        history: [],
        random: () => 0,
        teamSize: 2,
        ...overrides,
    }
}

export function voteCtx(
    overrides: Partial<BotVoteContext> = {},
): BotVoteContext {
    return { ...proposeCtx(), proposedTeam: ['A', 'B'], ...overrides }
}

export function raidCtx(
    overrides: Partial<BotRaidContext> = {},
): BotRaidContext {
    return {
        ...voteCtx(),
        actorId: 'A',
        role: Role.Mole,
        proposerId: 'C',
        ...overrides,
    }
}

export const logistic = (utility: number) => 1 / (1 + Math.exp(-utility))
