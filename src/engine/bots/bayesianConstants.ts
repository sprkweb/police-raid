/** Named knobs for the Bayesian bot. */

/** P(a mole plays Sabotage) in the raid *observation* model only. */
export const SABOTAGE_PRIOR = 0.85;

/** Likelihood when a cop's observed action matches the nested cop policy. */
export const COP_ACTION_MATCH = 0.95;
export const COP_ACTION_MISMATCH = 0.05;

/** Likelihood when a mole's observed action matches the nested mole policy. */
export const MOLE_ACTION_MATCH = 0.85;
export const MOLE_ACTION_MISMATCH = 0.15;

/** Off-team cops approve only if `cleanProbability` is at least this. */
export const CLEAN_VOTE_THRESHOLD = 0.75;

/** Treat `cleanProbability` at or below this as zero. */
export const CLEAN_ZERO_EPS = 1e-12;
