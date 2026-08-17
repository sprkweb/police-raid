import { useGame } from './context/GameContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GamePhase } from './types/game';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { OperationStats } from './components/OperationStats';
import { RulesHelp } from './components/RulesHelp';
import { useTranslation } from 'react-i18next';

function App() {
  const { gameState, roomCode, hostGone, sessionTakenOver, returnToCheckIn } = useGame();
  const { t } = useTranslation();
  const inGame = Boolean(gameState) && gameState?.phase !== GamePhase.Lobby;

  return (
    <div className="pr-app">
      <div className="pr-shell">
        <header className="pr-topbar">
          <div className="pr-op">
            <div className="pr-brand">
              <span className="pr-logo" aria-hidden="true" />
              <h1>{t('app.title')}</h1>
            </div>
            {gameState && roomCode && (
              <div className="pr-case">{t('game.caseNo', { code: roomCode })}</div>
            )}
          </div>

          <div className="pr-spacer" />

          {inGame && <OperationStats />}
          <RulesHelp />
          <LanguageSwitcher />
        </header>

        {inGame ? <GameBoard /> : <Lobby />}
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
