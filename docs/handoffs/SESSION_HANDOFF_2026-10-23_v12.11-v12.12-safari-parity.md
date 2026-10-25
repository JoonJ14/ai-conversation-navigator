# Session Handoff — 2026-10-23 (v12.11 and v12.12: the turn-counter dots show the real count; Safari parity for plan usage and GM storage)

> **Archived 2026-10-24.** Superseded by `HANDOFF.md` (v12.13 and v12.14: cross-tab saves; Claude answer
> bookmarks). Kept as the historical record of the v12.11/v12.12 session; its §G (the bookmark issue) was carried out
> as PRs #85 and #86, and v12.12's itemized acceptance is now in DEC-031. Its §E was corrected on 2026-10-24 (main's
> hash, the PR #84/#85 rows, the remote branch cleanup) before it was archived.

**Scope:** one spec from the owner, two small PRs in order. **PR A (v12.11):** Claude's turn-counter dots froze at
a stale count. They were drawn before the counter was updated, and the list's early returns skipped the redraw.
**PR B (v12.12):** on Safari + Userscripts, the Plan usage panel never worked, and nothing kept in GM storage
persisted. B0, an owner-run measurement on real Safari, came first. Then the usage requests moved onto the
transport ladder, and a GM storage wrapper went in for managers that only offer the async API.

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-10-23_v12.10-index-adapters.md` (v12.10, the index
adapters; its §G was this session's spec).

**Status at close:**
- **PR #81 (v12.11): MERGED** as `9a0fc7d`, after the owner's acceptance on Safari, Chrome and Firefox (DEC-031).
- **PR #82 (v12.12): MERGED** as `2b7e8d1`, **before** the owner's acceptance, on the owner's call (a waiver,
  DEC-031). Afterwards the owner live-tested it: "all the things that we have built actually were solved", on
  "all of them". That's a summary; **the itemized results come in the next session's prompt** (DEC-031). Safari's
  v12.10 ChatGPT and Perplexity check: **Passed**.
- **PR #83 (docs close-out): MERGED** as `39ad1bb`: DEC-048, DEC-049, the Safari TROUBLESHOOTING entry, and two
  lessons.
- **The session-close PR** (`docs/session-close-v12.12`, docs only): this handoff, the owner's summary in DEC-031,
  and status lines. **The owner merges it**, or the next session does on the owner's OK.
- **Next session:** a **separate bookmark issue** the owner noticed while live-testing v12.12. The owner gives it
  as the next session's prompt; it is not in the repo (§G). Per the owner, "the bookmarks do survive" a reload,
  so it is not the bug v12.12 fixed.

---

## A. State in one paragraph

main is v12.12. On Claude, the turn-counter dots are updated before anything draws. They redraw only when the
counter differs from the one they were drawn for (`_ctxDrawnTurns`), never on every scan, because the panel sits
inside the `document.body` the message observer watches (DEC-048). The Plan usage panel's two requests go through
`ciLadderGet`, so on Safari a refused GM request falls through to `fetch`, and they run only on
`https://claude.ai` exactly (DEC-044, v12.12 addendum). Every GM key goes through `acnGetValue` / `acnSetValue`:
- **Tampermonkey:** the synchronous functions, exactly as before.
- **Userscripts:** the named IIFE `acnMain` loads the six keys with `GM.getValue`, then runs again with them in
  memory (DEC-049).

What stays open is logged in ROADMAP 0d: the SSE half of the exact-origin gap, an ungated cross-org drop, the
fetch caps now shared with the index, and two tabs being last-write-wins.

---

## B. What was accomplished

### 1. PR A: the turn-counter fix, all browsers (v12.11, PR #81)

**What.** In `orbOnScanComplete()`, `updateTurnCounter()` now runs first. `orbPopulateNavigate()`'s empty-list
return redraws the dots and bar. Its unchanged-list return redraws them only when `_turnCounterSig()` differs
from `_ctxDrawnTurns`, which `orbUpdateContextBar()` records. Commits: `d247b2c` (code), `0241545` (docs),
`826b17d`, `6f90d5a`, `bb9d0d9` (review fixes), `39e35c5` (review record), `763f0d7` (acceptance).

**Why [code].** The dots were drawn before the counter was updated, so they always showed the previous scan's
count. After the scan in which the index landed, the list's early returns skipped every later redraw.

**Alternatives** (DEC-048 has the full reasoning):
- **Redraw on every scan,** which the spec asked for. Measured in a scratch build, it loops with the body
  observer: 744 records in 6 s on an idle page, against 0 [Playwright page realm].
- **A timer or throttle:** the owner said no.
- **Close the panel on a switch,** the spec's change 3: skipped by the owner. Its premise was wrong: Claude and
  ChatGPT are `spa: false`, so no hook closes the panel in any browser.
- **Widen the guard to other inputs:** the owner chose to log those cases instead.

**Verification.** `probes/check-turn-counter.js`, 8 checks:
- v12.10 fails A1, A1f, A2, A2f, A2b and A5 at 3 stale dots on all three engines; v12.11 passes all 8.
- A4 (no mutations while idle) gates the guard: the unguarded mutant fails it with 984 records.
- One path isn't gated: SSE reaches the guarded redraw, and the probe has no SSE.
- GitHub Codex was clean on its first review. The owner's acceptance on all three browsers is in DEC-031.

### 2. B0: the owner-run Safari measurement (PR B's step 0)

`probes/safari-gm-storage-check.user.js`, run by the owner on real Safari with Userscripts 4.8.6:
- `typeof GM_getValue` and `GM_setValue`: `undefined`, despite their grants.
- `GM.getValue` / `GM.setValue`: they work, and a value persisted across reloads.
- A content-world `fetch` of `/api/organizations/<org>/usage` with `credentials: 'include'`: 200,
  `application/json`.

Recorded in `agent_docs/architecture.md`, "Runtime matrix", the one place it lives.

### 3. PR B, B1: usage on the transport ladder (v12.12, PR #82)

**What.** `fetchClaudeUsage`'s org list and usage request go through `ciLadderGet`, and the ladder itself is
unchanged. Its mutant builder builds 42 of 42 on both builds; M08, M09, M21 and M34 have been broken since v12.10.
`maybeRefreshUsage` returns unless the origin is `https://claude.ai`.

**DEC-044's rules, kept:**
- one caller;
- the flag cleared before the call, since the callback can still be synchronous;
- asymmetric supersession;
- the stale-org drop, now the first line of the ladder's single callback;
- the 45 s timeout, past U4's window.

**Added in review:**
- `_usageOrgListSeq`, which closes a pre-existing no-cookie org-list race.
- **On every browser,** a hung usage request now ends as "Usage data unavailable" after 45 s, instead of loading
  forever.

**Gate.** `check-usage-state`, now 13 checks:
- **U11:** gmxhr 403, fetch 200: bars.
- **U11b:** no cookie, every GM request refused: the org list and usage come through fetch.
- **U12:** a look-alike host: no request on either transport.
- They fail on v12.11 and pass on v12.12. The GM stub now reports every HTTP status through `onload`, as real
  managers do.

### 4. PR B, B2: the GM storage wrapper (v12.12, PR #82)

**What.** `acnGetValue` / `acnSetValue` for the six keys:
- `acn-settings`, `acn-bookmarks-v1`, `acn-commands`;
- `acn-zone-positions`, `acn-claude-org-v1`;
- `acn_ctx_cache`.

Where only the async API exists, `acnMain` returns after starting `acnStoreLoad`, and the load reruns it with
`_acnStore`. Details:
- Values are JSON text, in memory and in GM storage.
- A load that fails or takes over 2 s runs on defaults, logs once, and **saves nothing for that page**. That's the
  owner's call: a save would replace a whole stored collection.
- A write that finishes after a newer write of the same key rewrites the newest.
- `@grant GM.getValue` and `GM.setValue` were added.
- CLAUDE.md's storage line is the owner's wording, in its own commit, `379de06`.

**Alternatives** (DEC-049): `localStorage`, async reads everywhere, wrapping the whole body, persisting after a
failed load, a write queue, and raw values.

**Gate.** `probes/check-gm-storage.js`, 6 checks, in `test:probes` and CI:
- G1 and G2: a bookmark and a language change survive a reload. G1 also checks that all six keys are loaded.
- G3: the sync path, with `GM.*` never called.
- G4: the 2 s bound, timed in the page.
- G5: a rejecting `GM.setValue`.
- G6: writes landing out of order.

v12.11 fails G1, G2, G4 and G5; G6 was not run on it. Single mutants: no rewrite fails G6 only, and a 1.5 s bound
fails G4 only.

### 5. Review and verification

- **PR A:** three tiers locally, plus an adversarial workflow (25 raw findings, 12 distinct confirmed). Tier 3
  (Codex CLI) had 4 WARNs, all fixed. **GitHub Codex: 0 rounds.**
- **PR B:** three tiers. Codex CLI rounds 1 and 2 plus a post-fix pass raised 10 findings: 8 fixed, 1 logged, 1
  recorded as ungated. **GitHub Codex: 0 rounds.** It was clean twice: when the PR opened, and on a manual
  `@codex review` the owner asked for.
- **Final runs** (local, macOS arm64, one each):
  - **PR A** (`6f90d5a`): suite 560 / 560 / 557. Probes all pass.
  - **PR B** (`e87aa27`): suite 560 / 560 / 556. Probes all pass except `check-usage-state` U10 on Firefox, the
    known timeout.
  - **WebKit's failures** are the known local jump entries, 3 of 4 on PR A and all 4 on PR B, with slower frames
    in PR B's run (TROUBLESHOOTING, "OPEN — Local mac WebKit").
- **CI:** green on every head that merged.
- **Records:** `reviews/review-2026-10-23-turn-counter.md`, `reviews/review-2026-10-23-safari-parity.md`.

### 6. The docs close-out (PR #83), and its own check

Before PR #83 was opened, a verification workflow checked every claim in the draft against the code, git and the
run logs. It ran three lenses, with a skeptic for each finding, and confirmed 7 errors. All were corrected,
including a mutant miscount of my own: 41 should have been 42. PR #82's description was corrected too.

### 7. Mistakes, kept because they generalize

- **I called a branch "unreachable [code]" without listing every writer.** SSE draws reach the guarded redraw.
  The adversarial review found it and measured it. Now a lesson in `agent_docs/conventions.md`.
- **A `var` read before it was assigned.** The first draft of `acnStoreLoad` read its bound from a `var` below
  the top of `acnMain`, where hoisting leaves it `undefined`, so the bound would have been 0 ms. Caught by reading
  (a lesson).
- **An escape eaten by a template literal.** A Python heredoc halved a backslash in a regex inside a probe's page
  template, and the regex became a `//` comment (a lesson).
- **A miscount from a hand-typed list.** The 41-of-41 mutant count came from an ID list that left out M33.
  Corrected in the review record, the docs and PR #82's description.
- **A mislabel.** I first called the Codex CLI's Tier 3 "GitHub Codex round 1". The record now names the tier.

---

## C. Architecture snapshot

Changed:
- **The IIFE is named `acnMain(_acnStore)`.** It can return early to load storage and then rerun itself. Code at
  its top runs before any `var` below is assigned.
- **Storage goes through one wrapper.** A new GM key must be added to `acnStoreLoad`'s list (CLAUDE.md).
- **Usage requests share the transport ladder** with the indexes.

`agent_docs/architecture.md`'s "Runtime matrix" has the usage, GM storage, content-world and exact-origin rows,
with B0's measurement.

---

## D. Key principles established

- **A DOM write that a scan triggers inside `document.body` must be guarded** by what it last drew (DEC-048;
  conventions).
- **GM storage only through `acnGetValue` / `acnSetValue`;** new keys go in `acnStoreLoad`'s list (CLAUDE.md).
- **CLAUDE.md lines state rules,** with no version tags or mechanism details (owner; `agent_docs/conventions.md`,
  "Documentation Rules").
- **Before calling a branch unreachable, list every writer** of the state it compares (conventions).
- **Each mechanism gets a check that fails without it.** One targeted mutant proves a new check can fail. No
  mutation battery unless the owner asks.
- **Run all three review tiers before pushing a code PR.** The owner confirmed it saved GitHub rounds: 0 on PRs
  #81 and #82, against 4 on PR #78.

---

## E. Git state

`main` is at `b96ec7b` (the PR #85 merge) and holds v12.13. *Corrected 2026-10-24: this line said `39ad1bb`, which
was already one merge behind when this handoff was written (PR #84, `d533f5c`).*

| Commit | What |
|---|---|
| `d247b2c` | **v12.11** code |
| `0241545`–`763f0d7` | PR A docs, review fixes, review record, acceptance |
| `9a0fc7d` | **merge of PR #81** |
| `a99ee29` | B0 probe |
| `f0ea979` | **v12.12** code, probes, CI |
| `7bffa65`–`5af4d79` | PR B docs, review fixes, CLAUDE.md (`379de06`), review record |
| `2b7e8d1` | **merge of PR #82** |
| `472afab`, `8d78d46` | close-out docs, two lessons |
| `39ad1bb` | **merge of PR #83** |
| `d533f5c` | **merge of PR #84** (`docs/session-close-v12.12`: this handoff, DEC-031's summary, status lines) |
| `f3f529e`–`ba293c2` | **v12.13**, the cross-tab PR: code, gates, review fixes, CLAUDE.md (`ce7af86`), acceptance |
| `b96ec7b` | **merge of PR #85** (2026-10-24) |

- **Merged branches deleted from the remote, 2026-10-24, at the owner's request:** the eleven branches of PRs
  #75–#85, each an ancestor of `main` before deletion; their commits live on through the merges. Before that,
  merged branches were left on the remote.
- **Merges use merge commits** (`gh pr merge --merge`). The ruleset requires all nine CI checks and allows no
  bypass, so re-run a stalled job and never override it. This session needed no reruns.
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `DECISIONS.md` **DEC-031** | **live confirmation status, the one place it is kept**; v12.12's summary and what's to come |
| `DECISIONS.md` **DEC-049** | the GM storage design, which the bookmark issue may touch |
| `DECISIONS.md` **DEC-048**, **DEC-044** (v12.12 addendum), **DEC-047** | the redraw guard; usage on the ladder; equal priority |
| `ROADMAP.md` → "Current Status", items **0d**, **13** | the order; Safari's open items; ChatGPT and Perplexity bookmarks still positional |
| `TROUBLESHOOTING.md` → "RESOLVED IN v12.12 — Safari + Userscripts" | the debugging story for B1 and B2 |
| `agent_docs/architecture.md` → "Runtime matrix" | per-manager differences, with B0 |
| `agent_docs/conventions.md` → "Storage Keys", "Documentation Rules", "Lessons Learned" | the storage rule and this session's lessons |
| `docs/BOOKMARKS.md` | the bookmarks feature spec |
| The userscript: `BOOKMARK_KEY`, `getBookmarks`, `toggleBookmark`, `createBookmarkIcon`, `_bmEntityId` | the bookmark code paths |
| `probes/check-gm-storage.js`, `check-usage-state.js`, `check-turn-counter.js` | this session's gates |

---

## G. What comes next

1. **The bookmark issue, from the owner's prompt.** It's not in the repo; the owner describes it. What's known:
   - **Per the owner:** "the bookmarks do survive" a reload, "but we're having separate issues".
   - **Already logged, and maybe relevant, not a diagnosis:** on ChatGPT and Perplexity, bookmarks are still
     positional over a windowed list, so they can point at the wrong message or none (ROADMAP 13). Claude's are
     keyed to the message uuid (schema 2).
   - **v12.12 changed only where bookmarks are stored** (`acnGetValue` / `acnSetValue`; on Safari through
     `GM.*`), not what they record.
   - **Before reasoning about it,** ask which browser, site and steps; the owner's prompt may already say. Read
     the bookmark path and its guards first (conventions, Lessons Learned).
2. **Record v12.12's itemized acceptance in DEC-031** when the owner gives it, exactly as reported.
3. **Then the backlog, in the owner's order:** Grok and Gemini, Perplexity attachment images, the CI rebuild
   (ROADMAP 0e), the context-window meter (12), and the v12.10 follow-ups (13).

---

## H. Operational context + owner rules

Carried over, still in force:
- **Safari, Chrome and Firefox are equal priority** (DEC-047). Acceptance on all three comes before a merge, unless
  the owner waives it for that PR, as for PR #82. Record waivers in DEC-031.
- **Merge authority is per PR and explicit.** Nothing in this document authorizes a merge. "Merge once CI is green"
  covers only the PR it was said about.
- **Live-confirmation results go in DEC-031 only,** exactly as reported. Ask about blanks once. If the owner defers
  the details ("all of that details gonna go into the next prompt"), record their words and mark the itemized
  results as to come. Don't press.
- **Live work in the owner's accounts is strictly read-only.**
- **CLAUDE.md changes:** show the diff and commit only on approval. **Lines state rules**, with no version tags or
  mechanism details (owner, 2026-10-23).
- **Scope:** build the minimal version of the spec. Flag anything extra in one paragraph instead of building it.
  Log out-of-scope findings to ROADMAP or TROUBLESHOOTING.
- **Proof in proportion:**
  - the gate probe;
  - then `npm test` and `npm run test:probes` once on the final build, on all three engines;
  - known failures reported as known;
  - no mutation battery;
  - ask before any other long run, with a time estimate.
- **Every claim carries its measurement context.** Safari + Userscripts can only be verified by the owner.
- **CI is not real-browser evidence.** Restart stalled or failed jobs; never override.
- **Review:** the pipeline's Tier 3 (Codex CLI) runs without asking and loops until clean.
- **On a babysit request after a clean automatic Codex review,** post `@codex review` once for a fresh review
  rather than reporting the old one (owner, 2026-10-23).
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** run them when the owner names them.
- **Git:** explicit `git add` paths; never push to `main`.

---

## I. Deferred / future work

Not queued; §G comes first. Each is logged where named.
- **The local WebKit question.** Re-run one failing entry on Playwright's WebKit build 2370 (about 10 minutes;
  offered, not run). TROUBLESHOOTING, "OPEN — Local mac WebKit".
- **A stale "Turn N" badge on non-Claude empty pages.** The owner chose to leave it logged (TROUBLESHOOTING,
  turn-counter entry).
- **Housekeeping** (ROADMAP 10): the compaction state has no writer, and `package.json`'s version reads 11.0.
- **Gates:** a two-org fixture for the cross-org stale-response drop, and a way to show that U11b's org list
  asked gmxhr first (ROADMAP 0d; the review record).
- **The SSE half of the exact-origin gap, and SSE on Safari** (ROADMAP 0d).

---

## J. Risk caveats / known limitations

- **v12.12's acceptance is a summary,** with itemized results to come (DEC-031). Until then, no single checklist
  item is recorded as passed on its own.
- **The bookmark issue is undescribed** in the repo. Don't assume what it is (§G).
- **Async storage on Safari:**
  - a load over 2 s runs on defaults and saves nothing for that page;
  - two tabs are last-write-wins per key;
  - the rewrite on out-of-order writes is measured only against a stub; whether Userscripts reorders writes is
    unmeasured.
- **The usage requests share the fetch transport's page-wide caps** with the index [code, not measured].
- **Not gated:**
  - the cross-org stale-response drop;
  - U11b's transport order;
  - SSE-reached redraws;
  - the bar's not-ready inputs (TROUBLESHOOTING).
- **Test engines:**
  - local mac WebKit fails the 4 jump entries, but real Safari and CI's WebKit pass them;
  - `check-usage-state` U10 times out on Firefox on this Mac (v12.12: 5 of 5).
- **The SSE tap and SPA history hooks on Safari** are inferred not to reach the page (runtime matrix).
- **The ladder's mutant builder** stops on four anchors moved in v12.10 (ROADMAP 0d).

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md
(2026-10-23 — "v12.11 and v12.12: the turn-counter dots; Safari parity").

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats).

FIRST, CHECK STATE — do not assume:
  git log --oneline -3 main
  gh pr list --state open
main should be v12.12 and include the merges of PR #81 (9a0fc7d), PR #82 (2b7e8d1)
and PR #83 (39ad1bb). If the session-close PR (branch docs/session-close-v12.12) is
still open, HANDOFF.md on main is the OLD one: read it from that branch
(git show origin/docs/session-close-v12.12:HANDOFF.md) and ask me whether to merge it.

THIS SESSION: a bookmark issue I noticed while live-testing v12.12. I'll describe it
in my prompt; it is not in the repo. Bookmarks do survive a reload, so it is not what
v12.12 fixed. Confirm your understanding of the handoff and my description, ask me
what you need (browser, site, steps), then wait for my go. Read the bookmark code
path and its guards before reasoning about a cause (HANDOFF §F lists them).

I will also give you v12.12's itemized live results; record them in DEC-031 exactly
as I report them.

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
- Read or write GM storage except through acnGetValue / acnSetValue.

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my
untracked files (HANDOFF §E). Run `npm test` and `npm run test:probes` after any code
change. Every claim carries its measurement context.
```
