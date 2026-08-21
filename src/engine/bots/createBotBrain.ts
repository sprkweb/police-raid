import { createBayesianBrain } from './bayesianBrain';
import { createHeuristicBrain } from './heuristicBrain';
import type { BotBrain, BotBrainId } from './types';

/** Factory for the two shipped brains. Production default is Bayesian. */
export function createBotBrain(id: BotBrainId = 'bayesian'): BotBrain {
  return id === 'heuristic' ? createHeuristicBrain() : createBayesianBrain();
}
