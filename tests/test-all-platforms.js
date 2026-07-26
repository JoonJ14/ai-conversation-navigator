/**
 * AI Conversation Navigator — Automated Platform Test Suite
 *
 * DESIGN GOAL: These tests never need to be rewritten when the script gets a
 * major UI overhaul (v10 → v11 → v50). They query the DOM using a stable
 * data-attribute contract that the script publishes, not internal IDs or CSS
 * class names that change between versions.
 *
 * ── Stable test contract (script must honour these) ──────────────────────────
 *   data-acn-role="zone"         Main container injected into the page
 *   data-acn-role="styles"       The injected <style> element
 *   data-acn-role="nav-trigger"  Element that opens the navigation panel when clicked
 *   data-acn-role="nav-panel"    The navigation panel element
 *   data-acn-role="nav-stat"     Shows the detected question count
 *   data-acn-role="nav-list"     Container holding the question items
 *   data-acn-role="nav-item"     Each individual question entry
 *   data-acn-role="nav-item-text" The display text inside each nav-item
 *   data-acn-role="panel-close"  Closes the currently open panel when clicked
 *
 *   data-acn-accent="#hexcolor"  Platform accent colour (on the zone element)
 *   data-acn-ui="orbital|legacy"   UI system (on the zone element; distinct from data-acn-mode which tracks display modes)
 *   data-acn-dot="nav|search|bookmarks|summary|tools|settings" Each orbital dot (orbital mode only)
 *   data-acn-open="true"         Present on nav-panel when panel is open, absent when closed
 *   data-acn-count="N"           Number of detected questions (on nav-stat element)
 *
 * Any future version of the script that sets these attributes will pass the
 * test suite without any changes to this file.  When platform selectors or
 * theme colours change, only the PLATFORMS array below needs updating.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tests every supported platform across multiple browser engines by:
 *  1. Loading mock HTML into headless browser pages via Playwright
 *  2. Serving mock HTML at the real platform hostname via route interception
 *     (so window.location.hostname matches — no hostname spoofing needed)
 *  3. Injecting the userscript
 *  4. Querying the DOM using data-acn-role selectors from the contract above
 *
 * Supported browser engines: chromium, firefox, webkit
 *
 * Usage:
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js --browser chromium
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js --browser chromium,firefox,webkit
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js --screenshots
 *
 * Or use the convenience script:
 *   ./tests/run-tests.sh
 *   ./tests/run-tests.sh --browser firefox
 *   ./tests/run-tests.sh --browser all
 *   ./tests/run-tests.sh --screenshots
 */

const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Browser engine definitions ────────────────────────────────────────────────

const BROWSER_ENGINES = {
    chromium: {
        name: 'Chromium',
        launcher: playwright.chromium,
        // Chromium-specific launch args for sandboxed/CI environments
        launchArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--single-process',
        ],
        // Hardcoded fallback paths for this specific dev environment
        fallbackPaths: [
            '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
            '/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',
        ],
    },
    firefox: {
        name: 'Firefox',
        launcher: playwright.firefox,
        launchArgs: [],
        fallbackPaths: [],
    },
    webkit: {
        name: 'WebKit',
        launcher: playwright.webkit,
        launchArgs: [],
        fallbackPaths: [],
    },
};

// Parse --browser flag from CLI args (default: chromium only for local runs)
function parseBrowserArg() {
    const idx = process.argv.indexOf('--browser');
    if (idx === -1) return ['chromium'];

    const val = process.argv[idx + 1];
    if (!val) return ['chromium'];

    if (val === 'all') return Object.keys(BROWSER_ENGINES);

    return val.split(',').map(b => b.trim().toLowerCase()).filter(b => BROWSER_ENGINES[b]);
}

// Check if --screenshots flag is present
function shouldCaptureScreenshots() {
    return process.argv.includes('--screenshots');
}

// Slugify a platform name for use in filenames (e.g. "Claude Code" → "claude-code")
function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Platform definitions ───────────────────────────────────────────────────────
//
// expectedAccent: the value set on data-acn-accent (hex string from the script's colour map).
//   - Orbital platforms (claude, chatgpt, grok, gemini, perplexity) use ORB_COLORS[platform.id].bg.
//   - Legacy platforms (app-builders + firebase_studio) use platform.theme.accent from PLATFORMS.
//
// expectedMessages: number of user messages in the mock HTML for that platform.
//   Determined by the platform's getUserMessages() selector against the mock page DOM.
//   Update this when you update the corresponding mock-pages/*.html file.

const PLATFORMS = [
    {
        name: 'Claude',
        mockFile: 'claude.html',
        hostname: 'claude.ai',
        pathname: '/chat/test',
        expectedMessages: 3,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
    },
    {
        name: 'Claude Code',
        mockFile: 'claude-code.html',
        hostname: 'claude.ai',
        pathname: '/code/test',
        expectedMessages: 3,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
    },
    {
        // Virtualized Claude — 80 messages / 40 turns exist; only a 6-message
        // window (3 user turns) plus a 1-row pinned tail is ever mounted.
        // The pathname must be a real-shaped conversation uuid so the userscript's
        // ciIsClaudeChat() guard matches and the conversation-index path engages.
        // The harness provides no GM_xmlhttpRequest, so the API fetch fails, the
        // script must degrade to the DOM scan *visibly*, and every jump must take
        // the honest-failure path — which is what tests 21-22 assert.
        name: 'Claude (virtualized)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/11111111-1111-4111-8111-111111111111',
        expectedMessages: 3,      // mounted USER turns, NOT the 40 real ones
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
    },
    {
        // Same virtualizing mock, but WITH a GM_xmlhttpRequest fixture so the
        // conversation index actually builds. This is the entry that proves the
        // primary v12.0 path works: 40 questions listed from a DOM that only ever
        // mounts 3, and a jump loop that pages the virtualizer to an unmounted row.
        // Without it, everything except the degraded fallback is untested.
        name: 'Claude (virtualized + index)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/22222222-2222-4222-8222-222222222222',
        expectedMessages: 40,     // FULL conversation from the index, not the 3 mounted
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        gmFixture: {
            totalMessages: 80,
            conversationUuid: '22222222-2222-4222-8222-222222222222',
        },
    },
    {
        name: 'ChatGPT',
        mockFile: 'chatgpt.html',
        hostname: 'chatgpt.com',
        pathname: '/c/test',
        expectedMessages: 4,
        expectedAccent: '#ffffff',
        expectedMode: 'orbital',
    },
    {
        name: 'Codex Web',
        mockFile: 'codex.html',
        hostname: 'chatgpt.com',
        pathname: '/codex/test',
        expectedMessages: 2,
        expectedAccent: '#ffffff',
        expectedMode: 'orbital',
    },
    {
        name: 'Grok',
        mockFile: 'grok.html',
        hostname: 'grok.com',
        pathname: '/chat/test',
        expectedMessages: 3,
        expectedAccent: '#e53e3e',
        expectedMode: 'orbital',
    },
    {
        name: 'Gemini',
        mockFile: 'gemini.html',
        hostname: 'gemini.google.com',
        pathname: '/app/test',
        expectedMessages: 3,
        expectedAccent: '#4285f4',
        expectedMode: 'orbital',
    },
    {
        name: 'Bolt.new',
        mockFile: 'bolt.html',
        hostname: 'bolt.new',
        pathname: '/test-project',
        expectedMessages: 3,
        expectedAccent: '#38BDF8',
        expectedMode: 'legacy',
    },
    {
        name: 'Lovable',
        mockFile: 'lovable.html',
        hostname: 'lovable.dev',
        pathname: '/projects/test-project',   // Must include /projects/ for the guard
        expectedMessages: 3,
        expectedAccent: '#9b87f5',
        expectedMode: 'legacy',
    },
    {
        name: 'Replit',
        mockFile: 'replit.html',
        hostname: 'replit.com',
        pathname: '/@user/project',
        expectedMessages: 3,
        expectedAccent: '#F26522',
        expectedMode: 'legacy',
    },
    {
        name: 'V0',
        mockFile: 'v0.html',
        hostname: 'v0.app',
        pathname: '/chat/test-project',
        expectedMessages: 3,
        expectedAccent: '#ffffff',
        expectedMode: 'legacy',
    },
    {
        name: 'Base44',
        mockFile: 'base44.html',
        hostname: 'app.base44.com',
        pathname: '/projects/test',
        expectedMessages: 3,
        expectedAccent: '#6366f1',
        expectedMode: 'legacy',
    },
    {
        name: 'Emergent',
        mockFile: 'emergent.html',
        hostname: 'app.emergent.sh',
        pathname: '/project/test',
        expectedMessages: 3,
        expectedAccent: '#10b981',
        expectedMode: 'legacy',
    },
    {
        name: 'Perplexity',
        mockFile: 'perplexity.html',
        hostname: 'www.perplexity.ai',
        pathname: '/search/test',
        expectedMessages: 3,
        expectedAccent: '#20b2aa',
        expectedMode: 'orbital',
    },
    {
        name: 'Firebase Studio',
        mockFile: 'firebase.html',
        hostname: '6000-firebase-studio-12345.cluster-abc123.cloudworkstations.dev',
        pathname: '/capra/',
        expectedMessages: 3,
        expectedAccent: '#FFA611',   // firebase_studio legacy mode → platform.theme.accent
        expectedMode: 'legacy',
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_DIR = path.join(__dirname, 'mock-pages');
const SCRIPT_PATH = path.join(__dirname, '..', 'ai-conversation-navigator.user.js');

// Read the userscript, stripping the ==UserScript== header
function getScriptContent() {
    let content = fs.readFileSync(SCRIPT_PATH, 'utf8');
    content = content.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    return content;
}

// ── GM_xmlhttpRequest fixture shim ────────────────────────────────────────────
//
// WHY THIS EXISTS
// The harness previously provided no GM_* APIs at all, so on Claude the
// conversation index could only ever FAIL and fall back to the DOM scan. That
// left the entire primary v12.0 path — org resolution, ciBuildIndex, active-path
// branch filtering, index-backed Navigate/Search/Export, and the whole Phase 3
// jump loop — unverified by CI. Both independent review rounds flagged it.
//
// This shim serves a synthetic conversation whose messages line up exactly with
// claude-virtualized.html, so the index builds and the settle loop runs for real.
//
// The fixture deliberately carries ONE LEADING assistant message that the mock
// does NOT render. That makes the data-index -> _ciFullPath offset +1 rather
// than 0, matching what was measured live — so an implementation that quietly
// assumes zero alignment fails here instead of in production.
function buildGmFixtureShim(cfg) {
    const TOTAL = cfg.totalMessages;      // rendered rows (mock)
    const ORG   = '99999999-9999-4999-8999-999999999999';

    // messages[0] is the unrendered leading message; messages[i+1] <-> row i
    const messages = [];
    const uuidFor = (i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`;
    messages.push({
        uuid: uuidFor(0),
        parent_message_uuid: '00000000-0000-4000-8000-000000000000',
        sender: 'assistant',
        index: 0,
        created_at: '2026-07-01T00:00:00Z',
        text: '',
        content: [{ type: 'text', text: 'Conversation started.' }],
        attachments: [], files: [],
    });
    for (let row = 0; row < TOTAL; row++) {
        const turn = Math.floor(row / 2) + 1;
        const isUser = row % 2 === 0;
        messages.push({
            uuid: uuidFor(row + 1),
            parent_message_uuid: uuidFor(row),
            sender: isUser ? 'human' : 'assistant',
            index: row + 1,
            created_at: '2026-07-01T00:00:00Z',
            text: '',                       // empty on purpose — mirrors the real API
            // NOTE the trailing ' VISIBLE-NOT-SR-ONLY' on user turns: the mock renders a
            // .not-sr-only span inside the message node, and that text is VISIBLE content
            // which the extractor must KEEP. Including it here means the DOM-derived text
            // and the API text agree — and if `not-sr-only` were ever wrongly treated as
            // `sr-only`, they would stop agreeing and the question count would break.
            content: [{ type: 'text', text: isUser
                ? `Question number ${turn}: how do I handle case ${turn} when the input is unusual? VISIBLE-NOT-SR-ONLY`
                : `Answer number ${turn}: validate the input first, then branch on the result.` }],
            attachments: [], files: [],
        });
    }
    // ABANDONED BRANCH — not on the active path.
    // Without this the fixture is a single linear chain, so ciResolveActivePath's whole
    // reason for existing is unexercised: a reviewer replaced the entire tree walk with
    // `path = msgs.slice()` and the suite still passed 25/25. These two messages hang
    // off a mid-conversation parent and must NEVER appear in the panel.
    const ABANDONED_TEXT = 'ABANDONED BRANCH question that must never be listed';
    messages.push({
        uuid: 'bbbbbbbb-0000-4000-8000-000000000001',
        parent_message_uuid: uuidFor(21),      // branches off mid-conversation
        sender: 'human',
        index: 999,
        created_at: '2026-07-01T00:00:00Z',
        text: '',
        content: [{ type: 'text', text: ABANDONED_TEXT }],
        attachments: [], files: [],
    });
    messages.push({
        uuid: 'bbbbbbbb-0000-4000-8000-000000000002',
        parent_message_uuid: 'bbbbbbbb-0000-4000-8000-000000000001',
        sender: 'assistant',
        index: 1000,
        created_at: '2026-07-01T00:00:00Z',
        text: '',
        content: [{ type: 'text', text: 'Answer on the abandoned branch.' }],
        attachments: [], files: [],
    });

    const payload = {
        uuid: cfg.conversationUuid,
        name: 'Fixture conversation',
        current_leaf_message_uuid: uuidFor(TOTAL),
        chat_messages: messages,
    };

    return `
<script>
(function () {
    var ORG = ${JSON.stringify(ORG)};
    var PAYLOAD = ${JSON.stringify(payload)};
    // Minimal GM_* surface. Only what the userscript actually calls.
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, 5);
        }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ORG, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        if (url.indexOf('/chat_conversations/') !== -1) {
            if (url.indexOf(ORG) === -1) { respond(404, ''); return; }
            respond(200, JSON.stringify(PAYLOAD));
            return;
        }
        respond(404, '');
    };
    var _store = {};
    window.GM_getValue = function (k, d) { return _store.hasOwnProperty(k) ? _store[k] : d; };
    window.GM_setValue = function (k, v) { _store[k] = v; };
    // The org resolver reads this before falling back to /api/organizations.
    try { document.cookie = 'lastActiveOrg=' + ORG + '; path=/'; } catch (e) {}
}());
</script>`;
}

// Build a test page with mock DOM + userscript embedded
function buildTestPage(platform, scriptContent) {
    const mockHTML = fs.readFileSync(path.join(MOCK_DIR, platform.mockFile), 'utf8');

    // Extract just the <body> content from the mock HTML
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : mockHTML;

    const gmShim = platform.gmFixture ? buildGmFixtureShim(platform.gmFixture) : '';

    return `<!DOCTYPE html>
<html>
<head><title>${platform.name} Test</title></head>
<body>
${bodyContent}
<script>
// Clear duplicate guard from previous test run (fresh navigation means clean window,
// but belt-and-suspenders for any edge cases)
delete window._aiNavAlreadyLoaded;
</script>
${gmShim}
<script>
${scriptContent}
</script>
</body>
</html>`;
}

// Set up route interception for a platform — serves mock HTML at the real hostname URL
async function setupRouteForPlatform(page, platform, scriptContent) {
    const html = buildTestPage(platform, scriptContent);
    const targetURL = `https://${platform.hostname}${platform.pathname}`;

    // Intercept ALL requests for this page navigation and sub-resources
    await page.route('**/*', (route) => {
        const url = route.request().url();
        // Serve our mock HTML for the main navigation request
        if (url === targetURL || url === targetURL + '/') {
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: html,
            });
        } else {
            // Abort all other requests (CSS, JS, images, etc.) — we don't need them
            route.abort();
        }
    });

    return targetURL;
}

// ── Test runner ───────────────────────────────────────────────────────────────
//
// ALL assertions use data-acn-role / data-acn-* selectors from the contract
// defined in the file header.  No internal IDs, CSS class names, or version-
// specific assumptions appear below this line.

async function testPlatform(page, platform, scriptContent, screenshotOpts) {
    const results = { name: platform.name, tests: [], passed: true, screenshots: [] };

    function assert(testName, condition, detail) {
        const status = condition ? 'PASS' : 'FAIL';
        results.tests.push({ testName, status, detail });
        if (!condition) results.passed = false;
    }

    // Uncaught exceptions thrown by the userscript during this platform's run.
    // Collected rather than asserted immediately so a throw inside an async
    // callback (e.g. the jump settle loop) is still attributed to this platform.
    // Attached AFTER page.goto below — not here. The page object is REUSED across all
    // 16 entries, and during unrouteAll()/goto() the PREVIOUS platform's page is still
    // live with its ~500ms scan interval running. Attaching before navigation let a
    // throw from entry N land in entry N+1's collector (proven by gating a throw to
    // entry 1 and watching entry 2 fail).
    const pageErrors = [];
    const onPageError = (err) => pageErrors.push(String(err && err.message || err));

    try {
        // Clear any previous routes
        await page.unrouteAll();

        // Set up route interception — serves our mock HTML at the real hostname
        const targetURL = await setupRouteForPlatform(page, platform, scriptContent);

        // Navigate to the real URL (intercepted by route handler)
        await page.goto(targetURL, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,  // 20s — Firefox on Windows can be slow to resolve mocked routes
        });

        // Now that navigation is complete, start collecting errors for THIS platform.
        pageErrors.length = 0;
        page.on('pageerror', onPageError);

        // Wait for initialization.  The main container is injected synchronously on
        // script load; question detection runs on a 2 s setTimeout.  3.5 s covers both.
        await page.waitForTimeout(3500);

        // ── TEST 1: Main container injected ───────────────────────────────
        const zoneExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="zone"]');
        });
        assert('Main container injected', zoneExists,
            zoneExists ? 'Found [data-acn-role="zone"]' : 'Missing [data-acn-role="zone"]');

        // ── TEST 2: Styles injected ────────────────────────────────────────
        const cssExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="styles"]');
        });
        assert('Styles injected', cssExists,
            cssExists ? 'Found [data-acn-role="styles"]' : 'Missing [data-acn-role="styles"]');

        // ── TEST 3: Navigation trigger exists ─────────────────────────────
        const triggerExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="nav-trigger"]');
        });
        assert('Navigation trigger exists', triggerExists,
            triggerExists ? 'Found [data-acn-role="nav-trigger"]' : 'Missing [data-acn-role="nav-trigger"]');

        // ── TEST 4: Navigation panel exists ───────────────────────────────
        const panelExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="nav-panel"]');
        });
        assert('Navigation panel exists', panelExists,
            panelExists ? 'Found [data-acn-role="nav-panel"]' : 'Missing [data-acn-role="nav-panel"]');

        if (!zoneExists || !triggerExists || !panelExists) {
            // Can't run remaining tests without the core elements
            return results;
        }

        // ── TEST 5: Platform accent colour ─────────────────────────────────
        // The zone publishes its accent colour as data-acn-accent="#hexvalue".
        // Tests compare against the expected per-platform colour from PLATFORMS.
        const actualAccent = await page.evaluate(() => {
            return (document.querySelector('[data-acn-role="zone"]')
                .getAttribute('data-acn-accent') || '').trim();
        });
        assert('Platform accent colour', actualAccent === platform.expectedAccent,
            `Expected "${platform.expectedAccent}", got "${actualAccent}"`);

        // ── TEST 6: No duplicate container ────────────────────────────────
        const zoneCount = await page.evaluate(() => {
            return document.querySelectorAll('[data-acn-role="zone"]').length;
        });
        assert('No duplicate container', zoneCount === 1,
            `Expected 1 zone, found ${zoneCount}`);

        // ── SCREENSHOT: Container visible ─────────────────────────────────
        if (screenshotOpts) {
            const slug = slugify(platform.name);
            const filePath = path.join(screenshotOpts.dir, `${slug}-zone.png`);
            await page.screenshot({ path: filePath, fullPage: true });
            results.screenshots.push({ label: 'Zone injected', path: filePath });
        }

        // ── TEST 7: Clicking trigger opens navigation panel ────────────────
        // JS .click() bypasses CSS pointer-events so this works even when the
        // container is visibility:hidden (e.g. left-chat boundary not yet detected).
        await page.evaluate(() => {
            document.querySelector('[data-acn-role="nav-trigger"]').click();
        });
        await page.waitForTimeout(500);  // Allow panel open transition to settle

        const panelOpen = await page.evaluate(() => {
            return document.querySelector('[data-acn-role="nav-panel"]')
                .getAttribute('data-acn-open') === 'true';
        });
        assert('Trigger opens navigation panel', panelOpen,
            panelOpen ? 'data-acn-open="true"' : 'Panel not open after clicking trigger');

        await page.waitForTimeout(300);

        // ── TEST 8: Correct number of questions detected ───────────────────
        // data-acn-count on the nav-stat element carries the numeric count, so
        // tests are independent of the wording used in the displayed text.
        const detectedCount = await page.evaluate(() => {
            const stat = document.querySelector('[data-acn-role="nav-stat"]');
            return stat ? parseInt(stat.getAttribute('data-acn-count') || '-1', 10) : -1;
        });
        assert('Questions detected', detectedCount === platform.expectedMessages,
            `Expected ${platform.expectedMessages}, got ${detectedCount}`);

        // ── TEST 9: Correct number of question items rendered ─────────────
        const itemCount = await page.evaluate(() => {
            return document.querySelectorAll('[data-acn-role="nav-item"]').length;
        });
        assert('Question items rendered', itemCount === platform.expectedMessages,
            `Expected ${platform.expectedMessages} items, got ${itemCount}`);

        // ── TEST 10: Every question item has non-empty display text ────────
        const allHaveText = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-acn-role="nav-item"]');
            return Array.from(items).every(item => {
                const textEl = item.querySelector('[data-acn-role="nav-item-text"]');
                return textEl && textEl.textContent.trim().length > 0;
            });
        });
        assert('All items have display text', allHaveText,
            allHaveText ? 'All nav-item-text non-empty' : 'Some item texts are empty');

        // ── SCREENSHOT: Panel open with question list ──────────────────────
        if (screenshotOpts) {
            const slug = slugify(platform.name);
            const filePath = path.join(screenshotOpts.dir, `${slug}-panel-open.png`);
            await page.screenshot({ path: filePath, fullPage: true });
            results.screenshots.push({ label: 'Panel open', path: filePath });
        }

        // ── TEST 11: Question items are clickable ──────────────────────────
        let clickable = true;
        try {
            if (itemCount > 0) {
                await page.evaluate(() => {
                    document.querySelector('[data-acn-role="nav-item"]').click();
                });
                await page.waitForTimeout(500);
            }
        } catch (e) {
            clickable = false;
        }
        assert('Question items clickable', clickable,
            clickable ? 'Click succeeded' : 'Click threw error');

        // ── TEST 12: Close button dismisses panel ──────────────────────────
        // On left-chat platforms the panel may auto-close on item click to reveal
        // the message; re-open so we can test the close button.
        const panelStillOpen = await page.evaluate(() => {
            return document.querySelector('[data-acn-role="nav-panel"]')
                .getAttribute('data-acn-open') === 'true';
        });
        if (!panelStillOpen) {
            await page.evaluate(() => {
                document.querySelector('[data-acn-role="nav-trigger"]').click();
            });
            await page.waitForTimeout(400);
        }
        await page.evaluate(() => {
            const closeBtn = document.querySelector(
                '[data-acn-role="nav-panel"] [data-acn-role="panel-close"]');
            if (closeBtn) closeBtn.click();
        });
        await page.waitForTimeout(400);
        const panelClosed = await page.evaluate(() => {
            return document.querySelector('[data-acn-role="nav-panel"]')
                .getAttribute('data-acn-open') !== 'true';
        });
        assert('Close button dismisses panel', panelClosed,
            panelClosed ? 'Panel closed' : 'Panel still open after clicking close');

        // ── TEST 13: Correct injection mode (orbital vs legacy) ────────────
        // data-acn-ui on the zone confirms whether the platform got the orbital
        // cluster or the legacy ghost-notch button.
        // (Note: data-acn-mode is reserved for the display mode: arc/wheel/show-all)
        const actualMode = await page.evaluate(() => {
            const zone = document.querySelector('[data-acn-role="zone"]');
            return zone ? zone.getAttribute('data-acn-ui') : null;
        });
        assert('Correct injection mode', actualMode === platform.expectedMode,
            `Expected mode "${platform.expectedMode}", got "${actualMode}"`);

        // ── TEST 14: All orbital dots present (orbital platforms only) ─────
        // Skipped for legacy platforms — they only have one nav-trigger button.
        if (platform.expectedMode === 'orbital') {
            const orbitalDots = ['nav', 'search', 'bookmarks', 'summary', 'tools', 'settings'];
            const missingDots = await page.evaluate((dots) => {
                return dots.filter(id => !document.querySelector('[data-acn-dot="' + id + '"]'));
            }, orbitalDots);
            assert('All orbital dots present', missingDots.length === 0,
                missingDots.length === 0
                    ? 'All 6 dots found (nav, search, bookmarks, summary, tools, settings)'
                    : 'Missing dots: ' + missingDots.join(', '));
        }

        // ── TESTS 15-25: virtualization and jump ──────────────────────────
        //
        // EVERY assertion here was rewritten after a review lens MUTATION-TESTED the
        // originals and proved they pass against a broken implementation:
        //   - jump body replaced with `done(false,null)`      -> 25/25 PASS
        //   - ciDeriveRowOffset hardcoded to 0                -> passed, landed at top
        //   - all sr-only/bookmark stripping disabled         -> test 20 PASS
        //   - entire tree walk replaced with msgs.slice()     -> 25/25 PASS
        //   - orbSetJumpBusy made a no-op                     -> 47/47 PASS
        //   - uncaught throw during a jump                    -> 25/25 PASS
        // Each mutation must now fail. Where an assertion checks a property of the
        // MOCK rather than the product, it says so.
        if (platform.virtualized) {
            // TEST 15: the mock genuinely recycles. Guards tests 16-25.
            const recycling = await page.evaluate(async () => {
                const v = window.__mockVirtualization;
                if (!v) return { ok: false, reason: 'mock hooks missing' };
                v.scrollToFraction(0);
                await new Promise(r => setTimeout(r, 150));
                const firstNode = document.querySelector('[data-testid="user-message"]');
                const seen = new Set();
                const counts = [];
                for (const f of [0, 0.35, 0.7, 1]) {
                    v.scrollToFraction(f);
                    await new Promise(r => setTimeout(r, 150));
                    // Identity by data-index, not by a text slice. The mock now injects
                    // contamination fixtures at the START of the message node, so a raw
                    // textContent prefix is identical across messages and would report
                    // 1 unique for the whole conversation.
                    const userRows = v.mountedIndexes().filter(n => n % 2 === 0);
                    userRows.forEach(n => seen.add(n));
                    counts.push(document.querySelectorAll('[data-testid="user-message"]').length);
                }
                const detachedProven = !!firstNode && !firstNode.isConnected;
                v.scrollToFraction(0);
                return { ok: true, counts, cumulativeUnique: seen.size,
                         totalTurns: v.totalTurns, userWindowSize: v.userWindowSize,
                         detachedProven };
            });
            assert('Mock recycles turns (set changes, node detaches)',
                recycling.ok &&
                recycling.counts.every(c => c === recycling.userWindowSize) &&
                recycling.cumulativeUnique > recycling.userWindowSize &&
                recycling.cumulativeUnique < recycling.totalTurns &&
                recycling.detachedProven,
                recycling.ok
                    ? `mounted [${recycling.counts}], unique ${recycling.cumulativeUnique}/` +
                      `${recycling.totalTurns}, earlier node detached: ${recycling.detachedProven}`
                    : recycling.reason);

            // TEST 16: DOM cannot see the whole conversation (the bug, asserted).
            const domCoverage = await page.evaluate(() => ({
                mounted: window.__mockVirtualization.mountedCount(),
                total: window.__mockVirtualization.totalTurns,
            }));
            assert('DOM exposes only the mounted window',
                domCoverage.mounted === platform.virtualized.userWindowSize &&
                domCoverage.total === platform.virtualized.totalTurns,
                `${domCoverage.mounted} of ${domCoverage.total} turns in DOM`);

            // TEST 17: degraded banner — required without the fixture, forbidden with it.
            await page.click('[data-acn-role="nav-trigger"]');
            await page.waitForTimeout(600);
            const degraded = await page.evaluate(() => {
                const b = document.querySelector('[data-acn-index-status]');
                return b ? { status: b.getAttribute('data-acn-index-status'),
                             text: b.textContent.trim() } : null;
            });
            if (!platform.indexBacked) {
                assert('Degraded mode is visible in the panel',
                    !!degraded && degraded.status === 'degraded',
                    degraded ? `banner: "${degraded.text}"` : 'No banner rendered');
            } else {
                assert('Index-backed run does NOT show degraded banner',
                    !degraded || degraded.status !== 'degraded',
                    degraded ? `unexpected: "${degraded.text}"` : 'no degraded banner');
            }

            // TEST 18: virtualizer metadata. NOTE: a property of the MOCK — it can only
            // fail if the mock file is edited. Kept as a guard on the fixture contract.
            const meta = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('[data-index]'))
                    .map(e => +e.getAttribute('data-index')).sort((a, b) => a - b);
                const art = document.querySelector('[aria-setsize]');
                const runs = rows.reduce((acc, n, i) => (i && n === rows[i - 1] + 1) ? acc : acc + 1, 0);
                const senders = {
                    user: rows.filter(n => !!document.querySelector(`[data-index="${n}"] [data-testid="user-message"]`)).length,
                    ai:   rows.filter(n => !!document.querySelector(`[data-index="${n}"] .font-claude-response`)).length,
                };
                return { rows, setsize: art ? +art.getAttribute('aria-setsize') : null,
                         hasFeed: !!document.querySelector('[role="feed"]'),
                         hasContainer: !!document.querySelector('[data-autoscroll-container="true"]'),
                         runs, senders };
            });
            assert('Virtualizer metadata present and covers both senders',
                meta.rows.length >= 2 && meta.setsize > 0 && meta.hasFeed &&
                meta.hasContainer && meta.senders.user > 0 && meta.senders.ai > 0,
                `rows=[${meta.rows}] setsize=${meta.setsize} user=${meta.senders.user} ai=${meta.senders.ai}`);

            // TEST 19: mounted set is non-contiguous AT EVERY scroll position.
            // The earlier version sampled one position and passed only because a prior
            // test happened to leave the scroll at the top; at the bottom the window
            // and the tail were adjacent (one run).
            const nonContig = await page.evaluate(async () => {
                const v = window.__mockVirtualization;
                const out = [];
                for (const f of [0, 0.5, 1]) {
                    v.scrollToFraction(f);
                    await new Promise(r => setTimeout(r, 150));
                    const rows = v.mountedIndexes();
                    const runs = rows.reduce((a, n, i) => (i && n === rows[i - 1] + 1) ? a : a + 1, 0);
                    out.push({ f, rows, runs });
                }
                v.scrollToFraction(0);
                return out;
            });
            assert('Mounted set is non-contiguous at every scroll position',
                nonContig.every(x => x.runs >= 2),
                nonContig.map(x => `f=${x.f}:${x.runs}run [${x.rows}]`).join('  '));

            // TEST 20: contamination stripped. The mock now puts an HTML COMMENT and an
            // .sr-only span INSIDE [data-testid="user-message"], so disabling the
            // stripping makes this fail — previously it could not.
            const contamination = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item-text"]'))
                    .map(i => i.textContent.trim());
                return {
                    total: items.length,
                    bad: items.filter(t =>
                        /MOCK-COMMENT-SHOULD-NOT-APPEAR|SR-ONLY-SHOULD-NOT-APPEAR|you said|claude responded|load earlier/i.test(t)),
                    sample: items[0] || '',
                };
            });
            assert('Injected comment and sr-only stripped from question text',
                contamination.total > 0 && contamination.bad.length === 0,
                contamination.bad.length
                    ? `leaked in ${contamination.bad.length}: ${JSON.stringify(contamination.bad[0].slice(0, 70))}`
                    : `${contamination.total} items clean, e.g. ${JSON.stringify(contamination.sample.slice(0, 50))}`);

            // TEST 21: jump terminates AND the busy flag is genuinely used.
            // Asserting only "not busy at the end" was satisfied by never setting it.
            const jump = await page.evaluate(async () => {
                const v = window.__mockVirtualization;
                v.scrollToFraction(1);
                await new Promise(r => setTimeout(r, 250));
                const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                if (!items.length) return { ok: false, reason: 'no nav items' };
                let busySeen = false;
                const t0 = Date.now();
                items[0].click();
                // 10s budget > the implementation's own 8 x (800+250) = 8400ms bound.
                for (let i = 0; i < 100; i++) {
                    if (document.querySelector('[data-acn-jumping="true"]')) busySeen = true;
                    await new Promise(r => setTimeout(r, 100));
                    if (!document.querySelector('[data-acn-jumping="true"]') && busySeen) break;
                    if (Date.now() - t0 > 10000) break;
                }
                return { ok: true, elapsedMs: Date.now() - t0, busySeen,
                         stillBusy: !!document.querySelector('[data-acn-jumping="true"]'),
                         indexBacked: !!window.__ACN_INDEX_BACKED };
            });
            // Busy is only expected on the index-backed entry: without an index the
            // click short-circuits to the toast and never enters the loop.
            assert('Jump terminates without hanging',
                jump.ok && !jump.stillBusy && (!platform.indexBacked || jump.busySeen),
                jump.ok ? `~${jump.elapsedMs}ms, busy observed=${jump.busySeen}, stuck=${jump.stillBusy}`
                        : jump.reason);

            // ── TESTS 22-25: index-backed jump (the primary v12.0 path) ────
            if (platform.indexBacked) {
                // TEST 22: panel lists the whole conversation while the DOM holds 3.
                const coverage = await page.evaluate(() => {
                    const stat = document.querySelector('[data-acn-role="nav-stat"]');
                    return { listed: stat ? +stat.getAttribute('data-acn-count') : -1,
                             mountedInDom: window.__mockVirtualization.mountedCount(),
                             realTurns: window.__mockVirtualization.totalTurns };
                });
                assert('Index lists the whole conversation, not the mounted window',
                    coverage.listed === coverage.realTurns &&
                    coverage.mountedInDom < coverage.realTurns,
                    `lists ${coverage.listed}/${coverage.realTurns}, DOM holds ${coverage.mountedInDom}`);

                // TEST 23: jump to question #1 from the BOTTOM.
                // Asserts the target was unmounted at click time AND that the landed
                // row is the RIGHT message — not merely that something mounted. With
                // ciDeriveRowOffset hardcoded to 0 this must fail.
                const firstJump = await page.evaluate(async () => {
                    const v = window.__mockVirtualization;
                    v.scrollToFraction(1);
                    await new Promise(r => setTimeout(r, 300));
                    const before = v.mountedIndexes();
                    const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                    if (!items.length) return { ok: false, reason: 'no nav items' };
                    const wantText = items[0].querySelector('[data-acn-role="nav-item-text"]').textContent.trim();
                    const t0 = Date.now();
                    items[0].click();
                    for (let i = 0; i < 110; i++) {
                        await new Promise(r => setTimeout(r, 100));
                        const arrived = !!document.querySelector('[data-index="0"]');
                        const busy = !!document.querySelector('[data-acn-jumping="true"]');
                        if (arrived && !busy) break;
                        if (Date.now() - t0 > 11000) break;
                    }
                    const row = document.querySelector('[data-index="0"]');
                    const rowText = row
                        ? (row.querySelector('[data-testid="user-message"]') || row).textContent
                        : '';
                    return { ok: true, elapsedMs: Date.now() - t0,
                             targetWasMountedAtClick: before.indexOf(0) !== -1,
                             targetMountedNow: !!row,
                             // Question 1 must be the message at row 0.
                             rowIsQuestion1: /Question number 1\b/.test(rowText),
                             navTextWasQuestion1: /Question number 1\b/.test(wantText),
                             stillBusy: !!document.querySelector('[data-acn-jumping="true"]'),
                             mountedNow: v.mountedIndexes() };
                });
                assert('Jump reaches question #1 from the bottom, landing on the right message',
                    firstJump.ok && !firstJump.targetWasMountedAtClick &&
                    firstJump.targetMountedNow && firstJump.rowIsQuestion1 &&
                    firstJump.navTextWasQuestion1 && !firstJump.stillBusy,
                    firstJump.ok
                        ? `unmounted@click=${!firstJump.targetWasMountedAtClick} ` +
                          `mounted=${firstJump.targetMountedNow} correctMsg=${firstJump.rowIsQuestion1} ` +
                          `~${firstJump.elapsedMs}ms rows=[${firstJump.mountedNow}]`
                        : firstJump.reason);

                // TEST 24: jump to a MID-conversation question from the top.
                // Deliberately NOT the last question: the last one maps adjacent to the
                // pinned tail, so an off-by-one lands on an always-mounted row and looks
                // like success. A middle target has no such escape hatch.
                const midJump = await page.evaluate(async () => {
                    const v = window.__mockVirtualization;
                    v.scrollToFraction(0);
                    await new Promise(r => setTimeout(r, 300));
                    const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item"]'));
                    const targetOrdinal = 20;                    // question #20
                    const item = items[targetOrdinal - 1];
                    if (!item) return { ok: false, reason: 'no item ' + targetOrdinal };
                    const before = v.mountedIndexes();
                    const expectRow = (targetOrdinal - 1) * 2;   // user rows are even
                    const t0 = Date.now();
                    item.click();
                    for (let i = 0; i < 110; i++) {
                        await new Promise(r => setTimeout(r, 100));
                        const arrived = !!document.querySelector(`[data-index="${expectRow}"]`);
                        const busy = !!document.querySelector('[data-acn-jumping="true"]');
                        if (arrived && !busy) break;
                        if (Date.now() - t0 > 11000) break;
                    }
                    const row = document.querySelector(`[data-index="${expectRow}"]`);
                    const rowText = row
                        ? (row.querySelector('[data-testid="user-message"]') || row).textContent
                        : '';
                    return { ok: true, expectRow, elapsedMs: Date.now() - t0,
                             wasMountedAtClick: before.indexOf(expectRow) !== -1,
                             mountedNow: !!row,
                             correctMessage: new RegExp('Question number ' + targetOrdinal + '\\b').test(rowText),
                             stillBusy: !!document.querySelector('[data-acn-jumping="true"]'),
                             rows: v.mountedIndexes() };
                });
                assert('Jump reaches a mid-conversation question and lands on the right message',
                    midJump.ok && !midJump.wasMountedAtClick && midJump.mountedNow &&
                    midJump.correctMessage && !midJump.stillBusy,
                    midJump.ok
                        ? `row ${midJump.expectRow} unmounted@click=${!midJump.wasMountedAtClick} ` +
                          `mounted=${midJump.mountedNow} correctMsg=${midJump.correctMessage} ` +
                          `~${midJump.elapsedMs}ms rows=[${midJump.rows}]`
                        : midJump.reason);

                // TEST 25: the settle loop actually has to WORK for it.
                // scrollHeight must drift as rows are measured, otherwise the first
                // interpolation always lands and the convergence machinery is dead code
                // (a reviewer proved this by throwing inside the cluster selector and
                // seeing nothing fail).
                const drift = await page.evaluate(async () => {
                    const v = window.__mockVirtualization;
                    // Reset measured heights first. Earlier tests scroll extensively, and
                    // once most rows have been measured the estimate/actual gap closes —
                    // drift is a property of the UNMEASURED state, so measuring it after
                    // a full sweep reports ~0 and the assertion becomes order-dependent.
                    v.resetMeasurements();
                    const seen = [];
                    for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
                        v.scrollToFraction(f);
                        await new Promise(r => setTimeout(r, 120));
                        seen.push(v.scrollHeight());
                    }
                    v.scrollToFraction(0);
                    return { seen, min: Math.min(...seen), max: Math.max(...seen),
                             measured: v.measuredCount(), total: v.totalMessages };
                });
                const driftPct = 100 * (drift.max - drift.min) / drift.min;
                assert('Mock reproduces scrollHeight drift (convergence is exercised)',
                    driftPct > 1,
                    `scrollHeight ${drift.min}..${drift.max} (${driftPct.toFixed(2)}%), ` +
                    `${drift.measured}/${drift.total} rows measured`);

                // TEST 26: abandoned-branch messages must NOT be listed.
                // The fixture hangs a two-message branch off a mid-conversation parent.
                // Replacing the tree walk with `msgs.slice()` must now fail here.
                const branch = await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item-text"]'))
                        .map(i => i.textContent);
                    return {
                        total: items.length,
                        leaked: items.filter(t => /ABANDONED BRANCH/i.test(t)).length,
                    };
                });
                assert('Abandoned branch excluded from the question list',
                    branch.leaked === 0 && branch.total === platform.virtualized.totalTurns,
                    `${branch.leaked} abandoned message(s) leaked; ${branch.total} items listed ` +
                    `(expected ${platform.virtualized.totalTurns})`);

                // TEST 27: message text must come from content[] blocks, not the
                // top-level `text` field. The real API returns `text: ''` on EVERY
                // message (measured: 0 of 192 non-empty) and the fixture mirrors that,
                // so if ciExtractText were "simplified" to read msg.text the index would
                // be empty and every jump would fail — silently, with no error anywhere.
                const contentSource = await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item-text"]'))
                        .map(i => i.textContent.trim());
                    return {
                        count: items.length,
                        nonEmpty: items.filter(t => t.length > 0).length,
                        matchesFixture: items.filter(t => /Question number \d+/.test(t)).length,
                    };
                });
                assert('Question text is sourced from content[] blocks, not the empty text field',
                    contentSource.count > 0 &&
                    contentSource.nonEmpty === contentSource.count &&
                    contentSource.matchesFixture === contentSource.count,
                    `${contentSource.matchesFixture}/${contentSource.count} items carry ` +
                    `content[]-derived text (fixture sets text:'' on every message)`);
            }
        }

        // ── TEST: non-virtualized platforms must not enter the settle loop ──
        // Acceptance criterion "non-virtualized platforms unaffected" had no coverage.
        // Clicking a question on a static mock must resolve directly and never set the
        // jump-busy state.
        if (!platform.virtualized) {
            const direct = await page.evaluate(async () => {
                const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                if (!items.length) return { ok: false, reason: 'no nav items' };
                let busySeen = false;
                items[0].click();
                for (let i = 0; i < 12; i++) {
                    if (document.querySelector('[data-acn-jumping="true"]')) busySeen = true;
                    await new Promise(r => setTimeout(r, 50));
                }
                return { ok: true, busySeen };
            });
            assert('Non-virtualized platform uses the direct path (no settle loop)',
                direct.ok && !direct.busySeen,
                direct.ok ? `jump-busy never set: ${!direct.busySeen}` : direct.reason);
        }

        // ── FINAL: no uncaught page errors, for EVERY platform ──────────────
        // Must be last: an earlier position meant errors thrown by later tests were
        // never seen (proven — a late throw during a jump passed 25/25). Previously
        // this was also gated to virtualized platforms only, so the other 14 collected
        // errors and discarded them.
        assert('No uncaught page errors', pageErrors.length === 0,
            pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'clean');

    } catch (err) {
        assert('No runtime errors', false, err.message);
    } finally {
        // Detach so errors do not bleed into the next platform's run — the page
        // object is reused across all 15 platforms.
        page.off('pageerror', onPageError);
    }

    return results;
}

// ── Browser launcher ──────────────────────────────────────────────────────────

async function launchBrowser(engineKey) {
    const engine = BROWSER_ENGINES[engineKey];

    // Try hardcoded fallback paths first (for local dev environments)
    let executablePath;
    for (const p of engine.fallbackPaths) {
        if (fs.existsSync(p)) {
            executablePath = p;
            break;
        }
    }

    const launchOptions = {
        headless: true,
    };

    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    if (engine.launchArgs.length > 0) {
        launchOptions.args = engine.launchArgs;
    }

    return engine.launcher.launch(launchOptions);
}

// ── Run all platform tests on a single browser engine ─────────────────────────

async function runTestsOnEngine(engineKey, scriptContent, captureScreenshots) {
    const engine = BROWSER_ENGINES[engineKey];

    console.log(`  Launching ${engine.name}...`);

    let browser;
    try {
        browser = await launchBrowser(engineKey);
    } catch (err) {
        console.log(`  SKIP — ${engine.name} not installed (${err.message.split('\n')[0]})`);
        return { engineName: engine.name, skipped: true, results: [] };
    }

    console.log(`  ${engine.name} launched successfully`);
    console.log('');

    // Set up screenshot directory for this engine
    let screenshotOpts = null;
    if (captureScreenshots) {
        const screenshotDir = path.join(__dirname, 'screenshots', engineKey);
        fs.mkdirSync(screenshotDir, { recursive: true });
        screenshotOpts = { dir: screenshotDir };
        console.log(`  Screenshots: ${screenshotDir}`);
        console.log('');
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    const allResults = [];
    for (const platform of PLATFORMS) {
        process.stdout.write(`  Testing ${platform.name}... `);
        const result = await testPlatform(page, platform, scriptContent, screenshotOpts);
        allResults.push(result);

        const failCount = result.tests.filter(t => t.status === 'FAIL').length;
        if (failCount === 0) {
            console.log(`PASS (${result.tests.length}/${result.tests.length} tests)`);
        } else {
            console.log(`FAIL (${failCount} failed)`);
        }
    }

    await context.close();
    await browser.close();

    return { engineName: engine.name, skipped: false, results: allResults };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const browsers = parseBrowserArg();
    const captureScreenshots = shouldCaptureScreenshots();

    console.log('');
    console.log('========================================');
    console.log(' AI Conversation Navigator — Test Suite');
    console.log('        v10.0 Orbital Button System     ');
    console.log('========================================');
    console.log(`  Browsers: ${browsers.map(b => BROWSER_ENGINES[b].name).join(', ')}`);
    console.log(`  Platform: ${process.platform} (${process.arch})`);
    if (captureScreenshots) console.log('  Screenshots: ENABLED');
    console.log('========================================');
    console.log('');

    const scriptContent = getScriptContent();

    // Run tests on each selected browser engine
    const engineResults = [];
    for (const engineKey of browsers) {
        console.log(`── ${BROWSER_ENGINES[engineKey].name} ${'─'.repeat(38 - BROWSER_ENGINES[engineKey].name.length)}`);
        const result = await runTestsOnEngine(engineKey, scriptContent, captureScreenshots);
        engineResults.push({ ...result, engineKey });
        console.log('');
    }

    // ── Print detailed report ──────────────────────────────────────────────
    console.log('========================================');
    console.log(' DETAILED RESULTS');
    console.log('========================================');

    let grandTotalTests = 0;
    let grandTotalPassed = 0;
    let grandTotalFailed = 0;
    let enginesSkipped = 0;

    for (const engineResult of engineResults) {
        if (engineResult.skipped) {
            console.log('');
            console.log(`  ${engineResult.engineName}: SKIPPED (not installed)`);
            enginesSkipped++;
            continue;
        }

        console.log('');
        console.log(`  ── ${engineResult.engineName} ──`);

        for (const result of engineResult.results) {
            const icon = result.passed ? '\u2705' : '\u274C';
            console.log('');
            console.log(`  ${icon} ${result.name}`);
            console.log('    ' + '-'.repeat(38));

            for (const test of result.tests) {
                const mark = test.status === 'PASS' ? '\u2713' : '\u2717';
                console.log(`    ${mark} ${test.testName}: ${test.detail}`);
                grandTotalTests++;
                if (test.status === 'PASS') grandTotalPassed++;
                else grandTotalFailed++;
            }
        }
    }

    // ── Summary ────────────────────────────────────────────────────────────
    const enginesRun = engineResults.filter(e => !e.skipped);
    const allPlatformResults = enginesRun.flatMap(e => e.results);
    const platformsPassed = allPlatformResults.filter(r => r.passed).length;
    const platformsFailed = allPlatformResults.filter(r => !r.passed).length;

    console.log('');
    console.log('========================================');
    console.log(' SUMMARY');
    console.log('========================================');
    console.log(`  Engines:   ${enginesRun.length} tested, ${enginesSkipped} skipped (${engineResults.length} total)`);
    console.log(`  Platforms: ${platformsPassed} passed, ${platformsFailed} failed (${allPlatformResults.length} total)`);
    console.log(`  Tests:     ${grandTotalPassed} passed, ${grandTotalFailed} failed (${grandTotalTests} total)`);
    console.log('========================================');
    console.log('');

    // ── Generate SCREENSHOTS.md if screenshots were captured ──────────────
    if (captureScreenshots) {
        const screenshotBaseDir = path.join(__dirname, 'screenshots');
        const mdPath = path.join(screenshotBaseDir, 'SCREENSHOTS.md');
        let md = '# Test Screenshots\n\n';
        md += `Generated on ${new Date().toISOString().split('T')[0]} `;
        md += `| Platform: ${process.platform} (${process.arch})\n\n`;

        for (const engineResult of engineResults) {
            if (engineResult.skipped) continue;

            md += `## ${engineResult.engineName}\n\n`;

            for (const result of engineResult.results) {
                if (!result.screenshots || result.screenshots.length === 0) continue;

                const status = result.passed ? 'PASS' : 'FAIL';
                md += `### ${result.name} — ${status}\n\n`;

                // Show zone and panel-open side by side
                md += '| Zone Injected | Panel Open |\n';
                md += '|:---:|:---:|\n';

                const zoneShot  = result.screenshots.find(s => s.label === 'Zone injected');
                const panelShot = result.screenshots.find(s => s.label === 'Panel open');
                const zoneRel   = zoneShot  ? path.relative(screenshotBaseDir, zoneShot.path)  : '';
                const panelRel  = panelShot ? path.relative(screenshotBaseDir, panelShot.path) : '';

                const zoneCell  = zoneRel  ? `![${result.name} zone](${zoneRel})`  : 'N/A';
                const panelCell = panelRel ? `![${result.name} panel](${panelRel})` : 'N/A';
                md += `| ${zoneCell} | ${panelCell} |\n\n`;
            }
        }

        fs.writeFileSync(mdPath, md);
        console.log(`  Screenshots report: ${mdPath}`);
        console.log('');
    }

    // Fail if any tests failed or if ALL engines were skipped
    if (grandTotalFailed > 0) process.exit(1);
    if (enginesRun.length === 0) {
        console.error('ERROR: No browser engines were available to test.');
        process.exit(2);
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(2);
});
