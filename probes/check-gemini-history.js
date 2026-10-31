// Checks for Gemini's history note (v12.16 part C, DEC-057): Navigate says when a chat's older
// history is not loaded yet, and stops saying it once the chat's start is known to be loaded.
//
// Run: node probes/check-gemini-history.js [--browser chromium|firefox|webkit|all] [--quiet] [--only H1,H8]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-gemini-history.js
// Exits non-zero on any failed or INVALID check.
//
// WHAT IS GATED. Gemini shows a chat's latest turns and loads older ones ten at a time when the
// scroller reaches the top, keeping every turn it loaded (measured live, Chrome + Tampermonkey,
// 2026-10-31: a 32-question chat loads 10 -> 20 -> 30 -> 32). Navigate's list is therefore the
// latest part of the chat until the history is loaded, and before v12.16 it said nothing about
// that. v12.16 shows a note ([data-acn-history="partial"]) while the start is not known to be
// loaded; the start counts as loaded when the first page held fewer than 10 turns, when turns
// arrived above the first one by fewer than 10, or when the view sat at the top for 8 s with
// nothing loading. The state is keyed by the path, so an SPA switch starts it again.
//
// THE MOCK: tests/mock-pages/gemini-history.html (its header lists what is and is not modelled),
// served on the real origin (https://gemini.google.com/app/<id>) with the userscript inlined.
// History loads take loadDelayMs (2000) after the view reaches the top; every wait here is on an
// ORDER of events (the mock's load count, Navigate's drawn count, the view being still with no
// load pending), never on a millisecond window, except H4's, which is the 8 s rule itself.
//
// CONTEXT of these results: Playwright, page realm, headless, viewport 1280x720, the userscript
// inlined into the page; no real userscript manager and no real Gemini. Real-browser behaviour is
// the owner's acceptance.
//
// Proof rule: run the old build (v12.15) against this file too — every check marked [new] must
// FAIL there (on chromium; other engines are reported as measured). [guard] passes on both.
// A precondition that fails (the page hidden, the mock's first page not as expected) prints
// INVALID: it says the harness, not the build, is wrong.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

// Chat ids (16 hex, as Gemini's /app/<id>) and their turn counts.
const C32 = 'aa32aa32aa32aa32', C20 = 'dd20dd20dd20dd20', C10 = 'bb10bb10bb10bb10', C6 = 'cc06cc06cc06cc06';
const CHATS = { [C32]: 32, [C20]: 20, [C10]: 10, [C6]: 6 };
const PAGE = 10;
const LOAD_DELAY = 2000;

function buildPage(scriptContent, mockConfig) {
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages/gemini-history.html'), 'utf8');
    const body = (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock;
    const head = (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '';
    return `<!DOCTYPE html><html><head>${head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(mockConfig)};</script>
${body}
<script>
delete window._aiNavAlreadyLoaded;
var _s = {};
window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
window.GM_setValue = function (k, v) { _s[k] = v; };
</script>
<script>${scriptContent}</script></body></html>`;
}

// Where turn n's question bubble is, relative to the scroller's view.
const BUBBLE = `(function (n) {
    var sc = document.querySelector('infinite-scroller.chat-history');
    var t = document.getElementById(window.__mockGemini.turnId(n));
    var b = t && t.querySelector('div.query-text');
    var r = sc.getBoundingClientRect();
    var out = { n: n, mounted: !!b, inView: false, scrollTop: Math.round(sc.scrollTop),
                max: sc.scrollHeight - sc.clientHeight, loaded: window.__mockGemini.loaded(),
                loads: window.__mockGemini.loads(),
                toast: (document.getElementById('acn-toast') || {}).textContent || null };
    if (b) {
        var q = b.getBoundingClientRect();
        out.top = Math.round(q.top - r.top); out.bottom = Math.round(q.bottom - r.top);
        out.inView = q.top >= r.top - 1 && q.bottom <= r.bottom + 1;
    }
    return out;
})`;

const NAV = `(function () {
    var s = document.querySelector('[data-acn-role="nav-stat"]');
    var p = document.getElementById('acn-panel-nav');
    return { open: !!(p && p.classList.contains('acn-open')),
             count: s ? s.getAttribute('data-acn-count') : null,
             note: !!document.querySelector('[data-acn-history="partial"]'),
             items: Array.prototype.map.call(document.querySelectorAll('[data-acn-role="nav-item-text"]'),
                                             function (e) { return e.textContent; }),
             loaded: window.__mockGemini.loaded() };
})()`;

async function runEngine(engine, raw, only, quiet) {
    const t0 = Date.now();
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    let failures = 0, invalid = 0;
    const pageErrors = [];
    const want = (id) => !only || only.indexOf(id) !== -1;
    function check(id, desc, ok, detail) {
        if (ok) { if (!quiet) console.log('  PASS  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
        else { failures++; console.log('  FAIL  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
    }
    function bad(id, why) { invalid++; console.log('  INVALID  ' + id + ' ' + why); }

    // A fresh page on chat `chat`, its first page rendered, Navigate open. Null when a
    // precondition fails (reported INVALID under `id`).
    async function open(id, chat, cfgExtra) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => pageErrors.push(id + ': ' + String(e && e.message || e)));
        const url = 'https://gemini.google.com/app/' + chat;
        const html = buildPage(raw, Object.assign({ chats: CHATS, page: PAGE, loadDelayMs: LOAD_DELAY, anchor: true }, cfgExtra || {}));
        await page.route('**/*', (route) => {
            if (route.request().url() === url) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }).catch(() => {});
                return;
            }
            route.abort().catch(() => {});
        });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        const first = Math.min(PAGE, CHATS[chat]);
        try {
            await page.waitForFunction('window.__mockGemini && window.__mockGemini.loaded() === ' + first, null, { timeout: 15000 });
            await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        } catch (e) {}
        const pre = await page.evaluate(() => ({ vis: document.visibilityState,
            loaded: window.__mockGemini ? window.__mockGemini.loaded() : -1,
            dot: !!document.getElementById('acn-dot-nav'),
            st: document.querySelector('infinite-scroller.chat-history').scrollTop }));
        if (pre.vis !== 'visible' || pre.loaded !== first || !pre.dot || pre.st <= 50) {
            bad(id, 'precondition: visibility=' + pre.vis + ' loaded=' + pre.loaded + ' (want ' + first + ') dot=' + pre.dot +
                    ' scrollTop=' + pre.st);
            await context.close();
            return null;
        }
        const h = { page, context };
        h.nav = () => page.evaluate(NAV);
        h.openNav = async () => {
            if (!(await h.nav()).open) await page.evaluate("document.getElementById('acn-dot-nav').click()");
        };
        // Navigate's drawn count reaches `n` (the scan that drew it ran the history observer first).
        h.waitCount = async (n, ms) => {
            try {
                await page.waitForFunction(`(function () { var s = document.querySelector('[data-acn-role="nav-stat"]');
                    return s && s.getAttribute('data-acn-count') === '${n}'; }())`, null, { timeout: ms || 10000 });
            } catch (e) {}
            return h.nav();
        };
        // The view still for 800 ms with no history load pending (cap 20 s).
        h.waitStill = async () => {
            let last = null, still = 0;
            for (let k = 0; k < 400 && still < 16; k++) {
                const s = await page.evaluate(() => ({ st: document.querySelector('infinite-scroller.chat-history').scrollTop,
                                                       p: window.__mockGemini.pending() }));
                if (s.st === last && !s.p) still++; else { still = 0; last = s.st; }
                await page.waitForTimeout(50);
            }
            return still >= 16;
        };
        h.click = (i) => page.evaluate((i) => {
            const row = document.querySelectorAll('[data-acn-role="nav-item"]')[i];
            if (row) row.click();
            return !!row;
        }, i);
        h.bubble = (n) => page.evaluate(BUBBLE + '(' + n + ')');
        h.close = () => context.close();
        return h;
    }

    const fmtNav = (v) => 'count=' + v.count + ' note=' + v.note + ' loaded=' + v.loaded;

    // ── H1, H2, H3, H6: the 32-turn chat, loaded by scrolling to the top, then an SPA switch ──
    if (want('H1') || want('H2') || want('H3') || want('H6')) {
        const h = await open('H1', C32);
        if (h) {
            await h.openNav();
            const v0 = await h.waitCount(10);
            check('H1', '[guard] a 32-turn chat at load: Navigate lists the 10 loaded questions', v0.count === '10', fmtNav(v0));
            check('H2', '[new] the same: the "older messages not loaded" note is shown', v0.note, fmtNav(v0));
            // Load every page as a user would: scroll to the top, wait for the load, repeat.
            const samples = [];
            for (let k = 0; k < 6; k++) {
                const L = (await h.nav()).loaded;
                if (L >= 32) break;
                await h.page.evaluate(() => window.__mockGemini.userScroll('top'));
                try { await h.page.waitForFunction('window.__mockGemini.loaded() > ' + L, null, { timeout: LOAD_DELAY + 8000 }); }
                catch (e) { break; }
                const L2 = (await h.nav()).loaded;
                const v = await h.waitCount(L2);
                samples.push(v);
            }
            const last = samples[samples.length - 1] || v0;
            const ordered = last.items.length === 32 && last.items.every((t, i) => t.indexOf('Gemini question ' + (i + 1) + ':') === 0);
            const mid = samples.filter((s) => s.loaded < 32);
            check('H3', '[new] loaded by scroll-to-top cycles: the note stays while older turns remain, ' +
                  'and goes when the last load adds 2 (< 10); Navigate lists all 32 in order',
                  last.count === '32' && ordered && mid.length === 2 && mid.every((s) => s.note) && !last.note,
                  'cycles=[' + samples.map((s) => s.loaded + ':' + s.count + (s.note ? '+note' : '')).join(' ') + '] ordered=' + ordered +
                  ' item1="' + (last.items[0] || '').slice(0, 24) + '"');
            if (want('H6')) {
                await h.page.evaluate((id) => window.__mockGemini.switchTo(id), C20);
                try { await h.page.waitForFunction('window.__mockGemini.loaded() === 10', null, { timeout: 10000 }); } catch (e) {}
                // The pushState hook closes the panel and rescans: reopen once the panel is closed.
                try { await h.page.waitForFunction("!document.getElementById('acn-panel-nav').classList.contains('acn-open')", null, { timeout: 5000 }); } catch (e) {}
                await h.openNav();
                const v6 = await h.waitCount(10);
                check('H6', '[new] SPA switch from the fully loaded chat to a 20-turn chat: 10 listed and the note back',
                      v6.count === '10' && v6.note && v6.items[0] && v6.items[0].indexOf('Gemini question 11:') === 0,
                      fmtNav(v6) + ' before the switch: note=' + last.note + ' item1="' + (v6.items[0] || '').slice(0, 24) + '"');
            }
            await h.close();
        }
    }

    // ── H4: exactly 10 turns: the note until the view has sat at the top for 8 s ──
    if (want('H4')) {
        const h = await open('H4', C10);
        if (h) {
            await h.openNav();
            const v0 = await h.waitCount(10);
            const ts = Date.now();
            await h.page.evaluate(() => window.__mockGemini.userScroll('top'));
            let gone = null, v = null;
            while (Date.now() - ts < 13000) {
                v = await h.nav();
                if (!v.note) { gone = Date.now() - ts; break; }
                await h.page.waitForTimeout(100);
            }
            const loads = await h.page.evaluate(() => window.__mockGemini.loads());
            check('H4', '[new] a 10-turn chat: the note at load, gone after the view sat at the top > 8 s with nothing loading',
                  v0.count === '10' && v0.note && gone !== null && loads === 0,
                  'at load: ' + fmtNav(v0) + '; note gone after ' + (gone === null ? 'never (13 s)' : gone + ' ms') + ' at the top; loads=' + loads);
        }
        if (h) await h.close();
    }

    // ── H5, H7: a 6-turn chat, then four messages sent ──
    if (want('H5') || want('H7')) {
        const h = await open('H5', C6);
        if (h) {
            await h.openNav();
            const v0 = await h.waitCount(6);
            check('H5', '[guard] a 6-turn chat: no note at load', v0.count === '6' && !v0.note, fmtNav(v0));
            if (want('H7')) {
                for (let k = 0; k < 4; k++) {
                    await h.page.evaluate((k) => window.__mockGemini.send('A message sent now, number ' + (k + 1) + ' of four, asking about Kepler orbits?'), k);
                    await h.waitCount(7 + k);
                }
                const v = await h.nav();
                check('H7', '[guard] four messages sent in it (6 -> 10 turns): still no note', v.count === '10' && !v.note, fmtNav(v));
            }
            await h.close();
        }
    }

    // ── H6b: SPA switch the other way, from a complete 6-turn chat to the 32-turn chat ──
    // H6 alone cannot tell the path-keyed reset from the "fewer turns under a new first id is a
    // first page" rule: 32 -> 10 turns is judged a first page either way. 6 -> 10 is not: without
    // the reset it reads as 4 turns arriving above the first one, a short page, so "loaded".
    if (want('H6b')) {
        const h = await open('H6b', C6);
        if (h) {
            await h.openNav();
            const v0 = await h.waitCount(6);
            await h.page.evaluate((id) => window.__mockGemini.switchTo(id), C32);
            try { await h.page.waitForFunction('window.__mockGemini.loaded() === 10', null, { timeout: 10000 }); } catch (e) {}
            try { await h.page.waitForFunction("!document.getElementById('acn-panel-nav').classList.contains('acn-open')", null, { timeout: 5000 }); } catch (e) {}
            await h.openNav();
            const v = await h.waitCount(10);
            check('H6b', '[new] SPA switch from a complete 6-turn chat to the 32-turn chat: 10 listed and the note shown',
                  v0.count === '6' && !v0.note && v.count === '10' && v.note && v.items[0] && v.items[0].indexOf('Gemini question 23:') === 0,
                  'before: ' + fmtNav(v0) + '; after: ' + fmtNav(v) + ' item1="' + (v.items[0] || '').slice(0, 24) + '"');
            await h.close();
        }
    }

    // ── H8: from the bottom, Navigate's first item (Q23 of 32) with 10 loaded, 3 runs ──
    if (want('H8')) {
        const runs = [];
        for (let r = 0; r < 3; r++) {
            const h = await open('H8', C32);
            if (!h) continue;
            await h.openNav();
            const v0 = await h.waitCount(10);
            const clicked = v0.count === '10' && await h.click(0);
            const still = clicked && await h.waitStill();
            const b = await h.bubble(23);
            runs.push(Object.assign(b, { clicked, still }));
            await h.close();
        }
        const ok = runs.length === 3 && runs.every((b) => b.clicked && b.still && b.inView && !b.toast);
        check('H8', '[guard] from the bottom with 10 loaded, Navigate\'s first item (Q23): in view once still, no toast, 3 of 3',
              ok, runs.map((b) => (b.inView ? 'in' : 'OUT') + ' top=' + b.top + ' scrollTop=' + b.scrollTop + ' loaded=' + b.loaded +
                                   (b.toast ? ' TOAST' : '') + (b.still ? '' : ' NOT-STILL')).join(' | '));
    }

    // ── H9: every page loaded: Q1 from the bottom, Q32 from the top ──
    if (want('H9')) {
        const h = await open('H9', C32);
        if (h) {
            await h.page.evaluate(() => window.__mockGemini.loadAll());
            await h.openNav();
            const v0 = await h.waitCount(32);
            await h.page.evaluate(() => window.__mockGemini.userScroll('bottom'));
            await h.waitStill();
            const c1 = v0.count === '32' && await h.click(0);
            if (c1) await h.waitStill();
            const b1 = await h.bubble(1);
            await h.page.evaluate(() => window.__mockGemini.userScroll('top'));
            await h.waitStill();
            const c2 = v0.count === '32' && await h.click(31);
            if (c2) await h.waitStill();
            const b2 = await h.bubble(32);
            check('H9', '[guard] all 32 loaded: Q1 from the bottom and Q32 from the top land in view',
                  c1 && c2 && b1.inView && b2.inView && !b1.toast && !b2.toast,
                  fmtNav(v0) + '; Q1 ' + (b1.inView ? 'in' : 'OUT') + ' top=' + b1.top + ' scrollTop=' + b1.scrollTop +
                  '; Q32 ' + (b2.inView ? 'in' : 'OUT') + ' top=' + b2.top + ' scrollTop=' + b2.scrollTop + '/' + b2.max);
            await h.close();
        }
    }

    check('E', 'no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' / '));
    await browser.close();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log((failures || invalid
        ? failures + ' check(s) FAILED' + (invalid ? ', ' + invalid + ' INVALID' : '')
        : 'all checks passed') + ' (' + engine + ', ' + secs + ' s)');
    return failures + invalid;
}

(async () => {
    const argv = process.argv;
    const arg = (k) => argv.indexOf(k) !== -1 ? argv[argv.indexOf(k) + 1] : null;
    const which = arg('--browser') || 'chromium';
    const engines = which === 'all' ? ['chromium', 'firefox', 'webkit'] : [which];
    if (engines.some((e) => ['chromium', 'firefox', 'webkit'].indexOf(e) === -1)) {
        console.log('INVALID: --browser takes chromium, firefox, webkit or all');
        process.exit(1);
    }
    const quiet = argv.includes('--quiet');
    const only = arg('--only') ? arg('--only').split(',') : null;
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    let bad = 0;
    for (const engine of engines) {
        console.log('check-gemini-history — engine=' + engine + ', script=' + path.basename(scriptPath));
        bad += await runEngine(engine, raw, only, quiet);
    }
    process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
