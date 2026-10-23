# Session Handoff — 2026-10-22/23 (v12.9: the Claude index works on Safari — a second transport, ordered by the userscript manager)

**Scope:** one arc and its close-out. (1) On Safari with the Userscripts app, the Claude conversation index
**always** failed: 403 from every org candidate, classified PERMANENT, so Navigate showed the 1–5 turns Claude
keeps mounted. The cause was not the site but the **userscript manager**: `GM_xmlhttpRequest` is each manager's
own implementation, and Userscripts' does not carry the claude.ai session. v12.9 gives the index a second
transport (DEC-045). (2) The close-out: the runtime matrix, the session record, CLAUDE.md fixes, and the
mutation tooling committed.

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-08-05_v12.8-usage-panel.md` (v12.8, the usage panel's
three states, and the PR #72 session-record gap).

**Status at close:**
- **PR #75 — MERGED** 2026-10-23 as `4c72ca9`. **v12.9 is on `main` and live.** It was merged on the owner's
  call **before** the live acceptance (a DEC-031 waiver, recorded there).
- **Live acceptance after the merge (owner, 2026-10-23):** Safari + Userscripts and Firefox + Tampermonkey passed;
  Chrome + Tampermonkey is open. **The results and the current status are kept in DEC-031 only** (the log lines
  are also in the CHANGELOG's 12.9 entry and the review record).
- **PR #76 — MERGED** 2026-10-23 as `5201937`: the close-out docs, the owner-approved CLAUDE.md fixes, and the
  mutation tooling under `probes/`. No behaviour change.
- **This handoff** goes in on its own docs-only PR.
- **Next session:** the owner gives it its spec as the first message. The spec is not in the repo; see §G.

---

## A. State in one paragraph

The Claude index on Safari works, and the owner confirmed it live after the merge (DEC-031). The
fix is a **transport ladder**: `gmxhr` (v12.8's request, byte-for-byte) and a plain `fetch` from the page
origin. `GM_info.scriptHandler` only decides the order (Userscripts → fetch first). The second transport is
tried only when the first was **refused** (401/403/404 from every candidate) or **could not run**. The winner is
cached for the page session once its index has validated. Every request logs one line naming its transport,
so the next unexplained 403 (Chrome's is still one) explains itself. What v12.9 deliberately did not fix is
Safari **parity**: the Plan usage panel still uses `GM_xmlhttpRequest` only, and nothing in GM storage
persists there (bookmarks, saved commands, language and platform toggles). Both are queued in the owner's
order (§G). One thing found after the merge is security-relevant and pre-existing: the exact-origin guard
covers only the index (§J).

---

## B. What was accomplished

### 1. The diagnosis: Layer 3's quiet face

**What.** Navigate on Safari showed 1–5 turns of long conversations. v12.8's console said why:
`index failure looks PERMANENT (no org candidate accepted the conversation: HTTP 403 (HTTP 403))`, with backoff
60s → 240s → 960s.

**Why it happened.** The owner's manual probe on Safari (v12.8, same tab and conversation) separated the
transport from the site. The script's `GM_xmlhttpRequest` got 403 from every org, while
`fetch(…, {credentials: 'include'})` from the same content-script world got **200** for the right org.
Userscripts sends GM requests from its extension background page, where WebKit withholds the SameSite session
cookies (read from its source and WebKit bug 260676, not measured). Firefox + Tampermonkey had worked all
along. Same call, same site, different credentials, chosen by **whichever manager ran the script**.

**Why it matters beyond Safari.** This is a new face of Layer 3 (CLAUDE.md, "Layer 3 has a second face"). The
host page is fine; the execution context withholds something our code relies on. **A finding about a `GM_*` API
is scoped to the manager *and* the browser it was measured in.**

### 2. The fix: a transport ladder (DEC-045), commit `74c8811`

**How.** In `ai-conversation-navigator.user.js`:
- `ciApiGet` dispatches to `ciGmxhrGet` or `ciFetchGet`.
- `ciTransportOrder` (fed by `ciScriptHandler`) puts fetch first only for Userscripts.
- `ciWalkOrgs` walks the org candidates on one transport. `ciTraceWantsFallback` decides whether the walk's
  trace earns the other transport.
- A **refusal is never PERMANENT until both transports have been tried**, with one owner-chosen exception (§B.4).
  A second transport that met only refusals or silence upholds the first's refusal, so a logged-out tab still
  backs off as in v12.8.
- Rate limits, 5xx, network errors, timeouts and malformed bodies do **not** trigger the fallback; they keep
  v12.8's classification.
- **Bounds, because v12.9's fetch passes no `AbortSignal`:**
  - `CI_FETCH_TIMEOUT_MS` = 45000. The gmxhr watchdog fires at +5s (50s), after the manager's own timeout.
  - At most `CI_FETCH_STALL_MAX` = 2 timed-out and `CI_FETCH_OPEN_MAX` = 6 open fetches, **page-wide**.
  - A late answer frees its slot and has its body cancelled.
- **The exact-origin guard.** `ciIsClaudeChat` requires `https://claude.ai`, so the index never runs elsewhere.

**Alternatives rejected** (DEC-045 has the full reasoning):
- *Switching wholesale to `fetch`* would trade Firefox's proven path for one never measured in the
  Tampermonkey sandbox.
- *Dropping the `GM_xmlhttpRequest` grant* fails because the grant is what decides the realm: Userscripts
  forces `@inject-into content` because of it.
- *A per-request fallback* would double the requests for orgs that legitimately answer 403. Mutant M11 models
  it, and fails 22 checks.

**The cap history**, because it is easy to re-litigate (DEC-045):
- A page-wide cap of **one** came first. Codex round 3 showed a single hang in chat A then blocked chat B.
- Its replacement, a per-conversation count, needed re-keying in round 4 (a switch during the first load) and
  round 5 (A → non-chat → A, and A → B → A).
- Round 5 replaced it with a page-wide cap of **two**, which a lone hang cannot trip.
- Round 6 added the open bound.

### 3. Review and verification

**Review pipeline, all three tiers.** Record: `reviews/review-2026-10-22-safari-transport.md`.
- 58 findings, 49 verified, 44 fixed, 9 false positives.
- Tier 3 (Codex) reached APPROVED on its tenth and last permitted round.
- GitHub Codex reviewed every pushed head of PR #75 and PR #76 and found nothing.

**The gate is `probes/check-transport-ladder.js`, 63 checks.** It runs in CI on ubuntu for all three engines.
- Its GM shim has real manager semantics (`onload` for a 403, with claude.ai's JSON error body). The suite's
  shared shim routes every non-200 through `onerror`, so it can never produce the refusal that triggers the
  fallback.
- v12.9 passes all 63 on chromium, firefox and webkit. **v12.8 fails 52 of 63**, L1 (the Safari shape) among them.

**Mutation-tested: 46 mutants, one per mechanism, 43 gated.**
- **M18** (the `finish` latch), **M19** (the callback rethrow) and **M21** (fetch's own origin guard, unreachable
  while `ciIsClaudeChat` holds) are **not gated**. The matrix says so rather than implying coverage.
- The tooling is now in the repo: `probes/run-ladder-mutants.sh`, `probes/build-ladder-mutants.js` and
  `probes/ladder-mutation-matrix.js`.
- Its first full run on the final code (2026-10-23, 33 minutes at `-j 4`) matched the recorded matrix exactly,
  all 46.

**Context of all of the above:** Playwright page realm. It proves the ladder's *decisions*, not which real
manager's transport carries credentials. That is what the owner's live acceptance settled (DEC-031).

### 4. The owner's PR #75 decisions, and the one change reverted

A scope audit (four readers, each blind to the author's classification) listed everything beyond the spec. The
owner kept all of it except one item: **#5, Codex round 8's unusable-org-list reason**.
- **What #5 did.** It turned v12.8's PERMANENT backoff into a ~16s retry, on every browser, for an org list that
  answers 200 with no usable org after cheap-candidate 403s.
- **The revert (`9ee5222`).** That case keeps v12.8's `"(HTTP 403)"` reason and its PERMANENT class again, and
  probe LM8c holds it.
- **The consequence**, recorded as DEC-045's **one exception**: on the first transport this case ends PERMANENT
  without the other transport being asked.

The other decisions:
- The validation matrix lives in **one** place (the review record); every other doc links to it.
- CLAUDE.md changes are shown to the owner and committed only on approval.
- Two lessons went into `agent_docs/conventions.md` (§D).
- `docs/d2-synced-snapshot.html` was added to `.git/info/exclude`.
- Push once; let CI and Codex run once; fix only findings within scope, and log the rest.

**The owner's AbortController question, answered and recorded (ROADMAP 0d).** Why weren't timed-out fetches
aborted instead of capped?
- The signal was left out on an **unmeasured inference**: in Firefox's Tampermonkey sandbox, `fetch` and
  `AbortController` may come from different compartments, so passing a signal could throw.
- The spec also defined the transport as exactly the measured call.
- Aborting on timeout and on supersession would make both caps and the late-body cancel unnecessary.
- **Measure first, in each manager.** Keep the caps wherever passing a signal throws.

### 5. Merge, then live acceptance

- **The merge.** The owner merged PR #75 before the acceptance: Codex had found no major code errors, and the
  last commits were docs.
- **The acceptance** ran after the merge. Its results and the current status are in DEC-031.
- **What the Safari pass settled:**
  - `GM_info.scriptHandler` really reports `Userscripts` on the owner's install.
  - The local mac WebKit jump failure (TROUBLESHOOTING, "OPEN — Local mac WebKit") does **not** reproduce on
    real Safari. That entry is now only a Playwright engine-build question (build 2248 locally vs 2370 on CI).
- **v12.8's usage panel** (PR #73's owed confirm) also passed, on Firefox. On Safari the panel is expected to
  fail, and the Safari parity follow-up covers that rather than a separate debt (DEC-031).

### 6. Close-out (PR #76)

- **Commits `5e69c60` and `abd57c8`:**
  - **`agent_docs/architecture.md` → "Runtime matrix" (new):** what differs between Firefox + Tampermonkey,
    Chrome + Tampermonkey and Safari + Userscripts. Every cell is labelled code, Userscripts source, measured
    or inferred.
  - The line map moved to v12.9.
  - Userscript edits are **comments only**: a comments-stripped diff is empty, and there is no version bump.
  - The docs record the merged state.
- **`460a9fb`, the CLAUDE.md fixes (owner-approved):**
  - Safari's missing GM storage;
  - Rule 4 naming the userscript-manager (`GM_*`) and browser APIs;
  - Rule 7 adding `npm run test:probes`;
  - the guarantee's exception;
  - the suite's size.
- **`b666ccd` and `fb5193e`:** the mutation tooling, saved from the session's scratch directory, and the docs
  pointing to it.
- **The merge** waited for two CI install stalls on `firefox on ubuntu-latest` (§J). An override turned out to
  be impossible: `main`'s ruleset has no bypass actors.

### 7. Mistakes made and corrected, kept because each one generalizes

- **Four local WebKit jump failures were first filed as TESTING.md's known runner signature**, matched by the
  symptom's *name*, not its *signature* (timing, frame rate, host). That claim reached the CHANGELOG, the review
  record and the PR description before it was corrected. The rule is now in `agent_docs/conventions.md`.
- **The Edit and Bash tools decode `\uXXXX` escapes into literal characters**, which breaks the userscript's
  ES5 non-ASCII rule. Write such code through a script file (`String.fromCharCode(92)`); the rule is in
  `agent_docs/conventions.md`.
- **A Codex review was reported as "pending" when it had already passed.** The watcher filtered on comment
  timestamps, but Codex edits its summary comment in place. Read the `codex-review-state` content
  (`commit_sha`, `status: completed`, `has_any_findings: false`). "Didn't find any major issues" is a pass
  (agent memory).
- **A blind audit of the session's own doc edits found 45 errors.** Among them: a misquote of the owner on CI,
  "nothing persists on Safari" (overbroad, since `localStorage` does), "v12.9 measured" (it was not), and wrong
  counts. All were fixed. **Audit your own documentation the way you audit code.**
- **An override was offered without checking the ruleset first**, and it was impossible. This is now in agent
  memory and `agent_docs/git-workflow.md`.
- **A small task was made big.** "Approve CLAUDE.md, add the scripts, merge" grew a 35-minute battery that held
  up the push. The owner flagged it. Ship what was asked; ask before adding long verification (agent memory).

---

## C. Architecture snapshot

Unchanged except for the index's transport layer and what the runtime matrix makes explicit. **Read
`agent_docs/architecture.md` → "Runtime matrix" before touching anything that talks to claude.ai, persists data,
or replaces a page global.** In short, per runtime:

| | Firefox + Tampermonkey | Chrome + Tampermonkey | Safari + Userscripts |
|---|---|---|---|
| Script realm | TM sandbox, `exportFunction` | page main world | extension **content-script** world |
| Index transport order | gmxhr → fetch | gmxhr → fetch | **fetch → gmxhr** (measured live) |
| SSE / context bar | interceptor skipped, `(est.)` | SSE, `(hybrid)` | no SSE reaches us, `(est.)` (inferred) |
| Plan usage panel | GM only, works | GM only, works | GM only, expected **unavailable** (inferred) |
| GM storage | works | works | **absent**: bookmarks, commands and toggles fail silently |

**Four design rules for any new feature** (the full text is in the architecture doc):
1. Credentialed claude.ai requests go through `ciApiGet`'s ladder and the exact-origin guard.
2. Anything that must persist on Safari needs `localStorage`, or async `GM.getValue` / `GM.setValue`.
3. Replacing a page global does nothing on Safari (no `unsafeWindow`).
4. No Playwright engine is any of these runtimes; a runtime claim stays owner acceptance until measured.

**Coupling to know about:** on Safari the index's bare `fetch` **is** our own SSE proxy (`acnFetchProxy`),
because the interceptor patches the content world's `window.fetch` there. A change to that proxy is a change
to Safari's index transport (DEC-021 addendum). The proxy must stay a transparent pass-through for non-SSE
requests.

---

## D. Key principles established

- **`GM_*` APIs are runtime-specific implementations.** Scope every finding to the manager and the browser
  (CLAUDE.md, measurement context; v12.9 adds "and each supported manager").
- **Where you can't drive a setup yourself (Safari + Userscripts today), list it as owner acceptance in the
  PR.** Never report it as verified (CLAUDE.md, owner's sentence).
- **Match a known failure by its signature** (timing, frame rate, frequency, host), **not its name**
  (`agent_docs/conventions.md`).
- **A refusal is never final until both transports have been tried**, with the owner's one exception (DEC-045).
  Changing how a failure is *classified* changes user-visible backoff, so it is the owner's call: #5 was
  reverted for exactly that.
- **Keep a validation matrix, and a live-confirmation status, in one place.** Copies drift; point to the review
  record and to DEC-031 instead.
- **A check that cannot fail is not a gate.** Mutation-test, and print the ungated ones as ungated.
- **Prove a "comment-only" change with a comments-stripped diff**, not by assertion.
- **Ship what was asked.** Ask before adding long verification, and give time estimates up front.

---

## E. Git state

`main` @ **`5201937`**, plus this handoff's own docs PR. No other open PRs.

| Commit | What |
|---|---|
| `74c8811` | **v12.9** — the transport ladder, the probe, CI wiring |
| `ae3ada1` | docs: DEC-045, Layer 3's quiet face, the Safari open items |
| `9ee5222` | the owner's decisions: revert #5, one matrix, two lessons |
| `9ed5182` | CLAUDE.md, owner-approved (runtime, size, per-manager measurement context) |
| `4c72ca9` | **merge of PR #75** |
| `5e69c60`, `abd57c8` | close-out: runtime matrix, merged state, session record (userscript comments only) |
| `460a9fb` | CLAUDE.md close-out fixes, owner-approved |
| `b666ccd`, `fb5193e` | the mutation tooling into `probes/`, and the pointers to it |
| `5201937` | **merge of PR #76** |

- **Merges use merge commits** (`gh pr merge --merge`); auto-merge is disabled.
- **`main`'s ruleset (`mian-protection`) requires all nine CI checks and has no bypass actors.** A stalled job
  is re-run, never overridden.
- **Local and remote branches** `fix/safari-transport-fallback` and `docs/v12.9-post-merge` are merged and left
  in place.
- **The owner's own untracked files — never `git add` them:** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`. Also
  `docs/d2-synced-snapshot.html`, which is excluded in `.git/info/exclude`.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| `agent_docs/architecture.md` → "Runtime matrix" | what differs by manager, and the four design rules |
| `DECISIONS.md` **DEC-045** | the ladder: rules, alternatives, the cap history, the one exception |
| `DECISIONS.md` **DEC-031** addendum | **live confirmation status, the one place it is kept**; the owner's waivers |
| `ROADMAP.md` → "Current Status" | the owner's next order (§G) |
| `ROADMAP.md` items **0d** and **0e** | v12.9's open items, and the CI-rebuild inputs |
| `TROUBLESHOOTING.md` → the v12.9 entry and the three above it | the debugging record: local WebKit, U10, the CI stall |
| `reviews/review-2026-10-22-safari-transport.md` | the validation record and the mutation matrix (the only copy) |
| `probes/check-transport-ladder.js` | the gate, 63 checks |
| `probes/run-ladder-mutants.sh` | re-runs the matrix after any change to the ladder or the probe |
| `agent_docs/git-workflow.md` | merge rules, the ruleset, and listing owner acceptance in the PR |
| `docs/handoffs/SESSION_HANDOFF_2026-08-05_v12.8-usage-panel.md` | the predecessor (v12.8 detail) |

---

## G. What comes next

**First: the owner's spec.** The owner gives the next session its spec as the first message. It is not in the
repo, and this handoff deliberately does not summarize or anticipate it. Work from the spec as given.

**Then, in the owner's order:**
1. **Chrome check.** v12.9 on Chrome + Tampermonkey, with **Claude Code driving the owner's real Chrome profile,
   not a fresh one**. Use the claude-in-chrome MCP (macOS: Google Chrome; the global setup notes have the launch
   steps), so Tampermonkey, the installed script and the claude.ai login are all real. Capture:
   - the `[ACN] index order:` line and every `[ACN] index:` line, which say which transport won;
   - the question count on a long conversation;
   - jumps to its last questions.

   If Chrome's old intermittent 403 recurs, those lines are the evidence. Collect them before theorising
   (ROADMAP 0d has the one unverified candidate, Tampermonkey issue #2782).
2. **Gemini: does it keep older turns once loaded, or slide them out?** Not started. This is Layer 4's first
   question, "recycling or lazy loading?". The procedure is in `DOM-REFERENCE.md` → "Virtualization status" and
   ROADMAP → "Porting the Layer 4 response to another platform", Step 0(a). The last measurement (2026-07-30)
   found no recycling at n≤10; longer threads are open.
3. **Grok:** untested on all three browsers.
4. **Safari parity follow-up: the usage panel's transport, and GM storage** (ROADMAP 0d).
   - **The usage panel.** Moving it onto the ladder must keep v12.8's rules (DEC-044): one caller, the flag
     cleared before the call, asymmetric supersession, and the silent stale-org drop on every leg. Add no
     timeout shorter than the U4 window, and give its GM stub real onload-for-4xx semantics first.
   - **GM storage.** Either async `GM.getValue` / `GM.setValue` with an in-memory copy loaded at startup, or
     moving the keys to `localStorage`. Either is a design change of its own.
   - **Measure on Safari** what the acceptance did not report: the context bar's label, the usage panel's
     state, and whether a bookmark or a language change survives a reload.
5. **Perplexity attachment image errors:** image-gallery work. Perplexity's `imageSelector` is `null` today
   ("attachments are text labels, not `<img>` tags", ROADMAP).

**Open, outside that order (pick up only when the owner says so):**
- **The exact-origin guard gap** (§J), which ROADMAP 0d marks "take it before new Claude features".
- **The AbortController follow-up:** measure in each manager, then rework the caps and the LW checks, then
  re-run `probes/run-ladder-mutants.sh`.
- **The CI rebuild** (ROADMAP 0e).
- **Two spec gaps the owner kept.** Two reasons carry no `[transport]` tag, and L3-backoff checks only the
  first 60s step.
- **The context-window meter** (ROADMAP item 12, low priority, for later): see §I.

---

## H. Operational context + owner rules

- **Merge authority is per PR and explicit.** Nothing in this document authorizes a merge.
- **The owner merged v12.9 before its live acceptance** (a DEC-031 waiver). A waiver moves the merge, not the
  debt.
- **Live confirmation status lives in DEC-031 only.** CLAUDE.md and every other doc point there, so a status
  can't go stale in a copy. Results also go in the release's CHANGELOG entry and review record, nowhere else.
- **CLAUDE.md changes are shown to the owner as a diff and committed only on approval.**
- **Fix only findings within the asked scope. Log everything else** to ROADMAP or TROUBLESHOOTING instead of
  fixing it (the owner's rule on PR #75).
- **Changing how a failure is classified is the owner's call.** #5 was reverted for exactly that.
- **CI is not real-browser evidence.** The owner considers the CI checks outdated (ROADMAP 0e). Never cite a
  green run as proof that something works in a browser, and don't make the owner wait on CI to answer a
  question.
- **Codex:**
  - Read its summary comment's content. "Didn't find any major issues", or `has_any_findings: false` on the
    head commit, is a pass.
  - The review pipeline's Codex tier runs without asking. Stop only on a real billing, quota or auth error.
- **Ship small things small.** Ask before adding long verification runs, and give time estimates up front.
- **User-invoked only:** `/babysit-pr-cycle`, `/update-project-docs` and `/baton-handoff`. Tell the owner when
  one is due; don't try to run it.
- **Git hygiene.** Execute and narrate; explicit `git add` paths, never `-A`; never push to `main`. The commit
  trailer and PR footer are the harness's attribution lines.
- **The owner tests on** Safari + Userscripts (Mac), Firefox + Tampermonkey (Linux) and Chrome + Tampermonkey.
  Live checks in Chrome drive the owner's **real** profile.

---

## I. Deferred / future work

These are §G's "open, outside that order" items. They are not queued; the owner's order comes first.
- **The context-window meter** (ROADMAP item 12; low priority, for later, owner 2026-10-23). It still assumes
  Claude's old ~200–250K window (`CTX_LIMITS.claude` is `200000`), so long conversations read well over 100%.
  - Step 1: recalibrate to the current limit, 1M tokens, after verifying the limit per model and plan.
  - Step 2: revisit the token estimation itself.
  - It is linked to the old "turn counter red while the context bar shows ~19% at ~50 questions" mismatch, which
    the owner thinks may share a cause.
- **The AbortController rework.** Its premise was never measured, so measure first.
- **The CI rebuild (0e).** Inputs collected so far:
  - engine drift between local and CI WebKit;
  - four install stalls in two days;
  - the probe's ~2m20s per ubuntu job;
  - keeping the v12.8-fails proof re-runnable;
  - the Windows `page.goto` harness flake.
- **The two spec gaps.**
- **Chrome's intermittent 403**, until the Chrome check produces its log lines.
- **The local mac WebKit question.** Re-run a failing entry on build 2370, then trace one jump. Real Safari
  passes, so this is about the test engine, not the product.
- **`check-usage-state` U10 times out on Firefox**: every run on v12.8, intermittently on v12.9. Pre-existing;
  the probe runs on chromium in CI.

---

## J. Risk caveats / known limitations

- **The exact-origin guard covers only the index. OPEN, security-relevant, pre-existing, inferred from code.**
  - The Plan usage panel (`fetchClaudeUsage`) and the SSE interceptor's install are gated only by
    `host.includes('claude.ai')`.
  - The header's `@include https://*cloudworkstations.dev/*` glob also matches hosts whose name merely contains
    `claude.ai`. On such a page the usage panel would request the user's plan usage with their session and
    render it into that page, and on Chrome the interceptor would patch that page's `fetch`.
  - Fix: apply `ciIsClaudeChat`'s exact-origin check at both call sites (ROADMAP 0d).
- **Safari parity gaps, still live.** The usage panel is GM-only, so it is expected to read "Usage data
  unavailable". GM storage is absent, so bookmarks and saved commands are never stored and the language and
  platform toggles cannot change. Display mode, scroll direction and panel width use `localStorage` and work.
- **On Safari the SSE tap and the SPA history hooks don't reach the page (inferred).** The context bar should
  read `(est.)` only, and the nine `spa:true` platforms would miss `pushState` navigations.
- **Chrome + Tampermonkey's live check is still to run** (status: DEC-031), and its old intermittent 403 is
  unexplained.
- **Not gated by any check:** M18 (the `finish` latch), M19 (the callback rethrow) and M21 (fetch's own origin
  guard). Each is insurance or defence in depth, and the matrix records it as such.
- **Two timed-out fetches that never end keep the index degraded, with its banner, until a reload.** That is
  the accepted cost of the page-wide stall cap, recorded in DEC-045. The abort follow-up would remove it.
- **CI's ubuntu runners stall in the browser install** intermittently: four times in two days, and twice in a
  row on PR #76. The ruleset allows no bypass, so budget for re-runs.

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md
(2026-10-22/23 — "v12.9: the Claude index works on Safari").

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats). Before any change that talks to
claude.ai, persists data or replaces a page global, read agent_docs/architecture.md →
"Runtime matrix".

I will give you this session's spec at the start. It is not in the repo. Work from it
as given; don't expand or reinterpret it. Confirm your understanding of the handoff
and the spec, then wait for my go before starting work.

FIRST, CHECK STATE — do not assume:
  git log --oneline -3 main
  gh pr list --state open
main should be at 5201937 or later (the handoff's own docs PR may have merged since).

AFTER THE SPEC, my order is in HANDOFF §G: the Chrome check (Claude Code drives my
real Chrome profile, not a fresh one), Gemini's recycling question, Grok on all three
browsers, Safari parity (usage panel transport + GM storage), Perplexity attachment
images. Ask before picking any of them up.

DO NOT:
- Merge anything without my explicit OK for that PR, or push to main. The ruleset
  allows no bypass: re-run a stalled CI job, never override it.
- Commit a CLAUDE.md change before I approve the diff.
- Report anything you cannot drive yourself (Safari + Userscripts today) as
  verified. List it as owner acceptance in the PR.
- Cite green CI as real-browser evidence.
- Change how the index classifies a failure without asking me (#5 was reverted).
- Fix findings outside the task's scope. Log them to ROADMAP or TROUBLESHOOTING.
- Add long verification runs to a small task without asking first.
- Re-trigger Codex without reading its summary comment. "No major issues" is a pass.
- Copy a live-confirmation status into other docs. DEC-031 keeps it; point there.

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my
untracked files (HANDOFF §E lists them). Run `npm test` and `npm run test:probes`
after any code change. Every claim carries its measurement context.
```
