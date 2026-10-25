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
npm run dev        # http://localhost:5173/
npm test           # Vitest unit tests (game engine / rules / bots)
npm run lint
npm run fmt        # format with oxfmt
npm run fmt:check  # CI-style check, no writes
npm run build
```

## License

Copyright &copy; 2026 Vadim Saprykin

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see https://www.gnu.org/licenses/.
