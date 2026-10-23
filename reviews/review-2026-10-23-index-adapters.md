# Review — 2026-10-23 — v12.10 ChatGPT and Perplexity index adapters

- **Branch:** `feat/chatgpt-perplexity-index-adapters` → `main` | **PR:** #78 | **Head reviewed:** `878520e`
- **Diff:** ~1,600 lines across 17 files (userscript, a new probe, two new mocks, two converted mocks, CI, docs)
- **Tiers run:** all three (adaptive: 50+ lines, new files)

| Tier | Reviewer bound | Model that ran |
|---|---|---|
| 1 — structural | `session` (shipped default) | Claude Opus 5.5, this session |
| 2 — deep logic | `session` (shipped default) | Claude Opus 5.5, this session |
| 3 — independent | `cli:codex` (owner's config) | the Codex CLI's configured model |

## Tier 1 — PASS
Registration complete (seam in `scanConversation`, `orbRenderIndexBanner`, the Navigate and Search
fingerprints, `_relocateQuestionElement`, `orbScrollToQuestion`; probe in `npm run test:probes` and CI;
`@connect` and version in the header). ES5 and ASCII-only added code (checked per commit).

## Tier 2 — PASS (NOTEs only)
- NOTE: a refetch that *succeeds* before the server persisted a new question does not retry that signature
  (Claude's once-per-signature rule).
- NOTE: a `/search/<slug>` that is not a thread shows a degraded banner instead of nothing.

## Tier 3 — rounds

| Round | Findings | Verified real | Fixed | Logged (out of scope / accepted) |
|---|---|---|---|---|
| GitHub Codex (pre-pipeline) | 2 WARN | 2 | 2 (`363a538`) | — |
| 1 | 10 WARN | 10 | 6 (`58988d4`, + probe C3b) | 4 → ROADMAP 13 (bookmarks, export counts, Search and Summary order) |
| 2 | 7 WARN | 7 | 7 (`f85f99d`, + probe G2) | — |
| 3 | 1 WARN, 2 NOTE | 1 | 1 (`94166a8`) | 2 NOTEs (no busy state on adapter jumps; no gate on IX_JUMP_*) |
| post-fix 1 | 1 CRITICAL, 3 WARN | 4 | 4 (`5f6351b`) | — |
| post-fix 2 | 3 WARN | 3 | 3 (`878520e`) | — |
| post-fix 3 | 1 WARN | 1 | 0 | 1 accepted limit → ROADMAP 13 (markdown-only edits on Perplexity) |

**Verdict: APPROVED + POST-FIX VALIDATED by the severity policy** (the last round: one WARN, below the
blocking threshold, an inherent limit of matching raw markdown to rendered text, recorded in ROADMAP 13).
Totals: 31 findings raised, 31 verified real, 0 false positives, 23 fixed, 8 logged or accepted.

Context: the Codex CLI could not run Playwright in its read-only sandbox; every fix was verified locally with
`probes/check-index-adapters.js` (Playwright, page realm). New gate checks that FAIL on the pre-fix build:
C3b (a broken tree listed as complete). G2 covers a gmxhr refusal falling back to fetch.

**GitHub rounds needed afterwards: 2** (the babysit cycle on PR #78, after the pipeline): one finding, a switch
to a SHORTER ChatGPT branch left the abandoned follow-ups listed (fixed in `c9621cb`, probe C3c fails before it);
then clean on `c9621cb`. Before the pipeline, GitHub's first round found 2 (fixed in `363a538`).
