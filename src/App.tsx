import { useGame } from './context/GameContext';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GamePhase } from './types/game';

function App() {
  const { gameState } = useGame();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold text-center">Police Raid</h1>
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
