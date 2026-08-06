# Session Handoff — 2026-08-05 (v12.8: the usage panel stopped lying, and the session record caught up)

**Scope:** two arcs, the first of which produced the second. (1) A state audit found that the
previous `/baton-handoff` had run **before PR #72 existed**, so that entire arc had no session
record and four handoff claims had gone stale. (2) Closing that gap surfaced `usageUnavailable`
as a live, user-visible bug — a failed Claude usage fetch left the panel reading "Plan usage
loading…" **forever** — which shipped as **v12.8**.

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-08-02_v12.7-korean-tokenizer.md`
(v12.7 tokenizer, v12.7a panel i18n, and the PR #72 docs reframing in its §B.7/§B.8 — read it
for any tokenizer or i18n detail this doc summarises).

**Status at close:**
- **PR #73 — OPEN, CI green, Codex clean, NOT merged.** The owner merges after reading this.
  Head `5dbce77`. Contains both arcs: the session record and the v12.8 fix.
- **v12.8 shipped in that PR** — `ACN_VERSION` and `@version` both bumped from 12.7.
- **Everything before it is merged:** #70 (`06a079f`, v12.7), #71 (`980aa68`, v12.7a),
  #72 (`fac7d50`, docs reframing).

> **The one thing owed: a LIVE CONFIRM of v12.8 (DEC-031).** No mock reproduces a real 5xx from
> claude.ai, and the standing rule is that a green suite is a context-scoped finding. **How to
> check:** open Claude with the Navigate panel showing Plan usage, break the usage request (log
> out in another tab, or block `claude.ai/api/organizations/*/usage` in devtools), reopen the
> panel. Expect **"Usage data unavailable"** — not a permanent "loading…".

---

## A. State in one paragraph

The Korean arc is closed and merged; what remained were its leftovers. PR #72 had reframed the
unwired i18n keys as owner preference, and in doing so proved that **two of them were not
preferences at all** — a preference presupposes something rendering to have a preference about,
and for those two nothing rendered in either language. One of the two, `usageUnavailable`, was a
shipped bug: `renderUsageBars` received `null` for two unrelated reasons (*no fetch has finished
yet* / *a fetch finished and produced nothing*) and rendered the loading placeholder for both.
The first resolves on its own; the second never does. That is now fixed, along with two further
defects Tier 3 review found **in the fix** — an out-of-order response race and a missing repaint.
The other leftover, `summaryLanguageNote`, still needs an owner decision rather than work.

---

## B. What was accomplished

### 1. The session-record gap — found by auditing, not by being told

**What.** The previous `/baton-handoff` ran on branch `fix/tools-i18n`, *before* PR #72 was
opened. So the whole PR #72 arc — four Codex rounds, ten findings, and a real bug discovery —
existed only as scattered edits inside the documents it corrected. Added `§B.7` to the (now
archived) handoff, **DEC-043**, and `reviews/review-2026-08-03-i18n-docs.md`.

**Four stale claims fixed at the same time**, all found by checking rather than assuming:

| Surface | Claimed | Actual |
|---|---|---|
| handoff header | "v12.7a — PR #71 … authorized to merge" | both #71 and #72 merged — and this is the first thing a new session reads |
| handoff §E | `main` @ `06a079f`, #71 open | `fac7d50`, nothing open |
| handoff §F | `check-tokenizer.js` — 8 checks | **12** (verified by running it) |
| handoff §J | "this PR is not authorized to merge" | referent no longer existed |

**Why it matters beyond the fix.** Two of those are the *first thing a cold session reads*. The
lesson is in **DEC-043**'s stopping-rule half: the audit that catches this has to be run, not
assumed, and running `/baton-handoff` at the wrong moment in a multi-PR session leaves a gap
that nothing else closes.

### 2. v12.8 — the usage panel stopped lying (DEC-044)

**The bug.** `renderUsageBars` could not distinguish *no fetch has finished yet* from *a fetch
finished and produced nothing*; both arrived as `null` and both rendered `planUsageLoading`. A
failed usage request therefore left the panel claiming to still be loading **forever, in both
languages**, while `usageUnavailable` sat in both string tables — with a Korean translation
someone had deliberately written — and had **no call site**.

**Why it had been misfiled**, and the transferable part: the v12.7a audit filed it with the other
dead keys as a translation preference. **A preference presupposes something rendering to have a
preference about.** Nothing rendered here in either language, so there was no English surface to
prefer. The rule now lives in `agent_docs/conventions.md`: *a dead key is not automatically a
preference — check whether the surface behaves correctly without it before filing it as one.*

**The remedy needed the owner, because the repo asserted both answers.** `docs/PLAN-USAGE.md`
§"Fetch fails" specified rendering *nothing*; the existence of the string implied a *message*.
Mutually exclusive, so an implementer could satisfy neither. **The owner chose EXPLICIT.** The
spec was rewritten to match, with its superseded wording preserved rather than deleted.

**How.** A single flag, `_usageFetchFailed`, separates the two states; the placeholder carries
`data-acn-usage-state` so the state is assertable. Two ordering rules are load-bearing:
- **Clear the flag BEFORE calling `fetchClaudeUsage`** — the missing-`GM_xmlhttpRequest` path
  invokes its callback **synchronously**, so clearing afterwards would erase the failure the
  callback had just recorded.
- **Each request carries a generation token** (`_usageReqSeq`) — see §B.3.

**Verification.** New probe `probes/check-usage-state.js`, 10 checks, wired into CI
(ubuntu+chromium) and `npm run test:probes`. It drives the **real UI** by opening the Navigate
panel — no instrumentation hook. Suite **1120/1120** both engines. **Live confirm still owed.**

**Path.** Commit `67f866d`; DEC-044; CHANGELOG 12.8.

### 3. Tier 3 found two more defects — in the fix, not in the original bug

Both verified by reading the cited lines before acting:

- **Overlapping SAME-ORG requests could complete out of order.** The stale-response guard inside
  `fetchClaudeUsage` keys on the *org uuid*, which cannot separate two requests for the same org
  — and `ciInvalidate()` zeroes the usage cooldown while a request may still be pending, which
  makes it reachable. A slow failure landing after a fast success erased good data. Fixed with a
  per-request generation token, **which also closes the pre-existing half of that race** (it
  applied to `_usageData` before this change existed).
  **That guard then needed two more corrections, both found in later review** (§B.6) — see the
  final rule in §C. Each wrong form is now gated by its own check, which is the only reason the
  third one was caught rather than shipped.
- **Setting a flag is not repainting.** `orbPopulateNavigate` early-returns on an unchanged
  question-list fingerprint (`:5800`) *before* it reaches `maybeRefreshUsage`, so on a settled
  page nothing would redraw and a retry would keep showing "unavailable" while a request was
  genuinely in flight. Now repaints at fetch start — **but only when a placeholder is already
  up**, because replacing real bars with "loading…" on every five-minute poll would be a worse
  lie than the one being fixed.

**Alternatives considered and rejected** for the failure UI: *silent* (the spec's original
answer — defensible, but rejected by the owner, and it would have meant deleting an existing
Korean translation); *keep the bars and overlay a warning* (presents a possibly-stale quota as
current — the same class of lie); *leave it documented* (what the previous session did — correct
at the time, but it left a user-visible defect shipped).

### 4. The review pipeline, and what mutation testing actually showed

`/review-pipeline`, all three tiers, `codex` backend → `reviews/review-2026-08-05-usage-state.md`.
**10 findings, all verified at the cited line, 0 false positives.** Tier 3 alone produced 3 WARN
+ 2 NOTE, all fixed.

**Every claim was mutation-tested** against a build with that specific fix removed, because a
check that cannot fail is not a gate:

| Build | Result |
|---|---|
| **Pre-fix** | **6 of 10 fail** |
| **No supersession guard** | **U8** — a late failure erases a newer success |
| **Drop every superseded response** | **U9** — a late success is discarded |
| **`_usageData` truthiness** | **U10** — a stale org's bars block a valid newer response |
| **Minus repaint** | **all pass — NOT gated** |
| **Fixed** | all 10 pass |

**Two honest scope notes, stated because the raw numbers would mislead:**
- **U4 fails on the pre-fix build only because that build has no `data-acn-usage-state` attribute
  at all**, not because it discriminates states there. Its power is against *future* over-eager
  fixes. "6 checks failed" would otherwise read as six independent reproductions.
- **Nothing gates the repaint fix, and I claimed twice that something did.** First U7 passed on
  the no-repaint mutant (its route-change trigger rebuilt the whole panel, sidestepping the early
  return). Then it appeared to fail on that mutant — but only because U7 was itself racy and its
  race produced the same symptom as the mutant. With the race fixed, the mutant passes again. The
  repaint is retained on **reading** `:5800`, not on a test. Both measurements are recorded.

### 5. The probe's own bugs — all one shape

Three scenario defects, every one **a fixed sleep sampling a transient state** (the panel
re-renders on MutationObserver cycles):

1. First draft used a settle timeout — same scenario passed one run, failed the next, nothing
   changed. Replaced with a stable-read loop requiring two agreeing consecutive reads.
2. U8 route-changed mid-initialisation and issued **no second request at all** (`requests=0`) —
   which reads as a failure of the code under test rather than of the scenario.
3. U7 had the same defect and **escaped twelve consecutive clean runs**, surfacing only under
   concurrent load (~1 in 13). Now waits for the retry request to be *issued*; verified with 10
   consecutive loaded runs **after reproducing the failure first**.

Also self-inflicted: a backtick inside a comment **inside a template literal** silently
terminated the string — the exact failure `CLAUDE.md` already records from `map-instrument.js`.
That is three strikes, and it is noted in the file.

### 6. `/babysit-pr-cycle` — 5 rounds, 5 fixes, clean at the end

Every round found something real; none was a restatement of a previous one. Recorded in order
because the *shape* of the sequence is the lesson:

1. **`HANDOFF §B.7` transcribed the dead-key baseline** as "9+3+2" inside the same paragraph
   forbidding transcription — and the number was *already* stale, since v12.8 had wired
   `usageUnavailable` one commit earlier. **The failure mode DEC-043 predicts arrived inside the
   document that predicted it, in under two days.**
2. **P1 — the retry probe closed the panel it needed open.** Claude's config has `spa: false`, so
   the dispatched `popstate` did nothing, and `orbOpenPanel` toggles: the second click *closed*
   the panel. The real trigger is the MutationObserver scan noticing the uuid change →
   `ciInvalidate()` → `orbOnScanComplete()` → `orbPopulateNavigate()` **only if the panel is
   open**. The click was disarming the mechanism the checks depend on; they passed only because
   the ~500ms scan happened to fire first.
3. **P2 — `pushState` alone schedules no scan.** The mock is static, so the retry depended on a
   scan that happened to be pending. **Proved by experiment**: with a 3s settle and no forced
   mutation, U7 times out; with one, it passes. Now forces an observer batch deliberately.
4. **P2 — supersession is ASYMMETRIC and my guard was not.** Dropping every superseded response
   discarded a valid older success while the panel showed "unavailable". Added **U9**.
5. **P2 — "newer data landed" is a generation, not truthiness.** `ciInvalidate()` leaves
   `_usageData` populated, so for a multi-org user another org's stale bars satisfied the test
   and blocked a valid response. Added **U10** and `_usageDataSeq`.

**The pattern worth carrying:** three of the five were in machinery I wrote to *verify* the fix,
not in the fix. The v12.8 behaviour has been correct since `67f866d`. What kept needing
correction was the concurrency guard around it and the probe around that — and in every case the
thing passed while being wrong, which is why "check that the fixture did the thing" is in §D.

Full record: `reviews/review-2026-08-05-usage-state.md`.

---

## C. Architecture snapshot

Unchanged from the prior handoff except for one addition: **the Plan usage panel now has an
explicit three-state machine**, where it previously conflated two of them.

| State | Condition | Rendered |
|---|---|---|
| Loading | `!_usageData && !_usageFetchFailed` | `planUsageLoading` + `data-acn-usage-state="loading"` |
| Unavailable | `!_usageData && _usageFetchFailed` | `usageUnavailable` + `data-acn-usage-state="unavailable"` |
| Rendered | `_usageData` | the bars; no placeholder, no state attribute |

`fetchClaudeUsage` has exactly **one** caller (`maybeRefreshUsage`), reached from two entry
points — `orbPopulateNavigate:5838` and the SSE debounce at `:4758`. That single-caller property
is what makes the flag invariant hold, so preserve it: a second caller that does not clear the
flag and take a generation token would reintroduce every race below.

**Supersession is ASYMMETRIC.** A late response's *emptiness* is stale; its *content* never is,
because usage is org-scoped and every request reaching the callback is for the same org. The rule
took three attempts under review, and each wrong form is now gated by its own check:

| Superseded response | Action | Wrong form → check that catches it |
|---|---|---|
| Empty | **drop** | no guard at all → **U8** |
| Carries data, no NEWER generation produced data | **use it** | drop-everything → **U9** |
| Carries data, a newer generation already produced data | **drop** | `_usageData` truthiness → **U10** |

"Newer generation produced data" is `_usageDataSeq`, **not** `_usageData` truthiness:
`ciInvalidate()` zeroes the cooldown but leaves `_usageData` populated, so for a multi-org user
truthiness can be satisfied by a previous org's bars.

**Known residual, deliberately not fixed here:** `ciInvalidate()` does not clear `_usageData`, so
on switching to a different org's chat the panel keeps showing the previous org's quota until a
fetch returns. Predates all of this. Clearing it would make the panel flash to "loading" on every
conversation switch — a visible behaviour change that needs its own live check, so it is recorded
rather than folded in.

---

## D. Key principles established

- **A dead key is not automatically a preference.** Check whether the surface behaves correctly
  *without* it before filing it as one. Applying that check turned one filed-as-preference key
  into a shipped bug fix (DEC-044).
- **When two docs assert incompatible contracts, the bug and the remedy are separate questions.**
  The usage bug held under either design, so it did not wait on the contract question; the remedy
  did, and went to the owner rather than being picked silently.
- **A check that cannot fail is not a gate — so mutation-test each fix separately.** And report
  the result as measured: one of the three fixes here turned out **not** to be gated, and saying
  so is more useful than a tidy table.
- **Name the members; do not tally them (DEC-043).** Demonstrated the hard way this session: the
  one transcribed tally in the repo was stale within two days, in the paragraph forbidding it.
- **A stopping rule evaluated after seeing the results is not a stopping rule (DEC-043).**
- **Check that the fixture did the thing before believing what it says about the code.**
  `requests=0` looked like a code failure and was a scenario failure.
- **A flaky check is worse than no check.** The probe passed 12 consecutive runs before failing
  once under load. Reproduce the flake, fix the cause, then re-verify under the same load —
  don't re-run until green.

---

## E. Git state

`main` @ **`fac7d50`**. Working branch **`docs/session-record-pr72`** → **PR #73, OPEN, CI 9/9,
Codex clean, MERGEABLE — not merged.**

| Commit | What |
|---|---|
| `77d8f35` | the PR #72 session record: §B.7, DEC-043, reviews/…-i18n-docs.md, 4 stale claims |
| `67f866d` | **v12.8** — the usage fix, DEC-044, new probe, CI wiring, CHANGELOG/ROADMAP/spec updates |
| `d83191b` | Codex round 1: HANDOFF transcribed the one tally it told you not to |
| `e49131a` | baton handoff: archived the v12.7 doc, added the v12.8 TROUBLESHOOTING entry, fixed two stale OPEN headlines |
| `1c0a050` | Codex P1: the retry probe closed the panel it needed open |
| `e3effc5` | Codex P2: force a scan after the route change instead of hoping for one |
| `5eee8ac` | Codex P2: supersession is asymmetric — keep a superseded SUCCESS (U9) |
| `5dbce77` | Codex P2: "newer data landed" is a generation, not truthiness (U10) |

Merged earlier in this arc: #70 → `06a079f`, #71 → `980aa68`, #72 → `fac7d50`.

**Merge strategy is merge commits** — `gh pr merge --squash` fails outright on this repo.

**A git-config trap, fixed and worth remembering:** the repo had accumulated per-branch
`remote.origin.fetch` refspecs pointing at merged-and-deleted branches, so `git pull` failed with
`couldn't find remote ref`. Restored to the standard `+refs/heads/*:refs/remotes/origin/*`. If
`git pull` fails that way again, check `git config --get-all remote.origin.fetch` first.

**Five local branches have gone remotes.** Three are fully merged; two
(`fix/firefox-fetch-skip`, `fix/tokenizer-korean-v12.7`) report UNMERGED because their content
reached main via merge commits while the branch tips are not ancestors — `git branch -d` refuses
those. All five left in place rather than force-deleted.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `docs/handoffs/SESSION_HANDOFF_2026-08-02_v12.7-korean-tokenizer.md` | the predecessor — all v12.7/v12.7a/PR-#72 detail |
| `DECISIONS.md` **DEC-044** | the usage fix: why explicit, and the two ordering rules |
| `DECISIONS.md` **DEC-043** | name members not tallies; pre-commit the stopping criterion |
| `docs/PLAN-USAGE.md` → "Fetch fails" | the rewritten failure contract + the three-state table |
| `probes/check-usage-state.js` | 10 checks; the mutation matrix is in its header |
| `agent_docs/conventions.md` → i18n Conventions | the **one** tally the project keeps, and why |
| `ROADMAP.md` item **0c** | the three preference keys + the one remaining behaviour gap |
| `reviews/review-2026-08-05-usage-state.md` | the 3-tier pipeline record, incl. what is NOT gated |

---

## G. What comes next

1. **LIVE CONFIRM v12.8 — the gate on this release (DEC-031).** The only outstanding item on
   shipped code. Method is in the callout at the top of this file. Expect "Usage data
   unavailable"; a permanent "loading…" means the fix did not take in the real environment.
2. **`summaryLanguageNote` — needs an owner DECISION, not work** (ROADMAP 0c). Empty English
   value, Korean-only disclaimer, never rendered, and v12.7 made its text substantially untrue.
   Three options are written out in ROADMAP 0c. **Do not simply wire the current text** — it
   would tell a Korean user the Summary works poorly for them, which is now largely false.
3. **Three i18n keys are a QUESTION, not a work item** (ROADMAP 0c): `questionPrefix`,
   `noQuestions`, `noBookmarksToExport`. The owner reviewed Korean mode live and accepts partial
   English. Do **not** pick them up as a batch. If any is picked up it is per-string. And note
   what they actually cost — only `noBookmarksToExport` is a one-line substitution;
   `noQuestions`' live surface has a second guidance paragraph the key lacks, and
   `questionPrefix`'s English and Korean values are **both** `'Q#'`, so wiring it is a visible
   no-op.
4. **Key points are still unavailable in Korean** — `KEY_POINT_PATTERNS` is a set of English
   regexes, a mechanism no tokenizer change reaches (ROADMAP 0a). Needs its own pattern set and
   its own measurement.
5. **The top level's merge rule — THEORETICAL, not scheduled** (ROADMAP item 0). The evidence
   once cited for it was a misreading and is retracted. Do not open it on that evidence.
6. **Carried-over fixture batch** — unmatchable-cluster/HEAD, assistant-TAIL, GM-shim backoff
   (incl. malformed JSON), exportBookmarks, forced-refetch knob, provisional-turn knob,
   key-point payload knob — plus toolBlocks into the unmounted inventory, the renderable-predicate
   off-by-2, and `renderSummaryResults` try/finally.
7. **Backlog unchanged behind those** — Retry-After 429, §4.2 offset-cache reassessment, peek
   pane, mock-fidelity generator, debulking; Emergent deprioritized.

---

## H. Operational context + owner rules

- **Merge authority is per-PR and explicit.** Nothing in this document authorizes a merge.
  **PR #73 is explicitly authorized by the owner to merge after this handoff lands** — that is
  the one standing exception, and it expires with this PR.
- **DEC-031 gates live-code merges on a live confirmation.** v12.8 ships with that confirmation
  still owed (§G.1) — the owner accepted merging first and confirming after, for this PR.
- **The owner chose EXPLICIT over silent** for the usage failure UI (DEC-044). Recorded because
  the metric-neutral option was the spec's existing answer, and it was overruled deliberately.
- **Correctness outranks further optimization** (standing). ROADMAP item 11 is closed at ~1.2s;
  only a conversation large enough to put the freeze banner back should reopen it.
- **Partial English in Korean mode is accepted** — *"some things are actually better to stay in
  english than force translation to korean when they can understand some english… i am fine with
  how the korean mode looks."* Do not mass-translate to drive the dead-key audit to zero.
- **Stop review loops on provenance** (DEC-029), **and pre-commit the criterion before the round
  runs** (DEC-043). Standing exception: a finding that *weakens the evidence for the shipped
  change* earns another round.
- **Before re-triggering Codex, check whether it came back clean or is still checking** — owner
  instruction, 2026-08-02. Do not re-trigger reflexively.
- **Execute-and-narrate.** Explicit `git add` paths, never `-A`; commit before mutating; suite
  both engines before push.
- The owner tests on **Firefox + Tampermonkey**; probe builds are per-measured-build (DEC-027).

---

## I. Deferred / future work

§G items **2 and 4–7** — the `summaryLanguageNote` decision, key points in Korean, the
theoretical top-level merge rule, the carried-over fixture batch, and the backlog behind them.
The `overflow-anchor: none` mock assumption remains unverified (carried).

**§G item 1 is not deferred work — it is a gate on work already shipped.** The live confirm of
v12.8 should happen at the next opportunity, not be queued behind the backlog.

**§G item 3 is deliberately NOT in this rollup.** The three unwired i18n keys are an owner
PREFERENCE, not deferred work. Listing them here would put them back in the schedulable pile,
which is the exact reading two sessions have now corrected. If they are ever picked up it is
per-string, by the owner's judgement, not as a batch.

**Not gated by any check, and therefore easy to regress:** the repaint-on-fetch-start in
`maybeRefreshUsage`. It rests on the early return at `:5800` preceding the `maybeRefreshUsage()`
call. If that ordering changes, the fix silently stops mattering and nothing will fail.

---

## J. Risk caveats / known limitations

- **v12.8 is NOT live-confirmed.** No mock reproduces a real 5xx from claude.ai; the probe
  simulates the transport. A green suite is a context-scoped finding (CLAUDE.md).
- **The repaint fix is ungated** (see §I). Recorded rather than papered over — two earlier drafts
  of the review record claimed a check covered it, and both were wrong.
- **A failed poll now clears previously-good bars.** `_usageData = data` sets null on failure, so
  a transient failure replaces real numbers with "Usage data unavailable". Both the old and new
  behaviour lose the bars; the new one is at least honest about why. Deliberate, not an oversight.
- **A language switch leaves Tools mixed until refresh** — owner-accepted (DEC-042); the
  `languageChanged` toast says "refresh to apply". Do not "fix" without reopening that decision.
- **Three i18n keys render English in Korean mode** — accepted by the owner, not merely deferred.
- **`summaryLanguageNote` has never rendered** while `docs/SETTINGS.md` says it does, and v12.7
  made its text substantially untrue. Open, and blocked on a decision rather than on work.
- **Most toasts are hardcoded English** — export progress/success, "Summary exported", "All
  bookmarks cleared" and others. Not a decision anyone made; simply unwired. **Deliberately not
  stated as a ratio** — every tally written during PR #72 was wrong at least once. Name the
  surfaces; re-derive numbers with the audit in `agent_docs/conventions.md` when you need them.
- **Fixed for English and Korean only — this is NOT "Unicode support".** Japanese and Chinese are
  not space-separated; `check-tokenizer.js` T8 pins that limit as an assertion.
- **The Korean payload is generated, not real** — modelled particles, but vocabulary-driven word
  salad. A real Korean conversation mixes English technical terms far more heavily.
- **webkit-on-macos has two documented failure variants** (DEC-036 + the silent wedge in
  TESTING.md). Requeue-once clears the first; the second cleared itself after ~65 minutes.

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md
(2026-08-05 — "v12.8: the usage panel stopped lying, and the session record caught up").

Read it before touching anything, especially §G (what comes next), §H (owner rules)
and §J (risk caveats). Its predecessor, with all v12.7/v12.7a/PR-#72 detail, is
docs/handoffs/SESSION_HANDOFF_2026-08-02_v12.7-korean-tokenizer.md.

FIRST, CHECK STATE — do not assume:
  gh pr view 73 --json state,mergedAt    # was #73 merged?
  git log --oneline -3 main
If #73 merged, main carries v12.8. If not, it is still open and CI-green at d83191b.

PRIORITY 1 — the live confirm of v12.8 (DEC-031), the only gate outstanding on
shipped code. Open Claude with the Navigate panel showing Plan usage, break the
usage request (log out in another tab, or block claude.ai/api/organizations/*/usage
in devtools), reopen the panel. Expect "Usage data unavailable" — a permanent
"Plan usage loading…" means the fix did not take in the real environment.
Ask me to run this; I test on Firefox + Tampermonkey.

THEN, ask me which of §G 2–7 to pick up. Do not start work until I confirm.

DO NOT:
- Mass-translate the three unwired i18n keys to drive the dead-key audit to zero.
  Partial English in Korean mode is my accepted position, not a defect backlog.
- Wire summaryLanguageNote with its current text. It needs my decision first;
  ROADMAP 0c has the three options.
- Add coverage tallies to any doc. Name the surfaces instead. The one tally the
  project keeps is the dead-key baseline in agent_docs/conventions.md, and even
  that one went stale within two days last session (DEC-043).
- Reopen ROADMAP item 11 (performance). Closed by my decision; correctness
  outranks further optimization.
- Reopen the top-level merge rule on the old evidence — it was a misreading and
  is retracted.
- Re-trigger a Codex review without first checking whether it came back clean or
  is still checking.

RULES: execute-and-narrate. Merge authority is per-PR and explicit — nothing in the
handoff authorizes a merge. Explicit `git add` paths, never -A. Suite both engines
before push. If a fix is not gated by a check that can fail, say so plainly rather
than implying coverage.
```
