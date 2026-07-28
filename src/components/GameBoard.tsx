import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GamePhase, Role } from '../types/game';
import type { PlayerId } from '../types/game';
import { BALANCE } from '../engine/constants';

export const GameBoard: React.FC = () => {
  const { gameState, myId, proposeTeam, skipProposal, voteTeam, submitRaidAction, isHost, endDiscussion } = useGame();
  const [selectedTeam, setSelectedTeam] = useState<PlayerId[]>([]);

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
          <h2 className="text-xl font-bold">Round {gameState.currentRound} / 5</h2>
          <p className="text-sm text-gray-600">Police Wins: {gameState.scores.police} | Moles Wins: {gameState.scores.moles}</p>
        </div>
        <div className="text-right">
          <p className="text-sm">You are:</p>
          <p className={`text-xl font-bold ${isMole ? 'text-red-600' : 'text-blue-600'}`}>
            {me.role === Role.Police ? 'Police Officer' : 'Mole'}
          </p>
          {isMole && (
            <p className="text-xs text-red-500 mt-1">
              Other Moles: {otherMoles.map(m => m.name).join(', ') || 'None'}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">

        {gameState.phase === GamePhase.Discussion && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Discussion Phase</h3>
            <p className="mb-4">Discuss who you trust before the proposal begins.</p>
            {isHost && (
              <button
                onClick={endDiscussion}
                className="bg-blue-600 text-white px-6 py-2 rounded font-bold cursor-pointer"
              >
                End Discussion & Start Proposal
              </button>
            )}
            {!isHost && <p className="text-gray-500 italic">Waiting for host to end discussion...</p>}
          </div>
        )}

        {gameState.phase === GamePhase.ProposingTeam && (
          <div>
            <h3 className="text-2xl font-bold mb-4">Team Proposal</h3>
            <p className="mb-4">
              Current Proposer: <span className="font-bold">{gameState.players[gameState.proposerIndex].name}</span>
            </p>
            <p className="mb-4 text-sm text-gray-600">
              Needs {requiredSize} players for the raid. Rejection count: {gameState.consecutiveRejections} / {gameState.players.length}
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
                  Skip Proposal
                </button>
                <button
                  onClick={handlePropose}
                  disabled={selectedTeam.length !== requiredSize}
                  className="px-6 py-2 bg-blue-600 text-white rounded font-bold disabled:opacity-50 cursor-pointer"
                >
                  Propose Team ({selectedTeam.length}/{requiredSize})
                </button>
              </div>
            )}
            {!isMyTurnToPropose && (
              <p className="text-gray-500 italic text-center">Waiting for them to propose a team...</p>
            )}
          </div>
        )}

        {gameState.phase === GamePhase.VotingOnTeam && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Vote on Team</h3>
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
                  Approve
                </button>
                <button
                  onClick={() => voteTeam('Reject')}
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded font-bold cursor-pointer"
                >
                  Reject
                </button>
              </div>
            ) : (
              <p className="text-lg text-blue-600 font-bold">You voted to {myVote}</p>
            )}

            <div className="mt-6 text-sm text-gray-500">
              Votes received: {Object.keys(gameState.teamVotes).length} / {gameState.players.length}
            </div>
          </div>
        )}

        {gameState.phase === GamePhase.Raid && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Raid in Progress</h3>

            {isInProposedTeam ? (
              <div className="mb-6">
                <p className="mb-4">You are on the raid team! Choose your action:</p>
                {!myRaidAction ? (
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => submitRaidAction('Support')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded font-bold cursor-pointer"
                    >
                      Support Raid (Police)
                    </button>
                    {isMole && (
                      <button
                        onClick={() => submitRaidAction('Sabotage')}
                        className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded font-bold cursor-pointer"
                      >
                        Sabotage Raid (Mole)
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-lg text-blue-600 font-bold">Action submitted.</p>
                )}
              </div>
            ) : (
              <p className="text-lg text-gray-600 mb-6 italic">You are not on the raid team. Waiting for them to return...</p>
            )}

            <div className="mt-6 text-sm text-gray-500">
              Actions received: {Object.keys(gameState.raidActions).length} / {gameState.currentProposedTeam.length}
            </div>
          </div>
        )}

        {gameState.phase === GamePhase.GameOver && (
          <div className="text-center py-8">
            <h2 className="text-4xl font-bold mb-4">Game Over!</h2>
            <p className={`text-2xl font-bold ${gameState.winner === 'Police' ? 'text-blue-600' : 'text-red-600'}`}>
              {gameState.winner} Win!
            </p>
            {gameState.winner === 'Moles' && gameState.consecutiveRejections >= gameState.players.length && (
              <p className="mt-2 text-red-500">Won by reaching maximum consecutive rejected proposals.</p>
            )}
          </div>
        )}

      </div>

      {gameState.raidResults.length > 0 && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-bold mb-2">Raid History</h3>
          <ul className="space-y-2">
            {gameState.raidResults.map((r, i) => (
              <li key={i} className={`p-2 rounded border-l-4 ${r.success ? 'border-blue-500 bg-blue-50' : 'border-red-500 bg-red-50'}`}>
                Round {r.round}: {r.success ? 'Success' : 'Failed'} ({r.sabotageCount} sabotages)
                <div className="text-sm text-gray-600 mt-1">
                  Team: {r.team.map(id => gameState.players.find(p => p.id === id)?.name).join(', ')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};
