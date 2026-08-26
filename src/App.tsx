import { useGame } from './context/GameContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GamePhase } from './types/game';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { OperationStats } from './components/OperationStats';
import { RulesHelp } from './components/RulesHelp';
import { SiteFooter } from './components/SiteFooter';
import { useTranslation } from 'react-i18next';

function App() {
  const { gameState, roomCode, hostGone, sessionTakenOver, returnToCheckIn } = useGame();
  const { t } = useTranslation();
  const inGame = Boolean(gameState) && gameState?.phase !== GamePhase.Lobby;

  return (
    <div className="pr-app">
      <div className="pr-shell">
        <header className="pr-topbar">
          <div className="pr-brand">
            <span className="pr-logo" aria-hidden="true" />
            <div className="pr-op">
              <h1>{t('app.title')}</h1>
              {gameState && roomCode && (
                <div className="pr-case">{t('game.caseNo', { code: roomCode })}</div>
              )}
            </div>
          </div>

          <div className="pr-spacer" />

          <div className="pr-hud">
            {inGame && <OperationStats />}
            <div className="pr-tools">
              <RulesHelp />
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <div className="pr-hazard" aria-hidden="true" />

        {inGame ? <GameBoard /> : (
          <>
            <Lobby />
            <SiteFooter />
          </>
        )}
      </div>

      {hostGone && (
        <div className="pr-hostgone" role="alertdialog" aria-labelledby="pr-hostgone-title">
          <div className="pr-panel pr-hostgone-panel">
            <h2 id="pr-hostgone-title">{t('lobby.hostGoneTitle')}</h2>
            <p>{t('lobby.hostGoneBrief')}</p>
            <button type="button" className="pr-btn pr-blue" onClick={() => void returnToCheckIn()}>
              {t('lobby.returnToCheckIn')}
            </button>
          </div>
        </div>
      )}
      {sessionTakenOver && (
        <div className="pr-hostgone" role="alertdialog" aria-labelledby="pr-session-taken-title">
          <div className="pr-panel pr-hostgone-panel">
            <h2 id="pr-session-taken-title">{t('lobby.sessionTakenTitle')}</h2>
            <p>{t('lobby.sessionTakenBrief')}</p>
            <button type="button" className="pr-btn pr-blue" onClick={() => void returnToCheckIn()}>
              {t('lobby.returnToCheckIn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
