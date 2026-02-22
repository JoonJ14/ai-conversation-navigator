/**
 * AI Conversation Navigator — Automated Platform Test Suite
 *
 * Tests every supported platform across multiple browser engines by:
 *  1. Loading mock HTML into headless browser pages via Playwright
 *  2. Faking window.location.hostname so the userscript detects the right platform
 *  3. Injecting the userscript
 *  4. Verifying: toggle button renders, panel opens, correct message count detected,
 *     theme colors match, icon matches, and navigation items are clickable.
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
        expectedMessages: 3,
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
    {
        name: 'V0',
        mockFile: 'v0.html',
        hostname: 'v0.app',
        pathname: '/chat/test-project',
        expectedMessages: 3,
        expectedAccent: 'rgb(255, 255, 255)',   // #ffffff
        expectedIcon: '\u25BD',                 // ▽
    },
    {
        name: 'Base44',
        mockFile: 'base44.html',
        hostname: 'app.base44.com',
        pathname: '/projects/test',
        expectedMessages: 3,
        expectedAccent: 'rgb(99, 102, 241)',    // #6366f1
        expectedIcon: '\u2B22',                 // ⬢
    },
    {
        name: 'Emergent',
        mockFile: 'emergent.html',
        hostname: 'app.emergent.sh',
        pathname: '/project/test',
        expectedMessages: 3,
        expectedAccent: 'rgb(16, 185, 129)',    // #10b981
        expectedIcon: 'e',
    },
    {
        name: 'Perplexity',
        mockFile: 'perplexity.html',
        hostname: 'www.perplexity.ai',
        pathname: '/search/test',
        expectedMessages: 3,
        expectedAccent: 'rgb(32, 184, 205)',    // #20b8cd
        expectedIcon: '\u2733\uFE0E',             // ✳︎ (text presentation — same as Claude)
    },
    {
        name: 'Firebase Studio',
        mockFile: 'firebase.html',
        hostname: '6000-firebase-studio-12345.cluster-abc123.cloudworkstations.dev',
        pathname: '/capra/',
        expectedMessages: 3,
        expectedAccent: 'rgb(255, 166, 17)',    // #FFA611
        expectedIcon: '\u2726',                 // ✦
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

        // Wait for initialization (script has a 2-second setTimeout for initial scan)
        await page.waitForTimeout(3500);

        // ── TEST 1: Button Container exists AND is visible ──
        const containerExists = await page.evaluate(() => {
            const el = document.getElementById('ai-nav-button-container');
            return el && window.getComputedStyle(el).display !== 'none';
        });
        assert('Button container visible', containerExists, containerExists ? 'Found and visible' : 'Missing or hidden');

        // ── TEST 2: Panel exists ──
        const panelExists = await page.evaluate(() => {
            return !!document.getElementById('ai-nav-panel');
        });
        assert('Panel exists', panelExists, panelExists ? 'Found #ai-nav-panel' : 'Missing');

        if (!containerExists || !panelExists) {
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

        // ── SCREENSHOT: Toggle button visible ──
        if (screenshotOpts) {
            const slug = slugify(platform.name);
            const filePath = path.join(screenshotOpts.dir, `${slug}-toggle.png`);
            await page.screenshot({ path: filePath, fullPage: true });
            results.screenshots.push({ label: 'Toggle button', path: filePath });
        }

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

        // ── SCREENSHOT: Panel open with nav items ──
        if (screenshotOpts) {
            const slug = slugify(platform.name);
            const filePath = path.join(screenshotOpts.dir, `${slug}-panel-open.png`);
            await page.screenshot({ path: filePath, fullPage: true });
            results.screenshots.push({ label: 'Panel open', path: filePath });
        }

        // ── TEST 9: Nav items are clickable (don't throw) ──
        let clickable = true;
        try {
            if (messageCount > 0) {
                await page.evaluate(() => {
                    document.querySelector('.ai-nav-item').click();
                });
                await page.waitForTimeout(500);
            }
        } catch (e) {
            clickable = false;
        }
        assert('Nav items clickable', clickable, clickable ? 'Click succeeded' : 'Click threw error');

        // ── TEST 10: Click toggle to close panel ──
        // On left-chat platforms, clicking a nav item (Test 9) closes the panel first,
        // then scrolls to the message. So the panel may already be closed.
        // Ensure the panel is open before testing the close toggle.
        const alreadyClosed = await page.evaluate(() => {
            return !document.getElementById('ai-nav-panel').classList.contains('open');
        });
        if (alreadyClosed) {
            // Re-open the panel so we can test closing it
            await page.evaluate(() => {
                document.getElementById('ai-nav-toggle').click();
            });
            await page.waitForTimeout(500);
        }
        // Now click toggle to close
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

    // ── Print detailed report ─────────────────────────────────────────────
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

    // ── Summary ───────────────────────────────────────────────────────────
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

    // ── Generate SCREENSHOTS.md if screenshots were captured ──────────
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

                // Show toggle and panel-open side by side
                md += '| Toggle Button | Panel Open |\n';
                md += '|:---:|:---:|\n';

                const toggleShot = result.screenshots.find(s => s.label === 'Toggle button');
                const panelShot = result.screenshots.find(s => s.label === 'Panel open');
                const toggleRel = toggleShot ? path.relative(screenshotBaseDir, toggleShot.path) : '';
                const panelRel = panelShot ? path.relative(screenshotBaseDir, panelShot.path) : '';

                const toggleCell = toggleRel ? `![${result.name} toggle](${toggleRel})` : 'N/A';
                const panelCell = panelRel ? `![${result.name} panel](${panelRel})` : 'N/A';
                md += `| ${toggleCell} | ${panelCell} |\n\n`;
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
