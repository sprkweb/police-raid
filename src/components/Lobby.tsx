import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next';

const initialsOf = (name: string) => name.trim().slice(0, 2).toUpperCase();

export const Lobby: React.FC = () => {
  const { createRoom, joinRoom, gameState, startGame, isHost, myId } = useGame();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  if (gameState) {
    const canStart = gameState.players.length >= 5 && gameState.players.length <= 8;

    return (
      <div className="pr-lobby">
        <section className="pr-panel">
          <div className="pr-panel-head">
            <h2>{t('lobby.players', { current: gameState.players.length })}</h2>
            <span className="pr-panel-aux">{t('game.caseNo', { code: gameState.hostId })}</span>
          </div>

          <div className="pr-roster">
            {gameState.players.map(p => (
              <div key={p.id} className="pr-roster-item">
                <span className="pr-avatar">{initialsOf(p.name)}</span>
                <span className="pr-roster-name">{p.name}</span>
                {p.id === myId && <span className="pr-tag pr-tag-blue">{t('lobby.you')}</span>}
                {p.id === gameState.hostId && p.id !== myId && (
                  <span className="pr-tag pr-tag-amber">{t('lobby.host')}</span>
                )}
              </div>
            ))}
          </div>

          <div className="pr-lobby-body">
            {isHost ? (
              <button type="button" className="pr-btn pr-blue" onClick={startGame} disabled={!canStart}>
                {t('lobby.startGame')}
              </button>
            ) : (
              <div className="pr-hint">{t('lobby.waitingForHostStart')}</div>
            )}
          </div>
        </section>
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
    <div className="pr-lobby">
      <section className="pr-panel">
        <div className="pr-panel-head">
          <h2>{t('lobby.title')}</h2>
        </div>

        <div className="pr-lobby-body">
          {error && <p className="pr-error">{error}</p>}

          <div className="pr-field">
            <label className="pr-label" htmlFor="playerName">{t('lobby.yourNameLabel')}</label>
            <input
              id="playerName"
              type="text"
              className="pr-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('lobby.namePlaceholder')}
            />
          </div>

          <button type="button" className="pr-btn pr-blue" onClick={handleCreate}>
            {t('lobby.createNewGame')}
          </button>

          <div className="pr-divider" />

          <div className="pr-row">
            <input
              type="text"
              className="pr-input"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder={t('lobby.roomCodePlaceholder')}
              aria-label={t('lobby.roomCodePlaceholder')}
            />
            <button type="button" className="pr-btn pr-green" onClick={handleJoin}>
              {t('lobby.join')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
