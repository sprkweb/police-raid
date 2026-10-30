export { createBotFactory } from './createBotFactory'
export type {
    BotBrain,
    BotConfig,
    BotFactory,
    CreateBotFactory,
    BotBrainId,
    BotMatchContext,
    BotProposeContext,
    BotRaidContext,
    BotVoteContext,
} from './types'

export const DEFAULT_BOT_RATIONALITY = 2.5
export const EXPECTED_OTHERS_RATIONALITY = 1.5
