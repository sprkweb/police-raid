import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GamePhase, Role } from '../types/game';
import type { PlayerId } from '../types/game';
import { BALANCE } from '../engine/constants';
import { useTranslation } from 'react-i18next';

export const GameBoard: React.FC = () => {
  const { gameState, myId, proposeTeam, skipProposal, voteTeam, submitRaidAction, isHost, endDiscussion } = useGame();
  const [selectedTeam, setSelectedTeam] = useState<PlayerId[]>([]);
  const { t } = useTranslation();

  if (!gameState || !myId) return null;

  const me = gameState.players.find(p => p.id === myId);
  if (!me) return null;

  const numPlayers = gameState.players.length as keyof typeof BALANCE;
  const balance = BALANCE[numPlayers];
  const requiredSize = balance?.teamSizes[gameState.currentRound - 1] || 0;
  const isMyTurnToPropose = gameState.players[gameState.proposerIndex]?.id === myId;
  const myVote = gameState.teamVotes[myId];
  const myRaidAction = gameState.raidActions[myId];
  const isInProposedTeam = gameState.currentProposedTeam.includes(myId);

  useEffect(() => {
    setSelectedTeam([]);
  }, [gameState.proposerIndex, gameState.currentRound]);

  const togglePlayerSelection = (id: string) => {
    if (selectedTeam.includes(id)) {
      setSelectedTeam(selectedTeam.filter(p => p !== id));
    } else {
      if (selectedTeam.length < requiredSize) {
        setSelectedTeam([...selectedTeam, id]);
      }
    }
  };

  const handlePropose = () => {
    if (selectedTeam.length === requiredSize) {
      proposeTeam(selectedTeam);
    }
  };

  const isMole = me.role === Role.Mole;
  const otherMoles = gameState.players.filter(p => p.role === Role.Mole && p.id !== myId);

  const getRoleColor = (player: any) => {
    if (player.id === myId) {
      return isMole ? 'border-red-500 text-red-400' : 'border-blue-500 text-blue-400';
    }
    if (isMole && player.role === Role.Mole) {
      return 'border-red-500 text-red-400';
    }
    return 'border-gray-500 text-gray-300';
  };

  return (
    <div className="max-w-4xl w-full mx-auto flex flex-col gap-8 h-full">

      {/* Top Bar - Status */}
      <div className="bg-gray-900/80 border border-gray-700 p-4 rounded-xl shadow-lg shadow-black/50 flex justify-between items-center z-10 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold tracking-widest text-gray-100 uppercase">{t('game.round', { round: gameState.currentRound })}</h2>
          <p className="text-sm font-mono text-gray-400 mt-1">
            <span className="text-blue-400">{t('game.score', { police: gameState.scores.police, moles: gameState.scores.moles }).split(' - ')[0]}</span>
            <span className="mx-2 text-gray-600">|</span>
            <span className="text-red-400">{t('game.score', { police: gameState.scores.police, moles: gameState.scores.moles }).split(' - ')[1]}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{t('game.youAre')}</p>
          <p className={`text-xl font-bold tracking-wider uppercase ${isMole ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}>
            {me.role === Role.Police ? t('game.policeOfficer') : t('game.mole')}
          </p>
          {isMole && (
            <p className="text-xs text-red-400/80 mt-1 font-mono">
              {t('game.otherMoles', { moles: otherMoles.map(m => m.name).join(', ') || t('game.none') })}
            </p>
          )}
        </div>
      </div>

      {/* Main Game Area - The Circle */}
      <div className="relative w-full aspect-square max-w-[500px] mx-auto my-auto flex-1 flex items-center justify-center min-h-[400px]">
        {/* Render Players in Circle */}
        {gameState.players.map((p, index) => {
          const total = gameState.players.length;
          const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Start from top
          const radius = 42; // Percentage of container

          const left = `calc(50% + ${Math.cos(angle) * radius}%)`;
          const top = `calc(50% + ${Math.sin(angle) * radius}%)`;

          const isProposer = gameState.players[gameState.proposerIndex]?.id === p.id;
          const isSelected = selectedTeam.includes(p.id);
          const isSelectable = gameState.phase === GamePhase.ProposingTeam && isMyTurnToPropose;
          const roleStyle = getRoleColor(p);

          return (
            <div
              key={p.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-20 transition-all duration-300`}
              style={{ left, top }}
            >
              <button
                onClick={() => isSelectable && togglePlayerSelection(p.id)}
                disabled={!isSelectable}
                className={`
                  relative w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold
                  border-2 bg-gray-900 transition-all shadow-lg shadow-black/50
                  ${roleStyle}
                  ${isSelectable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                  ${isSelected ? 'ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : ''}
                  ${isProposer ? 'animate-pulse shadow-[0_0_15px_rgba(255,255,255,0.3)]' : ''}
                `}
              >
                {p.name.charAt(0).toUpperCase()}

                {/* Status indicators on icon */}
                {p.id === myId && (
                  <span className="absolute -bottom-2 bg-gray-800 text-[10px] px-2 rounded-full border border-gray-600 text-white">
                    (вы)
                  </span>
                )}
                {isProposer && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-500 rounded-full animate-ping"></span>
                )}
              </button>

              <div className="text-center">
                <span className={`text-sm font-medium ${p.id === myId ? 'text-white' : 'text-gray-400'}`}>
                  {p.name}
                </span>
                {/* Team member indicator during raid/voting */}
                {gameState.currentProposedTeam.includes(p.id) && gameState.phase !== GamePhase.ProposingTeam && (
                  <div className="text-[10px] uppercase text-blue-400 font-bold mt-1 tracking-wider">В команде</div>
                )}
              </div>
            </div>
          );
        })}

        {/* Center Control Area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center pointer-events-none z-10">
          <div className="bg-gray-900/90 backdrop-blur-md p-6 rounded-2xl border border-gray-700 shadow-2xl shadow-black max-w-[280px] w-full pointer-events-auto">

            {gameState.phase === GamePhase.Discussion && (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-t-blue-500 border-r-blue-500 border-b-transparent border-l-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-xl font-bold mb-2 uppercase tracking-widest text-blue-400">{t('game.discussionPhase')}</h3>
                <p className="text-sm text-gray-400 mb-6">{t('game.discussText')}</p>
                {isHost ? (
                  <button
                    onClick={endDiscussion}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {t('game.endDiscussion')}
                  </button>
                ) : (
                  <p className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">{t('game.waitingForHostEndDiscussion')}</p>
                )}
              </div>
            )}

            {gameState.phase === GamePhase.ProposingTeam && (
              <div>
                <h3 className="text-xl font-bold mb-2 uppercase tracking-widest text-yellow-500">{t('game.teamProposal')}</h3>
                <p className="text-sm text-gray-300 mb-4">
                  {t('game.currentProposer')} <span className="font-bold text-white">{gameState.players[gameState.proposerIndex].name}</span>
                </p>
                <div className="bg-gray-800 p-3 rounded-lg mb-6 border border-gray-700">
                  <p className="text-sm font-mono text-gray-400">
                    {t('game.needsPlayersText', { size: requiredSize, rejections: gameState.consecutiveRejections, total: gameState.players.length })}
                  </p>
                </div>

                {isMyTurnToPropose ? (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handlePropose}
                      disabled={selectedTeam.length !== requiredSize}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {t('game.proposeTeam', { selected: selectedTeam.length, required: requiredSize })}
                    </button>
                    <button
                      onClick={skipProposal}
                      className="w-full text-xs text-gray-500 hover:text-white uppercase tracking-widest py-2 cursor-pointer transition-colors"
                    >
                      {t('game.skipProposal')}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">{t('game.waitingForProposal')}</p>
                )}
              </div>
            )}

            {gameState.phase === GamePhase.VotingOnTeam && (
              <div>
                <h3 className="text-xl font-bold mb-4 uppercase tracking-widest text-yellow-500">{t('game.voteOnTeam')}</h3>

                {!myVote ? (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => voteTeam('Approve')}
                      className="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-[0_0_10px_rgba(22,163,74,0.3)]"
                    >
                      {t('game.approve')}
                    </button>
                    <button
                      onClick={() => voteTeam('Reject')}
                      className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-[0_0_10px_rgba(220,38,38,0.3)]"
                    >
                      {t('game.reject')}
                    </button>
                  </div>
                ) : (
                  <div className="py-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Ваш голос</p>
                    <p className={`text-lg font-bold uppercase tracking-wider ${myVote === 'Approve' ? 'text-green-500' : 'text-red-500'}`}>
                      {myVote === 'Approve' ? t('game.approve') : t('game.reject')}
                    </p>
                  </div>
                )}

                <div className="mt-4 text-xs font-mono text-gray-500">
                  {t('game.votesReceived', { votes: Object.keys(gameState.teamVotes).length, total: gameState.players.length })}
                </div>
              </div>
            )}

            {gameState.phase === GamePhase.Raid && (
              <div>
                <div className="w-full h-1 bg-gray-800 mb-4 overflow-hidden rounded-full">
                  <div className="w-1/2 h-full bg-blue-500 animate-[translate_2s_infinite_linear] rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold mb-4 uppercase tracking-widest text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]">{t('game.raidInProgress')}</h3>

                {isInProposedTeam ? (
                  <div>
                    {!myRaidAction ? (
                      <div className="flex flex-col gap-3 mt-4">
                        <button
                          onClick={() => submitRaidAction('Support')}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                        >
                          {t('game.supportRaid')}
                        </button>
                        {isMole && (
                          <button
                            onClick={() => submitRaidAction('Sabotage')}
                            className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-[0_0_10px_rgba(220,38,38,0.4)]"
                          >
                            {t('game.sabotageRaid')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 bg-gray-800 rounded-lg border border-gray-700 mt-4">
                        <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Действие</p>
                        <p className="text-lg font-bold text-blue-400 uppercase tracking-wider">{t('game.actionSubmitted')}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 uppercase tracking-widest py-4 border border-gray-800 rounded-lg bg-gray-900/50">{t('game.notOnRaidTeam')}</p>
                )}

                <div className="mt-4 text-xs font-mono text-gray-500">
                  {t('game.actionsReceived', { actions: Object.keys(gameState.raidActions).length, total: gameState.currentProposedTeam.length })}
                </div>
              </div>
            )}

            {gameState.phase === GamePhase.GameOver && (
              <div>
                <h2 className="text-2xl font-bold mb-2 uppercase tracking-widest text-white">{t('game.gameOver')}</h2>
                <div className={`p-4 rounded-lg border ${gameState.winner === 'Police' ? 'bg-blue-900/30 border-blue-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
                  <p className={`text-xl font-bold uppercase tracking-wider ${gameState.winner === 'Police' ? 'text-blue-400' : 'text-red-400'}`}>
                    {t('game.wins', { winner: gameState.winner === 'Police' ? t('game.policeOfficer') : t('game.mole') })}
                  </p>
                </div>
                {gameState.winner === 'Moles' && gameState.consecutiveRejections >= gameState.players.length && (
                  <p className="mt-4 text-xs text-red-500/80 uppercase tracking-widest font-mono">{t('game.wonByRejections')}</p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* History Area */}
      {gameState.raidResults.length > 0 && (
        <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-xl shadow-lg mt-auto z-10 backdrop-blur-sm">
          <h3 className="text-sm font-bold mb-3 uppercase tracking-widest text-gray-400">{t('game.raidHistory')}</h3>
          <ul className="space-y-2">
            {gameState.raidResults.map((r, i) => (
              <li key={i} className={`p-3 rounded-lg border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-800/50 ${r.success ? 'border-blue-500' : 'border-red-500'}`}>
                <span className="font-mono text-sm font-bold text-gray-300">
                  {t('game.roundHistory', { round: r.round, status: r.success ? t('game.success') : t('game.failed'), sabotages: r.sabotageCount })}
                </span>
                <div className="text-xs text-gray-500 font-mono">
                  {r.team.map(id => gameState.players.find(p => p.id === id)?.name).join(' • ')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};
