# Session Handoff — 2026-08-01 (v12.5 + v12.6: the map made fast, then made correct)

**Scope:** one arc in two halves. First the residual the last session measured and left behind —
the conversation map's segment-merge churn (v12.5, PR #67, **merged**). Then a defect the owner
found while live-confirming that fix: the map's second level was not reading the conversation at
all (v12.6, PR #68, **merges at the close of this session**). **Prior handoff:**
`docs/handoffs/SESSION_HANDOFF_2026-07-31_v12.4-summary-perf.md`.
**Status at close:** version **12.6**, suite **1058/1058 both engines**, CI 9/9, Codex clean
after six rounds, **both v12.5 and v12.6 live-confirmed** (v12.6 on 2026-08-02: "a lot more
healthy… chunks of about 10, 30, 60 messages… this is exactly how we do this").

---

## A. State in one paragraph

Summary generate went from 7.7–8.8s to ~1–2s live, and its conversation map went from decorative
to actually structural. v12.5 was pure removal: sub-segments were being rebuilt at every commit
and every merge while nothing during construction reads them — 431 rebuilds per generate to keep
at most five — so they are now attached once, to the segments that survive. Output-identical,
32/32 fingerprints. The owner live-confirmed it, and in the same pass noticed that every
sub-segment was exactly three messages with near-duplicate labels. That turned out to be a rule
that could never fire: the split test divided by `max(|A|,|B|)`, comparing one message against a
four-message window, so its ceiling was ~0.04 against a threshold of 0.42. Every message split;
the visible structure was the leftovers of a fragment-absorb pass. v12.6 replaces it with
lexical-cohesion valleys judged against each segment's own depth distribution. **The owner
rejected the first fix as "just picking another number" and was right** — measurements agreed,
and the redesign that followed is the substance of this session.

---

## B. What was accomplished

### 1. v12.5 — the map's segment-merge churn (PR #67, merged `eacb24a`)

**What.** `_sumAttachSubSegments`: segments carry `children: null` through construction, and
sub-segments are built once per surviving segment at both return points of
`_sumBuildConversationMap`.

**Why.** The live counts identified the mechanism without a new probe. Children were built at
every commit AND every merge, which makes the rebuild count an identity —
`2 × initialSegments − finalSegments` — reproduced exactly at every synthetic config
(11 = 2·8−5, 369 = 2·187−5, 521 = 2·263−5). The live 431 therefore meant **≈218 initial segments
from ~294 messages**: near-total fragmentation, every merge re-deriving sub-segments for a
segment about to be merged again.

**Alternatives.** Per-message token memoization (the lever this session inherited) would have made
throwaway work cheaper rather than removing it, and carried a real edge case
(`tokenize(join(a,b)) ≠ union` when an unterminated code fence spans a join) — it never had to be
resolved. Merge-loop restructuring (the v13 option) targets a term that is negligible once the
rebuilds are gone: `mergeExcess` fell from 3,238ms to ~1ms.

**Verification.** Map **7,803/7,585ms → 1,260/1,144ms** at the live-calibrated payload; rebuilds
521 → 5; characters tokenized 63.9M → 10.3M. Structural fingerprints identical across **32/32**
config/engine combinations. Live: generate and regenerate "really fast… roughly a second or two",
export fast and correct, no console errors.

**New tooling.** `probes/map-instrument.js` + `probes/run-map-harness.js` (per-config sweeps and a
fingerprint equivalence gate), and `perf-payload.js`'s `VOCAB_MULT`. **The fidelity finding worth
carrying:** segmentation is driven by DISTINCT VOCABULARY, not text volume — `PARA_BOOST` moves
characters and barely moves segments.

### 2. v12.6 — the map's second level (PR #68)

**What.** Boundaries come from cohesion valleys: tokenize each message once, measure cohesion at
every gap (4 messages either side, vocabularies unioned), score each gap by **valley depth**
relative to the nearest local peak on each side, and cut deepest-first where depth reaches
`max(MIN_DEPTH, 0.5 × the deepest valley in that segment)`, keeping runs ≥ 6 messages. A count cap
merges the smallest run into its smaller neighbour.

**Why the first attempt was not enough, which is the load-bearing part.** Fixing the
normalization (`min` instead of `max`) and picking 0.65 scored **7/8 boundaries on one payload and
2/8 on another differing only in message length**. How similar two adjacent messages look depends
on how long they are and how wide the vocabulary is, so no constant transfers. The owner said the
same thing independently before seeing those numbers.

**How the threshold was chosen.** `probes/perf-payload.js` now emits the timeline indices where
its topic blocks change, and the harness scores each build against that ground truth. Summed over
four payload shapes: **31/32 true topic changes found with 9 spurious**, versus 31/32 with **346**
before (a boundary every three messages hits everything by accident) and 24/32 with 14 for the
threshold attempt. The decisive property is that **one setting works across all four shapes**.

**Verification.** Sub-segments are 9–41 messages instead of uniformly 3; on the live-calibrated
payload the children come out as its actual topic blocks in order. Suite 1058/1058. Seven unit
checks (`probes/check-subsegments.js`). The count cap was verified **not** to be doing the work.

### 3. The fixture that could not have caught it

The virtualized fixture repeated one sentence 40 times. A conversation with no topic changes
cannot distinguish a segmenter that correctly finds none from one that invents dozens — **which is
how fixed 3-message chunking survived v12.5's entire review, six Codex rounds included.** The
indexed entry's fixture now carries three topic blocks, applied identically to the mock DOM and
the API payload so row-to-path matching stays byte-exact. The map recovers them exactly
(`starts [0, 27, 55]` against true changes at 27 and 55) and **S1b asserts those positions**, so
it gates segmentation quality rather than mere attachment. The shipped defect is measured red
against it.

### 4. Six Codex rounds — every finding real, one deferred by decision

Rounds 1–6 produced 10 findings (P2/P3 only, no majors), round 7 clean. Three deserve to outlive
the PR:

- **A cutoff no segment could clear.** For g depth values the largest achievable standardized
  distance is `sqrt(g−1)`; a 12-message segment yields 7 gaps, so `mean + 2.5·sd` was
  unclearable and the split the entry condition advertised was impossible. Verified numerically.
- **The same statistic failing the other way.** Ten disjoint runs give nine equally deep valleys
  which inflate `sd` until the bar sits *above* them. Both failures are one shape: **a rule that
  flags outliers against a spread computed from the same data moves its bar with the thing it is
  measuring.** The z-score is gone.
- **"Merge into the most similar neighbour" runs away.** A merged block's topic list is a union
  that overlaps with everything, so it wins on merit against every later run and is never
  `smallest` itself: `[48, 6, 6]`. Now size-first. **The top level still uses the pair rule, so
  the same dynamic is possible there in principle — theoretical only; see §G.3 for a claim of
  live evidence that was retracted.**

**Deferred by owner decision (see §G.1):** `_sumTokenize` strips `[^a-z0-9\s]`, so Korean and
conversations written in Korean produce **zero tokens** and accented Latin is mangled.
  (Korean is the product's only translation — English is the default. Russian appears in the
  verification notes solely as a second probe string showing the failure is general to non-ASCII
  scripts; it is not supported and no support for it is implied.)

### 5. A second CI variant, documented

`webkit on macos-latest` wedged four times across three heads: healthy per-entry times, then
silence, **no assertion output at all** — a different shape from DEC-036's `got null` episodes,
and requeue-once did not clear it. What ruled out the code was an identity, not an argument: the
userscript, `tests/` and `.github/` are byte-identical between the two heads that PASSED this job
and the three that wedged. It resolved on its own after ~65 minutes.

---

## C. Architecture snapshot

Unchanged except the conversation map's second level, which is now a real segmentation stage
rather than fixed-size chunking: `_sumMessageVocabs` / `_sumBlockVocab` / `_sumSetOverlap` /
`_sumCohesionCuts` feed `_sumBuildSubSegments`, and `_sumAttachSubSegments` attaches the result
once per surviving segment. `_sumWordOverlap` is deliberately untouched — key-point dedup and the
TOP-level segmentation are calibrated to it, and the top level is the owner's call to change.
`probes/` gained a map harness and a unit-check surface.

---

## D. Key principles established

- **A statistic must be drawn from the population it is applied to.** Three defects in one
  function were this shape: too few samples hid a lone outlier, too many outliers hid each other,
  and ineligible candidates set a bar they could never meet. When introducing a metric, ask what
  values it can actually take.
- **A fixture with no structure cannot gate a structure-finding feature.** Ask what the fixture
  would have to contain for the feature to be *wrong in a visible way*.
- **Deriving a bound only helps if the derivation is checked.** A hardcoded 12 that was
  accidentally right was replaced with a computed 14 that was wrong.
- **A check that straddles its own threshold proves nothing.** The edge-valley repro passed twice
  — once because edge valleys are structurally shallower, once by a margin of 0.033 — before the
  depth curve was dumped and a decisive case constructed.
- **The owner's read of a fix can outrank its measurements.** "You're just picking another number"
  preceded the evidence that the number could not transfer.

---

## E. Git state

`main` @ `eacb24a` (v12.5, PR #67 merged by the owner). **PR #68 (`fix/map-subsegments-v12.6`)
carries v12.6 and merges at the close of this session** — 15 commits, CI 9/9, Codex clean, synced
with main (content-identical merge; the branch was BEHIND only in graph topology).

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `DECISIONS.md` DEC-039, DEC-040 | the deferred attach, and the cohesion-valley design with every rejected alternative |
| `TROUBLESHOOTING.md` → the two map entries | measurement records, synthetic + live, before + after |
| `ROADMAP.md` items 0, 0a, 0b, 11 | what is open, what is closed, and the owner's ranking rule |
| `probes/check-subsegments.js` | seven unit checks on shapes no fixture produces |
| `probes/README.md` Path C | the map harness and its equivalence gate |
| `reviews/review-2026-08-01-v12.5-map.md` | the v12.5 review arc |

---

## G. What comes next

1. **The tokenizer (v12.7 — owner-scheduled this session).** `_sumTokenize` strips
   `[^a-z0-9\s]`: **Korean produces zero tokens** (verified), accented Latin is mangled
   (`café` → `caf`). Every content-derived Summary feature is dead for such a conversation.
   **Scope (owner, 2026-08-02): English is the default and Korean is the ONLY translation** —
   added for one specific user. Russian was only a second probe string demonstrating the failure
   is general to non-ASCII scripts; it is not supported. ES5 fix sketch and its real limit
   (CJK is not space-separated, so a character class is not enough) are in ROADMAP 0a. **Own arc,
   with measurement and a live check** — it changes topics, key points and dedup for every user.
2. ~~**v12.6's live look.**~~ **DONE 2026-08-02** — the owner confirms the map reads as real
   topic groups (runs of ~10 / ~30 / ~60 messages), fits roughly one page, and the top level is
   correct too. No density retune requested; `SUB_MAX` and `DEPTH_SHARE` stay as measured.
3. **The top level's merge rule — THEORETICAL, not scheduled** (ROADMAP item 0). It still uses
   the pair-merge that produced `[48, 6, 6]` at the sub level in simulation, so the same dynamic
   is possible in principle. **A claim that the owner's live map showed this was WRONG and is
   retracted (2026-08-02):** the numbers were sub-segment message RANGES (`msgs 8–10`, `20–22`,
   `181–183`, `80–81` — the 2–3 message spans v12.6 fixed), misread as segment sizes. The owner
   reports the top level working correctly before and after v12.6. Do not open this on the
   strength of the retracted evidence; open it only if live output ever shows lopsided segments.
4. **Carried-over fixture batch** — unmatchable-cluster/HEAD, assistant-TAIL, GM-shim backoff
   (incl. malformed JSON), exportBookmarks, forced-refetch knob, provisional-turn knob, key-point
   payload knob — plus the recorded small items (toolBlocks into the unmounted inventory,
   renderable-predicate off-by-2, `renderSummaryResults` try/finally).
5. **Backlog unchanged behind those** (Retry-After 429, §4.2 offset-cache reassessment, peek pane,
   mock-fidelity generator, debulking; Emergent deprioritized).

---

## H. Operational context + owner rules

- **Correctness outranks further optimization** (owner, this session, now a standing ranking rule
  in ROADMAP): *"making sure our core functions and features are useful and functioning is more
  important to me than making 1.2 secs into 0.5 secs."* When a performance idea competes with a
  coverage or correctness gap, the gap wins.
- **Item 11 is closed at ~1.2s by owner decision.** The unspent lever (827ms in the five surviving
  `_sumBuildSubSegments` calls) is recorded with the only condition that should reopen it: a
  conversation large enough to put the banner back — not a wish for a smaller number.
- **Execute-and-narrate** stands. Merge authority is per-PR and explicit (#67 merged by the owner;
  #68 authorized this session). DEC-031 live-confirm gates live-code merges.
- **Stop review loops on provenance** (DEC-029) — with the exception exercised this session: a
  loop-era finding that *weakens the evidence for the shipped change* earns another round.
- The owner tests on **Firefox + Tampermonkey**; probe builds are per-measured-build (DEC-027).
- Explicit `git add` paths, never `-A`; commit before mutating; suite both engines before push.

---

## I. Deferred / future work

All of §G items 3–5. The tokenizer (§G.1) is scheduled, not deferred. The `overflow-anchor: none`
mock assumption remains unverified (carried).

---

## J. Risk caveats / known limitations

- **The v12.6 thresholds are validated on synthetic ground truth**, whose topic blocks are
  lexically disjoint by construction. Real conversations drift, revisit and interleave. What is
  established is the MECHANISM and that the *relative* cutoff transfers across text shapes; the
  exact values are a live judgement, which is why §G.2 exists.
- **Non-ASCII conversations get no map second level at all** — correctly, since cohesion is zero
  everywhere, but the feature is unavailable rather than degraded (§G.1).
- **The top level shares the sub level's old merge RULE** and is unchanged — a theoretical
  concern with no live evidence; the evidence once cited for it was a misreading and is retracted
  (§G.3).
- **webkit-on-macos has two documented failure variants now** (DEC-036 + the silent wedge in
  TESTING.md). Requeue-once clears the first; the second cleared itself after ~65 minutes.

## K. Kickoff prompt for the next session

(maintained in the final summary of this baton-handoff run; paste-ready copy lives there)
