# Agent Instructions
When working on this repository, follow these guidelines:
- Read `doc/RULES.md` to understand game mechanics.
- Read `doc/ARCHITECTURE.md` to understand the technical setup.
- Stick to React + Vite + TypeScript.
- The `NetworkService` must be abstracted to allow easy swapping of signaling backends (currently PeerJS).
- The Host player is the ultimate source of truth for the game state.
