# Tools Panel — Implementation Spec

> **v12.7a update (2026-08-02) — this panel is now i18n-wired.**
> Every user-visible string in the Tools panel goes through `i18n()`. It previously rendered
> English literals unconditionally even though thirteen Korean translations already existed in
> `I18N.ko` — see TROUBLESHOOTING "v12.7a" and DEC-042. Section headers are `imageGallery` and
> `exports` (파일 내보내기); the export options are `exportFull` / `exportBookmarks` /
> `exportSummary` plus their `*Desc` keys. **`/Commands` is deliberately left in English.**
> When adding a string here, add the key to BOTH `en` and `ko` AND call `i18n()` — a key with no
> call site is invisible to every gate in this repo (`agent_docs/conventions.md` → i18n).


Rename the "Export" orbital feature to "Tools" and replace the placeholder panel with working utility functions. The panel is intentionally designed to be extensible — ship with solid core tools, add more based on community feedback and real-world usage.

**Last updated:** 2026-02-22  
**Applies to:** v10.1+  
**Status:** Ready for implementation  
**Depends on:** Task #0 (`getAIMessages()`), Task #3 (Bookmarks, for Bookmarks export), Task #5 (Summary, for Summary export)

> **v12.0 update — Export was the highest-severity casualty of virtualization.**
>
> `exportFullConversation()` built its output from a DOM scan and wrote a header reading `**Messages:** N` from that scan. On a virtualized Claude conversation it produced a file containing ~3% of the messages **under a count that looked authoritative**. This was ranked above the originally reported Navigate bug: a short navigation list is visible to the user, a truncated export file is not.
>
> Export now reads `_ciFullPath` (human + assistant, whole active path) when the index is available. It stamps `**Source:** complete conversation history (API)`, and surfaces any message marked `truncated` plus any use of the leaf-inference fallback in the header. When the index is unavailable it stamps `**Source:** on-screen messages only — DEGRADED` with an explicit warning block. **Export must never imply completeness it does not have.**
>
> Known gap: assistant text is joined from `content[]` blocks of type `text` only, so `tool_use` / `tool_result` output visible on screen is not included.
>
> Image gallery: the API's `files[]` array carries `file_kind`, `file_uuid`, `thumbnail_url`, `preview_url` and `thumbnail_asset` (with `image_width` / `image_height` / `primary_color`). That would convert the gallery from a selector chase into an API read *and* restore message association, which the current document-wide scan loses (`imagesOrphaned: true`, `msgIndex: -1`). Not implemented in v12.0.


---

## Table of Contents

1. [Overview](#overview)
2. [Current State (Placeholder)](#current-state-placeholder)
3. [Rename: Export → Tools](#rename-export--tools)
4. [Core Tools](#core-tools)
5. [Image Gallery](#image-gallery)
6. [Export: Full Conversation (MD)](#export-full-conversation-md)
7. [Export: Bookmarks Only (MD)](#export-bookmarks-only-md)
8. [Export: Summary (MD)](#export-summary-md)
9. [Panel Layout](#panel-layout)
10. [Download Mechanism](#download-mechanism)
11. [Extensibility](#extensibility)
12. [Implementation Details](#implementation-details)
13. [Testing Checklist](#testing-checklist)

---

## Overview

The Tools panel is the utility drawer — an Image Gallery for visual navigation and export functions, all using pure JavaScript DOM operations.

The panel launches with 4 tools: Image Gallery (thumbnail grid of all uploaded images with navigate and download), plus 3 exports. It's intentionally open-ended — the design leaves room for community-driven additions as real users discover workflows the original developer never anticipated. Ship what works, let usage drive the roadmap.

---

## Current State (Placeholder)

`orbBuildPanelExport()` (line 1831) renders 4 static option cards with no click handlers:
- Full Conversation, Bookmarks Only, Summary, Share Link

None are functional. The entire function gets replaced.

---

## Rename: Export → Tools

### ORB_FEATURES change

```javascript
// Before
{ id: 'export', icon: '\u2197', label: 'Export', panelId: 'acn-panel-export' },

// After
{ id: 'tools', icon: '\uD83D\uDD27', label: 'Tools', panelId: 'acn-panel-tools' },
```

**Icon choice:** 🔧 (wrench, `\uD83D\uDD27`) conveys "utility toolkit" clearly. Simple, universally recognized.

### Panel ID update

All references to `acn-panel-export` become `acn-panel-tools`. Function name changes from `orbBuildPanelExport()` to `orbBuildPanelTools()`.

---

## Core Tools

| # | Tool | Type | Description |
|---|------|------|-------------|
| 1 | Image Gallery | Visual browser | Thumbnail grid of all uploaded images, click to navigate or download |
| 2 | Full Conversation | Export (MD) | All messages formatted as markdown |
| 3 | Bookmarks Only | Export (MD) | Bookmarked messages as structured document |
| 4 | Summary | Export (MD) | Topics, map, key points as markdown |

Image Gallery is the lead tool — it's visual, immediately useful, and not available natively on any AI platform. Exports follow below it.

---

## Image Gallery

### Why This Matters

In a long debugging conversation, you might upload 8-10 screenshots: error messages, UI glitches, terminal output, layout comparisons. Later, finding "the screenshot where the hover zone was blocking the X button" means scrolling through the entire conversation. The Image Gallery shows every uploaded image as a clickable thumbnail in one place — click to navigate, click to download.

No AI platform offers this natively. It directly addresses a feature request from beta testers.

### How Images Work in AI Chat Platforms

When a user uploads an image, the platform:
1. Uploads it to their CDN (e.g., `https://files.claude.ai/...`)
2. Renders an `<img>` tag inside the user's message element
3. Stores the image server-side as part of the conversation data

**Persistence:** Images survive page refresh, browser restart, computer restart, and script updates. They persist as long as the conversation exists. Deleting the conversation removes images within 30 days (per platform data retention policies). Our gallery reads from the live DOM — we store nothing.

### Image Detection

The core query is universal: `querySelectorAll('img')`. The challenge is filtering out UI chrome (avatars, icons, logos, emoji, decorative elements) from real user-uploaded content images.

**Multi-layered filter strategy:**

```javascript
function getConversationImages() {
    var allImages = [];

    // Scan user messages for uploaded images
    var userMsgs = Array.from(platform.getUserMessages());
    var aiMsgs = platform.getAIMessages ? Array.from(platform.getAIMessages()) : [];
    var allMsgs = userMsgs.concat(aiMsgs);

    allMsgs.forEach(function (msgEl, idx) {
        var imgs = msgEl.querySelectorAll('img');

        imgs.forEach(function (img) {
            if (!isContentImage(img)) return;

            allImages.push({
                element: img,
                src: img.src,
                alt: img.alt || '',
                msgElement: msgEl,
                msgIndex: idx,
                isUserMsg: userMsgs.indexOf(msgEl) !== -1,
                width: img.naturalWidth || img.width || 0,
                height: img.naturalHeight || img.height || 0
            });
        });
    });

    return allImages;
}
```

**Filtering logic — reject non-content images:**

```javascript
function isContentImage(img) {
    // 1. Size filter: reject tiny images (icons, avatars, tracking pixels)
    var w = img.naturalWidth || img.width || parseInt(img.getAttribute('width')) || 0;
    var h = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || 0;
    if ((w > 0 && w < 50) || (h > 0 && h < 50)) return false;

    // 2. Hidden/decorative filter
    if (img.getAttribute('aria-hidden') === 'true') return false;
    if (img.getAttribute('role') === 'presentation') return false;

    // 3. Source filter: reject known non-content patterns
    var src = (img.src || '').toLowerCase();
    if (src.startsWith('data:image/svg')) return false; // inline SVG icons
    if (src.includes('avatar')) return false;
    if (src.includes('favicon')) return false;
    if (src.includes('emoji')) return false;
    if (src.includes('logo')) return false;

    // 4. Class/parent filter: reject images inside known UI chrome
    var parent = img.parentElement;
    while (parent && parent !== img.closest('[class*="message"]')) {
        var cls = (parent.className || '').toLowerCase();
        if (cls.includes('avatar') || cls.includes('icon') || cls.includes('toolbar')) {
            return false;
        }
        parent = parent.parentElement;
    }

    // 5. If image has loaded and is large enough, it's likely content
    if (w >= 50 && h >= 50) return true;

    // 6. If dimensions unknown (not yet loaded), keep it but mark uncertain
    // naturalWidth is 0 for images that haven't loaded yet
    if (w === 0 && h === 0) return true; // include by default, filter on render

    return true;
}
```

### Platform-Specific Notes

The `<img>` tag is universal HTML, so the core approach works on every platform. However, each platform has different UI chrome to filter:

| Platform | Common false positives to filter |
|----------|--------------------------------|
| Claude | User/assistant avatars, copy button icons, artifact preview thumbnails |
| ChatGPT | User avatar, GPT model icon, plugin icons, DALL-E generated images (may want to include these) |
| Grok | Profile pictures, reaction icons |
| Gemini | Google account avatar, suggestion chips with icons |
| Perplexity | Source favicons, citation thumbnails |

**DALL-E / AI-generated images (ChatGPT):** These appear in AI responses and are legitimate content images. Our filter should include them — they'll appear in the gallery with an "A#N" label instead of "Q#N".

**Future refinement:** Platform-specific filter overrides can be added to the PLATFORMS registry. For v10.1, the generic multi-layered filter should handle 90%+ of cases.

### Gallery Rendering

```javascript
function renderImageGallery(panel) {
    var images = getConversationImages();

    var header = createElement('div', {
        className: 'acn-tool-section-header',
        textContent: '\uD83D\uDDBC\uFE0F Image Gallery (' + images.length + ')'
    });
    panel.appendChild(header);

    if (images.length === 0) {
        var empty = createElement('div', {
            className: 'acn-gallery-empty',
            textContent: 'No images in this conversation'
        });
        panel.appendChild(empty);
        return;
    }

    var grid = createElement('div', { className: 'acn-gallery-grid' });

    images.forEach(function (imgData, i) {
        var card = createElement('div', { className: 'acn-gallery-card' });

        // Thumbnail — reuses the same src, CSS constrains the size
        var thumb = createElement('img', {
            className: 'acn-gallery-thumb',
            src: imgData.src,
            alt: imgData.alt || 'Image ' + (i + 1),
            loading: 'lazy'     // don't load all thumbnails at once
        });

        // Label: Q#3 or A#14
        var label = createElement('div', {
            className: 'acn-gallery-label',
            textContent: imgData.isUserMsg
                ? 'Q#' + (imgData.msgIndex + 1)
                : 'A#' + (imgData.msgIndex + 1)
        });

        // Action buttons container
        var actions = createElement('div', { className: 'acn-gallery-actions' });

        // Navigate button
        var navBtn = createElement('span', {
            className: 'acn-gallery-btn',
            textContent: '↗',
            title: 'Go to message'
        });
        navBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            imgData.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Brief highlight flash on the message
            imgData.msgElement.classList.add('acn-highlight-flash');
            setTimeout(function () {
                imgData.msgElement.classList.remove('acn-highlight-flash');
            }, 1500);
        });

        // Download button
        var dlBtn = createElement('span', {
            className: 'acn-gallery-btn',
            textContent: '⬇',
            title: 'Download image'
        });
        dlBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            downloadImage(imgData.src, 'image-' + (i + 1));
        });

        actions.appendChild(navBtn);
        actions.appendChild(dlBtn);

        card.appendChild(thumb);
        card.appendChild(label);
        card.appendChild(actions);

        // Click on thumbnail itself = navigate to message
        thumb.addEventListener('click', function () {
            imgData.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            imgData.msgElement.classList.add('acn-highlight-flash');
            setTimeout(function () {
                imgData.msgElement.classList.remove('acn-highlight-flash');
            }, 1500);
        });

        grid.appendChild(card);
    });

    panel.appendChild(grid);
}
```

### Image Download

Downloading from a CDN `src` has a cross-origin complication: the `<a download>` attribute only works for same-origin URLs. CDN URLs are cross-origin, so the browser may open them in a new tab instead of downloading.

**Strategy: try download, fall back to new tab.**

```javascript
function downloadImage(src, filename) {
    // Attempt 1: Fetch the image as a blob (works if CORS allows it)
    fetch(src, { mode: 'cors', credentials: 'include' })
        .then(function (response) {
            if (!response.ok) throw new Error('Fetch failed');
            return response.blob();
        })
        .then(function (blob) {
            // Create a local blob URL — this IS same-origin, so download works
            var blobUrl = URL.createObjectURL(blob);
            var link = createElement('a', {
                href: blobUrl,
                download: filename + getExtFromMime(blob.type)
            });
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(function () {
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            }, 100);
            showToast('Image downloaded');
        })
        .catch(function () {
            // Attempt 2: Open in new tab (user can right-click save)
            window.open(src, '_blank');
            showToast('Opened in new tab — right-click to save');
        });
}

function getExtFromMime(mimeType) {
    var map = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/gif': '.gif',
        'image/webp': '.webp'
    };
    return map[mimeType] || '.png';
}
```

The `credentials: 'include'` in the fetch is key — since we're on `claude.ai` and the images are on `files.claude.ai`, the browser will send auth cookies with the request, which means the CDN is more likely to allow the fetch. If CORS still blocks it, the user gets the image in a new tab with a clear toast telling them to right-click save.

### Gallery CSS

```css
.acn-gallery-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 8px 12px;
}

.acn-gallery-card {
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: border-color 0.15s ease;
}

.acn-gallery-card:hover {
    border-color: var(--acn-accent);
}

.acn-gallery-thumb {
    width: 100%;
    height: 80px;
    object-fit: cover;
    display: block;
}

.acn-gallery-label {
    font-size: 10px;
    color: #aaa;
    text-align: center;
    padding: 3px 0;
}

.acn-gallery-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: none;
    gap: 4px;
}

.acn-gallery-card:hover .acn-gallery-actions {
    display: flex;
}

.acn-gallery-btn {
    width: 20px;
    height: 20px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    cursor: pointer;
    color: #fff;
}

.acn-gallery-btn:hover {
    background: var(--acn-accent);
}

/* Highlight flash when navigating to a message */
.acn-highlight-flash {
    animation: acn-flash 1.5s ease;
}

@keyframes acn-flash {
    0%   { outline: 2px solid var(--acn-accent); outline-offset: 2px; }
    100% { outline: 2px solid transparent; outline-offset: 2px; }
}

.acn-gallery-empty {
    font-size: 12px;
    color: #666;
    padding: 12px;
    text-align: center;
    font-style: italic;
}
```

### Navigate Panel: 🖼️ Image Indicator

In addition to the gallery, each question in the Navigate panel's question list gets a small image indicator if that question included an uploaded image:

```javascript
// Inside the question list rendering loop (orbPopulateQuestions or similar)
function renderQuestionLabel(questionEl, index) {
    var label = 'Q#' + (index + 1) + ': ' + getPreviewText(questionEl);

    // Check if this question has a content image attached
    var imgs = questionEl.querySelectorAll('img');
    var hasContentImage = Array.from(imgs).some(isContentImage);

    if (hasContentImage) {
        label = '\uD83D\uDDBC\uFE0F ' + label;  // 🖼️ prefix
    }

    return label;
}
```

This reuses the same `isContentImage()` filter from the gallery, so both features stay in sync.

### Edge Cases

**No images in conversation:** Gallery section shows "No images in this conversation" in muted italic. Section still visible so users know the feature exists.

**Many images (20+):** The 3-column grid scrolls naturally within the panel. `loading="lazy"` on thumbnails prevents loading all images at once. Performance should be fine — browsers handle lazy-loaded image grids well.

**Broken/expired image URLs:** If an image fails to load (expired CDN URL, deleted conversation reopened from cache), the thumbnail shows a broken image icon. We could add an `onerror` handler to hide or replace broken thumbnails:

```javascript
thumb.addEventListener('error', function () {
    thumb.style.display = 'none';
    var fallback = createElement('div', {
        className: 'acn-gallery-thumb-fallback',
        textContent: '🖼️ ✕'
    });
    card.insertBefore(fallback, label);
});
```

**Images in AI responses:** Some platforms (ChatGPT with DALL-E) generate images in AI responses. These should be included in the gallery — they're labeled "A#N" to distinguish from user uploads "Q#N".

**Virtual scroll / lazy-rendered messages:** If the platform hasn't rendered older messages to the DOM yet (some use virtual scrolling), those images won't appear in the gallery until the user scrolls past them. This is a known limitation shared with Navigate's question detection — noted but not solvable without platform cooperation.

---

## Export: Full Conversation (MD)

### What it does

Scrapes all user and AI messages from the DOM, formats them as a clean markdown document, and triggers a file download.

### Output format

```markdown
# Conversation Export
**Platform:** Claude  
**Date:** 2026-02-22  
**Messages:** 42 (18 user, 24 AI)

---

## User (Q#1)
How does compaction work in Claude conversations?

---

## Assistant (A#1)
Compaction is Claude's automatic context management feature...

When your conversation approaches the context window limit, Claude
summarizes earlier messages to continue the conversation seamlessly.

```javascript
function setupSSEInterceptor() {
    // code preserved as-is
}
```

---

## User (Q#2)
What about the token counts in the SSE stream?

---

...
```

### Implementation

```javascript
function exportFullConversation() {
    var questions = _questions;
    var getAI = platform.getAIMessages;
    var aiMsgs = getAI ? Array.from(getAI()) : [];

    // Build unified timeline in DOM order
    var timeline = buildTimeline(questions, aiMsgs);

    var lines = [];
    lines.push('# Conversation Export');
    lines.push('**Platform:** ' + platform.title);
    lines.push('**Date:** ' + new Date().toISOString().split('T')[0]);
    lines.push('**Messages:** ' + timeline.length +
        ' (' + questions.length + ' user, ' + aiMsgs.length + ' AI)');
    lines.push('');
    lines.push('---');

    var qIdx = 0;
    var aIdx = 0;

    timeline.forEach(function (msg) {
        lines.push('');
        if (msg.type === 'user') {
            qIdx++;
            lines.push('## User (Q#' + qIdx + ')');
        } else {
            aIdx++;
            lines.push('## Assistant (A#' + aIdx + ')');
        }
        lines.push('');
        lines.push(extractMarkdownContent(msg.element));
        lines.push('');
        lines.push('---');
    });

    var md = lines.join('\n');
    downloadFile('conversation-export.md', md);
}
```

### Content extraction

`extractMarkdownContent(element)` needs to be smarter than just `.textContent`. It should:

- Preserve code blocks: detect `<pre><code>` and wrap in fenced markdown (``` with language class)
- Preserve basic formatting: bold, italic, links
- Strip platform UI chrome (copy buttons, action bars, avatar elements)

```javascript
function extractMarkdownContent(el) {
    var result = '';
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var node;

    while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent;
        } else if (node.nodeName === 'PRE') {
            var codeEl = node.querySelector('code');
            var lang = '';
            if (codeEl) {
                var langMatch = (codeEl.className || '').match(/language-(\w+)/);
                if (langMatch) lang = langMatch[1];
            }
            result += '\n```' + lang + '\n' + node.textContent.trim() + '\n```\n';
            walker.currentNode = node; // skip children
        } else if (node.nodeName === 'A') {
            // Preserve links
            result += '[' + node.textContent + '](' + node.href + ')';
        }
        // Skip known UI chrome elements
        if (node.classList && (
            node.classList.contains('copy-button') ||
            node.classList.contains('action-bar') ||
            node.getAttribute('aria-hidden') === 'true'
        )) {
            walker.currentNode = node; // skip
        }
    }

    return result.trim();
}
```

**Note:** This tree walker is a starting point. Platform-specific chrome varies, so each platform may need a `contentExtractor` function, similar to `textExtractor`. Refine during implementation.

---

## Export: Bookmarks Only (MD)

### Dependency

Requires Task #3 (Bookmarks) to be implemented. Reads from `GM_getValue` bookmark storage.

### What it does

Exports only bookmarked messages and entities as a structured markdown document.

### Output format

```markdown
# Bookmarked Items
**Platform:** Claude  
**Date:** 2026-02-22  
**Bookmarks:** 5

---

## 📌 Q#3 — Your Question
How does compaction work in Claude conversations?

---

## 📌 A#14 — AI Response
The context window for Claude is 200K tokens. When your conversation
approaches the limit, Claude summarizes earlier messages...

---

## 💻 A#22 — Code Block
```javascript
function setupClaudeSSEInterceptor() {
    // ...
}
```

---

## 📄 A#30 — File
CONTEXT-TRACKING.md
```

### Implementation

```javascript
function exportBookmarks() {
    var bookmarks = getConversationBookmarks();

    if (bookmarks.length === 0) {
        showToast('No bookmarks in this conversation');
        return;
    }

    // Sort by msgIndex
    bookmarks.sort(function (a, b) { return a.msgIndex - b.msgIndex; });

    var typeIcons = {
        'user-msg': '📌',
        'ai-msg': '📌',
        'code': '💻',
        'file': '📄'
    };
    var typeLabels = {
        'user-msg': 'Your Question',
        'ai-msg': 'AI Response',
        'code': 'Code Block',
        'file': 'File'
    };

    var lines = [];
    lines.push('# Bookmarked Items');
    lines.push('**Platform:** ' + platform.title);
    lines.push('**Date:** ' + new Date().toISOString().split('T')[0]);
    lines.push('**Bookmarks:** ' + bookmarks.length);
    lines.push('');
    lines.push('---');

    bookmarks.forEach(function (bm) {
        var icon = typeIcons[bm.entityType] || '📌';
        var label = typeLabels[bm.entityType] || 'Item';
        var prefix = bm.entityType === 'user-msg'
            ? 'Q#' + (bm.msgIndex + 1)
            : 'A#' + (bm.msgIndex + 1);

        lines.push('');
        lines.push('## ' + icon + ' ' + prefix + ' — ' + label);
        lines.push('');
        lines.push(bm.preview || '(no preview available)');
        lines.push('');
        lines.push('---');
    });

    var md = lines.join('\n');
    downloadFile('bookmarks-export.md', md);
}
```

---

## Export: Summary (MD)

### Dependency

Requires Task #5 (Summary) to be implemented. Calls `generateFullSummary()`.

### What it does

Runs the heuristic summary extraction and exports the result as a markdown document. Includes topics, conversation map, key points, stats, and code/file inventory.

### Implementation

```javascript
function exportSummary() {
    var summary = generateFullSummary();

    var lines = [];
    lines.push('# Conversation Summary');
    lines.push('**Platform:** ' + platform.title);
    lines.push('**Date:** ' + new Date().toISOString().split('T')[0]);
    lines.push('');
    lines.push('> ℹ️ This summary was generated by heuristic pattern matching, not AI.');
    lines.push('');
    lines.push('---');

    // Topics
    if (summary.topics.length > 0) {
        lines.push('');
        lines.push('## Topics');
        lines.push(summary.topics.join(' · '));
    }

    // Conversation Map
    if (summary.map && summary.map.length > 0) {
        lines.push('');
        lines.push('## Conversation Map');
        summary.map.forEach(function (seg) {
            var range = 'Q' + (seg.startIdx + 1) + '–Q' + (seg.endIdx + 1);
            lines.push('- **' + seg.label + '** (' + range + ')');
            seg.entities.forEach(function (ent) {
                lines.push('  - ' + ent.icon + ' ' + ent.label);
            });
        });
    }

    // Key Points
    if (summary.keyPoints.length > 0) {
        lines.push('');
        lines.push('## Key Points');
        summary.keyPoints.forEach(function (kp) {
            var icon = kp.type === 'decision' ? '🔹' :
                       kp.type === 'finding' ? '🔸' : '🔺';
            lines.push('- ' + icon + ' ' + kp.text);
        });
    }

    // Stats
    lines.push('');
    lines.push('## Stats');
    lines.push(summary.stats.totalMessages + ' messages (' +
        summary.stats.userMessages + ' user, ' +
        summary.stats.aiMessages + ' AI) · ' +
        summary.inventory.codeBlocks.length + ' code blocks · ' +
        summary.inventory.files.length + ' files');

    var md = lines.join('\n');
    downloadFile('conversation-summary.md', md);
}
```

---

## Panel Layout

```
┌──────────────────────────────────────┐
│ 🔧 Tools                          ✕ │
├──────────────────────────────────────┤
│                                      │
│  🖼️ Image Gallery (4 images)        │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │      │ │      │ │      │        │
│  │thumb1│ │thumb2│ │thumb3│        │
│  │      │ │      │ │      │        │
│  │ Q#3  │ │ Q#8  │ │ Q#15 │        │
│  └──────┘ └──────┘ └──────┘        │
│  ┌──────┐                           │
│  │      │  hover shows:             │
│  │thumb4│  [↗ go] [⬇ save]         │
│  │      │                           │
│  │ Q#22 │                           │
│  └──────┘                           │
│                                      │
│  Export                              │
│  ┌────────────────────────────────┐  │
│  │ 📄 Full Conversation          │  │
│  │    Markdown with all messages  │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ 📌 Bookmarks Only             │  │
│  │    Pinned messages as document │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Σ Summary                      │  │
│  │    Topics, map, key points     │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│    More tools coming soon.           │
│    Got ideas? Open an issue on       │
│    GitHub!                           │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                      │
└──────────────────────────────────────┘
```

Image Gallery leads the panel — it's the most visually engaging and immediately useful tool. Thumbnails use a 3-column CSS grid. Each card shows the image, the question/answer number, and hover-reveals navigate (↗) and download (⬇) buttons. Export cards follow below. The empty space at the bottom invites community suggestions.

---

## Download Mechanism

All exports use the same Blob → URL → click pattern:

```javascript
function downloadFile(filename, content) {
    var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var link = createElement('a', {
        href: url,
        download: filename,
    });
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(function () {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}
```

### Toast notification

After download triggers or clipboard copy:

```javascript
function showToast(message) {
    var existing = document.getElementById('acn-toast');
    if (existing) existing.remove();

    var toast = createElement('div', {
        id: 'acn-toast',
        className: 'acn-toast',
        textContent: message,
    });
    document.body.appendChild(toast);

    setTimeout(function () {
        toast.classList.add('acn-toast-fade');
        setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
}
```

```css
.acn-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 99999;
    transition: opacity 0.3s ease;
}

.acn-toast-fade {
    opacity: 0;
}
```

---

## Extensibility

### Design for future tools

The panel is built as a list of tool definitions, making it trivial to add new ones:

```javascript
var TOOLS_EXPORT = [
    { id: 'export-full', icon: '📄', label: 'Full Conversation', desc: 'Markdown with all messages', action: exportFullConversation },
    { id: 'export-bookmarks', icon: '📌', label: 'Bookmarks Only', desc: 'Pinned messages as document', action: exportBookmarks, requires: 'bookmarks' },
    { id: 'export-summary', icon: 'Σ', label: 'Summary', desc: 'Topics, map, key points', action: exportSummary, requires: 'summary' },
    // Future: community-requested export formats go here
];

// Image Gallery is rendered separately (not a simple button action) via renderImageGallery()
// Future tool sections can follow the same pattern: a render function + a section in the panel
```

The `requires` field disables tools whose dependencies aren't implemented yet, showing a "(coming soon)" label instead of a click handler. This way we can ship the panel even before Bookmarks and Summary are complete — Full Conversation and Code Blocks work independently.

### Community-driven additions

The panel is intentionally not packed full. After release, users will suggest tools based on their unique workflows. The data-driven architecture (array of tool definitions) makes adding new tools a matter of pushing one object. Potential future additions based on user feedback:

- User-suggested tools go here as they're requested
- No need to predict — let usage drive the roadmap

---

## Implementation Details

### Summary of file changes

| Location | Change |
|----------|--------|
| ORB_FEATURES array (~line 919) | Change `export` → `tools`, update icon and panelId |
| `orbBuildPanelExport()` (~line 1831) | Replace entirely with `orbBuildPanelTools()` |
| CSS | Add `.acn-gallery-*`, `.acn-toast`, `.acn-highlight-flash` styles |
| Navigate panel rendering | Add 🖼️ prefix to questions containing images |
| New functions | `getConversationImages()`, `isContentImage()`, `renderImageGallery()`, `downloadImage()`, `exportFullConversation()`, `exportBookmarks()`, `exportSummary()`, `downloadFile()`, `showToast()`, `extractMarkdownContent()`, `buildTimeline()` |

### Shared functions

`buildTimeline()` and `extractMarkdownContent()` are also needed by Summary (task #5). Implement once, used by both.

---

## Testing Checklist

### Image Gallery
- [ ] Gallery detects user-uploaded images in conversation
- [ ] Gallery detects AI-generated images (ChatGPT DALL-E) if present
- [ ] UI chrome images filtered out (avatars, icons, logos, emoji)
- [ ] Thumbnails render in 3-column grid
- [ ] Clicking thumbnail scrolls to the source message
- [ ] Message highlight flash animation plays on navigation
- [ ] Hover reveals navigate (↗) and download (⬇) buttons
- [ ] Download works (blob fetch → save, or falls back to new tab)
- [ ] Toast shows appropriate message for download vs new tab fallback
- [ ] "No images" message shown when conversation has no uploads
- [ ] Broken image URLs handled gracefully (hidden or fallback shown)
- [ ] Labels show Q#N for user uploads, A#N for AI response images
- [ ] Lazy loading works for conversations with many images (20+)

### Navigate Panel: 🖼️ Indicator
- [ ] Questions with attached images show 🖼️ prefix
- [ ] Questions without images show no prefix
- [ ] Indicator uses same filter as gallery (consistent detection)

### Export: Full Conversation
- [ ] Downloads .md file with all messages in conversation order
- [ ] User messages labeled Q#, AI messages labeled A#
- [ ] Code blocks preserved with fenced markdown + language
- [ ] Platform UI chrome stripped (no copy buttons, action bars in output)
- [ ] Works on all 5 orbital platforms

### Export: Bookmarks Only
- [ ] Downloads .md file with bookmarked items only
- [ ] Correctly reads from GM_setValue storage
- [ ] Shows toast if no bookmarks exist
- [ ] Items ordered by conversation position

### Export: Summary
- [ ] Downloads .md file with heuristic summary
- [ ] Includes disclaimer about non-AI generation
- [ ] Includes topics, map, key points, stats

### General
- [ ] Panel title shows "🔧 Tools"
- [ ] Toast notifications appear and fade correctly
- [ ] Download works on all browsers (Chrome, Firefox, Safari)
- [ ] Panel renders cleanly
- [ ] Tools with unmet dependencies show "coming soon"
- [ ] "More tools coming soon" note visible at bottom

### /Commands
- [ ] See full testing checklist in `docs/COMMANDS.md`

---

*This spec is referenced from V10-PLAN.md task #6. Depends on Task #0 (getAIMessages), Task #3 (Bookmarks for bookmark export), and Task #5 (Summary for summary export). Full Conversation export works independently. /Commands has its own dedicated spec at `docs/COMMANDS.md`.*
