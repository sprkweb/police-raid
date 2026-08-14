import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { GameState, Vote, RaidAction, PlayerId } from '../types/game';
import type { NetworkService, PlayerActionPayload, SeatKind } from '../types/network';
import { createNetworkService } from '../network/createNetworkService';
import { enterRoom } from '../network/enterRoom';
import { HostRoom } from '../engine/hostRoom';
import { distributeProjectedState, sendProjectedState } from '../engine/distributeProjectedState';
import { projectForPlayer } from '../engine/projectState';
import { randomCallsign } from '../engine/callsigns';
import { clearRoomUrl, roomCodeFromLocation, syncRoomUrl } from '../network/roomUrl';
import { clearSeatSession, loadSeatSession, saveSeatSession } from '../network/seatSession';
import { normalizeRoomCode } from '../network/roomCode';

interface GameContextType {
  gameState: GameState | null;
  /** Stable seat id in GameState (not the transport peer id). */
  playerId: PlayerId | null;
  playerName: string;
  isHost: boolean;
  isSpectator: boolean;
  connecting: boolean;
  hostGone: boolean;
  /** Case code that failed to connect, if any. */
  connectErrorCode: string | null;
  /** Short shareable lobby code. */
  roomCode: string | null;
  joinRoom: (roomCode: string, name?: string) => Promise<void>;
  createRoom: (name?: string) => Promise<string>;
  renamePlayer: (name: string) => void;
  returnToCheckIn: () => Promise<void>;

  startGame: () => void;
  /** Pad lobby with bots and start when under MIN_PLAYERS. */
  startGameWithBots: () => void;
  /** Host-only lobby toggle for phase time limits. */
  setTimersEnabled: (enabled: boolean) => void;
  endDiscussion: () => void;
  proposeTeam: (team: PlayerId[]) => void;
  skipProposal: () => void;
  voteTeam: (vote: Vote) => void;
  submitRaidAction: (action: RaidAction) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(null);
  const [myName, setMyName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [seatKind, setSeatKind] = useState<SeatKind>('player');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hostGone, setHostGone] = useState(false);
  const [connectErrorCode, setConnectErrorCode] = useState<string | null>(null);

  const networkRef = useRef<NetworkService | null>(null);
  const hostRoomRef = useRef<HostRoom | null>(null);
  const hostPeerIdRef = useRef<PlayerId | null>(null);
  const mySeatIdRef = useRef<PlayerId | null>(null);
  const seatedRef = useRef(false);
  const busyRef = useRef(false);
  const joinRoomRef = useRef<(code: string, name?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    networkRef.current = createNetworkService();
    const code = roomCodeFromLocation();
    if (code) void joinRoomRef.current(code).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __PR_GAME_STATE__?: typeof gameState }).__PR_GAME_STATE__ = gameState;
  }, [gameState]);

  const handleHostStateChange = (newState: GameState) => {
    const network = networkRef.current;
    const room = hostRoomRef.current;
    if (network && room) {
      distributeProjectedState(network, newState, room.seats);
    }
    const viewerId = room?.hostSeatId;
    setGameState(viewerId ? projectForPlayer(newState, viewerId) : { ...newState });
    const me = viewerId
      ? newState.players.find((p) => p.id === viewerId) ?? newState.spectators.find((s) => s.id === viewerId)
      : undefined;
    if (me) setMyName(me.name);
  };

  const wireHostHandlers = (network: NetworkService, room: HostRoom) => {
    network.onMessage((from, msg) => {
      if (msg.type === 'JOIN_REQUEST') {
        const name = typeof msg.payload?.name === 'string' ? msg.payload.name : '';
        const response = room.handleJoinRequest(from, name);
        if (!response) return;
        network.sendMessage(from, { type: 'JOIN_RESPONSE', payload: response });
        sendProjectedState(network, room.engine.getState(), from, response.seatId);
        return;
      }
      if (msg.type === 'RECLAIM') {
        const payload = msg.payload;
        if (!payload || typeof payload.seatId !== 'string' || typeof payload.secret !== 'string') return;
        const response = room.handleReclaim(from, payload);
        if (!response) return;
        network.sendMessage(from, { type: 'JOIN_RESPONSE', payload: response });
        sendProjectedState(network, room.engine.getState(), from, response.seatId);
        return;
      }
      if (msg.type === 'PLAYER_ACTION') {
        room.handleAction(from, msg.payload as PlayerActionPayload);
      }
    });

    network.onDisconnect((disconnectedId) => {
      room.handleDisconnect(disconnectedId);
    });
  };

  const createRoom = async (myPlayerName?: string): Promise<string> => {
    if (!networkRef.current) throw new Error('Network not initialized');
    if (busyRef.current || seatedRef.current) return networkRef.current.roomCode ?? '';
    busyRef.current = true;
    setConnecting(true);
    setHostGone(false);
    setConnectErrorCode(null);
    try {
      const callsign = (myPlayerName ?? '').trim() || randomCallsign();
      const code = await networkRef.current.initializeAsHost();
      const hostPeerId = networkRef.current.playerId;
      if (!hostPeerId) throw new Error('Missing peer id after host init');

      const room = new HostRoom(hostPeerId, callsign, handleHostStateChange);
      hostRoomRef.current = room;
      hostPeerIdRef.current = hostPeerId;
      mySeatIdRef.current = room.hostSeatId;
      seatedRef.current = true;

      setMyName(callsign);
      setIsHost(true);
      setSeatKind('player');
      setRoomCode(code);
      setMyPlayerId(room.hostSeatId);
      setGameState(projectForPlayer(room.engine.getState(), room.hostSeatId));
      syncRoomUrl(code);

      wireHostHandlers(networkRef.current, room);
      return code;
    } finally {
      busyRef.current = false;
      setConnecting(false);
    }
  };

  const joinRoom = async (code: string, myPlayerName?: string): Promise<void> => {
    const network = networkRef.current;
    if (!network) throw new Error('Network not initialized');
    if (!code) throw new Error('Room code is empty');
    if (busyRef.current || seatedRef.current) return;
    busyRef.current = true;
    setConnecting(true);
    setHostGone(false);
    setConnectErrorCode(null);
    const normalized = normalizeRoomCode(code);
    try {
      const callsign = (myPlayerName ?? '').trim() || randomCallsign();
      const session = loadSeatSession(normalized);
      mySeatIdRef.current = session?.seatId ?? null;
      const joined = await enterRoom(network, normalized, {
        name: callsign,
        session,
        onGameState: (state) => {
          setGameState(state);
          const viewer = joinedSeatName(state, mySeatIdRef.current);
          if (viewer) setMyName(viewer);
        },
      });

      mySeatIdRef.current = joined.seatId;
      seatedRef.current = true;
      setIsHost(false);
      setMyPlayerId(joined.seatId);
      setSeatKind(joined.kind);
      setRoomCode(joined.roomCode);
      setGameState(joined.state);
      hostPeerIdRef.current = joined.hostPeerId;
      const named = joinedSeatName(joined.state, joined.seatId);
      setMyName(named ?? callsign);
      saveSeatSession(joined.roomCode, {
        seatId: joined.seatId,
        secret: joined.secret,
        hostPeerId: joined.hostPeerId,
        kind: joined.kind,
      });
      syncRoomUrl(joined.roomCode);

      network.onDisconnect((disconnectedId) => {
        if (disconnectedId === hostPeerIdRef.current) {
          setHostGone(true);
        }
      });
    } catch (err) {
      clearSeatSession(normalized);
      clearRoomUrl();
      setConnectErrorCode(normalized);
      throw err;
    } finally {
      busyRef.current = false;
      setConnecting(false);
    }
  };
  joinRoomRef.current = joinRoom;

  const returnToCheckIn = async () => {
    const code = roomCode;
    hostRoomRef.current?.dispose();
    hostRoomRef.current = null;
    hostPeerIdRef.current = null;
    mySeatIdRef.current = null;
    seatedRef.current = false;
    await networkRef.current?.disconnect().catch(() => undefined);
    networkRef.current = createNetworkService();
    if (code) clearSeatSession(code);
    clearRoomUrl();
    setGameState(null);
    setMyPlayerId(null);
    setMyName('');
    setIsHost(false);
    setSeatKind('player');
    setRoomCode(null);
    setHostGone(false);
    setConnecting(false);
    setConnectErrorCode(null);
    busyRef.current = false;
  };

  const sendAction = (payload: PlayerActionPayload) => {
    const network = networkRef.current;
    const room = hostRoomRef.current;
    if (network?.isHost && room && network.playerId) {
      room.handleAction(network.playerId, payload);
      return;
    }
    const hostPeerId = hostPeerIdRef.current;
    if (network && hostPeerId) {
      network.sendMessage(hostPeerId, { type: 'PLAYER_ACTION', payload });
    }
  };

  const renamePlayer = (name: string) => {
    sendAction({ type: 'RENAME', name });
  };

  return (
    <GameContext.Provider value={{
      gameState,
      playerId: myPlayerId,
      playerName: myName,
      isHost,
      isSpectator: seatKind === 'spectator',
      connecting,
      hostGone,
      connectErrorCode,
      roomCode,
      joinRoom,
      createRoom,
      renamePlayer,
      returnToCheckIn,
      startGame: () => sendAction({ type: 'START_GAME' }),
      startGameWithBots: () => {
        hostRoomRef.current?.engine.startGameWithBots();
      },
      setTimersEnabled: (enabled) => {
        hostRoomRef.current?.engine.setTimersEnabled(enabled);
      },
      endDiscussion: () => {
        hostRoomRef.current?.engine.endDiscussion();
      },
      proposeTeam: (team) => sendAction({ type: 'PROPOSE_TEAM', team }),
      skipProposal: () => sendAction({ type: 'SKIP_PROPOSAL' }),
      voteTeam: (vote) => sendAction({ type: 'VOTE_TEAM', vote }),
      submitRaidAction: (action) => sendAction({ type: 'RAID_ACTION', action }),
    }}>
      {children}
    </GameContext.Provider>
  );
};

function joinedSeatName(state: GameState, seatId: PlayerId | null | undefined): string | undefined {
  if (!seatId) return undefined;
  return (
    state.players.find((p) => p.id === seatId)?.name ??
    state.spectators.find((s) => s.id === seatId)?.name
  );
}
