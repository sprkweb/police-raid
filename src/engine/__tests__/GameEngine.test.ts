import { describe, expect, it } from 'vitest';
import { GamePhase, Role } from '../../types/game';
import { BOT_ID_PREFIX, MAX_PLAYERS, MIN_PLAYERS, WINS_NEEDED } from '../constants';
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

describe('GameEngine lobby', () => {
  it('initializes with the host in Lobby', () => {
    const { getState } = createTestEngine('host', 'Ada');
    const state = getState();
    expect(state.phase).toBe(GamePhase.Lobby);
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toMatchObject({ id: 'host', name: 'Ada', role: null });
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

  it('removes players only while in Lobby', () => {
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
});
