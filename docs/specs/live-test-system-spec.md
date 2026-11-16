Start the live test system for AI Conversation Navigator. The public repo is at `d3f3d16` (PR #95 merged; v12.19 is the published build). This spec replaces "spec 1, the built-in self-test" from the 2026-11-12 handoff: the owner rejected a built-in self-test in favour of the three-piece design below. The admin testing tooling lives in a NEW PRIVATE repo; everything else stays in the public repo as always. This work changes no navigator code unless Phase 1 proves a change is needed (then stop and ask).

Where things go (two separate repos side by side on disk, never one inside the other):
- **Public repo `ai-conversation-navigator`, as always:** all navigator code, docs, specs, reviews and PRs, including every fix PR the fix loop opens. This spec goes in `docs/specs/` as usual (it holds no account details). The public docs for this work (the new DEC, ROADMAP, HANDOFF) go on your existing branch `ci/live-verification-layer`, together with its handoff commit `d6bddbd`.
- **Private repo `ai-conversation-navigator-private-lab`, next to it on disk:** ONLY the admin testing tooling (checker, runner, admin-build step, orchestrator, baseline, canary manifest), on its own branches and PRs. Work in both from one session (start in the parent folder, or add the second folder to the session).

First steps:
1. **The owner setup is being done with Claude chat before this session starts:** the private repo, the test Gmail and site accounts, Discord (server "Navi Admin", private channel `#navi-alerts`, webhook "Navi Live Test") with its webhook URL in the Keychain (service `navi-discord-webhook`), and UTM with the `Navi Windows` and `Navi Linux` VMs on the Mac (all done 2026-11-16). My Windows PC and DGX Spark are NOT part of this build: see decision 11, they join in a later phase. I'll tell you what's done. Give step-by-step instructions only for what remains: one-time logins in the profiles you prepare, Safari's Develop-menu settings, and enabling Codex review on the private repo.
2. **Phase 1's read-only inventory** of the navigator's markers can start in my own Chrome on my existing chats (read-only; confirm the installed version first, as you planned), together with the check inventory.
3. **Then Stage 0** in the test setup, never in my personal browsers.

This spec's decision rules govern: where a rule says "record it as the agent's decision and continue", continue; stop only where it says "stop and ask". My personal Chrome (12.19) and Firefox (12.14) installs don't matter to the test system, whose profiles get their own installs. Firefox's update is only for the consolidated acceptance pass.

Standing rules (HANDOFF §H), plus the ones this work adds:
- no merge without my explicit OK (public and private repo alike);
- no CLAUDE.md change without my approved diff;
- explicit `git add` paths; chats by id prefix only in anything public;
- measurement-context labels on every claim (now also: OS, browser, manager + version, navigator version, account tier);
- green CI is never browser evidence;
- **nothing about the test accounts goes in either repo:** no email address, password, cookie, session file or Discord webhook URL. They live in the macOS Keychain or an untracked local file listed in `.gitignore`;
- **live sends only in the test accounts:** the canary chats once at the start (from the question list I approved), and the live-send check's one templated question per cell per cycle. My personal accounts stay read-only, as before;
- **never run code from a fork:** the runner installs only builds from `main` or from branches inside the public repo, opened by me or by Claude's bot;
- project docs (`/update-project-docs`) in the same PR, in whichever repo the code is in.

Process:
- Stages run in order, each with its own gates (CLAUDE.md rule 7); the full suite runs once per stage.
- Stage 0 reports before Stage 1 starts **only if** a decision rule below says "stop and ask". Otherwise record the result as the agent's decision and continue.
- Tier 3 capped at 5 rounds per PR, then GitHub Codex (`/babysit-pr-cycle` when I name it).
- New issues found while building are logged (private repo issues for the test system, ROADMAP for the navigator), not fixed, unless they block this work.
- Keep a resume pack outside `/tmp` and push often: the whole system runs on my MacBook Air, which sleeps and travels.

---

# Spec: the live test system

## Owner decisions (2026-11-12)

1. **Three separate pieces** (supersedes the built-in self-test):
   - **The public navigator**: the only thing users get. It never contains test code.
   - **The checker**: tests *outcomes* (what a user sees) on the exact public build, every cycle.
   - **The admin navigator**: the public build plus a read-only diagnostics layer that sees internals. It is *generated* from the public source by a build step, never hand-maintained, and used only when the checker finds a new failure.
   Fixes always go into the public source. Reasons, in the owner's words: test-only changes must never push updates to users, and an admin mode inside a public script "isn't really admin".
2. **Build the whole system now**, no interim slices: every feature, all 5 sites (Claude, ChatGPT, Gemini, Grok, Perplexity), on macOS (Safari, Chrome, Firefox), Windows (Chrome, Edge, Firefox) and Linux (Chromium, Firefox): **40 runs per cycle** (in this build all on the Mac, see decision 11).
3. **Each OS runs on a real machine the owner already owns — Phase B; in this build the UTM VMs on the Mac cover Windows and Linux (decision 11)** (the owner, 2026-11-12; replaces the earlier plan of Parallels VMs on the Air, which he judged an unnecessary cost):
   - **macOS:** the owner's MacBook Air (Apple Silicon, 16 GB RAM): Safari, Chrome, Firefox. Later a dedicated Mac mini.
   - **Windows:** the owner's Windows desktop (Intel Coffee Lake, AMD Vega GPU; rarely used otherwise): Chrome, Edge, Firefox. Real x86 Windows, closer to what most Windows users run than Windows on ARM. Later possibly a small dedicated Windows mini PC.
   - **Linux:** the owner's DGX Spark (Ubuntu ARM64): Chrome (or Chromium, see Stage 0), Firefox.
   - **Linux runs Chromium, not Google Chrome** (no official Chrome on the DGX's ARM64 Linux), plus Firefox. No Edge on Linux. Reports label it Chromium.
   - **Stand-ins on the Mac, set up first** (the owner, 2026-11-12): **UTM** (free, open source, command-line `utmctl`) runs a Windows 11 ARM VM and an Ubuntu ARM VM on the Mac, so the full matrix can run from the Mac alone while the owner travels. The physical machines stay the main source; the VMs stand in only for a machine that hasn't reported (Stage 4).
   - **Tool preference, in order** (the owner, 2026-11-16): UTM first; VMware Fusion (free, but needs a Broadcom account) only if UTM causes critical problems, such as missing bugs or unreliable starts; Parallels Pro (paid subscription) only if Fusion also falls short. The owner prefers open-source tools where they do the job, and pays only for tools that bring value that can't easily be replicated. Speed and polish matter little: the stand-ins run unattended, early in the morning.
   - **A machine that is off simply skips its runs**, and catches up with one run when it's back on. If it stays off, the Mac's stand-in covers its OS.
   - No cloud machines. Moving to new machines later is `git clone` plus the per-machine setup.
4. **A private GitHub repo** holds the checker, runner, admin-build step, orchestrator and baseline (the owner creates it; named `ai-conversation-navigator-private-lab` by the owner).
5. **One dedicated test Gmail** with free accounts on all 5 sites (the owner creates them). A separate public-contact Gmail comes later, after the extension, and has nothing to do with this work.
6. **Sends in the test accounts:**
   - **Canaries, once at the start:** by Claude Code from a question list the owner approves first, or by the owner by hand from that list if that's faster.
   - **The live-send check, every cycle, in every cell (40 sends per cycle):** one question from a fixed template with a fresh random tag, sent into that cell's own scratch chat. No per-send approval is needed; the template is the approval. The owner's reasoning for including it: a check that will be wanted later is better built now, and one short question per cell is not spam (2026-11-12). Claude chat proposed the template and the per-cell scratch chats.
7. **Discord:** a new private server, private channel(s), for the owner only. Separate from AI Newsroom.
8. **Auto-merge is built and shipped switched OFF.** It turns on only by the owner's explicit setting after a trial period. Big or architectural changes always need the owner. Every cycle sends a Discord message whatever happened, including what was fixed or merged.
9. **Trial labels:** every fix PR states what auto-merge *would* have done ("would auto-merge" or "needs approval, because …"), so the owner can compare those labels with his own decisions before switching it on (Claude chat's proposal, accepted by the owner 2026-11-12).
10. **Naming: the project is now called "Navi"** (the owner, 2026-11-12; "ACN" didn't stick). Use "Navi" for every new name in this work: Discord, Keychain entries, the admin build's name, messages and docs. Existing code identifiers such as the `data-acn-*` markers and the repo names stay as they are. Do NOT change the public userscript's `@name` or `@namespace`: userscript managers identify a script by them, so changing either would break updates for existing users. Renaming the product itself is a separate, planned change; log it in ROADMAP.
11. **Build order: the Mac first, the physical machines later** (the owner, 2026-11-16). This build delivers the complete system — checker, runner, admin build, canaries, baseline, the daily schedule, the fix loop, auto-merge (OFF) and Discord — running **entirely on the Mac**: macOS's own Safari, Chrome and Firefox, plus the UTM VMs as the Windows and Linux environments. In this phase the VMs run in **every** cycle (travel mode is the default), not only as stand-ins: **40 runs per cycle** = macOS 15 + Windows VM 15 (Chrome, Edge, Firefox) + Linux VM 10 (Chromium, Firefox), one VM at a time. The owner's reason: the Mac alone must work while he travels, so it is the solid base; the Windows PC (which has no Claude Code or tooling yet) and the DGX need their own setup. **Phase B, a later spec:** the Windows PC and the DGX join as the main Windows and Linux testers, and the VMs go back to their stand-in role (the stand-in deadline logic in Stage 4). Design everything in this build so Phase B only adds machines: the same runner code, per-environment columns in the baseline, and the stand-in switch already in place.

## The architecture (for reference)

```
THIS BUILD (Phase A), all on the MacBook Air (later Mac mini), one environment at a time:
  macOS                      Safari, Chrome, Firefox    → 15 runs
  Windows VM (UTM)           Chrome, Edge, Firefox      → 15 runs
  Linux VM (UTM)             Chromium, Firefox          → 10 runs
PHASE B (later spec): the physical machines join as the main Windows and Linux testers,
and the VMs become stand-ins:
  Windows desktop            Chrome, Edge, Firefox    → 15 runs   (Windows Task Scheduler)
  DGX Spark                  Chromium, Firefox        → 10 runs   (systemd timer)
Each machine is self-sufficient: the same runner code, a dedicated test user, prepared browser
profiles (release / candidate / admin), its own schedule. It runs its cells, compares them with
the baseline in the private repo, runs the admin diagnosis for its own new failures, pushes its
results to the private repo, files issues and posts to Discord.
Private repo = the meeting point: baseline, results, issues. A small daily summary job (GitHub
Actions in the private repo, Linux runner) posts one Discord summary per day, naming any machine
that hasn't reported ("Windows: no run for 3 days, machine off").
Stand-ins: the Mac also holds a Windows VM and a Linux VM (UTM). If the Windows desktop
or the DGX hasn't reported by the stand-in deadline, the Mac starts that VM, runs that OS's cells,
and shuts the VM down. One VM at a time (16 GB).
Discord: ONE webhook for everything; every message starts with the machine that sent it.
Fix loop: private-repo issue → Claude Code Routine fixes the PUBLIC source → Codex review →
the machines (or stand-ins) whose cells failed re-test the PR build live → Discord.
```

In Phase A the Mac runs everything in sequence: its own browsers, then the Windows VM, then the Linux VM. In Phase B the machines run in parallel, each on its own schedule. **Schedule** (the owner, 2026-11-16; all times are settings, local time): runs start at **04:00**; the stand-in deadline is **05:00**; in Phase A the stand-in deadline doesn't apply, since the VMs run every cycle; the goal is that the owner has the day's Discord result ("all green", "fixed, ready for your OK", or "needs your decision") **by 08:00**. A sleeping or switched-off machine runs once when it next wakes or starts.
- **Waking up for the run:** the Mac wakes itself shortly before the run (this build) (`pmset repeat wakeorpoweron`, for example at 03:55; it can't wake with the lid closed on battery). Phase B: the Windows PC and the DGX should power on by themselves too, even after the owner switched them off: measure the BIOS's daily power-on alarm ("RTC alarm" / "Resume by Alarm") on each, with the PSU left connected. The Windows PC then passes through the OpenCore picker, whose first entry is Windows; its Timeout must not be `0`, so it continues to Windows unattended. After the run, a machine that powered itself on goes back to the state it was in (the owner decides: shut down again, or stay on).

Isolation from the owner's personal data on every machine: a dedicated test user account (Stage 0 item 6), never the owner's own user or browsers.

## Stage 0 — feasibility, measured live (gate for everything else)

Measure each item and record it in the new DEC with its measurement context. Set up only what the measurement needs.

1. **Safari automation with Userscripts.** Does a `safaridriver` session have the owner-installed Userscripts extension active and the test account logged in? (As far as we know, WebDriver sessions may run isolated from normal browsing data.)
   - If not: measure the fallback, AppleScript `do JavaScript` in a normal Safari window (Develop → Allow JavaScript from Apple Events).
   - **Decision rule:** use the first path that runs the navigator logged in. If neither works, **stop and ask**.
2. **Chrome, Edge, Firefox under WebDriver with a prepared, non-default profile:** Tampermonkey active, sessions kept, each site loads normally. Record any bot challenge, captcha or forced logout per site and browser.
   - If a site challenges automated sessions, measure attaching to a normally started browser (remote debugging on the prepared profile) before anything else.
   - **Decision rule:** a site that blocks every path on some browser → **stop and ask**.
3. **Installing a given build without hand clicks**, per manager. Candidates to measure:
   - Safari + Userscripts: writing the file into the app's scripts folder;
   - Tampermonkey: its install page driven by the runner, or an import path.
   Verify every install by reading `data-acn-version` on the page.
   - **Decision rule:** if a manager can't be installed automatically, it gets a one-time manual install per build type, and the report marks it.
4. **Profiles per browser:** can each browser hold three profiles (`release`, `candidate`, `admin`), each with its own manager and logins? Safari's profile support with Userscripts is the open one.
   - Where a browser can't, the runner installs builds into one profile in sequence and restores `release` at the end of the cycle.
5a. **The UTM stand-ins on the Mac** (set up by the owner 2026-11-16: `Navi Linux` = Ubuntu 26.04.1 ARM64, 4 GiB / 2 cores / 64 GiB, Apple Virtualization, user `navi`, hostname `navi-linux-vm`; `Navi Windows` = Windows 11 Pro ARM64, unactivated, 6 GiB / 4 cores / 64 GiB, local user `navi`, UTM guest tools installed, 3D acceleration off; both updated, no shared folders, no personal data; measured: `utmctl list`, `utmctl start "Navi Linux"` and `utmctl stop "Navi Linux" --request` work from the Mac's Terminal. Also measured 2026-11-16: `utmctl start "Navi Windows"` boots it to the login screen within about a minute, but **`utmctl stop "Navi Windows" --request` is ignored** at the login screen, so Windows needs another way to shut down. Neither VM signs in by itself yet.)
   - **Unattended sign-in and shutdown for both VMs:** set up automatic sign-in of `navi` in each VM (the browsers need a desktop session). Shut each VM down **from inside the guest** when its run is done: the runner runs `shutdown /s /t 0` in Windows and `systemctl poweroff -i` in Ubuntu, or the Mac does it over SSH. `utmctl stop --force` only as a last resort after a timeout, and logged as such. Wait for a VM by polling its state, not with fixed sleeps. **Leave nothing open** (the owner, 2026-11-16): after a VM stops, close its UTM window too, and quit UTM if the run started it; if `utmctl` can start a VM without a window, use that. The owner confirmed `utmctl stop "Navi Windows" --force` works but leaves the VM's window open.
   - Measure: `utmctl` starts and stops both VMs from the command line, unattended (including whether UTM must be running and any macOS automation permission it needs); Windows 11 ARM and Ubuntu ARM boot; Chrome, Edge and Firefox have native ARM64 Windows builds; peak RAM per VM during a run (one VM at a time on 16 GB). Sharing between the Mac and the VMs is off. Measured during setup (2026-11-16): in the Ubuntu VM, a terminal `sudo reboot` is refused while the desktop session is logged in (GNOME's session inhibitor); unattended restarts and shutdowns must handle that (for example `systemctl reboot -i`, or stopping the VM from the Mac with `utmctl`), without the owner clicking anything.
5. **Phase B, NOT in this build — the Windows desktop and the DGX Spark as unattended test machines** (kept here so this build's design leaves room for them):
   - A dedicated test user on each, signed in automatically at boot, so browsers have a desktop session after restarts and Windows Update reboots. Sleep disabled while on.
   - **The DGX Spark's desktop:** does a graphical session run without a monitor attached? If not, measure a virtual display (for example Xvfb) and whether the browsers and their managers behave the same there; if not, a dummy HDMI plug is the owner's fallback.
   - **Linux ARM64:** is official Google Chrome available? If not, Chromium stands in, and the report labels it Chromium.
   - **Remote work:** how the agent reaches each machine for setup and debugging (SSH on the DGX; OpenSSH Server on Windows), on the home network only.
   - The schedulers: Windows Task Scheduler ("run only when the user is logged on", since browsers need the desktop) and a systemd user timer on Linux, each with a catch-up run after downtime.
   - **The shared monitor:** the Windows PC and the DGX share one monitor, switched by its input. Measure whether each still gets a working desktop session for the browsers when the monitor shows the other machine or is off. If not: a virtual display on Linux, and a dummy HDMI plug as the owner's fallback.
   - **Unattended power-on:** see "Waking up for the run" above: the BIOS power-on alarm on both machines, automatic sign-in to the test user, and on the Windows PC, the OpenCore picker's Timeout.
6. **Isolation from the owner's personal data on every machine.** Each machine runs the tests in a dedicated test user, never the owner's own user or browsers.
   - **macOS:** a dedicated macOS user. The open question is whether Safari automation (item 1) works in that user's session while the owner uses his own (fast user switching), or only when it is the active session. **Decision rule:** if it only works as the active session, record it, and the Mac runs its cells when the test user is active or at the scheduled time if the owner leaves it on that user; stop and ask only if neither works.
   - **The VMs:** the `navi` user in each is the dedicated test user. (Phase B: a dedicated test user on the Windows PC and the DGX, as in item 5.)
7. **Runtime:** the time for one full sequential cycle on the Mac (macOS, then the Windows VM, then the Linux VM), and whether the 04:00 → 08:00 schedule holds with a fix loop in it. If a cycle is too long for that, record it and propose an earlier start or a split.
8. **Screen off:** whether the runs work with each machine's display asleep or locked, including the Mac after a scheduled wake. The owner prefers screen-off; a screen that turns on for the run is acceptable.

**Owner setup** (the agent gives step-by-step instructions for each, following the debugging-instruction standard: which app, exact menus, what to send back):
- the test Gmail and the 5 site accounts;
- UTM and its two VMs on the Mac;
- (Phase B) preparing the Windows desktop and the DGX Spark (test users, automatic sign-in, sleep, remote access);
- one-time logins in each prepared profile;
- Safari's Develop-menu settings;
- the Discord server, channel and webhook;
- creating the private repo.

The agent sets up everything else.

## Stage 1 — the checker (outcomes only)

**Phase 1, read-only:** inventory what the checker can read from outside the navigator.
- The navigator already exposes stable markers: `data-acn-version`, `data-acn-platform`, `data-acn-index-status`, `data-acn-count`, `data-acn-role` (`nav-list`, `nav-item`, `nav-stat`, `tool-export`, `sum-*`, `history-load`, …), `data-acn-bookmark`, `data-acn-ctx-tokens`, `data-acn-ctx-limit`, `data-acn-gallery-thumb`, and more.
- Map each check below to the markers it uses.
- **If a check needs something the navigator doesn't expose, stop and ask:** any navigator change is a separate public PR on the owner's OK.
- **Draft the full check inventory** for the owner: every navigator feature on every site (start from `docs/acceptance-checklist.md` and the feature docs), the checks for each, and what each check needs in the canaries (code blocks, tables, images, a very long answer, an edited or branched message, a project chat, …). The 10 checks below are the starter set that proves the pipeline. The owner reviews the inventory **together with the canary question list, in one sitting, before any send**, so the canaries hold everything the agreed checks need. The checker is a registry of small, separate checks, so more can be added at any time later; only canary content is fixed once created.

**The checker is one JavaScript file:**
- The runner injects it into the page. It runs in the PAGE realm, so its network results describe the page realm, not the navigator's sandbox; label them so.
- The same file is wrapped as a small userscript for manual runs, installed only in test profiles.
- It drives the navigator only through its UI, the way a user does: clicks and reading the panel.
- It produces one JSON report per run.

**Ground truth comes from the canary manifest first** (fixed known values, see Stage 4). Site data (DOM or API reads) is second. If ground truth itself can't be read, because the site changed its own markup, report `ground-truth-unavailable`, separately from navigator failures. **A checker failure must never be reported as a navigator failure.**

**The checks** (per site, in each canary chat that applies):

1. **Load:** the navigator is present; `data-acn-version` equals the expected build; the platform is detected.
2. **Navigate:**
   - the count equals the manifest's count, on open, with no scrolling, where the index supports it;
   - the first and last questions' text matches;
   - the index status is ready, or the degraded state is shown honestly.
3. **Jumps:** from the far end of the `long` canary, jump to Q1, to early questions that are NOT the first (Q3 and Q7: Q1 lands trivially at the top of the page, the others are where jumps have stopped halfway before), to a middle question and to the last question.
   - Each lands on the right message (by id or planted marker), in view, within a time cap.
   - Record the clicks each jump needed: anything but exactly one is a `fail`, so the "lands halfway, click again" bug is red the moment it returns.
   - On Gemini, the "Loading earlier messages…" status shows while paging.
4. **Bookmarks:**
   - Snapshot the bookmarks before starting.
   - Bookmark a question and an answer. Labels read `Q#n` and `Answer to Q#n`, with n from Navigate.
   - Both survive a reload; their jumps land.
   - Delete exactly those two.
   - The snapshot after equals the snapshot before.
5. **Search:** finds a planted word from an early answer; its jump lands.
6. **Export:** the file has every question and answer, by count and by planted markers. The runner reads the downloaded file from the profile's download folder.
7. **Summary:** it generates, and its segments cover every question.
8. **Gallery:** the thumbnail count equals the manifest's image count; one opens.
9. **Context meter:** shows a value within the manifest's expected range for that chat; the model or window label shows where the site supports it.
10. **Live send** (in this cell's scratch chat only):
    1. Note Navigate's count.
    2. Send `Navi live check <tag> — reply with only the word OK.`, with a fresh random 6-character tag from the runner. Wait until the answer finishes streaming.
    3. Navigate's count is +1 within a time cap, and its last item contains the tag.
    4. Bookmark the new question: the label is `Q#n`, with n the new count.
    5. Reload: the bookmark survives, and its jump lands on the tagged question.
    6. Delete exactly that bookmark.
    A send blocked by a rate limit or a challenge is reported as `skip: send-blocked`, never as a navigator failure.
**Results:** `pass`, `fail`, `skip` (with a reason) and `ground-truth-unavailable`.
- A paid-only feature on a free account (Claude's plan-usage panel, model-window differences, ChatGPT plan behaviour) is `skip: free-tier`, never `pass`. The report lists these gaps.
- **Grok** is checked from day one. Until the Grok PR lands, its failures are baseline known-failures, which gives the Grok PR its canary from the start.

## Stage 2 — the runner

- **One codebase on all three machines,** with a driver per browser (Safari's path from Stage 0; Chrome, Edge and Firefox drivers) and the install method per manager from Stage 0.
- **Per run:** open the profile → confirm logged in (if not, report `needs-relogin: site, browser, OS` and skip that cell; never automate logins) → open the canary chat → inject the checker → collect the report.
- **Flake guard:** a failing check is retried once in a fresh page before it counts.
- **Builds:** the runner takes `release` (the published build), `candidate <PR>` or `admin <build>` as input.
  - `release` is installed the way users install it: from the public URL.
  - Candidates come only from `main` or from same-repo branches by the owner or Claude's bot. Never forks.

## Stage 3 — the admin build and its diagnostics

- **The build step** takes a given public file and inserts the diagnostics layer at a fixed point in its scope. It fails loudly if that point isn't found. Output:
  - its own `@name` ("Navi admin");
  - no `@updateURL` or `@downloadURL`, so it can never update from the public script;
  - version `<public version>+admin.<commit>`.
- **The diagnostics are read-only.** They report the transport per request, which selectors and adapters matched, the index state, the API response shapes (keys and types, never content), timings, and the degradation reasons.
- **They never wrap or replace page globals** (the Firefox `fetch`/`.bind()` lesson, CLAUDE.md rule 9). An instrumented build must not change behaviour.
- **On a new failure:** the machine that saw it re-runs only its failing cells with the admin build of the same public build, up to 3 times, and attaches the diagnostics to the issue. "Didn't reproduce" is reported as such.

## Stage 4 — canaries, baseline, orchestrator

**Canary chats, per site, in the test account:**
- `long`: 50 questions, each with a unique numbered marker. This exercises Claude's virtualization and Gemini's paging.
- `short`: 5 questions.
- `image`: at least 2 images from a fixed set in the private repo.
- `long-answer`: one very long answer.

The canaries are never sent into again after creation, so their values stay fixed.

**Scratch chats, one per cell** (site × browser × environment: 40 for the physical machines plus 25 for the stand-in VMs), created at the start along with the canaries. Each receives only its own cell's live-send question, so cells never interfere, now that the three machines run in parallel. The runner replaces a scratch chat with a fresh one (deleting the old) when it reaches 50 questions, and records the change in the manifest.

**Creating the canaries (once, at the start):**
- Draft the question list and planted words. Each answer is asked to include a planted word.
- **The owner approves the list before any send.**
- Then either Claude Code sends them through the runner in one go, or the owner pastes them by hand, whichever is faster. A free plan's rate limit that interrupts creation is waited out and resumed, not treated as a failure.
- Then read them back into `canaries/manifest.json`: conversation ids, counts, markers, images, the expected meter range.

**The baseline** (`baseline.json`): per cell (site × browser × OS) and per check, the expected result.
- Known failures carry an issue link.
- **"New failure"** means expected `pass`, now `fail` after the flake retry.
- A cell that turns green updates the baseline automatically, with a Discord note.
- A new known-failure is added only with the owner's OK.
- A PR is judged by **"no new failures"**: a known bug never blocks an unrelated fix.

**The per-machine orchestrator** (each machine's scheduler, 07:00 local):
- Pulls the private repo, runs that machine's cells and builds its report, with measurement context per cell.
- Compares with the baseline.
- On new failures: runs the admin diagnosis (Stage 3), then files one issue per root symptom in the private repo (or comments on an open issue for the same symptom from another machine), with the report, the diagnostics, and the cells affected.
- Pushes its results to the private repo and posts its own Discord message.

**Stand-ins:** after the stand-in deadline (default 05:00, one hour after the run starts; a setting), the Mac checks the private repo for today's Windows and Linux results. For an OS with none, it starts that VM, runs its cells, pushes the results and shuts the VM down. Each environment is its own column in the baseline and the reports ("Windows desktop x86" vs "Windows VM ARM", "Linux DGX" vs "Linux VM"), because the two can differ; a stand-in result is never mixed into the physical machine's history. The owner can also force the stand-ins on (travel mode) or off with one setting.

**The daily summary** (GitHub Actions in the private repo, one small Linux job a day): merges the results that arrived into one summary per day and posts it, naming which environment covered each OS and any machine that hasn't reported, and for how long. The webhook URL is an Actions secret in the private repo.

## Stage 5 — the fix loop and Discord

- **A private-repo issue triggers a Claude Code Routine.** The Routine:
  - reproduces from the report and diagnostics;
  - fixes the **public** source on a `claude/` branch;
  - opens a public PR with the trial label: "would auto-merge" or "needs approval, because …". The PR contains nothing identifying the test account.
- **The PR then goes through:** CI (`ci-ok`), Codex review, and the label `live-retest`.
- **Each machine polls the public repo** for PRs labelled `live-retest` that pass the fork rule. Labels can only be applied by repo collaborators. For each, it runs:
  - its failing cells with the candidate (must turn green);
  - then all its cells (no new failures).
  It posts its result as a PR comment and to Discord. A machine that is off adds its result when it's back.
- **Auto-merge** (built, OFF): one setting, off by default. When on, it applies only when ALL of these hold:
  - the canary reproduced the bug;
  - the fix turns it green;
  - nothing new is red **for all three OSes** (physical machine or its stand-in): if any OS hasn't been re-tested, it waits for the owner;
  - CI and Codex are clean;
  - the diff is small and touches only site-shape code (selectors, adapters);
  - no new permission, `@grant`, `@connect` or feature;
  - **never any file under `.github/`.**

  With the userscript, merge = release. When auto-merge is on and merges something, the Discord message says so.
- **Discord messages:**
  - every day: one summary ("40 runs, nothing new", or the new failures, or which machine is off);
  - per fix: what broke, what changed, the PR link, and the label;
  - "needs you": the decision needed, plainly worded.
  The webhook URL lives in each machine's secret store (macOS Keychain, Windows Credential Manager, a Linux keyring or an untracked local file) and in the private repo's Actions secrets.

## Gates

**The checker catches real breakage:**
- **Planted mutants:** run against public builds with planted regressions, one each:
  - Navigate drops Q1;
  - a jump lands one message off;
  - a bookmark label is off by one;
  - Export drops the last answer;
  - Search misses answers;
  - the gallery shows no thumbnails.
  Each must be flagged as `fail` on the right check, and the unmodified build must pass.
- **History as proof:** on the Gemini `long` canary, v12.18 must fail "Navigate: full count on open", and v12.19 must pass it.

**Honest results:**
- Ground-truth breakage is labelled as such: simulate an unreadable manifest chat and expect `ground-truth-unavailable`, not `fail`.
- The bookmark snapshot check fails if a pre-existing bookmark is changed. Test it with a deliberately wrong delete in a mutant.

**The live-send check catches the new-message paths:**
- A mutant whose index never refreshes after a new message (for example, Gemini's newest-page merge removed) must fail the live-send check while the canary checks still pass.
- A blocked send gives `skip: send-blocked`, not `fail`.

**Admin build:**
- A generated admin build passes every check that its release build passes (no behaviour change).
- The build step fails loudly when the insertion point is missing.

**Runner:**
- A logged-out profile gives `needs-relogin`, not feature failures.
- A fork PR is refused.
- The flake retry is applied.
- **VM stand-ins clean up after themselves:** a stand-in run starts its VM, signs in with no hand steps, runs, shuts the VM down from inside the guest (Windows included), and leaves no UTM window or UTM app open that it opened.

**Loop end to end, on a throwaway branch that is never merged:**
- A planted bug in a candidate build leads to: new failure → admin diagnosis → private issue → Routine fix PR (labelled) → `live-retest` → green → Discord "needs approval".
- With auto-merge OFF, nothing merges.

**Machines (this build: the Mac with its VMs):**
- A full cycle on the Mac completes within the time measured in Stage 0, one VM at a time.
- A cycle runs with no hand steps after the Mac's scheduled wake: VMs start, sign in, run, shut down and close.
- With the Mac asleep or away at 04:00, the cycle runs once when it wakes, and the daily summary says the Mac reported late.

**Machines (Phase B, later spec):**
- Each machine completes its run within the time measured in Stage 0.
- A machine switched off gives "no report" in the daily summary, not failures, and runs once when it's back; after the stand-in deadline, the Mac's VM covers that OS and the summary says so.
- After a reboot, the Windows and Linux machines sign in to their test user and run on schedule with no hand steps.

## Docs

- **Private repo:** README (setup per machine, so moving to the Mac mini or a new Windows PC is `git clone` plus that machine's setup list), an architecture note, the baseline policy, the canary manifest format, the live-send template and scratch-chat rotation, and a runbook for "needs-relogin" and captchas.
- **Public repo:** this spec in `docs/specs/`, a new DEC (the three-piece design, the host, the owner's decisions above, credited to the owner with this date; agent decisions marked as the agent's), plus ROADMAP and HANDOFF updates. Retire the "built-in self-test" plan in ROADMAP with a pointer to the DEC.

## Acceptance (the owner)

1. **Discord:** a full cycle on the Mac posts its result, and the daily summary lists all 40 cells (macOS, Windows VM, Linux VM) with measurement context.
2. **The planted-bug dry run** (Gates, end to end): you receive the "needs approval" message with the trial label and can open the PR; nothing merged.
3. **Safari:** a Safari cell's report shows Userscripts' version, and its checks match what you see when you open the same canary yourself.
4. **Re-login:** log one profile out on purpose; the next cycle reports `needs-relogin` for exactly that cell.
5. **Your bookmarks:** the bookmarks in your personal browsers are untouched (the test runs never use them).

## Out of scope (log)

- The other 9 platforms (Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio, Codex, Claude Code web); decide later whether they join the matrix.
- Moving to the Mac mini or a dedicated Windows mini PC (the docs make it a clone plus setup).
- Waking the Windows PC over the network (Wake-on-LAN) for its run.
- **An x86_64 Linux environment with official Google Chrome** (the owner raised it, 2026-11-16). Both Linux environments in this spec are ARM64 (the DGX, and the UTM VM on Apple Silicon) and run Chromium, while most Linux desktop users run x86_64 with Google Chrome. Candidate route: an Ubuntu x86_64 VM on the Windows PC (Intel, so it virtualizes natively), with an open-source hypervisor such as VirtualBox, or WSL2 with its Linux GUI support. Decide after the system runs.
- Store-installed extension builds (after v13 and the store submissions, add a `store` build type).
- Turning auto-merge on (the owner, after the trial).
- The public contact Gmail.
- Computer-use agents for hands-on investigation (optional later, only in the test users).
