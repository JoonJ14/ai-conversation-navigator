// Checks for the Claude conversation index's TRANSPORT LADDER (v12.9). Added 2026-10-22
// for the Safari + Userscripts failure: on that runtime the index ALWAYS degraded to the
// DOM scan (1–5 mounted turns of a long conversation), because Userscripts'
// GM_xmlhttpRequest does not carry the claude.ai session — 403 from every org candidate —
// while a plain fetch from the same content-script world gets 200 for the right org.
//
// Run: node probes/check-transport-ladder.js [--browser chromium|firefox|webkit] [--quiet]
//      ACN_SCRIPT=/path/to/other.user.js node probes/check-transport-ladder.js
// Exits non-zero on any failed expectation.
//
// WHY THIS IS A PROBE AND NOT A PLAYWRIGHT SUITE CASE: the behaviour under test is a
// TRANSPORT state — which transport was asked, in what order, what it answered, and how
// the failure was classified. No mock page can express "GM_xmlhttpRequest is rejected but
// fetch is not". This probe controls both transports directly.
//
// HOW THE TWO TRANSPORTS ARE MODELLED
//   gmxhr — a page-side GM_xmlhttpRequest shim with REAL manager semantics: an HTTP error
//           arrives through onload WITH its status and a JSON error body (the suite's shared
//           shim routes every non-200 to onerror, which no real manager does for a 403).
//           It records the options of every call, so the v12.8 request shape can be
//           compared field by field.
//   fetch — the page's own fetch, answered by page.route and recorded on the Node side.
//
// CONTEXT of these results (record it with the finding): Playwright, page realm. The
// userscript is inlined into the page, so neither transport here is a real userscript
// manager's. This proves the LADDER's decisions — order, fallback trigger, caching,
// classification, diagnostics — and nothing about which real transport carries
// credentials. That part is the owner's live acceptance check on Safari + Userscripts,
// Firefox + Tampermonkey and Chrome + Tampermonkey.
//
// RESULTS (v12.9 against v12.8) and the MUTATION MATRIX (which checks catch the removal of each
// mechanism) are kept in ONE place: reviews/review-2026-10-22-safari-transport.md.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

// Org prefixes mirror the two orgs of the Safari measurement (730fcd2a… held the
// conversation; 8db273c9… answered 403 permission_error, as it should).
const ORG_RIGHT = '730fcd2a-0000-4000-8000-00000000a001';
const ORG_WRONG = '8db273c9-0000-4000-8000-00000000b002';
const CONV      = 'cafe0000-0000-4000-8000-000000000001';
const CONV_2    = 'cafe0000-0000-4000-8000-000000000002';
const CONV_3    = 'cafe0000-0000-4000-8000-000000000003';
// Seven conversations for the burst checks (LWf, LWg); the first three are the ones above.
const BURST = [1, 2, 3, 4, 5, 6, 7].map((n) => 'cafe0000-0000-4000-8000-' + String(n).padStart(12, '0'));
const TOTAL_MESSAGES = 80;            // 40 human turns; the mock mounts 3 of them
const FULL_COUNT = TOTAL_MESSAGES / 2;

const CONV_QUERY = '?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong';
const ERR_403 = JSON.stringify({ type: 'error', error: { type: 'permission_error',
                                 message: 'Invalid authorization for organization' } });
const ERR_404 = JSON.stringify({ type: 'error', error: { type: 'not_found_error',
                                 message: 'Not found' } });
const ERR_5XX = JSON.stringify({ type: 'error', error: { type: 'api_error',
                                 message: 'Internal server error' } });
const ERR_429 = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error',
                                 message: 'Rate limited' } });
const ORG_LIST = JSON.stringify([
    // Order matters only when there are no cheap candidates. In these scenarios the WRONG
    // org goes first because buildPage's default lastActiveOrg cookie names it — that is
    // what makes "403 for one org" different from "403 for every org". By the time this
    // list is read, ORG_WRONG has already been tried and is filtered out.
    { uuid: ORG_WRONG, name: 'Other org', capabilities: ['chat'] },
    { uuid: ORG_RIGHT, name: 'Right org', capabilities: ['chat'] },
]);

// Payload texts must be BYTE-IDENTICAL to what claude-virtualized.html renders, or the
// index disagrees with the mounted rows and _ciNeedsResync refetches on the cooldown,
// which would add requests this probe counts. Same rules as tests/test-all-platforms.js
// buildGmFixtureShim: one leading interrupted assistant message (no stop_reason, renders
// no row), then alternating human/assistant rows, and the mock's visible
// ' VISIBLE-NOT-SR-ONLY' span appended to every human text.
function buildPayload(cid) {
    const messages = [];
    const uuidFor = (i) => 'aaaaaaaa-0000-4000-8000-' + String(i).padStart(12, '0');
    let seq = 0;
    const push = (m) => {
        m.uuid = uuidFor(seq);
        m.parent_message_uuid = seq === 0 ? '00000000-0000-4000-8000-000000000000' : uuidFor(seq - 1);
        m.index = seq; m.created_at = '2026-07-01T00:00:00Z'; m.text = '';
        m.attachments = []; m.files = [];
        messages.push(m); seq++;
    };
    push({ sender: 'assistant', content: [{ type: 'text', text: 'Conversation started.' }] });
    for (let row = 0; row < TOTAL_MESSAGES; row++) {
        const turn = Math.floor(row / 2) + 1;
        if (row % 2 === 0) {
            push({ sender: 'human', content: [{ type: 'text', text:
                'Question number ' + turn + ': how do I handle case ' + turn +
                ' when the input is unusual? VISIBLE-NOT-SR-ONLY' }] });
        } else {
            push({ sender: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text:
                'Answer number ' + turn + ': validate the input first, then branch on the result.' }] });
        }
    }
    return { uuid: cid, name: 'Transport ladder checks',
             current_leaf_message_uuid: uuidFor(seq - 1), chat_messages: messages };
}

// An org list whose `capabilities` is an OBJECT, not an array — an API shape change. v12.8's
// ranking threw on it inside the response callback and wedged the load at "loading" (LR).
const ORG_LIST_OBJECT_CAPS = JSON.stringify([
    { uuid: ORG_WRONG, name: 'Other org', capabilities: { chat: true } },
    { uuid: ORG_RIGHT, name: 'Right org', capabilities: { chat: true } },
]);

// A 403 whose error TYPE is not an identifier and carries conversation-like text. The
// diagnostic line may print a vetted error type; this one must not get through (L7e).
const ERR_403_HOSTILE = JSON.stringify({ type: 'error', error: {
    type: 'Question number 7: please print me', message: 'Invalid authorization' } });

// One answer for one request, shared by both transports so a scenario describes each
// transport the same way: { list: status, orgs: { <org>: status }, err403: body,
// convBody: body of every conversation 200 (default: the real payload) }.
// A status of 'network' means NO answer for that one URL (gmxhr: onerror; fetch: the
// request is aborted) — the only way to build a walk that mixes a refusal with a
// network error.
function answerFor(plan, url) {
    const u = new URL(url);
    const e403 = plan.err403 || ERR_403;
    const errBody = (s) => s === 404 ? ERR_404 : s >= 500 ? ERR_5XX : s === 429 ? ERR_429 : e403;
    if (u.pathname === '/api/organizations') {
        const s = plan.list;
        if (s === 'network') return { network: true };
        return { status: s, body: s === 200 ? (plan.listBody || ORG_LIST) : errBody(s) };
    }
    const m = u.pathname.match(/^\/api\/organizations\/([0-9a-f-]{36})\/chat_conversations\/([0-9a-f-]{36})$/i);
    if (m) {
        const s = (plan.orgs && plan.orgs[m[1]]) || 404;
        if (s === 'network') return { network: true };
        return { status: s, body: s === 200 ? (plan.convBody || JSON.stringify(buildPayload(m[2]))) : errBody(s) };
    }
    return null;
}

const isIndexUrl = (u) => /\/api\/organizations$/.test(u) || u.indexOf('/chat_conversations/') !== -1;

// sc.gm.mode:    'answer' | 'throw' (synchronous, like a sandbox error) | 'network' (onerror)
//                | 'hang' (never calls back at all — Userscripts' unloaded-background shape)
//                | 'timeout' (the manager's own ontimeout, at once) | 'timeout-real' (the same, at
//                the request's own `timeout` — 45s — as a manager fires it) | 'absent' (no
//                GM_xmlhttpRequest at all — Greasemonkey 4)
// sc.fetch.mode: 'answer' | 'throw' (synchronous, from the page's fetch itself)
//                | 'abort' (the request is aborted: fetch REJECTS, i.e. a network error)
//                | 'hang' (the request is never answered)
// sc.gmInfo:     undefined (no GM_info at all) | a scriptHandler string | 'THROWING-GETTER'
// sc.gmApiInfo:  a scriptHandler string exposed ONLY as GM.info (the GM4-style API object)
// sc.firefoxShape: true -> stub exportFunction, so the userscript's SSE interceptor skips
//                exactly as it does on Firefox + Tampermonkey (see buildPage).
// sc.latencyMs:  per-request latency for BOTH transports (default 5ms gmxhr, 0 fetch).
function buildPage(scriptContent, sc) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    // The GM shim answers from the same plan the Node-side fetch route uses. Bodies are
    // computed here, in Node, so both transports return byte-identical payloads.
    const gmAnswers = {};
    const gmUrls = [
        'https://claude.ai/api/organizations',
        'https://claude.ai/api/organizations/' + ORG_RIGHT + '/chat_conversations/' + CONV + CONV_QUERY,
        'https://claude.ai/api/organizations/' + ORG_WRONG + '/chat_conversations/' + CONV + CONV_QUERY,
        'https://claude.ai/api/organizations/' + ORG_RIGHT + '/chat_conversations/' + CONV_2 + CONV_QUERY,
        'https://claude.ai/api/organizations/' + ORG_WRONG + '/chat_conversations/' + CONV_2 + CONV_QUERY,
    ];
    for (const u of gmUrls) gmAnswers[u] = answerFor(sc.gm, u);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>transport ladder checks</title></head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify({ totalMessages: TOTAL_MESSAGES })};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var GM_MODE = ${JSON.stringify(sc.gm.mode)};
    var ANSWERS = ${JSON.stringify(gmAnswers)};
    var LATENCY = ${JSON.stringify(sc.latencyMs || 5)};
    window.__gmCalls = [];
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        window.__gmCalls.push({
            url: url, method: opts.method, timeout: opts.timeout,
            headers: JSON.stringify(opts.headers === undefined ? null : opts.headers),
            keys: Object.keys(opts).sort().join(','),
            handlers: [typeof opts.onload, typeof opts.onerror, typeof opts.ontimeout].join(','),
            index: /\\/api\\/organizations$/.test(url) || url.indexOf('/chat_conversations/') !== -1
        });
        // The usage panel shares this API; it is not under test, so it never answers.
        if (/\\/usage$/.test(url)) return;
        if (GM_MODE === 'throw') {
            throw new Error('Permission denied to access property "then"');
        }
        if (GM_MODE === 'hang') return;   // no onload, no onerror, no ontimeout — ever
        if (GM_MODE === 'timeout-real') {
            // ontimeout when a manager would fire it: at opts.timeout. The watchdog's margin
            // past that moment is then what decides which of the two reports first (LWi).
            setTimeout(function () { if (opts.ontimeout) opts.ontimeout(); }, opts.timeout || 0);
            return;
        }
        setTimeout(function () {
            // The manager's OWN timeout callback (its timeout option fired): a slow server,
            // not a broken transport — classified like a network error, no fallback (LM7).
            if (GM_MODE === 'timeout') { if (opts.ontimeout) opts.ontimeout(); return; }
            if (GM_MODE === 'network') {
                if (opts.onerror) opts.onerror({ status: 0, error: 'background shutdown' });
                return;
            }
            var a = ANSWERS[url];
            if (!a) { if (opts.onload) opts.onload({ status: 404, responseText: ${JSON.stringify(ERR_404)} }); return; }
            if (a.network) { if (opts.onerror) opts.onerror({ status: 0 }); return; }
            if (opts.onload) opts.onload({ status: a.status, responseText: a.body });
        }, LATENCY);
    };
    // Greasemonkey 4 ships no GM_xmlhttpRequest at all (L4d).
    if (GM_MODE === 'absent') delete window.GM_xmlhttpRequest;
    ${sc.firefoxShape ? `
    // FIREFOX SHAPE. On Firefox + Tampermonkey exportFunction exists, so the userscript's
    // SSE interceptor returns early and window.fetch is never proxied. Without this stub
    // the harness proxies every claude.ai fetch, and the proxy's .catch() marks the raw
    // promise handled — which HIDES a transport that leaks an unhandled rejection (measured
    // on all three engines during this probe's design). Claude is spa:false, so the
    // interceptor is the only code this stub reaches.
    window.exportFunction = function (f) { return f; };` : ''}
    ${sc.fetch.mode === 'throw' ? `
    // Installed BEFORE the userscript, so whatever fetch it ends up calling — this
    // function directly, or its own SSE proxy wrapped around it — throws synchronously.
    window.fetch = function () { throw new TypeError('Permission denied to access property "fetch"'); };` : `
    // A SPY, not a stub: records the arguments of every call and delegates to the real
    // fetch, so the request still reaches page.route. Installed before the userscript,
    // so it sits beneath the userscript's own SSE proxy and sees the index's calls too.
    // page.route cannot see the credentials mode; this is how L1-shape can.
    window.__fetchOpts = [];
    var _realFetch = window.fetch;
    window.fetch = function (input, init) {
        window.__fetchOpts.push({
            url: typeof input === 'string' ? input : String(input && input.url),
            credentials: init && init.credentials,
            hasSignal: !!(init && init.signal),
            headers: init && init.headers !== undefined ? JSON.stringify(init.headers) : null,
            method: init && init.method,
            keys: init ? Object.keys(init).sort().join(',') : ''
        });
        // ...and counts every cancel of a response body, so LWc can see that a late answer
        // nobody reads is CANCELLED rather than left streaming (Codex Tier 3 round 9).
        return _realFetch.apply(this, arguments).then(function (res) {
            try {
                var body = res.body;
                if (body && typeof body.cancel === 'function') {
                    var cancel = body.cancel;
                    body.cancel = function () { window.__bodyCancels++; return cancel.apply(body, arguments); };
                }
            } catch (e) {}
            return res;
        });
    };
    window.__bodyCancels = 0;`}
    ${sc.gmInfo === undefined ? '' : sc.gmInfo === 'THROWING-GETTER' ? `
    window.GM_info = {};
    Object.defineProperty(window.GM_info, 'scriptHandler', { get: function () { throw new Error('GM_info getter threw'); } });`
    : `window.GM_info = { scriptHandler: ${JSON.stringify(sc.gmInfo)}, version: 'probe' };`}
    ${sc.gmApiInfo === undefined ? '' :
      `window.GM = { info: { scriptHandler: ${JSON.stringify(sc.gmApiInfo)}, version: 'probe' } };`}
    var _s = {};
    window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
    window.GM_setValue = function (k, v) { _s[k] = v; };
    ${sc.cookieOrg === null ? '// cookieOrg: null — a fresh session with no lastActiveOrg cookie at all (LN)' :
      "try { document.cookie = 'lastActiveOrg=' + " + JSON.stringify(sc.cookieOrg || ORG_WRONG) + " + '; path=/'; } catch (e) {}"}
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

const READ_STATE = `(function () {
    var stat = document.querySelector('[data-acn-role="nav-stat"]');
    var banner = document.querySelector('[data-acn-index-status]');
    return {
        count:  stat ? stat.getAttribute('data-acn-count') : null,
        banner: banner ? banner.getAttribute('data-acn-index-status') : null,
        bannerText: banner ? banner.textContent : null,
        gmIndex: (window.__gmCalls || []).filter(function (c) { return c.index; }).length
    };
}())`;

// Terminal = the full index is listed, or the degraded banner is up. Then require two
// agreeing reads, because the panel re-renders on MutationObserver batches and a single
// sample can land between a rebuild and its repopulate (check-usage-state.js learned
// that one the hard way). NOT a plain "no banner" test: a healthy ready index renders
// no banner at all, so absence means nothing — the count is the ready signal.
async function readTerminal(page, timeoutMs) {
    try {
        await page.waitForFunction(`(function () {
            var s = document.querySelector('[data-acn-role="nav-stat"]');
            var b = document.querySelector('[data-acn-index-status="degraded"]');
            return (s && s.getAttribute('data-acn-count') === '${FULL_COUNT}') || !!b;
        }())`, null, { timeout: timeoutMs || 25000 });
    } catch (e) { /* fall through: the read below reports whatever IS on screen */ }
    let prev = null;
    for (let i = 0; i < 20; i++) {
        const cur = await page.evaluate(READ_STATE);
        if (prev && prev.count === cur.count && prev.banner === cur.banner) { cur.stable = true; return cur; }
        prev = cur;
        await page.waitForTimeout(300);
    }
    prev.stable = false;
    return prev;
}

// Changes the route AND forces a MutationObserver batch, exactly as check-usage-state.js
// does and for the same reason: Claude is spa:false, so only a scan notices the uuid
// change, and a settled static mock schedules no scan by itself.
async function routeChangeAndForceScan(page, url) {
    await page.evaluate((u) => {
        history.pushState({}, '', u);
        var probe = document.createElement('div');
        probe.setAttribute('data-acn-probe-scan-trigger', '1');
        document.body.appendChild(probe);
        probe.remove();
    }, url);
}

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

    // Loads the page under one transport plan, opens Navigate (that is what renders the
    // count), waits for a terminal state, then runs the optional `after` hook while the
    // page is still alive. Everything observed is returned; nothing is asserted here.
    async function scenario(sc) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const pageOrigin = sc.pageOrigin || 'https://claude.ai';
        const targetURL = pageOrigin + '/chat/' + CONV;
        const otherURL  = pageOrigin + '/chat/' + CONV_2;
        const thirdURL  = pageOrigin + '/chat/' + CONV_3;
        const html = buildPage(raw, sc);
        const fetchCalls = [];
        const logs = [];
        const errors = [];
        let firstHeld = false;
        const scenarioStart = Date.now();
        const lateAnswers = [];   // perConv delayed answers, as they are sent
        page.on('console', (m) => logs.push({ t: Date.now(), text: m.text() }));
        page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u === targetURL || u === targetURL + '/' || u === otherURL) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
                return;
            }
            // The usage panel is not under test here. Since v12.12 its requests also ride the ladder,
            // so they can reach fetch (first in Userscripts order; after the GM watchdog otherwise):
            // refused at once, and kept out of fetchCalls, which counts the index's requests.
            if (/^https:\/\/[^/]+\/api\/organizations\/[^/]+\/usage$/.test(u.split('?')[0])) {
                route.abort().catch(() => {});
                return;
            }
            // ANY origin's /api/ request is recorded — a request sent from the wrong origin is
            // exactly what LO and LH must be able to see — but only claude.ai's is answered.
            if (/^https:\/\/[^/]+\/api\//.test(u)) {
                fetchCalls.push({ t: Date.now(), url: u, index: isIndexUrl(u.split('?')[0]) });
                if (u.indexOf('https://claude.ai/api/') !== 0) { route.abort().catch(() => {}); return; }
                if (sc.fetch.mode === 'hang') return;   // never fulfilled, never aborted
                // conv2HealthyAfterMs: the SECOND conversation answers 500 until this long after
                // the scenario started, so its retries are forced past a chosen moment (LWe).
                if (sc.fetch.conv2HealthyAfterMs && u.indexOf(CONV_2) !== -1 &&
                    Date.now() - scenarioStart < sc.fetch.conv2HealthyAfterMs) {
                    route.fulfill({ status: 500, contentType: 'application/json', body: ERR_5XX }).catch(() => {});
                    return;
                }
                const a = sc.fetch.mode === 'answer' ? answerFor(sc.fetch, u) : null;
                if (a && a.network) { route.abort().catch(() => {}); return; }
                if (a) {
                    const send = () => route.fulfill({ status: a.status, contentType: 'application/json', body: a.body })
                        .catch(() => {});   // the context may already be closing
                    // firstHang: the FIRST index request is never answered at all (LWd, LWe),
                    // and every later one answers normally.
                    if (sc.fetch.firstHang && !firstHeld && isIndexUrl(u.split('?')[0])) {
                        firstHeld = true;
                        return;
                    }
                    // perConv: a conversation's requests hang ('hang'), are rejected ('abort': a
                    // network error) or answer after N ms; the org list and any other
                    // conversation answer normally (LWb-cap, LWc, LWf, LWh).
                    const pc = sc.fetch.perConv &&
                        Object.keys(sc.fetch.perConv).find((cid) => u.indexOf('/chat_conversations/' + cid) !== -1);
                    if (pc) {
                        const how = sc.fetch.perConv[pc];
                        if (how === 'hang') return;
                        if (how === 'abort') { route.abort().catch(() => {}); return; }
                        setTimeout(() => { lateAnswers.push({ t: Date.now(), cid: pc }); send(); }, how);
                        return;
                    }
                    if (sc.latencyMs) setTimeout(send, sc.latencyMs); else send();
                    return;
                }
            }
            route.abort().catch(() => {});
        });
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        await page.evaluate("document.getElementById('acn-dot-nav').click()");
        // `early` runs while the first load may still be in flight (LWe switches conversation
        // there); `after` runs once a terminal state has been read.
        const chatURL = (cid) => pageOrigin + '/chat/' + cid;
        const ctx = { otherURL, thirdURL, chatURL, fetchCalls, logs, errors, lateAnswers };
        if (sc.early) await sc.early(page, ctx);
        const out = await readTerminal(page, sc.terminalTimeoutMs || 25000);
        out.fetchCalls = fetchCalls;
        out.logs = logs;
        out.errors = errors;
        out.gmCalls = await page.evaluate('window.__gmCalls || []');
        out.fetchOpts = await page.evaluate('window.__fetchOpts || []');
        if (sc.after) out.after = await sc.after(page, out, ctx);
        await context.close();
        return out;
    }

    const idxLines = (r) => r.logs.filter((l) => l.text.indexOf('[ACN] index:') === 0);
    const fetchIdx = (r) => r.fetchCalls.filter((c) => c.index).length;
    const gmIdx    = (r) => r.gmCalls.filter((c) => c.index).length;
    const brief    = (r) => 'count=' + r.count + ' banner=' + r.banner + ' stable=' + r.stable +
                            ' gmIndex=' + gmIdx(r) + ' fetchIndex=' + fetchIdx(r) +
                            ' errors=' + r.errors.length;
    // The class ciSetDegraded chose, read off the line it prints.
    const permanentLines = (r) => r.logs.filter((l) => /index failure looks PERMANENT/.test(l.text)).length;
    const degradedLines  = (r) => r.logs.filter((l) => /conversation index unavailable/.test(l.text)).length;
    // Index request counts on both transports, read live inside an `after` hook.
    const liveCounts = async (page, ctx) => ({
        gm: (await page.evaluate('window.__gmCalls || []')).filter((c) => c.index).length,
        fetch: ctx.fetchCalls.filter((c) => c.index).length,
    });

    console.log('check-transport-ladder — engine=' + engine + ', script=' + path.basename(scriptPath));

    // ── L1 — THE SAFARI SHAPE (spec fixture 1). gmxhr is rejected by every org AND by the
    // org list; fetch is rejected by the wrong org and accepted by the right one. No
    // GM_info at all, so detection cannot help: the ladder alone has to get there.
    // v12.8 degrades to the DOM scan here (count 3).
    const l1 = await scenario({
        gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        // L1b — the winning transport is CACHED: a later load (another conversation) must
        // not pay for the rejected transport again.
        after: async (page, out, ctx) => {
            const gmBefore = (await page.evaluate('window.__gmCalls || []')).filter((c) => c.index).length;
            const fetchBefore = ctx.fetchCalls.filter((c) => c.index).length;
            await routeChangeAndForceScan(page, ctx.otherURL);
            // Wait until the second conversation's load has actually been ISSUED (a fixed
            // sleep is the flake this project keeps relearning), then let it finish.
            const deadline = Date.now() + 20000;
            while (Date.now() < deadline &&
                   !ctx.fetchCalls.some((c) => c.url.indexOf(CONV_2) !== -1) &&
                   !(await page.evaluate('(window.__gmCalls || []).some(function (c) { return c.url.indexOf(' +
                                         JSON.stringify(CONV_2) + ') !== -1; })'))) {
                await page.waitForTimeout(200);
            }
            const second = await readTerminal(page, 20000);
            const gmAfter = (await page.evaluate('window.__gmCalls || []')).filter((c) => c.index).length;
            return { gmBefore, gmAfter, fetchBefore, fetchAfter: ctx.fetchCalls.filter((c) => c.index).length,
                     conv2Fetched: ctx.fetchCalls.some((c) => c.url.indexOf(CONV_2) !== -1), second };
        },
    });
    check('L1', 'Safari shape: gmxhr 403 everywhere, fetch 200 -> FULL list via fetch',
        l1.stable && l1.count === String(FULL_COUNT) && l1.banner !== 'degraded' && l1.errors.length === 0,
        brief(l1));
    // The org-list request is the one whose 403 produced the owner's Safari reason text —
    // and the line ROADMAP 0d asks for if Chrome's 403 recurs — so it must be logged on
    // both transports, not only the conversation requests.
    check('L1-list', 'both org-list requests are logged: gmxhr refused (org=list status=403), fetch accepted',
        idxLines(l1).some((l) => /transport=gmxhr org=list status=403/.test(l.text)) &&
        idxLines(l1).some((l) => /transport=fetch org=list status=200/.test(l.text)),
        idxLines(l1).filter((l) => /org=list/.test(l.text)).map((l) => l.text).join(' | '));
    check('L1-log', 'L1 names the winning transport and org: transport=fetch org=730fcd2a… status=200',
        idxLines(l1).some((l) => /transport=fetch org=730fcd2a… status=200/.test(l.text)),
        idxLines(l1).map((l) => l.text).join(' | ').slice(0, 400));
    // The fetch transport must be exactly the call that measured 200 on Safari:
    // fetch(<absolute same-origin URL>, { credentials: 'include' }) and NOTHING else. A
    // custom header (Cache-Control, as gmxhr sends) makes the request non-simple — a CORS
    // preflight wherever the calling realm's origin is the extension's — and an
    // AbortSignal is one more object crossing into fetch from the userscript's realm.
    const l1fx = l1.fetchOpts.filter((o) => isIndexUrl(String(o.url).split('?')[0]));
    // The URL in FULL, query string included. answerFor matches by path, so a fetch that
    // lost the query would still be answered — only this pins it (Codex Tier 3 round 6).
    const fetchUrlExact = (u) => u === 'https://claude.ai/api/organizations' ||
        (/^https:\/\/claude\.ai\/api\/organizations\/[0-9a-f-]{36}\/chat_conversations\/[0-9a-f-]{36}\?/.test(u) &&
         u.slice(u.indexOf('?')) === CONV_QUERY);
    check('L1-shape', 'fetch is called exactly as measured: v12.8\'s URL in full, {credentials: include}, nothing else',
        l1fx.some((o) => String(o.url).indexOf('/chat_conversations/') !== -1) && l1fx.every((o) =>
            fetchUrlExact(String(o.url)) && o.credentials === 'include' &&
            o.headers === null && o.method === undefined && o.hasSignal === false &&
            o.keys === 'credentials'),
        JSON.stringify(l1fx.map((o) => ({ url: String(o.url).replace('https://claude.ai', '').slice(0, 60),
                                           credentials: o.credentials, keys: o.keys, headers: o.headers }))).slice(0, 400));
    check('L1b', 'the winning transport is cached: the next load does not call gmxhr for the index',
        !!l1.after && l1.after.conv2Fetched && l1.after.gmAfter === l1.after.gmBefore &&
        l1.after.second.count === String(FULL_COUNT),
        JSON.stringify(l1.after && { gmBefore: l1.after.gmBefore, gmAfter: l1.after.gmAfter,
                                     fetchBefore: l1.after.fetchBefore, fetchAfter: l1.after.fetchAfter,
                                     conv2Fetched: l1.after.conv2Fetched, count2: l1.after.second.count }));

    // ── L7 — diagnostics, read off L1 (the scenario that exercises every line type).
    const l7 = idxLines(l1);
    check('L7a', 'every [ACN] index: line names its transport and status',
        l7.length > 0 && l7.every((l) => /transport=(gmxhr|fetch) /.test(l.text) && / status=\d+/.test(l.text)),
        l7.length + ' lines');
    check('L7b', 'org-scoped lines carry an 8-char org prefix, never the full uuid',
        l7.filter((l) => /org=[0-9a-f]/.test(l.text)).length > 0 &&
        l7.every((l) => !/org=[0-9a-f]/.test(l.text) || /org=[0-9a-f]{8}… /.test(l.text)) &&
        l7.every((l) => l.text.indexOf(ORG_RIGHT) === -1 && l.text.indexOf(ORG_WRONG) === -1),
        l7.map((l) => l.text).join(' | ').slice(0, 300));
    check('L7c', 'a JSON 403 body is reported as error.type=permission_error',
        l7.some((l) => / status=403 /.test(l.text + ' ') && /error\.type=permission_error/.test(l.text)),
        l7.filter((l) => /status=403/.test(l.text)).map((l) => l.text).join(' | ').slice(0, 300));
    check('L7d', 'no [ACN] line carries conversation content',
        l1.logs.filter((l) => l.text.indexOf('[ACN]') === 0)
            .every((l) => !/Question number|Answer number|VISIBLE-NOT-SR-ONLY/.test(l.text)),
        'scanned ' + l1.logs.filter((l) => l.text.indexOf('[ACN]') === 0).length + ' [ACN] lines');

    // ── L1c — detection that THROWS must not cost the index (correctness must not
    // depend on detection).
    const l1c = await scenario({
        gmInfo: 'THROWING-GETTER',
        gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    check('L1c', 'a GM_info whose scriptHandler getter throws still reaches the full list',
        l1c.stable && l1c.count === String(FULL_COUNT) && l1c.errors.length === 0, brief(l1c));

    // ── L1-slow — the Safari shape at REPRESENTATIVE latency. The suite's 5ms fixture once
    // hid an unbounded scan/load recursion for a whole release, because a second scan never
    // landed inside a 5ms fetch window (TESTING.md). The ladder makes the in-flight window
    // longer still — two walks — so this is the shape that would expose a load re-entered
    // while the first is in flight: more walks, more requests, more "index order" lines.
    const l1s = await scenario({
        latencyMs: 700,
        gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    const orderLines = (r) => r.logs.filter((l) => l.text.indexOf('[ACN] index order:') === 0).length;
    const readyLines = (r) => r.logs.filter((l) => l.text.indexOf('[ACN] conversation index ready:') === 0).length;
    check('L1-slow', 'at 700ms/request: ONE load, one ladder, the same 2 gmxhr + 3 fetch requests as at 5ms',
        l1s.stable && l1s.count === String(FULL_COUNT) && gmIdx(l1s) === 2 && fetchIdx(l1s) === 3 &&
        orderLines(l1s) === 1 && readyLines(l1s) === 1 && l1s.errors.length === 0,
        brief(l1s) + ' orderLines=' + orderLines(l1s) + ' readyLines=' + readyLines(l1s));
    // Spec 2.4 is "one line per attempt": with the request counts pinned above, the line
    // count can be pinned too — a request that stops being logged fails here.
    check('L7f', 'exactly one [ACN] index: line per request (L1-slow: 5 requests, 5 lines)',
        idxLines(l1s).length === gmIdx(l1s) + fetchIdx(l1s),
        'lines=' + idxLines(l1s).length + ' requests=' + (gmIdx(l1s) + fetchIdx(l1s)));

    // ── L2 — THE FIREFOX PATH (spec fixture 2). Tampermonkey, gmxhr answers. The WRONG
    // org is tried first and 403s, so this also proves that one rejected candidate inside
    // a successful walk does not trigger the fallback. fetch must never be called, and
    // every GM request must have exactly v12.8's shape.
    const l2 = await scenario({
        gmInfo: 'Tampermonkey', firefoxShape: true,
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    check('L2', 'Firefox shape: gmxhr succeeds -> full list, fetch NEVER called',
        l2.stable && l2.count === String(FULL_COUNT) && l2.fetchCalls.length === 0 && l2.errors.length === 0,
        brief(l2));
    const v128Conv = 'https://claude.ai/api/organizations/' + ORG_RIGHT + '/chat_conversations/' + CONV + CONV_QUERY;
    const l2idx = l2.gmCalls.filter((c) => c.index);
    check('L2-shape', 'every gmxhr index request is byte-for-byte the v12.8 request',
        l2idx.length >= 3 && l2idx.some((c) => c.url === v128Conv) &&
        l2idx.every((c) => c.method === 'GET' && c.timeout === 45000 &&
                           c.headers === '{"Accept":"application/json","Cache-Control":"no-cache"}' &&
                           c.keys === 'headers,method,onerror,onload,ontimeout,timeout,url' &&
                           c.handlers === 'function,function,function' &&
                           /^https:\/\/claude\.ai\/api\/organizations(\/[0-9a-f-]{36}\/chat_conversations\/[0-9a-f-]{36}\?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong)?$/.test(c.url)),
        JSON.stringify(l2idx.map((c) => ({ url: c.url.replace('https://claude.ai', ''), keys: c.keys, headers: c.headers, timeout: c.timeout }))).slice(0, 500));

    // ── L2b — no GM_info at all (an unknown manager): gmxhr first, and still no fetch.
    // Its `after` hook is also the HARNESS SENTINEL: every "no page error" conjunct in this
    // file is only meaningful if an unhandled rejection actually reaches page.on('pageerror')
    // on this engine. So one is raised on purpose and must be seen. If an engine or
    // Playwright change ever stops delivering them, L0 fails instead of every errors===0
    // check silently passing (DEC-032: prove the knob moves the output).
    const l2b = await scenario({
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        cookieOrg: ORG_RIGHT,
        after: async (page, out, ctx) => {
            const before = ctx.errors.length;
            await page.evaluate("setTimeout(function () { Promise.reject(new Error('acn-probe-sentinel')); }, 0)");
            const deadline = Date.now() + 5000;
            while (Date.now() < deadline && !ctx.errors.some((e) => /acn-probe-sentinel/.test(e))) {
                await page.waitForTimeout(100);
            }
            return { errorsBefore: before, sentinelSeen: ctx.errors.some((e) => /acn-probe-sentinel/.test(e)) };
        },
    });
    check('L2b', 'no GM_info: gmxhr first; it succeeds, so fetch is never called',
        l2b.stable && l2b.count === String(FULL_COUNT) && l2b.fetchCalls.length === 0 &&
        !!l2b.after && l2b.after.errorsBefore === 0, brief(l2b));
    check('L0', 'harness sentinel: an unhandled rejection DOES reach the page-error collector on this engine',
        !!l2b.after && l2b.after.sentinelSeen, JSON.stringify(l2b.after));

    // ── L5 — USERSCRIPTS DETECTION (spec fixture 5). Both transports WOULD succeed, so the
    // only thing that can keep gmxhr at zero calls is the order.
    const l5 = await scenario({
        gmInfo: 'Userscripts',
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    check('L5', 'Userscripts: fetch first; it succeeds, so gmxhr is never called for the index',
        l5.stable && l5.count === String(FULL_COUNT) && gmIdx(l5) === 0 && fetchIdx(l5) > 0, brief(l5));

    // ── L5c — the same detection when the manager exposes its name ONLY as GM.info (the
    // GM4-style API object), with no GM_info at all. Whether Userscripts provides GM_info
    // without a grant is unmeasured, so this branch may be the one Safari takes
    // (Codex Tier 3 round 7: it was ungated).
    const l5c = await scenario({
        gmApiInfo: 'Userscripts',
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    check('L5c', 'GM.info only (no GM_info): Userscripts still detected — fetch first, gmxhr never called',
        l5c.stable && l5c.count === String(FULL_COUNT) && gmIdx(l5c) === 0 && fetchIdx(l5c) > 0 &&
        l5c.logs.some((l) => /index order: fetch → gmxhr \(scriptHandler: Userscripts\)/.test(l.text)),
        brief(l5c));

    // ── L5b — the ladder runs in the OTHER direction too: Userscripts order, fetch rejected
    // everywhere, gmxhr accepted.
    // Its second load (L5b-cache) is the mirror of L1b: a GMXHR winner must be cached too,
    // or every later load would ask the refusing fetch first again (Codex Tier 3 round 2).
    const l5b = await scenario({
        gmInfo: 'Userscripts',
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
        after: async (page, out, ctx) => {
            const before = await liveCounts(page, ctx);
            await routeChangeAndForceScan(page, ctx.otherURL);
            // The second conversation's load has been ISSUED once either transport asked for it.
            const issued = '(window.__gmCalls || []).some(function (c) { return c.url.indexOf(' +
                           JSON.stringify(CONV_2) + ') !== -1; })';
            const deadline = Date.now() + 20000;
            while (Date.now() < deadline && !(await page.evaluate(issued)) &&
                   !ctx.fetchCalls.some((c) => c.url.indexOf(CONV_2) !== -1)) {
                await page.waitForTimeout(200);
            }
            const second = await readTerminal(page, 20000);
            return { before, after: await liveCounts(page, ctx), count2: second.count,
                     cachedLine: ctx.logs.some((l) => /\[ACN\] index order: gmxhr → fetch \(this session's last winner first\)/.test(l.text)) };
        },
    });
    check('L5b', 'Userscripts order, fetch 403 everywhere -> falls back to gmxhr, full list',
        l5b.stable && l5b.count === String(FULL_COUNT) && fetchIdx(l5b) > 0 && gmIdx(l5b) > 0 &&
        idxLines(l5b).some((l) => /transport=gmxhr org=730fcd2a… status=200/.test(l.text)),
        brief(l5b));
    check('L5b-cache', 'a gmxhr winner is cached too: the next load asks gmxhr first and never fetch',
        !!l5b.after && l5b.after.cachedLine && l5b.after.after.fetch === l5b.after.before.fetch &&
        l5b.after.after.gm > l5b.after.before.gm && l5b.after.count2 === String(FULL_COUNT),
        JSON.stringify(l5b.after));

    // ── L1v — a winner is the transport that delivered a USABLE index, not merely a 200.
    // gmxhr is refused everywhere; fetch answers 200 with a body that parses but fails shape
    // validation. Cached as the winner, fetch would lead every later load, and its next 200
    // would end each walk before gmxhr was asked again (Codex Tier 3 round 6).
    const l1v = await scenario({
        gmInfo: 'Tampermonkey',
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 },
                 convBody: JSON.stringify({ uuid: CONV, chat_messages: [] }) },
        after: async (page, out, ctx) => {
            const from = ctx.logs.length;
            await routeChangeAndForceScan(page, ctx.otherURL);
            const orderLine = () => ctx.logs.slice(from).find((l) => /\[ACN\] index order:/.test(l.text));
            const deadline = Date.now() + 15000;
            while (Date.now() < deadline && !orderLine()) await page.waitForTimeout(100);
            return { order: orderLine() ? orderLine().text : null };
        },
    });
    check('L1v', 'a fetch 200 whose body fails validation is NOT cached as the winner: the next load asks gmxhr first',
        l1v.banner === 'degraded' && /unexpected response shape/.test(l1v.bannerText || '') && fetchIdx(l1v) > 0 &&
        !!l1v.after && /index order: gmxhr → fetch \(scriptHandler: Tampermonkey\)/.test(l1v.after.order || ''),
        brief(l1v) + ' next=' + JSON.stringify(l1v.after && l1v.after.order));

    // ── L4 — A TRANSPORT THAT THROWS (spec fixture 4): the other transport is tried and the
    // exception never reaches the page.
    const l4a = await scenario({
        gm:    { mode: 'throw' },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    check('L4a', 'GM_xmlhttpRequest throws synchronously -> fetch is tried, full list, no page error',
        l4a.stable && l4a.count === String(FULL_COUNT) && fetchIdx(l4a) > 0 && l4a.errors.length === 0,
        brief(l4a) + (l4a.errors.length ? ' first=' + l4a.errors[0].slice(0, 120) : ''));
    const l4b = await scenario({
        gmInfo: 'Userscripts',
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'throw' },
    });
    // The log line is what proves the throwing fetch was ASKED: in 'throw' mode no request
    // reaches page.route, and a build that never calls fetch (v12.8) passes everything else.
    const threwLine = (r, transport, what) =>
        idxLines(r).some((l) => new RegExp('transport=' + transport + ' .*status=0 error=' + what).test(l.text));
    check('L4b', 'fetch throws synchronously (Userscripts order) -> gmxhr is tried, full list, no page error',
        l4b.stable && l4b.count === String(FULL_COUNT) && gmIdx(l4b) > 0 && l4b.errors.length === 0 &&
        threwLine(l4b, 'fetch', 'fetch threw'),
        brief(l4b) + (l4b.errors.length ? ' first=' + l4b.errors[0].slice(0, 120) : ''));

    // ── L4d — no GM_xmlhttpRequest at all (Greasemonkey 4 ships GM.xmlHttpRequest only, and
    // names itself through GM.info). v12.8's index could never load there; the ladder reads a
    // missing API as a transport that cannot run, so fetch takes over (Codex Tier 3 round 8:
    // every other scenario installs the shim, so this branch was ungated).
    const l4d = await scenario({
        gmApiInfo: 'Greasemonkey',
        gm:    { mode: 'absent' },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    check('L4d', 'no GM_xmlhttpRequest at all (Greasemonkey 4) -> gmxhr cannot run, fetch takes over: full list, no page error',
        l4d.stable && l4d.count === String(FULL_COUNT) && fetchIdx(l4d) > 0 && l4d.errors.length === 0 &&
        threwLine(l4d, 'gmxhr', 'GM_xmlhttpRequest unavailable') &&
        l4d.logs.some((l) => /index fallback: gmxhr could not run here/.test(l.text)),
        brief(l4d) + (l4d.errors.length ? ' first=' + l4d.errors[0].slice(0, 120) : ''));

    // ── L3 — BOTH TRANSPORTS REJECTED (spec fixture 3): PERMANENT, with the v12.8 backoff
    // — but only after BOTH were tried. Runs CONCURRENTLY with L3d, its control: both
    // exits are the ladder's combined-failure path, one PERMANENT and one transient, so
    // between them they show that path neither retries too soon (L3-backoff) nor never
    // (L3d-retry). L6-retry cannot stand in for that: it exits through the single-walk path.
    // A TRANSIENT class reschedules at cooldown + 1s = 16s; PERMANENT's first step is 60s.
    // 19s separates them.
    const retryWindow = async (page, ctx) => {
        const before = await liveCounts(page, ctx);
        await page.waitForTimeout(19000);
        return { before, after: await liveCounts(page, ctx) };
    };
    const [l3, l3d] = await Promise.all([
        scenario({
            gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
            fetch: { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
            after: async (page, out, ctx) => {
                const perm = ctx.logs.find((l) => /index failure looks PERMANENT/.test(l.text));
                const w = await retryWindow(page, ctx);
                return { permT: perm ? perm.t : null, permText: perm ? perm.text : null,
                         before: w.before, after: w.after };
            },
        }),
        // L3d — gmxhr refused, fetch got an ANSWER that is not a refusal (a 5xx). fetch
        // evidently reaches the server, and a server error may clear on its own: plain
        // cooldown, not the backoff — and BOTH walks must actually run again.
        scenario({
            gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
            fetch: { mode: 'answer', list: 500, orgs: { [ORG_WRONG]: 500, [ORG_RIGHT]: 500 } },
            after: async (page, out, ctx) => retryWindow(page, ctx),
        }),
    ]);
    const permT = l3.after && l3.after.permT;
    check('L3', 'both transports 403 -> degraded, and classified PERMANENT with the 60s first step',
        l3.stable && l3.banner === 'degraded' && !!permT && /next retry in 60s/.test(l3.after.permText || ''),
        brief(l3) + ' perm=' + JSON.stringify(l3.after && l3.after.permText));
    check('L3-order', 'PERMANENT is declared only AFTER both transports were tried',
        !!permT && l3.fetchCalls.some((c) => c.index && c.t <= permT) && gmIdx(l3) > 0 &&
        l3.logs.filter((l) => /index failure looks PERMANENT/.test(l.text)).length === 1,
        'fetchBeforePermanent=' + l3.fetchCalls.filter((c) => c.index && permT && c.t <= permT).length +
        ' gmIndex=' + gmIdx(l3) + ' permanentLines=' +
        l3.logs.filter((l) => /index failure looks PERMANENT/.test(l.text)).length);
    check('L3-backoff', 'the backoff holds: no index request at the 16s transient retry point',
        !!l3.after && l3.after.before.gm === l3.after.after.gm && l3.after.before.fetch === l3.after.after.fetch,
        JSON.stringify(l3.after && { before: l3.after.before, after: l3.after.after }));

    check('L3d', 'gmxhr 403 + fetch 5xx -> degraded but NOT permanent (fetch answered; it may work next time)',
        l3d.stable && l3d.banner === 'degraded' && permanentLines(l3d) === 0 && degradedLines(l3d) > 0 &&
        fetchIdx(l3d) > 0,
        brief(l3d) + ' permanentLines=' + permanentLines(l3d));
    check('L3d-retry', 'the combined-failure path DOES retry on the 16s cooldown: both walks ran again',
        !!l3d.after && l3d.after.after.gm > l3d.after.before.gm && l3d.after.after.fetch > l3d.after.before.fetch,
        JSON.stringify(l3d.after));

    // ── LM — MIXED first walks: which answers send the load to the other transport, and
    // which keep v12.8's verdict on one transport. All Firefox-shaped (Tampermonkey, gmxhr
    // first, no SSE proxy) with fetch ready to answer 200, so both a fetch call that does
    // not belong and a missing one are visible. Concurrent: no timing windows here.
    //   LM1 404 then 403 — both refusals: fetch IS tried, and wins. Before the review fix
    //       this walk went PERMANENT with the exact v12.8 Safari line, fetch never asked.
    //   LM2 403 then 503 — a server error: fetch NOT tried; transient.
    //   LM3 403 then 429 — a rate limit: fetch NOT tried; v12.8's PERMANENT 429 backoff,
    //       and the summary line names the transport (spec 2.4).
    //   LM4 403 then no answer from the org list: fetch NOT tried; transient.
    //   LM5 401 — a refusal that ends the walk at once (v12.8's rule, unchanged: one gmxhr
    //       request): fetch IS tried, and wins. (Codex Tier 3 asked for this case.)
    //   LM6 gmxhr refused everywhere; fetch meets a wrong-org 403 and then SILENCE from the org
    //       list. Nothing fetch met explains its failure, so gmxhr's refusal stands: PERMANENT.
    //       A rule that let the 403 count as "fetch got a verdict" re-polled both refused
    //       walks every ~16s (Codex Tier 3 round 3).
    //   LM7 gmxhr's OWN timeout fires (ontimeout — the manager's 45s option): a slow server, not
    //       a broken transport, so NO fallback, transient. Only a manager that never calls back
    //       at all (LWa's watchdog) counts as the transport failing (Codex Tier 3 round 5).
    //   LM8 gmxhr refused everywhere; fetch meets a wrong-org 403 and then an org list that
    //       answers 200 `{}` — the server answering, just not with an org list. That is a
    //       verdict (like a malformed body), so it does NOT uphold gmxhr's refusal: transient,
    //       as v12.8 classified that reason (Codex Tier 3 round 7).
    //   LM8b the same through the OTHER org-list path: no lastActiveOrg cookie, so the walk
    //       starts at the org list, and fetch's answers 200 with an array holding no usable
    //       org. Transient.
    //   LM8c the all-orgs path again, with an ARRAY holding no usable org, after fetch's own
    //       wrong-org 403. The walk's reason carries that 403 ("(HTTP 403)"), so the load is
    //       PERMANENT: v12.8's class for this shape. Codex Tier 3 round 8 had made it
    //       transient; the owner reverted that on PR #75, and this check now holds the v12.8 class.
    //   LM9 gmxhr's conversation answers 200 with a body that is not JSON: a verdict about the
    //       server, so fetch NOT tried; v12.8's PERMANENT "malformed JSON" class (round 7: no
    //       check produced unparseable JSON before).
    const ffShape = { gmInfo: 'Tampermonkey', firefoxShape: true };
    const fetchWins = { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } };
    const [lm1, lm2, lm3, lm4, lm5, lm6, lm7, lm8, lm8b, lm8c, lm9] = await Promise.all([
        scenario(Object.assign({}, ffShape, { fetch: fetchWins,
            gm: { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 404, [ORG_RIGHT]: 403 } } })),
        scenario(Object.assign({}, ffShape, { fetch: fetchWins,
            gm: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 503 } } })),
        scenario(Object.assign({}, ffShape, { fetch: fetchWins,
            gm: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 429 } } })),
        scenario(Object.assign({}, ffShape, { fetch: fetchWins,
            gm: { mode: 'answer', list: 'network', orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } })),
        scenario(Object.assign({}, ffShape, { fetch: fetchWins,
            gm: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 401, [ORG_RIGHT]: 200 } } })),
        scenario(Object.assign({}, ffShape, {
            gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
            fetch: { mode: 'answer', list: 'network', orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } })),
        scenario(Object.assign({}, ffShape, { fetch: fetchWins, gm: { mode: 'timeout' } })),
        scenario(Object.assign({}, ffShape, {
            gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
            fetch: { mode: 'answer', list: 200, listBody: '{}', orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } })),
        scenario(Object.assign({}, ffShape, { cookieOrg: null,
            gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
            fetch: { mode: 'answer', list: 200, listBody: JSON.stringify([{ name: 'an org with no uuid' }]),
                     orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } })),
        scenario(Object.assign({}, ffShape, {
            gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
            fetch: { mode: 'answer', list: 200, listBody: JSON.stringify([{ name: 'an org with no uuid' }]),
                     orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } })),
        scenario(Object.assign({}, ffShape, { fetch: fetchWins,
            gm: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 },
                  convBody: '{"uuid": "cafe0000-0000-4000-8000-0000000' } })),
    ]);
    check('LM1', '404 + 403 on gmxhr are both refusals -> fetch IS tried, full list (spec 2.3)',
        lm1.stable && lm1.count === String(FULL_COUNT) && fetchIdx(lm1) > 0 && permanentLines(lm1) === 0,
        brief(lm1) + ' permanentLines=' + permanentLines(lm1));
    check('LM2', '403 then 503 -> a server error: fetch NOT tried, transient (not PERMANENT)',
        lm2.stable && lm2.banner === 'degraded' && lm2.fetchCalls.length === 0 && permanentLines(lm2) === 0,
        brief(lm2) + ' permanentLines=' + permanentLines(lm2));
    check('LM3', '403 then 429 -> a rate limit: fetch NOT tried, v12.8 PERMANENT backoff, line names gmxhr',
        lm3.stable && lm3.banner === 'degraded' && lm3.fetchCalls.length === 0 && permanentLines(lm3) === 1 &&
        lm3.logs.some((l) => /index failure looks PERMANENT \(\[gmxhr\] HTTP 429\) — next retry in 60s/.test(l.text)),
        brief(lm3) + ' ' + JSON.stringify((lm3.logs.find((l) => /PERMANENT/.test(l.text)) || {}).text));
    check('LM4', '403 then NO answer -> fetch NOT tried, transient',
        lm4.stable && lm4.banner === 'degraded' && lm4.fetchCalls.length === 0 && permanentLines(lm4) === 0,
        brief(lm4) + ' permanentLines=' + permanentLines(lm4));
    check('LM5', 'a 401 is a refusal that ends the gmxhr walk (v12.8 rule) -> fetch IS tried, full list',
        lm5.stable && lm5.count === String(FULL_COUNT) && gmIdx(lm5) === 1 && fetchIdx(lm5) > 0,
        brief(lm5));
    check('LM6', 'gmxhr refused + fetch meets only a refusal and silence -> PERMANENT (the refusal stands)',
        lm6.stable && lm6.banner === 'degraded' && fetchIdx(lm6) > 0 && permanentLines(lm6) === 1,
        brief(lm6) + ' permanentLines=' + permanentLines(lm6));
    check('LM7', "gmxhr's own ontimeout -> a slow server: fetch NOT tried, transient",
        lm7.stable && lm7.banner === 'degraded' && lm7.fetchCalls.length === 0 && permanentLines(lm7) === 0 &&
        idxLines(lm7).some((l) => /transport=gmxhr .*status=0 error=timeout$/.test(l.text)),
        brief(lm7) + ' ' + idxLines(lm7).map((l) => l.text.replace('[ACN] index: ', '')).join(' | ').slice(0, 200));
    check('LM8', 'gmxhr refused + fetch\'s org list answers 200 {} -> a verdict, not a refusal: transient, NOT PERMANENT',
        lm8.stable && lm8.banner === 'degraded' && fetchIdx(lm8) > 0 && permanentLines(lm8) === 0 &&
        degradedLines(lm8) >= 1,
        brief(lm8) + ' permanentLines=' + permanentLines(lm8));
    check('LM8b', 'the same on the first org-list path (no cookie): an array with no usable org is a verdict, NOT PERMANENT',
        lm8b.stable && lm8b.banner === 'degraded' && fetchIdx(lm8b) > 0 && permanentLines(lm8b) === 0 &&
        degradedLines(lm8b) >= 1,
        brief(lm8b) + ' permanentLines=' + permanentLines(lm8b));
    check('LM8c', 'the all-orgs path, an array with no usable org after a 403 -> v12.8\'s class kept: "(HTTP 403)", PERMANENT',
        lm8c.stable && lm8c.banner === 'degraded' && fetchIdx(lm8c) > 0 && permanentLines(lm8c) === 1 &&
        lm8c.logs.some((l) => /\[fetch\] no org candidate accepted the conversation \(HTTP 403\)/.test(l.text)),
        brief(lm8c) + ' permanentLines=' + permanentLines(lm8c));
    check('LM9', 'gmxhr 200 with a body that is not JSON -> a verdict: fetch NOT tried, v12.8 PERMANENT "malformed JSON"',
        lm9.stable && lm9.banner === 'degraded' && lm9.fetchCalls.length === 0 && permanentLines(lm9) === 1 &&
        lm9.logs.some((l) => /index failure looks PERMANENT \(\[gmxhr\] malformed JSON\)/.test(l.text)),
        brief(lm9) + ' ' + JSON.stringify((lm9.logs.find((l) => /PERMANENT|unavailable/.test(l.text)) || {}).text));

    // ── LO / LH / LR — the guards the review added. Concurrent; no timing windows.
    //   LO  claude.ai on another ORIGIN (port 8443 — @match patterns ignore ports): the index
    //       must not run at all. Before Codex Tier 3 round 2 the guard checked only the
    //       hostname, so here fetch refused, and the ladder then handed the load to gmxhr —
    //       which fetched the real conversation from https://claude.ai into this page.
    //   LH  a LOOK-ALIKE host (claude.ai.example.com): platform detection says Claude, but
    //       the index must not run at all — on Firefox + Tampermonkey its gmxhr would fetch
    //       the user's real conversation from claude.ai and render it into this page.
    //   (Both use Userscripts order, so fetch would be asked first if the index ran. The
    //   fetch transport's own origin refusal is therefore unreachable while the index guard
    //   holds — it is defense in depth, recorded as ungated in the mutation matrix.)
    //   LR  the org list arrives with `capabilities` as an object: ranking must not throw
    //       (v12.8 threw inside the response callback and wedged the load at "loading").
    //   LN  a FRESH session: no lastActiveOrg cookie, no cached org, no resource entries — so
    //       the very first request is the org list, and gmxhr's 403 for it ends the walk
    //       through the "could not resolve organization UUID" exit. That exit must still hand
    //       the load to fetch (Codex Tier 3 round 4: every other scenario seeds the cookie).
    const [lo, lh, lr, ln] = await Promise.all([
        // Nothing terminal is expected in LO and LH (no index, so no full list and no
        // banner): a short wait, then the stable read reports what is on screen.
        scenario({ pageOrigin: 'https://claude.ai:8443', terminalTimeoutMs: 6000, gmInfo: 'Userscripts',
                   gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
                   fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } }),
        scenario({ pageOrigin: 'https://claude.ai.example.com', terminalTimeoutMs: 6000, gmInfo: 'Userscripts',
                   gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
                   fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } }),
        scenario({ gm:    { mode: 'answer', list: 200, listBody: ORG_LIST_OBJECT_CAPS,
                            orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
                   fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } }),
        scenario({ cookieOrg: null,
                   gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
                   fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } } }),
    ]);
    check('LO', 'on claude.ai at another port the index never runs: no request on either transport',
        lo.stable && gmIdx(lo) === 0 && lo.fetchCalls.length === 0 &&
        !lo.logs.some((l) => l.text.indexOf('[ACN] index order:') === 0) && lo.count === '3',
        brief(lo) + ' fetchCalls=' + JSON.stringify(lo.fetchCalls.map((c) => c.url.slice(0, 60))));
    check('LH', 'on a look-alike host the index never runs: no request on either transport',
        lh.stable && gmIdx(lh) === 0 && lh.fetchCalls.length === 0 &&
        !lh.logs.some((l) => l.text.indexOf('[ACN] index order:') === 0) && lh.count === '3',
        brief(lh));
    check('LR', 'an org list with object `capabilities` does not wedge the load: full list',
        lr.stable && lr.count === String(FULL_COUNT) && lr.banner !== 'loading',
        brief(lr) + ' errors=' + JSON.stringify(lr.errors.slice(0, 1)));
    // Counted from the index's own log lines, not gmIdx: with no cookie, the USAGE panel also
    // asks GM for /api/organizations (its own org lookup, pre-existing), which the shim's URL
    // test cannot tell apart from the index's request.
    const lnGm = idxLines(ln).filter((l) => /transport=gmxhr/.test(l.text));
    check('LN', 'fresh session (no candidates): gmxhr 403 on the org list hands the load to fetch, full list',
        ln.stable && ln.count === String(FULL_COUNT) && lnGm.length === 1 &&
        /org=list status=403/.test(lnGm[0].text) &&
        idxLines(ln).some((l) => /transport=fetch org=list status=200/.test(l.text)),
        brief(ln) + ' ' + idxLines(ln).map((l) => l.text.replace('[ACN] index: ', '')).join(' | '));

    // The other ways BOTH transports can fail, and the class each must get. PERMANENT
    // costs a 60s→240s→960s backoff; transient re-runs both walks every ~16s. The rule:
    // PERMANENT when the second transport's own verdict is permanent, or when it got no
    // verdict at all (threw / no answer) and the first was refused. No waiting needed
    // here: L3-backoff and L3d-retry establish what each class does to the retry schedule
    // on this path; these establish which class is chosen, from the line ciSetDegraded prints.

    // L3b — gmxhr refused, fetch got NO ANSWER (the request was aborted: a network
    // error). A transport that could not reach the server cannot overrule one the server
    // refused, so gmxhr's refusal stands: PERMANENT. This is the logged-out tab whose
    // fetch merely fails to connect — classified transient, it would re-poll every ~16s
    // forever with every refused gmxhr request, where v12.8 backed off.
    // Firefox-shaped, so no SSE proxy marks the rejected fetch promise handled: if the
    // transport leaked that rejection, it would surface here as a page error.
    const l3b = await scenario({
        gmInfo: 'Tampermonkey', firefoxShape: true,
        gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
        fetch: { mode: 'abort' },
    });
    check('L3b', 'gmxhr 403 + fetch network error -> PERMANENT (no answer cannot overrule a refusal), no leaked rejection',
        l3b.stable && l3b.banner === 'degraded' && permanentLines(l3b) === 1 && fetchIdx(l3b) > 0 &&
        l3b.errors.length === 0,
        brief(l3b) + ' permanentLines=' + permanentLines(l3b) + ' banner=' + JSON.stringify((l3b.bannerText || '').slice(0, 160)) +
        (l3b.errors.length ? ' first=' + l3b.errors[0].slice(0, 120) : ''));

    // L3c — gmxhr refused, fetch THREW (the logged-out Firefox shape, if fetch is unusable
    // in that sandbox). fetch cannot run, so gmxhr's auth verdict stands: PERMANENT, as
    // v12.8 classified a logged-out tab.
    const l3c = await scenario({
        gmInfo: 'Tampermonkey', firefoxShape: true,
        gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 } },
        fetch: { mode: 'throw' },
    });
    check('L3c', 'gmxhr 403 + fetch throws -> PERMANENT (the logged-out tab keeps its backoff)',
        l3c.stable && l3c.banner === 'degraded' && permanentLines(l3c) === 1 && l3c.errors.length === 0 &&
        threwLine(l3c, 'fetch', 'fetch threw'),
        brief(l3c) + ' permanentLines=' + permanentLines(l3c));

    // L4c — neither transport can run at all. Nothing reached the server, so there is no
    // verdict to back off from: plain cooldown, exactly v12.8's "GM_xmlhttpRequest
    // unavailable" class. And still no page error.
    const l4c = await scenario({
        gm:    { mode: 'throw' },
        fetch: { mode: 'throw' },
    });
    check('L4c', 'both transports throw -> degraded, NOT permanent, no page error',
        l4c.stable && l4c.banner === 'degraded' && permanentLines(l4c) === 0 && l4c.errors.length === 0 &&
        threwLine(l4c, 'gmxhr', 'GM_xmlhttpRequest threw') && threwLine(l4c, 'fetch', 'fetch threw'),
        brief(l4c) + ' permanentLines=' + permanentLines(l4c));

    // L7e — a hostile error body. The type field is not an identifier and carries
    // conversation-like text; it must not be printed.
    const l7e = await scenario({
        gm:    { mode: 'answer', list: 403, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 403 }, err403: ERR_403_HOSTILE },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 }, err403: ERR_403_HOSTILE },
    });
    check('L7e', 'an error.type that is not an identifier is dropped, never printed',
        idxLines(l7e).length > 0 &&
        l7e.logs.every((l) => !/please print me|Question number/.test(l.text)) &&
        idxLines(l7e).filter((l) => /status=403/.test(l.text)).every((l) => !/error\.type=/.test(l.text)),
        idxLines(l7e).filter((l) => /status=403/.test(l.text)).map((l) => l.text).join(' | ').slice(0, 300));

    // ── L6 — A NETWORK ERROR IS NOT A CREDENTIAL FAILURE. Tampermonkey order, gmxhr's
    // onerror fires. The other transport cannot fix a network outage, and falling back on
    // one would let a single blip switch Firefox to fetch for the rest of the page session.
    // So: no fallback, a TRANSIENT class, and the normal 16s retry. That retry is also what
    // makes L3-backoff non-vacuous — it shows the retry machinery DOES fire at 16s when
    // the class is transient.
    const l6 = await scenario({
        gmInfo: 'Tampermonkey', firefoxShape: true,
        gm:    { mode: 'network' },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        after: async (page, out, ctx) => {
            const before = (await page.evaluate('window.__gmCalls || []')).filter((c) => c.index).length;
            await page.waitForTimeout(19000);
            const after = (await page.evaluate('window.__gmCalls || []')).filter((c) => c.index).length;
            return { before, after };
        },
    });
    check('L6', 'gmxhr network error -> no fallback to fetch, degraded, NOT permanent',
        l6.stable && l6.banner === 'degraded' && l6.fetchCalls.length === 0 &&
        !l6.logs.some((l) => /index failure looks PERMANENT/.test(l.text)),
        brief(l6));
    check('L6-log', "the manager's own onerror text reaches the log line (the shim sends 'background shutdown', TM 5.5.0's text per TM issue #2892)",
        idxLines(l6).some((l) => /transport=gmxhr org=\S+ status=0 error=network error \(background shutdown\)/.test(l.text)),
        idxLines(l6).map((l) => l.text).join(' | ').slice(0, 300));
    check('L6-retry', 'a transient failure retries on the 16s cooldown (the control for L3-backoff)',
        !!l6.after && l6.after.after > l6.after.before && l6.fetchCalls.length === 0,
        JSON.stringify(l6.after) + ' fetchCalls=' + l6.fetchCalls.length);

    // L6b — the same rule with fetch first (Userscripts): a REJECTED fetch (network error)
    // is not a credential failure either. gmxhr would answer 200 here, so only the rule
    // itself keeps it at zero calls.
    const l6b = await scenario({
        gmInfo: 'Userscripts',
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'abort' },
    });
    check('L6b', 'Userscripts order, fetch network error -> no fallback to gmxhr, degraded, NOT permanent',
        l6b.stable && l6b.banner === 'degraded' && gmIdx(l6b) === 0 && fetchIdx(l6b) > 0 &&
        !l6b.logs.some((l) => /index failure looks PERMANENT/.test(l.text)),
        brief(l6b));

    // ── L8 — a walk whose SYNCHRONOUS prefix throws, before any request exists. A malformed
    // lastActiveOrg cookie makes decodeURIComponent throw inside ciResolveOrgCandidates. On
    // v12.8 that escaped ciLoadIndex with the in-flight marker set, so the banner sat at
    // "loading" for the session. Now it must end the load as an ordinary degraded failure.
    // Page errors are NOT asserted here: the usage panel reads the same cookie, unguarded,
    // when Navigate opens — pre-existing and outside the index (ROADMAP 0d).
    const l8 = await scenario({
        cookieOrg: '%E0%A4%A',
        gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
    });
    check('L8', 'a throw in the walk prefix (malformed cookie) ends the load as DEGRADED, not stuck at loading',
        l8.stable && l8.banner === 'degraded' && /org walk threw: URIError/.test(l8.bannerText || ''),
        brief(l8) + ' banner=' + JSON.stringify((l8.bannerText || '').slice(0, 140)));

    // ── LW — THE WATCHDOGS. A transport that never answers must delay the index, never
    // wedge it: the in-flight marker is released only when the load finishes, so a request
    // that never settles leaves the panel at "loading" for the rest of the session. These
    // cost real time (the timeouts are 45s/50s), so they run CONCURRENTLY, each in its
    // own browser context.
    //   LWa — gmxhr never calls back (Userscripts drops every callback when its background
    //         page unloads — read from its source, not observed). Past the manager's own
    //         45s timeout, that is the TRANSPORT failing, so it qualifies for the ladder:
    //         fetch takes over.
    //   LWb — fetch never answers (Userscripts order). A plain timeout: no answer is not a
    //         refusal, so no fallback — degraded and retried on the cooldown.
    // A fetch is never cancelled (no AbortSignal crosses realms), so two page-wide bounds keep
    // requests from piling up: TWO timed out and still pending (the retries' bound), and SIX
    // open at all (navigation's — the stall count sees a request only after its 45s). Rounds
    // 3-5 found three edge cases in a per-conversation count; page-wide counts replaced it,
    // and these four pin the stall bound from both sides:
    //   LWb-cap — the upper side: one fetch hangs in chat A, one in chat B; then chat C
    //         must report a timeout WITHOUT sending anything, and keep doing so on retry.
    //   LWc — the release: the same two stalls, but B's answers LATE (at 50s, after its
    //         45s timeout). That answer must free a slot, so C sends and loads. If the
    //         release regressed, every fetch after the second stall would fail fast as
    //         "earlier requests are still unanswered", forever (Codex round 2).
    //   LWd — the lower side: ONE stall blocks nothing. A fetch hangs forever in chat A;
    //         switch to B after A's timeout; B must send a REAL request and load (round 3).
    //   LWe — the same, switching while A's FIRST load is still in flight. B answers 500
    //         until 50s, forcing its retries past A's 45s timeout; the one after must still
    //         send and load (round 4).
    // and these two the open bound (Codex round 6), with no timeout involved at all:
    //   LWf — six conversations opened back to back into a hanging path, each left once its
    //         request is out: all six send. A seventh is refused without sending.
    //   LWg — the release: seven conversations in a row whose requests ARE answered all load,
    //         so every answered request frees its slot.
    //   LWh — the same for requests that are REJECTED (a network error): six in a row, then a
    //         seventh that answers and must load (round 9). LWc also checks that a late answer
    //         nobody reads has its body CANCELLED, not left streaming after its slot was freed.
    // And the watchdog's place in time (round 9):
    //   LWi — the manager's own ontimeout fires at its real 45s. The watchdog sits 5s past it,
    //         so the timeout reports first: a slow server, no fallback. A watchdog at or before
    //         45s would hand every merely-slow request to fetch.
    const TIMED_OUT   = /transport=fetch .*status=0 error=timeout$/;
    const FAILED_FAST = /error=timeout \(earlier requests are still unanswered\)/;
    const linesSince  = (ctx, re, t) => ctx.logs.filter((l) => l.t >= (t || 0) && re.test(l.text)).length;
    async function waitForLines(page, ctx, re, n, ms, t) {
        const deadline = Date.now() + ms;
        while (Date.now() < deadline && linesSince(ctx, re, t) < n) await page.waitForTimeout(200);
    }
    // Leaves conversation `from` (default: the first) for `url` once its index request is
    // out — and, under the plans below, hanging — so it is still in flight when the user
    // moves on.
    async function switchOnceSent(page, ctx, url, from) {
        const cid = from || CONV;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline && !ctx.fetchCalls.some((c) => c.index && c.url.indexOf(cid) !== -1)) {
            await page.waitForTimeout(100);
        }
        await routeChangeAndForceScan(page, url);
    }
    async function waitForFullList(page, ms) {
        try {
            await page.waitForFunction("(function () { var s = document.querySelector('[data-acn-role=\"nav-stat\"]'); " +
                "return !!s && s.getAttribute('data-acn-count') === '" + FULL_COUNT + "'; }())", null, { timeout: ms });
        } catch (e) { /* the read after it reports what is on screen */ }
    }
    const READY = /\[ACN\] conversation index ready:/;
    const DEGRADED = /conversation index unavailable/;
    const [lwa, lwb, lwcap, lwc, lwd, lwe, lwf, lwg, lwh, lwi] = await Promise.all([
        scenario({
            terminalTimeoutMs: 75000,
            gm:    { mode: 'hang' },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        }),
        scenario({
            terminalTimeoutMs: 75000, gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'hang' },
        }),
        scenario({
            terminalTimeoutMs: 75000, gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 },
                     perConv: { [CONV]: 'hang', [CONV_2]: 'hang' } },
            early: (page, ctx) => switchOnceSent(page, ctx, ctx.otherURL),
            // readTerminal returns on B's degraded banner (~45s); A's request timed out just
            // before. With both lingering, open C: its first attempt and its ~16s retry.
            after: async (page, out, ctx) => {
                await waitForLines(page, ctx, TIMED_OUT, 2, 20000);
                const switchedAt = Date.now();
                await routeChangeAndForceScan(page, ctx.thirdURL);
                await waitForLines(page, ctx, FAILED_FAST, 2, 25000, switchedAt);
                return { timedOut: linesSince(ctx, TIMED_OUT),
                         failedFast: linesSince(ctx, FAILED_FAST, switchedAt),
                         sentAfterSwitch: ctx.fetchCalls.filter((c) => c.t >= switchedAt).length,
                         permanent: ctx.logs.some((l) => /index failure looks PERMANENT/.test(l.text)),
                         banner: (await page.evaluate(READ_STATE)).banner };
            },
        }),
        scenario({
            terminalTimeoutMs: 75000, gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 },
                     perConv: { [CONV]: 'hang', [CONV_2]: 50000 } },
            early: (page, ctx) => switchOnceSent(page, ctx, ctx.otherURL),
            // Both stalled by ~45s; B's answer lands at ~50s. Open C once it has been sent.
            // Gated on C LOADING, which it does at once or on its ~16s retry — never on C's
            // first attempt alone, because when the page's promise settles relative to the
            // switch is the harness's timing, not the code's.
            after: async (page, out, ctx) => {
                await waitForLines(page, ctx, TIMED_OUT, 2, 20000);
                const deadline = Date.now() + 20000;
                while (Date.now() < deadline && !ctx.lateAnswers.some((a) => a.cid === CONV_2)) {
                    await page.waitForTimeout(200);
                }
                await page.waitForTimeout(1500);
                const switchedAt = Date.now();
                await routeChangeAndForceScan(page, ctx.thirdURL);
                await waitForFullList(page, 25000);
                return { timedOut: linesSince(ctx, TIMED_OUT),
                         lateAnswered: ctx.lateAnswers.some((a) => a.cid === CONV_2),
                         conv3Sent: ctx.fetchCalls.some((c) => c.t >= switchedAt && c.url.indexOf(CONV_3) !== -1),
                         failedFast: linesSince(ctx, FAILED_FAST),
                         bodyCancels: await page.evaluate('window.__bodyCancels || 0'),
                         count: (await page.evaluate(READ_STATE)).count };
            },
        }),
        scenario({
            terminalTimeoutMs: 75000, gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 }, firstHang: true },
            // readTerminal returns on A's degraded banner (~45s), well before A's 16s retry.
            after: async (page, out, ctx) => {
                await routeChangeAndForceScan(page, ctx.otherURL);
                const deadline = Date.now() + 25000;
                while (Date.now() < deadline && !ctx.fetchCalls.some((c) => c.url.indexOf(CONV_2) !== -1)) {
                    await page.waitForTimeout(200);
                }
                await waitForFullList(page, 20000);
                return { conv2Sent: ctx.fetchCalls.some((c) => c.url.indexOf(CONV_2) !== -1),
                         count: (await page.evaluate(READ_STATE)).count,
                         failedFast: linesSince(ctx, FAILED_FAST) };
            },
        }),
        scenario({
            terminalTimeoutMs: 20000, gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 },
                     firstHang: true, conv2HealthyAfterMs: 50000 },
            early: (page, ctx) => switchOnceSent(page, ctx, ctx.otherURL),
            after: async (page, out, ctx) => {
                await waitForFullList(page, 70000);
                return { count: (await page.evaluate(READ_STATE)).count,
                         conv2Requests: ctx.fetchCalls.filter((c) => c.url.indexOf(CONV_2) !== -1).length,
                         failedFast: linesSince(ctx, FAILED_FAST) };
            },
        }),
        scenario({
            gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 },
                     perConv: Object.fromEntries(BURST.slice(0, 6).map((c) => [c, 'hang'])) },
            // All inside one 45s window, so nothing has timed out: only the open bound applies.
            // readTerminal then returns on the seventh's degraded banner — the only one possible.
            early: async (page, ctx) => {
                for (let i = 1; i < BURST.length; i++) {
                    await switchOnceSent(page, ctx, ctx.chatURL(BURST[i]), BURST[i - 1]);
                }
            },
            after: async (page, out, ctx) => ({
                opened: BURST.slice(0, 6).filter((c) => ctx.fetchCalls.some((r) => r.url.indexOf(c) !== -1)).length,
                seventhSent: ctx.fetchCalls.some((r) => r.url.indexOf(BURST[6]) !== -1),
                failedFast: linesSince(ctx, FAILED_FAST),
                timedOut: linesSince(ctx, TIMED_OUT),
            }),
        }),
        scenario({
            gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            // readTerminal returns once the first conversation is listed; each next one is
            // opened only after the one before it was READY, so nothing is still open then.
            // A conversation counts as loaded only by a ready line logged AFTER the switch to it.
            after: async (page, out, ctx) => {
                let loaded = 1;
                for (let i = 1; i < BURST.length; i++) {
                    const switchedAt = Date.now();
                    await routeChangeAndForceScan(page, ctx.chatURL(BURST[i]));
                    await waitForLines(page, ctx, READY, 1, 15000, switchedAt);
                    if (linesSince(ctx, READY, switchedAt) > 0) loaded++;
                }
                return { loaded, failedFast: linesSince(ctx, FAILED_FAST),
                         seventhSent: ctx.fetchCalls.some((r) => r.url.indexOf(BURST[6]) !== -1) };
            },
        }),
        scenario({
            gmInfo: 'Userscripts',
            gm:    { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 },
                     perConv: Object.fromEntries(BURST.slice(0, 6).map((c) => [c, 'abort'])) },
            // readTerminal returns on the first conversation's degraded banner. Each next one
            // is opened once the one before it has failed (one more degraded line).
            after: async (page, out, ctx) => {
                for (let i = 1; i < BURST.length; i++) {
                    await waitForLines(page, ctx, DEGRADED, i, 15000);
                    await routeChangeAndForceScan(page, ctx.chatURL(BURST[i]));
                }
                await waitForFullList(page, 15000);
                return { rejected: BURST.slice(0, 6).filter((c) => ctx.fetchCalls.some((r) => r.url.indexOf(c) !== -1)).length,
                         failedFast: linesSince(ctx, FAILED_FAST),
                         seventhSent: ctx.fetchCalls.some((r) => r.url.indexOf(BURST[6]) !== -1),
                         count: (await page.evaluate(READ_STATE)).count };
            },
        }),
        scenario({
            terminalTimeoutMs: 75000, gmInfo: 'Tampermonkey',
            gm:    { mode: 'timeout-real' },
            fetch: { mode: 'answer', list: 200, orgs: { [ORG_WRONG]: 403, [ORG_RIGHT]: 200 } },
        }),
    ]);
    check('LWa', 'gmxhr that NEVER calls back -> watchdog, then fetch: full list, no wedge',
        lwa.stable && lwa.count === String(FULL_COUNT) && fetchIdx(lwa) > 0 &&
        idxLines(lwa).some((l) => /transport=gmxhr .*status=0 error=GM_xmlhttpRequest never called back/.test(l.text)),
        brief(lwa));
    check('LWb', 'fetch that NEVER answers -> timeout: degraded (not stuck loading), no fallback, NOT permanent',
        lwb.stable && lwb.banner === 'degraded' && gmIdx(lwb) === 0 &&
        !lwb.logs.some((l) => /index failure looks PERMANENT/.test(l.text)) &&
        idxLines(lwb).some((l) => TIMED_OUT.test(l.text)),
        brief(lwb));
    check('LWb-cap', 'two timed-out fetches lingering (chats A and B) -> chat C reports a timeout WITHOUT sending, on retry too',
        !!lwcap.after && lwcap.after.timedOut >= 2 && lwcap.after.failedFast >= 2 &&
        lwcap.after.sentAfterSwitch === 0 && !lwcap.after.permanent && lwcap.after.banner === 'degraded',
        JSON.stringify(lwcap.after));
    check('LWc', 'a lingering fetch that answers LATE frees its slot (body cancelled): chat C then sends and loads the full list',
        !!lwc.after && lwc.after.timedOut >= 2 && lwc.after.lateAnswered && lwc.after.conv3Sent &&
        lwc.after.count === String(FULL_COUNT) && lwc.after.bodyCancels >= 1,
        JSON.stringify(lwc.after));
    check('LWd', 'ONE fetch hung in chat A blocks nothing: chat B sends a real request and loads',
        !!lwd.after && lwd.after.conv2Sent && lwd.after.failedFast === 0 && lwd.after.count === String(FULL_COUNT),
        JSON.stringify(lwd.after));
    check('LWe', 'switching during A\'s first load: A\'s stall, landing mid-B, still does not block B\'s retries',
        !!lwe.after && lwe.after.failedFast === 0 && lwe.after.count === String(FULL_COUNT) &&
        lwe.after.conv2Requests >= 3,
        JSON.stringify(lwe.after));
    check('LWf', 'six conversations opened back to back into a hanging path all send; a seventh is refused WITHOUT sending',
        !!lwf.after && lwf.after.opened === 6 && !lwf.after.seventhSent && lwf.after.failedFast >= 1 &&
        lwf.after.timedOut === 0,
        JSON.stringify(lwf.after));
    check('LWg', 'every answered request frees its slot: seven conversations opened in a row all load',
        !!lwg.after && lwg.after.loaded === 7 && lwg.after.failedFast === 0 && lwg.after.seventhSent,
        JSON.stringify(lwg.after));
    check('LWh', 'every REJECTED request frees its slot too: six network errors in a row, then a seventh conversation loads',
        !!lwh.after && lwh.after.rejected === 6 && lwh.after.failedFast === 0 && lwh.after.seventhSent &&
        lwh.after.count === String(FULL_COUNT),
        JSON.stringify(lwh.after));
    check('LWi', "the manager's own 45s timeout reports BEFORE the watchdog: a slow server, fetch NOT tried, transient",
        lwi.stable && lwi.banner === 'degraded' && lwi.fetchCalls.length === 0 && permanentLines(lwi) === 0 &&
        idxLines(lwi).some((l) => /transport=gmxhr .*status=0 error=timeout$/.test(l.text)) &&
        !idxLines(lwi).some((l) => /never called back/.test(l.text)),
        brief(lwi) + ' ' + idxLines(lwi).map((l) => l.text.replace('[ACN] index: ', '')).join(' | ').slice(0, 200));

    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})().catch((e) => {
    // A thrown wait (page.goto, waitForFunction) must fail the run LOUDLY, not surface as
    // a bare unhandled-rejection stack with the browser left open.
    console.error('check-transport-ladder crashed: ' + (e && e.stack || e));
    process.exit(2);
});
