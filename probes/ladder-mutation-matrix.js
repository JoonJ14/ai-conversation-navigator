// Turns a battery's summary.txt (probes/run-ladder-mutants.sh) into the mutation matrix for
// probes/check-transport-ladder.js: the reference runs first, then one row per mutant with the
// checks that failed. The tables in reviews/review-2026-10-22-safari-transport.md are pasted from
// this output, never transcribed by hand.
//
// Run: node probes/ladder-mutation-matrix.js <battery>/summary.txt
//
// A mutant no check catches is printed as NOT gated. A run that crashed, was killed, or ran a
// different number of checks than the build under test is printed as INVALID, never as gated:
// a probe that died early "fails" without having caught anything. Exits 1 when the build under
// test failed a check or any run was invalid, so a battery cannot end green on a broken reference.

'use strict';
const fs = require('fs');
const { DESC } = require('./build-ladder-mutants.js');

const file = process.argv[2];
if (!file) {
    console.error('usage: node probes/ladder-mutation-matrix.js <battery>/summary.txt');
    process.exit(2);
}
const runs = [];
for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = l.match(/^(\S+) \[(\w+)\] exit=(\d+) checks=(\d+) crashed=(\d+) FAIL: (.*)$/);
    if (!m) continue;
    const fails = m[6].trim();
    runs.push({ id: m[1], engine: m[2], exit: Number(m[3]), checks: Number(m[4]), crashed: Number(m[5]),
                failList: fails === 'none' ? [] : fails.split(/\s+/) });
}
const refs = runs.filter((r) => r.id === 'new');
const base = runs.filter((r) => r.id === 'baseline');
const rows = runs.filter((r) => r.id !== 'new' && r.id !== 'baseline').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const short = (id) => id.replace(/^(M\d+b?)-.*/, '$1');

// Every valid run executes every check; the build under test sets the count.
const expected = refs.length ? Math.max.apply(null, refs.map((r) => r.checks)) : 0;
function invalid(r) {
    if (r.crashed) return 'crashed';
    if (r.exit !== 0 && r.exit !== 1) return 'exit ' + r.exit;
    if (r.checks !== expected) return r.checks + ' of ' + expected + ' checks ran';
    if ((r.exit === 0) !== (r.failList.length === 0)) return 'exit code disagrees with its FAIL list';
    return '';
}

let bad = 0;
const out = [];
out.push('### build under test');
if (!refs.length) { out.push('- MISSING: no run of the build under test'); bad++; }
for (const r of refs) {
    const why = invalid(r);
    if (why || r.failList.length) bad++;
    out.push('- ' + r.engine + ': ' + r.checks + ' checks, ' + r.failList.length + ' fail' +
             (r.failList.length ? ' — ' + r.failList.join(' ') : '') + (why ? ' — INVALID: ' + why : ''));
}
out.push('### baseline (the build before the ladder)');
for (const r of base) {
    // The build before the ladder must fail: if it passes, the probe cannot tell the ladder's
    // absence apart, or the run never loaded the build it names.
    const why = invalid(r) || (r.failList.length ? '' : 'passes every check');
    if (why) bad++;
    out.push('- ' + r.engine + ': fails ' + r.failList.length + ' of ' + r.checks +
             (why ? ' — INVALID: ' + why : '') + ' — ' + r.failList.join(' '));
}
out.push('### matrix');
out.push('| Mutant | Mechanism removed | Checks that fail |');
out.push('|---|---|---|');
const gated = [], ungated = [], broken = [];
for (const r of rows) {
    const why = invalid(r);
    let cell;
    if (why) { broken.push(short(r.id)); bad++; cell = '**INVALID run: ' + why + '**'; }
    else if (r.failList.length) { gated.push(short(r.id)); cell = r.failList.join(', '); }
    else { ungated.push(short(r.id)); cell = '**none — NOT gated**'; }
    out.push('| ' + short(r.id) + ' | ' + (DESC[r.id] || r.id) + ' | ' + cell + ' |');
}
const notRun = Object.keys(DESC).filter((id) => !rows.some((r) => r.id === id)).map(short);
out.push('');
out.push(gated.length + ' of ' + rows.length + ' mutants run are gated' +
         '; not gated: ' + (ungated.join(', ') || 'none') +
         '; invalid: ' + (broken.join(', ') || 'none') +
         '; not run: ' + (notRun.length ? notRun.length + ' (' + notRun.join(', ') + ')' : 'none'));
console.log(out.join('\n'));
process.exit(bad ? 1 : 0);
