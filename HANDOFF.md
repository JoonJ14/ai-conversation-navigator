# Session Handoff — 2026-07-31 (v12.4: the Summary freeze measured, killed, and live-confirmed twice)

**Scope:** one continuous arc across two calendar days: measure the Summary freeze (PR #65),
build the v12.4 fix (PR #66), run the full local review pipeline plus five GitHub Codex rounds
on it, and live-confirm it twice — the second time specifically for a post-confirmation
one-liner. #64 (predecessor handoff docs) and #65 were merged mid-session with the owner's
per-PR authorization; **#66 merges at the close of this session** with these handoff docs
aboard. **Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-07-30_v12.2-v12.3-dead-zone.md`.
**Status at close:** version **12.4**, suite **528/528 both engines**, CI 9/9 on every head,
Codex clean, DEC-031 satisfied on the exact merge candidate.

---

## A. State in one paragraph

The "this page is slowing down Firefox" freeze on the owner's ~147-question conversation is
dead, and it died the right way: measured first (probes/, PR #65 — the quadratic was
`_sumDeduplicatePoints` doing O(points²) pairwise overlaps with per-pair re-tokenization
*ahead of* a ≤10 cap, 9.1s of an 11.5s block at ~1MB text; the export then paid the whole
analysis again), then fixed with the two smallest possible changes (early-stop at the cap —
output-identical, byte-diffed; and a compute cache keyed `{ciIndexStamp(), provisional-set
signature}` that only the export reads), then verified at every layer: 528/528 both engines,
a five-mutant battery, a 5-lens + 2-skeptic opus Tier 3 round (19 findings, 0 false
positives, 1 CRITICAL), five GitHub Codex rounds (5 findings, 0 false positives, all in
arc-written code, zero in the v12.4 core), and two owner live confirmations — the second
observing the round-5 cache release directly (`cached=null` after a g2→g4 rebuild). The
honest residual, measured live: generate still costs ~7.7–8.8s (banner-free) and ~93% of it
is the conversation-map's segment-merge churn — **that is the next arc**.

---

## B. What was accomplished

### 1. Measurement arc (PR #65, merged) — the freeze mechanism found before any fix

**What.** New `probes/` tooling: `perf-instrument.js` (wraps the Summary pipeline's functions
by reassignment at one insertion anchor — no function bodies edited), `build-perf-probe.js`
(emits an installable instrumented build, git-ignored), `perf-payload.js` (deterministic
paragraph-scale conversation generator; the committed fixture's ~70-char messages measure
the wrong environment), `run-perf-harness.js` (Playwright: generate → regenerate → export).

**Why.** The owner's version policy demanded measurement before any fix (small fix → v12.4;
refactor → v13). The prior session's hypotheses (export double-run; synchronous block) were
code-read, not measured.

**Findings (synthetic contexts, Chromium 145 + Firefox 146, headless AND headed identical,
q=25..200 + a PARA_BOOST=3/KP_RATE=2 sensitivity run).** `_sumDeduplicatePoints` was the
quadratic: candidates grow linearly (q=147 → 673; owner's real conversation → 1,135), pairs
quadratically, every pair re-tokenized both texts, and only then did `.slice(0, cap≤10)`
apply — at ~1MB text: 3,504 candidates → 838k overlap calls → 1.68M tokenizations → 202M
chars → **9.1s of an 11.5s Firefox block**, with the export paying it all again (run#3 ≈
run#2 at every size). Render ≤50ms — the freeze was analysis, not DOM.

**Verification.** The double-run confirmed numerically, both engines; the boosted-scale
export recompute anomaly chased to a measured cause (`cached g1` vs `current g2` — a second
index build re-minting the generation mid-run) rather than guessed.

### 2. v12.4 (PR #66) — two smallest-possible changes

**What.** (a) `_sumDeduplicatePoints(points, cap)` stops scanning once `cap` unique points
are kept. (b) `generateFullSummary` caches `{stamp, provSig, data}`; `getSummaryForExport`
reuses on exact match (stamp non-null); the panel path NEVER reads the cache. Plus the
`data-acn-sum-computes` zone attribute (counts completed computations — the test observable)
and version 12.3 → 12.4.

**Why output-identity holds for (a).** The dedup is streaming and append-only: each keep/drop
decision reads only already-kept points, so the first `cap` appends are determined by an
input prefix — `dedup(all).slice(0,cap)` ≡ stop-at-cap. Proven by argument AND an empirical
byte-diff of exported files on a key-point-rich payload (scope-annotated: the diff exercises
the text-derivation branch only).

**Why the cache key is what it is.** `ciIndexStamp()` (conversation-id + monotonic index
generation) covers everything the index knows; `provSig` covers the one thing it doesn't —
provisional turns, which can change under a frozen stamp. provSig went through a
three-rung correctness ladder (see §B.4) and ended as **raw text with length-prefix framing**
(`len:text`) — injective, no normalization, no delimiter to forge. The cache is RELEASED at
both points where the key dies: `ciInvalidate()` (conversation switch) and `ciBuildIndex()`'s
commit (same-conversation rebuild — the round-5 finding); null-stamp computations are never
cached at all.

**Measured effect** (before → after, same machine/payload/interactions): boosted generate
11.7s → **2.4s**; keyPoints 9.0s → **0.05s**; export full-re-run → reuse. Live (owner):
generate 8.5s with **no banner**, dedup **1ms**, export **HIT at 3–11ms**.

### 3. The local review arc — Tier 1/2 inline + Tier 3 (opus, 5 lenses + 2 skeptics)

**19 findings, 0 false positives, 1 CRITICAL** (artifact:
`reviews/review-2026-07-31-v12.4-perf.md`). The ones that changed the shipped code:

- **CRITICAL (test-integrity lens, who ran its own mutants):** S5 as first written proved
  *export→export* reuse, not *panel→export* — E3's recompute had refreshed the cache, so a
  build whose panel computations left nothing reusable (the exact scenario the fix exists
  for) stayed green. Fixed by running S5's regenerate leg FIRST; the leg order is
  load-bearing and mutation-proven. **In-loop lesson, on the record:** the reorder was
  documented in three docs before it had actually been applied, and the post-commit mutant
  battery caught the gap — run the mutants even when the fix "obviously" landed (DEC-038).
- The cache KEY had no killing mutation (a bare `if (_sumComputeCache)` shipped green) →
  the E3 computes-delta gate (+1 across the post-switch export). After the retention fix,
  the key check and the invalidate release became REDUNDANT defenses — the honest killing
  mutation is their compound failure, measured red exactly there.
- The qLen guard was replaced by provSig after a skeptic proved count-membership swaps are a
  *steady state* under retained-degrade stamp freezes (one 429 → up to 30 min frozen), and
  the skeptic's fix (content identity) strictly dominated mine (refuse-on-any-provisional).
- Cache retention: released in `ciInvalidate`; never written with a null stamp (13 platforms
  + degraded sessions would pin an unreadable copy of the conversation).
- S5 settle guards (4 of 5 lenses): an index reload mid-block re-mints the stamp and turns a
  correct refusal into a spurious red in the one assertion measuring the *absence* of work.
- The probes/README live procedure would have halted the owner at the DEC-027 identity guard
  against the fix build (expected `v12.3`; promised a run#3 the cache-hit removes) — fixed
  to be version-explicit and to document the healthy no-run#3 outcome.
- Mount-window snapshot (entities/inventory freeze at generate-time on a hit): skeptic-
  bounded (≤7% of messages; entities describe only the ~3-5 mounted turns in EITHER build),
  judged *better* than v12.3 on the only user-visible axis (exported counts match the open
  panel exactly — same object), accepted + documented rather than keyed-on-mount.

### 4. Five GitHub Codex rounds — 5 findings, 0 false positives, all in arc-written code

Round 1: provSig's 200-char truncation (the `_sumElKey` lesson recurring) + the probe's
recompute tag-vs-delta mis-attribution. Round 2: normalization collisions (`array[x]` vs
`arrayx`) → raw text. Round 3: **explicit clean**. Round 4 (drawn by a docs push; owner
dispositioned as minor, fixed anyway): probe JSON lost cache-hit export totals; U+0001
delimiter forgery → length-prefix framing. Round 5 (post-live-confirm, owner authorized +
re-confirmed): release the cache at `ciBuildIndex`'s commit — a same-conversation rebuild
made the cache permanently unreadable without releasing it. **The identity-key ladder
(truncation → lossy normalization → delimiter ambiguity) is DEC-038's core lesson.**
Zero findings ever landed in the v12.4 core or anything Tier 3 had passed — the v12.3
pattern (local Tier 3 pre-empts the loop on frozen code) held.

### 5. Two live confirmations (owner, Firefox + Tampermonkey, GM-sandbox, visible tab)

**First** (pre-round-5 build): banner gone; dedup 1ms over 1,135 candidates; export HIT
11ms; an inadvertent same-day v12.3 control run (owner had been testing 12.3 believing it
was 12.4) made the contrast unambiguous. **Second** (round-5 head `ce26aa6`, full 7-point
checklist): HIT at 3ms; after a live send the index rebuilt g2→g4 and the export line read
**`cached=null`** — the round-5 release observed directly; one recompute (8.2s) and a
correct file; jumps landed (row 0 direct; row 178 via 3 bridge iterations). Also observed,
pre-existing: the renderable-entry predicate off-by-2 diagnostic (predicted 294 vs
aria-setsize 296) with its measured-anchor fallback holding.

**The honest residual, measured live twice:** generate 7.7–8.8s, ~93% in `phase.map` —
**431 `_sumBuildSubSegments` rebuilds and 3,895 `_sumExtractTopicsFromText` extractions over
27.1M chars in ONE generate** (`_sumMergeExcessSegments` alone 5.2–6.0s). The synthetic
payload's topic-block structure produces few segments and structurally underrepresents this.

---

## C. Architecture snapshot

Unchanged except: **the Summary compute cache** (`_sumComputeCache` + `_sumProvSig` +
`data-acn-sum-computes`; design + invariants in DEC-038) and **`probes/`** as a permanent
measurement surface (instrumented-build generator + payload generator + Playwright runner;
build artifacts and results git-ignored; owner's installable copy lives on the Desktop as
`probeE-summary-perf-v12.4.user.js` and must be REBUILT whenever a different build is being
measured — DEC-027's wrong-build trap fired once this session and was caught by the
identity line).

---

## D. Key principles established

- **Identity keys must be lossless** (DEC-038): truncation, case/whitespace folding,
  markdown flattening, and bare delimiters each traded a harmless false-miss for a harmful
  false-hit, found across three separate review rounds. Length-prefix framing ends the
  ladder. Corollary: a cache must be *released* wherever its key dies, or it is a pinned
  copy wearing a cache's name.
- **A redundant defense changes the killing mutation** (DEC-038): after the invalidate
  release landed, the bare-key mutant was absorbed — the gate's honest mutation became the
  compound. Re-derive killing mutations after every fix that adds a second defense.
- **Documenting a fix is not applying it**: the S5 reorder existed in three docs before it
  existed in the harness; only the mutant battery noticed. DEC-037's class, self-inflicted
  mid-review, caught by running mutants against the commit.
- **The probe identifies itself or the measurement is void**: build tag + version + realm +
  granularity in the first console line; the owner's wrong-build run was caught by its
  absence.
- **Owner process update:** plan-first was explicitly relaxed to *execute-and-narrate*
  ("I am okay with you just executing, as long as you tell me"); merge delegation is per-PR
  and explicit; DEC-029's diminishing-returns stop was exercised by the owner mid-cycle
  ("if they're pretty minor, no need for the next round").

---

## E. Git state

`main` @ `3a1ef00` pre-merge (v12.3 + probes + docs). **PR #66 (`fix/summary-perf-v12.4`)
carries v12.4 and merges at the close of this session** — CI 9/9 on every head including the
final one, Codex clean, DEC-031 satisfied twice (the merge candidate's userscript is the
byte content the owner re-confirmed; commits after `ce26aa6` are docs-only). #61–#65 all
merged. After the merge, `main` serves v12.4 and the owner's raw `main` link is current.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `reviews/review-2026-07-31-v12.4-perf.md` | the full review arc: Tier 1/2/3, 5 Codex rounds, both live confirmations |
| `TROUBLESHOOTING.md` → Summary-freeze entry | the complete measurement record: synthetic + live, before + after, both contexts |
| `DECISIONS.md` DEC-038 | the compute-cache design + identity-key rules |
| `ROADMAP.md` item 11 | the residual map-churn lever with live numbers |
| `TESTING.md` → Summary/Export fixtures | S5/E3 gate semantics + the recorded debts |
| `probes/README.md` | both measurement paths; Path A is the live procedure |

---

## G. What comes next

1. **The map's segment-merge churn** (ROADMAP item 11 residual — v12.5-vs-v13 is the owner's
   call). Live: 431 sub-segment rebuilds + 3,895 topic extractions over 27.1M chars per
   generate; `mergeExcess` alone 5.2–6.0s. Specific questions queued: (a) how many initial
   segments does the live conversation produce pre-merge (instrument the segment count — one
   probe counter)? (b) does per-message token memoization preserve output exactly? The known
   edge: `tokenize(join(a,b)) ≠ union(tokenize(a),tokenize(b))` when an unterminated code
   fence spans a join — measure whether that occurs in practice before choosing the lever.
   (c) is the win sufficient without restructuring the merge loops (O(S²)-flavored
   agglomerative pass)? Target: generate under ~2s live.
2. **Carried-over fixture batch, now grown:** unmatchable-cluster/HEAD, assistant-TAIL,
   GM-shim backoff (incl. malformed JSON), exportBookmarks (failure mode is toast now) — plus
   this session's additions: a **forced-refetch shim knob** (gates the ungated
   same-conversation stamp-bump refusal), a **provisional-turn knob** (stages the provSig
   half of the cache key), a key-point-bearing payload knob (the dedup early-stop has no
   fixture that could catch a wrong result — currently equivalence-argument + byte-diff).
3. **Smaller recorded items:** thread the index's existing `toolBlocks` extraction into the
   summary's unmounted inventory branch (shrinks the mount-window divergence at its source);
   the renderable-entry predicate off-by-2 (live-observed, fallback holding — revisit the
   stop_reason predicate when touching that area); `renderSummaryResults` throw strands the
   generate button (pre-existing, one try/finally away).
4. **Backlog unchanged behind those** (Retry-After 429, §4.2 offset-cache reassessment, peek
   pane, mock-fidelity generator, debulking, Emergent deprioritized, Gemini re-chain closed).

---

## H. Operational context + owner rules (standing + this session)

- **Execute-and-narrate** replaces plan-first (owner, this session): act autonomously,
  report every significant action clearly. Formal gates unchanged: DEC-031 (live-code
  merges need live confirmation of the exact head — exercised TWICE this session, including
  for a one-line memory-only change), owner merge authority unless explicitly delegated
  per-PR (as with #64/#65/#66).
- **Review-cycle stop is the owner's, on provenance** (DEC-029, exercised live): when
  remaining findings are minor and loop-era, fix cheap ones without triggering another
  round.
- The owner tests on **Firefox + Tampermonkey**; probe builds must be regenerated per
  measured build and live on the Desktop (`probeE-…`); the raw `main` link serves the
  installed script post-merge.
- Explicit `git add` paths, never `-A`; commit-before-mutating; suite before push.

## I. Deferred / future work

All of §G items 2–4 (each self-contained in ROADMAP/TESTING). Stage-2 legacy-bookmark sweep
unchanged. The `overflow-anchor: none` mock assumption remains unverified (carried).

## J. Risk caveats / known limitations

- **Mount-window snapshot on cache hits** (documented, accepted): a cache-hit export carries
  generate-time entities/inventory — identical to what the open panel shows, but not the
  export-time window. Bounded ≤7% of messages; pre-existing in mechanism (tool/artifact
  answers render more than their API text). `toolBlocks` threading shrinks it (§G.3).
- **The same-conversation stamp-bump refusal is ungated** in the harness (needs the
  forced-refetch knob) and **provSig is unstaged** (needs the provisional knob) — both
  behaviors verified live instead this session (`cached=null` at g2→g4; provSig.len visible
  in the cache line), but live verification is per-run, not regression protection.
- **The byte-identical export diff is text-branch-scoped** — it cannot see mount-window
  divergence (mock renders no pre/img/a; no scroll between generate and export). Recorded
  in TESTING.md; do not re-cite it as a general equivalence proof.
- **webkit-on-macos runner episodes** (DEC-036) had ZERO occurrences across ~6 CI runs this
  session — the healthy signature throughout; the requeue-once procedure remains armed.

---

## K. Kickoff prompt for the next session

(maintained in the final summary of the baton-handoff run; paste-ready copy lives there)
