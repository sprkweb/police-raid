import type { GameState, PlayerId, Vote, RaidAction } from '../types/game';
import { GamePhase, Role } from '../types/game';
import { chooseProposedTeam, chooseRaidAction, chooseTeamVote } from './botBehavior';
import {
  BOT_ID_PREFIX,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PHASE_DURATION_MS,
  type PlayerCount,
} from './constants';
import { type RandomFn } from './rng';
import {
  assignRoles,
  countApproves,
  countSabotages,
  createInitialState,
  isRaidActionAllowed,
  isRaidSuccessful,
  isSupportedPlayerCount,
  isTeamApproved,
  molesWinByRejectionLimit,
  pickProposerIndex,
  requiredSabotagesForRound,
  requiredTeamSize,
  winnerFromScores,
} from './rules';

const isBot = (id: PlayerId) => id.startsWith(BOT_ID_PREFIX);

export interface GameEngineOptions {
  /** Injected RNG in [0, 1). Defaults to Math.random. */
  random?: RandomFn;
  /** Current time in ms. Defaults to Date.now. */
  now?: () => number;
  /** Override the lobby default (timers on). */
  timersEnabled?: boolean;
}

export class GameEngine {
  private state: GameState;
  private onStateChange: (state: GameState) => void;
  private random: RandomFn;
  private now: () => number;
  /** When true, bot players auto-act on propose / vote / raid. */
  private botsEnabled = false;
  private phaseTimerId: ReturnType<typeof setTimeout> | null = null;
  private phaseTimerGeneration = 0;

  constructor(
    hostId: string,
    hostName: string,
    onStateChange: (state: GameState) => void,
    options: GameEngineOptions = {},
  ) {
    this.onStateChange = onStateChange;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.state = createInitialState(hostId, hostName);
    if (options.timersEnabled != null) {
      this.state.timersEnabled = options.timersEnabled;
    }
    this.notify();
  }

  public getState(): GameState {
    return this.state;
  }

  private notify() {
    this.onStateChange({ ...this.state, players: [...this.state.players] });
  }

  public addPlayer(id: string, name: string) {
    if (this.state.phase !== GamePhase.Lobby) return;
    if (this.state.players.length >= MAX_PLAYERS) return;
    if (!this.state.players.find((p) => p.id === id)) {
      this.state.players.push({ id, name, role: null });
      this.notify();
    }
  }

  public removePlayer(id: string) {
    if (this.state.phase !== GamePhase.Lobby) return;
    this.state.players = this.state.players.filter((p) => p.id !== id);
    this.notify();
  }

  /** Host-only lobby setting: enable per-phase countdown + auto-actions. */
  public setTimersEnabled(enabled: boolean) {
    if (this.state.phase !== GamePhase.Lobby) return;
    if (this.state.timersEnabled === enabled) return;
    this.state.timersEnabled = enabled;
    this.notify();
  }

  private disarmPhaseTimer() {
    if (this.phaseTimerId != null) {
      clearTimeout(this.phaseTimerId);
      this.phaseTimerId = null;
    }
    this.phaseTimerGeneration++;
    this.state.phaseEndsAt = null;
  }

  private armPhaseTimer(durationMs: number) {
    this.disarmPhaseTimer();
    if (!this.state.timersEnabled) return;

    const generation = this.phaseTimerGeneration;
    this.state.phaseEndsAt = this.now() + durationMs;
    this.phaseTimerId = setTimeout(() => {
      if (generation !== this.phaseTimerGeneration) return;
      this.handlePhaseTimeout();
    }, durationMs);
  }

  /**
   * When a phase timer expires, finish unfinished actions the way a bot would
   * (or end Discussion and move to proposing).
   */
  private handlePhaseTimeout() {
    if (!this.state.timersEnabled) return;

    if (this.state.phase === GamePhase.Discussion) {
      this.endDiscussion();
      return;
    }

    if (this.state.phase === GamePhase.ProposingTeam) {
      const proposer = this.state.players[this.state.proposerIndex];
      if (!proposer) return;
      const numPlayers = this.state.players.length;
      if (!isSupportedPlayerCount(numPlayers)) return;
      const size = requiredTeamSize(numPlayers, this.state.currentRound);
      const team = chooseProposedTeam(proposer.id, this.state.players, size, this.random);
      this.proposeTeam(proposer.id, team);
      return;
    }

    if (this.state.phase === GamePhase.VotingOnTeam) {
      for (const p of this.state.players) {
        if (!this.state.teamVotes[p.id]) {
          this.state.teamVotes[p.id] = chooseTeamVote(
            {
              botId: p.id,
              proposedTeam: this.state.currentProposedTeam,
              currentRound: this.state.currentRound,
              consecutiveRejections: this.state.consecutiveRejections,
              playerCount: this.state.players.length,
            },
            this.random,
          );
        }
      }
      this.resolveVoting();
      return;
    }

    if (this.state.phase === GamePhase.Raid) {
      for (const id of this.state.currentProposedTeam) {
        if (!this.state.raidActions[id]) {
          const player = this.state.players.find((p) => p.id === id);
          this.state.raidActions[id] = chooseRaidAction(
            { role: player?.role, currentRound: this.state.currentRound },
            this.random,
          );
        }
      }
      this.resolveRaid();
    }
  }

  /** Pad lobby to MIN_PLAYERS with bots and start (for games with fewer than 5 humans). */
  public startGameWithBots() {
    if (this.state.phase !== GamePhase.Lobby) return;
    if (this.state.players.length >= MIN_PLAYERS) {
      this.startGame();
      return;
    }

    let n = 1;
    while (this.state.players.length < MIN_PLAYERS) {
      const id = `${BOT_ID_PREFIX}${n}`;
      if (!this.state.players.find((p) => p.id === id)) {
        this.state.players.push({ id, name: `Bot ${n}`, role: null });
      }
      n++;
    }

    this.botsEnabled = true;
    this.startGame();
    // Prefer a human proposer so the first propose/vote screens are interactive.
    const humanIdx = this.state.players.findIndex((p) => !isBot(p.id));
    if (humanIdx >= 0) this.state.proposerIndex = humanIdx;
    this.notify();
    this.playBots();
  }

  public startGame() {
    const numPlayers = this.state.players.length;
    if (!isSupportedPlayerCount(numPlayers)) return;

    const roles = assignRoles(numPlayers, this.random);
    this.state.players.forEach((p, i) => {
      p.role = roles[i]!;
    });

    this.state.proposerIndex = pickProposerIndex(numPlayers, this.random);
    this.state.phase = GamePhase.Discussion;
    this.armPhaseTimer(PHASE_DURATION_MS.Discussion);
    this.notify();
  }

  private playBots() {
    if (!this.botsEnabled) return;

    if (this.state.phase === GamePhase.ProposingTeam) {
      const proposer = this.state.players[this.state.proposerIndex];
      if (proposer && isBot(proposer.id)) {
        const size = requiredTeamSize(
          this.state.players.length as PlayerCount,
          this.state.currentRound,
        );
        const team = chooseProposedTeam(proposer.id, this.state.players, size, this.random);
        this.proposeTeam(proposer.id, team);
        return;
      }
    }

    if (this.state.phase === GamePhase.VotingOnTeam) {
      let filled = false;
      for (const p of this.state.players) {
        if (isBot(p.id) && !this.state.teamVotes[p.id]) {
          this.state.teamVotes[p.id] = chooseTeamVote(
            {
              botId: p.id,
              proposedTeam: this.state.currentProposedTeam,
              currentRound: this.state.currentRound,
              consecutiveRejections: this.state.consecutiveRejections,
              playerCount: this.state.players.length,
            },
            this.random,
          );
          filled = true;
        }
      }
      if (filled) {
        if (Object.keys(this.state.teamVotes).length === this.state.players.length) {
          this.resolveVoting();
        } else {
          this.notify();
        }
      }
      return;
    }

    if (this.state.phase === GamePhase.Raid) {
      let filled = false;
      for (const id of this.state.currentProposedTeam) {
        if (isBot(id) && !this.state.raidActions[id]) {
          const player = this.state.players.find((p) => p.id === id);
          this.state.raidActions[id] = chooseRaidAction(
            { role: player?.role, currentRound: this.state.currentRound },
            this.random,
          );
          filled = true;
        }
      }
      if (filled) {
        if (Object.keys(this.state.raidActions).length === this.state.currentProposedTeam.length) {
          this.resolveRaid();
        } else {
          this.notify();
        }
      }
    }
  }

  public endDiscussion() {
    if (this.state.phase !== GamePhase.Discussion) return;
    this.state.phase = GamePhase.ProposingTeam;
    this.armPhaseTimer(PHASE_DURATION_MS.ProposingTeam);
    this.notify();
    this.playBots();
  }

  public proposeTeam(playerId: string, team: PlayerId[]) {
    if (this.state.phase !== GamePhase.ProposingTeam) return;
    if (this.state.players[this.state.proposerIndex]?.id !== playerId) return;

    const numPlayers = this.state.players.length;
    if (!isSupportedPlayerCount(numPlayers)) return;
    if (team.length !== requiredTeamSize(numPlayers, this.state.currentRound)) return;

    this.state.currentProposedTeam = team;
    this.state.teamVotes = {};
    this.state.phase = GamePhase.VotingOnTeam;
    this.armPhaseTimer(PHASE_DURATION_MS.VotingOnTeam);
    this.notify();
    this.playBots();
  }

  public skipProposal(playerId: string) {
    if (this.state.phase !== GamePhase.ProposingTeam) return;
    if (this.state.players[this.state.proposerIndex]?.id !== playerId) return;

    this.nextProposer();
    this.armPhaseTimer(PHASE_DURATION_MS.ProposingTeam);
    this.notify();
    this.playBots();
  }

  public voteTeam(playerId: string, vote: Vote) {
    if (this.state.phase !== GamePhase.VotingOnTeam) return;
    if (this.state.teamVotes[playerId]) return;

    this.state.teamVotes[playerId] = vote;

    if (Object.keys(this.state.teamVotes).length === this.state.players.length) {
      this.resolveVoting();
    } else {
      this.notify();
      this.playBots();
    }
  }

  private resolveVoting() {
    const approves = countApproves(this.state.teamVotes);

    if (isTeamApproved(approves, this.state.players.length)) {
      this.state.consecutiveRejections = 0;
      this.state.phase = GamePhase.Raid;
      this.state.raidActions = {};
      this.armPhaseTimer(PHASE_DURATION_MS.Raid);
    } else {
      this.state.consecutiveRejections++;
      if (molesWinByRejectionLimit(this.state.consecutiveRejections, this.state.players.length)) {
        this.endGame(Role.Mole);
      } else {
        this.nextProposer();
        this.armPhaseTimer(PHASE_DURATION_MS.ProposingTeam);
      }
    }
    this.notify();
    this.playBots();
  }

  private nextProposer() {
    this.state.proposerIndex = (this.state.proposerIndex + 1) % this.state.players.length;
    this.state.phase = GamePhase.ProposingTeam;
    this.state.currentProposedTeam = [];
    this.state.teamVotes = {};
  }

  public submitRaidAction(playerId: string, action: RaidAction) {
    if (this.state.phase !== GamePhase.Raid) return;
    if (!this.state.currentProposedTeam.includes(playerId)) return;
    if (this.state.raidActions[playerId]) return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!isRaidActionAllowed(player?.role, action)) return;

    this.state.raidActions[playerId] = action;

    if (Object.keys(this.state.raidActions).length === this.state.currentProposedTeam.length) {
      this.resolveRaid();
    } else {
      this.notify();
      this.playBots();
    }
  }

  private resolveRaid() {
    const sabotages = countSabotages(this.state.raidActions);
    const numPlayers = this.state.players.length as PlayerCount;
    const requiredSabotages = requiredSabotagesForRound(numPlayers, this.state.currentRound);
    const success = isRaidSuccessful(sabotages, requiredSabotages);

    this.state.raidResults.push({
      round: this.state.currentRound,
      team: [...this.state.currentProposedTeam],
      sabotageCount: sabotages,
      success,
    });

    if (success) {
      this.state.scores.police++;
    } else {
      this.state.scores.moles++;
    }

    const winner = winnerFromScores(this.state.scores);
    if (winner === 'Police') {
      this.endGame(Role.Police);
    } else if (winner === 'Moles') {
      this.endGame(Role.Mole);
    } else {
      this.state.currentRound++;
      this.nextProposer();
      this.state.phase = GamePhase.Discussion;
      this.armPhaseTimer(PHASE_DURATION_MS.Discussion);
    }
    this.notify();
    this.playBots();
  }

  private endGame(winnerRole: Role) {
    this.disarmPhaseTimer();
    this.state.phase = GamePhase.GameOver;
    this.state.winner = winnerRole === Role.Police ? 'Police' : 'Moles';
  }
}
