# probes/ — measurement instrumentation (not shipped code)

Tools for **measuring** the userscript, never installed by users. First occupant:
the Summary performance probe (ROADMAP item 11, TROUBLESHOOTING OPEN entry).
Everything here follows the CLAUDE.md measurement-context rule: every number a
probe produces is scoped to the context it was taken in, and the file that
records it must say which.

| File | What it is |
|---|---|
| `perf-instrument.js` | Inserts timing/count wrappers around the Summary pipeline into a copy of the userscript. One insertion point (before the "Inject now" init block); wrapped names are reassigned bindings, no function bodies edited. |
| `build-perf-probe.js` | Writes `acn-perf-probe.user.js` (git-ignored) — the installable instrumented build for the LIVE measurement. |
| `perf-payload.js` | Deterministic paragraph-scale conversation generator (seeded LCG, topic blocks so segmentation does real work). Env knobs: `PARA_BOOST`, `KP_RATE`, `VOCAB_MULT` (all default to the original baseline). |
| `run-perf-harness.js` | Playwright runner for the SYNTHETIC measurement: claude-virtualized mock + GM shim + instrumented build; drives generate → regenerate → export; writes JSON to `results/` (git-ignored). |
| `map-instrument.js` | Adds a direct driver for `_sumBuildConversationMap` on top of the perf instrumentation (replaces the timeline SOURCE only) plus a structural fingerprint of the produced map. |
| `run-map-harness.js` | Playwright runner for the MAP measurement: sweeps size/vocabulary/paragraph configs in one page load, and gates map-output equivalence with `--baseline`. |

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
# baseline from another build, then gate the working tree against it
git show HEAD:ai-conversation-navigator.user.js > /tmp/base.user.js
ACN_SCRIPT=/tmp/base.user.js node probes/run-map-harness.js \
    --browser chromium,firefox --sizes 2,3,25,147 --vocab 1,4 --para 1,3 --save /tmp/fp.json
node probes/run-map-harness.js \
    --browser chromium,firefox --sizes 2,3,25,147 --vocab 1,4 --para 1,3 --baseline /tmp/fp.json
```

`--baseline` exits non-zero on any difference. Each line reports the initial → final segment
count, the sub-segment rebuild count, and which construction model that count matches
(`eager` = `2 × initial − final`, pre-v12.5; `deferred` = `final`, v12.5+).

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
