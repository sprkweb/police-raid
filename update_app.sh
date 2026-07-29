cat << 'INNER_EOF' > src/App.tsx
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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      <header className="bg-gray-900 border-b border-gray-800 text-white p-4 flex justify-between items-center z-10 relative">
        <h1 className="text-2xl font-bold tracking-wider text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]">{t('app.title')}</h1>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 p-4 flex flex-col items-center justify-start pt-6 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none opacity-5"
             style={{ backgroundImage: 'radial-gradient(circle at center, #3b82f6 0%, transparent 70%)' }}></div>

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
INNER_EOF
