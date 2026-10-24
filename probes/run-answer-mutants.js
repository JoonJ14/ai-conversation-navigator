// Targeted mutants for the answer-bookmark fix (DEC-051): each removes one mechanism by exact string
// replacements, each of which must match exactly once or the run stops (DEC-037's silent-non-execution
// class), and runs probes/check-answer-bookmarks.js on the runs that should catch it. A mutant counts as
// caught only when the named check fails; a crashed or INVALID run is reported as INVALID, never caught.
//
// Run: node probes/run-answer-mutants.js [--browser chromium] [-j 3] [M1 M4 ...]
// Not in CI, like the transport-ladder battery: run it after changing the answer code or the probe.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const REPO = path.join(__dirname, '..');
// The build the mutants are made from (and the baseline runs): ACN_SCRIPT, or the working tree's.
const SRC_FILE = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
const SRC = fs.readFileSync(SRC_FILE, 'utf8');

const MUTANTS = [
    { id: 'M1', what: 'answers flagged through getAIMessages (document-wide first match), not the row finder',
      runs: 'R2', expect: ['A9', 'A10'],
      edits: [["        if (ciIsClaudeChat()) {\n            // Answers by their row and its position",
               "        if (false) {\n            // Answers by their row and its position"]] },
    { id: 'M2', what: 'the label counts rendered answers instead of naming the question',
      runs: 'R1', expect: ['A4'],
      edits: [["        return i18n('answerToQuestion', { n: q + 1 });",
               "        var ren = 0; for (var mi = 0; mi < _ciFullPath.length; mi++) { if (_ciFullPath[mi].uuid === bm.msgUuid) break; " +
               "if (_ciFullPath[mi].sender === 'assistant' && ciEntryRenders(_ciFullPath[mi])) ren++; }\n" +
               "        return i18n('answerToQuestion', { n: ren + 1 });"]] },
    { id: 'M3', what: 'no proof pass at all',
      runs: 'R3', expect: ['A14', 'A15'],
      edits: [['            _bmProveAnswers(amap);\n', '\n'],
              ['                        _bmProveAnswers();\n', '\n']] },
    { id: 'M4', what: 'proof by the hash on any mounted row, not the row the record was made on',
      runs: 'R3', expect: ['A16'],
      edits: [["                var p = map.pathOf[b.pendingRow];\n                if (p === null || p === undefined) continue;\n" +
               "                var row = null;\n                for (k = 0; k < map.rows.length; k++) if (map.rows[k].dataIndex === b.pendingRow) row = map.rows[k];\n",
               "                var row = null;\n                for (k = 0; k < map.rows.length; k++) if (contentHash(_readAIText(map.rows[k].node), -1) === b.contentHash) row = map.rows[k];\n" +
               "                var p = row ? map.pathOf[row.dataIndex] : null;\n                if (p === null || p === undefined) continue;\n"]] },
    { id: 'M5', what: 'proof by the row alone, without reproducing the hash',
      runs: 'R3', expect: ['A16'],
      edits: [["                if (!row || contentHash(_readAIText(row.node), -1) !== b.contentHash) continue;",
               "                if (!row) continue;"]] },
    { id: 'M6', what: 'an answer flag matches records by their older text forms again (the twin bug)',
      runs: 'R3', expect: ['A18'],
      edits: [["        if (entityType === 'ai-msg' && rowIdx >= 0 && ciIsClaudeChat()) {",
               "        if (false) {"]] },
    { id: 'M7', what: 'no refresh requested for an answer the index does not hold yet',
      runs: 'R5', expect: ['A24'],
      edits: [["ciIsClaudeChat()) _bmRequestIndexRefresh(rowIdx);", "ciIsClaudeChat()) {}"]] },
    { id: 'M8', what: 'the status line skips provisional records again',
      runs: 'R3', expect: ['A19'],
      edits: [['            if (b.msgUuid) continue;\n            out.push(',
               '            if (b.msgUuid || b.pendingHash) continue;\n            out.push(']] },
    { id: 'M9', what: 'ciMessageNodeWithin also returns assistant-message (answers enter the staleness check)',
      runs: 'R1', expect: ['A6'],
      edits: [["        return rowEl.querySelector('[data-testid=\"user-message\"]') ||\n               rowEl.querySelector('.font-claude-response') ||",
               "        return rowEl.querySelector('[data-testid=\"user-message\"]') ||\n               rowEl.querySelector('[data-testid=\"assistant-message\"]') ||\n               rowEl.querySelector('.font-claude-response') ||"]] },
    { id: 'M10', what: 'an answer bookmark jumps through the generic path (getAIMessages) again',
      runs: 'R3', expect: ['A18'],
      edits: [["        if (bookmark.entityType === 'ai-msg' && ciIsClaudeChat()) { _bmJumpToAnswer(bookmark); return; }\n", '']] },
    { id: 'M11', what: 'a provable second record of an already-bookmarked answer is bound too, not removed',
      runs: 'R3', expect: ['A27'],
      edits: [['                if (other) return l.filter(function (x) { return x.id !== id; });\n', '\n']] },
    { id: 'M12', what: 'answer rows placed by the stop_reason predicate alone (_ciRenderable[row])',
      runs: 'R2', expect: ['A28'],
      edits: [["            var p = (placed && d < bound) ? _ciAnswerPathForRow(d, byRow, total) : null;",
               "            var rp = placed && d < bound ? _ciRenderable[d] : -1;\n" +
               "            var p = (rp >= 0 && _ciFullPath[rp] && _ciFullPath[rp].sender === 'assistant') ? rp : null;"]] },
    { id: 'M13', what: 'an unplaced answer flag\'s mark without its row (a recycled node keeps a twin\'s lit state)',
      runs: 'R6', expect: ['A30'],
      edits: [['            var mark = row !== undefined ? _bmAnswerKey(id, row) : id;', '            var mark = id;']] },
    { id: 'M14', what: 'no identity check at click time (a recycled node acts for the answer it showed before)',
      runs: 'R6', expect: ['A29', 'A31'],
      edits: [['            if (answerKey !== null && _bmAnswerKeyNow(entityEl) !== answerKey) {',
               '            if (false) {']] },
    { id: 'M15', what: 'an unplaced flag matches a hash record with no row',
      runs: 'R6', expect: ['A32'],
      edits: [['            return !b.msgUuid && b.contentHash === entityId && b.pendingRow === rowIdx;',
               '            return !b.msgUuid && b.contentHash === entityId &&\n' +
               '                   !(typeof b.pendingRow === \'number\' && b.pendingRow >= 0 && b.pendingRow !== rowIdx);']] },
    { id: 'M16', what: 'a record bound only by inference counts as the original, so the proven record is removed',
      runs: 'R3', expect: ['A14'],
      edits: [["                    else if (l[i].entityType === 'ai-msg' && l[i].msgUuid === uuid &&\n" +
               "                             !(l[i].boundBy === 'inference' && l[i].legacyHash)) other = true;",
               "                    else if (l[i].entityType === 'ai-msg' && l[i].msgUuid === uuid) other = true;"]] },
    { id: 'M17', what: 'the proof pass ignores what is stored (another tab\'s record waits for the screen to change)',
      runs: 'R3', expect: ['A33'],
      edits: [['            if (key === _bmProveSeen && raw === _bmProveRaw) return;',
               '            if (key === _bmProveSeen) return;']] },
    { id: 'M18', what: 'the bookmark\'s refetch logs the "out of sync" line, as if the page had changed',
      runs: 'R5', expect: ['A24'],
      edits: [['                        if (ciStale) {\n', '                        if (true) {\n']] },
];

function build(m) {
    let s = SRC;
    for (const [from, to] of m.edits) {
        const n = s.split(from).length - 1;
        if (n !== 1) throw new Error(m.id + ': an edit matched ' + n + ' times: ' + JSON.stringify(from.slice(0, 80)));
        s = s.replace(from, () => to);
    }
    return s;
}

(async () => {
    const argv = process.argv.slice(2);
    const engine = argv.indexOf('--browser') !== -1 ? argv[argv.indexOf('--browser') + 1] : 'chromium';
    const jArg = argv.indexOf('-j') !== -1 ? argv[argv.indexOf('-j') + 1] : '3';
    if (!/^[1-9]\d*$/.test(String(jArg))) { console.log('INVALID: -j needs a whole number of at least 1'); process.exit(1); }
    const jobs = parseInt(jArg, 10);
    // Every argument that is not an option or an option's value names a mutant.
    const valued = { '--browser': 1, '-j': 1 };
    const pick = argv.filter((a, i) => a.charAt(0) !== '-' && !valued[argv[i - 1]]);
    const unknown = pick.filter((id) => !MUTANTS.some((m) => m.id === id));
    if (unknown.length) { console.log('INVALID: no such mutant ' + unknown.join(', ')); process.exit(1); }
    const list = MUTANTS.filter((m) => !pick.length || pick.indexOf(m.id) !== -1);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acn-answer-mutants-'));
    try {
        for (const m of list) fs.writeFileSync(path.join(dir, m.id + '.user.js'), build(m));
    } catch (e) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log('INVALID: ' + e.message);
        process.exit(1);
    }
    console.log('answer-bookmark mutants — engine=' + engine + ', ' + list.length + ' mutants of ' +
                path.basename(SRC_FILE) + ', builds in ' + dir);

    // The build under test first: a check the fix itself fails would otherwise count every mutant
    // that expects it as caught.
    // The same source the mutants are built from, whatever ACN_SCRIPT the caller had set.
    const baseFile = path.join(dir, 'base.user.js');
    try { fs.writeFileSync(baseFile, SRC); }
    catch (e) { fs.rmSync(dir, { recursive: true, force: true }); console.log('INVALID: ' + e.message); process.exit(1); }
    const base = await new Promise((resolve) => {
        execFile('node', [path.join(__dirname, 'check-answer-bookmarks.js'), '--browser', engine],
            { env: Object.assign({}, process.env, { ACN_SCRIPT: baseFile }),
              maxBuffer: 16 * 1024 * 1024, timeout: 900000 }, (err, stdout) => resolve({ err, out: String(stdout || '') }));
    });
    if (base.err || !/all checks passed/.test(base.out)) {
        console.log('INVALID: the unmutated build does not pass check-answer-bookmarks:\n' +
                    (base.out.match(/^\s+(FAIL|INVALID).*$/gm) || ['(no output)']).join('\n'));
        fs.rmSync(dir, { recursive: true, force: true });
        process.exit(1);
    }
    console.log('baseline: the unmutated build passes every check');

    const results = {};
    let next = 0;
    async function worker() {
        while (next < list.length) {
            const m = list[next++];
            results[m.id] = await new Promise((resolve) => {
                execFile('node', [path.join(__dirname, 'check-answer-bookmarks.js'), '--browser', engine, '--only', m.runs],
                    { env: Object.assign({}, process.env, { ACN_SCRIPT: path.join(dir, m.id + '.user.js') }),
                      maxBuffer: 16 * 1024 * 1024, timeout: 600000 },
                    (err, stdout) => resolve(String(stdout || '')));
            });
        }
    }
    await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, worker));

    let bad = 0;
    for (const m of list) {
        const out = results[m.id];
        const failed = (out.match(/^\s+FAIL\s+(A\d+)/gm) || []).map((l) => l.trim().split(/\s+/)[1]);
        const invalid = /INVALID/.test(out) || !/check\(s\) FAILED|all checks passed/.test(out);
        const caught = !invalid && m.expect.every((id) => failed.indexOf(id) !== -1);
        if (!caught) bad++;
        console.log((invalid ? 'INVALID ' : caught ? 'caught  ' : 'MISSED  ') + m.id + ' ' + m.what +
                    ' — expected ' + m.expect.join(',') + ', failed: ' + (failed.join(',') || 'none'));
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(bad ? '\n' + bad + ' mutant(s) not caught' : '\nevery mutant caught (' + list.length + ')');
    process.exit(bad ? 1 : 0);
})();
