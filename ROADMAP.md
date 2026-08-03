# Roadmap

Future directions and ideas for AI Conversation Navigator.

This document tracks features and platform expansions we're considering but haven't started yet. It's meant to capture research, reasoning, and priorities so we (or contributors) can pick things up when the time is right.

---

## Supported Today

### AI Chatbots
- Claude (`claude.ai`)
- ChatGPT (`chatgpt.com`)
- Grok (`grok.com`)
- Gemini (`gemini.google.com`)
- Perplexity (`perplexity.ai`) — added in v7.1

### Coding Agents (Web)
- Claude Code (`claude.ai/code`)
- Codex (`chatgpt.com/codex`)

### AI App-Builder Platforms (added in v7.0, expanded in v7.1)
- Bolt.new (`bolt.new`) — Sky Blue theme, ⚡ icon, ghost notch
- Lovable (`lovable.dev`) — Violet theme, ♥ icon, ghost notch
- Replit (`replit.com`) — Orange theme, ⠕ icon, ghost notch
- V0 (`v0.app`) — White theme, ▽ icon, ghost notch — added in v7.1
- Base44 (`app.base44.com`) — Indigo theme, ⬢ icon, ghost notch — added in v7.1
- Emergent (`app.emergent.sh`) — Emerald theme, e icon, ghost notch — added in v7.1
- Firebase Studio (`studio.firebase.google.com`) — Dark Tangerine theme, ✦ icon, standard button — added in v7.1

---

## Current Status: v12.7 — MERGED and LIVE-CONFIRMED (2026-08-02)

**v12.7 (PR #70, merged `06a079f`; live-confirmed by the owner the same day)** — `_sumTokenize` stripped `[^a-z0-9\s]`, so a **Korean** conversation
produced zero tokens and every content-derived Summary feature was silently empty for the
product's only translated language. The character class is widened to ASCII + diacritic Latin +
Hangul, and the minimum token length becomes script-aware (2 for Hangul, 3 otherwise) because
Korean's commonest content words are two syllables. Measured 12/32 → **28/32** true topic
boundaries with spurious cuts 36 → **11**; English output is **byte-identical** (32/32 map
fingerprints). Two more elaborate variants — a Korean stop list, and particle normalization —
were built and measured; the rejection of particle normalization is NOT measurement-supported and the live check decides (DEC-041). New CI gate: the suite's first non-English
fixture. See item 0a below.

**Live-confirmed 2026-08-02** — the owner opened a Korean conversation and reported topics,
bookmarks, search and the map all reading correctly. The one thing they could NOT find was the
particle artefact §G.1 asked about (세션이 vs 세션), which settles that question: **no
display-only normalizer is wanted.**

**v12.7a — the Tools and Plan usage panels (PR #71).** The same live check surfaced a second,
unrelated defect: those two panels never called `i18n()` at all. **Thirteen Korean strings
existed in `I18N.ko` and none was ever read** — they rendered English literals regardless of
the language setting. Now wired, plus a new `exports` key (파일 내보내기, the owner's wording)
and the Plan usage panel's reset phrases, which needed `{placeholder}` templating because
Korean puts the meridiem before the time. `/Commands` stays English by owner instruction.

**Earlier: v12.5 (PR #67) + v12.6 (PR #68), both merged and live-confirmed** — Summary generate
went 7.7–8.8s → ~1–2s live, and the conversation map's second level went from fixed 3-message
chunking to real topic detection. See `HANDOFF.md`, DEC-039/DEC-040, and items 0 / 11 below.

### Earlier: v12.1 — MERGED and live-confirmed (2026-07-29)

The extension supports 14 platform variants across 12 websites.

**Pre-merge hardening (2026-07-28) — 47 findings fixed across a 5-lens local Tier 3 gate and a
24-round GitHub Codex cycle.** Two of them were pre-existing v12.0 CRITICALs on paths that run
on every page load: an unbounded synchronous recursion between `scanConversation` and
`ciLoadIndex`, and a success-driven refetch loop re-downloading the whole payload every ~15.5s
on an idle page. Both were invisible to CI because of a single fixture constant each — recorded
as **DEC-028: a fixture's defaults are part of the finding**. The cycle also produced
**DEC-029** (end a review loop on finding *provenance*, not count) and **DEC-030** (provisional
bookmark migration). Suite: 374/374 across 20 entries → **455/455 across 23**, including three
new ancestor-gated load-path guards. Full detail in `HANDOFF.md` and the CHANGELOG.

**v12.1 (2026-07-29) — the bookmark half of the Layer 4 fix, plus its review.** v12.0 gave
Navigate, Search and Export the whole conversation through the index; bookmarks did not follow.
Pre-v12.0 records key to a content hash with no uuid, and only a uuid enters the jump bridge that
pages the virtualizer — so every one of them was **silently dead** in a released version. Recovery
is an evidence ladder (**DEC-034**): three uniqueness-gated, sender-scoped, floored inference rules
plus a **proof** channel that reproduces the stored hash against mounted text. The measurement that
made it work was fetching the owner's real 297-message payload through Chromium: 61 thinking blocks,
55 carrying `summaries[].summary`, and a DOM header that *truncates* the summary for display — so
whole-string matching fails in both directions and a 40-char bidirectional probe is required. Live:
**0/16 → 16/16**. The panel now labels every row with the *message* text derived from the index at
render time while the stored preview stays untouched as matching evidence. Review: 36 raw findings /
21 verified locally (two CRITICAL — rule C's reverse probe had no floor on the preview; inference
committed before proof and destroyed the hash oracle, now **DEC-035**), then seven Codex rounds to a clean
round (8 findings, zero false positives, 4 pre-existing / 4 cycle-introduced — parity is the
DEC-029 stop signal). Suite **515/515 across 25 entries**, both engines. Also fixed: the
attachment-headed Q#1 that shipped in v12.0, whose reproduction was blocked by a **vacuous fixture
knob** (**DEC-032**).

### Next: post-v12.3 backlog (v12.2 + v12.3 merged 2026-07-30; nothing in flight)

**Priority order re-ranked 2026-08-01 with the owner: item 11 (Summary performance) is CLOSED —
v12.4 killed the freeze, v12.5 took generate to ~1.2s, and the owner declined the remaining
lever. Priority is now item 2 (carried-over fixture batch) and the recorded small items, then 3
onward. Item 7 (Emergent) stays deprioritized ("almost no one uses it").**

**Standing priority, owner 2026-08-01: correctness over further optimization** — "making sure
our core functions and features are useful and functioning is more important to me than making
1.2 secs into 0.5 secs." Read that as a ranking rule for future work, not just a verdict on
item 11: when a performance idea and a coverage/correctness gap compete, the gap wins.

**Version policy as exercised (owner, 2026-07-30, honoured through v12.5): measure first; a small
fix ships as a point release (v12.4, v12.5); a real refactor becomes v13. Do not start a refactor
on a hypothesis.**

Numbering below is stable (items keep their historical numbers):

0. **Conversation-map sub-segmentation is not content-driven — FIXED in v12.6 (DEC-040),
   LIVE-CONFIRMED 2026-08-02.** Boundaries come from **lexical-cohesion valleys** judged against
   each segment's own depth distribution: `max(MIN_DEPTH, 0.5 × the deepest valley in that
   segment)`. That is a share of the strongest signal present rather than a z-score, because a
   mean+sd bar is computed from a sample containing the valleys it is looking for and so can see
   neither a lone outlier in a small sample nor many outliers at all (both measured; DEC-040).
   It is not a similarity threshold either — no threshold can work here regardless of its value,
   because adjacent-message similarity scales with message length and vocabulary breadth
   (measured: one constant scored 7/8 on one payload and 2/8 on another differing only in
   message length). Summed over four payload shapes: **31/32 true topic changes found with 9
   spurious**, versus 31/32 with **346** before (it cut every three messages) and 24/32 with 14
   for the intermediate threshold attempt. Sub-segments are 9–41 messages instead of uniformly 3.
   **Live:** *"a lot more healthy… some of them are about 10 messages, some 30, some 60 — this is
   exactly how we do this, like a group of similar topics"*; fits roughly one page; the top level
   confirmed correct too. No density retune requested.
   **One thing stays open out of this:**
   **the TOP level still merges by most-similar-pair**, the rule measured to run away at
   the sub level (one 221-message row; and in a direct loop simulation, [48, 6, 6]).
   **THEORETICAL at the top level — there is NO live evidence, and an earlier claim that there
   was is RETRACTED (2026-08-02).** That claim came from misreading the owner's report of
   sub-segment message RANGES (`msgs 8–10`, `20–22`, `181–183`, `80–81` — the 2–3 message spans
   v12.6 fixed) as top-level segment SIZES. The owner reports the top level as working
   correctly, before and after v12.6. If it is ever touched the fix is the same smallest-first
   merge, but nothing currently indicates it needs touching.
   *Original diagnosis, kept:* Every sub-segment is exactly 3 messages with
   near-identical labels, because `SUB_THRESHOLD = 0.42` is unreachable — `_sumWordOverlap`
   divides by `max(|A|,|B|)`, so one message against a 4-message window peaks near 0.04. Every
   message splits and the absorb-fragments pass produces fixed 3-message chunks. Reproduced
   synthetically (92 sub-segments, 90 of them size 3). **The same broken comparison sits at the
   top level** (0.15, also unreachable → ~218 initial segments live) and is hidden only by the
   merge-to-5 cap: the top level is accidentally good, not correct. Fix direction and the full
   diagnosis are in the TROUBLESHOOTING OPEN entry. Owner's framing: sub-segments should behave
   like the big ones — stay together until the topic actually changes.
   **Open question for the owner, deliberately not pre-decided:** how many sub-rows a
   180-message segment should have. That is taste, and it gets settled against real output.

0a. ~~**The Summary's tokenizer discards every non-ASCII language**~~ **FIXED in v12.7
   (2026-08-02) for the two languages the product ships — English and Korean.** The character
   class is now ASCII + diacritic Latin + Hangul, and the minimum token length is script-aware
   (2 for Hangul, 3 otherwise), because the length filter turned out to be a second, unnoticed
   English assumption: Korean's commonest content words are exactly two syllables, so fixing
   only the character class still discarded 10 of 10 of them. Measured over four payload shapes
   on both engines: **12/32 → 28/32** true topic changes found, spurious **36 → 11**; English
   output byte-identical at 32/32 map fingerprints. A Korean stop-word list and particle (josa)
   normalization were both built and measured; **v2 ships, but the rejection of particle
   normalization is NOT supported by measurement and is not claimed to be.** An earlier
   comparison that showed it worse was invalid — the payload's topic-block lengths were drawn
   from the same RNG as the text, so Korean was scored against a different ground truth than
   English (GitHub Codex, PR #70). Corrected and re-run, particle normalization leads on
   recall (31/32 vs 28/32). v2 ships because it keeps Korean in the segment-count regime
   English is calibrated in and adds no hand-maintained word list — and because this metric
   has reversed three times. **The live check decides (DEC-031); see DEC-041.** New CI gate: `Claude (Korean conversation + index)`, the suite's first
   non-English fixture, asserting Hangul topics and the same `[0, 27, 55]` block positions the
   English fixture asserts.
   **Still open out of this, and deliberately separate:** key points are unavailable in Korean
   for a different reason — `KEY_POINT_PATTERNS` is a set of English regexes, so no tokenizer
   change can reach it. And sub-segment LABELS in Korean read with particles attached
   (세션이 rather than 세션); a display-only normalizer would fix the reading without touching
   any measure, and the live check is what should decide whether it is wanted.
   **The limit that must not be re-described:** this is fixed for English and Korean, NOT
   "Unicode support". Japanese and Chinese are not space-separated and are excluded on purpose
   (`probes/check-tokenizer.js` T8 pins that as an assertion).

   *Original entry, kept for the diagnosis:*
   **(raised by GitHub Codex on PR #68, 2026-08-01; PRE-EXISTING, not introduced by v12.5/v12.6).**
   `_sumTokenize` strips `[^a-z0-9\s]`, so **Korean text produces ZERO tokens**
   (verified) and accented Latin is mangled (`café` → `caf`, `était` → `tait`). Everything
   content-derived in the Summary is therefore dead or meaningless for those conversations:
   topics, key points, dedup, top-level segmentation, and — since v12.6 — sub-segments, which
   now correctly return nothing rather than inventing fixed-size rows.
   **Scope, clarified by the owner 2026-08-02:** the product ships **English (default) and
   Korean** — Korean was added for one specific user and is the ONLY translation. Russian
   appears in the verification notes purely as a second probe string showing the failure is
   general to non-ASCII scripts; **it is not a supported language and no Russian support is
   implied or planned.** The fix is worth doing for Korean; anything else it incidentally helps
   is a side effect, not a goal.
   *Deliberately NOT folded into PR #68:* the tokenizer feeds every content feature in the
   Summary, and widening it changes output for any text containing accents, smart quotes or
   emoji — that needs its own measurement pass and a live check, not a last-minute edit to a
   PR already through three review rounds. **Fix sketch (ES5, no `\p{...}` — the `u` flag is
   ES2018):** keep the strip but whitelist script ranges —
   `[^a-z0-9\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\s]`.
   **Known limit of that sketch:** Korean, Cyrillic, Greek and accented Latin are
   space-separated so whitespace tokenization works; Chinese and Japanese are not, and would
   collapse to one token per sentence — they need segmentation, not a character class. Say
   which languages are fixed rather than claiming "Unicode support".

0c. **Three i18n keys are never called — a REVIEW list, not a defect list (owner, 2026-08-02).**
   `questionPrefix`, `noQuestions`, `noBookmarksToExport` have Korean values and **zero call
   sites**, so those surfaces render English in Korean mode. Found by the v12.7a audit.

   **TWO keys were originally filed here and do not belong — both are missing BEHAVIOUR, not
   translation preferences** (GitHub Codex, PR #72). Filing them as "English on purpose" would
   have buried two real gaps:
   - **`usageUnavailable`** — when the Claude usage request fails or returns no recognised
     tiers, `fetchClaudeUsage` hands `null` to `renderUsageBars`, which renders
     `planUsageLoading` **indefinitely**. The panel says "Plan usage loading…" forever and the
     unavailable message never appears in EITHER language. That is a missing failure state
     (~`ai-conversation-navigator.user.js:4962`), and it predates v12.7a.
   - **`summaryLanguageNote`** — see below.

   **`summaryLanguageNote` was originally listed here and does NOT belong — it is a different
   problem and needs an owner decision (GitHub Codex, PR #72).** Its ENGLISH value is the empty
   string and its Korean value is a disclaimer — *"ℹ️ 요약 분석은 영어 대화에서 가장 잘
   작동합니다"* ("Summary analysis works best with English conversations"). So "renders English
   in Korean mode" is meaningless for it: there is no English text. It is a Korean-only notice
   that **has never rendered**, while `docs/SETTINGS.md` §"Disclaimer for non-English users"
   states that it does.
   **And v12.7 changed whether it is even true.** Topics and the conversation map now read
   Korean; only key points do not. So the disclaimer as written now overstates the limitation.
   Three ways out, none of them obvious enough to pick without the owner:
   (a) wire it with corrected text naming only key points; (b) drop the key and amend
   SETTINGS.md to record that the notice was removed because v12.7 made it obsolete; or
   (c) leave both as-is and accept that a spec doc describes a notice that does not exist.
   **Do not simply wire the current text** — it would tell a Korean user the Summary works
   poorly for them, which v12.7 made substantially false.
   **The owner reviewed Korean mode live and is satisfied with it as-is:** *"some things are
   actually better to stay in english than force translation to korean when they can understand
   some english… i am fine with how the korean mode looks."* So these are **not defects** — they
   are a preference the owner may revisit, and the decision is **per string**: does Korean help
   that particular label, or does the English read better? Do NOT mass-translate to drive the
   audit count to zero; the audit's value is making the choice visible, not making it zero.
   Each is a one-line wiring fix **if** a given string is judged worth translating. The audit
   command is in `agent_docs/conventions.md` → i18n Conventions. The nine `/Commands` keys are a
   settled case of the same principle — deliberately English (DEC-042).

0b. **"290 messages" vs "147 questions" reads as a discrepancy (owner, 2026-08-01 — parked by
   the owner, "I need to think about that").** The map counts timeline ENTRIES (questions and
   answers), which is correct and deliberate — the back-and-forth is what makes a segment
   meaningful — but a panel that says `msgs 262–280` next to a conversation the owner thinks of
   as 147 questions invites a double-take. Options if it is picked up: label the unit
   explicitly (`msgs` → `msgs (Q+A)`), show turn numbers instead of entry indices, or show both.
   No change made; recorded so the question is not re-derived.

1. ~~**Live-test and fine-tune the provisional bookmark mechanism** (DEC-030).~~ **Done in v12.1**
   — and it went considerably further than fine-tuning: the legacy path is now four channels with a
   proof/inference split, live-verified at 16/16, and fixtured (`Claude (legacy schema-1 bookmarks)`,
   including the uniqueness gate that had zero coverage). Remaining debt in this area: the
   "harvest-bound record renders an ACTIVE flag" assertion is deliberately **not** written — the
   bound row is not reliably mounted when the panel is read, so every available form of it passes
   vacuously. It is recorded in the fixture as test debt, not silently skipped.
2. **Fixture batch, starting with the Summary/Export dead zone.** ~~Mutation testing proved those
   surfaces have **zero test execution**~~ **Dead zone closed in v12.3**: S1–S4/E1–E3 fixtures,
   each of the four mutation targets individually re-verified red against them
   (`ciIndexStamp`, `_sumBuildTimeline`, `_sumScrollToElement`, `_exportFromIndex`).
   Summary-click-after-recycling from the carried-over list is covered by S2. **Still open from
   this item:** the rest of the carried-over batch (localized unmatchable-cluster,
   unmatchable-HEAD, assistant-TAIL, GM-shim backoff classes incl. malformed JSON) — split to a
   follow-up PR for review size; and the recorded debts: `exportBookmarks()` + Tools
   gallery/commands still unexecuted. **The Gemini AI selector re-chain is CLOSED-BY-MEASUREMENT
   for now** (Jul 30, 2026): all 12 live conversations on the test account have text-empty
   response-footers, so the fallback's only over-capture is the "Gemini said" h2 that v12.2
   already strips — no measured data can make an assertion distinguish the selectors (DEC-032:
   unprovable change). Re-opens if a text-bearing footer (e.g. search-grounded sources-list) is
   ever observed; that observation is also what would make it ancestor-gatable.
3. **Retry-After honoring for HTTP 429** — plumb response headers through `ciRequestJSON`.
4. **Reassess, don't build: §4.2 offset cache / §4.3 height learning.** Measure a live repeat
   jump first; if sub-400ms, close as satisfied-by-redesign. One live datapoint already exists
   and it is about **precision, not speed**: a second jump to the same bookmark landed near the
   target rather than exactly on it (`TESTING.md`, "Live observations that no fixture has
   replaced"). Measure landing offset alongside latency.
5. **Peek pane (spec §9)** — show the exchange inline from the index, zero scrolling.
6. **Mock fidelity — generate fixtures from a real payload.** Keep structure (senders,
   `stop_reason`, content-block types, attachment/tool shapes, unrendered entries), replace
   text with same-length placeholders. **Explicit limit:** this captures API structure ONLY.
   It does not model DOM structure — the attachment-chip regression that shipped in v12.0
   lived in the DOM (`[data-testid="user-message"]` absence) and this would not have caught
   it. A DOM-structure capture is a separate, unbuilt piece. Never let "generated from real
   payloads" be read as "models the real site".
7. **Emergent: re-examine it as a Layer 4 platform** (surfaced by Codex review of PR #60,
   2026-07-29). It recycles via Virtuoso and predates the Layer 4 category, so it was never
   audited against what that category now teaches. Open questions, none of them yet measured:
   how much of a *long* Emergent session does passive accumulation actually reach, and **would a
   stepped sweep — which does not exist yet — be affordable there?** (Design question, not a
   validation of existing code; see defect 1 below.) Are Emergent bookmarks keyed to anything
   positional — an accumulated-list index that shifts with collection order would be the same
   identity-vs-position bug v12.1 spent a release recovering from, on a platform nobody has checked.
   Its DOM inspection is also from **Feb 15, 2026**. Investigate before assuming it is fine; it has
   been quietly *unexamined* for months, which is not the same as correct.

   **Two defects are already confirmed by reading the code, no measurement needed** (both found by
   Codex during review of PR #60):

   1. **There is no sweep.** `DOM-REFERENCE.md` claimed a "scroll-through collection ... on panel
      open (250 ms per viewport step)" since v7.7. That code does not exist — every scroll mutation
      in the userscript is Claude's jump machinery or a click handler, there is no stepped loop, it
      is not in `modules/`, and git history shows no removal. **Emergent's coverage is only what the
      user has scrolled past.** Open a long session, click Navigate without scrolling, and you get
      the mounted window: the Claude v12.0 failure mode, unmitigated, on a platform the
      documentation described as handled for five months. This is the "a comment describing
      behaviour is not evidence the behaviour exists" rule, applied to a doc.
   2. **Accumulation dedupes on normalized text.** `_vsAccumulatedKeys` keys on message text, so two
      identical prompts — "continue", "yes", "fix it", routine here — collapse into one Navigate
      entry even where coverage is complete. Virtuoso's `data-index` is read three lines later and
      would key it structurally. Small fix, same identity-by-content family as the bug v12.1 spent
      a release on.

   Neither is measured against a real long Emergent session yet — do that first (DEC-027), because
   the fix depends on whether a sweep is affordable there or Emergent needs something closer to
   Claude's treatment.
8. **Characterize how Claude's virtualizer actually recycles.** The repo asserts both forms and
   neither is a live measurement: `injectBookmarkIcons` guards on recorded identity because "React
   reuses the same DOM node for a different message", while `claude-virtualized.html` models
   destroy-and-rebuild and the suite asserts `isConnected === false`. Both guards should stay
   regardless — the point is that documentation currently states a fact nobody established, and the
   two forms fail differently (wrong-content jump vs silent no-op), so a future diagnosis will be
   misled by whichever half it reads. One live probe settles it: hold a reference to a mounted row,
   scroll far away, and check `isConnected` and `textContent` **before** scrolling back.
9. **Rename the `virtualScroll` platform flag.** It selects the Emergent DOM mitigation, not the
   platform property, so `claude` — the most virtualized platform in the project — is
   `virtualScroll: false`. Anyone grepping it to assess Layer 4 exposure gets the exactly wrong
   answer. Something like `domSweepStrategy` states what it does. Touches 12 platform configs, so
   it needs the full acceptance matrix on both engines despite being a rename.
10. **Debulking.** ~9,300 lines now. Known dead code: `ciResolvePathForRow`,
   `ciDataIndexToFullPath`, `ciFullPathToDataIndex`, `_bmLegacyId`; inventory/entity `msgIndex`
   fields with no consumer; `_bmLegacyIdSet`'s two unreachable dedupe guards; two dead test
   config keys making one assertion unreachable.
11. **Summary performance on long conversations (OPEN — priority 1, added 2026-07-30).** Live
   finding on the owner's ~147-question conversation (Firefox + Tampermonkey, v12.3): Summary →
   Generate and Tools → Summary export near-freeze the tab (Firefox's "slowing down" banner),
   then complete correctly. Consistent **since v12.0** — which is when the summarizer started
   receiving the whole conversation instead of ~3 mounted turns. Known from code, NOT yet
   measured: `exportSummary` re-runs `generateFullSummary()` from scratch (no memoization — the
   export pays the full analysis price even seconds after the panel generated), and the whole
   pipeline (word-overlap segmentation, topics, key points, entities, inventory) is one
   synchronous main-thread block whose cost scales with total characters. **Measure first**
   (per-phase instrumentation on the live conversation — plan in `TROUBLESHOOTING.md` → the OPEN
   entry), then: small fix (memoize per `ciIndexStamp()` generation, reuse for export, chunk the
   analysis) → **v12.4**; pipeline restructuring → **v13**.
   **Status 2026-07-30: mechanism measured in synthetic contexts** (`probes/`, both engines,
   scaling q=25..200 + a real-payload-scale sensitivity run): the quadratic term is
   `_sumDeduplicatePoints` (O(points²) with per-pair re-tokenization, capped to ≤10 only
   AFTERWARD — 9.1s of an 11.5s Firefox block at ~1MB text), the export double-run is confirmed
   numerically, render is negligible. Full table in the TROUBLESHOOTING OPEN entry.
   **Status 2026-07-31: v12.4 FIX SHIPPED** (owner authorized proceeding on the synthetic
   measurement): dedup stops at the cap (output-identical, verified by byte-identical export
   diff), export reuses the panel's computation keyed by `{ciIndexStamp(),
   provisional-set signature}` (content identity, not count — Tier 3 skeptic). Measured
   before/after (same contexts): boosted generate 11.7s → 2.4s; keyPoints 9.0s → 0.05s;
   export full-re-run → reuse (or one ~2s recompute when a resync re-mints the stamp).
   **Status 2026-07-31 (later): LIVE-CONFIRMED by the owner** (Firefox + Tampermonkey,
   real conversation): banner gone, dedup 1ms/1,135 candidates, export cache HIT at
   11ms. **Residual follow-up lever (v12.5-or-v13 decision for the owner):** generate
   still costs ~7.7–8.5s live — ~93% in the map's segment-merge churn (431
   `subSegments` rebuilds, 3,895 `topicsFromText` extractions over 27.1M chars in ONE
   generate; `mergeExcess` alone 5.2–5.7s). Real vocabulary makes many initial
   segments; every merge re-tokenizes whole segments. Candidate small fix: memoize
   per-message token sets for the map loops (needs the fence-spanning-join edge case
   checked); real restructuring of the merge loops is v13 territory. Live numbers +
   contexts in the TROUBLESHOOTING entry.
   **Status 2026-07-31 (v12.5, SHIPPED — ✅ LIVE-CONFIRMED 2026-08-01, "really fast… roughly
   a second or two"): the residual is
   the churn itself, not the tokenizing.** The rebuild count is an identity
   (`2 × initialSegments − finalSegments`, reproduced exactly at every synthetic
   config), so the live 431 means **≈218 initial segments from ~294 messages**. Nothing
   during construction reads a segment's `children`, yet every commit and every merge
   rebuilt them. v12.5 attaches sub-segments once per SURVIVING segment
   (`_sumAttachSubSegments`, DEC-039) — output-identical, 32/32 fingerprints unchanged.
   Measured at the live-calibrated payload (Firefox, q=147, `VOCAB_MULT=4 PARA_BOOST=3`):
   map **7.6–7.8s → 1.1–1.3s**, rebuilds 521 → 5, `mergeExcess` 3,238ms → ~1ms.
   Neither queued lever was needed: token memoization would have made throwaway work
   cheaper (and carried the fence-spanning-join edge), and merge-loop restructuring
   targets a term that is negligible once the loops stop rebuilding sub-segments.
   **Fidelity note for any future map measurement:** segmentation is driven by DISTINCT
   VOCABULARY (`_sumWordOverlap` divides by `max(|A|,|B|)`), not text volume —
   `PARA_BOOST` is the wrong axis, `VOCAB_MULT` is the right one.
   **CLOSED 2026-08-01 by owner decision — ~1.2s is good enough, and correctness outranks
   the next 700ms.** ("I am fine with 1.2 secs, no need to push further. Making sure our core
   functions and features are useful and functioning is more important to me than making 1.2
   secs into 0.5 secs.") The remaining lever is recorded here so nobody re-derives it:
   of the post-fix 1,144–1,260ms, **827ms is the five surviving `_sumBuildSubSegments`
   calls** — specifically their fragment-absorb loop, which re-extracts topics over
   ever-growing combined text and restarts its scan from index 0 after each absorb; the
   merge loops and the initial scan are ~300ms together. Unlike v12.5, taking that on would
   be a real algorithmic change to a loop whose OUTPUT matters, so it would need the
   fingerprint gate to prove equivalence — which is precisely why it is not worth it at this
   margin. Do not reopen on performance grounds alone; reopen only if a conversation
   materially larger than ~294 messages puts the map back into banner territory.
   **Still expected:** the plain-build live pass (DEC-031) on the v12.5 head — a functional
   check (map renders sub-segments, segment and SUB-segment clicks land, export correct), not
   a measurement. The probe is not needed for it.

**v12.0 Accomplishments (2026-07-26):**
- **API-Backed Conversation Index (DEC-021):** Claude virtualized its message list with recycling — only ~3 of 147 user turns are mounted at any moment (~3% coverage), so `document.querySelectorAll()` stopped being a complete record of the conversation. Navigate, Search, Summary and Export were all operating on a fraction of the data, and Export was silently writing truncated files under an authoritative-looking message count. Fixed by reading Claude's own conversation JSON endpoint via `GM_xmlhttpRequest` and walking the message tree from `current_leaf_message_uuid` to isolate the active branch. This is an ordinary outbound request, not fetch interception — no Firefox cross-compartment exposure (DEC-019/DEC-020).
- **Layer 4: State Breaks (DEC-022):** New platform-risk category. The selectors matched, the script ran, no competing feature shipped — the platform simply withdrew the data from the DOM while still holding it. It is the only failure mode that reports success on a fraction of the data.
- **Claude Selector Refresh:** Live re-inspection found `[data-testid="user-human-turn"]` removed from the turn wrapper, `data-testid="user-message"` relocated onto the inner content node, and `.font-user-message` renamed to `!font-user-message`. Both the user and AI selector chains were surviving on a single link each; the fallback chain had been silently absorbing a Layer 1 break underneath the Layer 4 one.
- **Virtualizing Test Mock:** `tests/mock-pages/claude-virtualized.html` holds 40 turns and mounts 3, genuinely unmounting the rest. Static mocks structurally cannot fail on a Layer 4 break — the suite had been green throughout.
- **Bookmarks Keyed to Message UUIDs (schema 2):** Bookmarks hashed `(text, DOM index)`. Under recycling that index changes as the user scrolls, so bookmarks silently stopped matching their own messages — and the positional fallback resolved to an *unrelated* mounted message and scrolled to it as if correct. The positional fallback is gone; legacy records migrate on sight.
- **Context Tracking Undercount Fixed:** Path A and Path B both measured `innerText` of the scroll container, seeing only the mounted window. The virtual-scroll coverage correction could never help, because `_questions` was rebuilt from live DOM each scan and so `nInDOM / _questions.length` was always exactly 1.0. Now driven from the index, with real thinking-token counts from `content[]` blocks instead of an `[aria-expanded] × 600` heuristic.
- **Org UUID Resolution:** `fetchClaudeUsage()` took `orgs[0]` — a positional guess that returned another organization's usage for multi-org users. Replaced with cookie → `chat`-capability ranking → validate-by-use.

**v11.8 Accomplishments (2026-03-14):**
- **Firefox: Disable Fetch Interception (DEC-020):** `setupClaudeSSEInterceptor()` now returns immediately on Firefox (`typeof exportFunction === 'function'`). The sandbox execution taints `arguments` and return values when proxying `fetch` — even fire-and-forget patterns fail because the sandbox's participation in `_nativeFetch.apply()` creates cross-compartment wrappers that Firefox blocks with `Permission denied to access property "length"`. Context bar falls back to DOM estimation (Path B). SPA history patches remain safe with `exportFunction()` (they return `undefined`). Permanent fix requires the extension transition (WXP) with `world: "MAIN"` content scripts.
- **Turn Dots in Path B:** Added `_renderTurnDots()` call to Path B (Claude without SSE data). Previously missing because Path B was a brief transitional state on Chrome — SSE data arrives quickly and Path A takes over. With Firefox permanently on Path B, the gap was exposed.

**v11.7 (2026-03-14, superseded by v11.8):**
- **Fire-and-Forget Fetch Pattern (failed):** Attempted to preserve SSE interception on Firefox by calling `result.then()` as a side effect and always returning the original `result` Promise. Still failed — sandbox execution taints the pipeline at the `arguments` level regardless of return value handling.

**v11.6 Accomplishments (2026-03-14):**
- **Firefox Black Screen Crash Fix (DEC-019):** Claude's March 13, 2026 Visualizer vendor bundle update called `.bind()` on `fetch` during React initialization. Our sandbox-compartment replacement triggered Firefox's cross-principal security check, crashing the entire page to a black screen. Fix: `exportFunction()` wrapping clones proxy functions into the page's security context. Applied to `fetch` proxy and SPA history patches (`pushState`/`replaceState`). This was the first Layer 3 execution break — platform update crashing the host page, not just degrading our features.

**v11.5 Accomplishments (2026-03-13):**
- **Image Gallery: Graceful Handling for Files-Panel Images (Claude):** Claude's files panel shows all uploads in a flat grid disconnected from conversation turns. Images get `msgIndex: -1` sentinel, gallery label shows "Upload" instead of "Q#1", navigate-to-message button disabled. Prevents scrolling into the hidden files panel.

**v11.4 Accomplishments (2026-03-13):**
- **Image Gallery Fix — Claude + ChatGPT:** Gallery was returning "No images" on both platforms. Two separate root causes found via live DOM inspection:
  - *Claude:* As of March 2026 Claude renders uploaded file thumbnails in a hidden FILES PANEL (`div.w-0`, `opacity-0`) that is completely outside the conversation turn elements. Per-message scoping could never reach them. Fix: `imageSelectorScope:'document'` + new selector `img[src*="/api/"][src*="/files/"]`.
  - *ChatGPT:* Migrated uploaded image hosting from `files.oaiusercontent.com` to `chatgpt.com/backend-api/estuary/content`. The old CDN selector matched nothing. Images remain inside `[data-message-author-role="user"]` elements; only the selector was updated.

**v11.3 Accomplishments (2026-03-12):**
- **Image Gallery Fix — Gemini + Grok:** Gallery returned 0 images despite correct selectors in v11.2. Root cause: per-message `querySelectorAll` scoping missed images that live outside `getUserMessages()` elements. Fix: `imageSelectorScope:'document'` flag added to both platforms; document-wide query with ancestry-based message association. Grok selector also refined to exclude profile picture avatars.

**v11.2 Accomplishments (2026-03-12):**
- **Image Gallery Platform-Specific Selectors:** Added `imageSelector` to Claude, ChatGPT, Grok, Gemini, and Perplexity platform configs. Perplexity marked `null` (explicitly unsupported — attachments are text labels, not `<img>` tags). Firefox/Windows CI timeout fixed (10s → 20s).

**v11.1 Accomplishments (2026-03-12):**
- **Context Bar Accuracy — System Overhead Fix:** `_estimateClaudeOverhead()` returns 30K tokens for standard chats and 50K for Claude Projects. Previously hardcoded at 15K, causing the bar to underreport by 15–35K tokens. Applied to both Path A (exact SSE) and Path B (estimated).

**v11.0 Accomplishments (2026-03-10):**
- **ES5 Compliance Fix:** `const PLATFORMS` → `var PLATFORMS`. The only ES5 violation in the entire ~6,400-line file. Fixed before public release.
- **`useOrbital` Into Registry:** Moved the orbital-vs-legacy decision from a hardcoded 5-item array (`['claude','chatgpt','grok','gemini','perplexity'].indexOf(...)`) into the platform registry as a `useOrbital: true/false` property on each of the 12 platform configs. All platforms now declare their UI tier explicitly; the derivation is `var useOrbital = !!platform.useOrbital`.
- **Dead Code Removed:** Three functions that were defined but never called: `migrateOldSettings()` (old storage key migration, never wired up), `getAllMessagesOrdered()` (superseded by `_sumBuildTimeline()`), `predictNextCycleLength()` (turn counter prediction, never invoked).
- **`window.generateFullSummary` Removed:** Internal function was unnecessarily exposed on the global `window` object. All callers use closure scope within the same IIFE.
- **`data-acn-version` Fixed:** Three zone element attribute sites were hardcoded to `'10.0'` instead of using `ACN_VERSION`. All now reflect the actual version.
- **Startup Log Fixed:** Console banner was hardcoded `v10.7` since the v10.7 release — now uses `ACN_VERSION`.
- **Redundant ternary fixed** in `formatResetTime`: both branches did `new Date(resetsAt)`.
- **Duplicate CSS Removed:** First `.acn-exp-opt` definition in `orbInjectCSS()` was dead (overridden by the second in the same stylesheet).
- **Expanded Test Contract:** Added `data-acn-ui="orbital"|"legacy"` on zone elements and `data-acn-dot="nav|search|bookmarks|summary|tools|settings"` on each orbital dot.
- **Two New Tests (168 → 189 total):** Test 13 verifies each platform gets the correct UI system (orbital vs legacy). Test 14 verifies all 6 orbital dots rendered (orbital platforms only).

**v10.16 Accomplishments (2026-03-10):**
- **Segmentation Cold-Start Fix:** Added a post-merge pass to `_sumBuildConversationMap` that absorbs fragments < 3 messages into their most topically similar neighbor before applying the 5-segment cap. Eliminates the window reset bias where every topic shift caused cascading 1-2 message fragments. A 20-message deep-dive now produces one big block instead of `[1][1][2][15]`. The map reflects actual conversation shape in all patterns: big/small/big, all-random, single-topic.

**v10.15 Accomplishments (2026-03-10):**
- **Proportional Map Alignment:** Replaced marginTop-based spacing with `flex-grow` on both left sub-segments and right snapshot messages, weighted by content line count. `updateSnapshot` uses live `getBoundingClientRect` to align the snapshot zone top with the sub-segment area start. Both sides now fill their rows proportionally — no more clustered sub-segments with empty space below.
- **Hover Highlighting:** Hovering a sub-segment glows its corresponding snapshot messages orange (`acn-snap-highlight`). Hovering a parent block (no sub-segments) highlights all its snapshot messages. Cross-references are built at render time — no DOM queries on hover.
- **Content-Driven Sub-Segmentation:** Raised threshold 0.27 → 0.42. Raised minimum segment size 8 → 12 messages. Added post-merge pass to absorb fragments < 3 messages into their neighbor. Result: topic blocks split only on genuine vocabulary divergence.
- **Segment Merge Cap:** Lowered 10 → 5 top-level segments. Map feels like a summarized overview, not a list.
- **Topic Pills Removed:** Eliminated redundant `.acn-seg-d2-pill` elements from leaf segments — labels alone identify topics without visual noise.
- **Code Quality:** Extracted `_sumMsgLines(text)` helper (line-count formula was inlined 3×) and `_sumAttachHighlight(el, msgEls)` helper (hover loop was duplicated 2×). ResizeObserver cleanup interval tightened from 2000ms → 500ms.

**v10.12 / v10.13 Accomplishments (2026-03-10):**
- **Summary Section Order:** Reordered summary panel sections to Stats → Topics → Conversation Map → Key Points → Code & Files. Map now appears above key points so users see the visual overview first.
- **Map Overflow Fixed:** Removed fixed container height from the D2 bracket map. Segments now use proportional `min-height` (`(seg._lineCount / totalLines) * 600px`) so they expand freely and the panel scrolls to accommodate long conversations. Eliminates segment overlap caused by children/pills overflowing fixed flex slices.
- **Drag Performance:** Orbital zone drag now moves via CSS `transform: translateY()` on every mousemove (GPU-composited, no layout reflow). `orbRender()` fires once on mouseup to finalize dot positions.
- **Userscript Name Permanently Fixed:** Removed version number from `// @name` header. Field is now permanently `AI Conversation Navigator` with no version suffix — prevents Tampermonkey from creating duplicate installs on each update. Version is tracked only in `// @version` and `ACN_VERSION`.
- **Pivot Phrase Narrowed:** Removed bare `pivot` from `PIVOT_PHRASES` regex; added explicit forms `let's pivot` and `pivot to`. Tightened `unrelated` → `unrelated question` and `something else` → `something else entirely` to reduce false positives on technical vocabulary.
- **Snapshot DOM Cap:** Snapshot bars per message capped at 15 lines in both the `_lineCount` accumulator and the snapshot DOM loop, preventing DOM blowups from large code blocks or pasted logs.
- **Sub-Segments Preserved on Merge:** `_sumMergeExcessSegments` now recomputes `children: _sumBuildSubSegments(mergedMsgs)` on the combined message list when two segments are merged, so nested bracket data is never dropped.

**v10.11 Accomplishments (2026-03-10):**
- **Pivot Detection:** User messages containing phrases like "by the way", "switch gears", "new topic", etc. now force a hard segment break in the conversation map, independent of word-overlap score. Bare "pivot" intentionally excluded — only explicit transition forms like "let's pivot" and "pivot to" match, to avoid false positives on technical terms like "pivot table".
- **Sub-Segment Generation:** Added `_sumBuildSubSegments()` — a secondary segmentation pass (threshold 0.27) on segments with 8+ messages that produces nested `children[]` for parent segments. Children are preserved when segments are merged by `_sumMergeExcessSegments` (recomputed on the combined message list).
- **Dynamic Key-Point Cap:** Key points now scale with conversation length: `Math.max(1, Math.min(10, floor(totalMessages/4)))`. Short conversations get 1–3 key points instead of flooding the panel with 10.
- **D2 Nested Bracket Map:** The flat card list is replaced with proportional `[` brackets. Each segment's height scales by total text lines (`flex-grow = ceil(textLength/80)`, capped at 15 lines per message to prevent DOM blowups from large code blocks or pasted logs). Parent brackets show label + meta; child segments indent 10px with thinner 1.5px/0.3-opacity brackets. Topic pills on leaf segments only.
- **Conversation Snapshot Column:** A second column renders each message as tiny text-line bars (accent color for user, gray for AI), capped at 15 lines per message. Appears when panel width ≥ 420px, scales 70–160px wide, live-updated by `ResizeObserver`. Both columns share the same `flex-grow` values for vertical sync.
- **Merge Cap:** `_sumMergeExcessSegments` lowered from 12 → 10 segments max.
- **Drag Performance:** The orbital zone drag now moves the zone via CSS `transform: translateY()` on every mousemove (GPU-composited, no layout reflow) instead of calling `orbRender()` per frame. `orbRender()` fires once on mouse release to finalize dot positions.
- **Userscript Name Fixed:** `// @name` header field (displayed in Tampermonkey's extension list) was stuck at v10.9 through two version bumps. Now aligned with `// @version` and `ACN_VERSION`.

**v10.10 Accomplishments (2026-03-10):**
- **Draggable Orbital Zone:** Click-and-hold anywhere in the orbital toggle zone and drag vertically to reposition the entire button cluster. Uses a 5px movement threshold to distinguish drag from click. Position persists per-platform as a viewport-height ratio via `GM_setValue('acn-zone-positions')` so it adapts across screen sizes. Drag limits calculated from full expanded height in show-all mode. Global drag handlers attached once via `_orbGlobalHandlersAttached` guard — no stacking on SPA reinjection. Stuck drag state cleared on `window blur`. Click-suppression canceller auto-removed after 300ms to prevent swallowing the next real click.
- **Summary Panel Overhaul:** Three sections tightened to reduce noise. (1) Topics: cap reduced from 15 → 8. (2) Key Points: cap reduced from 20 → 10; removed overly broad action patterns (`try`, `run`, `install`, `build`, etc.); removed `actually` from finding patterns; narrowed `because/reason/why` to specific phrasings; minimum sentence length raised from 20 → 40 characters. (3) Conversation Map: replaced fixed 4-message sliding window with content-aware topic-shift segmentation — uses `_sumWordOverlap` (threshold 0.15) against a 4-message context window of the current segment; long deep-dives stay as one block, off-topic tangents split naturally; merge pass caps at 12 segments. Removed `SEGMENT_ICON_MAP` and icon prefixes from segment labels entirely.
- **Documentation Audit:** Fixed stale version numbers, terminology ("sidebar" → "orbital button cluster"), missing features (context window bar, /commands, i18n, plan usage), and privacy section inaccuracies across README, ROADMAP, CLAUDE.md, and agent_docs.

**v10.9 Accomplishments (2026-02-23):**
- **SSE Plumbing Fully Fixed:** v10.8's `unsafeWindow` fix was necessary but not sufficient. Two more bugs found through 10-step live debugging: (1) cross-realm `Uint8Array` — Tampermonkey's sandbox TextDecoder silently returns empty strings for page-realm typed arrays; fixed by copying bytes into sandbox realm with `new Uint8Array(result.value)`. (2) `\r\n` line endings — Claude SSE uses `\r\n`, not `\n`; split regex `/\n\n/` never matched. All plumbing now confirmed working.
- **Dead End Confirmed: No Token Usage in Claude Web SSE.** After fixing all plumbing, `message_start` events parse successfully but contain no `usage` field — no `input_tokens`, no `output_tokens`. Claude's web UI strips this from the SSE stream. It only exists in direct API responses. This is a permanent dead end for exact token tracking from a userscript. Do not re-investigate.
- **Hybrid Context Bar:** Uses `DOM_visible_text/4 + system_overhead(15K) + cumulative_SSE_thinking/4`. Extended thinking text (invisible in DOM, hidden behind collapse toggle) is now captured via `thinking_delta` SSE events and accumulated cumulatively across the entire conversation. Bar never resets — serves as "how close to trouble" indicator. Label shows `(hybrid)` with `~` prefix. Cached across page reloads via GM storage.
- **Claude Gets Turn Dots + Compaction Count:** Claude now shows both the hybrid percentage bar AND the turn dots + compaction count system. Two complementary signals: bar = cumulative usage trend, compaction count = degradation warning. Claude is the only platform with both (non-Claude continues showing turn dots only).
- **Debug Log Cleanup:** All `[ACN-SSE]` diagnostic console.log statements removed.

**v10.8 Accomplishments (2026-02-23):**
- **SSE Interceptor Partially Fixed:** `setupClaudeSSEInterceptor()` now patches `unsafeWindow.fetch` (real page window). This was necessary but not sufficient — two more bugs remained (fixed in v10.9).
- **Claude GM Cache:** Token data persisted per conversation to `GM_setValue('acn_ctx_cache', {...})` keyed by conversation UUID. On reload or SPA navigation to a known conversation, shows `(last known)` label. Cache pruned to 50 most recent conversations by timestamp.
- **Non-Claude: Turn Dots Only:** Removed misleading estimated percentage bar from Path C. DOM estimation can undercount by 15–20× on tool-heavy or search-augmented conversations. Non-Claude platforms now show turn dots with compaction prediction only.
- **Arc Mode Hitzone Geometry Fixed:** `orbUpdateHitzone()` is now mode-aware. Arc mode uses `arcWidth = 177px`. Show-all/wheel use `96px`.
- **Turn Counter SPA Reset:** Added `resetTurnCounter()` helper. Called in SPA navigation handlers. `updateTurnCounter()` also has a shrinkage guard as defensive fallback.

**v10.7.x Accomplishments (2026-02-23):**
- **Bookmarks Panel (fully functional):** Persistent message bookmarking across page reloads and script updates. Stored via `GM_setValue('acn-bookmarks-v1')` — survives script updates, browser restarts, and SPA navigation. Includes bookmark icon injection on all messages, panel list with click-to-scroll, and per-conversation storage.
- **Full Conversation Export:** Walks entire conversation DOM, converts to Markdown with heading structure, downloads as `.md` file. Handles SVG elements in Claude.ai's toolbar (SVGAnimatedString fix).
- **Panel Resize:** Drag panel's left edge to resize between 240–640px. Persists to `localStorage._acnv10.panelWidth`. CSS variable `--acn-panel-w` is the single source of truth for both panel width and zone offset.
- **Chat Input /Command Detection:** Typing `/commandname` in the chat input opens the command palette pre-filtered. Updates live as you type. Closes if text is cleared or no command matches.
- **Image Gallery:** Scans conversation for image attachments, displays in Tools panel with count. Lazy-renders on panel open (no injection-time render).
- **Plan Usage Bar:** Fetches Claude plan utilization (session/weekly/7-day) and displays as progress bars in Navigate panel. Auto-refreshes after generation completes.
- **Summary Auto-Generation:** Summary panel auto-generates content on open if empty.
- **i18n:** Korean language support. **Dot labels and panel headers update live on a language switch; everything built at injection applies after a refresh** — the `languageChanged` toast says so. This line previously claimed *all* labels update live; that was never true (the handler only touches dots and panel headers) and it is corrected here rather than left as a promise the code does not keep. A few surfaces stay English deliberately (`/Commands`, and the ROADMAP 0c set by owner preference).
- **Context Window Estimation — Extended Thinking Correction:** Path B estimation now corrects for Claude's invisible overhead: system prompt (+15K tokens) and extended thinking blocks (count × 600 tokens). Combined with virtual-scroll coverage-ratio correction. See `docs/claude_specific_context_tracking_calculation.md` for full methodology.
- **Hover Stability:** Fingerprint guards on Search (`_searchListFingerprint`) and Bookmarks (`_bmListFingerprint`) panels prevent DOM teardown on MutationObserver cycles. Navigate panel guard was already present.
- **Bookmark Icon Visibility:** Fixed two distinct hover visibility bugs — active icon losing orange on hover (CSS specificity), and non-active icon camouflaging against light backgrounds (wrong hover background color).

**v10.0 Accomplishments (2026-02-22):**
- **Orbital Button System:** Six feature dots (Navigate ✳, Search ⌕, Bookmarks ⚑, Summary Σ, Export ↗, Settings ⚙) in three display modes — show-all, arc, wheel. Scroll wheel rotates arc/wheel focus. Settings persist to localStorage.
- **Dual-System Architecture:** Orbital UI for the 5 primary AI platforms (Claude, ChatGPT, Grok, Gemini, Perplexity). Legacy ghost-notch button for the 7 app-builder platforms.
- **Live Testing Fixes:** isLeftChat button-panel sync across 4 code sites; Bolt.new scrollbarOffset open-state bug; V0 light mode visibility (textColor + toggleBorder); arc mode labels below dot via `data-acn-mode` CSS; panel z-index above orbital dots.
- **Context Window Bar:** DOM walk to scroll container reads full conversation (user + AI) text; CTX_LIMITS per platform; green/amber/red color coding.
- **Font Unification:** `system-ui` stack set on `.acn-zone` root; all children inherit consistently across all 14 platforms.
- **Contract-Based Tests:** `data-acn-role` / `data-acn-*` attributes are the stable test interface — 14 platforms × 12 tests = 168 total at launch (expanded to 189 in v11.0). Tests survive complete UI rewrites as long as the contract attributes are maintained.
- **Full CI Matrix:** GitHub Actions runs Playwright across 3 OSes (ubuntu, macos, windows) × 3 browsers (chromium, firefox, webkit) = 9 checks on every PR.

**v9.4 - v9.6 Accomplishments (historical):**
- **Universal Search (v9.4):** High-performance keyword search across 14 platforms using DOM `TreeWalker`.
- **Trusted Types Security (v9.6):** Refactored UI engine for strict Content Security Policy compliance.
- **Left-Chat Synchronization (v9.6):** Solved panel animation desync for Bolt.new, Lovable, Replit, and V0.

**v8.0 Architecture: Platform Registry**
All platform-specific data is consolidated into a single `PLATFORMS` registry. Adding a new platform requires only one entry in the registry (plus a `@match` URL).

**All platforms working:**
- Claude, ChatGPT, Codex, Grok, Gemini, Perplexity — selectors validated on live sites
- Lovable, Base44 — selectors working correctly on live sites
- Bolt.new — `data-message-id` + `self-end` pattern, excluding subscription warnings
- Replit — `data-cy="user-message"` with homepage guard (skip non-project pages)
- V0 — `data-testid="message"` filtered by `origin-right` + `items-end`
- Emergent — `data-testid^="user-message"` with virtuoso-specific boundary detection and accumulative scanning
- Firebase Studio — cross-origin iframe injection into workspace iframe (`/capra/` path discrimination), `[class*="_isUser_"]` CSS module selectors

**Documentation:**
- `DOM-REFERENCE.md` — real DOM structures of all 14 platforms with selector rationale and debugging history
- `CHANGELOG.md` — detailed technical changelog with root cause analysis for every fix
- `TROUBLESHOOTING.md` — platform-specific diagnostic guides
- `DECISIONS.md` — architectural decision log (DEC-001 through DEC-020)
- `docs/claude_specific_context_tracking_calculation.md` — deep-dive on Claude context window estimation methodology

---

## Platform Risk Model — Four Layers of Breakage

This project lives inside other companies' web applications. We don't control the host environment. Through 200+ commits of cross-platform work, we've identified four distinct categories of breakage, each requiring different detection and mitigation strategies. Understanding these layers is critical for planning defensive infrastructure and the eventual extension transition.

### Layer 1: DOM Breaks — "Selectors stop matching"

**What happens:** A platform updates its HTML structure — class names change, `data-testid` attributes are renamed, elements move to different containers. Our `getUserMessages()`, `getAIMessages()`, and `imageSelector` queries return empty results. Features degrade (0 questions detected, empty image gallery) but the host page continues working normally.

**Examples:** Claude moved uploaded images from conversation turns to a hidden files panel (v11.4). ChatGPT migrated image hosting from `files.oaiusercontent.com` to `backend-api/estuary/content` (v11.4). Gemini, Grok, and Perplexity all broke image gallery detection due to DOM restructuring (v11.2–v11.3).

**Detection:** Automated DOM validation framework (planned) — crawl live sites, compare selectors against known structures, flag mismatches.

**Mitigation:** Fallback selector chains in the PLATFORMS registry. Per-platform `imageSelector` and `imageSelectorScope` configs. Mock page updates to match real DOM. This is the most common break type and the one we're best equipped to handle.

### Layer 2: Feature Breaks — "Platforms ship what we built"

**What happens:** A platform adds native functionality that overlaps with ours — built-in bookmarks, conversation search, export buttons, navigation shortcuts. Our tool becomes redundant for that specific feature on that specific platform, or worse, conflicts with it visually or functionally.

**Examples:** Claude's March 2026 Visualizer update adds inline charts/diagrams that could eventually overlap with our Summary panel's conversation map. ChatGPT experimented with plugins and canvas features. Gemini has native conversation organization.

**Detection:** Manual monitoring of platform changelogs and feature announcements. No automated detection possible — these are product decisions, not DOM changes.

**Mitigation:** Design features that complement rather than duplicate. Focus on cross-platform consistency (our value is working the same way across 14 platforms — no single platform will match that). Be prepared to gracefully disable specific features per-platform if they conflict.

### Layer 3: Execution Breaks — "Our code prevents the page from loading" ⚠️ NEW

**What happens:** A platform changes its JavaScript bundle, Content Security Policy, or security headers in ways that cause our injected code to crash the host page entirely. The platform doesn't just ignore us — it *dies* because of us. This is qualitatively different from Layers 1 and 2: those degrade our features, this kills the user's ability to use the platform at all.

**First occurrence:** v11.6 (2026-03-14). Claude shipped a new vendor bundle (Visualizer feature) that called `.bind()` on `fetch` during React initialization. Our `unsafeWindow.fetch` replacement was a Tampermonkey sandbox-compartment function. Firefox blocks cross-compartment `.bind()` — Claude's entire frontend crashed to a black screen. Chrome was unaffected due to its more permissive cross-compartment model. See TROUBLESHOOTING.md and DEC-019 for full technical details.

**Why this will happen again:** Anthropic disclosed in February 2026 that Chinese AI labs (DeepSeek, Moonshot, MiniMax) ran industrial-scale distillation attacks against Claude using 24,000 fraudulent accounts and 16 million exchanges via proxy services. Anthropic is now actively hardening security — tightening CSP headers, updating vendor bundles, adding integrity checks. From a security perspective, our userscript's injection pattern (replacing `window.fetch`, patching `history.pushState`) looks identical to what proxy services do. Other platforms will likely follow similar security hardening trends as the AI industry matures.

**Detection:** Cannot be caught by DOM validation — the DOM never renders. Requires actual browser testing with the script loaded against live sites. Playwright tests against mock pages won't catch this because mocks don't have real vendor bundles or CSP headers.

**Mitigation (userscript era):**
- `exportFunction()` wrapping for all replaced page globals (DEC-019 convention)
- Minimize page-global monkey-patching — every replaced function is a potential future crash point
- Investigate alternatives to `unsafeWindow.fetch` interception (e.g., `GM_xmlhttpRequest` for independent SSE monitoring)

**Mitigation (extension era — reduces but does not fully eliminate this vulnerability class):**
- Content scripts run in an **isolated world** with explicit browser support — not through a Tampermonkey sandbox workaround. The isolated world shares the page's DOM but has a separate JavaScript context. Functions injected from the isolated world into the page (via `world: "MAIN"` content scripts) don't suffer from the cross-compartment `.bind()` problem that caused v11.6's crash.
- **SSE interception still requires fetch patching.** `webRequest` / `declarativeNetRequest` APIs only provide request/response metadata (headers, URLs, status codes) and rule-based blocking — they do NOT expose response body content. Since our context tracking depends on parsing SSE response body chunks (`thinking_delta` events), an extension would still need to intercept `fetch` from a `world: "MAIN"` content script. The difference: this runs through the browser's official content script injection, not Tampermonkey's sandbox hack.
- **SPA navigation is fully solved:** `webNavigation.onHistoryStateUpdated` API fires on pushState/replaceState changes — no need to monkey-patch `history.*` at all.
- Extension APIs like `chrome.scripting` handle injection in a way the browser is designed to support
- CSP changes that would break extensions would also break password managers, accessibility tools, and ad blockers — platforms generally won't go that far

### Layer 4: State Breaks — "The DOM stops being the record" ⚠️ NEW

**What happens:** A platform keeps rendering correctly and keeps holding the complete conversation — but stops putting all of it in the document. Message-list virtualization with recycling mounts a small window of turns and unmounts the rest. Our selectors still match. Every match is still correct. There are simply far fewer of them, and nothing anywhere reports an error.

**First occurrence:** v12.0 (2026-07-26). Claude virtualized its message list. Measured live on a 96-turn conversation: **3 turns mounted, ~3% coverage.** A scroll sweep across the full conversation kept the same 3 mounted the entire way — the set never accumulated, confirming recycling rather than lazy loading. Navigate showed ~3% of questions; Search could only match mounted text; Summary segmented a fraction; and Export silently wrote a truncated file under an authoritative `**Messages:** 8` header. See DEC-021 and DEC-022.

**Why this is its own category:** it is the only layer that **reports success on a fraction of the data.**

- Layer 1 announces itself: zero results
- Layer 2 announces itself: a visible competing feature
- Layer 3 announces itself violently: a dead page
- Layer 4 returns a plausible, non-empty, entirely wrong answer

A 4-question panel on a 147-question conversation is indistinguishable from a short conversation. That is precisely why it survived undetected.

**Why this will happen again:** virtualization is the standard fix for long-list rendering performance, and AI conversations only get longer. Any platform whose conversations routinely exceed a few hundred turns has a performance incentive to virtualize. ChatGPT has shipped list virtualization before. This is a normal front-end optimization, not a hostile act — which is exactly why there will be no warning.

**Detection:** *Neither* of the tools built for the other layers works here.

- DOM validation targets Layer 1 and would **pass** — the selectors are fine
- Playwright mock tests **passed the entire time**, because every mock page is static and mounts all its turns permanently

**A test suite of static mocks structurally cannot fail on a Layer 4 break.** The only reliable signal is comparing a DOM-derived count against an independent source of truth. `tests/mock-pages/claude-virtualized.html` exists for exactly this reason: it holds 40 turns and mounts 3, genuinely removing the rest from the document.

**Mitigation:**
- Find where the platform still holds the data — its own API or store — and read from there (DEC-021)
- Keep the DOM path as a fallback, and make degraded operation **visible in the UI**, never console-only
- For every virtualizing platform, ship a mock that genuinely unmounts nodes; `display:none` does not reproduce the failure
- Record for each platform whether its message list is virtualized
- Treat any "scan the page = see the conversation" assumption as a standing liability

### Layer severity comparison

| Layer | What breaks | Severity | Frequency | Detectable automatically? |
|-------|------------|----------|-----------|--------------------------|
| DOM breaks | Our features degrade | Medium | High (monthly) | Yes — planned DOM validation framework |
| Feature breaks | Our features become redundant | Low | Low (quarterly) | No — requires human monitoring |
| Execution breaks | Host page crashes entirely | **Critical** | Low but increasing | No — requires live browser testing with real vendor bundles |
| State breaks | Our features silently operate on a fraction of the data | **Critical** | Unknown — first seen v12.0 | Only by cross-checking DOM counts against an independent source; static mocks cannot catch it |

The key insight: **DOM validation is necessary but not sufficient.** A project that only watches for selector changes will be blindsided by execution breaks *and* by state breaks. Live-site smoke testing catches Layer 3. Layer 4 needs something different again — a source of truth outside the DOM to compare against, because the failure mode is not "no data" but "confidently incomplete data."

Layer 4 is also the clearest ceiling yet on DOM augmentation as a strategy. Layers 1–3 are hazards to engineer around; Layer 4 says the DOM may stop being a complete record whenever a platform decides rendering performance matters more than document completeness. It is the strongest argument so far for the API-first direction of the extension transition.

---

## Porting the Layer 4 response to another platform

**Assume this is a when, not an if.** Virtualization is the standard answer to "our chat page gets
slow on long conversations", and Claude's flip between February and July 2026 came with no
announcement, no error, and a green test suite. As of the last inspection — **February 2026, before
anyone knew to look for this** — ChatGPT and Grok rendered long threads the same naive way Claude
used to; that is the last observation, not a current fact. Gemini's formerly-contested status was
**measured on Jul 30, 2026: no recycling at n≤10** (all turns mounted at every scroll position,
held references stay connected), resolved at that scale and open beyond it — its scroller is an
`<infinite-scroller>`, so lazy loading on genuinely long threads remains possible (see the status
table for the full context). Detection procedure and per-platform status live in
`DOM-REFERENCE.md` → "Virtualization status"; the full narrative of why the Claude response took
the shape it did is in `TROUBLESHOOTING.md` → "Why v12.0 and v12.1 Exist". This section is the
**order of operations** for the next one.

### Step 0 — Two questions, not one

**(a) Recycling or lazy loading?** Lazy loading accumulates nodes, so a scroll sweep before scanning
fixes it and the DOM stays a valid source. Recycling serves a fixed-size window, so every cached
element reference in the codebase becomes a latent wrong-answer bug. **Full procedure — four steps,
including selector validation and the two forms of recycling — is in `DOM-REFERENCE.md` →
"Virtualization status". It is the canonical copy; this section deliberately does not restate it.**

**(b) If recycling — is a full sweep viable?** This is the question that actually decides the size of
the work, and **the answer is not always no** — on a platform with short sessions a sweep may be the
entire fix. Claude is the clear negative case, but note *which* evidence settles it: a coarse sweep
(five positions) never accumulated past 3 unique turns, and at 372,642 px of scroll height a
viewport-step sweep would take minutes on every panel open. **The cost is what rules it out** — the
fine-grained coverage question was never measured there. There is
no positive case in this repo yet (see below).

Estimate before choosing: `scrollHeight / clientHeight` steps at ~250 ms. Seconds means a sweep is
affordable and may be the whole fix. Minutes — or a sweep that does not accumulate — means Steps 1–6.

**There is no in-repo sweep to copy.** Emergent recycles and has only *passive accumulation* —
`scanConversation` keeps what the user already scrolled past. `DOM-REFERENCE.md` described a
panel-open sweep for five months; that code never existed (backlog item 7). So a sweep would be new
work here, and it inherits two requirements the accumulator gets wrong: key the accumulator on
something **structural** (Virtuoso exposes `data-index`), never on message text, and prove the
traversal actually reaches the ends rather than assuming it.

**Do not use the `virtualScroll` platform flag to answer this.** It selects the Emergent DOM
mitigation, not the platform property, so Claude is `virtualScroll: false`. The
`DOM-REFERENCE.md` table is the record.

### Step 1 — Find out whether an independent source exists, and do not assume the answer

The entire v12.0 approach rests on one fact about Claude: **the client already downloads the whole
conversation and chooses to render a window of it**, so a plain authenticated GET returns
everything. Whether the same is true of any other platform is **unverified** — do not plan around
it until it is measured. What to establish, in this order:

1. Does an endpoint return the full conversation for the open thread? (DevTools → Network on a
   page load, then look for the conversation payload.)
2. What authenticates it — a cookie, a bearer token in memory, a CSRF header? A token that only
   exists inside the page's JS is a much harder problem than a cookie, and may rule the approach
   out entirely under the constraint in Step 2.
3. Does the payload contain the message *text*, or only metadata? Claude's top-level `text` field
   is empty on every message and the content lives in `content[]` blocks — a shape that would have
   rendered 147 blank rows if it had not been checked.
4. Does it expose branch structure (edits, regenerations)? If so, the walk must follow the active
   branch, or edited-away questions reappear as if current.

**If no such source exists, the honest outcome is reduced functionality on that platform, clearly
labelled in the UI.** That is a legitimate result. Silent partial data is not.

### Step 2 — Respect the Layer 3 constraint, and declare the host

Read it with `GM_xmlhttpRequest`. **Do not intercept `fetch` and do not patch page globals**
(DEC-019/DEC-020). v11.6 crashed claude.ai to a black screen on Firefox because a vendor bundle
called `.bind()` on our replaced `fetch`. A Layer 4 fix that reintroduces a Layer 3 hazard has made
the product worse: Layer 4 degrades our features, Layer 3 kills the host page.

**Then add the endpoint host to `@connect` in the userscript metadata.** The header currently
declares `@connect claude.ai` and nothing else, so an otherwise finished ChatGPT/Grok/Gemini port
will be blocked or will prompt for an undeclared permission, depending on the userscript manager —
a failure that appears at the very end and looks like a broken request rather than a missing
declaration. Two consequences that are easy to miss:

- **Adding a `@connect` host changes what the script is permitted to talk to**, so it is a
  user-visible permission change. Tampermonkey re-prompts on update. Update the README's
  permissions section in the same commit — it enumerates the grants deliberately.
- The privacy statement in README lists exactly which hosts are read. A new host makes that list
  wrong until it is updated.

### Step 3 — Extract and parameterize the patterns; almost nothing is callable as-is

Most of v12.0/v12.1 is not Claude-specific, and the port should not re-derive it:

**None of it is callable cross-platform today — budget for extraction.** Every one of these
mechanisms is currently gated to Claude: `ciLoadIndex` early-returns unless `ciIsClaudeChat()`, the
jump bridge is behind the same guard at its call sites, and the bookmark identity and migration
paths carry it too (37 occurrences of that guard in the file). These are **proven patterns to
extract and parameterize**, not machinery to wire up. Treating them as ready-made is the single
easiest way to underestimate this work by an order of magnitude.

| Pattern to extract (design is settled) | Must be built per platform |
|---|---|
| Index-backed enumeration with a DOM fallback and a **visible** degraded state | the fetch, the auth, the payload walk |
| Resolve-on-arrival jumping — aim, land, re-identify, refuse rather than guess (DEC-027) | the scroll container and row-identity attributes |
| Bookmarks keyed to message identity, never position | the platform's message id field |
| The legacy-record evidence ladder and its proof/inference split (DEC-034/035) | whatever the old records happen to carry |
| Staleness/refetch detection and its backoff | the "conversation changed" signal |

The value carried over is the **design** — which failure modes to refuse rather than guess at, and
in what order to resolve evidence. That is most of the thinking and none of the plumbing.

The single most transferable idea is the one that is easiest to skip: **a held element reference is
not an identity.** Any code that stores a node and uses it later is wrong on a recycling platform —
and it will not throw. Audit for **both** failure modes, because checking for one hides the other:

- **Same-node repurposing** — the node is reused for another message, so the code scrolls
  confidently to the **wrong content** and reports success.
- **Detach-and-remount** — the node is destroyed, so the reference is disconnected and the action is
  a silent **no-op**: nothing moves, nothing errors.

Which form Claude uses has **never been measured live** — this repo asserts both (backlog item 8), so
audit for both rather than picking one.

A search for "does this stored element still show the right text?" only finds the first.

### Step 4 — Do not forget the data users already saved

This is what turned one release into two. Bookmarks, and anything else persisted, may be keyed to
something that only behaved like an identity because the DOM was static — a position, an index, a
hash containing one. Those records keep working right up until the platform virtualizes, and then
they fail silently for existing users only, which is a class of bug that no amount of reviewing the
current diff will surface. Check for it **in the same release**, and recover by *earning* the new
identity from evidence the old record carries, refusing when the evidence is insufficient
(DEC-034/DEC-035).

### Step 5 — Ship a mock that genuinely unmounts

A static mock **cannot** fail on a Layer 4 break; the suite will be green through the entire
incident. `tests/mock-pages/claude-virtualized.html` is the reference: 40 turns, 3 mounted, the
rest removed from the document. Hiding rows with `display: none` does not reproduce the failure.
Until such a mock exists for the new platform, its fix is unverified regardless of the test count.

### Step 6 — Anything derived from a DOM count is now suspect on that platform

Sweep for it rather than waiting for reports. On Claude these were all separately broken and none
of them announced it: context-tracking percentages measured from container `innerText`; export
headers stating a message count; any `nInDOM / total` coverage ratio (which was always exactly 1.0
because both sides came from the same truncated scan); and message ordering via
`compareDocumentPosition`, which returns 0 for unmounted nodes and silently degrades a sort to
arbitrary order.

---

## Extension Transition (WXP) — Strategic Context

The current userscript architecture has a fundamental limitation: it operates as a guest in the page's security context, patching globals through `unsafeWindow` and relying on Tampermonkey's sandbox model. This worked when platforms had relaxed security postures. As platforms harden their frontends (see Layer 3 above), this approach becomes increasingly fragile.

### Why native extensions solve Layer 3

Native browser extensions (Chrome Web Store, Firefox Add-ons, Safari App Store) operate through official browser APIs that are designed for third-party code to observe and modify web pages:

- **Network observation (partial):** `webRequest` API monitors HTTP traffic metadata (headers, URLs, status codes) from the background script, but does **not** expose response body content. For SSE body parsing (which our context tracking requires — `thinking_delta` events, token data), the extension would still need to intercept `fetch` via a `world: "MAIN"` content script. The key improvement: this injection runs through the browser's official content script mechanism, not Tampermonkey's sandbox compartment, so the cross-compartment `.bind()` crash (v11.6) cannot occur.
- **Content script isolation:** Chrome's "isolated world" and Firefox's content script model provide clean separation without the cross-compartment `.bind()` problem that caused v11.6's crash.
- **CSP immunity:** Content scripts injected by extensions are exempt from the page's Content Security Policy. Even if a platform adds `script-src 'nonce-xxx'` that blocks all inline scripts, extension content scripts still run.
- **Proper storage:** `chrome.storage` / `browser.storage` replace `GM_setValue` with sync-capable, quota-aware storage.

### When to transition

The userscript remains the right choice for rapid iteration — one file, instant deployment, no review process. The extension transition makes sense when:

1. **Feature set stabilizes** — no major new panels or features planned
2. **Layer 3 breaks become frequent** — if multiple platforms start breaking monthly due to security changes, the maintenance cost of `exportFunction` workarounds exceeds the cost of extension packaging
3. **User base grows beyond tech-savvy early adopters** — "install Tampermonkey, enable Developer Mode" is a barrier for non-technical users
4. **Automated DOM validation framework is built** — the extension should ship with built-in DOM health checks, not bolt them on later

### What transfers and what doesn't

| Component | Transfers to extension? | Notes |
|-----------|------------------------|-------|
| PLATFORMS registry | ✅ Directly | manifest.json `content_scripts.matches` replaces `@match` headers |
| `getUserMessages()` / `getAIMessages()` | ✅ Directly | Same DOM queries, same fallback chains |
| Orbital UI system | ✅ Directly | Same CSS, same render engine |
| All 6 panel features | ✅ Directly | Navigate, Search, Bookmarks, Summary, Tools, Settings |
| SSE fetch interception | ⚠️ Simplified | Still requires fetch patching via `world: "MAIN"` content script (webRequest cannot read response bodies), but runs through official browser injection — no `unsafeWindow` or `exportFunction` needed |
| SPA history patches | ❌ Replaced | `webNavigation.onHistoryStateUpdated` API — no `history.pushState` patching |
| `GM_setValue` / `GM_getValue` | ❌ Replaced | `chrome.storage.local` / `browser.storage.local` |
| `exportFunction` workarounds | ❌ Eliminated | Not needed — content scripts use proper isolation |

The core product logic (~90% of the codebase) transfers directly. The ~10% that doesn't is precisely the fragile layer that causes execution breaks.

---

## Future: General Feature Ideas

- [ ] Keyboard shortcuts for navigation
- [x] Export conversation outline (stub panel exists in v10.0)
- [x] Bookmarks panel (stub panel exists in v10.0)
- [x] Conversation summary panel (stub panel exists in v10.0)
- [x] ~~Per-platform accent colors for app-builder platforms~~ (each app-builder platform has its own accent color in the PLATFORMS registry — Bolt sky blue, Lovable violet, Replit red-orange, V0 white, Base44 indigo, Emergent emerald, Firebase Studio dark tangerine)
- [ ] Convert to a standalone browser extension (beyond userscript)
- [x] Korean translated language mode for mom
- [ ] More translated language support in settings (?)
- [ ] Project overview, or chat links view (?) when we are outside of conversation view

---

*Last updated: 2026-03-16 (v11.8)*

