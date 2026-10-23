// Checks for Claude's turn-counter dots (v12.11, PR A). TROUBLESHOOTING, "Claude's turn-counter
// dots freeze at a stale count".
//
// Run: node probes/check-turn-counter.js [--browser chromium|firefox|webkit] [--quiet]
// ACN_SCRIPT=<path> runs another build (the pre-fix build, or a mutant). Exits non-zero on any
// failed expectation.
//
// THE BUG THIS GATES. orbOnScanComplete() drew the panel, dots included, BEFORE it called
// updateTurnCounter(), so the dots showed the previous scan's count. And orbPopulateNavigate()
// returned early on an unchanged list without redrawing them, so after the scan in which the
// index landed they froze: 0 right after a reset, or the 1-5 mounted turns of the DOM scan.
//
//   A1  the index is delayed and Navigate is opened before it lands (a reload on Safari).
//   A2  a conversation switch with Navigate open, which NO history hook can see (Claude is
//       spa:false, so none is installed; the switch also calls History.prototype.pushState,
//       which bypasses an instance hook if one existed). The output prints that no hook ran.
//   A1f, A2f  the FIRST draw that lists the 144 questions already shows the full count, read by
//       a MutationObserver on the count attribute, i.e. right after the drawing task. Without
//       this, the guarded redraw on the next scan (~500 ms later) hid a stale first draw, so
//       A1/A2 alone could not tell whether the counter is updated before drawing (Codex CLI review).
//   A5  leaving the conversation for an empty page with Navigate open clears the dots, from the
//       first draw on: the empty-list return redraws too (Codex CLI review).
//   A3  regression: a normal load, Navigate opened after the index lands.
//   A4  regression: an idle page with Navigate open produces NO DOM mutations. The panel sits
//       inside document.body, which the message observer watches, so a redraw on every scan
//       schedules the next scan: an unconditional redraw mutated the panel 744 times in 6 s
//       (scratch measurement, chromium and firefox, 2026-10-23), against 0 before and after.
//
// Expected dots for 144 questions: 40 (the cap), coloured by position out of 40 with no
// compaction data: 28 green, 6 yellow, 6 red (_renderTurnDots).
//
// CONTEXT of these results: Playwright <engine>, page realm, headless, this machine. The REAL
// shipped functions are reached by driving the UI (opening Navigate, changing the route); the
// assertions read the DOM the user sees. Not a userscript manager: real-browser acceptance on
// Safari + Userscripts, Chrome + Tampermonkey and Firefox + Tampermonkey is the owner's (DEC-031).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const ORG    = '99999999-9999-4999-8999-999999999999';
const CONV_A = '81818181-8181-4181-8181-818181818181';   // short: 8 questions
const CONV_B = '14414414-4144-4144-8144-144144144144';   // long: 144 questions
const LONG = 144, SHORT = 8;
const FULL_SPREAD = { dots: 40, green: 28, yellow: 6, red: 6 };

// The suite's fixture shape (tests/test-all-platforms.js, buildGmFixtureShim): one leading
// interrupted assistant message the mock does not render, then question/answer pairs whose
// texts are byte-identical to claude-virtualized.html's rows, so the mounted rows resolve to
// index entries and no provisional entry inflates the count.
function buildConversation(uuid, questions) {
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
    push({ sender: 'assistant', content: [{ type: 'text', text: 'Conversation started.' }] });
    for (let turn = 1; turn <= questions; turn++) {
        push({ sender: 'human', content: [{ type: 'text', text:
            'Question number ' + turn + ': how do I handle case ' + turn + ' when the input is unusual?' +
            ' VISIBLE-NOT-SR-ONLY' }] });
        push({ sender: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text:
            'Answer number ' + turn + ': validate the input first, then branch on the result.' }] });
    }
    return { uuid, name: 'Turn counter checks', current_leaf_message_uuid: uuidFor(seq - 1),
             chat_messages: messages };
}

// mockQuestions: how many questions the mock DOM holds (static for the page's life).
// latencyMs: per-conversation answer delay for the index request.
function buildPage(scriptContent, mockQuestions, latencyMs) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const convs = {};
    convs[CONV_A] = buildConversation(CONV_A, SHORT);
    convs[CONV_B] = buildConversation(CONV_B, LONG);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>turn counter checks</title></head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify({ totalMessages: mockQuestions * 2 })};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var CONVS = ${JSON.stringify(convs)};
    var LATENCY = ${JSON.stringify(latencyMs)};
    window.__acnConvAnswered = {};
    window.__acnPopstates = 0;
    window.addEventListener('popstate', function () { window.__acnPopstates++; });
    // Saved before the userscript runs: the switch below calls the prototype's method, which an
    // own-property hook on window.history cannot see.
    window.__acnNativePushState = History.prototype.pushState;
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
            }, LATENCY[cid] || 10);
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

// What the user sees: the dots and their colours, the question count, whether Navigate is open.
const READ = `(function () {
    var dotsEl = document.getElementById('acn-ctx-dots');
    var dots = dotsEl ? dotsEl.querySelectorAll('.acn-ctx-dot') : [];
    var c = { green: 0, yellow: 0, red: 0, other: 0 };
    for (var i = 0; i < dots.length; i++) {
        var bg = dots[i].style.backgroundColor;
        if (bg === 'rgb(34, 197, 94)') c.green++;
        else if (bg === 'rgb(234, 179, 8)') c.yellow++;
        else if (bg === 'rgb(239, 68, 68)') c.red++;
        else c.other++;
    }
    var stat = document.getElementById('acn-nav-stat');
    var panel = document.getElementById('acn-panel-nav');
    return { dots: dots.length, green: c.green, yellow: c.yellow, red: c.red, other: c.other,
             count: stat ? stat.getAttribute('data-acn-count') : null,
             open: !!(panel && panel.getAttribute('data-acn-open') === 'true'),
             vis: document.visibilityState };
}())`;

const same = (a, b) => a && b && a.dots === b.dots && a.green === b.green && a.yellow === b.yellow &&
                       a.red === b.red && a.count === b.count && a.open === b.open;

// Two identical reads at least gapMs apart, so a value is not sampled mid-redraw. On timeout
// the last read comes back with stable:false, and no check accepts that.
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

// Records the dots at the moment the count attribute first reads `n`. A MutationObserver callback
// runs after the task that changed the attribute, and that task also draws the dots, so this is
// what the first draw showed.
async function armFirstDrawRead(page, n) {
    await page.evaluate((count) => {
        window.__acnFirstDraw = null;
        var stat = document.getElementById('acn-nav-stat');
        var mo = new MutationObserver(function () {
            if (window.__acnFirstDraw === null && stat.getAttribute('data-acn-count') === count) {
                var d = document.getElementById('acn-ctx-dots');
                window.__acnFirstDraw = { dots: d ? d.querySelectorAll('.acn-ctx-dot').length : 0 };
                mo.disconnect();
            }
        });
        mo.observe(stat, { attributes: true, attributeFilter: ['data-acn-count'] });
    }, String(n));
}

const fmt = (r) => r ? ('dots=' + r.dots + ' (' + r.green + 'g/' + r.yellow + 'y/' + r.red + 'r' +
                        (r.other ? '/' + r.other + '?' : '') + ') count=' + r.count + ' open=' + r.open +
                        ' stable=' + r.stable + ' vis=' + r.vis) : 'no read';
const fullSpread = (r) => !!r && r.stable === true && r.dots === FULL_SPREAD.dots &&
    r.green === FULL_SPREAD.green && r.yellow === FULL_SPREAD.yellow && r.red === FULL_SPREAD.red &&
    r.other === 0 && r.count === String(LONG);

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

    async function load(startUuid, mockQuestions, latencyMs) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const html = buildPage(raw, mockQuestions, latencyMs);
        await page.route('**/*', (route) => {
            if (/^https:\/\/claude\.ai\/chat\//.test(route.request().url())) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto('https://claude.ai/chat/' + startUuid, { waitUntil: 'domcontentloaded', timeout: 120000 });
        return { context, page };
    }

    console.log('check-turn-counter — engine=' + engine + ', script=' + path.basename(scriptPath));

    // A1 — the reload case. The index answers after 3 s; Navigate opens before that.
    {
        const lat = {}; lat[CONV_B] = 3000;
        const { context, page } = await load(CONV_B, LONG, lat);
        await openNavigate(page);
        await armFirstDrawRead(page, LONG);
        const landedAtOpen = await page.evaluate('!!window.__acnConvAnswered[' + JSON.stringify(CONV_B) + ']');
        const atOpen = await page.evaluate(READ);
        const landed = await waitForCount(page, LONG, 20000);
        const first = await page.evaluate('window.__acnFirstDraw');
        await page.waitForTimeout(1500);   // the landing scan and any scan it schedules
        const r = await readStable(page, 10000, 700);
        check('A1', 'Navigate opened before the index lands shows the full 40-dot spread after it lands',
            !landedAtOpen && landed && fullSpread(r),
            'at open: index landed=' + landedAtOpen + ' dots=' + atOpen.dots + ' count=' + atOpen.count +
            ' | after: ' + fmt(r));
        check('A1f', 'the first draw that lists the 144 questions already shows 40 dots',
            !landedAtOpen && !!first && first.dots === FULL_SPREAD.dots,
            'first draw: ' + (first ? 'dots=' + first.dots : 'never seen'));
        await context.close();
    }

    // A2 — the sidebar switch: the 8-question conversation, Navigate open, then the 144-question
    // one. The mock DOM holds the short conversation's 16 rows, which are also the long one's
    // first 16, so both indexes match the mounted rows.
    {
        const lat = {}; lat[CONV_A] = 10; lat[CONV_B] = 2500;
        const { context, page } = await load(CONV_A, SHORT, lat);
        await page.waitForFunction('!!window.__acnConvAnswered[' + JSON.stringify(CONV_A) + ']', null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        await openNavigate(page);
        const before = await readStable(page, 10000, 700);
        const hooks = await page.evaluate(() => ({
            ownPushState: Object.prototype.hasOwnProperty.call(history, 'pushState'),
            ownReplaceState: Object.prototype.hasOwnProperty.call(history, 'replaceState'),
            native: history.pushState === window.__acnNativePushState,
        }));
        await armFirstDrawRead(page, LONG);
        // The switch: the prototype's pushState (no instance hook can intercept it), then one
        // throwaway node so the message observer schedules a scan. No popstate is dispatched.
        await page.evaluate((u) => {
            window.__acnNativePushState.call(history, {}, '', '/chat/' + u);
            var n = document.createElement('div');
            document.body.appendChild(n);
            n.remove();
        }, CONV_B);
        const landed = await waitForCount(page, LONG, 20000);
        const first = await page.evaluate('window.__acnFirstDraw');
        await page.waitForTimeout(1500);
        const after = await readStable(page, 10000, 700);
        const popstates = await page.evaluate('window.__acnPopstates');
        console.log('  ....  A2 context: history hook installed=' +
            (hooks.ownPushState || hooks.ownReplaceState || !hooks.native) +
            ' (own pushState=' + hooks.ownPushState + ', own replaceState=' + hooks.ownReplaceState +
            ', pushState native=' + hooks.native + '); switch via History.prototype.pushState; popstate events=' + popstates);
        check('A2', 'switch with Navigate open: no hook ran, and the dots show the new conversation\'s full count',
            before.stable === true && before.dots === SHORT && before.count === String(SHORT) &&
            !hooks.ownPushState && !hooks.ownReplaceState && hooks.native && popstates === 0 &&
            landed && after.open === true && fullSpread(after),
            'before: ' + fmt(before) + ' | after: ' + fmt(after));
        check('A2f', 'the first draw that lists the new conversation already shows 40 dots',
            !!first && first.dots === FULL_SPREAD.dots, 'first draw: ' + (first ? 'dots=' + first.dots : 'never seen'));
        // Close and reopen: the freeze also survived a reopen, since the reopen took the same
        // early return.
        await page.evaluate("document.getElementById('acn-dot-nav').click()");
        await page.waitForTimeout(400);
        await openNavigate(page);
        const reopened = await readStable(page, 10000, 700);
        check('A2b', 'after a close and reopen, still the full count', fullSpread(reopened), fmt(reopened));

        // A5 — leave for an empty page (Claude's /new) with Navigate open: the route leaves the
        // chat path, so the scan releases the index (ciInvalidate) and lists nothing. Removing the
        // mock's mounted rows stands in for the new page's empty feed, and is the mutation that
        // schedules the scan. Read at the first draw too: without the empty-list redraw, the next
        // scan's guarded redraw clears the dots ~500 ms later and hides the stale first draw.
        await armFirstDrawRead(page, 0);
        await page.evaluate(() => {
            window.__acnNativePushState.call(history, {}, '', '/new');
            var m = document.getElementById('mock-mounted');
            while (m.firstChild) m.removeChild(m.firstChild);
        });
        const emptied = await waitForCount(page, 0, 20000);
        const firstEmpty = await page.evaluate('window.__acnFirstDraw');
        await page.waitForTimeout(1500);
        const left = await readStable(page, 10000, 700);
        check('A5', 'leaving for an empty page with Navigate open clears the dots',
            reopened.dots > 0 && emptied && !!firstEmpty && firstEmpty.dots === 0 &&
            left.stable === true && left.dots === 0 && left.count === '0',
            'before: dots=' + reopened.dots + ' | first draw: ' + (firstEmpty ? 'dots=' + firstEmpty.dots : 'never seen') +
            ' | after: ' + fmt(left));
        await context.close();
    }

    // A3 — regression: a normal load, Navigate opened after the index landed.
    // A4 — regression: then, idle with Navigate open, no DOM mutation anywhere in document.body
    // (what the message observer watches) over 6 s.
    {
        const lat = {}; lat[CONV_B] = 10;
        const { context, page } = await load(CONV_B, LONG, lat);
        await page.waitForFunction('!!window.__acnConvAnswered[' + JSON.stringify(CONV_B) + ']', null, { timeout: 30000 });
        await page.waitForTimeout(2500);
        await openNavigate(page);
        const r = await readStable(page, 10000, 700);
        check('A3', 'normal load, Navigate opened after the index landed: the full 40-dot spread', fullSpread(r), fmt(r));

        await page.waitForTimeout(2000);
        const idle = await page.evaluate(() => new Promise((resolve) => {
            var records = 0, inBar = 0;
            var bar = document.querySelector('.acn-ctx');
            var mo = new MutationObserver(function (recs) {
                records += recs.length;
                for (var i = 0; i < recs.length; i++) if (bar && bar.contains(recs[i].target)) inBar++;
            });
            mo.observe(document.body, { childList: true, subtree: true, characterData: true });
            setTimeout(function () { mo.disconnect(); resolve({ records: records, inBar: inBar }); }, 6000);
        }));
        check('A4', 'idle with Navigate open: no self-sustaining mutations (0 in 6 s)',
            r.open === true && idle.records === 0,
            'records=' + idle.records + ' (in the context bar: ' + idle.inBar + ') open=' + r.open + ' vis=' + r.vis);
        await context.close();
    }

    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})();
