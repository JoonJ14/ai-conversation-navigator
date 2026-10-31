// Checks for Claude's far mounted jump (v12.16 part A): the latest question, clicked from the top.
//
// Run: node probes/check-claude-far-jump.js [--browser chromium|firefox|webkit|all] [-j N] [--only F1,F4] [--quiet] [--trace]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-claude-far-jump.js
//      ACN_MOCK=/path/to/mock.html runs against another copy of the virtualizing mock
// Exits non-zero on any failed check or invalid run.
//
// THE BUG THIS GATES (owner, Chrome + Tampermonkey, v12.15 and v12.14, 2026-10-25; TROUBLESHOOTING,
// "Claude: a jump to the latest question from the top ends at the bottom"): Claude keeps its latest
// rows mounted at every scroll position, so from the top the latest question is found MOUNTED and
// took the fast path: one smooth scrollIntoView across ~200,000 px. During the glide the
// virtualizer replaced estimated row heights with measured ones, scrollHeight shrank, and the
// destination fixed at the glide's start no longer held the target: the view ended at the bottom,
// past it. The fix (ciLandFar) lands a FAR mounted target (outside the view +/- one viewport)
// through ixLandOn: instant writes, the target re-located by identity before each, within 8 px or
// capped at 4 writes.
//
// The fixture: the virtualizing mock (tests/mock-pages/claude-virtualized.html) with 147 questions
// (294 rows), the last 3 rows pinned (so question 147, row 292, is mounted from the top), the
// October answer markup and a data-turn-key on every row, and the mock's tailAtEnd knob (v12.16):
// the pinned rows sit at the END of the scroll height, after the bottom spacer, as live. Without
// it the mock appends them right after the mounted window, where they ride along with every scroll
// and neither build can land them from the top (measured: v12.15 stops 16,087 px short, the fix
// caps out 9,632 px short with a toast); P3 reports that geometry INVALID. The mock
// estimates every unmounted row at 1150 px against true heights averaging ~1040 px, so a glide
// that mounts rows on its way shrinks the content above the tail. P3 measures that drift and the
// tail's place; they are the precondition for the gate to mean anything.
//
// Preconditions (INVALID, not FAIL; they describe the fixture and the harness only):
//   P1  the index is ready and the page is visible
//   P2  Navigate lists 147, and exactly one item carries the target question's text
//   P3  the true total height differs from the estimated one by more than one scroller height
//       (a separate page: every row mounted by synchronous scroll steps), and from the top row 292
//       starts below half the estimated scroll height (the tail at the end)
//   P4  at click time the start position holds (scrollTop 0 for "from the top"; the bubble in view
//       for F6) and the target's row is mounted exactly once (F5: not mounted)
// Checks (each run on a fresh page; [new] fails on v12.15, [guard] passes on both):
//   F1  [new]   one Navigate click from the top to Q147: once the view has been still for 800 ms,
//               Q147's bubble is fully inside the scroller (its top, if taller than 0.8 x the view)
//   F2  [new]   same run: at most 24 px from its intended position (centred, clamped at the ends)
//   F3  [guard] same run: data-acn-jump-resolved is '292', and no toast
//   F4  [new]   the same landing through the Q#147 bookmark card from the top (a seeded schema-2
//               record keyed by the message uuid)
//   F5  [guard] from the top, Navigate to Q100 (unmounted: the settle loop) lands as F1/F2, resolved
//               '198', no toast
//   F6  [guard] Q147 already in view (not centred): Navigate lands it (a near target, the glide
//               unchanged), resolved '292', no toast
//   F7  [new]   Search for Q146's answer (row 291, pinned) clicked from the top: the answer is in
//               view, its row at most 24 px from its intended position (the row is taller than the
//               view, so its start), no toast. Not the last answer (row 293): no anchor lies below it,
//               so Search cannot resolve it among the mounted rows and sends it through the jump
//               bridge (the settle loop, then a centred glide of a 2,315 px row), not the far landing
//   E           no page errors in any run
// Every check asserts where the target ended up, read by row index and turn key; expected texts come
// from the mock's data (__mockVirtualization.rowText), never from the live DOM.
//
// CONTEXT of these results: Playwright <engine>, page realm, headless, viewport 1280x720, this
// machine; the userscript inlined into the mock, GM storage and the conversation request stubbed.
// Whether a smooth scroll animates here, and how far it drifts, is engine- and machine-specific:
// each F1 line reports the frames the scroll moved on and scrollHeight before and after. Not a
// userscript manager and not Claude's markup: real-browser acceptance on Safari + Userscripts,
// Chrome + Tampermonkey and Firefox + Tampermonkey is the owner's (DEC-031).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const ORG  = '99999999-9999-4999-8999-999999999999';
const CONV = 'b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7';
const CHAT_URL = 'https://claude.ai/chat/' + CONV;
// ACN_MOCK: another copy of the mock (development: a knob tried before it is committed).
const MOCK = process.env.ACN_MOCK || path.join(REPO, 'tests/mock-pages/claude-virtualized.html');
const TURNS = 147;
const ROWS = TURNS * 2;
const SUFFIX = ' VISIBLE-NOT-SR-ONLY';   // the mock's visible span after a question's text
const rowOfQ = (turn) => (turn - 1) * 2;
const uuidFor = (i) => CONV.slice(0, 24) + String(i).padStart(12, '0');

// The payload, as the mock renders it (baseQ / baseA in the mock, no knobs that change text).
function buildPayload() {
    const msgs = [], truth = [];
    let prev = '00000000-0000-4000-8000-000000000000';
    for (let t = 1; t <= TURNS; t++) {
        const q = { uuid: uuidFor(msgs.length), parent_message_uuid: prev, sender: 'human',
                    content: [{ type: 'text', text: 'Question number ' + t + ': how do I handle case ' + t + ' when the input is unusual?' + SUFFIX }],
                    attachments: [], files: [] };
        msgs.push(q); truth.push(q.uuid); prev = q.uuid;
        const a = { uuid: uuidFor(msgs.length), parent_message_uuid: prev, sender: 'assistant', stop_reason: 'end_turn',
                    content: [{ type: 'text', text: 'Answer number ' + t + ': validate the input first, then branch on the result.' }],
                    attachments: [], files: [] };
        msgs.push(a); truth.push(a.uuid); prev = a.uuid;
    }
    msgs.forEach((m, i) => { m.index = 1000 + i * 3; m.created_at = '2026-10-01T00:00:00Z'; m.text = ''; });
    return { payload: { uuid: CONV, name: 'far jump checks', current_leaf_message_uuid: prev, chat_messages: msgs }, truth };
}

function buildPage(scriptContent, mockConfig, payload, seed) {
    const mockHTML = fs.readFileSync(MOCK, 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>far jump checks</title></head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(mockConfig)};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var BODY = ${JSON.stringify(JSON.stringify(payload))};
    var SEED = ${JSON.stringify(seed ? JSON.stringify(seed) : null)};
    window.__acn = { fetches: 0, toasts: [] };
    if (SEED !== null) localStorage.setItem('__gmsync:acn-bookmarks-v1', JSON.stringify(SEED));
    window.GM_getValue = function (k, d) { var t = localStorage.getItem('__gmsync:' + k); return t === null ? d : JSON.parse(t); };
    window.GM_setValue = function (k, v) { localStorage.setItem('__gmsync:' + k, JSON.stringify(v)); };
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, 10);
        }
        if (/\\/usage$/.test(url)) { respond(500, ''); return; }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ${JSON.stringify(ORG)}, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        if (/chat_conversations\\//.test(url)) { window.__acn.fetches++; respond(200, BODY); return; }
        respond(404, '');
    };
    try { document.cookie = 'lastActiveOrg=' + ${JSON.stringify(ORG)} + '; path=/'; } catch (e) {}
    new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
            for (var j = 0; j < recs[i].addedNodes.length; j++) {
                var n = recs[i].addedNodes[j];
                if (n.nodeType === 1 && n.getAttribute('data-acn-role') === 'toast') {
                    window.__acn.toasts.push({ at: performance.now(), text: n.textContent });
                }
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true });
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

// Where the target is, relative to where it should be. err > 0: the view is past it.
//   row        the target's data-index;  key  its data-turn-key (the bubble must sit under it)
//   kind       'question': the bubble is measured (centred: the bubble's padding is symmetric, so its
//              centre is the landed user-message node's); 'answer': the landed node is the row itself
//              (ciMessageNodeWithin finds no message node in an October answer row), and "in view"
//              is the visible answer node's
const MEASURE = `(function (a) {
    var sc = document.getElementById('mock-scroll-container');
    var r = sc.getBoundingClientRect();
    var rows = document.querySelectorAll('#mock-feed [data-index="' + a.row + '"]');
    var rowEl = rows.length === 1 ? rows[0] : null;
    var keyed = rowEl ? rowEl.querySelectorAll('[data-turn-key="' + a.key + '"]').length : 0;
    var land = null, seen = null;
    if (rowEl && keyed === 1) {
        if (a.kind === 'question') {
            var b = rowEl.querySelectorAll('[data-turn-key="' + a.key + '"] [data-user-message-bubble="true"]');
            if (b.length === 1) { land = b[0]; seen = b[0]; }
        } else {
            land = rowEl;
            seen = rowEl.querySelector('[data-testid="assistant-message"]');
        }
    }
    var max = sc.scrollHeight - sc.clientHeight;
    var out = { scrollTop: Math.round(sc.scrollTop), max: max, scrollHeight: sc.scrollHeight, rowCount: rows.length,
                keyed: keyed, mounted: !!land, err: null, inView: false, offTop: null,
                resolved: (document.getElementById('acn-zone') || { getAttribute: function () { return null; } }).getAttribute('data-acn-jump-resolved'),
                toasts: window.__acn.toasts.slice(), visible: document.visibilityState };
    if (land && seen) {
        var e = land.getBoundingClientRect();
        var top = e.top - r.top - sc.clientTop + sc.scrollTop;
        var lead = e.height > sc.clientHeight * 0.8 ? 0 : (sc.clientHeight - e.height) / 2;
        var ideal = Math.max(0, Math.min(max, top - lead));
        out.err = Math.round(sc.scrollTop - ideal);
        var s = seen.getBoundingClientRect();
        out.offTop = Math.round(s.top - r.top);
        out.inView = s.height > sc.clientHeight * 0.8
            ? (s.top >= r.top - 1 && s.top <= r.bottom - 20)
            : (s.top >= r.top - 1 && s.bottom <= r.bottom + 1);
    }
    return out;
})`;

// Each run: a fresh page, one start position, one click. checks: the ids it decides.
const RUNS = [
    { id: 'NAV147', checks: ['F1', 'F2', 'F3'], via: 'nav', turn: 147, start: 'top' },
    { id: 'BM147', checks: ['F4'], via: 'bookmark', turn: 147, start: 'top' },
    { id: 'NAV100', checks: ['F5'], via: 'nav', turn: 100, start: 'top', unmounted: true },
    { id: 'NEAR147', checks: ['F6'], via: 'nav', turn: 147, start: 'near' },
    // Q146's answer (row 291, pinned), not the last: from the top no anchor lies below row 293,
    // so Search cannot resolve the last answer among the mounted rows (its activity line keeps the
    // text from matching) and sends it through the jump bridge instead; row 291 sits between two
    // anchored questions and resolves to its own path entry, so its click reaches the far landing.
    { id: 'SEARCH146', checks: ['F7'], via: 'search', turn: 146, start: 'top', answer: true },
];

async function runEngine(engine, opts) {
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    const { payload, truth } = buildPayload();
    const mockConfig = { totalMessages: ROWS, tailRows: 3, answerTestid: true, answerHeaders: true,
                         turnKeys: truth.slice(), perfRow: true, tailAtEnd: true };
    let failures = 0, invalid = 0;
    const lines = [], pageErrors = [];
    const t00 = Date.now();
    function check(id, desc, ok, detail) {
        if (!ok) failures++;
        if (!ok || !opts.quiet) lines.push({ id, text: '  ' + (ok ? 'PASS' : 'FAIL') + '  ' + id + ' ' + desc + (detail ? ' — ' + detail : '') });
    }
    function precondition(id, ok, detail) {
        if (ok) return true;
        invalid++;
        lines.push({ id, text: '  INVALID  ' + id + ' precondition failed' + (detail ? ' — ' + detail : '') });
        return false;
    }

    async function openPage(seed) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        const logs = [], errors = [];
        page.on('console', (m) => logs.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
        const html = buildPage(raw, mockConfig, payload, seed);
        await page.route('**/*', (route) => {
            if (/^https:\/\/claude\.ai\/chat\//.test(route.request().url())) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }).catch(() => {});
            } else route.abort().catch(() => {});
        });
        await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        return { context, page, logs, errors };
    }
    async function ready(page, logs) {
        const t0 = Date.now();
        while (Date.now() - t0 < 30000 && !logs.some((l) => /conversation index ready/.test(l))) await page.waitForTimeout(200);
        await page.waitForTimeout(1500);
        const vis = await page.evaluate('document.visibilityState');
        return { ok: logs.some((l) => /conversation index ready/.test(l)) && vis === 'visible', vis };
    }

    // ── P3: the fixture drifts (its own page: the sweep measures every row) ─────────────────────
    async function driftCheck() {
        const o = await openPage(null);
        await o.page.waitForFunction('!!window.__mockVirtualization', null, { timeout: 30000 });
        const d = await o.page.evaluate(`(function () {
            var c = document.getElementById('mock-scroll-container'), mv = window.__mockVirtualization;
            c.scrollTop = 0; c.dispatchEvent(new Event('scroll'));
            var est = c.scrollHeight, ch = c.clientHeight, steps = 0;
            // Where the pinned tail sits: live, Q147's row is ~200,000 px below the top of a
            // 147-question chat, at the end of the scroll height.
            var t = document.querySelector('#mock-feed [data-index="' + (mv.totalMessages - 2) + '"]');
            var tailTop = t ? Math.round(t.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop) : null;
            // Synchronous steps of half a view: the mock renders on the dispatched scroll event at
            // once, so every row is mounted (measured) on the way down. No timing window.
            while (steps < 20000) {
                steps++;
                var before = c.scrollTop;
                c.scrollTop = before + Math.floor(ch / 2);
                c.dispatchEvent(new Event('scroll'));
                if (c.scrollTop === before && mv.measuredCount() >= mv.totalMessages) break;
            }
            return { est: est, truth: c.scrollHeight, ch: ch, measured: mv.measuredCount(), total: mv.totalMessages, steps: steps, tailTop: tailTop };
        })()`);
        await o.context.close();
        return d;
    }

    async function jumpRun(R) {
        const key = truth[rowOfQ(R.turn) + (R.answer ? 1 : 0)];
        const row = rowOfQ(R.turn) + (R.answer ? 1 : 0);
        let seed = null;
        if (R.via === 'bookmark') {
            seed = {};
            seed[CHAT_URL] = { bookmarks: [{
                id: 'bm_farjump1', schema: 2, entityType: 'user-msg', contentHash: key, msgUuid: key,
                preview: 'Question number ' + R.turn + ': how do I handle case ' + R.turn + ' when the input is unusual?' + SUFFIX,
                msgIndex: R.turn - 1, createdAt: 1792898179730, platform: 'claude.ai',
                pendingHash: null, pendingSender: null, pendingOrdinal: -1, pendingRow: -1 }] };
        }
        const o = await openPage(seed);
        const res = { R, errors: o.errors };
        try {
            const rd = await ready(o.page, o.logs);
            if (!precondition('P1:' + R.id, rd.ok, 'index ready=' + o.logs.some((l) => /conversation index ready/.test(l)) + ' visibility=' + rd.vis)) return res;
            const expect = await o.page.evaluate('window.__mockVirtualization.rowText(' + row + ')');
            if (R.via === 'nav') {
                await o.page.evaluate("document.getElementById('acn-dot-nav').click()");
                let count = null;
                try {
                    await o.page.waitForFunction(`(function () { var s = document.querySelector('[data-acn-role="nav-stat"]');
                        return s && s.getAttribute('data-acn-count') === '${TURNS}'; }())`, null, { timeout: 20000 });
                    count = TURNS;
                } catch (e) {
                    count = await o.page.evaluate("(function(){var s=document.querySelector('[data-acn-role=\"nav-stat\"]');return s&&s.getAttribute('data-acn-count');})()");
                }
                const prefix = expect.slice(0, 24);   // "Question number 147: how" — unique among 147
                const m = await o.page.evaluate((p) => {
                    const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                    const hits = [];
                    for (let i = 0; i < items.length; i++) {
                        const t = (items[i].querySelector('[data-acn-role="nav-item-text"]') || items[i]).textContent.replace(/\s+/g, ' ');
                        if (t.indexOf(p) !== -1) hits.push(i);
                    }
                    return { items: items.length, hits };
                }, prefix);
                if (!precondition('P2:' + R.id, count === TURNS && m.items === TURNS && m.hits.length === 1,
                    'count=' + count + ' items=' + m.items + ' items matching "' + prefix + '"=' + m.hits.length)) return res;
                res.item = m.hits[0];
            } else if (R.via === 'bookmark') {
                await o.page.evaluate("document.getElementById('acn-dot-bookmarks').click()");
                await o.page.waitForTimeout(800);
                const cards = await o.page.evaluate(() => [].map.call(document.querySelectorAll('#acn-panel-bookmarks .acn-bk'),
                    (c) => (c.querySelector('.acn-bk-type') || {}).textContent || null));
                const hits = cards.filter((c) => c === 'Q#' + R.turn).length;
                if (!precondition('P2:' + R.id, cards.length === 1 && hits === 1, 'cards=' + JSON.stringify(cards))) return res;
            } else {
                const query = expect.slice(0, 18);   // "Answer number 146:"
                await o.page.evaluate("document.getElementById('acn-dot-search').click()");
                await o.page.waitForTimeout(500);
                await o.page.evaluate((q) => {
                    const i = document.getElementById('acn-search-input');
                    i.value = q; i.dispatchEvent(new Event('input', { bubbles: true }));
                }, query);
                await o.page.waitForTimeout(1200);
                const items = await o.page.evaluate(() => [].map.call(document.querySelectorAll('#acn-search-list .acn-qi'),
                    (c) => (c.querySelector('.acn-qn') || {}).textContent || null));
                if (!precondition('P2:' + R.id, items.length === 1 && /^A#/.test(items[0] || ''),
                    'query "' + query + '" results=' + JSON.stringify(items))) return res;
            }
            if (R.start === 'near') {
                // Q147's bubble into view, 80 px below the view's top, re-applied until the mock's
                // re-render leaves it there (its window and measurements move with each write).
                for (let k = 0; k < 6; k++) {
                    const st = await o.page.evaluate((a) => {
                        const sc = document.getElementById('mock-scroll-container');
                        const b = document.querySelector('#mock-feed [data-index="' + a.row + '"] [data-user-message-bubble="true"]');
                        if (!b) return null;
                        const off = b.getBoundingClientRect().top - sc.getBoundingClientRect().top;
                        if (Math.abs(off - 80) <= 2) return 'ok';
                        sc.scrollTop = sc.scrollTop + off - 80;
                        return 'moved';
                    }, { row });
                    if (st === 'ok') break;
                    await o.page.waitForTimeout(400);
                }
            } else {
                await o.page.waitForTimeout(300);
            }
            // P4: the start position holds and the target's row is mounted exactly once.
            const pre = await o.page.evaluate(MEASURE + '(' + JSON.stringify({ row, key, kind: R.answer ? 'answer' : 'question' }) + ')');
            const startOk = R.start === 'top' ? pre.scrollTop === 0 : pre.inView;
            const mountOk = R.unmounted ? pre.rowCount === 0 : pre.rowCount === 1 && pre.keyed === 1;
            if (!precondition('P4:' + R.id, startOk && mountOk,
                'start=' + R.start + ' scrollTop=' + pre.scrollTop + ' targetInView=' + pre.inView + ' row ' + row + ' mounted ' + pre.rowCount +
                'x, keyed ' + pre.keyed + 'x (want ' + (R.unmounted ? 'unmounted' : 'mounted once') + ')')) return res;
            res.pre = pre;
            // The trajectory: every frame's scrollTop and scrollHeight for 5 s after the click.
            await o.page.evaluate(() => {
                const sc = document.getElementById('mock-scroll-container');
                const t0 = performance.now();
                window.__traj = [];
                (function f() {
                    window.__traj.push([Math.round(performance.now() - t0), Math.round(sc.scrollTop), sc.scrollHeight]);
                    if (performance.now() - t0 < 5000) requestAnimationFrame(f);
                })();
                document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
                window.__acn.toasts = [];
            });
            if (opts.trace) {
                await o.page.evaluate(() => {
                    const sc = document.getElementById('mock-scroll-container');
                    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
                    const t0 = performance.now();
                    window.__trace = [];
                    Object.defineProperty(sc, 'scrollTop', { configurable: true,
                        get: function () { return d.get.call(this); },
                        set: function (v) {
                            window.__trace.push(Math.round(performance.now() - t0) + 'ms ' + Math.round(d.get.call(this)) + '->' + Math.round(v));
                            d.set.call(this, v);
                        } });
                });
            }
            const t0 = Date.now();
            res.clicked = await o.page.evaluate((a) => {
                let el = null;
                if (a.via === 'nav') el = document.querySelectorAll('[data-acn-role="nav-item"]')[a.item];
                else if (a.via === 'bookmark') el = document.querySelector('#acn-panel-bookmarks .acn-bk');
                else el = document.querySelector('#acn-search-list .acn-qi');
                if (el) el.click();
                return !!el;
            }, { via: R.via, item: res.item });
            await o.page.waitForTimeout(300);
            // Then until the view has been still for 800 ms (cap 10 s).
            let last = null, still = 0;
            for (let k = 0; k < 200 && still < 16; k++) {
                const st = await o.page.evaluate(() => document.getElementById('mock-scroll-container').scrollTop);
                if (st === last) still++; else { still = 0; last = st; }
                await o.page.waitForTimeout(50);
            }
            res.m = await o.page.evaluate(MEASURE + '(' + JSON.stringify({ row, key, kind: R.answer ? 'answer' : 'question' }) + ')');
            res.m.ms = Date.now() - t0;
            const traj = await o.page.evaluate('window.__traj');
            const tops = traj.map((x) => x[1]);
            let moves = 0;
            for (let i = 1; i < tops.length; i++) if (tops[i] !== tops[i - 1]) moves++;
            res.traj = { frames: traj.length, moves, peak: Math.max.apply(null, tops), shStart: traj[0][2], shEnd: traj[traj.length - 1][2],
                         firstMs: traj.length ? (traj.find((x) => x[1] !== traj[0][1]) || [null])[0] : null };
            res.capLines = o.logs.filter((l) => /^\[ACN\] jump: alignment cap/.test(l));
            if (opts.trace) res.trace = await o.page.evaluate('window.__trace');
        } finally {
            await o.context.close();
        }
        return res;
    }

    const desc = (r) => r.m ? ('resolved=' + r.m.resolved + ' toasts=' + JSON.stringify(r.m.toasts.map((t) => t.text)) +
        ' inView=' + r.m.inView + ' err=' + r.m.err + 'px offTop=' + r.m.offTop + 'px scrollTop=' + r.m.scrollTop + '/' + r.m.max +
        ' | glide: ' + r.traj.moves + ' moving frames of ' + r.traj.frames + ', peak ' + r.traj.peak + ', scrollHeight ' + r.traj.shStart + '->' + r.traj.shEnd +
        (r.capLines.length ? ' CAP: ' + r.capLines[0] : '') + ' ' + r.m.ms + 'ms') : 'no measurement';
    const landedAt = (r) => !!r.m && r.clicked && r.m.mounted && r.m.inView && Math.abs(r.m.err) <= 24;

    function judge(r) {
        if (!r.m) return;   // a precondition already reported INVALID
        const want = String(rowOfQ(r.R.turn) + (r.R.answer ? 1 : 0));
        const noToast = r.m.toasts.length === 0;
        const det = desc(r);
        if (r.R.id === 'NAV147') {
            check('F1', '[new] Navigate from the top to Q147 (mounted, pinned tail): its bubble is in view after 800 ms still',
                r.clicked && r.m.mounted && r.m.inView, det);
            check('F2', '[new] the same: at most 24 px from its intended position (centred)',
                r.clicked && r.m.mounted && r.m.err !== null && Math.abs(r.m.err) <= 24, det);
            check('F3', '[guard] the same: data-acn-jump-resolved is ' + want + ', and no toast',
                r.clicked && r.m.resolved === want && noToast, 'resolved=' + r.m.resolved + ' toasts=' + JSON.stringify(r.m.toasts.map((t) => t.text)));
            if (opts.trace && r.trace) lines.push({ id: 'F1t', text: '    trace NAV147: ' + r.trace.join(' | ') });
        } else if (r.R.id === 'BM147') {
            check('F4', '[new] the Q#147 bookmark card from the top lands Q147 (in view, at most 24 px off), no toast',
                landedAt(r) && noToast, det);
        } else if (r.R.id === 'NAV100') {
            check('F5', '[guard] Navigate from the top to Q100 (unmounted, the settle loop) lands it, resolved ' + want + ', no toast',
                landedAt(r) && r.m.resolved === want && noToast, det);
        } else if (r.R.id === 'NEAR147') {
            check('F6', '[guard] Q147 already in view: Navigate lands it (near: the glide as before), resolved ' + want + ', no toast',
                landedAt(r) && r.m.resolved === want && noToast, det + ' (start offTop=' + (r.pre ? r.pre.offTop : '?') + 'px)');
        } else if (r.R.id === 'SEARCH146') {
            check('F7', '[new] Search, Q146\'s answer (row 291, pinned) from the top: in view, its row at its start (taller than the view), no toast',
                landedAt(r) && noToast, det);
        }
    }

    const runs = RUNS.filter((R) => !opts.only || R.checks.some((c) => opts.only.indexOf(c) !== -1));
    console.log('check-claude-far-jump — engine=' + engine + ', script=' + path.basename(scriptPath) + ', -j ' + opts.jobs);

    const drift = await driftCheck();
    // The pinned tail must sit at the END of the scroll height, as live. The mock's default puts
    // it right after the mounted window (it rides along with every scroll), where neither build
    // can land it from the top; the tailAtEnd knob places it after the bottom spacer.
    const driftOk = drift.measured === drift.total && Math.abs(drift.est - drift.truth) > drift.ch &&
                    drift.tailTop !== null && drift.tailTop > drift.est / 2;
    precondition('P3', driftOk, 'estimated ' + drift.est + ' px, true ' + drift.truth + ' px, scroller ' + drift.ch + ' px, measured ' +
        drift.measured + '/' + drift.total + '; from the top, row ' + (ROWS - 2) + ' starts at ' + drift.tailTop + ' px' +
        (drift.tailTop !== null && drift.tailTop <= drift.est / 2 ? ' (the pinned tail follows the window: the mock lacks tailAtEnd)' : ''));
    if (driftOk && !opts.quiet) {
        lines.push({ id: 'P3', text: '  ok    P3 the fixture drifts: estimated ' + drift.est + ' px, true ' + drift.truth + ' px (' +
            (drift.est - drift.truth) + ' px, scroller ' + drift.ch + ' px); row ' + (ROWS - 2) + ' starts at ' + drift.tailTop + ' px' });
    }

    if (driftOk) {
        let next = 0;
        const results = [];
        async function worker() {
            while (next < runs.length) {
                const R = runs[next++];
                try { results.push(await jumpRun(R)); }
                catch (e) { invalid++; lines.push({ id: R.checks[0], text: '  INVALID  ' + R.id + ' threw — ' + (e && e.stack || e) }); }
            }
        }
        await Promise.all(Array.from({ length: Math.min(opts.jobs, runs.length) }, worker));
        results.sort((a, b) => RUNS.indexOf(a.R) - RUNS.indexOf(b.R)).forEach((r) => {
            judge(r);
            r.errors.forEach((e) => pageErrors.push(r.R.id + ': ' + e));
        });
        check('E', 'no page errors in any run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' / '));
    }
    await browser.close();
    const order = (l) => { const m = /^([PFE])(\d*)/.exec(l.id); return m ? ({ P: 0, F: 100, E: 1000 }[m[1]] + (+m[2] || 0)) : 500; };
    lines.sort((a, b) => order(a) - order(b)).forEach((l) => console.log(l.text));
    if (invalid) console.log('\n' + invalid + ' run(s) INVALID: their checks did not run');
    const secs = ((Date.now() - t00) / 1000).toFixed(1);
    console.log(failures || invalid ? '\n' + failures + ' check(s) FAILED (' + engine + ', ' + secs + ' s)' : '\nall checks passed (' + engine + ', ' + secs + ' s)');
    return failures || invalid ? 1 : 0;
}

(async () => {
    const argv = process.argv;
    const arg = (n) => (argv.indexOf(n) !== -1 ? argv[argv.indexOf(n) + 1] : null);
    const b = arg('--browser') || 'chromium';
    const engines = b === 'all' ? ['chromium', 'firefox', 'webkit'] : b.split(',');
    const ALL = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];
    const only = arg('--only') ? arg('--only').split(',') : null;
    if (engines.some((e) => ['chromium', 'firefox', 'webkit'].indexOf(e) === -1)) {
        console.log('INVALID: --browser takes chromium, firefox, webkit or all; got ' + b);
        process.exit(1);
    }
    if (only && (!only.length || only.some((id) => ALL.indexOf(id) === -1))) {
        console.log('INVALID: --only takes check ids from ' + ALL.join(',') + '; got ' + arg('--only'));
        process.exit(1);
    }
    const jobs = arg('-j') !== null ? parseInt(arg('-j'), 10) : 1;
    if (!(jobs >= 1)) { console.log('INVALID: -j takes a positive integer'); process.exit(1); }
    const opts = { quiet: argv.includes('--quiet'), trace: argv.includes('--trace'), only, jobs };
    let code = 0;
    for (const e of engines) code = Math.max(code, await runEngine(e, opts));
    process.exit(code);
})().catch((e) => { console.error(e); process.exit(2); });
