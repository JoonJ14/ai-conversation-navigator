# Context Window & Token Tracking

Research, implementation plans, and technical reference for the context window usage bar in AI Conversation Navigator.

**Last updated:** 2026-02-22  
**Applies to:** v10.0+ (Orbital UI)  
**Status:** Planning — ready for implementation handoff

> **v12.0 update — the DOM paths were undercounting by roughly 35x.**
>
> Path A and Path B both measured `innerText` on the scroll container, which on a virtualized list contains only the mounted window. The existing virtual-scroll coverage correction could never compensate: `_questions` is rebuilt from live DOM on every scan, so `nInDOM / _questions.length` evaluated to exactly `1.0` and the correction was a no-op. This is the underlying cause of the long-standing "turn counter red but context shows 19%" mismatch that PR #47 only partially addressed.
>
> Both paths now use `ciTotalChars()` over the full active path when the index is ready. Extended-thinking tokens come from real `content[]` blocks of type `thinking` via `ciTotalThinkingChars()`, replacing the `[aria-expanded] × 600 tokens` heuristic — which was itself doubly wrong here, since it could only count *mounted* thinking blocks.
>
> This matters most on Firefox, where SSE interception is disabled (DEC-020) and Path B is the only path, making the undercount permanent for those users.


---

## Table of Contents

1. [Overview](#overview)
2. [Current Implementation (v10.0) — Problems](#current-implementation-v100--problems)
3. [Real-World Failure Analysis](#real-world-failure-analysis)
4. [Platform Token Exposure Research](#platform-token-exposure-research)
5. [Design Decision: Two-Tier Architecture](#design-decision-two-tier-architecture)
6. [Tier 1: Claude — Exact Token Bar (SSE Interception)](#tier-1-claude--exact-token-bar-sse-interception)
7. [Tier 2: Non-Claude — Adaptive Turn Counter](#tier-2-non-claude--adaptive-turn-counter)
8. [Compaction Mechanics & Detection](#compaction-mechanics--detection)
9. [Universal: Degradation Warning System](#universal-degradation-warning-system)
10. [Context Window Limits Reference](#context-window-limits-reference)
11. [Visual Design Specifications](#visual-design-specifications)
12. [Future Considerations](#future-considerations)

---

## Overview

The Navigate panel includes a **context window usage indicator** that helps users understand when they're approaching the model's memory limit and should consider starting a new conversation.

The indicator behaves differently depending on the platform:

- **Claude:** Exact token bar with precise counts from SSE stream interception
- **All other platforms:** Adaptive turn counter that learns compaction thresholds from observed behavior

Both tiers include **compaction markers** (when compaction is detected) and a **universal degradation warning** when multiple compactions have occurred.

---

## Current Implementation (v10.0) — Problems

### How It Works Now

The current `orbUpdateContextBar()` function (line ~1522) uses a **scroll-container walk-up** approach:

1. Takes the first detected user message element as an anchor
2. Walks up the DOM tree via `parentElement` until it finds a scrollable container (`overflowY: auto|scroll`)
3. Reads `node.innerText` from that container to get total character count
4. Falls back to `userChars × 3` if the walk-up fails
5. Estimates tokens as `totalChars / 4`
6. Computes percentage against the platform's known context limit

### Problems

| Issue | Impact |
|-------|--------|
| **Noise from UI chrome** | `innerText` on the scroll container captures timestamps, button labels, typing indicators, sidebar bleed-through — inflating the count |
| **Virtual scroll** | Emergent virtualizes its message list (Virtuoso recycling — only mounted messages exist in DOM). Gemini was long asserted here to do the same; a live measurement (Jul 30, 2026, Chromium, 10-turn conversation) found **no recycling at n≤10** — all turns stay mounted at every scroll position. Unresolved beyond that scale (its scroller is an `<infinite-scroller>`). See `DOM-REFERENCE.md` → "Virtualization status" for the canonical record |
| **Performance** | `innerText` forces a layout reflow. On a 200-message conversation this causes UI hitches |
| **Fallback is crude** | The `× 3` multiplier when walk-up fails has no empirical basis |
| **No AI message awareness** | The code doesn't explicitly identify AI responses |
| **Invisible context is massive** | System prompts (2K–25K+), tool definitions, thinking tokens, uploaded files, memory/project instructions, web search results — none visible in DOM |

---

## Real-World Failure Analysis

### The 5% vs 90% Problem

In a real conversation that triggered compaction (meaning actual context was ~80–90% full), the context bar showed **5%**. Root cause traced through the code:

```
30 user messages × 200 avg chars = 6,000 user chars
× 3 fallback multiplier          = 18,000 total chars
÷ 4 (chars per token)            = 4,500 tokens
÷ 200,000 (Claude limit)         = 2.25%
```

Actual usage was ~160K–180K tokens. The visible text was only **~3%** of actual context consumption.

### Why the Gap Is So Large

In a research-heavy conversation (web searches, extended thinking, tool use), the invisible overhead isn't 20–30% — it can be **95%+ invisible**:

- System prompt + tools + memory + project instructions: 15K–25K tokens
- Each web search: injects 10 documents of snippets into context (~10K–15K tokens per search)
- Extended thinking: thousands of tokens per turn, invisible to user
- Compaction summary from prior context: injected as system-level block
- Each turn re-sends ENTIRE history, compounding all of the above

**Conclusion:** DOM-based token estimation is fundamentally inadequate for percentage-bar accuracy. The gap between visible text and actual token usage is too large and too variable to bridge with heuristics. This led to the two-tier design decision.

---

## Platform Token Exposure Research

We investigated whether each orbital platform exposes exact token counts interceptable by a userscript. The critical distinction is **API** vs. **web app**.

### Claude (claude.ai) — ✅ Exact tokens available via SSE

**Evidence:** Claude's web app uses the same SSE streaming format as the public Anthropic Messages API. The stream includes:

- `message_start` event → `usage.input_tokens` (exact count of all input/prompt tokens)
- `message_delta` event (near end) → `usage.output_tokens` (cumulative output tokens)

Confirmed by:
- Anthropic's official streaming docs
- Claude Code SSE traffic analysis showing identical format
- SSE format is stable and versioned (`anthropic-version: 2023-06-01`)

`input_tokens` is cumulative — it represents the ENTIRE context sent to the model (system prompt + full conversation history + tools + files + thinking). This is exactly what we need.

### ChatGPT (chatgpt.com) — ❌ Not feasible

- Internal `/backend-api/conversation` endpoint differs from public OpenAI API
- Public API requires `stream_options: {"include_usage": true}` which only the API caller can set
- Some configurations use WebSockets instead of SSE
- Internal stream format undocumented and changes without notice

### Grok (grok.com) — ❓ Unconfirmed

- xAI's public API includes usage in every SSE chunk
- grok.com's internal endpoints are unknown — may or may not mirror public API
- Would require network traffic inspection to confirm

### Gemini (gemini.google.com) — ❓ Unconfirmed + CSP risk

- Gemini API includes `usageMetadata` in final stream chunk
- gemini.google.com uses Trusted Types CSP that already blocks `innerHTML`
- Fetch interception may face similar CSP hurdles

### Perplexity (perplexity.ai) — ❌ Not feasible

- Architecture opaque, no documented token counts in streaming responses
- Pipeline model (search + synthesis) makes token accounting complex

### Summary Table

| Platform | Exact tokens? | Method | Confidence |
|----------|:------------:|--------|:----------:|
| Claude | ✅ Yes | SSE interception (`fetch` monkey-patch) | High |
| ChatGPT | ❌ No | Turn counter only | — |
| Grok | ❓ Maybe | Unconfirmed for web app | Low |
| Gemini | ❓ Maybe | Unconfirmed + CSP risk | Low |
| Perplexity | ❌ No | Turn counter only | — |

---

## Design Decision: Two-Tier Architecture

### Why Not DOM Estimation For All?

We considered three approaches for non-Claude platforms:

1. **DOM-based token percentage** — Rejected. The gap between visible text and actual tokens (sometimes 95%+ invisible) makes any percentage display misleading. Showing "5%" right before compaction is worse than showing nothing.

2. **Turn counter with fixed thresholds** — Rejected. Turns are not equal weight. A "what's 2+2" turn might be 50 tokens. A "do deep research on X" turn might be 50,000 tokens. Fixed thresholds (e.g., yellow at 15 turns) would show green right before compaction in heavy conversations, giving false confidence.

3. **Adaptive turn counter with weighted averages** — Selected. Starts blind, learns from observed compaction events, predicts future compaction timing based on rolling weighted average of past cycle lengths.

### Why SSE for Claude Only?

Claude is the only platform where we have high-confidence evidence that the web app exposes exact token counts in an interceptable format. The SSE stream uses the same documented, versioned format as the public API. Other platforms either don't expose tokens, use undocumented formats, or have CSP restrictions that make interception risky.

### Final Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Context Indicator                    │
├──────────────────────┬──────────────────────────────┤
│     Claude (SSE)     │     Non-Claude (Adaptive)     │
├──────────────────────┼──────────────────────────────┤
│ Exact token bar      │ Turn counter + depth dots     │
│ "24,012 / 200K"      │ "Turn 7" + dot indicators     │
│ ● exact label        │ Calibrates after 1st compact  │
│ Green/yellow/red bar │ Weighted avg cycle prediction  │
│ Compaction markers   │ Compaction markers             │
│ Degradation warnings │ Degradation warnings           │
└──────────────────────┴──────────────────────────────┘
```

---

## Tier 1: Claude — Exact Token Bar (SSE Interception)

### How It Works

Monkey-patch `window.fetch` to passively intercept Claude's conversation SSE stream. Clone the response (so the page still works normally), parse SSE events for token usage data.

### Claude's SSE Stream Format

#### `message_start` — input token count

```
event: message_start
data: {"type": "message_start", "message": {"usage": {"input_tokens": 25, "output_tokens": 1}}}
```

`input_tokens` = exact count of everything sent to the model (system prompt, full history, tools, files, thinking from prior turns). This IS the context window usage.

#### `message_delta` — cumulative output token count

```
event: message_delta
data: {"type": "message_delta", "usage": {"output_tokens": 15}}
```

#### `message_stop` — end of stream

```
event: message_stop
data: {"type": "message_stop"}
```

### What We Extract

- `input_tokens` from `message_start` → how full the context window is RIGHT NOW
- `output_tokens` from `message_delta` → tokens model generated this turn
- Display: `input_tokens / CTX_LIMIT` as percentage and bar fill
- Because the API is stateless (frontend re-sends full history), each new `input_tokens` is the definitive context usage — no summing across turns needed

### Why `input_tokens` Is the Right Number

```
Turn 1: input_tokens = 500     (system prompt + first message)
Turn 2: input_tokens = 2,300   (system + msg1 + resp1 + msg2)
Turn 3: input_tokens = 8,100   (system + all history + msg3)
Turn 4: input_tokens = 24,012  (system + all history + msg4)
```

Monotonically increasing. Directly represents context window fill level.

### Fetch Monkey-Patch Implementation

```javascript
var _sseTokenData = {
    inputTokens:  0,
    outputTokens: 0,
    lastUpdated:  0,
    exact:        false
};

function setupClaudeSSEInterceptor() {
    var pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    var origFetch  = pageWindow.fetch;

    pageWindow.fetch = function (resource, config) {
        var result = origFetch.apply(this, arguments);

        var url = (typeof resource === 'string') ? resource : (resource.url || '');
        var method = ((config && config.method) || 'GET').toUpperCase();

        if (method === 'POST' && (
            url.indexOf('/api/organizations/') !== -1 &&
            url.indexOf('/chat_conversations/') !== -1 ||
            url.indexOf('/api/append_message') !== -1 ||
            url.indexOf('/completion') !== -1
        )) {
            result.then(function (response) {
                var clone = response.clone();
                readSSEStream(clone.body);
            }).catch(function () {});
        }

        return result;
    };
}

function readSSEStream(body) {
    if (!body) return;
    var reader = body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function processChunk(result) {
        if (result.done) return;
        buffer += decoder.decode(result.value, { stream: true });
        var events = buffer.split('\n\n');
        buffer = events.pop();
        events.forEach(function (eventStr) { parseSSEEvent(eventStr); });
        reader.read().then(processChunk).catch(function () {});
    }

    reader.read().then(processChunk).catch(function () {});
}

function parseSSEEvent(eventStr) {
    var lines = eventStr.split('\n');
    var eventType = '';
    var data = '';

    lines.forEach(function (line) {
        if (line.indexOf('event: ') === 0) eventType = line.substring(7).trim();
        else if (line.indexOf('data: ') === 0) data += line.substring(6);
    });

    if (!data) return;

    try {
        var parsed = JSON.parse(data);

        if (eventType === 'message_start' || parsed.type === 'message_start') {
            var usage = parsed.message && parsed.message.usage;
            if (usage && typeof usage.input_tokens === 'number') {
                _sseTokenData.inputTokens = usage.input_tokens;
                _sseTokenData.exact       = true;
                _sseTokenData.lastUpdated = Date.now();
            }
        }

        if (eventType === 'message_delta' || parsed.type === 'message_delta') {
            var deltaUsage = parsed.usage;
            if (deltaUsage && typeof deltaUsage.output_tokens === 'number') {
                _sseTokenData.outputTokens = deltaUsage.output_tokens;
                _sseTokenData.lastUpdated  = Date.now();
                orbUpdateContextBar(); // trigger UI update
            }
        }
    } catch (e) {}
}
```

### URL Pattern for Claude's Conversation Endpoint

```
POST https://claude.ai/api/organizations/{org_id}/chat_conversations/{conv_id}/completion
```

Key identifiers: contains `/api/organizations/` AND `/chat_conversations/`, OR contains `/completion`. Method is POST.

### Graceful Fallback

If SSE interception fails (URL pattern changes, CSP blocks, stream errors), the context bar should degrade gracefully:

```javascript
if (platform.id === 'claude' && _sseTokenData.exact && _sseTokenData.lastUpdated > 0) {
    renderContextBar(_sseTokenData.inputTokens, limit, true); // true = exact
    return;
}
// Fall through to turn counter (same as non-Claude)
```

### Compaction Behavior (Self-Correcting)

After compaction, Claude's frontend replaces full history with a compact summary. The next `message_start` will show dramatically lower `input_tokens` (e.g., 186K → 22K). The bar automatically drops — no special handling needed.

We detect compaction by observing a >50% drop in `input_tokens` between consecutive turns:

```javascript
var _prevInputTokens = 0;

// In parseSSEEvent, after extracting input_tokens:
if (_prevInputTokens > 0 && usage.input_tokens < _prevInputTokens * 0.5) {
    _compactionCount++;
    _compactionHistory.push({
        turn: _currentTurn,
        fromTokens: _prevInputTokens,
        toTokens: usage.input_tokens,
        timestamp: Date.now()
    });
}
_prevInputTokens = usage.input_tokens;
```

### Timing

Set up interceptor **before** `injectOrbital()`, immediately after platform detection:

```javascript
if (platform.id === 'claude') {
    setupClaudeSSEInterceptor();
}
```

### Display Format

```
Context    24,012 / 200K
[████░░░░░░░░░░░░░░░░] 
● exact

Context    186,291 / 200K
[██████████████████░░]
● exact

After compaction:
Context    22,540 / 200K
[██░░░░░░░░░░░░░░░░░░]
⟲ compacted at turn 26 · 186K → 22K
```

Bar colors: green (<70%), yellow (70–84%), red (85%+).

---

## Tier 2: Non-Claude — Adaptive Turn Counter

### Why Not a Token Percentage Bar?

In non-Claude conversations, the gap between visible DOM text and actual token consumption can be **95%+** (system prompts, web search results, thinking tokens, tool calls are all invisible). A percentage bar would consistently show low numbers right before compaction, which is actively misleading. A turn counter with learned thresholds is honest about what we don't know while becoming useful over time.

### How It Works

**Phase 1 — Pre-calibration (before first compaction):**
- Display turn count with neutral (gray) dots
- No color predictions — we don't know when compaction will happen
- 10 dots, filled proportionally to turn count (neutral color)
- Status text: "Turn N"

**Phase 2 — Post-calibration (after first compaction):**
- Record: compaction happened at turn N
- Rescale dots: 10 dots now represent the predicted cycle length
- Apply green/yellow/red coloring based on position within predicted cycle
- Status text: "~M turns until compact"
- Track "since last compact" turn count, display progress through predicted cycle

**Phase 3 — Refinement (after 2+ compactions):**
- Use **weighted rolling average** of all observed cycle lengths to predict next cycle
- More compactions = more accurate prediction
- Continue refining thresholds each cycle

### Weighted Rolling Average Algorithm

Not all compaction cycles are equal weight. Recent cycles better reflect the current conversation style (user may start with quick questions then shift to deep research). We weight recent cycles more heavily.

```javascript
var _compactionCycleLengths = []; // turns per cycle: [8, 12, 9, ...]

function predictNextCycleLength() {
    var n = _compactionCycleLengths.length;
    if (n === 0) return null;  // no prediction possible
    if (n === 1) return _compactionCycleLengths[0]; // only one data point

    // Weighted average: most recent = 50%, previous = 30%, older = 20%
    // Generalizes to: each cycle gets weight proportional to recency
    var totalWeight = 0;
    var weightedSum = 0;

    for (var i = 0; i < n; i++) {
        // Weight increases with recency (last element = most recent)
        var recency = i + 1; // 1 for oldest, n for newest
        var weight;

        if (i === n - 1) {
            weight = 0.5; // most recent cycle: 50%
        } else if (i === n - 2) {
            weight = 0.3; // second most recent: 30%
        } else {
            // Distribute remaining 20% evenly across older cycles
            var olderCount = Math.max(n - 2, 1);
            weight = 0.2 / olderCount;
        }

        totalWeight += weight;
        weightedSum += _compactionCycleLengths[i] * weight;
    }

    return Math.round(weightedSum / totalWeight);
}
```

**Example convergence:**

```
Cycle 1:  8 turns → compact  (no prediction available)
Cycle 2: 12 turns → compact  (predicted ~8, actual 12)
  → weighted avg: 8×0.3 + 12×0.5 = 8.4  ≈ 10
Cycle 3:  9 turns → compact  (predicted ~10, close!)
  → weighted avg: 8×0.1 + 12×0.3 + 9×0.5 = 9.1  ≈ 9
Cycle 4: predicted ~9 turns — getting increasingly accurate
```

**For light-usage conversations (e.g., short Google-search-style questions):**

```
Cycle 1: 45 turns → compact
Cycle 2: 50 turns → compact
  → weighted avg: 45×0.3 + 50×0.5 = 38.5  ≈ 48
Cycle 3: predicted ~48 — very close for consistent usage patterns
```

### Dot Visualization Logic

10 dots represent the predicted cycle. Position within cycle determines fill and color:

```javascript
function renderTurnCounterDots(turnsSinceCompact, predictedCycleLength) {
    var dots = [];
    for (var i = 0; i < 10; i++) {
        var dotThreshold = (predictedCycleLength / 10) * (i + 1);
        if (turnsSinceCompact >= dotThreshold) {
            // Filled dot — color based on position
            var position = (i + 1) / 10;
            if (position <= 0.6)      dots.push('green');
            else if (position <= 0.8) dots.push('yellow');
            else                      dots.push('red');
        } else {
            dots.push('empty');
        }
    }
    return dots;
}
```

**Pre-calibration** (no prediction yet): all filled dots are neutral gray.

### Handling Prediction Misses

The prediction can be wrong — conversation style can shift mid-conversation. When the actual cycle exceeds the prediction (all dots red but no compaction):

- Keep all dots red
- Status text changes to: "Turn N (predicted ~M)"
- Do NOT show "overdue" — just acknowledge the prediction existed
- When compaction does fire, the new cycle length enters the weighted average and self-corrects

### State Management

```javascript
var _turnCounter = {
    totalTurns: 0,           // total turns this conversation
    turnsSinceCompact: 0,    // turns since last compaction
    compactionCount: 0,      // how many compactions detected
    cycleLengths: [],        // [8, 12, 9, ...] turns per cycle
    predictedCycleLength: null, // weighted avg prediction
    lastCompactTurn: 0       // turn number of last compaction
};
```

Reset when conversation changes (URL change detected via SPA navigation hooks).

### Display Format

```
Pre-calibration:
  13   Turns    ●●●●●●●●●●●●●○○○○○○○
  Turn 13

Post-calibration:
  13   Turns    ●●●●●●●○○○
  ~3 turns until compact  ⟲ 1 compaction

Deep in second cycle:
  20   Turns    ●●●●●●●●●○
  ~1 turn until compact  ⟲ 1 compaction
```

---

## Compaction Mechanics & Detection

### How Compaction Actually Works

When a conversation approaches ~95% of the context window limit (~190K tokens for Claude's 200K):

1. System triggers automatic summarization
2. Full conversation history is summarized into a compact block (~2K–10K tokens)
3. The summary **replaces** the full history — model only sees summary + recent messages going forward
4. Old messages **remain visible in the UI** (user can scroll up) but the model can no longer see them

### Key Finding: Compaction Floor Does NOT Rise

Each compaction produces a fresh summary of roughly similar token size. The summary-of-a-summary does not accumulate significantly. API cookbook data confirmed input tokens **stay bounded** after compaction — resetting to a similar low level each time rather than climbing.

```
Compaction 1: 190K → ~20K (summary ~5K + system prompt ~15K)
Compaction 2: 185K → ~22K (summary ~7K + system prompt ~15K)
Compaction 3: 188K → ~21K (summary ~6K + system prompt ~15K)
```

The floor stays roughly flat. This validates the use of cycle-length averaging for predictions.

### What DOES Degrade: Information Fidelity

While the token floor stays flat, **information quality degrades** with each compaction. Each summary loses specificity — variable names, exact error messages, nuanced decisions, coding conventions are compressed or dropped entirely. This is well-documented:

- "The more compaction cycles you go through, the vaguer everything becomes"
- Developers report Claude forgetting project conventions after compaction
- Skills/instructions followed perfectly before compaction are violated 100% after
- Some developers /quit and restart fresh rather than continue post-compaction

This degradation is the basis for our universal degradation warning system.

### Detection Methods

#### Claude (SSE path)

Detect a >50% drop in `input_tokens` between consecutive turns. This is definitive — the SSE data directly shows the token count plummeting.

```javascript
if (_prevInputTokens > 0 && newInputTokens < _prevInputTokens * 0.5) {
    // Compaction detected!
    recordCompaction(_currentTurn, _prevInputTokens, newInputTokens);
}
```

#### Non-Claude Platforms (DOM observation)

Best-effort detection via observable signals:

| Platform | Detection signal |
|----------|-----------------|
| **Claude** | "Compacting our conversation..." progress bar appears in DOM |
| **ChatGPT** | Old messages may disappear from DOM (FIFO truncation); message count drops |
| **Gemini** | Unknown — may need to monitor for UI indicators |
| **Grok** | Unknown — may need to monitor for UI indicators |
| **Perplexity** | Unknown |

Implementation: MutationObserver watching for:
- Compaction UI elements appearing (platform-specific selectors)
- Sudden reduction in message element count (for truncation-based platforms)
- Platform-specific "context limit" or "conversation too long" warnings

If detection fails, compaction simply isn't marked. The turn counter continues counting — it just misses a calibration opportunity.

---

## Universal: Degradation Warning System

This applies to **ALL platforms including Claude**. It doesn't require token counts — just a count of detected compaction events. The information degradation risk is universal.

### Threshold Levels

| Compactions | Indicator | Message |
|:-----------:|-----------|---------|
| 0 | None | — |
| 1 | Purple counter `⟲ 1` | No warning. Normal operation. Summary is still faithful. |
| 2 | Purple counter `⟲ 2` | No warning yet. Summary-of-summary. Some detail loss. |
| 3 | Counter + subtle warning | "Context compressed 3×. AI may miss earlier details. Consider a new chat." |
| 4 | Counter + moderate warning | "Context compressed 4×. Significant detail loss likely." |
| 5+ | Counter + strong warning | "Heavy compression. AI is likely missing significant earlier context." |

### Visual Treatment

The degradation warning appears below the context bar (Claude) or turn counter (non-Claude):

```
⟲ 3 compactions
⚠ AI may miss earlier details — consider a new chat
```

For Claude, this appears alongside the exact token data, giving users both pieces of information:

```
Context    22,540 / 200K
[██░░░░░░░░░░░░░░░░░░]
⟲ compacted at turn 42 · 186K → 22K
⚠ 3rd compression — AI may miss earlier details
```

### Why This Works Universally

- Doesn't require token counts — just compaction event detection
- Based on well-documented behavior (summary quality degrades with each cycle)
- Actionable — user can decide to start a new chat
- Non-alarmist at low counts, progressively more urgent
- Educates users about a real limitation they may not be aware of

---

## Context Window Limits Reference

```javascript
var CTX_LIMITS = {
    claude:     200000,   // Claude Opus 4.6, Sonnet 4.5
    chatgpt:    128000,   // GPT-4o (web app may cap at 32K for Plus users)
    grok:       131072,   // Grok 3 / Grok 4
    gemini:     1000000,  // Gemini 2.5 (1M), though web may use less
    perplexity: 127072    // Estimated
};
```

**Notes:**
- ChatGPT's web app context varies by subscription: 8K (free), 32K (Plus), 128K (Pro/Enterprise)
- Gemini's 1M context is the API limit; web app behavior may differ
- These affect Claude's SSE bar only. Turn counter doesn't use these values directly.

---

## Visual Design Specifications

### Claude: Exact Token Bar

```
┌────────────────────────────────────────┐
│ Context        142,847 / 200K          │  ← yellow text
│ [████████████████░░░░░░░░░░]           │  ← yellow gradient bar
│ ● exact                                │  ← green "exact" tag
└────────────────────────────────────────┘

After compaction:
┌────────────────────────────────────────┐
│ Context         22,540 / 200K          │  ← green text
│ [███░░░░░░░░░░░░░░░░|░░░░░░]          │  ← green bar + purple marker at 93%
│ ⟲ compacted at turn 26 · 186K → 22K   │  ← purple meta line
└────────────────────────────────────────┘
```

- Bar colors: green (<70%), yellow (70–84%), red (85%+)
- Font: monospace for numbers
- Compaction marker: purple vertical line on the bar at the position where compaction fired
- "● exact" label distinguishes from any estimation

### Non-Claude: Adaptive Turn Counter

```
Pre-calibration (no compaction data yet):
┌────────────────────────────────────────┐
│  7    Turns     ●●●●●●●○○○             │  ← neutral gray dots
│  Turn 7                                │  ← neutral status
└────────────────────────────────────────┘

Post-calibration (one compaction observed at turn 8):
┌────────────────────────────────────────┐
│  13   Turns     ●●●●●○○○○○             │  ← green/yellow dots
│  ~3 turns until compact   ⟲ 1         │  ← prediction + count
└────────────────────────────────────────┘

Approaching predicted compaction:
┌────────────────────────────────────────┐
│  15   Turns     ●●●●●●●●●○             │  ← green/yellow/red dots
│  ~1 turn until compact    ⟲ 1         │  ← red warning
└────────────────────────────────────────┘

With degradation warning:
┌────────────────────────────────────────┐
│  42   Turns     ●●●●●●○○○○             │  ← recalibrated dots
│  ~3 turns until compact   ⟲ 3         │
│  ⚠ AI may miss earlier details         │  ← degradation warning
└────────────────────────────────────────┘
```

- Dots: 10 total, always. Pre-calibration = neutral gray. Post-calibration = green/yellow/red
- Turn number: large monospace font, prominent
- Status line: monospace, smaller, includes prediction after calibration
- Compaction count: purple `⟲ N` badge

### Color Palette

```
Green:      #4ade80 (bar fill), #4ade8088 (status text)
Yellow:     #facc15 (bar fill), #facc1588 (status text)
Red:        #f87171 (bar fill), #f8717188 (status text)
Purple:     #a478f0 (compaction markers, badges, degradation dots)
Neutral:    #555555 (pre-calibration dots and text)
```

---

## Future Considerations

### SSE Interception for Other Platforms

If community members confirm that grok.com or gemini.google.com expose token counts in their SSE/WebSocket streams, we can add platform-specific interceptors:

```javascript
if (platform.id === 'claude') setupClaudeSSEInterceptor();
if (platform.id === 'grok')   setupGrokSSEInterceptor();   // future
if (platform.id === 'gemini') setupGeminiSSEInterceptor();  // future
```

Any platform that gains SSE interception automatically upgrades from Tier 2 (turn counter) to Tier 1 (exact token bar).

### Conversation Reset Detection

When the user starts a new conversation (URL change), all state should reset:
- `_sseTokenData` cleared
- `_turnCounter` reset
- `_compactionCount` reset to 0
- SPA navigation hooks (`pushState`, `popstate`) already detect URL changes — wire reset into those

### Extended Thinking Tokens

Claude's extended thinking generates additional tokens consumed but not visible. These are included in `input_tokens` on subsequent turns, so the SSE path automatically accounts for them. Worth noting in the UI that large token jumps between turns may be explained by thinking.

### Persisting Compaction Data

Currently, compaction cycle data resets when the page reloads. For better predictions across page refreshes, we could persist `_compactionCycleLengths` to `localStorage` keyed by conversation ID. This would give the adaptive turn counter a "warm start" on reload.

### Cross-Platform Compaction Detection Library

If compaction detection signals are discovered for more platforms, consider abstracting detection into a per-platform registry function:

```javascript
PLATFORMS.claude.detectCompaction = function () { /* SSE drop detection */ };
PLATFORMS.chatgpt.detectCompaction = function () { /* DOM message count drop */ };
PLATFORMS.gemini.detectCompaction = function () { /* MutationObserver for UI element */ };
```

---

*This document is maintained alongside the userscript. When platform SSE formats change, compaction mechanics evolve, or new platforms become interceptable, update the relevant sections.*
