/**
 * Active bot: Bayesian worlds + level-1 ToM for propose/vote; raid sabotage
 * follows a seating coordination rule.
 * Mole propose/vote copies the cop policy.
 */
import type { PlayerId, RaidAction, Vote } from '../../../types/game';
import { Role } from '../../../types/game';
import {
  copProposeTeams,
  copVote,
  level1BeliefsFromHistory,
  pickTiedTeam,
} from './belief';
import { designateSaboteurs, previousSaboteursFromHistory } from './designateSaboteurs';
import { buildBayesianBeliefsDebugSnapshot } from './debugSnapshot';
import type { BotBrain, BotProposeContext, BotRaidContext, BotVoteContext } from '../types';

export function createBayesianBrain(): BotBrain {
  return {
    id: 'bayesian',
    chooseProposedTeam(ctx: BotProposeContext): PlayerId[] {
      const beliefs = level1BeliefsFromHistory(
        ctx.playerIds,
        ctx.moleCount,
        ctx.actorId,
        ctx.history,
      );
      const best = copProposeTeams(ctx.actorId, ctx.playerIds, ctx.teamSize, beliefs);
      return pickTiedTeam(best, ctx.random);
    },
    chooseTeamVote(ctx: BotVoteContext): Vote {
      const beliefs = level1BeliefsFromHistory(
        ctx.playerIds,
        ctx.moleCount,
        ctx.actorId,
        ctx.history,
      );
      return copVote(
        ctx.actorId,
        ctx.proposedTeam,
        beliefs,
        ctx.consecutiveRejections,
        ctx.playerIds.length,
      );
    },
    chooseRaidAction(ctx: BotRaidContext): RaidAction {
      if (ctx.role !== Role.Mole) return 'Support';
      const previousSaboteurs = previousSaboteursFromHistory(
        ctx.trueMoleIds,
        ctx.playerIds,
        ctx.history,
      );
      const designated = designateSaboteurs({
        team: ctx.proposedTeam,
        moleIds: ctx.trueMoleIds,
        proposerId: ctx.proposerId,
        seatingOrder: ctx.playerIds,
        previousSaboteurs,
        requiredSabotages: ctx.requiredSabotages,
      });
      return designated.includes(ctx.actorId) ? 'Sabotage' : 'Support';
    },
    debugBeliefs(ctx) {
      return buildBayesianBeliefsDebugSnapshot(ctx);
    },
  };
}
