# Bookmarks Feature — Implementation Spec

Design and implementation plan for real bookmark functionality, replacing the current hardcoded placeholder panel.

**Last updated:** 2026-02-22  
**Applies to:** v10.1+  
**Status:** Ready for implementation  
**Depends on:** `getAIMessages()` selectors per platform (also needed by Context Tracking)


> **v12.0 Phase 3 — bookmark navigation unified with jump-to-message.**
>
> `orbScrollToBookmark` previously had its own resolution path ending in
> `els[bookmark.msgIndex]`. With ~3 of 147 turns mounted, that positional fallback resolved
> to an *unrelated* message and scrolled to and highlighted it as if correct — a confident
> wrong answer with no error path. **It is deleted.**
>
> Bookmarks now resolve by message uuid and, when the target is not mounted, route through
> the same `ciJumpToFullPathIndex()` settle loop Navigate uses. Resolution order: uuid match
> against mounted rows → legacy `(text, index)` hash → pre-v12.0 raw-`textContent` hash →
> settle loop → honest failure. Legacy records migrate to a uuid the first time they are
> positively identified.

> **v12.0 update — bookmarks are keyed to message UUIDs on Claude.**
>
> The scheme described below hashes `(text, msgIndex)` where `msgIndex` is a position in the live `getUserMessages()` NodeList. Claude now virtualizes its message list with recycling (~3 of 147 turns mounted), so that index changes as the user scrolls and records silently stop matching their own message. The `els[bookmark.msgIndex]` positional fallback was worse still: with ~3 elements mounted it resolved to an *unrelated* message and scrolled to it as if correct.
>
> Changes: records gained `schema: 2` and `msgUuid`, sourced from the conversation index (DEC-021). Resolution order is uuid → legacy `(text, index)` hash → pre-v12.0 raw-`textContent` hash. **The positional fallback is gone** — failing visibly beats a confident wrong answer. Legacy records migrate to a uuid the first time they are positively identified. Icon injection now guards on the recorded identity rather than mere presence, because a DOM node was observed being reused for a different message under recycling. (Whether Claude generally reuses nodes or destroys and rebuilds them has never been measured live — the mock models the latter. The guard is correct either way; see ROADMAP backlog item 8.)


---

## Table of Contents

1. [Overview](#overview)
2. [Current State (Placeholder)](#current-state-placeholder)
3. [Design: How Bookmarking Works](#design-how-bookmarking-works)
4. [Bookmarkable Entities](#bookmarkable-entities)
5. [Icon Injection Mechanism](#icon-injection-mechanism)
6. [AI Message Selectors Per Platform](#ai-message-selectors-per-platform)
7. [Sub-Entity Detection](#sub-entity-detection)
8. [Storage Format](#storage-format)
9. [Bookmark Panel (Replaces Placeholder)](#bookmark-panel-replaces-placeholder)
10. [Surviving Re-renders and Virtual Scroll](#surviving-re-renders-and-virtual-scroll)
11. [Edge Cases](#edge-cases)
12. [Implementation Order](#implementation-order)
13. [Testing Checklist](#testing-checklist)

---

## Overview

Bookmarks let users pin important messages, code blocks, file downloads, or other entities within a conversation for quick access later. Instead of scrolling through a long chat to find "that code block Claude gave me" or "the markdown file from earlier," users click a bookmark icon that appears on hover, then access all bookmarks from the Bookmarks panel.

The feature injects small bookmark icons directly onto chat messages and sub-entities (code blocks, files, etc.) in the platform's DOM. This is the same technique used for the orbital sidebar itself — `createElement()` + `appendChild()` into the platform's page.

---

## Current State (Placeholder)

`orbBuildPanelBookmarks()` (line 1769) renders 3 hardcoded fake bookmarks:

```javascript
var items = [
    { type: '📌 Response', text: 'The context window for Claude is 200K tokens...', meta: 'Msg #14' },
    { type: '📌 Question', text: 'Difference between context tracking and rate limit tracking?', meta: 'Msg #8' },
    { type: '📌 Code', text: 'function estimateContextUsage() { const messages = getAll()...', meta: 'Msg #22' },
];
```

This entire function will be replaced with a dynamic panel that reads from `GM_getValue` storage.

---

## Design: How Bookmarking Works

### User Flow

1. User hovers over any message (theirs or AI's) → a subtle bookmark icon (📌 or ⚑) appears in the top-right corner of the message
2. User hovers over a code block or file download within an AI response → a separate bookmark icon appears on that specific sub-entity
3. User clicks the icon → it toggles to "bookmarked" state (filled/colored icon), bookmark is saved to persistent storage
4. User opens the Bookmarks panel → sees all bookmarked items with previews, organized by position in conversation
5. User clicks a bookmark in the panel → page scrolls to that message/entity
6. User clicks the icon again on an already-bookmarked item → bookmark is removed

### Visual Design — Bookmark Icon

**Idle (not bookmarked):**
- Icon: outline bookmark/flag (⚑ or a simple SVG bookmark shape)
- Appears only on hover over the message container
- Semi-transparent, positioned in the top-right corner of the message
- Small size: ~20×20px, doesn't interfere with message content
- Slight background pill for contrast on varying message backgrounds

**Active (bookmarked):**
- Icon: filled bookmark/flag in platform accent color
- Always visible (doesn't require hover) — so user can see at a glance which messages are bookmarked
- Same position and size as idle state
- Subtle glow or accent-colored background pill

**Sub-entity icons (code blocks, files):**
- Smaller: ~16×16px
- Positioned top-right of the code block header or file attachment container
- Same idle/active behavior as message-level icons

---

## Bookmarkable Entities

### Tier 1 — Message-level (implement first)

| Entity | Description | Identifier |
|--------|-------------|------------|
| **User message** | Any message the user sent | Content hash of first 200 chars |
| **AI message** | Any AI/assistant response | Content hash of first 200 chars |

### Tier 2 — Sub-entity (implement second)

| Entity | Description | Detection |
|--------|-------------|-----------|
| **Code block** | Fenced code in AI responses | `pre > code` or `pre.code-block` elements within AI messages |
| **File/download** | Files Claude creates, attachments | Platform-specific: Claude uses download links within responses |
| **Artifact** | Claude artifacts, rendered previews | Claude-specific: artifact containers within responses |

### Tier 3 — Future consideration

| Entity | Description |
|--------|-------------|
| **Image** | Generated or uploaded images within responses |
| **Table** | Data tables in AI responses |
| **Selected text** | User-selected passage (Option C from design discussion) |

**Implementation priority:** Start with Tier 1 (whole messages). Layer Tier 2 once message-level bookmarks are solid. Tier 3 is future work.

---

## Icon Injection Mechanism

### Architecture

The bookmark system hooks into the existing `MutationObserver` / DOM Guardian cycle. When messages are detected in the DOM:

```
MutationObserver detects DOM change
  → scanConversation() runs (existing)
  → NEW: injectBookmarkIcons() runs
    → For each message element (user + AI):
      → Check if icon already injected (data attribute guard)
      → Create icon element
      → Position relative to message container
      → Attach click handler
      → Check storage: is this message bookmarked?
      → Set icon state (outline vs filled)
    → For each sub-entity within AI messages:
      → Same flow, scoped to the sub-entity element
```

### Icon Creation

```javascript
function createBookmarkIcon(entityEl, entityType, entityId) {
    // Guard against duplicate injection
    if (entityEl.querySelector('[data-acn-bookmark]')) return;

    var icon = createElement('div', {
        className: 'acn-bm-icon',
        textContent: '⚑',  // or SVG
    });
    icon.setAttribute('data-acn-bookmark', entityId);
    icon.setAttribute('data-acn-bm-type', entityType); // 'user-msg', 'ai-msg', 'code', 'file'

    // Check if already bookmarked
    var bookmarks = getBookmarks();
    if (bookmarks[entityId]) {
        icon.classList.add('acn-bm-active');
    }

    icon.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        toggleBookmark(entityId, entityType, entityEl);
        icon.classList.toggle('acn-bm-active');
    });

    // Injection point: position relative to the message container
    entityEl.style.position = entityEl.style.position || 'relative';
    entityEl.appendChild(icon);
}
```

### CSS for Bookmark Icons

```css
/* Bookmark icon — appears on hover, always visible when active */
.acn-bm-icon {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
    z-index: 10;
    pointer-events: auto;
    user-select: none;
}

/* Show on message hover */
*:hover > .acn-bm-icon {
    opacity: 1;
}

/* Always visible when bookmarked */
.acn-bm-icon.acn-bm-active {
    opacity: 1;
    background: var(--acn-accent, #d97706);
    color: #fff;
}

.acn-bm-icon:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.2);
}

/* Sub-entity icons are smaller */
.acn-bm-icon.acn-bm-sub {
    width: 18px;
    height: 18px;
    font-size: 11px;
    top: 2px;
    right: 2px;
}
```

### Injection Points Per Entity Type

| Entity | `position:relative` target | Icon position |
|--------|---------------------------|---------------|
| User message | The message bubble element returned by `getUserMessages()` | Top-right of bubble |
| AI message | The message container returned by `getAIMessages()` | Top-right of container |
| Code block | The `<pre>` element (or its wrapper if platform wraps it) | Top-right of code block, below any existing copy button |
| File download | The download link/button container | Inline next to the download button |

**Platform-specific positioning:** Some platforms use deeply nested structures where the visual "message bubble" is a child of the element returned by the selector. The icon should attach to the innermost visual container, not the outermost wrapper. Each platform entry in `PLATFORMS` should specify a `bookmarkAnchor` function that, given the message element, returns the best element to attach the icon to:

```javascript
// Example for Claude
bookmarkAnchor: function (msgEl) {
    // The visual bubble is the element itself for user messages
    // For AI messages, it might be a child container
    return msgEl;
}
```

Default: return the message element itself. Override per platform where needed.

---

## AI Message Selectors Per Platform

These are needed by bookmarks AND by context tracking (shared dependency). Based on DOM-REFERENCE.md research:

### Orbital Platforms (5 — priority)

| Platform | AI message selector strategy | DOM Reference notes |
|----------|------------------------------|---------------------|
| **Claude** | `[data-testid="assistant-turn"]` or elements with `items-start` that are NOT user messages | AI messages use `items-start`, no `bg-bg-300` |
| **ChatGPT** | `[data-message-author-role="assistant"]` | Direct attribute match, same pattern as user messages |
| **Grok** | Message wrappers with `items-start` + `justify-start`, or `data-message-id="msg_*"` (no `umsg_` prefix) | User messages use `umsg_` prefix, AI use `msg_` prefix |
| **Gemini** | `<model-response>` custom element, or `.response-container` / `.model-response-text` | Angular custom elements, distinct from `<user-query>` |
| **Perplexity** | Answer containers — the sibling/child of `.group\/query` elements that contain the AI response | Search/answer pairs, not traditional chat bubbles |

### IDE Platforms (7 — lower priority, implement later)

| Platform | AI message selector strategy |
|----------|------------------------------|
| **Bolt** | Elements with `data-message-id` that do NOT have `.self-end` |
| **Lovable** | Elements with `justify-start` within the chat log |
| **Replit** | `[class*="_chatMessage_"]` without `_isUser_` class |
| **V0** | `[data-testid="message"]` with `origin-left items-start` |
| **Base44** | `[id^="message-"]` with `justify-start` (not `justify-end`) |
| **Emergent** | `[data-message-id]` without `.self-end` |
| **Firebase Studio** | `[class*="_chatMessage_"]` without `_isUser_` class |

### Implementation Pattern

Add `getAIMessages()` to each PLATFORMS entry, mirroring the existing `getUserMessages()` pattern:

```javascript
// Claude example
getAIMessages: function () {
    var messages = document.querySelectorAll('[data-testid="assistant-turn"]');
    if (messages.length === 0) {
        // Fallback: find message containers that aren't user messages
        var allTurns = document.querySelectorAll('[data-testid$="-turn"]');
        messages = Array.from(allTurns).filter(function (el) {
            return !el.matches('[data-testid="user-human-turn"]');
        });
    }
    return messages;
},
```

**Note:** These selectors need live verification on each platform, same process as `getUserMessages()`. The selectors above are research-based starting points from DOM-REFERENCE.md. Expect the same "annoying but doable" fallback-chain work that went into user message selectors.

---

## Sub-Entity Detection

Within AI messages, scan for bookmarkable sub-entities:

### Code Blocks

Most platforms render fenced code as `<pre><code>` or `<pre>` with a language class. Detection:

```javascript
function findCodeBlocks(aiMsgEl) {
    // Universal: most platforms use standard pre>code
    var blocks = aiMsgEl.querySelectorAll('pre');
    return Array.from(blocks).filter(function (pre) {
        // Filter out tiny one-liners (inline code that got wrapped in pre)
        return pre.textContent.trim().length > 50;
    });
}
```

Platform-specific refinements may be needed if platforms wrap code blocks in custom containers (e.g., with copy buttons, language labels). The bookmark icon should attach to the outermost code block wrapper so it sits near the existing copy button.

### File Downloads (Claude-specific for now)

Claude's "Create files" feature renders download links in AI responses. Detection:

```javascript
function findFileEntities(aiMsgEl) {
    // Claude: file downloads appear as links or button-like elements
    // Look for elements containing download indicators
    var links = aiMsgEl.querySelectorAll('a[download], a[href*="/download/"]');

    // Also check for Claude's artifact/file preview containers
    var artifacts = aiMsgEl.querySelectorAll('[data-testid*="artifact"], [class*="artifact"]');

    return Array.from(links).concat(Array.from(artifacts));
}
```

**Note:** File entity detection is highly platform-specific and may require live DOM inspection. Start with Claude (since that's where the user's main pain point is — scrolling up to find generated files), add other platforms as patterns are confirmed.

---

## Storage Format

Bookmarks persist across page reloads using `GM_setValue` / `GM_getValue`.

### Storage Key

```javascript
var STORAGE_KEY = 'acn-bookmarks-v1';
```

Single key stores all bookmarks as a JSON object, keyed by conversation identifier.

### Data Structure

```javascript
{
    // Keyed by conversation URL (normalized — strip query params, fragments)
    "https://claude.ai/chat/abc123": {
        "bookmarks": [
            {
                "id": "bm_a1b2c3",              // unique bookmark ID
                "entityType": "user-msg",         // 'user-msg' | 'ai-msg' | 'code' | 'file'
                "contentHash": "d4e5f6a7b8c9",   // hash of first 200 chars for re-identification
                "preview": "How does compaction work in Claude?",  // truncated preview text
                "msgIndex": 14,                   // position in conversation (0-based)
                "parentMsgIndex": null,            // for sub-entities: index of parent AI message
                "subEntityIndex": null,            // for sub-entities: nth code block / file in that message
                "createdAt": 1708646400000,        // timestamp
                "platform": "claude"               // platform ID
            },
            {
                "id": "bm_x9y8z7",
                "entityType": "code",
                "contentHash": "e1f2a3b4c5d6",
                "preview": "function setupClaudeSSEInterceptor() {\n    var pageWindow = ...",
                "msgIndex": 22,
                "parentMsgIndex": 22,
                "subEntityIndex": 0,               // first code block in message 22
                "createdAt": 1708647200000,
                "platform": "claude"
            }
        ]
    },
    "https://chatgpt.com/c/xyz789": {
        "bookmarks": [ ... ]
    }
}
```

### Content Hash for Re-identification

After a page reload, the DOM is rebuilt fresh. We need to match stored bookmarks back to their DOM elements. Content hash of the first 200 characters provides a stable identifier:

```javascript
function contentHash(text) {
    // Simple hash — not cryptographic, just needs to be stable and fast
    var str = text.substring(0, 200).trim();
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}
```

On page load / after scan, iterate through detected messages, compute their content hash, and match against stored bookmarks to restore icon states.

### Conversation URL Normalization

```javascript
function normalizeConversationUrl() {
    // Strip query params and fragments — just protocol + host + path
    return window.location.origin + window.location.pathname;
}
```

### Storage Helpers

```javascript
function getBookmarks() {
    var raw = GM_getValue(STORAGE_KEY, '{}');
    try { return JSON.parse(raw); } catch (e) { return {}; }
}

function getConversationBookmarks() {
    var all = getBookmarks();
    var url = normalizeConversationUrl();
    return (all[url] && all[url].bookmarks) || [];
}

function saveBookmark(bookmark) {
    var all = getBookmarks();
    var url = normalizeConversationUrl();
    if (!all[url]) all[url] = { bookmarks: [] };
    all[url].bookmarks.push(bookmark);
    GM_setValue(STORAGE_KEY, JSON.stringify(all));
}

function removeBookmark(bookmarkId) {
    var all = getBookmarks();
    var url = normalizeConversationUrl();
    if (!all[url]) return;
    all[url].bookmarks = all[url].bookmarks.filter(function (b) {
        return b.id !== bookmarkId;
    });
    if (all[url].bookmarks.length === 0) delete all[url];
    GM_setValue(STORAGE_KEY, JSON.stringify(all));
}

function toggleBookmark(entityId, entityType, entityEl) {
    var existing = getConversationBookmarks().find(function (b) {
        return b.contentHash === entityId;
    });

    if (existing) {
        removeBookmark(existing.id);
    } else {
        var preview = (entityEl.textContent || '').trim().substring(0, 120);
        saveBookmark({
            id: 'bm_' + Date.now().toString(36),
            entityType: entityType,
            contentHash: entityId,
            preview: preview,
            msgIndex: getMsgIndex(entityEl),
            parentMsgIndex: entityType === 'code' || entityType === 'file'
                ? getMsgIndex(entityEl.closest('[data-acn-msg]'))
                : null,
            subEntityIndex: null, // computed during injection
            createdAt: Date.now(),
            platform: platform.id
        });
    }
}
```

### Storage Size Considerations

`GM_setValue` has no hard limit but shouldn't be abused. Each bookmark is ~300 bytes. At 50 bookmarks per conversation and 100 conversations, that's ~1.5MB — well within reason. If it ever becomes an issue, implement LRU eviction of old conversations.

### Tampermonkey Grant

Add `@grant GM_setValue` and `@grant GM_getValue` if not already present. (Check — may already be granted for settings persistence.)

---

## Bookmark Panel (Replaces Placeholder)

Replace `orbBuildPanelBookmarks()` with a dynamic panel that reads from storage.

### Panel Layout

```
┌─────────────────────────────────┐
│ ⚑ Bookmarks                  ✕ │  ← header with close button
├─────────────────────────────────┤
│ 5 bookmarks                     │  ← count from storage (dynamic)
├─────────────────────────────────┤
│ ┌─ Q#3 ─────────────────────┐  │
│ │ 📌 Your question           │  │  ← user message bookmark
│ │ How does compaction work   │  │
│ │ in Claude conversations?   │  │
│ └────────────────────────────┘  │
│ ┌─ A#14 ────────────────────┐  │
│ │ 📌 AI response             │  │  ← AI message bookmark
│ │ The context window for     │  │
│ │ Claude is 200K tokens...   │  │
│ └────────────────────────────┘  │
│ ┌─ A#22 / Code ─────────────┐  │
│ │ 💻 Code block              │  │  ← code sub-entity bookmark
│ │ function setupSSE() {      │  │
│ │   var pageWindow = ...     │  │
│ └────────────────────────────┘  │
│ ┌─ A#30 / File ─────────────┐  │
│ │ 📄 CONTEXT-TRACKING.md     │  │  ← file sub-entity bookmark
│ │ Context Window & Token     │  │
│ │ Tracking — Research...     │  │
│ └────────────────────────────┘  │
│                                 │
│ ┌───────────────────────────┐   │
│ │ 🗑 Clear all bookmarks     │   │  ← destructive, requires confirm
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

### Panel Behavior

- **Empty state:** "No bookmarks yet. Hover over any message and click ⚑ to bookmark it."
- **Click a bookmark:** Scroll to that message in the conversation (reuse `orbScrollToQuestion()` logic, generalized to any element)
- **Remove button:** Each bookmark entry has a small ✕ to remove it individually
- **Clear all:** At the bottom, requires confirmation ("Are you sure? This removes all bookmarks for this conversation.")
- **Ordering:** Bookmarks displayed in conversation order (by `msgIndex`), not by creation time
- **Type badges:** Visual distinction between user messages (speech bubble icon), AI messages (robot/star icon), code (brackets icon), files (document icon)

### Scroll-to Function

Generalize the existing `orbScrollToQuestion()` to handle any bookmarked element:

```javascript
function orbScrollToBookmark(bookmark) {
    // Re-find the element by content hash
    var allMessages = getUserMessages().concat(
        (platform.getAIMessages ? platform.getAIMessages() : [])
    );

    var targetEl = null;
    for (var i = 0; i < allMessages.length; i++) {
        if (contentHash(allMessages[i].textContent) === bookmark.contentHash) {
            targetEl = allMessages[i];
            break;
        }
    }

    // For sub-entities, find within the parent message
    if (targetEl && bookmark.entityType === 'code' && bookmark.subEntityIndex !== null) {
        var codeBlocks = findCodeBlocks(targetEl);
        if (codeBlocks[bookmark.subEntityIndex]) {
            targetEl = codeBlocks[bookmark.subEntityIndex];
        }
    }

    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief highlight animation
        targetEl.classList.add('acn-bm-flash');
        setTimeout(function () { targetEl.classList.remove('acn-bm-flash'); }, 1500);
    }
}
```

### Flash Highlight CSS

```css
.acn-bm-flash {
    animation: acnBmFlash 1.5s ease;
}

@keyframes acnBmFlash {
    0%   { box-shadow: 0 0 0 0 var(--acn-accent); }
    30%  { box-shadow: 0 0 0 4px var(--acn-accent); }
    100% { box-shadow: 0 0 0 0 transparent; }
}
```

---

## Surviving Re-renders and Virtual Scroll

### SPA Navigation (conversation change)

When the URL changes (user switches conversations), the bookmark icons from the old conversation become stale. On URL change:

1. Clear all injected bookmark icons (remove elements with `[data-acn-bookmark]`)
2. Load bookmarks for the new conversation URL from storage
3. Re-inject icons as messages appear in the new conversation

Wire into the existing SPA navigation hooks (`pushState` / `popstate` listeners).

### Platform Re-renders

SPA frameworks (React, Angular) may destroy and recreate message DOM nodes during updates. When this happens:

1. MutationObserver detects new/changed nodes
2. `scanConversation()` runs and rebuilds the question list
3. `injectBookmarkIcons()` runs — the `data-acn-bookmark` guard on the element prevents duplicates on surviving elements, and new elements get fresh icons

The bookmark data in `GM_setValue` is the source of truth — DOM icons are just a visual reflection. If they disappear due to re-render, they get re-injected on the next observer cycle.

### Virtual Scroll (Gemini, Emergent)

Messages that scroll out of the viewport get removed from DOM, then recreated when scrolled back. Same as re-render: icons re-injected when the element reappears. Content hash matching ensures the correct active/inactive state is restored.

### Streaming Messages

AI messages stream in progressively. The content hash changes with each chunk. Don't inject bookmark icons on messages that are still streaming — wait until the message is complete. Detection:

```javascript
function isMessageStreaming(el) {
    // Claude: data-is-streaming attribute
    if (el.hasAttribute('data-is-streaming')) return true;
    if (el.closest('[data-is-streaming]')) return true;
    // ChatGPT: result-streaming class
    if (el.classList.contains('result-streaming')) return true;
    if (el.closest('.result-streaming')) return true;
    // Generic: check if element is the last AI message and very recently added
    return false;
}
```

Inject bookmark icon only after streaming completes.

---

## Edge Cases

### Content hash collisions

If the user sends the same message twice (e.g., "yes"), the content hash will be identical. Mitigation: include `msgIndex` in the hash input, not just the text content. This makes the hash position-dependent.

```javascript
function contentHash(text, msgIndex) {
    var str = (msgIndex || 0) + ':' + text.substring(0, 200).trim();
    // ... hash computation
}
```

### Edited messages

Some platforms let users edit sent messages. If the text changes, the content hash changes, and the bookmark loses its match. Acceptable for v1 — bookmark just won't highlight the edited message. Could add a fuzzy matching fallback in v2.

### Very long conversations

With 100+ messages, injecting bookmark icons on every message could be expensive. Optimization: only inject icons on messages currently in the viewport, using an IntersectionObserver. Defer for v1 unless performance issues appear.

### Cross-session bookmark staleness

If a conversation is deleted on the platform, the bookmarks persist in GM_setValue as orphans. Add a periodic cleanup: when loading bookmarks, if the conversation URL returns no messages after page load, offer to clear stale bookmarks. Low priority — orphan data is small.

---

## Implementation Order

### Phase 1: Message-level bookmarks on orbital platforms

1. Add `getAIMessages()` to Claude, ChatGPT, Grok, Gemini, Perplexity (shared with context tracking)
2. Implement `injectBookmarkIcons()` for whole user and AI messages
3. Implement storage layer (`GM_setValue` / `GM_getValue`)
4. Replace placeholder panel with dynamic bookmark panel
5. Implement scroll-to-bookmark with highlight flash
6. Wire into MutationObserver for re-injection on re-render
7. Wire into SPA navigation hooks for conversation switching
8. Test across 5 orbital platforms

### Phase 2: Sub-entity bookmarks

9. Implement `findCodeBlocks()` — detect code blocks within AI messages
10. Inject sub-entity bookmark icons on code blocks
11. Implement `findFileEntities()` — Claude file downloads (platform-specific)
12. Inject sub-entity bookmark icons on file entities
13. Update panel to show entity type badges and previews
14. Test sub-entity scroll-to targeting

### Phase 3: Polish and IDE platforms

15. Add `getAIMessages()` to Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio
16. Verify bookmark injection works on IDE platforms
17. Handle streaming message detection per platform
18. Performance optimization if needed (IntersectionObserver for large conversations)

---

## Testing Checklist

### Core functionality
- [ ] Bookmark icon appears on hover over user messages (all 5 orbital platforms)
- [ ] Bookmark icon appears on hover over AI messages (all 5 orbital platforms)
- [ ] Clicking icon toggles bookmark on/off (icon visual changes)
- [ ] Bookmarked icons remain visible even without hover
- [ ] Bookmarks persist across page reload (GM_setValue)
- [ ] Bookmark panel shows real bookmarks, not placeholder data
- [ ] Clicking bookmark in panel scrolls to correct message
- [ ] Highlight flash animation plays on scroll-to
- [ ] Removing bookmark from panel updates icon state on message
- [ ] "Clear all" requires confirmation and works

### Resilience
- [ ] Icons survive platform re-renders (React/Angular reconciliation)
- [ ] Icons re-inject after virtual scroll (Gemini, Emergent)
- [ ] Icons clear and reload on conversation switch (SPA navigation)
- [ ] No icons injected on still-streaming messages
- [ ] Duplicate icon injection prevented (data attribute guard)

### Sub-entities (Phase 2)
- [ ] Bookmark icon appears on code blocks within AI messages
- [ ] Bookmark icon appears on file downloads (Claude)
- [ ] Sub-entity bookmarks scroll to the specific code block, not just the message
- [ ] Panel shows entity type badges (code, file, etc.)

### Platform-specific
- [ ] Claude: user messages, AI messages, code blocks, file downloads
- [ ] ChatGPT: user messages, AI messages, code blocks
- [ ] Grok: user messages, AI messages, code blocks
- [ ] Gemini: user messages, AI messages, code blocks (Trusted Types safe)
- [ ] Perplexity: user queries, AI answers

---

*This spec is referenced from V10-PLAN.md task #3. The `getAIMessages()` selectors are a shared dependency with Context Tracking (CONTEXT-TRACKING.md).*
