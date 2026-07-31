# Session Handoff — 2026-07-30 (v12.2 + v12.3: Gemini labels, CI hardening, the dead zone closed)

**Scope:** one long session, three merged PRs: **#61** (v12.2 — Gemini's hidden `cdk-visually-hidden`
sender labels stripped), **#62** (CI hardening against degraded macOS runners), **#63** (v12.3 —
the Summary/Export zero-execution zone finally has fixtures, after a review arc that found two
CRITICALs in the fixtures' own first version). One **new open problem** was found live and is the
next session's likely priority: Summary generation/export freezes Firefox on long conversations.
**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-07-29_v12.1-legacy-bookmarks.md`.
**Status:** all three PRs MERGED by the owner; `main` @ `99b950b`, version **12.3**, CI 9/9.
v12.3 live-confirmed at `6e24eea` (code head `3ef6239`) — see §E.

---

## A. State in one paragraph

v12.3 is on main and live-confirmed: the Summary/Export/Tools surfaces that shipped through v12.0's
24-round review loop with **zero test execution** (mutation-proven: all four core functions replaced
with `throw` left the suite green at 516/516) now have nine mutant-gated assertions plus a FIXTURE
PRESENCE check, and the full matrix is **1050/1050 on both engines**. Getting there took a
three-round local review arc that caught the fixtures' own defects — including an E2 block that was
structurally unreachable while three docs claimed it as coverage, and a harness charset bug that had
been silently mangling every literal non-ASCII character in the injected userscript for a release.
The GitHub Codex cycle then needed **zero fix rounds** (v12.0 needed 24, v12.1 needed 7) — the
first data point for the Tier 3 backend experiment, and a strong one. Separately: Gemini grew hidden
"You said"/"Gemini said" labels that leaked into every text surface (fixed, v12.2), five degraded
macOS-runner episodes hit CI in one day (hardened, #62), and the owner's live test surfaced a real
performance problem in Summary that has probably existed since v12.0.

---

## B. What was accomplished

### 1. v12.2 (PR #61, merged) — Gemini's hidden sender labels stripped

**What.** `_isSrOnlyClassList` now also matches `cdk-visually-hidden`; `_cleanText`'s fast-path
selector gained the class. Gemini mock rebuilt to the measured live DOM (label spans, restructured
AI turns). New opt-in `expectedFirstQuestion` suite assertion.

**Why.** The owner saw every Navigate row on Gemini prefixed *"You said"*. Live probe found
`span.cdk-visually-hidden.screen-reader-user-query-label` as the **first child of
`div.query-text`** — inside the primary selector target — plus a mirror `h2` "Gemini said" on the
assistant side. Our hidden-label strip only knew `sr-only` (ChatGPT/Claude's idiom); Angular CDK's
idiom sailed through into Navigate, Search, Export, Summary, and bookmark hash inputs.

**Alternatives.** Re-chaining the AI selector to dodge the assistant label was considered and
**closed by measurement** instead: all 12 live conversations on the test account have text-empty
response footers, so the fallback's only over-capture is the label the strip now removes — no
assertion grounded in measured data could distinguish the selectors (DEC-032: unprovable change).
Re-opens if a text-bearing footer (e.g. search-grounded sources-list) is ever observed.

**Verification.** Mock+assertion first, red on parent code with the exact live symptom
(`"You saidHow do neural networks learn?"`), green with the fix, mutation-verified both paths
(slow-path regex red; fast-path recorded as test debt — proving it would race icon injection).
Bookmark ripple handled by existing `_bmLegacyIdSet`/`_textAsLegacy` machinery — leak-era hashes
keep matching. Live-confirmed by the owner; merged same day.

**Also measured (live, Chromium, owner's account, 2026-07-30):** Gemini does **not** recycle at
n≤10 (all turns mounted at every scroll position, held refs stay connected) — the long-contested
DOM-REFERENCE table row is resolved at that scale, open beyond it (`<infinite-scroller>` scroller).
And `div.model-response-text` no longer exists on live Gemini (class moved to a
`structured-content-container` element); the chain survives on `.response-content`. Both recorded
in DOM-REFERENCE with contexts.

### 2. PR #62 (merged) — CI hardened against degraded macOS runners

**What.** `timeout-minutes: 20` on the CI job; per-entry wall-clock in suite output (live and in
the detailed report); `vis=`/`raf10=` forensics on failed acceptance jumps; the reading-the-signature
procedure in TESTING.md + agent_docs/testing.md.

**Why.** **Five** webkit-on-macos episodes in one day: jobs running 40–75+ minutes (healthy:
5m41s–9m47s) with acceptance jumps failing at the product's give-up ceiling, on code that passed
identically minutes before/after on fresh runners. Same image, same Playwright build — degraded
shared-runner hosts. One red had already slipped onto main unnoticed at the #60 merge.

**Verification.** The hardening proved itself in-flight twice: episodes 4 and 5 hit PRs #62 and
#63's own CI, self-terminated at ~20m, and the per-entry timings decomposed them from the log alone
(healthy 6–28s entries degrading to 720s on a 13-second entry). Requeue-once recovered green every
time. Codex found one real P2 in the PR (jump duration captured after the rAF probe — the
instrument polluting its own measurement); fixed and verified by the probe-cost delta.

### 3. v12.3 (PR #63, merged) — the Summary/Export dead zone closed

**What.** Contract attributes (`sum-generate`, `sum-results`, `sum-stats`+counts,
`sum-segment`+span, `tool-export`+id, `toast`); an in-page download-capture shim (gated, revoke-
mirrored); UTF-8 charset on harness pages; a `__convLastUuid` observable in the GM shim; nine
mutant-gated assertions (S1–S4, E1–E3 + regenerate + uuid-observed switch); the FIXTURE PRESENCE
check; two small live-code fixes (`tool.action()` failure toast; `exportSummary` range label
`msgs X–Y`). Suite 516→**525 assertions/engine**, 1050/1050 both engines.

**Why.** DEC-029's exit condition — "fixture the untested surface first in the next version" —
was this batch. The baseline was re-proven on the parent commit: all four functions
(`_sumBuildTimeline`, `_sumScrollToElement`, `_exportFromIndex`, `ciIndexStamp`) throwing
simultaneously, suite green.

**The review arc is the story** (full artifact: `reviews/review-2026-07-30-0a63780.md`). Local
Tier 1/2, then two Tier 3 opus rounds (5 lenses + 3 validation lenses), 29 verified findings,
**zero false positives**:

- **Round 1, CRITICAL ×2, both in the fixtures' own first version:** E2 (the degraded-export test)
  was nested inside `if (platform.indexBacked)` while its only entry is deliberately NOT
  index-backed — unreachable, green, and claimed as coverage in three docs. And the harness served
  test pages with no charset, so the browser decoded the inlined userscript as windows-1252 and
  every literal non-ASCII character was mojibake in-page — invisible for a release because \uXXXX
  escapes are unaffected, surfaced only because E2 would have been the first assertion to compare
  one. Also round 1: a readiness probe polling an attribute on the wrong element (0ms no-op — the
  contract doc's "On zone" row was wrong and got made load-bearing), an S4 conversation switch that
  measurably never happened (claude is `spa:false`; `__convFetches` stayed flat), and an `orbPanel`
  freeze that quietly stopped nav re-renders for downstream tests.
- **Round 2 (validation on the fixes): 12 findings, 100% loop-introduced** — including my
  replacement E2 check being *also* tautological (mutation-verified unfailable) and the fetch
  counter being uuid-blind (ablation-verified: deleting the restore entirely stayed green). Fixed
  with exact/observable forms: derived exact expectations, uuid-observed switch, post-regenerate
  single-render reads. **Stopped on provenance (DEC-029)** — the loop had flipped to reviewing
  its own edits.
- **GitHub Codex: 0 fix rounds.** Auto-review 👍 + explicit re-review "Didn't find any major
  issues" on the exact head. v12.0: 24 rounds; v12.1: 7. Recorded as the Tier 3 backend
  experiment's first decisive data point (opus backend fully pre-empted the downstream loop).

**Verification.** Every mutant re-verified individually against the committed state with clean
isolation; the new gates (regenerate, presence) mutation-verified themselves; 1050/1050 both
engines; live-confirmed 7/7 (§E).

### 4. NEW OPEN PROBLEM — Summary generate/export freezes Firefox on long conversations

**What was observed (live, Firefox + Tampermonkey, ~147-question conversation, v12.3, owner):**
clicking Summary→Generate, and Tools→Summary export, near-freezes the tab — Firefox shows its
"this page is slowing down Firefox" banner — then completes correctly. The owner reports this has
been **consistent since v12**, not new to v12.3.

**Known code facts (read, not yet measured):** (a) `exportSummary` → `getSummaryForExport()` →
`generateFullSummary()` runs the ENTIRE analysis fresh — no memoization, so panel-generate then
export pays full price twice; (b) the whole pipeline (segmentation word-overlap across the
timeline, topics, key points, entities, inventory) is one synchronous main-thread block; cost
scales with total characters, and real messages are paragraphs where the mock's are ~70 chars;
(c) v12.0 is when the summarizer started receiving the whole conversation instead of ~3 mounted
turns — consistent with "since v12".

**Owner's decision on scope:** measure first. If it's a small fix (e.g. memoize per index
generation, reuse the panel's summary for export, chunk the analysis) → **v12.4**. If it needs a
real refactor → **v13**. Do not start the refactor without the measurement.

### 5. Process findings that changed how this repo works (see §D)

Commit-before-mutating (learned twice, expensively), the FIXTURE PRESENCE class, the charset
lesson, and a corrected contract-doc row — details in §D and DECISIONS DEC-036/037.

---

## C. Architecture snapshot

Unchanged in structure from v12.1's handoff except:

- **Summary/Export/Tools are now inside the tested perimeter** (the fixtures above). Still outside
  it: `exportBookmarks()`, Tools gallery/commands, degraded-session summary paths (`_sumElKey`
  staleness branch, sub-segment + inventory click handlers), multi-segment segmentation — all
  recorded debt in the fixture comments and TESTING.md.
- **Harness capabilities grew:** download capture (page-realm scoped — cannot see sandbox-realm
  export breaks, DEC-019/020 split; live confirmation remains the only evidence for that realm),
  `__convLastUuid`, per-entry wall-clock, FIXTURE PRESENCE.
- `_isSrOnlyClassList` is the single hidden-label predicate (sr-only + cdk-visually-hidden),
  serving `_cleanText` AND the export walker.

---

## D. Key principles established

- **Commit before mutating.** `git checkout --` during mutation-verification restores HEAD and
  silently destroys uncommitted fixes. This bit TWICE in one session (invalidating a 4-mutant run
  the second time). The rule is now in commit history, DEC-037, and conventions.md.
- **Silent non-execution is a detectable failure class.** A fixture block that never runs is
  indistinguishable from passing — unless the harness declares expected assertion titles per
  opt-in flag and hard-fails on absence (FIXTURE PRESENCE, DEC-037). Scope limit: it catches
  condition-skips, not throw-aborts.
- **A replacement for a vacuous check can be vacuous in a new way.** Twice this session a
  tautological assertion was replaced with a differently-shaped tautology (section-count →
  parts-sum; segments>0 → segEndMax). The test is always: state the mutation that flips it red.
- **Every literal non-ASCII character in the harness was mojibake for a release.** No charset on
  the served page → windows-1252 decode. If an assertion on a literal non-ASCII string fails
  inexplicably, check `document.characterSet` first.
- **The doc row was wrong and became load-bearing.** `data-acn-index-status` lives on the nav
  banner, not the zone; the contract table said "On zone" and a readiness probe built on it was a
  0ms no-op. A doc claim used as a build spec is a measurement taken from a document.
- **Codex 👍-reaction = clean review with no text.** Silence + reaction is a PASS signal, not
  a pending review.
- **Runner-flake policy (DEC-036):** a webkit-macos job at 20m with per-entry timings degrading
  and no real assertion failure = sick host; requeue once; never loosen budgets for it.

---

## E. Git state

`main` @ `99b950b` (merge of #63), version **12.3**, CI 9/9. All of #61, #62, #63 merged by the
owner. No open PRs, nothing in flight (this handoff branch excepted).

### ✅ LIVE-CONFIRMED — `6e24eea`, 2026-07-30, owner, Firefox + Tampermonkey, ~147-question conversation

All seven checklist items passed: **(1)** real export download through the Tampermonkey sandbox —
the realm the harness structurally cannot test — with complete count, API source line, and
unmounted-message bodies present; **(2)** summary generated over the whole conversation;
**(3)** segment click paged the virtualizer to a far-away message (and mounted re-click direct);
**(4)** summary export with the corrected `msgs X–Y` labels; **(5)** bookmarks-only export;
**(6)** navigate jump exact; **(7)** bookmark click exact. The code head Codex passed twice
(`3ef6239`) is byte-identical to the confirmed build (`6e24eea` adds only a reviews/ paragraph).
The same test surfaced the §B.4 performance problem — a finding, not a failure of the gate.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `reviews/review-2026-07-30-0a63780.md` | the full two-round Tier 3 arc + backend experiment record |
| `TESTING.md` → "Summary/Export fixtures (v12.3)" | fixture semantics, gates, debts, charset lesson |
| `TESTING.md` → "CI: reading a webkit-on-macos failure or hang" | the runner-flake procedure |
| `DECISIONS.md` DEC-036, DEC-037 | this session's standing decisions |
| `TROUBLESHOOTING.md` → v12.x Summary performance entry (OPEN) | the freeze finding + measurement plan |
| `ROADMAP.md` backlog | re-ranked: perf first, carried-over fixtures second |
| `docs/handoffs/SESSION_HANDOFF_2026-07-29_v12.1-legacy-bookmarks.md` | predecessor |

---

## G. What comes next

1. **Measure the Summary performance problem, then decide v12.4 vs v13** (owner's framing).
   Specific questions queued: where does the time actually go on the live 147-question
   conversation (segmentation word-overlap? topics? entities? render?) — instrument the phases of
   `generateFullSummary` and measure in Firefox on the real conversation (visible tab; the usual
   context rules). Confirm the double-run (`exportSummary` re-running the full analysis) with
   numbers. Then: if memoize-per-index-generation + reuse-for-export + chunking gets it under the
   jank threshold → v12.4; if the pipeline needs restructuring → v13 planning.
2. **Carried-over fixture batch** (ROADMAP item 2 residue): localized unmatchable-cluster,
   unmatchable-HEAD, assistant-TAIL, GM-shim backoff classes incl. malformed JSON. Plus the
   recorded debts if cheap: exportBookmarks fixture (must assert toast/file, not pageerror — the
   new catch changed the failure mode), multi-segment summary fixture.
3. **Backlog unchanged behind those:** Retry-After for HTTP 429; §4.2 offset-cache reassessment
   (measure a live repeat jump — the existing datapoint is about precision, not speed); peek pane;
   mock-fidelity payload generator; debulking; Emergent (deprioritized by owner — "almost no one
   uses it"); Gemini re-chain re-opens only on a text-bearing footer observation.

---

## H. Operational context + owner rules (standing + this session)

- **Version policy for the perf work (owner, this session):** small fix → v12.4; full refactor →
  v13. Measure before choosing; don't start a refactor on a hypothesis.
- **Review-cycle policy (owner, this session):** run Codex cycles long while findings are
  substantive; stop at diminishing returns (nitpicks/minuscule edge cases) — the owner's phrasing
  of DEC-029's provenance rule. The owner wants all debugging done BEFORE their live test so they
  test once; fixes after a live test invalidate it (DEC-031).
- **Merge authority is the owner's alone**, gated on live confirmation of the exact final commit
  (DEC-031). Unchanged.
- The owner tests on **Firefox + Tampermonkey**; the DGX's Chromium is a different context (and
  has the userscript installed — strip `[data-acn-*]`/`acn-bm-icon` artifacts in any probe;
  binary is `chromium`, not `chromium-browser`).
- Explicit `git add` paths, never `-A`; review agents must work in scratchpad copies (violated
  again this session by a lens — caught and removed).
- **Commit before mutating** (new, hard rule — see §D).

## I. Deferred / future work

- All of §G items 2–3 (each entry self-contained in ROADMAP).
- exportBookmarks / gallery / commands / degraded-session summary paths / multi-segment
  segmentation: recorded test debt (fixture comments + TESTING.md).
- Stage-2 legacy-bookmark sweep (unchanged from v12.1: build only if a real user reports residual
  unmatched records).
- The `overflow-anchor: none` mock assumption remains unverified directly (carried).

## J. Risk caveats / known limitations

- **⚠ Summary/Export perf on long conversations (OPEN)** — §B.4. Features work; UX degrades
  severely on ~147-question conversations in Firefox. Priority 1 next session.
- **The download capture is page-realm scoped.** A sandbox-realm export break (DEC-019/020 class)
  is invisible to CI; the owner's live export test is the only evidence for that realm. It passed
  on 2026-07-30; re-arm this concern whenever export/Blob/anchor code changes.
- **S4's stale-guard fixture cannot distinguish a correct refusal from a false-positive refusal**
  (the shim serves identical payloads per uuid), and the stamp's conversation-id half is
  defense-in-depth no fixture isolates (generation counter is globally monotonic). Recorded in the
  fixture comments.
- **Rule C (bookmarks) still rests on an n=1 payload shape** (carried from v12.1); `summaries=`
  telemetry is the regression signal.
- **webkit-on-macos runner episodes will recur** — five in one day. The procedure (TESTING.md) is
  requeue-once; the 20-minute timeout caps the cost. Do not loosen budgets to make sick hosts green.

---

## K. Kickoff prompt for the next session

(maintained in the final summary of the baton-handoff run; paste-ready copy lives there)
