import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/constants';
import { normalizeRoomCode } from '../network/roomCode';
import { useTranslation } from 'react-i18next';

export const Lobby: React.FC = () => {
  const {
    createRoom, joinRoom, gameState, startGame, startGameWithBots,
    isHost, playerId: myPlayerId, roomCode: activeRoomCode,
  } = useGame();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('room');
    return fromUrl ? normalizeRoomCode(fromUrl) : '';
  });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (gameState) {
    const canStart =
      gameState.players.length >= MIN_PLAYERS && gameState.players.length <= MAX_PLAYERS;
    const showDevBots = import.meta.env.DEV && isHost && gameState.players.length < MIN_PLAYERS;

    const copyInviteLink = async () => {
      if (!activeRoomCode) return;
      const url = new URL(window.location.href);
      url.searchParams.set('room', activeRoomCode);
      try {
        await navigator.clipboard.writeText(url.toString());
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setError(t('lobby.errorCopyLink'));
      }
    };

    return (
      <div className="pr-lobby">
        <section className="pr-panel">
          <div className="pr-panel-head">
            <h2>{t('lobby.players', { current: gameState.players.length })}</h2>
            {activeRoomCode && (
              <span className="pr-panel-aux">{t('game.caseNo', { code: activeRoomCode })}</span>
            )}
          </div>

          <div className="pr-roster">
            {gameState.players.map(p => (
              <div key={p.id} className="pr-roster-item">
                <span className="pr-avatar" aria-hidden="true"><span className="pr-avatar-ico" /></span>
                <span className="pr-roster-name">{p.name}</span>
                {p.id === myPlayerId && <span className="pr-tag pr-tag-blue">{t('lobby.you')}</span>}
                {p.id === gameState.hostId && p.id !== myPlayerId && (
                  <span className="pr-tag pr-tag-amber">{t('lobby.host')}</span>
                )}
              </div>
            ))}
          </div>

          <div className="pr-lobby-body">
            {error && <p className="pr-error">{error}</p>}
            {activeRoomCode && (
              <button type="button" className="pr-btn pr-green" onClick={copyInviteLink}>
                {copied ? t('lobby.linkCopied') : t('lobby.copyInviteLink')}
              </button>
            )}
            {isHost ? (
              <>
                <button type="button" className="pr-btn pr-blue" onClick={startGame} disabled={!canStart}>
                  {t('lobby.startGame')}
                </button>
                {showDevBots && (
                  <button type="button" className="pr-btn pr-green" onClick={startGameWithBots}>
                    {t('lobby.devStartWithBots')}
                  </button>
                )}
              </>
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
    if (!roomCodeInput.trim()) return setError(t('lobby.errorEnterRoomCode'));
    try {
      await joinRoom(roomCodeInput, name);
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
              value={roomCodeInput}
              onChange={e => setRoomCodeInput(normalizeRoomCode(e.target.value))}
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
