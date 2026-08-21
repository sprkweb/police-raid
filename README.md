# Police Raid

A web-based multiplayer social deduction game.

## Rules

Game rules live in their own files and are also shown in-game from the briefing button:

- [English](RULES.en.md)
- [Русский](RULES.ru.md)

## Development

```bash
cp .env.example .env   # fill environment variables
npm install
npm run dev      # http://localhost:5173/
npm test         # Vitest unit tests (game engine / rules)
npm run lint
npm run build
```
