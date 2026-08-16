import { expect } from 'vitest';
import { GameEngine, type GameEngineOptions } from '../GameEngine';
import type { GameState, PlayerId, RaidAction, Role, Vote } from '../../types/game';
import { GamePhase } from '../../types/game';
import { createSeededRandom } from '../rng';
import { isSupportedPlayerCount, requiredTeamSize } from '../rules';

export interface TestEngine {
  engine: GameEngine;
  /** Latest snapshot from the notify callback. */
  latest: GameState;
  getState: () => GameState;
}

export function createTestEngine(
  hostId = 'host',
  hostName = 'Host',
  options: GameEngineOptions = {},
): TestEngine {
  let latest!: GameState;
  const engine = new GameEngine(
    hostId,
    hostName,
    (state) => {
      latest = state;
    },
    {
      timersEnabled: false,
      voteResultDurationMs: 0,
      roundEndDurationMs: 0,
      random: options.random ?? createSeededRandom(1),
      ...options,
    },
  );
  return {
    engine,
    get latest() {
      return latest;
    },
    getState: () => engine.getState(),
  };
}

/** Add players so the lobby has `total` seats (including host). */
export function fillLobby(engine: GameEngine, total: number, prefix = 'p') {
  const hostAlready = 1;
  for (let i = hostAlready + 1; i <= total; i++) {
    engine.addPlayer(`${prefix}${i}`, `Player ${i}`);
  }
}

export function startWithPlayers(
  total: number,
  options?: GameEngineOptions & { hostId?: string; hostName?: string },
): TestEngine {
  const { hostId = 'host', hostName = 'Host', ...engineOptions } = options ?? {};
  const ctx = createTestEngine(hostId, hostName, engineOptions);
  fillLobby(ctx.engine, total);
  ctx.engine.startGame();
  return ctx;
}

export function beginProposing(ctx: TestEngine) {
  expect(ctx.getState().phase).toBe(GamePhase.Discussion);
  ctx.engine.endDiscussion();
  expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
}

export function currentProposerId(state: GameState): PlayerId {
  return state.players[state.proposerIndex]!.id;
}

export function teamOfSize(state: GameState, size?: number): PlayerId[] {
  const count = state.players.length;
  if (!isSupportedPlayerCount(count)) {
    throw new Error(`unsupported player count ${count}`);
  }
  const n = size ?? requiredTeamSize(count, state.currentRound);
  return state.players.slice(0, n).map((p) => p.id);
}

/** Propose a valid-sized team as the current proposer. */
export function proposeValidTeam(ctx: TestEngine, team?: PlayerId[]) {
  const state = ctx.getState();
  ctx.engine.proposeTeam(currentProposerId(state), team ?? teamOfSize(state));
}

/** Every player casts the same vote. */
export function allVote(ctx: TestEngine, vote: Vote) {
  for (const p of ctx.getState().players) {
    ctx.engine.voteTeam(p.id, vote);
  }
}

export function playersWithRole(state: GameState, role: Role) {
  return state.players.filter((p) => p.role === role);
}

/** Have each member of the current raid team submit an action. */
export function allRaid(
  ctx: TestEngine,
  actionFor: (playerId: PlayerId, role: Role | null) => RaidAction,
) {
  const state = ctx.getState();
  for (const id of state.currentProposedTeam) {
    const player = state.players.find((p) => p.id === id)!;
    ctx.engine.submitRaidAction(id, actionFor(id, player.role));
  }
}

/** Approve a proposal and run a full support raid (police point). */
export function passSuccessfulRaid(ctx: TestEngine) {
  beginProposing(ctx);
  proposeValidTeam(ctx);
  allVote(ctx, 'Approve');
  expect(ctx.getState().phase).toBe(GamePhase.Raid);
  allRaid(ctx, () => 'Support');
}
