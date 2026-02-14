/**
 * AI Conversation Navigator — Automated Platform Test Suite
 *
 * Tests every supported platform by:
 *  1. Loading mock HTML into a headless Chromium page via Playwright
 *  2. Faking window.location.hostname so the userscript detects the right platform
 *  3. Injecting the userscript
 *  4. Verifying: toggle button renders, panel opens, correct message count detected,
 *     theme colors match, icon matches, and navigation items are clickable.
 *
 * Usage:
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js
 *
 * Or use the convenience script:
 *   ./tests/run-tests.sh
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Platform definitions (must match the userscript) ──────────────────────────

const PLATFORMS = [
    {
        name: 'Claude',
        mockFile: 'claude.html',
        hostname: 'claude.ai',
        pathname: '/chat/test',
        expectedMessages: 3,
        expectedAccent: 'rgb(217, 119, 6)',    // #d97706
        expectedIcon: '\u2733',                 // ✳
    },
    {
        name: 'Claude Code',
        mockFile: 'claude-code.html',
        hostname: 'claude.ai',
        pathname: '/code/test',
        // Claude Code fallback: data-testid selectors find 0, then bg-bg-200 fallback finds 3
        expectedMessages: 3,
        expectedAccent: 'rgb(217, 119, 6)',
        expectedIcon: '\u2733',
    },
    {
        name: 'ChatGPT',
        mockFile: 'chatgpt.html',
        hostname: 'chatgpt.com',
        pathname: '/c/test',
        expectedMessages: 4,
        expectedAccent: 'rgb(255, 255, 255)',   // #ffffff
        expectedIcon: '\u23E3',                 // ⏣
    },
    {
        name: 'Codex Web',
        mockFile: 'codex.html',
        hostname: 'chatgpt.com',
        pathname: '/codex/test',
        // Codex: no data-message-author-role, falls back to self-end + bg-token-bg-tertiary
        expectedMessages: 2,
        expectedAccent: 'rgb(255, 255, 255)',
        expectedIcon: '\u23E3',
    },
    {
        name: 'Grok',
        mockFile: 'grok.html',
        hostname: 'grok.com',
        pathname: '/chat/test',
        expectedMessages: 3,
        expectedAccent: 'rgb(220, 38, 38)',     // #dc2626
        expectedIcon: 'X',
    },
    {
        name: 'Gemini',
        mockFile: 'gemini.html',
        hostname: 'gemini.google.com',
        pathname: '/app/test',
        expectedMessages: 3,
        expectedAccent: 'rgb(66, 133, 244)',    // #4285f4
        expectedIcon: '\u2726',                 // ✦
    },
    {
        name: 'Bolt.new',
        mockFile: 'bolt.html',
        hostname: 'bolt.new',
        pathname: '/test-project',
        expectedMessages: 3,
        expectedAccent: 'rgb(56, 189, 248)',     // #38BDF8
        expectedIcon: '\u26A1\uFE0E',           // ⚡ (text presentation)
    },
    {
        name: 'Lovable',
        mockFile: 'lovable.html',
        hostname: 'lovable.dev',
        pathname: '/projects/test-project',     // Must include /projects/ for the guard
        expectedMessages: 4,
        expectedAccent: 'rgb(155, 135, 245)',   // #9b87f5
        expectedIcon: '\u2665',                 // ♥
    },
    {
        name: 'Replit',
        mockFile: 'replit.html',
        hostname: 'replit.com',
        pathname: '/@user/project',
        expectedMessages: 3,
        expectedAccent: 'rgb(242, 101, 34)',    // #F26522
        expectedIcon: '\u2815',                 // ⠕
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
// Clear duplicate guard from previous test
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

async function testPlatform(page, platform, scriptContent) {
    const results = { name: platform.name, tests: [], passed: true };

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

        // Wait for initialization (script has a 2-second setTimeout for initial scan)
        await page.waitForTimeout(3500);

        // ── TEST 1: Toggle button exists ──
        const toggleExists = await page.evaluate(() => {
            return !!document.getElementById('ai-nav-toggle');
        });
        assert('Toggle button exists', toggleExists, toggleExists ? 'Found #ai-nav-toggle' : 'Missing');

        // ── TEST 2: Panel exists ──
        const panelExists = await page.evaluate(() => {
            return !!document.getElementById('ai-nav-panel');
        });
        assert('Panel exists', panelExists, panelExists ? 'Found #ai-nav-panel' : 'Missing');

        if (!toggleExists || !panelExists) {
            return results;
        }

        // ── TEST 3: Icon matches ──
        const actualIcon = await page.evaluate(() => {
            const toggle = document.getElementById('ai-nav-toggle');
            const firstChild = toggle.childNodes[0];
            return firstChild ? firstChild.textContent.trim() : '';
        });
        assert('Icon matches', actualIcon === platform.expectedIcon,
            `Expected "${platform.expectedIcon}", got "${actualIcon}"`);

        // ── TEST 4: Theme accent color ──
        const actualBg = await page.evaluate(() => {
            const toggle = document.getElementById('ai-nav-toggle');
            return window.getComputedStyle(toggle).backgroundColor;
        });
        assert('Theme accent color', actualBg === platform.expectedAccent,
            `Expected "${platform.expectedAccent}", got "${actualBg}"`);

        // ── TEST 5: Click toggle to open panel ──
        await page.evaluate(() => {
            document.getElementById('ai-nav-toggle').click();
        });
        await page.waitForTimeout(1000);

        const panelOpen = await page.evaluate(() => {
            return document.getElementById('ai-nav-panel').classList.contains('open');
        });
        assert('Panel opens on click', panelOpen, panelOpen ? 'Panel has .open class' : 'Panel NOT open');

        // Wait extra for the scan to complete after opening
        await page.waitForTimeout(1500);

        // ── TEST 6: Correct number of messages detected ──
        const messageCount = await page.evaluate(() => {
            const items = document.querySelectorAll('.ai-nav-item');
            return items.length;
        });
        assert('Message count', messageCount === platform.expectedMessages,
            `Expected ${platform.expectedMessages}, got ${messageCount}`);

        // ── TEST 7: Stats text is correct ──
        const statsText = await page.evaluate(() => {
            return document.getElementById('ai-nav-stats').textContent;
        });
        const expectedStats = platform.expectedMessages + ' question' +
            (platform.expectedMessages !== 1 ? 's' : '') + ' found';
        assert('Stats text', statsText === expectedStats,
            `Expected "${expectedStats}", got "${statsText}"`);

        // ── TEST 8: Each nav item has a summary ──
        const allHaveSummaries = await page.evaluate(() => {
            const items = document.querySelectorAll('.ai-nav-item');
            return Array.from(items).every(item => {
                const summary = item.querySelector('.ai-nav-summary');
                return summary && summary.textContent.trim().length > 0;
            });
        });
        assert('All items have summaries', allHaveSummaries,
            allHaveSummaries ? 'All summaries non-empty' : 'Some summaries missing');

        // ── TEST 9: Nav items are clickable (don't throw) ──
        let clickable = true;
        try {
            if (messageCount > 0) {
                await page.evaluate(() => {
                    document.querySelector('.ai-nav-item').click();
                });
                await page.waitForTimeout(300);
            }
        } catch (e) {
            clickable = false;
        }
        assert('Nav items clickable', clickable, clickable ? 'Click succeeded' : 'Click threw error');

        // ── TEST 10: Click toggle again to close ──
        await page.evaluate(() => {
            document.getElementById('ai-nav-toggle').click();
        });
        await page.waitForTimeout(500);
        const panelClosed = await page.evaluate(() => {
            return !document.getElementById('ai-nav-panel').classList.contains('open');
        });
        assert('Panel closes on second click', panelClosed,
            panelClosed ? 'Panel closed' : 'Panel still open');

    } catch (err) {
        assert('No runtime errors', false, err.message);
    }

    return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('');
    console.log('========================================');
    console.log(' AI Conversation Navigator — Test Suite');
    console.log('========================================');
    console.log('');

    // Read userscript
    const scriptContent = getScriptContent();

    // Launch browser — single page, reused for all tests (stable on old kernels)
    const chromiumPath = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
    const headlessShell = '/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell';
    const execPath = fs.existsSync(chromiumPath) ? chromiumPath : headlessShell;

    const browser = await chromium.launch({
        headless: true,
        executablePath: execPath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--single-process',
        ],
    });

    console.log(`Browser launched: ${execPath.split('/').pop()}`);

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('');

    // Run all platform tests sequentially on the same page
    const allResults = [];
    for (const platform of PLATFORMS) {
        process.stdout.write(`Testing ${platform.name}... `);
        const result = await testPlatform(page, platform, scriptContent);
        allResults.push(result);

        const failCount = result.tests.filter(t => t.status === 'FAIL').length;
        if (failCount === 0) {
            console.log(`PASS (${result.tests.length}/${result.tests.length} tests)`);
        } else {
            console.log(`FAIL (${failCount} failed)`);
        }
    }

    // Cleanup
    await context.close();
    await browser.close();

    // ── Print detailed report ─────────────────────────────────────────────
    console.log('');
    console.log('========================================');
    console.log(' DETAILED RESULTS');
    console.log('========================================');

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    for (const result of allResults) {
        const icon = result.passed ? '\u2705' : '\u274C';
        console.log('');
        console.log(`${icon} ${result.name}`);
        console.log('  ' + '-'.repeat(40));

        for (const test of result.tests) {
            const mark = test.status === 'PASS' ? '\u2713' : '\u2717';
            console.log(`  ${mark} ${test.testName}: ${test.detail}`);
            totalTests++;
            if (test.status === 'PASS') totalPassed++;
            else totalFailed++;
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    const platformsPassed = allResults.filter(r => r.passed).length;
    const platformsFailed = allResults.filter(r => !r.passed).length;

    console.log('');
    console.log('========================================');
    console.log(' SUMMARY');
    console.log('========================================');
    console.log(`  Platforms: ${platformsPassed} passed, ${platformsFailed} failed (${allResults.length} total)`);
    console.log(`  Tests:     ${totalPassed} passed, ${totalFailed} failed (${totalTests} total)`);
    console.log('========================================');
    console.log('');

    process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(2);
});
