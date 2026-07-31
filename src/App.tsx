import { useGame } from './context/GameContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GamePhase } from './types/game';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { OperationStats } from './components/OperationStats';
import { useTranslation } from 'react-i18next';

function App() {
  const { gameState } = useGame();
  const { t } = useTranslation();
  const inGame = Boolean(gameState) && gameState?.phase !== GamePhase.Lobby;

  return (
    <div className="pr-app">
      <div className="pr-shell">
        <header className="pr-topbar">
          <svg className="pr-emblem" viewBox="0 0 36 40" fill="none" aria-hidden="true">
            <path
              d="M18 2 33 7v15c0 9.5-6.5 15.5-15 17.5C9.5 37.5 3 31.5 3 22V7L18 2Z"
              stroke="#4aa8ff"
              strokeWidth="1.5"
              fill="rgba(74,168,255,.10)"
            />
            <path d="M18 13v14M11 20h14" stroke="#ffbe3d" strokeWidth="1.8" />
          </svg>

          <div className="pr-op">
            <h1>{t('app.title')}</h1>
            {gameState && <div className="pr-case">{t('game.caseNo', { code: gameState.hostId })}</div>}
          </div>

          <div className="pr-spacer" />

          {inGame && <OperationStats />}
          <LanguageSwitcher />
        </header>

        {inGame ? <GameBoard /> : <Lobby />}
      </div>
    </div>
  );
}

export default App;
