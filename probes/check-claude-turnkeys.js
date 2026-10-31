// Checks for Claude's row ids (v12.15, part C): identity from each row's [data-turn-key].
//
// Run: node probes/check-claude-turnkeys.js [--browser chromium|firefox|webkit] [-j 3] [--only S1,S3] [--quiet]
// ACN_SCRIPT=<path> runs another build (v12.14, or a mutant). Exits non-zero on any failed check.
// --mint-seeds (with ACN_SCRIPT pointed at v12.14) rebuilds probes/fixtures/claude-turnkey-seeds.json.
//
// THE BUG THIS GATES [measured live by the main session, Chrome + Tampermonkey page realm, v12.14,
// one 147-question chat, 2026-10-24]: v12.14 identifies a question row by comparing its rendered
// text with the payload's markdown. The DOM joins a question's blocks without whitespace and draws
// list numbers with CSS, so 31 of 129 questions differed, 27 of them within 200 characters. Each
// such question costs the index a refetch when it scrolls into view (2 "out of sync" lines in one
// slow sweep), its bookmark a text hash instead of its uuid, and a jump to it its verification.
// Regenerating an answer, and an answer the index caught mid-stream, caused no resync at all.
// Every row carries its message's uuid on a descendant [data-turn-key] (294 of 294 rows, both
// senders) and data-perf-row names its sender.
//
// Scenarios and checks. [new] must fail on v12.14 and pass on the fix; [guard] passes on both.
// Fixture: 40 turns (80 rows), the October answer markup, data-perf-row* on every row, keys equal
// to the payload's uuids unless a scenario says otherwise.
//   S1  sweep, keys on; multi-block questions 3,8,13,18,23,28,33 (early difference), 6,26 (past 200
//       chars), and 16 whose renderer adds text (a code block's label and "Copy" button)
//     G1  [new]   one conversation fetch over the whole sweep, no "out of sync" line
//     G2  [new]   every mounted multi-block question's flag carries its uuid, at every stop
//     G2b [new]   a bookmark made on question 13 (multi-block) stores its uuid
//     G2c [guard] every mounted answer's flag carries its uuid, at every stop
//     G15 [new]   one "turn keys: N of N mounted rows" line per index load; no fallback line
//   S2  jump from the bottom to questions 13 and 28 (multi-block), through Navigate
//     G10 [new]   both land (the jump resolves to the target's row), with no failure toast
//   S3/S4/S5 regenerate the last answer; the API serves the new answer WITHOUT stop_reason (and
//       partial) while the stream runs, complete after. S3: its key changes when the stream starts,
//       with 3 long pauses; S4: the key changes when the stream ends; S5: no data-perf-row* at all,
//       streamed in fine steps
//     G3  [new]   exactly one resync, after the stream ended, and the answer's flag then carries
//                 the new uuid (S3, S4, S5)
//     G4  [new]   no fetch while the stream ran (a fetch then holds the unfinished answer) (S3, S4)
//     G16 [new]   mid-stream, before the resync, the regenerating answer's flag does not carry the
//                 superseded answer's uuid: its key names a message the index does not hold (S3)
//   S6  the index was fetched while the last answer was being written (no stop_reason); the page
//       shows it finished
//     G5  [new]   exactly one resync, and the answer's flag then carries its uuid
//   S6b the same, with the answer still streaming for 4.5 s after the page loads
//     G5b [new]   exactly one resync, after the stream ended
//   S7  the last question edited (new keys for it and its answer)
//     G8  [guard] exactly one resync
//   S8  the last question edited, its new answer streaming
//     G9  [new]   exactly one resync, after the stream ended (v12.14 resyncs mid-stream)
//   S14 the last question edited IN PLACE, both rows keeping their keys (whether a live edit keeps
//       the key is unmeasured); its flag clicked 0.5-1.5 s after the edit. S14b: the same, and 4 s
//       after the edit the two rows take the edited messages' keys
//     G17 [guard] the edit is resynced, and no question record holds the superseded uuid (S14)
//     G17b[guard] the record made in that window ends bound to the edited question's uuid (S14b)
//   S9  row 20 (question 11) shows row 22's key
//     G6  [guard] no flag on row 20 carries row 22's uuid (v12.14 reads no keys)
//     G6b [new]   one console line names the disagreement
//     G6c [guard] neither row looks edited: one fetch, no "out of sync" line
//   S10 hostile rows, no multi-block questions: row 40 a malformed key, row 42 two keys (the first
//       in document order row 44's), row 58 an attachment-only question (no user-message node,
//       data-perf-row="human") with its key; row 58 is mounted first
//     G12 [guard] rows 40 and 42 are identified by their text: their flags carry their uuids
//     G12b[new]   one line names the first row without a usable key, and why
//     G7  [guard] one conversation fetch, no "out of sync" line
//     G7b [guard] row 58 is identified by its key: no fallback line names it (its sender is read
//                 from data-perf-row; the row has no user-message node)
//   S12 keys off (the July-like markup of every other suite): multi-block questions
//     G11 [guard] plain questions' flags carry their uuids; multi-block ones carry no uuid (text
//                 identity, as v12.14)
//   S13 v12.14's records (seeded, minted by clicking v12.14's flags): QH on question 13, a text
//       hash with no uuid; QX = QH with a hash its row does not reproduce; QW = QH made on row 44;
//       QB on question 2, bound (schema 2)
//     G13 [new]   QH binds to question 13's uuid once its row mounts, labelled "Q#13"
//     G14 [guard] QX and QW stay unbound and unchanged; QB stays bound, "Q#2"
//   S13b QH, and QI: question 13 bound by inference only (a pre-v12.0 preview rule, legacyHash)
//     G18 [new]   QH binds to question 13's uuid and QI stays (inference is no proof of a bookmark)
//   S13c QH, and QD: question 13 bound (schema 2)
//     G19 [new]   QH, a second bookmark of a bookmarked question, is removed; QD stays
//
// CONTEXT of these results: Playwright <engine>, page realm, headless, this machine; the userscript
// inlined into the virtualizing Claude mock, GM storage and the conversation request stubbed. Not a
// userscript manager and not Claude's real markup: real-browser acceptance on Safari + Userscripts,
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
const CHAT_URL = 'https://claude.ai/chat/' + CONV;
const SEEDS_FILE = path.join(__dirname, 'fixtures', 'claude-turnkey-seeds.json');
const TURNS = 40;
const ROWS = TURNS * 2;
const MB = [3, 8, 13, 18, 23, 28, 33], MBL = [6, 26], ADDED = [16];
const SUFFIX = ' VISIBLE-NOT-SR-ONLY';   // the mock's visible span after a question's text
const REGEN_TEXT = 'A regenerated answer for the last case: start over, then check the inputs again.';
const EDIT_TEXT = 'An edited last question: what changes when the input is empty?';

const rowOfQ = (turn) => (turn - 1) * 2;
const uuidFor = (i, tag) => CONV.slice(0, 24) + (tag || '') + String(i).padStart(12 - (tag || '').length, '0');

// The payload's text for question `turn`, as the mock's knobs render it (pcBlocks in the mock).
function questionMarkdown(turn, fix) {
    const late = fix.mbl.indexOf(turn) !== -1;
    if (fix.added.indexOf(turn) !== -1) {
        return 'Question number ' + turn + ': why does this snippet log twice?\n\n```javascript\nconsole.log(' +
               turn + ');\n```\n\nThanks for case ' + turn + '.' + SUFFIX;
    }
    if (fix.mb.indexOf(turn) === -1 && !late) {
        return 'Question number ' + turn + ': how do I handle case ' + turn + ' when the input is unusual?' + SUFFIX;
    }
    const intro = late
        ? 'Question number ' + turn + ': here is a long preamble that keeps going so that the first ' +
          'difference between the rendered text and the payload falls well past the two hundred ' +
          'character key, which is the identity risk boundary we want to straddle in this case.'
        : 'Question number ' + turn + ': please check these steps.';
    return intro + '\n\n1. first step for case ' + turn + '\n2. second step for case ' + turn +
           '\n\nThanks for case ' + turn + '.' + SUFFIX;
}

// opts: openLast (the last answer has no stop_reason), regen ('done' | 'streaming': a sibling of the
// last answer is the new leaf; streaming = no stop_reason and only its first third), edit ('done' |
// 'streaming': a sibling of the last question and its answer are the new leaf), chip (rows that are
// attachment-only questions).
function buildPayload(fix, opts) {
    opts = opts || {};
    const msgs = [], truth = [];
    let seq = 0, prev = '00000000-0000-4000-8000-000000000000';
    for (let t = 1; t <= TURNS; t++) {
        const qi = rowOfQ(t);
        const q = { uuid: uuidFor(seq++), parent_message_uuid: prev, sender: 'human',
                    content: [{ type: 'text', text: questionMarkdown(t, fix) }], attachments: [], files: [] };
        if ((fix.chip || []).indexOf(qi) !== -1) {
            q.content = [];
            q.attachments = [{ file_name: 'report-' + t + '.txt', extracted_content: 'A long pasted report for case ' + t + '.' }];
        }
        msgs.push(q); truth.push(q.uuid); prev = q.uuid;
        const a = { uuid: uuidFor(seq++), parent_message_uuid: prev, sender: 'assistant', stop_reason: 'end_turn',
                    content: [{ type: 'text', text: 'Answer number ' + t + ': validate the input first, then branch on the result.' }],
                    attachments: [], files: [] };
        if (opts.openLast && t === TURNS) delete a.stop_reason;
        msgs.push(a); truth.push(a.uuid); prev = a.uuid;
    }
    let leaf = prev;
    if (opts.edit) {
        const lastQ = msgs[msgs.length - 2];
        const q2 = { uuid: uuidFor(9001, 'e'), parent_message_uuid: lastQ.parent_message_uuid, sender: 'human',
                     content: [{ type: 'text', text: EDIT_TEXT + SUFFIX }], attachments: [], files: [] };
        const a2 = { uuid: uuidFor(9002, 'f'), parent_message_uuid: q2.uuid, sender: 'assistant', stop_reason: 'end_turn',
                     content: [{ type: 'text', text: REGEN_TEXT }], attachments: [], files: [] };
        if (opts.edit === 'streaming') { delete a2.stop_reason; a2.content[0].text = REGEN_TEXT.slice(0, 27); }
        msgs.push(q2, a2); leaf = a2.uuid;
        truth[ROWS - 2] = q2.uuid; truth[ROWS - 1] = a2.uuid;
    }
    if (opts.regen) {
        const last = msgs[ROWS - 1];
        const r = { uuid: uuidFor(9003, 'b'), parent_message_uuid: last.parent_message_uuid, sender: 'assistant',
                    stop_reason: 'end_turn', content: [{ type: 'text', text: REGEN_TEXT }], attachments: [], files: [] };
        if (opts.regen === 'streaming') { delete r.stop_reason; r.content[0].text = REGEN_TEXT.slice(0, 27); }
        msgs.push(r); leaf = r.uuid; truth[ROWS - 1] = r.uuid;
    }
    msgs.forEach((m, i) => { m.index = 1000 + i * 3; m.created_at = '2026-10-01T00:00:00Z'; m.text = ''; });
    return { payload: { uuid: CONV, name: 'turn key checks', current_leaf_message_uuid: leaf, chat_messages: msgs }, truth };
}

// plan: { seq: [payload, ...] } served in fetch order (the last repeats), or { phase: { idle, streaming,
// done } } served by the mock's regenerate phase at the moment of the fetch.
function buildPage(scriptContent, mockConfig, plan, seed) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const enc = {};
    if (plan.seq) enc.seq = plan.seq.map((p) => JSON.stringify(p));
    if (plan.phase) { enc.phase = {}; Object.keys(plan.phase).forEach((k) => { enc.phase[k] = JSON.stringify(plan.phase[k]); }); }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>turn key checks</title></head><body>
<script>window.__MOCK_CONFIG = ${JSON.stringify(mockConfig)};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var PLAN = ${JSON.stringify(enc)};
    var SEED = ${JSON.stringify(seed ? JSON.stringify(seed) : null)};
    window.__acn = { fetches: 0, fetchAt: [], fetchPhase: [], toasts: [] };
    if (SEED !== null && !localStorage.getItem('__seeded')) {
        localStorage.setItem('__gmsync:acn-bookmarks-v1', JSON.stringify(SEED));
        localStorage.setItem('__seeded', '1');
    }
    window.GM_getValue = function (k, d) { var t = localStorage.getItem('__gmsync:' + k); return t === null ? d : JSON.parse(t); };
    window.GM_setValue = function (k, v) { localStorage.setItem('__gmsync:' + k, JSON.stringify(v)); };
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
            var body, ph = null;
            if (PLAN.phase) {
                var pc = window.__mockVirtualization && window.__mockVirtualization.partC;
                ph = pc ? pc.phase() : 'idle';
                body = PLAN.phase[ph] || PLAN.phase.idle;
            } else {
                body = PLAN.seq[Math.min(window.__acn.fetches, PLAN.seq.length - 1)];
            }
            window.__acn.fetches++;
            window.__acn.fetchAt.push(performance.now());
            window.__acn.fetchPhase.push(ph);
            setTimeout(function () { if (opts.onload) opts.onload({ status: 200, responseText: body }); }, 10);
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
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

const PAGE_HELPERS = `(function () {
    if (window.__p) return;
    function flagOf(node) {
        if (!node) return null;
        for (var c = 0; c < node.children.length; c++) {
            if (node.children[c].getAttribute('data-acn-bookmark') !== null) return node.children[c];
        }
        return null;
    }
    window.__p = {
        questions: function () {
            var out = [], nodes = document.querySelectorAll('#mock-feed [data-index] [data-testid="user-message"]');
            for (var i = 0; i < nodes.length; i++) {
                var icon = flagOf(nodes[i]);
                out.push({ row: +nodes[i].closest('[data-index]').getAttribute('data-index'),
                           id: icon ? icon.getAttribute('data-acn-bookmark') : null });
            }
            return out;
        },
        answers: function () {
            var out = [], nodes = document.querySelectorAll('#mock-feed [data-index] [data-testid="assistant-message"]');
            for (var i = 0; i < nodes.length; i++) {
                var icon = flagOf(nodes[i]);
                out.push({ row: +nodes[i].closest('[data-index]').getAttribute('data-index'),
                           id: icon ? icon.getAttribute('data-acn-bookmark') : null });
            }
            return out;
        },
        clickQuestionFlag: function (row) {
            var r = document.querySelector('#mock-feed [data-index="' + row + '"]');
            var icon = r && flagOf(r.querySelector('[data-testid="user-message"]'));
            if (!icon) return false;
            icon.click(); return true;
        },
        mounted: function () {
            return [].map.call(document.querySelectorAll('#mock-feed [data-index]'),
                               function (e) { return +e.getAttribute('data-index'); });
        },
        // Scrolls until row R is mounted outside the pinned tail and still is after the mock re-renders.
        mountRow: function (R) {
            var mv = window.__mockVirtualization, tail = mv.totalMessages - mv.tailRows, self = this;
            function attempt() {
                var lo = 0, hi = 1;
                for (var k = 0; k < 40; k++) {
                    var f = (lo + hi) / 2;
                    mv.scrollToFraction(f);
                    var ix = self.mounted().filter(function (i) { return i < tail; });
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
                        if (self.mounted().indexOf(R) !== -1) {
                            setTimeout(function () {
                                if (self.mounted().indexOf(R) !== -1) resolve(true);
                                else if (++tries < 10) loop(); else resolve(false);
                            }, 300);
                        } else if (++tries < 10) loop(); else resolve(false);
                    }, 150);
                })();
            });
        },
        cards: function () {
            var cards = document.querySelectorAll('#acn-panel-bookmarks .acn-bk'), out = [];
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
        }
    };
}())`;

const FIX_SWEEP = { mb: MB, mbl: MBL, added: ADDED };
const FIX_PLAIN = { mb: [], mbl: [], added: [] };

(async () => {
    const argv = process.argv;
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const quiet = argv.includes('--quiet');
    const mint = argv.includes('--mint-seeds');
    const jobs = argv.indexOf('-j') !== -1 ? Math.max(1, parseInt(argv[argv.indexOf('-j') + 1], 10) || 1) : 3;
    const IDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S6b', 'S7', 'S8', 'S9', 'S10', 'S12', 'S13', 'S13b', 'S13c', 'S14', 'S14b'];
    const only = argv.indexOf('--only') !== -1 ? String(argv[argv.indexOf('--only') + 1]).split(',') : null;
    if (only && only.some((id) => IDS.indexOf(id) === -1)) {
        console.log('INVALID: --only takes scenario ids from ' + IDS.join(',') + '; got ' + only.join(','));
        process.exit(1);
    }
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8');
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });

    let failures = 0, invalid = 0;
    const lines = [];
    function check(id, desc, ok, detail) {
        if (!ok) failures++;
        if (!ok || !quiet) lines.push({ id, text: '  ' + (ok ? 'PASS' : 'FAIL') + '  ' + id + ' ' + desc + (detail ? ' — ' + detail : '') });
    }
    function precondition(id, ok, detail) {
        if (ok) return true;
        invalid++;
        lines.push({ id, text: '  INVALID  ' + id + ' precondition failed' + (detail ? ' — ' + detail : '') });
        return false;
    }

    async function openPage(mockConfig, plan, seed) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const logs = [];
        page.on('console', (m) => logs.push({ at: Date.now(), text: m.text() }));
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        const html = buildPage(raw, Object.assign({ totalMessages: ROWS, tailRows: 3, answerTestid: true, answerHeaders: true }, mockConfig), plan, seed);
        await page.route('**/*', (route) => {
            if (/^https:\/\/claude\.ai\/chat\//.test(route.request().url())) {
                route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            } else route.abort();
        });
        await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.evaluate(PAGE_HELPERS);
        return { context, page, logs, errors };
    }
    async function ready(page, logs) {
        const t0 = Date.now();
        while (Date.now() - t0 < 30000) {
            if (logs.some((l) => /conversation index ready/.test(l.text))) break;
            await page.waitForTimeout(200);
        }
        await page.waitForTimeout(1500);
        const vis = await page.evaluate('document.visibilityState');
        return logs.some((l) => /conversation index ready/.test(l.text)) && vis === 'visible';
    }
    const outOfSync = (logs) => logs.filter((l) => l.text.indexOf('[ACN] index out of sync with DOM') === 0);
    const short = (s) => (s ? String(s).slice(-6) : String(s));
    async function storeOf(page) {
        const held = await page.evaluate("localStorage.getItem('__gmsync:acn-bookmarks-v1')");
        if (held === null) return [];
        const store = JSON.parse(JSON.parse(held));
        return (store[CHAT_URL] && store[CHAT_URL].bookmarks) || [];
    }
    const keysCfg = (truth) => ({ turnKeys: truth.slice(), perfRow: true });

    // ── --mint-seeds: v12.14's own records, made by clicking its flags ─────────────────────────
    if (mint) {
        const { payload, truth } = buildPayload(FIX_SWEEP);
        const o = await openPage(Object.assign(keysCfg(truth), { multiBlockTurns: MB, multiBlockLateTurns: MBL, addedTextTurns: ADDED }),
                                 { seq: [payload] }, null);
        await ready(o.page, o.logs);
        const clicks = [];
        for (const t of [13, 2]) {
            await o.page.evaluate('window.__p.mountRow(' + rowOfQ(t) + ')');
            await o.page.waitForTimeout(1500);
            clicks.push(await o.page.evaluate('window.__p.clickQuestionFlag(' + rowOfQ(t) + ')'));
            await o.page.waitForTimeout(500);
        }
        const made = (await storeOf(o.page)).sort((a, b) => a.createdAt - b.createdAt);
        await o.context.close();
        const QH = made[0], QB = made[1];
        const ok = clicks.every(Boolean) && made.length === 2 && QH && QH.schema === 1 && !QH.msgUuid && QH.pendingHash &&
                   QH.pendingRow === rowOfQ(13) && QB && QB.schema === 2 && QB.msgUuid === truth[rowOfQ(2)];
        if (!ok) {
            console.log('  MINT FAILED: clicks=' + JSON.stringify(clicks) + ' records=' + JSON.stringify(made));
            await browser.close();
            process.exit(1);
        }
        const QX = Object.assign({}, QH, { id: 'bm_qxqxqxqx', createdAt: QB.createdAt + 1,
                                           contentHash: QH.contentHash.replace(/^./, (c) => (c === '0' ? '1' : '0')) });
        const QW = Object.assign({}, QH, { id: 'bm_qwqwqwqw', createdAt: QB.createdAt + 2, pendingRow: rowOfQ(23) });
        fs.writeFileSync(SEEDS_FILE, JSON.stringify({
            note: 'Minted by probes/check-claude-turnkeys.js --mint-seeds with ' + path.basename(scriptPath) + ' on ' + engine +
                  ': QH by clicking question 13\'s flag (a multi-block question, row ' + rowOfQ(13) + '), QB question 2\'s. ' +
                  'Synthesized: QX = QH with a hash its row does not reproduce; QW = QH made on row ' + rowOfQ(23) + '.',
            records: { QH, QB, QX, QW } }, null, 2) + '\n');
        console.log('  minted QH, QB, QX, QW → ' + path.relative(REPO, SEEDS_FILE));
        await browser.close();
        process.exit(0);
    }
    const SEEDS = JSON.parse(fs.readFileSync(SEEDS_FILE, 'utf8')).records;

    // A regenerate-like scenario: the page at the bottom, `act` started, then watched for `watchMs`.
    async function streamScenario(id, mockConfig, plan, act, watchMs) {
        const o = await openPage(mockConfig, plan, null);
        const ok = await ready(o.page, o.logs);
        await o.page.evaluate('window.__mockVirtualization.scrollToFraction(1)');
        await o.page.waitForTimeout(2500);
        const before = await o.page.evaluate('window.__acn.fetches');
        const startAt = await o.page.evaluate('performance.now()');
        await o.page.evaluate(act);
        await o.page.waitForTimeout(2500);   // mid-stream (every stream here lasts 4.5 s)
        const mid = await o.page.evaluate('window.__p.answers()');
        await o.page.waitForTimeout(watchMs - 2500);
        const r = await o.page.evaluate('({ fetchAt: window.__acn.fetchAt, fetchPhase: window.__acn.fetchPhase, ' +
            'doneAt: window.__mockVirtualization.partC.doneAt, answers: window.__p.answers(), questions: window.__p.questions() })');
        r.ok = ok; r.before = before; r.mid = mid; r.startAt = startAt; r.logs = o.logs; r.errors = o.errors;
        r.after = r.fetchAt.filter((t) => t > startAt);
        r.afterPhase = r.fetchPhase.slice(r.fetchAt.length - r.after.length);
        if (argv.includes('--logs')) {   // development: the page's [ACN] lines, for this scenario
            console.log('--- ' + id + ' (act at ' + Math.round(startAt) + ' ms page time)\n' +
                o.logs.filter((l) => /^\[(ACN|DBG)/.test(l.text)).map((l) => '    ' + l.text.slice(0, 220)).join('\n'));
        }
        await o.context.close();
        return r;
    }
    const fmt = (r) => 'fetches before=' + r.before + ' after=' + r.after.length + ' at ' +
        r.after.map((t) => ((t - r.startAt) / 1000).toFixed(1) + 's').join(',') + ' (phase ' + r.afterPhase.join(',') +
        ') stream ended ' + (r.doneAt ? ((r.doneAt - r.startAt) / 1000).toFixed(1) + 's' : 'never') +
        ' out-of-sync=' + outOfSync(r.logs).map((l) => l.text.replace(/^.*refetching/, '')).join('|');

    const SCEN = {};

    SCEN.S1 = async () => {
        const { payload, truth } = buildPayload(FIX_SWEEP);
        const o = await openPage(Object.assign(keysCfg(truth), { multiBlockTurns: MB, multiBlockLateTurns: MBL, addedTextTurns: ADDED }),
                                 { seq: [payload] }, null);
        if (!precondition('S1', await ready(o.page, o.logs), 'index ready / visible')) { await o.context.close(); return; }
        const stops = [0, 0.08, 0.16, 0.25, 0.33, 0.42, 0.5, 0.58, 0.66, 0.75, 0.83, 0.92, 1, 0.5, 0.1, 0.9];
        const mbTurns = MB.concat(MBL, ADDED);
        let mbSeen = 0, aSeen = 0, clicked = false;
        const mbWrong = [], aWrong = [];
        for (const f of stops) {
            await o.page.evaluate('window.__mockVirtualization.scrollToFraction(' + f + ')');
            await o.page.waitForTimeout(1800);
            const qs = await o.page.evaluate('window.__p.questions()');
            qs.forEach((q) => {
                const turn = q.row / 2 + 1;
                if (mbTurns.indexOf(turn) === -1) return;
                mbSeen++;
                if (q.id !== truth[q.row]) mbWrong.push('Q' + turn + '=' + short(q.id));
            });
            (await o.page.evaluate('window.__p.answers()')).forEach((a) => {
                aSeen++;
                if (a.id !== truth[a.row]) aWrong.push('row' + a.row + '=' + short(a.id));
            });
            if (!clicked && qs.some((q) => q.row === rowOfQ(13))) {
                clicked = await o.page.evaluate('window.__p.clickQuestionFlag(' + rowOfQ(13) + ')');
            }
        }
        await o.page.waitForTimeout(17000);   // a refetch held back by the cooldown fires in here
        const fetches = await o.page.evaluate('window.__acn.fetches');
        const oos = outOfSync(o.logs);
        check('G1', 'a sweep over multi-block questions: one conversation fetch, no "out of sync" line',
            fetches === 1 && oos.length === 0, 'fetches=' + fetches + ' out-of-sync=' + oos.map((l) => l.text.replace(/^.*refetching/, '')).join('|'));
        check('G2', 'every mounted multi-block question\'s flag carries its uuid, at every stop',
            mbSeen >= 9 && mbWrong.length === 0, 'seen=' + mbSeen + ' wrong=' + (mbWrong.slice(0, 8).join(' ') || 'none'));
        const rec = (await storeOf(o.page)).filter((b) => b.entityType === 'user-msg')[0];
        check('G2b', 'a bookmark made on question 13 (multi-block) stores its uuid',
            clicked && !!rec && rec.msgUuid === truth[rowOfQ(13)],
            'clicked=' + clicked + ' record=' + (rec ? (rec.msgUuid ? 'uuid ' + short(rec.msgUuid) : 'hash ' + rec.contentHash) : 'none'));
        check('G2c', '[guard] every mounted answer\'s flag carries its uuid, at every stop',
            aSeen >= 20 && aWrong.length === 0, 'seen=' + aSeen + ' wrong=' + (aWrong.slice(0, 8).join(' ') || 'none'));
        const counts = o.logs.filter((l) => /^\[ACN\] turn keys: \d+ of \d+ mounted rows/.test(l.text));
        const fallback = o.logs.filter((l) => /has no usable data-turn-key/.test(l.text));
        const usable = counts.length && /turn keys: (\d+) of \1 mounted rows carry a usable data-turn-key, \1 of them/.test(counts[0].text);
        check('G15', 'one "turn keys" counts line per index load (all usable, all on the path), no fallback line',
            counts.length === 1 && usable && fallback.length === 0,
            'counts=' + JSON.stringify(counts.map((l) => l.text.replace('[ACN] turn keys: ', ''))) + ' fallback lines=' + fallback.length);
        if (o.errors.length) check('S1-errors', 'no page errors', false, o.errors.slice(0, 2).join(' | '));
        await o.context.close();
    };

    SCEN.S2 = async () => {
        const { payload, truth } = buildPayload(FIX_SWEEP);
        const o = await openPage(Object.assign(keysCfg(truth), { multiBlockTurns: MB, multiBlockLateTurns: MBL, addedTextTurns: ADDED }),
                                 { seq: [payload] }, null);
        if (!precondition('S2', await ready(o.page, o.logs), 'index ready / visible')) { await o.context.close(); return; }
        const res = [];
        for (const t of [13, 28]) {
            await o.page.evaluate('window.__mockVirtualization.scrollToFraction(1)');
            await o.page.waitForTimeout(2500);
            await o.page.evaluate("(function(){var p=document.getElementById('acn-panel-nav');" +
                "if(!(p&&p.classList.contains('acn-open'))){var d=document.getElementById('acn-dot-nav');if(d)d.click();}})()");
            await o.page.waitForTimeout(800);
            const since = await o.page.evaluate("(function(){var z=document.getElementById('acn-zone');if(z)z.removeAttribute('data-acn-jump-resolved');return performance.now();})()");
            const clicked = await o.page.evaluate("(function(){var r=document.querySelectorAll('[data-acn-role=\"nav-item\"]')[" + (t - 1) + "];if(!r)return false;r.click();return true;})()");
            let resolved = null;
            try {
                await o.page.waitForFunction("(document.getElementById('acn-zone') || {getAttribute: function () {}})" +
                    ".getAttribute('data-acn-jump-resolved') === '" + rowOfQ(t) + "'", null, { timeout: 15000 });
                resolved = String(rowOfQ(t));
            } catch (e) {
                resolved = await o.page.evaluate("(document.getElementById('acn-zone') || {getAttribute: function () { return null; }}).getAttribute('data-acn-jump-resolved')");
            }
            await o.page.waitForTimeout(1500);
            const toasts = await o.page.evaluate('window.__acn.toasts.filter(function (x) { return x.at >= ' + since + '; }).map(function (x) { return x.text; })');
            res.push({ t, clicked, resolved, toasts });
        }
        check('G10', 'jumps from the bottom to multi-block questions 13 and 28 land, with no toast',
            res.every((r) => r.clicked && r.resolved === String(rowOfQ(r.t)) && !r.toasts.length),
            res.map((r) => 'Q' + r.t + ': resolved=' + r.resolved + ' (want ' + rowOfQ(r.t) + ') toasts=' + JSON.stringify(r.toasts)).join('; '));
        await o.context.close();
    };

    function regenScenario(id, keyAt, perf, steps) {
        return async () => {
            const p0 = buildPayload(FIX_PLAIN);
            const pS = buildPayload(FIX_PLAIN, { regen: 'streaming' });
            const pD = buildPayload(FIX_PLAIN, { regen: 'done' });
            const cfg = perf ? keysCfg(p0.truth) : { turnKeys: p0.truth.slice() };
            const r = await streamScenario(id, cfg, { phase: { idle: p0.payload, streaming: pS.payload, done: pD.payload } },
                'window.__mockVirtualization.partC.regenerate(' + (ROWS - 1) + ',' + JSON.stringify(REGEN_TEXT) + ',4500,' +
                JSON.stringify(pD.truth[ROWS - 1]) + ',' + JSON.stringify(keyAt) + ',' + steps + ')', 24000);
            if (!precondition(id, r.ok && r.before === 1, 'ready=' + r.ok + ' fetches before=' + r.before)) return;
            const last = r.answers.filter((a) => a.row === ROWS - 1)[0];
            check('G3', id + ': a regenerate (key at ' + keyAt + (perf ? '' : ', no data-perf-row*') + ') resyncs once, after the stream, ' +
                'and the answer\'s flag then carries the new uuid',
                r.after.length === 1 && !!r.doneAt && r.after[0] > r.doneAt && !!last && last.id === pD.truth[ROWS - 1],
                fmt(r) + ' flag=' + (last ? short(last.id) : 'none'));
            if (perf) {
                check('G4', id + ': no fetch while the stream ran (it would hold the unfinished answer)',
                    r.afterPhase.indexOf('streaming') === -1 && r.after.length >= 1, fmt(r));
            }
            if (keyAt === 'start' && perf) {
                const m = r.mid.filter((a) => a.row === ROWS - 1)[0];
                check('G16', id + ': mid-stream, before the resync, the regenerating answer\'s flag does not carry the ' +
                    'superseded answer\'s uuid (its key names a message the index does not hold)',
                    !!m && m.id !== p0.truth[ROWS - 1], 'mid-stream flag=' + (m ? short(m.id) : 'none') +
                    ' superseded=' + short(p0.truth[ROWS - 1]));
            }
        };
    }
    SCEN.S3 = regenScenario('S3', 'start', true, 3);
    SCEN.S4 = regenScenario('S4', 'end', true, 3);
    SCEN.S5 = regenScenario('S5', 'start', false, 18);

    SCEN.S6 = async () => {
        const p0 = buildPayload(FIX_PLAIN, { openLast: true });
        const p1 = buildPayload(FIX_PLAIN);
        const o = await openPage(keysCfg(p0.truth), { seq: [p0.payload, p1.payload] }, null);
        const ok = await ready(o.page, o.logs);
        await o.page.evaluate('window.__mockVirtualization.scrollToFraction(1)');
        await o.page.waitForTimeout(8000);
        const fetches = await o.page.evaluate('window.__acn.fetches');
        const last = (await o.page.evaluate('window.__p.answers()')).filter((a) => a.row === ROWS - 1)[0];
        if (precondition('S6', ok, 'index ready / visible')) {
            check('G5', 'the index caught the last answer mid-stream: one resync, then its flag carries its uuid',
                fetches === 2 && !!last && last.id === p1.truth[ROWS - 1],
                'fetches=' + fetches + ' flag=' + (last ? short(last.id) : 'none') + ' out-of-sync=' +
                outOfSync(o.logs).map((l) => l.text.replace(/^.*refetching/, '')).join('|'));
        }
        await o.context.close();
    };

    SCEN.S6b = async () => {
        const p0 = buildPayload(FIX_PLAIN, { openLast: true });
        const p1 = buildPayload(FIX_PLAIN);
        const o = await openPage(keysCfg(p0.truth), { phase: { idle: p0.payload, streaming: p0.payload, done: p1.payload } }, null);
        await o.page.evaluate('window.__mockVirtualization.scrollToFraction(1)');
        const startAt = await o.page.evaluate('performance.now()');
        await o.page.evaluate('window.__mockVirtualization.partC.regenerate(' + (ROWS - 1) + ', null, 4500, null, null, 3)');
        const ok = await ready(o.page, o.logs);
        await o.page.waitForTimeout(20000);
        const r = await o.page.evaluate('({ fetchAt: window.__acn.fetchAt, fetchPhase: window.__acn.fetchPhase, doneAt: window.__mockVirtualization.partC.doneAt })');
        if (precondition('S6b', ok && r.fetchPhase[0] === 'streaming', 'ready=' + ok + ' first fetch phase=' + r.fetchPhase[0])) {
            r.startAt = startAt; r.before = 1; r.after = r.fetchAt.slice(1); r.afterPhase = r.fetchPhase.slice(1); r.logs = o.logs;
            check('G5b', 'the last answer still streaming when the index was fetched: one resync, after the stream',
                r.after.length === 1 && !!r.doneAt && r.after[0] > r.doneAt, fmt(r));
        }
        await o.context.close();
    };

    function editScenario(id, stream) {
        return async () => {
            const p0 = buildPayload(FIX_PLAIN);
            const pE = buildPayload(FIX_PLAIN, { edit: 'done' });
            const plan = stream
                ? { phase: { idle: p0.payload, streaming: buildPayload(FIX_PLAIN, { edit: 'streaming' }).payload, done: pE.payload } }
                : { seq: [p0.payload, pE.payload] };
            const qr = ROWS - 2;
            const act = 'window.__mockVirtualization.partC.editQuestion(' + qr + ',' + JSON.stringify(EDIT_TEXT) + ',' +
                JSON.stringify(pE.truth[qr]) + ',' + JSON.stringify(pE.truth[qr + 1]) + ',' +
                (stream ? 'undefined' : JSON.stringify(REGEN_TEXT)) + ')' +
                (stream ? ';window.__mockVirtualization.partC.regenerate(' + (qr + 1) + ',' + JSON.stringify(REGEN_TEXT) + ',4500,null,null,3)' : '');
            const r = await streamScenario(id, keysCfg(p0.truth), plan, act, 22000);
            if (!precondition(id, r.ok && r.before === 1, 'ready=' + r.ok + ' fetches before=' + r.before)) return;
            if (!stream) {
                check('G8', '[guard] an edit of the last question resyncs once', r.after.length === 1, fmt(r));
            } else {
                check('G9', 'an edit whose new answer streams resyncs once, after the stream',
                    r.after.length === 1 && !!r.doneAt && r.after[0] > r.doneAt, fmt(r));
            }
        };
    }
    SCEN.S7 = editScenario('S7', false);
    SCEN.S8 = editScenario('S8', true);

    SCEN.S9 = async () => {
        const { payload, truth } = buildPayload(FIX_PLAIN);
        const cfg = keysCfg(truth);
        cfg.turnKeys[20] = truth[22];
        const o = await openPage(cfg, { seq: [payload] }, null);
        if (!precondition('S9', await ready(o.page, o.logs), 'index ready / visible')) { await o.context.close(); return; }
        const seen = [];
        for (const R of [20, 22]) {
            await o.page.evaluate('window.__p.mountRow(' + R + ')');
            await o.page.waitForTimeout(1500);
            (await o.page.evaluate('window.__p.questions()')).forEach((q) => { if (q.row === 20 || q.row === 22) seen.push(q); });
        }
        const bad = seen.filter((q) => q.row === 20 && q.id === truth[22]);
        const own = seen.filter((q) => q.row === 22 && q.id === truth[22]);
        const line = o.logs.filter((l) => /row 20's data-turn-key names path 22 but its position names path 20/.test(l.text));
        check('G6', '[guard] a row showing another message\'s key: no flag on it carries that uuid',
            seen.some((q) => q.row === 20) && bad.length === 0 && own.length > 0,
            'row 20 flags=' + seen.filter((q) => q.row === 20).map((q) => short(q.id)).join(',') + ' row 22 own=' + own.length);
        check('G6b', 'one console line names the disagreement', line.length === 1, 'lines=' + line.length);
        await o.page.waitForTimeout(5000);   // a signature from either row would have refetched by now
        const fetches = await o.page.evaluate('window.__acn.fetches');
        check('G6c', '[guard] neither row looks edited (each is compared with its own earlier text): one fetch, no "out of sync" line',
            fetches === 1 && outOfSync(o.logs).length === 0,
            'fetches=' + fetches + ' out-of-sync=' + outOfSync(o.logs).map((l) => l.text.replace(/^.*refetching/, '')).join('|'));
        await o.context.close();
    };

    SCEN.S10 = async () => {
        const fix = { mb: [], mbl: [], added: [], chip: [58] };
        const { payload, truth } = buildPayload(fix);
        const cfg = keysCfg(truth);
        cfg.turnKeys[40] = 'not-a-uuid-' + truth[40].slice(0, 8);
        cfg.doubleKeyRows = [42];
        cfg.doubleKeyFrom = { 42: 44 };
        cfg.chipRows = [58];
        const o = await openPage(cfg, { seq: [payload] }, null);
        if (!precondition('S10', await ready(o.page, o.logs), 'index ready / visible')) { await o.context.close(); return; }
        const seen = {};
        for (const R of [58, 40, 42]) {
            await o.page.evaluate('window.__p.mountRow(' + R + ')');
            await o.page.waitForTimeout(1500);
            (await o.page.evaluate('window.__p.questions()')).forEach((q) => { if (q.row === 40 || q.row === 42) seen[q.row] = q.id; });
        }
        for (const f of [0, 0.3, 0.6, 0.75, 0.9, 1]) {
            await o.page.evaluate('window.__mockVirtualization.scrollToFraction(' + f + ')');
            await o.page.waitForTimeout(1500);
        }
        await o.page.waitForTimeout(16000);
        check('G12', '[guard] a row with a malformed key and a row with two keys are identified by their text',
            seen[40] === truth[40] && seen[42] === truth[42], 'row 40=' + short(seen[40]) + ' row 42=' + short(seen[42]));
        const fb = o.logs.filter((l) => /has no usable data-turn-key/.test(l.text));
        check('G12b', 'one line names the first row without a usable key, and why',
            fb.length === 1 && /row (40|42) has no usable data-turn-key \((not a uuid|2 keys)\)/.test(fb[0].text),
            JSON.stringify(fb.map((l) => l.text)));
        const fetches = await o.page.evaluate('window.__acn.fetches');
        check('G7', '[guard] those rows and an attachment-only question with its key: one fetch, no "out of sync" line',
            fetches === 1 && outOfSync(o.logs).length === 0, 'fetches=' + fetches + ' out-of-sync=' + outOfSync(o.logs).length);
        const fb58 = o.logs.filter((l) => /row 58 has no usable data-turn-key/.test(l.text));
        check('G7b', '[guard] the attachment-only question (data-perf-row="human", no user-message node) is identified by its key',
            fb58.length === 0, JSON.stringify(fb58.map((l) => l.text)));
        await o.context.close();
    };

    SCEN.S12 = async () => {
        const { payload, truth } = buildPayload(FIX_SWEEP);
        const o = await openPage({ multiBlockTurns: MB, multiBlockLateTurns: MBL, addedTextTurns: ADDED }, { seq: [payload] }, null);
        if (!precondition('S12', await ready(o.page, o.logs), 'index ready / visible')) { await o.context.close(); return; }
        const mbTurns = MB.concat(ADDED);   // early differences: no text identity at all
        let plainOk = 0, plainBad = 0, mbUuid = 0, mbSeen = 0;
        for (const f of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
            await o.page.evaluate('window.__mockVirtualization.scrollToFraction(' + f + ')');
            await o.page.waitForTimeout(1500);
            (await o.page.evaluate('window.__p.questions()')).forEach((q) => {
                const turn = q.row / 2 + 1;
                if (mbTurns.indexOf(turn) !== -1) { mbSeen++; if (q.id === truth[q.row]) mbUuid++; }
                else if (MBL.indexOf(turn) === -1) { if (q.id === truth[q.row]) plainOk++; else plainBad++; }
            });
        }
        const fetches = await o.page.evaluate('window.__acn.fetches');
        check('G11', '[guard] keys off: plain questions carry their uuids by text, early multi-block ones carry none (as v12.14)',
            plainOk > 0 && plainBad === 0 && mbSeen > 0 && mbUuid === 0,
            'plain ok=' + plainOk + ' bad=' + plainBad + ' multi-block seen=' + mbSeen + ' with uuid=' + mbUuid +
            ' (fetches=' + fetches + ', reported only)');
        await o.context.close();
    };

    SCEN.S13 = async () => {
        const { payload, truth } = buildPayload(FIX_SWEEP);
        const store = {};
        store[CHAT_URL] = { bookmarks: ['QH', 'QB', 'QX', 'QW'].map((n) => JSON.parse(JSON.stringify(SEEDS[n]))) };
        const o = await openPage(Object.assign(keysCfg(truth), { multiBlockTurns: MB, multiBlockLateTurns: MBL, addedTextTurns: ADDED }),
                                 { seq: [payload] }, store);
        if (!precondition('S13', await ready(o.page, o.logs), 'index ready / visible')) { await o.context.close(); return; }
        for (const R of [rowOfQ(23), rowOfQ(13)]) {
            await o.page.evaluate('window.__p.mountRow(' + R + ')');
            await o.page.waitForTimeout(2000);
        }
        const list = await storeOf(o.page);
        const by = {};
        list.forEach((b) => { by[b.id] = b; });
        await o.page.evaluate('window.__p.openPanel()');
        await o.page.waitForTimeout(800);
        const cards = await o.page.evaluate('window.__p.cards()');
        const QH = by[SEEDS.QH.id], QX = by[SEEDS.QX.id], QW = by[SEEDS.QW.id], QB = by[SEEDS.QB.id];
        check('G13', 'v12.14\'s hash record on question 13 binds to its uuid once its row mounts, "Q#13"',
            !!QH && QH.msgUuid === truth[rowOfQ(13)] && QH.schema === 2 && cards.indexOf('Q#13') !== -1,
            'QH=' + (QH ? (QH.msgUuid ? 'bound ' + short(QH.msgUuid) : 'unbound') : 'gone') + ' cards=' + JSON.stringify(cards));
        const same = (a, b) => !!a && !!b && a.contentHash === b.contentHash && !a.msgUuid && a.schema === b.schema && a.pendingRow === b.pendingRow;
        check('G14', '[guard] a record whose hash its row does not reproduce, and one made on another row, stay unbound; ' +
            'a bound record stays bound, "Q#2"',
            same(QX, SEEDS.QX) && same(QW, SEEDS.QW) && !!QB && QB.msgUuid === truth[rowOfQ(2)] &&
            cards.indexOf('Q#2') !== -1,
            'QX=' + (QX ? (QX.msgUuid ? 'BOUND' : 'unbound') : 'gone') + ' QW=' + (QW ? (QW.msgUuid ? 'BOUND' : 'unbound') : 'gone') +
            ' QB=' + (QB ? short(QB.msgUuid) : 'gone') + ' QH bound=' + !!(QH && QH.msgUuid));
        await o.context.close();
    };

    // QH with one more record of question 13 already in the store: S13b (QI, bound by inference
    // only) and S13c (QD, bound).
    function pairScenario(id, other) {
        return async () => {
            const { payload, truth } = buildPayload(FIX_SWEEP);
            const second = Object.assign(JSON.parse(JSON.stringify(SEEDS.QB)), other, {
                contentHash: truth[rowOfQ(13)], msgUuid: truth[rowOfQ(13)], msgIndex: 12,
                preview: 'Question number 13: please check these steps.' });
            const store = {};
            store[CHAT_URL] = { bookmarks: [JSON.parse(JSON.stringify(SEEDS.QH)), second] };
            const o = await openPage(Object.assign(keysCfg(truth), { multiBlockTurns: MB, multiBlockLateTurns: MBL, addedTextTurns: ADDED }),
                                     { seq: [payload] }, store);
            if (!precondition(id, await ready(o.page, o.logs), 'index ready / visible')) { await o.context.close(); return; }
            await o.page.evaluate('window.__p.mountRow(' + rowOfQ(13) + ')');
            await o.page.waitForTimeout(2500);
            const by = {};
            (await storeOf(o.page)).forEach((b) => { by[b.id] = b; });
            await o.context.close();
            const QH = by[SEEDS.QH.id], S = by[second.id];
            const d = 'QH=' + (QH ? (QH.msgUuid ? 'bound ' + short(QH.msgUuid) : 'unbound') : 'gone') +
                      ' ' + second.id + '=' + (S ? short(S.msgUuid) + ' ' + (S.boundBy || '') : 'gone');
            if (id === 'S13b') {
                check('G18', 'QH binds to question 13 beside a record of it bound by inference only, which stays',
                    !!QH && QH.msgUuid === truth[rowOfQ(13)] && !!S && S.msgUuid === truth[rowOfQ(13)], d);
            } else {
                check('G19', 'QH, a second bookmark of a question already bookmarked, is removed; the bound record stays',
                    !QH && !!S && S.msgUuid === truth[rowOfQ(13)], d);
            }
        };
    }
    SCEN.S13b = pairScenario('S13b', { id: 'bm_qiqiqiqi', boundBy: 'inference', legacyHash: '1234abcd' });
    SCEN.S13c = pairScenario('S13c', { id: 'bm_qdqdqdqd' });

    // An edit in place: both rows keep their keys (S14), or take the edited messages' keys 4 s later
    // (S14b); the question's flag is clicked 0.5-1.5 s after the edit.
    function inPlaceEditScenario(id, rekey) {
        return async () => {
            const p0 = buildPayload(FIX_PLAIN);
            const pE = buildPayload(FIX_PLAIN, { edit: 'done' });
            const qr = ROWS - 2;
            const o = await openPage(keysCfg(p0.truth), { seq: [p0.payload, pE.payload] }, null);
            const ok = await ready(o.page, o.logs);
            await o.page.evaluate('window.__mockVirtualization.scrollToFraction(1)');
            await o.page.waitForTimeout(2500);
            const before = await o.page.evaluate('window.__acn.fetches');
            const t0 = await o.page.evaluate('performance.now()');
            await o.page.evaluate('(function () { var pc = window.__mockVirtualization.partC;' +
                'pc.editQuestion(' + qr + ',' + JSON.stringify(EDIT_TEXT) + ',undefined,undefined,' + JSON.stringify(REGEN_TEXT) + ');' +
                (rekey ? 'setTimeout(function () { pc.setTurnKey(' + qr + ',' + JSON.stringify(pE.truth[qr]) + ');' +
                         'pc.setTurnKey(' + (qr + 1) + ',' + JSON.stringify(pE.truth[qr + 1]) + '); }, 4000);' : '') + '})()');
            await o.page.waitForTimeout(500);
            let clicked = false;   // the flag can be redrawn just then: a few tries, 100 ms apart
            for (let k = 0; k < 10 && !clicked; k++) {
                clicked = await o.page.evaluate('window.__p.clickQuestionFlag(' + qr + ')');
                if (!clicked) await o.page.waitForTimeout(100);
            }
            await o.page.waitForTimeout(20000);
            const after = (await o.page.evaluate('window.__acn.fetchAt')).filter((t) => t > t0);
            const recs = (await storeOf(o.page)).filter((b) => b.entityType === 'user-msg');
            if (argv.includes('--logs')) {
                console.log('--- ' + id + '\n' + o.logs.filter((l) => /^\[(ACN|DBG)/.test(l.text)).map((l) => '    ' + l.text.slice(0, 220)).join('\n'));
            }
            await o.context.close();
            if (!precondition(id, ok && before === 1 && clicked && recs.length === 1,
                'ready=' + ok + ' fetches before=' + before + ' clicked=' + clicked + ' question records=' + recs.length)) return;
            const d = 'resyncs after the edit at ' + (after.map((t) => ((t - t0) / 1000).toFixed(1) + 's').join(',') || 'none') +
                      '; record ' + (recs[0].msgUuid ? 'uuid ' + short(recs[0].msgUuid) : 'hash ' + recs[0].contentHash) +
                      ' (superseded ' + short(p0.truth[qr]) + ', edited ' + short(pE.truth[qr]) + ')';
            if (!rekey) {
                check('G17', '[guard] an edit in place, keys kept: resynced (once or twice, never more), and no question record holds the superseded uuid',
                    after.length >= 1 && after.length <= 2 && recs[0].msgUuid !== p0.truth[qr], d);
            } else {
                check('G17b', '[guard] an edit in place, keys taken 4 s later: at most two resyncs, and the record made in between ends bound to the edited question',
                    after.length >= 1 && after.length <= 2 && recs[0].msgUuid === pE.truth[qr], d);
            }
        };
    }
    SCEN.S14 = inPlaceEditScenario('S14', false);
    SCEN.S14b = inPlaceEditScenario('S14b', true);

    console.log('check-claude-turnkeys — engine=' + engine + ', script=' + path.basename(scriptPath) + ', -j ' + jobs);
    const list = IDS.filter((id) => !only || only.indexOf(id) !== -1);
    let next = 0;
    async function worker() {
        while (next < list.length) {
            const id = list[next++];
            try { await SCEN[id](); }
            catch (e) { invalid++; lines.push({ id, text: '  INVALID  ' + id + ' threw — ' + (e && e.stack || e) }); }
        }
    }
    await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, worker));
    const order = (l) => { const m = /^G(\d+)/.exec(l.id); return m ? +m[1] + (/b$/.test(l.id) ? 0.5 : 0) + (/c$/.test(l.id) ? 0.6 : 0) : 1000; };
    lines.sort((a, b) => order(a) - order(b)).forEach((l) => console.log(l.text));
    await browser.close();
    if (invalid) console.log('\n' + invalid + ' scenario(s) INVALID: their checks did not run');
    console.log(failures || invalid ? '\n' + failures + ' check(s) FAILED' : '\nall checks passed');
    process.exit(failures || invalid ? 1 : 0);
})();
