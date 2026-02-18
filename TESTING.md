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
5. [What Each Test Checks (10 Tests Per Platform)](#what-each-test-checks-10-tests-per-platform)
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
   ├── Runs 10 test assertions via page.evaluate():
   │   ├── TEST 1: document.getElementById('ai-nav-toggle') exists
   │   ├── TEST 2: document.getElementById('ai-nav-panel') exists
   │   ├── TEST 3: Toggle button's first text node matches expected icon
   │   ├── TEST 4: getComputedStyle(toggle).backgroundColor matches expected accent
   │   ├── TEST 5: Click toggle → panel gets .open class
   │   ├── TEST 6: .ai-nav-item count matches expectedMessages
   │   ├── TEST 7: #ai-nav-stats text matches "N questions found"
   │   ├── TEST 8: Every .ai-nav-item has a non-empty .ai-nav-summary
   │   ├── TEST 9: Clicking .ai-nav-item doesn't throw
   │   └── TEST 10: Click toggle again → panel loses .open class
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
        '--single-process',        // CRITICAL: Required on kernel 4.4.0
    ],
});
```

**Why `--single-process`?** The Antigravity IDE sandbox runs on Linux kernel 4.4.0, which is too old for Chromium's multi-process architecture. Without this flag, child processes crash silently with "Target page, context or browser has been closed" errors. This flag forces everything into one process.

**If you're running on a normal machine** (macOS, modern Linux, Windows), you can remove `--single-process` for better stability. It's only needed in the sandboxed environment.

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

## What Each Test Checks (10 Tests Per Platform)

| # | Test Name | What It Verifies | How |
|---|-----------|-----------------|-----|
| 1 | Toggle button exists | The userscript detected the platform and injected its UI | `document.getElementById('ai-nav-toggle')` |
| 2 | Panel exists | The navigation sidebar panel was created | `document.getElementById('ai-nav-panel')` |
| 3 | Icon matches | The correct Unicode icon is displayed for this platform | Reads the first text child node of the toggle button |
| 4 | Theme accent color | The button's background color matches the platform's brand color | `getComputedStyle(toggle).backgroundColor` compared to expected RGB |
| 5 | Panel opens on click | Clicking the toggle opens the navigation panel | Clicks toggle, checks for `.open` class on panel |
| 6 | Message count | The userscript's selectors found the correct number of user messages in the mock DOM | Counts `.ai-nav-item` elements in the panel |
| 7 | Stats text | The "N questions found" text matches the expected count | Reads `#ai-nav-stats` textContent |
| 8 | All items have summaries | Every detected message produced a non-empty summary | Checks `.ai-nav-summary` inside each `.ai-nav-item` |
| 9 | Nav items clickable | Clicking a nav item doesn't throw a JavaScript error | Programmatic `.click()` on the first `.ai-nav-item` |
| 10 | Panel closes on second click | Clicking the toggle again closes the panel | Clicks toggle again, checks `.open` class is removed |

**Tests 1-2 are blockers** — if either fails, the remaining 8 tests are skipped for that platform (there's nothing to test without the UI elements).

**Test 6 is the most important** — this is where selector bugs surface. If the message count is wrong, it means the mock DOM doesn't match the selector logic, or a selector bug was introduced.

---

## Platform Configuration — The PLATFORMS Array

The `PLATFORMS` array in `test-all-platforms.js` is the **central configuration** for all tests. Each entry defines one platform variant.

### Field Reference

```javascript
{
    name: 'Claude',                          // Display name in test output
    mockFile: 'claude.html',                 // File in tests/mock-pages/ to load
    hostname: 'claude.ai',                   // The hostname the browser will "visit"
    pathname: '/chat/test',                  // The URL path (some platforms check this)
    expectedMessages: 3,                     // How many user messages the mock page contains
    expectedAccent: 'rgb(217, 119, 6)',      // Expected CSS backgroundColor in RGB format
    expectedIcon: '\u2733',                  // Expected Unicode icon character
}
```

**Field details:**

| Field | Type | Purpose | Where It's Used |
|-------|------|---------|-----------------|
| `name` | string | Human-readable label printed in test output | Console output only |
| `mockFile` | string | Filename within `tests/mock-pages/` | `buildTestPage()` reads this file |
| `hostname` | string | Must match a hostname that one of the `PLATFORMS` registry's `match()` functions accepts | Used to construct the URL for `page.goto()` and `page.route()` |
| `pathname` | string | URL path — matters for platforms with path guards (e.g., Lovable requires `/projects/`) | Appended to hostname for the target URL |
| `expectedMessages` | number | Exact count of user messages in the mock HTML | Test 6 compares this to the number of `.ai-nav-item` elements |
| `expectedAccent` | string | RGB value of the platform's accent color (from the `theme.accent` field in the `PLATFORMS` registry) | Test 4 compares this to `getComputedStyle().backgroundColor` |
| `expectedIcon` | string | Unicode character(s) for the platform icon (from the `icon` field in the `PLATFORMS` registry) | Test 3 compares this to the toggle button's first text node |

### Current Platforms

| name | hostname | mockFile | expectedMessages | expectedAccent | expectedIcon |
|------|----------|----------|-----------------|----------------|--------------|
| Claude | claude.ai | claude.html | 3 | rgb(217, 119, 6) | ✳ `\u2733` |
| Claude Code | claude.ai | claude-code.html | 3 | rgb(217, 119, 6) | ✳ `\u2733` |
| ChatGPT | chatgpt.com | chatgpt.html | 4 | rgb(255, 255, 255) | ⏣ `\u23E3` |
| Codex Web | chatgpt.com | codex.html | 2 | rgb(255, 255, 255) | ⏣ `\u23E3` |
| Grok | grok.com | grok.html | 3 | rgb(220, 38, 38) | X |
| Gemini | gemini.google.com | gemini.html | 3 | rgb(66, 133, 244) | ✦ `\u2726` |
| Bolt.new | bolt.new | bolt.html | 3 | rgb(56, 189, 248) | ⚡ `\u26A1\uFE0E` |
| Lovable | lovable.dev | lovable.html | 4 | rgb(155, 135, 245) | ♥ `\u2665` |
| Replit | replit.com | replit.html | 3 | rgb(242, 101, 34) | ⠕ `\u2815` |
| V0 | v0.app | v0.html | 3 | rgb(255, 255, 255) | ▽ `\u25BD` |
| Base44 | app.base44.com | base44.html | 3 | rgb(99, 102, 241) | ⬢ `\u2B22` |
| Emergent | app.emergent.sh | emergent.html | 3 | rgb(16, 185, 129) | e |
| Perplexity | www.perplexity.ai | perplexity.html | 3 | rgb(32, 184, 205) | ✳ `\u2733` |
| Firebase Studio | 6000-firebase-studio-12345.cluster-abc123.cloudworkstations.dev | firebase.html | 3 | rgb(255, 166, 17) | ✦ `\u2726` |

**Note on sub-platforms:** Claude and Claude Code both use `hostname: 'claude.ai'` but different mock files and different `pathname` values. The userscript detects both as the `claude` platform and uses a fallback chain — primary selectors (`data-testid="user-human-turn"`) work for Claude Chat, and the fallback (`div.bg-bg-200.rounded-lg` inside `.items-end`) catches Claude Code. The mock pages are designed so that Claude Chat's mock has `data-testid` attributes (primary selectors match) and Claude Code's mock does NOT have `data-testid` attributes (primary selectors find 0, fallback activates).

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

**Why it works:** The `^=` (starts-with) selector matches `data-testid="user-message-user-task-1"` but not `data-testid="assistant-message-1"`. Emergent uses virtuoso virtual scrolling — only visible DOM elements exist — so the script uses accumulative scanning and scroll-through collection (see CHANGELOG v7.7).

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
| Cross-browser differences | Tests run in Chromium only; Firefox/Safari may have different behavior | For Firefox/Safari testing, you'd need to download those browsers (`npx playwright install firefox webkit`) and add launch configs |

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
