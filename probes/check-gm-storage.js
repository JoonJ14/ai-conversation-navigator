// Checks for the GM storage wrapper (v12.12, PR B's B2): what the script stores must survive
// a reload when the manager offers only the ASYNC GM.getValue / GM.setValue, as Safari's
// Userscripts does, and the synchronous path must stay exactly as it was where it exists.
//
// Run: node probes/check-gm-storage.js [--browser firefox] [--quiet]
// Exits non-zero on any failed expectation. ACN_SCRIPT=<path> runs another build.
//
// THE BUG THIS GATES. Userscripts has no GM_getValue / GM_setValue at all (B0, measured on
// the owner's Safari, Userscripts 4.8.6: both typeof 'undefined'). Every call site was
// try/caught, so on Safari nothing was ever stored: a bookmark vanished on reload, and the
// language could not change, since it is re-read from storage on every use.
//
//   G1  async only: a bookmark survives a reload
//   G2  async only: a language change survives a reload
//   G3  both APIs present: the same two survive, through the SYNC functions, and the
//       async GM.getValue / GM.setValue are never called (the Tampermonkey path)
//   G4  async only, GM.getValue never answers: the UI still comes up, after the 2 s bound
//       and well before any longer one, the failure is logged once, and a bookmark made on
//       that page is kept in memory only, never written over what is stored (the owner's
//       call, 2026-10-23)
//   G5  async only, GM.setValue rejects: the failure is logged once, however many writes
//
// G1 also asserts the startup load asks for all six keys, since one left out of
// acnStoreLoad's list would reset its feature on every reload with no other check failing.
//
// The "reload" is a real one (page.reload) in the same browser context. Each stub keeps
// its values in the page's localStorage under its own prefix, so they outlive the page
// exactly as a manager's storage does.
//
// CONTEXT: Playwright <engine> on this machine, page realm, the script inlined into the
// virtualizing Claude mock, both storage APIs stubbed. Not any manager's real storage:
// that is owner acceptance on Safari + Userscripts and the two Tampermonkey browsers.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const CONV_UUID = '12121212-1212-4121-8121-121212121212';
const TARGET = 'https://claude.ai/chat/' + CONV_UUID;
const SIX_KEYS = ['acn-bookmarks-v1', 'acn-claude-org-v1', 'acn-commands', 'acn-settings',
                  'acn-zone-positions', 'acn_ctx_cache'];

// mode: 'async' | 'sync' | 'hang' | 'reject'
function buildPage(scriptContent, mode) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>gm storage checks</title></head><body>
<script>window.__MOCK_CONFIG = {"totalMessages":6};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var MODE = ${JSON.stringify(mode)};
    window.__gm = { get: 0, set: 0, syncGet: 0, syncSet: 0, keys: [] };
    function lsGet(prefix, k) {
        var t = localStorage.getItem(prefix + k);
        return t === null ? undefined : JSON.parse(t);
    }
    function lsSet(prefix, k, v) { localStorage.setItem(prefix + k, JSON.stringify(v)); }
    // Not under test: every API request gets a 500, so the index falls back to the DOM scan
    // and the usage panel reads "unavailable". Nothing here depends on either.
    window.GM_xmlhttpRequest = function (opts) {
        setTimeout(function () { if (opts.onload) opts.onload({ status: 500, responseText: '' }); }, 10);
    };
    if (MODE === 'sync') {
        window.GM_getValue = function (k, d) {
            window.__gm.syncGet++;
            var v = lsGet('__gmsync:', k);
            return v === undefined ? d : v;
        };
        window.GM_setValue = function (k, v) { window.__gm.syncSet++; lsSet('__gmsync:', k, v); };
    }
    window.GM = {
        getValue: function (k, d) {
            window.__gm.get++;
            window.__gm.keys.push(k);
            if (MODE === 'hang') return new Promise(function () {});
            var v = lsGet('__gmasync:', k);
            return Promise.resolve(v === undefined ? d : v);
        },
        setValue: function (k, v) {
            window.__gm.set++;
            if (MODE === 'reject') return Promise.reject(new Error('stub: write refused'));
            lsSet('__gmasync:', k, v);
            return Promise.resolve();
        }
    };
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

const READ = `(function () {
    var lbl = document.querySelector('#acn-dot-nav .acn-lbl');
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('__gm') === 0) keys.push(k);
    }
    return {
        cluster: !!document.getElementById('acn-dot-nav'),
        navLabel: lbl ? lbl.textContent : null,
        icons: document.querySelectorAll('[data-acn-bookmark]').length,
        active: document.querySelectorAll('.acn-bm-icon.acn-bm-active').length,
        gm: window.__gm,
        stored: keys.sort()
    };
}())`;

(async () => {
    const engine = (process.argv.indexOf('--browser') !== -1
        ? process.argv[process.argv.indexOf('--browser') + 1] : 'chromium');
    const quiet = process.argv.includes('--quiet');
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8');

    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });

    let failures = 0;
    function check(id, desc, ok, detail) {
        if (ok) { if (!quiet) console.log('  PASS  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
        else { failures++; console.log('  FAIL  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
    }

    async function waitCluster(page) {
        await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
    }

    // Bookmarks the first mounted message through its own icon, as a user does.
    async function bookmarkFirst(page) {
        await page.waitForFunction("document.querySelectorAll('[data-acn-bookmark]').length > 0", null, { timeout: 30000 });
        await page.evaluate("document.querySelector('[data-acn-bookmark]').click()");
    }

    // Opens Settings and picks Korean, as a user does. Returns the Navigate label it shows.
    async function chooseKorean(page) {
        await page.evaluate("document.getElementById('acn-dot-settings').click()");
        await page.waitForFunction("!!document.getElementById('acn-lang-sel')", null, { timeout: 30000 });
        await page.evaluate(`(function () {
            var sel = document.getElementById('acn-lang-sel');
            sel.value = 'ko';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }())`);
        await page.waitForTimeout(300);
        return (await page.evaluate(READ)).navLabel;
    }

    // Loads, bookmarks, picks Korean, reloads, and waits for the bookmark to show again.
    async function reloadScenario(mode, englishLabel) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const html = buildPage(raw, mode);
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u === TARGET || u === TARGET + '/') {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        await bookmarkFirst(page);
        const koLabel = await chooseKorean(page);
        const before = await page.evaluate(READ);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        // The icons are re-injected by a scan; wait for them, then for the active one.
        await page.waitForFunction("document.querySelectorAll('[data-acn-bookmark]').length > 0", null, { timeout: 30000 });
        await page.waitForFunction("document.querySelectorAll('.acn-bm-icon.acn-bm-active').length > 0", null, { timeout: 8000 })
            .catch(() => {});
        const after = await page.evaluate(READ);
        await context.close();
        return { koLabel, before, after, englishLabel };
    }

    console.log('check-gm-storage — engine=' + engine + ', script=' + path.basename(scriptPath));

    // The English Navigate label, read from a page left in English, so G2 can tell a Korean
    // label from an unchanged one without hardcoding either string.
    const english = await (async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const html = buildPage(raw, 'sync');
        await page.route('**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
        await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        const r = await page.evaluate(READ);
        await context.close();
        return r.navLabel;
    })();

    const a = await reloadScenario('async', english);
    const loadedKeys = Array.from(new Set(a.after.gm.keys)).sort();
    check('G1', 'async only: a bookmark survives a reload; the load asks for all six keys',
        a.before.active > 0 && a.after.active > 0 && a.after.stored.indexOf('__gmasync:acn-bookmarks-v1') !== -1 &&
        JSON.stringify(loadedKeys) === JSON.stringify(SIX_KEYS),
        'active before=' + a.before.active + ' after=' + a.after.active + ' icons after=' + a.after.icons +
        ' stored=' + JSON.stringify(a.after.stored) + ' keys loaded=' + JSON.stringify(loadedKeys));
    check('G2', 'async only: a language change survives a reload',
        !!english && a.koLabel !== english && a.after.navLabel === a.koLabel,
        'english=' + JSON.stringify(english) + ' chosen=' + JSON.stringify(a.koLabel) +
        ' after reload=' + JSON.stringify(a.after.navLabel));

    const s = await reloadScenario('sync', english);
    const asyncCalls = s.before.gm.get + s.before.gm.set + s.after.gm.get + s.after.gm.set;
    check('G3', 'both APIs present: both survive through the sync functions; GM.* never called',
        s.after.active > 0 && s.after.navLabel === s.koLabel && s.koLabel !== english &&
        asyncCalls === 0 && s.before.gm.syncSet > 0 &&
        s.after.stored.every((k) => k.indexOf('__gmsync:') === 0),
        'active after=' + s.after.active + ' label after=' + JSON.stringify(s.after.navLabel) +
        ' GM.* calls=' + asyncCalls + ' sync sets=' + s.before.gm.syncSet + ' stored=' + JSON.stringify(s.after.stored));

    const h = await (async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const logs = [];
        page.on('console', (m) => logs.push(m.text()));
        const html = buildPage(raw, 'hang');
        await page.route('**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
        const t0 = Date.now();
        await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        const upMs = Date.now() - t0;
        await bookmarkFirst(page);
        await page.waitForTimeout(500);
        const r = await page.evaluate(READ);
        await context.close();
        return { r, upMs, storageLines: logs.filter((l) => l.indexOf('[ACN] storage:') === 0) };
    })();
    // upMs runs from navigation to the cluster, so it includes the page load: at least the 2 s
    // bound, and far below a bound raised to 10 s or more.
    check('G4', 'GM.getValue never answers: UI comes up after the 2 s bound, logged once, a bookmark stays in memory only',
        h.r.cluster && h.upMs >= 1900 && h.upMs < 8000 &&
        h.storageLines.length === 1 && h.r.active > 0 && h.r.gm.set === 0 && h.r.stored.length === 0,
        'up after ' + h.upMs + 'ms, storage lines=' + JSON.stringify(h.storageLines) + ' active=' + h.r.active +
        ' GM.setValue calls=' + h.r.gm.set + ' stored=' + JSON.stringify(h.r.stored));

    const j = await (async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const logs = [];
        const errors = [];
        page.on('console', (m) => logs.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
        const html = buildPage(raw, 'reject');
        await page.route('**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
        await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        await bookmarkFirst(page);
        await chooseKorean(page);
        await page.waitForTimeout(500);
        const r = await page.evaluate(READ);
        await context.close();
        return { r, errors, failLines: logs.filter((l) => l.indexOf('[ACN] storage: GM.setValue failed') === 0) };
    })();
    check('G5', 'GM.setValue rejects: logged once across several writes, no page error',
        j.r.gm.set >= 2 && j.failLines.length === 1 && j.errors.length === 0,
        'GM.setValue calls=' + j.r.gm.set + ' failure lines=' + j.failLines.length + ' page errors=' + JSON.stringify(j.errors.slice(0, 2)));

    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})();
