// Gates for v12.17, the feature-gaps PR (DEC-058; the owner's spec, 2026-11-01): Search, Export,
// Summary and the image gallery read the WHOLE conversation on Claude, ChatGPT, Perplexity and
// Gemini, and Gemini bookmarks key to the turn's own id.
//
// Run: node probes/check-feature-gaps.js [--browser chromium|firefox|webkit] [--quiet] [--only C1,P3]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-feature-gaps.js
// Exits non-zero on any failed check.
//
// WHAT v12.16 DID, MEASURED LIVE (Chrome + Tampermonkey, the owner's profile, visible tab,
// 2026-11-01): ChatGPT (49 questions) Search found no answer at all, Summary read "49 user, 0 AI",
// Export "4 (49 user, 0 AI)" over 4 questions, the gallery 0 of 3 images; Perplexity (12 entries)
// Search found 2 of 12 answers as fragments up to "A#18", Export "24 (12 user, 22 AI)" over 2
// questions, the gallery marked unsupported; Gemini with 10 of 32 turns loaded said "No matches"
// with no note, and its bookmarks were positional; Claude's gallery labelled every image "Upload"
// with no link to its message.
//
// THE MOCKS, each from live markup and live numbers:
//   ChatGPT     chatgpt-windowed.html, bmModel: 6 turns mounted, the answer unit and its message
//               ids as live; image parts named by metadata.attachments (live: 3 of 3).
//   Perplexity  perplexity-windowed.html, bmModel with `finished` (v12.17): the "Finished" step
//               header live draws inside [data-workflow-final-text]; answers in the FINAL step's
//               JSON-in-JSON (live, 12 of 12); attachments as signed S3 links the page never loads.
//   Gemini      gemini-history.html: 10 turns a page, 16-hex turn ids, all loaded turns kept; `cv`
//               (content-visibility, 500 px estimate, the live value) where a landing is measured.
//   Claude      claude-virtualized.html with tailAtEnd, 147 questions; images as `files` of
//               file_kind "image" on their message (live, 7 of 7).
// CONTEXT of these results: Playwright, page realm, headless, viewport 1280x720, the userscript
// inlined; no real userscript manager. Real-browser behaviour is the owner's acceptance.
//
// Proof rule: every fixture marked [new] FAILS on v12.16 (chromium); [guard] passes on both.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

// ── Shared page pieces ────────────────────────────────────────────────────────────────────────
// The export's file, captured in the page (as tests/test-all-platforms.js does).
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
function gmStub(store) {
    return `<script>
delete window._aiNavAlreadyLoaded;
var _s = ${JSON.stringify(store || {})};
window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
window.GM_setValue = function (k, v) { _s[k] = v; };
window.__acnStore = function () { return _s; };
</script>`;
}
function mockParts(file) {
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages', file), 'utf8');
    return { body: (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock,
             head: (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '' };
}
function page(file, script, cfg, store, extraHead) {
    const m = mockParts(file);
    return `<!DOCTYPE html><html><head>${m.head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(cfg || {})};</script>
${DOWNLOAD_SHIM}${TOAST_SPY}
${m.body}
${gmStub(store)}${extraHead || ''}
<script>${script}</script></body></html>`;
}

// In-page helpers, evaluated in the page (strings, so they run on every engine).
const HELPERS = `(function () {
    var S = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    window.__h = {
        S: S,
        search: async function (w) {
            document.getElementById('acn-dot-search').click(); await S(300);
            var inp = document.getElementById('acn-search-input');
            inp.value = w; inp.dispatchEvent(new Event('input', { bubbles: true })); await S(900);
            var L = document.getElementById('acn-search-list');
            return { labels: Array.prototype.map.call(L.querySelectorAll('.acn-qi'), function (i) { return i.querySelector('.acn-qn').textContent; }),
                     note: !!L.querySelector('[data-acn-history="partial"]'), text: L.textContent };
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
        exportBookmarks: async function () {
            window.__acnTestDownloads = [];
            document.getElementById('acn-dot-tools').click(); await S(400);
            document.querySelectorAll('[data-acn-role="tool-export"]')[1].click(); await S(600);
            var d = (window.__acnTestDownloads || [])[0];
            return d && d.blob ? await d.blob.text() : null;
        },
        summary: async function () {
            document.getElementById('acn-dot-summary').click(); await S(300);
            document.querySelector('[data-acn-role="sum-generate"]').click(); await S(2500);
            return document.querySelector('[data-acn-role="sum-results"]').innerText || '';
        },
        clickSegment: function (re) {
            var R = document.querySelector('[data-acn-role="sum-results"]');
            var segs = Array.prototype.filter.call(R.querySelectorAll('*'), function (e) {
                return new RegExp(re).test(e.textContent) && e.children.length < 6; });
            var seg = segs[segs.length - 1];
            document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
            window.__acnToasts.length = 0;
            if (!seg) return 'no match';
            seg.click(); return seg.className + ': ' + seg.textContent.slice(0, 60);
        },
        gallery: async function () {
            // Through another panel, so an open Tools panel is drawn afresh, not toggled shut.
            document.getElementById('acn-dot-nav').click(); await S(200);
            document.getElementById('acn-dot-tools').click(); await S(500);
            var G = document.getElementById('acn-gallery-section');
            return { header: (G.querySelector('.acn-tool-section-header') || {}).textContent || '',
                     note: !!G.querySelector('[data-acn-history="partial"]'),
                     cards: Array.prototype.map.call(G.querySelectorAll('.acn-gallery-card'), function (c) {
                         return { label: c.getAttribute('data-acn-gallery-label') || (c.querySelector('.acn-gallery-label') || {}).textContent,
                                  thumb: c.getAttribute('data-acn-gallery-thumb'), text: c.textContent }; }) };
        },
        clickGallery: function (i) {
            var b = document.querySelectorAll('#acn-gallery-section .acn-gallery-card .acn-gallery-btn')[0];
            var cards = document.querySelectorAll('#acn-gallery-section .acn-gallery-card');
            document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
            window.__acnToasts.length = 0;
            if (!cards[i]) return false;
            (cards[i].querySelector('[data-acn-role="gallery-go"]') || cards[i].querySelector('.acn-gallery-btn')).click();
            return true;
        },
        bookmarks: async function () {
            document.getElementById('acn-dot-bookmarks').click(); await S(500);
            return Array.prototype.map.call(document.querySelectorAll('#acn-panel-bookmarks .acn-bk'), function (c) {
                return { label: c.querySelector('.acn-bk-type').textContent, text: c.querySelector('.acn-bk-text').textContent }; });
        },
        clickBookmark: async function (label) {
            document.getElementById('acn-dot-bookmarks').click(); await S(400);
            var c = Array.prototype.find.call(document.querySelectorAll('#acn-panel-bookmarks .acn-bk'), function (c) {
                return c.querySelector('.acn-bk-type').textContent === label; });
            if (!c) return false;
            window.__acnToasts.length = 0;
            c.click(); return true;
        },
        // Is el in view in scroller sc: a short element wholly; a tall one by its start.
        inView: function (sc, el) {
            if (!sc || !el || !el.isConnected) return { inView: false, top: null };
            var r = sc.getBoundingClientRect(), e = el.getBoundingClientRect();
            var tall = e.height > sc.clientHeight * 0.8;
            return { inView: tall ? (e.top >= r.top - 2 && e.top <= r.bottom - 20) : (e.top >= r.top - 2 && e.bottom <= r.bottom + 2),
                     top: Math.round(e.top - r.top), h: Math.round(e.height) };
        }
    };
}())`;

// The export's headings in order, and whether they alternate Q#1, A#1, Q#2, A#2 ... to the end.
function exportOrder(f, n) {
    const h = (f.match(/^## (User \(Q#\d+\)|Assistant \(A#\d+\))/gm) || []);
    let ok = h.length === 2 * n;
    for (let i = 0; ok && i < n; i++) {
        ok = h[2 * i] === '## User (Q#' + (i + 1) + ')' && h[2 * i + 1] === '## Assistant (A#' + (i + 1) + ')';
    }
    // And each body under its own heading: every fixture question reads "... question N ..." and every
    // answer starts "Answer N:" (Tier 3 r4).
    const parts = f.split(/^## /m).slice(1);
    for (let i = 0; ok && i < n; i++) {
        const qb = parts[2 * i] || '', ab = parts[2 * i + 1] || '';
        ok = new RegExp('question ' + (i + 1) + '\\b').test(qb) && new RegExp('\\n\\s*Answer ' + (i + 1) + ':').test(ab);
    }
    return { ok, count: h.length };
}
// What every answer's text adds up to, as Summary counts it (ChatGPT: a turn's text nodes joined by a
// blank line; Perplexity: the FINAL answer).
// Turn 6's second text node ends in a fenced block (GitHub Codex, PR #92: a split answer's other parts).
const SPLIT_FENCE = '\n\n```js\nconsole.log("okapi")\n```';
const gptAnswerChars = (T) => T.reduce((n, t) => n + t.answer.length + (t.lastAid ? ('\n\n' + 'and the second part of answer ' + (T.indexOf(t) + 1) + SPLIT_FENCE).length : 0), 0);
const pplxAnswerChars = (E) => E.reduce((n, e) => n + e.answer.length, 0);
const aiChars = (t) => parseInt(((t.match(/AI: ([0-9,]+) chars/) || [0, '0'])[1]).replace(/,/g, ''), 10);

// Waits for a jump to finish: a resolution or a toast, then the scroller still for 800 ms.
async function settle(pg, scSel, ms) {
    try {
        await pg.waitForFunction(() => document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') !== null ||
                                        (window.__acnToasts || []).length > 0, null, { timeout: ms || 20000 });
    } catch (e) {}
    let last = null, still = 0;
    for (let k = 0; k < 200 && still < 16; k++) {
        const st = await pg.evaluate((s) => { var e = document.querySelector(s); return e ? e.scrollTop : null; }, scSel);
        if (st === last) still++; else { still = 0; last = st; }
        await pg.waitForTimeout(50);
    }
}

// ── ChatGPT ───────────────────────────────────────────────────────────────────────────────────
const GPT_CONV = '6994e2d6-ce6c-832a-aa7d-04b747928fd8';
const uuid = (n, tag) => (tag || 'aaaaaaaa') + '-0000-4000-8000-' + String(n).padStart(12, '0');
const GPT_N = 24;
function gptTurns() {
    return Array.from({ length: GPT_N }, (_, i) => {
        let q = 'ChatGPT probe question ' + (i + 1) + ' about windowing?';
        let a = 'Answer ' + (i + 1) + ': the window holds a few turns and drops the rest.';
        if (i === 1) { q += ' quokka'; a += ' ocelot'; }
        if (i === 4) { q += ' lemur'; a += ' lemur'; }
        // A fenced block in an answer that is never mounted at the bottom: Summary's code inventory must list it.
        if (i === 2) a += '\n\n```python\nprint("kinkajou")\n```';
        if (i === 19) q += ' lemur';
        // Turn 6's answer has two shown text nodes, and the page names the FIRST on its unit (live: a
        // "fallback-turn-0" turn showing Q45's first node, Chrome, 2026-11-01). aid is what the DOM
        // names; lastAid is the turn's last shown node, the index's key for the answer.
        if (i === 5) return { id: uuid(i), text: q, aid: uuid(i, 'dddddddd'), lastAid: uuid(i, 'cccccccc'), answer: a };
        return { id: uuid(i), text: q, aid: uuid(i, 'cccccccc'), answer: a };
    });
}
function gptMapping(T) {
    const m = {};
    const add = (id, parent, message) => { m[id] = { id, parent, children: [], message }; if (parent) m[parent].children.push(id); };
    add('client-created-root', null, null);
    add('sys-0', 'client-created-root', { id: 'sys-0', author: { role: 'system' }, content: { content_type: 'text', parts: [''] }, metadata: {} });
    let prev = 'sys-0';
    T.forEach((t, i) => {
        const parts = [t.text], meta = {};
        if (i === 2) {   // Q3 carries two images, named by metadata.attachments (live shape)
            parts.push({ content_type: 'image_asset_pointer', asset_pointer: 'sediment://file_aaa111', width: 800, height: 600 });
            parts.push({ content_type: 'image_asset_pointer', asset_pointer: 'sediment://file_bbb222', width: 800, height: 600 });
            meta.attachments = [{ id: 'file_aaa111', name: 'hand-one.jpg', mime_type: 'image/jpeg' },
                                { id: 'file_bbb222', name: 'hand-two.jpg', mime_type: 'image/jpeg' }];
        }
        add(t.id, prev, { id: t.id, author: { role: 'user' }, content: { content_type: i === 2 ? 'multimodal_text' : 'text', parts }, metadata: meta });
        add(t.aid, t.id, { id: t.aid, author: { role: 'assistant' }, recipient: 'all', content: { content_type: 'text', parts: [t.answer] }, metadata: {} });
        prev = t.aid;
        if (t.lastAid) {
            add(t.lastAid, t.aid, { id: t.lastAid, author: { role: 'assistant' }, recipient: 'all',
                                    content: { content_type: 'text', parts: ['and the second part of answer ' + (i + 1) + SPLIT_FENCE] }, metadata: {} });
            prev = t.lastAid;
        }
    });
    return { title: 'probe', conversation_id: GPT_CONV, mapping: m, current_node: prev };
}

// ── Perplexity ────────────────────────────────────────────────────────────────────────────────
const PPLX_CONV = 'de5dd7ce-5eb6-4045-a861-d337141e10b6';
const PPLX_N = 12;
const S3 = 'https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/1/';
function pplxEntries() {
    return Array.from({ length: PPLX_N }, (_, i) => {
        let q = 'Perplexity probe question ' + (i + 1) + ' about pinned scrollers?';
        let a = 'Answer ' + (i + 1) + ': the pin releases on a wheel.';
        if (i === 0) a += ' manifest';
        if (i === 1) q += ' wombat';
        const final = { step_type: 'FINAL', content: { answer: JSON.stringify({ answer: a, web_results: [] }) } };
        const e = { backend_uuid: uuid(i, 'bbbbbbbb'), query_str: q, read_write_token: 'SECRET-RW-' + i,
                    text: JSON.stringify([{ step_type: 'INITIAL_QUERY', content: { query: q } }, final]),
                    attachments: [], answer: a };
        if (i === 9) e.attachments = [S3 + 'x/Screenshot-one.jpg?X-Amz-Signature=SIG1', S3 + 'x/Screenshot-two.png?X-Amz-Signature=SIG2',
                                      S3 + 'x/notes.pdf?X-Amz-Signature=SIG3'];
        return e;
    });
}
function pplxPage(all, url) {
    const u = new URL(url);
    const limit = parseInt(u.searchParams.get('limit') || '20', 10);
    const cur = u.searchParams.get('cursor');
    const start = cur ? parseInt(cur.replace('cur-', ''), 10) : 0;
    const more = start + limit < all.length;
    return { status: 'COMPLETED', entries: all.slice(start, start + limit).map((e) => { const c = Object.assign({}, e); delete c.answer; return c; }),
             has_next_page: more, next_cursor: more ? 'cur-' + (start + limit) : null };
}

// ── Gemini ────────────────────────────────────────────────────────────────────────────────────
const GM_CHAT = 'aa32aa32aa32aa32';
function gmTurnIdNode(n) {   // the mock's turnId(), for seeding legacy records
    function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
    return fnv(GM_CHAT + '#' + n) + fnv(n + '@' + GM_CHAT);
}
function fnv1a(str) {        // the userscript's _fnv1aHex / contentHash (schema-1 records)
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); h = h >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
}
const contentHash = (text, idx) => fnv1a(String(idx) + '|' + (text || '').substring(0, 200));
const GM_TOPICS = ['orbital transfer windows', 'tidal locking of moons', 'the Roche limit', 'gravity assists',
                   'Lagrange points', 'escape velocity', 'atmospheric drag on satellites', 'precession of orbits',
                   'Hohmann transfers', 'the Oberth effect', 'synchronous orbits', 'three-body chaos'];
function gmQuestion(n) {
    const t = GM_TOPICS[(n * 7) % GM_TOPICS.length], u = GM_TOPICS[(n * 5 + 3) % GM_TOPICS.length];
    return 'Gemini question ' + n + ': how would you explain ' + t + ' to someone who already knows ' + u +
           ', and which everyday example makes the difference between them easiest to see?';
}

// ── Claude ────────────────────────────────────────────────────────────────────────────────────
const ORG = '99999999-9999-4999-8999-999999999999';
const CL_CONV = 'b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7';
const CL_URL = 'https://claude.ai/chat/' + CL_CONV;
const CL_TURNS = 147;
const clUuid = (i) => CL_CONV.slice(0, 24) + String(i).padStart(12, '0');
function claudePayload() {
    const msgs = [], truth = [];
    let prev = '00000000-0000-4000-8000-000000000000';
    for (let t = 1; t <= CL_TURNS; t++) {
        // The last 30 turns change topic, so Summary's map has a far segment to click (L3).
        const late = t > 117;
        const qt = late ? 'Question number ' + t + ': which tomato seedlings need compost, mulch and watering in a greenhouse garden?'
                        : 'Question number ' + t + ': how do I handle case ' + t + ' when the input is unusual?';
        const q = { uuid: clUuid(msgs.length), parent_message_uuid: prev, sender: 'human',
                    content: [{ type: 'text', text: qt + ' VISIBLE-NOT-SR-ONLY' }],
                    attachments: [], files: [] };
        if (t === 100) q.files = [{ file_kind: 'image', file_uuid: 'f1f1f1f1-0000-4000-8000-000000000100', file_name: 'diagram-100.png',
                                    preview_asset: { url: '/api/' + ORG + '/files/f1f1f1f1-0000-4000-8000-000000000100/preview' } }];
        msgs.push(q); truth.push(q.uuid); prev = q.uuid;
        let at = late ? 'Answer number ' + t + ': tomato seedlings like compost, mulch, steady watering and greenhouse warmth.'
                      : 'Answer number ' + t + ': validate the input first, then branch on the result.';
        if (t === CL_TURNS) at += ' certificate';
        const a = { uuid: clUuid(msgs.length), parent_message_uuid: prev, sender: 'assistant', stop_reason: 'end_turn',
                    content: [{ type: 'text', text: at }], attachments: [], files: [] };
        msgs.push(a); truth.push(a.uuid); prev = a.uuid;
    }
    msgs.forEach((m, i) => { m.index = 1000 + i * 3; m.created_at = '2026-10-01T00:00:00Z'; m.text = ''; });
    return { payload: { uuid: CL_CONV, name: 'feature gaps', model: 'claude-opus-5-5', current_leaf_message_uuid: prev, chat_messages: msgs }, truth };
}
function claudeXhr(payload) {
    return `<script>
(function () {
    var BODY = ${JSON.stringify(JSON.stringify(payload))};
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, 10);
        }
        if (/\\/usage$/.test(url)) { respond(500, ''); return; }
        if (/\\/api\\/organizations$/.test(url)) { respond(200, JSON.stringify([{ uuid: ${JSON.stringify(ORG)}, name: 'Org', capabilities: ['chat'] }])); return; }
        if (/chat_conversations\\//.test(url)) { respond(200, BODY); return; }
        respond(404, '');
    };
    try { document.cookie = 'lastActiveOrg=' + ${JSON.stringify(ORG)} + '; path=/'; } catch (e) {}
}());
</script>`;
}

// ── The runner ────────────────────────────────────────────────────────────────────────────────
(async () => {
    const argv = process.argv;
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = argv.includes('--quiet');
    const showLogs = argv.includes('--logs');    // print the page's [ACN] lines after each site
    const only = argv.indexOf('--only') !== -1 ? argv[argv.indexOf('--only') + 1].split(',') : null;
    const want = (id) => !only || only.some((o) => id === o || id.indexOf(o) === 0);
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    const t00 = Date.now();
    let failures = 0;
    const pageErrors = [];
    function check(id, label, desc, ok, detail) {
        if (ok) { if (!quiet) console.log('  PASS  ' + id + ' [' + label + '] ' + desc + (detail ? ' — ' + detail : '')); }
        else { failures++; console.log('  FAIL  ' + id + ' [' + label + '] ' + desc + (detail ? ' — ' + detail : '')); }
    }
    async function open(url, html, api, opts) {
        opts = opts || {};
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const pg = await context.newPage();
        const logs = [], requests = [];
        pg.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
        pg.on('console', (m) => logs.push(m.text()));
        await pg.route('**/*', (route) => {
            const u = route.request().url();
            // A page's own blob: and data: URLs are not network requests (WebKit routes them here, and an
            // abort left C8's page images undecoded): through, and not counted.
            if (/^(blob|data):/.test(u)) { route.continue().catch(() => {}); return; }
            requests.push(u);
            if (u === url || (opts.urlPrefix && u.indexOf(opts.urlPrefix) === 0)) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }).catch(() => {});
                return;
            }
            const a = api ? api(u) : null;
            if (a) { route.fulfill({ status: a.status, contentType: 'application/json', body: a.body }).catch(() => {}); return; }
            route.abort().catch(() => {});
        });
        await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await pg.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        await pg.evaluate(HELPERS);
        return { context, pg, logs, requests };
    }
    async function navCount(pg, n, ms) {
        await pg.evaluate("document.getElementById('acn-dot-nav').click()");
        try {
            await pg.waitForFunction((x) => { const s = document.querySelector('[data-acn-role="nav-stat"]');
                return s && s.getAttribute('data-acn-count') === String(x); }, n, { timeout: ms || 20000 });
            return true;
        } catch (e) { return false; }
    }

    const ready = (o) => o.ready;
    console.log('check-feature-gaps — engine=' + engine + ', script=' + path.basename(scriptPath));

    // ── ChatGPT ─────────────────────────────────────────────────────────────────────────────
    async function gptOpen(failApi, store) {
        const T = gptTurns();
        const url = 'https://chatgpt.com/c/' + GPT_CONV;
        const html = page('chatgpt-windowed.html', raw, { turns: T, bmModel: { h: 420, window: 6 } }, store);
        const api = (u) => {
            if (u.endsWith('/api/auth/session')) return { status: 200, body: JSON.stringify({ accessToken: 'tok', expires: '2099-01-01T00:00:00.000Z' }) };
            if (u.indexOf('/backend-api/conversation/' + GPT_CONV) !== -1) return failApi ? { status: 500, body: '{}' } : { status: 200, body: JSON.stringify(gptMapping(T)) };
            return null;
        };
        const o = await open(url, html, api);
        o.T = T;
        o.ready = failApi ? true : await navCount(o.pg, GPT_N);
        await o.pg.waitForTimeout(400);
        return o;
    }
    if (['C1', 'C2', 'C3', 'C5', 'C6'].some(want)) {
        const o = await gptOpen(false);
        try {
            const pg = o.pg;
            if (want('C1')) {
                const a = await pg.evaluate("window.__h.search('ocelot')");
                const q = await pg.evaluate("window.__h.search('quokka')");
                const c = await pg.evaluate("window.__h.search('lemur')");
                // Turn 6's answer is two text nodes: its second is part of A#6, not another answer.
                const sp = await pg.evaluate("window.__h.search('second part of answer 6')");
                check('C1', 'new', 'ChatGPT Search: a word only in an unmounted answer and one only in a question; Q and A in position order; a split answer\'s second part is A#6',
                      o.ready && a.labels.join() === 'A#2' && q.labels.join() === 'Q#2' && c.labels.join() === 'Q#5,A#5,Q#20' && sp.labels.join() === 'A#6',
                      'ocelot=[' + a.labels + '] quokka=[' + q.labels + '] lemur=[' + c.labels + '] split=[' + sp.labels + ']');
            }
            if (want('C2')) {
                const clicked = await pg.evaluate("window.__h.clickSearch('ocelot', 'A#2')");
                if (showLogs) {
                    for (let k = 0; k < 12; k++) {
                        console.log('    t' + k + ' ' + JSON.stringify(await pg.evaluate(() => ({ clicked: 1,
                            res: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved'),
                            st: Math.round(document.getElementById('mock-scroller').scrollTop), win: window.__mockWindow.mounted().join(','),
                            tgt: (document.querySelector('[data-acn-jump-target]') || { outerHTML: '' }).outerHTML.slice(0, 80) }))));
                        await pg.waitForTimeout(500);
                    }
                    console.log('    clicked=' + clicked);
                }
                await settle(pg, '#mock-scroller');
                const m = await pg.evaluate((k) => {
                    const t = document.querySelector('#mock-scroller [data-turn-key="' + k + '"] [data-content-search-unit-key$=":assistant"]');
                    return Object.assign(window.__h.inView(document.getElementById('mock-scroller'), t),
                        { marked: !!(t && (t.hasAttribute('data-acn-jump-target') || t.querySelector('[data-acn-jump-target]') || t.closest('[data-acn-jump-target]'))),
                          toasts: window.__acnToasts.slice() });
                }, o.T[1].id);
                check('C2', 'new', 'ChatGPT Search: a click on the unmounted answer A#2, from the bottom, lands on it',
                      m.inView && m.marked && !m.toasts.length, JSON.stringify(m));
            }
            if (want('C3')) {
                const f = await pg.evaluate("window.__h.exportFull()") || '';
                const users = (f.match(/^## User \(Q#/gm) || []).length, ais = (f.match(/^## Assistant \(A#/gm) || []).length;
                const ord = exportOrder(f, 24);
                check('C3', 'new', 'ChatGPT full export: every question and answer, in order (Q#1, A#1 ... Q#24, A#24), the header counting the body',
                      /\*\*Messages:\*\* 48 \(24 user, 24 AI\)/.test(f) && users === 24 && ais === 24 && /ocelot/.test(f) && ord.ok &&
                      /Answer 6: [^#]*second part of answer 6/.test(f),
                      'header=' + ((f.match(/\*\*Messages:\*\*[^\n]*/) || [''])[0]) + ' body=' + users + '/' + ais + ' in order=' + ord.ok);
            }
            if (want('C5')) {
                // From the bottom, so Q3's answer (with the fenced block) is not mounted: a mounted answer is
                // inventoried from its DOM, which the mock renders as plain text.
                await pg.evaluate("window.__mockWindow.userScrollTo('bottom')");
                await pg.waitForTimeout(800);
                const t = await pg.evaluate("window.__h.summary()");
                const first = ((t.match(/msgs [0-9]+–[0-9]+/) || [''])[0]);
                // The code item of Q3's unmounted answer, clicked: it lands on that answer (Tier 3 r4, r5).
                const codeClicked = await pg.evaluate(() => {
                    const R = document.querySelector('[data-acn-role="sum-results"]');
                    const it = Array.prototype.filter.call(R.querySelectorAll('*'), (e) => /kinkajou/.test(e.textContent) && e.children.length < 3).pop();
                    document.getElementById('acn-zone').removeAttribute('data-acn-jump-resolved');
                    window.__acnToasts.length = 0;
                    if (!it) return false;
                    it.click(); return true;
                });
                await settle(pg, '#mock-scroller');
                const cm = await pg.evaluate((k) => Object.assign(window.__h.inView(document.getElementById('mock-scroller'),
                    document.querySelector('#mock-scroller [data-turn-key="' + k + '"] [data-content-search-unit-key$=":assistant"]')),
                    { toasts: window.__acnToasts.slice() }), o.T[2].id);
                check('C5b', 'new', 'ChatGPT Summary: the code item of an unmounted answer, clicked, lands on that answer',
                      codeClicked && cm.inView && !cm.toasts.length, 'clicked=' + codeClicked + ' ' + JSON.stringify(cm));
                // With turn 6 mounted (its answer shown as one unit naming its first part), the fence in its
                // SECOND part is still listed (GitHub Codex, PR #92).
                await pg.evaluate(() => window.__mockWindow.userScrollTo(5));
                await pg.waitForTimeout(1200);
                const t6 = await pg.evaluate("window.__h.summary()");
                check('C5c', 'new', 'ChatGPT Summary: a split answer whose first part is mounted still lists the code in its second part',
                      /js \u2014 console\.log\("okapi"\)/.test(t6), (t6.match(/CODE BLOCKS[^\n]*\n[^\n]*\n?[^\n]*/) || ['no code section'])[0].replace(/\n/g, ' / '));
                await pg.evaluate("window.__mockWindow.userScrollTo('bottom')");
                await pg.waitForTimeout(800);
                await pg.evaluate("window.__h.clickSegment('msgs 1\\u2013')");
                await settle(pg, '#mock-scroller');
                const m = await pg.evaluate((k) => Object.assign(window.__h.inView(document.getElementById('mock-scroller'),
                    document.querySelector('#mock-scroller [data-turn-key="' + k + '"] [data-user-message-bubble="true"]')),
                    { resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') }), o.T[0].id);
                // Every answer's text is analysed, the unmounted ones included: 24 answers of about 60 chars.
                check('C5', 'new', 'ChatGPT Summary: complete (24 answers\' text counted) and in order; the first segment, clicked from the bottom, lands on Q#1',
                      /Total turns: 48 \(24 user, 24 AI\)/.test(t) && aiChars(t) === gptAnswerChars(o.T) && /python \u2014 print\("kinkajou"\)/.test(t) &&
                      /^msgs 1–/.test(first) && m.inView && m.resolved === '0',
                      ((t.match(/Total turns:[^\n]*/) || [''])[0]) + ' AI chars=' + aiChars(t) + ' (expected ' + gptAnswerChars(o.T) + ')' +
                      ' code=' + /python \u2014 print/.test(t) + ' [' + (t.match(/(CODE[\s\S]{0,160})/i) || ['', 'no CODE section'])[1].replace(/\n/g, ' / ') + '] first=' + first + ' landing=' + JSON.stringify(m));
            }
            if (want('C6')) {
                const r0 = o.requests.length;
                const g = await pg.evaluate("window.__h.gallery()");
                const okCards = g.cards.length === 2 && g.cards.every((c) => c.label === 'Q#3' && c.thumb === 'placeholder') &&
                                /hand-one\.jpg/.test(g.cards[0].text) && /hand-two\.jpg/.test(g.cards[1].text);
                await pg.evaluate("window.__h.clickGallery(0)");
                await settle(pg, '#mock-scroller');
                const m = await pg.evaluate((k) => Object.assign(window.__h.inView(document.getElementById('mock-scroller'),
                    document.querySelector('#mock-scroller [data-turn-key="' + k + '"] [data-user-message-bubble="true"]')),
                    { resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') }), o.T[2].id);
                const fetched = o.requests.slice(r0).filter((u) => !/\/(api|backend-api)\/(auth\/session|conversation\/)/.test(u)).length;
                check('C6', 'new', 'ChatGPT gallery: the far Q3\'s two images listed from the index (placeholders, named), nothing requested for them; a click lands on Q#3',
                      okCards && fetched === 0 && m.inView && m.resolved === '2',
                      JSON.stringify(g.cards.map((c) => c.label + '/' + c.thumb)) + ' image requests=' + fetched + ' landing=' + JSON.stringify(m));
                // Q3 is mounted now. The page shows its images as blob: URLs it made itself (live): the
                // gallery uses those, and only those, as real thumbnails.
                const shown = await pg.evaluate(async (k) => {
                    const turn = document.querySelector('#mock-scroller [data-turn-key="' + k + '"]');
                    if (!turn) return 0;
                    // A real 80x60 PNG's bytes (a canvas's toBlob did not decode in WebKit headless).
                    const bin = atob('iVBORw0KGgoAAAANSUhEUgAAAFAAAAA8CAIAAAB+RarbAAAAYElEQVR4nO3PAQkAIBDAQKMZzWhGM4awP1iA3drnjmp9PwAGBgYGBgYeE3A94HrA9YDrAdcDrgdcD7gecD3gesD1gOsB1wOuB1wPuB5wPeB6wPWA6wHXA64HXA+4HnC9ByVXIaVfNi0WAAAAAElFTkSuQmCC');
                    const bytes = new Uint8Array(bin.length);
                    for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
                    const blob = new Blob([bytes], { type: 'image/png' });
                    for (let n = 0; n < 2; n++) {
                        const im = document.createElement('img');
                        im.src = URL.createObjectURL(blob);
                        turn.insertBefore(im, turn.firstChild);
                        await new Promise((r) => { im.onload = r; im.onerror = r; });
                    }
                    return Array.prototype.map.call(turn.querySelectorAll('img'), (im) => im.complete + '/' + im.naturalWidth + '/' + (im.currentSrc || im.src).slice(0, 5)).join(' ');
                }, o.T[2].id);
                const r1 = o.requests.length;
                const g2 = await pg.evaluate("window.__h.gallery()");
                const newReq = o.requests.slice(r1).filter((u) => !/\/(api|backend-api)\/(auth\/session|conversation\/)/.test(u)).length;
                check('C8', 'new', 'ChatGPT gallery: with Q3 mounted and its two images shown by the page (blob:), both cards show the page\'s thumbnail',
                      / \S+/.test(' ' + shown) && shown.split(' ').length === 2 && g2.cards.length === 2 && g2.cards.every((c) => c.thumb === 'page') && newReq === 0,
                      'page images=' + shown + ' ' + JSON.stringify(g2.cards.map((c) => c.thumb)) + ' requests=' + newReq);
            }
        } finally {
            if (showLogs) console.log(o.logs.filter((l) => /ACN/.test(l)).slice(-40).join('\n'));
            await o.context.close();
        }
    }
    if (want('C7')) {
        // A record saved the way v12.16 saved it, on turn 6's answer: keyed by the node its unit names.
        const T = gptTurns();
        const store = { 'acn-bookmarks-v1': JSON.stringify({ ['https://chatgpt.com/c/' + GPT_CONV]: { bookmarks: [{
            id: 'bm_fallback', schema: 2, entityType: 'ai-msg', contentHash: T[5].aid, msgUuid: T[5].aid,
            preview: 'Answer 6: the window holds a few turns', msgIndex: 5, createdAt: 1, platform: 'chatgpt.com' }] } }) };
        const o = await gptOpen(false, store);
        try {
            const pg = o.pg;
            const b = await pg.evaluate("window.__h.bookmarks()");
            await pg.evaluate(() => window.__mockWindow.userScrollTo(5));
            await pg.waitForTimeout(1500);
            const f = await pg.evaluate((k) => {
                const u = document.querySelector('#mock-scroller [data-turn-key="' + k + '"] [data-content-search-unit-key$=":assistant"]');
                const fl = u && u.querySelector('[data-acn-bookmark]');
                return fl ? { key: fl.getAttribute('data-acn-bookmark'), lit: fl.classList.contains('acn-bm-active') } : null;
            }, T[5].id);
            check('C7', 'new', 'ChatGPT: an answer whose unit names its turn\'s first text node is the indexed answer: the flag carries the index\'s key, lit for a record saved under the first node, labelled "Answer to Q#6"',
                  ready(o) && b.length === 1 && b[0].label === 'Answer to Q#6' && f && f.key === T[5].lastAid && f.lit,
                  'panel=' + JSON.stringify(b) + ' flag=' + JSON.stringify(f) + ' indexKey=' + T[5].lastAid);
        } finally { await o.context.close(); }
    }
    if (want('C4')) {
        const o = await gptOpen(true);
        try {
            const t0 = Date.now();
            while (Date.now() - t0 < 15000 && !o.logs.some((l) => /falling back to DOM scan/.test(l))) await o.pg.waitForTimeout(200);
            await o.pg.waitForTimeout(800);
            const f = await o.pg.evaluate("window.__h.exportFull()") || '';
            check('C4', 'new', 'ChatGPT with its index failed: the DOM export is stamped DEGRADED',
                  /DEGRADED/.test(f), ((f.match(/\*\*Source:\*\*[^\n]*/) || ['(no Source line)'])[0]));
        } finally { await o.context.close(); }
    }

    // ── Perplexity ──────────────────────────────────────────────────────────────────────────
    if (['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].some(want)) {
        const E = pplxEntries();
        const url = 'https://www.perplexity.ai/search/' + PPLX_CONV;
        const bmUrl = 'https://www.perplexity.ai/search/' + PPLX_CONV;
        // A bookmark made before v12.17 on answer 12: its preview kept the "Finished" label.
        const store = { 'acn-bookmarks-v1': JSON.stringify({ [bmUrl]: { bookmarks: [{
            id: 'bm_finished1', schema: 2, entityType: 'ai-msg', contentHash: E[11].backend_uuid + ':answer',
            msgUuid: E[11].backend_uuid + ':answer', preview: 'FinishedAnswer 12: the pin releases on a wheel.',
            msgIndex: 11, createdAt: 1792898179730, platform: 'www.perplexity.ai' }] } }) };
        const html = page('perplexity-windowed.html', raw,
            { entries: E.map((e) => ({ text: e.query_str, answer: e.answer })), bmModel: { q: 100, a: 500, around: 1, finished: true } }, store);
        const api = (u) => u.indexOf('/rest/thread/' + PPLX_CONV) !== -1 ? { status: 200, body: JSON.stringify(pplxPage(E, u)) } : null;
        const o = await open(url, html, api);
        try {
            const pg = o.pg;
            const ready = await navCount(pg, PPLX_N);
            await pg.waitForTimeout(400);
            if (want('P1')) {
                const a = await pg.evaluate("window.__h.search('manifest')");
                const q = await pg.evaluate("window.__h.search('wombat')");
                const f = await pg.evaluate("window.__h.search('finished')");
                check('P1', 'new', 'Perplexity Search: a word only in an unmounted answer (A#1), one only in a question (Q#2); no "Finished" label in answer text',
                      ready && a.labels.join() === 'A#1' && q.labels.join() === 'Q#2' && f.labels.length === 0,
                      'manifest=[' + a.labels + '] wombat=[' + q.labels + '] finished=[' + f.labels + ']');
            }
            if (want('P2')) {
                await pg.evaluate("window.__h.clickSearch('manifest', 'A#1')");
                await settle(pg, '#mock-scroller');
                const m = await pg.evaluate(() => {
                    const fins = Array.prototype.filter.call(document.querySelectorAll('[data-workflow-final-text]'),
                        (f) => /Answer 1: /.test(f.textContent));
                    return Object.assign(window.__h.inView(document.getElementById('mock-scroller'), fins[0] || null),
                                         { toasts: window.__acnToasts.slice() });
                });
                // An answer lands at its start (_bmIxJump, block 'start'), not merely somewhere in view.
                check('P2', 'new', 'Perplexity Search: a click on the unmounted answer A#1, from the bottom, lands with its start at the top',
                      m.inView && m.top !== null && Math.abs(m.top) <= 24 && !m.toasts.length, JSON.stringify(m));
            }
            if (want('P3')) {
                const f = await pg.evaluate("window.__h.exportFull()") || '';
                const users = (f.match(/^## User \(Q#/gm) || []).length, ais = (f.match(/^## Assistant \(A#/gm) || []).length;
                const ord = exportOrder(f, 12);
                check('P3', 'new', 'Perplexity full export: 12 questions and 12 answers in order, the header counting the body, no "Finished"',
                      /\*\*Messages:\*\* 24 \(12 user, 12 AI\)/.test(f) && users === 12 && ais === 12 && ord.ok && /manifest/.test(f) && !/Finished/.test(f),
                      'header=' + ((f.match(/\*\*Messages:\*\*[^\n]*/) || [''])[0]) + ' body=' + users + '/' + ais + ' in order=' + ord.ok);
            }
            if (want('P4')) {
                const t = await pg.evaluate("window.__h.summary()");
                check('P4', 'new', 'Perplexity Summary: 12 user and 12 AI messages, every answer\'s text counted, no "Finished"',
                      /Total turns: 24 \(12 user, 12 AI\)/.test(t) && aiChars(t) === pplxAnswerChars(E) && !/Finished/.test(t),
                      ((t.match(/Total turns:[^\n]*/) || [''])[0]) + ' AI chars=' + aiChars(t) + ' (expected ' + pplxAnswerChars(E) + ')');
            }
            if (want('P5')) {
                const r0 = o.requests.length;
                const g = await pg.evaluate("window.__h.gallery()");
                const okCards = g.cards.length === 2 && g.cards.every((c) => c.label === 'Q#10' && c.thumb === 'placeholder') &&
                                /Screenshot-one\.jpg/.test(g.cards[0].text) && /Screenshot-two\.png/.test(g.cards[1].text);
                await pg.evaluate("window.__h.clickGallery(0)");
                await settle(pg, '#mock-scroller');
                const m = await pg.evaluate(() => Object.assign(window.__h.inView(document.getElementById('mock-scroller'),
                    document.querySelector('[data-workflow-entry="9"] [data-message-bubble="right"]')),
                    { resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') }));
                // Anything but the thread's own API, any host: the S3 links above all.
                const s3 = o.requests.slice(r0).filter((u) => u.indexOf('/rest/thread/') === -1).length;
                check('P5', 'new', 'Perplexity gallery: entry 10\'s two images listed by name (not the PDF), nothing requested from the S3 host; a click lands on Q#10',
                      okCards && s3 === 0 && m.inView && m.resolved === '9',
                      JSON.stringify(g.cards.map((c) => c.label + '/' + c.thumb)) + ' s3 requests=' + s3 + ' landing=' + JSON.stringify(m));
            }
            if (want('P6')) {
                const b = await pg.evaluate("window.__h.bookmarks()");
                check('P6', 'new', 'Perplexity: an answer bookmark saved with the "Finished" label shows its text without it',
                      b.length === 1 && !/^Finished/.test(b[0].text) && /^Answer 12/.test(b[0].text), JSON.stringify(b));
            }
        } finally { await o.context.close(); }
    }

    if (want('P7')) {
        // The thread's index fails: the DOM fallback writes what is mounted, stamped, without the label.
        const E = pplxEntries();
        const url = 'https://www.perplexity.ai/search/' + PPLX_CONV;
        const html = page('perplexity-windowed.html', raw,
            { entries: E.map((e) => ({ text: e.query_str, answer: e.answer })), bmModel: { q: 100, a: 500, around: 1, finished: true } });
        const o = await open(url, html, (u) => u.indexOf('/rest/thread/') !== -1 ? { status: 500, body: '{}' } : null);
        try {
            const t0 = Date.now();
            while (Date.now() - t0 < 15000 && !o.logs.some((l) => /falling back to DOM scan/.test(l))) await o.pg.waitForTimeout(200);
            await o.pg.waitForTimeout(800);
            const f = await o.pg.evaluate("window.__h.exportFull()") || '';
            const ais = (f.match(/^## Assistant \(A#/gm) || []).length;
            check('P7', 'new', 'Perplexity with its index failed: the DOM export is stamped DEGRADED, one section per mounted answer, no "Finished"',
                  /DEGRADED/.test(f) && ais >= 1 && ais <= 4 && !/Finished/.test(f),
                  ((f.match(/\*\*Messages:\*\*[^\n]*/) || ['(none)'])[0]) + ' answers=' + ais + ' finished=' + /Finished/.test(f));
        } finally { await o.context.close(); }
    }

    // ── Gemini ──────────────────────────────────────────────────────────────────────────────
    async function gmOpen(cfg, store) {
        const url = 'https://gemini.google.com/app/' + GM_CHAT;
        const html = page('gemini-history.html', raw, Object.assign({ chats: { [GM_CHAT]: 32 }, page: 10, loadDelayMs: 300 }, cfg || {}), store);
        const o = await open(url, html, null);
        await o.pg.waitForFunction(() => window.__mockGemini && window.__mockGemini.loaded() === 10, null, { timeout: 20000 });
        await o.pg.waitForTimeout(1500);
        return o;
    }
    const GSC = 'infinite-scroller.chat-history';
    // The whole history, as live: to the top, a page arrives (10, 20, 30, then 2), again until none
    // is pending. The last page is short, which is how the navigator knows the start is in (DEC-057);
    // the mock's loadAll() prepends 22 turns in one step, which proves nothing.
    async function gmLoadPages(pg) {
        // One page at a time, each seen by a scan (500 ms debounce) before the next is asked for: live
        // a page takes seconds to arrive and render, so no scan sees two at once.
        for (let k = 0; k < 12; k++) {
            const n0 = await pg.evaluate(() => window.__mockGemini.loaded());
            if (n0 >= 32) break;
            await pg.evaluate(() => window.__mockGemini.userScroll('top'));
            try { await pg.waitForFunction((n) => window.__mockGemini.loaded() > n && !window.__mockGemini.pending(), n0, { timeout: 5000 }); }
            catch (e) {}
            await pg.waitForTimeout(1300);
        }
        await pg.waitForTimeout(600);
    }
    if (['G1', 'G2', 'G3', 'G4', 'G5'].some(want)) {
        const o = await gmOpen({});
        try {
            const pg = o.pg;
            if (want('G1')) {
                const s = await pg.evaluate("window.__h.search('question 31')");
                const g = await pg.evaluate("window.__h.gallery()");
                await pg.evaluate("window.__h.summary()");
                const sn = await pg.evaluate(() => !!document.querySelector('[data-acn-role="sum-results"] [data-acn-history="partial"]'));
                check('G1', 'new', 'Gemini, 10 of 32 turns loaded: Search, the gallery and Summary say older messages are not loaded',
                      s.note && g.note && sn, 'search note=' + s.note + ' gallery note=' + g.note + ' summary note=' + sn);
            }
            if (want('G2')) {
                const f = await pg.evaluate("window.__h.exportFull()") || '';
                check('G2', 'new', 'Gemini, 10 of 32 turns loaded: the full export says older messages were not loaded',
                      /Older messages were not loaded/.test(f), ((f.match(/\*\*Source:\*\*[^\n]*/) || ['(no Source line)'])[0]));
            }
            if (['G3', 'G4', 'G5'].some(want)) {
                // A bookmark on the latest question while the history is partial: keyed by its turn's id.
                const late = await pg.evaluate(() => {
                    const t = window.__mockGemini.turnId(32);
                    const f = document.querySelector('div.conversation-container[id="' + t + '"] div.query-text [data-acn-bookmark]');
                    if (f) f.click();
                    return { t, key: f ? f.getAttribute('data-acn-bookmark') : null };
                });
                await pg.waitForTimeout(500);
                const b1 = await pg.evaluate("window.__h.bookmarks()");
                check('G3', 'new', 'Gemini: a question flag is keyed by its turn\'s id, and while history is partial its label is not final ("Q#…")',
                      late.key === late.t && b1.length === 1 && b1[0].label === 'Q#…', 'key=' + late.key + ' turn=' + late.t + ' ' + JSON.stringify(b1));
                // The whole history in; Q1 and its answer bookmarked.
                await gmLoadPages(pg);
                const early = await pg.evaluate(() => {
                    const t = window.__mockGemini.turnId(1);
                    const turn = document.querySelector('div.conversation-container[id="' + t + '"]');
                    const q = turn.querySelector('div.query-text [data-acn-bookmark]');
                    const a = Array.prototype.find.call(turn.querySelectorAll('[data-acn-bookmark]'), (f) => /:answer$/.test(f.getAttribute('data-acn-bookmark')));
                    if (q) q.click();
                    if (a) a.click();
                    return { t, q: q && q.getAttribute('data-acn-bookmark'), a: a && a.getAttribute('data-acn-bookmark') };
                });
                await pg.waitForTimeout(500);
                const b2 = await pg.evaluate("window.__h.bookmarks()");
                const labels = b2.map((b) => b.label).sort().join('|');
                const exp = await pg.evaluate("window.__h.exportBookmarks()") || '';
                check('G4', 'new', 'Gemini, history loaded: labels Q#32, Q#1 and "Answer to Q#1", keyed <id> and <id>:answer; the bookmarks export the same',
                      early.q === early.t && early.a === early.t + ':answer' && labels === 'Answer to Q#1|Q#1|Q#32' &&
                      /## \S+ Q#1 —/.test(exp) && /## \S+ Answer to Q#1 —/.test(exp) && /## \S+ Q#32 —/.test(exp),
                      JSON.stringify(early) + ' labels=' + labels);
                if (want('G5')) {
                    await pg.evaluate(() => window.__mockGemini.userScroll('bottom'));
                    await pg.waitForTimeout(600);
                    await pg.evaluate("window.__h.clickBookmark('Answer to Q#1')");
                    await settle(pg, GSC);
                    const m = await pg.evaluate((t) => Object.assign(window.__h.inView(document.querySelector('infinite-scroller.chat-history'),
                        document.querySelector('div.conversation-container[id="' + t + '"] .response-content')), { toasts: window.__acnToasts.slice() }), early.t);
                    check('G5', 'new', 'Gemini: the answer bookmark, clicked from the bottom after the history loaded above it, lands on its turn',
                          m.inView && !m.toasts.length, JSON.stringify(m));
                }
            }
        } finally { await o.context.close(); }
    }
    if (want('G6')) {
        // Two positional records from before v12.17, made with the whole history loaded: one that
        // proves (its hash at its place, its place its Navigate index, its text unique), one that
        // does not (its place is wrong). The first binds to its turn; the second reads "Q#?".
        const url = 'https://gemini.google.com/app/' + GM_CHAT;
        const q5 = 'You said' + gmQuestion(5);
        const rec = (id, idx, text) => ({ id, schema: 1, entityType: 'user-msg', contentHash: contentHash(text, idx), msgUuid: null,
                                          preview: text.substring(0, 120), msgIndex: idx, createdAt: 1, platform: 'gemini.google.com' });
        const store = { 'acn-bookmarks-v1': JSON.stringify({ [url]: { bookmarks: [rec('bm_proof', 4, gmQuestion(5)), rec('bm_wrong', 6, gmQuestion(5))] } }) };
        const o = await gmOpen({}, store);
        try {
            // While only the newest page is loaded, nothing binds: the place and the uniqueness are not the
            // whole chat's yet (Q5 is not even loaded).
            await o.pg.waitForTimeout(1500);
            const early = await o.pg.evaluate(() => JSON.parse(window.__acnStore()['acn-bookmarks-v1'] || '{}'));
            const earlyBound = (((early[url] || {}).bookmarks) || []).filter((r) => r.msgUuid).length;
            await gmLoadPages(o.pg);
            const b = await o.pg.evaluate("window.__h.bookmarks()");
            const st = await o.pg.evaluate(() => JSON.parse(window.__acnStore()['acn-bookmarks-v1'] || '{}'));
            const recs = (st[url] || {}).bookmarks || [];
            const proof = recs.find((r) => r.id === 'bm_proof') || {}, wrong = recs.find((r) => r.id === 'bm_wrong') || {};
            check('G6', 'new', 'Gemini: a positional record binds to its turn only on proof ("Q#5"); one that does not prove reads "Q#?"',
                  earlyBound === 0 && proof.msgUuid === gmTurnIdNode(5) && !wrong.msgUuid && b.map((x) => x.label).sort().join('|') === 'Q#5|Q#?',
                  'bound while partial=' + earlyBound + ' labels=' + b.map((x) => x.label).join('|') + ' proof.msgUuid=' + proof.msgUuid + ' turn5=' + gmTurnIdNode(5) + ' (preview ' + JSON.stringify(q5.slice(0, 10)) + ')');
        } finally { await o.context.close(); }
    }
    if (want('G9')) {
        // A record made on Q5 with the whole history loaded (msgIndex 4), in a chat where Q27 asks Q5's
        // question word for word. At load only turns 23-32 are in, and Q27 sits at index 4 with the same
        // text: a proof run then would bind the record to Q27. Nothing may bind before the start is
        // loaded, and once it is, the repeat makes the record unprovable: "Q#?" (Tier 3).
        const url = 'https://gemini.google.com/app/' + GM_CHAT;
        const rec = { id: 'bm_dup', schema: 1, entityType: 'user-msg', contentHash: contentHash(gmQuestion(5), 4), msgUuid: null,
                      preview: gmQuestion(5).substring(0, 120), msgIndex: 4, createdAt: 1, platform: 'gemini.google.com' };
        const o = await gmOpen({ sameText: { 27: 5 } }, { 'acn-bookmarks-v1': JSON.stringify({ [url]: { bookmarks: [rec] } }) });
        try {
            await o.pg.waitForTimeout(1500);
            const early = await o.pg.evaluate(() => JSON.parse(window.__acnStore()['acn-bookmarks-v1'] || '{}'));
            const e0 = ((early[url] || {}).bookmarks || [])[0] || {};
            await gmLoadPages(o.pg);
            const b = await o.pg.evaluate("window.__h.bookmarks()");
            const st = await o.pg.evaluate(() => JSON.parse(window.__acnStore()['acn-bookmarks-v1'] || '{}'));
            const r = ((st[url] || {}).bookmarks || [])[0] || {};
            check('G9', 'new', 'Gemini: a positional record is never bound while history is partial (Q27 repeats its Q5 there), and the repeat leaves it "Q#?"',
                  !e0.msgUuid && !r.msgUuid && b.length === 1 && b[0].label === 'Q#?',
                  'bound at load=' + (e0.msgUuid || null) + ' (turn27=' + gmTurnIdNode(27) + ') after=' + (r.msgUuid || null) + ' label=' + (b[0] || {}).label);
        } finally { await o.context.close(); }
    }
    if (want('G10')) {
        // A 30-turn chat: pages of 10, 20, 30, the last one full, so nothing short proves the start; only
        // 8 s at the top does (DEC-057). No scan follows that timer, and a provable positional record
        // must still bind then (Tier 3 r3).
        const C30 = 'ee30ee30ee30ee30';
        const url = 'https://gemini.google.com/app/' + C30;
        function tid(n) {
            function fnv(x) { let h = 0x811c9dc5; for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
            return fnv(C30 + '#' + n) + fnv(n + '@' + C30);
        }
        const rec = { id: 'bm_timer', schema: 1, entityType: 'user-msg', contentHash: contentHash(gmQuestion(5), 4), msgUuid: null,
                      preview: gmQuestion(5).substring(0, 120), msgIndex: 4, createdAt: 1, platform: 'gemini.google.com' };
        const html = page('gemini-history.html', raw, { chats: { [C30]: 30 }, page: 10, loadDelayMs: 300 },
                          { 'acn-bookmarks-v1': JSON.stringify({ [url]: { bookmarks: [rec] } }) });
        const o = await open(url, html, null);
        try {
            const pg = o.pg;
            await pg.waitForFunction(() => window.__mockGemini && window.__mockGemini.loaded() === 10, null, { timeout: 20000 });
            await pg.waitForTimeout(1500);
            for (let k = 0; k < 4; k++) {
                const n0 = await pg.evaluate(() => window.__mockGemini.loaded());
                if (n0 >= 30) break;
                await pg.evaluate(() => window.__mockGemini.userScroll('top'));
                try { await pg.waitForFunction((n) => window.__mockGemini.loaded() > n && !window.__mockGemini.pending(), n0, { timeout: 5000 }); } catch (e) {}
                await pg.waitForTimeout(1300);
            }
            const before = await pg.evaluate(() => JSON.parse(window.__acnStore()['acn-bookmarks-v1'] || '{}'));
            const b0 = (((before[url] || {}).bookmarks) || [])[0] || {};
            // The bookmarks panel open while the 8 s rule completes the chat: it must redraw too.
            await pg.evaluate(() => document.getElementById('acn-dot-bookmarks').click());
            await pg.waitForTimeout(300);
            await pg.evaluate(() => window.__mockGemini.userScroll('top'));
            await pg.waitForTimeout(10000);
            const shownLabel = await pg.evaluate(() => (document.querySelector('#acn-panel-bookmarks .acn-bk-type') || {}).textContent || null);
            const after = await pg.evaluate(() => JSON.parse(window.__acnStore()['acn-bookmarks-v1'] || '{}'));
            const b1 = (((after[url] || {}).bookmarks) || [])[0] || {};
            check('G10', 'new', 'Gemini: a chat whose last page is a full 10 completes by the 8 s rule, and a provable positional record binds then',
                  !b0.msgUuid && b1.msgUuid === tid(5) && shownLabel === 'Q#5',
                  'before=' + (b0.msgUuid || null) + ' after=' + (b1.msgUuid || null) + ' turn5=' + tid(5) + ' open panel=' + shownLabel);
        } finally { await o.context.close(); }
    }
    if (['G7', 'G8'].some(want)) {
        // The content-visibility model with the live 500 px estimate: a glide from the bottom to a
        // far turn grows the list under it (DEC-057).
        const o = await gmOpen({ cv: true, cvEstimate: 500 });
        try {
            const pg = o.pg;
            await gmLoadPages(pg);
            await pg.evaluate(() => window.__mockGemini.userScroll('bottom'));
            await pg.waitForTimeout(800);
            if (want('G7')) {
                await pg.evaluate("window.__h.clickSearch('Answer 2, part 1', 'A#2')");
                await settle(pg, GSC);
                const m = await pg.evaluate(() => Object.assign(window.__h.inView(document.querySelector('infinite-scroller.chat-history'),
                    document.querySelector('div.conversation-container[id="' + window.__mockGemini.turnId(2) + '"] .response-content')),
                    { toasts: window.__acnToasts.slice() }));
                check('G7', 'guard', 'Gemini (content-visibility): Search\'s far answer A#2, clicked from the bottom, lands',
                      m.inView && !m.toasts.length, JSON.stringify(m));
                await pg.evaluate(() => window.__mockGemini.userScroll('bottom'));
                await pg.waitForTimeout(800);
            }
            if (want('G8')) {
                await pg.evaluate("window.__h.summary()");
                await pg.evaluate("window.__h.clickSegment('msgs 1\\u2013')");
                await settle(pg, GSC);
                const m = await pg.evaluate(() => Object.assign(window.__h.inView(document.querySelector('infinite-scroller.chat-history'),
                    document.querySelector('div.conversation-container[id="' + window.__mockGemini.turnId(1) + '"] div.query-text')),
                    { toasts: window.__acnToasts.slice() }));
                check('G8', 'guard', 'Gemini (content-visibility): Summary\'s first segment, clicked from the bottom, lands on Q#1',
                      m.inView && !m.toasts.length, JSON.stringify(m));
            }
        } finally { await o.context.close(); }
    }

    // ── Claude ──────────────────────────────────────────────────────────────────────────────
    if (['L1', 'L2', 'L3', 'L5', 'L6'].some(want)) {
        const { payload, truth } = claudePayload();
        const cfg = { totalMessages: CL_TURNS * 2, tailRows: 3, answerTestid: true, answerHeaders: true,
                      turnKeys: truth.slice(), perfRow: true, tailAtEnd: true };
        // Bookmarks on Q147's answer, Q100 and Q100's answer (schema 2, by uuid), for L4-L6.
        const bm = (id, row, type) => ({ id, schema: 2, entityType: type, contentHash: truth[row], msgUuid: truth[row],
                                         preview: 'p', msgIndex: 0, createdAt: row, platform: 'claude.ai',
                                         pendingHash: null, pendingSender: null, pendingOrdinal: -1, pendingRow: -1 });
        const clStore = { 'acn-bookmarks-v1': JSON.stringify({ [CL_URL]: { bookmarks: [
            bm('bm_a147', 293, 'ai-msg'), bm('bm_q100', 198, 'user-msg'), bm('bm_a100', 199, 'ai-msg')] } }) };
        const html = page('claude-virtualized.html', raw, cfg, clStore, claudeXhr(payload));
        const o = await open(CL_URL, html, null);
        const SC = '#mock-scroll-container';
        try {
            const pg = o.pg;
            const t0 = Date.now();
            while (Date.now() - t0 < 30000 && !o.logs.some((l) => /conversation index ready/.test(l))) await pg.waitForTimeout(200);
            await pg.waitForTimeout(1500);
            const toTop = async () => {
                await pg.evaluate(() => { const c = document.getElementById('mock-scroll-container'); c.scrollTop = 0; c.dispatchEvent(new Event('scroll')); });
                await pg.waitForTimeout(800);
            };
            const rowEl = (row) => `document.querySelector('#mock-feed [data-index="${row}"]')`;
            if (want('L1')) {
                const r0 = o.requests.length;
                const g = await pg.evaluate("window.__h.gallery()");
                await pg.evaluate("window.__h.clickGallery(0)");
                await settle(pg, SC);
                const m = await pg.evaluate(`Object.assign(window.__h.inView(document.querySelector('${SC}'), ${rowEl(198)}),
                    { resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') })`);
                // The page loaded no image here (no files panel in the mock): nothing at all may be requested.
                const fetched = o.requests.slice(r0).length;
                check('L1', 'new', 'Claude gallery: Q100\'s image listed from the index as "Q#100", nothing requested for it; a click from the bottom lands on its row',
                      g.cards.length === 1 && g.cards[0].label === 'Q#100' && fetched === 0 && m.resolved === '198' && m.inView,
                      JSON.stringify(g.cards.map((c) => c.label + '/' + c.thumb)) + ' landing=' + JSON.stringify(m));
            }
            if (want('L2')) {
                await toTop();
                await pg.evaluate("window.__h.clickSearch('certificate', 'A#147')");
                await settle(pg, SC, 30000);
                const m = await pg.evaluate(`Object.assign(window.__h.inView(document.querySelector('${SC}'), ${rowEl(293)}),
                    { resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved'), toasts: window.__acnToasts.slice() })`);
                check('L2', 'new', 'Claude Search: the last answer, clicked from the top, lands (ROADMAP 14)',
                      m.resolved === '293' && m.inView && !m.toasts.length, JSON.stringify(m));
            }
            if (want('L3')) {
                const sumText = await pg.evaluate("window.__h.summary()");
                if (showLogs) console.log('    segments: ' + (sumText.match(/msgs [0-9]+\u2013[0-9]+/g) || []).join(' '));
                await toTop();
                const hit = await pg.evaluate("window.__h.clickSegment('msgs (2[0-9][0-9])\\u2013294')");
                await settle(pg, SC, 30000);
                const m = await pg.evaluate(() => ({ resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved'),
                                                     toasts: window.__acnToasts.slice() }));
                const v = m.resolved !== null ? await pg.evaluate(`window.__h.inView(document.querySelector('${SC}'), document.querySelector('#mock-feed [data-index="${m.resolved}"]'))`) : { inView: false };
                check('L3', 'guard', 'Claude Summary: the last segment, clicked from the top, lands on its first message',
                      m.resolved !== null && +m.resolved >= 200 && v.inView && !m.toasts.length, 'clicked ' + JSON.stringify(hit) + ' ' + JSON.stringify(Object.assign(m, v)));
            }
            // Bookmark jumps from the top: through the settle loop where the target cannot be placed from
            // there, ending in a landing rather than an unchecked glide (v12.17).
            // L4 (the last answer) is not here: it is mounted from the top and lands through v12.16's
            // ciLandFar, which this PR did not change, and this measure puts it 218 px off on both builds
            // (logged, ROADMAP 13). L5's short bubble lands on v12.16 too: a guard.
            const bmRuns = [['L5', 'Q#100', 198, 'Q100', 'guard'], ['L6', 'Answer to Q#100', 199, 'Q100\'s answer', 'new']];
            for (const [id, label, row, what, kind] of bmRuns) {
                if (!want(id)) continue;
                await toTop();
                const clicked = await pg.evaluate((l) => window.__h.clickBookmark(l), label);
                await settle(pg, SC, 30000);
                // Where the marked target sits against where a landing puts it: a short one centred, one
                // taller than 0.8 x the view at its start (ixLandOn). An unchecked glide centres a tall one.
                // The landed element as check-claude-far-jump measures it (the mark itself does not survive
                // the virtualizer re-rendering): an answer's row, a question's bubble; err is scrollTop minus
                // the intended scrollTop, clamped at the scroll ends.
                const m = await pg.evaluate(`(function () {
                    var sc = document.querySelector('${SC}'), rowE = ${rowEl(row)};
                    var land = rowE && (${row % 2} === 1 ? rowE : rowE.querySelector('[data-user-message-bubble="true"]'));
                    var out = Object.assign(window.__h.inView(sc, rowE),
                        { resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved'), toasts: window.__acnToasts.slice(), err: null });
                    if (land) {
                        var r = sc.getBoundingClientRect(), e = land.getBoundingClientRect();
                        var top = e.top - r.top - sc.clientTop + sc.scrollTop;
                        var lead = e.height > sc.clientHeight * 0.8 ? 0 : (sc.clientHeight - e.height) / 2;
                        var max = sc.scrollHeight - sc.clientHeight;
                        out.err = Math.round(sc.scrollTop - Math.max(0, Math.min(max, top - lead)));
                        out.landH = Math.round(e.height);
                    }
                    return out;
                })()`);
                check(id, kind, 'Claude bookmark: ' + what + ', clicked from the top, lands at its intended place',
                      clicked && m.resolved === String(row) && m.inView && !m.toasts.length && m.err !== null && Math.abs(m.err) <= 24,
                      'clicked=' + clicked + ' ' + JSON.stringify(m));
            }
        } finally { await o.context.close(); }
    }

    check('E', 'guard', 'no page errors in any fixture', pageErrors.length === 0, pageErrors.slice(0, 3).join(' / '));
    await browser.close();
    console.log((failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed') + ' (' + engine + ', ' + ((Date.now() - t00) / 1000).toFixed(1) + ' s)');
    process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
