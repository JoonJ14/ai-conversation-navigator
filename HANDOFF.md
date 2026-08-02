# Session Handoff — 2026-08-02 (v12.7: the Summary tokenizer can read Korean)

**Scope:** one arc, the item the last session scheduled. `_sumTokenize` stripped
`[^a-z0-9\s]`, so a conversation written in **Korean** produced zero tokens and every
content-derived Summary feature was silently empty — for the product's only translated
language. **Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-08-01_v12.5-v12.6-map.md`.
**Status at close:** version **12.7**, PR open, pure-ASCII English output byte-identical at
32/32 map fingerprints (accented English changes by design — that is the fix), Korean
boundary recovery 12/32 → 28/32, suite green both engines with a new non-English fixture. **Live confirmation on a Korean conversation is still outstanding
(DEC-031) — see §G.1.**

---

## A. State in one paragraph

Korean is the only translation this product ships (`I18N.ko`, added for one specific user).
That user had a fully translated interface wrapped around a Summary that could not read a
single word of their conversation: topics empty, key points empty, dedup inert, and both
levels of the conversation map finding nothing. The character class was the known half
(ROADMAP 0a). The half nobody had noticed was `w.length > 2` — an English rule, since
2-letter English words are function words, while Korean's commonest **content** words are
exactly two syllables (인증, 세션, 토큰, 권한). Fixing only the character class still threw
those away, 10 of 10. Both are fixed; five candidate designs were built and scored, and the
two more elaborate ones were built and measured. **The rejection of particle normalization
did NOT survive review** — the comparison that produced it was invalid (see §1b) — so v2 ships
on grounds independent of the score, and the live check decides.

---

## B. What was accomplished

### 1. The fix (2 lines of behaviour, in `_sumTokenize`)

Character class → `[^a-z0-9À-ɏ가-힣\s]` (ASCII + diacritic Latin +
Hangul). Minimum token length → **2 when the token contains Hangul, 3 otherwise**.

Plus two **redundant** copies of the English length rule removed from
`_sumExtractTopicsFromText` and `_sumExtractTopics`. They re-tested `< 3` / `> 2` on words
`_sumTokenize` had already filtered, so for English they were no-ops — and for Korean they
discarded exactly the 2-syllable words the tokenizer had just correctly kept, so no
2-syllable Korean noun could become a topic **at any frequency** (measured: a term appearing
8 times, more often than any bigram in the same text, was still absent; present and ranked
first once removed). Found while self-reviewing the first version of this change.
**Its effect is narrower than it sounds, and the docs say so:** bigrams are weighted 2x and
cover their own words, so they outrank unigrams in *both* languages. The removal makes a
frequent short word eligible; it does not change the ranking rule.

### 1b. Two Codex findings, both real, both about measuring the wrong thing

**Normalization form.** Neither the DOM nor the API guarantees one, and **macOS emits NFD for
Korean input** — the platform the target user may be on. In NFD the whitelist is defeated exactly
as the ASCII-only class was (decomposed Korean is U+1100 Jamo, not the syllable block → zero
tokens), and decomposed Latin is *corrupted* rather than dropped (`résumé` → `sume`). Fixed with
`.normalize('NFC')` first in the pipeline; gated by T10/T11, which assert **equality with the NFC
result** because a non-empty check would have passed the Latin corruption.

**The variant sweep was not measuring the shipped pipeline.** The builder patched only
`_sumTokenize` and left the downstream guards in place. Re-run with every variant carrying the
shipped downstream: two rows moved (particle normalization improved), four identical, **ranking
unchanged**. The finding was material — it improved the *rejected* option, the direction that
could have overturned the decision. **It did overturn it one round later**, once the third
defect in the same comparison (per-language ground truth) was fixed — see §1c.

### 1c. Codex round 3 — the finding that overturned a conclusion

**The payload's ground truth was language-dependent.** Topic-block lengths were drawn from the
same LCG as the text, and `koSentence` consumes extra draws (connectives, particle agreement),
so Korean got **9 boundaries in different places** where English had 8. Every cross-language
statement in the first draft of this arc was therefore meaningless, and — worse — the *variant
ranking* was computed against it.

Fixed by deriving the schedule from a throwaway ENGLISH render in every language
(`computeSchedule`), which makes the ground truth language-independent **without changing the
English payload by one byte** — verified byte-identical at all four knob settings, and guarded
by `assertEnglishScheduleUnchanged()` at require time against a recorded prior measurement.

**Re-run, the ranking reversed.** Particle normalization now leads on recall (31/32 vs 28/32).
The rejection recorded in the first draft is retracted; v2 still ships, on grounds that do not
depend on the score. See §2.

All three Codex findings share one shape: **the thing measured was not the thing shipped** —
once in the input's encoding, once in the build under test, once in the yardstick itself.

### 2. Five variants, scored — and a conclusion that reversed twice

`probes/build-tokenizer-variants.js` writes cumulative candidate builds; the map harness
scores each against the payload generator's **known** topic changes, four payload shapes ×
two engines (Firefox and Chromium agreed on every cell).

| build | found (of 32) | spurious |
|---|---|---|
| shipped, ASCII-only | 12 — *and only from incidental filenames/turn numbers* | 36 |
| + wider character class | 28 | 12 |
| **+ script-aware length (SHIPPED)** | **28** | **11** |
| + Korean stop-word list | 27 | 11 |
| + particle normalization + stop list | 30 | 10 |
| + particle normalization, no stop list | **31** | 13 |

> **RETRACTION.** An earlier version of this table reported particle normalization as
> *worse*, and the rejection was written on that basis. **That comparison was invalid**: the
> payload generator drew topic-block lengths from the same LCG as the text, and Korean
> sentences consume a different number of draws, so Korean was scored against a **different
> ground truth** than English — 9 boundaries in different places rather than 8 (GitHub Codex,
> PR #70). With the schedule made language-independent and every variant re-run, the ordering
> **reverses**: particle normalization leads on recall (31/32 vs 28/32).
>
> **The rejection is NOT supported by measurement and is no longer claimed to be.** v2 ships
> on grounds independent of the score — it keeps Korean in the segment-count regime English is
> calibrated and live-confirmed in (~278 initial segments vs ~22–85), and it adds no
> hand-maintained particle list that can merge distinct words. This metric has reversed three
> times, once per measurement defect corrected. The live check is the arbiter (DEC-031).

**The reversal is the part worth carrying.** At ONE configuration, particle (josa)
normalization beat the shipped fix 9/9 to 8/9, and led on every available intuition:
same-topic overlap 0.227 → **0.450**, six surface forms of one noun collapsing to one token,
**10× fewer** initial segments, and visibly cleaner labels (세션 rather than 세션이). Across
four shapes it lost. I had already written it up as the winner once before the matrix
existed. **Mechanically:** segmentation reads the CONTRAST between adjacent blocks, not
absolute cohesion — collapsing surface forms raises overlap everywhere, including between
unrelated blocks, so valleys get shallower relative to the floor. It also moved Korean into a
segment-count regime (~22 initial vs ~278) that **nothing in this project has been calibrated
in**, while the shipped fix keeps Korean in the same regime as English, the one the owner has
live-confirmed.

Note the first row: the broken build was **not** scoring zero. A realistic Korean technical
conversation contains ASCII — filenames, turn numbers, code — so the old tokenizer drew 12
boundaries out of that residue. Structure drawn from noise looks exactly like structure.

### 3. Pure-ASCII English proven unchanged, rather than argued

32/32 map fingerprints byte-identical against an **explicit pre-change ref** (not HEAD), both
engines, sizes 2/3/25/147 × vocab 1,4 × para 1,3. The reasoning that predicts it — a widened
class can only preserve characters the old one dropped, and `>= 3` is the same set as `> 2`
for non-Hangul — was checked rather than trusted, which is what caught the two redundant
filters.

**Scope it precisely.** English *containing accents* does change: that is the `résumé` → `sum`
fix, not a regression. And the fingerprint covers segmentation, labels and topics — global
topics and key-point dedup are outside it, and rest on the construction argument plus the
suite, not on the fingerprint.

### 4. The English damage was worse than documented

`café` → `caf` was on the roadmap. Measured on the real function: `naïve` and `déjà vu`
**vanish entirely**, and `résumé` → **`sum`** — not truncation but substitution by an
unrelated real English word that then competes for a topic slot. Corruption, not loss.

### 5. The suite's first non-English fixture

`Claude (Korean conversation + index)` mirrors `Claude (virtualized + index)` exactly, with
`lang: 'ko'` on both the mock and the GM fixture. It asserts topics contain **Hangul** — not
merely that topics exist, because the fixture also carries ASCII turn numbers and a tokenizer
picking up only those would render a non-empty list of pure noise — and asserts sub-segment
starts at `[0, 27, 55]`, the same positions from the same topic rule that S1b asserts in
English. The **base** message text had to become Korean too; built on the English base text
the fixture would still have handed the old tokenizer English tokens and could not have gone
red.

---

## C. Architecture snapshot

Unchanged apart from `_sumTokenize` and the two redundant filters. `_sumWordOverlap`,
`_sumCohesionCuts`, `_sumBuildSubSegments` and the merge loops are untouched — this arc
changed what those functions *see*, never what they do. `probes/` gained
`check-tokenizer.js` and `build-tokenizer-variants.js`; `perf-payload.js` gained
`PAYLOAD_LANG` (default `en`, verified byte-identical to the pre-change generator).

---

## D. Key principles established

- **"Run the matrix" was not enough — the comparison reversed THREE times.** Once when a
  single configuration became four; once when the variants were made to carry the shipped
  downstream; once when the payload's ground truth was made language-independent. The real
  rule is narrower and harder: **before comparing two builds, check that the only difference
  between them is the thing under test, and that the yardstick is identical for both.** Two of
  the three defects were a yardstick that differed between the things being compared.
- **A conclusion that survived three corrections of its own evidence should be held loosely.**
  The particle-normalization rejection did not survive; it is retracted. What ships now rests
  on properties that do not depend on the score at all.
- **A metric can improve while the thing it serves gets worse.** Same-topic overlap doubled
  and segmentation got worse, because segmentation reads contrast, not cohesion. Ask what the
  downstream consumer actually reads.
- **A filter repeated downstream is a second place for the same assumption to be wrong.**
  The English length rule was written three times; fixing the tokenizer alone still left two
  copies deciding that no 2-syllable Korean noun could be a topic at any frequency.
- **State an effect's real size, especially your own fix's.** Removing those copies makes a
  frequent short word *eligible*; bigram weighting still decides whether it wins. The first
  draft of this handoff said Korean topics were "all bigrams" because of the filters — they
  are, in English too, for an unrelated reason. Measure the isolated effect before naming it.
- **A fixture in one language cannot gate a claim about another.** Every fixture was English,
  so a tokenizer returning `[]` for an entire language was invisible to CI.
- **Name the languages you fixed.** "Unicode support" would have been false the moment
  someone opened a Japanese conversation.
- **"The same text" is not the same bytes.** Canonically equivalent Unicode has multiple
  encodings, and the platform decides which one you get. A character-class whitelist is a claim
  about bytes, so it must be preceded by a claim about normalization — otherwise it is correct
  only for the form you happened to test with.
- **A variant sweep must vary ONE thing.** Five builds that each differ from the shipped code in
  a second, uncontrolled way measure something other than the question asked.

---

## E. Git state

`main` @ `2ad8dc1` (v12.6). This session's work is on `fix/tokenizer-korean-v12.7`, PR open.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `DECISIONS.md` DEC-041 | the design, and both rejected alternatives with their mechanism |
| `TROUBLESHOOTING.md` → the v12.7 entry | before/after measurements with their contexts |
| `ROADMAP.md` item 0a | closed, with the two things deliberately left open |
| `probes/check-tokenizer.js` | 8 checks incl. T8, which pins the LIMIT as an assertion |
| `probes/README.md` Path D | the variant sweep and the English equivalence gate |
| `TESTING.md` → `koreanSummaryTest` | what K1a–K1c gate and why the base text is Korean |

---

## G. What comes next

1. **LIVE CHECK — the gate on this release (DEC-031).** Everything above is synthetic. The
   owner should open a **Korean** conversation on claude.ai (Firefox + Tampermonkey, visible
   tab) and look at Summary → Generate. Three specific questions, because the third is a
   judgement only they can make:
   - Do **topics** and the **map** now have content at all?
   - Do the segment groups read like real topic groups, as the English ones do since v12.6?
   - **Do the Korean labels read acceptably?** They will carry particles — 세션이 rather than
     세션 — because the tokens feeding labels are the matching tokens. A **display-only**
     normalizer would fix the reading without touching any measure; it is deliberately not
     bundled, and this is the right instrument for deciding whether it is wanted.
2. **Key points are still unavailable in Korean**, for a different mechanism this arc does
   not reach: `KEY_POINT_PATTERNS` is a set of English regexes. Recorded in ROADMAP 0a, not
   fixed here. It needs its own Korean pattern set and its own measurement.
3. **The top level's merge rule — THEORETICAL, not scheduled** (ROADMAP item 0). Unchanged
   from the last handoff, including that the evidence once cited for it was a misreading and
   is retracted. Do not open it on that evidence.
4. **Carried-over fixture batch** — unmatchable-cluster/HEAD, assistant-TAIL, GM-shim backoff
   (incl. malformed JSON), exportBookmarks, forced-refetch knob, provisional-turn knob,
   key-point payload knob — plus the recorded small items (toolBlocks into the unmounted
   inventory, renderable-predicate off-by-2, `renderSummaryResults` try/finally).
5. **Backlog unchanged behind those** (Retry-After 429, §4.2 offset-cache reassessment, peek
   pane, mock-fidelity generator, debulking; Emergent deprioritized).

---

## H. Operational context + owner rules

- **Correctness outranks further optimization** (standing ranking rule). Item 11 is closed at
  ~1.2s by owner decision; only a conversation large enough to put the freeze banner back
  should reopen it.
- **Execute-and-narrate** stands. **Merge authority is per-PR and explicit** — this PR is not
  authorized to merge by anything in this document. **DEC-031 gates live-code merges on a
  live confirmation**, and §G.1 is that gate for v12.7.
- **Stop review loops on provenance** (DEC-029), with the standing exception: a loop-era
  finding that *weakens the evidence for the shipped change* earns another round.
- The owner tests on **Firefox + Tampermonkey**; probe builds are per-measured-build (DEC-027).
- Explicit `git add` paths, never `-A`; commit before mutating; suite both engines before push.

---

## I. Deferred / future work

All of §G items 2–5. The `overflow-anchor: none` mock assumption remains unverified (carried).

---

## J. Risk caveats / known limitations

- **No live confirmation yet.** Every number in this handoff is synthetic, from a generator
  whose topic blocks are lexically disjoint by construction. Real conversations drift,
  revisit and interleave. What is established is the MECHANISM and that English is
  bit-for-bit unaffected; whether Korean segmentation *reads* right is §G.1.
- **The Korean payload is generated, not real.** Its particle distribution is modelled
  (받침-correct), but its sentences are vocabulary-driven word salad, exactly like the English
  payload. A real Korean conversation mixes English technical terms far more heavily.
- **Fixed for English and Korean only — this is NOT "Unicode support".** Japanese and Chinese
  are not space-separated; a character class would give them roughly one pseudo-token per
  sentence and the map would draw structure out of noise instead of correctly finding none.
  Greek, Cyrillic and kana are excluded for the same reason. `check-tokenizer.js` T8 pins
  this as an assertion so it cannot quietly be re-described.
- **Korean sub-segment labels carry particles** (see §G.1, third question).
- **webkit-on-macos has two documented failure variants** (DEC-036 + the silent wedge in
  TESTING.md). Requeue-once clears the first; the second cleared itself after ~65 minutes.

## K. Kickoff prompt for the next session

(maintained in the final summary of this session; paste-ready copy lives there)
