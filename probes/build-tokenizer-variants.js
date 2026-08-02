// Writes candidate _sumTokenize builds so the tokenizer arc chooses a design on
// evidence instead of on which one sounds most complete (ROADMAP 0a, 2026-08-02).
//
// Run: ACN_SCRIPT=<pre-v12.7 build> node probes/build-tokenizer-variants.js [outDir]
//
// ACN_SCRIPT IS EFFECTIVELY REQUIRED NOW. The variants below are defined as
// replacements for the PRE-v12.7 `_sumTokenize` body, which the working tree no
// longer contains — v12.7 shipped variant `v2-length`. Point this at an explicit
// pre-change ref, exactly as the map harness's English baseline does:
//
//   git show 2ad8dc1:ai-conversation-navigator.user.js > /tmp/pre-v12.7.user.js
//   ACN_SCRIPT=/tmp/pre-v12.7.user.js node probes/build-tokenizer-variants.js /tmp/variants
//
// Kept rather than deleted because one question is still open (DEC-041): particle
// normalization was rejected for SEGMENTATION, and a display-only variant of it is
// the candidate fix if the live check says Korean labels read badly. Re-measuring
// that needs this sweep, and re-deriving the variants from scratch would be worse
// than keeping the ones that were actually scored.
// Then score each build with the map harness, which already knows the payload's
// true topic changes:
//   PAYLOAD_LANG=ko ACN_SCRIPT=<outDir>/v2-length.user.js \
//     node probes/run-map-harness.js --browser firefox --sizes 147 --vocab 1 --para 1
//
// The variants are CUMULATIVE — each adds one mechanism to the previous one — so
// the sweep answers "which layers are actually load-bearing?" rather than
// "does the whole thing help?". v12.6's lesson applies directly: a rule can score
// well for a reason that has nothing to do with the mechanism it claims, so each
// layer has to be shown to earn its place separately.
//
// NOT shipped. The chosen variant's body is what lands in the userscript.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

// The shipped body, matched exactly so a drift in the userscript is a loud
// failure here rather than a silently unpatched "variant" that measures the
// baseline five times (the "success signal from a wrapper" trap, CLAUDE.md).
const ORIGINAL = `    function _sumTokenize(text) {
        return text
            .toLowerCase()
            .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, ' ')
            .replace(/\`[^\`]+\`/g, ' ')
            .replace(/https?:\\/\\/\\S+/g, ' ')
            .replace(/[^a-z0-9\\s]/g, ' ')
            .split(/\\s+/)
            .filter(function (w) { return w.length > 2 && !SUMMARY_STOP_WORDS.has(w); });
    }`;

// Shared prelude of every variant: the strip is widened from "ASCII only" to
// "ASCII + Latin letters with diacritics + Hangul".
const WIDE_STRIP = `.replace(/[^a-z0-9\\u00c0-\\u024f\\uac00-\\ud7a3\\s]/g, ' ')`;

const VARIANTS = {

// v1 — the ROADMAP sketch, narrowed to the supported languages. Character class
// only: everything downstream still assumes English-shaped words.
'v1-charclass': `    function _sumTokenize(text) {
        return text
            .toLowerCase()
            .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, ' ')
            .replace(/\`[^\`]+\`/g, ' ')
            .replace(/https?:\\/\\/\\S+/g, ' ')
            ${WIDE_STRIP}
            .split(/\\s+/)
            .filter(function (w) { return w.length > 2 && !SUMMARY_STOP_WORDS.has(w); });
    }`,

// v2 — plus a script-aware minimum length. `length > 2` is an English rule (2-letter
// English words are function words); Korean content words are commonly two syllables.
'v2-length': `    var HANGUL_RE = /[\\uac00-\\ud7a3]/;
    function _sumTokenize(text) {
        return text
            .toLowerCase()
            .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, ' ')
            .replace(/\`[^\`]+\`/g, ' ')
            .replace(/https?:\\/\\/\\S+/g, ' ')
            ${WIDE_STRIP}
            .split(/\\s+/)
            .filter(function (w) {
                var min = HANGUL_RE.test(w) ? 2 : 3;
                return w.length >= min && !SUMMARY_STOP_WORDS.has(w);
            });
    }`,

// v3 — plus Korean stop words. SUMMARY_STOP_WORDS is English-only, so without this
// the highest-frequency Korean "topics" are predicates and connectives.
'v3-stopwords': `    var HANGUL_RE = /[\\uac00-\\ud7a3]/;
    var KO_STOP = ['있습니다','없습니다','합니다','입니다','됩니다','했습니다','하는','있는','되는',
        '그리고','하지만','그래서','또한','다만','결국','경우','때문','대해','통해','위해','대한',
        '이것','그것','저것','여기','거기','에서','으로','에게','부터','까지','그런','이런','저런',
        '수도','정도','같은','다른','모든','매우','아주','조금','바로','다시','아직','이미'];
    function _sumTokenize(text) {
        return text
            .toLowerCase()
            .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, ' ')
            .replace(/\`[^\`]+\`/g, ' ')
            .replace(/https?:\\/\\/\\S+/g, ' ')
            ${WIDE_STRIP}
            .split(/\\s+/)
            .filter(function (w) {
                var min = HANGUL_RE.test(w) ? 2 : 3;
                if (w.length < min) return false;
                if (SUMMARY_STOP_WORDS.has(w)) return false;
                for (var i = 0; i < KO_STOP.length; i++) if (KO_STOP[i] === w) return false;
                return true;
            });
    }`,

// v4 — plus particle (josa) normalization. Korean attaches particles directly to
// the noun, so one word appears as many distinct strings and every overlap measure
// under-counts. This is a HASH NORMALIZER, not a lemmatizer: it only has to map the
// same word to the same token, not to the linguistically correct stem.
'v4-particles': `    var HANGUL_RE = /[\\uac00-\\ud7a3]/;
    var KO_STOP = ['있습니다','없습니다','합니다','입니다','됩니다','했습니다','하는','있는','되는',
        '그리고','하지만','그래서','또한','다만','결국','경우','때문','대해','통해','위해','대한',
        '이것','그것','저것','여기','거기','에서','으로','에게','부터','까지','그런','이런','저런',
        '수도','정도','같은','다른','모든','매우','아주','조금','바로','다시','아직','이미'];
    var KO_PARTICLES = ['에서는','으로는','에게서','이라고','에서','에게','으로','라고','부터','까지',
        '처럼','보다','마다','조차','마저','밖에','이나','에는','와의','과의','에서','은','는','이',
        '가','을','를','의','에','로','와','과','도','만','나'];
    function _sumStripParticle(w) {
        if (!HANGUL_RE.test(w)) return w;
        for (var i = 0; i < KO_PARTICLES.length; i++) {
            var p = KO_PARTICLES[i];
            if (w.length > p.length + 1 && w.slice(w.length - p.length) === p) {
                return w.slice(0, w.length - p.length);
            }
        }
        return w;
    }
    function _sumTokenize(text) {
        var raw = text
            .toLowerCase()
            .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, ' ')
            .replace(/\`[^\`]+\`/g, ' ')
            .replace(/https?:\\/\\/\\S+/g, ' ')
            ${WIDE_STRIP}
            .split(/\\s+/);
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var w = _sumStripParticle(raw[i]);
            var min = HANGUL_RE.test(w) ? 2 : 3;
            if (w.length < min) continue;
            if (SUMMARY_STOP_WORDS.has(w)) continue;
            var stop = false;
            for (var k = 0; k < KO_STOP.length; k++) if (KO_STOP[k] === w) { stop = true; break; }
            if (stop) continue;
            out.push(w);
        }
        return out;
    }`,

// v5 — v4 with the Korean stop list REMOVED. v3 scored identically to v2, so the
// stop list has to be shown to earn its place at the level where frequency
// actually matters (whole-segment topic extraction) rather than kept because a
// tokenizer "should" have one. If v5 == v4, the list is dead weight: 50 hand-picked
// words nobody can maintain, and one more thing to be wrong.
'v5-nostop': `    var HANGUL_RE = /[\\uac00-\\ud7a3]/;
    var KO_PARTICLES = ['에서는','으로는','에게서','이라고','에서','에게','으로','라고','부터','까지',
        '처럼','보다','마다','조차','마저','밖에','이나','에는','와의','과의','에서','은','는','이',
        '가','을','를','의','에','로','와','과','도','만','나'];
    function _sumStripParticle(w) {
        if (!HANGUL_RE.test(w)) return w;
        for (var i = 0; i < KO_PARTICLES.length; i++) {
            var p = KO_PARTICLES[i];
            if (w.length > p.length + 1 && w.slice(w.length - p.length) === p) {
                return w.slice(0, w.length - p.length);
            }
        }
        return w;
    }
    function _sumTokenize(text) {
        var raw = text
            .toLowerCase()
            .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, ' ')
            .replace(/\`[^\`]+\`/g, ' ')
            .replace(/https?:\\/\\/\\S+/g, ' ')
            ${WIDE_STRIP}
            .split(/\\s+/);
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var w = _sumStripParticle(raw[i]);
            var min = HANGUL_RE.test(w) ? 2 : 3;
            if (w.length < min) continue;
            if (SUMMARY_STOP_WORDS.has(w)) continue;
            out.push(w);
        }
        return out;
    }`,
};

function main() {
    const outDir = process.argv[2] || path.join(__dirname, 'variants');
    const srcPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    console.log(`base build: ${srcPath}`);
    if (src.indexOf(ORIGINAL) === -1) {
        console.error(
            `FATAL: ${srcPath} does not contain the PRE-v12.7 _sumTokenize body this script\n` +
            'patches, so every "variant" would be written out as the unmodified base — five\n' +
            'copies of one build, reported as five measurements.\n' +
            'Point ACN_SCRIPT at a pre-v12.7 ref:\n' +
            '  git show 2ad8dc1:ai-conversation-navigator.user.js > /tmp/pre-v12.7.user.js\n' +
            '  ACN_SCRIPT=/tmp/pre-v12.7.user.js node probes/build-tokenizer-variants.js /tmp/variants');
        process.exit(1);
    }
    fs.mkdirSync(outDir, { recursive: true });
    Object.keys(VARIANTS).forEach((name) => {
        const out = src.replace(ORIGINAL, VARIANTS[name]);
        if (out === src) { console.error(`FATAL: ${name} produced no change`); process.exit(1); }
        const file = path.join(outDir, name + '.user.js');
        fs.writeFileSync(file, out);
        console.log(`  ${file}`);
    });
    // The unmodified baseline, written alongside so a sweep names its control
    // explicitly instead of relying on "whatever is in the working tree".
    fs.writeFileSync(path.join(outDir, 'v0-baseline.user.js'), src);
    console.log(`  ${path.join(outDir, 'v0-baseline.user.js')} (unmodified control)`);
}

main();
