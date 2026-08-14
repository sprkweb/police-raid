import type { GameState, PlayerId, RaidAction, Vote } from '../types/game';
import { GamePhase, Role } from '../types/game';

/**
 * Build the view of authoritative game state that `viewerId` is allowed to see.
 *
 * Visibility matches the UI:
 * - Own role always; moles see fellow moles; everyone sees all roles on GameOver.
 * - Mid-vote: who has cast a ballot (key present); only own Approve/Reject value.
 * - Mid-raid: who has submitted (key present); action values are never shown.
 */
export function projectForPlayer(state: GameState, viewerId: PlayerId): GameState {
  const viewer = state.players.find((p) => p.id === viewerId);
  const viewerRole = viewer?.role ?? null;
  const revealAllRoles = state.phase === GamePhase.GameOver;

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
    teamVotes[id] = id === viewerId ? vote : null;
  }

  // UI only uses key presence ("report sent" / waiting marks), never Support/Sabotage.
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
    currentProposedTeam: [...state.currentProposedTeam],
    teamVotes,
    raidActions,
  };
}
