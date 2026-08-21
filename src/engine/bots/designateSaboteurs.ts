/**
 * Community sabotage convention: who among the moles on this raid should fail it.
 * Reconstructs “already sabotaged” from public k + the same convention, not hidden cards.
 */
import { isSupportedPlayerCount, requiredSabotagesForRound } from '../rules';
import type { BotObservation } from './types';
import type { PlayerId } from '../../types/game';

export interface DesignateSaboteursInput {
  team: readonly PlayerId[];
  moleIds: readonly PlayerId[];
  proposerId: PlayerId;
  seatingOrder: readonly PlayerId[];
  priorSaboteurs: readonly PlayerId[];
  requiredSabotages: number;
}

function molesOnRaid(team: readonly PlayerId[], moleIds: readonly PlayerId[]): PlayerId[] {
  const moles = new Set(moleIds);
  return team.filter((id) => moles.has(id));
}

function bySeating(ids: readonly PlayerId[], seatingOrder: readonly PlayerId[]): PlayerId[] {
  const set = new Set(ids);
  return seatingOrder.filter((id) => set.has(id));
}

/**
 * Priority: (1) moles on this raid who already sabotaged, in first-fail order;
 * (2) the proposer if they are a remaining mole on the raid;
 * (3) remaining moles by seating index (closer to the first seat).
 */
export function designateSaboteurs(input: DesignateSaboteursInput): PlayerId[] {
  const onRaid = molesOnRaid(input.team, input.moleIds);
  if (onRaid.length === 0) return [];

  const need = Math.min(input.requiredSabotages, onRaid.length);
  if (need <= 0) return [];

  const onRaidSet = new Set(onRaid);
  const priorOnRaid = input.priorSaboteurs.filter((id) => onRaidSet.has(id));
  const chosen: PlayerId[] = [];
  const taken = new Set<PlayerId>();

  const take = (id: PlayerId) => {
    if (taken.has(id) || !onRaidSet.has(id)) return;
    taken.add(id);
    chosen.push(id);
  };

  for (const id of priorOnRaid) {
    take(id);
    if (chosen.length >= need) return chosen.slice(0, need);
  }

  if (priorOnRaid.length === 0) {
    take(input.proposerId);
    if (chosen.length >= need) return chosen.slice(0, need);
  } else if (!taken.has(input.proposerId)) {
    take(input.proposerId);
    if (chosen.length >= need) return chosen.slice(0, need);
  }

  for (const id of bySeating(onRaid, input.seatingOrder)) {
    take(id);
    if (chosen.length >= need) return chosen.slice(0, need);
  }

  return chosen.slice(0, need);
}

/** Walk past raids and credit designated saboteurs whenever public k > 0. */
export function priorSaboteursFromHistory(
  moleIds: readonly PlayerId[],
  seatingOrder: readonly PlayerId[],
  history: readonly BotObservation[],
): PlayerId[] {
  const playerCount = seatingOrder.length;
  const prior: PlayerId[] = [];

  for (const event of history) {
    if (event.kind !== 'raid') continue;
    const requiredSabotages = isSupportedPlayerCount(playerCount)
      ? requiredSabotagesForRound(playerCount, event.round)
      : 1;
    const designated = designateSaboteurs({
      team: event.team,
      moleIds,
      proposerId: event.proposerId,
      seatingOrder,
      priorSaboteurs: prior,
      requiredSabotages,
    });
    if (event.sabotageCount <= 0) continue;
    const credited = designated.slice(0, event.sabotageCount);
    for (const id of credited) {
      if (!prior.includes(id)) prior.push(id);
    }
  }

  return prior;
}
