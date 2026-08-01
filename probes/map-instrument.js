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
                kids.push({ label: k.label, startIdx: k.startIdx, endIdx: k.endIdx,
                            n: k.messages.length });
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
