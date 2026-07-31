import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { MAX_ROUNDS } from '../engine/constants';
import { getTeamSize } from '../engine/selectors';

export const OperationStats: React.FC = () => {
  const { gameState } = useGame();
  const { t } = useTranslation();

  if (!gameState) return null;

  return (
    <div className="pr-stats">
      <div className="pr-stat">
        <div className="pr-stat-k">{t('game.statRaid')}</div>
        <div className="pr-stat-v">{gameState.currentRound} / {MAX_ROUNDS}</div>
      </div>
      <div className="pr-stat">
        <div className="pr-stat-k">{t('game.statDetail')}</div>
        <div className="pr-stat-v">{getTeamSize(gameState)}</div>
      </div>
      <div className="pr-stat">
        <div className="pr-stat-k">{t('game.statRejections')}</div>
        <div className="pr-stat-v">{gameState.consecutiveRejections} / {gameState.players.length}</div>
      </div>
    </div>
  );
};
