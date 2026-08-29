import type { GameEvent, GameState, PlayerId, RaidAction, Vote } from '../types/game';
import { GamePhase, Role } from '../types/game';

/** Approve/Reject values are public after voting closes, including during the raid. */
export function teamVotesArePublic(phase: GamePhase): boolean {
  return phase === GamePhase.VoteResult || phase === GamePhase.Raid;
}

function cloneHistory(history: readonly GameEvent[]): GameEvent[] {
  return history.map((event) => {
    if (event.kind === 'proposal') {
      return { kind: 'proposal', proposerId: event.proposerId, team: [...event.team] };
    }
    if (event.kind === 'votes') {
      return {
        kind: 'votes',
        team: [...event.team],
        votes: { ...event.votes },
        consecutiveRejections: event.consecutiveRejections,
      };
    }
    return {
      kind: 'raid',
      team: [...event.team],
      sabotageCount: event.sabotageCount,
      proposerId: event.proposerId,
      round: event.round,
    };
  });
}

/**
 * Build the view of authoritative game state that `viewerId` is allowed to see.
 *
 * Visibility matches the UI:
 * - Own role always; moles see fellow moles; everyone sees all roles on GameOver.
 * - Mid-vote: who has cast a ballot (key present); only own Approve/Reject value.
 * - After voting (VoteResult, Raid): every Approve/Reject value.
 * - Raid actions: who has submitted (key present); values are never shown.
 */
export function projectForPlayer(state: GameState, viewerId: PlayerId): GameState {
  const viewer = state.players.find((p) => p.id === viewerId);
  const viewerRole = viewer?.role ?? null;
  const revealAllRoles = state.phase === GamePhase.GameOver;
  const revealVotes = teamVotesArePublic(state.phase);

  const players = state.players.map((p) => {
    if (revealAllRoles || p.id === viewerId) {
      return { ...p };
    }
    if (viewerRole === Role.Mole && p.role === Role.Mole) {
      return { ...p };
    }
    return { ...p, role: null };
  });

  const teamVotes: Record<PlayerId, Vote | null> = {};
  for (const [id, vote] of Object.entries(state.teamVotes)) {
    teamVotes[id] = revealVotes || id === viewerId ? vote : null;
  }

  // Values stay hidden. Key presence is only for the viewer's own "report sent".
  const raidActions: Record<PlayerId, RaidAction | null> = {};
  for (const id of Object.keys(state.raidActions)) {
    raidActions[id] = null;
  }

  return {
    ...state,
    players,
    spectators: state.spectators.map((s) => ({ ...s })),
    scores: { ...state.scores },
    raidResults: state.raidResults.map((r) => ({ ...r, team: [...r.team] })),
    history: cloneHistory(state.history),
    currentProposedTeam: [...state.currentProposedTeam],
    teamVotes,
    raidActions,
  };
}
