# Session Handoff — 2026-07-28 (v12.0 pre-merge hardening)

**Scope:** three post-freeze Codex comments turned into a full pre-merge hardening pass — a
5-lens local Tier 3 gate and a 24-round GitHub Codex cycle, 47 findings fixed, plus a new
bookmark-durability mechanism that was not planned.
**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-07-27_v12.0-closeout.md` (still
authoritative for the resolve-on-arrival design rationale and proof chain).
**Branch:** `feat/v12.0-conversation-index`, PR #58, 34 commits added this session, pushed,
9/9 CI green at `55600d7`.
**Next-session priority: v12.1 on a NEW PR (#59).** Owner merges #58 themselves.

---

## A. State in one paragraph

v12.0 was already complete and live-verified when this session opened. Three new Codex P2
comments arrived post-freeze; one was a **wrong jump**, which is the invariant the release
exists to protect, so pulling that thread became the session. A local 5-lens Tier 3 gate then
found **two pre-existing v12.0 CRITICALs on paths that run on every page load**, both
invisible to CI because of a single fixture default each (→ DEC-028). A 24-round GitHub Codex
cycle followed and produced **40+ findings with zero false positives**. The cycle was stopped
on **provenance** rather than exhaustion (→ DEC-029, §L): roughly 19 findings were pre-existing
defects and roughly 23 were defects in fixes made during the cycle itself. Suite went from
374/374 across 20 platform entries to **455/455 across 23**, with three new ancestor-gated
fixtures. A **provisional bookmark migration mechanism** (→ DEC-030) was built along the way —
unplanned, and the owner considers it a genuine gain, because the index gave us the full
*question* list while a bookmark on anything outside the mounted window was still dead.
**The build is NOT live-verified at HEAD** — see §J and §K.

---

## B. What was accomplished

### 1. Three post-freeze Codex P2 comments — one was a wrong jump

**What.** `_sumScrollToElement`, the summary inventory builders, `_sumBuildTimeline`,
`_exportFromIndex`. Commits `8d61473`, `5473d03`.

**Why.** Summary items bind their DOM element when the summary is *generated*; the panel
outlives that snapshot and Claude recycles rows behind the user. At click time the cached node
is either detached (silent no-op) or **still connected while displaying a different message** —
scrolling to and highlighting the wrong turn. Not a jump that resolves incorrectly, but one
that never re-resolves at all.

**Alternatives.** Validating `isConnected` alone was rejected: a recycled node is still
connected, which is precisely the failure. Re-resolving and *replacing* the element wholesale
was tried and regressed precision — inventory items point at a `<pre>` inside the message, so
resolving to the message node scrolled to the top of a long response instead of the block
clicked. The shipped form keeps the cached node when the freshly-resolved message still
`contains()` it: containment doubles as the staleness check, so precision survives without
trusting a stale reference.

**How.** Extracted `ciResolveMountedByPathIndex(pathIdx)` out of `_relocateQuestionElement` so
both callers share ONE MATCHER rather than growing a second that could drift. Threaded a
`pathIdx` distinct from the inventory's pre-existing `msgIndex` — `msgIndex` is an
assistant-only ordinal, and passing it through would have produced a confident jump to an
unrelated message. Export now emits provisional turns rather than dropping them from a file
headed "complete conversation history (API)".

**Verification.** 374/374 both engines. **Mutation-verified and it produced a finding:**
forcing `ciResolveMountedByPathIndex` to return `null` always still passes 222/222 acceptance
jumps, because resolve-on-arrival absorbs the miss. The fast path is a latency optimisation,
not a correctness dependency — and therefore not fixturable by the acceptance sweep (§J).

### 2. Local Tier 3 gate — two pre-existing CRITICALs on the ordinary load path

**What.** 5 opus lenses (correctness, blast-radius, test-integrity, contracts, lifecycle),
scope preamble enforced, every finding re-verified against source before any fix. Commits
`6bc7ed2`, `bb2d112`, `b2d6902`. Artifact: `reviews/review-2026-07-27-b2d6902.md`.

**Why — CRITICAL 1, unbounded synchronous recursion on every index load.** `ciLoadIndex`
invokes its callback **synchronously** on the in-flight early return, and `_ciConversationId`
is assigned only on success or degrade — so it stays `null` for the whole fetch window and
`scanConversation`'s not-ready guard stays true. A second scan landing in that window
recurses: `scanConversation → ciLoadIndex → done(false) → scanConversation → …` until
`RangeError`, which escapes `scanConversation` so not even the DOM fallback runs. The live
fetch is ~2.1s against a 500ms mutation debounce, so this fired on essentially every load and
every conversation switch.

**Why — CRITICAL 2, success-driven refetch loop.** `_ciAssistantStale()` returned true once a
signature repeated and never cleared it, so the resync fired, succeeded, observed the same
mismatch, and fired again — the full payload re-downloaded every ~15.5s, indefinitely, on a
completely idle page. Rendered tool output appears in DOM text but deliberately not in the
API's text blocks, so any artifact/tool-bearing answer mismatches *by construction*. The
exponential backoff could never engage: it classifies **failures**, and this loop was driven
entirely by **successes**.

**How.** (1) Don't re-enter when a load is already in flight for this conversation — its
completion callback already rescans. (2) One resync per distinct signature. That rule was
wrong twice more and reached its final form in round 23 (§B.3).

**Verification — reproduced before fixing, per DEC-027.** Latency 5ms → 2100ms: old build
`6bc7ed2` → RangeError storm, 2 entries fail; fixed → 189/189 clean. Tool-shaped row, 50s
idle: old → 5 fetches at 715/1238/16744/32244/47746ms, cadence continuing forever; fixed → 2
fetches then silence.

**The finding behind the findings.** Nothing about the userscript changed between those
failing and passing runs — only a constant in the harness. A 5ms fixture latency against a
~2.1s live payload, and fixture API text that always equals the DOM, made both bugs
unreachable in CI for an entire release and through 23 rounds of independent review. Recorded
as **DEC-028: a fixture's defaults are part of the finding.**

### 3. 24-round GitHub Codex cycle — 40+ findings, zero false positives

**What.** Rounds 1–24 on a renewed token budget, each fix verified on both engines before
push. Commits `18d619e` … `9b42ca6`.

**Pre-existing defects the earlier 23-round cycle missed (~19).** Leaving a conversation never
released its index — `ciIsClaudeChat()` requires the `/chat/<uuid>` path, so the invalidation
nested inside it never ran on Claude's home/projects routes, and multi-megabyte state was
retained. The edited-prompt staleness signature carried no content fingerprint. A
mid-generation snapshot was labelled complete while omitting the reply on screen. **The
staleness check compared only the first 200 characters** — `_normalizeCompare` caps there, so
the R17 suffix probe had been examining the end of a *prefix* since the day it was written.
Exports silently dropped `tool_use`/`tool_result` payloads. The context bar's `max()` of
indexed-vs-SSE thinking discarded the newest response's thinking whenever indexed history was
larger — the normal case after opening an old conversation.

**A privacy regression this session introduced (round 12, P1).** A provisional bookmark stored
the *entire* prompt text via `GM_setValue`, contradicting README's guarantee. Replaced with a
hash — migration only ever *compared* the text. Checking that claim showed the README was
**already** wrong about the 120-character `preview` bookmarks have always stored; corrected
explicitly rather than quietly rewritten.

**Wrong-jump paths that trusted a connected DOM node (~8).** Fixed across Summary (degraded
sessions), Search (indexed and non-indexed), and bookmark identity — including three where a
*prefix* comparison accepted a recycled node, and two where row identity was trusted without
checking the row's content.

**Fixes that broke or under-delivered and had to be re-fixed (~8) — the most instructive
group.** Round 8's snapshot-retention guard shipped **inert**: `ciSetDegraded()` sets
`_ciStatus = 'degraded'` on its first line and the guard tested `_ciStatus === 'ready'` further
down. The commit message described behaviour the code did not have. Round 9 fixed it **and
shipped a fixture**, because it was the second inert attempt in that spot. The
consumed-signature rule took **four** iterations (2 → 8 → 12 → 23) to reach a principled form:
**consume a signature only when it survives its own refetch.** Clearing on rebuild or keying
by index generation both reinstate the infinite loop (the rebuild completes each cycle);
suppressing at trigger pins consumers to the wrong branch when cycling regenerated
alternatives. Survival is the only discriminator separating "unfixable by construction" from
"genuine staleness, already resolved."

**Verification.** 455/455 both engines at every round. Three new ancestor-gated suite entries:
`Claude (slow API — load recursion guard)`, `Claude (tool-shaped row — refetch loop guard)`,
`Claude (refresh failure retains snapshot)`. One test metric corrected: the runaway-loop
assertion counted *all* fetches, which broke once failed refreshes correctly began retrying —
the property is about *successful* refetches re-triggering themselves.

### 4. Provisional bookmark migration (unplanned; owner values it) → DEC-030

**What.** `pendingHash` / `pendingSender` / `pendingOrdinal` / `pendingRow` on provisional
records, `_bmMigrateProvisional()`, `_bmUuidForProvisional()` with three resolution routes and
a uniqueness gate. Commit `011f1fc` is the final hardening.

**Why.** A bookmark stores identity, not position: schema 2 = message UUID (durable), schema 1
= content hash (legacy). Only a **UUID** lets a click fall through to the jump bridge that
pages the virtualizer to an unmounted message. So on Claude a schema-1 bookmark works *only
while its message is visible* — and there is a window where one is unavoidable: you send a
prompt, it mounts immediately, the index snapshot predates it, and a refetch takes ~2s (up to
~17s if the cooldown is running). Bookmark it in that window and you get a permanently dead
record on the newest message.

**Why it matters beyond the bug.** This is the gap the conversation index did *not* close. The
index gave Navigate/Search/Export the full conversation; bookmarks still silently depended on
the mounted window. It was not the session's focus and surfaced only because Codex pulled on
the provisional thread.

**How.** Once per index generation, bind a UUID via: (1) the virtualizer's row index
re-resolved against the rebuilt path; (2) the ordinal among turns of the record's own sender;
(3) the single hash match. Every route is hash-verified, and a **uniqueness gate** runs ahead
of all three.

**Alternatives / iterations.** Five rounds. Text-only lookup can never resolve a repeated
prompt (the text map poisons duplicates). Human-only ordinals left assistant records
unmigratable. `_ciBindMountedElements` assigns one mounted node to *every* same-text question,
so a position lookup returned the earliest twin — hence exact-or-nothing. Storing the full text
was the privacy P1. The final gate was an **owner decision, not a Codex finding**: a wrong
migration is wrong forever, and routes 1–2 are position anchors whose hash check cannot
distinguish twins, so binding now requires the text to be unique in the path. Duplicate-text
prompts stay provisional and resolve while mounted — the honest outcome.

**Verification.** Gate verified directly (unique binds / duplicate refuses / absent refuses)
and 455/455 both engines. **No fixture exists for any of it** — §J.

---

## C. Architecture snapshot

Unchanged in shape from the predecessor handoff §C. Additions this session:

- `ciIndexStamp()` — conversation uuid + `_ciIndexGen`, the pair Navigate and Search already
  fingerprint on. Captured when a summary is generated, compared on every click.
- `ciResolveMountedByPathIndex()` — the shared 3a/3b matcher (ONE MATCHER).
- Normalizers split by purpose: `_mdFlatten` (aggressive, for DOM-vs-API comparison — the jump
  matcher depends on it), `_mdVisible` (markdown syntax only, keeps visible punctuation, for
  search and display), `_normalizeCompare` (200-char cap), `_normalizeCompareFull` /
  `_normalizeFull` (no cap, for identity checks).
- `ciExtractToolText()` → `toolBlocks` per entry, kept strictly out of any text-matching path.
- Staleness: signatures now carry a content fingerprint at all four sites; consumed set is
  bounded (512, FIFO) and survival-gated; retained snapshots stay `ready` and report through
  the notes surface.
- Bookmarks: provisional migration (§B.4).

---

## D. Key principles established this session

- **End a review loop on finding PROVENANCE, not count** (DEC-029, §L).
- **A fixture's defaults are claims about the environment** (DEC-028).
- **A still-connected DOM node is not evidence of identity** under recycling. `isConnected`
  cannot see the common case.
- **Never compare a prefix when deciding identity.** Three separate defects this session were
  a 200-char cap accepting a recycled node or a superseded branch.
- **A guard must be proven to fire.** Round 8 shipped an inert guard with a commit message
  describing behaviour it lacked. When a fix is subtle, ship a fixture with it.
- **Position may confirm identity; it may never establish it.** Every bookmark route verifies
  content, and refuses when the content is ambiguous.

---

## E. Git state

`feat/v12.0-conversation-index` @ `55600d7`, pushed, PR #58 **OPEN**, 9/9 CI green, tree clean.
34 commits added this session (`c863f2f..55600d7`), 1,018 insertions to the userscript.
**Owner merges #58.** v12.1 work goes on a NEW branch → PR #59.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` (this file) | current state, next steps |
| `docs/handoffs/SESSION_HANDOFF_2026-07-27_v12.0-closeout.md` | resolve-on-arrival rationale, proof chain |
| `DECISIONS.md` DEC-021..030 | design rationale incl. DEC-028/029/030 from this session |
| `TROUBLESHOOTING.md` | the two load-path CRITICALs with reproductions |
| `TESTING.md` | fixture knobs (`apiLatencyMs`, `toolShapedRow`, `refetchProbeMs`, `failFetchAfter`) and the guard entries |
| `reviews/review-2026-07-27-b2d6902.md` | the 5-lens Tier 3 round |
| PR #58 comment thread | the 24 Codex rounds, one comment each |

---

## G. What comes next — v12.1 (owner-agreed, 2026-07-28)

**All of this goes on a new branch → PR #59.** Do not reopen #58.

1. **Live-test and fine-tune the bookmark mechanism** (owner-elevated). It is unplanned,
   valuable, persistence-writing, and completely unfixtured. Specific questions:
   - Does bookmarking a just-sent prompt, then scrolling away, still resolve?
   - Does the uniqueness gate refuse a repeated prompt (`continue`) as intended, and does that
     record still resolve while mounted?
   - Does the icon show active state correctly for a migrated record?
   - Does a pre-v12.0 bookmark still resolve (legacy hash paths)?
2. **Fixture batch — the Summary/Export dead zone first.** Mutation proved these surfaces have
   **zero test execution** (§J). Highest value in the release. Then the carried-over batch:
   localized unmatchable-cluster; unmatchable-HEAD (live Q#1 shape); assistant-TAIL
   (`ciTryExtreme` last-row); GM-shim 401/429/malformed-JSON backoff classes; summary-click
   after recycling. Label each **ancestor-gated** vs **mutant-gated** — not equal evidence.
3. **Retry-After honoring for HTTP 429** — plumb response headers through `ciRequestJSON`.
4. **Reassess, don't build: §4.2 offset cache / §4.3 height learning.** Measure a repeat jump
   live first; if sub-400ms, close as satisfied-by-redesign.
5. **Peek pane (spec §9)** — show the exchange inline from the index, zero scrolling.
6. **Debulking.** The userscript is now ~9,300 lines. Candidates the review surfaced: four
   functions defined and never called (`ciResolvePathForRow`, `ciDataIndexToFullPath`,
   `ciFullPathToDataIndex`, `_bmLegacyId`); dead fields (`msgIndex` on inventory/entity
   entries has no consumer); `_bmLegacyIdSet`'s two dedupe guards compare raw text against a
   hash and can never fire; two dead test config keys (`listedTurnsOverride`,
   `knownProvisionalDuplicates`) making one assertion unreachable.

---

## H. Operational context + owner rules

- **Merge authority is the owner's alone.** Standing since Phase 3. Reaffirmed this session:
  the owner merges #58.
- **Owner runs all live tests** on Firefox + Tampermonkey. Give a raw install URL and precise
  steps. CI and the mock suite cannot reach that context, and every Layer 3/4 lesson in this
  project was learned there.
- **Token budget was renewed mid-session**, which is why a 24-round cycle was affordable. Do
  not assume it stays renewed.
- **The owner asked to be given the reasoning before risky choices**, not a recommendation
  alone — the bookmark hardening decision was made that way (mechanism explained, three
  options with consequences, owner chose). Repeat that pattern for persistence-writing or
  hard-to-reverse work.
- **Report faithfully over favourably.** The owner's question "is our code that buggy?" was
  answered with the provenance arithmetic, including that most findings were self-inflicted.
  That is the expected register.

---

## I. Deferred / future work

- §G items 3–6 above.
- Perplexity gallery limitation (pre-existing, documented in README).
- The `overflow-anchor:none` assumption in the mock still mirrors an *assumed* live property;
  live confirmation observed no teleporting but it remains unverified directly.
- One NOTE left open deliberately: with a persistently degraded index **and** a summary built
  from the DOM fallback, both stamps are null so the generation guard compares equal. The
  `elKey` text fingerprint added in round 5/20 covers the recycled case; the residual is a
  node whose full rendered text is unchanged, which cannot be a different message.
- `agent_docs/conventions.md` — **proposed, not applied** (per CLAUDE.md, lessons go there only
  with owner approval): add "a guard must be proven to fire" and "never compare a prefix when
  deciding identity".

---

## J. Risk caveats

- **⚠ NOT LIVE-VERIFIED AT HEAD.** The owner's live test passed on `5f2a8be`. HEAD is 34
  commits past that, touching the load path (recursion guard, retention, backoff),
  bookmark identity, Search, Summary, Export and the context bar. §K is the retest plan.
- **⚠ Summary, Tools and Export have ZERO test execution.** Mutation-verified: replace the
  bodies of `_sumBuildTimeline`, `_sumScrollToElement`, `_exportFromIndex` and `ciIndexStamp`
  with unconditional `throw` and the whole suite still passes. No test opens those panels —
  every `click()` in the harness targets `nav-trigger` or `nav-item`. **Any "455/455" claim
  about code in those surfaces is unearned**, including in this session's commit messages.
- **⚠ The bookmark migration writes persistent data and has no fixture.** A wrong binding is
  permanent. The uniqueness gate closes the known hazard; nothing tests it.
- **No test asserts that a jump to an already-mounted target moves the viewport.** Deleting the
  scroll-and-flash block leaves every platform green.
- **The jump fast path is not fixturable by the acceptance sweep.** Forcing
  `ciResolveMountedByPathIndex` to return `null` still passes 222/222 — resolve-on-arrival
  absorbs the miss. Any future "the fast path works" claim needs a latency assertion.
- **~23 of this session's changes are unfixtured by construction** (edge windows:
  mid-generation, degraded index, off-snapshot rows, multi-org failures). Suite-green and
  logic-reviewed only. If a regression appears in those paths, suspect them first.
- Rounds 14–23 of the *first* cycle also remain unfixtured (carried from the predecessor).
- The renderable predicate still rests on the `stop_reason` discriminator (n=2 conversations +
  a 14-conversation census). `ciValidatePredicate()` warns on divergence; anchors keep
  correctness independent of it.

---

## K. Live retest plan (carried forward and expanded)

**Install:** raw URL at the branch tip —
`https://raw.githubusercontent.com/JoonJ14/ai-conversation-navigator/feat/v12.0-conversation-index/ai-conversation-navigator.user.js`
Reinstall over the existing script; confirm `@version 12.0` and that the tip matches
`git rev-parse --short HEAD`. `localStorage.setItem('acnJumpDebug','1')` for traces.

Ordered by what this session's changes put at risk:

1. **Load a long conversation, watch the console.** No `RangeError: Maximum call stack size
   exceeded`. This is the round-1 CRITICAL and it fired on every load.
2. **Leave the conversation** (home, then Projects) and return. State releases and rebuilds; no
   stale question list from the previous chat.
3. **Idle two minutes on a conversation containing an artifact or tool use**, DevTools Network
   filtered to `chat_conversations`. At most two requests, then silence — not one every ~15s.
4. **Jumps:** Q#1 (attachment chip), Q#75, Q#140, Q#147, one short duplicate. Land exactly or
   refuse honestly. Never a wrong landing.
5. **Summary:** generate, scroll until rows recycle, click a map segment and an off-screen code
   inventory item — land or refuse, never an unrelated message. Then switch conversations with
   the panel open and click: expect "Summary is out of date — regenerate it to jump".
6. **Search:** a phrase spanning markdown (bolded word + next word) and a bracketed token like
   `array[index]`. Both must match.
7. **Export:** header must not claim completeness while a reply is generating; tool/artifact
   blocks appear in the body.
8. **Bookmarks (v12.1's first task — gather data now):** bookmark the newest prompt right after
   sending, scroll away, click it. Then repeat with a duplicated prompt (`continue` twice) and
   note whether it resolves while mounted and refuses when not.

If 1–3 misbehave, suspect the load-path rounds (1, 8, 9, 11, 23). If 5–8, suspect the
surface-specific rounds (5, 13, 17–22, 24).

---

## L. Stopping rule for review loops (DEC-029)

Classify each round's findings into **pre-existing defects** versus **defects in fixes made
during this cycle**. While the first group dominates, the loop is discovering shipped bugs —
continue. Once the second dominates — here ~23 of ~42, with individual mechanisms needing four
and five iterations — the loop has become the primary source of new defects and should stop,
**regardless of whether findings are still real and still P1**.

Check it alongside **how much new code the loop has written into a surface no test executes**.
This cycle added 1,018 lines (22% of the release) into exactly such a zone (§J), so each fix's
only verification was the next round reading it. That combination is a random walk with a
review bot as the sole safety net.

The exit is not another round: **stop changing code → live-verify → merge → fixture the
untested surface first in the next version.**
