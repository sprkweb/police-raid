# Agent Instructions

## Setup & testing
Single-package Vite + React + TypeScript app. Standard commands live in `package.json` scripts.
- Package manager: both `package-lock.json` and `pnpm-lock.yaml` are committed. The environment is set up with npm (`npm install`); prefer `npm` for consistency unless intentionally switching.
- Run (dev): `npm run dev` serves at `http://localhost:5173/` (Vite). Use dev mode, not `npm run build`/`preview`.
- Lint: `npm run lint` (oxlint). Build: `npm run build` (`tsc -b && vite build`).
- Unit tests: `npm test` (Vitest, single run) or `npm run test:watch`. Tests live under `src/engine/__tests__/` and cover pure rules, selectors, action routing, and the host `GameEngine` state machine. Prefer extending these when changing game rules; there is no UI/E2E automated suite yet.
- CI: GitHub Actions workflow `.github/workflows/ci.yml` runs on every pull request (and pushes to `main`): `npm run lint`, `npm test`, and `npm run build`. Enable **Require status checks** on that workflow in the repo branch protection settings if merges should wait on green CI.
- Networking gotcha: multiplayer uses PeerJS/WebRTC against the default public PeerJS cloud broker, so signaling requires outbound internet access. There is no local signaling server to start.
- Manual E2E testing needs multiple browser tabs (each tab is a separate peer). One tab clicks "Create New Game" to host and generates a `PR-XXXX` room code; other tabs join with that exact code. Starting an actual game requires 5–8 players in the lobby (the "Start Game" button stays disabled otherwise), so a full game run needs 5+ tabs.

## Architecture & Network Setup
The game uses a serverless P2P architecture utilizing WebRTC for gameplay communication.

1. **Signaling:**
   - We use an external signaling service to connect players via short Room IDs.
   - Initial implementation will use **PeerJS**.
   - The signaling logic is abstracted behind a `NetworkService` interface so it can be easily swapped in the future (e.g., for Firebase, Supabase, or a custom WebSocket server).

2. **Host-based P2P:**
   - One player's browser acts as the "Host" (server). The Host player is the ultimate source of truth for the game state.
   - The Host holds the authoritative Game State, verifies rules, and broadcasts state updates to all other connected peers.
   - Other players act as "Clients", sending their actions (e.g., vote, propose team, sabotage) to the Host.
   - If the Host disconnects or closes/refreshes the tab, the game immediately ends for everyone (no host migration).

## High-level Components
- **NetworkService:** Handles connecting to the signaling server, creating rooms, joining rooms, and sending/receiving messages. It must be abstracted to allow easy swapping of signaling backends (currently PeerJS)
- **GameEngine (Host-only):** The state machine that validates actions and advances game phases (Lobby -> Discussion -> Proposing -> Voting -> Raid -> Round End / Game Over). Pure rule helpers live in `src/engine/rules.ts`; inject `random` via `GameEngineOptions` for deterministic tests.
- **Store/Context:** React Context or a lightweight state manager to reactively update the UI based on the current Game State broadcasted by the Host.
- **UI Views:**
  - Lobby (join/create)
  - Game Board (players, scores, current phase)
  - Action Modals/Areas (Team selection, Voting, Raid action)
