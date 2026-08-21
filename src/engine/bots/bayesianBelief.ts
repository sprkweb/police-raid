/**
 * World-space beliefs and nested (level-0) cop/mole policies.
 * Nested actors use raid-only beliefs so ToM does not recurse. See `ALGORITHM.md`.
 */
import type { PlayerId, Vote } from '../../types/game';
import type { RandomFn } from '../rng';
import {
  CLEAN_VOTE_THRESHOLD,
  CLEAN_ZERO_EPS,
  COP_ACTION_MATCH,
  COP_ACTION_MISMATCH,
  MOLE_ACTION_MATCH,
  MOLE_ACTION_MISMATCH,
  SABOTAGE_PRIOR,
} from './bayesianConstants';
import { binomialCoefficient, combinations } from './combinations';
import type { BotObservation, WorldBelief } from './types';

export function enumerateWorlds(
  playerIds: readonly PlayerId[],
  moleCount: number,
  observerId: PlayerId,
): PlayerId[][] {
  const others = playerIds.filter((id) => id !== observerId);
  return combinations(others, moleCount);
}

export function uniformBeliefs(worlds: readonly (readonly PlayerId[])[]): WorldBelief[] {
  if (worlds.length === 0) return [];
  const probability = 1 / worlds.length;
  return worlds.map((moles) => ({ moles, probability }));
}

export function normalizeBeliefs(beliefs: WorldBelief[]): WorldBelief[] {
  const sum = beliefs.reduce((acc, b) => acc + b.probability, 0);
  if (beliefs.length === 0) return [];
  if (sum <= CLEAN_ZERO_EPS) {
    const probability = 1 / beliefs.length;
    return beliefs.map((b) => ({ moles: b.moles, probability }));
  }
  return beliefs.map((b) => ({ moles: b.moles, probability: b.probability / sum }));
}

export function molesOnTeam(team: readonly PlayerId[], moles: readonly PlayerId[]): number {
  const set = new Set(moles);
  let count = 0;
  for (const id of team) {
    if (set.has(id)) count++;
  }
  return count;
}

export function teamIntersectsMoles(team: readonly PlayerId[], moles: readonly PlayerId[]): boolean {
  const set = new Set(moles);
  return team.some((id) => set.has(id));
}

/** P(this player is a mole) under `beliefs`. */
export function moleProbability(beliefs: readonly WorldBelief[], playerId: PlayerId): number {
  let p = 0;
  for (const world of beliefs) {
    if (world.moles.includes(playerId)) p += world.probability;
  }
  return p;
}

/** P(team contains no moles) under `beliefs`. */
export function cleanProbability(beliefs: readonly WorldBelief[], team: readonly PlayerId[]): number {
  let p = 0;
  for (const world of beliefs) {
    if (!teamIntersectsMoles(team, world.moles)) p += world.probability;
  }
  return p;
}

export function raidLikelihood(moleCountOnTeam: number, sabotageCount: number): number {
  if (sabotageCount > moleCountOnTeam || sabotageCount < 0) return 0;
  return (
    binomialCoefficient(moleCountOnTeam, sabotageCount) *
    SABOTAGE_PRIOR ** sabotageCount *
    (1 - SABOTAGE_PRIOR) ** (moleCountOnTeam - sabotageCount)
  );
}

export function updateFromRaid(
  beliefs: readonly WorldBelief[],
  team: readonly PlayerId[],
  sabotageCount: number,
): WorldBelief[] {
  return normalizeBeliefs(
    beliefs.map((world) => ({
      moles: world.moles,
      probability: world.probability * raidLikelihood(molesOnTeam(team, world.moles), sabotageCount),
    })),
  );
}

/**
 * Level-0 belief: raid outcomes only. Used as the nested other-player brain.
 * Does not interpret proposals or votes (that would be level-2+).
 */
export function beliefsFromRaids(
  playerIds: readonly PlayerId[],
  moleCount: number,
  observerId: PlayerId,
  history: readonly BotObservation[],
): WorldBelief[] {
  let beliefs = uniformBeliefs(enumerateWorlds(playerIds, moleCount, observerId));
  for (const event of history) {
    if (event.kind === 'raid') {
      beliefs = updateFromRaid(beliefs, event.team, event.sabotageCount);
    }
  }
  return beliefs;
}

export function sameTeam(a: readonly PlayerId[], b: readonly PlayerId[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

export function teamInList(team: readonly PlayerId[], list: readonly PlayerId[][]): boolean {
  return list.some((candidate) => sameTeam(candidate, team));
}

export function teamsIncludingActor(
  actorId: PlayerId,
  playerIds: readonly PlayerId[],
  teamSize: number,
): PlayerId[][] {
  if (teamSize <= 0) return [];
  if (teamSize === 1) return [[actorId]];
  const others = playerIds.filter((id) => id !== actorId);
  return combinations(others, teamSize - 1).map((rest) => [actorId, ...rest]);
}

export function argmaxTeams(
  teams: readonly PlayerId[][],
  score: (team: readonly PlayerId[]) => number,
): PlayerId[][] {
  if (teams.length === 0) return [];
  let best = -Infinity;
  const winners: PlayerId[][] = [];
  for (const team of teams) {
    const s = score(team);
    if (s > best + CLEAN_ZERO_EPS) {
      best = s;
      winners.length = 0;
      winners.push(team);
    } else if (Math.abs(s - best) <= CLEAN_ZERO_EPS) {
      winners.push(team);
    }
  }
  return winners;
}

export function pickTiedTeam(teams: readonly PlayerId[][], random: RandomFn): PlayerId[] {
  if (teams.length === 0) return [];
  if (teams.length === 1) return [...teams[0]!];
  const index = Math.floor(random() * teams.length);
  return [...(teams[index] ?? teams[0]!)];
}

export function nestedCopProposeTeams(
  actorId: PlayerId,
  playerIds: readonly PlayerId[],
  teamSize: number,
  beliefs: readonly WorldBelief[],
): PlayerId[][] {
  return argmaxTeams(teamsIncludingActor(actorId, playerIds, teamSize), (team) =>
    cleanProbability(beliefs, team),
  );
}

export function nestedMoleProposeTeams(
  actorId: PlayerId,
  playerIds: readonly PlayerId[],
  teamSize: number,
  beliefs: readonly WorldBelief[],
  worldMoles: readonly PlayerId[],
): PlayerId[][] {
  const infiltrating = teamsIncludingActor(actorId, playerIds, teamSize).filter((team) =>
    teamIntersectsMoles(team, worldMoles),
  );
  const pool = infiltrating.length > 0 ? infiltrating : teamsIncludingActor(actorId, playerIds, teamSize);
  return argmaxTeams(pool, (team) => cleanProbability(beliefs, team));
}

/** Cop vote policy (hammer / on-team / off-team threshold). Used both nested and for our action. */
export function nestedCopVote(
  actorId: PlayerId,
  team: readonly PlayerId[],
  beliefs: readonly WorldBelief[],
  consecutiveRejections: number,
  playerCount: number,
): Vote {
  if (consecutiveRejections >= playerCount - 1) return 'Approve';
  const pClean = cleanProbability(beliefs, team);
  if (team.includes(actorId)) {
    return pClean <= CLEAN_ZERO_EPS ? 'Reject' : 'Approve';
  }
  return pClean >= CLEAN_VOTE_THRESHOLD ? 'Approve' : 'Reject';
}

/** Mole vote in a candidate world: pass a team that already contains a mole from that world. */
export function nestedMoleVote(team: readonly PlayerId[], worldMoles: readonly PlayerId[]): Vote {
  return teamIntersectsMoles(team, worldMoles) ? 'Approve' : 'Reject';
}

function proposalLikelihood(
  proposerId: PlayerId,
  team: readonly PlayerId[],
  world: WorldBelief,
  nestedBeliefs: readonly WorldBelief[],
  playerIds: readonly PlayerId[],
): number {
  const teamSize = team.length;
  const proposerIsMole = world.moles.includes(proposerId);
  if (!proposerIsMole) {
    const copBest = nestedCopProposeTeams(proposerId, playerIds, teamSize, nestedBeliefs);
    return teamInList(team, copBest) ? COP_ACTION_MATCH : COP_ACTION_MISMATCH;
  }
  const moleBest = nestedMoleProposeTeams(
    proposerId,
    playerIds,
    teamSize,
    nestedBeliefs,
    world.moles,
  );
  return teamInList(team, moleBest) ? MOLE_ACTION_MATCH : MOLE_ACTION_MISMATCH;
}

function voteLikelihood(
  voterId: PlayerId,
  vote: Vote,
  team: readonly PlayerId[],
  world: WorldBelief,
  nestedBeliefs: readonly WorldBelief[],
  consecutiveRejections: number,
  playerCount: number,
): number {
  const voterIsMole = world.moles.includes(voterId);
  if (!voterIsMole) {
    const expected = nestedCopVote(
      voterId,
      team,
      nestedBeliefs,
      consecutiveRejections,
      playerCount,
    );
    return vote === expected ? COP_ACTION_MATCH : COP_ACTION_MISMATCH;
  }
  const expected = nestedMoleVote(team, world.moles);
  return vote === expected ? MOLE_ACTION_MATCH : MOLE_ACTION_MISMATCH;
}

function updateFromProposal(
  beliefs: readonly WorldBelief[],
  event: Extract<BotObservation, { kind: 'proposal' }>,
  playerIds: readonly PlayerId[],
  moleCount: number,
  historyBefore: readonly BotObservation[],
): WorldBelief[] {
  const nestedBeliefs = beliefsFromRaids(playerIds, moleCount, event.proposerId, historyBefore);
  return normalizeBeliefs(
    beliefs.map((world) => ({
      moles: world.moles,
      probability:
        world.probability *
        proposalLikelihood(event.proposerId, event.team, world, nestedBeliefs, playerIds),
    })),
  );
}

function updateFromVotes(
  beliefs: readonly WorldBelief[],
  event: Extract<BotObservation, { kind: 'votes' }>,
  playerIds: readonly PlayerId[],
  moleCount: number,
  historyBefore: readonly BotObservation[],
): WorldBelief[] {
  const playerCount = playerIds.length;
  const nestedByVoter = new Map<PlayerId, WorldBelief[]>();
  for (const voterId of Object.keys(event.votes)) {
    nestedByVoter.set(voterId, beliefsFromRaids(playerIds, moleCount, voterId, historyBefore));
  }

  return normalizeBeliefs(
    beliefs.map((world) => {
      let probability = world.probability;
      for (const [voterId, vote] of Object.entries(event.votes)) {
        const nested = nestedByVoter.get(voterId) ?? [];
        probability *= voteLikelihood(
          voterId,
          vote,
          event.team,
          world,
          nested,
          event.consecutiveRejections,
          playerCount,
        );
      }
      return { moles: world.moles, probability };
    }),
  );
}

/**
 * Level-1 posterior for observer `observerId`: raids plus others' actions scored
 * against a nested level-0 brain. See `ALGORITHM.md`.
 */
export function level1BeliefsFromHistory(
  playerIds: readonly PlayerId[],
  moleCount: number,
  observerId: PlayerId,
  history: readonly BotObservation[],
): WorldBelief[] {
  let beliefs = uniformBeliefs(enumerateWorlds(playerIds, moleCount, observerId));
  for (let i = 0; i < history.length; i++) {
    const event = history[i]!;
    const historyBefore = history.slice(0, i);
    if (event.kind === 'raid') {
      beliefs = updateFromRaid(beliefs, event.team, event.sabotageCount);
    } else if (event.kind === 'proposal') {
      beliefs = updateFromProposal(beliefs, event, playerIds, moleCount, historyBefore);
    } else {
      beliefs = updateFromVotes(beliefs, event, playerIds, moleCount, historyBefore);
    }
  }
  return beliefs;
}
