# Session Handoff — 2026-11-10 to 11-12 (the CI rebuild: 20 parallel jobs behind one required check, `ci-ok`; J15 and U10 fixed)

**Scope:** ROADMAP item 0e ("Next" item 4), the owner's order of 2026-11-07: split the probes into parallel jobs, then
the flaky tests (J15, U10), then the mocks. Its own PR, #95, CI and probes only: **the userscript is unchanged.**
Design and every decision: DEC-064. Review record: `reviews/review-2026-11-11-ci-rebuild.md`.

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-11-08_v12.19-gemini-full-history.md` (v12.19; its §G.1 was this
session).

**Status at close:**
- **PR #95: MERGED** 2026-11-12 17:12:20Z as `d3f3d16` (head `116d10b`), on the owner's explicit OK, after the owner
  added `ci-ok` to the ruleset. GitHub Codex: clean on opening and on the one confirming `@codex review` (0 findings,
  0 fixes). The PR's run 43069811015: 20/20 jobs, `ci-ok` green.
- **`main`'s first run** (43266934908 on `d3f3d16`): attempt 1 lost `firefox` and `webkit on macos-latest` to GitHub
  never assigning a Mac runner (`ci-ok` correctly red); attempt 2 (`gh run rerun --failed`) 20/20, `ci-ok` green
  17:41:52Z. The owner then removed the nine old checks.
- **The ruleset is now `main-protection`** (the owner renamed it from `mian-protection`, a typo, on 2026-11-12) and
  requires **one check, `ci-ok`** (GitHub Actions, integration 15368), with no bypass actors.
- **The Safari smoke-check reminder was given** after the merge (2026-11-12). This PR changed no userscript code.
- **This handoff is on `ci/live-verification-layer`,** cut from `d3f3d16`, for the owner's next PR (the owner,
  2026-11-12: "it should go on next PR's branch"; the name is the agent's, after the owner's "the live verification
  layer (the next spec)"; rename it if the spec says otherwise). No docs-only PR (the owner).
- **Next:** the owner's next spec (a live verification layer, a different CI approach) in a new session (the owner,
  2026-11-11), then Grok (the owner put Grok after the CI rebuild; that it follows the new spec is the agent's
  reading, 2026-11-12).
- **Left in the owner's browsers:** unchanged from the prior handoff (Chrome's Tampermonkey: 12.19 at `597ebfe`, and
  G0, inert; Firefox: 12.14). No live work happened this session.
- **This Mac now runs Playwright 1.65.0** (the owner's call, 2026-11-11): Chromium 1254, Firefox 1572, WebKit 2388,
  the same builds as CI. 1.58.2's browsers were removed by Playwright's install.

---

## A. State in one paragraph

`main` is v12.19's userscript under a rebuilt CI. Every PR and push now runs 20 jobs [CI]:
- `changes`, the docs-only fast path;
- the 9 suite jobs, names unchanged;
- 9 probe jobs, `probes <group> (<engine>)`, two lanes each;
- `ci-ok`, the one required check.

The ubuntu jobs run in `mcr.microsoft.com/playwright:v1.65.0-noble` (Playwright pinned), so the apt-mirror stall is
gone. Whole runs took 9.23 and 9.98 minutes on the measured dispatch runs, against 46m53s before, with every probe ×
engine's PASS count unchanged. The PR's run took 11.77 minutes, 5m03s of it one macOS job waiting for a runner.

`ci-ok` fails unless every job succeeded, or was skipped as docs-only. It checks the matrices' aggregate results and
every one of the 19 jobs by name, so a leg GitHub cancels before it gets a runner turns it red; `main`'s first run
proved it. J15 (a mock pin with a clock) and U10 (a probe precondition race) are fixed, each with 30 local runs per
engine before and after.

---

## B. What was accomplished

Times are UTC. Context tags: **[CI]** GitHub Actions, mock evidence, never browser evidence; **[mock]** Playwright,
headless, page realm, the userscript inlined, no real manager, this Mac (macOS arm64), Playwright 1.65.0 unless
stated.

### 1. The read-only plan and the owner's decisions (2026-11-11 00:53–01:25Z)
- **Measured first** [CI, run 42437401493 on `b0fee35`, the job logs' per-line timestamps]:
  - `check-gemini-index` is ~45 sequential blocks of 2.7–79 s plus a background group (I22–I28, I3c) from t=0. A
    boundary after I12b splits it 375.5 s / 388.4 s on chromium. The background group alone took 182.2 s [mock,
    1.58.2].
  - The other 14 probes total ~1,600 s per engine.
  - GitHub Free allows 20 concurrent jobs (5 macOS), so the floor is ~9.5 minutes for ~180 job-minutes.
  - CI ran Playwright 1.65.0 while this Mac and the lockfile had 1.58.2; the 1.65.0 image is 1.0 GB compressed.
- **Alternatives offered:**
  - A: one block per probe job, 18 probe jobs; ~9 minutes only with 28+ slots.
  - B: two blocks per job, 9 probe jobs: 18 at once (the plan also counted a slot for `claude-code-review.yml`;
    measured 2026-11-12, that workflow is disabled and takes none).
- **The owner (2026-11-11), each in their words in DEC-064:**
  - Free plan, so layout B;
  - one required gate named `ci-ok`, which also honours the docs-only rule;
  - the container image for all ubuntu jobs ("don't loosen any check");
  - this Mac to 1.65.0;
  - caps 60 → 30 and 20 for probes, a PR-only concurrency group, current actions;
  - a docs-only fast path from the base...head file list;
  - the gate proved by a forced failure and a cancel;
  - J15 by the HANDOFF's deterministic pin, and U10 "the cause first", each with 30 runs per engine before and after,
    "no retries anywhere";
  - the mocks scoped read-only.

### 2. Stage 1, the split (commits `68b9d19` … `3e43e53`, 2026-11-11 01:25–02:56Z)
- **What:**
  - `.github/workflows/cross-platform-tests.yml` rewritten, plus `.github/scripts/docs-only.sh` and
    `.github/scripts/probe-lanes.sh`;
  - `check-gemini-index --part 1|2` (a PARTS table, R1 and E in both halves, INVALID guards);
  - Playwright pinned to exactly 1.65.0, with `npm ci` everywhere.
  - The suite jobs split into `test-ubuntu` (container) and `test-other` (macOS, Windows), with the same check names.
- **Why the lanes:** two probes per runner fit Free's 20 slots. Measured [CI], two lanes cost almost nothing: e.g.
  feature-gaps 276 s vs 275 s alone, the gemini halves 375 s / 388 s vs 375.5 s / 388.4 s.
- **Rejected:**
  - Sharding by `--only`: it matches by prefix, so `I1` selects I10–I19.
  - More lanes inside the gemini probe: that changes the load profile.
  - Layout A: it queues on Free.
- **Review:**
  - Tiers 1–2 in session: one CRITICAL, the lockfile still at 1.58.2 (fixed by the pin), and one WARN (PowerShell
    quoting, fixed with `shell: bash`).
  - Tier 3 (Codex) round 1, 2 CRITICALs, both verified and fixed in `931ce64`:
    - the detector runs from the BASE branch, so a PR's own edit cannot skip its tests;
    - `ci-ok` checks every leg by name through the jobs API, after GitHub community discussion 211624 (a user's
      report) said a leg cancelled before getting a runner leaves the aggregate at `success`.
  - Round 2, fixed in `77f7fee`: `filter=all` with each name's newest attempt; BOTH_PARTS validated.
    - Not changed: "a PR can edit the workflow" (true of every `pull_request` workflow) and "`always()` keeps `ci-ok`
      running on a cancelled run" (by design: a job skipped by its own `if:` would pass a required check).
  - Rounds 3 and 4 (post-fix): APPROVED. 4 of 5 rounds used.
- **Verification:**
  - **[CI] Dispatch runs 42946394211 and 42948220969 on `3e43e53`:** 20/20; 9.23 and 9.98 min; every count equal to
    the baseline; the image pull 14–20 s; 4 CPUs and 16.8 GB on ubuntu.
  - **[CI] The gate proofs:**
    - cancel, run 42949425864: `ci-ok` ran and failed, naming all 18 legs;
    - forced failure, run 42949522716, on a throwaway branch since deleted: `ci-ok` failed, naming the one job.
  - **[mock] `--part`:** part 1 (54) + part 2 (29) = the whole 81 ids, R1 and E twice; 5 guard mutants each INVALID.
  - **Docs-only [this Mac, git 2.27]:** 18 edge cases in a scratch repo and the real docs-only commit `8f998c0`.
  - **`ci-ok`'s script** against a stub `gh`: 19 cases.
  - **actionlint 1.7.12:** clean.
- **This Mac's WebKit** (the owner asked for a re-run of the four "local mac WebKit" entries): on 2026-11-11 they
  passed on BOTH builds, so the upgrade fixed nothing; the old failure no longer reproduces, cause unknown
  (TROUBLESHOOTING).

| Build | The four entries alone | The full suite |
|---|---|---|
| 1.58.2, WebKit 2248 | 3/3 runs 110/110 | 2/2 runs 560/560 |
| 1.65.0, WebKit 2388 | 3/3 runs 110/110 | 2/2 runs 560/560 |

### 3. Stage 2, the flaky tests (`c5abeea`, `40ba5d5`, 2026-11-11 03:08–04:00Z)
- **J15** [mock, `--only J15`, the three engines side by side]:
  - The cause: the fixture's pin was `pinMs: 1`, so a scroll in the wheel's own `Date.now()` millisecond was never
    pulled back, and the jump truly landed.
  - The fix: the mock's `jumpModel.pinEvery`, which pulls every scroll back, wheel or not.
  - Before: chromium 3/30 failed, each `resolved=10 toast=no`; firefox and webkit 0/30. After: 0/90.
  - With the race forced lost (`pinMs: 100000`), the old pin fails with the flake's signature and `pinEvery` passes.
  - J15 still FAILS on v12.14 and `71eda09`; the whole probe is 29/29 per engine.
- **U10** [a trace harness, a scratch copy of U10's scenario logging requests, `pushState` and repaints with the page's
  clock, Firefox, 25 runs]:
  - The cause: the probe routed back to A before B's index (10 ms in the mock) landed. B's load finished superseded,
    the userscript held no conversation, the return was not a switch, and the same-org usage cooldown stayed warm, so
    no request #2 was sent. The case U10 exists for never happened, and the wait timed out.
  - The 3 failures routed back 6–10 ms after B's index request, the 22 passes 13–20 ms after.
  - **The agent judged the cause the probe's, not the userscript's** (the panel still showed correct numbers; the
    owner was told before the fix).
  - The fix: the GM stub counts delivered conversation responses (`window.__acnIndexAnswered`), and U10 waits for B's.
  - Before: firefox 2/30 timed out, chromium and webkit 0/30. After: 0/90.
  - U10 still FAILS (`pct=42`) on `5eee8ac` and on a guard-reverted mutant.
- **Review:** Tiers 1–2 in session for each (under 50 lines), no findings; recorded in the review file.

### 4. Stage 3, the mocks: scoped, not refreshed (`39f7aba`, `116d10b`)
- `docs/mock-refresh-scope.md`: the 18 mocks ranked by risk, with the live reads a refresh would need. The top five
  are `gemini-history`, `chatgpt-windowed`, `claude-virtualized`, `perplexity-windowed` and `claude.html`. No live
  reads were made.
- **A finding:** `claude.html` still uses `data-testid="user-human-turn"` and `user_message`, both measured at 0 live on
  2026-07-26, so the suite's "Claude" entry passes only through the userscript's fallback selectors.
- **The owner (2026-11-11):** "No other mock refresh for now: the live verification layer (the next spec) is what will
  catch site drift"; `claude.html`'s entry is logged in ROADMAP to retire or replace in a later PR.

### 5. The PR, the babysit, the merge (2026-11-11 17:35Z → 11-12 17:42Z)
- **PR #95 opened** on the owner's instruction (17:36Z) with the drafted body: before/after timings and a 46-row
  table mapping each probe × engine to its new job, with PASS counts.
- **`/babysit-pr-cycle`** (the owner named it): Codex clean on opening (`has_any_findings: false`) and on the
  confirming `@codex review` ("Didn't find any major issues. Breezy!" on `116d10bf58`). 2 rounds, 0 fixes.
- **The PR's run 43069811015** [CI]: 20/20, `ci-ok` green, 11.77 min. `webkit on macos-latest` was created 17:36:44Z
  and started 17:41:47Z (GitHub's Mac capacity; 3 of 5 macOS slots and 18 of 20 jobs in use).
- **Merged** 2026-11-12 17:12:20Z as `d3f3d16` (`--match-head-commit 116d10b…`) after the owner confirmed `ci-ok` in
  the ruleset.
- **`main`'s first run 43266934908** [CI]:
  - Attempt 1: `firefox` and `webkit on macos-latest` queued 15 minutes with no runner and 0 steps, then were
    cancelled, annotated "The job was not acquired by Runner of type hosted even after multiple attempts" and "Due to
    capacity constraints, jobs targeting macOS arm64 runners may experience longer queue times".
  - `ci-ok` failed on both of its checks. GitHub reported `needs.test-other.result` as **`abandoned`**, a value
    outside the documented set, and the per-leg check named both legs.
  - Attempt 2 (`gh run rerun --failed`, 17:30Z): 20/20, `ci-ok` green at 17:41:52Z.
  - Also measured: `jobs?filter=latest` on the re-run attempt lists every job, the carried-over successes under
    `run_attempt` 2. That settles Tier 3 round 2's open question; `ci-ok`'s newest-attempt logic handles either shape.
- **How often this happens** [CI, the last 60 runs, 2026-10-31 → 11-12, 680 job executions, read 2026-11-12]:
  - jobs that never got a runner in 2 of 60 runs, all macOS, both right after a merge to `main`;
  - macOS jobs waiting more than 2 minutes: 19 of 201; more than 10 minutes: 1.
- **The owner then removed the nine old checks.** On their question ("will it be like this all the time?"), the
  agent offered two options. The owner logged option 1 for later (ROADMAP), not built:
  - option 1, an automatic re-run for runner-capacity failures only;
  - option 2, fewer macOS jobs.

### 6. Mistakes, kept because they generalize (all five in `agent_docs/conventions.md`, "Lessons Learned": the owner, 2026-11-12, "add all four lessons", then "add the fifth lesson")
- **A claim widened past its sample.** A U10 comment drafted as "every failure routed back before that index landed,
  every pass after" rested on 2 failing and 3 passing traces. A scripted check over 25 runs found a pass that also
  routed back before the *repaint*. The precise claim (the gap from the index request) replaced it before the commit.
  Write counts, not "every", until a scripted check over the whole sample agrees.
- **A doc line that contradicted what the owner was told.** DEC-064 first listed the skipped stage-end local run as
  "not run", after the agent had told the owner it would leave that out unless told otherwise. Caught on re-reading
  and removed (`fc0f1f5`). Re-read the docs against the conversation's promises before committing.
- **A memory saved that the owner had not asked for.** The agent saved the owner's one-time skip as a rule; the owner
  asked for it to be reverted entirely, and it was, timestamp included. Do not turn a one-time call into a rule or a
  memory unless the owner says so.
- **The template-literal escaping trap, once more:** a scratch harness's regex inside the probe's template literal lost
  its backslashes (`\/` → `/`), and the injected script never ran. The probe's own comments record the trap; use string
  methods, not backslash regexes, inside those literals.
- **A workflow's trigger is not evidence that it runs** (found in the docs sweep, 2026-11-12): the plan, DEC-064, the workflow and the lane script all counted a concurrency slot for
  `claude-code-review.yml` on every PR push, from its `on: pull_request` trigger. `gh workflow list` shows it
  `disabled_manually` (last run 2026-02-23), so it takes none. Also corrected: the 18 suite and probe jobs run at once
  (`changes` before them, `ci-ok` after), so a run's peak is 18 of 20, not 19.

### 7. `/update-project-docs` (the owner named it, 2026-11-12: "update all the docs in repo while we are in this session")
- **The sweep for claims the rebuild made stale,** in every doc that states the present (archived handoffs, review
  records and past log entries left as written):
  - `agent_docs/testing.md`: setup `npm install` → `npm ci` and how to move the pin; `test:probes` no longer stops at U10;
    J15 marked fixed in the history block; `--part` beside `--only`; the per-probe PASS-line baseline table.
  - `TESTING.md`: Requirements (Node 20+, the pinned Playwright via `npm ci`, not the old sandbox's global install);
    the caps since the rebuild; the local WebKit paragraph (not reproduced on 2026-11-11).
  - `probes/README.md`: where the probes run in CI. `tests/run-tests.sh`: its comment said `npm install playwright`,
    which would rewrite the pin.
  - The `claude-code-review.yml` slot (above), in DEC-064, the workflow, the lane script and `agent_docs/testing.md`.
- **The session documented in full:** CHANGELOG's entry; DEC-064 with the docs-only edge cases and the actions
  upgrade's release notes; TROUBLESHOOTING's J15, U10, local WebKit, Mac runner and Playwright-pin entries; ROADMAP;
  `agent_docs/git-workflow.md`; `agent_docs/conventions.md` (five lessons, and archived handoffs as dated records).

---

## C. Architecture snapshot

Unchanged for the userscript (v12.19; see the prior handoff and DEC-063). CI changed: see §A and DEC-064.
- **Workflow:** `.github/workflows/cross-platform-tests.yml`, with jobs `changes`, `test-ubuntu`, `test-other`,
  `probes` and `ci-ok`.
- **Scripts:** `.github/scripts/docs-only.sh` runs from the base branch's copy; `.github/scripts/probe-lanes.sh` holds
  the groups and lanes, with each probe's CI time in comments.
- **A job added to the workflow** must go into `ci-ok`'s `needs:` and its expected-names list; an unknown job fails
  the gate.
- **Engine placement is unchanged:** the string probes on chromium only, every other probe on all three engines,
  ubuntu only.

---

## D. Key principles established

- **`ci-ok` is the only required check** (the owner, 2026-11-11/12). Never override it; a cancelled or failed job is
  re-run with `gh run rerun <run-id> --failed` once the whole run has finished, after reading why it failed. A
  runner-capacity cancel (0 steps, "not acquired by Runner") is GitHub's, not a finding.
- **Each fix gets its own check where one is possible** (the owner, 2026-11-11): a gate that fails without the fix,
  or a stubbed test of the gate script. This session's fixes all have one (the mutants, the stub cases, the forced
  race, the old builds).
- **Verify each review finding before fixing it** (the owner, 2026-11-11: "not every comment is a defect"). Tier 3
  round 2 had one CRITICAL out of reach and one WARN by design; both were reported, not "fixed".
- **No retries anywhere** (the owner, 2026-11-11): no test or probe is retried; the lanes keep running after a failed
  probe and report it. Option 1 (logged) would re-run only jobs that never started.
- **Archived handoffs are dated records** (the owner, 2026-11-12): never edit them, not even for a rename. The v12.19
  handoff was archived unchanged, with the old ruleset name in it.
- **A finding about CI timing is a [CI] finding:** CI stays mock evidence, never browser evidence.

---

## E. Git state

`main` is at `d3f3d16` (the PR #95 merge).

| Commit | What |
|---|---|
| `8f998c0` | the v12.19 handoff, post-merge lines (rode along) |
| `68b9d19`, `3e74e00`, `b339623` | the pin; `--part`; the workflow and its two scripts |
| `931ce64`, `77f7fee` | Tier 3 rounds 1 and 2's fixes |
| `3e43e53`, `46ace41` | the probe README line; the review record |
| `c5abeea`, `40ba5d5` | J15's pin; U10's wait |
| `39f7aba`, `fc0f1f5`, `116d10b` | the docs (DEC-064 …); one line dropped; the owner's mock decision |
| `d3f3d16` | **merge of PR #95** |

- **Current branch: `ci/live-verification-layer`,** cut from `d3f3d16`. One commit: this handoff, the v12.19 handoff
  archived unchanged, the post-merge lines and the `/update-project-docs` sweep (DEC-064, CHANGELOG, TROUBLESHOOTING,
  ROADMAP, `agent_docs/git-workflow.md`, `agent_docs/testing.md`, `agent_docs/conventions.md`, TESTING.md,
  `probes/README.md`), plus comment-only corrections in `.github/workflows/cross-platform-tests.yml`,
  `.github/scripts/probe-lanes.sh` and `tests/run-tests.sh` (no behaviour changes). Pushed; no PR. The owner's next PR
  is opened from it.
- **Remote branches:** `main`, `ci/rebuild-parallel-probes` at `116d10b` (merged; left in place), older merged ones.
  `ci/gate-proof-throwaway` was deleted after the proof. No open PR.
- **Merges use merge commits** (`gh pr merge --merge --match-head-commit <full sha>`). The ruleset `main-protection`
  (id 12827500) requires `ci-ok` only, with no bypass actors and "up to date before merging" on.
- **The owner's own untracked files: never `git add` them.** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`. An old stash (`stash@{0}`, on
  `a70de21`) is the owner's; leave it.
- **Port 8765 is the owner's**; serve builds on another port.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| DEC-064 | the CI rebuild's decisions, measurements, limitations |
| `.github/workflows/cross-platform-tests.yml`, `.github/scripts/` | the 20 jobs, the gate, the lanes, docs-only |
| `agent_docs/testing.md` → "CI/CD"; `TESTING.md` → "CI: reading the rebuilt workflow" | the layout and how to read a red `ci-ok` |
| `agent_docs/git-workflow.md` | the PR procedure; the ruleset (`ci-ok` only) |
| `docs/mock-refresh-scope.md` | the 18 mocks ranked by risk, for when site drift is next addressed |
| `ROADMAP.md`, Current Status and "Next" | the next spec, then Grok; option 1; `claude.html` |
| `reviews/review-2026-11-11-ci-rebuild.md` | Tier 1–3 record of this PR |
| `docs/acceptance-checklist.md`, DEC-062 | the consolidated pass at about v12.20 (no steps from this PR) |

---

## G. What comes next

### 1. The owner's next spec: a live verification layer (a different CI approach), in a new session
The owner (2026-11-11): "a couple of different things that I might give it to you as a spec after this, which I think
it might take our CI build and all of those things to the next level"; "the live verification layer (the next spec)
is what will catch site drift". The spec has not been shared, and nothing happened in another channel (the owner,
2026-11-12). **Wait for the owner's prompt; do not start from guesses.** Its own PR, from `ci/live-verification-layer`
(rename it if the spec names another). Inputs it will likely want:
- `docs/mock-refresh-scope.md`: which mocks model what, when each was last measured live, which gates load each.
- DEC-031 and DEC-062: acceptance is the owner's, on Safari + Userscripts, Chrome + Tampermonkey and Firefox +
  Tampermonkey; CI is mock evidence.
- The measurement-context rules in CLAUDE.md and TESTING.md: a live check is scoped to its manager, browser, tab
  visibility and account.

### 2. Grok on all three browsers (ROADMAP "Next" item 5), once the owner is on the Linux machine
Unchanged from the prior handoff: redo the code search signed in, then DOM-REFERENCE data steps 2–3; a read-only
Phase 1 first.

### 3. The consolidated acceptance pass at about v12.20 (DEC-062)
The owner's, from `docs/acceptance-checklist.md`. PR #95 added no steps (no userscript change).

### 4. Logged for later (ROADMAP), unordered
- **Option 1, an automatic re-run for runner-capacity failures** (the owner, 2026-11-12, logged, not built): a small
  separate workflow with `actions: write`. It re-runs only when every failed job has 0 steps (never got a runner),
  once per run, on the first attempt only, never for a job that ran and failed.
- **`claude.html`'s suite entry:** retire or replace it (pre-July markup, passes through fallback selectors).
- The image tag pinned by digest; `--slow` and the `abort` / `none` probe modes in CI (never run there).
- The local mac WebKit failure's cause (not reproduced on 2026-11-11; candidates untested).
- TROUBLESHOOTING's J15 wording question (the race is gone, so it matters less).
- Everything in the prior handoff's §G.4 "Later" list (Perplexity attachment images, item 0d, item 12 step 2, item
  13's v12.19 residuals, a Windows spot-check).

---

## H. Operational context + owner rules

Carried over, still in force:
- **Equal priority:** Safari, Chrome and Firefox (DEC-047). **Acceptance results** go in DEC-031 only, exactly as
  reported.
- **Merges:** only on the owner's explicit OK for that PR; never push to `main`. Re-run a stalled job (read why
  first), never override, never add a bypass actor. **The owner changes the ruleset; the agent gives the steps.**
- **Live work in the owner's accounts is read-only.** Ask before anything that sends; any POST, a read RPC included,
  counts as sending. Chats by id prefix only (the repo is public).
- **CLAUDE.md:** show the diff, commit only on approval. Its lines are rules: no version tags, no mechanisms.
- **Scope:** build the minimal version of the spec. Log findings outside it to ROADMAP or TROUBLESHOOTING.
- **Proof:** a gate that fails on the previous version, plus mutants. Ask before a long run, with an estimate.
- **Every claim carries its measurement context.** Safari + Userscripts is the owner's to verify.
- **The Tier 3 cap is 5.** After a clean Codex review, post `@codex review` once more.
- **`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`:** only when the owner names them.
- **The per-stage test rule** (CLAUDE.md rule 7): each step its own gates, the full suite once per stage.
- **Git:** explicit `git add` paths, never `-A`; never add the owner's untracked files.
- **After each merge:** remind the owner of the optional 5-minute Safari smoke check.

New this session (the owner, 2026-11-11/12; §D has the detail):
- `ci-ok` is the only required check; the owner added it before the merge and removed the nine after `main`'s first
  green run.
- Each fix gets its own check where possible; verify each Codex finding before fixing; no retries anywhere.
- Archived handoffs are dated records, never edited.
- **The handoff rides on the next PR's branch,** no docs-only PR (the owner, 2026-11-12).
- **The owner's next CI work is a separate PR and session** (the owner, 2026-11-11, paraphrased): PR #95 stayed its
  own, and the next CI approach gets a new session and its own PR.

---

## I. Deferred / future work

Not queued; §G comes first.
- **Mock refresh:** deferred by the owner in favour of the live verification layer. The scope doc's ranking and read
  counts stand if it is ever done (#1–#5: about 7 page visits, about 6 GETs, 2 `hNvQHb` POSTs).
- **Option 2, fewer macOS jobs** (e.g. WebKit only on macOS): offered, not chosen.
- **The docs-only fast path's first CI proof:** waits for the first docs-only PR to `main`. The owner chose no
  docs-only PR for this handoff, so it may wait a while; the local proof (18 cases) stands meanwhile.

---

## J. Risk caveats / known limitations

- **A PR can edit the workflow so `ci-ok` passes** (true of every `pull_request` workflow; Tier 3 round 2). The guard
  is human: read a workflow diff before merging.
- **GitHub's Mac capacity:** about 1 run in 30 loses a macOS job to "not acquired by Runner" (2 of 60). It turns
  `ci-ok` red until `gh run rerun --failed`, as one of the nine old checks would have. Option 1 would automate that.
- **`needs.<job>.result` can be `abandoned`** (observed on `main`'s first run), outside GitHub's documented set. `ci-ok`
  accepts only `success`, or `skipped` when docs-only, so an undocumented value fails it.
- **The image tag `v1.65.0-noble` is mutable** (not digest-pinned). Inside the container GitHub's default shell is
  `sh`; every step there is POSIX or names bash.
- **`ci-ok` runs ~10–40 s on a cancelled run** by design (a skipped required check would count as passing).
- **Mocks model sites as last measured** (`docs/mock-refresh-scope.md`); `claude.html` models a structure Claude no
  longer has. CI stays mock evidence.
- **Merged without acceptance:** v12.15–v12.19 (unchanged; the consolidated pass at about v12.20).

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md on the branch
ci/live-verification-layer (2026-11-12: the CI rebuild merged as d3f3d16, PR #95;
ci-ok is main-protection's only required check; next: my next spec, then Grok).

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats). DEC-064 has the CI design.

FIRST, CHECK STATE — do not assume:
  git fetch origin
  git log --oneline --first-parent -3 origin/main
  git branch --show-current && git status --short
  gh pr list --state open
main should be at d3f3d16 (the merge of PR #95). You should be on
ci/live-verification-layer, one commit ahead of main (this handoff, the v12.19
handoff archived unchanged, the post-merge docs, comment-only fixes in .github/ and
tests/run-tests.sh), plus my five untracked files, never added. No PR should be open. If that is not what you see, stop and tell me.

THIS SESSION: wait for my spec (a live verification layer: my next CI approach). Do
not start from guesses about it. When it arrives: a read-only Phase 1 first, measure
before reasoning, and wait for my decision before changes. Its own PR from this branch
(rename the branch if the spec names another). After it: Grok, once I'm on my Linux
machine. No release until every platform works on all supported browsers.

CI (DEC-064): 20 jobs; ci-ok is the one required check on main-protection. A job
GitHub never gave a runner (0 steps, "not acquired by Runner") turns ci-ok red: read
why, then `gh run rerun <id> --failed` once the run has finished. Never override.
A job added to the workflow goes into ci-ok's needs: and its expected list.

ACCEPTANCE (DEC-062): one consolidated pass at about v12.20, from
docs/acceptance-checklist.md. Append a PR's steps there if it has any. After each
merge, remind me of the optional 5-minute Safari smoke check.

STANDING RULE: Safari, Chrome and Firefox are equal priority (DEC-047). Before any
live measurement, confirm which userscript version is installed in that browser
(DEC-027): Chrome has 12.19 (597ebfe), Firefox 12.14. This Mac runs Playwright
1.65.0, the same browser builds as CI.

PROCESS (HANDOFF §D, agent_docs/git-workflow.md): each build step runs its own gates,
the full suite once per stage (CLAUDE.md rule 7); Tier 3 capped at 5 rounds; each fix
gets its own check where possible; verify each review finding before fixing; no
retries anywhere; if the userscript changes, reinstall in my Chrome and retest live;
open the PR; /babysit-pr-cycle when I name it, plus one confirming @codex review;
re-read the whole transcript and memory before /update-project-docs or
/baton-handoff. If I say I'm away, take over my Chrome and push through. If the laptop
may sleep, keep a resume pack outside /tmp.

DO NOT:
- Merge anything without my explicit OK for that PR, or push to main.
- Change main's required checks or the ruleset yourself; tell me the exact steps.
- Commit a CLAUDE.md change before I approve the diff.
- Report anything you cannot drive yourself (Safari + Userscripts) as verified.
- Cite green CI as real-browser evidence.
- Credit me with a decision you made: say whose it was, with the date.
- Turn a one-time call of mine into a rule or a memory unless I say so.
- Fix findings outside the task's scope. Log them to ROADMAP or TROUBLESHOOTING.
- Add long verification runs without asking first, with a time estimate.
- Edit an archived handoff (docs/handoffs/): they are dated records.
- Send, edit, regenerate, delete or share anything in my live accounts without asking;
  any POST, a read RPC included, counts as sending.
- Create or delete bookmarks (or other navigator data) in my real browser profiles
  without asking.
- Read or write GM storage except through acnGetValue / acnSetValue /
  acnUpdateValue (collections through acnUpdateValue).
- Name my chats by title or quote their content: id prefixes only (the repo is public).

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my
untracked files (HANDOFF §E). Port 8765 is mine; serve builds on another port. Take
times from a clock. Every claim carries its measurement context.
```
