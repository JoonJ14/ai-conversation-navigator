The live test system is redesigned, and the next step is ONE experiment. Do the experiment and nothing beyond it, then report and wait for my decision. This file replaces the parts of `docs/specs/live-test-system-spec.md` listed under "What this supersedes". Record everything under "My decisions" in DEC-065, dated 2026-11-17 and credited to me.

# The redesign: attended live checks, no robots

## Why the design changed

All five sites' terms restrict automated access, and claude.ai challenged the WebDriver runs. So nothing in this system runs unattended or on a schedule, and nothing uses a scripted (WebDriver or remote-debugging) browser on an AI site.

## My decisions (2026-11-17)

1. **I start every live session, and I am at the computer while it runs.** No schedule, no timer, no overnight runs, no automatic wake. A morning Discord nudge is fine; the start is always mine.
2. **The matrix is unchanged:** Claude, ChatGPT, Gemini, Grok and Perplexity, in Safari, Chrome and Firefox on macOS; Chrome, Edge and Firefox in the Windows VM; Chromium and Firefox in the Linux VM. 40 runs per session.
3. **How a run works:** the runner opens the site's test chat in a normal browser, the way a bookmark would. A small checker userscript, installed once in that browser, runs the outcome checks on the page and sends its report to a receiver on the Mac. The runner then closes the browser. No WebDriver, no remote debugging and no agent on an AI site.
4. **Nothing is hidden from the sites.** Normal browsers with their normal user agents. No stealth settings, no masking of anything, no challenge solving. If a site objects, that site stops (see the stop rules); we don't look for a way around it.
5. **Read-only.** No automatic message sending. I create every test chat by hand.
6. **Claude is included, with a stop rule** (below). I'm also asking Anthropic for permission separately.
7. **How long a session takes doesn't matter.** Measure it; don't cut anything to shorten it.
8. **The CI against copies stays, and the live sessions keep it current.** During every session, each page's structure is saved with all chat text replaced by filler. If it differs from the CI's copy, Discord says so, the copy is replaced, and the CI runs again against it. The CI must check real outcomes and be proven with planted bugs. That is a later experiment, but the capture in this one is its first step.
9. **The fix loop is unchanged in spirit:** a failure from a live session or from the CI goes to you; you investigate (live in my Chrome through the Chrome connection when you need to look, as we've always done, at my request), fix, verify in the CI and in the failing live cells during a session I start, and open a PR. Auto-merge stays built-but-off.
10. **Later, not now:** health checks inside Navi during real use; a remote data file for selectors and the model table; an unknown model must show "context window not known yet", never a guessed number.

## What this supersedes in the spec

- The 04:00 schedule, the scheduled wake, the stand-in deadline and every unattended run.
- WebDriver, `safaridriver`, attached remote debugging and AppleScript `do JavaScript` as ways to drive an AI site.
- The live-send check and scratch chats; canaries created by the runner.
- My earlier decisions in this session about snapshot replay as the nightly system and the shape watcher in my personal browser: both are replaced by decision 8.

Everything else stands: the three pieces (public navigator, checker, generated admin build), the private repo, the test accounts, the VMs, Discord, the baseline and "no new failures", the security boundary, Phase B for the physical machines.

## Standing rules (unchanged, repeated so they're in one place)

- No screenshots of my own screen or account without asking; only VM windows or the test user.
- Never type a secret through synthetic keystrokes into a window on my desktop. A password typed by hand is my step. Never automate a sign-in.
- Nothing runs in my personal browsers or accounts unless I ask for it in that moment.
- Nothing about the test accounts in either repo.
- Example pages (example.com) only for one-off probes.
- Still open from before, answer when convenient: the cause of the Windows VM's unexpected stop (~22:40Z on 2026-11-16, System event log), and whether FileVault is on (it decides whether Navi Test can sign in by itself after a restart).

---

# Experiment 1: a miniature of the whole pipeline

**Goal:** find out, with as few site visits as possible, whether this design works at all, before anything larger is built. It runs in three stages, and each stage needs my "go".

## What it must answer

1. Does each site accept a normal browser with a userscript manager opening one test chat, started by the runner, in each browser and OS, signed in to the test account?
2. Where do the Mac's browsers have to run so pages really render: the Navi Test account in the background, Navi Test as the active session, or a macOS VM?
3. Does the whole chain work end to end: start, open, Navi runs, checker checks, report reaches the Mac, results table, Discord message, browser closed, VM shut down, nothing left open?
4. How long does a full session take?
5. How far has each site's real structure drifted from the CI's current mock pages?

## Preparation (no AI site is contacted)

- **The mini checker:** a small userscript that, on the test chat page, waits for Navi, then checks: Navi is present and reports its version and platform; Navigate lists exactly the test chat's questions, in order (count and first/last text against the values I give you); one jump to the first question lands; one bookmark is created, read back and deleted (Navi's own storage only). It also records sign-in and challenge signals as yes/no values, saves the page's structure with every text node replaced by filler and ids removed, and sends one report to the receiver. It never sends a message and never navigates anywhere.
- **The receiver:** on the Mac, reachable from the Mac's test user and from the VMs only. It treats every report as data: fixed format, validated, never executed.
- **Navi v12.19 (the published build), the manager and the mini checker** installed in every test browser. Any install method is fine as long as it touches no AI site. Where a browser needs a manual click, give me the exact steps and I'll do it once per profile. In the VMs, a browser policy that installs the manager is fine, since those machines are only for testing.
- **Rendering on the Mac (question 2):** measure it on a local test page, not on an AI site: frames drawn and page visibility for Safari, Chrome and Firefox, with Navi Test in the background and as the active session, several runs each. Bring me the result and the options before Stage A if the background doesn't render.
- **Opening a page in each VM's signed-in desktop** from the Mac, and closing the browser afterwards, proven on a local page.
- **My steps, which you give me as exact instructions:** one short test chat per site, created by hand (three short questions; tell me the wording to paste, and I'll send you each chat's address); the sign-ins in the VM browsers before their stages (25 in total); any manual installs.

## The visits

- **Stage A, the Mac:** Safari, Chrome and Firefox, five sites each: 15 page loads.
- **Stage B, the Windows VM:** Chrome, Edge and Firefox: 15 page loads.
- **Stage C, the Linux VM:** Chromium and Firefox: 10 page loads.

One page load per site per browser, no reloads, no retries. Ask me "ready for Stage A?" and wait for my go; the same for B and C. I'll be at the computer.

## Stop rules

- **Any site:** a challenge page ("Just a moment", a captcha, "verify you are human"), a forced sign-out, a warning banner or an unusual-activity notice means that site stops in every remaining browser and stage. No retry, no second attempt another way. Report exactly what appeared.
- **Claude:** the same rule, and at most one visit per browser (eight in total across the stages).
- **Any account message** from a site about automated use or restrictions: stop everything and tell me.
- **A failed cell is a result, not a reason to retry.**

## What to bring back, then stop

- A table of all cells: accepted or stopped, signed in, Navi's version, each check's result, time taken.
- The rendering finding and where the Mac's cells should run.
- The session's total duration, and each stage's.
- The structure drift per site against the CI's mocks, in plain words (what the mocks have that the real pages don't, and the reverse).
- Every manual step the experiment needed from me, and which of them would recur in daily use.
- The Discord message the session posted.
- Your recommendation: go, go with changes, or stop, with the reasons.

Don't build the full checker, the CI against copies, the progress window or the fix loop yet. If the experiment passes, the next experiment is the CI: one site's copy built from the captured structure, proven with planted bugs.
