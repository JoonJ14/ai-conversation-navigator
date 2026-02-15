# Troubleshooting

Platform-specific issues, root causes, and how they were resolved. Each entry follows the full diagnostic journey: what the problem looked like, why it was happening technically, what approach we chose and why, and how it resolved the issue.

If you run into a problem, check here first — you might find we've already solved it.

---

## Cross-Platform Issues

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

1. Open DevTools Console and look for `AI Conversation Navigator v7.3 loaded for [platform] (left-chat mode)!` — confirms the script detected the platform
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
