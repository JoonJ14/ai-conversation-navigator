# Session Handoff — 2026-07-29 (v12.1: legacy bookmark recovery)

**Scope:** every pre-v12.0 Claude bookmark was silently dead under virtualization. All 16 of
the owner's are now recovered, the panel shows message text instead of matching keys, and the
work went through Tier 1/2/3 review plus a GitHub Codex cycle that ended in a genuine clean
round.
**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-07-28_v12.0-premerge.md`.
**Branch:** `feat/v12.1`, **PR #59 OPEN at `f45fb69`**, 9/9 CI, 20 commits ahead of main.
**NOT MERGED — the owner merges after live confirmation.**

---

## A. State in one paragraph

v12.0 shipped an API-backed index that gave Navigate, Search and Export the whole
conversation — but bookmarks still keyed to a content hash with no uuid, and only a uuid lets
a click reach an unmounted message. So every pre-v12.0 Claude bookmark worked *only while its
message happened to be on screen*: dead in a released version, and the first bug report after
any public push. This session recovered all 16 of the owner's records through an **evidence
ladder** (DEC-034): three text channels plus a **hash oracle** that reproduces the stored
schema-1 hash against mounted rendered text, where equality is proof rather than inference.
Getting there required measuring the real payload through Chromium rather than reasoning about
it — which confirmed the thinking-summary hypothesis *and* revealed that the DOM truncates
those summaries for display, the detail that made the first matching rule fail. Panel labels
were then separated from matching keys so a row shows the message rather than the key that
found it. Review found two more CRITICALs, one of them architectural: **inference was
committing before proof and destroying the evidence proof needed** (DEC-035). Suite grew
374 → **515 across 25 platform entries**.

---

## B. What was accomplished

### 1. Legacy bookmark recovery — from 0/16 to 16/16

**What.** `_bmMigrateLegacy`, `_bmLegacyPathIndexFor`, `_bmHarvestLegacyFromMounted`,
`ciExtractThinkingSummaries`, `_bmFailToast`. Commits `1114749` → `e4c82a9`.

**Why.** A schema-1 record stores `contentHash` + a 120-char `preview`, no uuid. Under
recycling only ~3–7 rows are mounted, so hash matching against mounted elements — the only
resolution path those records had — almost never has the right message in front of it.

**The arc, including two wrong turns.** First attempt matched the preview as a prefix of the
index text: **7 of 16**, all of them the ones whose preview began with our own `⚑` glyph
(pre-v12.0 previews predate the `_cleanText` strip). The other 9 previews were Claude's
**collapsed activity summary** — `"architected layered governor mechanisms…"` — describing the
message rather than quoting it, so no amount of body matching could ever reach them. I called
those unrecoverable. That was wrong: the preview is not noise, it is a faithful capture of a
*different field*, and that field rides in the payload's thinking blocks, which `ciBuildIndex`
already walked for `thinkingChars` and simply discarded.

**The measurement that settled it.** Rather than guess again, I fetched the owner's real
297-message conversation through Chromium using the userscript's own URL parameters. Two
findings: **61 thinking blocks, 55 carrying `summaries:[{summary}]`** — hypothesis confirmed;
and the DOM header **truncates** the summary for display, so the captured preview holds a
truncated (usually doubled) copy while the payload holds the full text. Whole-string prefix
matching therefore failed in both directions on 3 of the 6 live shapes. A **40-char
bidirectional probe** binds all 6, each to exactly one assistant entry.

**Verification.** Ancestor-gated fixtures; live-confirmed by the owner — *"about 5 to 7
unmatched"* after the first fix, then all recovered after the probe.

### 2. The hash oracle, and an evidence ladder (DEC-034)

**What.** `_bmHarvestLegacyFromMounted` + `_bmCommitLegacyUpgrade`.

**Why.** `contentHash` cannot be inverted but it *can be reproduced*: hash what is mounted now
under the plausible ordinals, and equality is identity (~2⁻³²). That makes it categorically
different from the text rules — it cannot guess — so it is exempt from the refuse-on-ambiguity
gate the inference channels need.

**How.** Runs per scan over the mount window and at click time, gated on a mount-set change
(the only thing that can newly reproduce a hash). **Both ordinal eras are tried:** pre-v12.0
hashes used the rendered-only enumeration index while `_bmPathOrdinal` counts non-rendering
entries too — one interrupted turn early in a conversation would have silently zeroed every
later hash.

### 3. Label vs key — the panel shows the message (owner-requested)

**What.** `_bmDisplayText`, `_bmDisplayOrdinal`. Commits `5c5f101`, `983f329`.

**Why.** Owner feedback after the recovery: a summary-labelled row identifies the record to the
code but not to the human — *"I have to guess what that is [until] I click on it."*

**How.** The stored preview stays as matching evidence and is **never rewritten**; the panel
and the bookmarks export derive their label from the index by uuid at render time. The Q#/A#
badge is derived too — a migrated record rendered **"A#91" in an 8-message conversation**,
found by the live-data check, not by review. Human ordinals count `_questions` so the badge
agrees with the Navigate list; assistant ordinals count only rendering entries.

**Verification.** Live-data harness (real payload shapes + the owner's verbatim previews +
real userscript, rendering the actual panel): **8/8 uuid-keyed, every label message text, zero
summary or glyph labels**, ordinals A#2–A#8 / Q#8.

### 4. Tier 1/2/3 review — 36 raw findings, 21 verified

**What.** Tier 1/2 by me (`02d7fcf`), Tier 3 as a 5-lens opus workflow with per-finding
skeptics (`8ee17c4`). Artifacts in the workflow transcript dir.

**The two CRITICALs.**
- **Rule C's reverse probe had no floor on the preview.** Three lenses independently
  reproduced it. The needle is `want.substring(0, 40)` — only 40 chars when the preview *has*
  40 — so a short preview degraded it to an unbounded substring test, found incidental overlap,
  passed the uniqueness gate on that single hit, and bound permanently. My own comment claimed
  *"uniqueness is the gate that makes 40 chars safe"* while the code was not using 40 chars.
- **Inference committed before proof, and destroyed it** (→ DEC-035). `_bmCommitLegacyUpgrade`
  overwrote `contentHash` with the uuid — the one piece of proof-grade evidence the record
  carried. Text rules ran first, so a wrong guess became permanent *and* unverifiable. Now the
  hash is preserved as `legacyHash`, every record records `boundBy: proof|inference`, the
  harvest may **correct** an inference binding, and proof runs before inference in a scan.

**Also fixed:** a harvest-bound record rendered an *inactive* flag, so clicking it deleted the
record just recovered; the panel fingerprint omitted every index-derived input, freezing labels
for a whole session; `exportBookmarks` sorted by the stale ordinal while labelling with the
derived one; `ciInvalidate` dropped the memo's stamp but not its payload; a string-valued
`summaries` would have iterated per character; a bare catch hid a permanent failure; ambiguous
records logged as UNMATCHED; a throw in migration aborted the rest of the scan and was never
retried.

**Workflow note.** The five lenses produced their reports but the workflow's return was
initially `null` — the work was in the transcripts. *Check the artifact, not the completion
signal*, again.

### 5. GitHub Codex cycle — 3 rounds to a genuine clean round

Round 1: migration ran before `_questions = indexed`, so human ordinals read the previous
conversation's list, and that refresh cached the new `_ciIndexGen` so the correct refresh
early-returned; a correction left the wrongly-inferred row wearing an active flag, so clicking
it would add a *second* bookmark for the wrong message. Round 2: the diagnostic printed
UNMATCHED for ambiguous records and `_bmDiagnosed` suppressed the correction forever; and
**DEC-032 aimed at my own chip fixture** — its bounds tolerated a range, so the knob could go
vacuous again. Now asserts the property directly and is **mutation-verified**. Round 3:
`ACN_VERSION` still said `12.0` while the header said `12.1`.

Round 4 returned *"Didn't find any major issues."* One transient `Unknown error` was retried
rather than counted as clean — a wrapper's signal is not the work's signal.

**Provenance (DEC-029):** 5 findings, 3 pre-existing / 2 cycle-introduced, zero false
positives. Still pre-existing-dominant at the clean round, so it converged rather than being
stopped.

---

## C. Architecture snapshot

Unchanged from the predecessor except the bookmark subsystem:

- **Evidence ladder** (DEC-034): rule A prefix → rule B body-probe → rule C summary-probe →
  hash-oracle harvest. All sender-scoped; A/B/C uniqueness-gated and floored at 25/40 chars;
  the harvest is proof and exempt.
- **Provenance on every record**: `legacyHash` (preserved oracle), `boundBy: proof|inference`.
  Proof outranks inference and may correct it.
- **Display derives from the index** (`_bmDisplayText` / `_bmDisplayOrdinal`); storage is
  matching evidence only.
- **Cost gates**: `_bmPendingLegacy` (skip when nothing un-uuid'd), `_bmHarvestSeen`
  (mount-set change), `_bmNormPath` (normalization memoized per index generation, released on
  `ciInvalidate`).
- `ciExtractThinkingSummaries` → `thinkSummaries` per entry, `Array.isArray`-guarded.

---

## D. Key principles established

- **Proof outranks inference, and inference must never destroy proof** (DEC-035).
- **Measure the payload, don't reason about it.** Two wrong turns ended the moment the real
  conversation was fetched through Chromium.
- **A preview that doesn't match the message may be a faithful capture of a different field.**
  "Unmatchable" was a statement about the rule, not the data.
- **Apply your own rules to your own work.** DEC-032 was written this week and was violated in
  the very fixture written to demonstrate it.
- **Refusing is recoverable; a wrong binding is not.** Every gate resolves that way.

---

## E. Git state

`feat/v12.1`, pushed, **PR #59 OPEN**, 9/9 CI green, tree clean. **Owner merges after live
confirmation** — do not merge.

**The last code-bearing commit is the Codex R5 fix** (one argument on the bookmark click path —
an exact-hash legacy match now records `boundBy: 'proof'` instead of `'inference'`, so
`_bmPendingLegacy` can actually clear). `f45fb69` was the previously confirmed build; per DEC-031
the owner's live confirmation must be taken **on HEAD**, not on `f45fb69`. The change is small and
one-directional, and the surface it touches — recovered bookmarks landing on their messages — is
exactly what the live check already exercises.

Verified on HEAD: **515/515 both engines**, and the live-data label harness re-run in Chromium
(8/8 uuid-keyed, 0 summary labels, 0 glyph labels).

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `docs/handoffs/SESSION_HANDOFF_2026-07-28_v12.0-premerge.md` | v12.0 hardening arc, Q#1 regression |
| `DECISIONS.md` DEC-021..035 | design rationale; 034/035 are this session |
| `TESTING.md` | fixture knobs incl. `chipRows`, `summaryRows`, `seedBookmarks`, `identicalAnswerRows` |
| `tests/test-all-platforms.js` "Claude (legacy schema-1 bookmarks)" | the recovery fixture matrix |
| `DOM-REFERENCE.md` Probe E | the payload's thinking-block shape, with its n=1 measurement context — the evidence rule C rests on |
| `TROUBLESHOOTING.md` v12.1 entry | the recovery arc as a diagnosis guide, incl. what `summaries=0` means |
| `CHANGELOG.md` 12.1 | the release narrative and its stated limitations |

---

## G. What comes next

1. **Owner live-confirms `f45fb69`, then merges #59.** Specific checks: the console line
   `[ACN bookmarks] legacy status: all records carry a uuid`; a few recovered bookmarks landing
   on the messages they name; panel labels showing message text for both questions and answers.
2. **Summary/Export fixtures** — still the zero-execution zone (mutation-proven). Highest
   remaining value in the release.
3. **Retry-After honoring for HTTP 429** — plumb response headers through `ciRequestJSON`.
4. **Reassess, don't build: §4.2 offset cache.** Measure a live repeat jump first; if
   sub-400ms, close as satisfied-by-redesign.
5. **Peek pane (spec §9)** — show the exchange inline from the index.
6. **Mock fidelity — payload generator.** Explicit limit already recorded: it captures **API
   structure only** and would not have caught the v12.0 chip regression, which lived in the DOM.
7. **Debulking** — ~11,500 lines now. Known dead code listed in the predecessor handoff §G.

---

## H. Operational context + owner rules

- **Merge authority is the owner's alone**, gated on live confirmation. Standing since Phase 3.
- **The owner runs live tests on Firefox + Tampermonkey.** Chromium here is a *different
  context* — page realm, separate TM storage — and cannot see the owner's bookmarks.
- **Overnight autonomy granted for this session** (2026-07-29): "don't ask for permissions…
  just do it and fix it and debug it as long as it keeps the code clean and concise", with the
  standing condition that any major change is re-verified in Chromium before moving on. This
  was session-scoped; do not assume it persists.
- **Stop the review loop on provenance, not round count** (DEC-029).
- **Report faithfully over favourably.** Two reproduction attempts failed this session and were
  reported as failures, not narrated as progress.

---

## I. Deferred / future work

- §G items 2–7.
- **Legacy records that remain unmatched** (ambiguous or no usable evidence) keep their record
  and say "recreate it". The remaining option — binding on the stored `msgIndex` — was rejected:
  position establishing identity is DEC-033's failure mode.
- The `overflow-anchor:none` mock assumption remains unverified directly.

---

## J. Risk caveats

- **⚠ NOT LIVE-VERIFIED AT `f45fb69`.** The owner confirmed labels and recovery at an earlier
  commit; 6 commits of review fixes landed after, touching migration ordering, the panel
  fingerprint, and icon state. The live-data harness re-ran green on the final commit, but that
  is Chromium page realm, not Firefox+Tampermonkey.
- **⚠ Summary, Tools and Export still have ZERO test execution** (mutation-proven, carried from
  the predecessor). Any suite number about that code is unearned.
- **⚠ One honest test-debt item, recorded in the fixture itself:** "a harvest-bound record
  renders an ACTIVE flag" is unasserted — the bound row is not reliably mounted when the panel
  is read, so every assertion available passes by finding no icons, which DEC-032 records as
  indistinguishable from passing. The fix is in place and was reproduced by review.
- **Rule C rests on a payload shape** (`thinking.summaries[{summary}]`) now measured on **n=1
  conversation**. `summaries=` telemetry in the diagnostic is the regression signal.
- A lens wrote `tests/_review_probe.js` into the repo despite instructions to work in
  scratchpad copies; caught and removed. **Use explicit `git add` paths, never `-A`,** while
  review agents are running.
