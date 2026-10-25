# Review — 2026-10-24 — v12.14 Claude answer bookmarks (the answer-bookmark PR)

- **Branch:** `fix/claude-answer-bookmarks` → `main` (`b96ec7b`) | **PR:** #86
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

The adversarial lenses and what each raised: identity 3, records 3, scan 5, gate 7 (18 findings, 16 confirmed). Its
cost: 1,213,160 subagent tokens, 243 tool uses and 1,472 s.

## How the gate was built, before review

- **The first mutant battery** (10 mutants, Chromium, `-j 4`) let M6 and M10 through.
  - **M6** (the twin bug back) could not fail A18 as first written. Seed T was made on answer 2 (row 3), which is
    mounted at load, so the proof pass bound T to answer 2's uuid before any twin comparison ran.
  - **The fix to the probe:** T was re-minted on answer 16 (row 30). A18 became the twin test:
    - answer 2's flag is not lit by T;
    - T's card does not jump to answer 2;
    - clicking answer 2's flag keeps T;
    - T binds to answer 16 when that row mounts.

    A MutationObserver now records each `acn-bm-flash` with its row, so a jump's target is still known after the node
    is recycled.
  - **M10** (the jump through `getAIMessages`) exposed a real userscript defect. An unbound record whose own row was
    off screen got the "could not be matched — delete it" toast, although it could still bind there. The fix is in
    `_bmJumpToAnswer` (DEC-051), and M10 was retargeted to A18.
  - After both fixes all 10 were caught. The lesson (owner-approved, agent_docs/conventions.md): a twin fixture must
    keep the record unbound while its twin is on screen, or proof binds it first and the twin rule is never tested.
- **A syntax trap:** a probe comment with backticks inside the page-helper template literal ended the template
  early (`SyntaxError: Unexpected identifier 'from'`). The comments now write FROM, TO, TEXT and CLICK in capitals.
- **A35's seed** encoded `acn-settings` one level too deep on both stubs, so the fixed build failed A35 with "Answer
  to Q#1". The sync stub now stores the object and the async stub its JSON text; v12.13 then reads "A#1".

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

## Adversarial workflow — 18 findings, 16 confirmed real

Fixed: a question row past the snapshot used as evidence (a repeated prompt matched the OLD entry; reproduced with the
real functions in node); a flag left dark after a bind under the same uuid; a duplicate removal preferring an
inference-bound record; a stale refresh request across a conversation switch; a bound record off the path getting
"scroll toward it"; "Answer (no question)" sorted first in the export; the panel ✕ darkening a twin's flag after its
full redraw; the mutant runner not running the unmutated build; flagless "stable" reads and unchecked clicks in the
probe; no fixture with a wrong stop_reason predicate (R2 now has one, A28, M12); two precondition gaps. Recorded as
residuals (DEC-051): an edit before the resync, a mid-stream bookmark before 200 characters, a refresh spent on a load
in flight, "Answer (no question)" not reached by any fixture. Two refuted: A16's precondition (X shares W1's row,
so A27 would fail if that row were not placed) and a refused landing not restoring the scroll (by design: the jump
restores only when it fails, and a refusal after landing says so with a toast).

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
| post-fix 2 | 1 WARN | 1 | fixed: a jump now refuses a target that is not an answer (an old record bound by text to a question) before scrolling. The review was at its 10-round cap, so Codex CLI did not re-review this last one-condition fix. GitHub Codex then reviewed all the code (`df28497`) with no findings. After it, the full probe passed and the mutant battery reran, but no check or mutant targets this refusal, nor post-fix 1's three fixes (DEC-051, Gates) | 168,875 |

**After the review, a probe-only fix (Tiers 1 and 2, this session):** the final local run failed A36 on WebKit
only ("headings null"). The probe read the bookmark export by intercepting the download link's click and fetching
its blob URL, and got no file. Which step failed was not found: the old capture recorded no reason. A36 had not run on
WebKit before, because the earlier WebKit pass predates A34–A36.

The probe now reads the Blob the export builds (`ecdfb45`). The wrapper restores the original constructor, finishes
once, and has a timeout path. No userscript changed. After the fix:
- WebKit reran the full probe (36/36), and Chromium and Firefox reran R1, the run that holds A36;
- v12.13 still fails A36, with `["A#2","A#3","A#3","Q#5"]`;
- the mutant battery's last run was on the probe from before the fix, which touches only A36's capture.

## The final mutant battery (Chromium, `dbf1925`): what each mutant fails

| Mutant | Expected | Failed |
|---|---|---|
| M1 answers through `getAIMessages` | A9, A10 | A28, A9, A10, A11, A12, A13 |
| M2 the label counts answers | A4 | A4, A36 |
| M3 no proof pass | A14, A15 | A14, A27, A15, A18, A33, A20 |
| M4 proof by hash on any row | A16 | A16, A18 |
| M5 proof by row alone | A16 | A16 |
| M6 the twin bug | A18 | A18 |
| M7 no refresh for a mid-stream answer | A24 | A24 |
| M8 the status line skips provisional records | A19 | A19 |
| M9 `ciMessageNodeWithin` reads answers | A6 | A6 |
| M10 the generic jump | A18 | A18 |
| M11 a second record bound | A27 | A27, A33 |
| M12 rows by the predicate alone | A28 | A28, A11, A12 |
| M13 the mark without its row | A30 | A30 |
| M14 no click-time identity check | A29, A31 | A29, A31 |
| M15 an unplaced flag matches a row-less record | A32 | A32 |
| M16 an inference-bound record counts as the original | A14 | A14, A20 |
| M17 the proof pass ignores the store | A33 | A33 |
| M18 the bookmark refetch logs "out of sync" | A24 | A24 |

The baseline (the unmutated build) passed every check first. No check or mutant targets these fixes: the
past-snapshot guard, post-fix 1's three and post-fix 2's one (DEC-051, Gates).

## Totals

- Tier 3: 39 raw findings over 8 rounds and two post-fix passes (1 CRITICAL, 26 WARN, 12 NOTE); 38 verified real,
  1 false positive; every real one fixed, or recorded as a residual in DEC-051. Tokens: 1,981,748 over the ten passes
  (Codex CLI's own reporting).
- Adversarial workflow: 18 findings, 16 confirmed (2 refuted), all acted on.
- Gates: `check-answer-bookmarks` A1–A36. v12.13 fails A2–A5, A9–A21, A24 and A27–A36; A1, A6–A8, A22, A23 and A26 are
  guards; A25 is a control. 18 targeted mutants, each caught by its named check after the unmutated build passes
  every check.
- **GitHub Codex rounds needed afterwards:** 2, with no findings. On opening (head `df28497`, which holds all the
  code), Codex reacted 👍. The `@codex review` the owner's rule asks for on a clean first pass came back on
  `8a42e80`: "Didn't find any major issues. Bravo." The owner later wrote "No babysit needed"; by then the babysit
  cycle had already run. **Total: 2
  GitHub Codex rounds, 0 findings** (PR #85 needed 3 rounds and had 1 finding).

## Measurement context

**Codex CLI never ran the probe.** Every Tier 3 round and both post-fix validations report that Playwright could not
launch in Codex's read-only sandbox. Only `node --check` and `git diff --check` ran there, so its verdicts, the
approvals included, are static reads. Every gate result was run locally.

**The gate's runtime** was measured on Chromium only: one full run took 127.5 s (`/usr/bin/time -p`). "About 2
minutes per engine" assumes the other engines take about the same.

**Accepted for Codex, now recorded:** from round 2 on, the Codex prompts listed two residuals as "accepted (in
DEC-051, do not report)" that DEC-051 did not hold until the docs audit: the label checks not telling Navigate's
numbering from a count of human entries, and A24 not detecting a skipped cooldown. Both are in DEC-051's Gates now.

Every gate result is Playwright's page realm, headless, this Mac, the virtualizing mock with the October markup, GM
storage and the conversation request stubbed; Claude's real markup was measured in Chrome's page realm on the owner's
profile (DOM-REFERENCE, October 2026). Real-browser acceptance of v12.14: DEC-031.
