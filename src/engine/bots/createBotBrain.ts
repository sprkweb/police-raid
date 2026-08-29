import { createBayesianBrain } from './bayesian';
import { createHeuristicBrain } from './heuristic';
import { createRandomBrain } from './random';
import type { BotBrain, BotBrainId } from './types';

/** Factory for every shipped brain. Default is Bayesian. */
export function createBotBrain(id: BotBrainId = 'bayesian'): BotBrain {
  switch (id) {
    case 'heuristic':
      return createHeuristicBrain();
    case 'bayesian':
      return createBayesianBrain();
    case 'random':
      return createRandomBrain();
  }
}
