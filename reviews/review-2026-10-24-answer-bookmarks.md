# Review — 2026-10-24 — v12.14 Claude answer bookmarks (the answer-bookmark PR)

- **Branch:** `fix/claude-answer-bookmarks` → `main` (`b96ec7b`) | **PR:** the answer-bookmark PR
- **Diff:** the userscript (the row-scoped answer finder, `ciAnswerMap`, the answer label, the proof pass, the
  twin and recycled-node rules, the one-refresh request, the jump, the status line), the virtualizing mock's October
  knobs, `probes/check-answer-bookmarks.js` (A1–A36), `probes/run-answer-mutants.js` (M1–M18), the seeds fixture, CI
  and `test:probes` wiring, and docs (DEC-051, TROUBLESHOOTING, ROADMAP 13/14, DOM-REFERENCE, HANDOFF §E, README).
- **Tiers run:** all three (adaptive: 870+ lines, three new files), plus an adversarial workflow alongside Tier 3.

| Tier | Reviewer bound | Model that ran |
|---|---|---|
| 1 — structural | `session` (shipped default) | Claude Opus 5.5, this session |
| 2 — deep logic | `session` (shipped default) | Claude Opus 5.5, this session |
| 3 — independent | `cli:codex` (owner's config) | Codex CLI, the model in the owner's `~/.codex/config.toml` |
| extra — adversarial | a workflow: 4 finder lenses, one skeptic per lens | Claude Opus 5.5 subagents, 8 agents |

## Tier 1 — PASS

Every new function has its callers; the four i18n keys have an English and a Korean string and one call site each
(the dead-key audit shows only the documented 13); the changed signatures (`inject`'s known id and row, the harvest's
`sweep` uuids) match their callers; ES5 only; no `data-acn-*` attribute removed. `ciMessageNodeWithin` and
`_ciAssistantStale` are byte-identical to `main`.

## Tier 2 — PASS, one doc correction

The staleness check still runs on every scan with the same short-circuit; the bookmark's refetch only joins its
refetch block. The proof pass cannot loop through Safari's watcher. One gap, fixed in DEC-051: the unchanged
provisional migrator still binds an answer whose full text equals one payload entry (no activity line), so "binds only
on proof" was too strong; recorded as a residual.

## Adversarial workflow — 18 findings, 15 confirmed real

Fixed: a question row past the snapshot used as evidence (a repeated prompt matched the OLD entry; reproduced with the
real functions in node); a flag left dark after a bind under the same uuid; a duplicate removal preferring an
inference-bound record; a stale refresh request across a conversation switch; a bound record off the path getting
"scroll toward it"; "Answer (no question)" sorted first in the export; the panel ✕ darkening a twin's flag after its
full redraw; the mutant runner not running the unmutated build; flagless "stable" reads and unchecked clicks in the
probe; no fixture with a wrong stop_reason predicate (R2 now has one, A28, M12); two precondition gaps. Recorded as
residuals (DEC-051): an edit before the resync, a mid-stream bookmark before 200 characters, a refresh spent on a load
in flight, "Answer (no question)" not reached by any fixture. One refuted (A16's precondition: X shares W1's row).

## Tier 3 — rounds

| Round | Findings | Verified real | Disposition | Tokens |
|---|---|---|---|---|
| 1 | 6 WARN, 2 NOTE | 8 | all fixed: row-less records matched unplaced flags; the duplicate decided on the page's copy (now inside the store update); the proof gate blind to the store; the mark without the row; the runner on unknown ids; the duplicate branch ungated (A27, M11); the status line's `schema === 2`; temp dirs | 222,657 |
| 2 | 1 CRITICAL, 2 WARN, 1 NOTE | 4 | all fixed: a click acting for a recycled node's old answer (click-time identity check; R6, A29–A32, M13–M15); runner cleanup | 217,351 |
| 3 | 3 WARN, 2 NOTE | 5 | all fixed: the runner's baseline source and `-j`; `ciInvalidate` clears the refresh request and the memo; DEC-051 wording | 213,549 |
| 4 | 5 WARN, 3 NOTE | 7 | 7 fixed (the proof key includes answer texts; a failed bind retried; A33, seed L, M16, M17; runner arguments); 1 false positive (`acnGetValue` returns the bookmark string on both paths) | 195,823 |
| 5 | 4 WARN, 1 NOTE | 5 | fixed: no permanent disable on an error; the runner honours `ACN_SCRIPT`; A24 asserts the log line (M18); the mock's `totalTurns`; the Safari write-failure wording | 190,328 |
| 6 | 2 WARN, 1 NOTE | 3 | fixed: R2 mounts every answer row; labels in Korean (A35), before the index (A34), in the export (A36); the docs' mutant count | 216,755 |
| 7 | **APPROVED**, 2 NOTE | 2 | fixed: `--only` rejects unknown runs; DEC-051's Safari wording | 176,398 |
| post-fix 1 | 3 WARN | 3 | fixed: `ciInvalidate` clears the proof gate's copy; a removed bookmark cancels its refresh; a jump refuses a non-rendering target and a landing that is not an answer | 228,226 |
| 8 | **APPROVED**, no notes | — | — | 151,786 |
| post-fix 2 | 1 WARN | 1 | fixed: a jump now refuses a target that is not an answer (an old record bound by text to a question) before scrolling. The review was at its 10-round cap, so this last one-condition fix is gated (the full probe passes, the mutant battery reruns) but was not re-reviewed by Codex | 168,875 |

**After the review, a probe-only fix (Tiers 1 and 2, this session):** the final local run failed A36 on WebKit
only. The probe read the bookmark export through the download link, which WebKit handles differently, and got no
file. It now reads the Blob the export builds; the wrapper restores the original constructor, finishes once, and has a
timeout path. No userscript change; A36 passes on all three engines and still fails on v12.13.

## Totals

- Tier 3: 39 raw findings over 8 rounds and two post-fix passes (1 CRITICAL, 26 WARN, 12 NOTE); 38 verified real,
  1 false positive; every real one fixed, or recorded as a residual in DEC-051. Tokens: 1,981,748 over the ten passes
  (Codex CLI's own reporting).
- Adversarial workflow: 18 findings, 15 confirmed, all acted on.
- Gates: `check-answer-bookmarks` A1–A36. v12.13 fails A2–A5, A9–A21, A24 and A27–A36; A1, A6–A8, A22, A23 and A26 are
  guards; A25 is a control. 18 targeted mutants, each caught by its named check after the unmutated build passes
  every check.
- **GitHub Codex rounds needed afterwards:** to be recorded after the PR's review.

## Measurement context

Every gate result is Playwright's page realm, headless, this Mac, the virtualizing mock with the October markup, GM
storage and the conversation request stubbed; Claude's real markup was measured in Chrome's page realm on the owner's
profile (DOM-REFERENCE, October 2026). Real-browser acceptance of v12.14: DEC-031.
