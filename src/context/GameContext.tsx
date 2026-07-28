import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { GameState, Vote, RaidAction, PlayerId } from '../types/game';
import type { PlayerActionPayload } from '../types/network';
import { PeerNetworkService } from '../network/PeerNetworkService';
import { GameEngine } from '../engine/GameEngine';

interface GameContextType {
  gameState: GameState | null;
  myId: string | null;
  myName: string;
  isHost: boolean;
  joinRoom: (roomId: string, name: string) => Promise<void>;
  createRoom: (name: string) => Promise<string>;

  startGame: () => void;
  endDiscussion: () => void;
  proposeTeam: (team: PlayerId[]) => void;
  skipProposal: () => void;
  voteTeam: (vote: Vote) => void;
  submitRaidAction: (action: RaidAction) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};

export const GameProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);

  const networkRef = useRef<PeerNetworkService | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    networkRef.current = new PeerNetworkService();
  }, []);

  const handleStateChange = (newState: GameState) => {
    setGameState({ ...newState });
    if (isHost && networkRef.current) {
      networkRef.current.broadcast({ type: 'GAME_STATE_UPDATE', payload: newState });
    }
  };

  const createRoom = async (name: string): Promise<string> => {
    if (!networkRef.current) throw new Error('Network not initialized');
    setMyName(name);
    setIsHost(true);
    const roomId = await networkRef.current.initializeAsHost();
    setMyId(roomId);

    engineRef.current = new GameEngine(roomId, name, handleStateChange);
    setGameState(engineRef.current.getState());

    networkRef.current.onMessage((from, msg) => {
      if (!engineRef.current) return;
      if (msg.type === 'JOIN_REQUEST') {
        engineRef.current.addPlayer(from, msg.payload.name);
      } else if (msg.type === 'PLAYER_ACTION') {
        const payload = msg.payload as PlayerActionPayload;
        switch (payload.type) {
          case 'START_GAME':
            engineRef.current.startGame();
            break;
          case 'PROPOSE_TEAM':
            engineRef.current.proposeTeam(from, payload.team);
            break;
          case 'SKIP_PROPOSAL':
            engineRef.current.skipProposal(from);
            break;
          case 'VOTE_TEAM':
            engineRef.current.voteTeam(from, payload.vote);
            break;
          case 'RAID_ACTION':
            engineRef.current.submitRaidAction(from, payload.action);
            break;
        }
      }
    });

    return roomId;
  };

  const joinRoom = async (roomId: string, name: string) => {
    if (!networkRef.current) throw new Error('Network not initialized');
    setMyName(name);
    setIsHost(false);
    const id = await networkRef.current.initializeAsClient(roomId);
    setMyId(id);

    networkRef.current.onMessage((_from, msg) => {
      if (msg.type === 'GAME_STATE_UPDATE') {
        setGameState(msg.payload);
      }
    });

    networkRef.current.sendMessage(roomId, { type: 'JOIN_REQUEST', payload: { name } });
  };

  const sendAction = (payload: PlayerActionPayload) => {
    if (isHost && engineRef.current && myId) {
       switch (payload.type) {
        case 'START_GAME': engineRef.current.startGame(); break;
        case 'PROPOSE_TEAM': engineRef.current.proposeTeam(myId, payload.team); break;
        case 'SKIP_PROPOSAL': engineRef.current.skipProposal(myId); break;
        case 'VOTE_TEAM': engineRef.current.voteTeam(myId, payload.vote); break;
        case 'RAID_ACTION': engineRef.current.submitRaidAction(myId, payload.action); break;
      }
    } else if (networkRef.current && gameState) {
      networkRef.current.sendMessage(gameState.hostId, { type: 'PLAYER_ACTION', payload });
    }
  };

  return (
    <GameContext.Provider value={{
      gameState, myId, myName, isHost,
      joinRoom, createRoom,
      startGame: () => sendAction({ type: 'START_GAME' }),
      endDiscussion: () => { if (isHost) engineRef.current?.endDiscussion() },
      proposeTeam: (team) => sendAction({ type: 'PROPOSE_TEAM', team }),
      skipProposal: () => sendAction({ type: 'SKIP_PROPOSAL' }),
      voteTeam: (vote) => sendAction({ type: 'VOTE_TEAM', vote }),
      submitRaidAction: (action) => sendAction({ type: 'RAID_ACTION', action }),
    }}>
      {children}
    </GameContext.Provider>
  );
};
