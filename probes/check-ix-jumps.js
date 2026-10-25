// Checks for the one-click jump on the index-backed platforms (v12.15 part B): Perplexity, and
// ChatGPT's near-miss, which runs through the same code (ixJump).
//
// Run: node probes/check-ix-jumps.js [--browser chromium|firefox|webkit] [--quiet] [--only J1,K2] [--trace]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-ix-jumps.js
// Exits non-zero on any failed check.
//
// THE BUG THIS GATES (owner, v12.14; reproduced live in Chrome, page realm, 2026-10-24): one
// click on a Navigate row resolved the RIGHT entry but left the view somewhere else. Perplexity,
// Q8 from the top: the target mounted, the closing smooth scrollIntoView moved 5443 -> 5354 and
// stopped, Q8 842 px above the window. ChatGPT, Q7 from the bottom: the glide was cut off when
// the site prepended older turns, Q7 8514 px above centre. A smooth glide was cut short 8 of 8
// times live; an instant write landed within 16 px 8 of 8. The repo gate (check-index-adapters
// P12/P13) asserted which entry resolved, never where the view ended, so it passed throughout.
//
// So every fixture here asserts WHERE THE TARGET ENDED UP after ONE click, once the view has been
// still for 800 ms: its bubble fully inside the scroller, and at most 24 px from the intended
// position (centred, clamped at the scroll ends; a bubble taller than 0.8 x the scroller at its
// start) — plus the resolved entry, no toast, and no "alignment cap reached" console line.
//
// THE MOCKS: the jumpModel blocks appended to tests/mock-pages/perplexity-windowed.html and
// chatgpt-windowed.html (off by default). Each fixture names the model it runs:
//   live   what was measured live: Perplexity's question/answer slots that keep their height when
//          unmounted, +8 px growth on first mount, a site that re-writes scrollTop on every mount
//          and unmount (anchoring: it cuts a smooth glide short), 5+ entries mounted, the latest
//          always; ChatGPT prepending older turns with no reserved height (grow + anchor).
//   models the Phase 1 verifier's: reserved heights estimated then corrected with anchoring,
//          overscan, a slow-mounting window, a scroll pin that re-asserts 300 ms after a wheel.
// CONTEXT of these results: Playwright, page realm, headless, viewport 1280x720, the userscript
// inlined into the page; no real userscript manager. Every fixture is a MODEL of the live site,
// built from the live facts above; real-browser behaviour is the owner's acceptance.
//
// Proof rule: run the old build (v12.14) against this file too — every fixture marked [new]
// must FAIL there (on chromium; other engines are reported as measured). [guard] passes on both.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const GPT_CONV  = '6994e2d6-ce6c-832a-aa7d-04b747928fd8';
const PPLX_CONV = 'de5dd7ce-5eb6-4045-a861-d337141e10b6';
const uuid = (n, tag) => (tag || 'aaaaaaaa') + '-0000-4000-8000-' + String(n).padStart(12, '0');

function gptMapping(turns) {
    const m = {};
    const add = (id, parent, message) => { m[id] = { id, parent, children: [], message }; if (parent) m[parent].children.push(id); };
    add('client-created-root', null, null);
    add('sys-0', 'client-created-root', { id: 'sys-0', author: { role: 'system' }, content: { content_type: 'text', parts: [''] }, metadata: {} });
    let prev = 'sys-0';
    turns.forEach((t, i) => {
        add(t.id, prev, { id: t.id, author: { role: 'user' }, content: { content_type: 'text', parts: [t.text] }, metadata: {} });
        add('a-' + i, t.id, { id: 'a-' + i, author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Answer ' + (i + 1)] }, metadata: {} });
        prev = 'a-' + i;
    });
    return { title: 'probe', conversation_id: GPT_CONV, mapping: m, current_node: prev,
             sectioned_conversation: null, context_truncation_continuation: null };
}
const gptTurns = (n) => Array.from({ length: n }, (_, i) => ({ id: uuid(i), text: 'ChatGPT probe question ' + (i + 1) + ' about windowing?' }));
const pplxEntries = (n) => Array.from({ length: n }, (_, i) => ({
    backend_uuid: uuid(i, 'bbbbbbbb'), query_str: 'Perplexity probe question ' + (i + 1) + ' about pinned scrollers?',
    read_write_token: 'SECRET-RW-' + i, attachments: [] }));
function pplxPage(all, url) {
    const u = new URL(url);
    const limit = parseInt(u.searchParams.get('limit') || '20', 10);
    const cur = u.searchParams.get('cursor');
    const start = cur ? parseInt(cur.replace('cur-', ''), 10) : 0;
    const more = start + limit < all.length;
    return { status: 'COMPLETED', entries: all.slice(start, start + limit), has_next_page: more,
             next_cursor: more ? 'cur-' + (start + limit) : null, background_entries: [], first_entry: null,
             latest_entry: null, thread_metadata: {} };
}

function buildPage(site, scriptContent, mockConfig) {
    const file = site === 'chatgpt' ? 'chatgpt-windowed.html' : 'perplexity-windowed.html';
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages', file), 'utf8');
    const body = (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock;
    const head = (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '';
    return `<!DOCTYPE html><html><head>${head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(mockConfig || {})};</script>
${body}
<script>
delete window._aiNavAlreadyLoaded;
var _s = {};
window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
window.GM_setValue = function (k, v) { _s[k] = v; };
</script>
<script>${scriptContent}</script></body></html>`;
}

// Where the target's bubble is, relative to where it should be. err > 0: scrolled past it.
const MEASURE = `(function (a) {
    var sc = document.getElementById('mock-scroller');
    var r = sc.getBoundingClientRect();
    var bub = a.site === 'perplexity'
        ? document.querySelector('[data-workflow-entry="' + a.target + '"] [data-message-bubble="right"]')
        : document.querySelector('[data-turn-key="' + a.key + '"] [data-user-message-bubble="true"]');
    var max = sc.scrollHeight - sc.clientHeight;
    var out = { scrollTop: Math.round(sc.scrollTop), max: max, mounted: !!bub, err: null, inView: false,
                resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved'),
                toast: (document.getElementById('acn-toast') || {}).textContent || null,
                window: window.__mockWindow.mounted().join(',') };
    if (bub) {
        var b = bub.getBoundingClientRect();
        var top = b.top - r.top - sc.clientTop + sc.scrollTop;
        var lead = b.height > sc.clientHeight * 0.8 ? 0 : (sc.clientHeight - b.height) / 2;
        var ideal = Math.max(0, Math.min(max, top - lead));
        out.err = Math.round(sc.scrollTop - ideal);
        out.inView = b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
    }
    return out;
})`;

// ── Heights ───────────────────────────────────────────────────────────────
// Live Perplexity (Chrome, 2026-10-24): question slots 48-196 px, answer slots 276-1415 px.
const LIVE_Q = [64, 120, 48, 196, 88, 72, 150, 56, 110, 96, 180, 70];
const LIVE_A = [820, 1415, 276, 960, 540, 1200, 700, 1100, 380, 1300, 650, 900];
// The Phase 1 models' entry heights (seeds 1 and 2 of Report 1; Report 2's profile), split into a
// question slot and an answer slot.
const SEED1 = [2042, 1027, 966, 939, 1354, 3287, 526, 3168, 913, 1177, 1339, 2882, 1726, 2133, 3207, 1848];
const SEED2 = [583, 2589, 1437, 3146, 1986, 2249, 3450, 1369, 909, 2762, 2246, 765, 1802, 3005, 2846, 2390];
const R2 = [250, 300, 400, 350, 900, 1500, 600, 2200, 1800, 2500, 1200, 3000, 900, 2000, 1600, 1400];
const split = (hs, q) => ({ q: hs.map(() => q), a: hs.map((h) => h - q) });
// ChatGPT turns, live-like: 24 turns, the last 5 present at load, older ones prepended.
const GPT_H24 = [1400, 900, 2100, 1300, 800, 1700, 1500, 2600, 900, 1200, 1800, 1100,
                 2400, 1000, 1600, 700, 1900, 1300, 2200, 900, 1500, 1200, 2000, 1100];
const GPT_C9 = [1701, 1078, 2116, 935, 1094, 1767, 2060, 1819, 382, 1612, 2064, 993, 2071, 414, 1921, 1663, 234, 2381, 1214, 2291];

const LIVE_PPLX = Object.assign({ q: LIVE_Q, a: LIVE_A, drift: 8, anchor: true, around: 2 });
// Long answers, all inside the live range (276-1415 px).
const PPLX_TALL_A = [1415, 1300, 1400, 1350, 1415, 1380, 1300, 1415, 1350, 1400, 1415, 1300];

// id, label, desc, site, n, start ('bottom' | 'top'), target (0-based), model
const FIXTURES = [
    // Perplexity, the live model.
    { id: 'J1', label: 'new', desc: 'Perplexity live model: top -> Q8 (the live failure: smooth glide cut short)',
      site: 'perplexity', n: 12, start: 'top', target: 7, model: LIVE_PPLX },
    { id: 'J2', label: 'new', desc: 'Perplexity live model: bottom -> Q5 (the owner\'s Q12 -> Q5)',
      site: 'perplexity', n: 12, start: 'bottom', target: 4, model: LIVE_PPLX },
    { id: 'J3', label: 'new', desc: 'Perplexity live model: top -> Q2, already mounted (was the fast path)',
      site: 'perplexity', n: 12, start: 'top', target: 1, model: LIVE_PPLX },
    { id: 'J4', label: 'new', desc: 'Perplexity live model: bottom -> Q11, mounted beside the latest entry',
      site: 'perplexity', n: 12, start: 'bottom', target: 10, model: LIVE_PPLX },
    { id: 'J5', label: 'guard', desc: 'Perplexity live model: bottom -> Q1',
      site: 'perplexity', n: 12, start: 'bottom', target: 0, model: LIVE_PPLX },
    // Perplexity, the verifier's models.
    { id: 'J6', label: 'new', desc: 'estimate 300 + anchor (seed 1): bottom -> Q5',
      site: 'perplexity', n: 16, start: 'bottom', target: 4,
      model: Object.assign(split(SEED1, 100), { reserve: 'estimate', estQ: 60, estA: 240, anchor: true }) },
    { id: 'J7', label: 'new', desc: 'estimate 300 + anchor (seed 1): top -> the latest entry (always mounted)',
      site: 'perplexity', n: 16, start: 'top', target: 15,
      model: Object.assign(split(SEED1, 100), { reserve: 'estimate', estQ: 60, estA: 240, anchor: true }) },
    { id: 'J8', label: 'new', desc: 'estimate 300, no anchoring (seed 2): bottom -> Q5',
      site: 'perplexity', n: 16, start: 'bottom', target: 4,
      model: Object.assign(split(SEED2, 100), { reserve: 'estimate', estQ: 60, estA: 240 }) },
    { id: 'J9', label: 'new', desc: 'estimate 600 + overscan 600 + anchor: top -> Q15',
      site: 'perplexity', n: 16, start: 'top', target: 14,
      model: Object.assign(split(R2, 60), { reserve: 'estimate', estQ: 60, estA: 540, overscan: 600, anchor: true }) },
    { id: 'J10', label: 'new', desc: 'exact heights, the window mounts 500 ms after a scroll: bottom -> Q5',
      site: 'perplexity', n: 16, start: 'bottom', target: 4,
      model: Object.assign(split(R2, 60), { mountDelay: 500 }) },
    { id: 'J11', label: 'new', desc: 'the pin re-asserts 300 ms after a wheel (live model heights): bottom -> Q5',
      site: 'perplexity', n: 12, start: 'bottom', target: 4,
      model: Object.assign({}, LIVE_PPLX, { pinMs: 300 }) },
    // Tall early entries put the first move's share estimate well above a late target, and the
    // latest entry (always mounted, far below) is then nearer BY NUMBER than anything in view:
    // a step from it goes up, away from the target, until the move cap.
    { id: 'J12', label: 'new', desc: 'the always-mounted latest entry is no stand-in for the view: top -> Q15',
      site: 'perplexity', n: 16, start: 'top', target: 14,
      model: split([2500, 2500, 2500, 2500, 2500, 2500, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300], 60) },
    // The view inside the target's own long answer, whose question slot is EMPTY (live, Chrome,
    // 2026-10-24: an answer mounted with its question slot empty). Nothing near the view carries
    // a question, and no wait changes that: the jump must step from the nearest mounted entry.
    { id: 'J13', label: 'new', desc: 'question slots above the view stay empty, answers ~1400 px: bottom -> Q4',
      site: 'perplexity', n: 12, start: 'bottom', target: 3,
      model: Object.assign({}, LIVE_PPLX, { a: PPLX_TALL_A, qLag: true }) },
    // A question bubble taller than 0.8 x the scroller lands with its top at the top ('start'),
    // not centred (ixLandOn's contract, which part A's answer landing relies on). [guard]: v12.14
    // passes it (err -10 px: its glide toward centre stopped near the start position; chromium,
    // 1 run), and a landing that always centres fails it (err -40 px).
    { id: 'J14', label: 'guard', desc: 'a question bubble taller than 0.8 x the view lands at its start: bottom -> Q5',
      site: 'perplexity', n: 12, start: 'bottom', target: 4,
      model: Object.assign({}, LIVE_PPLX, { q: LIVE_Q.map((h, i) => i === 4 ? 560 : h), bubble: LIVE_Q.map((h, i) => i === 4 ? 520 : 0) }) },
    // ChatGPT.
    { id: 'K1', label: 'new', desc: 'ChatGPT live model: older turns prepended with no reserved height, bottom -> Q7',
      site: 'chatgpt', n: 24, start: 'bottom', target: 6,
      model: { h: GPT_H24, loaded: 5, batch: 3, prependDelay: 80, prependWithin: 'window', minTurns: 5 } },
    { id: 'K2', label: 'new', desc: 'ChatGPT grow 150 px after 200 ms + anchor: bottom -> Q14',
      site: 'chatgpt', n: 20, start: 'bottom', target: 13,
      model: { h: GPT_C9, grow: { ms: 200, add: 150 }, anchor: true, minTurns: 6 } },
    { id: 'K3', label: 'guard', desc: 'ChatGPT live model: bottom -> Q1',
      site: 'chatgpt', n: 24, start: 'bottom', target: 0,
      model: { h: GPT_H24, loaded: 5, batch: 3, prependDelay: 80, prependWithin: 'window', minTurns: 5 } },
    // No scroll container (a thread under 1.5 screens): the plain fast path, as in v12.14.
    { id: 'K4', label: 'guard', desc: 'a 3-turn ChatGPT thread (no scroll container): the mounted Q2 lands',
      site: 'chatgpt', n: 3, start: 'bottom', target: 1, model: null },
];

(async () => {
    const argv = process.argv;
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = argv.includes('--quiet');
    const trace = argv.includes('--trace');     // print every scrollTop write after the click
    const only = argv.indexOf('--only') !== -1 ? argv[argv.indexOf('--only') + 1].split(',') : null;
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    let failures = 0;
    function check(id, desc, ok, detail) {
        if (ok) { if (!quiet) console.log('  PASS  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
        else { failures++; console.log('  FAIL  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
    }

    async function run(fx) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        const errors = [], logs = [];
        page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
        page.on('console', (m) => logs.push(m.text()));
        let url, api, mockConfig, key = null;
        if (fx.site === 'perplexity') {
            const E = pplxEntries(fx.n);
            mockConfig = { entries: E.map((e) => ({ text: e.query_str })), jumpModel: fx.model || undefined };
            url = 'https://www.perplexity.ai/search/' + PPLX_CONV;
            api = (u) => u.indexOf('/rest/thread/' + PPLX_CONV) !== -1 ? { status: 200, body: JSON.stringify(pplxPage(E, u)) } : null;
        } else {
            const T = gptTurns(fx.n);
            key = T[fx.target].id;
            mockConfig = { turns: T, jumpModel: fx.model || undefined };
            url = 'https://chatgpt.com/c/' + GPT_CONV;
            api = (u) => {
                if (u.endsWith('/api/auth/session')) return { status: 200, body: JSON.stringify({ accessToken: 'tok', expires: '2099-01-01T00:00:00.000Z' }) };
                if (u.indexOf('/backend-api/conversation/' + GPT_CONV) !== -1) return { status: 200, body: JSON.stringify(gptMapping(T)) };
                return null;
            };
        }
        const html = buildPage(fx.site, raw, mockConfig);
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u === url) { route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return; }
            const a = /\/(api|backend-api|rest)\//.test(u) ? api(u) : null;
            if (a) { route.fulfill({ status: a.status, contentType: 'application/json', body: a.body }).catch(() => {}); return; }
            route.abort().catch(() => {});
        });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        await page.evaluate("document.getElementById('acn-dot-nav').click()");
        try {
            await page.waitForFunction(`(function () { var s = document.querySelector('[data-acn-role="nav-stat"]');
                return s && s.getAttribute('data-acn-count') === '${fx.n}'; }())`, null, { timeout: 20000 });
        } catch (e) { /* the old build or a degraded index: the measurement reports it */ }
        await page.waitForTimeout(400);
        if (fx.start === 'top') {
            // As a user would: a wheel (it releases Perplexity's pin), then the scroll. Twice,
            // since a scroll can mount entries that move what "the top" holds.
            for (let k = 0; k < 2; k++) {
                await page.evaluate(() => window.__mockWindow.userScrollTo('top'));
                await page.waitForTimeout(400);
            }
        }
        if (trace) {
            // Every scrollTop write after the click, with the window at that moment.
            await page.evaluate(() => {
                const sc = document.getElementById('mock-scroller');
                const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
                const t0 = performance.now();
                window.__trace = [];
                Object.defineProperty(sc, 'scrollTop', { configurable: true,
                    get: function () { return d.get.call(this); },
                    set: function (v) {
                        window.__trace.push(Math.round(performance.now() - t0) + 'ms ' + Math.round(d.get.call(this)) + '->' +
                                            Math.round(v) + ' [' + window.__mockWindow.mounted().join(',') + ']');
                        d.set.call(this, v);
                    } });
            });
        }
        const t0 = Date.now();
        const clicked = await page.evaluate((i) => {
            const row = document.querySelectorAll('[data-acn-role="nav-item"]')[i];
            document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
            if (row) row.click();
            return !!row;
        }, fx.target);
        if (clicked) {
            try {
                await page.waitForFunction(() => document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') !== null ||
                                                  !!document.getElementById('acn-toast'), null, { timeout: 15000 });
            } catch (e) {}
            // Then until the view has been still for 800 ms (cap 8 s).
            let last = null, still = 0;
            for (let k = 0; k < 160 && still < 16; k++) {
                const st = await page.evaluate(() => document.getElementById('mock-scroller').scrollTop);
                if (st === last) still++; else { still = 0; last = st; }
                await page.waitForTimeout(50);
            }
        }
        const m = await page.evaluate(MEASURE + '(' + JSON.stringify({ site: fx.site, target: fx.target, key }) + ')');
        m.ms = Date.now() - t0;
        m.clicked = clicked;
        m.errors = errors;
        m.capLines = logs.filter((l) => /^\[ACN\] jump: alignment cap/.test(l));
        if (trace) console.log('    trace ' + fx.id + ':\n      ' + (await page.evaluate(() => window.__trace)).join('\n      '));
        await context.close();
        return m;
    }

    console.log('check-ix-jumps — engine=' + engine + ', script=' + path.basename(scriptPath));
    let pageErrors = [];
    for (const fx of FIXTURES) {
        if (only && only.indexOf(fx.id) === -1) continue;
        let m;
        try { m = await run(fx); } catch (e) { m = { crashed: String(e).slice(0, 200), errors: [] }; }
        pageErrors = pageErrors.concat(m.errors || []);
        // A landing that converges never hits the alignment cap; one that does spends every
        // write and logs the cap line (the live observability channel) on each jump.
        const ok = !m.crashed && m.clicked && m.resolved === String(fx.target) && !m.toast &&
                   m.mounted && m.inView && Math.abs(m.err) <= 24 && m.capLines.length === 0;
        const detail = m.crashed ? 'crashed: ' + m.crashed
            : 'resolved=' + m.resolved + ' toast=' + (m.toast ? 'yes' : 'no') + ' mounted=' + m.mounted +
              ' inView=' + m.inView + ' err=' + m.err + 'px scrollTop=' + m.scrollTop + '/' + m.max +
              ' window=[' + m.window + '] ' + m.ms + 'ms' + (m.capLines.length ? ' CAP: ' + m.capLines[0] : '');
        check(fx.id, '[' + fx.label + '] ' + fx.desc, ok, detail);
    }
    check('E', 'no page errors in any fixture', pageErrors.length === 0, pageErrors.slice(0, 2).join(' / '));
    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
