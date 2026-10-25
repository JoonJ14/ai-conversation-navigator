// Checks for the ChatGPT and Perplexity conversation-index ADAPTERS (v12.10, spec Phase 3).
// Both sites window their message lists (Layer 4), so the panel lists what each site's own
// JSON says, and falls back to the DOM window — visibly — when that JSON is unavailable.
//
// Run: node probes/check-index-adapters.js [--browser chromium|firefox|webkit] [--quiet]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-index-adapters.js
// Exits non-zero on any failed expectation.
//
// WHY A PROBE: the adapters' behaviour is mostly TRANSPORT and PAYLOAD state — which
// request was sent with which token, what it answered, which page came next. The suite's
// shared GM shim routes every non-200 through onerror, so a 401 could never reach the
// ChatGPT adapter there. Here both transports answer from ONE Node-side function with real
// manager semantics (an HTTP error arrives through onload, with its status).
//
// THE MOCKS GENUINELY UNMOUNT (CLAUDE.md, Layer 4): tests/mock-pages/chatgpt-windowed.html
// keeps 6 user turns mounted; perplexity-windowed.html keeps the entries in view plus the
// latest, and pins its scroller to the bottom until a wheel event, as the live site does.
//
// CONTEXT of these results: Playwright, page realm, the userscript inlined into the page.
// Payload shapes and DOM ids were measured live in Chrome (page realm, 2026-10-23); nothing
// here is a real userscript manager. Real-browser behaviour is the owner's acceptance.
//
// Proof rule (spec Phase 3): run the old build against this file too — every fixture
// marked [new] must FAIL there. Fixtures marked [guard] must pass on both builds.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const GPT_CONV  = '6994e2d6-ce6c-832a-aa7d-04b747928fd8';   // the spec's conversation id shape
const PPLX_CONV = 'de5dd7ce-5eb6-4045-a861-d337141e10b6';
const uuid = (n, tag) => (tag || 'aaaaaaaa') + '-0000-4000-8000-' + String(n).padStart(12, '0');

// ── ChatGPT payloads ──────────────────────────────────────────────────────
// opts.turns: visible user turns [{ id, text, imageOnly? }]; opts.hidden: insert a hidden
// user-role context node first; opts.branchAt: turn index whose question was EDITED — the
// abandoned original stays in the mapping as an earlier sibling.
function gptMapping(opts) {
    const m = {};
    const add = (id, parent, message) => {
        m[id] = { id, parent, children: [], message };
        if (parent) m[parent].children.push(id);
    };
    add('client-created-root', null, null);
    add('sys-0', 'client-created-root', { id: 'sys-0', author: { role: 'system' }, content: { content_type: 'text', parts: [''] }, metadata: {} });
    let prev = 'sys-0';
    if (opts.hidden) {
        add('hidden-ctx', prev, { id: 'hidden-ctx', author: { role: 'user' },
            content: { content_type: 'text', parts: ['HIDDEN CONTEXT that must never be listed'] },
            metadata: { is_visually_hidden_from_conversation: true } });
        prev = 'hidden-ctx';
    }
    opts.turns.forEach((t, i) => {
        if (opts.branchAt === i) {
            add('orig-' + i, prev, { id: 'orig-' + i, author: { role: 'user' },
                content: { content_type: 'text', parts: ['ORIGINAL question that was edited away'] }, metadata: {} });
            add('orig-a-' + i, 'orig-' + i, { id: 'orig-a-' + i, author: { role: 'assistant' },
                content: { content_type: 'text', parts: ['old answer'] }, metadata: {} });
        }
        const content = t.imageOnly
            ? { content_type: 'multimodal_text', parts: [{ content_type: 'image_asset_pointer', asset_pointer: 'file-service://x' }] }
            : { content_type: 'text', parts: [t.text] };
        add(t.id, prev, { id: t.id, author: { role: 'user' }, content, metadata: {} });
        add('a-' + i, t.id, { id: 'a-' + i, author: { role: 'assistant' },
            content: { content_type: 'text', parts: ['Answer ' + (i + 1)] }, metadata: {} });
        prev = 'a-' + i;
    });
    return { title: 'probe', conversation_id: GPT_CONV, mapping: m, current_node: prev,
             sectioned_conversation: null, context_truncation_continuation: null };
}
const gptTurns = (n) => Array.from({ length: n }, (_, i) => ({ id: uuid(i), text: 'ChatGPT probe question ' + (i + 1) + ' about windowing?' }));

// ── Perplexity payloads, paged the way the live endpoint pages (measured 2026-10-23):
// from_first=true starts at the oldest entry, cursor continues, offset is ignored.
const pplxEntries = (n) => Array.from({ length: n }, (_, i) => ({
    backend_uuid: uuid(i, 'bbbbbbbb'), query_str: 'Perplexity probe question ' + (i + 1) + ' about pinned scrollers?',
    read_write_token: 'SECRET-RW-' + i, attachments: [] }));
function pplxPage(all, url, opts) {
    const u = new URL(url);
    const limit = parseInt(u.searchParams.get('limit') || '20', 10);
    const fromFirst = u.searchParams.get('from_first') === 'true';
    const cur = u.searchParams.get('cursor');
    let start = cur ? parseInt(cur.replace('cur-', ''), 10) : 0;
    if (!fromFirst && !cur) start = Math.max(0, all.length - limit);   // newest page, as live
    const slice = all.slice(start, start + limit);
    // endless: a thread that never stops paging, with a FRESH entry at every index, so a
    // check can tell exactly which entries were listed.
    const more = opts && opts.endless ? true : start + limit < all.length;
    return { status: 'COMPLETED', entries: opts && opts.endless ? pplxEntries(start + limit).slice(start) : slice,
             has_next_page: more, next_cursor: more ? 'cur-' + (start + limit) : null,
             background_entries: [], first_entry: null, latest_entry: null, thread_metadata: {} };
}

function buildPage(site, scriptContent, sc) {
    const file = site === 'chatgpt' ? 'chatgpt-windowed.html' : 'perplexity-windowed.html';
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages', file), 'utf8');
    const body = (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock;
    const head = (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '';
    return `<!DOCTYPE html><html><head>${head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(sc.mockConfig || {})};</script>
${body}
<script>
delete window._aiNavAlreadyLoaded;
window.__gmCalls = [];
${sc.gm === 'answer' ? `
window.GM_xmlhttpRequest = function (opts) {
    window.__gmCalls.push({ url: opts.url, headers: JSON.stringify(opts.headers || null) });
    window.__answer('gm', opts.url, opts.headers || {}).then(function (a) {
        setTimeout(function () {
            if (a.kind === 'hang') return;
            if (a.kind === 'abort') { if (opts.onerror) opts.onerror({ status: 0 }); return; }
            if (opts.onload) opts.onload({ status: a.status, responseText: a.body });
        }, 5);
    });
};` : '// gm absent: Greasemonkey 4 shape, so the ladder falls through to fetch'}
${sc.scriptHandler ? `window.GM_info = { scriptHandler: ${JSON.stringify(sc.scriptHandler)}, version: 'probe' };` : ''}
var _s = {};
window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
window.GM_setValue = function (k, v) { _s[k] = v; };
</script>
<script>${scriptContent}</script></body></html>`;
}

const READ = `(function () {
    var stat = document.querySelector('[data-acn-role="nav-stat"]');
    var banner = document.querySelector('[data-acn-index-status]');
    var texts = Array.from(document.querySelectorAll('[data-acn-role="nav-item-text"]')).map(function (e) { return e.textContent; });
    return { count: stat ? stat.getAttribute('data-acn-count') : null,
             banner: banner ? banner.getAttribute('data-acn-index-status') : null,
             bannerText: banner ? banner.textContent : null, texts: texts };
}())`;

(async () => {
    const engine = process.argv.indexOf('--browser') !== -1 ? process.argv[process.argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = process.argv.includes('--quiet');
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

    // sc: { site, url, mockConfig, gm: 'answer'|'absent', scriptHandler, api(url, headers, calls) ->
    //       { status, body } | { kind: 'abort' } | { kind: 'hang' }, expectCount, after(page, out) }
    async function scenario(sc) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        const calls = [];
        const logs = [];
        const errors = [];
        page.on('console', (m) => logs.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
        const answer = (transport, url, headers) => {
            const auth = headers.Authorization || headers.authorization || '';
            calls.push({ transport, url, auth });
            const a = sc.api ? sc.api(url, auth, calls, transport) : { kind: 'abort' };
            return a.kind ? { kind: a.kind } : { status: a.status, body: typeof a.body === 'string' ? a.body : JSON.stringify(a.body) };
        };
        await page.exposeFunction('__answer', (t, u, h) => answer(t, u, h));
        const html = buildPage(sc.site, raw, sc);
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u === sc.url) { route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return; }
            if (/\/(api|backend-api|rest)\//.test(u)) {
                const a = answer('fetch', u, route.request().headers());
                if (a.kind === 'hang') return;
                if (a.kind) { route.abort().catch(() => {}); return; }
                route.fulfill({ status: a.status, contentType: 'application/json', body: a.body }).catch(() => {});
                return;
            }
            route.abort().catch(() => {});
        });
        await page.goto(sc.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        await page.evaluate("document.getElementById('acn-dot-nav').click()");
        try {
            await page.waitForFunction(`(function () {
                var s = document.querySelector('[data-acn-role="nav-stat"]');
                var b = document.querySelector('[data-acn-index-status="degraded"], [data-acn-index-status="ready-with-notes"]');
                return (s && s.getAttribute('data-acn-count') === ${JSON.stringify(String(sc.expectCount))}) || !!b;
            }())`, null, { timeout: sc.timeoutMs || 20000 });
        } catch (e) { /* the read below reports whatever is on screen */ }
        let out = null, prev = null;
        for (let i = 0; i < 20; i++) {
            const cur = await page.evaluate(READ);
            if (prev && prev.count === cur.count && prev.banner === cur.banner) { out = cur; break; }
            prev = cur;
            await page.waitForTimeout(300);
        }
        out = out || prev;
        out.calls = calls;
        out.logs = logs;
        out.errors = errors;
        out.gmCalls = await page.evaluate('window.__gmCalls || []');
        if (sc.after) out.after = await sc.after(page, out);
        await context.close();
        return out;
    }

    // Click Navigate's row `idx` and report what the jump resolved: the zone's
    // data-acn-jump-resolved and the identity of the element marked as the target.
    const jumpTo = (idAttr, rowIndex) => async (page) => {
        // No rows at all (the old build on these mocks) is a failed jump, reported, not a crash.
        const clicked = await page.evaluate((i) => {
            const row = document.querySelectorAll('[data-acn-role="nav-item"]')[i];
            if (row) row.click();
            return !!row;
        }, rowIndex || 0);
        if (!clicked) return { resolved: null, targetId: null, mounted: null, noRows: true };
        try {
            await page.waitForFunction(() => document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') !== null,
                                       null, { timeout: 15000 });
        } catch (e) {}
        // Where the target ended up, once the view has been still for 800 ms (cap 8 s).
        let last = null, still = 0;
        for (let k = 0; k < 160 && still < 16; k++) {
            const st = await page.evaluate(() => document.getElementById('mock-scroller').scrollTop);
            if (st === last) still++; else { still = 0; last = st; }
            await page.waitForTimeout(50);
        }
        return page.evaluate((attr) => {
            const t = document.querySelector('[data-acn-jump-target]');
            const host = t && t.closest('[' + attr + ']');
            const sc = document.getElementById('mock-scroller');
            let inView = false, err = null;
            if (t) {
                const r = sc.getBoundingClientRect(), b = t.getBoundingClientRect();
                const max = sc.scrollHeight - sc.clientHeight;
                const ideal = Math.max(0, Math.min(max, b.top - r.top + sc.scrollTop - (sc.clientHeight - b.height) / 2));
                inView = b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
                err = Math.round(sc.scrollTop - ideal);
            }
            return { resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved'),
                     targetId: host ? host.getAttribute(attr) : null,
                     mounted: window.__mockWindow.mounted(),
                     released: window.__mockWindow.released, inView: inView, err: err };
        }, idAttr);
    };

    const lines = (r, re) => r.logs.filter((l) => re.test(l));
    const brief = (r) => 'count=' + r.count + ' banner=' + r.banner + ' errors=' + r.errors.length;
    const gptUrl = 'https://chatgpt.com/c/' + GPT_CONV;
    const pplxUrl = 'https://www.perplexity.ai/search/' + PPLX_CONV;
    const T10 = gptTurns(10);
    const gptApi = (convBody, opts) => (url, auth, calls) => {
        if (url.endsWith('/api/auth/session')) {
            // Numbered from 0: this call is already recorded, so it is n - 1.
            const n = calls.filter((c) => c.url.endsWith('/api/auth/session')).length - 1;
            return { status: 200, body: { accessToken: 'tok-' + n, expires: '2099-01-01T00:00:00.000Z' } };
        }
        if (url.indexOf('/backend-api/conversation/' + GPT_CONV) !== -1) {
            if (opts && opts.unauthorized && opts.unauthorized(auth)) return { status: 401, body: { detail: 'Unauthorized' } };
            return { status: 200, body: convBody };
        }
        return { kind: 'abort' };
    };

    console.log('check-index-adapters — engine=' + engine + ', script=' + path.basename(scriptPath));

    // ── ChatGPT ──────────────────────────────────────────────────────────
    // 1 [new] The DOM fallback on the new app shell: no API, so the panel lists the mounted
    // window (positions 4-9 of 10) — and SAYS it is the window. The old build lists 0.
    const c1 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 6 });
    check('C1', 'ChatGPT DOM fallback lists the 6 mounted turns, with the degraded banner',
          c1.count === '6' && c1.banner === 'degraded' && c1.texts[0] === T10[4].text, brief(c1));

    // 2 [new] The index: 10 questions in order. 7 [new] Jump to Q1 from the bottom window
    // resolves by data-turn-key — the element marked as the target sits under turn 0's id.
    const c2 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 10,
                                api: gptApi(gptMapping({ turns: T10 })), after: jumpTo('data-turn-key') });
    check('C2', 'ChatGPT index lists all 10 questions in order',
          c2.count === '10' && c2.banner === null && c2.texts.join('|') === T10.map((t) => t.text).join('|'), brief(c2));
    check('C2-log', 'one index line per request names platform, transport, endpoint, status and the count',
          lines(c2, /^\[ACN\] index: platform=chatgpt transport=fetch endpoint=conversation status=200 questions=10$/).length === 1 &&
          lines(c2, /^\[ACN\] index: platform=chatgpt transport=fetch endpoint=session status=200$/).length === 1,
          lines(c2, /^\[ACN\] index: platform=/).join(' / '));
    check('C2-secret', 'no token ever reaches the console', !c2.logs.some((l) => /tok-\d/.test(l)));
    check('C7', 'jump to Q1 from the bottom window resolves position 0 via data-turn-key',
          c2.after && c2.after.resolved === '0' && c2.after.targetId === T10[0].id,
          JSON.stringify(c2.after));

    // 3 [new] Branch: an edited question leaves its original as a sibling. Only the
    // current_node path is listed.
    const c3 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 10,
                                api: gptApi(gptMapping({ turns: T10, branchAt: 3 })) });
    check('C3', 'only the active branch is indexed (the edited-away original is absent)',
          c3.count === '10' && !c3.texts.some((t) => /ORIGINAL/.test(t)) && c3.texts[3] === T10[3].text, brief(c3));

    // [new] A broken tree (a node whose parent the mapping lacks) is not a complete history:
    // the walk refuses it and the panel says it is showing the window (Tier 3, PR #78).
    const broken = gptMapping({ turns: T10 });
    broken.mapping[T10[3].id].parent = 'missing-parent-id';
    const c3b = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 6,
                                 api: gptApi(broken) });
    check('C3b', 'a mapping with a missing parent degrades visibly instead of listing a partial path',
          c3b.count === '6' && c3b.banner === 'degraded', brief(c3b));

    // [new] Branch switch to a SHORTER branch (GitHub Codex, PR #78): every mounted id is
    // already indexed, so only the "bottom shows fewer than the index lists" signal can
    // notice. The API then serves the 4-turn branch; the panel must follow, past the cooldown.
    let branchBody = gptMapping({ turns: T10 });
    const c3c = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 10,
        api: (url, auth, calls) => gptApi(branchBody)(url, auth, calls),
        after: async (page) => {
            branchBody = gptMapping({ turns: T10.slice(0, 4) });
            await page.evaluate((t) => window.__mockWindow.setTurns(t), T10.slice(0, 4));
            try {
                await page.waitForFunction(() => {
                    const s = document.querySelector('[data-acn-role="nav-stat"]');
                    return s && s.getAttribute('data-acn-count') === '4';
                }, null, { timeout: 40000 });
            } catch (e) {}
            return page.evaluate(() => document.querySelector('[data-acn-role="nav-stat"]').getAttribute('data-acn-count'));
        }, timeoutMs: 20000 });
    check('C3c', 'switching to a shorter branch rebuilds the list (10 -> 4)', c3c.count === '10' && c3c.after === '4',
          'before=' + c3c.count + ' after=' + c3c.after);

    // 4 [new] A hidden user-role context node is excluded.
    // 8 [new] The jump's text fallback never resolves a repeated question to another entry:
    // Q1 and Q10 read the same, the window cannot page (frozen), and only Q10 is mounted.
    const T10dup = T10.map((t, i) => (i === 0 ? { id: t.id, text: T10[9].text } : t));
    const c8 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10dup, frozen: true }, expectCount: 10,
                                api: gptApi(gptMapping({ turns: T10dup })), after: jumpTo('data-turn-key') });
    check('C8', 'a jump to a repeated question that cannot be mounted fails rather than landing on its twin',
          c8.after && c8.after.resolved === null && c8.after.targetId === null, JSON.stringify(c8.after));

    const c4 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 10,
                                api: gptApi(gptMapping({ turns: T10, hidden: true })) });
    check('C4', 'a hidden user-role node is not listed',
          c4.count === '10' && !c4.texts.some((t) => /HIDDEN/.test(t)), brief(c4));

    // 5 [new] An image-only question is listed as an attachment, not dropped.
    const T10img = T10.map((t, i) => i === 5 ? { id: t.id, text: '', imageOnly: true } : t);
    const c5 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10img }, expectCount: 10,
                                api: gptApi(gptMapping({ turns: T10img })) });
    check('C5', 'an image-only question is listed as [Attachment]',
          c5.count === '10' && c5.texts[5] === '[Attachment]', brief(c5) + ' q6=' + c5.texts[5]);

    // 6a [new] 401 with the first token: refresh once, retry once, list everything.
    const c6a = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 10,
                                 api: gptApi(gptMapping({ turns: T10 }), { unauthorized: (auth) => auth === 'Bearer tok-0' }) });
    const sess6a = c6a.calls.filter((c) => c.url.endsWith('/api/auth/session')).length;
    check('C6a', 'a 401 refreshes the token once and retries once',
          c6a.count === '10' && sess6a === 2 && c6a.calls.some((c) => c.auth === 'Bearer tok-1'), brief(c6a) + ' sessions=' + sess6a);
    // 6b [new] A persistent 401 falls back to the DOM scan — visibly — after one refresh.
    const c6b = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 6,
                                 api: gptApi(gptMapping({ turns: T10 }), { unauthorized: () => true }) });
    const sess6b = c6b.calls.filter((c) => c.url.endsWith('/api/auth/session')).length;
    check('C6b', 'a persistent 401 falls back to the DOM window after exactly one refresh',
          c6b.count === '6' && c6b.banner === 'degraded' && sess6b === 2, brief(c6b) + ' sessions=' + sess6b);

    // [new] The gmxhr leg carries the bearer token to the right URL (Tampermonkey order).
    const g1 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 10, gm: 'answer',
                                scriptHandler: 'Tampermonkey', api: gptApi(gptMapping({ turns: T10 })) });
    const g1conv = g1.gmCalls.filter((c) => c.url === 'https://chatgpt.com/backend-api/conversation/' + GPT_CONV);
    check('G1', 'Tampermonkey order: gmxhr sends the bearer token, fetch is never asked',
          g1.count === '10' && g1conv.length === 1 && /"Authorization":"Bearer tok-0"/.test(g1conv[0].headers) &&
          !g1.calls.some((c) => c.transport === 'fetch'), brief(g1) + ' gm=' + g1.gmCalls.length);

    // [new] Tampermonkey order, gmxhr REFUSED (403 through onload, as a real manager reports
    // it): the ladder asks fetch, which answers, and the full list appears (Tier 3, PR #78).
    const g2conv = gptMapping({ turns: T10 });
    const g2 = await scenario({ site: 'chatgpt', url: gptUrl, mockConfig: { turns: T10 }, expectCount: 10, gm: 'answer',
                                scriptHandler: 'Tampermonkey',
                                api: (url, auth, calls, transport) => {
                                    if (transport === 'gm' && url.indexOf('/backend-api/') !== -1) return { status: 403, body: { detail: 'denied' } };
                                    return gptApi(g2conv)(url, auth, calls);
                                } });
    check('G2', 'a gmxhr refusal falls back to fetch, which lists everything',
          g2.count === '10' && g2.calls.some((c) => c.transport === 'gm' && /backend-api/.test(c.url)) &&
          g2.calls.some((c) => c.transport === 'fetch' && /backend-api/.test(c.url)), brief(g2));

    // [guard] Exact origin: on a look-alike host that platform detection's host.includes()
    // accepts, no request is sent at all, on either transport.
    const o1 = await scenario({ site: 'chatgpt', url: 'https://chatgpt.com.probe.cloudworkstations.dev/c/' + GPT_CONV,
                                mockConfig: { turns: T10 }, expectCount: 6, gm: 'answer', api: gptApi(gptMapping({ turns: T10 })) });
    check('O1', 'a look-alike host sends no index request on either transport',
          o1.calls.length === 0 && o1.gmCalls.length === 0 && lines(o1, /^\[ACN\] index:/).length === 0,
          'calls=' + o1.calls.length + ' gm=' + o1.gmCalls.length + ' count=' + o1.count);

    // ── Perplexity ───────────────────────────────────────────────────────
    const E12 = pplxEntries(12);
    const pplxApi = (all, opts) => (url) => {
        if (url.indexOf('/rest/thread/' + PPLX_CONV) === -1) return { kind: 'abort' };
        if (opts && opts.status) return { status: opts.status, body: { error: 'x' } };
        return { status: 200, body: pplxPage(all, url, opts) };
    };
    const texts = (all) => all.map((e) => ({ text: e.query_str }));

    // 8 [new] DOM fallback on the new markup: the mounted user bubbles only (bottom: the
    // last two entries), never the answers. The old build lists 0.
    const p8 = await scenario({ site: 'perplexity', url: pplxUrl, mockConfig: { entries: texts(E12) }, expectCount: 2 });
    check('P8', 'Perplexity DOM fallback lists only the mounted user bubbles, with the degraded banner',
          p8.count === '2' && p8.banner === 'degraded' && p8.texts[0] === E12[10].query_str, brief(p8));

    // 9 [new] One page: 12 entries, in order. 12 [new] Jump to Q1 from the bottom resolves
    // via data-workflow-entry — through the mock's stick-to-bottom pin.
    const p9 = await scenario({ site: 'perplexity', url: pplxUrl, mockConfig: { entries: texts(E12) }, expectCount: 12,
                                api: pplxApi(E12), after: jumpTo('data-workflow-entry') });
    check('P9', 'Perplexity index lists all 12 questions in order',
          p9.count === '12' && p9.banner === null && p9.texts.join('|') === E12.map((e) => e.query_str).join('|'), brief(p9));
    check('P9-secret', 'read_write_token never reaches the console', !p9.logs.some((l) => /SECRET-RW/.test(l)));
    check('P12', 'jump to Q1 from the bottom resolves entry 0 via data-workflow-entry',
          p9.after && p9.after.resolved === '0' && p9.after.targetId === '0', JSON.stringify(p9.after));

    // 13 [guard] A MOUNTED target (the penultimate entry, at the bottom) must land in view
    // through the stick-to-bottom pin, which reverts any scroll it was not released for.
    // Asserted as the landing (in view, within 24 px of centred), not as the mechanism: since
    // v12.15 the release happens in the jump's landing writes, not on a fast path. It was
    // [new] against the pre-v12.10 build; v12.14 passes it too (Playwright page realm,
    // chromium, 1 run), so between v12.14 and v12.15 it guards the release. The v12.15 jump
    // checks that fail on v12.14 are in probes/check-ix-jumps.js.
    const p13 = await scenario({ site: 'perplexity', url: pplxUrl, mockConfig: { entries: texts(E12) }, expectCount: 12,
                                 api: pplxApi(E12), after: jumpTo('data-workflow-entry', 10) });
    check('P13', 'a mounted-target jump resolves entry 10 and lands it in view, through the scroll pin',
          p13.after && p13.after.resolved === '10' && p13.after.targetId === '10' &&
          p13.after.inView === true && Math.abs(p13.after.err) <= 24,
          JSON.stringify(p13.after));

    // 10 [new] Many pages: 120 entries arrive 50 + 50 + 20, merged in order, every request
    // asking from the first entry.
    const E120 = pplxEntries(120);
    const p10 = await scenario({ site: 'perplexity', url: pplxUrl, mockConfig: { entries: texts(E120) }, expectCount: 120,
                                 api: pplxApi(E120) });
    const p10req = p10.calls.filter((c) => c.url.indexOf('/rest/thread/') !== -1);
    check('P10', 'all pages are fetched and merged in order (3 requests, from_first on each)',
          p10.count === '120' && p10req.length === 3 && p10req.every((c) => /from_first=true/.test(c.url)) &&
          p10.texts.join('|') === E120.map((e) => e.query_str).join('|'),
          brief(p10) + ' requests=' + p10req.length);
    check('P10-log', 'one line per page, with the page number; the last carries the count',
          lines(p10, /^\[ACN\] index: platform=perplexity transport=fetch endpoint=thread page=3 status=200 questions=120$/).length === 1,
          lines(p10, /endpoint=thread/).join(' / '));
    // 10b [new] The page cap holds against a thread that never stops paging, and the panel says so.
    const p10b = await scenario({ site: 'perplexity', url: pplxUrl, mockConfig: { entries: texts(E12) }, expectCount: 2000,
                                  api: pplxApi(E12, { endless: true }), timeoutMs: 30000 });
    const p10breq = p10b.calls.filter((c) => c.url.indexOf('/rest/thread/') !== -1);
    check('P10b', 'the page cap (40) stops an endless thread, logs it and labels the list',
          p10breq.length === 40 && p10b.banner === 'ready-with-notes' && lines(p10b, /page cap reached/).length === 1 &&
          p10b.count === '2000' && p10b.texts.join('|') === pplxEntries(2000).map((e) => e.query_str).join('|'),
          brief(p10b) + ' requests=' + p10breq.length);

    // 11 [new] An API failure falls back to the DOM scan, visibly.
    const p11 = await scenario({ site: 'perplexity', url: pplxUrl, mockConfig: { entries: texts(E12) }, expectCount: 2,
                                 api: pplxApi(E12, { status: 500 }) });
    check('P11', 'an API failure falls back to the mounted bubbles with the degraded banner',
          p11.count === '2' && p11.banner === 'degraded', brief(p11));

    const all = [c1, c8, c2, c3, c3b, c3c, c4, c5, c6a, c6b, g1, g2, o1, p8, p9, p13, p10, p10b, p11];
    const pageErrors = all.reduce((n, r) => n + r.errors.length, 0);
    check('E', 'no page errors in any scenario', pageErrors === 0,
          all.filter((r) => r.errors.length).map((r) => r.errors[0]).join(' / '));

    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
