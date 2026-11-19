# Session Handoff — 2026-11-12 to 11-19 (the live test system: the owner's spec, Stage 0, the redesign, and Experiment 1 — 40 of 40 live page loads accepted)

**Scope:** the "live verification layer" the prior handoff waited for. The owner's spec arrived on 2026-11-16
(`docs/specs/live-test-system-spec.md`); Stage 0 measured it; the owner **redesigned** it on 2026-11-17
(`docs/specs/live-test-system-redesign.md`: attended live checks, no robots) and asked for one experiment, which ran
in three stages (macOS, Windows, Linux VMs) and finished on 2026-11-19. **The userscript is unchanged** (v12.19,
`b0fee35`). Design, every decision and every measurement: **DEC-065** (read its "Where this stands" block first).
Tooling: the private repo `ai-conversation-navigator-private-lab` (its `README.md` and `docs/runbook.md`).

**Prior handoff:** `docs/handoffs/SESSION_HANDOFF_2026-11-12_ci-rebuild-parallel-jobs.md` (the CI rebuild; its §G.1
was this session).

**Status at close:**
- **Experiment 1 is complete** (2026-11-19 02:08Z): 40 of 40 page loads accepted, signed in to the test account, Navi
  v12.19 loaded, **no stop rule anywhere** (no challenge, warning or notice on any site, 12 Claude loads in all), 22
  cells with every check passing. The full report went to the owner at 02:10Z.
- **The owner's instruction after the report:** "Don't start anything after the report. I'll come back with the plan
  for the rest of the pipeline." **The next session waits for that plan.**
- **Frozen until the plan** (the owner, 2026-11-18): Navi v12.19 and checker 0.3.2; no Navi fixes and no check tuning
  until the whole pipeline is built.
- **`main` is in sync with the branches** (the owner's request, 2026-11-19): public `main` takes
  `ci/live-verification-layer` through **PR #96** (docs only, merged once `ci-ok` is green; `main` cannot take a direct
  push); the private repo's `main` was fast-forwarded to `phase-a/stage-0` (`bc4844b`). No other PR is open.
- **The macOS user name in the public repo** (found 2026-11-19): a path under `~/.claude/projects/` carries it. This
  session's commit with it was rewritten away (the branch force-pushed); the one in the archived v12.19 handoff was made
  generic (`d9389e5`, the owner's one exception to "archived handoffs are never edited"). **Older history keeps it**
  (commit `8f998c0`, merged with PR #95), and the commit email on 626 older commits shows it too: the owner's choice was
  "current files only"; from now on commits use the owner's GitHub noreply address.
- **All three VMs are off.** The receiver still runs on this Mac (started with `nohup`; stop it with
  `pkill -f exp1/receiver.js`; it listens only on 127.0.0.1 and 192.168.64.1, port 8790).
- **Navi Test** (the macOS test user) is frozen and signed out; the owner expects not to use it under the VM design.
  The owner ran `chmod 700 ~` (measured: mode 700 since 2026-11-18 20:55 CST), so the test user cannot read the owner's
  home folder.
- **The owner's own browsers:** unchanged (Chrome's Tampermonkey: 12.19 at `597ebfe`; Firefox: 12.14). Nothing ran in
  them this session. One test ran in the owner's macOS account in a separate Chrome data folder (2026-11-17, since
  deleted; DEC-065).
- **`/baton-handoff` was changed at the owner's request (2026-11-19):** it no longer asks whether work happened in
  another channel; the handoff covers this session only. The change is in `vibecoding-loadout`
  (`skills/baton-handoff/`, branch `skills/user-requested-invocation`), uncommitted there.

---

## A. State in one paragraph

`main` is v12.19 under the rebuilt CI (unchanged since `d3f3d16`). Beside it now stands a working miniature of the
owner's live test pipeline, all on this Mac: three UTM VMs (**Navi Mac**: macOS 26.6.2 with Safari + Userscripts 4.8.6,
Chrome and Firefox + Tampermonkey; **Navi Windows**: Windows 11 ARM64 with Chrome, Edge, Firefox; **Navi Linux**: Ubuntu
26.04 aarch64 with Chromium, Firefox), each browser holding Navi v12.19, the **checker** userscript 0.3.2 and the
owner's sign-ins on the five sites. A **runner** on the Mac starts a VM, pre-checks each browser (a local page and
`https://example.com/`, visible at >= 20 fps, the report through the real manager), opens each site's 3-question test
chat the way a bookmark would, waits for the checker's report at the **receiver**, closes the browser normally, applies
the stop rules, posts one Discord message and shuts the VM down. Experiment 1's results say the design works end to
end and no site objected; the checker itself is **not yet calibrated** (its jump failures are unconfirmed), and the
structure captures show the CI's mock pages stale on all five sites.

---

## B. What was accomplished

Times are UTC unless marked CST. Context tags: **[live]** a real site in a real browser and manager, the test
account; **[local]** the receiver's local pages only, no AI site; **[mock]** Playwright on the repo's mock pages; **[desk]**
read-only reading of v12.19's source and the docs. Every measurement's full context is in DEC-065.

### 1. The spec arrives (2026-11-16 21:14-21:24Z)
- **What:** the state check matched the prior handoff (nothing changed since 2026-11-12). The owner's first message
  had no attachment (856 characters); the second paste was another terminal's screen with the spec collapsed
  ("[...Truncated text #4 +333 lines...]"); the full text came in the third. Committed verbatim as
  `docs/specs/live-test-system-spec.md` (`6911977`).
- **The owner's setup, done before the session (2026-11-16):** the private repo, a test Gmail with free accounts on all
  five sites, Discord (server "Navi Admin", channel `#navi-alerts`, webhook "Navi Live Test", URL in the Keychain as
  `navi-discord-webhook`), UTM with "Navi Windows" and "Navi Linux".
- **The spec's shape** (owner decisions 1-11, DEC-065): three pieces (the public navigator; a checker of outcomes; an
  admin build generated from the public source), 40 runs per cycle (5 sites × 8 browser/OS cells), Phase A all on the
  Mac with the VMs in every cycle, a 04:00 schedule, canaries and a live-send check, auto-merge built and off,
  the name "Navi" for every new thing (never the userscript's `@name`/`@namespace`).

### 2. Phase 1, read-only desk research (2026-11-16 21:25Z to 11-17 00:02Z) [desk]
- **What:** a workflow wrote, in the private repo (`960eca2`): `docs/check-inventory.md` (159 checks, the spec's 10
  starters as 38 sub-checks), `canaries/questions-draft.md` (116 questions), `docs/check-inventory-review.md` (a critic:
  1 blocker, sentinel bookmarks required by a spec Gate; 15 should-fix) and `docs/owner-sitting-brief.md` (22
  decisions). Three reconciliation passes, then polishing stopped.
- **The owner's choice (asked, 2026-11-16):** the live read of Navi's markers happens later in the test profiles,
  never in the owner's personal Chrome (the owner had opened an Incognito window for privacy).
- **Status:** never reviewed by the owner; the redesign superseded the canaries, live-send and scratch chats. The
  inventory stays the reference list for the calibration (status notes added on top of the four files).

### 3. Stage 0: the VMs, the test user, the automation paths (2026-11-16/17) [local, then live]
- **Windows VM** (QEMU): UTM's guest agent runs as SYSTEM at the login screen, so OpenSSH was installed without a
  sign-in (key `~/.ssh/navi_lab_ed25519`, key-only; the firewall rule had to cover the Public profile); automatic sign-in
  through the LSA secret, **proven from a cold start** (signed-in desktop at +23 s); time zone Central (it was "Easter
  Island", next to Central in the list); Windows' "Get Started" first-run window turned off; shutdown from inside, then
  the window closed by its button. **The "stopped by itself" at ~22:40Z** was a start that never booted (System log by
  record order); the agent's wait loop had printed "SSH up after 220 s" unconditionally. Helpers since fail loudly.
- **Linux VM** (Apple Virtualization): its view drops every synthetic modifier key (`Ab1!@` arrived as `ab112`), so the
  SSH bootstrap was the owner's one `curl … | bash` line; automatic sign-in proven (+16 s); a sudoers rule for
  `systemctl poweroff -i` / `reboot -i` only (GNOME refuses a shutdown while signed in); Chromium needs
  `--password-store=basic` (the keyring stays locked after automatic sign-in); Firefox snap refreshed 154 → 160.
- **Both:** clipboard sharing off (the agent's, matching the spec's "sharing off"; the owner agreed); **`utmctl` is never
  polled** (each call brings UTM forward, which the owner saw as UTM "firing up and shutting down"; the agent's
  practice, which the owner told it to keep).
- **The macOS test user "Navi Test"** (created by the owner 2026-11-17 02:43Z, uid 503, Standard): a LaunchAgent job
  runner in its session; jobs dropped by the owner's account into `/Users/Shared/navi-lab/jobs/inbox`; outputs read as
  data only. FileVault is on, so every cycle checks the session and the Discord line says "Mac: Navi Test not signed in,
  Mac cells skipped" (all four branches measured). **The boundary proof** found the owner's home readable by the test
  user (mode 755: `~/.docker/config.json`, `~/.claude`, `~/.gemini`, Desktop, Documents): the agent recommended
  `chmod 700 ~`, which the owner ran (confirmed 2026-11-19).
- **Safari paths:** `safaridriver` sessions start with an empty cookie store every time, so the AppleScript path in a
  normal window was chosen under the spec's rule (later superseded by the redesign); a script file written into
  Userscripts' folder (`~/NaviLab/userscripts`, the agent's choice; the owner set it in the picker) ran with no click
  (measured with Navi Test on console).
- **Tampermonkey:** Firefox installs with no click through geckodriver; Chrome's Web Store install needs the owner's
  two clicks and "Allow User Scripts".
- **The sites under automation (2026-11-17 03:47-04:05Z) [live]:** ChatGPT, Gemini, Grok and Perplexity signed in on
  every path (Chrome WebDriver left ChatGPT on Cloudflare's page); **claude.ai showed Cloudflare's challenge on every
  measured Chrome path and on Firefox WebDriver**, stricter after ~10 visits. The agent stopped and asked. **The
  owner's decision (dated 2026-11-16 local):** no automated claude.ai access on any path (Anthropic's Consumer Terms §3;
  "an unchallenged path doesn't make it allowed"); the other four paused pending a terms review. **The terms review**
  (two agents per site; private `docs/site-terms.md`): all five restrict automated access (ChatGPT unclear, leaning
  prohibited); table in DEC-065.

### 4. The redesign (the owner, 2026-11-17 20:41Z) — `docs/specs/live-test-system-redesign.md`, `9d146de`
Ten decisions (DEC-065): the owner starts every session and is present (no schedule, timer or automatic wake); the
matrix is unchanged (40 runs); a run = the runner opens the test chat in a normal browser, a checker userscript checks
outcomes and reports to a receiver on the Mac, the runner closes the browser; no WebDriver, remote debugging or agent on
an AI site; nothing hidden (no stealth, no challenge solving; a site that objects stops); read-only (the owner makes
every test chat by hand); Claude included with a stop rule (the owner asks Anthropic for permission separately); a
session's length doesn't matter; the CI against copies stays, kept current from live structure captures (decision 8);
the fix loop unchanged in spirit; later: health checks inside Navi, a remote data file, "context window not known yet".
**Experiment 1:** one page load per site per browser in stages A (Mac), B (Windows VM), C (Linux VM), each on the
owner's "go"; stop rules; what to bring back (the table, durations, drift, manual steps, Discord, a recommendation).

### 5. Experiment 1 preparation (2026-11-17 20:42Z to 11-18 04:36Z) [local, mock]
- **Built** (private repo): `exp1/receiver.js` (127.0.0.1 and 192.168.64.1, port 8790; one-shot claims; validated
  reports stored as data), `exp1/navi-checker.user.js` 0.2.0 (`8b99ceb`: load, navigate, one jump, one bookmark made,
  read back and deleted; sign-in/challenge/warning signals; the page structure with text replaced by filler; clicks only
  on Navi's UI; adversarial review's 2 blockers and 6 should-fix fixed; 17 mock runs per engine pass), `exp1/run-stage.js`
  (`2e69ebb`), Tampermonkey by browser policy in the Windows and Linux VMs.
- **Where the Mac's browsers render** [local, Navi Test in the background]: Safari 24/48/48 fps and Firefox 48/48/48,
  visible; **Chrome 4/8/8, turning hidden**. With Chrome's three occlusion switches: 54/53/54. **The owner's decisions
  (2026-11-17):** the switches are acceptable ("they change nothing a site can identify"; cells labelled "background
  session, occlusion switches on"); Stage A in Navi Test; nothing in the owner's account or with Navi Test active; the
  owner builds a macOS VM, "Navi Mac", to evaluate in parallel.
- **Navi Mac evaluated** (2026-11-18 02:36-03:09Z) [local]: all three browsers visible with no switches, even with the
  window minimized; cold start 18 s; the owner set it to 6 GB (the agent edited the config at the owner's request).
- **The owner's test chats:** one per site in Navi Test's Safari, three questions each (`NAVI-T1` to `T3`); addresses
  kept only in the untracked `local/exp1/chats.json`. Perplexity's chat lives at `/session/<id>`, which v12.19 does not
  recognise (expected drift).

### 6. Stage A in Navi Test, and Safari's background rendering (2026-11-18 04:37-17:21Z)
- **The run** (`exp1-A-2026-11-18T0437`) [live]: 6 of 15 cells, then **the agent paused the runner** (04:50:37Z): two
  Safari cells lost to the runner's 180 s cap (shorter than the checker's 300 s deadline), Chrome / Claude sent no
  report, Safari's pages reported hidden. No stop rule fired. **The owner's decision ("Option 4"):** stop Stage A there;
  before any further site visit, fix the cap, prove the local round trip under the real managers, explain Safari's
  hidden pages, and **make the local round trip a required pre-check for every browser before any site visit**.
- **Found [local]:** the cap is now 420 s; Chrome's missing report was the agent's fault (launchers it had given the
  owner put the installs into copied profiles the runner no longer used; launchers deleted); Userscripts ignores an
  `@match` with a port (checker 0.3.1); the pre-check is built into the runner (checker 0.3.0); `--cells` opens exactly
  the approved cells.
- **Safari in background Navi Test draws hidden at 0 fps**: WebKit marks a page hidden while its window is occluded, and
  macOS occludes an off-console session's windows within ~160 ms. Hypotheses tested and **refuted**: who created the
  window; an on-console launch (9/9 hidden); "busy at the switch", the owner's idea (4/4 hidden). The 2026-11-17 visible
  runs (Safari process 53256) stay **unexplained**; that process also read hidden two minutes after its launch, so it
  became visible later (sleep/wake or the dock are the leading candidates). A read-only research workflow ranked them.
  The agent stated two causes before testing them; both corrections are recorded.
- **The owner's decision (2026-11-18 17:21Z):** "I'm done with Safari testing in Navi Test. The Mac's cells move to the
  Navi Mac VM." No lock, display-sleep, dock or sleep tests. Navi Test frozen (state and a repro script recorded); the
  two copied profiles deleted; an example.com probe added to every pre-check; 10 Claude loads accepted.

### 7. Navi Mac preparation (2026-11-18 17:25-20:49Z) [local, example.com]
- **Userscripts installed by copying the app** from this Mac (`ditto`, signature intact, no Apple Account); the owner's
  four clicks enabled it. A new script runs only after Userscripts rebuilds its index, which (from its v4.8.6 source)
  happens on install or when a Safari window gains focus, not on the popup click: the runner does
  `open -a Finder; open -a Safari`.
- **Checker 0.3.2** (`f2928b0`): the example.com probe.
- **Never force-close a browser:** a Safari killed with `killall` restored and reloaded its last tab at the next start;
  every browser now quits normally (the quit Apple Event). The VM locked itself after 20 idle minutes (macOS 26's screen
  saver; Chrome's pages went hidden): idle time 0, sleep 0.
- **The owner's 15 sign-ins**, then **"the VM browsers were slow and laggy"** (the owner): measured, the Mac had
  compressed or swapped out almost all of the idle VM (6.18 GB footprint, 0.17 GB resident; 1 GB touch 1.44 s cold vs
  0.16 s warm). The agent's first "not tight" was wrong and is corrected. After the owner signed Navi Test out and moved
  the VM window to the built-in screen, macOS still compresses an idle VM (normal behaviour); the stage is unaffected
  (cold pre-check 12-17 s, 58-61 fps). VM stays at 6 GB.

### 8. Stage A in Navi Mac (2026-11-18 20:49-20:59Z, `exp1-A-navimac-2026-11-18T2049`) [live]
15 of 15 accepted, pre-checks 6 of 6, 9 min 54 s. ChatGPT's jump failed in all three browsers (Navi's "not currently
rendered"; Chrome 9 px above the view); Chrome / Grok landed 144 px above the view; Perplexity's bookmark had no key
(`/session/`); Safari / Claude's jump was skipped (window reported covered for 33 s). **The owner's decision
(2026-11-18 21:27Z):** "no fine-tuning of the checks now, and no Navi fixes. We build the whole pipeline first
(Windows, Linux, the full session, the fix loop, the CI), then calibrate the checks, then run it as if for the first
time." The jump findings are "found by an uncalibrated checker, not confirmed" (by hand, in the owner's own Safari,
ChatGPT's and Claude's jumps work; in Chrome, Grok's works); Perplexity's is a probable real bug, **reserved as the
first end-to-end test of the finished pipeline**. The owner's two notes for the calibration: the test chats are too
short (they fit one screen), and the checker acts too fast (wait for load, retry like a person, judge with tolerance;
Grok's first click after load needed a moment).

### 9. Stage B, the Windows VM (prep 21:28-21:44Z; run 22:36-22:48Z, `exp1-B-2026-11-18T2236`) [live]
Prep: display-off and sleep timers to never; **Firefox had registered itself to start at every Windows sign-in**
(removed; a Firefox setting stops it); the runner's Windows stage (open and close through tasks in navi's session,
`taskkill` without `/f`). The owner's steps (Allow User Scripts, installs, 15 sign-ins; "don't check the state right
after the click"). Run: 15 of 15 accepted, 11 min 29 s; ChatGPT refused in Chrome and Edge, landed in Firefox; Grok
144 px above in Chrome and Edge.

### 10. Stage C, the Linux VM (prep 23:02-23:10Z; runs 2026-11-19 01:34-02:08Z) [live]
- Prep: GNOME's idle blank, dim and screen saver off; Chromium's menu entry given `--password-store=basic` so the
  owner's sign-ins land in the store the runner reads. The owner also reported Navi's button hard to see under "auto"
  appearance on ChatGPT (ROADMAP item 15).
- **First run stopped** (`…T0134`): the owner unplugged the USB-C dock at 01:34:51Z, Chromium's viewport went 763 →
  1,645 px; the owner judged it inaccurate. **Full re-run on the owner's choice** ("as if I just finished setting it
  up"; 12 Claude loads): Chromium 5 of 5 accepted; **Firefox's example.com probe got no report, so the pre-check blocked
  all five Firefox cells** — Firefox's "closed unexpectedly while starting… Troubleshoot Mode" prompt, which the owner
  saw on screen, caused by the agent's rapid open/quit cycles (`recent_crashes` 4 > 3). **Fix in all three VMs**
  (`toolkit.startup.max_resumed_crashes` -1), verified. Navi Mac's macOS "reopen apps" list was starting Firefox at boot:
  removed. **The five Firefox cells, on the owner's go** (`…T0205`): 5 of 5 accepted, 2 min 18 s.

### 11. The report (2026-11-19 02:10Z) and after
- **40/40 accepted, 22 all-pass; durations 9 min 54 s + 11 min 29 s + 3 min 58 s + 2 min 18 s = 27 min 39 s** (runner
  start to VM shutdown; the VMs were already running); drift per site; manual steps and which recur; 4 Discord
  messages (three wording bugs, fixed). **The agent's recommendation: go, with changes** (calibrate; CI copies from
  captures; harness lessons permanent; cut recurring clicks; keep Navi Mac; Perplexity as the fix loop's first test).
  The owner's order (pipeline first) stands over the agent's.
- **Keeping the scripts current (discussion only):** the owner asked whether the agent could install updates itself
  by typing or clicking; the agent explained why not (the Apple VM views drop Shift; clicks would take over the owner's
  desktop) and the owner chose Tampermonkey's own updates at the most frequent setting. Advised: "Userscript Update"
  every 6 hours and "Externals Update Interval" always in the seven VM Tampermonkeys (not reported as set). Neither
  script has `@require`, `@resource`, `@updateURL` or `@downloadURL` (the agent first said Navi had one: wrong).

### 12. Context, docs and handoff (2026-11-18 05:53Z; 2026-11-19 02:44Z onward)
- The context was compacted twice (the owner, 2026-11-18 05:53Z; by accident 2026-11-19 02:44Z); each time the agent
  re-read the session's whole transcript, the memory and the canonical docs before continuing.
- **`/update-project-docs`** (the owner named it, 2026-11-19): DEC-065's "Where this stands" block, the Phase 1 and
  terms sections, the boundary finding, the standing harness rules, the recommendation and a corrections section;
  CHANGELOG; 17 TROUBLESHOOTING entries; DOM-REFERENCE's November 2026 subsections for all five sites; ROADMAP item 5
  and items 16-20; TESTING.md and `agent_docs/testing.md`; in the private repo the README, `docs/runbook.md`,
  `docs/experiment-1-results.md`, `docs/exp1-structure-drift.md` (`bc4844b`). Four drafting agents worked from the
  files on disk; six audit agents then checked every fact in the transcript against both repos, and every finding was
  fixed or recorded (several were real errors in the earlier record, kept as corrections next to what they correct).
- **`/baton-handoff`** (this file): the skill no longer asks about other channels (the owner's instruction).

### 13. Mistakes, kept because they generalize (proposed for `agent_docs/conventions.md`; the owner has not decided)
- **A hypothesis that fits the logs was reported as the cause before a run decided it** (Safari's on/off-console
  launch; refuted within the hour). Label an idea untested until a run decides it.
- **A test read in the wrong process or profile:** the "owner's window" test ran in a Safari the agent's script had
  started; the launchers sent the owner's installs to profiles the runner did not use. Check which process or profile a
  test actually ran in before reading its result.
- **"Unreadable" reported where the read was a true absence** (Tampermonkey storage before Stage A). Verify a negative
  read with a positive control.
- **Frame rates on an empty page and a VM's resident size were read as "not tight"**; the owner's experience of lag was
  the better evidence. Responsiveness needs its own measure; a VM's memory is its footprint.
- **Harness faults of the agent's making:** a cap shorter than the work's deadline; force-closing a browser (session
  restore reloads); rapid open/quit cycles (Firefox's startup-crash prompt); a process match by command line that
  matched the agent's own shell; a wait loop that printed success after timing out (twice).
- **Synthetic keystrokes carried a secret** (the Linux VM's password, twice, 2026-11-16) before the owner's rule.

---

## C. Architecture snapshot

The userscript: unchanged (v12.19; DEC-063, DEC-064). The live test system as it stands (private repo, branch
`phase-a/stage-0`):

```
this Mac (owner's account)                          a VM (user navi, signed in automatically)
  exp1/run-stage.js  ── SSH: open page normally ──▶  browser + manager + Navi v12.19 + checker 0.3.2
       │  arm / disarm (control key)                     │ GM_xmlhttpRequest (one-shot claim, one report)
       ▼                                                 ▼
  exp1/receiver.js  ◀── 127.0.0.1 / 192.168.64.1:8790 ── checker: load, navigate, jump, bookmark,
       │  local/exp1/results/<runId>/*.json + structure     signals, structure (text → filler)
       ▼
  table + one Discord message (webhook from the Keychain); VM shut down from inside, window closed
```

- **Stages:** `A` (Navi Test, frozen), `A-navimac`, `B` (Windows), `C` (Linux); options `--precheck-only`, `--keep-vm`,
  `--cells`, `--browsers`, `--dry-run`, `--mechanics`, `--precheck-host` (runbook §4).
- **Per cell:** quit the browser, arm, open, wait up to 420 s, close normally, memory sample, stop rules.
- **Not built yet from the spec:** the admin build, the baseline, the fix loop and its Routine, the CI against copies,
  the full checker (DEC-065's inventory), auto-merge (off).

---

## D. Key principles established

DEC-065's "Standing harness rules" is the full list. In short:
- **The owner's (2026-11-17/18):** attended sessions only; one page load per site per browser per stage, no reloads, no
  retries, no re-run without the owner's go; stop rules per site; **no site visit in a browser before it passes the
  pre-check** (local page + example.com); nothing hidden from the sites; read-only; no Navi fixes or check tuning until
  the pipeline exists; the owner makes the test chats; Claude's visits capped per experiment by the owner.
- **The agent's practices (from measured failures):** never force-close a browser; quit before each cell; no browser
  may start by itself (Windows Firefox autostart, Navi Mac's reopen list); Firefox's Troubleshoot prompt off; no idle
  lock, blank or sleep in any VM; the display unchanged during a session; the cap longer than the checker's deadline;
  `--cells` for partial runs; no probing a VM mid-cell; `utmctl` never polled; VM waits fail loudly.
- **A result of an uncalibrated checker is a lead, not a finding** (the owner, 2026-11-18).

---

## E. Git state

**Public repo** (`ai-conversation-navigator`): `main` was at `d3f3d16` (PR #95) all session; **PR #96** merges this
branch into it (docs only, the owner's request, 2026-11-19), after which `main` holds everything below.
- **Current branch: `ci/live-verification-layer`**, cut from `d3f3d16`: `d6bddbd` (the prior handoff), then this
  session's docs only (35 commits, each pushed as it was written): the spec `6911977`, the redesign `9d146de`, 32
  DEC-065 drafts (`1f33619` … `c1b1062`), ROADMAP item 15 `1fd9b48`; then the docs-pass + handoff commit (this file, the prior handoff archived
  unchanged, CHANGELOG, DECISIONS, TROUBLESHOOTING, DOM-REFERENCE, ROADMAP, TESTING.md, `agent_docs/testing.md`;
  `9d5b645`, which replaced three commits so the user name is not in the branch's new history); `d9389e5` (the archived
  v12.19 path); this sync note. Pushed; PR #96.
- **The owner's untracked files: never `git add` them:** `.playwright-mcp/`, `docs/CONTEXT-TRACKING-AUDIT.md`,
  `docs/IMAGE-GALLERY-DOM-FIX.md`, `docs/V10.10-TASKS.md`, `docs/V10.11-TASKS.md`; the stash `stash@{0}` is theirs.

**Private repo** (`ai-conversation-navigator-private-lab`): branch **`phase-a/stage-0`**, `22b4465` (initial) …
`2eb2d8a` (the last tooling commit) → **`bc4844b`** (the docs). Pushed; `main` fast-forwarded to `bc4844b` (the
owner's request, 2026-11-19); no PR. Its files may name local paths with the user name (private repo).
`local/` is git-ignored and holds the raw results, captures, logs, `chats.json` (the test chat addresses) and
`control.key`; never commit it.

**`vibecoding-loadout`** (the owner's skills repo): `skills/baton-handoff/` edited at the owner's request, uncommitted;
an unrelated `claude/settings.json` change there is the owner's.

---

## F. Files for next session

| Path | Why |
|---|---|
| `HANDOFF.md` | this file |
| DEC-065 ("Where this stands" first; "Standing harness rules"; "Corrections and additions") | every decision and measurement of the live test system |
| `docs/specs/live-test-system-spec.md`, `docs/specs/live-test-system-redesign.md` | the owner's spec and the redesign that supersedes parts of it |
| TROUBLESHOOTING, "THE LIVE TEST SYSTEM" group (17 entries) | each problem's debugging story |
| DOM-REFERENCE, each site's "November 2026: Experiment 1's structure captures" | the live structure, for the CI copies and selector work |
| ROADMAP items 5, 15-20 | status and the logged follow-ups |
| private `README.md`, `docs/runbook.md` | how to run and maintain the pipeline (machines, receiver, checker, runner, gotchas) |
| private `docs/experiment-1-results.md`, `docs/exp1-structure-drift.md` | the per-cell record; the drift per site |
| private `docs/check-inventory.md` | the reference list of checks for the calibration |
| private `exp1/` | the receiver, checker, runner and per-VM scripts |
| `~/.claude/projects/<this project's folder>/navi-live-test-resume/RESUME.md` (on this Mac) | the resume pack (machine-local; the repos are the truth) |

---

## G. What comes next

### 1. Wait for the owner's plan for the rest of the pipeline
The owner (2026-11-19): "I'll come back with the plan for the rest of the pipeline." **Do not start from guesses.**
The owner's order so far (2026-11-18): build the whole pipeline (Windows, Linux, the full session, the fix loop, the
CI), then calibrate the checks, then run it as if for the first time. When the plan arrives, a read-only Phase 1
first, measure before reasoning, and the owner decides before changes. Inputs the plan will likely need, all recorded:
- **The CI against copies** (redesign decision 8): the 40 structure captures and the per-site drift (DOM-REFERENCE,
  private `docs/exp1-structure-drift.md`); the redesign file names "one site's copy built from the captured structure,
  proven with planted bugs" as the next experiment.
- **The fix loop's first end-to-end test:** Perplexity bookmarks on `/session/` chats (ROADMAP item 16; v12.19's index
  adapter matches `/search/` only).
- **The calibration list:** longer test chats on all five sites (designed with the full check list), wait for the page
  to finish loading, retries the way a person would, landing tolerance, Grok's first-click behaviour; the code-level
  gaps found in the docs pass (a site stop holds only within one run; the account-message stop and Claude's cap are not
  in code; "signed out" whenever Navigate counts 0; two unused helpers that still force-kill) — DEC-065 corrections.
- **Recurring clicks to cut:** checker updates in the seven Tampermonkeys (an update URL on the receiver, a version
  gate in the pre-check, perhaps a shell + `@require`); measure how long sign-ins last.
- **Harness items proposed, not built:** a boot-time "no browser running" check; the VM's viewport and screen size in
  the pre-check; a Windows Update policy in Navi Windows; checking Navi Windows' WebDAV sharing mode.

### 2. The owner's open steps
Codex review on the private repo (steps in DEC-065, "Open with the owner"); Tampermonkey's update settings in the seven
VM Tampermonkeys; a re-check of Navi Mac's reopen list after its next stage; deciding on the lessons in §B.13 for
`agent_docs/conventions.md` (and whether CLAUDE.md's measurement-context list should name "which macOS session the
browser runs in"); whether to delete `/Users/Shared/navi-chats.txt` (the five test chat addresses, readable by every
local user; the agent left it).

### 3. Grok on all three browsers (ROADMAP item 6)
After the pipeline, unless the owner says otherwise. New input: Grok's page was rebuilt; v12.19 finds its questions
only through its last-resort rule, and Chrome/Edge land its jump 144 px above the view (uncalibrated).

### 4. The consolidated acceptance pass at about v12.20 (DEC-062)
Unchanged. This session added no acceptance steps (no userscript change).

### 5. Logged for later (ROADMAP), unordered
ROADMAP items 15 (light/dark under "auto"), 17 (the jump findings), 18 (stale mocks), 19 (the "Navi" rename; never the
`@name`/`@namespace`), 20 (the redesign's later list); everything in the prior handoff's §G.4.

---

## H. Operational context + owner rules

Carried over, still in force:
- **Equal priority:** Safari, Chrome and Firefox (DEC-047). Acceptance results go in DEC-031 only, exactly as reported.
- **Merges:** only on the owner's explicit OK for that PR (public and private alike); never push to `main`. Re-run a
  stalled job, never override; the owner changes the ruleset. `ci-ok` is `main`'s one required check.
- **Live work in the owner's accounts is read-only**; any POST counts as sending. Chats by id prefix only in public.
- **CLAUDE.md:** show the diff, commit only on approval; its lines are rules. **Archived handoffs** are never edited.
- **Scope:** findings outside the task go to ROADMAP or TROUBLESHOOTING. Ask before a long run, with an estimate.
- **Every claim carries its measurement context** (now also: OS, browser, manager + version, Navi version, account tier).
- **Skills** (`/babysit-pr-cycle`, `/baton-handoff`, `/update-project-docs`): only when the owner names them.
- **Git:** explicit `git add` paths, never `-A`; never the owner's untracked files. Port 8765 is the owner's.
- **No machine paths with the user name in the public repo** (the agent's practice, after the owner asked for the
  user name's removal, 2026-11-19): name `~/.claude/projects/...` folders generically (`<this project's folder>`).
  Commits use the owner's GitHub noreply address from now on (the owner's choice, 2026-11-19).

New this session (the owner's, 2026-11-16 to 11-19; DEC-065 has each with its date):
- **No screenshots of the owner's screen or account without asking;** only VM windows (by window id) or the test user.
- **Never type a secret through synthetic keystrokes into a window on the owner's desktop**; a typed password is the
  owner's step. **Never automate a sign-in.**
- **Nothing runs in the owner's personal browsers or accounts** unless the owner asks for it at that moment.
- **Nothing about the test accounts in either repo** (no email address, password, cookie, session file, webhook URL,
  chat address or chat content); secrets live in the Keychain.
- **The security boundary:** nothing the owner's account runs may live in a folder the test user can write; the test
  user's outputs are data, never executed.
- **The redesign's rules** (§B.4, §D): attended, normal browsers, nothing hidden, read-only, stop rules, one load per
  cell, the pre-check gate, no re-run without the owner's go, example.com only as the probe.
- **No Navi fixes and no check tuning until the pipeline is built; Navi v12.19 and checker 0.3.2 frozen.**
- **Code for the live test system goes in the private repo; only public docs go on the public branch.**
- **Keep a resume pack outside `/tmp` and push often** (the Mac sleeps and travels).
- **The handoff covers this Claude Code session only** (2026-11-19): `/baton-handoff` never asks about other channels.

---

## I. Deferred / future work

Not queued; §G comes first.
- **From the first spec, superseded or waiting:** the admin build and its diagnostics, the baseline and "no new
  failures", canaries (now hand-made by the owner), the daily summary, auto-merge (built off), Phase B (the Windows PC
  and the DGX Spark as the main testers, the VMs as stand-ins), an x86_64 Linux with Google Chrome.
- **The Safari-in-Navi-Test question:** the untested candidates (lock/unlock, display sleep, the dock replug, a real
  sleep) and a repro script (`stage0/mac/27-safari-hidden-repro.sh`); the owner ended that line (2026-11-18).
- **The redesign's later list** (ROADMAP item 20) and the product rename (item 19).

---

## J. Risk caveats / known limitations

- **The checker is uncalibrated.** Its jump results disagree with the owner's hand checks and with themselves (Linux
  Firefox's ChatGPT jump passed once and failed once). Never report them as Navi failures before the calibration.
- **3-question test chats prove little about Layer 4** (virtualization): three sites show signs of windowed lists that
  such short chats cannot exercise.
- **`npm test`'s mocks are stale on all five sites:** green mock runs exercise paths the live sites no longer take, and
  several sites hang on one working selector (DOM-REFERENCE). CI stays mock evidence.
- **Site terms:** all five restrict automated access; the design rests on the owner being present and starting every
  session. A challenge or notice stops that site; an account message stops everything.
- **This Mac's memory (16 GB):** macOS compresses an idle VM out of RAM; using a VM by hand lags at first. One VM at a
  time.
- **Display changes spoil a session** (the dock unplug); nothing in the pre-check catches it yet.
- **Windows Update can restart Navi Windows mid-session** (no policy set). **Navi Windows' WebDAV sharing mode** is
  unchecked.
- **Sign-ins can lapse** (40 across the VMs): the checker's signed-in signal would show it; how long they last is
  unmeasured.
- **Navi Test is frozen, not torn down:** its profiles hold the test logins; it is signed out.
- **Merged without acceptance:** v12.15-v12.19 (unchanged; the consolidated pass at about v12.20).

---

## K. Kickoff prompt for the next session

```
Pick up AI Conversation Navigator from the handoff at HANDOFF.md on the branch
ci/live-verification-layer (2026-11-19: the live test system's Experiment 1 is
complete — 40/40 live page loads accepted, no stop rule; next: my plan for the rest
of the pipeline).

CLAUDE.md auto-loads. Read HANDOFF.md before touching anything, especially §G (what
comes next), §H (owner rules) and §J (risk caveats), then DEC-065 ("Where this stands"
first, then "Standing harness rules"). The tooling is in the private repo
../ai-conversation-navigator-private-lab (branch phase-a/stage-0): read its README.md
and docs/runbook.md before running anything there.

FIRST, CHECK STATE — do not assume:
  git fetch origin
  git log --oneline --first-parent -3 origin/main
  git branch --show-current && git status --short
  gh pr list --state open
  git -C ../ai-conversation-navigator-private-lab log --oneline -1
main should be the merge of PR #96 (docs only, 2026-11-19), with
ci/live-verification-layer even with it; you should be on that branch, plus my five
untracked files, never added. The private repo's phase-a/stage-0 and main should both
be at bc4844b or later. No PR should be open. All three VMs should be off. If that is
not what you see (for example PR #96 still open), stop and tell me.

THIS SESSION: wait for my plan for the rest of the pipeline. Do not start from guesses.
When it arrives: a read-only Phase 1 first, measure before reasoning, and wait for my
decision before changes. Navi v12.19 and checker 0.3.2 stay frozen, and no Navi fixes or
check tuning, until the whole pipeline is built. Code goes in the private repo; only
public docs go on this branch.

LIVE SESSIONS (DEC-065): I start every session and stay. One page load per site per
browser per stage, no reloads, no retries, no re-run without my go. A browser gets no
site visit before it passes the pre-check (local page + example.com). Stop rules: a
challenge, forced sign-out, warning or unusual-activity notice stops that site
everywhere; an account message about automated use stops everything. Never force-close
a browser. Nothing hidden from the sites; nothing sent; I make the test chats.

ACCEPTANCE (DEC-062): one consolidated pass at about v12.20. Safari, Chrome and Firefox
are equal priority (DEC-047). My own browsers: Chrome has 12.19 (597ebfe), Firefox 12.14.

DO NOT:
- Merge anything without my explicit OK for that PR, or push to main.
- Visit an AI site, start a live session or start a VM's browsers on a site without my go.
- Take screenshots of my screen or account without asking (VM windows only).
- Type a secret through synthetic keystrokes, or automate a sign-in.
- Run anything in my personal browsers or accounts unless I ask at that moment.
- Put anything about the test accounts in either repo (no email, password, cookie,
  webhook URL, chat address or chat content).
- Report an uncalibrated checker's failure as a Navi failure.
- Commit a CLAUDE.md change before I approve the diff.
- Credit me with a decision you made: say whose it was, with the date.
- Turn a one-time call of mine into a rule or a memory unless I say so.
- Fix findings outside the task's scope. Log them to ROADMAP or TROUBLESHOOTING.
- Add long verification runs without asking first, with a time estimate.
- Edit an archived handoff (docs/handoffs/).

RULES: execute and narrate. Explicit `git add` paths, never -A; never add my untracked
files (HANDOFF §E). Port 8765 is mine. Take times from a clock. Every claim carries its
measurement context. Keep the resume pack outside /tmp and push often. If the context
gets compacted, re-read the session's transcript before continuing.
```
