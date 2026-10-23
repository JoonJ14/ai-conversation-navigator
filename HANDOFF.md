# Session Handoff — 2026-10-23 (v12.10: ChatGPT and Perplexity list every question again — index adapters)

**Scope:** one arc, spec-driven. On ChatGPT and Perplexity, Navigate listed **zero** questions in all three
browsers. Two independent breaks per site: new markup (Layer 1) and windowed message lists (Layer 4). v12.10
fixes both: new selectors for the DOM fallback, and a conversation-index **adapter per platform** reading each
site's own JSON through the v12.9 transport ladder (DEC-046). The close-out found a separate, older defect on
Safari: Claude's turn-counter dots freeze at a stale count (TROUBLESHOOTING). Acceptance on all three browsers
before every merge is now the standing rule (DEC-047).

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-10-22_v12.9-safari-transport.md` (v12.9, the transport
ladder, the runtime matrix).

**Status at close:**
- **PR #78 — MERGED** 2026-10-23 as `166a281`, on the owner's explicit OK. Accepted before the merge on Chrome
  and Firefox, and on Safari for Claude. **Safari's ChatGPT and Perplexity acceptance is owed after the merge**
  (a waiver). **Results: DEC-031 only.**
- **The docs-only close-out PR** (`docs/v12.10-close-out`): the corrected DEC-031 record, the turn-counter entry
  in TROUBLESHOOTING, the owner's next order, and this handoff's update. The owner merges it.
- **vibecoding-loadout PR #1** (the three side-effect skills become invocable when the owner names them) is
  **open**, the owner's to merge. It is a different repo.
- **Next session:** PR A (the turn-counter fix), then PR B (Safari parity), from a spec the owner provides (§G).

---

## A. State in one paragraph

The conversation index is now a seam, `IX_ADAPTERS`, with one adapter per platform: Claude (the v12.0 index,
wrapped unchanged), ChatGPT and Perplexity. ChatGPT's adapter reads `/backend-api/conversation/<id>` with a
bearer token from `/api/auth/session` (kept in memory only) and walks the active branch from `current_node`.
Perplexity's reads `/rest/thread/<id>`, paged from the first entry by cursor, capped at 40 pages. Both go through
`ciLadderGet` (the ladder's one-request form) and run only on the exact origin. On those two sites,
`q.element` is null outside the mounted window, just as on Claude; `q.ixPosition` / `q.ixId` are the identity.
The jump pages each site's window toward the target and identifies it by id (ChatGPT `data-turn-key`) or
ordinal plus text (Perplexity `data-workflow-entry`). What v12.10 deliberately left alone is logged in ROADMAP
item 13: bookmarks are still positional on both sites, Export's body and the Summary map see only mounted
messages, Search doesn't interleave by position, and ChatGPT's answer selectors were not re-measured.

---

## B. What was accomplished

### 1. Phase 1: the live map (Chrome, page realm, read-only in the owner's account)

**What.** Claude Code drove the owner's **real** Chrome profile (claude-in-chrome). It ran read-only: no sends,
edits, regenerations, deletions or shares. It started with ChatGPT conversation `6994e2d6-…` (10 questions)
and Perplexity thread `de5dd7ce-…` (12), then the longest conversations.

**Findings, all Chrome page realm:**
- **ChatGPT.** One request returns the whole mapping (60 conversations checked, the longest 130 questions);
  `sectioned_conversation` and `context_truncation_continuation` were null; there is no native jump feature.
  The list mounts a sliding 4–7 turns inside `[data-app-action-timeline-scroll][role="region"]`. A duplicate,
  hidden timeline (`role="presentation"`) stays connected after a switch, so queries are scoped to the region.
  **`data-content-search-turn-key` was window-relative while the page loaded**, so positions come from
  `data-turn-key` (the message id).
- **Perplexity.** `from_first=true` + `cursor` page correctly; `offset` is ignored. `query_str` is the text to
  show; `background_entries` was empty. It mounts the entries in view plus the latest. **The scroller is pinned
  to the bottom:** a programmatic `scrollTop` reverted within 300 ms every time until a wheel event arrived.
  Hence `releaseScroll`, a synthetic wheel, before every jump move.
- The owner's Perplexity library holds 3 threads, the longest 12 entries. Paging past one page is proven only
  by the probe, not live.

**Setup lesson.** The claude-in-chrome tools were absent until the owner set `/chrome` → "Enabled by default"
to yes and restarted Claude Code.

### 2. Phase 2: the adapter seam (DEC-046), commit `1316e65` and the review fixes

**How**, in `ai-conversation-navigator.user.js`:
- Each `IX_ADAPTERS` entry has `getConversationId`, `fetchIndex`, `locate`, `mounted`, and optionally
  `releaseScroll`. The pipeline is `ixScan` (from `scanConversation`), `ixLoad`, `ixJump`, `ixDegrade`,
  `ixRenderBanner` and `ixFingerprint`.
- **`ixAdapter()` is the exact-origin guard**, per adapter, gated like `ciIsClaudeChat`. Header:
  `@connect chatgpt.com`, `@connect perplexity.ai` (Tampermonkey asks to accept them on update).
- **Failure handling reuses Claude's rules** (`ixFailure`): permanent backoff 60 s ×4, capped at 30 min. A
  failed refresh keeps the ready snapshot, labelled in the banner.
- **Staleness.** An unknown mounted key, or the "tail" signal (`ixAtBottom`), refetches once per signature behind
  `CI_REFETCH_COOLDOWN_MS`. The tail signal catches a switch to a *shorter* ChatGPT branch.
- **The jump** aims at `position/(total-1)`, then moves by the nearest mounted entry's distance, at most 12
  moves, 350 ms apart. It ends on a trusted user scroll and on a conversation switch. Every click supersedes it.
  Its last resort is a text match, which counts only if unique across the **whole index** and not on a node
  already identified as another entry.

**Alternatives rejected** (DEC-046 has the full reasoning): selectors alone (a correct partial list *is* the
Layer 4 failure), and restructuring the ladder (its mutation tooling anchors on its exact code).

### 3. Phase 3: the gate, `probes/check-index-adapters.js`, now 27 checks

- Two new mocks genuinely unmount: `tests/mock-pages/chatgpt-windowed.html` (sliding window; `setTurns` for a
  branch switch; `frozen` for a jump that cannot page) and `perplexity-windowed.html` (in view + latest, with the
  stick-to-bottom pin). `chatgpt.html` and `perplexity.html` now carry the October markup. 17 mock files in all.
- The GM shim has real manager semantics. The probe runs in CI on ubuntu for all three engines.
- **v12.9 fails every new check**, and each review fix added a check that fails before it (C3b, C3c, G2, P13, C8).

### 4. Review

Record: `reviews/review-2026-10-23-index-adapters.md`.
- Three tiers locally; Tier 3 (Codex CLI) **looped seven rounds until clean**, as the owner asked: 31 findings,
  all real, 23 fixed, 8 logged or accepted.
- **GitHub Codex afterwards: 4 more rounds with findings** (2 in `363a538`, 1 in `c9621cb`, 1 in `fd89e19`,
  1 in `0866597`), then clean on `0866597`. The last two:
  - `fd89e19`: an already-mounted Perplexity question took the fast path, which never released the pin, so the
    page snapped back to the bottom (probe P13).
  - `0866597`: the text fallback could land on a repeated question's mounted twin (probe C8).

### 5. Verification, and its contexts

- **Full three-engine run, on `c9621cb`** (macOS arm64, local): suite 1676/1680. The 4 failures are the known
  local WebKit entries (TROUBLESHOOTING, "OPEN — Local mac WebKit"); v12.9 fails them identically. Probes 14/15;
  the one failure is the known `check-usage-state` U10 Firefox timeout.
- **After `fd89e19` and `0866597`:** the adapter probe passes on all three engines; `npm test` 560/560 and
  `npm run test:probes` all pass, **Chromium only**.
- **Live: the owner's acceptance**, before the merge on Chrome and Firefox and for Claude on Safari; Safari's
  ChatGPT and Perplexity check is owed. Results in DEC-031, which also closes Chrome's v12.9 check. An earlier
  DEC-031 line overclaimed Safari and was corrected the same day.

### 6. Outside the repo

- **vibecoding-loadout PR #1:** `disable-model-invocation` removed from `babysit-pr-cycle`, `baton-handoff` and
  `update-project-docs`, so the agent can run them when the owner names them. Never unasked. Open.
- **Agent memory:** "side-effect skills on request" replaced "babysit is user-only". The equal-priority browser
  rule was added.

### 7. The Safari turn-counter investigation (read-only, after the merge)

**What.** On real Safari the owner saw Claude's turn-counter dots wrong intermittently: 1–4 dots or none,
almost always when arriving via the sidebar, sometimes after a reload. The full analysis, with every claim
labelled [code] or [inferred], is in TROUBLESHOOTING, "OPEN — Claude's turn-counter dots".

**Root cause [code].** `orbOnScanComplete()` draws the panel, dots included, **before** `updateTurnCounter()`,
so the dots show the previous scan's count. `orbPopulateNavigate()` then returns early on an unchanged
fingerprint (and on an empty list) without redrawing them, so they freeze at 0 or at the mounted 1–4.

**Why Safari [inferred].** On Chrome and Firefox the history hooks close the panel on navigation, so it cannot
stay open across a sidebar switch; on Safari the hooks don't reach the page, so it does. The reload race exists
in the code on every browser.

**Not a v12.10 regression [code]:** every function on the counter path is byte-identical between v12.9 and
PR #78's head; the three that changed are not on Claude's path. **Fix:** PR A (§G). Per the owner, no scratch
probe and no Chrome measurement now; PR A's gate measures it.

### 8. Mistakes, kept because they generalize

- **An acceptance was recorded more strongly than reported.** A short spoken report ("it passed all the tests")
  was written into DEC-031 as Safari passing ChatGPT and Perplexity; the owner's detailed report said those were
  still owed. Record exactly what was reported, per browser and per site, and ask about any blank.

- **`\uXXXX` escapes decoded again** by the Write tool inside a Python script. Fixed with `chr(92)`, and checked
  for 0 non-ASCII characters in added lines. The rule is already in `agent_docs/conventions.md`; it still bites.
- **A helper's guard broke a fix.** The first shorter-branch fix used `ciFindScrollContainer`, whose size guard
  returns null for short lists, so probe C3c failed. `ixAtBottom` replaced it.
- **The ladder's mutant builder stops at the first missing anchor.** Four anchors moved with v12.10 (M08, M09,
  M21, M34; ROADMAP 0d).

---

## C. Architecture snapshot

Changed: the index is now a seam (above). `agent_docs/architecture.md` has the seam paragraph and the
runtime-matrix rows for the exact-origin guard and `@connect`. Read its "Runtime matrix" before touching
anything that talks to a site's API, persists data or replaces a page global.

**Adding a platform** is ROADMAP item 13's recipe: answer "Porting the Layer 4 response" Step 0 first (recycling
or lazy loading?), then one `IX_ADAPTERS` entry, an exact origin, a `@connect` if GM needs it, and a mock that
genuinely unmounts.

---

## D. Key principles established

- **Equal priority for Safari, Chrome and Firefox; live acceptance on all three before every merge** (DEC-047).
- **Fix both layers or neither.** Selectors alone return a correct partial list, which is the Layer 4 failure.
- **Position from a stable id, not a window-relative attribute.** Measure the attribute while the page loads,
  not only at rest.
- **A site can fight programmatic scrolling.** Measure whether a `scrollTop` write sticks before building a jump.
- **Text is a match, not an identity.** Use it only when it is unique across the whole conversation.
- **Each review fix comes with a check that fails before it.**

---

## E. Git state

`main` includes the merge of **PR #78**. Branch `feat/chatgpt-perplexity-index-adapters` is merged and left in
place.

| Commit | What |
|---|---|
| `1316e65` | **v12.10**: adapters, selectors, mocks, probe, CI step |
| `5ba0feb`, `7d1ba48` | docs: DEC-046, ROADMAP 13, DOM reference, README privacy and permissions, CHANGELOG |
| `363a538` | GitHub Codex round 1 |
| `0fb2b7e` | CLAUDE.md, owner-approved (Layers 1 and 4 on two more sites; mock count 17) |
| `58988d4`–`878520e` | Tier 3 rounds 1–3 and post-fix validations |
| `d11da60`, `d08c893`, `8b6317b` | review record, final-run results |
| `c9621cb`, `fd89e19`, `0866597` | GitHub Codex rounds |
| `e390efe` | DEC-031 results, DEC-047, this handoff, close-out docs |
| `166a281` | **merge of PR #78** |
| docs PR | `docs/v12.10-close-out`: DEC-031 corrected, the turn-counter entry, the next order |

- **Merges use merge commits** (`gh pr merge --merge`). `main`'s ruleset requires all nine CI checks and has no
  bypass actors: re-run a stalled job, never override.
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`. `docs/d2-synced-snapshot.html`
  is excluded in `.git/info/exclude`.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `DECISIONS.md` **DEC-046** | the adapter seam: rules, alternatives, measured facts |
| `DECISIONS.md` **DEC-047** | the equal-priority, acceptance-before-merge rule |
| `DECISIONS.md` **DEC-031** | **live confirmation status, the one place it is kept** |
| `ROADMAP.md` → "Current Status" | the owner's order (§G) |
| `ROADMAP.md` item **13** | the adapters, how to add one, and the logged v12.10 follow-ups (cleanup candidates) |
| `ROADMAP.md` items **0d**, **0e**, **12** | Safari parity and the exact-origin gap; CI rebuild; context meter |
| `TROUBLESHOOTING.md` → "OPEN — Claude's turn-counter dots" | **PR A's diagnosis**, labelled [code] / [inferred] |
| `agent_docs/architecture.md` → "Runtime matrix" | what differs on Safari: GM storage, SSE, history hooks (PR B) |
| `DOM-REFERENCE.md` | ChatGPT and Perplexity October structure; the virtualization table |
| `probes/check-index-adapters.js` | the gate, 27 checks |
| `reviews/review-2026-10-23-index-adapters.md` | the review record |
| `docs/handoffs/SESSION_HANDOFF_2026-10-22_v12.9-safari-transport.md` | the predecessor |

---

## G. What comes next

The owner's order (2026-10-23). **The next session gets its spec from the owner**; it is not in the repo. Two
small PRs, in this order:

1. **PR A: the turn-counter fix, all browsers.** Diagnosis: TROUBLESHOOTING, "OPEN — Claude's turn-counter dots".
   - Update the counter before drawing (`orbOnScanComplete`).
   - Redraw the dots on every scan, including `orbPopulateNavigate`'s unchanged-fingerprint and empty-list
     returns.
   - Close the panel on a conversation change detected by the scan path too, so Safari behaves like Chrome and
     Firefox.
   - **Gate:** a probe with the index delayed and the panel open before it lands, plus a conversation switch with
     the panel open. It must fail on the current build.
2. **PR B: Safari parity** (ROADMAP 0d).
   - **Usage:** `fetchClaudeUsage` onto the ladder, keeping DEC-044's rules (one caller, the flag cleared before
     the call, asymmetric supersession, the silent stale-org drop on every leg, no timeout shorter than the U4
     window). Give the usage probe's GM stub real onload-for-4xx semantics first. Add the exact-origin guard for
     usage (the 0d gap's usage half; the SSE half stays open).
   - **GM storage:** a wrapper using async `GM.getValue` / `GM.setValue` with an in-memory copy loaded at
     startup, **used only when the synchronous functions are missing**. The Tampermonkey path stays unchanged.
     Keys: settings, bookmarks, commands, zone positions, the org cache, `acn_ctx_cache`.
   - **Out of scope:** SSE on Safari; the context bar stays "(est.)".

**Owed meanwhile:** Safari's ChatGPT and Perplexity acceptance of v12.10 (DEC-031).

**After PRs A and B:** Grok and Gemini (the owner decides the order), Perplexity attachment images, the CI rebuild
(0e), the context-window meter (12), and the v12.10 follow-ups (ROADMAP 13).

---

## H. Operational context + owner rules

- **Safari, Chrome and Firefox are equal priority; none is primary** (DEC-047). The owner is traveling and works
  mostly on the Mac: Safari first, Chrome if Safari fails. **Real-browser acceptance on all three comes before
  every merge.**
- **Merge authority is per PR and explicit.** Nothing in this document authorizes a merge.
- **Live confirmation results go in DEC-031 only** (owner, 2026-10-23). Other docs point there.
  Record them exactly as reported, per browser and per site; ask about any blank rather than filling it.
- **Live work in the owner's accounts is strictly read-only:** never send, edit, regenerate, delete or share.
  Tests that change a conversation (the branch test) are the owner's acceptance steps. Live Chrome checks drive
  the owner's **real** profile; label findings "Chrome, page realm".
- **CLAUDE.md changes are shown as a diff and committed only on approval.**
- **Fix only findings within the asked scope; log the rest** to ROADMAP or TROUBLESHOOTING. Codex review
  findings on the PR's own code are in scope.
- **Changing how a failure is classified is the owner's call** (#5 was reverted).
- **CI is not real-browser evidence.** Don't cite it as such; don't make the owner wait on it.
- **Codex:** read its summary comment; a clean summary on the head commit is a pass. The pipeline's Tier 3 runs
  without asking and **loops until clean**, not one round.
- **Ship small things small.** Ask before adding long verification runs, and give time estimates.
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** run them when the owner names them, never
  unasked.
- **Git hygiene:** execute and narrate; explicit `git add` paths; never push to `main`.

---

## I. Deferred / future work

Not queued; the owner's order (§G) comes first.
- **The context-window meter** (ROADMAP 12): recalibrate `CTX_LIMITS.claude` (`200000`) to the current window
  after verifying it per model and plan, then revisit the estimate.
- **The CI rebuild** (ROADMAP 0e): engine drift, install stalls, probe time, the Windows `page.goto` flake.
- **The AbortController rework** (0d): measure in each manager first.
- **The local mac WebKit question** and **U10 on Firefox**: test-engine issues, not product ones.

---

## J. Risk caveats / known limitations

- **The exact-origin guard still covers only the indexes.** OPEN, security-relevant, pre-existing, inferred from
  code: the Plan usage panel and the SSE interceptor are gated by `host.includes('claude.ai')` (ROADMAP 0d).
- **Bookmarks on ChatGPT and Perplexity are positional** over a windowed list, so they can point at the wrong
  message or none. The ids to migrate to now exist.
- **Claude's turn-counter dots freeze at a stale count** (Safari mostly; the reload race exists everywhere in the
  code). PR A fixes it.
- **Safari's ChatGPT and Perplexity acceptance of v12.10 is owed** (DEC-031).
- **The branch test ran on Chrome, ChatGPT only.** Not on Safari or Firefox, and not on Perplexity (DEC-031).
- **Chrome's v12.9 check did not record which transport won,** so its old intermittent 403 still has no log
  lines (TROUBLESHOOTING).
- **The last two fixes** (`fd89e19`, `0866597`) were verified by the probe on three engines and by the suite on
  Chromium only; the full three-engine run is from `c9621cb`. The owner's acceptance covered the PR's build.
- **Perplexity paging past one page** is proven only by the probe; the owner's longest live thread has 12
  entries.
- **Perplexity's edit detection is a text match** (`_normalizeCompareFull`), so an edit that changes only
  markdown punctuation goes unseen. Accepted (ROADMAP 13).
- **The mutant builder fails on four moved anchors** until they are updated (0d).
- **Safari parity gaps** from v12.9 are unchanged: the usage panel is GM-only, and GM storage is absent.

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md
(2026-10-23 — "v12.10: ChatGPT and Perplexity list every question again").

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats). Then read TROUBLESHOOTING.md →
"OPEN — Claude's turn-counter dots" (PR A's diagnosis) and agent_docs/architecture.md →
"Runtime matrix" (PR B's ground).

I will give you this session's spec at the start. It is not in the repo. Work from it
as given; don't expand or reinterpret it. Confirm your understanding of the handoff
and the spec, then wait for my go before starting work.

FIRST, CHECK STATE — do not assume:
  git log --oneline -3 main
  gh pr list --state open
main should include the merge of PR #78 (166a281) and, if I've merged it, the
docs-only close-out PR.

THIS SESSION: two small PRs, in order, each its own branch and PR:
  A. The turn-counter fix, all browsers (HANDOFF §G.1). Its gate must fail on the
     current build.
  B. Safari parity: usage onto the ladder with DEC-044's rules plus its exact-origin
     guard; the async GM storage wrapper, used only when the synchronous functions are
     missing (HANDOFF §G.2). SSE on Safari stays out of scope.
Acceptance on Safari, Chrome and Firefox is mine, per PR, before its merge.

STANDING RULE: Safari, Chrome and Firefox are equal priority; none is primary
(DEC-047). I work mostly on the Mac: Safari first, Chrome if Safari fails.

DO NOT:
- Merge anything without my explicit OK for that PR, or push to main. The ruleset
  allows no bypass: re-run a stalled CI job, never override it.
- Commit a CLAUDE.md change before I approve the diff.
- Report anything you cannot drive yourself (Safari + Userscripts) as verified.
  List it as owner acceptance in the PR.
- Cite green CI as real-browser evidence.
- Change how the index classifies a failure without asking me.
- Fix findings outside the task's scope. Log them to ROADMAP or TROUBLESHOOTING.
- Add long verification runs to a small task without asking first.
- Re-trigger Codex without reading its summary comment. A clean summary is a pass.
- Copy a live-confirmation result into other docs. DEC-031 keeps it; point there.
- Record an acceptance more strongly than I reported it. Ask about any blank.
- Send, edit, regenerate, delete or share anything in my live accounts.

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my
untracked files (HANDOFF §E). Run `npm test` and `npm run test:probes` after any code
change. Every claim carries its measurement context.
```
