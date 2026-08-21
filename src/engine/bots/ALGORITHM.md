# Bayesian bot algorithm

This is the spec for the default `BotBrain` (`createBotBrain('bayesian')`). Identifiers match the TypeScript symbols in this folder. The older selfish policy lives in `heuristicBrain.ts` and is still selectable for benchmarks.

## Why worlds, not per-player suspicion

Mole roles are a *set*. If two moles must exist, “A is 50% a mole” and “B is 50% a mole” are not independent. After a two-person raid returns two sabotages, the only consistent hypothesis is that those two seats *are* the mole pair; everyone else is cleared. Independent counters cannot say that. The bot therefore stores a discrete distribution over **worlds**.

A world is one possible mole set of size `moleCount`. The observer always treats themselves as police, so worlds are the `moleCount`-subsets of the other `N − 1` seats (`enumerateWorlds`). For 5 players / 2 moles that is C(4,2) = 6 worlds; for 8 players / 3 moles, C(7,3) = 35.

`WorldBelief.probability` is `P(W)`. Uniform prior at match start.

## What the bot does not see

Bots run on the host, but the Bayesian policy is written as if it only had **public** information plus the observer’s own seat:

- It never uses other players’ hidden raid cards.
- Police do not see anyone else’s role.
- Moles know the true mole set **only** when choosing a raid action (`trueMoleIds`). Propose and vote still use the police world space (camouflage).

`GameEngine` keeps a private `observationLog` (`BotObservation[]`) because projected `GameState` drops rejected proposals and mid-round votes. That log is not sent to clients.

## Theory of mind (level-1)

Two layers, so reasoning does not recurse:

| Layer | Function | Evidence |
| --- | --- | --- |
| Level-0 | `beliefsFromRaids` | Raid results only (`k` sabotage cards). |
| Level-1 | `level1BeliefsFromHistory` | Level-0, then proposals and votes scored against a **nested level-0 brain**. |

When player `V` acts, we ask: what would a cop (or a mole in world `W`) sitting in `V`’s seat do, using **only** `beliefsFromRaids` from `V`’s point of view and history *strictly before* that action (`nestedCopProposeTeams`, `nestedCopVote`, `nestedMoleProposeTeams`, `nestedMoleVote`)?

The nested brain does **not** run level-1 on anyone else. That would be level-2+.

Our own propose/vote use `cleanProbability` on the **level-1** posterior. Nested actors use `cleanProbability` on **their** level-0 posterior.

## `cleanProbability`

```
P_clean(T) = Σ P(W) over worlds with T ∩ W = ∅
```

Implemented as `cleanProbability(beliefs, team)`. Values at or below `CLEAN_ZERO_EPS` count as zero.

## Raid observation (hard)

After team `T` returns `k` sabotages, each world with `m = |T ∩ W|` moles on the team gets likelihood `raidLikelihood(m, k)`:

- `k > m` → 0 (impossible)
- otherwise binomial: `C(m,k) * SABOTAGE_PRIOR^k * (1 − SABOTAGE_PRIOR)^{m−k}`

`SABOTAGE_PRIOR` (`α = 0.85`) is **only** this observation model. It allows a successful raid (`k = 0`) to leave mass on worlds that still had moles on the team (`(1 − α)^m`), instead of treating a clean raid as proof of a clean team.

Then beliefs are renormalized (`normalizeBeliefs`). If every weight is 0, fall back to uniform.

## Nested action policies (level-0 actor)

Same rules we use ourselves, but on that actor’s raid-only `P_clean`.

### Cop propose — `nestedCopProposeTeams`

All teams of the observed size that include `V`. Pick the argmax of `P_clean`. Ties stay as a set (likelihood matches any member).

### Cop vote — `nestedCopVote`

1. Hammer: `consecutiveRejections >= N − 1` → `Approve` (one more reject would hit the mole rejection-limit win).
2. `V` is on the team → `Approve` unless `P_clean == 0`.
3. `V` is off the team → `Approve` only if `P_clean >= CLEAN_VOTE_THRESHOLD` (0.75).

### Mole propose — `nestedMoleProposeTeams`

Argmax `P_clean` among teams that include `V` **and** intersect `W`. Because the proposer always includes themselves and a mole-in-`W` is `V`, infiltration is usually automatic; propose signals are weak. Votes do the work.

### Mole vote — `nestedMoleVote`

`Approve` if `T ∩ W ≠ ∅`, else `Reject`. Nested moles do **not** auto-approve on hammer: a clean team on the last reject is a mole win.

## Soft likelihoods (level-1 update)

Constants: `COP_ACTION_MATCH = 0.95`, `COP_ACTION_MISMATCH = 0.05`, `MOLE_ACTION_MATCH = 0.85`, `MOLE_ACTION_MISMATCH = 0.15`.

For each world `W` after a proposal of `T` by `A`, or after each vote `Vote_V`:

- If `A`/`V` ∉ `W` (cop in this world): match nested cop policy → 0.95, else 0.05.
- If `A`/`V` ∈ `W` (mole): match nested mole policy → 0.85, else 0.15.

Votes multiply across every voter, then normalize.

## Our decisions (level-1)

Moles **camouflage**: propose and vote with the cop policy on *our* level-1 `P_clean`, including hammer `Approve`.

- **Propose** (`chooseProposedTeam`): argmax `P_clean` among teams of the required size that include self. Ties broken with `pickTiedTeam` / `random`.
- **Vote** (`chooseTeamVote`): `nestedCopVote` on the level-1 posterior.
- **Raid, police**: always `Support`.
- **Raid, mole**: `Sabotage` iff this seat is in `designateSaboteurs`, else `Support`.

## Sabotage convention — `designateSaboteurs`

Among moles **on this raid**, assign `need = min(requiredSabotages, m)` sabotages:

1. Moles on this raid who already sabotaged, in order of first fail (`priorSaboteurs`).
2. If none of those moles have a prior fail: the **proposer**, if they are a mole on the team.
3. Else the mole closest to the first seat (`seatingOrder` index 0).

On 7–8 player round 4, `requiredSabotages == 2`, so the first two names in that list both sabotage. Otherwise a single fail would still succeed the raid.

`priorSaboteursFromHistory` does **not** peek at hidden cards. It replays each past raid with the same convention; if public `k > 0`, the first `k` designated moles are marked. That is the table’s shared legend of “who already failed,” including for a third mole who was not on that raid.

## Worked examples (5 players, observer `C`, moles among `A,B,D,E`)

**Two sabotages on `[A,B]`.** Every world except `{A,B}` has `m < 2` → likelihood 0. `P({A,B}) = 1`. The unique size-3 team with `C` and `P_clean = 1` is `{C,D,E}`.

**One sabotage on `[A,B]`.** `{D,E}` has `m = 0` → 0. `{A,B}` stays with binomial weight `2 α (1−α)`, not zero. Mixed pairs (`{A,D}`, …) stay with weight `α`. `{C,A,B}` and `{C,D,E}` are both poor; mixed triples like `{C,A,D}` are cleaner.

**Zero sabotages.** Worlds with moles on the team shrink by `(1−α)^m` but are not deleted. `{D,E}` (nobody from the raid) becomes the mode.

## Files

| File | Role |
| --- | --- |
| `types.ts` | `BotBrain`, contexts, `BotObservation` |
| `heuristicBrain.ts` | Original selfish bots |
| `bayesianBelief.ts` | Worlds, ToM updates, nested policies |
| `designateSaboteurs.ts` | Fail convention |
| `bayesianBrain.ts` | Default `BotBrain` |
| `createBotBrain.ts` | `'bayesian' \| 'heuristic'` factory |
| `simulateAllBotMatches.ts` | All-bot match driver / winrate helper |

Run `npm run bench:bots` to compare implementations (not part of CI).
