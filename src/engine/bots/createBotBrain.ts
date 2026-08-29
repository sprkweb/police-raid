import { createBayesianBrain } from './bayesian';
import { createHeuristicBrain } from './heuristic';
import type { BotBrain, ProductionBotBrainId } from './types';

/** Factory for brains the live game can run. Production default is Bayesian. */
export function createBotBrain(id: ProductionBotBrainId = 'bayesian'): BotBrain {
  switch (id) {
    case 'heuristic':
      return createHeuristicBrain();
    case 'bayesian':
      return createBayesianBrain();
  }
}
