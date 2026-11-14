import type { BotMatchContext } from '../types'
import type { BehavioralStrategy } from './behavioralStrategy'
import {
    LevelKPlus1Estimator,
    type MoleHypothesesFromHistory,
} from './levelKPlus1'
import type {
    LogitBehavioralStrategy,
    LogitQuantalResponse,
} from './logitQuantalResponse'

// Shared models print once per history revision, even across different bots.
const printedHistory = new WeakMap<MoleHypothesesFromHistory, number>()

/** Decorate only real bots; modeled players must remain silent. */
export function withBehavioralDebug(
    strategy: LogitBehavioralStrategy,
): BehavioralStrategy {
    function print<Action>(
        ctx: BotMatchContext,
        decision: string,
        distribution: LogitQuantalResponse<Action>,
    ) {
        const estimator = strategy.estimator
        if (estimator instanceof LevelKPlus1Estimator) {
            const model = estimator.hypotheses
            const hypotheses = model.get(ctx)
            if (printedHistory.get(model) !== ctx.history.length) {
                console.groupCollapsed(
                    '[behavioral] Common hypotheses (before actor conditioning)',
                )
                console.table(
                    hypotheses.moleHypotheses.samplePoints.map(
                        ({ value, probability }) => ({
                            moles: value.join(', '),
                            probability,
                        }),
                    ),
                )
                console.groupEnd()
                printedHistory.set(model, ctx.history.length)
            }
        }
        console.groupCollapsed(`[behavioral] ${ctx.actorId} — ${decision}`)
        console.table(
            distribution.utilities.map(({ action, utility }, i) => ({
                action: Array.isArray(action) ? action.join(', ') : action,
                utility,
                probability: distribution.samplePoints[i].probability,
            })),
        )
        console.groupEnd()
        return distribution
    }

    return {
        strategyForTeamProposal: (ctx) =>
            print(ctx, 'Proposal', strategy.strategyForTeamProposal(ctx)),
        strategyForTeamVote: (ctx) =>
            print(ctx, 'Vote', strategy.strategyForTeamVote(ctx)),
        strategyForRaidAction: (ctx) =>
            print(ctx, 'Raid', strategy.strategyForRaidAction(ctx)),
    }
}
