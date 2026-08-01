// Unit checks for _sumBuildSubSegments on segment shapes the end-to-end map harness
// cannot produce. Added 2026-08-01 after GitHub Codex found two defects that lived
// exactly there: a cutoff no 12-message segment could ever clear, and a merge tie-break
// that pooled every fragment into one growing block.
//
// Run: node probes/check-subsegments.js [--browser firefox]
// Exits non-zero on any failed expectation.

'use strict';

const fs = require('fs');
const path = require('path');
const { instrument } = require('./perf-instrument');
const { instrumentMap } = require('./map-instrument');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const CONV_UUID = '77777777-7777-4777-8777-777777777777';
const ORG = '99999999-9999-4999-8999-999999999999';

// Deterministic prose from a given word pool. Long enough to clear the tokenizer's
// stop-word filtering and produce a vocabulary worth comparing.
function msg(words, seed, type) {
    const out = [];
    for (let i = 0; i < 26; i++) out.push(words[(seed * 7 + i * 3) % words.length]);
    return { text: out.join(' ') + '.', type: type || (seed % 2 ? 'ai' : 'user') };
}
const A = 'authentication session cookie token refresh oauth credential identity provider scope grant redirect expiry login logout'.split(' ');
const B = 'postgres migration schema replica vacuum partition shard constraint sequence rollback transaction index cluster tablespace analyze'.split(' ');
const C = 'kubernetes rollout container registry ingress helm probe liveness autoscale sidecar namespace manifest daemonset taint toleration'.split(' ');
// Wider pools for the edge-valley case, whose interior boundary strength must sit
// BETWEEN the two candidate cutoffs. The 15-word pools quantize depth too coarsely to
// land there, and a check straddling its own threshold proves nothing (CLAUDE.md:
// prefer a discrete metric over one continuous near a threshold).
const P = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu anchor beacon cipher dagger'.split(' ');
const Q = 'falcon grizzly heron ibex jaguar koala lynx marmot narwhal ocelot puffin quail raven seal tapir urchin vulture walrus xerus yak zebu badger condor dingo egret ferret gibbon impala jackal kestrel'.split(' ');
const R = 'quartz basalt gneiss marble obsidian pumice shale slate granite gabbro chert flint jasper opal topaz beryl garnet zircon olivine augite biotite calcite dolomite feldspar halite ilmenite kaolin lazurite magnetite nepheline'.split(' ');

function buildPage(scriptContent) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const tiny = {
        uuid: CONV_UUID, name: 'Sub-segment unit checks',
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
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>sub-seg checks</title></head><body>
<script>window.__MOCK_CONFIG = {"totalMessages":2};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var PAYLOAD = ${JSON.stringify(tiny)};
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) { setTimeout(function () {
            if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
            else if (opts.onerror) opts.onerror({ status: status }); }, 10); }
        if (/\\/api\\/organizations$/.test(url)) { respond(200, JSON.stringify([{ uuid: ${JSON.stringify(ORG)}, name: 'Fixture Org', capabilities: ['chat'] }])); return; }
        if (url.indexOf('/chat_conversations/') !== -1) { respond(200, JSON.stringify(PAYLOAD)); return; }
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

(async () => {
    const engine = (process.argv.indexOf('--browser') !== -1
        ? process.argv[process.argv.indexOf('--browser') + 1] : 'firefox');
    const raw = fs.readFileSync(process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js'), 'utf8');
    const probeScript = instrumentMap(instrument(raw, 'unit1'));
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const targetURL = `https://claude.ai/chat/${CONV_UUID}`;
    const html = buildPage(probeScript);
    await page.route('**/*', (route) => {
        const u = route.request().url();
        if (u === targetURL || u === targetURL + '/') route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
        else route.abort();
    });
    await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('typeof window.__acnSubSegRun === "function"', null, { timeout: 30000 });

    const run = async (msgs) => JSON.parse(await page.evaluate(
        (j) => window.__acnSubSegRun(j), JSON.stringify(msgs)));

    let failures = 0;
    const check = (name, ok, detail) => {
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
        if (!ok) failures++;
    };

    console.log(`\n=== _sumBuildSubSegments unit checks (${engine}) ===`);

    // 1. The SMALLEST segment the function accepts — 2*max(BLOCK, MIN_RUN) = 12 —
    //    split cleanly down the middle. This is precisely the case Codex proved
    //    impossible under the old mean + 2.5*sd cutoff (7 gaps cap the achievable
    //    standardized distance at sqrt(6) ≈ 2.449), and then proved excluded again by
    //    an over-strict derived guard. If the entry condition and the cutoff ever
    //    disagree once more, this check is what says so.
    const smallest = [];
    for (let i = 0; i < 6; i++) smallest.push(msg(A, i));
    for (let i = 0; i < 6; i++) smallest.push(msg(B, i + 40));
    const r1 = await run(smallest);
    check('smallest accepted segment (12) with two disjoint halves splits at 6',
        r1.length === 2 && r1[0].n === 6 && r1[1].n === 6,
        r1.length ? r1.map(s => `${s.n}@${s.startIdx}`).join(' ') : 'no cuts');

    // 1b. One message below the accepted size must be refused, not half-handled.
    const tooSmall = smallest.slice(0, 11);
    const r1b = await run(tooSmall);
    check('one message below the accepted size yields no sub-segments', r1b.length === 0,
        `${r1b.length} sub-segments`);

    // 2. Many mutually disjoint runs must not pool into one oversized block.
    //    Codex: a `prevOv >= nextOv` tie-break sent every fragment into the same
    //    growing neighbour — twenty fragments collapsing to [54, 3, 3].
    const pools = [];
    const vocabs = [A, B, C];
    for (let blk = 0; blk < 10; blk++) {
        for (let i = 0; i < 6; i++) pools.push(msg(vocabs[blk % 3], blk * 13 + i));
    }
    const r2 = await run(pools);
    const sizes = r2.map(s => s.n);
    const biggest = Math.max.apply(null, sizes.concat([0]));
    check('60 messages in disjoint runs do not pool into one oversized row',
        r2.length > 1 && biggest <= pools.length / 2,
        `sizes [${sizes.join(', ')}]`);

    // 2b. A strong drop too close to the edge to be SELECTABLE must not set the bar
    //     for the boundaries that are. Codex: maxDepth was taken over every gap
    //     including those the MIN_RUN filter later discards, so a short opening aside
    //     could inflate the cutoff above every valid interior boundary and the segment
    //     came back with no sub-segments at all.
    // Four opening messages on an unrelated topic put the DEEPEST valley at gap 4,
    // which MIN_RUN makes unselectable; the real boundary at 17 is a gentler shift.
    // An edge valley is one-sided, so its depth is roughly the drop itself while an
    // interior valley's is twice the drop — suppression therefore needs an interior
    // boundary weaker than half the edge's, which is exactly a mild topic transition
    // after an unrelated opening exchange. Measured depths for this exact input:
    // gap 4 = 1.000 (unselectable), gap 17 = 0.367. A bar taken over ALL gaps is 0.500
    // and loses the real boundary; over SELECTABLE gaps it is 0.183 and finds it. Both
    // margins are wide, so this check does not sit on its own threshold.
    const edge = [];
    for (let i = 0; i < 4; i++)  edge.push(msg(R, i));            // ineligible: pos 4 < MIN_RUN
    for (let i = 0; i < 13; i++) edge.push(msg(P, i + 10));
    for (let i = 0; i < 13; i++) edge.push(msg(P.slice(0, 22).concat(Q.slice(0, 8)), i + 30));
    const r2b = await run(edge);
    check('an unselectable edge valley does not suppress a valid interior boundary',
        r2b.length >= 2 && r2b.some(x => Math.abs(x.startIdx - 17) <= 2),
        r2b.length ? r2b.map(s => `${s.n}@${s.startIdx}`).join(' ') : 'no cuts');

    // 3. A uniform conversation has no topic changes — finding none is correct.
    const uniform = [];
    for (let i = 0; i < 40; i++) uniform.push(msg(A, i));
    const r3 = await run(uniform);
    check('uniform conversation yields no sub-segments', r3.length === 0,
        `${r3.length} sub-segments`);

    // 4. A brief aside must not cut the run around it (the owner's "come back" case).
    const aside = [];
    for (let i = 0; i < 12; i++) aside.push(msg(A, i));
    aside.push(msg(C, 99));                       // one off-topic message
    for (let i = 0; i < 12; i++) aside.push(msg(A, i + 12));
    const r4 = await run(aside);
    check('a one-message aside does not split a coherent run', r4.length === 0,
        r4.length ? r4.map(s => `${s.n}@${s.startIdx}`).join(' ') : 'no cuts');

    await context.close();
    await browser.close();
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
    process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
