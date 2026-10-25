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
import { LocalStrategy, type BehavioralStrategy } from './behavioralStrategy'
import { Level0Strategy } from './level0'
import { logitQuantalResponse } from './logitQuantalResponse'
import { combinations } from './math'
import { MoleHypothesisSpace } from './moleHypotheses'

export class LevelKPlus1Strategy implements BehavioralStrategy {
    private rationality: number
    private hypotheses: MoleHypothesesFromHistory
    // level0Strategy can be used for actions when hypotheses are not needed / nonexistent
    private level0Strategy: Level0Strategy

    constructor(rationality: number, hypotheses: MoleHypothesesFromHistory) {
        this.rationality = rationality
        this.hypotheses = hypotheses
        this.level0Strategy = new Level0Strategy(this.rationality)
    }

    /**
     * Gets a hypotheses space from this player's POV. Note: because these
     * hypotheses assume that the player is innocent, in rare cases there might
     * be no hypotheses left, so fallback is always needed. This might happen,
     * for example, when, based on raid history, it is possible to tell with
     * 100% certainty that this player is a mole (there are no possible
     * hypotheses left where he is innocent). Fallback in this strategy is
     * human-like "play dumb and pretend that it is not obvious that I am a
     * mole": basically, use level 0 strategy
     */
    private getHypotheses(ctx: BotMatchContext): MoleHypothesisSpace {
        return (
            this.hypotheses
                .get(ctx)

                // likelihood of me being mole == 0
                // even if I were a mole, I'd act from a position that I am not
                .bayesianInference((h) => (h.includes(ctx.actorId) ? 0 : 1))
        )
    }

    chooseProposedTeam(ctx: BotProposeContext): LocalStrategy<PlayerId[]> {
        const hypotheses = this.getHypotheses(ctx)
        if (hypotheses.count() === 0) {
            // rare case, no possible hypotheses
            // fallback to level 0 strategy
            return this.level0Strategy.chooseProposedTeam(ctx)
        }

        const teams = combinations(ctx.playerIds, ctx.teamSize)

        return logitQuantalResponse(
            teams.map((team) => ({
                action: team,
                utility: hypotheses.probability(
                    // probability that there are not enough moles to sabotage
                    (h) =>
                        h.filter((m) => team.includes(m)).length <
                        ctx.requiredSabotages,
                ),
            })),
            this.rationality,
        )
    }

    chooseTeamVote(ctx: BotVoteContext): LocalStrategy<Vote> {
        const hypotheses = this.getHypotheses(ctx)
        if (hypotheses.count() === 0) {
            // rare case, no possible hypotheses
            // fallback to level 0 strategy
            return this.level0Strategy.chooseTeamVote(ctx)
        }

        let utility = hypotheses.probability(
            // probability that there are not enough moles to sabotage
            (h) =>
                h.filter((m) => ctx.proposedTeam.includes(m)).length <
                ctx.requiredSabotages,
        )

        // hammer
        if (ctx.consecutiveRejections >= ctx.playerIds.length - 1) {
            utility += ctx.role === Role.Mole ? 1.4 : 2.5
        }

        return logitQuantalResponse(
            [
                { action: 'Approve', utility: utility },
                { action: 'Reject', utility: 1 - utility },
            ],
            this.rationality,
        )
    }

    chooseRaidAction(ctx: BotRaidContext): LocalStrategy<RaidAction> {
        // just use algorithm from level 0
        return this.level0Strategy.chooseRaidAction(ctx)
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
        if (this.hypotheses === undefined) {
            this.hypotheses = MoleHypothesisSpace.forPlayers(
                ctx.playerIds,
                ctx.moleIds.length,
            )
        }

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
                    this.hypotheses = this.hypotheses.bayesianInference(
                        (moles) => this.raidLikelihood(eventCtx, event, moles),
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
                    this.hypotheses = this.hypotheses.bayesianInference(
                        (moles) =>
                            this.proposalLikelihood(eventCtx, event, moles),
                    )
                    break

                case 'votes':
                    this.hypotheses = this.hypotheses.bayesianInference(
                        (moles) => this.votesLikelihood(eventCtx, event, moles),
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

        return this.hypotheses
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
            const hisStrategy = this.previousLevelStrategy.chooseRaidAction({
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
        const hisStrategy = this.previousLevelStrategy.chooseProposedTeam({
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
                    .chooseTeamVote({
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
