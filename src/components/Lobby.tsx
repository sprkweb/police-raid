import React, { useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/constants';
import { normalizeRoomCode } from '../network/roomCode';
import { JoinLobbyError } from '../network/joinLobby';
import { useTranslation } from 'react-i18next';

type CopiedField = 'code' | 'link' | null;
type PendingAction = 'create' | 'join' | null;

function MaterialIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`material-icons${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      {name}
    </span>
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
  const busyRef = useRef(false);

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
      <div className="pr-lobby pr-lobby-staging">
        <section className="pr-panel pr-lobby-panel">
          <div className="pr-lobby-head">
            <div className="pr-stage-kicker">{t('lobby.stagingKicker')}</div>
            <h2>{t('lobby.stagingTitle')}</h2>
            {activeRoomCode && (
              <div className="pr-case-line">
                <span className="pr-case-line-text">{t('game.caseNo', { code: activeRoomCode })}</span>
                <button
                  type="button"
                  className={`pr-copy-btn pr-copy-btn-inline${copied === 'code' ? ' pr-copied' : ''}`}
                  onClick={() => copyText('code', activeRoomCode)}
                  aria-label={copied === 'code' ? t('lobby.caseCodeCopied') : t('lobby.copyCaseCode')}
                  title={copied === 'code' ? t('lobby.caseCodeCopied') : t('lobby.copyCaseCode')}
                >
                  <MaterialIcon name={copied === 'code' ? 'check' : 'content_copy'} />
                </button>
              </div>
            )}
            <p>{t('lobby.stagingBrief')}</p>
          </div>

          <div className="pr-panel-head">
            <h2>{t('lobby.players', { current: gameState.players.length })}</h2>
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
            {activeRoomCode && (
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
                    <MaterialIcon name={copied === 'link' ? 'check' : 'content_copy'} />
                  </button>
                </div>
              </div>
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
    if (busyRef.current) return;
    if (!name.trim()) return setError(t('lobby.errorEnterName'));
    setError('');
    busyRef.current = true;
    setPending('create');
    try {
      await createRoom(name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };

  const handleJoin = async () => {
    if (busyRef.current) return;
    if (!name.trim()) return setError(t('lobby.errorEnterName'));
    if (!roomCodeInput.trim()) return setError(t('lobby.errorEnterRoomCode'));
    setError('');
    busyRef.current = true;
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
      busyRef.current = false;
      setPending(null);
    }
  };

  return (
    <div className="pr-lobby pr-lobby-checkin">
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

          <div className="pr-lobby-split">
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

            <div className="pr-or-vert" role="separator" aria-label={t('lobby.orJoin')}>
              <span>{t('lobby.or')}</span>
            </div>

            <div className="pr-lobby-path">
              <div className="pr-lobby-path-label">{t('lobby.joinCaseLabel')}</div>
              <div className="pr-copyfield pr-joinfield">
                <input
                  type="text"
                  className="pr-input"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(normalizeRoomCode(e.target.value))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && pending === null) {
                      e.preventDefault();
                      void handleJoin();
                    }
                  }}
                  placeholder={t('lobby.caseCodePlaceholder')}
                  aria-label={t('lobby.caseCodePlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="pr-copy-btn pr-join-btn"
                  onClick={handleJoin}
                  disabled={pending !== null}
                  aria-label={pending === 'join' ? t('lobby.joining') : t('lobby.join')}
                  title={pending === 'join' ? t('lobby.joining') : t('lobby.join')}
                >
                  <MaterialIcon
                    name={pending === 'join' ? 'autorenew' : 'login'}
                    className={pending === 'join' ? 'pr-spin' : undefined}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
