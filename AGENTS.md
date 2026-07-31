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
