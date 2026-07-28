# Summary Feature — Heuristic Extraction

Replace the placeholder Summary panel with a working conversation outline using pure JavaScript heuristic extraction. No AI, no API keys, no external dependencies.

**Last updated:** 2026-02-22  
**Applies to:** v10.1+  
**Status:** Ready for implementation  
**Depends on:** Task #0 (`getAIMessages()` selectors)

> **v12.0 update — summary operates on the full conversation path.**
>
> Two problems on Claude. First, the DOM scan saw ~3% of the conversation, so segmentation and the D2 nested bracket map were computed over a fraction of it. Second, `_sumBuildTimeline()` ordered messages with `compareDocumentPosition`, which returns `DOCUMENT_POSITION_DISCONNECTED` for unmounted nodes — matching neither FOLLOWING nor PRECEDING, so the comparator returned 0 and the sort silently degraded to arbitrary order. Summary could therefore be both incomplete *and* out of sequence.
>
> `_sumBuildTimeline()` now returns `_ciFullPath` directly when the index is ready (already in conversation order, no positional sort needed), and the DOM fallback separates mounted from unmounted entries so detached nodes cannot scramble the ordering.


---

## Table of Contents

1. [Overview](#overview)
2. [Current State (Placeholder)](#current-state-placeholder)
3. [Design Philosophy](#design-philosophy)
4. [Feature Sections](#feature-sections)
5. [Conversation Map (Timeline)](#conversation-map-timeline)
6. [Topics Extraction](#topics-extraction)
7. [Key Points Detection](#key-points-detection)
8. [Conversation Stats](#conversation-stats)
9. [Code & File Inventory](#code--file-inventory)
10. [Generate Summary Button](#generate-summary-button)
11. [Panel Layout](#panel-layout)
12. [Implementation Details](#implementation-details)
13. [Testing Checklist](#testing-checklist)

---

## Overview

The Summary panel provides a quick structural overview of a conversation: a visual timeline map showing topic segments with clickable entity markers, what topics were discussed, what decisions or conclusions were reached, what code and files were produced, and basic stats. This helps users:

- **Navigate by topic** — click a segment in the conversation map to jump directly to "the part where we discussed CSS fixes"
- **Find artifacts fast** — images uploaded, code blocks generated, and files created are marked directly on the map timeline
- **Scan across project chats** — topic tags help distinguish between conversations ("which chat had the brainstorm about weighted averages?")
- **Get a refresher** on a long conversation without rereading everything

This is explicitly **not** an AI-generated summary. It's pattern matching and frequency analysis — a conversation outline, not a synopsis. The feature is upfront about this.

---

## Current State (Placeholder)

`orbBuildPanelSummary()` (line 1795) renders hardcoded fake data:

- Static topics: "Orbital UI", "Navigation", "Conversation"
- Static key points: "Navigate between user questions", "Search conversation content"
- Non-functional "↻ Generate Summary" button

All of this gets replaced.

---

## Design Philosophy

**Honest about what it is.** This is heuristic extraction, not comprehension. It finds patterns, counts frequencies, and detects structural markers. It can tell you "this conversation discussed hover zones, bookmarks, and SSE tokens a lot" but it can't tell you "the team decided to use weighted averages for compaction prediction because fixed thresholds had credibility problems."

**Useful despite limitations.** Topic tags alone are enormously valuable for scanning across chats. "Oh right, this was the chat where we talked about Gemini CSP issues." You don't need AI for that — word frequency gets you there.

**Transparent disclaimer.** The Generate Summary button includes a lighthearted note about being pure JS, and genuinely suggests asking the AI directly for a real summary.

---

## Feature Sections

The Summary panel has four sections, generated on demand when the user clicks "Generate Summary":

| Section | What it shows | How it's generated |
|---------|--------------|-------------------|
| **Conversation Map** | Visual timeline with topic segments, entity markers (images, code, files) | Sliding window topic detection + DOM entity scanning |
| **Topics** | Tag cloud of main subjects discussed | TF-IDF-like word frequency with stop word filtering |
| **Key Points** | Detected decisions, conclusions, action items | Pattern matching on signal phrases |
| **Stats** | Turn count, message lengths, code blocks, duration | Simple counting |
| **Code & Files** | Inventory of code blocks and file references | DOM scanning for `<pre>`, download links |

The Conversation Map is the centerpiece — it fills the panel space and gives users a structural overview they can navigate. Topics, Key Points, Stats, and Code & Files appear below it as supplementary detail.

---

## Conversation Map (Timeline)

The conversation map is a visual timeline showing the full conversation structure — topic segments, entity markers (images, code blocks, files), and clickable navigation. It fills the main panel space and is the primary reason users open the Summary panel.

### Why This Matters

In a 40-message project conversation, the user might have:
- Brainstormed an idea (turns 1–8)
- Set up the GitHub repo (turns 9–15)
- Implemented with terminal commands (turns 16–28)
- Debugged an issue (turns 29–35)
- Planned next steps (turns 36–40)

Without a map, finding "the part where we discussed the CSS fix" means scrolling through the entire conversation. With a map, they see the labeled segments and click directly to it. This is especially powerful when scanning across multiple project chats: the map shows the *shape* of each conversation at a glance.

### Topic Segmentation Algorithm

Group messages into sliding windows and detect topic shifts:

```javascript
var SEGMENT_WINDOW = 4; // messages per window (2 user + 2 AI roughly)

function buildConversationMap(questions, aiResponses) {
    // 1. Build a unified message timeline in conversation order
    var timeline = buildTimeline(questions, aiResponses);

    // 2. Divide into windows and extract dominant topic per window
    var windows = [];
    for (var i = 0; i < timeline.length; i += SEGMENT_WINDOW) {
        var windowMsgs = timeline.slice(i, i + SEGMENT_WINDOW);
        var windowText = windowMsgs.map(function (m) { return m.text; }).join(' ');
        var topics = extractTopicsFromText(windowText, 3); // top 3 topics for this window
        windows.push({
            startIdx: i,
            endIdx: Math.min(i + SEGMENT_WINDOW - 1, timeline.length - 1),
            messages: windowMsgs,
            topics: topics,
            dominantTopic: topics[0] || 'discussion'
        });
    }

    // 3. Merge adjacent windows with the same dominant topic into segments
    var segments = [];
    var current = null;

    windows.forEach(function (win) {
        if (current && topicOverlap(current.topics, win.topics) > 0.5) {
            // Same segment — extend it
            current.endIdx = win.endIdx;
            current.messages = current.messages.concat(win.messages);
            // Update topics with merged frequency
            current.topics = mergeTopics(current.topics, win.topics);
        } else {
            // New segment
            if (current) segments.push(current);
            current = {
                startIdx: win.startIdx,
                endIdx: win.endIdx,
                messages: win.messages.slice(),
                topics: win.topics.slice(),
                label: win.dominantTopic,
                entities: []
            };
        }
    });
    if (current) segments.push(current);

    // 4. Scan each segment for entities (images, code, files)
    segments.forEach(function (seg) {
        seg.entities = scanEntities(seg.messages);
        seg.label = generateSegmentLabel(seg);
    });

    return segments;
}
```

### Segment Label Generation

Each segment gets a short, readable label based on its dominant topic:

```javascript
function generateSegmentLabel(segment) {
    // Use the top 1-2 topics as the label
    var topics = segment.topics.slice(0, 2);
    if (topics.length === 0) return 'Discussion';

    // Capitalize first letter of each topic
    return topics.map(function (t) {
        return t.charAt(0).toUpperCase() + t.slice(1);
    }).join(' + ');
}
```

Examples: "Hover zone", "GitHub setup", "SSE tokens + compaction", "Bug fixing"

### Entity Detection Within Segments

Scan message elements for notable entities:

```javascript
function scanEntities(messages) {
    var entities = [];

    messages.forEach(function (msg, localIdx) {
        var el = msg.element;
        if (!el) return;

        // Images (user uploads, AI-generated images)
        var images = el.querySelectorAll('img:not([width="1"]):not([aria-hidden])');
        images.forEach(function (img) {
            // Filter out tiny icons and decorative images
            var w = img.naturalWidth || img.width || 0;
            if (w > 50) {
                entities.push({
                    type: 'image',
                    icon: '🖼️',
                    label: img.alt || 'Image',
                    element: img,
                    msgIndex: msg.globalIndex
                });
            }
        });

        // Code blocks
        var pres = el.querySelectorAll('pre');
        pres.forEach(function (pre) {
            if (pre.textContent.trim().length < 50) return; // skip tiny inline code
            var codeEl = pre.querySelector('code');
            var lang = '';
            if (codeEl) {
                var langMatch = (codeEl.className || '').match(/language-(\w+)/);
                if (langMatch) lang = langMatch[1];
            }
            entities.push({
                type: 'code',
                icon: '💻',
                label: lang ? lang + ' code' : 'Code block',
                element: pre,
                msgIndex: msg.globalIndex
            });
        });

        // File downloads / artifacts
        var downloads = el.querySelectorAll('a[download], a[href*="/download/"]');
        downloads.forEach(function (link) {
            entities.push({
                type: 'file',
                icon: '📄',
                label: link.textContent.trim() || link.getAttribute('download') || 'File',
                element: link,
                msgIndex: msg.globalIndex
            });
        });

        // File mentions in text (detect patterns like FILENAME.ext)
        var filePattern = /\b([\w-]+\.(?:md|js|py|ts|css|html|json|yaml|yml|jsx|tsx|sh|sql|toml))\b/gi;
        var fileMatch;
        var seenFiles = {};
        while ((fileMatch = filePattern.exec(msg.text)) !== null) {
            var fname = fileMatch[1];
            if (!seenFiles[fname.toLowerCase()]) {
                seenFiles[fname.toLowerCase()] = true;
                entities.push({
                    type: 'file-mention',
                    icon: '📄',
                    label: fname,
                    element: el,
                    msgIndex: msg.globalIndex
                });
            }
        }
    });

    return entities;
}
```

### Unified Timeline Building

Messages need to be in conversation order (interleaved user/AI, not all-user-then-all-AI):

```javascript
function buildTimeline(questions, aiResponses) {
    // Tag each message with its type and a global index for sorting
    var all = [];

    questions.forEach(function (q, i) {
        all.push({
            element: q.element,
            text: q.text,
            type: 'user',
            sourceIndex: i,
            globalIndex: null // set after sorting
        });
    });

    aiResponses.forEach(function (a, i) {
        all.push({
            element: a.element,
            text: a.text,
            type: 'ai',
            sourceIndex: i,
            globalIndex: null
        });
    });

    // Sort by DOM position
    all.sort(function (a, b) {
        if (a.element && b.element) {
            var pos = a.element.compareDocumentPosition(b.element);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        }
        return 0;
    });

    // Assign global indices
    all.forEach(function (msg, i) { msg.globalIndex = i; });

    return all;
}
```

### Visual Design

The conversation map renders as a vertical timeline with segment blocks:

```
Conversation Map
│
├─┤ 💡 Idea brainstorming              │ Q1–Q8
│ │   🖼️ screenshot                     │
│ │   📌 "let's go with Option B"       │
│ │                                      │
├─┤ 🔧 GitHub setup                    │ Q9–Q15
│ │   💻 git init × 2                   │
│ │   💻 repo config                    │
│ │                                      │
├─┤ ⌨️  Terminal + implementation       │ Q16–Q28
│ │   💻 code block × 6                 │
│ │   📄 CONTEXT-TRACKING.md            │
│ │   📄 HOVER-ZONE-FIX.md             │
│ │   🖼️ screenshot                     │
│ │                                      │
├─┤ 🐛 Bug fixing                      │ Q29–Q35
│ │   💻 CSS fix                        │
│ │                                      │
└─┤ 📋 Planning next steps             │ Q36–Q40
  │   📄 V10-PLAN.md                    │
  │   📄 BOOKMARKS.md                   │
```

#### Segment Block Styling

```css
.acn-map-segment {
    position: relative;
    padding: 8px 12px;
    margin: 0 0 2px 16px;  /* indent from timeline bar */
    border-left: 3px solid var(--acn-accent);
    background: rgba(var(--acn-rgb), 0.05);
    border-radius: 0 6px 6px 0;
    cursor: pointer;
    transition: background 0.15s ease;
}

.acn-map-segment:hover {
    background: rgba(var(--acn-rgb), 0.12);
}

.acn-map-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--acn-accent);
    margin-bottom: 4px;
}

.acn-map-range {
    font-size: 11px;
    color: #888;
    float: right;
}

.acn-map-entity {
    font-size: 11px;
    color: #aaa;
    padding: 1px 0;
    cursor: pointer;
}

.acn-map-entity:hover {
    color: #fff;
}
```

#### Segment Height Proportional to Length

Each segment's visual height is proportional to how many messages it contains, giving a sense of how much time was spent on each topic:

```javascript
function renderSegmentHeight(segment, totalMessages) {
    var proportion = segment.messages.length / totalMessages;
    var minHeight = 48;   // minimum readable height
    var maxHeight = 200;  // cap for very long segments
    var availableHeight = panelScrollHeight - (segments.length * minHeight);
    return Math.max(minHeight, Math.min(maxHeight, minHeight + availableHeight * proportion));
}
```

A segment covering 28 of 40 messages gets much more visual space than one covering 4, which intuitively tells users "this was the big section."

#### Click Behavior

- **Click segment label:** Scrolls to the first message of that segment
- **Click entity:** Scrolls to the specific entity (image, code block, file)
- **Hover segment:** Subtle highlight, shows full topic list in tooltip

### Segment Icon Selection

Auto-select a segment icon based on dominant content:

```javascript
function getSegmentIcon(segment) {
    var codeCount = segment.entities.filter(function (e) { return e.type === 'code'; }).length;
    var fileCount = segment.entities.filter(function (e) { return e.type === 'file' || e.type === 'file-mention'; }).length;
    var imgCount  = segment.entities.filter(function (e) { return e.type === 'image'; }).length;

    // Check topic keywords for common patterns
    var topicStr = segment.topics.join(' ').toLowerCase();

    if (topicStr.match(/bug|fix|error|issue|debug/)) return '🐛';
    if (topicStr.match(/setup|install|config|init/)) return '🔧';
    if (topicStr.match(/plan|next|future|roadmap/)) return '📋';
    if (topicStr.match(/design|ui|css|layout|visual/)) return '🎨';
    if (topicStr.match(/test|check|verify|assert/)) return '🧪';
    if (codeCount >= 3) return '⌨️';
    if (fileCount >= 2) return '📄';
    if (imgCount >= 1) return '🖼️';
    if (topicStr.match(/idea|brainstorm|concept|approach/)) return '💡';

    return '💬'; // default: general discussion
}
```

### Edge Cases

**Very short conversations (< 4 messages):** Don't segment — show the entire conversation as one block labeled with overall topics.

**Very long conversations (100+ messages):** Increase window size to 6–8 messages to avoid too many tiny segments. Cap at ~12 segments max — merge the smallest adjacent segments if over the limit.

**No clear topic shifts:** If the entire conversation is about one thing, show it as one large segment. That's accurate and still useful — it tells the user "this whole chat was about X."

**Topic detection fails (no meaningful words):** Fall back to labeling segments by their entity content: "Code-heavy section", "Image uploads", or simply "Discussion (Q1–Q8)".

---

## Topics Extraction

### Algorithm

1. Collect all text from both user messages and AI responses
2. Tokenize into words, normalize (lowercase, strip punctuation)
3. Remove stop words (common English words with no topical value)
4. Remove platform-specific noise words ("claude", "chatgpt", "code", "please", "thanks", etc.)
5. Count bigrams (two-word phrases) alongside unigrams — "hover zone" is more useful than "hover" + "zone" separately
6. Score by frequency, weighted slightly toward user messages (what the user asked about matters more than every word the AI used)
7. Take top 5–8 topics

### Stop Word List

Standard English stop words plus conversation-specific noise:

```javascript
var STOP_WORDS = new Set([
    // Standard English
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
    'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we',
    'our', 'you', 'your', 'he', 'she', 'they', 'them', 'what', 'which',
    'who', 'whom', 'this', 'that', 'am', 'let', 'also', 'like', 'get',
    'got', 'make', 'made', 'go', 'going', 'want', 'think', 'know',
    'see', 'look', 'way', 'thing', 'things', 'something', 'well',
    'really', 'right', 'yeah', 'yes', 'no', 'okay', 'ok',

    // Conversation noise
    'please', 'thanks', 'thank', 'sorry', 'sure', 'hey', 'hi', 'hello',
    'help', 'question', 'answer', 'response', 'message', 'chat',
    'conversation', 'tell', 'show', 'give', 'say', 'said', 'mean',
    'example', 'actually', 'basically', 'specifically',
]);
```

### Bigram Extraction

Bigrams capture compound concepts that unigrams miss:

```javascript
function extractBigrams(words) {
    var bigrams = {};
    for (var i = 0; i < words.length - 1; i++) {
        if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
        if (words[i].length < 3 || words[i + 1].length < 3) continue;
        var bigram = words[i] + ' ' + words[i + 1];
        bigrams[bigram] = (bigrams[bigram] || 0) + 1;
    }
    return bigrams;
}
```

### Scoring

```javascript
function extractTopics(questions, aiResponses) {
    var wordCounts = {};
    var bigramCounts = {};

    function processMessages(messages, weight) {
        messages.forEach(function (msg) {
            var words = tokenize(msg.text);
            words.forEach(function (w) {
                if (!STOP_WORDS.has(w) && w.length >= 3) {
                    wordCounts[w] = (wordCounts[w] || 0) + weight;
                }
            });
            var bigrams = extractBigrams(words);
            Object.keys(bigrams).forEach(function (bg) {
                bigramCounts[bg] = (bigramCounts[bg] || 0) + bigrams[bg] * weight;
            });
        });
    }

    // User messages weighted slightly higher (1.5x) — what they asked about is more topical
    processMessages(questions, 1.5);
    processMessages(aiResponses, 1.0);

    // Promote bigrams: if a bigram appears 2+ times, it's likely a real concept
    // Absorb its unigrams' scores into the bigram
    var topics = {};
    Object.keys(bigramCounts).forEach(function (bg) {
        if (bigramCounts[bg] >= 2) {
            topics[bg] = bigramCounts[bg] * 2; // bonus for being a compound concept
        }
    });

    // Add top unigrams that weren't absorbed into bigrams
    Object.keys(wordCounts).forEach(function (w) {
        // Skip if this word is part of a promoted bigram
        var inBigram = Object.keys(topics).some(function (bg) {
            return bg.indexOf(w) !== -1;
        });
        if (!inBigram && wordCounts[w] >= 2) {
            topics[w] = wordCounts[w];
        }
    });

    // Sort by score, take top 8
    var sorted = Object.keys(topics).sort(function (a, b) {
        return topics[b] - topics[a];
    });

    return sorted.slice(0, 8);
}
```

### Display

Topics rendered as colored tag pills:

```
Topics: [hover zone] [bookmarks] [SSE tokens] [compaction] [weighted average]
```

Each pill uses the platform's accent color with low opacity background.

---

## Key Points Detection

### Signal Phrase Matching

Scan both user and AI messages for phrases that indicate decisions, conclusions, conclusions, or action items:

```javascript
var KEY_POINT_PATTERNS = [
    // Decisions
    { pattern: /(?:let's|let us|we should|i'll|we'll|going to|plan to|decided to|chose|picked|selected)\s+(.{10,80})/gi, type: 'decision' },
    { pattern: /(?:go with|stick with|use|implement|choose)\s+(?:option|approach|method|strategy)\s+(.{5,60})/gi, type: 'decision' },

    // Conclusions / findings
    { pattern: /(?:the (?:fix|solution|answer|problem|issue|root cause) (?:is|was))\s+(.{10,80})/gi, type: 'finding' },
    { pattern: /(?:turns out|it looks like|this means|conclusion|takeaway|key (?:insight|finding))[:\s]+(.{10,80})/gi, type: 'finding' },

    // Action items / next steps
    { pattern: /(?:next step|todo|to-do|action item|we need to|still need to|remaining|blocked on)[:\s]+(.{10,80})/gi, type: 'action' },
    { pattern: /(?:ready (?:for|to)|let's move on to|moving on to)\s+(.{10,60})/gi, type: 'action' },

    // Explicit summaries by AI
    { pattern: /(?:in summary|to summarize|summing up|the (?:main|key) (?:points?|takeaways?|changes?) (?:are|include))[:\s]+(.{10,120})/gi, type: 'summary' },
];
```

### Extraction Logic

```javascript
function extractKeyPoints(questions, aiResponses) {
    var points = [];
    var allMessages = questions.concat(aiResponses);

    allMessages.forEach(function (msg, msgIdx) {
        KEY_POINT_PATTERNS.forEach(function (pat) {
            var match;
            var regex = new RegExp(pat.pattern.source, pat.pattern.flags);
            while ((match = regex.exec(msg.text)) !== null) {
                var captured = match[1] || match[0];
                // Clean up: trim, remove trailing punctuation fragments
                captured = captured.replace(/[.,:;!?]+$/, '').trim();
                if (captured.length > 10) {
                    points.push({
                        text: captured,
                        type: pat.type,
                        source: msg.type === 'ai' ? 'ai' : 'user',
                        position: msgIdx
                    });
                }
            }
        });
    });

    // Deduplicate similar points (fuzzy — if 80%+ of words overlap, keep the longer one)
    points = deduplicatePoints(points);

    // Limit to 10 key points max
    return points.slice(0, 10);
}
```

### Display

Key points grouped by type with icons:

```
Key Points:

🔹 Decision: Use weighted averages for compaction prediction
🔹 Decision: Go with Option B (adaptive) for non-Claude turn counter

🔸 Finding: The gap between visible text and actual tokens can be 95%+
🔸 Finding: Compaction token floor stays roughly flat across cycles

🔺 Next: Verify DOM selectors on newer platforms before refactor
🔺 Next: Still need to implement getAIMessages() for all platforms
```

Type icons: 🔹 decisions, 🔸 findings/conclusions, 🔺 action items/next steps.

---

## Conversation Stats

Simple counting — no heuristics needed:

```javascript
function generateStats(questions, aiResponses) {
    var totalMsgs = questions.length + aiResponses.length;
    var userChars = questions.reduce(function (sum, q) { return sum + q.text.length; }, 0);
    var aiChars   = aiResponses.reduce(function (sum, a) { return sum + a.text.length; }, 0);

    return {
        totalMessages: totalMsgs,
        userMessages: questions.length,
        aiMessages: aiResponses.length,
        userChars: userChars,
        aiChars: aiChars,
        avgUserLen: questions.length > 0 ? Math.round(userChars / questions.length) : 0,
        avgAiLen: aiResponses.length > 0 ? Math.round(aiChars / aiResponses.length) : 0,
        codeBlocks: 0,  // counted separately in Code & Files
        files: 0,       // counted separately in Code & Files
    };
}
```

### Display

Compact stat row:

```
Stats: 42 messages (18 you · 24 AI) · ~38K chars · 7 code blocks · 3 files
```

---

## Code & File Inventory

Scan AI messages for code blocks and file references:

```javascript
function inventoryCodeAndFiles(aiResponses) {
    var codeBlocks = [];
    var files = [];

    aiResponses.forEach(function (msg, idx) {
        var el = msg.element;
        if (!el) return;

        // Code blocks
        var pres = el.querySelectorAll('pre');
        pres.forEach(function (pre, preIdx) {
            var codeEl = pre.querySelector('code');
            var lang = '';
            if (codeEl) {
                // Try to detect language from class (e.g., "language-javascript")
                var cls = codeEl.className || '';
                var langMatch = cls.match(/language-(\w+)/);
                if (langMatch) lang = langMatch[1];
            }
            var preview = (pre.textContent || '').trim().substring(0, 80);
            codeBlocks.push({
                language: lang,
                preview: preview,
                msgIndex: idx,
                element: pre
            });
        });

        // Files — look for download links, file references
        var links = el.querySelectorAll('a[download], a[href*="/download/"]');
        links.forEach(function (link) {
            files.push({
                name: link.textContent.trim() || link.getAttribute('download') || 'file',
                href: link.href,
                msgIndex: idx,
                element: link
            });
        });

        // Also detect filename patterns in text (e.g., "CONTEXT-TRACKING.md", "style.css")
        var filePatterns = msg.text.match(/\b[\w-]+\.(md|js|py|ts|css|html|json|yaml|yml|txt|csv|pdf|docx|xlsx|pptx|sh|bash|sql|jsx|tsx|vue|svelte|rb|go|rs|java|cpp|c|h|toml|xml|env|conf|cfg)\b/gi);
        if (filePatterns) {
            var seen = {};
            filePatterns.forEach(function (f) {
                if (!seen[f.toLowerCase()]) {
                    seen[f.toLowerCase()] = true;
                    files.push({ name: f, href: null, msgIndex: idx, element: null });
                }
            });
        }
    });

    return { codeBlocks: codeBlocks, files: files };
}
```

### Display

```
Code Blocks (7):
  javascript  function setupClaudeSSEInterceptor() { ...     A#14
  css         .acn-bm-icon { position: absolute; ...         A#22
  javascript  function extractTopics(questions, aiRes...      A#30

Files Mentioned (5):
  📄 CONTEXT-TRACKING.md        A#8
  📄 HOVER-ZONE-FIX.md          A#16
  📄 BOOKMARKS.md               A#24
  📄 V10-PLAN.md                A#28
  📄 ai-conversation-navigator.user.js    A#3
```

Each entry is clickable — scrolls to the message containing it.

---

## Generate Summary Button

### Behavior

The summary is NOT auto-generated when the panel opens. It's generated on demand via the button. Reasons:
- Generation involves scanning all messages — could take 100ms+ on long conversations
- User might open the panel just to check if they already generated one
- Gives us a natural place for the disclaimer

### Button States

**Before generation:**
```
┌─────────────────────────────────────────┐
│            ↻ Generate Summary            │
│                                          │
│  📊 Analyzes topics, decisions, stats,   │
│  and code blocks from this conversation  │
│                                          │
│  ℹ️  Powered by heuristics & pattern     │
│  matching (not AI). For a real summary,  │
│  just ask — you're inside an AI chat!    │
└─────────────────────────────────────────┘
```

**During generation (brief, but visible on long conversations):**
```
┌─────────────────────────────────────────┐
│            ⏳ Analyzing...               │
└─────────────────────────────────────────┘
```

**After generation:**
Button text changes to "↻ Regenerate Summary" — available if conversation has continued since last generation.

### The Disclaimer

The disclaimer on the button is friendly and genuinely helpful:

```
ℹ️ This summary uses pattern matching, not AI.
   For a real summary, just ask — you're literally inside one! 🤖
```

Short, honest, a little funny, and actually points users toward the better option for serious summarization.

---

## Panel Layout

```
┌─────────────────────────────────────────┐
│ Σ Summary                             ✕ │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      ↻ Generate Summary         │    │
│  │                                  │    │
│  │  ℹ️ Pattern matching, not AI.    │    │
│  │  For a real summary, just ask    │    │
│  │  — you're literally inside one!  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ─── After clicking Generate: ───       │
│                                         │
│  Conversation Map                       │
│  │                                      │
│  ├─ 💡 Idea brainstorming    Q1–Q8     │
│  │    🖼️ screenshot                     │
│  │    📌 "let's go with Option B"       │
│  │                                      │
│  ├─ 🔧 GitHub setup         Q9–Q15     │
│  │    💻 git init × 2                   │
│  │    💻 repo config                    │
│  │                                      │
│  ├─ ⌨️ Implementation       Q16–Q28    │
│  │    💻 code × 6                       │
│  │    📄 CONTEXT-TRACKING.md            │
│  │    📄 HOVER-ZONE-FIX.md             │
│  │    🖼️ screenshot                     │
│  │                                      │
│  ├─ 🐛 Bug fixing           Q29–Q35    │
│  │    💻 CSS fix                        │
│  │                                      │
│  └─ 📋 Planning             Q36–Q40    │
│       📄 V10-PLAN.md                    │
│                                         │
│  Topics                                 │
│  [hover zone] [bookmarks] [compaction]  │
│  [SSE tokens] [weighted average]        │
│                                         │
│  Key Points                             │
│  🔹 Use weighted averages for           │
│     compaction prediction               │
│  🔸 Gap between visible text and        │
│     actual tokens can be 95%+           │
│  🔺 Implement getAIMessages() for       │
│     all platforms                        │
│                                         │
│  Stats                                  │
│  42 msgs (18 you · 24 AI) · 7 code     │
│  blocks · 5 files mentioned             │
│                                         │
│  Code Blocks (7)                        │
│  ┌ js  setupClaudeSSE...       A#14 ┐   │
│  ├ css .acn-bm-icon { ...      A#22 ┤   │
│  └ js  extractTopics(...       A#30 ┘   │
│                                         │
│  Files (5)                              │
│  📄 CONTEXT-TRACKING.md         A#8     │
│  📄 HOVER-ZONE-FIX.md          A#16     │
│  📄 BOOKMARKS.md               A#24     │
│                                         │
└─────────────────────────────────────────┘
```

The Conversation Map takes the top portion — it's the primary navigational tool. Topics, Key Points, Stats, and Code/Files follow as supplementary detail. Everything is scrollable.

### Clickable Elements

- **Topic pills:** Could filter the Search panel to that term (nice-to-have, not required for v1)
- **Key point entries:** Scroll to the source message
- **Code block entries:** Scroll to the code block
- **File entries:** Scroll to the message containing the file reference

---

## Implementation Details

### Entry Point

Replace `orbBuildPanelSummary()` entirely. The new version builds the panel shell with the Generate button. On click, it runs all extraction functions and populates the panel.

```javascript
function orbBuildPanelSummary() {
    var panel = createElement('div', { id: 'acn-panel-summary', className: 'acn-panel' });
    panel.appendChild(orbBuildPanelHeader('Σ Summary'));

    var scroll = createElement('div', { style: 'flex:1;overflow-y:auto;padding:12px' });

    // Generate button
    var genBtn = createElement('button', {
        className: 'acn-gen-btn',
        textContent: '↻ Generate Summary'
    });

    // Disclaimer
    var disclaimer = createElement('div', {
        className: 'acn-sum-disclaimer',
        textContent: 'ℹ️ Pattern matching, not AI. For a real summary, just ask — you\'re literally inside one!'
    });

    var genWrap = createElement('div', { className: 'acn-gen-wrap' }, [genBtn, disclaimer]);
    scroll.appendChild(genWrap);

    // Results container (populated on generate)
    var results = createElement('div', { id: 'acn-summary-results' });
    scroll.appendChild(results);

    genBtn.addEventListener('click', function () {
        genBtn.textContent = '⏳ Analyzing...';
        genBtn.disabled = true;

        // Use setTimeout to let the UI update before heavy computation
        setTimeout(function () {
            var summaryData = generateFullSummary();
            renderSummaryResults(results, summaryData);
            genBtn.textContent = '↻ Regenerate Summary';
            genBtn.disabled = false;
        }, 50);
    });

    panel.appendChild(scroll);
    return panel;
}

function generateFullSummary() {
    var getAI = platform.getAIMessages;
    var aiMsgs = getAI ? Array.from(getAI()).map(function (el) {
        return { element: el, text: (el.textContent || '').trim(), type: 'ai' };
    }) : [];

    return {
        map: buildConversationMap(_questions, aiMsgs),
        topics: extractTopics(_questions, aiMsgs),
        keyPoints: extractKeyPoints(_questions, aiMsgs),
        stats: generateStats(_questions, aiMsgs),
        inventory: inventoryCodeAndFiles(aiMsgs)
    };
}
```

### Tokenizer

Simple word tokenizer for topic extraction:

```javascript
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, ' ')  // strip non-alphanumeric except hyphens/apostrophes
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(function (w) { return w.length >= 3; });
}
```

### Deduplication for Key Points

```javascript
function deduplicatePoints(points) {
    var kept = [];
    points.forEach(function (p) {
        var dominated = kept.some(function (existing) {
            return wordOverlap(p.text, existing.text) > 0.8;
        });
        if (!dominated) {
            // Remove any existing point that this one dominates (keep the longer one)
            kept = kept.filter(function (existing) {
                if (wordOverlap(p.text, existing.text) > 0.8) {
                    return existing.text.length > p.text.length;
                }
                return true;
            });
            kept.push(p);
        }
    });
    return kept;
}

function wordOverlap(textA, textB) {
    var wordsA = new Set(tokenize(textA));
    var wordsB = new Set(tokenize(textB));
    var intersection = 0;
    wordsA.forEach(function (w) { if (wordsB.has(w)) intersection++; });
    var smaller = Math.min(wordsA.size, wordsB.size);
    return smaller > 0 ? intersection / smaller : 0;
}
```

### Performance Consideration

On a 200-message conversation, scanning all text for topics and key points involves iterating through maybe 200K characters total. JavaScript handles this in under 50ms on any modern machine. The `setTimeout` wrapper before computation is just a courtesy to let the "Analyzing..." text render, not a real performance concern.

---

## Future Considerations

### Enhanced Summary via API Key (v-future)

Add an optional "Enhanced AI Summary" button in Settings for users who have their own API key. This would:
- Send conversation text to Claude/OpenAI API
- Get back a real LLM-generated summary
- Display in the same panel alongside or replacing heuristic results

This is a significant feature with its own concerns (key storage security, cost transparency, error handling). Document as a future roadmap item in README, not in this spec.

### Topic-Based Search Integration

Clicking a topic pill could pre-populate the Search panel with that term. Simple integration between Summary and Search panels. Nice-to-have for v1.

---

## Testing Checklist

### Generate button
- [ ] Generate button produces results (not placeholder data)
- [ ] "Analyzing..." state shows briefly during generation
- [ ] Regenerate works after conversation continues
- [ ] Disclaimer text is visible and readable

### Conversation Map
- [ ] Segments reflect actual topic shifts in the conversation
- [ ] Segment labels are meaningful (not just "Discussion" everywhere)
- [ ] Segment heights are proportional to message count
- [ ] Segment icons auto-selected based on content (🐛 for bugs, 💻 for code-heavy, etc.)
- [ ] Entity markers show images, code blocks, files within segments
- [ ] Clicking segment label scrolls to first message of that segment
- [ ] Clicking entity scrolls to the specific element (image, code block, file)
- [ ] Short conversations (< 4 messages) show as single block
- [ ] Long conversations (100+ messages) stay under ~12 segments
- [ ] Conversations with no clear topic shifts show as one segment

### Topics
- [ ] Topics reflect actual conversation content
- [ ] Topics are useful for distinguishing between different chats
- [ ] Bigrams appear when compound concepts are discussed (e.g., "hover zone" not just "hover")
- [ ] Stop words are filtered out (no "the", "and", "is" as topics)

### Key Points
- [ ] Key points detect decisions ("let's go with...", "decided to...")
- [ ] Key points detect findings ("the problem is...", "turns out...")
- [ ] Key points detect action items ("next step...", "we need to...")
- [ ] Key points are deduplicated (no near-identical entries)

### Stats & Inventory
- [ ] Stats are accurate (message counts, code block counts)
- [ ] Code blocks show language detection when available
- [ ] File references detected from text patterns and download links
- [ ] Clicking code/file entries scrolls to the source message

### Cross-platform
- [ ] Works on all 5 orbital platforms
- [ ] Performance acceptable on long conversations (200+ messages)
- [ ] Panel scrolls properly with long results

---

*This spec is referenced from V10-PLAN.md task #5. Depends on Task #0 (`getAIMessages()` selectors) for AI response analysis.*
