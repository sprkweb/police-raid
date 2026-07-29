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

  return (
    <div className="max-w-4xl w-full mx-auto p-4 flex flex-col gap-6">

      <div className="bg-white p-4 rounded shadow flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{t('game.round', { round: gameState.currentRound })}</h2>
          <p className="text-sm text-gray-600">{t('game.score', { police: gameState.scores.police, moles: gameState.scores.moles })}</p>
        </div>
        <div className="text-right">
          <p className="text-sm">{t('game.youAre')}</p>
          <p className={`text-xl font-bold ${isMole ? 'text-red-600' : 'text-blue-600'}`}>
            {me.role === Role.Police ? t('game.policeOfficer') : t('game.mole')}
          </p>
          {isMole && (
            <p className="text-xs text-red-500 mt-1">
              {t('game.otherMoles', { moles: otherMoles.map(m => m.name).join(', ') || t('game.none') })}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">

        {gameState.phase === GamePhase.Discussion && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">{t('game.discussionPhase')}</h3>
            <p className="mb-4">{t('game.discussText')}</p>
            {isHost && (
              <button
                onClick={endDiscussion}
                className="bg-blue-600 text-white px-6 py-2 rounded font-bold cursor-pointer"
              >
                {t('game.endDiscussion')}
              </button>
            )}
            {!isHost && <p className="text-gray-500 italic">{t('game.waitingForHostEndDiscussion')}</p>}
          </div>
        )}

        {gameState.phase === GamePhase.ProposingTeam && (
          <div>
            <h3 className="text-2xl font-bold mb-4">{t('game.teamProposal')}</h3>
            <p className="mb-4">
              {t('game.currentProposer')} <span className="font-bold">{gameState.players[gameState.proposerIndex].name}</span>
            </p>
            <p className="mb-4 text-sm text-gray-600">
              {t('game.needsPlayersText', { size: requiredSize, rejections: gameState.consecutiveRejections, total: gameState.players.length })}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
              {gameState.players.map(p => (
                <button
                  key={p.id}
                  onClick={() => isMyTurnToPropose && togglePlayerSelection(p.id)}
                  disabled={!isMyTurnToPropose}
                  className={`p-3 rounded border-2 transition-colors ${
                    selectedTeam.includes(p.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${!isMyTurnToPropose ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {isMyTurnToPropose && (
              <div className="flex gap-4 justify-end">
                <button
                  onClick={skipProposal}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer"
                >
                  {t('game.skipProposal')}
                </button>
                <button
                  onClick={handlePropose}
                  disabled={selectedTeam.length !== requiredSize}
                  className="px-6 py-2 bg-blue-600 text-white rounded font-bold disabled:opacity-50 cursor-pointer"
                >
                  {t('game.proposeTeam', { selected: selectedTeam.length, required: requiredSize })}
                </button>
              </div>
            )}
            {!isMyTurnToPropose && (
              <p className="text-gray-500 italic text-center">{t('game.waitingForProposal')}</p>
            )}
          </div>
        )}

        {gameState.phase === GamePhase.VotingOnTeam && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">{t('game.voteOnTeam')}</h3>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {gameState.currentProposedTeam.map(id => {
                const player = gameState.players.find(p => p.id === id);
                return <span key={id} className="px-3 py-1 bg-gray-100 rounded-full">{player?.name}</span>;
              })}
            </div>

            {!myVote ? (
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => voteTeam('Approve')}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded font-bold cursor-pointer"
                >
                  {t('game.approve')}
                </button>
                <button
                  onClick={() => voteTeam('Reject')}
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded font-bold cursor-pointer"
                >
                  {t('game.reject')}
                </button>
              </div>
            ) : (
              <p className="text-lg text-blue-600 font-bold">{t('game.youVotedTo', { vote: myVote === 'Approve' ? t('game.approve') : t('game.reject') })}</p>
            )}

            <div className="mt-6 text-sm text-gray-500">
              {t('game.votesReceived', { votes: Object.keys(gameState.teamVotes).length, total: gameState.players.length })}
            </div>
          </div>
        )}

        {gameState.phase === GamePhase.Raid && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">{t('game.raidInProgress')}</h3>

            {isInProposedTeam ? (
              <div className="mb-6">
                <p className="mb-4">{t('game.onRaidTeamText')}</p>
                {!myRaidAction ? (
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => submitRaidAction('Support')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded font-bold cursor-pointer"
                    >
                      {t('game.supportRaid')}
                    </button>
                    {isMole && (
                      <button
                        onClick={() => submitRaidAction('Sabotage')}
                        className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded font-bold cursor-pointer"
                      >
                        {t('game.sabotageRaid')}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-lg text-blue-600 font-bold">{t('game.actionSubmitted')}</p>
                )}
              </div>
            ) : (
              <p className="text-lg text-gray-600 mb-6 italic">{t('game.notOnRaidTeam')}</p>
            )}

            <div className="mt-6 text-sm text-gray-500">
              {t('game.actionsReceived', { actions: Object.keys(gameState.raidActions).length, total: gameState.currentProposedTeam.length })}
            </div>
          </div>
        )}

        {gameState.phase === GamePhase.GameOver && (
          <div className="text-center py-8">
            <h2 className="text-4xl font-bold mb-4">{t('game.gameOver')}</h2>
            <p className={`text-2xl font-bold ${gameState.winner === 'Police' ? 'text-blue-600' : 'text-red-600'}`}>
              {t('game.wins', { winner: gameState.winner === 'Police' ? t('game.policeOfficer') : t('game.mole') })}
            </p>
            {gameState.winner === 'Moles' && gameState.consecutiveRejections >= gameState.players.length && (
              <p className="mt-2 text-red-500">{t('game.wonByRejections')}</p>
            )}
          </div>
        )}

      </div>

      {gameState.raidResults.length > 0 && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-bold mb-2">{t('game.raidHistory')}</h3>
          <ul className="space-y-2">
            {gameState.raidResults.map((r, i) => (
              <li key={i} className={`p-2 rounded border-l-4 ${r.success ? 'border-blue-500 bg-blue-50' : 'border-red-500 bg-red-50'}`}>
                {t('game.roundHistory', { round: r.round, status: r.success ? t('game.success') : t('game.failed'), sabotages: r.sabotageCount })}
                <div className="text-sm text-gray-600 mt-1">
                  {t('game.team', { team: r.team.map(id => gameState.players.find(p => p.id === id)?.name).join(', ') })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};
