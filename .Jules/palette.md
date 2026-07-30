## 2024-07-30
- Added Game Rules display directly to the main Lobby screen (`Lobby.tsx`).
- Migrated hardcoded `doc/RULES.md` into localizations (`en.yml`, `ru.yml`) so that game rules can dynamically swap languages along with the rest of the application.
- Utilized standard semantic headings (`h2`, `h3`, `h4`) and list elements (`ul`, `li`) for the new rules component in `Lobby.tsx` to maintain accessibility for screen reader parsing.
- Maintained existing styling approach by re-using the `bg-white p-6 rounded shadow-lg` wrapper container from Tailwind to create visual consistency across UI blocks.
