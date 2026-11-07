// ==UserScript==
// @name         ACN G0 — Gemini transport check
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Measurement only (v12.19, Phase 0). A button sends ONE Gemini history request (hNvQHb, page size 1) for the open chat through each transport this manager offers, and logs status and shape only. Remove after use.
// @match        https://gemini.google.com/app/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      gemini.google.com
// ==/UserScript==

// Phase 0 of the v12.19 PR (docs/specs/v12.19-spec.md), run in each userscript manager: Chrome +
// Tampermonkey by the agent; Firefox + Tampermonkey and Safari + Userscripts by the owner.
// Phase 1 measured Gemini's history request in Chrome's PAGE REALM only. The navigator runs in
// Tampermonkey's sandbox or Userscripts' content-script world, where fetch and
// GM_xmlhttpRequest are each manager's own (agent_docs/architecture.md, Runtime matrix), so
// this asks, for each transport, whether the request comes back with turns in the world the
// navigator runs in. The GM_xmlhttpRequest grant makes Userscripts inject into that content
// world, as it does for the navigator. `@connect gemini.google.com` lets GM_xmlhttpRequest be
// measured on its merits; the navigator itself gets that line only if GM_xmlhttpRequest turns
// out to be the transport that works somewhere (the owner's decision 3).
//
// What it does, only when its button is clicked:
//   - reads the `at` token from the page's inline <script> text (never from a page global);
//   - sends ONE read request (page size 1) per transport: this world's fetch,
//     GM_xmlhttpRequest, then GM.xmlHttpRequest if the manager has it. It is the same read
//     Gemini sends when the view reaches the top of a chat.
// Every line starts with [ACN-G0] (console and the panel). Nothing printed is a token, a
// cookie, a request or response body, a query string, a chat title or any message text; the
// chat id is cut to 8 characters.

(function () {
    'use strict';

    var P = '[ACN-G0] ';
    var EP = '/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&rt=c';
    var TIMEOUT_MS = 20000;
    var out = null;

    function errText(e) {
        try { return ((e && e.name) || 'Error') + ': ' + String((e && e.message) || e).slice(0, 120); }
        catch (x) { return 'unprintable error'; }
    }
    // The name only, for a parse of the answer: a V8 JSON.parse error's message quotes the text it could
    // not read, which here is the chat's own content (review round 1).
    function errName(e) {
        try { return String((e && e.name) || 'Error').slice(0, 40); }
        catch (x) { return 'unprintable error'; }
    }

    function line(s) {
        console.log(P + s);
        if (out) {
            var d = document.createElement('div');
            d.textContent = s;
            out.appendChild(d);
        }
    }

    function chatId() {
        var m = location.pathname.match(/^\/app\/([0-9a-f]{12,})$/);
        return m ? m[1] : null;
    }

    // The token, from the inline <script> text that every JavaScript world shares.
    function readAt() {
        var ss = document.querySelectorAll('script:not([src])');
        for (var i = 0; i < ss.length; i++) {
            var m = (ss[i].textContent || '').match(/"SNlM0e":"([^"]+)"/);
            if (m) return m[1];
        }
        return null;
    }

    function body(cid, at) {
        // The page's own argument list (Phase 1: [c_<id>, size, cursor, 1, [1], [4], null, 1]).
        var args = ['c_' + cid, 1, null, 1, [1], [4], null, 1];
        var freq = JSON.stringify([[['hNvQHb', JSON.stringify(args), null, 'generic']]]);
        return 'f.req=' + encodeURIComponent(freq) + '&at=' + encodeURIComponent(at);
    }

    // Status and shape only: whether a wrb.fr payload came back, its turn count, whether a
    // cursor is present; on a null payload, the error code Gemini put beside it.
    function describe(status, text, ms) {
        var s = 'HTTP ' + status;
        var payload = 'no wrb.fr entry';
        try {
            var ents = [];
            var ls = String(text || '').split('\n');
            for (var i = 0; i < ls.length; i++) {
                if (ls[i].charAt(0) !== '[') continue;
                try { ents = ents.concat(JSON.parse(ls[i])); } catch (e) {}
            }
            for (var j = 0; j < ents.length; j++) {
                var e2 = ents[j];
                if (!e2 || e2[0] !== 'wrb.fr') continue;
                if (e2[2] == null) {
                    payload = 'wrb.fr payload NULL (error ' + JSON.stringify(e2[5] === undefined ? null : e2[5]) + ')';
                } else {
                    var p = JSON.parse(e2[2]);
                    var turns = p && p[0] && p[0].length || 0;
                    payload = 'wrb.fr payload yes, turns ' + turns + ', cursor ' + (p[1] == null ? 'no' : 'yes');
                    s += ' · ' + payload + ' · ' + ms + ' ms';
                    return { ok: turns > 0, text: s };
                }
            }
        } catch (e) { payload = 'unreadable answer (' + errName(e) + ')'; }
        return { ok: false, text: s + ' · ' + payload + ' · ' + ms + ' ms' };
    }

    function viaFetch(cid, at, cb) {
        var t0 = Date.now(), done = false;
        var timer = setTimeout(function () { if (!done) { done = true; cb({ ok: false, text: 'FAILED (no answer in ' + TIMEOUT_MS + ' ms)' }); } }, TIMEOUT_MS);
        function fin(r) { if (done) return; done = true; clearTimeout(timer); cb(r); }
        try {
            fetch(location.origin + EP, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: body(cid, at)
            }).then(function (res) {
                return res.text().then(function (t) { fin(describe(res.status, t, Date.now() - t0)); });
            }).then(null, function (e) { fin({ ok: false, text: 'FAILED (' + errText(e) + ')' }); });
        } catch (e) { fin({ ok: false, text: 'FAILED (threw ' + errText(e) + ')' }); }
    }

    function viaGm(fn, cid, at, cb) {
        var t0 = Date.now(), done = false;
        var watch = setTimeout(function () { fin({ ok: false, text: 'FAILED (never called back)' }); }, TIMEOUT_MS + 5000);
        function fin(r) { if (done) return; done = true; clearTimeout(watch); cb(r); }
        try {
            var ret = fn({
                method: 'POST',
                url: location.origin + EP,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                data: body(cid, at),
                timeout: TIMEOUT_MS,
                onload: function (res) { fin(describe(res.status, res.responseText, Date.now() - t0)); },
                onerror: function (res) { fin({ ok: false, text: 'FAILED (onerror, status ' + ((res && res.status) || 0) + ' ' + String((res && (res.error || res.statusText)) || '').slice(0, 80) + ')' }); },
                ontimeout: function () { fin({ ok: false, text: 'FAILED (ontimeout)' }); }
            });
            // Some managers' GM.xmlHttpRequest also return a promise; a rejection is a failure.
            if (ret && typeof ret.then === 'function') ret.then(null, function (e) { fin({ ok: false, text: 'FAILED (rejected ' + errText(e) + ')' }); });
        } catch (e) { fin({ ok: false, text: 'FAILED (threw ' + errText(e) + ')' }); }
    }

    function run() {
        out.textContent = '';
        var info = null;
        try { info = (typeof GM_info !== 'undefined' && GM_info) ? GM_info : ((typeof GM !== 'undefined' && GM && GM.info) ? GM.info : null); } catch (e) {}
        var ua = navigator.userAgent;
        var browser = /Firefox\//.test(ua) ? 'Firefox' : (/Edg\//.test(ua) ? 'Edge' : (/Chrome\//.test(ua) ? 'Chrome' : (/Safari\//.test(ua) ? 'Safari' : 'other')));
        var acn = document.querySelector('[data-acn-version]');
        line('G0 v1 · ' + browser + ' · manager ' + (info ? info.scriptHandler + ' ' + info.version : 'unknown') +
             ' · navigator ' + (acn ? acn.getAttribute('data-acn-version') : 'not seen') + ' · tab ' + document.visibilityState);
        var cid = chatId();
        if (!cid) { line('Open a Gemini chat (an /app/<id> address), then click again.'); return; }
        var at = readAt();
        line('chat ' + cid.slice(0, 8) + ' · token in inline script text: ' + (at ? 'found' : 'NOT found'));
        if (!at) { line('No token: stopping (signed out, or the page changed). Done.'); return; }

        var gmDot = (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest : null;
        var steps = [
            ['fetch', function (cb) { viaFetch(cid, at, cb); }],
            ['GM_xmlhttpRequest', typeof GM_xmlhttpRequest === 'function' ? function (cb) { viaGm(GM_xmlhttpRequest, cid, at, cb); } : null],
            ['GM.xmlHttpRequest', gmDot ? function (cb) { viaGm(gmDot, cid, at, cb); } : null]
        ];
        var first = null;
        (function next(i) {
            if (i >= steps.length) {
                line('first transport with a payload: ' + (first || 'NONE (this manager gets the button fallback)') + '. Done.');
                return;
            }
            if (!steps[i][1]) { line(steps[i][0] + ': not present'); next(i + 1); return; }
            steps[i][1](function (r) {
                line(steps[i][0] + ': ' + r.text);
                if (r.ok && !first) first = steps[i][0];
                setTimeout(function () { next(i + 1); }, 800);
            });
        })(0);
    }

    function mount() {
        if (out || !document.body) return;
        var panel = document.createElement('div');
        panel.setAttribute('data-acn-g0', '1');
        panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;max-width:600px;max-height:40vh;overflow:auto;' +
            'background:#111;color:#eee;font:12px/1.45 ui-monospace,Menlo,monospace;padding:8px;border-radius:6px;user-select:text;';
        var b = document.createElement('button');
        b.textContent = 'ACN G0: run transport check';
        b.setAttribute('data-acn-g0-run', '1');
        b.style.cssText = 'font:12px sans-serif;padding:4px 8px;margin:0 6px 6px 0;cursor:pointer;';
        var x = document.createElement('button');
        x.textContent = 'hide';
        x.style.cssText = 'font:12px sans-serif;padding:4px 8px;margin:0 0 6px 0;cursor:pointer;';
        x.addEventListener('click', function () { panel.style.display = 'none'; });
        out = document.createElement('div');
        out.setAttribute('data-acn-g0-out', '1');
        b.addEventListener('click', function () { try { run(); } catch (e) { line('run threw ' + errText(e)); } });
        panel.appendChild(b);
        panel.appendChild(x);
        panel.appendChild(out);
        document.body.appendChild(panel);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
    setTimeout(mount, 3000);
}());
