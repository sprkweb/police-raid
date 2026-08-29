import { GamePhase } from '../../../types/game';
import { WINS_NEEDED } from '../../constants';
import { GameEngine, type GameEngineOptions } from '../../GameEngine';
import { createSeededRandom } from '../../rng';
import { createBotBrain } from '../createBotBrain';
import type { BotBrain, ProductionBotBrainId } from '../types';

export function createAllBotEngine(playerCount: number, options: GameEngineOptions = {}): GameEngine {
  const engine = new GameEngine('bot-1', 'Bot 1', () => {}, {
    timersEnabled: false,
    voteResultDurationMs: 0,
    roundEndDurationMs: 0,
    ...options,
  });
  for (let i = 2; i <= playerCount; i++) {
    engine.addPlayer(`bot-${i}`, `Bot ${i}`);
  }
  engine.startGame();
  return engine;
}

export function driveAllBotMatchToGameOver(engine: GameEngine, maxSteps = 400): void {
  for (let step = 0; step < maxSteps; step++) {
    const phase = engine.getState().phase;
    if (phase === GamePhase.GameOver) return;
    if (phase === GamePhase.Discussion) {
      engine.endDiscussion();
      continue;
    }
    throw new Error(`all-bot match stalled in ${phase} at step ${step}`);
  }
  throw new Error(`all-bot match exceeded ${maxSteps} steps`);
}

export interface BotMatchStats {
  games: number;
  policeWins: number;
  moleWins: number;
  rejectionWins: number;
  elapsedMs: number;
}

export function simulateAllBotMatches(input: {
  brain: BotBrain | ProductionBotBrainId;
  playerCount: number;
  games: number;
  seed: number;
}): BotMatchStats {
  const brain = typeof input.brain === 'string' ? createBotBrain(input.brain) : input.brain;
  const started = Date.now();
  let policeWins = 0;
  let moleWins = 0;
  let rejectionWins = 0;

  for (let g = 0; g < input.games; g++) {
    const engine = createAllBotEngine(input.playerCount, {
      botBrain: brain,
      random: createSeededRandom(input.seed + g),
    });
    driveAllBotMatchToGameOver(engine);
    const state = engine.getState();
    if (state.winner === 'Police') policeWins++;
    else moleWins++;
    if (state.winner === 'Moles' && state.scores.moles < WINS_NEEDED) {
      rejectionWins++;
    }
  }

  return {
    games: input.games,
    policeWins,
    moleWins,
    rejectionWins,
    elapsedMs: Date.now() - started,
  };
}
