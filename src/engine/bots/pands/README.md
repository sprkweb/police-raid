# PandSBot

TypeScript port of **PandSBot** by **Pavel Raliuk and Alex Paklonski**, from
**THE RESISTANCE Competition, Vienna Game/AI Conference 2012**.

The original declares **GNU Public License (GPL) version 3.0**. Its original
attribution is preserved in the [unchanged Python source](reference/pands.py).
The ported algorithm remains under GNU GPL version 3.0; the full text is in
[LICENSE.GPL-3.0](LICENSE.GPL-3.0). No permission for later GPL versions is
inferred from the original notice. The surrounding project remains
AGPL-3.0-or-later; GPLv3 section 13 permits combination with AGPLv3 code.
The port's legal headers are also retained in the production JavaScript bundle.

## Use and lifecycle

`createPandSBrain(): BotBrain` creates one brain for one seat in one match.
The factory accepts `{ algorithm: 'pands' }`, including through the existing
host-only `GameEngineOptions.botConfigsBySeat`. There is no UI selection and
the default bot is unchanged.

The adapter maps `chooseProposedTeam`, `chooseTeamVote`, and `chooseRaidAction`
to the original `select`, `vote`, and `sabotage`. It lazily initialises the model
and replays only new events in the append-only `history` before each decision.
Proposals supply the leader, ballots supply the completed votes and attempt,
and raids advance the historical round. Historical sabotage thresholds come
from the engine's rules for that round, rather than the current decision.
The roster must stay fixed; use a new factory for a new match, as the engine does.

Police use only the **number** of entries in `moleIds`, which is public
information about the player count. Only the mole branches of `vote` and
`sabotage` inspect the identities. All randomness uses `ctx.random`.

## Changes to the original (2026-10-31)

- Arrays use the roster length `n`; the public mole count is `m`, and the
  initial friendship/support prior is `m / n` instead of `0.4`.
- `suspectsPair`, `_updateSuspectsPair`, and `_getBadPair` become
  `suspectsGroups`, `_updateSuspectsGroups`, and `_getBadGroup`. Groups contain
  `m` players; candidate groups containing the observer are still excluded.
- The group score retains the original coefficients. Let `P` be the product
  of individual suspicion, `F` the mean mutual friendship
  `friends[i][j] * friends[j][i]` over unordered pairs, `U` the product of
  support suspicion, and `A`/`G` the means of suspicious/good actions:

    ```text
    P >= 0.99: score = P
    otherwise: score = (0.50 + 0.50F) * (0.75 + 0.25U)
                       * P * (0.40 + 0.60A) * (1 - 0.10G)
    ```

    A singleton has `F = 1`. For pairs the formula is exactly the original.
    Selection retains the `uniform(0.9, 1.0)` score perturbation.

- The final ballot is attempt `n`, following Police Raid's rejection limit.
  The old three-person-team-without-me test becomes
  `teamSize - (n - m - 1) >= requiredSabotages`: even if all other police are
  on the team, it has enough moles to fail. The same generalisation is used
  when learning from outsiders' votes.
- Mole votes and innocent votes against the suspected group compare the
  number of relevant players on the team with `requiredSabotages`.
  Original precedence is retained: approve one's own proposal and the first
  attempt of round one before considering role-specific rules.
- Raid observations still use **every sabotage** as suspicion evidence and
  replace `maxSpies = 2` with `m`. Support suspicion uses the actual failure
  threshold: one sabotage on a two-sabotage raid is evidence, but not failure.
- A mole supports when too few moles are present to fail the raid; sabotages
  when exactly enough are present; with surplus moles, sabotages unless it is
  the leader, or always at a deciding score (`WINS_NEEDED - 1`). This preserves
  the original policy for five players without redesigning coordination.
- Python 2's tuple-versus-number comparison in `_getBadPair` is replaced by
  directly returning the selected group and its score. Zero-score groups
  still affect voting, just as in the original; only `_getGood` falls back to
  cyclic seat order when there is no positive score.
- `Variable`, `Probability`, `suspeciousActions` (original spelling), active
  update formulae, and the observer's exclusion from learning teams are
  preserved. Estimates are deliberately **not clamped or normalised**, even
  when the original heuristic yields a value outside `[0, 1]`.
- Unused imports, logging/debugging code, accumulator methods never used by
  the bot, and the unused extra `_getBadPair` call in `select` are omitted.
  Sampling uses the engine's Fisher–Yates utility; stable seat ordering
  replaces Python set iteration. Python and JavaScript seeds and random draw
  counts are not expected to reproduce the same match.

The engine still supports only its existing 5–8-player configurations. The
model and decision comparisons do not restrict mole counts to two/three or
thresholds to one/two. Future player counts need entries in the engine rules;
enumerating all `m`-subsets costs combinatorial time and storage. Playing
strength on larger rosters is not established by this port.

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
