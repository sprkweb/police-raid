/**
 * Beliefs over mole-set hypotheses, plus cop/mole policies used both for our
 * action and as the level-0 model of other players (raid-only, so ToM does not recurse).
 */
import type { GameEvent, PlayerId, Vote } from '../../../types/game';
import type { RandomFn } from '../../rng';
import {
  NO_MOLES_VOTE_THRESHOLD,
  ZERO_EPS,
  COP_ACTION_MATCH,
  COP_ACTION_MISMATCH,
  MOLE_ACTION_MATCH,
  MOLE_ACTION_MISMATCH,
  SABOTAGE_RATE,
} from './constants';
import { binomialCoefficient, combinations } from './combinations';

export interface WorldBelief {
  moles: readonly PlayerId[];
  probability: number;
}

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
  if (beliefs.length === 0) return [];
  const alive = beliefs.filter((b) => b.probability > ZERO_EPS);
  if (alive.length === 0) {
    const probability = 1 / beliefs.length;
    return beliefs.map((b) => ({ moles: b.moles, probability }));
  }
  const sum = alive.reduce((acc, b) => acc + b.probability, 0);
  return alive.map((b) => ({ moles: b.moles, probability: b.probability / sum }));
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
export function noMolesOnTeamProbability(beliefs: readonly WorldBelief[], team: readonly PlayerId[]): number {
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
    SABOTAGE_RATE ** sabotageCount *
    (1 - SABOTAGE_RATE) ** (moleCountOnTeam - sabotageCount)
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
 * Level-0 belief: raid outcomes only. Used as the other-player (predicted) brain.
 * Does not interpret proposals or votes (that would be level-2+).
 */
export function beliefsFromRaids(
  playerIds: readonly PlayerId[],
  moleCount: number,
  observerId: PlayerId,
  history: readonly GameEvent[],
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
    if (s > best + ZERO_EPS) {
      best = s;
      winners.length = 0;
      winners.push(team);
    } else if (Math.abs(s - best) <= ZERO_EPS) {
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

export function copProposeTeams(
  actorId: PlayerId,
  playerIds: readonly PlayerId[],
  teamSize: number,
  beliefs: readonly WorldBelief[],
): PlayerId[][] {
  return argmaxTeams(teamsIncludingActor(actorId, playerIds, teamSize), (team) =>
    noMolesOnTeamProbability(beliefs, team),
  );
}

export function moleProposeTeams(
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
  return argmaxTeams(pool, (team) => noMolesOnTeamProbability(beliefs, team));
}

/**
 * Cop vote policy: Approve at the rejection limit; otherwise on-team unless
 * P(no moles) is ~0, off-team only if P(no moles) meets the threshold.
 * Same function is used for our action and as the level-0 prediction of others.
 */
export function copVote(
  actorId: PlayerId,
  team: readonly PlayerId[],
  beliefs: readonly WorldBelief[],
  consecutiveRejections: number,
  playerCount: number,
): Vote {
  if (consecutiveRejections >= playerCount - 1) return 'Approve';
  const pNoMoles = noMolesOnTeamProbability(beliefs, team);
  if (team.includes(actorId)) {
    return pNoMoles <= ZERO_EPS ? 'Reject' : 'Approve';
  }
  return pNoMoles >= NO_MOLES_VOTE_THRESHOLD ? 'Approve' : 'Reject';
}

/** Mole vote in a candidate world: pass a team that already contains a mole from that world. */
export function moleVote(team: readonly PlayerId[], worldMoles: readonly PlayerId[]): Vote {
  return teamIntersectsMoles(team, worldMoles) ? 'Approve' : 'Reject';
}

function proposalLikelihoodForWorld(
  proposerId: PlayerId,
  team: readonly PlayerId[],
  world: WorldBelief,
  copBest: readonly PlayerId[][],
): number {
  const matchesCop = teamInList(team, copBest);
  // Self-including mole proposals use the same argmax as the cop policy.
  if (world.moles.includes(proposerId)) {
    return matchesCop ? MOLE_ACTION_MATCH : MOLE_ACTION_MISMATCH;
  }
  return matchesCop ? COP_ACTION_MATCH : COP_ACTION_MISMATCH;
}

function updateFromProposal(
  beliefs: readonly WorldBelief[],
  event: Extract<GameEvent, { kind: 'proposal' }>,
  playerIds: readonly PlayerId[],
  level0Beliefs: readonly WorldBelief[],
): WorldBelief[] {
  const copBest = copProposeTeams(
    event.proposerId,
    playerIds,
    event.team.length,
    level0Beliefs,
  );
  return normalizeBeliefs(
    beliefs.map((world) => ({
      moles: world.moles,
      probability:
        world.probability * proposalLikelihoodForWorld(event.proposerId, event.team, world, copBest),
    })),
  );
}

function updateFromVotes(
  beliefs: readonly WorldBelief[],
  event: Extract<GameEvent, { kind: 'votes' }>,
  level0ByVoter: ReadonlyMap<PlayerId, readonly WorldBelief[]>,
  playerCount: number,
): WorldBelief[] {
  const copVoteByVoter = new Map<PlayerId, Vote>();
  for (const voterId of Object.keys(event.votes)) {
    const level0Beliefs = level0ByVoter.get(voterId) ?? [];
    copVoteByVoter.set(
      voterId,
      copVote(voterId, event.team, level0Beliefs, event.consecutiveRejections, playerCount),
    );
  }

  return normalizeBeliefs(
    beliefs.map((world) => {
      let probability = world.probability;
      for (const [voterId, vote] of Object.entries(event.votes)) {
        const voterIsMole = world.moles.includes(voterId);
        const expected = voterIsMole
          ? moleVote(event.team, world.moles)
          : (copVoteByVoter.get(voterId) ?? 'Reject');
        const match = voterIsMole ? MOLE_ACTION_MATCH : COP_ACTION_MATCH;
        const mismatch = voterIsMole ? MOLE_ACTION_MISMATCH : COP_ACTION_MISMATCH;
        probability *= vote === expected ? match : mismatch;
      }
      return { moles: world.moles, probability };
    }),
  );
}

function raidBeliefsFor(
  cache: Map<PlayerId, WorldBelief[]>,
  playerIds: readonly PlayerId[],
  moleCount: number,
  observerId: PlayerId,
  raidHistory: readonly GameEvent[],
): WorldBelief[] {
  const cached = cache.get(observerId);
  if (cached) return cached;
  const beliefs = beliefsFromRaids(playerIds, moleCount, observerId, raidHistory);
  cache.set(observerId, beliefs);
  return beliefs;
}

/**
 * Level-1 posterior for observer `observerId`: raids plus others' actions scored
 * against a level-0 (raid-only) model of each other player.
 */
export function level1BeliefsFromHistory(
  playerIds: readonly PlayerId[],
  moleCount: number,
  observerId: PlayerId,
  history: readonly GameEvent[],
): WorldBelief[] {
  let beliefs = uniformBeliefs(enumerateWorlds(playerIds, moleCount, observerId));
  const raidHistory: GameEvent[] = [];
  const raidBeliefCache = new Map<PlayerId, WorldBelief[]>();

  for (const event of history) {
    if (event.kind === 'raid') {
      beliefs = updateFromRaid(beliefs, event.team, event.sabotageCount);
      raidHistory.push(event);
      raidBeliefCache.clear();
    } else if (event.kind === 'proposal') {
      const level0Beliefs = raidBeliefsFor(
        raidBeliefCache,
        playerIds,
        moleCount,
        event.proposerId,
        raidHistory,
      );
      beliefs = updateFromProposal(beliefs, event, playerIds, level0Beliefs);
    } else {
      const level0ByVoter = new Map<PlayerId, WorldBelief[]>();
      for (const voterId of Object.keys(event.votes)) {
        level0ByVoter.set(
          voterId,
          raidBeliefsFor(raidBeliefCache, playerIds, moleCount, voterId, raidHistory),
        );
      }
      beliefs = updateFromVotes(beliefs, event, level0ByVoter, playerIds.length);
    }
  }
  return beliefs;
}
