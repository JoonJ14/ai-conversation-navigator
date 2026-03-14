# Firefox `bind` Permission Fix — AI Conversation Navigator

## Problem
Claude.ai shipped a new vendor bundle on March 12–13, 2026 (Visualizer feature).
The new bundle calls `.bind()` on `fetch` and possibly `history.pushState/replaceState`.
When our userscript replaces these with functions from Tampermonkey's sandbox compartment,
Firefox throws: `Uncaught Error: Permission denied to access property "bind"` — crashing
Claude's entire frontend (black screen).

Chrome is unaffected because it doesn't enforce cross-compartment restrictions on function objects.

## Root Cause
`unsafeWindow.fetch = function() {...}` creates a function in the **userscript sandbox**.
The page's JS runs in a **different security principal**. Firefox blocks cross-principal
`.bind()`, `.call()`, `.apply()` on foreign function objects.

## Fix
Use Firefox/Tampermonkey's `exportFunction()` API to clone our proxy functions into the
page's security context. `exportFunction` is available in Greasemonkey and Tampermonkey on
Firefox. On Chrome (where it's not needed), we fall back to direct assignment.

---

## Patch 1: `setupClaudeSSEInterceptor()` — replace the entire function

```javascript
function setupClaudeSSEInterceptor() {
    // Tampermonkey sandbox: `window` is a wrapper, not the real page window.
    // Claude.ai's JS uses the real window.fetch — we must patch that one.
    var pw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (typeof pw.fetch !== 'function') return;
    if (pw._acnFetchPatched) return; // idempotent
    pw._acnFetchPatched = true;

    var _nativeFetch = pw.fetch.bind(pw);

    var proxyFn = function acnFetchProxy(input, init) {
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

    // Firefox cross-compartment fix: exportFunction clones our sandbox function
    // into the page's security principal so .bind()/.call()/.apply() work.
    // Without this, Claude's vendor bundle crashes with "Permission denied to
    // access property 'bind'" when it tries to bind the replaced fetch.
    if (typeof exportFunction === 'function') {
        pw.fetch = exportFunction(proxyFn, pw);
    } else {
        pw.fetch = proxyFn;
    }
}
```

## Patch 2: SPA history patches — replace the `if (platform.spa)` block

```javascript
if (platform.spa) {
    var _origPushState = history.pushState;
    var _origReplaceState = history.replaceState;

    var pushProxy = function () {
        _origPushState.apply(this, arguments);
        if (isVirtualScroll) _vsAccumulatedKeys.clear();
        _questions = [];
        resetTurnCounter();
        if (platform.id === 'claude') setTimeout(_loadCachedSSEData, 600);
        if (typeof orbClosePanel === 'function') orbClosePanel();
        setTimeout(scanConversation, 500);
        if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
    };

    var replaceProxy = function () {
        _origReplaceState.apply(this, arguments);
        _questions = [];
        resetTurnCounter();
        if (platform.id === 'claude') setTimeout(_loadCachedSSEData, 600);
        setTimeout(scanConversation, 500);
        if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
    };

    // Firefox cross-compartment fix: history.pushState and replaceState are
    // page-context functions. If our replacements live in the userscript sandbox,
    // any page JS that calls .bind() on them will crash with "Permission denied".
    // exportFunction clones them into the page context.
    if (typeof exportFunction === 'function') {
        history.pushState = exportFunction(pushProxy, history);
        history.replaceState = exportFunction(replaceProxy, history);
    } else {
        history.pushState = pushProxy;
        history.replaceState = replaceProxy;
    }

    window.addEventListener('popstate', function () {
        if (isVirtualScroll) _vsAccumulatedKeys.clear();
        _questions = [];
        resetTurnCounter();
        if (platform.id === 'claude') setTimeout(_loadCachedSSEData, 600);
        if (typeof orbClosePanel === 'function') orbClosePanel();
        setTimeout(scanConversation, 500);
        if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
    });
}
```

## Patch 3: Duplicate execution guard — same pattern

The very first lines of the IIFE also write to `window`:
```javascript
window._aiNavAlreadyLoaded = true;
```
This should be safe since it's a boolean, not a function — `.bind()` won't be called on it.
No change needed here.

---

## How to apply

### Option A: Claude Code prompt
```
Read the file firefox-bind-fix.md. Apply Patch 1 by replacing the entire
setupClaudeSSEInterceptor() function body. Apply Patch 2 by replacing the
entire `if (platform.spa) { ... }` block. Do NOT change any other code.
Run the Playwright test suite after patching.
```

### Option B: Manual search-and-replace
1. Find `function setupClaudeSSEInterceptor()` → replace entire function body
2. Find `if (platform.spa) {` → replace until the matching closing `}`

## Testing
1. Open Firefox, enable Tampermonkey + AI Conversation Navigator
2. Navigate to claude.ai/new
3. Verify: no black screen, no console errors about "Permission denied to access property 'bind'"
4. Verify: SSE token tracking still works (send a message, check context bar updates)
5. Verify: SPA navigation still works (click between conversations)
6. Run full Playwright suite
