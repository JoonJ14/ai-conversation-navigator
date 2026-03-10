# Troubleshooting

Platform-specific issues, root causes, and how they were resolved. Each entry follows the full diagnostic journey: what the problem looked like, why it was happening technically, what approach we chose and why, and how it resolved the issue.

If you run into a problem, check here first — you might find we've already solved it.

---

## v10.8 — Context Tracking Overhaul (2026-02-23)

Five bugs discovered through live production testing and static analysis. All fixed in commit `c45e88c` on branch `fix/v10-live-testing-polish`.

---

### RESOLVED — SSE Interceptor Had Never Worked in Production

**Versions affected:** v10.0 through v10.7.11
**Fixed in:** v10.8 | **Severity:** Critical | **Platforms:** Claude.ai only

**Symptom:** The context bar on Claude.ai always showed `(est.)` with DOM-estimated token counts, even after sending multiple messages in the same session. `_sseTokenData.exact` was never `true`. The feature appeared functional in code review — the function existed, it was called, it patched `window.fetch` — but produced no results.

**Diagnosis / Root Cause:**

The script header declared `@grant GM_addStyle`, `@grant GM_getValue`, `@grant GM_setValue`, `@grant GM_xmlhttpRequest`. When any `@grant` directive other than `none` is present, Tampermonkey isolates the userscript in a **sandboxed JavaScript environment**. In this sandbox, `window` is a Tampermonkey-managed wrapper object, not the actual browser page `window`.

`setupClaudeSSEInterceptor()` called `window.fetch = function acnFetchProxy(...)` — patching the sandbox wrapper's copy of `fetch`. Claude.ai's own JavaScript, which lives in the real page context, uses the **real** `window.fetch` exclusively. The monkey-patch never intersected with any actual network traffic.

The flag `window._acnFetchPatched = true` was set on the sandbox window. When checked in browser DevTools console (`window._acnFetchPatched`), DevTools operates in the real page context and returns `undefined` — confirming the flag was invisible to the page. Manually running `unsafeWindow.fetch = ...` from DevTools immediately intercepted SSE streams containing `input_tokens` data, proving the architecture was otherwise correct.

**Solutions Considered:**

1. **Script-tag injection into the page (alternative):** Inject a `<script>` element into the page DOM containing the fetch-patching code. Since injected script tags run in the real page context (not the sandbox), `window.fetch` inside the injected code would be the real fetch. *Rejected:* requires passing data back across the sandbox boundary (postMessage or a shared DOM attribute), which is fragile and asynchronous. The SSE data arrives rapidly and needs to update in-memory variables directly. A postMessage round-trip for every SSE event would introduce lag and complexity for no benefit.

2. **Remove `@grant` directives to use `none` mode (alternative):** Without any `@grant`, Tampermonkey doesn't sandbox the script, and `window` refers to the real page window. *Rejected:* the script depends on `GM_getValue`/`GM_setValue` for bookmarks persistence and the new GM cache. Removing `@grant` would break these features entirely.

3. **`unsafeWindow` (chosen):** Tampermonkey exposes `unsafeWindow` as a direct reference to the real page `window`. This is the intended mechanism for userscripts that need to interact with page-level globals. By adding `@grant unsafeWindow` and using `var pw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window`, the patch lands on the correct object.

**Fix:**

```javascript
function setupClaudeSSEInterceptor() {
    var pw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (typeof pw.fetch !== 'function') return;
    if (pw._acnFetchPatched) return;
    pw._acnFetchPatched = true;
    var _nativeFetch = pw.fetch.bind(pw); // .bind() preserves `this` on the real window
    pw.fetch = function acnFetchProxy(input, init) { ... };
}
```

Header addition: `// @grant unsafeWindow`. All references to `window` inside the function body replaced with `pw`. `_nativeFetch` now uses `.bind(pw)` to ensure the native fetch call has the correct `this` context.

**Results:** After this fix, `_sseTokenData.exact` becomes `true` after the first message sent in any Claude conversation. The context bar shows exact token counts with `(exact)` label. Compaction detection fires when `input_tokens` drops >40% across consecutive `message_start` events. The `(est.)` label now only appears for Claude conversations that have never received a message in any session with the script installed.

---

### RESOLVED — Non-Claude Platforms Showing Misleading Estimated Token Bar

**Versions affected:** v10.0 through v10.7.11
**Fixed in:** v10.8 | **Severity:** Medium | **Platforms:** ChatGPT, Grok, Gemini, Perplexity, app-builders

**Symptom:** On non-Claude platforms, the Navigate panel's context bar showed a filled percentage bar labeled `~12K / 128K tokens (est.)` alongside the turn-count dots. The percentage was not close to accurate — for a nearly full ChatGPT conversation it might read 15% when real usage was much higher.

**Diagnosis / Root Cause:**

`_renderEstimatedBar()` walks the conversation DOM and sums `innerText.length / 4` as a token estimate. This only captures text visible in the DOM. On non-Claude platforms, the invisible overhead is substantial:

- System prompts and injected instructions: never in DOM
- Tool call results (code interpreter output, search results): often in collapsed/hidden elements
- Search grounding data (Gemini): injected into model context, not rendered
- Historical context pre-loaded by the platform: not rendered at all

The 15–20× undercount claim in the original spec is accurate: `innerText / 4` reliably reads user messages and visible AI responses, which can be a tiny fraction of actual token usage in tool-heavy or search-augmented conversations. Showing a number with implied precision ("~12K") actively misleads users into thinking they have far more context headroom than they do.

**Solutions Considered:**

1. **Add a larger correction factor (alternative):** Apply a 2× or 3× multiplier to the estimate, or add fixed overhead by platform. *Rejected:* this makes the number slightly less wrong but still wrong. A 3× estimate of 36K is still far from 90K+. The number still implies false precision. Adding platform-specific fudge factors is unmaintainable (each platform uses different invisible overhead depending on conversation type). The v10.7.9 coverage-ratio approach already applies for virtual scroll platforms; there's no principled way to correct for invisible system prompts without SSE-level data.

2. **Keep the bar but label it more honestly (alternative):** Change `(est.)` to `(unreliable est.)` or show a warning tooltip. *Rejected:* this is a band-aid. The bar fills up and the number changes — both signal false precision. Users will read the number and use it to make decisions. No label changes the fact that the number can be wrong by an order of magnitude.

3. **Remove the percentage bar entirely for non-Claude (chosen):** Path C (non-Claude) clears `pct.textContent`, `fill.style.width = '0%'`, and `meta.textContent = ''`. Only turn dots remain. Turn dots + compaction prediction are honest signals: they tell users where they are in a compaction cycle, which is calibrated from actual observed compaction events, not an inaccurate token estimate.

**Fix:**

```javascript
// Path C — non-Claude: was
_renderEstimatedBar(pct, fill, meta, limit);   // removed
_renderTurnDots();
_renderTurnCompactionInfo();

// Now:
pct.textContent  = '';
fill.style.width = '0%';
if (meta) { meta.textContent = ''; }
_renderTurnDots();
_renderTurnCompactionInfo();
```

Section label changed in `orbBuildPanelNav()`:
```javascript
var ctxLabelText = (platform.id === 'claude') ? 'Context window' : 'Conversation turns';
```

**Results:** On non-Claude platforms, the Navigate panel shows only turn dots and compaction info — no misleading percentage bar. The section header reads "Conversation turns" rather than "Context window" (which falsely implied token tracking was happening).

---

### RESOLVED — Claude Context Bar Showed Estimate on Reload Even for Known Conversations

**Versions affected:** v10.0 through v10.7.11
**Fixed in:** v10.8 | **Severity:** Medium | **Platforms:** Claude.ai

**Symptom:** After reloading a Claude.ai page (or navigating away and back to the same conversation via SPA), the context bar immediately showed an estimated token count with `(est.)` label. Even if the user had sent 20+ messages in that conversation previously, the exact count was gone. The bar would only update to `(exact)` after sending a new message in the current page session.

**Diagnosis / Root Cause:**

`_sseTokenData` is a module-scoped JavaScript object initialized at script load time with `exact: false, inputTokens: 0`. There was no persistence. Every page load started from zero. The SSE interceptor only receives data from `message_start` events, which only fire when a new message is being generated. For an existing conversation that the user reloads to re-read or reference, no new message is sent, so `_sseTokenData` stays at its initialized values forever.

This caused Path B (DOM estimation with Claude-specific overhead correction) to run for all reloads of existing conversations, even ones where the user had seen exact data in a prior session.

**Solutions Considered:**

1. **Fetch from Claude API on load (alternative):** Make a `GM_xmlhttpRequest` to Claude's API to fetch the conversation's current token usage. *Rejected:* requires authentication token handling, dealing with Claude's session cookies and CSRF tokens, and is fragile to API changes. Also creates an extra HTTP request every page load. `@grant GM_xmlhttpRequest` is already declared but reserved for lighter uses.

2. **localStorage per-conversation (alternative):** Store token data in `localStorage` keyed by conversation ID. *Rejected:* `localStorage` is domain-scoped and accessible to the page JavaScript. While not a significant security concern for token counts, `GM_setValue` is scoped to the userscript itself and is a more appropriate isolation boundary. `localStorage` also doesn't survive clearing browser site data, whereas GM storage is tied to the extension.

3. **GM_setValue cache keyed by conversation UUID (chosen):** After each SSE `message_start` where `_sseTokenData.exact` becomes `true`, immediately write `{ inputTokens, outputTokens, timestamp }` to `GM_getValue('acn_ctx_cache', {})` under the conversation's UUID key. On script init (and 600ms after SPA navigation), check the cache for the current conversation ID and populate `_sseTokenData` with cached values if found. Mark with `cached: true` (not `exact: true`) so the UI labels it `(last known)` rather than `(exact)`.

**Fix:** See CHANGELOG 10.8 for full code. Key behavioral details:
- Cache key: `'acn_ctx_cache'` GM storage, JSON object of `{ [convId]: { inputTokens, outputTokens, timestamp } }`
- Conversation ID: last path segment of URL, validated by length > 8 and presence of `-` (UUID format check)
- Pruning: after each write, if cache has >50 keys, sort by timestamp descending, keep 50
- Labels: `(exact)` = live SSE this session, `(last known)` = from GM cache, `(est.)` = Path B DOM fallback
- Live data supersedes cache: when a new `message_start` fires, `cached = false` and `exact = true` are set before `_cacheSSEData()` runs

**Results:** On page reload, Claude conversations that received SSE data in any prior session immediately show their last known token count with `(last known)` label. The transition to `(exact)` happens the next time the user sends a message. Brand-new conversations (never visited with the script installed) still fall through to `(est.)`.

---

### RESOLVED — Arc Mode: Orbital Buttons Collapsed Before Cursor Could Reach Them

**Versions affected:** v10.0 through v10.7.11
**Fixed in:** v10.8 | **Severity:** High | **Platforms:** All orbital platforms (Claude, ChatGPT, Grok, Gemini, Perplexity) when arc mode is active

**Symptom:** In arc mode (not show-all or wheel), hovering over the orbital zone caused the satellite dots to expand into their arc arrangement. Moving the cursor leftward toward the focused satellite (directly left of the Navigate dot) caused all buttons to collapse before the cursor could reach the satellite. The user could see the satellite but not click it — moving toward it collapsed the UI. This did not happen when a panel was open.

**Diagnosis / Root Cause:**

The orbital hover system works via `#acn-hitzone` — a fixed-size invisible `<div>` positioned from the right edge. When `mouseenter` fires on the hitzone, `orbHovering = true` and `orbRender()` shows the dots. When `mouseleave` fires, `orbHovering = false` and `orbRender()` hides them (unless a panel is open, in which case `orbPanel !== null` bypasses the hover check).

`orbUpdateHitzone()` computed the hitzone width as:
```
hitzoneWidth = ORB_CX + 24 + HITZONE_PAD_X = 42 + 24 + 30 = 96px
```

This was designed for the show-all vertical layout, where all dots sit near the center axis (ORB_CX = 42px from right edge). In arc mode, the focused satellite is placed at angle 0° (directly left of center) at distance `radius = 88px`:

```
right offset of focused satellite leftmost pixel:
  ORB_CX = 42px (center axis from right)
  + radius × cos(0°) = 88px (full arc extension leftward)
  + dot half-width = 17px
  = 147px total from right edge
```

The hitzone boundary was at 96px from the right. The cursor crossed the boundary at 96px while still 51px away from the button, triggering `mouseleave` and collapsing the UI.

The panel-open case was unaffected because `if (orbPanel !== null) return;` early-exits the collapse logic in `handleExit()`.

**Solutions Considered:**

1. **Fixed wider hitzone for all modes (alternative):** Set hitzone width to 180px unconditionally. *Rejected:* over-extends the hover zone in show-all and wheel modes, capturing mouse events from unrelated page content. A 180px hitzone from the right edge on a narrowish panel layout would trigger orbital expansion while the user is reading text.

2. **Dynamic hitzone expansion triggered by arc render (alternative):** After `orbRenderArc()` positions each satellite, measure the leftmost dot's `getBoundingClientRect()` and resize the hitzone to match. *Rejected:* requires reading layout after render (forced synchronous layout if done immediately), and `orbRenderArc()` uses CSS `transform` so getBoundingClientRect doesn't work during transitions.

3. **Mode-aware width computation in `orbUpdateHitzone()` (chosen):** Read `orbMode` inside `orbUpdateHitzone()` and select width based on which geometry applies. `orbMode` is a module-scoped variable accessible to the function.

```javascript
var baseWidth = ORB_CX + 24 + HITZONE_PAD_X;       // 96px — show-all & wheel
var arcWidth  = ORB_CX + 88 + 17 + HITZONE_PAD_X;  // 177px — arc focused dot
var hitzoneWidth = (orbMode === 'arc') ? arcWidth : baseWidth;
```

Also added `orbUpdateHitzone()` call at the end of `orbSetMode()`, ensuring geometry updates when the user switches modes in Settings. Previously `orbUpdateHitzone()` only ran on `window.resize` and once during initial injection.

**Results:** In arc mode, the cursor can move smoothly from the center Navigate dot to the focused satellite and click it. Show-all and wheel modes maintain their narrower 96px hitzone.

---

### RESOLVED — Turn Counter and Compaction Dots Stale After SPA Navigation to Shorter Thread

**Versions affected:** v10.0 through v10.7.11
**Fixed in:** v10.8 | **Severity:** High | **Platforms:** All SPA platforms (claude.ai, chatgpt.com, gemini.google.com, etc.)

**Symptom:** After clicking a different conversation in the sidebar (triggering SPA navigation), the turn dots in the Navigate panel continued showing the message count and compaction state from the previous conversation. If the old conversation had 25 messages and the new one had 5, the dots showed 25 messages. The badge numbers never updated. This persisted indefinitely — refreshing the page fixed it, but SPA navigation did not.

**Diagnosis / Root Cause:**

SPA navigation handlers (`pushState`, `replaceState`, `popstate`) were installed at startup:

```javascript
history.pushState = function () {
    _origPushState.apply(this, arguments);
    if (isVirtualScroll) _vsAccumulatedKeys.clear();
    _questions = [];
    if (typeof orbClosePanel === 'function') orbClosePanel();
    setTimeout(scanConversation, 500);
    if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
};
```

`_questions = []` clears the detected question list. After 500ms, `scanConversation()` detects the new conversation's messages and populates `_questions[]` again. So far correct.

However, `_turnCounter` was never reset. After `scanConversation()` completed for the new 5-message conversation, `orbOnScanComplete()` called `updateTurnCounter()`:

```javascript
function updateTurnCounter() {
    var newTotal = _questions.length;              // 5 (new conversation)
    if (newTotal <= _turnCounter.totalTurns) return; // 5 <= 25 → return immediately
    ...
}
```

The guard `newTotal <= _turnCounter.totalTurns` was designed to prevent re-counting on MutationObserver-triggered scans (which fire every 500ms even when no new messages have been added). This guard correctly handles the "same conversation, no new messages" case — but it also incorrectly handles the "new conversation with fewer messages" case. Both look the same from `updateTurnCounter()`'s perspective: `newTotal < totalTurns`.

The compaction history, cycle lengths, and predicted cycle length from the old conversation were also retained, making compaction dots reflect the wrong conversation.

**Solutions Considered:**

1. **Add a "navigation token" that invalidates the counter (alternative):** Increment a generation counter on each SPA navigation; `updateTurnCounter()` resets if the generation has changed since the last call. *Rejected:* adds a global state variable that's easy to forget to update. The shrinkage detection (`newTotal < totalTurns`) approach is self-contained — it detects the symptom (shrinkage) directly without depending on a separate signal being set correctly in multiple places.

2. **Only fix the SPA handlers (not `updateTurnCounter`) (alternative):** Reset `_turnCounter` only in the three SPA handlers, leaving `updateTurnCounter()` unchanged. *Rejected:* misses edge cases where a conversation grows, then shrinks (e.g., if the user deletes messages). More importantly, `updateTurnCounter()` without the shrinkage guard could corrupt state if the SPA handler somehow fires after the first partial scan of the new conversation. Defense in depth is better.

3. **Both SPA handler reset AND shrinkage guard in `updateTurnCounter()` (chosen):** Reset in the SPA handlers for correct timing (immediate reset before the new scan), plus the shrinkage guard in `updateTurnCounter()` as a defensive safety net for any missed reset path.

**Fix:**

```javascript
// resetTurnCounter() zeroes all turn counter + SSE state:
function resetTurnCounter() {
    _turnCounter.totalTurns           = 0;
    _turnCounter.turnsSinceCompact    = 0;
    _turnCounter.compactionCount      = 0;
    _turnCounter.cycleLengths         = [];
    _turnCounter.predictedCycleLength = null;
    _turnCounter.lastCompactTurn      = 0;
    // Reset SSE too — new conversation has different token counts
    _sseTokenData.inputTokens  = 0;
    _sseTokenData.outputTokens = 0;
    _sseTokenData.lastUpdated  = 0;
    _sseTokenData.exact        = false;
    _sseTokenData.cached       = false;
    _prevInputTokens           = 0;
    _compactionCount           = 0;
    _compactionHistory         = [];
}

// Shrinkage guard in updateTurnCounter():
function updateTurnCounter() {
    var newTotal = _questions.length;
    if (newTotal < _turnCounter.totalTurns) {  // shrinkage = new conversation
        resetTurnCounter();
    }
    if (newTotal <= _turnCounter.totalTurns) return;
    ...
}
```

Each SPA handler also fires `_loadCachedSSEData()` 600ms after navigation (for Claude users), restoring cached token data for the destination conversation.

**Results:** After SPA navigation to any conversation, turn dots immediately reflect the new conversation's message count on the next `orbOnScanComplete()` cycle (500ms after navigation). Compaction prediction resets. For Claude users, context bar shows `(last known)` cached data if available.

---

## v10.7.x — Live Testing Polish (2026-02-23)

Eight bugs discovered and resolved during Tampermonkey live testing on claude.ai. All fixed in the `fix/v10-live-testing-polish` branch (v10.7.4 through v10.7.11).

---

### RESOLVED — Search and Bookmarks Panels Flickering on Hover

**Versions affected:** v10.7.0–v10.7.6
**Fixed in:** v10.7.7 | **Severity:** High | **Platforms:** All orbital platforms

**Symptom:** When the Search or Bookmarks panel was open, hovering over items caused them to flicker — list items would disappear and reappear, making it impossible to hover-select or click stably. Navigate panel was unaffected.

**Diagnosis / Root Cause:** `orbOnScanComplete()` fires after every `scanConversation()` call, which is debounced 500ms from `MutationObserver`. Live AI platforms continuously mutate their DOM (streaming tokens, animations, typing indicators), so `orbOnScanComplete()` fires roughly every 500ms. When Search or Bookmarks panel was open, the handler called `orbPopulateSearch()` and `orbRefreshBookmarksPanel()` unconditionally. Both functions began by removing all child nodes from the list container (`while (list.firstChild) list.removeChild(list.firstChild)`), then rebuilding from scratch. This DOM teardown cancelled any active `:hover` and `mouseenter` state on every item, approximately twice per second.

Navigate panel already had a `_navListFingerprint` guard that prevented rebuild if the question list hadn't changed. Search and Bookmarks had no such guard.

**Fix:** Added fingerprint guards:

```javascript
// Search panel — fingerprint: query string + question count + AI response count
var sfp = q + '|' + _questions.length + '|' + (_aiResponses ? _aiResponses.length : 0);
if (sfp === _searchListFingerprint && list.firstChild) return;
_searchListFingerprint = sfp;

// Bookmarks panel — fingerprint: joined bookmark IDs
var bfp = bookmarks.map(function(b) { return b.id; }).join('|');
if (bfp === _bmListFingerprint && panel.children.length > 1) return;
_bmListFingerprint = bfp;
```

If neither the data nor the list content has changed, the rebuild is skipped entirely. Hover state is never interrupted unless the underlying data actually changes.

**Result:** Search and Bookmarks panels are stable on hover. Rebuilds only occur when bookmarks are added/removed or when the search query or message count changes.

---

### RESOLVED — Full Conversation Export Failing Silently

**Versions affected:** v10.7.0–v10.7.6
**Fixed in:** v10.7.7 | **Severity:** High | **Platforms:** Claude.ai

**Symptom:** Clicking "Export Full Conversation" in the Tools panel showed a toast: "Export failed — see console." No file was downloaded. Console showed: `TypeError: (node.className || "").toLowerCase is not a function at isUIChrome`.

**Diagnosis / Root Cause:** `exportFullConversation()` calls `extractMarkdownContent()` which walks every DOM node in user and AI messages. The `isUIChrome()` helper function filtered out UI elements using `node.className.toLowerCase()`. For standard HTML elements, `className` is a plain string. However, Claude.ai's UI uses inline SVG elements extensively (icons in message toolbars, reaction buttons, etc.). On SVG elements, `className` is an `SVGAnimatedString` object — not a string — and has no `.toLowerCase()` method. The call threw a `TypeError`, which was caught by the outer try-catch, showing the generic "Export failed" toast instead of the actual error.

**How it was found:** Console inspection via `mcp__claude-in-chrome__read_console_messages` with pattern `error|TypeError` revealed the exact error message and stack trace pointing to `isUIChrome`.

**Fix:**
```javascript
// Before (crashes on SVG elements):
var cls = node.className.toLowerCase();

// After (handles SVGAnimatedString):
var rawCls = node.className;
var cls = (typeof rawCls === 'string' ? rawCls : (rawCls && rawCls.baseVal) || '').toLowerCase();
```

**Result:** Export now works correctly on Claude.ai, handling SVG icon elements in message containers without crashing.

---

### RESOLVED — Active Bookmark Icon Disappears on Hover

**Versions affected:** v10.7.0–v10.7.6
**Fixed in:** v10.7.7 | **Severity:** Medium | **Platforms:** All platforms

**Symptom:** When a message had been bookmarked (orange flag icon visible), hovering the cursor over the bookmark icon made it lose its orange color and become nearly invisible.

**Diagnosis / Root Cause:** CSS specificity tie between `.acn-bm-icon.acn-bm-active` and `.acn-bm-icon:hover`. Both rules have specificity (0,2,0) — two class selectors each. In CSS, when two rules have identical specificity, the later-declared rule wins. `.acn-bm-icon:hover` appeared after `.acn-bm-icon.acn-bm-active` in the stylesheet, so on hover the `.acn-bm-icon:hover` rule overrode the orange `.acn-bm-active` background with `rgba(255,255,255,0.2)`.

**Fix:** Added a combined selector with higher specificity:
```css
/* Specificity (0,3,0) — beats (0,2,0) — keeps orange on hover */
.acn-bm-icon.acn-bm-active:hover { background:var(--acn-accent); filter:brightness(1.2); }
```

Three-class specificity always beats two-class, regardless of declaration order.

---

### RESOLVED — Non-Active Bookmark Icon Invisible on Direct Hover

**Versions affected:** v10.7.0–v10.7.10
**Fixed in:** v10.7.11 | **Severity:** Medium | **Platforms:** Platforms with light-colored page backgrounds (Claude.ai, ChatGPT)

**Symptom:** When a message had NOT been bookmarked yet, hovering the cursor directly over the flag icon made it visually disappear. The browser tooltip ("Bookmark this message") still showed, confirming the element existed — it was optically invisible, not removed from the DOM.

**Diagnosis / Root Cause:** CSS color camouflage. Default bookmark icon: `background: rgba(0,0,0,0.3)` (dark) with `color: rgba(255,255,255,0.5)` (white flag). On hover, `.acn-bm-icon:hover` changed background to `rgba(255,255,255,0.2)` (light). On Claude.ai's off-white/cream page background, a container with 20% white opacity becomes nearly transparent. The white flag glyph on a near-white background = invisible. The element had `opacity:1` (not transparent) but was optically camouflaged.

**Fix:** Changed hover background to a darker shade that works against any page background:
```css
/* Before — camouflages on light backgrounds */
.acn-bm-icon:hover { opacity:1; background:rgba(255,255,255,0.2); }

/* After — visible on any background */
.acn-bm-icon:hover { opacity:1; background:rgba(0,0,0,0.55); color:#fff; }
```

---

### RESOLVED — Context Window Bar Showing 45% for Maxed-Out Conversation

**Versions affected:** v10.7.0–v10.7.9
**Fixed in:** v10.7.10 | **Severity:** Medium | **Platforms:** Claude.ai (extended thinking)

**Symptom:** A Claude Opus 4.6 Extended Thinking conversation that had physically exhausted the 200K token context limit (Claude was unable to generate further responses) displayed only 45% (~90K/200K tokens) in the Navigate panel's context window bar.

**Investigation path:**

1. **Virtual scroll hypothesis (ruled out):** First suspected that Claude.ai's virtual scroll was hiding older messages from the DOM, causing the `innerText`-based estimate to capture only half the conversation. Investigated by measuring the scrollable container: `scrollHeight=98,393px` vs `clientHeight=652px`. This confirmed all content was in the DOM. DOM element count via `document.body.contains(q.element)` for all 83 questions confirmed all were present.

2. **Extended thinking blocks identified:** Queried `[aria-expanded]` elements within the conversation container. Found **161 thinking block summaries** (e.g., "Examined repository state to assess project progress...") — approximately 1.94 per response. These collapsed summaries represent extended thinking content that Claude generates but claude.ai renders as a short summary phrase only. The full thinking content (~683 tokens per block average) is never placed in the DOM.

3. **System prompt identified:** Claude.ai injects a system prompt of approximately 15,000 tokens into every conversation context. This is also never rendered in the page DOM.

**Token breakdown:**
- Visible DOM text: 90K tokens (360K chars ÷ 4)
- System prompt: +15K (always)
- 161 thinking blocks × 600 tokens: +96.6K
- **Total: ~201.6K → 100%** (correctly shows red/maxed)

**Fix:** See `docs/claude_specific_context_tracking_calculation.md` for full technical details. The estimation function now adds Claude-specific invisible overhead when on claude.ai: system prompt (+15K) and thinking block count × 600.

**Note:** For Path A (Claude with active SSE token data), the exact `input_tokens` from the API is used and is unaffected by this fix. This fix improves Path B estimation for historical/revisited conversations where no new generation has occurred in the current page session.

---

## v10.0 — Panel Hover Fixes (2026-02-22, session 3)

Three related bugs in Navigate panel hover behavior, all discovered through live site testing. All resolved in the same session.

---

### RESOLVED — Q# Badge Color and Hover Highlight Show as White (CSS Variable Scoping)

**Versions affected:** v10.0 (after question list readability improvements)
**Fixed in:** v10.0 session 3 | **Severity:** High | **Platforms:** All 5 orbital platforms

**Symptom:** In the Navigate panel, the `Q#1`/`Q#2`/`Q#3` number badges appeared white instead of the platform accent color. The hover highlight — both the left-border color transition (`border-left-color: var(--acn-accent)`) and the background tint (`background: rgba(var(--acn-rgb), .14)`) — was also invisible. The question list was technically functional (items rendered, click worked) but visually undifferentiated.

**Diagnosis / Root Cause:** Platform accent colors are distributed via CSS custom properties `--acn-accent` and `--acn-rgb`. These were set using `zone.style.setProperty()` on the `#acn-zone` element. CSS custom properties only cascade *down* to descendants. The critical architecture detail: `#acn-zone` and all `.acn-panel` elements are siblings — both are direct children of `document.body`:

```javascript
document.body.appendChild(zone);              // line 2061
document.body.appendChild(orbBuildPanelNav()); // line 2064 — sibling, not child
```

Since the panels are siblings (not descendants) of `#acn-zone`, `var(--acn-accent)` and `var(--acn-rgb)` inside panel CSS resolved to nothing. The browser falls back to the CSS initial value for each property — `background: transparent` and `border-left-color: currentColor` (which was white in the dark panel) — making the styles silently invisible rather than producing an error.

This design was introduced without issue in v10.0 because the orbital dots and zone children (`#acn-hitzone`, `.acn-lbl`, `.acn-dot`) are actual descendants of `#acn-zone` and inherited correctly. Only panel-specific styles (`.acn-qi:hover`, `.acn-qn`) using `var(--acn-*)` were affected, and these were added as a visual polish feature late in the session.

**Solutions Considered:**

*Approach 1: Move panel elements inside `#acn-zone` in the DOM.* Insert all 6 `.acn-panel` elements as children of the zone rather than appending them to `document.body`. Hypothesis: this restores normal CSS inheritance and resolves the scoping problem at the root. Rejected because: the z-index stacking context would change — panels are currently at `z-index:2147483641` which is above the zone's `z-index:2147483640`. Moving panels inside the zone makes them children within the zone's stacking context; achieving `641` above `640` while inside the same stacking context parent requires careful re-validation across all 14 platforms and all positioning code. The risk was higher than the benefit.

*Approach 2: Set CSS variables directly on each panel element after creation.* After `orbBuildPanelNav()` returns, call `panelEl.style.setProperty('--acn-accent', orbTheme.bg)` on each panel. Hypothesis: variables set on the element itself have higher cascade priority than any inherited value, so this would work regardless of panel position in the DOM. Rejected as verbose: 6 panels × 3 variables = 18 `setProperty` calls, plus the same 18 calls must be re-applied if a future session re-injects panels without re-running `orbBuildZone()`.

*Approach 3: Set CSS variables on `document.documentElement` (`:root`).* Variables on `:root` are globally available to every element on the page — no scoping restriction. Keep the zone-level assignments as well (zone children already use them correctly). Add 3 lines to `orbBuildZone()`.

**Fix:** Approach 3 — add `:root`-level assignments in `orbBuildZone()` before the zone-level assignments:
```javascript
document.documentElement.style.setProperty('--acn-accent', orbTheme.bg);
document.documentElement.style.setProperty('--acn-rgb',    orbTheme.rgb);
document.documentElement.style.setProperty('--acn-shadow', orbTheme.shadow);
zone.style.setProperty('--acn-accent', orbTheme.bg);
// ...
```

The zone-level assignments are retained because they provide a more scoped cascade for dot/zone child styling, and their presence makes it clear the zone is the authoritative owner of its theming even if the root-level value is also available.

**Results:** Q# badges display in platform accent color. Hover background tint and left-border color transition correctly. 168/168 tests pass.

---

### RESOLVED — `.acn-qi:hover` Hover Jitter (translateX Bounding Box Loop)

**Versions affected:** v10.0 (after question list readability improvements)
**Fixed in:** v10.0 session 3 | **Severity:** Medium | **Platforms:** All 5 orbital platforms

**Symptom:** When holding the cursor still over a question item in the Navigate panel, the left-border highlight flickered on and off at a rapid, regular rate — approximately every 150ms. The highlight would flash, disappear, then reappear on re-hover. Described as "tweaks like every second" by the user.

**Diagnosis / Root Cause:** The `.acn-qi:hover` rule applied `transform:translateX(2px)`. CSS `transform` repositions the element visually without changing layout flow, but it *does* change the element's rendered bounding box — and the browser uses the rendered bounding box for hover hit-testing. The feedback loop:

1. Cursor enters `.acn-qi` at position X → hover fires → `translateX(2px)` shifts the rendered box 2px right
2. Rendered box is now 2px right of cursor position → cursor is outside the hit area → hover lost
3. Transition reverses (`.15s` transition) → element returns to original position → cursor is inside → hover fires
4. Repeat every ~150ms (the transition duration)

This is a known hover-jitter antipattern. Any `transform` that changes the element's rendered position on hover creates an unstable equilibrium at the boundary of the original hit area.

**Diagnosis path:** The jitter was initially suspected to be caused by orbital dots overlapping the panel during animation (z-index conflict). This was investigated by reading the zone CSS (`right:0; width:160px; z-index:2147483640`) and panel CSS (`right:0; width:310px; z-index:2147483641`). When the panel opens, `acn-hp` adds `right:310px` to the zone — the zone slides left so its right edge is at `window.innerWidth - 310px`, flush with the panel's left edge but not overlapping it. The z-index investigation confirmed the panel (641) is above the zone (640), so dots don't intercept panel pointer events. This ruled out z-index as the cause. The `translateX` feedback loop was then identified as the actual mechanism.

**Solutions Considered:**

*Approach 1: Keep translateX but apply it on a wrapper element.* Wrap each `.acn-qi` in an outer div; apply `translateX` to the outer div while the hover target remains the inner div. The inner div never moves, so its hit area is stable. Rejected as over-engineered: adding a wrapper div to every list item for this single visual effect adds DOM nodes and complicates the item structure.

*Approach 2: Use `translateX` but only apply it after a delay (`:hover:active` or JS-based).* Apply the translate only on `mousedown`, not `mouseover`. Hypothesis: user has clicked by then, so bounding box jitter doesn't matter. Rejected because: the visual intent was to show translate on hover (mouse-over), not click. Changing to click semantics changes the intended interaction model.

*Approach 3: Remove `translateX` entirely.* The background tint and border-left color change on hover already provide clear feedback. The `translateX` was purely decorative — a subtle "lift" animation. Without it, the hover state is still clearly visible and perfectly stable.

**Fix:** Approach 3 — removed `transform:translateX(2px)` from `.acn-qi:hover`:
```css
/* Before */ .acn-qi:hover { background:rgba(var(--acn-rgb),.14); border-left-color:var(--acn-accent); transform:translateX(2px) }
/* After  */ .acn-qi:hover { background:rgba(var(--acn-rgb),.14); border-left-color:var(--acn-accent) }
```

**Results:** Hover highlight is stable. Background tint and border-left-color transition cleanly on enter/leave without any jitter. The `transition:all .15s` on `.acn-qi` still smoothly animates both remaining properties.

---

### RESOLVED — Nav Panel Question List Rebuilds on Every SPA Mutation (Hover Destroyed)

**Versions affected:** v10.0 (all orbital sessions)
**Fixed in:** v10.0 session 3 | **Severity:** Medium | **Platforms:** All 5 orbital platforms (worst on high-animation platforms: Gemini, Claude)

**Symptom:** After fixing the CSS variable scoping and removing `translateX`, the hover highlight still flickered. On closer observation: the highlight would appear correctly on hover entry, hold for approximately 500ms, then disappear — regardless of cursor movement. Moving the cursor back onto the same item would restore the highlight for another ~500ms before it disappeared again. This was not the 150ms jitter from `translateX`; it was a longer, less predictable cycle.

**Diagnosis / Root Cause:** `orbPopulateNavigate()` began with unconditional DOM teardown:
```javascript
while (list.firstChild) list.removeChild(list.firstChild);
```

It was called every time `orbOnScanComplete()` ran. `orbOnScanComplete()` was called at the end of every `scanConversation()` execution when `orbPanel === 'nav'`. `scanConversation()` was called by the MutationObserver callback after a 500ms debounce. The MutationObserver watched `document.body` with `{ childList: true, subtree: true }`.

The chain: **any DOM mutation on the page → 500ms debounce → `scanConversation()` → `orbOnScanComplete()` → `orbPopulateNavigate()` → all `.acn-qi` elements destroyed and re-created**.

Live AI platforms mutate the DOM continuously: Gemini's button hover effects, animated type indicators, streaming responses, sidebar item updates. On a static conversation (no new messages), `scanConversation()` was re-running every 500ms because the platform's UI — unrelated to the conversation content — was generating mutations. Each rebuild destroyed the currently-hovered element, causing the browser to drop its `:hover` state. New elements created by the rebuild had no hover state.

The 500ms debounce explained the user's observed "about 500ms" cycle time. The user would hover → highlight appears → 500ms later Gemini does something → observer fires → list tears down → hover lost → user moves cursor → hover appears again.

**Solutions Considered:**

*Approach 1: Don't call `orbOnScanComplete()` during observer-triggered scans, only during user-action scans.* Pass a flag through the call chain — `scanConversation(triggered_by_user)` — and skip the panel update when triggered by the observer. Rejected because: new messages ARE mutations, and the observer is the only mechanism for detecting them. Skipping the panel update means the list never updates after a new message unless the user manually refreshes.

*Approach 2: DOM diffing — update items in place, only add/remove changed questions.* For each entry in `_questions[]`, find the existing DOM element (by index or key) and update only if changed; add new elements at the end; remove stale elements. Rejected for now: requires a stable key system for matching old elements to new entries. `_questions[]` entries currently have no stable ID — the index changes if a question is prepended. Implementing stable keys correctly is a larger change than the problem warrants, since questions in a conversation rarely change after creation.

*Approach 3: Increase the scan debounce from 500ms to 2000ms.* Reduce rebuild frequency. Rejected because: this makes the list feel stale after the user sends a new message — the panel wouldn't update for 2 seconds.

*Approach 4: Fingerprint-gated rebuild — compare question content before rebuilding.* Compute a lightweight fingerprint of `_questions[]`. If identical to the fingerprint from the last render, skip teardown. The fingerprint changes only when new questions are added, not on platform UI mutations.

**Fix:** Approach 4. Added `_navListFingerprint = ''` module variable. At the start of `orbPopulateNavigate()`:

```javascript
var fp = _questions.map(function (q) { return q.text.substring(0, 100); }).join('|');
if (fp === _navListFingerprint && list.firstChild) return;
_navListFingerprint = fp;
```

The fingerprint uses the first 100 characters of each question's text (sufficient to distinguish questions; trimmed to avoid generating multi-KB strings for long prompts). The `&& list.firstChild` guard forces a rebuild if the list is somehow empty even when the fingerprint matches (e.g., after a DOM flush from a SPA navigation). If questions genuinely change (new message → new `_questions[]` entry), the fingerprint changes and the rebuild proceeds normally.

**Results:** On live Gemini with a 3-question conversation, hovering over any question item shows a stable, persistent highlight. Platform UI mutations (button animations, etc.) no longer cause list rebuilds. New questions added by sending a new message still appear immediately in the list (next scan cycle ≈ 500ms). 168/168 tests pass.

---

## v10.0 — Issues Found and Fixed Through Live Site Testing (2026-02-22)

These issues were discovered by testing v10.0 on live sites after the orbital system shipped. All were resolved in the same session.

---

### RESOLVED — isLeftChat Button Stays Fixed When Panel Opens

**Versions affected:** v10.0 initial
**Fixed in:** v10.0 session 2 | **Severity:** High | **Platforms:** All 7 left-chat platforms (Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio)

**Symptom:** On all app-builder platforms using the `left-chat` layout, clicking the ghost-notch toggle button correctly opened the 320px panel on the left — but the button itself stayed at its original position at the chat/preview boundary. The button ended up visually inside the open panel, stranded rather than flush with the panel's left edge.

**Diagnosis / Root Cause:** The isLeftChat button container position is managed entirely by JS inline styles — `legacyApplyPosition()` computes `right = window.innerWidth - _lastBoundaryX + scrollbarOffset` and sets it as `container.style.right`. This is necessary because the boundary is detected dynamically and differs per platform and viewport width.

The `.open` CSS class existed on the container during the open state, but that class only set `pointer-events: auto`. It never modified `right`. The problem is that CSS rules can't modify an inline `style.right` that was already set by JS with a computed value — a CSS class can override with `!important`, but the target `right` value when open isn't a constant; it's `(innerWidth - boundaryX + 320)` which varies per viewport. There was simply no mechanism for CSS alone to express "add 320px to the current dynamically-computed right."

**Solutions Considered:**

*Approach 1: Use a CSS transform instead of right for the open offset.* Add `transform: translateX(320px)` when open. Hypothesis: CSS `transform` doesn't conflict with `right`, so the class could apply the offset independently. Rejected because: the button is already `transform: translateY(-50%)` for vertical centering. Stacking `translateX(320px)` on top of this would require either a combined `transform` (breaking the centering) or a wrapper element (adding DOM complexity).

*Approach 2: Use a CSS custom property for the boundary position.* Set `--acn-boundary: Npx` on the zone, then express the full formula in CSS. Hypothesis: this would allow CSS classes to perform the calculation. Rejected because: this approach would work for the zone element itself but not for the legacy button container, which is a separate element outside the zone (injected independently by `injectLegacy()`).

*Approach 3: Update inline `style.right` directly in JS at toggle time.* When `legacyNavOpen` becomes true, set `container.style.right = (innerWidth - boundaryX + 320) + 'px'`. When it becomes false, restore the closed-state formula. This is the simplest and most direct approach — JS already manages this element's position, so adding state-conditional logic fits the existing pattern.

**Fix:** Approach 3 was implemented across 4 code sites where the open/closed transition occurs:
1. `handleLegacyToggle()` open branch
2. `handleLegacyToggle()` close branch
3. Close button click handler in `injectLegacy()`
4. DOM guardian (MutationObserver re-injection callback)

All four now call `container.style.right = (window.innerWidth - _lastBoundaryX + 320) + 'px'` on open and restore the closed formula on close.

**Results:** Button correctly tracks with the panel's left edge on open and returns to the chat boundary on close. All 168 tests still pass.

---

### RESOLVED — Bolt.new Button Overshoots 16px Past Panel Left Edge

**Versions affected:** v10.0 initial
**Fixed in:** v10.0 session 2 | **Severity:** Medium | **Platforms:** Bolt.new only

**Symptom:** After the isLeftChat sync fix was applied, testing on Bolt specifically showed the button landing about 16px further left than the panel's left edge. The button appeared to poke out from behind the panel rather than sitting flush.

**Diagnosis / Root Cause:** `legacyApplyPosition()` computes:
```javascript
var offset  = platform.scrollbarOffset || 0; // 16 for bolt
var btnRight = (window.innerWidth - _lastBoundaryX + offset) + 'px';
```

Bolt has `scrollbarOffset: 16`. When the panel-open state check was added to `legacyApplyPosition()`, it used a single formula for both states:
```javascript
// Incorrect — applies offset in open state too
container.style.right = panelOpen
    ? (window.innerWidth - _lastBoundaryX + offset + 320) + 'px'
    : btnRight;
```

The `scrollbarOffset` exists to push the closed button inward from the exact boundary edge so it doesn't sit behind the OS scrollbar (which is drawn on the right side of the chat panel on some OSes). In Bolt's case, the scrollbar is 16px wide, so the offset keeps the button clear of it. But this offset has no meaning in the open state — when open, the button is positioned relative to the panel's left edge, not the chat/scrollbar boundary. The 16px offset was incorrectly applied to the open formula.

**Solutions Considered:** No alternatives were seriously considered — this was a straightforward misunderstanding of when `scrollbarOffset` applies. The only question was whether the fix belonged in `legacyApplyPosition()` alone or also in `handleLegacyToggle()`. Both were checked and both required the same correction.

**Fix:** Open-state formula in both `legacyApplyPosition()` and `handleLegacyToggle()` uses `(window.innerWidth - _lastBoundaryX + 320)` — no `offset`. Closed-state formula retains `+ offset`. The two formulas are now unambiguously different for different purposes.

**Results:** Bolt button lands flush with the panel's left edge on open. Other platforms unaffected (their `scrollbarOffset` is 0 by default, so the formulas were equivalent before).

---

### RESOLVED — V0 Toggle Button Invisible in Light Mode

**Versions affected:** v10.0 initial
**Fixed in:** v10.0 session 2 | **Severity:** High | **Platforms:** V0 (`v0.app`)

**Symptom:** On v0.app in light mode, the toggle button was present (boundary detection succeeded, the button was in the DOM) but completely invisible. Neither the button shape nor the icon inside it was visible.

**Diagnosis / Root Cause:** Two bugs compounded:

Bug 1 — Theme missing `textColor`: V0's theme object was:
```javascript
theme: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)' }
```
The button background was `theme.accent = '#ffffff'` (white). The icon color used `theme.textColor || '#fff'`, which resolved to `'#fff'` since `textColor` wasn't set. White icon on white background = invisible.

Bug 2 — `border:none!important` hardcoded in CSS string: Even if Bug 1 were fixed by giving the button a dark icon, the button itself (a thin 14×52px sliver in closed state) would still be invisible on a white background without a border. V0's theme needed `toggleBorder: '1px solid rgba(0,0,0,0.2)'` to make the button visible. But the isLeftChat button CSS string contained:
```javascript
'.ai-nav-floating-btn{...border:none!important;...}'
```
The `!important` meant any `theme.toggleBorder` value would have been overridden silently. The theme property would exist but never be applied.

**Solutions Considered:**

*Approach 1: Use a platform-specific CSS block for V0, similar to how ChatGPT gets a special `data-acn-platform` CSS block.* Hypothesis: would work, but requires adding V0-detection logic and a separate CSS string just to handle border and icon color. Rejected as over-engineered — the theme system already exists to handle per-platform visual customization.

*Approach 2: Change V0's accent color to something other than white.* Hypothesis: a dark accent (like `#1a1a1a` or the app's actual UI color) would make button and icon visible. Rejected because: V0 is a left-chat platform, not an orbital platform. The "accent" color drives the button background. Choosing a dark button that doesn't match V0's actual brand color is arbitrary and inconsistent with the approach used for other platforms.

*Approach 3: Fix the theme system — add `textColor` and `toggleBorder` to V0's theme, AND change the CSS string to use `theme.toggleBorder` instead of hardcoding `none`.* This addresses both bugs at the root: the theme system becomes the single control surface for per-platform visual customization, and the hardcoded override is removed.

**Fix:** Approach 3:
```javascript
theme: {
    accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)',
    textColor: '#000',
    toggleBorder: '1px solid rgba(0,0,0,0.2)',
}
```

And the CSS string changed from `'border:none!important'` to `'border:' + (theme.toggleBorder || 'none') + '!important'`. The `|| 'none'` default ensures all other left-chat platforms that don't set `toggleBorder` continue to have no border.

**Results:** V0 button is now visible in both light and dark mode — dark icon on white button with a subtle grey border. Other left-chat platforms unaffected.

---

### RESOLVED — Context Window Bar Always Shows "—"

**Versions affected:** v10.0 initial
**Fixed in:** v10.0 session 2 | **Severity:** Medium | **Platforms:** All orbital platforms

**Symptom:** The context window usage bar in the Navigate panel always showed "—" for the percentage and a 0% fill bar, regardless of conversation length.

**Diagnosis / Root Cause:** `orbPopulateNavigate()` built the DOM elements for the context bar (`#acn-ctx-pct`, `#acn-ctx-fill`, `#acn-ctx-meta`) but never updated them. The function was a complete stub — the bar elements were injected but never written to.

**Solutions Considered:**

*Approach 1: Read token count from the API response.* Hypothesis: modern Claude/ChatGPT APIs return token usage in response headers or JSON. Intercept `window.fetch` and read the usage field. Rejected because: fetch interception was used in v9.x's context tracking feature and was one of the causes of architectural complexity. The v10.0 rewrite explicitly removed fetch interception. Re-introducing it would reintroduce the same entanglement that prompted the rewrite. Also, the AI assistant sites don't consistently expose token counts in client-accessible responses.

*Approach 2: Count only user message characters and multiply by a factor.* Sum `q.text.length` for all items in `_questions[]` and multiply by 3. Fast and zero-DOM-side-effects. Implemented as initial approach. Problem: wildly inaccurate for conversations with short user questions and very long AI responses. A user who types 5-word questions and gets 2,000-word answers would see a 3× undercount.

*Approach 3: Walk up the DOM from a known message element to the conversation scroll container.* From `_questions[0].element`, walk up through `.parentElement` until finding a node with `overflow-y: auto` or `overflow-y: scroll`. This container holds the full conversation. Read its `innerText.length`. This is more accurate because `innerText` includes both user AND AI message text.

**Fix:** `orbUpdateContextBar()` implements Approach 3 with Approach 2 as fallback:
- Walks from `_questions[0].element` to the scroll container
- Reads `innerText.length` for total character count
- Falls back to `_questions.reduce(...) * 3` if no scroll container found
- Divides by 4 to estimate tokens (standard English heuristic)
- Compares against `CTX_LIMITS[platform.id]` for the percentage
- Color-codes: green <50%, amber 50–74%, red ≥75%

Called at the end of `orbPopulateNavigate()` so it runs every time the Navigate panel is opened or refreshed.

**Results:** Context bar now shows real percentage estimates. On a medium-length conversation, the bar shows reasonable values that track with conversation growth.

---

### RESOLVED — Arc Mode Labels Overlap Adjacent Dots

**Versions affected:** v10.0 initial
**Fixed in:** v10.0 session 2 | **Severity:** Low | **Platforms:** All orbital platforms (arc mode only)

**Symptom:** In arc mode, hovering over an orbital dot caused its label to appear to the left — in the direction of adjacent dots on the arc. Dots near each other on the arc would have their labels overlap each other, creating visual clutter.

**Diagnosis / Root Cause:** The label CSS (`position:absolute; right:calc(100% + 10px)`) positions the label to the left of the dot, which is ideal for show-all mode (where dots are in a vertical column on the right edge and labels appear in the clear space to the left). In arc mode, dots are positioned in a polygon — the space to the "left" of an arc dot is occupied by the adjacent arc position, so labels collide.

**Solutions Considered:**

*Approach 1: Change label position in JS per-mode.* In `orbRender()`, when `orbMode === 'arc'`, explicitly set `dot.querySelector('.acn-lbl').style.right = 'auto'` and set `top`, `left` for each dot. Rejected because: this mixes layout styling into the render loop. Every mode switch and every frame render would be touching label styles alongside position calculations. It also requires DOM queries per-dot per-render.

*Approach 2: Store label position as a property on each dot object in `ORB_FEATURES` and re-apply on mode switch.* Rejected because: label position is a property of the mode, not the feature. The same feature dot should be left-labeled in show-all and below-labeled in arc. Storing it on the feature conflates per-feature and per-mode concerns.

*Approach 3: Use `data-acn-mode` on the zone element to switch label position via CSS selectors.* `orbRender()` calls `zone.setAttribute('data-acn-mode', orbMode)`. CSS uses `#acn-zone[data-acn-mode="arc"] .acn-lbl { ... }` to override label position in arc mode only. No JS per-dot, no DOM queries per-render — one `setAttribute` call per render, CSS handles all 6 dots automatically.

**Fix:** Approach 3. `data-acn-mode` is set at the top of `orbRender()`. CSS positions arc labels below the dot with a centered `translateX(-50%)` transform and a `translateY(-4px)` entrance offset (slides up to `translateY(0)` on hover, matching the horizontal slide used in show-all mode).

**Results:** Arc mode labels appear cleanly below each dot with no overlap. Mode switch (show-all ↔ arc ↔ wheel) immediately repositions labels via CSS without any additional JS work. `data-acn-mode` is also now available for any future CSS targeting of mode-specific styles.

---

## Recently Fixed Issues

The following platform-specific issues have been identified through live site testing, diagnosed via live DOM inspection, and fully resolved.

### Bolt.new — Button Invisible (CodeMirror Geometry Exploit)

**Versions affected:** v9.4 – v9.5
**Fixed in:** v9.6
**Platforms:** Bolt.new (`bolt.new`)

#### What It Looked Like
The AI Nav button was completely invisible on Bolt.new, even though the platform was correctly detected. The script was running, but the button container was positioned far to the right, outside the visible viewport.

#### Root Cause — Off-Screen CodeMirror Editor
Bolt.new uses a "preview" pane on the right side of the screen. When the user opens the editor, CodeMirror instances are created. Some of these instances are rendered **off-screen** or in hidden layout containers with `x` coordinates > 1500px.
The `getChatBoundaryX` function was using a broad query selector that picked up these hidden editors. Because they were technically "right" of the visible chat panel, the script chose the rightmost editor as the boundary.

#### How It Was Fixed
**Visible Boundary Filtering:**
Modified `getChatBoundaryX` to filter out any elements that are hidden (`display: none`) or currently off-screen. It now prioritizes elements within the visible viewport width. 

**CodeMirror Exclusion:**
Added an explicit check to prioritize actual chat containers (matching `_Chat_` selectors) over generic editor wrappers.

---

### Search Panel — Crash on Render (Trusted Types CSP Violation)

**Versions affected:** v9.4 – v9.5
**Fixed in:** v9.6
**Platforms:** Claude, ChatGPT (Strict CSP)

#### What It Looked Like
In v9.4, clicking the Search button and typing a query would do nothing. Opening the DevTools console revealed a fatal JavaScript error: `This document requires 'TrustedHTML' assignment`. The search feature was completely unusable on platforms enforcing strict Content Security Policies.

#### Root Cause — `innerHTML` Usage
The v9.4 search renderer used `resultsContainer.innerHTML = '...'` to clear and populate search snippets. Because browsers like Chrome and Firefox enforce **Trusted Types** on high-security domains like `claude.ai`, the browser blocks any direct string-to-HTML injection to prevent potential XSS vulnerabilities.

#### How It Was Fixed
**Programmatic DOM Construction:**
The entire `executeConversationSearch` function was refactored to use safe DOM APIs:
1. `textContent = ''` for clearing.
2. `createElement('div', { textContent: '...' })` for building the result list.
3. `appendChild()` for mounting the nodes.

By constructing the DOM tree node-by-node instead of passing a string to the HTML parser, the script bypasses the Trusted Types sink entirely.

---

### Firebase Studio — 0 Questions Detected (Cross-Origin Iframe Injection)

**Versions affected:** v7.1 – v7.7
**Fixed in:** v7.8
**Platforms:** Firebase Studio (`studio.firebase.google.com`)

This is the only platform where the bug was NOT a selector/DOM issue — the selectors were correct the entire time. The problem was that the script was injecting into the wrong iframe.

#### What It Looked Like

The navigator showed 0 questions on Firebase Studio. Retry scans at 5s, 10s, 20s all found nothing. But `document.querySelectorAll('[class*="_chatMessage_"]')` manually run in the correct iframe context returned 4 elements. After Bug 1 and Bug 2 were fixed, the script loaded but showed two duplicate buttons (one on the app preview, one on the chat panel).

#### Firebase Studio's Iframe Architecture

Unlike every other supported platform (which renders chat in the top-level document), Firebase Studio uses a multi-layer iframe architecture:

```
Top frame: studio.firebase.google.com (shell — no chat UI)
  ├── iframe: 6000-firebase-studio-{id}.cluster-{hash}.cloudworkstations.dev/capra/...
  │     └── THE WORKSPACE: app preview (left) + chat panel (right) + all _chatMessage_ elements
  │     └── nested iframe: same cloudworkstations.dev domain, path "/"
  │           └── APP PREVIEW: renders the user's generated app
  ├── iframe: firebase-studio-{id}.cluster-{hash}.cloudworkstations.dev/env/msg/...
  │     └── MESSAGING ENDPOINT: blank page for internal communication, no chat
  └── iframe: accounts.google.com/... (Google auth)
```

Key distinctions between iframes:
- **Workspace** (port-prefixed, `/capra/` path): Has the chat UI and all `_chatMessage_` elements
- **App preview** (same domain, `/` path): Renders the user's app, no chat
- **Messaging endpoint** (non-port-prefixed, `/env/msg` path): Internal plumbing, blank page
- **Port-prefixed** means `6000-firebase-studio-...` — the `6000-` maps to the workspace port

#### Root Cause — Three Bugs

**Bug 1: Tampermonkey `@include` pattern too narrow.** The v7.7 rule `@include https://firebase-studio-*.cloudworkstations.dev/*` required the hostname to START with `firebase-studio-`. The workspace hostname starts with `6000-firebase-studio-` — the port prefix `6000-` caused a mismatch. Tampermonkey confirmed: "no script running" on the workspace URL.

**Bug 2: `detectSite()` regex too strict.** Even after fixing injection, `/^firebase-studio-/.test(hostname)` anchored at string start rejected `6000-firebase-studio-...` because it starts with `6000-`.

**Bug 3: Broader `@include` injected into ALL cloudworkstations.dev iframes.** After fixing Bugs 1 and 2 with `@include https://*cloudworkstations.dev/*`, the script ran in the workspace (correct) but ALSO in the app preview iframe and the /env/msg iframe (wrong), creating duplicate buttons.

#### How Each Bug Was Fixed

**Bug 1 fix — Broad `@include` + `@match`:**
```
// @match        https://*.cloudworkstations.dev/*
// @include      https://*cloudworkstations.dev/*
```
Both are needed: `@match` alone wasn't matching in Tampermonkey testing (possibly due to very long subdomain strings), while `@include` glob matching works reliably.

**Bug 2 fix — `includes()` instead of start-anchored regex:**
```javascript
// Before: /^firebase-studio-/.test(hostname)
// After:  hostname.includes('firebase-studio-')
```

**Bug 3 fix — `/capra/` path check to select only the workspace iframe:**
```javascript
if (currentSite === SITE.FIREBASE_STUDIO &&
    window.location.hostname.includes('cloudworkstations.dev') &&
    !window.location.pathname.startsWith('/capra/')) {
    return; // Skip non-workspace iframes
}
```
The workspace always uses `/capra/` in its path. The app preview uses `/`, and the messaging endpoint uses `/env/msg`. This single check handles all unwanted iframes.

#### What Was Tried and Didn't Fully Work

1. **Skipping `/env/` paths only** — Fixed the messaging endpoint duplicate but not the app preview duplicate (app preview is at `/`, not `/env/`).

2. **Checking `window.parent !== window.top`** — Works when accessing via `studio.firebase.google.com` (app preview is a sub-sub-iframe, so `parent !== top`). Fails when navigating directly to the `6000-` URL (workspace becomes top frame, app preview is a direct child, so `parent === top`).

3. **Checking `window._aiNavAlreadyLoaded` in DevTools** — Always returned `undefined` even when the script was running. This is because Tampermonkey's `@grant GM_addStyle` creates a sandbox where the script's `window` is a proxy, not the page's real `window`. Console log messages are the reliable indicator, not `window` property checks.

#### Diagnostic Tips

If Firebase Studio stops working in a future version:

1. **Check iframe structure:** Run from the top frame console:
   ```javascript
   document.querySelectorAll('iframe').forEach((f, i) => console.log(i, f.src || 'no-src'))
   ```
   Identify which iframe has the chat (look for `_chatMessage_` elements in each context).

2. **Check script injection:** Navigate directly to the workspace iframe URL. Check Tampermonkey icon — does it show 1 script running? Check console for "AI Conversation Navigator v8.0 loaded" message.

3. **Check path discrimination:** If the workspace path changes from `/capra/` to something else, the non-workspace skip logic will incorrectly filter out the workspace. Update the `startsWith('/capra/')` check.

4. **Check hostname pattern:** If Firebase Studio changes their subdomain format (e.g., removes port prefix or changes `firebase-studio-` to something else), `detectSite()` won't match. Update the `hostname.includes('firebase-studio-')` check.

5. **Console logs to look for:**
   - `"Firebase Studio top frame (shell), deferring to iframe instance."` — top frame correctly skipped
   - `"Firebase Studio non-workspace iframe (/env/msg), skipping."` — non-workspace iframe correctly skipped
   - `"AI Conversation Navigator v8.0 loaded for Firebase Studio!"` — script running in workspace

---

### Replit — Questions repeating 3 times per single question

**Versions affected:** v7.1 – v7.5
**Fixed in:** v7.6
**Platforms:** Replit (`replit.com`)

#### What It Looked Like
When you ask a single question on Replit, the navigation panel showed that question listed 3 times instead of once. Every question appeared as 3 identical entries. Clicking each duplicate highlighted a different nesting level: the outer event area, the middle surface wrapper, and the inner bubble.

#### Root Cause (Confirmed via Live DOM Inspection)
Replit uses `data-cy` (Cypress test attribute), **NOT `data-testid`**. All four primary selectors (`data-testid`, `data-message-role`, `data-role`, `data-author`) returned 0 results. The dedup logic only ran when primaries returned results, so it was skipped entirely. Then Fallback 1 (`[class*="userMessage"]`) matched 3 nested elements per message:

```
A: div.EventRenderer-module_RTGgnG_userMessage       ← match 1 (outer)
  B: div[data-cy="user-message"]                     ← correct target (no match)
    C: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades  ← match 2 (middle)
      D: span
        E: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades  ← match 3 (inner)
```

#### How It Was Fixed
Changed primary selector to `[data-cy="user-message"]` which targets element B — exactly one per user message. Updated mock test page to match real DOM structure. See CHANGELOG v7.6 for full details.

Also fixed: Ghost notch button not appearing on first page load (boundary detection Strategy 2 had the same wrong `data-testid` selector).

---

### V0 — No questions detected

**Versions affected:** v7.1 – v7.5
**Fixed in:** v7.7
**Platforms:** V0 (`v0.app`)

#### What It Looked Like
The navigation panel showed "0 questions found" on V0, even when multiple questions had been asked. The ghost notch button was also invisible until a page refresh.

#### Root Cause (Confirmed via Live DOM Inspection)
ALL 6 primary selectors were guesses that don't exist in V0's DOM:
- `[data-role="user"]`, `[data-message-role="user"]`, `[data-message-author-role="user"]`, `[data-message-author="user"]`, `[data-sender="user"]` — none of these attributes exist
- `[data-testid*="user-message"]` — actual value is `"message"` (no "user" in it)

ALL 6 fallbacks also failed because V0 uses different alignment classes than expected:
- V0 uses `items-end`, `origin-right` — NOT `justify-end`, `self-end`, `ml-auto`
- V0 uses `bg-v0-gray-200` — NOT `bg-muted`, `bg-secondary`
- V0 uses regular `id` attribute with hash — NOT `[data-message-id]`

The button was invisible because boundary detection Strategy 2 used `[data-role="user"]` (which doesn't exist) → no boundary found → `getChatBoundaryX()` returns null → button stays hidden.

#### How It Was Fixed
Replaced entire V0 selector chain with `[data-testid="message"]` filtered by `origin-right` + `items-end` classes. V0 uses `data-testid="message"` on ALL messages (user + AI), with user messages having `origin-right items-end` and AI messages having `origin-left items-start`. Updated boundary detection selector to `[data-testid="message"]`. Rewrote mock test page. See CHANGELOG v7.7 and DOM-REFERENCE.md for full details.

---

### Emergent — Button invisible + questions changing on scroll + no questions on initial load

**Versions affected:** v7.1 – v7.5
**Fixed in:** v7.7
**Platforms:** Emergent (`app.emergent.sh`)

#### What It Looked Like
Four related issues on Emergent:

1. **Button invisible:** The ghost notch button never appeared (stayed at `opacity: 0` indefinitely)
2. **Questions changing on scroll:** As the user scrolled through the chat, different items appeared in the navigation panel — many were AI agent status messages, not user questions
3. **No questions on initial load:** 0 questions detected until the user manually scrolled all the way up
4. **"No messages found" persisting:** The placeholder text stayed visible above actual questions

#### Root Causes (Confirmed via Live DOM Inspection)

**Button invisible (two root causes):**
1. Boundary detection failure: `_walkUpToChatContainer()` walks up from a message element checking `width < 65% viewport`. Emergent's `div.absolute.inset-0` inherits full viewport width from its flex parent → fails the width check → `getChatBoundaryX()` returns null → `.ai-nav-positioned` never added → opacity stays at 0.
2. Periodic interval reset: The 3-second boundary check was resetting `_lastBoundaryX = null` before each poll, preventing the two-consecutive-stable-polls requirement from ever being met.

**Questions changing on scroll:** Emergent uses **virtuoso virtual scrolling** — only DOM elements currently visible in the viewport exist in the DOM. The periodic re-scan cleared and rebuilt the question list each time. When user messages scrolled out of view, the primary selector returned 0, and broad fallback selectors matched AI agent content instead.

**No questions on initial load:** Emergent loads scrolled to the bottom. Messages at the top of the conversation don't exist in the DOM until the user scrolls up to them.

**"No messages found" persisting:** Empty message element had `id="ai-nav-empty"` but removal code used class selector `.ai-nav-empty`.

#### How It Was Fixed

1. **Emergent-specific boundary detection:** Find `[data-testid="virtuoso-scroller"]` directly and use its `rect.right` as the chat boundary (bypasses `_walkUpToChatContainer` entirely)
2. **Removed periodic `_lastBoundaryX = null` reset** to allow late-rendering platforms to achieve stable polls
3. **Reverted opacity band-aid** (previous session had bumped to 0.75 / 14px width) back to standard 0.35 / 8px since actual root cause is now fixed
4. **Removed broad fallback selectors 3-7** (rounded-br-none, items-end, text-wrap, etc.) that were matching AI agent content
5. **Added accumulative scanning** for virtual scroll platforms — messages collected across scans without clearing, deduplication by text key
6. **Added scroll-through collection on panel open** — programmatically scrolls the virtuoso container from top to bottom in 250ms steps, scanning at each position, then restores original scroll position
7. **Stale DOM reference handling** — checks `msg.isConnected` before scrolling; re-searches DOM for matching text if the element was recycled by virtuoso
8. **Fixed ID vs class selector** — changed `.ai-nav-empty` to `getElementById('ai-nav-empty')`

Rewrote mock test page and created detailed DOM-REFERENCE.md entry. See CHANGELOG v7.7 for full technical details.

---

## Cross-Platform Issues

### Orphaned panels on SPA re-inject cycles

**Versions affected:** v10.0 (identified during Phase 2 development)
**Fixed in:** v10.0 (defensive guard added during Phase 3)
**Platforms:** All SPA platforms (Claude, ChatGPT, Gemini, and any platform where `injectOrbital()` can be called more than once per page session)

#### What It Looked Like

On single-page applications that trigger a full re-inject (e.g., Gemini's Angular route changes, or Claude's SPA navigation between conversations), if `injectOrbital()` ran a second time after the DOM had been partially cleaned, the orbital zone could appear normally but existing `.acn-panel` elements from the previous injection cycle would still exist in `document.body` — disconnected from the new zone, invisible, but present in the DOM. These orphaned panels could intercept pointer events or cause getElementById lookups to find the wrong element.

A related issue: `orbInjectCSS()` injected a new `<style>` tag on each call. If the DOM Guardian triggered a re-inject while the style element was still present (common on Gemini), the same CSS rules would be injected twice, increasing stylesheet size and risking specificity collisions.

#### Root Cause

`injectOrbital()` was written assuming it would only ever be called once. The defensive mechanisms in the v9.x codebase that prevented duplicate button creation (`getElementById` checks, `_aiNavAlreadyLoaded` guard) were present at the global script level but not inside the orbital injection function itself.

When Gemini's Angular framework triggers a `popstate` or route change, the MutationObserver or SPA hook can call `injectOrbital()` again. The zone is rebuilt fresh, but the old panels (`.acn-panel` elements) were appended directly to `document.body` — not inside the zone — so removing the zone didn't clean them up.

Similarly, `orbInjectCSS()` unconditionally called `GM_addStyle()` and inserted a new `<style id="acn-style">` each time, without checking whether one already existed.

#### What Was Fixed

Two guards added to `injectOrbital()` in v10.0 Phase 3:

```javascript
// 1. Clean up orphaned panels from any previous injection cycle
document.querySelectorAll('.acn-panel').forEach(function (p) { p.remove(); });

// 2. In orbInjectCSS(): skip if style element already exists
if (document.getElementById('acn-style')) return;
```

The panel cleanup runs unconditionally at the start of every `injectOrbital()` call. The CSS guard checks by element ID before inserting. Together, these ensure re-injection is idempotent — calling `injectOrbital()` multiple times leaves exactly one zone, one style block, and zero orphaned panels.

#### Results

No duplicate CSS injections observed in Chromium testing. Panel cleanup prevents stale `.acn-panel` elements from persisting across inject cycles.

---

### Duplicate Navigate button (Linux Firefox)

**Versions affected:** v6.0  
**Fixed in:** v6.1  
**OS:** Linux (tested on NVIDIA DGX Spark, Ubuntu-based)  
**Browser:** Firefox (all AI platforms affected)  
**Not reproducible on:** macOS Firefox with the identical script

#### What It Looked Like
Clicking the Navigate button caused it to expand out as expected, but a second identical button remained in the original position. You now had two Navigate buttons on screen. Both were fully functional — hovering either one expanded it to show "Navigate", clicking either one toggled the sidebar panel. However, the two buttons caused erratic behavior:
- Clicking the stationary (duplicate) button would close the panel normally
- Clicking the correct button (the one that moved with the panel) would sometimes cause all questions to disappear from the panel, or "Question #1" labels would shorten to "Q1"
- The panel could get into a state where it was visually open but the script thought it was closed, or vice versa

#### Why It Was Happening
The v6.0 script had a **race condition** between three systems that all execute during page load:

**Step 1 — Initialization:** The script runs `document.body.appendChild(createToggle())` to add the Navigate button to the page.

**Step 2 — DOM Guardian fires:** The DOM Guardian is a `MutationObserver` watching `document.body` with `{ childList: true, subtree: true }`. It was designed to detect when Gemini's Angular framework removes our injected elements, so it can re-inject them. But it also detects *our own* DOM insertions from Step 1. On Linux Firefox, this observer fires **synchronously** — meaning it interrupts the `appendChild` call itself, running its callback before the browser has finished attaching the element.

**Step 3 — False positive re-injection:** The DOM Guardian's callback calls `ensureElementsExist()`, which checks `if (!document.getElementById('ai-nav-toggle'))`. Because the observer fired during (not after) the `appendChild`, the element isn't queryable yet. The check returns `true` ("element is missing!"), and `ensureElementsExist()` creates and appends a second toggle button.

**Why it only happened on Linux Firefox:** macOS Firefox batches MutationObserver callbacks and fires them asynchronously after the current JavaScript execution completes. So by the time the observer fires on macOS, both elements are fully attached and `getElementById` finds them. Linux Firefox's different event loop timing causes the observer to fire synchronously during the mutation.

**A second entry point for duplication:** Tampermonkey on Linux Firefox occasionally fires the entire userscript twice during page load. This is related to how Firefox on Linux handles the `document-start` vs `document-end` lifecycle events. Each execution creates its own closure with its own variables, but both inject elements into the same `document.body`. Neither execution is aware of the other.

**Why the state corruption happened:** Two independent toggle buttons each had their own click event handler, but they shared the same global `isOpen` state variable and operated on the same panel (found via `document.getElementById`). When Button A flipped `isOpen` to `true` and triggered `scanConversation()`, Button B's handler still thought `isOpen` was at its previous value. Clicking Button B would flip `isOpen` back and re-run `scanConversation()` with the panel in an inconsistent state, causing the question list to be cleared and redrawn mid-transition.

#### What We Did to Fix It and Why
We needed four complementary guards because duplication could enter through multiple independent code paths:

**1. Execution guard (`window._aiNavAlreadyLoaded`)**
```javascript
if (window._aiNavAlreadyLoaded) { return; }
window._aiNavAlreadyLoaded = true;
```
Placed at the very top of the IIFE, before any other code runs. Uses `window` (not a local variable) because each Tampermonkey execution gets its own closure scope, but they share the same `window` object. If the script fires a second time, it sees the flag and exits the entire IIFE immediately. This catches the "Tampermonkey fires twice" scenario.

**2. Duplicate element cleanup in `ensureElementsExist()`**
```javascript
const toggles = document.querySelectorAll('#ai-nav-toggle');
if (toggles.length > 1) {
    for (let i = 1; i < toggles.length; i++) toggles[i].remove();
}
```
Before checking if elements are missing, we first check if *multiple* elements with the same ID exist and remove the extras (keeping the first one). This is a safety net — even if a duplicate gets created through a code path we didn't anticipate, it gets cleaned up the next time `ensureElementsExist()` is called (which happens on every toggle click and every scan).

**3. Debounced DOM Guardian (200ms timeout)**
```javascript
const observer = new MutationObserver(function() {
    if (guardianTimeout) clearTimeout(guardianTimeout);
    guardianTimeout = setTimeout(function() {
        // ... check and re-inject
    }, 200);
});
```
Instead of the MutationObserver callback immediately checking and re-injecting, it sets a 200ms `setTimeout` and clears any previous timeout. Rapid-fire mutations (like our initialization appending multiple elements in sequence) get batched into a single check after everything settles. 200ms is long enough for initialization to complete but short enough that a genuinely removed element (e.g., by Gemini's re-rendering) gets re-injected promptly. This directly breaks the race condition — the observer still fires during our `appendChild`, but instead of immediately creating a duplicate, it just starts a 200ms timer. By the time the timer fires, the original element is fully attached and `getElementById` finds it.

**4. Guarded initialization**
```javascript
if (!document.getElementById('ai-nav-toggle')) {
    document.body.appendChild(createToggle());
}
```
The `appendChild` calls at the bottom of the script are wrapped in `getElementById` checks. This prevents the initialization code from creating duplicates if it runs after the DOM Guardian has already created elements (shouldn't happen with the other guards, but belt and suspenders).

#### How It Resolved Things
After applying all four guards, the duplicate button is completely eliminated on Linux Firefox. The execution guard catches the most common case (double script firing). The debounced observer prevents the race condition. The guarded initialization and duplicate cleanup are safety nets. Together, they ensure exactly one toggle and one panel exist regardless of timing or execution order.

#### What Didn't Work (Red Herrings)
During debugging this issue, we also observed the ChatGPT button being invisible and Claude showing 0 questions. We investigated these as potential script bugs:

- **Attempted: Broader CSS selectors for Claude** — Added fallback selectors like `[data-testid*="human"]` and filtered `[data-testid*="user"]` queries. Did not help because the original selectors were correct; the DOM just wasn't rendering properly under memory pressure.
- **Attempted: Changed ChatGPT icon from ⏣ (U+23E3) to ⬡ (U+2B21)** — Theorized that the benzene ring character wasn't in Linux's default font set. Did not help because the icon was rendering fine; the button's white background was just invisible against a white-ish page due to incomplete rendering.
- **Attempted: Scan retry logic (`scanWithRetry`)** — Created a function that retried scanning up to 5 times at 1.5-second intervals if 0 messages were found. Did not help because the messages were in the DOM; the query just wasn't returning them due to system strain.

All three issues turned out to be caused by **system resource exhaustion** on the DGX Spark. Symptoms included keyboard input freezing, letters not appearing while typing, and pages not rendering correctly. A system reboot resolved everything without code changes. All attempted patches were reverted to keep the codebase clean.

**System diagnostic tip:** If you see weird rendering on DGX Spark or similar Linux systems, check resources first:
- `free -h` in terminal — shows total/used/free RAM in human-readable format
- `htop` in terminal — shows per-process CPU and memory usage (interactive, like Task Manager)

Rule out system-level issues before debugging the script.

---

## Ghost Notch Button (Left-Chat Platforms)

These issues affect the left-chat platforms that use the ghost notch button design: Bolt.new, Lovable, Replit, V0, Base44, and Emergent.

### Button appearing on home/dashboard pages (no chat active)

**Versions affected:** v7.1
**Fixed in:** v7.2 → v7.3
**Platforms:** All left-chat platforms
**Browser:** All browsers

#### What It Looked Like
The ghost notch button appeared on home/dashboard pages where there's no active chat conversation — for example, Bolt.new's homepage, Lovable's project list, or Emergent's home screen at `app.emergent.sh/home`. The button either showed at a fixed position (about 35% from the left edge) or briefly flashed visible in the middle of the screen before disappearing. On some pages, it would show up, fade in, and then suddenly vanish.

#### Why It Was Happening
The v7.1 `getChatBoundaryX()` function had a **35% viewport fallback** at the bottom:

```javascript
// Last resort: assume 35% viewport width
return window.innerWidth * 0.35;
```

This meant the function NEVER returned `null` — it always returned a number. The "no chat detected → hide" branch in `updateLeftChatPositions()` was unreachable dead code. The button always positioned itself at the boundary or at 35%, regardless of whether a chat panel existed.

The fallback was added during initial development as a safety net (better to show the button in a slightly wrong position than not show it at all), but it was exactly the wrong behavior for pages with no chat at all.

#### Why This Was Tricky to Fix

Simply removing the fallback wasn't enough. The deeper problem is that **home pages on these platforms have chat-like textareas**:
- Bolt.new homepage: "Let's build a customer portal where users..."
- Emergent home: "Build me a clone of netflix..."
- Lovable dashboard may have similar input areas

These textareas match the broad Strategy 1 selectors (`textarea[placeholder*="message" i]`, `[contenteditable="true"]`, etc.) in `getChatBoundaryX()`. Without the fallback, these could still cause the function to return a boundary value on home pages.

The defense against this is the `_walkUpToChatContainer()` function, which walks up from the input element and requires the ancestor to satisfy ALL of:
- `rect.left < 80` — starts near the left edge (home page inputs are centered, so `rect.left > 200`)
- `rect.width > 200 && rect.width < 65% viewport` — narrow panel (home page cards are either too narrow or the full-page wrapper is too wide)
- `rect.height > 40% viewport` — tall (home page input cards are short)

On a real chat page, the chat panel starts at `rect.left ≈ 0`, is 30-50% of viewport width, and is full viewport height — matching all three criteria. On a home page, the centered input card fails the `rect.left < 80` check.

#### What We Did to Fix It and Why (Three Iterations)

**v7.2 — Removed the 35% fallback:** `getChatBoundaryX()` now returns `null` when no strategy finds a chat panel. This makes the "no chat detected → hide" branch reachable. Home pages with centered inputs fail the `_walkUpToChatContainer()` checks → null → hidden.

**v7.3 first change — Start with `display: none`:** Even after removing the fallback, elements were created with `display: ''` (visible in DOM at `opacity: 0`). CSS hover rules (`opacity: 1`) meant users could accidentally discover the invisible button by mousing over it in the 500ms before the first poll ran. Fix: all left-chat elements now start with `display: none` and are only made visible after a stable boundary is confirmed.

**v7.3 second change — Don't re-hide after confirmation:** After the button successfully appeared, it would go invisible again within 1-2 seconds. The boundary fluctuated by 4-8px between polls (due to layout reflows, scrollbar toggling, content streaming), and any shift > 3px triggered a full reset: `display: none`, remove `ai-nav-positioned`, set `_boundaryDetected = false`. Fix: restructured `updateLeftChatPositions()` so that once confirmed, boundary shifts just update `style.right` smoothly — only a `null` boundary (navigating to a non-chat page) can hide the button.

**v7.3 third change — Faster opacity fade:** The original `ai-nav-positioned` class used a 3-second opacity transition (designed for v7.1 where position might drift). Combined with the display-none-first approach, this made the button take 3+ seconds to become noticeably visible — users couldn't tell it was there. Changed to 0.5s fade and removed the two-phase `ai-nav-ready` class.

#### How It Resolved Things
After all three fixes, the behavior is:
- **Home pages:** Button never appears. `getChatBoundaryX()` returns null → `display: none` forever. No flash, no hover discovery.
- **Chat pages:** Button appears after ~1 second (two 500ms stability polls), fades to 0.35 opacity over 0.5s. Stays visible permanently regardless of small boundary fluctuations.
- **SPA navigation (chat → home):** Boundary becomes null → button hides immediately.
- **SPA navigation (home → chat):** Boundary detected → stability confirmed → button appears.

#### Diagnostic Tips

If the ghost notch button is not appearing on a chat page where it should:

1. Open DevTools Console and look for `AI Conversation Navigator v8.0 loaded for [platform] (left-chat mode)!` — confirms the script detected the platform
2. Add a temporary `console.log` inside `getChatBoundaryX()` to see which strategy (if any) is finding the boundary:
   ```javascript
   console.log('Strategy 1 input:', input, 'boundary:', boundary);
   ```
3. Check what `_walkUpToChatContainer()` is returning by logging each ancestor's `getBoundingClientRect()`:
   ```javascript
   console.log(el.tagName, el.className, rect.left, rect.width, rect.height);
   ```
4. If the chat panel's `rect.left` is > 80 (e.g., there's a wide sidebar), the threshold may need adjusting for that platform

If the button IS appearing on a home page where it shouldn't:
1. One of the three strategies in `getChatBoundaryX()` is returning a non-null value
2. Most likely: a chat-like input or element is matching Strategy 1 or 2, and its ancestor passes the `_walkUpToChatContainer()` checks
3. Inspect the matching element and its ancestor chain to understand why the left/width/height criteria are being satisfied
4. The fix may need to be a platform-specific exclusion or a tighter constraint in `_walkUpToChatContainer()`

---

### Button invisible until hover (appears on hover as full button)

**Versions affected:** v7.2, early v7.3
**Fixed in:** v7.3
**Platforms:** All left-chat platforms
**Browser:** All browsers

#### What It Looked Like
On a chat page (not home), the button didn't appear as the expected 0.35 opacity thin strip. The area where the button should be looked completely empty. But if you moved your mouse over that area, the full expanded button suddenly appeared at `opacity: 1`. Moving the mouse away made it disappear again. It felt like the button was in the DOM but completely invisible.

#### Why It Was Happening
This was caused by the **boundary fluctuation re-hide loop** (Bug 3 in the v7.3 changelog).

The `updateLeftChatPositions()` function polled every 500ms and compared the current boundary to the last one with a 3px tolerance. The chat panel boundary fluctuates naturally by 4-8px between polls due to layout reflows (new content streaming, scrollbar appearing/disappearing, CSS transitions completing). Each fluctuation triggered:

1. `_boundaryDetected = false` (reset confirmation)
2. `display: none` (hide the button)
3. Remove `ai-nav-positioned` class (reset opacity to 0)

On the next poll, if the boundary stabilized:
4. `_boundaryDetected = true` (re-confirm)
5. `display: ''` (show the button — but at `opacity: 0` because `ai-nav-positioned` was removed)
6. Start 300ms timer to re-add `ai-nav-positioned`

But before the timer fired, the boundary would fluctuate again → steps 1-3 → timer cleared → `ai-nav-positioned` never sticks.

The result: the button alternated between `display: none` and `display: ''` with `opacity: 0` (no `ai-nav-positioned` class). The only way to see it was via the CSS `:hover` rule which sets `opacity: 1` regardless of classes.

#### What We Did to Fix It and Why
Restructured `updateLeftChatPositions()` into three phases where **Phase 2 (already confirmed) never hides the button**. Once `_boundaryDetected` is true, boundary shifts just update `style.right` for smooth repositioning. Only a `null` return from `getChatBoundaryX()` (meaning no chat panel exists at all) can hide the button.

See the v7.3 changelog entry for the complete three-phase architecture.

#### How It Resolved Things
The button now appears once, stays visible at 0.35 opacity, and smoothly tracks boundary shifts. The destructive hide/show/hide cycle is impossible because Phase 2 has no path to `display: none`.

---

## Claude Code

### 0 questions detected on Claude Code (`claude.ai/code`)

**Versions affected:** v6.1 and earlier
**Fixed in:** v6.2
**Browser:** All browsers
**Platform:** All platforms

#### What It Looked Like
Opening the Navigate sidebar on Claude Code (`claude.ai/code`) showed the sidebar correctly — it appeared, themed in orange, with the Claude icon — but the question list was empty, showing "0 questions found". The sidebar worked perfectly on regular Claude Chat (`claude.ai/chat`), even in the same browser session.

#### Why It Was Happening
The extension detects Claude by checking if the hostname includes `claude.ai`, which matches both Claude Chat and Claude Code. However, the two products use **completely different DOM structures**.

Claude Chat uses semantic `data-testid` attributes on its message elements:
- `[data-testid="user-human-turn"]`
- `[data-testid="user-message"]`
- `.font-user-message`

Claude Code uses **none** of these. Its conversation is built with a Tailwind CSS-based layout:
- Each turn is wrapped in a `div.pb-4` container
- User messages are right-aligned via `div.flex.flex-col.items-end.ml-auto`
- The message bubble is a `div.bg-bg-200.rounded-lg`
- Text sits inside nested `<p>` tags
- There are zero `data-testid` attributes anywhere in the DOM

Since the extension tried all three Claude Chat selectors, found nothing, and had no further fallback, it reported 0 questions.

#### What We Did to Fix It and Why
Added a **fallback selector chain** in `getUserMessages()` that only activates when all Claude Chat selectors find nothing:

```javascript
if (messages.length === 0) {
    const bubbles = document.querySelectorAll('div.bg-bg-200.rounded-lg');
    messages = Array.from(bubbles).filter(function(bubble) {
        return bubble.closest('.items-end');
    });
}
```

This approach:
1. **Selects message bubbles** (`bg-bg-200.rounded-lg`) — the visible rounded containers holding message text
2. **Filters for user messages only** by checking if the bubble is inside a right-aligned container (`.items-end`) — assistant messages are left-aligned and won't match
3. **Non-breaking** — only runs as a last fallback, so Claude Chat continues to work unchanged
4. **Good scroll target** — the bubble element works well with `scrollIntoView()` and the highlight animation

#### How It Resolved Things
After the fix, Claude Code conversations show all user messages in the navigation panel, with correct summaries and click-to-scroll functionality. Claude Chat remains unaffected because its selectors match before the fallback is reached.

#### Important Note: Firefox Crash False Positive
During testing on Firefox/Linux, the fix initially appeared not to work — questions still showed 0 after refreshing the page. After Firefox crashed and was restarted, the questions appeared correctly. This was the same pattern observed during v6.1 debugging: when Firefox is about to crash (memory pressure, degraded process state), content scripts fail silently — DOM queries return empty results even though elements exist in the DOM. Refreshing doesn't help because the browser process itself is degraded. After a clean restart, everything works. If you see 0 questions on Claude Code despite having the correct version, check if Firefox is behaving sluggishly and consider restarting it.

---

## Codex Web

### 0 questions detected on Codex web (`chatgpt.com/codex`)

**Versions affected:** v6.3 and earlier
**Fixed in:** v6.4
**Browser:** All browsers
**Platform:** All platforms

#### What It Looked Like
Opening the Navigate sidebar on Codex web (`chatgpt.com/codex`) showed the sidebar correctly — it appeared, themed in white/gray, with the ChatGPT icon — but the question list was empty, showing "0 questions found". The sidebar worked perfectly on regular ChatGPT Chat (`chatgpt.com`), even in the same browser session.

#### Why It Was Happening
The extension detects ChatGPT by checking if the hostname includes `chatgpt.com`, which matches both ChatGPT Chat and Codex web. However, the two products use **completely different DOM structures**.

ChatGPT Chat uses `data-message-author-role` attributes on message elements to identify user vs assistant messages. Codex web uses **none of these**. Its interface is built around a task/thread/item model where each conversation is a thread containing turns, and each turn contains typed items (user message, agent message, tool execution, diffs, etc.). The DOM reflects this item-based structure rather than a traditional chat message layout.

Since the extension tried the ChatGPT Chat selector, found nothing, and had no further fallback, it reported 0 questions.

#### What We Did to Fix It and Why
Added a **fallback selector** in `getUserMessages()` that only activates when the ChatGPT Chat selector finds nothing — the same pattern used for Claude Code support:

```javascript
if (messages.length === 0) {
    messages = document.querySelectorAll('div.self-end.bg-token-bg-tertiary');
}
```

This approach:
1. **Selects user message bubbles** (`self-end.bg-token-bg-tertiary`) — user messages in Codex web are right-aligned (`self-end`) with a tertiary token background, while agent messages are left-aligned and use a different background
2. **Good scroll target** — the bubble element works well with `scrollIntoView()` and the highlight animation
3. **Non-breaking** — only runs when the ChatGPT Chat selector finds nothing

#### How It Resolved Things
After the fix, Codex web conversations have fallback selector support for detecting user messages. Regular ChatGPT Chat remains unaffected because its selector matches before the fallback is reached.

#### Important Note: Selector Stability
Because Codex web is a React-based SPA that may update its DOM structure frequently, the exact selectors that work may change over time. If you see 0 questions on Codex web despite having v6.4+, the DOM structure may have changed. Follow the diagnostic steps in the [General Issues](#messages-not-detected-0-questions-found) section to inspect the current DOM and identify the correct selectors.

---

## Gemini

### "You said" prefix on every question (Firefox + Linux only)

**Versions affected:** v6.2
**Fixed in:** v6.3
**OS:** Linux (tested on NVIDIA DGX Spark, Ubuntu-based)
**Browser:** Firefox
**Not reproducible on:** macOS Firefox with the identical script

#### What It Looked Like
Every question in the navigation panel started with "You said" — for example, "You said what is vertex ai?" instead of "what is vertex ai?". This happened on every single question in the panel, making the summaries harder to read. The issue only appeared on Firefox running on Linux; the identical script on macOS Firefox showed clean question text.

#### Why It Was Happening
Gemini includes a visually-hidden accessibility element (e.g. `<span class="sr-only">You said</span>`) inside each user message container. This span is hidden via CSS (`position: absolute; width: 1px; height: 1px; overflow: hidden` or similar screen-reader-only styling) so sighted users never see it. However, `textContent` — the property our script uses to extract message text — returns **all** text within an element's subtree, including text from visually-hidden children.

On macOS, Gemini may serve slightly different HTML based on user-agent detection, or the CSS selector may land on a child element that doesn't include the accessibility span. On Firefox/Linux, the selected element captures the full container including the hidden prefix.

#### First Fix Attempt — Failed
Added a regex strip after text extraction:

```javascript
let text = msg.textContent || msg.innerText || '';
text = text.replace(/^You said\s*/i, '');
```

**Why it didn't work:** The `^` regex anchor matches only the very start of the string. But `textContent` from a DOM element with nested children includes whitespace and newlines from HTML indentation. The actual extracted string was something like `"\n    You said i already updated..."`. Because of the leading whitespace, "You said" wasn't at position 0, so the regex never matched.

**Tested:** Restarted Firefox, refreshed Gemini — "You said" still appeared on every question.

#### Second Fix Attempt — Success
Added `.trim()` before applying the regex:

```javascript
let text = (msg.textContent || msg.innerText || '').trim();
text = text.replace(/^You said\s*/i, '');
```

**Why this works:** `.trim()` strips all leading and trailing whitespace (spaces, `\n`, `\t`) from the raw `textContent`. After trimming, the string begins directly with "You said", so the `^`-anchored regex matches and removes it. The trim is harmless on all platforms — user message text never has meaningful leading/trailing whitespace.

#### How It Resolved Things
After the second fix, question summaries on Gemini display clean text without the "You said" prefix. Confirmed working on Firefox/Linux after a full browser restart. The fix is a no-op on other platforms and browsers where the prefix doesn't exist.

---

### Navigate button does nothing (Chrome only)

**Versions affected:** v4.0  
**Fixed in:** v5.0  
**Browser:** Chrome only (Firefox and other browsers were not affected)

#### What It Looked Like
The Navigate button appeared on the right side of the screen on Gemini. Clicking it did absolutely nothing — the sidebar panel never slid out. The button sometimes worked immediately after first installing the script, but stopped working after a page refresh. All other platforms (Claude, ChatGPT, Grok) worked fine.

#### Why It Was Happening
Gemini enforces a **Trusted Types Content Security Policy (CSP)** on Chrome. Trusted Types is a browser security feature that blocks all direct `innerHTML` assignments to prevent Cross-Site Scripting (XSS) attacks.

Our v4.0 script used `innerHTML` to build the panel's internal structure — the header bar, site title, refresh button, question list, empty state message, and individual question cards. When the script ran on Gemini in Chrome, every single `innerHTML` assignment was silently blocked by the CSP. The result: the panel `<div>` was created and appended to the DOM, but it was completely empty inside. When the toggle button tried to slide the panel open, it was technically sliding open an empty, zero-height, invisible panel.

DevTools Console showed the error: `TypeError: Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.`

Firefox does not enforce Trusted Types CSP the same way, which is why the script worked fine on Firefox.

A secondary problem was that Gemini is built on Angular and aggressively re-renders its DOM. Even when elements were successfully injected, Angular's change detection cycle could silently remove them. The button and panel would simply vanish without any error message, making the issue intermittent and hard to diagnose.

#### What We Did to Fix It and Why
**For the Trusted Types issue:** We replaced every instance of `innerHTML` with **programmatic DOM creation**:
- `document.createElement()` to create each element
- `.textContent` to set text content safely (not parsed as HTML)
- `.appendChild()` to assemble the DOM tree

This approach is inherently Trusted Types compliant because you never assign raw HTML strings. The browser constructs the DOM tree directly from your JavaScript calls, bypassing the HTML parser entirely. We created a reusable helper function `createElement(tag, attrs, children)` to keep the code readable despite the more verbose syntax.

**For Gemini's DOM re-rendering:** We added three defensive systems:
- **DOM Guardian** — a `MutationObserver` on `document.body` that detects when our elements are removed and re-injects them. This catches Angular's silent element removal.
- **SPA navigation hooks** — intercepts `history.pushState` and `history.replaceState` so our elements survive when the user switches conversations (which Gemini handles as SPA route changes, not full page loads).
- **Periodic health check** — a `setInterval` that runs every 3 seconds on Gemini only, verifying our elements are still in the DOM. This is the last line of defense in case a mutation event is missed.

We also merged two separate `addEventListener('click', ...)` handlers on the toggle button into a single unified handler (`handleToggleClick`), eliminating a potential race condition where both handlers could fire independently.

#### How It Resolved Things
After replacing all `innerHTML` with programmatic DOM creation, the panel builds correctly on Gemini Chrome because no Trusted Types violation occurs. The three defensive systems ensure elements survive Gemini's aggressive re-rendering. The fix is fully backward-compatible — programmatic DOM creation works identically on all browsers, so no platform-specific code branching was needed. The same code now handles Chrome's strict CSP, Firefox's relaxed CSP, and everything in between.

---

## General Issues

### Script not appearing on any site

**Possible causes:**
- Tampermonkey is disabled — check that the extension is enabled in your browser's extension settings
- The script is disabled within Tampermonkey — click the Tampermonkey icon and verify the script shows a green toggle
- Chrome's Developer Mode is off — required for extensions to run. Go to `chrome://extensions/` and enable it
- Page needs a refresh — after installing or updating the script, refresh the page

### Messages not detected (0 questions found)

**Possible causes:**
- The AI platform updated its HTML structure and the CSS selectors no longer match
- The conversation hasn't fully loaded yet — try clicking the ↻ Refresh button in the panel
- System resource exhaustion — if the browser is under memory pressure, DOM queries can return empty results. Check with `free -h` and `htop` on Linux.

**How to investigate:**
1. First, check system resources: run `free -h` and `htop` in terminal to rule out memory issues
2. Open DevTools (F12) → Elements/Inspector tab
3. Right-click on one of your messages → Inspect
4. Look at the element's class names and data attributes
5. Compare with the selectors in the script's `getUserMessages()` function
6. If they don't match, the platform has changed its structure

**Diagnostic console command:**  
Paste this into the DevTools Console to see all `data-testid` attributes on the page:
```javascript
document.querySelectorAll('[data-testid]').forEach(el => console.log(el.getAttribute('data-testid'), '→', el.tagName, '→', el.textContent.substring(0,50)))
```

**Current selectors by platform:**
| Platform | Primary Selector | Fallbacks |
|----------|-----------------|-----------|
| Claude Chat | `[data-testid="user-human-turn"]` | `[data-testid="user-message"]`, `.font-user-message` |
| Claude Code | `div.bg-bg-200.rounded-lg` filtered by `.items-end` parent | (activates only when all Claude Chat selectors fail) |
| ChatGPT | `[data-message-author-role="user"]` | — |
| Codex Web | `div.self-end.bg-token-bg-tertiary` | (activates only when ChatGPT selector fails) |
| Grok | `div.message-bubble` filtered by user/human class | `[data-role="user"]`, `[class*="user-message"]` |
| Gemini | `div.query-text` | `.query-text-line`, `p.query-text-line`, `[data-query-text]`, `.user-query` |
| Bolt.new | `[data-message-id]` filtered by `self-end` | `_MarkdownContent_` inside `self-end`, `backdrop-blur` + `rounded` (bolt.diy), `ml-auto` rounded bubbles |
| Lovable | `div[role="log"] .justify-end` | `bg-neutral-200.rounded-xl`, `ChatMessageContainer .justify-end`, `self-end[class*="bg-neutral"]` |
| Replit | `[data-cy="user-message"]` | `[data-event-type="user-message"]`, `[class*="EventRenderer"][class*="userMessage"]`, class-based with dedup, ARIA roles |
| V0 | `[data-testid="message"]` filtered by `origin-right` + `items-end` | `items-end` only, `bg-v0-gray-200` / `group/message-bubble`, `role="listitem"` + alignment |
| Base44 | `[id^="message-"]` filtered by `.justify-end` | `.bg-slate-200.rounded-xl` |
| Emergent | `[data-testid^="user-message"]` + innermost dedup | `[id^="user-task"]` (broad fallbacks 3-7 removed — see v7.7 changelog) |
| Perplexity | `.group\/query` | `.group\/title .select-text` |
| Firebase Studio | `[class*="_isUser_"]` (in workspace iframe only — see Firebase section) | `[class*="_chatMessage_"]` filtered by `_isUser_` |

---

## v10.9 — SSE Plumbing Deep Dive: Three More Bugs After v10.8 (2026-02-23)

v10.8 fixed the `unsafeWindow` issue and verified that `window._acnFetchPatched` returned `true`. The fetch proxy was on the correct window. But live testing after installing v10.8 showed the context bar still never changed from `(est.)`. Three more bugs were hiding underneath, each invisible until the layer above it was fixed. The following documents the complete 10-step diagnosis that found them.

---

### Key Principle: Layered Diagnosis

**Each layer was invisible until the layer above it was fixed.**

You cannot diagnose TextDecoder issues if fetch isn't intercepting anything. You cannot diagnose line-ending issues if TextDecoder is silently consuming chunks and returning empty strings. You cannot discover that `message_start` has no `usage` field if events are never splitting out of the buffer. This "onion" structure means adding debug logging at step N+1 before confirming step N is fixed will always give misleading results.

| Step | What was checked | Result | What it told us |
|------|-----------------|--------|-----------------|
| 1 | Console manual fetch proxy (bypassing Tampermonkey entirely) | ✅ SSE intercepted | SSE endpoint is accessible, data flows normally |
| 2 | `window._acnFetchPatched` flag after v10.8 | ❌ `undefined` | Patch was being applied to sandbox wrapper window, not real page window |
| 3 | After `unsafeWindow` fix: `_acnFetchPatched` | ✅ `true` | Fetch proxy now on correct real page window |
| 4 | Added `console.log` at entry of `readSSEStream()` | ✅ Magenta log appeared | Stream reader was being created — function was reaching execution |
| 5 | Added `console.log` inside `pump()` loop | ✅ Orange "chunk received" logged | Reader.read() was resolving with data — chunks were flowing |
| 6 | Added `console.log` at entry of `parseSSEEvent()` | ❌ Never appeared | Processing stopped between `pump()` receiving chunks and `parseSSEEvent()` being called |
| 7 | Logged `typeof result.value` and `result.value.length` | `[object Uint8Array]` length > 0 | Chunks contained real bytes — data was present in the typed array |
| 8 | Logged `buffer.length` immediately after `decoder.decode()` | Buffer length stayed 0 | TextDecoder was silently returning empty strings — cross-realm Uint8Array bug |
| 9 | After Uint8Array fix: logged `buffer.length` each iteration | Buffer grew (8006→9170) but never shrank | Events were not splitting — buffer accumulated endlessly without being consumed |
| 10 | After `\r\n` regex fix: `parseSSEEvent()` entry log | ✅ Fired for all event types | Full SSE pipeline working; examined `message_start` payload — no `usage` field |

---

### RESOLVED — Cross-Realm Uint8Array: TextDecoder Silently Returns Empty Strings

**Versions affected:** v10.0 through v10.8
**Fixed in:** v10.9 | **Severity:** Critical | **Platforms:** Claude.ai only

**Symptom:** After fixing `unsafeWindow` in v10.8, `pump()` correctly received SSE chunks (Step 5 confirmed). But `buffer.length` remained 0 after every `decoder.decode()` call (Step 8). No error was thrown. TextDecoder silently consumed the chunk and returned an empty string.

**Root cause:** The cloned response stream (`response.clone().body`) returns typed arrays from the **page JavaScript realm** — the real browser context where Claude.ai's code runs. Tampermonkey runs userscripts in a sandboxed JavaScript environment (a separate VM realm). When you call `new Uint8Array(...)` or `new TextDecoder()` inside a Tampermonkey script, these constructors come from the **sandbox realm**, not the page realm.

`TextDecoder.decode()` in the sandbox realm receives a `Uint8Array` from the page realm. Due to the realm boundary, the sandbox TextDecoder cannot recognize the typed array as one of "its own" — it sees a foreign object. Rather than throwing an error (which would have made this easy to diagnose), it silently returns an empty string. This is a Tampermonkey-specific sandbox isolation behavior, not a standard browser behavior.

**Confirmed at Step 7→Step 8:** Chunk had `typeof result.value === '[object Uint8Array]'` and `result.value.length > 0`. After `decoder.decode(result.value, { stream: true })`, buffer was empty. The data was physically present but inaccessible to the sandbox decoder.

**Fix:** Create a **new** `Uint8Array` inside the sandbox realm, using the page-realm array as the source. `new Uint8Array(foreignArray)` allocates a fresh typed array in the calling realm and copies bytes from the source:

```javascript
// Before (v10.0–v10.8):
buffer += decoder.decode(result.value, { stream: true });

// After (v10.9+):
var copied = new Uint8Array(result.value);  // copy into sandbox realm
buffer += decoder.decode(copied, { stream: true });
```

The one-line copy is the minimal fix. No performance concern — SSE chunks are small (typically 1–4KB each).

---

### RESOLVED — Line Ending Mismatch: Claude SSE Uses `\r\n`, Not `\n`

**Versions affected:** v10.0 through v10.8
**Fixed in:** v10.9 | **Severity:** Critical | **Platforms:** Claude.ai only

**Symptom:** After the Uint8Array fix, `buffer.length` grew correctly — it went from 8006 to 9170 bytes across iterations (Step 9). But it never decreased. `parseSSEEvent()` was never called. The buffer was accumulating text but no events were being extracted.

**Root cause:** The SSE event boundary split used `/\n\n/`:
```javascript
var parts = buffer.split(/\n\n/);
```

Claude's SSE stream uses **`\r\n`** (carriage return + newline) as its line separator, following the HTTP/1.1 convention. An SSE event boundary in Claude's stream looks like `\r\n\r\n`, not `\n\n`. The regex `/\n\n/` never matched, so `parts` always had exactly one element (the entire buffer), and `parts.pop()` assigned the whole buffer back to itself. The loop body never executed.

The same issue affected individual line parsing inside `parseSSEEvent()`:
```javascript
var lines = eventStr.split('\n');
```
With `\r\n` line endings, splitting on `\n` produces lines that end with a stray `\r`. `line.indexOf('event:')` and `line.indexOf('data:')` would still work (the prefix matches), but `line.slice(6).trim()` with `.trim()` would clean up the `\r`. So the inner parsing bug was latent — it would have been fine once events were splitting. Still, the regex was corrected for robustness.

**Fix — two locations:**

Event boundary split in `readSSEStream()`:
```javascript
// Before:
var parts = buffer.split(/\n\n/);
// After:
var parts = buffer.split(/\r?\n\r?\n/);
```

Line separator in `parseSSEEvent()`:
```javascript
// Before:
var lines = eventStr.split('\n');
// After:
var lines = eventStr.split(/\r?\n/);
```

The `\r?` makes both regexes tolerant of both `\n` and `\r\n` line endings — safe against future changes in Claude's stream encoding.

---

### DEAD END CONFIRMED — Claude Web SSE Has No Token Usage Data

**Versions investigated:** All versions through v10.9
**Status:** Not fixable from userscript context | **Platforms:** Claude.ai web UI only

With all plumbing fully fixed after Steps 1–9, `parseSSEEvent()` fired successfully for every event type. The `message_start` payload was logged in full:

```json
{
  "type": "message_start",
  "message": {
    "id": "chatcompl_...",
    "type": "message",
    "role": "assistant",
    "model": "",
    "content": [],
    "stop_reason": null,
    "trace_id": "...",
    "request_id": "..."
  }
}
```

**No `usage` field.** No `input_tokens`. No `output_tokens`. `message_delta` and `message_stop` events were also examined — none contain usage data.

Claude's web UI deliberately strips the `usage` field from the SSE stream before delivering it to the browser. In the direct Claude API (for developers), `message_start` always includes `"usage": { "input_tokens": N, "output_tokens": 0 }`. This field is simply absent in the web UI's streaming responses.

**This is a dead end for exact token tracking via SSE from a userscript.** There is no way to obtain `input_tokens` from a Claude.ai page session without direct API access (which requires an API key, separate from the web UI session).

**Do not re-investigate this path.** The plumbing is now known-good (Steps 1–9 all pass). The data simply isn't there.

**What Claude web SSE DOES provide (usable for context tracking):**
- `content_block_delta` with `type: "text_delta"` — exact output text, character by character
- `content_block_delta` with `type: "thinking_delta"` — exact extended thinking text, character by character
- `message_start` — message lifecycle start (no token counts)
- `message_delta` — message lifecycle delta (no token counts)
- `message_stop` — message lifecycle end

**What it does NOT provide:**
- `input_tokens` — stripped by web UI, only in direct API responses
- `output_tokens` — same

**v10.9 approach:** Use `thinking_delta` chars as the one SSE-only signal that DOM cannot capture (extended thinking is hidden behind a collapsed toggle, invisible to `innerText`). DOM text provides all visible content. Combined with system overhead (15K constant), this gives a hybrid estimate that's more accurate than DOM-only for thinking-heavy conversations.

---

## v10.12/v10.13 — Post-Review Fixes (2026-03-10)

---

### RESOLVED — Summary Map Segments Overlapping Each Other

**Versions affected:** v10.11 only
**Fixed in:** v10.13 | **Severity:** High (visual corruption) | **Platforms:** All

**Symptom:** In the Summary panel, conversation map brackets overlapped adjacent segments. Child brackets and topic pills spilled into the section below. On long conversations the entire map became unreadable.

**Root cause:** The map container had a fixed `height` (`Math.max(300, Math.min(700, totalLines * 2.2))px`) and used `flex-grow` on each segment row to partition that space proportionally. When a segment expanded due to children or topic pills, it overflowed its allocated flex slice into the next segment's zone. Adding `overflow: hidden` to the container only clipped the overflow — it did not give segments room to grow.

**Fix:** Removed `container.style.height`. Replaced `flex-grow`/`flex-basis`/`min-height: 0` on segment rows with `segEl.style.minHeight = Math.max(36, Math.floor((seg._lineCount / totalLines) * 600)) + 'px'`. Segments now declare a proportional minimum height and expand freely to fit their content. The container grows with its children; the panel scrolls.

**Snapshot column sync:** The snapshot column uses `flex-grow` (not `min-height`) on its zones, and `align-items: stretch` on the shared flex parent keeps both columns matched in total height without a fixed coordinate.

---

### RESOLVED — Drag Lag on Orbital Button Zone

**Versions affected:** v10.10–v10.11
**Fixed in:** v10.13 | **Severity:** Medium (UX degradation) | **Platforms:** All orbital platforms

**Symptom:** Dragging the orbital button cluster up or down the right edge of the screen was visibly laggy, especially at fast mouse speeds.

**Root cause:** `_orbDragMove()` called `orbRender()` on every `mousemove` event. `orbRender()` performs DOM reads (viewport dimensions, container measurements), repositions all dot elements, and recalculates hitzone geometry — triggering a synchronous browser layout reflow on every mouse event.

**Fix:** During drag, `_orbDragMove()` now applies only `zone.style.transform = 'translateY(' + offsetPx + 'px)'`. CSS `transform` is GPU-composited and never triggers layout reflow. `orbRender()` fires once in `_orbDragEnd()` after mouseup to finalize positions and remove the transform.

---

### RESOLVED — Pivot Detection Matching Technical Terms

**Versions affected:** v10.11 only
**Fixed in:** v10.13 | **Severity:** Medium (incorrect segmentation) | **Platforms:** All

**Symptom:** In coding or data-analysis conversations, the phrase "pivot table", "pivot column", or "pivot point" caused an unexpected segment break in the Summary conversation map.

**Root cause:** `PIVOT_PHRASES` included the bare word `pivot` as a match, intended to catch "let's pivot". The regex matched any occurrence of the word regardless of context.

**Fix:** Removed bare `pivot`. Added explicit transition forms `let's pivot` and `pivot to` instead — forms that cannot plausibly appear in a technical context. Also tightened `unrelated` → `unrelated question` and `something else` → `something else entirely` to reduce false positives from mid-sentence usage.

---

### RESOLVED — Summary Snapshot Column Creating Excessive DOM Nodes

**Versions affected:** v10.11 only
**Fixed in:** v10.13 | **Severity:** Medium (rendering lag on large conversations) | **Platforms:** All

**Symptom:** Opening the Summary panel in a conversation with large code blocks or pasted logs caused a noticeable delay before the panel rendered. In extreme cases (multi-thousand-line pastes), the browser tab stalled briefly.

**Root cause:** The snapshot column creates one `.acn-snap-line` DOM node per ~80 characters of message text. There was no upper bound per message. A single pasted log entry of 12,000 characters would create 150 line nodes; several such messages could push the total DOM count into the thousands.

**Fix:** Applied `Math.min(15, ...)` cap in two places: (1) the `_lineCount` accumulator (used to set `flex-grow` on bracket segments), preventing any message from dominating vertical proportions; (2) the inner loop that appends `.acn-snap-line` elements, capping each message at 15 line nodes regardless of text length.

---

### RESOLVED — Sub-Segments Dropped When Map Segments Merge

**Versions affected:** v10.11 only
**Fixed in:** v10.13 | **Severity:** Low (missing nested brackets after merge) | **Platforms:** All

**Symptom:** After `_sumMergeExcessSegments` ran on a conversation with more than 10 segments, the merged parent segments lost their nested child brackets. The D2 map showed only flat top-level segments with no sub-segments, even on segments with 8+ messages.

**Root cause:** `_sumMergeExcessSegments` constructed the merged segment object without a `children` field. The original segments had `children` populated by `_sumBuildSubSegments`, but the merge code rebuilt the object from scratch and omitted the field.

**Fix:** Added `children: _sumBuildSubSegments(mergedMsgs)` to the merged segment object, where `mergedMsgs = a.messages.concat(b.messages)`. The sub-segment pass is re-run on the combined message list, which may produce different children than either source segment alone (since the combined context may have stronger or weaker topic shifts).

---

## Reporting New Issues

If you hit a problem not listed here:

1. Note which **platform** and **browser** are affected
2. Note which **operating system** you're on (macOS, Linux distro, Windows)
3. Check system resources first (`free -h` and `htop` on Linux)
4. Open DevTools Console (F12) and check for error messages
5. Look for any `AI Nav:` prefixed log messages in the console
6. Include the error text when reporting
7. Open an issue on GitHub with these details
