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
| `check-transport-ladder.js` | Checks for the Claude index's **transport ladder** (v12.9, DEC-045): which of `gmxhr` / `fetch` is asked, in what order, what does and does not trigger the fallback, the per-session winner cache, how a double failure is classified, the watchdogs, and the diagnostic lines. **Exists because the failure is a TRANSPORT state no mock can express — and because the suite's shared GM shim routes every non-200 through `onerror`, so it can never produce the 403 refusal that triggers the fallback.** Its GM shim has real manager semantics (`onload` for a 403, with claude.ai's JSON error body); `fetch` is answered by `page.route`; both are recorded per request. Firefox-shaped scenarios stub `exportFunction`, because otherwise the userscript's own SSE proxy marks every claude.ai fetch promise handled and would hide a leaked rejection; L0 proves page errors are collected at all. **Runs in CI on ubuntu for all three engines** — the only probe that does, since fetch, promise and timer behaviour is where engines could differ (so far its results are identical on all three). Context: Playwright page realm — it proves the ladder's decisions, not which real manager's transport carries credentials. Results against v12.8 and the mutation matrix are in `reviews/review-2026-10-22-safari-transport.md` (kept in one place); `run-ladder-mutants.sh` regenerates the matrix. |
| `build-ladder-mutants.js` | One mutant per mechanism of the transport ladder (46; DEC-045): a copy of the userscript with exactly that mechanism removed, by a string replacement that must match exactly once or the build stops (DEC-037's silent-non-execution class). Also holds each mutant's one-line description. A change to the ladder's code breaks it on purpose: re-anchor the mutants it names, or retire them with their mechanism. |
| `run-ladder-mutants.sh` | The mutation battery behind the review record's matrix. Copies the build, the probe and these scripts into a snapshot directory (so editing the repo mid-run cannot change a result), builds the mutants, and runs `check-transport-ladder.js` on each one on chromium, on the build under test on all three engines, and on v12.8 (`b471ddc`) on chromium and firefox. Then it prints the matrix. **Not in CI**: run it after any change to the ladder or the probe. `-j N` parallel runs (default 3), `-o DIR`, mutant ids to run a subset. |
| `ladder-mutation-matrix.js` | Turns a battery's `summary.txt` into the matrix tables. A mutant no check catches prints as NOT gated, and a crashed or short run prints as INVALID, never as gated. Exits 1 if the build under test failed a check or any run was invalid. |
| `check-usage-state.js` | 13 checks for the Plan usage panel's three states — loading, unavailable, rendered (v12.8, DEC-044). Drives the REAL UI by opening the Navigate panel and reading the DOM; no instrumentation hook. **Exists because the failure is a network state, not a DOM shape**: every mock page in `tests/` mounts a static document and none can express "the request errored" versus "the request has not come back", so this probe controls the transport directly. U4 holds a request open forever; U8/U9/U10 complete two or three same-org requests OUT OF ORDER, with distinguishable payloads so a check can say WHICH response landed — shapes the suite structurally cannot reach. **Runs in CI** (ubuntu+chromium). Mutation-tested, and the supersession guard's three wrong forms each fail a DISTINCT check: no guard fails U8 (a late failure erases a newer success), drop-everything fails U9 (a late success is discarded), `_usageData` truthiness fails U10 (a stale org's bars block a valid newer response). Pre-fix fails 6 of 10. Removing only the repaint-on-fetch-start fails nothing — that fix is **not gated** and rests on reading the fingerprint early return in `orbPopulateNavigate`. **U11/U11b/U12 (v12.12):** the usage request on the transport ladder (GM refused with a 403, fetch answers: bars; U11b the same with no `lastActiveOrg` cookie, so the org list must come through fetch too) and its exact-origin guard (a look-alike host sends no usage request on either transport); both fail on v12.11. They run before U10, whose Firefox timeout ends the run (TROUBLESHOOTING). The GM stub reports every HTTP status through `onload`, as a real manager does. |
| `check-turn-counter.js` | 8 checks for Claude's turn-counter dots (v12.11, PR #81; TROUBLESHOOTING, "Claude's turn-counter dots", which has the mutant results). Drives the real UI on the virtualizing mock with a per-conversation index delay: A1 opens Navigate before the index lands; A2 switches conversations with Navigate open, through `History.prototype.pushState` so no history hook could see it, and prints that none is installed; A2b reopens; A1f/A2f read the dots at the FIRST draw that lists the questions (a MutationObserver on the count attribute), because the next scan's guarded redraw would otherwise hide a stale first draw; A5 leaves for an empty page with Navigate open; A3 is a normal load; A4 counts DOM mutations under `document.body` while idle with Navigate open. **Exists because the bug is an ORDER of events**: the static mocks never open the panel before the index lands. v12.10 fails A1, A1f, A2, A2f, A2b and A5. **Not gated:** the guarded redraw on the unchanged-list return. Removing it fails nothing: the probe has no SSE, and an SSE draw is what reaches it (TROUBLESHOOTING). **Runs in CI** on ubuntu for all three engines. Context: Playwright page realm. |
| `check-gm-storage.js` | 13 checks for the GM storage wrapper (G1–G6: v12.12, PR #82; G7–G13: v12.13, the cross-tab PR, DEC-050). Stubs both storage APIs on the virtualizing Claude mock, each keeping its values in the page's `localStorage` under its own prefix, and reloads for real: G1/G2 a bookmark and a language change survive a reload with only the async `GM.getValue`/`GM.setValue` (Safari's Userscripts); G3 with both APIs present they survive through the sync functions and `GM.*` is never called (the Tampermonkey path); G4 a `GM.getValue` that never answers still brings the UI up at the 2 s bound (timed in the page from the first `GM.getValue` to the cluster's insertion, 2000–4000 ms), logs once, and writes nothing; G5 a rejecting `GM.setValue` is logged once, with no page error; G6 two writes of one key landing out of order (the stub finishes the first last) leave the newer value stored. G1 also asserts the load asks for all six keys. v12.11 fails G1, G2, G4 and G5. Single mutants of v12.12: no rewrite fails G6 only; a 1.5 s bound fails G4 only. **G7–G13 (v12.13):** a second page in the same browser context is a second tab, reading and writing the one stubbed storage. G7 the owner's two-tab test (both load, A bookmarks, B bookmarks in another conversation, A reloads: A's bookmark survives); G8/G9 a stored bookmark value that cannot be read is never saved over, with one warning and a toast, through the async and the sync API; G10 the two-tab test through the sync API (a guard: both builds keep both); G11 another tab's zone position for another platform survives a drag; G12 a command another tab saved survives running one; G13 every read after the startup load answers 200 ms late, with the value as of the call, and two quick bookmarks in one tab both survive (a guard for the save queue). v12.12 fails G7, G8, G9, G11 and G12; a build whose saves do not wait for each other fails G13. **Runs in CI** on ubuntu for all three engines. Context: Playwright page realm, stubbed storage, not a manager's. |
| `cross-tab-gm-check.user.js` | **Owner-run on all three managers** (the cross-tab PR's C0, v12.13): a separate, minimal userscript for `https://claude.ai/*` with a Write and a Read button. Write in tab B, Read in tab A, with no reload: it shows, for the synchronous and the async API, whether A's read returned B's write. The cross-tab fix re-reads before each save, which helps only if it does. Writes only the scratch keys `acn-c0-probe` and `acn-c0-probe-sync`. Results: `agent_docs/architecture.md`, runtime matrix. Not run by any script here. |
| `safari-gm-storage-check.user.js` | **Owner-run on real Safari** (PR B's B0, v12.12): a separate, minimal userscript for `https://claude.ai/*` that logs `[ACN-B0]` lines: whether the synchronous and async GM storage APIs exist and work, a persisting `GM.setValue` round trip, the manager's name and version, and the status and content type of a content-world `fetch` of the usage endpoint (no usage values, the org id cut to 8 characters). The owner's result, Userscripts 4.8.6, is in `agent_docs/architecture.md`'s runtime matrix. Not run by any script here. |

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
