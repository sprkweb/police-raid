# Agent Instructions

## Setup & testing
Single-package Vite + React + TypeScript app. Standard commands live in `package.json` scripts.
- Package manager: both `package-lock.json` and `pnpm-lock.yaml` are committed. The environment is set up with npm (`npm install`); prefer `npm` for consistency unless intentionally switching.
- Run (dev): copy `.env.example` → `.env` and fill it, then `npm run dev` serves at `http://localhost:5173/` (Vite).
- Lint: `npm run lint` (oxlint). Build: `npm run build` (`tsc -b && vite build`).
- Unit tests: `npm test` (Vitest, single run). Tests live under `**/__tests__/`. Prefer extending these when changing something; there is no UI/E2E automated suite yet.
- Multiplayer requires outbound internet access. There is no local signaling server to start.
- Manual E2E: one tab creates a game (the address bar becomes `/?room=XXXX`); other players open that URL. A second tab in the **same browser** that reclaims an existing **client** seat disconnects the first tab — it is not a second player. Extra players: keep the host tab open and open the room URL, or use another browser profile. Starting a game needs 5–8 players in the lobby or you can start with bots.

## Architecture & Network Setup
Host-authoritative multiplayer over a swappable transport (historically WebRTC/P2P-oriented).

- **Transport (`NetworkService`):** Room create/join and messaging. Swap backends via `createNetworkService()`. Direct `send` for secrets and actions; the room channel is presence / first `JOIN_REQUEST` only. Today: Metered (`MeteredNetworkService`) over `wss://rms.metered.ca`, publishable key in `.env`. Keep a single live instance (lazy-init in `GameContext`); recreating it on remount drops the connection.
- **Host model:** The host browser is the server. `GameEngine` is the source of truth; the host unicasts a redacted `GAME_STATE_UPDATE` per seat (monotonic `stateSeq`). Clients send actions to the host via direct `send`. Host disconnect or refresh ends the game for everyone (no host migration).

## High-level Components
- **NetworkService:** Transport only.
- **HostRoom (host-only):** Seating, reclaim, lobby disconnect grace, routing actions by current peer. Wraps `GameEngine`.
- **GameEngine (host-only):** Phases Lobby → Discussion → Proposing → Voting → Raid → Round End / Game Over. Pure rules in `src/engine/rules.ts`; inject `random` via `GameEngineOptions` for tests.
- **Store/Context:** UI sees projected state only (host React state is projected too).
- **UI:** Check-in / staging lobby, game board, action areas (team, vote, raid).

## Other notes
This is a game, so all the UI, including text, should match the atmosphere of a police raid.
