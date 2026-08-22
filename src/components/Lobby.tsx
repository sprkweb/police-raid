import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/constants';
import { normalizeRoomCode } from '../network/roomCode';
import { defaultCallsignField, loadLastCallsign } from '../network/callsignMemory';
import { randomCallsign } from '../engine/callsigns';
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

export const Lobby: React.FC = () => {
  const {
    createRoom, joinRoom, gameState, startGame, startGameWithBots, setTimersEnabled,
    setAdvancedBotsEnabled,
    isHost, playerId: myPlayerId, roomCode: activeRoomCode, renamePlayer,
    connecting, connectErrorCode, playerName,
  } = useGame();
  const { t } = useTranslation();
  const [name, setName] = useState(() => defaultCallsignField());
  const hadGameRef = useRef(false);
  const [roomCodeInput, setRoomCodeInput] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('room');
    return fromUrl ? normalizeRoomCode(fromUrl) : '';
  });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<CopiedField>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [editingName, setEditingName] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (gameState) {
      hadGameRef.current = true;
      return;
    }
    if (hadGameRef.current) {
      hadGameRef.current = false;
      setName(loadLastCallsign() || randomCallsign());
    }
  }, [gameState]);

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

  const submitCallsign = (raw: string) => {
    setEditingName(false);
    const next = raw.trim();
    if (next && next !== playerName) renamePlayer(next);
  };

  if (connecting && !gameState) {
    return (
      <div className="pr-lobby pr-lobby-checkin">
        <section className="pr-panel pr-lobby-panel">
          <div className="pr-lobby-head">
            <div className="pr-stage-kicker">{t('lobby.kicker')}</div>
            <h2>{t('lobby.connectingTitle')}</h2>
            <p>{t('lobby.connectingBrief')}</p>
          </div>
          <div className="pr-lobby-body">
            <div className="pr-hint pr-connecting">
              <MaterialIcon name="autorenew" className="pr-spin" />
              <span>{t('lobby.joining')}</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (gameState) {
    const connectedCount = gameState.players.filter((p) => p.connected).length;
    const canStart = connectedCount >= MIN_PLAYERS && connectedCount <= MAX_PLAYERS;
    const showStartWithBots = isHost && connectedCount < MIN_PLAYERS;
    const caseUrl = typeof window !== 'undefined' ? window.location.href : '';

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
                <button
                  type="button"
                  className={`pr-copy-btn pr-copy-btn-inline${copied === 'link' ? ' pr-copied' : ''}`}
                  onClick={() => copyText('link', caseUrl)}
                  aria-label={copied === 'link' ? t('lobby.linkCopied') : t('lobby.copyInviteLink')}
                  title={copied === 'link' ? t('lobby.linkCopied') : t('lobby.copyInviteLink')}
                >
                  <MaterialIcon name={copied === 'link' ? 'check' : 'link'} />
                </button>
              </div>
            )}
            <p>{t('lobby.stagingBrief')}</p>
          </div>

          <div className="pr-panel-head">
            <h2>{t('lobby.players', { current: gameState.players.length })}</h2>
          </div>

          <div className="pr-roster">
            {gameState.players.map(p => {
              const isMe = p.id === myPlayerId;
              return (
                <div key={p.id} className={`pr-roster-item${p.connected ? '' : ' pr-roster-offline'}`}>
                  <span className="pr-avatar" aria-hidden="true"><span className="pr-avatar-ico" /></span>
                  {isMe && editingName ? (
                    <input
                      className="pr-input pr-roster-rename"
                      defaultValue={p.name}
                      autoFocus
                      maxLength={24}
                      onBlur={e => submitCallsign(e.currentTarget.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitCallsign(e.currentTarget.value);
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingName(false);
                        }
                      }}
                      aria-label={t('lobby.callsignLabel')}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`pr-roster-name${isMe ? ' pr-roster-name-mine' : ''}`}
                      disabled={!isMe}
                      onClick={() => {
                        if (!isMe) return;
                        setEditingName(true);
                      }}
                    >
                      {p.name}
                    </button>
                  )}
                  <span className="pr-roster-tags">
                    {!p.connected && <span className="pr-tag">{t('lobby.offline')}</span>}
                    {isMe && <span className="pr-tag pr-tag-blue">{t('lobby.you')}</span>}
                    {p.id === gameState.hostId && (
                      <span className="pr-tag pr-tag-amber">{t('lobby.host')}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {gameState.spectators.length > 0 && (
            <div className="pr-observers">
              <div className="pr-panel-head">
                <h2>{t('lobby.observers', { count: gameState.spectators.length })}</h2>
              </div>
              <ul className="pr-observer-list">
                {gameState.spectators.map(s => (
                  <li key={s.id}>
                    {s.id === myPlayerId && editingName ? (
                      <input
                        className="pr-input pr-roster-rename"
                        defaultValue={s.name}
                        autoFocus
                        maxLength={24}
                        onBlur={e => submitCallsign(e.currentTarget.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitCallsign(e.currentTarget.value);
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingName(false);
                          }
                        }}
                        aria-label={t('lobby.callsignLabel')}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`pr-roster-name${s.id === myPlayerId ? ' pr-roster-name-mine' : ''}`}
                        disabled={s.id !== myPlayerId}
                        onClick={() => {
                          if (s.id !== myPlayerId) return;
                          setEditingName(true);
                        }}
                      >
                        {s.name}
                      </button>
                    )}
                    {s.id === myPlayerId ? <span className="pr-tag pr-tag-blue">{t('lobby.you')}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pr-lobby-body">
            {error && <p className="pr-error">{error}</p>}
            <div className="pr-lobby-options">
              <label className="pr-check">
                <input
                  type="checkbox"
                  checked={gameState.timersEnabled}
                  disabled={!isHost}
                  onChange={(e) => setTimersEnabled(e.target.checked)}
                />
                <span>{t('lobby.enableTimers')}</span>
              </label>
              <label className="pr-check">
                <input
                  type="checkbox"
                  checked={gameState.advancedBotsEnabled}
                  disabled={!isHost}
                  onChange={(e) => setAdvancedBotsEnabled(e.target.checked)}
                />
                <span>{t('lobby.enableAdvancedBots')}</span>
              </label>
            </div>
            <div className="pr-lobby-launch">
              {isHost ? (
                <>
                  <button type="button" className="pr-btn pr-blue" onClick={startGame} disabled={!canStart}>
                    {t('lobby.startGame')}
                  </button>
                  {showStartWithBots && (
                    <button type="button" className="pr-btn pr-green" onClick={startGameWithBots}>
                      {t('lobby.startWithBots')}
                    </button>
                  )}
                </>
              ) : (
                <div className="pr-hint">{t('lobby.waitingForHostStart')}</div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const handleCreate = async () => {
    if (busyRef.current) return;
    setError('');
    busyRef.current = true;
    setPending('create');
    try {
      await createRoom(name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };

  const handleJoin = async () => {
    if (busyRef.current) return;
    if (!roomCodeInput.trim()) return setError(t('lobby.errorEnterRoomCode'));
    setError('');
    busyRef.current = true;
    setPending('join');
    try {
      await joinRoom(roomCodeInput, name);
    } catch (e: unknown) {
      setError(
        e instanceof JoinLobbyError
          ? t('lobby.errorNoHostResponse', { code: normalizeRoomCode(roomCodeInput) })
          : e instanceof Error ? e.message : String(e),
      );
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };

  const shownError = error || (connectErrorCode
    ? t('lobby.errorNoHostResponse', { code: connectErrorCode })
    : '');

  return (
    <div className="pr-lobby pr-lobby-checkin">
      <section className="pr-panel pr-lobby-panel">
        <div className="pr-lobby-head">
          <div className="pr-stage-kicker">{t('lobby.kicker')}</div>
          <h2>{t('lobby.title')}</h2>
          <p>{t('lobby.brief')}</p>
        </div>

        <div className="pr-lobby-body">
          {shownError && <p className="pr-error">{shownError}</p>}

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
