cat << 'INNER_EOF' > src/components/Lobby.tsx
import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next';

export const Lobby: React.FC = () => {
  const { createRoom, joinRoom, gameState, startGame, isHost, myId } = useGame();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  if (gameState) {
    return (
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-2xl shadow-black/50 relative z-10">
        <h2 className="text-2xl font-bold mb-6 text-center text-white uppercase tracking-widest">{t('lobby.room', { hostId: gameState.hostId })}</h2>

        {isHost && (
          <div className="mb-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">{t('lobby.yourLobbyId')}</p>
            <div className="flex items-center gap-2">
              <code className="bg-gray-950 p-3 rounded flex-1 text-center font-mono text-xl text-blue-400 select-all border border-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                {gameState.hostId}
              </code>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Отправьте этот код другим игрокам</p>
          </div>
        )}

        <div className="mb-8">
          <h3 className="font-bold mb-3 text-gray-300 uppercase tracking-widest text-sm">{t('lobby.players', { current: gameState.players.length })}</h3>
          <ul className="space-y-2">
            {gameState.players.map(p => (
              <li key={p.id} className="p-3 bg-gray-800 rounded border border-gray-700 flex justify-between items-center text-gray-200">
                <span>{p.name} {p.id === myId ? <span className="text-xs text-gray-500 ml-1">(вы)</span> : ''}</span>
                {p.id === gameState.hostId && <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-1 rounded border border-blue-500/30 uppercase tracking-wider">{t('lobby.host')}</span>}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            disabled={gameState.players.length < 5 || gameState.players.length > 8}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-lg uppercase tracking-wider transition-colors cursor-pointer shadow-[0_0_15px_rgba(37,99,235,0.3)]"
          >
            {t('lobby.startGame')}
          </button>
        ) : (
          <div className="text-center p-4 bg-gray-800 rounded-lg border border-gray-700">
            <p className="text-gray-400 animate-pulse uppercase tracking-widest text-sm">{t('lobby.waitingForHostStart')}</p>
          </div>
        )}

        {isHost && (gameState.players.length < 5 || gameState.players.length > 8) && (
          <p className="text-red-400/80 text-xs text-center mt-3 font-mono">
            Требуется от 5 до 8 игроков
          </p>
        )}
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) return setError(t('lobby.errorEnterName'));
    try {
      await createRoom(name);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError(t('lobby.errorEnterName'));
    if (!roomCode.trim()) return setError(t('lobby.errorEnterRoomCode'));
    try {
      await joinRoom(roomCode, name);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-2xl shadow-black/50 relative z-10">
      <h2 className="text-3xl font-bold mb-8 text-center uppercase tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
        {t('lobby.title')}
      </h2>

      {error && (
        <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 text-red-400 rounded-lg text-sm text-center font-mono relative">
          {error}
          <button
            onClick={() => setError('')}
            className="absolute top-2 right-2 text-red-500 hover:text-red-300 font-bold leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-gray-400 text-xs uppercase tracking-widest mb-2">{t('lobby.yourNameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            placeholder={t('lobby.namePlaceholder')}
          />
        </div>

        <div className="pt-6 border-t border-gray-700">
          <button
            onClick={handleCreate}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] cursor-pointer mb-6"
          >
            {t('lobby.createNewGame')}
          </button>

          <div className="relative flex items-center py-2 mb-6">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-widest">ИЛИ</span>
            <div className="flex-grow border-t border-gray-700"></div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="block text-gray-400 text-xs uppercase tracking-widest">Код комнаты</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono uppercase"
                placeholder={t('lobby.roomCodePlaceholder')}
              />
              <button
                onClick={handleJoin}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg uppercase tracking-wider transition-colors cursor-pointer shadow-[0_0_15px_rgba(22,163,74,0.3)]"
              >
                {t('lobby.join')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
INNER_EOF
