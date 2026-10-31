/*!
 * PandSBot by Pavel Raliuk and Alex Paklonski. THE RESISTANCE Competition,
 * Vienna Game/AI Conference 2012. Original license: GNU General Public License
 * version 3.0 (GPL-3.0-only). Modified 2026-10-31: TypeScript BotBrain adapter,
 * arbitrary mole counts and sabotage thresholds, and Police Raid rules. See
 * README.md and LICENSE.GPL-3.0.
 */

import {
    Role,
    type PlayerId,
    type RaidAction,
    type Vote,
} from '../../../types/game'
import { WINS_NEEDED, type PlayerCount } from '../../constants'
import { shuffle } from '../../rng'
import { requiredSabotagesForRound } from '../../rules'
import type {
    BotBrain,
    BotMatchContext,
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from '../types'
import { isUnavoidablyDangerous, PandSModel } from './model'

/** One actor, a fixed roster, and append-only public history, for one match. */
class PandSBot implements BotBrain {
    readonly id = 'pands'
    private model: PandSModel | undefined
    private players: readonly PlayerId[] = []
    private index = 0
    private leader = 0
    private historyIndex = 0
    private round = 1
    private votes: boolean[] = []

    private sync(ctx: BotMatchContext): PandSModel {
        if (!this.model) {
            this.players = [...ctx.playerIds]
            this.index = this.players.indexOf(ctx.actorId)
            this.leader = this.index
            // Only the count is public knowledge. Identities are used solely in
            // the spy branches of vote() and sabotage().
            this.model = new PandSModel(this.players.length, ctx.moleIds.length)
        }
        for (; this.historyIndex < ctx.history.length; this.historyIndex++) {
            const event = ctx.history[this.historyIndex]
            switch (event.kind) {
                case 'proposal':
                    this.leader = this.players.indexOf(event.proposerId)
                    break
                case 'votes':
                    this.votes = this.players.map(
                        (p) => event.votes[p] === 'Approve',
                    )
                    this.model.onVoteComplete({
                        self: this.index,
                        leader: this.leader,
                        team: this.indexes(event.team),
                        votes: this.votes,
                        round: this.round,
                        tries: event.consecutiveRejections + 1,
                        requiredSabotages: requiredSabotagesForRound(
                            this.players.length as PlayerCount,
                            this.round,
                        ),
                    })
                    break
                case 'raid':
                    this.model.onMissionComplete({
                        self: this.index,
                        team: this.indexes(event.team),
                        votes: this.votes,
                        round: event.round,
                        sabotaged: event.sabotageCount,
                        requiredSabotages: requiredSabotagesForRound(
                            this.players.length as PlayerCount,
                            event.round,
                        ),
                    })
                    this.round = event.round + 1
                    break
            }
        }
        return this.model
    }

    private indexes(players: readonly PlayerId[]): number[] {
        return players.map((p) => this.players.indexOf(p))
    }

    chooseProposedTeam(ctx: BotProposeContext): PlayerId[] {
        const model = this.sync(ctx)
        return this.select(ctx, model)
    }

    private select(ctx: BotProposeContext, model: PandSModel): PlayerId[] {
        if (ctx.teamSize <= 0) return []
        // During select() the current leader is always this bot; skipped
        // proposals need no history entry to establish that.
        const goodPlayers = model._getGood(this.index, this.index, ctx.random)
        const trusted = goodPlayers.slice(0, ctx.teamSize - 1)
        const result = [
            ctx.actorId,
            ...this.players.filter(
                (_, i) => i !== this.index && trusted.includes(i),
            ),
        ]
        if (result.length < ctx.teamSize) {
            const others = this.players.filter((p) => !result.includes(p))
            result.push(
                ...shuffle(others, ctx.random).slice(
                    0,
                    ctx.teamSize - result.length,
                ),
            )
        }
        return result
    }

    chooseTeamVote(ctx: BotVoteContext): Vote {
        const model = this.sync(ctx)
        return this.vote(ctx, model) ? 'Approve' : 'Reject'
    }

    private vote(ctx: BotVoteContext, model: PandSModel): boolean {
        if (this.leader === this.index) return true
        if (ctx.currentRound === 1 && ctx.consecutiveRejections === 0)
            return true

        const bad = model._getBadGroup(this.index, ctx.random)
        if (ctx.role === Role.Mole) {
            return (
                ctx.proposedTeam.filter((p) => ctx.moleIds.includes(p))
                    .length >= ctx.requiredSabotages
            )
        }
        if (ctx.consecutiveRejections === this.players.length - 1) return true
        if (
            !ctx.proposedTeam.includes(ctx.actorId) &&
            isUnavoidablyDangerous(
                ctx.proposedTeam.length,
                this.players.length,
                ctx.moleIds.length,
                ctx.requiredSabotages,
            )
        )
            return false

        const team = this.indexes(ctx.proposedTeam)
        if (
            team.filter((p) => bad.players.includes(p)).length >=
            ctx.requiredSabotages
        )
            return false
        if (!team.includes(this.leader)) return false
        return true
    }

    chooseRaidAction(ctx: BotRaidContext): RaidAction {
        this.sync(ctx)
        return this.sabotage(ctx) ? 'Sabotage' : 'Support'
    }

    private _maybeLastTurn(ctx: BotMatchContext): boolean {
        return (
            ctx.scores.police >= WINS_NEEDED - 1 ||
            ctx.scores.moles >= WINS_NEEDED - 1
        )
    }

    private sabotage(ctx: BotRaidContext): boolean {
        if (ctx.role !== Role.Mole) return false
        const spiesCount = ctx.proposedTeam.filter((p) =>
            ctx.moleIds.includes(p),
        ).length
        if (spiesCount < ctx.requiredSabotages) return false
        return (
            spiesCount === ctx.requiredSabotages ||
            this._maybeLastTurn(ctx) ||
            ctx.proposerId !== ctx.actorId
        )
    }
}

export function createPandSBrain(): BotBrain {
    return new PandSBot()
}
