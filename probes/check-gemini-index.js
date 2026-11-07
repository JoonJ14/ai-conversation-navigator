// Gates for v12.19 (DEC-063; the owner's spec docs/specs/v12.19-spec.md): Gemini's full question list
// on open, from Gemini's own history read (hNvQHb, POSTed to batchexecute), its self-check against the
// page, its failure classes, the refresh, jumps that page the DOM toward a question not loaded yet, and
// the "Load full history" button where the index cannot run.
//
// Run: node probes/check-gemini-index.js [--browser chromium|firefox|webkit|all] [--quiet] [--only I1,F2] [--slow]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-gemini-index.js [--proof]
// Exits non-zero on any failed or INVALID check. With --proof (meant for the v12.18 build): exits 0 iff
// every [new] check FAILED, every [guard] check PASSED and nothing was INVALID, and prints the table.
// Every check a fixture registers (its ids) and --only selects must report: one that never did is
// INVALID ("never reported"), so without --only every registered check ran. A proof in which no [new]
// check ran (--only naming nothing that exists, say) proves nothing: "proof: INVALID (no [new] check
// ran)", exit 1 (Tier 3 r1).
// --slow adds I6s, the strike cap (a mismatch that never clears, watched for 330 s beside the rest);
// without it I6s is not run and not reported (the cap is gated by code reading there).
//
// WHAT IS GATED, AND WHERE THE NUMBERS COME FROM.
//   v12.18 lists the loaded part of a Gemini chat (10 of 32 at open) and says older messages are not
//   loaded (DEC-057). v12.19 reads the whole chat from Gemini's own history request on open. Measured
//   live, v12.19 Phase 1 (Chrome page realm, the owner's profile, visible tab, chat 96b519c1, 32
//   questions, 2026-11-05): POST /_/BardChatUi/data/batchexecute?rpcids=hNvQHb with a form body f.req +
//   at and the page's cookies; size 100 lists 32 turns in ONE call, cursor null, 6.2 s; the page's own
//   size-10 pages 1.9-2.9 s; small chats 0.35-0.43 s; `at` is 42 chars (28, ':', 13 digits) in an inline
//   script; a missing or wrong `at` answers 400; credentials omitted answer 200 with a null payload and
//   [7]; the cursor is 145 chars. Phase 0 (G0): fetch returned the payload on Chrome + Tampermonkey
//   5.5.1, Firefox + Tampermonkey 5.5.0 and Safari + Userscripts 4.8.6, so fetch is the one transport and
//   no GM_xmlhttpRequest call is expected. Paging timings: DEC-057 (Chrome + Tampermonkey, v12.16): 10
//   turns a page, each in 1.5-2.9 s, a ~4.6 s render block per page (the mock's blockMs).
//   The mock (tests/mock-pages/gemini-history.html, its header lists what is modelled) serves the read
//   through a route bridge: page.route sends each batchexecute request to the mock's rpc() in the page,
//   so the request takes the real network path and the DOM and the payload come from one model.
//
// CONTRACT ASSERTED HERE (consolidated plan §3 and the button plan §2.6): `data-acn-index-check` on
// #acn-zone ("ok" after a good load: I1; "pending" while nothing is compared, then "ok": I1b; "mismatch":
// I6-I6h, I19; "pending" for the grace, then "mismatch": I6d, I6h, and a sent turn the refresh left out:
// I11f); `[data-acn-role="paging-status"]`
// with data-acn-paging-pages / -loaded true to the page at every change (I12, I12b);
// `[data-acn-role="history-load"]` inside the Navigate panel with
// data-acn-history-load idle | loading, -loaded as its text says, -total "?" (F1, F5); the zone's
// data-acn-history-load-end / -anchor / -restore (F1-F11); data-acn-jump-resolved; the console lines
// "[ACN] index: platform=gemini transport=fetch endpoint=hNvQHb page=N size=S[ retry=at-new|at-same]
// status=C ..." (one per request), "[ACN] paging: platform=gemini via=jump start|end=..." (I12) and
// "[ACN] history: load start|page|load end|view restored ..." (F1, F5; end and restore in F2, F3); no
// token, request body, query string, cursor, question or answer text in the console or storage (I2, I3,
// I12, F1, F5). Landings are asserted by where the target ends (in view, marked resolved), never by
// which landing function ran (the agent's amendment M1, 2026-11-06/07, for the owner's review).
//
// CONTEXT of these results: Playwright, page realm, headless, viewport 1280x720, this machine, the
// userscript inlined into the page; no real userscript manager and no real Gemini. Real-browser
// behaviour on the three managers is the owner's acceptance.
//
// THE PAGING STATUS is watched by a MutationObserver installed at document start (page.addInitScript,
// before any page script): every insertion, removal and change of [data-acn-role="paging-status"] is
// recorded when it happens, with the mock's page count and loaded turns at that moment, so a status
// shown and removed between two timer samples is still seen. "Shown" in a record means connected and
// displayed when the observer ran (the end of the task that changed it).
//
// Proof rule: run v12.18 (git show ab7ea21:ai-conversation-navigator.user.js) with --proof: every check
// marked [new] must FAIL there, for the reason its detail names; [guard] passes on both. A precondition
// that fails (the page hidden, the mock's first page not as expected, no token script) prints INVALID:
// it says the harness, not the build, is wrong. PREMISES: a [guard] that is about the new build's index
// (I13b: the read still loading; I15, I21, I21b: the index ready; I12j: a far landing after the pager)
// asserts that premise on a normal run and FAILS when it does not hold (a guard whose premise is unmet
// tested nothing); under --proof the premise is reported in its detail but not required, because v12.18
// has no index to be loading or ready, and no pager (I12j then asserts nothing: v12.18 lists no Q13).
// Guards by construction (they cannot fail on v12.18, as the spec asks every gate to; the owner is told,
// critic K16): I13, I13b, I15, I16, I21, I21b, R1, R2, E; and I12j, which passes on 546ab49 too (its
// header says why) and fails on a build that toasts twice or never ends the jump.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

// ── Fixture constants ────────────────────────────────────────────────────────────────────────
const C32 = 'aa32aa32aa32aa32', C230 = 'ab23ab23ab23ab23', C20 = 'dd20dd20dd20dd20', C10 = 'bb10bb10bb10bb10', C6 = 'cc06cc06cc06cc06';
// I25's chat: 990 turns, so a full read is 10 pages of 100 (the most under the page cap) and ten of them make
// 100 requests, GM_IX_CALLS_MAX. Synthetic: no chat over 32 turns was measured live.
const C990 = 'ee99ee99ee99ee99';
const CHATS = { [C32]: 32, [C230]: 230, [C20]: 20, [C10]: 10, [C6]: 6, [C990]: 990 };
const PAGE = 10;               // DEC-057: 10 turns a page
const LOAD_DELAY = 2000;       // live 1.5-2.9 s a page (DEC-057, Phase 1)
// Tokens in Phase 1's shape: a 28-char head, ':', a 13-digit ms timestamp (42 chars). Synthetic values.
const AT0 = 'APwZiaHprobeTokenHead0000AAA:1762380000000';
const AT_FRESH = 'BQxYjbKprobeTokenHead1111BBB:1762380123456';
const DECOY = 'DECOYxprobeDECOYxprobeDECOYx:1762380999999';
const EP = 'https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&rt=c';
const CT = 'application/x-www-form-urlencoded;charset=UTF-8';
const BE = '/_/BardChatUi/data/batchexecute';
const KOREAN_Q7 = 'Gemini question 7: 조석 고정을 가장 쉽게 보여 주는 예는 무엇일까요 🌙?';
const KO_STATUS = '이전 메시지를 불러오는 중…';   // the jumps plan's wording (C12)
const ELL = '…';
for (const t of [AT0, AT_FRESH, DECOY]) {
    if (!/^[A-Za-z0-9]{28}:\d{13}$/.test(t)) { console.log('INVALID: a token constant is not in Phase 1\'s shape: ' + t.length); process.exit(1); }
}

function fnv(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
}
const turnId = (chat, n) => fnv(chat + '#' + n) + fnv(n + '@' + chat);   // the mock's turnId()
const GM_TOPICS = ['orbital transfer windows', 'tidal locking of moons', 'the Roche limit', 'gravity assists',
                   'Lagrange points', 'escape velocity', 'atmospheric drag on satellites', 'precession of orbits',
                   'Hohmann transfers', 'the Oberth effect', 'synchronous orbits', 'three-body chaos'];
function gmQuestion(n) {
    const t = GM_TOPICS[(n * 7) % GM_TOPICS.length], u = GM_TOPICS[(n * 5 + 3) % GM_TOPICS.length];
    return 'Gemini question ' + n + ': how would you explain ' + t + ' to someone who already knows ' + u +
           ', and which everyday example makes the difference between them easiest to see?';
}
// A bookmark record exactly as v12.17/v12.18 write one for a Gemini turn (createBookmarkIcon's record,
// schema 2, keyed by the turn's id or id + ':answer').
function bmRecord(id, key, type, createdAt) {
    return { id, schema: 2, entityType: type, contentHash: key, msgUuid: key, preview: 'p', msgIndex: 0,
             createdAt, platform: 'gemini.google.com', pendingHash: null, pendingSender: null,
             pendingOrdinal: -1, pendingRow: -1 };
}
function bmStore(chat, recs) {
    return { 'acn-bookmarks-v1': JSON.stringify({ ['https://gemini.google.com/app/' + chat]: { bookmarks: recs } }) };
}

// ── Page pieces ──────────────────────────────────────────────────────────────────────────────
const DOWNLOAD_SHIM = `<script>
(function () {
    var blobByUrl = {};
    var origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj) { var u = origCreate(obj); blobByUrl[u] = obj; return u; };
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download')) {
            window.__acnTestDownloads = window.__acnTestDownloads || [];
            window.__acnTestDownloads.push({ filename: this.getAttribute('download'), blob: blobByUrl[this.href] || null });
            return;
        }
        return origClick.apply(this, arguments);
    };
}());
</script>`;
const TOAST_SPY = `<script>
window.__acnToasts = [];
new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) for (var j = 0; j < recs[i].addedNodes.length; j++) {
        var n = recs[i].addedNodes[j];
        if (n.nodeType === 1 && n.getAttribute('data-acn-role') === 'toast') window.__acnToasts.push(n.textContent);
    }
}).observe(document.documentElement, { childList: true, subtree: true });
</script>`;
// The paging status, watched by a MutationObserver installed at document start (page.addInitScript):
// each insertion ('insert'), removal ('remove') and change of its text or attributes ('change') is one
// record, taken when the observer runs (the end of the task that made the change), with the mock's
// history loads and loaded turns at that moment. A status shown and removed between two samples of a
// timer is still recorded; a 'change' identical to the record before it is dropped. __pgEver counts
// the records (the fallback probes' "never shows"). __pgNow() reads the status as it is now.
const PG_SPY_INIT = `(function () {
    if (window.__pg) return;
    var pg = window.__pg = { seen: [] };
    window.__pgEver = 0;
    var SEL = '#acn-paging-status, [data-acn-role="paging-status"]';
    function isSt(n) { return !!n && n.nodeType === 1 && (n.id === 'acn-paging-status' || n.getAttribute('data-acn-role') === 'paging-status'); }
    function inside(n) { while (n && n.nodeType === 1) { if (isSt(n)) return n; n = n.parentNode; } return null; }
    function all(n) {
        if (!n || n.nodeType !== 1) return [];
        var out = isSt(n) ? [n] : [];
        return out.concat(Array.prototype.slice.call(n.querySelectorAll(SEL)));
    }
    function shown(e) {
        if (!e.isConnected || e.hidden) return false;
        var cs = getComputedStyle(e);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
    }
    function rec(e, why) {
        var M = window.__mockGemini;
        var s = { why: why, text: e.textContent, pages: e.getAttribute('data-acn-paging-pages'),
                  loaded: e.getAttribute('data-acn-paging-loaded'), shown: shown(e), t: Date.now(),
                  loads: M && M.loads ? M.loads() : -1, domLoaded: M && M.loaded ? M.loaded() : -1 };
        var last = pg.seen[pg.seen.length - 1];
        if (why === 'change' && last && last.text === s.text && last.pages === s.pages &&
            last.loaded === s.loaded && last.shown === s.shown) return;
        pg.seen.push(s);
        window.__pgEver++;
        if (pg.seen.length > 5000) pg.seen.shift();
    }
    new MutationObserver(function (recs) {
        var changed = [], i, j, k, l;
        for (i = 0; i < recs.length; i++) {
            var r = recs[i];
            if (r.type === 'childList') {
                for (j = 0; j < r.addedNodes.length; j++) { l = all(r.addedNodes[j]); for (k = 0; k < l.length; k++) rec(l[k], 'insert'); }
                for (j = 0; j < r.removedNodes.length; j++) { l = all(r.removedNodes[j]); for (k = 0; k < l.length; k++) rec(l[k], 'remove'); }
            }
            var host = inside(r.type === 'characterData' ? r.target.parentNode : r.target);
            if (host && changed.indexOf(host) === -1) changed.push(host);
        }
        for (i = 0; i < changed.length; i++) rec(changed[i], 'change');
    }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true,
                           attributeFilter: ['id', 'data-acn-role', 'data-acn-paging-pages', 'data-acn-paging-loaded', 'hidden', 'style', 'class'] });
    window.__pgNow = function () {
        var e = document.querySelector(SEL);
        if (!e || !shown(e)) return null;
        return { text: e.textContent, pages: e.getAttribute('data-acn-paging-pages'), loaded: e.getAttribute('data-acn-paging-loaded') };
    };
})();`;
// Installed before the userscript, after the mock: the fetch SPY (url, method, sorted init keys,
// headers, signal, body), optionally throwing for the history read; the POST-aware GM shim, which
// answers through the mock's own server, with GM_info's scriptHandler; the GM storage stub.
function harness(o) {
    return `<script>
delete window._aiNavAlreadyLoaded;
(function () {
    window.__fx = [];
    var THROW = ${o.fetchThrow ? 'true' : 'false'};
    var real = window.fetch;
    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : String(input && input.url);
        if (url.indexOf(${JSON.stringify(BE)}) !== -1) {
            var h = init && init.headers;
            window.__fx.push({ url: url, method: (init && init.method) || null, credentials: (init && init.credentials) || null,
                keys: init ? Object.keys(init).sort().join(',') : '', headers: h === undefined ? null : JSON.stringify(h),
                hasSignal: !!(init && init.signal), body: init && typeof init.body === 'string' ? init.body : null,
                bodyType: init && init.body != null ? typeof init.body : 'none', t: Date.now() });
            if (THROW) throw new TypeError('probe: this fetch throws');
        }
        return real.apply(this, arguments);
    };
}());
window.__gmCalls = [];
${o.gm ? `window.GM_xmlhttpRequest = function (opts) {
    window.__gmCalls.push({ method: opts.method || 'GET', url: opts.url, hasData: opts.data != null });
    var r = (window.__mockGemini && String(opts.url || '').indexOf(${JSON.stringify(BE)}) !== -1)
        ? window.__mockGemini.rpc(String(opts.data || ''), opts.url, opts.method || 'GET') : { status: 404, text: '', delayMs: 5 };
    if (r.kind === 'hang') return { abort: function () {} };
    setTimeout(function () {
        if (r.kind === 'abort') { if (opts.onerror) opts.onerror({ status: 0 }); return; }
        if (opts.onload) opts.onload({ status: r.status, responseText: r.text });
    }, r.delayMs || 5);
    return { abort: function () {} };
};
window.GM_info = { scriptHandler: ${JSON.stringify(o.gm)}, version: 'probe' };` : '// no GM_xmlhttpRequest here'}
var _s = ${JSON.stringify(o.store || {})};
window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
window.GM_setValue = function (k, v) { _s[k] = v; };
window.__acnStore = function () { return _s; };
</script>`;
}
function buildPage(raw, cfg, o) {
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages/gemini-history.html'), 'utf8');
    const body = (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock;
    const head = (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(cfg)};</script>
${DOWNLOAD_SHIM}${TOAST_SPY}
${body}
${harness(o)}
<script>${raw}</script></body></html>`;
}

// ── In-page readers ──────────────────────────────────────────────────────────────────────────
const NAV = `(function () {
    var s = document.querySelector('[data-acn-role="nav-stat"]');
    var p = document.getElementById('acn-panel-nav');
    var L = document.getElementById('acn-nav-list');
    var b = L ? L.querySelector('[data-acn-index-status]') : null;
    var btn = document.querySelector('[data-acn-role="history-load"]');
    var z = document.getElementById('acn-zone');
    var sc = document.querySelector('infinite-scroller.chat-history');
    var M = window.__mockGemini;
    var za = function (k) { return z ? z.getAttribute(k) : null; };
    var hist = document.getElementById('acn-ctx-hist');
    return {
        open: !!(p && p.classList.contains('acn-open')),
        count: s ? s.getAttribute('data-acn-count') : null,
        note: !!(L && L.querySelector('[data-acn-history="partial"]')),
        banner: b ? b.getAttribute('data-acn-index-status') : null,
        bannerText: b ? b.textContent : null,
        labels: L ? Array.prototype.map.call(L.querySelectorAll('[data-acn-role="nav-item"] .acn-qn'), function (e) { return e.textContent; }) : [],
        items: L ? Array.prototype.map.call(L.querySelectorAll('[data-acn-role="nav-item-text"]'), function (e) { return e.textContent; }) : [],
        button: btn ? { state: btn.getAttribute('data-acn-history-load'), loaded: btn.getAttribute('data-acn-history-loaded'),
                        total: btn.getAttribute('data-acn-history-total'), text: btn.textContent, inNav: !!(p && p.contains(btn)) } : null,
        check: za('data-acn-index-check'), loadEnd: za('data-acn-history-load-end'), anchor: za('data-acn-history-anchor'),
        restore: za('data-acn-history-restore'), resolved: za('data-acn-jump-resolved'),
        hist: hist ? hist.textContent : null,
        loaded: M ? M.loaded() : -1, loads: M ? M.loads() : -1, pending: M ? M.pending() : null,
        triggers: M && M.topTriggers ? M.topTriggers() : -1,
        st: sc ? Math.round(sc.scrollTop) : null, max: sc ? sc.scrollHeight - sc.clientHeight : null,
        toasts: (window.__acnToasts || []).slice(), status: window.__pgNow ? window.__pgNow() : null,
        vis: document.visibilityState
    };
})()`;
// Where turn n's question bubble (or answer) sits against the scroller's view.
const SPOT = `(function (n, what) {
    var sc = document.querySelector('infinite-scroller.chat-history');
    var t = document.getElementById(window.__mockGemini.domId(n));
    var el = t && (what === 'answer' ? t.querySelector('.response-content') : t.querySelector('div.query-text'));
    var r = sc.getBoundingClientRect();
    var mark = document.querySelector('[data-acn-jump-target]');
    var out = { n: n, what: what, mounted: !!el, inView: false, st: Math.round(sc.scrollTop), loaded: window.__mockGemini.loaded(),
                loads: window.__mockGemini.loads(), toasts: (window.__acnToasts || []).slice(),
                resolved: (document.getElementById('acn-zone') || { getAttribute: function () { return null; } }).getAttribute('data-acn-jump-resolved'),
                markIn: !!(mark && t && t.contains(mark)), mark: !!mark };
    if (el) {
        var q = el.getBoundingClientRect(), tall = q.height > sc.clientHeight * 0.8;
        out.top = Math.round(q.top - r.top); out.h = Math.round(q.height);
        out.inView = tall ? (q.top >= r.top - 2 && q.top <= r.bottom - 20) : (q.top >= r.top - 2 && q.bottom <= r.bottom + 2);
    }
    return out;
})`;
// The turn the view is on, by the button's anchor rule (gmViewAnchor): the first scroller turn with a
// 16-hex id whose bottom is below the view's top, and its top's offset from that top.
const ANCHOR = `(function () {
    var sc = document.querySelector('infinite-scroller.chat-history');
    var top = sc.getBoundingClientRect().top + sc.clientTop;
    var t = sc.querySelectorAll(':scope > div.conversation-container');
    for (var i = 0; i < t.length; i++) {
        var r = t[i].getBoundingClientRect();
        if (r.bottom > top && /^[0-9a-f]{16}$/.test(t[i].id || '')) return { id: t[i].id, offset: Math.round(r.top - top) };
    }
    return null;
})()`;
const ANCHOR_ERR = `(function (a) {
    var sc = document.querySelector('infinite-scroller.chat-history');
    var t = document.getElementById(a.id);
    if (!t) return null;
    return Math.round(t.getBoundingClientRect().top - (sc.getBoundingClientRect().top + sc.clientTop) - a.offset);
})`;
const STORAGE_DUMP = `(function () {
    var ls = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch (e) {}
    return JSON.stringify({ gm: window.__acnStore ? window.__acnStore() : null, ls: ls });
})()`;
// The context meter's dots and basis (as check-context-meter.js reads them).
const CTX = `(function () {
    var dotsEl = document.getElementById('acn-ctx-dots');
    var dots = dotsEl ? Array.prototype.map.call(dotsEl.children, function (d) {
        var c = getComputedStyle(d).backgroundColor;
        return c === 'rgb(34, 197, 94)' ? 'G' : c === 'rgb(234, 179, 8)' ? 'Y' : c === 'rgb(239, 68, 68)' ? 'R' : '?';
    }).join('') : '';
    var pct = document.getElementById('acn-ctx-pct');
    return { dots: dots, basis: dotsEl ? dotsEl.getAttribute('data-acn-dot-basis') : null,
             tokens: pct ? pct.getAttribute('data-acn-ctx-tokens') : null,
             hist: (document.getElementById('acn-ctx-hist') || {}).textContent || null };
})()`;

// In-page helpers (feature-gaps' __h, plus the gallery's thumbnail srcs and an open-only bookmarks read).
const HELPERS = `(function () {
    var S = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    window.__h = {
        search: async function (w) {
            document.getElementById('acn-dot-search').click(); await S(300);
            var inp = document.getElementById('acn-search-input');
            inp.value = w; inp.dispatchEvent(new Event('input', { bubbles: true })); await S(900);
            var L = document.getElementById('acn-search-list');
            return { labels: Array.prototype.map.call(L.querySelectorAll('.acn-qi'), function (i) { return i.querySelector('.acn-qn').textContent; }),
                     note: !!L.querySelector('[data-acn-history="partial"]'), text: L.textContent.slice(0, 200) };
        },
        clickSearch: async function (w, label) {
            await window.__h.search(w);
            var it = Array.prototype.find.call(document.querySelectorAll('#acn-search-list .acn-qi'),
                function (i) { return i.querySelector('.acn-qn').textContent === label; });
            document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
            window.__acnToasts.length = 0;
            if (!it) return false;
            it.click(); return true;
        },
        exportFull: async function () {
            window.__acnTestDownloads = [];
            document.getElementById('acn-dot-tools').click(); await S(400);
            document.querySelectorAll('[data-acn-role="tool-export"]')[0].click(); await S(600);
            var d = (window.__acnTestDownloads || [])[0];
            return d && d.blob ? await d.blob.text() : null;
        },
        summary: async function () {
            document.getElementById('acn-dot-summary').click(); await S(300);
            document.querySelector('[data-acn-role="sum-generate"]').click(); await S(2500);
            var R = document.querySelector('[data-acn-role="sum-results"]');
            return { text: R ? R.innerText || '' : '', note: !!(R && R.querySelector('[data-acn-history="partial"]')) };
        },
        clickSegment: function (re) {
            var R = document.querySelector('[data-acn-role="sum-results"]');
            var segs = Array.prototype.filter.call(R.querySelectorAll('*'), function (e) {
                return new RegExp(re).test(e.textContent) && e.children.length < 6; });
            var seg = segs[segs.length - 1];
            document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
            window.__acnToasts.length = 0;
            if (!seg) return 'no match';
            seg.click(); return seg.className + ': ' + seg.textContent.slice(0, 40);
        },
        gallery: async function () {
            document.getElementById('acn-dot-nav').click(); await S(200);
            document.getElementById('acn-dot-tools').click(); await S(500);
            var G = document.getElementById('acn-gallery-section');
            return { header: (G.querySelector('.acn-tool-section-header') || {}).textContent || '',
                     note: !!G.querySelector('[data-acn-history="partial"]'),
                     cards: Array.prototype.map.call(G.querySelectorAll('.acn-gallery-card'), function (c) {
                         var im = c.querySelector('img.acn-gallery-thumb');
                         return { label: (c.querySelector('.acn-gallery-label') || {}).textContent || null, src: im ? im.getAttribute('src') : null }; }) };
        },
        clickGallery: function (i) {
            var cards = document.querySelectorAll('#acn-gallery-section .acn-gallery-card');
            document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
            window.__acnToasts.length = 0;
            if (!cards[i]) return false;
            (cards[i].querySelector('[data-acn-role="gallery-go"]') || cards[i].querySelector('.acn-gallery-btn')).click();
            return true;
        },
        bmLabels: async function () {
            var P = document.getElementById('acn-panel-bookmarks');
            if (!P || !P.classList.contains('acn-open')) { document.getElementById('acn-dot-bookmarks').click(); await S(400); }
            return Array.prototype.map.call(document.querySelectorAll('#acn-panel-bookmarks .acn-bk'), function (c) {
                return (c.querySelector('.acn-bk-type') || {}).textContent || ''; });
        },
        clickBookmark: async function (label) {
            var P = document.getElementById('acn-panel-bookmarks');
            if (!P || !P.classList.contains('acn-open')) { document.getElementById('acn-dot-bookmarks').click(); await S(400); }
            var c = Array.prototype.find.call(document.querySelectorAll('#acn-panel-bookmarks .acn-bk'), function (c) {
                return (c.querySelector('.acn-bk-type') || {}).textContent === label; });
            document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
            window.__acnToasts.length = 0;
            if (!c) return false;
            c.click(); return true;
        }
    };
}())`;

// The export's headings alternate Q#1, A#1, ... Q#n, A#n, each body under its own heading: a question
// reads "question N", an answer starts "Answer N," (Gemini's mock answers read "Answer N, part 1:").
function exportOrder(f, n) {
    const h = (f.match(/^## (User \(Q#\d+\)|Assistant \(A#\d+\))/gm) || []);
    let ok = h.length === 2 * n;
    for (let i = 0; ok && i < n; i++) {
        ok = h[2 * i] === '## User (Q#' + (i + 1) + ')' && h[2 * i + 1] === '## Assistant (A#' + (i + 1) + ')';
    }
    const parts = f.split(/^## /m).slice(1);
    for (let i = 0; ok && i < n; i++) {
        const qb = parts[2 * i] || '', ab = parts[2 * i + 1] || '';
        ok = new RegExp('question ' + (i + 1) + '\\b').test(qb) && new RegExp('\\n\\s*Answer ' + (i + 1) + '[,:]').test(ab);
    }
    return { ok, count: h.length };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inOrder = (items, n, override) => items.length === n &&
    items.every((t, i) => (override && override[i + 1]) ? t === override[i + 1] : t.indexOf('Gemini question ' + (i + 1) + ':') === 0);
const qLabels = (labels, n) => labels.length === n && labels.every((l, i) => l === 'Q#' + (i + 1));
// One request line, as ixLog writes it for Gemini (consolidated plan §3).
const REQ_RE = /^\[ACN\] index: platform=gemini transport=(\S+) endpoint=hNvQHb page=(\d+) size=(\d+)( retry=at-(?:new|same))? status=(\d+)/;
const PERM_RE = /index failure looks PERMANENT/;

// ── The runner ───────────────────────────────────────────────────────────────────────────────
async function runEngine(engine, raw, header, only, quiet, proof, slow) {
    const t00 = Date.now();
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    const results = [];          // { id, label, result: 'PASS' | 'FAIL' | 'INVALID', desc }
    const pageErrors = [];
    const allHits = [];          // every batchexecute request of every fixture (R1)
    const allOthers = [];        // every other request (R1)
    const want = (id) => !only || only.some((o) => id === o || id.indexOf(o) === 0);
    // Every check id a fixture declares, and the two reported outside one: each that --only selects must
    // report by the end of the run, or it is INVALID (never reported).
    const registered = new Set(['R1', 'E']);

    // Each fixture writes into its own record, flushed in a fixed order, so fixtures can share a
    // window of real time (the 20 s "no second call" windows) without interleaving their output.
    function makeRec() {
        const r = { lines: [], res: [] };
        r.check = (id, label, desc, ok, detail) => {
            r.res.push({ id, label, result: ok ? 'PASS' : 'FAIL', desc });
            r.lines.push({ pass: !!ok, text: '  ' + (ok ? 'PASS' : 'FAIL') + '  ' + id + ' [' + label + '] ' + desc + (detail ? ' — ' + detail : '') });
        };
        r.bad = (id, why) => {
            r.res.push({ id, label: '?', result: 'INVALID', desc: why });
            r.lines.push({ pass: false, text: '  INVALID  ' + id + ' ' + why });
        };
        return r;
    }
    function flush(r) {
        for (const l of r.lines) if (!l.pass || !quiet) console.log(l.text);
        for (const x of r.res) results.push(x);
    }
    // A fixture: the check ids it reports, and its body. A harness exception reports its ids INVALID.
    function fixture(ids, fn) {
        for (const id of ids) registered.add(id);
        return async () => {
            const r = makeRec();
            if (!ids.some(want)) return r;
            try { await fn(r); }
            catch (e) {
                const done = new Set(r.res.map((x) => x.id));
                for (const id of ids) if (!done.has(id) && want(id)) r.bad(id, 'harness threw: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
            }
            return r;
        };
    }
    async function seq(fx) { flush(await fx()); }
    async function par(list) { const rs = await Promise.all(list.map((f) => f())); rs.forEach(flush); }

    function rpcIdOf(post) {
        try {
            const p = new URLSearchParams(post);
            const fr = JSON.parse(p.get('f.req'));
            return fr[0][0][0];
        } catch (e) { return null; }
    }

    // A fresh page on `chat` with the userscript inlined. cfgExtra: the mock's config (rpc merged over
    // the defaults: token AT0, decoy global DECOY, mode 'ok'; rpc: null = no server, no token). o: { path,
    // host, gm: scriptHandler (installs the POST-aware GM shim), fetchThrow, store, noWait (skip the
    // first-page and scroll preconditions), first (expected first-page count) }. Null when a
    // precondition fails (every id in `ids` reported INVALID).
    async function open(r, ids, chat, cfgExtra, o) {
        o = o || {};
        cfgExtra = cfgExtra || {};
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        const host = o.host || 'https://gemini.google.com';
        const url = host + (o.path || ('/app/' + chat));
        const cfg = Object.assign({ chats: CHATS, page: PAGE, loadDelayMs: LOAD_DELAY, anchor: true }, cfgExtra);
        if (cfgExtra.rpc === null) delete cfg.rpc;
        else cfg.rpc = Object.assign({ at: AT0, decoyAt: DECOY, freshAt: AT_FRESH, mode: 'ok' }, cfgExtra.rpc || {});
        const html = buildPage(raw, cfg, o);
        const h = { id: ids[0], page, context, url, cfg, logs: [], notes: [], errors: [], hits: [], fulfilled: 0, others: [] };
        // h.logs: what the page's scripts wrote (the userscript among them), every line the leak scan reads.
        // WebKit writes a console line of its own for each request this harness aborts ("Web Inspector
        // blocked <the request's URL> from loading", type info, no source location), which names the
        // request's query string ("rpcids=", one of noLeak's needles) though no script wrote it: kept apart
        // in h.notes (review round 1: I26 failed on every webkit run for that line alone, macOS, Playwright
        // headless, 2026-11-07). A page script's line always carries its script's location, so one the
        // userscript writes in those words still lands in h.logs. Chromium and Firefox write no such line
        // with the URL in its text (chromium's "Failed to load resource" names it only in its location).
        page.on('console', (m) => {
            const t = m.text(), loc = m.location() || {};
            if (!loc.url && /^Web Inspector blocked \S+ from loading$/.test(t)) { h.notes.push(t); return; }
            h.logs.push(t);
        });
        page.on('pageerror', (e) => { const s = ids[0] + ': ' + String(e && e.message || e); pageErrors.push(s); h.errors.push(s); });
        await page.addInitScript(PG_SPY_INIT);     // the paging-status observer, before any page script
        await page.route('**/*', async (route) => {
            const req = route.request(), u = req.url();
            if (/^(blob|data):/.test(u)) { route.continue().catch(() => {}); return; }
            if (u === url) { route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }).catch(() => {}); return; }
            if (u.indexOf(BE) !== -1) {
                const post = req.postData() || '';
                const hit = { url: u, method: req.method(), rpc: rpcIdOf(post), t: Date.now() };
                h.hits.push(hit);
                allHits.push(Object.assign({ fixture: ids[0] }, hit));
                let a;
                try {
                    a = await page.evaluate(([b, uu, m]) => (window.__mockGemini && window.__mockGemini.rpc)
                        ? window.__mockGemini.rpc(b, uu, m) : { kind: 'abort' }, [post, u, req.method()]);
                } catch (e) { a = { kind: 'abort' }; }
                if (a.kind === 'hang') return;
                if (a.kind === 'abort') { route.abort().catch(() => {}); return; }
                setTimeout(() => {
                    h.fulfilled++;
                    route.fulfill({ status: a.status, contentType: 'application/json; charset=utf-8', body: a.text }).catch(() => {});
                }, a.delayMs || 0);
                return;
            }
            // The browser's own favicon request is not the script's (R1 counts only what the page asks for).
            if (!/\/favicon\.ico$/.test(u)) { h.others.push(u); allOthers.push(ids[0] + ': ' + u); }
            route.abort().catch(() => {});
        });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        const first = typeof o.first === 'number' ? o.first : Math.min(PAGE, CHATS[chat]);
        if (!o.noWait) {
            try { await page.waitForFunction('window.__mockGemini && window.__mockGemini.loaded() === ' + first, null,
                                             { timeout: (cfg.firstDelayMs || 200) + 15000 }); } catch (e) {}
        }
        try { await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 }); } catch (e) {}
        const pre = await page.evaluate(() => ({
            vis: document.visibilityState,
            loaded: window.__mockGemini ? window.__mockGemini.loaded() : -1,
            dot: !!document.getElementById('acn-dot-nav'),
            st: (document.querySelector('infinite-scroller.chat-history') || {}).scrollTop,
            token: Array.prototype.some.call(document.querySelectorAll('script:not([src])'),
                function (s) { return /"SNlM0e"\s*:\s*"[^"]{8,}"/.test(s.textContent || ''); })
        }));
        const wantToken = !!cfg.rpc && !cfg.rpc.noToken;
        if (pre.vis !== 'visible' || !pre.dot || (!o.noWait && (pre.loaded !== first || !(pre.st > 50))) || pre.token !== wantToken) {
            for (const id of ids) if (want(id)) r.bad(id, 'precondition: visibility=' + pre.vis + ' loaded=' + pre.loaded + ' (want ' + first + ') dot=' +
                                                      pre.dot + ' scrollTop=' + pre.st + ' token script=' + pre.token + ' (want ' + wantToken + ')');
            await context.close().catch(() => {});
            return null;
        }
        await page.evaluate(HELPERS);
        h.nav = () => page.evaluate(NAV);
        h.openNav = async () => { if (!(await h.nav()).open) await page.evaluate("document.getElementById('acn-dot-nav').click()"); };
        // Polls Navigate's state until pred holds or ms pass; returns the last read.
        h.until = async (pred, ms, step) => {
            const t0 = Date.now();
            for (;;) {
                const v = await h.nav();
                if (pred(v) || Date.now() - t0 > ms) return v;
                await sleep(step || 200);
            }
        };
        h.waitReady = (n, ms) => h.until((v) => v.count === String(n) || v.banner === 'degraded', ms);
        h.waitDegraded = (ms) => h.until((v) => v.banner === 'degraded', ms);
        h.calls = () => page.evaluate(() => window.__mockGemini.calls());
        h.fx = () => page.evaluate(() => window.__fx.slice());
        h.gmc = () => page.evaluate(() => window.__gmCalls.slice());
        h.lines = (re) => h.logs.filter((l) => re.test(l));
        h.req = () => h.logs.filter((l) => REQ_RE.test(l));
        h.spot = (n, what) => page.evaluate(SPOT + '(' + n + ',' + JSON.stringify(what || 'q') + ')');
        h.pgSeen = () => page.evaluate(() => window.__pg.seen.slice());
        h.storage = () => page.evaluate(STORAGE_DUMP);
        // Navigate's row for turn n, by its TEXT (so v12.18's Q23-first list reports "no row" rather than
        // clicking another question). Clears the previous resolution and toasts first.
        h.clickQ = (n) => page.evaluate((n) => {
            var rows = document.querySelectorAll('#acn-nav-list [data-acn-role="nav-item"]');
            for (var i = 0; i < rows.length; i++) {
                var t = rows[i].querySelector('[data-acn-role="nav-item-text"]');
                if (t && t.textContent.indexOf('Gemini question ' + n + ':') !== -1) {
                    var z = document.getElementById('acn-zone');
                    if (z) z.removeAttribute('data-acn-jump-resolved');
                    window.__acnToasts.length = 0;
                    rows[i].click();
                    return (rows[i].querySelector('.acn-qn') || {}).textContent || '?';
                }
            }
            return null;
        }, n);
        // A user's own scroll: a TRUSTED wheel over the scroller, away from the panel (the mock's
        // userScroll() is untrusted, which ixWatchUser ignores by design).
        h.wheel = async (dy) => { await page.mouse.move(200, 360); await page.mouse.wheel(0, dy); };
        // The jump or load is over: the view still, nothing pending, no paging status, for 1.5 s.
        h.settle = async (cap, min) => {
            const t0 = Date.now();
            let last = null, since = Date.now();
            while (Date.now() - t0 < (cap || 60000)) {
                const s = await page.evaluate(() => {
                    var sc = document.querySelector('infinite-scroller.chat-history');
                    return { st: sc ? Math.round(sc.scrollTop) : null, p: window.__mockGemini.pending(), s: !!window.__pgNow() };
                });
                const k = s.st + '|' + s.p + '|' + s.s;
                if (k !== last || s.p || s.s) { last = k; since = Date.now(); }
                if (Date.now() - t0 >= (min || 1500) && Date.now() - since >= 1500) return true;
                await sleep(100);
            }
            return false;
        };
        h.close = () => context.close().catch(() => {});
        return h;
    }
    const fmt = (v) => 'count=' + v.count + ' banner=' + v.banner + ' note=' + v.note + ' button=' +
        (v.button ? v.button.state + '/"' + v.button.text + '"' : 'none') + ' check=' + v.check + ' loaded=' + v.loaded + ' loads=' + v.loads;
    const callsBrief = (c) => 'calls full=' + c.full + ' next=' + c.next + ' newest=' + c.newest + ' other=' + c.other;
    // A guard's premise about the new build's index (see PREMISES in the header): required on a normal
    // run, reported only under --proof (v12.18 has no index).
    const premise = (ok) => proof || ok;
    const premiseNote = (name, ok) => 'premise (' + name + ')=' + ok + (proof && !ok ? ' [not required under --proof]' : '');
    // The index is ready: all 32 listed with nothing paged in, and not degraded.
    const ready32 = (v) => v.count === '32' && v.loads === 0 && v.banner !== 'degraded';
    // Nothing secret or private in the console or storage: the tokens, the request's body key and query
    // string, the token's key, a question's text, and an answer's text (every mock answer's paragraphs
    // share "the short version is that the motion is set by"; answer 2 names "quokka" where a fixture
    // asks for it).
    const noLeak = (texts, extra) => {
        const needles = [AT0, AT0.slice(0, 28), AT_FRESH.slice(0, 28), DECOY, DECOY.slice(0, 28), 'f.req', 'SNlM0e', 'rpcids=', 'Gemini question',
                         'the short version is that the motion', 'quokka'].concat(extra || []);
        const hits = [];
        for (const t of texts) for (const n of needles) if (n && t.indexOf(n) !== -1) hits.push(n.slice(0, 12) + '… in "' + t.slice(0, 50) + '"');
        return hits;
    };

    // What a degraded Gemini index must show (spec: the v12.18 behaviour and the note): the banner,
    // the loaded part listed (10 rows, Q23 first), the "older messages" note and the idle button.
    const v1218 = (v) => v.banner === 'degraded' && v.count === '10' && /^Gemini question 23:/.test(v.items[0] || '') && v.note &&
                         !!v.button && v.button.state === 'idle' && v.button.text === 'Load full history';

    // ── I22: a read that never answers in time (the server takes 47 s; CI_FETCH_TIMEOUT_MS is 45 s) ──
    // Started here and run beside every fixture below (its 3-minute window is idle but for the reads it
    // counts), flushed before R1. A timed-out read was still sent and still downloads in full, so it must
    // cost a strike and the backoff: the first read, its timeout PERMANENT "next retry in 60s", at most
    // ONE more read in 3 minutes. The adapter commit's transient timeout read every ~45 s (5 reads in
    // 200 s, the reviewer's run of this harness, chromium); v12.18 sends none (fails "a first read").
    const i22Run = fixture(['I22'], async (r) => {
        const WIN = 180000;
        const h = await open(r, ['I22'], C32, { rpc: { delayMs: { full: 47000 } } });
        if (!h) return;
        await h.openNav();
        try { await h.page.waitForFunction(() => window.__mockGemini.calls().list.length >= 1, null, { timeout: 15000 }); } catch (e) {}
        const first = h.hits.length ? h.hits[0].t : Date.now();
        await sleep(Math.max(0, first + WIN - Date.now()));
        const v = await h.nav();
        const reads = h.hits.filter((x) => x.t - first <= WIN).map((x) => Math.round((x.t - first) / 1000));
        const tl = h.req().filter((l) => / status=0 error=timeout\b/.test(l));
        const perm = h.lines(PERM_RE).filter((l) => /\[fetch\] timeout/.test(l));
        // Each timed-out read is a strike of the chat visit (review round 1: the header promised the strike and
        // asserted only the backoff): one "load failed — strike k of 5" line per timeout, k counting from 1.
        const strikes = h.lines(/load failed . strike \d of 5/).map((l) => (l.match(/strike \d of 5/) || [''])[0]);
        const strikesOk = strikes.length === tl.length && strikes.every((s, i) => s === 'strike ' + (i + 1) + ' of 5');
        const leaks = noLeak(h.logs.concat([await h.storage()]));
        r.check('I22', 'new', 'a read that times out (the server answers in 47 s): a first read, its timeout logged "status=0 error=timeout" ' +
                'and PERMANENT ("next retry in 60s"), each timeout a strike ("strike 1 of 5", then 2), at most 2 reads in 3 minutes, ' +
                'degraded naming the timeout; nothing leaked',
                reads.length >= 1 && reads.length <= 2 && tl.length >= 1 && perm.some((l) => /next retry in 60s/.test(l)) && strikesOk &&
                v.banner === 'degraded' && /timeout/.test(v.bannerText || '') && leaks.length === 0,
                'reads at s=' + JSON.stringify(reads) + ' (all ' + h.hits.length + ', answered ' + h.fulfilled + ') timeout lines=' + tl.length +
                ' strikes=' + JSON.stringify(strikes) +
                ' permanent=' + JSON.stringify(perm.map((l) => (l.match(/next retry in \d+s/) || [''])[0])) + ' ' + fmt(v) +
                ' bannerText=' + JSON.stringify(v.bannerText) + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
        await h.close();
    })();

    // ── I23: a refused read (403) and its PERMANENT backoff, beside every fixture below (Tier 3 r1) ──
    // Started here and flushed before R1, as I22. check-gemini-history's H0 counts reads only while its
    // fixtures are open, and none stays open to the 60 s backoff's end, so a shorter backoff passed it.
    // Here the page stays open 75 s after its first read: exactly one read before 58 s, then exactly one
    // between 58 and 75 s (the 60 s backoff, the rescan 1 s after it, one read; the next waits 240 s), the
    // first refusal logged PERMANENT "next retry in 60s". The 2 s under 60 is H0's own margin, for the time
    // between a load's start (where the backoff is counted from) and its request reaching the route.
    // v12.18 sends none (fails "a first read").
    const i23Run = fixture(['I23'], async (r) => {
        const WIN = 75000, GATE = 58000;
        const h = await open(r, ['I23'], C32, { rpc: { mode: 'refuse' } });
        if (!h) return;
        await h.openNav();
        try { await h.page.waitForFunction(() => window.__mockGemini.calls().list.length >= 1, null, { timeout: 15000 }); } catch (e) {}
        const first = h.hits.length ? h.hits[0].t : Date.now();
        await sleep(Math.max(0, first + WIN - Date.now()));
        const v = await h.nav();
        const at = h.hits.map((x) => x.t - first);
        const before = at.filter((t) => t < GATE).length, between = at.filter((t) => t >= GATE && t <= WIN).length;
        const perm = h.lines(PERM_RE).map((l) => (l.match(/next retry in \d+s/) || ['?'])[0]);
        r.check('I23', 'new', 'a read refused 403 (PERMANENT), the page open 75 s after its first read: exactly one read before 58 s, ' +
                'then exactly one between 58 and 75 s (the 60 s backoff, then one read), the first refusal "next retry in 60s", degraded',
                h.hits.length >= 1 && before === 1 && between === 1 && perm[0] === 'next retry in 60s' && v.banner === 'degraded',
                'reads at s=' + JSON.stringify(at.map((t) => Math.round(t / 100) / 10)) + ' (before 58 s: ' + before + ', 58-75 s: ' + between +
                ') permanent=' + JSON.stringify(perm) + ' ' + fmt(v));
        await h.close();
    })();

    // ── I3c: the page cap, FINAL for the chat visit, beside every fixture below (review round 1) ─────
    // A history with no end (rpc.endless: every page a fresh cursor): the full load stops at GM_IX_MAX_PAGES
    // (10 reads, 1,000 turns) and degrades. Never the truncated note: newest-first paging would list the
    // newest 1,000 as if the chat began there. The chat only grows, so the cap is final for the visit: the
    // retry after the 60 s backoff ends at once with no read ("next retry in 240s"), and the loaded part
    // stays listed with the note and the idle button. a85ab2f read the same 10 pages again at every
    // backoff (this fixture on it: 20 reads, the second 10 at 65-69 s; up to 100 per visit by its
    // backstop; Playwright chromium, 2026-11-07). Watched until the retry's PERMANENT line, then 8 s more (the old
    // retry's 10 reads take ~5 s here); flushed before R1. v12.18 sends none (fails "10 reads").
    const i3cRun = fixture(['I3c'], async (r) => {
        const h = await open(r, ['I3c'], C32, { rpc: { endless: true, heavyChars: 10 } });
        if (!h) return;
        await h.openNav();
        try { await h.page.waitForFunction(() => window.__mockGemini.calls().list.length >= 1, null, { timeout: 15000 }); } catch (e) {}
        const first = h.hits.length ? h.hits[0].t : Date.now();
        const v0 = await h.waitDegraded(30000);
        const capLines = () => h.lines(PERM_RE).filter((l) => /the page cap/.test(l));
        while (capLines().length < 2 && Date.now() - first < 110000) await sleep(500);
        await sleep(8000);
        await h.openNav();
        const v = await h.nav();
        const c = await h.calls();
        const perm = capLines().map((l) => (l.match(/next retry in \d+s/) || ['?'])[0]);
        const at = h.hits.map((x) => Math.round((x.t - first) / 1000));
        r.check('I3c', 'new', 'a history whose every page carries a fresh cursor: exactly 10 reads in the visit (one full, 9 by cursor, ' +
                'one line each), degraded "longer than 1000 turns (the page cap)", PERMANENT, never the truncated note; the retry ' +
                'after the 60 s backoff ends at once with no read ("next retry in 60s", then "240s"); the loaded part listed with ' +
                'the note and the idle button',
                v0.banner === 'degraded' && /longer than 1000 turns \(the page cap\)/.test(v.bannerText || '') &&
                !/only the first/.test(v.bannerText || '') && c.list.length === 10 && c.full === 1 && c.next === 9 &&
                h.hits.length === 10 && h.req().length === 10 && JSON.stringify(perm) === '["next retry in 60s","next retry in 240s"]' &&
                v.count === '10' && v.note && !!v.button && v.button.state === 'idle',
                fmt(v) + ' ' + callsBrief(c) + ' hits=' + h.hits.length + ' at s=' + JSON.stringify(at) + ' lines=' + h.req().length +
                ' permanent=' + JSON.stringify(perm) + ' bannerText=' + JSON.stringify(v.bannerText));
        await h.close();
    })();

    // ── I24: a refresh that fails PERMANENTLY drops the index, beside every fixture below (review round 1) ──
    // The index ready, then the server answers every read with a null payload and code [7] (the session,
    // PERMANENT), and the user sends one message: its id's refresh fails, and the index is DROPPED as a
    // failed full load drops it: degraded, the v12.18 DOM list (the 10 loaded turns and the sent question,
    // listed by the page's own DOM), the note and the idle button; one read (the newest page), no "REFRESH
    // failed" snapshot kept, and data-acn-index-check removed with the index (its "ok" was the dropped
    // index's). a85ab2f kept the old 32 'ready' with "refresh failed" and the sent question unlisted
    // (this fixture on it, Playwright chromium, 2026-11-07), for as long as the session stayed out. v12.18 has no index (fails "ready first").
    const i24Run = fixture(['I24'], async (r) => {
        const SENT = 'A message sent after the session expired, about tidal locking?';
        const h = await open(r, ['I24'], C32, {});
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        await sleep(16000);                   // past the open read's 15 s cooldown: the id's refresh goes at once
        const c0 = (await h.calls()).list.length;
        await h.page.evaluate(() => { window.__MOCK_CONFIG.rpc.mode = 'null7'; });
        await h.page.evaluate((t) => window.__mockGemini.send(t), SENT);
        const tSend = Date.now();
        await h.until((x) => x.banner === 'degraded', 20000, 250);
        const tDeg = Date.now();
        await sleep(1500);
        await h.openNav();
        const v = await h.nav();
        const c1 = await h.calls();
        const added = c1.list.slice(c0).map((x) => x.type + '/' + x.size);
        const kept = h.lines(/REFRESH failed/);
        const perm = h.lines(PERM_RE).map((l) => (l.match(/next retry in \d+s/) || ['?'])[0]);
        r.check('I24', 'new', 'the index ready, then every read answers a null payload [7] and one message is sent: its refresh (one read, ' +
                'the newest page) fails PERMANENTLY and drops the index within 20 s: degraded, the v12.18 list (Q23 first, the sent ' +
                'question last, 11 rows), the note and the idle button, no index-check left from the dropped index; no ' +
                '"REFRESH failed" snapshot kept',
                v0.count === '32' && v0.banner !== 'degraded' && v.banner === 'degraded' && tDeg - tSend <= 20000 &&
                /session was not accepted/.test(v.bannerText || '') && v.count === '11' && /^Gemini question 23:/.test(v.items[0] || '') &&
                v.items[10] === SENT && v.note && !!v.button && v.button.state === 'idle' && v.check === null &&
                JSON.stringify(added) === '["newest/10"]' && kept.length === 0 && perm[0] === 'next retry in 60s',
                'before: ' + fmt(v0) + '; after ' + Math.round((tDeg - tSend) / 100) / 10 + ' s: ' + fmt(v) + ' last=' +
                JSON.stringify((v.items[v.items.length - 1] || '').slice(0, 30)) + ' reads after the send=' + JSON.stringify(added) +
                ' REFRESH failed lines=' + kept.length + ' permanent=' + JSON.stringify(perm) + ' bannerText=' + JSON.stringify(v.bannerText));
        await h.close();
    })();

    // ── I25: the calls backstop counts since the last load that succeeded (review round 1) ───────────
    // GM_IX_CALLS_MAX (100) is a backstop against a loop of FAILURES, never a quota on normal use. A
    // 990-turn chat (10 pages of 100 a full read) opened, then left for Gemini's home and opened again 9
    // times (one chat visit: A -> home -> A keeps it), every load good: 100 requests. Then 12 messages
    // sent 3 s apart: every one is listed (990 -> 1002), each refresh the newest page, with no failed
    // refresh and the index still ready. a85ab2f counted every request of the visit, so the first send's
    // refresh met "100 history reads" and Navigate kept the old 990 with "refresh failed" and none of the
    // 12 sent (this fixture on it, Playwright chromium, 2026-11-07), for the rest of the visit. The 100 is the build's constant: a 990-turn chat is what reaches it here in
    // ~1 minute. v12.18 has no index (fails "990 listed").
    const i25Run = fixture(['I25'], async (r) => {
        const SENT = (k) => 'Sent message ' + (k + 1) + ' of twelve, about the Roche limit?';
        const desc = 'a 990-turn chat opened 10 times in one visit (via the home page), every load good: 100 requests; then 12 ' +
                     'messages sent 3 s apart are all listed (1002, the 12 sent last, in order), each refresh the newest page, no ' +
                     'refresh failed, still ready, index-check "ok"';
        const h = await open(r, ['I25'], C990, { rpc: { heavyChars: 10 } });
        if (!h) return;
        await h.openNav();
        let v = await h.waitReady(990, 30000);
        const cycles = [];
        if (v.count === '990') {
            for (let k = 0; k < 9; k++) {
                await h.page.evaluate(() => window.__mockGemini.goHome());
                await sleep(1500);            // the userscript's scan after the path change (500 ms), and more
                await h.page.evaluate((id) => window.__mockGemini.switchTo(id), C990);
                try { await h.page.waitForFunction('window.__mockGemini.loaded() === 10', null, { timeout: 10000 }); } catch (e) {}
                await sleep(800);
                await h.openNav();
                v = await h.waitReady(990, 30000);
                cycles.push((await h.calls()).list.length);
                if (v.count !== '990') break;
            }
        }
        const cAfter = (await h.calls()).list.length;
        if (v.count !== '990' || cAfter !== 100) {
            r.check('I25', 'new', desc, false, 'never reached 100 good requests: ' + fmt(v) + ' requests after each reopen=' + JSON.stringify(cycles) +
                    ' (all ' + cAfter + ')');
            await h.close();
            return;
        }
        await sleep(16000);                   // past the last load's 15 s cooldown: the first send's refresh goes at once
        for (let k = 0; k < 12; k++) {
            await h.page.evaluate((t) => window.__mockGemini.send(t), SENT(k));
            await sleep(3000);
        }
        await h.openNav();
        const vEnd = await h.until((x) => x.count === '1002' || x.banner === 'degraded' || x.banner === 'ready-with-notes', 90000, 500);
        await sleep(1500);
        const v2 = await h.nav();
        const c2 = await h.calls();
        const added = c2.list.slice(cAfter).map((x) => x.type + '/' + x.size + '/' + x.status);
        const tail = v2.items.slice(-12);
        const allSent = tail.length === 12 && tail.every((t, i) => t === SENT(i));
        r.check('I25', 'new', desc,
                vEnd.count === '1002' && v2.count === '1002' && allSent && v2.banner === null && v2.check === 'ok' && added.length >= 1 &&
                added.every((x) => x === 'newest/10/200') && h.lines(/REFRESH failed|history reads in this chat/).length === 0,
                'requests after each reopen=' + JSON.stringify(cycles) + ' then ' + fmt(v2) + ' banner text=' + JSON.stringify(v2.bannerText) +
                ' the 12 sent listed last=' + allSent + ' reads for the sends=' + JSON.stringify(added));
        await h.close();
    })();

    // ── I26: a read that fails at the network is a strike; five stop the visit (review round 1) ───────
    // Every read aborted at the network (the mock's abort mode, the token planted): a TRANSIENT failure,
    // retried at the ~16 s cooldown as every adapter's, but each failed read is a strike of the visit, so
    // exactly GM_IX_STRIKES_MAX (5) reads ("load failed — strike 1..5 of 5"), then "stopped after 5
    // failures" with nothing sent, degraded with the idle button. a85ab2f re-read the whole chat every
    // ~16 s until its 100-request per-visit backstop, about 27 minutes by the arithmetic (100 x ~16 s; this
    // fixture on it: 9 reads in its 130 s, Playwright chromium, 2026-11-07). Watched 130 s from the first
    // read; flushed before R1. v12.18 sends none (fails "5 reads"). Its leak scan reads what the page's
    // scripts wrote (h.logs), never WebKit's own line for each aborted request, which names the URL (open()).
    const i26Run = fixture(['I26'], async (r) => {
        const WIN = 130000;
        const h = await open(r, ['I26'], C32, { rpc: { mode: 'abort' } });
        if (!h) return;
        await h.openNav();
        try { await h.page.waitForFunction(() => window.__mockGemini.calls().list.length >= 1, null, { timeout: 15000 }); } catch (e) {}
        const first = h.hits.length ? h.hits[0].t : Date.now();
        await sleep(Math.max(0, first + WIN - Date.now()));
        await h.openNav();
        const v = await h.nav();
        const at = h.hits.map((x) => x.t - first);
        const gaps = at.slice(1).map((t, i) => t - at[i]);
        const strikes = h.lines(/load failed . strike \d of 5/).map((l) => (l.match(/strike \d of 5/) || [''])[0]);
        const stopped = h.lines(PERM_RE).filter((l) => /stopped after 5 failures/.test(l));
        const leaks = noLeak(h.logs.concat([await h.storage()]));
        r.check('I26', 'new', 'every read aborted at the network (TRANSIENT): exactly 5 reads in 130 s, all full reads, none under 13 s ' +
                'apart (the cooldown), each a strike ("strike 1..5 of 5"), then "stopped after 5 failures" PERMANENT with nothing ' +
                'sent; degraded with the idle button; nothing leaked',
                h.hits.length === 5 && h.hits.every((x) => x.rpc === 'hNvQHb') && Math.min.apply(null, gaps.concat([Infinity])) >= 13000 &&
                strikes.join('|') === 'strike 1 of 5|strike 2 of 5|strike 3 of 5|strike 4 of 5|strike 5 of 5' && stopped.length >= 1 &&
                v.banner === 'degraded' && /stopped after 5 failures/.test(v.bannerText || '') && !!v.button && v.button.state === 'idle' &&
                leaks.length === 0,
                'reads at s=' + JSON.stringify(at.map((t) => Math.round(t / 100) / 10)) + ' strikes=' + JSON.stringify(strikes) +
                ' stopped lines=' + stopped.length + ' ' + fmt(v) + ' bannerText=' + JSON.stringify(v.bannerText) +
                ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
        await h.close();
    })();

    // ── I27: the strikes stop a REFRESH too, beside every fixture below (review round 1) ─────────────
    // Four full reads aborted at the network (strikes 1-4 of the visit); then the server answers again and
    // the fifth read makes the index ready. Past its cooldown the server aborts again and one message is
    // sent: its refresh (the newest page) fails TRANSIENTLY, strike 5, keeping its snapshot ("REFRESH
    // failed"); the next refresh, at the cooldown, ends "stopped after 5 failures" with NOTHING sent, and
    // that permanent failure drops the index: degraded, the v12.18 list (Q23 first, the sent question last,
    // 11 rows), the note, the idle button. All within 28 s of the send (fix-plan A4, not in this build yet,
    // is to make a turn newer than the index a mismatch after a 30 s grace; 28 s keeps the drop seen here
    // the stopped refresh's own once it lands). The strike check sits above gmIxFetch's refresh branch
    // since review round 1; a mutant with it below (as at a85ab2f) read the newest page twice more with the
    // strikes spent ("strike 6 of 5", "strike 7 of 5"), kept the stale 32 under "refresh failed" and never
    // degraded in 40 s (Playwright chromium, 2026-11-07). a85ab2f strikes no network failure (fails
    // "4 strikes"); v12.18 sends none. About 100 s; flushed before R1.
    const i27Run = fixture(['I27'], async (r) => {
        const SENT = 'A message sent with the strikes nearly spent, about orbital resonance?';
        const desc = 'four full reads aborted (strikes 1-4), the fifth answered (ready 32); then every read aborted and one message ' +
                     'sent: its refresh is ONE newest-page read, strike 5, the snapshot kept ("REFRESH failed"); the next refresh ' +
                     'sends NOTHING, "stopped after 5 failures" PERMANENT, and drops the index within 28 s of the send: degraded, ' +
                     'the v12.18 list (11 rows, Q23 first, the sent last), the note, the idle button, no index-check; nothing leaked';
        const h = await open(r, ['I27'], C32, { rpc: { mode: 'abort' } });
        if (!h) return;
        await h.openNav();
        const strikeLines = () => h.lines(/load failed . strike \d of 5/).map((l) => (l.match(/strike \d of 5/) || [''])[0]);
        const t0 = Date.now();
        while (strikeLines().length < 4 && Date.now() - t0 < 80000) await sleep(250);
        if (strikeLines().length !== 4) {
            r.check('I27', 'new', desc, false, 'not 4 strikes from the aborted full reads in 80 s: strikes=' + JSON.stringify(strikeLines()) +
                    ' reads=' + h.hits.length + ' ' + fmt(await h.nav()));
            await h.close();
            return;
        }
        await h.page.evaluate(() => { window.__MOCK_CONFIG.rpc.mode = 'ok'; });
        await h.openNav();
        const v0 = await h.until((x) => x.count === '32' && x.banner !== 'degraded', 30000, 250);
        const nReady = h.hits.length;
        const lastT = nReady ? h.hits[nReady - 1].t : Date.now();
        await sleep(Math.max(0, lastT + 16000 - Date.now()));   // past the ready load's 15 s cooldown
        const c0 = (await h.calls()).list.length, iLog = h.logs.length;
        await h.page.evaluate(() => { window.__MOCK_CONFIG.rpc.mode = 'abort'; });
        await h.page.evaluate((t) => window.__mockGemini.send(t), SENT);
        const tSend = Date.now();
        await h.until((x) => x.banner === 'degraded', 40000, 250);
        const tDeg = Date.now();
        await sleep(1500);
        await h.openNav();
        const v = await h.nav();
        const added = (await h.calls()).list.slice(c0).map((x) => x.type + '/' + x.size);
        const after = h.logs.slice(iLog);
        const kept = after.filter((l) => /REFRESH failed/.test(l));
        const stopped = after.filter((l) => PERM_RE.test(l) && /stopped after 5 failures/.test(l));
        const leaks = noLeak(h.logs.concat([await h.storage()]), ['orbital resonance']);
        r.check('I27', 'new', desc,
                v0.count === '32' && v0.banner !== 'degraded' && nReady === 5 &&
                strikeLines().join('|') === 'strike 1 of 5|strike 2 of 5|strike 3 of 5|strike 4 of 5|strike 5 of 5' &&
                JSON.stringify(added) === '["newest/10"]' && kept.length === 1 && stopped.length >= 1 &&
                v.banner === 'degraded' && /stopped after 5 failures/.test(v.bannerText || '') && tDeg - tSend <= 28000 &&
                v.count === '11' && /^Gemini question 23:/.test(v.items[0] || '') && v.items[10] === SENT && v.note &&
                !!v.button && v.button.state === 'idle' && v.check === null && leaks.length === 0,
                'ready: ' + fmt(v0) + ' after ' + nReady + ' reads; strikes=' + JSON.stringify(strikeLines()) + ' reads after the send=' +
                JSON.stringify(added) + ' REFRESH failed lines=' + kept.length + ' stopped lines=' + stopped.length + '; degraded ' +
                Math.round((tDeg - tSend) / 100) / 10 + ' s after the send: ' + fmt(v) + ' last=' +
                JSON.stringify((v.items[v.items.length - 1] || '').slice(0, 30)) + ' bannerText=' + JSON.stringify(v.bannerText) +
                ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
        await h.close();
    })();

    // ── I28: a load superseded meanwhile costs no strike, beside every fixture below (review round 1) ──
    // The open read is refused 403 (PERMANENT), answering 6 s late; the chat is left for Gemini's home
    // before it answers, so the refusal reaches a SUPERSEDED load: its line ends " superseded", and it has
    // no class (no PERMANENT line) and no strike: the refusal says nothing about the chat open by then.
    // Back on the same chat (one visit: A -> home -> A keeps its strikes), every read now aborted at the
    // network, the visit's first strike is "strike 1 of 5". A build that classes a superseded failure
    // strikes the 403 ("strike 1 of 5" before the return, "strike 2 of 5" after it: a mutant without the
    // superseded test on a failed answer, Playwright chromium, 2026-11-07). a85ab2f strikes no
    // network failure and logs no strike line (fails "strike 1 of 5"); v12.18 sends none. Flushed before R1.
    // The other half of the rule (a superseded 400 neither re-reads nor clears the token) is gated by code
    // reading: the next call() of a superseded load sends nothing, and a token re-read from the same page
    // reads the same value, so in the mock a build without it sends the same requests.
    const i28Run = fixture(['I28'], async (r) => {
        const DELAY = 6000;
        const desc = 'the open read refused 403 but answering 6 s late, the chat left for the home page before it answers: ONE request, ' +
                     'its line ending " superseded", no PERMANENT line, no strike; back on the same chat (one visit) with every read ' +
                     'aborted, the visit\'s first strike is "strike 1 of 5"; nothing leaked';
        const h = await open(r, ['I28'], C32, { rpc: { mode: 'refuse', delayMs: { full: DELAY } } });
        if (!h) return;
        try { await h.page.waitForFunction(() => window.__mockGemini.calls().list.length >= 1, null, { timeout: 15000 }); } catch (e) {}
        await h.page.evaluate(() => window.__mockGemini.goHome());
        const tHome = Date.now();
        if (!h.hits.length) {                 // the build's own failure (v12.18 reads nothing), never the harness's
            r.check('I28', 'new', desc, false, 'no read sent in 15 s after the page opened');
            await h.close();
            return;
        }
        if (tHome > h.hits[0].t + DELAY - 1500) {
            r.bad('I28', 'precondition: the chat was not left while its one read was still unanswered (reads=' + h.hits.length +
                  ', left ' + (h.hits.length ? (tHome - h.hits[0].t) : '?') + ' ms after the first, its answer due at ' + DELAY + ' ms)');
            await h.close();
            return;
        }
        const t1 = Date.now();
        while (h.req().length < 1 && Date.now() - t1 < 15000) await sleep(200);   // the 403's one line
        await sleep(1500);
        const iBack = h.logs.length, nBack = h.hits.length;
        await h.page.evaluate(() => { window.__MOCK_CONFIG.rpc.mode = 'abort'; });
        await h.page.evaluate((id) => window.__mockGemini.switchTo(id), C32);
        const t2 = Date.now();
        while (!h.logs.slice(iBack).some((l) => /load failed . strike \d of 5/.test(l)) && Date.now() - t2 < 20000) await sleep(200);
        await sleep(500);
        const before = h.logs.slice(0, iBack), afterL = h.logs.slice(iBack);
        const reqBefore = before.filter((l) => REQ_RE.test(l));
        const permBefore = before.filter((l) => PERM_RE.test(l));
        const strikesBefore = before.filter((l) => /strike \d of 5/.test(l)).map((l) => (l.match(/strike \d of 5/) || [''])[0]);
        const strikesAfter = afterL.filter((l) => /load failed . strike \d of 5/.test(l)).map((l) => (l.match(/strike \d of 5/) || [''])[0]);
        const leaks = noLeak(h.logs.concat([await h.storage()]));
        r.check('I28', 'new', desc,
                nBack === 1 && reqBefore.length === 1 && / status=403\b/.test(reqBefore[0]) && / superseded$/.test(reqBefore[0]) &&
                permBefore.length === 0 && strikesBefore.length === 0 && h.hits.length > nBack && strikesAfter[0] === 'strike 1 of 5' &&
                leaks.length === 0,
                'left ' + (tHome - h.hits[0].t) + ' ms after the read; before the return: reads=' + nBack + ' lines=' +
                JSON.stringify(reqBefore.map((l) => l.replace(/^\[ACN\] index: platform=gemini /, ''))) + ' PERMANENT=' + permBefore.length +
                ' strikes=' + JSON.stringify(strikesBefore) + '; after it: reads=' + (h.hits.length - nBack) + ' strikes=' +
                JSON.stringify(strikesAfter) + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
        await h.close();
    })();

    // ── I6s (--slow only): the strike cap, beside every fixture below, flushed before R1 ────────────
    // A mismatch that never clears (turn 30's question edited on the page) costs a strike per full read:
    // the first transient (~16 s), the rest permanent (60 s each: a read that succeeds resets the
    // backoff), so exactly GM_IX_STRIKES_MAX (5) reads in 330 s, then "stopped after 5 failures", still
    // degraded (the stage-2 scratch run of this fixture: reads at 0/16/78/139/201 s, chromium). Opt-in:
    // its 330 s window is longer than the rest of the run on a fast machine.
    const i6sRun = !slow ? null : fixture(['I6s'], async (r) => {
        const h = await open(r, ['I6s'], C32, { mismatch: { turn: 30, text: 'Gemini question 30: a question edited on the page, which the read does not hold?' } });
        if (!h) return;
        await h.openNav();
        await sleep(330000);
        const v = await h.nav();
        const reads = h.hits.map((x) => Math.round((x.t - h.hits[0].t) / 1000));
        const strikes = h.logs.filter((l) => /self-check FAILED/.test(l)).map((l) => (l.match(/strike \d of 5/) || [''])[0]);
        const stopped = h.logs.filter((l) => /stopped after 5 failures/.test(l));
        const leaks = noLeak(h.logs.concat([await h.storage()]));
        r.check('I6s', 'new', 'a mismatch that never clears: exactly 5 reads in 330 s (strikes 1-5), then "stopped after 5 failures", ' +
                'degraded; nothing leaked',
                reads.length === 5 && strikes.join('|') === 'strike 1 of 5|strike 2 of 5|strike 3 of 5|strike 4 of 5|strike 5 of 5' &&
                stopped.length >= 1 && v.banner === 'degraded' && /stopped after 5 failures/.test(v.bannerText || '') && leaks.length === 0,
                'reads at s=' + JSON.stringify(reads) + ' strikes=' + JSON.stringify(strikes) + ' stopped lines=' + stopped.length + ' ' + fmt(v) +
                ' banner=' + JSON.stringify(v.bannerText) + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
        await h.close();
    })();

    // ── I1, I2, I4, I5, I18, I20, R2: the 32-question chat on open (Phase 1's 6.2 s full read) ────
    let r2gm = null;          // GM calls in the gm-shim run of I1, for R2
    await seq(fixture(['I1', 'I2', 'I4', 'I5', 'I18', 'I20', 'R2'], async (r) => {
        const A2 = { gm: 'Userscripts' };
        const h = await open(r, ['I1', 'I2', 'I4', 'I5', 'I18', 'I20', 'R2'], C32,
                             { rpc: { delayMs: { full: 6200 } }, answerWords: { 2: 'quokka' } }, { gm: 'Tampermonkey' });
        if (!h) return;
        await h.openNav();
        // From open to ready + 2 s, every 250 ms: no "Load full history" button may show.
        const t0 = Date.now();
        let readyAt = null, buttonSeen = null, v = null;
        while (Date.now() - t0 < 6200 + 6000 && !(readyAt && Date.now() - readyAt >= 2000)) {
            v = await h.nav();
            if (v.button && !buttonSeen) buttonSeen = (Date.now() - t0) + ' ms: ' + v.button.state;
            if (!readyAt && v.count === '32') readyAt = Date.now();
            await sleep(250);
        }
        v = await h.nav();
        const ctx0 = await h.page.evaluate(CTX);
        const calls0 = await h.calls();
        const fx = await h.fx();
        const gm = await h.gmc();
        r2gm = gm.length;
        const reqLines = h.req();
        const openLine = h.lines(/^\[ACN\] index: platform=gemini transport=fetch endpoint=hNvQHb page=1 size=100 status=200 turns=32 cursor=no questions=32/);

        // I2: the request's shape, its token, and no GM call (scriptHandler Tampermonkey here).
        const shape = [];
        let args = null, at = null, keysOrder = null;
        for (const c of fx) {
            if (c.url !== EP) shape.push('url ' + c.url);
            if (c.method !== 'POST') shape.push('method ' + c.method);
            if (c.keys !== 'body,credentials,headers,method') shape.push('init keys ' + c.keys);
            if (c.credentials !== 'include') shape.push('credentials ' + c.credentials);
            if (c.headers !== JSON.stringify({ 'Content-Type': CT })) shape.push('headers ' + c.headers);
            if (c.hasSignal) shape.push('a signal');
            try {
                const p = new URLSearchParams(c.body || '');
                keysOrder = Array.from(p.keys()).join(',');
                if (keysOrder !== 'f.req,at') shape.push('body keys ' + keysOrder);
                const fr = JSON.parse(p.get('f.req'));
                if (!(fr.length === 1 && fr[0].length === 1 && fr[0][0].length === 4 && fr[0][0][0] === 'hNvQHb' &&
                      fr[0][0][2] === null && fr[0][0][3] === 'generic')) shape.push('f.req frame');
                if (!args) args = JSON.parse(fr[0][0][1]);
                at = p.get('at');
                if (at !== AT0) shape.push(at === DECOY ? 'the DECOY global was sent' : 'at is not the inline token');
            } catch (e) { shape.push('body did not parse'); }
        }
        const argsOk = JSON.stringify(args) === JSON.stringify(['c_' + C32, 100, null, 1, [1], [4], null, 1]);
        // The same page under Userscripts' scriptHandler: still fetch, still no GM call.
        let us = null;
        {
            const h2 = await open(r, ['I2'], C32, {}, A2);
            if (h2) {
                await h2.openNav();
                await h2.waitReady(32, 8000);
                us = { fx: (await h2.fx()).length, gm: (await h2.gmc()).length };
                await h2.close();
            }
        }
        const store = await h.storage();
        const leaks = noLeak(h.logs.concat([store]));

        // I4: Search finds an early answer's word, with nothing paged in.
        const s4 = await h.page.evaluate("window.__h.search('quokka')");
        const loads4 = (await h.nav()).loads;
        r.check('I4', 'new', 'Search for a word only answer 2 holds finds "A#2" with no history paged in',
                s4.labels.indexOf('A#2') !== -1 && loads4 === 0,
                'labels=' + JSON.stringify(s4.labels) + ' loads=' + loads4 + (s4.labels.length ? '' : ' text="' + s4.text.slice(0, 40) + '"'));
        const searchNote = s4.note;

        // I20 (part): the gallery keeps its own note (it lists the loaded part); read through Tools.
        const g20 = await h.page.evaluate('window.__h.gallery()');

        // I18 + I20: Summary over the whole chat, with no note.
        const sum = await h.page.evaluate('window.__h.summary()');
        r.check('I18', 'new', 'Summary counts the whole chat: "Total turns: 64 (32 user, 32 AI)"',
                /Total turns: 64 \(32 user, 32 AI\)/.test(sum.text), ((sum.text.match(/Total turns:[^\n]*/) || ['(no Total turns line)'])[0]));

        // I5: Export holds every question and answer, alternating, with no warning.
        const f = await h.page.evaluate('window.__h.exportFull()') || '';
        const ord = exportOrder(f, 32);
        const loads5 = (await h.nav()).loads;
        r.check('I5', 'new', 'Export holds Q#1..Q#32 and A#1..A#32 in order, no "Older messages", no DEGRADED, nothing paged in',
                ord.ok && !/Older messages were not loaded/.test(f) && !/DEGRADED/.test(f) && loads5 === 0,
                'headings=' + ord.count + ' older=' + /Older messages were not loaded/.test(f) + ' degraded=' + /DEGRADED/.test(f) +
                ' loads=' + loads5 + ' ' + ((f.match(/\*\*Source:\*\*[^\n]*/) || ['(no Source line)'])[0]));

        r.check('I20', 'new', 'with the index ready, no "older messages" note in Navigate, Search or Summary and no partial line beside ' +
                'the estimate; the gallery (the loaded part) keeps its note',
                !v.note && !searchNote && !sum.note && !(ctx0.hist && ctx0.hist.trim()) && g20.note,
                'nav=' + v.note + ' search=' + searchNote + ' summary=' + sum.note + ' ctx-hist=' + JSON.stringify(ctx0.hist) + ' gallery=' + g20.note);

        // I1, finished 20 s after ready: still exactly one read (no idle loop).
        if (readyAt) { const left = readyAt + 20000 - Date.now(); if (left > 0) await sleep(left); }
        const calls1 = await h.calls();
        r.check('I1', 'new', 'on open: Navigate lists all 32 (Q#1..Q#32, in order) with no scroll, no note and never the button; ' +
                'index-check "ok" (the loaded turns matched the read); ' +
                'exactly ONE read (size 100, no cursor), still one 20 s after ready; its line names fetch, page 1, size 100, 32 turns',
                v.count === '32' && v.check === 'ok' && qLabels(v.labels, 32) && inOrder(v.items, 32) && v.loads === 0 && v.triggers === 0 &&
                v.st >= v.max - 2 && !v.note && !buttonSeen && calls0.full === 1 && calls0.list.length === 1 &&
                calls0.list[0].size === 100 && calls0.list[0].cursorIn === null && h.hits.length === 1 &&
                calls1.list.length === 1 && openLine.length === 1,
                fmt(v) + ' labelsOk=' + qLabels(v.labels, 32) + ' ordered=' + inOrder(v.items, 32) + ' st=' + v.st + '/' + v.max +
                ' button seen=' + (buttonSeen || 'never') + ' ready=' + (readyAt ? (readyAt - t0) + ' ms' : 'never') + ' ' + callsBrief(calls0) +
                ' hits=' + h.hits.length + ' after 20 s=' + calls1.list.length + ' lines=' + JSON.stringify(reqLines.slice(0, 2)));
        r.check('I2', 'new', 'the read is fetch POST to the exact endpoint, init {body,credentials:include,headers:Content-Type form,method}, ' +
                'body f.req + at with the page\'s argument list, at = the inline token (never the decoy global), no GM call under ' +
                'Tampermonkey or Userscripts, and no token, f.req, query string, question or answer text in the console or storage',
                fx.length >= 1 && shape.length === 0 && argsOk && at === AT0 && gm.length === 0 &&
                !!us && us.fx >= 1 && us.gm === 0 && leaks.length === 0,
                'fetches=' + fx.length + ' problems=' + JSON.stringify(shape.slice(0, 3)) + ' args=' + JSON.stringify(args) +
                ' at=' + (at === AT0 ? 'inline' : at === DECOY ? 'DECOY' : at ? 'other' : 'none') + ' gm(TM)=' + gm.length +
                ' userscripts=' + JSON.stringify(us) + ' leaks=' + JSON.stringify(leaks.slice(0, 3)));
        // R2: @connect gemini.google.com in the header iff a GM transport was used (owner decision 3).
        const hasConnect = /^\/\/\s*@connect\s+gemini\.google\.com\s*$/m.test(header);
        r.check('R2', 'guard', '@connect gemini.google.com is in the header iff the gm-shim run used GM_xmlhttpRequest',
                hasConnect === (r2gm > 0), '@connect=' + hasConnect + ' gm calls=' + r2gm);
        await h.close();
    }));

    // ── I2b, I3r, I3e, I3b, I7c, I8, I4c, I9b: failures and shapes with short windows, side by side ─
    await par([
        fixture(['I2b'], async (r) => {
            // The fetch throws for the read: the one transport cannot run here -> PERMANENT, never GM.
            const h = await open(r, ['I2b'], C32, {}, { gm: 'Tampermonkey', fetchThrow: true });
            if (!h) return;
            await h.openNav();
            await h.waitDegraded(8000);
            // The fallback stays available (Tier 3 r1): v12.18's list, the note and the idle button, in Navigate.
            const v = await h.until((x) => v1218(x) && x.button.inNav, 5000);
            await sleep(500);
            const gm = await h.gmc();
            r.check('I2b', 'new', 'fetch throws for the read: degraded "[fetch] fetch threw", PERMANENT, no GM call, no page error; ' +
                    'the fallback shown: the v12.18 list (10, Q23 first), the note and the idle "Load full history" button in Navigate',
                    v.banner === 'degraded' && /\[fetch\] fetch threw/.test(v.bannerText || '') && h.lines(PERM_RE).some((l) => /\[fetch\] fetch threw/.test(l)) &&
                    gm.length === 0 && h.errors.length === 0 && v1218(v) && v.button.inNav,
                    fmt(v) + ' bannerText=' + JSON.stringify(v.bannerText) + ' permanent=' + h.lines(PERM_RE).length + ' gm=' + gm.length + ' errors=' + h.errors.length +
                    ' first item=' + JSON.stringify((v.items[0] || '').slice(0, 22)) + ' button in Navigate=' + !!(v.button && v.button.inNav));
            await h.close();
        }),
        fixture(['I3r'], async (r) => {
            const h = await open(r, ['I3r'], C230, { rpc: { mode: 'cursor-repeat' } });
            if (!h) return;
            await h.openNav();
            const v = await h.waitDegraded(10000);
            await sleep(1000);
            const c = await h.calls();
            r.check('I3r', 'new', 'a page that repeats the previous cursor: degraded as an unexpected shape, PERMANENT, after 2 reads',
                    v.banner === 'degraded' && /unexpected response shape/.test(v.bannerText || '') && h.lines(PERM_RE).length >= 1 && c.list.length === 2,
                    fmt(v) + ' ' + callsBrief(c) + ' bannerText=' + JSON.stringify(v.bannerText));
            await h.close();
        }),
        fixture(['I3e'], async (r) => {
            const h = await open(r, ['I3e'], C32, { rpc: { mode: 'empty-cursor' } });
            if (!h) return;
            await h.openNav();
            const v = await h.waitDegraded(8000);
            await sleep(1000);
            const c = await h.calls();
            r.check('I3e', 'new', 'a page of no turns that still has a cursor: degraded as an unexpected shape, PERMANENT, after 1 read',
                    v.banner === 'degraded' && /unexpected response shape/.test(v.bannerText || '') && h.lines(PERM_RE).length >= 1 && c.list.length === 1,
                    fmt(v) + ' ' + callsBrief(c) + ' bannerText=' + JSON.stringify(v.bannerText));
            await h.close();
        }),
        fixture(['I3b'], async (r) => {
            // The length lines counted in UTF-8 bytes, and turn 7's question in Korean with an emoji: a
            // reader that trusted the lengths as UTF-16 units would cut the frame.
            const h = await open(r, ['I3b'], C32, { rpc: { lenUnit: 'bytes' }, qText: { 7: KOREAN_Q7 } });
            if (!h) return;
            await h.openNav();
            const v = await h.waitReady(32, 8000);
            r.check('I3b', 'new', 'length lines in bytes and a Korean + emoji question: 32 listed, turn 7\'s row reads exactly its question',
                    v.count === '32' && qLabels(v.labels, 32) && inOrder(v.items, 32, { 7: KOREAN_Q7 }),
                    fmt(v) + ' row7=' + JSON.stringify(v.items[6] || null));
            await h.close();
        }),
        fixture(['I7c'], async (r) => {
            const h = await open(r, ['I7c'], C32, { rpc: { mode: 'null5' } });
            if (!h) return;
            await h.openNav();
            const v = await h.waitDegraded(8000);
            await sleep(1500);
            r.check('I7c', 'new', 'a null payload with code [5]: degraded, NOT permanent (retried on the cooldown)',
                    v.banner === 'degraded' && h.lines(PERM_RE).length === 0 && h.lines(/payload=null code=5/).length === 1,
                    fmt(v) + ' permanent=' + h.lines(PERM_RE).length + ' lines=' + JSON.stringify(h.req().slice(0, 2)));
            await h.close();
        }),
        fixture(['I8'], async (r) => {
            // The first read is refused 400 and the page's token rotates: ONE re-read, ONE retry with the
            // new token, then the list.
            const h = await open(r, ['I8'], C32, { rpc: { mode: 'stale-at' } });
            if (!h) return;
            await h.openNav();
            await h.waitReady(32, 10000);
            await sleep(3000);
            const v = await h.nav();
            const c = await h.calls();
            const fx = await h.fx();
            const ats = fx.map((x) => { try { return new URLSearchParams(x.body || '').get('at'); } catch (e) { return null; } })
                          .map((a) => a === AT0 ? 'AT0' : a === AT_FRESH ? 'FRESH' : a === DECOY ? 'DECOY' : String(a).slice(0, 6));
            const rl = h.req();
            r.check('I8', 'new', 'a 400, then the page\'s fresh token: exactly 2 reads (AT0, then the fresh one, "retry=at-new"), 32 listed, no degrade',
                    c.list.length === 2 && c.list[0].status === 400 && c.list[1].status === 200 && ats.join(',') === 'AT0,FRESH' &&
                    rl.length === 2 && / retry=at-new /.test(rl[1]) && v.count === '32' && v.banner !== 'degraded' && h.lines(PERM_RE).length === 0,
                    fmt(v) + ' ' + callsBrief(c) + ' statuses=' + c.list.map((x) => x.status).join(',') + ' ats=' + ats.join(',') +
                    ' lines=' + JSON.stringify(rl.map((l) => l.replace(/^\[ACN\] index: platform=gemini /, ''))));
            await h.close();
        }),
        fixture(['I4c'], async (r) => {
            // Drafts (Tier 3 r1; the mock's rpc.drafts, unmeasured live: Phase 1 saw one candidate per turn):
            // every turn's response lists a draft first ("platypus") and the shown answer second, named by
            // R[3]; turn 2's shown answer names "quokka", and turn 2 is not loaded (10 of 32 are).
            const h = await open(r, ['I4c'], C32, { rpc: { drafts: { word: 'platypus' } }, answerWords: { 2: 'quokka' } });
            if (!h) return;
            await h.openNav();
            const v = await h.waitReady(32, 8000);
            const sel = await h.page.evaluate("window.__h.search('quokka')");
            const dec = await h.page.evaluate("window.__h.search('platypus')");
            const f = await h.page.evaluate('window.__h.exportFull()') || '';
            const loads = (await h.nav()).loads;
            r.check('I4c', 'new', 'turns with two response candidates (a draft first, the shown one second, named by R[3]): Search for ' +
                    'the shown answer\'s word of unloaded turn 2 finds "A#2", Search for the draft\'s word finds nothing, and Export ' +
                    'holds the shown text and no draft, with nothing paged in',
                    v.count === '32' && sel.labels.indexOf('A#2') !== -1 && dec.labels.length === 0 &&
                    /A note on quokka as well\./.test(f) && !/platypus|Draft \d+:/.test(f) && loads === 0,
                    fmt(v) + ' quokka=' + JSON.stringify(sel.labels) + ' platypus=' + JSON.stringify(dec.labels.slice(0, 4)) +
                    (dec.labels.length > 4 ? '+' + (dec.labels.length - 4) : '') + ' export: shown=' + /A note on quokka as well\./.test(f) +
                    ' draft=' + /platypus|Draft \d+:/.test(f) + ' (' + f.length + ' chars) loads=' + loads);
            await h.close();
        }),
        fixture(['I9b'], async (r) => {
            const h = await open(r, ['I9b'], C32, { rpc: { noToken: true } });
            if (!h) return;
            await h.openNav();
            await h.waitDegraded(8000);
            // The fallback stays available (Tier 3 r1): v12.18's list, the note and the idle button, in Navigate.
            const v = await h.until((x) => v1218(x) && x.button.inNav, 5000);
            await sleep(1000);
            const c = await h.calls();
            r.check('I9b', 'new', 'no token in the page: nothing sent, degraded "no page token"; the fallback shown: the v12.18 list ' +
                    '(10, Q23 first), the note and the idle "Load full history" button in Navigate',
                    v.banner === 'degraded' && /no page token/.test(v.bannerText || '') && c.list.length === 0 && h.hits.length === 0 &&
                    v1218(v) && v.button.inNav,
                    fmt(v) + ' ' + callsBrief(c) + ' hits=' + h.hits.length + ' bannerText=' + JSON.stringify(v.bannerText) +
                    ' first item=' + JSON.stringify((v.items[0] || '').slice(0, 22)) + ' button in Navigate=' + !!(v.button && v.button.inNav));
            await h.close();
        })
    ]);

    // ── I10: answers that do not parse (five shapes), side by side ────────────────────────────────
    {
        const modes = ['noprefix', 'garbage', 'noentry', 'badpayload', 'shape'];
        const out = {};
        await par(modes.map((m) => fixture(['I10'], async (r) => {
            const h = await open(r, ['I10'], C32, { rpc: { mode: m } });
            if (!h) { out[m] = null; return; }
            await h.openNav();
            const v = await h.waitDegraded(8000);
            await sleep(1000);
            out[m] = { ok: v.banner === 'degraded' && /unexpected response shape/.test(v.bannerText || '') &&
                           h.lines(PERM_RE).some((l) => /unexpected response shape/.test(l)) && h.lines(/ payload=bad/).length >= 1 && h.errors.length === 0,
                       d: m + ':' + v.banner + '/perm=' + h.lines(PERM_RE).length + '/bad=' + h.lines(/ payload=bad/).length + '/err=' + h.errors.length };
            await h.close();
        })));
        if (want('I10')) {
            const r = makeRec();
            if (modes.every((m) => out[m] !== null && out[m] !== undefined)) {
                r.check('I10', 'new', 'no prefix / a frame that is not JSON / no hNvQHb entry / a payload that does not parse / turns not a list: ' +
                        'each degraded as an unexpected shape, PERMANENT, "payload=bad", no page error',
                        modes.every((m) => out[m].ok), modes.map((m) => out[m].d).join(' '));
            }
            flush(r);
        }
    }

    // ── I3: a 230-turn chat follows the cursor ───────────────────────────────────────────────────
    await seq(fixture(['I3'], async (r) => {
        const h = await open(r, ['I3'], C230, {});
        if (!h) return;
        await h.openNav();
        const v = await h.waitReady(230, 15000);
        await sleep(1000);
        const c = await h.calls();
        const L = c.list;
        const chain = L.length === 3 && L[0].type === 'full' && L[0].cursorIn === null &&
            L[1].type === 'next' && L[1].cursorIn === L[0].cursorOut && L[2].type === 'next' && L[2].cursorIn === L[1].cursorOut &&
            L.every((x) => x.size === 100) && !!L[0].cursorOut && L[0].cursorOut.length === 145 && L[2].cursorOut === null;
        const rl = h.req();
        const store = await h.storage();
        const leaks = noLeak(h.logs.concat([store]), L.map((x) => x.cursorOut).filter(Boolean).map((cur) => cur.slice(0, 40)));
        r.check('I3', 'new', 'a 230-turn chat: 3 reads of 100 (no cursor, then each previous cursor sent back verbatim, the last null), ' +
                '230 listed in order, one line per read, no cursor in the console or storage',
                chain && v.count === '230' && inOrder(v.items, 230) && rl.length === 3 && leaks.length === 0,
                fmt(v) + ' chain=' + chain + ' ' + L.map((x) => x.type + '(' + x.size + ',' + (x.cursorIn ? x.cursorIn.length : 'null') + '->' +
                (x.cursorOut ? x.cursorOut.length : 'null') + ')').join(' ') + ' lines=' + rl.length + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
        await h.close();
    }));

    // ── I6, I6b, I7, I7b, I9: degrades whose retries are counted over 20-25 s, side by side ────────
    await par([
        fixture(['I6'], async (r) => {
            const h = await open(r, ['I6'], C32, { mismatch: { turn: 30, text: 'Gemini question 30: a question edited on the page, which the read does not hold?' } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitDegraded(10000);
            const tDeg = Date.now();
            await sleep(2000);
            const v = await h.nav();
            await sleep(Math.max(0, tDeg + 20000 - Date.now()));
            const c = await h.calls();
            r.check('I6', 'new', 'a loaded turn whose question differs from the read: degraded "Showing the loaded messages only", ' +
                    'index-check "mismatch", the v12.18 list (10, Q23 first), the note and the idle button; at most 3 reads in 20 s',
                    v0.banner === 'degraded' && /Showing the loaded messages only/.test(v.bannerText || '') && v1218(v) && v.check === 'mismatch' && c.list.length <= 3,
                    fmt(v) + ' bannerText=' + JSON.stringify(v.bannerText) + ' first item=' + JSON.stringify((v.items[0] || '').slice(0, 22)) + ' ' + callsBrief(c));
            await h.close();
        }),
        fixture(['I6b'], async (r) => {
            const h = await open(r, ['I6b'], C32, { mismatch: { turn: 31, id: '0123456789abcdef' } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitDegraded(10000);
            const tDeg = Date.now();
            await sleep(2000);
            const v = await h.nav();
            await sleep(Math.max(0, tDeg + 20000 - Date.now()));
            const c = await h.calls();
            r.check('I6b', 'new', 'a loaded turn whose id the read does not hold, with a known turn after it: degraded as I6, ' +
                    'index-check "mismatch", at most 3 reads in 20 s',
                    v0.banner === 'degraded' && v1218(v) && v.check === 'mismatch' && c.list.length <= 3,
                    fmt(v) + ' ' + callsBrief(c));
            await h.close();
        }),
        fixture(['I7'], async (r) => {
            const h = await open(r, ['I7'], C32, { rpc: { mode: 'null7' } });
            if (!h) return;
            await h.openNav();
            await h.waitDegraded(8000);
            const t1 = Date.now();
            await sleep(1500);
            const v = await h.nav();
            await sleep(Math.max(0, t1 + 20000 - Date.now()));
            const c = await h.calls();
            r.check('I7', 'new', 'a null payload with code [7] (the session): degraded, PERMANENT, "payload=null code=7", the v12.18 list, ' +
                    'the note and the button; no second read in 20 s',
                    v1218(v) && h.lines(PERM_RE).length >= 1 && h.lines(/ payload=null code=7/).length === 1 && c.list.length === 1,
                    fmt(v) + ' permanent=' + h.lines(PERM_RE).length + ' ' + callsBrief(c));
            await h.close();
        }),
        fixture(['I7b'], async (r) => {
            const h = await open(r, ['I7b'], C32, { rpc: { mode: 'null3' } });
            if (!h) return;
            await h.openNav();
            await h.waitDegraded(8000);
            const t1 = Date.now();
            await sleep(1500);
            const v = await h.nav();
            await sleep(Math.max(0, t1 + 20000 - Date.now()));
            const c = await h.calls();
            r.check('I7b', 'new', 'a null payload with code [3] (the request changed): degraded, PERMANENT, "payload=null code=3", ' +
                    'the v12.18 list, the note and the button; no second read in 20 s',
                    v1218(v) && h.lines(PERM_RE).length >= 1 && h.lines(/ payload=null code=3/).length === 1 && c.list.length === 1,
                    fmt(v) + ' permanent=' + h.lines(PERM_RE).length + ' ' + callsBrief(c));
            await h.close();
        }),
        fixture(['I9'], async (r) => {
            const h = await open(r, ['I9'], C32, { rpc: { mode: 'bad-at' } });
            if (!h) return;
            await h.openNav();
            await h.waitDegraded(10000);
            await sleep(1500);
            const v = await h.nav();
            const c0 = await h.calls();
            const first = h.hits.length ? h.hits[0].t : Date.now();
            await sleep(Math.max(0, first + 25000 - Date.now()));
            const c = await h.calls();
            const rl = h.req();
            r.check('I9', 'new', 'every read refused 400: exactly 2 reads in 25 s (the 2nd "retry=at-same"), "HTTP 400 twice" PERMANENT ' +
                    '(next retry in 60s), the v12.18 list, the note and the button',
                    c.list.length === 2 && rl.length === 2 && / retry=at-same /.test(rl[1]) &&
                    h.lines(/HTTP 400 twice.*next retry in 60s/).length >= 1 && v1218(v),
                    fmt(v) + ' ' + callsBrief(c) + ' (at the degrade ' + c0.list.length + ') lines=' +
                    JSON.stringify(rl.map((l) => l.replace(/^\[ACN\] index: platform=gemini /, ''))));
            await h.close();
        })
    ]);

    // ── I6c, I1b: the live order: the read (6.2 s) before the first page (~10 s), side by side ──────
    await par([fixture(['I1b'], async (r) => {
        // The same order with nothing mismatched: the self-check has no turn to compare when the read
        // lands ("pending"), then compares the first page when it mounts ("ok"); never "mismatch".
        const h = await open(r, ['I1b'], C32, { firstDelayMs: 10000, rpc: { delayMs: { full: 6200 } } }, { noWait: true });
        if (!h) return;
        await h.openNav();
        const v0 = await h.nav();
        if (v0.loaded !== 0) { r.bad('I1b', 'precondition: the first page was in before Navigate opened (loaded=' + v0.loaded + ')'); await h.close(); return; }
        const checks = [];
        let pendingFirst = false, v = v0;
        const t0 = Date.now();
        while (Date.now() - t0 < 30000) {
            v = await h.nav();
            if (checks[checks.length - 1] !== v.check) checks.push(v.check);
            if (v.check === 'pending' && v.count === '32' && v.loaded === 0) pendingFirst = true;
            if (v.loaded > 0 && (v.check === 'ok' || v.check === 'mismatch' || v.banner === 'degraded')) break;
            await sleep(200);
        }
        await sleep(1500);
        v = await h.nav();
        if (checks[checks.length - 1] !== v.check) checks.push(v.check);
        r.check('I1b', 'new', 'the read lands before any turn is on the page: index-check "pending" with 32 listed and 0 loaded, then "ok" once ' +
                'the first page mounts and matches; never "mismatch", never degraded',
                pendingFirst && v.check === 'ok' && v.count === '32' && v.loaded === 10 && v.banner !== 'degraded' && checks.indexOf('mismatch') === -1,
                'pending with 0 loaded=' + pendingFirst + ' index-check values in order=' + JSON.stringify(checks) + ' then ' + fmt(v));
        await h.close();
    }), fixture(['I6c'], async (r) => {
        const h = await open(r, ['I6c'], C32, { firstDelayMs: 10000, rpc: { delayMs: { full: 6200 } },
                                                mismatch: { turn: 30, text: 'Gemini question 30: a question edited on the page, which the read does not hold?' } },
                             { noWait: true });
        if (!h) return;
        await h.openNav();
        const v0 = await h.nav();
        if (v0.loaded !== 0) { r.bad('I6c', 'precondition: the first page was in before Navigate opened (loaded=' + v0.loaded + ')'); await h.close(); return; }
        let indexFirst = false;
        const t0 = Date.now();
        let v = v0;
        while (Date.now() - t0 < 30000) {
            v = await h.nav();
            if (v.count === '32' && v.loaded === 0) indexFirst = true;
            if (v.loaded > 0 && v.banner === 'degraded') break;
            await sleep(250);
        }
        await sleep(1500);
        v = await h.nav();
        r.check('I6c', 'new', 'the read arrives before any turn is on the page (32 listed with 0 loaded), and the chat still degrades ' +
                'once the mismatched turns mount (index-check "mismatch", the v12.18 list)',
                indexFirst && v.banner === 'degraded' && v.count === '10' && v.check === 'mismatch',
                'index first=' + indexFirst + ' then ' + fmt(v));
        await h.close();
    })]);

    // ── I6d, I6e, I6f, I6h: the self-check's other rules, side by side (I3c runs beside them all) ──
    await par([
        fixture(['I6d'], async (r) => {
            // Every turn's id removed after the index is ready: nothing on the page can be compared, so
            // "pending" for GM_IX_VERIFY_GRACE_MS (30 s), then a mismatch: never an index taken on trust.
            const h = await open(r, ['I6d'], C32, {});
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitReady(32, 8000);
            const t0 = Date.now();
            await h.page.evaluate(() => {
                document.querySelectorAll('infinite-scroller.chat-history > div.conversation-container').forEach(function (t) { t.id = ''; });
            });
            await sleep(3000);
            const vMid = await h.nav();
            const v = await h.until((x) => x.banner === 'degraded', 40000, 500);
            const dt = Date.now() - t0;
            r.check('I6d', 'new', 'every turn\'s id removed after the index is ready: index-check "pending" with 32 still listed for the 30 s ' +
                    'grace, then degraded "none of the 10 turns on the page carries an id", index-check "mismatch"',
                    v0.count === '32' && vMid.check === 'pending' && vMid.count === '32' && vMid.banner !== 'degraded' &&
                    v.banner === 'degraded' && /none of the 10 turns on the page carries an id/.test(v.bannerText || '') &&
                    v.check === 'mismatch' && dt >= 29000 && dt < 40000,
                    'mid=' + fmt(vMid) + ' then after ' + dt + ' ms ' + fmt(v) + ' bannerText=' + JSON.stringify(v.bannerText));
            await h.close();
        }),
        fixture(['I6e'], async (r) => {
            // The DOM leaves turn 27 out (domOrder.drop): turn 28 follows turn 26, so a turn the index holds
            // is missing between two shown ones (the gap rule). No note asserted: a first render of 9 turns
            // reads to v12.18's tracker as the whole chat (DEC-057's short first page), a mock artifact.
            const h = await open(r, ['I6e'], C32, { domOrder: { drop: 27 } }, { first: 9 });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitDegraded(10000);
            const tDeg = Date.now();
            await sleep(1500);
            const v = await h.nav();
            await sleep(Math.max(0, tDeg + 20000 - Date.now()));
            const c = await h.calls();
            const wantText = 'self-check: 1 indexed turn(s) missing above turn ' + turnId(C32, 28).slice(0, 8);
            r.check('I6e', 'new', 'a turn the index holds left out of the page between two shown ones (turn 27): degraded "1 indexed ' +
                    'turn(s) missing above turn <28\'s id>", index-check "mismatch", the loaded part listed (9); at most 3 reads in 20 s',
                    v0.banner === 'degraded' && (v.bannerText || '').indexOf(wantText) !== -1 && v.check === 'mismatch' && v.count === '9' &&
                    c.list.length <= 3,
                    fmt(v) + ' bannerText=' + JSON.stringify(v.bannerText) + ' ' + callsBrief(c));
            await h.close();
        }),
        fixture(['I6f'], async (r) => {
            // The DOM renders turns 23 and 24 in each other's place (domOrder.swap), each with its own id and
            // text: turn 23 follows turn 24 (the order rule).
            const h = await open(r, ['I6f'], C32, { domOrder: { swap: [23, 24] } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitDegraded(10000);
            const tDeg = Date.now();
            await sleep(1500);
            const v = await h.nav();
            await sleep(Math.max(0, tDeg + 20000 - Date.now()));
            const c = await h.calls();
            const wantText = 'self-check: turn ' + turnId(C32, 23).slice(0, 8) + ' is out of the index\'s order';
            r.check('I6f', 'new', 'two turns shown in each other\'s place (24 above 23): degraded "turn <23\'s id> is out of the index\'s ' +
                    'order", index-check "mismatch", the loaded part listed (10) with the note; at most 3 reads in 20 s',
                    v0.banner === 'degraded' && (v.bannerText || '').indexOf(wantText) !== -1 && v.check === 'mismatch' && v.count === '10' &&
                    v.note && c.list.length <= 3,
                    fmt(v) + ' bannerText=' + JSON.stringify(v.bannerText) + ' ' + callsBrief(c));
            await h.close();
        }),
        fixture(['I6h'], async (r) => {
            // Every read lists no turns and no cursor (rpc.empty 'all') under 10 turns that carry ids: the
            // ready index is empty, which the self-check never takes on trust: "pending" for the grace (the
            // refresh it may ask for lists nothing either), then a mismatch, so an empty read degrades.
            const h = await open(r, ['I6h'], C32, { rpc: { empty: 'all' } });
            if (!h) return;
            await h.openNav();
            const t0 = Date.now();
            let pendingSeen = false, v = null;
            while (Date.now() - t0 < 45000) {
                v = await h.nav();
                if (v.check === 'pending' && v.banner !== 'degraded') pendingSeen = true;
                if (v.banner === 'degraded') break;
                await sleep(500);
            }
            const dt = Date.now() - t0;
            await sleep(1500);
            v = await h.nav();
            r.check('I6h', 'new', 'every read lists no turns (no cursor) under 10 turns with ids: index-check "pending" for the 30 s grace, ' +
                    'then degraded "the index is empty, with 10 turn(s) on the page", index-check "mismatch", the loaded part listed (10) ' +
                    'with the note',
                    pendingSeen && v.banner === 'degraded' && /the index is empty, with 10 turn\(s\) on the page/.test(v.bannerText || '') &&
                    v.check === 'mismatch' && v.count === '10' && v.note && dt >= 25000 && dt < 45000,
                    'pending seen=' + pendingSeen + ' degraded after ' + dt + ' ms ' + fmt(v) + ' bannerText=' + JSON.stringify(v.bannerText));
            await h.close();
        })
    ]);

    // ── I11: a sent message is ONE newest-page read, merged ──────────────────────────────────────
    await seq(fixture(['I11'], async (r) => {
        const SENT = 'A message sent now, asking about Kepler orbits around a binary pair?';
        const h = await open(r, ['I11'], C32, { rpc: { delayMs: { newest: 1900 } } });
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        const c0 = (await h.calls()).list.length;
        await h.page.evaluate((t) => window.__mockGemini.send(t), SENT);
        const v = await h.until((x) => x.count === '33', 30000, 300);
        const c1 = await h.calls();
        // 20 s: past CI_REFETCH_COOLDOWN_MS (15 s) from the refresh, so a second, cooldown-gated read shows.
        await sleep(20000);
        const c2 = await h.calls();
        const added = c1.list.slice(c0);
        r.check('I11', 'new', 'a message sent with the index ready: exactly ONE new read, the newest page (size 10, no cursor), ' +
                '33 listed with the sent question last; still one 20 s later (past the 15 s cooldown)',
                v0.count === '32' && v.count === '33' && v.items[32] === SENT && added.length === 1 && added[0].type === 'newest' &&
                added[0].size === 10 && added[0].cursorIn === null && c2.list.length === c1.list.length,
                'before: ' + fmt(v0) + '; after: ' + fmt(v) + ' last=' + JSON.stringify((v.items[v.items.length - 1] || '').slice(0, 30)) +
                ' new reads=' + JSON.stringify(added.map((x) => x.type + '/' + x.size)) + ' 20 s later=' + (c2.list.length - c0));
        await h.close();
    }));

    // ── I11b, I11c, I11d, I11e: the refresh's other paths and its cost, side by side ───────────────
    await par([
        fixture(['I11b'], async (r) => {
            // Eleven messages at once: the newest page (10) does not reach the index's last turn, so it does
            // not meet the index (a merge miss, K5 in DEC-063): a strike, logged, and the chat read whole in
            // the same load.
            const h = await open(r, ['I11b'], C32, { rpc: { delayMs: { newest: 500 } } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitReady(32, 8000);
            const c0 = (await h.calls()).list.length;
            for (let k = 0; k < 11; k++) await h.page.evaluate((t) => window.__mockGemini.send(t), 'Sent message number ' + k + ' about orbits?');
            const v = await h.until((x) => x.count === '43', 40000, 300);
            await sleep(6000);
            const c1 = await h.calls();
            const added = c1.list.slice(c0).map((x) => x.type + '/' + x.size);
            const miss = h.logs.filter((l) => /does not meet the index/.test(l));
            const leaks = noLeak(h.logs.concat([await h.storage()]), ['Sent message number']);
            r.check('I11b', 'new', 'eleven messages sent at once (more than the newest page holds): the newest page (size 10), then the ' +
                    'chat read whole (size 100) in the same load, one "does not meet the index … (strike 1 of 5)" line, 43 listed, ' +
                    'index-check "ok", nothing leaked',
                    v0.count === '32' && v.count === '43' && JSON.stringify(added) === '["newest/10","full/100"]' && miss.length === 1 &&
                    /strike 1 of 5/.test(miss[0]) && leaks.length === 0 && v.banner !== 'degraded' && v.check === 'ok',
                    fmt(v) + ' added=' + JSON.stringify(added) + ' miss=' + JSON.stringify(miss) + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
            await h.close();
        }),
        fixture(['I11c'], async (r) => {
            // A self-check drop while a refresh is in flight (the newest page answers in 6 s; turn 30's
            // question is edited meanwhile): the refresh's answer is superseded, logged so and never parsed,
            // no full read follows inside that load, and the degraded list stays (no "REFRESH failed"
            // snapshot is put back over it).
            const h = await open(r, ['I11c'], C32, { rpc: { delayMs: { newest: 6000 } } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitReady(32, 8000);
            const c0 = (await h.calls()).list.length;
            await h.page.evaluate((t) => window.__mockGemini.send(t), 'A message sent before an edit?');
            const t0 = Date.now();
            while (Date.now() - t0 < 30000) { const c = await h.calls(); if (c.list.length > c0) break; await sleep(200); }
            const tAsk = Date.now();
            await h.page.evaluate(() => window.__mockGemini.editQuestion(30, 'An edited question thirty, not the index text'));
            const vd = await h.until((x) => x.banner === 'degraded', 5000, 200);
            await sleep(Math.max(0, tAsk + 6000 + 3000 - Date.now()));   // the in-flight page answered, and 3 s more
            const c1 = await h.calls();
            const v = await h.nav();
            const addedSoon = c1.list.slice(c0).map((x) => x.type + '/' + x.size);
            const sup = h.req().filter((l) => / superseded$/.test(l));
            const refreshFailed = h.lines(/REFRESH failed/);
            r.check('I11c', 'new', 'a self-check drop while a refresh is in flight: degraded at once; the refresh\'s answer logged ' +
                    '"superseded" and never parsed, no full read after it inside the load, and the degraded list stays (no ' +
                    '"REFRESH failed" snapshot over it)',
                    v0.count === '32' && vd.banner === 'degraded' && JSON.stringify(addedSoon) === '["newest/10"]' && sup.length === 1 &&
                    refreshFailed.length === 0 && v.banner === 'degraded',
                    fmt(v) + ' addedSoon=' + JSON.stringify(addedSoon) + ' superseded=' + JSON.stringify(sup) + ' refreshFailed=' + refreshFailed.length);
            await h.close();
        }),
        fixture(['I11d'], async (r) => {
            // The refresh's cost while an answer is written (item K8 in DEC-063): a message sent past the open
            // read's cooldown, its answer written evenly over 35 s to 14,000 characters (7 steps of
            // IX_ANSWER_GROWTH). The growth rule would ask for a newest page per 2,000 characters, one per
            // 15 s cooldown (3 or more reads); the latest answer is the settled rule's while it moves: its
            // id's read, then one when it settles. The mock's server lists what is written so far (unmeasured
            // live). The export then holds the whole answer, as complete. One chunk a second: the message
            // observer's scan waits for 500 ms with no mutation (a trailing debounce), so a stream that
            // mutates more often gets no scan at all until it stops, and only one read whatever the rules
            // (this fixture's first run at 500 ms steps, chromium); live Gemini's cadence is unmeasured.
            const SENT = 'A message whose answer is written slowly, about binary orbits?', TAIL = 'zebrafinch';
            const h = await open(r, ['I11d'], C32, { rpc: { delayMs: { newest: 1900 } } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitReady(32, 8000);
            await sleep(16000);                   // past the open read's 15 s cooldown: the id is read at once
            const c0 = (await h.calls()).list.length;
            const tSend = Date.now();
            await h.page.evaluate(([t, tail]) => window.__mockGemini.sendStreaming(t, { chars: 14000, ms: 35000, stepMs: 1000, tail }), [SENT, TAIL]);
            await sleep(35000 + 25000);           // the writing, then past a settle (3 s) and a cooldown (15 s)
            const v = await h.nav();
            const c1 = await h.calls();
            const added = c1.list.slice(c0).map((x) => x.type + '/' + x.size);
            const f = await h.page.evaluate('window.__h.exportFull()') || '';
            const src = (f.match(/\*\*Source:\*\*[^\n]*/) || ['(no Source line)'])[0];
            const leaks = noLeak(h.logs.concat([await h.storage()]), [TAIL, 'Stream note']);
            r.check('I11d', 'new', 'a sent message whose answer is written over 35 s (14,000 characters): at most 2 reads, each the newest ' +
                    'page (its id, then its answer settled), 33 listed, index-check "ok", and the export holds the whole answer (its last ' +
                    'word) as complete; nothing leaked',
                    v0.count === '32' && v.count === '33' && added.length >= 1 && added.length <= 2 && added.every((x) => x === 'newest/10') &&
                    f.indexOf(TAIL) !== -1 && /complete conversation history/.test(src) && v.check === 'ok' && v.banner !== 'degraded' &&
                    leaks.length === 0,
                    fmt(v) + ' reads=' + JSON.stringify(added) + ' at s=' + JSON.stringify(h.hits.filter((x) => x.t >= tSend).map((x) => Math.round((x.t - tSend) / 1000))) +
                    ' export has the last word=' + (f.indexOf(TAIL) !== -1) + ' ' + src + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
            await h.close();
        }),
        fixture(['I11e'], async (r) => {
            // The newest page comes back with no turns and no cursor (rpc.empty 'newest'), never seen live:
            // a merge miss (a strike), then the chat read whole; never a ready EMPTY list.
            const SENT = 'A message sent while the newest page answers empty, about orbits?';
            const h = await open(r, ['I11e'], C32, { rpc: { empty: 'newest' } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitReady(32, 8000);
            const c0 = (await h.calls()).list.length;
            await h.page.evaluate((t) => window.__mockGemini.send(t), SENT);
            let sawEmpty = false, v = null;
            const t0 = Date.now();
            while (Date.now() - t0 < 40000) {
                v = await h.nav();
                if (v.count === '0') sawEmpty = true;
                if (v.count === '33') break;
                await sleep(250);
            }
            await sleep(3000);
            v = await h.nav();
            const c1 = await h.calls();
            const added = c1.list.slice(c0).map((x) => x.type + '/' + x.size);
            const miss = h.lines(/does not meet the index/);
            r.check('I11e', 'new', 'a newest page of no turns and no cursor: a merge miss ("does not meet the index … strike 1 of 5"), then ' +
                    'the chat read whole: newest/10 then full/100, 33 listed, never an empty list, not degraded',
                    v0.count === '32' && v.count === '33' && !sawEmpty && JSON.stringify(added) === '["newest/10","full/100"]' &&
                    miss.length === 1 && /strike 1 of 5/.test(miss[0]) && v.banner !== 'degraded' && v.check === 'ok',
                    fmt(v) + ' saw an empty list=' + sawEmpty + ' added=' + JSON.stringify(added) + ' miss=' + JSON.stringify(miss));
            await h.close();
        })
    ]);

    // ── I11f, I11g: a sent message's first newest page answers late (review round 1), side by side ──
    // rpc.firstNewest (the mock): the FIRST newest page after a send answers late, once. How the live server
    // answers right after a send is UNMEASURED (Phase 1 lists "a streaming turn" as unmeasured); both are
    // models of what such a read could hold. Each sends past the open read's 15 s cooldown, so its id's read
    // goes out at once (~0.5 s, the scan's debounce) and answers in 1.9 s (Phase 1's newest page).
    await par([
        fixture(['I11f'], async (r) => {
            // 'drop': that page leaves the sent turn out. It still meets the index, so the refresh lands ready
            // without the turn, and ixScan's stale rule asks once per turn. 546ab49-434a886 called the newer
            // turn no mismatch: the question stayed unlisted for the visit with index-check "ok" (the review's
            // scratch probe X1, Playwright chromium: 32 listed 45 s after one send and after a second). Now the
            // newer turn is 'pending' for the 30 s grace (GM_IX_VERIFY_GRACE_MS, from the first scan that saw
            // it), then a mismatch (strike 1 of 5, transient): the DOM list meanwhile, and the chat read whole
            // after the 15 s cooldown (~47 s in all).
            const SENT = 'A message the server lists late, about Kepler orbits around a binary pair?';
            const h = await open(r, ['I11f'], C32, { rpc: { delayMs: { newest: 1900 }, firstNewest: 'drop' } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitReady(32, 8000);
            await sleep(16000);                   // past the open read's 15 s cooldown: the id is read at once
            const c0 = (await h.calls()).list.length;
            const tSend = Date.now();
            await h.page.evaluate((t) => window.__mockGemini.send(t), SENT);
            const chk = [];
            let v = null, done = null, mismatchAt = null, degradedAt = null;
            while (Date.now() - tSend < 70000) {
                v = await h.nav();
                const t = Date.now() - tSend;
                if (chk[chk.length - 1] !== v.check) chk.push(v.check);
                if (v.check === 'mismatch' && mismatchAt === null) mismatchAt = t;
                if (v.banner === 'degraded' && degradedAt === null) degradedAt = t;
                if (v.count === '33' && v.banner !== 'degraded' && v.check === 'ok') { done = t; break; }
                await sleep(250);
            }
            const c1 = await h.calls();
            const added = c1.list.slice(c0).map((x) => x.type + '/' + x.size);
            const strike = h.lines(/self-check FAILED \(turn [0-9a-f]{8} is newer than the index for 30 s\) . strike 1 of 5$/);
            const leaks = noLeak(h.logs.concat([await h.storage()]), ['server lists late']);
            // The verdicts in the order seen: "ok" (before the send's scan), then "pending", then "mismatch".
            const iP = chk.indexOf('pending'), iM = chk.indexOf('mismatch');
            r.check('I11f', 'new', 'a sent turn its first newest page leaves out (firstNewest "drop"): index-check "pending" for the 30 s grace ' +
                    '(never "ok" meanwhile), then "mismatch" (one "self-check FAILED (turn <id> is newer than the index for 30 s) … strike 1 of 5" ' +
                    'line) and the banner degraded, then the chat read whole: newest/10 then full/100, 33 listed with the sent question last ' +
                    'and "ok" within 55 s of the send; nothing leaked',
                    v0.count === '32' && done !== null && done <= 55000 && v.items[32] === SENT && iP >= 0 && iM === iP + 1 &&
                    chk.slice(0, iP).every((x) => x === 'ok') &&
                    mismatchAt !== null && mismatchAt >= 29000 && degradedAt !== null && JSON.stringify(added) === '["newest/10","full/100"]' &&
                    strike.length === 1 && leaks.length === 0,
                    fmt(v) + ' checks=' + JSON.stringify(chk) + ' mismatch at=' + mismatchAt + ' ms degraded at=' + degradedAt + ' ms listed at=' + done +
                    ' ms reads=' + JSON.stringify(added) + ' at s=' + JSON.stringify(h.hits.filter((x) => x.t >= tSend).map((x) => Math.round((x.t - tSend) / 100) / 10)) +
                    ' strike lines=' + strike.length + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
            await h.close();
        }),
        fixture(['I11g'], async (r) => {
            // 'half': that page holds the first half of the sent turn's answer, as a read that caught it mid-write,
            // while the page shows it whole (the mock's send() writes it at once). The shortfall (~600 characters)
            // is under IX_ANSWER_GROWTH and the answer never moves again on the page, so 546ab49-434a886 never
            // read it again and the export called itself complete without its end (the review's scratch probe
            // X3, Playwright chromium, 2 of 2 runs, 40 s). Now the refresh's build starts the latest-answer watch
            // as moved: the export says partial meanwhile, and ONE more newest page once the answer has not
            // changed for 3 s (IX_SETTLE_MS), behind the 15 s cooldown from the first read (~16 s after the send).
            const SENT = 'A message whose answer the server held half of, about Hohmann transfers?';
            const h = await open(r, ['I11g'], C32, { rpc: { delayMs: { newest: 1900 }, firstNewest: 'half' } });
            if (!h) return;
            await h.openNav();
            const v0 = await h.waitReady(32, 8000);
            await sleep(16000);
            const c0 = (await h.calls()).list.length;
            const tSend = Date.now();
            await h.page.evaluate((t) => window.__mockGemini.send(t), SENT);
            const v1 = await h.until((x) => x.count === '33', 15000, 200);
            const reads1 = (await h.calls()).list.length - c0;
            await sleep(1000);
            const f1 = await h.page.evaluate('window.__h.exportFull()') || '';
            const reads1b = (await h.calls()).list.length - c0;
            let second = null;
            while (Date.now() - tSend < 30000) {
                if ((await h.calls()).list.length - c0 >= 2) { second = Date.now() - tSend; break; }
                await sleep(250);
            }
            await sleep(4000);                    // the second page answers in 1.9 s, then its scan
            await h.openNav();                    // the tools panel closed first: exportFull opens it with one click
            const f2 = await h.page.evaluate('window.__h.exportFull()') || '';
            await sleep(18000);                   // past the 15 s cooldown from the second read: no third
            await h.openNav();
            const v = await h.nav();
            const c1 = await h.calls();
            const added = c1.list.slice(c0).map((x) => x.type + '/' + x.size);
            const src = (f) => (f.match(/\*\*Source:\*\*[^\n]*/) || ['(no Source line)'])[0];
            const END = 'Answer 33, part 5';
            const leaks = noLeak(h.logs.concat([await h.storage()]), ['server held half']);
            r.check('I11g', 'new', 'a sent turn whose first newest page holds half its answer (firstNewest "half"): the export after that page ' +
                    'lacks the answer\'s end and says partial; ONE more newest page within 25 s of the send; then the export holds the end ' +
                    'as complete; exactly 2 reads (newest/10 twice) 18 s later, 33 listed, index-check "ok"; nothing leaked',
                    v0.count === '32' && v1.count === '33' && reads1 === 1 && reads1b === 1 && f1.indexOf(END) === -1 &&
                    !/complete conversation history/.test(src(f1)) && second !== null && second <= 25000 && f2.indexOf(END) !== -1 &&
                    /complete conversation history/.test(src(f2)) && JSON.stringify(added) === '["newest/10","newest/10"]' &&
                    v.count === '33' && v.check === 'ok' && v.banner !== 'degraded' && leaks.length === 0,
                    fmt(v) + ' reads=' + JSON.stringify(added) + ' at s=' + JSON.stringify(h.hits.filter((x) => x.t >= tSend).map((x) => Math.round((x.t - tSend) / 100) / 10)) +
                    ' | after the first page: reads=' + reads1 + '/' + reads1b + ' end=' + (f1.indexOf(END) !== -1) + ' ' + src(f1) +
                    ' | second read at=' + second + ' ms | then: end=' + (f2.indexOf(END) !== -1) + ' ' + src(f2) +
                    ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
            await h.close();
        })
    ]);

    // ── I17: the size estimate and its dots from the read's text ─────────────────────────────────
    await seq(fixture(['I17'], async (r) => {
        const h = await open(r, ['I17'], C32, { bigAnswers: { 30: 1800000, 31: 1800000 } });
        if (!h) return;
        await h.openNav();
        const v = await h.waitReady(32, 15000);
        let m = null, prev = null;
        for (let i = 0; i < 15; i++) {
            m = await h.page.evaluate(CTX);
            if (prev && JSON.stringify(prev) === JSON.stringify(m)) break;
            prev = m;
            await sleep(700);
        }
        r.check('I17', 'new', 'two huge answers (30, 31): 32 size dots, green to Q#30 and red from Q#31 (^G{30}RR$), basis "size"',
                /^G{30}RR$/.test(m.dots) && m.basis === 'size',
                fmt(v) + ' dots=' + m.dots + ' basis=' + m.basis + ' tokens=' + m.tokens);
        await h.close();
    }));

    // Scroll to the top, a page arrives, again, until 32 are loaded (feature-gaps' gmLoadPages).
    async function loadPages(h) {
        for (let k = 0; k < 12; k++) {
            const n0 = await h.page.evaluate(() => window.__mockGemini.loaded());
            if (n0 >= 32) break;
            await h.page.evaluate(() => window.__mockGemini.userScroll('top'));
            try { await h.page.waitForFunction((n) => window.__mockGemini.loaded() > n && !window.__mockGemini.pending(), n0, { timeout: 8000 }); }
            catch (e) {}
            await sleep(1300);
        }
        await sleep(600);
    }

    // ── I19: a question edited after the index was ready; the tracker kept truthful meanwhile ────────
    // The spec's self-check runs on every load and refresh, not only the first: a loaded turn that stops
    // reading as the index's must degrade it then too (fails on v12.18, which has no self-check). The DOM
    // list it hands back to must be the page's own truth: the history tracker followed the pages while
    // the index was ready, so the start is known to be loaded (32 listed, no note, final labels).
    await seq(fixture(['I19'], async (r) => {
        const store = bmStore(C32, [bmRecord('bm_q5', turnId(C32, 5), 'user-msg', 1), bmRecord('bm_a5', turnId(C32, 5) + ':answer', 'ai-msg', 2)]);
        const h = await open(r, ['I19'], C32, { loadDelayMs: 600 }, { store });
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        const wasReady = ready32(v0);
        await loadPages(h);
        const edited = await h.page.evaluate(() => window.__mockGemini.editQuestion(28, 'Gemini question 28: a question edited on the page after the read?'));
        await h.openNav();
        const v = await h.waitDegraded(10000);
        await sleep(1500);
        const v2 = await h.nav();
        const labels = (await h.page.evaluate('window.__h.bmLabels()')).sort();
        const caught = v.banner === 'degraded' && v2.banner === 'degraded' && v2.check === 'mismatch';
        const truthful = v2.count === '32' && inOrder(v2.items, 32, { 28: 'Gemini question 28: a question edited on the page after the read?' }) &&
                         !v2.note && labels.join('|') === 'Answer to Q#5|Q#5';
        r.check('I19', 'new', 'a loaded question edited after the index was ready (every page loaded): the self-check catches it ' +
                '(degraded, index-check "mismatch"), and the DOM list it hands back to is truthful: the 32 loaded turns as the page shows ' +
                'them, no note, the bookmarks Q#5 / "Answer to Q#5" (the tracker followed the pages while the index was ready)',
                wasReady && edited && caught && truthful,
                'ready first=' + wasReady + ' (' + fmt(v0) + '); caught=' + caught + ' (banner=' + v.banner + '/' + v2.banner + ' check=' + v2.check +
                '); truthful=' + truthful + ' (' + fmt(v2) + ' labels=' + labels.join('|') + ')');
        await h.close();
    }));

    // ── I13 [guard], I13b [guard], I14: bookmarks on a degraded, a loading and a ready index ──────
    await seq(fixture(['I13'], async (r) => {
        // Degraded (null [7], answered after 2 s): exactly v12.18's labels: "Q#…" while partial, Q#n once
        // the start is loaded; never "Q#?" because an adapter exists.
        const k32 = turnId(C32, 32);
        const store = bmStore(C32, [bmRecord('bm_q32', k32, 'user-msg', 1), bmRecord('bm_a32', k32 + ':answer', 'ai-msg', 2)]);
        const h = await open(r, ['I13'], C32, { loadDelayMs: 600, rpc: { mode: 'null7', delayMs: { full: 2000 } } }, { store });
        if (!h) return;
        const samples = [];
        const t0 = Date.now();
        await h.page.evaluate('window.__h.bmLabels()');
        let degAt = null;
        while (Date.now() - t0 < 9000) {
            const l = await h.page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#acn-panel-bookmarks .acn-bk .acn-bk-type'),
                                                                         function (e) { return e.textContent; }));
            samples.push(l.slice().sort().join('|'));
            if (!degAt && h.lines(/conversation index unavailable/).length) degAt = Date.now();
            if (degAt && Date.now() - degAt > 2000) break;
            await sleep(250);
        }
        const early = Array.from(new Set(samples));
        await loadPages(h);
        await h.page.evaluate("document.getElementById('acn-dot-nav').click()");
        await sleep(400);
        const final = (await h.page.evaluate('window.__h.bmLabels()')).sort();
        const never = samples.every((s) => s.indexOf('?') === -1);
        r.check('I13', 'guard', 'bookmarks with the index degraded (null [7]): "Q#…" / "Answer to Q#…" while partial, then Q#32 / ' +
                '"Answer to Q#32" once loaded; never "Q#?" or "A#?" (sampled every 250 ms from open)',
                early.length >= 1 && early.every((s) => s === 'Answer to Q#…|Q#…' || s === '') && early.indexOf('Answer to Q#…|Q#…') !== -1 &&
                never && final.join('|') === 'Answer to Q#32|Q#32',
                'while partial=' + JSON.stringify(early) + ' after loading=' + final.join('|') + ' degraded seen=' + !!degAt);
        await h.close();
    }));
    await seq(fixture(['I13b'], async (r) => {
        // Loading (the read answers after 20 s), a 6-turn chat: a question bookmarked now reads "Q#6", as on
        // v12.18 (every turn is loaded). A [guard] (K16): the spec asks nothing new of the loading state, so
        // no assertion here can fail on v12.18; it guards against the adapter's path ("Q#?") taking the
        // labels while the read is still out. Its premise (the read still loading) is the new build's.
        const h = await open(r, ['I13b'], C6, { rpc: { delayMs: { full: 20000 } } });
        if (!h) return;
        await h.openNav();
        const v0 = await h.until((x) => x.banner === 'loading', 4000);
        await sleep(800);
        const key = await h.page.evaluate((id) => {
            const f = document.querySelector('div.conversation-container[id="' + id + '"] div.query-text [data-acn-bookmark]');
            if (f) f.click();
            return f ? f.getAttribute('data-acn-bookmark') : null;
        }, turnId(C6, 6));
        await sleep(600);
        const labels = await h.page.evaluate('window.__h.bmLabels()');
        const pending = h.fulfilled === 0;
        const loading = v0.banner === 'loading' && pending;
        r.check('I13b', 'guard', 'bookmarks while the index is still loading: the question flag of a 6-turn chat reads "Q#6" at once (as v12.18)',
                premise(loading) && key === turnId(C6, 6) && labels.join('|') === 'Q#6',
                premiseNote('the read still loading', loading) + ' banner=' + v0.banner + ' read still pending=' + pending +
                ' key=' + key + ' labels=' + labels.join('|'));
        await h.close();
    }));
    await seq(fixture(['I14'], async (r) => {
        const k5 = turnId(C32, 5);
        const store = bmStore(C32, [bmRecord('bm_q5', k5, 'user-msg', 1), bmRecord('bm_a5', k5 + ':answer', 'ai-msg', 2)]);
        const h = await open(r, ['I14'], C32, {}, { store });
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        await sleep(800);
        const labels = (await h.page.evaluate('window.__h.bmLabels()')).sort();
        const loads0 = (await h.nav()).loads;
        const st = await h.page.evaluate(() => JSON.parse(window.__acnStore()['acn-bookmarks-v1'] || '{}'));
        const keys = Object.keys(st);
        const recs = (st['https://gemini.google.com/app/' + C32] || {}).bookmarks || [];
        const keysOk = keys.length === 1 && keys[0] === 'https://gemini.google.com/app/' + C32 &&
                       recs.map((x) => x.msgUuid).sort().join('|') === [k5, k5 + ':answer'].sort().join('|');
        await h.page.evaluate("window.__h.clickBookmark('Q#5')");
        await h.settle(60000, 2000);
        const s = await h.spot(5, 'q');
        r.check('I14', 'new', 'bookmarks with the index ready: Q#5 / "Answer to Q#5" at once (nothing paged in), the stored keys unchanged, ' +
                'and Q#5 clicked from the bottom pages in and lands',
                v0.count === '32' && labels.join('|') === 'Answer to Q#5|Q#5' && loads0 === 0 && keysOk && s.inView && !s.toasts.length,
                'labels=' + labels.join('|') + ' loads=' + loads0 + ' keys ok=' + keysOk + ' landing=' + JSON.stringify(s));
        await h.close();
    }));

    // ── I15 [guard]: the gallery stays on the page's own images (premise: the index ready) ─────────
    await seq(fixture(['I15'], async (r) => {
        const h = await open(r, ['I15'], C32, { images: { 25: 1, 31: 1 } });
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 6000);
        const rdy = ready32(v0);
        const srcs = await h.page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('img[data-test-id="uploaded-img"]'), function (i) { return i.getAttribute('src'); }));
        const g = await h.page.evaluate('window.__h.gallery()');
        await h.page.evaluate('window.__h.clickGallery(0)');
        await h.settle(30000, 1500);
        const s = await h.spot(25, 'q');
        r.check('I15', 'guard', 'the gallery with the index ready: the same 2 cards as the page\'s own images (turns 25, 31), card 1 lands on turn 25',
                premise(rdy) && g.cards.length === 2 && srcs.length === 2 && g.cards[0].src === srcs[0] && g.cards[1].src === srcs[1] && s.inView && !s.toasts.length,
                premiseNote('index ready', rdy) + ' (' + fmt(v0) + ') cards=' + g.cards.length + ' labels=' + g.cards.map((c) => c.label).join(',') +
                ' note=' + g.note + ' landing=' + JSON.stringify(s));
        await h.close();
    }));

    // ── I16 [guard]: a look-alike host never reads ───────────────────────────────────────────────
    await seq(fixture(['I16'], async (r) => {
        const h = await open(r, ['I16'], C32, {}, { host: 'https://gemini.google.com.probe.cloudworkstations.dev' });
        if (!h) return;
        await h.openNav();
        await sleep(6000);
        r.check('I16', 'guard', 'on a look-alike host (gemini.google.com.probe.cloudworkstations.dev) no read is sent and no gemini index line logged',
                h.hits.length === 0 && h.lines(/^\[ACN\] index: platform=gemini/).length === 0,
                'hits=' + h.hits.length + ' lines=' + h.lines(/^\[ACN\] index: platform=gemini/).length);
        await h.close();
    }));

    // ── Jumps to a question not loaded yet (the index ready, 10 of 32 loaded, from the bottom) ─────
    // The paging status must show while pages are asked for and go once the jump is over; the target
    // ends in view and data-acn-jump-resolved marks it (its position), however it was landed (M1).
    const statusSeenWith = (seen, re, maxLoads) => seen.some((s) => s.shown && re.test(s.text || '') && (maxLoads === undefined || s.loads < maxLoads));
    // The status's attributes while it shows (the contract: data-acn-paging-pages = pages in so far,
    // data-acn-paging-loaded = turns in the DOM): each record agrees with the mock at that moment (a jump
    // from the bottom starts at 0 history loads), and the page count steps 0, 1, 2, ... one at a time.
    function pagingAttrs(seen) {
        const sh = seen.filter((s) => s.shown);
        const wrong = sh.filter((s) => s.pages !== String(s.loads) || s.loaded !== String(s.domLoaded));
        const pages = [];
        for (const s of sh) if (pages[pages.length - 1] !== s.pages) pages.push(s.pages);
        const steps = pages.length >= 3 && pages.every((p, i) => p === String(i));
        return { ok: sh.length > 0 && wrong.length === 0 && steps,
                 d: 'attrs pages=' + JSON.stringify(pages) + ' loaded=' + JSON.stringify(Array.from(new Set(sh.map((s) => s.loaded)))) +
                    ' disagreeing=' + wrong.length + (wrong[0] ? ' (first: pages=' + wrong[0].pages + '/loads=' + wrong[0].loads +
                    ' loaded=' + wrong[0].loaded + '/dom=' + wrong[0].domLoaded + ')' : '') };
    }
    async function jumpQ1(r, id, cfgExtra, opts) {
        const h = await open(r, [id], C32, cfgExtra, opts);
        if (!h) return null;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        const row = await h.clickQ(1);
        return { h, v0, row };
    }
    for (const [id, cfgExtra, cap] of [['I12', { loadDelayMs: 1500 }, 60000], ['I12b', { loadDelayMs: 2900, blockMs: 4600 }, 150000]]) {
        await seq(fixture([id], async (r) => {
            const j = await jumpQ1(r, id, cfgExtra);
            if (!j) return;
            const { h, v0, row } = j;
            if (!row) {
                r.check(id, 'new', 'jump to unloaded Q1 (' + JSON.stringify(cfgExtra) + '): the status shows, pages in, lands', false,
                        'no Q1 row in Navigate (' + fmt(v0) + ' first=' + JSON.stringify((v0.items[0] || '').slice(0, 22)) + ')');
                await h.close();
                return;
            }
            const settled = await h.settle(cap, 3000);
            const s = await h.spot(1, 'q');
            const seen = await h.pgSeen();
            const now = await h.page.evaluate(() => window.__pgNow());
            const starts = h.lines(/^\[ACN\] paging: platform=gemini via=jump start/).length;
            const ends = h.lines(/^\[ACN\] paging: platform=gemini via=jump end=found pages=3\b/).length;
            const at = pagingAttrs(seen);
            const leaks = noLeak(h.logs.concat([await h.storage()]));
            r.check(id, 'new', 'jump to unloaded Q1 (' + JSON.stringify(cfgExtra) + '): "Loading earlier messages…" while paging, then gone; ' +
                    'its data-acn-paging-pages / -loaded true to the page at every change (pages 0, 1, 2, ...); ' +
                    'Q1 in view, resolved "0", the mark inside turn 1, no toast, 3 pages, one start and one "end=found pages=3" line; nothing leaked',
                    settled && statusSeenWith(seen, /^Loading earlier messages…/, 3) && at.ok && !now && s.inView && s.resolved === '0' && s.markIn &&
                    !s.toasts.length && s.loads === 3 && starts === 1 && ends === 1 && leaks.length === 0,
                    'row=' + row + ' settled=' + settled + ' status records=' + seen.length + ' shown=' + seen.filter((x) => x.shown).length +
                    (seen[0] ? ' "' + seen[0].text + '"' : '') + ' ' + at.d + ' now=' + JSON.stringify(now) +
                    ' landing=' + JSON.stringify(s) + ' lines start=' + starts + ' end=' + ends + ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
            await h.close();
        }));
    }
    await seq(fixture(['I12c'], async (r) => {
        // History that stops coming after one page: the jump ends honestly (a toast), the status goes,
        // "end=no-page", and nothing writes the scroller afterwards. The sensor (review round 1): the jump
        // ends with the view at the top, where a write of 0 changes nothing, so the view is first moved off
        // the top by a user scroll (> 300 px) and then sampled for 3 s: a pager or jump still writing after
        // its end pulls it back (min scrollTop > 50 fails) or moves it (more than one value). The sampling
        // at the top passed a scratch mutant that wrote 0 every 100 ms for 6 s after the end (the review's
        // run, Playwright chromium, 546ab49).
        const j = await jumpQ1(r, 'I12c', { loadDelayMs: 1500, stallAt: 20 });
        if (!j) return;
        const { h, v0, row } = j;
        if (!row) { r.check('I12c', 'new', 'a jump whose history stops coming ends with a toast', false, 'no Q1 row (' + fmt(v0) + ')'); await h.close(); return; }
        try { await h.page.waitForFunction(() => (window.__acnToasts || []).length > 0, null, { timeout: 45000 }); } catch (e) {}
        const v = await h.nav();
        await h.page.evaluate(() => window.__mockGemini.userScroll(400));
        const off = await h.until((x) => x.st > 300, 1500, 50);
        const sts = [];
        for (let i = 0; i < 30; i++) { sts.push((await h.nav()).st); await sleep(100); }
        const minSt = Math.min.apply(null, sts);
        r.check('I12c', 'new', 'a jump whose history stops coming (stallAt 20): a toast, the status gone, "end=no-page"; then the view ' +
                'moved off the top (> 300 px) stays there for 3 s (min scrollTop > 50, one value): no scroll write after the end',
                v.toasts.length > 0 && !v.status && h.lines(/^\[ACN\] paging: platform=gemini via=jump end=no-page/).length === 1 &&
                off.st > 300 && minSt > 50 && new Set(sts).size === 1,
                fmt(v) + ' toasts=' + JSON.stringify(v.toasts) + ' status=' + JSON.stringify(v.status) + ' moved to=' + off.st +
                ' min scrollTop=' + minSt + ' scrollTops=' + Array.from(new Set(sts)).join(','));
        await h.close();
    }));
    // I12l (review round 1): the per-jump page cap (the spec: "a per-jump cap from the turn count"), ceil(32 / 10)
    // + 2 = 6 pages for this chat. History that never ends (the mock's endlessDom: past the chat's start, each load
    // brings ten older turns the read does not list) and a target that never mounts (domOrder drop 1: Q1 is in the
    // read, never in the DOM), so neither until() nor the index's start ever ends the run: only the cap does.
    // Synthetic (no live chat pages past its start); the pages at 1.5 s, DEC-057's live range. A build without the
    // cap pages on (GM_PAGE_MAX, 200); v12.18 lists no Q1.
    await seq(fixture(['I12l'], async (r) => {
        const desc = 'a jump whose target never mounts, under history that never ends (endlessDom, Q1 never rendered): ' +
                     'the per-jump cap ends it after ceil(32/10)+2 = 6 pages ("cap=6" at the start, one "end=cap pages=6" line), ' +
                     'one toast, the status gone, no page after the end (3 s), nothing leaked';
        const j = await jumpQ1(r, 'I12l', { loadDelayMs: 1500, endlessDom: true, domOrder: { drop: 1 } });
        if (!j) return;
        const { h, v0, row } = j;
        if (!row) { r.check('I12l', 'new', desc, false, 'no Q1 row (' + fmt(v0) + ')'); await h.close(); return; }
        try { await h.page.waitForFunction(() => (window.__acnToasts || []).length > 0, null, { timeout: 60000 }); } catch (e) {}
        const v = await h.nav();
        await sleep(3000);
        const v2 = await h.nav();
        const starts = h.lines(/^\[ACN\] paging: platform=gemini via=jump start\b/);
        const ends = h.lines(/^\[ACN\] paging: platform=gemini via=jump end=/);
        const leaks = noLeak(h.logs.concat([await h.storage()]));
        r.check('I12l', 'new', desc,
                starts.length === 1 && / cap=6\b/.test(starts[0]) && ends.length === 1 && /^\[ACN\] paging: platform=gemini via=jump end=cap pages=6\b/.test(ends[0]) &&
                v.toasts.length === 1 && !v.status && v2.loads === v.loads && v2.toasts.length === 1 && !v2.status && leaks.length === 0,
                fmt(v) + ' start=' + JSON.stringify(starts.map((l) => l.replace(/^\[ACN\] paging: platform=gemini via=jump /, ''))) +
                ' end=' + JSON.stringify(ends.map((l) => l.replace(/^\[ACN\] paging: platform=gemini via=jump /, '').replace(/ ms=\d+$/, ''))) +
                ' toasts=' + JSON.stringify(v.toasts) + ' status=' + JSON.stringify(v.status) + ' loads ' + v.loads + '->' + v2.loads +
                ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
        await h.close();
    }));
    await seq(fixture(['I12d'], async (r) => {
        const j = await jumpQ1(r, 'I12d', {});
        if (!j) return;
        const { h, v0, row } = j;
        if (!row) { r.check('I12d', 'new', 'a user scroll stops a paging jump', false, 'no Q1 row (' + fmt(v0) + ')'); await h.close(); return; }
        // The pager must be running when the wheel comes: its status shown with at least one page in.
        // Without this the check passed with no pager at all (any scroll plus the wheel met it).
        try {
            await h.page.waitForFunction(() => {
                var s = window.__pgNow();
                return window.__mockGemini.loads() >= 1 && !!s && parseInt(s.pages, 10) >= 1;
            }, null, { timeout: 15000 });
        } catch (e) {}
        const atWheel = (await h.nav()).loads;
        const pgAtWheel = await h.page.evaluate(() => window.__pgNow());
        const shownBefore = (await h.pgSeen()).filter((s) => s.shown).length;
        const paging = !!pgAtWheel && parseInt(pgAtWheel.pages, 10) >= 1 && shownBefore > 0;
        await h.wheel(600);
        await h.settle(30000, 2000);
        const v = await h.nav();
        await sleep(10000);
        const v2 = await h.nav();
        r.check('I12d', 'new', 'a trusted wheel during the paging (its status shown, data-acn-paging-pages >= 1) stops it: the status gone, ' +
                'no toast, at most one more page and none in 10 s, not resolved',
                paging && atWheel >= 1 && !v.status && !v.toasts.length && v.loads <= atWheel + 1 && v2.loads === v.loads && v.resolved !== '0',
                'status at the wheel=' + JSON.stringify(pgAtWheel) + ' shown records before it=' + shownBefore +
                ' loads at the wheel=' + atWheel + ' then ' + v.loads + ' 10 s later ' + v2.loads + ' ' + fmt(v) + ' resolved=' + v.resolved +
                ' status=' + JSON.stringify(v.status) + ' toasts=' + JSON.stringify(v.toasts));
        await h.close();
    }));
    await seq(fixture(['I12e'], async (r) => {
        const j = await jumpQ1(r, 'I12e', {});
        if (!j) return;
        const { h, v0, row } = j;
        if (!row) { r.check('I12e', 'new', 'a Q32 click supersedes a paging jump', false, 'no Q1 row (' + fmt(v0) + ')'); await h.close(); return; }
        try { await h.page.waitForFunction(() => window.__mockGemini.loads() >= 1 && !!window.__pgNow(), null, { timeout: 15000 }); } catch (e) {}
        const pre = await h.nav();
        // The click's time on the page's clock, then the first record after it in which the status no
        // longer shows (its removal, or a change that hid it): the observer's time, not a poll's.
        const tClick = await h.page.evaluate(() => Date.now());
        const row32 = await h.clickQ(32);
        try { await h.page.waitForFunction(() => !window.__pgNow(), null, { timeout: 3000 }); } catch (e) {}
        const gone = (await h.pgSeen()).find((x) => x.t >= tClick && !x.shown);
        const goneMs = gone ? gone.t - tClick : null;
        await h.settle(30000, 2000);
        const s = await h.spot(32, 'q');
        r.check('I12e', 'new', 'Q32 clicked while the jump to Q1 pages: the status goes within a poll, Q32 lands (resolved "31"), no toast',
                !!pre.status && !!row32 && goneMs !== null && goneMs <= 1000 && s.inView && s.resolved === '31' && s.markIn && !s.toasts.length,
                'status before=' + JSON.stringify(pre.status) + ' row32=' + row32 + ' gone after=' + goneMs + ' ms landing=' + JSON.stringify(s));
        await h.close();
    }));
    // I12f: the other routes to an unloaded turn, each from the bottom on a fresh page.
    {
        const k1 = turnId(C32, 1);
        const bms = bmStore(C32, [bmRecord('bm_q1', k1, 'user-msg', 1), bmRecord('bm_a1', k1 + ':answer', 'ai-msg', 2)]);
        const subs = [
            ['search A#2', {}, async (h) => (await h.page.evaluate("window.__h.clickSearch('Answer 2, part 1', 'A#2')")) ? 'A#2' : null, 2, 'answer', null],
            ['summary 1st segment', {}, async (h) => { await h.page.evaluate('window.__h.summary()');
                const c = await h.page.evaluate("window.__h.clickSegment('msgs 1\\u2013')"); return c === 'no match' ? null : c; }, 1, 'q', '0'],
            ['bookmark Q#1', { store: bms }, async (h) => (await h.page.evaluate("window.__h.clickBookmark('Q#1')")) ? 'Q#1' : null, 1, 'q', null],
            ['bookmark answer', { store: bms }, async (h) => (await h.page.evaluate("window.__h.clickBookmark('Answer to Q#1')")) ? 'Answer to Q#1' : null, 1, 'answer', null]
        ];
        const outs = [];
        for (const [name, o, act, n, what, resolved] of subs) {
            const rr = await (fixture(['I12f'], async (r) => {
                const h = await open(r, ['I12f'], C32, {}, o);
                if (!h) { outs.push(null); return; }
                await h.openNav();
                await h.waitReady(32, 8000);
                await sleep(500);
                const did = await act(h);
                if (!did) { outs.push({ ok: false, d: name + ': nothing to click' }); await h.close(); return; }
                await h.settle(60000, 2500);
                const s = await h.spot(n, what);
                const seen = await h.pgSeen();
                const ok = s.inView && !s.toasts.length && statusSeenWith(seen, /^Loading earlier messages…/) && (resolved === null || s.resolved === resolved);
                outs.push({ ok, d: name + ': ' + (s.inView ? 'in' : 'OUT') + ' top=' + s.top + ' resolved=' + s.resolved + ' status seen=' + seen.length +
                                   (s.toasts.length ? ' TOAST' : '') });
                await h.close();
            }))();
            flush(rr);
        }
        if (want('I12f') && outs.length === subs.length && outs.every((x) => x !== null)) {
            const r = makeRec();
            r.check('I12f', 'new', 'Search\'s answer A#2, Summary\'s first segment, and the Q#1 and "Answer to Q#1" bookmarks, each from ' +
                    'the bottom: the status shows, the target lands in view, no toast', outs.every((x) => x.ok), outs.map((x) => x.d).join(' | '));
            flush(r);
        }
    }
    await seq(fixture(['I12g'], async (r) => {
        const j = await jumpQ1(r, 'I12g', {}, { store: { 'acn-settings': { language: 'ko' } } });
        if (!j) return;
        const { h, v0, row } = j;
        if (!row) { r.check('I12g', 'new', 'the paging status in Korean', false, 'no Q1 row (' + fmt(v0) + ')'); await h.close(); return; }
        await h.settle(60000, 3000);
        const seen = await h.pgSeen();
        r.check('I12g', 'new', 'with the language set to Korean the paging status reads "' + KO_STATUS + '"',
                seen.some((s) => s.shown && (s.text || '').indexOf(KO_STATUS) === 0),
                'texts shown=' + JSON.stringify(Array.from(new Set(seen.filter((s) => s.shown).map((s) => s.text)))));
        await h.close();
    }));
    await seq(fixture(['I12h'], async (r) => {
        const j = await jumpQ1(r, 'I12h', { cv: true, cvEstimate: 500 });
        if (!j) return;
        const { h, v0, row } = j;
        if (!row) { r.check('I12h', 'new', 'a jump to unloaded Q1 under content-visibility', false, 'no Q1 row (' + fmt(v0) + ')'); await h.close(); return; }
        await h.settle(60000, 3000);
        const s = await h.spot(1, 'q');
        r.check('I12h', 'new', 'turns content-visibility estimated at 500 px (the live value): Q1 from the bottom lands in view after 3 pages',
                s.inView && s.loads === 3 && s.resolved === '0' && !s.toasts.length, 'landing=' + JSON.stringify(s));
        await h.close();
    }));
    // I12i: the tab hidden while a jump pages (the jumps plan's lifecycle: "Hidden tab: not cleared; the
    // pager's clock stops; resumes when visible"). document.visibilityState is overridden in the page realm
    // once the status shows with a page in; the mock keeps inserting pages, so the pager ends 'found' while
    // the tab is hidden. 3412bff tried to land at that moment: orbLandIn refused ('hidden'), the mark was
    // cleared and the failure toast shown in the hidden tab, and nothing landed once it was visible (the
    // jumps step's verifier, 3 of 3 runs; this gate on 3412bff, 1 of 1). Whether live Gemini inserts a page
    // in a hidden tab is unmeasured; the settle after a page (the page in while visible, the pager's next
    // step after the tab hides) ends the same way.
    await seq(fixture(['I12i'], async (r) => {
        const j = await jumpQ1(r, 'I12i', { loadDelayMs: 1500 });
        if (!j) return;
        const { h, v0, row } = j;
        if (!row) { r.check('I12i', 'new', 'a jump paging while the tab is hidden', false, 'no Q1 row (' + fmt(v0) + ')'); await h.close(); return; }
        await h.page.evaluate(() => {
            window.__vis = 'visible';
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return window.__vis; } });
            Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return window.__vis === 'hidden'; } });
        });
        // Premise: the pager is running when the tab hides (its status shown, at least one page in).
        try {
            await h.page.waitForFunction(() => {
                var s = window.__pgNow();
                return window.__mockGemini.loads() >= 1 && !!s && parseInt(s.pages, 10) >= 1;
            }, null, { timeout: 15000 });
        } catch (e) {}
        const pgAtHide = await h.page.evaluate(() => window.__pgNow());
        await h.page.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
        try { await h.page.waitForFunction(() => window.__mockGemini.loads() >= 3, null, { timeout: 30000 }); } catch (e) {}
        await sleep(4000);
        const hid = await h.spot(1, 'q');
        // The pager ended while hidden (else the hold was never tested): its "end=found pages=3" line is in.
        const endedHidden = h.lines(/^\[ACN\] paging: platform=gemini via=jump end=found pages=3\b/).length === 1;
        await h.page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
        const settled = await h.settle(30000, 3000);
        const s = await h.spot(1, 'q');
        const now = await h.page.evaluate(() => window.__pgNow());
        const paging = !!pgAtHide && parseInt(pgAtHide.pages, 10) >= 1;
        r.check('I12i', 'new', 'the tab hidden while the jump to unloaded Q1 pages (status shown, a page in): the pager ends while hidden; ' +
                'nothing lands, no toast and nothing resolved while hidden; once visible Q1 lands in view, resolved "0", the mark inside turn 1, ' +
                'no toast, the status gone',
                paging && hid.loads === 3 && endedHidden && !hid.toasts.length && hid.resolved === null && !hid.mark &&
                settled && s.inView && s.resolved === '0' && s.markIn && !s.toasts.length && !now,
                'status at the hide=' + JSON.stringify(pgAtHide) + ' ended while hidden=' + endedHidden +
                ' hidden: ' + JSON.stringify(hid) + ' | visible again: settled=' + settled + ' ' + JSON.stringify(s) +
                ' status=' + JSON.stringify(now) + ' lines=' + JSON.stringify(h.lines(/^\[ACN\] paging:/)));
        await h.close();
    }));
    // I12j [guard] (Tier 3 r1): a far landing that starts after the pager and does not land. gmIxJump's far
    // landing (gmLandFarEl) handed outerDone only its success, so a landing that failed never ended the jump
    // (ixJump's contract: outerDone exactly once) and orbLandIn showed the toast itself; now orbLandIn hands
    // its reason to outerDone and the caller (orbScrollToQuestion) shows the one toast. Q13 arrives with the
    // first page, about ten turns above the view, so it is far when the pager ends and lands through
    // gmLandFarEl. acnJumpDebug's "[ACN pre] far landing" line marks the landing's start (written just before
    // its first write), and a page-side console hook ends the landing there, one way per fresh page:
    //   hidden      the tab hides right after the first write ('hidden', a non-user failure): ONE toast
    //   user        a trusted wheel over the scroller as soon as the line is in ('user'): no toast
    //   superseded  Q32's row clicked right after the first write ('superseded'): no toast, Q32 lands
    // In each, Q13 is not resolved or marked and the paging status is gone.
    // A GUARD, not [new]: on 546ab49 orbLandIn shows the same toast itself, at the same moment, and clears the
    // same mark, and every Gemini caller of the jump ends in orbScrollToQuestion, whose toast has the same text,
    // so the page shows the same on both builds (the breach was the contract, not the page). The gate holds
    // the fix to that page: one toast, never two, none for the user's scroll or a newer jump. Premises
    // (required on a normal run, reported under --proof, where v12.18 has no pager and no Q13 row): the
    // far-landing line came after the pager's "end=found" line, the hook acted, and (user) the wheel reached
    // the scroller less than 300 ms after the landing started (its second step is 350 ms after its first
    // write, so it was still in flight); a wheel that came later is reported INVALID (the harness was slow).
    const FAR_HOOK = `(function (mode) {
        try { localStorage.setItem('acnJumpDebug', '1'); } catch (e) {}
        window.__vis = 'visible';
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return window.__vis; } });
        Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return window.__vis === 'hidden'; } });
        var far = window.__far = { at: 0, acted: 0, wheelAt: 0 };
        var sc = document.querySelector('infinite-scroller.chat-history');
        sc.addEventListener('wheel', function (e) { if (e.isTrusted && !far.wheelAt) far.wheelAt = Date.now(); }, { capture: true, passive: true });
        function act() {
            if (mode === 'hidden') { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); }
            if (mode === 'superseded') {
                var rows = document.querySelectorAll('#acn-nav-list [data-acn-role="nav-item"]');
                for (var i = 0; i < rows.length; i++) {
                    var t = rows[i].querySelector('[data-acn-role="nav-item-text"]');
                    if (t && t.textContent.indexOf('Gemini question 32:') !== -1) { rows[i].click(); break; }
                }
            }
            far.acted = Date.now();
        }
        var orig = console.log;
        console.log = function () {
            if (!far.at && String(arguments[0]).indexOf('[ACN pre] far landing:') === 0) {
                far.at = Date.now();
                if (mode !== 'user') setTimeout(act, 0);    // after the landing's first write, in this task
            }
            return orig.apply(console, arguments);
        };
    })`;
    {
        const outs = [];
        for (const mode of ['hidden', 'user', 'superseded']) {
            const rr = await (fixture(['I12j'], async (r) => {
                const h = await open(r, ['I12j'], C32, {});
                if (!h) { outs.push(null); return; }
                await h.openNav();
                const v0 = await h.waitReady(32, 8000);
                await h.page.evaluate(FAR_HOOK + '(' + JSON.stringify(mode) + ')');
                const row = await h.clickQ(13);
                let far = null;
                if (row) {
                    try { await h.page.waitForFunction(() => window.__far.at > 0, null, { timeout: 30000, polling: 'raf' }); } catch (e) {}
                    if (mode === 'user' && (await h.page.evaluate(() => window.__far.at)) > 0) await h.wheel(600);
                    await sleep(1500);
                    await h.page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
                    await h.settle(20000, 2000);
                    far = await h.page.evaluate(() => window.__far);
                }
                const s13 = await h.spot(13, 'q');
                const s32 = await h.spot(32, 'q');
                const now = await h.page.evaluate(() => window.__pgNow());
                const iEnd = h.logs.findIndex((l) => /^\[ACN\] paging: platform=gemini via=jump end=found pages=1\b/.test(l));
                const iFar = h.logs.findIndex((l) => l.indexOf('[ACN pre] far landing:') === 0);
                const wheelMs = far && far.wheelAt ? far.wheelAt - far.at : null;
                const premiseOk = !!row && !!far && far.at > 0 && iEnd >= 0 && iFar > iEnd &&
                                  (mode === 'user' ? wheelMs !== null && wheelMs >= 0 : far.acted > 0);
                if (premiseOk && mode === 'user' && wheelMs >= 300) {
                    outs.push({ invalid: 'precondition: the wheel reached the scroller ' + wheelMs + ' ms after the landing started (want < 300)' });
                    await h.close();
                    return;
                }
                const toasts = s13.toasts.length;
                const q13Clean = s13.resolved !== '12' && !s13.markIn;
                const ok = mode === 'hidden' ? toasts === 1 && q13Clean && s13.resolved === null && !now
                         : mode === 'user' ? toasts === 0 && q13Clean && s13.resolved === null && !now
                         : toasts === 0 && q13Clean && s32.inView && s32.resolved === '31' && s32.markIn && !now;
                outs.push({ ok: premiseOk ? ok : proof, premiseOk,
                            d: mode + ': ' + premiseNote('far landing after the pager, the hook acted', premiseOk) +
                               ' row=' + row + ' toasts=' + toasts + ' resolved=' + s13.resolved + ' mark in turn 13=' + s13.markIn +
                               (mode === 'superseded' ? ' Q32 ' + (s32.inView ? 'in' : 'OUT') + ' mark=' + s32.markIn : '') +
                               (mode === 'user' ? ' wheel ' + wheelMs + ' ms after the start' : '') +
                               ' status=' + JSON.stringify(now) + ' lines end/far=' + iEnd + '/' + iFar +
                               (row ? '' : ' (' + fmt(v0) + ')') });
                await h.close();
            }))();
            flush(rr);
        }
        if (want('I12j') && outs.length === 3 && outs.every((x) => x !== null)) {
            const r = makeRec();
            const inv = outs.filter((x) => x.invalid);
            if (inv.length) r.bad('I12j', inv.map((x) => x.invalid).join(' | '));
            else {
                r.check('I12j', 'guard', 'a far landing that starts after the pager (Q13) and does not land: the tab hidden after its first ' +
                        'write gives ONE toast; a trusted wheel during it, or a newer click (Q32, which lands), gives none; Q13 neither ' +
                        'resolved nor marked, and the paging status gone, in each',
                        outs.every((x) => x.ok), outs.map((x) => x.d).join(' | '));
            }
            flush(r);
        }
    }
    // I12k (review round 1): a target the pager brings in NEAR the view lands checked. Q22 from the bottom: one
    // page brings Q13-Q22, and Q22 sits right above the view, within one view of it, so orbLandFarIn calls it
    // near. 546ab49-434a886 glided there (scrollIntoView smooth, unchecked) and reported success at once. The
    // mock's cv model (live: content-visibility:auto, 500 px estimates, the scroller's overflow-anchor:auto,
    // DOM-REFERENCE) with the two turns above the target answering long (bigAnswers 9,000 characters: real
    // heights several times the estimate; synthetic, how often live answers do is unmeasured): the glide renders
    // them as it passes, the browser's anchoring moves the content under it, and the glide ends where the
    // target was. On 434a886 Q22 ended 4,514 px below the view's top, in view never (a scratch run of this
    // fixture, Playwright chromium, 2026-11-07); the checked landing (gmLandInEl) re-measures after each write.
    // Premise: the landing was the near one (no "[ACN pre] far landing" line: acnJumpDebug on).
    await seq(fixture(['I12k'], async (r) => {
        const desc = 'a target paged in NEAR the view (Q22 from the bottom, one page; cv 500 px, the turns above it long): ' +
                     'lands in view, resolved "21", the mark inside turn 22, no toast, the status gone, 1 page, no read caused by the click';
        const h = await open(r, ['I12k'], C32, { loadDelayMs: 1500, cv: true, cvEstimate: 500, bigAnswers: { 20: 9000, 21: 9000 } });
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        await h.page.evaluate(() => { try { localStorage.setItem('acnJumpDebug', '1'); } catch (e) {} });
        const hits0 = h.hits.length;
        const row = await h.clickQ(22);
        if (!row) { r.check('I12k', 'new', desc, false, 'no Q22 row in Navigate (' + fmt(v0) + ')'); await h.close(); return; }
        await h.settle(60000, 3000);
        const s = await h.spot(22, 'q');
        const now = await h.page.evaluate(() => window.__pgNow());
        const ends = h.lines(/^\[ACN\] paging: platform=gemini via=jump end=found pages=1\b/).length;
        const far = h.lines(/^\[ACN pre\] far landing:/).length;
        const near = ends === 1 && far === 0;
        r.check('I12k', 'new', desc + '; premise: the near landing (one "end=found pages=1" line, no far-landing line)',
                premise(near) && s.inView && s.resolved === '21' && s.markIn && !s.toasts.length && !now && s.loads === 1 &&
                h.hits.length === hits0,
                premiseNote('near', near) + ' row=' + row + ' end lines=' + ends + ' far lines=' + far + ' status=' + JSON.stringify(now) +
                ' reads by the click=' + (h.hits.length - hits0) + ' landing=' + JSON.stringify(s));
        await h.close();
    }));
    await seq(fixture(['I4b'], async (r) => {
        const h = await open(r, ['I4b'], C32, { answerWords: { 2: 'quokka' } });
        if (!h) return;
        await h.openNav();
        await h.waitReady(32, 8000);
        const did = await h.page.evaluate("window.__h.clickSearch('quokka', 'A#2')");
        if (did) await h.settle(60000, 2500);
        const s = await h.spot(2, 'answer');
        r.check('I4b', 'new', 'the Search hit A#2 (answer 2 not loaded) clicked from the bottom pages in and lands on turn 2\'s answer, no toast',
                did && s.inView && !s.toasts.length, 'clicked=' + did + ' landing=' + JSON.stringify(s));
        await h.close();
    }));
    // I21 [guard], the agent's amendment M2 (for the owner's review): a LOADED near target keeps v12.18's smooth glide with the index ready
    // (premise: the index ready).
    await seq(fixture(['I21'], async (r) => {
        const h = await open(r, ['I21'], C32, {});
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        const rdy = ready32(v0);
        await sleep(500);
        const n = await h.page.evaluate(() => {
            var sc = document.querySelector('infinite-scroller.chat-history'), r = sc.getBoundingClientRect(), vh = sc.clientHeight;
            for (var k = 31; k >= 23; k--) {
                var t = document.getElementById(window.__mockGemini.domId(k)), b = t && t.querySelector('div.query-text');
                if (!b) continue;
                var q = b.getBoundingClientRect();
                var inView = q.top >= r.top && q.bottom <= r.bottom;
                var near = q.bottom >= r.top - vh * 0.85 && q.top <= r.bottom + vh * 0.85;
                if (!inView && near) return k;
            }
            return null;
        });
        if (!n) { r.bad('I21', 'precondition: no loaded question out of view yet within 0.85 of a view of it'); await h.close(); return; }
        await h.page.evaluate(() => {
            var sc = document.querySelector('infinite-scroller.chat-history');
            window.__stv = [];
            (function f() { window.__stv.push(Math.round(sc.scrollTop)); if (window.__stv.length < 150) requestAnimationFrame(f); }());
        });
        const row = await h.clickQ(n);
        await sleep(2500);
        await h.settle(15000, 500);
        const stv = await h.page.evaluate(() => window.__stv.slice());
        const distinct = new Set(stv).size;
        const s = await h.spot(n, 'q');
        r.check('I21', 'guard', 'a loaded near question (Q' + n + ') with the index ready: a smooth glide as on v12.18 (the agent\'s amendment M2, for the owner\'s review), in view, marked, no toast',
                premise(rdy) && !!row && distinct >= 4 && s.inView && s.markIn && !s.toasts.length,
                premiseNote('index ready', rdy) + ' (' + fmt(v0) + ') row=' + row + ' distinct scrollTops=' + distinct +
                ' (' + stv[0] + '->' + stv[stv.length - 1] + ') landing=' + JSON.stringify(s));
        await h.close();
    }));
    // I21b [guard], the agent's amendment M2 (for the owner's review): a LOADED FAR target with the index ready keeps v12.18's far landing
    // (gmLandFar): it ends in view and marked with no paging status, nothing paged in and no history read
    // caused by the click. The target is the oldest loaded question that is far (outside a view of the
    // view, orbLandFarIn's test) and lies more than a view below the content's top, so no landing on it can
    // reach the top and set off a history load (the mock loads at scrollTop <= 50).
    await seq(fixture(['I21b'], async (r) => {
        const h = await open(r, ['I21b'], C32, {});
        if (!h) return;
        await h.openNav();
        const v0 = await h.waitReady(32, 8000);
        const rdy = ready32(v0);
        await sleep(500);
        const far = await h.page.evaluate(() => {
            var sc = document.querySelector('infinite-scroller.chat-history'), r = sc.getBoundingClientRect(), vh = sc.clientHeight;
            for (var k = 23; k <= 32; k++) {
                var t = document.getElementById(window.__mockGemini.domId(k)), b = t && t.querySelector('div.query-text');
                if (!b) continue;
                var q = b.getBoundingClientRect(), off = q.top - r.top + sc.scrollTop;
                if ((q.bottom < r.top - vh || q.top > r.bottom + vh) && off > vh + 100) return { n: k, top: Math.round(q.top - r.top), off: Math.round(off) };
            }
            return null;
        });
        if (!far) { r.bad('I21b', 'precondition: no loaded question far from the bottom view and more than a view below the top'); await h.close(); return; }
        const hits0 = h.hits.length, rec0 = (await h.pgSeen()).length;
        const row = await h.clickQ(far.n);
        await sleep(1000);
        await h.settle(20000, 1500);
        await sleep(1000);                       // a read the click asked for would have gone out by now
        const s = await h.spot(far.n, 'q');
        const recs = (await h.pgSeen()).slice(rec0);
        r.check('I21b', 'guard', 'a loaded FAR question (Q' + far.n + ', ' + far.top + ' px from the view top) with the index ready: v12.18\'s far ' +
                'landing (the agent\'s amendment M2, for the owner\'s review): in view, marked, no toast, no paging status, nothing paged in, no history read caused by the click',
                premise(rdy) && !!row && s.inView && s.markIn && !s.toasts.length && recs.length === 0 && s.loads === 0 && h.hits.length === hits0,
                premiseNote('index ready', rdy) + ' (' + fmt(v0) + ') row=' + row + ' status records=' + recs.length + ' reads by the click=' +
                (h.hits.length - hits0) + ' landing=' + JSON.stringify(s));
        await h.close();
    }));

    // ── F1-F11: "Load full history", where the index cannot list the chat ─────────────────────────
    // The read refused (403, PERMANENT) unless noted, so the button is the fallback.
    async function buttonPage(r, id, chat, cfgExtra, opts) {
        const h = await open(r, [id], chat, Object.assign({ rpc: { mode: 'refuse' } }, cfgExtra || {}), opts);
        if (!h) return null;
        await h.openNav();
        const v0 = await h.until((v) => !!v.button, 10000);
        return { h, v0 };
    }
    // The view placed with turn n's top 40 px below the view's top (a user scroll, before the click).
    async function placeAt(h, n) {
        await h.page.evaluate((n) => {
            var sc = document.querySelector('infinite-scroller.chat-history');
            var t = document.getElementById(window.__mockGemini.domId(n));
            window.__mockGemini.userScroll(Math.round(sc.scrollTop + t.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40));
        }, n);
        await sleep(800);
        return h.page.evaluate(ANCHOR);
    }
    const clickButton = (h) => h.page.evaluate(() => {
        var b = document.querySelector('[data-acn-role="history-load"]');
        if (b) b.click();
        return !!b;
    });
    // Samples the button (text, state, loaded, total, in Navigate) every 250 ms until the zone records how
    // the load ended (cap ms).
    async function sampleLoad(h, ms) {
        const texts = new Set(), snaps = [], t0 = Date.now();
        let v = null;
        while (Date.now() - t0 < ms) {
            v = await h.nav();
            if (v.button) { texts.add(v.button.text); snaps.push(v.button); }
            if (v.loadEnd) break;
            await sleep(250);
        }
        return { texts: Array.from(texts), snaps, v };
    }
    // The button's contract (button plan §2.6): idle before the click with the DOM's turn count and total
    // "?"; while loading, data-acn-history-loaded is the number its text shows and the total stays "?";
    // always inside the Navigate panel.
    function buttonAttrs(idle, snaps) {
        const ld = snaps.filter((b) => b.state === 'loading');
        const idleOk = !!idle && idle.state === 'idle' && idle.loaded === '10' && idle.total === '?' && idle.inNav;
        const ldOk = ld.length > 0 && ld.every((b) => b.total === '?' && b.inNav && b.text === 'Loading' + ELL + ' ' + b.loaded + ' of ?') &&
                     ['10', '20', '30'].every((n) => ld.some((b) => b.loaded === n));
        return { ok: idleOk && ldOk && snaps.every((b) => b.inNav),
                 d: 'idle=' + (idle ? idle.state + '/' + idle.loaded + '/' + idle.total + '/inNav=' + idle.inNav : 'none') +
                    ' loading loaded=' + JSON.stringify(Array.from(new Set(ld.map((b) => b.loaded)))) +
                    ' states=' + JSON.stringify(Array.from(new Set(snaps.map((b) => b.state)))) +
                    ' totals=' + JSON.stringify(Array.from(new Set(snaps.map((b) => b.total)))) + ' all in Navigate=' + snaps.every((b) => b.inNav) };
    }
    // The "[ACN] history:" lines of one load that reached the start (consolidated plan §3, the button plan's
    // wording): one "load start loaded=10 anchor=<the anchor turn>", "page loaded=<n> of=? pages=<k>" lines
    // reaching 20 and 30 with k never going back, one "load end reason=start loaded=32", and one
    // "view restored to <the anchor turn> aligned".
    function historyLines(h, anchorId) {
        const st = h.lines(/^\[ACN\] history: load start loaded=10 anchor=[0-9a-f]{16}\b/);
        const stId = st.length === 1 ? (st[0].match(/anchor=([0-9a-f]{16})/) || [])[1] : null;
        const pg = h.lines(/^\[ACN\] history: page /);
        const pgParsed = pg.map((l) => l.match(/^\[ACN\] history: page loaded=(\d+) of=(\S+) pages=(\d+)/));
        const pgOk = pgParsed.length >= 2 && pgParsed.every((m) => !!m && m[2] === '?') &&
                     ['20', '30'].every((n) => pgParsed.some((m) => m && m[1] === n)) &&
                     pgParsed.every((m, i) => i === 0 || (m && pgParsed[i - 1] && +m[3] >= +pgParsed[i - 1][3]));
        const end = h.lines(/^\[ACN\] history: load end reason=start loaded=32 pages=\d+/);
        const rest = anchorId ? h.lines(new RegExp('^\\[ACN\\] history: view restored to ' + anchorId + ' aligned\\b')) : [];
        return { ok: !!anchorId && stId === anchorId && pgOk && end.length === 1 && rest.length === 1,
                 d: 'history lines: start=' + st.length + (stId === anchorId ? '' : ' (anchor ' + (stId || '').slice(0, 8) + ')') +
                    ' page=' + pg.length + (pgOk ? '' : ' ' + JSON.stringify(pg.slice(0, 4).map((l) => l.replace(/^\[ACN\] history: /, '')))) +
                    ' end=' + end.length + ' restored=' + rest.length };
    }
    const noButton = (id, desc, v0) => [id, 'new', desc, false, 'no "Load full history" button (' + fmt(v0) + ')'];

    for (const [id, cfgExtra, cap] of [['F1', {}, 60000], ['F5', { cv: true, cvEstimate: 500, blockMs: 4600, loadDelayMs: 2000 }, 120000]]) {
        await seq(fixture([id], async (r) => {
            const desc = 'Load full history ' + (id === 'F5' ? '(the live model: cv 500 px, a 4.6 s render block a page) ' : '') +
                         'from turn 28: "Loading… 10 / 20 / 30 of ?", ends "start", 32 listed in order, the note and the button gone, ' +
                         'the view back on the anchor turn within 8 px ("aligned"), 3 pages, no read sent; the button in Navigate with ' +
                         'data-acn-history-load / -loaded / -total as its text says; the "[ACN] history:" load start, page, load end and ' +
                         'view restored lines; nothing leaked';
            const b = await buttonPage(r, id, C32, cfgExtra);
            if (!b) return;
            const { h, v0 } = b;
            if (!v0.button) { r.check.apply(null, noButton(id, desc, v0)); await h.close(); return; }
            const anchor = await placeAt(h, 28);
            const reads0 = h.hits.length;
            await clickButton(h);
            const smp = await sampleLoad(h, cap);
            await h.settle(cap, 1000);
            const v = await h.nav();
            const err = anchor ? await h.page.evaluate(ANCHOR_ERR + '(' + JSON.stringify(anchor) + ')') : null;
            const wantTexts = ['Loading' + ELL + ' 10 of ?', 'Loading' + ELL + ' 20 of ?', 'Loading' + ELL + ' 30 of ?'];
            const ba = buttonAttrs(v0.button, smp.snaps);
            const hl = historyLines(h, anchor ? anchor.id : null);
            const leaks = noLeak(h.logs.concat([await h.storage()]));
            r.check(id, 'new', desc,
                    wantTexts.every((t) => smp.texts.indexOf(t) !== -1) && v.loadEnd === 'start' && v.count === '32' && inOrder(v.items, 32) &&
                    !v.note && !v.button && !!anchor && v.anchor === anchor.id && v.restore === 'aligned' && err !== null && Math.abs(err) <= 8 &&
                    v.loads === 3 && h.hits.length === reads0 && ba.ok && hl.ok && leaks.length === 0,
                    'texts=' + JSON.stringify(smp.texts) + ' end=' + v.loadEnd + ' anchor=' + (anchor && anchor.id.slice(0, 8)) + '/' + (v.anchor || '').slice(0, 8) +
                    ' restore=' + v.restore + ' err=' + err + ' ' + fmt(v) + ' reads during=' + (h.hits.length - reads0) + ' ' + ba.d + ' ' + hl.d +
                    ' leaks=' + JSON.stringify(leaks.slice(0, 2)));
            await h.close();
        }));
    }
    await seq(fixture(['F2'], async (r) => {
        const desc = 'a user scroll (trusted wheel) during the load stops it: end "user", no restore, at most 2 pages, nothing after, ' +
                     'the view never pulled back to the top, the button idle and the note shown';
        const b = await buttonPage(r, 'F2', C32);
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F2', desc, v0)); await h.close(); return; }
        await placeAt(h, 28);
        await clickButton(h);
        try { await h.page.waitForFunction(() => window.__mockGemini.loads() >= 1, null, { timeout: 15000 }); } catch (e) {}
        await h.wheel(600);
        // Sampled from the moment the wheel has moved the view off the top (the wheel's own scroll may
        // land a frame later): a paging write after it would bring scrollTop back to 0.
        const off = await h.until((x) => x.st > 50, 1500, 50);
        let minSt = Infinity;
        const t0 = Date.now();
        while (Date.now() - t0 < 6000) { minSt = Math.min(minSt, (await h.nav()).st); await sleep(100); }
        const v = await h.nav();
        if (!(off.st > 50)) minSt = off.st;
        const endL = h.lines(/^\[ACN\] history: load end reason=user\b/).length, restL = h.lines(/^\[ACN\] history: view restored/).length;
        r.check('F2', 'new', desc + '; one "[ACN] history: load end reason=user" line and no "view restored" line',
                v.loadEnd === 'user' && v.restore === 'skipped' && v.loads <= 2 && !v.pending && minSt > 50 &&
                !!v.button && v.button.state === 'idle' && v.button.text === 'Load full history' && v.note && endL === 1 && restL === 0,
                'end=' + v.loadEnd + ' restore=' + v.restore + ' min scrollTop=' + minSt + ' ' + fmt(v) + ' end lines=' + endL + ' restored lines=' + restL);
        await h.close();
    }));
    await seq(fixture(['F3'], async (r) => {
        const desc = 'a second click during the load stops it: end "click", at most 2 pages and none in 6 s, the view back on the anchor ' +
                     '("aligned", within 8 px), the button idle and the note shown';
        const b = await buttonPage(r, 'F3', C32);
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F3', desc, v0)); await h.close(); return; }
        const anchor = await placeAt(h, 28);
        await clickButton(h);
        try { await h.page.waitForFunction(() => window.__mockGemini.loads() >= 1, null, { timeout: 15000 }); } catch (e) {}
        await sleep(300);
        await clickButton(h);
        await h.settle(20000, 1500);
        const v1 = await h.nav();
        await sleep(6000);
        const v = await h.nav();
        const err = anchor ? await h.page.evaluate(ANCHOR_ERR + '(' + JSON.stringify(anchor) + ')') : null;
        const endL = h.lines(/^\[ACN\] history: load end reason=click\b/).length;
        const restL = anchor ? h.lines(new RegExp('^\\[ACN\\] history: view restored to ' + anchor.id + ' aligned\\b')).length : 0;
        r.check('F3', 'new', desc + '; one "[ACN] history: load end reason=click" and one "view restored to <the anchor> aligned" line',
                v.loadEnd === 'click' && v.loads <= 2 && v.loads === v1.loads && v.restore === 'aligned' && err !== null && Math.abs(err) <= 8 &&
                !!v.button && v.button.state === 'idle' && v.note && endL === 1 && restL === 1,
                'end=' + v.loadEnd + ' restore=' + v.restore + ' err=' + err + ' loads ' + v1.loads + '->' + v.loads + ' ' + fmt(v) +
                ' end lines=' + endL + ' restored lines=' + restL);
        await h.close();
    }));
    await seq(fixture(['F4'], async (r) => {
        const desc = 'a 10-turn chat (a full last page): the button at load; a click brings no page, and DEC-057\'s 8 s rule ends it: ' +
                     'the button gone 8-14 s after the click, no page, the note gone, the view restored';
        const b = await buttonPage(r, 'F4', C10);
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F4', desc, v0)); await h.close(); return; }
        await clickButton(h);
        const t0 = Date.now();
        let gone = null, v = null;
        while (Date.now() - t0 < 16000) { v = await h.nav(); if (!v.button) { gone = Date.now() - t0; break; } await sleep(250); }
        await h.settle(10000, 1000);
        v = await h.nav();
        r.check('F4', 'new', desc,
                gone !== null && gone >= 8000 && gone <= 14000 && v.loads === 0 && !v.note && v.loadEnd === 'start' &&
                (v.restore === 'aligned' || v.restore === 'clamped'),
                'gone after=' + gone + ' ms end=' + v.loadEnd + ' restore=' + v.restore + ' ' + fmt(v));
        await h.close();
    }));
    for (const [id, p] of [['F6', '/u/1/app/' + C32], ['F6b', '/gem/g1/' + C32]]) {
        await seq(fixture([id], async (r) => {
            const desc = 'an unmeasured path (' + p.replace(C32, '<id>') + ', the read would answer): no read, one "platform=gemini … unmeasured" line, ' +
                         'the button; a click loads all 32';
            const h = await open(r, [id], C32, {}, { path: p });
            if (!h) return;
            await h.openNav();
            const v0 = await h.until((v) => !!v.button, 8000);
            const lines = h.lines(/platform=gemini.*unmeasured/);
            let v = v0;
            if (v0.button) {
                await clickButton(h);
                await sampleLoad(h, 60000);
                await h.settle(30000, 1000);
                v = await h.nav();
            }
            r.check(id, 'new', desc,
                    h.hits.length === 0 && lines.length === 1 && !!v0.button && v0.button.state === 'idle' && v.count === '32' && inOrder(v.items, 32),
                    'hits=' + h.hits.length + ' unmeasured lines=' + lines.length + ' button=' + (v0.button ? v0.button.state : 'none') + ' then ' + fmt(v));
            await h.close();
        }));
    }
    // F7's sensor for "nothing of ours paged the new chat" is the mock's top-trigger count from the new
    // chat's first page on, not its loads(): the mock's switchTo empties the scroller, scrollTop clamps to 0,
    // and that scroll event fires the mock's own load trigger. Measured on the BARE mock, no userscript
    // (Playwright page realm, headless Chromium, visible, 2026-11-07): a switch from scrollTop 2180 paged
    // one page into the new chat (loads 1, triggers 1); from scrollTop 0, none. So loads() === 0 failed with
    // no click at all. While that load is pending the mock counts no trigger, so an early write to the top
    // is caught by min scrollTop > 50 instead (a scratch mutant writing 0 1.5 s after the 'path' end failed
    // on min scrollTop=0 with triggers 1->1). Live Gemini's chat switch is unmeasured.
    await seq(fixture(['F7'], async (r) => {
        const desc = 'a chat switch during the load ends it "path" with no restore; the new chat is left at its bottom (no scroll ' +
                     'to its top in 4 s) and shows the idle button';
        const b = await buttonPage(r, 'F7', C32);
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F7', desc, v0)); await h.close(); return; }
        await placeAt(h, 28);
        await clickButton(h);
        try { await h.page.waitForFunction(() => window.__mockGemini.loads() >= 1, null, { timeout: 15000 }); } catch (e) {}
        await h.page.evaluate((id) => window.__mockGemini.switchTo(id), C20);
        try { await h.page.waitForFunction('window.__mockGemini.loaded() === 10', null, { timeout: 10000 }); } catch (e) {}
        await sleep(500);
        const trig0 = (await h.nav()).triggers;     // the switch's own clamp trigger, if any (see above)
        let minSt = Infinity;
        const t0 = Date.now();
        while (Date.now() - t0 < 4000) { minSt = Math.min(minSt, (await h.nav()).st); await sleep(100); }
        const z = await h.nav();
        try { await h.page.waitForFunction("!document.getElementById('acn-panel-nav').classList.contains('acn-open')", null, { timeout: 3000 }); } catch (e) {}
        await h.openNav();
        const v = await h.until((x) => !!x.button && x.button.state === 'idle', 10000);
        r.check('F7', 'new', desc,
                z.loadEnd === 'path' && z.restore === 'skipped' && minSt > 50 && trig0 >= 0 && z.triggers === trig0 &&
                !!v.button && v.button.state === 'idle',
                'end=' + z.loadEnd + ' restore=' + z.restore + ' min scrollTop=' + minSt + ' new chat top-triggers ' + trig0 + '->' + z.triggers +
                ' (loads=' + z.loads + ', the switch\'s own) then ' + fmt(v));
        await h.close();
    }));
    await seq(fixture(['F8'], async (r) => {
        const desc = 'a Navigate click on Q25 during the load supersedes it: end "superseded", Q25 lands in view, no paging write after';
        const b = await buttonPage(r, 'F8', C32);
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F8', desc, v0)); await h.close(); return; }
        await placeAt(h, 28);
        await clickButton(h);
        try { await h.page.waitForFunction(() => window.__mockGemini.loads() >= 1, null, { timeout: 15000 }); } catch (e) {}
        await sleep(600);
        const row = await h.clickQ(25);
        // From the moment the landing has moved the view off the top: a paging write after it brings it back to 0.
        const off = await h.until((x) => x.st > 50, 2000, 50);
        let minSt = off.st > 50 ? Infinity : off.st;
        const t0 = Date.now();
        while (Date.now() - t0 < 4000) { minSt = Math.min(minSt, (await h.nav()).st); await sleep(100); }
        await h.settle(20000, 500);
        const v = await h.nav();
        const s = await h.spot(25, 'q');
        r.check('F8', 'new', desc,
                !!row && v.loadEnd === 'superseded' && s.inView && !s.toasts.length && minSt > 50,
                'row=' + row + ' end=' + v.loadEnd + ' min scrollTop after=' + minSt + ' landing=' + JSON.stringify(s));
        await h.close();
    }));
    // F9 (review round 1): the tab hidden during the load, after its first page. A hidden tab never decides the
    // start: the history tracker's 8 s rule is about a VISIBLE view at the top (DEC-057), and the pager does not
    // test the start there. document.visibilityState is overridden in the page realm, and a hidden tab runs no
    // frames, so the scroller's scroll events are held while it is hidden and ONE is dispatched when it is
    // visible again (Chrome dispatches scroll events in the frame; a model, unmeasured live, as is whether live
    // Gemini loads a page in a hidden tab). 546ab49-434a886 ended "start" in the hidden tab with 30 of 32 turns
    // loaded: the tracker's timer completed there and the pager's next poll took it (the review's scratch
    // probe, Playwright chromium). Held hidden 20 s (two of the tracker's 8 s waits), then visible: the load
    // goes on and ends "start" with all 32 in.
    await seq(fixture(['F9'], async (r) => {
        const desc = 'the tab hidden 20 s during the load (after its first page): no end while hidden, the button still loading and ' +
                     'the note shown; visible again: the load goes on and ends "start" with 32 loaded (one "load end reason=start ' +
                     'loaded=32" line), 32 listed in order, the note and the button gone';
        const b = await buttonPage(r, 'F9', C32);
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F9', desc, v0)); await h.close(); return; }
        await placeAt(h, 28);
        await h.page.evaluate(() => {
            window.__vis = 'visible';
            window.__held = 0;
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return window.__vis; } });
            Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return window.__vis !== 'visible'; } });
            var sc = document.querySelector('infinite-scroller.chat-history');
            sc.addEventListener('scroll', function (e) {
                if (window.__vis !== 'visible') { window.__held++; e.stopImmediatePropagation(); }
            }, true);
        });
        await clickButton(h);
        try { await h.page.waitForFunction(() => window.__mockGemini.loads() >= 1, null, { timeout: 15000 }); } catch (e) {}
        await sleep(1500);
        await h.page.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
        const tHide = Date.now();
        let endHidden = null, vh = null, notLoading = 0;
        while (Date.now() - tHide < 20000) {
            vh = await h.nav();
            if (vh.loadEnd && endHidden === null) endHidden = vh.loadEnd + ' at ' + (Date.now() - tHide) + ' ms, loaded ' + vh.loaded;
            if (!vh.button || vh.button.state !== 'loading' || !vh.note) notLoading++;
            await sleep(250);
        }
        const held = await h.page.evaluate(() => {
            var n = window.__held;
            window.__vis = 'visible';
            document.dispatchEvent(new Event('visibilitychange'));
            // The frame-tied delivery: the scroll the hidden tab held, once.
            if (n) document.querySelector('infinite-scroller.chat-history').dispatchEvent(new Event('scroll'));
            return n;
        });
        const smp = await sampleLoad(h, 60000);
        await h.settle(30000, 1500);
        await h.openNav();
        const v = await h.nav();
        const endL = h.lines(/^\[ACN\] history: load end reason=/);
        r.check('F9', 'new', desc,
                endHidden === null && notLoading === 0 && v.loadEnd === 'start' && endL.length === 1 &&
                /^\[ACN\] history: load end reason=start loaded=32 /.test(endL[0]) && v.count === '32' && inOrder(v.items, 32) &&
                !v.note && !v.button && v.loads === 3,
                'hidden: loaded=' + (vh && vh.loaded) + ' end=' + endHidden + ' samples not loading=' + notLoading + ' scrolls held=' + held +
                ' | visible: end=' + v.loadEnd + ' ' + fmt(v) + ' end lines=' + JSON.stringify(endL.map((l) => l.replace(/ ms=\d+$/, ''))) +
                ' texts=' + JSON.stringify(smp.texts));
        await h.close();
    }));
    // F10 (review round 1): the index becomes ready while the button loads, so the load ends "index" and puts the
    // view back. The read fails at the network first (mode abort: TRANSIENT, a strike, the button offered); the
    // mode is set to 'ok' right after the click, so the index's next load after the cooldown (~16 s, I26's pace)
    // succeeds while the button still pages (7 s a page, under its 9 s page wait, so 3 pages take ~22 s). A model:
    // live Gemini's history and the read's recovery are unmeasured. A build whose load ignores the index's start
    // pages on to the DOM's start and ends "start"; v12.18 has no button.
    await seq(fixture(['F10'], async (r) => {
        const desc = 'the index becomes ready during the load (the read failed at the network, then answers): the load ends "index" ' +
                     'before the DOM\'s start (fewer than 3 pages), one "load end reason=index" line, the view back on the anchor turn ' +
                     '("aligned", within 8 px), 32 listed from the index with index-check "ok", no banner, the note and the button gone';
        const b = await buttonPage(r, 'F10', C32, { rpc: { mode: 'abort' }, loadDelayMs: 7000 });
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F10', desc, v0)); await h.close(); return; }
        const anchor = await placeAt(h, 28);
        await clickButton(h);
        await h.page.evaluate(() => { window.__mockGemini && (window.__MOCK_CONFIG.rpc.mode = 'ok'); });
        const smp = await sampleLoad(h, 60000);
        await h.settle(20000, 1000);
        const v = await h.until((x) => x.count === '32' && x.check === 'ok', 10000);
        const err = anchor ? await h.page.evaluate(ANCHOR_ERR + '(' + JSON.stringify(anchor) + ')') : null;
        const endL = h.lines(/^\[ACN\] history: load end reason=/);
        // Before the DOM's start, read from the end line (the turns and pages in when the load ended): the mock's
        // own load, triggered by the pager's last write to the top, may still land after the end (loads() is 3
        // then on the fixed build too: the first run of this gate, chromium).
        const em = endL.length === 1 ? endL[0].match(/^\[ACN\] history: load end reason=index loaded=(\d+) pages=(\d+)\b/) : null;
        r.check('F10', 'new', desc,
                v.loadEnd === 'index' && !!em && +em[1] < 32 && +em[2] < 3 &&
                !!anchor && v.restore === 'aligned' && err !== null && Math.abs(err) <= 8 &&
                v.count === '32' && inOrder(v.items, 32) && v.check === 'ok' && !v.banner && !v.note && !v.button,
                'end=' + v.loadEnd + ' end lines=' + JSON.stringify(endL.map((l) => l.replace(/ ms=\d+$/, ''))) + ' restore=' + v.restore +
                ' err=' + err + ' ' + fmt(v) + ' reads=' + h.hits.length + ' texts=' + JSON.stringify(smp.texts));
        await h.close();
    }));
    // F11 (review round 1): a second click while the view is being put back ('restoring'). gmLoadStop records the
    // restore as superseded at once, and the restore's own end, which comes up to IX_JUMP_SETTLE_MS later, writes
    // nothing (fix plan A9): one "view restored to <the anchor> superseded" line, and the view stays where the stop
    // left it. The click comes from a MutationObserver in the page, in the microtask after the button turns
    // 'restoring' (the restore's first write is made by then, its next step not yet). A build whose stopped restore
    // still ends logs a second "view restored" line; v12.18 has no button.
    await seq(fixture(['F11'], async (r) => {
        const desc = 'a second click while the view is being restored: the load\'s end stays "start" (32 loaded), the restore ' +
                     '"superseded", exactly one "view restored to <the anchor> superseded" line and no other "view restored" line, ' +
                     'the view still for 2 s after, the button gone';
        const b = await buttonPage(r, 'F11', C32);
        if (!b) return;
        const { h, v0 } = b;
        if (!v0.button) { r.check.apply(null, noButton('F11', desc, v0)); await h.close(); return; }
        const anchor = await placeAt(h, 28);
        await h.page.evaluate(() => {
            window.__f11 = { clicked: 0, state: null };
            new MutationObserver(function () {
                if (window.__f11.clicked) return;
                var b = document.querySelector('[data-acn-role="history-load"][data-acn-history-load="restoring"]');
                if (!b) return;
                window.__f11.clicked++;
                window.__f11.state = b.getAttribute('data-acn-history-load');
                b.click();
            }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-acn-history-load'] });
        });
        await clickButton(h);
        await sampleLoad(h, 60000);
        try { await h.page.waitForFunction(() => !!document.getElementById('acn-zone').getAttribute('data-acn-history-restore'), null, { timeout: 10000 }); } catch (e) {}
        const v1 = await h.nav();
        const sts = [];
        for (let i = 0; i < 20; i++) { sts.push((await h.nav()).st); await sleep(100); }
        const v = await h.nav();
        const f11 = await h.page.evaluate(() => window.__f11);
        const restL = h.lines(/^\[ACN\] history: view restored/);
        const supL = anchor ? h.lines(new RegExp('^\\[ACN\\] history: view restored to ' + anchor.id + ' superseded$')) : [];
        r.check('F11', 'new', desc,
                f11.clicked === 1 && f11.state === 'restoring' && v.loadEnd === 'start' && v.loaded === 32 && v.restore === 'superseded' &&
                restL.length === 1 && supL.length === 1 && new Set(sts).size === 1 && v1.restore === 'superseded' && !v.button,
                'clicked=' + f11.clicked + ' at=' + f11.state + ' end=' + v.loadEnd + ' restore=' + v1.restore + '->' + v.restore +
                ' restored lines=' + JSON.stringify(restL.map((l) => l.replace(anchor ? anchor.id : '#', '<anchor>'))) +
                ' scrollTops=' + Array.from(new Set(sts)).join(',') + ' ' + fmt(v));
        await h.close();
    }));

    flush(await i22Run);
    flush(await i23Run);
    flush(await i3cRun);
    flush(await i24Run);
    flush(await i25Run);
    flush(await i26Run);
    flush(await i27Run);
    flush(await i28Run);
    if (i6sRun) flush(await i6sRun);

    // ── R1 [guard], E [guard] ────────────────────────────────────────────────────────────────────
    {
        const r = makeRec();
        if (want('R1')) {
            const badHits = allHits.filter((x) => x.method !== 'POST' || !/[?&]rpcids=hNvQHb(&|$)/.test(x.url) || x.rpc !== 'hNvQHb');
            r.check('R1', 'guard', 'across every fixture: each batchexecute request is a POST of hNvQHb (URL and f.req), and nothing else ' +
                    'is requested but the page and data:/blob: URLs',
                    badHits.length === 0 && allOthers.length === 0,
                    'reads=' + allHits.length + ' bad=' + JSON.stringify(badHits.slice(0, 2)) + ' other requests=' + JSON.stringify(allOthers.slice(0, 3)));
        }
        r.check('E', 'guard', 'no page errors in any fixture', pageErrors.length === 0, pageErrors.slice(0, 3).join(' / '));
        flush(r);
    }

    {
        const reported = new Set(results.map((x) => x.id));
        const r = makeRec();
        for (const id of registered) if (want(id) && !reported.has(id)) r.bad(id, 'never reported: a registered check that did not run');
        flush(r);
    }

    await browser.close();
    const secs = ((Date.now() - t00) / 1000).toFixed(1);
    const fails = results.filter((x) => x.result === 'FAIL').length, inval = results.filter((x) => x.result === 'INVALID').length;
    console.log((fails || inval ? fails + ' check(s) FAILED' + (inval ? ', ' + inval + ' INVALID' : '') : 'all checks passed') +
                ' (' + engine + ', ' + results.length + ' checks, ' + secs + ' s)');
    if (proof) {
        // The proof table: a [new] check must FAIL on the old build, a [guard] must PASS, none INVALID.
        const label = (x) => x.label === '?' ? '?' : x.label;
        let ok = 0, wrong = 0;
        console.log('\nPROOF (' + engine + '): id | label | result | as the proof rule wants');
        for (const x of results) {
            const good = x.result !== 'INVALID' && ((x.label === 'new' && x.result === 'FAIL') || (x.label === 'guard' && x.result === 'PASS'));
            if (good) ok++; else wrong++;
            console.log('  ' + x.id + ' | ' + label(x) + ' | ' + x.result + ' | ' + (good ? 'ok' : 'WRONG'));
        }
        console.log('proof: ' + ok + ' as wanted, ' + wrong + ' not');
        const ranNew = results.filter((x) => x.label === 'new' && (x.result === 'PASS' || x.result === 'FAIL')).length;
        if (!ranNew) { console.log('proof: INVALID (no [new] check ran)'); return wrong + 1; }
        console.log('proof: ' + ranNew + ' [new] check(s) ran');
        return wrong;
    }
    return fails + inval;
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
    const proof = argv.includes('--proof');
    const slow = argv.includes('--slow');
    const only = arg('--only') ? arg('--only').split(',') : null;
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const src = fs.readFileSync(scriptPath, 'utf8');
    const header = (src.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/) || [''])[0];
    const raw = src.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    let bad = 0;
    for (const engine of engines) {
        console.log('check-gemini-index — engine=' + engine + ', script=' + path.basename(scriptPath) + (proof ? ', --proof' : '') +
                    (slow ? ', --slow' : '') + ' (context: Playwright page realm, headless, 1280x720, the userscript inlined, no real manager)');
        bad += await runEngine(engine, raw, header, only, quiet, proof, slow);
    }
    process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
