# Testing Guide — AI Conversation Navigator

This document explains **everything** about the automated test suite: what it does, how it works internally, how to run it, how to debug failures, and exactly how to add a new platform. It's written so that any developer or AI coding agent picking up this project in a fresh session can immediately understand and extend the test infrastructure.

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [How to Run the Tests](#how-to-run-the-tests)
4. [Architecture — How It Works Under the Hood](#architecture--how-it-works-under-the-hood)
   - [The Core Problem: Hostname Faking](#the-core-problem-hostname-faking)
   - [The Solution: Playwright Route Interception](#the-solution-playwright-route-interception)
   - [Full Execution Flow (Step by Step)](#full-execution-flow-step-by-step)
   - [Browser Launch Configuration](#browser-launch-configuration)
   - [Page Reuse Strategy](#page-reuse-strategy)
5. [What Each Test Checks (12 Tests Per Platform)](#what-each-test-checks-12-tests-per-platform)
6. [Platform Configuration — The PLATFORMS Array](#platform-configuration--the-platforms-array)
   - [Field Reference](#field-reference)
   - [Current Platforms](#current-platforms)
7. [Mock DOM Pages — Anatomy and Rules](#mock-dom-pages--anatomy-and-rules)
   - [What a Mock Page Must Contain](#what-a-mock-page-must-contain)
   - [How Mock Pages Map to Userscript Selectors](#how-mock-pages-map-to-userscript-selectors)
   - [Per-Platform Selector ↔ Mock DOM Reference](#per-platform-selector--mock-dom-reference)
8. [Step-by-Step: Adding a New Platform](#step-by-step-adding-a-new-platform)
9. [Debugging Failed Tests](#debugging-failed-tests)
10. [Limitations and Caveats](#limitations-and-caveats)

---

## Measurement Context Is Part of the Finding

Before trusting any manual measurement taken against a live platform, check which
context it came from. Three v12.0 findings were verified, documented as fact, and
later disproved — each was correct where measured and false where it mattered.

| Context | Changes | How to test the one that matters |
|---|---|---|
| Page realm vs **Tampermonkey sandbox** | cross-compartment rules, event trust | probe from an installed userscript, not the DevTools console |
| Chrome vs **Firefox** | compartment strictness (DEC-019, DEC-020) | Firefox first — it is where this project's execution failures happen |
| Visible vs **hidden tab** | rAF and timers throttle; a virtualizer stops running entirely | assert `document.visibilityState === 'visible'` before measuring |
| Mock page vs live site | no vendor bundles, no CSP, no virtualization | mocks cannot catch Layer 3 or Layer 4 breaks |

A hidden tab is the nastiest of these: it does not fail loudly, it returns
plausible, stable, wrong numbers. Every early measurement failure in the v12.0
Phase 3 investigation traced back to it — programmatic scrolls appearing to do
nothing, multi-megabyte `fetch` calls hanging forever.

**Rule:** write findings as *"X, measured in \<context\>"*, and treat them as
context-scoped until reproduced in the Tampermonkey sandbox, in a visible window,
on Firefox. When a later measurement contradicts an earlier one, record **both**
with their contexts rather than replacing one — the contradiction is the finding.

Probe scripts used for this in v12.0 are worth copying as a pattern: they abort
loudly when `visibilityState !== 'visible'`, they state which realm they run in,
and the userscript-based ones print `exportFunction` presence to prove they are
genuinely in the Firefox sandbox.

---

## Overview

The test suite verifies that the AI Conversation Navigator userscript works correctly on **every supported platform** without needing to open a browser and manually visit each site. It does this by:

1. Creating **mock HTML pages** that replicate each platform's DOM structure (the specific CSS classes, data attributes, ARIA roles, and element nesting that the userscript's selectors target).
2. Using **Playwright** (a browser automation library) to open those mock pages in a headless Chromium instance.
3. Using **route interception** to make the browser think it's visiting the real site (e.g., `https://claude.ai`), even though it's actually rendering our local mock HTML.
4. **Injecting the actual userscript** into the page and verifying it detects messages, renders the UI, and responds to clicks correctly.

Everything runs on **localhost**. No external network, no cloud, no remote servers. The mock HTML files live in the repo under `tests/mock-pages/`.

---

## File Structure

```
tests/
├── run-tests.sh              # Shell convenience script — one command to run everything
├── test-all-platforms.js      # Playwright test runner — the main test engine
├── screenshots/               # Generated screenshots (with --screenshots flag)
└── mock-pages/                # One HTML file per platform variant
    ├── claude.html            # Claude Chat (claude.ai)
    ├── claude-code.html       # Claude Code (claude.ai/code) — different DOM, same hostname
    ├── chatgpt.html           # ChatGPT (chatgpt.com)
    ├── codex.html             # Codex Web (chatgpt.com/codex) — different DOM, same hostname
    ├── grok.html              # Grok (grok.com)
    ├── gemini.html            # Gemini (gemini.google.com)
    ├── bolt.html              # Bolt.new (bolt.new)
    ├── lovable.html           # Lovable (lovable.dev)
    ├── replit.html            # Replit (replit.com)
    ├── v0.html                # V0 (v0.app)
    ├── base44.html            # Base44 (app.base44.com)
    ├── emergent.html          # Emergent (app.emergent.sh)
    ├── perplexity.html        # Perplexity (perplexity.ai)
    └── firebase.html          # Firebase Studio (cloudworkstations.dev workspace iframe)
```

**Note:** Claude Chat and Claude Code share the hostname `claude.ai` but have completely different DOM structures. Same for ChatGPT and Codex (both on `chatgpt.com`). The userscript uses a fallback chain — it tries the primary selectors first, and if those find 0 results, it tries the fallback selectors. The mock pages are designed so that each variant only matches its own fallback path.

---

## How to Run the Tests

### From the project root:

```bash
./tests/run-tests.sh
```

### Or directly with Node:

```bash
NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js
```

**Why `NODE_PATH`?** Playwright is installed globally at `/opt/node22/lib/node_modules/playwright`, not in the project's `node_modules`. The `NODE_PATH` environment variable tells Node.js where to find it. The `run-tests.sh` script sets this automatically.

### Requirements:

- **Node.js** (v18+)
- **Playwright** (`npm install -g playwright` or already globally installed)
- **Chromium** browser downloaded (`npx playwright install chromium`)

### Exit codes:

| Code | Meaning |
|------|---------|
| `0`  | All tests passed |
| `1`  | One or more tests failed (check the detailed report) |
| `2`  | Fatal error (browser failed to launch, script file not found, etc.) |

---

## Architecture — How It Works Under the Hood

### The Core Problem: Hostname Faking

The userscript's `detectPlatform()` function iterates the `PLATFORMS` registry and calls each platform's `match()` function to determine which platform it's running on:

```javascript
function detectPlatform() {
    var host = window.location.hostname;
    for (var key in PLATFORMS) {
        if (PLATFORMS[key].match(host)) return PLATFORMS[key];
    }
    return null;
}
```

Each platform's `match` function defines its own hostname check. For example:
- Claude: `host.includes('claude.ai')`
- Bolt: `host === 'bolt.new'`
- Firebase Studio: `host.includes('studio.firebase.google.com')` or `host.includes('cloudworkstations.dev') && host.includes('firebase-studio-')`

If `detectPlatform()` returns `null`, the script immediately exits. So if you load a mock page on `localhost:8080` or via a `data:` URI, the hostname is `localhost` or empty — the script does nothing.

**Approaches that DON'T work:**

| Approach | Why It Fails |
|----------|-------------|
| `data:` URIs | `window.location.hostname` is empty string; `Object.defineProperty(window, 'location', ...)` is blocked by the browser — `location` is a non-configurable property on `data:` origins |
| `Object.defineProperty(window.location, 'hostname', ...)` | Same — `location` properties are non-writable/non-configurable in Chromium |
| `localhost` with query params | Hostname is `localhost`, not `claude.ai`; the script exits |

### The Solution: Playwright Route Interception

Playwright's `page.route()` API lets you **intercept network requests** at the browser level and respond with custom content. The key insight:

> If we tell Playwright to navigate to `https://claude.ai/chat/test`, and we intercept that request to serve our mock HTML, then `window.location.hostname` genuinely returns `claude.ai` — because the browser really did navigate to that URL. It just got a different response than it would from the real server.

This is the same mechanism that proxy servers and service workers use. The browser's navigation bar, `window.location`, cookies, CORS — all behave as if you're on the real site.

**Implementation:**

```javascript
// In setupRouteForPlatform():
await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url === targetURL || url === targetURL + '/') {
        // Serve our mock HTML instead of the real site
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: html,  // Our mock page with userscript embedded
        });
    } else {
        // Abort everything else (real site's CSS, JS, tracking, etc.)
        route.abort();
    }
});
```

The `'**/*'` pattern matches ALL requests from the page — navigation, sub-resources, images, scripts, everything. We serve our HTML for the main navigation request and abort everything else (we don't need the real site's assets).

### Full Execution Flow (Step by Step)

Here's exactly what happens when you run the tests, in order:

```
1. main() starts
   ├── Reads ai-conversation-navigator.user.js from disk
   ├── Strips the ==UserScript== header (lines 1-15) using regex
   │   └── The header is Tampermonkey metadata; browsers don't need it
   ├── Launches headless Chromium with --single-process flag
   ├── Creates ONE browser context and ONE page (reused for all tests)
   │
2. For each platform in PLATFORMS array:
   ├── page.unrouteAll()  ← Clears routes from the previous platform
   │
   ├── setupRouteForPlatform()
   │   ├── Reads the mock HTML file (e.g., tests/mock-pages/claude.html)
   │   ├── Extracts <body> content using regex
   │   ├── Builds a self-contained HTML page:
   │   │   ├── <body> from mock file
   │   │   ├── <script> to delete window._aiNavAlreadyLoaded
   │   │   │   └── (Clears the duplicate execution guard from previous test)
   │   │   └── <script> with the full userscript code
   │   ├── Registers page.route('**/*') handler
   │   │   ├── Main URL → route.fulfill() with our HTML
   │   │   └── Everything else → route.abort()
   │   └── Returns target URL (e.g., "https://claude.ai/chat/test")
   │
   ├── page.goto(targetURL)
   │   ├── Browser navigates to https://claude.ai/chat/test
   │   ├── Route handler intercepts → serves our mock HTML
   │   ├── Browser renders the mock DOM
   │   ├── First <script> clears _aiNavAlreadyLoaded
   │   ├── Second <script> runs the userscript
   │   │   ├── detectPlatform() returns the claude platform object (hostname IS claude.ai)
   │   │   ├── Creates toggle button + panel
   │   │   ├── Starts DOM Guardian (MutationObserver)
   │   │   ├── setTimeout(scanConversation, 2000) queued
   │   │   └── SPA hooks set up (if applicable)
   │   └── Page is now fully initialized
   │
   ├── waitForTimeout(3500ms) ← Waits for the 2-second initial scan + buffer
   │
   ├── Runs 12 test assertions via page.evaluate():
   │   ├── TEST 1: [data-acn-role="zone"] exists (injection confirmed)
   │   ├── TEST 2: [data-acn-role="styles"] exists (CSS injected)
   │   ├── TEST 3: [data-acn-role="nav-trigger"] exists (Navigate dot present)
   │   ├── TEST 4: [data-acn-role="nav-panel"] exists (Navigate panel present)
   │   ├── TEST 5: data-acn-accent on zone matches expectedAccent hex
   │   ├── TEST 6: Only one [data-acn-role="zone"] exists (no duplicate injection)
   │   ├── TEST 7: Click nav-trigger → nav-panel gets data-acn-open="true"
   │   ├── TEST 8: data-acn-count on nav-stat equals expectedMessages
   │   ├── TEST 9: [data-acn-role="nav-item"] count equals expectedMessages
   │   ├── TEST 10: All nav-item-text elements have non-empty text
   │   ├── TEST 11: Clicking a nav-item doesn't throw
   │   └── TEST 12: Click panel-close → nav-panel loses data-acn-open
   │
   └── Results collected into allResults[]

3. After all platforms tested:
   ├── Closes browser context and browser
   ├── Prints detailed per-platform results
   ├── Prints summary (platforms passed/failed, tests passed/failed)
   └── process.exit(0 if all pass, 1 if any fail)
```

### Browser Launch Configuration

```javascript
const browser = await chromium.launch({
    headless: true,
    executablePath: execPath,  // Prefers full Chromium over headless shell
    args: [
        '--no-sandbox',            // Required in containerized environments
        '--disable-setuid-sandbox', // Same
        '--disable-gpu',           // No GPU in headless
        '--disable-dev-shm-usage', // Prevents /dev/shm issues in Docker
    ],
});
```

**Do not re-add `--single-process`.** It was present from the suite's first commit,
justified by an Antigravity IDE sandbox on Linux kernel 4.4.0 that is no longer the
environment this runs in. In single-process mode the renderer shares the browser process,
so **any** renderer fault takes the whole browser down — and every platform after it fails
with `Target page, context or browser has been closed`, which reads as fifteen broken
platforms rather than one renderer fault.

That is precisely what happened on Windows CI in v12.0, once `claude-virtualized.html`
started doing real scroll work: **13 of 16 platforms cascaded from a single fault.**
Firefox and WebKit on the same runner lost nothing, because the flag was Chromium-only —
which is also the diagnostic tell. If one engine cascades and the others report a single
clean failure, suspect crash isolation, not the code under test.

**Browser selection priority:**
1. Full Chromium (`/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`) — preferred, more stable
2. Headless shell (`/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell`) — fallback

### Page Reuse Strategy

The test runner creates **one browser context and one page**, then reuses that page for all 14 platform tests. Between tests:

1. `page.unrouteAll()` — clears the previous platform's route interceptor
2. `setupRouteForPlatform()` — registers a new route for the next platform
3. `page.goto()` — navigates to the new URL, which triggers a full page reload

This is more stable than creating a new context per test (which crashed on the old kernel). The `delete window._aiNavAlreadyLoaded` script in each mock page clears the userscript's duplicate execution guard, ensuring it runs fresh each time despite page reuse.

---

## What Each Test Checks (14 Tests Per Orbital Platform, 13 Per Legacy Platform)

Tests query only `data-acn-role` and `data-acn-*` contract attributes — no internal CSS class names or element IDs. This means the UI can be completely rebuilt in any future version without breaking the test suite, as long as the contract attributes are maintained on the correct elements.

**Total: 267 tests across 16 platform entries**, green on Chromium and on Playwright's
Gecko build (`--browser firefox`; not in the local default).

**Be precise about what the Firefox run covers.** Playwright launches its own Firefox
binary and the harness injects the userscript as a plain `<script>` tag in the page realm.
So it exercises **Gecko engine behaviour** — layout, `getBoundingClientRect`, `TreeWalker`
semantics, rAF timing, regex, `scrollTo` — and nothing more.

It does **not** exercise the Tampermonkey sandbox: no `unsafeWindow`, no `exportFunction`,
no cross-compartment boundary. That matters, because **DEC-019 and DEC-020 both happened
in the sandbox realm, not in Gecko generally.** A green Playwright-Firefox run is
therefore evidence against engine-level regressions and says nothing about the failure
class this project actually gets bitten by.

Sandbox-realm behaviour has been verified exactly once, narrowly: Probe B, run manually in
a real Firefox with Tampermonkey, confirming that sandbox-created events drive the
virtualizer (`exportFunction` present, so genuinely the sandbox). Everything else on that
axis is unverified. See the measurement-context rule above — "Firefox" is not one context,
it is at least two. Orbital platforms run 14 tests each; legacy platforms 13 each. The two virtualized Claude entries run additional tests: `Claude (virtualized)` adds 7, and `Claude (virtualized + index)` adds 13. Every non-virtualized entry gains a direct-path assertion, and **every** entry now ends with an uncaught-page-error check.

| # | Test Name | What It Verifies | How | Platforms |
|---|-----------|-----------------|-----|-----------|
| 1 | Zone exists | The userscript detected the platform and injected its container | `[data-acn-role="zone"]` present in DOM | All |
| 2 | Styles injected | The CSS block was added to the document | `[data-acn-role="styles"]` present in `<head>` | All |
| 3 | Nav trigger exists | The Navigate button/dot is present and clickable | `[data-acn-role="nav-trigger"]` present | All |
| 4 | Nav panel exists | The Navigate panel element is in the DOM | `[data-acn-role="nav-panel"]` present | All |
| 5 | Accent color | The zone reports the correct platform theme color | `data-acn-accent` attribute matches `expectedAccent` hex string | All |
| 6 | No duplicate zone | Only one zone was injected (no double-injection bug) | Count of `[data-acn-role="zone"]` equals exactly 1 | All |
| 7 | Trigger opens panel | Clicking the Navigate trigger opens the panel | Click nav-trigger → `data-acn-open="true"` appears on nav-panel | All |
| 8 | Question count stat | The stat element reports the correct detected message count | `data-acn-count` on `[data-acn-role="nav-stat"]` equals `expectedMessages` | All |
| 9 | Question items rendered | The correct number of question rows appear in the list | Count of `[data-acn-role="nav-item"]` equals `expectedMessages` | All |
| 10 | All items have text | Every question row has non-empty display text | All `[data-acn-role="nav-item-text"]` have non-empty `textContent` | All |
| 11 | Items clickable | Clicking a question item doesn't throw | Programmatic `.click()` on first `[data-acn-role="nav-item"]` | All |
| 12 | Close button works | Clicking close removes the open state | Click `[data-acn-role="panel-close"]` → `data-acn-open` removed from nav-panel | All |
| 13 | Correct injection mode | Platform gets orbital vs legacy UI as expected | `data-acn-ui` on zone matches `expectedMode` ("orbital" or "legacy") | All |
| 14 | All orbital dots present | All 6 feature dots rendered in the orbital cluster | `[data-acn-dot="nav"]`, `[data-acn-dot="search"]`, etc. all present | Orbital only |
| 15 | Mock recycles turns | The virtualizing mock genuinely unmounts turns rather than hiding them | Scroll to 0/35/70/100%; mounted count stays at `windowSize` and cumulative unique stays below `totalTurns` | Virtualized only |
| 16 | DOM exposes only the mounted window | The DOM cannot see the whole conversation — the bug itself, asserted | `__mockVirtualization.mountedCount()` equals `windowSize` while `totalTurns` is 40 | Virtualized only |
| 17 | Degraded mode is visible | Index failure is surfaced in the UI, not just the console | `[data-acn-index-status="degraded"]` banner present after opening Navigate | Virtualized only |

**Tests 1–4 are blockers** — if any fail, the remaining tests are skipped for that platform (there is nothing to interact with without the core elements).

**Test 9 is the most important** — this is where selector bugs surface. If the nav-item count doesn't match `expectedMessages`, the userscript's `getUserMessages()` selector chain isn't matching the mock DOM correctly.

**Test 13** validates the registry-driven `useOrbital` flag — if a platform's `useOrbital` property is wrong, this test catches it immediately.

**Test 14** catches rendering failures in the orbital cluster — if any dot fails to build, the entire cluster is broken for that platform.

### The core virtualized Claude entries

All use `claude-virtualized.html`. The first two differ in one thing: whether a
`GM_xmlhttpRequest` fixture is injected. The third differs only in the LANGUAGE of the
fixture text (v12.7).

| Entry | Fixture | Index builds? | Panel shows | Proves |
|---|---|---|---|---|
| `Claude (virtualized)` | none | no — degrades | 3 (mounted window) | the fallback is visible, not silent |
| `Claude (virtualized + index)` | yes | **yes** | **40** (whole conversation) | the primary path works end to end |
| `Claude (Korean conversation + index)` | yes | **yes** | **40**, in Korean | the tokenizer reads the product's only translated language (v12.7) |

The fixture entry is what makes the v12.0 feature testable at all. Before it, the harness
had no GM APIs, so org resolution, `ciBuildIndex`, active-path branch filtering, index-backed
Navigate/Search/Export and the entire jump loop were unverified by CI — a gap flagged twice
in independent review.

**The fixture deliberately carries one leading unrendered message**, so the
`data-index → _ciFullPath` offset is **+1** rather than 0. An implementation that quietly
assumes zero alignment fails here instead of in production. If you regenerate the fixture,
preserve that asymmetry — making it align at 0 would silently retire the check.

### The third virtualized entry — a mock that can fail

`Claude (virtualized, markdown API text)` exists because CI was green while the live site
failed. The other two virtualized entries use prose that is byte-identical in the mock DOM
and the GM fixture, so `ciDeriveRowOffset()` always succeeds and its failure path is
unreachable — structurally the same "cannot fail" shape as the original v12.0 bug.

This entry sets `gmFixture.markdownText`, giving the API side raw markdown
(`**Question number 5**: ... \`case 5\``) against the DOM's rendered text. The offset
therefore never derives, and the entry asserts what must remain true anyway: the jump
gives up inside its iteration budget, never claims a resolution it did not make, and
releases the busy flag.

It also pins a **known defect** — unmatched DOM rows are appended as provisional
questions, so 43 are listed where the index holds 40. The expectations encode current
behaviour deliberately; when text matching is fixed those numbers must return to 40 and
the `KNOWN DEFECT` assertion will fail loudly. That is the point of a characterisation
test.

### Regression hunting: `ACN_SCRIPT` is the first move, not a bisect

`ACN_SCRIPT` points the harness at any build. Both runs then use **the same fixtures and the
same instrumentation**, so the only variable is the code under test:

```bash
git show origin/main:ai-conversation-navigator.user.js > /tmp/shipped.js
ACN_SCRIPT=/tmp/shipped.js ACN_JUMP_TRACE=1 \
  node tests/test-all-platforms.js --browser chromium --platform "file chip"
# then the same command without ACN_SCRIPT, for the working tree
```

`ACN_JUMP_TRACE=1` turns on both trace channels:

| Channel | Covers |
|---|---|
| `[ACN pre]` | the click path BEFORE the settle loop — entry state, the fast-path outcome, and **which** condition refuses when the pre-jump guard rejects |
| `[ACN jump]` | the settle loop: per-iteration geometry and the `EXIT=` reason |

`[ACN pre]` exists because that whole path used to be silent. One toast covered six different
refusal causes and the fast path logged nothing at all, so a failure there was
indistinguishable from a failure in arrival.

**Worked example — the live Q#1 regression (2026-07-28).** An attachment-headed first question
stopped resolving on the real site. Three reproduction attempts failed:

1. `chipRows` alone — passed, because the mock's normal answer pairs at distance 1 from the chip
   and 3b's adjacent carve-out resolved Q#1 without consulting the head path.
2. `+ shortAnswerRows` to remove that pair — **also passed**, because `chipRows` was vacuous
   (`indexOf(i)` inside `buildRow(index)`; see DEC-032). Two A/Bs were run against a fixture
   that could not fail.
3. With the knob fixed, and `ACN_SCRIPT` A/B-ing shipped against working tree under identical
   instrumentation: `origin/main` → `Q1: expected row 0, got null`; working tree → 40/40 exact.

The alternative on the table was a seven-step manual bisect with a browser reinstall at each
step. `ACN_SCRIPT` replaced it with two commands. **Reach for it before proposing a bisect.**

### The load-path guard entries — a fixture default hid two CRITICALs for a release

Two entries exist because the GM fixture's *incidental constants* made real bugs
unreachable. Neither bug was subtle in the code; both were invisible in CI, and both
survived a 23-round independent review (DEC-028).

| Entry | Knob | Models | Old build (`6bc7ed2`) |
|---|---|---|---|
| `Claude (slow API — load recursion guard)` | `gmFixture.apiLatencyMs: 1200` | the real ~2.1s payload instead of the 5ms default | `RangeError: Maximum call stack size exceeded`, storm |
| `Claude (tool-shaped row — refetch loop guard)` | `gmFixture.toolShapedRow: 3` + `refetchProbeMs` | an artifact/tool answer, where the client renders more than the API's text blocks carry | 4 fetches in 36s idle at a 15.5s cadence, forever |

**The recursion entry changes nothing but a number.** `scanConversation → ciLoadIndex →
done(false) → scanConversation` recurses only when a second scan lands inside the fetch
window. At 5ms none ever does; at 1200ms it happens on essentially every load. The
assertion that catches it is the pre-existing `No uncaught page errors` — no new assertion
was needed, only a representative constant.

**The refetch entry asserts a ceiling, not an exact count.** Two fetches are correct: the
initial load plus at most one resync attempt. A third means the resync fired, succeeded,
observed the same evidence and fired again — which then repeats indefinitely. It probes
while the page is genuinely idle (no clicks, no scrolling), so anything it sees is
self-inflicted.

Both are **ancestor-gated**: they fail on a real commit (`6bc7ed2`) and pass on the fix, the
strongest form of the DEC-027 gate. When adding fixtures, record which are ancestor-gated
and which are only mutant-gated — they are not equally strong evidence.

Fixture knobs available per entry: `apiLatencyMs` (default 5), `toolShapedRow`,
`refetchProbeMs`, `markdownText`, `conversationUuid`, `totalMessages`, `failFetchAfter`,
`summaryRows`, `seedBookmarks`, plus the mock-page knobs `chipRows`, `shortAnswerRows` and
`identicalAnswerRows` (query params on `claude-virtualized.html`).

**Every knob must be proven to change the output (DEC-032).** `chipRows` shipped vacuous —
`CHIP_ROWS.indexOf(i)` inside `buildRow(index)` — and two A/B experiments ran against a fixture
that could not fail, appearing to disconfirm the correct hypothesis. Assert the property the knob
models (for `chipRows`: that the named row has **no** `[data-testid="user-message"]` descendant,
read after `scrollToFraction(0)` so the row is actually mounted), and mutation-verify by flipping
the knob off and watching the assertion fail.

### The legacy-bookmark entry — the uniqueness gate had zero coverage

`Claude (legacy schema-1 bookmarks)` seeds pre-v12.0 records through the GM shim with
`seedBookmarks`, hashing their text with a replica of the old FNV function (`legacyContentHash`),
and asserts the migration outcome via `legacyBookmarkProbe: { upgraded: 5, unmatched: 2 }`.

What it is really there to protect is the **refusal** path — the only defence against a permanent,
silent mis-binding, and previously untested:

| Assertion | Seeded record | Refusal it proves |
|---|---|---|
| Uniqueness gate refuses an ambiguous legacy preview | `bm_ambig` against `identicalAnswerRows` | two candidates → `legacyUnresolved: 'ambiguous'`, no binding |
| Short legacy preview REFUSES to bind | `bm_shortprev` (14 chars) | rule C's reverse probe is floored, not an unbounded substring test |
| Unmatchable record is marked, not silently generic | `bm_legacy6` | the record survives with a specific failure message |
| Summary-preview bookmark displays the message text | `bm_legacy4` + `summaryRows` | the panel label is derived from the index, not the stored preview |

**Recorded test debt, deliberately unasserted:** "a harvest-bound record renders an ACTIVE flag."
The bound row is not reliably mounted when the panel is read, so every available form of that
assertion passes by finding no icons at all — a vacuous pass, which is the exact failure DEC-032
exists to prevent. It is written into the fixture as a comment rather than shipped green.

### A green "question #1" result does NOT mean the settle loop works

Question #1 and the last question are now resolved by `ciTryExtreme()` — first renderable
entry maps to `scrollTop = 0`, last to `scrollTop = max`, recognised from the path index
with no offset derivation and no interpolation. That is deliberate: those are the two
targets an estimator handles worst, and on the live site question #1 previously failed
*deterministically* (`targetRow = 0 - 1 = -1`, "outside the rendered row range").

The consequence for reading test output: **test 23 no longer exercises the settle loop at
all.** It proves the extremes shortcut works. The mid-conversation test (test 24) is the
only assertion carrying the loop, the interpolation, the anchor updates and the bounded
map search. If you add a jump test, target the middle.

### Known coverage gap — `ciTryExtreme`'s last-row branch

`ciTryExtreme()` special-cases the first and last rows to exact scroll positions. Only the
**first**-row half is exercised. The mock has 80 messages with user turns on even indices,
so the last row (79) is an assistant message, and Navigate only ever targets questions —
`totalRows - 1` is unreachable from the panel. Confirmed by mutation: throwing inside that
branch leaves the suite at 294/294.

It is live code in production, reachable through assistant-targeted bookmark jumps. Closing
the gap needs a fixture whose final row is a user turn, which changes turn counts across
several assertions; it is recorded here rather than papered over.

### What the suite DOES prove — the positive controls

The mutation results in this document are mostly negative (X can be replaced with `throw` and
the suite stays green), and read alone they invite the wrong conclusion — that the matrix proves
nothing. The same review lens that found the Summary/Export dead zone also ran **positive
controls** on the acceptance sweep, and those results matter just as much. Recorded here so a
future session does not re-derive them or discount the sweep entirely.

| Control | Method | Result |
|---|---|---|
| The sweep can fail | injected an off-by-one-turn error into the resolution | **146 of 147 jumps fail**, naming exact rows — it is load-bearing |
| It does not race the virtualizer | `data-acn-jump-resolved` is written synchronously from the resolved element's own `data-index`, before `scrollIntoView` | no race; the assertion reads a value already committed |
| It is not circular | expected comes from the mock's structure, actual from the product's resolution | independent sources |
| The mock genuinely unmounts | node identity checked across scroll positions | real recycling, not `display:none` |
| The jump stride is coprime with the turn count | arithmetic check | the sweep visits every residue class, not a repeating subset |
| The old `-3` dead zone is gone | targeted probe | confirmed removed |

So: **the acceptance sweep is trustworthy about what it covers.** The dead zone is a coverage
boundary, not evidence that the covered part is fake. Both halves of that sentence are load-bearing.

### Live observations that no fixture has replaced

Two results the owner reported from live Firefox + Tampermonkey that are not modelled anywhere in
the suite. Both are *live measurements in the context that matters*, and both are single readings
— treat them as leads, not as settled numbers (a single run is not a measurement).

**A repeat jump to the same bookmark landed NEAR, not exact.** First click on a bookmarked Q#1
one-shotted precisely. A second click, after scrolling to the far end of the conversation,
*"wasn't exact but it was like just a bit of scroll up and it did go near"*. Resolve-on-arrival
guarantees the right message or an honest refusal — it does not guarantee identical final scroll
offsets between two jumps to the same target, and this is the only live evidence we have on that.
**It is directly the datapoint the §4.2 offset-cache backlog item asks for** ("measure a live
repeat jump first; if sub-400ms, close as satisfied-by-redesign"). Whoever picks that item up
should start from this observation rather than from zero, and should measure *landing offset*
alongside latency — the owner's report is about precision, not speed.

**A bookmark on a message whose text is literally "continue" resolved correctly** to the second
of two such messages. The owner's hypothesis was that the `Q#68` / `Q#69` badge disambiguated it;
that is not the mechanism. The record was created after the index was ready, so it carries a
message uuid and never consults text at all. Duplicate text only matters for a record with **no**
uuid — the provisional-binding case (DEC-030) and the legacy channels (DEC-034), both of which
refuse rather than guess. The result is a genuine live confirmation of the uuid path; it is not
evidence about the duplicate-text gate, which remains fixture-covered only.

### Tracing a jump

```bash
ACN_JUMP_TRACE=1 node tests/test-all-platforms.js --browser chromium
```

Sets `localStorage.acnJumpDebug` before the userscript runs and forwards its
`[ACN jump]` lines to stdout, one per iteration, so a CI run can be diffed line-for-line
against a log captured on live claude.ai with the same flag
(`localStorage.setItem('acnJumpDebug','1')`, then reload).

### Why these assertions look paranoid

An independent review lens **mutation-tested** the first version of these tests and proved
they passed against a broken implementation:

| Mutation | Old suite |
|---|---|
| jump body → `done(false, null)` | 25/25 PASS |
| index offset hardcoded to `0` | passed, landing at the *top* when asked for the *last* question |
| all text stripping disabled | test 20 PASS |
| entire tree walk → `msgs.slice()` | 25/25 PASS |
| `orbSetJumpBusy` → no-op | 47/47 PASS |
| late uncaught throw during a jump | 25/25 PASS |

They described the fix rather than failing without it — the same shape as the original
v12.0 bug, where a static mock could not fail on a virtualization break.

Rules that came out of it, worth applying to any new assertion here:

1. **Assert what the implementation RESOLVED, not ambient DOM state.** This is the
   subtlest one and it survived two rounds of hardening. "Row N is mounted and reads
   correctly" passes even when the navigator resolved a *different* message, because the
   mount window is several rows wide and an off-by-one lands inside it. Mutation-proved:
   offset forced to 0 + verification stubbed → the jump resolved the assistant reply
   instead of Question 1, suite green. The fix is the `data-acn-jump-resolved` contract
   attribute, recorded on the zone because the resolved element is detached by the
   re-render `scrollIntoView` triggers.
2. **Assert state was entered, not just exited.** `!stillBusy` is satisfied by never
   setting the flag; also assert it was *observed*.
3. **Never target a row that is always mounted.** The pinned tail makes an off-by-one
   look like success; jump targets are chosen mid-conversation for that reason.
4. **Put the contamination inside the queried node.** The sr-only test passed vacuously
   because no mock had `.sr-only` inside the element the extractor actually reads.
5. **Error checks run last, and for every platform.** Placed early they miss everything
   after them; gated to one platform they miss the other fifteen.
6. **Read identity from the backing data, never from the recycled DOM.** Rule 1 fixed
   *which* row the assertion asks about; this fixes *where it looks up the answer*. The
   first version resolved the row index durably from `data-acn-jump-resolved` and then
   turned around and read `querySelector('[data-index=N]').textContent` to check the text
   — but by then the row is frequently unmounted again, because the re-render that
   `scrollIntoView` triggers is what unmounts it. The check therefore depended on machine
   speed: it passed on Linux and macOS (window `[34..39]`, target 38 present) and failed
   on **all three** Windows engines (window `[41..46]`, target 38 gone) for an identical,
   correct jump. Use `__mockVirtualization.rowText(i)`, which reads the mock's `MESSAGES`
   array. Verified still diagnostic: with the offset forced to 0 and verification stubbed,
   both jump assertions fail with `resolved=row 1 isQ1=false` and `expected row 38,
   resolved row 39`.

   This is the product's own Layer 4 rule turned on the harness: **do not ask the DOM for
   data the index already holds.** A virtualized mock is subject to it exactly like a
   virtualized platform.

### Tests 15–25 — virtualization and jump (added v12.0)

These exist because of a structural blind spot: **every mock page except `claude-virtualized.html` is static and mounts all of its turns permanently.** When Claude virtualized its real message list — mounting ~3 of 147 turns — the entire suite stayed green while Navigate, Search, Summary and Export were all operating on ~3% of the conversation. A suite of static mocks *cannot* fail on that class of bug. See DEC-022 (Layer 4: State Breaks).

`tests/mock-pages/claude-virtualized.html` holds 40 turns in JavaScript and mounts 3, removing the rest from the document on scroll.

- **Test 15** guards the mock itself. If it stopped recycling, tests 16–17 would prove nothing.
- **Test 16** asserts the DOM is incomplete *on purpose*, so a future change that appears to fix the count without an index gets caught.
- **Test 17** asserts degraded mode is visible. The harness provides no `GM_xmlhttpRequest`, so the API fetch always fails there and the fallback banner must appear. Silent degradation is what let the original bug hide.

Both virtualized entries use real-shaped conversation uuids in their pathnames
(`/chat/11111111-…` and `/chat/22222222-…`) because `ciIsClaudeChat()` gates on that
pattern; the plain `claude.html` entry uses `/chat/test` and therefore never engages the
index path.

**Tests 18–20** guard the foundations the jump rests on: the virtualizer's positional
metadata (`data-index`, `aria-setsize`, `role="feed"`, the container attribute), the
**non-contiguous** mounted set (the pinned tail — plain set membership would give false
hits), and that `.sr-only` labels never reach the panel.

**Tests 21–22** assert the jump *terminates* and throws nothing, on both entries. On the
non-fixture entry every jump must take the honest-failure path, so what is being verified
there is termination and the absence of a wrong-message scroll — not success.

**Tests 23–25** are the primary path, fixture entry only:

- **23** — the panel lists 40 turns while the DOM holds 3. The bug and the fix in one assertion.
- **24** — jump to question #1 **from the bottom**. The assertion checks the target was
  *unmounted at click time* and mounted afterwards; without that first half it would pass
  trivially whenever the target happened to already be on screen.
- **25** — jump to the last question, busy flag cleared.

Tests 24 and 25 poll for completion rather than sleeping a fixed interval, and wait for
**both** arrival and the busy flag clearing. Waiting on arrival alone races the flag reset,
which happens after the final `scrollIntoView` — that race produced a spurious failure the
first time these ran.

---

## Summary/Export fixtures (v12.3) — how the dead zone was closed

Until v12.3, replacing `_sumBuildTimeline`, `_sumScrollToElement`, `_exportFromIndex` or
`ciIndexStamp` with an unconditional `throw` left the whole suite green — measured at
**516/516 on the parent commit with all four throwing at once**. The fixtures that closed
this are gated by two platform-config flags:

- `summaryExportTests: true` (on *Claude (virtualized + index)*) runs **S1–S5, E1, E3** (11
  assertions): whole-conversation stats (exact 81/40/41 against ~3 mounted turns; the
  furthest `data-acn-sum-end` is reported as info only — every construction path ends the
  last segment at `timeline.length-1`, so gating on it would just re-assert the total),
  the regenerate gate (the panel auto-generates on open, so only a replacement of the
  stats node by a click on a RE-ENABLED `sum-generate` button proves the attribute is
  live — the handler disables the button synchronously, and a click on a disabled button
  dispatches nothing), segment click through the jump bridge to an unmounted row,
  mounted-target resolution, the stale-stamp refusal against a REAL conversation switch,
  a separate **uuid-observed** switch/restore assertion (the shim records the requested
  conversation uuid in `__convLastUuid`; `__convFetches` alone is uuid-blind and a
  same-conversation resync would satisfy it — claude is `spa:false`, so the switch is
  scroll-nudged into existence), and the two index-complete export captures.
  **S5 + the E3 delta (v12.4)** add the compute-cache gates, delta-based on the
  `data-acn-sum-computes` zone attribute (stamped by every COMPLETED computation).
  Three gates, each with its named killing mutation:
  (1) *E3's export must recompute, exactly +1* — S4's switch/restore re-minted the
  stamp, so the export must REFUSE the panel-era cache. Two REDUNDANT defenses make
  that true (the key comparison, and `ciInvalidate`'s cache release on the switch), so
  the named killing mutation is their JOINT failure: bare `if (_sumComputeCache)` PLUS
  the release removed — measured red at exactly this gate (computes 3→3), while the
  bare key alone stays green *because the release already emptied the cache*. The
  stale serve is invisible to every content assertion (the shim serves identical
  payloads per uuid). Recorded debt: a SAME-conversation stamp bump (edit-resync — no
  switch, so no release) is ungated; staging one needs a forced-refetch shim knob
  (carried-over fixture batch), and the provSig half of the key is likewise unstaged
  (no provisional-turn knob in the shim).
  (2) *S5's export must NOT move the counter* — and S5 runs its REGENERATE leg FIRST,
  so the cache being reused is the PANEL's computation. Order is load-bearing (Tier 3
  CRITICAL, measured): with the legs reversed the export merely reused E3's
  export-time computation, and a mutant clearing `_sumComputeCache` at the end of the
  genBtn handler — a build where the exact scenario v12.4 exists for still
  double-computes — stayed green. Killing mutations: delete the cache read in
  `getSummaryForExport` (delta 1), or clear the cache in the genBtn handler (delta 1).
  The v12.3 parent has no attribute at all: NaN delta, same red. Vacuity guard: the
  gate also requires the index-complete file content — a failed export would leave the
  counter unmoved too.
  (3) *a regenerate click must move the counter by exactly one* (killing mutation:
  serve `_sumComputeCache` from `generateFullSummary`).
  Both S5 legs are preceded by the same `__convFetches` settle wait E1/E3 use — an
  index reload re-mints the stamp mid-block, the cache then CORRECTLY refuses, and
  the "no recompute" gate would red on correct code (Tier 3, four of five lenses;
  the E1 retry exists for the same race). The zone is re-queried per read, never
  cached across the block — a re-injected zone would otherwise satisfy delta-0
  vacuously through a detached node.
  **S1b — the sub-segment gate (v12.5 attach + v12.6 segmentation).** Two properties in one
  observable, because the second is what makes the first worth asserting. The entry's fixture
  now carries **three topic blocks** (`topicBlocks: true`, applied identically to the mock DOM
  and the API payload so row-to-path matching stays byte-exact), changing at turns 14 and 28 —
  timeline entries 27 and 55. S1b asserts the rendered sub-segments start at exactly
  `[0, 27, 55]`, i.e. that the map **recovers the fixture's real topic structure**, not merely
  that children exist.
  Killing mutations, both measured red against the final commit:
  (a) delete `_sumAttachSubSegments` from `_sumBuildConversationMap`'s return → `starts []`
  (the v12.5 regression); (b) replace the cohesion pass with mechanical 3-message chunking —
  *the defect that actually shipped* → `starts [0, 69, 72, 75]`.
  **Why the fixture needed changing at all, and why that is not weakening a gate:** with the
  old uniform filler text (`Answer number N: validate the input first…` ×40) the conversation
  has no topic changes, so a correct segmenter finds none and a broken one invents dozens. The
  suite could not tell those apart — which is exactly how a sub-segmenter that emitted fixed
  3-message chunks stayed green through v12.5's entire review. A fixture with no structure
  cannot gate a structure-finding feature. The topic knob is OFF for every other entry: the
  legacy-bookmark entry's previews and content hashes depend on the old strings byte-for-byte.
  **Unit-level companion:** `node probes/check-subsegments.js` drives `_sumBuildSubSegments`
  directly (via the map probe's `__acnSubSegRun`) on shapes no fixture produces — the smallest
  accepted segment, one message below it, many mutually disjoint runs, a uniform conversation, a
  one-message aside. Two GitHub Codex findings and one self-found defect all lived in exactly
  those shapes; run it alongside the suite when touching segmentation.
  **Recorded gap:** the ≤6-message map path is still structurally unfalsifiable (6 < 12, so
  `_sumBuildSubSegments` returns `[]` there regardless), and attach ORDER relative to
  `_sumMergeExcessSegments` is gated by the map harness rather than here, since every mock
  produces one top-level segment and never merges.

- `koreanSummaryTest: true` (on *Claude (Korean conversation + index)*) runs **K1a-K1c** — the
  suite's only non-English entry, added in v12.7 with the tokenizer fix (DEC-041).
  **Why it exists:** `_sumTokenize` stripped `[^a-z0-9\s]`, so a Korean conversation produced
  ZERO tokens and every content-derived Summary feature was silently empty for the product's
  only translated language. Every fixture in the suite was written in English, so nothing in CI
  could see it — the same "structurally cannot fail" shape as the pre-v12.6 sub-segmenter.
  The entry mirrors *Claude (virtualized + index)* exactly: `lang: 'ko'` on both `mockConfig`
  and `gmFixture`, same 80 messages, same three topic blocks at the same turns.
  **K1a** asserts topics exist AND every one **contains Hangul**. The second half is the
  load-bearing one: the fixture also contains ASCII turn numbers, so a tokenizer that picked up
  only those would render a non-empty topic list made entirely of noise and a
  "topics are non-empty" gate would pass on a broken build.
  **K1b** asserts sub-segment starts at `[0, 27, 55]` — the SAME positions, from the same topic
  rule, that S1b asserts in English. That makes it a gate on segmentation *quality* in Korean
  rather than on mere presence.
  *Expect K1a's reported topics to be BOILERPLATE, e.g. `질문 입력`, `입력 값이`.* Every fixture
  question shares one base sentence, so its words are the highest-frequency terms in the
  conversation and they dominate the global topic list. That is a property of the fixture, not
  of the tokenizer, and it is symmetric — the English entries produce `question number` and
  `handle case` for the same reason. K1a is deliberately a check on *what script the terms are
  in*, not on whether they are interesting; K1b is what gates whether the topic BLOCKS were
  actually found. Do not "fix" K1a by asserting specific topic words: they would be asserting
  the fixture's preamble.
  **K1c** asserts the Summary still covers the full 81-entry index with <40 turns mounted, so a
  Korean user is not quietly on the Layer 4 degraded path.
  **Killing mutation, MEASURED (not asserted) 2026-08-02:** run this entry with
  `ACN_SCRIPT=<pre-v12.7 build>` and K1a reports `0 topics: []` while K1b reports `starts []`
  against the expected `[0, 27, 55]` — 2 of 31 red. **K1c stays green under that mutation, and
  that is correct:** it gates Layer 4 index coverage, which no tokenizer change touches. Only
  K1a and K1b are tokenizer-gated; stating all three would overclaim the gate.
  **Why the BASE text is Korean too, not just the topic sentence:** built on the English base
  text (`Question number N: how do I handle...`), every message would still hand the old
  tokenizer English tokens, and the fixture could not have gone red. Three generic Claude
  assertions that identify a resolved row by its question text are parameterized on the
  fixture language for the same reason (`qPat`/`qAnyPat` in `testPlatform`); every English
  entry takes the unchanged branch.
  **Deliberately NOT the full S1-S4/E1/E3 battery:** those assert on English fixture text, and
  re-expressing them in Korean would gate the same jump and export machinery twice while
  gating the tokenizer once.
  **Unit-level companion:** `node probes/check-tokenizer.js` drives `_sumTokenize` directly
  (via the map probe's `__acnTokenizeRun`) — 11 checks, several of which exist to stop a claim
  drifting rather than to catch a bug: **T8** asserts the LIMIT that Japanese stays coarse, so
  "Korean works" cannot later be re-described as "Unicode support"; **T9** asserts that × and ÷
  SPLIT tokens rather than glue them, gating the Tier 3 finding that those two characters are
  the only non-letters inside `\u00c0-\u024f` and that writing the range as one span makes
  `1920×1080` a single token. T9 checks the split, not the absence of the characters — a build
  that dropped the whole run would pass the weaker form.
  **T10/T11** assert that decomposed (NFD) text tokenizes **identically to composed (NFC)** text,
  in Korean and in accented English. Both assert EQUALITY with the NFC result rather than
  non-emptiness: NFD Korean's failure mode was emptiness, but NFD Latin's was *corruption*
  (`résumé` → `sume`), and a non-empty check would have passed that. macOS emits NFD for Korean
  input, so this is a real input shape rather than a theoretical one (GitHub Codex, PR #70).

- `degradedExportTest: true` (on *Claude (virtualized)*) runs **E2**: the export must carry
  the DEGRADED source label and a header total EXACTLY equal to the derived window size
  (`2·userWindowSize + 1`; deterministic on this mock — measured 7 every run). Round 2
  proved every looser form vacuous: bounds 4..12 bounded nothing, and header-vs-parenthetical
  is an identity in this code path (a degraded DOM scan cannot produce falsy elements, so
  `buildTimeline` drops nothing) — that comparison is kept as a cross-check but is NOT
  load-bearing, and a fixture where the two can genuinely diverge is recorded debt.

All are **mutant-gated**, per function and individually verified against the committed
state: `ciIndexStamp` and `_sumBuildTimeline` kill generation (S1 + cascade),
`_sumScrollToElement` kills exactly the three click fixtures, `_exportFromIndex` kills
exactly E1. The regenerate gate and the FIXTURE PRESENCE check were additionally
mutation-verified (attribute moved off the button → red; E2 re-nested → presence red).

**FIXTURE PRESENCE check:** each opt-in flag declares the assertion titles it must
produce; an entry finishing without them fails hard. This exists because the first E2 was
nested where its entry could never reach it — unreachable, green, and claimed as coverage
in three docs (Tier 3 CRITICAL). Silent non-execution is now a failure class the harness
itself detects.

**Download capture:** exports are asserted by content via `DOWNLOAD_SHIM` (gated to the
two export entries), which patches `URL.createObjectURL`/`revokeObjectURL` and the
anchor-click in-page and records `{filename, blob}` into `window.__acnTestDownloads`.
**Scope, on the record:** the harness inlines the userscript into the page realm, so this
capture is page-realm-scoped — it structurally cannot detect an export break caused by
cross-compartment Blob/anchor handling in the real Tampermonkey sandbox (the DEC-019/020
context split). Live confirmation remains the only evidence for that realm.

**The charset lesson:** the harness now serves `<meta charset="utf-8">` + a charset'd
Content-Type. Without them the browser decoded the inlined userscript as windows-1252 and
every literal non-ASCII character was mojibake in-page — invisible until E2 became the
first assertion to compare one ('— DEGRADED' never matched). If an assertion on a literal
non-ASCII string inexplicably fails, check `document.characterSet` first.

**What is deliberately not asserted:** `busySeen` (whether a 110ms poll observed the busy
flag) is reported in failure details but never part of a pass condition — it flipped between
two identical local runs, the DEC-025 machine-speed shape. Route identity ("did the click
use the bridge?") is asserted structurally instead: a target proven unmounted at click time
that ends resolved at row 0 cannot have gotten there any other way. Likewise the
conversation-id HALF of `ciIndexStamp` is defense-in-depth S4 cannot isolate (every rebuild
also bumps the global generation) — recorded in the fixture, not faked. And because the
shim serves an identical payload for every uuid, S4 proves the refusal FIRES but cannot
distinguish a correct refusal from a false-positive one, and no content assertion downstream
could detect a missed restore — the uuid observable is the whole restore gate. The
post-block panel restore is correct but currently not load-bearing (ablation-verified green
without it); it guards the real `orbPanel`-gated re-render mechanism for future fixtures.

**Recorded debt:** `exportBookmarks()`, the Tools gallery/commands sections, and the
degraded-session summary paths (`_sumElKey` staleness branch, sub-segment and inventory
click handlers) remain unexecuted; the fixture produces a single map segment, so
multi-segment segmentation is unexercised; E1 carries one announced retry for the
scan-tick race after S4's switch (degradation-when-unready has its own dedicated test, E2).
**v12.4 adds:** the fixture's shim texts contain no `KEY_POINT_PATTERNS` matches, so key
points are always `[]` here and the dedup early-stop (`_sumDeduplicatePoints` cap) has no
fixture that could catch a wrong result — any assertion on it today would be vacuous
(DEC-032). It is covered by the append-only equivalence argument in the code comment plus
an empirical check: the probes harness (key-point-rich payload) exported byte-identical
Key Points before/after the change. **Scope of that byte-identity (Tier 3 skeptic):** the
probe drives generate→export with no scroll between them and its mock renders no
`pre`/`img`/`a[href]`, so only the API-text derivation branch executes — the check proves
the dedup change, and structurally cannot see mount-window divergence in
entities/inventory (the DEC-028 shape: a fixture whose two sides always agree). That
divergence is a *documented, accepted* cache property (see the `getSummaryForExport`
comment), pre-existing in mechanism: tool/artifact answers render more than their API
text carries, so the mounted-DOM and text branches of `_sumInventoryCodeAndFiles`
disagree by construction on those answers. Follow-up recorded: thread the index's
existing `toolBlocks` extraction into the summary's unmounted inventory branch, which
shrinks the divergence at its source. Also recorded, pre-existing: a throw inside
`renderSummaryResults` would strand the generate button on "Analyzing…" (the try/catch
covers only `generateFullSummary`), which S5's regenerate leg would report as
'generate button never re-enabled'. A key-point-bearing shim knob belongs to the
carried-over fixture batch.

---

## Platform Configuration — The PLATFORMS Array

The `PLATFORMS` array in `test-all-platforms.js` is the **central configuration** for all tests. Each entry defines one platform variant.

### Field Reference

```javascript
{
    name: 'Claude',            // Display name in test output
    mockFile: 'claude.html',   // File in tests/mock-pages/ to load
    hostname: 'claude.ai',     // The hostname the browser will "visit"
    pathname: '/chat/test',    // The URL path (some platforms check this)
    expectedMessages: 3,       // How many user messages the mock page contains
    expectedAccent: '#d97706', // Expected data-acn-accent hex string
    expectedMode: 'orbital',   // Expected data-acn-ui value: 'orbital' or 'legacy'
}
```

**Field details:**

| Field | Type | Purpose | Where It's Used |
|-------|------|---------|-----------------|
| `name` | string | Human-readable label printed in test output | Console output only |
| `mockFile` | string | Filename within `tests/mock-pages/` | `buildTestPage()` reads this file |
| `hostname` | string | Must match a hostname that one of the `PLATFORMS` registry's `match()` functions accepts | Used to construct the URL for `page.goto()` and `page.route()` |
| `pathname` | string | URL path — matters for platforms with path guards (e.g., Lovable requires `/projects/`) | Appended to hostname for the target URL |
| `expectedMessages` | number | Exact count of user messages in the mock HTML | Test 9 compares this to the count of `[data-acn-role="nav-item"]` elements |
| `expectedAccent` | string | Hex color of the platform's accent (from `ORB_COLORS` or `theme.accent` in the registry) | Test 5 compares this to the `data-acn-accent` attribute on the zone element |
| `expectedMode` | string | `'orbital'` or `'legacy'` — which UI system the platform should use | Test 13 compares this to the `data-acn-ui` attribute on the zone element |

### Current Platforms

| name | hostname | mockFile | expectedMessages | expectedAccent |
|------|----------|----------|-----------------|----------------|
| Claude | claude.ai | claude.html | 3 | `#d97706` |
| Claude Code | claude.ai | claude-code.html | 3 | `#d97706` |
| Claude (virtualized) | claude.ai | claude-virtualized.html | 3 (of 40 real turns) | `#d97706` |
| Claude (virtualized + index) | claude.ai | claude-virtualized.html | 40 (whole conversation) | `#d97706` |
| ChatGPT | chatgpt.com | chatgpt.html | 4 | `#ffffff` |
| Codex Web | chatgpt.com | codex.html | 2 | `#ffffff` |
| Grok | grok.com | grok.html | 3 | `#e53e3e` |
| Gemini | gemini.google.com | gemini.html | 3 | `#4285f4` |
| Bolt.new | bolt.new | bolt.html | 3 | `#38BDF8` |
| Lovable | lovable.dev | lovable.html | 4 | `#9b87f5` |
| Replit | replit.com | replit.html | 3 | `#F26522` |
| V0 | v0.app | v0.html | 3 | `#ffffff` |
| Base44 | app.base44.com | base44.html | 3 | `#6366f1` |
| Emergent | app.emergent.sh | emergent.html | 3 | `#10b981` |
| Perplexity | www.perplexity.ai | perplexity.html | 3 | `#20b2aa` |
| Firebase Studio | 6000-firebase-studio-12345.cluster-abc123.cloudworkstations.dev | firebase.html | 3 | `#FFA611` |

**Note on the virtualized entry:** `expectedMessages: 3` is the *mounted window*, not the conversation — the mock holds 40 turns. That is the point: it asserts the DOM is incomplete. Its `pathname` is a real-shaped conversation uuid so the userscript's conversation-index path engages and the degraded banner can be tested.

**Note on accent sources:** Orbital platforms (Claude, ChatGPT, Grok, Gemini, Perplexity) source their accent from `ORB_COLORS[platform.id].bg`. Legacy app-builder platforms source theirs from `platform.theme.accent` — each platform has its own brand color (Bolt sky blue, Lovable violet, Replit orange, etc.).

**Note on sub-platforms:** Claude and Claude Code both use `hostname: 'claude.ai'` but different mock files and different `pathname` values. The userscript detects both as the `claude` platform and uses a fallback chain — primary selectors work for Claude Chat, and a later link in the chain catches Claude Code. (As of v12.0 the live primary is `data-testid="user-message"`; `data-testid="user-human-turn"` was removed from Claude's DOM and now sits later in the chain — see DOM-REFERENCE.md.) The mock pages are designed so that Claude Chat's mock has `data-testid` attributes (primary selectors match) and Claude Code's mock does NOT have `data-testid` attributes (primary selectors find 0, fallback activates).

Same pattern for ChatGPT vs Codex: ChatGPT mock has `data-message-author-role="user"` attributes, Codex mock does not.

---

## Mock DOM Pages — Anatomy and Rules

### What a Mock Page Must Contain

Each mock HTML file in `tests/mock-pages/` must:

1. **Be a valid HTML document** with `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>` tags
2. **Contain user messages and assistant messages** in the DOM structure that the userscript's selectors expect
3. **Use the exact CSS classes, data attributes, and nesting** that the userscript targets
4. **Include HTML comments** explaining which selectors each element is designed to match
5. **NOT include any `<script>` tags** — the test runner injects the userscript automatically

The test runner extracts everything between `<body>` and `</body>` and drops it into its own test page template. Your `<head>` content is ignored.

### How Mock Pages Map to Userscript Selectors

Each platform in the `PLATFORMS` registry defines a `getUserMessages()` method that returns the DOM elements for user messages. Each method tries a series of CSS selectors in order (primary → fallback 1 → fallback 2 → etc.). The mock page must contain elements that match **at least one** of these selectors.

**Rule of thumb:** Design the mock to match the **primary selector** for its platform. If you're testing a fallback path (like Claude Code or Codex), design the mock so the primary selector finds 0 results and the fallback kicks in.

### Per-Platform Selector ↔ Mock DOM Reference

Below is the exact mapping between what the userscript looks for and what each mock page provides. This is the critical reference for building mock pages.

---

#### Claude (`claude.html`)

**Userscript selectors (in order):**
1. `[data-testid="user-human-turn"]` ← PRIMARY
2. `[data-testid="user-message"]`
3. `.font-user-message`
4. `div.bg-bg-200.rounded-lg` inside `.items-end` (Claude Code fallback)

**Mock page provides:**
```html
<div data-testid="user-human-turn">  <!-- Matches selector 1 -->
  <p>User question text here</p>
</div>
<div data-testid="assistant-turn">   <!-- NOT matched (no "user" in testid) -->
  <p>Assistant response here</p>
</div>
```

**Why it works:** The mock uses `data-testid="user-human-turn"` which matches the primary selector. The assistant messages use `data-testid="assistant-turn"` which doesn't match any user-message selector. Simple and clean.

---

#### Claude Code (`claude-code.html`)

**Userscript selectors:** Same as Claude (shares hostname `claude.ai`), but primary selectors find 0 results → fallback #4 activates.

**Mock page provides:**
```html
<!-- NO data-testid attributes anywhere → selectors 1-3 find 0 results -->
<div class="items-end" style="display:flex;flex-direction:column;align-items:flex-end;">
  <div class="bg-bg-200 rounded-lg" style="padding:12px;">  <!-- Matches fallback #4 -->
    <p>User question text here</p>
  </div>
</div>
<div class="assistant-message" style="width:100%;">  <!-- NOT matched -->
  <p>Assistant response here</p>
</div>
```

**Why it works:** No `data-testid` attributes exist, so the userscript exhausts selectors 1-3, then the fallback queries `div.bg-bg-200.rounded-lg` and filters for elements inside `.items-end` containers. The assistant messages use class `assistant-message` (not `bg-bg-200`), so they're excluded.

---

#### ChatGPT (`chatgpt.html`)

**Userscript selectors:**
1. `[data-message-author-role]` filtered to `role === 'user'` ← PRIMARY
2. `div.self-end.bg-token-bg-tertiary` (Codex fallback)

**Mock page provides:**
```html
<div data-message-author-role="user">       <!-- Matches selector 1 -->
  <p>User question text here</p>
</div>
<div data-message-author-role="assistant">  <!-- Excluded by role filter -->
  <p>Assistant response here</p>
</div>
```

---

#### Codex Web (`codex.html`)

**Userscript selectors:** Same as ChatGPT (shares hostname `chatgpt.com`), but primary selector finds 0 → fallback #2 activates.

**Mock page provides:**
```html
<!-- NO data-message-author-role attributes → selector 1 finds 0 -->
<div class="self-end bg-token-bg-tertiary" style="...">  <!-- Matches fallback #2 -->
  <p>User question text here</p>
</div>
<div class="assistant-response" style="width:100%;">  <!-- NOT matched -->
  <p>Assistant response here</p>
</div>
```

---

#### Grok (`grok.html`)

**Userscript selectors:**
1. `div.message-bubble` → filtered by `.user`/`.human` class, parent selectors, or even-index ← PRIMARY
2. `[data-role="user"]`
3. `[class*="user-message"]`

**Mock page provides:**
```html
<div class="message-bubble user">       <!-- Matches: has .user class -->
  <p>User question text here</p>
</div>
<div class="message-bubble assistant">  <!-- Excluded: no .user/.human class, odd index -->
  <p>Assistant response here</p>
</div>
```

**Why it works:** The filter checks `classList.includes('user')` first — the mock uses class `user` on user messages and `assistant` on assistant messages, so the filter correctly includes/excludes.

---

#### Gemini (`gemini.html`)

**Userscript selectors:**
1. `div.query-text` ← PRIMARY
2. `.query-text-line`
3. `p.query-text-line`
4. `[data-query-text]`
5. `.user-query`

**Mock page provides:**
```html
<div class="query-text">       <!-- Matches selector 1 -->
  <p>User question text here</p>
</div>
<div class="response-text">   <!-- NOT matched (different class) -->
  <p>Assistant response here</p>
</div>
```

---

#### Bolt.new (`bolt.html`)

**Userscript selectors (in order):**
1. `[data-message-id]` → filtered by `self-end` class or `bg-bolt-elements-messages` ← PRIMARY
2. `.self-end[class*="bg-bolt-elements"]` — alternate attribute match
3. `[class*="_MarkdownContent_"]` inside `.self-end` parents
4. `[class*="backdrop-blur"][class*="rounded"]` → filtered to exclude `w-full` (bolt.diy fork compat)
5. `.ml-auto.rounded-lg, .ml-auto.rounded-xl`
6. `.grid.w-full > div` → filtered to exclude `overflow-hidden` + `w-full`

**All selectors exclude** `subscribeButton` and `prompt-subscribe` areas (token/subscription warnings).

**Mock page provides:**
```html
<div class="grid w-full" style="display:grid;gap:16px;">
  <!-- User: data-message-id + self-end + bolt-specific background -->
  <div data-message-id="msg-1" class="self-end bg-bolt-elements-messages-background rounded-lg">
    <div class="_MarkdownContent_1fihl_1">
      <p>User question text here</p>
    </div>
  </div>
  <!-- Assistant: has data-message-id but NO self-end -->
  <div data-message-id="msg-2" class="overflow-hidden w-full">
    <p>Assistant response here</p>
  </div>
</div>
<!-- Token warning (should NOT be detected) -->
<div class="bg-bolt-elements-prompt-subscribeButton-background">
  <span>You've used all your tokens.</span>
</div>
```

**Why it works:** The primary selector queries all `[data-message-id]` elements but only keeps those with `self-end` class (user messages). Assistant messages have `data-message-id` but no `self-end`, so they're filtered out. The token warning is outside any `[data-message-id]` container and is also excluded by the `subscribeButton` filter as a safety net.

---

#### Lovable (`lovable.html`)

**Userscript selectors:**
1. **Path guard:** `window.location.pathname.includes('/projects/')` — if this fails, no selectors run
2. `div[role="log"] .justify-end` → filtered for non-empty text ← PRIMARY
3. `div.bg-neutral-200.rounded-xl, div.bg-neutral-700.rounded-xl` inside `.justify-end`
4. `div.ChatMessageContainer .justify-end`
5. `div.self-end[class*="bg-neutral"]`
6. `main` → all `div` → filtered by alignment + text + not-nav heuristics

**Mock page provides:**
```html
<main>
  <div class="chat-panel">
    <div role="log" aria-label="Chat messages">
      <!-- User: justify-end wrapper (matches selector 2) -->
      <div class="flex justify-end" style="display:flex;justify-content:flex-end;">
        <div class="bg-neutral-200 rounded-xl ml-auto" style="...">
          <p>User question text here</p>
        </div>
      </div>
      <!-- Assistant: justify-start (NOT matched) -->
      <div class="flex justify-start">
        <div class="prose">
          <p>Assistant response here</p>
        </div>
      </div>
    </div>
  </div>
</main>
```

**Critical:** The `pathname` in the PLATFORMS config MUST include `/projects/` — e.g., `/projects/test-project`. Without this, the path guard fails and the userscript skips all selectors for Lovable.

---

#### Replit (`replit.html`)

**Userscript selectors (confirmed via live DOM inspection, Feb 2026):**
1. `[data-cy="user-message"]` (Cypress test attribute) ← PRIMARY
2. `[data-event-type="user-message"]` (alternate attribute on same element)
3. `[class*="EventRenderer"][class*="userMessage"]` with text-content dedup
4. `[role="log"]` → child divs → filtered by computed style
5. `textarea[placeholder*="message"]` → parent chain → filtered by alignment heuristics

**Mock page provides:**
```html
<div class="EventRenderer-module_RTGgnG_userMessage">
  <div data-cy="user-message" data-event-type="user-message">
    <div class="UserMessage-module_wrN9Aa_userMessageSurfaceShades">
      <span><div class="UserMessage-module_wrN9Aa_userMessageSurfaceShades">
        <div class="rendered-markdown"><p>User question text here</p></div>
      </div></span>
    </div>
  </div>
</div>
```

**Why it works:** The primary selector `[data-cy="user-message"]` targets exactly one element per user message (element B in the A→H hierarchy). Replit uses `data-cy` (Cypress), NOT `data-testid`. The mock replicates the real nested structure with CSS module classes that caused the v7.5 3x duplication bug — see TROUBLESHOOTING.md for the full diagnosis.

**Important:** Replit uses Emotion CSS-in-JS with hashed class names that change every deployment. The selectors use `data-cy` attributes (stable) rather than class names (unstable).

---

#### V0 (`v0.html`)

**Userscript selectors (confirmed via live DOM inspection, Feb 2026):**
1. `[data-testid="message"]` → filtered by `origin-right` + `items-end` classes ← PRIMARY
2. `[data-testid="message"]` → filtered by `items-end` only (fallback if `origin-right` changes)
3. `bg-v0-gray-200` / `group/message-bubble` bubble class
4. `role="listitem"` with alignment check

**Mock page provides:**
```html
<div data-testid="message" class="origin-right items-end" role="listitem">
  <div class="group/message-bubble bg-v0-gray-200">
    <p>User question text here</p>
  </div>
</div>
<div data-testid="message" class="origin-left items-start" role="listitem">
  <div class="group/message-bubble">
    <p>Assistant response here</p>
  </div>
</div>
```

**Why it works:** V0 uses `data-testid="message"` on ALL messages (user + AI). User messages have `origin-right items-end` classes; AI messages have `origin-left items-start`. The primary selector queries all `[data-testid="message"]` elements then filters by both class names to select only user messages.

---

#### Base44 (`base44.html`)

**Userscript selectors:**
1. `[id^="message-"]` → filtered by presence of `.justify-end` child ← PRIMARY
2. `.bg-slate-200.rounded-xl`

**Mock page provides:**
```html
<div id="message-uuid-1" class="mb-4">
  <div class="flex justify-end">
    <div class="bg-slate-200 rounded-xl"><p>User question here</p></div>
  </div>
</div>
<div id="message-uuid-2" class="mb-4">
  <div class="flex justify-start">
    <div class="prose"><p>Assistant response here</p></div>
  </div>
</div>
```

**Why it works:** Both user and assistant messages have `id="message-{uuid}"`, but only user messages have a `.justify-end` child. The filter `el.querySelector('.justify-end')` passes for user messages and fails for assistant messages.

---

#### Emergent (`emergent.html`)

**Userscript selectors (confirmed via live DOM inspection, Feb 2026):**
1. `[data-testid^="user-message"]` + innermost nesting dedup ← PRIMARY
2. `[id^="user-task"]` — ID-based fallback

**Note:** Broad fallbacks 3-7 (`rounded-br-none`, `items-end`, `text-wrap`, `select-text`, chat container scan) were removed in v7.7 because they matched AI agent status messages during virtual scroll recycling. Only the primary selector and ID fallback remain.

**Mock page provides:**
```html
<div data-testid="virtuoso-scroller" style="...">
  <div data-testid="user-message-user-task-1" id="user-task-1" class="mb-4">
    <div class="prose prose-invert max-w-none">
      <p>User question text here</p>
    </div>
  </div>
  <div data-testid="assistant-message-1" class="mb-4">
    <div class="prose prose-invert max-w-none">
      <p>Assistant response here</p>
    </div>
  </div>
</div>
```

**Why it works:** The `^=` (starts-with) selector matches `data-testid="user-message-user-task-1"` but not `data-testid="assistant-message-1"`. Emergent uses virtuoso virtual scrolling — only visible DOM elements exist — so the script uses accumulative scanning: `scanConversation` keeps messages across scans instead of clearing. (CHANGELOG v7.7 and DOM-REFERENCE also described a "scroll-through collection" pass; **that was never implemented** — see `ROADMAP.md` backlog item 7.)

---

#### Perplexity (`perplexity.html`)

**Userscript selectors:**
1. `.group\/query` (Tailwind group variant class) ← PRIMARY
2. `.group\/title .select-text`

**Mock page provides:**
```html
<div class="group/query">
  <span class="select-text">User question text here</span>
</div>
<div class="response-container">
  <p>AI response here with citations...</p>
</div>
```

**Why it works:** Perplexity uses Tailwind's group variant feature, assigning `.group/query` to each user query block. The `/` in the class name is escaped as `\/` in CSS selectors. This is a semantic class name rather than a styling utility, making it very stable.

---

#### Firebase Studio (`firebase.html`)

**Userscript selectors:**
1. `[class*="_isUser_"]` (CSS Modules partial match) ← PRIMARY
2. `[class*="_chatMessage_"]` → filtered by `_isUser_` in className string

**Mock page provides:**
```html
<div class="_chatMessage_abc123 _isUser_def456">
  <p>User question text here</p>
</div>
<div class="_chatMessage_abc123 _isAssistant_ghi789">
  <p>Assistant response here</p>
</div>
```

**Why it works:** Firebase Studio uses CSS Modules which generate class names like `_isUser_abc123` with a hash suffix that changes per build. The `*=` (contains) attribute selector matches any class containing the `_isUser_` substring, which remains stable across deployments. Assistant messages use `_isAssistant_` which doesn't contain `_isUser_`.

---

## Step-by-Step: Adding a New Platform

When you add support for a new website to the userscript, follow these steps to add it to the test suite:

### Step 1: Study the userscript changes

Before building the mock, you need to know exactly what selectors the userscript uses for the new platform. Look at:

1. **`PLATFORMS` registry** — what `match()` function was added? What hostname does it check?
2. **`theme`** — what's the accent color hex value?
3. **`icon`** — what Unicode character?
4. **`title`** — what display name?
5. **`getUserMessages()`** — what selectors, in what order? Any path guards? Any filters?
6. **`layout`** — `'standard'` or `'left-chat'`? If left-chat, what `boundarySelectors`?
7. **`spa`**, **`virtualScroll`**, **`pathGuard`** — any special behaviors?

### Step 2: Create the mock HTML file

Create `tests/mock-pages/newsite.html`:

```html
<!DOCTYPE html>
<html><head><title>NewSite Mock</title></head>
<body>
<!-- COMMENT: Explain what selectors this DOM is designed to match -->
<!-- COMMENT: Reference the source of your DOM knowledge (DevTools, open-source fork, etc.) -->

<!-- User message: explain which selector/filter this matches -->
<div class="the-exact-classes-the-selector-targets" data-whatever="user">
  <p>First user question goes here</p>
</div>

<!-- Assistant message: explain why this is NOT matched -->
<div class="different-classes" data-whatever="assistant">
  <p>First assistant response goes here</p>
</div>

<!-- User message -->
<div class="the-exact-classes-the-selector-targets" data-whatever="user">
  <p>Second user question goes here</p>
</div>

<!-- Add at least 2-4 user messages and 1-3 assistant messages -->
<!-- Count your user messages carefully — this count becomes expectedMessages -->

</body>
</html>
```

**Rules:**
- Use the **exact CSS classes and attributes** the userscript selectors target
- Include both user AND assistant messages to verify the selectors correctly exclude assistant messages
- Add **inline `style` attributes** if the userscript uses computed style checks (e.g., `backgroundColor`, `marginLeft`)
- Add **HTML comments** documenting which selector each element matches
- Count your user messages — this must match `expectedMessages` exactly
- Do NOT include `<script>` tags — the test runner injects the userscript

### Step 3: Add the PLATFORMS entry

Add an entry to the `PLATFORMS` array in `tests/test-all-platforms.js`:

```javascript
{
    name: 'NewSite',
    mockFile: 'newsite.html',
    hostname: 'newsite.com',           // Must match detectSite() condition
    pathname: '/some/path',            // Must satisfy any path guards
    expectedMessages: 3,               // Exact count of user messages in mock
    expectedAccent: 'rgb(R, G, B)',    // Convert hex to rgb() format
    expectedIcon: '\uXXXX',           // Unicode escape of the icon character
},
```

**How to get the RGB value:** Convert the hex color from the platform's `theme.accent` field.
- `#d97706` → `rgb(217, 119, 6)` — use any hex-to-rgb converter
- Or: `parseInt('d9', 16)` = 217, `parseInt('77', 16)` = 119, `parseInt('06', 16)` = 6

**How to get the Unicode escape:** Look at the platform's `icon` field in the `PLATFORMS` registry. Copy the exact value, including any variation selectors (e.g., `\uFE0E` for text presentation).

### Step 4: Update the userscript

If you haven't already, add the new platform to the userscript itself — see the "Adding Support for New Platforms" section in README.md. In v8.0+, this is just adding ONE entry to the `PLATFORMS` registry plus the `@match` URL in the userscript header.

### Step 5: Run the tests

```bash
./tests/run-tests.sh
```

The new platform should appear in the output. If any tests fail, the detailed report will tell you exactly which test and why.

### Step 6: Iterate

Common first-run failures:
- **"Toggle button exists: Missing"** — The `hostname` in the test PLATFORMS config doesn't match any `match()` function in the userscript's `PLATFORMS` registry. Check for typos or `.includes()` vs `===` differences.
- **"Message count: Expected 3, got 0"** — The mock DOM doesn't match any selector in `getUserMessages()`. Check class names, attribute names, nesting.
- **"Message count: Expected 3, got 5"** — The selectors are matching assistant messages too. Check that your assistant message elements use different classes/attributes.
- **"Theme accent color: Expected ..., got ..."** — The RGB conversion is wrong. Double-check hex-to-rgb.

---

## Debugging Failed Tests

### Adding console.log to the userscript

You can temporarily add logging to the userscript and it will be captured by Playwright. Add console captures in the test runner:

```javascript
// Add before page.goto() in testPlatform():
page.on('console', msg => console.log(`  [browser] ${msg.text()}`));
```

This will print all `console.log()` output from the userscript to your terminal, including the "AI Conversation Navigator v8.0 loaded for Claude!" message and any debug logging you add.

### Taking screenshots

Add this after the wait timeout in `testPlatform()`:

```javascript
await page.screenshot({ path: `/tmp/test-${platform.name.replace(/[^a-z0-9]/gi, '-')}.png` });
```

This saves a screenshot of what the headless browser sees — useful for visual debugging.

### Running a single platform

To test just one platform, temporarily comment out the others in the `PLATFORMS` array, or add a name filter:

```javascript
// In main(), change the loop:
for (const platform of PLATFORMS.filter(p => p.name === 'Bolt.new')) {
```

### CI: reading a webkit-on-macos failure or hang (2026-07-30 incident signature)

Healthy CI jobs run **5m41s–9m47s**. Twice on 2026-07-30, `webkit on macos-latest` ran
**40–75+ minutes** on code that had passed the identical check minutes earlier — same commit
content, same `macos-26-arm64` image, same Playwright WebKit build (26.5 / v2336) — failing one
acceptance entry with `got null` jumps pinned at the product's give-up ceiling (settle cap ×
iteration cap ≈ 4.3–5.4s each), **consecutive in visit order**, while sibling acceptance entries
on the same run stayed exact at ~300ms. That signature is a **degraded runner episode**, not a
code regression. The mac WebKit port is the only Cocoa WebKit in the matrix — Linux and Windows
run GTK/WPE builds — so a mac-port/host pathology shows up on exactly one job.

How to respond:

1. **Check the per-entry wall clocks** in the log (printed since this incident: `PASS (…, 13.0s)`
   live and `(13.0s)` in the detailed report). A stuck job's streaming log ends at
   `Testing <entry>...` — that names where the time went.
2. **Check `vis=` / `raf10=` on the failure lines.** `raf10` is wall-clock ms for 10
   `requestAnimationFrame` frames sampled at failure time: **~160ms is healthy**; seconds means
   the engine was throttling rAF (which starves the mock's render loop and makes the product's
   jump give up honestly); `-1` means rAF stopped outright.
3. **Re-run the job once** (`gh run rerun <run-id> --failed`). A fresh runner has consistently
   come back green in ~6 minutes on the same commit.
4. If it fails again with healthy `raf10` numbers and exact-but-wrong rows rather than nulls,
   it is NOT this signature — treat it as a real finding (the Windows rule below applies:
   a runner-specific failure is usually a real statement about an assertion).

The workflow's `timeout-minutes: 20` (2× the slowest healthy job) makes a wedged runner fail
fast instead of blocking the check for up to GitHub's 6-hour default. Queue time doesn't count
against it.

#### A second variant, observed 2026-08-01 (v12.5 branch): the SILENT wedge

Same job, different shape — and it matters because step 4 above ("if it fails again, treat it
as a real finding") would misfile it. Four attempts across three heads of
`perf/summary-map-v12.5` hit `timeout-minutes: 20` having printed **no assertion output at
all**: the streaming log runs healthy (`8.1s`, `44.2s`, `28.3s`, `56.2s` — normal for those
entries), then stops mid-entry and emits nothing until the cap. There are no `got null` lines,
no `raf10` numbers, nothing to read — the process simply stops producing output.

What rules the code out, and it is worth stating in this order:

1. **The tested bytes were identical across passes and wedges.** `ai-conversation-navigator.user.js`,
   `tests/` and `.github/` are byte-identical between `b1bad36` (**pass, 6m01s**), `41e70d6`
   (**pass, 5m54s**) and the three wedging heads — the diffs between them touch only `probes/`
   and `reviews/`, which the suite never reads. Same input, both outcomes.
2. **The other two WebKit jobs stayed green throughout** (ubuntu 6m19s, windows 5m53s), so it
   is not a WebKit-engine interaction — consistent with the mac port being the only Cocoa
   WebKit in the matrix.
3. **The wedge point moved between attempts** — `80 rows, Q#1 is a file chip` twice and
   `120 rows, hostile` twice — so it is not one entry hanging. Every wedge did land in the
   window immediately after the heaviest virtualized entry (`294 rows, N=10 unrendered`, ~56s),
   which reads like host resource exhaustion rather than a hang in any particular assertion.
4. **Requeue-once did not clear it** (the documented response); a second requeue also wedged,
   ~65 minutes after the first. `githubstatus.com` reported Actions fully operational
   throughout, so "no incident posted" is not evidence of a healthy pool.

**How it ended, recorded because the prediction was testable:** the next run — a docs-only push
~12 minutes after the last wedge — came back **green at 6m04s** on the same suite and the same
userscript. The episode lasted roughly 65 minutes (04:05–05:11 UTC) and then simply stopped.
That is the environmental read confirmed, not merely assumed.

Response when this variant appears: do **not** keep requeuing (three attempts is already past
useful), and do not read it as a code finding — but do not silently discount it either. Record
the pass/wedge pairs with their commits, note that a required check is red for environmental
reasons, and hand the merge decision to the owner: a later requeue once the pool recovers (which
is what worked here), or an explicit admin merge with this record attached.

---

## Limitations and Caveats

### What mock testing catches

- Selector logic bugs (wrong class name, missing filter, off-by-one)
- Theme/icon mismatches
- UI rendering errors (toggle, panel, open/close behavior)
- Summary generation bugs
- Click handler errors
- Regressions when modifying existing platform support

### What mock testing CANNOT catch

| Limitation | Why | Mitigation |
|-----------|-----|-----------|
| Real site DOM changes | The mock is a static snapshot; the real site may have changed its HTML since the mock was built | Periodically open the real site in DevTools and compare against the mock; update the mock if selectors drift |
| Dynamic content loading | Real sites load messages via API calls and render them asynchronously; mocks have all messages pre-rendered | If a site lazy-loads messages, the userscript's `MutationObserver` handles it — but the test can't verify that path |
| CSS-in-JS hash instability | Replit's Emotion classes change per deployment; our mock uses a frozen snapshot of `data-testid` attributes | The mock tests the "happy path" (data-testid exists). If Replit removes data-testid, the fallback selectors activate — test a separate mock for that path if needed |
| SPA navigation | The test loads the page once; it doesn't simulate route changes or conversation switching | The SPA hooks (pushState/replaceState interception) are tested implicitly — they exist in the script — but their behavior on navigation isn't exercised |
| CSP (Content Security Policy) | Some sites (Gemini) have strict CSP that blocks inline scripts; the test pages have no CSP | The userscript avoids `innerHTML` (uses `createElement` + `textContent`) specifically for CSP compliance — this was validated manually |
| Cross-browser differences | Chromium and Playwright-Gecko are covered; WebKit is not installed locally | `npx playwright install webkit`, then `--browser webkit`. Note none of these are the Tampermonkey sandbox — see the Firefox scope note above |

### The `--single-process` flag

This flag is required in the Antigravity IDE sandbox (kernel 4.4.0) but should be removed on normal machines. If you're setting up CI or running tests locally on a modern system, remove it for better stability:

```javascript
args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    // '--single-process',  ← Remove on modern systems
],
```
