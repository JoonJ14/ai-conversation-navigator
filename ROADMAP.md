# Roadmap

Future directions and ideas for AI Conversation Navigator.

This document tracks features and platform expansions we're considering but haven't started yet. It's meant to capture research, reasoning, and priorities so we (or contributors) can pick things up when the time is right.

---

## Supported Today

### AI Chatbots
- Claude (`claude.ai`)
- ChatGPT (`chatgpt.com`)
- Grok (`grok.com`)
- Gemini (`gemini.google.com`)
- Perplexity (`perplexity.ai`) — added in v7.1

### Coding Agents (Web)
- Claude Code (`claude.ai/code`)
- Codex (`chatgpt.com/codex`)

### AI App-Builder Platforms (added in v7.0, expanded in v7.1)
- Bolt.new (`bolt.new`) — Sky Blue theme, ⚡ icon, ghost notch
- Lovable (`lovable.dev`) — Violet theme, ♥ icon, ghost notch
- Replit (`replit.com`) — Orange theme, ⠕ icon, ghost notch
- V0 (`v0.app`) — White theme, ▽ icon, ghost notch — added in v7.1
- Base44 (`app.base44.com`) — Indigo theme, ⬢ icon, ghost notch — added in v7.1
- Emergent (`app.emergent.sh`) — Emerald theme, e icon, ghost notch — added in v7.1
- Firebase Studio (`studio.firebase.google.com`) — Dark Tangerine theme, ✦ icon, standard button — added in v7.1

---

## Current Status: v11.8

The extension supports 14 platform variants across 12 websites.

**v11.8 Accomplishments (2026-03-14):**
- **Firefox: Disable Fetch Interception (DEC-020):** `setupClaudeSSEInterceptor()` now returns immediately on Firefox (`typeof exportFunction === 'function'`). The sandbox execution taints `arguments` and return values when proxying `fetch` — even fire-and-forget patterns fail because the sandbox's participation in `_nativeFetch.apply()` creates cross-compartment wrappers that Firefox blocks with `Permission denied to access property "length"`. Context bar falls back to DOM estimation (Path B). SPA history patches remain safe with `exportFunction()` (they return `undefined`). Permanent fix requires the extension transition (WXP) with `world: "MAIN"` content scripts.
- **Turn Dots in Path B:** Added `_renderTurnDots()` call to Path B (Claude without SSE data). Previously missing because Path B was a brief transitional state on Chrome — SSE data arrives quickly and Path A takes over. With Firefox permanently on Path B, the gap was exposed.

**v11.7 (2026-03-14, superseded by v11.8):**
- **Fire-and-Forget Fetch Pattern (failed):** Attempted to preserve SSE interception on Firefox by calling `result.then()` as a side effect and always returning the original `result` Promise. Still failed — sandbox execution taints the pipeline at the `arguments` level regardless of return value handling.

**v11.6 Accomplishments (2026-03-14):**
- **Firefox Black Screen Crash Fix (DEC-019):** Claude's March 13, 2026 Visualizer vendor bundle update called `.bind()` on `fetch` during React initialization. Our sandbox-compartment replacement triggered Firefox's cross-principal security check, crashing the entire page to a black screen. Fix: `exportFunction()` wrapping clones proxy functions into the page's security context. Applied to `fetch` proxy and SPA history patches (`pushState`/`replaceState`). This was the first Layer 3 execution break — platform update crashing the host page, not just degrading our features.

**v11.5 Accomplishments (2026-03-13):**
- **Image Gallery: Graceful Handling for Files-Panel Images (Claude):** Claude's files panel shows all uploads in a flat grid disconnected from conversation turns. Images get `msgIndex: -1` sentinel, gallery label shows "Upload" instead of "Q#1", navigate-to-message button disabled. Prevents scrolling into the hidden files panel.

**v11.4 Accomplishments (2026-03-13):**
- **Image Gallery Fix — Claude + ChatGPT:** Gallery was returning "No images" on both platforms. Two separate root causes found via live DOM inspection:
  - *Claude:* As of March 2026 Claude renders uploaded file thumbnails in a hidden FILES PANEL (`div.w-0`, `opacity-0`) that is completely outside the conversation turn elements. Per-message scoping could never reach them. Fix: `imageSelectorScope:'document'` + new selector `img[src*="/api/"][src*="/files/"]`.
  - *ChatGPT:* Migrated uploaded image hosting from `files.oaiusercontent.com` to `chatgpt.com/backend-api/estuary/content`. The old CDN selector matched nothing. Images remain inside `[data-message-author-role="user"]` elements; only the selector was updated.

**v11.3 Accomplishments (2026-03-12):**
- **Image Gallery Fix — Gemini + Grok:** Gallery returned 0 images despite correct selectors in v11.2. Root cause: per-message `querySelectorAll` scoping missed images that live outside `getUserMessages()` elements. Fix: `imageSelectorScope:'document'` flag added to both platforms; document-wide query with ancestry-based message association. Grok selector also refined to exclude profile picture avatars.

**v11.2 Accomplishments (2026-03-12):**
- **Image Gallery Platform-Specific Selectors:** Added `imageSelector` to Claude, ChatGPT, Grok, Gemini, and Perplexity platform configs. Perplexity marked `null` (explicitly unsupported — attachments are text labels, not `<img>` tags). Firefox/Windows CI timeout fixed (10s → 20s).

**v11.1 Accomplishments (2026-03-12):**
- **Context Bar Accuracy — System Overhead Fix:** `_estimateClaudeOverhead()` returns 30K tokens for standard chats and 50K for Claude Projects. Previously hardcoded at 15K, causing the bar to underreport by 15–35K tokens. Applied to both Path A (exact SSE) and Path B (estimated).

**v11.0 Accomplishments (2026-03-10):**
- **ES5 Compliance Fix:** `const PLATFORMS` → `var PLATFORMS`. The only ES5 violation in the entire ~6,400-line file. Fixed before public release.
- **`useOrbital` Into Registry:** Moved the orbital-vs-legacy decision from a hardcoded 5-item array (`['claude','chatgpt','grok','gemini','perplexity'].indexOf(...)`) into the platform registry as a `useOrbital: true/false` property on each of the 12 platform configs. All platforms now declare their UI tier explicitly; the derivation is `var useOrbital = !!platform.useOrbital`.
- **Dead Code Removed:** Three functions that were defined but never called: `migrateOldSettings()` (old storage key migration, never wired up), `getAllMessagesOrdered()` (superseded by `_sumBuildTimeline()`), `predictNextCycleLength()` (turn counter prediction, never invoked).
- **`window.generateFullSummary` Removed:** Internal function was unnecessarily exposed on the global `window` object. All callers use closure scope within the same IIFE.
- **`data-acn-version` Fixed:** Three zone element attribute sites were hardcoded to `'10.0'` instead of using `ACN_VERSION`. All now reflect the actual version.
- **Startup Log Fixed:** Console banner was hardcoded `v10.7` since the v10.7 release — now uses `ACN_VERSION`.
- **Redundant ternary fixed** in `formatResetTime`: both branches did `new Date(resetsAt)`.
- **Duplicate CSS Removed:** First `.acn-exp-opt` definition in `orbInjectCSS()` was dead (overridden by the second in the same stylesheet).
- **Expanded Test Contract:** Added `data-acn-ui="orbital"|"legacy"` on zone elements and `data-acn-dot="nav|search|bookmarks|summary|tools|settings"` on each orbital dot.
- **Two New Tests (168 → 189 total):** Test 13 verifies each platform gets the correct UI system (orbital vs legacy). Test 14 verifies all 6 orbital dots rendered (orbital platforms only).

**v10.16 Accomplishments (2026-03-10):**
- **Segmentation Cold-Start Fix:** Added a post-merge pass to `_sumBuildConversationMap` that absorbs fragments < 3 messages into their most topically similar neighbor before applying the 5-segment cap. Eliminates the window reset bias where every topic shift caused cascading 1-2 message fragments. A 20-message deep-dive now produces one big block instead of `[1][1][2][15]`. The map reflects actual conversation shape in all patterns: big/small/big, all-random, single-topic.

**v10.15 Accomplishments (2026-03-10):**
- **Proportional Map Alignment:** Replaced marginTop-based spacing with `flex-grow` on both left sub-segments and right snapshot messages, weighted by content line count. `updateSnapshot` uses live `getBoundingClientRect` to align the snapshot zone top with the sub-segment area start. Both sides now fill their rows proportionally — no more clustered sub-segments with empty space below.
- **Hover Highlighting:** Hovering a sub-segment glows its corresponding snapshot messages orange (`acn-snap-highlight`). Hovering a parent block (no sub-segments) highlights all its snapshot messages. Cross-references are built at render time — no DOM queries on hover.
- **Content-Driven Sub-Segmentation:** Raised threshold 0.27 → 0.42. Raised minimum segment size 8 → 12 messages. Added post-merge pass to absorb fragments < 3 messages into their neighbor. Result: topic blocks split only on genuine vocabulary divergence.
- **Segment Merge Cap:** Lowered 10 → 5 top-level segments. Map feels like a summarized overview, not a list.
- **Topic Pills Removed:** Eliminated redundant `.acn-seg-d2-pill` elements from leaf segments — labels alone identify topics without visual noise.
- **Code Quality:** Extracted `_sumMsgLines(text)` helper (line-count formula was inlined 3×) and `_sumAttachHighlight(el, msgEls)` helper (hover loop was duplicated 2×). ResizeObserver cleanup interval tightened from 2000ms → 500ms.

**v10.12 / v10.13 Accomplishments (2026-03-10):**
- **Summary Section Order:** Reordered summary panel sections to Stats → Topics → Conversation Map → Key Points → Code & Files. Map now appears above key points so users see the visual overview first.
- **Map Overflow Fixed:** Removed fixed container height from the D2 bracket map. Segments now use proportional `min-height` (`(seg._lineCount / totalLines) * 600px`) so they expand freely and the panel scrolls to accommodate long conversations. Eliminates segment overlap caused by children/pills overflowing fixed flex slices.
- **Drag Performance:** Orbital zone drag now moves via CSS `transform: translateY()` on every mousemove (GPU-composited, no layout reflow). `orbRender()` fires once on mouseup to finalize dot positions.
- **Userscript Name Permanently Fixed:** Removed version number from `// @name` header. Field is now permanently `AI Conversation Navigator` with no version suffix — prevents Tampermonkey from creating duplicate installs on each update. Version is tracked only in `// @version` and `ACN_VERSION`.
- **Pivot Phrase Narrowed:** Removed bare `pivot` from `PIVOT_PHRASES` regex; added explicit forms `let's pivot` and `pivot to`. Tightened `unrelated` → `unrelated question` and `something else` → `something else entirely` to reduce false positives on technical vocabulary.
- **Snapshot DOM Cap:** Snapshot bars per message capped at 15 lines in both the `_lineCount` accumulator and the snapshot DOM loop, preventing DOM blowups from large code blocks or pasted logs.
- **Sub-Segments Preserved on Merge:** `_sumMergeExcessSegments` now recomputes `children: _sumBuildSubSegments(mergedMsgs)` on the combined message list when two segments are merged, so nested bracket data is never dropped.

**v10.11 Accomplishments (2026-03-10):**
- **Pivot Detection:** User messages containing phrases like "by the way", "switch gears", "new topic", etc. now force a hard segment break in the conversation map, independent of word-overlap score. Bare "pivot" intentionally excluded — only explicit transition forms like "let's pivot" and "pivot to" match, to avoid false positives on technical terms like "pivot table".
- **Sub-Segment Generation:** Added `_sumBuildSubSegments()` — a secondary segmentation pass (threshold 0.27) on segments with 8+ messages that produces nested `children[]` for parent segments. Children are preserved when segments are merged by `_sumMergeExcessSegments` (recomputed on the combined message list).
- **Dynamic Key-Point Cap:** Key points now scale with conversation length: `Math.max(1, Math.min(10, floor(totalMessages/4)))`. Short conversations get 1–3 key points instead of flooding the panel with 10.
- **D2 Nested Bracket Map:** The flat card list is replaced with proportional `[` brackets. Each segment's height scales by total text lines (`flex-grow = ceil(textLength/80)`, capped at 15 lines per message to prevent DOM blowups from large code blocks or pasted logs). Parent brackets show label + meta; child segments indent 10px with thinner 1.5px/0.3-opacity brackets. Topic pills on leaf segments only.
- **Conversation Snapshot Column:** A second column renders each message as tiny text-line bars (accent color for user, gray for AI), capped at 15 lines per message. Appears when panel width ≥ 420px, scales 70–160px wide, live-updated by `ResizeObserver`. Both columns share the same `flex-grow` values for vertical sync.
- **Merge Cap:** `_sumMergeExcessSegments` lowered from 12 → 10 segments max.
- **Drag Performance:** The orbital zone drag now moves the zone via CSS `transform: translateY()` on every mousemove (GPU-composited, no layout reflow) instead of calling `orbRender()` per frame. `orbRender()` fires once on mouse release to finalize dot positions.
- **Userscript Name Fixed:** `// @name` header field (displayed in Tampermonkey's extension list) was stuck at v10.9 through two version bumps. Now aligned with `// @version` and `ACN_VERSION`.

**v10.10 Accomplishments (2026-03-10):**
- **Draggable Orbital Zone:** Click-and-hold anywhere in the orbital toggle zone and drag vertically to reposition the entire button cluster. Uses a 5px movement threshold to distinguish drag from click. Position persists per-platform as a viewport-height ratio via `GM_setValue('acn-zone-positions')` so it adapts across screen sizes. Drag limits calculated from full expanded height in show-all mode. Global drag handlers attached once via `_orbGlobalHandlersAttached` guard — no stacking on SPA reinjection. Stuck drag state cleared on `window blur`. Click-suppression canceller auto-removed after 300ms to prevent swallowing the next real click.
- **Summary Panel Overhaul:** Three sections tightened to reduce noise. (1) Topics: cap reduced from 15 → 8. (2) Key Points: cap reduced from 20 → 10; removed overly broad action patterns (`try`, `run`, `install`, `build`, etc.); removed `actually` from finding patterns; narrowed `because/reason/why` to specific phrasings; minimum sentence length raised from 20 → 40 characters. (3) Conversation Map: replaced fixed 4-message sliding window with content-aware topic-shift segmentation — uses `_sumWordOverlap` (threshold 0.15) against a 4-message context window of the current segment; long deep-dives stay as one block, off-topic tangents split naturally; merge pass caps at 12 segments. Removed `SEGMENT_ICON_MAP` and icon prefixes from segment labels entirely.
- **Documentation Audit:** Fixed stale version numbers, terminology ("sidebar" → "orbital button cluster"), missing features (context window bar, /commands, i18n, plan usage), and privacy section inaccuracies across README, ROADMAP, CLAUDE.md, and agent_docs.

**v10.9 Accomplishments (2026-02-23):**
- **SSE Plumbing Fully Fixed:** v10.8's `unsafeWindow` fix was necessary but not sufficient. Two more bugs found through 10-step live debugging: (1) cross-realm `Uint8Array` — Tampermonkey's sandbox TextDecoder silently returns empty strings for page-realm typed arrays; fixed by copying bytes into sandbox realm with `new Uint8Array(result.value)`. (2) `\r\n` line endings — Claude SSE uses `\r\n`, not `\n`; split regex `/\n\n/` never matched. All plumbing now confirmed working.
- **Dead End Confirmed: No Token Usage in Claude Web SSE.** After fixing all plumbing, `message_start` events parse successfully but contain no `usage` field — no `input_tokens`, no `output_tokens`. Claude's web UI strips this from the SSE stream. It only exists in direct API responses. This is a permanent dead end for exact token tracking from a userscript. Do not re-investigate.
- **Hybrid Context Bar:** Uses `DOM_visible_text/4 + system_overhead(15K) + cumulative_SSE_thinking/4`. Extended thinking text (invisible in DOM, hidden behind collapse toggle) is now captured via `thinking_delta` SSE events and accumulated cumulatively across the entire conversation. Bar never resets — serves as "how close to trouble" indicator. Label shows `(hybrid)` with `~` prefix. Cached across page reloads via GM storage.
- **Claude Gets Turn Dots + Compaction Count:** Claude now shows both the hybrid percentage bar AND the turn dots + compaction count system. Two complementary signals: bar = cumulative usage trend, compaction count = degradation warning. Claude is the only platform with both (non-Claude continues showing turn dots only).
- **Debug Log Cleanup:** All `[ACN-SSE]` diagnostic console.log statements removed.

**v10.8 Accomplishments (2026-02-23):**
- **SSE Interceptor Partially Fixed:** `setupClaudeSSEInterceptor()` now patches `unsafeWindow.fetch` (real page window). This was necessary but not sufficient — two more bugs remained (fixed in v10.9).
- **Claude GM Cache:** Token data persisted per conversation to `GM_setValue('acn_ctx_cache', {...})` keyed by conversation UUID. On reload or SPA navigation to a known conversation, shows `(last known)` label. Cache pruned to 50 most recent conversations by timestamp.
- **Non-Claude: Turn Dots Only:** Removed misleading estimated percentage bar from Path C. DOM estimation can undercount by 15–20× on tool-heavy or search-augmented conversations. Non-Claude platforms now show turn dots with compaction prediction only.
- **Arc Mode Hitzone Geometry Fixed:** `orbUpdateHitzone()` is now mode-aware. Arc mode uses `arcWidth = 177px`. Show-all/wheel use `96px`.
- **Turn Counter SPA Reset:** Added `resetTurnCounter()` helper. Called in SPA navigation handlers. `updateTurnCounter()` also has a shrinkage guard as defensive fallback.

**v10.7.x Accomplishments (2026-02-23):**
- **Bookmarks Panel (fully functional):** Persistent message bookmarking across page reloads and script updates. Stored via `GM_setValue('acn-bookmarks-v1')` — survives script updates, browser restarts, and SPA navigation. Includes bookmark icon injection on all messages, panel list with click-to-scroll, and per-conversation storage.
- **Full Conversation Export:** Walks entire conversation DOM, converts to Markdown with heading structure, downloads as `.md` file. Handles SVG elements in Claude.ai's toolbar (SVGAnimatedString fix).
- **Panel Resize:** Drag panel's left edge to resize between 240–640px. Persists to `localStorage._acnv10.panelWidth`. CSS variable `--acn-panel-w` is the single source of truth for both panel width and zone offset.
- **Chat Input /Command Detection:** Typing `/commandname` in the chat input opens the command palette pre-filtered. Updates live as you type. Closes if text is cleared or no command matches.
- **Image Gallery:** Scans conversation for image attachments, displays in Tools panel with count. Lazy-renders on panel open (no injection-time render).
- **Plan Usage Bar:** Fetches Claude plan utilization (session/weekly/7-day) and displays as progress bars in Navigate panel. Auto-refreshes after generation completes.
- **Summary Auto-Generation:** Summary panel auto-generates content on open if empty.
- **i18n:** Korean language support. All labels, panel headers, and dot tooltips update live on language switch without page reload.
- **Context Window Estimation — Extended Thinking Correction:** Path B estimation now corrects for Claude's invisible overhead: system prompt (+15K tokens) and extended thinking blocks (count × 600 tokens). Combined with virtual-scroll coverage-ratio correction. See `docs/claude_specific_context_tracking_calculation.md` for full methodology.
- **Hover Stability:** Fingerprint guards on Search (`_searchListFingerprint`) and Bookmarks (`_bmListFingerprint`) panels prevent DOM teardown on MutationObserver cycles. Navigate panel guard was already present.
- **Bookmark Icon Visibility:** Fixed two distinct hover visibility bugs — active icon losing orange on hover (CSS specificity), and non-active icon camouflaging against light backgrounds (wrong hover background color).

**v10.0 Accomplishments (2026-02-22):**
- **Orbital Button System:** Six feature dots (Navigate ✳, Search ⌕, Bookmarks ⚑, Summary Σ, Export ↗, Settings ⚙) in three display modes — show-all, arc, wheel. Scroll wheel rotates arc/wheel focus. Settings persist to localStorage.
- **Dual-System Architecture:** Orbital UI for the 5 primary AI platforms (Claude, ChatGPT, Grok, Gemini, Perplexity). Legacy ghost-notch button for the 7 app-builder platforms.
- **Live Testing Fixes:** isLeftChat button-panel sync across 4 code sites; Bolt.new scrollbarOffset open-state bug; V0 light mode visibility (textColor + toggleBorder); arc mode labels below dot via `data-acn-mode` CSS; panel z-index above orbital dots.
- **Context Window Bar:** DOM walk to scroll container reads full conversation (user + AI) text; CTX_LIMITS per platform; green/amber/red color coding.
- **Font Unification:** `system-ui` stack set on `.acn-zone` root; all children inherit consistently across all 14 platforms.
- **Contract-Based Tests:** `data-acn-role` / `data-acn-*` attributes are the stable test interface — 14 platforms × 12 tests = 168 total at launch (expanded to 189 in v11.0). Tests survive complete UI rewrites as long as the contract attributes are maintained.
- **Full CI Matrix:** GitHub Actions runs Playwright across 3 OSes (ubuntu, macos, windows) × 3 browsers (chromium, firefox, webkit) = 9 checks on every PR.

**v9.4 - v9.6 Accomplishments (historical):**
- **Universal Search (v9.4):** High-performance keyword search across 14 platforms using DOM `TreeWalker`.
- **Trusted Types Security (v9.6):** Refactored UI engine for strict Content Security Policy compliance.
- **Left-Chat Synchronization (v9.6):** Solved panel animation desync for Bolt.new, Lovable, Replit, and V0.

**v8.0 Architecture: Platform Registry**
All platform-specific data is consolidated into a single `PLATFORMS` registry. Adding a new platform requires only one entry in the registry (plus a `@match` URL).

**All platforms working:**
- Claude, ChatGPT, Codex, Grok, Gemini, Perplexity — selectors validated on live sites
- Lovable, Base44 — selectors working correctly on live sites
- Bolt.new — `data-message-id` + `self-end` pattern, excluding subscription warnings
- Replit — `data-cy="user-message"` with homepage guard (skip non-project pages)
- V0 — `data-testid="message"` filtered by `origin-right` + `items-end`
- Emergent — `data-testid^="user-message"` with virtuoso-specific boundary detection and accumulative scanning
- Firebase Studio — cross-origin iframe injection into workspace iframe (`/capra/` path discrimination), `[class*="_isUser_"]` CSS module selectors

**Documentation:**
- `DOM-REFERENCE.md` — real DOM structures of all 14 platforms with selector rationale and debugging history
- `CHANGELOG.md` — detailed technical changelog with root cause analysis for every fix
- `TROUBLESHOOTING.md` — platform-specific diagnostic guides
- `DECISIONS.md` — architectural decision log (DEC-001 through DEC-020)
- `docs/claude_specific_context_tracking_calculation.md` — deep-dive on Claude context window estimation methodology

---

## Platform Risk Model — Three Layers of Breakage

This project lives inside other companies' web applications. We don't control the host environment. Through 200+ commits of cross-platform work, we've identified three distinct categories of breakage, each requiring different detection and mitigation strategies. Understanding these layers is critical for planning defensive infrastructure and the eventual extension transition.

### Layer 1: DOM Breaks — "Selectors stop matching"

**What happens:** A platform updates its HTML structure — class names change, `data-testid` attributes are renamed, elements move to different containers. Our `getUserMessages()`, `getAIMessages()`, and `imageSelector` queries return empty results. Features degrade (0 questions detected, empty image gallery) but the host page continues working normally.

**Examples:** Claude moved uploaded images from conversation turns to a hidden files panel (v11.4). ChatGPT migrated image hosting from `files.oaiusercontent.com` to `backend-api/estuary/content` (v11.4). Gemini, Grok, and Perplexity all broke image gallery detection due to DOM restructuring (v11.2–v11.3).

**Detection:** Automated DOM validation framework (planned) — crawl live sites, compare selectors against known structures, flag mismatches.

**Mitigation:** Fallback selector chains in the PLATFORMS registry. Per-platform `imageSelector` and `imageSelectorScope` configs. Mock page updates to match real DOM. This is the most common break type and the one we're best equipped to handle.

### Layer 2: Feature Breaks — "Platforms ship what we built"

**What happens:** A platform adds native functionality that overlaps with ours — built-in bookmarks, conversation search, export buttons, navigation shortcuts. Our tool becomes redundant for that specific feature on that specific platform, or worse, conflicts with it visually or functionally.

**Examples:** Claude's March 2026 Visualizer update adds inline charts/diagrams that could eventually overlap with our Summary panel's conversation map. ChatGPT experimented with plugins and canvas features. Gemini has native conversation organization.

**Detection:** Manual monitoring of platform changelogs and feature announcements. No automated detection possible — these are product decisions, not DOM changes.

**Mitigation:** Design features that complement rather than duplicate. Focus on cross-platform consistency (our value is working the same way across 14 platforms — no single platform will match that). Be prepared to gracefully disable specific features per-platform if they conflict.

### Layer 3: Execution Breaks — "Our code prevents the page from loading" ⚠️ NEW

**What happens:** A platform changes its JavaScript bundle, Content Security Policy, or security headers in ways that cause our injected code to crash the host page entirely. The platform doesn't just ignore us — it *dies* because of us. This is qualitatively different from Layers 1 and 2: those degrade our features, this kills the user's ability to use the platform at all.

**First occurrence:** v11.6 (2026-03-14). Claude shipped a new vendor bundle (Visualizer feature) that called `.bind()` on `fetch` during React initialization. Our `unsafeWindow.fetch` replacement was a Tampermonkey sandbox-compartment function. Firefox blocks cross-compartment `.bind()` — Claude's entire frontend crashed to a black screen. Chrome was unaffected due to its more permissive cross-compartment model. See TROUBLESHOOTING.md and DEC-019 for full technical details.

**Why this will happen again:** Anthropic disclosed in February 2026 that Chinese AI labs (DeepSeek, Moonshot, MiniMax) ran industrial-scale distillation attacks against Claude using 24,000 fraudulent accounts and 16 million exchanges via proxy services. Anthropic is now actively hardening security — tightening CSP headers, updating vendor bundles, adding integrity checks. From a security perspective, our userscript's injection pattern (replacing `window.fetch`, patching `history.pushState`) looks identical to what proxy services do. Other platforms will likely follow similar security hardening trends as the AI industry matures.

**Detection:** Cannot be caught by DOM validation — the DOM never renders. Requires actual browser testing with the script loaded against live sites. Playwright tests against mock pages won't catch this because mocks don't have real vendor bundles or CSP headers.

**Mitigation (userscript era):**
- `exportFunction()` wrapping for all replaced page globals (DEC-019 convention)
- Minimize page-global monkey-patching — every replaced function is a potential future crash point
- Investigate alternatives to `unsafeWindow.fetch` interception (e.g., `GM_xmlhttpRequest` for independent SSE monitoring)

**Mitigation (extension era — reduces but does not fully eliminate this vulnerability class):**
- Content scripts run in an **isolated world** with explicit browser support — not through a Tampermonkey sandbox workaround. The isolated world shares the page's DOM but has a separate JavaScript context. Functions injected from the isolated world into the page (via `world: "MAIN"` content scripts) don't suffer from the cross-compartment `.bind()` problem that caused v11.6's crash.
- **SSE interception still requires fetch patching.** `webRequest` / `declarativeNetRequest` APIs only provide request/response metadata (headers, URLs, status codes) and rule-based blocking — they do NOT expose response body content. Since our context tracking depends on parsing SSE response body chunks (`thinking_delta` events), an extension would still need to intercept `fetch` from a `world: "MAIN"` content script. The difference: this runs through the browser's official content script injection, not Tampermonkey's sandbox hack.
- **SPA navigation is fully solved:** `webNavigation.onHistoryStateUpdated` API fires on pushState/replaceState changes — no need to monkey-patch `history.*` at all.
- Extension APIs like `chrome.scripting` handle injection in a way the browser is designed to support
- CSP changes that would break extensions would also break password managers, accessibility tools, and ad blockers — platforms generally won't go that far

### Layer severity comparison

| Layer | What breaks | Severity | Frequency | Detectable automatically? |
|-------|------------|----------|-----------|--------------------------|
| DOM breaks | Our features degrade | Medium | High (monthly) | Yes — planned DOM validation framework |
| Feature breaks | Our features become redundant | Low | Low (quarterly) | No — requires human monitoring |
| Execution breaks | Host page crashes entirely | **Critical** | Low but increasing | No — requires live browser testing with real vendor bundles |

The key insight: **DOM validation is necessary but not sufficient.** A project that only watches for selector changes will be blindsided by execution breaks. Live-site smoke testing with the actual script loaded (not just mock pages) is the only way to catch Layer 3 issues before users do.

---

## Extension Transition (WXP) — Strategic Context

The current userscript architecture has a fundamental limitation: it operates as a guest in the page's security context, patching globals through `unsafeWindow` and relying on Tampermonkey's sandbox model. This worked when platforms had relaxed security postures. As platforms harden their frontends (see Layer 3 above), this approach becomes increasingly fragile.

### Why native extensions solve Layer 3

Native browser extensions (Chrome Web Store, Firefox Add-ons, Safari App Store) operate through official browser APIs that are designed for third-party code to observe and modify web pages:

- **Network observation (partial):** `webRequest` API monitors HTTP traffic metadata (headers, URLs, status codes) from the background script, but does **not** expose response body content. For SSE body parsing (which our context tracking requires — `thinking_delta` events, token data), the extension would still need to intercept `fetch` via a `world: "MAIN"` content script. The key improvement: this injection runs through the browser's official content script mechanism, not Tampermonkey's sandbox compartment, so the cross-compartment `.bind()` crash (v11.6) cannot occur.
- **Content script isolation:** Chrome's "isolated world" and Firefox's content script model provide clean separation without the cross-compartment `.bind()` problem that caused v11.6's crash.
- **CSP immunity:** Content scripts injected by extensions are exempt from the page's Content Security Policy. Even if a platform adds `script-src 'nonce-xxx'` that blocks all inline scripts, extension content scripts still run.
- **Proper storage:** `chrome.storage` / `browser.storage` replace `GM_setValue` with sync-capable, quota-aware storage.

### When to transition

The userscript remains the right choice for rapid iteration — one file, instant deployment, no review process. The extension transition makes sense when:

1. **Feature set stabilizes** — no major new panels or features planned
2. **Layer 3 breaks become frequent** — if multiple platforms start breaking monthly due to security changes, the maintenance cost of `exportFunction` workarounds exceeds the cost of extension packaging
3. **User base grows beyond tech-savvy early adopters** — "install Tampermonkey, enable Developer Mode" is a barrier for non-technical users
4. **Automated DOM validation framework is built** — the extension should ship with built-in DOM health checks, not bolt them on later

### What transfers and what doesn't

| Component | Transfers to extension? | Notes |
|-----------|------------------------|-------|
| PLATFORMS registry | ✅ Directly | manifest.json `content_scripts.matches` replaces `@match` headers |
| `getUserMessages()` / `getAIMessages()` | ✅ Directly | Same DOM queries, same fallback chains |
| Orbital UI system | ✅ Directly | Same CSS, same render engine |
| All 6 panel features | ✅ Directly | Navigate, Search, Bookmarks, Summary, Tools, Settings |
| SSE fetch interception | ⚠️ Simplified | Still requires fetch patching via `world: "MAIN"` content script (webRequest cannot read response bodies), but runs through official browser injection — no `unsafeWindow` or `exportFunction` needed |
| SPA history patches | ❌ Replaced | `webNavigation.onHistoryStateUpdated` API — no `history.pushState` patching |
| `GM_setValue` / `GM_getValue` | ❌ Replaced | `chrome.storage.local` / `browser.storage.local` |
| `exportFunction` workarounds | ❌ Eliminated | Not needed — content scripts use proper isolation |

The core product logic (~90% of the codebase) transfers directly. The ~10% that doesn't is precisely the fragile layer that causes execution breaks.

---

## Future: General Feature Ideas

- [ ] Keyboard shortcuts for navigation
- [x] Export conversation outline (stub panel exists in v10.0)
- [x] Bookmarks panel (stub panel exists in v10.0)
- [x] Conversation summary panel (stub panel exists in v10.0)
- [x] ~~Per-platform accent colors for app-builder platforms~~ (each app-builder platform has its own accent color in the PLATFORMS registry — Bolt sky blue, Lovable violet, Replit red-orange, V0 white, Base44 indigo, Emergent emerald, Firebase Studio dark tangerine)
- [ ] Convert to a standalone browser extension (beyond userscript)
- [x] Korean translated language mode for mom
- [ ] More translated language support in settings (?)
- [ ] Project overview, or chat links view (?) when we are outside of conversation view

---

*Last updated: 2026-03-16 (v11.8)*

