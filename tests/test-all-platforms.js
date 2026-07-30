/**
 * AI Conversation Navigator — Automated Platform Test Suite
 *
 * DESIGN GOAL: These tests never need to be rewritten when the script gets a
 * major UI overhaul (v10 → v11 → v50). They query the DOM using a stable
 * data-attribute contract that the script publishes, not internal IDs or CSS
 * class names that change between versions.
 *
 * ── Stable test contract (script must honour these) ──────────────────────────
 *   data-acn-role="zone"         Main container injected into the page
 *   data-acn-role="styles"       The injected <style> element
 *   data-acn-role="nav-trigger"  Element that opens the navigation panel when clicked
 *   data-acn-role="nav-panel"    The navigation panel element
 *   data-acn-role="nav-stat"     Shows the detected question count
 *   data-acn-role="nav-list"     Container holding the question items
 *   data-acn-role="nav-item"     Each individual question entry
 *   data-acn-role="nav-item-text" The display text inside each nav-item
 *   data-acn-role="panel-close"  Closes the currently open panel when clicked
 *
 *   data-acn-accent="#hexcolor"  Platform accent colour (on the zone element)
 *   data-acn-ui="orbital|legacy"   UI system (on the zone element; distinct from data-acn-mode which tracks display modes)
 *   data-acn-dot="nav|search|bookmarks|summary|tools|settings" Each orbital dot (orbital mode only)
 *   data-acn-open="true"         Present on nav-panel when panel is open, absent when closed
 *   data-acn-count="N"           Number of detected questions (on nav-stat element)
 *
 * Any future version of the script that sets these attributes will pass the
 * test suite without any changes to this file.  When platform selectors or
 * theme colours change, only the PLATFORMS array below needs updating.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tests every supported platform across multiple browser engines by:
 *  1. Loading mock HTML into headless browser pages via Playwright
 *  2. Serving mock HTML at the real platform hostname via route interception
 *     (so window.location.hostname matches — no hostname spoofing needed)
 *  3. Injecting the userscript
 *  4. Querying the DOM using data-acn-role selectors from the contract above
 *
 * Supported browser engines: chromium, firefox, webkit
 *
 * Usage:
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js --browser chromium
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js --browser chromium,firefox,webkit
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/test-all-platforms.js --screenshots
 *
 * Or use the convenience script:
 *   ./tests/run-tests.sh
 *   ./tests/run-tests.sh --browser firefox
 *   ./tests/run-tests.sh --browser all
 *   ./tests/run-tests.sh --screenshots
 */

const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Browser engine definitions ────────────────────────────────────────────────

const BROWSER_ENGINES = {
    chromium: {
        name: 'Chromium',
        launcher: playwright.chromium,
        // Chromium-specific launch args for sandboxed/CI environments.
        //
        // NO --single-process. It was here from the suite's first commit and was
        // survivable only while the mocks were light. In single-process mode the
        // renderer shares the browser process, so ANY renderer fault takes the whole
        // browser down and every later platform dies with "Target page, context or
        // browser has been closed" — which is exactly what happened on Windows
        // chromium once claude-virtualized.html started doing real scroll work:
        // 13 of 16 platforms cascaded from one renderer fault. Firefox and WebKit on
        // the same runner lost nothing, because only chromium was passed this flag.
        launchArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
        ],
        // Hardcoded fallback paths for this specific dev environment
        fallbackPaths: [
            '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
            '/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',
        ],
    },
    firefox: {
        name: 'Firefox',
        launcher: playwright.firefox,
        launchArgs: [],
        fallbackPaths: [],
    },
    webkit: {
        name: 'WebKit',
        launcher: playwright.webkit,
        launchArgs: [],
        fallbackPaths: [],
    },
};

// Parse --browser flag from CLI args (default: chromium only for local runs)
function parseBrowserArg() {
    const idx = process.argv.indexOf('--browser');
    if (idx === -1) return ['chromium'];

    const val = process.argv[idx + 1];
    if (!val) return ['chromium'];

    if (val === 'all') return Object.keys(BROWSER_ENGINES);

    return val.split(',').map(b => b.trim().toLowerCase()).filter(b => BROWSER_ENGINES[b]);
}

// Check if --screenshots flag is present
function shouldCaptureScreenshots() {
    return process.argv.includes('--screenshots');
}

// Slugify a platform name for use in filenames (e.g. "Claude Code" → "claude-code")
function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Platform definitions ───────────────────────────────────────────────────────
//
// expectedAccent: the value set on data-acn-accent (hex string from the script's colour map).
//   - Orbital platforms (claude, chatgpt, grok, gemini, perplexity) use ORB_COLORS[platform.id].bg.
//   - Legacy platforms (app-builders + firebase_studio) use platform.theme.accent from PLATFORMS.
//
// expectedMessages: number of user messages in the mock HTML for that platform.
//   Determined by the platform's getUserMessages() selector against the mock page DOM.
//   Update this when you update the corresponding mock-pages/*.html file.

const PLATFORMS = [
    {
        name: 'Claude',
        mockFile: 'claude.html',
        hostname: 'claude.ai',
        pathname: '/chat/test',
        expectedMessages: 3,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
    },
    {
        name: 'Claude Code',
        mockFile: 'claude-code.html',
        hostname: 'claude.ai',
        pathname: '/code/test',
        expectedMessages: 3,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
    },
    {
        // Virtualized Claude — 80 messages / 40 turns exist; only a 6-message
        // window (3 user turns) plus a 1-row pinned tail is ever mounted.
        // The pathname must be a real-shaped conversation uuid so the userscript's
        // ciIsClaudeChat() guard matches and the conversation-index path engages.
        // The harness provides no GM_xmlhttpRequest, so the API fetch fails, the
        // script must degrade to the DOM scan *visibly*, and every jump must take
        // the honest-failure path — which is what tests 21-22 assert.
        name: 'Claude (virtualized)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/11111111-1111-4111-8111-111111111111',
        expectedMessages: 3,      // mounted USER turns, NOT the 40 real ones
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
    },
    {
        // Same virtualizing mock, but WITH a GM_xmlhttpRequest fixture so the
        // conversation index actually builds. This is the entry that proves the
        // primary v12.0 path works: 40 questions listed from a DOM that only ever
        // mounts 3, and a jump loop that pages the virtualizer to an unmounted row.
        // Without it, everything except the degraded fallback is untested.
        name: 'Claude (virtualized + index)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/22222222-2222-4222-8222-222222222222',
        expectedMessages: 40,     // FULL conversation from the index, not the 3 mounted
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        gmFixture: {
            totalMessages: 80,
            conversationUuid: '22222222-2222-4222-8222-222222222222',
        },
    },
    {
        // THIRD Claude entry: the index builds correctly, but the API text is raw
        // MARKDOWN while the DOM holds RENDERED text — so ciDeriveRowOffset() can find
        // no matching row and returns null.
        //
        // This exists because CI was green while the live site failed. The other two
        // virtualized entries use prose that is byte-identical on both sides, so the
        // offset always derives and the failure path is unreachable — the same
        // "structurally cannot fail" shape as the original v12.0 bug.
        //
        // Live symptom being pinned down here: the jump enters the blind-probe branch,
        // scrolls to 1/9, 2/9 ... 8/9 of the document looking for a window it can align,
        // drags the viewport across the whole conversation, and fails after 8 iterations.
        // Reproduced end to end; see TROUBLESHOOTING.
        name: 'Claude (virtualized, markdown API text)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/33333333-3333-4333-8333-333333333333',
        // Was 43 with listedTurnsOverride while the live-merge compared by
        // _normalizeKey only: mounted markdown questions could not match their own
        // index entries and were appended as provisionals (the characterisation test
        // that guarded this predicted its own obsolescence — the fix reverts to 40).
        // Codex round-1 P1 also identified the worse consequence: the mismatch kept
        // _ciNeedsResync() refetching the multi-MB conversation every cooldown.
        expectedMessages: 40,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        offsetUnderivable: true,   // suppresses the jump-resolves assertions; see below
        gmFixture: {
            totalMessages: 80,
            conversationUuid: '33333333-3333-4333-8333-333333333333',
            markdownText: true,
        },
    },
    {
        // LEGACY BOOKMARK MIGRATION — the distribution blocker.
        //
        // Every pre-v12.0 Claude bookmark is a schema-1 content hash with no uuid, and only a
        // uuid can enter the jump bridge. Under virtualization that means they only resolve
        // while their message happens to be mounted — i.e. they are silently dead in a
        // RELEASED version, which is the first bug report after any public push.
        //
        // Seeds two records with the shape real users have (contentHash + 120-char preview,
        // no msgUuid): one whose preview uniquely identifies a message far outside the mount
        // window, and one whose preview matches nothing. The first must be upgraded to
        // schema 2 and become reachable; the second must be marked unresolved so the UI can
        // say "recreate it" instead of "scroll toward it".
        name: 'Claude (legacy schema-1 bookmarks)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/ee000000-0000-4000-8000-00000000eeee',
        expectedMessages: 40,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        offsetUnderivable: true,
        legacyBookmarkProbe: { upgraded: 5, unmatched: 2 },

        mockConfig: { totalMessages: 80, identicalAnswerRows: [51, 55] },
        gmFixture: {
            totalMessages: 80,
            conversationUuid: 'ee000000-0000-4000-8000-00000000eeee',
            identicalAnswerRows: [51, 55],
            // LONGER than the preview's captured copy on purpose — the live shape. The
            // DOM header truncates the summary for display; the preview stores that
            // truncated copy doubled, while the payload carries the full text. Measured
            // 2026-07-29 against the owner's real conversation; whole-prefix matching
            // fails on this shape and only the 40-char probe binds it.
            summaryRows: { 21: 'Architected mock governor mechanisms balancing rate and limits for the run with extended tail detail the header never displayed' },
            seedBookmarks: [
                { id: 'bm_legacy1', schema: 1, entityType: 'user-msg',
                  contentHash: 'deadbeef', msgUuid: null,
                  preview: 'Question number 33: how do I handle case 33 when the input is unusual?',
                  msgIndex: 32, createdAt: 1, platform: 'claude.ai' },
                { id: 'bm_legacy2', schema: 1, entityType: 'user-msg',
                  contentHash: 'feedface', msgUuid: null,
                  preview: 'A question that was edited away and no longer exists anywhere',
                  msgIndex: 5, createdAt: 2, platform: 'claude.ai' },
                // GLYPH CONTAMINATION — the live shape. Pre-v12.0 previews were captured
                // before _cleanText stripped our own U+2691 bookmark icon, so they begin
                // with it and a prefix match fails at character 0. Six of the owner's
                // sixteen unmatched records looked exactly like this.
                { id: 'bm_legacy3', schema: 1, entityType: 'ai-msg',
                  contentHash: 'cafebabe', msgUuid: null,
                  preview: '\u2691Answer number 21: validate the input first, then branch',
                  msgIndex: 20, createdAt: 3, platform: 'claude.ai' },
                // SUMMARY-HEADER CONTAMINATION — also the live shape. Claude renders a
                // collapsed activity summary ABOVE a tool-bearing response, and _cleanText
                // captured that first, so the real message text sits AFTER it in the preview
                // rather than at position 0. Rule B (probe-anywhere) is what recovers these.
                { id: 'bm_legacy4', schema: 1, entityType: 'ai-msg',
                  contentHash: 'deadc0de', msgUuid: null,
                  preview: 'Analyzed the mock scheduling tradeoffsAnswer number 9: validate the input first, then branch on the result.',
                  msgIndex: 8, createdAt: 4, platform: 'claude.ai' },
                // SUMMARY-ONLY preview (rule C) — the live shape of all 9 unrecovered
                // records: the activity summary DOUBLED, zero message text anywhere in
                // the 120 chars. Only the thinking-block summary channel can match it.
                { id: 'bm_legacy5', schema: 1, entityType: 'ai-msg',
                  contentHash: 'beefbeef', msgUuid: null,
                  // display-truncated at 75 chars, then doubled, then preview-capped —
                  // the payload's full summary is NOT a prefix of this, nor vice versa
                  preview: ('Architected mock governor mechanisms balancing rate and limits for the run' +
                            'Architected mock governor mechanisms balancing rate and limits for the run').substring(0, 120),
                  msgIndex: 10, createdAt: 5, platform: 'claude.ai' },
                // SHORT-PREVIEW WRONG-BINDING GUARD. "balancing rate" is 14 chars and
                // appears incidentally inside row 21's activity summary. Rule C's reverse
                // probe used want.substring(0, 40) as the needle — only 40 chars when the
                // preview HAS 40 — so a short preview degraded it to an unbounded substring
                // test, found that one incidental hit, passed the uniqueness gate on it and
                // bound PERMANENTLY to a message it had no evidence of. Three independent
                // review lenses reproduced this against the real build. The record must now
                // stay unmatched: refusing is recoverable, a wrong binding is not.
                // UNIQUENESS-GATE COVERAGE. The gate is the branch's only defence against a
                // permanent silent mis-binding and had ZERO tests. This preview is the exact
                // body text of the DUPLICATED answer seeded at rows 30 and 34, so rules A/B
                // match two candidates and the gate must refuse rather than pick one.
                { id: 'bm_ambig', schema: 1, entityType: 'ai-msg',
                  contentHash: 'bb22cc33', msgUuid: null,
                  preview: 'Identical answer text used twice so a legacy preview is ambiguous.',
                  msgIndex: 15, createdAt: 8, platform: 'claude.ai' },
                { id: 'bm_shortprev', schema: 1, entityType: 'ai-msg',
                  contentHash: 'aa11bb22', msgUuid: null,
                  preview: 'balancing rate',
                  msgIndex: 60, createdAt: 7, platform: 'claude.ai' },
                // HASH-ORACLE target (stage-1 harvest): the preview matches nothing, but
                // the stored contentHash reproduces against a MOUNTED row's rendered text
                // and rendered-era ordinal — equality is proof, harvested from the mount
                // window without any user action.
                { id: 'bm_legacy6', schema: 1, entityType: 'ai-msg',
                  contentHash: legacyContentHash('Answer number 3: validate the input first, then branch on the result.', 2),
                  msgUuid: null,
                  preview: 'this preview matches nothing anywhere at all zz',
                  msgIndex: 2, createdAt: 6, platform: 'claude.ai' },
            ],
        },
    },
    // ── LOAD-PATH REGRESSION GUARDS (Tier 3 review, 2026-07-27) ─────────────
    // Two CRITICALs shipped in v12.0 and survived a 23-round review because the
    // fixture's own defaults made them unreachable. Both are reproductions first:
    // each FAILS on 6bc7ed2 and passes on the fix (DEC-027 discipline).
    {
        // Recursion guard. The only change from a normal indexed entry is that the API
        // answers slowly, like the real one does. On 6bc7ed2 this produces a storm of
        // "RangeError: Maximum call stack size exceeded" from
        // scanConversation -> ciLoadIndex -> done(false) -> scanConversation, caught by
        // the existing "No uncaught page errors" assertion.
        name: 'Claude (slow API — load recursion guard)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/aa000000-0000-4000-8000-00000000aaaa',
        expectedMessages: 40,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        offsetUnderivable: true,
        gmFixture: {
            totalMessages: 80,
            conversationUuid: 'aa000000-0000-4000-8000-00000000aaaa',
            // The repo's own live measurement is ~2.1s; 1200ms reproduces the recursion
            // just as reliably and keeps the suite quick.
            apiLatencyMs: 1200,
        },
    },
    {
        // Refetch-loop guard. One assistant answer is given tool/artifact shape — the
        // client renders more than the API's text blocks carry — which mismatches
        // permanently. On 6bc7ed2 the idle page re-downloads the whole payload every
        // ~15.5s forever; the fix resyncs once per distinct signature.
        name: 'Claude (tool-shaped row — refetch loop guard)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/bb000000-0000-4000-8000-00000000bbbb',
        expectedMessages: 40,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        offsetUnderivable: true,
        refetchProbeMs: 36000,   // spans two full cooldown cycles (~15.5s each)
        gmFixture: {
            totalMessages: 80,
            conversationUuid: 'bb000000-0000-4000-8000-00000000bbbb',
            toolShapedRow: 3,
        },
    },
    {
        // Retention guard. The first load succeeds; every later fetch 500s. A tool-shaped
        // row forces exactly one resync, so the failure lands on a background REFRESH with
        // a complete snapshot already in hand. The index must stay READY and keep listing
        // the whole conversation — collapsing to the mounted window would throw away data
        // it still holds. Twice a fix for this was written and was INERT; this entry is
        // why it is now known to fire.
        name: 'Claude (refresh failure retains snapshot)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/cc000000-0000-4000-8000-00000000cccc',
        expectedMessages: 40,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        offsetUnderivable: true,
        refetchProbeMs: 20000,          // long enough for the resync to fire and fail
        expectRetainedSnapshot: true,
        gmFixture: {
            totalMessages: 80,
            conversationUuid: 'cc000000-0000-4000-8000-00000000cccc',
            toolShapedRow: 3,
            failFetchAfter: 1,
        },
    },
    // ── RESOLVE-ON-ARRIVAL FIXTURE MATRIX (spec §5 — the mock-first gate) ────
    // Proof pair required by the spec: the OLD build (0a30d3b, tonight's traces) must
    // FAIL these; the resolve-on-arrival build must pass them. jumpEveryQuestion runs
    // the acceptance sweep — jump to EVERY question, verify row identity on each.
    {
        // N=10 predicate-visible unrendered entries at arbitrary mid positions,
        // 294 rows (147 questions) — the live conversation's scale.
        name: 'Claude (294 rows, N=10 unrendered)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/44444444-4444-4444-8444-444444444444',
        expectedMessages: 147,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 147, totalMessages: 294, userWindowSize: 3 },
        indexBacked: true,
        jumpEveryQuestion: { step: 1 },
        mockConfig: { totalMessages: 294 },
        gmFixture: {
            totalMessages: 294,
            conversationUuid: '44444444-4444-4444-8444-444444444444',
            insertInterruptedBeforeRow: [30, 55, 80, 105, 130, 155, 180, 205, 230, 255],
        },
    },
    {
        // Q#1 IS A FILE CHIP — the live shape, modelled STRUCTURALLY this time.
        //
        // attachmentRows only changed a row's TEXT while keeping
        // [data-testid="user-message"], so ciMountedRows().isUser stayed true and the
        // difference that actually matters was never modelled. On the live site an
        // attachment-only first message exposes no user-message node at all, so isUser is
        // false for its row — and a guard keyed on isUser silently refused a jump the
        // by-construction head path had previously resolved. Live-reported by the owner
        // 2026-07-28; the suite was green throughout. DEC-028.
        //
        // chipRows makes row 0 carry a chip and NO testid. The sweep jumps to every
        // question, so Q#1 runs against a row the DOM cannot identify as a user row.
        //
        // REPRODUCTION — ancestor-gated against origin/main (the shipped v12.0 build).
        //   origin/main -> FAILS: "Q1: expected row 0, got null busySeen=true idx=null"
        //   this build  -> 40/40 exact
        // That is the owner's live symptom exactly: the jump runs, scrolls, and resolves
        // nothing.
        //
        // It took three attempts, and the first two failed for instructive reasons worth
        // keeping. Attempt 1 (chipRows alone) passed because the mock's normal answer pairs
        // at distance 1 from the chip and 3b's adjacent carve-out resolved Q#1 without the
        // head path. Attempt 2 (+ shortAnswerRows, removing that pair) ALSO passed — and
        // the reason was that chipRows was VACUOUS: it read `i` inside buildRow(index), so
        // isChip was always false and the chip row kept its testid. A fixture that cannot
        // fail looks exactly like a fixture that passes. Only tracing the pre-jump path
        // (the [ACN pre] lines, which the harness had been filtering out) exposed it.
        name: 'Claude (80 rows, Q#1 is a file chip)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/dd000000-0000-4000-8000-00000000dddd',
        expectedMessages: 40,
        contentPatternExempt: 1,      // the chip row has no question text in the DOM
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 40, totalMessages: 80, userWindowSize: 3 },
        indexBacked: true,
        offsetUnderivable: true,
        jumpEveryQuestion: { step: 1 },
        // Row 1's answer is under the 60-char floor, so it cannot become a local pair.
        // Without that, the mock's normal answer pairs cleanly at distance 1 from the
        // chip and 3b's adjacent carve-out resolves Q#1 without ever consulting the
        // by-construction head path — which is exactly why the first version of this
        // fixture passed on a build that fails live.
        mockConfig: { totalMessages: 80, attachmentRows: [0], chipRows: [0],
                      shortAnswerRows: [1] },
        gmFixture: {
            totalMessages: 80,
            conversationUuid: 'dd000000-0000-4000-8000-00000000dddd',
            attachmentRows: [0],
            shortAnswerRows: [1],
        },
    },
    {
        // Hostile: duplicated short questions (co-mountable, rows 30/34), attachment
        // rows whose DOM text cannot match the API (row 0 = the live Q#1 shape, and a
        // mid target), a predicate-BLIND unrendered entry, and a 15,000px giant row.
        name: 'Claude (120 rows, hostile)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/55555555-5555-4555-8555-555555555555',
        // Clean 60: the merge now decides "new turn" by ROW IDENTITY (a new turn's
        // dataIndex lies beyond the indexed range), so the mounted attachment chip —
        // whose text can never match its API entry — no longer becomes a provisional
        // duplicate. This entry listed 61 while the merge compared text
        // (the KNOWN DEFECT its characterisation assertions used to pin).
        expectedMessages: 60,
        contentPatternExempt: 4,   // 2 duplicates + 2 attachment rows
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 60, totalMessages: 120, userWindowSize: 3 },
        indexBacked: true,
        jumpEveryQuestion: { step: 1 },
        mockConfig: { totalMessages: 120, duplicateRows: [30, 34],
                      attachmentRows: [0, 60], giantRowAt: 71 },
        gmFixture: {
            totalMessages: 120,
            conversationUuid: '55555555-5555-4555-8555-555555555555',
            insertInterruptedBeforeRow: [45],
            insertBlindBeforeRow: [90],
            duplicateRows: [30, 34],
            attachmentRows: [0, 60],
        },
    },
    {
        // N=3 at 150 rows, sampled sweep (every 5th question) — a length data point
        // between the 80-row base entries (N=0 beyond the lead) and the 294-row sweep.
        name: 'Claude (150 rows, N=3 unrendered)',
        mockFile: 'claude-virtualized.html',
        hostname: 'claude.ai',
        pathname: '/chat/66666666-6666-4666-8666-666666666666',
        expectedMessages: 75,
        expectedAccent: '#d97706',
        expectedMode: 'orbital',
        virtualized: { totalTurns: 75, totalMessages: 150, userWindowSize: 3 },
        indexBacked: true,
        jumpEveryQuestion: { step: 5 },
        mockConfig: { totalMessages: 150 },
        gmFixture: {
            totalMessages: 150,
            conversationUuid: '66666666-6666-4666-8666-666666666666',
            insertInterruptedBeforeRow: [40, 75, 110],
        },
    },
    {
        name: 'ChatGPT',
        mockFile: 'chatgpt.html',
        hostname: 'chatgpt.com',
        pathname: '/c/test',
        expectedMessages: 4,
        expectedAccent: '#ffffff',
        expectedMode: 'orbital',
    },
    {
        name: 'Codex Web',
        mockFile: 'codex.html',
        hostname: 'chatgpt.com',
        pathname: '/codex/test',
        expectedMessages: 2,
        expectedAccent: '#ffffff',
        expectedMode: 'orbital',
    },
    {
        name: 'Grok',
        mockFile: 'grok.html',
        hostname: 'grok.com',
        pathname: '/chat/test',
        expectedMessages: 3,
        expectedAccent: '#e53e3e',
        expectedMode: 'orbital',
    },
    {
        name: 'Gemini',
        mockFile: 'gemini.html',
        hostname: 'gemini.google.com',
        pathname: '/app/test',
        expectedMessages: 3,
        expectedAccent: '#4285f4',
        expectedMode: 'orbital',
        // The mock's div.query-text contains Gemini's hidden
        // "You said" label (cdk-visually-hidden, measured live 2026-07-30).
        // This assertion is what makes the label-leak reproducible: without
        // the strip, nav-item-text reads "You said How do neural networks
        // learn?" and equality fails. Mutation-verified — see PR.
        expectedFirstQuestion: 'How do neural networks learn?',
    },
    {
        name: 'Bolt.new',
        mockFile: 'bolt.html',
        hostname: 'bolt.new',
        pathname: '/test-project',
        expectedMessages: 3,
        expectedAccent: '#38BDF8',
        expectedMode: 'legacy',
    },
    {
        name: 'Lovable',
        mockFile: 'lovable.html',
        hostname: 'lovable.dev',
        pathname: '/projects/test-project',   // Must include /projects/ for the guard
        expectedMessages: 3,
        expectedAccent: '#9b87f5',
        expectedMode: 'legacy',
    },
    {
        name: 'Replit',
        mockFile: 'replit.html',
        hostname: 'replit.com',
        pathname: '/@user/project',
        expectedMessages: 3,
        expectedAccent: '#F26522',
        expectedMode: 'legacy',
    },
    {
        name: 'V0',
        mockFile: 'v0.html',
        hostname: 'v0.app',
        pathname: '/chat/test-project',
        expectedMessages: 3,
        expectedAccent: '#ffffff',
        expectedMode: 'legacy',
    },
    {
        name: 'Base44',
        mockFile: 'base44.html',
        hostname: 'app.base44.com',
        pathname: '/projects/test',
        expectedMessages: 3,
        expectedAccent: '#6366f1',
        expectedMode: 'legacy',
    },
    {
        name: 'Emergent',
        mockFile: 'emergent.html',
        hostname: 'app.emergent.sh',
        pathname: '/project/test',
        expectedMessages: 3,
        expectedAccent: '#10b981',
        expectedMode: 'legacy',
    },
    {
        name: 'Perplexity',
        mockFile: 'perplexity.html',
        hostname: 'www.perplexity.ai',
        pathname: '/search/test',
        expectedMessages: 3,
        expectedAccent: '#20b2aa',
        expectedMode: 'orbital',
    },
    {
        name: 'Firebase Studio',
        mockFile: 'firebase.html',
        hostname: '6000-firebase-studio-12345.cluster-abc123.cloudworkstations.dev',
        pathname: '/capra/',
        expectedMessages: 3,
        expectedAccent: '#FFA611',   // firebase_studio legacy mode → platform.theme.accent
        expectedMode: 'legacy',
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_DIR = path.join(__dirname, 'mock-pages');
// ACN_SCRIPT overrides the build under test, so an A/B against a previous commit runs
// the SAME fixtures and instrumentation against both. Defaults to the repo file.
const SCRIPT_PATH = process.env.ACN_SCRIPT || path.join(__dirname, '..', 'ai-conversation-navigator.user.js');

// Byte-exact replica of the userscript's contentHash(text, idx). Used to seed legacy
// bookmark fixtures whose stored hash must REPRODUCE against mock rendered text — the
// hash-oracle harvest binds only on equality, so the seed must be computed with the
// identical algorithm, not merely a similar one.
function legacyContentHash(text, idx) {
    const str = String(idx) + '|' + String(text).substring(0, 200);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        h = h >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
}

// Read the userscript, stripping the ==UserScript== header
function getScriptContent() {
    let content = fs.readFileSync(SCRIPT_PATH, 'utf8');
    content = content.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
    return content;
}

// ── GM_xmlhttpRequest fixture shim ────────────────────────────────────────────
//
// WHY THIS EXISTS
// The harness previously provided no GM_* APIs at all, so on Claude the
// conversation index could only ever FAIL and fall back to the DOM scan. That
// left the entire primary v12.0 path — org resolution, ciBuildIndex, active-path
// branch filtering, index-backed Navigate/Search/Export, and the whole Phase 3
// jump loop — unverified by CI. Both independent review rounds flagged it.
//
// This shim serves a synthetic conversation whose messages line up exactly with
// claude-virtualized.html, so the index builds and the settle loop runs for real.
//
// The fixture deliberately carries ONE LEADING assistant message that the mock
// does NOT render. That makes the data-index -> _ciFullPath offset +1 rather
// than 0, matching what was measured live — so an implementation that quietly
// assumes zero alignment fails here instead of in production.
function buildGmFixtureShim(cfg) {
    const TOTAL = cfg.totalMessages;      // rendered rows (mock)
    const ORG   = '99999999-9999-4999-8999-999999999999';

    // Path construction. Rendered rows 0..TOTAL-1 map to renderable path entries in
    // order; UNRENDERED entries are INSERTED between them:
    //   - the LEAD assistant message (no stop_reason -> interrupted -> renders no row;
    //     it is the deliberate head offset the suite has always carried)
    //   - cfg.insertInterruptedBeforeRow: assistant entries with NO stop_reason,
    //     predicate-visible (the live shape: path 199 on conversation b3c603a4)
    //   - cfg.insertBlindBeforeRow: entries with stop_reason 'end_turn' that the mock
    //     STILL never renders — the predicate is WRONG about these by construction,
    //     which is the owner's robustness invariant: N unrendered entries at arbitrary
    //     positions, predicate right or not, must not degrade correctness.
    // cfg.duplicateRows / cfg.attachmentRows mirror the mock's DOM texts (see the mock).
    const insInt   = cfg.insertInterruptedBeforeRow || [];
    const insBlind = cfg.insertBlindBeforeRow || [];
    const dupRows  = cfg.duplicateRows || [];
    const attRows  = cfg.attachmentRows || [];

    const messages = [];
    let seq = 0;
    const uuidFor = (i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const push = (m) => { m.uuid = uuidFor(seq); m.parent_message_uuid = seq === 0
        ? '00000000-0000-4000-8000-000000000000' : uuidFor(seq - 1);
        m.index = seq; m.created_at = '2026-07-01T00:00:00Z';
        m.attachments = m.attachments || []; m.files = [];
        messages.push(m); seq++; };

    // Interrupted lead: no stop_reason, so the renderable predicate correctly
    // excludes it. (It used to carry end_turn, which made the predicate wrong at the
    // head of every fixture — caught when the predicate landed.)
    push({ sender: 'assistant', text: '',
           content: [{ type: 'text', text: 'Conversation started.' }] });

    for (let row = 0; row < TOTAL; row++) {
        for (const r of insInt)   if (r === row) push({ sender: 'assistant', text: '',
            content: [{ type: 'text', text: 'Interrupted generation before row ' + row +
                        ' — the client renders no row for this entry.' }] });
        for (const r of insBlind) if (r === row) push({ sender: 'assistant', text: '',
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'Ghost entry before row ' + row +
                        ' — completed per stop_reason, yet never rendered. The predicate is wrong here on purpose.' }] });

        const turn = Math.floor(row / 2) + 1;
        const isUser = row % 2 === 0;
        if (!isUser) {
            // toolShapedRow models an artifact / tool_use / code-execution answer: the
            // client RENDERS more than the API's text blocks carry, because tool output
            // is deliberately not merged into entry text. That mismatch is permanent, so
            // it is the shape that drove the endless success-refetch loop. Without this
            // the fixture's API text always equals the DOM and the loop is unreachable.
            // shortAnswerRows mirrors the mock DOM: a genuinely SHORT answer, matching on
            // both sides. Not a mismatch — it is simply below the 60-char floor
            // ciMatchRowToPath requires, so the row cannot become a local pair.
            const shortAns = (cfg.shortAnswerRows || []).indexOf(row) !== -1;
            const identAns = (cfg.identicalAnswerRows || []).indexOf(row) !== -1;
            const apiText = (cfg.toolShapedRow === row)
                ? `Answer number ${turn}:`
                : shortAns
                    ? 'Yes.'
                    : identAns
                        ? 'Identical answer text used twice so a legacy preview is ambiguous.'
                        : `Answer number ${turn}: validate the input first, then branch on the result.`;
            // summaryRows[row] attaches a thinking block carrying the model-generated
            // ACTIVITY SUMMARY — the collapsed-header text claude.ai renders above a
            // thinking/tool answer, and the text pre-v12.0 bookmark previews captured on
            // exactly those answers. Shape mirrors the hypothesized live payload
            // (summaries: [{summary}]); the userscript's diagnostic verifies it live.
            const sumText = (cfg.summaryRows || {})[row];
            const blocks = [];
            if (sumText) blocks.push({ type: 'thinking',
                                       thinking: 'mock thinking for row ' + row,
                                       summaries: [{ summary: sumText }] });
            blocks.push({ type: 'text', text: apiText });
            push({ sender: 'assistant', text: '', stop_reason: 'end_turn', content: blocks });
            continue;
        }
        if (attRows.indexOf(row) !== -1) {
            // Large paste: NO text block; body in attachments[].extracted_content. The
            // mock renders a file chip, so DOM text can never match — forces path 3b.
            push({ sender: 'human', text: '', content: [{ type: 'text', text: '' }],
                   attachments: [{ file_name: '', extracted_content:
                       `PASTED-CONTENT for question ${turn}: this text exists only in the API payload and never in the DOM.` }] });
            continue;
        }
        const qt = dupRows.indexOf(row) !== -1
            ? 'here is the full report.'
            : (cfg.markdownText
                ? `**Question number ${turn}**: how do I handle \`case ${turn}\` when the input is unusual?`
                : `Question number ${turn}: how do I handle case ${turn} when the input is unusual?`);
        push({ sender: 'human', text: '',
               content: [{ type: 'text', text: qt + ' VISIBLE-NOT-SR-ONLY' }] });
    }

    // ABANDONED BRANCH — not on the active path.
    // Without this the fixture is a single linear chain, so ciResolveActivePath's whole
    // reason for existing is unexercised: a reviewer replaced the entire tree walk with
    // `path = msgs.slice()` and the suite still passed 25/25. These two messages hang
    // off a mid-conversation parent and must NEVER appear in the panel.
    const ABANDONED_TEXT = 'ABANDONED BRANCH question that must never be listed';
    messages.push({
        uuid: 'bbbbbbbb-0000-4000-8000-000000000001',
        parent_message_uuid: uuidFor(21),      // branches off mid-conversation
        sender: 'human',
        index: 999,
        created_at: '2026-07-01T00:00:00Z',
        text: '',
        content: [{ type: 'text', text: ABANDONED_TEXT }],
        attachments: [], files: [],
    });
    messages.push({
        uuid: 'bbbbbbbb-0000-4000-8000-000000000002',
        parent_message_uuid: 'bbbbbbbb-0000-4000-8000-000000000001',
        sender: 'assistant',
        index: 1000,
        created_at: '2026-07-01T00:00:00Z',
        text: '',
        content: [{ type: 'text', text: 'Answer on the abandoned branch.' }],
        attachments: [], files: [],
    });

    const payload = {
        uuid: cfg.conversationUuid,
        name: 'Fixture conversation',
        current_leaf_message_uuid: uuidFor(seq - 1),   // last main-chain message (seq counts inserted unrendered entries too)
        chat_messages: messages,
    };

    return `
<script>
(function () {
    var ORG = ${JSON.stringify(ORG)};
    var PAYLOAD = ${JSON.stringify(payload)};
    // Minimal GM_* surface. Only what the userscript actually calls.
    // Fixture latency. The default 5ms is NOT representative — the real payload is
    // ~2.1s — and that gap hid an unbounded scanConversation/ciLoadIndex recursion for
    // an entire release: the bug needs a second scan to land inside the fetch window,
    // and at 5ms one never does. Any platform entry may raise it via apiLatencyMs.
    var API_LATENCY_MS = ${JSON.stringify(cfg.apiLatencyMs || 5)};
    var FAIL_FETCH_AFTER = ${JSON.stringify(cfg.failFetchAfter || 0)};
    window.GM_xmlhttpRequest = function (opts) {
        var url = opts.url || '';
        function respond(status, body) {
            setTimeout(function () {
                if (status === 200 && opts.onload) opts.onload({ status: 200, responseText: body });
                else if (opts.onerror) opts.onerror({ status: status });
            }, API_LATENCY_MS);
        }
        if (/\\/api\\/organizations$/.test(url)) {
            respond(200, JSON.stringify([{ uuid: ORG, name: 'Fixture Org', capabilities: ['chat'] }]));
            return;
        }
        if (url.indexOf('/chat_conversations/') !== -1) {
            if (url.indexOf(ORG) === -1) { respond(404, ''); return; }
            // Counted so a test can assert the payload is not re-downloaded on a loop.
            window.__convFetches = (window.__convFetches || 0) + 1;
            window.__convFetchAt = (window.__convFetchAt || []);
            window.__convFetchAt.push(Math.round(performance.now()));
            // failFetchAfter models a background REFRESH failing after the first load
            // succeeded — the case where a usable full-history snapshot already exists.
            if (FAIL_FETCH_AFTER > 0 && window.__convFetches > FAIL_FETCH_AFTER) {
                respond(500, '');
                return;
            }
            // Counted separately: a FAILED fetch retrying is correct behaviour, so the
            // runaway-loop assertion must measure SUCCESSFUL refetches — those are the
            // ones that can re-trigger themselves forever.
            window.__convFetchOk = (window.__convFetchOk || 0) + 1;
            respond(200, JSON.stringify(PAYLOAD));
            return;
        }
        respond(404, '');
    };
    // SEED_BOOKMARKS plants pre-v12.0 schema-1 records (content hash + 120-char preview,
    // no uuid) so the legacy migration can be tested against the shape real users have.
    var _store = {};
    var SEED_BM = ${JSON.stringify(cfg.seedBookmarks || null)};
    if (SEED_BM) {
        var _seedUrl = window.location.origin + window.location.pathname;
        var _seeded = {}; _seeded[_seedUrl] = { bookmarks: SEED_BM };
        _store['acn-bookmarks-v1'] = JSON.stringify(_seeded);
    }
    window.GM_getValue = function (k, d) { return _store.hasOwnProperty(k) ? _store[k] : d; };
    window.GM_setValue = function (k, v) { _store[k] = v; };
    // The org resolver reads this before falling back to /api/organizations.
    try { document.cookie = 'lastActiveOrg=' + ORG + '; path=/'; } catch (e) {}
}());
</script>`;
}

// Build a test page with mock DOM + userscript embedded
function buildTestPage(platform, scriptContent) {
    const mockHTML = fs.readFileSync(path.join(MOCK_DIR, platform.mockFile), 'utf8');

    // Extract just the <body> content from the mock HTML
    const bodyMatch = mockHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : mockHTML;

    const gmShim = platform.gmFixture ? buildGmFixtureShim(platform.gmFixture) : '';

    const mockCfg = platform.mockConfig
        ? `<script>window.__MOCK_CONFIG = ${JSON.stringify(platform.mockConfig)};</script>\n`
        : '';
    return `<!DOCTYPE html>
<html>
<head><title>${platform.name} Test</title></head>
<body>
${mockCfg}${bodyContent}
<script>
// Clear duplicate guard from previous test run (fresh navigation means clean window,
// but belt-and-suspenders for any edge cases)
delete window._aiNavAlreadyLoaded;
${process.env.ACN_JUMP_TRACE ? `
// ACN_JUMP_TRACE=1 — turn on the userscript's per-iteration jump logging so a CI run
// can be compared line-for-line against a live claude.ai log. Must be set BEFORE the
// userscript runs, which is why it lives here rather than in a page.evaluate.
try { localStorage.setItem('acnJumpDebug', '1'); } catch (e) {}
` : ''}</script>
${gmShim}
<script>
${scriptContent}
</script>
</body>
</html>`;
}

// Set up route interception for a platform — serves mock HTML at the real hostname URL
async function setupRouteForPlatform(page, platform, scriptContent) {
    const html = buildTestPage(platform, scriptContent);
    const targetURL = `https://${platform.hostname}${platform.pathname}`;

    // Intercept ALL requests for this page navigation and sub-resources
    await page.route('**/*', (route) => {
        const url = route.request().url();
        // Serve our mock HTML for the main navigation request
        if (url === targetURL || url === targetURL + '/') {
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: html,
            });
        } else {
            // Abort all other requests (CSS, JS, images, etc.) — we don't need them
            route.abort();
        }
    });

    return targetURL;
}

// ── Test runner ───────────────────────────────────────────────────────────────
//
// ALL assertions use data-acn-role / data-acn-* selectors from the contract
// defined in the file header.  No internal IDs, CSS class names, or version-
// specific assumptions appear below this line.

async function testPlatform(page, platform, scriptContent, screenshotOpts) {
    const results = { name: platform.name, tests: [], passed: true, screenshots: [] };

    function assert(testName, condition, detail) {
        const status = condition ? 'PASS' : 'FAIL';
        results.tests.push({ testName, status, detail });
        if (!condition) results.passed = false;
    }

    // Uncaught exceptions thrown by the userscript during this platform's run.
    // Collected rather than asserted immediately so a throw inside an async
    // callback (e.g. the jump settle loop) is still attributed to this platform.
    // Attached AFTER page.goto below — not here. The page object is REUSED across all
    // 16 entries, and during unrouteAll()/goto() the PREVIOUS platform's page is still
    // live with its ~500ms scan interval running. Attaching before navigation let a
    // throw from entry N land in entry N+1's collector (proven by gating a throw to
    // entry 1 and watching entry 2 fail).
    const pageErrors = [];
    const onPageError = (err) => pageErrors.push(String(err && err.message || err));
    let onConsole = null;

    try {
        // Clear any previous routes
        await page.unrouteAll();

        // Set up route interception — serves our mock HTML at the real hostname
        const targetURL = await setupRouteForPlatform(page, platform, scriptContent);

        // Navigate to the real URL (intercepted by route handler).
        //
        // `domcontentloaded` waits for the inlined userscript to parse AND execute —
        // inline scripts block DOMContentLoaded — and that script is ~420 KB. The FIRST
        // platform of a run therefore pays cold-start JIT on a browser that launched
        // moments ago, which on the Windows runners has exceeded 20 s outright (observed:
        // Firefox/Windows, entry 1 of 16, while entries 2-16 were unremarkable).
        //
        // Retried rather than simply given a bigger budget, because the failure mode is a
        // one-off cold start, not a uniformly slow navigation: raising the ceiling for all
        // 16 entries would slow every genuine hang by the same amount. The retry is
        // announced on stderr — a silently-absorbed retry would turn a real regression
        // (a mock that stopped loading) into an invisible slowdown.
        try {
            await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 20000 });
        } catch (navErr) {
            if (!/Timeout .* exceeded/.test(String(navErr && navErr.message))) throw navErr;
            process.stderr.write(
                `\n  [retry] ${platform.name}: first navigation exceeded 20s, retrying at 60s\n`);
            await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }

        // Now that navigation is complete, start collecting errors for THIS platform.
        pageErrors.length = 0;
        page.on('pageerror', onPageError);

        // ACN_JUMP_TRACE=1 forwards the userscript's per-iteration jump log to stdout,
        // so a CI trace can be diffed line-for-line against one captured on live
        // claude.ai. Attached per platform and removed in the finally block below,
        // or entry N's listener would keep firing for entries N+1..16.
        if (process.env.ACN_JUMP_TRACE) {
            onConsole = (msg) => {
                const t = msg.text();
                // [ACN pre] covers the exits BEFORE the settle loop — the fast path and the
                // range/provisional refusal. Filtering to [ACN jump] alone hid the whole
                // pre-jump path, which is where three failed reproductions were spent.
                if (t.indexOf('[ACN jump]') === 0 || t.indexOf('[ACN pre]') === 0) console.log(`      ${t}`);
            };
            page.on('console', onConsole);
        }

        // Wait for initialization.  The main container is injected synchronously on
        // script load; question detection runs on a 2 s setTimeout.  3.5 s covers both.
        await page.waitForTimeout(3500);

        // ── TEST 1: Main container injected ───────────────────────────────
        const zoneExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="zone"]');
        });
        assert('Main container injected', zoneExists,
            zoneExists ? 'Found [data-acn-role="zone"]' : 'Missing [data-acn-role="zone"]');

        // ── TEST 2: Styles injected ────────────────────────────────────────
        const cssExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="styles"]');
        });
        assert('Styles injected', cssExists,
            cssExists ? 'Found [data-acn-role="styles"]' : 'Missing [data-acn-role="styles"]');

        // ── TEST 3: Navigation trigger exists ─────────────────────────────
        const triggerExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="nav-trigger"]');
        });
        assert('Navigation trigger exists', triggerExists,
            triggerExists ? 'Found [data-acn-role="nav-trigger"]' : 'Missing [data-acn-role="nav-trigger"]');

        // ── TEST 4: Navigation panel exists ───────────────────────────────
        const panelExists = await page.evaluate(() => {
            return !!document.querySelector('[data-acn-role="nav-panel"]');
        });
        assert('Navigation panel exists', panelExists,
            panelExists ? 'Found [data-acn-role="nav-panel"]' : 'Missing [data-acn-role="nav-panel"]');

        if (!zoneExists || !triggerExists || !panelExists) {
            // Can't run remaining tests without the core elements
            return results;
        }

        // ── TEST 5: Platform accent colour ─────────────────────────────────
        // The zone publishes its accent colour as data-acn-accent="#hexvalue".
        // Tests compare against the expected per-platform colour from PLATFORMS.
        const actualAccent = await page.evaluate(() => {
            return (document.querySelector('[data-acn-role="zone"]')
                .getAttribute('data-acn-accent') || '').trim();
        });
        assert('Platform accent colour', actualAccent === platform.expectedAccent,
            `Expected "${platform.expectedAccent}", got "${actualAccent}"`);

        // ── TEST 6: No duplicate container ────────────────────────────────
        const zoneCount = await page.evaluate(() => {
            return document.querySelectorAll('[data-acn-role="zone"]').length;
        });
        assert('No duplicate container', zoneCount === 1,
            `Expected 1 zone, found ${zoneCount}`);

        // ── SCREENSHOT: Container visible ─────────────────────────────────
        if (screenshotOpts) {
            const slug = slugify(platform.name);
            const filePath = path.join(screenshotOpts.dir, `${slug}-zone.png`);
            await page.screenshot({ path: filePath, fullPage: true });
            results.screenshots.push({ label: 'Zone injected', path: filePath });
        }

        // ── TEST 7: Clicking trigger opens navigation panel ────────────────
        // JS .click() bypasses CSS pointer-events so this works even when the
        // container is visibility:hidden (e.g. left-chat boundary not yet detected).
        await page.evaluate(() => {
            document.querySelector('[data-acn-role="nav-trigger"]').click();
        });
        await page.waitForTimeout(500);  // Allow panel open transition to settle

        const panelOpen = await page.evaluate(() => {
            return document.querySelector('[data-acn-role="nav-panel"]')
                .getAttribute('data-acn-open') === 'true';
        });
        assert('Trigger opens navigation panel', panelOpen,
            panelOpen ? 'data-acn-open="true"' : 'Panel not open after clicking trigger');

        await page.waitForTimeout(300);

        // ── TEST 8: Correct number of questions detected ───────────────────
        // data-acn-count on the nav-stat element carries the numeric count, so
        // tests are independent of the wording used in the displayed text.
        const detectedCount = await page.evaluate(() => {
            const stat = document.querySelector('[data-acn-role="nav-stat"]');
            return stat ? parseInt(stat.getAttribute('data-acn-count') || '-1', 10) : -1;
        });
        assert('Questions detected', detectedCount === platform.expectedMessages,
            `Expected ${platform.expectedMessages}, got ${detectedCount}`);

        // ── TEST 9: Correct number of question items rendered ─────────────
        const itemCount = await page.evaluate(() => {
            return document.querySelectorAll('[data-acn-role="nav-item"]').length;
        });
        assert('Question items rendered', itemCount === platform.expectedMessages,
            `Expected ${platform.expectedMessages} items, got ${itemCount}`);

        // ── TEST 10: Every question item has non-empty display text ────────
        const allHaveText = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-acn-role="nav-item"]');
            return Array.from(items).every(item => {
                const textEl = item.querySelector('[data-acn-role="nav-item-text"]');
                return textEl && textEl.textContent.trim().length > 0;
            });
        });
        assert('All items have display text', allHaveText,
            allHaveText ? 'All nav-item-text non-empty' : 'Some item texts are empty');

        // ── TEST 10b: First question text is EXACTLY the message (opt-in) ──
        // "Non-empty" cannot catch text contamination: a platform's hidden
        // screen-reader label ("You said" on Gemini, cdk-visually-hidden)
        // leaking into the read still yields non-empty text. Platforms whose
        // mock reproduces such a label opt in via expectedFirstQuestion, and
        // the displayed text must equal the question with nothing prepended
        // or appended. Whitespace-normalized: mock indentation produces
        // whitespace text nodes that real framework-rendered DOM does not.
        //
        // MUTATION COVERAGE (verified 2026-07-30): breaking _CDK_HIDDEN_RE
        // (the slow-path excluder) flips this red. Breaking _cleanText's
        // FAST-path selector does NOT — by panel-read time the injected
        // bookmark icon already routes every read down the slow path. The
        // fast-path half is therefore NOT independently fixtured: it is
        // required by the two-paths-must-agree invariant documented at the
        // selector (a pre-injection read would otherwise leak), and a fixture
        // for it would have to race icon injection — the machine-speed-
        // dependent assertion shape DEC-025 bans. Recorded as test debt, not
        // coverage.
        if (platform.expectedFirstQuestion) {
            const firstText = await page.evaluate(() => {
                const el = document.querySelector('[data-acn-role="nav-item-text"]');
                return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
            });
            assert('First question text is clean',
                firstText === platform.expectedFirstQuestion,
                firstText === platform.expectedFirstQuestion
                    ? `"${firstText}"`
                    : `Expected "${platform.expectedFirstQuestion}", got "${firstText}"`);
        }

        // ── SCREENSHOT: Panel open with question list ──────────────────────
        if (screenshotOpts) {
            const slug = slugify(platform.name);
            const filePath = path.join(screenshotOpts.dir, `${slug}-panel-open.png`);
            await page.screenshot({ path: filePath, fullPage: true });
            results.screenshots.push({ label: 'Panel open', path: filePath });
        }

        // ── TEST 11: Question items are clickable ──────────────────────────
        let clickable = true;
        try {
            if (itemCount > 0) {
                await page.evaluate(() => {
                    document.querySelector('[data-acn-role="nav-item"]').click();
                });
                await page.waitForTimeout(500);
            }
        } catch (e) {
            clickable = false;
        }
        assert('Question items clickable', clickable,
            clickable ? 'Click succeeded' : 'Click threw error');

        // ── TEST 12: Close button dismisses panel ──────────────────────────
        // On left-chat platforms the panel may auto-close on item click to reveal
        // the message; re-open so we can test the close button.
        const panelStillOpen = await page.evaluate(() => {
            return document.querySelector('[data-acn-role="nav-panel"]')
                .getAttribute('data-acn-open') === 'true';
        });
        if (!panelStillOpen) {
            await page.evaluate(() => {
                document.querySelector('[data-acn-role="nav-trigger"]').click();
            });
            await page.waitForTimeout(400);
        }
        await page.evaluate(() => {
            const closeBtn = document.querySelector(
                '[data-acn-role="nav-panel"] [data-acn-role="panel-close"]');
            if (closeBtn) closeBtn.click();
        });
        await page.waitForTimeout(400);
        const panelClosed = await page.evaluate(() => {
            return document.querySelector('[data-acn-role="nav-panel"]')
                .getAttribute('data-acn-open') !== 'true';
        });
        assert('Close button dismisses panel', panelClosed,
            panelClosed ? 'Panel closed' : 'Panel still open after clicking close');

        // ── TEST 13: Correct injection mode (orbital vs legacy) ────────────
        // data-acn-ui on the zone confirms whether the platform got the orbital
        // cluster or the legacy ghost-notch button.
        // (Note: data-acn-mode is reserved for the display mode: arc/wheel/show-all)
        const actualMode = await page.evaluate(() => {
            const zone = document.querySelector('[data-acn-role="zone"]');
            return zone ? zone.getAttribute('data-acn-ui') : null;
        });
        assert('Correct injection mode', actualMode === platform.expectedMode,
            `Expected mode "${platform.expectedMode}", got "${actualMode}"`);

        // ── TEST 14: All orbital dots present (orbital platforms only) ─────
        // Skipped for legacy platforms — they only have one nav-trigger button.
        if (platform.expectedMode === 'orbital') {
            const orbitalDots = ['nav', 'search', 'bookmarks', 'summary', 'tools', 'settings'];
            const missingDots = await page.evaluate((dots) => {
                return dots.filter(id => !document.querySelector('[data-acn-dot="' + id + '"]'));
            }, orbitalDots);
            assert('All orbital dots present', missingDots.length === 0,
                missingDots.length === 0
                    ? 'All 6 dots found (nav, search, bookmarks, summary, tools, settings)'
                    : 'Missing dots: ' + missingDots.join(', '));
        }

        // ── TESTS 15-25: virtualization and jump ──────────────────────────
        //
        // EVERY assertion here was rewritten after a review lens MUTATION-TESTED the
        // originals and proved they pass against a broken implementation:
        //   - jump body replaced with `done(false,null)`      -> 25/25 PASS
        //   - ciDeriveRowOffset hardcoded to 0                -> passed, landed at top
        //   - all sr-only/bookmark stripping disabled         -> test 20 PASS
        //   - entire tree walk replaced with msgs.slice()     -> 25/25 PASS
        //   - orbSetJumpBusy made a no-op                     -> 47/47 PASS
        //   - uncaught throw during a jump                    -> 25/25 PASS
        // Each mutation must now fail. Where an assertion checks a property of the
        // MOCK rather than the product, it says so.
        if (platform.virtualized) {
            // TEST 15: the mock genuinely recycles. Guards tests 16-25.
            const recycling = await page.evaluate(async () => {
                const v = window.__mockVirtualization;
                if (!v) return { ok: false, reason: 'mock hooks missing' };
                v.scrollToFraction(0);
                await new Promise(r => setTimeout(r, 150));
                const firstNode = document.querySelector('[data-testid="user-message"]');
                const seen = new Set();
                const counts = [];
                for (const f of [0, 0.35, 0.7, 1]) {
                    v.scrollToFraction(f);
                    await new Promise(r => setTimeout(r, 150));
                    // Identity by data-index, not by a text slice. The mock now injects
                    // contamination fixtures at the START of the message node, so a raw
                    // textContent prefix is identical across messages and would report
                    // 1 unique for the whole conversation.
                    const userRows = v.mountedIndexes().filter(n => n % 2 === 0);
                    userRows.forEach(n => seen.add(n));
                    counts.push(document.querySelectorAll('[data-testid="user-message"]').length);
                }
                const detachedProven = !!firstNode && !firstNode.isConnected;
                v.scrollToFraction(0);
                return { ok: true, counts, cumulativeUnique: seen.size,
                         totalTurns: v.totalTurns, userWindowSize: v.userWindowSize,
                         detachedProven };
            });
            // A chip row is not a [data-testid="user-message"] node, so while it is inside
            // the window the visible user-turn count is one lower. That is the fixture
            // working as intended, not a mount failure — the row IS mounted, it simply is
            // not a user-message node, which is the whole point of chipRows.
            const chipSlack = ((platform.mockConfig || {}).chipRows || []).length;
            // DEC-032 applied to this fixture's own knob. The bounds below tolerate a
            // range, so if chipRows ever stopped suppressing the testid they would still
            // pass — and the Q#1 jump would pass too, because the head-row path works when
            // isUser stays true. The fixture would then be green while no longer modelling
            // the structural condition it exists for. Assert the PROPERTY directly (Codex).
            if (chipSlack) {
                const chipProof = await page.evaluate(async (rows) => {
                    // The row must be MOUNTED to be inspected — the acceptance sweep leaves
                    // the viewport wherever its last jump landed, and an unmounted row reads
                    // as "no testid" for the wrong reason, which would make this assertion
                    // pass vacuously in exactly the way it exists to prevent.
                    window.__mockVirtualization.scrollToFraction(0);
                    await new Promise(function (r) { setTimeout(r, 400); });
                    return rows.map(function (r) {
                        const row = document.querySelector('[data-index="' + r + '"]');
                        return { row: r, present: !!row,
                                 hasTestid: !!(row && row.querySelector('[data-testid="user-message"]')) };
                    });
                }, (platform.mockConfig || {}).chipRows || []);
                assert('chipRows genuinely suppresses [data-testid="user-message"]',
                    chipProof.every(c => c.present && !c.hasTestid),
                    JSON.stringify(chipProof));
            }
            assert('Mock recycles turns (set changes, node detaches)',
                recycling.ok &&
                // BOUNDED ON BOTH SIDES. `chipSlack` exists because a chip row has no
                // user-message testid and so counts one short — it is a floor allowance,
                // not permission to exceed the window. Written as a bare `>=` this
                // accepted ANY larger count, so a mock that stopped unmounting would have
                // sailed through the recycling check that exists to catch exactly that
                // (Codex #59 R6). The DOM-coverage assertion below already bounds both ends.
                recycling.counts.every(c => c >= recycling.userWindowSize - chipSlack &&
                                            c <= recycling.userWindowSize) &&
                recycling.cumulativeUnique > recycling.userWindowSize &&
                recycling.cumulativeUnique < recycling.totalTurns &&
                recycling.detachedProven,
                recycling.ok
                    ? `mounted [${recycling.counts}], unique ${recycling.cumulativeUnique}/` +
                      `${recycling.totalTurns}, earlier node detached: ${recycling.detachedProven}`
                    : recycling.reason);

            // TEST 16: DOM cannot see the whole conversation (the bug, asserted).
            const domCoverage = await page.evaluate(() => ({
                mounted: window.__mockVirtualization.mountedCount(),
                total: window.__mockVirtualization.totalTurns,
            }));
            assert('DOM exposes only the mounted window',
                domCoverage.mounted >= platform.virtualized.userWindowSize - chipSlack &&
                domCoverage.mounted <= platform.virtualized.userWindowSize &&
                domCoverage.total === platform.virtualized.totalTurns,
                `${domCoverage.mounted} of ${domCoverage.total} turns in DOM`);

            // TEST 17: degraded banner — required without the fixture, forbidden with it.
            await page.click('[data-acn-role="nav-trigger"]');
            await page.waitForTimeout(600);
            const degraded = await page.evaluate(() => {
                const b = document.querySelector('[data-acn-index-status]');
                return b ? { status: b.getAttribute('data-acn-index-status'),
                             text: b.textContent.trim() } : null;
            });
            if (!platform.indexBacked) {
                assert('Degraded mode is visible in the panel',
                    !!degraded && degraded.status === 'degraded',
                    degraded ? `banner: "${degraded.text}"` : 'No banner rendered');
            } else {
                assert('Index-backed run does NOT show degraded banner',
                    !degraded || degraded.status !== 'degraded',
                    degraded ? `unexpected: "${degraded.text}"` : 'no degraded banner');
            }

            // TEST 18: virtualizer metadata. NOTE: a property of the MOCK — it can only
            // fail if the mock file is edited. Kept as a guard on the fixture contract.
            const meta = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('[data-index]'))
                    .map(e => +e.getAttribute('data-index')).sort((a, b) => a - b);
                const art = document.querySelector('[aria-setsize]');
                const runs = rows.reduce((acc, n, i) => (i && n === rows[i - 1] + 1) ? acc : acc + 1, 0);
                const senders = {
                    user: rows.filter(n => !!document.querySelector(`[data-index="${n}"] [data-testid="user-message"]`)).length,
                    ai:   rows.filter(n => !!document.querySelector(`[data-index="${n}"] .font-claude-response`)).length,
                };
                return { rows, setsize: art ? +art.getAttribute('aria-setsize') : null,
                         hasFeed: !!document.querySelector('[role="feed"]'),
                         hasContainer: !!document.querySelector('[data-autoscroll-container="true"]'),
                         runs, senders };
            });
            assert('Virtualizer metadata present and covers both senders',
                meta.rows.length >= 2 && meta.setsize > 0 && meta.hasFeed &&
                meta.hasContainer && meta.senders.user > 0 && meta.senders.ai > 0,
                `rows=[${meta.rows}] setsize=${meta.setsize} user=${meta.senders.user} ai=${meta.senders.ai}`);

            // TEST 19: mounted set is non-contiguous AT EVERY scroll position.
            // The earlier version sampled one position and passed only because a prior
            // test happened to leave the scroll at the top; at the bottom the window
            // and the tail were adjacent (one run).
            const nonContig = await page.evaluate(async () => {
                const v = window.__mockVirtualization;
                const out = [];
                for (const f of [0, 0.5, 1]) {
                    v.scrollToFraction(f);
                    await new Promise(r => setTimeout(r, 150));
                    const rows = v.mountedIndexes();
                    const runs = rows.reduce((a, n, i) => (i && n === rows[i - 1] + 1) ? a : a + 1, 0);
                    out.push({ f, rows, runs });
                }
                v.scrollToFraction(0);
                return out;
            });
            assert('Mounted set is non-contiguous at every scroll position',
                // f=1 is legitimately contiguous: at the exact bottom the window
                // reaches the pinned tail (live: mounted [291,292,293], one run).
                // Requiring 2 runs there was overfit to a mock artifact — the old
                // "-3" window clamp that also made the last rows unmountable.
                nonContig.every(x => x.f === 1 ? x.runs >= 1 : x.runs >= 2),
                nonContig.map(x => `f=${x.f}:${x.runs}run [${x.rows}]`).join('  '));

            // TEST 20: contamination stripped. The mock now puts an HTML COMMENT and an
            // .sr-only span INSIDE [data-testid="user-message"], so disabling the
            // stripping makes this fail — previously it could not.
            const contamination = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item-text"]'))
                    .map(i => i.textContent.trim());
                return {
                    total: items.length,
                    bad: items.filter(t =>
                        /MOCK-COMMENT-SHOULD-NOT-APPEAR|SR-ONLY-SHOULD-NOT-APPEAR|you said|claude responded|load earlier/i.test(t)),
                    sample: items[0] || '',
                };
            });
            assert('Injected comment and sr-only stripped from question text',
                contamination.total > 0 && contamination.bad.length === 0,
                contamination.bad.length
                    ? `leaked in ${contamination.bad.length}: ${JSON.stringify(contamination.bad[0].slice(0, 70))}`
                    : `${contamination.total} items clean, e.g. ${JSON.stringify(contamination.sample.slice(0, 50))}`);

            // TEST 21: jump terminates AND the busy flag is genuinely used.
            // Asserting only "not busy at the end" was satisfied by never setting it.
            const jump = await page.evaluate(async () => {
                const v = window.__mockVirtualization;
                v.scrollToFraction(1);
                await new Promise(r => setTimeout(r, 250));
                const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                if (!items.length) return { ok: false, reason: 'no nav items' };
                let busySeen = false;
                const t0 = Date.now();
                items[0].click();
                // 10s budget > the implementation's own 8 x (800+250) = 8400ms bound.
                for (let i = 0; i < 100; i++) {
                    if (document.querySelector('[data-acn-jumping="true"]')) busySeen = true;
                    await new Promise(r => setTimeout(r, 100));
                    if (!document.querySelector('[data-acn-jumping="true"]') && busySeen) break;
                    if (Date.now() - t0 > 10000) break;
                }
                return { ok: true, elapsedMs: Date.now() - t0, busySeen,
                         stillBusy: !!document.querySelector('[data-acn-jumping="true"]'),
                         indexBacked: !!window.__ACN_INDEX_BACKED };
            });
            // Busy is only expected on the index-backed entry: without an index the
            // click short-circuits to the toast and never enters the loop.
            assert('Jump terminates without hanging',
                jump.ok && !jump.stillBusy && (!platform.indexBacked || jump.busySeen),
                jump.ok ? `~${jump.elapsedMs}ms, busy observed=${jump.busySeen}, stuck=${jump.stillBusy}`
                        : jump.reason);

            // ── Idle refetch probe: the payload must not be re-downloaded on a loop ──
            // Sits here so the page is genuinely idle — no clicks, no scrolling. Two
            // fetches are expected and correct: the initial load, plus at most one
            // resync attempt on the mismatch. A THIRD means the resync fired, succeeded,
            // saw the same evidence and fired again, which repeats forever.
            if (platform.refetchProbeMs) {
                await page.waitForTimeout(platform.refetchProbeMs);
                const probe = await page.evaluate(() => ({
                    n: window.__convFetches || 0,
                    ok: window.__convFetchOk || 0,
                    at: window.__convFetchAt || [],
                }));
                const secs = Math.round(platform.refetchProbeMs / 1000);
                // SUCCESSFUL fetches: the initial load plus at most one resync attempt.
                // A third means a successful refetch observed the same evidence and fired
                // again, which then repeats forever. Failed fetches are excluded on
                // purpose — retrying a transient failure is required behaviour.
                assert('Idle page does not refetch the payload in a loop', probe.ok <= 2,
                    `${probe.ok} successful of ${probe.n} conversation fetch(es) in ${secs}s idle` +
                    (probe.at.length ? ` at ms ${probe.at.join(', ')}` : ''));

                // A background refresh that FAILED must leave the existing snapshot in
                // place: still ready, still listing the whole conversation, reporting the
                // failure as a note rather than collapsing to the mounted window.
                if (platform.expectRetainedSnapshot) {
                    const kept = await page.evaluate(() => {
                        const stat = document.querySelector('[data-acn-role="nav-stat"]');
                        const banner = document.querySelector('[data-acn-index-status]');
                        return {
                            listed: stat ? +stat.getAttribute('data-acn-count') : -1,
                            status: banner ? banner.getAttribute('data-acn-index-status') : 'none',
                            mounted: window.__mockVirtualization.mountedCount(),
                            fetches: window.__convFetches || 0,
                        };
                    });
                    assert('Failed refresh retains the full-history snapshot',
                        kept.fetches >= 2 && kept.listed === platform.expectedMessages &&
                        kept.status !== 'degraded',
                        `${kept.fetches} fetches (2nd+ forced to 500), lists ${kept.listed}/` +
                        `${platform.expectedMessages}, DOM holds ${kept.mounted}, status=${kept.status}`);
                }
            }

            // ── Legacy bookmark migration ──────────────────────────────────
            if (platform.legacyBookmarkProbe) {
                const lb = await page.evaluate(() => {
                    const raw = window.GM_getValue('acn-bookmarks-v1', '{}');
                    const store = JSON.parse(raw);
                    const url = window.location.origin + window.location.pathname;
                    const list = (store[url] && store[url].bookmarks) || [];
                    return list.map(b => ({
                        id: b.id, schema: b.schema, msgUuid: b.msgUuid || null,
                        unresolved: b.legacyUnresolved || null, migrated: !!b.legacyMigrated,
                    }));
                });
                const upgraded  = lb.filter(b => b.schema === 2 && b.msgUuid && b.migrated).length;
                const unmatched = lb.filter(b => b.unresolved === 'unmatched').length;
                const want = platform.legacyBookmarkProbe;
                assert('Legacy schema-1 bookmark upgraded to a uuid',
                    upgraded === want.upgraded,
                    `${upgraded} upgraded (expected ${want.upgraded}) — ${JSON.stringify(lb)}`);
                // An unmatched record must be MARKED, not silently left generic: that mark is
                // what lets the UI say "recreate it" instead of "scroll toward it", which is
                // advice that cannot work for a record with no uuid.
                // The gate must REFUSE an ambiguous preview. Binding either candidate would
                // be permanent and silent, which is precisely what it exists to prevent.
                const ambigRec = lb.find(b => b.id === 'bm_ambig');
                assert('Uniqueness gate refuses an ambiguous legacy preview',
                    !!ambigRec && !ambigRec.msgUuid && ambigRec.unresolved === 'ambiguous',
                    ambigRec ? `uuid=${ambigRec.msgUuid || 'none'} unresolved=${ambigRec.unresolved}` : 'record missing');

                // NOT COVERED, deliberately: "a harvest-bound record renders an ACTIVE
                // flag". The fix is in place (the sweep clears data-acn-bookmarked and
                // activates the icon), but the bound row is not reliably mounted when the
                // panel is read here, so any assertion I can write passes by finding no
                // icons at all — a test that cannot fail, which DEC-032 records as
                // indistinguishable from one that passes. Left as honest test debt.
                //
                // ALSO NOT COVERED, same reasoning: "the click path records an exact-hash
                // legacy match as boundBy:'proof'". Reaching that branch needs a record the
                // text rules cannot bind whose hash DOES reproduce against a mounted row —
                // but the harvest runs on scan and proves exactly that record first, so the
                // click branch is unreachable here without a knob to disable the harvest.
                // Codex #59 R5 found the missing flag by reading, not by a red test.

                const shortRec = lb.find(b => b.id === 'bm_shortprev');
                assert('Short legacy preview REFUSES to bind rather than guessing',
                    !!shortRec && !shortRec.msgUuid && shortRec.schema !== 2,
                    shortRec ? `schema=${shortRec.schema} uuid=${shortRec.msgUuid || 'none'}` : 'record missing');
                assert('Unmatchable legacy bookmark is marked, not left generic',
                    unmatched === want.unmatched,
                    `${unmatched} marked unmatched (expected ${want.unmatched})`);

                // LABEL vs KEY: the panel row for a summary-preview record must display the
                // MESSAGE text (derived from the index by uuid), while the stored preview —
                // the matching evidence — remains the doubled summary. Owner-requested: a
                // summary label identifies the record to the code but not to the human.
                await page.evaluate(() => document.querySelector('#acn-dot-bookmarks').click());
                await page.waitForTimeout(400);
                const labels = await page.evaluate(() =>
                    Array.from(document.querySelectorAll('#acn-panel-bookmarks .acn-bk-text'))
                        .map(n => n.textContent));
                const sumRow = labels.find(t => t.indexOf('Answer number 11:') === 0);
                const stillSummary = labels.filter(t => t.indexOf('Architected mock governor') !== -1);
                assert('Summary-preview bookmark displays the message text, not the summary',
                    !!sumRow && stillSummary.length === 0,
                    `labels=${JSON.stringify(labels.map(t => t.substring(0, 40)))}`);
                await page.evaluate(() => document.querySelector('#acn-dot-bookmarks').click());
                await page.waitForTimeout(200);
            }

            // ── TESTS 22-25: index-backed jump (the primary v12.0 path) ────
            if (platform.indexBacked) {
                // TEST 22: panel lists the whole conversation while the DOM holds 3.
                const coverage = await page.evaluate(() => {
                    const stat = document.querySelector('[data-acn-role="nav-stat"]');
                    return { listed: stat ? +stat.getAttribute('data-acn-count') : -1,
                             mountedInDom: window.__mockVirtualization.mountedCount(),
                             realTurns: window.__mockVirtualization.totalTurns };
                });
                const expectListed = platform.listedTurnsOverride || coverage.realTurns;
                assert('Index lists the whole conversation, not the mounted window',
                    coverage.listed === expectListed &&
                    coverage.mountedInDom < coverage.realTurns,
                    `lists ${coverage.listed}/${expectListed}, DOM holds ${coverage.mountedInDom}`);

                // Pins the duplication defect to an exact size so a partial fix cannot
                // pass silently. When text matching is repaired this must go back to 0.
                if (platform.knownProvisionalDuplicates) {
                    assert('KNOWN DEFECT: unmatched DOM rows duplicated as provisional questions',
                        coverage.listed - coverage.realTurns === platform.knownProvisionalDuplicates,
                        `${coverage.listed - coverage.realTurns} duplicate(s); ` +
                        `expected exactly ${platform.knownProvisionalDuplicates} ` +
                        `(one per mounted user row). Fixing text matching must reduce this to 0.`);
                }

                // TEST 23a: offset-derivation failure must degrade HONESTLY.
                //
                // On the markdown-API entry ciDeriveRowOffset() can never succeed, which
                // is the shape of the live failure. What must hold is not "the jump
                // works" but "it gives up within its own budget instead of thrashing
                // indefinitely, and never claims success".
                if (platform.offsetUnderivable) {
                    const honest = await page.evaluate(async () => {
                        const v = window.__mockVirtualization;
                        v.scrollToFraction(1);
                        await new Promise(r => setTimeout(r, 300));
                        const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                        if (!items.length) return { ok: false, reason: 'no nav items' };
                        const z0 = document.querySelector('[data-acn-role="zone"]');
                        if (z0) z0.removeAttribute('data-acn-jump-resolved');
                        const t0 = Date.now();
                        let renders = 0;
                        const feed = document.querySelector('[role="feed"]') || document.body;
                        const mo = new MutationObserver(() => { renders++; });
                        mo.observe(feed, { childList: true, subtree: true });
                        items[0].click();
                        for (let i = 0; i < 200; i++) {
                            await new Promise(r => setTimeout(r, 100));
                            if (!document.querySelector('[data-acn-jumping="true"]')) break;
                            if (Date.now() - t0 > 19000) break;
                        }
                        mo.disconnect();
                        const zone = document.querySelector('[data-acn-role="zone"]');
                        return { ok: true, elapsedMs: Date.now() - t0, renders,
                                 claimedResolved: zone
                                     ? zone.getAttribute('data-acn-jump-resolved') : null,
                                 stillBusy: !!document.querySelector('[data-acn-jumping="true"]') };
                    });
                    // Original premise: USER text never matches here, so the jump can
                    // only fail, and must do so honestly. That premise expired when
                    // ASSISTANT rows became anchor sources — their text is plain on both
                    // sides, so this fixture is now legitimately resolvable. What must
                    // hold is stronger and simpler: never a WRONG claim. Either no claim
                    // (honest failure) or the CORRECT row (0 — items[0] is question 1).
                    assert('Unmatchable user text: honest failure or correct resolution, never a wrong claim',
                        honest.ok &&
                        (honest.claimedResolved === null || honest.claimedResolved === '0') &&
                        !honest.stillBusy,
                        honest.ok
                            ? `claimed=${honest.claimedResolved} busy=${honest.stillBusy} ` +
                              `~${honest.elapsedMs}ms, ${honest.renders} feed mutations`
                            : honest.reason);
                }

                // TEST J — THE ACCEPTANCE SWEEP (spec §5). Jump to EVERY question
                // (or every step-th) and verify ROW IDENTITY on each: question k is
                // structurally row 2(k-1), unrendered path entries shift only the PATH
                // side, never the rows. Chunked so no single evaluate runs long.
                if (platform.jumpEveryQuestion) {
                    const stepQ = platform.jumpEveryQuestion.step || 1;
                    const totalQ = platform.virtualized.totalTurns;
                    const failures = [];
                    let sumMs = 0, maxMs = 0, done = 0;
                    for (let from = 0; from < totalQ; from += 25 * stepQ) {
                        const to = Math.min(totalQ, from + 25 * stepQ);
                        const chunk = await page.evaluate(async ([from, to, stepQ, totalQ]) => {
                            const out = [];
                            const sleep = ms => new Promise(r => setTimeout(r, ms));
                            for (let i = from; i < to; i += stepQ) {
                                // Stride order (11 is coprime with every fixture's count):
                                // consecutive targets sit ~22 rows apart, far outside the
                                // mount window, so the sweep exercises the SETTLE LOOP.
                                // Visiting 0,1,2... made every target adjacent to the last
                                // landing and the whole sweep resolved via the fast path.
                                const k = (i * 11) % totalQ;
                                const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                                const item = items[k];
                                if (!item) { out.push({ k, err: 'no-item' }); continue; }
                                const z = document.querySelector('[data-acn-role="zone"]');
                                z.removeAttribute('data-acn-jump-resolved');
                                const t0 = Date.now();
                                item.click();
                                let resolved = null, busySeen = false;
                                for (;;) {
                                    await sleep(110);
                                    const raw = z.getAttribute('data-acn-jump-resolved');
                                    const busy = !!document.querySelector('[data-acn-jumping="true"]');
                                    if (busy) busySeen = true;
                                    if (raw !== null && !busy) { resolved = +raw; break; }
                                    // Failure exits clear busy and never set the attr;
                                    // 6.5s also bounds a hung jump (hard cap is 5s).
                                    if (!busy && Date.now() - t0 > 1400) break;
                                    if (Date.now() - t0 > 6500) break;
                                }
                                // Jump duration BEFORE the forensics probe: the rAF
                                // sample below costs ~160ms healthy and up to 3s
                                // throttled, and it must not inflate the duration it
                                // annotates — ms feeds the failure line AND the budget
                                // assertion's avg/max (Codex P2 on this PR).
                                const ms = Date.now() - t0;
                                // Environment forensics, failed jumps only. A null here
                                // is usually the product's own honest give-up (settle cap
                                // x iteration cap), and on a degraded CI host that means
                                // the mock's rAF-driven render loop was starved (webkit/
                                // macos, 2026-07-30: 10 CONSECUTIVE nulls at the cap
                                // ceiling on one entry while three sibling entries ran
                                // exact at ~300ms). raf10 = wall-clock ms for 10 rAF
                                // frames (~170ms healthy; seconds when throttled;
                                // -1 = rAF never delivered 10 frames in 3s).
                                let vis = null, raf10 = null;
                                if (resolved === null) {
                                    vis = document.visibilityState;
                                    raf10 = await new Promise(res => {
                                        let n = 0;
                                        const t = performance.now();
                                        const step = () => {
                                            if (++n >= 10) return res(Math.round(performance.now() - t));
                                            requestAnimationFrame(step);
                                        };
                                        requestAnimationFrame(step);
                                        setTimeout(() => res(-1), 3000);
                                    });
                                }
                                out.push({ k, resolved, busySeen, vis, raf10,
                                           itemText: (item.textContent || '').slice(0, 30),
                                           idxStatus: z.getAttribute('data-acn-index-status'),
                                           ms });
                            }
                            return out;
                        }, [from, to, stepQ, totalQ]);
                        for (const r of chunk) {
                            done++;
                            const expect = 2 * r.k;
                            sumMs += r.ms || 0; if ((r.ms || 0) > maxMs) maxMs = r.ms;
                            if (r.err || r.resolved !== expect) {
                                failures.push(`Q${r.k + 1}: expected row ${expect}, got ` +
                                              `${r.err || r.resolved} busySeen=${r.busySeen} idx=${r.idxStatus} ` +
                                              `"${r.itemText}" (${r.ms}ms` +
                                              (r.vis !== null && r.vis !== undefined
                                                  ? `, vis=${r.vis}, raf10=${r.raf10}ms` : '') + `)`);
                            }
                        }
                    }
                    assert('ACCEPTANCE: every targeted question reaches its exact row',
                        failures.length === 0 && done > 0,
                        failures.length
                            ? `${failures.length}/${done} failed — ` + failures.slice(0, 5).join(' | ')
                            : `${done} jumps, all exact; avg ${Math.round(sumMs / done)}ms, max ${maxMs}ms`);
                    assert('ACCEPTANCE: typical jump within budget',
                        done > 0 && (sumMs / done) <= 1500 && maxMs <= 6500,
                        `avg ${Math.round(sumMs / done)}ms (<=1500), max ${maxMs}ms (<=6500)`);
                }

                // TESTS 23-25 assert a SUCCESSFUL jump, which presupposes a derivable
                // offset. The markdown-API entry deliberately has none. The acceptance
                // entries run TEST J instead — targeting rows whose texts differ from
                // the base pattern would make these assertions assert the wrong thing.
                if (!platform.offsetUnderivable && !platform.jumpEveryQuestion) {
                // TEST 23: jump to question #1 from the BOTTOM.
                // Asserts the target was unmounted at click time AND that the landed
                // row is the RIGHT message — not merely that something mounted. With
                // ciDeriveRowOffset hardcoded to 0 this must fail.
                const firstJump = await page.evaluate(async () => {
                    const v = window.__mockVirtualization;
                    // Distance from the CENTRE of the final mount window to the target
                    // row. Restores the check lost when the text lookup moved to backing
                    // data: querySelector('[data-index=N]') returned null when the row was
                    // unmounted, so it doubled as a viewport assertion; rowText(i) reads
                    // MESSAGES unconditionally and cannot. Bounded rather than membership,
                    // because membership is exactly what raced on Windows — a correct jump
                    // landed on [41..46] for target 38 (drift 5.5) while a jump that
                    // resolves correctly but leaves the viewport at the top drifts 35.5.
                    // Measured on the largest CONTIGUOUS run, not the whole set: the
                    // mounted set includes the pinned tail, so spanning min..max of
                    // [0,1,2,3,4,5,79] centres on 39.5 rather than 2.5 and the metric
                    // becomes meaningless. Same rule the settle loop follows — reason
                    // about the selected cluster, never the raw mounted set.
                    const driftRows = (idx, target) => {
                        if (!idx.length) return Infinity;
                        const runs = [];
                        let cur = [idx[0]];
                        for (let k = 1; k < idx.length; k++) {
                            if (idx[k] === idx[k - 1] + 1) cur.push(idx[k]);
                            else { runs.push(cur); cur = [idx[k]]; }
                        }
                        runs.push(cur);
                        const win = runs.reduce((a, b) => (b.length > a.length ? b : a));
                        return Math.abs((win[0] + win[win.length - 1]) / 2 - target);
                    };
                    v.scrollToFraction(1);
                    await new Promise(r => setTimeout(r, 300));
                    const before = v.mountedIndexes();
                    const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                    if (!items.length) return { ok: false, reason: 'no nav items' };
                    // Clear any marker from a previous jump, or a stale one satisfies this test.
                    const z0 = document.querySelector('[data-acn-role="zone"]');
                    if (z0) z0.removeAttribute('data-acn-jump-resolved');
                    const wantText = items[0].querySelector('[data-acn-role="nav-item-text"]').textContent.trim();
                    const t0 = Date.now();
                    items[0].click();
                    for (let i = 0; i < 110; i++) {
                        await new Promise(r => setTimeout(r, 100));
                        const z = document.querySelector('[data-acn-role="zone"]');
                        const arrived = !!(z && z.getAttribute('data-acn-jump-resolved') !== null);
                        const busy = !!document.querySelector('[data-acn-jumping="true"]');
                        if (arrived && !busy) break;
                        if (Date.now() - t0 > 11000) break;
                    }
                    // Assert on WHAT THE IMPLEMENTATION RESOLVED, via the
                    // data-acn-jump-target contract attribute. Checking ambient DOM
                    // state instead ("is row 0 mounted and does it read right") passes
                    // even when the navigator resolved a different message: the mount
                    // window is 6 rows wide, so an off-by-one target lands in the same
                    // window. A mutation test proved a wrong-message jump passed here.
                    // Read the DURABLE record on the zone: the resolved element itself
                    // is detached by the re-render that scrollIntoView triggers.
                    const zone = document.querySelector('[data-acn-role="zone"]');
                    const rawIdx = zone ? zone.getAttribute('data-acn-jump-resolved') : null;
                    // /^\d+$/ not `+rawIdx`: unary plus maps "" and whitespace to 0,
                    // which is a PASSING index for the first-question test, so an empty
                    // attribute would read as a correct resolution of row 0.
                    const resolvedIdx = (rawIdx !== null && /^\d+$/.test(rawIdx.trim()))
                        ? +rawIdx : null;
                    // Identify the resolved row from the mock's BACKING DATA, not from
                    // the DOM. The row is often already recycled out by the time this
                    // runs — see the rowText() comment in claude-virtualized.html.
                    const resolvedText = resolvedIdx === null ? null : v.rowText(resolvedIdx);
                    return { ok: true, elapsedMs: Date.now() - t0,
                             targetWasMountedAtClick: before.indexOf(0) !== -1,
                             resolvedAnything: resolvedIdx !== null,
                             resolvedIsQuestion1: !!resolvedText && /Question number 1\b/.test(resolvedText),
                             // Q1 is row 0. Any other row means the navigator resolved
                             // a different message, however close it landed.
                             resolvedDataIndex: resolvedIdx,
                             navTextWasQuestion1: /Question number 1\b/.test(wantText),
                             stillBusy: !!document.querySelector('[data-acn-jumping="true"]'),
                             mountedNow: v.mountedIndexes(),
                             landingDrift: driftRows(v.mountedIndexes(), 0) };
                });
                assert('Jump RESOLVES question #1 from the bottom (not a neighbour)',
                    firstJump.ok && !firstJump.targetWasMountedAtClick &&
                    firstJump.resolvedAnything && firstJump.resolvedIsQuestion1 &&
                    firstJump.resolvedDataIndex === 0 &&
                    firstJump.navTextWasQuestion1 && !firstJump.stillBusy &&
                    firstJump.landingDrift <= 15,
                    firstJump.ok
                        ? `unmounted@click=${!firstJump.targetWasMountedAtClick} ` +
                          `resolved=row ${firstJump.resolvedDataIndex} ` +
                          `isQ1=${firstJump.resolvedIsQuestion1} ` +
                          `drift=${firstJump.landingDrift} ` +
                          `~${firstJump.elapsedMs}ms rows=[${firstJump.mountedNow}]`
                        : firstJump.reason);

                // TEST 24: jump to a MID-conversation question from the top.
                // Deliberately NOT the last question: the last one maps adjacent to the
                // pinned tail, so an off-by-one lands on an always-mounted row and looks
                // like success. A middle target has no such escape hatch.
                const midJump = await page.evaluate(async () => {
                    const v = window.__mockVirtualization;
                    // Distance from the CENTRE of the final mount window to the target
                    // row. Restores the check lost when the text lookup moved to backing
                    // data: querySelector('[data-index=N]') returned null when the row was
                    // unmounted, so it doubled as a viewport assertion; rowText(i) reads
                    // MESSAGES unconditionally and cannot. Bounded rather than membership,
                    // because membership is exactly what raced on Windows — a correct jump
                    // landed on [41..46] for target 38 (drift 5.5) while a jump that
                    // resolves correctly but leaves the viewport at the top drifts 35.5.
                    // Measured on the largest CONTIGUOUS run, not the whole set: the
                    // mounted set includes the pinned tail, so spanning min..max of
                    // [0,1,2,3,4,5,79] centres on 39.5 rather than 2.5 and the metric
                    // becomes meaningless. Same rule the settle loop follows — reason
                    // about the selected cluster, never the raw mounted set.
                    const driftRows = (idx, target) => {
                        if (!idx.length) return Infinity;
                        const runs = [];
                        let cur = [idx[0]];
                        for (let k = 1; k < idx.length; k++) {
                            if (idx[k] === idx[k - 1] + 1) cur.push(idx[k]);
                            else { runs.push(cur); cur = [idx[k]]; }
                        }
                        runs.push(cur);
                        const win = runs.reduce((a, b) => (b.length > a.length ? b : a));
                        return Math.abs((win[0] + win[win.length - 1]) / 2 - target);
                    };
                    v.scrollToFraction(0);
                    await new Promise(r => setTimeout(r, 300));
                    const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item"]'));
                    const targetOrdinal = 20;                    // question #20
                    const item = items[targetOrdinal - 1];
                    if (!item) return { ok: false, reason: 'no item ' + targetOrdinal };
                    const z0 = document.querySelector('[data-acn-role="zone"]');
                    if (z0) z0.removeAttribute('data-acn-jump-resolved');
                    const before = v.mountedIndexes();
                    const expectRow = (targetOrdinal - 1) * 2;   // user rows are even
                    const t0 = Date.now();
                    item.click();
                    for (let i = 0; i < 110; i++) {
                        await new Promise(r => setTimeout(r, 100));
                        const z = document.querySelector('[data-acn-role="zone"]');
                        const arrived = !!(z && z.getAttribute('data-acn-jump-resolved') !== null);
                        const busy = !!document.querySelector('[data-acn-jumping="true"]');
                        if (arrived && !busy) break;
                        if (Date.now() - t0 > 11000) break;
                    }
                    const zone = document.querySelector('[data-acn-role="zone"]');
                    const rawIdx = zone ? zone.getAttribute('data-acn-jump-resolved') : null;
                    // /^\d+$/ not `+rawIdx`: unary plus maps "" and whitespace to 0,
                    // which is a PASSING index for the first-question test, so an empty
                    // attribute would read as a correct resolution of row 0.
                    const resolvedIdx = (rawIdx !== null && /^\d+$/.test(rawIdx.trim()))
                        ? +rawIdx : null;
                    // Backing data, not the DOM — the resolved row is commonly unmounted
                    // again before this line. Reading textContent here made the assertion
                    // machine-speed-dependent and failed all three Windows engines while
                    // passing Linux/macOS, for an identical, correct jump.
                    const resolvedText = resolvedIdx === null ? null : v.rowText(resolvedIdx);
                    return { ok: true, expectRow, elapsedMs: Date.now() - t0,
                             wasMountedAtClick: before.indexOf(expectRow) !== -1,
                             resolvedAnything: resolvedIdx !== null,
                             resolvedDataIndex: resolvedIdx,
                             correctMessage: !!resolvedText &&
                                 new RegExp('Question number ' + targetOrdinal + '\\b').test(resolvedText),
                             stillBusy: !!document.querySelector('[data-acn-jumping="true"]'),
                             rows: v.mountedIndexes(),
                             landingDrift: driftRows(v.mountedIndexes(), expectRow) };
                });
                assert('Jump RESOLVES a mid-conversation question (not a neighbour)',
                    midJump.ok && !midJump.wasMountedAtClick && midJump.resolvedAnything &&
                    midJump.correctMessage &&
                    midJump.resolvedDataIndex === midJump.expectRow &&
                    !midJump.stillBusy &&
                    midJump.landingDrift <= 15,
                    midJump.ok
                        ? `expected row ${midJump.expectRow}, resolved row ${midJump.resolvedDataIndex}, ` +
                          `correctMsg=${midJump.correctMessage} drift=${midJump.landingDrift} ` +
                          `~${midJump.elapsedMs}ms rows=[${midJump.rows}]`
                        : midJump.reason);

                // TEST 25: the settle loop actually has to WORK for it.
                // scrollHeight must drift as rows are measured, otherwise the first
                // interpolation always lands and the convergence machinery is dead code
                // (a reviewer proved this by throwing inside the cluster selector and
                // seeing nothing fail).
                const drift = await page.evaluate(async () => {
                    const v = window.__mockVirtualization;
                    // Reset measured heights first. Earlier tests scroll extensively, and
                    // once most rows have been measured the estimate/actual gap closes —
                    // drift is a property of the UNMEASURED state, so measuring it after
                    // a full sweep reports ~0 and the assertion becomes order-dependent.
                    v.resetMeasurements();
                    const seen = [];
                    for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
                        v.scrollToFraction(f);
                        await new Promise(r => setTimeout(r, 120));
                        seen.push(v.scrollHeight());
                    }
                    v.scrollToFraction(0);
                    return { seen, min: Math.min(...seen), max: Math.max(...seen),
                             measured: v.measuredCount(), total: v.totalMessages };
                });
                const driftPct = 100 * (drift.max - drift.min) / drift.min;
                assert('Mock reproduces scrollHeight drift (convergence is exercised)',
                    driftPct > 1,
                    `scrollHeight ${drift.min}..${drift.max} (${driftPct.toFixed(2)}%), ` +
                    `${drift.measured}/${drift.total} rows measured`);

                }   // end !offsetUnderivable

                // TEST 26: abandoned-branch messages must NOT be listed.
                // The fixture hangs a two-message branch off a mid-conversation parent.
                // Replacing the tree walk with `msgs.slice()` must now fail here.
                const branch = await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item-text"]'))
                        .map(i => i.textContent);
                    return {
                        total: items.length,
                        leaked: items.filter(t => /ABANDONED BRANCH/i.test(t)).length,
                    };
                });
                // Provisional entries exist only while their unmatched row is MOUNTED,
                // so on hostile fixtures the listed count legitimately flaps between the
                // real total and total+provisionals depending on where the viewport sits.
                const expectTotal = platform.listedTurnsOverride || platform.virtualized.totalTurns;
                const baseTotal = platform.virtualized.totalTurns;
                assert('Abandoned branch excluded from the question list',
                    branch.leaked === 0 &&
                    (branch.total === expectTotal || branch.total === baseTotal),
                    `${branch.leaked} abandoned message(s) leaked; ${branch.total} items listed ` +
                    `(expected ${expectTotal})`);

                // TEST 27: message text must come from content[] blocks, not the
                // top-level `text` field. The real API returns `text: ''` on EVERY
                // message (measured: 0 of 192 non-empty) and the fixture mirrors that,
                // so if ciExtractText were "simplified" to read msg.text the index would
                // be empty and every jump would fail — silently, with no error anywhere.
                const contentSource = await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('[data-acn-role="nav-item-text"]'))
                        .map(i => i.textContent.trim());
                    return {
                        count: items.length,
                        nonEmpty: items.filter(t => t.length > 0).length,
                        matchesFixture: items.filter(t => /Question number \d+/.test(t)).length,
                    };
                });
                // Duplicate/attachment fixtures (and a provisional row born from an
                // attachment mismatch) legitimately carry non-pattern text.
                // exempt counts real non-pattern items (duplicates, attachment rows)
                // PLUS the provisional chip row — which exists only while its unmatched
                // row is mounted, so the match count legitimately spans a 1-wide range.
                const exempt = platform.contentPatternExempt || 0;
                const kpd = platform.knownProvisionalDuplicates || 0;
                assert('Question text is sourced from content[] blocks, not the empty text field',
                    contentSource.count > 0 &&
                    contentSource.nonEmpty === contentSource.count &&
                    contentSource.matchesFixture >= contentSource.count - exempt &&
                    contentSource.matchesFixture <= contentSource.count - (exempt - kpd),
                    `${contentSource.matchesFixture}/${contentSource.count} items carry ` +
                    `content[]-derived text (fixture sets text:'' on every message)`);
            }
        }

        // ── TEST: non-virtualized platforms must not enter the settle loop ──
        // Acceptance criterion "non-virtualized platforms unaffected" had no coverage.
        // Clicking a question on a static mock must resolve directly and never set the
        // jump-busy state.
        if (!platform.virtualized) {
            const direct = await page.evaluate(async () => {
                const items = document.querySelectorAll('[data-acn-role="nav-item"]');
                if (!items.length) return { ok: false, reason: 'no nav items' };
                let busySeen = false;
                items[0].click();
                for (let i = 0; i < 12; i++) {
                    if (document.querySelector('[data-acn-jumping="true"]')) busySeen = true;
                    await new Promise(r => setTimeout(r, 50));
                }
                return { ok: true, busySeen };
            });
            assert('Non-virtualized platform uses the direct path (no settle loop)',
                direct.ok && !direct.busySeen,
                direct.ok ? `jump-busy never set: ${!direct.busySeen}` : direct.reason);
        }

        // ── FINAL: no uncaught page errors, for EVERY platform ──────────────
        // Must be last: an earlier position meant errors thrown by later tests were
        // never seen (proven — a late throw during a jump passed 25/25). Previously
        // this was also gated to virtualized platforms only, so the other 14 collected
        // errors and discarded them.
        assert('No uncaught page errors', pageErrors.length === 0,
            pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'clean');

    } catch (err) {
        assert('No runtime errors', false, err.message);
    } finally {
        // Detach so errors do not bleed into the next platform's run — the page
        // object is reused across all 15 platforms.
        page.off('pageerror', onPageError);
        if (onConsole) page.off('console', onConsole);
    }

    return results;
}

// ── Browser launcher ──────────────────────────────────────────────────────────

async function launchBrowser(engineKey) {
    const engine = BROWSER_ENGINES[engineKey];

    // Try hardcoded fallback paths first (for local dev environments)
    let executablePath;
    for (const p of engine.fallbackPaths) {
        if (fs.existsSync(p)) {
            executablePath = p;
            break;
        }
    }

    const launchOptions = {
        headless: true,
    };

    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    if (engine.launchArgs.length > 0) {
        launchOptions.args = engine.launchArgs;
    }

    return engine.launcher.launch(launchOptions);
}

// ── Run all platform tests on a single browser engine ─────────────────────────

async function runTestsOnEngine(engineKey, scriptContent, captureScreenshots) {
    const engine = BROWSER_ENGINES[engineKey];

    console.log(`  Launching ${engine.name}...`);

    let browser;
    try {
        browser = await launchBrowser(engineKey);
    } catch (err) {
        console.log(`  SKIP — ${engine.name} not installed (${err.message.split('\n')[0]})`);
        return { engineName: engine.name, skipped: true, results: [] };
    }

    console.log(`  ${engine.name} launched successfully`);
    console.log('');

    // Set up screenshot directory for this engine
    let screenshotOpts = null;
    if (captureScreenshots) {
        const screenshotDir = path.join(__dirname, 'screenshots', engineKey);
        fs.mkdirSync(screenshotDir, { recursive: true });
        screenshotOpts = { dir: screenshotDir };
        console.log(`  Screenshots: ${screenshotDir}`);
        console.log('');
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    // --platform <substring>: run only matching entries (dev/debug aid).
    const pIdx = process.argv.indexOf('--platform');
    const pFilter = pIdx !== -1 ? process.argv[pIdx + 1] : null;
    const selected = pFilter
        ? PLATFORMS.filter(p => p.name.toLowerCase().includes(pFilter.toLowerCase()))
        : PLATFORMS;

    const allResults = [];
    for (const platform of selected) {
        // The "Testing X..." write flushes BEFORE the entry runs, so on a
        // streaming CI log a wedged job's tail names the entry it is stuck in.
        // Per-entry wall clock decomposes a slow job from its log alone: the
        // 2026-07-30 webkit/macos incident burned 40 minutes against a
        // 6-minute green with nothing in the log saying where.
        process.stdout.write(`  Testing ${platform.name}... `);
        const entryT0 = Date.now();
        const result = await testPlatform(page, platform, scriptContent, screenshotOpts);
        result.elapsedMs = Date.now() - entryT0;
        allResults.push(result);

        const secs = (result.elapsedMs / 1000).toFixed(1) + 's';
        const failCount = result.tests.filter(t => t.status === 'FAIL').length;
        if (failCount === 0) {
            console.log(`PASS (${result.tests.length}/${result.tests.length} tests, ${secs})`);
        } else {
            console.log(`FAIL (${failCount} failed, ${secs})`);
        }
    }

    await context.close();
    await browser.close();

    return { engineName: engine.name, skipped: false, results: allResults };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const browsers = parseBrowserArg();
    const captureScreenshots = shouldCaptureScreenshots();

    console.log('');
    console.log('========================================');
    console.log(' AI Conversation Navigator — Test Suite');
    console.log('        v10.0 Orbital Button System     ');
    console.log('========================================');
    console.log(`  Browsers: ${browsers.map(b => BROWSER_ENGINES[b].name).join(', ')}`);
    console.log(`  Platform: ${process.platform} (${process.arch})`);
    if (captureScreenshots) console.log('  Screenshots: ENABLED');
    console.log('========================================');
    console.log('');

    const scriptContent = getScriptContent();

    // Run tests on each selected browser engine
    const engineResults = [];
    for (const engineKey of browsers) {
        console.log(`── ${BROWSER_ENGINES[engineKey].name} ${'─'.repeat(38 - BROWSER_ENGINES[engineKey].name.length)}`);
        const result = await runTestsOnEngine(engineKey, scriptContent, captureScreenshots);
        engineResults.push({ ...result, engineKey });
        console.log('');
    }

    // ── Print detailed report ──────────────────────────────────────────────
    console.log('========================================');
    console.log(' DETAILED RESULTS');
    console.log('========================================');

    let grandTotalTests = 0;
    let grandTotalPassed = 0;
    let grandTotalFailed = 0;
    let enginesSkipped = 0;

    for (const engineResult of engineResults) {
        if (engineResult.skipped) {
            console.log('');
            console.log(`  ${engineResult.engineName}: SKIPPED (not installed)`);
            enginesSkipped++;
            continue;
        }

        console.log('');
        console.log(`  ── ${engineResult.engineName} ──`);

        for (const result of engineResult.results) {
            const icon = result.passed ? '\u2705' : '\u274C';
            const entrySecs = result.elapsedMs != null
                ? ` (${(result.elapsedMs / 1000).toFixed(1)}s)` : '';
            console.log('');
            console.log(`  ${icon} ${result.name}${entrySecs}`);
            console.log('    ' + '-'.repeat(38));

            for (const test of result.tests) {
                const mark = test.status === 'PASS' ? '\u2713' : '\u2717';
                console.log(`    ${mark} ${test.testName}: ${test.detail}`);
                grandTotalTests++;
                if (test.status === 'PASS') grandTotalPassed++;
                else grandTotalFailed++;
            }
        }
    }

    // ── Summary ────────────────────────────────────────────────────────────
    const enginesRun = engineResults.filter(e => !e.skipped);
    const allPlatformResults = enginesRun.flatMap(e => e.results);
    const platformsPassed = allPlatformResults.filter(r => r.passed).length;
    const platformsFailed = allPlatformResults.filter(r => !r.passed).length;

    console.log('');
    console.log('========================================');
    console.log(' SUMMARY');
    console.log('========================================');
    console.log(`  Engines:   ${enginesRun.length} tested, ${enginesSkipped} skipped (${engineResults.length} total)`);
    console.log(`  Platforms: ${platformsPassed} passed, ${platformsFailed} failed (${allPlatformResults.length} total)`);
    console.log(`  Tests:     ${grandTotalPassed} passed, ${grandTotalFailed} failed (${grandTotalTests} total)`);
    console.log('========================================');
    console.log('');

    // ── Generate SCREENSHOTS.md if screenshots were captured ──────────────
    if (captureScreenshots) {
        const screenshotBaseDir = path.join(__dirname, 'screenshots');
        const mdPath = path.join(screenshotBaseDir, 'SCREENSHOTS.md');
        let md = '# Test Screenshots\n\n';
        md += `Generated on ${new Date().toISOString().split('T')[0]} `;
        md += `| Platform: ${process.platform} (${process.arch})\n\n`;

        for (const engineResult of engineResults) {
            if (engineResult.skipped) continue;

            md += `## ${engineResult.engineName}\n\n`;

            for (const result of engineResult.results) {
                if (!result.screenshots || result.screenshots.length === 0) continue;

                const status = result.passed ? 'PASS' : 'FAIL';
                md += `### ${result.name} — ${status}\n\n`;

                // Show zone and panel-open side by side
                md += '| Zone Injected | Panel Open |\n';
                md += '|:---:|:---:|\n';

                const zoneShot  = result.screenshots.find(s => s.label === 'Zone injected');
                const panelShot = result.screenshots.find(s => s.label === 'Panel open');
                const zoneRel   = zoneShot  ? path.relative(screenshotBaseDir, zoneShot.path)  : '';
                const panelRel  = panelShot ? path.relative(screenshotBaseDir, panelShot.path) : '';

                const zoneCell  = zoneRel  ? `![${result.name} zone](${zoneRel})`  : 'N/A';
                const panelCell = panelRel ? `![${result.name} panel](${panelRel})` : 'N/A';
                md += `| ${zoneCell} | ${panelCell} |\n\n`;
            }
        }

        fs.writeFileSync(mdPath, md);
        console.log(`  Screenshots report: ${mdPath}`);
        console.log('');
    }

    // Fail if any tests failed or if ALL engines were skipped
    if (grandTotalFailed > 0) process.exit(1);
    if (enginesRun.length === 0) {
        console.error('ERROR: No browser engines were available to test.');
        process.exit(2);
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(2);
});
