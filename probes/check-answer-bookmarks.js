// Checks for Claude answer bookmarks (v12.14, the answer-bookmark PR, DEC-051).
//
// Run: node probes/check-answer-bookmarks.js [--browser chromium|firefox|webkit] [--quiet]
// ACN_SCRIPT=<path> runs another build (v12.13, or a mutant). Exits non-zero on any failed check.
// --mint-seeds (with ACN_SCRIPT pointed at v12.13) rebuilds probes/fixtures/answer-bookmark-seeds.json.
//
// THE BUG THIS GATES (owner, v12.12/v12.13, all three browsers; Chrome page realm, 2026-10-23/24):
//   - in a project chat no answer had a flag: getAIMessages returns the first answer selector that
//     matches anything in the document, and '.font-claude-response' now matches the project's name
//     link in a hidden side panel, so the only flag went on that link;
//   - elsewhere answers had flags, but their identity was a hash of their text, because a rendered
//     answer opens with an activity line the payload lacks. So the label was the answer's position
//     on screen ("answer 1, 1, 1"), and a jump to an answer off screen failed;
//   - existing answer bookmarks were never bound to their message, and the console said "all
//     records carry a uuid" while they were there.
//
// Runs and checks. [new] must fail on v12.13 and pass on the fix; [guard] passes on both;
// [control] calibrates an instrument and shows refetches on both.
//   R1 a chat outside a project; answers as [data-testid="assistant-message"] with an activity
//      line; question 9 has no answer, so from turn 10 an answer's count is one less than its
//      question's number. The page starts at the top; every answer below row 5 mounts only after
//      scrolling.
//     A1  [guard] every mounted answer has exactly one flag, at every scroll stop
//     A2  [new]   every answer's flag carries its message's uuid, at every stop
//     A3  [new]   bookmarks made on answers that mounted only after scrolling store that uuid
//     A4  [new]   their labels read "Answer to Q#n" with the right n, and differ from each other
//     A5  [new]   a jump to an answer that is not mounted lands on it, with no toast
//     A6  [guard] no index refetch while scrolling across windows: 1 conversation fetch, no
//                 "out of sync" line (a build reading answers in the staleness check refetches)
//     A7  [guard] questions unchanged: uuid flags, the Navigate count, a question bookmark's label
//     A8  [guard] nothing but the flag is injected into an answer, and the flag holds no label text
//     A36 [new]   the bookmark export uses the same labels, an answer right after its question
//   R2 a project chat: the hidden project link is on the page before the script runs; one leading
//      interrupted generation, so a row's path index is its row number + 1; and after question 5 an
//      answer entry WITH a stop_reason that the page never renders, so the stop_reason predicate is
//      wrong from there on (the suite's "ghost" shape).
//     A9  [new]   every mounted answer has a flag, at load and after scrolling
//     A10 [new]   the project link never gets a flag
//     A11 [new]   a bookmark made after scrolling stores the uuid, labelled "Answer to Q#n"
//     A12 [new]   a jump to it from far away lands, with no toast
//     A13 [new]   after a bookmark is removed with the panel's ✕, every mounted answer has a flag
//     A28 [new]   every answer row (each one mounted in turn) outside the ghost's group carries its own uuid
//                 (the ghost's group may stay unplaced, never another message's uuid): placing rows by the
//                 predicate alone fails here
//   R3 bookmarks made by v12.13 (seeded, synchronous storage, the Tampermonkey shape):
//      P on answer 1, P2 on answer 12, T on answer 16 (whose text equals answer 2's), QB on
//      question 1, X on answer 3, W1 = P's hash with the row of answer 3, D on the project link; and XB, a
//      bound record of answer 3 (synthesized: v12.13 never binds an answer with an activity line).
//     A14 [new]   P is bound at load by proof (its row and its hash), labelled "Answer to Q#1"
//     A15 [new]   P2 reads "A#?" until its row mounts, then binds, "Answer to Q#12"
//     A16 [new]   W1 (wrong row) stays unbound and unchanged, "A#?"
//     A17 [new]   D reads "A#?"; clicking it shows the answer toast and marks nothing; ✕ deletes only D
//     A18 [new]   the twin: at load answer 2 renders T's text, but T was made on answer 16. Answer 2's
//                 flag is not lit by T; T's card does not jump to answer 2; clicking answer 2's flag
//                 keeps T; and T binds to answer 16 once that row mounts
//     A19 [new]   the console no longer says "all records carry a uuid", and names D
//     A20 [new]   after a reload P and P2 are still bound and labelled; idle, nothing is written
//     A27 [new]   X, made on answer 3, is provable, but XB already bookmarks answer 3: X is removed, XB kept
//                 (and L, bound to answer 1 only by inference, a pre-v12.0 preview rule, does not make P a
//                 second record: A14 needs P bound)
//     A33 [new]   another tab stores Z (answer 3's hash, made on its row) while nothing on screen changes; the
//                 next scan's proof finds it (answer 3 is already bookmarked, so Z is removed)
//   R4 the R3 seeds, async storage only (Safari + Userscripts' shape):
//     A21 [new]   P binds at load through the async storage
//     A22 [guard] two tabs: B deletes P2 before A has mounted its row; A's binding does not bring it back
//     A35 [new]   in Korean, P's label reads "Q#1에 대한 답변"
//   R5 the newest answer, the status line, and the old markup:
//     A23 [guard] with only bound records the console says "all records carry a uuid"
//     A24 [new]   the index was fetched while the last answer was still being written (no
//                 stop_reason); its flag is clicked: one refresh is fetched, and the bookmark binds,
//                 "Answer to Q#6"
//     A25 [control] the July markup ('.font-claude-response' inside rows) with activity lines: the
//                 staleness check reads answers and refetches (2+ fetches in a 20 s sweep), on both builds
//     A26 [guard] the July markup: every mounted answer has a flag
//   R6 recycled nodes (Claude reuses message nodes as it scrolls; the mock does not, so a node is moved by
//      hand). The index answers only after 7 s, so at first every answer's flag is unplaced (a text hash).
//      Seeds: P (answer 1's hash, made on row 1) and N (answer 3's hash, with no row).
//     A32 [new]   a record with no row does not light an unplaced flag with its hash (N, answer 3)
//     A30 [new]   answer 1's node moved into row 5 (same text, as for two identical answers): once the scan
//                 runs, its flag is dark there (P was made on row 1)
//     A29 [new]   the same move, clicked at once (before the scan): P is not removed and nothing is added
//     A31 [new]   once the index is ready (P bound to answer 1), answer 1's node recycled into row 5 showing
//                 answer 3's text, clicked at once: P stays, bound to answer 1
//     A34 [new]   a bound record (B2, answer 2) reads "Answer to Q#?" before the index lands, "Answer to Q#2" after
//
// CONTEXT of these results: Playwright <engine>, page realm, headless, this machine; the userscript
// inlined into the virtualizing Claude mock, GM storage and the conversation request stubbed. Not a
// userscript manager, and not Claude's real markup: real-browser acceptance on Safari + Userscripts,
// Chrome + Tampermonkey and Firefox + Tampermonkey is the owner's (DEC-031).

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const ORG  = '99999999-9999-4999-8999-999999999999';
const CONV = 'a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5';
const PROJ = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
const CHAT_URL = 'https://claude.ai/chat/' + CONV;
const PROJ_URL = 'https://claude.ai/project/' + PROJ + '/chat/' + CONV;
const SEEDS_FILE = path.join(__dirname, 'fixtures', 'answer-bookmark-seeds.json');
const IDENT_TEXT = 'Identical answer text used twice so a legacy preview is ambiguous.';

// The fixtures. Row numbers are the mock's; `turns` questions, minus the unanswered answers.
const FIX_MAIN  = { turns: 24, unanswered: [9], ident: [] };
const FIX_SEEDS = { turns: 24, unanswered: [9], ident: [3, 30] };   // answers 2 and 16 are twins
const FIX_SHORT = { turns: 6, unanswered: [], ident: [] };
const FIX_OLD   = { turns: 12, unanswered: [], ident: [] };

// Rows exactly as the mock builds them: { sender: 'user'|'ai', turn }.
function mockRows(fix) {
    const rows = [];
    const total = fix.turns * 2 - fix.unanswered.length;
    for (let t = 1; rows.length < total; t++) {
        rows.push({ sender: 'user', turn: t });
        if (fix.unanswered.indexOf(t) === -1 && rows.length < total) rows.push({ sender: 'ai', turn: t });
    }
    return rows;
}

// The conversation payload, byte-identical to the mock's texts (a question's DOM text ends with
// the mock's visible not-sr-only span). An unanswered turn's question is followed by an interrupted
// generation (no stop_reason, never rendered). lead: one interrupted generation first.
// openLast: the last answer has no stop_reason yet (the index was fetched mid-stream).
function buildPayload(fix, opts) {
    opts = opts || {};
    const rows = mockRows(fix);
    const messages = [];
    const truth = { rowPath: [], rowUuid: [], rowTurn: [] };
    let seq = 0;
    const uuidFor = (i) => CONV.slice(0, 24) + String(i).padStart(12, '0');
    const push = (m) => {
        m.uuid = uuidFor(seq);
        m.parent_message_uuid = seq === 0 ? '00000000-0000-4000-8000-000000000000' : uuidFor(seq - 1);
        m.index = 1000 + seq * 3;          // the payload's own index runs across the tree, not the path
        m.created_at = '2026-10-01T00:00:00Z'; m.text = '';
        m.attachments = []; m.files = [];
        messages.push(m); return seq++;
    };
    if (opts.lead) push({ sender: 'assistant', content: [{ type: 'text', text: 'Conversation started.' }] });
    rows.forEach((r, i) => {
        let p;
        if (r.sender === 'user') {
            p = push({ sender: 'human', content: [{ type: 'text', text:
                'Question number ' + r.turn + ': how do I handle case ' + r.turn + ' when the input is unusual?' +
                ' VISIBLE-NOT-SR-ONLY' }] });
        } else {
            const text = fix.ident.indexOf(i) !== -1 ? IDENT_TEXT
                : 'Answer number ' + r.turn + ': validate the input first, then branch on the result.';
            const m = { sender: 'assistant', content: [{ type: 'text', text: text }] };
            if (!(opts.openLast && i === rows.length - 1)) m.stop_reason = 'end_turn';
            p = push(m);
        }
        truth.rowPath[i] = p; truth.rowUuid[i] = uuidFor(p); truth.rowTurn[i] = r.turn;
        if (r.sender === 'user' && opts.ghostAfterQuestion === r.turn) {
            push({ sender: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text:
                'Ghost entry after question ' + r.turn + ' — completed per stop_reason, yet never rendered.' }] });
        }
        if (r.sender === 'user' && fix.unanswered.indexOf(r.turn) !== -1) {
            push({ sender: 'assistant', content: [{ type: 'text', text:
                'Interrupted answer to question ' + r.turn + ' — the client renders no row for it.' }] });
        }
    });
    return { payload: { uuid: CONV, name: 'Answer bookmark checks', current_leaf_message_uuid: uuidFor(seq - 1),
                        chat_messages: messages }, truth, rows };
}

function rowOfAnswer(fix, turn) {
    const rows = mockRows(fix);
    for (let i = 0; i < rows.length; i++) if (rows[i].sender === 'ai' && rows[i].turn === turn) return i;
    return -1;
}
function rowOfQuestion(fix, turn) {
    const rows = mockRows(fix);
    for (let i = 0; i < rows.length; i++) if (rows[i].sender === 'user' && rows[i].turn === turn) return i;
    return -1;
}

// opts: { fix, markup: 'new'|'old', decoy, lead, payloads: [..], storage: 'sync'|'async', seed: store|null }
function buildPage(scriptContent, opts) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const total = opts.fix.turns * 2 - opts.fix.unanswered.length;
    const mockConfig = { totalMessages: total, tailRows: 3, answerHeaders: true,
                         answerTestid: opts.markup !== 'old', unansweredTurns: opts.fix.unanswered,
                         identicalAnswerRows: opts.fix.ident, decoy: opts.decoy || undefined };
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>answer bookmark checks</title></head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(mockConfig)};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var PAYLOADS = ${JSON.stringify(opts.payloads.map((p) => JSON.stringify(p)))};
    var MODE = ${JSON.stringify(opts.storage || 'sync')};
    var LATENCY = ${JSON.stringify(opts.latencyMs || 10)};
    var SEED = ${JSON.stringify(opts.seed ? JSON.stringify(opts.seed) : null)};
    var LANG = ${JSON.stringify(opts.lang || null)};
    window.__acn = { fetches: 0, gmWrites: 0, toasts: [], flashes: [] };
    var prefix = MODE === 'sync' ? '__gmsync:' : '__gmasync:';
    // Seeded once per browser context, so a reload keeps what the page stored since.
    if (SEED !== null && !localStorage.getItem('__seeded')) {
        localStorage.setItem(prefix + 'acn-bookmarks-v1',
            JSON.stringify(MODE === 'sync' ? SEED : JSON.stringify(SEED)));
        // Settings are an object: the sync stub holds it as is, the async one as its JSON text.
        if (LANG) localStorage.setItem(prefix + 'acn-settings',
            JSON.stringify(MODE === 'sync' ? { language: LANG } : JSON.stringify({ language: LANG })));
        localStorage.setItem('__seeded', '1');
    }
    function lsGet(k) { var t = localStorage.getItem(prefix + k); return t === null ? undefined : JSON.parse(t); }
    function lsSet(k, v) { localStorage.setItem(prefix + k, JSON.stringify(v)); }
    if (MODE === 'sync') {
        window.GM_getValue = function (k, d) { var v = lsGet(k); return v === undefined ? d : v; };
        window.GM_setValue = function (k, v) { window.__acn.gmWrites++; lsSet(k, v); };
    } else {
        window.GM = {
            getValue: function (k, d) { var v = lsGet(k); return Promise.resolve(v === undefined ? d : v); },
            setValue: function (k, v) { window.__acn.gmWrites++; lsSet(k, v); return Promise.resolve(); }
        };
    }
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, 10);
        }
        if (/\\/usage$/.test(url)) { respond(500, ''); return; }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ${JSON.stringify(ORG)}, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        if (/chat_conversations\\//.test(url)) {
            var body = PAYLOADS[Math.min(window.__acn.fetches, PAYLOADS.length - 1)];
            window.__acn.fetches++;
            setTimeout(function () {
                window.__acn.answered = (window.__acn.answered || 0) + 1;
                if (opts.onload) opts.onload({ status: 200, responseText: body });
            }, LATENCY);
            return;
        }
        respond(404, '');
    };
    try { document.cookie = 'lastActiveOrg=' + ${JSON.stringify(ORG)} + '; path=/'; } catch (e) {}
    new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
            for (var j = 0; j < recs[i].addedNodes.length; j++) {
                var n = recs[i].addedNodes[j];
                if (n.nodeType === 1 && n.getAttribute('data-acn-role') === 'toast') {
                    window.__acn.toasts.push({ at: performance.now(), text: n.textContent });
                }
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true });
    // Every element a jump flashes, with its row: the flash is gone 1.6 s later.
    new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
            var t = recs[i].target;
            if (t.classList && t.classList.contains('acn-bm-flash')) {
                var r = t.closest('[data-index]');
                window.__acn.flashes.push({ at: performance.now(),
                    row: r ? r.getAttribute('data-index') : (t.closest('#mock-decoy-panel') ? 'decoy' : 'other') });
            }
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

// Page-side reads. Everything a check asserts on comes from the DOM the user sees or from storage.
const PAGE_HELPERS = `(function () {
    if (window.__p) return;
    function answerNode(row) {
        return row.querySelector('[data-testid="assistant-message"]') || row.querySelector('.font-claude-response');
    }
    window.__p = {
        answers: function () {
            var out = [];
            var rows = document.querySelectorAll('#mock-feed [data-index]');
            for (var i = 0; i < rows.length; i++) {
                var r = +rows[i].getAttribute('data-index');
                if (window.__mockVirtualization.rowSender(r) !== 'ai') continue;
                var node = answerNode(rows[i]);
                var all = rows[i].querySelectorAll('[data-acn-bookmark]');
                var icon = null;
                if (node) for (var c = 0; c < node.children.length; c++) {
                    if (node.children[c].getAttribute('data-acn-bookmark') !== null) icon = node.children[c];
                }
                var extra = 0;
                if (node) {
                    var inside = node.querySelectorAll('*');
                    for (var k = 0; k < inside.length; k++) {
                        var e = inside[k];
                        if (e === icon) continue;
                        var acn = String(e.className || '').indexOf('acn-') !== -1;
                        for (var a = 0; a < e.attributes.length; a++) {
                            if (e.attributes[a].name.indexOf('data-acn-') === 0) acn = true;
                        }
                        if (acn) extra++;
                    }
                }
                out.push({ row: r, flags: all.length, inNode: !!icon,
                           id: icon ? icon.getAttribute('data-acn-bookmark') : null,
                           active: !!(icon && icon.classList.contains('acn-bm-active')),
                           iconText: icon ? icon.textContent : null, extra: extra });
            }
            return out;
        },
        questions: function () {
            var out = [];
            var nodes = document.querySelectorAll('#mock-feed [data-index] [data-testid="user-message"]');
            for (var i = 0; i < nodes.length; i++) {
                var icon = nodes[i].querySelector('[data-acn-bookmark]');
                out.push({ row: +nodes[i].closest('[data-index]').getAttribute('data-index'),
                           id: icon ? icon.getAttribute('data-acn-bookmark') : null });
            }
            return out;
        },
        decoyFlagged: function () {
            var d = document.getElementById('mock-decoy-panel');
            if (!d) return null;
            return !!(d.querySelector('[data-acn-bookmark]') || d.querySelector('[data-acn-bookmarked]'));
        },
        clickAnswerFlag: function (row) {
            var r = document.querySelector('#mock-feed [data-index="' + row + '"]');
            var node = r && answerNode(r);
            var icon = node && node.querySelector('[data-acn-bookmark]');
            if (!icon) return false;
            icon.click(); return true;
        },
        clickQuestionFlag: function (row) {
            var r = document.querySelector('#mock-feed [data-index="' + row + '"]');
            var icon = r && r.querySelector('[data-testid="user-message"] [data-acn-bookmark]');
            if (!icon) return false;
            icon.click(); return true;
        },
        // Moves row FROM's answer node (with its flag) into row TO's place, as a recycled node
        // would be; with TEXT, its paragraph then shows that text. CLICK: click its flag at once.
        moveAnswer: function (from, to, text, click) {
            var rf = document.querySelector('#mock-feed [data-index="' + from + '"]');
            var rt = document.querySelector('#mock-feed [data-index="' + to + '"]');
            var a = rf && answerNode(rf), b = rt && answerNode(rt);
            if (!a || !b) return null;
            var icon = a.querySelector('[data-acn-bookmark]');
            var litBefore = !!(icon && icon.classList.contains('acn-bm-active'));
            b.parentNode.replaceChild(a, b);
            if (text) a.querySelector('p').textContent = text;
            if (click && icon) icon.click();
            return { litBefore: litBefore, hadIcon: !!icon };
        },
        // Runs the Tools panel's bookmark export and returns the file's text (the download link's blob).
        exportBookmarks: function () {
            return new Promise(function (resolve) {
                var orig = HTMLAnchorElement.prototype.click;
                HTMLAnchorElement.prototype.click = function () {
                    if (!this.download) return orig.call(this);
                    HTMLAnchorElement.prototype.click = orig;
                    fetch(this.href).then(function (r) { return r.text(); }).then(resolve, function () { resolve(null); });
                };
                var opt = document.querySelector('[data-acn-export="bookmarks"]');
                if (!opt) { var dot = document.getElementById('acn-dot-tools'); if (dot) dot.click();
                            opt = document.querySelector('[data-acn-export="bookmarks"]'); }
                if (!opt) { HTMLAnchorElement.prototype.click = orig; resolve(null); return; }
                opt.click();
                setTimeout(function () { HTMLAnchorElement.prototype.click = orig; resolve(null); }, 3000);
            });
        },
        clickDecoyFlag: function () {
            var icon = document.querySelector('#mock-decoy-panel [data-acn-bookmark]');
            if (!icon) return false;
            icon.click(); return true;
        },
        // Scrolls until row R is mounted outside the pinned tail, and still is once the mock has
        // re-rendered: mounting measures a row, which moves the rows under the same scrollTop when
        // the queued scroll event lands (the mock's height drift, on purpose). Resolves true/false.
        mountRow: function (R) {
            var mv = window.__mockVirtualization;
            var tail = mv.totalMessages - mv.tailRows;
            function feed() {
                return [].map.call(document.querySelectorAll('#mock-feed [data-index]'),
                                   function (e) { return +e.getAttribute('data-index'); });
            }
            function attempt() {
                var lo = 0, hi = 1;
                for (var k = 0; k < 40; k++) {
                    var f = (lo + hi) / 2;
                    mv.scrollToFraction(f);
                    var ix = feed().filter(function (i) { return i < tail; });
                    if (ix.indexOf(R) !== -1) return true;
                    if (!ix.length) return false;
                    if (R < Math.min.apply(null, ix)) hi = f; else lo = f;
                }
                return false;
            }
            return new Promise(function (resolve) {
                var tries = 0;
                (function loop() {
                    attempt();
                    setTimeout(function () {
                        if (feed().indexOf(R) !== -1) {
                            setTimeout(function () {
                                if (feed().indexOf(R) !== -1) resolve(true);
                                else if (++tries < 10) loop(); else resolve(false);
                            }, 300);
                        } else if (++tries < 10) loop(); else resolve(false);
                    }, 150);
                })();
            });
        },
        cards: function () {
            var cards = document.querySelectorAll('#acn-panel-bookmarks .acn-bk');
            var out = [];
            for (var i = 0; i < cards.length; i++) {
                var t = cards[i].querySelector('.acn-bk-type');
                out.push(t ? t.textContent : null);
            }
            return out;
        },
        openPanel: function () {
            var panel = document.getElementById('acn-panel-bookmarks');
            if (panel && panel.classList.contains('acn-open')) return true;
            var dot = document.getElementById('acn-dot-bookmarks');
            if (!dot) return false;
            dot.click(); return true;
        },
        clickCard: function (i) {
            var c = document.querySelectorAll('#acn-panel-bookmarks .acn-bk')[i];
            if (!c) return false;
            var zone = document.getElementById('acn-zone');
            if (zone) zone.removeAttribute('data-acn-jump-resolved');
            var prev = document.querySelectorAll('[data-acn-jump-target]');
            for (var k = 0; k < prev.length; k++) prev[k].removeAttribute('data-acn-jump-target');
            window.__acn.clickAt = performance.now();
            c.click(); return true;
        },
        removeCard: function (i) {
            var c = document.querySelectorAll('#acn-panel-bookmarks .acn-bk')[i];
            var b = c && c.querySelector('.acn-bk-remove');
            if (!b) return false;
            b.click(); return true;
        },
        jumpState: function () {
            var zone = document.getElementById('acn-zone');
            var marked = document.querySelectorAll('[data-acn-jump-target]');
            var where = [];
            for (var i = 0; i < marked.length; i++) {
                var r = marked[i].closest('[data-index]');
                where.push(r ? r.getAttribute('data-index') : (marked[i].closest('#mock-decoy-panel') ? 'decoy' : 'other'));
            }
            var since = window.__acn.clickAt || 0;
            var flashed = window.__acn.flashes.filter(function (f) { return f.at >= since; }).map(function (f) { return f.row; });
            for (var w = 0; w < where.length; w++) if (flashed.indexOf(where[w]) === -1) flashed.push(where[w]);
            return { resolved: zone ? zone.getAttribute('data-acn-jump-resolved') : null, marked: flashed,
                     toasts: window.__acn.toasts.filter(function (t) { return t.at >= since; }).map(function (t) { return t.text; }) };
        }
    };
}())`;

(async () => {
    const argv = process.argv;
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = argv.includes('--quiet');
    const mint = argv.includes('--mint-seeds');
    // --only R1,R3: run just those runs (development; a gate run runs all five).
    const only = argv.indexOf('--only') !== -1 ? String(argv[argv.indexOf('--only') + 1]).split(',') : null;
    const RUN_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
    if (only && (!only.length || only.some((id) => RUN_IDS.indexOf(id) === -1))) {
        console.log('INVALID: --only takes run ids from ' + RUN_IDS.join(',') + '; got ' + only.join(','));
        process.exit(1);
    }
    const runs = (id) => !only || only.indexOf(id) !== -1;
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8');

    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });

    let failures = 0, invalid = 0;
    function check(id, desc, ok, detail) {
        if (ok) { if (!quiet) console.log('  PASS  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
        else { failures++; console.log('  FAIL  ' + id + ' ' + desc + (detail ? ' — ' + detail : '')); }
    }
    function precondition(id, ok, detail) {
        if (ok) return true;
        invalid++;
        console.log('  INVALID  ' + id + ' precondition failed' + (detail ? ' — ' + detail : ''));
        return false;
    }

    async function openPage(context, url, opts) {
        const page = await context.newPage();
        const logs = [];
        page.on('console', (m) => logs.push(m.text()));
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        const html = buildPage(raw, opts);
        await page.route('**/*', (route) => {
            if (/^https:\/\/claude\.ai\/(chat|project)\//.test(route.request().url())) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.evaluate(PAGE_HELPERS);
        return { page, logs, errors };
    }
    async function reload(page) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.evaluate(PAGE_HELPERS);
    }
    // Navigate's count is the index's question count once it is ready; it is drawn when the panel opens.
    async function waitIndex(page, n) {
        try {
            await page.waitForFunction("!!document.getElementById('acn-dot-nav')", null, { timeout: 30000 });
            await page.evaluate("document.getElementById('acn-dot-nav').click()");
            await page.waitForFunction("(document.getElementById('acn-nav-stat') || {getAttribute: function () {}})" +
                ".getAttribute('data-acn-count') === '" + n + "'", null, { timeout: 30000 });
            return true;
        } catch (e) { return false; }
    }
    // Two equal reads 600 ms apart (the scan runs 500 ms after the page stops changing), cap 6 s.
    // Two equal reads with an answer still unflagged count only after 2.5 s: on a build that never
    // flags (v12.13 in a project chat) that is the answer, but on a slow runner it can be a read taken
    // before the scan.
    async function stableAnswers(page) {
        const start = Date.now(), deadline = start + 6000;
        let prev = null, cur = null;
        while (Date.now() < deadline) {
            cur = await page.evaluate('window.__p.answers()');
            const allFlagged = cur.every((a) => a.flags === 1);
            if (prev && JSON.stringify(prev) === JSON.stringify(cur) &&
                (allFlagged || Date.now() - start > 2500)) return cur;
            prev = cur;
            await page.waitForTimeout(600);
        }
        return cur;
    }
    async function settle(page, ms) { await page.waitForTimeout(ms || 1200); }
    async function storeOf(page, storage, url) {
        const held = await page.evaluate((k) => localStorage.getItem(k),
            (storage === 'sync' ? '__gmsync:' : '__gmasync:') + 'acn-bookmarks-v1');
        if (held === null) return [];
        let v = JSON.parse(held);
        if (storage !== 'sync') v = JSON.parse(v);
        const store = JSON.parse(v);
        return (store[url] && store[url].bookmarks) || [];
    }
    const byCreated = (list) => list.slice().sort((a, b) => a.createdAt - b.createdAt);
    async function labels(page, storage, url) {
        await page.evaluate('window.__p.openPanel()');
        await page.waitForTimeout(700);
        const cards = await page.evaluate('window.__p.cards()');
        const recs = byCreated(await storeOf(page, storage, url));
        const out = {};
        recs.forEach((r, i) => { out[r.id] = cards[i]; });
        return { out, cards, recs };
    }
    // row < 0: no landing is expected (a record that cannot be placed), so only the toast is awaited.
    async function jumpTo(page, cardIndex, row) {
        await page.evaluate('window.__p.clickCard(' + cardIndex + ')');
        if (row >= 0) {
            try {
                await page.waitForFunction("(document.getElementById('acn-zone') || {getAttribute: function () {}})" +
                    ".getAttribute('data-acn-jump-resolved') === '" + row + "'", null, { timeout: 12000 });
            } catch (e) {}
        }
        await page.waitForTimeout(row >= 0 ? 1500 : 2500);
        return page.evaluate('window.__p.jumpState()');
    }
    const answerLabel = (n) => 'Answer to Q#' + n;
    const short = (s) => (s ? String(s).slice(0, 8) : String(s));

    console.log('check-answer-bookmarks — engine=' + engine + ', script=' + path.basename(scriptPath) +
                (mint ? ' (minting seeds)' : ''));

    // ── --mint-seeds: v12.13's own records, made by clicking its flags ─────────────────────────
    if (mint) {
        const { payload } = buildPayload(FIX_SEEDS);
        const context = await browser.newContext();
        const { page } = await openPage(context, CHAT_URL,
            { fix: FIX_SEEDS, payloads: [payload], storage: 'sync', seed: null });
        await waitIndex(page, FIX_SEEDS.turns);
        await stableAnswers(page);
        const clicks = [];
        clicks.push(['P', await page.evaluate('window.__p.clickAnswerFlag(' + rowOfAnswer(FIX_SEEDS, 1) + ')')]);
        clicks.push(['QB', await page.evaluate('window.__p.clickQuestionFlag(' + rowOfQuestion(FIX_SEEDS, 1) + ')')]);
        clicks.push(['X', await page.evaluate('window.__p.clickAnswerFlag(' + rowOfAnswer(FIX_SEEDS, 3) + ')')]);
        await page.evaluate('window.__p.mountRow(' + rowOfAnswer(FIX_SEEDS, 12) + ')');
        await stableAnswers(page);
        clicks.push(['P2', await page.evaluate('window.__p.clickAnswerFlag(' + rowOfAnswer(FIX_SEEDS, 12) + ')')]);
        await page.evaluate('window.__p.mountRow(' + rowOfAnswer(FIX_SEEDS, 16) + ')');
        await stableAnswers(page);
        clicks.push(['T', await page.evaluate('window.__p.clickAnswerFlag(' + rowOfAnswer(FIX_SEEDS, 16) + ')')]);
        await settle(page, 800);
        const made = byCreated(await storeOf(page, 'sync', CHAT_URL));
        await context.close();
        // D: on a project page, the decoy's hidden flag (element.click() ignores visibility).
        const ctx2 = await browser.newContext();
        const p2 = await openPage(ctx2, PROJ_URL,
            { fix: FIX_SEEDS, payloads: [payload], storage: 'sync', seed: null, decoy: 'static' });
        await waitIndex(p2.page, FIX_SEEDS.turns);
        await stableAnswers(p2.page);
        clicks.push(['D', await p2.page.evaluate('window.__p.clickDecoyFlag()')]);
        await settle(p2.page, 800);
        const dRecs = await storeOf(p2.page, 'sync', PROJ_URL);
        await ctx2.close();
        const seeds = {};
        const byRow = { 1: 'P', 5: 'X', 22: 'P2', 30: 'T' };
        made.forEach((r) => { seeds[r.entityType === 'user-msg' ? 'QB' : byRow[r.pendingRow]] = r; });
        seeds.D = dRecs[0];
        const ok = clicks.every((c) => c[1]) && made.length === 5 && !!seeds.D &&
            ['P', 'X', 'T', 'P2', 'D'].every((k) => seeds[k] && seeds[k].schema === 1 && !seeds[k].msgUuid && seeds[k].pendingHash) &&
            seeds.QB && seeds.QB.schema === 2;
        if (!ok) {
            console.log('  MINT FAILED: clicks=' + JSON.stringify(clicks) + ' records=' + made.length +
                        ' D=' + !!seeds.D + ' shapes=' + JSON.stringify(Object.keys(seeds).map((k) => [k, seeds[k] && seeds[k].schema])));
            await browser.close();
            process.exit(1);
        }
        // W1: P's record with another answer's row, so its hash can never be reproduced there.
        const lastAt = Math.max(seeds.P2.createdAt, seeds.T.createdAt);
        seeds.W1 = Object.assign({}, seeds.P, { id: 'bm_w1w1w1w1', createdAt: lastAt + 1,
                                                 pendingRow: rowOfAnswer(FIX_SEEDS, 3) });
        seeds.D.createdAt = lastAt + 2;
        fs.writeFileSync(SEEDS_FILE, JSON.stringify({
            note: 'Minted by probes/check-answer-bookmarks.js --mint-seeds with ' + path.basename(scriptPath) +
                  ' on ' + engine + '. P/QB/X/P2/T were made by clicking flags on the FIX_SEEDS mock, D on the ' +
                  'project link of a project page (re-keyed to the chat URL when seeded); W1 is P with answer 3\'s row.',
            records: seeds }, null, 2) + '\n');
        console.log('  minted ' + Object.keys(seeds).join(', ') + ' → ' + path.relative(REPO, SEEDS_FILE));
        await browser.close();
        process.exit(0);
    }

    const SEEDS = JSON.parse(fs.readFileSync(SEEDS_FILE, 'utf8')).records;
    function seedStore(names, url) {
        const store = {};
        store[url] = { bookmarks: names.map((n) => JSON.parse(JSON.stringify(SEEDS[n]))) };
        return store;
    }

    // ── R1 — outside a project; answers mount only after scrolling ──────────────────────────
    if (runs('R1')) {
        const fix = FIX_MAIN;
        const { payload, truth, rows } = buildPayload(fix);
        const context = await browser.newContext();
        const { page, logs, errors } = await openPage(context, CHAT_URL, { fix, payloads: [payload], storage: 'sync', seed: null });
        const ready = await waitIndex(page, fix.turns);
        const first = await stableAnswers(page);
        const vis = await page.evaluate('document.visibilityState');
        if (precondition('R1', ready && vis === 'visible' && first.length >= 2,
                         'index ready=' + ready + ' visibility=' + vis + ' mounted answers=' + first.length)) {
            const A12 = rowOfAnswer(fix, 12), A20 = rowOfAnswer(fix, 20), A2 = rowOfAnswer(fix, 2), Q5 = rowOfQuestion(fix, 5);
            await page.evaluate('window.__p.clickAnswerFlag(' + A2 + ')');
            await page.evaluate('window.__p.mountRow(' + Q5 + ')');
            await stableAnswers(page);
            await page.evaluate('window.__p.clickQuestionFlag(' + Q5 + ')');
            const stops = [0.08, 0.16, 0.25, 0.33, 0.42, 0.5, 0.58, 0.66, 0.75, 0.83, 0.92, 1];
            const seen = {};
            const flagIssues = [], idIssues = [];
            let qIssues = 0, extraIssues = 0;
            const record = (st, where) => st.forEach((a) => {
                seen[a.row] = true;
                if (a.flags !== 1 || !a.inNode) flagIssues.push(where + ':row' + a.row + ' flags=' + a.flags + ' inNode=' + a.inNode);
                if (a.id !== truth.rowUuid[a.row]) idIssues.push(where + ':row' + a.row + '=' + short(a.id));
                if (a.extra !== 0 || (a.iconText !== null && a.iconText !== '⚑')) extraIssues++;
            });
            record(first, 'load');
            for (const f of stops) {
                await page.evaluate('window.__mockVirtualization.scrollToFraction(' + f + ')');
                const st = await stableAnswers(page);
                record(st, 'f' + f);
                const qs = await page.evaluate('window.__p.questions()');
                qs.forEach((q) => { if (q.id !== truth.rowUuid[q.row]) qIssues++; });
                if (st.some((a) => a.row === A12) && !seen.__a12) {
                    seen.__a12 = await page.evaluate('window.__p.clickAnswerFlag(' + A12 + ')');
                }
                if (st.some((a) => a.row === A20) && !seen.__a20) {
                    seen.__a20 = await page.evaluate('window.__p.clickAnswerFlag(' + A20 + ')');
                }
            }
            const answerRows = rows.map((r, i) => (r.sender === 'ai' ? i : -1)).filter((i) => i >= 0);
            // Any answer the stops stepped over is mounted on its own, so every answer is checked.
            for (const i of answerRows.filter((r) => !seen[r])) {
                await page.evaluate('window.__p.mountRow(' + i + ')');
                record(await stableAnswers(page), 'row' + i);
            }
            const covered = answerRows.filter((i) => seen[i]).length;
            precondition('R1-sweep', covered === answerRows.length && seen.__a12 && seen.__a20,
                         'answers seen ' + covered + '/' + answerRows.length + ' a12=' + !!seen.__a12 + ' a20=' + !!seen.__a20 +
                         ' never seen: ' + JSON.stringify(answerRows.filter((i) => !seen[i])));
            const fetchesAfterSweep = await page.evaluate('window.__acn.fetches');
            const outOfSync = logs.filter((l) => l.indexOf('[ACN] index out of sync with DOM') === 0).length;

            check('A1', 'every mounted answer has exactly one flag, at every scroll stop',
                flagIssues.length === 0, flagIssues.length ? flagIssues.slice(0, 6).join(', ') : covered + ' answers over ' + (stops.length + 1) + ' stops');
            check('A2', 'every answer flag carries its message uuid, at every stop',
                idIssues.length === 0, idIssues.length ? idIssues.length + ' wrong, e.g. ' + idIssues.slice(0, 4).join(', ') : 'all uuids');
            const recs = await storeOf(page, 'sync', CHAT_URL);
            const recOf = (row) => recs.filter((b) => b.entityType === 'ai-msg' &&
                (b.msgUuid === truth.rowUuid[row] || b.pendingRow === row))[0];
            const r12 = recOf(A12), r20 = recOf(A20), r2 = recOf(A2);
            const uuidOk = (r, row) => !!r && r.schema === 2 && r.msgUuid === truth.rowUuid[row] && r.contentHash === truth.rowUuid[row];
            check('A3', 'bookmarks made on answers mounted only after scrolling store the message uuid',
                uuidOk(r12, A12) && uuidOk(r20, A20) && uuidOk(r2, A2),
                'answer 12: ' + (r12 ? 'schema ' + r12.schema + ' ' + short(r12.msgUuid || r12.contentHash) : 'none') +
                ', answer 20: ' + (r20 ? 'schema ' + r20.schema + ' ' + short(r20.msgUuid || r20.contentHash) : 'none') +
                ', answer 2: ' + (r2 ? 'schema ' + r2.schema : 'none'));
            const lab = await labels(page, 'sync', CHAT_URL);
            const l12 = r12 && lab.out[r12.id], l20 = r20 && lab.out[r20.id], l2 = r2 && lab.out[r2.id];
            const qRec = recs.filter((b) => b.entityType === 'user-msg')[0];
            const lq = qRec && lab.out[qRec.id];
            check('A4', 'their labels read "Answer to Q#n", with the right n, and differ',
                l12 === answerLabel(12) && l20 === answerLabel(20) && l2 === answerLabel(2),
                'answer 2: ' + l2 + ', answer 12: ' + l12 + ', answer 20: ' + l20);
            const md = await page.evaluate('window.__p.exportBookmarks()');
            const heads = md ? (md.match(/^## .*$/gm) || []).map((h) => h.replace(/^## \S+ /, '').replace(/ \u2014 .*$/, '')) : null;
            const wantHeads = [answerLabel(2), 'Q#5', answerLabel(12), answerLabel(20)];
            check('A36', 'the bookmark export uses the same labels, an answer right after its question',
                !!heads && JSON.stringify(heads) === JSON.stringify(wantHeads),
                'headings ' + JSON.stringify(heads) + ' want ' + JSON.stringify(wantHeads));
            // A5 — from the top, jump to answer 20 (row ~37, not mounted there).
            await page.evaluate('window.__mockVirtualization.scrollToFraction(0)');
            await stableAnswers(page);
            const mountedTop = await page.evaluate('window.__mockVirtualization.mountedIndexes()');
            const cardIdx = byCreated(recs).findIndex((b) => r20 && b.id === r20.id);
            const j = await jumpTo(page, cardIdx, A20);
            check('A5', 'a jump to an answer that is not mounted lands on it, with no toast',
                mountedTop.indexOf(A20) === -1 && j.resolved === String(A20) && j.toasts.length === 0 &&
                j.marked.every((m) => m === String(A20)),
                'mounted before=' + (mountedTop.indexOf(A20) !== -1) + ' resolved=' + j.resolved +
                ' marked=' + JSON.stringify(j.marked) + ' toasts=' + JSON.stringify(j.toasts));
            check('A6', 'no index refetch while scrolling across windows',
                fetchesAfterSweep === 1 && outOfSync === 0,
                'conversation fetches=' + fetchesAfterSweep + ' "out of sync" lines=' + outOfSync);
            const navCount = await page.evaluate("document.getElementById('acn-nav-stat').getAttribute('data-acn-count')");
            check('A7', 'questions unchanged: uuid flags, the Navigate count, a question bookmark\'s label',
                qIssues === 0 && navCount === String(fix.turns) && !!qRec && qRec.schema === 2 && lq === 'Q#5',
                'question flags with a wrong id=' + qIssues + ' Navigate=' + navCount + ' Q5 bookmark=' + lq);
            check('A8', 'nothing but the flag is injected into an answer, and the flag holds no label text',
                extraIssues === 0 && errors.length === 0,
                'answers with extra injected nodes=' + extraIssues + ' page errors=' + errors.length);
        }
        await context.close();
    }

    // ── R2 — a project chat: the hidden project link is there before the script runs ───────
    if (runs('R2')) {
        const fix = FIX_MAIN;
        const { payload, truth } = buildPayload(fix, { lead: true, ghostAfterQuestion: 5 });
        const ghostRow = rowOfAnswer(fix, 5);
        const context = await browser.newContext();
        const { page } = await openPage(context, PROJ_URL, { fix, payloads: [payload], storage: 'sync', seed: null, decoy: 'static' });
        const ready = await waitIndex(page, fix.turns);
        const first = await stableAnswers(page);
        const decoy = await page.evaluate("(function () { var d = document.getElementById('mock-decoy'); " +
            "return d ? { len: d.textContent.trim().length, inRow: !!d.closest('[data-index]') } : null; }())");
        if (precondition('R2', ready && !!decoy && !decoy.inRow && first.length >= 2,
                         'index ready=' + ready + ' decoy=' + JSON.stringify(decoy) + ' mounted answers=' + first.length)) {
            const issues = [], wrongIds = [], seenRows = {};
            const tally = (st, where) => st.forEach((a) => {
                seenRows[a.row] = true;
                if (a.flags !== 1 || !a.inNode) issues.push(where + ':row' + a.row);
                const own = a.id === truth.rowUuid[a.row];
                const hash = !!a.id && !/^[0-9a-f-]{36}$/i.test(a.id);
                if (!own && !(a.row === ghostRow && hash)) wrongIds.push(where + ':row' + a.row + '=' + short(a.id));
            });
            tally(first, 'load');
            const Q3 = rowOfQuestion(fix, 3);
            await page.evaluate('window.__p.clickQuestionFlag(' + Q3 + ')');
            for (const f of [0.3, 0.55, 0.8]) {
                await page.evaluate('window.__mockVirtualization.scrollToFraction(' + f + ')');
                tally(await stableAnswers(page), 'f' + f);
            }
            const answerRows2 = mockRows(fix).map((r, i) => (r.sender === 'ai' ? i : -1)).filter((i) => i >= 0);
            for (const i of answerRows2.filter((r) => !seenRows[r])) {
                await page.evaluate('window.__p.mountRow(' + i + ')');
                tally(await stableAnswers(page), 'row' + i);
            }
            const A14 = rowOfAnswer(fix, 14);
            const mounted14 = await page.evaluate('window.__p.mountRow(' + A14 + ')');
            const at14 = await stableAnswers(page);
            tally(at14, 'a14');
            check('A28', 'every answer outside the ghost\'s group carries its own uuid (the predicate is wrong there)',
                wrongIds.length === 0 && answerRows2.every((r) => seenRows[r]),
                wrongIds.length ? wrongIds.length + ' wrong, e.g. ' + wrongIds.slice(0, 4).join(', ')
                                : answerRows2.filter((r) => seenRows[r]).length + '/' + answerRows2.length + ' answer rows seen');
            check('A9', 'every mounted answer has a flag, at load and after scrolling', issues.length === 0,
                issues.length ? issues.length + ' unflagged, e.g. ' + issues.slice(0, 5).join(', ') : 'all flagged');
            const decoyFlagged = await page.evaluate('window.__p.decoyFlagged()');
            check('A10', 'the project link never gets a flag', decoyFlagged === false, 'flagged=' + decoyFlagged);
            const clicked = await page.evaluate('window.__p.clickAnswerFlag(' + A14 + ')');
            if (!clicked && process.env.ACN_DEBUG) {
                console.log('  DEBUG', await page.evaluate((r) => {
                    var row = document.querySelector('#mock-feed [data-index="' + r + '"]');
                    var rows = [].map.call(document.querySelectorAll('#mock-feed [data-index]'), function (e) { return e.getAttribute('data-index'); });
                    if (!row) return 'row missing; feed rows ' + rows.join(',');
                    var am = row.querySelector('[data-testid="assistant-message"]');
                    return 'feed rows ' + rows.join(',') + ' | answer node=' + !!am + ' children=' +
                        (am ? [].map.call(am.children, function (c) { return c.tagName + '.' + c.className + (c.getAttribute('data-acn-bookmark') ? '[flag]' : ''); }).join(' ') : '') +
                        ' | bookmarked attr=' + (am && am.getAttribute('data-acn-bookmarked'));
                }, A14));
            }
            await settle(page, 800);
            const recs = await storeOf(page, 'sync', PROJ_URL);
            const r14 = recs.filter((b) => b.entityType === 'ai-msg')[0];
            const lab = await labels(page, 'sync', PROJ_URL);
            const l14 = r14 && lab.out[r14.id];
            check('A11', 'a bookmark made after scrolling stores the uuid, labelled "Answer to Q#n"',
                clicked && !!r14 && r14.msgUuid === truth.rowUuid[A14] && l14 === answerLabel(14),
                'mounted=' + mounted14 + ' clicked=' + clicked + ' record=' + (r14 ? 'schema ' + r14.schema + ' ' + short(r14.msgUuid || r14.contentHash) +
                ' (want ' + short(truth.rowUuid[A14]) + ')' : 'none') + ' label=' + l14);
            await page.evaluate('window.__mockVirtualization.scrollToFraction(1)');
            await stableAnswers(page);
            const idx14 = byCreated(recs).findIndex((b) => r14 && b.id === r14.id);
            const j = idx14 >= 0 ? await jumpTo(page, idx14, A14) : { resolved: null, marked: [], toasts: [] };
            check('A12', 'a jump to it from far away lands, with no toast',
                j.resolved === String(A14) && j.toasts.length === 0 && j.marked.indexOf('decoy') === -1,
                'resolved=' + j.resolved + ' marked=' + JSON.stringify(j.marked) + ' toasts=' + JSON.stringify(j.toasts));
            // A13 — remove the question bookmark with the panel's ✕: every flag is rebuilt.
            const qIdx = byCreated(recs).findIndex((b) => b.entityType === 'user-msg');
            const removed = qIdx >= 0 && await page.evaluate('window.__p.removeCard(' + qIdx + ')');
            const after = await stableAnswers(page);
            const unflagged = after.filter((a) => a.flags !== 1 || !a.inNode).map((a) => a.row);
            check('A13', 'after a bookmark is removed with the panel\'s ✕, every mounted answer has a flag',
                removed && after.length > 0 && unflagged.length === 0,
                'removed=' + removed + ' mounted answers=' + after.length + ' unflagged=' + JSON.stringify(unflagged));
        }
        await context.close();
    }

    // ── R3 / R4 — bookmarks v12.13 made, seeded ──────────────────────────────────────────────
    const fixS = FIX_SEEDS;
    const S = buildPayload(fixS);
    const rowsS = { A1: rowOfAnswer(fixS, 1), A2: rowOfAnswer(fixS, 2), A3: rowOfAnswer(fixS, 3),
                    A12: rowOfAnswer(fixS, 12), A16: rowOfAnswer(fixS, 16) };
    function seedFor(url) {
        const store = seedStore(['P', 'P2', 'T', 'QB', 'W1', 'D', 'X'], url);
        // L: answer 1 bound by inference only (pre-v12.0's preview rule keeps the oracle hash for the harvest).
        store[url].bookmarks.push({ id: 'bm_llllllll', schema: 2, entityType: 'ai-msg', boundBy: 'inference',
            legacyHash: '0badc0de', legacyMigrated: true,
            contentHash: S.truth.rowUuid[rowsS.A1], msgUuid: S.truth.rowUuid[rowsS.A1], preview: 'Answer number 1',
            msgIndex: 0, createdAt: SEEDS.D.createdAt + 2, platform: 'claude.ai' });
        // XB: answer 3 already bookmarked and bound, so X's proof finds a second record of it.
        store[url].bookmarks.push({ id: 'bm_xbxbxbxb', schema: 2, entityType: 'ai-msg',
            contentHash: S.truth.rowUuid[rowsS.A3], msgUuid: S.truth.rowUuid[rowsS.A3], preview: 'Answer number 3',
            msgIndex: 2, createdAt: SEEDS.D.createdAt + 1, platform: 'claude.ai', pendingHash: null,
            pendingSender: null, pendingOrdinal: -1, pendingRow: -1 });
        return store;
    }
    const find = (recs, id) => recs.filter((b) => b.id === id)[0];
    if (runs('R3')) {
        const context = await browser.newContext();
        const { page, logs } = await openPage(context, CHAT_URL,
            { fix: fixS, payloads: [S.payload], storage: 'sync', seed: seedFor(CHAT_URL) });
        const ready = await waitIndex(page, fixS.turns);
        await stableAnswers(page);
        await settle(page, 1500);
        const mounted = await page.evaluate('window.__mockVirtualization.mountedIndexes()');
        const a3Placed = (await page.evaluate('window.__p.answers()'))
            .some((a) => a.row === rowsS.A3 && a.id === S.truth.rowUuid[rowsS.A3]);
        if (precondition('R3', ready && mounted.indexOf(rowsS.A1) !== -1 && mounted.indexOf(rowsS.A12) === -1 &&
                         mounted.indexOf(rowsS.A3) !== -1 && mounted.indexOf(rowsS.A2) !== -1 &&
                         mounted.indexOf(rowsS.A16) === -1,
                         'index ready=' + ready + ' answer 3 placed=' + a3Placed + ' mounted=' + JSON.stringify(mounted))) {
            let recs = await storeOf(page, 'sync', CHAT_URL);
            const P = find(recs, SEEDS.P.id);
            const answers = await page.evaluate('window.__p.answers()');
            const a1 = answers.filter((a) => a.row === rowsS.A1)[0];
            let lab = await labels(page, 'sync', CHAT_URL);
            check('A14', 'P is bound at load by proof, labelled "Answer to Q#1", and its flag is lit',
                !!P && P.schema === 2 && P.msgUuid === S.truth.rowUuid[rowsS.A1] && lab.out[SEEDS.P.id] === answerLabel(1) &&
                !!a1 && a1.active,
                'P=' + (P ? 'schema ' + P.schema + ' ' + short(P.msgUuid) : 'gone') + ' label=' + lab.out[SEEDS.P.id] +
                ' flag lit=' + (a1 && a1.active));
            const xbFor = recs.filter((b) => b.entityType === 'ai-msg' && b.msgUuid === S.truth.rowUuid[rowsS.A3]);
            check('A27', 'X is provable but answer 3 is already bookmarked by XB: X is removed, XB kept',
                !find(recs, SEEDS.X.id) && xbFor.length === 1 && xbFor[0].id === 'bm_xbxbxbxb',
                'X ' + (find(recs, SEEDS.X.id) ? 'kept' : 'removed') + ', records bound to answer 3: ' +
                JSON.stringify(xbFor.map((b) => b.id)));
            // A18, at load: answer 2 (row 3) renders T's text; T was made on answer 16 (row 30, not mounted).
            const twinAtLoad = answers.filter((a) => a.row === rowsS.A2)[0];
            const tIdx = byCreated(recs).findIndex((b) => b.id === SEEDS.T.id);
            const tJump = await jumpTo(page, tIdx, -1);
            await page.evaluate('window.__p.clickAnswerFlag(' + rowsS.A2 + ')');
            await settle(page, 1000);
            recs = await storeOf(page, 'sync', CHAT_URL);
            const tKept = !!find(recs, SEEDS.T.id);
            const a2Rec = recs.filter((b) => b.id !== SEEDS.T.id && b.entityType === 'ai-msg' &&
                                             b.msgUuid === S.truth.rowUuid[rowsS.A2])[0];
            lab = await labels(page, 'sync', CHAT_URL);
            const p2Before = lab.out[SEEDS.P2.id];
            const P2before = find(recs, SEEDS.P2.id);
            await page.evaluate('window.__p.mountRow(' + rowsS.A12 + ')');
            await stableAnswers(page);
            await settle(page, 1200);
            recs = await storeOf(page, 'sync', CHAT_URL);
            const P2 = find(recs, SEEDS.P2.id);
            lab = await labels(page, 'sync', CHAT_URL);
            check('A15', 'P2 reads "A#?" until its row mounts, then binds, "Answer to Q#12"',
                p2Before === 'A#?' && !!P2before && !P2before.msgUuid && !!P2 &&
                P2.msgUuid === S.truth.rowUuid[rowsS.A12] && lab.out[SEEDS.P2.id] === answerLabel(12),
                'before=' + p2Before + ' after=' + lab.out[SEEDS.P2.id] + ' bound to ' + (P2 ? short(P2.msgUuid) : 'gone'));
            const W1 = find(recs, SEEDS.W1.id);
            // W1's row (answer 3) must be placed at load, or its hash is never compared and this passes vacuously.
            check('A16', 'W1 (wrong row, placed at load) stays unbound and unchanged, "A#?"',
                a3Placed && !!W1 && JSON.stringify(W1) === JSON.stringify(SEEDS.W1) && lab.out[SEEDS.W1.id] === 'A#?',
                'answer 3 placed at load=' + a3Placed + ' W1=' + (W1 ? (W1.msgUuid ? 'bound to ' + short(W1.msgUuid) : 'unbound') + (JSON.stringify(W1) === JSON.stringify(SEEDS.W1) ? ', unchanged' : ', CHANGED') : 'gone') +
                ' label=' + lab.out[SEEDS.W1.id]);
            // A17 — D: "A#?", the answer toast, nothing marked; its ✕ deletes only D.
            const dIdx = byCreated(recs).findIndex((b) => b.id === SEEDS.D.id);
            const dLabel = lab.out[SEEDS.D.id];
            const j = await jumpTo(page, dIdx, -1);
            const before = recs.length;
            await page.evaluate('window.__p.removeCard(' + dIdx + ')');
            await settle(page, 800);
            recs = await storeOf(page, 'sync', CHAT_URL);
            check('A17', 'D reads "A#?"; clicking it shows the answer toast and marks nothing; ✕ deletes only D',
                dLabel === 'A#?' && j.marked.length === 0 && j.resolved === null && j.toasts.length === 1 &&
                /could not be matched to a message/.test(j.toasts[0]) && !find(recs, SEEDS.D.id) && recs.length === before - 1,
                'label=' + dLabel + ' marked=' + JSON.stringify(j.marked) + ' toasts=' + JSON.stringify(j.toasts) +
                ' records ' + before + '→' + recs.length);
            // A18, then: T binds to answer 16 once its row mounts.
            await page.evaluate('window.__p.mountRow(' + rowsS.A16 + ')');
            await stableAnswers(page);
            await settle(page, 1000);
            recs = await storeOf(page, 'sync', CHAT_URL);
            const T = find(recs, SEEDS.T.id);
            check('A18', 'the twin: answer 2\'s flag is not lit by T, T\'s card does not jump to it, its click keeps T, ' +
                'and T binds to answer 16 when that row mounts',
                !!twinAtLoad && !twinAtLoad.active && tJump.marked.length === 0 && tJump.resolved === null &&
                tKept && !!a2Rec && !!T && T.msgUuid === S.truth.rowUuid[rowsS.A16],
                'answer 2 lit=' + (twinAtLoad && twinAtLoad.active) + ' T card: marked=' + JSON.stringify(tJump.marked) +
                ' toasts=' + JSON.stringify(tJump.toasts) + ' | after the click T ' + (tKept ? 'kept' : 'DELETED') +
                ', answer 2 record=' + !!a2Rec + ' | T bound to answer 16=' + !!(T && T.msgUuid === S.truth.rowUuid[rowsS.A16]));
            const status = logs.filter((l) => l.indexOf('[ACN bookmarks] legacy status') === 0);
            check('A19', 'the console no longer says "all records carry a uuid", and names D',
                status.length === 1 && status[0].indexOf('carry a uuid') === -1 && status[0].indexOf(SEEDS.D.id) !== -1,
                status.length ? JSON.stringify(status[0].slice(0, 160)) : 'no status line');
            // A33 — another tab's record arrives while nothing on screen changes (sync storage reads live).
            await page.evaluate('window.__mockVirtualization.scrollToFraction(0)');
            await stableAnswers(page);
            await settle(page, 1500);
            const Z = Object.assign({}, SEEDS.X, { id: 'bm_zzzzzzzz', createdAt: SEEDS.D.createdAt + 9 });
            await page.evaluate((z) => {
                var k = '__gmsync:acn-bookmarks-v1';
                var store = JSON.parse(JSON.parse(localStorage.getItem(k)));
                var url = location.origin + location.pathname;
                store[url].bookmarks.push(z);
                localStorage.setItem(k, JSON.stringify(JSON.stringify(store)));
                var n = document.createElement('div'); document.body.appendChild(n); n.remove();   // a scan
            }, Z);
            await page.waitForTimeout(2000);
            recs = await storeOf(page, 'sync', CHAT_URL);
            check('A33', 'another tab\'s record, nothing on screen changed: the next scan proves it (Z removed: answer 3 is bookmarked)',
                !find(recs, Z.id), 'Z ' + (find(recs, Z.id) ? 'still there, unproven' : 'removed'));
            // A20 — reload: still bound; then idle, nothing written.
            await reload(page);
            await waitIndex(page, fixS.turns);
            await stableAnswers(page);
            await settle(page, 1500);
            recs = await storeOf(page, 'sync', CHAT_URL);
            lab = await labels(page, 'sync', CHAT_URL);
            const w0 = await page.evaluate('window.__acn.gmWrites');
            await page.waitForTimeout(5000);
            const w1 = await page.evaluate('window.__acn.gmWrites');
            const P_ = find(recs, SEEDS.P.id), P2_ = find(recs, SEEDS.P2.id);
            check('A20', 'after a reload P and P2 are still bound; idle, nothing is written',
                !!P_ && P_.msgUuid === S.truth.rowUuid[rowsS.A1] && !!P2_ && P2_.msgUuid === S.truth.rowUuid[rowsS.A12] &&
                lab.out[SEEDS.P.id] === answerLabel(1) && lab.out[SEEDS.P2.id] === answerLabel(12) && w1 === w0,
                'P=' + lab.out[SEEDS.P.id] + ' P2=' + lab.out[SEEDS.P2.id] + ' writes in 5 s idle=' + (w1 - w0));
        }
        await context.close();
    }
    if (runs('R4')) {
        // R4 — async storage only (Safari + Userscripts' shape), and a second tab.
        const context = await browser.newContext();
        const A = await openPage(context, CHAT_URL,
            { fix: fixS, payloads: [S.payload], storage: 'async', seed: seedFor(CHAT_URL), lang: 'ko' });
        const ready = await waitIndex(A.page, fixS.turns);
        await stableAnswers(A.page);
        await settle(A.page, 1500);
        let recs = await storeOf(A.page, 'async', CHAT_URL);
        const P = find(recs, SEEDS.P.id);
        // Tab B, the same conversation: deletes P2 while A has never mounted answer 12.
        const B = await openPage(context, CHAT_URL,
            { fix: fixS, payloads: [S.payload], storage: 'async', seed: seedFor(CHAT_URL) });
        await waitIndex(B.page, fixS.turns);
        await stableAnswers(B.page);
        await B.page.evaluate('window.__p.openPanel()');
        await B.page.waitForTimeout(700);
        const bRecs = byCreated(await storeOf(B.page, 'async', CHAT_URL));
        const p2Idx = bRecs.findIndex((b) => b.id === SEEDS.P2.id);
        const removed = p2Idx >= 0 && await B.page.evaluate('window.__p.removeCard(' + p2Idx + ')');
        await B.page.waitForTimeout(1200);
        const goneInB = !find(await storeOf(B.page, 'async', CHAT_URL), SEEDS.P2.id);
        // A mounts answer 12: on the fix, the proof finds nothing to bind (P2 is gone from storage).
        const aMounted = await A.page.evaluate('window.__p.mountRow(' + rowsS.A12 + ')');
        await stableAnswers(A.page);
        await settle(A.page, 2000);
        recs = await storeOf(A.page, 'async', CHAT_URL);
        check('A21', 'P binds at load through the async storage',
            ready && !!P && P.msgUuid === S.truth.rowUuid[rowsS.A1],
            'P=' + (P ? 'schema ' + P.schema + ' ' + short(P.msgUuid) : 'gone'));
        const labKo = await labels(A.page, 'async', CHAT_URL);
        check('A35', 'in Korean, P\'s label reads "Q#1에 대한 답변"', labKo.out[SEEDS.P.id] === 'Q#1\uc5d0 \ub300\ud55c \ub2f5\ubcc0',
            'label=' + labKo.out[SEEDS.P.id]);
        check('A22', 'two tabs: B deletes P2 before A mounts its row; A does not bring it back',
            removed && goneInB && aMounted && !find(recs, SEEDS.P2.id),
            'A mounted answer 12=' + aMounted + ' removed in B=' + removed + ' gone after B=' + goneInB + ' P2 in storage after A=' + !!find(recs, SEEDS.P2.id));
        await context.close();
    }

    // ── R5 — the newest answer, the status line, and the July markup ───────────────────────
    if (runs('R5')) {
        const fix = FIX_SHORT;
        const open = buildPayload(fix, { openLast: true });
        const done = buildPayload(fix);
        const Q1 = rowOfQuestion(fix, 1), A6 = rowOfAnswer(fix, 6);
        const store = {};
        store[CHAT_URL] = { bookmarks: [{ id: 'bm_qqqqqqqq', schema: 2, entityType: 'user-msg',
            contentHash: open.truth.rowUuid[Q1], msgUuid: open.truth.rowUuid[Q1], preview: 'Question number 1',
            msgIndex: 0, createdAt: 1, platform: 'claude.ai', pendingHash: null, pendingSender: null,
            pendingOrdinal: -1, pendingRow: -1 }] };
        const context = await browser.newContext();
        const { page, logs } = await openPage(context, CHAT_URL,
            { fix, payloads: [open.payload, done.payload], storage: 'sync', seed: store });
        const ready = await waitIndex(page, fix.turns);
        await stableAnswers(page);
        await settle(page, 1500);
        const status = logs.filter((l) => l.indexOf('[ACN bookmarks] legacy status') === 0);
        check('A23', 'with only bound records the console says "all records carry a uuid"',
            status.length === 1 && status[0].indexOf('carry a uuid') !== -1 && status[0].indexOf('without a uuid') === -1,
            status.length ? JSON.stringify(status[0].slice(0, 120)) : 'no status line');
        const f0 = await page.evaluate('window.__acn.fetches');
        const clicked = await page.evaluate('window.__p.clickAnswerFlag(' + A6 + ')');
        let bound = null;
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
            await page.waitForTimeout(1000);
            const recs = await storeOf(page, 'sync', CHAT_URL);
            bound = recs.filter((b) => b.entityType === 'ai-msg')[0] || null;
            if (bound && bound.msgUuid) break;
        }
        const f1 = await page.evaluate('window.__acn.fetches');
        const lab = await labels(page, 'sync', CHAT_URL);
        const outOfSync = logs.filter((l) => l.indexOf('[ACN] index out of sync with DOM') === 0).length;
        const bmLine = logs.filter((l) => l.indexOf('[ACN] refetching the index for a bookmarked answer') === 0).length;
        check('A24', 'the last answer was fetched mid-stream; a click on its flag fetches one refresh and binds it',
            ready && f0 === 1 && clicked && f1 === 2 && !!bound && bound.msgUuid === done.truth.rowUuid[A6] &&
            lab.out[bound.id] === answerLabel(6) && outOfSync === 0 && bmLine === 1,
            'fetches ' + f0 + '→' + f1 + ' record=' + (bound ? (bound.msgUuid ? 'bound ' + short(bound.msgUuid) : 'unbound') : 'none') +
            ' label=' + (bound && lab.out[bound.id]) + ' log lines: out of sync=' + outOfSync + ', bookmark refetch=' + bmLine);
        await context.close();
    }
    if (runs('R5')) {
        const fix = FIX_OLD;
        const { payload } = buildPayload(fix);
        const context = await browser.newContext();
        const { page } = await openPage(context, CHAT_URL, { fix, payloads: [payload], storage: 'sync', seed: null, markup: 'old' });
        const ready = await waitIndex(page, fix.turns);
        const issues = [];
        for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1, 0.5, 0.1]) {
            await page.evaluate('window.__mockVirtualization.scrollToFraction(' + f + ')');
            (await stableAnswers(page)).forEach((a) => { if (a.flags !== 1) issues.push('f' + f + ':row' + a.row); });
            await page.waitForTimeout(800);
        }
        const fetches = await page.evaluate('window.__acn.fetches');
        check('A25', '[control] the July markup with activity lines: the staleness check refetches',
            ready && fetches >= 2, 'conversation fetches=' + fetches);
        check('A26', 'the July markup: every mounted answer has a flag', issues.length === 0,
            issues.length ? issues.slice(0, 6).join(', ') : 'all flagged');
        await context.close();
    }

    // ── R6 — recycled nodes ──────────────────────────────────────────────────────────────────
    if (runs('R6')) {
        const fixS6 = FIX_SEEDS;
        const S6 = buildPayload(fixS6);
        const r1 = rowOfAnswer(fixS6, 1), r5 = rowOfAnswer(fixS6, 3);
        const store = seedStore(['P'], CHAT_URL);
        const N = Object.assign({}, SEEDS.X, { id: 'bm_nnnnnnnn', pendingRow: -1, createdAt: SEEDS.P.createdAt + 5 });
        store[CHAT_URL].bookmarks.push(N);
        const r3 = rowOfAnswer(fixS6, 2);
        store[CHAT_URL].bookmarks.push({ id: 'bm_b2b2b2b2', schema: 2, entityType: 'ai-msg',
            contentHash: S6.truth.rowUuid[r3], msgUuid: S6.truth.rowUuid[r3], preview: 'Answer number 2', msgIndex: 1,
            createdAt: SEEDS.P.createdAt + 6, platform: 'claude.ai', pendingHash: null, pendingSender: null,
            pendingOrdinal: -1, pendingRow: -1 });
        const context = await browser.newContext();
        const { page } = await openPage(context, CHAT_URL,
            { fix: fixS6, payloads: [S6.payload], storage: 'sync', seed: store, latencyMs: 7000 });
        await page.waitForFunction("document.querySelectorAll('#mock-feed [data-acn-bookmark]').length >= 3", null, { timeout: 30000 })
            .catch(() => {});
        const before = await stableAnswers(page);
        const early = await page.evaluate('!window.__acn.answered');
        const a1 = before.filter((a) => a.row === r1)[0], a5 = before.filter((a) => a.row === r5)[0];
        if (precondition('R6', early && !!a1 && !!a5 && a1.active, 'index not ready yet=' + early +
                         ' answer 1 flag lit by P=' + (a1 && a1.active) + ' answer 3 flagged=' + !!a5)) {
            check('A32', 'a record with no row does not light an unplaced flag with its hash',
                !a5.active, 'answer 3 lit=' + a5.active + ' (N holds its hash, with no row)');
            const preLab = (await labels(page, 'sync', CHAT_URL)).out.bm_b2b2b2b2;
            // A30: moved, no click; the scan redraws the flag for its new row.
            const moved = await page.evaluate('window.__p.moveAnswer(' + r1 + ',' + r5 + ', null, false)');
            await page.waitForTimeout(1500);
            const at5 = (await page.evaluate('window.__p.answers()')).filter((a) => a.row === r5)[0];
            check('A30', 'answer 1\'s node moved into row 5 (same text): its flag is dark there after the scan',
                !!moved && moved.litBefore && !!at5 && at5.flags === 1 && !at5.active,
                'lit before the move=' + (moved && moved.litBefore) + ' in row 5 after: ' +
                (at5 ? 'flags=' + at5.flags + ' lit=' + at5.active : 'none'));
            // A29: rebuild the rows, move again and click at once.
            await page.evaluate('window.__mockVirtualization.scrollToFraction(0.5)');
            await page.evaluate('window.__mockVirtualization.scrollToFraction(0)');
            await stableAnswers(page);
            const n0 = (await storeOf(page, 'sync', CHAT_URL)).length;
            const clicked = await page.evaluate('window.__p.moveAnswer(' + r1 + ',' + r5 + ', null, true)');
            await page.waitForTimeout(800);
            const after29 = await storeOf(page, 'sync', CHAT_URL);
            check('A29', 'the moved node clicked at once: P is not removed and nothing is added',
                !!clicked && clicked.litBefore && !!find(after29, SEEDS.P.id) && after29.length === n0,
                'lit when clicked=' + (clicked && clicked.litBefore) + ' P ' + (find(after29, SEEDS.P.id) ? 'kept' : 'REMOVED') +
                ' records ' + n0 + '→' + after29.length);
            // A31: once the index is ready, P binds; recycle answer 1's node into row 5 showing answer 3.
            await page.waitForFunction('window.__acn.answered >= 1', null, { timeout: 30000 }).catch(() => {});
            await page.evaluate('window.__mockVirtualization.scrollToFraction(0.5)');
            await page.evaluate('window.__mockVirtualization.scrollToFraction(0)');
            await stableAnswers(page);
            await settle(page, 1500);
            const pBound = find(await storeOf(page, 'sync', CHAT_URL), SEEDS.P.id);
            const postLab = (await labels(page, 'sync', CHAT_URL)).out.bm_b2b2b2b2;
            check('A34', 'a bound record reads "Answer to Q#?" before the index lands, "Answer to Q#2" after',
                preLab === 'Answer to Q#?' && postLab === answerLabel(2), 'before=' + preLab + ' after=' + postLab);
            const text3 = await page.evaluate('window.__mockVirtualization.rowText(' + r5 + ')');
            const rc = await page.evaluate('window.__p.moveAnswer(' + r1 + ',' + r5 + ',' + JSON.stringify(text3) + ', true)');
            await page.waitForTimeout(800);
            const P31 = find(await storeOf(page, 'sync', CHAT_URL), SEEDS.P.id);
            check('A31', 'a placed answer\'s node recycled to show answer 3, clicked at once: P stays bound to answer 1',
                !!pBound && pBound.msgUuid === S6.truth.rowUuid[r1] && !!rc && rc.litBefore &&
                !!P31 && P31.msgUuid === S6.truth.rowUuid[r1],
                'P before=' + (pBound ? short(pBound.msgUuid || pBound.contentHash) : 'gone') + ' lit when clicked=' +
                (rc && rc.litBefore) + ' P after=' + (P31 ? short(P31.msgUuid || P31.contentHash) : 'REMOVED'));
        }
        await context.close();
    }

    await browser.close();
    if (invalid) console.log('\n' + invalid + ' run(s) INVALID: their checks did not run');
    console.log(failures || invalid ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures || invalid ? 1 : 0);
})();
