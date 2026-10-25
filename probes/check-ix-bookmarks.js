// Checks for ChatGPT and Perplexity bookmarks by id (v12.15 part A), and the bookmark store's key
// on those sites (one set per conversation, whichever URL shows it).
//
// Run: node probes/check-ix-bookmarks.js [--browser chromium|firefox|webkit] [--quiet] [--site chatgpt|perplexity]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-ix-bookmarks.js
// Exits non-zero on any failed check.
//
// THE BUG THIS GATES (owner, Safari, v12.14): on both sites a bookmark was contentHash(text, its
// place among the MOUNTED messages), labelled by that place and jumped to only while mounted. Under
// windowing (5-8 messages mounted) two different questions read "Q#4", a 16-question thread showed
// only Q1-Q4, a flag went dark after scrolling (and its click made a second record), an off-screen
// bookmark could not be reached, and no answer had a flag: ChatGPT's answer selectors matched 0
// nodes live, and Perplexity's [class*="prose"] matched 22, so v12.14 drew 5 flags into one answer
// (live, Chrome, page realm, v12.14, 2026-10-24). Bookmarks were also filed under origin + pathname,
// so ChatGPT's /g/<project>/c/<id> and /c/<id>, and www.perplexity.ai and perplexity.ai, kept two
// sets for one chat.
//
// THE MOCKS: the bmModel blocks appended to tests/mock-pages/chatgpt-windowed.html and
// perplexity-windowed.html (off by default), built from the live markup: ChatGPT's answer unit with
// its message ids inside the question's turn, a hidden second timeline; Perplexity's alternating
// [question slot, answer slot] list whose unmounted slots keep their height, one
// [data-workflow-final-text] per answer with nested "prose" list items, a "prose" node outside the
// thread, and (qLag) an answer mounted while its question slot is empty. The index payloads hold
// several assistant nodes per turn (thoughts, a text preamble, a tool call, the final text), a
// hidden user node, an entry with an empty query_str and one without a backend_uuid.
// CONTEXT of these results: Playwright, page realm, headless, viewport 1280x720, the userscript
// inlined into the page, GM storage a synchronous in-page shim (the Tampermonkey shape), the index
// answered by page.route (the fetch transport). Real-browser behaviour is the owner's acceptance.
//
// Checks ([new] must FAIL on v12.14; [guard] passes on both):
//   K1  [new]   one flag per mounted question and answer, at the bottom, the middle and the top;
//               none in the hidden timeline (ChatGPT), on nested "prose" nodes or the decoy (Perplexity)
//   K2  [new]   question flags and records carry data-turn-key / the entry's backend_uuid, schema 2;
//               (K2c) both records store the Navigate index at the click as msgIndex, also when the
//               ChatGPT flags were drawn before the index landed
//   K3  [new]   answer flags and records carry the turn's last shown text node id / backend_uuid:answer
//   K4  [new]   labels: the Navigate number ("Q#16" and "Q#1" differ), "Answer to Q#16", Korean, the
//               export in label order
//   K5  [new]   Perplexity: after an entry with an empty query_str, a question's key is its own
//               backend_uuid and its label its Navigate number (not its raw entry index)
//   K6  [new]   a bookmarked question stays lit at two scroll stops where its place among the mounted
//               bubbles differs; a click there removes it, another adds exactly one
//   K7  [new]   off-screen question jumps, top -> bottom and bottom -> top: the target's own bubble,
//               in view, the resolved entry
//   K8  [new]   off-screen answer jumps: the answer's own node, its start in view; Perplexity with
//               the question slot kept empty (qLag): mounted and off-screen
//   K9  [new]   a node re-used for another message before the next scan: a click stores nothing
//   K10 [new]   a record whose stored msgIndex is wrong, panel open before the index lands:
//               "Q#…", then "Q#12", with no storage write
//   K11 [new]   positional records from v12.14: a twin-text one is NOT bound; one made mid-thread
//               reads "Q#?", gives the question toast and is deleted by its ✕; an answer one "A#?"
//   K12 [new]   a positional record whose msgIndex is its true place binds on proof and then jumps
//               to its question from off screen
//   S1  [new]   a bookmark made under one URL form is lit, and in the panel, under the other
//   S2  [new]   seeded split sets merge into one: union, no loss, no duplicate (the bound one kept),
//               the old key gone, other conversations and Claude's key untouched; a reload writes nothing
//   N1  [new]   ChatGPT: a regenerated answer and a new question, not in the index, are saved by the
//               page's ids and read "Answer to Q#?" / "Q#?" until the one refresh lands, then
//               "Answer to Q#16" / "Q#17"; the replaced answer's record reads "A#?"; one fetch per request
//               (N1c) and no further fetch past the refetch cooldown; (N1e) saves while the first load is
//               in flight keep their request until a load holds them all, and (N1g) one that holds
//               them all answers them, with no follow-up fetch; (N1f) a flag clicked after the
//               URL moved to another chat, before a redraw, saves nothing; (N1d) a record whose one
//               refresh was answered still reads "A#?", not "Answer to Q#?", after leaving the chat
//               and coming back
//   N2  [new]   Perplexity: a new entry's flag saves nothing and says so
//   K13 [new]   Perplexity: a mounted question edited in place (its data-workflow-entry kept, the
//               index not refetched yet): its question and answer flags have no key and save nothing
//   K14 [new]   Perplexity, an answer whose question slot is empty: the slot-place fallback refuses
//               (no key, nothing saved) when a mounted question slot is not at twice its entry
//               number, and when the list is not exactly two slots per raw entry (two extra children
//               above it would otherwise key it as the NEXT entry's answer)
//   G1  [new]   an entry without a backend_uuid saves nothing (v12.14 saves a hash); no record is
//               keyed by a raw position
//   G2  [guard] no page errors
// Claude's storage key is gated by probes/check-answer-bookmarks.js (its records live under it).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const GPT_CONV  = '6994e2d6-ce6c-832a-aa7d-04b747928fd8';
const GPT_OTHER = '7a1b2c3d-1111-4222-8333-444455556666';
const PPLX_CONV = 'de5dd7ce-5eb6-4045-a861-d337141e10b6';
const uuid = (n, tag) => (tag || 'aaaaaaaa') + '-0000-4000-8000-' + String(n).padStart(12, '0');
const TWIN = 'Continue with the next step, please.';

// v12.14's contentHash(text, idx), byte for byte: the seeds must reproduce against rendered text.
function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        h = h >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
}
const contentHash = (text, idx) => fnv(String(idx) + '|' + (text || '').substring(0, 200));

// ── Data ─────────────────────────────────────────────────────────────────
// ChatGPT: 16 turns; every third one has thoughts, a text preamble, a tool call and its output
// before the final text (the DOM's answer id); a hidden user node after turn 6; turns 4 and 11 read
// the same.
const GPT_T = Array.from({ length: 16 }, (_, i) => ({
    id: uuid(i), aid: uuid(i, 'cccccccc'), rich: i % 3 === 0, hiddenAfter: i === 5,
    text: (i === 3 || i === 10) ? TWIN : 'ChatGPT probe question ' + (i + 1) + ' about windowed lists?',
    answer: 'ChatGPT probe answer ' + (i + 1) + ': the window slides as you scroll.' }));
const GPT_REGEN = uuid(15, 'abababab');
const GPT_NEW = { id: uuid(16), aid: uuid(16, 'cccccccc'), text: 'ChatGPT probe question 17, just sent?',
                  answer: 'ChatGPT probe answer 17.' };

function gptMapping(turns) {
    const m = {};
    const add = (id, parent, message) => { m[id] = { id, parent, children: [], message }; if (parent) m[parent].children.push(id); };
    const msg = (id, role, ct, parts, extra) => Object.assign({ id, author: { role }, content: { content_type: ct, parts },
                                                                recipient: 'all', metadata: {} }, extra || {});
    add('client-created-root', null, null);
    add('sys-0', 'client-created-root', msg('sys-0', 'system', 'text', ['']));
    let prev = 'sys-0';
    turns.forEach((t, i) => {
        add(t.id, prev, msg(t.id, 'user', 'text', [t.text]));
        prev = t.id;
        if (t.rich) {
            const chain = [
                msg(uuid(i, 'eeeeeeee'), 'assistant', 'thoughts', undefined, { content: { content_type: 'thoughts', thoughts: [{ summary: 'thinking' }] } }),
                msg(uuid(i, 'dddddddd'), 'assistant', 'text', ['Let me look that up first.']),
                msg(uuid(i, 'ffffffff'), 'assistant', 'code', undefined, { recipient: 'python', content: { content_type: 'code', text: 'print(1)' } }),
                msg(uuid(i, '99999999'), 'tool', 'execution_output', undefined, { content: { content_type: 'execution_output', text: '1' } }),
            ];
            chain.forEach((c) => { add(c.id, prev, c); prev = c.id; });
        }
        add(t.aid, prev, msg(t.aid, 'assistant', 'text', [t.answer], { end_turn: true }));
        prev = t.aid;
        if (t.hiddenAfter) {
            const h = uuid(i, '77777777'), ha = uuid(i, '88888888');
            add(h, prev, msg(h, 'user', 'text', ['(context the page never shows)'], { metadata: { is_visually_hidden_from_conversation: true } }));
            add(ha, h, msg(ha, 'assistant', 'text', ['Noted.']));
            prev = ha;
        }
    });
    return { title: 'probe', conversation_id: GPT_CONV, mapping: m, current_node: prev };
}

// Perplexity: 12 entries; entry 4 has an empty query_str (an attachment-only question), entry 7 no
// backend_uuid, entries 3 and 10 read the same. Navigate lists 11: raw k is "Q#k+1" before entry 4,
// "Q#k" after it.
const PX = Array.from({ length: 12 }, (_, i) => {
    const e = { query_str: i === 3 ? '' : (i === 2 || i === 9) ? TWIN : 'Perplexity probe question ' + (i + 1) + ' about pinned scrollers?',
                answer: 'Perplexity probe answer ' + (i + 1) + ': release the pin first.', attachments: [] };
    if (i !== 6) e.backend_uuid = uuid(i, 'bbbbbbbb');
    return e;
});
const pxNav = (k) => (k < 3 ? k : k - 1);
function pplxPage(all, url) {
    const u = new URL(url);
    const limit = parseInt(u.searchParams.get('limit') || '20', 10);
    const cur = u.searchParams.get('cursor');
    const start = cur ? parseInt(cur.replace('cur-', ''), 10) : 0;
    const more = start + limit < all.length;
    return { status: 'COMPLETED', entries: all.slice(start, start + limit), has_next_page: more,
             next_cursor: more ? 'cur-' + (start + limit) : null };
}

// ── Page ─────────────────────────────────────────────────────────────────
// The helpers read only what the user sees (flags, the panel, toasts) and storage.
const HELPERS = `
(function () {
    window.__acn = { toasts: [], jumps: [], blobs: [] };
    var B = window.Blob;
    window.Blob = function (parts, o) { try { window.__acn.blobs.push(parts.join('')); } catch (e) {} return new B(parts, o); };
    window.Blob.prototype = B.prototype;
    new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
            var r = recs[i];
            if (r.type === 'childList') {
                for (var j = 0; j < r.addedNodes.length; j++) {
                    var n = r.addedNodes[j];
                    if (n.nodeType === 1 && n.getAttribute('data-acn-role') === 'toast') window.__acn.toasts.push(n.textContent);
                }
            } else if (r.attributeName === 'data-acn-jump-target' && r.target.getAttribute('data-acn-jump-target') === 'true') {
                window.__acn.lastJump = r.target;
                window.__acn.jumps.push(window.__p.describe(r.target));
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-acn-jump-target'] });
    var site = window.__SITE;
    function region() { return document.querySelector('[data-app-action-timeline-scroll][role="region"]'); }
    function slots() { return document.getElementById('mock-items').children; }
    function icon(el) {
        if (!el) return null;
        for (var c = 0; c < el.children.length; c++) if (el.children[c].getAttribute('data-acn-bookmark') !== null) return el.children[c];
        return null;
    }
    window.__p = {
        q: function (i) {
            if (site === 'chatgpt') {
                var t = region().querySelector('[data-turn-key="' + window.__T[i].id + '"]');
                return t ? t.querySelector('[data-user-message-bubble="true"]') : null;
            }
            var s = slots()[2 * i];
            return s ? s.querySelector('[data-message-bubble="right"]') : null;
        },
        a: function (i) {
            if (site === 'chatgpt') {
                var t = region().querySelector('[data-turn-key="' + window.__T[i].id + '"]');
                return t ? t.querySelector('[data-content-search-unit-key$=":assistant"]') : null;
            }
            var s = slots()[2 * i + 1];
            return s ? s.querySelector('[data-workflow-final-text]') : null;
        },
        // Every flag on the page, by where it is.
        flags: function () {
            var out = { items: [], stray: 0, total: document.querySelectorAll('[data-acn-bookmark]').length };
            var n = window.__mockWindow.total, i, k;
            for (i = 0; i < n; i++) {
                var row = { i: i };
                if (site === 'chatgpt') {
                    var t = region().querySelector('[data-turn-key="' + window.__T[i].id + '"]');
                    if (!t) continue;
                    var qb = t.querySelector('[data-user-message-bubble="true"]');
                    var aw = t.querySelector('[data-chatgpt-search-unit-key$=":assistant"]');
                    row.qn = qb.querySelectorAll('[data-acn-bookmark]').length;
                    row.an = aw ? aw.querySelectorAll('[data-acn-bookmark]').length : 0;
                    row.qText = !!qb.textContent.trim();
                } else {
                    var qs = slots()[2 * i], as = slots()[2 * i + 1];
                    if (!qs.firstChild && !as.firstChild) continue;
                    row.qn = qs.querySelectorAll('[data-acn-bookmark]').length;
                    row.an = as.querySelectorAll('[data-acn-bookmark]').length;
                    row.qMounted = !!qs.firstChild;
                    var bub = qs.querySelector('[data-message-bubble="right"]');
                    row.qText = !!(bub && bub.textContent.replace(/\\u2691/g, '').trim());
                    // a flag in the answer slot but not on [data-workflow-final-text] itself
                    var fin = as.querySelector('[data-workflow-final-text]');
                    row.aMisplaced = as.querySelectorAll('[data-acn-bookmark]').length - (icon(fin) ? 1 : 0);
                }
                var qi = icon(window.__p.q(i)), ai = icon(window.__p.a(i));
                row.qKey = qi ? qi.getAttribute('data-acn-bookmark') : null;
                row.aKey = ai ? ai.getAttribute('data-acn-bookmark') : null;
                row.qLit = !!(qi && qi.classList.contains('acn-bm-active'));
                row.aLit = !!(ai && ai.classList.contains('acn-bm-active'));
                out.items.push(row);
            }
            var counted = 0;
            for (k = 0; k < out.items.length; k++) counted += out.items[k].qn + out.items[k].an;
            out.stray = out.total - counted;
            return out;
        },
        // Both flags of a message as drawn now, clicked after both are taken: the first click's
        // redraw must not hand the second a fresh flag.
        clickBoth: function (i) {
            var qi = icon(window.__p.q(i)), ai = icon(window.__p.a(i));
            if (qi) qi.click();
            if (ai) ai.click();
            return (qi ? 1 : 0) + (ai ? 1 : 0);
        },
        click: function (kind, i) {
            var el = kind === 'q' ? window.__p.q(i) : window.__p.a(i);
            var ic = icon(el);
            if (!ic) return false;
            ic.click();
            return true;
        },
        store: function () { return window.GM_getValue('acn-bookmarks-v1', '{}'); },
        openPanel: function () {
            var panel = document.getElementById('acn-panel-bookmarks');
            if (panel && panel.classList.contains('acn-open')) return true;
            var dot = document.getElementById('acn-dot-bookmarks');
            if (!dot) return false;
            dot.click();
            return true;
        },
        cards: function () {
            var cards = document.querySelectorAll('#acn-panel-bookmarks .acn-bk'), out = [];
            for (var i = 0; i < cards.length; i++) {
                var t = cards[i].querySelector('.acn-bk-type');
                out.push(t ? t.textContent : null);
            }
            return out;
        },
        clickCard: function (label) {
            var cards = document.querySelectorAll('#acn-panel-bookmarks .acn-bk');
            for (var i = 0; i < cards.length; i++) {
                var t = cards[i].querySelector('.acn-bk-type');
                if (!t || t.textContent !== label) continue;
                var zone = document.getElementById('acn-zone');
                if (zone) zone.removeAttribute('data-acn-jump-resolved');
                window.__acn.jumps = [];
                window.__acn.lastJump = null;
                window.__acn.toasts = [];
                cards[i].click();
                return true;
            }
            return false;
        },
        removeCard: function (label) {
            var cards = document.querySelectorAll('#acn-panel-bookmarks .acn-bk');
            for (var i = 0; i < cards.length; i++) {
                var t = cards[i].querySelector('.acn-bk-type');
                if (!t || t.textContent !== label) continue;
                cards[i].querySelector('.acn-bk-remove').click();
                return true;
            }
            return false;
        },
        // Which message an element is, read from the page's own markup when it is marked as a
        // jump's target (a node the jump just mounted has no flag yet).
        describe: function (el) {
            var d = { kind: 'other', pos: -1, key: null };
            if (site === 'chatgpt') {
                var t = el.closest('[data-turn-key]');
                for (var i = 0; t && i < window.__T.length; i++) if (window.__T[i].id === t.getAttribute('data-turn-key')) d.pos = i;
                d.kind = el.matches('[data-user-message-bubble="true"]') ? 'q'
                       : el.matches('[data-content-search-unit-key$=":assistant"]') ? 'a' : 'other';
                var h = d.kind === 'a' ? (el.closest('[data-chatgpt-search-message-ids]') || el.querySelector('[data-chatgpt-search-message-ids]')) : null;
                d.key = h ? h.getAttribute('data-chatgpt-search-message-ids').split(' ')[0] : (t ? t.getAttribute('data-turn-key') : null);
            } else {
                var list = document.getElementById('mock-items'), s = el;
                while (s && s.parentElement !== list) s = s.parentElement;
                var at = s ? Array.prototype.indexOf.call(list.children, s) : -1;
                d.pos = at < 0 ? -1 : at >> 1;
                d.kind = el.matches('[data-message-bubble="right"]') ? 'q' : el.matches('[data-workflow-final-text]') ? 'a' : 'other';
            }
            return d;
        },
        // Where the last jump's target is now: its top inside the scroller's view, and wholly inside.
        landed: function () {
            var el = window.__acn.lastJump;
            if (!el || !el.isConnected) return { connected: false };
            var sc = document.getElementById('mock-scroller').getBoundingClientRect(), r = el.getBoundingClientRect();
            return { connected: true, startInView: r.top >= sc.top - 2 && r.top < sc.bottom - 10,
                     inView: r.top >= sc.top - 2 && r.bottom <= sc.bottom + 2 };
        }
    };
}());`;

function buildPage(site, scriptContent, mockConfig, seed) {
    const file = site === 'chatgpt' ? 'chatgpt-windowed.html' : 'perplexity-windowed.html';
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages', file), 'utf8');
    const body = (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock;
    const head = (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '';
    return `<!DOCTYPE html><html><head>${head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(mockConfig)}; window.__SITE = ${JSON.stringify(site)};
window.__T = ${JSON.stringify(mockConfig.turns || [])};</script>
${body}
<script>
delete window._aiNavAlreadyLoaded;
var _s = ${JSON.stringify(seed || {})};
window.GM_getValue = function (k, d) { return Object.prototype.hasOwnProperty.call(_s, k) ? _s[k] : d; };
window.GM_setValue = function (k, v) { _s[k] = v; };
</script>
<script>${HELPERS}</script>
<script>${scriptContent}</script></body></html>`;
}

(async () => {
    const argv = process.argv;
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = argv.includes('--quiet');
    const onlySite = argv.indexOf('--site') !== -1 ? argv[argv.indexOf('--site') + 1] : null;
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    let failures = 0, pageErrors = [];
    function check(id, desc, ok, detail) {
        if (ok) { if (!quiet) console.log('  PASS  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
        else { failures++; console.log('  FAIL  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
    }
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // One page. api: { chatgpt: () => mapping, perplexity: () => entries, delay: ms (or () => ms) }.
    async function open(site, url, mockConfig, seed, api) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        const ctx = { page, context, logs: [], errors: [], fetches: 0 };
        page.on('pageerror', (e) => ctx.errors.push(String(e && e.message || e)));
        page.on('console', (m) => ctx.logs.push(m.text()));
        const html = buildPage(site, raw, mockConfig, seed);
        await page.route('**/*', async (route) => {
            const u = route.request().url();
            if (u === url) { route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return; }
            let body = null;
            if (/\/api\/auth\/session$/.test(u)) body = JSON.stringify({ accessToken: 'tok', expires: '2099-01-01T00:00:00.000Z' });
            else if (u.indexOf('/backend-api/conversation/' + GPT_CONV) !== -1) { ctx.fetches++; body = JSON.stringify(api.chatgpt()); }
            else if (u.indexOf('/rest/thread/' + PPLX_CONV) !== -1) { ctx.fetches++; body = JSON.stringify(pplxPage(api.perplexity(), u)); }
            if (body === null) { route.abort().catch(() => {}); return; }
            const d = typeof api.delay === 'function' ? api.delay() : (api.delay || 0);
            if (d) await sleep(d);
            route.fulfill({ status: 200, contentType: 'application/json', body }).catch(() => {});
        });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        ctx.close = async () => { pageErrors = pageErrors.concat(ctx.errors); await context.close(); };
        ctx.indexed = async (n, timeout) => {
            const t0 = Date.now();
            while (Date.now() - t0 < (timeout || 15000)) {
                if (ctx.logs.some((l) => /^\[ACN\] index: platform=\w+ .*questions=/.test(l) && l.indexOf('questions=' + n) !== -1)) return true;
                await sleep(100);
            }
            return false;
        };
        ctx.ev = (fn, arg) => page.evaluate(fn, arg);
        ctx.store = async () => JSON.parse(await page.evaluate(() => window.__p.store()));
        ctx.flags = () => page.evaluate(() => window.__p.flags());
        // Waits until every mounted message with text has a flag (or 4 s), then one more scan.
        ctx.settle = async () => {
            const t0 = Date.now();
            while (Date.now() - t0 < 4000) {
                const f = await ctx.flags();
                if (f.items.every((r) => (r.qn > 0 || !r.qText || r.qMounted === false) && r.an > 0)) break;
                await sleep(150);
            }
            await sleep(700);
        };
        ctx.scroll = async (to) => { await page.evaluate((t) => window.__mockWindow.userScrollTo(t), to); await sleep(250); await ctx.settle(); };
        ctx.click = async (kind, i) => { const ok = await page.evaluate(([k, j]) => window.__p.click(k, j), [kind, i]); await sleep(300); return ok; };
        ctx.cards = async () => { await page.evaluate(() => window.__p.openPanel()); await sleep(200); return page.evaluate(() => window.__p.cards()); };
        ctx.waitCards = async (pred, timeout) => {
            const t0 = Date.now();
            let c = await ctx.cards();
            while (!pred(c) && Date.now() - t0 < (timeout || 8000)) { await sleep(250); c = await page.evaluate(() => window.__p.cards()); }
            return c;
        };
        // Clicks the card, then waits for a target or a toast, then for the view to be still 800 ms.
        ctx.jump = async (label) => {
            await page.evaluate(() => window.__p.openPanel());
            await sleep(150);
            const ok = await page.evaluate((l) => window.__p.clickCard(l), label);
            if (!ok) return { clicked: false };
            try {
                await page.waitForFunction(() => window.__acn.jumps.length > 0 || window.__acn.toasts.length > 0, null, { timeout: 15000 });
            } catch (e) {}
            let last = null, still = 0;
            for (let k = 0; k < 160 && still < 16; k++) {
                const st = await page.evaluate(() => document.getElementById('mock-scroller').scrollTop);
                if (st === last) still++; else { still = 0; last = st; }
                await sleep(50);
            }
            return page.evaluate(() => ({ clicked: true, jumps: window.__acn.jumps.slice(), toasts: window.__acn.toasts.slice(),
                                          landed: window.__p.landed(),
                                          resolved: document.getElementById('acn-zone').getAttribute('data-acn-jump-resolved') }));
        };
        return ctx;
    }

    const list = (store, url) => (store[url] && store[url].bookmarks) || [];
    const recordsOf = (store) => Object.keys(store).reduce((a, k) => a.concat(list(store, k)), []);
    const short = (x) => String(JSON.stringify(x)).slice(0, 300);

    // K1 for one scroll stop.
    function k1(site, f, stop) {
        const bad = [];
        f.items.forEach((r) => {
            const wantQ = (site === 'chatgpt' || r.qMounted) && r.qText ? 1 : 0;
            if (r.qn !== wantQ) bad.push('Q' + (r.i + 1) + ' has ' + r.qn);
            if (r.an !== 1) bad.push('A' + (r.i + 1) + ' has ' + r.an);
            if (r.aMisplaced) bad.push('A' + (r.i + 1) + ' has ' + r.aMisplaced + ' on nested nodes');
        });
        if (f.stray) bad.push(f.stray + ' flag(s) outside the thread');
        return { ok: f.items.length > 0 && !bad.length, detail: stop + ': ' + f.items.length + ' mounted, ' + f.total + ' flags' + (bad.length ? '; ' + bad.slice(0, 4).join(', ') : '') };
    }

    // ══ ChatGPT ═══════════════════════════════════════════════════════════
    async function chatgpt() {
        const T = GPT_T.map((t) => Object.assign({}, t));
        const cfg = (turns) => ({ turns: turns.map((t) => ({ id: t.id, text: t.text, aid: t.aid, answer: t.answer })), bmModel: { h: 420, window: 6 } });
        const PROJ = 'https://chatgpt.com/g/g-p-6810probe/c/' + GPT_CONV, PLAIN = 'https://chatgpt.com/c/' + GPT_CONV;
        let mapping = gptMapping(T), delay = 0;

        // ── G-A: under the project URL ──
        let c = await open('chatgpt', PROJ, cfg(T), {}, { chatgpt: () => mapping, delay: () => delay });
        const ready = await c.indexed(16);
        await c.settle();
        const k1s = [];
        k1s.push(k1('chatgpt', await c.flags(), 'bottom'));
        let f = await c.flags();
        const q16 = f.items.find((r) => r.i === 15) || {};
        check('G-K2a', '[new] question flags carry data-turn-key', ready && q16.qKey === T[15].id, 'ready=' + ready + ' Q16 flag=' + q16.qKey);
        check('G-K3a', '[new] answer flags carry the turn\'s last shown text node id (after thoughts, a text preamble and a tool call)',
              q16.aKey === T[15].aid, 'A16 flag=' + q16.aKey + ' want ' + T[15].aid);
        await c.click('q', 15);
        await c.click('a', 15);
        let st = await c.store();
        const recs = list(st, PLAIN);
        const rq = recs.find((b) => b.entityType === 'user-msg'), ra = recs.find((b) => b.entityType === 'ai-msg');
        check('G-K2b', '[new] the question record is schema 2, keyed by data-turn-key',
              !!rq && rq.schema === 2 && rq.msgUuid === T[15].id && rq.contentHash === T[15].id, short(rq || recordsOf(st)));
        check('G-K3b', '[new] the answer record carries that id', !!ra && ra.msgUuid === T[15].aid, short(ra || null));
        check('G-K2c', '[new] both records store Q16\'s Navigate index (15) as msgIndex, though their flags were drawn before the index landed',
              !!rq && !!ra && rq.msgIndex === 15 && ra.msgIndex === 15, 'msgIndex ' + (rq && rq.msgIndex) + ' / ' + (ra && ra.msgIndex));
        // K6: Q9 bookmarked at one stop, lit at another where its place among the bubbles differs.
        await c.scroll(7);
        k1s.push(k1('chatgpt', await c.flags(), 'middle'));
        const d1 = await c.ev(() => window.__mockWindow.domIndex(8));
        await c.click('q', 8);
        await c.scroll(5);
        const d2 = await c.ev(() => window.__mockWindow.domIndex(8));
        f = await c.flags();
        const lit2 = (f.items.find((r) => r.i === 8) || {}).qLit;
        await c.click('q', 8);
        const n0 = list(await c.store(), PLAIN).filter((b) => b.msgUuid === T[8].id).length;
        await c.click('q', 8);
        const n1 = list(await c.store(), PLAIN).filter((b) => b.msgUuid === T[8].id).length;
        check('G-K6', '[new] Q9 stays lit where its place among the mounted bubbles differs; ✕ then + gives one record',
              d1 !== d2 && d1 >= 0 && d2 >= 0 && lit2 === true && n0 === 0 && n1 === 1,
              'places ' + d1 + ' -> ' + d2 + ', lit=' + lit2 + ', after removal ' + n0 + ', after re-adding ' + n1);
        await c.scroll('top');
        k1s.push(k1('chatgpt', await c.flags(), 'top'));
        check('G-K1', '[new] one flag per mounted question and answer, none in the hidden timeline (bottom, middle, top)',
              k1s.every((x) => x.ok), k1s.map((x) => x.detail).join(' | '));
        await c.click('q', 0);
        let cards = await c.cards();
        check('G-K4a', '[new] labels are Navigate numbers: "Q#16", "Answer to Q#16", "Q#9", "Q#1"',
              JSON.stringify(cards) === JSON.stringify(['Q#16', 'Answer to Q#16', 'Q#9', 'Q#1']), short(cards));
        // K7 / K8: from the top to Q16 and its answer; from the bottom to Q1.
        let j = await c.jump('Q#16');
        let jt = (j.jumps || [])[0] || {};
        check('G-K7a', '[new] top -> Q16 (off screen) lands on its own bubble, in view',
              jt.kind === 'q' && jt.pos === 15 && j.resolved === '15' && j.landed && j.landed.inView && !(j.toasts || []).length, short(j));
        await c.scroll('top');
        j = await c.jump('Answer to Q#16');
        jt = (j.jumps || [])[0] || {};
        check('G-K8a', '[new] top -> the answer to Q16 (off screen) lands on that answer unit, its start in view',
              jt.kind === 'a' && jt.pos === 15 && jt.key === T[15].aid && j.landed && j.landed.startInView && !(j.toasts || []).length, short(j));
        await c.scroll('bottom');
        j = await c.jump('Q#1');
        jt = (j.jumps || [])[0] || {};
        check('G-K7b', '[new] bottom -> Q1 (off screen) lands on its own bubble, in view',
              jt.kind === 'q' && jt.pos === 0 && j.resolved === '0' && j.landed && j.landed.inView && !(j.toasts || []).length, short(j));
        // K9: turn 13's node re-used for turn 3, clicked before the next scan.
        await c.scroll('bottom');
        const before9 = JSON.stringify(await c.store());
        const reused = await c.ev(() => window.__mockWindow.recycle(12, 2));
        const clicked9 = await c.ev(() => window.__p.clickBoth(2));
        const after9 = JSON.stringify(await c.store());
        await c.settle();
        const redrawn = (await c.flags()).items.find((r) => r.i === 2) || {};
        await c.ev(() => window.__mockWindow.recycle(12, 12));
        await c.settle();
        check('G-K9', '[new] a node re-used for another message: clicks on its two stale flags store nothing, and its flags are redrawn for what it shows',
              reused && clicked9 === 2 && before9 === after9 && redrawn.qKey === T[2].id && redrawn.aKey === T[2].aid,
              'reused=' + reused + ' clicked ' + clicked9 + ', ' + (before9 === after9 ? 'unchanged' : 'store changed: ' + after9.slice(0, 160)) +
              ', redrawn ' + redrawn.qKey + ' / ' + redrawn.aKey);
        // K4: Korean and the export.
        await c.ev(() => {
            var b = document.querySelector('[data-acn-dot="tools"]');
            if (b) b.click();
            var x = document.querySelector('[data-acn-export="bookmarks"]');
            if (x) x.click();
        });
        await sleep(300);
        const blob = (await c.ev(() => window.__acn.blobs.slice(-1)[0])) || '';
        const heads = (blob.match(/^## .*$/gm) || []).map((h) => h.replace(/^## \S+ /, '').replace(/ — .*$/, ''));
        check('G-K4b', '[new] the export lists them in label order', JSON.stringify(heads) === JSON.stringify(['Q#1', 'Q#9', 'Q#16', 'Answer to Q#16']), short(heads));
        // N1: a regenerated answer of Q16 and a new question, neither in the index; the index answers later.
        await c.scroll('bottom');
        await c.ev((a) => window.__mockWindow.setAnswer(15, a, 'Regenerated answer 16.'), GPT_REGEN);
        await c.settle();
        f = await c.flags();
        const regenKey = (f.items.find((r) => r.i === 15) || {}).aKey;
        const T2 = T.map((t) => Object.assign({}, t));
        T2[15].aid = GPT_REGEN; T2[15].answer = 'Regenerated answer 16.';
        mapping = gptMapping(T2);
        delay = 2500;                                  // the refresh lands 2.5 s after it is asked for
        const fetches0 = c.fetches;
        await c.click('a', 15);
        cards = await c.cards();
        const waitingA = cards[cards.length - 1];
        const flipped = await c.waitCards((cs) => cs[cs.length - 1] === 'Answer to Q#16', 25000);
        const fetchesA = c.fetches - fetches0;
        st = await c.store();
        const rr = list(st, PLAIN).find((b) => b.msgUuid === GPT_REGEN);
        check('N1a', '[new] a regenerated answer is saved by the page\'s id, reads "Answer to Q#?" until the one refresh lands, then "Answer to Q#16"; the old one "A#?"',
              regenKey === GPT_REGEN && !!rr && waitingA === 'Answer to Q#?' && flipped[flipped.length - 1] === 'Answer to Q#16' &&
              flipped[1] === 'A#?' && fetchesA === 1,
              'flag=' + regenKey + ' record=' + !!rr + ' at click ' + waitingA + ' then ' + short(flipped) + ', fetches ' + fetchesA);
        // One request, one load: still one after the 15 s refetch cooldown has run out (an unmarked
        // request refetches every cooldown).
        await sleep(15000 + 3000);
        const fetchesC = c.fetches - fetches0;
        check('N1c', '[new] that request causes no further fetch once the refetch cooldown has passed',
              fetchesA === 1 && fetchesC === 1, 'fetches ' + fetchesA + ' at the flip, ' + fetchesC + ' 18 s later');
        // The new question: its turn is mounted at the end; the scan's own stale check and the click
        // ask; the index that lands holds it.
        const T3 = T2.concat([GPT_NEW]);
        mapping = gptMapping(T3);
        await c.ev((t) => { window.__T.push(t); window.__mockWindow.addTurn(t); }, GPT_NEW);
        await c.scroll('bottom');
        await c.click('q', 16);
        cards = await c.cards();
        const waitingQ = cards[cards.length - 1];
        const flippedQ = await c.waitCards((cs) => cs[cs.length - 1] === 'Q#17', 30000);
        st = await c.store();
        const rn = list(st, PLAIN).find((b) => b.msgUuid === GPT_NEW.id);
        check('N1b', '[new] a new question is saved by its data-turn-key, reads "Q#?" until the index holds it, then "Q#17"',
              !!rn && waitingQ === 'Q#?' && flippedQ[flippedQ.length - 1] === 'Q#17', 'record=' + !!rn + ' at click ' + waitingQ + ' then ' + short(flippedQ));
        // N1d: an answer the index never lists; its one refresh is answered ("A#?"); then the user
        // leaves the chat and comes back.
        const NEVER = uuid(14, 'bcbcbcbc');
        await c.ev((a) => window.__mockWindow.setAnswer(14, a, 'A reply the index never lists.'), NEVER);
        await c.settle();
        await c.click('a', 14);
        const atClickD = await c.cards();
        const servedD = await c.waitCards((cs) => cs.indexOf('Answer to Q#?') === -1, 30000);
        const loadsOf = () => c.logs.filter((l) => /^\[ACN\] index: platform=\w+ .*questions=17/.test(l)).length;
        const loads0 = loadsOf();
        const go = (o) => c.ev((x) => { history.pushState({}, '', '/c/' + x); window.dispatchEvent(new PopStateEvent('popstate')); }, o);
        await go(GPT_OTHER);
        await sleep(2000);
        await go(GPT_CONV);
        const t0D = Date.now();
        while (loadsOf() === loads0 && Date.now() - t0D < 25000) await sleep(200);
        const backD = await c.waitCards((cs) => cs.length > 0 && !cs.some((x) => x.indexOf('\u2026') !== -1), 10000);
        const nA = (cs) => cs.filter((x) => x === 'A#?').length;
        check('N1d', '[new] a record whose one refresh was answered reads "A#?" after leaving the chat and coming back, not "Answer to Q#?"',
              atClickD.indexOf('Answer to Q#?') !== -1 && servedD.indexOf('Answer to Q#?') === -1 && nA(servedD) >= 2 &&
              loadsOf() > loads0 && backD.indexOf('Answer to Q#?') === -1 && nA(backD) === nA(servedD),
              'at click ' + short(atClickD) + ' -> ' + short(servedD) + ' -> back (reloaded=' + (loadsOf() > loads0) + ') ' + short(backD));
        // N1f: the URL moves to another chat and a flag of this one is clicked before any scan
        // redraws (the old timeline still on screen): nothing is saved, under either chat (Tier 3).
        await c.settle();
        const storeA = await c.store();
        // Each flag twice: a rejected click must not redraw a flag the second click could use.
        const clickedF = await c.ev(([o, back]) => {
            history.pushState({}, '', '/c/' + o);
            var first = window.__p.click('q', 13) && window.__p.click('a', 13);
            window.__p.click('q', 13);
            window.__p.click('a', 13);
            history.pushState({}, '', '/c/' + back);
            return first;
        }, [GPT_OTHER, GPT_CONV]);
        await sleep(300);
        const storeF = await c.store();
        check('N1f', '[new] a flag clicked (twice) after the URL moved to another chat, before a redraw, saves nothing under either chat',
              clickedF && JSON.stringify(storeF) === JSON.stringify(storeA),
              'clicked=' + clickedF + (JSON.stringify(storeF) === JSON.stringify(storeA) ? ', store unchanged'
                                       : ', store changed: ' + short(Object.keys(storeF).map((k) => k + ':' + list(storeF, k).length))));
        await c.close();

        // ── G-B: the same chat at /c/<id>, the index answering 3 s late, in Korean; a record whose
        // msgIndex is wrong (v12.14 numbered by it) ──
        const k10 = { id: 'bm_k10', schema: 2, entityType: 'user-msg', contentHash: T[11].id, msgUuid: T[11].id,
                      preview: T[11].text, msgIndex: 3, createdAt: Date.now() + 5000, platform: 'chatgpt.com' };
        // v12.14 files them under the project URL: S1 then finds nothing under /c/<id>.
        const seedB = JSON.parse(JSON.stringify(storeA));
        const homeB = seedB[PLAIN] ? PLAIN : PROJ;
        if (!seedB[homeB]) seedB[homeB] = { bookmarks: [] };
        seedB[homeB].bookmarks.push(k10);
        delay = 3000;
        c = await open('chatgpt', PLAIN, cfg(T3), { 'acn-bookmarks-v1': JSON.stringify(seedB), 'acn-settings': { language: 'ko' } },
                       { chatgpt: () => mapping, delay: () => delay });
        await sleep(300);
        const s0 = JSON.stringify(await c.store());
        const early = await c.cards();
        await c.indexed(17, 15000);
        const late = await c.waitCards((cs) => cs.indexOf('Q#12') !== -1, 8000);
        const s1 = JSON.stringify(await c.store());
        check('G-K10', '[new] panel open before the index: "Q#…", then "Q#12" for a record stored with msgIndex 3, no storage write',
              early[early.length - 1] === 'Q#…' && late[late.length - 1] === 'Q#12' && s0 === s1, short(early) + ' -> ' + short(late) + (s0 === s1 ? '' : ' (store written)'));
        check('G-K4c', '[new] in Korean the answer reads "Q#16에 대한 답변"', late.indexOf('Q#16에 대한 답변') !== -1, short(late));
        await c.settle();
        f = await c.flags();
        const q16b = f.items.find((r) => r.i === 15) || {};
        check('S1-G', '[new] the bookmarks made under /g/<project>/c/<id> are lit and listed under /c/<id>',
              q16b.qLit === true && late.indexOf('Q#16') !== -1, 'Q16 lit=' + q16b.qLit + ' cards=' + short(late));
        await c.close();
        delay = 0;
        mapping = gptMapping(T);

        // ── G-E: saves while the first load is in flight (Tier 3) ── the load predates a
        // regenerated answer A; A, then Q16 (which it holds), are saved before it lands. A's request
        // must survive the load that holds only Q16, and the one follow-up must label A.
        const REGEN_E = uuid(15, 'cdcdcdcd');
        const TE = T.map((t) => Object.assign({}, t));
        TE[15].aid = REGEN_E; TE[15].answer = 'Regenerated answer 16, again.';
        delay = 8000;
        c = await open('chatgpt', PLAIN, cfg(T), {}, { chatgpt: () => mapping, delay: () => delay });
        await c.ev((a) => window.__mockWindow.setAnswer(15, a, 'Regenerated answer 16, again.'), REGEN_E);
        await c.settle();
        for (let k = 0; k < 100 && c.fetches === 0; k++) await sleep(100);   // the first load is in flight
        const fetchesE0 = c.fetches;
        await c.click('a', 15);
        await c.click('q', 15);
        mapping = gptMapping(TE);                       // what a fetch made from now on answers
        delay = 3000;                                   // the follow-up lands 3 s after it is made
        const loadedE = await c.indexed(16, 15000);
        const firstE = await c.cards();
        const flippedE = await c.waitCards((cs) => cs.indexOf('Answer to Q#16') !== -1, 30000);
        await sleep(2000);
        const fetchesE = c.fetches - fetchesE0;
        check('N1e', '[new] an answer saved while the first load is in flight, then a question that load holds: the load answers ' +
              'only the question, one follow-up fetch is made, and the answer then reads "Answer to Q#16"',
              fetchesE0 === 1 && loadedE && firstE.indexOf('Answer to Q#?') !== -1 && flippedE.indexOf('Answer to Q#16') !== -1 &&
              flippedE.indexOf('Q#16') !== -1 && fetchesE === 1,
              'first load in flight=' + (fetchesE0 === 1) + ' loaded=' + loadedE + ' after the first load ' + short(firstE) + ' -> ' + short(flippedE) + ', follow-up fetches ' + fetchesE);
        await c.close();
        // N1g: the same, but the load in flight already holds the regenerated answer: it answers
        // the request, and no follow-up fetch is made, not even past the refetch cooldown.
        mapping = gptMapping(TE);
        delay = 8000;
        c = await open('chatgpt', PLAIN, cfg(T), {}, { chatgpt: () => mapping, delay: () => delay });
        await c.ev((a) => window.__mockWindow.setAnswer(15, a, 'Regenerated answer 16, again.'), REGEN_E);
        await c.settle();
        for (let k = 0; k < 100 && c.fetches === 0; k++) await sleep(100);
        const fetchesG0 = c.fetches;
        await c.click('a', 15);
        delay = 0;
        const loadedG = await c.indexed(16, 15000);
        await sleep(15000 + 3000);
        const cardsG = await c.cards();
        const fetchesG = c.fetches - fetchesG0;
        check('N1g', '[new] an answer saved while the first load is in flight, which that load holds: "Answer to Q#16", ' +
              'and no follow-up fetch past the refetch cooldown',
              fetchesG0 === 1 && loadedG && cardsG.indexOf('Answer to Q#16') !== -1 && fetchesG === 0,
              'first load in flight=' + (fetchesG0 === 1) + ' loaded=' + loadedG + ' cards ' + short(cardsG) + ', follow-up fetches ' + fetchesG);
        await c.close();
        mapping = gptMapping(T);

        // ── G-C: split sets seeded, then a reload ──
        const rec = (id, type, key, extra) => Object.assign({ id, schema: 2, entityType: type, contentHash: key, msgUuid: key,
                                                               preview: 'p ' + id, msgIndex: 0, createdAt: 1000 + id.length, platform: 'chatgpt.com' }, extra || {});
        const legacyL = { id: 'bm_L', schema: 1, entityType: 'user-msg', contentHash: contentHash(T[13].text, 0), msgUuid: null,
                          preview: T[13].text, msgIndex: 0, createdAt: 900 };
        const OTHER = 'https://chatgpt.com/g/g-p-other/c/' + GPT_OTHER, CLAUDE = 'https://claude.ai/chat/11111111-2222-4333-8444-555555555555';
        const split = {};
        split[PLAIN] = { bookmarks: [rec('bm_r1b', 'user-msg', T[3].id),
                                     { id: 'bm_u1', schema: 1, entityType: 'user-msg', contentHash: T[7].id, msgUuid: null, preview: 'u', msgIndex: 7, createdAt: 950 },
                                     rec('bm_r5', 'ai-msg', T[9].aid), legacyL] };
        split[PROJ] = { bookmarks: [rec('bm_r1', 'user-msg', T[3].id), rec('bm_r2', 'user-msg', T[5].id), rec('bm_b1', 'user-msg', T[7].id), legacyL] };
        split[OTHER] = { bookmarks: [rec('bm_o1', 'user-msg', uuid(1, '12121212'))] };
        split[CLAUDE] = { bookmarks: [rec('bm_c1', 'user-msg', uuid(2, '13131313'))] };
        c = await open('chatgpt', PROJ, cfg(T), { 'acn-bookmarks-v1': JSON.stringify(split) }, { chatgpt: () => mapping });
        await c.indexed(16);
        await c.settle();
        st = await c.store();
        const merged = list(st, PLAIN).map((b) => b.id).sort();
        const keysAfter = Object.keys(st).sort();
        const untouched = JSON.stringify(st[OTHER]) === JSON.stringify(split[OTHER]) && JSON.stringify(st[CLAUDE]) === JSON.stringify(split[CLAUDE]);
        cards = await c.cards();
        const storeC = JSON.stringify(st);
        await c.close();
        c = await open('chatgpt', PLAIN, cfg(T), { 'acn-bookmarks-v1': storeC }, { chatgpt: () => mapping });
        await c.indexed(16);
        await c.settle();
        const again = JSON.stringify(await c.store());
        await c.close();
        const wantIds = ['bm_L', 'bm_b1', 'bm_r1b', 'bm_r2', 'bm_r5'];
        check('S2-G', '[new] split sets merge: union, the bound record kept over the unbound one, no duplicate, the old key gone; ' +
              'another chat and Claude\'s key untouched; a reload writes nothing',
              JSON.stringify(merged) === JSON.stringify(wantIds) && keysAfter.indexOf(PROJ) === -1 && untouched && again === storeC &&
              JSON.stringify(cards.slice().sort()) === JSON.stringify(['Answer to Q#10', 'Q#4', 'Q#6', 'Q#8', 'Q#?']),
              'merged=' + short(merged) + ' keys=' + keysAfter.length + ' untouched=' + untouched + ' idempotent=' + (again === storeC) + ' cards=' + short(cards));

        // ── G-D: positional records from v12.14 ──
        const L = (id, type, text, idx, at) => ({ id, schema: 1, entityType: type, contentHash: contentHash(text, idx), msgUuid: null,
                                                 preview: text.substring(0, 120), msgIndex: idx, createdAt: at, platform: 'chatgpt.com' });
        const seedD = {};
        seedD[PLAIN] = { bookmarks: [
            L('bm_old', 'user-msg', T[8].text, 8, 1),          // its true place (a static page): binds
            L('bm_twin', 'user-msg', TWIN, 3, 2),              // made on Q11 at window place 3; Q4 reads the same
            L('bm_mid', 'user-msg', T[13].text, 2, 3),         // made on Q14 at window place 2
            L('bm_ans', 'ai-msg', T[4].answer, 1, 4) ] };
        c = await open('chatgpt', PLAIN, cfg(T), { 'acn-bookmarks-v1': JSON.stringify(seedD) }, { chatgpt: () => mapping });
        await c.indexed(16);
        await c.settle();
        await c.scroll(7);                                      // Q9 mounted
        await c.scroll(2);                                      // Q4 (the twin) mounted
        st = await c.store();
        const byId = (id) => list(st, PLAIN).find((b) => b.id === id) || {};
        cards = await c.cards();
        check('G-K12a', '[new] a positional record at its true place binds on proof when its question mounts',
              byId('bm_old').msgUuid === T[8].id, short(byId('bm_old')));
        check('G-K11a', '[new] the twin-text record is not bound to the other twin; it reads "Q#?"',
              byId('bm_twin').msgUuid === null && cards[1] === 'Q#?', short(byId('bm_twin')) + ' cards=' + short(cards));
        await c.scroll('bottom');
        j = await c.jump('Q#9');
        jt = (j.jumps || [])[0] || {};
        check('G-K12b', '[new] it then jumps to Q9 from off screen', jt.kind === 'q' && jt.pos === 8 && j.landed && j.landed.inView, short(j));
        cards = await c.cards();
        j = await c.jump(cards[2]);
        const toastQ = (j.toasts || [])[0] || '';
        const removed = await c.ev(() => window.__p.removeCard('Q#?') && window.__p.removeCard('Q#?'));
        await sleep(300);
        st = await c.store();
        cards = await c.cards();
        check('G-K11b', '[new] the record made mid-thread reads "Q#?", gives the question toast, and ✕ deletes it',
              /question bookmark could not be matched/.test(toastQ) && removed && !byId('bm_mid').id && !byId('bm_twin').id,
              'toast="' + toastQ + '" left=' + short(list(st, PLAIN).map((b) => b.id)));
        j = await c.jump('A#?');
        check('G-K11c', '[new] an answer record from v12.14 reads "A#?" and gives the answer toast',
              cards.indexOf('A#?') !== -1 && /answer bookmark could not be matched/.test((j.toasts || [])[0] || ''), short(cards) + ' ' + short(j.toasts));
        await c.close();
    }

    // ══ Perplexity ════════════════════════════════════════════════════════
    async function perplexity() {
        const cfg = (extra) => ({ entries: PX.map((e) => ({ text: e.query_str, answer: e.answer })), bmModel: Object.assign({ q: 100, a: 500, around: 1 }, extra || {}) });
        const BARE = 'https://perplexity.ai/search/' + PPLX_CONV, WWW = 'https://www.perplexity.ai/search/' + PPLX_CONV;
        const U = (i) => PX[i].backend_uuid;
        const api = { perplexity: () => PX };
        let c = await open('perplexity', BARE, cfg(), {}, api);
        const ready = await c.indexed(11);
        await c.settle();
        const k1s = [k1('perplexity', await c.flags(), 'bottom')];
        let f = await c.flags();
        const e11 = f.items.find((r) => r.i === 11) || {};
        check('P-K2a', '[new] question flags carry the entry\'s backend_uuid', ready && e11.qKey === U(11), 'ready=' + ready + ' flag=' + e11.qKey);
        check('P-K3a', '[new] answer flags carry backend_uuid:answer', e11.aKey === U(11) + ':answer', 'flag=' + e11.aKey);
        await c.click('q', 11);
        await c.click('a', 11);
        let st = await c.store();
        const recs = list(st, WWW);
        const rq = recs.find((b) => b.entityType === 'user-msg'), ra = recs.find((b) => b.entityType === 'ai-msg');
        check('P-K2b', '[new] the question record is schema 2, keyed by backend_uuid', !!rq && rq.schema === 2 && rq.msgUuid === U(11), short(rq || recordsOf(st)));
        check('P-K3b', '[new] the answer record is keyed backend_uuid:answer', !!ra && ra.msgUuid === U(11) + ':answer', short(ra || null));
        check('P-K2c', '[new] both records store entry 12\'s Navigate index (10) as msgIndex',
              !!rq && !!ra && rq.msgIndex === 10 && ra.msgIndex === 10, 'msgIndex ' + (rq && rq.msgIndex) + ' / ' + (ra && ra.msgIndex));
        // K5 and G1 around entries 4 (empty query_str) and 7 (no backend_uuid).
        await c.scroll(7);
        k1s.push(k1('perplexity', await c.flags(), 'middle'));
        f = await c.flags();
        const e8 = f.items.find((r) => r.i === 8) || {}, e6 = f.items.find((r) => r.i === 6) || {};
        await c.click('q', 8);
        await c.click('a', 8);
        const before6 = JSON.stringify(await c.store());
        await c.click('q', 6);
        await c.click('a', 6);
        const after6 = JSON.stringify(await c.store());
        const toast6 = (await c.ev(() => window.__acn.toasts.slice(-1)[0])) || '';
        let cards = await c.cards();
        check('P-K5', '[new] after the empty entry, entry 9\'s question is keyed by its own backend_uuid and labelled Q#8',
              e8.qKey === U(8) && cards.indexOf('Q#8') !== -1 && cards.indexOf('Answer to Q#8') !== -1, 'flag=' + e8.qKey + ' cards=' + short(cards));
        check('P-G1', '[new] the entry without a backend_uuid saves nothing, and says so; no record is keyed by a position',
              before6 === after6 && !recordsOf(JSON.parse(after6)).some((b) => /^\d+(:answer)?$/.test(String(b.contentHash))),
              'flags ' + e6.qKey + ' / ' + e6.aKey + ', toast "' + toast6 + '"');
        // K6: entry 9 bookmarked above; lit at a stop where its place among the bubbles differs.
        const d1 = await c.ev(() => window.__mockWindow.domIndex(8));
        await c.scroll(8);
        const d2 = await c.ev(() => window.__mockWindow.domIndex(8));
        f = await c.flags();
        const lit2 = (f.items.find((r) => r.i === 8) || {}).qLit;
        await c.click('q', 8);
        const n0 = list(await c.store(), WWW).filter((b) => b.msgUuid === U(8)).length;
        await c.click('q', 8);
        const n1 = list(await c.store(), WWW).filter((b) => b.msgUuid === U(8)).length;
        check('P-K6', '[new] entry 9 stays lit where its place among the mounted bubbles differs; ✕ then + gives one record',
              d1 !== d2 && d1 >= 0 && d2 >= 0 && lit2 === true && n0 === 0 && n1 === 1,
              'places ' + d1 + ' -> ' + d2 + ', lit=' + lit2 + ', after removal ' + n0 + ', after re-adding ' + n1);
        await c.scroll('top');
        k1s.push(k1('perplexity', await c.flags(), 'top'));
        check('P-K1', '[new] one flag per mounted question and answer, none on nested "prose" nodes or the decoy (bottom, middle, top)',
              k1s.every((x) => x.ok), k1s.map((x) => x.detail).join(' | '));
        await c.click('q', 1);
        // Entry 4's answer: listed under its own id, after a question Navigate does not list.
        await c.scroll(3);
        f = await c.flags();
        const e3 = f.items.find((r) => r.i === 3) || {};
        await c.click('a', 3);
        cards = await c.cards();
        check('P-K4a', '[new] labels are Navigate numbers: "Q#11", "Answer to Q#11", "Q#8", "Answer to Q#8", "Q#2", and "Answer (no question)" after the empty entry',
              JSON.stringify(cards) === JSON.stringify(['Q#11', 'Answer to Q#11', 'Answer to Q#8', 'Q#8', 'Q#2', 'Answer (no question)']) && e3.aKey === U(3) + ':answer',
              short(cards) + ' entry-4 answer flag=' + e3.aKey);
        // K7 / K8.
        await c.scroll('top');
        let j = await c.jump('Q#8');
        let jt = (j.jumps || [])[0] || {};
        check('P-K7a', '[new] top -> entry 9 (off screen) lands on its own bubble, in view',
              jt.kind === 'q' && jt.pos === 8 && j.resolved === '8' && j.landed && j.landed.inView && !(j.toasts || []).length, short(j));
        await c.scroll('top');
        j = await c.jump('Answer to Q#8');
        jt = (j.jumps || [])[0] || {};
        check('P-K8a', '[new] top -> entry 9\'s answer (off screen) lands on that [data-workflow-final-text], its start in view',
              jt.kind === 'a' && jt.pos === 8 && j.landed && j.landed.startInView && !(j.toasts || []).length, short(j));
        await c.scroll('bottom');
        j = await c.jump('Q#2');
        jt = (j.jumps || [])[0] || {};
        check('P-K7b', '[new] bottom -> entry 2 (off screen) lands on its own bubble, in view',
              jt.kind === 'q' && jt.pos === 1 && j.resolved === '1' && j.landed && j.landed.inView && !(j.toasts || []).length, short(j));
        // K9: entry 11's slots re-used for entry 6, clicked before the next scan.
        await c.scroll('bottom');
        const before9 = JSON.stringify(await c.store());
        const reused = await c.ev(() => window.__mockWindow.recycle(10, 5));
        const clicked9 = await c.ev(() => window.__p.clickBoth(10));
        const after9 = JSON.stringify(await c.store());
        await c.settle();
        const redrawn = (await c.flags()).items.find((r) => r.i === 10) || {};
        await c.ev(() => window.__mockWindow.recycle(10, 10));
        await c.settle();
        check('P-K9', '[new] a node re-used for another entry: clicks on its two stale flags store nothing, and its flags are redrawn for what it shows',
              reused && clicked9 === 2 && before9 === after9 && redrawn.qKey === U(5) && redrawn.aKey === U(5) + ':answer',
              'reused=' + reused + ' clicked ' + clicked9 + ', ' + (before9 === after9 ? 'unchanged' : 'store changed: ' + after9.slice(0, 160)) +
              ', redrawn ' + redrawn.qKey + ' / ' + redrawn.aKey);
        // N2: a new entry the index does not list.
        await c.ev(() => window.__mockWindow.addEntry({ text: 'A brand new Perplexity question?', answer: 'Its answer.' }));
        await c.scroll('bottom');
        const beforeN = JSON.stringify(await c.store());
        await c.ev(() => { window.__acn.toasts = []; });
        const hasFlag = await c.click('q', 12);
        const toastN = (await c.ev(() => window.__acn.toasts.slice(-1)[0])) || '';
        const afterN = JSON.stringify(await c.store());
        check('N2', '[new] a new entry\'s flag saves nothing and says it is not in the index yet',
              hasFlag && beforeN === afterN && /not in the index yet/.test(toastN), 'flag=' + hasFlag + ' toast="' + toastN + '" ' + (beforeN === afterN ? 'unchanged' : 'store changed'));
        const storeA = await c.store();
        await c.close();

        // ── P-B: the same thread at www., the index answering 3 s late, in Korean ──
        const seedB = JSON.parse(JSON.stringify(storeA));
        const k10 = { id: 'bm_k10', schema: 2, entityType: 'user-msg', contentHash: U(11), msgUuid: U(11), preview: 'x', msgIndex: 3,
                      createdAt: Date.now() + 5000, platform: 'www.perplexity.ai' };
        const host = seedB[WWW] ? WWW : BARE;
        if (seedB[host]) seedB[host].bookmarks = seedB[host].bookmarks.filter((b) => b.msgUuid !== U(11) || b.entityType !== 'user-msg').concat([k10]);
        c = await open('perplexity', WWW, cfg(), { 'acn-bookmarks-v1': JSON.stringify(seedB), 'acn-settings': { language: 'ko' } },
                       { perplexity: () => PX, delay: 3000 });
        await sleep(300);
        const s0 = JSON.stringify(await c.store());
        const early = await c.cards();
        await c.indexed(11, 15000);
        const late = await c.waitCards((cs) => cs.indexOf('Q#11') !== -1, 8000);
        const s1 = JSON.stringify(await c.store());
        check('P-K10', '[new] panel open before the index: "Q#…", then "Q#11" for a record stored with msgIndex 3, no storage write',
              early[early.length - 1] === 'Q#…' && late[late.length - 1] === 'Q#11' && s0 === s1, short(early) + ' -> ' + short(late) + (s0 === s1 ? '' : ' (store written)'));
        check('P-K4b', '[new] in Korean the answer reads "Q#8에 대한 답변"', late.indexOf('Q#8에 대한 답변') !== -1, short(late));
        await c.settle();
        f = await c.flags();
        const e11b = f.items.find((r) => r.i === 11) || {};
        check('S1-P', '[new] the bookmarks made at perplexity.ai are lit and listed at www.perplexity.ai',
              e11b.qLit === true && e11b.aLit === true && late.indexOf('Q#2') !== -1, 'entry 12 lit=' + e11b.qLit + '/' + e11b.aLit + ' cards=' + short(late));
        await c.close();

        // ── P-C: split sets seeded (www. and bare), then a reload ──
        const rec = (id, type, key, extra) => Object.assign({ id, schema: 2, entityType: type, contentHash: key, msgUuid: key,
                                                               preview: 'p ' + id, msgIndex: 0, createdAt: 1000 + id.length, platform: 'perplexity.ai' }, extra || {});
        const OTHER1 = 'https://www.perplexity.ai/search/another-thread-abc', OTHER2 = 'https://perplexity.ai/search/another-thread-abc';
        const CLAUDE = 'https://claude.ai/chat/11111111-2222-4333-8444-555555555555';
        const split = {};
        split[WWW] = { bookmarks: [rec('bm_r1b', 'user-msg', U(0)),
                                   { id: 'bm_u1', schema: 1, entityType: 'user-msg', contentHash: U(4), msgUuid: null, preview: 'u', msgIndex: 3, createdAt: 950 },
                                   rec('bm_r5', 'ai-msg', U(9) + ':answer')] };
        split[BARE] = { bookmarks: [rec('bm_r1', 'user-msg', U(0)), rec('bm_r2', 'user-msg', U(5)), rec('bm_b1', 'user-msg', U(4))] };
        split[OTHER1] = { bookmarks: [rec('bm_o1', 'user-msg', 'x1')] };
        split[OTHER2] = { bookmarks: [rec('bm_o2', 'user-msg', 'x2')] };
        split[CLAUDE] = { bookmarks: [rec('bm_c1', 'user-msg', 'x3')] };
        c = await open('perplexity', BARE, cfg(), { 'acn-bookmarks-v1': JSON.stringify(split) }, api);
        await c.indexed(11);
        await c.settle();
        st = await c.store();
        const merged = list(st, WWW).map((b) => b.id).sort();
        const keysAfter = Object.keys(st);
        const untouched = [OTHER1, OTHER2, CLAUDE].every((k) => JSON.stringify(st[k]) === JSON.stringify(split[k]));
        cards = await c.cards();
        const storeC = JSON.stringify(st);
        await c.close();
        c = await open('perplexity', WWW, cfg(), { 'acn-bookmarks-v1': storeC }, api);
        await c.indexed(11);
        await c.settle();
        const again = JSON.stringify(await c.store());
        await c.close();
        check('S2-P', '[new] split sets merge (www. and bare host): union, the bound record kept, no duplicate, the old key gone; ' +
              'other threads and Claude\'s key untouched; a reload writes nothing',
              JSON.stringify(merged) === JSON.stringify(['bm_b1', 'bm_r1b', 'bm_r2', 'bm_r5']) && keysAfter.indexOf(BARE) === -1 && untouched && again === storeC &&
              JSON.stringify(cards.slice().sort()) === JSON.stringify(['Answer to Q#9', 'Q#1', 'Q#4', 'Q#5']),
              'merged=' + short(merged) + ' untouched=' + untouched + ' idempotent=' + (again === storeC) + ' cards=' + short(cards));

        // ── P-D: positional records from v12.14 ──
        const L = (id, type, text, idx, at) => ({ id, schema: 1, entityType: type, contentHash: contentHash(text, idx), msgUuid: null,
                                                 preview: text.substring(0, 120), msgIndex: idx, createdAt: at, platform: 'perplexity.ai' });
        const seedD = {};
        seedD[BARE] = { bookmarks: [                                   // filed under the bare host: the merge brings them in
            L('bm_old', 'user-msg', PX[8].query_str, pxNav(8), 1),     // its true place: binds
            L('bm_twin', 'user-msg', TWIN, 2, 2),                       // made on entry 10 at window place 2; entry 3 reads the same
            L('bm_mid', 'user-msg', PX[10].query_str, 1, 3),            // made on entry 11 at window place 1
            L('bm_ans', 'ai-msg', PX[4].answer, 1, 4) ] };
        c = await open('perplexity', BARE, cfg(), { 'acn-bookmarks-v1': JSON.stringify(seedD) }, api);
        await c.indexed(11);
        await c.settle();
        await c.scroll(8);
        await c.scroll(2);
        st = await c.store();
        const byId = (id) => list(st, WWW).find((b) => b.id === id) || {};
        cards = await c.cards();
        check('P-K12a', '[new] a positional record at its true place binds on proof when its question mounts',
              byId('bm_old').msgUuid === U(8), short(byId('bm_old')));
        check('P-K11a', '[new] the twin-text record is not bound to the other twin; it reads "Q#?"',
              byId('bm_twin').id && byId('bm_twin').msgUuid === null && cards[1] === 'Q#?', short(byId('bm_twin')) + ' cards=' + short(cards));
        await c.scroll('bottom');
        let jj = await c.jump('Q#8');
        jt = (jj.jumps || [])[0] || {};
        check('P-K12b', '[new] it then jumps to entry 9 from off screen', jt.kind === 'q' && jt.pos === 8 && jj.landed && jj.landed.inView, short(jj));
        cards = await c.cards();
        jj = await c.jump(cards[2]);
        const toastQ = (jj.toasts || [])[0] || '';
        const removed = await c.ev(() => window.__p.removeCard('Q#?') && window.__p.removeCard('Q#?'));
        await sleep(300);
        st = await c.store();
        cards = await c.cards();
        check('P-K11b', '[new] the record made mid-thread reads "Q#?", gives the question toast, and ✕ deletes it',
              /question bookmark could not be matched/.test(toastQ) && removed && !byId('bm_mid').id && !byId('bm_twin').id,
              'toast="' + toastQ + '" left=' + short(list(st, WWW).map((b) => b.id)));
        jj = await c.jump('A#?');
        check('P-K11c', '[new] an answer record from v12.14 reads "A#?" and gives the answer toast',
              cards.indexOf('A#?') !== -1 && /answer bookmark could not be matched/.test((jj.toasts || [])[0] || ''), short(cards) + ' ' + short(jj.toasts));
        await c.close();

        // ── P-E: question slots kept empty above the view (qLag) ──
        c = await open('perplexity', WWW, cfg({ qLag: true }), {}, api);
        await c.indexed(11);
        await c.settle();
        await c.ev(() => {                                             // entry 6's question slot just above the view
            var sc = document.getElementById('mock-scroller');
            sc.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
            sc.scrollTop = 5 * 600 + 150;
        });
        await sleep(250);
        await c.settle();
        f = await c.flags();
        const e5 = f.items.find((r) => r.i === 5) || {};
        await c.click('a', 5);
        st = await c.store();
        const lagRec = list(st, WWW).find((b) => b.msgUuid === U(5) + ':answer');
        check('P-K8b', '[new] an answer whose question slot is empty is flagged and saved under its own entry',
              e5.qMounted === false && e5.an === 1 && e5.aKey === U(5) + ':answer' && !!lagRec, short(e5));
        j = await c.jump('Answer to Q#5');
        jt = (j.jumps || [])[0] || {};
        const fast = jt.kind === 'a' && jt.pos === 5 && j.landed && j.landed.startInView && !(j.toasts || []).length;
        await c.scroll('bottom');
        j = await c.jump('Answer to Q#5');
        jt = (j.jumps || [])[0] || {};
        check('P-K8c', '[new] that answer is landed on, mounted (its question slot empty) and from off screen',
              fast && jt.kind === 'a' && jt.pos === 5 && j.landed && j.landed.startInView && !(j.toasts || []).length, 'mounted=' + fast + ' off-screen: ' + short(j));
        await c.close();

        // ── P-F: what the keys must refuse (qLag, the view as in P-E) ──
        c = await open('perplexity', WWW, cfg({ qLag: true }), {}, api);
        await c.indexed(11);
        await c.settle();
        await c.ev(() => {
            var sc = document.getElementById('mock-scroller');
            sc.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
            sc.scrollTop = 5 * 600 + 150;
        });
        await sleep(250);
        await c.settle();
        f = await c.flags();
        const pre5 = (f.items.find((r) => r.i === 5) || {}).aKey, pre7 = f.items.find((r) => r.i === 7) || {};
        // K13: entry 8's question edited in place before any refetch.
        const edited = await c.ev(() => window.__mockWindow.editQuestion(7, 'An edited version of question 8?'));
        await sleep(1500);
        f = await c.flags();
        const e7 = f.items.find((r) => r.i === 7) || {};
        const before13 = JSON.stringify(await c.store());
        const clicked13 = await c.ev(() => window.__p.clickBoth(7));
        await sleep(300);
        const after13 = JSON.stringify(await c.store());
        check('P-K13', '[new] a question edited in place: its question and answer flags have no key, and their clicks save nothing',
              edited && pre7.qKey === U(7) && pre7.aKey === U(7) + ':answer' && e7.qKey === 'nokey:user-msg' && e7.aKey === 'nokey:ai-msg' &&
              clicked13 === 2 && before13 === after13,
              'before ' + pre7.qKey + ' / ' + pre7.aKey + ', after ' + e7.qKey + ' / ' + e7.aKey + ', clicked ' + clicked13 + ', ' + (before13 === after13 ? 'unchanged' : 'store changed'));
        // K14a: a mounted question slot (entry 7's) carries a number that is not half its place.
        await c.ev(() => window.__mockWindow.renumber(6, 60));
        await sleep(1500);
        f = await c.flags();
        const a5 = (f.items.find((r) => r.i === 5) || {}).aKey;
        const before14 = JSON.stringify(await c.store());
        await c.click('a', 5);
        const after14 = JSON.stringify(await c.store());
        check('P-K14a', '[new] the slot-place fallback refuses when a mounted question slot is not at twice its entry number',
              pre5 === U(5) + ':answer' && a5 === 'nokey:ai-msg' && before14 === after14,
              'entry 6\'s answer flag ' + pre5 + ' -> ' + a5 + ', ' + (before14 === after14 ? 'unchanged' : 'store changed'));
        await c.close();

        // K14b: at the bottom, entries 10-12 mounted, the question slots of 11 and 12 empty, so the
        // one mounted question slot (entry 10's) sits above both answers and cannot contradict
        // their places; then two children that are not slots appear above entry 11.
        c = await open('perplexity', WWW, cfg({ around: 2 }), {}, api);
        await c.indexed(11);
        await c.settle();
        const hid = await c.ev(() => window.__mockWindow.hideQuestion(10) && window.__mockWindow.hideQuestion(11));
        await sleep(1500);
        const keysB0 = await c.ev(() => window.__mockWindow.answerKeys());
        const kids = await c.ev(() => window.__mockWindow.insertExtras(10, 2));
        await sleep(1500);
        const keysB1 = await c.ev(() => window.__mockWindow.answerKeys());
        const beforeB = JSON.stringify(await c.store());
        const clickedB = await c.ev((t) => window.__mockWindow.clickAnswer(t), PX[10].answer);
        await sleep(300);
        const afterB = JSON.stringify(await c.store());
        const keyB = (ks, i) => (ks.find((k) => k.text === PX[i].answer) || {}).key;
        check('P-K14b', '[new] the slot-place fallback refuses a list that is not exactly two slots per raw entry',
              hid && keyB(keysB0, 10) === U(10) + ':answer' && keyB(keysB0, 11) === U(11) + ':answer' && kids === 26 &&
              keyB(keysB1, 10) === 'nokey:ai-msg' && keyB(keysB1, 11) === 'nokey:ai-msg' && clickedB && beforeB === afterB,
              'before ' + short(keysB0.map((k) => k.key)) + ', ' + kids + ' children, after ' + short(keysB1.map((k) => k.key)) +
              ', ' + (beforeB === afterB ? 'unchanged' : 'store changed: ' + afterB.slice(0, 160)));
        await c.close();
    }

    console.log('check-ix-bookmarks — engine=' + engine + ', script=' + path.basename(scriptPath));
    for (const [name, fn] of [['chatgpt', chatgpt], ['perplexity', perplexity]]) {
        if (onlySite && onlySite !== name) continue;
        try { await fn(); }
        catch (e) { check(name, 'ran to the end', false, 'crashed: ' + String(e && e.stack || e).slice(0, 400)); }
    }
    check('G2', '[guard] no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' / '));
    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
