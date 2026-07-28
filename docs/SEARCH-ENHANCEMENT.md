# Search Enhancement — Full Conversation Search

Extend the Search feature to search through both user questions AND AI responses, not just user messages.

**Last updated:** 2026-02-22  
**Applies to:** v10.1+  
**Status:** Ready for implementation  
**Depends on:** `getAIMessages()` selectors per platform (shared with Bookmarks and Context Tracking)

> **v12.0 update — search reads the conversation index on Claude.**
>
> The design below searches `_questions` and `_aiResponses`, both derived from a full-page DOM scan. On Claude that scan now sees only ~3 mounted turns, so most searches returned nothing regardless of the matching logic. `_questions` is now populated from the API-backed conversation index (DEC-021) and covers the whole conversation. Note that a match may have `element: null` when its message is not mounted — jump-to-result must handle that rather than assuming a node exists.


---

## Problem

The current search (`orbPopulateSearch()`, line 1620) only searches `_questions`, which is populated exclusively from `getUserMessages()`. AI responses — often containing the most important information like technical terms, code, explanations, and file outputs — are completely invisible to search.

**Real example from active use:** The term "turn counter" was introduced by Claude in a response. The user tried to search for it in the Search panel to find that part of the conversation. No results — because the term only existed in AI responses, which search doesn't index.

---

## Current Architecture

```
scanConversation()
  → getUserMessages()
  → populates _questions = [{ element, text, summary, vsIndex? }]

orbPopulateSearch(query)
  → filters _questions by keyword match
  → displays results as "Q#1", "Q#2", etc.
  → click scrolls to message via orbScrollToQuestion()
```

Only `_questions` exists. No AI message collection. No combined index.

---

## Fix

### 1. Add `_aiResponses` array parallel to `_questions`

```javascript
var _questions    = []; // [{ element, text, summary, vsIndex?, type: 'user' }]
var _aiResponses  = []; // [{ element, text, summary, vsIndex?, type: 'ai' }]
```

### 2. Collect AI messages in `scanConversation()`

After the existing user message collection, add AI message collection using the same pattern:

```javascript
function scanConversation(forceReset) {
    // ... existing user message collection into _questions ...

    // NEW: Collect AI responses
    var getAI = platform.getAIMessages;
    if (getAI) {
        var aiMessages = getAI();
        _aiResponses = [];
        aiMessages.forEach(function (msg) {
            var proseEl = platform.textExtractor ? platform.textExtractor(msg) : null;
            var text = proseEl
                ? (proseEl.textContent || '').trim()
                : (msg.textContent || msg.innerText || '').trim();
            if (!text.trim()) return;
            _aiResponses.push({ element: msg, text: text, summary: generateSummary(text), type: 'ai' });
        });
    }

    if (typeof orbOnScanComplete === 'function') orbOnScanComplete();
}
```

**Note:** Virtual scroll accumulation logic (the `_vsAccumulatedKeys` pattern) should apply to AI messages too on platforms that virtualize. Follow the same `isVirtualScroll` branching as user messages.

### 3. Search both arrays in `orbPopulateSearch()`

```javascript
function orbPopulateSearch(query) {
    orbSearchQuery = query || '';
    var list = document.getElementById('acn-search-list');
    var hint = document.getElementById('acn-search-hint');
    if (!list) return;

    while (list.firstChild) list.removeChild(list.firstChild);

    var q = orbSearchQuery.trim();

    if (!q) {
        if (hint) {
            hint.style.display = '';
            hint.textContent = 'Search through your conversation';
        }
        return;
    }

    if (hint) hint.style.display = 'none';

    var qLower = q.toLowerCase();

    // Search BOTH user questions and AI responses
    var userMatches = _questions.filter(function (msg) {
        return msg.text.toLowerCase().indexOf(qLower) !== -1;
    }).map(function (msg) {
        return { msg: msg, type: 'user', index: _questions.indexOf(msg) };
    });

    var aiMatches = _aiResponses.filter(function (msg) {
        return msg.text.toLowerCase().indexOf(qLower) !== -1;
    }).map(function (msg) {
        return { msg: msg, type: 'ai', index: _aiResponses.indexOf(msg) };
    });

    // Combine and sort by conversation order
    // Interleave by estimating position: Q#1 pairs with A#1, Q#2 with A#2, etc.
    var allMatches = userMatches.concat(aiMatches);
    allMatches.sort(function (a, b) {
        // Sort by DOM position for accurate conversation order
        var elA = a.msg.element;
        var elB = b.msg.element;
        if (elA && elB) {
            var pos = elA.compareDocumentPosition(elB);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        }
        return 0;
    });

    if (allMatches.length === 0) {
        var empty = createElement('div', { className: 'acn-empty',
            textContent: 'No matches for "' + q + '"' });
        list.appendChild(empty);
        return;
    }

    allMatches.forEach(function (match) {
        var text  = match.msg.text;
        var lower = text.toLowerCase();
        var pos   = lower.indexOf(qLower);
        var start = Math.max(0, pos - 40);
        var end   = Math.min(text.length, pos + q.length + 40);

        var pre  = (start > 0 ? '...' : '') + text.substring(start, pos);
        var hit  = text.substring(pos, pos + q.length);
        var post = text.substring(pos + q.length, end) + (end < text.length ? '...' : '');

        // Label: "Q#3" for user messages, "A#5" for AI responses
        var label = match.type === 'user'
            ? 'Q#' + (match.index + 1)
            : 'A#' + (match.index + 1);

        var numEl  = createElement('div', { className: 'acn-qn' });
        numEl.textContent = label;

        // Add type-specific styling class
        if (match.type === 'ai') numEl.classList.add('acn-qn-ai');

        var mark   = createElement('span', { className: 'acn-smatch', textContent: hit });
        var textEl = createElement('div', { className: 'acn-qt' }, [
            document.createTextNode(pre),
            mark,
            document.createTextNode(post),
        ]);
        var item = createElement('div', { className: 'acn-qi' }, [numEl, textEl]);

        // Scroll to the message on click
        item.addEventListener('click', function () {
            orbScrollToMessage(match.msg);
        });
        list.appendChild(item);
    });
}
```

### 4. Generalize scroll function

Rename/extend `orbScrollToQuestion()` to handle any message:

```javascript
function orbScrollToMessage(msg) {
    var el = msg.element;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Brief highlight flash (reuse bookmark flash animation)
    el.classList.add('acn-bm-flash');
    setTimeout(function () { el.classList.remove('acn-bm-flash'); }, 1500);
}
```

Keep `orbScrollToQuestion()` as an alias for backward compatibility with the Navigate panel.

### 5. Visual distinction between Q and A results

Add a subtle CSS difference so users can instantly tell if a match is from their question or the AI's answer:

```css
/* AI response label — slightly different style from user question label */
.acn-qn-ai {
    background: rgba(var(--acn-rgb), 0.15);  /* lighter accent tint */
    border-left: 2px solid var(--acn-accent);
}

/* User question label keeps existing style (no change needed) */
```

The "Q#" and "A#" labels do most of the work. The subtle border on AI results adds a quick visual scan pattern.

---

## AI Response Text Handling

AI responses tend to be much longer than user messages. A single AI response could be thousands of characters. This creates two considerations:

### Multiple matches within one response

A single AI response might contain the search term multiple times. Current behavior shows one result per message. Two options:

**Option A (recommended for v1):** One result per message, showing the first match with context. Simple, consistent with current behavior. The user clicks the result, scrolls to the message, and can Ctrl+F within it if needed.

**Option B (future):** Multiple results per message, each showing a different match position. More useful but significantly more complex — each result would need to scroll to a different vertical position within the same message.

### Preview truncation for long AI responses

The current ±40 character context window around the match works fine for short user messages but may not provide enough context for AI responses. Consider expanding to ±60 characters for AI matches, or keeping ±40 — it's a minor UX detail, not a blocker.

### Performance with long AI text

AI responses can be very long (10K+ characters). The `toLowerCase().indexOf()` search is O(n) per message, which is fine even for long text — JavaScript string operations on 10K characters complete in microseconds. No optimization needed.

---

## Result Count Display

Update the hint area to show result count after search:

```javascript
// After building results, update hint
if (hint && allMatches.length > 0) {
    hint.style.display = '';
    hint.textContent = allMatches.length + ' match' +
        (allMatches.length !== 1 ? 'es' : '') +
        ' (' + userMatches.length + ' in questions, ' +
        aiMatches.length + ' in responses)';
}
```

Shows: "7 matches (2 in questions, 5 in responses)"

---

## Summary of Changes

| Location | Change |
|----------|--------|
| State variables (~line 753) | Add `var _aiResponses = []` |
| `scanConversation()` (~line 757) | Add AI message collection via `platform.getAIMessages()` |
| `orbPopulateSearch()` (~line 1620) | Search both `_questions` and `_aiResponses`, combine and sort |
| Search result labels | "Q#N" for user, "A#N" for AI with distinct styling |
| Scroll handler | Generalize to `orbScrollToMessage()`, works for any message type |
| CSS | Add `.acn-qn-ai` class for AI result label styling |
| Reset points (~lines 843, 851, 858) | Clear `_aiResponses = []` alongside `_questions = []` |
| Hint text | Show breakdown: "7 matches (2 in questions, 5 in responses)" |

### Shared dependency

`getAIMessages()` per platform — same selectors needed by Bookmarks (task #3) and Context Tracking (task #1). Implement once, used by all three features.

---

## Testing Checklist

- [ ] Search finds matches in user questions (existing behavior preserved)
- [ ] Search finds matches in AI responses (new)
- [ ] Results show "Q#" for user messages, "A#" for AI responses
- [ ] Results sorted in conversation order (not user-first then AI-first)
- [ ] Clicking AI result scrolls to correct AI message
- [ ] Highlight flash plays on scrolled-to message
- [ ] Match count shows breakdown (N in questions, M in responses)
- [ ] Empty state still shows "No matches for..." when nothing found
- [ ] Works on Claude, ChatGPT, Grok, Gemini, Perplexity
- [ ] `_aiResponses` resets on conversation switch (SPA navigation)
- [ ] Virtual scroll platforms accumulate AI messages correctly
- [ ] Long AI responses don't cause performance issues

---

*This spec is referenced from V10-PLAN.md task #4. The `getAIMessages()` selectors are a shared dependency with Bookmarks (BOOKMARKS.md) and Context Tracking (CONTEXT-TRACKING.md).*
