/**
 * Host-only DevTools view of each Bayesian bot's posterior.
 * Other players are still modeled with raid-only (level-0) beliefs; this snapshot
 * is the level-1 posterior the bot itself uses for propose/vote (moles copy the
 * cop policy).
 */
import type { GameEvent, GamePhase, PlayerId } from '../../../types/game';
import {
  level1BeliefsFromHistory,
  moleProbability,
  noMolesOnTeamProbability,
  type WorldBelief,
} from './belief';

const DISPLAY_PROB_DECIMALS = 4;

export interface BayesianObserverDebug {
  observerId: PlayerId;
  observerName: string;
  /** Callsign → P(that seat is a mole). The observer is always 0. */
  moleP: Record<string, number>;
  /** Worlds sorted by probability; mole seats as callsigns. */
  worlds: { moles: string[]; p: number }[];
  /** P(the team on the table contains no moles), when a team is proposed. */
  pNoMolesOnProposed: number | null;
}

export interface BayesianBeliefsDebugSnapshot {
  brain: 'bayesian';
  phase: GamePhase;
  round: number;
  observationCount: number;
  proposedTeam: string[];
  /**
   * Each Bayesian observer conditions on not being a mole (moles copy
   * the cop propose/vote policy).
   */
  note: string;
  /** observer callsign → { other callsign → P(mole) } for `console.table`. */
  byObserver: Record<string, Record<string, number>>;
  /** observer callsign → P(proposed team has no moles). Empty when no team. */
  pNoMolesOnProposed: Record<string, number>;
  observers: BayesianObserverDebug[];
}

function displayProb(p: number): number {
  const f = 10 ** DISPLAY_PROB_DECIMALS;
  return Math.round(p * f) / f;
}

function callsignOf(
  players: readonly { id: PlayerId; name: string }[],
  id: PlayerId,
): string {
  return players.find((p) => p.id === id)?.name ?? id;
}

function worldsForDisplay(
  beliefs: readonly WorldBelief[],
  players: readonly { id: PlayerId; name: string }[],
): { moles: string[]; p: number }[] {
  return [...beliefs]
    .map((world) => ({
      moles: [...world.moles].map((id) => callsignOf(players, id)).sort(),
      p: displayProb(world.probability),
    }))
    .sort((a, b) => b.p - a.p || a.moles.join(',').localeCompare(b.moles.join(',')));
}

export function buildBayesianBeliefsDebugSnapshot(input: {
  players: readonly { id: PlayerId; name: string }[];
  moleCount: number;
  observerIds: readonly PlayerId[];
  history: readonly GameEvent[];
  proposedTeam: readonly PlayerId[];
  phase: GamePhase;
  currentRound: number;
}): BayesianBeliefsDebugSnapshot {
  const playerIds = input.players.map((p) => p.id);
  const teamNames = input.proposedTeam.map((id) => callsignOf(input.players, id));
  const hasTeam = input.proposedTeam.length > 0;

  const observers: BayesianObserverDebug[] = input.observerIds.map((observerId) => {
    const beliefs = level1BeliefsFromHistory(
      playerIds,
      input.moleCount,
      observerId,
      input.history,
    );
    const moleP: Record<string, number> = {};
    for (const player of input.players) {
      moleP[player.name] = displayProb(moleProbability(beliefs, player.id));
    }
    const pNoMoles = hasTeam
      ? displayProb(noMolesOnTeamProbability(beliefs, input.proposedTeam))
      : null;
    return {
      observerId,
      observerName: callsignOf(input.players, observerId),
      moleP,
      worlds: worldsForDisplay(beliefs, input.players),
      pNoMolesOnProposed: pNoMoles,
    };
  });

  const byObserver: Record<string, Record<string, number>> = {};
  const pNoMolesOnProposed: Record<string, number> = {};
  for (const observer of observers) {
    byObserver[observer.observerName] = observer.moleP;
    if (observer.pNoMolesOnProposed != null) {
      pNoMolesOnProposed[observer.observerName] = observer.pNoMolesOnProposed;
    }
  }

  return {
    brain: 'bayesian',
    phase: input.phase,
    round: input.currentRound,
    observationCount: input.history.length,
    proposedTeam: teamNames,
    note: 'Each observer conditions on not being a mole (moles copy the cop propose/vote policy).',
    byObserver,
    pNoMolesOnProposed,
    observers,
  };
}
