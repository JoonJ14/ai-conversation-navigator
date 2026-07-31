// Builds the instrumented "perf probe" variant of the userscript.
// Inserts a timing/counting wrapper block into the IIFE, immediately before the
// "Inject now" init section — every function declaration is hoisted and
// initialized by then, and nothing has called the summary pipeline yet.
// The wrapped names are reassigned bindings; later callers pick up the wrappers.
//
// NOT part of the shipped userscript. ES5 only inside the inserted block.

'use strict';

const ANCHOR = '    // ============================================================\n' +
               '    // Inject now (body is available — Tampermonkey runs at document-end)';

const BLOCK = `
    // ============================================================
    // [ACN-PERF] Summary-pipeline instrumentation — PROBE BUILD ONLY
    // ============================================================
    var __acnPerf = { runs: [], cur: null, trigger: 'generate', exportCalls: 0 };

    function __acnPerfGranularity() {
        var g = 1e9, prev = performance.now(), i, v, d;
        for (i = 0; i < 5000; i++) {
            v = performance.now();
            if (v > prev) { d = v - prev; if (d < g) g = d; prev = v; }
        }
        return g === 1e9 ? -1 : g;
    }

    function __acnPerfPublish() {
        try {
            var w = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
            // JSON string, not an object: primitives cross realm boundaries safely
            // (DEC-019/020 class — never hand a sandbox object to the page realm).
            w.__acnPerfJson = JSON.stringify(__acnPerf.runs);
        } catch (e) {}
    }

    function __acnPerfWrap(name, fn, unitFn) {
        return function () {
            var c = __acnPerf.cur;
            if (!c) return fn.apply(this, arguments);
            var t0 = performance.now();
            var r = fn.apply(this, arguments);
            var dt = performance.now() - t0;
            var s = c.calls[name];
            if (!s) { s = c.calls[name] = { n: 0, ms: 0, max: 0, units: 0 }; }
            s.n++; s.ms += dt; if (dt > s.max) s.max = dt;
            if (unitFn) { try { s.units += unitFn(arguments, r) || 0; } catch (e) {} }
            return r;
        };
    }

    // Phase-level (low call frequency — timings reliable at any timer granularity)
    _sumBuildConversationMap  = __acnPerfWrap('phase.map', _sumBuildConversationMap);
    _sumExtractTopics         = __acnPerfWrap('phase.topics', _sumExtractTopics);
    _sumExtractKeyPoints      = __acnPerfWrap('phase.keyPoints', _sumExtractKeyPoints);
    _sumGenerateStats         = __acnPerfWrap('phase.stats', _sumGenerateStats);
    _sumInventoryCodeAndFiles = __acnPerfWrap('phase.inventory', _sumInventoryCodeAndFiles,
        function (a) { return (a[0] || []).length; });

    // Map internals (inclusive times; map ⊇ timeline/subSegments/entities/topicsFromText/mergeExcess)
    _sumBuildTimeline         = __acnPerfWrap('map.timeline', _sumBuildTimeline);
    _sumBuildSubSegments      = __acnPerfWrap('map.subSegments', _sumBuildSubSegments,
        function (a) { return (a[0] || []).length; });
    _sumScanEntities          = __acnPerfWrap('map.entities', _sumScanEntities,
        function (a) { return (a[0] || []).length; });
    _sumExtractTopicsFromText = __acnPerfWrap('map.topicsFromText', _sumExtractTopicsFromText,
        function (a) { return (a[0] || '').length; });
    _sumMergeExcessSegments   = __acnPerfWrap('map.mergeExcess', _sumMergeExcessSegments);

    // keyPoints internals (keyPoints ⊇ dedup ⊇ wordOverlap ⊇ tokenize)
    _sumDeduplicatePoints     = __acnPerfWrap('keyPoints.dedup', _sumDeduplicatePoints,
        function (a) { return (a[0] || []).length; });

    // High-frequency inner functions. Counts and unit sums are exact; the ms sums
    // are approximate attribution when timer granularity is coarse (granularity is
    // printed at startup — read the number before trusting sub-ms sums).
    _sumTokenize              = __acnPerfWrap('inner.tokenize', _sumTokenize,
        function (a) { return (a[0] || '').length; });
    _sumWordOverlap           = __acnPerfWrap('inner.wordOverlap', _sumWordOverlap,
        function (a) { return (a[0] || '').length + (a[1] || '').length; });
    _sumTopicOverlap          = __acnPerfWrap('inner.topicOverlap', _sumTopicOverlap);

    // Render internals (timed under the renderSummaryResults record)
    _sumRenderConversationMap = __acnPerfWrap('render.map', _sumRenderConversationMap,
        function (a) { return (a[0] || []).length; });
    _sumRenderStats           = __acnPerfWrap('render.stats', _sumRenderStats);
    _sumRenderTopics          = __acnPerfWrap('render.topics', _sumRenderTopics);
    _sumRenderKeyPoints       = __acnPerfWrap('render.keyPoints', _sumRenderKeyPoints);
    _sumRenderInventory       = __acnPerfWrap('render.inventory', _sumRenderInventory);

    getSummaryForExport = (function (orig) {
        return function () {
            __acnPerf.exportCalls++;
            // Make the v12.4 cache decision observable: log both sides of the
            // key so a HIT/MISS can be attributed (stamp moved? qLen moved?).
            // Guarded — the cache does not exist in pre-v12.4 builds.
            try {
                var cur = ciIndexStamp();
                var curSig = (typeof _sumProvSig === 'function') ? _sumProvSig() : '';
                var c = (typeof _sumComputeCache !== 'undefined') ? _sumComputeCache : undefined;
                console.log('[ACN-PERF] export cache: cached=' +
                    (c === undefined ? 'N/A (pre-v12.4)' : c === null ? 'null'
                        : '{stamp:' + c.stamp + ', provSig.len:' + String(c.provSig || '').length + '}') +
                    ' current={stamp:' + cur + ', provSig.len:' + curSig.length + '}' +
                    (c ? ' -> ' + ((c.stamp !== null && c.stamp === cur && c.provSig === curSig) ? 'HIT' : 'MISS') : ''));
            } catch (e) {}
            return orig.apply(this, arguments);
        };
    }(getSummaryForExport));

    generateFullSummary = (function (orig) {
        return function () {
            var rec = {
                run: __acnPerf.runs.length + 1,
                trigger: __acnPerf.trigger,
                visibility: document.visibilityState,
                calls: {}
            };
            __acnPerf.cur = rec;
            var t0 = performance.now();
            try {
                return orig.apply(this, arguments);
            } finally {
                rec.totalMs = performance.now() - t0;
                __acnPerf.cur = null;
                __acnPerf.runs.push(rec);
                try {
                    console.log('[ACN-PERF] generate run#' + rec.run + ' trigger=' + rec.trigger +
                        ' total=' + rec.totalMs.toFixed(1) + 'ms vis=' + rec.visibility);
                    console.log('[ACN-PERF-JSON] ' + JSON.stringify(rec));
                } catch (e) {}
                __acnPerfPublish();
                (function (r) {
                    var tEnd = performance.now();
                    setTimeout(function () {
                        // Task-turn gap after the generating task ends: includes the
                        // synchronous render that follows generate in the same task,
                        // plus style/layout/paint — renderMs is reported separately,
                        // so (gap - renderMs) approximates layout+paint blocking.
                        r.postTurnGapMs = performance.now() - tEnd;
                        try { console.log('[ACN-PERF] run#' + r.run + ' post-turn gap ' +
                            r.postTurnGapMs.toFixed(1) + 'ms'); } catch (e) {}
                        __acnPerfPublish();
                    }, 0);
                }(rec));
            }
        };
    }(generateFullSummary));

    renderSummaryResults = (function (orig) {
        return function () {
            var rec = { calls: {} };
            var prev = __acnPerf.cur;
            __acnPerf.cur = rec;
            var t0 = performance.now();
            try {
                return orig.apply(this, arguments);
            } finally {
                rec.totalMs = performance.now() - t0;
                __acnPerf.cur = prev;
                var last = __acnPerf.runs[__acnPerf.runs.length - 1];
                if (last) { last.renderMs = rec.totalMs; last.renderCalls = rec.calls; }
                try { console.log('[ACN-PERF] render ' + rec.totalMs.toFixed(1) + 'ms'); } catch (e) {}
                __acnPerfPublish();
            }
        };
    }(renderSummaryResults));

    exportSummary = (function (orig) {
        return function () {
            __acnPerf.trigger = 'export';
            var t0 = performance.now();
            try {
                return orig.apply(this, arguments);
            } finally {
                var dt = performance.now() - t0;
                __acnPerf.trigger = 'generate';
                var last = __acnPerf.runs[__acnPerf.runs.length - 1];
                var recomputed = !!(last && last.trigger === 'export');
                if (recomputed) last.exportTotalMs = dt;
                // Recorded unconditionally: on a v12.4 cache HIT no generate run
                // exists to attach to, and the hit path is exactly the one the
                // fix creates — losing its wall-clock would blind the probe to
                // the improvement it exists to measure (Tier 3).
                __acnPerf.exportTotals = __acnPerf.exportTotals || [];
                __acnPerf.exportTotals.push(dt);
                try { console.log('[ACN-PERF] exportSummary total ' + dt.toFixed(1) + 'ms ' +
                    (recomputed ? '(contains the fresh generate run reported above)'
                                : '(cache hit — no generate run inside this export)')); } catch (e) {}
                __acnPerfPublish();
            }
        };
    }(exportSummary));

    try {
        console.log('[ACN-PERF] probe build __ACN_PERF_BUILD__ over ACN v' + ACN_VERSION +
            '; perf.now granularity ~' + __acnPerfGranularity().toFixed(3) + 'ms' +
            '; visibility=' + document.visibilityState +
            '; realm=' + (typeof unsafeWindow !== 'undefined' ? 'GM-sandbox' : 'page'));
    } catch (e) {}

`;

function instrument(source, buildTag) {
    if (source.indexOf('[ACN-PERF]') !== -1) throw new Error('source already instrumented');
    const i = source.indexOf(ANCHOR);
    if (i === -1) throw new Error('insertion anchor not found — userscript layout changed?');
    const block = BLOCK.replace(/__ACN_PERF_BUILD__/g, buildTag);
    let out = source.slice(0, i) + block + source.slice(i);
    // Owner-facing metadata: distinct @name so Tampermonkey installs it as a
    // SEPARATE script (the regular one must be toggled off while measuring),
    // and a @version that names the probe.
    out = out.replace('// @name         AI Conversation Navigator',
                      '// @name         AI Conversation Navigator (PERF PROBE)');
    out = out.replace(/\/\/ @version\s+([^\n]+)/,
                      '// @version      $1-' + buildTag);
    return out;
}

module.exports = { instrument };
