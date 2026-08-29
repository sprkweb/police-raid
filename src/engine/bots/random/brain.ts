import type { PlayerId, RaidAction, Vote } from '../../../types/game';
import { Role } from '../../../types/game';
import { shuffle } from '../../rng';
import type { BotBrain, BotProposeContext, BotRaidContext, BotVoteContext } from '../types';

/** Uniform random among legal moves. Bench-only; not selectable in the live game. */
export function createRandomBrain(): BotBrain {
  return {
    id: 'random',
    chooseProposedTeam(ctx: BotProposeContext): PlayerId[] {
      if (ctx.teamSize <= 0) return [];
      return shuffle(ctx.playerIds, ctx.random).slice(0, ctx.teamSize);
    },
    chooseTeamVote(ctx: BotVoteContext): Vote {
      return ctx.random() < 0.5 ? 'Approve' : 'Reject';
    },
    chooseRaidAction(ctx: BotRaidContext): RaidAction {
      if (ctx.role !== Role.Mole) return 'Support';
      return ctx.random() < 0.5 ? 'Sabotage' : 'Support';
    },
  };
}
