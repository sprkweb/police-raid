import type { GameState, Player, PlayerId, Vote, RaidAction } from '../types/game';
import { GamePhase, Role } from '../types/game';
import { chooseProposedTeam, chooseRaidAction, chooseTeamVote } from './botBehavior';
import { uniquifyCallsign, normalizeCallsign } from './callsigns';
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
  createMatchProgress,
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
  /** Humans who left after the lobby; rematch replaces them with bots. */
  private departedIds = new Set<PlayerId>();
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
    this.state.stateSeq += 1;
    this.onStateChange({
      ...this.state,
      players: this.state.players.map((p) => ({ ...p })),
      spectators: this.state.spectators.map((s) => ({ ...s })),
    });
  }

  public takenNames(exceptId?: PlayerId): string[] {
    return [...this.state.players, ...this.state.spectators]
      .filter((p) => p.id !== exceptId)
      .map((p) => p.name);
  }

  public canAddPlayer(): boolean {
    return this.state.phase === GamePhase.Lobby && this.state.players.length < MAX_PLAYERS;
  }

  public addPlayer(id: string, name: string) {
    if (!this.canAddPlayer()) return;
    if (!this.state.players.find((p) => p.id === id)) {
      this.state.players.push({ id, name, role: null, connected: true });
      this.notify();
    }
  }

  public addSpectator(id: string, name: string) {
    if (this.state.players.some((p) => p.id === id)) return;
    if (this.state.spectators.some((s) => s.id === id)) return;
    this.state.spectators.push({ id, name });
    this.notify();
  }

  public removeSpectator(id: string) {
    const next = this.state.spectators.filter((s) => s.id !== id);
    if (next.length === this.state.spectators.length) return;
    this.state.spectators = next;
    this.notify();
  }

  public setPlayerConnected(id: string, connected: boolean) {
    const player = this.state.players.find((p) => p.id === id);
    if (!player || isBot(id) || id === this.state.hostId) return;
    if (player.connected === connected) return;
    player.connected = connected;
    if (connected) {
      this.departedIds.delete(id);
    } else if (this.state.phase !== GamePhase.Lobby) {
      this.departedIds.add(id);
    }
    this.notify();
  }

  public rename(id: string, rawName: string): boolean {
    const desired = normalizeCallsign(rawName);
    if (!desired) return false;
    const player = this.state.players.find((p) => p.id === id);
    const spectator = this.state.spectators.find((s) => s.id === id);
    const target = player ?? spectator;
    if (!target) return false;
    const unique = uniquifyCallsign(desired, this.takenNames(id));
    if (target.name === unique) return false;
    target.name = unique;
    this.notify();
    return true;
  }

  public removePlayer(id: string) {
    if (isBot(id) || id === this.state.hostId) return;

    if (this.state.phase === GamePhase.Lobby) {
      this.state.players = this.state.players.filter((p) => p.id !== id);
      this.notify();
      return;
    }

    // Keep the live / results roster intact so a disconnect cannot
    // collapse player count mid-match. Rematch swaps these seats for bots.
    this.departedIds.add(id);
    const player = this.state.players.find((p) => p.id === id);
    if (player && player.connected) {
      player.connected = false;
      this.notify();
    }
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

  private nextBotSeat(): Player {
    let n = 1;
    while (this.state.players.some((p) => p.id === `${BOT_ID_PREFIX}${n}`)) {
      n++;
    }
    return { id: `${BOT_ID_PREFIX}${n}`, name: `Bot ${n}`, role: null, connected: true };
  }

  /** Swap humans who left for bot seats so rematch does not wait on ghosts. */
  private replaceDepartedWithBots() {
    if (this.departedIds.size === 0) return;

    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i]!;
      if (!this.departedIds.has(player.id) || isBot(player.id) || player.id === this.state.hostId) {
        continue;
      }
      this.state.players[i] = this.nextBotSeat();
      this.botsEnabled = true;
    }
    this.departedIds.clear();
  }

  /** Lobby grace seats stay on the roster for reclaim; they cannot start a match. */
  private liveLobbyPlayers(): Player[] {
    return this.state.players.filter(
      (p) => p.connected || isBot(p.id) || p.id === this.state.hostId,
    );
  }

  /** Pad lobby to MIN_PLAYERS with bots and start (for games with fewer than 5 humans). */
  public startGameWithBots() {
    if (this.state.phase !== GamePhase.Lobby) return;
    const live = this.liveLobbyPlayers();
    if (live.length !== this.state.players.length) {
      this.state.players = live;
    }
    if (this.state.players.length < MIN_PLAYERS) {
      while (this.state.players.length < MIN_PLAYERS) {
        this.state.players.push(this.nextBotSeat());
      }
      this.botsEnabled = true;
    }
    this.startGame();
  }

  /**
   * Start from Lobby, or rematch from GameOver with the same seat count.
   * Players who left after the lobby are replaced with bots.
   * Mid-match calls are ignored so a stray START_GAME cannot wipe a live game.
   */
  public startGame() {
    if (this.state.phase !== GamePhase.Lobby && this.state.phase !== GamePhase.GameOver) {
      return;
    }
    if (this.state.phase === GamePhase.GameOver) {
      this.replaceDepartedWithBots();
    } else {
      const live = this.liveLobbyPlayers();
      if (live.length !== this.state.players.length) {
        if (!isSupportedPlayerCount(live.length)) return;
        this.state.players = live;
      }
    }

    const numPlayers = this.state.players.length;
    if (!isSupportedPlayerCount(numPlayers)) return;

    Object.assign(this.state, createMatchProgress());

    const roles = assignRoles(numPlayers, this.random);
    this.state.players.forEach((p, i) => {
      p.role = roles[i]!;
    });

    this.state.proposerIndex = pickProposerIndex(numPlayers, this.random);
    if (this.botsEnabled) {
      const humanIdx = this.state.players.findIndex((p) => !isBot(p.id));
      if (humanIdx >= 0) this.state.proposerIndex = humanIdx;
    }
    this.state.phase = GamePhase.Discussion;
    this.armPhaseTimer(PHASE_DURATION_MS.Discussion);
    this.notify();
    this.playBots();
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
