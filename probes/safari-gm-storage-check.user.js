// ==UserScript==
// @name         ACN B0 — Safari GM storage and usage-fetch check
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Measurement only (PR B, B0). Logs which GM storage APIs exist, a GM.setValue/GM.getValue round trip, the manager, and the usage endpoint's status. Remove after use.
// @match        https://claude.ai/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// B0 of PR B (v12.12), run by the owner on Safari + Userscripts. Claude Code cannot drive Safari,
// and the GM storage wrapper's design depends on what Userscripts actually provides. Every line
// starts with [ACN-B0], so the console can be filtered on it. Nothing here prints usage values,
// a full org id, a cookie or a response body. The only key it writes is 'acn-probe' (and
// 'acn-probe-sync' if the synchronous API exists), never one the navigator uses.
//
// Any valid @grant makes Userscripts inject into the content-script world, where the navigator
// itself runs (agent_docs/architecture.md, Runtime matrix), so the fetch below is measured in the
// navigator's world.

(function () {
    'use strict';

    var P = '[ACN-B0] ';
    var KEY = 'acn-probe';

    function errText(e) { return (e && (e.name || '') + ': ' + (e.message || String(e))) || String(e); }

    // 1. The synchronous API: present, and does calling each function throw? Each is called on
    // its own, so one throwing cannot hide the other's result.
    var syncLine = 'sync API: typeof GM_getValue=' + (typeof GM_getValue) +
                   ' typeof GM_setValue=' + (typeof GM_setValue);
    if (typeof GM_setValue === 'function') {
        try { GM_setValue(KEY + '-sync', 1); syncLine += '; GM_setValue call: ok'; }
        catch (e) { syncLine += '; GM_setValue call: THROW ' + errText(e); }
    } else {
        syncLine += '; GM_setValue call: not attempted';
    }
    if (typeof GM_getValue === 'function') {
        try { syncLine += '; GM_getValue call: ok, read ' + JSON.stringify(GM_getValue(KEY + '-sync', null)); }
        catch (e) { syncLine += '; GM_getValue call: THROW ' + errText(e); }
    } else {
        syncLine += '; GM_getValue call: not attempted';
    }
    console.log(P + syncLine);

    // 2. The asynchronous API: present?
    var hasGM = typeof GM !== 'undefined' && GM !== null;
    console.log(P + 'async API: typeof GM=' + (typeof GM) +
                ' typeof GM.getValue=' + (hasGM ? typeof GM.getValue : 'n/a') +
                ' typeof GM.setValue=' + (hasGM ? typeof GM.setValue : 'n/a'));

    // 5. The manager and its version, so the result is tied to a Userscripts build. Guarded, so a
    // throwing getter cannot stop the lines below.
    try {
        var src = (typeof GM_info !== 'undefined' && GM_info) ? 'GM_info' : (hasGM && GM.info ? 'GM.info' : 'none');
        var info = src === 'GM_info' ? GM_info : (src === 'GM.info' ? GM.info : null);
        console.log(P + 'manager: scriptHandler=' + (info ? info.scriptHandler : 'n/a') +
                    ' version=' + (info ? info.version : 'n/a') + ' (from ' + src + ')');
    } catch (e) {
        console.log(P + 'manager: reading GM_info / GM.info THREW ' + errText(e));
    }

    // 3 and 4. The value BEFORE the write (it should grow by 1 per reload if storage persists),
    // then a write of n + 1 and a read back.
    if (hasGM && typeof GM.getValue === 'function' && typeof GM.setValue === 'function') {
        var n;
        Promise.resolve()
            .then(function () { return GM.getValue(KEY, 0); })
            .then(function (v) {
                n = (typeof v === 'number') ? v : 0;
                console.log(P + 'before write: ' + KEY + '=' + JSON.stringify(v) + ' (' + typeof v + ')');
                return GM.setValue(KEY, n + 1);
            })
            .then(function () { return GM.getValue(KEY, null); })
            .then(function (v) {
                console.log(P + 'round trip: wrote ' + (n + 1) + ', read back ' + JSON.stringify(v) +
                            ' (' + typeof v + ')' + (v === n + 1 ? ' — MATCH' : ' — MISMATCH'));
            })
            .catch(function (e) { console.log(P + 'round trip: REJECTED ' + errText(e)); });
    } else {
        console.log(P + 'before write / round trip: skipped, GM.getValue / GM.setValue are not functions');
    }

    // 6. For B1: the usage endpoint through fetch from this world, with the session cookie.
    // Status and content-type only.
    var m = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/);
    var org = null;
    try { org = m ? decodeURIComponent(m[1]) : null; } catch (e) { org = null; }
    // Which fetch this world has: the navigator's SSE proxy is named acnFetchProxy; the native
    // one is named fetch.
    var via = 'fetch.name=' + (typeof fetch === 'function' ? (fetch.name || '(anonymous)') : typeof fetch);
    if (!org) {
        console.log(P + 'usage fetch: skipped, no readable lastActiveOrg cookie here');
    } else {
        fetch('/api/organizations/' + encodeURIComponent(org) + '/usage', { credentials: 'include' })
            .then(function (r) {
                console.log(P + 'usage fetch: org=' + org.slice(0, 8) + '… status=' + r.status +
                            ' content-type=' + (r.headers.get('content-type') || 'none') + ' ' + via);
            })
            .catch(function (e) {
                console.log(P + 'usage fetch: org=' + org.slice(0, 8) + '… FAILED ' + errText(e) + ' ' + via);
            });
    }
}());
