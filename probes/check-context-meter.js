#!/usr/bin/env node
// check-context-meter.js — v12.18 Part 1 (DEC-060; docs/specs/v12.18-spec.md): the context meter.
//
// Claude (the virtualizing mock, payloads with `compaction_summary`, measured shape: DOM-REFERENCE,
// Claude, "Compaction"):
//   M1  [new]   the context counted from the last summary drives the percentage; the whole history
//               shows as a secondary line ("whole chat ~"), larger
//   M2  [new]   "Summarized 2×" for two markers on the path
//   M3  [guard] no notice on load (v12.17 has no notices)
//   M4  [new]   Navigate: Q#1–Q#19 tagged "summary", the divider before Q#20
//   M5  [new]   a refetch where N grows: the new-summary notice ("at Q#40", "Q#1–39")
//   M6  [new]   the same refetch with a new model: the change notice, windows and percentages
//   M7  [new]   a change past the new window adds "Claude will summarize earlier messages to make room."
//   M8  [new]   a switch to another conversation with another model: no change notice
//   M9  [new]   the label "Opus 5 · 1M window"; Opus 3 and Haiku 4.5 a plain 200K, no "assumed"
//   M10 [guard] no model at all: "limit assumed" and "Model not identified"
//   M11 [new]   no marker and >= 95% of the window: the fallback alert; with a marker, none
//   M11c[new]   the dots follow the context since the last summary, not the whole history
//   M12 [new]   Navigate never opened until after the refetch (the meter never drawn before it): the
//               notices are there when it opens
//   M13 [new]   a notice's ✕ removes it, and only it
//   M15 [new]   Path A (cached SSE, "(last known"): the context from the last summary drives it too
//   M16 [new]   the alert's threshold: no marker at about 96% of a 500K window, the alert; at about 93%, none
//   M11d[new]   a summarized chat still at or past 95% since its last summary: no fallback alert (marker present)
//   M14 [guard] a switch to a conversation still loading shows none of the previous one's notices
//               (v12.17 has no notices; the pre-fix build kept them until the new index was ready)
// ChatGPT (chatgpt-windowed.html; metadata.model_slug per answer):
//   C1  [new]   plan not set: tokens only, "window depends on your plan", the "Set your plan" control
//   C2  [new]   Plus + an Instant slug: 54K and its percentage; Plus + a Thinking slug: 256K
//   C3  [new]   changing the setting to Pro updates the meter to 128K and fires the notice
//   C4  [new]   an unknown slug, and Free + Thinking: no percentage
//   C5  [new]   a new answer in another mode, with Navigate closed: "Mode changed: Instant → Thinking" and 256K
//   C6  [new]   Free (27K) at 98%: the fallback alert, and dots that follow the meter (green, yellow, red)
//   C7  [new]   the meter's plan control opens the settings panel, the plan select focused
//   C8  [new]   the plan changed while the index is still loading: the notice once it is ready
// Gemini (gemini-history.html) and Perplexity (perplexity-windowed.html):
//   S1  [new]   no percentage, "window not published"
//   S2  [guard] short questions only: every dot green
//   S3  [new]   a few huge answers: dots by size against 1M, green below 700K, yellow below 850K, red from 850K
//   S4  [new]   the caption names the current site, and no other
//   S5  [new]   Gemini: the "older messages are not loaded" line beside the estimate
//   S6  [new]   Gemini: the last answer grows (no new question): the estimate follows
//   S7  [new]   Perplexity whose index fails: the estimate says it counts the questions only, dots positional
//   E           no page errors
//
// CONTEXT of these results: Playwright <engine>, page realm, headless, this machine; the userscript
// inlined into the mocks, GM storage and every request stubbed. Not a userscript manager and not the
// sites' real payloads: real-browser acceptance on all three browsers is the owner's (DEC-031).
// ACN_SCRIPT=<file> runs another build (v12.17: `git show 8909d92:ai-conversation-navigator.user.js`).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const ORG = '99999999-9999-4999-8999-999999999999';
const OVERHEAD = 30000;   // _estimateClaudeOverhead() on /chat/<id>

// ── In-page read, the same on every site ──────────────────────────────────────────────────────
const READ = `(function () {
    function g(id) { return document.getElementById(id); }
    function t(id) { var e = g(id); return e ? e.textContent : null; }
    var pct = g('acn-ctx-pct'), meta = g('acn-ctx-meta'), dotsEl = g('acn-ctx-dots');
    var A = function (k) { return pct ? pct.getAttribute(k) : null; };
    var items = document.querySelectorAll('#acn-nav-list [data-acn-role="nav-item"]'), tagged = [];
    Array.prototype.forEach.call(items, function (it, i) {
        if (it.querySelector('[data-acn-role="summary-tag"]')) tagged.push(i + 1);
    });
    var div = document.querySelector('#acn-nav-list [data-acn-role="summary-divider"]');
    var dots = dotsEl ? Array.prototype.map.call(dotsEl.children, function (d) {
        var c = getComputedStyle(d).backgroundColor;
        return c === 'rgb(34, 197, 94)' ? 'G' : c === 'rgb(234, 179, 8)' ? 'Y' : c === 'rgb(239, 68, 68)' ? 'R' : '?';
    }).join('') : '';
    var stat = g('acn-nav-stat');
    return {
        pct: pct ? pct.textContent : null,
        eff: A('data-acn-ctx-effective'), whole: A('data-acn-ctx-whole'), n: A('data-acn-ctx-summaries'),
        limit: A('data-acn-ctx-limit'), source: A('data-acn-ctx-limit-source'), model: A('data-acn-ctx-model'),
        tokens: A('data-acn-ctx-tokens'),
        meta: meta ? meta.textContent : null, label: t('acn-ctx-model'), sum: t('acn-ctx-sum'),
        alert: t('acn-ctx-alert'), plan: t('acn-ctx-plan'), hist: t('acn-ctx-hist'), caption: t('acn-ctx-caption'),
        heading: (document.querySelector('#acn-panel-nav .acn-ctx-l') || {}).textContent || null,
        notices: Array.prototype.map.call(document.querySelectorAll('#acn-ctx-notices [data-acn-notice]'),
            function (n) { var sp = n.querySelector('span'); return { kind: n.getAttribute('data-acn-notice'), text: sp ? sp.textContent : n.textContent }; }),
        count: stat ? stat.getAttribute('data-acn-count') : null,
        tagged: tagged, divider: div ? div.getAttribute('data-acn-before') : null,
        dots: dots, dotBasis: dotsEl ? dotsEl.getAttribute('data-acn-dot-basis') : null, vis: document.visibilityState
    };
}())`;

async function readStable(pg, ms) {
    const deadline = Date.now() + (ms || 10000);
    let prev = null, cur = null;
    while (Date.now() < deadline) {
        cur = await pg.evaluate(READ);
        if (prev && JSON.stringify(prev) === JSON.stringify(cur)) { cur.stable = true; return cur; }
        prev = cur;
        await pg.waitForTimeout(700);
    }
    if (cur) cur.stable = false;
    return cur || { stable: false };
}
const short = (r) => JSON.stringify({ pct: r.pct, eff: r.eff, whole: r.whole, n: r.n, limit: r.limit, source: r.source,
    meta: r.meta, label: r.label, sum: r.sum, alert: r.alert, plan: r.plan, hist: r.hist, notices: r.notices,
    count: r.count, tagged: r.tagged.length ? r.tagged[0] + '..' + r.tagged[r.tagged.length - 1] + ' (' + r.tagged.length + ')' : '',
    divider: r.divider, dots: r.dots, stable: r.stable, vis: r.vis });

// ── Claude ────────────────────────────────────────────────────────────────────────────────────
const CL_TURNS = 40, CL_ROWS = CL_TURNS * 2;
const CONV_A = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
const CONV_B = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2';
const SUFFIX = ' VISIBLE-NOT-SR-ONLY';   // the mock's visible span after a question
const REGEN_TEXT = 'A regenerated answer for the last case: start over, then check the inputs again.';
const qText = (t) => 'Question number ' + t + ': how do I handle case ' + t + ' when the input is unusual?' + SUFFIX;
const aText = (t) => 'Answer number ' + t + ': validate the input first, then branch on the result.';
const summary = (len) => [{ type: 'text', text: 'Summary of the earlier conversation. '.repeat(Math.ceil(len / 37)).slice(0, len),
    citations: [], start_timestamp: '2026-10-01T00:00:00Z', stop_timestamp: '2026-10-01T00:00:09Z' }];

// opts: model, pad (characters in a first assistant message with no stop_reason: an entry that
// renders no row, as check-ctx-limit's; with padAt: t, after turn t's answer instead), summaries (turns whose answer carries a summary),
// summaryLen, regen ('done' | 'streaming': a regenerated last answer is the new leaf),
// regenSummary (that answer carries a summary).
function clPayload(conv, opts) {
    opts = opts || {};
    const msgs = [], truth = [];
    const id = (i, tag) => conv.slice(0, 24) + (tag || '') + String(i).padStart(12 - (tag || '').length, '0');
    let seq = 0, prev = '00000000-0000-4000-8000-000000000000';
    const padMsg = () => ({ uuid: id(seq++, 'f'), parent_message_uuid: prev, sender: 'assistant', attachments: [], files: [],
        content: [{ type: 'text', text: 'Conversation started. ' + 'lorem ipsum dolor sit amet '.repeat(Math.ceil(opts.pad / 27)).slice(0, opts.pad) }] });
    if (opts.pad && !opts.padAt) {
        const p = { uuid: id(seq++, 'f'), parent_message_uuid: prev, sender: 'assistant', attachments: [], files: [],
                    content: [{ type: 'text', text: 'Conversation started. ' + 'lorem ipsum dolor sit amet '.repeat(Math.ceil(opts.pad / 27)).slice(0, opts.pad) }] };
        msgs.push(p); prev = p.uuid;
    }
    for (let t = 1; t <= CL_TURNS; t++) {
        const q = { uuid: id(seq++), parent_message_uuid: prev, sender: 'human', content: [{ type: 'text', text: qText(t) }], attachments: [], files: [] };
        msgs.push(q); truth.push(q.uuid); prev = q.uuid;
        const a = { uuid: id(seq++), parent_message_uuid: prev, sender: 'assistant', stop_reason: 'end_turn',
                    content: [{ type: 'text', text: aText(t) }], attachments: [], files: [] };
        if ((opts.summaries || []).indexOf(t) !== -1) a.compaction_summary = summary(opts.summaryLen || 8000);
        msgs.push(a); truth.push(a.uuid); prev = a.uuid;
        if (opts.pad && opts.padAt === t) { const pm = padMsg(); msgs.push(pm); prev = pm.uuid; }
    }
    let leaf = prev;
    if (opts.regen) {
        const last = msgs[msgs.length - 1];
        const r = { uuid: id(9003, 'b'), parent_message_uuid: last.parent_message_uuid, sender: 'assistant', stop_reason: 'end_turn',
                    content: [{ type: 'text', text: REGEN_TEXT }], attachments: [], files: [] };
        if (opts.regen === 'streaming') { delete r.stop_reason; r.content[0].text = REGEN_TEXT.slice(0, 27); }
        else if (opts.regenSummary) r.compaction_summary = summary(opts.summaryLen || 8000);
        msgs.push(r); leaf = r.uuid; truth[CL_ROWS - 1] = r.uuid;
    }
    msgs.forEach((m, i) => { m.index = 1000 + i * 3; m.created_at = '2026-10-01T00:00:00Z'; m.text = ''; });
    const payload = { uuid: conv, name: 'context meter checks', current_leaf_message_uuid: leaf, chat_messages: msgs };
    if (opts.model) payload.model = opts.model;
    return { payload, truth };
}

// The userscript's formula, from the payload (no thinking, no tools, no attachments here):
// overhead + round(chars from the question before the last summary's message + the summary) / 4.
function clExpect(payload) {
    const by = {};
    payload.chat_messages.forEach((m) => { by[m.uuid] = m; });
    const path = [];
    for (let u = payload.current_leaf_message_uuid; u && by[u]; u = by[u].parent_message_uuid) path.unshift(by[u]);
    const len = (m) => (m.content || []).filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n').trim().length;
    let at = -1, n = 0;
    path.forEach((m, i) => { if (Array.isArray(m.compaction_summary) && m.compaction_summary.length) { at = i; n++; } });
    const from = at < 0 ? 0 : (at > 0 && path[at - 1].sender === 'human' ? at - 1 : at);
    const whole = Math.round(path.reduce((s, m) => s + len(m), 0) / 4) + OVERHEAD;
    const sum = at < 0 ? 0 : path[at].compaction_summary[0].text.length;
    const eff = at < 0 ? whole : Math.round((path.slice(from).reduce((s, m) => s + len(m), 0) + sum) / 4) + OVERHEAD;
    return { eff, whole, n };
}

// plans: { <conversation uuid>: { phase: { idle, streaming, done } } | { static: payload } }
function clPage(script, mockConfig, plans, store) {
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const body = (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock;
    const enc = {};
    Object.keys(plans).forEach((cid) => {
        const p = plans[cid];
        enc[cid] = p.static ? { static: JSON.stringify(p.static), delay: p.delay || 10 }
            : { phase: { idle: JSON.stringify(p.phase.idle), streaming: JSON.stringify(p.phase.streaming), done: JSON.stringify(p.phase.done) } };
    });
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>context meter checks</title></head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(mockConfig)};</script>
${body}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var PLANS = ${JSON.stringify(enc)};
    window.__acn = { fetches: {} };
    window.__acnNativePushState = History.prototype.pushState;
    var _s = ${JSON.stringify(store || {})};
    window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
    window.GM_setValue = function (k, v) { _s[k] = v; };
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
        var m = url.match(/chat_conversations\\/([0-9a-f-]+)/i);
        if (m && PLANS[m[1]]) {
            var p = PLANS[m[1]], body;
            var wait = 10;
            if (p.static) { body = p.static; wait = p.delay || 10; }
            else {
                var pc = window.__mockVirtualization && window.__mockVirtualization.partC;
                body = p.phase[pc ? pc.phase() : 'idle'] || p.phase.idle;
            }
            window.__acn.fetches[m[1]] = (window.__acn.fetches[m[1]] || 0) + 1;
            setTimeout(function () { if (opts.onload) opts.onload({ status: 200, responseText: body }); }, wait);
            return;
        }
        respond(404, '');
    };
    try { document.cookie = 'lastActiveOrg=' + ${JSON.stringify(ORG)} + '; path=/'; } catch (e) {}
}());
</script>
<script>${script}</script></body></html>`;
}

// ── ChatGPT ───────────────────────────────────────────────────────────────────────────────────
const GPT_CONV = '6994e2d6-ce6c-832a-aa7d-04b747928fd8';
const GPT_N = 24;
const gUuid = (n, tag) => (tag || 'aaaaaaaa') + '-0000-4000-8000-' + String(n).padStart(12, '0');
function gptTurns(pad) {
    return Array.from({ length: GPT_N }, (_, i) => gptTurn(i, pad));
}
function gptTurn(i, pad) {
    return { id: gUuid(i), text: 'ChatGPT probe question ' + (i + 1) + ' about windowing?',
             aid: gUuid(i, 'cccccccc'), answer: 'Answer ' + (i + 1) + ': the window holds a few turns and drops the rest. ' + 'x'.repeat(pad || 4000) };
}
function gptMapping(T, slugOf) {
    const m = {};
    const add = (id, parent, message) => { m[id] = { id, parent, children: [], message }; if (parent) m[parent].children.push(id); };
    add('client-created-root', null, null);
    add('sys-0', 'client-created-root', { id: 'sys-0', author: { role: 'system' }, content: { content_type: 'text', parts: [''] }, metadata: {} });
    let prev = 'sys-0';
    T.forEach((t, i) => {
        add(t.id, prev, { id: t.id, author: { role: 'user' }, content: { content_type: 'text', parts: [t.text] }, metadata: {} });
        add(t.aid, t.id, { id: t.aid, author: { role: 'assistant' }, recipient: 'all', content: { content_type: 'text', parts: [t.answer] },
                           metadata: { model_slug: slugOf(i) } });
        prev = t.aid;
    });
    return { title: 'probe', conversation_id: GPT_CONV, mapping: m, current_node: prev };
}
const gptTokens = (T) => Math.round(T.reduce((s, t) => s + t.text.length + t.answer.length, 0) / 4);

// ── Perplexity ────────────────────────────────────────────────────────────────────────────────
const PPLX_CONV = 'de5dd7ce-5eb6-4045-a861-d337141e10b6';
const PPLX_N = 12;
function pplxEntries(big) {
    return Array.from({ length: PPLX_N }, (_, i) => {
        const q = 'Perplexity probe question ' + (i + 1) + ' about pinned scrollers?';
        let a = 'Answer ' + (i + 1) + ': the pin releases on a wheel.';
        if (big && big[i + 1]) a += ' ' + 'scroller data'.repeat(Math.ceil(big[i + 1] / 13)).slice(0, big[i + 1]);
        const final = { step_type: 'FINAL', content: { answer: JSON.stringify({ answer: a, web_results: [] }) } };
        return { backend_uuid: gUuid(i, 'bbbbbbbb'), query_str: q, read_write_token: 'SECRET-RW-' + i,
                 text: JSON.stringify([{ step_type: 'INITIAL_QUERY', content: { query: q } }, final]), attachments: [],
                 short: 'Answer ' + (i + 1) + ': the pin releases on a wheel.' };
    });
}
function pplxPage(all, url) {
    const u = new URL(url);
    const limit = parseInt(u.searchParams.get('limit') || '20', 10);
    const cur = u.searchParams.get('cursor');
    const start = cur ? parseInt(cur.replace('cur-', ''), 10) : 0;
    const more = start + limit < all.length;
    return { status: 'COMPLETED', entries: all.slice(start, start + limit).map((e) => { const c = Object.assign({}, e); delete c.short; return c; }),
             has_next_page: more, next_cursor: more ? 'cur-' + (start + limit) : null };
}

// ── Gemini ────────────────────────────────────────────────────────────────────────────────────
const GM_CHAT = 'aa32aa32aa32aa32';

// ── Shared page pieces (as check-feature-gaps) ───────────────────────────────────────────────
function mockParts(file) {
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages', file), 'utf8');
    return { body: (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock,
             head: (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '' };
}
function page(file, script, cfg, store) {
    const m = mockParts(file);
    return `<!DOCTYPE html><html><head>${m.head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(cfg || {})};</script>
${m.body}
<script>
delete window._aiNavAlreadyLoaded;
var _s = ${JSON.stringify(store || {})};
window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
window.GM_setValue = function (k, v) { _s[k] = v; };
</script>
<script>${script}</script></body></html>`;
}

(async () => {
    const argv = process.argv;
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = argv.includes('--quiet');
    const only = argv.indexOf('--only') !== -1 ? argv[argv.indexOf('--only') + 1].split(',') : null;
    const want = (s) => !only || only.indexOf(s) !== -1;
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    let failures = 0, invalid = 0;
    const pageErrors = [];
    function check(id, label, desc, ok, detail) {
        if (!ok) failures++;
        if (!ok || !quiet) console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + id + ' [' + label + '] ' + desc + (detail ? ' — ' + detail : ''));
    }
    function precondition(id, ok, detail) {
        if (ok) return true;
        invalid++;
        console.log('  INVALID  ' + id + ' precondition failed' + (detail ? ' — ' + detail : ''));
        return false;
    }
    async function open(url, html, api, urlPrefix) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const pg = await context.newPage();
        const logs = [];
        pg.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
        pg.on('console', (m) => logs.push(m.text()));
        await pg.route('**/*', (route) => {
            const u = route.request().url();
            if (/^(blob|data):/.test(u)) { route.continue().catch(() => {}); return; }
            if (u === url || (urlPrefix && u.indexOf(urlPrefix) === 0)) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }).catch(() => {});
                return;
            }
            const a = api ? api(u) : null;
            if (a && a.delay) { setTimeout(() => route.fulfill({ status: a.status, contentType: 'application/json', body: a.body }).catch(() => {}), a.delay); return; }
            if (a) { route.fulfill({ status: a.status, contentType: 'application/json', body: a.body }).catch(() => {}); return; }
            route.abort().catch(() => {});
        });
        await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await pg.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        return { context, pg, logs };
    }
    async function openNav(pg, n, ms) {
        await pg.evaluate("(function () { var p = document.getElementById('acn-panel-nav');" +
                          " if (!p || p.getAttribute('data-acn-open') !== 'true') document.getElementById('acn-dot-nav').click(); }())");
        try {
            await pg.waitForFunction((x) => { const s = document.getElementById('acn-nav-stat');
                return s && s.getAttribute('data-acn-count') === String(x); }, n, { timeout: ms || 20000 });
            return true;
        } catch (e) { return false; }
    }
    const indexReady = (logs, n) => logs.filter((l) => l.indexOf('[ACN] conversation index ready:') === 0).length >= (n || 1);
    async function waitFor(pg, fn, ms) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { if (await fn()) return true; await pg.waitForTimeout(250); }
        return false;
    }

    console.log('check-context-meter — engine=' + engine + ', script=' + path.basename(scriptPath));

    // ── Claude ──────────────────────────────────────────────────────────────────────────────
    const keysCfg = (truth, extra) => Object.assign({ totalMessages: CL_ROWS, tailRows: 3, answerTestid: true, answerHeaders: true,
                                                      turnKeys: truth.slice(), perfRow: true }, extra || {});
    async function clOpen(plans, truth, conv, cfg, store, skipNav) {
        const html = clPage(raw, cfg || keysCfg(truth), plans, store);
        const o = await open('https://claude.ai/chat/' + (conv || CONV_A), html, null, 'https://claude.ai/chat/');
        o.ready = await waitFor(o.pg, async () => indexReady(o.logs), 30000);
        await o.pg.waitForTimeout(800);
        if (skipNav) { o.listed = true; o.r = { stable: true, vis: await o.pg.evaluate('document.visibilityState') }; return o; }
        o.listed = await openNav(o.pg, CL_TURNS);
        await o.pg.waitForTimeout(800);
        o.r = await readStable(o.pg);
        return o;
    }
    const clOk = (id, o) => precondition(id, o.ready && o.listed && o.r.stable && o.r.vis === 'visible',
        'ready=' + o.ready + ' listed=' + o.listed + ' ' + short(o.r));
    const near = (a, b, tol) => a !== null && Math.abs(Number(a) - b) <= (tol || 2);
    const pctOf = (tok, lim) => Math.min(100, Math.round(tok / lim * 100));

    if (want('claude')) {
        // Static: two summaries (answers 10 and 20), a large first message before both, Opus 5 (1M).
        {
            const p = clPayload(CONV_A, { model: 'claude-opus-5', pad: 800000, summaries: [10, 20] });
            const x = clExpect(p.payload);
            const o = await clOpen({ [CONV_A]: { static: p.payload } }, p.truth);
            if (clOk('M1', o)) {
                const r = o.r;
                check('M1', 'new', 'the context from the last summary drives the percentage; the whole history is a secondary line, larger',
                    near(r.eff, x.eff) && near(r.whole, x.whole) && r.pct === pctOf(x.eff, 1000000) + '%' &&
                    x.whole > x.eff * 3 && /whole chat ~/.test(r.sum || ''),
                    'want eff=' + x.eff + ' whole=' + x.whole + ' pct=' + pctOf(x.eff, 1000000) + '% | ' + short(r));
                check('M2', 'new', '"Summarized 2×" for two markers', r.n === '2' && /^Summarized 2×/.test(r.sum || ''), short(r));
                check('M3', 'guard', 'no notice on load', r.notices.length === 0, short(r));
                check('M4', 'new', 'Navigate: Q#1–Q#19 tagged "summary", the divider before Q#20',
                    r.tagged.length === 19 && r.tagged[0] === 1 && r.tagged[18] === 19 && r.divider === '20', short(r));
                check('M9', 'new', 'the label "Opus 5 · 1M window"', r.label === 'Opus 5 · 1M window' &&
                    !/assumed/.test(r.meta || ''), short(r));
            }
            await o.context.close();
        }
        // A refetch in the same conversation: a regenerated last answer that carries a new summary,
        // written by a new model (Opus 5 -> Opus 4.8).
        {
            const p0 = clPayload(CONV_A, { model: 'claude-opus-5', pad: 800000, summaries: [20] });
            const pS = clPayload(CONV_A, { model: 'claude-opus-5', pad: 800000, summaries: [20], regen: 'streaming' });
            const pD = clPayload(CONV_A, { model: 'claude-opus-4-8', pad: 800000, summaries: [20], regen: 'done', regenSummary: true });
            const x0 = clExpect(p0.payload), xD = clExpect(pD.payload);
            const o = await clOpen({ [CONV_A]: { phase: { idle: p0.payload, streaming: pS.payload, done: pD.payload } } }, p0.truth);
            if (clOk('M5', o)) {
                const before = o.r;
                // Navigate is closed for the refetch (M12): the meter is not drawn by scans then.
                await o.pg.evaluate("document.getElementById('acn-dot-nav').click()");
                await o.pg.waitForTimeout(600);
                const closed = await o.pg.evaluate("document.getElementById('acn-panel-nav').getAttribute('data-acn-open') !== 'true'");
                await o.pg.evaluate('window.__mockVirtualization.partC.regenerate(' + (CL_ROWS - 1) + ',' + JSON.stringify(REGEN_TEXT) +
                                    ',4500,' + JSON.stringify(pD.truth[CL_ROWS - 1]) + ',"start",3)');
                const refetched = await waitFor(o.pg, async () => (await o.pg.evaluate('window.__acn.fetches[' + JSON.stringify(CONV_A) + ']')) >= 2 &&
                    indexReady(o.logs, 2), 30000);
                await o.pg.waitForTimeout(2500);
                await openNav(o.pg, CL_TURNS);
                await o.pg.waitForTimeout(800);
                const r = await readStable(o.pg);
                if (precondition('M5', refetched && r.stable, 'refetched=' + refetched + ' ' + short(r))) {
                    const sumN = r.notices.filter((n) => n.kind === 'summary');
                    const modN = r.notices.filter((n) => n.kind === 'model');
                    check('M5', 'new', 'a refetch where N grows: one new-summary notice, at Q#40, Q#1–39 kept as a summary (none before it)',
                        before.notices.length === 0 && sumN.length === 1 &&
                        sumN[0].text.indexOf('Claude summarized earlier messages at Q#40.') === 0 &&
                        sumN[0].text.indexOf('Q#1–39 are kept as a summary.') !== -1 && r.n === '2',
                        'before=' + JSON.stringify(before.notices) + ' after=' + short(r));
                    const want6 = 'Model changed: Opus 5 → Opus 4.8. Window 1M → 500K, so ' + pctOf(xD.eff, 1000000) + '% → ' + pctOf(xD.eff, 500000) + '%.';
                    check('M6', 'new', 'the same refetch with a new model: "' + want6 + '"',
                        modN.length === 1 && modN[0].text.indexOf(want6) === 0 && !/make room/.test(modN[0].text) &&
                        r.label === 'Opus 4.8 · 500K window' && near(r.eff, xD.eff),
                        'x0.eff=' + x0.eff + ' xD.eff=' + xD.eff + ' ' + short(r));
                    check('M5b', 'new', 'the refetch happened with Navigate closed after being open: both notices when it reopens',
                        closed && sumN.length === 1 && modN.length === 1, 'closed=' + closed + ' ' + JSON.stringify(r.notices));
                    // M13: the summary notice's ✕.
                    await o.pg.evaluate("(function () { var n = document.querySelector('#acn-ctx-notices [data-acn-notice=\"summary\"] [data-acn-role=\"ctx-notice-dismiss\"]'); if (n) n.click(); }())");
                    await o.pg.waitForTimeout(700);
                    const r13 = await readStable(o.pg);
                    check('M13', 'new', 'a notice\'s ✕ removes it, and only it',
                        r13.notices.length === 1 && r13.notices[0].kind === 'model', JSON.stringify(r13.notices));
                }
            }
            await o.context.close();
        }
        // M12: the same refetch, with Navigate never opened before it.
        {
            const p0 = clPayload(CONV_A, { model: 'claude-opus-5', pad: 800000, summaries: [20] });
            const pS = clPayload(CONV_A, { model: 'claude-opus-5', pad: 800000, summaries: [20], regen: 'streaming' });
            const pD = clPayload(CONV_A, { model: 'claude-opus-4-8', pad: 800000, summaries: [20], regen: 'done', regenSummary: true });
            const o = await clOpen({ [CONV_A]: { phase: { idle: p0.payload, streaming: pS.payload, done: pD.payload } } }, p0.truth, null, null, null, true);
            const neverOpen = await o.pg.evaluate("(document.getElementById('acn-panel-nav') || { getAttribute: function () {} }).getAttribute('data-acn-open') !== 'true'");
            if (precondition('M12', o.ready && neverOpen, 'ready=' + o.ready + ' neverOpen=' + neverOpen)) {
                await o.pg.waitForTimeout(1500);   // scans see the ready index while Navigate is closed
                await o.pg.evaluate('window.__mockVirtualization.partC.regenerate(' + (CL_ROWS - 1) + ',' + JSON.stringify(REGEN_TEXT) +
                                    ',4500,' + JSON.stringify(pD.truth[CL_ROWS - 1]) + ',"start",3)');
                const refetched = await waitFor(o.pg, async () => indexReady(o.logs, 2), 30000);
                await o.pg.waitForTimeout(2500);
                await openNav(o.pg, CL_TURNS);
                await o.pg.waitForTimeout(800);
                const r = await readStable(o.pg);
                check('M12', 'new', 'Navigate first opened after the refetch: the model and summary notices are there',
                    refetched && r.notices.filter((n) => n.kind === 'model').length === 1 &&
                    r.notices.filter((n) => n.kind === 'summary').length === 1, 'refetched=' + refetched + ' ' + short(r));
            }
            await o.context.close();
        }
        // A model change past the new window: no summary, 2.0M characters (Opus 5 -> Opus 4.8).
        {
            const p0 = clPayload(CONV_A, { model: 'claude-opus-5', pad: 2000000 });
            const pS = clPayload(CONV_A, { model: 'claude-opus-5', pad: 2000000, regen: 'streaming' });
            const pD = clPayload(CONV_A, { model: 'claude-opus-4-8', pad: 2000000, regen: 'done' });
            const xD = clExpect(pD.payload);
            const o = await clOpen({ [CONV_A]: { phase: { idle: p0.payload, streaming: pS.payload, done: pD.payload } } }, p0.truth);
            if (clOk('M7', o)) {
                const before = o.r;
                await o.pg.evaluate('window.__mockVirtualization.partC.regenerate(' + (CL_ROWS - 1) + ',' + JSON.stringify(REGEN_TEXT) +
                                    ',4500,' + JSON.stringify(pD.truth[CL_ROWS - 1]) + ',"start",3)');
                const refetched = await waitFor(o.pg, async () => indexReady(o.logs, 2), 30000);
                await o.pg.waitForTimeout(2500);
                const r = await readStable(o.pg);
                if (precondition('M7', refetched && r.stable, short(r))) {
                    const modN = r.notices.filter((n) => n.kind === 'model');
                    check('M7', 'new', 'a change past the new window adds "Claude will summarize earlier messages to make room."',
                        xD.eff >= 500000 && modN.length === 1 && / Claude will summarize earlier messages to make room\.$/.test(modN[0].text),
                        'xD.eff=' + xD.eff + ' ' + short(r));
                    check('M11', 'new', 'no marker and >= 95% of the window: the fallback alert (none at 53% of 1M before the change)',
                        !before.alert && /^This chat has likely passed its context window\. If code execution is on/.test(r.alert || ''),
                        'before=' + JSON.stringify(before.alert) + ' after=' + short(r));
                }
            }
            await o.context.close();
        }
        // A switch to another conversation, with another model: no change notice. Without turnKeys,
        // as check-ctx-limit L6 (the mock's rows read the same in both).
        {
            const pa = clPayload(CONV_A, { model: 'claude-opus-5' });
            const pb = clPayload(CONV_B, { model: 'claude-opus-4-8' });
            const cfg = { totalMessages: CL_ROWS };
            const o = await clOpen({ [CONV_A]: { static: pa.payload }, [CONV_B]: { static: pb.payload } }, pa.truth, CONV_A, cfg);
            if (clOk('M8', o)) {
                await o.pg.evaluate((u) => {
                    window.__acnNativePushState.call(history, {}, '', '/chat/' + u);
                    var n = document.createElement('div'); document.body.appendChild(n); n.remove();
                }, CONV_B);
                const switched = await waitFor(o.pg, async () => indexReady(o.logs, 2), 30000);
                await o.pg.waitForTimeout(1500);
                await openNav(o.pg, CL_TURNS);
                const r = await readStable(o.pg);
                if (precondition('M8', switched && r.stable, short(r))) {
                    check('M8', 'new', 'a switch to another conversation (Opus 5 -> Opus 4.8): no change notice, the new label',
                        o.r.label === 'Opus 5 · 1M window' && r.label === 'Opus 4.8 · 500K window' && r.notices.length === 0, short(r));
                }
            }
            await o.context.close();
        }
        // M11d: a summary on answer 1, then 1.9M characters after it: >= 95% since the summary, with a marker.
        {
            const p = clPayload(CONV_A, { model: 'claude-sonnet-4-6', pad: 1900000, padAt: 20, summaries: [1] });
            const x = clExpect(p.payload);
            const o = await clOpen({ [CONV_A]: { static: p.payload } }, p.truth);
            if (clOk('M11d', o)) {
                check('M11d', 'new', 'a summarized chat at ' + pctOf(x.eff, 500000) + '% since its summary: no fallback alert (a marker is on its path)',
                    x.eff >= 0.95 * 500000 && near(o.r.eff, x.eff) && o.r.n === '1' && !o.r.alert, 'x.eff=' + x.eff + ' ' + short(o.r));
            }
            await o.context.close();
        }
        // M16: no marker, Sonnet 4.6 (500K), at about 96% and about 93%.
        {
            const res = {};
            for (const [k, pad] of [['p96', 1797000], ['p93', 1733000]]) {
                const p = clPayload(CONV_A, { model: 'claude-sonnet-4-6', pad });
                const x = clExpect(p.payload);
                const o = await clOpen({ [CONV_A]: { static: p.payload } }, p.truth);
                res[k] = clOk('M16-' + k, o) ? { r: o.r, share: x.eff / 500000 } : null;
                await o.context.close();
            }
            if (res.p96 && res.p93) {
                check('M16', 'new', 'no marker: the alert at ' + (res.p96.share * 100).toFixed(1) + '% of the window, none at ' +
                    (res.p93.share * 100).toFixed(1) + '%', res.p96.share >= 0.95 && res.p93.share < 0.95 && !!res.p96.r.alert && !res.p93.r.alert,
                    short(res.p96.r) + ' | ' + short(res.p93.r));
            }
        }
        // M15: Path A, from a cached SSE entry (the meta reads "(last known").
        {
            const p = clPayload(CONV_A, { model: 'claude-opus-5', pad: 800000, summaries: [10, 20] });
            const x = clExpect(p.payload);
            const cache = { acn_ctx_cache: { [CONV_A]: { cumulativeThinkingChars: 0, sseMessageCount: 3, timestamp: 1 } } };
            const o = await clOpen({ [CONV_A]: { static: p.payload } }, p.truth, null, null, cache);
            if (clOk('M15', o)) {
                check('M15', 'new', 'Path A ("(last known"): the context from the last summary drives the percentage; whole chat secondary',
                    /\(last known\)/.test(o.r.meta || '') && near(o.r.eff, x.eff) && near(o.r.whole, x.whole) &&
                    o.r.pct === pctOf(x.eff, 1000000) + '%' && /^Summarized 2/.test(o.r.sum || ''), 'want eff=' + x.eff + ' ' + short(o.r));
            }
            await o.context.close();
        }
        // M14: a notice in A, then a switch to B, whose index answers 8 s later.
        {
            const p0 = clPayload(CONV_A, { model: 'claude-opus-5' });
            const pS = clPayload(CONV_A, { model: 'claude-opus-5', regen: 'streaming' });
            const pD = clPayload(CONV_A, { model: 'claude-opus-4-8', regen: 'done' });
            const pb = clPayload(CONV_B, { model: 'claude-sonnet-5-5' });
            const o = await clOpen({ [CONV_A]: { phase: { idle: p0.payload, streaming: pS.payload, done: pD.payload } },
                                     [CONV_B]: { static: pb.payload, delay: 8000 } }, p0.truth);
            if (clOk('M14', o)) {
                await o.pg.evaluate('window.__mockVirtualization.partC.regenerate(' + (CL_ROWS - 1) + ',' + JSON.stringify(REGEN_TEXT) +
                                    ',3000,' + JSON.stringify(pD.truth[CL_ROWS - 1]) + ',"start",3)');
                const noticed = await waitFor(o.pg, async () => (await o.pg.evaluate(READ)).notices.length > 0, 30000);
                await o.pg.evaluate((u) => {
                    window.__acnNativePushState.call(history, {}, '', '/chat/' + u);
                    var n = document.createElement('div'); document.body.appendChild(n); n.remove();
                }, CONV_B);
                await o.pg.waitForTimeout(2500);
                const r = await o.pg.evaluate(READ);
                const loading = !indexReady(o.logs, 3);
                if (precondition('M14', noticed && loading, 'noticed=' + noticed + ' loading=' + loading + ' ' + short(r))) {
                    check('M14', 'guard', 'a switch to a conversation still loading shows none of the previous one\'s notices',
                        r.notices.length === 0, short(r));
                }
            }
            await o.context.close();
        }
        // Labels: Opus 3 and Haiku 4.5 (known, outside the table), and no model at all.
        {
            const res = {};
            for (const [k, model] of [['opus3', 'claude-opus-3'], ['haiku', 'claude-haiku-4-5-20251001'], ['none', undefined]]) {
                const p = clPayload(CONV_A, { model });
                const o = await clOpen({ [CONV_A]: { static: p.payload } }, p.truth);
                res[k] = clOk('M9-' + k, o) ? o.r : null;
                await o.context.close();
            }
            if (res.opus3 && res.haiku) {
                check('M9b', 'new', 'Opus 3 and Haiku 4.5 read a plain 200K, named, with no "assumed"',
                    res.opus3.label === 'Opus 3 · 200K window' && res.haiku.label === 'Haiku 4.5 · 200K window' &&
                    !/assumed/.test(res.opus3.meta + res.haiku.meta) && res.opus3.source === 'model' && res.haiku.source === 'model',
                    short(res.opus3) + ' | ' + short(res.haiku));
            }
            if (res.none) {
                check('M10', 'guard', 'no model: "limit assumed"', /limit assumed/.test(res.none.meta || '') && res.none.source === 'assumed' &&
                    (res.none.label === null || /^Model not identified/.test(res.none.label)), short(res.none));
            }
        }
        // The fallback alert: Sonnet 4.6 (500K) at >= 95% with no marker; the same size with a marker shows none.
        {
            const p = clPayload(CONV_A, { model: 'claude-sonnet-4-6', pad: 1900000, summaries: [40] });
            const o = await clOpen({ [CONV_A]: { static: p.payload } }, p.truth);
            if (clOk('M11b', o)) {
                check('M11b', 'guard', 'a chat as large but with a summary on its path: no fallback alert', !o.r.alert, short(o.r));
                check('M11c', 'new', 'the dots follow the context since the last summary (6%), not the whole history (100%): all green',
                    o.r.dots === 'G'.repeat(40) && o.r.pct === '6%', short(o.r));
            }
            await o.context.close();
        }
    }

    // ── ChatGPT ─────────────────────────────────────────────────────────────────────────────
    async function gptOpen(slugOf, store, opts) {
        opts = opts || {};
        const T = gptTurns(opts.pad);
        const url = 'https://chatgpt.com/c/' + GPT_CONV;
        const html = page('chatgpt-windowed.html', raw, { turns: T, bmModel: { h: 420, window: 6 } }, store);
        const api = (u) => {
            if (u.endsWith('/api/auth/session')) return { status: 200, body: JSON.stringify({ accessToken: 'tok', expires: '2099-01-01T00:00:00.000Z' }) };
            // Built at the request: a turn the probe adds is in the next fetch.
            if (u.indexOf('/backend-api/conversation/' + GPT_CONV) !== -1) return { status: 200, body: JSON.stringify(gptMapping(T, slugOf)), delay: opts.delayMs || 0 };
            return null;
        };
        const o = await open(url, html, api);
        o.T = T;
        if (opts.beforeReady) await opts.beforeReady(o);
        o.ready = await openNav(o.pg, GPT_N, opts.delayMs ? opts.delayMs + 20000 : 20000);
        await o.pg.waitForTimeout(1500);
        o.r = await readStable(o.pg);
        return o;
    }
    const plan = (p) => ({ 'acn-settings': { chatgptPlan: p } });
    if (want('chatgpt')) {
        {
            const o = await gptOpen(() => 'gpt-5-2', null);
            const tok = gptTokens(o.T);
            if (precondition('C1', o.ready && o.r.stable, short(o.r))) {
                check('C1', 'new', 'plan not set: tokens only, "window depends on your plan", the "Set your plan" control',
                    o.r.pct === '' && (o.r.meta || '').indexOf('tokens (est.) · window depends on your plan') !== -1 &&
                    near(o.r.tokens, tok, 1) && o.r.plan === 'Set your plan' && !o.r.label, 'tok=' + tok + ' ' + short(o.r));
            }
            await o.context.close();
        }
        {
            const oi = await gptOpen(() => 'gpt-5-2', plan('plus'));
            const tok = gptTokens(oi.T);
            const ot = await gptOpen((i) => (i === GPT_N - 1 ? 'gpt-5-4-thinking' : 'gpt-5-2'), plan('plus'));
            if (precondition('C2', oi.ready && ot.ready && oi.r.stable && ot.r.stable, short(oi.r) + ' | ' + short(ot.r))) {
                check('C2', 'new', 'Plus + Instant: 54K and its percentage; Plus + Thinking (the latest answer): 256K',
                    oi.r.limit === '54000' && oi.r.pct === pctOf(tok, 54000) + '%' && oi.r.label === 'Instant · 54K window (Plus)' &&
                    ot.r.limit === '256000' && ot.r.pct === pctOf(tok, 256000) + '%' && ot.r.label === 'Thinking · 256K window (Plus)' &&
                    oi.r.plan === 'Plus · change', 'tok=' + tok + ' ' + short(oi.r) + ' | ' + short(ot.r));
            }
            // C3: the setting changes to Pro on this page.
            await oi.pg.evaluate("(function () { var d = document.getElementById('acn-dot-settings'); if (d) d.click(); }())");
            await oi.pg.waitForTimeout(600);
            const changed = await oi.pg.evaluate("(function () { var s = document.getElementById('acn-gptplan-sel'); if (!s) return false;" +
                " s.value = 'pro'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }())");
            await oi.pg.waitForTimeout(800);
            await openNav(oi.pg, GPT_N);
            const r3 = await readStable(oi.pg);
            const want3 = 'Plan changed: Plus → Pro. Window 54K → 128K, so ' + pctOf(tok, 54000) + '% → ' + pctOf(tok, 128000) + '%.';
            check('C3', 'new', 'changing the setting to Pro: 128K, and the notice "' + want3 + '"',
                changed && r3.limit === '128000' && r3.pct === pctOf(tok, 128000) + '%' &&
                r3.notices.some((n) => n.kind === 'window' && n.text.indexOf(want3) === 0), 'changed=' + changed + ' ' + short(r3));
            await oi.context.close();
            await ot.context.close();
        }
        {
            const ou = await gptOpen(() => 'gpt-9-preview', plan('plus'));
            const of = await gptOpen(() => 'gpt-5-4-thinking', plan('free'));
            if (precondition('C4', ou.ready && of.ready && ou.r.stable && of.r.stable, short(ou.r) + ' | ' + short(of.r))) {
                check('C4', 'new', 'an unknown slug, and Free + Thinking ("Varies"): no percentage',
                    ou.r.pct === '' && of.r.pct === '' && /window depends on your plan/.test(ou.r.meta) && /window depends on your plan/.test(of.r.meta) &&
                    ou.r.plan === 'Plus · change' && of.r.plan === 'Free · change', short(ou.r) + ' | ' + short(of.r));
            }
            await ou.context.close();
            await of.context.close();
        }
        // C5: Plus, all Instant; then a new answer in Thinking, with Navigate closed.
        {
            const o = await gptOpen((i) => (i >= GPT_N ? 'gpt-5-4-thinking' : 'gpt-5-2'), plan('plus'));
            if (precondition('C5', o.ready && o.r.stable && o.r.limit === '54000', short(o.r))) {
                await o.pg.evaluate("document.getElementById('acn-dot-nav').click()");
                await o.pg.waitForTimeout(600);
                const t = gptTurn(GPT_N);
                o.T.push(t);
                await o.pg.evaluate((x) => window.__mockWindow.addTurn(x), t);
                await o.pg.evaluate("window.__mockWindow.userScrollTo('bottom')");
                const got = await waitFor(o.pg, async () => o.logs.filter((l) => /\[ACN\] index out of sync with DOM/.test(l)).length > 0, 40000);
                await o.pg.waitForTimeout(4000);
                await openNav(o.pg, GPT_N + 1, 30000);
                const r = await readStable(o.pg);
                const tok = gptTokens(o.T);
                const want5 = 'Mode changed: Instant → Thinking. Window 54K → 256K, so ' + pctOf(tok, 54000) + '% → ' + pctOf(tok, 256000) + '%.';
                check('C5', 'new', 'a new answer in Thinking, with Navigate closed: "' + want5 + '" and 256K',
                    got && r.limit === '256000' && r.notices.some((n) => n.kind === 'window' && n.text.indexOf(want5) === 0),
                    'refetched=' + got + ' ' + short(r));
            }
            await o.context.close();
        }
        // C6: Free (27K Instant) at about 98%.
        {
            const o = await gptOpen(() => 'gpt-5-2', plan('free'), { pad: 4300 });
            const tok = gptTokens(o.T), p = pctOf(tok, 27000);
            let want = '';
            for (let i = 0; i < GPT_N; i++) { const sh = (p / 100) * (i + 1) / GPT_N; want += sh < 0.70 ? 'G' : sh < 0.85 ? 'Y' : 'R'; }
            if (precondition('C6', o.ready && o.r.stable, short(o.r))) {
                check('C6', 'new', 'Free (27K) at ' + p + '%: the fallback alert, and dots that follow the meter (' + want + ')',
                    p >= 95 && o.r.pct === p + '%' && o.r.alert === 'This chat has likely passed its context window. ChatGPT may drop or summarize earlier messages.' &&
                    o.r.dots === want && /Y/.test(want) && /R/.test(want), 'tok=' + tok + ' ' + short(o.r));
            }
            // C7: the meter's plan control opens the settings, the select focused.
            await o.pg.evaluate("(function () { var c = document.querySelector('[data-acn-role=\"gpt-plan-control\"]'); if (c) c.click(); }())");
            await o.pg.waitForTimeout(800);
            const st = await o.pg.evaluate("({ open: (document.getElementById('acn-panel-settings') || { getAttribute: function () {} }).getAttribute('data-acn-open'), focus: document.activeElement && document.activeElement.id })");
            check('C7', 'new', 'the plan control opens the settings panel, the plan select focused',
                st.open === 'true' && st.focus === 'acn-gptplan-sel', JSON.stringify(st));
            await o.context.close();
        }
        // C8: the plan changes from Plus to Pro while the index is still loading (it answers 6 s late).
        {
            let changed = null;
            const o = await gptOpen(() => 'gpt-5-2', plan('plus'), { delayMs: 6000, beforeReady: async (x) => {
                await x.pg.waitForTimeout(1500);
                changed = await x.pg.evaluate("(function () { var s = document.getElementById('acn-gptplan-sel'); if (!s) return false;" +
                    " s.value = 'pro'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }())");
            } });
            const tok = gptTokens(o.T);
            const want8 = 'Plan changed: Plus → Pro. Window 54K → 128K, so ' + pctOf(tok, 54000) + '% → ' + pctOf(tok, 128000) + '%.';
            if (precondition('C8', o.ready && o.r.stable && changed, 'changed=' + changed + ' ' + short(o.r))) {
                check('C8', 'new', 'the plan changed while the index loads: "' + want8 + '" once it is ready',
                    o.r.limit === '128000' && o.r.notices.some((n) => n.kind === 'window' && n.text.indexOf(want8) === 0), short(o.r));
            }
            await o.context.close();
        }
    }

    // ── Perplexity ──────────────────────────────────────────────────────────────────────────
    async function pplxOpen(big, fail) {
        const E = pplxEntries(big);
        const url = 'https://www.perplexity.ai/search/' + PPLX_CONV;
        const html = page('perplexity-windowed.html', raw, { entries: E.map((e) => ({ text: e.query_str, answer: e.short })),
                                                               bmModel: { q: 100, a: 500, around: 1 } }, null);
        const api = (u) => u.indexOf('/rest/thread/' + PPLX_CONV) !== -1
            ? (fail ? { status: 500, body: '{}' } : { status: 200, body: JSON.stringify(pplxPage(E, u)) }) : null;
        const o = await open(url, html, api);
        o.ready = await openNav(o.pg, PPLX_N);
        await o.pg.waitForTimeout(1500);
        o.r = await readStable(o.pg);
        return o;
    }
    if (want('perplexity')) {
        const os = await pplxOpen(null);
        // Answers 4 and 5 about 300K tokens each, 6 and 7 about 150K: 300K, 600K (green), 750K (yellow),
        // 900K (red) from Q#7 on.
        const ob = await pplxOpen({ 4: 1200000, 5: 1200000, 6: 600000, 7: 600000 });
        if (precondition('S-pplx', os.ready && ob.ready && os.r.stable && ob.r.stable, short(os.r) + ' | ' + short(ob.r))) {
            check('S1', 'new', 'Perplexity: no percentage, "window not published"',
                os.r.pct === '' && /^~[0-9.]+K tokens \(est\.\) · window not published$/.test(os.r.meta || ''), short(os.r));
            check('S2', 'guard', 'Perplexity, short questions only: every dot green', os.r.dots === 'G'.repeat(PPLX_N), short(os.r));
            check('S3', 'new', 'Perplexity, four huge answers: green to Q#5 (600K), yellow at Q#6 (750K), red from Q#7 (900K)',
                ob.r.dots === 'GGGGGYRRRRRR', short(ob.r));
            check('S4', 'new', 'Perplexity: the caption names Perplexity, and no other site',
                (ob.r.caption || '').indexOf('Estimated size (1M scale). Perplexity may summarize older messages') === 0 &&
                (ob.r.caption.match(/Perplexity/g) || []).length === 2 && !/Gemini|Claude|ChatGPT|Grok/.test(ob.r.caption), short(ob.r));
        }
        await os.context.close();
        await ob.context.close();
        // S7: the thread request fails; the DOM's questions are all there is.
        const of = await pplxOpen(null, true);
        await of.pg.waitForTimeout(2500);
        const rf = await readStable(of.pg);
        check('S7', 'new', 'Perplexity whose index fails: the estimate says it counts the questions only; dots positional',
            /window not published/.test(rf.meta || '') && rf.hist === 'The full history is not loaded: the estimate counts the questions only' &&
            rf.dotBasis === 'position', short(rf) + ' basis=' + rf.dotBasis);
        await of.context.close();
    }

    // ── Gemini ──────────────────────────────────────────────────────────────────────────────
    if (want('gemini')) {
        const url = 'https://gemini.google.com/app/' + GM_CHAT;
        // The loaded page is turns 23–32; answers 30 and 31 about 450K tokens each.
        const html = page('gemini-history.html', raw, { chats: { [GM_CHAT]: 32 }, page: 10, loadDelayMs: 300,
                                                        bigAnswers: { 30: 1800000, 31: 1800000 } }, null);
        const o = await open(url, html, null);
        await o.pg.waitForFunction(() => window.__mockGemini && window.__mockGemini.loaded() === 10, null, { timeout: 20000 });
        await o.pg.waitForTimeout(1500);
        const listed = await openNav(o.pg, 10);
        await o.pg.waitForTimeout(1200);
        const r = await readStable(o.pg);
        if (precondition('S-gemini', listed && r.stable, short(r))) {
            check('S1g', 'new', 'Gemini: no percentage, "window not published"',
                r.pct === '' && /tokens \(est\.\) · window not published$/.test(r.meta || ''), short(r));
            check('S3g', 'new', 'Gemini, two huge answers: green to Q#30 (about 450K), red from Q#31 (about 900K)',
                r.dots === 'GGGGGGGGRR', short(r));
            check('S4g', 'new', 'Gemini: the caption names Gemini, and no other site',
                (r.caption || '').indexOf('Estimated size (1M scale). Gemini may summarize older messages') === 0 &&
                (r.caption.match(/Gemini/g) || []).length === 2 && !/Perplexity|Claude|ChatGPT|Grok/.test(r.caption), short(r));
            check('S5', 'new', 'Gemini: the partial-history line beside the estimate (10 of 32 loaded)',
                /^↑ Older messages are not loaded yet/.test(r.hist || ''), short(r));
            // S6: 400,000 more characters in the last answer, as an answer finishing would add.
            const t0 = Number(r.tokens);
            await o.pg.evaluate(() => {
                var turns = document.querySelectorAll('div.conversation-container');
                var a = turns[turns.length - 1].querySelector('.model-response-text');
                var para = document.createElement('p');
                para.textContent = new Array(40001).join('more data!');
                a.appendChild(para);
            });
            await o.pg.waitForTimeout(2500);
            const r6 = await readStable(o.pg);
            check('S6', 'new', 'Gemini: the last answer grows by 400K characters, no new question: the estimate grows by about 100K tokens',
                Number(r6.tokens) - t0 >= 99000 && Number(r6.tokens) - t0 <= 101000, 'before=' + t0 + ' after=' + r6.tokens);
        }
        await o.context.close();
    }

    check('E', 'guard', 'no page errors', pageErrors.length === 0, pageErrors.slice(0, 4).join(' | '));
    await browser.close();
    console.log('check-context-meter — ' + engine + ': ' + (failures ? failures + ' FAIL' : 'all pass') +
                (invalid ? ', ' + invalid + ' INVALID' : ''));
    process.exit(failures || invalid ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
