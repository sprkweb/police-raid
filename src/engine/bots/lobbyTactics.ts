import {
    DEFAULT_BOT_RATIONALITY as DEFAULT_BOT_PRECISION,
    EXPECTED_OTHERS_RATIONALITY as EXPECTED_OTHERS_PRECISION,
} from './index'
import type { BotBrainId, BotConfig } from './types'

export const LOBBY_BOT_TACTICS: readonly {
    id: BotBrainId
    labelKey: string
    config: BotConfig
}[] = [
    {
        id: 'random',
        labelKey: 'lobby.tacticRandom',
        config: { algorithm: 'random' },
    },
    {
        id: 'level0',
        labelKey: 'lobby.tacticLevel0',
        config: {
            algorithm: 'behavioral',
            level: 0,
            precision: DEFAULT_BOT_PRECISION,
            expectedOthersPrecision: EXPECTED_OTHERS_PRECISION,
        },
    },
    {
        id: 'pands',
        labelKey: 'lobby.tacticPandS',
        config: { algorithm: 'pands' },
    },
]
