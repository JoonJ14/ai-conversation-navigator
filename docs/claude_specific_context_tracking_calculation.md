# Claude-Specific Context Window Calculation

Deep-dive into how the AI Conversation Navigator estimates token usage for Claude conversations, why a naïve DOM-scraping approach severely underestimates for extended thinking conversations, and how the current multi-factor estimation works.

**Last updated:** 2026-02-23
**Applies to:** v10.7.10+
**Relevant code:** `_renderEstimatedBar()`, `orbUpdateContextBar()`, `CTX_LIMITS`

---

## The Problem

The context window bar in the Navigate panel shows a % utilization of the conversation's token limit. For Claude, the limit is 200K tokens. The goal is to give the user a meaningful warning before their conversation fills up.

A Claude Opus 4.6 Extended Thinking conversation with 83 user questions that had physically exhausted the 200K context limit (Claude was generating failure responses) showed only **45% / ~90K tokens** in the bar. The user expected it to show near 100%.

---

## Three Rendering Paths

`orbUpdateContextBar()` branches into three paths:

### Path A — Claude with Exact SSE Data (most accurate)

When the user generates a new message in the current page session, the script intercepts Claude's streaming SSE events via XHR monitoring. The `message_start` event includes `usage.input_tokens` — the exact number of tokens in the full context window for that generation.

```javascript
if (platform.id === 'claude' && _sseTokenData.exact) {
    var pctNum = Math.min(100, Math.round((_sseTokenData.inputTokens / limit) * 100));
    // Display exact reading — no estimation needed
}
```

**Accuracy: exact.** This path is used whenever Claude generates a response during the current page session. The `input_tokens` value from Claude's API is the actual context size at that moment.

**Limitation:** The `_sseTokenData.exact` flag is only set when a generation completes in the current session. If the user revisits a historical conversation without sending a new message, Path B is used instead.

### Path B — Claude Without SSE Data (estimation)

For historical/revisited conversations, the script estimates from DOM content. This is where the 45% problem occurred.

### Path C — Non-Claude Platforms

Non-Claude platforms use turn-counter dot visualization alongside DOM-based estimation. Same estimation function as Path B but without the Claude-specific overhead corrections.

---

## How DOM-Based Estimation Works (Path B)

```javascript
function _renderEstimatedBar(pct, fill, meta, limit) {
    // Step 1: Find the scrollable conversation container
    var node = anchor.parentElement;
    while (node && node !== document.body) {
        var st = window.getComputedStyle(node);
        if (st.overflowY === 'auto' || st.overflowY === 'scroll') {
            totalChars = (node.innerText || '').length;
            found = true;
            break;
        }
        node = node.parentElement;
    }

    // Step 2: Chars ÷ 4 = estimated tokens (standard English prose estimate)
    var estTokens = Math.round(totalChars / 4);

    // Step 3: Display
}
```

The standard assumption is 4 characters per token for English prose. For a 200K token conversation, this would suggest ~800K chars in the DOM.

---

## Why the Naïve Estimate Was Wrong (45% Instead of ~100%)

Three factors account for the gap between 90K estimated and ~200K actual:

### Factor 1: System Prompt (Always Present)

Claude.ai injects a system prompt into every conversation context. This system prompt is never rendered anywhere in the page DOM — it exists only in the API request payload. Investigation text in the conversation itself confirmed: *"system prompts (which on claude.ai can be 15K+ tokens)"*.

**Contribution:** ~15,000 tokens invisible to DOM scraping.

### Factor 2: Extended Thinking Blocks (The Main Culprit)

Claude Opus Extended Thinking generates reasoning chains before producing each response. Claude.ai renders these as **collapsed expandable summaries** — a short phrase like "Examined repository state to assess project progress and next steps" in a collapsible element (`[aria-expanded]`). The **full thinking content** — which can be hundreds to thousands of tokens — is never placed in the DOM.

**Investigation methodology:**

```javascript
// Count collapsed thinking summaries in the conversation container
var uiKeywords = ['hide','show','expand','collapse','menu','chat','chats','project','artifact','recent','starred'];
var thinkingCount = 0;
node.querySelectorAll('[aria-expanded]').forEach(function(el) {
    var txt = (el.textContent || '').trim().toLowerCase();
    var isUI = txt.length < 5 || uiKeywords.some(function(w) { return txt.indexOf(w) !== -1; });
    if (!isUI) thinkingCount++;
});
```

**For the 83Q maxed conversation:**
- 167 total `[aria-expanded]` elements in conversation container
- 6 identified as UI elements (sidebar links, etc.)
- **161 thinking block summaries** — 1.94 per response on average
- Gap: 200K actual - 90K visible = 110K hidden tokens
- Per-block estimate: 110K ÷ 161 = **~683 tokens per thinking block**

The per-600 estimate used in the code is conservative — actual average was 683 — keeping the estimate slightly under 100% rather than hitting the cap. This is intentional: slightly under-reporting is better than systematically over-reporting.

### Factor 3: Virtual Scroll (Platform-Dependent)

Some platforms (and potentially Claude.ai for very long conversations) use virtual scroll — removing older DOM nodes as new ones are added. The `innerText` of the scrollable container only captures currently-rendered nodes.

**For the 83Q conversation:** Not applicable — DOM inspection confirmed all 83 questions were present in the live DOM (`scrollHeight = 98,393px` for a 652px viewport, confirmed via `document.body.contains()` check for all question elements).

**For other platforms:** The coverage-ratio correction handles this:

```javascript
var nInDOM   = _questions.filter(function(q) {
    return q.element && document.body.contains(q.element);
}).length;
var coverage = nInDOM / Math.max(1, _questions.length);
// coverage=1.0 → all in DOM → no correction
// coverage=0.5 → half in DOM → ×2 correction (capped at ×4)
var estTokens = Math.round((totalChars / 4) / Math.max(0.25, coverage));
```

The `_questions` array uses VS accumulation — it records ALL messages ever seen during the session (including those later removed from DOM), so `_questions.length` is the true total while `nInDOM` is the current DOM subset. Their ratio gives an accurate correction factor automatically.

---

## The Complete Estimation Formula (v10.7.10+)

```javascript
// Step 1: Get visible text from scrollable container
totalChars = scrollableContainer.innerText.length;

// Step 2: Base estimate (4 chars per token)
estTokens = Math.round(totalChars / 4);

// Step 3: Virtual scroll correction (any platform)
var nInDOM   = _questions.filter(q => document.body.contains(q.element)).length;
var coverage = nInDOM / Math.max(1, _questions.length);
estTokens = Math.round(estTokens / Math.max(0.25, coverage));

// Step 4: Claude-specific invisible overhead
if (platform.id === 'claude' && scrollContainerFound) {
    // System prompt: always present, never in DOM
    estTokens += 15000;

    // Extended thinking blocks: count collapsed summaries, ~600 tokens each
    var thinkingCount = countThinkingBlocks(scrollableContainer);
    estTokens += thinkingCount * 600;
}

// Step 5: Cap at 100% and display
var pctNum = Math.min(100, Math.round((estTokens / limit) * 100));
```

**Result for 83Q maxed Opus Extended conversation:**
| Component | Tokens |
|-----------|--------|
| Visible DOM text (360K chars ÷ 4) | 90,000 |
| Virtual scroll correction (coverage=1.0, no change) | +0 |
| System prompt | +15,000 |
| 161 thinking blocks × 600 | +96,600 |
| **Total** | **201,600** |
| **Displayed** | **100% (capped, red)** |

---

## Color Thresholds

```javascript
function getBarColor(pct) {
    if (pct < 70)  return '#22c55e';   // Green  — plenty of room
    if (pct < 85)  return '#eab308';   // Yellow — getting full
    return '#ef4444';                   // Red    — nearly full
}
```

| Range | Color | Intent |
|-------|-------|--------|
| 0–69% | Green | Conversation has significant room remaining |
| 70–84% | Yellow | Getting full — consider starting a new conversation soon |
| 85–100% | Red | Nearly full — quality may degrade, compaction likely imminent |

Additionally:
- **⚡ compaction badge**: shown when `_compactionCount > 0` (Claude's context compaction has fired at least once)
- **⚠ warning text**: shown at 85%+ ("Context nearly full — quality may degrade")

---

## Accuracy Assessment

| Conversation Type | Path | Expected Accuracy |
|-------------------|------|-------------------|
| Active generation (any model) | A — SSE exact | ±0 (exact) |
| Historical, no extended thinking | B — estimated | ±10-15% |
| Historical, extended thinking, few blocks | B — estimated | ±15-25% |
| Historical, extended thinking, many blocks | B — estimated | ±10-20% |
| Non-Claude platforms | C — turn dots + estimate | Qualitative only |

The fundamental limitation of Path B: we cannot know the thinking depth per block without the actual token count from the API. A thinking block that ran for 10 seconds ≠ 600 tokens in all cases. The 600 token per block estimate is calibrated from the 83Q test case (683 tokens actual average) and is intentionally conservative.

**The only way to get exact context usage for a historical Claude conversation is to send a new message.** After any new generation, Path A takes over and shows the exact value.

---

## Why Not Just Read the Token Count from the Page?

Claude.ai does not expose token counts in the page DOM. The usage data appears only in the API response stream (SSE), which is why Path A intercepts XHR. For historical conversations where no API call has been made in the current session, the token count simply isn't available anywhere in the browser environment.

---

## Future Improvements

1. **Per-block duration data**: If claude.ai ever renders thinking duration (e.g., "Thought for 23s"), we could calibrate per-block estimates from `seconds × tokens/second`. Currently the summaries show descriptive text only.
2. **Cache SSE data across page reloads**: Store the last-known `input_tokens` in `GM_setValue` keyed by conversation URL. If the user revisits, Path A data would be available without a new generation.
3. **Conversation-level calibration**: After Path A runs, compare the exact token count to what Path B would have estimated, and derive a per-conversation correction factor.
