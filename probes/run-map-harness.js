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
//                                  [--save fp.json] [--baseline fp.json] [--partial]
//   --baseline exits non-zero on ANY fingerprint difference, on a build that
//   disagrees with ITSELF across repeats, and on any baseline configuration the
//   sweep did not exercise. --partial acknowledges that last case (for iterating
//   on one config) — it never suppresses a real difference.

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
    return {
        msgs,
        topicBoundaries: conv.topicBoundaries,
        stats: { messages: msgs.length, chars, distinctWords: words.size,
                 topicBlocks: conv.stats.topicBlocks },
    };
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

// Scores DETECTED boundaries against the payload's KNOWN topic changes, so a
// segmentation threshold is chosen on evidence instead of on which histogram
// looks tidier. A detected boundary counts as a hit if it lands within TOL
// messages of a true one (the segmenter needs a message or two of divergent
// vocabulary before it can react, so exact-index matching would understate a
// correct segmenter).
//
// Scope, and it is a real limit: this scores against a SYNTHETIC generator whose
// topic blocks are lexically disjoint by construction. Real conversations drift,
// revisit and interleave, so a good score here means "the mechanism works", not
// "this threshold is right for the owner's conversation" — that stays a live check.
function scoreBoundaries(detected, truth, tol) {
    const unmatched = truth.slice();
    let hits = 0;
    detected.forEach((d) => {
        const i = unmatched.findIndex((t) => Math.abs(t - d) <= tol);
        if (i !== -1) { hits++; unmatched.splice(i, 1); }
    });
    return { hits, missed: unmatched.length, spurious: detected.length - hits,
             truth: truth.length, detected: detected.length };
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
    const allowPartial = process.argv.includes('--partial');
    const baseline = baselinePath ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;

    fs.mkdirSync(OUTDIR, { recursive: true });
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    console.log(`userscript under measurement: ${scriptPath}`);
    const raw = fs.readFileSync(scriptPath, 'utf8');
    const probeScript = instrumentMap(instrument(raw, 'map1'));

    const fingerprints = {};
    const records = [];
    // Two distinct failure classes, kept apart because they mean different things:
    // repeatMismatches = the SAME build disagreed with itself across repeats (the
    // measurement is unusable, and a --save from such a run must not be written);
    // baselineMismatches = this build differs from the recorded one (the equivalence
    // verdict). Either one exits non-zero — the exit used to live inside the
    // --baseline block, so a nondeterministic --save run reported it and exited 0 (Codex).
    let repeatMismatches = 0;
    let baselineMismatches = 0;

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
                    const { msgs, stats, topicBoundaries } = buildTimeline(q, seed, vocab, para);
                    const key = `${engine}/q=${q}/para=${para}/vocab=${vocab}`;
                    const runs = [];
                    let fp = null;
                    for (let r = 0; r < repeat; r++) {
                        const out = JSON.parse(await page.evaluate(
                            (json) => window.__acnMapRun(json), JSON.stringify(msgs)));
                        const thisFp = JSON.stringify(out.map);
                        if (fp === null) fp = thisFp;
                        else if (fp !== thisFp) { console.log(`  !! ${key}: map differs BETWEEN REPEATS`); repeatMismatches++; }
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
                    // Sub-segment SHAPE, not just count: the 2026-08-01 defect was
                    // 90-of-92 children at exactly the absorb pass's 3-message minimum,
                    // which a total would have hidden completely (92 children of 3 and 92
                    // of varied size print the same number).
                    const segsFp = JSON.parse(fp);
                    const subSizes = {};
                    let subTotal = 0;
                    segsFp.forEach((s) => s.children.forEach((c) => {
                        subSizes[c.n] = (subSizes[c.n] || 0) + 1; subTotal++;
                    }));
                    const subKeys = Object.keys(subSizes).map(Number).sort((a, b) => a - b);
                    // Every boundary the map draws, at BOTH levels: a segment start and
                    // every child start (except the very first, which is not a decision).
                    const detected = [];
                    segsFp.forEach((s, si) => {
                        if (si > 0) detected.push(s.startIdx);
                        s.children.forEach((c, ci) => { if (ci > 0) detected.push(c.startIdx); });
                    });
                    detected.sort((a, b) => a - b);
                    const score = scoreBoundaries(detected, topicBoundaries, 2);
                    const rec = {
                        engine, q, para, vocab, payload: stats,
                        subSegments: subTotal,
                        subSizeHistogram: subSizes,
                        segmentSizes: segsFp.map((s) => s.msgIdx.length),
                        boundaryScore: score,
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
                        `mergeExcess ${rec.mergeExcessMs}ms)\n` +
                        `      segment sizes [${rec.segmentSizes.join(', ')}]; ` +
                        `${subTotal} sub-segments, sizes ` +
                        (subTotal ? subKeys.map((k) => `${k}x${subSizes[k]}`).join(' ') : '(none)') + '\n' +
                        `      boundaries: ${score.hits}/${score.truth} true topic changes found ` +
                        `(+-2 msgs), ${score.spurious} spurious of ${score.detected} drawn`);
                    if (baseline) {
                        // A requested config the baseline never covered was never
                        // compared — counting it clean would let a narrower baseline
                        // (e.g. chromium-only) false-pass the gate for every config it
                        // omits (Codex). An uncompared config is a gate failure.
                        if (!(key in baseline)) {
                            baselineMismatches++;
                            console.log(`      !! baseline has NO ENTRY for ${key} — not compared`);
                        }
                        else if (baseline[key] !== fp) {
                            baselineMismatches++;
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
        if (repeatMismatches) {
            // A fingerprint file from a run that disagreed with ITSELF would become the
            // reference every later change is judged against — refuse to write it.
            console.log(`\nNOT writing ${savePath} — ${repeatMismatches} configuration(s) ` +
                        `produced different maps across repeats; that is not a baseline.`);
        } else {
            fs.writeFileSync(savePath, JSON.stringify(fingerprints, null, 2));
            console.log(`\nFingerprints: ${savePath}`);
        }
    }
    const outPath = path.join(OUTDIR, `map-${process.env.RUN_TAG || 'run'}.json`);
    fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
    console.log(`Full records: ${outPath}`);
    if (repeatMismatches) {
        console.log(`\nDETERMINISM: ${repeatMismatches} configuration(s) differed between repeats.`);
    }
    let uncovered = [];
    if (baseline) {
        // Coverage is half of the verdict. A sweep NARROWER than the baseline
        // compares only what it ran, so "every fingerprint identical to baseline"
        // would be true of a chromium-only run against a chromium+firefox baseline
        // — an equivalence claim covering configurations that were never exercised
        // (Codex). Narrow sweeps are legitimate while iterating (that is how a
        // single mutant gets checked), so they are allowed, but only with --partial
        // saying so out loud; otherwise missing coverage fails like a mismatch.
        uncovered = Object.keys(baseline).filter((k) => !(k in fingerprints));
        const total = Object.keys(baseline).length;
        const scope = `${total - uncovered.length}/${total} baseline configurations exercised`;
        if (uncovered.length) {
            console.log(`\nCOVERAGE: ${scope}; NOT run: ${uncovered.join(', ')}`);
        }
        console.log(baselineMismatches === 0
            ? `\nEQUIVALENCE${uncovered.length ? ' (PARTIAL)' : ''}: every fingerprint ` +
              `exercised is identical to baseline — ${scope}.`
            : `\nEQUIVALENCE: ${baselineMismatches} mismatch(es) — ${scope}.`);
        if (uncovered.length && allowPartial) {
            console.log('(--partial: the uncovered configurations are acknowledged, not verified.)');
        }
    }
    if (repeatMismatches || baselineMismatches || (uncovered.length && !allowPartial)) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
