import {
    Role,
    type GameEvent,
    type PlayerId,
    type RaidAction,
    type Vote,
} from '../../../types/game'
import type { PlayerCount } from '../../constants'
import { notRandom, type RandomFn } from '../../rng'
import {
    countApproves,
    isRaidSuccessful,
    isTeamApproved,
    requiredSabotagesForRound,
} from '../../rules'
import type {
    BotMatchContext,
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from '../types'
import type { BehavioralStrategy } from './behavioralStrategy'
import { Level0Estimator } from './level0'
import {
    type ActionUtilityEstimator,
    type Utility,
} from './logitQuantalResponse'
import { combinations } from './math'
import { MoleHypothesisSpace } from './moleHypotheses'
import { SampleSpace } from './sample'

// Keep public plausibility dominant, with a smaller private viability incentive.
const PROPOSAL_SAFETY_WEIGHT = 2
const MOLE_PROPOSAL_VIABILITY_BONUS = 0.5
const PARTICIPATION_COST = 1.2

// A behavioral preference, not a belief update; it fades as team safety improves.
function participationCost(
    team: readonly PlayerId[],
    actor: PlayerId,
    safety: number,
): number {
    return team.includes(actor) ? 0 : PARTICIPATION_COST * (1 - safety)
}

export class LevelKPlus1Estimator implements ActionUtilityEstimator {
    readonly hypotheses: MoleHypothesesFromHistory
    // level0Estimator can be used for actions when hypotheses are not needed / nonexistent
    private level0Estimator: Level0Estimator

    constructor(hypotheses: MoleHypothesesFromHistory) {
        this.hypotheses = hypotheses
        this.level0Estimator = new Level0Estimator()
    }

    /**
     * Gets a hypotheses space from this player's POV. Note: because these
     * hypotheses assume that the player is innocent, in rare cases there might
     * be no hypotheses left, so fallback is always needed. This might happen,
     * for example, when, based on raid history, it is possible to tell with
     * 100% certainty that this player is a mole (there are no possible
     * hypotheses left where he is innocent). Fallback is human-like "play dumb
     * and pretend that it is not obvious that I am a mole": basically, use
     * level 0 strategy
     */
    private getHypotheses(ctx: BotMatchContext): MoleHypothesisSpace {
        // Condition the two components separately before pooling them.
        // Moles also use the public pretense that they are innocent.
        return this.hypotheses.getForActor(ctx)
    }

    estimateProposedTeam(
        ctx: BotProposeContext,
    ): readonly Utility<PlayerId[]>[] {
        const hypotheses = this.getHypotheses(ctx)
        if (hypotheses.count() === 0) {
            // rare case, no possible hypotheses
            // fallback to level 0 strategy
            return this.level0Estimator.estimateProposedTeam(ctx)
        }

        const teams = combinations(ctx.playerIds, ctx.teamSize)

        return teams.map((team) => {
            const safety = hypotheses.probability(
                (h) =>
                    h.filter((m) => team.includes(m)).length <
                    ctx.requiredSabotages,
            )
            const viable =
                ctx.role === Role.Mole &&
                ctx.moleIds.filter((m) => team.includes(m)).length >=
                    ctx.requiredSabotages
            return {
                action: team,
                utility:
                    PROPOSAL_SAFETY_WEIGHT * safety +
                    (viable ? MOLE_PROPOSAL_VIABILITY_BONUS : 0) -
                    participationCost(team, ctx.actorId, safety),
            }
        })
    }

    estimateTeamVote(ctx: BotVoteContext): readonly Utility<Vote>[] {
        const hypotheses = this.getHypotheses(ctx)
        if (hypotheses.count() === 0) {
            // rare case, no possible hypotheses
            // fallback to level 0 strategy
            return this.level0Estimator.estimateTeamVote(ctx)
        }

        const safety = hypotheses.probability(
            // probability that there are not enough moles to sabotage
            (h) =>
                h.filter((m) => ctx.proposedTeam.includes(m)).length <
                ctx.requiredSabotages,
        )

        const hammer = ctx.consecutiveRejections >= ctx.playerIds.length - 1
        const approvalUtility = hammer
            ? safety + (ctx.role === Role.Mole ? 1.4 : 2.5)
            : safety - participationCost(ctx.proposedTeam, ctx.actorId, safety)
        const rejectionUtility = hammer ? 1 - approvalUtility : 1 - safety

        return [
            { action: 'Approve', utility: approvalUtility },
            { action: 'Reject', utility: rejectionUtility },
        ]
    }

    estimateRaidAction(ctx: BotRaidContext): readonly Utility<RaidAction>[] {
        // just use algorithm from level 0
        return this.level0Estimator.estimateRaidAction(ctx)
    }
}

/**
 * EventHypothesisContext is the data needed for modeling others' players (level
 * k-1) reasoning during an event to estimate its likelihood under some
 * hypothesis
 */
interface EventHypothesisContext {
    playerIds: readonly PlayerId[]
    moleIds: readonly PlayerId[]
    currentRound: number
    consecutiveRejections: number
    requiredSabotages: number
    scores: { police: number; moles: number }
    history: readonly GameEvent[]
    random: RandomFn
}

// Most weight stays on raid-only evidence; behavior can move only 30%.
const RAID_ONLY_WEIGHT = 0.7
const ALL_EVENTS_WEIGHT = 0.3

interface HypothesisEvidence {
    moles: PlayerId[]
    raidLog: number
    allLog: number
}

/**
 * MoleHypothesesFromHistory returns hypotheses about moles based on event
 * history and other players' expected strategy. It caches the previous
 * hypotheses and automatically updates them when it sees new events in the
 * context. It assumes all the previous events stay the same. The hypotheses are
 * not specific to anyone's POV and can be reused between different bots (as
 * long as expected level k-1 strategy stays the same)
 */
export class MoleHypothesesFromHistory {
    private previousLevelStrategy: BehavioralStrategy
    private hypotheses: MoleHypothesisSpace | undefined
    private rows: HypothesisEvidence[] | undefined
    private actorHypotheses = new Map<PlayerId, MoleHypothesisSpace>()
    private index: number

    private scores: { police: number; moles: number }
    private currentRound: number
    private consecutiveRejections: number

    constructor(previousLevelStrategy: BehavioralStrategy) {
        this.previousLevelStrategy = previousLevelStrategy
        this.index = 0

        this.scores = { police: 0, moles: 0 }
        this.currentRound = 1
        this.consecutiveRejections = 0
    }

    get(ctx: BotMatchContext): MoleHypothesisSpace {
        if (this.rows === undefined) {
            this.rows = MoleHypothesisSpace.forPlayers(
                ctx.playerIds,
                ctx.moleIds.length,
            ).moleHypotheses.samplePoints.map(({ value, probability }) => ({
                moles: value,
                raidLog: Math.log(probability),
                allLog: Math.log(probability),
            }))
        }
        const changed =
            this.hypotheses === undefined || this.index < ctx.history.length

        for (; this.index < ctx.history.length; this.index++) {
            const eventCtx = {
                playerIds: ctx.playerIds,
                moleIds: ctx.moleIds,
                currentRound: this.currentRound,
                consecutiveRejections: this.consecutiveRejections,
                requiredSabotages: requiredSabotagesForRound(
                    ctx.playerIds.length as PlayerCount,
                    this.currentRound,
                ),
                scores: this.scores,
                history: ctx.history.slice(0, this.index),
                random: notRandom,
            }

            const event = ctx.history[this.index]
            switch (event.kind) {
                case 'raid':
                    this.updateEvidence(event, (moles) =>
                        this.raidLikelihood(eventCtx, event, moles),
                    )

                    if (
                        isRaidSuccessful(
                            event.sabotageCount,
                            eventCtx.requiredSabotages,
                        )
                    )
                        this.scores.police++
                    else this.scores.moles++
                    this.currentRound++
                    break

                case 'proposal':
                    this.updateEvidence(event, (moles) =>
                        this.proposalLikelihood(eventCtx, event, moles),
                    )
                    break

                case 'votes':
                    this.updateEvidence(event, (moles) =>
                        this.votesLikelihood(eventCtx, event, moles),
                    )

                    if (
                        isTeamApproved(
                            countApproves(event.votes),
                            ctx.playerIds.length,
                        )
                    )
                        this.consecutiveRejections = 0
                    else this.consecutiveRejections++
                    break
            }
        }

        if (changed) {
            this.hypotheses = this.distribution()
            this.actorHypotheses.clear()
        }
        return this.hypotheses!
    }

    getForActor(ctx: BotMatchContext): MoleHypothesisSpace {
        this.get(ctx)
        let hypotheses = this.actorHypotheses.get(ctx.actorId)
        if (!hypotheses) {
            hypotheses = this.distribution(ctx.actorId)
            this.actorHypotheses.set(ctx.actorId, hypotheses)
        }
        return hypotheses
    }

    private updateEvidence(
        event: GameEvent,
        likelihood: (moles: readonly PlayerId[]) => number,
    ): void {
        // Physical impossibility is shared by both channels and never recovers.
        this.rows = this.rows!.filter((row) => {
            if (
                event.kind === 'raid' &&
                row.moles.filter((m) => event.team.includes(m)).length <
                    event.sabotageCount
            ) {
                return false
            }
            const logLikelihood = Math.log(likelihood(row.moles))
            row.allLog += logLikelihood
            if (event.kind === 'raid') row.raidLog += logLikelihood
            return true
        })
    }

    private distribution(actorId?: PlayerId): MoleHypothesisSpace {
        const rows = this.rows!.filter(
            (row) => actorId === undefined || !row.moles.includes(actorId),
        )
        const normalize = (channel: 'raidLog' | 'allLog'): number[] => {
            if (!rows.length) return []
            const max = Math.max(...rows.map((row) => row[channel]))
            if (!Number.isFinite(max)) {
                throw new Error(
                    'History likelihood is zero on all physically possible hypotheses.',
                )
            }
            const masses = rows.map((row) => Math.exp(row[channel] - max))
            const sum = masses.reduce((a, b) => a + b, 0)
            return masses.map((mass) => mass / sum)
        }
        // Local log normalization deliberately bypasses SampleSpace's EPS
        // pruning: small component masses must retain their fixed pool weight.
        // Raw accumulators always keep the original prior, never pooled output.
        const raid = normalize('raidLog')
        const all = normalize('allLog')
        return new MoleHypothesisSpace(
            new SampleSpace(
                rows.map((row, i) => ({
                    value: row.moles,
                    probability:
                        RAID_ONLY_WEIGHT * raid[i] + ALL_EVENTS_WEIGHT * all[i],
                })),
            ),
        )
    }

    // P(raid | H) is a likelihood of the raid happening given the players are moles
    private raidLikelihood(
        ctx: EventHypothesisContext,
        raid: GameEvent & { kind: 'raid' },
        moles: readonly PlayerId[],
    ): number {
        const { sabotageCount, team } = raid

        const molesInTeam = moles.filter((mole) => team.includes(mole))
        if (sabotageCount > molesInTeam.length) return 0

        // calculate probability of exactly `sabotageCount` sabotages in given circumstances

        // dp[j] stores the probability of getting exactly j sabotages
        let dp = Array.from({ length: molesInTeam.length + 1 }, () => 0)
        dp[0] = 1 // 100% chance of 0 sabotages with 0 moles in team

        for (const mole of molesInTeam) {
            const hisStrategy =
                this.previousLevelStrategy.strategyForRaidAction({
                    ...ctx,
                    moleIds: moles,
                    actorId: mole,
                    role: Role.Mole,
                    proposedTeam: team,
                    proposerId: raid.proposerId,
                })
            const p = hisStrategy.probability((a) => a == 'Sabotage')

            for (let j = molesInTeam.length; j >= 1; j--)
                dp[j] = dp[j - 1] * p + dp[j] * (1 - p)
            dp[0] *= 1 - p
        }

        return dp[sabotageCount]
    }

    // P(proposal | H) is a likelihood of the proposal happening given the players are moles
    private proposalLikelihood(
        ctx: EventHypothesisContext,
        proposal: GameEvent & { kind: 'proposal' },
        moles: readonly PlayerId[],
    ): number {
        const { proposerId, team } = proposal
        const hisStrategy = this.previousLevelStrategy.strategyForTeamProposal({
            ...ctx,
            moleIds: moles,
            actorId: proposerId,
            role: moles.includes(proposerId) ? Role.Mole : Role.Police,
            teamSize: team.length,
        })

        // probability that he would propose this exact team
        const teamSet = new Set(team)
        return hisStrategy.probability(
            (a) => a.length == team.length && a.every((p) => teamSet.has(p)),
        )
    }

    // P(votes | H) is a likelihood of the votes happening given the players are moles
    private votesLikelihood(
        ctx: EventHypothesisContext,
        event: GameEvent & { kind: 'votes' },
        moles: readonly PlayerId[],
    ): number {
        const { team, votes } = event

        // to get the probability of the given vote results,
        // we multiply each player's probabilities to vote this exact outcome
        return ctx.playerIds
            .map((player) =>
                this.previousLevelStrategy
                    .strategyForTeamVote({
                        ...ctx,
                        moleIds: moles,
                        proposedTeam: team,
                        actorId: player,
                        role: moles.includes(player) ? Role.Mole : Role.Police,
                    })
                    .probability((a) => votes[player] == a),
            )
            .reduce((acc, p) => acc * p, 1)
    }
}
