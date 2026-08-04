import { describe, expect, it } from 'vitest';
import { Role } from '../../types/game';
import { createSeededRandom, createSequenceRandom, shuffle } from '../rng';
import {
  assignRoles,
  countApproves,
  countSabotages,
  createInitialState,
  isRaidActionAllowed,
  isRaidSuccessful,
  isSupportedPlayerCount,
  isTeamApproved,
  molesWinByRejectionLimit,
  pickProposerIndex,
  requiredSabotagesForRound,
  requiredTeamSize,
  winnerFromScores,
} from '../rules';
import { GamePhase } from '../../types/game';

describe('isSupportedPlayerCount', () => {
  it('accepts 5–8 only', () => {
    expect(isSupportedPlayerCount(4)).toBe(false);
    expect(isSupportedPlayerCount(5)).toBe(true);
    expect(isSupportedPlayerCount(8)).toBe(true);
    expect(isSupportedPlayerCount(9)).toBe(false);
  });
});

describe('createInitialState', () => {
  it('starts in lobby with the host seated', () => {
    const state = createInitialState('h1', 'Alice');
    expect(state.phase).toBe(GamePhase.Lobby);
    expect(state.players).toEqual([{ id: 'h1', name: 'Alice', role: null }]);
    expect(state.hostId).toBe('h1');
    expect(state.scores).toEqual({ police: 0, moles: 0 });
    expect(state.winner).toBeNull();
  });
});

describe('assignRoles', () => {
  it('assigns the correct mole / police counts', () => {
    for (const count of [5, 6, 7, 8] as const) {
      const roles = assignRoles(count, createSeededRandom(42));
      expect(roles).toHaveLength(count);
      expect(roles.filter((r) => r === Role.Mole)).toHaveLength(
        count <= 6 ? 2 : 3,
      );
      expect(roles.filter((r) => r === Role.Police)).toHaveLength(
        count - (count <= 6 ? 2 : 3),
      );
    }
  });

  it('is deterministic for a given seed', () => {
    const a = assignRoles(5, createSeededRandom(7));
    const b = assignRoles(5, createSeededRandom(7));
    expect(a).toEqual(b);
  });
});

describe('isTeamApproved', () => {
  it('requires a strict majority', () => {
    // 5 players → need > 2.5 → 3
    expect(isTeamApproved(2, 5)).toBe(false);
    expect(isTeamApproved(3, 5)).toBe(true);
    // 6 players → need > 3 → 4
    expect(isTeamApproved(3, 6)).toBe(false);
    expect(isTeamApproved(4, 6)).toBe(true);
  });
});

describe('molesWinByRejectionLimit', () => {
  it('triggers when consecutive rejections reach player count', () => {
    expect(molesWinByRejectionLimit(4, 5)).toBe(false);
    expect(molesWinByRejectionLimit(5, 5)).toBe(true);
  });
});

describe('raid success helpers', () => {
  it('fails with one sabotage by default', () => {
    expect(requiredSabotagesForRound(5, 1)).toBe(1);
    expect(isRaidSuccessful(0, 1)).toBe(true);
    expect(isRaidSuccessful(1, 1)).toBe(false);
  });

  it('requires two sabotages on round 4 for 7–8 players', () => {
    expect(requiredSabotagesForRound(7, 4)).toBe(2);
    expect(requiredSabotagesForRound(8, 4)).toBe(2);
    expect(isRaidSuccessful(1, 2)).toBe(true);
    expect(isRaidSuccessful(2, 2)).toBe(false);
  });
});

describe('winnerFromScores', () => {
  it('returns the side that reached WINS_NEEDED', () => {
    expect(winnerFromScores({ police: 2, moles: 2 })).toBeNull();
    expect(winnerFromScores({ police: 3, moles: 1 })).toBe('Police');
    expect(winnerFromScores({ police: 0, moles: 3 })).toBe('Moles');
  });
});

describe('isRaidActionAllowed', () => {
  it('blocks police sabotage and allows mole sabotage', () => {
    expect(isRaidActionAllowed(Role.Police, 'Support')).toBe(true);
    expect(isRaidActionAllowed(Role.Police, 'Sabotage')).toBe(false);
    expect(isRaidActionAllowed(Role.Mole, 'Sabotage')).toBe(true);
    expect(isRaidActionAllowed(null, 'Support')).toBe(false);
  });
});

describe('count helpers', () => {
  it('counts approves and sabotages', () => {
    expect(countApproves({ a: 'Approve', b: 'Reject', c: 'Approve' })).toBe(2);
    expect(countSabotages({ a: 'Support', b: 'Sabotage' })).toBe(1);
  });
});

describe('requiredTeamSize', () => {
  it('looks up the round’s team size', () => {
    expect(requiredTeamSize(5, 1)).toBe(2);
    expect(requiredTeamSize(5, 2)).toBe(3);
    expect(requiredTeamSize(8, 5)).toBe(5);
  });
});

describe('pickProposerIndex / shuffle', () => {
  it('picks within range', () => {
    const random = createSequenceRandom([0.99]);
    expect(pickProposerIndex(5, random)).toBe(4);
  });

  it('shuffles without mutating input', () => {
    const input = [1, 2, 3, 4];
    const out = shuffle(input, createSeededRandom(99));
    expect(input).toEqual([1, 2, 3, 4]);
    expect(out).toHaveLength(4);
    expect(out.toSorted()).toEqual([1, 2, 3, 4]);
  });
});
