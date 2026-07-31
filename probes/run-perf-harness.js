// Summary perf probe — SYNTHETIC-context runner.
//
// Serves the claude-virtualized mock at https://claude.ai/chat/<uuid> via route
// interception (same mechanism as tests/test-all-platforms.js), with:
//   - a paragraph-scale payload (perf-payload.js) served by a GM shim
//   - the download-capture shim (so summary export completes without navigation)
//   - the INSTRUMENTED userscript (perf-instrument.js) inlined
// then drives: open summary (auto-generate, run 1) -> regenerate (run 2) ->
// tools -> export summary (run 3, trigger=export), and collects __acnPerfJson.
//
// CONTEXT of every number this produces (record it with the finding):
// Playwright <engine> on this machine, page realm (no Tampermonkey sandbox),
// mock DOM whose row texts do NOT match the payload (jump alignment degraded —
// irrelevant to analysis cost, which runs on payload text). The decision-grade
// context is the owner's Firefox + Tampermonkey visible tab on the real
// conversation — see probes/README.md for that procedure.
//
// Usage:
//   node probes/run-perf-harness.js [--browser chromium,firefox] [--sizes 25,50,100,147]
//   HEADED=1        run with a visible window (needs a display)
//   PARA_BOOST=3    3x paragraphs per answer      (perf-payload.js knob)
//   KP_RATE=2       2x key-point sentence density (perf-payload.js knob)

'use strict';

const fs = require('fs');
const path = require('path');
const { buildConversation } = require('./perf-payload');
const { instrument } = require('./perf-instrument');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const OUTDIR = path.join(__dirname, 'results');
const CONV_UUID = '77777777-7777-4777-8777-777777777777';
const ORG = '99999999-9999-4999-8999-999999999999';

function parseArg(name, dflt) {
    const i = process.argv.indexOf('--' + name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

function gmShim(payload) {
    return `
<script>
(function () {
    var ORG = ${JSON.stringify(ORG)};
    var PAYLOAD = ${JSON.stringify(payload)};
    var API_LATENCY_MS = 50;
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, API_LATENCY_MS);
        }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ORG, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        if (url.indexOf('/chat_conversations/') !== -1) {
            if (url.indexOf(ORG) === -1) { respond(404, ''); return; }
            window.__convFetches = (window.__convFetches || 0) + 1;
            respond(200, JSON.stringify(PAYLOAD));
            return;
        }
        respond(404, '');
    };
    var _store = {};
    window.GM_getValue = function (k, d) { return _store.hasOwnProperty(k) ? _store[k] : d; };
    window.GM_setValue = function (k, v) { _store[k] = v; };
    try { document.cookie = 'lastActiveOrg=' + ORG + '; path=/'; } catch (e) {}
}());
</script>`;
}

// Verbatim copy of the harness DOWNLOAD_SHIM (tests/test-all-platforms.js).
const DOWNLOAD_SHIM = `<script>
(function () {
    var blobByUrl = {};
    var origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj) {
        var url = origCreate(obj);
        blobByUrl[url] = obj;
        return url;
    };
    var origRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = function (url) {
        delete blobByUrl[url];
        return origRevoke(url);
    };
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download')) {
            window.__acnTestDownloads = window.__acnTestDownloads || [];
            window.__acnTestDownloads.push({
                filename: this.getAttribute('download'),
                blob: blobByUrl[this.href] || null
            });
            return;
        }
        return origClick.apply(this, arguments);
    };
}());
</script>`;

function buildPage(q, seed, scriptContent) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : mockHTML;
    const conv = buildConversation(q, seed, CONV_UUID);
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ACN Perf Probe q=${q}</title></head>
<body>
<script>window.__MOCK_CONFIG = ${JSON.stringify({ totalMessages: 2 * q })};</script>
${bodyContent}
<script>delete window._aiNavAlreadyLoaded;</script>
${gmShim(conv.payload)}
${DOWNLOAD_SHIM}
<script>
${scriptContent}
</script>
</body>
</html>`;
    return { html, stats: conv.stats };
}

async function driveOnce(page, q) {
    return await page.evaluate(async (q) => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const out = {};

        // 1. Wait for the index: nav-stat count == q (open the nav panel first —
        //    the count attribute lives on the nav panel's stat line).
        const navTrigger = document.querySelector('[data-acn-role="nav-trigger"]');
        if (!navTrigger) return { err: 'no nav trigger (zone missing?)' };
        navTrigger.click();
        let count = -1;
        for (let t = 0; t < 300; t++) {
            await sleep(200);
            const stat = document.querySelector('[data-acn-role="nav-stat"]');
            if (stat) count = +(stat.getAttribute('data-acn-count') || -1);
            if (count === q) break;
        }
        out.navCount = count;
        if (count !== q) return { err: 'index never reached q=' + q + ' (count=' + count + ')', ...out };
        const close = document.querySelector('[data-acn-open="true"] [data-acn-role="panel-close"]');
        if (close) { close.click(); await sleep(250); }

        // 2. Open summary panel — auto-generates 50ms later (run 1).
        const dot = document.querySelector('[data-acn-dot="summary"]');
        if (!dot) return { err: 'no summary dot', ...out };
        dot.click();
        let runs = [];
        for (let t = 0; t < 1200; t++) {                 // generous: up to 4 min
            await sleep(200);
            try { runs = JSON.parse(window.__acnPerfJson || '[]'); } catch (e) { runs = []; }
            if (runs.length >= 1 && runs[0].renderMs !== undefined) break;
        }
        if (runs.length < 1) return { err: 'run 1 (auto-generate) never completed', ...out };

        // 3. Regenerate (run 2) — wait for the button to re-enable first
        //    (clicking a disabled button dispatches nothing — the S1 lesson).
        const gen = document.querySelector('[data-acn-open="true"] [data-acn-role="sum-generate"]');
        if (!gen) return { err: 'no generate control', ...out };
        for (let t = 0; t < 100 && gen.disabled; t++) await sleep(100);
        gen.click();
        for (let t = 0; t < 1200; t++) {
            await sleep(200);
            try { runs = JSON.parse(window.__acnPerfJson || '[]'); } catch (e) {}
            if (runs.length >= 2 && runs[1].renderMs !== undefined) break;
        }
        if (runs.length < 2) return { err: 'run 2 (regenerate) never completed', ...out };

        // 4. Export summary through the Tools panel (run 3, trigger=export).
        //    Settle guard first: no index reload in flight (E3's protection).
        let settled = false;
        for (let t = 0; t < 12 && !settled; t++) {
            const n = window.__convFetches || 0;
            await sleep(600);
            settled = (window.__convFetches || 0) === n;
        }
        if (!settled) return { err: 'index still reloading before export', ...out };
        window.__acnTestDownloads = [];
        if (!document.querySelector('[data-acn-open="true"] [data-acn-role="tool-export"]')) {
            const tools = document.querySelector('[data-acn-dot="tools"]');
            if (tools) { tools.click(); await sleep(350); }
        }
        const btn = document.querySelector(
            '[data-acn-open="true"] [data-acn-role="tool-export"][data-acn-export="summary"]');
        if (!btn) return { err: 'no summary-export control', ...out };
        btn.click();
        let dl = null;
        for (let t = 0; t < 1200; t++) {
            await sleep(200);
            if ((window.__acnTestDownloads || []).length) dl = window.__acnTestDownloads[0];
            try { runs = JSON.parse(window.__acnPerfJson || '[]'); } catch (e) {}
            if (dl && runs.length >= 3) break;
        }
        if (runs.length < 3) return { err: 'run 3 (export) never completed', ...out };
        await sleep(300);   // let post-turn gap probes land
        try { runs = JSON.parse(window.__acnPerfJson || '[]'); } catch (e) {}

        return {
            runs,
            exportCaptured: !!(dl && dl.blob),
            convFetches: window.__convFetches || 0,
            visibility: document.visibilityState,
            mounted: window.__mockVirtualization ? window.__mockVirtualization.mountedCount() : null,
            ...out,
        };
    }, q);
}

function fmtRun(r) {
    const phases = ['phase.map', 'phase.topics', 'phase.keyPoints', 'phase.stats', 'phase.inventory'];
    const c = r.calls || {};
    const parts = phases.map(p => `${p.replace('phase.', '')}=${c[p] ? c[p].ms.toFixed(0) : '-'}`);
    return `run#${r.run} [${r.trigger}] total=${(r.totalMs || 0).toFixed(0)}ms ` +
        `(${parts.join(' ')}) render=${r.renderMs !== undefined ? r.renderMs.toFixed(0) : '?'}ms ` +
        `gap=${r.postTurnGapMs !== undefined ? r.postTurnGapMs.toFixed(0) : '?'}ms`;
}

(async () => {
    const browsers = parseArg('browser', 'chromium,firefox').split(',');
    const sizes = parseArg('sizes', '25,50,100,147').split(',').map(Number);
    const seed = 20260730;

    fs.mkdirSync(OUTDIR, { recursive: true });
    const rawScript = fs.readFileSync(path.join(REPO, 'ai-conversation-navigator.user.js'), 'utf8');
    const probeScript = instrument(rawScript, 'perf1');

    const all = [];
    for (const engine of browsers) {
        const launchArgs = engine === 'chromium'
            ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            : [];
        const headless = process.env.HEADED !== '1';
        const browser = await playwright[engine].launch({ headless, args: launchArgs });
        const version = browser.version();
        console.log(`\n=== ${engine} ${version} (${headless ? 'headless' : 'HEADED'}, page realm) ===`);
        for (const q of sizes) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const perfLines = [];
            page.on('console', (msg) => {
                const t = msg.text();
                if (t.indexOf('[ACN-PERF]') === 0) perfLines.push(t);
            });
            const { html, stats } = buildPage(q, seed, probeScript);
            const targetURL = `https://claude.ai/chat/${CONV_UUID}`;
            await page.route('**/*', (route) => {
                const url = route.request().url();
                if (url === targetURL || url === targetURL + '/') {
                    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
                } else {
                    route.abort();
                }
            });
            await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
            const res = await driveOnce(page, q);
            const record = { engine, version, headless, q, payloadStats: stats, result: res, perfLines,
                             env: { PARA_BOOST: process.env.PARA_BOOST || '1', KP_RATE: process.env.KP_RATE || '1' } };
            all.push(record);
            if (res.err) {
                console.log(`  q=${q}: ERROR ${res.err}`);
            } else {
                console.log(`  q=${q} (${Math.round(stats.totalChars / 1024)}KB text, ` +
                    `avgUser=${stats.avgUserLen} avgAi=${stats.avgAiLen}, vis=${res.visibility}, ` +
                    `mounted=${res.mounted}, fetches=${res.convFetches}, export=${res.exportCaptured})`);
                for (const r of res.runs) console.log('    ' + fmtRun(r));
            }
            await context.close();
        }
        await browser.close();
    }
    const outPath = path.join(OUTDIR, `probe-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
    console.log(`\nFull records: ${outPath}`);
})().catch((e) => { console.error(e); process.exit(1); });
