import { DEFAULT_BOT_RATIONALITY, EXPECTED_OTHERS_RATIONALITY } from './index'
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
            rationality: DEFAULT_BOT_RATIONALITY,
            expectedOthersRationality: EXPECTED_OTHERS_RATIONALITY,
        },
    },
]
