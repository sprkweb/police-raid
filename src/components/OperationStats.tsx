import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { MAX_ROUNDS } from '../engine/constants';
import { getTeamSize } from '../engine/selectors';
import { usePhaseCountdown } from '../hooks/usePhaseCountdown';

export const OperationStats: React.FC = () => {
  const { gameState } = useGame();
  const { t } = useTranslation();
  const countdown = usePhaseCountdown(gameState?.phaseEndsAt);

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
      {countdown != null && (
        <div className="pr-stat pr-stat-timer" aria-live="polite">
          <div className="pr-stat-k">{t('game.statTimer')}</div>
          <div className="pr-stat-v">{countdown}</div>
        </div>
      )}
    </div>
  );
};
