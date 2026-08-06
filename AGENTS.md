# Agent Instructions

## Setup & testing
Single-package Vite + React + TypeScript app. Standard commands live in `package.json` scripts.
- Package manager: both `package-lock.json` and `pnpm-lock.yaml` are committed. The environment is set up with npm (`npm install`); prefer `npm` for consistency unless intentionally switching.
- Run (dev): copy `.env.example` → `.env` if the current network transport needs credentials, then `npm run dev` serves at `http://localhost:5173/` (Vite). Use dev mode, not `npm run build`/`preview`.
- Lint: `npm run lint` (oxlint). Build: `npm run build` (`tsc -b && vite build`).
- Unit tests: `npm test` (Vitest, single run) or `npm run test:watch`. Tests live under `src/engine/__tests__/` and cover pure rules, selectors, action routing, and the host `GameEngine` state machine. Prefer extending these when changing game rules; there is no UI/E2E automated suite yet.
- Networking: multiplayer goes through the `NetworkService` interface (`src/types/network.ts`). Pick the active implementation in `src/network/createNetworkService.ts`. The transport may need outbound internet and env credentials (see `.env.example`). Do not couple game/UI code to a specific provider.
- Manual E2E testing needs multiple browser tabs (each tab is a separate player). One tab creates a game and shares a short room code (or the invite link with `?room=XXXX`); other tabs join with that code. Starting an actual game requires 5–8 players in the lobby (the "Start Game" button stays disabled otherwise), so a full game run needs 5+ tabs.

## Architecture & Network Setup
Host-authoritative multiplayer over a swappable network transport (historically P2P/WebRTC-oriented; the concrete backend lives behind `NetworkService`).

1. **Transport (`NetworkService`):**
   - Creates/joins rooms, sends and broadcasts messages.
   - **`roomCode`** — short shareable lobby code (what users copy / type / put in the URL).
   - **`playerId`** — this tab's identity; same ids appear on `GameState.players` / `hostId`.
   - Swap backends by changing `createNetworkService()` only (e.g. WebRTC DataChannels, a managed realtime bus, or a custom WebSocket server).

2. **Host-based model:**
   - One player's browser is the Host (source of truth for game state).
   - The Host verifies rules and broadcasts `GAME_STATE_UPDATE`.
   - Clients send actions (vote, propose team, sabotage, join) to the Host.
   - If the Host disconnects or closes/refreshes the tab, the game ends for everyone (no host migration).

## High-level Components
- **NetworkService:** Room create/join and messaging. Construct via `createNetworkService()`.
- **GameEngine (Host-only):** The state machine that validates actions and advances game phases (Lobby -> Discussion -> Proposing -> Voting -> Raid -> Round End / Game Over). Pure rule helpers live in `src/engine/rules.ts`; inject `random` via `GameEngineOptions` for deterministic tests.
- **Store/Context:** React Context updates the UI from Host-broadcast game state.
- **UI Views:**
 - Lobby (join/create, invite link)
 - Game Board (players, scores, current phase)
 - Action Modals/Areas (Team selection, Voting, Raid action)
