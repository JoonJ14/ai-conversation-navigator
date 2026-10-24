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
//   G6  async only, two writes of one key finish OUT OF ORDER (the stub finishes a key's
//       first write last): the newer value is what survives the reload
//
// The cross-tab PR (v12.13, DEC-050). The owner's Safari two-tab test on v12.12 lost tab A's
// bookmark: both tabs loaded, A bookmarked, B bookmarked in another conversation, and B's save
// wrote B's startup copy of the whole store back. A "tab" here is a second page in the same
// browser context, so both read and write the one stubbed storage. [new] fails on v12.12;
// [guard] passes on both builds.
//   G7  [new] async only, the owner's two-tab test: A's bookmark survives B's save
//   G8  [new] async only, the stored bookmarks are unreadable: a click saves nothing over
//       them, warns once (a console line and a toast), and the flag does not turn on
//   G9  [new] the same, through the synchronous functions (the Tampermonkey path)
//   G10 [guard] the two-tab test through the synchronous functions: both bookmarks kept
//   G11 [new] async only: a zone position another tab saved, for another platform, survives
//       this tab's drag
//   G12 [new] async only: a command another tab saved survives this tab running one
//   G13 [guard] async only, reads after the startup load answer late and unevenly (500 ms, then
//       50 ms): two quick bookmarks in one tab both survive. The queue's own check: v12.12 has
//       no re-read, so it passes there; a build whose save steps can overlap fails it
// Added in review (Codex Tier 3 round 1, and an adversarial review):
//   G14 [new] async only: another tab's context-cache entry, for another conversation,
//       survives this tab's write from a real SSE message_delta through the fetch proxy
//   G15 [new] async only: this tab and another both create /deploy: both kept, names unique
//   G16 [new] async only, the stored commands are unreadable: creating one shows "Not saved"
//       in the form and writes nothing
//   G17 [new] async only, deletions: B removes its own bookmark after A bookmarked; A's survives
//   G18 [new] async only, deletions: B removes a bookmark A's page still holds, then A saves; the
//       removed one does not come back
//   G19 [guard] async only, nothing stored yet: the first command is stored once
//   G20 [guard] async only, the first bookmark write is rejected: that bookmark goes out with
//       the next save
//   G21 [guard] async only, the first bookmark write never answers: after the 5 s bound the next
//       save carries it
//   G22 [new] the same run: the stall is logged once
// Added in review (Codex Tier 3, round 2):
//   G23 [guard] async only, the first bookmark write is refused 300 ms late, and a second
//       bookmark is made while it is pending: both are stored without a third save
//   G24 [guard] async only, Clear all removes exactly the records the panel shows, after a
//       write brought another tab's bookmark into this page
//   G25 [new] async only, the open /Commands list shows the name a write stored (deploy-2)
// Added in review (Codex Tier 3, round 3):
//   G26 [new] async only, this conversation's stored entry is null: nothing saved over it
//   G27 [guard] async only, a command named 'constructor' keeps its name (no prototype lookup)
// The guards pass on v12.12, which writes the whole copy each time; the review's pre-fix build
// (698e27f) fails G19, G20 and G21.
// Not gated, and not reachable from the UI: a conversation whose stored entry holds something
// other than a list. Icon injection already fails on such an entry, on v12.12 too, so no click
// reaches the save; _bmUpdateStore refuses it anyway.
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
// The second tab's conversation, as in the owner's test: a different one.
const TARGET_B = 'https://claude.ai/chat/13131313-1313-4131-8131-131313131313';
const SIX_KEYS = ['acn-bookmarks-v1', 'acn-claude-org-v1', 'acn-commands', 'acn-settings',
                  'acn-zone-positions', 'acn_ctx_cache'];

// mode: 'async' | 'sync' | 'hang' | 'reject' | 'reorder' | 'slowread' | 'rejectonce' | 'hangonce' | 'rejectslow'
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
    window.__gm = { get: 0, set: 0, syncGet: 0, syncSet: 0, keys: [], seen: {}, firstGetAt: 0, upAt: 0 };
    // When the cluster is inserted, timed in the page, so G4 measures the storage bound itself
    // and not the page load around it.
    new MutationObserver(function () {
        if (!window.__gm.upAt && document.getElementById('acn-dot-nav')) window.__gm.upAt = performance.now();
    }).observe(document.documentElement, { childList: true, subtree: true });
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
            if (!window.__gm.firstGetAt) window.__gm.firstGetAt = performance.now();
            if (MODE === 'hang') return new Promise(function () {});
            // 'slowread': the startup load (the first six reads) answers at once. After it, the
            // first read answers 500 ms late and every later one 50 ms late, each with the value
            // as it was WHEN CALLED, the worst case. A read taken at answer time would line two
            // overlapping saves up by itself; uneven delays let a later save finish first.
            if (MODE === 'slowread' && window.__gm.get > 6) {
                var w = lsGet('__gmasync:', k);
                var delay = window.__gm.get === 7 ? 500 : 50;
                return new Promise(function (res) {
                    setTimeout(function () { res(w === undefined ? d : w); }, delay);
                });
            }
            var v = lsGet('__gmasync:', k);
            return Promise.resolve(v === undefined ? d : v);
        },
        setValue: function (k, v) {
            window.__gm.set++;
            if (MODE === 'reject') return Promise.reject(new Error('stub: write refused'));
            // 'rejectonce' / 'hangonce': the first bookmark write is refused, or never answered
            // (and never applied); every other write goes through.
            if ((MODE === 'rejectonce' || MODE === 'hangonce' || MODE === 'rejectslow') &&
                k === 'acn-bookmarks-v1' && !window.__gm.bmOnce) {
                window.__gm.bmOnce = true;
                if (MODE === 'rejectslow') {
                    return new Promise(function (res, rej) {
                        setTimeout(function () { rej(new Error('stub: write refused late')); }, 300);
                    });
                }
                return MODE === 'rejectonce' ? Promise.reject(new Error('stub: write refused once'))
                                             : new Promise(function () {});
            }
            // 'reorder': a key's first write is applied and answered 400 ms late, so a second
            // write made meanwhile lands first and the older value lands last.
            if (MODE === 'reorder' && !window.__gm.seen[k]) {
                window.__gm.seen[k] = true;
                return new Promise(function (res) {
                    setTimeout(function () { lsSet('__gmasync:', k, v); res(); }, 400);
                });
            }
            window.__gm.seen[k] = true;
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
    // Timed in the page, from the first GM.getValue (the load starting) to the cluster's
    // insertion: the 2 s bound itself, whatever the page load around it costs.
    const boundMs = h.r.gm.upAt && h.r.gm.firstGetAt ? Math.round(h.r.gm.upAt - h.r.gm.firstGetAt) : null;
    check('G4', 'GM.getValue never answers: UI comes up at the 2 s bound, logged once, a bookmark stays in memory only',
        h.r.cluster && boundMs !== null && boundMs >= 2000 && boundMs < 4000 &&
        h.storageLines.length === 1 && h.r.active > 0 && h.r.gm.set === 0 && h.r.stored.length === 0,
        'load to cluster ' + boundMs + 'ms (navigation to cluster ' + h.upMs + 'ms), storage lines=' + JSON.stringify(h.storageLines) + ' active=' + h.r.active +
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

    // G6 — Korean, then English straight away: two writes of acn-settings, the first of which
    // the stub finishes last. Without the rewrite, Korean (the older value) is what stays stored.
    const o = await (async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const html = buildPage(raw, 'reorder');
        await page.route('**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
        await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        const koLabel = await chooseKorean(page);
        await page.evaluate(`(function () {
            var sel = document.getElementById('acn-lang-sel');
            sel.value = 'en';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }())`);
        await page.waitForTimeout(1200);   // past the late first write and any rewrite after it
        const before = await page.evaluate(READ);
        const stored = await page.evaluate("localStorage.getItem('__gmasync:acn-settings')");
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        await page.waitForTimeout(300);
        const after = await page.evaluate(READ);
        await context.close();
        return { koLabel, before, after, stored };
    })();
    check('G6', 'two writes of one key land out of order: the newer value survives the reload',
        !!english && o.koLabel !== english && o.before.gm.set >= 3 && o.after.navLabel === english,
        'chosen ko=' + JSON.stringify(o.koLabel) + ' GM.setValue calls=' + o.before.gm.set +
        ' stored=' + o.stored + ' label after reload=' + JSON.stringify(o.after.navLabel));

    // ── The cross-tab PR (v12.13, DEC-050) ────────────────────────────────────────────

    // A page on `url` in `context`, with the manager stubbed in `mode`, once its cluster is up.
    async function openTab(context, url, mode, logs) {
        const page = await context.newPage();
        if (logs) page.on('console', (m) => logs.push(m.text()));
        const html = buildPage(raw, mode);
        await page.route('**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        return page;
    }
    async function reloadTab(page) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
    }
    // Sets what the stubbed manager holds under `key`, as another tab's save would.
    async function setHeld(page, prefix, key, held) {
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [prefix + key, JSON.stringify(held)]);
    }
    // What the stubbed manager holds under `key`, or undefined.
    async function getHeld(page, prefix, key) {
        const t = await page.evaluate((k) => localStorage.getItem(k), prefix + key);
        return t === null ? undefined : JSON.parse(t);
    }
    // The async path holds JSON text of each value (DEC-049); the sync stub holds the value.
    const held = (mode, value) => (mode === 'sync' ? value : JSON.stringify(value));
    const unheld = (mode, h) => (h === undefined ? undefined : (mode === 'sync' ? h : JSON.parse(h)));
    async function bookmarkStore(page, mode) {
        const raw = unheld(mode, await getHeld(page, mode === 'sync' ? '__gmsync:' : '__gmasync:', 'acn-bookmarks-v1'));
        return raw === undefined ? null : JSON.parse(raw);
    }
    const urlsWithBookmarks = (store) => (store ? Object.keys(store).filter((u) =>
        store[u] && Array.isArray(store[u].bookmarks) && store[u].bookmarks.length > 0) : []);

    // G7 / G10 — the owner's two-tab test: both tabs load first, A bookmarks, B bookmarks in
    // another conversation, A reloads.
    async function twoTabs(mode) {
        const context = await browser.newContext();
        const a = await openTab(context, TARGET, mode);
        const b = await openTab(context, TARGET_B, mode);
        await bookmarkFirst(a);
        await a.waitForTimeout(500);
        await bookmarkFirst(b);
        await b.waitForTimeout(500);
        await reloadTab(a);
        await a.waitForFunction("document.querySelectorAll('[data-acn-bookmark]').length > 0", null, { timeout: 30000 });
        await a.waitForFunction("document.querySelectorAll('.acn-bm-icon.acn-bm-active').length > 0", null, { timeout: 8000 })
            .catch(() => {});
        const r = await a.evaluate(READ);
        const urls = urlsWithBookmarks(await bookmarkStore(a, mode));
        await context.close();
        return { activeA: r.active, urls };
    }
    const twoTabsOk = (t) => t.activeA > 0 && t.urls.indexOf(TARGET) !== -1 && t.urls.indexOf(TARGET_B) !== -1;
    const twoTabsDetail = (t) => 'A active after reload=' + t.activeA + ' conversations stored=' + JSON.stringify(t.urls);

    const t7 = await twoTabs('async');
    check('G7', "async only, two tabs: A's bookmark survives B's save in another conversation", twoTabsOk(t7), twoTabsDetail(t7));

    // G8 / G9 — a store cut off mid-record, what a save must never replace.
    const CUT_OFF = '{"https://claude.ai/chat/00000000-0000-4000-8000-000000000000":{"bookmarks":[{"id":"bm_kept"';
    async function unreadable(mode, BROKEN) {
        const prefix = mode === 'sync' ? '__gmsync:' : '__gmasync:';
        const context = await browser.newContext();
        const logs = [];
        const page = await openTab(context, TARGET, mode, logs);
        await setHeld(page, prefix, 'acn-bookmarks-v1', held(mode, BROKEN));
        await reloadTab(page);
        await bookmarkFirst(page);
        await page.waitForTimeout(400);
        const toast = await page.evaluate("(document.querySelector('[data-acn-role=\"toast\"]') || {}).textContent || ''");
        const r = await page.evaluate(READ);   // the flag, after the FIRST click
        await page.evaluate("document.querySelector('[data-acn-bookmark]').click()");   // a second try: still one warning
        await page.waitForTimeout(400);
        const after = unheld(mode, await getHeld(page, prefix, 'acn-bookmarks-v1'));
        await context.close();
        return { kept: after === BROKEN, toast, active: r.active,
                 lines: logs.filter((l) => l.indexOf('[ACN] storage: the stored acn-bookmarks-v1 could not be read') === 0).length };
    }
    const unreadableOk = (u) => u.kept && u.lines === 1 && u.toast.indexOf('Not saved') === 0 && u.active === 0;
    const unreadableDetail = (u) => 'stored value kept=' + u.kept + ' warning lines=' + u.lines +
        ' toast=' + JSON.stringify(u.toast) + ' active flags=' + u.active;

    const u8 = await unreadable('async', CUT_OFF);
    check('G8', 'async only, stored bookmarks unreadable: nothing saved over them, one warning, flag stays off',
        unreadableOk(u8), unreadableDetail(u8));
    const u9 = await unreadable('sync', CUT_OFF);
    check('G9', 'sync, stored bookmarks unreadable: nothing saved over them, one warning, flag stays off',
        unreadableOk(u9), unreadableDetail(u9));

    const t10 = await twoTabs('sync');
    check('G10', 'sync, two tabs: both bookmarks kept (the Tampermonkey path re-reads before it writes)',
        twoTabsOk(t10), twoTabsDetail(t10));

    // G11 — another tab saves ChatGPT's position after this page loaded; this page is dragged.
    const z = await (async () => {
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'async');
        await setHeld(page, '__gmasync:', 'acn-zone-positions', held('async', { chatgpt: 0.3 }));
        const c = await page.evaluate(() => {
            const r = document.getElementById('acn-dot-nav').getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
        await page.mouse.move(c.x, c.y + 60, { steps: 6 });
        await page.mouse.move(c.x, c.y + 120, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        const stored = unheld('async', await getHeld(page, '__gmasync:', 'acn-zone-positions'));
        await context.close();
        return stored;
    })();
    check('G11', "async only: another tab's zone position for another platform survives this tab's drag",
        !!z && z.chatgpt === 0.3 && typeof z.claude === 'number' && z.claude !== 0.5,
        'stored positions=' + JSON.stringify(z));

    // G12 — this page loaded with one command; another tab then saved a second; this page runs the first.
    const cmds = await (async () => {
        const one = { id: 'cmd_1', name: 'one', description: '', prompt: 'first prompt',
                      createdAt: 1, updatedAt: 1, usageCount: 0, lastUsedAt: null };
        const two = Object.assign({}, one, { id: 'cmd_2', name: 'two', prompt: 'second prompt', createdAt: 2, updatedAt: 2 });
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'async');
        await setHeld(page, '__gmasync:', 'acn-commands', held('async', [one]));
        await reloadTab(page);
        await page.waitForFunction("!!document.querySelector('.acn-cmd-card[data-cmd-id=\"cmd_1\"]')", null, { timeout: 10000 });
        await setHeld(page, '__gmasync:', 'acn-commands', held('async', [one, two]));
        await page.evaluate("document.querySelector('.acn-cmd-card[data-cmd-id=\"cmd_1\"] .acn-cmd-btn[title=\"Execute\"]').click()");
        await page.waitForTimeout(500);
        const stored = unheld('async', await getHeld(page, '__gmasync:', 'acn-commands'));
        await context.close();
        return stored || [];
    })();
    const cmdIds = cmds.map((c) => c.id);
    const cmdOne = cmds.filter((c) => c.id === 'cmd_1')[0];
    check('G12', "async only: a command another tab saved survives this tab running one",
        cmdIds.indexOf('cmd_2') !== -1 && !!cmdOne && cmdOne.usageCount === 1,
        'stored ids=' + JSON.stringify(cmdIds) + ' cmd_1 usageCount=' + (cmdOne && cmdOne.usageCount));

    // G13 — two bookmarks made in quick succession while every read answers 200 ms late.
    const q = await (async () => {
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'slowread');
        await page.waitForFunction("document.querySelectorAll('[data-acn-bookmark]').length > 1", null, { timeout: 30000 });
        await page.evaluate("document.querySelectorAll('[data-acn-bookmark]')[0].click()");
        await page.waitForTimeout(100);
        await page.evaluate("document.querySelectorAll('[data-acn-bookmark]')[1].click()");
        await page.waitForTimeout(1500);
        const store = await bookmarkStore(page, 'async');
        await context.close();
        return (store && store[TARGET] && store[TARGET].bookmarks) ? store[TARGET].bookmarks.length : 0;
    })();
    check('G13', 'async only, reads answer late and unevenly: two quick bookmarks in one tab both survive',
        q === 2, 'bookmarks stored for this conversation=' + q);

    // G14 — another tab caches a conversation's context after this page loaded; this page then
    // gets a reply's message_delta through its own fetch proxy (the SSE tap), which caches its own.
    const ctx = await (async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const html = buildPage(raw, 'async');
        await page.route('**/*', (route) => {
            if (route.request().url().indexOf('/completion') !== -1) {
                route.fulfill({ status: 200, contentType: 'text/event-stream',
                    body: 'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n' });
            } else route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
        });
        await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await waitCluster(page);
        const other = { cumulativeThinkingChars: 7, sseMessageCount: 1, timestamp: 1 };
        await setHeld(page, '__gmasync:', 'acn_ctx_cache', held('async', { 'other-conversation': other }));
        await page.evaluate(() => fetch('https://claude.ai/api/organizations/o/chat_conversations/c/completion',
            { method: 'POST' }).then((r) => r.text()));
        await page.waitForTimeout(600);
        const stored = unheld('async', await getHeld(page, '__gmasync:', 'acn_ctx_cache'));
        await context.close();
        return stored || {};
    })();
    const convId = TARGET.split('/').pop();
    check('G14', "async only: another tab's context-cache entry survives this tab's SSE write",
        !!ctx['other-conversation'] && !!ctx[convId] && ctx[convId].sseMessageCount === 1,
        'stored conversations=' + JSON.stringify(Object.keys(ctx)));

    // G15 / G16 — a command created through the form: Tools -> /Commands -> + New Command.
    async function createThroughForm(page, name) {
        await page.evaluate("document.querySelector('#acn-cmd-body .acn-cmd-new-btn').click()");
        await page.waitForFunction("!!document.querySelector('#acn-cmd-body .acn-cmd-form-save')", null, { timeout: 10000 });
        await page.evaluate((n) => {
            const inputs = document.querySelectorAll('#acn-cmd-body .acn-cmd-input');
            inputs[0].value = n;
            document.querySelector('#acn-cmd-body .acn-cmd-textarea').value = 'a prompt for ' + n;
            document.querySelector('#acn-cmd-body .acn-cmd-form-save').click();
        }, name);
        await page.waitForTimeout(500);
        return page.evaluate("(document.querySelector('#acn-cmd-body .acn-cmd-form-err') || {}).textContent || ''");
    }
    const theirs = { id: 'cmd_9', name: 'deploy', description: '', prompt: 'their prompt',
                     createdAt: 9, updatedAt: 9, usageCount: 0, lastUsedAt: null };
    const dup = await (async () => {
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'async');
        await setHeld(page, '__gmasync:', 'acn-commands', held('async', [theirs]));   // another tab, after this one loaded
        const err = await createThroughForm(page, 'deploy');
        const stored = unheld('async', await getHeld(page, '__gmasync:', 'acn-commands')) || [];
        await context.close();
        return { err, stored };
    })();
    const dupNames = dup.stored.map((c) => c.name).sort();
    check('G15', 'async only: two tabs both create /deploy: both kept, names unique',
        dup.stored.length === 2 && dup.stored.some((c) => c.id === 'cmd_9') &&
        new Set(dupNames).size === 2 && dupNames.indexOf('deploy') !== -1 && !dup.err,
        'stored names=' + JSON.stringify(dupNames) + ' form error=' + JSON.stringify(dup.err));

    const bad = await (async () => {
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'async');
        // Text that does not parse. (A value that parses but is not a list already stops the
        // /Commands section rendering, on v12.12 too, so the form could not be reached.)
        const heldValue = '[{"id":"cmd_1","name":"kept"';
        await setHeld(page, '__gmasync:', 'acn-commands', heldValue);
        await reloadTab(page);
        const err = await createThroughForm(page, 'deploy');
        const after = await getHeld(page, '__gmasync:', 'acn-commands');
        await context.close();
        return { err, kept: after === heldValue };
    })();
    check('G16', 'async only, stored commands unreadable: creating one shows "Not saved" and writes nothing',
        bad.kept && bad.err.indexOf('Not saved') === 0,
        'stored value kept=' + bad.kept + ' form error=' + JSON.stringify(bad.err));

    // G17 / G18 — deletions. Clicking an active flag again removes that bookmark.
    const firstFlag = "document.querySelector('[data-acn-bookmark]').click()";
    const del17 = await (async () => {
        const context = await browser.newContext();
        const b = await openTab(context, TARGET_B, 'async');
        await bookmarkFirst(b);
        await b.waitForTimeout(500);
        const a = await openTab(context, TARGET, 'async');
        await bookmarkFirst(a);
        await a.waitForTimeout(500);
        await b.evaluate(firstFlag);          // B removes its own bookmark
        await b.waitForTimeout(500);
        const urls = urlsWithBookmarks(await bookmarkStore(a, 'async'));
        await context.close();
        return urls;
    })();
    check('G17', "async only: B removing its own bookmark keeps A's",
        del17.indexOf(TARGET) !== -1 && del17.indexOf(TARGET_B) === -1,
        'conversations stored=' + JSON.stringify(del17));
    const del18 = await (async () => {
        const context = await browser.newContext();
        const b = await openTab(context, TARGET_B, 'async');
        await bookmarkFirst(b);
        await b.waitForTimeout(500);
        const a = await openTab(context, TARGET, 'async');   // A's page now holds B's bookmark
        await b.evaluate(firstFlag);          // B removes it
        await b.waitForTimeout(500);
        await bookmarkFirst(a);               // A saves
        await a.waitForTimeout(500);
        const urls = urlsWithBookmarks(await bookmarkStore(a, 'async'));
        await context.close();
        return urls;
    })();
    check('G18', "async only: a bookmark B removed does not come back with A's save",
        del18.indexOf(TARGET) !== -1 && del18.indexOf(TARGET_B) === -1,
        'conversations stored=' + JSON.stringify(del18));

    // G19 — nothing stored under acn-commands yet: one command created, one stored.
    const first = await (async () => {
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'async');
        const err = await createThroughForm(page, 'only');
        const stored = unheld('async', await getHeld(page, '__gmasync:', 'acn-commands')) || [];
        await context.close();
        return { err, ids: stored.map((c) => c.id) };
    })();
    check('G19', 'async only, nothing stored yet: the first command is stored once',
        first.ids.length === 1 && !first.err, 'stored ids=' + JSON.stringify(first.ids) + ' form error=' + JSON.stringify(first.err));

    // G20 / G21 — the first bookmark write fails or never answers; a second bookmark follows.
    async function twoAfterTrouble(mode, gapMs) {
        const context = await browser.newContext();
        const logs = [];
        const page = await openTab(context, TARGET, mode, logs);
        await page.waitForFunction("document.querySelectorAll('[data-acn-bookmark]').length > 1", null, { timeout: 30000 });
        await page.evaluate("document.querySelectorAll('[data-acn-bookmark]')[0].click()");
        await page.waitForTimeout(gapMs);
        await page.evaluate("document.querySelectorAll('[data-acn-bookmark]')[1].click()");
        await page.waitForTimeout(800);
        const store = await bookmarkStore(page, 'async');
        await context.close();
        return { n: (store && store[TARGET] && store[TARGET].bookmarks) ? store[TARGET].bookmarks.length : 0,
                 stall: logs.filter((l) => l.indexOf('[ACN] storage: GM storage did not answer within 5 s') === 0).length };
    }
    const rej = await twoAfterTrouble('rejectonce', 400);
    check('G20', 'async only, the first bookmark write is rejected: it goes out with the next save',
        rej.n === 2, 'bookmarks stored=' + rej.n);
    const hng = await twoAfterTrouble('hangonce', 5600);
    check('G21', 'async only, the first bookmark write never answers: the next save carries it',
        hng.n === 2, 'bookmarks stored=' + hng.n);
    check('G22', 'async only, the same stall is logged once', hng.stall === 1, 'stall lines=' + hng.stall);

    const slowRej = await twoAfterTrouble('rejectslow', 100);   // the second click lands while the first write is pending
    check('G23', 'async only, a bookmark made while a failing write is pending: both stored, no third save needed',
        slowRej.n === 2, 'bookmarks stored=' + slowRej.n);

    // G24 — A's panel is open with A's bookmark; B, on the same conversation, adds one; A adds
    // a second, whose write brings B's into A's page; then A clears all.
    const clear = await (async () => {
        const context = await browser.newContext();
        const a = await openTab(context, TARGET, 'async');
        a.on('dialog', (d) => d.accept());
        await a.evaluate("document.getElementById('acn-dot-bookmarks').click()");
        await a.waitForFunction("document.querySelectorAll('[data-acn-bookmark]').length > 1", null, { timeout: 30000 });
        await a.evaluate("document.querySelectorAll('[data-acn-bookmark]')[0].click()");
        await a.waitForTimeout(500);
        const b = await openTab(context, TARGET, 'async');
        await b.waitForFunction("document.querySelectorAll('[data-acn-bookmark]').length > 2", null, { timeout: 30000 });
        await b.evaluate("document.querySelectorAll('[data-acn-bookmark]')[2].click()");
        await b.waitForTimeout(500);
        await a.evaluate("document.querySelectorAll('[data-acn-bookmark]')[1].click()");
        await a.waitForTimeout(800);
        const before = await bookmarkStore(a, 'async');
        const storedBefore = (before && before[TARGET]) ? before[TARGET].bookmarks.length : 0;
        const shown = await a.evaluate("document.querySelectorAll('#acn-panel-bookmarks .acn-bk').length");
        await a.evaluate("document.querySelector('#acn-panel-bookmarks .acn-bm-clearall').click()");
        await a.waitForTimeout(600);
        const after = await bookmarkStore(a, 'async');
        const storedAfter = (after && after[TARGET]) ? after[TARGET].bookmarks.length : 0;
        await context.close();
        return { storedBefore, shown, storedAfter };
    })();
    check('G24', 'async only: Clear all removes exactly the bookmarks the panel shows',
        clear.storedAfter === clear.storedBefore - clear.shown && clear.shown > 0,
        'stored before=' + clear.storedBefore + ' cards shown=' + clear.shown + ' stored after=' + clear.storedAfter);

    // G25 — G15's case, read from the open list: the card shows the stored name.
    const listNames = await (async () => {
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'async');
        await setHeld(page, '__gmasync:', 'acn-commands', held('async', [theirs]));
        await createThroughForm(page, 'deploy');
        await page.waitForTimeout(300);
        const names = await page.evaluate("Array.from(document.querySelectorAll('#acn-cmd-body .acn-cmd-name')).map(function (e) { return e.textContent; })");
        await context.close();
        return names.sort();
    })();
    check('G25', 'async only: the open /Commands list shows the names as stored',
        JSON.stringify(listNames) === JSON.stringify(['/deploy', '/deploy-2']), 'cards=' + JSON.stringify(listNames));

    const u26 = await unreadable('async', JSON.stringify({ [TARGET]: null }));
    check('G26', "async only, this conversation's stored entry is null: nothing saved over it, one warning",
        unreadableOk(u26), unreadableDetail(u26));

    const ctor = await (async () => {
        const context = await browser.newContext();
        const page = await openTab(context, TARGET, 'async');
        const err = await createThroughForm(page, 'constructor');
        const stored = unheld('async', await getHeld(page, '__gmasync:', 'acn-commands')) || [];
        await context.close();
        return { err, names: stored.map((c) => c.name) };
    })();
    check('G27', "async only: a command named 'constructor' keeps its name",
        JSON.stringify(ctor.names) === JSON.stringify(['constructor']) && !ctor.err,
        'stored names=' + JSON.stringify(ctor.names) + ' form error=' + JSON.stringify(ctor.err));

    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})();
