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
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">{t('lobby.room', { hostId: gameState.hostId })}</h2>
        <div className="bg-white p-4 rounded shadow min-w-[300px]">
          <h3 className="text-xl mb-2 border-b pb-2">{t('lobby.players', { current: gameState.players.length })}</h3>
          <ul className="space-y-2">
            {gameState.players.map(p => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name} {p.id === myId ? t('lobby.you') : ''}</span>
                {p.id === gameState.hostId && <span className="text-sm bg-blue-100 text-blue-800 px-2 rounded">{t('lobby.host')}</span>}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            disabled={gameState.players.length < 5 || gameState.players.length > 8}
            className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50 mt-4"
          >
            {t('lobby.startGame')}
          </button>
        ) : (
          <p className="text-gray-600 mt-4">{t('lobby.waitingForHostStart')}</p>
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
    <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">{t('lobby.title')}</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('lobby.yourNameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder={t('lobby.namePlaceholder')}
          />
        </div>

        <div className="pt-4 border-t">
          <button
            onClick={handleCreate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            {t('lobby.createNewGame')}
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              className="flex-1 border rounded p-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
              placeholder={t('lobby.roomCodePlaceholder')}
            />
            <button
              onClick={handleJoin}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
            >
              {t('lobby.join')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
