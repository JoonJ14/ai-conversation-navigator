# Session Handoff — 2026-11-01 (v12.16: Claude's latest-question jump lands, Claude's context meter by model, Gemini's history note)

**Scope:** the owner's v12.16 spec (2026-10-31), one combined PR in three parts. **A:** on Claude, a jump to the
latest question from the top ended at the bottom, past it; a far mounted target now lands. **B:** Claude's context
meter assumed 200K for every chat; it now uses the window of the conversation's model, and (the owner's request,
mid-session) the turn dots on Claude take their colour from the meter. **C:** Gemini keeps every turn it loads;
Navigate now says when a chat's older history is not loaded yet, and (found in the final live A/B) a far loaded
question lands instead of gliding. Grok was out of scope. Reviewed (Tier 3 at the owner's cap of 5), babysat
through GitHub Codex while the owner was away, A/B-tested live against v12.15, merged before acceptance.

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-10-31_v12.15-jumps-bookmarks-turnkeys.md` (v12.15; its §G
was this session's first message, and the owner's v12.16 spec was its second).

**Status at close:**
- **PR #90 (v12.16): MERGED** 2026-11-01 as `a9ecb14`, on the owner's explicit OK, **before any acceptance step was
  reported** (a waiver, DEC-031). The owner will run the acceptance on the merged build. The userscript on main is
  byte-identical to `5bcd18d`, the build of the final live test.
- **PR #91** (`docs/v12.16-merge-waiver`, docs only): `3b183c7`, the merge record and waiver, then the docs
  follow-up from a transcript audit, and this handoff (written in that follow-up at the owner's request to log
  everything, not by `/baton-handoff`). **The owner merges it**, or the next session on the owner's OK.
- **Owner acceptance owed** on Safari + Userscripts, Chrome + Tampermonkey and Firefox + Tampermonkey: the steps on
  https://github.com/JoonJ14/ai-conversation-navigator/pull/90#issuecomment-6550538381. v12.15's is owed too.
- **Left for the owner:** Chrome has `5bcd18d` (12.16) installed through Tampermonkey; two test tabs are open, Claude
  `3d7b6dc1` and Gemini `96b519c112c5d099`. No test bookmark remains (the panel read "No bookmarks yet" after each run).
- **Next session:** no spec yet. The owner's acceptance of v12.15 and v12.16, the open owner decisions (§G.2), then
  whichever item the owner picks.

---

## A. State in one paragraph

main is v12.16. On Claude, a jump whose target is mounted but outside the view extended by one viewport each way
lands through `ixLandOn` (`ciLandFar`, DEC-055): instant writes, re-located by the route's own resolver, within 8 px
or 4 writes; near targets glide as before; every jump on Claude, and every direct glide, supersedes a landing in
flight. The meter reads the chat's model from the conversation JSON the index already downloads (`_ciModel`) and
looks it up in `CLAUDE_CTX_BY_MODEL` (1M / 500K, from Anthropic's help center, article 8606394, updated 2026-10-30);
an unknown model reads 200K and says "limit assumed" (DEC-056). Claude's turn dots take their colour from the meter's
share; other platforms keep positional colours. On Gemini, a tracker infers when a chat's start is loaded (a page
under 10, or 8 s at the top), and until then Navigate shows "↑ Older messages are not loaded yet"; a far loaded
question lands through the same core as Claude's (`gmLandFar` → `orbLandFarIn`), because off-screen turns are
`content-visibility: auto` and grow under a glide (DEC-057). Open: the owner's acceptance; the 1M-for-every-chat
decision; the logged residuals (ROADMAP 12, 13 and 14).

---

## B. What was accomplished

### 1. A read-only pass, then Phase 1 for all three parts

- **The pass** (before the spec; code and docs at `82d3a3c`, no tests or browser): a 26-agent workflow mapped the
  script; its unlogged findings went to ROADMAP 13 and 14, and the owner's PR #89 CI flake to TROUBLESHOOTING.
- **Phase 1** [code; web research; live, Chrome + Tampermonkey page realm, the owner's profile, visible tab, GET reads
  only, 2026-10-31; the extension was down about 30+ minutes until the owner signed in again]. Both of the spec's stop
  conditions cleared, so each part took its default:
  - **A:** the latest question took the mounted fast path, one unchecked smooth `scrollIntoView` across ~200,000 px;
    v12.15 missed Q140 of chat `3d7b6dc1` from the top 3 of 3 (285,576 px, 98,987 px, 875 px from the view).
  - **B:** the conversation JSON carries the chat's `model` at its top level (60 of 60 conversations); the help
    center's paid-plan table gives 1M or 500K per model, 200K outside it (every quote re-fetched independently).
  - **C:** Gemini **keeps** every turn and pages history in 10 at a time (32-question chat: 10 → 20 → 30 → 32, all
    mounted); 9 of 9 jumps landed on v12.15's code, three with history still loading.

### 2. The build, the review, the gates

- **Parts:** A `365d825`, version `6d632eb`, B `8129b9e`, C `48d9665`. Tier 2: 2 WARN fixed (`b681077`). Tier 3
  (`cli:codex`, `gpt-5.6-terra`, xhigh) ran 5 rounds, the owner's cap: 12 raw, 10 fixed (`267e7df`, `4cad2b1`,
  `dcabba2`, `ba1b8e4`, `f25e3e4`), 1 false positive, 1 accepted limitation (the 8 s rule against a load slower than
  8 s). **The round-5 fixes had no Tier 3 round after them**; they went to GitHub Codex. One Stop-hook trigger
  mid-build (an untracked gate probe still being written) was skipped with `review-skip`.
- **Gates** (`147e063`, `f97fc46`; all three in `test:probes` and CI): `check-claude-far-jump` (the Claude mock's new
  `tailAtEnd` knob), `check-ctx-limit`, `check-gemini-history` (new mock `gemini-history.html`); each [new] check
  fails on v12.15, with mutants. Numbers: CHANGELOG 12.16 and DEC-055 to DEC-057.

### 3. The owner's away-mode order (2026-10-31)

The owner left with this order: finish the Tier 3 round, open the PR, run the babysit cycle to clean plus one extra
`@codex review`, then one last live test in Chrome showing v12.15 still has the Claude and Gemini problems and the
final build fixes them; and **"the context window should be 1 million tokens, not a 500k"**, for the meter and the
turn dots alike (a meter about halfway with red dots "would be weird"). The order did not include a merge, and
none was done then; the merge came later, on the owner's explicit OK (§B.6).
- **Dots:** brought into the PR (`0139896`): on Claude, dot i stands for the meter's share × (i+1)/40, with the bar's
  70% and 85% thresholds; `check-turn-counter` A3 and A6 gate it.
- **1M:** kept per model, as the spec asked for an authoritative per-model limit. The owner's current chats
  (`claude-opus-5-5`, `claude-opus-5`) read 1M; the help center's 500K models (Fable 5, Opus 4.6–4.8, Sonnet 4.6)
  read 500K. Reading every chat as 1M is a small `CLAUDE_CTX_BY_MODEL` table change (the five 500K entries; offered as "one line"), offered twice, **unanswered** (§G).

### 4. The pre-approved final run

On `0b2454c` [Playwright, headless, page realm, this Mac]: `npm test` chromium and firefox 560/560, webkit 556/560
(the four known local mac WebKit entries); every probe passed on all three engines except J15 on firefox and webkit,
its known race, which v12.15 fails here too. The first attempt was void: each probe was wrapped in `timeout 900`,
which macOS lacks, so all 42 runs exited 127 in 0 s under a job that reported exit 0 (§B.7).

### 5. Live in the owner's Chrome, the PR, GitHub Codex, the final A/B

- **Before the PR** (`365d825` / `48d9665`, rechecked on `2527956`; Tampermonkey's Update, then Reinstall, `shasum`
  matching): Q140 from the top and its test bookmark 3 of 3 each; the meter 35%, "~353.6K / 1M"; a `claude-opus-4-7`
  chat 500K; the Gemini note at 10, 20, 30 loaded, gone at 32. Mid jumps landed, not all fully (CHANGELOG 12.16).
- **PR #90** opened at `efbe143`; GitHub Codex clean on it and on `e252bd4` (a poll first credited `efbe143`'s 👍 to `e252bd4`, §B.7).
- **The final A/B** (v12.15 by Downgrade, then `e252bd4` by Update): v12.15 landed Q140 0 of 3 and the bookmark 0 of
  3, read 100% "/ 200K" with 28 green, 6 yellow, 6 red dots, and listed 10 of 32 Gemini questions with no note;
  `e252bd4` landed 3 of 3 each, 35% "/ 1M", 40 green dots, and a `claude-opus-5-5` chat 61% "~607.6K / 1M". **It
  found a bug every gate then passed:** Gemini's Q32 from the top missed 2 of 4 right after paging in (6,139 px below
  the view, then 4,240 px below on one of three consecutive runs). Fixed in `095a66c` (`gmLandFar`), gated by H10
  after two mock iterations (§B.7); TROUBLESHOOTING, the Gemini far-jump entry.
- **GitHub Codex** then raised two P2s in that new code, both fixed: `61365d8` (a direct glide on Gemini supersedes
  a far landing), `5bcd18d` (a chat switch ends one). No probe check targets either. Clean twice on `5bcd18d`.
- **The final live test on `5bcd18d`** (Reinstall, `shasum` matching): Claude Q140 and its bookmark 3 of 3 each, fully
  in view, Q70 and Q5 in view, 35% "/ 1M", 40 green dots; Gemini, the note right, Q32 twice, Q1 and Q16 landed
  (DEC-031). **None of this is owner acceptance.**
- **CI:** 9/9 on `2ace4b9` (run 41257520872); the ubuntu jobs took 23m28s–24m6s against the 30-minute cap.

### 6. The merge and the docs follow-up (PR #91)

Merged 2026-11-01 as `a9ecb14` on the owner's OK, before acceptance; `3b183c7` records the waiver. The follow-up
audited the transcript against the repo (CHANGELOG 12.16, "Docs follow-up"): among others, the Q32 miss corrected
(6,139 px first, not 4,240) and DEC-056's "four" 500K models corrected to three (`claude-opus-4-8`,
`claude-opus-4-7`, `claude-fable-5`).

### 7. Mistakes, kept because they generalize

- **A mock that differs from the site makes a fix look broken or a broken build look fixed.** Without `tailAtEnd`
  the far-jump mock moved the pinned tail with every write, and the correct fix chased it to the cap; H10's first
  `content-visibility` model (a guessed 120 px, no anchoring) failed the fixed build, and with the live 500 px it
  passed v12.15 too. Take a mock's parameters from live computed values.
- **A wrapper's exit is not the work's** (`timeout`, rc=127); **a 👍 belongs to a commit** (confirm the Codex
  summary's commit is the head); **quote external sources from the raw page** (a WebFetch summary misstated the help
  center's table); **a closed Navigate keeps the previous chat's `data-acn-count`**; `json.dumps` escapes non-ASCII
  unless `ensure_ascii=False`.

All are in `agent_docs/conventions.md` → "Lessons Learned" and `agent_docs/git-workflow.md`. CLAUDE.md candidates
await the owner's approval (§G.2).

---

## C. Architecture snapshot

Changed (agent_docs/architecture.md has the details):
- **Far landing:** `ciLandFar(el, getEl, landed)` in `orbScrollToQuestion`'s fast path and `orbScrollToMessage(el,
  getEl)`; the shared core `orbLandFarIn`; Gemini's `gmLandFar` (its `stillValid` compares `location.pathname`);
  `ciSupersedeLanding` for direct glides. A landing that does not land clears `data-acn-jump-resolved`; only a
  superseded one leaves it. Only the settle loop sets `data-acn-jumping`.
- **Meter:** `_ciModel` (set at `ciBuildIndex`'s commit, cleared by `ciInvalidate`), `CLAUDE_CTX_BY_MODEL`,
  `CLAUDE_CTX_FALLBACK`, `orbClaudeCtxLimit`, `orbStampCtxLimit`, `orbFmtCtxLimit`; `#acn-ctx-pct` carries
  `data-acn-ctx-limit`, `-limit-source`, `-model`; `_renderTurnDots` colours Claude's dots from the meter.
- **Gemini:** `gmHistObserve` (keyed by the path), `gmHistPartial`, `GM_HISTORY_PAGE` (10), `GM_HISTORY_TOP_MS` (8 s);
  the note `olderHistoryNotLoaded` (en, ko) with `data-acn-history="partial"`.
- **Mocks:** the Claude mock's `tailAtEnd`; `gemini-history.html`'s `cv` model (H10 at `cvEstimate: 120`).

---

## D. Key principles established

- **A final live A/B against the previous version, after the babysit** (the owner's away-mode order): it found the
  one bug the mocks and the pre-PR check passed (Phase 1's 9 of 9 Gemini jumps ran, by inference, after the turns had rendered).
- **A mock models live computed values, not guesses**; check its geometry against the live measurement before
  trusting either colour of a gate.
- **The dots and the meter tell one story** (the owner, 2026-10-31). **A sourced per-model figure over one
  constant**, an unknown model labelled, not hidden; the owner's 1M request is open (§G).

---

## E. Git state

`main` is at `a9ecb14` (the PR #90 merge) and holds v12.16.

| Commit | What |
|---|---|
| `365d825` | **part A**: a far mounted Claude target lands |
| `6d632eb` | version 12.16 |
| `8129b9e` | **part B**: the meter by the conversation's model |
| `48d9665` | **part C**: Gemini's history note |
| `b681077` | Tier 2 fixes |
| `267e7df`, `4cad2b1`, `dcabba2`, `ba1b8e4`, `f25e3e4` | Tier 3 rounds 1–5 |
| `147e063`, `f97fc46` | the gates; `tailAtEnd`; the probes in `test:probes` and CI |
| `0139896` | the turn dots follow the meter (the owner's request) |
| `0b2454c`–`e252bd4` | the docs, the final run, the pre-PR recheck, the PR's steps; PR #90 opened at `efbe143` |
| `095a66c`, `09d4250` | the Gemini landing (found in the final A/B) and its docs |
| `61365d8`, `5bcd18d` | GitHub Codex's two P2s |
| `2ace4b9` | the final live test's record |
| `a9ecb14` | **merge of PR #90** |
| `3b183c7`, this follow-up | PR #91, `docs/v12.16-merge-waiver` |

- **Remote branches:** `main`, `fix/v12.16-claude-jump-meter-gemini` (merged; left in place), `docs/v12.16-merge-waiver`
  (PR #91), and v12.15's `fix/v12.15-bookmarks-jumps-claude` and `docs/v12.15-merge-followup` (merged; left in place).
- **Local branches:** `main`, `fix/v12.16-claude-jump-meter-gemini`, `docs/v12.16-merge-waiver`; no worktrees.
- **Merges use merge commits** (`gh pr merge --merge`); the ruleset requires all nine CI checks and allows no bypass.
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `ROADMAP.md` "Current Status"; items 12, 13, 14 | v12.16, the "Later" list, the owed list; the logged residuals and the open owner decisions (item 14) |
| `DECISIONS.md` **DEC-055**, **DEC-056**, **DEC-057**, **DEC-031** | the three parts' designs and limits; live status and the waiver |
| `CHANGELOG.md` 12.16 | every result with its context, the final run, the Codex rounds, PR #91 |
| `TROUBLESHOOTING.md` → the two "FIXED IN v12.16" entries (Claude, Gemini); "OPEN — CI: … J15", "OPEN — CI: the Claude 294-row sweep…" | what was fixed and why; the two CI flakes |
| `TESTING.md` → "The live check in the owner's Chrome" | install, the extension's sign-in failure, the tool's quirks |
| `agent_docs/conventions.md`, `agent_docs/git-workflow.md` | this session's lessons; the 👍 trap |
| `DOM-REFERENCE.md` → Claude (`model`), Gemini | the markup and paging v12.16 reads |
| `probes/check-claude-far-jump.js`, `check-ctx-limit.js`, `check-gemini-history.js`, `check-turn-counter.js`, `probes/README.md` | the gates |
| `reviews/review-2026-10-31-v12.16.md` | Tier 3 and the GitHub Codex rounds |

---

## G. What comes next

1. **The owner's acceptance of v12.16** on Safari + Userscripts, Chrome + Tampermonkey and Firefox + Tampermonkey: the
   steps on PR #90 (https://github.com/JoonJ14/ai-conversation-navigator/pull/90#issuecomment-6550538381): the Claude
   jump and bookmark from the top, mid jumps, the meter, its `data-acn-ctx-*` values and console line, the dots; the
   Gemini note, its jumps, a short chat. **And v12.15's** (PR #88's first comment). Record results in DEC-031 exactly
   as reported (the `<!-- V12.16 ACCEPTANCE -->` placeholder).
2. **Owner decisions open** (ROADMAP 14; none answered as of 2026-11-01):
   - **1M for every Claude chat** instead of the help center's 500K for Opus 4.6–4.8, Sonnet 4.6 and Fable 5 (the
     owner asked for 1M on 2026-10-31; a small `CLAUDE_CTX_BY_MODEL` table change, the five 500K entries).
   - **Gemini's automatic "load the full history" action** (it scrolls the page for the user; proposed, not built).
   - **The i18n `|| 'English'` convention**: keep or drop, now that the fallback is shown unreachable.
   - **CI's 30-minute cap**: about 6 minutes of headroom; flagged, not raised.
   - **CLAUDE.md candidates** (show the diff; commit only on approval): the mock-fidelity rule in "Measurement
     Context" (`tailAtEnd`, H10); the `timeout` rc=127 case under "a success signal from a wrapper"; "~12,700 lines"
     is stale (the file has 15,815).
3. **Then the owner picks the next item.** No spec exists; do not pre-write one. The "Later" list (ROADMAP, Current
   Status): Grok on all three browsers; J15's CI race; Perplexity attachment images; the CI rebuild (0e); the meter's
   step 2, the estimate itself (12); the stale "Turn N" badge; the "reset, keeping a backup copy" action and the
   AbortController follow-up (0d); Chrome's v12.9-era 403 (logged, not active); someday, a Windows spot-check.
4. **Owed acceptance from earlier releases** (DEC-031): PR #85's steps 2–7; PR #86's steps 4–5 on Chrome and
   Firefox; the v12.12 items never reported; v12.11's ChatGPT dots; v12.10's Safari Perplexity jump (now v12.15's).

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
- **Proof:** a gate that fails on the previous version for each mechanism, a few targeted mutants; `npm test` and the
  probes after any code change; `npm run test:probes` stops at the Firefox U10 timeout on this Mac, so run the rest
  directly (no `timeout` wrapper); ask before any long run, with an estimate.
- **Every claim carries its measurement context.** Safari + Userscripts can only be verified by the owner.
- **CI is not real-browser evidence.** Re-run a stalled or flaky job; never override. Read a failing check first.
- **Review:** Tier 3 (Codex CLI) runs without asking; capped at 5 rounds when the owner says so (v12.15 and v12.16
  did). After a clean GitHub Codex review, post `@codex review` once more.
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** only when the owner names them.
- **Live-test before the PR, and again after the babysit**; install in the owner's Chrome through Tampermonkey's
  Update / Reinstall / Overwrite; confirm the installed version first (DEC-027).
- **Re-read the whole transcript before closing a long session.** **Git:** explicit `git add` paths; never push to
  `main`.

New this session:
- **The owner may leave mid-session with an order** (2026-10-31): carry it through to the point it names; merge
  authority stays per PR (above).
- **The final live test is an A/B**: the previous version installed by Downgrade, then the final build, on the same
  chats, so "still broken before, fixed after" is shown, not assumed (the owner's order).
- **The claude-in-chrome extension** failed again (2026-10-31, 30+ min) until the owner signed in; ask early.

---

## I. Deferred / future work

Not queued; §G comes first. Each is logged where named.
- **ROADMAP 12, 13 and 14, each "Logged from v12.16":** the estimate past the window on summarized chats; the
  compaction fields never written; Gemini bookmarks by the turn's id (a migration); Navigate ~5 s behind a Gemini
  load; Export and Summary dropping unmounted ChatGPT and Perplexity questions; Claude's other unchecked glides;
  Search to the last answer from the top; M14/M16 anchors; no jump-busy flag outside the settle loop; a shrinking
  list wiping the meter's token state.
- **Earlier lists** (ROADMAP 13's and 14's v12.15 lists, DEC-050's and DEC-051's residuals, ROADMAP 0d) are unchanged.

---

## J. Risk caveats / known limitations

- **v12.16 is merged without owner acceptance**, like v12.15. Everything rests on mocks and the agent's Chrome +
  Tampermonkey checks; Safari + Userscripts and Firefox + Tampermonkey have not been run on it at all.
- **Code no Tier 3 round saw:** the round-5 fixes, the turn dots, the Gemini landing and the two Codex fixes were
  reviewed by GitHub Codex only; no probe check targets `61365d8` or `5bcd18d`.
- **Gemini's constants** (page size 10, the 8 s wait) were measured on three chats in one browser. A smaller first
  page would make a long chat read as complete (the note silently missing). A chat ending on a full page shows the
  note until 8 s at the top; a load slower than 8 s can clear it early, and it returns when the load lands. The note
  needs the turns to be the scroller's direct children (Layer 1). H10's half-view reveal margin is assumed.
- **The meter's table is the paid-plan one**; a model the table does not list (a newer one included) reads 200K,
  labelled "limit assumed". During a conversation switch the meter briefly reads the fallback until the index lands
  [Playwright page realm, `check-ctx-limit` L6].
- **Unmeasured live:** a refetch committing mid-landing (silently superseded); landing writes under a page's CSS
  `scroll-behavior`; the shrinking-list reset of the meter's token state.
- **CI headroom:** the ubuntu jobs take about 24 of 30 minutes. **J15** can fail once in CI, and locally on Firefox
  and WebKit; re-run. Local mac WebKit fails the 4 known jump entries; U10 times out on Firefox here, intermittently.

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md
(2026-11-01, v12.16 merged as a9ecb14 before acceptance; next: the owner's call).

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats).

FIRST, CHECK STATE — do not assume:
  git fetch origin
  git log --oneline --first-parent -4 origin/main
  gh pr list --state open
main should be v12.16 and include the merge of PR #90 (a9ecb14). If PR #91
(branch docs/v12.16-merge-waiver) is still open, HANDOFF.md, ROADMAP.md and
DECISIONS.md on main are the OLD ones: read them from that branch
(git show origin/docs/v12.16-merge-waiver:HANDOFF.md, and the same for the others)
and ask me whether to merge it before you branch.

THIS SESSION: no spec yet. Ask me which of these comes first:
  - my acceptance results for v12.16 and v12.15 (I report; you record them in
    DEC-031 exactly as I report them), or
  - one of the open decisions in HANDOFF §G.2 (1M for every Claude chat first), or
  - an item from ROADMAP "Current Status" → "Later" (HANDOFF §G.3), or
  - something new I describe.
For any code change: a read-only Phase 1 first, measure before reasoning, and wait
for my decision before code. Before any live measurement, confirm which userscript
version is installed in that browser (DEC-027).

STANDING RULE: Safari, Chrome and Firefox are equal priority; none is primary
(DEC-047). I work mostly on the Mac: Safari first, Chrome if Safari fails.

PROCESS (HANDOFF §H, §D): build, install in my Chrome through Tampermonkey and test
live until it passes, then open the PR, run the babysit cycle when I name it, and
install and retest the final build at the end, as an A/B against the previous
version.

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
