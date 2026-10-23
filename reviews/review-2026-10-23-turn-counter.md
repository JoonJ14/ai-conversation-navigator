# Review — 2026-10-23 — v12.11 the turn-counter dots (PR A)

- **Branch:** `fix/turn-counter-dots` → `main` | **PR:** #81 | **First head reviewed:** `0241545` | **Final:** `bb9d0d9`
- **Diff (final):** 562 insertions, 28 deletions across 11 files: the userscript, a new probe, `package.json`,
  CI, docs. Also reviewed: the untracked `probes/safari-gm-storage-check.user.js` (PR B's B0, owner-run).
- **Tiers run:** all three (adaptive: 50+ lines, new files). Triggered by the Stop hook.
- **Plus an adversarial workflow** (ultracode): four lenses, each followed by a skeptic.

| Tier | Reviewer bound | Model that ran |
|---|---|---|
| 1 — structural | `session` (shipped default) | Claude Opus 5.5, this session |
| 2 — deep logic | `session` (shipped default) | Claude Opus 5.5, this session |
| 3 — independent | `cli:codex` (owner's config) | `gpt-5.6-terra`, reasoning effort xhigh (Codex CLI 0.162.1) |
| Supplementary | Workflow `review-pr-a-turn-counter` | Claude Opus 5.5 subagents: 4 lens reviewers + 4 skeptics |

## Tier 1 — PASS

- The new module-scope var and the hoisted function declaration are wired in.
- ES5 only; no `data-acn-*` attribute was touched.
- The probe is in `npm run test:probes` and CI.
- The version bump covers `@version`, `ACN_VERSION` and the README badge.
- B0's header has exactly the spec's four grants.

## Tier 2 — PASS (NOTEs only)

- NOTE: `orbUpdateContextBar()` records the drawn counter before drawing, so a throw mid-draw would leave the
  dots stale until the counter changes. That is the same as before for a throw; not changed.
- NOTE (B0), fixed:
  - a sync call when the function is undefined reported a ReferenceError as "THROW";
  - `decodeURIComponent` on a malformed cookie was unguarded;
  - `fetch.name` replaces a flag that may not be shared across scripts.

## Tier 3 — rounds

| Round | Findings | Verified real | Fixed | Tokens |
|---|---|---|---|---|
| 1 | 4 WARN | 4 | 4 (`826b17d` + B0) | 193,952 |
| 2 | 0 | — | — | 138,798 |
| post-fix | 0 (`826b17d`, `6f90d5a`, B0) | — | — | 152,214 |

Round 1's findings:
- A1/A2 could not gate "the counter is updated before drawing". The next scan's guarded redraw hid a stale first
  draw about 500 ms later. Fixed by A1f/A2f, which read the dots at the first draw.
- The empty-list redraw was ungated. Fixed by A5, with a first-draw read.
- B0: the two sync GM calls shared one `try`. Each now has its own.
- B0: reading `GM_info` was unguarded. It is now wrapped.

**Verdict: APPROVED + POST-FIX VALIDATED.** The Codex sandbox (read-only) could not start Playwright, so every
fix was measured locally with `probes/check-turn-counter.js`.

## Supplementary adversarial workflow — 25 raw findings, 19 confirmed, 5 refuted, 1 uncertain

All four lenses rediscovered Codex round 1's main finding (the gate could not tell the fix's parts apart), already
fixed in `826b17d`. Fixed in `6f90d5a` and `bb9d0d9`:

| Finding (lens) | Disposition |
|---|---|
| The guarded unchanged-list redraw **is** reachable, through an SSE draw (regressions; measured with an instrumented build) | the code comment and docs corrected; my "unreachable" claim was wrong and is recorded as corrected in TROUBLESHOOTING |
| The guard's comment named a cause that no longer happens (correctness, docs, probe) | comment rewritten |
| Docs did not say what is ungated (docs, probe) | TROUBLESHOOTING and the probes README now name it |
| "Known limit" missed the bar's not-ready inputs, which have no redraw (docs; measured: 15% held, 40% on a forced redraw) | added to TROUBLESHOOTING |
| The CHANGELOG called the empty return conditional | corrected |
| The CI step's "pure string behaviour" comment did not fit this probe (docs, probe, regressions) | its own per-engine ubuntu step, webkit included |
| `agent_docs/testing.md` CI list | updated |
| A2b never asserted the panel closed (probe); its skeptic showed A2b DOES gate a close that loses the dots | close asserted; comment corrected |
| A2's comment on the `aria-setsize` fallback | comment corrected per the skeptic |
| **Logged, not fixed:** a stale "Turn N" badge on non-Claude empty pages (Path C's unchanged empty branch) | TROUBLESHOOTING, the owner's call |
| **Logged, not fixed:** writer-less compaction state; `package.json` version 11.0 | ROADMAP item 10 |

- **Refuted:** the ChatGPT/Perplexity sentence (true by code; reworded as inferred anyway), the "Drawn" bullet,
  the "744 times" wording, A4's open-state read, and the A2 page "contradiction". The harmless clarifications
  were kept.
- **Uncertain:** "PR #81" written before the PR exists. It is the next number on GitHub's shared counter; I
  check it when the PR opens.

## Gate after review: `probes/check-turn-counter.js`, 8 checks

Playwright page realm, headless with `visibilityState` visible, this Mac.

| Build | Result |
|---|---|
| v12.10 | fails A1, A1f, A2, A2f, A2b, A5 (3 stale dots); A3, A4 pass |
| v12.11 | 8/8 |
| Counter update moved back after the draws | fails A1f, A2f |
| Empty-list redraw removed | fails A5 |
| Unconditional unchanged-list redraw | fails A4 (984 records) |
| Guarded unchanged-list redraw removed | passes 8/8: not gated, because only an SSE draw reaches it (documented) |

## Totals

- **Tier 3:** 4 raised, 4 verified, 4 fixed.
- **Workflow:** 25 raw, with many duplicates across lenses. 19 confirmed, 5 refuted, 1 uncertain (the PR number).
  After deduplication there are **12 distinct confirmed issues**: 10 fixed or corrected (one of them is Tier 3's
  round-1 finding again), and 2 logged for the owner (the badge; the `package.json` version).
- The compaction state with no writer came from the reviewers' clean-check notes, and is logged too.
- **Tier 2:** 3 NOTEs on B0, all fixed. 1 NOTE on the userscript, accepted.

**GitHub rounds needed afterwards:** 0. GitHub Codex reviewed `39e35c5` clean on its first review ("Code Review
✅ Completed", no findings, 0 inline comments). The later commit is docs only: the owner's acceptance in DEC-031,
two lessons in `agent_docs/conventions.md`, this line.
