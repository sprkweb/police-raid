# PandSBot

TypeScript port of **PandSBot** by **Pavel Raliuk and Alex Paklonski**, from
**THE RESISTANCE Competition, Vienna Game/AI Conference 2012**. Shown in the
lobby as **Old school / Старая школа**.

## License

The original and ported algorithm are licensed under **GNU GPL version 3.0**;
no permission for later versions is inferred. The [original source](reference/pands.py)
is unchanged, and the full license is in [LICENSE.GPL-3.0](LICENSE.GPL-3.0).
The surrounding project remains AGPL-3.0-or-later; GPLv3 section 13 permits
this combination. Attribution and license headers survive production minification.

Modified **2026-10-31**: ported to TypeScript and adapted to Police Raid's
rules, variable mole counts, and sabotage thresholds.

## Design decisions

- Preserve the original strategy. Its coefficients,
  decision precedence, and heuristic quirks remain, including estimates outside
  `[0, 1]` and the effect of zero-score suspect groups on voting.
- Generalise suspect pairs to groups of the public mole count. Average mutual
  friendship over all pairs within a group, multiply individual suspicion and
  support estimates, and average action signals. This recovers the original
  formula for two suspects without introducing a new probabilistic model.
- Separate sabotage evidence from raid failure: every sabotage contributes to
  suspicion, but support for a failed raid is judged against its actual threshold.
- Keep learning private to one seat and match, with a fixed roster and append-only
  history. Replay each event once using its historical round's rules. Police may
  use the public mole count, but never secret mole identities.
- Leave player-count support to the engine's rules (currently 5–8). The algorithm
  has no fixed mole count or sabotage threshold, but enumerating all suspect
  groups grows combinatorially. Playing strength on larger rosters is unverified.

Stable seat order and the engine's RNG replace Python set iteration and sampling;
matching seeds or random draw counts across languages is not a goal.

## Verification

Tests compare the active accumulators and inferred pair against a trace
generated from the original Python bot, and cover the generalised formula,
decision precedence, historical replay, information boundaries, and full
matches/rematches for all supported player counts.

Vitest needs no Python runtime. To regenerate the checked-in reference trace:

```sh
python3 src/engine/bots/pands/__tests__/generate-reference.py
npx oxfmt src/engine/bots/pands/__tests__/reference.json
```

The generator patches only the Python-2 tuple comparison in memory, provides
a minimal `player.Bot` shim, and fixes random choices. The archived source
is unchanged.
