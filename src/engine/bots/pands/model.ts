/*!
 * Ported from PandSBot by Pavel Raliuk and Alex Paklonski. THE RESISTANCE
 * Competition, Vienna Game/AI Conference 2012. Original license: GNU General
 * Public License version 3.0 (GPL-3.0-only). Modified 2026-10-31: TypeScript
 * port and generalised suspicion groups. See README.md and LICENSE.GPL-3.0 for
 * attribution and changes.
 */

import type { RandomFn } from '../../rng'
import { combinations } from '../behavioral/math'
import { Probability, Variable } from './statistics'

interface SuspectsGroup {
    players: number[]
    score: number
}

interface Observation {
    self: number
    team: readonly number[]
    votes: readonly boolean[]
    round: number
    requiredSabotages: number
}

/** Minimum number of moles in a team when an innocent observer is outside it. */
export function isUnavoidablyDangerous(
    teamSize: number,
    playerCount: number,
    moleCount: number,
    requiredSabotages: number,
): boolean {
    return teamSize - (playerCount - moleCount - 1) >= requiredSabotages
}

/** Numeric seat indexes preserve the terminology and array layout of Python. */
export class PandSModel {
    readonly friends: Probability[][]
    readonly suspects: Probability[]
    readonly supportSuspects: Variable[]
    // The spelling is retained from the original bot.
    readonly suspeciousActions: Variable[]
    readonly possibleGoodActions: Variable[]
    private readonly suspectsGroups: SuspectsGroup[]
    private readonly players: number[]
    private readonly moleCount: number

    constructor(playerCount: number, moleCount: number) {
        this.players = Array.from({ length: playerCount }, (_, i) => i)
        this.moleCount = moleCount
        const prior = moleCount / playerCount
        this.friends = this.players.map(() =>
            this.players.map(() => new Probability(prior)),
        )
        this.suspects = this.players.map(() => new Probability(0))
        this.supportSuspects = this.players.map(() => new Variable(prior, 1))
        this.suspeciousActions = this.players.map(() => new Variable(0, 0))
        this.possibleGoodActions = this.players.map(() => new Variable(0, 0))
        this.suspectsGroups = combinations(this.players, moleCount).map(
            (players) => ({ players, score: 0 }),
        )
    }

    _updateSuspectsGroups(): void {
        for (const group of this.suspectsGroups) {
            const spies = group.players
            const estimate = spies.reduce(
                (value, spy) => value * this.suspects[spy].estimate(),
                1,
            )
            if (estimate >= 0.99) {
                group.score = estimate
                continue
            }

            let friendship = 0
            let pairs = 0
            for (let i = 0; i < spies.length; i++) {
                for (let j = i + 1; j < spies.length; j++) {
                    friendship +=
                        this.friends[spies[i]][spies[j]].estimate() *
                        this.friends[spies[j]][spies[i]].estimate()
                    pairs++
                }
            }
            friendship = pairs > 0 ? friendship / pairs : 1
            const support = spies.reduce(
                (value, spy) => value * this.supportSuspects[spy].estimate(),
                1,
            )
            const suspicious =
                spies.reduce(
                    (sum, spy) => sum + this.suspeciousActions[spy].estimate(),
                    0,
                ) / spies.length
            const good =
                spies.reduce(
                    (sum, spy) =>
                        sum + this.possibleGoodActions[spy].estimate(),
                    0,
                ) / spies.length
            group.score =
                (0.5 + 0.5 * friendship) *
                (0.75 + 0.25 * support) *
                estimate *
                (0.4 + 0.6 * suspicious) *
                (1 - 0.1 * good)
        }
    }

    _getSuspicious(spy: number): number {
        return (
            (0.75 + 0.25 * this.supportSuspects[spy].estimate()) *
            this.suspects[spy].estimate() *
            (0.4 + 0.6 * this.suspeciousActions[spy].estimate()) *
            (1 - 0.1 * this.possibleGoodActions[spy].estimate())
        )
    }

    _getBadGroup(self: number, random: RandomFn): SuspectsGroup {
        let best: SuspectsGroup | undefined
        let bestScore = -Infinity
        for (const group of this.suspectsGroups) {
            if (group.players.includes(self)) continue
            const score = (0.9 + 0.1 * random()) * group.score
            if (best === undefined || score > bestScore) {
                best = group
                bestScore = score
            }
        }
        return best ?? { players: [], score: 0 }
    }

    _getGood(self: number, leader: number, random: RandomFn): number[] {
        const bad = this._getBadGroup(self, random)
        const others = this.players.filter((p) => p !== self)
        if (bad.score > 0) {
            return others
                .filter((p) => !bad.players.includes(p))
                .sort((a, b) => this._getSuspicious(a) - this._getSuspicious(b))
        }
        const n = this.players.length
        return others.sort(
            (a, b) => ((a - leader + n) % n) - ((b - leader + n) % n),
        )
    }

    onVoteComplete(ctx: Observation & { leader: number; tries: number }): void {
        const team = ctx.team.filter((p) => p !== ctx.self)
        const notTeam = this.players.filter(
            (p) => p !== ctx.self && !ctx.team.includes(p),
        )
        this.suspeciousActions[ctx.leader].sampleBool(
            !team.includes(ctx.leader),
        )

        for (const p1 of this.players) {
            if (p1 === ctx.self) continue
            this.suspeciousActions[p1].sampleBool(
                !ctx.votes[p1] && ctx.round === 1 && ctx.tries === 1,
            )
            this.suspeciousActions[p1].sampleBool(
                !ctx.votes[p1] && ctx.tries === this.players.length,
            )
            this.suspeciousActions[p1].sampleBool(
                ctx.votes[p1] &&
                    isUnavoidablyDangerous(
                        ctx.team.length,
                        this.players.length,
                        this.moleCount,
                        ctx.requiredSabotages,
                    ) &&
                    !team.includes(p1),
            )
            this.possibleGoodActions[p1].sampleBool(
                !ctx.votes[p1] && team.includes(p1),
            )

            if (p1 === ctx.leader) {
                for (const p2 of notTeam)
                    this.friends[p1][p2].sampleExt(1, notTeam.length)
            } else if (!team.includes(p1)) {
                const friends = ctx.votes[p1] ? team : notTeam
                for (const p2 of friends)
                    this.friends[p1][p2].sampleExt(1, friends.length)
            }
        }
        this._updateSuspectsGroups()
    }

    onMissionComplete(ctx: Observation & { sabotaged: number }): void {
        const team = ctx.team.filter((p) => p !== ctx.self)
        const other = this.players.filter(
            (p) => p !== ctx.self && !team.includes(p),
        )
        if (ctx.sabotaged > 0) {
            for (const p of team)
                this.suspects[p].sampleExt(ctx.sabotaged, team.length)
        }
        if (ctx.sabotaged < this.moleCount) {
            for (const p of other)
                this.suspects[p].sampleExt(
                    this.moleCount - ctx.sabotaged,
                    other.length,
                )
        }
        if (ctx.round > 1) {
            const failed = ctx.sabotaged >= ctx.requiredSabotages
            for (const p of other) {
                this.supportSuspects[p].sampleExt(
                    Number(ctx.votes[p] === failed),
                    1,
                )
            }
        }
        this._updateSuspectsGroups()
    }
}
