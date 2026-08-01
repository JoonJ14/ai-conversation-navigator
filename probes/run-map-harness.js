// Conversation-map probe — direct driver, SYNTHETIC context.
//
// Drives the REAL _sumBuildConversationMap over a supplied message timeline
// (probes/map-instrument.js replaces the timeline SOURCE only) and reports, per
// configuration: initial segment count, sub-segment rebuilds, topic extractions
// and the characters they tokenize, and the map's wall time. Also emits a
// STRUCTURAL FINGERPRINT of every map (labels + indices + membership) so two
// builds can be compared byte-for-byte — the equivalence gate for any change to
// the segmentation/merge code.
//
// CONTEXT of every number this produces (record it with the finding):
// Playwright <engine> on this machine, page realm (no Tampermonkey sandbox),
// synthetic payload, element:null messages (entity scanning returns [] — the
// unmounted shape). The decision-grade context stays the owner's Firefox +
// Tampermonkey visible tab on the real conversation (probes/README.md Path A).
//
// Usage:
//   node probes/run-map-harness.js [--browser chromium,firefox] [--sizes 147]
//                                  [--vocab 1,2,4,8] [--repeat 3]
//                                  [--save fp.json] [--baseline fp.json]
//   --baseline exits non-zero on ANY fingerprint difference (equivalence gate).

'use strict';

const fs = require('fs');
const path = require('path');
const { instrument } = require('./perf-instrument');
const { instrumentMap } = require('./map-instrument');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const OUTDIR = path.join(__dirname, 'results');
const CONV_UUID = '77777777-7777-4777-8777-777777777777';
const ORG = '99999999-9999-4999-8999-999999999999';

function parseArg(name, dflt) {
    const i = process.argv.indexOf('--' + name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

// A payload is built per VOCAB_MULT value, and perf-payload.js reads that knob
// at require() time — so each value needs a fresh module instance.
function buildTimeline(q, seed, vocabMult, paraBoost) {
    const prevV = process.env.VOCAB_MULT, prevP = process.env.PARA_BOOST;
    process.env.VOCAB_MULT = String(vocabMult);
    process.env.PARA_BOOST = String(paraBoost);
    delete require.cache[require.resolve('./perf-payload')];
    const { buildConversation } = require('./perf-payload');
    const conv = buildConversation(q, seed, CONV_UUID);
    if (prevV === undefined) delete process.env.VOCAB_MULT; else process.env.VOCAB_MULT = prevV;
    if (prevP === undefined) delete process.env.PARA_BOOST; else process.env.PARA_BOOST = prevP;

    const msgs = conv.payload.chat_messages.map((m) => ({
        text: (m.content && m.content[0] && m.content[0].text) || '',
        type: m.sender === 'human' ? 'user' : 'ai',
    }));
    const words = new Set();
    let chars = 0;
    msgs.forEach((m) => {
        chars += m.text.length;
        m.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
            .forEach((w) => { if (w.length > 2) words.add(w); });
    });
    return { msgs, stats: { messages: msgs.length, chars, distinctWords: words.size } };
}

// Minimal page: the mock body (so the userscript detects claude.ai and reaches
// its init anchor) plus a GM shim serving a TINY conversation, so the index
// settles instead of retrying in the background while the map is being timed.
// No download shim and no payload service — the map driver supplies its own
// messages and nothing is exported here.
function buildPage(scriptContent) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : mockHTML;
    const tiny = {
        uuid: CONV_UUID,
        name: 'Map probe',
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
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ACN Map Probe</title></head>
<body>
<script>window.__MOCK_CONFIG = ${JSON.stringify({ totalMessages: 2 })};</script>
${bodyContent}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var ORG = ${JSON.stringify(ORG)};
    var PAYLOAD = ${JSON.stringify(tiny)};
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, 10);
        }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ORG, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        if (url.indexOf('/chat_conversations/') !== -1) { respond(200, JSON.stringify(PAYLOAD)); return; }
        respond(404, '');
    };
    var _store = {};
    window.GM_getValue = function (k, d) { return _store.hasOwnProperty(k) ? _store[k] : d; };
    window.GM_setValue = function (k, v) { _store[k] = v; };
    try { document.cookie = 'lastActiveOrg=' + ORG + '; path=/'; } catch (e) {}
}());
</script>
<script>
${scriptContent}
</script>
</body>
</html>`;
}

function n(calls, key, field) {
    return calls[key] ? calls[key][field] : 0;
}

(async () => {
    const browsers = parseArg('browser', 'chromium').split(',');
    const sizes = parseArg('sizes', '147').split(',').map(Number);
    const vocabs = parseArg('vocab', '1,4').split(',').map(Number);
    const paras = parseArg('para', '1').split(',').map(Number);
    const repeat = +parseArg('repeat', '3');
    const seed = 20260730;
    const savePath = parseArg('save', null);
    const baselinePath = parseArg('baseline', null);
    const baseline = baselinePath ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;

    fs.mkdirSync(OUTDIR, { recursive: true });
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    console.log(`userscript under measurement: ${scriptPath}`);
    const raw = fs.readFileSync(scriptPath, 'utf8');
    const probeScript = instrumentMap(instrument(raw, 'map1'));

    const fingerprints = {};
    const records = [];
    let mismatches = 0;

    for (const engine of browsers) {
        const launchArgs = engine === 'chromium'
            ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            : [];
        const browser = await playwright[engine].launch({ headless: process.env.HEADED !== '1', args: launchArgs });
        console.log(`\n=== ${engine} ${browser.version()} (page realm) ===`);
        const context = await browser.newContext();
        const page = await context.newPage();
        const targetURL = `https://claude.ai/chat/${CONV_UUID}`;
        const html = buildPage(probeScript);
        await page.route('**/*', (route) => {
            const url = route.request().url();
            if (url === targetURL || url === targetURL + '/') {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else { route.abort(); }
        });
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction('typeof window.__acnMapRun === "function"', null, { timeout: 30000 });

        for (const q of sizes) {
            for (const para of paras) {
                for (const vocab of vocabs) {
                    const { msgs, stats } = buildTimeline(q, seed, vocab, para);
                    const key = `${engine}/q=${q}/para=${para}/vocab=${vocab}`;
                    const runs = [];
                    let fp = null;
                    for (let r = 0; r < repeat; r++) {
                        const out = JSON.parse(await page.evaluate(
                            (json) => window.__acnMapRun(json), JSON.stringify(msgs)));
                        const thisFp = JSON.stringify(out.map);
                        if (fp === null) fp = thisFp;
                        else if (fp !== thisFp) { console.log(`  !! ${key}: map differs BETWEEN REPEATS`); mismatches++; }
                        runs.push(out);
                    }
                    const c = runs[0].calls;
                    const segs = n(c, 'map.entities', 'n');          // one scanEntities per committed segment
                    const subs = n(c, 'map.subSegments', 'n');
                    const finals = JSON.parse(fp).length;
                    // Which construction model the rebuild count matches.
                    // "eager": children built at every commit AND every merge —
                    //   subs = commits + merges = 2*initial - final. This is the
                    //   identity the live 431 was read through (=> ~218 initial).
                    // "deferred": children attached once per surviving segment
                    //   (v12.5, DEC-039) — subs = final.
                    // When NOTHING merged (initial === final) both formulas reduce to
                    // the same number and the count cannot tell the models apart —
                    // saying "eager" there would misreport a deferred build (Codex).
                    const eager = subs === segs + (segs - finals);
                    const deferred = subs === finals;
                    const model = eager && deferred ? 'either — no merges, formulas coincide'
                                : eager ? 'eager' : deferred ? 'deferred' : 'UNKNOWN';
                    const rec = {
                        engine, q, para, vocab, payload: stats,
                        ms: runs.map((r) => +r.ms.toFixed(1)),
                        segmentsInitial: segs, segmentsFinal: finals,
                        subSegmentCalls: subs,
                        topicsCalls: n(c, 'map.topicsFromText', 'n'),
                        topicsChars: n(c, 'map.topicsFromText', 'units'),
                        tokenizeCalls: n(c, 'inner.tokenize', 'n'),
                        tokenizeChars: n(c, 'inner.tokenize', 'units'),
                        mergeExcessMs: +n(c, 'map.mergeExcess', 'ms').toFixed(1),
                        subSegmentsMs: +n(c, 'map.subSegments', 'ms').toFixed(1),
                        model,
                    };
                    records.push(rec);
                    fingerprints[key] = fp;
                    console.log(
                        `  ${key}: ${Math.round(stats.chars / 1024)}KB, ${stats.distinctWords} distinct words\n` +
                        `      segments ${segs} -> ${finals} (${(segs / stats.messages).toFixed(2)} per msg), ` +
                        `subSegment rebuilds ${subs} [${rec.model}]\n` +
                        `      topicsFromText ${rec.topicsCalls}x over ${(rec.topicsChars / 1e6).toFixed(1)}M chars, ` +
                        `tokenize ${rec.tokenizeCalls}x over ${(rec.tokenizeChars / 1e6).toFixed(1)}M chars\n` +
                        `      map ${rec.ms.join(' / ')} ms  (subSegments ${rec.subSegmentsMs}ms, ` +
                        `mergeExcess ${rec.mergeExcessMs}ms)`);
                    if (baseline) {
                        // A requested config the baseline never covered was never
                        // compared — counting it clean would let a narrower baseline
                        // (e.g. chromium-only) false-pass the gate for every config it
                        // omits (Codex). An uncompared config is a gate failure.
                        if (!(key in baseline)) {
                            mismatches++;
                            console.log(`      !! baseline has NO ENTRY for ${key} — not compared`);
                        }
                        else if (baseline[key] !== fp) {
                            mismatches++;
                            console.log(`      !! FINGERPRINT MISMATCH vs baseline`);
                            const a = JSON.parse(baseline[key]), b = JSON.parse(fp);
                            if (a.length !== b.length) console.log(`         segment count ${a.length} -> ${b.length}`);
                            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                                if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
                                    console.log(`         first differing segment #${i}:`);
                                    console.log(`           baseline: ${JSON.stringify(a[i]).slice(0, 300)}`);
                                    console.log(`           current : ${JSON.stringify(b[i]).slice(0, 300)}`);
                                    break;
                                }
                            }
                        } else console.log(`      fingerprint identical to baseline`);
                    }
                }
            }
        }
        await context.close();
        await browser.close();
    }

    if (savePath) {
        fs.writeFileSync(savePath, JSON.stringify(fingerprints, null, 2));
        console.log(`\nFingerprints: ${savePath}`);
    }
    const outPath = path.join(OUTDIR, `map-${process.env.RUN_TAG || 'run'}.json`);
    fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
    console.log(`Full records: ${outPath}`);
    if (baseline) {
        console.log(mismatches === 0
            ? '\nEQUIVALENCE: every fingerprint identical to baseline.'
            : `\nEQUIVALENCE: ${mismatches} mismatch(es).`);
        if (mismatches) process.exit(1);
    }
})().catch((e) => { console.error(e); process.exit(1); });
