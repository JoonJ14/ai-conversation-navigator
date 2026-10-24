// ==UserScript==
// @name         ACN C0 — cross-tab GM storage check
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Measurement only (the cross-tab PR, C0). Does a read in one tab see what another tab just wrote, without a reload? Writes only the scratch keys acn-c0-probe and acn-c0-probe-sync. Remove after use.
// @match        https://claude.ai/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// C0 of the cross-tab PR (v12.13), run by the owner on Safari + Userscripts, Chrome + Tampermonkey and
// Firefox + Tampermonkey. Claude Code cannot drive Safari, or install a script into the owner's
// managers. The fix re-reads the stored value right before each save; that only helps if a read in
// one tab returns what ANOTHER tab wrote since this tab loaded. B0 measured persistence across a
// reload, not this.
//
// How to run: open claude.ai in two tabs, A and B, and leave both loaded (no reload from here on).
// In B click "Write". In A click "Read". The box in A shows what each storage API returned and
// whether it came from tab B. Then the other way round: Write in A, Read in B.
// Reading it: a fresh cross-tab read names B's tab id (B's box title) and B's write number, and is
// a few seconds old. A value from an earlier run also says ANOTHER tab, but with an id no open tab
// has and a large age. The line that counts: GM_getValue on Tampermonkey (what the navigator uses
// there), GM.getValue on Userscripts.
//
// Every console line starts with [ACN-C0]. The only keys written are 'acn-c0-probe' (async API)
// and 'acn-c0-probe-sync' (synchronous API, where it exists), never a key the navigator uses.

(function () {
    'use strict';

    var P = '[ACN-C0] ';
    var KEY = 'acn-c0-probe';
    var TAB = Math.random().toString(16).slice(2, 6);
    var hasSync = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
    var hasAsync = typeof GM !== 'undefined' && GM !== null &&
                   typeof GM.getValue === 'function' && typeof GM.setValue === 'function';
    var n = 0;

    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#222;color:#eee;' +
        'font:12px/1.4 monospace;padding:8px;border:1px solid #888;border-radius:6px;max-width:420px';
    var title = document.createElement('div');
    var manager = 'n/a';
    try {
        var info = (typeof GM_info !== 'undefined' && GM_info) ? GM_info : (hasAsync && GM.info ? GM.info : null);
        if (info) manager = info.scriptHandler + ' ' + info.version;
    } catch (e) {}
    title.textContent = 'C0 tab ' + TAB + ' — ' + manager + ' — sync API: ' + (hasSync ? 'yes' : 'no') +
                        ', async API: ' + (hasAsync ? 'yes' : 'no') + ' — the line that counts: ' +
                        (hasSync ? 'GM_getValue' : 'GM.getValue');
    var out = document.createElement('div');
    out.style.whiteSpace = 'pre-wrap';
    out.textContent = 'not read yet';
    function button(label, fn) {
        var b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'margin:6px 6px 0 0;font:12px monospace';
        b.addEventListener('click', fn);
        return b;
    }
    function show(lines) {
        out.textContent = lines.join('\n');
        lines.forEach(function (l) { console.log(P + l); });
    }
    function describe(api, v) {
        if (v === undefined || v === null) return api + ': nothing stored yet';
        var o = v;
        if (typeof v === 'string') { try { o = JSON.parse(v); } catch (e) { return api + ': unreadable ' + JSON.stringify(v); } }
        if (!o || !o.tab) return api + ': unexpected ' + JSON.stringify(v);
        return api + ': write #' + o.n + ' from tab ' + o.tab + (o.tab === TAB ? ' (THIS tab)' : ' (ANOTHER tab)') +
               ', written ' + Math.round((Date.now() - o.at) / 1000) + ' s ago' +
               ' (fresh if the id is the other open tab\'s and the age is a few seconds)';
    }

    function write() {
        n++;
        var v = JSON.stringify({ tab: TAB, n: n, at: Date.now() });
        var lines = ['wrote #' + n + ' from tab ' + TAB];
        if (hasSync) {
            try { GM_setValue(KEY + '-sync', v); lines.push('GM_setValue: ok'); }
            catch (e) { lines.push('GM_setValue: THREW ' + e); }
        }
        if (!hasAsync) { show(lines); return; }
        GM.setValue(KEY, v).then(function () { lines.push('GM.setValue: ok'); show(lines); },
                                 function (e) { lines.push('GM.setValue: REJECTED ' + e); show(lines); });
    }

    function read() {
        var lines = ['read in tab ' + TAB + ' at ' + new Date().toLocaleTimeString()];
        if (hasSync) {
            try { lines.push(describe('GM_getValue', GM_getValue(KEY + '-sync', null))); }
            catch (e) { lines.push('GM_getValue: THREW ' + e); }
        }
        if (!hasAsync) { show(lines); return; }
        GM.getValue(KEY, null).then(function (v) { lines.push(describe('GM.getValue', v)); show(lines); },
                                    function (e) { lines.push('GM.getValue: REJECTED ' + e); show(lines); });
    }

    box.appendChild(title);
    box.appendChild(button('Write', write));
    box.appendChild(button('Read', read));
    box.appendChild(out);
    function attach() { if (document.body) document.body.appendChild(box); else setTimeout(attach, 200); }
    attach();
    console.log(P + title.textContent);
}());
