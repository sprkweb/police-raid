# Agent Instructions

## Setup & testing
Single-package Vite + React + TypeScript app. Standard commands live in `package.json` scripts.
- Package manager: both `package-lock.json` and `pnpm-lock.yaml` are committed. The environment is set up with npm (`npm install`); prefer `npm` for consistency unless intentionally switching.
- Run (dev): copy `.env.example` → `.env` and fill it, then `npm run dev` serves at `http://localhost:5173/` (Vite).
- Lint: `npm run lint` (oxlint). Build: `npm run build` (`tsc -b && vite build`).
- Unit tests: `npm test` (Vitest, single run). Tests live under `src/engine/__tests__/`. Prefer extending these when changing something; there is no UI/E2E automated suite yet.
- Multiplayer requires outbound internet access. There is no local signaling server to start.
- Manual E2E testing needs multiple browser tabs (each tab is a separate player). One tab creates a game and shares a short room code (or the invite link with `?room=XXXX`); other tabs join with that code. Starting an actual game requires 5–8 players in the lobby (the "Start Game" button stays disabled otherwise), so a full game run needs 5+ tabs.

## Architecture & Network Setup
Host-authoritative multiplayer over a swappable network transport (historically P2P/WebRTC-oriented).

1. **Transport (`NetworkService`):**
   - Room create/join plus messaging (`sendMessage` / `broadcast`). Prefer direct `send` for secrets; the room channel is for presence / join only.
   - Abstracted behind `NetworkService` so the backend can be swapped by changing `createNetworkService()` (e.g. self-hosted WebSocket or WebRTC DataChannels later).
   - Right now uses **Metered Realtime Messaging** (`SignallingClient` in `MeteredNetworkService`) over `wss://rms.metered.ca`. Requires outbound internet and a publishable key (`pk_live_…`) in `.env`

2. **Host-based model:**
   - One player's browser is the "Host" (server). The Host is the ultimate source of truth for the game state.
   - The Host holds the full Game State in `GameEngine`, verifies rules, and **unicasts** a per-player projected `GAME_STATE_UPDATE` (`projectForPlayer` / `distributeProjectedState`) — roles, vote values, and raid picks are redacted to match UI visibility. Clients accept updates only from the locked `hostId`.
   - Other players act as "Clients", sending their actions (vote, propose team, sabotage, join) to the Host via direct `send` (not the room channel).
   - If the Host disconnects or closes/refreshes the tab, the game ends for everyone (no host migration).

## High-level Components
- **NetworkService:** Room create/join and messaging. It must be abstracted to allow easy swapping of backends.
- **GameEngine (Host-only):** The state machine that validates actions and advances game phases (Lobby -> Discussion -> Proposing -> Voting -> Raid -> Round End / Game Over). Pure rule helpers live in `src/engine/rules.ts`; inject `random` via `GameEngineOptions` for deterministic tests.
- **Store/Context:** React Context updates the UI from the projected game state (host React state is projected too; full state stays in the engine).
- **UI Views:**
 - Lobby (join/create, invite link)
 - Game Board (players, scores, current phase)
 - Action Modals/Areas (Team selection, Voting, Raid action)
