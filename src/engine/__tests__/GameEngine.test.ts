import { describe, expect, it } from 'vitest';
import { GamePhase, Role } from '../../types/game';
import { createBotBrain } from '../bots/createBotBrain';
import type { BotBrain } from '../bots/types';
import { BOT_ID_PREFIX, MAX_PLAYERS, MIN_PLAYERS, WINS_NEEDED } from '../constants';
import { GameEngine } from '../GameEngine';
import { createSeededRandom, createSequenceRandom } from '../rng';
import {
  allRaid,
  allVote,
  beginProposing,
  createTestEngine,
  currentProposerId,
  fillLobby,
  passSuccessfulRaid,
  playersWithRole,
  proposeValidTeam,
  startWithPlayers,
  teamOfSize,
} from './helpers';

function activeBrainId(engine: GameEngine): BotBrain['id'] {
  return (engine as unknown as { botBrain: BotBrain }).botBrain.id;
}

describe('GameEngine lobby', () => {
  it('initializes with the host in Lobby', () => {
    const { engine, getState } = createTestEngine('host', 'Ada');
    const state = getState();
    expect(state.phase).toBe(GamePhase.Lobby);
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toMatchObject({ id: 'host', name: 'Ada', role: null });
    expect(state.advancedBotsEnabled).toBe(true);
    expect(activeBrainId(engine)).toBe('bayesian');
  });

  it('adds unique players up to MAX_PLAYERS', () => {
    const { engine, getState } = createTestEngine();
    fillLobby(engine, MAX_PLAYERS);
    expect(getState().players).toHaveLength(MAX_PLAYERS);

    engine.addPlayer('extra', 'Extra');
    expect(getState().players).toHaveLength(MAX_PLAYERS);

    engine.addPlayer('p2', 'Duplicate');
    expect(getState().players.filter((p) => p.id === 'p2')).toHaveLength(1);
  });

  it('does not drop players from the live roster outside Lobby', () => {
    const ctx = startWithPlayers(5);
    const before = ctx.getState().players.length;
    ctx.engine.removePlayer('p2');
    expect(ctx.getState().players).toHaveLength(before);

    const lobby = createTestEngine();
    fillLobby(lobby.engine, 5);
    lobby.engine.removePlayer('p2');
    expect(lobby.getState().players.map((p) => p.id)).not.toContain('p2');
  });

  it('refuses to start with fewer than MIN_PLAYERS', () => {
    const { engine, getState } = createTestEngine();
    fillLobby(engine, MIN_PLAYERS - 1);
    engine.startGame();
    expect(getState().phase).toBe(GamePhase.Lobby);
  });

  it('does not start while a lobby grace seat is needed to reach MIN_PLAYERS', () => {
    const { engine, getState } = createTestEngine();
    fillLobby(engine, MIN_PLAYERS);
    engine.setPlayerConnected('p2', false);
    engine.startGame();
    expect(getState().phase).toBe(GamePhase.Lobby);
    expect(getState().players.map((p) => p.id)).toContain('p2');
    expect(getState().players.find((p) => p.id === 'p2')?.connected).toBe(false);
  });

  it('drops disconnected lobby seats when enough officers are live', () => {
    const { engine, getState } = createTestEngine();
    fillLobby(engine, MIN_PLAYERS + 1);
    engine.setPlayerConnected('p2', false);
    engine.startGame();
    expect(getState().phase).toBe(GamePhase.Discussion);
    expect(getState().players).toHaveLength(MIN_PLAYERS);
    expect(getState().players.map((p) => p.id)).not.toContain('p2');
    expect(getState().players.every((p) => p.connected)).toBe(true);
  });

  it('adds spectators when the roster is full or the match has started', () => {
    const lobby = createTestEngine();
    fillLobby(lobby.engine, MAX_PLAYERS);
    lobby.engine.addSpectator('watch', 'Alpha');
    expect(lobby.getState().spectators).toEqual([{ id: 'watch', name: 'Alpha' }]);

    const playing = startWithPlayers(5);
    playing.engine.addPlayer('late', 'Late');
    expect(playing.getState().players).toHaveLength(5);
    playing.engine.addSpectator('watch', 'Alpha');
    expect(playing.getState().spectators.map((s) => s.name)).toEqual(['Alpha']);
  });

  it('renames a player to a unique callsign and marks disconnects', () => {
    const { engine, getState } = createTestEngine('host', 'Ada');
    engine.addPlayer('p2', 'Bravo');
    expect(engine.rename('p2', 'Kilo')).toBe(true);
    expect(getState().players.find((p) => p.id === 'p2')?.name).toBe('Kilo');

    engine.setPlayerConnected('p2', false);
    expect(getState().players.find((p) => p.id === 'p2')?.connected).toBe(false);
    engine.setPlayerConnected('p2', true);
    expect(getState().players.find((p) => p.id === 'p2')?.connected).toBe(true);
  });

  it('increments stateSeq on each notify', () => {
    const { engine, getState } = createTestEngine();
    const first = getState().stateSeq;
    engine.addPlayer('p2', 'Bravo');
    expect(getState().stateSeq).toBe(first + 1);
  });
});

describe('GameEngine startGame', () => {
  it('assigns roles and enters Discussion', () => {
    const ctx = startWithPlayers(5, { random: createSeededRandom(10) });
    const state = ctx.getState();
    expect(state.phase).toBe(GamePhase.Discussion);
    expect(playersWithRole(state, Role.Mole)).toHaveLength(2);
    expect(playersWithRole(state, Role.Police)).toHaveLength(3);
    expect(state.players.every((p) => p.role !== null)).toBe(true);
  });

  it('uses injected RNG for the proposer index', () => {
    // After role shuffle (4 random calls for n=5), next random picks proposer.
    // Force proposer index 0 by returning 0 for that call via a seeded path:
    // easier: use sequence that keeps shuffle stable-ish and forces index.
    const random = createSequenceRandom([
      // Fisher–Yates for 5 items uses i=4..1 → 4 draws
      0, 0, 0, 0,
      // proposer: floor(0 * 5) = 0
      0,
    ]);
    const ctx = startWithPlayers(5, { random });
    expect(ctx.getState().proposerIndex).toBe(0);
  });
});

describe('GameEngine discussion / proposing', () => {
  it('moves Discussion → ProposingTeam', () => {
    const ctx = startWithPlayers(5);
    beginProposing(ctx);
  });

  it('ignores endDiscussion outside Discussion', () => {
    const ctx = startWithPlayers(5);
    beginProposing(ctx);
    ctx.engine.endDiscussion();
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
  });

  it('only the current proposer can propose a correctly sized team', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    beginProposing(ctx);
    const state = ctx.getState();
    const proposer = currentProposerId(state);
    const other = state.players.find((p) => p.id !== proposer)!.id;

    ctx.engine.proposeTeam(other, teamOfSize(state));
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);

    ctx.engine.proposeTeam(proposer, [proposer]); // wrong size for round 1 (needs 2)
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);

    proposeValidTeam(ctx);
    expect(ctx.getState().phase).toBe(GamePhase.VotingOnTeam);
    expect(ctx.getState().currentProposedTeam).toHaveLength(2);
  });

  it('skipProposal advances the proposer without counting a rejection', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    beginProposing(ctx);
    const before = ctx.getState().proposerIndex;
    ctx.engine.skipProposal(currentProposerId(ctx.getState()));
    expect(ctx.getState().proposerIndex).toBe((before + 1) % 5);
    expect(ctx.getState().consecutiveRejections).toBe(0);
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
  });
});

describe('GameEngine voting', () => {
  it('approves with strict majority and enters Raid', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    beginProposing(ctx);
    proposeValidTeam(ctx);
    // 3 Approve, 2 Reject → majority
    const ids = ctx.getState().players.map((p) => p.id);
    ctx.engine.voteTeam(ids[0]!, 'Approve');
    ctx.engine.voteTeam(ids[1]!, 'Approve');
    ctx.engine.voteTeam(ids[2]!, 'Approve');
    ctx.engine.voteTeam(ids[3]!, 'Reject');
    ctx.engine.voteTeam(ids[4]!, 'Reject');
    expect(ctx.getState().phase).toBe(GamePhase.Raid);
    expect(ctx.getState().consecutiveRejections).toBe(0);
  });

  it('rejects without majority, advances proposer, increments rejection counter', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    beginProposing(ctx);
    const before = ctx.getState().proposerIndex;
    proposeValidTeam(ctx);
    allVote(ctx, 'Reject');
    expect(ctx.getState().phase).toBe(GamePhase.ProposingTeam);
    expect(ctx.getState().consecutiveRejections).toBe(1);
    expect(ctx.getState().proposerIndex).toBe((before + 1) % 5);
  });

  it('does not allow double voting', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    beginProposing(ctx);
    proposeValidTeam(ctx);
    const id = ctx.getState().players[0]!.id;
    ctx.engine.voteTeam(id, 'Approve');
    ctx.engine.voteTeam(id, 'Reject');
    expect(ctx.getState().teamVotes[id]).toBe('Approve');
  });

  it('moles win after playerCount consecutive rejections', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    for (let i = 0; i < 5; i++) {
      if (ctx.getState().phase === GamePhase.Discussion) {
        ctx.engine.endDiscussion();
      }
      proposeValidTeam(ctx);
      allVote(ctx, 'Reject');
    }
    expect(ctx.getState().phase).toBe(GamePhase.GameOver);
    expect(ctx.getState().winner).toBe('Moles');
  });
});

describe('GameEngine raid', () => {
  it('police cannot sabotage; moles can', () => {
    const ctx = startWithPlayers(5, { random: createSeededRandom(3) });
    beginProposing(ctx);

    const state = ctx.getState();
    const police = playersWithRole(state, Role.Police)[0]!;
    const mole = playersWithRole(state, Role.Mole)[0]!;
    // Force a team containing both by proposing as current proposer with those ids + pad
    const size = teamOfSize(state).length;
    const team = [police.id, mole.id, ...state.players.map((p) => p.id)]
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, size);

    ctx.engine.proposeTeam(currentProposerId(state), team);
    allVote(ctx, 'Approve');

    ctx.engine.submitRaidAction(police.id, 'Sabotage');
    expect(ctx.getState().raidActions[police.id]).toBeUndefined();

    ctx.engine.submitRaidAction(mole.id, 'Sabotage');
    expect(ctx.getState().raidActions[mole.id]).toBe('Sabotage');
  });

  it('ignores actions from players not on the raid team', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    beginProposing(ctx);
    proposeValidTeam(ctx);
    allVote(ctx, 'Approve');
    const onTeam = new Set(ctx.getState().currentProposedTeam);
    const outsider = ctx.getState().players.find((p) => !onTeam.has(p.id))!;
    ctx.engine.submitRaidAction(outsider.id, 'Support');
    expect(ctx.getState().raidActions[outsider.id]).toBeUndefined();
  });

  it('awards police a point when everyone Supports', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    passSuccessfulRaid(ctx);
    expect(ctx.getState().scores.police).toBe(1);
    expect(ctx.getState().scores.moles).toBe(0);
    expect(ctx.getState().raidResults[0]?.success).toBe(true);
    expect(ctx.getState().phase).toBe(GamePhase.Discussion);
    expect(ctx.getState().currentRound).toBe(2);
  });

  it('awards moles a point when there is a sabotage', () => {
    const ctx = startWithPlayers(5, { random: createSeededRandom(11) });
    beginProposing(ctx);
    const mole = playersWithRole(ctx.getState(), Role.Mole)[0]!;
    const size = teamOfSize(ctx.getState()).length;
    const team = [mole.id, ...ctx.getState().players.map((p) => p.id)]
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, size);
    ctx.engine.proposeTeam(currentProposerId(ctx.getState()), team);
    allVote(ctx, 'Approve');
    allRaid(ctx, (id, role) => (id === mole.id || role === Role.Mole ? 'Sabotage' : 'Support'));
    expect(ctx.getState().scores.moles).toBe(1);
    expect(ctx.getState().raidResults[0]?.success).toBe(false);
  });

  it('police win after WINS_NEEDED successful raids', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    for (let i = 0; i < WINS_NEEDED; i++) {
      passSuccessfulRaid(ctx);
    }
    expect(ctx.getState().phase).toBe(GamePhase.GameOver);
    expect(ctx.getState().winner).toBe('Police');
    expect(ctx.getState().scores.police).toBe(WINS_NEEDED);
  });

  it('requires two sabotages to fail round 4 with 7 players', () => {
    // Build to round 4 with police leading 0–0 via… we need round 4 specifically.
    // Faster: run three successful raids? That would end the game (police win at 3).
    // So run two police wins and one mole win to reach round 4 without game over.
    const random = createSeededRandom(21);
    const ctx = startWithPlayers(7, { random });

    const runRaid = (sabotage: boolean) => {
      if (ctx.getState().phase === GamePhase.Discussion) ctx.engine.endDiscussion();
      const moles = playersWithRole(ctx.getState(), Role.Mole);
      const size = teamOfSize(ctx.getState()).length;
      let team = ctx.getState().players.map((p) => p.id).slice(0, size);
      if (sabotage) {
        team = [moles[0]!.id, ...ctx.getState().players.map((p) => p.id)]
          .filter((id, i, arr) => arr.indexOf(id) === i)
          .slice(0, size);
      }
      ctx.engine.proposeTeam(currentProposerId(ctx.getState()), team);
      allVote(ctx, 'Approve');
      if (!sabotage) {
        allRaid(ctx, () => 'Support');
      } else {
        const moleOnTeam = ctx
          .getState()
          .currentProposedTeam.find((id) =>
            ctx.getState().players.find((p) => p.id === id)?.role === Role.Mole,
          )!;
        allRaid(ctx, (id) => (id === moleOnTeam ? 'Sabotage' : 'Support'));
      }
    };

    runRaid(false); // police 1
    runRaid(false); // police 2
    runRaid(true); // moles 1 → round 4
    expect(ctx.getState().currentRound).toBe(4);
    expect(ctx.getState().phase).toBe(GamePhase.Discussion);

    // Round 4: one sabotage should NOT fail the raid for 7 players
    ctx.engine.endDiscussion();
    const moles = playersWithRole(ctx.getState(), Role.Mole);
    const size = teamOfSize(ctx.getState()).length;
    const team = [moles[0]!.id, moles[1]!.id, ...ctx.getState().players.map((p) => p.id)]
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, size);
    ctx.engine.proposeTeam(currentProposerId(ctx.getState()), team);
    allVote(ctx, 'Approve');

    const moleIds = new Set(moles.map((m) => m.id));
    const teamMoles = ctx.getState().currentProposedTeam.filter((id) => moleIds.has(id));
    expect(teamMoles.length).toBeGreaterThanOrEqual(1);

    // Only first mole sabotages
    allRaid(ctx, (id) => (id === teamMoles[0] ? 'Sabotage' : 'Support'));
    expect(ctx.getState().raidResults.at(-1)?.sabotageCount).toBe(1);
    expect(ctx.getState().raidResults.at(-1)?.success).toBe(true);
    expect(ctx.getState().scores.police).toBe(3);
    expect(ctx.getState().winner).toBe('Police');
  });
});

describe('GameEngine startGameWithBots', () => {
  it('pads the lobby with bots and starts', () => {
    const { engine, getState } = createTestEngine('host', 'Host', {
      random: createSeededRandom(1),
    });
    engine.startGameWithBots();
    const state = getState();
    expect(state.players.length).toBe(MIN_PLAYERS);
    expect(state.players.filter((p) => p.id.startsWith(BOT_ID_PREFIX)).length).toBe(
      MIN_PLAYERS - 1,
    );
    expect(state.phase).toBe(GamePhase.Discussion);
    // Human should be preferred as proposer
    expect(state.players[state.proposerIndex]?.id).toBe('host');
  });

  it('drops offline lobby seats before padding with bots', () => {
    const { engine, getState } = createTestEngine('host', 'Host', {
      random: createSeededRandom(1),
    });
    engine.addPlayer('p2', 'Bravo');
    engine.addPlayer('p3', 'Ghost');
    engine.setPlayerConnected('p3', false);
    engine.startGameWithBots();
    const state = getState();
    expect(state.phase).toBe(GamePhase.Discussion);
    expect(state.players.map((p) => p.id)).not.toContain('p3');
    expect(state.players).toHaveLength(MIN_PLAYERS);
    expect(state.players.every((p) => p.connected)).toBe(true);
  });
});

describe('GameEngine.debugBayesianBeliefs', () => {
  it('is null in lobby and when the heuristic brain is active', () => {
    const { engine } = createTestEngine('host', 'Host');
    expect(engine.debugBayesianBeliefs()).toBeNull();

    engine.setAdvancedBotsEnabled(false);
    engine.startGameWithBots();
    expect(engine.debugBayesianBeliefs()).toBeNull();
  });

  it('returns each bot posterior once a Bayesian match with bots is running', () => {
    const { engine, getState } = createTestEngine('host', 'Host', {
      random: createSeededRandom(1),
    });
    engine.startGameWithBots();
    const snap = engine.debugBayesianBeliefs();
    expect(snap?.brain).toBe('bayesian');
    expect(snap?.phase).toBe(GamePhase.Discussion);
    expect(Object.keys(snap!.byObserver)).toHaveLength(MIN_PLAYERS - 1);
    const bot1 = snap!.observers.find((o) => o.observerName === 'Bot 1');
    expect(bot1?.moleP.Host).toBe(0.5);
    expect(bot1?.moleP['Bot 1']).toBe(0);
    expect(getState().players.some((p) => p.id.startsWith(BOT_ID_PREFIX))).toBe(true);
  });
});

describe('GameEngine advanced bots toggle', () => {
  it('switches to the original heuristic brain in Lobby', () => {
    const { engine, getState } = createTestEngine();
    engine.setAdvancedBotsEnabled(false);
    expect(getState().advancedBotsEnabled).toBe(false);
    expect(activeBrainId(engine)).toBe('heuristic');

    engine.setAdvancedBotsEnabled(true);
    expect(getState().advancedBotsEnabled).toBe(true);
    expect(activeBrainId(engine)).toBe('bayesian');
  });

  it('honors an injected heuristic brain', () => {
    const { engine, getState } = createTestEngine('host', 'Host', {
      botBrain: createBotBrain('heuristic'),
    });
    expect(getState().advancedBotsEnabled).toBe(false);
    expect(activeBrainId(engine)).toBe('heuristic');
  });

  it('ignores the toggle after the match has started', () => {
    const ctx = startWithPlayers(5);
    expect(ctx.getState().advancedBotsEnabled).toBe(true);
    ctx.engine.setAdvancedBotsEnabled(false);
    expect(ctx.getState().advancedBotsEnabled).toBe(true);
    expect(activeBrainId(ctx.engine)).toBe('bayesian');
  });

  it('ignores the toggle after startGameWithBots', () => {
    const { engine, getState } = createTestEngine('host', 'Host', {
      random: createSeededRandom(1),
    });
    engine.setAdvancedBotsEnabled(false);
    engine.startGameWithBots();
    expect(getState().phase).toBe(GamePhase.Discussion);
    engine.setAdvancedBotsEnabled(true);
    expect(getState().advancedBotsEnabled).toBe(false);
    expect(activeBrainId(engine)).toBe('heuristic');
  });
});

describe('GameEngine rematch', () => {
  it('ignores startGame while a match is in progress', () => {
    const ctx = startWithPlayers(5);
    const rolesBefore = ctx.getState().players.map((p) => p.role);
    ctx.engine.startGame();
    expect(ctx.getState().phase).toBe(GamePhase.Discussion);
    expect(ctx.getState().players.map((p) => p.role)).toEqual(rolesBefore);
  });

  it('starts a new match from GameOver with the same players', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    for (let i = 0; i < WINS_NEEDED; i++) {
      passSuccessfulRaid(ctx);
    }
    const roster = ctx.getState().players.map((p) => ({ id: p.id, name: p.name }));
    expect(ctx.getState().phase).toBe(GamePhase.GameOver);
    expect(ctx.getState().scores.police).toBe(WINS_NEEDED);

    ctx.engine.startGame();
    const state = ctx.getState();
    expect(state.phase).toBe(GamePhase.Discussion);
    expect(state.players.map((p) => ({ id: p.id, name: p.name }))).toEqual(roster);
    expect(state.players.every((p) => p.role !== null)).toBe(true);
    expect(state.scores).toEqual({ police: 0, moles: 0 });
    expect(state.raidResults).toEqual([]);
    expect(state.winner).toBeNull();
    expect(state.currentRound).toBe(1);
    expect(state.consecutiveRejections).toBe(0);
    expect(state.currentProposedTeam).toEqual([]);
    expect(state.hostId).toBe('host');
    expect(state.timersEnabled).toBe(false);
    expect(state.advancedBotsEnabled).toBe(true);
  });

  it('keeps the heuristic brain across rematch', () => {
    const ctx = startWithPlayers(5, {
      advancedBotsEnabled: false,
      random: createSequenceRandom([0, 0, 0, 0, 0]),
    });
    expect(ctx.getState().advancedBotsEnabled).toBe(false);
    expect(activeBrainId(ctx.engine)).toBe('heuristic');
    for (let i = 0; i < WINS_NEEDED; i++) {
      passSuccessfulRaid(ctx);
    }
    ctx.engine.startGame();
    expect(ctx.getState().advancedBotsEnabled).toBe(false);
    expect(activeBrainId(ctx.engine)).toBe('heuristic');
  });

  it('keeps departed players on the GameOver roster, then replaces them with bots on rematch', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    for (let i = 0; i < WINS_NEEDED; i++) {
      passSuccessfulRaid(ctx);
    }
    expect(ctx.getState().phase).toBe(GamePhase.GameOver);

    ctx.engine.removePlayer('p2');
    ctx.engine.removePlayer('p3');
    ctx.engine.removePlayer('host');
    expect(ctx.getState().players.map((p) => p.id)).toEqual(['host', 'p2', 'p3', 'p4', 'p5']);

    ctx.engine.startGame();
    const ids = ctx.getState().players.map((p) => p.id);
    expect(ids).toHaveLength(5);
    expect(ids).toContain('host');
    expect(ids).not.toContain('p2');
    expect(ids).not.toContain('p3');
    expect(ids.filter((id) => id.startsWith(BOT_ID_PREFIX))).toEqual([
      `${BOT_ID_PREFIX}1`,
      `${BOT_ID_PREFIX}2`,
    ]);
    expect(ctx.getState().players[ctx.getState().proposerIndex]?.id).toBe('host');
  });

  it('lets replacement bots vote so rematch cannot stall with timers off', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    for (let i = 0; i < WINS_NEEDED; i++) {
      passSuccessfulRaid(ctx);
    }
    ctx.engine.removePlayer('p2');
    ctx.engine.startGame();

    beginProposing(ctx);
    proposeValidTeam(ctx);
    expect(ctx.getState().phase).toBe(GamePhase.VotingOnTeam);

    for (const player of ctx.getState().players) {
      if (!player.id.startsWith(BOT_ID_PREFIX)) {
        ctx.engine.voteTeam(player.id, 'Approve');
      }
    }

    expect(ctx.getState().phase).toBe(GamePhase.Raid);
    expect(Object.keys(ctx.getState().teamVotes)).toHaveLength(5);
  });

  it('replaces players who disconnected during the previous match', () => {
    const ctx = startWithPlayers(5, { random: createSequenceRandom([0, 0, 0, 0, 0]) });
    ctx.engine.removePlayer('p2');
    expect(ctx.getState().players.map((p) => p.id)).toContain('p2');

    for (let i = 0; i < WINS_NEEDED; i++) {
      passSuccessfulRaid(ctx);
    }
    expect(ctx.getState().phase).toBe(GamePhase.GameOver);

    ctx.engine.startGame();
    const ids = ctx.getState().players.map((p) => p.id);
    expect(ids).toEqual(['host', `${BOT_ID_PREFIX}1`, 'p3', 'p4', 'p5']);
    expect(ctx.getState().players.every((p) => p.role !== null)).toBe(true);
  });
});

