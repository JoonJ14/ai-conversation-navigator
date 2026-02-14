# Changelog

All notable changes to this project will be documented in this file. Each entry documents not just what changed, but *why* — the problem, the technical root cause, the approach we chose, and how it resolved the issue.

---

## [6.4] - 2026-02-14

### Problem
Opening the Navigate sidebar on **Codex web** (`chatgpt.com/codex`) showed the sidebar correctly (since the hostname is still `chatgpt.com`) but detected **0 questions** — no user messages appeared in the navigation list. The sidebar worked perfectly on regular ChatGPT Chat (`chatgpt.com`).

### Technical Root Cause
Codex web uses a completely different DOM structure from ChatGPT Chat. The existing ChatGPT selector relied on `data-message-author-role` attributes on message elements — **which do not exist in Codex web's DOM**.

Codex web uses a task/thread-based interface where:
- Each conversation is a **thread** containing multiple **turns**
- Each turn contains **items** (user message, agent message, tool execution, diffs, etc.)
- The DOM structure reflects this item-based model rather than ChatGPT's chat message model
- There are no `data-message-author-role` attributes anywhere in the Codex web DOM

Since the extension tried the ChatGPT Chat selector, found nothing, and had no further fallback, it reported 0 questions.

### Method Chosen and Why
Added a **fallback selector chain** in `getUserMessages()` that activates only when the existing ChatGPT Chat selector finds nothing — the same pattern used for Claude Code support in v6.2:

```javascript
// Codex web fallback selectors
if (messages.length === 0) messages = document.querySelectorAll('[data-role="user"]');
if (messages.length === 0) messages = document.querySelectorAll('[data-author-role="user"]');
if (messages.length === 0) messages = document.querySelectorAll('[data-item-role="user"]');
if (messages.length === 0) { /* class-name-based selectors */ }
if (messages.length === 0) { /* right-aligned bubble fallback (Tailwind pattern) */ }
```

This approach:
1. **Tries multiple data-attribute patterns** commonly used in React-based chat UIs — `data-role`, `data-author-role`, `data-item-role` — since Codex's exact attributes may vary across updates
2. **Falls back to class-name matching** looking for elements with "user-message" or "UserMessage" in their class names
3. **Last resort: layout-based detection** using right-aligned containers (`self-end`, `items-end`) similar to how Claude Code's user messages are right-aligned — filters for elements with actual text content to avoid matching empty layout containers
4. **Non-breaking** — only activates as a last fallback after the ChatGPT Chat selector fails, so regular ChatGPT continues to work unchanged
5. **No `@match` changes needed** — `chatgpt.com/*` already covers `chatgpt.com/codex`

### Result
Codex web conversations now have fallback selector support for detecting user messages. The broad fallback chain maximizes compatibility with Codex web's DOM structure. Regular ChatGPT Chat remains unaffected because its selector matches before any fallback is reached.

---

## [6.3] - 2026-02-12

### Problem
On **Firefox + Linux only**, the Gemini site displayed **"You said"** prepended to every question summary in the navigation panel (e.g. "You said what is vertex ai?" instead of "what is vertex ai?"). This did not reproduce on macOS Firefox with the identical script and identical Gemini conversations.

### Technical Root Cause
Gemini includes a visually-hidden accessibility element (e.g. `<span class="sr-only">You said</span>`) inside each user message container for screen readers. When extracting text via `textContent`, this hidden text is included in the string — `textContent` returns **all** text within an element, including text from elements hidden via CSS.

On Mac, Gemini may serve slightly different HTML based on user-agent detection, or the selector may land on a child element that excludes the accessibility span. On Firefox/Linux, the selected element captures the full container including the hidden prefix.

### First Attempt — Failed
Added a `text.replace(/^You said\s*/i, '')` regex strip in `scanConversation()` right after extracting `textContent`:

```javascript
let text = msg.textContent || msg.innerText || '';
text = text.replace(/^You said\s*/i, '');
```

**Why it failed:** The `^` anchor in the regex matches only the very start of the string. But `textContent` on a DOM element with nested children returns the raw text of the entire subtree, **including whitespace and newlines from HTML indentation**. The actual string looked something like `"\n    You said i already updated..."` — the leading whitespace meant "You said" wasn't at position 0, so `^You said` never matched. The regex was correct in logic but wrong in assumption about the input format.

**Tested:** Restarted Firefox, refreshed Gemini — "You said" still appeared on every question. Confirmed the fix did not work.

### Second Attempt — Success
Added `.trim()` to the text extraction **before** applying the regex:

```javascript
let text = (msg.textContent || msg.innerText || '').trim();
text = text.replace(/^You said\s*/i, '');
```

**Why this works:** `.trim()` strips all leading and trailing whitespace (including `\n`, `\t`, spaces) from the raw `textContent` output. After trimming, the string starts directly with "You said", and the `^`-anchored regex now matches correctly. The trim is harmless for all other platforms — user message text never has meaningful leading/trailing whitespace.

### Result
After the second fix, question summaries on Gemini display clean text without the "You said" accessibility prefix. Confirmed working on Firefox/Linux after a full browser restart. The fix is a no-op on other platforms where the prefix doesn't exist.

---

## [6.2] - 2026-02-12

### Problem
Opening the Navigate sidebar on **Claude Code** (`claude.ai/code`) showed the sidebar correctly (since the hostname is still `claude.ai`) but detected **0 questions** — no user messages appeared in the navigation list.

### Technical Root Cause
Claude Code uses a completely different DOM structure from Claude Chat. The existing selectors for Claude relied on `data-testid` attributes (`user-human-turn`, `user-message`) and the `.font-user-message` class — **none of which exist in Claude Code's DOM**.

In Claude Code, the conversation uses a Tailwind CSS-based layout where:
- Each turn is wrapped in a `div.pb-4` container
- **User messages** are right-aligned via `div.flex.flex-col.items-end.ml-auto`
- The message bubble uses `div.bg-bg-200.rounded-lg`
- Text content sits inside nested `<p>` tags
- There are no `data-testid` attributes anywhere in the DOM

### Method Chosen and Why
Added a **fallback selector chain** in `getUserMessages()` that activates only when the existing Claude Chat selectors find nothing:

```javascript
const bubbles = document.querySelectorAll('div.bg-bg-200.rounded-lg');
messages = Array.from(bubbles).filter(function(bubble) {
    return bubble.closest('.items-end');
});
```

This approach:
1. **Selects message bubbles** (`bg-bg-200.rounded-lg`) — the visible rounded containers that hold message text
2. **Filters for user messages only** by checking if the bubble is inside a right-aligned container (`.items-end`) — assistant messages are left-aligned and won't match
3. **Works well with existing scroll/highlight logic** — the bubble element is ideal for both `scrollIntoView()` and the background color highlight animation since it's the visually prominent container
4. **Non-breaking** — only activates as a last fallback after all Claude Chat selectors fail, so Claude Chat continues to work unchanged

---

## [6.1] - 2026-02-09

### Problem
On Linux (NVIDIA DGX Spark, Ubuntu-based), clicking the Navigate button in Firefox caused a second identical button to appear. Both buttons were fully functional — hovering expanded either one, clicking either one toggled the panel — but having two buttons caused state corruption. Clicking the "stationary" duplicate would close the panel normally, but clicking the "correct" button that moved with the panel would sometimes cause all questions to disappear or their labels to shorten from "Question #1" to "Q1". This happened across all four AI platforms (Claude, ChatGPT, Grok, Gemini) but only on Linux Firefox — the exact same script worked perfectly on macOS Firefox.

### Technical Root Cause
The v6.0 code had a **race condition** between three systems that fire during page load:

1. **Initialization code** at the bottom of the script runs `document.body.appendChild(createToggle())`, which adds the toggle button to the DOM.
2. **DOM Guardian** — a `MutationObserver` watching `document.body` with `{ childList: true, subtree: true }` — immediately detects this DOM mutation and fires its callback.
3. **`ensureElementsExist()`** — called by the DOM Guardian's callback — checks `if (!document.getElementById('ai-nav-toggle'))`. If this check runs *during* the `appendChild` call (before the browser has finished attaching the element), it evaluates to `true` and creates a second toggle.

The key difference between operating systems: **macOS Firefox batches MutationObserver callbacks asynchronously**, so by the time the observer fires, both `createToggle()` and `createPanel()` have already been appended and their IDs are queryable. **Linux Firefox fires the observer synchronously during the DOM mutation itself**, so `getElementById` can't find the element that's in the middle of being attached.

A secondary cause: Tampermonkey on Linux Firefox occasionally fires the entire userscript twice during the document lifecycle (related to how Firefox on Linux handles `document-start` vs `document-end` timing), which would create two complete, independent sets of elements with no awareness of each other.

The state corruption (disappearing questions, "Question #1" labels shortening to "Q1") happened because two independent toggle buttons maintained their own click handlers but shared the same `isOpen` state variable and the same panel. Clicking one button would flip `isOpen` and trigger `scanConversation()`, but the other button's state was now out of sync, leading to the panel being "open" according to one button and "closed" according to the other.

### Method Chosen and Why
We needed to prevent duplication at every possible entry point, since the duplication could come from multiple sources (script double-firing, MutationObserver racing, or both). A single fix wouldn't be sufficient because the script fires twice through *different* code paths. We chose four complementary guards:

1. **Execution guard (`window._aiNavAlreadyLoaded`)** — A flag on the global `window` object, checked at the very top of the IIFE before any code runs. If `true`, the entire script exits immediately. We chose `window` (not a local variable) because each Tampermonkey execution gets its own closure, but they share the same `window`. This catches the "Tampermonkey fires twice" scenario.

2. **Duplicate element cleanup in `ensureElementsExist()`** — Before checking if elements are missing, we first check if *multiple* elements with the same ID exist and remove the extras. This is a safety net — even if a duplicate somehow gets created through a path we didn't anticipate, it gets cleaned up the next time any code path calls `ensureElementsExist()`.

3. **Debounced DOM Guardian (200ms)** — Instead of the MutationObserver callback immediately calling `ensureElementsExist()`, it now sets a 200ms `setTimeout` and clears any previous timeout. This means rapid-fire mutations (like our own initialization appending multiple elements) get batched into a single check after everything settles. 200ms was chosen because it's long enough for initialization to complete but short enough that a genuinely removed element gets re-injected quickly. This directly addresses the race condition — the observer still fires during our `appendChild`, but it just sets a timer instead of immediately checking/injecting.

4. **Guarded initialization** — The `document.body.appendChild(createToggle())` calls at the bottom are now wrapped in `if (!document.getElementById('ai-nav-toggle'))`. This prevents the initialization code itself from creating duplicates if it somehow runs after the DOM Guardian has already created elements. Belt and suspenders.

### How It Fixed Things
After applying all four guards, the duplicate button is completely eliminated on Linux Firefox. The execution guard catches the most common case (double script firing). The debounced observer prevents the race condition. The guarded initialization and duplicate cleanup serve as safety nets. Together, they ensure exactly one toggle and one panel exist regardless of how many times or in what order the code paths execute.

### What Didn't Work (Red Herrings)
During debugging, we also observed the ChatGPT button being invisible and Claude showing 0 questions. We spent time investigating these as potential script bugs:
- **Attempted fix: Broader CSS selectors for Claude** — Added fallback selectors like `[data-testid*="human"]` and filtered `[data-testid*="user"]` queries. Did not help because the original selectors were correct.
- **Attempted fix: Changed ChatGPT icon from ⏣ to ⬡** — Theorized that the benzene ring character (U+23E3) wasn't rendering on Linux's default fonts. Changed to white hexagon (U+2B21). Did not help because the icon was rendering fine.
- **Attempted fix: Added scan retry logic** — Created `scanWithRetry()` that would retry up to 5 times at 1.5-second intervals if 0 messages were found on a conversation page. Did not help.

All three issues turned out to be caused by **system resource exhaustion** on the DGX Spark — too many Firefox tabs open, system under memory pressure. Symptoms included keyboard input freezing and pages not rendering correctly. A system reboot resolved all rendering issues without any code changes. We reverted all unnecessary patches to keep the codebase clean.

**Lesson learned:** On resource-constrained systems with many browser tabs open, rule out system-level issues (`free -h`, `htop`) before debugging the script.

---

## [6.0] - 2026-02-07

### Changed
- **New hover-expand button design** — Button now shows only the platform icon by default, and smoothly expands to reveal "Navigate" text on hover. Cleaner look with a smaller screen footprint.
- **Platform-specific icons** — Each platform now has a unique symbol on the toggle button instead of a generic 📍 pin emoji:
  - Claude: ✳ (eight-spoked asterisk — evokes Anthropic's starburst logo)
  - ChatGPT: ⏣ (benzene ring — evokes OpenAI's hexagonal logo)
  - Grok: X (xAI / X branding)
  - Gemini: ✦ (four-pointed star — evokes Gemini's sparkle)
- Icons use common Unicode symbols to avoid any trademark, copyright, or proprietary issues with company logos

### Design Notes
The hover-expand design was chosen to balance minimalism with discoverability. The icon-only resting state keeps the button unobtrusive, while the hover expansion ensures users can always confirm what the button does. This design also scales well for potential future feature buttons (Search, Settings, etc.) that could stack alongside Navigate.

---

## [5.0] - 2026-02-07

### Problem
On Gemini in Chrome, the Navigate button appeared on screen but clicking it did nothing — the sidebar panel never slid out. The button worked fine on Firefox. It sometimes worked immediately after first installing the script, but broke after a page refresh.

### Technical Root Cause
Gemini enforces a **Trusted Types Content Security Policy (CSP)** on Chrome. This is a browser security feature that blocks all direct `innerHTML` assignments to prevent Cross-Site Scripting (XSS) attacks.

Our script (v4.0) was using `innerHTML` to build the panel contents — the header, refresh button, question list, and empty state message. When the script ran on Gemini in Chrome, every single `innerHTML` assignment was silently blocked by the CSP. The result: the panel `<div>` was created and appended to the DOM, but it was completely empty inside. The toggle button would technically slide open an empty, zero-height, invisible panel — making it look like the button was completely broken.

DevTools Console showed: `TypeError: Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.`

This only affected Chrome because Firefox does not enforce Trusted Types CSP the same way.

A secondary problem was that Gemini is built on Angular and aggressively re-renders its DOM. Even when elements were successfully injected, Angular's change detection cycle could silently remove them. The button and panel would simply vanish without any error message, making the issue intermittent and hard to diagnose.

### Method Chosen and Why
**For the Trusted Types issue:** We replaced every instance of `innerHTML` with **programmatic DOM creation** using `document.createElement()`, `.textContent`, and `.appendChild()`. This approach is inherently Trusted Types compliant because you never assign raw HTML strings — you're building the DOM tree element by element. We created a reusable helper function `createElement(tag, attrs, children)` to keep the code readable despite the more verbose syntax.

**For Gemini's DOM re-rendering:** We added three defensive systems:
- **DOM Guardian** (MutationObserver) — continuously watches `document.body` and re-injects elements if Gemini removes them. This catches Angular's silent element removal.
- **SPA navigation hooks** — intercepts `history.pushState` and `history.replaceState` so elements survive when switching conversations (which Gemini handles as SPA route changes, not full page loads).
- **Periodic health check** — a `setInterval` running every 3 seconds on Gemini only, verifying elements are still in the DOM as a last line of defense.

We also merged two separate `addEventListener('click', ...)` handlers on the toggle button into a single unified handler (`handleToggleClick`), eliminating a potential race condition where both handlers could fire independently.

### How It Fixed Things
After replacing all `innerHTML` with programmatic DOM creation, the panel builds correctly on Gemini Chrome because no Trusted Types violation occurs. The three defensive systems ensure elements survive Gemini's aggressive re-rendering. The fix is backward-compatible — programmatic DOM creation works identically on all browsers, so no platform-specific code branching was needed.

---

## [4.0] - 2026-02-05

### Added
- Gemini (gemini.google.com) support with blue theme
- Platform-specific color themes for all four AI assistants

### Supported Platforms
- Claude (Orange)
- ChatGPT (White/Gray)
- Grok (Red)
- Gemini (Blue)

---

## [3.0] - 2026-02-05

### Added
- Grok (grok.com) support with red theme
- Updated color scheme: ChatGPT changed from green to white/grayscale

---

## [2.0] - 2026-02-05

### Added
- ChatGPT (chatgpt.com, chat.openai.com) support
- Site detection to apply different selectors per platform
- Platform-specific accent colors (Orange for Claude, Green for ChatGPT)

---

## [1.0] - 2026-02-05

### Added
- Initial release
- Claude.ai support
- Navigation sidebar with question bookmarks
- Smart summary generation (extracts questions or first sentences)
- Click-to-scroll with highlight animation
- Auto-refresh every 10 seconds while panel is open
- Dark theme UI
