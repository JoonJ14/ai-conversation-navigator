# Session Handoff — 2026-11-05 (v12.18: the context meter makes model-dependent limits clear; ChatGPT fallback bookmarks; a CI stopgap)

**Scope:** the owner's v12.18 spec (`docs/specs/v12.18-spec.md`) and design (DEC-060), DEC-058's second PR. One
combined PR in three parts, on Claude, ChatGPT, Gemini and Perplexity:
- **Part 1, the context meter:**
  - Claude counts from its last summary, names the model and window, and gives change notices.
  - ChatGPT gets a plan setting.
  - Gemini and Perplexity show a size estimate.
- **Part 2:** ChatGPT answer records on a "fallback" turn are stored under the index's key (DEC-061).
- **Part 3:** a CI stopgap: the ubuntu cap 40 → 50, and later a bounded, retried browser install.

Reviewed:
- Tier 3 at the owner's cap of 5 rounds, alongside a 57-agent adversarial review.
- GitHub Codex was clean on every head it reviewed.

Live-tested in the owner's Chrome before the PR, and again as an A/B against 12.17 after Codex. The docs were written
from a re-read of the whole transcript, then fact-checked and audited twice. Merged before acceptance (a waiver).

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-11-04_v12.17-feature-gaps.md` (v12.17; its §G.1 was this
session).

**Status at close:**
- **PR #93 (v12.18): MERGED** 2026-11-05 22:38 UTC as `ab7ea21` (head `4cdc730`, all nine checks green), by the
  agent on the owner's explicit OK, before any acceptance step (a waiver, DEC-031).
- **`main`'s first run after the merge** (run 42123189982) was 9/9 green.
- **Owner acceptance is now ONE consolidated pass at about v12.20** (DEC-062), from `docs/acceptance-checklist.md`.
  Until then, "acceptance owed" per version is expected, not something to raise every session.
- **This handoff is on the branch `feat/v12.19-gemini-full-history`**, cut from `ab7ea21`, together with the
  post-merge doc lines. It rides along with that PR's code; no docs-only PR.
- **Next PR: Gemini's full question list on open** (§G.1), then Grok.
- **Left in the owner's Chrome:**
  - Tampermonkey has 12.18 (served sha256 `b8934332…`, the userscript of `64b54a8` through `ab7ea21`).
  - The ChatGPT plan setting is back to "Not set".
  - No test bookmark or export remains.
  - The throwaway Claude chat `73c209d8` ("Test message confirmation") is the owner's to delete.

---

## A. State in one paragraph

`main` is v12.18. Since this release:
- **Claude:** the context meter reads each summary claude.ai records (`compaction_summary`) and counts from the last
  one (`ccf551fb`: 100% "~600.1K / 500K" on 12.17 → 45% on 12.18). It names the model and window ("Opus 4.7 · 500K
  window"), explains a model change or a new summary in a dismissible notice, and raises a 95% alert when no summary
  is recorded. Navigate tags the summarized questions, with a divider.
- **ChatGPT:** it has a plan setting (windows by plan and mode, the mode from the newest answer's `model_slug`).
- **Gemini and Perplexity:** they show "~X tokens (est.) · window not published", with dots coloured against 1M and
  the artboard H caption.
- **ChatGPT bookmarks:** records saved under an answer's other shown node are rewritten to the index's key, and
  every flag with that key follows a click.
- **CI:** ubuntu jobs have 50 minutes, and their browser install is bounded and retried. That retry made its first
  real mirror switch on this PR.

The design is in DEC-060 (and its implementation notes), DEC-061 and DEC-062. CHANGELOG 12.18 is the full record.

---

## B. What was accomplished

### 1. Phase 1 measurements, live and read-only
[Chrome + Tampermonkey 12.17, the owner's profile, visible tab, page realm, GET reads; one throwaway chat with the
owner's OK. Details in DOM-REFERENCE and ROADMAP 12.]
- **A model switch:**
  - The stored `model` changes only when the next message is sent. The navigator followed it silently (3% → 6%).
  - No message records a model.
  - Measured once each way, in one chat.
- **claude.ai's summaries:**
  - The marker is `compaction_summary`: 87 on 39 of the owner's 236 chats, including 7 of the 8 over-window chats.
  - It carries no token count. That every summary leaves one is not proven.
  - The size before each summary was scattered (by date or model, not by today's window), so "distance to the next
    summary" can't be shown.
  - The stream has a `compaction_status` event (Chrome only, never observed).
- **ChatGPT:**
  - Windows are per plan and mode (chatgpt.com/pricing, 2026-11-04), and the plan isn't in the data.
  - `model_slug` is on each answer (196 of 299 chats read).
  - No summary marker.
- **Gemini, Perplexity and Grok:**
  - No marker was found. Gemini: code only. Perplexity's threads are too short to show one.
  - Grok was searched signed out, and the result is only partly conclusive.
- **The design:**
  - HTML mockups, then the owner's design files (`docs/design/context-meter/`) and DEC-060.
  - The owner's Phase 1 calls:
    - count the carrier and its question after a summary;
    - the slug → mode table, with gpt-6 counted as Instant;
    - Part 2 "rewrite + gate only";
    - Part 3: the ubuntu cap 50.

### 2. The build
- **Commits:** Part 1 `aaa0d40`, Part 2 `08771f6`, Part 3 `083defa`, Phase 1 docs `21912e9`, the Tier 3 fixes
  (`e47aba2`, `55581c0`, `cebb015`, `bf5c0c8`), version `64b54a8`, review record `1be3bd1`.
- **Gates:**
  - `probes/check-context-meter.js`: M1–M16, C1–C10, S1–S7.
  - `probes/check-gpt-fallback.js`: F1–F8.
  - `check-ctx-limit` L4.
  - 16 targeted mutants (m1–m16), each caught by its intended check.
  - Against v12.17, every `[new]` check of the first version failed or was INVALID. The checks added in rounds 2
    and 4 were shown on mutants only.
  - `bf5c0c8` has no gate.
- **The final run on `1be3bd1`** (1h42m, this Mac):
  - `npm test` 560/560 on three engines.
  - Probes Chromium 17/17, WebKit 14/14, Firefox 13/14. The one failure is J15, the documented race.

### 3. Review
- **Tier 1–2 (session), plus a multi-agent review:** 57 agents, 28 raw findings, 10 upheld and fixed.
  - Three of its six refutations were measured on a tree being edited at the time. Two of those were real, and
    were fixed by Codex round 1's rewrite (review record).
- **Tier 3 `cli:codex`, 5 rounds:** 27 raw findings, 22 verified and fixed, 5 shown not to be defects.
- **GitHub Codex:** clean twice on `1be3bd1`, twice on `3ccf84b`, and on `b48996a`.

### 4. Live checks (the agent's, never acceptance; DEC-031)
- **Before the PR:**
  - Claude: `ccf551fb` at 45% with 3 summaries; `0ca88a77` at 30%; `c9270096` with no summary.
  - ChatGPT: the plan unset, then set to Plus (24%, "Thinking · 256K window (Plus)"), then restored.
  - Gemini and Perplexity: the estimate and the caption.
- **After Codex, an A/B against 12.17:** 12.17 read 100% "~600.1K / 500K" and "Conversation turns".
- **Blocked:** the Q45 test bookmark, by the agent's safety classifier. It is acceptance step 31.

### 5. CI, this PR
- **Run 42086675512 failed every job at "Install Playwright":** `playwright@1.65.0` was published before its
  `playwright-core`. Upstream resolved it by moving the `latest` tag back. One run's green checks then came from two
  Playwright versions.
- **Three apt-mirror stalls** (25m, 16m, and 10m on 11-04). The 50-minute cap absorbs only about 16 minutes of
  stall.
- **`b48996a`, the owner's choice of four options:**
  - the ubuntu system packages get 3 attempts of 4 minutes, dropping the Azure mirror after the first;
  - its first live switch: Azure got about 3 MB in 4 minutes, then archive.ubuntu.com served 111 MB in 36 s, and
    the job passed;
  - macOS and Windows are unchanged: 25 runs, no stall, so the owner declined a step timeout there.
- **The ~34-minute ubuntu jobs are the probes, not queueing:**
  - every job starts 2–3 s after creation;
  - the steps run with 0 s gaps;
  - the 16 probe steps are ubuntu-only.
  - The owner wants splitting the probes into parallel jobs logged for the rebuild (ROADMAP 0e).

### 6. Docs, merge, and these post-merge lines
- **`3ccf84b`:** `/update-project-docs`. A four-reader fact-check fixed 33 errors before it was committed.
- **`27af348`:** a whole-transcript audit, the owner's request; 48 verified gaps fixed.
- **`4cdc730`:** the owner's five approved conventions lessons, CLAUDE.md's figures, and the merge waiver.
- **This branch:**
  - "merged as `ab7ea21`";
  - the mirror switch and `main`'s run;
  - the probes-not-queueing measurement and the parallel-probes recommendation;
  - DEC-058's addendum (Gemini before Grok);
  - DEC-062 and `docs/acceptance-checklist.md`;
  - this handoff.

### 7. Mistakes, kept because they generalize (conventions.md has the approved ones)
- **The review's moving tree.** A review was still verifying while its tree was edited. Give a review a frozen
  tree.
- **Reconstructed records.** The draft had three options the owner was never offered, a "solutions considered"
  list nobody weighed, and counts from memory ("about 20" mutants for 16). Quote options and counts from the record,
  and fact-check a docs draft before committing.
- **INVALID on the base build** (C5, C8, F8) hid a gate's purpose. Treat it as a gate defect.
- **The Safari stub** stored the bookmark store encoded once; the real store is encoded twice.
- **A pipeline under `pipefail`.** A `grep | grep -q` pipeline would have silently skipped the mirror switch;
  caught by simulating the step.
- **Predicting a run without reading it.** The agent said a new run "will fail the same way" without reading its
  install step, which had already passed.
- **Gemini's long chat.** Phase 1 took `96b519c1…` (the 32-question chat) for a 10-turn one, because only 10
  turns were loaded.

---

## C. Architecture snapshot

Changed; agent_docs/architecture.md → "Context meter (v12.18, DEC-060)" has the details.
- **Claude summaries:**
  - `ciSummaryChars`, `ciCompaction()` → `{ n, at, from, chars, q }`, `ciCharsFrom` / `ciThinkingCharsFrom`.
  - The effective context is `ciCharsFrom(from) + chars` plus thinking plus overhead.
- **Lines under the meter:** `CTX_LINE_ORDER`; `orbCtxSetLine` writes only when the text changed (every mutation
  schedules a scan).
- **Notices:**
  - `_ctxSeen` is keyed to the URL's conversation. `orbCtxTrack()` runs on every scan with a ready index and on
    every draw.
  - ChatGPT's notices wait for a ready index.
  - The three mode-notice rules are in architecture.md.
- **ChatGPT:** `GPT_CTX`, `GPT_MODE_BY_SLUG` (exact keys), `orbGptPlan()` (the `chatgptPlan` setting in
  `acn-settings`), `orbRenderGptMeter`.
- **Gemini and Perplexity:** `CTX_SIZE_ONLY`, `CTX_SIZE_REF` 1M, `orbConvSizes`, `orbRenderSizeMeter`,
  `orbSizeCaption`, `orbCtxSizeSig`.
- **Bookmarks:** `_bmIxCanonicalize` (once per index build, the mapping captured for Safari's replay), and
  `_bmSyncFlags(key, on)`.
- **CI:** the "Install browser engine (ubuntu, bounded)" step.

---

## D. Key principles established

- **The owner's PR procedure** (agent_docs/git-workflow.md):
  1. Tiers 1–3, Tier 3 capped at 5 rounds.
  2. Reinstall and retest live.
  3. The three-engine final run.
  4. Open the PR, with the acceptance steps as its first comment **and appended to
     `docs/acceptance-checklist.md`**.
  5. Babysit until clean, plus one confirming review.
  6. Reinstall and retest as an A/B against the previous version.
  7. Re-read the whole transcript and memory, then `/update-project-docs` into the same PR.
  8. The owner merges.
  9. **The agent reminds the owner of the optional Safari smoke check.**
- **Acceptance (DEC-062):** one consolidated pass at about v12.20, from one checklist. DEC-031 keeps waivers.
- **The meter is honest about what it knows:**
  - a percentage only where a window is known;
  - "assumed" only when no model is identified;
  - a summary counted from the record, never predicted.
- **The repo is public:** name the owner's chats by id prefix, never by title or content.

---

## E. Git state

`main` is at `ab7ea21` (the PR #93 merge) and holds v12.18. The userscript there is `64b54a8`'s; later commits
changed only CI and docs.

| Commit | What |
|---|---|
| `2b4d931` | the v12.17 handoff and its owed lines (folded into PR #93) |
| `f2bf6d0`, `6e09fbb`, `54048cf`, `633d936`, `21912e9` | findings, design files, DEC-060, the spec, Phase 1 docs |
| `aaa0d40`, `08771f6`, `083defa` | Parts 1, 2 and 3 |
| `e47aba2`, `55581c0`, `cebb015`, `bf5c0c8` | Tier 3 rounds 2–5 |
| `64b54a8`, `1be3bd1` | version 12.18; the review record |
| `3ccf84b`, `b48996a`, `27af348`, `4cdc730` | docs; the bounded install; the audit; lessons + CLAUDE.md + waiver |
| `ab7ea21` | **merge of PR #93** |

- **Current branch: `feat/v12.19-gemini-full-history`**, cut from `ab7ea21`. It holds this handoff (the v12.17 one
  is moved to `docs/handoffs/`), `docs/acceptance-checklist.md`, and the post-merge lines in CHANGELOG, DECISIONS,
  ROADMAP, TROUBLESHOOTING and agent_docs. The next PR is opened from it, with its code.
- **Remote branches:** `main`, `feat/v12.18-context-meter` (merged; left in place), and the older merged ones.
- **Merges use merge commits** (`gh pr merge --merge --match-head-commit <full sha>`). The ruleset requires all nine
  checks, with no bypass.
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`.
- **The owner's Python server on port 8765** (running for days) is theirs. Use another port to serve builds.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `ROADMAP.md` "Current Status" → "Next" item 3 (Gemini), item 13 → Gemini, item 0e | the next PR's goal and questions; the CI rebuild's inputs |
| `DECISIONS.md` **DEC-057** (Gemini keeps what it loads; the completion rule), **DEC-046** (index adapters), **DEC-058** + addendum, **DEC-062**, **DEC-031** | how Gemini pages today; how an adapter reads a site's own JSON; the order; acceptance |
| `DOM-REFERENCE.md` → Gemini ("Paging": `batchexecute`, `rpcids=hNvQHb`) | the request the investigation starts from |
| `tests/mock-pages/gemini-history.html`, `probes/check-gemini-history.js` | Gemini's paging mock and its gate |
| `docs/acceptance-checklist.md` | the one acceptance list; append the next PR's steps |
| `CHANGELOG.md` 12.18, `reviews/review-2026-11-05-v12.18.md` | what shipped, every result with its context |
| `agent_docs/architecture.md` → "Context meter"; `agent_docs/conventions.md` → the new lessons and the naming rule | |
| `TESTING.md` → "The live check in the owner's Chrome" | install (`AXEnhancedUserInterface`, a free port), measuring lessons |

---

## G. What comes next

1. **Gemini's full question list on open** (the owner, 2026-11-05; DEC-058's addendum; ROADMAP "Next" item 3). Its
   own PR, on this branch.
   - **Baseline today** (DEC-057): Navigate lists only the loaded turns. Gemini loads the newest 10, and 10 more
     each time the view reaches the top. The "older messages not loaded" note shows, and 2–3 trips to the top load
     the rest (`96b519c1…`: 10 → 20 → 30 → 32).
   - **Goal:** the full question list immediately, in any Gemini chat.
   - **Investigation first, read-only** (measure before reasoning; wait for the owner's decision before code):
     - Can Gemini's own history request (`batchexecute`, `rpcids=hNvQHb`, seen in v12.16, its bodies never
       inspected; DOM-REFERENCE, Gemini, "Paging") return the whole conversation, for an index adapter like
       DEC-046's?
     - What does the request carry? Its parameters, the response's shape, what it returns per call (10 turns? a
       cursor?), and whether repeated calls reach the start.
     - **What page tokens would the navigator need to make the call itself?** For each one: where it comes from (the
       page's HTML, a global, a cookie), how often it changes, and what breaks when it does. **Note how fragile each
       one is.**
     - Report key names, types and counts only, never message content. Name the chat by id prefix.
   - **Fallback, if that's too fragile:** a "Load full history" button the user clicks. It scrolls to the top until
     the start is loaded (DEC-057's completion rule: the last load, or 8 s at the top), then restores the view.
   - Then the procedure in §D. The acceptance steps go into `docs/acceptance-checklist.md`.
2. **Then Grok** on all three browsers (DEC-058), once the owner is back on the Linux machine to sign in. The code
   search must be redone signed in, then data steps 2–3 (DOM-REFERENCE, Grok, "Context and summaries").
3. **The consolidated acceptance pass at about v12.20** (DEC-062). It is the owner's to run; the agent keeps the
   checklist current.
4. **The CI rebuild (ROADMAP 0e), when the owner schedules it:**
   - parallel probe jobs (the owner's recommendation), with their names added to the required checks;
   - pin Playwright;
   - consider Playwright's container image.
5. **The "Later" list** (ROADMAP, Current Status), unordered:
   - J15's race;
   - Perplexity attachment images;
   - the stale "Turn N" badge;
   - v12.18's ungated items (ROADMAP 12).

---

## H. Operational context + owner rules

Carried over, still in force:
- **Equal priority:** Safari, Chrome and Firefox (DEC-047). **Merge authority** is per PR and explicit. **Acceptance
  results** go in DEC-031 only, exactly as reported; blanks are "not reported".
- **Live work in the owner's accounts is read-only.** GETs are fine. Test bookmarks and exports only where the spec
  allows them; delete exactly those. Ask before anything that sends, edits or switches in an account.
- **CLAUDE.md:** show the diff, and commit only on approval.
- **Scope:** build the minimal version of the spec. Log findings outside it.
- **Proof:**
  - A gate that fails on the previous version, plus mutants.
  - `npm test` and the probes after any code change.
  - `npm run test:probes` stops at Firefox's U10 timeout here, so run the rest directly.
  - Ask before a long run, with an estimate: about 1h42m for three engines (v12.18).
- **Every claim carries its measurement context.** Safari + Userscripts is the owner's to verify.
- **CI is not real-browser evidence.** Read a failing log first, then re-run. Never override.
- **The Tier 3 cap is 5.** After a clean Codex review, post `@codex review` once more.
- **If the owner says they're away,** take over their Chrome.
- **Before docs or a handoff on a compacted session,** re-read the whole `.jsonl` and the memory files.
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** only when the owner names them.
- **Git:** explicit `git add` paths; never push to `main`.

New this session:
- **Acceptance is deferred to one pass at about v12.20 (DEC-062).** Don't raise per-version "acceptance owed" every
  session. Append each PR's steps to `docs/acceptance-checklist.md`. **Remind the owner of the 5-minute Safari smoke
  check after each merge.**
- **Next PR: Gemini's full question list, before Grok** (DEC-058's addendum).
- **Codex on docs-only pushes:** for PR #93's last docs push the owner said not to call Codex ("our codes are all
  good and its just docs change"). That was their call for that push. git-workflow's standing rule is still to poll
  after every push, so ask if unsure.
- **CI:** ubuntu jobs take ~34 minutes by design (the probes). Watch the install step: over a minute is a slow mirror,
  and the bounded step caps it at about 13 minutes. Watch for jobs past ~36 minutes (ubuntu) or ~12 (macOS and
  Windows).
- **Chats by id prefix only** (the repo is public; conventions.md).
- **The owner's process wants measurement, not reassurance:** when asked whether CI is "really running", answer with
  timestamps (queue time, step gaps), not with reasoning.

---

## I. Deferred / future work

Not queued; §G comes first. All logged in ROADMAP 12 ("Logged from v12.18") and 13:
- No gate for `bf5c0c8`, nor for two ChatGPT notice rules (Go ↔ Plus; plan and mode before one draw).
- The review's F7: going back to a Claude branch with more summaries re-announces one.
- 31 older code lines hold literal non-ASCII characters (conventions.md's `\uXXXX` rule).
- A comment above `GPT_MODE_BY_SLUG` overstates its basis.
- Never measured:
  - `compaction_summary` through the gmxhr transport;
  - Opus 3's stored id;
  - a chat over 500K switched to a 500K model;
  - the compaction test design (proposed, not run).
- The estimate's own calibration (ROADMAP 12, step 2). One candidate cause of the scatter is claude.ai's tool-loading
  setting.

---

## J. Risk caveats / known limitations

- **Merged without acceptance:** v12.15 through v12.18. Safari + Userscripts and Firefox + Tampermonkey have run none
  of them. Everything rests on mocks and the agent's Chrome + Tampermonkey checks, until the consolidated pass.
- **The meter's numbers are estimates** (characters ÷ 4 plus an overhead). The summary count is a record, but whether
  every summary leaves a marker is unproven.
- **ChatGPT's plan is the user's word:** a wrong setting gives a wrong percentage.
- **ChatGPT's two-node fallback turn** hasn't been seen live since 2026-11-01; its gate is a mock.
- **Gemini's investigation may find the request needs tokens** that change often or come from places a userscript
  shouldn't read. The fallback button exists for that.
- **CI:**
  - The apt mirror can stall for longer than the bounded step's ~13 minutes; the step then fails clearly. Re-run it.
  - Unpinned Playwright can change engines between attempts of one run.
  - macOS runners can be unavailable at times (a 15-minute cancel).

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md on the branch
feat/v12.19-gemini-full-history (2026-11-05: v12.18 merged as ab7ea21 before acceptance;
next: Gemini's full question list on open, then Grok).

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats).

FIRST, CHECK STATE — do not assume:
  git fetch origin
  git log --oneline --first-parent -3 origin/main
  git branch --show-current && git status --short
  gh pr list --state open
main should be at ab7ea21 (the merge of PR #93, v12.18). You should be on
feat/v12.19-gemini-full-history, one docs commit ahead of main (this handoff, the
v12.17 handoff moved to docs/handoffs/, docs/acceptance-checklist.md, and the post-merge
lines), plus my five untracked files, never added. No PR should be open. If that is
not what you see, stop and tell me.

THIS SESSION: Gemini's full question list on open (ROADMAP "Next" item 3; DEC-058's
addendum). Today Navigate lists only the loaded turns, shows the "older messages not
loaded" note, and needs 2–3 trips to the top. Goal: the full list immediately in any
Gemini chat. Start with a READ-ONLY investigation in my Chrome: can Gemini's history
request (batchexecute, rpcids=hNvQHb, seen in v12.16, DEC-057, DOM-REFERENCE Gemini
"Paging") return the whole conversation for an index adapter? What page tokens would
the navigator need to call it, and how fragile is each one? Report key names, types and
counts only, never message content. Then wait for my decision. Fallback if too fragile:
a "Load full history" button that scrolls to the top until the start is loaded, then
restores the view. I may give a spec as my first message; if so, it decides the scope.
After this PR: Grok, once I'm on my Linux machine to sign in. No release until every
platform works on all supported browsers.

ACCEPTANCE (DEC-062): one consolidated pass at about v12.20, from
docs/acceptance-checklist.md. Append this PR's steps there. Don't raise per-version
"acceptance owed"; after each merge, remind me of the optional 5-minute Safari smoke
check.

STANDING RULE: Safari, Chrome and Firefox are equal priority; none is primary
(DEC-047). Before any live measurement, confirm which userscript version is installed
in that browser (DEC-027): Chrome has 12.18.

PROCESS (HANDOFF §D, agent_docs/git-workflow.md): a read-only Phase 1 first, measure
before reasoning, wait for my decision before code; Tier 3 capped at 5 rounds; reinstall
in my Chrome and retest live; the three-engine final run (ask first, about 1h42m); open
the PR; /babysit-pr-cycle when I name it, plus one confirming @codex review; reinstall
and retest as an A/B; re-read the whole transcript and memory, then /update-project-docs
into the same PR. If I say I'm away, take over my Chrome and push through.

DO NOT:
- Merge anything without my explicit OK for that PR, or push to main. The ruleset
  allows no bypass: re-run a stalled CI job, never override it.
- Commit a CLAUDE.md change before I approve the diff.
- Report anything you cannot drive yourself (Safari + Userscripts) as verified.
- Cite green CI as real-browser evidence.
- Fix findings outside the task's scope. Log them to ROADMAP or TROUBLESHOOTING.
- Add long verification runs without asking first, with a time estimate.
- Record an acceptance more strongly than I reported it.
- Send, edit, regenerate, delete or share anything in my live accounts without asking.
- Create or delete bookmarks (or other navigator data) in my real browser profiles
  without asking.
- Read or write GM storage except through acnGetValue / acnSetValue /
  acnUpdateValue (collections through acnUpdateValue).
- Name my chats by title or quote their content: id prefixes only (the repo is public).

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my
untracked files (HANDOFF §E). Run `npm test` and the probes after any code change
(npm run test:probes stops at the Firefox U10 timeout on this Mac: run the rest
directly). Every claim carries its measurement context.
```
