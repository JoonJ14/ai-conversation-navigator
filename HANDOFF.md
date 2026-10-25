# Session Handoff — 2026-10-24 (v12.13 and v12.14: a second tab no longer erases bookmarks; Claude answer bookmarks work again)

**Scope:** the bookmark issue the owner found while live-testing v12.12, investigated read-only first, then fixed as
two PRs in the owner's order. **PR #85 (v12.13):** on Safari a second tab erased the first tab's bookmarks, in any
conversation. Every save of a collection now applies one change to what is stored. **PR #86 (v12.14):** answer
bookmarks on Claude were broken on all three browsers: no flags in project chats, labels by position, failed jumps.
Answers are now found inside rows, identified by position, and labelled "Answer to Q#n".

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-10-23_v12.11-v12.12-safari-parity.md` (v12.11/v12.12; its
§G was this session's prompt).

**Status at close:**
- **PR #85 (v12.13): MERGED** as `b96ec7b`. Owner acceptance: step 1 (the two-tab test) PASS on all three browsers;
  steps 2–7 not reported (a waiver, DEC-031). The owner-approved CLAUDE.md storage line is `ce7af86`.
- **PR #86 (v12.14): MERGED** as `79e4953`. Owner acceptance on all three browsers: steps 1–3 PASS everywhere;
  Chrome's and Firefox's steps 4–5 not reported (a partial waiver, DEC-031).
- **The session-close PR** (`docs/session-close-v12.14`, docs only): this handoff, the archive, ROADMAP's order and
  owed list. **The owner merges it**, or the next session does on the owner's OK.
- **Next session: v12.15, one combined PR** (the owner's plan, 2026-10-24), in three parts:
  - A, ChatGPT and Perplexity bookmarks;
  - B, the Perplexity one-click jump;
  - C, the Claude markup follow-ups.

  **The owner gives the full spec** as the first message of the next session, together with the kickoff prompt (§K).
  Nothing here pre-writes its scope (§G).

---

## A. State in one paragraph

main is v12.14. Collections in GM storage (bookmarks, saved commands, button positions, the context cache) save
through `acnUpdateValue`, which applies one change to the value as stored at the save: on Tampermonkey a read right
before the write, on Safari a queue per key that re-reads with `GM.getValue` (DEC-050; CLAUDE.md's storage line). On
Claude chats, bookmarks look for answers only inside the feed's rows (`ciAnswerNodeInRow`) and place each answer row
on its path entry by position (`ciAnswerMap`), never by text; an answer bookmark reads "Answer to Q#n", an unbound one
"A#?" (DEC-051). `getAIMessages`, `ciMessageNodeWithin` and the staleness check are unchanged on purpose. On ChatGPT
and Perplexity, bookmarks are still positional, which the owner confirmed in Safari on 2026-10-24 (§B.7), and
Perplexity's jump takes 2–3 clicks there. What stays open is v12.15 (§G: ROADMAP 13's bookmarks and jump, ROADMAP
14's Claude follow-ups) and the owed acceptance items in §G.

---

## B. What was accomplished

### 1. The investigation (read-only, before any code)

- **What.** The owner reported answer bookmarks broken on all three browsers (v12.12): flags only on the last ~3
  answers (Safari, Firefox) or none (Chrome), labels 1, 3, 2 for answers 49–51, every jump "not currently rendered".
  I answered eight questions, live in Chrome's page realm on the owner's real profile, read-only.
- **Why it broke.** Two stacked causes:
  - **Which answers:** `getAIMessages` returns the first selector that matches anything in the document, and
    `.font-claude-response`, first in the list, now matches only the project's name link in a hidden side panel.
    In a project chat the real answers (`[data-testid="assistant-message"]`) were never found; on v12.12 a scan could
    beat that link's render (~58 ms after the rows), which is why Safari once showed a few flags.
  - **Which message:** an answer got a uuid only if its rendered text equalled its payload text, and rendered answers
    open with an activity line the payload lacks. So answers were text-hash keyed, labelled by mounted position, and
    never reached the index jump.
- **Also found:** the Safari two-tab loss (confirmed by the owner's test: LOST), which became PR #85; a refetch while
  only scrolling, traced to the QUESTION side (multi-block questions: CSS list numbers and block joins), logged as the
  third PR (now v12.15, part C); dead regenerate detection; the misleading "all records carry a uuid" console line.
- **Path.** TROUBLESHOOTING "FIXED IN v12.14 — Claude answer bookmarks" and the two OPEN entries after it;
  DOM-REFERENCE "October 2026: answers, rows and the project link".

### 2. PR #85 — v12.13, cross-tab saves (DEC-050)

- **What / why.** Every bookmark of every conversation is one GM value. On Safari it was read once at load and each
  save wrote that copy back, so a second tab erased whatever another tab had saved. Saved commands, button positions
  and the context cache had the same shape. A stored value that did not parse was read as empty and written over.
- **Alternatives.** Refresh-then-write (races inside one tab), merging copies (cannot tell a deletion from an
  addition), and applying one change to what is stored (chosen). Settings and the org cache stay last-write-wins
  (owner).
- **How.** `acnUpdateValue(key, def, valid, apply)`; bookmarks merge by record id (an update never revives a record
  another tab deleted), commands by id (`name-2` on a clash), positions by platform, the context cache by
  conversation. Unreadable stored values are never written over (one console line and a toast). C0, an owner-run
  userscript, measured that a read in one tab sees another tab's write on all three managers before the fix was
  trusted.
- **Verification.** `probes/check-gm-storage.js` G7–G32; review: three tiers plus an adversarial workflow, Codex CLI 8
  rounds plus a post-fix pass, then 2 more Tier 3 rounds on the GitHub fixes (`e69d5da`, `23805a8`); GitHub Codex 3
  rounds, 1 finding (command use counting on replay; per-page use numbers). Owner: the two-tab
  test PASS on all three browsers; steps 2–7 not reported.
- **Path.** DEC-050; CHANGELOG 12.13; `reviews/review-2026-10-24-cross-tab.md` and `review-2026-10-24-23805a8.md`.

### 3. PR #86 — v12.14, Claude answer bookmarks (DEC-051)

- **Phase 1** (read-only; Chrome page realm; the owner's chats). Every chat with 12+ questions among the owner's 60
  most recent is in a project (the API's `project_uuid`); the decoy's text is the project's name. Claude mounts ~5
  rows at load even in a 4-question chat. `data-index` equals the path position and `data-perf-row` the path's sender
  on every row checked (53 row observations over 5 scroll stops on the 147-question chat; 7 and 5 rows on two others). The owner first reported older answers had no flag on hover, then
  retracted after a re-test: the flags were there; on a tall answer the flag shows only near its top edge (§B.6).
- **What / how.**
  - `ciAnswerNodeInRow(row)`: `[data-testid="assistant-message"]` inside a feed row, July's classes only inside rows.
  - `ciAnswerMap()`: places each mounted answer row by bracketing anchors, the adjacent question (matched now, with
    exactly one rendering answer between it and the next question; never a question past the fetched snapshot), or
    the last row when the counts agree. Routes must agree; nothing records an anchor.
  - Labels (`_bmLabel`): "Answer to Q#n" (Korean "Q#n에 대한 답변"), "A#?", "Answer to Q#?" while the index loads,
    "Answer (no question)". The export uses the same labels and order (`_bmSortKey`).
  - Existing records bind only on proof (`_bmProveAnswers`, `_bmBindAnswer` deciding on the stored list): the row they
    were made on, placed, and its text reproducing their hash. Otherwise "A#?", deletable.
  - The owner's four decisions: one refetch for a bookmark on an answer the index fetched mid-stream
    (`_bmRequestIndexRefresh`, through the scan's refetch path); text-bound records kept; the twin fix
    (`_bmFlagMatches`); the gate.
  - From review: a click acts only if its node still shows the answer its flag was drawn for (`_bmAnswerKeyNow`), in
    case Claude recycles nodes, which has never been measured live (§J); a jump lands only on an answer.
- **Alternatives rejected** (DEC-051): reorder `getAIMessages`; teach `ciMessageNodeWithin` the testid (would revive
  answer refetching, mutant M9); match text without the activity line; place rows by the stop_reason predicate alone
  (mutant M12); an answer count as the label (owner).
- **Verification.** `probes/check-answer-bookmarks.js` 36 checks in 6 runs (v12.13 fails 28; ~2 min per engine;
  owner-accepted size); 18 targeted mutants (`probes/run-answer-mutants.js`), each caught after the baseline passes.
  Review: Tiers 1–2, an adversarial workflow (16 of 18 confirmed), Codex CLI 8 rounds + 2 post-fix validations (39
  findings, 38 real; approved in rounds 7 and 8; the last post-fix fix was gated but not re-reviewed by Codex, the
  10-round cap — GitHub Codex then reviewed all the code clean). GitHub Codex: 2 rounds, 0 findings. Final local run:
  `npm test` 560/560 on Chromium, every probe, and the new probe 36/36 on all three engines. Owner: §A's status.
- **Path.** DEC-051; CHANGELOG 12.14; TROUBLESHOOTING; `reviews/review-2026-10-24-answer-bookmarks.md`;
  `docs/BOOKMARKS.md`; `docs/GET-AI-MESSAGES.md`.

### 4. Owner questions answered

- **Do bookmarks survive moving a chat into or out of a project?** Yes [inferred from the code and a measurement; the
  move itself was not tested]. The key is the page
  address, `origin + pathname` (`normalizeConversationUrl`), not the conversation id. Claude serves every chat at
  `/chat/<id>`, in a project or not: all 30 chat links on a project page are `/chat/<id>`, and the older
  `/project/<pid>/chat/<cid>` address renders no conversation [measured, Chrome page realm, 2026-10-24]. A move keeps
  the id, so the address and the bookmarks stay. Not tested by an actual move: asked whether a live check was worth
  it, I advised against one (it changes the live account); the owner has not decided. Recorded in `docs/BOOKMARKS.md`, architecture.md and conventions.md's key table.
- **The "294/295 conflict"** was two conversations: July's record is `b3c603a4` (its one non-rendering entry sits at
  path 199, not at the head), October's 147-question chat is `65dfa4f2` (294 entries). DOM-REFERENCE corrected.

### 5. Repo housekeeping

- The eleven merged remote branches of PRs #75–#85 deleted (owner's request); their tips are in the merges.
- Five lessons in `agent_docs/conventions.md`: one from PR #85 (`be36c24`: an async stub must answer with the value
  as it was when called), three from PR #86 (owner-approved), and one from the docs audit after it (a twin fixture
  must stay unbound while its twin is on screen; owner-approved). DEC-031 updated with v12.14, v12.13 and v12.12's
  itemized results.

### 6. Mistakes, kept because they generalize

- **A DOM count reported as what the owner sees.** Phase 1 counted flag elements; the owner reported no flag on hover.
  Both were true (the flag sat above the window). Now a lesson.
- **A probe helper trusted a mock that moves under it** (`mountRow`), and **a precondition described the fixed build's
  behaviour**, which made v12.13's checks INVALID instead of red. Both lessons.
- **A "conflict" reported without checking the conversation id** (294/295 above).
- **An inference written as fact:** "made on the project link, as predicted" in TROUBLESHOOTING about the owner's
  unbound records. Removed: why each did not bind was not measured.
- **Miscounts corrected before or after commit:** the adversarial tally (15 → 16), a token total, and PR #85's
  CHANGELOG naming `c4d1ec4` as the final build after two code commits followed it.

### 7. The owner's results and plan, from the planning thread (2026-10-24, after the merges)

- **New owner results** [measured, owner, Safari + Userscripts, v12.14], recorded as written in DEC-031 and ROADMAP 13:
  - **v12.10's owed Safari check, ChatGPT and Perplexity:**
    - question lists PASS on both (all questions listed);
    - ChatGPT jumps work, but a far jump sometimes lands near the target (e.g. on answer 14 instead of question 14);
      a second click lands exactly;
    - Perplexity jumps FAIL as a one-click jump: a mid-conversation jump stops partway (from Q12, clicking Q5
      stopped mid-answer 7), and it takes 2–3 clicks to arrive. The first question works. The Chrome comparison has
      not been checked yet.

    So DEC-031's v12.10 Safari item: lists PASS; it stays open for the Perplexity jump.
  - **Bookmarks on ChatGPT and Perplexity** (Safari; confirms ROADMAP 13 in a real browser):
    - answers: no flags at all on either site;
    - questions: labels are on-screen positions (two different questions both read "Q4"; a 16-question thread
      shows only Q1–Q4), and a jump to an off-screen question shows "not currently rendered".
- **The next session's plan:** one combined PR, v12.15 (§G.1). It replaces the earlier plan of a third PR holding
  ROADMAP 14 alone.
- **Confirmed already in the repo:** the storage-key answer (§B.4; docs/BOOKMARKS.md), the later items (ROADMAP,
  "Current Status") and the process (§D). One pointer was added: "Perplexity attachment images" now says where the
  repo records it (the gallery marks Perplexity unsupported; there is no backlog item of its own yet).

---

## C. Architecture snapshot

Changed:
- **`acnUpdateValue`** for collections (DEC-050). CLAUDE.md: a collection saves through it, never `acnSetValue`.
- **Answers on Claude for bookmarks:** `ciAnswerNodeInRow` / `ciAnswerMap` (architecture.md's ci table and two new
  invariants: no document-wide answer finder, no text identity; no answer nodes to the staleness check).
- **The virtualizing mock** has October knobs, all off by default: `answerTestid`, `answerHeaders`, `decoy`,
  `unansweredTurns`, `tailRows`.

---

## D. Key principles established

- **Process that worked (owner, 2026-10-24):**
  - **Owner-run measurement scripts before building** what depends on an unmeasured runtime fact (B0 for Safari's
    storage; C0 for cross-tab reads, all three managers) — the fix was trusted only after C0 passed.
  - **Change one thing at a time when comparing** (the project vs non-project test that isolated the decoy).
  - **Investigation first:** a read-only Phase 1 with measured findings, then the owner decides, then code.
- **A mechanism counts only with a check that fails without it.** For PR #86 the owner approved ~10 targeted mutants;
  review raised it to 18, accepted because the runtime stayed within budget. Run the unmutated build first.
- **Run all three review tiers before pushing a code PR.** GitHub Codex afterwards found nothing on #86 (2 rounds, 0
  findings) and one issue on #85 (3 rounds, 1 finding).
- **Log, don't perfect, a field nothing reads** (owner; the command use counter).
- **When a finding is about what the user sees, measure what is visible** (lesson).

---

## E. Git state

`main` is at `79e4953` (the PR #86 merge) and holds v12.14.

| Commit | What |
|---|---|
| `f3f529e`–`ba293c2` | **v12.13**: C0, code, gates, review fixes, CLAUDE.md (`ce7af86`), acceptance |
| `b96ec7b` | **merge of PR #85** |
| `dbf1925` | **v12.14** code, mock knobs, probes, CI |
| `ecdfb45` | the A36 export capture (WebKit) |
| `df28497`–`0a96258` | PR #86 docs: DEC-051, review record, acceptance, lessons, the detailed docs pass |
| `79e4953` | **merge of PR #86** |
| session-close PR | `docs/session-close-v12.14`: this handoff, the archive, ROADMAP's order and owed list |

- **Remote branches:** `main`, `fix/claude-answer-bookmarks` (merged; left in place) and, once pushed, the
  session-close branch.
- **Deleted this session** (owner's request), each checked as an ancestor of `origin/main` and as a merged PR's
  branch. Their tips, for recovery:

  | Branch | Tip | PR |
  |---|---|---|
  | `docs/v12.9-post-merge` | `fb5193e` | #76 |
  | `docs/v12.9-handoff` | `ced1ae5` | #77 |
  | `feat/chatgpt-perplexity-index-adapters` | `e390efe` | #78 |
  | `docs/v12.10-close-out` | `cdc1ea3` | #79 |
  | `docs/session-close-v12.10` | `12262d2` | #80 |
  | `fix/turn-counter-dots` | `763f0d7` | #81 |
  | `fix/safari-parity` | `5af4d79` | #82 |
  | `docs/v12.12-closeout` | `8d78d46` | #83 |
  | `docs/session-close-v12.12` | `594b1b1` | #84 |
  | `fix/cross-tab-storage` | `ba293c2` | #85 |
  | `fix/safari-transport-fallback` | `9ed5182` | #75 |
- **Merges use merge commits** (`gh pr merge --merge --match-head-commit <full SHA>`). An abbreviated SHA fails with
  "Could not coerce value … to GitObjectID"; use `$(git rev-parse HEAD)`. The ruleset requires all nine CI checks and
  allows no bypass; this session needed no reruns.
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `ROADMAP.md` "Current Status" | the v12.15 plan, the later items, the owed list |
| `ROADMAP.md` **item 13** | parts A and B: the owner's Safari results, the logged bookmark and jump items, the ids the adapters fetch (`data-turn-key`, `backend_uuid`) |
| `ROADMAP.md` **item 14** | part C's items and the logged list |
| `ROADMAP.md` → "Porting the Layer 4 response to another platform", **Step 4** | part A: users' saved bookmarks on a platform that changes identity |
| `DECISIONS.md` **DEC-046** | parts A and B: the index adapters (`IX_ADAPTERS`, `ixAdapter`, `ixLoad`, `ixScan`, `ixJump`), the Perplexity jump's wheel event |
| `probes/check-index-adapters.js`, `tests/mock-pages/chatgpt-windowed.html`, `perplexity-windowed.html` | parts A and B: the mocks that genuinely unmount, and the probe built on them |
| `TROUBLESHOOTING.md` → "OPEN — Claude refetches the whole conversation while you only scroll" and "OPEN — Claude: a regenerated or late answer no longer triggers a resync" | part C's debugging stories so far, the options and the measurement method |
| `DECISIONS.md` **DEC-051**, **DEC-050**, **DEC-031** | answer identity and its residuals; cross-tab saves; live status |
| `DOM-REFERENCE.md` → Claude, "October 2026: answers, rows and the project link" | the markup part C reads |
| The userscript: `_ciAssistantStale`, `_ciNeedsResync`, `_ciMergeLiveMessages`, `ciMessageNodeWithin`, `ciMatchRowToPath`, `_cleanText`, `_mdFlatten`, `ciAnswerMap` | the staleness check and the question matcher (part C), and what v12.14 built beside them |
| `DECISIONS.md` **DEC-051**, `docs/BOOKMARKS.md` | part A's model: how Claude answers got identity by position, proof binding, "A#?" |
| `probes/check-answer-bookmarks.js` (A6: no refetch while scrolling; A25: the July markup's control) | a refetch instrument to build on. A6 passes on v12.13: the mock has no multi-block question yet, so part C needs a new fixture before A6 can fail on the question side |
| `agent_docs/conventions.md` → "Lessons Learned" | this session's five lessons |

---

## G. What comes next

1. **v12.15: one combined PR, three parts in separate commits** (the owner's plan, 2026-10-24):
   - **A, ChatGPT and Perplexity bookmarks:** questions and answers keyed by the ids the adapters fetch; "Q#n" /
     "Answer to Q#n"; jumps to off-screen messages; legacy records bind on proof or show "#?" (ROADMAP 13).
   - **B, the Perplexity one-click jump**, and ChatGPT's near-miss if it is the same cause (ROADMAP 13).
   - **C, the Claude markup follow-ups** (ROADMAP 14): the question-side refetch while scrolling, dead regenerate and
     late-answer detection, the question-identity risk.

   **The owner gives the full spec** as the first message of the next session. Do not pre-write its scope from this
   list.

   The shape:
   - one read-only Phase 1 for all three parts;
   - one owner decision checkpoint;
   - one combined owner acceptance pass;
   - one merge.

   Its process changes: **Tier 3 is capped at 5 rounds**, and **new issues found during acceptance are logged for a
   later PR unless they block this one.** The same scope guard and measure-first rules apply.

   Where Phase 1 can start:
   - part C: the first measurement is named in TROUBLESHOOTING's question-side entry, under "Owed": for each mounted
     question, its block count and the comparison at its path position;
   - part B: the Chrome comparison the owner has not run yet.

   Before measuring live, confirm which userscript version is installed in the measurement browser (DEC-027).
   Branch from `main` after the session-close PR merges (ask if it has not).
2. **Owed acceptance, recorded as "not reported" until the owner sends results** (DEC-031):
   - PR #85 (v12.13): steps 2–7, all three browsers.
   - PR #86 (v12.14): Chrome's and Firefox's steps 4–5. The optional steps 6–7 were not run on any browser.
   - v12.12: the language change, turn-counter dots, quit-and-reopen Safari, ChatGPT and Perplexity on Safari; Chrome
     and Firefox: bookmarks and language surviving the update, and plan usage.
   - v12.11: ChatGPT's 130-question dots (not checked); Chrome and Firefox, the panel closing on navigation
     unchanged (not reported).
   - v12.10: Safari's check of ChatGPT and Perplexity. Lists PASS (owner, 2026-10-24, on v12.14). It stays open for
     the Perplexity jump (v12.15 part B). ChatGPT's far jump sometimes lands near the target; the Chrome comparison
     has not been checked. DEC-031 keeps the earlier records under it.
3. **Later; the owner decides the order** (2026-10-24):
   - Grok on all three browsers;
   - Gemini (does it keep or slide older turns?);
   - Perplexity attachment images;
   - the CI rebuild (0e);
   - the context-window meter's recalibration to the current limit, verifying it per model first (12);
   - the stale "Turn N" badge on non-Claude sites;
   - the "reset, keeping a backup copy" action (0d);
   - the AbortController follow-up for the ladder's caps (0d);
   - Chrome's intermittent v12.9-era 403 (never reproduced since; logged, not active);
   - someday, at low priority, a Windows spot-check of Chrome and Firefox.

---

## H. Operational context + owner rules

Carried over, still in force:
- **Safari, Chrome and Firefox are equal priority** (DEC-047). Acceptance on all three comes before a merge, unless
  the owner waives it for that PR. Record every waiver in DEC-031.
- **Merge authority is per PR and explicit.** Nothing in this document authorizes a merge.
- **Live-confirmation results go in DEC-031 only, exactly as reported.** Blanks are "not reported"; ask once.
- **Live work in the owner's accounts is strictly read-only** (inspecting the DOM, the console and GET API reads are
  fine; no message sent, edited or deleted; no bookmark created or deleted without asking).
- **CLAUDE.md changes:** show the diff and commit only on approval. Lines state rules, with no version tags or
  mechanism details.
- **Scope:** build the minimal version of the spec; log out-of-scope findings to ROADMAP or TROUBLESHOOTING.
- **Proof:** the gate probe; `npm test` and the probes after any code change (CLAUDE.md rule 7), with the
  three-engine runs on the final build; ask before any long run, with a time estimate. `npm run test:probes` stops at `check-usage-state`'s Firefox U10
  timeout on this Mac (its `&&` chain): run the probes after it directly.
- **Every claim carries its measurement context.** Safari + Userscripts can only be verified by the owner.
- **CI is not real-browser evidence.** Restart stalled or failed jobs; never override.
- **Review:** the pipeline's Tier 3 (Codex CLI) runs without asking and loops until clean: 10 rounds at most by
  default, **5 for v12.15** (the owner, 2026-10-24).
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** run them only when the owner names them. On a
  babysit after a clean automatic Codex review, post `@codex review` once more.
- **Git:** explicit `git add` paths; never push to `main`.

New this session:
- **Log, don't perfect, a field nothing reads** (owner, on the command use counter; memory).
- **The owner's process** (§D): owner-run measurement scripts first; one change at a time when comparing; a
  read-only Phase 1 before code.
- **Live Chrome checks** go through claude-in-chrome on the owner's real profile; if the extension does not connect,
  launch Chrome, retry, then ask the owner (they reconnect it with `/chrome`).
- **For v12.15** (the owner, 2026-10-24): one Phase 1, one decision checkpoint, one combined acceptance pass, one
  merge; Tier 3 capped at 5 rounds; new issues found during acceptance are logged for a later PR unless they block
  this one.

---

## I. Deferred / future work

Not queued; §G comes first. Each is logged where named.
- **The ROADMAP 14 logged list.** The owner approved its first six items before the code. The rest were added from
  review and measurement, marked "(added later)". Highlights:
  - `getAIMessages`' other readers still see the project link;
  - Search's own `A#` numbering, and Export's DOM path keeping the ⚑ glyph;
  - the flag guard checks our attribute, not the flag; nested flag nodes never heal;
  - question flags' click closures (the recycling pattern);
  - on a tall answer the flag shows only near its top edge (a sticky-flag proposal, with its checks);
  - a repeated prompt anchoring to the old entry;
  - comments that disagree with the code, and the bookmark test gaps.
- **DEC-050's residuals.** The owner accepted three of them: there is no atomic compare-and-swap across tabs; a
  stored value that cannot be read blocks saving that collection; and a command's use can be counted twice ("keep
  it; the residual is accepted (usageCount is never read)"). A "reset, keeping a backup copy" action is logged
  in ROADMAP 0d. The rest of DEC-050's list is recorded, not fixed.
- **ROADMAP 0d logs one pre-existing issue:** on Tampermonkey, a migration whose save throws is not retried.
- **The local WebKit question** (TROUBLESHOOTING, "OPEN — Local mac WebKit").

---

## J. Risk caveats / known limitations

- **DEC-051's residuals:** an edit or a regenerate before the resync can give a new answer the old answer's uuid (it
  then reads "A#?"); an answer next to a multi-block question with no bracketing anchors stays unplaced; a bookmark
  taken on an answer before 200 characters rendered can never prove; one refetch request is spent if a load is
  already in flight; "Answer (no question)" is reached by no fixture. More in DEC-051: the actions bar's changing
  text, the activity line changing between bookmark and proof, a repeated prompt's anchor, and the gate's known gaps.
  Several review fixes have no check that fails without them (DEC-051, Gates).
- **The question-side refetch is live:** 3 times in one page load while scrolling the 147-question chat [measured,
  Chrome, v12.13]. It fires once per distinct set of mismatching mounted questions, at most one per 15 s, and again
  for a set whose download the user scrolled away from [code]. Each refetch re-downloads the conversation, resets
  anchors and cancels a jump in flight. The options and the measurement method: TROUBLESHOOTING, the OPEN entry.
- **Bookmarks are keyed by the page address.** If Claude puts the project back into chat addresses, a moved chat's
  bookmarks would stay under the old address (§B.4).
- **The mock does not recycle nodes;** R6 moves them by hand. Whether Claude reuses or rebuilds message nodes has never
  been measured live (ROADMAP item 8).
- **Owner acceptance gaps** are listed in §G.2, including v12.10's Safari check, open for the Perplexity jump.
- **On ChatGPT and Perplexity, bookmarks are positional** [measured, owner, Safari, v12.14]: answers get no flag, two
  different questions can read "Q4", and a jump to an off-screen question fails. v12.15 part A.
- **Test engines:** local mac WebKit fails the 4 known jump entries; `check-usage-state` U10 times out on Firefox on
  this Mac, intermittently (2026-10-24: 2 of 3 runs passed, the final run among them; TROUBLESHOOTING).

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md
(2026-10-24, v12.13 and v12.14; next: v12.15).

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats).

FIRST, CHECK STATE — do not assume:
  git fetch origin
  git log --oneline --first-parent -4 origin/main
  gh pr list --state open
main should be v12.14 and include the merges of PR #85 (b96ec7b) and PR #86
(79e4953). If the session-close PR (branch docs/session-close-v12.14) is still
open, HANDOFF.md and ROADMAP.md on main are the OLD ones: read both from that branch
(git show origin/docs/session-close-v12.14:HANDOFF.md, and the same for ROADMAP.md)
and ask me whether to merge it before you branch.

THIS SESSION: v12.15, ONE combined PR in three parts, separate commits (HANDOFF §G.1):
  A. ChatGPT + Perplexity bookmarks (ROADMAP 13)
  B. the Perplexity one-click jump, and ChatGPT's near-miss if same cause (ROADMAP 13)
  C. the Claude markup follow-ups (ROADMAP 14)
My full spec is in this message, after this prompt; it decides the scope, not the
handoff. Confirm your understanding of the handoff and the spec, then run ONE
read-only Phase 1 for all three parts: measure first, report, and wait for my
decisions (one checkpoint) before any code. Read HANDOFF §B.7, ROADMAP 13 and 14,
DEC-046, and TROUBLESHOOTING's two OPEN Claude entries before reasoning about a
cause. Before any live measurement, confirm which userscript version is installed
in that browser (DEC-027).

PROCESS FOR v12.15: Tier 3 capped at 5 rounds. One combined owner acceptance pass,
one merge. New issues found during acceptance are logged for a later PR unless they
block this one.

STANDING RULE: Safari, Chrome and Firefox are equal priority; none is primary
(DEC-047). I work mostly on the Mac: Safari first, Chrome if Safari fails.

DO NOT:
- Merge anything without my explicit OK for that PR, or push to main. The ruleset
  allows no bypass: re-run a stalled CI job, never override it.
- Commit a CLAUDE.md change before I approve the diff.
- Report anything you cannot drive yourself (Safari + Userscripts) as verified.
- Cite green CI as real-browser evidence.
- Fix findings outside the task's scope. Log them to ROADMAP or TROUBLESHOOTING.
- Add long verification runs without asking first, with a time estimate.
- Record an acceptance more strongly than I reported it.
- Send, edit, regenerate, delete or share anything in my live accounts.
- Create or delete bookmarks (or other navigator data) in my real browser
  profiles without asking.
- Read or write GM storage except through acnGetValue / acnSetValue /
  acnUpdateValue (collections through acnUpdateValue).

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my
untracked files (HANDOFF §E). Run `npm test` and the probes after any code change
(npm run test:probes stops at the Firefox U10 timeout on this Mac: run the rest
directly). Every claim carries its measurement context.
```
