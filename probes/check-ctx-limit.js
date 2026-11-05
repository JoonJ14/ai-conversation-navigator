// Checks for Claude's context-meter limit (v12.16 part B, DEC-056): the meter's window comes
// from the conversation's model (the conversation JSON's top-level `model`), not a fixed 200K.
//
// Run: node probes/check-ctx-limit.js [--browser chromium|firefox|webkit|all] [--quiet]
// ACN_SCRIPT=<path> runs another build (the pre-fix build, or a mutant). Exits non-zero on any
// failed check, and on any INVALID one (a precondition of the fixture or harness did not hold,
// so the check could not say anything about the build).
//
// THE BUG THIS GATES. orbUpdateContextBar() divided Claude's estimated tokens by CTX_LIMITS.claude
// (200000) whatever the model, so a 1M-window conversation read five times too full. Now
// ciBuildIndex keeps the payload's `model` (_ciModel, set at its commit point, cleared by
// ciInvalidate and a failed load), orbClaudeCtxLimit() maps it through CLAUDE_CTX_BY_MODEL (a
// trailing -YYYYMMDD is ignored) and falls back to 200K with known=false, and orbStampCtxLimit()
// publishes data-acn-ctx-limit / -limit-source / -model on #acn-ctx-pct and logs one
// "[ACN] context limit: ..." line per change.
//
// Five conversations with byte-identical messages, differing only in the top-level `model`:
//   A  'claude-haiku-4-5-20251001'  not in the table   -> 200K, model (v12.18; v12.16: assumed)
//   B  'claude-opus-5'                                  -> 1M,   model
//   C  'claude-opus-4-8'                                -> 500K, model
//   D  (no model field)                                 -> 200K, assumed
//   E  'claude-sonnet-4-6-20260101' (a dated table key) -> 500K, model
// A long first (unrendered) assistant message puts the estimate near 80K tokens, so the three
// limits give visibly different percentages.
//
//   L1 [new]  B: 1000000 / model / claude-opus-5, meta "/ 1M tokens (est.)", no "limit assumed",
//             and the percentage is the meta's tokens over 1M (+-1)
//   L2 [new]  C: 500000 / model, meta "/ 500K tokens (est.)", same tokens as B, pct about 2x B's
//   L3 [new]  D: 200000 / assumed / '', meta "(est., limit assumed)"
//   L4 [new]  A: 200000 / model, no "limit assumed": the help center's "Outside of these models,
//             Claude's context window size is 200K" (v12.18, the owner's spec: "assumed" only for
//             an unidentified model). v12.16–12.17 read it as 200000 / assumed, the rule this replaced
//   L5 [new]  E: the dated id resolves to 500000 / model
//   L6 [new]  B, then a switch to D in the same page with Navigate open (History.prototype.pushState,
//             as check-turn-counter's A2): the bar returns to 200000 / assumed, not B's 1M
//   L7 [guard] no meta text ever drawn (a MutationObserver records every one) reads "1000K"
//   L8 [new]  B's page logs "[ACN] context limit: model=claude-opus-5 limit=1000000 source=model"
//             exactly once, across at least two later redraws (the SSE draws of L9) — so the
//             dedupe is exercised, not just a single draw counted
//   L9 [new]  Path A (a real SSE message_delta + message_stop through the fetch proxy) on B:
//             meta "/ 1M tokens (hybrid)", attributes still 1000000 / model
//   L10 [new] Path A on D: meta "(hybrid, limit assumed)", 200000 / assumed
//   E  no page errors on any page
// Preconditions (INVALID, not FAIL): the index loaded ("conversation index ready" logged),
// Navigate lists the 8 questions, document.visibilityState is visible, #acn-ctx-pct exists, and
// the read was stable (two identical reads 700 ms apart).
//
// CONTEXT of these results: Playwright <engine>, page realm, headless, this machine, the
// virtualizing Claude mock with a stubbed GM_xmlhttpRequest. The REAL shipped functions are
// reached by driving the UI; the assertions read the DOM the user sees. Not a userscript
// manager, and not claude.ai's real payloads: whether claude.ai's conversation JSON carries
// `model` in this form, under each manager, is the owner's live acceptance (DEC-031).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const ORG = '99999999-9999-4999-8999-999999999999';
const Q = 8;                     // questions per conversation (the mock renders the same 8)
const PAD = 200000;              // characters in the first, unrendered assistant message
const CONVS = {
    A: { uuid: 'aaaaaaaa-0000-4000-8000-00000000000a', model: 'claude-haiku-4-5-20251001' },
    B: { uuid: 'bbbbbbbb-0000-4000-8000-00000000000b', model: 'claude-opus-5' },
    C: { uuid: 'cccccccc-0000-4000-8000-00000000000c', model: 'claude-opus-4-8' },
    D: { uuid: 'dddddddd-0000-4000-8000-00000000000d', model: undefined },
    E: { uuid: 'eeeeeeee-0000-4000-8000-00000000000e', model: 'claude-sonnet-4-6-20260101' },
};
const B_LINE = '[ACN] context limit: model=claude-opus-5 limit=1000000 source=model';

// The turn-counter probe's fixture shape (texts byte-identical to claude-virtualized.html's rows),
// with a padded first assistant message. Message uuids are derived from the conversation's, so the
// conversations differ only in their uuids and the top-level `model`.
function buildConversation(uuid, model) {
    const messages = [];
    let seq = 0;
    const uuidFor = (i) => uuid.slice(0, 24) + String(i).padStart(12, '0');
    const push = (m) => {
        m.uuid = uuidFor(seq);
        m.parent_message_uuid = seq === 0 ? '00000000-0000-4000-8000-000000000000' : uuidFor(seq - 1);
        m.index = seq; m.created_at = '2026-07-01T00:00:00Z'; m.text = '';
        m.attachments = []; m.files = [];
        messages.push(m); seq++;
    };
    const pad = 'Conversation started. ' + 'lorem ipsum dolor sit amet '.repeat(Math.ceil(PAD / 27)).slice(0, PAD);
    push({ sender: 'assistant', content: [{ type: 'text', text: pad }] });
    for (let turn = 1; turn <= Q; turn++) {
        push({ sender: 'human', content: [{ type: 'text', text:
            'Question number ' + turn + ': how do I handle case ' + turn + ' when the input is unusual?' +
            ' VISIBLE-NOT-SR-ONLY' }] });
        push({ sender: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text:
            'Answer number ' + turn + ': validate the input first, then branch on the result.' }] });
    }
    const conv = { uuid, name: 'Context limit checks', current_leaf_message_uuid: uuidFor(seq - 1),
                   chat_messages: messages };
    if (model !== undefined) conv.model = model;
    return conv;
}

function buildPage(scriptContent) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const convs = {};
    Object.keys(CONVS).forEach((k) => { convs[CONVS[k].uuid] = buildConversation(CONVS[k].uuid, CONVS[k].model); });
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>context limit checks</title></head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify({ totalMessages: Q * 2 })};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var CONVS = ${JSON.stringify(convs)};
    window.__acnConvAnswered = {};
    window.__acnNativePushState = History.prototype.pushState;
    // Every meta text drawn, and how many draws: each draw assigns textContent, a childList
    // mutation on #acn-ctx-meta even when the text is unchanged.
    window.__acnMetaSeen = [];
    window.__acnMetaDraws = 0;
    new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
            var t = recs[i].target;
            var el = t && (t.nodeType === 1 ? t : t.parentNode);
            if (el && el.id === 'acn-ctx-meta') {
                window.__acnMetaDraws++;
                var s = el.textContent;
                if (window.__acnMetaSeen.indexOf(s) === -1) window.__acnMetaSeen.push(s);
            }
        }
    }).observe(document, { childList: true, subtree: true, characterData: true });
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body, ms) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, ms || 10);
        }
        if (/\\/usage$/.test(url)) { respond(500, ''); return; }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ${JSON.stringify(ORG)}, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        var m = url.match(/chat_conversations\\/([0-9a-f-]+)/i);
        if (m && CONVS[m[1]]) {
            var cid = m[1];
            setTimeout(function () {
                window.__acnConvAnswered[cid] = true;
                if (opts.onload) opts.onload({ status: 200, responseText: JSON.stringify(CONVS[cid]) });
            }, 10);
            return;
        }
        respond(404, '');
    };
    var _s = {};
    window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
    window.GM_setValue = function (k, v) { _s[k] = v; };
    try { document.cookie = 'lastActiveOrg=' + ${JSON.stringify(ORG)} + '; path=/'; } catch (e) {}
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

const READ = `(function () {
    var pct = document.getElementById('acn-ctx-pct');
    var meta = document.getElementById('acn-ctx-meta');
    var stat = document.getElementById('acn-nav-stat');
    var panel = document.getElementById('acn-panel-nav');
    return {
        present: !!pct,
        limit: pct ? pct.getAttribute('data-acn-ctx-limit') : null,
        source: pct ? pct.getAttribute('data-acn-ctx-limit-source') : null,
        model: pct ? pct.getAttribute('data-acn-ctx-model') : null,
        pct: pct ? pct.textContent : null,
        meta: meta ? meta.textContent : null,
        count: stat ? stat.getAttribute('data-acn-count') : null,
        open: !!(panel && panel.getAttribute('data-acn-open') === 'true'),
        vis: document.visibilityState
    };
}())`;

const same = (a, b) => !!a && !!b && ['present', 'limit', 'source', 'model', 'pct', 'meta', 'count', 'open']
    .every((k) => a[k] === b[k]);

async function readStable(page, timeoutMs, gapMs) {
    const deadline = Date.now() + timeoutMs;
    let prev = null, cur = null;
    while (Date.now() < deadline) {
        cur = await page.evaluate(READ);
        if (same(prev, cur)) { cur.stable = true; return cur; }
        prev = cur;
        await page.waitForTimeout(gapMs);
    }
    if (cur) cur.stable = false;
    return cur || { stable: false };
}

async function openNavigate(page) {
    await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
    await page.evaluate("document.getElementById('acn-dot-nav').click()");
    await page.waitForFunction("(document.getElementById('acn-panel-nav') || {getAttribute: function () {}})" +
                               ".getAttribute('data-acn-open') === 'true'", null, { timeout: 10000 });
}

async function waitForCount(page, n, timeoutMs) {
    try {
        await page.waitForFunction("(document.getElementById('acn-nav-stat') || {getAttribute: function () {}})" +
                                   ".getAttribute('data-acn-count') === '" + n + "'", null, { timeout: timeoutMs });
        return true;
    } catch (e) { return false; }
}

// "~81.2K / 1M tokens (est.)" -> { tokens: 81200, lim: 1000000 }; "~81,234 / 1M tokens (hybrid)" too.
function parseMeta(meta) {
    const m = /~([0-9.,]+)(K?) \/ ([0-9.]+)([KM]) tokens/.exec(meta || '');
    if (!m) return null;
    const tokens = parseFloat(m[1].replace(/,/g, '')) * (m[2] === 'K' ? 1000 : 1);
    const lim = parseFloat(m[3]) * (m[4] === 'M' ? 1000000 : 1000);
    return { tokens, lim };
}
const pctNum = (r) => (r && /^[0-9]+%$/.test(r.pct || '')) ? parseInt(r.pct, 10) : NaN;
// The drawn percentage agrees with the meta's tokens over `limit`, within 1 (the meta's tokens
// are rounded to 0.1K in Path B).
function pctAgrees(r, limit) {
    const p = parseMeta(r && r.meta);
    if (!p) return false;
    return Math.abs(pctNum(r) - Math.min(100, Math.round(p.tokens / limit * 100))) <= 1;
}

const fmt = (r) => r ? ('limit=' + r.limit + ' source=' + r.source + ' model=' + JSON.stringify(r.model) +
                        ' pct=' + r.pct + ' meta=' + JSON.stringify(r.meta) + ' count=' + r.count +
                        ' stable=' + r.stable + ' vis=' + r.vis) : 'no read';

async function runEngine(engine, raw, quiet) {
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    const html = buildPage(raw);
    let failures = 0, invalid = 0;
    const pageErrors = [];
    const metaSeenAll = [];

    function check(id, desc, ok, detail) {
        if (ok) { if (!quiet) console.log('  PASS  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
        else { failures++; console.log('  FAIL  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
    }
    function invalidCheck(id, why) { invalid++; console.log('  INVALID  ' + id + ' — ' + why); }

    async function load(key) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const logs = [];
        page.on('console', (m) => logs.push(m.text()));
        page.on('pageerror', (e) => pageErrors.push(key + ': ' + String(e && e.message || e)));
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u.indexOf('/completion') !== -1) {
                route.fulfill({ status: 200, contentType: 'text/event-stream', body:
                    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n' +
                    'event: message_stop\ndata: {"type":"message_stop"}\n\n' });
            } else if (/^https:\/\/claude\.ai\/chat\//.test(u)) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto('https://claude.ai/chat/' + CONVS[key].uuid, { waitUntil: 'domcontentloaded', timeout: 120000 });
        return { context, page, logs };
    }
    const readyLines = (logs) => logs.filter((l) => l.indexOf('[ACN] conversation index ready:') === 0).length;
    async function waitReady(page, logs, n, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (readyLines(logs) >= n) return true;
            await page.waitForTimeout(100);
        }
        return false;
    }
    // Load, wait for the index, open Navigate, read.
    async function loadAndRead(key) {
        const s = await load(key);
        const ready = await waitReady(s.page, s.logs, 1, 30000);
        await s.page.waitForTimeout(800);
        await openNavigate(s.page);
        const listed = await waitForCount(s.page, Q, 15000);
        await s.page.waitForTimeout(800);
        const r = await readStable(s.page, 10000, 700);
        r.ready = ready; r.listed = listed;
        return Object.assign(s, { r });
    }
    function precondition(id, r) {
        const bad = [];
        if (!r.ready) bad.push('index never logged ready');
        if (!r.listed || r.count !== String(Q)) bad.push('Navigate lists ' + r.count + ', not ' + Q);
        if (r.vis !== 'visible') bad.push('visibilityState=' + r.vis);
        if (!r.present) bad.push('#acn-ctx-pct missing');
        if (r.stable !== true) bad.push('read not stable');
        if (bad.length) { invalidCheck(id, bad.join('; ') + ' | ' + fmt(r)); return false; }
        return true;
    }
    async function sse(page, key) {
        for (let i = 0; i < 2; i++) {
            await page.evaluate((u) => fetch('https://claude.ai/api/organizations/' + u.org +
                '/chat_conversations/' + u.conv + '/completion', { method: 'POST' }).then((r) => r.text()),
                { org: ORG, conv: CONVS[key].uuid });
            await page.waitForTimeout(400);
        }
        await page.waitForTimeout(1200);
        return readStable(page, 10000, 700);
    }
    async function finish(s) {
        const seen = await s.page.evaluate('window.__acnMetaSeen').catch(() => []);
        (seen || []).forEach((t) => { if (metaSeenAll.indexOf(t) === -1) metaSeenAll.push(t); });
        await s.context.close();
    }

    console.log('check-ctx-limit — engine=' + engine + ', script=' + path.basename(process.env.ACN_SCRIPT || 'ai-conversation-navigator.user.js'));

    // B (L1, then Path A for L9 and the dedupe count of L8)
    const b = await loadAndRead('B');
    const bOk = precondition('L1', b.r);
    if (bOk) {
        check('L1', 'B (claude-opus-5): 1M from the model, meta "/ 1M tokens (est.)"',
            b.r.limit === '1000000' && b.r.source === 'model' && b.r.model === 'claude-opus-5' &&
            (b.r.meta || '').indexOf('/ 1M tokens (est.)') !== -1 && (b.r.meta || '').indexOf('limit assumed') === -1 &&
            pctAgrees(b.r, 1000000), fmt(b.r));
    }
    const drawsBefore = await b.page.evaluate('window.__acnMetaDraws');
    const bLinesBeforeSse = b.logs.filter((l) => l === B_LINE).length;
    const bA = await sse(b.page, 'B');
    const drawsAfter = await b.page.evaluate('window.__acnMetaDraws');
    const sseDraws = drawsAfter - drawsBefore;
    const pathA_B = bA.stable === true && /\((hybrid|last known)/.test(bA.meta || '');
    if (!bOk || !pathA_B) invalidCheck('L9', 'Path A never drawn (no SSE draw reached the bar) | ' + fmt(bA));
    else {
        check('L9', 'Path A on B: meta "/ 1M tokens (hybrid)", still 1000000 / model',
            bA.limit === '1000000' && bA.source === 'model' && bA.model === 'claude-opus-5' &&
            (bA.meta || '').indexOf('/ 1M tokens (hybrid)') !== -1 && pctAgrees(bA, 1000000), fmt(bA));
    }
    const bLines = b.logs.filter((l) => l === B_LINE).length;
    const allLimitLines = b.logs.filter((l) => l.indexOf('[ACN] context limit:') === 0);
    if (!bOk || sseDraws < 2) invalidCheck('L8', 'fewer than 2 redraws after the first read (' + sseDraws + '): the dedupe is not exercised');
    else {
        check('L8', 'B\'s "context limit" line is logged exactly once across ' + sseDraws + ' later redraws',
            bLines === 1, 'B lines=' + bLines + ' (before the SSE: ' + bLinesBeforeSse + ') all limit lines=' +
            JSON.stringify(allLimitLines));
    }
    await finish(b);

    // C (L2)
    const c = await loadAndRead('C');
    if (precondition('L2', c.r) && bOk) {
        const pb = parseMeta(b.r.meta), pc = parseMeta(c.r.meta);
        check('L2', 'C (claude-opus-4-8): 500K from the model, same tokens as B, pct about 2x B\'s',
            c.r.limit === '500000' && c.r.source === 'model' && c.r.model === 'claude-opus-4-8' &&
            (c.r.meta || '').indexOf('/ 500K tokens (est.)') !== -1 && (c.r.meta || '').indexOf('limit assumed') === -1 &&
            !!pb && !!pc && pb.tokens === pc.tokens && pctAgrees(c.r, 500000) &&
            Math.abs(pctNum(c.r) - 2 * pctNum(b.r)) <= 2,
            fmt(c.r) + ' | B pct=' + b.r.pct);
    }
    await finish(c);

    // D (L3, then Path A for L10)
    const d = await loadAndRead('D');
    const dOk = precondition('L3', d.r);
    if (dOk) {
        check('L3', 'D (no model): 200K, assumed, meta "(est., limit assumed)"',
            d.r.limit === '200000' && d.r.source === 'assumed' && d.r.model === '' &&
            (d.r.meta || '').indexOf('/ 200K tokens (est., limit assumed)') !== -1 && pctAgrees(d.r, 200000), fmt(d.r));
    }
    const dA = await sse(d.page, 'D');
    if (!dOk || !(dA.stable === true && /\((hybrid|last known)/.test(dA.meta || ''))) {
        invalidCheck('L10', 'Path A never drawn on D | ' + fmt(dA));
    } else {
        check('L10', 'Path A on D: meta "(hybrid, limit assumed)", 200000 / assumed',
            dA.limit === '200000' && dA.source === 'assumed' &&
            (dA.meta || '').indexOf('/ 200K tokens (hybrid, limit assumed)') !== -1 && pctAgrees(dA, 200000), fmt(dA));
    }
    await finish(d);

    // A (L4)
    const a = await loadAndRead('A');
    if (precondition('L4', a.r)) {
        check('L4', 'A (claude-haiku-4-5-20251001, not in the table): a plain 200K, from the model, no "limit assumed"',
            a.r.limit === '200000' && a.r.source === 'model' && a.r.model === 'claude-haiku-4-5-20251001' &&
            (a.r.meta || '').indexOf('/ 200K tokens (est.)') !== -1 && (a.r.meta || '').indexOf('limit assumed') === -1 &&
            pctAgrees(a.r, 200000), fmt(a.r));
    }
    await finish(a);

    // E (L5)
    const e = await loadAndRead('E');
    if (precondition('L5', e.r)) {
        check('L5', 'E (claude-sonnet-4-6-20260101): the dated id resolves to 500K, model',
            e.r.limit === '500000' && e.r.source === 'model' && e.r.model === 'claude-sonnet-4-6-20260101' &&
            (e.r.meta || '').indexOf('/ 500K tokens (est.)') !== -1 && (e.r.meta || '').indexOf('limit assumed') === -1 &&
            pctAgrees(e.r, 500000), fmt(e.r));
    }
    await finish(e);

    // L6: B, then a switch to D with Navigate open. No hook can see the switch (the prototype's
    // pushState); one throwaway node makes the message observer schedule a scan.
    {
        const s = await loadAndRead('B');
        if (precondition('L6', s.r)) {
            await s.page.evaluate((u) => {
                window.__acnNativePushState.call(history, {}, '', '/chat/' + u);
                var n = document.createElement('div');
                document.body.appendChild(n);
                n.remove();
            }, CONVS.D.uuid);
            const ready2 = await waitReady(s.page, s.logs, 2, 30000);
            const answered = await s.page.evaluate('!!window.__acnConvAnswered[' + JSON.stringify(CONVS.D.uuid) + ']');
            await s.page.waitForTimeout(1500);
            const after = await readStable(s.page, 10000, 700);
            after.ready = ready2 && answered; after.listed = after.count === String(Q);
            if (precondition('L6', after)) {
                check('L6', 'switch B -> D with Navigate open: the bar returns to 200000 / assumed',
                    s.r.limit === '1000000' && after.open === true && after.limit === '200000' &&
                    after.source === 'assumed' && after.model === '' &&
                    (after.meta || '').indexOf('/ 200K tokens (est., limit assumed)') !== -1 && pctAgrees(after, 200000),
                    'before: ' + fmt(s.r) + ' | after: ' + fmt(after));
            }
        }
        await finish(s);
    }

    check('L7', 'no meta text ever drawn reads "1000K"', !metaSeenAll.some((t) => /1000K/.test(t)),
        metaSeenAll.length + ' distinct meta texts seen: ' + JSON.stringify(metaSeenAll.slice(0, 12)));
    check('E', 'no page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

    await browser.close();
    return { failures, invalid };
}

(async () => {
    const arg = process.argv.indexOf('--browser') !== -1 ? process.argv[process.argv.indexOf('--browser') + 1] : 'chromium';
    const engines = arg === 'all' ? ['chromium', 'firefox', 'webkit'] : [arg];
    if (engines.some((e) => ['chromium', 'firefox', 'webkit'].indexOf(e) === -1)) {
        console.log('INVALID: --browser takes chromium, firefox, webkit or all');
        process.exit(1);
    }
    const quiet = process.argv.includes('--quiet');
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8');
    let failures = 0, invalid = 0;
    for (const engine of engines) {
        const r = await runEngine(engine, raw, quiet);
        failures += r.failures; invalid += r.invalid;
    }
    const parts = [];
    if (failures) parts.push(failures + ' check(s) FAILED');
    if (invalid) parts.push(invalid + ' check(s) INVALID');
    console.log(parts.length ? '\n' + parts.join(', ') : '\nall checks passed');
    process.exit(failures || invalid ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
