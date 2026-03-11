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

// Build a test page with mock DOM + userscript embedded
function buildTestPage(platform, scriptContent) {
    const mockHTML = fs.readFileSync(path.join(MOCK_DIR, platform.mockFile), 'utf8');

    // Extract just the <body> content from the mock HTML
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : mockHTML;

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

    try {
        // Clear any previous routes
        await page.unrouteAll();

        // Set up route interception — serves our mock HTML at the real hostname
        const targetURL = await setupRouteForPlatform(page, platform, scriptContent);

        // Navigate to the real URL (intercepted by route handler)
        await page.goto(targetURL, {
            waitUntil: 'domcontentloaded',
            timeout: 10000,
        });

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

    } catch (err) {
        assert('No runtime errors', false, err.message);
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
