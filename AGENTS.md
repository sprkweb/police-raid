# Agent Instructions

## Setup & testing
Single-package Vite + React + TypeScript app. Standard commands live in `package.json` scripts.
- Package manager: both `package-lock.json` and `pnpm-lock.yaml` are committed. The environment is set up with npm (`npm install`); prefer `npm` for consistency unless intentionally switching.
- Run (dev): copy `.env.example` → `.env`, set `VITE_METERED_API_KEY`, then `npm run dev` serves at `http://localhost:5173/` (Vite). Use dev mode, not `npm run build`/`preview`.
- Lint: `npm run lint` (oxlint). Build: `npm run build` (`tsc -b && vite build`).
- Unit tests: `npm test` (Vitest, single run) or `npm run test:watch`. Tests live under `src/engine/__tests__/` and cover pure rules, selectors, action routing, and the host `GameEngine` state machine. Prefer extending these when changing game rules; there is no UI/E2E automated suite yet.
- Networking: multiplayer uses **Metered Realtime Messaging** (`SignallingClient` in `MeteredNetworkService`) over `wss://rms.metered.ca`. Requires outbound internet and a publishable key (`pk_live_…`) with `publish`, `subscribe`, `presence`, and `send`, plus channel pattern `*` or `police-raid/*`. Game traffic is server-routed pub/sub (fine for this turn-based game); the `NetworkService` interface keeps the backend swappable.
- Manual E2E testing needs multiple browser tabs (each tab is a separate peer). One tab creates a game and gets a `PR-XXXX` room code (or copies the invite link with `?room=PR-XXXX`); other tabs join with that code. Starting an actual game requires 5–8 players in the lobby (the "Start Game" button stays disabled otherwise), so a full game run needs 5+ tabs.

## Architecture & Network Setup
Host-authoritative multiplayer: one browser is the Host (source of truth); clients send actions to the Host and receive `GAME_STATE_UPDATE` broadcasts.

1. **Transport:**
   - Room = Metered channel `police-raid/{PR-XXXX}`.
   - Short room codes stay shareable; Metered assigns a separate peer id used as `PlayerId` / `hostId`.
   - Logic is abstracted behind `NetworkService` so the backend can be swapped (e.g. self-hosted WebSocket, Supabase, or WebRTC DataChannels later).

2. **Host-based model:**
   - The Host holds the authoritative Game State, verifies rules, and broadcasts state updates.
   - Clients send actions (vote, propose team, sabotage, join) to the Host.
   - If the Host disconnects or closes/refreshes the tab, the game ends for everyone (no host migration).

## High-level Components
- **NetworkService:** Room create/join and messaging. Current impl: `MeteredNetworkService` (Metered Realtime).
- **GameEngine (Host-only):** The state machine that validates actions and advances game phases (Lobby -> Discussion -> Proposing -> Voting -> Raid -> Round End / Game Over). Pure rule helpers live in `src/engine/rules.ts`; inject `random` via `GameEngineOptions` for deterministic tests.
- **Store/Context:** React Context updates the UI from Host-broadcast game state.
- **UI Views:**
 - Lobby (join/create, invite link)
 - Game Board (players, scores, current phase)
 - Action Modals/Areas (Team selection, Voting, Raid action)
