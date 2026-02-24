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

## Current Status: v10.9

The extension supports 14 platform variants across 12 websites. v10.9 completes the SSE investigation that began in v10.8 and ships a hybrid context bar for Claude using SSE thinking data.

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
- **Contract-Based Tests:** `data-acn-role` / `data-acn-*` attributes are the stable test interface — 14 platforms × 12 tests = 168 total. Tests survive complete UI rewrites as long as the 9 contract attributes are maintained.
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
- `DECISIONS.md` — architectural decision log (DEC-001 through DEC-017)
- `docs/claude_specific_context_tracking_calculation.md` — deep-dive on Claude context window estimation methodology

---

## Future: General Feature Ideas

- [ ] Keyboard shortcuts for navigation
- [ ] Export conversation outline (stub panel exists in v10.0)
- [ ] Bookmarks panel (stub panel exists in v10.0)
- [ ] Conversation summary panel (stub panel exists in v10.0)
- [ ] Per-platform accent colors for app-builder platforms
- [ ] Convert to a standalone browser extension (beyond userscript)

---

*Last updated: 2026-02-23 (v10.9)*

