# Session Handoff — 2026-07-27 (v12.0 close-out)

**Scope:** v12.0 jump-to-message completion (resolve-on-arrival), Windows CI repair, live
confirmation, and a 23-round GitHub Codex review cycle. **Prior handoff:** none (first).
**Branch:** `feat/v12.0-conversation-index`, PR #58, ~30 commits ahead of main, pushed.
**Next-session priority: owner merges PR #58** (live test PASSED incl. the Q#1 retest;
all Codex comments addressed). After merge: v12.1 backlog (PR #58 closing comment).

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

**Post-freeze addendum (2026-07-27, owner-requested, all LIVE-VERIFIED or suite-green):**
1. Q#1 chip failure at the path head → by-construction extreme resolution for HUMAN
   targets (first renderable human = row 0, last = final row). Proven under a no-pairs
   mutant; **Q#1 re-tested live and PASSED.**
2. Proactive cluster hardening: the SESSION ANCHOR STORE joins arrival resolution —
   equal-offset anchors either side of a target pin its row exactly at any distance,
   gated on the strict anchors-only inverse. Covers a mid-conversation chip flanked by
   unmatchable rows whenever the session has prior evidence; cold-start cluster remains
   honest-failure (localized-cluster fixture = v12.1 test debt).
3. Post-closure Codex comment sweep (no re-trigger, owner token budget): summary
   conversation-map segment clicks were silent no-ops on indexed chats (elements now
   bound by row identity; unmounted segments use the jump bridge); conversation switches
   now reset _sseTokenData and _ciLastAsstMismatch in ciInvalidate (cross-conversation
   context-estimate inflation and inherited staleness signatures).
**All 4 post-closure Codex comments addressed** (one was already fixed by #1).

**Second post-closure batch (2026-07-27, 3 P2 comments, no review re-trigger):** all on
index-consuming surfaces. (a) Summary map/inventory clicks trusted the element captured at
summary-generation time; under recycling that node can be detached OR still connected while
showing a different message — a wrong jump. Indexed chats now discard the cache and
re-resolve from the path index on every click, through `ciResolveMountedByPathIndex()`,
which was extracted from `_relocateQuestionElement` so both share ONE MATCHER. Items with
no path index (summary generated pre-index) refuse with a toast. (b) Off-screen code
inventory items were inert; a `pathIdx` distinct from the assistant-only `msgIndex` is now
threaded through (passing `msgIndex` would have jumped to an unrelated message). (c)
Index-backed exports dropped provisional turns while headed "complete conversation history
(API)"; they are now emitted, counted and labelled.
**Pre-merge local Tier 3 review (2026-07-27, owner-directed, opus backend, 5 lenses):**
found TWO pre-existing v12.0 CRITICALs on the ordinary load path that the 23-round GitHub
cycle missed — (a) unbounded synchronous recursion `scanConversation ↔ ciLoadIndex` on
every index load (RangeError storm; `done` fires synchronously on the in-flight branch
while `_ciConversationId` is still null), and (b) a success-driven refetch loop
re-downloading the full payload every ~15.5s forever on an idle page (a tool/artifact
answer mismatches by construction; the backoff classifies failures only, so it never
engages). Both fixed, both reproduced first per DEC-027.

**Both were invisible to CI because of one fixture default each** — a 5ms API latency
against a ~2.1s live payload, and fixture API text that always equals the DOM. Recorded as
**DEC-028: a fixture's defaults are part of the finding.** Both reproductions are now
permanent suite entries. The review also caught that the batch above had opened a new
wrong-jump (a stale index driving a real jump after a conversation switch), closed with
`ciIndexStamp()`.
Final state: **427/427 across 22 platform entries**, both engines. Branch ready for owner
merge pending the GitHub Codex cycle.

## G. What comes next — v12.1 plan (owner-agreed priority order, 2026-07-27)
1. **Fixture batch (test debt — protects the 23-round review investment).** Rounds 14-23
   + post-freeze fixes are suite-green but have NO dedicated fixtures. Build: (a)
   localized unmatchable-cluster fixture (proves anchor-store arrival resolution, today
   verified by construction only); (b) unmatchable-HEAD fixture (the live Q#1 chip shape);
   (c) assistant-TAIL fixture (ciTryExtreme last-row branch, zero coverage); (d) GM-shim
   failure fixtures (401/429/malformed-JSON -> backoff classes); (e) **summary-click after
   recycling** — generate a summary, scroll so the virtualizer recycles the bound rows,
   then click a map segment and an off-screen inventory item; the pre-fix build scrolls to
   the wrong turn (segment) and does nothing (inventory). Old-build-must-fail discipline
   applies (DEC-027 methodology); note which fixtures are ancestor-gated (a real failing
   commit exists) versus mutant-gated (weaker evidence) rather than listing them as equal.
2. **Small correctness:** Retry-After honoring for HTTP 429 (plumb response headers
   through ciRequestJSON); tool-block representation in Export (toolChars already counts
   toward context totals; exports show text only).
3. **Reassess, don't build: §4.2 offset cache / §4.3 height learning.** The unmet
   "repeat jump near-instant" criterion predates resolve-on-arrival (~330ms avg cold).
   Measure a repeat jump LIVE first; if sub-400ms, close as satisfied-by-redesign.
4. **Peek pane (spec §9, the headline feature):** the index holds every Q AND A — show
   the exchange inline in the panel, zero scrolling, immune to virtualization. Deferred
   until the jump worked; it does.

### Original close-out sequencing (superseded by the plan above)
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
  logic-reviewed only. If a regression appears in those paths, suspect them first. **The
  two post-closure batches are in this same category** — including the summary-click
  re-resolution fix, which needs a fixture that generates a summary, recycles the rows,
  then clicks (add to the §G item-1 batch).
- **The summary, tools and export surfaces have ZERO test execution.** Mutation-verified
  2026-07-27: replacing the bodies of `_sumBuildTimeline`, `_sumScrollToElement`,
  `_exportFromIndex` and `ciIndexStamp` with unconditional `throw` still passes the whole
  suite, because no test ever opens the Summary or Tools panel — every `click()` in the
  harness targets `nav-trigger` or `nav-item`. Any "374/374" or "427/427" claim about code
  in those surfaces is unearned. This is v12.1 item 1's first target.
- **No test asserts that a jump to an already-mounted target moves the viewport.**
  Deleting the scroll-and-flash block from `orbScrollToQuestion` leaves every platform
  green: the static platforms only assert `.click()` returned (it always does) and that
  nothing happens, and the virtualized sweeps place every target outside the mount window
  so the fast path is never reached.
- **The jump fast path is not fixturable by the acceptance sweep.** Mutation-verified
  2026-07-27: forcing `ciResolveMountedByPathIndex()` to return `null` always still passes
  222/222 acceptance jumps, because resolve-on-arrival absorbs the miss. Green acceptance
  numbers therefore say nothing about whether the fast path fired; only the timings do.
  Any future claim that the fast path "works" needs a latency or instrumentation assertion,
  not a correctness one.
- The renderable predicate rests on the `stop_reason` discriminator (n=2 conversations +
  a 14-conversation census). `ciValidatePredicate()` warns loudly on divergence; anchors
  keep correctness independent of it, cost is extra iterations.
- The mock's `overflow-anchor:none` mirrors an ASSUMED live property; live confirmation
  observed no teleporting, but it remains unverified directly.
