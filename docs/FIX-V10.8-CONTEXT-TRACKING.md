# Fix: Context Tracking, Arc Hitzone, Turn Counter Reset

**Branch:** `fix/v10-live-testing-polish`  
**Version:** v10.8  
**Priority:** Critical — SSE interceptor has never worked in production  
**Scope:** `ai-conversation-navigator.user.js` only

---

## Summary

Five changes, in order:

1. **Fix SSE interceptor** — use `unsafeWindow` so the fetch patch hits the real page `window`
2. **Non-Claude: remove estimated bar** — show turn dots only (no misleading percentage)
3. **Claude: add GM storage caching** — persist SSE token data per conversation for page reloads
4. **Arc mode hitzone too narrow** — satellite buttons extend beyond the hover zone, causing collapse
5. **Turn counter stale after SPA navigation** — counter never resets when switching conversations

---

## Background

### Why the SSE interceptor never worked (Changes 1 & 3)

The script header declares `@grant GM_addStyle`, `GM_getValue`, `GM_setValue`, `GM_xmlhttpRequest`. When any `@grant` other than `none` is present, Tampermonkey runs the script in a **sandboxed environment** where `window` is a wrapper — not the real page `window`.

`setupClaudeSSEInterceptor()` patches `window.fetch`, but Claude.ai's JavaScript uses the **real** page's `window.fetch`. The monkey-patch sits on the sandbox copy and never sees any traffic.

**Verified in production** (2026-02-23):
- `window._acnFetchPatched` in browser console → `undefined` (flag was set on sandbox window, not page window)
- Manually patching the real `window.fetch` from console → immediately intercepted SSE streams with `input_tokens` data
- The `(est.)` label has been showing the entire time — `_sseTokenData.exact` has never been `true`

### Why the estimated bar is wrong for non-Claude (Change 2)

The CONTEXT-TRACKING.md spec explicitly states: DOM-based token estimation is fundamentally inadequate for percentage-bar accuracy. The gap between visible text and actual token usage can be 15-20x. For non-Claude platforms where we have no SSE data, showing a percentage bar that reads "~12K / 128K" when real usage might be 90K+ is actively misleading. The original design called for turn dots only.

### Why arc hitzone collapses (Change 4)

`orbUpdateHitzone()` computes a fixed width of `ORB_CX + 24 + HITZONE_PAD_X` = 42 + 24 + 30 = **96px** from the right edge. This is based on the show-all vertical layout where all dots sit near the right edge.

In arc mode, the focused satellite (at angle 0 = directly LEFT of center) is positioned at `right: ORB_CX + cos(0) * radius` = `42 + 88` = **130px** from the right edge, plus the dot's own half-width (17px). The leftmost pixel of the focused satellite is ~147px from the right — **51px beyond the hitzone boundary**. When the user moves their cursor left toward that button, they exit the hitzone at 96px, which triggers `mouseleave` on the zone, which collapses all the buttons.

This doesn't affect the panel-open case because when a panel is open, `orbPanel !== null`, so `orbHovering` doesn't control visibility — the buttons stay visible regardless of hover state.

### Why turn counter goes stale (Change 5)

Codex review finding. `updateTurnCounter()` has an early return: `if (newTotal <= _turnCounter.totalTurns) return`. The SPA navigation handlers (pushState, replaceState, popstate at lines 1224–1246) reset `_questions = []` but do NOT reset `_turnCounter`. After navigating to a conversation with fewer messages, `_questions.length` (new conversation) is less than `_turnCounter.totalTurns` (old conversation), so `updateTurnCounter()` returns early on every call. The turn dots and compaction badge remain stale from the previous conversation until the new thread exceeds the old message count.

---

## Change 1: Fix SSE Interceptor (`unsafeWindow`)

### Step 1A: Add `@grant unsafeWindow` to header

Location: line 25, after the last `@grant` line.

```
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==
```

### Step 1B: Rewrite `setupClaudeSSEInterceptor()` to use `unsafeWindow`

Location: line 1372. Replace the entire function (lines 1372–1403).

**Before:**
```javascript
function setupClaudeSSEInterceptor() {
    if (typeof window.fetch !== 'function') return;
    if (window._acnFetchPatched) return; // idempotent
    window._acnFetchPatched = true;

    var _nativeFetch = window.fetch;

    window.fetch = function acnFetchProxy(input, init) {
        var url = (typeof input === 'string') ? input :
                  (input && input.url) ? input.url : '';

        // Only intercept streaming requests to Claude's backend
        var isClaude = url.indexOf('claude.ai') !== -1 ||
                       url.indexOf('/api/organizations') !== -1 ||
                       url.indexOf('/api/append_message') !== -1 ||
                       url.indexOf('/completion') !== -1;

        var result = _nativeFetch.apply(this, arguments);

        if (!isClaude) return result;

        return result.then(function (response) {
            // Only attempt to tap text/event-stream responses
            var ct = response.headers && response.headers.get('content-type');
            if (!ct || ct.indexOf('text/event-stream') === -1) return response;

            // We must clone: the original stream can only be consumed once
            var cloned = response.clone();
            readSSEStream(cloned.body);
            return response;
        });
    };
}
```

**After:**
```javascript
function setupClaudeSSEInterceptor() {
    // Tampermonkey sandbox: `window` is a wrapper, not the real page window.
    // Claude.ai's JS uses the real window.fetch — we must patch that one.
    var pw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (typeof pw.fetch !== 'function') return;
    if (pw._acnFetchPatched) return; // idempotent
    pw._acnFetchPatched = true;

    var _nativeFetch = pw.fetch.bind(pw);

    pw.fetch = function acnFetchProxy(input, init) {
        var url = (typeof input === 'string') ? input :
                  (input && input.url) ? input.url : '';

        // Only intercept streaming requests to Claude's backend
        var isClaude = url.indexOf('claude.ai') !== -1 ||
                       url.indexOf('/api/organizations') !== -1 ||
                       url.indexOf('/api/append_message') !== -1 ||
                       url.indexOf('/completion') !== -1;

        var result = _nativeFetch.apply(this, arguments);

        if (!isClaude) return result;

        return result.then(function (response) {
            // Only attempt to tap text/event-stream responses
            var ct = response.headers && response.headers.get('content-type');
            if (!ct || ct.indexOf('text/event-stream') === -1) return response;

            // We must clone: the original stream can only be consumed once
            var cloned = response.clone();
            readSSEStream(cloned.body);
            return response;
        });
    };
}
```

Key differences from old version:
- `pw` = `unsafeWindow` (falls back to `window` for environments without Tampermonkey)
- `_nativeFetch = pw.fetch.bind(pw)` — `.bind(pw)` ensures `this` context is correct on the real window
- All references to `window` in this function become `pw`
- The rest of the function body (URL matching, clone, readSSEStream) is identical

**Do NOT change** `readSSEStream()` or `parseSSEEvent()` — those don't touch `window.fetch` and work fine as-is.

---

## Change 2: Non-Claude — Remove Estimated Bar, Show Turn Dots Only

### Step 2A: Rewrite Path C in `orbUpdateContextBar()`

Location: lines 2426–2438.

**Before:**
```javascript
// ── Path C: Non-Claude — turn counter ─────────────────
if (_questions.length === 0) {
    pct.textContent  = '\u2014';
    pct.style.color  = '';
    fill.style.width = '0%';
    if (meta) { meta.textContent = 'No messages detected'; meta.style.color = ''; }
    _removeTurnDots();
    return;
}

_renderEstimatedBar(pct, fill, meta, limit);
_renderTurnDots();
_renderTurnCompactionInfo();
```

**After:**
```javascript
// ── Path C: Non-Claude — turn dots only ───────────────
// DOM-based token estimation is too inaccurate (15-20x undercount).
// Turn dots with weighted-average compaction prediction are more honest.
if (_questions.length === 0) {
    pct.textContent  = '\u2014';
    pct.style.color  = '';
    fill.style.width = '0%';
    if (meta) { meta.textContent = 'No messages detected'; meta.style.color = ''; }
    _removeTurnDots();
    return;
}

// Hide percentage bar elements — turn dots are the primary indicator
pct.textContent  = '';
fill.style.width = '0%';
if (meta) { meta.textContent = ''; }

_renderTurnDots();
_renderTurnCompactionInfo();
```

This removes the `_renderEstimatedBar()` call. The percentage number, fill bar, and meta text are cleared so only the turn dots and compaction info text are visible.

### Step 2B: Update context bar label for non-Claude

Location: line 2843, inside `orbBuildPanelNav()`.

**Before:**
```javascript
var ctxLabel = createElement('span', { className: 'acn-ctx-l', textContent: 'Context window' });
```

**After:**
```javascript
var ctxLabelText = (platform.id === 'claude') ? 'Context window' : 'Conversation turns';
var ctxLabel = createElement('span', { className: 'acn-ctx-l', textContent: ctxLabelText });
```

---

## Change 3: Claude GM Storage Caching

### Purpose

When the user reloads the page or navigates to an existing conversation, `_sseTokenData` resets. Until they send a message and SSE fires, there's no token data. GM caching fills this gap with the last known exact values.

### Step 3A: Add helper functions

Location: Insert right after `parseSSEEvent()` (after line 1501), before the `// TURN COUNTER HELPERS` section.

```javascript
// ── GM cache helpers for Claude context data ──────────
function _getConvId() {
    // URL: /chat/6873dd1a-f895-4fef-a564-6f0e03b7e8ed
    var parts = window.location.pathname.split('/');
    var id = parts[parts.length - 1];
    // Validate it looks like a UUID (basic check)
    return (id && id.length > 8 && id.indexOf('-') !== -1) ? id : null;
}

function _cacheSSEData() {
    var convId = _getConvId();
    if (!convId || !_sseTokenData.exact) return;
    try {
        var cache = GM_getValue('acn_ctx_cache', {});
        cache[convId] = {
            inputTokens:  _sseTokenData.inputTokens,
            outputTokens: _sseTokenData.outputTokens,
            timestamp:    Date.now()
        };

        // Prune: keep only 50 most recent conversations
        var keys = Object.keys(cache);
        if (keys.length > 50) {
            keys.sort(function (a, b) {
                return (cache[b].timestamp || 0) - (cache[a].timestamp || 0);
            });
            var pruned = {};
            for (var i = 0; i < 50; i++) {
                pruned[keys[i]] = cache[keys[i]];
            }
            cache = pruned;
        }

        GM_setValue('acn_ctx_cache', cache);
    } catch (e) { /* GM storage unavailable — silently skip */ }
}

function _loadCachedSSEData() {
    var convId = _getConvId();
    if (!convId) return;
    try {
        var cache = GM_getValue('acn_ctx_cache', {});
        var entry = cache[convId];
        if (entry && entry.inputTokens) {
            _sseTokenData.inputTokens  = entry.inputTokens;
            _sseTokenData.outputTokens = entry.outputTokens;
            _sseTokenData.lastUpdated  = entry.timestamp;
            _sseTokenData.exact        = false; // not live
            _sseTokenData.cached       = true;  // flag for UI label
        }
    } catch (e) { /* silently skip */ }
}
```

### Step 3B: Add `cached` flag to `_sseTokenData` initialization

Location: line 1111.

**Before:**
```javascript
var _sseTokenData = {
    inputTokens:  0,
    outputTokens: 0,
    lastUpdated:  0,
    exact:        false   // true once we have at least one message_start reading
};
```

**After:**
```javascript
var _sseTokenData = {
    inputTokens:  0,
    outputTokens: 0,
    lastUpdated:  0,
    exact:        false,  // true once we have at least one message_start reading
    cached:       false   // true when loaded from GM cache (not live SSE)
};
```

### Step 3C: Call `_cacheSSEData()` when SSE data arrives

Location: inside `parseSSEEvent()`, right after `_sseTokenData.exact = true;` (line 1488).

Add two lines:
```javascript
_sseTokenData.exact        = true;
_sseTokenData.cached       = false; // live data supersedes cache
_cacheSSEData();                    // persist for page reloads
```

### Step 3D: Call `_loadCachedSSEData()` on init

Location: line 902, right after `setupClaudeSSEInterceptor()`.

**Before:**
```javascript
// Wire up Claude SSE interceptor for exact token tracking
if (platform.id === 'claude') setupClaudeSSEInterceptor();
```

**After:**
```javascript
// Wire up Claude SSE interceptor for exact token tracking
if (platform.id === 'claude') {
    setupClaudeSSEInterceptor();
    _loadCachedSSEData();
}
```

### Step 3E: Add cached state to `orbUpdateContextBar()` Path A

Location: lines 2397–2416. The current Path A checks `_sseTokenData.exact`. We need to also handle the cached state.

**Before:**
```javascript
// ── Path A: Claude with exact SSE token data ──────────
if (platform && platform.id === 'claude' && _sseTokenData.exact) {
    var inputTok = _sseTokenData.inputTokens;
    var pctNum   = Math.min(100, Math.round((inputTok / limit) * 100));
    var color    = getBarColor(pctNum);

    var tokFmt   = inputTok.toLocaleString();
    var limFmt   = Math.round(limit / 1000) + 'K';
    pct.textContent  = pctNum + '%';
    pct.style.color  = color;
    fill.style.width      = pctNum + '%';
    fill.style.background = color;

    if (meta) {
        meta.textContent = tokFmt + ' / ' + limFmt + ' tokens (exact)';
        meta.style.color = '#888';
    }

    _renderCompactionInfo(pctNum);
    return;
}
```

**After:**
```javascript
// ── Path A: Claude with exact or cached SSE token data ──
if (platform && platform.id === 'claude' &&
    (_sseTokenData.exact || _sseTokenData.cached)) {
    var inputTok = _sseTokenData.inputTokens;
    var pctNum   = Math.min(100, Math.round((inputTok / limit) * 100));
    var color    = getBarColor(pctNum);

    var tokFmt   = inputTok.toLocaleString();
    var limFmt   = Math.round(limit / 1000) + 'K';
    pct.textContent  = pctNum + '%';
    pct.style.color  = color;
    fill.style.width      = pctNum + '%';
    fill.style.background = color;

    if (meta) {
        var label = _sseTokenData.exact ? '(exact)' : '(last known)';
        meta.textContent = tokFmt + ' / ' + limFmt + ' tokens ' + label;
        meta.style.color = _sseTokenData.exact ? '#888' : '#666';
    }

    _renderCompactionInfo(pctNum);
    return;
}
```

Path A now catches both live SSE and cached data. Path B (DOM estimation) only runs when there's no cache AND no SSE — i.e., conversations never visited with the script installed.

---

## Change 4: Arc Mode Hitzone Too Narrow

### Problem geometry

Constants (lines 1311–1314):
```
ORB_CX        = 42   (center axis from right edge)
HITZONE_PAD_X = 30
HITZONE_PAD_Y = 40
```

Arc mode (line 2119): `radius = 88`

Current hitzone width (line 2406):
```javascript
var hitzoneWidth = ORB_CX + 24 + HITZONE_PAD_X;  // = 42 + 24 + 30 = 96px
```

Arc focused satellite position (angle 0 = directly left of center):
```
right = ORB_CX + cos(0) * 88 = 42 + 88 = 130px from right edge
```
Plus dot half-width (34/2 = 17px) → leftmost pixel at **147px** from right edge.

Hitzone is 96px wide. Gap of **51px** where the cursor exits the hitzone before reaching the button.

### Step 4A: Make `orbUpdateHitzone()` mode-aware

Location: line 5381. Replace the entire function.

**Before:**
```javascript
function orbUpdateHitzone() {
    var hitzone = document.getElementById('acn-hitzone');
    if (!hitzone) return;

    var cy = window.innerHeight / 2;
    var sp = 48;

    var nSats  = ORB_N - 1;
    var nAbove = Math.floor(nSats / 2);
    var nBelow = nSats - nAbove;

    var stackTop    = cy - Math.max(nAbove * sp + 16, 24);
    var stackBottom = cy + Math.max(nBelow * sp + 16, 24);

    var hitzoneTop    = Math.max(0, stackTop - HITZONE_PAD_Y);
    var hitzoneBottom = Math.min(window.innerHeight, stackBottom + HITZONE_PAD_Y);
    var hitzoneHeight = hitzoneBottom - hitzoneTop;

    var hitzoneWidth = ORB_CX + 24 + HITZONE_PAD_X;

    hitzone.style.top    = hitzoneTop + 'px';
    hitzone.style.height = hitzoneHeight + 'px';
    hitzone.style.width  = hitzoneWidth + 'px';
    hitzone.style.bottom = 'auto';
}
```

**After:**
```javascript
function orbUpdateHitzone() {
    var hitzone = document.getElementById('acn-hitzone');
    if (!hitzone) return;

    var cy = window.innerHeight / 2;
    var sp = 48;

    var nSats  = ORB_N - 1;
    var nAbove = Math.floor(nSats / 2);
    var nBelow = nSats - nAbove;

    var stackTop    = cy - Math.max(nAbove * sp + 16, 24);
    var stackBottom = cy + Math.max(nBelow * sp + 16, 24);

    var hitzoneTop    = Math.max(0, stackTop - HITZONE_PAD_Y);
    var hitzoneBottom = Math.min(window.innerHeight, stackBottom + HITZONE_PAD_Y);
    var hitzoneHeight = hitzoneBottom - hitzoneTop;

    // Width must cover the furthest dot in the active mode.
    // show-all/wheel: dots are on the center axis (ORB_CX ± 24px)
    // arc: focused satellite extends ORB_CX + radius + half-dot from the right edge
    var baseWidth = ORB_CX + 24 + HITZONE_PAD_X;      // 96px — covers show-all & wheel
    var arcWidth  = ORB_CX + 88 + 17 + HITZONE_PAD_X; // 177px — covers arc focused dot

    var hitzoneWidth = (orbMode === 'arc') ? arcWidth : baseWidth;

    hitzone.style.top    = hitzoneTop + 'px';
    hitzone.style.height = hitzoneHeight + 'px';
    hitzone.style.width  = hitzoneWidth + 'px';
    hitzone.style.bottom = 'auto';
}
```

### Step 4B: Call `orbUpdateHitzone()` when mode changes

The mode can change via the Settings panel. Search for where `orbMode` is reassigned after initialization — it will be in the settings panel builder, near calls to `orbSaveSettings()` and `orbRender()`. After each such `orbRender()` call, add:
```javascript
orbUpdateHitzone();
```

This ensures the hitzone geometry updates immediately when the user switches between show-all, arc, and wheel modes.

---

## Change 5: Reset Turn Counter on SPA Navigation

### Step 5A: Add a reset helper function

Location: Insert right after `updateTurnCounter()` (after line 1515), before `predictNextCycleLength()`.

```javascript
function resetTurnCounter() {
    _turnCounter.totalTurns          = 0;
    _turnCounter.turnsSinceCompact   = 0;
    _turnCounter.compactionCount     = 0;
    _turnCounter.cycleLengths        = [];
    _turnCounter.predictedCycleLength = null;
    _turnCounter.lastCompactTurn     = 0;

    // Also reset Claude SSE state for the new conversation
    _sseTokenData.inputTokens  = 0;
    _sseTokenData.outputTokens = 0;
    _sseTokenData.lastUpdated  = 0;
    _sseTokenData.exact        = false;
    _sseTokenData.cached       = false;
    _prevInputTokens           = 0;
    _compactionCount           = 0;
    _compactionHistory         = [];
}
```

### Step 5B: Handle shrinkage in `updateTurnCounter()`

Location: line 1508.

**Before:**
```javascript
function updateTurnCounter() {
    var newTotal = _questions.length;
    if (newTotal <= _turnCounter.totalTurns) return;

    var added = newTotal - _turnCounter.totalTurns;
    _turnCounter.totalTurns        += added;
    _turnCounter.turnsSinceCompact += added;
}
```

**After:**
```javascript
function updateTurnCounter() {
    var newTotal = _questions.length;

    // SPA navigation: if message count decreased, we're in a new conversation
    if (newTotal < _turnCounter.totalTurns) {
        resetTurnCounter();
    }

    if (newTotal <= _turnCounter.totalTurns) return;

    var added = newTotal - _turnCounter.totalTurns;
    _turnCounter.totalTurns        += added;
    _turnCounter.turnsSinceCompact += added;
}
```

### Step 5C: Call `resetTurnCounter()` in SPA navigation handlers

Location: lines 1224–1246 (the pushState/replaceState/popstate handlers).

Add `resetTurnCounter();` right after each `_questions = [];` line:

```javascript
history.pushState = function () {
    _origPushState.apply(this, arguments);
    if (isVirtualScroll) _vsAccumulatedKeys.clear();
    _questions = [];
    resetTurnCounter();  // ← ADD
    if (typeof orbClosePanel === 'function') orbClosePanel();
    setTimeout(scanConversation, 500);
    if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
};

history.replaceState = function () {
    _origReplaceState.apply(this, arguments);
    _questions = [];
    resetTurnCounter();  // ← ADD
    setTimeout(scanConversation, 500);
    if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
};

window.addEventListener('popstate', function () {
    if (isVirtualScroll) _vsAccumulatedKeys.clear();
    _questions = [];
    resetTurnCounter();  // ← ADD
    if (typeof orbClosePanel === 'function') orbClosePanel();
    setTimeout(scanConversation, 500);
    if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
});
```

### Step 5D: Load cached SSE data after SPA navigation to Claude conversation

For Claude users who navigate between conversations via SPA, the `resetTurnCounter()` clears SSE data. We should try to load cached data for the new conversation.

In each SPA handler, after `resetTurnCounter();`, add:
```javascript
if (platform.id === 'claude') {
    setTimeout(_loadCachedSSEData, 600); // after URL has updated
}
```

This ensures that when a Claude user clicks to a different conversation, the context bar shows cached token data (if available) instead of falling back to DOM estimation.

---

## Testing Checklist

### SSE interceptor (Change 1)
- [ ] Open claude.ai conversation, send a message
- [ ] Context bar should update with exact token count and `(exact)` label
- [ ] Open browser console, type `window._acnFetchPatched` — should be `true`
- [ ] Compaction detection should work: in a long conversation, when input_tokens drops >40% from previous message, compaction badge should appear

### Non-Claude turn dots (Change 2)
- [ ] Open ChatGPT, start a conversation
- [ ] Navigate panel should show "Conversation turns" header
- [ ] No percentage number or filled bar visible
- [ ] Turn dots appear and color-code based on compaction history
- [ ] Same behavior on Grok, Gemini, Perplexity

### GM caching (Change 3)
- [ ] On Claude, send a few messages — context bar shows `(exact)`
- [ ] Reload the page — context bar should immediately show the previous token count with `(last known)` label
- [ ] Send a new message — label should change to `(exact)` with updated numbers
- [ ] Open a brand new conversation never visited before — should fall back to `(est.)` until first message

### Arc hitzone (Change 4)
- [ ] Set mode to Arc in Settings
- [ ] Hover over the orbital zone — satellite buttons should appear in polygon arrangement
- [ ] Move cursor leftward toward the focused satellite (directly left of Navigate)
- [ ] Cursor should be able to reach and click the button without the zone collapsing
- [ ] Show All and Wheel modes should still work normally (narrower hitzone is fine for them)
- [ ] Switch between modes in Settings — hitzone should update each time

### Turn counter reset (Change 5)
- [ ] On a non-Claude SPA platform (e.g., Gemini), start a conversation with 10+ messages
- [ ] Navigate to a different conversation with fewer messages (via sidebar)
- [ ] Turn counter should reset and show the new conversation's message count
- [ ] Turn dots should reflect the new conversation, not the old one
- [ ] On Claude, navigating between conversations should load cached SSE data if available

---

## Version bump

Update `@version` in the script header (line 5) from `10.7.11` to `10.8`.
Update `@name` in the script header (line 3) from `AI Conversation Navigator v10.7.11` to `AI Conversation Navigator v10.8`.

---

## Changelog entry (reasoning-flow format)

```markdown
## [10.8 — Context Tracking Overhaul, Arc Hitzone, Turn Counter Reset] — 2026-02-2X

**Branch:** `fix/v10-live-testing-polish`

Five fixes: critical SSE interceptor bug, non-Claude display cleanup, Claude GM caching,
arc mode hitzone geometry, and SPA turn counter staleness.

---

### SSE Interceptor Never Worked — Tampermonkey Sandbox Isolation

**The problem:** The context bar always showed `(est.)` on Claude, even after sending
multiple messages. `_sseTokenData.exact` was never set to `true`. The SSE interceptor
appeared to be set up but never intercepted any traffic.

**Root cause — Tampermonkey sandbox:** When `@grant` directives are present (GM_addStyle,
GM_getValue, etc.), Tampermonkey runs the script in a sandboxed environment where `window`
is a wrapper object, not the real page `window`. `setupClaudeSSEInterceptor()` patched
`window.fetch` — but this patched the sandbox's copy. Claude.ai's JavaScript uses the real
page's `window.fetch`, which was never touched. Confirmed by checking
`window._acnFetchPatched` in the browser console — returned `undefined`. Manually patching
the real `window.fetch` from console immediately intercepted SSE streams with `input_tokens`.

**Fix:** Use `unsafeWindow` (Tampermonkey API that references the real page window) instead
of `window` for the fetch patch. Added `@grant unsafeWindow` to the header. Used
`unsafeWindow.fetch.bind(unsafeWindow)` to preserve `this` context.

---

### Non-Claude: Removed Misleading Estimated Percentage Bar

**The problem:** ChatGPT, Grok, Gemini showed both an estimated percentage bar AND turn dots.
The percentage bar used DOM `innerText / 4` estimation which can undercount by 15-20x
(system prompts, tool calls, search results are invisible to DOM scraping). Showing "~12K /
128K tokens (est.)" when real usage might be 90K+ is actively misleading.

**Fix:** Removed `_renderEstimatedBar()` call from Path C. Non-Claude platforms now show
only turn dots with weighted-average compaction prediction — honest about what we don't know,
increasingly accurate over time. Section header changed from "Context window" to
"Conversation turns".

---

### Claude: GM Storage Caching for Page Reloads

**The problem:** On page reload or navigation to an existing conversation, `_sseTokenData`
resets. Until the user sends a message and SSE fires, the context bar falls back to
inaccurate DOM estimation.

**Fix:** After each SSE `message_start`, persist token data to `GM_setValue` keyed by
conversation ID (extracted from URL path). On page load, check GM cache first. Cached data
displays with `(last known)` label, distinct from live `(exact)`. Cache is pruned to 50 most
recent conversations. Three display states: `(exact)` = live SSE, `(last known)` = cached
from previous session, `(est.)` = DOM fallback for never-visited conversations.

---

### Arc Mode: Hitzone Too Narrow for Focused Satellite

**The problem:** In arc mode, the focused satellite button (directly left of Navigate) sat
at ~147px from the right edge, but the hitzone was only 96px wide. Moving the cursor toward
the button exited the hitzone at 96px, collapsing all buttons before the user could click.
Only occurred when no panel was open (panel-open state bypasses hover-based visibility).

**Root cause:** `orbUpdateHitzone()` computed a fixed width based on show-all layout geometry
(all dots near the center axis). Arc mode's `radius = 88` pushes the focused dot far beyond.

**Fix:** Made `orbUpdateHitzone()` mode-aware. Arc mode uses a wider hitzone
(`ORB_CX + 88 + 17 + HITZONE_PAD_X = 177px`) that covers the full arc radius plus the
focused dot's half-width. Show-all and wheel modes keep the original 96px width.
`orbUpdateHitzone()` is also called when the mode changes in Settings.

---

### Turn Counter Stale After SPA Navigation (Codex Review)

**The problem:** After SPA navigation to a new thread with fewer messages, the turn counter
and compaction dots stayed stale from the previous conversation. `updateTurnCounter()` has
`if (newTotal <= _turnCounter.totalTurns) return` — since the new conversation has fewer
messages, it returned early forever.

**Root cause:** SPA navigation handlers (`pushState`, `replaceState`, `popstate`) reset
`_questions = []` but did not reset `_turnCounter` or any SSE state.

**Fix:** Added `resetTurnCounter()` helper that zeroes all turn counter and SSE state.
Called in all three SPA handlers alongside `_questions = []`. Also added a shrinkage check
in `updateTurnCounter()` itself as a safety net: if `newTotal < _turnCounter.totalTurns`,
call `resetTurnCounter()`. For Claude users, SPA navigation also triggers
`_loadCachedSSEData()` to restore token data for the destination conversation.
```

---

## Files modified

- `ai-conversation-navigator.user.js` — all changes in this single file

## Files NOT modified

- `modules/` — reference files for Claude Code agent workflow, not live code
- `docs/CONTEXT-TRACKING.md` — original spec, already describes the correct architecture
- `tests/` — no changes needed (tests use data-acn-role contracts, not internal functions)
