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

## Gemini

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
| Platform | Primary Selector |
|----------|-----------------|
| Claude | `[data-testid="user-human-turn"]` |
| ChatGPT | `[data-message-author-role="user"]` |
| Grok | `div.message-bubble` |
| Gemini | `div.query-text` |

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
