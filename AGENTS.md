# Agent Instructions

Technology Stack: React + Vite + TypeScript.

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
   - If the Host disconnects or closes the tab, the game immediately ends for everyone. There is no host-migration logic for the initial version.

## High-level Components
- **NetworkService:** Handles connecting to the signaling server, creating rooms, joining rooms, and sending/receiving messages. It must be abstracted to allow easy swapping of signaling backends (currently PeerJS)
- **GameEngine (Host-only):** The state machine that validates actions and advances game phases (Lobby -> Proposing -> Voting -> Raid -> Round End).
- **Store/Context:** React Context or a lightweight state manager to reactively update the UI based on the current Game State broadcasted by the Host.
- **UI Views:**
  - Lobby (join/create)
  - Game Board (players, scores, current phase)
  - Action Modals/Areas (Team selection, Voting, Raid action)

## Cursor Cloud specific instructions

Single-package Vite + React + TypeScript app. Standard commands live in `package.json` scripts.

- Package manager: both `package-lock.json` and `pnpm-lock.yaml` are committed. The environment is set up with npm (`npm install`); prefer `npm` for consistency unless intentionally switching.
- Run (dev): `npm run dev` serves at `http://localhost:5173/` (Vite). Use dev mode, not `npm run build`/`preview`.
- Lint: `npm run lint` (oxlint). Build: `npm run build` (`tsc -b && vite build`).
- There is no test framework or automated test suite; there is no `test` script. Validate changes via lint, build, and manual browser testing.
- Networking gotcha: multiplayer uses PeerJS/WebRTC against the default public PeerJS cloud broker, so signaling requires outbound internet access. There is no local signaling server to start.
- Manual E2E testing needs multiple browser tabs (each tab is a separate peer). One tab clicks "Create New Game" to host and generates a `PR-XXXX` room code; other tabs join with that exact code. Starting an actual game requires 5–8 players in the lobby (the "Start Game" button stays disabled otherwise), so a full game run needs 5+ tabs.
- Host is authoritative: if the host tab closes/refreshes, the game ends for everyone (no host migration).
