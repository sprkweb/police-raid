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
