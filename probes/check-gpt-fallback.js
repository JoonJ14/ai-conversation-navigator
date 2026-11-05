#!/usr/bin/env node
// check-gpt-fallback.js — v12.18 Part 2 (docs/specs/v12.18-spec.md): ChatGPT answer bookmarks on a
// "fallback" turn. The ChatGPT windowed mock with bmModel.fallbackAt: turn 6 has two shown text
// nodes; the page renders the FIRST as a turn of its own with no question, in the markup measured
// live (Chrome, 12.17, 2026-11-05: [data-turn-key="fallback-turn-0"], one unit carrying both unit
// keys and the node's id twice), and the turn's own unit names the LAST, the index's key (the
// 2026-11-01 measurement). The live chat's Q45 had one shown node on 2026-11-05 (DOM-REFERENCE).
//
//   F1 [guard] the fallback unit's flag carries the index's key; a click saves ONE record under it,
//              labelled "Answer to Q#6" (v12.17 already: _bmIxCanon on the flag)
//   F2 [new]   both units mounted (the fallback wrapper twice, as live): every flag lit for that record;
//              the turn's own flag removes it
//              (v12.17 lit only the clicked one: toggleBookmark updated its own icon)
//   F3 [new]   a record saved under the first node (as v12.16 saved it) is rewritten to the index's
//              key once the index lists it: one record, "Answer to Q#6", the log line; a bookmark another
//              tab saves while the index loads (written into storage when the request arrives) is kept
//   F4 [new]   that legacy record beside one already under the index's key: one record stays, the latter
//   F5 [guard] the rewritten record's card jumps to turn 6's answer, in view
//   F6 [guard] a record whose id the index does not list is left as it is, "A#?"
//   F8 [new]   Safari's storage (async GM.getValue / GM.setValue only): the rewrite is applied again when
//              its queued write runs, after a slow read (2.5 s), by which time the page shows another
//              conversation whose index does not list these ids: the stored record still gets the key
//   F7 [new]   turn 6 mounted while the index is still loading (its flags drawn under the raw ids): once
//              the index lands and the legacy record is rewritten, the turn's own flag is lit too
//              (a dark flag on a bookmarked answer would remove the bookmark when clicked)
//   E          no page errors
//
// CONTEXT of these results: Playwright <engine>, page realm, headless, this machine; the userscript
// inlined into the mock, GM storage and the requests stubbed. Not a userscript manager and not
// ChatGPT's real markup beyond the measured wrapper: real-browser acceptance is the owner's (DEC-031).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const GPT_CONV = '6994e2d6-ce6c-832a-aa7d-04b747928fd8';
const URL0 = 'https://chatgpt.com/c/' + GPT_CONV;
const N = 24, FB = 5;   // turn 6 (index 5) is the fallback turn
const uuid = (n, tag) => (tag || 'aaaaaaaa') + '-0000-4000-8000-' + String(n).padStart(12, '0');
function turns() {
    return Array.from({ length: N }, (_, i) => {
        const t = { id: uuid(i), text: 'ChatGPT probe question ' + (i + 1) + ' about windowing?', aid: uuid(i, 'cccccccc'),
                    answer: 'Answer ' + (i + 1) + ': the window holds a few turns and drops the rest.' };
        if (i === FB) { t.fbAid = uuid(i, 'dddddddd'); t.fbAnswer = 'First part of answer 6: the fallback unit.'; t.answer = 'and the second part of answer 6'; }
        return t;
    });
}
function mapping(T) {
    const m = {};
    const add = (id, parent, message) => { m[id] = { id, parent, children: [], message }; if (parent) m[parent].children.push(id); };
    add('client-created-root', null, null);
    add('sys-0', 'client-created-root', { id: 'sys-0', author: { role: 'system' }, content: { content_type: 'text', parts: [''] }, metadata: {} });
    let prev = 'sys-0';
    T.forEach((t) => {
        add(t.id, prev, { id: t.id, author: { role: 'user' }, content: { content_type: 'text', parts: [t.text] }, metadata: {} });
        prev = t.id;
        if (t.fbAid) {
            add(t.fbAid, prev, { id: t.fbAid, author: { role: 'assistant' }, recipient: 'all', content: { content_type: 'text', parts: [t.fbAnswer] }, metadata: {} });
            prev = t.fbAid;
        }
        add(t.aid, prev, { id: t.aid, author: { role: 'assistant' }, recipient: 'all', content: { content_type: 'text', parts: [t.answer] }, metadata: {} });
        prev = t.aid;
    });
    return { title: 'probe', conversation_id: GPT_CONV, mapping: m, current_node: prev };
}
const rec = (id, key, preview) => ({ id, schema: 2, entityType: 'ai-msg', contentHash: key, msgUuid: key, preview,
                                     msgIndex: FB, createdAt: 1, platform: 'chatgpt.com' });
const storeWith = (list) => ({ 'acn-bookmarks-v1': JSON.stringify({ [URL0]: { bookmarks: list } }) });

function page(script, cfg, store, safari) {
    const mock = fs.readFileSync(path.join(REPO, 'tests/mock-pages/chatgpt-windowed.html'), 'utf8');
    const head = (mock.match(/<head[^>]*>([\s\S]*)<\/head>/i) || [])[1] || '';
    const body = (mock.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || mock;
    return `<!DOCTYPE html><html><head>${head}</head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(cfg)};</script>
${body}
<script>
delete window._aiNavAlreadyLoaded;
var _s = ${JSON.stringify(store || {})};
if (${safari ? 'true' : 'false'}) {
    // Safari's GM storage holds each value as JSON text (acnStoreLoad, acnPersist): the bookmark
    // store's value is itself JSON text, so it is encoded once more here.
    Object.keys(_s).forEach(function (k) { _s[k] = JSON.stringify(_s[k]); });
    // Safari's Userscripts: only the async API (check-gm-storage's model). window.__slowRead makes the
    // bookmark key's reads answer late, as a queued write's re-read can.
    window.__slowRead = false;
    window.GM = {
        getValue: function (k) { return new Promise(function (r) {
            setTimeout(function () { r(_s.hasOwnProperty(k) ? _s[k] : undefined); },
                       (k === 'acn-bookmarks-v1' && window.__slowRead) ? 2500 : 5); }); },
        setValue: function (k, v) { return new Promise(function (r) { setTimeout(function () { _s[k] = v; r(); }, 5); }); }
    };
} else {
    window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
    window.GM_setValue = function (k, v) { _s[k] = v; };
}
window.__records = function () { var t = _s['acn-bookmarks-v1']; if (!t) return []; var o = JSON.parse(t);
    return (o[${JSON.stringify(URL0)}] && o[${JSON.stringify(URL0)}].bookmarks) || []; };
</script>
<script>${script}</script></body></html>`;
}

// The flags of turn 6: its fallback unit's and its own answer unit's.
const FLAGS = `(function (turnId) {
    var fbs = document.querySelectorAll('#mock-scroller [data-turn-key="fallback-turn-0"] [data-acn-bookmark]');
    var fb = fbs[0] || null;
    var t = document.querySelector('#mock-scroller [data-turn-key="' + turnId + '"]');
    var units = t ? t.querySelectorAll('[data-content-search-unit-key$=":assistant"]') : [];
    var own = null;
    // The turn's own unit: the one whose nearest turn is this turn, not the fallback wrapper (every
    // unit's key is window-relative, "fallback-turn-<i>:...", live and in the mock).
    for (var i = 0; i < units.length; i++) {
        if (units[i].closest('[data-turn-key]') === t) own = units[i].querySelector('[data-acn-bookmark]');
    }
    var d = function (f) { return f ? { key: f.getAttribute('data-acn-bookmark'), lit: f.classList.contains('acn-bm-active') } : null; };
    return { fb: d(fb), own: d(own), copies: Array.prototype.map.call(fbs, d) };
})`;
const CARDS = `(function () {
    var p = document.getElementById('acn-panel-bookmarks');
    if (!p || !p.classList.contains('acn-open')) { var d = document.getElementById('acn-dot-bookmarks'); if (d) d.click(); }
    return new Promise(function (r) { setTimeout(function () {
        r(Array.prototype.map.call(document.querySelectorAll('#acn-panel-bookmarks .acn-bk'), function (c) {
            var t = c.querySelector('.acn-bk-type'); return t ? t.textContent : null; }));
    }, 600); });
})()`;

(async () => {
    const argv = process.argv;
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = argv.includes('--quiet');
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    let failures = 0, invalid = 0;
    const pageErrors = [];
    function check(id, label, desc, ok, detail) {
        if (!ok) failures++;
        if (!ok || !quiet) console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + id + ' [' + label + '] ' + desc + (detail ? ' — ' + detail : ''));
    }
    function precondition(id, ok, detail) {
        if (ok) return true;
        invalid++;
        console.log('  INVALID  ' + id + ' precondition failed' + (detail ? ' — ' + detail : ''));
        return false;
    }
    async function open(store, onIndexRequest, safari, otherConv) {
        const T = turns();
        const html = page(raw, { turns: T, bmModel: { h: 420, window: 6, fallbackAt: FB, fallbackCopies: 2 } }, store, safari);
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const pg = await context.newPage();
        const logs = [];
        pg.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
        pg.on('console', (m) => logs.push(m.text()));
        await pg.route('**/*', (route) => {
            const u = route.request().url();
            if (u === URL0) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }).catch(() => {});
            // Another conversation, whose index lists none of this one's ids.
            if (otherConv && u.indexOf('/backend-api/conversation/' + otherConv) !== -1) {
                const T2 = turns().map((t, i) => Object.assign({}, t, { id: uuid(i, 'eeee0000'), aid: uuid(i, 'eeee1111'), fbAid: t.fbAid ? uuid(i, 'eeee2222') : undefined }));
                const m = mapping(T2); m.conversation_id = otherConv;
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) }).catch(() => {});
            }
            if (u.endsWith('/api/auth/session')) return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify({ accessToken: 'tok', expires: '2099-01-01T00:00:00.000Z' }) }).catch(() => {});
            if (u.indexOf('/backend-api/conversation/' + GPT_CONV) !== -1) {
                const send = () => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mapping(T)) }).catch(() => {});
                if (onIndexRequest) return onIndexRequest(pg).then(send, send);
                return send();
            }
            route.abort().catch(() => {});
        });
        await pg.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await pg.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
        await pg.evaluate("document.getElementById('acn-dot-nav').click()");
        let ready = true;
        try {
            await pg.waitForFunction((n) => { const s = document.getElementById('acn-nav-stat'); return s && s.getAttribute('data-acn-count') === String(n); }, N, { timeout: 20000 });
        } catch (e) { ready = false; }
        await pg.evaluate("document.getElementById('acn-dot-nav').click()");   // close Navigate again
        await pg.evaluate((i) => window.__mockWindow.userScrollTo(i), FB);
        await pg.waitForTimeout(2000);
        return { context, pg, logs, T, ready };
    }

    console.log('check-gpt-fallback — engine=' + engine + ', script=' + path.basename(scriptPath));

    // F1, F2: no records; a click on the fallback unit's flag, then on the turn's own.
    {
        const o = await open(null);
        const f0 = await o.pg.evaluate(FLAGS + '(' + JSON.stringify(o.T[FB].id) + ')');
        if (precondition('F1', o.ready && f0.fb && f0.own, 'ready=' + o.ready + ' flags=' + JSON.stringify(f0))) {
            await o.pg.evaluate("document.querySelector('#mock-scroller [data-turn-key=\"fallback-turn-0\"] [data-acn-bookmark]').click()");
            await o.pg.waitForTimeout(1200);
            const recs = await o.pg.evaluate('window.__records()');
            const f1 = await o.pg.evaluate(FLAGS + '(' + JSON.stringify(o.T[FB].id) + ')');
            const cards = await o.pg.evaluate(CARDS);
            check('F1', 'guard', 'the fallback unit\'s flag carries the index\'s key; one record under it, "Answer to Q#6"',
                f0.fb.key === o.T[FB].aid && recs.length === 1 && recs[0].msgUuid === o.T[FB].aid && cards.join() === 'Answer to Q#6',
                'flags=' + JSON.stringify(f0) + ' records=' + JSON.stringify(recs.map((r) => r.msgUuid)) + ' cards=' + JSON.stringify(cards));
            await o.pg.evaluate("document.getElementById('acn-dot-bookmarks').click()");
            await o.pg.waitForTimeout(400);
            await o.pg.evaluate((id) => { const t = document.querySelector('#mock-scroller [data-turn-key="' + id + '"]');
                const us = t.querySelectorAll('[data-content-search-unit-key$=":assistant"]');
                for (let i = 0; i < us.length; i++) if (us[i].closest('[data-turn-key]') === t) us[i].querySelector('[data-acn-bookmark]').click(); }, o.T[FB].id);
            await o.pg.waitForTimeout(1200);
            const after = await o.pg.evaluate('window.__records()');
            check('F2', 'new', 'both units mounted (the wrapper twice): every flag lit for the one record; the turn\'s own flag removes it',
                f1.copies.length === 2 && f1.copies.every((c) => c.lit && c.key === o.T[FB].aid) && f1.own && f1.own.lit &&
                f1.own.key === o.T[FB].aid && after.length === 0, 'lit=' + JSON.stringify(f1) + ' after=' + after.length);
        }
        await o.context.close();
    }

    // F3, F5: a record saved under the first node.
    {
        const T = turns();
        const other = { id: 'bm_other_tab', schema: 2, entityType: 'user-msg', contentHash: T[2].id, msgUuid: T[2].id,
                        preview: 'saved by another tab', msgIndex: 2, createdAt: 2, platform: 'chatgpt.com' };
        const o = await open(storeWith([rec('bm_legacy', T[FB].fbAid, 'First part of answer 6: the fallback unit.')]),
            (pg) => pg.evaluate((b) => { var t = JSON.parse(_s['acn-bookmarks-v1']); var k = Object.keys(t)[0];
                                         t[k].bookmarks.push(b); _s['acn-bookmarks-v1'] = JSON.stringify(t); }, other));
        await o.pg.waitForTimeout(1500);
        const all = await o.pg.evaluate('window.__records()');
        const recs = all.filter((r) => r.id !== 'bm_other_tab');
        const kept = all.some((r) => r.id === 'bm_other_tab');
        const cards = await o.pg.evaluate(CARDS);
        const line = o.logs.filter((l) => l.indexOf('[ACN] bookmarks: 1 ChatGPT answer record(s) moved to the index\'s key') === 0).length;
        if (precondition('F3', o.ready, 'ready=' + o.ready)) {
            check('F3', 'new', 'a record saved under the first node is rewritten to the index\'s key: one record, "Answer to Q#6", logged once',
                recs.length === 1 && recs[0].id === 'bm_legacy' && recs[0].msgUuid === T[FB].aid && recs[0].contentHash === T[FB].aid &&
                cards.join().indexOf('Answer to Q#6') !== -1 && line === 1 && kept,
                'records=' + JSON.stringify(recs.map((r) => [r.id, r.msgUuid.slice(0, 8), r.contentHash.slice(0, 8)])) + ' cards=' + JSON.stringify(cards) +
                ' lines=' + line + ' otherTabKept=' + kept);
            // F5: from the bottom, the card jumps to turn 6's answer.
            await o.pg.evaluate("window.__mockWindow.userScrollTo('bottom')");
            await o.pg.waitForTimeout(1500);
            await o.pg.evaluate("(function () { var cs = document.querySelectorAll('#acn-panel-bookmarks .acn-bk');" +
                " for (var i = 0; i < cs.length; i++) { var t = cs[i].querySelector('.acn-bk-type');" +
                " if (t && t.textContent === 'Answer to Q#6') { cs[i].click(); return; } } }())");
            let landed = null;
            for (let k = 0; k < 40 && !landed; k++) {
                await o.pg.waitForTimeout(500);
                landed = await o.pg.evaluate((id) => {
                    const sc = document.getElementById('mock-scroller');
                    const t = sc.querySelector('[data-turn-key="' + id + '"]');
                    if (!t) return null;
                    const r = t.getBoundingClientRect(), s = sc.getBoundingClientRect();
                    return (r.bottom > s.top + 20 && r.top < s.bottom - 20) ? { top: Math.round(r.top - s.top) } : null;
                }, T[FB].id);
            }
            check('F5', 'guard', 'the rewritten record\'s card jumps to turn 6, in view', !!landed, JSON.stringify(landed));
        }
        await o.context.close();
    }

    // F4: the legacy record beside one already under the index's key.
    {
        const T = turns();
        const o = await open(storeWith([rec('bm_legacy', T[FB].fbAid, 'First part'), rec('bm_canon', T[FB].aid, 'and the second part')]));
        await o.pg.waitForTimeout(1500);
        const recs = await o.pg.evaluate('window.__records()');
        if (precondition('F4', o.ready, 'ready=' + o.ready)) {
            check('F4', 'new', 'a legacy record beside one under the index\'s key: one record stays, the latter',
                recs.length === 1 && recs[0].id === 'bm_canon' && recs[0].msgUuid === T[FB].aid,
                JSON.stringify(recs.map((r) => [r.id, r.msgUuid.slice(0, 8)])));
        }
        await o.context.close();
    }

    // F6: an id the index does not list.
    {
        const ghost = uuid(999, 'eeeeeeee');
        const o = await open(storeWith([rec('bm_ghost', ghost, 'an answer that is gone')]));
        await o.pg.waitForTimeout(1500);
        const recs = await o.pg.evaluate('window.__records()');
        const cards = await o.pg.evaluate(CARDS);
        if (precondition('F6', o.ready, 'ready=' + o.ready)) {
            check('F6', 'guard', 'an id the index does not list stays as it is, "A#?"',
                recs.length === 1 && recs[0].msgUuid === ghost && cards.join() === 'A#?', JSON.stringify(recs.map((r) => r.msgUuid)) + ' cards=' + JSON.stringify(cards));
        }
        await o.context.close();
    }

    // F7: the index answers 3 s after its request; turn 6 is scrolled into view first.
    {
        const T = turns();
        const o = await open(storeWith([rec('bm_legacy', T[FB].fbAid, 'First part of answer 6: the fallback unit.')]),
            async (pg) => { await pg.evaluate((i) => window.__mockWindow.userScrollTo(i), FB); await pg.waitForTimeout(3000); });
        await o.pg.waitForTimeout(2000);
        const f = await o.pg.evaluate(FLAGS + '(' + JSON.stringify(T[FB].id) + ')');
        const recs = await o.pg.evaluate('window.__records()');
        if (precondition('F7', o.ready && f.own && f.copies.length === 2, 'ready=' + o.ready + ' ' + JSON.stringify(f))) {
            check('F7', 'new', 'turn 6 drawn while the index loaded: after the rewrite, its own flag and both fallback flags are lit',
                recs.length === 1 && recs[0].msgUuid === T[FB].aid && f.own.lit && f.own.key === T[FB].aid &&
                f.copies.every((c) => c.lit && c.key === T[FB].aid), JSON.stringify(f) + ' records=' + JSON.stringify(recs.map((r) => r.msgUuid.slice(0, 8))));
        }
        await o.context.close();
    }

    // F8: Safari's storage; the queued write re-reads slowly, and the page moves to conversation B meanwhile.
    {
        const T = turns();
        const B = '6994e2d6-ce6c-832a-aa7d-0000000000bb';
        const o = await open(storeWith([rec('bm_legacy', T[FB].fbAid, 'First part of answer 6: the fallback unit.')]),
            (pg) => pg.evaluate(() => { window.__slowRead = true; }), true, B);
        await o.pg.waitForTimeout(300);
        await o.pg.evaluate((b) => { history.pushState({}, '', '/c/' + b); var n = document.createElement('div'); document.body.appendChild(n); n.remove(); }, B);
        await o.pg.waitForTimeout(5000);
        const stored = await o.pg.evaluate((u) => { var t = _s['acn-bookmarks-v1']; if (!t) return null; var x = JSON.parse(JSON.parse(t));
            return (x[u] && x[u].bookmarks) || null; }, URL0);
        const line = o.logs.filter((l) => l.indexOf('[ACN] bookmarks: 1 ChatGPT answer record(s) moved') === 0).length;
        if (precondition('F8', o.ready, 'ready=' + o.ready)) {
            check('F8', 'new', 'Safari\'s queued write, replayed after a switch to a conversation that does not list the ids: the stored record has the index\'s key',
                line === 1 && !!stored && stored.length === 1 && stored[0].msgUuid === T[FB].aid && stored[0].contentHash === T[FB].aid,
                'moved-lines=' + line + ' stored=' + JSON.stringify(stored && stored.map((r) => r.msgUuid.slice(0, 8))));
        }
        await o.context.close();
    }

    check('E', 'guard', 'no page errors', pageErrors.length === 0, pageErrors.slice(0, 4).join(' | '));
    await browser.close();
    console.log('check-gpt-fallback — ' + engine + ': ' + (failures ? failures + ' FAIL' : 'all pass') + (invalid ? ', ' + invalid + ' INVALID' : ''));
    process.exit(failures || invalid ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
