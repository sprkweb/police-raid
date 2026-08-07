import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../context/GameContext';
import { GamePhase, Role } from '../types/game';
import type { PlayerId } from '../types/game';
import { MAX_ROUNDS, WINS_NEEDED } from '../engine/constants';
import { getTeamSize, needsTwoSabotages } from '../engine/selectors';
import { OperativeRing } from './OperativeRing';
import type { SeatView } from './OperativeRing';
import { ActionButtons, PhaseConsole } from './PhaseConsole';
import type { ActionView, ConsoleView } from './PhaseConsole';

const COMPACT_QUERY = '(max-width: 720px)';

/** На узком экране кнопки действий переезжают из круга в нижнюю панель. */
const useCompactLayout = () => {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return compact;
};

export const GameBoard: React.FC = () => {
  const { gameState, playerId: myPlayerId, isHost, endDiscussion, proposeTeam, skipProposal, voteTeam, submitRaidAction } = useGame();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<PlayerId[]>([]);
  const compact = useCompactLayout();

  const round = gameState?.currentRound;
  const proposerIndex = gameState?.proposerIndex;
  useEffect(() => {
    setSelected([]);
  }, [round, proposerIndex]);

  const me = gameState?.players.find(p => p.id === myPlayerId);
  if (!gameState || !myPlayerId || !me) return null;

  const { phase, players, currentProposedTeam, teamVotes, raidActions } = gameState;
  const isMole = me.role === Role.Mole;
  const teamSize = getTeamSize(gameState);
  const lead = players[gameState.proposerIndex];
  const iAmLead = lead?.id === myPlayerId;
  const iAmOnTeam = currentProposedTeam.includes(myPlayerId);
  const isProposing = phase === GamePhase.ProposingTeam;
  const isVoting = phase === GamePhase.VotingOnTeam;
  const isRaid = phase === GamePhase.Raid;
  const isOver = phase === GamePhase.GameOver;

  // Пока идёт формирование, круг подсвечивает выбор инициатора, дальше — утверждённый наряд.
  const highlighted = isProposing ? selected : currentProposedTeam;

  const toggleSelection = (id: PlayerId) => {
    setSelected(current => {
      if (current.includes(id)) return current.filter(p => p !== id);
      if (current.length >= teamSize) return current;
      return [...current, id];
    });
  };

  const seats: SeatView[] = players.map(player => {
    const onTeam = !isOver && phase !== GamePhase.Discussion && highlighted.includes(player.id);
    const isAlly = isMole && !isOver && player.id !== myPlayerId && player.role === Role.Mole;
    const isLead = !isOver && (isProposing || isVoting) && player.id === lead?.id;
    const reveal = isOver ? (player.role === Role.Mole ? 'mole' : 'police') : undefined;

    let flag: string | undefined;
    if (isOver) flag = player.role === Role.Mole ? t('game.mole') : t('game.policeOfficer');
    else if (player.id === myPlayerId) flag = t('game.flagYou');
    else if (isAlly) flag = t('game.flagAlly');
    else if (isLead) flag = t('game.flagLead');
    else if (onTeam) flag = t('game.flagOnTeam');

    let mark: SeatView['mark'];
    if (isVoting) mark = Object.hasOwn(teamVotes, player.id) ? 'done' : 'waiting';
    else if (isRaid && onTeam) mark = Object.hasOwn(raidActions, player.id) ? 'done' : 'waiting';

    // Roles arrive already projected: null means hidden from this viewer.
    const iconTone = player.role === Role.Mole
      ? 'mole'
      : player.role === Role.Police
        ? 'police'
        : undefined;

    return {
      id: player.id,
      name: player.name,
      flag,
      isMe: player.id === myPlayerId,
      onTeam,
      isLead,
      isAlly,
      dimmed: isRaid && !onTeam,
      reveal,
      iconTone,
      mark,
    };
  });

  const stage = { kicker: '', title: '', text: '' };
  const consoleView: ConsoleView = { title: '' };
  const actions: ActionView[] = [];

  if (phase === GamePhase.Discussion) {
    stage.kicker = t('game.kickerBriefing');
    stage.title = t('game.titleBriefing');
    stage.text = t('game.textBriefing');
    consoleView.title = t('game.consoleBriefing');
    consoleView.note = t('game.briefingNote');
    if (isHost) actions.push({ key: 'end', label: t('game.endBriefing'), tone: 'blue', onClick: endDiscussion });
    else consoleView.stat = t('game.waitingHost');
  }

  if (isProposing) {
    stage.kicker = t('game.kickerDetail');
    stage.title = t('game.titleDetail');
    stage.text = iAmLead
      ? t('game.textDetailLead', { size: teamSize })
      : t('game.textDetailWait', { lead: lead?.name ?? '', size: teamSize });

    if (iAmLead) {
      consoleView.title = t('game.consoleDetail');
      consoleView.big = `${selected.length} / ${teamSize}`;
      actions.push(
        {
          key: 'send',
          label: t('game.sendDetail'),
          tone: 'blue',
          disabled: selected.length !== teamSize,
          onClick: () => proposeTeam(selected),
        },
        { key: 'pass', label: t('game.passLead'), onClick: skipProposal },
      );
    } else {
      consoleView.title = t('game.consoleDetailLead');
      consoleView.verdict = lead?.name;
      consoleView.stat = t('game.waitingDetail');
    }
  }

  if (isVoting) {
    stage.kicker = t('game.kickerVote');
    stage.title = t('game.titleVote');
    stage.text = t('game.textVote');
    consoleView.title = t('game.consoleVote');
    consoleView.stat = t('game.signatures', { votes: Object.keys(teamVotes).length, total: players.length });

    const myVote = teamVotes[myPlayerId];
    if (myVote) {
      consoleView.note = myVote === 'Approve' ? t('game.youApproved') : t('game.youRejected');
    } else {
      consoleView.note = t('game.voteQuestion', { size: currentProposedTeam.length });
      actions.push(
        { key: 'approve', label: t('game.approve'), tone: 'green', onClick: () => voteTeam('Approve') },
        { key: 'reject', label: t('game.reject'), tone: 'red', onClick: () => voteTeam('Reject') },
      );
    }
  }

  if (isRaid) {
    stage.kicker = t('game.kickerBreach');
    stage.title = t('game.titleBreach');
    stage.text = t('game.textBreach');
    consoleView.stat = t('game.reports', {
      reports: Object.keys(raidActions).length,
      total: currentProposedTeam.length,
    });

    if (!iAmOnTeam) {
      consoleView.title = t('game.notOnDetail');
      consoleView.note = t('game.awaitReturn');
    } else if (Object.hasOwn(raidActions, myPlayerId)) {
      consoleView.title = t('game.consoleBreach');
      consoleView.note = t('game.reportSent');
    } else {
      consoleView.title = t('game.consoleBreach');
      actions.push({ key: 'support', label: t('game.runRaid'), tone: 'blue', onClick: () => submitRaidAction('Support') });
      if (isMole) {
        actions.push({ key: 'sabotage', label: t('game.leakInfo'), tone: 'red', onClick: () => submitRaidAction('Sabotage') });
      }
    }
  }

  if (isOver) {
    const policeWon = gameState.winner === 'Police';
    stage.kicker = t('game.kickerClosed');
    stage.title = t('game.titleClosed');
    stage.text = t('game.textClosed');
    consoleView.title = t('game.caseClosed');
    consoleView.verdict = policeWon ? t('game.policeWon') : t('game.molesWon');
    consoleView.verdictTone = policeWon ? 'police' : 'moles';
    consoleView.stat = !policeWon && gameState.consecutiveRejections >= players.length
      ? t('game.wonByRejections')
      : t('game.wonByRaids', { raids: policeWon ? gameState.scores.police : gameState.scores.moles });
  }

  const allies = players.filter(p => p.role === Role.Mole && p.id !== myPlayerId).map(p => p.name);

  return (
    <>
      <div className="pr-layout">
        <section className={`pr-panel pr-dossier pr-area-dossier${isMole ? ' pr-is-mole' : ''}`}>
          <div className="pr-panel-head">
            <h2>{t('game.dossierTitle')}</h2>
            <span className="pr-panel-aux">{t('game.classified')}</span>
          </div>
          <div className="pr-dossier-body">
            <div className="pr-mugshot" aria-hidden="true">
              <span className="pr-mugshot-ico" />
              <small>#{myPlayerId.slice(-4).toUpperCase()}</small>
            </div>
            <div>
              <div className="pr-label">{t('game.yourStatus')}</div>
              <div className="pr-role">{isMole ? t('game.mole') : t('game.policeOfficer')}</div>
              <div className="pr-task">{isMole ? t('game.taskMole') : t('game.taskPolice')}</div>
              {isMole && (
                <div className="pr-allies">
                  {allies.length > 0
                    ? <>{t('game.allies')} <b>{allies.join(', ')}</b></>
                    : t('game.alliesAlone')}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="pr-panel pr-area-case">
          <div className="pr-panel-head">
            <h2>{t('game.caseProgress')}</h2>
            <span className="pr-panel-aux">{t('game.winsNeeded', { wins: WINS_NEEDED })}</span>
          </div>

          <div className="pr-score">
            <div className="pr-score-side pr-police">
              <div className="pr-label">{t('game.police')}</div>
              <div className="pr-score-v">{gameState.scores.police}</div>
            </div>
            <div className="pr-score-side pr-moles">
              <div className="pr-label">{t('game.moles')}</div>
              <div className="pr-score-v">{gameState.scores.moles}</div>
            </div>
          </div>

          <div className="pr-raids">
            {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map(number => {
              const result = gameState.raidResults.find(r => r.round === number);
              const current = !result && number === gameState.currentRound && !isOver;
              const state = result ? (result.success ? 'pr-clean' : 'pr-failed') : current ? 'pr-current' : 'pr-pending';
              const names = result
                ? result.team.map(id => players.find(p => p.id === id)?.name).filter(Boolean).join(', ')
                : '';

              return (
                <div key={number} className={`pr-raid ${state}`}>
                  <div className="pr-raid-mark">{result ? (result.success ? '✓' : '✕') : number}</div>
                  <div>
                    <div className="pr-raid-t">
                      {result
                        ? t(result.success ? 'game.raidClean' : 'game.raidFailed', { num: number })
                        : t(current ? 'game.raidCurrent' : 'game.raidUpcoming', { num: number })}
                    </div>
                    <div className="pr-raid-d">
                      {result
                        ? t('game.raidDone', { team: names, sabotage: result.sabotageCount })
                        : t('game.raidPlanned', { size: getTeamSize(gameState, number) })}
                    </div>
                  </div>
                  {!result && needsTwoSabotages(gameState, number) && (
                    <div className="pr-raid-req">{t('game.twoSabotages')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="pr-panel pr-area-stage">
          <div className="pr-stage-head">
            <div className="pr-stage-kicker">{stage.kicker}</div>
            <h2>{stage.title}</h2>
            <p>{stage.text}</p>
          </div>

          <div className="pr-board">
            <OperativeRing seats={seats} onSelect={isProposing && iAmLead ? toggleSelection : undefined}>
              <PhaseConsole view={consoleView} />
              {!compact && <ActionButtons actions={actions} />}
            </OperativeRing>
          </div>
        </section>
      </div>

      {compact && actions.length > 0 && (
        <div className="pr-actionbar">
          <ActionButtons actions={actions} />
        </div>
      )}
    </>
  );
};
