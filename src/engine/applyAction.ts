import type { PlayerActionPayload } from '../types/network';
import type { GameEngine } from './GameEngine';

/** Route a networked player action onto the host GameEngine. */
export function applyPlayerAction(
  engine: GameEngine,
  playerId: string,
  payload: PlayerActionPayload,
): void {
  switch (payload.type) {
    case 'START_GAME':
      if (playerId === engine.getState().hostId) {
        engine.startGame();
      }
      break;
    case 'PROPOSE_TEAM':
      engine.proposeTeam(playerId, payload.team);
      break;
    case 'SKIP_PROPOSAL':
      engine.skipProposal(playerId);
      break;
    case 'VOTE_TEAM':
      engine.voteTeam(playerId, payload.vote);
      break;
    case 'RAID_ACTION':
      engine.submitRaidAction(playerId, payload.action);
      break;
  }
}
