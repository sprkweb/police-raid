import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { GameState, Vote, RaidAction, PlayerId } from '../types/game';
import type { NetworkService, PlayerActionPayload } from '../types/network';
import { createNetworkService } from '../network/createNetworkService';
import { applyPlayerAction } from '../engine/applyAction';
import { GameEngine } from '../engine/GameEngine';

interface GameContextType {
  gameState: GameState | null;
  /** This tab's player id in GameState. */
  playerId: PlayerId | null;
  myName: string;
  isHost: boolean;
  /** Short shareable lobby code. */
  roomCode: string | null;
  joinRoom: (roomCode: string, name: string) => Promise<void>;
  createRoom: (name: string) => Promise<string>;

  startGame: () => void;
  /** DEV-only: pad with bots and start solo. */
  startGameWithBots: () => void;
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
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [myName, setMyName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const networkRef = useRef<NetworkService | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    networkRef.current = createNetworkService();
  }, []);

  const handleStateChange = (newState: GameState) => {
    setGameState({ ...newState });
    if (networkRef.current?.isHost) {
      networkRef.current.broadcast({ type: 'GAME_STATE_UPDATE', payload: newState });
    }
  };

  const createRoom = async (name: string): Promise<string> => {
    if (!networkRef.current) throw new Error('Network not initialized');
    setMyName(name);
    setIsHost(true);
    const code = await networkRef.current.initializeAsHost();
    const id = networkRef.current.playerId;
    if (!id) throw new Error('Missing player id after host init');
    setRoomCode(code);
    setPlayerId(id);

    engineRef.current = new GameEngine(id, name, handleStateChange);
    setGameState(engineRef.current.getState());

    networkRef.current.onMessage((from, msg) => {
      if (!engineRef.current) return;
      if (msg.type === 'JOIN_REQUEST') {
        engineRef.current.addPlayer(from, msg.payload.name);
      } else if (msg.type === 'PLAYER_ACTION') {
        applyPlayerAction(engineRef.current, from, msg.payload as PlayerActionPayload);
      }
    });

    networkRef.current.onDisconnect((disconnectedId) => {
      engineRef.current?.removePlayer(disconnectedId);
    });

    return code;
  };

  const joinRoom = async (code: string, name: string) => {
    if (!networkRef.current) throw new Error('Network not initialized');
    setMyName(name);
    setIsHost(false);
    const id = await networkRef.current.initializeAsClient(code);
    setPlayerId(id);
    setRoomCode(networkRef.current.roomCode);

    networkRef.current.onMessage((_from, msg) => {
      if (msg.type === 'GAME_STATE_UPDATE') {
        setGameState(msg.payload);
      }
    });

    networkRef.current.sendMessage(id, { type: 'JOIN_REQUEST', payload: { name } });
  };

  const sendAction = (payload: PlayerActionPayload) => {
    if (networkRef.current?.isHost && engineRef.current && playerId) {
      applyPlayerAction(engineRef.current, playerId, payload);
    } else if (networkRef.current && gameState) {
      networkRef.current.sendMessage(gameState.hostId, { type: 'PLAYER_ACTION', payload });
    }
  };

  return (
    <GameContext.Provider value={{
      gameState, playerId, myName, isHost, roomCode,
      joinRoom, createRoom,
      startGame: () => sendAction({ type: 'START_GAME' }),
      startGameWithBots: () => {
        if (import.meta.env.DEV && networkRef.current?.isHost) {
          engineRef.current?.startGameWithBots();
        }
      },
      endDiscussion: () => { if (networkRef.current?.isHost) engineRef.current?.endDiscussion() },
      proposeTeam: (team) => sendAction({ type: 'PROPOSE_TEAM', team }),
      skipProposal: () => sendAction({ type: 'SKIP_PROPOSAL' }),
      voteTeam: (vote) => sendAction({ type: 'VOTE_TEAM', vote }),
      submitRaidAction: (action) => sendAction({ type: 'RAID_ACTION', action }),
    }}>
      {children}
    </GameContext.Provider>
  );
};
