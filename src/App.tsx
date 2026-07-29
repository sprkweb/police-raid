import { useGame } from './context/GameContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GamePhase } from './types/game';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

function App() {
  const { gameState } = useGame();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('app.title')}</h1>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 p-4 flex items-start justify-center pt-8">
        {!gameState || gameState.phase === GamePhase.Lobby ? (
          <Lobby />
        ) : (
          <GameBoard />
        )}
      </main>
    </div>
  );
}

export default App;
