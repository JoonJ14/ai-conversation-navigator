# probes/ — measurement instrumentation (not shipped code)

Tools for **measuring** the userscript, never installed by users. First occupant:
the Summary performance probe (ROADMAP item 11 — now CLOSED; the TROUBLESHOOTING entry it
came from is RESOLVED).
Everything here follows the CLAUDE.md measurement-context rule: every number a
probe produces is scoped to the context it was taken in, and the file that
records it must say which.

| File | What it is |
|---|---|
| `perf-instrument.js` | Inserts timing/count wrappers around the Summary pipeline into a copy of the userscript. One insertion point (before the "Inject now" init block); wrapped names are reassigned bindings, no function bodies edited. |
| `build-perf-probe.js` | Writes `acn-perf-probe.user.js` (git-ignored) — the installable instrumented build for the LIVE measurement. |
| `perf-payload.js` | Deterministic paragraph-scale conversation generator (seeded LCG, topic blocks so segmentation does real work). Env knobs: `PARA_BOOST`, `KP_RATE`, `VOCAB_MULT`, `PAYLOAD_LANG` (all default to the original baseline). The topic schedule is derived from the ENGLISH render in every language, so ground truth is language-independent; `assertEnglishScheduleUnchanged()` guards it at require time, and is skipped when any of the three volume knobs is non-default because each of them legitimately moves the schedule. |
| `run-perf-harness.js` | Playwright runner for the SYNTHETIC measurement: claude-virtualized mock + GM shim + instrumented build; drives generate → regenerate → export; writes JSON to `results/` (git-ignored). |
| `map-instrument.js` | Adds a direct driver for `_sumBuildConversationMap` on top of the perf instrumentation (replaces the timeline SOURCE only) plus a structural fingerprint of the produced map. |
| `run-map-harness.js` | Playwright runner for the MAP measurement: sweeps size/vocabulary/paragraph configs in one page load, and gates map-output equivalence with `--baseline`. |
| `check-tokenizer.js` | Measurement + 12 unit checks for `_sumTokenize` — the input every content-derived Summary feature reads. Drives the REAL shipped function through the map probe's `__acnTokenizeRun` hook. Includes T8, which pins the LIMIT (Japanese stays coarse) as an assertion so "Korean works" is never re-described as "Unicode support", and T9, which gates the Tier 3 finding that `×`/`÷` inside `\u00c0-\u024f` glue tokens. Exits non-zero on failure. **Runs in CI** (ubuntu+chromium) — T4 and T12 are the only checks anywhere that fail on a build reverting the script-aware length rule or restoring the downstream re-filters; the Korean Playwright fixture passes both mutants 31/31. |
| `build-tokenizer-variants.js` | Writes candidate `_sumTokenize` builds (cumulative layers) so a tokenizer design is chosen by scoring each layer separately rather than by adopting the most thorough-sounding one. **Needs `ACN_SCRIPT` pointed at a pre-v12.7 ref** — it patches the old body, and it FATALs rather than emit five copies of one build as five measurements. |
| `check-subsegments.js` | Unit checks for `_sumBuildSubSegments` on segment shapes the end-to-end harness cannot produce — the smallest accepted segment, one below it, many disjoint runs, a uniform conversation, a one-message aside. Exits non-zero on failure. |
| `check-usage-state.js` | 8 checks for the Plan usage panel's three states — loading, unavailable, rendered (v12.8, DEC-044). Drives the REAL UI by opening the Navigate panel and reading the DOM; no instrumentation hook. **Exists because the failure is a network state, not a DOM shape**: every mock page in `tests/` mounts a static document and none can express "the request errored" versus "the request has not come back", so this probe controls the transport directly. U4 holds a request open forever and U8 completes two same-org requests OUT OF ORDER — shapes the suite structurally cannot reach. **Runs in CI** (ubuntu+chromium). Mutation-tested: pre-fix 6 of 8 fail, and removing only the generation token fails U8. Removing only the repaint-on-fetch-start fails nothing — that fix is **not gated** and rests on reading the early return at `:5800`. |

## Path A — live measurement (owner; the decision-grade context)

Context that matters: **Firefox + Tampermonkey sandbox, visible tab, the real
~147-question conversation.**

1. `node probes/build-perf-probe.js` → `probes/acn-perf-probe.user.js`. The
   probe instruments whatever userscript is in the working tree — check out the
   build you mean to measure first (v12.4 fix branch → measures the fix;
   `git checkout origin/main~N` era → baseline).
2. In Tampermonkey: **disable** the regular "AI Conversation Navigator" script
   (the probe is a full copy; two instances would race the duplicate-execution
   guard across sandboxes). Install the probe file — it appears as a separate
   entry, "AI Conversation Navigator (PERF PROBE)".
3. Open the conversation, keep the tab **visible** throughout, open the DevTools
   console and filter on `ACN-PERF`.
4. Confirm the identity line (the DEC-027 guard — stop if it is missing, if
   `realm=` is not `GM-sandbox`, or if the `ACN vX.Y` it names is not the
   version you intended to measure):
   `[ACN-PERF] probe build perf1 over ACN v<version>; perf.now granularity ~X ms; visibility=visible; realm=GM-sandbox`
5. Summary dot → auto-generate → **run#1** (on a pre-fix build expect the freeze
   here; let it finish). Click **Regenerate Summary** → **run#2**. Tools →
   Summary export → on a PRE-FIX build this produces **run#3** with
   `trigger=export` (the double-run); on a v12.4+ build the healthy outcome is
   **no run#3 at all** — an `export cache:` line showing matching stamps, and an
   `exportSummary total ...ms (cache hit — no generate run inside this export)`
   line. A run#3 on v12.4+ means the cache was refused; the `export cache:` line
   says why (stamp moved / provisional set moved / cold).
6. Copy every `[ACN-PERF]` / `[ACN-PERF-JSON]` line (or the `__acnPerfJson`
   string) into a file and hand it back.
7. Afterwards: disable/remove the probe, re-enable the regular script.

Reading the output: `phase.*` are the five top-level phases of
`generateFullSummary`; inner entries (`inner.tokenize` n/ms/chars,
`keyPoints.dedup`, `map.subSegments`, …) are inclusive attributions;
`render`/`post-turn gap` lines cover the DOM side. Firefox's 1ms timer
granularity makes inner ms-sums statistical estimates — the phase-level numbers
are exact enough at these magnitudes. On v12.4+ builds the probe also logs the
`export cache:` line (both sides of the reuse key) — `run#3` appearing at all
means the export recomputed, and that line says why (stamp moved vs qLen moved
vs cold cache).

## Path C — the conversation map (fast, and the equivalence gate for map changes)

`map-instrument.js` + `run-map-harness.js` drive the REAL `_sumBuildConversationMap` over a
supplied message list (only the timeline SOURCE is replaced), so one page load measures many
configurations instead of one. Every run also emits a structural fingerprint of the map —
labels, spans, membership, child lists — which is what makes "this refactor changes nothing"
a measurement rather than a claim.

```
# Baseline from an EXPLICIT pre-change ref — never HEAD. Once the candidate is
# committed, HEAD names the candidate, and a baseline extracted from it compares
# the build with itself: guaranteed green, proving nothing (Codex).
# Use a PINNED sha. Neither origin/main nor $(git merge-base HEAD origin/main) is safe:
# after the candidate merges, HEAD and origin/main name the merged revision and the
# merge-base of a commit with itself is that commit — so the "baseline" is the build
# under test and the gate is guaranteed green (Codex, PR #70, second pass; the first
# fix here swapped one self-comparing form for another).
git show <pre-change-sha>:ai-conversation-navigator.user.js > /tmp/base.user.js
git show <pre-change-sha>:ai-conversation-navigator.user.js | diff -q - /tmp/base.user.js  # confirm
ACN_SCRIPT=/tmp/base.user.js node probes/run-map-harness.js \
    --browser chromium,firefox --sizes 2,3,25,147 --vocab 1,4 --para 1,3 --save /tmp/fp.json
node probes/run-map-harness.js \
    --browser chromium,firefox --sizes 2,3,25,147 --vocab 1,4 --para 1,3 --baseline /tmp/fp.json
```

Confirm the baseline build is the one you meant before trusting a green:
`git show <ref>:ai-conversation-navigator.user.js | diff -q - /tmp/base.user.js`. A baseline
and a candidate that are the same bytes cannot disagree.

The fingerprint covers each segment's label, span, topics, entity count and message
membership, **and the same for every child** — a sub-segment click resolves through
`_sumFirstJumpable(child.messages)`, so child membership is part of the behaviour, not a
detail of it.

`--baseline` exits non-zero on any difference, on a build that disagrees with ITSELF across
repeats (and then it refuses to write a `--save` file), on a requested configuration the
baseline never covered, and on any baseline configuration the sweep did not exercise — a
chromium-only run must not report equivalence for a chromium+firefox baseline. Add
`--partial` when narrowing the sweep on purpose (checking one mutant, one config): it
acknowledges the missing coverage in the verdict and never suppresses a real difference. Each
line reports the initial → final segment count, the sub-segment rebuild count, and which
construction model that count matches (`eager` = `2 × initial − final`, pre-v12.5;
`deferred` = `final`, v12.5+; `either` when nothing merged, because both formulas then give
the same number and the count cannot distinguish the two).

**Choosing a configuration — vocabulary, not volume.** Segmentation splits on
`_sumWordOverlap`, which divides by `max(|A|,|B|)`, so the initial segment count is set by
DISTINCT VOCABULARY. `PARA_BOOST` grows characters and barely moves segments; `VOCAB_MULT`
moves them directly. `--vocab 4 --para 3 --sizes 147` reproduces the owner's live shape (263
segments / 521 rebuilds / 36.4M chars vs live 218 / 431 / 27.1M). `--vocab 8` is past live,
on the steep part of the curve, and is useful as a stress case.

**A mutation is only refuted in a configuration that can see it** (DEC-039): attaching
sub-segments before `_sumMergeExcessSegments` is *equivalent* whenever the min-size pass has
already reduced the set to ≤5 (e.g. `--sizes 25 --vocab 4 --para 3`), and only shows up where
`mergeExcess` actually merges (e.g. `--sizes 147 --vocab 1 --para 1`, 8 → 5).

## Path D — the tokenizer (v12.7, and the template for any language work)

`PAYLOAD_LANG=ko` regenerates the conversation in Korean with the SAME `topicBoundaries`:
`computeSchedule()` derives the topic schedule from a throwaway English render, so every
language is scored against the same answer key.
**What that does and does not buy you.** Scores are comparable **between builds within a
language** — which is what the variant sweep does, and what every conclusion in this arc rests
on. They are **not** a like-for-like comparison **between languages**: Korean sentences consume
extra `rnd()` draws, which shifts the paragraph- and sentence-count draws, so the Korean payload
has differently shaped messages (first answer 3 paragraphs vs English's 5; 232KB vs 371KB at
q=147). Equalising that would need a structural plan from an independent RNG, which would change
the English payload and break its byte-identity with every measurement recorded against it. Do
not read a Korean total against an English total (GitHub Codex, PR #70). `PAYLOAD_LANG=lat` is accented/punctuated English (not a language: a probe for what a
widened character class does to text English users actually type). Unset, or `en`, reproduces
every earlier measurement byte-for-byte — verified by hashing the generated texts against the
pre-change generator at four configurations.

```
# Layer-by-layer: which parts of a tokenizer design actually earn their place?
# ACN_SCRIPT is required: the variants patch the PRE-v12.7 tokenizer body, which the
# working tree no longer has. Without it the script FATALs rather than writing five
# copies of one build and reporting them as five measurements.
git show 2ad8dc1:ai-conversation-navigator.user.js > /tmp/pre-v12.7.user.js
ACN_SCRIPT=/tmp/pre-v12.7.user.js node probes/build-tokenizer-variants.js /tmp/variants
for V in v0-baseline v1-charclass v2-length v3-stopwords v4-particles v5-nostop; do
  PAYLOAD_LANG=ko ACN_SCRIPT=/tmp/variants/$V.user.js \
    node probes/run-map-harness.js --browser chromium,firefox --sizes 147 --vocab 1,4 --para 1,3
done

# The no-regression gate for English, from a PINNED pre-change ref.
# NOT origin/main: once v12.7 is merged that names the CHANGED build, so the baseline
# and the candidate are the same bytes and the gate reports byte-identical fingerprints
# no matter what the change did — guaranteed green, proving nothing (Codex, PR #70;
# the same trap Path C above already warns about, reintroduced here by copying its
# command without its caveat).
git show 2ad8dc1:ai-conversation-navigator.user.js > /tmp/base.user.js
git show 2ad8dc1:ai-conversation-navigator.user.js | diff -q - /tmp/base.user.js   # confirm the ref
ACN_SCRIPT=/tmp/base.user.js node probes/run-map-harness.js \
    --browser chromium,firefox --sizes 2,3,25,147 --vocab 1,4 --para 1,3 --save /tmp/fp-en.json
node probes/run-map-harness.js \
    --browser chromium,firefox --sizes 2,3,25,147 --vocab 1,4 --para 1,3 --baseline /tmp/fp-en.json

# The function-level surface
node probes/check-tokenizer.js --browser firefox
```

The payload LANGUAGE is part of the fingerprint key (`chromium/lang=ko/q=147/...`). Without
that, an English baseline and a Korean run collide on one key and the gate reports a language
difference as a regression.

**What this path established, and the shape of the mistake it kept making (2026-08-02):** the
comparison between tokenizer variants **reversed three times**, once per measurement defect
corrected — first when a single configuration was replaced by a four-shape matrix, then when the
variants were made to carry the shipped downstream, and finally when the payload's topic schedule
was made language-independent. Only the last version is sound, and under it particle
normalization LEADS on recall (31/32 vs 28/32) rather than trailing.
**The lesson is not "run the matrix"** — that was the first fix and it was not enough. It is:
before comparing two builds, check that the ONLY difference between them is the thing under test,
and that the yardstick is the same for both. Two of the three defects were a yardstick that
differed between the things being measured.

## Path B — synthetic measurement (any machine)

```
node probes/run-perf-harness.js --browser chromium,firefox --sizes 25,50,100,147,200
PARA_BOOST=3 KP_RATE=2 node probes/run-perf-harness.js --browser firefox --sizes 147
```

## Results so far (2026-07-30, synthetic contexts — recorded in TROUBLESHOOTING)

Contexts: Playwright Chromium 145 / Firefox 146, headless AND headed (no
difference), page realm, Linux DGX, seeded payload avgUser≈305 / avgAi≈2.2KB
chars per message. See the TROUBLESHOOTING OPEN entry for the full table. Headline:

- **`_sumDeduplicatePoints` is the quadratic term and the freeze mechanism.**
  Key-point candidates grow linearly with conversation length (all deduped
  pairwise to keep at most 10 — the cap is applied *after* the O(p²) pass);
  every pair re-tokenizes both texts. At q=147 baseline: 673 points → 111k
  overlap calls → 224k tokenize calls → ~1.2s of the ~1.9s total (Firefox).
- **Sensitivity run** (PARA_BOOST=3 KP_RATE=2 ≈ 1MB text, real-payload scale):
  **11.5s per generate, 9.1s in dedup** (3,504 points → 838k overlap calls →
  1.68M tokenize calls over 202M chars) — freeze-banner magnitude reproduced.
- **The export double-run is confirmed numerically at every size**: run#3
  (export) re-pays the full analysis (~= run#2), so panel-open + export ≈ 2×.
- Map is the second term (~2s at 1MB text: subSegments rebuilt per merge +
  per-segment re-tokenization). Render ≤50ms; topics ≤300ms; stats/inventory ≈0.
  The freeze is pure analysis, not DOM.
