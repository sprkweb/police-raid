/**
 * Active bot: Bayesian worlds + level-1 ToM for propose/vote; sabotage convention on raid.
 * Mole propose/vote uses the cop policy (camouflage).
 */
import type { PlayerId, RaidAction, Vote } from '../../../types/game';
import { Role } from '../../../types/game';
import {
  level1BeliefsFromHistory,
  nestedCopProposeTeams,
  nestedCopVote,
  pickTiedTeam,
} from './belief';
import { designateSaboteurs, priorSaboteursFromHistory } from './designateSaboteurs';
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
      const best = nestedCopProposeTeams(ctx.actorId, ctx.playerIds, ctx.teamSize, beliefs);
      return pickTiedTeam(best, ctx.random);
    },
    chooseTeamVote(ctx: BotVoteContext): Vote {
      const beliefs = level1BeliefsFromHistory(
        ctx.playerIds,
        ctx.moleCount,
        ctx.actorId,
        ctx.history,
      );
      return nestedCopVote(
        ctx.actorId,
        ctx.proposedTeam,
        beliefs,
        ctx.consecutiveRejections,
        ctx.playerIds.length,
      );
    },
    chooseRaidAction(ctx: BotRaidContext): RaidAction {
      if (ctx.role !== Role.Mole) return 'Support';
      const priorSaboteurs = priorSaboteursFromHistory(
        ctx.trueMoleIds,
        ctx.playerIds,
        ctx.history,
      );
      const designated = designateSaboteurs({
        team: ctx.proposedTeam,
        moleIds: ctx.trueMoleIds,
        proposerId: ctx.proposerId,
        seatingOrder: ctx.playerIds,
        priorSaboteurs,
        requiredSabotages: ctx.requiredSabotages,
      });
      return designated.includes(ctx.actorId) ? 'Sabotage' : 'Support';
    },
  };
}
