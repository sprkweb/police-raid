# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## How to Test the Game (1-2 devices)

The game requires a minimum of 5 players to start. Since it is a web application using WebRTC (PeerJS) for peer-to-peer communication, you can easily simulate multiple players on a single device or across two devices.

### Testing on a single device
1. Run the development server (`npm run dev`).
2. Open the provided local URL (e.g., `http://localhost:5173`) in your web browser.
3. **Create the Game (Host):**
   - In the first tab, enter a name and click **"Create New Game"**.
   - Note the **Room Code** that appears at the top.
4. **Join as Clients:**
   - Open 4 more tabs (or windows) in the same browser.
   - In each new tab, enter a different name, enter the Room Code, and click **"Join"**.
5. Once all 5 tabs are in the lobby, go back to the first tab (the Host) and click **"Start Game"**.
6. You can now switch between tabs to see the game state from different players' perspectives and perform actions.

### Testing across two devices
1. Find your computer's local IP address (e.g., `192.168.1.100`).
2. Run the development server, exposing it to your local network:
   ```bash
   npm run dev -- --host
   ```
3. On Device 1 (Computer), open the local IP address (e.g., `http://192.168.1.100:5173`) and **Create** the game.
4. On Device 2 (Phone or another computer connected to the same Wi-Fi), open the same URL.
5. You can open multiple tabs on both devices to reach the required 5 players (e.g., 3 tabs on Device 1, 2 tabs on Device 2).
6. Join the room using the Room Code and start the game from the Host tab.

*Note: WebRTC might require a secure context (HTTPS) for certain features on mobile devices depending on the browser, but it usually works over `localhost` or local IPs for development.*
