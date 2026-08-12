import type { GameState, PlayerId, RaidAction, Role, Vote } from '../types/game';
import { GamePhase, Role as Roles } from '../types/game';
import {
  BALANCE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type PlayerCount,
  WINS_NEEDED,
} from './constants';
import { shuffle, type RandomFn } from './rng';

export function isSupportedPlayerCount(n: number): n is PlayerCount {
  return n >= MIN_PLAYERS && n <= MAX_PLAYERS && n in BALANCE;
}

export function createInitialState(hostId: PlayerId, hostName: string): GameState {
  return {
    phase: GamePhase.Lobby,
    players: [{ id: hostId, name: hostName, role: null }],
    hostId,
    currentRound: 1,
    scores: { police: 0, moles: 0 },
    raidResults: [],
    proposerIndex: 0,
    consecutiveRejections: 0,
    currentProposedTeam: [],
    teamVotes: {},
    raidActions: {},
    winner: null,
    timersEnabled: false,
    phaseEndsAt: null,
  };
}

/** Build a shuffled role list for the given player count. */
export function assignRoles(playerCount: PlayerCount, random: RandomFn): Role[] {
  const { moles } = BALANCE[playerCount];
  const roles: Role[] = Array.from({ length: playerCount }, (_, i) =>
    i < moles ? Roles.Mole : Roles.Police,
  );
  return shuffle(roles, random);
}

export function pickProposerIndex(playerCount: number, random: RandomFn): number {
  return Math.floor(random() * playerCount);
}

/** Strict majority: more than half of players must Approve. */
export function isTeamApproved(approveCount: number, playerCount: number): boolean {
  return approveCount > playerCount / 2;
}

export function countApproves(votes: Readonly<Record<PlayerId, Vote | null>>): number {
  return Object.values(votes).filter((v) => v === 'Approve').length;
}

export function molesWinByRejectionLimit(
  consecutiveRejections: number,
  playerCount: number,
): boolean {
  return consecutiveRejections >= playerCount;
}

export function requiredSabotagesForRound(playerCount: PlayerCount, round: number): number {
  return BALANCE[playerCount].twoSabotagesRequiredOnRound.includes(round) ? 2 : 1;
}

export function isRaidSuccessful(sabotageCount: number, requiredSabotages: number): boolean {
  return sabotageCount < requiredSabotages;
}

export function countSabotages(actions: Readonly<Record<PlayerId, RaidAction | null>>): number {
  return Object.values(actions).filter((a) => a === 'Sabotage').length;
}

export function winnerFromScores(
  scores: GameState['scores'],
): 'Police' | 'Moles' | null {
  if (scores.police >= WINS_NEEDED) return 'Police';
  if (scores.moles >= WINS_NEEDED) return 'Moles';
  return null;
}

/** Police may only Support; moles may Support or Sabotage. */
export function isRaidActionAllowed(role: Role | null | undefined, action: RaidAction): boolean {
  if (role === Roles.Police && action === 'Sabotage') return false;
  return role === Roles.Police || role === Roles.Mole;
}

export function requiredTeamSize(playerCount: PlayerCount, round: number): number {
  return BALANCE[playerCount].teamSizes[round - 1] ?? 0;
}
