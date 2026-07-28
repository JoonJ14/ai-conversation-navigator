# getAIMessages() — Implementation Spec

Add `getAIMessages()` to every platform entry in the PLATFORMS registry, following the same fallback-chain pattern as `getUserMessages()`. This is the foundational prerequisite that unblocks Search Enhancement, Bookmarks, Summary, Tools (Image Gallery), and Context Tracking.

**Last updated:** 2026-02-23  
**Applies to:** v10.1+  
**Status:** Ready for implementation  
**Depends on:** Nothing (this IS the prerequisite)  
**Blocks:** Task #1 (Context Tracking), Task #3 (Bookmarks), Task #4 (Search), Task #5 (Summary), Task #6 (Tools/Image Gallery)

> **v12.0 update — the fallback chains had decayed to a single link each.**
>
> Live re-inspection of Claude in July 2026 found `.font-claude-response` returning 5 while `[data-testid="ai-turn"]`, `[data-testid="assistant-message"]`, `.font-claude-message` and `[data-testid$="-turn"]` all returned **0**. The user chain was in the same state: only `[data-testid="user-message"]` matched, and it had *moved* from the turn wrapper to the inner content node.
>
> The fallback-chain pattern this spec describes worked exactly as designed — it absorbed a Layer 1 break with no visible symptom. That is its value and its hazard: nothing reported the degradation, and the chain was one platform update from returning zero. Chains need periodic live verification, not just a green test suite; the mock pages were built to match the old structure and passed throughout.
>
> Note also that on Claude these selectors now return only the mounted window (~3 turns), not the conversation. They are the degraded fallback; enumeration comes from the conversation index (DEC-021).


---

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Design Pattern](#design-pattern)
4. [Platform Selectors](#platform-selectors)
5. [Verification Process](#verification-process)
6. [Global Wrapper Function](#global-wrapper-function)
7. [AI Response Array Population](#ai-response-array-population)
8. [Implementation Details](#implementation-details)
9. [Testing Checklist](#testing-checklist)

---

## Overview

The script currently only knows how to find user messages (`getUserMessages()`). Multiple v10.1 features need to find AI response elements too:

| Feature | Why it needs AI messages |
|---------|------------------------|
| Search Enhancement | Search through AI response text (Q# + A# results) |
| Bookmarks | Inject bookmark icons on AI response messages |
| Summary | Extract topics, key points, code blocks from AI text |
| Tools (Image Gallery) | Find images in both user and AI messages |
| Context Tracking | DOM text estimation fallback (non-Claude platforms) |

Every platform entry in PLATFORMS gets a `getAIMessages()` function that returns a NodeList or Array of DOM elements representing AI responses, matching the exact pattern of `getUserMessages()`.

---

## Current State

Each platform entry has `getUserMessages()` using a fallback chain of CSS selectors:

```javascript
claude: {
    // ...
    getUserMessages: function () {
        var messages = document.querySelectorAll('[data-testid="user-human-turn"]');
        if (messages.length === 0) messages = document.querySelectorAll('[data-testid="user-message"]');
        if (messages.length === 0) messages = document.querySelectorAll('.font-user-message');
        if (messages.length === 0) {
            var bubbles = document.querySelectorAll('div.bg-bg-200.rounded-lg');
            messages = Array.from(bubbles).filter(function (bubble) {
                return bubble.closest('.items-end');
            });
        }
        return messages;
    },
},
```

No `getAIMessages()` exists on any platform. This needs to be added.

---

## Design Pattern

Follow the identical fallback-chain pattern:

```javascript
getAIMessages: function () {
    // Selector 1: Most reliable, test-id or semantic attribute
    var messages = document.querySelectorAll('[data-testid="ai-turn"]');
    // Selector 2: Fallback class name
    if (messages.length === 0) messages = document.querySelectorAll('.ai-response-class');
    // Selector 3: Structural fallback (filter from shared container)
    if (messages.length === 0) {
        var all = document.querySelectorAll('.message-container');
        messages = Array.from(all).filter(function (el) {
            return !el.classList.contains('user');
        });
    }
    return messages;
}
```

**Rules:**
1. Most specific/stable selector first (data-testid, data-role, semantic attributes)
2. Class-based selectors as fallback
3. Structural filtering as last resort (all messages minus user messages)
4. Must return elements that contain the full AI response content (text, code blocks, images)
5. Return NodeList or Array — caller handles conversion

---

## Platform Selectors

These are **starting points** based on known DOM patterns. Every single one MUST be live-verified on the actual platform before implementation.

### Claude (claude.ai)

```javascript
getAIMessages: function () {
    // Primary: data-testid on AI turn containers
    var messages = document.querySelectorAll('[data-testid="ai-turn"]');
    // Fallback: assistant message containers
    if (messages.length === 0) messages = document.querySelectorAll('[data-testid="assistant-message"]');
    // Fallback: response content with specific font class
    if (messages.length === 0) messages = document.querySelectorAll('.font-claude-message');
    // Structural fallback: conversation turns that aren't user turns
    if (messages.length === 0) {
        var allTurns = document.querySelectorAll('[data-testid$="-turn"]');
        messages = Array.from(allTurns).filter(function (el) {
            return !el.getAttribute('data-testid').includes('human');
        });
    }
    return messages;
}
```

**Research note:** Claude's DOM uses `data-testid` attributes extensively. The AI turn container likely has a complementary testid to `user-human-turn`. Inspect with DevTools: look for the parent container of Claude's response that includes all content (text paragraphs, code blocks, artifacts, images).

### ChatGPT (chatgpt.com)

```javascript
getAIMessages: function () {
    // Primary: role attribute (same container used for user messages)
    var allMessages = document.querySelectorAll('[data-message-author-role]');
    var messages = Array.from(allMessages).filter(function (msg) {
        return msg.getAttribute('data-message-author-role') === 'assistant';
    });
    // Fallback: markdown content containers that aren't in user bubbles
    if (messages.length === 0) {
        messages = Array.from(document.querySelectorAll('.markdown.prose')).filter(function (el) {
            return !el.closest('.bg-token-bg-tertiary');
        });
    }
    return messages;
}
```

**Research note:** ChatGPT uses `data-message-author-role="assistant"` — the mirror of `"user"` which `getUserMessages()` already filters on. This is likely the most reliable selector.

### Grok (grok.com)

```javascript
getAIMessages: function () {
    // Primary: message bubbles with assistant/bot indicators
    var allBubbles = document.querySelectorAll('div.message-bubble');
    var messages = [];
    if (allBubbles.length > 0) {
        messages = Array.from(allBubbles).filter(function (bubble) {
            var classList = bubble.className.toLowerCase();
            if (classList.includes('assistant') || classList.includes('bot') || classList.includes('ai')) return true;
            var parent = bubble.closest('[class*="assistant"], [class*="bot"], [data-role="assistant"]');
            if (parent) return true;
            return false;
        });
        // If role-based filtering found nothing, try even/odd (AI = odd indices)
        if (messages.length === 0) {
            messages = Array.from(allBubbles).filter(function (bubble, index) {
                return index % 2 === 1;
            });
        }
    }
    // Fallback: data-role
    if (messages.length === 0) messages = document.querySelectorAll('[data-role="assistant"]');
    return messages;
}
```

**Research note:** Grok's `getUserMessages()` uses even-index fallback (`index % 2 === 0`). AI messages would be odd indices. But priority should go to class/role-based selectors.

### Gemini (gemini.google.com)

```javascript
getAIMessages: function () {
    // Primary: model response containers
    var messages = document.querySelectorAll('div.model-response-text');
    if (messages.length === 0) messages = document.querySelectorAll('.response-content');
    if (messages.length === 0) messages = document.querySelectorAll('[data-model-response]');
    // Structural: content blocks that aren't query text
    if (messages.length === 0) {
        var allContent = document.querySelectorAll('.conversation-container > div');
        messages = Array.from(allContent).filter(function (el) {
            return !el.querySelector('.query-text') && el.textContent.trim().length > 0;
        });
    }
    return messages;
}
```

**Research note:** Gemini uses `.query-text` for user messages. AI responses likely have a different class. Remember Gemini's Trusted Types CSP — don't use innerHTML when working with these elements.

### Perplexity (perplexity.ai)

```javascript
getAIMessages: function () {
    // Primary: answer containers
    var messages = document.querySelectorAll('[class*="Answer"], [class*="answer"]');
    if (messages.length === 0) messages = document.querySelectorAll('.prose');
    // Structural: sibling blocks after search results
    if (messages.length === 0) {
        var responseBlocks = document.querySelectorAll('[class*="response"], [class*="Result"]');
        messages = Array.from(responseBlocks).filter(function (el) {
            return el.textContent.trim().length > 50; // filter out tiny UI elements
        });
    }
    return messages;
}
```

**Research note:** Perplexity structures responses differently from chat platforms — responses include citations, source cards, and answer text. The AI message element should encompass the full answer section including any code blocks.

### IDE Platforms (Bolt, Lovable, etc.)

These follow the same principle. Each already has `getUserMessages()` with platform-specific selectors. The `getAIMessages()` version filters for AI/assistant messages instead.

For all IDE platforms, the general strategy is:
1. Find all message containers with the shared selector
2. Filter for those that are NOT user messages
3. AI messages are typically the ones with markdown-rendered content, code diffs, or file operation logs

Detailed selectors for IDE platforms should be verified during live DOM inspection. They can be implemented in a follow-up pass after the 5 orbital platforms are confirmed working.

---

## Verification Process

**CRITICAL: Every selector must be verified on the live platform before committing.**

### Manual verification (minimum)

For each platform:

1. Open a conversation with at least 5 back-and-forth exchanges
2. Open browser DevTools Console
3. Run the selector chain and verify results:

```javascript
// Test each selector individually
var s1 = document.querySelectorAll('[data-testid="ai-turn"]');
console.log('Selector 1:', s1.length, 'elements');
s1.forEach(function(el, i) { console.log('  #' + i, el.textContent.substring(0, 80)); });

var s2 = document.querySelectorAll('.alternative-selector');
console.log('Selector 2:', s2.length, 'elements');
// ... etc
```

4. Confirm:
   - [ ] Count matches expected number of AI responses
   - [ ] Each element contains the full response text
   - [ ] Code blocks within responses are inside the element
   - [ ] Images within responses are inside the element
   - [ ] No false positives (UI chrome, system messages, etc.)

### Automated verification (ideal)

Use Playwright tests with mock HTML pages (already in test infrastructure). Create mock pages for each platform with known AI response DOM structures. Test that `getAIMessages()` returns expected elements.

### Known DOM instability

Platform DOMs change without notice. The fallback chain pattern handles this — if Selector 1 breaks, Selector 2 catches it. Document which selectors were verified and when:

```javascript
getAIMessages: function () {
    // Verified 2026-02-XX on claude.ai
    var messages = document.querySelectorAll('[data-testid="ai-turn"]');
    // Fallback (verified 2026-02-XX)
    if (messages.length === 0) messages = document.querySelectorAll('...');
    return messages;
}
```

---

## Global Wrapper Function

Mirror the existing `getUserMessages()` wrapper:

```javascript
// Existing:
function getUserMessages() {
    return platform.getUserMessages();
}

// New:
function getAIMessages() {
    if (platform.getAIMessages) {
        return platform.getAIMessages();
    }
    return []; // graceful fallback if not implemented for this platform
}
```

The `if` check ensures that platforms without `getAIMessages()` yet (e.g., IDE platforms still pending verification) don't crash the script. Features that depend on AI messages should check for an empty array and degrade gracefully.

---

## AI Response Array Population

Create a `_aiResponses` array parallel to `_questions`, populated by the same MutationObserver that tracks user messages:

```javascript
var _aiResponses = [];

// In the MutationObserver callback or polling function:
function refreshMessages() {
    var userMsgs = Array.from(getUserMessages());
    var aiMsgs = Array.from(getAIMessages());

    // Update _questions (existing logic)
    _questions = userMsgs;

    // Update _aiResponses (new)
    _aiResponses = aiMsgs;

    // Trigger dependent UI updates
    orbPopulateQuestions();
}
```

### Message ordering

Features like Search and Export need messages in conversation order (user → AI → user → AI). Since `getUserMessages()` and `getAIMessages()` return separate NodeLists, we need to interleave them by DOM position:

```javascript
function getAllMessagesOrdered() {
    var userMsgs = Array.from(getUserMessages()).map(function (el) {
        return { element: el, type: 'user' };
    });
    var aiMsgs = Array.from(getAIMessages()).map(function (el) {
        return { element: el, type: 'ai' };
    });

    var all = userMsgs.concat(aiMsgs);

    // Sort by DOM position
    all.sort(function (a, b) {
        var pos = a.element.compareDocumentPosition(b.element);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
    });

    return all;
}
```

`compareDocumentPosition` is the reliable way to sort elements by their order in the DOM tree, regardless of how they were queried.

---

## Implementation Details

### Summary of changes

| Location | Change |
|----------|--------|
| PLATFORMS registry (each entry) | Add `getAIMessages()` function |
| Global functions section | Add `getAIMessages()` wrapper |
| Global variables | Add `var _aiResponses = [];` |
| MutationObserver / polling | Populate `_aiResponses` alongside `_questions` |
| New utility | Add `getAllMessagesOrdered()` for conversation-order access |

### Implementation order

1. **Claude first** — this is where we develop and test daily
2. **ChatGPT second** — largest user base, likely most reliable selectors
3. **Gemini, Grok, Perplexity** — verify and add
4. **IDE platforms** — lower priority, add as time permits

### Graceful degradation

If `getAIMessages()` returns empty on a platform:
- Search works but only finds user messages (current behavior)
- Bookmarks only attach to user messages
- Summary generates topics from user messages only (reduced quality but functional)
- Image Gallery shows user-uploaded images only
- No crashes, no errors

---

## Testing Checklist

### Per-platform verification
- [ ] Claude: `getAIMessages()` returns correct count of AI responses
- [ ] Claude: Each returned element contains full response text + code blocks
- [ ] ChatGPT: `getAIMessages()` returns correct count
- [ ] ChatGPT: Each returned element contains full response content
- [ ] Grok: `getAIMessages()` returns correct count
- [ ] Gemini: `getAIMessages()` returns correct count
- [ ] Perplexity: `getAIMessages()` returns correct count

### Functional tests
- [ ] `getAIMessages()` returns empty array (not error) on platforms where not yet implemented
- [ ] `_aiResponses` array populates on page load
- [ ] `_aiResponses` array updates when new AI responses arrive
- [ ] `getAllMessagesOrdered()` returns correct interleaved order
- [ ] `compareDocumentPosition` sorting matches visual conversation order
- [ ] No false positives (avatars, UI elements, system messages not included)
- [ ] No false negatives (all AI responses found, including long ones with code blocks)

### Fallback chain verification
- [ ] If primary selector breaks, fallback selectors catch it
- [ ] If all selectors fail, empty array returned (no crash)

### Integration smoke tests
- [ ] Search finds text in AI responses after `getAIMessages()` is wired up
- [ ] Bookmarks can be added to AI messages
- [ ] Summary extracts topics from AI response text
- [ ] Image Gallery finds images in AI responses

---

*This spec is referenced from V10-PLAN.md task #0. This is the prerequisite — implement and verify before starting dependent tasks.*
