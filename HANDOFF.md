# Session Handoff — 2026-07-27 (v12.0 close-out)

**Scope:** v12.0 jump-to-message completion (resolve-on-arrival), Windows CI repair, live
confirmation, and a 23-round GitHub Codex review cycle. **Prior handoff:** none (first).
**Branch:** `feat/v12.0-conversation-index`, PR #58, ~30 commits ahead of main, pushed.
**Next-session priority: NOTHING except the owner's final live test → merge.** The branch
is FROZEN by owner decision.

## A. State in one paragraph
v12.0 fixes the first Layer 4 "state break": Claude virtualized its message list (~3 of
147 turns mounted), silently breaking Navigate/Search/Export/Summary/context. The fix is
an API-backed conversation index (DEC-021) plus jump-to-message via **resolve-on-arrival**
(DEC-027): aim with a predicate seed, land, resolve against the ~7 mounted rows by the
target's own text (one matcher shared by settle loop and fast path). Proof chain:
`0a30d3b` fails 39/222 acceptance jumps, `1200a4b` fails 24, `5f2a8be` passes **222/222**
(avg ~330ms) — live-confirmed on Firefox on the 147-question conversation. A subsequent
23-round Codex cycle fixed 54 more findings (core-path through round 12, edge-session
after). Suite: 374/374 across 20 platform entries, Chromium + Firefox, every round.

## B. Accomplished (compressed — full reasoning lives in the named docs)
1. **Windows CI repair** — DEC-025 (assertions read backing data, not recycled DOM),
   DEC-026 (no `--single-process`), cold-start goto retry.
2. **Resolve-on-arrival** — DEC-027 records the design, the mock-first gate (fixtures the
   old build demonstrably fails), five convergence defects found by trace, and the proof
   chain. CHANGELOG "Resolve-on-arrival" section has the density-dependence analysis.
3. **Codex cycle** — 23 rounds / 54 findings, full ledger in PR #58 closing comment;
   per-round detail in the `fix: address Codex review — round N` commit messages.
   28-comment historical audit closed (23 fixed / 1 pre-fixed / 3 superseded / 1 scope).
4. **Probe D** (DOM-REFERENCE): no native scroll-to-index; offsetTop not in container
   coords; local-density Newton step reached row 0 in one move.

## C. Architecture snapshot
Single-file ES5 userscript. Claude path: `ci*` index (tree-walked active path,
`stopReason`/`textSource`/`toolChars` per entry) → renderable predicate (hypothesis;
measured anchors override) → jump = aim/land/arrive (3a target-text, 3b local pairs with
pigeonhole-exact adjacency, 3c bounded shift; bisection between straddling landings;
virtualizer's own density for stepping). Staleness: provisional-by-row-identity +
assistant/edit/suffix signatures under a two-scan guard; exponential backoff for
permanent failures (schema, malformed JSON, HTTP 401/403/429 across all five org paths);
idle-page timed rescans. DOM scan remains the visibly-degraded fallback and the path for
the other 13 platforms.

## D. Key principles established (also in CLAUDE.md / DECISIONS)
- Measurement context is part of the finding (incl. runner speed, launcher flags, and
  WHICH VERSION of our own script is in the measurement browser).
- An old build must FAIL a new fixture before it counts as a reproduction (DEC-027).
- The predicate is never treated as measured; anchors override; ambiguity poisons.
- A green suite is evidence about the mock — mutation-verify before trusting coverage.

## E. Git state
`feat/v12.0-conversation-index` @ `5dbd396`+ (see `git log`), pushed, PR #58 OPEN,
9/9 CI checks green at last full run. **Do not merge** — owner merges after live test,
version bump to v12.0 goes in the merge commit (already `@version 12.0` in-file).

## F. Files for next session
`DECISIONS.md` (DEC-021..027 + proof chain), `TROUBLESHOOTING.md` (v12.0 entries),
`TESTING.md` (fixture matrix, ACN_JUMP_TRACE, acceptance sweep), PR #58 closing comment
(Codex ledger + v12.1 residuals), `reviews/review-2026-07-27-17bda2d.md`.

**Post-freeze addendum (2026-07-27, owner-requested):** the live test found ONE failure —
Q#1 (the chip target) arrived but failed to resolve at the path head (no comparable text,
no pairs below to bracket). Fixed by by-construction extreme resolution for HUMAN targets
(first renderable human = row 0, last = final row), proven under a no-pairs mutant.
Branch re-frozen; Q#1 retest pending.

## G. What comes next (in order)
1. **Owner live test** on the frozen branch (reinstall from raw URL, tip commit):
   Q#1 (chip), Q#75, one target in 205–228, Q#140, Q#147, one short-duplicate.
   `localStorage.setItem('acnJumpDebug','1')` for traces if anything misbehaves.
2. **Merge PR #58** (owner; squash; version statement in merge commit).
3. v12.1 backlog (PR closing comment): Retry-After honoring; CI fixtures for the
   edge-session paths added in rounds 14–23; tool-block export representation.

## H. Operational context + owner rules
- **Merge authority is the owner's alone**, gated on the live test. Standing since Phase 3.
- Codex cycle closed at 23 rounds on diminishing returns + owner's token budget (~2%
  weekly noted); the GH-rounds metric (23) is recorded in the Tier-3 backend experiment
  log (`~/.claude/review-backends/active.conf`) with the caveat that the implementation
  moved between Tier 3 and the loop, so 23 is an upper bound for backend comparison.
- Owner workflow: specs and probe outputs arrive as pasted messages; live verification is
  owner-run on Firefox+Tampermonkey (the context CI cannot reach).

## I. Deferred (v12.1) — see PR #58 closing comment for the authoritative list
Retry-After plumbing; edge-session CI fixtures; §4.2 offset cache / §4.3 height learning
(agreed omission — "repeat jump near-instant" criterion unmet and flagged); Perplexity
gallery limitation (pre-existing, README).

## J. Risk caveats
- **Rounds 14–23 fixes have no dedicated CI fixtures** (logged-out orgs, multi-org races,
  mid-stream refetches are not cheaply reproducible in the harness). Suite-green +
  logic-reviewed only. If a regression appears in those paths, suspect them first.
- The renderable predicate rests on the `stop_reason` discriminator (n=2 conversations +
  a 14-conversation census). `ciValidatePredicate()` warns loudly on divergence; anchors
  keep correctness independent of it, cost is extra iterations.
- The mock's `overflow-anchor:none` mirrors an ASSUMED live property; live confirmation
  observed no teleporting, but it remains unverified directly.
