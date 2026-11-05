# Session Handoff — 2026-11-04 (v12.17: every feature reads the whole conversation; Gemini bookmarks by turn; ChatGPT's jump through history pages)

**Scope:** the owner's v12.17 spec (2026-11-01), the feature-gaps PR (DEC-058's first), one PR with separate commits
per feature, on Claude, ChatGPT, Perplexity and Gemini:
- **F1–F3:** Search, Export and Summary read the whole conversation.
- **F4:** the image gallery lists every image from the index, with no new requests.
- **F5:** Gemini bookmarks key to the turn's 16-hex id.
- **F6:** small leftovers.
- **Added on the owner's calls:** ChatGPT's jump to an early question of a long chat, and two pulled-in bookmark
  items.

Reviewed: Tier 3 at the owner's cap of 5 rounds, then GitHub Codex's babysit cycle (15 reviews with findings, 17
P2s). Live-tested three times in the owner's Chrome, the last as an A/B against 12.16. Docs written from a re-read of
the whole transcript. Merged before acceptance.

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-11-01_v12.16-jump-meter-gemini.md` (v12.16; its §G.3.1 was
this session).

**Status at close:**
- **PR #92 (v12.17): MERGED** 2026-11-04 as `8909d92` (head `2deca12`), on the owner's explicit OK, **before any
  acceptance step was reported** (a waiver, recorded in DEC-031 on this branch). The owner will run the acceptance
  as one combined pass: the steps are on
  https://github.com/JoonJ14/ai-conversation-navigator/pull/92#issuecomment-6567898472.
- **This handoff is NOT on main, and NOT committed.** By the owner's call (no PR for a handoff), it sits as
  uncommitted changes on the local branch `feat/v12.18-context-meter` (branched from `8909d92`, not pushed), with the
  owed v12.17 doc lines: DEC-031's waiver; merge status in CHANGELOG, DEC-059 and ROADMAP; the 16-entry
  Firefox-on-Windows cascade in TESTING. The next session starts **on that branch** and commits these with the
  context-meter PR's own work (explicit paths).
- **Owner acceptance owed** for v12.15, v12.16 and v12.17, on Safari + Userscripts, Chrome + Tampermonkey and
  Firefox + Tampermonkey.
- **Left in the owner's Chrome:**
  - Tampermonkey has `a17413c`'s build (served `eb2a0b7c…`), not main's: `7bf5a3d` and `f5e2f52` were never
    installed.
  - No test bookmark or test export remains.
- **Next session: the context meter PR** (DEC-058's second; ROADMAP 12), then Grok. No release until every platform
  works on all supported browsers.

---

## A. State in one paragraph

main is v12.17.
- **ChatGPT and Perplexity:** Search, Export and Summary read the index adapters' full text (`_ix.answers`,
  `ixConversation()`), in order, with Q and A interleaved on one position scale; an answer click jumps by its key.
- **Claude:** its index already was complete; its remaining unchecked glides now land (`ciLandSettled`).
- **Gemini:** reads every loaded turn and says when older history isn't loaded (`gmHistNote`). Its bookmarks key to
  the turn's 16-hex id; numbers read "Q#…" until the history is positively complete, and positional records bind
  only on proof.
- **The gallery** lists every image from the index, labelled by its message. A real thumbnail appears only when the
  page has already loaded it, otherwise a named placeholder; it never makes a request. Perplexity therefore shows
  placeholders only, **by design**.
- **ChatGPT's jump waits** for the 5-turn history pages ChatGPT loads at the top. A page counts when an older turn
  mounts or the view re-anchors off the top.
- **The index refreshes itself** when an answer outgrows its snapshot by 2,000 characters, when the latest answer
  settles, or when a ChatGPT turn shows more images than indexed.
- **Summary's inventory** is the union of each answer's markdown and its mounted units.

The design is in DEC-059. Still open: the owner's acceptance, and the residuals logged in ROADMAP 13 (§I, §J).

---

## B. What was accomplished

### 1. Phase 1: the matrix, measured live
Feature × platform on 12.16 [Chrome + Tampermonkey, the owner's profile, visible tab, read-only GETs, 2026-11-01].
The table is in CHANGELOG 12.17.
- **ChatGPT (49 questions):** Search found no answer, Summary read "49 user, 0 AI", Export "4 (49 user, 0 AI)", and
  the gallery showed 0 of 3.
- **Perplexity (12):** answers were found as fragments up to "A#18"; Export read "24 (12 user, 22 AI)" over 2
  questions.
- **Gemini:** with 10 of 32 loaded, "No matches" and no note.
- **Claude:** the gallery labelled every image "Upload".
- **Also found:** ChatGPT's jump to Q15 of 49 toasted 2 of 2 from a fresh load.
- **Payload findings:**
  - ChatGPT's images are `sediment://` pointers with no URL; the page shows mounted ones as `blob:`.
  - Perplexity's attachments are signed S3 links on a new host that the page never loads.
  - Gemini's off-screen turns read 0 characters through `innerText`, but the navigator reads `textContent`.

### 2. The owner's decisions (2026-11-01)
- **The gallery:** cards from the index, a thumbnail only if the page loaded the image, otherwise a named
  placeholder; **no new requests or hosts**.
- **The ChatGPT jump:** fix it in this PR, measure first, and gate it.
- **Downloads:** investigate. Result: Chrome's per-tab multiple-download limiter, tripped by the agent's script
  clicks. Not a bug; TROUBLESHOOTING "NOT A BUG", TESTING.
- **CI:** the ubuntu `timeout-minutes` goes from 30 to 40 (`e398b49`), a stopgap until the CI rebuild. Measured
  afterwards: 29m1s–29m35s on PR #92.
- **Pulled in:**
  - ChatGPT "fallback"-turn answer bookmarks (`_bmIxCanon`, gate C7).
  - Claude bookmark landings (`ciLandSettled`, gate L6).
- **Tier 3 cap: 5.** The owner raised it to 10 and withdrew that the same minute: GitHub Codex is more accurate, it
  saves tokens, and its findings live on GitHub.

### 3. The build and the gates
- **Commits:** F1 `6f187cd`, F2 `fbb9da2`, F3 `de0cae9`, F4 `7dcd066`, F5 `e7529ff`, F6 `1ab3aed`, the ChatGPT jump
  `5437bc7`, version `faeb031`, and the pre-approved CLAUDE.md heading `45188fb`.
- **Gates:** `probes/check-feature-gaps.js`, 42 checks: C1–C13, C5b–C5g, P1–P7, G1–G10, L1–L3, L5, L6, E (guards
  G7, G8, L3, L5, E). Plus `check-ix-jumps` K5–K8.
  - Checks written before the PR fail on 12.16.
  - Each check added in the GitHub rounds fails on the commit before its fix.
  - 21 mutants, each caught.
- **Probe defects** fixed before trusting a result (CHANGELOG 12.17):
  - a hidden ghost timeline;
  - a gallery toggle;
  - `loadAll()`;
  - a mounted C5;
  - WebKit's `blob:` routing.

### 4. Review
- **Tier 3** (`cli:codex`, five rounds): 48 raw findings, 39 fixed, 1 false positive, 5 logged.
- **GitHub Codex on PR #92:** 15 reviews with findings, 17 P2s, all fixed in 15 commits (`cc19e40` … `f5e2f52`),
  each gated.
  - The confirming `@codex review` (the owner's rule) found a new P2 4 times out of 5.
  - Seven "Something went wrong" replies were each re-triggered.
  - **Two docs-only pushes each drew an automatic review that found a real code defect:** fenced code inside a
    blockquote (`7bf5a3d`), and an open gallery not redrawing when the index loaded (`f5e2f52`).
  - Final: clean twice on `f5e2f52`, and clean on the docs heads after it.
- The review record is `reviews/review-2026-11-01-v12.17.md`.

### 5. Live checks in the owner's Chrome (the agent's, never acceptance; DEC-031)
- **Before the PR.**
- **After the local review.** Found the false "answer longer" export note, fixed in `8a4b5a5`.
- **The final A/B:** 12.16 by Downgrade, still broken on the same chats; then the Codex-reviewed build.
  - On `4f33990` it found Q15 toasting 1 of 2, fixed in `c88ed1c`: a re-anchored view counts as a page. The
    mechanism is inferred, and no gate covers it.
  - On the final `a17413c` everything passed:
    - ChatGPT Q15 landed in 15.1 s.
    - Summary and the export were 98 (49/49).
    - Perplexity's A#1 landed; 6 placeholders, 0 S3 images.
    - Claude's gallery Q#106…Q#139; A#147 from the top at 0 px.
    - Gemini "Q#…" → "Q#32".

### 6. Final run, docs, merge
- **The pre-approved final run** on `8a4b5a5` (about 84 minutes, not the 30–40 estimated):
  - `npm test` 560/560 on all three engines.
  - Probes: Chromium green; Firefox all but J15 and U10 (both known); WebKit all but C8, a probe defect fixed in
    `d0bda17`.
- **No three-engine run covers the 17 code and probe commits after `8a4b5a5`.** Chromium only: `npm test` 560/560
  and all 15 probes on `a17413c`; the related probes and `npm test` on `7bf5a3d` and `f5e2f52`.
- **`/update-project-docs`** after re-reading the whole transcript: `63d7f88`, then `ebab086`, `0c4987c` and
  `2deca12`.
- **CI flakes, each cleared by one re-run:**
  - U10's timeout, seen on Chromium in CI for the first time (TROUBLESHOOTING).
  - The Firefox-on-Windows `page.goto … interrupted` cascade, 16 entries this time (TESTING).
- **The merge** on the owner's OK.

### 7. Mistakes, kept because they generalize
- **A docs push is reviewed too.** Poll Codex after every push, not only code pushes (agent_docs/git-workflow.md).
- **Two rules that judge the same thing must share one threshold.** The export's 20-character "longer" margin
  against the refetch rule's 2,000 flagged a settled chat (TROUBLESHOOTING).
- **A mock that mounts every page cannot show a page arriving unmounted.** `c88ed1c` was found only live.
- **A paused install is a lost hour when the owner is away.** Take over Chrome (memory; TESTING).
- **Pick Tampermonkey's confirm window by its title ("Userscript").** Escape on it cancels the install (TESTING).

---

## C. Architecture snapshot

Changed; agent_docs/architecture.md has the details.
- **Index adapters:**
  - `_ix.answers` (`{ key, q, at, text, pos, ids }`), `_ix.answerIdOf`, `_ix.images` (identities and names, never
    URLs), `_ix.watchLast`.
  - `ixConversation()`, `ixIndexStamp()`, `sumIndexStamp()`.
  - Constants: `IX_PAGE_WAIT_MS` 2,500, `IX_PAGE_SIZE_MIN` 5, `IX_PAGE_IDLE_MAX` 3, `IX_ANSWER_GROWTH` 2,000,
    `IX_SETTLE_MS` 3,000.
  - `_ixStartLoaded` is keyed `cid|x<indexGen>`; the adapter flag is `pagesAtTop`.
- **Summary:**
  - `jumpRef` (kinds `ixq`, `ixa`, `gm`), resolved by `_sumJumpRef`.
  - The inventory's `fenceRe`: own-line fences, any label, backtick or `~~~`, a longer closing fence, and a `>`
    blockquote prefix repeated on the closing line.
  - Plus `FILE_EXTENSION_RE` over the text, markdown links, and `domEls` matched by `codeKey`.
- **Gallery:** `orbIndexedImages()`. The open-gallery redraw key in `orbOnScanComplete` is Gemini's partial state +
  `sumIndexStamp()`.
- **Gemini:** `gmTurnOf`, `gmTurnById`, `gmQuestionIn`, `gmAnswerIn`, `gmHistNote`; bookmarks `_bmGm*`, with
  `_bmGmFinal` gating final labels and proof; `gmLandFarEl`.
- **Claude:** `ciLandSettled`.
- **Platforms:** `platform.textExclude` (Perplexity's "Finished").
- **Mocks:** `perplexity-windowed.html` (`bmModel.finished`), `gemini-history.html` (`sameText`).

---

## D. Key principles established

- **The owner's PR procedure** (agent_docs/git-workflow.md):
  1. Tiers 1–3, Tier 3 capped at 5.
  2. Reinstall and retest live.
  3. The pre-approved three-engine final run.
  4. Open the PR.
  5. Babysit until clean, plus one confirming review.
  6. Reinstall and retest live as an A/B against the previous version.
  7. Re-read the whole transcript and the memory files.
  8. `/update-project-docs` into the same PR.
  9. The owner merges.
- **A feature that reads "the conversation" reads the index**, never `querySelectorAll`, on every windowing site.
  Where it falls back to the DOM, it says so (DEGRADED, or "older history not loaded").
- **No new requests or hosts for the gallery** (the owner's privacy call). A placeholder names what is not loaded.

---

## E. Git state

`main` is at `8909d92` (the PR #92 merge) and holds v12.17; the userscript on main is `f5e2f52`'s.

| Commit | What |
|---|---|
| `45188fb`, `faeb031` | the pre-approved CLAUDE.md heading; version 12.17 |
| `6f187cd` … `1ab3aed`, `5437bc7` | F1–F6; the ChatGPT jump |
| `a10857f`, `ad6bf77`, `d89916f` | live-found fixes; the gates; the gallery's placeholder fallback |
| `e398b49`, `3cfce67` | CI 40 min; the pulled-in items + Tier 3 round 1 |
| `2d67d99`, `3e96f32`, `3ed8ccc`, `9cd8b8c` | Tier 3 rounds 2–5 |
| `8a4b5a5`, `d0bda17` | the export margin (live); WebKit's `blob:` routing in the probe |
| `cc19e40` … `a17413c`, `c88ed1c` | GitHub Codex rounds; the re-anchor page rule (the live A/B) |
| `7bf5a3d`, `f5e2f52` | Codex's findings on the docs pushes (blockquoted fences; the gallery redraw) |
| `63d7f88`, `ebab086`, `0c4987c`, `2deca12` | `/update-project-docs` and its follow-ups |
| `8909d92` | **merge of PR #92** |

- **Current branch: `feat/v12.18-context-meter`** (local, from `8909d92`, not pushed). Its uncommitted changes are
  this handoff, the v12.16 one moved to `docs/handoffs/` (`git mv`, staged as a rename), and the owed v12.17 doc
  lines in CHANGELOG, DECISIONS, ROADMAP, TESTING and `agent_docs/testing.md`. Commit them in the context-meter PR
  (explicit paths), which is opened from this branch.
- **Remote branches:** `main`, `feat/v12.17-feature-gaps` (merged; left in place), `feat/v12.18-context-meter`, and
  the older merged branches (`docs/v12.16-merge-waiver`, `fix/v12.16-…`, `docs/v12.15-…`, `fix/v12.15-…`).
- **Merges use merge commits** (`gh pr merge --merge --match-head-commit <full sha>`); the ruleset requires all nine
  checks, with no bypass.
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `ROADMAP.md` "Current Status"; **item 12** (the context meter); item 13 "Logged from v12.17" | the next PR's ideas and its measurement; v12.17's residuals |
| `DECISIONS.md` **DEC-056** (the per-model window), **DEC-058** (the order), **DEC-059** (v12.17), **DEC-031** | the meter's current design; why the meter is next; live status and waivers |
| `docs/CONTEXT-TRACKING.md`, `docs/claude_specific_context_tracking_calculation.md` | how the meter estimates today (step 2 of item 12) |
| `DOM-REFERENCE.md` → Claude (`model`) | what the conversation JSON carries |
| `probes/check-ctx-limit.js`, `probes/check-turn-counter.js` | the meter's and the dots' gates |
| `CHANGELOG.md` 12.17, `reviews/review-2026-11-01-v12.17.md` | what shipped, every result with its context |
| `TESTING.md` → "The live check in the owner's Chrome" | install (window by title, Escape), exports by real click, downloads |
| `agent_docs/git-workflow.md` | the owner's PR procedure; docs pushes draw reviews |

---

## G. What comes next

1. **The context meter: make model-dependent limits clear to the user** (DEC-058's second; ROADMAP 12). The
   per-model table stays (DEC-056: 1M for Fable 5.1, Opus 5.5, Opus 5, Sonnet 5.5, Sonnet 5, Haiku 5.5; 500K for
   Fable 5, Opus 4.6–4.8, Sonnet 4.6; 200K otherwise, labelled "limit assumed"). The feature is about *showing* it.
   - **First, a live measurement by the agent in the owner's Chrome. Ask before running it:** switching a model
     changes the conversation in the owner's account. The question: does the navigator see a mid-chat model change?
     Through the conversation JSON's stored `model` (one per conversation, present on 60 of 60 chats; no message
     carries one), or through the composer's model picker?
     - Known: the help center (article 8664678, read 2026-11-01) says a change "at any point in a conversation"
       applies from Claude's next response.
     - Measure: whether `model` follows the switch, when (on the next response? at once?), and whether the
       picker's label is readable from the DOM. Record the context.
   - **Then HTML mockups for the owner to choose from.** The ideas logged so far:
     - a fixed-scale bar with limit markers;
     - the model and its limit as text;
     - a notice when the model changes.
   - **Related residuals in ROADMAP 12** (scope them with the owner; don't fold them in silently):
     - The estimate exceeds the window on chats claude.ai has summarized ("~600.1K / 500K").
     - `predictedCycleLength` and the compaction fields are never written.
     - Path B (Firefox; Safari inferred) never shows "Context nearly full".
     - The help center gives no Free-plan window, and the Team page still says 200K.
     - Step 2, the estimate's accuracy itself.
2. **Before any release, owed from v12.17** (ROADMAP 13):
   - A Firefox and WebKit run covering the 17 commits after `8a4b5a5`.
   - A live check of `7bf5a3d` and `f5e2f52`.
   - A gate for `c88ed1c` (a mock option that leaves a page's turns unmounted).
3. **Owner acceptance** of v12.15, v12.16 and v12.17 on all three browsers. Record it in DEC-031 exactly as reported:
   the `<!-- V12.17 ACCEPTANCE -->` placeholder, and the v12.16 and v12.15 ones.
4. **Then Grok** on all three browsers, its own PR (DEC-058's third).
5. **The "Later" list** (ROADMAP, Current Status), unordered:
   - J15's CI race and U10's timeout;
   - the CI rebuild (0e), which should revisit the 40-minute stopgap;
   - Perplexity attachment images;
   - the stale "Turn N" badge;
   - Gemini's "load the full history" action (proposed, not decided).

---

## H. Operational context + owner rules

Carried over, still in force:
- **Equal priority:** Safari, Chrome and Firefox (DEC-047). **Merge authority** is per PR and explicit; nothing here
  authorizes a merge. **Acceptance** goes in DEC-031 only, exactly as reported; blanks are "not reported".
- **Live work in the owner's accounts is read-only.** GETs are fine. Test bookmarks and exports are allowed only when
  the spec allows them: delete exactly those, never the owner's.
- **CLAUDE.md:** show the diff and commit only on approval; a spec may pre-approve one edit.
- **Scope:** build the minimal version of the spec. Findings outside it get logged; new issues found in acceptance
  get logged unless they block.
- **Proof:**
  - A gate that fails on the previous version, plus a few mutants.
  - `npm test` and the probes after any code change.
  - `npm run test:probes` stops at Firefox's U10 timeout here, so run the rest directly; there is no `timeout`
    command.
  - Ask before any long run, with an estimate. A three-engine run takes about 84 minutes on this Mac.
- **Every claim carries its measurement context.** Safari + Userscripts is the owner's to verify.
- **CI is not real-browser evidence.** Read a failing log first, then re-run (`gh run rerun --failed`, only after
  the whole run has completed). Never override.
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** only when the owner names them.
- **Git:** explicit `git add` paths; never push to `main`.

New this session:
- **The PR procedure in §D** is the standing order for code PRs. Docs go into the same PR; this handoff is folded
  into the next PR on the owner's call.
- **Tier 3 is capped at 5 rounds.** What remains goes to GitHub Codex.
- **After a clean Codex review, post `@codex review` once more.** And poll after *every* push, docs included.
- **When the owner says they're away, take over their Chrome** (tabs, windows, Tampermonkey's buttons) without
  stopping to ask, and push through without questions.
- **Re-read the whole transcript `.jsonl` and the memory files before `/update-project-docs` or a handoff** on a
  compacted session (this one: `ed6d4e67-ecc4-44e1-bbe7-ba9bb8d9a835.jsonl`).
- **The Mac sleeps with the lid shut,** and the agent's background watchers pause with it. GitHub's CI does not.

---

## I. Deferred / future work

Not queued; §G comes first. Everything is logged in ROADMAP 13, "Logged from v12.17":
- Claude's last-answer bookmark measures 218 px short (both builds; the probe or the path).
- No ChatGPT A→B→A switch probe.
- One ChatGPT answer can be saved under two keys.
- An answer regenerated during the cooldown.
- Gemini turns lingering after `replaceState`.
- K-gate model gaps (non-page growth, a hidden tab).
- Summary and gallery performance on very long threads.
- Navigate shows the DOM's 4 for about 7 s before ChatGPT's index arrives.
- Summary's code and file counts moved during the GitHub rounds: 67 → 65 code blocks, 1 → 42 files, never checked
  item by item.

The earlier lists (ROADMAP 13 and 14 from v12.15 and v12.16) are unchanged.

---

## J. Risk caveats / known limitations

- **Merged without acceptance:** v12.17, like v12.15 and v12.16. Safari + Userscripts and Firefox + Tampermonkey have
  not run it at all; everything rests on mocks and the agent's Chrome + Tampermonkey checks.
- **Not live, and not three-engine:** `7bf5a3d` and `f5e2f52` were never installed live. The 17 commits after
  `8a4b5a5` ran on Chromium only.
- **`c88ed1c` has no gate,** and its mechanism (a page arriving with its turns unmounted) is inferred from a live
  failure, not traced.
- **Far ChatGPT jumps from a fresh load take 15–18 s.** They wait for every page; that's correct, but slow enough to
  read as a hang.
- **The gallery thumbnail rule** means most far images show placeholders: on Perplexity always, by design. A
  ChatGPT turn whose shown images don't match the index count gets placeholders. A Claude PDF's page thumbnail is no
  longer listed.
- **Gemini:** numbers read "Q#…" until the history is positively complete, which can take 8 s at the top after the
  last page (DEC-057's case). The constants (page size 10, the 8 s rule) were measured on three chats in Chrome.
- **Live measurements came from a handful of chats:** ChatGPT page size 5 and the 734–1,089 ms page time were
  measured on two chats in Chrome.
- **CI:**
  - The ubuntu jobs take about 29–30 of 40 minutes.
  - U10's timeout now also strikes Chromium in CI.
  - The Firefox-on-Windows cascade can take out every entry.
  - Each cleared with one re-run.

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md on the branch
feat/v12.18-context-meter (2026-11-04: v12.17 merged as 8909d92 before acceptance;
next: the context meter PR, DEC-058's second, ROADMAP 12).

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats). The handoff is NOT on main: it is
on feat/v12.18-context-meter, and merges with this PR.

FIRST, CHECK STATE — do not assume:
  git fetch origin
  git log --oneline --first-parent -3 origin/main
  git branch --show-current && git status --short
  gh pr list --state open
main should be at 8909d92 (the merge of PR #92, v12.17). You should be on the local
branch feat/v12.18-context-meter, level with main, holding UNCOMMITTED changes: this
HANDOFF.md, the v12.16 handoff renamed into docs/handoffs/, and the v12.17 doc lines
in CHANGELOG, DECISIONS, ROADMAP, TESTING and agent_docs/testing.md (plus my five
untracked files, never added). Commit them with this PR's work, explicit paths. No
PR should be open. If that is not what you see, stop and tell me.

THIS SESSION: the context meter, "make model-dependent limits clear to the user"
(ROADMAP 12, DEC-058). The per-model table stays (DEC-056); the feature is about
showing it. Start with the read-only Phase 1 and the live measurement in my Chrome:
does the navigator see a mid-chat model change, through the conversation's stored
`model` or the composer's model picker? Switching a model changes a conversation in
my account, so ASK ME before you switch anything, and tell me which chat. Then HTML
mockups for me to choose from. I may give a spec as my first message; if so, it
decides the scope. If I report acceptance results for v12.15, v12.16 or v12.17
instead, record them in DEC-031 exactly as I report them.
After this PR: Grok. No release until every platform works on all supported
browsers. Before any release, v12.17 owes a Firefox/WebKit run after 8a4b5a5 and a
live check of 7bf5a3d and f5e2f52 (HANDOFF §G.2).
For any code change: a read-only Phase 1 first, measure before reasoning, and wait
for my decision before code. Before any live measurement, confirm which userscript
version is installed in that browser (DEC-027): Chrome has a17413c's build, not
main's.

STANDING RULE: Safari, Chrome and Firefox are equal priority; none is primary
(DEC-047). I work mostly on the Mac: Safari first, Chrome if Safari fails.

PROCESS (HANDOFF §D, agent_docs/git-workflow.md): Tier 3 capped at 5 rounds;
reinstall in my Chrome and retest live; the three-engine final run (ask first, about
84 min); open the PR; /babysit-pr-cycle when I name it, plus one confirming
@codex review, and poll after every push, docs included; reinstall and retest as an
A/B against the previous version; re-read the whole transcript and memory, then
/update-project-docs into the same PR. If I say I'm away, take over my Chrome and
push through without questions.

DO NOT:
- Merge anything without my explicit OK for that PR, or push to main. The ruleset
  allows no bypass: re-run a stalled CI job, never override it.
- Commit a CLAUDE.md change before I approve the diff.
- Report anything you cannot drive yourself (Safari + Userscripts) as verified.
- Cite green CI as real-browser evidence.
- Fix findings outside the task's scope. Log them to ROADMAP or TROUBLESHOOTING.
- Add long verification runs without asking first, with a time estimate.
- Record an acceptance more strongly than I reported it.
- Send, edit, regenerate, delete or share anything in my live accounts, or switch
  a conversation's model, without asking.
- Create or delete bookmarks (or other navigator data) in my real browser
  profiles without asking.
- Read or write GM storage except through acnGetValue / acnSetValue /
  acnUpdateValue (collections through acnUpdateValue).

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my
untracked files (HANDOFF §E). Run `npm test` and the probes after any code change
(npm run test:probes stops at the Firefox U10 timeout on this Mac: run the rest
directly). Every claim carries its measurement context.
```
