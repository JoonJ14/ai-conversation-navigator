// Builds probes/acn-perf-probe.user.js — the instrumented Summary-perf probe —
// from the canonical userscript. The output is a git-ignored build artifact:
// regenerate it from the current tree, never edit or commit it.
//
// Usage (from anywhere):  node probes/build-perf-probe.js

'use strict';

const fs = require('fs');
const path = require('path');
const { instrument } = require('./perf-instrument');

const REPO = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(REPO, 'ai-conversation-navigator.user.js'), 'utf8');
const out = instrument(src, 'perf1');
const dest = path.join(__dirname, 'acn-perf-probe.user.js');
fs.writeFileSync(dest, out);
console.log('wrote ' + dest + ' (' + out.length + ' chars, +' + (out.length - src.length) + ' over source)');
