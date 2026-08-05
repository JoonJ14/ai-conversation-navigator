# Session Handoff — 2026-08-02/03 (v12.7: the Summary reads Korean — tokenizer, then the panels, then the docs)

**Scope:** three arcs, each discovered by checking the one before it. (1) `_sumTokenize` stripped
`[^a-z0-9\s]`, so a conversation written in **Korean** produced zero tokens and every
content-derived Summary feature was silently empty — for the product's only translated language.
(2) The live check then found the **Tools and Plan usage panels never called `i18n()` at all**:
thirteen Korean strings existed in the table and none was ever read. (3) Reframing the leftover
dead keys as owner preference then exposed **two of them as missing behaviour**, one a live bug.
**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-08-01_v12.5-v12.6-map.md`.

**Status at close — everything merged, nothing open:**
- **v12.7 — MERGED** (PR #70 → `06a079f`) and **LIVE-CONFIRMED** by the owner the same day.
  Pure-ASCII English byte-identical at 32/32 map fingerprints (accented English changes by
  design — that is the fix); Korean boundary recovery 12/32 → 28/32; suite green both engines
  with the repo's first non-English fixture.
- **v12.7a — MERGED** (PR #71 → `980aa68`). The Tools and Plan usage panels now call `i18n()`;
  reset phrases became `{placeholder}` templates because Korean orders the meridiem before the
  time. English output byte-identical over 58 cases.
- **Docs reframing — MERGED** (PR #72 → `fac7d50`), docs only, CI 9/9. Four Codex rounds, ten
  findings. See §B.7 — the durable outcome is **DEC-043**, and it exposed the `usageUnavailable`
  bug in §G.2a.
- **The live check settled the one open question**: the owner could not find the particle
  artefact §G.1 asked about (세션이 vs 세션), so **no display-only normalizer is wanted**.
- **Owner position on Korean mode, standing:** *"some things are actually better to stay in
  english than force translation to korean… i am fine with how the korean mode looks."* Partial
  English is accepted. Do not mass-translate to drive the dead-key audit to zero.

> **The one thing that is NOT done:** `usageUnavailable` — a failed Claude usage fetch leaves the
> panel reading "Plan usage loading…" **forever**, in both languages. Real, user-visible,
> pre-existing. Deliberately not fixed here: it is a code change on a network path (version bump
> + DEC-031 live confirm), and **the remedy itself needs an owner decision** — see §G.2a.

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

### 1d. The Tier 3 round — two CRITICALs that thirteen Codex rounds did not find

The five opus lenses plus a focused verifier delivered **~90 minutes after spawn**, long after
I had closed the round, opened the PR and run twelve Codex rounds. **I had already written
"Tier 3 delivered nothing" into the review artifact, `active.conf` and project memory. That was
wrong and is corrected in all three** — the lesson is mine: I set a 35-minute deadline, treated
silence at it as a result, and published the absence. *"No answer yet" is not "no answer."*

What the latency cost is the point:

- **The Korean CI fixture could not distinguish the shipped tokenizer from the variant this
  release rejected.** Built and measured: the widened class with the filter reverted to
  `w.length > 2` — `v1-charclass` — passes the entry **31/31**.
- **The two downstream re-check removals were ungated by every gate in the repo.** A mutant
  restoring both passes 31/31 *and* renders a byte-identical topic list; no probe caught it.

Mechanism for both: all eight rendered topics are BIGRAMS of the fixture's constant base
sentence, which repeats across 40 turns and outranks everything from the topic blocks. K1a gates
exactly one property — *Hangul survives the character class*.

**Fixed outside the fixture, deliberately.** Making a unigram outrank a 40×-repeated bigram
would mean distorting the fixture until it stops resembling a conversation. The properties are
gated where they can be: `check-tokenizer.js` T4 and a new T12 (which covers **both** topic
extractors — Codex then caught that my first T12 only drove one of them), and **the probes now
run in CI, which they never did**. Four mutants, all exit 1.

Two more defects only this release made reachable: `cap()` upper-cased on `/\b\w/`, ASCII-only,
so `naïve` → `NaïVe` in every label and the export; and the topic frequency maps were plain
objects, so the word **`constructor`** made the sort comparator return `NaN` and left the whole
topic list's order implementation-defined.

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

### 6. v12.7a — the Tools and Plan usage panels never called i18n() (PR #71)

**What.** Found by the owner live-testing v12.7: with the language set to Korean, the Tools panel
was still entirely English. **The cause was not missing translations — thirteen Korean strings
existed in `I18N.ko` with ZERO call sites.** `buildToolsPanel` and `renderUsageBars` rendered
English literals unconditionally. Only one word had to be authored: `exports` → **파일 내보내기**,
supplied by the owner.

**Why nothing caught it.** A dead i18n key is invisible from every angle at once: the table is
correct in isolation, the render code is correct in isolation, the suite asserts on English
fixtures and so cannot distinguish a translated panel from an untranslated one, and there is no
type system to flag an unreferenced key. It took a native speaker opening the panel. The audit
that finds them is now one command in `agent_docs/conventions.md`.

**The part that was not a wiring fix.** `formatResetTime` built its output by concatenation —
`'resets ' + day + ' ' + time + ' ' + ampm`. Korean puts the meridiem BEFORE the time (오후 3:05),
so **no substitution of translated fragments can fix it**: concatenation hard-codes word order.
The phrases became `{placeholder}` templates through `i18n(key, replacements)`, a capability the
helper has had since it was written with exactly one prior user.

**Verification.** English byte-identical, measured not argued: `formatResetTime` extracted from
both builds and run over **58 cases** — every minute-bucket boundary and every weekday × hour
reaching the date branch — **0 differences**. Suite 1120/1120 both engines. Key parity 78/78.

**Also fixed:** three `|| 'fallback'` branches that were unreachable AND disagreed with the table
value that renders, so the code claimed a wording it could never produce; and a typo that had
never been displayed (더 많은 도구가 **곳** 추가됩니다 — 곳 is "place", should be 곧 "soon").

**Owner decisions recorded in DEC-042:** `/Commands` stays English ("slash command" reads better
untranslated); and the mixed-language state between a language switch and a refresh is accepted —
*"that is a limitation i am willing to accept since we already warn about it anyway."*

### 7. The docs reframing — and what it exposed (PR #72 → `fac7d50`, docs only)

**Why it existed.** After the live review the owner stated a *standing* position, not a one-off
call about `/Commands`: partial English in Korean mode is fine. ROADMAP 0c was still written as
five defects awaiting a fix — a framing that would push a future session to mass-translate toward
a zero dead-key count, which is the opposite of what is wanted.

**What it found underneath.** Reclassifying the five keys as preference immediately broke on two
of them, because **a preference presupposes something rendering to have a preference about**:
- **`usageUnavailable`** — nothing renders in *either* language. A failed usage fetch leaves the
  panel claiming to still be loading, forever. A real bug, pre-existing, still open (§G.2a).
- **`summaryLanguageNote`** — empty English value, Korean-only disclaimer, never rendered, and
  v12.7 made its text substantially untrue. Needs an owner decision, not wiring.

The generalisation is now in `agent_docs/conventions.md`: **a dead key is not automatically a
preference** — check whether the surface behaves correctly without it before filing it as one.

**Four Codex rounds, ten findings, and a clean split.** All ten were errors this PR introduced;
none existed on `main`. Sorted by *kind of claim*, the result was total:

| Claim type | Outcome |
|---|---|
| **Qualitative** — the reframing; the two behaviour gaps; "two docs assert incompatible failure contracts" | **Every one survived** four adversarial rounds untouched |
| **Quantified** — "13 of 14" keys, "21 of 31" toasts, "9 vs 5" tooltips, "~5 sites", "everything else" | **Every one was wrong**, most twice |

**The finding that ended it.** The tooltip audit's "5 wired" counted three `TOOLS_EXPORT`
*data-object* `title:` fields — visible labels rendered via `textContent` — as DOM tooltips. That
is the identical population error caught one round earlier with the `PLATFORMS` registry,
committed again **inside the sentence documenting it**.

**Resolution: the counts were removed, not corrected a fifth time.** Docs now name members instead
of tallying them — a named surface is checkable in one grep; a tally can only be re-derived, and a
stale one reads as authoritative while being wrong. What the docs keep instead are the *audit
traps*, which is what actually cost the time: a `title:` key in a config or data object is not a
DOM tooltip, and a length-capped regex corrupts the **denominator** rather than misclassifying.
One tally is kept deliberately — `agent_docs/conventions.md`'s 9+3+2 dead-key baseline, because
there the number is load-bearing and every member is named beside it. **DEC-043.**

**Process lesson, also DEC-043.** By round 2 the DEC-029 provenance condition ("most findings are
the loop's own") was already met, and the loop ran twice more — because "is this converging?" was
judged *after* each round, against evidence that always admitted an optimistic reading. The fix
was to pre-commit: *one more round; any new finding in prose I wrote and I stop, however small.*
Round 4 returned three, and the pre-commitment made it unarguable. **A stopping rule evaluated
after seeing the results is not a stopping rule.**

Full cycle record: `reviews/review-2026-08-03-i18n-docs.md`.

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
- **Correcting a claim means grepping for every restatement of it — this bit four times in one
  session.** The tokenizer score survived in the code comment beside the rule it contradicted;
  "Tier 3 delivered nothing" survived in an experiment-log row below its own retraction; the key
  count survived in the two DURABLE surfaces after I fixed the two narrative ones; and the
  "five keys to fix" framing survived in HANDOFF §G — the first thing a new session reads —
  after I corrected ROADMAP, conventions and DEC-042. Every one was caught by review, none by me.
  And a FIFTH: after reframing §G item 2, §I's "all of §G items 2–5" rollup swept it straight
  back into deferred work. **Rollups and cross-references are restatements too** — an index that
  says "items N–M" re-asserts every claim in that range, so it must be re-read whenever any item
  in it changes meaning.
  The habit to build: after changing a number or a framing, grep the phrase, not the paragraph —
  and check what AGGREGATES over it.
  **PR #72 added four more instances of the same pattern**, which is why the next principle
  exists: at some point "grep harder" stops being the fix and the claim itself is the problem.
- **Name the members; do not tally them (DEC-043).** Across PR #72's four review rounds, *every*
  qualitative claim survived and *every* quantified one was wrong — "13 of 14" keys, "21 of 31"
  toasts, "9 vs 5" tooltips, "~5 sites". A named surface can be checked against the code in one
  grep; a tally can only be re-derived, and a stale tally reads as authoritative while being
  wrong, because falsifying it means reconstructing the whole measurement. It is also a future
  staleness bug by construction: correct the day it is written, wrong the next time anyone
  touches a string. **The remedy is not to compute more carefully — it is to stop putting the
  number in the document.** Keep the audit traps instead: a `title:` key in a config object or a
  data object is not a DOM tooltip, and a length-capped regex corrupts the DENOMINATOR (a site
  falls out of the population entirely) rather than merely misclassifying.
- **A stopping rule evaluated after seeing the results is not a stopping rule (DEC-043).**
  DEC-029's provenance condition was met at round 2 and the loop still ran to round 4, because
  "is this converging?" was judged post-hoc against evidence that always admitted an optimistic
  reading ("smaller than last time"). Writing the criterion down *before* the round — *any new
  finding in prose I wrote and I stop, however small* — made the answer unarguable. Same family
  as the project's existing preference for pre-committed criteria and for discrete metrics over
  continuous ones near a threshold.
- **State an effect's real size, especially your own fix's.** Removing those copies makes a
  frequent short word *eligible*; bigram weighting still decides whether it wins. The first
  draft of this handoff said Korean topics were "all bigrams" because of the filters — they
  are, in English too, for an unrelated reason. Measure the isolated effect before naming it.
- **A fixture in one language cannot gate a claim about another.** Every fixture was English,
  so a tokenizer returning `[]` for an entire language was invisible to CI.
- **Name the languages you fixed.** "Unicode support" would have been false the moment
  someone opened a Japanese conversation.
- **A deadline is not a measurement.** I declared a review tier empty because it had not
  answered in 35 minutes, and wrote that into three durable surfaces. It answered at 90 with the
  two most valuable findings of the release. Budget opus lenses at 90+ minutes on a large diff,
  spawn them first and collect last — and never report an absence with less care than a presence.
- **A translation that is never called is not a translation.** Thirteen Korean strings sat in the
  table, complete and correct, rendering nothing — and every gate in the repo was blind to it
  because both halves were individually right. Verify the WIRING, not the presence of the value.
  Generalises past i18n: any two-part mechanism where each part is independently valid can fail
  at the join with no symptom.
- **Never assemble a translated sentence by concatenation.** Word order is part of what a
  translation changes, and concatenation hard-codes it in the source. Korean's meridiem-before-
  time made this concrete: no reordering of fragments could produce a correct string.
- **A gate that cannot fail on the change it was written for is not a gate.** The Korean fixture
  was built specifically to prove the tokenizer fix, and it passes on a build with that fix
  reverted. What saved it was mutation-testing the gate itself, which is the only way to find
  this class.
- **"The same text" is not the same bytes.** Canonically equivalent Unicode has multiple
  encodings, and the platform decides which one you get. A character-class whitelist is a claim
  about bytes, so it must be preceded by a claim about normalization — otherwise it is correct
  only for the form you happened to test with.
- **A variant sweep must vary ONE thing.** Five builds that each differ from the shipped code in
  a second, uncontrolled way measure something other than the question asked.

---

## E. Git state

`main` @ **`fac7d50`** — clean tree, nothing unpushed, **no open PRs**. Three merged in order:

| PR | Branch | Merge | What |
|---|---|---|---|
| #70 | `fix/tokenizer-korean-v12.7` | `06a079f` | v12.7 tokenizer. Live-confirmed same day |
| #71 | `fix/tools-i18n` | `980aa68` | v12.7a panel i18n |
| #72 | `docs/i18n-preference-not-defect` | `fac7d50` | Docs reframing (§B.7). Docs only |

All three remote branches deleted. **Merge strategy on this repo is merge commits** —
`gh pr merge --squash` fails outright ("Squash merges are not allowed").

**Ordering trap worth remembering:** the v12.7a commit was authored while #70 was still open and
had to be cherry-picked onto the merged main — "fold it into #70" was no longer possible by the
time the work was done. The same thing happened again with #72 relative to #71.

**A git-config trap, fixed:** the repo had accumulated per-branch `remote.origin.fetch` refspecs
pointing at branches that were later merged and deleted, so `git pull` failed outright with
`couldn't find remote ref`. Restored to the standard `+refs/heads/*:refs/remotes/origin/*`. If
`git pull` ever fails that way again, check `git config --get-all remote.origin.fetch` first.

**Five local branches have gone remotes.** Three are fully merged into `main`; two
(`fix/firefox-fetch-skip`, `fix/tokenizer-korean-v12.7`) report UNMERGED because their content
reached main via merge commits while the branch tips are not ancestors — `git branch -d` will
refuse those. All five were left in place rather than force-deleted.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `DECISIONS.md` DEC-041 | the design, and both rejected alternatives with their mechanism |
| `DECISIONS.md` **DEC-043** | name members not tallies; pre-commit the review-loop stopping rule |
| `TROUBLESHOOTING.md` → the v12.7 entry | before/after measurements with their contexts |
| `ROADMAP.md` item 0a | closed, with the two things deliberately left open |
| `ROADMAP.md` item **0c** | the three preference keys, and the two behaviour gaps that are NOT preferences |
| `probes/check-tokenizer.js` | **12** checks incl. T8 (pins the LIMIT as an assertion) and T12 (both topic extractors) |
| `probes/README.md` Path D | the variant sweep and the English equivalence gate |
| `TESTING.md` → `koreanSummaryTest` | what K1a–K1c gate and why the base text is Korean |
| `reviews/review-2026-08-03-i18n-docs.md` | the four-round Codex cycle, its ten findings, and the split by claim type |
| `docs/SETTINGS.md` → "Scope of translation" | which surfaces are English, named — and the audit traps |

---

## G. What comes next

1. ~~**LIVE CHECK — the gate on this release (DEC-031).**~~ **DONE 2026-08-02.** The owner
   live-tested a Korean conversation: topics, bookmarks, search and the map all read correctly.
   **The particle question is settled by their answer**: they could not find the 세션이/세션
   artefact at all, so **no display-only normalizer is wanted** — do not build one on the
   strength of the synthetic observation alone. The same check surfaced the panel-i18n defect
   (§B.6), which is the shape to expect from live checks generally: they find the thing you did
   not think to measure, not the thing you did.
2. **Three i18n keys are never called — and that is a QUESTION, not a work item** (ROADMAP 0c):
   `questionPrefix`, `noQuestions`, `noBookmarksToExport`. They render English in Korean mode and
   the owner accepts that. **The owner reviewed Korean mode live and is satisfied with it:**
   *"some things are actually better to stay in english than force translation to korean when
   they can understand some english… i am fine with how the korean mode looks."* So do **not**
   pick those three up as a batch. If any is picked up at all, it is a per-string judgement —
   does Korean help *that* label? — and driving the dead-key audit to zero is explicitly not the
   goal. The nine `/Commands` keys are the settled case of the same principle.

2a. **TWO keys were originally filed with the three above and are NOT preferences — they are
   missing behaviour. The owner's "I'm fine with it" does not cover them**, because nothing
   renders in either language for them to be fine with. Both are real work:
   - `usageUnavailable` — **an open bug.** A failed usage fetch leaves the panel showing
     "Plan usage loading…" **forever**; the unavailable message never appears in either
     language. Pre-existing and user-visible. **The bug is that the panel reports an in-flight
     fetch that already failed** — wrong under any design, so it does not wait on the question
     below.
     **The REMEDY is an owner decision, and the repo currently asserts both answers:**
     `docs/PLAN-USAGE.md` §"Fetch fails" specifies rendering *nothing* on failure, while the
     existence of `usageUnavailable` in both language tables implies a *message* was intended.
     Pick one and make the other doc agree — ROADMAP 0c has both options written out. Either
     way it is a code change on a network path, so it is live-confirm gated (DEC-031).
   - `summaryLanguageNote` — **needs an owner decision, not a wiring fix.** An empty English
     value and a Korean-only disclaimer that has never rendered, while `docs/SETTINGS.md` says
     it does. v12.7 made its text substantially untrue, so **do not wire it as-is**. Three
     options in ROADMAP 0c.
3. **Key points are still unavailable in Korean**, for a different mechanism this arc does
   not reach: `KEY_POINT_PATTERNS` is a set of English regexes. Recorded in ROADMAP 0a, not
   fixed here. It needs its own Korean pattern set and its own measurement.
4. **The top level's merge rule — THEORETICAL, not scheduled** (ROADMAP item 0). Unchanged
   from the last handoff, including that the evidence once cited for it was a misreading and
   is retracted. Do not open it on that evidence.
5. **Carried-over fixture batch** — unmatchable-cluster/HEAD, assistant-TAIL, GM-shim backoff
   (incl. malformed JSON), exportBookmarks, forced-refetch knob, provisional-turn knob,
   key-point payload knob — plus the recorded small items (toolBlocks into the unmounted
   inventory, renderable-predicate off-by-2, `renderSummaryResults` try/finally).
6. **Backlog unchanged behind those** (Retry-After 429, §4.2 offset-cache reassessment, peek
   pane, mock-fidelity generator, debulking; Emergent deprioritized).

---

## H. Operational context + owner rules

- **Correctness outranks further optimization** (standing ranking rule). Item 11 is closed at
  ~1.2s by owner decision; only a conversation large enough to put the freeze banner back
  should reopen it.
- **Execute-and-narrate** stands. **Merge authority is per-PR and explicit** — no PR is
  authorized to merge by anything in this document; authorization is given per PR, in the
  session. (All three PRs in this arc were authorized that way and are merged; §E.)
  **DEC-031 gates live-code merges on a live confirmation**, and §G.1 was that gate for v12.7.
- **Stop review loops on provenance** (DEC-029), with the standing exception: a loop-era
  finding that *weakens the evidence for the shipped change* earns another round.
  **And pre-commit the criterion before the round runs** (DEC-043) — PR #72 met the provenance
  condition at round 2 and still ran to round 4, because the judgement was made after seeing
  each round's findings, which always admitted an optimistic reading.
- The owner tests on **Firefox + Tampermonkey**; probe builds are per-measured-build (DEC-027).
- Explicit `git add` paths, never `-A`; commit before mutating; suite both engines before push.

---

## I. Deferred / future work

§G items **2a** and **3–6** — the two missing-behaviour keys, key points in Korean, the
theoretical top-level merge rule, the carried-over fixture batch, and the backlog behind them.
The `overflow-anchor: none` mock assumption remains unverified (carried).

Of those, **§G item 2a is the only one that is a user-visible bug rather than a backlog item**:
`usageUnavailable` leaves the usage panel permanently claiming to be loading after a failed
fetch. `summaryLanguageNote` in the same item is blocked on an owner decision, not on work.

**§G item 2 is deliberately NOT in this rollup.** The three unwired i18n keys are an owner
PREFERENCE, not deferred work: Korean mode was reviewed live and accepted as-is. Listing them
here would put them back in the schedulable pile, which is exactly the reading this session
corrected. If they are ever picked up it is per-string, by the owner's judgement, not as a batch.
**Item 2a is a different thing and IS deferred work** — do not let the exclusion of item 2 pull
it out of the pile too.

---

## J. Risk caveats / known limitations

- ~~**No live confirmation yet.**~~ **Live-confirmed 2026-08-02** — the owner reports topics,
  bookmarks, search and the map all reading correctly in Korean. The synthetic caveat still
  applies to the NUMBERS: the generator's topic blocks are lexically disjoint by construction,
  while real conversations drift, revisit and interleave. What the live check establishes is
  that the feature works and reads acceptably, not that 28/32 transfers.
- **A language switch leaves Tools mixed until refresh** — the gallery header re-renders on
  panel open, the exports section is built at injection. Owner-accepted (DEC-042), and the
  `languageChanged` toast already says "refresh to apply". Do not "fix" it without re-opening
  that decision.
- **Three i18n keys render English in Korean mode** (ROADMAP 0c) — known, and **accepted by the
  owner**, not merely deferred. Partial English in Korean mode is a preference, not a defect.
- **Two dead keys are NOT preferences — they are missing behaviour** (ROADMAP 0c).
  `usageUnavailable`: a failed usage fetch shows "Plan usage loading…" forever, in both
  languages. `summaryLanguageNote`: a Korean-only disclaimer that has never rendered, promised
  by `docs/SETTINGS.md`, whose text v12.7 made substantially untrue.
  **The lesson underneath both:** a key with no call site is not automatically a translation
  question — check first whether the surface behaves correctly without it. Two of the fourteen
  did not.
- **Most toasts are hardcoded English** — the export progress/success messages, "Summary
  exported", "All bookmarks cleared" and others. Not a decision anyone made; simply unwired.
  **Deliberately not stated as a ratio here.** This handoff and `docs/SETTINGS.md` both carried
  a "21 of 31" that was wrong in the *denominator* — the counting script capped call sites at
  120 characters, so a multi-line conditional fell out of the population rather than being
  classified. Every tally written during PR #72 was wrong at least once. Name the surfaces;
  re-derive numbers with the audit in `agent_docs/conventions.md` when you actually need them.
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
