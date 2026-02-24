# Fix: SSE Hybrid Context Tracking for Claude

**Branch:** `fix/v10-live-testing-polish`  
**Version:** v10.9  
**Parent:** v10.8 (SSE interceptor plumbing was fixed but hit dead end on `input_tokens`)  
**Priority:** High — core feature improvement  
**Scope:** `ai-conversation-navigator.user.js` only

---

## What v10.8 already did (DO NOT RE-IMPLEMENT)

Claude Code already implemented and documented these in v10.8:
- ~~Change 1: `unsafeWindow` for SSE interceptor~~
- ~~Change 2: Non-Claude estimated bar removal → turn dots only~~
- ~~Change 3: GM storage caching (keyed by conversation ID)~~
- ~~Change 4: Arc hitzone geometry (mode-aware width)~~
- ~~Change 5: Turn counter reset on SPA navigation~~

These are committed and documented in CHANGELOG.md, TROUBLESHOOTING.md, DECISIONS.md.

---

## What v10.8 got WRONG (must fix in v10.9)

After v10.8 was committed, live testing revealed the SSE interceptor still didn't work.
Three additional bugs were found through systematic layer-by-layer debugging:

### Bug A: Cross-realm Uint8Array (NOT in v10.8)

The `unsafeWindow` fix got the fetch proxy onto the real window, but `readSSEStream()`
still failed silently. The cloned response stream returns page-realm `Uint8Array` chunks.
Tampermonkey's sandbox `TextDecoder.decode()` silently returns empty strings when given
cross-realm typed arrays.

**Fix:** Copy bytes into sandbox realm before decoding.

In `readSSEStream()`, replace:
```javascript
buffer += decoder.decode(result.value, { stream: true });
```
With:
```javascript
// Cross-realm fix: page-realm Uint8Array must be copied into sandbox realm
var copied = new Uint8Array(result.value);
buffer += decoder.decode(copied, { stream: true });
```

### Bug B: Line ending mismatch (NOT in v10.8)

After the Uint8Array fix, buffer accumulated text but never split into events.
Claude's SSE uses `\r\n` line endings, not `\n`.

**Fix 1 — event boundary split:** In `readSSEStream()`, replace:
```javascript
var parts = buffer.split(/\n\n/);
```
With:
```javascript
var parts = buffer.split(/\r?\n\r?\n/);
```

**Fix 2 — line parsing in parseSSEEvent:** Replace:
```javascript
var lines = eventStr.split('\n');
```
With:
```javascript
var lines = eventStr.split(/\r?\n/);
```

### Bug C: Dead end — Claude web SSE has no token usage data

With all plumbing fixed, `message_start` events parsed successfully. But the payload
contains NO `usage` field:

```json
{
  "type": "message_start",
  "message": {
    "id": "chatcompl_...", "type": "message", "role": "assistant",
    "model": "", "content": [], "stop_reason": null,
    "trace_id": "...", "request_id": "..."
  }
}
```

No `input_tokens`, no `output_tokens`. `message_delta` and `message_stop` also lack
usage data. The Claude web UI strips this field — it only exists in API responses.

**What SSE DOES provide:**
- `content_block_delta` with `type: "text_delta"` — exact output text characters
- `content_block_delta` with `type: "thinking_delta"` — exact extended thinking characters
- `message_start` / `message_delta` / `message_stop` — message lifecycle boundaries

---

## Troubleshooting Log (10-step diagnosis)

Each step built on the previous — you can't diagnose layer N+1 until layer N is fixed.

| Step | What we checked | Result | What it told us |
|------|----------------|--------|-----------------|
| 1 | Console manual fetch proxy (bypassing TM) | ✅ SSE intercepted | SSE endpoint exists, data flows |
| 2 | `window._acnFetchPatched` after v10.8 | ❌ `undefined` | Patch on wrong window |
| 3 | After `unsafeWindow` fix: `_acnFetchPatched` | ✅ `true` | Fetch proxy on real window |
| 4 | `console.log` in `readSSEStream()` | ✅ Magenta log | Stream being tapped |
| 5 | `console.log` in `pump()` | ✅ Orange "chunk received" | Chunks flowing |
| 6 | `console.log` in `parseSSEEvent()` | ❌ Never appeared | Break between pump and parse |
| 7 | Log chunk type | `[object Uint8Array]` length > 0 | Real data in chunks |
| 8 | Log buffer length after decode | Buffer stayed 0 | TextDecoder empty → Uint8Array fix |
| 9 | After Uint8Array fix: buffer length | Grew (8006→9170) never shrank | Events not splitting → `\r\n` fix |
| 10 | After `\r\n` fix: `parseSSEEvent` fires | ✅ All event types | `message_start` has no `usage` → dead end |

**Key principle:** Each layer was invisible until the layer above it was fixed.

---

## v10.9 Scope: Four Changes

1. **SSE plumbing fixes** (Bugs A + B above)
2. **Hybrid context bar** — DOM text + SSE cumulative thinking (never resets)
3. **Claude gets turn dots + compaction indicators** (same as non-Claude already has)
4. **Remove debug console.logs**

---

## Design Philosophy: What the Bar Means

### The bar answers "how close am I to trouble?"

The bar is NOT meant to show "what's currently in the model's context window." We
can't know that without `input_tokens`. Instead, the bar answers: **"How worried
should I be about model performance degradation?"**

For this purpose, the bar should **only go up, never reset.** A conversation that has
had 3 compactions and 80 messages IS in trouble, even if the model's internal context
just compacted to 20%. The compaction itself is a sign of degradation.

### Why NOT use epoch-based resets

An earlier design proposed tracking output/thinking in "epochs" between compactions,
resetting counters when compaction occurs. This was rejected because:

- After compaction, bar drops to ~20-30%. User sees "lots of room!" but the
  conversation is actually degrading — misleading in the opposite direction.
- Compaction detection also relies on fragile DOM selectors that may change.
- Contradicts the existing user experience where the bar climbs steadily.
- A user seeing the bar go 80% → 20% → 75% → 20% would be confused, while the
  compaction counter separately shows "compacted 3 times."

### Two complementary signals

1. **Context bar** (percentage) — cumulative, only goes up. "How much total
   conversation has occurred." Warns you're approaching trouble.
2. **Turn dots + compaction count** — already built for non-Claude. Shows message
   count, compaction events, and predicted turns until next compaction. Tells you
   "trouble is happening."

Claude is the only platform that shows BOTH, since it's the only one where SSE
data makes the bar more meaningful.

---

## Change 1: SSE Plumbing Fixes

Apply Bug A (Uint8Array copy) and Bug B (`\r\n` regex) as described above.

These are mandatory regardless of the hybrid approach — they fix real bugs in the
SSE pipeline that would affect any future SSE-based features.

---

## Change 2: Hybrid Context Bar (detailed spec)

### What changes from current `(est.)`

The current DOM estimation does:
```
total = DOM_all_visible_text / 4
```

The hybrid approach adds the ONE thing DOM truly cannot see — extended thinking:
```
total = DOM_all_visible_text / 4 + system_overhead + cumulative_SSE_thinking / 4
```

**No epochs. No resets. Only goes up.** This is the same behavior as the current
`(est.)` bar but with thinking tokens added.

### Why this matters

In a typical extended thinking conversation:
- Current `(est.)`: 45K tokens (DOM text only)
- Hybrid: 45K + 25K thinking = 70K tokens
- Reality: probably 80K+ (system prompts, tool calls, etc.)

The hybrid gets much closer to reality. For conversations without extended thinking,
it behaves identically to the current method plus system overhead.

### Why cumulative SSE thinking and not cumulative SSE output too?

AI response output text IS visible in the DOM. If we add SSE output on top of DOM
text, we'd be double-counting AI responses. But thinking text is NOT visible in the
DOM (it's hidden behind a collapsed "thinking" toggle). So only thinking needs to
come from SSE.

### Step 2A: Add SSE thinking accumulator state

Add to existing `_sseTokenData` initialization (or replace if v10.8's fields
are already there):

```javascript
var _sseTokenData = {
    inputTokens:          0,  // legacy, not used in hybrid
    outputTokens:         0,  // legacy, not used in hybrid
    lastUpdated:          0,
    exact:                false,  // true = SSE thinking data available
    cached:               false,  // true = loaded from GM cache
    // ── Hybrid SSE tracking (v10.9) ──────────────────────
    cumulativeThinkingChars: 0,   // total thinking chars across ALL messages (never resets)
    sseMessageCount:         0    // assistant messages observed via SSE
};

// Per-message accumulator (reset on each message_start)
var _currentMsgThinkingChars = 0;
```

Note: We do NOT track output chars separately. DOM already captures visible output.
We ONLY track thinking chars because those are invisible in the DOM.

### Step 2B: Rewrite `parseSSEEvent()` for thinking accumulation

Replace the entire event handling logic:

```javascript
function parseSSEEvent(eventStr) {
    var lines = eventStr.split(/\r?\n/);
    var eventType = '';
    var dataStr   = '';

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('event:') === 0) {
            eventType = line.slice(6).trim();
        } else if (line.indexOf('data:') === 0) {
            dataStr = line.slice(5).trim();
        }
    }

    if (!dataStr || dataStr === '[DONE]') return;

    var payload;
    try {
        payload = JSON.parse(dataStr);
    } catch (e) {
        return;
    }

    // ── message_start: reset per-message accumulator ───────────
    if (eventType === 'message_start') {
        _currentMsgThinkingChars = 0;
        _sseTokenData.sseMessageCount++;
    }

    // ── content_block_delta: accumulate thinking chars ──────────
    if (eventType === 'content_block_delta' && payload.delta) {
        if (payload.delta.type === 'thinking_delta' && payload.delta.thinking) {
            _currentMsgThinkingChars += payload.delta.thinking.length;
        }
    }

    // ── message_delta: finalize message, add to cumulative total ─
    if (eventType === 'message_delta') {
        _sseTokenData.cumulativeThinkingChars += _currentMsgThinkingChars;
        _sseTokenData.lastUpdated              = Date.now();
        _sseTokenData.exact                    = true;
        _sseTokenData.cached                   = false;

        _cacheSSEData();
        orbUpdateContextBar();
    }

    // ── message_stop: final UI refresh ─────────────────────────
    if (eventType === 'message_stop') {
        orbUpdateContextBar();
    }
}
```

### Step 2C: Update `orbUpdateContextBar()` Path A for hybrid display

Replace the existing Path A (Claude + SSE data):

```javascript
// ── Path A: Claude with hybrid SSE data ───────────────
if (platform && platform.id === 'claude' &&
    (_sseTokenData.exact || _sseTokenData.cached)) {

    // ── DOM: all visible text (user messages + AI responses) ────
    var domChars = 0;
    _questions.forEach(function (q) {
        if (q.element) domChars += (q.element.innerText || '').length;
    });
    // Count AI response text visible in DOM
    var responseEls = document.querySelectorAll(
        platform.responseSelector || '[data-is-streaming]'
    );
    if (responseEls && responseEls.length) {
        responseEls.forEach(function (el) {
            domChars += (el.innerText || '').length;
        });
    }
    var domTokens = Math.round(domChars / 4);

    // ── SSE: cumulative thinking tokens (invisible in DOM) ──────
    var thinkingTokens = Math.round(_sseTokenData.cumulativeThinkingChars / 4);

    // ── System prompt overhead (~15K for Claude with tools) ─────
    var systemOverhead = 15000;

    // ── Total ───────────────────────────────────────────────────
    var totalTok = domTokens + thinkingTokens + systemOverhead;
    var limit    = getContextLimit();
    var pctNum   = Math.min(100, Math.round((totalTok / limit) * 100));
    var color    = getBarColor(pctNum);

    var tokFmt = totalTok.toLocaleString();
    var limFmt = Math.round(limit / 1000) + 'K';

    pct.textContent       = pctNum + '%';
    pct.style.color       = color;
    fill.style.width      = pctNum + '%';
    fill.style.background = color;

    if (meta) {
        var label = _sseTokenData.cached ? '(last known)' : '(hybrid)';
        meta.textContent = '~' + tokFmt + ' / ' + limFmt + ' tokens ' + label;
        meta.style.color = _sseTokenData.cached ? '#666' : '#888';
    }

    // ── Also render turn dots + compaction info below the bar ───
    _renderTurnDots();
    _renderCompactionInfo(pctNum);
    return;
}
```

**Label states:**
- `~XX,XXX / 200K tokens (hybrid)` — live SSE thinking data + DOM text
- `~XX,XXX / 200K tokens (last known)` — cached from previous session
- `~XX,XXX / 200K tokens (est.)` — fallback Path B if SSE never activated

The `~` prefix signals "approximately" — honest about the estimated components.

### Step 2D: Update GM caching for hybrid fields

Update `_cacheSSEData()` to persist thinking accumulator:

```javascript
function _cacheSSEData() {
    var convId = _getConvId();
    if (!convId || !_sseTokenData.exact) return;
    try {
        var cache = GM_getValue('acn_ctx_cache', {});
        cache[convId] = {
            cumulativeThinkingChars: _sseTokenData.cumulativeThinkingChars,
            sseMessageCount:         _sseTokenData.sseMessageCount,
            timestamp:               Date.now()
        };

        // Prune to 50 most recent conversations
        var keys = Object.keys(cache);
        if (keys.length > 50) {
            keys.sort(function (a, b) {
                return (cache[b].timestamp || 0) - (cache[a].timestamp || 0);
            });
            var pruned = {};
            for (var i = 0; i < 50; i++) pruned[keys[i]] = cache[keys[i]];
            cache = pruned;
        }

        GM_setValue('acn_ctx_cache', cache);
    } catch (e) {}
}
```

Update `_loadCachedSSEData()` to restore thinking accumulator:

```javascript
function _loadCachedSSEData() {
    var convId = _getConvId();
    if (!convId) return;
    try {
        var cache = GM_getValue('acn_ctx_cache', {});
        var entry = cache[convId];
        if (entry && entry.cumulativeThinkingChars) {
            _sseTokenData.cumulativeThinkingChars = entry.cumulativeThinkingChars;
            _sseTokenData.sseMessageCount         = entry.sseMessageCount || 0;
            _sseTokenData.lastUpdated             = entry.timestamp;
            _sseTokenData.exact                   = false;
            _sseTokenData.cached                  = true;
        }
    } catch (e) {}
}
```

### Step 2E: Update `resetTurnCounter()` for hybrid fields

Add hybrid SSE fields to the reset function (for SPA navigation):

```javascript
function resetTurnCounter() {
    _turnCounter.totalTurns          = 0;
    _turnCounter.turnsSinceCompact   = 0;
    _turnCounter.compactionCount     = 0;
    _turnCounter.cycleLengths        = [];
    _turnCounter.predictedCycleLength = null;
    _turnCounter.lastCompactTurn     = 0;

    // Reset hybrid SSE tracking
    _sseTokenData.cumulativeThinkingChars = 0;
    _sseTokenData.sseMessageCount         = 0;
    _sseTokenData.lastUpdated             = 0;
    _sseTokenData.exact                   = false;
    _sseTokenData.cached                  = false;
    _currentMsgThinkingChars              = 0;
    _prevInputTokens                      = 0;
    _compactionCount                      = 0;
    _compactionHistory                    = [];
}
```

**Note:** `resetTurnCounter()` is called on SPA navigation (switching conversations),
NOT on compaction. The cumulative thinking counter resets only when switching to a
different conversation. Within the same conversation, it never resets.

---

## Change 3: Claude Gets Turn Dots + Compaction Indicators

Claude currently shows only the context percentage bar. Non-Claude platforms show
turn dots + compaction count (from v10.8 Change 2). Claude should show BOTH.

### What to add

In `orbUpdateContextBar()` Path A, the spec above already includes:
```javascript
_renderTurnDots();
_renderCompactionInfo(pctNum);
```

Make sure these render BELOW the percentage bar in the panel layout. The visual
hierarchy should be:

```
CONTEXT WINDOW                    44%
████████████░░░░░░░░░░░░░░░░░░░░
~52,340 / 200K tokens (hybrid)

●●●●●●●●●●●●●●●●●●●● 20 turns
Compacted 2x · ~8 turns to next
```

### Turn dots for Claude

The existing `_renderTurnDots()` and `_renderTurnCompactionInfo()` functions should
work as-is for Claude. They read from `_turnCounter` which is already being updated
by `updateTurnCounter()` on all platforms.

Verify that `updateTurnCounter()` is being called for Claude (it should be — it's
in the MutationObserver callback that fires when new messages are detected).

If turn dots are not appearing, check that the DOM elements for turn dots exist in
the Claude panel layout. They may need to be added to `orbBuildPanelNav()` for the
Claude case — currently they might only be created for the non-Claude path.

---

## Change 4: Remove Debug Console Logs

Remove ALL `console.log` lines containing `[ACN-SSE]`. These were added during
the v10.8→v10.9 debugging session. Search for:
- `console.log('%c[ACN-SSE]`

Remove every instance. Also remove any `[ACN-TEST]` or `[DEBUG]` logs if present.
There should be zero debug logging in the final version.

---

## Testing Checklist

### SSE plumbing (Change 1)
- [ ] `window._acnFetchPatched` returns `true` in console
- [ ] No `[ACN-SSE]` debug lines in console
- [ ] No errors related to ACN in console after sending a message

### Hybrid bar (Change 2)
- [ ] Short conversation, no thinking: bar shows similar to old `(est.)` plus ~15K overhead
- [ ] Extended thinking conversation: bar shows noticeably higher than old `(est.)`
- [ ] Send 5+ messages with thinking: bar climbs with each message
- [ ] Label shows `(hybrid)` during active session
- [ ] Reload page: label shows `(last known)`, count preserved
- [ ] Send message after reload: label updates to `(hybrid)`
- [ ] Navigate to different conversation: counter resets, loads cached data if available
- [ ] 80+ message conversation: bar shows 90-100% (same ballpark as old method)

### Turn dots + compaction on Claude (Change 3)
- [ ] Turn dots appear below the percentage bar
- [ ] Dot count matches question count in sidebar
- [ ] After compaction: compaction count badge visible, dot cycle resets

### Debug cleanup (Change 4)
- [ ] Zero `[ACN-SSE]` strings in entire codebase

---

## Decision log entries (for DECISIONS.md)

### DEC-016: Cumulative hybrid over epoch-based resets

**Context:** Claude web SSE lacks `input_tokens`. Need to decide how to handle
context bar after compaction.

**Decision:** Bar is cumulative (never resets within a conversation). SSE contributes
only thinking chars (invisible to DOM). Bar serves as "how close to trouble" indicator.

**Alternatives rejected:**
- **Epoch-based resets:** Bar drops to ~20% after compaction, giving false confidence
  that lots of room remains. User sees 80%→20%→75%→20% which is confusing.
  Compaction detection also relies on fragile DOM selectors.
- **Pure DOM (no SSE):** Misses extended thinking entirely. Can undercount by 50K+
  tokens in research conversations. The one thing we can improve, we should.
- **Full output + thinking from SSE:** Double-counts AI response text (already in DOM
  AND in SSE output). Only thinking is invisible in DOM.

**Tradeoffs:**
- Input estimation still approximate (~±20%)
- System prompt overhead is a constant (15K) that may vary
- After many compactions, bar stays near 100% — this is intentional, not a bug
- Label honestly says `(hybrid)` with `~` prefix

### DEC-017: Claude shows both bar AND turn/compaction indicators

**Context:** Non-Claude platforms show only turn dots + compaction count (no bar).
Claude has SSE data that makes the bar more meaningful.

**Decision:** Claude shows percentage bar (hybrid) AND turn dots + compaction count.
Two complementary signals: bar = "how much has happened", compaction = "degradation
is occurring."

**Alternatives rejected:**
- **Bar only (current):** No compaction visibility. User has no way to know quality
  is degrading.
- **Turn dots only (like non-Claude):** Wastes the SSE data that only Claude provides.
  Bar is useful pre-compaction.
- **Replace bar with compaction-only warnings:** Loses the gradual "filling up"
  signal that helps users plan ahead.

---

## Version bump

- `@name` → `AI Conversation Navigator v10.9`
- `@version` → `10.9`

---

## Changelog entry (reasoning-flow format)

```markdown
## [10.9 — Hybrid SSE Context Tracking + Turn Dots for Claude] — 2026-02-2X

**Branch:** `fix/v10-live-testing-polish`

Four changes: SSE plumbing fixes discovered after v10.8, hybrid context bar using
SSE thinking data + DOM text, turn dots + compaction indicators added for Claude,
and debug log cleanup.

---

### SSE Plumbing: Two More Bugs Found After v10.8

v10.8's `unsafeWindow` fix got the fetch proxy onto the real page window, but two
more failures were discovered through systematic 10-step debugging:

**Cross-realm Uint8Array:** Cloned response stream returns page-realm typed arrays.
Sandbox's TextDecoder silently returns empty strings. Fix: copy bytes into sandbox
realm with `new Uint8Array(result.value)` before decoding.

**Line ending mismatch:** Claude SSE uses `\r\n` not `\n`. Split regex `/\n\n/`
never found event boundaries. Fix: `/\r?\n\r?\n/` for splits, `/\r?\n/` for lines.

### Dead End: Claude Web SSE Has No Token Usage

With plumbing fully fixed, `message_start` events parsed but contained NO `usage`
field — no `input_tokens`, no `output_tokens`. Claude's web UI strips this from
the SSE stream. Only available via API.

### Pivot: Cumulative Hybrid Approach

The SSE stream provides `thinking_delta` events with exact extended thinking text —
the ONE thing DOM cannot see (collapsed behind a toggle, invisible to `innerText`).

Formula: `total = DOM_visible_text/4 + system_overhead(15K) + cumulative_SSE_thinking/4`

Bar is cumulative and never resets — serves as "how close to trouble" indicator.
Extended thinking can be 5-50K tokens per response, so adding it dramatically
improves accuracy for research and coding conversations.

Earlier design using epoch-based resets (resetting counters on compaction) was
rejected: bar dropping from 80% to 20% after compaction gives false confidence
while the conversation is actually degrading. (DEC-016)

### Claude Now Shows Both Bar AND Turn/Compaction Indicators

Claude is the only platform that shows both the percentage bar (hybrid) and the
turn dots + compaction count system (already built for non-Claude in v10.8).
Two complementary signals: bar = cumulative usage, compaction count = degradation
warning. (DEC-017)

### Debug Console Log Cleanup

Removed all `[ACN-SSE]` diagnostic logging from the v10.8→v10.9 debugging session.
```

---

## Files modified

- `ai-conversation-navigator.user.js` — all changes in this single file

---

## IMPORTANT: Documentation Task (do AFTER code changes)

After implementing all four code changes above, update the following documentation
files. **This is not optional.** The documentation must capture the FULL story of
what happened during the v10.8→v10.9 debugging session, not just the code changes
you made in v10.9. The user and a collaborator spent significant time doing live
debugging that uncovered critical findings. All of that must be recorded.

### What to document in each file:

#### CHANGELOG.md

Add a v10.9 entry using the changelog template in this spec. The entry must include:
- The full SSE investigation story: v10.8 shipped with `unsafeWindow` fix but SSE
  still didn't work. Three MORE layers of bugs were found through live debugging.
- **All 10 troubleshooting steps** (see the troubleshooting log table in this spec).
  Document the systematic layer-by-layer diagnosis: what was checked, what the result
  was, and what it told us. This is engineering knowledge that must be preserved.
- The dead end discovery: Claude web SSE does NOT include `input_tokens` or
  `output_tokens` in the `message_start` payload. The web UI strips the `usage`
  field. This was confirmed by logging the full payload after fixing all plumbing.
  Include the actual JSON payload structure that was observed.
- The pivot decision: why we chose cumulative hybrid (DOM + thinking) over
  epoch-based resets, and why the bar should only go up.
- The actual v10.9 code changes (plumbing fixes, hybrid bar, turn dots for Claude,
  debug cleanup).

#### TROUBLESHOOTING.md

Add a v10.9 section (or append to the v10.8 section) that documents:
- All three bugs found AFTER v10.8: cross-realm Uint8Array, `\r\n` line endings,
  and the missing `usage` field.
- The 10-step debugging methodology with results at each step.
- The key insight: "each layer was invisible until the layer above it was fixed" —
  you can't diagnose TextDecoder issues if fetch isn't intercepting, can't diagnose
  line endings if TextDecoder isn't decoding.
- The dead end conclusion with the actual `message_start` payload JSON showing
  no `usage` field.
- What SSE DOES provide (thinking_delta, text_delta, message lifecycle events)
  and what it does NOT (input_tokens, output_tokens).

#### DECISIONS.md

Add two new decision entries:
- **DEC-016: Cumulative hybrid over epoch-based resets** — full rationale as
  specified in this doc. Include the rejected epoch-based approach and WHY it
  was rejected (bar dropping to 20% after compaction gives false confidence,
  contradicts the bar's purpose as a "trouble indicator").
- **DEC-017: Claude shows both bar AND turn/compaction indicators** — why Claude
  is unique in showing both, and why non-Claude platforms keep turn dots only.

#### ROADMAP.md

Update current status from v10.8 to v10.9. Note the hybrid approach and that
exact SSE token tracking was investigated but hit a dead end due to Claude's
web UI stripping usage data from the SSE stream.

### What NOT to do:

- Do NOT just document the code changes you made. The investigation findings are
  equally important.
- Do NOT summarize the troubleshooting into one paragraph. Each step matters.
- Do NOT skip the dead end finding. Future developers need to know that trying
  to get `input_tokens` from Claude's web SSE is a dead end so they don't waste
  time re-investigating.
- Do NOT use `/compact` or any summarization that would lose the debugging details.
  Read this spec in full and transfer the knowledge into the documentation files.
