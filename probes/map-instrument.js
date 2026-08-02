// Adds a DIRECT DRIVER for the conversation-map builder to an already
// perf-instrumented userscript copy (perf-instrument.js must be applied first —
// this block reads its __acnPerf counters).
//
// WHY a second probe: the map is ~93% of a live generate (TROUBLESHOOTING, live
// 2026-07-31), and measuring it through the full Summary pipeline costs a page
// load, an index build and a render per data point. This driver replaces the
// timeline SOURCE only (the fixture messages are supplied by the harness) and
// then calls the REAL _sumBuildConversationMap — every segmentation, merge and
// sub-segment decision is the shipped code's.
//
// CONTEXT this probe can and cannot establish (CLAUDE.md measurement rule):
//   - CAN: segment counts, call counts, chars tokenized, wall time of the map
//     phase, and the exact structural output (labels/indices) for equivalence.
//   - CANNOT: anything element-derived. Fixture messages carry element:null, so
//     _sumScanEntities returns [] — that is the shape of every UNMOUNTED message
//     live (all but ~3), but it is not the mounted shape.
//
// NOT part of the shipped userscript. ES5 only inside the inserted block.

'use strict';

const ANCHOR = '    // ============================================================\n' +
               '    // Inject now (body is available — Tampermonkey runs at document-end)';

const BLOCK = `
    // ============================================================
    // [ACN-MAP] conversation-map direct driver — PROBE BUILD ONLY
    // ============================================================
    var __acnMapFixed = null;

    _sumBuildTimeline = (function (orig) {
        return function () {
            if (!__acnMapFixed) return orig.apply(this, arguments);
            var out = [];
            for (var i = 0; i < __acnMapFixed.length; i++) {
                out.push({
                    element: null,
                    text:    __acnMapFixed[i].text,
                    type:    __acnMapFixed[i].type,
                    pathIdx: i,
                    elKey:   '',
                    globalIdx: i
                });
            }
            return out;
        };
    }(_sumBuildTimeline));

    // Structural fingerprint of a map — everything the renderer reads, and
    // nothing that carries a DOM node. Compared byte-for-byte across builds.
    function __acnMapSerialize(map) {
        var out = [];
        for (var i = 0; i < map.length; i++) {
            var s = map[i];
            var kids = [];
            for (var c = 0; c < (s.children || []).length; c++) {
                var k = s.children[c];
                // A child's MEMBERSHIP is recorded, not just its label/range/count:
                // the renderer hands k.messages to _sumFirstJumpable, so two children
                // with the same span and size but different (or reordered) messages
                // send a click to different rows — invisible to a label+range+count
                // fingerprint (Codex).
                var kidIdx = [];
                for (var km = 0; km < k.messages.length; km++) kidIdx.push(k.messages[km].globalIdx);
                kids.push({ label: k.label, startIdx: k.startIdx, endIdx: k.endIdx,
                            n: k.messages.length, msgIdx: kidIdx });
            }
            var idxs = [];
            for (var m = 0; m < s.messages.length; m++) idxs.push(s.messages[m].globalIdx);
            out.push({
                label: s.label, startIdx: s.startIdx, endIdx: s.endIdx,
                topics: s.topics, entities: (s.entities || []).length,
                msgIdx: idxs, children: kids
            });
        }
        return out;
    }

    (function () {
        var w = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
        // Returns a JSON STRING — primitives only across the realm boundary
        // (DEC-019/020 class: never hand a sandbox object to the page realm).
        w.__acnMapRun = function (msgsJson) {
            __acnMapFixed = JSON.parse(msgsJson);
            __acnPerf.cur = { calls: {} };
            var t0 = performance.now();
            var map = _sumBuildConversationMap([], []);
            var ms = performance.now() - t0;
            var calls = __acnPerf.cur.calls;
            __acnPerf.cur = null;
            __acnMapFixed = null;
            return JSON.stringify({ ms: ms, calls: calls, map: __acnMapSerialize(map) });
        };
        // Direct access to the TOKENIZER, the input every content-derived Summary
        // feature is built on. Added 2026-08-02 for the tokenizer arc (ROADMAP 0a):
        // the claim under test is "Korean produces zero tokens", and a claim about a
        // specific function should be measured on that function rather than inferred
        // from a pipeline that has several other reasons to produce nothing.
        // Returns tokens for each supplied text, plus the shipped word-overlap score
        // between consecutive texts (the similarity every segmentation level reads).
        w.__acnTokenizeRun = function (textsJson) {
            var texts = JSON.parse(textsJson);
            var out = [];
            for (var i = 0; i < texts.length; i++) {
                var toks = _sumTokenize(texts[i]);
                var uniq = {}, u = 0, j;
                for (j = 0; j < toks.length; j++) { if (!uniq[toks[j]]) { uniq[toks[j]] = 1; u++; } }
                out.push({
                    chars: texts[i].length,
                    tokens: toks.length,
                    distinct: u,
                    sample: toks.slice(0, 12),
                    overlapWithPrev: i > 0 ? _sumWordOverlap(texts[i - 1], texts[i]) : null,
                    topics: _sumExtractTopicsFromText(texts[i], 5)
                });
            }
            return JSON.stringify(out);
        };

        // Direct access to the sub-segment builder. The map harness drives whole
        // conversations, so segment shapes it never happens to produce — a bare
        // 12-message segment, a run of mutually disjoint fragments — are unreachable
        // end to end. Both were exactly where GitHub Codex found defects (2026-08-01),
        // so the unit surface exists to make those cases checkable.
        w.__acnSubSegRun = function (msgsJson) {
            var msgs = JSON.parse(msgsJson);
            for (var i = 0; i < msgs.length; i++) {
                if (msgs[i].globalIdx === undefined) msgs[i].globalIdx = i;
            }
            var subs = _sumBuildSubSegments(msgs);
            var out = [];
            for (var s = 0; s < subs.length; s++) {
                out.push({ label: subs[s].label, startIdx: subs[s].startIdx,
                           endIdx: subs[s].endIdx, n: subs[s].messages.length });
            }
            return JSON.stringify(out);
        };

        try {
            console.log('[ACN-MAP] map driver over ACN v' + ACN_VERSION +
                '; visibility=' + document.visibilityState +
                '; realm=' + (typeof unsafeWindow !== 'undefined' ? 'GM-sandbox' : 'page'));
        } catch (e) {}
    }());

`;

function instrumentMap(source) {
    if (source.indexOf('[ACN-PERF]') === -1) {
        throw new Error('apply perf-instrument.js first — the map driver reads its counters');
    }
    if (source.indexOf('[ACN-MAP]') !== -1) throw new Error('source already map-instrumented');
    const i = source.indexOf(ANCHOR);
    if (i === -1) throw new Error('insertion anchor not found — userscript layout changed?');
    return source.slice(0, i) + BLOCK + source.slice(i);
}

module.exports = { instrumentMap };
