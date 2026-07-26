# Review — 2026-07-26 — dbe72db (v12.0 Phase 3: jump-to-message)

| Field | Value |
|---|---|
| Branch | `feat/v12.0-conversation-index` |
| Base | `dbe72db` (Phase 2 commit) |
| Tier 3 backend | **opus** — 4 lenses, then 2 re-review lenses, scope preamble enforced |
| Tests | **Chromium and Firefox**, both green |
| **Result** | **IN PROGRESS — mutation-verification fleet still running** |

## Backend experiment

| backend | model | effort | findings | confirmed | tokens | GH rounds after |
|---|---|---|---|---|---|---|
| codex | gpt-5.6-terra | xhigh | STALLED at 20m, 0 output | n/a | wasted | n/a |
| opus | opus (latest) | — | 45 (4 lenses) + 26 (2 re-review lenses) | 71 | ~1.0M subagent | pending |

**Opus notes for the experiment.** The lenses did not reason from the diff — they
*verified*. One ran Playwright probes across all 14 mock pages and caught a rendered-text
defect. One **mutation-tested** the suite by breaking the implementation and confirming
the tests still passed. One measured `TreeWalker` semantics in a live browser to disprove
a fix. That class of finding does not come from reading. The scope preamble held: zero
architecture commentary across all six reports.

**Backend reliability is experiment data too.** The codex round produced nothing after
20 minutes and had to be killed; opus produced 71 confirmed findings across six agents.

---

## The most important result

**The Phase 3 tests passed against a broken implementation.** Proven by mutation:

| Mutation | Old suite |
|---|---|
| jump body → `done(false, null)` | **25/25 PASS** |
| offset hardcoded to `0` | passed, landing at the *top* when asked for the *last* question |
| all text stripping disabled | test 20 PASS |
| entire tree walk → `msgs.slice()` (zero branch filtering) | **25/25 PASS** |
| `orbSetJumpBusy` → no-op | **47/47 PASS** |
| late uncaught throw during a jump | **25/25 PASS** |
| uncaught throw on `chatgpt.com` | ChatGPT PASS (14/14) |

Same shape as the original v12.0 bug: green tests over an unvalidated assumption. The
tests described the fix instead of failing without it.

---

## Round 1 — 45 findings

**Lens 1 (loop lifecycle).** `ciWaitForSettle` computed a `changed` signal the caller
never bound. Supersession called `cleanup()` but never `done()`, so the busy flag could
stick forever. No try/catch anywhere. **`ciDataIndexToFullPath` was defined and never
called** — nothing verified the landed row was the target. `ciTotalRows()` unscoped.
`q.element` stored the virtualizer's recycling unit. `CI_PINNED_TAIL_ROWS` matched neither
live (3) nor mock (1).

**Lens 2 (text/offset).** `_cleanText` recursed into **Comment nodes** —
`CharacterData.textContent` IS the comment body while `Element.textContent` excludes
comments, so the same element returned different strings depending on whether a bookmark
icon had been injected. Verified end-to-end: Grok's first Navigate entry rendered the
mock's HTML comment instead of the question. Pre-existed at `dbe72db`; Phase 3 made it
load-bearing because it kills `ciDeriveRowOffset` outright.

**Lens 3 (test integrity).** The mutation table above, plus: `pageerror` attached before
navigation so the previous platform's errors leaked in; the error assertion ran *before*
the jump tests; the fixture cookie leaked into the shared BrowserContext; poll budget
6,000 ms against an 8,400 ms implementation bound; **the mock's `scrollHeight` varied
0.1% and mapped linearly, so the first interpolation always landed and the entire
convergence machinery was dead code** — a throw inside the cluster selector broke nothing.

**Lens 4 (cross-platform).** ES5 clean. `isUIChrome`'s skip did not skip the subtree.
Two incompatible definitions of the legacy bookmark hash. AI search relocation compared
raw `textContent` against extractor-derived text. `_ciJumpToken` never reset.

## Round 2 — re-review of the corrected code, 26 further findings

Run on the *corrected* implementation; found defects introduced by the corrections.

**Loop lens.** `ciMountedRows` unscoped while every sibling was scoped.
**`ciVerifyLandedRow` verified nothing** — its index check is a tautology by construction,
and an empty expected text returned `true`. The `!changed` clamp test compared post-move
`scrollTop` against the value `ciMoveTo` had just written, so it aborted after every
ordinary move. Document-level keydown aborted on **any** keystroke including typing.
`totalRows === null` slammed the container to the bottom eight times. `observed ===
targetRow` moved neither anchor, oscillating until the cap. Assistant verification could
never succeed because the API returns **raw markdown** and the DOM holds **rendered**
text. A superseded jump cleared the live jump's busy flag.

**Text/bookmark lens.** `_bmLegacyIdSet` derived its set from live DOM state, so the two
call sites still disagreed — and the shape it was reproducing **cannot exist**, because
v11.8 hashed before the icon was appended. Measured: one site recognised `7baab041`, the
other computed `7d8b6970`. `isUIChrome`'s `nextSibling()` skip is ineffective when the
chrome element is the **last child** — `nextSibling()` returns null without moving
`currentNode`, so `nextNode()` re-descends; measured leak `"REAL TEXT BYou said:"`, masked
in source-parsed mocks by whitespace text nodes that React DOM does not have.
`#acn-bm-list` never existed. Assistant bookmarks degraded to schema 1.

All 71 findings fixed. Notable fixes: `_normalizeCompare()` (markdown-insensitive
comparison), `ciFeedRoot()` (scoped row queries), `_textAsLegacy()` (v11.8's exact hash
shape), a real `NodeFilter` returning `FILTER_REJECT`, `orbSetJumpBusyFor(token)`, and
`done(ok, el, reason)` so aborts are silent.

---

## Owner corrections from Probe C runs 2 and 3

Phase 3 was built on run 1 alone; runs 2 and 3 changed the verdict. All nine applied:

| # | Correction | Status |
|---|---|---|
| 1 | Not pin/autoscroll — build no pin-interference abort | ✅ none built; DEC-024 records the wrong diagnosis *and* the evidence against it |
| 2 | Remove the dispatch entirely, not behind a flag | ✅ removed; contradicting justification comment deleted |
| 3 | Cluster selection was "largest run", not "nearest" | ✅ `ciSelectCluster`, real `getBoundingClientRect` geometry |
| 4 | Remove hardcoded `CI_PINNED_TAIL_ROWS` | ✅ deleted; clusters detected structurally |
| 5 | Anchor-pair mismatch in the tolerance branch | ✅ cluster re-read after `scrollIntoView` |
| 6 | Verify `_ciFullPath[].text` comes from `content[]` | ✅ correct today; **test 27** guards it |
| 7 | Document text matching as load-bearing | ✅ warning at `_cleanText` |
| 8 | Settle on the selected cluster, not the whole set | ✅ |
| 9 | Test non-virtualized degradation | ✅ asserted on all 14 static platforms |

---

## Test suite rebuilt to be diagnostic

| Old weakness | New assertion |
|---|---|
| Jump could no-op and pass | Landed row must **be the right message**, and **unmounted at click time** |
| Offset could be 0 and pass | Mid-conversation target (Q#20 → row 38) — no always-mounted escape hatch |
| Stripping could be disabled and pass | Mock injects an HTML **comment** and an `.sr-only` span **inside** the queried node |
| Busy flag could be a no-op and pass | Busy state must be **observed**, not merely absent |
| Branch filtering could be deleted and pass | Fixture carries an **abandoned branch** (test 26) |
| Convergence machinery was dead code | Varied row heights + progressive measurement → drift **0.1% → 6.28%** |
| Error check ran early, one platform | Runs **last**, for **all 16** entries |
| Errors leaked between platforms | `pageerror` attached **after** navigation, buffer cleared per entry |
| `not-sr-only` protection vacuous | Fixture text non-empty, so mis-stripping loses it |

**267/267 on Chromium and Firefox.** Firefox is the platform where this project's
execution-layer failures happen (DEC-019, DEC-020); Playwright's Firefox was not installed,
so that acceptance criterion had never actually been run. Jump converges identically:
question #1 from the bottom in ~207 ms, mid-conversation in ~307 ms, both landing on the
correct message.

---

## Outstanding

1. **Mutation-verification fleet** — running; proving the *new* tests fail on broken code
2. **Live verification on claude.ai** — owner. CI now exercises the loop against a
   faithful mock, but the mock is still our model of the virtualizer.
3. **§4.2 offset cache and §4.3 height learning remain unimplemented** — deliberately.
   With `scrollHeight` drifting 3.2%, a pixel-keyed cache is actively harmful; a
   row-anchor-keyed one would be safe and is the right follow-up. The "repeat jump is
   near-instant" acceptance criterion is therefore **not met**, and is flagged rather
   than quietly dropped.
