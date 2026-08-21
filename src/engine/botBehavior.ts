/**
 * @deprecated Import heuristics from `./bots/heuristicBrain` or `./bots`.
 * Re-exports the original bot helpers so existing tests keep compiling.
 */
export {
  BOT_LIKELY_CHANCE,
  BOT_RANDOM_CHANCE,
  BOT_UNLIKELY_CHANCE,
  chooseProposedTeam,
  chooseRaidAction,
  chooseTeamVote,
  type ChooseRaidActionInput,
  type ChooseTeamVoteInput,
} from './bots/heuristicBrain';
