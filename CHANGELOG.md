# Changelog

All notable changes to this project will be documented in this file. Each entry documents not just what changed, but *why* — the problem, the technical root cause, the approach we chose, and how it resolved the issue.

---

## [10.15 — Proportional Map Alignment, Hover Highlighting, and Sub-Segmentation Refinement] — 2026-03-10

**Branch:** `feature/map-alignment-hover-v10.15`

Six improvements to the conversation map: better visual alignment between the left bracket column and right snapshot column, hover-based highlighting, content-driven sub-segmentation tuning, removal of redundant topic pills, and two code-quality refactors.

**Files modified:** `ai-conversation-navigator.user.js`, `CHANGELOG.md`, `ROADMAP.md`, `README.md`, `TROUBLESHOOTING.md`.

### Fix 1 — Proportional Map Alignment (Flex-grow, Not marginTop)

**Problem:** Left sub-segments clustered at the top of their parent block with large empty space below, while the right snapshot bars filled their zone independently. The marginTop-based spacing hack used approximate constants (`SUB_ITEM_H=35`, `LABEL_H=34`) that drifted with real layout.

**Root cause:** `updateSnapshot` used `data-acn-sub-offset` (cumulative line offsets) to compute `marginTop` per sub-segment, positioning them against a derived target position. Because the computation was based on estimated heights rather than live layout, the sub-segments never aligned precisely with their corresponding snapshot messages.

**Fix:** Replaced marginTop-based spacing with CSS `flex-grow` on both sides:
- Each `.acn-seg-d2-sub` gets `style.flexGrow = childLineCount` set at render time (computed from the messages in that child sub-segment).
- Each `.acn-snap-msg` gets `style.flexGrow = msgLines` set at render time.
- `.acn-map-expanded .acn-seg-d2-children { flex:1 }` (added CSS class, toggled by `updateSnapshot`) makes the sub-segment container fill the available vertical space below the parent label and meta.
- `updateSnapshot` uses `getBoundingClientRect` to measure the exact offset from the row top to the `childrenWrap` start, then sets matching `padding-top` on the snapshot zone so both columns start at the same visual point.
- Removed: `data-acn-seg-lines`, `data-acn-sub-offset`, `SUB_ITEM_H`, `LABEL_H`, `childLineOffsets` — all replaced by the flex-grow approach.

### Fix 2 — Hover Highlighting

**Problem:** No visual connection between a sub-segment label on the left and its corresponding messages on the right snapshot. Users had to infer the relationship by proximity.

**Fix:** Added `mouseenter`/`mouseleave` handlers linking bracket items to their snapshot messages:
- **Sub-segment hover:** Adds `acn-snap-highlight` (subtle orange glow via `rgba(255,165,0,0.18)`) to the snapshot message bars that belong to that sub-segment's message range.
- **Parent segment hover (no sub-segments):** Highlights all snapshot messages in that segment's zone.
- Cross-references are built at render time (snapshot zone is now built before sub-segments so the `snapMsgEls[]` array is available when children are constructed). No DOM queries are needed on hover — all lookups use pre-stored arrays.
- New helper `_sumAttachHighlight(el, msgEls)` encapsulates the add/remove listener pair, eliminating the duplicated loop pattern.

### Fix 3 — Content-Driven Sub-Segmentation

**Problem:** The sub-segmentation algorithm with threshold 0.27 and a minimum of 8 messages produced 20+ sub-segments for long conversational segments, turning the map into a list. The user's intent was a visual overview, not an item-by-item breakdown.

**Fix:** Raised overlap threshold from 0.27 → 0.42 (only split when vocabulary diverges meaningfully). Raised minimum segment size from 8 → 12 messages. Added a post-merge pass that absorbs any fragment smaller than 3 messages into its neighbor (prefers next, falls back to prev), re-computes the merged label from combined vocabulary. This eliminates "orphan" fragments that form when a single off-topic exchange slips through the threshold.

### Fix 4 — Segment Merge Cap Lowered

**Problem:** `_sumMergeExcessSegments` capped at 10 segments, producing map that felt like a list rather than a summarized overview.

**Fix:** Lowered the merge cap from 10 → 5. The conversation map now produces 3–5 top-level blocks maximum, making it a true visual summary of topic transitions.

### Fix 5 — Topic Pills Removed

**Problem:** Topic pills on leaf segments duplicated the segment label text. They added visual noise without new information.

**Fix:** Removed `.acn-seg-d2-pills` and `.acn-seg-d2-pill` CSS classes and their render code. Labels alone are sufficient to identify segment topics.

### Fix 6 — Code Quality Refactors

**_sumMsgLines helper:** The line-count formula `Math.min(15, Math.max(1, Math.ceil((text||'').length / 80)))` appeared three times in `_sumRenderConversationMap`. Extracted to `_sumMsgLines(text)` defined alongside the other `_sum*` utilities.

**ResizeObserver cleanup interval:** The polling interval for detecting panel removal was 2000ms, leaving a zombie ResizeObserver for up to 2 seconds after the panel is destroyed. Reduced to 500ms for faster cleanup.

---

## [10.13 — Post-Review Polish: Map Overflow, Section Order, Drag Performance] — 2026-03-10

**Branch:** `release/v10.12`

Six targeted fixes applied after code review of the v10.11 feature branch. No new features — all changes tighten correctness, performance, and naming hygiene.

**Files modified:** `ai-conversation-navigator.user.js`, `CHANGELOG.md`.

### Fix 1 — Map Segment Overflow / Overlap

**Problem:** The D2 bracket map rendered correctly in short conversations but broke visually in longer ones — segments overlapped each other, and child brackets / topic pills spilled into adjacent segments.

**Root cause:** `_sumRenderConversationMap` set a fixed `height` on the map container (`Math.max(300, Math.min(700, totalLines * 2.2)) + 'px'`) and then used CSS `flex-grow` on each segment row to divide that fixed space proportionally. When a segment contained children or many topic pills, the content exceeded its allocated flex slice and overflowed into the next segment's space. `overflow: hidden` on the container only masked the symptom — content was clipped at the container edge rather than pushing the container taller.

**Fix:** Removed the fixed `container.style.height` assignment entirely. Removed `flexGrow`, `flexBasis`, and `minHeight: 0` from segment rows. Replaced with `segEl.style.minHeight = Math.max(36, Math.floor((seg._lineCount / totalLines) * 600)) + 'px'` — each segment declares a proportional *minimum* height but can grow freely to accommodate children. The map container stretches to the natural height of all segments combined; the panel scrolls. Also removed `overflow: hidden` from `.acn-map-container` CSS.

**Snapshot sync:** With no fixed container height, the snapshot column automatically stretches to match the bracket column via `align-items: stretch` on the flex parent. Snapshot zones use `flex-grow` (not `min-height`) to divide the matched height proportionally — horizontal alignment is preserved without a fixed coordinate system.

### Fix 2 — Summary Section Order

**Problem:** The conversation map appeared after key points in the rendered panel. Users saw a wall of bullet-point key points before reaching the visual map, burying the highest-value section.

**Root cause:** `renderSummaryResults()` appended sections in original insertion order: Stats → Topics → Key Points → Conversation Map → Code & Files.

**Fix:** Reordered to Stats → Topics → Conversation Map → Key Points → Code & Files. The visual map now appears immediately after topics, giving users the conversation shape before the detail list.

### Fix 3 — Drag Performance

**Problem:** Dragging the orbital button zone vertically was noticeably laggy at fast mouse speeds.

**Root cause:** `_orbDragMove()` called `orbRender()` on every `mousemove` event. `orbRender()` reads multiple DOM measurements, updates all dot positions, and recalculates hitzone geometry — forcing a synchronous layout reflow on every frame.

**Fix:** During drag, `_orbDragMove()` now applies `zone.style.transform = 'translateY(' + offsetPx + 'px)'` only — a GPU-composited property that moves the element without triggering layout. `orbRender()` fires once in `_orbDragEnd()` after mouseup to finalize positions and clear the transform.

### Fix 4 — Userscript Name Permanently Cleaned Up

**Problem:** `// @name` contained `AI Conversation Navigator v10.9` (frozen since v10.9 despite two version bumps). v10.11 aligned it with the version, but the version number in the name causes a new problem: Tampermonkey matches installed scripts by name. A name change on each update registers it as a new script, leaving the old one installed in parallel.

**Fix:** `// @name` permanently set to `AI Conversation Navigator` with no version suffix. Version is tracked only via `// @version` and `ACN_VERSION`. Tampermonkey uses `// @version` for update detection and display — the name field is purely for user identification.

### Fix 5 — Pivot Phrase Over-Triggering

**Problem:** The bare word `pivot` in `PIVOT_PHRASES` caused false segment breaks in technical conversations containing "pivot table", "pivot point", "pivot column", etc.

**Fix:** Removed bare `pivot`. Added explicit transition forms `let's pivot` and `pivot to` instead. Also tightened `unrelated` → `unrelated question` and `something else` → `something else entirely` to avoid matching mid-sentence uses of these words.

### Fix 6 — Snapshot DOM Blowup Prevention

**Problem:** In conversations with large code blocks or pasted logs, individual messages could have thousands of characters. The snapshot column rendered one `.acn-snap-line` node per ~80 characters with no upper bound, creating hundreds of DOM nodes per message and causing visible rendering lag.

**Fix:** Added `Math.min(15, ...)` cap in two locations: (1) the `_lineCount` accumulator used for `flex-grow` sizing, preventing any single message from dominating vertical space; (2) the snapshot DOM loop that creates `.acn-snap-line` elements, capping each message at 15 line nodes.

---

## [10.11 — Summary Segmentation Engine + D2 Bracket Map] — 2026-03-10

**Branch:** `feature/summary-segmentation-map-v10.11`

Two tightly coupled improvements to the Summary panel.

**Files modified:** `ai-conversation-navigator.user.js`, `CHANGELOG.md`.

### Task 1 — Segmentation Engine Rewrite

**Problem:** v10.10's content-aware segmentation was missing explicit pivot detection, sub-segment data for nested brackets, a scaled key-point cap, and the merge limit was 12 instead of the intended 10.

**Pivot detection:** Added `PIVOT_PHRASES` regex and `_sumIsPivotMessage()`. User messages containing phrases like "by the way", "switch gears", "new topic", etc. force a segment break regardless of word-overlap score, since these are semantic pivots no overlap metric will catch.

**Sub-segment generation:** Added `_sumBuildSubSegments(messages)`. For segments with 8+ messages, runs a secondary segmentation pass with a higher threshold (0.27 vs. 0.15) and 4-message context window. Produces an array of `children` attached to each parent segment. Only returned if 2+ sub-segments are found (a single result is not a meaningful split). These children are the data source for the nested brackets in Task 2.

**Dynamic key-point cap:** Changed `.slice(0, 10)` to `Math.max(1, Math.min(10, Math.floor(totalMessages / 4)))`. A 12-message conversation gets at most 3 key points; a 40-message conversation gets up to 10. Prevents the panel from feeling overcrowded on short conversations.

**Merge cap:** `_sumMergeExcessSegments` lowered from 12 → 10.

### Task 2 — Conversation Map Visual Redesign

**Problem:** The flat card list with left-border segments did not convey conversation proportions and had no visual summary of the conversation shape.

**D2 Nested Bracket Map:** Replaced `_sumRenderConversationMap` entirely. Each segment is now a flex row containing: a `[` bracket (2px vertical line + 6px caps via `::before`/`::after`/bottom-cap element) and an inner column with label + meta (`msgs 1–12 · 12 msgs`). Topic pills shown on leaf segments only (segments with children get sub-labels instead). Children render indented 10px with thinner brackets (1.5px, 0.3 opacity vs 2px, 0.5). Click on any segment or child scrolls to its first message.

**Proportional flex-grow:** Both bracket rows and snapshot zones use `flex-grow` set to each segment's total text lines (`sum of ceil(textLength/80)`). A long deep-dive gets a tall bracket; a 2-message tangent gets a tiny one. The container height is `Math.max(300, Math.min(700, totalLines * 2.2))` so short conversations are compact and long ones are readable.

**Conversation Snapshot:** A second column (`acn-map-snapshot`) renders each message as a tiny block with proportional text-line bars (1.2px height). User messages have the platform accent color and right inset (15%); AI messages are gray. Each zone in the snapshot uses the same `flex-grow` as its corresponding bracket — horizontal alignment is automatic. Snapshot appears only when panel width ≥ 420px, scales from 70px (at 420px) to 160px (at ~640px) via `Math.max(70, Math.min(160, (panelW - 420) * 0.45 + 70))`. A `ResizeObserver` on the panel element toggles and resizes the snapshot live as the user drags the panel edge. Observer disconnects when the map container leaves the DOM to prevent leaks.

**CSS added:** `acn-map-container`, `acn-map-brackets`, `acn-seg-d2`, `acn-seg-d2-bracket/cap/inner/label/meta/pills/pill/children`, `acn-seg-d2-sub` and sub variants, `acn-map-snapshot`, `acn-snap-inner/zone/msg/user/ai/lines/line`. Old `acn-map-segment/label/range/entity` CSS removed.

---

## [10.10 — Draggable Orbital Zone + Summary Panel Overhaul] — 2026-03-09

**Branch:** `release/v10.10`

Two code features and a documentation audit.

**Files modified:** `ai-conversation-navigator.user.js`, `CHANGELOG.md`, `README.md`, `ROADMAP.md`, `CLAUDE.md`.

### Draggable Orbital Zone

**Problem:** The orbital button zone was fixed at the vertical center of the right edge with no way to move it, causing it to overlap platform UI elements (Claude's project panel, sidebar toggles, etc.).

**Root cause:** `cy = window.innerHeight / 2` was hardcoded in `orbRender()` and `orbUpdateHitzone()` with no user-adjustable offset.

**Fix:** Introduced `_orbYRatio` (0.0–1.0, default 0.5) stored as a fraction of viewport height. `_orbGetCy()` replaces the hardcoded division. Drag handlers on the hitzone and dots use a 5px movement threshold to distinguish drag from click; after a drag, a one-time capture-phase click listener suppresses the post-mouseup click. Any open panel closes when dragging starts. Limits keep all dots in viewport (top: `cy >= 132px`, bottom: `cy <= viewportHeight - 180px`), recalculated on resize. Visual feedback: `cursor: ns-resize` on hitzone, `opacity: 0.7` while dragging. Position persisted per-platform in GM storage key `'acn-zone-positions'`. Orbital platforms only (Claude, ChatGPT, Grok, Gemini, Perplexity + sub-variants).

### Summary Panel Overhaul

**Problem:** Topics (capped at 15), Key Points (capped at 20 with over-broad patterns), and Conversation Map (fixed 4-message window with category prefix labels) all generated too much content.

**Conversation Map — content-aware segmentation:** Replaced fixed sliding window with topic-shift detection using `_sumWordOverlap`. Each message compared against the last 4 messages of the current segment; overlap < 0.15 starts a new segment. Short conversations (≤ 6 messages) stay as one segment. Removed `SEGMENT_ICON_MAP` and `_sumGetSegmentIcon()` — BUG/CODE/MSG prefixes were noisy; segment labels from `_sumGenerateSegmentLabel()` are rendered directly.

**Topics:** Cap reduced 15 → 8.

**Key Points:** Removed over-broad action pattern (`try|run|install|build|...`). Removed standalone "actually" from finding patterns. Narrowed `because|why` to `this (means|is why|causes)|the reason (is|being|for)`. Minimum sentence length raised 20 → 40 chars. Cap reduced 20 → 10.

---

## [10.9 — Hybrid SSE Context Tracking + Turn Dots for Claude] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

Four changes: SSE plumbing fixes discovered after v10.8 through systematic live debugging, hybrid context bar using SSE thinking data + DOM text, turn dots + compaction indicators added for Claude, and debug log cleanup.

**Files modified:** `ai-conversation-navigator.user.js` only.

---

### Background: v10.8 Shipped But SSE Still Didn't Work

v10.8 fixed `unsafeWindow` and verified that `window._acnFetchPatched` was `true` — the fetch proxy was correctly installed on the real page window. But after committing v10.8 and installing it in Tampermonkey, live testing revealed the context bar still never showed `(exact)`. Three more layers of bugs were hiding underneath, each invisible until the one above it was fixed.

---

### 10-Step Systematic Diagnosis

Each step addressed one layer. The principle: you cannot see layer N+1 until layer N is fixed.

| Step | What was checked | Result | What it told us |
|------|-----------------|--------|-----------------|
| 1 | Console manual fetch proxy (bypassing TM) | ✅ SSE intercepted | SSE endpoint exists, data flows |
| 2 | `window._acnFetchPatched` after v10.8 | ❌ `undefined` | Patch was on wrong window |
| 3 | After `unsafeWindow` fix: `_acnFetchPatched` | ✅ `true` | Fetch proxy on real window |
| 4 | `console.log` added inside `readSSEStream()` | ✅ Magenta log appeared | Stream was being tapped |
| 5 | `console.log` added inside `pump()` | ✅ Orange "chunk received" | Chunks were flowing |
| 6 | `console.log` added inside `parseSSEEvent()` | ❌ Never appeared | Break between pump and parse |
| 7 | Logged chunk type | `[object Uint8Array]` length > 0 | Real data in chunks |
| 8 | Logged buffer length after `decoder.decode()` | Buffer stayed 0 | TextDecoder returning empty strings |
| 9 | After Uint8Array fix: buffer length | Grew (8006→9170) but never shrank | Events not splitting at boundaries |
| 10 | After `\r\n` fix: `parseSSEEvent()` fires | ✅ All event types firing | `message_start` has no `usage` → dead end |

Steps 2–3 were v10.8. Steps 4–10 were v10.9 live debugging.

---

### Change 1 — SSE Plumbing: Two More Bugs Found After v10.8

#### Bug A: Cross-Realm Uint8Array

**Root cause:** The cloned response stream returns typed arrays from the **page realm** (the real browser JS context). Tampermonkey's sandbox runs in a separate realm. `TextDecoder.decode()` inside the sandbox **silently returns empty strings** when given a cross-realm `Uint8Array` — no error, no warning, just empty output. This is a subtle cross-realm typed-array incompatibility in Tampermonkey's sandboxed VM.

Confirmed at Step 8: after `pump()` received a chunk with length > 0 (logged at Step 7), the buffer remained at 0 bytes. The decode call was consuming the chunk and producing nothing.

**Fix:** Copy bytes into the sandbox realm before decoding:

```javascript
// Before:
buffer += decoder.decode(result.value, { stream: true });

// After:
// Cross-realm fix: page-realm Uint8Array must be copied into sandbox realm
var copied = new Uint8Array(result.value);
buffer += decoder.decode(copied, { stream: true });
```

`new Uint8Array(result.value)` creates a new typed array **in the sandbox realm** with the same bytes. The sandbox's TextDecoder can then decode it correctly.

#### Bug B: Line Ending Mismatch (`\r\n` vs `\n`)

**Root cause:** After the Uint8Array fix, `buffer` accumulated text correctly (8006→9170 bytes, confirmed at Step 9) but never shrank — events were never being split out of the buffer. Claude's SSE uses **`\r\n` line endings**, not `\n`. The split regex `/\n\n/` never matched the `\r\n\r\n` event boundaries in Claude's stream. The buffer just kept growing.

**Two fixes required:**

Event boundary split in `readSSEStream()`:
```javascript
// Before:
var parts = buffer.split(/\n\n/);
// After:
var parts = buffer.split(/\r?\n\r?\n/);
```

Line parsing in `parseSSEEvent()`:
```javascript
// Before:
var lines = eventStr.split('\n');
// After:
var lines = eventStr.split(/\r?\n/);
```

---

### Dead End: Claude Web SSE Has No Token Usage Data

With all plumbing fixed, `parseSSEEvent()` began firing for all event types (Step 10). `message_start` events parsed successfully but contained **no `usage` field**:

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

No `input_tokens`. No `output_tokens`. `message_delta` and `message_stop` also lack usage data. Claude's web UI strips the `usage` field from the SSE stream — it only exists in direct API responses.

**What Claude web SSE DOES provide:**
- `content_block_delta` with `type: "text_delta"` — exact output text characters
- `content_block_delta` with `type: "thinking_delta"` — exact extended thinking characters
- `message_start` / `message_delta` / `message_stop` — message lifecycle boundaries

**What it does NOT provide:**
- `input_tokens` — stripped by Claude's web UI, only in API responses
- `output_tokens` — same
- Any form of token count

---

### Change 2 — Hybrid Context Bar

The SSE stream provides `thinking_delta` events with exact extended thinking text — the **one thing DOM cannot see** (thinking blocks are collapsed behind a toggle, invisible to `innerText`). This is exactly where DOM estimation falls furthest short in research and coding conversations.

**Formula:**
```
total = DOM_visible_text/4 + system_overhead(15K) + cumulative_SSE_thinking/4
```

**Why cumulative and never-resetting:** The bar answers "how close am I to trouble?" not "what's currently in the model's context window." A conversation that has compacted 3 times and has 80 messages IS in trouble, even if the model's internal context window just reset to 20%. The bar should reflect the total conversation load that has accumulated, not just what's in the current context epoch. An epoch-based reset (dropping bar to 20% after compaction) gives false confidence that lots of room remains when the conversation is actually degrading. (See DEC-016.)

**Why only thinking from SSE, not output too:** AI response output text IS visible in the DOM via `innerText`. If we added SSE output on top of DOM text, we'd double-count every AI response. Only thinking text is invisible in the DOM — so only thinking needs to come from SSE.

**Three display states:**
1. `~XX,XXX / 200K tokens (hybrid)` — live SSE thinking data available this session
2. `~XX,XXX / 200K tokens (last known)` — cached from previous session (GM storage)
3. `~XX,XXX / 200K tokens (est.)` — Path B DOM fallback; SSE never activated

The `~` prefix signals "approximately" — honest about the estimated components. The bar can still be off by ±20% (system prompts vary, tool results vary) but is dramatically more accurate than DOM-only for extended thinking conversations.

**New state tracked:**
- `_sseTokenData.cumulativeThinkingChars` — total thinking chars across all messages, never resets within a conversation
- `_sseTokenData.sseMessageCount` — assistant messages observed via SSE
- `_currentMsgThinkingChars` — per-message accumulator, reset on each `message_start`

**Typical improvement:** In a research conversation with extended thinking enabled, DOM-only might estimate 45K tokens. With cumulative thinking added: 45K + 25K thinking = 70K. Reality is probably 80K+ (system prompts, tool calls). The hybrid gets much closer.

**GM cache updated** to persist `cumulativeThinkingChars` and `sseMessageCount` instead of the old `inputTokens`/`outputTokens` fields. On page reload or SPA navigation, cached thinking chars are restored and the bar shows `(last known)`.

---

### Change 3 — Claude Now Shows Both Bar AND Turn/Compaction Indicators

Prior to v10.9, Claude's Navigate panel showed only the context percentage bar. Non-Claude platforms (v10.8) showed only turn dots + compaction count (no bar). Claude now shows **both**, making it the only platform with the full picture.

**Why both for Claude:** Claude is the only platform where SSE data makes the percentage bar genuinely useful. The two signals are complementary:
- **Percentage bar** (hybrid) — cumulative "how much has happened." Climbs steadily. Warns you're approaching trouble.
- **Turn dots + compaction count** — "trouble is happening." Shows message count, compaction events, predicted turns to next compaction.

Pre-compaction, the bar is the primary signal. Post-compaction, the compaction count becomes the primary signal. Neither alone tells the full story. (See DEC-017.)

Implementation: Path A in `orbUpdateContextBar()` now calls both `_renderTurnDots()` and `_renderCompactionInfo(pctNum)` after rendering the bar. These functions were already built for non-Claude in v10.8 and work for Claude without modification since `_turnCounter` is updated on all platforms.

---

### Change 4 — Debug Console Log Cleanup

Removed all `[ACN-SSE]` diagnostic `console.log` statements added during the v10.8→v10.9 debugging session. Zero debug logging in the released version.

---

## [10.8 — Context Tracking Overhaul, Arc Hitzone, Turn Counter Reset] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish` | **Commit:** `c45e88c`

Five fixes across the context tracking system: the SSE interceptor had never worked in production due to Tampermonkey sandbox isolation, non-Claude platforms were showing a misleading estimated percentage bar, Claude lacked persistence on page reload, arc mode's hitzone geometry was too narrow to reach the focused satellite, and the turn counter went stale after SPA navigation.

**Files modified:** `ai-conversation-navigator.user.js` only.

---

### Change 1 — SSE Interceptor: `unsafeWindow` Fixes Tampermonkey Sandbox Isolation

**The problem:** The context bar on Claude.ai always showed `(est.)` regardless of how many messages were sent. `_sseTokenData.exact` was never `true`. The script contained `setupClaudeSSEInterceptor()` which appeared correct — it patched `window.fetch` and filtered for Claude URLs — but it had never intercepted a single SSE stream in production.

**Root cause — Tampermonkey's sandboxed window:** When any `@grant` directive other than `none` is declared in the userscript header (`@grant GM_addStyle`, `@grant GM_getValue`, etc.), Tampermonkey runs the script in a sandboxed JavaScript context. In this context, `window` is a Tampermonkey-managed wrapper object — not the real page `window`. The script was patching the wrapper's `.fetch`, leaving the real `window.fetch` untouched. Claude.ai's own JavaScript exclusively uses the real page window for all network calls, so the SSE streams passed through completely unseen.

Confirmed in production: `window._acnFetchPatched` typed in the browser DevTools console returned `undefined` — the flag was set on the sandbox wrapper, not on the page's actual window. Manually patching the real window's fetch from the console (`unsafeWindow.fetch = ...`) immediately began intercepting SSE streams with `input_tokens` data.

**Implementation:**

```javascript
// Before — patches sandbox wrapper, not the real page window:
function setupClaudeSSEInterceptor() {
    if (typeof window.fetch !== 'function') return;
    if (window._acnFetchPatched) return;
    window._acnFetchPatched = true;
    var _nativeFetch = window.fetch;
    window.fetch = function acnFetchProxy(...) { ... };
}

// After — uses unsafeWindow to reach the real page window:
function setupClaudeSSEInterceptor() {
    var pw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (typeof pw.fetch !== 'function') return;
    if (pw._acnFetchPatched) return;
    pw._acnFetchPatched = true;
    var _nativeFetch = pw.fetch.bind(pw);  // .bind() preserves `this` context
    pw.fetch = function acnFetchProxy(...) { ... };
}
```

Added `// @grant unsafeWindow` to the script header. `readSSEStream()` and `parseSSEEvent()` are unchanged — they don't touch `window.fetch` and operated correctly whenever they received a stream. The fix is entirely isolated to `setupClaudeSSEInterceptor()`.

**Impact:** For the first time in production, `_sseTokenData.exact` becomes `true` after the first message sent in a Claude conversation. The context bar shows `(exact)` with real API token counts. Compaction detection now fires correctly when `input_tokens` drops >40% from the previous `message_start` event.

---

### Change 2 — Non-Claude: Eliminated Misleading Estimated Percentage Bar

**The problem:** On ChatGPT, Grok, Gemini, and other non-Claude platforms, the Navigate panel showed both a filled percentage bar with a `(est.)` label AND turn-count dots below it. The percentage bar was produced by `_renderEstimatedBar()` which counts visible DOM text via `innerText` and divides by 4 chars/token. This estimate can be off by 15–20× because: system prompts (never in DOM), tool call results (often collapsed), search grounding context (injected invisibly), and streaming prefill aren't captured. A conversation that reads "~12K / 128K (est.)" might actually be at 90K+ tokens.

**Decision:** The original design called for turn dots as the primary indicator on non-Claude platforms. DOM estimation is fundamentally inadequate for a percentage bar with a number that implies precision. The compaction-aware turn dots (weighted-average cycle prediction) are a more honest signal — they tell you where you are in the compaction cycle, not a false token percentage.

**Implementation — Path C in `orbUpdateContextBar()`:**

```javascript
// Before:
_renderEstimatedBar(pct, fill, meta, limit);   // showed misleading "~12K / 128K (est.)"
_renderTurnDots();
_renderTurnCompactionInfo();

// After:
pct.textContent  = '';    // clear number
fill.style.width = '0%'; // clear bar fill
if (meta) { meta.textContent = ''; }
_renderTurnDots();
_renderTurnCompactionInfo();
```

The section label in `orbBuildPanelNav()` changed from `'Context window'` (implies token tracking) to a platform-conditional string:

```javascript
var ctxLabelText = (platform.id === 'claude') ? 'Context window' : 'Conversation turns';
```

`_renderEstimatedBar()` is not removed from the codebase — it still runs for Path B (Claude with no SSE data for a conversation that has never been visited with the script installed). It is only removed from Path C (non-Claude).

---

### Change 3 — Claude: GM Storage Caching for Reload and Cross-Conversation Persistence

**The problem:** Every page reload or SPA navigation to an existing Claude conversation reset `_sseTokenData` to zeros and `exact: false`. Until the user sent a new message and triggered an SSE `message_start` event, the context bar fell back to Path B (DOM estimation), showing an imprecise estimate for a conversation where exact data had already been collected.

**Implementation — three new helpers:**

```javascript
function _getConvId() {
    // Extracts UUID from /chat/6873dd1a-f895-4fef-a564-6f0e03b7e8ed
    var parts = window.location.pathname.split('/');
    var id = parts[parts.length - 1];
    return (id && id.length > 8 && id.indexOf('-') !== -1) ? id : null;
}

function _cacheSSEData() {
    // Called on every message_start event (after _sseTokenData.exact = true)
    var convId = _getConvId();
    if (!convId || !_sseTokenData.exact) return;
    var cache = GM_getValue('acn_ctx_cache', {});
    cache[convId] = {
        inputTokens:  _sseTokenData.inputTokens,
        outputTokens: _sseTokenData.outputTokens,
        timestamp:    Date.now()
    };
    // Prune to 50 most recent by timestamp
    var keys = Object.keys(cache);
    if (keys.length > 50) {
        keys.sort((a, b) => (cache[b].timestamp || 0) - (cache[a].timestamp || 0));
        var pruned = {};
        for (var i = 0; i < 50; i++) pruned[keys[i]] = cache[keys[i]];
        cache = pruned;
    }
    GM_setValue('acn_ctx_cache', cache);
}

function _loadCachedSSEData() {
    // Called on init and 600ms after each SPA navigation (URL has settled)
    var convId = _getConvId();
    if (!convId) return;
    var cache = GM_getValue('acn_ctx_cache', {});
    var entry = cache[convId];
    if (entry && entry.inputTokens) {
        _sseTokenData.inputTokens  = entry.inputTokens;
        _sseTokenData.outputTokens = entry.outputTokens;
        _sseTokenData.lastUpdated  = entry.timestamp;
        _sseTokenData.exact        = false;  // not live data
        _sseTokenData.cached       = true;   // new flag — triggers Path A with "(last known)" label
    }
}
```

Added `cached: false` field to `_sseTokenData` initialization. Path A in `orbUpdateContextBar()` now triggers on `exact || cached`:

```javascript
// Before:
if (platform && platform.id === 'claude' && _sseTokenData.exact) {
    meta.textContent = tokFmt + ' / ' + limFmt + ' tokens (exact)';
    meta.style.color = '#888';
}

// After:
if (platform && platform.id === 'claude' && (_sseTokenData.exact || _sseTokenData.cached)) {
    var label = _sseTokenData.exact ? '(exact)' : '(last known)';
    meta.textContent = tokFmt + ' / ' + limFmt + ' tokens ' + label;
    meta.style.color = _sseTokenData.exact ? '#888' : '#666'; // slightly dimmer for cached
}
```

**Three display states for Claude:**
1. `(exact)` — live SSE `message_start` data received this page session
2. `(last known)` — loaded from GM cache; real data from a previous session
3. `(est.)` — Path B DOM estimation; never visited with the script installed

**Cache key:** GM key `'acn_ctx_cache'` stores a JSON object keyed by conversation UUID. UUID is extracted from the URL pathname (last segment). Basic validation: length > 8 and contains `-`. Cache capped at 50 entries, pruned by timestamp descending.

**When cached data is superseded:** On the next `message_start` SSE event, `_sseTokenData.cached = false` and `exact = true` are set before `_cacheSSEData()` runs. The UI updates from `(last known)` to `(exact)` and the cache entry for that conversation ID is overwritten.

---

### Change 4 — Arc Mode: Mode-Aware Hitzone Geometry

**The problem:** In arc mode, moving the cursor from the center Navigate button leftward toward the focused satellite collapsed all orbital buttons before the cursor could reach the satellite. Only happened when no panel was open — the panel-open state keeps buttons visible regardless of hover state.

**Geometry of the failure:**
```
ORB_CX        = 42px  (center axis from right edge)
HITZONE_PAD_X = 30px
radius        = 88px  (arc mode focused satellite distance from center)

Old hitzone width = ORB_CX + 24 + HITZONE_PAD_X = 42 + 24 + 30 = 96px

Arc focused satellite leftmost pixel:
  right offset of center = ORB_CX = 42px
  + radius × cos(0°)     = 88px  (directly left of center)
  + dot half-width        = 17px  (dot diameter = 34px)
  = 147px from right edge

Gap: 147px - 96px = 51px of uncovered space
```

When the cursor crossed 96px from the right edge, `mouseleave` fired on `#acn-hitzone`, which set `orbHovering = false` and called `orbRender()`, collapsing all dots.

**Implementation:**

```javascript
// Before — one fixed width for all modes:
var hitzoneWidth = ORB_CX + 24 + HITZONE_PAD_X;  // 96px

// After — mode-aware:
var baseWidth = ORB_CX + 24 + HITZONE_PAD_X;       // 96px — show-all & wheel
var arcWidth  = ORB_CX + 88 + 17 + HITZONE_PAD_X;  // 177px — arc mode

var hitzoneWidth = (orbMode === 'arc') ? arcWidth : baseWidth;
```

`orbUpdateHitzone()` is also now called at the end of `orbSetMode()`, so the hitzone geometry updates immediately when the user switches modes in Settings. Previously it only ran on `window.resize` and after initial injection.

---

### Change 5 — Turn Counter: Reset on SPA Navigation and Shrinkage Detection

**The problem:** After using SPA navigation (clicking a different conversation in the sidebar) to move from a 30-message conversation to a 5-message conversation, the turn counter dots and compaction badge still showed the 30-message state. The new conversation's `_questions.length` (5) was less than `_turnCounter.totalTurns` (30), so `updateTurnCounter()` returned early at its first guard: `if (newTotal <= _turnCounter.totalTurns) return`. This guard ran on every `orbOnScanComplete()` cycle, which fires every 500ms, so the stale state persisted indefinitely.

**Root cause — incomplete reset in SPA handlers:** The `pushState`, `replaceState`, and `popstate` handlers (installed at startup when `platform.spa === true`) reset `_questions = []` but never touched `_turnCounter`. After `_questions` was cleared and `scanConversation()` ran and rebuilt it from the new conversation's DOM, `updateTurnCounter()` received a `newTotal` of 5 against a `_turnCounter.totalTurns` of 30 — and did nothing.

**Implementation — `resetTurnCounter()` helper:**

```javascript
function resetTurnCounter() {
    _turnCounter.totalTurns           = 0;
    _turnCounter.turnsSinceCompact    = 0;
    _turnCounter.compactionCount      = 0;
    _turnCounter.cycleLengths         = [];
    _turnCounter.predictedCycleLength = null;
    _turnCounter.lastCompactTurn      = 0;

    // Also reset Claude SSE state — the new conversation has different token counts
    _sseTokenData.inputTokens  = 0;
    _sseTokenData.outputTokens = 0;
    _sseTokenData.lastUpdated  = 0;
    _sseTokenData.exact        = false;
    _sseTokenData.cached       = false;
    _prevInputTokens           = 0;
    _compactionCount           = 0;
    _compactionHistory         = [];
}
```

`resetTurnCounter()` is called in three places:
1. `history.pushState` handler — after `_questions = []`
2. `history.replaceState` handler — after `_questions = []`
3. `window.addEventListener('popstate')` handler — after `_questions = []`

A **shrinkage guard** was also added to `updateTurnCounter()` as a defensive fallback:

```javascript
function updateTurnCounter() {
    var newTotal = _questions.length;

    // Shrinkage = we navigated to a shorter conversation
    if (newTotal < _turnCounter.totalTurns) {
        resetTurnCounter();
    }

    if (newTotal <= _turnCounter.totalTurns) return;
    // ... rest of function unchanged
}
```

**SPA navigation + Claude GM cache integration:** After `resetTurnCounter()` in each SPA handler, a 600ms deferred call loads cached SSE data for the new conversation:

```javascript
if (platform.id === 'claude') setTimeout(_loadCachedSSEData, 600);
```

The 600ms delay ensures the URL has fully settled before `_getConvId()` reads the pathname. This means Claude users who switch between conversations immediately see `(last known)` token data if that conversation was previously visited, rather than waiting for a new message.

---

## [10.7.11 — Bookmark Icon Invisible on Hover (Non-Active State)] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

A CSS color-camouflage bug made bookmark icons invisible when hovering them before they had been clicked.

---

### Bookmark Icon Invisible on Hover — Wrong Background Color

**The problem:** When hovering a bookmark icon that had NOT yet been clicked (no bookmark created), moving the cursor directly onto the icon made it visually disappear. The browser tooltip ("Bookmark this message") still showed, confirming the element existed and received pointer events — it was simply invisible.

**Root cause — CSS color camouflage:** The `.acn-bm-icon` default style used a dark background (`rgba(0,0,0,0.3)`) with a white-ish flag glyph (`color: rgba(255,255,255,0.5)`). The hover rule changed the background to `rgba(255,255,255,0.2)`:

```css
.acn-bm-icon:hover { opacity:1; background:rgba(255,255,255,0.2); }
```

Claude.ai's message background is off-white/cream. A container with `rgba(255,255,255,0.2)` (20% white) over that background becomes nearly transparent. The flag glyph at `rgba(255,255,255,0.5)` (white text) on a near-white background becomes invisible — white on white. The element was technically visible (`opacity:1`) but optically camouflaged. The active-state fix from v10.7.7 (`rgba(255,255,255,0.2)` → orange) didn't cover the non-active case.

**Fix:** Changed hover background to `rgba(0,0,0,0.55)` — a darker, more opaque background that remains visible on any page background color — and set color to `#fff` to ensure the flag glyph is always crisp:

```css
/* Before */
.acn-bm-icon:hover { opacity:1; background:rgba(255,255,255,0.2); }

/* After */
.acn-bm-icon:hover { opacity:1; background:rgba(0,0,0,0.55); color:#fff; }
```

---

## [10.7.10 — Context Window Estimation: Extended Thinking + System Prompt Overhead] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

Significantly improved context window estimation accuracy for Claude conversations using extended thinking, which was showing ~45% for a conversation that had physically exhausted the 200K context limit.

---

### Context Bar at 45% for a Maxed-Out 200K Extended Thinking Conversation

**The problem:** A Claude Opus 4.6 Extended Thinking conversation with 83 questions that had physically exhausted the context limit (Claude was unable to generate further responses) showed only 45% (~90K / 200K tokens) in the context window bar. The user expected it to show near 100%.

**Investigation — virtual scroll hypothesis (ruled out):** The first hypothesis was that Claude.ai uses virtual scroll to remove older messages from the DOM, so the `innerText`-based estimate only captured half the conversation. This was investigated by querying the scrollable container:

```javascript
var scrollDiv = document.querySelector('.overflow-y-scroll');
// scrollHeight: 98,393px — full conversation height in DOM
// clientHeight: 652px — visible viewport
// innerText.length: 360,720 chars
```

The `scrollHeight >> clientHeight` confirmed the full conversation was in the DOM. All 83 questions were present in the live DOM (confirmed via `document.body.contains(q.element)`). Virtual scroll was not the cause for this conversation size.

**Root cause — extended thinking tokens invisible to DOM:** Claude Opus Extended Thinking generates "thinking blocks" — reasoning chains that the model works through before producing a response. Claude.ai renders these as collapsed expandable summaries ("Examined repository state to assess...", "Prepared to examine..."). The FULL thinking content is never placed in the DOM — only a short summary phrase is rendered. These thinking tokens count toward the context limit but are completely invisible to `innerText` scraping.

Investigation confirmed 161 collapsed thinking block elements (`[aria-expanded]`) in the 83-question conversation — approximately 1.94 thinking passes per response. At roughly 683 tokens per block, this accounts for ~110K hidden tokens (the gap between the 90K estimate and the 200K reality).

Additionally, claude.ai injects a system prompt of approximately 15,000 tokens that is never rendered anywhere in the conversation DOM.

**Fix — two-part invisible overhead correction:**

```javascript
// In _renderEstimatedBar(), after base estimate:
if (platform && platform.id === 'claude' && found && node) {
    // (1) System prompt: always ~15K tokens on claude.ai, never in DOM
    estTokens += 15000;

    // (2) Extended thinking blocks: count collapsed summaries, ~600 tokens each
    var uiKw = ['hide','show','expand','collapse','menu','chat','chats','project','artifact','recent','starred'];
    var thinkingCount = 0;
    node.querySelectorAll('[aria-expanded]').forEach(function(el) {
        var txt = (el.textContent || '').trim().toLowerCase();
        var isUI = txt.length < 5 || uiKw.some(function(w) { return txt.indexOf(w) !== -1; });
        if (!isUI) thinkingCount++;
    });
    estTokens += thinkingCount * 600;
}
```

**Results for the 83Q maxed conversation:**
- Before: 90K visible + 0 overhead = 90K → 45%
- After: 90K + 15K system prompt + (161 × 600 thinking) = 201.6K → **100% (capped, correctly shows red)**

Non-extended-thinking conversations: `thinkingCount = 0`, so only the +15K system prompt applies. Small conversations receive a modest ~7-8% increase from the system prompt overhead, which reflects reality (system prompt always exists).

See `docs/claude_specific_context_tracking_calculation.md` for the full investigation methodology and architecture.

---

## [10.7.9 — Context Window: Virtual Scroll Coverage Ratio] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

Replaced the blunt ×2 multiplier from v10.7.8 with a self-correcting ratio based on how many detected messages are currently in the live DOM versus the total accumulated count.

---

### Self-Correcting Virtual Scroll Compensation

**Problem with v10.7.8 (blunt ×2):** Doubling the estimate worked for long conversations where virtual scroll hid half the messages, but over-estimated by 2× for short conversations where all messages were in the DOM.

**Key insight:** The `_questions` array uses VS accumulation — it records all messages ever seen during the session, including those later removed from DOM by virtual scroll. By comparing `_questions.length` (total ever detected) vs how many elements are currently in the live DOM, we can compute exactly how much is hidden and correct proportionally:

```javascript
var nInDOM   = _questions.filter(function(q) {
    return q.element && document.body.contains(q.element);
}).length;
var coverage = nInDOM / Math.max(1, _questions.length);
// coverage=1.0 → all in DOM → no correction
// coverage=0.5 → half in DOM → ×2 correction
var estTokens = Math.round((totalChars / 4) / Math.max(0.25, coverage));
```

- Short conversation (30Q, all in DOM): coverage=1.0 → estimate unchanged
- Long conversation (83Q, 40 in DOM): coverage=0.48 → estimate ×2.1
- `Math.max(0.25, coverage)` caps the multiplier at 4× to prevent extreme over-estimation if VS is very aggressive

---

## [10.7.8 — Context Window: Initial Estimate Doubling] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

*Note: This approach was superseded by v10.7.9's ratio-based correction within the same session.*

Initial fix for the underestimation problem — changed the chars-to-tokens divisor from `4` to `2`, effectively doubling all estimates. While this helped for the specific long conversation case, it over-estimated all short conversations by 2×. Replaced by v10.7.9's self-correcting approach.

---

## [10.7.7 — Hover Flicker (Search+Bookmarks), Export, /Cmd Detection, Panel Resize] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

Four new features and two bug fixes discovered during continued live testing. Hotfixes for bookmark icon active-state disappearance and export SVG crash were applied to this same version number (per user preference).

---

### Version Number in Script @name

Per user request, the `@name` header now includes the version: `AI Conversation Navigator v10.7.7`. Updated on every version bump going forward.

---

### Hover Flicker in Search and Bookmarks Panels — Missing Fingerprint Guards

**The problem:** Opening the Search or Bookmarks panel and hovering over items caused the list to rebuild under the cursor — items would disappear and reappear, making the hover state unstable. Navigate panel was fine (it had a fingerprint guard since v10.0).

**Root cause:** `orbOnScanComplete()` fires after every `scanConversation()` call (debounced 500ms from MutationObserver). Live AI platforms continuously mutate their DOM (streaming tokens, typing indicators), so this fires frequently. When the Search or Bookmarks panel was open, `orbPopulateSearch()` and `orbRefreshBookmarksPanel()` were called unconditionally — they tore down and rebuilt the entire DOM list every 500ms. Any `mouseenter` event was cancelled when the element was removed, and the new element had no hover state.

**Fix:** Added fingerprint guards matching the Navigate panel pattern:

```javascript
// Search: fingerprint = query + question count + ai response count
var sfp = q + '|' + _questions.length + '|' + (_aiResponses ? _aiResponses.length : 0);
if (sfp === _searchListFingerprint && list.firstChild) return;
_searchListFingerprint = sfp;

// Bookmarks: fingerprint = joined bookmark IDs
var bfp = bookmarks.map(function(b) { return b.id; }).join('|');
if (bfp === _bmListFingerprint && panel.children.length > 1) return;
_bmListFingerprint = bfp;
```

---

### Full Conversation Export Failing — SVG Element `className` Not a String

**The problem:** Clicking "Export Full Conversation" in the Tools panel showed a toast "Export failed — see console."

**Root cause:** The `exportFullConversation()` function calls `extractMarkdownContent()` which walks the DOM tree. Inside the walk, `isUIChrome()` called `node.className.toLowerCase()`. For regular HTML elements, `className` is a string. But for SVG elements (e.g., inline SVG icons common in Claude.ai's UI), `className` is an `SVGAnimatedString` object — a JavaScript object with `.baseVal` and `.animVal` properties, not a string. Calling `.toLowerCase()` on an object threw `TypeError: (node.className || "").toLowerCase is not a function`.

The error was caught by the outer try-catch, which showed the "Export failed" toast instead of surfacing the actual exception.

**Fix:**
```javascript
var rawCls = node.className;
var cls = (typeof rawCls === 'string' ? rawCls : (rawCls && rawCls.baseVal) || '').toLowerCase();
```

---

### /Command Palette Triggered by Chat Input Typing

**New feature:** When the user types `/commandname` in the chat input (e.g., `/handoff` on Claude.ai), the command palette opens automatically pre-filtered to commands starting with that name. As the user continues typing, the palette filter updates live. If the user clears the slash text or types something that doesn't match any command, the palette closes.

`setupChatInputSlashDetection()` attaches an `input` listener to the chat textarea (found via `findChatInput()`). It distinguishes palette-triggered-by-input vs palette-triggered-by-Ctrl+/ using a `_paletteInputTriggered` flag, so the input-triggered palette doesn't steal keyboard focus from the chat input.

---

### Panel Resize by Dragging

**New feature:** Each panel has a 6px drag handle on its left edge. Dragging adjusts panel width between 240px and 640px. Width is saved to `localStorage._acnv10.panelWidth` and restored on next load. CSS variable `--acn-panel-w` is the single source of truth for both `panel width` and `.acn-zone.acn-hp { right }`, so dragging atomically updates both.

---

### Hotfix: Active Bookmark Icon Disappears on Hover

**The problem:** An already-bookmarked message (orange flag icon) would visually lose its orange color when hovered.

**Root cause:** CSS specificity tie. `.acn-bm-icon:hover` (specificity 0,2,0) came after `.acn-bm-icon.acn-bm-active` (also 0,2,0) in the stylesheet. Later rule wins. The hover rule's `rgba(255,255,255,0.2)` overrode the active rule's `var(--acn-accent)` orange.

**Fix:** Added `.acn-bm-icon.acn-bm-active:hover` with specificity 0,3,0 — three class selectors always beats two:
```css
.acn-bm-icon.acn-bm-active:hover { background:var(--acn-accent); filter:brightness(1.2); }
```

---

## [10.7.6 — Panel Header i18n, Gallery Duplicates, @name Stripped] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

Three bugs from continued live testing.

---

### Navigate/Search/Tools Panel Headers Not Translating

**Problem:** After switching language to Korean in Settings, the panel `h3` headers for Navigate, Search, and Tools remained in English.

**Root cause:** `orbBuildPanelNav()`, `orbBuildPanelSearch()`, and `orbBuildPanelTools()` used hardcoded English strings for the `h3` header text. `orbBuildPanelHeader()` was called with literals like `'✳ Navigate'` rather than `'✳ ' + i18n('navigate')`.

**Fix:** All panel headers now use `i18n()` calls. The language change handler in Settings was also extended to update all open panel `h3` headers live when language is switched.

---

### Image Gallery Showing Duplicate (0) and (N) Sections on Reopen

**Problem:** Opening the Tools panel showed two image count sections — `(0)` from injection time and `(N)` from the actual scan.

**Root cause:** `orbBuildPanelTools()` called `renderImageGallery()` at injection time (before any scan completed), creating a `(0)` section. When the panel was opened via `orbOpenPanel()`, it called `renderImageGallery()` again, appending a second `(N)` section on top.

**Fix:** Removed the injection-time `renderImageGallery()` call from `orbBuildPanelTools()`. Gallery now only renders when the panel is opened. Added a `while (container.firstChild) container.removeChild(container.firstChild)` clear at the start of `renderImageGallery()` to prevent any future double-render accumulation.

---

### @name Contained Version Number That Wasn't Updated

**Problem:** The `@name` header read "AI Conversation Navigator v10.1" while the actual version was v10.7.x.

**Fix:** Stripped version from `@name`, then re-added it correctly in v10.7.7 (per user request, version is now always included and always matches `@version`).

---

## [10.7.5 — Gallery Re-render Clear, i18n Live Label Updates] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

Two polish fixes from v10.7.4 that were staged separately.

- `renderImageGallery()` now clears its container before building to prevent accumulation on reopen.
- Language change handler live-updates `.acn-lbl` dot label text so labels switch language without requiring a page reload.

---

## [10.7.4 — Plan Usage, Summary Auto-Gen, Gallery Count, Q# Thumbnails, i18n] — 2026-02-23

**Branch:** `fix/v10-live-testing-polish`

Six bugs discovered during first live Tampermonkey installation and testing session.

- **Plan Usage "loading…" never loads:** `fetchClaudeUsage()` was not being called on panel open. Added call to `maybeRefreshUsage()` in `orbOpenPanel()` for the Navigate panel.
- **Summary panel blank:** Summary was not auto-generating on panel open. Added `generateSummary()` call in `orbOpenPanel()` when summary panel has no content.
- **Image gallery showing (0):** `renderImageGallery()` was called before `scanConversation()` had run. Gallery now renders lazily when panel is opened post-scan.
- **Navigate Q# items missing image thumbnails:** Image detection logic in `_questions` population was not extracting `img` elements from question containers. Fixed to check for `img` descendants.
- **Slash command placeholder name error:** `/commands` conflicted with Claude.ai's native `/` menu. Command palette renamed and detection logic updated.
- **Korean i18n not applying to all labels:** Several strings used hardcoded English rather than `i18n()` calls. Added `i18nKey` property to `ORB_FEATURES` entries and converted all affected labels.

---

## [10.0 — Panel Hover Fixes: CSS Variable Scoping, Jitter, List Rebuild] — 2026-02-22
**Branch:** `fix/v10-live-testing-polish` | **Commit:** pending

This session resolves three related bugs in the Navigate panel question list — all visible as hover interaction failures. Together they form a complete treatment of the panel hover UX: colors now show correctly, the highlight is stable, and the list doesn't rebuild under your cursor.

---

### Q# Badge Color and Hover Highlight Invisible — CSS Variable Scoping Bug

**The problem:** In the Navigate panel, the `Q#1`, `Q#2`, `Q#3` number badges were white instead of the platform accent color. The hover highlight (left-border color transition and background tint) was also invisible on hover.

**Root cause — CSS inheritance boundary:** Platform accent colors are exposed via CSS custom properties `--acn-accent` and `--acn-rgb`. These were set via `zone.style.setProperty()` on the `#acn-zone` element. CSS custom properties only cascade *down* to descendants. The problem is that `.acn-panel` elements are appended to `document.body` as siblings of `#acn-zone`, not as descendants:

```javascript
// injectOrbital() lines 2061-2069
document.body.appendChild(zone);            // zone is at body level
document.body.appendChild(orbBuildPanelNav());   // panel is also at body level
document.body.appendChild(orbBuildPanelSearch()); // sibling, not child
```

Since the panels are siblings of the zone, `var(--acn-accent)` inside any `.acn-panel` rule resolved to nothing (empty string), which the browser treated as `transparent`/`initial`. The `Q#` badge background and the hover border-left-color were both silent no-ops.

The prior CHANGELOG entry for "Question List Readability Improvements" introduced these `var(--acn-*)` references in `.acn-qn` and `.acn-qi:hover`, but there was no test that detected their computed-value at runtime — the Playwright tests verified that elements existed and that `data-acn-accent` was set on the zone, not that the CSS variable resolved correctly inside panels.

**Fix:** Set the same CSS variables on `document.documentElement` (`:root`) in addition to the zone element. Variables on `:root` are globally available to all elements on the page — panels included. Zone-level assignment is kept because zone children also use these variables (dot glow, etc.) and the zone assignment provides a more scoped fallback.

```javascript
// orbBuildZone() — set on :root for global inheritance, then on zone for scoped use
document.documentElement.style.setProperty('--acn-accent', orbTheme.bg);
document.documentElement.style.setProperty('--acn-rgb',    orbTheme.rgb);
document.documentElement.style.setProperty('--acn-shadow', orbTheme.shadow);
zone.style.setProperty('--acn-accent', orbTheme.bg);
zone.style.setProperty('--acn-rgb',    orbTheme.rgb);
zone.style.setProperty('--acn-shadow', orbTheme.shadow);
```

**Results:** Q# badges now appear in platform accent color. Hover highlight background and left-border transition correctly show the platform color. 168/168 tests pass.

---

### `translateX(2px)` Hover Jitter — Bounding Box Shift Loop

**The problem:** When hovering steadily over a question item, the left-border highlight flickered on and off rapidly (approximately every 150ms) rather than staying lit.

**Root cause:** The `.acn-qi:hover` CSS rule included `transform:translateX(2px)`. CSS `transform` changes an element's rendered position without affecting layout flow — but it *does* change the element's visual bounding box, which is what the browser uses for hit-testing (determining whether the cursor is "inside" the element). The jitter loop was:

1. Cursor enters `.acn-qi` bounds → hover fires → `translateX(2px)` shifts element 2px right
2. Rendered bounding box is now 2px to the right of cursor → cursor is outside → hover lost
3. `translateX(0)` → element returns to original position → cursor is inside again → hover fires
4. Repeat at the CSS transition rate (~150ms for `.15s` transition)

This is a well-known CSS hover-jitter pattern. `translateX` (and `translateY`) change where the element renders, and hover hit-testing uses the rendered position, creating an unstable equilibrium. The symptom is exactly the "every ~150ms" rate the user observed — one cycle per transition duration.

**First attempted fix (earlier in session):** The jitter was initially attributed to an incorrect hypothesis about orbital dots overlapping the panel area. Investigation confirmed that dots and panels don't overlap at runtime (dots move to `right:310px` when panel opens, panel is at `right:0; width:310px` — they're flush, not overlapping). This investigation was not wasted: it confirmed the panel z-index hierarchy is correct.

**Fix:** Removed `transform:translateX(2px)` from `.acn-qi:hover` entirely. The hover state still transitions `background` and `border-left-color`, giving clear visual feedback without any position shift.

```css
/* Before */
.acn-qi:hover { background:rgba(var(--acn-rgb),.14); border-left-color:var(--acn-accent); transform:translateX(2px) }

/* After */
.acn-qi:hover { background:rgba(var(--acn-rgb),.14); border-left-color:var(--acn-accent) }
```

**Results:** Hover highlight is stable. Left border transitions to accent color and background tints on enter; both transition back on leave. No flickering. 168/168 tests pass.

---

### Nav List Rebuild on Every SPA Mutation — Hover Flicker from DOM Teardown

**The problem:** Even after removing `translateX`, the hover highlight continued to flicker, though less predictably. The border highlight would flash on briefly, then disappear, then reappear on the next hover entry.

**Root cause — MutationObserver → list teardown chain:** The MutationObserver in `startMessageObserver()` watches `document.body` with `{ childList: true, subtree: true }`. Live AI platforms (Gemini, Claude, ChatGPT, etc.) continuously mutate their DOM — typing indicators pulse, streaming tokens arrive, animations fire, sidebar items update. Each mutation triggers the observer. The observer debounces by 500ms, then calls `scanConversation()`. `scanConversation()` always calls `orbOnScanComplete()`. `orbOnScanComplete()` calls `orbPopulateNavigate()` when the nav panel is open.

`orbPopulateNavigate()` began with unconditional list teardown:
```javascript
while (list.firstChild) list.removeChild(list.firstChild);
```

This destroyed every `.acn-qi` element in the list, including the one the user was currently hovering. When the element is removed from the DOM, the browser drops the `:hover` state on it. New elements are created and appended, but they have no hover state. The next cycle (500ms later) removes them again. Result: the hover highlight appears for up to 500ms, then disappears when the list is rebuilt, then reappears on the next hover entry — exactly the "turns on and off" behavior the user reported.

The mechanism was: any Gemini UI animation (button pulse, response caret, etc.) → MutationObserver fires → 500ms later → question list cleared → hovered item destroyed → hover lost. The cycle repeated as long as the nav panel was open and the site had any DOM activity.

**Solutions Considered:**

*Approach 1: DOM diffing — update individual items in place, add new ones, remove stale ones.* This would preserve elements currently in the DOM, so hover state on an unchanged item would survive. Hypothesis: correct semantics, good UX. Rejected for now because: proper diffing requires a key-based comparison (matching old elements to new `_questions[]` entries by stable key), stable keys would need to be added to `_questions[]`, and the complexity was disproportionate to the problem. The questions list for any given conversation is typically static — questions don't change unless the user sends a new message, which is rare while reading the navigate panel.

*Approach 2: Debounce `orbPopulateNavigate()` calls separately from the scan debounce.* Add a 1s debounce specifically on the populate call, so rapid MutationObserver fires don't each trigger a rebuild. Rejected because: this delays the list update after a new message is sent — there's already a 500ms scan debounce, adding another 1s delay makes the panel feel stale. Also doesn't address the root cause: the scan could still fire once per debounce window and still tear down the list.

*Approach 3: Don't call `orbPopulateNavigate()` during MutationObserver-triggered scans.* Skip `orbOnScanComplete()` if the scan was triggered by a mutation (not a user action). Rejected because: the distinction is hard to communicate cleanly through the call chain, and user messages ARE mutations — we need the list to update after new messages.

*Approach 4: Fingerprint-gated rebuild.* Before clearing the list, compute a fingerprint of the current `_questions[]` array. If it matches the fingerprint from the last build, skip the teardown entirely. The list is only rebuilt when questions actually change (new messages added). This is `O(n)` in question count (typically 1–20 items), adds one string variable, and requires no structural changes.

**Fix:** Added `_navListFingerprint` module variable (empty string). At the start of `orbPopulateNavigate()`:

```javascript
var fp = _questions.map(function (q) { return q.text.substring(0, 100); }).join('|');
if (fp === _navListFingerprint && list.firstChild) return;
_navListFingerprint = fp;
```

The fingerprint is the first 100 chars of each question's text joined by `|`. 100 chars is enough to distinguish questions reliably while keeping the fingerprint short. The `&& list.firstChild` guard ensures the list is rebuilt if it's empty (e.g., first open, or after panel close+reopen cleared the DOM).

**Results:** On a live Gemini conversation with 3 questions, hovering over any question item shows a stable, persistent highlight. Repeated MutationObserver fires from Gemini's animations do not cause list rebuilds. The list still rebuilds immediately when new questions are added (new message sent), because the fingerprint changes. 168/168 tests pass.

---

## [10.0 — Live Testing Fixes, UI Polish, Context Bar] — 2026-02-22
**Branch:** `docs/v9.6-documentation-sync` | **Commit:** pending

This session covers fixes discovered through live site testing of v10.0 across all 14 supported platforms, plus three categories of UI polish work (size, font, readability), and the first real implementation of the context window usage bar.

---

### isLeftChat Button-Panel Synchronization

**The problem:** On all 7 app-builder platforms using the `left-chat` layout (Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio), the ghost-notch toggle button stayed fixed at the chat/preview boundary when the panel opened. The 320px panel slid out to the left, but the button stayed at its original `right` position, ending up visually stranded inside the panel rather than flush with its left edge.

**Root cause:** The `.open` class in the legacy button CSS only set `pointer-events:auto`. It never modified `right`. The button's `right` position is set by `legacyApplyPosition()` as a JS inline style based on `_lastBoundaryX`. There was no mechanism to update that inline style when the panel opened — the CSS `.open` class can't add a fixed pixel offset to a dynamically-computed inline `right` value.

**Fix — four code sites updated:**

1. `handleLegacyToggle()` open branch: When `legacyNavOpen` becomes true, after adding `.open` to the container, immediately set `container.style.right = (window.innerWidth - _lastBoundaryX + 320) + 'px'`. The `320` equals the panel width, placing the button flush with the panel's left edge.

2. `handleLegacyToggle()` close branch: When `legacyNavOpen` becomes false, restore `container.style.right = (window.innerWidth - _lastBoundaryX + off) + 'px'` where `off = platform.scrollbarOffset || 0`. This brings the button back to its resting position at the chat boundary.

3. Close button `click` handler (inside `injectLegacy()`): Same position restoration as the close branch above — without this, clicking X in the panel left the button floating in space.

4. DOM guardian (the `MutationObserver` callback that re-attaches the container if an SPA rips it out): Added the panel-open check so a re-attached container during an open panel is placed at the correct offset immediately rather than the boundary position.

**Key formula:** `open → right = (innerWidth - boundaryX + 320)px`; `closed → right = (innerWidth - boundaryX + scrollbarOffset)px`. The `+320` is intentionally NOT also applied to the closed state because `scrollbarOffset` already handles any gap needed at the closed position, and the panel width is independent of the scrollbar situation.

---

### Bolt.new Button Overshooting 16px on Panel Open

**The problem:** After the isLeftChat sync fix was applied, Bolt's toggle button was landing ~16px further left than the panel's left edge. The button appeared to overshoot the panel.

**Root cause:** `legacyApplyPosition()` computes `btnRight = window.innerWidth - _lastBoundaryX + offset` where `offset = platform.scrollbarOffset || 0`. Bolt has `scrollbarOffset: 16`. When the panel-open state check was added to `legacyApplyPosition()`, the open-state formula mistakenly included `offset`, making it `right = (innerWidth - boundaryX + 16 + 320)px`. But `scrollbarOffset` exists only to push the closed button inward from the boundary so it clears the OS scrollbar — it has no meaning in the open state where the button is positioned relative to the panel's left edge, not the chat boundary.

**Fix:** In `legacyApplyPosition()`, the open-state calculation uses the boundary alone: `(window.innerWidth - _lastBoundaryX + 320) + 'px'`. The `scrollbarOffset` is only added to `btnRight` (the closed state). Both `handleLegacyToggle()` and `legacyApplyPosition()` were corrected consistently.

---

### V0 Button Invisible in Light Mode

**The problem:** On v0.app in light mode, the toggle button was present (boundary detection worked) but completely invisible — neither the button outline nor the icon was visible against the white page background.

**Root cause — two compounding issues:**

Issue 1: V0's theme had `accent: '#ffffff'` but no `textColor`. The button background was white, and the icon was rendered in the default `theme.textColor || '#fff'` — also white. White icon on white button = invisible.

Issue 2: The legacy left-chat button CSS hardcoded `border:none!important`. V0's theme did have an `accentHover` entry, but no `toggleBorder`. Even if `toggleBorder` had been set on the theme, the hardcoded `!important` on the CSS rule would have overridden it.

**Fix — two changes:**

1. V0 theme definition updated to include `textColor: '#000'` and `toggleBorder: '1px solid rgba(0,0,0,0.2)'`.

2. The isLeftChat `.ai-nav-floating-btn` CSS rule changed from `border:none!important` to `border:' + (theme.toggleBorder || 'none') + '!important'` — making the border use the theme value when provided, or none otherwise. This correctly applies the border for V0 while leaving other left-chat platforms (which don't have a `toggleBorder`) unchanged.

---

### UI Scale Increase (~14%)

**Reason:** Live browser testing showed the orbital dots and their labels appeared small at typical monitor densities. On a 27" monitor at native resolution, the 42px main dot looked like a minor UI element rather than the primary control it is.

**Changes — all size constants increased proportionally:**

| Element | Before | After |
|---------|--------|-------|
| Main dot (show-all, arc center, wheel center) | 42px / fs17 | 48px / fs20 |
| Satellite dots (show-all) | 28px / fs12 | 32px / fs14 |
| Arc slot 0 (focus) | 30px / fs13 | 34px / fs15 |
| Arc slot ±1 (adjacent) | 26px / fs11 | 30px / fs13 |
| Arc slot ±2 (far) | 22px / fs10 | 25px / fs11 |
| Arc slot ±3+ (distant) | 20px / fs9 | 22px / fs10 |
| Arc radius | 76px | 88px |
| Show-all satellite spacing | 42px | 48px |
| Wheel slot ±1 | 28px / fs12 | 32px / fs14 |
| Wheel slot ±2 | 20px / fs9 | 22px / fs10 |
| Wheel HIDDEN size | 14px / fs7 | 16px / fs8 |
| Wheel spacing | 48px | 54px |
| Main dot border-radius | 13px | 14px |

The arc radius increased from 76 to 88 to maintain the arc's visual openness after the dots themselves grew — without this, the larger satellite dots would appear cramped on the arc.

---

### Arc Mode Labels Below Dot (CSS-Only, No JS per Dot)

**The problem:** In arc mode, dot labels appeared to the left of each dot (the default for show-all mode). Because arc dots are positioned in a polygon centered on the right edge, the "left" of adjacent arc dots overlapped with each other's label text, making the system feel cluttered.

**Why not just change label position in JS:** The label element's CSS is set once during `injectOrbital()`. Changing label position per-mode in JS would require either re-rendering labels on mode switch (invalidating a lot of cached DOM references) or setting inline styles per-dot on every `orbRender()` call (mixing style concerns into the layout loop).

**Solution — `data-acn-mode` attribute + CSS attribute selectors:** `orbRender()` now calls `zone.setAttribute('data-acn-mode', orbMode)` at the start of each render. This means the zone element carries `data-acn-mode="arc"` in arc mode, `"show-all"`, or `"wheel"`. CSS attribute selectors target these:

```css
/* Default (show-all, wheel): label appears to the left */
.acn-lbl { right: calc(100% + 10px); ... }

/* Arc: label appears below the dot */
#acn-zone[data-acn-mode="arc"] .acn-lbl {
    right: auto;
    left: 50%;
    top: calc(100% + 5px);
    transform: translateX(-50%) translateY(-4px);
    text-align: center;
}
#acn-zone[data-acn-mode="arc"] .acn-dot:hover .acn-lbl,
#acn-zone[data-acn-mode="arc"] .acn-dot.acn-act .acn-lbl {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
```

The `translateY(-4px)` in the hidden state and `translateY(0)` in the visible state creates a subtle upward-slide entrance animation, consistent with the left-slide animation used in show-all mode. No JS changes required — mode change is a single `setAttribute` call, and CSS handles the rest.

---

### Panel Z-Index Fix: Arc Dots Behind Panel

**The problem:** In arc mode, when a panel is open, the right-side arc dots were visually layered ON TOP of the panel, appearing as floating buttons over the panel content.

**Root cause:** The orbital zone sits at `z-index: 2147483640`. The panel was at `z-index: 2147483639` — one below the zone, meaning it was also below the dots (which are children of the zone). Any dot rendered inside the zone's stacking context would appear above the panel.

**Fix:** Panel z-index raised from `2147483639` to `2147483641`. Now the panel is above the zone (and therefore above its dot children), so arc dots render behind an open panel. The panel slides in from the right and sits cleanly over the dot layer.

---

### Font Unification Across All Platforms

**The problem:** `.acn-dot` and `.acn-lbl` elements had no explicit `font-family` set. They inherited from their parent elements, which was `document.body` or whatever the platform's root element happened to be. Claude used a serif variable font; ChatGPT used its own sans-serif; Replit used a monospace font. The orbital system's emoji icons and labels appeared in radically different typefaces across platforms.

**Why this happened:** The zone element (`#acn-zone`) is injected into `document.body` as a fixed-position overlay. Unlike a shadow DOM, it doesn't inherit a reset stylesheet — it inherits the host site's cascade. The dots themselves are divs with no font set, so they cascade from body.

**Decision:** `system-ui` as primary — it resolves to the OS's native UI font (San Francisco on macOS, Segoe UI on Windows, Ubuntu/Roboto on Linux), giving the script a platform-native appearance without loading a remote font. `Inter` as secondary fallback — provides a high-quality geometric sans-serif for browsers that don't support `system-ui` (older Firefox, some Android WebViews). `sans-serif` as final fallback.

Full stack: `system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif`

Applied to: `.acn-zone` (orbital system root), `.acn-panel` (orbital panels), `#ai-nav-panel` in both legacy panel variants (isLeftChat and standard). By setting it on `.acn-zone`, all child elements (dots, labels, panel contents) inherit it automatically without needing per-element rules.

Font size increases were also applied throughout to improve legibility at the new scale:

| Element | Before | After |
|---------|--------|-------|
| Hover labels | 10px | 12px |
| Panel header h3 | 13px | 15px |
| Question text `.acn-qt` | 11px | 13px |
| Question number `.acn-qn` | 9px | 11px |
| Question summary `.acn-qw` | 9px | 11px |
| Stats bar `.acn-pstat` | 10px | 12px |
| Close button `.acn-xb` | 10px | 12px |
| Context label | 9px | 10px |
| Context percentage | 10px | 12px |
| Search hint | 10px | 12px |
| Search input | 12px | 14px |
| Wheel hint | 9px | 11px |
| Settings platform names | 11px | 13px |
| Reset button | 11px | 13px |
| Empty state | 11px | 13px |

---

### Question List Readability Improvements

**The problem:** Side-by-side comparison of old (v9.x floating panel) vs new (v10.0 orbital panel) showed the question items were harder to navigate in the new design. Three specific issues:

1. Question text (`.acn-qt`) was `color: #999` — medium grey, easy to miss when quickly scanning a list
2. Each question item had `border-left: 2px solid transparent` — the border existed structurally but was invisible at rest, so the list had no visual rhythm; items blended into each other
3. The accent-colored question numbers (`.acn-qn`) and summary text (`.acn-qw`) were too small to read at a glance

**Fixes:**
- `.acn-qt` color changed from `#999` to `#ddd` — near-white, high contrast against the `#1a1a1a` panel background
- `.acn-qi` border-left changed from `transparent` to `rgba(var(--acn-rgb), .25)` — always-visible left border in the platform accent color at 25% opacity. On hover, it transitions to `var(--acn-accent)` at full opacity. This creates a visual cadence through the list without being distracting at rest.
- `.acn-qw` color changed from `#444` to `#666` — visible but subdued; sufficient contrast for secondary metadata text

---

### Context Window Bar Implementation

**The problem:** The context bar in the Navigate panel (showing "—" and an empty fill bar) was a static stub. `orbPopulateNavigate()` built the DOM elements but never called any function to update them. The bar showed "—" for percentage and 0% fill regardless of conversation length.

**Initial approach — user chars × 3:** Estimate total conversation characters by summing `q.text.length` for all items in `_questions[]` (user messages only) and multiplying by 3 to account for AI responses. This was simple but imprecise — AI responses are often much longer than user questions, and the multiplier would be wildly wrong for conversations where the user asks short questions and gets long answers.

**Improved approach — DOM walk to scroll container:** Walk up the DOM from `_questions[0].element` (a known user message node) through its ancestors until finding the first element with `overflow-y: auto` or `overflow-y: scroll`. This is the conversation scroll container — it holds both user and AI messages. Reading `node.innerText.length` from this element gives the total character count for the entire visible conversation (user + AI), not just user messages.

```javascript
var anchor = _questions[0].element;
var node = anchor ? anchor.parentElement : null;
while (node && node !== document.body) {
    var st = window.getComputedStyle(node);
    if (st.overflowY === 'auto' || st.overflowY === 'scroll' ||
        st.overflow  === 'auto' || st.overflow  === 'scroll') {
        totalChars = (node.innerText || '').length;
        found = true;
        break;
    }
    node = node.parentElement;
}
if (!found || totalChars === 0) {
    totalChars = _questions.reduce(function (s, q) { return s + q.text.length; }, 0) * 3;
}
```

The fallback (`_questions` × 3) is kept in case no scroll container is found (e.g., the page uses a non-scrolling layout).

**Token estimation:** `estTokens = Math.round(totalChars / 4)`. The 1 token ≈ 4 characters heuristic is standard for English text.

**Per-platform context limits (`CTX_LIMITS`):**
```javascript
var CTX_LIMITS = {
    claude:     200000,
    chatgpt:    128000,
    grok:       131072,
    gemini:     1000000,
    perplexity: 127072,
};
```
For platforms not in this map (legacy app-builders), falls back to 128,000. The bar shows `estTokens / limit * 100`, clamped to 100%.

**Color coding:** Green (`#22c55e`) below 50%, amber (`#f59e0b`) at 50–74%, red (`#ef4444`) at 75%+. Applied to both the percentage text and the fill bar background.

**Metadata line:** Shows `~3.2K / 200K tokens (estimated)` — the `(estimated)` qualifier is intentional because character-division is an approximation, not exact tokenization.

---

### `orbClosePanel()` Guard in SPA Navigation Handlers

**The problem:** The `history.pushState` override and `popstate` event handler both called `orbClosePanel()` unconditionally. `orbClosePanel` is declared in the outer IIFE scope and has its own `if (!orbPanel) return` guard, so for legacy platforms this was technically a no-op rather than a crash. However, the unconditional call pattern was inconsistent with line 810, which uses `if (typeof orbOnScanComplete === 'function') orbOnScanComplete()`.

**Fix:** Both SPA handlers now use the same guard pattern:
```javascript
if (typeof orbClosePanel === 'function') orbClosePanel();
```
This makes the defensive intent explicit — if a future refactor moved `orbClosePanel` inside `injectOrbital()` (making it undefined in the outer scope), the guard would prevent a real ReferenceError.

---

## [10.0] - 2026-02-22

### Complete Architecture Rewrite — Orbital Button System

**Files modified:** `ai-conversation-navigator.user.js` (2,369 → 1,968 lines), `tests/test-all-platforms.js` (complete rewrite)

This release is a three-phase complete architectural rewrite. The v9.x codebase had accumulated compounding complexity across multiple AI assistant development sessions — the context/token tracking additions in v9.0–9.3 had entangled button injection with message detection, introduced inconsistent rendering patterns, and left behind debugging artifacts throughout the file. Rather than patching on top, the decision was to strip the codebase to its healthy core engine and rebuild the UI layer cleanly.

---

#### Phase 0 — Audit Findings

Read the full 2,369-line v9.x codebase before touching any code. Key findings:

**Entangled button/detection code:** MutationObserver callbacks were wired to trigger both message scanning and button rendering in the same callback path. There was no clean separation between the detection engine (which should run silently) and the UI layer (which should render independently).

**Dead code in Lovable selector chain:** The Lovable `getUserMessages()` function had `div[role="log"] .justify-end` as its primary selector — a pattern that never exists in Lovable's actual DOM. All three real user messages were being found three levels deep in the fallback chain on every call. The dead primary was silently skipped without error, so the detection appeared to work but was always running on backup selectors.

**Version string inconsistency:** The `@version` header read `9.6` but internal version constants in the codebase read `9.3`, `9.4`, or `9.6` depending on which component you were looking at — an artifact of the compressed multi-session sprint development.

**Context tracking architecture:** The v9.0–9.3 context/token tracking button had its own injection path, its own `#ai-context-panel`, and a passive `window.fetch` interceptor that ran on every network request. Removing it cleanly required identifying all three injection paths and their interdependencies.

**Debugging artifacts:** Commented-out selector experiments, temporary `console.log` calls, and redundant guards added during prior debugging sessions.

---

#### Phase 1 — Clean Foundation

**Removed (~1,410 lines):**
- All existing button/sidebar UI: `createToggle()`, `createPanel()`, `buildPanel()`, `buildContextPanel()`, `updateButtonPositions()`, and ~30 related helpers
- The context/token tracking system: fetch interception, DOM-based token estimation, rendering, the `#ai-context-panel` element
- All CSS string constants (`AI_NAV_STYLES`, `CONTEXT_STYLES`, etc.)
- Search panel UI and injection logic (the search algorithm was preserved internally)
- Per-platform button injection quirks added during v9.x debugging
- Dead code, commented experiments, debugging console.log calls

**Kept (the core engine):**
- `PLATFORMS` registry with 14 platform definitions and all `getUserMessages()` selector chains
- `generateSummary()` — text truncation for question display
- `detectPlatform()` — URL-based platform matching
- `scanConversation()` — question detection loop; populates `_questions[]` array as `[{ element, text, summary, vsIndex? }]`
- `MutationObserver` setup for SPA-aware re-scanning
- `history.pushState` / `history.replaceState` SPA hooks
- `window._aiNavAlreadyLoaded` duplicate execution guard
- Virtual scroll accumulation logic for Emergent's virtuoso layout

**Bugs fixed during Phase 1:**
- **Lovable dead selector:** promoted `bg-neutral-200 rounded-xl` to primary position (it was the first selector that actually matched real Lovable DOM). Removed the never-matching `div[role="log"] .justify-end` primary entirely.
- **Version string:** unified to `10.0` throughout header and internals.

**Result:** 2,369 → 959 lines. The script detected platforms and found questions but rendered no UI at all.

---

#### Phase 2 — Orbital Button System

Built the new UI as a clean fixed-position overlay on top of the Phase 1 engine. The orbital zone (`div#acn-zone`) is injected into `document.body` and is architecturally independent of each platform's DOM structure.

**Color system (`ORB_COLORS`):** Five verified platform accent colors. App-builder platforms (bolt, lovable, replit, v0, base44, emergent, firebase) fall back to Claude orange since their brand colors were not verified at time of writing.
```javascript
var ORB_COLORS = {
    claude:     { bg: '#d97706', rgb: '217,119,6',   shadow: 'rgba(217,119,6,.25)'   },
    chatgpt:    { bg: '#ffffff', rgb: '255,255,255', shadow: 'rgba(255,255,255,.25)' },
    grok:       { bg: '#e53e3e', rgb: '229,62,62',   shadow: 'rgba(229,62,62,.25)'   },
    gemini:     { bg: '#4285f4', rgb: '66,133,244',  shadow: 'rgba(66,133,244,.25)'  },
    perplexity: { bg: '#20b2aa', rgb: '32,178,170',  shadow: 'rgba(32,178,170,.25)'  },
};
var orbTheme = ORB_COLORS[platform.id] || ORB_COLORS.claude;
```

**Feature registry (`ORB_FEATURES`):** Single source-of-truth array drives slot positions, panel IDs, icons, and labels. Adding a 7th feature requires one array entry and one panel builder function — no other code changes.
```javascript
var ORB_FEATURES = [
    { id: 'nav',       icon: '✳', label: 'Navigate',  panelId: 'acn-panel-nav'       },
    { id: 'search',    icon: '⌕', label: 'Search',    panelId: 'acn-panel-search'    },
    { id: 'bookmarks', icon: '⚑', label: 'Bookmarks', panelId: 'acn-panel-bookmarks' },
    { id: 'summary',   icon: 'Σ', label: 'Summary',   panelId: 'acn-panel-summary'   },
    { id: 'export',    icon: '↗', label: 'Export',    panelId: 'acn-panel-export'    },
    { id: 'settings',  icon: '⚙', label: 'Settings',  panelId: 'acn-panel-settings'  },
];
```

**Three display modes (`orbMode`):**
- `show-all` — all 6 dots at equal opacity on hover; vertical stack; default mode
- `arc` — slot-rule lookup table drives position along a polygon arc; scroll wheel rotates focus; brightness follows slot position
- `wheel` — conveyor belt wrapping; Navigate dot (index 0) gets a persistent brightness boost; symmetric boundary behavior on wrap

**CSS transition split — critical for feel:** Two separate CSS transitions per dot:
- `opacity 80ms ease` — snaps immediately, so brightness feels locked to the dot's current position
- `transform/position 300ms cubic-bezier(0.34, 1.56, 0.64, 1)` — springy motion for position changes

Without this split, opacity would animate across the full 300ms of the position animation, making brightness "chase" the moving dot rather than snap to it. The 80ms opacity transition was the single most important tuning decision for making the system feel responsive rather than floaty.

**Left-chat platform positioning:** For the 6 app-builder platforms with a split chat/preview layout (bolt, lovable, replit, v0, base44, emergent), `getChatBoundaryX()` locates the right edge of the chat panel. `orbPositionForLeftChat()` computes `zone.style.right = viewport.width - boundary.right + 'px'`, placing the orbital cluster exactly at the chat/preview divider rather than at the viewport edge.

**Settings persistence:** `localStorage._acnv10` stores `{ mode, natural }`. Survives page refreshes and SPA navigation.

**Defensive injection guards:**
- `orbInjectCSS()` checks `document.getElementById('acn-style')` and returns early if already present — prevents CSS duplication on SPA re-inject cycles where `injectOrbital()` is called again on route change
- `injectOrbital()` runs `document.querySelectorAll('.acn-panel').forEach(p => p.remove())` before building new panels — cleans up orphaned panels from a previous injection cycle that may have been disconnected from the zone but not garbage collected

**Panel implementation status at v10.0:**
- Navigate: Fully functional — lists detected questions, click scrolls to message
- Search: Functional — text input filters `_questions[]` by content
- Settings: Functional — mode selector (show-all / arc / wheel), scroll direction toggle
- Bookmarks, Summary, Export: Placeholder UI only (non-functional, for future sprints)

---

#### Phase 3 — Contract-Based Test Suite

**Problem with old tests:** The existing `tests/test-all-platforms.js` was written against v9.x internal element IDs (`#ai-nav-button-container`, `#ai-nav-panel`, `.ai-nav-item`). These selectors broke immediately on the v10.0 rewrite. The first v10.0 rewrite of the tests still used internal IDs (`#acn-zone`, `#acn-dot-nav`, `.acn-qi`) — these would break again on v11.0. The root problem was tests coupling to implementation details rather than a stable interface.

**Solution — DOM contract via `data-acn-*` attributes:** The script publishes 9 stable role attributes on key elements. Tests query ONLY these attributes. The UI can be completely rebuilt in any future version — as long as the script assigns the 9 role attributes to the corresponding elements, the test suite passes without modification.

| Attribute | Set on | Behavior |
|-----------|--------|----------|
| `data-acn-role="zone"` | `#acn-zone` container | Presence confirms injection |
| `data-acn-role="styles"` | `<style>` element | CSS injection confirmed |
| `data-acn-role="nav-trigger"` | Navigate dot | Click target for tests |
| `data-acn-role="nav-panel"` | Navigate panel | Panel presence confirmed |
| `data-acn-role="nav-stat"` | Stats element | Also carries `data-acn-count="N"` |
| `data-acn-role="nav-list"` | Question list container | List structure confirmed |
| `data-acn-role="nav-item"` | Each question row | Count compared to mock page messages |
| `data-acn-role="nav-item-text"` | Question display text | Non-empty confirmed |
| `data-acn-role="panel-close"` | All close buttons | Close behavior tested |
| `data-acn-version="10.0"` | Zone | Version identification |
| `data-acn-accent="#hexcolor"` | Zone | Platform theme color confirmed |
| `data-acn-open="true"` | Open panels | State attribute, removed on close |

**Test structure:** 14 platforms × 12 tests = 168 total. Platform config contains only contract-facing fields: `{ name, mockFile, hostname, pathname, expectedMessages, expectedAccent }`. No internal CSS class names, no `isLeftChat` flag, no implementation-specific fields.

**12 tests per platform:**
1. Zone exists
2. Styles element exists
3. Navigate trigger exists
4. Navigate panel exists
5. Accent color matches platform spec
6. No duplicate zone (count === 1)
7. Clicking trigger sets `data-acn-open="true"` on panel
8. `data-acn-count` equals mock page's expected message count
9. `[data-acn-role="nav-item"]` count equals expected messages
10. All item texts are non-empty
11. Clicking an item doesn't throw
12. Close button removes `data-acn-open`

**Result:** 168/168 tests passing (Chromium).

---

## [9.6] - 2026-02-22

### Security — Trusted Types Compliance Refactor
**Problem:** The v9.4 search renderer used `innerHTML` to update results. In strict Content Security Policy (CSP) environments that enforce Trusted Types (like modern Claude or ChatGPT), this caused the script to crash immediately upon execution.

**Resolution:** Refactored the `executeConversationSearch` function to use programmatic DOM APIs (`createElement`, `textContent`) for all rendering. The script now assembles result items as a safe DOM tree instead of injecting raw HTML strings, making it fully compatible with secure-by-default browser policies.

### Fixed — Bolt.new Visibility Architecture & Left-Chat Sync
**Problem:** 
1. The AI Nav button was invisible on Bolt.new because it incorrectly detected a hidden CodeMirror editor as the chat boundary, placing the button off-screen.
2. App-Builder buttons (Bolt, Lovable, Replit) "snapped" instantly instead of animating when the panel opened.
3. Scrolling the chat window while the Search Panel was open would cause the buttons to violently snap shut.

**Method:**
- **Inward-Pointing Geometry:** Redesigned the `left-chat` button container to anchor to the boundary's `right` edge (viewport-relative) instead of `left`, ensuring it expands outward into the preview pane.
- **CodeMirror Filtering:** Updated `getChatBoundaryX` to filter out non-visible or off-screen elements during boundary detection.
- **Scrollbar Compensation:** Added a `scrollbarOffset: 16` to the Bolt platform profile to prevent native OS scrollbars from occluding the UI.
- **Animation Sync:** Added `transition: right` to the button container CSS to match the panel's expansion timing.

---

## [9.4] - 2026-02-22

### Added — Universal Conversation Search

**Problem:** Users wanted to quickly locate specific keywords or topics discussed previously in a very long conversation, without aimlessly scrolling.

**Method:** 
Instead of writing and maintaining 14 different platform-specific web scrapers to target and differentiate AI responses from user responses, the v9.4 engine uses a universal DOM `TreeWalker`.
1. It traverses all `NodeFilter.SHOW_TEXT` nodes in the `<main>` HTML body.
2. It excludes nodes inside `<script>`, `<style>`, and any of our injected `#ai-nav-panel` trees.
3. If the active text matches the case-insensitive search query, it resolves that node's parent block.
4. **Dynamic Role Mapping:** To figure out who said the word without platform-specific rules, the tool dynamically iterates over the elements returned by `platform.getUserMessages()`. If the match's parent aligns inside any of those elements, the block is tagged uniquely as "Question". If it falls anywhere else in the document, it is deduced as an "Answer" from the AI agent.

**Resolution:** 
A 3rd button "🔍 Search" was added to the floating UI stack. Clicking opens a new `#ai-search-panel` containing a 300ms debounced input field. Entering queries builds a formatted, scrollable list of 80-character snippet windows centered around the actively yellow-highlighted word. Clicking smoothly scrolls the viewport to that exact conversation block and flashes the background momentarily.

---

## [9.3] - 2026-02-22

### Refactored — Context Tracker Dedicated Panel & Button UI Redesign

**Problem:** The addition of the Context feature in v9.0 crammed too much interface into the question navigation panel. The single floating button required users to blindly click to understand its purpose.

**Method:**
Refactored the singular floating toggle into a modular stacked `#ai-nav-button-container`. 
- **Isolated Panels:** The Context Tracker was separated entirely from the Navigation panel into its own `#ai-context-panel`, triggered exclusively by a dedicated "bar chart" button.
- **Uniform Styling:** All button styles were converged into a `.ai-nav-floating-btn` class. Fixed pixel-widths were enforced (48px collapsed, 127px expanded) overriding variable emoji font metrics to ensure perfectly flush stack bounds.
- **Hover Bridges & Synchronization:** The distance between the stacked buttons was reduced to `2px`. More importantly, an invisible `::after` pseudo-element was injected expanding outward from the buttons. 
- When an active panel (like Navigation) is open, hovering the button stack expands ALL feature buttons continuously. The `::after` hover bridges allow the user's cursor to physically traverse the 2px gap between the buttons without triggering a `mouseleave` collapse loop.

**Resolution:** Users now experience a premium, synchronized 3-button stack capable of seamless cross-toggling, completely protected against sudden dropping when crossing the button gap boundaries.

---

## [9.0] - 2026-02-22

### Added — Context & Token Tracking (Claude, ChatGPT, Grok, Gemini)

**Problem:** Users had no visibility into how much of a chat's context window was consumed, so degradation or truncation could happen without warning.

**Root cause:** Platform frontends do not provide a stable, user-visible context telemetry surface in the DOM by default.

**Method:** Implemented a two-tier approach in the sidebar:
- Tier 1 (default): DOM-based estimation by counting all visible user + assistant text, converting chars to tokens (`0.25` tokens/char), and adding a `10K` system/formatting buffer.
- Tier 2 (experimental, Claude-only): passive `window.fetch` interception of streaming SSE events to capture real `input_tokens`/`output_tokens` when available.

**Resolution:** Added a context indicator UI for Claude (`200K`), ChatGPT (`128K`), Grok (`128K`), and Gemini (`1M`) showing:
- 10-segment usage bar with threshold coloring (green/yellow/orange/red)
- token usage text (`~` prefix for estimates, no prefix for intercepted real data)
- high-usage warnings at `80%+`
- tooltip explaining estimation limits

Other supported platforms remain unchanged and do not show the context bar.

---

## [8.0] - 2026-02-18

### Refactored — Platform Registry Architecture

Major internal refactor: consolidated all scattered platform-specific logic into a single `PLATFORMS` registry object. **No user-facing behavior changes.** All 140 tests pass (14 platforms × 10 tests) — zero regressions.

#### What Changed

**Before (v7.8):** Platform data was scattered across 10+ separate locations:
- `SITE` enum object
- `detectSite()` function (hostname → constant mapping)
- `THEME` object (colors per platform)
- `ICONS` object (Unicode symbols per platform)
- `siteTitles` object (display names per platform)
- `LEFT_CHAT_SITES` array
- `VIRTUAL_SCROLL_SITES` array
- `SPA_SITES` array
- `getUserMessages()` — a 400-line `if/else if` chain with 13 branches
- Inline conditionals for scrollbar offsets, path guards, retry delays, boundary selectors, text extractors, and boundary strategies

Adding a new platform required touching 10+ locations and keeping them all in sync.

**After (v8.0):** One `PLATFORMS` registry at the top of the file holds everything per-platform:

```javascript
const PLATFORMS = {
    claude: {
        id: 'claude',
        title: 'Claude',
        match: function (host) { return host.includes('claude.ai'); },
        theme: { accent: '#d97706', accentHover: '#b45309', ... },
        icon: '\u2733',
        layout: 'standard',
        virtualScroll: false,
        spa: false,
        scrollbarOffset: 0,
        boundarySelectors: null,
        boundaryStrategy: null,
        pathGuard: null,
        initGuards: [],
        retryDelays: [],
        textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
        textExtractor: null,
        getUserMessages: function () { ... },
    },
    // ... 12 more platforms
};
```

**Adding a new platform now requires adding ONE entry** to the `PLATFORMS` object — nothing else to touch (plus the `@match` URL in the userscript header).

#### Migration Details

| Old Location | New Location | Notes |
|---|---|---|
| `SITE` enum | Removed — `platform.id` replaces `SITE.X` constants | Dead code, no remaining references |
| `detectSite()` | `detectPlatform()` | Iterates `PLATFORMS` and calls each platform's `match()` function |
| `THEME[site]` | `platform.theme` | Bridge variable `theme = platform.theme` kept for readability |
| `ICONS[site]` | `platform.icon` | Bridge variable `siteIcon = platform.icon` kept |
| `siteTitles[site]` | `platform.title` | Bridge variable `siteTitle = platform.title` kept |
| `LEFT_CHAT_SITES.includes(site)` | `platform.layout === 'left-chat'` | Bridge variable `isLeftChat` kept |
| `VIRTUAL_SCROLL_SITES.includes(site)` | `platform.virtualScroll` | Bridge variable `isVirtualScroll` kept |
| `SPA_SITES.includes(site)` | `platform.spa` | Used directly |
| `getUserMessages()` if/else chain | `platform.getUserMessages()` | 400 lines → 1-line dispatcher |
| Inline scrollbar offset | `platform.scrollbarOffset` | |
| Inline path guard | `platform.pathGuard` | |
| Inline retry delays | `platform.retryDelays` | |
| Inline boundary selectors | `platform.boundarySelectors` | |
| Inline boundary strategy | `platform.boundaryStrategy` | |
| Inline text extractor | `platform.textExtractor` | |
| CSS ternaries for toggleBorder/numberColor | `theme.toggleBorder`, `theme.numberColor` | |

#### Bridge Variables Retained

Five bridge variables remain as readable aliases — they are used 50+ times downstream and removing them would hurt readability without functional benefit:

```javascript
const theme = platform.theme;
const siteIcon = platform.icon;
const siteTitle = platform.title;
const isLeftChat = platform.layout === 'left-chat';
const isVirtualScroll = platform.virtualScroll;
```

#### Dead Code Removed

- `SITE` enum object (12 string constants)
- `currentSite` variable
- The entire 400-line `getUserMessages()` if/else if chain (replaced by per-platform methods)

#### Testing

All 140 tests pass on Chromium (14 platforms × 10 tests per platform). No selector changes — all DOM selectors are identical to v7.8.

#### Net Line Count

The file grew slightly due to the registry structure overhead, but the `getUserMessages()` function shrank from ~400 lines to 3 lines. The net effect is better locality — all platform data is in one place rather than scattered across 10+ locations.

---

## [7.8] - 2026-02-16

### Fixed — Firebase Studio: Script Injecting into Wrong Iframe (0 Questions Detected)

Firebase Studio was the only platform where the navigator detected 0 questions despite chat messages being present in the DOM. This turned out to be a unique cross-origin iframe injection problem — fundamentally different from all other platform bugs we've encountered, which were selector/DOM structure issues. Firebase Studio's bug was that the script never reached the DOM with chat messages at all.

#### What It Looked Like

On `studio.firebase.google.com`, the navigator showed 0 questions. The toggle button appeared (in one iframe instance), but clicking it showed "No messages found." Console logs showed the script loaded and ran retry scans at 5s, 10s, and 20s — all finding 0 messages. Meanwhile, manually running `document.querySelectorAll('[class*="_chatMessage_"]')` in the correct iframe context returned 4 elements. The selectors were correct; the script was running in the wrong place.

#### Firebase Studio's Iframe Architecture

Firebase Studio is unlike any other supported platform. While most AI chat sites render everything in a single top-level document, Firebase Studio uses a multi-layer iframe architecture:

```
Top frame: studio.firebase.google.com (shell — ~157 DOM elements, no chat UI)
  ├── iframe #0: about:blank
  ├── iframe #1: 6000-firebase-studio-{id}.cluster-{hash}.cloudworkstations.dev/capra/...
  │     (THE WORKSPACE — contains app preview + chat panel + all chat DOM elements)
  │     └── nested iframe: 6000-firebase-studio-{id}.cluster-{hash}.cloudworkstations.dev/
  │           (APP PREVIEW — renders the user's app, e.g. FridgeChef)
  ├── iframe #2: firebase-studio-{id}.cluster-{hash}.cloudworkstations.dev/env/msg/...
  │     (MESSAGING ENDPOINT — blank page, no chat UI, used for internal communication)
  └── iframe #3: accounts.google.com/... (Google auth)
```

Key observations:
- The top frame (`studio.firebase.google.com`) is just a shell — it contains the Firebase Studio chrome (sidebar, tabs) but zero chat elements
- The actual chat UI with `_chatMessage_` and `_isUser_` CSS module classes lives in iframe #1
- iframe #1 uses a **port-prefixed** hostname: `6000-firebase-studio-...cloudworkstations.dev` (port 6000 mapped to the workspace)
- iframe #2 uses a **non-port-prefixed** hostname: `firebase-studio-...cloudworkstations.dev` (the `/env/msg` messaging endpoint)
- iframe #1 also contains a **nested iframe** for the app preview, on the same `cloudworkstations.dev` domain

This architecture created three distinct bugs that all needed fixing.

#### Bug 1: Tampermonkey `@match` Not Matching Port-Prefixed Hostnames

**Root cause:** The v7.7 script had `@include https://firebase-studio-*.cloudworkstations.dev/*` which uses Tampermonkey's glob matching. The `*` in glob mode matches any characters, but the pattern required the hostname to START with `firebase-studio-`. The actual workspace iframe has hostname `6000-firebase-studio-...cloudworkstations.dev` — it starts with `6000-`, not `firebase-studio-`.

**How we confirmed this:** Navigated directly to the `6000-firebase-studio-...` URL in the browser, checked the Tampermonkey icon — it showed "no script running." This confirmed the `@include` pattern wasn't matching.

**Fix:** Replaced the narrow `@include` with two broader rules:
```
// @match        https://*.cloudworkstations.dev/*
// @include      https://*cloudworkstations.dev/*
```
Both `@match` (Chrome match pattern) and `@include` (glob pattern) are needed because `@match` alone was not matching the port-prefixed hostname in testing (possibly a Tampermonkey implementation detail with very long subdomain strings). The `@include` glob `*cloudworkstations.dev` matches any hostname ending in `cloudworkstations.dev`, regardless of prefix.

**What we initially tried that didn't work:**
- `@match https://*.cloudworkstations.dev/*` alone — Tampermonkey showed no script running on the 6000- URL despite this pattern theoretically matching. We kept it as defense-in-depth but added `@include` as the reliable fallback.

#### Bug 2: `detectSite()` Regex Rejecting Port-Prefixed Hostnames

**Root cause:** Even after fixing the injection, `detectSite()` used `/^firebase-studio-/.test(hostname)` which requires the hostname to START with `firebase-studio-`. The workspace hostname `6000-firebase-studio-...cloudworkstations.dev` starts with `6000-`, so the regex returned false, and `detectSite()` returned `null` — causing the script to exit with "Unknown site."

**Fix:** Changed from a start-anchored regex to an includes check:
```javascript
// Before (v7.7):
if (hostname.includes('cloudworkstations.dev') && /^firebase-studio-/.test(hostname)) return SITE.FIREBASE_STUDIO;

// After (v7.8):
if (hostname.includes('cloudworkstations.dev') && hostname.includes('firebase-studio-')) return SITE.FIREBASE_STUDIO;
```

The trailing `-` in `firebase-studio-` is intentional — it distinguishes the hostname component from any other use of the string "firebase-studio" (e.g., in CSS module class names).

#### Bug 3: Script Running in Multiple Wrong Iframes (Duplicate Buttons)

After fixing Bugs 1 and 2, the script successfully ran in the workspace iframe — but it also ran in every OTHER `cloudworkstations.dev` iframe, creating duplicate buttons:

**Duplicate source 1: The `/env/msg` messaging endpoint** (iframe #2). This iframe has `firebase-studio-` in its hostname and is on `cloudworkstations.dev`, so it matched both `@include` and `detectSite()`. But it's a blank messaging endpoint with 0 chat elements. The script created a toggle button here that floated over the main page.

**Duplicate source 2: The app preview** (nested inside iframe #1). The workspace iframe embeds the user's app in a sub-iframe. This sub-iframe is also on `6000-firebase-studio-...cloudworkstations.dev` (same domain as the workspace), so it matched everything. The script created a second toggle button inside the app preview area.

**How we confirmed the duplicates:** Ran `document.querySelectorAll('iframe').forEach((f, i) => console.log(i, f.src))` from the workspace iframe context. Found one nested iframe on the same `cloudworkstations.dev` domain. Console also showed "AI Conversation Navigator v7.8 loaded for Firebase Studio!" appearing twice.

**What we tried first that partially worked:**
1. **Skip `/env/` paths:** Added `if (pathname.startsWith('/env/')) return;` — this fixed the /env/msg duplicate but not the app preview duplicate.
2. **Check `window.parent !== window.top`:** The app preview is a sub-sub-iframe (nested inside the workspace, which is nested inside the top frame). So `window.parent !== window.top` is true for the app preview when accessed via `studio.firebase.google.com`. But when the user navigates directly to the `6000-` URL (making the workspace the top frame), the app preview becomes a direct child of the top frame, and `window.parent === window.top` — so this check failed in that scenario.

**Final fix:** The workspace iframe always has `/capra/` in its URL path. The app preview has `/` and the messaging endpoint has `/env/msg`. This is the reliable discriminator regardless of iframe nesting depth:

```javascript
// Firebase Studio: multiple iframes on cloudworkstations.dev match our @include rule
// (workspace, app preview, /env/msg endpoint). Only the workspace has the chat UI,
// and its path always starts with /capra/. Skip all other cloudworkstations.dev iframes.
if (currentSite === SITE.FIREBASE_STUDIO &&
    window.location.hostname.includes('cloudworkstations.dev') &&
    !window.location.pathname.startsWith('/capra/')) {
    console.log('AI Conversation Navigator: Firebase Studio non-workspace iframe, skipping.');
    return;
}
```

This single check replaces the previous nested if/try-catch approach and works in all scenarios:
- **Normal access** (via `studio.firebase.google.com`): Top frame skipped by existing check. Workspace iframe (`/capra/`) runs. App preview (`/`) skipped. `/env/msg` iframe skipped.
- **Direct access** (navigating to `6000-` URL): Workspace becomes top frame and runs. App preview (`/`) skipped.

#### Red Herring: `window._aiNavAlreadyLoaded` Returning `undefined`

During debugging, we checked `window._aiNavAlreadyLoaded` in the iframe console to see if the script had run. It returned `undefined` in ALL contexts — even the one where the script was clearly running (console logs visible). This led us to initially think the script wasn't running anywhere.

**Why this happened:** Tampermonkey's `@grant GM_addStyle` puts the script in a sandboxed execution environment. The script's `window` is a Tampermonkey sandbox proxy, not the page's real `window` object. So `window._aiNavAlreadyLoaded = true` sets the flag on the sandbox window, while `window._aiNavAlreadyLoaded` typed in the DevTools console reads from the page's real window — they're different objects.

**Lesson learned:** On Tampermonkey scripts with `@grant` directives, console log messages are the reliable indicator of script execution, not `window` property checks from DevTools.

#### Why This Problem Is Unique to Firebase Studio

Every other supported platform renders its chat UI in the top-level document. Even platforms with complex layouts (Bolt's split pane, Replit's IDE panels, Emergent's virtual scroller) keep the chat DOM in the same document that the script naturally injects into. Firebase Studio is the only platform that:
1. Puts the chat in a cross-origin iframe (requiring `@include`/`@match` for a different domain)
2. Has multiple iframes on the same domain with different purposes (workspace vs messaging vs app preview)
3. Uses port-prefixed subdomains that break standard URL pattern matching
4. Nests iframes inside iframes on the same domain

This combination means the typical Tampermonkey pattern of "match a URL, detect the site, inject the UI" isn't sufficient. Firebase Studio requires explicit iframe discrimination logic that no other platform needs.

#### Summary of All Firebase Studio Skip Logic (v7.8)

The script has three Firebase Studio-specific guards, executed in order:

| Guard | Condition | What it catches |
|-------|-----------|----------------|
| **Top frame skip** | `window === window.top` AND hostname is `studio.firebase.google.com` | The top frame shell (no chat content) |
| **Non-workspace skip** | hostname includes `cloudworkstations.dev` AND path doesn't start with `/capra/` | App preview (`/`), messaging endpoint (`/env/msg`), any other cloudworkstations.dev iframe |
| **(implicit)** | `detectSite()` returns null | Any cloudworkstations.dev iframe without `firebase-studio-` in hostname (e.g., other Google Cloud Workstations) |

#### Test Updates

Updated `tests/test-all-platforms.js` Firebase Studio test config:
- Changed `hostname` from `firebase-studio-12345.cluster-abc123.cloudworkstations.dev` to `6000-firebase-studio-12345.cluster-abc123.cloudworkstations.dev` (port-prefixed, matching real workspace)
- Changed `pathname` from `/` to `/capra/` (matching real workspace path)

All 140 tests pass (14 platforms × 10 tests).

---

## [7.6] - 2026-02-15

### Fixed — Replit: 3x Duplicate Questions + Ghost Notch Button Not Appearing on First Load

Two bugs fixed by replacing incorrect selectors with ones derived from live DOM inspection.

#### Bug 1: Each Question Appeared 3 Times in the Navigation Panel

**Root cause:** All four primary selectors failed because Replit uses `data-cy` (Cypress test attribute), NOT `data-testid`:
- `[data-testid*="user-message"]` → 0 matches (wrong attribute name)
- `[data-message-role="user"]` → 0 matches (doesn't exist)
- `[data-role="user"]` → 0 matches (doesn't exist)
- `[data-author="user"]` → 0 matches (doesn't exist)

Since all primaries returned 0, the dedup logic was skipped entirely (it only runs when `messages.length > 0`). Then Fallback 1 fired: `[class*="userMessage"], [class*="UserMessage"]`, which matched **3 nested elements per user message**:

```
A: div.EventRenderer-module_RTGgnG_userMessage       ← matches [class*="userMessage"] (outermost)
  B: div[data-cy="user-message"]                     ← THE CORRECT TARGET (no userMessage in class)
    C: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades  ← matches (middle)
      D: span
        E: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades  ← matches (innermost)
          F: div.rendered-markdown
            G: div.Markdown-module_KWqogW_markdownTheme
              H: <p>actual text</p>
```

Elements A, C, and E all contain "userMessage" in their CSS module class names. No dedup ran on these fallback results, so all 3 were shown per question.

**Fix:** Changed primary selector to `[data-cy="user-message"]`, which targets element B — exactly one per user message. Added `[data-event-type="user-message"]` as secondary (same element, alternate attribute). Restructured fallback chain with proper dedup as safety net.

#### Bug 2: Ghost Notch Button Not Appearing on First Page Load

**Root cause:** In `getChatBoundaryX()` Strategy 2, the Replit message selector was `[data-testid*="user-message"]` — same wrong attribute. Strategy 2 found no messages → couldn't walk up to the chat container → returned null → button stayed hidden. After a page refresh, the SPA rendered faster from cache and Strategy 1 (textarea walkup) or Strategy 3 (iframe detection) succeeded.

**Fix:** Updated Strategy 2's Replit selector to `[data-cy="user-message"], [data-event-type="user-message"]`.

#### Mock Test Page Updated

Rewrote `tests/mock-pages/replit.html` to match the real Replit DOM structure:
- Full A→H nesting hierarchy with CSS module classes
- `data-cy="user-message"` and `data-event-type="user-message"` attributes
- Double `UserMessage-module` elements (C and E) that caused the 3x bug
- `EventRenderer-module` with `userMessage` in class name
- `AutoScroller-module` container wrapper
- All 140 tests pass (14 platforms × 10 tests)

V0 and Emergent were fixed in v7.7 (see below). `DOM-REFERENCE.md` created with real DOM structures of all platforms.

---

## [7.7] - 2026-02-15

### Fixed — V0: 0 Questions Detected + Button Invisible Until Refresh

**Root cause (message detection):** ALL 6 primary selectors were guesses that don't exist in V0's DOM:
- `[data-role="user"]` — doesn't exist
- `[data-message-role="user"]` — doesn't exist
- `[data-message-author-role="user"]` — doesn't exist
- `[data-message-author="user"]` — doesn't exist
- `[data-testid*="user-message"]` — actual value is `"message"` (no "user" in it)
- `[data-sender="user"]` — doesn't exist

ALL 6 fallbacks also failed because V0 doesn't use the alignment classes our fallbacks relied on:
- No `justify-end`, `self-end`, `ml-auto` — V0 uses `items-end`, `origin-right` instead
- No `bg-muted`, `bg-secondary` — V0 uses `bg-v0-gray-200`
- No `[data-message-id]` — V0 uses regular `id` attribute with hash

**Root cause (button invisible):** Boundary detection Strategy 2 used `[data-role="user"]` which also doesn't exist. No boundary found → `getChatBoundaryX()` returns null → `.ai-nav-positioned` class never added → opacity stays at 0. Button only appeared after page refresh when Strategy 1 (textarea walkup) succeeded on faster SPA re-render.

**Fix (message detection):** Replaced entire V0 selector chain with approach based on live DOM inspection:
```javascript
// Primary: data-testid="message" filtered by origin-right (user = right-aligned)
var v0MsgAll = document.querySelectorAll('[data-testid="message"]');
messages = Array.from(v0MsgAll).filter(function(el) {
    var cls = el.className || '';
    return cls.includes('origin-right') && cls.includes('items-end');
});
```
V0 uses `data-testid="message"` on ALL messages (user + AI). User messages have `origin-right items-end` classes; AI messages have `origin-left items-start`. Filtering by both classes reliably distinguishes user messages.

Fallback chain:
1. `items-end` only (in case `origin-right` changes)
2. Bubble class `bg-v0-gray-200` / `group/message-bubble`
3. `role="listitem"` with alignment check

**Fix (button invisible):** Updated boundary detection selector to `[data-testid="message"]`.

**Mock page rewritten:** `tests/mock-pages/v0.html` now matches real V0 DOM — includes `data-testid="message"` with `origin-right items-end` for user messages and `origin-left items-start` for AI messages, full A→I nesting with `@container/message`, `group/message-bubble`, `bg-v0-gray-200`, and copy buttons that should NOT be detected.

### Fixed — Emergent: Ghost Notch Button Invisible (Two Root Causes)

The Emergent ghost notch button stayed at `opacity: 0` indefinitely, never transitioning to the resting `opacity: 0.35`. This had two independent root causes that both needed fixing.

**Root cause 1 — Boundary detection failure:** The standard `_walkUpToChatContainer()` walks up from a message element looking for a container with `width < 65% viewport`. Emergent uses `div.absolute.inset-0` as a layout container, which inherits full viewport width from its flex parent. Walking up past this element hits full-width ancestors that fail the width check → `getChatBoundaryX()` returns null → `.ai-nav-positioned` never added → opacity stays at 0.

**Root cause 2 — Periodic interval killing stability:** The 3-second periodic boundary check was resetting `_lastBoundaryX = null` before each call to `updateLeftChatPositions()`. The two-consecutive-stable-polls requirement could never be met via the interval because the first poll always compared against null (treated as unstable). Even if boundary detection eventually succeeded after the page fully rendered, the reset killed it.

**Fix 1 — Emergent-specific boundary detection:** Added a new branch at the top of `getChatBoundaryX()` that bypasses `_walkUpToChatContainer` entirely for Emergent:
```javascript
if (currentSite === SITE.EMERGENT) {
    var virtuosoScroller = document.querySelector(
        '[data-testid="virtuoso-scroller"], [data-virtuoso-scroller="true"]'
    );
    if (virtuosoScroller) {
        var vsRect = virtuosoScroller.getBoundingClientRect();
        if (vsRect.width > 200 && vsRect.width < window.innerWidth * 0.75
            && vsRect.height > window.innerHeight * 0.3) {
            return vsRect.right;
        }
    }
}
```
The virtuoso scroller `div` has a reliable `data-testid` attribute and its bounding rect directly represents the chat panel's dimensions.

**Fix 2 — Removed periodic `_lastBoundaryX` reset:** The `_lastBoundaryX = null` line was removed from the periodic interval. This allows late-rendering platforms to eventually achieve two consecutive stable polls, even if the boundary detection only starts working after initial page load completes.

### Fixed — Emergent: Reverted Opacity Band-Aid

A previous agent session increased Emergent's resting opacity from 0.35 to 0.75 and width from 8px to 14px as a workaround for the invisible button. Now that the actual root cause is fixed (boundary detection), the band-aid was reverted:
- Removed conditional `opacity: ${currentSite === SITE.EMERGENT ? '0.75' : '0.35'}` → now uses `0.35` for all platforms
- Removed conditional `width: 14px !important` override → now uses default `8px` for all platforms

### Fixed — Emergent: Question List Changing on Scroll (Virtual Scroll Architecture)

**What it looked like:** As the user scrolled through the chat, the navigation panel showed different questions appearing and disappearing. Many of the shown items were NOT user questions at all — they were AI agent status messages like "Backend is running", "Good progress!".

**Root cause:** Emergent uses **virtuoso virtual scrolling** — only DOM elements currently visible in the viewport exist in the DOM. Elements are recycled as the user scrolls. This caused two problems:

1. The 10-second periodic re-scan cleared and rebuilt the question list each time. When user messages scrolled out of view, the primary selector (`[data-testid^="user-message"]`) returned 0 results.
2. With 0 primary results, broad fallback selectors (3-7: `rounded-br-none`, `items-end`, `text-wrap`, `select-text`, chat container scan) fired and matched AI agent content that was currently visible.

**Why this only affects Emergent:** All other supported platforms keep all messages in the DOM regardless of scroll position. Emergent is the only platform using virtuoso virtual scrolling.

**Fix — Three-part approach:**

1. **Removed broad Emergent fallbacks 3-7:** Only the primary selector (`[data-testid^="user-message"]`) and ID-based fallback (`[id^="user-task"]`) remain. This prevents AI content from ever being matched.

2. **Added accumulative scanning for virtual scroll platforms:**
   ```javascript
   const VIRTUAL_SCROLL_SITES = [SITE.EMERGENT];
   const isVirtualScroll = VIRTUAL_SCROLL_SITES.includes(currentSite);
   var _vsAccumulatedKeys = new Set();
   ```
   In accumulation mode, `scanConversation()` adds newly discovered messages to the existing list without clearing it. Deduplication uses a text key (first 200 chars, normalized). The Refresh button does a full reset via `scanConversation(true)`. SPA navigation also clears the accumulated set.

3. **Stale DOM reference handling:** When the user clicks a nav item, the originally captured DOM element may have been recycled by virtuoso. The click handler checks `msg.isConnected` and, if stale, re-searches the current DOM for a matching element by text content. If the target message isn't currently in the DOM (scrolled far away), the click is silently ignored.

### Fixed — Emergent: No Questions on Initial Load

**What it looked like:** When Emergent first loaded, the navigation panel showed 0 questions. The user had to manually scroll all the way up through the chat for questions to appear in the panel.

**Root cause:** Emergent loads with the chat scrolled to the bottom. Virtuoso only renders messages currently in the viewport. Messages at the top of the conversation don't exist in the DOM until the user scrolls up to them. Since our scanner runs on page load (when only the bottom is rendered), it finds 0 user messages.

**Fix — Scroll-through collection on panel open:** When the panel opens on a virtual scroll platform, the script programmatically scrolls through the entire virtuoso container to force-render every message:
1. Saves the current `scrollTop` position
2. Forces a full reset (`scanConversation(true)`)
3. Builds an array of scroll positions: `[0, 80%_viewport, 160%_viewport, ...]` up to `scrollHeight`
4. Steps through each position with 250ms delays (for virtuoso to render)
5. At each position, runs `scanConversation()` in accumulation mode
6. After reaching the end, restores the original scroll position

This collects all user messages across the entire conversation regardless of initial scroll position.

### Fixed — Emergent: "No Messages Found" Text Persisting Above Questions

**What it looked like:** After questions loaded via accumulation, the "No messages found yet" placeholder text remained visible above the actual question list.

**Root cause:** The empty message element was created with `id="ai-nav-empty"` but the accumulation code used `.ai-nav-empty` (class selector) to find and remove it. The selector never matched.

**Fix:** Changed `list.querySelector('.ai-nav-empty')` to `document.getElementById('ai-nav-empty')`.

### Mock Page and Documentation Updates

- **`tests/mock-pages/emergent.html`:** Rewritten to match real Emergent DOM — includes virtuoso scroller (`data-testid="virtuoso-scroller"`), full A→M nesting hierarchy with `data-testid="user-message-user-task"`, icon sidebar, chat panel constrained by flex (`max-width:40%`), and preview panel.
- **`DOM-REFERENCE.md`:** Created comprehensive reference covering all 14 platform variants. Detailed DOM structures and debugging history for Replit, V0, Bolt.new, and Emergent (from live site inspection). Selector info and notes for all other platforms. Includes general patterns and common pitfalls section.
- All 140 tests pass (14 platforms × 10 tests).

---

## [7.5] - 2026-02-15

### Problem — Platform Selectors Not Matching Live DOM

After deploying v7.4 (which added mock test pages for 5 new platforms), live site testing on Bolt.new, Replit, V0, and Emergent revealed four distinct issues:

1. **Bolt.new** showed "You've used all your tokens" (a subscription warning) instead of actual user questions
2. **Replit** showed every question 3 times instead of once
3. **V0** showed 0 questions found
4. **Emergent** button was invisible until mouse hover, and the panel had spacing issues

### Technical Root Causes and Fixes

#### Bolt.new — Token Warning Picked Up as a Question

**Root cause:** The v7.4 primary selector `[class*="backdrop-blur"][class*="rounded"]` was based on the bolt.diy open-source fork, but bolt.new's actual production DOM uses a different structure:
- User messages: `<div data-message-id="..." class="self-end bg-bolt-elements-messages-background ...">` with text inside `<div class="_MarkdownContent_...">` children
- The "You've used all your tokens" warning: a `<span>` inside a `<div class="bg-bolt-elements-prompt-subscribeButton-background">` at the bottom of the page

The bolt.diy selectors found 0 user messages (no `backdrop-blur` in production), so fallbacks fired and matched the token warning text (which sat inside elements with `ml-auto` or `rounded-*` classes).

**Fix:** Reworked the entire Bolt selector chain:
1. **New primary:** `[data-message-id]` filtered by `self-end` class or `bg-bolt-elements-messages` — directly targets the production DOM structure
2. **Fallback 1:** `.self-end[class*="bg-bolt-elements"]` — alternate attribute-based match
3. **Fallback 2:** `[class*="_MarkdownContent_"]` inside `.self-end` parents — targets the text content divs
4. **Fallback 3:** Original `backdrop-blur` + `rounded` pattern (kept for bolt.diy fork compatibility)
5. **Fallback 4-5:** `ml-auto` rounded bubbles and grid children (kept from v7.4)
6. **All selectors:** Added `subscribeButton` and `prompt-subscribe` exclusion filters to prevent token/subscription warnings from ever being matched

Updated `tests/mock-pages/bolt.html` to use the production DOM structure (`data-message-id`, `self-end`, `bg-bolt-elements-messages-background`, `_MarkdownContent_`) and include a token warning element that should NOT be detected.

#### Replit — 3x Question Duplication

**Root cause:** The existing nesting deduplication (keep only innermost elements) handles the case where `data-testid*="user-message"` matches at multiple nesting levels (parent contains child). But on live Replit, 3 elements per message are matching the selector and they are NOT nested — they're siblings or cousins at the same DOM level. Each has identical `textContent`, but `el.contains(other)` returns `false` for all pairs, so nesting dedup keeps all 3.

**Fix:** Added a second deduplication step after the existing nesting dedup:
```javascript
// Text-content dedup: keep only the first element for each unique text
var replitSeen = {};
var replitTextDeduped = [];
for (var ri = 0; ri < replitMsgArr.length; ri++) {
    var replitTxt = replitMsgArr[ri].textContent.trim();
    if (replitTxt && !replitSeen[replitTxt]) {
        replitSeen[replitTxt] = true;
        replitTextDeduped.push(replitMsgArr[ri]);
    }
}
```

**Limitation:** This is a mitigation, not a root-cause fix. If a user genuinely asks the exact same question twice, the second instance would be filtered out. The proper fix requires live DOM inspection to understand why 3 elements match per question and to target only the correct one. See TROUBLESHOOTING.md for full diagnosis notes.

#### V0 — No Questions Detected

**Root cause:** All primary selectors (`[data-role="user"]`, `[data-message-role="user"]`, `[data-message-author-role="user"]`) and all 5 structural fallbacks return 0 results on the live V0 site. V0's Geist design system likely uses completely different data attributes and DOM patterns than what we assumed from research.

**Fix:** Added more selector variants to increase coverage:
- `[data-message-author="user"]`
- `[data-testid*="user-message"]`
- `[data-sender="user"]`
- New fallback: `[data-message-id]` containers filtered by alignment classes (`justify-end`, `self-end`, `ml-auto`, or containing `bg-muted` children)

**Limitation:** These additional selectors are educated guesses. Without live DOM inspection, we can't know V0's actual attribute patterns. See TROUBLESHOOTING.md for what's needed.

#### Emergent — Button Invisible Until Hover

**Root cause:** The ghost notch button at rest has `opacity: 0.35` and `width: 8px`. Against Emergent's dark interface, this combination makes the button virtually invisible — a 8px-wide strip at 35% opacity on a dark background doesn't register visually.

**Fix:** Added Emergent-specific CSS overrides:
```css
#ai-nav-toggle.ai-nav-positioned {
    opacity: 0.75 !important;  /* Was 0.35 for all platforms */
    width: 14px !important;    /* Was 8px */
}
```

This uses a conditional template literal in the CSS generation:
```javascript
opacity: ${currentSite === SITE.EMERGENT ? '0.75' : '0.35'} !important;
${currentSite === SITE.EMERGENT ? 'width: 14px !important;' : ''}
```

**Limitation:** Still under investigation — the 0.75 opacity + 14px width may still be insufficient on some Emergent page backgrounds. The panel spacing issue (gap when panel expands) is also unresolved. See TROUBLESHOOTING.md.

### Known Issues Remaining

All four fixes improve the situation but three platforms (Replit, V0, Emergent) need further live DOM inspection for complete resolution. See TROUBLESHOOTING.md → "Known Issues Under Investigation" and ROADMAP.md → "Next Priority: Platform Selector Deep-Dive" for the full plan.

---

## [7.4] - 2026-02-15

### Added — Mock Test Pages for 5 New Platforms + Selector Improvements

Extended the automated test suite from 9 platform variants to 14 by adding mock HTML pages for V0, Base44, Emergent, Perplexity, and Firebase Studio. Also refined selectors and visibility for 6 platforms based on initial testing.

#### New Mock Test Pages
- `tests/mock-pages/v0.html` — V0 with `data-role="user"` + copy button filtering (later rewritten in v7.7 to use `data-testid="message"` + `origin-right`/`items-end`)
- `tests/mock-pages/base44.html` — Base44 with `id="message-{uuid}"` + justify-end filter
- `tests/mock-pages/emergent.html` — Emergent with `data-testid="user-message-*"` + prose containers
- `tests/mock-pages/perplexity.html` — Perplexity with `.group/query` Tailwind variant
- `tests/mock-pages/firebase.html` — Firebase Studio with CSS Modules `_isUser_` pattern

#### Selector Refinements
- **Replit:** Added nesting deduplication — keeps only innermost elements when `data-testid*="user-message"` matches at multiple DOM levels
- **Emergent:** Added deduplication (same pattern as Replit) + scrollbar offset (14px left shift to avoid thick scrollbar overlap)
- **V0:** Added copy button/icon exclusion across all fallbacks

#### Icon Change
- **Firebase Studio:** Changed icon from ☄ (comet) to ✦ (four-pointed star) — same as Gemini since Firebase Studio runs Gemini under the hood, differentiated by the dark tangerine color theme

### Test Suite Results
All 140 tests pass (10 tests × 14 platform variants) on Chromium. The test infrastructure now covers every supported platform.

---

## [7.3] - 2026-02-15

### Problem — Ghost Notch Button Appearing on Home/Dashboard Pages

After deploying v7.1, the ghost notch button was appearing on pages where it shouldn't — specifically on **home/dashboard pages** of left-chat platforms (Bolt.new homepage, Lovable's project list, Emergent's home screen). These pages have no active chat session, so there's nothing to navigate. The button either showed at a fixed 35% position (wrong) or briefly flashed visible before disappearing (confusing).

### Technical Root Cause (Three Bugs, Fixed Across v7.2 → v7.3)

The v7.1 ghost notch had a fundamental design flaw: it used a **35% viewport fallback** when boundary detection couldn't find the chat panel edge. This meant the button ALWAYS appeared somewhere — even on pages with no chat panel at all. The fallback was added as a safety net during initial development, but it turned out to be exactly the wrong behavior for home pages.

Removing the fallback revealed two deeper bugs in the boundary detection and visibility lifecycle:

#### Bug 1: The 35% Viewport Fallback (v7.1 → fixed in v7.2)

**Root cause:** `getChatBoundaryX()` had a last-resort fallback at the bottom:
```javascript
// Last resort: assume 35% viewport
return window.innerWidth * 0.35;
```

This meant `getChatBoundaryX()` NEVER returned `null` — it always returned a number. So the "no chat detected → hide" branch in `updateLeftChatPositions` was unreachable dead code. The button always positioned itself somewhere.

**Why the fallback existed:** During v7.1 development, the boundary detection strategies (input walkup, message walkup, iframe detection) hadn't been validated on live sites yet. The 35% fallback was a conservative safety net — "if we can't figure out where the chat panel ends, at least put the button somewhere reasonable." In hindsight, "somewhere reasonable" on a home page is "nowhere."

**Fix (v7.2):** Removed the 35% fallback entirely. `getChatBoundaryX()` now returns `null` when no chat panel is detected, which causes `updateLeftChatPositions()` to hide the button with `display: none`.

**New concern this raised:** Without the fallback, the button's visibility now depends entirely on `getChatBoundaryX()` correctly distinguishing chat pages from home pages. This is harder than it sounds because **home pages on these platforms often have chat-like textareas** (Bolt: "Let's build a customer portal...", Emergent: "Build me a clone of netflix..."). These textareas could match Strategy 1's broad input selectors and trick the boundary detection into returning a value.

**Why it still works on home pages:** The `_walkUpToChatContainer()` function requires the input's ancestor to satisfy ALL of: `rect.left < 80` (starts near left edge), `width > 200 && width < 65% viewport` (narrow panel, not full-width), `height > 40% viewport` (tall). On home pages, these centered input cards have `rect.left > 80` (they're centered, not left-aligned), so walkup fails → returns null → button stays hidden. On real chat pages, the chat panel starts at the left edge (`rect.left ≈ 0`), is 30-50% of viewport width, and is full height — matching all criteria.

#### Bug 2: Elements Starting Visible at Opacity 0 (v7.2 → fixed in v7.3)

**Root cause:** Even after fixing Bug 1, on some pages the button would **briefly flash visible** before being hidden. This happened because elements were created with `display: ''` (visible) and `opacity: 0` (transparent). The CSS had hover rules that set `opacity: 1`, so if the user's mouse happened to be in the right area, they could discover the invisible button before `updateLeftChatPositions()` had a chance to set `display: none`.

The timeline was:
1. Script loads → toggle created with `display: ''`, `opacity: 0` (in DOM, hoverable)
2. 500ms later → first `updateLeftChatPositions()` poll runs → `getChatBoundaryX()` returns null → sets `display: none`
3. In that 500ms window, the element existed and was hoverable

**Fix:** Changed the initialization to create elements with `display: none` from the start on left-chat sites. Elements are ONLY made visible (`display: ''`) after `getChatBoundaryX()` returns a stable boundary. The `ensureElementsExist()` re-injection function also starts re-created elements as `display: none` when boundary hasn't been confirmed yet.

#### Bug 3: Boundary Fluctuation Causing Re-Hide Loop (v7.3)

**Root cause:** This was the most subtle bug. After the button successfully appeared at `0.35` opacity on a chat page, it would **go invisible again** and only be discoverable by hovering. The user described: "the buttons are not visible at all until I toggle a mouse over."

The problem was in `updateLeftChatPositions()`. The function polled every 500ms and compared the current boundary to `_lastBoundaryX` with a 3px tolerance. If the boundary shifted by more than 3px between polls, the code treated this as "boundary changed" and executed a full reset: `display: none`, remove `ai-nav-positioned` class, set `_boundaryDetected = false`.

On real sites, the chat panel boundary **fluctuates by small amounts** (4-8px) between polls due to:
- Layout reflows when new content streams in
- Scrollbar appearing/disappearing as message content changes height
- CSS transitions completing between polls
- The preview iframe adjusting its dimensions

This created a destructive cycle:
```
Poll 1: boundary = 500px → _lastBoundaryX = 500, position invisibly
Poll 2: boundary = 500px → stable! → show button, start fade-in
Poll 3: boundary = 504px → shift > 3px! → HIDE button, reset everything
Poll 4: boundary = 500px → shift from 504! → update _lastBoundaryX, stay hidden
Poll 5: boundary = 504px → shift from 500! → stays hidden
... cycles forever, or eventually stabilizes and re-shows, only to be hidden again on the next fluctuation
```

The button would appear for about 1 second (polls 2-3), then vanish and enter this hide/show/hide cycle. Because the cycle often settled back to hidden, the user only saw the button when explicitly hovering over its position.

**Additional sub-bug:** The original fade-in used a **3-second opacity transition** (`transition: opacity 3s ease` in the `ai-nav-positioned` class). This was designed for v7.1 where the position might shift, giving the button time to "settle." But combined with the display-none-first approach, it meant the button took 3+ seconds to reach even 0.2 opacity — making it appear invisible even when it WAS technically fading in. Users couldn't distinguish a button at 0.1 opacity from no button at all.

**Fix (v7.3 final):** Restructured `updateLeftChatPositions()` into three clearly separated phases:

```javascript
// Phase 1: No boundary → hide + full reset
if (!boundaryX) { hide; reset; return; }

// Phase 2: Already confirmed → just reposition smoothly, NEVER hide
if (_boundaryDetected) { update position; return; }

// Phase 3: Not yet confirmed → require 2 stable polls before showing
if (stable) { show; fade in; return; }
else { position invisibly; wait; }
```

The critical change: **once `_boundaryDetected` is true, the button is NEVER hidden again for position shifts** — only a `null` boundary (navigating away from the chat page entirely) will hide it. Position shifts during Phase 2 are handled by smoothly updating `style.right`, not by hiding and re-showing.

Also changed the opacity transition from 3s to 0.5s and removed the two-phase `ai-nav-ready` system (which existed solely to switch from 3s fade to fast hover transitions after the fade completed — unnecessary now that the fade itself is fast).

### Architecture: Final `updateLeftChatPositions()` Design

The function now has a clean three-phase structure with clear invariants:

| Phase | Condition | What happens | Can hide the button? |
|-------|-----------|-------------|---------------------|
| **1. No chat** | `boundaryX` is `null` | Full reset: `display: none`, clear timers, remove classes, reset `_boundaryDetected` | Yes — this is the ONLY path that hides |
| **2. Confirmed** | `_boundaryDetected === true` | Update `style.right` if boundary shifted ≥3px. No visibility changes. | No — never |
| **3. Detecting** | `_boundaryDetected === false` | If boundary matches `_lastBoundaryX` within 3px on two consecutive polls → confirm. Otherwise, store boundary and position invisibly. | No — stays hidden until confirmed |

**State transitions:**
```
[Page load] → Phase 3 (detecting)
Phase 3 + stable boundary → Phase 2 (confirmed, visible)
Phase 2 + null boundary → Phase 1 (hidden, reset) → Phase 3 on next non-null
Phase 2 + shifted boundary → Phase 2 (reposition, stay visible)
Phase 3 + shifting boundary → Phase 3 (keep waiting)
Phase 3 + null boundary → Phase 1 (hidden, reset)
```

### CSS Changes

```css
/* Before (v7.1): Two-phase fade system */
#ai-nav-toggle.ai-nav-positioned {
    opacity: 0.35 !important;
    transition: ... opacity 3s ease ... !important;  /* Slow 3-second fade */
}
#ai-nav-toggle.ai-nav-ready {
    transition: ... opacity 0.3s ease ... !important;  /* Fast for hover */
}

/* After (v7.3): Single-phase, fast fade */
#ai-nav-toggle.ai-nav-positioned {
    opacity: 0.35 !important;
    transition: ... opacity 0.5s ease ... !important;  /* Quick 0.5s appearance */
}
/* ai-nav-ready class removed entirely */
```

### Changes to Element Initialization

```javascript
// Before (v7.1): Elements created visible
document.body.appendChild(createToggle());  // display: '' by default

// After (v7.3): Left-chat elements start hidden
var initToggle = createToggle();
if (isLeftChat) initToggle.style.display = 'none';  // Hidden until confirmed
document.body.appendChild(initToggle);

// Same in ensureElementsExist() re-injection:
if (isLeftChat && !_boundaryDetected) toggle.style.display = 'none';
```

### What's Working Now

- **Home pages** (Bolt.new `/`, Lovable dashboard, Emergent `/home`): Button never appears — `getChatBoundaryX()` returns null because centered input cards fail the `rect.left < 80` check
- **Chat pages**: Button appears after ~1 second (2 polls × 500ms), fades to 0.35 opacity over 0.5s, stays visible permanently regardless of boundary micro-fluctuations
- **Chat → Home navigation** (SPA): Boundary becomes null → button hides → full state reset → ready for next chat
- **Home → Chat navigation** (SPA): Boundary detected → 2 stable polls → button appears

### Known Limitations / Things to Watch

1. **The `rect.left < 80` heuristic** in `_walkUpToChatContainer` is what prevents false positives on home pages. If any platform redesigns its home page to have a left-aligned input panel (not centered), this could trigger a false positive. The 80px threshold accounts for icon sidebars (common on app builders) but assumes home page inputs are centered.

2. **The 3px jitter tolerance** means the boundary must stabilize within 3px across two consecutive 500ms polls before the button appears. If a platform has a chat panel that animates for more than 1 second on page load, the button appearance will be delayed until the animation completes.

3. **Home pages with left-aligned chat-like panels** could theoretically trick the detection. The current defense is the `_walkUpToChatContainer` height/width/position requirements. A panel that starts at the left edge, is 200-65% of viewport width, and is 40%+ of viewport height would be treated as a chat panel regardless of whether it actually is one.

4. **`getChatBoundaryX()` Strategy 3 (iframe detection)** looks for preview iframes in the right portion of the viewport. If a home page has a large promotional iframe or embedded demo, it could return a false boundary. This hasn't been observed in practice.

---

## [7.1] - 2026-02-15

### Added — 5 New Platforms + Ghost Notch Button for Left-Chat Sites

Expanded from 7 platforms to 12, adding V0, Base44, Emergent, Perplexity, and Firebase Studio. Also introduced a new "ghost notch" toggle button design for left-chat platforms where the chat panel sits on the left and a workspace/preview occupies the right.

#### V0 (`v0.app`)
- **Theme:** White (`#ffffff`) with dark text — matches Vercel's monochrome design language
- **Icon:** ▽ (U+25BD, white down-pointing triangle — evokes Vercel's triangle/delta logo)
- **Selectors:** Multi-strategy chain:
  1. `[data-role="user"]` — data attribute selector (most reliable if present)
  2. `[data-message-role="user"]` — alternate data attribute pattern
  3. Structural fallback: `.justify-end`, `.self-end`, `.ml-auto` elements filtered by text content, excluding nav/header elements, and checking for leaf nodes (no nested right-aligned children)
- **Layout:** Left-chat (chat on left, generated app preview on right) → uses ghost notch button
- **SPA hooks:** Yes — Next.js-based routing requires pushState/replaceState interception

#### Base44 (`app.base44.com`)
- **Theme:** Indigo (`#6366f1`) — matches Base44's purple-indigo UI accents
- **Icon:** ⬢ (U+2B22, black hexagon — evokes a modular building block, fitting Base44's "build anything" premise)
- **Selectors:** Multi-strategy chain:
  1. `[id^="message-"]` elements filtered by presence of `.justify-end` child (user messages are right-aligned within their message container, each message has `id="message-{uuid}"`)
  2. Fallback: `.bg-slate-200.rounded-xl` elements (user message bubble styling)
- **Layout:** Left-chat → uses ghost notch button
- **SPA hooks:** Yes — React SPA with dynamic routing

#### Emergent (`app.emergent.sh`)
- **Theme:** Emerald green (`#10b981`) — matches Emergent's green accent color
- **Icon:** e (lowercase letter — Emergent brand initial)
- **Selectors:** Highly reliable data-testid approach:
  1. `[data-testid^="user-message"]` — Emergent uses descriptive data-testid attributes, making this the most reliable selector of any platform
  2. Fallback: `[id^="user-"]` — alternate ID-based pattern
- **Layout:** Left-chat → uses ghost notch button
- **SPA hooks:** Yes

#### Perplexity (`perplexity.ai`)
- **Theme:** Teal/cyan (`#20b8cd`) — matches Perplexity's signature teal brand color
- **Icon:** ✳ (U+2733, eight-spoked asterisk — same as Claude, differentiated by teal color. Originally was ⦾ U+29BE but changed to ✳ for reliable rendering on Linux/Firefox)
- **Selectors:** Tailwind group variant approach:
  1. `.group\/query` — Perplexity uses Tailwind's group variant `.group/query` on each user query block. The `\/` is the CSS escape for the `/` character. This is a very stable selector since it's a semantic class name rather than a styling utility.
  2. Fallback: `.group\/title .select-text` — alternate query text extraction pattern
- **Layout:** Standard center-chat → uses right-edge hover-expand button
- **SPA hooks:** Yes — Next.js SPA with aggressive client-side routing
- **@match note:** Both `www.perplexity.ai` and `perplexity.ai` are matched since Perplexity serves from both hostnames

#### Firebase Studio (`studio.firebase.google.com`)
- **Theme:** Dark Tangerine (`#FFA611`) — matches Firebase's primary brand color
- **Icon:** ☄ (U+2604, comet — evokes Firebase's fiery branding)
- **Selectors:** CSS module class pattern:
  1. `[class*="_isUser_"]` — Firebase Studio uses CSS Modules which generate class names like `_isUser_abc123`. The hash suffix changes per build, but the `_isUser_` semantic prefix remains stable across deployments. This `*=` attribute selector matches any class containing that substring.
  2. Fallback: `[class*="_chatMessage_"]` elements filtered by checking if className string includes `_isUser_` — broader net catching all chat messages first, then filtering to user messages only
- **Layout:** Standard center-chat (Gemini-based interface) → uses right-edge hover-expand button
- **SPA hooks:** Yes — Angular-based (inherits Gemini's SPA behavior)
- **Key technical note:** Firebase Studio is essentially Google's Gemini integrated into the Firebase console with a code workspace. It shares Gemini's Angular foundation and Trusted Types CSP enforcement, so the same programmatic DOM creation approach (no innerHTML) from v5.0 applies here.

### Added — Ghost Notch V1 Toggle Button (Left-Chat Platforms)

Introduced a new toggle button design for platforms where the chat panel occupies the left side of the screen (Bolt, Lovable, Replit, V0, Base44, Emergent). The standard right-edge button doesn't work well on these platforms because the right side is occupied by the app preview/workspace — clicking a button at the screen's right edge feels disconnected from the chat content.

#### Design: Ghost Notch V1
- **At rest:** An 8px-wide vertical bar at 35% opacity, positioned flush against the right edge of the chat panel. Nearly invisible — a subtle "notch" in the boundary between chat and workspace.
- **On hover:** Expands to 32px wide, revealing the platform icon which scales in from 60% to 100%. Height shrinks from 52px to 40px for a more compact feel. Opacity rises to 100%. Uses `cubic-bezier(0.4, 0, 0.2, 1)` easing for a natural material-design feel.
- **When open:** Button stays at 32px/full opacity. Panel slides from the left edge, covering the chat area. Button repositions to the right edge of the open panel (320px from left).
- **Auto-close on navigate:** When user clicks a question in the nav panel, the panel closes first (350ms animation), then scrolls to and highlights the message. This is necessary because the panel overlays the chat — the user needs to see the destination.

#### Boundary Detection (`getChatBoundaryX()`)
The ghost notch button needs to know where the chat panel ends and the workspace begins. This boundary varies across platforms and can change when the user resizes panes.

**Detection strategy (3 strategies, no fallback — returns `null` if none match):**

1. **Strategy 1 — Chat input walkup:** Find the chat input element via a broad selector (`textarea[placeholder*="message" i]`, `textarea[placeholder*="Send" i]`, `textarea[placeholder*="Type" i]`, `[contenteditable="true"][role="textbox"]`, `textarea[class*="chat"]`, `textarea[class*="prompt"]`). Walk up the DOM tree from the input, measuring each ancestor's bounding rect. The chat panel is identified as the first ancestor that: starts near the left edge (`rect.left < 80` to allow for icon sidebars), is between 200px and 65% of viewport width, and is at least 40% of viewport height. Return `rect.right`.

2. **Strategy 2 — Platform-specific message walkup:** Use platform-specific selectors (e.g., `[data-testid^="user-message"]` for Emergent, `[id^="message-"]` for Base44) to find a known message element, then walk up to the chat container using the same `_walkUpToChatContainer()` function.

3. **Strategy 3 — Preview iframe detection:** Find `<iframe>` elements positioned in the right portion of the viewport (left edge between 25-75% of viewport, tall, reasonably wide). The iframe's `rect.left` is the boundary.

4. **No fallback:** If all three strategies fail, return `null`. This is critical — it tells `updateLeftChatPositions()` to hide the button entirely. This prevents the button from appearing on home/dashboard pages. See v7.3 changelog for the full story of why the original 35% fallback was removed.

**Positioning updates:**
- `updateLeftChatPositions()` polls every 500ms via `setInterval`
- Button starts with `display: none` and only becomes visible after two consecutive polls return a stable boundary (within 3px)
- Once visible, position shifts are handled smoothly without hiding
- Only a `null` boundary (leaving the chat page) will hide the button again
- Window resize listener also triggers repositioning
- SPA navigation hooks trigger repositioning after route changes

#### Panel Behavior (Left-Chat Mode)
- Panel slides from the **left** edge (`left: -320px` → `left: 0`) instead of the right
- Uses `border-right` instead of `border-left` for the panel edge
- Toggle button animates its `left` position smoothly when panel opens/closes (via CSS `transition: left 0.3s ease`)

### Changed — SPA Hooks Expanded
The `history.pushState`/`replaceState` interception and periodic health check now applies to all SPA platforms: Gemini, Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio, and Perplexity. Left-chat platforms also trigger `updateLeftChatPositions()` on navigation events.

### Architecture Notes

- **`isLeftChat` flag:** A single boolean computed at initialization that drives all left-chat vs standard behavioral differences. Controlled by the `LEFT_CHAT_SITES` array: `[SITE.BOLT, SITE.LOVABLE, SITE.REPLIT, SITE.V0, SITE.BASE44, SITE.EMERGENT]`.
- **CSS is conditionally assembled:** `toggleStyles` and `panelStyles` are computed separately based on `isLeftChat`, then concatenated with the shared styles (header, stats, list items, scrollbar) into the final `styles` string. This avoids CSS specificity conflicts between the two button designs.
- **No breaking changes:** All existing platforms (Claude, ChatGPT, Grok, Gemini, Claude Code, Codex, Bolt, Lovable, Replit) retain their exact previous behavior. The ghost notch is additive for left-chat sites; standard sites are untouched.
- **`_lastBoundaryX` jitter guard:** Button position only updates when the boundary moves more than 3px, preventing visual jitter from sub-pixel layout recalculations.
- **Three-phase `updateLeftChatPositions()`:** See v7.3 changelog for the full architecture. Phase 1 (no boundary → hide), Phase 2 (confirmed → reposition smoothly), Phase 3 (detecting → wait for stability). Once confirmed, the button is NEVER hidden for position shifts — only for null boundaries.

---

## [7.0] - 2026-02-14

### Added — AI App-Builder Platform Support

Added support for three AI app-builder platforms, expanding the navigator from 4 platforms to 7 (plus their sub-platform variants). These are the first non-chatbot platforms supported — all three are code-generation IDEs where users build apps through iterative conversation, and all three suffer from the same long-conversation navigation problem.

#### Bolt.new (`bolt.new`)
- **Theme:** Sky Blue (`#38BDF8`) — matches Bolt's sky-400 brand color
- **Icon:** ⚡ (U+26A1, lightning bolt with text presentation selector to prevent emoji rendering)
- **Selectors:** Multi-strategy fallback chain based on bolt.diy open-source fork analysis:
  1. `backdrop-blur` + `rounded` elements that are not `w-full` (user messages have accent-tinted blur background)
  2. `ml-auto` rounded bubbles (right-aligned user messages)
  3. Structural filtering on `.grid.w-full > div` children — assistant messages have `overflow-hidden w-full`, user messages do not
  4. Computed `backgroundColor` check as last resort (user messages have non-transparent accent tint)
- **SPA hooks:** Yes — Remix-based routing requires `pushState`/`replaceState` interception + periodic health check
- **Site detection:** Uses exact hostname match (`hostname === 'bolt.new'`) instead of `.includes()` to avoid matching deployed project subdomains (`yourapp.bolt.new`)
- **Key technical note:** Bolt uses UnoCSS (not Tailwind), which has similar syntax but may generate different production class names. The computed-style fallback provides resilience against UnoCSS class name changes.

#### Lovable (`lovable.dev`)
- **Theme:** Violet (`#9b87f5`) — inspired by Lovable's heart gradient logo (warm-to-cool purple spectrum)
- **Icon:** ♥ (U+2665, black heart suit — directly evokes the "Lovable" brand heart logo)
- **Selectors:** Multi-strategy fallback chain based on Adorable open-source clone + Lovable.dev Add-ons extension analysis:
  1. `div[role="log"] .justify-end` — ARIA log container + right-aligned user message wrappers
  2. `bg-neutral-200.rounded-xl` / `bg-neutral-700.rounded-xl` bubbles inside `.justify-end` ancestors
  3. `div.ChatMessageContainer .justify-end` — class name observed in extension DOM utils
  4. `div.self-end[class*="bg-neutral"]` — alternate alignment pattern
  5. Broad scan of `main` element filtering by alignment heuristics
- **Page guard:** Only scans when URL contains `/projects/` (homepage, pricing, docs pages have no chat interface)
- **SPA hooks:** Yes — React Router SPA requires `pushState`/`replaceState` interception + periodic health check
- **Layout note:** Split-panel interface (chat left, preview right). Our fixed-position right sidebar overlays the preview panel when open, which is acceptable since users explicitly toggle navigation.

#### Replit (`replit.com`)
- **Theme:** Red-orange (`#F26522`) — Replit's official brand orange. Visually distinct from Claude's amber (`#d97706`) — Replit's is more red-leaning (hue 19°) vs Claude's warm amber (hue 40°).
- **Icon:** ⠕ (U+2815, Braille Pattern Dots-135 — the Unicode character the Replit community adopted to simulate Replit's three-dot prompt logo)
- **Selectors:** Defensive multi-strategy chain designed for Emotion CSS-in-JS (hash classes change per deployment):
  1. `data-testid`, `data-message-role`, `data-role` attribute selectors (if Replit uses them)
  2. ARIA `role="log"` container + computed style analysis (checking `marginLeft: auto`, `alignSelf: flex-end`, non-transparent `backgroundColor`)
  3. Chat panel discovery via `textarea[placeholder*="message"]`, then structural scan of sibling elements with right-alignment and leaf-node heuristics
- **SPA hooks:** Yes — Next.js SPA with Jotai state management and Crosis WebSocket streaming. Chat panel can be opened/closed/repositioned within the IDE's pane system.
- **Key technical note:** This is the hardest platform to support due to Emotion's unstable hash classes. Selectors are necessarily speculative and will require live DOM validation. The fallback chain prioritizes stable attributes (`data-*`, ARIA roles, computed styles) over class names.

### Architecture Notes

- **SPA hooks consolidated:** The `history.pushState`/`replaceState` interception and periodic health check (previously Gemini-only) now applies to all four SPA platforms: Gemini, Bolt, Lovable, and Replit. This is a single shared code block rather than duplicated per-platform.
- **No breaking changes:** All existing platform support (Claude, ChatGPT, Grok, Gemini, Claude Code, Codex) remains unchanged. New platforms are additive — new entries in lookup tables + new `else if` branches in `getUserMessages()`.
- **Research methodology:** Each platform was researched by a dedicated agent in parallel — one expert per platform — analyzing open-source forks (bolt.diy), production extensions (Lovable.dev Add-ons), engineering blog posts (Replit RUI/Emotion), and community resources.

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
Added a **fallback selector** in `getUserMessages()` that activates only when the existing ChatGPT Chat selector finds nothing — the same pattern used for Claude Code support in v6.2:

```javascript
if (messages.length === 0) {
    messages = document.querySelectorAll('div.self-end.bg-token-bg-tertiary');
}
```

This approach:
1. **Selects user message bubbles** (`self-end.bg-token-bg-tertiary`) — Codex web user messages are right-aligned (`self-end` in Tailwind) with a tertiary token background (`bg-token-bg-tertiary`), while agent messages are left-aligned and use a different background
2. **Good scroll target** — the bubble element works well with both `scrollIntoView()` and the background color highlight animation since it's the visually prominent container
3. **Non-breaking** — only activates as a fallback after the ChatGPT Chat selector fails, so regular ChatGPT continues to work unchanged
4. **No `@match` changes needed** — `chatgpt.com/*` already covers `chatgpt.com/codex`

### Result
Codex web conversations now show all user messages in the navigation panel, with correct summaries and click-to-scroll functionality. Regular ChatGPT Chat remains unaffected because its selector matches before the fallback is reached.

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
