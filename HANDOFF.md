# Session Handoff — 2026-10-31 (v12.15: one-click jumps on Perplexity and ChatGPT, bookmarks by message id there, Claude rows by their data-turn-key)

**Scope:** the owner's v12.15 spec, one combined PR in three parts. **B:** Perplexity jumps took 2–3 clicks and
ChatGPT's far jump landed near its target; they now land in one click. **A:** ChatGPT and Perplexity bookmarks were
positional, and answers had no flags; they are now keyed by each message's own id. **C:** Claude refetched the
whole conversation while you only scrolled, and regenerated answers went unnoticed; rows are now identified by their
own `data-turn-key`. Built by a workflow, reviewed (Tier 3 at the owner's cap of 5), checked live in the owner's
Chrome before the PR, babysat through GitHub Codex, retested live, merged.

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-10-24_v12.13-v12.14-bookmarks.md` (v12.13/v12.14; its §G
was this session's plan, and the owner's spec was this session's first message).

**Status at close:**
- **PR #88 (v12.15): MERGED** 2026-10-31 as `6baac2e`, on the owner's explicit OK, **before any acceptance step
  was reported** (a waiver, DEC-031). Owner acceptance on Safari, Chrome and Firefox is owed; the steps are the PR's
  first comment.
- **PR #89** (`docs/v12.15-merge-followup`, docs only): the merge record and waiver, the J15 CI timing race, the
  agent_docs and the gaps found re-reading the session, and this handoff. **The owner merges it**, or the next
  session does on the owner's OK.
- **Next session:** no spec yet. The owner's acceptance of v12.15, then whichever item the owner picks (§G).

---

## A. State in one paragraph

main is v12.15. On ChatGPT and Perplexity, an index-backed jump (`ixJump`) steps toward its target and then lands
through `ixLandOn`: instant `scrollTop` writes, each re-located by identity, until within 8 px or 4 writes; a target
still out of view at that cap is `'cap-out'`, a toast (DEC-052). Bookmarks there are keyed by the message's own id
(ChatGPT: the turn's `data-turn-key`, the answer unit's message id; Perplexity: `backend_uuid`, `backend_uuid:answer`),
labelled "Q#n" / "Answer to Q#n", filed under one canonical key per conversation, and old positional records bind
only on proof or read "Q#?" / "A#?" (DEC-053). Perplexity compares a question bubble with its `query_str` through
`ixPplxTextKey`, which drops only the markdown the bubble renders. On Claude, rows take their identity from their one
`data-turn-key`, cross-checked against position, with text matching only as the fallback, and staleness reads the ids
('k', 'p', 'x'), so scrolling no longer refetches and a regenerate resyncs once (DEC-054). Open: the owner's
acceptance; Claude's jump to the latest question from the top (pre-existing); the J15 CI race; the logged residuals
(ROADMAP 13 and 14).

---

## B. What was accomplished

### 1. Phase 1: one read-only investigation for all three parts

- **What.** A 9-agent workflow (two investigators and an adversarial verifier per part) on the code and mocks, plus
  live measurements in the owner's Chrome (v12.14 installed, visible tab, read-only, GET reads of each site's JSON).
  One report, one owner checkpoint.
- **Findings** (all in DEC-052 to DEC-054, with their contexts):
  - **B:** a jump counted "mounted" as "arrived", then ended with one smooth `scrollIntoView` that both sites cut
    short: Perplexity 8 of 8 runs, −99 to −1255 px; an instant scroll landed within 16 px 8 of 8. ChatGPT's near-miss
    was the same: a glide cut off when older turns were prepended. **No code regression since v12.10**: the jump code
    is identical from `166a281`, and the mocks gave v12.10 and v12.14 the same result within 3 px.
  - **A:** every id route was gated on Claude; ChatGPT's answer selectors matched 0 nodes live; Perplexity's
    `[class*="prose"]` drew 5 flags into one answer. The answer ids exist: ChatGPT's
    `data-chatgpt-search-message-ids` (10 of 10 turns, one with 22 assistant nodes); Perplexity's
    `[data-workflow-final-text]` slot.
  - **C:** every Claude row carries its message uuid on `[data-turn-key]` (294 of 294 rows), which DEC-023 had recorded
    as absent in July; text comparison failed 31 of 129 questions, 27 within 200 characters.
- **The owner's decisions:** B, A and C as proposed; "Save if id, else refresh" for a message the index does not hold
  yet; two scope additions (one store key per conversation; bind hash-keyed Claude question records on proof).

### 2. The build, integration and review

- **How.** A build workflow implemented B and C in parallel worktrees, then A on top of B, each with a review and a
  fix round; the parts were cherry-picked onto `fix/v12.15-bookmarks-jumps-claude` in the order B, A, C, keeping
  their own commits. Version 12.15; the three new probes joined `test:probes` and CI; the CI job cap went from 20 to
  30 minutes.
- **Review** (`reviews/review-2026-10-25-v12.15.md`): Tiers 1–2 in session; Tier 3 (Codex CLI) 5 rounds, the
  owner's cap: 19 raw findings, 16 verified, 12 fixed, each gated except one (N1e, N1f, N1g, J15, G17/G17b).
- **Verification:** the pre-approved three-engine run on `2ef0d80`: `npm test` Chromium and Firefox 560/560, WebKit
  556/560 (the 4 known local jump entries); the new probes pass on all three engines; the known Firefox U10 timeout.

### 3. The live check in the owner's Chrome, before the PR (found one bug)

- **What.** Installed the build through Tampermonkey (TESTING.md, "The live check in the owner's Chrome") and ran the
  owner's four checks on ChatGPT (24 questions), Perplexity (12) and Claude (147), with test bookmarks deleted
  afterwards.
- **Found:** Perplexity Q10, a pasted README, stopped 862 px short 4 of 4 times, and its flags had no key. Its bubble
  renders markdown (images as alt text, tables without pipes, a "Read more" button), so it never matched its
  `query_str`. Fixed (`989fe0a`) with `ixPplxTextKey` at all four compare sites; gated by J16/J16b.
- **Found, pre-existing, logged:** on Claude, a jump to the latest question from the top ends at the bottom, past it,
  on 12.15 and on v12.14 alike (measured by downgrading to v12.14 live, then reinstalling). TROUBLESHOOTING, OPEN.
- **Recorded, unexplained:** four "out of sync" lines in about a second on the pre-fix build; the console reader later
  repeated one line six times, which may explain it (TROUBLESHOOTING).
- **Result:** all four checks passed on ChatGPT and Perplexity; on Claude the bookmarks read and jump and a full
  202-step scroll printed no "out of sync" line.

### 4. The PR, the Codex cycle, the final retest, the merge

- **GitHub Codex:** round 1 found that `989fe0a`'s letters-and-digits key read "10+2" and "10/2" as one question;
  fixing it also caught `_mdFlatten` deleting parentheses (`1a6de53`, J17/J17b). Round 2: rendered single-marker
  italics left an unchanged question stale (`12ad0a6`, J17c). Rounds 3 and 4 clean.
- **Final live retest** on `12ad0a6` (reinstalled): the same checks passed on all three sites.
- **CI:** `firefox on ubuntu-latest` failed J15 once after 16 min (a timing race in the probe's mock, not the code);
  re-run at the owner's request, green. **Merged** on the owner's OK.

### 5. The docs follow-up (PR #89)

The waiver in DEC-031 and CHANGELOG; every v12.15 status line set to merged; the J15 race (TROUBLESHOOTING, OPEN;
TESTING.md); agent_docs (the bookmark key, the adapter hooks, `ixLandOn`, Claude row identity); and, from re-reading
the whole session transcript at the owner's request: the live-check procedure in TESTING.md, v12.15's live markup in
DOM-REFERENCE, the four probes missing from `probes/README.md`, and what to expect of old positional records
(DEC-053).

### 6. Mistakes, kept because they generalize

- **Loosening a compare to fix false mismatches broke its job of telling edits apart.** The letters-and-digits key
  made Q10 match, and made "10+2" equal "10/2"; GitHub Codex caught it. When widening an identity compare, add a check
  that it still rejects a meaningful edit (J17–J17c).
- **A test helper's matcher must be unique before its results count.** A 60-character prefix matched three ChatGPT
  questions, and Navigate's "..." truncation hid two more; the jumps were fine, the helper was wrong.
- **A timing window in a mock is a race in CI.** J15's 1 ms pin lost once on a slow runner.

All three are in `agent_docs/conventions.md` → "Lessons Learned", and CLAUDE.md's measurement-context table gained the
Perplexity bubble row (both approved by the owner, 2026-10-31).

---

## C. Architecture snapshot

Changed (agent_docs/architecture.md has the details):
- **The adapter seam** gained `bookmarkUrl`, `pathId`, `bookmarkables`, `keyOf` and `extent`; jumps land through
  `ixLandOn`; Perplexity's question compare is `ixPplxTextKey` on `ixPplxBubbleText`.
- **Bookmarks on ChatGPT and Perplexity:** `_bmIxInject`, `_bmIxJump`, `_bmIxRequestRefresh` / `_bmIxAllHeld`,
  `_bmMergeSplitKeys`; one store key per conversation (agent_docs/conventions.md, storage keys).
- **Claude:** `ciRowTurnKey`, `ciRowSender`, `ciRowIdPath`, `ciRowIdPathChecked`, `_ciKeyTextEdited`,
  `_ciStreamToken`, `_ciReportTurnKeys`, `_bmProveQuestions`; `ciUuidForText` reads the row's id first.
- **Mocks:** `jumpModel` and `bmModel` blocks in both windowed mocks (off by default); Claude mock turn-key knobs.

---

## D. Key principles established

- **The owner's live-test-before-PR process** (2026-10-25): build → install in Chrome → the owner's checks → fix and
  reinstall until they pass → PR → babysit → final reinstall and retest. It found a bug every mock passed.
- **A mock models what was measured, not what was assumed.** The windowed mocks rendered `query_str` as plain text;
  the live bubble renders markdown. Measure a live rendering before trusting a text compare against it.
- **Assert where the target ended up**, not which entry resolved (DEC-052; the old P13 passed throughout).
- **Measure "regression" before claiming it either way:** Claude's latest-question miss looked like part C's doing
  and was the same on v12.14.
- **Re-read the whole transcript before closing a long session** (the owner, 2026-10-31): it found five gaps in docs
  that looked complete.

---

## E. Git state

`main` is at `6baac2e` (the PR #88 merge) and holds v12.15.

| Commit | What |
|---|---|
| `d579600` | Phase 0: the owner's Chrome result and Safari bookmark findings in DEC-031 and ROADMAP 13 |
| `2d29022`–`2e22c53` | **part B**: the landing, the gate, the review fix |
| `59d4422`–`8b5b097` | **part A**: bookmarks by id, the store key, the review fix |
| `3bdaf87`–`9b16225` | **part C**: rows by `data-turn-key`, the gate, the review round |
| `71eda09` | version 12.15; probes in `test:probes` and CI |
| `500ced6`, `f5a036e`, `92dd6c8` | Tier 3 fixes, rounds 1–5 |
| `2ef0d80` | the review summary |
| `989fe0a` | the live check's Perplexity text fix |
| `6adde2f`, `353db37` | the v12.15 docs; the PR number |
| `1a6de53`, `12ad0a6` | GitHub Codex rounds 1 and 2 |
| `258c5c4` | the final live retest's record |
| `6baac2e` | **merge of PR #88** |
| `e5c32fc`, `d53fe16`, `360d59a`, this handoff | PR #89, `docs/v12.15-merge-followup` |

- **Remote branches:** `main`, `fix/v12.15-bookmarks-jumps-claude` (merged; left in place), `docs/v12.15-merge-followup`
  (PR #89).
- **Local-only branches** left by the build workflow, all merged through PR #88's cherry-picks: `v1215-A`,
  `v1215-A-fix`, `v1215-B`, `v1215-B-fix`, `v1215-C`, `v1215-C-fix`, and six `worktree-wf_2be744b1-3b4-*`. Their
  worktrees are removed. Delete the branches on the owner's OK.
- **Merges use merge commits** (`gh pr merge --merge`); the ruleset requires all nine CI checks and allows no bypass.
  PR #88 needed one re-run (J15).
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `ROADMAP.md` "Current Status" | v12.15, the "Later" list, the owed list |
| `DECISIONS.md` **DEC-052**, **DEC-053**, **DEC-054**, **DEC-031** | the three parts' designs and residuals; live status and the waiver |
| `CHANGELOG.md` 12.15 | every result with its context, the live check, the Codex rounds, CI |
| `TROUBLESHOOTING.md` → "OPEN — Claude: a jump to the latest question…", "OPEN — CI: `check-ix-jumps` J15…" | the two open items this session found |
| `TESTING.md` → "The live check in the owner's Chrome" | how to install a build and measure live |
| `agent_docs/architecture.md`, `agent_docs/conventions.md` | the adapter hooks, the landing, row identity, the store key; this session's three lessons |
| `DOM-REFERENCE.md` → ChatGPT, Perplexity, Claude | the markup v12.15 reads |
| `probes/check-ix-jumps.js`, `check-ix-bookmarks.js`, `check-claude-turnkeys.js`, `probes/README.md` | the gates |
| `reviews/review-2026-10-25-v12.15.md` | the review record, Tier 3 and the Codex rounds |

The Phase 1 reports and the build brief were session scratch files and no longer exist; their findings are in
DEC-052 to DEC-054.

---

## G. What comes next

1. **The owner's acceptance of v12.15** on Safari + Userscripts, Chrome + Tampermonkey and Firefox + Tampermonkey: the
   steps on PR #88's first comment
   (https://github.com/JoonJ14/ai-conversation-navigator/pull/88#issuecomment-6399417237), plus the optional Claude
   throwaway-chat step (send a message, regenerate an answer), which measures the facts no agent could without
   writing to the account: whether a just-sent message's key is final at once, whether and when a regenerate changes
   the row's key (L3), and whether an edit keeps it (L4). Record results in DEC-031 exactly as reported. Step 6
   (ChatGPT) and step 11 (Perplexity) count old bookmarks that bind versus read "Q#?" (most are expected to read
   "Q#?", DEC-053).
2. **Then the owner picks the next item.** No spec exists; do not pre-write one. The "Later" list (ROADMAP, Current
   Status):
   - Claude's jump to the latest question from the top (TROUBLESHOOTING, OPEN; a likely fix is `ixLandOn`-style
     instant writes for a far mounted target);
   - `check-ix-jumps` J15's CI race (a clock-independent pin for its mock; probe only);
   - Grok on all three browsers; Gemini (does it keep or slide older turns?);
   - Perplexity attachment images; the CI rebuild (0e); the context-window meter's recalibration (12);
   - the stale "Turn N" badge on non-Claude sites; the "reset, keeping a backup copy" action (0d); the AbortController
     follow-up (0d); Chrome's v12.9-era 403 (logged, not active); someday, a Windows spot-check.
3. **Owed acceptance from earlier releases** (DEC-031): PR #85's steps 2–7; PR #86's steps 4–5 on Chrome and Firefox;
   the v12.12 items never reported; v12.11's ChatGPT dots; v12.10's Safari Perplexity jump (now v12.15's).

---

## H. Operational context + owner rules

Carried over, still in force:
- **Safari, Chrome and Firefox are equal priority** (DEC-047). Acceptance on all three comes before a merge unless the
  owner waives it for that PR; record every waiver in DEC-031 and the release's CHANGELOG entry.
- **Merge authority is per PR and explicit.** Nothing in this document authorizes a merge.
- **Acceptance results go in DEC-031 only, exactly as reported.** Blanks are "not reported".
- **Live work in the owner's accounts is read-only.** GET reads of a site's own JSON are fine. Test bookmarks only when
  the owner allows them; delete exactly those afterwards; never touch the owner's.
- **CLAUDE.md changes:** show the diff; commit only on approval.
- **Scope:** build the minimal version of the spec; log out-of-scope findings to ROADMAP or TROUBLESHOOTING. New
  issues found during acceptance are logged for a later PR unless they block this one.
- **Proof:** a gate that fails without each mechanism; `npm test` and the probes after any code change;
  `npm run test:probes` stops at the Firefox U10 timeout on this Mac, so run the rest directly; ask before any long
  run, with an estimate.
- **Every claim carries its measurement context.** Safari + Userscripts can only be verified by the owner.
- **CI is not real-browser evidence.** Re-run a stalled or flaky job; never override. A failure well inside the job
  cap is not a stall: read the failing check first (the owner wants the logs if a re-run fails again).
- **Review:** Tier 3 (Codex CLI) runs without asking; capped at 5 rounds when the owner says so (v12.15 did).
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** only when the owner names them. After a clean
  Codex review, post `@codex review` once more.
- **Git:** explicit `git add` paths; never push to `main`.

New this session:
- **Live-test before the PR, and again after the babysit** (the owner, 2026-10-25; §D; memory).
- **Installing a build in the owner's Chrome** is allowed for these checks: press Tampermonkey's Reinstall / Update /
  Overwrite (the owner: "click, both either of those buttons when you see it"); it needs the Mac unlocked.
- **The claude-in-chrome extension** may need the owner to sign in again before it connects (2026-10-25; reported to
  the Claude Code team through `/feedback`, receipt `a9ec2258-c3ae-463b-9c63-96521fa8d94b`).
- **Before a session-close handoff, re-read the whole transcript** for undocumented facts (the owner, 2026-10-31).

---

## I. Deferred / future work

Not queued; §G comes first. Each is logged where named.
- **ROADMAP 13's v12.15 lists:** short Perplexity threads (no scroll container); `getAIMessages`' other readers;
  `ixJump` without a hidden-tab guard or wall-clock cap; `orbScrollToMessage` without `releaseScroll`; B6 (fewer
  entries mounted than live); A-N1 to A-N3; the integrated review's residuals; the live check's ("Finished" in
  Perplexity answer previews; the unexplained burst; the text fallback and legacy proof still on the old compares;
  renderings the text key does not model).
- **ROADMAP 14's part C list:** C-O1 (a mid-stream bookmark keeps the superseded uuid), C-O2 (unbound Claude question
  records read "Q#1"), the renderer-change false edit, `ciDeriveRowOffset` dead code, the first refetch without a
  cooldown, and the gate gaps.
- **Earlier lists** (ROADMAP 14's v12.14 list, DEC-050's and DEC-051's residuals, ROADMAP 0d) are unchanged.

---

## J. Risk caveats / known limitations

- **v12.15 is merged without owner acceptance.** Everything rests on mocks and the agent's Chrome + Tampermonkey
  checks; Safari + Userscripts and Firefox + Tampermonkey have not been run on it at all.
- **Unmeasured live facts** (DEC-053, DEC-054): a just-sent ChatGPT message's key and streaming answer ids; whether
  `backend_uuid` changes on Rewrite; whether a Claude regenerate changes the row's key, and when (L3); whether an edit
  keeps it (L4: `_ciKeyTextEdited` takes its baseline from the first observation, so an edit before the row's first
  scan becomes the baseline).
- **Perplexity's text key** models the renderings measured on one 12-question thread. Others (KaTeX math, a table
  without leading pipes, intraword italics) read as stale, as before v12.15: one refetch and keyless flags for that
  question.
- **Claude's latest-question jump from the top** usually ends at the bottom, past the question (pre-existing).
- **J15** can fail once in CI with `resolved=10 toast=no inView=true err=0px`; re-run.
- **Test engines:** local mac WebKit fails the 4 known jump entries; `check-usage-state` U10 times out on Firefox on
  this Mac, intermittently.

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md
(2026-10-31, v12.15 merged as 6baac2e before acceptance; next: the owner's call).

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats).

FIRST, CHECK STATE — do not assume:
  git fetch origin
  git log --oneline --first-parent -4 origin/main
  gh pr list --state open
main should be v12.15 and include the merge of PR #88 (6baac2e). If PR #89
(branch docs/v12.15-merge-followup) is still open, HANDOFF.md, ROADMAP.md and
DECISIONS.md on main are the OLD ones: read them from that branch
(git show origin/docs/v12.15-merge-followup:HANDOFF.md, and the same for the others)
and ask me whether to merge it before you branch.

THIS SESSION: no spec yet. Ask me which of these comes first:
  - my acceptance results for v12.15 (I report; you record them in DEC-031 exactly
    as I report them), or
  - an item from ROADMAP "Current Status" → "Later" (HANDOFF §G.2), or
  - something new I describe.
For any code change: a read-only Phase 1 first, measure before reasoning, and wait
for my decision before code. Before any live measurement, confirm which userscript
version is installed in that browser (DEC-027).

STANDING RULE: Safari, Chrome and Firefox are equal priority; none is primary
(DEC-047). I work mostly on the Mac: Safari first, Chrome if Safari fails.

PROCESS (HANDOFF §H, §D): build, install in my Chrome through Tampermonkey and test
live until it passes, then open the PR, run the babysit cycle when I name it, and
install and retest the final build at the end.

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
