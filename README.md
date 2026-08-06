# Police Raid

A web-based multiplayer social deduction game.

## Story
The police are conducting raids on the mafia, but the raids must be a surprise. There are "moles" (working for the mafia) in the police ranks.
The police need to ensure that no mole gets into the raid group. If a mole gets into a raid, they can warn the mafia, and the raid will fail.
The goal of the police is to successfully conduct 3 out of 5 raids.
The goal of the moles is to ruin 3 out of 5 raids.

## Mechanics
- There are 5 rounds (raids) in the game.
- Number of players: from 5 to 8.
- 2 teams: Police Officers and Moles.
- Moles know each other by sight at the start of the game. Police Officers do not know the roles of other players.

### Round Phases
1. **Discussion:** Players talk and decide who to take on the raid.
2. **Team Proposal:** Players take turns (in a circle) proposing a team composition for the raid.
   - A player can skip their turn (this does not affect the rejection counter).
3. **Voting on the Team:** All players vote on the proposed composition ("Approve" or "Reject").
   - Strict majority is required for approval (for example, with 6 players, 4 "Approve" votes are needed, 3 votes mean rejection).
   - If the team is rejected, the right to propose a team passes to the next player.
   - **Rejection limit:** If a number of proposals equal to the total number of players in the match are rejected in a row, the **Moles immediately win the entire game**.
4. **Raid:** If the team is approved, the selected players go on the raid.
   - Moles on the team secretly choose: "Sabotage" (betray the raid) or "Raid" (support the raid).
   - Police Officers on the team must "Raid".
   - If at least one player chooses "Sabotage", the raid is considered failed (a point for the Moles).
   - *Exception:* In some rounds with a large number of players (7-8), 2 "Sabotage" votes are required to fail the raid.
   - After the raid, everyone is told the total number of "Sabotage" votes, but not exactly who cast them.

### Balance
- 5 players (2 moles): team sizes 2-3-2-3-3
- 6 players (2 moles): team sizes 2-3-4-3-4
- 7 players (3 moles): team sizes 2-3-3-4*-4
- 8 players (3 moles): team sizes 3-4-4-5*-5

\* - the raid can only be won by the mafia (failed) if at least 2 moles choose "Sabotage".

## Development

```bash
cp .env.example .env   # set VITE_METERED_API_KEY (Metered Realtime pk_live_…)
npm install
npm run dev      # http://localhost:5173/
npm test         # Vitest unit tests (game engine / rules)
npm run lint
npm run build
```

Multiplayer rooms use [Metered Realtime Messaging](https://www.metered.ca/docs/realtime-messaging/). Create a publishable key with `publish`, `subscribe`, `presence`, and `send` enabled and channel pattern `*` or `police-raid/*`.