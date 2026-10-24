import {
    Role as Roles,
    type PlayerId,
    type RaidAction,
    type Vote,
} from '../../../types/game'
import type {
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from '../types'
import { LocalStrategy, type BehavioralStrategy } from './behavioralStrategy'
import { logitQuantalResponse } from './logitQuantalResponse'
import { combinations } from './math'

export class Level0Strategy implements BehavioralStrategy {
    private rationality: number
    constructor(rationality: number) {
        this.rationality = rationality
    }

    // TODO: tune utilities using inspect
    chooseProposedTeam(ctx: BotProposeContext): LocalStrategy<PlayerId[]> {
        const teams = combinations(ctx.playerIds, ctx.teamSize)

        const utilities = teams.map((team) => {
            let utility = 0
            const meOnTeam = team.includes(ctx.actorId)

            if (ctx.role === Roles.Mole) {
                // i'm a mole

                // utility for another mole is smaller than myself
                // also, multiple moles -> smaller utility
                const molesCount = team.filter((p) =>
                    ctx.moleIds.includes(p),
                ).length

                if (molesCount >= ctx.requiredSabotages)
                    utility += 0.6 ** (molesCount - ctx.requiredSabotages + 1)
                if (meOnTeam) utility += 0.5
            } else {
                // i'm a police
                if (meOnTeam) utility += 1
            }

            return { action: team, utility }
        })

        return logitQuantalResponse(utilities, this.rationality)
    }

    // TODO: tune utilities using inspect
    chooseTeamVote(ctx: BotVoteContext): LocalStrategy<Vote> {
        let utility = 0

        const meOnTeam = ctx.proposedTeam.includes(ctx.actorId)

        if (ctx.role === Roles.Mole) {
            // i'm a mole

            // utility for another mole is smaller than myself
            // also, multiple moles -> smaller utility
            const molesCount = ctx.proposedTeam.filter((p) =>
                ctx.moleIds.includes(p),
            ).length

            if (molesCount >= ctx.requiredSabotages)
                utility += 0.6 ** (molesCount - ctx.requiredSabotages + 1)
            if (meOnTeam) utility += 0.9
        } else {
            // i'm a police
            if (meOnTeam) utility += 1.5
        }

        // hammer
        if (ctx.consecutiveRejections >= ctx.playerIds.length - 1) {
            utility += ctx.role === Roles.Mole ? 1.4 : 2.5
        }

        // first round
        if (ctx.currentRound === 1) utility += 1

        return logitQuantalResponse(
            [
                { action: 'Approve', utility },
                { action: 'Reject', utility: 1 },
            ],
            this.rationality,
        )
    }

    chooseRaidAction(ctx: BotRaidContext): LocalStrategy<RaidAction> {
        if (ctx.role !== Roles.Mole) {
            return new LocalStrategy([{ probability: 1, value: 'Support' }])
        }

        const molesCount = ctx.proposedTeam.filter((p) =>
            ctx.moleIds.includes(p),
        ).length

        let sabotageUtility = 0
        if (molesCount >= ctx.requiredSabotages) {
            // TODO: lower sabotage when there are just 2 people?

            // lower sabotage utility when there are more moles than needed
            switch (molesCount - ctx.requiredSabotages) {
                case 0:
                    sabotageUtility = 1.3
                    break
                case 1:
                    sabotageUtility = 0.2
                    break
                case 2:
                    sabotageUtility = -0.2
                    break
            }
        } else {
            // sabotage is a bad decision when there are not enough moles
            sabotageUtility = -1
        }

        return logitQuantalResponse(
            [
                { action: 'Support', utility: 0 },
                { action: 'Sabotage', utility: sabotageUtility },
            ],
            this.rationality,
        )
    }
}
