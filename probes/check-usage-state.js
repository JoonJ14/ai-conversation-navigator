// Unit checks for the Plan usage panel's THREE states — loading, unavailable, and
// rendered. Added 2026-08-05 for the usageUnavailable bug (ROADMAP 0c, raised by
// GitHub Codex on PR #72).
//
// Run: node probes/check-usage-state.js [--browser firefox] [--quiet]
// Exits non-zero on any failed expectation.
//
// THE BUG THIS GATES. renderUsageBars received `null` for two unrelated reasons —
// "no fetch has finished yet" and "a fetch finished and produced nothing" — and
// rendered planUsageLoading for both. The second never resolved, so a failed usage
// request left the panel reading "Plan usage loading…" forever, in BOTH languages,
// while `usageUnavailable` sat in both string tables with no call site.
//
// WHY THIS IS A PROBE AND NOT A PLAYWRIGHT SUITE CASE: the failure is a network
// state, not a DOM shape. Every mock page in tests/ mounts a static document; none
// can express "the usage request errored" versus "the usage request has not come
// back". This probe controls the transport directly, which is the only way to put
// the code in each of the three states on purpose.
//
// WHY U4 EXISTS. Without it this file would pass on a build that simply swapped one
// hardcoded string for another. U4 holds the request open and never answers it, so a
// build that reports failure whenever data is missing shows "Usage data unavailable"
// while a request is genuinely in flight, and U4's TEXT assertion catches it. The fix
// under test is that the two states are DISTINGUISHED, not that the message changed.
//
// Scope of each check, measured 2026-08-05 on chromium. Stated explicitly because
// "6 checks failed" would otherwise read as six independent reproductions:
//   - U1/U2/U6 fail on the pre-fix build for the RIGHT reason: it renders the loading
//     string after a failed fetch, in both languages. These are the bug.
//   - U4 fails on it too, but only because that build has no data-acn-usage-state
//     attribute at all. U4's discriminating power is against FUTURE over-eager fixes.
//   - U8 gates the per-request generation token: removing only that makes it fail.
//   - NOTHING here gates the repaint-on-fetch-start. Removing only that passes all 8.
//     An earlier note claimed U7 covered it, on the strength of a run where the
//     no-repaint mutant failed U7 — but U7 was racy then, and its race produced the
//     same symptom as the mutant. With the race fixed, the mutant passes. The repaint
//     rests on reading orbPopulateNavigate's early return, not on a check here.
//
// CONTEXT of these results (record it with the finding): Playwright <engine> on this
// machine, page realm, the REAL shipped renderUsageBars / maybeRefreshUsage /
// fetchClaudeUsage reached by opening the Navigate panel — no instrumentation hook.
// The assertions read the DOM the user sees. Not the Tampermonkey sandbox; this path
// is GM_xmlhttpRequest + DOM writes, with no cross-compartment surface (cf. DEC-019).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const CONV_UUID = '77777777-7777-4777-8777-777777777777';
const ORG = '99999999-9999-4999-8999-999999999999';

const EN_UNAVAILABLE = 'Usage data unavailable';
const EN_LOADING     = 'Plan usage loading…';
// Same escape convention as the I18N table, so this file is comparable to it by eye.
const KO_UNAVAILABLE = '사용량 데이터를 불러올 수 없습니다';

// usageMode: 'ok' | 'error' | 'hang'   — 'hang' never calls back at all.
function buildPage(scriptContent, usageMode, lang, respScript) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const conv = {
        uuid: CONV_UUID, name: 'Usage state checks',
        current_leaf_message_uuid: 'aaaaaaaa-0000-4000-8000-000000000001',
        chat_messages: [
            { uuid: 'aaaaaaaa-0000-4000-8000-000000000000', parent_message_uuid: '00000000-0000-4000-8000-000000000000',
              index: 0, sender: 'human', text: '', created_at: '2026-07-01T00:00:00Z', attachments: [], files: [],
              content: [{ type: 'text', text: 'Probe question one.' }] },
            { uuid: 'aaaaaaaa-0000-4000-8000-000000000001', parent_message_uuid: 'aaaaaaaa-0000-4000-8000-000000000000',
              index: 1, sender: 'assistant', text: '', stop_reason: 'end_turn', created_at: '2026-07-01T00:00:00Z',
              attachments: [], files: [], content: [{ type: 'text', text: 'Probe answer one.' }] },
        ],
    };
    const usageBody = {
        five_hour:        { utilization: 42, resets_at: '2030-01-01T00:00:00Z' },
        seven_day:        { utilization: 17, resets_at: '2030-01-02T00:00:00Z' },
        seven_day_sonnet: { utilization: 3,  resets_at: '2030-01-03T00:00:00Z' },
    };

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>usage state checks</title></head><body>
<script>window.__MOCK_CONFIG = {"totalMessages":2};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var CONV  = ${JSON.stringify(conv)};
    var USAGE = ${JSON.stringify(usageBody)};
    window.__acnUsageMode = ${JSON.stringify(usageMode)};
    window.__acnUsageScript = ${JSON.stringify(respScript || null)};
    window.__acnUsageRequests = 0;
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, 10);
        }
        // Order matters: the usage URL also begins with /api/organizations.
        if (/\\/usage$/.test(url)) {
            var n = window.__acnUsageRequests++;
            // A SCRIPT, when set, gives each successive usage request its own outcome and
            // its own latency — the only way to make two requests complete OUT OF ORDER
            // on purpose (U8). Falls through to the single-mode behaviour when unset.
            var script = window.__acnUsageScript;
            if (script && script[n]) {
                var step = script[n];
                if (step.mode === 'hang') return;
                setTimeout(function () {
                    if (step.mode === 'ok' && opts.onload) opts.onload({ status: 200, responseText: JSON.stringify(USAGE) });
                    else if (opts.onerror) opts.onerror({ status: 500 });
                }, step.delay);
                return;
            }
            var mode = window.__acnUsageMode;
            if (mode === 'ok')    { respond(200, JSON.stringify(USAGE)); return; }
            if (mode === 'error') { respond(500, ''); return; }
            return;  // 'hang' — deliberately never calls onload or onerror.
        }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ${JSON.stringify(ORG)}, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        if (url.indexOf('/chat_conversations/') !== -1) { respond(200, JSON.stringify(CONV)); return; }
        respond(404, '');
    };
    var _s = { 'acn-settings': { language: ${JSON.stringify(lang)} } };
    window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
    window.GM_setValue = function (k, v) { _s[k] = v; };
    try { document.cookie = 'lastActiveOrg=' + ${JSON.stringify(ORG)} + '; path=/'; } catch (e) {}
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

// Reads what the user would actually see in the usage section.
const READ_STATE = `(function () {
    // Reads the section the USER sees. dupes is carried as a diagnostic only: a panel
    // rebuilt while a fetch is in flight could leave an orphaned second section and
    // send the callback's write somewhere invisible. Measured as 1 throughout, so it
    // is reported rather than worked around. (No backticks in this string — it is a
    // template literal, and a stray one silently terminates it. Bitten twice now.)
    var all = document.querySelectorAll('#acn-usage-section');
    var sec = document.getElementById('acn-usage-section');
    if (!sec) return { section: false, dupes: all.length };
    var ph = sec.querySelector('[data-acn-usage-state]');
    return {
        section: true,
        dupes:   all.length,
        state:   ph ? ph.getAttribute('data-acn-usage-state') : null,
        text:    ph ? ph.textContent : null,
        // Count REAL bars separately from the title. Counting them together let a
        // response that rendered only the heading and no bar satisfy "bars > 0"
        // (Codex Tier 3).
        bars:    sec.querySelectorAll('.acn-usage-bar').length,
        titles:  sec.querySelectorAll('.acn-usage-title').length,
        empty:   sec.children.length === 0,
        // Text regardless of the attribute, so a failure message stays informative on
        // a build that predates data-acn-usage-state (the mutation test runs one).
        anyText: sec.children.length ? sec.children[0].textContent : null,
        requests: window.__acnUsageRequests,
        html:    sec.innerHTML.slice(0, 240)
    };
}())`;

// The Navigate panel re-renders on MutationObserver cycles, so the usage section is
// briefly EMPTY between a rebuild and the repopulate that fills it. A fixed sleep
// therefore samples a transient state, and the first draft of this probe was flaky
// because of exactly that: the same scenario passed one run and failed the next with
// nothing changed — the trap CLAUDE.md records as "a single run is not a measurement".
//
// So read repeatedly and accept only a STABLE state: two consecutive non-empty reads
// that agree, at least stableMs apart.
//
// On timeout it returns the last read with stable:false rather than throwing, so the
// failure message shows what was actually on screen. That marker is LOAD-BEARING and
// every assertion requires it: without it, a never-settling UI could pass whenever its
// final transient sample happened to look right, which is a vacuous pass (Codex Tier 3).
async function readStable(page, timeoutMs, stableMs) {
    const deadline = Date.now() + (timeoutMs || 15000);
    const gap = stableMs || 250;
    let prev = null, last = null;
    while (Date.now() < deadline) {
        const cur = await page.evaluate(READ_STATE);
        last = cur;
        if (cur.section && !cur.empty && prev &&
            prev.state === cur.state && prev.text === cur.text && prev.bars === cur.bars) {
            cur.stable = true;
            return cur;
        }
        prev = (cur.section && !cur.empty) ? cur : null;
        await page.waitForTimeout(gap);
    }
    if (last) last.stable = false;
    return last || { section: false, stable: false };
}

async function openNavigate(page) {
    // Drive the real UI: opening Navigate populates the panel, which is what calls
    // maybeRefreshUsage(). No instrumentation hook — the assertions read the user's DOM.
    await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
    await page.evaluate("document.getElementById('acn-dot-nav').click()");
    await page.waitForFunction("!!document.getElementById('acn-usage-section')", null, { timeout: 30000 });
}

(async () => {
    const engine = (process.argv.indexOf('--browser') !== -1
        ? process.argv[process.argv.indexOf('--browser') + 1] : 'firefox');
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

    async function scenario(usageMode, lang) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const targetURL = `https://claude.ai/chat/${CONV_UUID}`;
        const html = buildPage(raw, usageMode, lang);
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u === targetURL || u === targetURL + '/') {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await openNavigate(page);
        const out = await readStable(page, 15000, 250);
        await context.close();
        return out;
    }

    // Loads with the usage endpoint FAILING, confirms the unavailable state, then flips
    // the endpoint to hang and forces a refetch with a route change (ciInvalidate zeroes
    // the usage cooldown, which is the only way past the five-minute poll interval
    // without faking the clock). Returns the state once the retry is in flight.
    async function retryScenario() {
        const context = await browser.newContext();
        const page = await context.newPage();
        const targetURL = `https://claude.ai/chat/${CONV_UUID}`;
        const otherURL  = `https://claude.ai/chat/88888888-8888-4888-8888-888888888888`;
        const html = buildPage(raw, 'error', 'en');
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u === targetURL || u === targetURL + '/' || u === otherURL) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await openNavigate(page);
        const failed = await readStable(page, 15000, 250);
        if (!(failed.state === 'unavailable')) {
            return { section: failed.section, stable: false, dupes: failed.dupes,
                     state: failed.state, text: failed.text, note: 'precondition not met' };
        }
        // Flip the transport, then change route so the cooldown is invalidated.
        await page.evaluate("window.__acnUsageMode = 'hang'");
        const before = await page.evaluate('window.__acnUsageRequests');
        await page.evaluate(`history.pushState({}, '', ${JSON.stringify(otherURL)});
                             window.dispatchEvent(new Event('popstate'));`);
        await page.waitForTimeout(300);
        await page.evaluate("var d=document.getElementById('acn-dot-nav'); if(d) d.click();");
        // Wait for the RETRY to actually be issued rather than for a duration. Under load
        // a fixed sleep let readStable settle on the still-correct OLD 'unavailable' state
        // before the retry had started — a stable read of the wrong moment, which failed
        // about 1 run in 13 and only when other probes were running concurrently.
        await page.waitForFunction('window.__acnUsageRequests > ' + before, null, { timeout: 30000 });
        return await readStable(page, 15000, 250);
    }

    // Two usage requests for the SAME org, overlapping, completing OUT OF ORDER: the
    // first is slow and fails, the second is fast and succeeds. The stale-response guard
    // inside fetchClaudeUsage keys on the org uuid, which is identical here, so it cannot
    // separate them — without a per-request generation the late failure lands last and
    // erases the good data (Codex Tier 3 WARN). Ends with bars if the guard works.
    async function outOfOrderScenario() {
        const context = await browser.newContext();
        const page = await context.newPage();
        const targetURL = `https://claude.ai/chat/${CONV_UUID}`;
        const otherURL  = `https://claude.ai/chat/88888888-8888-4888-8888-888888888888`;
        // Request #0: slow FAILURE. Request #1: fast SUCCESS. So #1 lands first.
        const html = buildPage(raw, 'ok', 'en',
            [{ mode: 'error', delay: 1500 }, { mode: 'ok', delay: 10 }]);
        await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u === targetURL || u === targetURL + '/' || u === otherURL) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await openNavigate(page);
        // Wait for request #0 to actually be IN FLIGHT before disturbing anything.
        // Route-changing earlier raced initialisation and the usage flow never started
        // at all (requests stayed 0), which read as a failure of the code under test
        // rather than of the scenario.
        await page.waitForFunction('window.__acnUsageRequests >= 1', null, { timeout: 30000 });
        // Let initialisation finish before disturbing the route. Without this the
        // popstate lands mid-init and no second fetch is ever issued.
        await page.waitForTimeout(900);
        // Route change zeroes the usage cooldown (ciInvalidate), starting request #1
        // while #0 is still outstanding.
        await page.evaluate(`history.pushState({}, '', ${JSON.stringify(otherURL)});
                             window.dispatchEvent(new Event('popstate'));`);
        await page.waitForTimeout(300);
        await page.evaluate("var d=document.getElementById('acn-dot-nav'); if(d) d.click();");
        await page.waitForFunction('window.__acnUsageRequests >= 2', null, { timeout: 20000 });
        // Past the slow failure's landing time, so a build without the generation guard
        // has every chance to clobber the good data before we look.
        await page.waitForTimeout(2000);
        const out = await readStable(page, 15000, 250);
        out.requests = await page.evaluate('window.__acnUsageRequests');
        await context.close();
        return out;
    }

    console.log('check-usage-state — engine=' + engine + ', script=' + path.basename(scriptPath));

    // Every assertion below is conjoined with sound(): a read that never settled, or a
    // page carrying a duplicate usage section, cannot satisfy any check. Without this
    // a never-stabilising UI could pass on a lucky final sample (Codex Tier 3).
    const sound = (r) => !!r && r.section === true && r.stable === true && r.dupes === 1;
    const why   = (r) => 'stable=' + (r && r.stable) + ' section=' + (r && r.section) +
                         ' dupes=' + (r && r.dupes);

    // U1 — a FAILED usage request must say unavailable, not loading.
    // This is the bug: pre-fix this rendered planUsageLoading forever.
    const u1 = await scenario('error', 'en');
    check('U1', 'failed fetch renders the UNAVAILABLE state',
        sound(u1) && u1.state === 'unavailable',
        'state=' + u1.state + ' text=' + JSON.stringify(u1.text) + ' ' + why(u1));
    check('U2', 'failed fetch shows the unavailable STRING, not the loading string',
        sound(u1) && u1.text === EN_UNAVAILABLE,
        JSON.stringify(u1.text) + ' ' + why(u1));

    // U3 — a SUCCESSFUL fetch must render real BARS (not just the heading) and no
    // placeholder at all.
    const u3 = await scenario('ok', 'en');
    check('U3', 'successful fetch renders real bars and no placeholder',
        sound(u3) && u3.state === null && u3.bars > 0 && u3.titles > 0,
        'state=' + u3.state + ' bars=' + u3.bars + ' titles=' + u3.titles + ' ' + why(u3));

    // U4 — THE GUARD AGAINST A COSMETIC FIX. The request is issued and never
    // answered, so the panel is genuinely still waiting. A build that reports
    // failure whenever data is absent fails here, which is exactly the mistake
    // an over-eager fix to U1 would make.
    const u4 = await scenario('hang', 'en');
    check('U4', 'in-flight request still says LOADING (states are distinguished)',
        sound(u4) && u4.state === 'loading' && u4.text === EN_LOADING,
        'state=' + u4.state + ' text=' + JSON.stringify(u4.text) + ' requests=' + u4.requests + ' ' + why(u4));
    check('U5', 'U4 actually issued a usage request (the check is not vacuous)',
        u4.requests > 0, 'requests=' + u4.requests);

    // U6 — the unavailable message is TRANSLATED. It is the whole reason the key
    // existed; a Korean user previously saw an English "loading" line forever.
    const u6 = await scenario('error', 'ko');
    check('U6', 'failed fetch renders the KOREAN unavailable string',
        sound(u6) && u6.state === 'unavailable' && u6.text === KO_UNAVAILABLE,
        'state=' + u6.state + ' text=' + JSON.stringify(u6.text) + ' ' + why(u6));

    // U7 — a RETRY after a failure must stop saying "unavailable" while the new
    // request is in flight. This is the WARN-2 case: setting the flag is not enough,
    // something has to repaint, and orbPopulateNavigate early-returns on an unchanged
    // question list before it ever reaches maybeRefreshUsage. Driven by reopening the
    // panel, which is the path a user actually takes after seeing the failure.
    const u7 = await retryScenario();
    check('U7', 'retry after failure ends in LOADING, not a stale "unavailable"',
        sound(u7) && u7.state === 'loading' && u7.text === EN_LOADING,
        'state=' + u7.state + ' text=' + JSON.stringify(u7.text) + ' ' + why(u7));

    // U8 — two overlapping SAME-ORG requests completing out of order. The slow first
    // request fails; the fast second succeeds. Without a per-request generation the
    // late failure lands last and wipes the good bars.
    const u8 = await outOfOrderScenario();
    check('U8', 'a superseded late FAILURE does not erase a newer success',
        sound(u8) && u8.state === null && u8.bars > 0,
        'state=' + u8.state + ' bars=' + u8.bars + ' requests=' + u8.requests + ' ' + why(u8));

    await browser.close();
    console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})();
