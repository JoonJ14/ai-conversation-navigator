// Measurement + unit checks for _sumTokenize — the input EVERY content-derived
// Summary feature reads (topics, key points, dedup, and both segmentation levels).
// Added 2026-08-02 for the tokenizer arc (ROADMAP item 0a, raised by GitHub Codex
// on PR #68).
//
// Run: node probes/check-tokenizer.js [--browser firefox] [--quiet]
// Exits non-zero on any failed expectation.
//
// WHY a dedicated surface rather than folding this into the map harness: the
// claim under test ("Korean produces zero tokens") is about ONE function, and
// the map has several independent reasons to produce nothing. Measuring the
// pipeline would confirm the symptom while leaving the cause inferred — the
// mistake CLAUDE.md's measurement-context rule exists to prevent.
//
// CONTEXT of every number below (record it with the finding): Playwright
// <engine> on this machine, page realm, the REAL shipped _sumTokenize /
// _sumWordOverlap / _sumExtractTopicsFromText reached through the map probe's
// __acnTokenizeRun hook. Not the Tampermonkey sandbox — but this function is
// pure string work with no host-object or cross-compartment surface, which is
// why the page realm is adequate HERE and is not adequate for fetch (DEC-019).
//
// LANGUAGE SCOPE (owner, 2026-08-02): the product ships English (default) and
// Korean — Korean is the ONLY translation. Accented Latin appears because
// English text contains it (café, naïve, résumé); Japanese appears in ONE check
// whose entire purpose is to pin the limit of a character-class fix, so that
// nobody later reads these numbers as "Unicode support". Neither is a supported
// language.

'use strict';

const fs = require('fs');
const path = require('path');
const { instrument } = require('./perf-instrument');
const { instrumentMap } = require('./map-instrument');

const REPO = path.join(__dirname, '..');
let playwright;
try { playwright = require(path.join(REPO, 'node_modules', 'playwright')); }
catch (e) { playwright = require('playwright'); }

const CONV_UUID = '77777777-7777-4777-8777-777777777777';
const ORG = '99999999-9999-4999-8999-999999999999';

function buildPage(scriptContent) {
    const mockHTML = fs.readFileSync(path.join(REPO, 'tests/mock-pages/claude-virtualized.html'), 'utf8');
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const tiny = {
        uuid: CONV_UUID, name: 'Tokenizer unit checks',
        current_leaf_message_uuid: 'aaaaaaaa-0000-4000-8000-000000000001',
        chat_messages: [
            { uuid: 'aaaaaaaa-0000-4000-8000-000000000000', parent_message_uuid: '00000000-0000-4000-8000-000000000000',
              index: 0, sender: 'human', text: '', created_at: '2026-07-01T00:00:00Z', attachments: [], files: [],
              content: [{ type: 'text', text: 'Probe question one.' }] },
            { uuid: 'aaaaaaaa-0000-4000-8000-000000000001', parent_message_uuid: 'aaaaaaaa-0000-4000-8000-000000000000',
              index: 1, sender: 'assistant', text: '', stop_reason: 'end_turn', created_at: '2026-07-01T00:00:00Z',
              attachments: [], files: [], content: [{ type: 'text', text: 'Probe answer one.' }] },
        ],
    };
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>tokenizer checks</title></head><body>
<script>window.__MOCK_CONFIG = {"totalMessages":2};</script>
${bodyMatch ? bodyMatch[1] : mockHTML}
<script>delete window._aiNavAlreadyLoaded;</script>
<script>
(function () {
    var PAYLOAD = ${JSON.stringify(tiny)};
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) { setTimeout(function () {
            if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
            else if (opts.onerror) opts.onerror({ status: status }); }, 10); }
        if (/\\/api\\/organizations$/.test(url)) { respond(200, JSON.stringify([{ uuid: ${JSON.stringify(ORG)}, name: 'Fixture Org', capabilities: ['chat'] }])); return; }
        if (url.indexOf('/chat_conversations/') !== -1) { respond(200, JSON.stringify(PAYLOAD)); return; }
        respond(404, '');
    };
    var _s = {};
    window.GM_getValue = function (k, d) { return _s.hasOwnProperty(k) ? _s[k] : d; };
    window.GM_setValue = function (k, v) { _s[k] = v; };
    try { document.cookie = 'lastActiveOrg=' + ${JSON.stringify(ORG)} + '; path=/'; } catch (e) {}
}());
</script>
<script>${scriptContent}</script></body></html>`;
}

// ---------------------------------------------------------------------------
// Sample texts. Every Korean sample is ordinary technical prose of the kind the
// one Korean-speaking user this translation was added for would actually write.
// ---------------------------------------------------------------------------

// Two messages about the SAME topic (login/session), then one about a DIFFERENT
// topic (database migration). This triple is the functional core of the whole
// arc: segmentation at both levels only works if same-topic overlap is
// materially higher than cross-topic overlap.
const KO_SAME_A = '로그인 세션이 자꾸 끊어지는 문제를 찾고 있습니다. 토큰 만료 시간을 늘려도 ' +
                  '세션이 유지되지 않고 인증 서버에서 갱신 요청이 거부됩니다. 쿠키 설정이 원인일까요?';
const KO_SAME_B = '세션 갱신 요청이 거부되는 이유는 토큰의 만료 시각과 쿠키의 유효 기간이 서로 ' +
                  '다르기 때문입니다. 인증 서버는 갱신 토큰을 확인하지만 로그인 쿠키가 먼저 삭제됩니다.';
const KO_DIFF   = '데이터베이스 마이그레이션 중에 외래키 제약 때문에 롤백이 발생합니다. 스키마를 ' +
                  '변경하기 전에 색인을 삭제하고 트랜잭션 크기를 줄이는 편이 안전합니다.';

// Pure Korean, no ASCII at all — the exact shape of the ROADMAP 0a claim.
const KO_PURE = '인증 토큰이 만료되어 세션이 종료되었습니다.';

// The 2-syllable population. Korean content words are commonly two syllables,
// and `w.length > 2` is a rule written for English, where 2-letter words are
// function words. 인증/세션/토큰/권한/제약/색인 are all content-bearing.
const KO_SHORT = '인증 세션 토큰 권한 제약 색인 배포 성능 분석 지표';

// One noun in six surface forms. Korean is agglutinative: particles attach
// directly to the noun, so a whitespace tokenizer sees six distinct strings
// where a reader sees one word. This is what a character class alone cannot fix.
const KO_PARTICLES = '토큰이 토큰을 토큰은 토큰의 토큰에서 토큰으로';

// Accented / punctuated ENGLISH — not another language, just what English text
// actually contains. Current build: café → caf, naïve → na + ve.
const LAT = 'The café cache was naïve about résumé parsing — don’t rely on it.';

// Pure ASCII English, the regression anchor. Whatever changes, this must not.
const EN = 'The authentication session token expired before the refresh handler could renew it.';

// Japanese: present ONLY to pin the limit. Japanese is not space-separated, so a
// character class yields roughly one token per run of kana/kanji between
// punctuation — the feature is NOT fixed for it, and this check exists so that
// is a recorded measurement rather than an omission somebody later reads as support.
const JA = 'データベースの移行中に外部キー制約のためロールバックが発生します。';

// Things that must NOT become tokens, in any build: emoji, smart quotes as
// standalone tokens, and the contents of fenced code (already stripped today).
const NOISE = 'Looks good 🙂👍 — see `inline_code` and:\n```js\nconst zzzuniquefence = 1;\n```\nDone.';

// U+00D7 MULTIPLICATION SIGN and U+00F7 DIVISION SIGN are the ONLY non-letters
// inside U+00C0-U+024F. A range written as a single À-ɏ span therefore
// keeps them, and they GLUE tokens that the ASCII-only class used to split:
// `1920×1080` became one token instead of two (found in Tier 3 review of v12.7,
// before merge). The shipped class excludes them with three sub-ranges. This
// sample is the regression gate for that — a future "simplification" back to one
// span reintroduces it silently, because no other check contains these characters.
const MULDIV = 'Render at 1920×1080 and divide 12÷4 evenly.';

// NFD forms of two samples above. Neither the DOM nor the API guarantees a
// normalization form, and macOS produces NFD for Korean input. In NFD the
// character whitelist is defeated the same way the ASCII-only class was:
// decomposed Korean is U+1100-series Jamo (not the syllable block) and yields
// NOTHING, while decomposed Latin is CORRUPTED rather than dropped — the
// combining mark is stripped and `résumé` becomes `sume`. Found by GitHub Codex
// on PR #70; the fix is `.normalize('NFC')` as the tokenizer's first step.
const KO_NFD  = KO_PURE.normalize('NFD');
const LAT_NFD = 'The café was naïve about résumé parsing.'.normalize('NFD');

(async () => {
    const engine = (process.argv.indexOf('--browser') !== -1
        ? process.argv[process.argv.indexOf('--browser') + 1] : 'firefox');
    const quiet = process.argv.includes('--quiet');
    const scriptPath = process.env.ACN_SCRIPT || path.join(REPO, 'ai-conversation-navigator.user.js');
    const raw = fs.readFileSync(scriptPath, 'utf8');
    const probeScript = instrumentMap(instrument(raw, 'tok1'));
    const browser = await playwright[engine].launch({
        headless: true,
        args: engine === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const targetURL = `https://claude.ai/chat/${CONV_UUID}`;
    const html = buildPage(probeScript);
    await page.route('**/*', (route) => {
        const u = route.request().url();
        if (u === targetURL || u === targetURL + '/') route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
        else route.abort();
    });
    await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('typeof window.__acnTokenizeRun === "function"', null, { timeout: 30000 });

    const tok = async (texts) => JSON.parse(await page.evaluate(
        (j) => window.__acnTokenizeRun(j), JSON.stringify(texts)));

    let failures = 0;
    const check = (name, ok, detail) => {
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
        if (!ok) failures++;
    };

    console.log(`\n=== _sumTokenize checks (${engine}) ===`);
    console.log(`userscript under measurement: ${scriptPath}`);

    const r = await tok([KO_SAME_A, KO_SAME_B, KO_DIFF, KO_PURE, KO_SHORT, KO_PARTICLES, LAT, EN, JA, NOISE, MULDIV, KO_NFD, LAT_NFD]);
    const [koA, koB, koD, koPure, koShort, koPart, lat, en, ja, noise, muldiv, koNfd, latNfd] = r;

    if (!quiet) {
        const rows = [
            ['ko same-topic A', koA], ['ko same-topic B', koB], ['ko other topic', koD],
            ['ko pure (no ASCII)', koPure], ['ko 2-syllable nouns', koShort],
            ['ko one noun, 6 particles', koPart],
            ['accented English', lat], ['plain English', en],
            ['japanese (limit probe)', ja], ['emoji/quotes/code', noise],
            ['multiplication/division', muldiv],
            ['ko NFD (decomposed)', koNfd], ['accented NFD (decomposed)', latNfd],
        ];
        console.log('\n  sample                      chars  tokens  distinct  first tokens');
        rows.forEach(([name, x]) => {
            console.log('  ' + name.padEnd(26) + String(x.chars).padStart(5) +
                String(x.tokens).padStart(8) + String(x.distinct).padStart(10) + '  ' +
                x.sample.slice(0, 6).join(' '));
        });
        console.log(`\n  overlap same-topic (A vs B): ${koB.overlapWithPrev.toFixed(3)}`);
        console.log(`  overlap cross-topic (B vs D): ${koD.overlapWithPrev.toFixed(3)}`);
        console.log(`  topics of ko same-topic A:   [${koA.topics.join(', ')}]`);
        console.log(`  topics of plain English:     [${en.topics.join(', ')}]`);
    }

    console.log('');

    // --- The claim in ROADMAP 0a, measured on the function it is about --------
    check('T1  pure Korean text produces tokens at all',
        koPure.tokens > 0, `${koPure.tokens} tokens from ${koPure.chars} chars`);

    // --- The property every content feature actually needs -------------------
    // Discrete rather than continuous near a threshold (CLAUDE.md): the assertion
    // is a strict ORDERING between two overlaps, not either one clearing a number.
    check('T2  same-topic Korean overlaps MORE than cross-topic Korean',
        koB.overlapWithPrev > koD.overlapWithPrev &&
        koB.overlapWithPrev > 0,
        `same ${koB.overlapWithPrev.toFixed(3)} vs cross ${koD.overlapWithPrev.toFixed(3)}`);

    check('T3  Korean text yields usable topic terms',
        koA.topics.length >= 3 && koA.topics.every((t) => /[가-힣]/.test(t)),
        `[${koA.topics.join(', ')}]`);

    // --- Two-syllable content words -----------------------------------------
    // Ten 2-syllable nouns in, and the English-derived `length > 2` rule decides
    // how many survive. Stated as a count so a partial fix is visible.
    check('T4  2-syllable Korean nouns survive the length filter',
        koShort.distinct >= 8, `${koShort.distinct} of 10 kept`);

    // --- Agglutination ------------------------------------------------------
    // Recorded, and deliberately NOT asserted to be 1: whether to normalize
    // particles is a design decision with its own measurement. The check pins
    // what the build actually does so the number cannot drift unnoticed.
    console.log(`  NOTE  one noun in 6 particle forms tokenizes as ${koPart.distinct} distinct token(s) ` +
        `[${koPart.sample.join(' ')}]`);

    // --- Accented Latin ------------------------------------------------------
    // Requires EVERY word it names, not just the first. Asserting only `café` let a
    // narrowed Latin range that preserved é but dropped ï pass a check advertising all
    // three — and `naïve` fails by VANISHING (both fragments land under the length
    // floor), so an "absence of the broken form" check cannot see it either. Presence of
    // each whole word is the only form that covers what the name claims (Codex, PR #70).
    const LAT_REQUIRED = ['café', 'naïve', 'résumé'];
    const latAll = lat.sample.concat(lat.topics).join(' ');
    check('T5  accented English words stay whole (café, naïve, résumé)',
        LAT_REQUIRED.every((w) => lat.sample.indexOf(w) !== -1) && latAll.indexOf('caf ') === -1,
        `missing [${LAT_REQUIRED.filter((w) => lat.sample.indexOf(w) === -1).join(', ') || 'none'}] ` +
        `in [${lat.sample.join(' ')}]`);

    // --- The ASCII regression anchor -----------------------------------------
    // Hardcoded from the pre-change build. Pure-ASCII English must tokenize
    // IDENTICALLY: a widened character class can only PRESERVE characters it used
    // to drop, so any change here means the strip was widened past its intent.
    const EN_EXPECTED = ['authentication', 'session', 'token', 'expired', 'refresh', 'handler', 'renew'];
    check('T6  pure-ASCII English tokenizes exactly as before',
        JSON.stringify(en.sample.slice(0, EN_EXPECTED.length)) === JSON.stringify(EN_EXPECTED),
        `[${en.sample.join(' ')}]`);

    // --- Noise must stay out --------------------------------------------------
    const noiseJoined = noise.sample.join(' ');
    check('T7  emoji, smart quotes and fenced code produce no tokens',
        !/[\u{1F300}-\u{1FAFF}‘-”]/u.test(noiseJoined) &&
        noiseJoined.indexOf('zzzuniquefence') === -1 &&
        noiseJoined.indexOf('inline_code') === -1,
        `[${noiseJoined}]`);

    // --- The limit, pinned on purpose ----------------------------------------
    // Japanese has no spaces, so whitespace tokenization cannot segment it however
    // wide the character class gets. Asserting the LIMIT (not the fix) is what
    // stops "Korean works" from being written up as "Unicode support" later.
    check('T8  LIMIT: Japanese stays coarse — few tokens for a whole sentence',
        ja.distinct <= 4,
        `${ja.distinct} distinct token(s) for ${ja.chars} chars — not space-separated, ` +
        `needs segmentation rather than a character class`);

    // --- The Tier 3 finding, gated ------------------------------------------
    // Asserts the SPLIT, not merely that the characters are absent: the defect was
    // two numbers fusing into one token, which a "no × in the output" check would
    // also have passed on a build that dropped the whole run.
    check('T9  multiplication/division signs SPLIT tokens, they do not glue them',
        muldiv.sample.indexOf('1920') !== -1 && muldiv.sample.indexOf('1080') !== -1 &&
        !muldiv.sample.join(' ').match(/[\u00d7\u00f7]/),
        `[${muldiv.sample.join(' ')}]`);

    // --- Normalization form, the second Codex finding, gated ------------------
    // Asserts EQUALITY WITH THE NFC RESULT, not merely "non-empty": the failure
    // mode for Latin was corruption (`résumé` -> `sume`), which a non-empty check
    // would have passed. Korean's failure mode was emptiness. One assertion covers
    // both because canonically equivalent text must tokenize identically, full stop.
    check('T10 decomposed (NFD) Korean tokenizes identically to composed (NFC)',
        JSON.stringify(koNfd.sample) === JSON.stringify(koPure.sample) && koNfd.tokens > 0,
        `NFD [${koNfd.sample.join(' ')}] vs NFC [${koPure.sample.join(' ')}]`);
    // Same completeness rule as T5: require all three whole words. The corruption forms
    // (`sume`, `nai`) are asserted absent as well, but absence alone is satisfied by a
    // build that drops the word entirely — which is precisely how `naïve` fails.
    check('T11 decomposed (NFD) accented English is not corrupted into other words',
        LAT_REQUIRED.every((w) => latNfd.sample.indexOf(w) !== -1) &&
        ['sume', 'nai', 'caf'].every((bad) => latNfd.sample.indexOf(bad) === -1),
        `missing [${LAT_REQUIRED.filter((w) => latNfd.sample.indexOf(w) === -1).join(', ') || 'none'}] ` +
        `in [${latNfd.sample.join(' ')}]`);

    console.log(`\n${failures ? failures + ' FAILED' : 'all checks passed'}\n`);
    await context.close();
    await browser.close();
    process.exit(failures ? 1 : 0);
})();
