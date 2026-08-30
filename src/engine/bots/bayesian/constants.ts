/** Named knobs for the Bayesian bot. */

/** P(a mole plays Sabotage) in the raid *observation* model only. */
export const SABOTAGE_RATE = 0.85;

/** Likelihood when a cop's observed action matches the cop policy. */
export const COP_ACTION_MATCH = 0.95;
export const COP_ACTION_MISMATCH = 0.05;

/** Likelihood when a mole's observed action matches the mole policy. */
export const MOLE_ACTION_MATCH = 0.85;
export const MOLE_ACTION_MISMATCH = 0.15;

/** Off-team cops approve only if `noMolesOnTeamProbability` is at least this. */
export const NO_MOLES_VOTE_THRESHOLD = 0.75;

/** Treat probabilities at or below this as zero (also argmax float ties). */
export const ZERO_EPS = 1e-12;
