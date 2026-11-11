# Review — 2026-11-11 — the CI rebuild, stage 1 (parallel probe jobs, the container, docs-only, ci-ok)

- **Branch:** `ci/rebuild-parallel-probes`; base `main` (`b0fee35`).
- **Reviewed commits:** `68b9d19` (Playwright 1.65.0 pinned), `3e74e00` (`--part`), `b339623` (the workflow and
  its two scripts); review fixes `931ce64`, `77f7fee`; `3e43e53` (the probe README line, docs only).
- **Diff (code, without the handoff docs commit `8f998c0`):** 7 files, +443 / −232: `.github/workflows/
  cross-platform-tests.yml`, `.github/scripts/docs-only.sh` (new), `.github/scripts/probe-lanes.sh` (new),
  `probes/check-gemini-index.js`, `package.json`, `package-lock.json`, `probes/README.md`. The userscript is
  unchanged.
- **Tiers run:** all three (over 50 lines, new files). Triggered by the Stop hook, 2026-11-11 ~01:40Z.
- **Reviewers:** Tier 1 `session`, Tier 2 `session` (Claude Opus 5.5, this session); Tier 3 `cli:codex` (the
  owner's config; `codex-cli 0.162.1`, model `gpt-5.6-terra` at reasoning effort `xhigh` from
  `~/.codex/config.toml`), read-only sandbox, 5 lenses per round.

## Tier 1 — structural (session)

| File | Result |
|---|---|
| `cross-platform-tests.yml` | **CRITICAL (pending work):** `package.json` still read `^1.40.0`, so `npm ci` would have installed the lockfile's 1.58.2 under an image that ships 1.65.0's browsers: every container job would fail to launch. Fixed by `68b9d19` before Tier 3. **WARN:** the `Versions` step's `node -e "…'…'…"` ran under PowerShell on Windows, whose argument quoting is fragile: `shell: bash` on that step (fixed). |
| `probe-lanes.sh` | PASS: all 18 probe files exist; the lanes hold the 15 per-engine probes and the 3 string probes, the old 17 steps' set. |
| `docs-only.sh` | PASS. |
| `check-gemini-index.js` | PASS. NOTE: `--only X --part N` with X in the other part runs nothing and passes with E only; CI never combines them (not fixed). |

## Tier 2 — logic (session)

No CRITICAL or WARN beyond Tier 1's. Checked: `ci-ok` red when `changes` fails (its output empty, the jobs skip),
on any cancelled, failed or non-docs-only skipped job; values reach the gate script through `env:`; both shas exist
with `fetch-depth: 0` on same-repo and fork PRs; a probe killed mid-lane leaves a row missing, caught by "N of M
reported". NOTE: the image tag is mutable (a digest pin is possible; not done).

## Tier 3 — cli:codex

| Round | Scope | Verdict | Raw findings | Verified | Tokens |
|---|---|---|---|---|---|
| 1 | the whole change | REVISE | 2 CRITICAL | 2 | 284,277 |
| 2 | the whole change, after `931ce64` | REVISE | 1 CRITICAL, 3 WARN | 2 fixed; 1 CRITICAL true but out of reach; 1 WARN by design | 217,240 |
| 3 | the whole change, after `77f7fee` | APPROVED | 0 | — | 179,702 |
| 4 | post-fix validation of `931ce64`, `77f7fee` | APPROVED | 0 | — | 123,584 |

**Round 1 (both fixed in `931ce64`):**
1. CRITICAL, verified: on `pull_request` the checkout is the PR's merge commit, so a PR's edit to `docs-only.sh`
   could decide to skip its own tests. Fix: the detector runs from the base branch (`git show $BASE:…`); a base
   without it runs everything.
2. CRITICAL, verified as a reported platform behaviour (not reproduced here): GitHub community discussion 211624
   (a user, 2026-10-30, three runs, labelled Bug, no staff reply) says a matrix leg cancelled before any runner
   picked it up leaves `needs.<job>.result` at `success`; this repo had such cancels on macOS on 2026-11-05. Fix:
   `ci-ok` also reads the run's jobs through the API and requires each of 19 jobs by name.

**Round 2:**
1. CRITICAL, true, **not fixed (out of reach):** a PR can edit the workflow so `ci-ok` passes. True of every
   `pull_request` workflow, the nine checks this replaces included; any in-repo guard is editable by the same PR.
   Recorded as a known limitation: a workflow diff is read before the owner merges.
2. WARN, fixed in `77f7fee`: `jobs?filter=latest` may list only the re-run jobs after `gh run rerun --failed`,
   which would fail every partial re-run. Now `filter=all`, each name's newest attempt (numeric), counted.
3. WARN, fixed in `77f7fee`: `BOTH_PARTS` was not validated (a fixture's id there would run in both halves).
4. WARN, **not changed (by design):** `if: always()` keeps `ci-ok` running ~10–40 s on a superseded run. A job its
   own `if:` skips counts as passing a required check, so without `always()` a cancelled run would satisfy `ci-ok`.

## Verification beyond the review [each with its context]

- **`--part` gate** [this Mac, chromium, Playwright 1.65.0, headless, the three side by side, 2026-11-11
  02:05–02:18Z]: part 1 54 checks (378.4 s), part 2 29 (392.1 s), whole 81 (765.9 s), all PASS; the parts'
  union = the whole run's ids = CI's 81 (run 42437401493); only R1 and E twice. Guard mutants M1–M5 (an id in
  neither part, in both, a bogus id, a fixture id in `BOTH_PARTS`, an unknown id there) each INVALID, exit 1.
- **`docs-only.sh`** [this Mac, git 2.27]: the real handoff commit `b0fee35...8f998c0` (8 docs files) true; PR #94's
  diff false; push, dispatch, no shas, a bad sha, an empty diff false; 18 edge cases in a scratch repo (renames
  either way, deletions, mixed, `.MD`, spaces, `foo.md.js`, `probes/docs/`, `docs/*.html`, mode changes, a revert,
  a base that moved on) as the rule says.
- **`ci-ok`'s script** [extracted from the workflow, a stub `gh`, bash 3.2]: 10 cases after round 1 and 9 re-run
  cases after round 2, each as intended (listed in `931ce64` and `77f7fee`).
- **actionlint 1.7.12**: no findings (its shellcheck pass not run; shellcheck is not installed).
- **CI** [GitHub Actions; mock evidence, never browser evidence]: dispatch run 42946394211 on `3e43e53`: 20/20
  jobs green, 9.23 min first start to last end; every probe x engine's PASS count equal to the baseline.

## Totals

Issues found 9 (Tier 1: 1 CRITICAL pending work, 1 WARN; Tier 3: 3 CRITICAL, 3 WARN, 0 NOTE raised by Codex),
verified 8, fixed 6, not fixed 2 (one out of reach, one by design), false positives 0. Tier 1–2 NOTEs: 2, not
fixed.

**Tier 3 rounds used: 4 of 5.** GitHub Codex rounds afterwards: to be recorded when the PR's babysit cycle ends.
