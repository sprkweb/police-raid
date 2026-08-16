# Agent Instructions

## Setup & testing
Single-package Vite + React + TypeScript app. Standard commands live in `package.json` scripts.
- Package manager: both `package-lock.json` and `pnpm-lock.yaml` are committed. The environment is set up with npm (`npm install`); prefer `npm` for consistency unless intentionally switching.
- Run (dev): copy `.env.example` → `.env` and fill it, then `npm run dev` serves at `http://localhost:5173/` (Vite).
- Lint: `npm run lint` (oxlint). Build: `npm run build` (`tsc -b && vite build`).
- Unit tests: `npm test` (Vitest, single run). Tests live under `src/engine/__tests__/` and `src/network/__tests__/`. Prefer extending these when changing something; there is no UI/E2E automated suite yet.
- Multiplayer requires outbound internet access. There is no local signaling server to start.
- Manual E2E: one tab creates a game (the address bar becomes `/?room=XXXX`); other players open that URL. A second tab in the **same browser** that reclaims an existing **client** seat disconnects the first tab — it is not a second player. Extra players: keep the host tab open and open the room URL, or use another browser profile. Starting a game needs 5–8 players in the lobby.

## Architecture & Network Setup
Host-authoritative multiplayer over a swappable transport.

1. **Transport (`NetworkService`):** Room create/join and messaging. Swap backends via `createNetworkService()`. Direct `send` for secrets and actions; the room channel is presence / first `JOIN_REQUEST` only. Today: Metered (`MeteredNetworkService`) over `wss://rms.metered.ca`, publishable key in `.env`. Keep a single live instance (lazy-init in `GameContext`); recreating it on remount drops the connection.

2. **Seats vs peers:** Transport `peerId` is not `Player.id`. The host (`HostRoom` / `SeatDirectory`) issues a stable `seatId` + reclaim secret. The secret never goes in the URL or on the room channel. Client reload unicasts `RECLAIM` to the stored host peer (`src/network/seatSession.ts`, handshake in `src/network/enterRoom.ts`).

3. **Room URL:** `/?room=XXXX` is the live lobby address (`src/network/roomUrl.ts`). Create/join rewrites the address bar; opening that link auto-joins. Check-in prefills the last callsign or a random NATO name (`src/network/callsignMemory.ts`). Late join or a full lobby (8) is a spectator (no vote / propose / raid).

4. **Same-browser tabs:** Claiming the same `seatId` in another tab disconnects the first (`src/network/tabPresence.ts`). Do not kick the host tab when a new tab joins as a different player.

5. **Host model:** The host browser is the server. `GameEngine` is the source of truth; the host unicasts a redacted `GAME_STATE_UPDATE` per seat (monotonic `stateSeq`). Clients send actions to the host via direct `send`. Host disconnect or refresh ends the game for everyone (no host migration).

## High-level Components
- **NetworkService:** Transport only.
- **HostRoom (host-only):** Seating, reclaim, lobby disconnect grace, routing actions by current peer. Wraps `GameEngine`.
- **GameEngine (host-only):** Phases Lobby → Discussion → Proposing → Voting → Raid → Round End / Game Over. Pure rules in `src/engine/rules.ts`; inject `random` via `GameEngineOptions` for tests.
- **Store/Context:** UI sees projected state only (host React state is projected too).
- **UI:** Check-in / staging lobby, game board, action areas (team, vote, raid).

## Other notes
This is a game, so all the UI, including text, should match the atmosphere of a police raid.
