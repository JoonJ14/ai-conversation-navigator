// Builds one MUTANT per mechanism of the Claude index's transport ladder (v12.9, DEC-045): a copy
// of the userscript with exactly that mechanism removed. The battery (probes/run-ladder-mutants.sh)
// runs probes/check-transport-ladder.js on each one, and the matrix it prints says which checks
// catch the removal. A mechanism that no check catches is printed as NOT gated, never assumed
// covered.
//
// Run: node probes/build-ladder-mutants.js <userscript> <outDir> [ID,ID,...]
//      Normally run for you by probes/run-ladder-mutants.sh. An ID is the short form (M42) or the
//      full one (M42-unusable-list-drops-status); without IDs every mutant is built.
//
// EVERY REPLACEMENT MUST MATCH EXACTLY ONCE, or the build stops. A mutant whose edit silently did
// not apply would "pass" for the wrong reason (DEC-037's silent-non-execution class). So a change
// to the ladder's code breaks this file ON PURPOSE: re-anchor the mutants it names, or retire them
// with their mechanism (M29 and M29b went with the per-conversation stall epoch in Codex round 5),
// then re-run the battery and update the matrix in reviews/review-2026-10-22-safari-transport.md.
//
// "Round N" in the notes below is the Tier 3 (Codex) review round that added the mechanism or its
// check; the same record lists every round.
//
// Context of what the battery measures: Playwright page realm, the same as the probe itself. It
// proves the probe can tell each mechanism's absence apart, nothing about a real userscript manager.

'use strict';
const fs = require('fs');
const path = require('path');

function once(text, from, to, id) {
    const n = text.split(from).length - 1;
    if (n !== 1) { console.error('MUTANT ' + id + ': expected 1 match, got ' + n + ' for:\n' + from); process.exit(1); }
    // A function replacement, so a '$' in the new text is never read as a replacement pattern.
    return text.replace(from, () => to);
}

const M = {
    'M01-no-ladder': (s) => once(s,
        "if (!first.err || !ciTraceWantsFallback(first.trace) ||",
        "if (true || !first.err || !ciTraceWantsFallback(first.trace) ||", 'M01'),
    'M02-no-detection': (s) => once(s,
        "(/userscripts/i.test(ciScriptHandler()) ? 'fetch' : 'gmxhr')",
        "('gmxhr')", 'M02'),
    'M03-fallback-on-anything': (s) => once(s,
        "return trace.noAnswer === 0 && trace.verdict === 0 && (trace.refused + trace.threw) > 0;",
        "return true;", 'M03'),
    // The review fix undone: a 404 is a verdict again, so a 404+403 walk cannot fall back.
    'M20-404-not-a-refusal': (s) => once(s,
        "if (r.kind === 'http' && (r.status === 401 || r.status === 403 || r.status === 404)) {",
        "if (r.kind === 'http' && (r.status === 401 || r.status === 403)) {", 'M20'),
    // fetch sends from any page origin.
    'M21-no-origin-guard': (s) => once(s,
        "        if (origin !== CI_API_ORIGIN) {\n            done(ciFailure('threw', 0, 'fetch refused: page origin is not ' + CI_API_ORIGIN));\n            return;\n        }",
        "        /* M21: no origin guard */", 'M21'),
    // The index runs on any page platform detection calls Claude (any host, any port).
    'M22-no-origin-guard-on-index': (s) => once(s,
        "                  window.location.origin === 'https://claude.ai' &&\n",
        "", 'M22'),
    // Codex round 2's first version: hostname only — claude.ai on another port passes.
    'M22b-hostname-only-index-guard': (s) => once(s,
        "                  window.location.origin === 'https://claude.ai' &&\n",
        "                  window.location.hostname === 'claude.ai' &&\n", 'M22b'),
    // A late answer no longer frees its stalled slot: after the second stall every fetch fails fast forever.
    'M26-no-stalled-release': (s) => once(s,
        "if (stalled) { stalled = false; _ciFetchStalled--; }",
        "if (stalled) { stalled = false; }", 'M26'),
    // Only FETCH winners are cached; a gmxhr win leaves fetch first next time.
    // Round 2's classification rule: any refusal on the second walk lets the loop through.
    'M28-uphold-only-without-answers': (s) => once(s,
        "var secondUpholdsRefusal = t.verdict === 0;",
        "var secondUpholdsRefusal = t.refused === 0 && t.verdict === 0;", 'M28'),
    // The cap's value, both sides: ONE lingering request already blocks (a lone hang in chat A
    // stalls chat B), or THREE may linger before anything fails fast.
    'M31-cap-of-one': (s) => once(s,
        "var CI_FETCH_STALL_MAX = 2;",
        "var CI_FETCH_STALL_MAX = 1;", 'M31'),
    'M32-cap-of-three': (s) => once(s,
        "var CI_FETCH_STALL_MAX = 2;",
        "var CI_FETCH_STALL_MAX = 3;", 'M32'),
    // gmxhr's own timeout reported as "could not run" — fallback-eligible, the wrong class.
    'M30-gm-timeout-as-threw': (s) => once(s,
        "ontimeout: function () { finish(ciFailure('timeout', 0, 'timeout')); }",
        "ontimeout: function () { finish(ciFailure('threw', 0, 'timeout')); }", 'M30'),
    'M27-only-fetch-winners-cached': (s) => once(s,
        "_ciTransport = res.trace.transport;",
        "if (res.trace.transport === 'fetch') _ciTransport = res.trace.transport;", 'M27'),
    // Every retry sends another fetch, however many timed-out ones still linger (the open bound stays).
    'M23-no-stalled-cap': (s) => once(s,
        "if (_ciFetchStalled >= CI_FETCH_STALL_MAX || _ciFetchOpen >= CI_FETCH_OPEN_MAX) {",
        "if (_ciFetchOpen >= CI_FETCH_OPEN_MAX) {", 'M23'),
    // Round 6: the open bound — removed, set one lower, or never released.
    'M35-no-open-cap': (s) => once(s,
        "if (_ciFetchStalled >= CI_FETCH_STALL_MAX || _ciFetchOpen >= CI_FETCH_OPEN_MAX) {",
        "if (_ciFetchStalled >= CI_FETCH_STALL_MAX) {", 'M35'),
    'M36-open-never-released': (s) => once(s,
        "if (open)    { open = false;    _ciFetchOpen--; }",
        "if (open)    { open = false; }", 'M36'),
    'M37-open-cap-of-five': (s) => once(s,
        "var CI_FETCH_OPEN_MAX  = 6;",
        "var CI_FETCH_OPEN_MAX  = 5;", 'M37'),
    // Round 6: the winner cached where round 5 had it — before the body was validated.
    'M33-cached-before-validation': (s) => once(once(s,
        "            _ciTransport = res.trace.transport;\n",
        "", 'M33-1'),
        "                if (_usageOrgUuid && _usageOrgUuid !== org) _usageLastFetch = 0;\n",
        "                if (_usageOrgUuid && _usageOrgUuid !== org) _usageLastFetch = 0;\n                _ciTransport = res.trace.transport;\n", 'M33-2'),
    // Round 7: detection through GM.info (no GM_info) dropped.
    'M38-no-gm-api-info': (s) => once(s,
        "        try {\n            if (typeof GM !== 'undefined' && GM && GM.info && GM.info.scriptHandler) {\n                return String(GM.info.scriptHandler);\n            }\n        } catch (e) {}\n",
        "", 'M38'),
    // Round 7: unparseable JSON reported as "could not run" — fallback-eligible.
    'M39-parse-failure-as-threw': (s) => once(s,
        "return ciFailure('parse', 200, 'malformed JSON');",
        "return ciFailure('threw', 200, 'malformed JSON');", 'M39'),
    // Round 7: an unusable org list no longer a verdict — on each org-list path separately.
    'M40-unusable-list-uncounted-resolve': (s) => once(s,
        "        ciApiStep(trace, '/api/organizations', null, function (r) {\n            ciCountUnusableOrgList(trace, r);\n            if (!r.ok || !Array.isArray(r.json)) {\n                // Carry the HTTP status",
        "        ciApiStep(trace, '/api/organizations', null, function (r) {\n            if (!r.ok || !Array.isArray(r.json)) {\n                // Carry the HTTP status", 'M40'),
    'M41-unusable-list-uncounted-all-orgs': (s) => once(s,
        "        ciApiStep(trace, '/api/organizations', null, function (r) {\n            ciCountUnusableOrgList(trace, r);\n            if (!r.ok || !Array.isArray(r.json)) {\n                // Status rides the error",
        "        ciApiStep(trace, '/api/organizations', null, function (r) {\n            if (!r.ok || !Array.isArray(r.json)) {\n                // Status rides the error", 'M41'),
    // After the owner's revert of #5 (PR #75): an unusable org list drops the cheap
    // candidates' 403 again (round 8's change). LM8c must catch it.
    'M42-unusable-list-drops-status': (s) => once(s,
        "(triedStatus ? ' (HTTP ' + triedStatus + ')' : '')), null);",
        "(!ciRankOrgs(r.json).length ? ' (the org list held no usable org)' : triedStatus ? ' (HTTP ' + triedStatus + ')' : '')), null);", 'M42'),
    // Round 8: a missing GM_xmlhttpRequest read as "no answer" — never falls through to fetch.
    'M43-missing-gm-not-fallback': (s) => once(s,
        "done(ciFailure('threw', 0, 'GM_xmlhttpRequest unavailable'));",
        "done(ciFailure('network', 0, 'GM_xmlhttpRequest unavailable'));", 'M43'),
    // Round 9: a late answer frees its slots but its body is left streaming.
    'M44-late-body-not-cancelled': (s) => once(s,
        "if (stalled) { discard(res); ended(); return; }",
        "if (stalled) { ended(); return; }", 'M44'),
    // Round 9: a REJECTED fetch never frees its open slot.
    'M45-rejection-keeps-slot': (s) => once(s,
        "            }, function (e) {\n                ended();\n                finish(ciFailure('network', 0, 'network error', '', ciErrorName(e)));\n            });\n        } catch (e) {",
        "            }, function (e) {\n                finish(ciFailure('network', 0, 'network error', '', ciErrorName(e)));\n            });\n        } catch (e) {", 'M45'),
    // Round 9: the watchdog AT the manager's own timeout, not past it.
    'M46-watchdog-at-manager-timeout': (s) => once(s,
        "        }, CI_FETCH_TIMEOUT_MS + 5000);",
        "        }, CI_FETCH_TIMEOUT_MS);", 'M46'),
    // Round 6 NOTE: fetch loses the query string (the fixture answers by path).
    'M34-fetch-drops-query': (s) => once(s,
        "fetch(origin + path, { credentials: 'include' })",
        "fetch(origin + path.split('?')[0], { credentials: 'include' })", 'M34'),
    // v12.8's ranking: a non-array capabilities throws inside the response callback.
    'M24-ranking-throws': (s) => once(s,
        "var caps = Array.isArray(o.capabilities) ? o.capabilities : [];",
        "var caps = o.capabilities || [];", 'M24'),
    // Single-transport failure lines no longer name the transport.
    'M25-no-reason-prefix': (s) => once(s,
        "                if (first.err) first.err = new Error('[' + order[0] + '] ' + first.err.message);\n",
        "", 'M25'),
    'M04-classify-by-first-only': (s) => once(s,
        "ciIsPermanentReason(second.err.message) ||\n                       (secondUpholdsRefusal && ciIsPermanentReason(first.err.message)));",
        "ciIsPermanentReason(first.err.message));", 'M04'),
    'M05-no-verdict-cannot-uphold-refusal': (s) => once(s,
        "(secondUpholdsRefusal && ciIsPermanentReason(first.err.message))",
        "false", 'M05'),
    'M06-no-cache': (s) => once(s,
        "_ciTransport = res.trace.transport;",
        "/* M06: no cache */", 'M06'),
    'M07-gm-throw-escapes': (s) => once(s,
        "            // v12.8 let this escape ciLoadIndex as a page error.",
        "            throw e; // v12.8 let this escape ciLoadIndex as a page error.", 'M07'),
    'M08-gm-options-changed': (s) => once(s,
        "                headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },\n                onload: function (res) {\n                    var r;",
        "                headers: { 'Accept': 'application/json' },\n                onload: function (res) {\n                    var r;", 'M08'),
    'M09-fetch-headers': (s) => once(s,
        "fetch(origin + path, { credentials: 'include' })",
        "fetch(origin + path, { credentials: 'include', headers: { 'Cache-Control': 'no-cache' } })", 'M09'),
    'M10-unvetted-error-type': (s) => once(s,
        "return (typeof t === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(t)) ? t : '';",
        "return (typeof t === 'string') ? t : '';", 'M10'),
    'M11-per-request-fallback': (s) => once(s,
        "    function ciApiStep(trace, path, org, cb) {\n        ciApiGet(trace.transport, path, function (r) {",
        "    function ciApiGetPR(t, p, cb) {\n        ciApiGet(t, p, function (r0) {\n            if (!r0.ok && r0.status === 403) { ciApiGet(t === 'fetch' ? 'gmxhr' : 'fetch', p, cb); return; }\n            cb(r0);\n        });\n    }\n    function ciApiStep(trace, path, org, cb) {\n        ciApiGetPR(trace.transport, path, function (r) {", 'M11'),
    'M12-detection-unguarded': (s) => once(s,
        "        try {\n            if (typeof GM_info !== 'undefined' && GM_info && GM_info.scriptHandler) {\n                return String(GM_info.scriptHandler);\n            }\n        } catch (e) {}",
        "        if (typeof GM_info !== 'undefined' && GM_info && GM_info.scriptHandler) {\n            return String(GM_info.scriptHandler);\n        }", 'M12'),
    'M13-fetch-rejection-eligible': (s) => once(s,
        "            }, function (e) {\n                ended();\n                finish(ciFailure('network', 0, 'network error', '', ciErrorName(e)));\n            });\n        } catch (e) {",
        "            }, function (e) {\n                ended();\n                finish(ciFailure('threw', 0, 'network error', '', ciErrorName(e)));\n            });\n        } catch (e) {", 'M13'),
    'M14-no-gm-watchdog': (s) => once(s,
        "        watchdog = setTimeout(function () {\n            watchdog = null;\n            done(ciFailure('threw', 0, 'GM_xmlhttpRequest never called back'));\n        }, CI_FETCH_TIMEOUT_MS + 5000);",
        "        /* M14: no watchdog */", 'M14'),
    'M15-no-fetch-timer': (s) => once(s,
        "        timer = setTimeout(function () {\n            timer = null;\n            stalled = true;\n            _ciFetchStalled++;\n            done(ciFailure('timeout', 0, 'timeout'));\n        }, CI_FETCH_TIMEOUT_MS);",
        "        /* M15: no timer */", 'M15'),
    'M16-no-walk-try': (s) => once(s,
        "            try {\n                ciWalkOrgs(transport, cid, cb);\n            } catch (e) {\n                finish({ trace: ciNewTrace(transport),\n                         err: new Error('[' + transport + '] org walk threw: ' + ciErrorName(e)) });\n            }",
        "            ciWalkOrgs(transport, cid, cb);", 'M16'),
    'M17-no-onerror-detail': (s) => once(s,
        "finish(ciFailure('network', 0, 'network error', '', ciGmErrorDetail(res)))",
        "finish(ciFailure('network', 0, 'network error'))", 'M17'),
    // Expected UNGATED (insurance, not behaviour): recorded so the matrix says so.
    'M18-no-finish-latch': (s) => once(s,
        "        function finish(res, permanent) {\n            if (finished) return;\n            finished = true;",
        "        function finish(res, permanent) {\n            /* M18: no latch */", 'M18'),
    'M19-settle-swallows': (s) => once(s,
        "try { cb(r); } catch (e) { setTimeout(function () { throw e; }, 0); }",
        "try { cb(r); } catch (e) {}", 'M19'),
};


// One line per mutant, printed in the matrix (the "Mechanism removed" column).
const DESC = {
    'M01-no-ladder': 'no ladder — a failed first walk is final',
    'M02-no-detection': 'detection ignored — gmxhr always first',
    'M03-fallback-on-anything': 'fallback on ANY failed walk (network errors included)',
    'M04-classify-by-first-only': 'both failed: classify by the first transport only',
    'M05-no-verdict-cannot-uphold-refusal': 'both failed: a second with no verdict no longer upholds the first\'s refusal',
    'M06-no-cache': 'the winner is never cached',
    'M07-gm-throw-escapes': 'a synchronous GM throw escapes (v12.8)',
    'M08-gm-options-changed': 'gmxhr request no longer byte-identical (Cache-Control dropped)',
    'M09-fetch-headers': 'fetch grows a custom header',
    'M10-unvetted-error-type': 'error.type printed unvetted',
    'M11-per-request-fallback': 'per-REQUEST fallback on every 403',
    'M12-detection-unguarded': 'detection unguarded — a throwing GM_info getter escapes',
    'M13-fetch-rejection-eligible': 'a rejected fetch counts as "threw" (fallback-eligible)',
    'M14-no-gm-watchdog': 'no gmxhr watchdog',
    'M15-no-fetch-timer': 'no fetch timeout timer',
    'M16-no-walk-try': 'no try/catch around the walk prefix',
    'M17-no-onerror-detail': 'onerror detail not logged',
    'M18-no-finish-latch': 'no single-fire latch on finish()',
    'M19-settle-swallows': 'a throw from a callback is swallowed, not rethrown',
    'M20-404-not-a-refusal': '404 is a verdict again, not a refusal',
    'M21-no-origin-guard': 'fetch sends from any page origin',
    'M22-no-origin-guard-on-index': 'the index runs on any page detected as Claude',
    'M22b-hostname-only-index-guard': 'index guard checks hostname only (any port passes)',
    'M23-no-stalled-cap': 'no cap on timed-out fetches (the open bound stays)',
    'M24-ranking-throws': 'v12.8 ranking — object `capabilities` throws in the callback',
    'M25-no-reason-prefix': 'single-transport reasons no longer name the transport',
    'M26-no-stalled-release': 'a late answer no longer frees its stalled slot',
    'M27-only-fetch-winners-cached': 'only FETCH winners are cached',
    'M28-uphold-only-without-answers': 'round 2\'s rule: any refusal on the second walk lets the re-poll loop through',
    'M30-gm-timeout-as-threw': 'gmxhr\'s own timeout classed as "could not run" (fallback-eligible)',
    'M31-cap-of-one': 'stall cap of ONE — a lone hang blocks every later fetch',
    'M32-cap-of-three': 'stall cap of THREE',
    'M33-cached-before-validation': 'winner cached before its body is validated (round 5\'s position)',
    'M34-fetch-drops-query': 'fetch drops the query string',
    'M35-no-open-cap': 'no bound on OPEN fetches (only timed-out ones counted)',
    'M36-open-never-released': 'an open fetch never frees its slot when it ends',
    'M37-open-cap-of-five': 'open bound of FIVE',
    'M38-no-gm-api-info': 'detection ignores GM.info (reads GM_info only)',
    'M39-parse-failure-as-threw': 'unparseable JSON classed as "could not run" (fallback-eligible)',
    'M40-unusable-list-uncounted-resolve': 'an unusable org list is no verdict — first org-list path',
    'M41-unusable-list-uncounted-all-orgs': 'an unusable org list is no verdict — all-orgs path',
    'M42-unusable-list-drops-status': 'an unusable org list drops the cheap candidates\' 403 (round 8\'s change, reverted by the owner)',
    'M43-missing-gm-not-fallback': 'a missing GM_xmlhttpRequest read as "no answer" (no fallback)',
    'M44-late-body-not-cancelled': 'a late answer\'s body is left streaming (not cancelled)',
    'M45-rejection-keeps-slot': 'a rejected fetch never frees its open slot',
    'M46-watchdog-at-manager-timeout': 'gmxhr watchdog AT the manager\'s 45s timeout, not past it',
};

// Both tables must name the same mutants, or the matrix would print a mutant without its
// description, or describe one that is never built.
const undescribed = Object.keys(M).filter((id) => !DESC[id]);
const unbuilt = Object.keys(DESC).filter((id) => !M[id]);
if (undescribed.length || unbuilt.length) {
    throw new Error('build-ladder-mutants: tables disagree — no description: ' + undescribed.join(', ') +
                    '; no mutant: ' + unbuilt.join(', '));
}

module.exports = { MUTANTS: M, DESC };

if (require.main === module) {
    const SRC = process.argv[2];
    const OUT = process.argv[3];
    if (!SRC || !OUT) {
        console.error('usage: node probes/build-ladder-mutants.js <userscript> <outDir> [ID,ID,...]');
        process.exit(2);
    }
    let ids = Object.keys(M);
    if (process.argv[4]) {
        ids = process.argv[4].split(',').filter(Boolean).map((want) => {
            const hit = Object.keys(M).filter((id) => id === want || id.startsWith(want + '-'));
            if (hit.length !== 1) { console.error('unknown mutant: ' + want); process.exit(2); }
            return hit[0];
        });
    }
    const src = fs.readFileSync(SRC, 'utf8');
    fs.mkdirSync(OUT, { recursive: true });
    for (const id of ids) {
        const out = M[id](src);
        if (out === src) { console.error('MUTANT ' + id + ' produced no change'); process.exit(1); }
        fs.writeFileSync(path.join(OUT, id + '.user.js'), out);
        console.log('built ' + id);
    }
}
