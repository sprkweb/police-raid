import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/constants';
import { normalizeRoomCode } from '../network/roomCode';
import { JoinLobbyError } from '../network/joinLobby';
import { useTranslation } from 'react-i18next';

type CopiedField = 'code' | 'link' | null;
type PendingAction = 'create' | 'join' | null;

function CopyIcon({ done }: { done?: boolean }) {
  if (done) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6.4 11.6 2.8 8l1.1-1.1 2.5 2.5 5.3-5.3L12.8 5z"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.5 2A1.5 1.5 0 0 0 4 3.5V4H3.5A1.5 1.5 0 0 0 2 5.5v7A1.5 1.5 0 0 0 3.5 14h6a1.5 1.5 0 0 0 1.5-1.5V12h.5A1.5 1.5 0 0 0 13 10.5v-7A1.5 1.5 0 0 0 11.5 2h-6ZM5 3.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H11V5.5A1.5 1.5 0 0 0 9.5 4H5v-.5ZM3.5 5h6a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5Z"
      />
    </svg>
  );
}

function inviteUrlFor(roomCode: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

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
  const [copied, setCopied] = useState<CopiedField>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const copyText = async (field: Exclude<CopiedField, null>, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setError('');
      window.setTimeout(() => setCopied(current => (current === field ? null : current)), 2000);
    } catch {
      setError(t('lobby.errorCopyLink'));
    }
  };

  if (gameState) {
    const canStart =
      gameState.players.length >= MIN_PLAYERS && gameState.players.length <= MAX_PLAYERS;
    const showDevBots = import.meta.env.DEV && isHost && gameState.players.length < MIN_PLAYERS;
    const inviteUrl = activeRoomCode ? inviteUrlFor(activeRoomCode) : '';

    return (
      <div className="pr-lobby">
        <section className="pr-panel pr-lobby-panel">
          <div className="pr-lobby-head">
            <div className="pr-stage-kicker">{t('lobby.stagingKicker')}</div>
            <h2>{t('lobby.stagingTitle')}</h2>
            <p>{t('lobby.stagingBrief')}</p>
          </div>

          {activeRoomCode && (
            <div className="pr-invite">
              <div className="pr-field">
                <label className="pr-label" htmlFor="caseCode">{t('lobby.caseNoLabel')}</label>
                <div className="pr-copyfield">
                  <input
                    id="caseCode"
                    type="text"
                    className="pr-input"
                    value={activeRoomCode}
                    readOnly
                    onFocus={e => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    className={`pr-copy-btn${copied === 'code' ? ' pr-copied' : ''}`}
                    onClick={() => copyText('code', activeRoomCode)}
                    aria-label={copied === 'code' ? t('lobby.caseCodeCopied') : t('lobby.copyCaseCode')}
                    title={copied === 'code' ? t('lobby.caseCodeCopied') : t('lobby.copyCaseCode')}
                  >
                    <CopyIcon done={copied === 'code'} />
                  </button>
                </div>
              </div>

              <div className="pr-field">
                <label className="pr-label" htmlFor="inviteLink">{t('lobby.inviteLinkLabel')}</label>
                <div className="pr-copyfield">
                  <input
                    id="inviteLink"
                    type="text"
                    className="pr-input"
                    value={inviteUrl}
                    readOnly
                    onFocus={e => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    className={`pr-copy-btn${copied === 'link' ? ' pr-copied' : ''}`}
                    onClick={() => copyText('link', inviteUrl)}
                    aria-label={copied === 'link' ? t('lobby.linkCopied') : t('lobby.copyInviteLink')}
                    title={copied === 'link' ? t('lobby.linkCopied') : t('lobby.copyInviteLink')}
                  >
                    <CopyIcon done={copied === 'link'} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pr-panel-head">
            <h2>{t('lobby.players', { current: gameState.players.length })}</h2>
            <span className="pr-panel-aux">
              {canStart ? t('lobby.rosterReady') : t('lobby.rosterWaiting')}
            </span>
          </div>

          <div className="pr-roster">
            {gameState.players.map(p => (
              <div key={p.id} className="pr-roster-item">
                <span className="pr-avatar" aria-hidden="true"><span className="pr-avatar-ico" /></span>
                <span className="pr-roster-name">{p.name}</span>
                <span className="pr-roster-tags">
                  {p.id === myPlayerId && <span className="pr-tag pr-tag-blue">{t('lobby.you')}</span>}
                  {p.id === gameState.hostId && (
                    <span className="pr-tag pr-tag-amber">{t('lobby.host')}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="pr-lobby-body">
            {error && <p className="pr-error">{error}</p>}
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
    setError('');
    setPending('create');
    try {
      await createRoom(name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(null);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError(t('lobby.errorEnterName'));
    if (!roomCodeInput.trim()) return setError(t('lobby.errorEnterRoomCode'));
    setError('');
    setPending('join');
    try {
      await joinRoom(roomCodeInput, name);
    } catch (e: any) {
      setError(
        e instanceof JoinLobbyError
          ? t('lobby.errorNoHostResponse', { code: normalizeRoomCode(roomCodeInput) })
          : e.message,
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="pr-lobby">
      <section className="pr-panel pr-lobby-panel">
        <div className="pr-lobby-head">
          <div className="pr-stage-kicker">{t('lobby.kicker')}</div>
          <h2>{t('lobby.title')}</h2>
          <p>{t('lobby.brief')}</p>
        </div>

        <div className="pr-lobby-body">
          {error && <p className="pr-error">{error}</p>}

          <div className="pr-field">
            <label className="pr-label" htmlFor="playerName">{t('lobby.callsignLabel')}</label>
            <input
              id="playerName"
              type="text"
              className="pr-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('lobby.callsignPlaceholder')}
              autoComplete="nickname"
            />
          </div>

          <div className="pr-lobby-path">
            <div className="pr-lobby-path-label">{t('lobby.openCaseLabel')}</div>
            <button
              type="button"
              className="pr-btn pr-blue"
              onClick={handleCreate}
              disabled={pending !== null}
            >
              {pending === 'create' ? t('lobby.opening') : t('lobby.openCase')}
            </button>
          </div>

          <div className="pr-or" role="separator">
            <span>{t('lobby.orJoin')}</span>
          </div>

          <div className="pr-lobby-path">
            <div className="pr-lobby-path-label">{t('lobby.joinCaseLabel')}</div>
            <div className="pr-row">
              <input
                type="text"
                className="pr-input"
                value={roomCodeInput}
                onChange={e => setRoomCodeInput(normalizeRoomCode(e.target.value))}
                placeholder={t('lobby.caseCodePlaceholder')}
                aria-label={t('lobby.caseCodePlaceholder')}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="pr-btn pr-green"
                onClick={handleJoin}
                disabled={pending !== null}
              >
                {pending === 'join' ? t('lobby.joining') : t('lobby.join')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
