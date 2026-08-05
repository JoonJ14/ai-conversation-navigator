# Review — the `usageUnavailable` fix (2026-08-05)

**Branch:** `docs/session-record-pr72` (PR #73) | **Base:** `main` @ `fac7d50` | **Head at review:** `77d8f35` + working tree
**Diff:** 2 files changed (~30 lines) + 1 new probe (~300 lines) → **all three tiers** per adaptive scaling
**Tier 3 backend:** `codex` (`codex exec`, full repo access) — from `~/.claude/review-backends/active.conf`

---

## What changed

`renderUsageBars` received `null` for two unrelated reasons — *no fetch has finished yet* and
*a fetch finished and produced nothing* — and rendered `planUsageLoading` for both. The second
never resolved, so a failed Claude usage request left the panel reading **"Plan usage loading…"
forever, in both languages**, while `usageUnavailable` sat in both string tables with no call site.

- `_usageFetchFailed` separates the two states; the `!data` branch picks the message and stamps
  `data-acn-usage-state` (additive — no `data-acn-*` removed).
- `_usageReqSeq` generation token (added in review, see WARN 1).
- Repaint-on-fetch-start when a placeholder is showing (added in review, see WARN 2).
- `ACN_VERSION` and `@version` 12.7 → **12.8**.

---

## Tier 1 — structural scan

**PASS**, 0 CRITICAL, 0 WARN, 2 NOTE (both fixed).

| Check | Result |
|---|---|
| Registration completeness | PASS — flag declared with the other usage state, read in 1 place, written in 2 |
| Interface contracts | PASS — `renderUsageBars(container, data)` signature unchanged |
| Config hygiene | **NOTE** — the comment claimed "every failure path funnels through `callback(null)`", but the stale-response drop at `:4910` calls back *neither* way. Comment sharpened to name that exit and why leaving the flag alone there is correct |
| File placement | PASS — probe in `probes/`, CI wiring matches the existing step |
| Dead-key baseline | **NOTE** — wiring `usageUnavailable` moves the audit baseline **14 → 13**. `agent_docs/conventions.md` updated |

## Tier 2 — deep logic

**PASS**, 0 CRITICAL, 0 WARN, 3 NOTE.

The decisive check: **`fetchClaudeUsage` has exactly one caller.** Both entry points
(`orbPopulateNavigate:5838`, the SSE debounce at `:4758`) funnel through `maybeRefreshUsage`,
which clears the flag immediately before every request. So a dropped response is only ever a
*superseded* one, whose superseder also cleared the flag and will itself call back.

Clearing **before** the call is required, not incidental: the missing-`GM_xmlhttpRequest` path
invokes `callback(null)` **synchronously**, so clearing afterwards would erase the failure the
callback had just recorded.

NOTEs (behavioural, recorded not "fixed"): a failed poll now replaces good bars with
"Usage data unavailable" rather than with "loading…" — both lose the bars, the new one is at
least honest; and a conversation switch can show the previous state for one frame before the
refetch repaints.

## Tier 3 — codex, one round

**0 CRITICAL, 3 WARN, 2 NOTE.** 3+ WARNs blocks, so all five were fixed and re-verified.

| # | Sev | Finding | Verified | Fix |
|---|---|---|---|---|
| 1 | WARN | Stale-response guard keys on **org uuid only**, so two overlapping *same-org* requests can complete out of order — an old failure erases a newer success. `ciInvalidate()` zeroes the cooldown while a request is pending (`:3543`), making it reachable | **Confirmed** — read both sites | `_usageReqSeq` generation token; callback ignores superseded responses. Also fixes the pre-existing `_usageData` half of the same race |
| 2 | WARN | Starting a fetch updated the flag but nothing **repainted**. `orbPopulateNavigate` early-returns on an unchanged question-list fingerprint (`:5800`) *before* reaching `maybeRefreshUsage`, so a retry could keep showing "unavailable" while a request was in flight | **Confirmed** — the early return does precede the call | Repaint at fetch start, but **only when a placeholder is up**; replacing real bars with "loading…" every 5-minute poll would be a worse lie than the one being fixed |
| 3 | WARN | `readStable()` returned an unmarked final sample on timeout, so a never-settling UI could pass on a lucky last read | **Confirmed** | Returns `stable:false`; every assertion conjoins `sound()` (`section && stable && dupes===1`) |
| 4 | NOTE | `bars` counted `.acn-usage-title` too, so a response rendering only the heading satisfied `bars > 0` | **Confirmed** | Counted separately; U3 now requires `bars > 0 && titles > 0` |
| 5 | NOTE | `dupes` was diagnostic only and gated nothing | **Confirmed** | `dupes === 1` folded into `sound()` |

Codex also independently confirmed: ES5 compliance, `\uXXXX` escaping of functional non-ASCII,
both version fields at 12.8, the Korean string's meaning, and the CI wiring.

---

## Mutation testing — does the gate actually gate?

A check that cannot fail is not a gate, so every claim was tested against a build with that
specific fix removed.

| Build | Result |
|---|---|
| **Pre-fix** | **6 of 10 fail** |
| **No supersession guard** | **U8** — a late failure erases a newer success |
| **Drop every superseded response** | **U9** — a late success is discarded |
| **`_usageData` truthiness** | **U10** — a stale org's bars block a valid newer response |
| **Minus repaint** | **all pass — NOT gated** |
| **Fixed** | all 10 pass |

**The repaint fix (WARN 2) is not covered by any check, and an earlier version of this document
said it was.** That claim came from a run in which the no-repaint mutant failed U7 — but U7 was
itself racy at the time, and its race produced the same symptom as the mutant: `readStable`
settled on the still-correct *pre-retry* `unavailable` state before the retry request had been
issued. Once U7 was made to wait for the retry request instead of a duration, the mutant passes.
Both results are kept here with their contexts rather than one replacing the other, per the
project's measurement rule. The repaint is retained on the strength of **reading** the early
return at `:5800`, which demonstrably precedes the `maybeRefreshUsage()` call — not on a test.

Two honest notes on scope, stated rather than implied:

- **U4 fails on the pre-fix build only because that build has no `data-acn-usage-state` attribute
  at all** — not because it discriminates the states there. U4's discriminating power is against
  *future* over-eager fixes (a build that reports failure whenever data is absent fails U4's text
  assertion). "6 checks failed" would otherwise read as six independent reproductions.
- **U7 does not gate the repaint, and I claimed twice that it did.** First it passed on the
  no-repaint mutant (its route-change trigger rebuilt the whole panel, sidestepping the early
  return WARN 2 is about). Then it appeared to fail on that mutant — but only because U7 was
  racy, and the race's symptom coincided with the mutant's. With the race fixed, the mutant
  passes again. **"I wrote a test for it" was false both times, for two different reasons.**

Two scenario bugs were found in the probe itself while building it, both of the same shape —
**a fixed sleep sampling a transient state**:

1. The first draft used a settle timeout; the panel re-renders on MutationObserver cycles, so the
   same scenario passed one run and failed the next with nothing changed. Replaced with the
   stable-read loop. (CLAUDE.md: *a single run is not a measurement*.)
2. U8 route-changed as soon as one request was in flight, which landed mid-initialisation and
   meant **no second request was ever issued** — `requests=0` read as a failure of the code under
   test rather than of the scenario. Now waits on the request counter plus a settle.
3. U7 had the same defect and it escaped twelve consecutive clean runs, surfacing only under
   **concurrent load** (~1 run in 13, and only while other probes were running). It waited a
   fixed 500 ms after the route change, so `readStable` could settle on the pre-retry
   `unavailable` state — a *stable read of the wrong moment*. Now waits for the retry request to
   be issued. Verified with 10 consecutive loaded runs, having reproduced the failure first.

And one self-inflicted syntax break: a backtick inside a comment **inside a template literal**
silently terminated the string — the exact failure `CLAUDE.md` already records from
`map-instrument.js`. Noted in the file so it is three strikes, not two.

---

## Totals

- **Issues found:** 10 (2 Tier 1 NOTE, 3 Tier 2 NOTE, 3 Tier 3 WARN, 2 Tier 3 NOTE)
- **Verified:** 10 — every one read at the cited line before acting
- **Fixed:** 7 (both Tier 1 NOTEs, all 5 Tier 3 findings); 3 Tier 2 NOTEs recorded as intended behaviour
- **False positives:** 0

**PIPELINE APPROVED** — 3 tiers passed.
