import { useGame } from './context/GameContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GamePhase } from './types/game';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

// ⚡ Bolt: Moving game state consumption down to prevent App layout re-renders
const GameRouter = () => {
  const { gameState } = useGame();

  return !gameState || gameState.phase === GamePhase.Lobby ? (
    <Lobby />
  ) : (
    <GameBoard />
  );
};

function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('app.title')}</h1>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 p-4 flex items-start justify-center pt-8">
        <GameRouter />
      </main>
    </div>
  );
}

export default App;
