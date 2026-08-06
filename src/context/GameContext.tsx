import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { GameState, Vote, RaidAction, PlayerId } from '../types/game';
import type { NetworkService, PlayerActionPayload } from '../types/network';
import { createNetworkService } from '../network/createNetworkService';
import { applyPlayerAction } from '../engine/applyAction';
import { GameEngine } from '../engine/GameEngine';

interface GameContextType {
  gameState: GameState | null;
  /** This player's id in GameState. */
  playerId: PlayerId | null;
  playerName: string;
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
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(null);
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

  const createRoom = async (myPlayerName: string): Promise<string> => {
    if (!networkRef.current) throw new Error('Network not initialized');

    const roomCode = await networkRef.current.initializeAsHost();
    const myPlayerId = networkRef.current.playerId;
    if (!myPlayerId) throw new Error('Missing player id after host init');

    setMyName(myPlayerName);
    setIsHost(true);
    setRoomCode(roomCode);
    setMyPlayerId(myPlayerId);

    engineRef.current = new GameEngine(myPlayerId, myPlayerName, handleStateChange);
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

    return roomCode;
  };

  const joinRoom = async (roomCode: string, myPlayerName: string): Promise<void> => {
    if (!networkRef.current) throw new Error('Network not initialized');
    if (!roomCode) throw new Error('Room code is empty');

    networkRef.current.onMessage((_from, msg) => {
      if (msg.type === 'GAME_STATE_UPDATE') {
        setGameState(msg.payload);
      }
    });

    const myPlayerId = await networkRef.current.initializeAsClient(roomCode);

    setMyName(myPlayerName);
    setIsHost(false);
    setMyPlayerId(myPlayerId);
    setRoomCode(networkRef.current.roomCode);

    networkRef.current.sendMessage(myPlayerId, { type: 'JOIN_REQUEST', payload: { name: myPlayerName } });
  };

  const sendAction = (payload: PlayerActionPayload) => {
    if (networkRef.current?.isHost && engineRef.current && myPlayerId) {
      applyPlayerAction(engineRef.current, myPlayerId, payload);
    } else if (networkRef.current && gameState) {
      networkRef.current.sendMessage(gameState.hostId, { type: 'PLAYER_ACTION', payload });
    }
  };

  return (
    <GameContext.Provider value={{
      gameState, playerId: myPlayerId, playerName: myName, isHost, roomCode,
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
