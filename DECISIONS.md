# Architectural Decisions

This file captures the major design and architectural decisions made during development of the AI Conversation Navigator. Each entry documents what was decided, why, what alternatives were considered and rejected, and what constraints future sessions need to respect.

Entries are numbered sequentially. Check the last DEC-NNN before adding new ones.

---

## DEC-001: Complete UI Rewrite Rather Than Incremental Patching (v10.0)
**Date:** 2026-02-22 | **Stage:** v10.0 sprint

### Decision
Stripped the entire v9.x button/sidebar/context-tracking UI from the codebase before building the orbital system, rather than building on top of the existing code.

### Context
The v9.x codebase (~2,369 lines) had accumulated architectural debt across multiple AI assistant development sessions. Three separate button UI systems coexisted (the Navigate button from v6.x, the context/token tracking bar from v9.0–9.3, the search button from v9.4). Button injection callbacks were wired directly into MutationObserver callbacks and the scan function, making it impossible to reason about which event triggered which UI change. The task brief (`CLAUDE-CODE-PROMPT.md`) explicitly stated "The goal is NOT to patch on top of this."

### Alternatives Considered

**Alternative: Surgical extraction** — identify the specific lines responsible for old button creation, comment them out or delete them, and build the orbital system alongside the remaining code. *Rejected because:* the entanglement between detection logic and rendering logic meant there were no clean seams to cut. MutationObserver callbacks simultaneously triggered scanning and rendering; extracting one without the other would require extensive untangling that amounted to a rewrite anyway. Surgical patches on deeply entangled code tend to leave dead branches and confusing control flow.

**Alternative: Keep context tracking** — preserve the v9.0 context/token tracking feature (fetch interception, token estimation, DOM rendering) and build orbital UI on top. *Rejected because:* the context tracking button was one of the features driving the entanglement; its own injection path conflicted with the orbital zone's injection. The task brief noted it would "eventually live inside the Navigate panel's context bar" as future work, not v10.0.

### Rationale
A clean foundation prevents future sessions from inheriting v9.x's failure modes. The Phase 1 result — 959 lines that detected platforms and found questions but rendered nothing — gave a verifiable baseline: if question detection breaks later, it's because of changes to the Phase 1 engine, not confusion about which UI code might have side effects.

### Key Properties
- Phase 1 and Phase 2 have a single defined interface: `_questions[]` array of `{ element, text, summary }` objects
- All UI code in Phase 2 reads from `_questions[]` but never modifies the detection logic
- Restoring this separation in future sprints: if question detection and UI rendering ever become coupled again, treat it as technical debt to fix

---

## DEC-002: Platform Abstraction Layer — Adapter Pattern for Message Access (v10.0)
**Date:** 2026-02-22 | **Stage:** v10.0 sprint

### Decision
All platform-dependent DOM access (reading messages, scrolling to messages, finding code blocks, finding links, checking streaming state) must go through a single abstraction layer:

```javascript
getPlatformAdapter(platform) → {
    getMessages()      → [{ element, text, role, index }]
    scrollToMessage(index)
    getCodeBlocks()    → [{ element, language, text }]
    getLinks()         → [{ element, href, text }]
    isStreaming()      → boolean
}
```

For platforms where selectors aren't fully verified, the adapter returns empty arrays rather than throwing — panels show "Platform not fully supported yet" rather than crashing.

### Context
The v10.0 orbital system has 6 panels: Navigate, Search, Bookmarks, Summary, Export, Settings. All but Settings depend on reading conversation messages. All 14 platforms structure their messages differently. Without abstraction, every panel would need 14 platform-specific code paths. A single platform DOM change would require updating 5 separate panels.

### Alternatives Considered

**Alternative: Direct DOM queries in each panel** — each panel calls its own `querySelectorAll` with hardcoded selectors per platform. *Rejected because:* the only reason this was tolerable in v9.x is that there was only one panel. With 6 panels, this multiplies the selector maintenance surface by 6x. A Gemini DOM update would require auditing all 6 panels.

**Alternative: Shared selector constants, no adapter** — define platform selector strings as constants, import them in each panel. *Rejected because:* this still couples panels to selector implementation; selector constants don't handle the filtering logic (e.g., ChatGPT's filter by `data-message-author-role === 'user'`). Each panel would still need platform-conditional branching.

### Rationale
Single abstraction layer means: fix the adapter for a platform → all 6 features work. Break the adapter for a platform → all 6 features degrade gracefully with a message rather than crashing. Adding a 7th feature automatically works across all platforms that have working adapters.

### Key Properties
- Feature code (Navigate, Search, etc.) must never call `document.querySelectorAll` directly for message content
- If a platform's adapter returns empty arrays, panels must display a fallback message rather than rendering an empty list with no explanation
- The adapter interface is defined in the task spec (`CLAUDE-CODE-PROMPT.md`) and should not be changed without updating it

---

## DEC-003: Contract-Based DOM Testing via `data-acn-*` Attributes (v10.0)
**Date:** 2026-02-22 | **Stage:** v10.0 sprint

### Decision
The userscript publishes a stable set of `data-acn-role` and `data-acn-*` attributes on key DOM elements. The test suite queries only these attributes — zero internal CSS class names, zero internal element IDs. Future UI rewrites can change every internal ID and class in the script without breaking the tests, as long as the 9 role attribute assignments are maintained.

### Context
The pre-v10.0 test suite (`tests/test-all-platforms.js`) was written against v9.x internal element IDs like `#ai-nav-button-container`, `#ai-nav-panel`, `.ai-nav-item`. These broke immediately when v10.0 introduced `#acn-zone`, `.acn-dot`, `.acn-qi`. The first v10.0 test rewrite still used internal IDs — those would break again on v11.0. The user explicitly asked for tests that "test whatever the newest version or updated version of the code we would've created. Whether it is v10 or v11 or v50."

### Alternatives Considered

**Alternative: Keep using internal IDs/classes, rewrite tests on each major version** — the simplest approach. *Rejected because:* the user explicitly identified this as the problem to solve. Internal IDs are implementation details; coupling tests to them means every UI rewrite requires a test rewrite, making the test suite a maintenance burden rather than a safety net.

**Alternative: Screenshot-based visual regression tests** — compare screenshots of the rendered UI against reference images. *Rejected because:* harder to set up in the Playwright headless environment, brittle to rendering engine differences across OS/browser combinations, and doesn't verify behavior (click, count, text content) — only appearance.

**Alternative: End-to-end tests against live sites** — navigate to real claude.ai, chatgpt.com, etc. and run assertions. *Rejected because:* requires a live network connection, is subject to site structure changes outside our control, can't be run offline or in CI without credentials/sessions, and is much slower than mock-page tests.

**Alternative: Aria roles / accessible names for test targeting** — use `role="dialog"`, `aria-label="navigate"` etc. as the test interface. *Considered favorably* but not chosen as primary approach because aria attributes carry semantic meaning that would need to be carefully designed to not mislead screen readers. The `data-acn-*` namespace is clearly test-infrastructure, not accessibility semantics, reducing the risk of misuse.

### Rationale
`data-acn-role` attributes are a stable public interface that the script author explicitly maintains. Unlike internal IDs (which might be refactored), these attributes exist specifically to be queried by tests and tooling. The author commits to maintaining them across versions; tests commit to querying only them. Either side can change its implementation details without breaking the other.

### Key Properties — Attributes the script must always maintain

| Attribute | Element | Rule |
|-----------|---------|------|
| `data-acn-role="zone"` | Main container | Must exist after injection |
| `data-acn-role="styles"` | `<style>` element | Must exist after CSS injection |
| `data-acn-role="nav-trigger"` | Navigate trigger button | Must be clickable |
| `data-acn-role="nav-panel"` | Navigate panel element | Must receive `data-acn-open="true"` when open |
| `data-acn-role="nav-stat"` | Question count display | Must have `data-acn-count="N"` attribute |
| `data-acn-role="nav-list"` | Question list container | Must exist inside nav-panel |
| `data-acn-role="nav-item"` | Each question row | Count must equal detected questions |
| `data-acn-role="nav-item-text"` | Question display text | Must be non-empty for each question |
| `data-acn-role="panel-close"` | Close buttons | Click must remove `data-acn-open` |
| `data-acn-open="true"` | Open panels | Added on open, removed on close |
| `data-acn-count="N"` | nav-stat | Numeric string, updated when questions change |
| `data-acn-accent="#hex"` | Zone element | Current theme color |
| `data-acn-version="X.Y"` | Zone element | Semantic version string |

---

## DEC-004: Unified Accent Color for App-Builder Platforms in v10.0
**Date:** 2026-02-22 | **Stage:** v10.0 sprint

### Decision
The 5 primary AI platforms (Claude, ChatGPT, Grok, Gemini, Perplexity) each have a verified accent color in `ORB_COLORS`. The 7 app-builder platforms (Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio) fall back to `ORB_COLORS.claude` (`#d97706`) rather than having their own entries.

### Context
The task spec (`ORBITAL-BUTTON-SPEC.md`) notes that per-platform themes are "future work" and instructs: "For now, use Claude's orange theme everywhere. The spec mentions per-platform themes — that's a later task. Get the system working first." The 7 app-builder platforms don't have obvious brand-primary accent colors that would visually distinguish them (unlike Grok's red or Gemini's blue).

### Alternatives Considered

**Alternative: Add explicit ORB_COLORS entries for all 14 platforms immediately** — pick brand colors for Bolt (teal), Lovable (pink/purple), Replit (orange), etc. *Rejected because:* several of these platforms have undergone rebranding and their "official" primary colors are unclear without live site verification. Guessing colors that don't match the actual brand creates visual inconsistency.

**Alternative: Match the platform's own primary UI color by sampling the page** — use `getComputedStyle` on a known platform element to extract the actual brand color. *Rejected as over-engineered for v10.0:* color sampling is fragile (platform UI elements vary by theme/dark mode), adds complexity, and the spec explicitly defers this to future work.

### Rationale
Getting the orbital system working correctly for all 14 platforms takes priority over visual polish for 7 of them. Claude orange works acceptably as a neutral default — it's already the script's primary association color. Per-platform theming can be added incrementally once the system is stable.

### Key Properties
- `var orbTheme = ORB_COLORS[platform.id] || ORB_COLORS.claude;` — this fallback line is intentional
- To add a platform color: add an entry to `ORB_COLORS` with `{ bg, rgb, shadow }` matching that platform's brand
- The `rgb` field is used for CSS `rgba()` constructions in hover states and shadows; it must match the hex in `bg`

---

## DEC-005: CSS Transition Split — 80ms Opacity, 300ms Position (v10.0)
**Date:** 2026-02-22 | **Stage:** v10.0 sprint

### Decision
Orbital dots use two separate CSS transition durations: `opacity 80ms ease` and `transform/position 300ms cubic-bezier(0.34, 1.56, 0.64, 1)`. They are not combined into a single transition.

### Context
In arc and wheel modes, dots move along positional trajectories when the user scrolls. Simultaneously, their opacity changes to reflect their "focus" position. If both opacity and position animate at the same duration, brightness appears to "chase" the moving dot — it starts dim, travels to its destination, and only becomes bright at the end of the position animation. This makes the system feel laggy and dissociated.

### Alternatives Considered

**Alternative: Single transition duration for all properties** — `transition: all 300ms ease` or similar. *Tried conceptually, rejected:* opacity at 300ms means the user doesn't see the brightness change until the animation completes, making it feel like a delayed visual confirmation rather than immediate feedback.

**Alternative: 80ms for all properties** — position AND opacity animate at 80ms. *Rejected because:* position at 80ms with 6 dots moving simultaneously makes the arc/wheel transitions feel abrupt and mechanical rather than fluid.

**Alternative: No transition on opacity, instant brightness change** — 0ms opacity. *Tested mentally:* feels like flickering as the user scrolls through arc/wheel positions. The 80ms gives just enough smoothness without lag.

### Rationale
The 80ms opacity transition makes brightness feel anchored to the dot's current position (it snaps to the right brightness almost immediately) while the 300ms springy position animation gives the motion a physical quality. The split is the single most important parameter for making the orbital system feel like a tangible physical object rather than abstract buttons.

### Key Properties
- The `cubic-bezier(0.34, 1.56, 0.64, 1)` easing for position creates a slight overshoot on arrival (spring feel). Values > 1 on Y-axis are intentional.
- If the transitions feel wrong in a future version, check both values independently — usually one has been accidentally unified or removed
- This split is documented in `ORBITAL-BUTTON-SPEC.md` under "CSS transition split" — that spec is the source of truth for timing values

---

## DEC-006: `scrollbarOffset` Applies Only to Closed-State Button Position
**Date:** 2026-02-22 | **Stage:** v10.0 session 2

### Decision
`platform.scrollbarOffset` is added to the `right` calculation only when the button is in the closed state (not showing the panel). When the panel is open, the button is positioned at `(window.innerWidth - _lastBoundaryX + 320)px` — the panel width, no offset.

### Context
Bolt.new has `scrollbarOffset: 16`. This was originally added in v9.6 to prevent the button from being occluded by the OS native scrollbar, which draws on the right side of Bolt's chat pane. When the isLeftChat button-panel sync fix was added (the button now tracks with the panel when open), the open-state formula accidentally included the offset, placing the button 16px further left than the panel's left edge.

### Alternatives Considered

**Alternative: Include the offset in both states.** The offset would then apply to both where the button rests (closed) and where it parks when open. *Rejected because:* the semantics are wrong. `scrollbarOffset` compensates for scrollbar width at the chat boundary. The panel's left edge has no scrollbar — applying the offset there is meaningless and creates visible misalignment.

**Alternative: Remove `scrollbarOffset` entirely and let the button sit at the exact boundary.** *Rejected because:* on Bolt with OS scrollbars enabled, the button literally overlaps the scrollbar track without the offset. The scrollbar renders on top of the button, making the rightmost part of the button unclickable.

### Rationale
The closed formula `(innerWidth - boundaryX + scrollbarOffset)` and the open formula `(innerWidth - boundaryX + 320)` serve different purposes. They look similar but are computing different things — the offset is about clearing the scrollbar at the boundary, and 320 is about aligning with the panel's known width. Keeping them separate and named makes their intent clear.

### Key Properties
- Closed: `right = (window.innerWidth - _lastBoundaryX + (platform.scrollbarOffset || 0)) + 'px'`
- Open: `right = (window.innerWidth - _lastBoundaryX + 320) + 'px'`
- 320 is the fixed panel width (see `#ai-nav-panel` CSS `width:320px`)
- Both formulas must be kept consistent across all 4 code sites that manage the button position: `legacyApplyPosition()`, `handleLegacyToggle()` open branch, `handleLegacyToggle()` close branch, and the DOM guardian callback
- If the panel width ever changes from 320px, all 4 code sites must be updated

---

## DEC-007: Arc Mode Labels Below Dot — CSS Attribute Selector, Not Per-Dot JS
**Date:** 2026-02-22 | **Stage:** v10.0 session 2

### Decision
Arc mode repositions hover labels from left-of-dot to below-dot using a CSS attribute selector on the zone element (`#acn-zone[data-acn-mode="arc"] .acn-lbl { ... }`). The zone element carries `data-acn-mode` set by `orbRender()` on each render. No per-dot JS is needed.

### Context
In arc mode, satellite dots are positioned in a polygon arc on the right edge of the viewport. The default label position (`right: calc(100% + 10px)` — to the left of the dot) places labels in the direction of adjacent arc dots. Labels from neighboring dots overlap each other. The fix needed to apply to all 5 satellite dots simultaneously without touching the per-dot render loop.

### Alternatives Considered

**Alternative: Set label position inline on each dot element in `orbRenderArc()`.** For each satellite dot, after setting its position, also set `dot.querySelector('.acn-lbl').style.right = 'auto'` and set `top`, `left`. *Rejected because:* this mixes layout code (label position) into the orbital layout loop (dot position). It adds 2 DOM queries per satellite per render frame, and it means label position becomes entangled with the animation frame — if `orbRender()` is called 10 times during a scroll, labels are repositioned 50 times unnecessarily.

**Alternative: Store label direction as a property per-mode, switch on `orbMode` at the top of `orbRender()`.** Enumerate the 6 dots and apply the correct label style at mode switch. *Rejected because:* this requires storing a reference to each label element (or querying them) at the top of `orbRender()`. Label position is a presentational concern that CSS is better suited to handle than JS.

**Alternative: Have mode-switch code (`orbSaveSettings()`, wheel/arc toggle handler) update a CSS class on the zone.** Add class `acn-mode-arc` when entering arc mode, remove it otherwise. CSS targets `.acn-mode-arc .acn-lbl`. *Considered favorably, not chosen:* this would also work, but `data-acn-mode` is more semantically clear (it's a data attribute describing state, not a CSS class that implies a style variant). `data-acn-mode` is also now a stable contract attribute that can be used by external tooling or future CSS rules.

### Rationale
`data-acn-mode` is set once per render frame (one `setAttribute` call), and CSS handles all label repositioning automatically. Adding a new mode in the future (e.g., `data-acn-mode="radial"`) just requires a new CSS block — no JS label-positioning code needs updating.

### Key Properties
- `zone.setAttribute('data-acn-mode', orbMode)` must remain at the top of `orbRender()`, before any dot positioning
- `data-acn-mode` values are the same as `orbMode` values: `'show-all'`, `'arc'`, `'wheel'`
- Future mode-specific CSS (not just labels) should use `#acn-zone[data-acn-mode="..."]` selectors
- The arc label CSS uses `translateX(-50%) translateY(-4px)` as hidden state and `translateX(-50%) translateY(0)` as visible state — the vertical slide mirrors the horizontal slide used in show-all mode for consistency

---

## DEC-008: System-UI Primary Font, Inter as Fallback
**Date:** 2026-02-22 | **Stage:** v10.0 session 2

### Decision
The full font stack for the orbital system is: `system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif`. It is set on `.acn-zone` (the orbital root element), from which all child elements inherit. The same stack is applied to both legacy panel CSS strings.

### Context
The orbital zone is a fixed-position overlay injected into the host site's `document.body`. Unlike a shadow DOM, it inherits the host site's CSS cascade. Without an explicit `font-family` on `.acn-zone`, the dots and labels would inherit from `body` or whatever the platform's root element sets — Claude used its variable serif, ChatGPT used its own sans-serif, Replit used monospace. The script needs a consistent font that works offline and doesn't depend on any CDN.

### Alternatives Considered

**Alternative: Google Fonts — Inter only, loaded via `@import`.** Hypothesis: Inter is designed specifically for UI use, has excellent cross-language coverage, and is visually consistent. *Rejected because:* requires an `@import` in the CSS string, which adds a network dependency. If the CDN is unavailable (offline use, corporate proxy, restrictive CSP), the font silently falls back to `serif` rather than gracefully to a quality sans-serif. Also, CSP on Claude and ChatGPT may block cross-origin font loads.

**Alternative: Hardcode Segoe UI as primary (Windows-native feel).** *Rejected because:* on macOS, Segoe UI is not present and the browser falls back much earlier in the stack. macOS users (a significant share of the target audience) would see a different font than Windows users, creating inconsistency.

**Alternative: `system-ui` only, no fallback.** *Rejected because:* older Firefox versions (pre-2017) and some Android WebViews don't support `system-ui`. The fallback chain ensures these environments still get a quality sans-serif (Segoe UI → Roboto → Inter → generic sans-serif).

### Rationale
`system-ui` resolves to the OS's native UI font — San Francisco on macOS/iOS, Segoe UI on Windows, and the distro default (often Ubuntu or Roboto) on Linux. This makes the script feel native on each platform without loading anything. Inter as secondary fallback covers environments where `system-ui` isn't supported and none of the other named fonts are available — it's present on ~99% of machines that have a modern browser because it ships with Figma and is widely distributed.

### Key Properties
- Set on `.acn-zone` — child elements inherit, no per-element `font-family` needed
- Also explicitly set on `.acn-panel` (which is a sibling of `.acn-zone`, not a child) and both legacy panel CSS strings
- Do NOT set individual `font-family` rules on `.acn-dot`, `.acn-lbl`, `.acn-qi`, etc. — inheritance from `.acn-zone` is sufficient and avoids duplication
- If a future version removes `.acn-zone` or restructures the DOM so panel is no longer inside zone, the panel `font-family` must be set explicitly

---

## DEC-009: Context Bar Uses DOM Walk to Scroll Container, Not Fetch Interception
**Date:** 2026-02-22 | **Stage:** v10.0 session 2

### Decision
The Navigate panel context bar estimates token usage by walking up the DOM from a detected user message to the conversation's scroll container, then reading `scrollContainer.innerText.length / 4`. It does not intercept `window.fetch` or read API response headers.

### Context
The v10.0 rewrite explicitly removed the v9.x fetch interception that had been used for context tracking, because it was one of the architectural entanglements that motivated the rewrite. The context bar DOM elements were built into the Navigate panel stub at v10.0 ship, but the calculation function was never implemented. This decision documents what function to use and why.

### Alternatives Considered

**Alternative: Fetch interception (intercept `window.fetch` and read response `usage` fields).** Hypothesis: Claude's API returns token usage in streaming response chunks. Intercepting these would give exact token counts rather than estimates. *Rejected because:* the v10.0 rewrite removed fetch interception intentionally (see DEC-001). Re-introducing it reintroduces the same passive global side-effect. Additionally, the usage field format differs between Claude, ChatGPT, and Grok API formats — maintaining per-platform deserialization logic for 5 platforms is ongoing maintenance burden. Claude's Artifacts and Projects interfaces also use a different streaming format from the raw API.

**Alternative: User chars × 3 multiplier.** Sum character counts for items in `_questions[]` (user messages only) and multiply by 3. Fast, zero DOM access beyond what's already been scanned. *Used as initial implementation, retained as fallback.* Problem: inaccurate for conversations where AI responses are much longer than user messages (3× underestimates) or where the user types long prompts and AI responds briefly (3× overestimates).

**Alternative: Walk up DOM from detected message to scroll container.** From `_questions[0].element`, iterate `.parentElement` until finding a node with `overflow-y: auto` or `overflow-y: scroll`. Read `innerText.length`. This container holds the entire visible conversation (user + AI), so `innerText` captures both sides. *Chosen because:* it reuses the existing DOM structure — the message detector already found `_questions[0].element`, so walking up from it is zero additional platform-specific knowledge. Works on all 5 orbital platforms because they all scroll the conversation through a single overflow container.

### Rationale
The DOM walk approach gives a full-conversation character count with no fetch interception and no platform-specific API knowledge. The `/ 4` divisor (1 token ≈ 4 English characters) is an imprecise but standard heuristic. The result is labeled "estimated" in the UI to set expectations. Platform-specific `CTX_LIMITS` values give a denominator for the percentage — these are sourced from each platform's publicly documented context window sizes.

### Key Properties
- `CTX_LIMITS` values: `claude:200000, chatgpt:128000, grok:131072, gemini:1000000, perplexity:127072`
- Default for unmapped platforms: 128,000 (chatgpt's limit, conservative)
- If a platform changes its context window size, update `CTX_LIMITS` — the platform's documentation page is the source of truth
- The DOM walk terminates at `document.body` — no infinite loop risk
- `innerText` may differ from the actual tokenized content (LaTeX, code blocks, and formatting are included in character count but may tokenize differently). This is acceptable for a visual indicator — precision isn't required
- If `_questions[0]` has no `element` property, the function falls back to the `× 3` estimate gracefully

---

## DEC-010: CSS Custom Properties Set on `:root`, Not Just `#acn-zone`
**Date:** 2026-02-22 | **Stage:** v10.0 session 3

### Decision
Platform theming CSS custom properties (`--acn-accent`, `--acn-rgb`, `--acn-shadow`) are set on **both** `document.documentElement` (`:root`) and `#acn-zone`. The `:root` assignment makes them globally available to all elements on the page, including `.acn-panel` elements which are siblings of `#acn-zone` in the DOM.

### Context
The original `orbBuildZone()` set these variables only on the zone element. This worked for zone children (dots, hitzone, labels) but silently failed for panels. Panels are appended to `document.body` as siblings of `#acn-zone`:

```javascript
document.body.appendChild(zone);              // zone
document.body.appendChild(orbBuildPanelNav()); // panel — sibling, not child
```

CSS custom properties cascade downward to descendants only. Zone siblings don't inherit from the zone. `var(--acn-accent)` inside panel CSS resolved to nothing, causing Q# badge colors and hover highlights to be invisible (the browser used the CSS `initial` value for each property instead of the accent color).

### Alternatives Considered

**Alternative: Move panels inside `#acn-zone` in the DOM hierarchy.** This would restore normal CSS inheritance and eliminate the need for `:root` assignment. *Rejected because:* the z-index stacking context would change. Panels are currently at `z-index:2147483641` — one above the zone's `z-index:2147483640` — which places them above the zone and its children (dots). Moving panels inside the zone makes them part of the zone's stacking context, requiring re-validation that the correct visual layering is maintained across all 14 platforms and layout scenarios (isLeftChat, non-isLeftChat, panel open/closed, dots visible/hidden).

**Alternative: Set variables on each panel element individually after creation.** After `orbBuildPanel*()` returns the panel, call `panel.style.setProperty(...)` 3 times per panel. *Rejected as maintenance burden:* 6 panels × 3 variables = 18 calls, each must be kept in sync with `orbBuildZone()`'s values. If a future session adds a 7th panel, the developer must remember to add 3 more `setProperty` calls there too — nothing enforces this. The `:root` approach is self-applying.

### Rationale
`:root` assignment is the minimal change that makes the variables globally available without touching the DOM structure or z-index hierarchy. The zone-level assignment is kept alongside it for two reasons: (1) it's more semantically precise — zone children should "own" their variables even when `:root` also provides them; (2) if a future refactor changes the zone ID or removes the zone, zone children lose their theming with a clear indication of why, rather than silently relying on a `:root` assignment that was added for a different reason.

### Key Properties
- Both `:root` and zone assignments must be kept in sync — if one is updated, update both
- The `:root` assignment must happen in `orbBuildZone()` before panels are added to the DOM, so variables are available when panel CSS is evaluated
- CSS variable names must be consistent between `orbBuildZone()` (setter) and all panel CSS strings (consumers): `--acn-accent`, `--acn-rgb`, `--acn-shadow`
- If a future panel needs a *different* color than the global theme, set an inline override on that specific panel element — it will take precedence over the `:root` value

---

## DEC-011: Fingerprint-Gated Nav List Rebuild to Prevent MutationObserver-Driven Hover Destruction
**Date:** 2026-02-22 | **Stage:** v10.0 session 3

### Decision
`orbPopulateNavigate()` computes a fingerprint of `_questions[]` content at the start of each call. If the fingerprint matches the previous render's fingerprint and the list is non-empty, the function returns immediately without touching the DOM. The list is only rebuilt when questions actually change.

### Context
The MutationObserver in `startMessageObserver()` fires on any DOM mutation under `document.body`. Live AI platforms (Gemini, Claude, ChatGPT, etc.) constantly mutate their DOM — animated typing indicators, streaming token updates, sidebar hover effects, response carousels. Each mutation triggers a 500ms debounced `scanConversation()` call. If the Navigate panel is open, `scanConversation()` → `orbOnScanComplete()` → `orbPopulateNavigate()`, which previously tore down and rebuilt the entire question list unconditionally:

```javascript
while (list.firstChild) list.removeChild(list.firstChild); // clear all
// ... then rebuild from _questions[]
```

Destroying DOM elements removes their CSS `:hover` state. If the user was hovering over a `.acn-qi` item when the rebuild fired, that element was destroyed, the hover state was dropped, and a new (un-hovered) element was inserted in its place. This produced hover highlights that lasted ~500ms then disappeared — exactly the MutationObserver debounce window.

### Alternatives Considered

**Alternative: DOM diffing.** Match old `.acn-qi` elements to new `_questions[]` entries by key; add new elements, remove stale ones, leave unchanged ones alone. The unchanged element retains its DOM identity and its `:hover` state is preserved. *Rejected for now (not forever):* requires a stable per-question key. Questions currently have no stable ID — the `_questions[]` array uses indices, and a prepended question shifts all indices. Adding stable IDs is a reasonable future enhancement but is a larger structural change than warranted by this specific bug.

**Alternative: Disconnect the MutationObserver while the nav panel is open.** Stop observing mutations when the user has the panel open; reconnect when they close it. *Rejected because:* the observer also guards against the orbital zone being destroyed by SPA navigation (`if (!document.getElementById('acn-zone')) { setTimeout(injectOrbital, 0) }`). Disconnecting it would make zone removal undetected during a panel session.

**Alternative: Separate the zone-guard MutationObserver from the scan MutationObserver.** Two separate observers: one watches only for zone removal (`childList: true` on `document.body`, not `subtree: true`), the other does the full subtree watch for question scanning. Disable the scan observer when panel is open. *More correct in principle, rejected as over-engineered:* changes the architecture of the observer system for a problem that the fingerprint approach solves simply and correctly.

**Alternative: Increase the scan debounce from 500ms to 2000ms.** *Rejected:* makes the panel feel stale after new messages — already 500ms feels slow enough. Trading hover quality for list staleness is the wrong tradeoff.

### Rationale
The fingerprint approach is `O(n)` in question count (typically 1–20), adds one string variable, and requires no structural change. The fingerprint uses the first 100 characters of each question's text joined with `|` — sufficient to distinguish questions reliably while keeping the string short (100 × 20 = 2,000 characters maximum). The `&& list.firstChild` guard catches cases where the fingerprint matches but the DOM was cleared (e.g., panel close removes DOM children, panel reopen should rebuild even though `_questions[]` is unchanged).

The tradeoff: if two different question sets produce the same fingerprint (a text collision), the list would not rebuild when it should. This is practically impossible with the 100-char prefix: two different user messages that share their first 100 characters AND are in the same position in `_questions[]` would have to be actively constructed to collide.

### Key Properties
- `_navListFingerprint` is a module-scoped variable initialized to `''`
- It is NOT reset when the panel closes — the fingerprint from the last render persists so that reopening the panel with the same questions doesn't rebuild the list (a panel close/reopen with no new messages should show the same list instantly)
- It IS implicitly reset when `_questions[]` changes (new message added) because the computed fingerprint will differ
- The `&& list.firstChild` guard is critical: without it, reopening a panel after a DOM flush would silently show an empty list because the fingerprint matches but the DOM elements were removed
- If a future version adds question editing or reordering, the fingerprint must reflect that change — the current fingerprint only captures `q.text` content, not position or metadata

---

## DEC-012: `unsafeWindow` for SSE Fetch Patching (v10.8)
**Date:** 2026-02-23 | **Stage:** v10.8

### Decision
`setupClaudeSSEInterceptor()` patches `pw.fetch` where `pw = unsafeWindow ?? window`, rather than patching `window.fetch` directly. `@grant unsafeWindow` is added to the header.

### Context
When any `@grant` directive (other than `none`) is declared, Tampermonkey sandboxes the userscript with a wrapper `window` object. The script was patching the sandbox wrapper's `.fetch`, which Claude.ai's JavaScript never used — it uses the real page `window.fetch`. The interceptor appeared functional in code but had never captured a single SSE event in production. This was confirmed by checking `window._acnFetchPatched` from browser DevTools (which operates in the real page context): it returned `undefined`, proving the flag was set on the wrong window object.

### Alternatives Considered

**Alternative: Script-tag injection.** Inject a `<script>` element into the page DOM containing the fetch-patching code. Injected script tags execute in the real page context, bypassing the Tampermonkey sandbox entirely. *Rejected because:* passing data back across the sandbox boundary requires `postMessage` or shared DOM attributes, which are asynchronous. The SSE interceptor needs to write directly to `_sseTokenData` in-memory on every SSE chunk (which can arrive dozens of times per second). A postMessage round-trip for each chunk would add latency and code complexity with no benefit. It also creates a second JavaScript execution environment that needs to be managed separately.

**Alternative: Remove `@grant` directives to use `@grant none` mode.** Without any grant, Tampermonkey doesn't sandbox the script and `window` is the real page window. *Rejected because:* bookmarks persistence uses `GM_setValue`/`GM_getValue`, and v10.8 added GM cache for SSE token data. Removing `@grant` would break all userscript API calls. Context-tracking accuracy was already compromised by this bug — giving up GM persistence to fix it would trade one problem for another.

**Alternative: Keep `window` but add `@grant none` just for the SSE function.** Tampermonkey doesn't support per-function grant modes; the `@grant` directive is script-wide.

### Rationale
`unsafeWindow` is the Tampermonkey-sanctioned API for exactly this use case: interacting with page-level globals from a sandboxed userscript. The `typeof unsafeWindow !== 'undefined' ? unsafeWindow : window` fallback handles environments where `unsafeWindow` doesn't exist (Greasemonkey behaves differently). `.bind(pw)` on `_nativeFetch` ensures the native fetch call preserves the `this` context of the real window, preventing subtle binding errors.

### Key Properties
- `pw._acnFetchPatched` idempotency guard prevents double-patching if the script somehow runs twice
- `readSSEStream()` and `parseSSEEvent()` do not reference `window.fetch` — they operate on the `ReadableStream` body already captured; no changes needed there
- Do NOT change this back to `window.fetch` — the sandbox isolation is inherent to how Tampermonkey works with `@grant` directives; any future rewrite of this function must use `unsafeWindow`
- If `unsafeWindow` is not available (some environments), the script gracefully falls back to `window` — it won't work for SSE interception in those environments but won't crash

---

## DEC-013: GM_setValue Cache for Claude Context Persistence (v10.8)
**Date:** 2026-02-23 | **Stage:** v10.8

### Decision
After each SSE `message_start` event, persist token data to `GM_setValue('acn_ctx_cache', {...})` keyed by conversation UUID extracted from the URL pathname. On page load and after SPA navigation, read this cache with `GM_getValue`. Cache capped at 50 entries, pruned by timestamp.

### Context
`_sseTokenData` is initialized to zeros on every page load. Reloading a Claude conversation reset the context bar to DOM estimation even if exact data had been collected in a prior session. With the SSE interceptor now working (DEC-012), users will quickly accumulate exact token data — but only for the current page session. Any reload or navigation away lost it.

### Alternatives Considered

**Alternative: `localStorage` keyed by conversation ID.** Same basic idea, but `localStorage` is accessible to the page's own JavaScript. While Claude.ai is not adversarial, storing userscript-private data in the page's own storage is a weaker isolation boundary. `localStorage` is also cleared by "Clear site data" operations in browser settings, which users might do to fix unrelated Claude.ai problems, wiping the cache unexpectedly. GM storage is extension-scoped and survives site data clearing.

**Alternative: sessionStorage.** Only lasts one browser session — survives page reload but not browser restart. This covers the reload case but misses the restart case. Not meaningfully better than the current behavior, since users close and reopen their browsers regularly.

**Alternative: IndexedDB.** More storage capacity, but adds async complexity throughout the synchronous-style code. The token data is small (two integers per conversation). IndexedDB is overkill.

**Alternative: Fetch from Claude API on load.** Request the conversation's token usage from Claude's backend. *Rejected:* requires handling authentication, CSRF tokens, and API endpoint discovery. Creates an extra HTTP request on every load. Fragile to API changes. The exact data we want is already being delivered in SSE streams during normal use — we just need to persist it.

### Rationale
GM storage is the idiomatic persistence mechanism for Tampermonkey scripts. It's already being used for bookmarks (`'acn-bookmarks-v1'`). The 50-conversation cap prevents unbounded storage growth; conversations are sorted by timestamp so the most recently visited ones are retained. The 600ms delay before loading cached data after SPA navigation ensures the URL has fully resolved to the new conversation before `_getConvId()` reads the pathname.

### Key Properties
- GM key: `'acn_ctx_cache'` — JSON object, `{ [convId]: { inputTokens, outputTokens, timestamp } }`
- Conversation ID: last path segment of URL; validated by `length > 8 && indexOf('-') !== -1` (basic UUID check)
- `cached: true` flag on `_sseTokenData` is distinct from `exact: true` — they cannot both be true simultaneously. Live SSE sets `cached = false` before setting `exact = true`.
- The `(last known)` label is intentionally dimmer (`color: #666`) than `(exact)` (`color: #888`) to visually signal that the data is from a prior session
- If GM storage is unavailable (try/catch), `_cacheSSEData()` and `_loadCachedSSEData()` fail silently — the script degrades to Path B estimation, not a crash
- Cache entries are never deleted when conversations are deleted from Claude.ai — they simply become orphaned and will eventually be pruned when the cache exceeds 50 entries

---

## DEC-014: Non-Claude Platforms Show Turn Dots Only, No Estimated Percentage Bar (v10.8)
**Date:** 2026-02-23 | **Stage:** v10.8

### Decision
`orbUpdateContextBar()` Path C (non-Claude) no longer calls `_renderEstimatedBar()`. The percentage number and fill bar are cleared to empty/0%. Only turn dots and compaction prediction text are shown. The section header label changes from "Context window" to "Conversation turns" for non-Claude platforms.

### Context
The DOM-based token estimate (`innerText.length / 4` with virtual-scroll coverage-ratio correction) is fundamentally limited on non-Claude platforms. It captures text visible in the DOM but misses: system prompts, tool call result bodies, search-grounding context, and model-injected context. For conversational ChatGPT or Gemini without tool use, the estimate is reasonably close. For tool-heavy conversations (code interpreter, Gemini search, multi-step agents), the visible text can be 5–20× less than actual token usage.

The original v10.0 CONTEXT-TRACKING.md spec explicitly stated that turn dots were the intended primary indicator for non-Claude platforms. The estimated bar was added as a "better than nothing" interim measure before the turn dot system was complete.

### Alternatives Considered

**Alternative: Add a larger fudge factor per platform.** Apply a 1.5× or 2× multiplier for ChatGPT (known for large system prompts), a higher multiplier for Gemini (search grounding). *Rejected:* fudge factors are not principled and diverge from reality depending on conversation type. A 2× multiplier is accurate for tool-heavy conversations and wrong for simple chat. More importantly, even a fudge factor doesn't address the precision problem — showing "~24K / 128K" instead of "~12K / 128K" is still a number that users will treat as meaningful.

**Alternative: Display estimate with a strong disclaimer.** Change label from `(est.)` to `(rough est.)` or show a tooltip "May be 10x off for tool-using conversations." *Rejected:* disclaimer text doesn't override the visual signal of a filled bar. Users will still glance at the number. The bar fill (which sets user expectations for how much headroom remains) is the misleading element, not just the label.

**Alternative: Only show the bar on platforms with small system prompts.** Show it for Grok and Perplexity (simpler platform architecture), hide it for ChatGPT, Gemini. *Rejected:* maintainability problem — we don't have reliable, stable knowledge of per-platform system prompt sizes, and they change with product updates. This creates a brittle conditional per-platform.

### Rationale
Turn dots are a more honest signal. They don't make a claim about token count. They show relative position in a compaction cycle based on observed behavior (prior compaction events in the conversation). Over time, as the user uses the tool, the weighted-average cycle prediction improves. The turn dots become increasingly useful, while an inaccurate percentage bar becomes less trustworthy the longer it's shown. "Unknown but predictable" (turn dots) is a better UX than "precise-looking but wrong" (estimated bar).

### Key Properties
- `_renderEstimatedBar()` is NOT deleted — it still runs for Claude Path B (DOM estimation when no SSE data exists for Claude). It is only excluded from non-Claude Path C.
- The section label switching (`'Context window'` for Claude, `'Conversation turns'` for non-Claude) happens at DOM construction time in `orbBuildPanelNav()`. The label is set once when the panel is built; it does not update dynamically after construction.
- If in the future a non-Claude platform exposes SSE-level token data (e.g., via a public API hook), a new Path D can be added before Path C to handle it, without disturbing this decision.

---

## DEC-015: Mode-Aware Hitzone Width Rather Than Fixed Maximum (v10.8)
**Date:** 2026-02-23 | **Stage:** v10.8

### Decision
`orbUpdateHitzone()` reads `orbMode` and selects hitzone width from two values: `baseWidth = 96px` for show-all and wheel, `arcWidth = 177px` for arc. `orbUpdateHitzone()` is also called at the end of `orbSetMode()` to update immediately on mode change.

### Context
The hitzone is an invisible `<div>` that captures `mouseenter`/`mouseleave` events to control dot visibility. Its width determines how far from the right edge the hover zone extends. Arc mode pushes the focused satellite 147px from the right edge — 51px beyond the original 96px hitzone boundary. Users could see the satellite but couldn't reach it without the zone collapsing.

### Alternatives Considered

**Alternative: Fixed 180px hitzone for all modes.** One width that covers all modes. *Rejected:* over-extends the hover zone into page content on the left. The orbital UI lives at the right edge, and a 180px hover zone captures a significant slice of page content — enough that a user scrolling the left panel or clicking near the orbital region might accidentally trigger the orbital expansion. The narrower zone for show-all/wheel was deliberately sized to be tight.

**Alternative: CSS-only approach — expand hitzone using a wider CSS `width` on `.acn-hitzone` when an arc-mode class is present.** Add `.acn-arc-mode` class to `#acn-zone`, then `#acn-zone.acn-arc-mode .acn-hitzone { width: 177px; }`. `orbSetMode()` adds/removes the class. *Considered favorably but rejected:* the hitzone width is also computed based on `ORB_CX`, `HITZONE_PAD_X`, and `radius` constants — all JavaScript values. Hardcoding the width in CSS decouples the hitzone width from the constants, creating a maintenance hazard: if `ORB_CX` or `radius` are changed, the CSS needs a manual update. Computing it in JS from the same constants is more maintainable.

**Alternative: Read DOM positions after arc render completes.** After `orbRenderArc()` positions satellites, measure the leftmost satellite's `getBoundingClientRect().left` and resize the hitzone to match. *Rejected:* `getBoundingClientRect()` during or immediately after a CSS transition gives the pre-transition position. The arc render uses CSS `transform` transitions (300ms). Waiting for the transition to complete before resizing the hitzone would leave a 300ms window where the hitzone is still too narrow.

### Rationale
Computing both widths from the same constants (`ORB_CX`, `radius`, `HITZONE_PAD_X`) means the math stays consistent if constants are changed. The `arcWidth` formula `ORB_CX + 88 + 17 + HITZONE_PAD_X = 177px` directly mirrors the geometry: center axis offset + arc radius + half-dot width + padding. Easy to audit and verify.

### Key Properties
- `arcWidth = ORB_CX + 88 + 17 + HITZONE_PAD_X` — if `radius` changes (it's hardcoded as `88` inside `orbRenderArc()`), this formula must be updated. Consider extracting `ARC_RADIUS = 88` as a named constant if it ever changes.
- `orbUpdateHitzone()` is called from: initial injection (`injectOrbital()`), window resize (`window.addEventListener('resize', ...)`), and now mode change (`orbSetMode()`). All three call sites must be maintained.

---

## DEC-016: Cumulative Hybrid Context Bar Over Epoch-Based Resets (v10.9)
**Date:** 2026-02-23 | **Stage:** v10.9

### Decision
The context bar is **cumulative and never resets within a conversation**. After discovering Claude web SSE has no `input_tokens` data, v10.9 uses a hybrid formula: `DOM_visible_text/4 + system_overhead(15K) + cumulative_SSE_thinking/4`. The `cumulativeThinkingChars` counter accumulates thinking chars from `thinking_delta` SSE events and resets only on SPA navigation to a different conversation — never on compaction.

### Context
v10.8's SSE plumbing was fixed in v10.9 but revealed that `message_start` events contain no `usage` field in Claude's web UI. The SSE stream does provide `thinking_delta` events with exact thinking text — the one thing DOM cannot capture (extended thinking is collapsed behind a toggle, invisible to `innerText`). A design decision was needed: should the context bar reset when compaction occurs (epoch-based), or accumulate continuously?

### Alternatives Considered

**Alternative: Epoch-based resets.** When compaction is detected (by DOM selector watching for compaction UI elements), reset `cumulativeThinkingChars` and treat it as a fresh epoch. The bar would drop from ~80% to ~20-30% after each compaction and climb again. *Rejected* for three reasons:
1. **Misleading signal direction.** The bar dropping from 80% to 20% after compaction suggests "lots of room!" — but the conversation is actively degrading. Compaction itself is a sign the model has been strained. The bar would give false confidence at exactly the moment the user should be most cautious.
2. **Fragile compaction detection.** Detecting compaction via DOM selectors relies on Claude's UI rendering a specific element when compaction occurs. These selectors are brittle and change with Claude UI updates. The compaction count in `_turnCounter` is already tracked separately and displayed as a dedicated "compacted Nx" badge.
3. **Confusing oscillation pattern.** A user watching the bar go 80%→20%→75%→20%→70% across three compaction cycles has no useful mental model for what those numbers mean. A steadily climbing bar is easier to interpret.

**Alternative: Pure DOM estimation, no SSE.** Use only `innerText / 4` from DOM walk. *Rejected:* This misses extended thinking entirely. A research conversation might have 25K+ thinking tokens that are completely invisible to DOM. The hybrid gets dramatically closer to reality for thinking-heavy conversations — this is the one case where SSE data genuinely helps.

**Alternative: Full output + thinking from SSE.** Accumulate both `text_delta` and `thinking_delta` chars from SSE. *Rejected:* AI response text IS visible in the DOM. Adding SSE output on top of DOM text double-counts every AI response. Only thinking text is invisible in the DOM — only thinking needs to come from SSE.

### Rationale
The bar answers "how close am I to trouble?" not "what fraction of the context window is currently in use?" After compaction, the model's internal context may have been compressed — but the conversation has still produced that much total content, and model quality has already been affected. A cumulative bar that stays high after compaction correctly signals "this conversation has been heavily loaded" even if the model's internal context just reset.

### Tradeoffs
- Input estimation is still approximate (~±20%). System prompt overhead is a constant 15K that may vary by Claude configuration.
- After several compactions, the bar stays near 100% — this is intentional. The conversation IS fully loaded in cumulative terms.
- Label shows `(hybrid)` with `~` prefix, signaling "approximately" rather than claiming exactness.
- The separate compaction count badge (`Compacted 2x · ~8 turns to next`) provides the "trouble is happening" signal.

---

## DEC-017: Claude Shows Both Bar AND Turn/Compaction Indicators (v10.9)
**Date:** 2026-02-23 | **Stage:** v10.9

### Decision
Claude's Navigate panel shows **both** the percentage context bar (hybrid) and the turn dots + compaction count (built in v10.8). Non-Claude platforms continue showing only turn dots. Claude is the only platform with both displays.

### Context
v10.8 built turn dots + compaction count for all platforms and removed the misleading estimated bar from non-Claude platforms (Path C). Claude kept its bar (Path A), but didn't get turn dots. The question in v10.9: should Claude also show turn dots, and if so, alongside the bar or instead of it?

### Alternatives Considered

**Alternative: Bar only (previous state).** Keep Path A showing only the percentage bar. *Rejected:* The bar alone provides no visibility into compaction events. A user at 65% usage with two compactions behind them has no way to see the compaction history or predict when the next one will occur. Turn dots provide exactly this — and they were already built.

**Alternative: Turn dots only, like non-Claude.** Remove the bar from Claude and show only turn dots. *Rejected:* Wastes the SSE thinking data that only Claude provides. The hybrid bar is the only quantitative usage estimate among all platforms, making it uniquely valuable for Claude. Discarding it because non-Claude platforms can't have a bar would be inconsistent.

**Alternative: Replace bar with compaction-only warnings.** Show nothing until compaction is detected, then show a warning badge. *Rejected:* Loses the gradual "filling up" signal that helps users plan ahead. A user who sees the bar at 60% knows to wrap up the conversation or start a new one. A warning-only system gives no lead time.

### Rationale
Claude is the only platform where SSE data is available, making the bar more meaningful than anywhere else. The two signals serve different, complementary purposes:
- **Percentage bar (hybrid):** cumulative usage trend, gradual signal. "How much has this conversation consumed over its lifetime."
- **Turn dots + compaction count:** event-based, discrete signal. "Compaction has occurred X times; predicted Y turns until the next one."

Both signals are useful, neither duplicates the other. The visual hierarchy is: bar fills the top of the section, turn dots appear below with compaction info underneath.

### Constraints
- `_renderTurnDots()` and `_renderCompactionInfo()` are called from Path A in `orbUpdateContextBar()`.
- Both functions read from `_turnCounter`, which is updated by `updateTurnCounter()` on all platforms.
- `resetTurnCounter()` resets both the turn counter and the hybrid SSE state (`cumulativeThinkingChars` etc.) on SPA navigation — keeps the two systems in sync.
- The hitzone height computation (vertical centering, stack bounds) is mode-independent and unchanged.


## DEC-018: Userscript `// @name` Must Never Include Version Number (v10.13)
**Date:** 2026-03-10 | **Stage:** v10.13

### Decision
The `// @name` header field is permanently set to `AI Conversation Navigator` with no version suffix. Version information lives only in `// @version` and `ACN_VERSION`.

### Context
The `// @name` field in a Tampermonkey userscript is the script's identity key for the user-facing extension list. It is distinct from `// @version`, which Tampermonkey uses for update detection. The problem emerged in v10.11: `// @name` had been frozen at `AI Conversation Navigator v10.9` since v10.9, then corrected to include the current version in v10.11. This immediately exposed a deeper issue.

### Problem with Versioned Names
Tampermonkey matches installed scripts by name. If a user has `AI Conversation Navigator v10.11` installed and then installs or updates to `AI Conversation Navigator v10.12`, Tampermonkey sees two different scripts (different names) and installs the new one alongside the old one. The user ends up with duplicate scripts — both active, both injecting into pages, causing conflicts and double-rendering. Users would need to manually uninstall the old version every time they updated.

### Alternatives Considered

**Alternative: Keep versioned name, document the duplicate risk.** Acceptable for a one-time correction but creates a recurring maintenance burden. Every release requires the user to uninstall the previous version manually. *Rejected.*

**Alternative: Use `// @namespace` for version tracking.** Namespace is also an identity field in Tampermonkey and has the same problem. *Rejected.*

**Alternative: No version anywhere in the script header.** Users would lose visibility into what version is installed. *Rejected:* `// @version` is how Tampermonkey displays and compares versions in the extension list — it must be accurate.

### Rationale
`// @name` = human-readable label, never changes. `// @version` = machine-readable version number, updated every release. This is the conventional userscript pattern and matches how browser extensions work (the extension name doesn't change; only the version badge updates).

### Constraints
- Never include a version number in `// @name`
- Always update `// @version` and `ACN_VERSION` together on every release
- If a future session sees a version number in `// @name`, remove it — do not "align" it to the current version

---

## DEC-019: Always Wrap Replaced Page Globals with `exportFunction()` on Firefox (v11.6)
**Date:** 2026-03-14 | **Stage:** v11.6

### Decision
Any function assigned to `unsafeWindow.*` properties or built-in page-context objects (like `history.pushState`, `history.replaceState`) must be wrapped with `exportFunction()` when available. Direct assignment is only used as a fallback when `exportFunction` is not present (Chrome, where it's unnecessary).

### Context
On March 13, 2026, Claude.ai shipped a vendor bundle update (Visualizer feature) that introduced `.bind()` calls on `fetch` and potentially `history.pushState`/`history.replaceState` during app initialization. This immediately crashed the entire Claude frontend on Firefox — black screen, no UI — while Chrome was completely unaffected.

### The Cross-Compartment Problem
Tampermonkey runs userscripts in a **sandbox compartment** — a separate security principal from the page's JavaScript context. When our userscript assigns `unsafeWindow.fetch = function() {...}`, the function object lives in the sandbox compartment. Firefox enforces strict cross-principal security: any attempt by page JS to call `.bind()`, `.call()`, or `.apply()` on a foreign-compartment function throws `Permission denied to access property "bind"`.

This had been a latent bug since v10.8 (when SSE fetch interception was added). It was invisible because no platform's code called `.bind()` on `fetch` until Claude's March 13 update. Chrome masks the issue entirely because it doesn't enforce cross-compartment restrictions on function objects.

### Why This Is a Convention, Not a One-Off Fix
The bug pattern is general: any time we replace a page-visible function with a sandbox function, the page might call `.bind()` on it at any point in the future due to a vendor update we don't control. Rather than playing whack-a-mole each time a platform adds a `.bind()` call, every replacement should be wrapped proactively.

### The `exportFunction()` Pattern
```javascript
var proxyFn = function() { /* our logic */ };
if (typeof exportFunction === 'function') {
    target.method = exportFunction(proxyFn, target);
} else {
    target.method = proxyFn;
}
```
`exportFunction()` is a standard Greasemonkey/Tampermonkey API on Firefox that clones a sandbox function into the target context, making it appear as a native function to the page's JS.

### Alternatives Considered

**Alternative: Only patch on Chrome, skip Firefox.** Would mean Firefox users lose SSE token tracking and SPA navigation handling entirely. *Partially adopted in DEC-020:* fetch interception was ultimately skipped on Firefox (return-value contamination), but SPA history patches work fine with `exportFunction()` because they return `undefined`.

**Alternative: Use `@unwrap` or `@grant none` to run in page context.** Would eliminate the compartment boundary entirely, but also eliminates access to `GM_setValue`/`GM_getValue` and other Tampermonkey APIs we depend on for storage. *Rejected.*

**Alternative: Inject a `<script>` element into the page instead of using `unsafeWindow`.** Would run our code in the page's context natively, avoiding the compartment issue. But this approach breaks on sites with strict Content Security Policy (CSP) that blocks inline scripts, and it loses access to Tampermonkey APIs. *Rejected:* too many side effects.

### Constraints
- When replacing any function on `unsafeWindow`, always check for `exportFunction` and wrap
- When replacing any function on built-in objects (`history`, `navigator`, etc.), same pattern
- Boolean/string/number assignments to `unsafeWindow` do NOT need wrapping — `.bind()` is only called on functions
- This applies even if the current platform code doesn't call `.bind()` — vendor updates are unpredictable
- **Important caveat:** `exportFunction()` solves `.bind()` permission errors but does NOT solve return-value contamination. For functions whose return values the page inspects (like `fetch`), `exportFunction()` is necessary but not sufficient — see DEC-020.

---

## DEC-020: Disable Fetch Interception on Firefox — exportFunction Cannot Solve Return-Value Contamination (v11.8)
**Date:** 2026-03-14 | **Stage:** v11.8

### Decision
`setupClaudeSSEInterceptor()` returns immediately on Firefox (detected via `typeof exportFunction === 'function'`). No fetch patching occurs. Firefox users get DOM estimation (Path B) for the context bar instead of exact SSE token tracking (Path A). SPA history patches continue to use `exportFunction()` because they are safe (no return value).

### Context
v11.6 wrapped the fetch proxy with `exportFunction()` to fix the `.bind()` crash. This solved the immediate black screen but introduced a new failure: Claude's internal API calls (chat history, connectors, conversation loading) all broke with `Permission denied to access property "length"`. v11.7 tried a fire-and-forget pattern (never return the `.then()` chain), but this also failed in live testing.

### The Fundamental Limitation of exportFunction()
`exportFunction()` makes a sandbox function *callable* from the page context (solving `.bind()`, `.call()`, `.apply()` permission errors), but the function body still *executes in the sandbox compartment*. For functions like `fetch()` whose return values the page actively inspects (`Promise<Response>` → `.headers`, `.json()`, `.length`), the sandbox execution taints the entire return pipeline. Firefox's cross-compartment wrappers on the returned objects block property access from the page.

This is not fixable through any combination of `exportFunction()`, `cloneInto()`, or careful Promise handling. The contamination happens at the `arguments` level — the sandbox's participation in the call creates wrappers that propagate through the entire chain.

### Why SPA patches work but fetch does not
The key distinction is return values:
- `history.pushState()` returns `undefined` → no object for the sandbox to taint → safe with `exportFunction()`
- `fetch()` returns `Promise<Response>` → the page inspects every property → sandbox taints it → broken

### Alternatives Considered

**Alternative: Inject `<script>` tag into page context.** Would run the fetch proxy natively in the page without sandbox involvement. *Rejected:* Claude's CSP (`script-src 'self'`) blocks inline scripts. Confirmed in Firefox console: `Content-Security-Policy: The page's settings blocked an inline script`.

**Alternative: `GM_xmlhttpRequest` for parallel SSE monitoring.** Tampermonkey's own HTTP API runs outside the sandbox. *Rejected:* It makes independent requests, it cannot intercept existing ones. Would duplicate every API call, waste bandwidth, and possibly break auth/session state.

**Alternative: `@inject-into page` / `@sandbox raw`.** Run the entire userscript in the page context. *Rejected:* Eliminates access to `GM_setValue`/`GM_getValue` which bookmarks, settings, cached data, and zone positions all depend on.

**Alternative: `cloneInto()` on returned Promise.** Firefox's companion API for cloning objects across compartments. *Rejected:* The contamination starts at the `arguments` level when the sandbox accesses page-context objects, not just at the return value.

**Alternative: Fire-and-forget `.then()` (v11.7).** Call `result.then()` as a side effect, always return the original untouched `result`. *Rejected:* Failed in live testing. The sandbox's execution of `_nativeFetch.apply(this, arguments)` itself taints the pipeline, regardless of what is returned.

### Rationale
SSE token tracking is a single-platform enhancement for Claude's context bar. Sacrificing it on Firefox preserves all core functionality (navigation, search, bookmarks, summary, export, settings, SPA handling) and still provides a context bar via DOM estimation. The only real path to exact SSE tracking on Firefox is the extension transition (WXP), where a `world: "MAIN"` content script runs in the page context natively.

### Constraints
- `setupClaudeSSEInterceptor()` must return immediately when `typeof exportFunction === 'function'`
- Never attempt to proxy `fetch` on Firefox — this is a fundamental sandbox limitation, not a fixable bug
- SPA history patches (`pushState`, `replaceState`) are safe with `exportFunction()` — continue using them
- If a future Tampermonkey update provides `world: "MAIN"` support for userscripts, re-evaluate this decision
- The extension transition (WXP) eliminates this limitation entirely — `world: "MAIN"` content scripts have no sandbox compartment

---

## DEC-021: API-Backed Conversation Index for Claude — the DOM Is No Longer the Record (v12.0)
**Date:** 2026-07-26 | **Stage:** v12.0

### Decision
On `claude.ai/chat/<uuid>`, message enumeration comes from Claude's own conversation JSON endpoint, not from `document.querySelectorAll()`. A module of `ci*`-prefixed functions fetches the conversation, walks the message tree from `current_leaf_message_uuid` to isolate the active branch, and becomes the source of truth for Navigate, Search, Summary, Export, and context tracking. The DOM scanner is retained as a fallback and remains the only path for the other 13 platforms.

### Context
Claude's web app virtualizes the message list **with recycling**. Only a window of roughly 3–5 user turns is mounted at any moment; everything outside it is unmounted and torn down. Measured on a live 96-turn conversation: **3 turns mounted, ~3% coverage**. A scroll sweep at 0/25/50/75/100% kept the same 3 turns mounted the whole way — the set never accumulated.

This broke every feature built on a full-page scan. Navigate showed ~3% of questions. Search could only match mounted text. Summary segmented a fraction of the conversation. **Export silently wrote truncated files with an authoritative-looking `**Messages:** 8` header** — the worst of the set, because a short nav list is visible to the user and a truncated export file is not.

Critically, this is **not** a selector break. The selectors matched correctly; there was simply nothing else in the DOM to match. No change to `getUserMessages()` could have fixed it.

### Why an API read is safe here (and why fetch interception was not)
DEC-019 and DEC-020 established that replacing page globals — especially `fetch` — crashes Claude on Firefox, because a sandbox-compartment function taints the return pipeline the page then inspects. **That reasoning does not apply here.** This is an ordinary *outbound* request via `GM_xmlhttpRequest`: it replaces no page global, the page never sees our Promise, and nothing crosses back into the page compartment. `GM_xmlhttpRequest` was explicitly rejected in DEC-020 as a way to *intercept* existing traffic — that rejection stands. Using it to make our own request is a different thing entirely.

### Verified endpoint behaviour
```
GET /api/organizations/{org}/chat_conversations/{cid}
    ?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong
```
Measured: HTTP 200, 3,289,821 bytes, ~2.1 s, 297 messages on the reference conversation. No `anthropic-client-*` headers required — which matters, because `anthropic-client-sha` looks like a build hash that would rotate every deploy.

### Three findings that changed the design
1. **The top-level `text` field is empty on every message** (0 of 192 non-empty). Content lives in `content[]` blocks (`text`, `thinking`, `tool_use`, `tool_result`). Reading `text` would have rendered a panel of blank rows.
2. **~10% of human turns have no text block at all.** Large pastes become a `txt` attachment with an empty `file_name` and the body in `attachments[].extracted_content` — 14 of 147 turns on the branch fixture. `ciExtractText()` falls back through attachments, then file names.
3. **Root messages carry a sentinel parent**, `00000000-0000-4000-8000-000000000000`, not `null`. The walk tests for it by name (`CI_ROOT_PARENT_UUID`) rather than relying on the uuid merely being absent from the message map.

### The tree is not a list
`parent_message_uuid` is on every message; editing or regenerating creates a branch, and `chat_messages` therefore contains abandoned branches alongside the live conversation. Listing every `sender === 'human'` message would surface questions the user edited away — presenting discarded content as current, which is arguably worse than showing too few. `current_leaf_message_uuid` is the authoritative tip; the newest-leaf heuristic is a logged fallback only. Verified against a 2-leaf fixture: 297 total / 148 human / 295 active path / **147 active human turns** / 2 abandoned — exact match on all six expected values.

### Alternatives Considered
**Flip the existing `virtualScroll: true` flag for Claude.** The registry already has an accumulate-across-scroll mode (used by Codex). *Rejected:* it only accumulates what the user has manually scrolled past, so opening a conversation and clicking Navigate still shows ~3. Its coverage correction is also inert here — `_questions` is rebuilt from live DOM every scan, so `nInDOM / _questions.length` is always exactly 1.0.

**Scrape harder / widen selectors.** *Rejected:* the data is not in the document at any selector.

**Intercept Claude's own conversation fetch.** *Rejected:* that is precisely the DEC-020 failure mode, and it would be Firefox-fatal.

**Refetch on every new message.** *Rejected:* 3.3 MB per turn. Replaced by DOM-merging mounted messages as provisional entries, with a cooldown-gated refetch to resync UUIDs.

### Constraints
- The DOM scanner must never be deleted — it is the fallback and the path for 13 other platforms
- Failure must be **visible**: `orbRenderIndexBanner()` renders a `data-acn-index-status` banner. Silent degradation is what let this bug hide for so long
- Export must never imply completeness it does not have — the degraded path stamps `**Source:** on-screen messages only — DEGRADED`
- Respect `truncated`; surface it in the banner and the export header
- Cap the tree walk at `chat_messages.length` — a cycle would otherwise spin forever
- Never refetch without the `CI_REFETCH_COOLDOWN_MS` gate; `_ciInFlight` alone prevents only *concurrent* fetches, not a sequential loop
- Build for per-platform adapters: if another platform virtualizes, this becomes a shared abstraction rather than a Claude special case

---

## DEC-022: A Fourth Platform Risk Category — Layer 4: State Breaks (v12.0)
**Date:** 2026-07-26 | **Stage:** v12.0

### Decision
The platform risk model gains a fourth category, **Layer 4: State Breaks**, documented in `ROADMAP.md` and `CLAUDE.md` alongside the existing three.

### Context
The v12.0 virtualization bug fits none of the existing layers:
- **Not Layer 1 (DOM break):** every selector matched, and every match was correct
- **Not Layer 2 (Feature break):** no competing native feature shipped
- **Not Layer 3 (Execution break):** the script ran fine and the host page was healthy

The platform kept the full data and simply stopped exposing it to the document.

### Definition
> **Layer 4 — State Breaks:** the platform continues to hold the complete data but withdraws it from the DOM, invalidating the assumption that a full-page scan sees a full conversation.

### Why it needs its own category
Its defining property is that **it reports success on a fraction of the data.** Layers 1–3 all announce themselves — empty results, a visible feature conflict, a dead page. Layer 4 returns a plausible, non-empty, entirely wrong answer with no error anywhere. That is why it went undetected: a 4-question panel on a 147-question conversation looks exactly like a short conversation.

It also cannot be caught by the tooling built for the other layers. The planned DOM-validation framework targets Layer 1 and would have passed — the selectors were fine. Playwright mock tests passed too, because `claude.html` is static and mounts every turn permanently. **A test suite of static mocks structurally cannot fail on a Layer 4 break.** That is why `tests/mock-pages/claude-virtualized.html` is a required deliverable and not an optional extra.

### How it was fixed
By changing data source, not selectors — see DEC-021. The general mitigation for Layer 4 is: when a platform withdraws state from the DOM, find where the platform still holds it (its own API, its own store) and read from there, keeping the DOM path as a visibly-degraded fallback.

### Strategic significance
This is the clearest ceiling yet on DOM augmentation as a strategy. Layers 1–3 are hazards you engineer around; Layer 4 says the DOM may simply stop being a complete record whenever a platform decides rendering performance matters more than document completeness. It is the strongest argument so far for the API-first direction of the extension transition.

### Constraints
- Any feature that assumes "scan the page = see the conversation" is now a Layer 4 liability and must be listed as such
- New platform integrations must record whether the platform virtualizes its message list
- Mock pages for virtualizing platforms must genuinely unmount nodes — hiding them with `display:none` does not reproduce the failure
- Degraded operation must always be visible in the UI, never console-only

---

## DEC-023: Jump-to-Message Uses the Virtualizer's Own `data-index`, Not Text Matching (v12.0)
**Date:** 2026-07-26 | **Stage:** v12.0 Phase 3

### Decision
Jump-to-message maps mounted DOM rows to conversation positions using Claude's own
`data-index` attribute, and pages the virtualizer with a scroll-and-settle loop that
interpolates between observed anchors. The `data-index → _ciFullPath` offset is
re-derived on every jump from every mounted user row and is never hardcoded.

### Context
Phase 2 made the panel complete — 147 questions instead of 4. But clicking still resolved
targets through the DOM, and ~97% of them are unmounted, so almost every click returned
"not currently rendered". That message is correct and is retained as the final fallback,
but it is not acceptable as the primary behaviour.

### The finding that shaped the design
The Phase 3.0 investigation went looking for a stable identifier on the DOM node. There is
no message uuid anywhere — a full attribute scan of mounted rows, their ancestors and their
descendants returned zero. But the virtualizer publishes its own positional metadata:

| Attribute | Location | Meaning |
|---|---|---|
| `data-index` / `data-rs-index` | turn wrapper | contiguous, 0-based, covers BOTH senders |
| `aria-posinset` / `aria-setsize` | `role="article"` wrapper | 1-based position / total rows |
| `role="feed"` | the list | the virtualized region |
| `data-autoscroll-container="true"` | scroller | stable selector for the scroll container |
| `data-rocksteady-sizer` | sizer | names the virtualizer: "rocksteady" |

This is a **positional** identifier, so no text comparison is involved. That matters
specifically: text matching had already caused a CRITICAL in this release, when the
script's own injected bookmark icon contaminated `textContent` and broke index↔DOM
matching for every message under 200 characters.

`data-autoscroll-container="true"` was also verified to resolve to the same node as the
computed-style walk-up, so it is used as the primary locator with the walk-up as fallback.

### Alternatives Considered

**Imperative `scrollToIndex` on the virtualizer.** Investigated first, because it would
have made the settle loop unnecessary. The container's React ref exposes
`getScrollContainer`, `scrollToBottom`, `setPinToBottom`, `isPinned`, `getLastUserInputAt`,
`markUserInput` — an autoscroll/pin controller, with no index API. *Rejected* on
availability, and would have been rejected anyway: the component is minified to `Oj`, a
name that changes every deploy, and coupling to React internals is precisely the Layer 3
hazard DEC-019 punished.

**Text matching as the node→index bridge.** *Rejected:* it is what `data-index` makes
unnecessary, and it had already produced a CRITICAL.

**Linear re-estimation from a global px/message average.** *Rejected:* `scrollHeight` drifts
3.2% as rows are measured, so a global average is wrong by ~9–10 messages and does not
improve with iterations. Interpolating between real observed anchors converges instead.

**Hardcoding the measured `+1` offset.** *Rejected:* it was measured from a single matched
row, and a wrong offset lands every jump one message off, silently. Derived per jump from
all mounted user rows instead, refusing to convert when they disagree.

**Caching resolved scroll offsets per message (spec §4.2).** *Deferred:* with `scrollHeight`
drifting, a cache keyed to pixels is actively harmful — it would send later jumps to stale
positions. A cache keyed to row anchors would be safe and is the right follow-up. This
leaves the "repeat jump is near-instant" acceptance criterion unmet, deliberately and on
the record.

### Constraints
- Re-read `scrollHeight` every iteration; never seed from a cached absolute offset
- Landing detection must use the cluster nearest the scroll position and **exclude the
  pinned tail** — the last ~3 rows stay mounted at every scroll position, so plain set
  membership reports a false hit for tail indices from anywhere in the conversation
- Reposition ONLY — **superseded by DEC-024**, which removes the synthetic scroll event
  entirely after three repeated runs showed it causes a reproducible ~6-row overshoot
- Read actual `scrollTop` after every move — the landed position is not the requested one
  (a constant −360 px even without the dispatch)
- Guard on `document.visibilityState`: a hidden tab throttles rAF and the virtualizer stops
  running entirely, so the loop cannot converge
- `requestAnimationFrame` polling must have a timer-based escape hatch for the same reason
- User input always wins — abort on a trusted scroll event, never fight the user
- Non-virtualized platforms short-circuit to plain `scrollIntoView`
- Iteration cap 8, then the honest failure message. Never loop indefinitely

### How it fixed it
Clicking any question now pages the virtualizer to it. Verified in CI against a mock that
reproduces `data-index`, the non-contiguous pinned tail and scroll-driven unmounting:
question #1 is reached from the bottom of a 40-turn conversation in ~200 ms, with the
target provably unmounted at click time.

---

## DEC-024: No Synthetic Scroll Event — Reposition Only (v12.0 Phase 3)
**Date:** 2026-07-26 | **Stage:** v12.0 Phase 3

### Decision
`ciMoveTo()` sets `scrollTo({top})` and **nothing else**. It does not dispatch a
synthetic `scroll` event. This is not behind a flag; the dispatch is removed.

### Context — a dead end reached twice
Phase 1 measured, from Chromium's DevTools console, that `scrollTop = x` alone did not
remount while `scrollTo()` + a dispatched `scroll` event did. That result was written
into three files as settled fact and became the justification for dispatching.

**Both halves of that were wrong.**

The Chromium measurement was taken in a **hidden window**, where rAF is throttled and the
virtualizer does not run at all — the same artifact `CLAUDE.md`'s measurement-context
table now lists as a corrected finding. Probe B then showed `scrollTop` alone *does*
remount from the Firefox sandbox.

Worse, the dispatch is actively harmful. Probe C was run three times with nothing changed
between runs:

| Run | With dispatch | Without dispatch |
|---|---|---|
| 1 | requested 135590 → landed 132806 (drift −2784), cluster `[117,118,119,120]` | drift **−360**, cluster `[117,118,119,120]` |
| 2 | requested 136292 → landed 130043 (drift −6249), cluster `[113,114,115,116]` | drift **−360**, cluster `[119,120,121,122]` |
| 3 | identical to run 2 | drift **−360**, cluster `[119,120,121,122]` |

Without the dispatch the drift was **exactly −360 px in all three runs**. With it, the
drift tripled and — the decisive evidence — **cluster identity moved**: the dispatch run
targeted a *lower* document position (136292 vs 134056) yet landed roughly **six rows
higher**, past the ±5 row tolerance. That is a real overshoot, not measurement noise, and
it is reproducible.

**Mechanism:** dispatching a scroll event makes the application run its own scroll
handling, which triggers an extra height-measurement pass and shifts the coordinate
system mid-jump.

### The wrong diagnosis, recorded so it is not re-derived
Probe C runs 2 and 3 printed **"DISPATCH HARMFUL — it appears to trigger pin/autoscroll
behaviour"**. The concern was right; the attribution was wrong. It is **not** the pin
controller:

- `scrollTop` and cluster identity were **static across all eight samples over 3.2 s**.
  Pin behaviour would show *progressive* movement toward the bottom.
- The drift is **negative** — away from the bottom. A pin pulls *toward* it.
- `SNAPPED_BACK_TO_BOTTOM` was false in every run.
- In run 2, `scrollTop` changed 136292 → 130043 while the **same four rows** stayed
  mounted: the content did not move, only the coordinate.

All of it happens during settle, *before* sampling begins. The cause is the
`scrollHeight` re-normalisation already measured in Probe A (12,050 px / 3.2% shrink as
estimated row heights are replaced by measured ones), compounded by `scrollHeight` also
varying per page load (387132 / 388841 / 390502 observed). The verdict "flipped" between
runs only because the probe thresholded on pixel drift: run 1 fell under the threshold,
runs 2 and 3 crossed it.

**Therefore: do NOT build a pin-interference abort.** There is nothing to abort.

### Constraints
- `ciMoveTo()` repositions only — never dispatch a synthetic scroll event
- Do not add a pin-interference abort; the pin controller does not fight the jump
- Do not cite the Chromium "scrollTop alone does not remount" result as justification for
  anything: it was measured in a hidden window and is listed as a corrected finding
- Re-read `scrollTop` after every move — the position that lands is not the position
  requested, even without the dispatch (−360 px consistently)
- Any future claim about virtualizer scroll behaviour must state its measurement context
  and be reproduced more than once. This finding required three runs to become visible;
  a single run produced the opposite conclusion.

### How it fixed it
Landing became reproducible: without the dispatch the drift is a constant −360 px, so
the interpolation converges on stable ground instead of chasing a coordinate system that
the dispatch itself was moving.

---

## DEC-025: Test Assertions Read Backing Data, Not the Recycled DOM (v12.0)
**Date:** 2026-07-26 | **Stage:** v12.0 Phase 3 — CI hardening

### Decision
Any assertion that asks **"which message did the navigator resolve?"** reads the mock's
`MESSAGES` array via `__mockVirtualization.rowText(i)`. It never reads
`querySelector('[data-index="N"]').textContent`.

### Problem
The jump tests passed on Linux and macOS and failed on **all three** Windows engines,
with an identical and entirely correct jump:

```
linux/macOS  ✓ expected row 38, resolved row 38, correctMsg=true   rows=[34,35,36,37,38,39,79]
windows      ✗ expected row 38, resolved row 38, correctMsg=false  rows=[41,42,43,44,45,46,79]
```

`resolved row 38` is the implementation reporting the right answer on every OS. Only
`correctMsg` diverged.

### Technical root cause
The assertion resolved the row *index* durably — from the `data-acn-jump-resolved`
attribute on the zone, added precisely because the resolved element does not survive
(DEC-023) — and then looked the *text* up in the live DOM. By that point row 38 has
usually been recycled out again: the re-render that `scrollIntoView` triggers is what
unmounts it. Whether the row is still mounted when the assertion runs is a race between
the mock's render loop and the test's polling, so the outcome tracks **machine speed**.
Windows runners are slower, the mock drifted three rows further, `rowNow` was `null`, and
`correctMessage` came back false for a correct jump.

This is the same defect that `data-acn-jump-resolved` was introduced to fix, left behind
one line below the fix — the durable read and the fragile read sat adjacent in the same
return statement.

### Method chosen and why
Expose `rowText(i)` on the mock, backed by the `MESSAGES` array that is always present
regardless of mounting.

Deleting `correctMessage` was rejected. It is the assertion that caught the most
important mutation of the release — offset forced to `0` with verification stubbed made
the navigator resolve the **assistant reply** instead of Question 1, and `isQ1=false` was
what exposed it. Removing a flaky check that is also the load-bearing one trades a red CI
for a silent one.

### How it fixed it
Deterministic on every OS, and re-verified as still diagnostic — under the same mutation
both assertions fail, with `resolved=row 1 isQ1=false` and `expected row 38, resolved row
39`. The general rule is the product's own Layer 4 rule applied to the harness: **do not
ask the DOM for data the index already holds.** A virtualized mock is subject to it
exactly like a virtualized platform.

---

## DEC-026: No `--single-process` in the Chromium Test Launcher (v12.0)
**Date:** 2026-07-26 | **Stage:** v12.0 Phase 3 — CI hardening

### Decision
`--single-process` is removed from the Chromium launch args and must not be re-added.

### Problem
Windows Chromium CI reported **13 of 16 platforms failing**, all with the same message:

```
✗ No runtime errors: page.unrouteAll: Target page, context or browser has been closed
```

Firefox and WebKit on the same runner reported **266/267 — one honest failure** (DEC-025)
and nothing else.

### Technical root cause
`--single-process` had been present since the suite's first commit (`9bad2b1`), justified
by an Antigravity IDE sandbox on Linux kernel 4.4.0 that this project has not run in for a
long time. In that mode the renderer shares the browser process, so there is no crash
isolation: one renderer fault takes the entire browser with it, and every subsequent
platform fails on its first Playwright call.

It was survivable while the mocks were static and light. `claude-virtualized.html` gained
scroll-driven mounting, varied row heights and progressive measurement in v12.0, and the
extra renderer work was enough to trip it on the slower Windows runners.

So one fault was being reported as fifteen broken platforms — the flag did not cause the
fault, it **amplified** it and destroyed the evidence.

### Method chosen and why
Remove the flag. `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu` and
`--disable-dev-shm-usage` are the legitimate CI args and are retained.

### How it fixed it
A renderer fault now costs one platform instead of thirteen, and the failing platform is
the one that actually failed.

**Diagnostic tell worth keeping:** when one engine cascades and the others report a single
clean failure on the same runner, suspect crash isolation in the launcher rather than the
code under test. The asymmetry is the clue — the flag was Chromium-only, and so was the
cascade.

### What the asymmetry did and did not prove, and how it was settled
A review lens correctly objected that the Firefox/WebKit comparison proves the *cascade*
is flag-attributable but not that the underlying renderer fault would be absent under
supported multi-process Chromium — `--single-process` is an unsupported mode and faults
exclusive to it are common. The decisive experiment is simply a Windows Chromium run
without the flag.

That has since run **twice, green both times** (`fde7ac2` and `349026f`, 9/9 checks,
Windows Chromium ~5m53s). So the fault does not reproduce without the flag. Recorded
because the objection was right on the evidence available at the time: removing a flag
re-scopes a blast radius, and re-scoping is not diagnosis. The green runs are the
diagnosis.

---

## DEC-027: Resolve-on-Arrival Replaces Global Mapping (v12.0)
**Date:** 2026-07-27 | **Stage:** v12.0 Phase 3 — jump rebuild

### Decision
The jump no longer answers "what is the target's exact dataIndex?" **before** moving.
It aims with the predicate/anchor seed, lands, and resolves **on arrival** against the
~7 mounted rows: the target's own text first (one matcher, shared with the fast path),
window-local offset pairs second, a bounded shift third. No pre-scroll resolution gates
the jump; the `ambiguous-mapping` exit does not exist.

### The gate that forced it (spec §5 — recorded numbers)
CI was required to reproduce the live failures BEFORE the implementation was built.
Fixture matrix: 294 rows / N=10 unrendered entries (full every-question sweep), 120-row
hostile (duplicated short questions, attachment rows whose DOM chip cannot match their
API text — the live Q#1 shape — one predicate-blind entry, one 15,000px row), 150 rows /
N=3 (strided).

| Build | N=10 | hostile | N=3 | total failed jumps |
|---|---|---|---|---|
| `0a30d3b` (produced the live traces) | 23/147 | 12/60 | 4/15 | **39** |
| `1200a4b` (the 6-fix pass) | 10/147 | 13/60 | 1/15 | **24** |

**The 6-fix build still failing 24 jumps is the evidence that stopping there would have
shipped a broken feature.** The gate caught it in CI instead of a live session — the
first time in v12.0 that CI failed before the owner did.

### Why global mapping was structurally wrong
The number of unrendered path entries U is tiny (bounded by `pathLength − aria-setsize`),
so the target's dataIndex is confined to a range of width U+1 — smaller than the mount
window. Landing in a neighbourhood that contains the target never requires the exact
offset; exact resolution after arrival needs text uniqueness only among ~7 mounted rows
instead of all 294. The old design demanded a global answer before moving and failed
precisely where its inputs were weakest (regions whose rows don't uniquely text-match
globally): targets 213/223/227 spent 6–9s in byte-identical iterations —
`est=290645 actual=290645 anchors=10` unchanged across all 8 — then exited
`ambiguous-mapping`.

### Measurement-context addendum
The MCP measurement browser was found running ACN **v11.8** during this work. The live
sweeps stand — they were raw console JS that never invoked the userscript, and the
harvest stripped `[data-acn-bookmark]` before matching — but *which version of your own
script is installed in the measurement browser* is now on the context list: an old build
scanning and mutating the DOM mid-measurement is a confound the numbers cannot reveal.


### Proof chain closed — LIVE CONFIRMED (2026-07-27)
| Build | Acceptance jumps | Live |
|---|---|---|
| `0a30d3b` (produced the live traces) | fails 39 | failed live |
| `1200a4b` (6-fix pass) | fails 24 | never shipped — the gate caught it |
| `5f2a8be` (resolve-on-arrival) | **222/222 exact** (avg ~330ms, max 925ms) | **PASSED** — Firefox, 147-question conversation, arrival highlight tracking the exact clicked question |

The `overflow-anchor` caveat resolved empirically: no teleporting observed live.
Methodology worth keeping: **an old build must FAIL a new fixture before the fixture
counts as a reproduction** — a fixture the old code passes is not reproducing the bug.

---

## DEC-028: A Fixture's Defaults Are Part of the Finding (v12.0 close-out)
**Date:** 2026-07-27 | **Stage:** v12.0 Tier 3 review, post-freeze

### Decision
A test fixture's incidental constants — latency, payload shape, timing — are **claims
about the environment**, and a green suite is only evidence for the environment the
fixture actually models. Where a constant is knowably unrepresentative, either set it to
the measured value or add a second entry that does, and say which.

### What forced it
Two CRITICALs shipped in v12.0 and survived a 23-round independent review. Neither was
subtle in the code; both were unreachable in CI because of one fixture default each.

| Defect | Fixture default that hid it | Live value |
|---|---|---|
| Unbounded `scanConversation` ↔ `ciLoadIndex` recursion (RangeError storm on every load) | GM fixture answers in **5ms** | ~2.1s payload |
| Success-driven refetch loop, full payload every ~15.5s forever on an idle page | fixture API text **always equals** the DOM | tool/artifact answers render more than their text blocks carry, permanently |

The recursion needs a second scan to land inside the fetch window. At 5ms none ever
does; at 1200ms it happens on essentially every load. Nothing about the userscript
changed between those two runs — only a number in the harness.

This is the measurement-context rule (CLAUDE.md) applied one level out. The existing rule
governs where a *measurement* was taken. This governs where a *test* was taken: the suite
is a measurement instrument, and its constants scope every result it produces.

### Consequences
- `apiLatencyMs`, `toolShapedRow` and `refetchProbeMs` are now per-entry fixture knobs,
  with two dedicated guard entries: *Claude (slow API — load recursion guard)* and
  *Claude (tool-shaped row — refetch loop guard)*. Both are **ancestor-gated** — they fail
  on `6bc7ed2` and pass on the fix, per DEC-027.
- The 5ms default remains for the other entries, deliberately: fast where latency is not
  what is under test, realistic where it is.
- **Corollary for reviewers:** when a bug is "impossible per CI", suspect the fixture
  before the reasoning. Ask which constant makes the bug unreachable, then change that one
  constant and re-run.

---

## DEC-029: End a Review Loop on Finding Provenance, Not Finding Count (v12.0 pre-merge)
**Date:** 2026-07-28 | **Stage:** v12.0 pre-merge hardening

### Decision
Decide when to stop an automated review loop by classifying each round's findings into
**pre-existing defects** versus **defects in fixes made during this loop**. While pre-existing
dominates, continue. Once loop-introduced defects dominate, stop — **even if findings are still
real and still P1**.

### Context
A 24-round GitHub Codex cycle produced ~42 findings with **zero false positives**. Round count
and severity both argued for continuing: rounds 21, 23 and 24 each produced a P1. The owner
asked the right question — "is our code that buggy?" — and the count could not answer it.

The provenance split could: roughly **19 pre-existing** defects (about one per 240 lines of a
4,567-line release, unremarkable for a release this intricate) versus roughly **23 defects in
fixes made during the cycle**. Individual mechanisms needed four and five iterations. The cycle
had also written **1,018 lines** — 22% of the release — into the Summary/Export surface, which
mutation testing proved the suite does not execute at all. Each fix's only verification was the
next round reading it.

### Alternatives considered
- **Run until a clean round.** Rejected: in freshly-written, untested code a good reviewer will
  keep finding real material indefinitely. "Clean round" measures the reviewer's patience, not
  the code's health.
- **Stop on a severity floor (no more P1s).** Rejected: severity does not distinguish a P1 in
  shipped code from a P1 in a mechanism introduced twenty minutes earlier. Ours were
  increasingly the latter.
- **Stop on a fixed round budget.** Rejected as arbitrary; it would have stopped before the two
  load-path CRITICALs were found, or long after the loop turned self-referential.

### Rationale
A review loop is only reducing risk while it is reporting on code that predates it. Once most
findings are its own output, the loop has become the dominant *source* of defects, and each
additional round has roughly even odds of creating the next finding. That is a random walk, and
no amount of reviewing converges it — only a feedback signal does.

### Key properties
- Track provenance **per round from the start**, not retroactively.
- The aggravating factor to check alongside it: how much new code the loop has written into
  surface no test executes.
- The exit is **not** another round: stop changing code → live-verify → merge → fixture the
  untested surface first in the next version.
- Say the arithmetic out loud to the owner. "Still finding P1s" invites grinding; "23 of 42 are
  ours" ends the debate.

---

## DEC-030: Provisional Bookmarks Bind by Identity, and Only When Text Is Unique (v12.0)
**Date:** 2026-07-28 | **Stage:** v12.0 pre-merge hardening

### Decision
A bookmark taken before its message has an API uuid stores **identity hints, not text**
(`pendingHash`, `pendingSender`, `pendingOrdinal`, `pendingRow`) and is upgraded to schema 2
once the refreshed index knows the uuid — but **only when that text occurs exactly once in the
active path**. Duplicate-text messages stay provisional and resolve while mounted.

### Context
Bookmarks store identity, not position: schema 2 keys to the message uuid, schema 1 to a content
hash. Only a **uuid** lets `orbScrollToBookmark` fall through to the jump bridge that pages the
virtualizer to an unmounted message — so on Claude a schema-1 record works *only while its
message is on screen*.

There is an unavoidable window that produces one: you send a prompt, it mounts immediately, the
index snapshot predates it, and the refetch takes ~2s (up to ~17s behind the cooldown).
Bookmarking in that window produced a permanently dead record on the newest message — the one
most likely to be bookmarked.

This is the gap the conversation index did **not** close. v12.0 gave Navigate, Search and Export
the whole conversation; bookmarks still silently depended on the mounted window.

### Alternatives considered
- **Leave it.** Rejected once understood: a dead bookmark on your newest message is a visible
  failure of the feature's core promise.
- **Migrate on click.** Rejected — click-time resolution already requires the message to be
  mounted, which is exactly the case that already worked.
- **Store the full text and re-look it up.** Shipped briefly, then reverted: it wrote entire
  prompts into `GM_setValue`, contradicting README's privacy guarantee (Codex P1). A hash is
  sufficient because migration only ever *compares*.
- **Bind on ordinal alone.** Rejected — `_ciBindMountedElements` assigns one mounted node to
  *every* same-text question, so a position lookup returns the earliest twin.
- **Bind whenever a hash matches (no uniqueness gate).** Rejected as the final hardening: routes
  1 and 2 are position anchors, and a hash check cannot distinguish twins, so a shifted anchor
  landing on a same-text message would persist a wrong uuid **forever** — migration then skips
  the record because it looks bound, and both the jump and the toggle act on the wrong message.

### Rationale
Refusing to bind is cheap and recoverable: the record stays provisional and still works whenever
its message is mounted, and the user can re-bookmark later for a clean schema-2 record. Binding
wrongly is permanent and silent. Given that none of this machinery has a fixture, the asymmetry
decides it.

### Key properties
- **Position may confirm identity; it may never establish it.** All three routes verify content.
- Uniqueness is checked **ahead of** all routes, which also makes route 3 a lookup rather than a
  disambiguation — its comment says so, since a comment describing an unreachable check is the
  defect class this project keeps catching.
- Migration runs **once per index generation**, not per mutation batch.
- No conversation text is persisted — only a hash.
- **Unfixtured.** v12.1's first task is live-testing and fine-tuning this, then covering it.

---

## DEC-031: Review Decay — a Live Confirmation Expires When the Build Moves (v12.0)
**Date:** 2026-07-28 | **Stage:** v12.0 post-merge

### Decision
A live confirmation certifies **one commit**, not a release. Any change to arrival, matching,
verification, settle, or bookmarks re-runs the **full acceptance matrix on both engines** before
landing — not just the tests nearest the change — and a release does not merge until a live
confirmation has been run on the **final** commit, not an early one.

### Context
`5f2a8be` was live-confirmed on a real 147-question conversation, including the
attachment-headed Q#1 case that had just been fixed. Thirty-four hardening commits then landed
on top of it — a 5-lens Tier 3 gate and a 24-round Codex cycle, every round green on both
engines — and shipped. Live testing after the merge found the attachment-headed Q#1 jump broken
again.

The suite never dipped below green. Each round verified the code nearest its own change, the
acceptance sweep kept reporting every jump exact, and a real user-facing path degraded anyway.
The mock resolves that case by a cheaper route than the live site does, so no assertion in the
matrix was ever load-bearing for it.

### Alternatives considered
- **Re-run only the tests near the change.** This is what happened, and it is what failed. The
  regression was in the jump path; the acceptance sweep *did* run and *did* pass.
- **Re-confirm live after every round.** Rejected as impossible — 24 rounds, each needing a
  human on Firefox with a real conversation.
- **Trust the round-by-round green.** Rejected: that is precisely the assumption that decayed.

### Rationale
Green-per-round measures that no *modelled* behaviour regressed. It says nothing about behaviour
the model reaches by a different route than the site does. Over enough rounds, the gap between
"the suite is green" and "the product works" widens silently, and the only thing that closes it
is a live run on the commit actually being shipped.

### Key properties
- **A live confirmation names a commit.** Record which one, and treat it as expired the moment
  the build moves past it.
- The full matrix on both engines is the floor for the listed subsystems, not the ceiling.
- This is the third compounding instance of the same root cause as **DEC-028**: the mock differs
  from the site in exactly the detail that matters, and each newly-discovered difference is
  hand-modelled one live failure late. The systemic answer is to generate fixtures from real
  payload STRUCTURE rather than hand-authoring it (v12.1).
- Corollary, learned the same day: **two failed reproductions are data.** When a hypothesis
  cannot be made to fail in the harness, the harness — not the reasoning — is usually what is
  wrong, and the honest report is "not reproduced", never a fix asserted on plausibility.

---

## DEC-032: A Fixture Knob Must Be Proven to Change the Output (v12.1)
**Date:** 2026-07-28 | **Stage:** v12.1

### Decision
A new fixture knob is not evidence until it is shown to **change the output**. Assert the
property the knob claims to model — not the knob's presence — before using it in an A/B.

### Context
Hunting the live attachment-headed Q#1 failure, a `chipRows` knob was added to render a user
row as a file chip with no `[data-testid="user-message"]`. It was written as
`CHIP_ROWS.indexOf(i)` inside `buildRow(index)` — the wrong variable — so `isChip` was always
false and every chip row kept its testid.

**Two A/B comparisons were then run against a fixture that could not fail**, and both were read
as "the hypothesis is disconfirmed." A fixture that cannot fail is indistinguishable from one
that passes: same green output, same confident conclusion, opposite meaning. The error was only
found by tracing the pre-jump path and noticing Q#1 taking a route a chip row should not have
been able to take. Once corrected, the reproduction was immediate and the hypothesis was right
all along.

### Rationale
This is the **v12.0 bug reappearing inside the test tooling**. The original Layer 4 break
reported success on 3% of the data; a vacuous knob reports success on 0% of the condition it
claims to create. Both are silent, both look like health, and both defeat the reviewer.

### Key properties
- **Assert the modelled property directly.** For `chipRows`: assert the chip row has no
  `[data-testid="user-message"]`. For `shortAnswerRows`: assert the rendered answer is below the
  60-char pairing floor. The knob is a mechanism; the property is the claim.
- **A knob's first run must FLIP something.** If enabling it changes no assertion and no trace,
  it is not wired up — treat that as the null result it is, not as evidence.
- Extends DEC-027 (an old build must fail a new fixture) one level down: **the fixture must
  first be capable of failing at all.**
- Extends DEC-028: fixture *defaults* are claims about the environment; fixture *knobs* are
  claims about the condition under test. Both need proving.

---

## DEC-033: Safe vs Unsafe Generalization — Provably Absent, Not Merely Unmatched (v12.1)
**Date:** 2026-07-28 | **Stage:** v12.1

### Decision
One-sided resolution may be treated as EXACT only when the missing evidence is **provably
absent**, never when it is merely **unmatched**.

### Context
3b accepts a one-sided pair as exact at distance 1: with `|near.p - P| === 1` no integer sits
between the two path indices, so no hidden unrendered entry can be in the gap. That is a
pigeonhole fact.

A proposed broadening — "treat one-sided as exact whenever the target is the first or last
renderable entry, since the missing side cannot exist" — looks like the same argument and is
not. At distance > 1 the step count between the pair and the target comes from the **predicate**,
and a predicate-blind unrendered entry makes it wrong. The edge targets are exactly the ones
that cannot be text-verified, so a wrong step count would be accepted as a confident landing —
the failure `meta.exact` exists to prevent. (Proposed and withdrawn by the owner in the same
exchange, on this reasoning.)

### Rationale
The distinction is the *reason* the evidence is missing:
- **Provably absent** — no row can exist there (adjacent indices; row 0 has nothing above it).
  Safe: the conclusion follows from structure.
- **Merely unmatched** — a row may exist and simply failed to pair (short assistant text, tool
  output diverging from API text, ambiguity). Unsafe: absence of evidence, not evidence of
  absence.

Both look identical from a distance: "there is nothing on that side."

### Key properties
- The correct cover for path extremes is the **by-construction** path (first renderable human IS
  row 0), which needs no step counting at all — not a widened 3b.
- Relatedly, `ciMatchRowToPath` pairs an assistant row only when its normalized text is ≥60 chars
  AND uniquely matchable. For a chip at path 0 the only possible adjacent pair is that assistant
  answer, so whenever it is short or tool-shaped, 3b's carve-out is unavailable and the
  by-construction path is the sole cover. That is why breaking it (DEC-031) was invisible until
  a live attachment conversation hit it.

---

## DEC-034: Legacy Bookmark Recovery — an Evidence Ladder, and the Hash as an Oracle (v12.1)
**Date:** 2026-07-29 | **Stage:** v12.1

### Decision
A pre-v12.0 schema-1 record may be upgraded to a uuid only through one of four evidence
channels, each sender-scoped and (where it can be ambiguous) uniqueness-gated:

| Channel | Evidence class |
|---|---|
| A — preview is a prefix of the message text | text, strong |
| B — the message's opening appears inside the preview | text, strong |
| C — the preview matches a thinking-block ACTIVITY SUMMARY | text, strong — different field |
| Harvest — the stored `contentHash` REPRODUCES against mounted rendered text | **proof** (~2⁻³² collision) |

Position never establishes identity (DEC-033). `msgIndex` is carried but never bound on.

### Context
16 live records. Rules A/B (plus glyph stripping) recovered 7. The remaining 9 all had the
same shape: the preview was **Claude's collapsed activity summary, doubled, with zero message
text anywhere in its 120 characters** — unmatchable against the message body *by construction*.

The initial conclusion was "unrecoverable by text." That was wrong, and the correction came
from re-reading the diagnostic output rather than the code: **the preview is not noise. It is
a faithful capture of a DIFFERENT field** — the model-generated summary the client renders
above a thinking/tool answer — and that field rides in the payload's thinking blocks, which
`ciBuildIndex` was already walking for `thinkingChars` and simply not keeping.

### The hash-oracle insight
`contentHash` = FNV-1a over `(ordinal | first 200 rendered chars)`. It cannot be inverted, but
it can be **reproduced**: hash what is mounted right now under the plausible ordinals, and
equality is identity — not an inference. This makes the harvest exempt from
refuse-on-ambiguity: it structurally cannot guess. It runs on every scan over the ~3–7 mounted
rows and at click time, so a record no text channel can recover still binds the first time its
message scrolls into view.

**Ordinal-era trap, handled by trying both:** pre-v12.0 hashes used the rendered-only DOM
enumeration index; `_bmPathOrdinal` counts non-rendering path entries too. One interrupted
turn early in a conversation shifts every later ordinal and would have silently zeroed the
harvest.

### Hypothesis → MEASURED (2026-07-29)
The payload shape was verified directly against the owner's real 297-message conversation,
fetched through Chromium with the userscript's own URL parameters (measurement context: page
realm, live claude.ai, n=1 conversation): 61 thinking blocks, **55 carrying
`summaries: [{summary}]`** — the hypothesized shape exactly.

The same measurement found the defect in rule C's first form: **the DOM header TRUNCATES the
summary for display.** The captured preview holds a truncated (usually doubled) COPY while
the payload holds the full text, so whole-string prefix matching fails in both directions on
3 of the 6 live shapes. Rule C's final form is a **40-char bidirectional probe**
(`preview contains summary[0,40]` OR `summary contains preview[0,40]`), which the measurement
showed binds **all 6 previews uniquely** — each to exactly one assistant entry with a uuid.
Uniqueness remains the gate that makes a 40-char probe safe. The diagnostic
(`summaries=<count> bestSummaryPrefix=<n>`) stays, as regression telemetry now rather than a
falsifier.

### Postscript — label vs key (owner-requested, same day)
What a bookmark row DISPLAYS and what it MATCHES on are now different strings by design.
The stored preview remains the matching evidence; the panel and the bookmarks export derive
their labels from the index by uuid at render time (`_bmDisplayText`), falling back to the
preview when no index is available. Summary-labelled rows "identify the record to the code
but not to the owner" — the owner had to click one to learn what it was. Storage is never
rewritten, so the evidence chain stays intact.

### Alternatives rejected
- **Bind on stored `msgIndex`** — position establishing identity; wrong forever after any
  edit; rejected per DEC-033.
- **Candidate-reconstruction hashing** (rebuild the 200-char hash input from summary + body
  and test) — sound in principle (also oracle-class) but fragile to rendering-vs-markdown
  divergence; deferred unless the shipped channels leave a residue worth chasing.

---

## DEC-035: Proof Outranks Inference, and Inference Must Never Destroy Proof (v12.1)
**Date:** 2026-07-29 | **Stage:** v12.1

### Decision
When a record can be identified by more than one class of evidence, the **proof-grade** channel
runs first and may **correct** a binding made by an inference channel. Inference may never
overwrite the evidence proof depends on.

### Context
Legacy bookmark recovery has four channels (DEC-034): three text rules — inference — and the
hash oracle, where the stored `contentHash` reproduces exactly against mounted rendered text so
equality *is* identity (~2⁻³²).

`_bmCommitLegacyUpgrade` wrote `b.contentHash = uuid`. That hash was the only proof-grade
evidence the record carried, and the text rules ran first in the scan. So the guess channel
destroyed the proof channel's input **before it ever ran** — and because the record then looked
bound, no channel re-examined it. A wrong inference became permanent *and* unverifiable.

Reproduced by review: a record whose hash proves "Answer number 3" but whose preview is a
summary-then-body capture of "Answer number 9" binds to 9; with rule B disabled it binds to 3.
Both runs green — nothing could tell the difference. Rules B and C exist *precisely because*
the preview does not contain the message text, so preview-and-hash disagreeing is the normal
operating regime for them, not a contrived case.

### Alternatives considered
- **Order the channels but still overwrite the hash.** Rejected: proof would win the first
  race, but a record bound by inference in an earlier session or before the message ever
  mounted could never be corrected — the evidence is gone.
- **Never let inference bind at all; require proof.** Rejected: proof needs the message mounted,
  and the whole problem is that ~3–7 of 147 turns are. Most records would stay dead.
- **Re-derive the hash from the index.** Rejected: the hash covers the *rendered* text at
  bookmark time, including the collapsed activity header. It is not reconstructible from the API.

### Rationale
Evidence classes are not interchangeable, and the cheap one usually runs first because it is
cheap. Without an explicit precedence rule that is exactly backwards: the weakest evidence
commits, and the strongest never gets asked.

### Key properties
- `legacyHash` preserves the oracle; `boundBy: 'proof' | 'inference'` records provenance.
- The harvest re-examines inference-bound records and **corrects** them, logging loudly.
- Proof runs before inference within a scan, forced past the mount-set gate on a new index
  generation (a new generation is itself new evidence).
- **Generalisation for this codebase:** any future channel added to a resolution ladder must
  declare its evidence class, and a lower class must not mutate a higher class's inputs.

### Postscript to DEC-032 (same session)
The vacuous-knob rule was violated in the very fixture written to demonstrate it: the chip
fixture's bounds tolerated a range, so `chipRows` could stop suppressing the testid and stay
green. Now asserts the modelled property directly (row mounted, no `user-message` node) and is
**mutation-verified** — forcing `isChip=false` fails it. Writing a rule is not applying it; the
first place to check is your own newest work.

---

## DEC-036: Degraded-Runner CI Episodes Are an Environment Class — Timeout, Forensics, Requeue-Once, Never Loosen Budgets (v12.2/CI)
**Date:** 2026-07-30 | **Stage:** post-v12.2

### Decision
A CI job on a degraded shared runner is handled by POLICY, not by per-incident debugging:
`timeout-minutes: 20` caps the cost (2× the slowest healthy job), per-entry wall-clock in the
suite output and `vis=`/`raf10=` forensics on failed jumps make the log self-diagnosing, and the
response to the signature is **requeue once**. Assertion budgets and the product's settle caps are
never loosened to make a sick host green.

### Context
Five webkit-on-macos episodes in a single day: jobs at 40–75+ minutes against a healthy 5m41s–9m47s
range, acceptance jumps returning null at the product's give-up ceiling **consecutively in visit
order**, sibling entries on the same run exact at ~300ms — on commits that passed identically on
fresh runners minutes before or after. Same `macos-26-arm64` image, same Playwright WebKit build,
across green and red runs: not a rollout, not a version, host variance. One red had already slipped
onto `main` unnoticed at the #60 merge; another had to be killed by hand at 75 minutes. The mac
WebKit port is the only Cocoa WebKit in the matrix (Linux/Windows run GTK/WPE), so a mac-host
pathology shows on exactly one job — which is also why it reads, wrongly, like a flaky test.

### Alternatives considered
- **Loosen the jump budgets / raise caps.** Rejected: hides real slowdowns everywhere to
  accommodate a sick machine somewhere. The budgets are measured product claims.
- **Auto-retry the job in the workflow.** Rejected for now: a silent retry converts an environment
  signal into invisible cost. Requeue is deliberate and human-visible; revisit only if frequency
  stays high for weeks.
- **Ignore (treat as flakiness).** Rejected: it cost an unnoticed red on `main` and an hour-long
  hang, and "flaky" is exactly the label that stops diagnosis. The Windows rule (a runner-specific
  failure is usually a REAL finding about an assertion) still holds — this class is distinguished
  from it by its signature, not by hand-waving.

### Key properties
- The signature, in full, lives in `TESTING.md` → "CI: reading a webkit-on-macos failure or hang" —
  including when a red is NOT this class (healthy `raf10` + wrong rows = real finding).
- The forensics were themselves reviewed: the rAF probe must not pollute the duration it annotates
  (Codex P2 — capture `ms` before probing).
- The per-entry live print (`Testing X...` flushed before the entry runs) is load-bearing: a wedged
  job's streaming log names the entry it is stuck in.
- **A second variant, 2026-08-01 (v12.5 branch): the SILENT wedge, and requeue-once did not clear
  it.** Four attempts across three heads hit the 20-minute cap having printed no assertion output
  at all — healthy per-entry times, then silence mid-entry. What ruled the code out was not
  plausibility but an identity: `ai-conversation-navigator.user.js`, `tests/` and `.github/` are
  byte-identical between the two heads that PASSED this job (6m01s, 5m54s) and the three that
  wedged — the diffs touch only `probes/` and `reviews/`, which the suite never reads. Same input,
  both outcomes; webkit-on-ubuntu and webkit-on-windows green throughout; the wedge point moved
  between attempts (two different entries), always in the window after the heaviest virtualized
  entry. **The generalizable rule: when a flaky-looking red appears, the first question is not
  "which test?" but "did the tested bytes change?" — a pass and a fail on identical input is a
  complete refutation of any code hypothesis, and it takes one `git diff` to establish.** Also:
  `githubstatus.com` showed Actions fully operational the whole time, so an absent incident report
  is not evidence of a healthy runner pool. **Resolution, recorded because it tested the read:**
  the next run — a docs-only push ~12 minutes after the last wedge — came back green at 6m04s on
  the same suite and userscript, ending a ~65-minute episode (04:05–05:11 UTC). Full record in
  TESTING.md.

---

## DEC-037: Silent Non-Execution Is a Detectable Failure Class — Presence Checks, and Commit-Before-Mutating (v12.3)
**Date:** 2026-07-30 | **Stage:** v12.3

### Decision
Two harness disciplines, both purchased with this session's mistakes:

1. **Opt-in fixture blocks declare the assertion titles they must produce, and the harness
   hard-fails when a declared title never ran** (the FIXTURE PRESENCE check). A fixture that
   silently never executes is indistinguishable from one that passes — same green, opposite
   meaning — and no count-based signal catches it because nothing checks per-entry counts.
2. **Mutation-verification runs against a COMMIT, never against uncommitted work.** Restore
   between mutants is `git checkout --`, which resets to HEAD; if the fixtures being verified are
   uncommitted, the first restore destroys them and every subsequent mutant run is measuring the
   wrong code.

### Context
v12.3's first version nested E2 (the degraded-export fixture) inside `if (platform.indexBacked)`
while its only entry is deliberately NOT index-backed. Unreachable, green, and **claimed as
coverage in three documents** — caught by all five Tier 3 lenses, verified by running the entry
and observing the assertion absent from the output. This is DEC-032's vacuous-knob failure one
level up: not an assertion that cannot fail, but a block that cannot RUN.

The commit rule was learned twice in one session: a `git checkout` between mutants first wiped the
uncommitted contract attributes (making three of four mutant results red-for-the-wrong-reason),
then — after the rule had been stated — wiped the uncommitted Tier 2/3 fixes and invalidated a
second 4-mutant run. Both recoveries were full re-applications from conversation context.

### Alternatives considered
- **Expected-assertion-count per entry.** Rejected: a count moves for legitimate reasons (new
  tests) and fails opaquely; titles name exactly what is missing.
- **Presence via coverage tooling.** Rejected: nothing in this ES5/userscript/Playwright stack
  offers it cheaply, and the title check is 20 lines.
- **Stash instead of commit before mutating.** Workable but rejected as policy: a commit is
  self-documenting, survives crashes, and the mutation results then cite a hash.

### Key properties
- Scope honestly recorded IN the check's comment: presence catches condition-skips, not
  throw-aborts (a throw rejects the evaluate and lands in the outer catch as `No runtime errors` —
  red, but without presence evidence; keep evaluates throw-free via guards + `{err}` returns).
- The companion lesson from the same arc: **a replacement for a vacuous check can be vacuous in a
  new shape** (section-count → parts-sum; segments>0 → segEndMax — both re-proven tautological by
  round 2). The only acceptance test for an assertion is naming the mutation that flips it red.
- Charset corollary, recorded here because it hid for a release: harness pages must declare UTF-8;
  without it every LITERAL non-ASCII character in the inlined userscript decodes as windows-1252,
  and only `\uXXXX` escapes survive — invisible until the first assertion compares one.

---

## DEC-038: The Summary Compute Cache — Lossless Identity Keys, Release Where the Key Dies, and Redundant-Defense Mutations (v12.4)
**Date:** 2026-07-31 | **Stage:** v12.4

### Decision
The Summary compute cache (`_sumComputeCache`, read ONLY by `getSummaryForExport`) is governed
by three invariants that generalize beyond this cache:

1. **Identity keys are lossless.** The key is `{ciIndexStamp(), provSig}` where `provSig` is
   the RAW text of every provisional turn, length-prefix framed (`len:text` — injective by
   construction). Every lossy alternative was tried and each produced a false-HIT class, found
   across three separate review rounds: a 200-char truncation cap (long prompts sharing an
   opening collide), case/whitespace folding + markdown flattening (`array[x]` vs `arrayx`
   collide), and a bare join delimiter (text containing the delimiter forges the set boundary:
   one provisional `a␁b` vs two provisionals `a`,`b`). A lossy identity key trades a HARMLESS
   false miss (one recompute) for a HARMFUL false hit (a frozen-stamp export serving the
   previous prompt's summary — the analyzers run on raw text, so texts that normalize equal
   still summarize differently). Normalizers are for MATCHING (DOM-vs-API comparison), never
   for identity.
2. **A cache is released at every point where its key dies.** The stamp dies at
   `ciInvalidate()` (conversation switch) and at `ciBuildIndex()`'s commit (same-conversation
   rebuild bumps the generation) — both now null the cache. A null-stamp computation
   (non-indexed platform, degraded session) is never cached at all: the read guard requires a
   non-null stamp, so the entry could never be read back and would just pin the conversation's
   text plus compute-time DOM nodes. An unreleased dead entry is not a cache, it is a leak
   with a lookup table attached. Verified live: the export's cache line read `cached=null`
   after a g2→g4 rebuild — the release observed directly.
3. **Adding a redundant defense re-derives every killing mutation.** After release-on-switch
   landed, the bare-key mutant (`if (_sumComputeCache) return ...`) was ABSORBED — the release
   had already emptied the cache before the gate could see a stale serve. The E3 delta gate's
   honest killing mutation is now the COMPOUND (bare key + release removed), measured red
   exactly there. When a fix adds a second line of defense, the mutation battery must be
   re-run and the named mutations updated, or the docs claim gates the harness cannot fail.

### Context
v12.4 fixed the measured Summary freeze (O(points²) dedup ahead of a ≤10 cap; the export
re-running the whole analysis). The dedup early-stop is output-identical by an append-only
prefix argument plus an empirical byte-diff. The cache eliminated the double-run: panel path
never reads it; export reuses only on exact key match. Five GitHub Codex rounds and an opus
Tier 3 round shaped the key and the release points; the identity-key ladder above is their
distilled result. Full arc: `reviews/review-2026-07-31-v12.4-perf.md`.

### Alternatives considered
- **Refuse reuse whenever provisionals exist** (my first fix for the membership-swap hole):
  correct but blunt — disables the cache for the most common flow (send → generate → export)
  and for up to 30 minutes under retained-degrade backoff. The skeptic's content-identity
  signature strictly dominates it. Rejected.
- **Key on the mounted-row set too** (entities/inventory derive differently for the ~3-5
  mounted rows): rejected — forfeits the cache on every scroll/jump for a ≤7%-of-messages
  derivation nuance, and a cache-hit export matches the open panel EXACTLY (same object),
  which v12.3's always-recompute could silently contradict. Accepted + documented instead.
- **Hash the provisional texts** instead of embedding them: rejected as unnecessary — the
  signature is compared, never stored beyond one entry, and raw text avoids hash-collision
  reasoning entirely at negligible size.

### Key properties
- The in-loop process lesson travels with this DEC: the S5 leg-order fix was documented in
  three docs before it was applied to the harness; only the post-commit mutant battery
  noticed (mutant C green → gap found → applied → red). DEC-037's failure class,
  self-inflicted mid-review. Run the battery against the COMMIT even when the fix
  "obviously" landed.
- Gates: E3 delta (+1 across the post-switch export; compound killing mutation), S5 reuse
  (delta-0, panel-provenance via regenerate-first leg order), S5 regenerate (+1). Recorded
  debt: same-conversation stamp-bump refusal and the provSig half are live-verified but
  unstaged in the harness (forced-refetch + provisional shim knobs, fixture batch).

---

## DEC-039: Sub-Segments Are Attached to the Final Segments, Not Rebuilt at Every Merge (v12.5)
**Date:** 2026-07-31 | **Stage:** v12.5

### Decision
`_sumBuildConversationMap` no longer computes a segment's `children` while it is building and
merging segments. Segments carry `children: null` throughout construction, and
`_sumAttachSubSegments` runs `_sumBuildSubSegments` ONCE per surviving segment at each of the
builder's two return points. Rebuilds per generate drop from `2 × initialSegments −
finalSegments` to `finalSegments` (live: **431 → ≤5**).

The change is output-identical by construction, not by argument-and-hope: `children` is a pure
function of a segment's `messages` array; no merge decision reads `children` (merges read
`topics`, `messages`, `entities` only); and a segment's `messages` array is never mutated after
the segment is built — every merge allocates a fresh `concat`. So the final segments' children
are computed from byte-identical inputs, one build later. Verified empirically across 32
config/engine combinations (below), not just reasoned.

### Context
v12.4 killed the Summary freeze but left a measured residual: generate 7.7–8.8s live, ~93% of
it in `phase.map`, with `_sumBuildSubSegments` called **431×** per generate (6.2–6.9s) and
`_sumExtractTopicsFromText` **3,895×** over 27.1M chars (TROUBLESHOOTING, live 2026-07-31).

The count itself identified the mechanism before any new live probe was needed. Children were
built at every commit and again at every merge, so `subSegments = commits + merges =
2 × initialSegments − finalSegments`. The harness confirmed that identity exactly at every
synthetic config (11 = 2·8−5; 369 = 2·187−5; 521 = 2·263−5), so the live 431 means the owner's
conversation produced **≈218 initial segments from ~294 messages** — near-total fragmentation,
where every merge re-derived sub-segments for a segment that was about to be merged again.

**Why the seeded payload had hidden this** (the fidelity finding, and the reason it is recorded
here): `_sumWordOverlap` divides the intersection by `max(|A|,|B|)`, so segmentation is driven
by DISTINCT VOCABULARY, not by text volume. The payload's ~115-word pool meant a long assistant
answer covered nearly every word a user message could draw, overlap stayed above the 0.15 split
threshold, and q=147 produced 8 segments where real prose produces ~218. `PARA_BOOST` — the
knob reached for when "bigger, more realistic" was wanted — was the wrong axis entirely.
`VOCAB_MULT` (perf-payload.js) is the right one, and `VOCAB_MULT=4, PARA_BOOST=3` reproduces
the live shape (263 segments / 521 rebuilds / 36.4M chars vs live 218 / 431 / 27.1M).

### Alternatives considered
- **Per-message token memoization** (the lever queued in the v12.4 handoff): rejected, and
  worth naming why — it would have made the throwaway work cheaper instead of removing it, and
  it carried a real correctness edge (`tokenize(join(a,b)) ≠ union` when an unterminated code
  fence spans a join, because the ``` stripping is applied to the joined string). Deferring
  needs no change to tokenization semantics at all. The edge case never had to be resolved.
- **Restructuring the merge loops** (the v13 option): unnecessary. The loops' own cost —
  `_sumTopicOverlap` over ≤6-term arrays, splices, concats — is negligible once they stop
  calling `_sumBuildSubSegments`; measured `mergeExcess` fell from 3,238ms to ~1ms at the
  live-calibrated config. Restructuring would have been a large change aimed at a small term.
- **Keeping children and merging them** (merge two children lists instead of rebuilding):
  rejected — a merged segment's sub-split is genuinely different from the concatenation of its
  parts' sub-splits (the scan window crosses the boundary), so this would have changed output.

### Key properties
- **Measured, Firefox 146, page realm, q=147 / PARA_BOOST=3 / VOCAB_MULT=4** (the config
  calibrated to live): map **7,803/7,585ms → 1,260/1,144ms**; rebuilds 521 → 5; topic
  extractions 4,998 → 727; characters tokenized 63.9M → 10.3M. Same machine, same payload,
  same engine, back to back. Chromium and every smaller config move the same way.
- **Equivalence gate:** `probes/run-map-harness.js --baseline` compares a structural
  fingerprint of every map — each segment's label, span, topics, entity count and message
  membership, AND the same membership for every child, because a sub-segment click resolves
  through `_sumFirstJumpable(child.messages)` (Codex: label+span+count alone would let a
  membership change through). 32/32
  identical, chromium + firefox, q ∈ {2,3,25,147} × PARA_BOOST ∈ {1,3} × VOCAB_MULT ∈ {1,4}.
- **Killing mutations, each measured red in the config that can see it:**
  (A) attach dropped from the main return → SUITE red (S1: 27 sub-segments → 0).
  (B) attach placed BEFORE `_sumMergeExcessSegments` → HARNESS red — but only at a config
  where `mergeExcess` actually merges. At q=25/VOCAB_MULT=4 the min-size pass already reduces
  to 5 segments, `mergeExcess` merges nothing, and mutant B is *equivalent*: it passed there.
  It dies at q=147/VOCAB_MULT=1 (8 → 5 segments). **A mutation battery is only as honest as
  the config it runs in** — the DEC-038 lesson (re-derive killing mutations) with a new axis:
  re-derive the *input* too, not only the code path.
  (C) the ≤6-message return path is structurally unfalsifiable: `timeline.length ≤ 6 < 12`, so
  `_sumBuildSubSegments` returns `[]` immediately there and the attach only normalizes `null`
  → `[]`. Stated rather than gated, because no fixture could ever tell the two apart.
- `children: null` (not `[]`) during construction is deliberate: a future reader that consults
  children mid-merge throws instead of silently seeing "no children".
- New test contract: `data-acn-role="sum-subsegment"` with `data-acn-sub-start` /
  `data-acn-sub-end`. Before it, nothing in the rendered panel revealed whether children had
  been attached at all — mutation A would have been an invisible regression.

---

## DEC-040: Sub-Segmentation Asks "Is This One of the Weakest Joints in THIS Segment?" — Relative Cohesion Valleys, Not a Similarity Threshold (v12.6)
**Date:** 2026-08-01 | **Stage:** v12.6

### Decision
The conversation map's second level places boundaries with a **lexical-cohesion valley** pass
(TextTiling-shaped), not with a similarity threshold:

1. Every message's vocabulary is tokenized **once**; block vocabularies are unions of those
   sets (O(N), and an unterminated code fence in one message cannot swallow the next one's
   words).
2. **Cohesion** is measured at every gap — how much vocabulary the **4**-message block before it
   shares with the 4 after (`BLOCK = 4`; the rationale and the derived minimum below both depend
   on this number, so it is stated once here and once in the code).
3. Each gap gets a **valley depth**: how far it sits below the nearest local peak on either
   side. Depth, not height, is what distinguishes a topic change from gradual drift, and it
   is why a brief aside no longer cuts a run — an aside dips and recovers, so its depth is small.
4. Cuts are taken **deepest-first** where depth reaches `max(MIN_DEPTH, 0.5 × the deepest
   valley in this segment)`, keeping runs at least 6 messages long.

The bar is a share of the **strongest signal present**, not a z-score. A mean+sd cutoff is
computed over a sample that *contains the very valleys it is meant to find*, and that breaks in
both directions — measured, both found in review:
- **too few values:** 7 gaps (a 12-message segment) cap the achievable standardized distance at
  `sqrt(6) ≈ 2.449`, so a 2.5·sd bar was mathematically unclearable and the split the entry
  condition advertised could never happen (GitHub Codex);
- **too many real boundaries:** ten disjoint runs give nine equally deep valleys, which inflate
  sd until the bar (2.175) sits *above the valleys themselves* (2.0) and every boundary goes
  undetected (found by the unit checks written for the first finding).

Sharing with the maximum has neither failure — it is indifferent to how many boundaries exist and
to how many gaps were sampled. `MIN_DEPTH = 0.15` then answers the separate question "is the
strongest candidate a real drop at all?", so a uniform conversation still yields nothing. It is an
absolute number, but on a **drop** measure (0…2) rather than a similarity **level**, which is what
made a similarity threshold untransferable between conversations.

Two further parameters, both measured rather than assumed: **BLOCK = 4** messages either side of a
gap (at 3, a single off-topic message contaminates every gap it touches and becomes a boundary on
its own; at 4 it is diluted while a real change still separates the blocks completely), and the
**entry condition is DERIVED** — `messages.length < 2 × max(BLOCK, MIN_RUN)` — rather than a
hardcoded 12. A gap is usable when it can be COMPUTED (`BLOCK ≤ p ≤ n − BLOCK`) and SELECTED
(`p ≥ MIN_RUN`, `n − p ≥ MIN_RUN`); those constraints OVERLAP rather than add. Writing the sum
instead — `2 × BLOCK + MIN_RUN` = 14 — silently excluded 12- and 13-message segments that split
perfectly well, replacing a hardcoded 12 that was accidentally right with a computed 14 that was
wrong (GitHub Codex round 3). **Deriving a bound only helps if the derivation is checked**; the
unit check now pins the true minimum at 12.

No absolute similarity constant survives into the decision. `_sumWordOverlap` is untouched —
key-point dedup and the top-level segmentation are calibrated to it.

### Context — why a threshold could not be fixed by choosing a better number
The shipped rule split when `_sumWordOverlap(message, window) < 0.42`, and that function
divides by `max(|A|,|B|)`: one message (~30 unique content words) against a four-message window
(~700) has a **ceiling near 0.04**. Every message split; the visible structure was the
absorb-fragments pass emitting fixed 3-message chunks. Live, that was dozens of near-identical
rows (`msgs 1–3`, `4–6`, `7–9`).

The first fix swapped the normalization (`min` instead of `max`, threshold 0.65) and was
**measured to be insufficient, which is the load-bearing part of this record**: how similar two
adjacent messages LOOK depends on how long they are and how wide the vocabulary is. The same
0.65 scored **7/8 boundaries on one payload and 2/8 on another**, differing only in message
length. A constant is therefore right for one conversation and wrong for the next — the owner's
objection ("you're just going with another number") was correct, and the numbers agreed with him.

Scored against the probe payload's known topic changes (`probes/perf-payload.js` emits them;
the harness reports found/spurious per build), summed over four payload shapes:

| build | true topic changes found (of 32) | spurious |
|---|---|---|
| pre-fix (`max`, 0.42) | 31/32 | **346** — it drew a boundary every 3 messages |
| containment threshold 0.65 + cap | 24/32 | 14 |
| **cohesion valleys, share-of-maximum** | **31/32** | **9** |

Note what the first row means: the broken build matched the new one on RECALL (31/32) — because
a rule that cuts every three messages hits everything by accident. It drew **346 boundaries that
were not topic changes**; the new rule draws 10. The decisive property, though, is not the totals
but that **one setting of the relative cutoff works across all four shapes**, while no single
similarity threshold did. On the config a constant
could not handle at all (short messages, wide vocabulary) this goes 2/8 → **8/8**.

### Alternatives considered
- **Containment threshold (`|A∩B| / min(|A|,|B|)` at 0.65) + count cap:** built, measured,
  superseded. Better than the shipped `max` rule (24/32 vs a brute-force 30/32-with-345-spurious)
  but it moved the constant rather than removing it, and it collapsed on the short-message
  regime. Kept in this record because the failure is the reason the current design exists.
- **Cap by merging the most similar adjacent PAIR** (the top level's rule): measured and
  rejected. A merged sub's topics are a six-term union, so it overlaps with everything, keeps
  winning the similarity contest and swallows its neighbours — one **221-message row beside six
  3-message rows**, recall 8/8 → 2/8. The retained cap merges the **smallest** sub instead,
  which cannot run away. **The top level still uses the most-similar-pair rule**, so the same
  dynamic is possible there in principle — but **that is theoretical, and an earlier claim of
  live evidence is RETRACTED (2026-08-02)**: the numbers cited as top-level segment sizes were
  the owner's report of sub-segment message RANGES (`msgs 8–10`, `20–22`, …), i.e. the 2–3
  message spans this decision fixes. The owner reports the top level as correct both before and
  after v12.6. Recorded in ROADMAP as theoretical; not scheduled.
- **A z-score cutoff on depth** (`mean + k·sd`), the classic TextTiling formulation: built,
  measured, and replaced. It scored well on the four scoring payloads but failed both edge shapes
  above, because the statistic it compares against is computed from the sample that includes the
  outliers. Kept in this record because the two failures are a general trap, not a quirk of this
  code: **when a rule flags outliers against a spread computed from the same data, the bar moves
  with the thing being measured.**
- **A purely absolute depth cutoff:** rejected — the floor alone would cut the deepest notch in a
  uniform conversation. It is a veto, not the decision.

### Key properties
- **"Merge into the most similar neighbour" runs away, and it took three rounds to see the whole
  shape.** Once a block absorbs two topics its merged topic list (a six-term union) overlaps with
  everything, so it wins the similarity contest on MERIT against every later run, not merely on
  ties — and it is never `smallest` itself, so nothing stops it. Simulating the loop on ten
  alternating six-message runs gives **[48, 6, 6]**; the tie-break-only fix from round 1 had
  handled the zero-overlap variant (**[54, 3, 3]**) and left this standing. The rule is now
  size-first, with similarity breaking size ties: merging a block makes it a LESS attractive
  target. The regression check needed uniform text WITHIN each run to be discriminating — with
  varied text the overlaps tie and the tie-break masks the defect, so a check written the obvious
  way passes under both rules.
- **The bar must be derived from the candidate set it is applied to.** `maxDepth` was first
  taken over every gap, including those the `MIN_RUN` filter discards — so an unselectable
  valley could veto every selectable one. Measured on a constructed case: an unrelated opening
  exchange put depth 1.000 at gap 4, raising the bar to 0.500 and suppressing a genuine interior
  boundary at 0.367, returning NO sub-segments (GitHub Codex round 2). Same shape as the two
  failures above — a statistic drawn from the wrong population.
- **Unit surface, added because neither edge case was reachable end to end:**
  `probes/check-subsegments.js` drives `_sumBuildSubSegments` directly through the map probe and
  checks the smallest accepted segment, one message below it, many disjoint runs, a uniform
  conversation, and a one-message aside. The map harness drives whole conversations, so segment
  shapes it never happens to produce are exactly where defects hid.
- **The count cap is not doing the work, and that was checked rather than assumed.** With the
  cap disabled the results are identical on three of four configs; on the fourth it removes two
  6-message fragments (spurious 4 → 2). It is a safety net, not the mechanism.
- Cost is unchanged in the shape that matters: tokenization is now **once per message** instead
  of once per comparison, so the cohesion pass is cheaper than the loop it replaces despite
  measuring every gap. v12.5's hot loop is untouched.
- **Scope, stated because a good score here is not a guarantee there:** the probe's topic blocks
  are lexically disjoint by construction. Real conversations drift, revisit and interleave. This
  validates the MECHANISM and the *relative* cutoff's transferability across text shapes; whether
  0.6/2.5/6 are right for a real conversation is a live judgement.
- **A fixture with no structure cannot gate a structure-finding feature.** The suite's
  virtualized fixture repeated one sentence 40 times, so a conversation with no topic changes
  could not distinguish a segmenter that correctly finds none from one that invents dozens —
  which is how fixed 3-message chunking survived v12.5's entire review. The indexed entry's
  fixture now carries three topic blocks (identical rule on the mock DOM and the API payload,
  so row-to-path matching stays byte-exact), the map recovers them exactly (`starts [0, 27, 55]`
  against true changes at 27 and 55), and S1b asserts those POSITIONS. The shipped defect is now
  measured red against it. Generalize this before adding the next content-derived feature: ask
  what the fixture would have to contain for the feature to be wrong in a visible way.
- **The class of defect worth remembering:** the original survived because a comment described
  behaviour the code did not have ("Detects genuine topic shifts… Purely content-driven — no
  count-based caps") and no gate could see it. Six Codex rounds and a full mutation battery on
  v12.5 asked only "does the map still produce what it produced before?" — equivalence to a
  defective baseline is still equivalence. It took a human reading the panel. **When a metric is
  introduced, ask what values it can actually take.**

---

## DEC-041: The Tokenizer Keeps English and Korean — Two Languages Named, Not "Unicode Support" (v12.7)
**Date:** 2026-08-02 | **Stage:** v12.7

### Decision
`_sumTokenize` keeps `a-z0-9`, Latin letters carrying diacritics (`À-ɏ`) and Hangul
syllables (`가-힣`), and its minimum token length is **2 for tokens containing Hangul,
3 for everything else**. Nothing else about the function changes.

Two things this deliberately is NOT:

- **Not a general Unicode fix.** Greek, Cyrillic, kana and Han are excluded on purpose. A
  character class only produces tokens; whitespace has to produce the *boundaries*. Japanese
  and Chinese are not space-separated, so widening the class for them turns a whole sentence
  into one or two pseudo-tokens — and a map fed pseudo-tokens draws structure out of noise
  rather than correctly finding none, which is **worse than the current empty result**.
  **Tense matters here and four documents got it wrong:** that is what WOULD happen if kana
  and Han were admitted. What SHIPS yields **zero** tokens for Japanese, because those
  scripts are outside the class entirely. `check-tokenizer.js` T8 asserts `=== 0` for that
  reason — its first form, `<= 4`, passed both on the shipped build (0) and on the very
  regression it exists to prevent (kana admitted → the space-less sample becomes 1 token).
  A bound on the wrong side of the thing it protects is not a gate (Tier 3, PR #70).
  Say which languages are fixed. `probes/check-tokenizer.js` T8 pins this limit as an
  assertion so it cannot quietly be re-described later.
- **Not a stemmer.** See the rejected alternatives.

Scope is the product's, not an abstraction: the userscript ships **English (default) and
Korean** (`I18N.ko`, added for one specific user). Diacritic Latin is in because *English*
contains it, not because another language is being added.

### Context — what was actually broken
Korean produced **zero tokens**, so every content-derived Summary feature was empty for a
Korean conversation: topics, key points, dedup, and both segmentation levels. The interface
around it was fully translated, which is what made it look like a working feature with nothing
to say rather than a broken one.

The same strip damaged English more than the roadmap recorded. `café` → `caf` was known;
measured, `naïve` and `déjà vu` **vanish entirely** (every fragment lands below the length
floor) and `résumé` → **`sum`** — not truncation but substitution by an unrelated real English
word, which then competes for a topic slot.

**The length filter was the half nobody had noticed.** `w.length > 2` is an English rule:
2-letter English words are function words. Korean's most common *content* words are exactly
two syllables — 인증, 세션, 토큰, 권한 — so fixing only the character class still discarded the
core vocabulary of the language (measured: 0 of 10 such nouns survived; 10 of 10 after).

### Alternatives considered
Five cumulative variants, each scored against the payload generator's KNOWN topic changes over
four payload shapes on both engines (`probes/build-tokenizer-variants.js`):

| build | found (of 32) | spurious |
|---|---|---|
| shipped, ASCII-only | 12 — *and only from incidental filenames/turn numbers* | 36 |
| + wider character class | 28 | 12 |
| **+ script-aware length (SHIPPED)** | **28** | **11** |
| + Korean stop-word list | 27 | 11 |
| + particle normalization + stop list | 30 | 10 |
| + particle normalization, no stop list | **31** | 13 |

> **RETRACTION.** An earlier version of this table reported particle normalization as
> *worse*, and the rejection was written on that basis. **That comparison was invalid**: the
> payload generator drew topic-block lengths from the same LCG as the text, and Korean
> sentences consume a different number of draws, so Korean was scored against a **different
> ground truth** than English — 9 boundaries in different places rather than 8 (GitHub Codex,
> PR #70). With the schedule made language-independent and every variant re-run, the ordering
> **reverses**: particle normalization leads on recall (31/32 vs 28/32).
>
> **The rejection is NOT supported by measurement and is no longer claimed to be.** v2 ships
> on grounds independent of the score — it keeps Korean in the segment-count regime English is
> calibrated and live-confirmed in (~278 initial segments vs ~22–85), and it adds no
> hand-maintained particle list that can merge distinct words. This metric has reversed three
> times, once per measurement defect corrected. The live check is the arbiter (DEC-031).

- **A Korean stop-word list:** built, measured, rejected. It made the score slightly *worse*
  (32→31 found, 7→8 spurious). Fifty hand-picked words that nobody can maintain and that
  bought nothing is strictly negative value.
- **Particle (josa) normalization — the interesting rejection.** Korean attaches particles
  directly to the noun, so one word appears as many strings (토큰이 / 토큰을 / 토큰은 / 토큰의).
  Stripping them worked exactly as intended on its own terms: six surface forms collapsed to
  one, and same-topic overlap went **0.227 → 0.450** while cross-topic stayed 0.000. It still
  scored **worse** at the job the tokenizer exists for.
  **Mechanism, because the counter-intuitive result is the point:** segmentation reads the
  CONTRAST between adjacent blocks, not absolute cohesion. Collapsing surface forms raises
  overlap *everywhere*, including between unrelated blocks that share ordinary words, so the
  valleys the segmenter cuts on get shallower relative to the floor. It also moved the initial
  segment count from ~278 to ~22 — putting Korean alone into a segment-count regime **nothing
  in this project has ever been calibrated in**, while the chosen fix leaves Korean in the
  same regime as English, which the owner has live-confirmed. Recorded rather than deleted:
  the next person to look at Korean quality will think of this first.

### Key properties
- **PURE-ASCII English is provably unchanged, and that is a measurement rather than an
  argument.** 32/32 map fingerprints byte-identical against an explicit pre-change ref, both
  engines, four sizes × two vocabularies × two paragraph scales. The reasoning that predicts
  it: a widened class can only *preserve* characters the old one dropped, and the length rule
  for non-Hangul tokens is `>= 3`, the same set as `> 2`. Both halves were checked.
  **Scope it precisely, because the unqualified claim is false:** English text containing
  accents DOES change — that is the `résumé` → `sum` corruption being fixed. And the map
  fingerprint covers segmentation, labels and topics only; global topics (`_sumExtractTopics`)
  and key-point dedup (`_sumDeduplicatePoints` via `_sumWordOverlap`) sit outside it. They
  read the same token stream, so the construction argument covers them — but the fingerprint
  alone does not, and saying it does would overstate the evidence.
- **A single configuration is not a measurement — demonstrated twice in this arc.** Particle
  normalization scored 9/9 against 8/9 for the chosen fix at ONE configuration, and was
  ahead on every intuition available (higher overlap, cleaner tokens, 10× fewer initial
  segments, better-looking labels). Across four payload shapes it lost. The conclusion
  reversed twice before the full matrix existed. This is the same trap DEC-040 recorded from
  the other side.
- **A fixture that can fail.** The suite had no non-English entry, so nothing in CI could see
  a tokenizer that returned `[]` for an entire language — the same "structurally cannot fail"
  shape that let fixed 3-message chunking survive v12.5's whole review (DEC-040). The new
  `Claude (Korean conversation + index)` fixture asserts that topics contain **Hangul**, not
  merely that topics exist: the fixture also contains ASCII turn numbers, and a tokenizer
  that picked up only those would produce a non-empty list made entirely of noise. It asserts
  sub-segment starts at `[0, 27, 55]` — the same positions, from the same rule, as the
  English fixture — so it gates segmentation QUALITY in Korean rather than mere presence.
- **The base text had to change, not just the topic sentence.** A Korean fixture built on the
  English base text ("Question number N: how do I handle…") would still hand the old
  tokenizer English tokens in every message and could not have gone red.
- **The kept Latin range is three sub-ranges, not one, and that is load-bearing.**
  `\u00c0-\u024f` looks like "Latin letters with diacritics" and very nearly is — but
  `\u00d7` (MULTIPLICATION SIGN) and `\u00f7` (DIVISION SIGN) sit inside it and are the only
  two non-letters there. Written as one span they are KEPT, and because the old ASCII-only
  class replaced them with a space, keeping them silently **glues tokens that used to
  split**: `1920x1080` written with a real multiplication sign tokenized as ONE token
  instead of two, and `3x4` became a token where there had been none. Found in Tier 3
  review before merge, by asking what the range actually CONTAINS rather than what it is
  named for — the shipped class is `\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f`.
  `probes/check-tokenizer.js` T9 gates it, and gates the SPLIT rather than the absence of
  the characters: a build that dropped the whole run would also produce no `x`, and would
  pass a weaker check. A future "simplification" back to one span reintroduces the defect,
  which is exactly why the check exists.
- **The same assumption was written down three times, and fixing one was not enough.**
  `_sumExtractTopicsFromText` and `_sumExtractTopics` each re-tested the English length rule
  (`< 3` / `> 2`) on words `_sumTokenize` had already filtered. For English those were exact
  no-ops; for Korean they discarded the 2-syllable words the tokenizer had just correctly
  kept, so no such noun could be a topic **at any frequency** — measured, a term occurring 8
  times, more often than any bigram in the same text, was still absent, and ranks first once
  the re-check is gone. Both are removed. **Stated with its real scope:** bigrams are weighted
  2x and cover their own words, so they outrank unigrams in both languages; this makes a
  frequent short word *eligible*, it does not change the ranking. The 32/32 identical map
  fingerprints are the empirical proof that the removal is a no-op for English.
- **The gate that could not see the fix, and why it is gated in the probes instead.** Two
  mutants of the shipped build pass the Korean Playwright fixture **31/31**: the widened class
  with the English `w.length > 2` filter restored (i.e. `v1-charclass`, the rejected variant),
  and both downstream re-checks restored (byte-identical topic list). All eight rendered topics
  are bigrams of the fixture's constant base sentence, which repeats 40 times and outranks
  everything from the topic blocks — so nothing depending on 2-syllable nouns reaches an
  assertion. Distorting the fixture until a unigram could outrank a 40x bigram would make it
  stop resembling a conversation, so the properties are gated where they can be gated directly:
  `check-tokenizer.js` **T4** (the tokenizer keeps them) and **T12** (they reach the topic
  list) — and **the probes now run in CI**, which they never did before. Found by Tier 3 lens 3
  (PR #70) with both mutants built and measured; ten GitHub Codex rounds did not surface it.
- **Two defects that only v12.7 made reachable, both found in the same round:**
  `cap()` in `_sumGenerateSegmentLabel` upper-cased on `/\b\w/`, which is ASCII-only, so a
  diacritic opened a spurious word boundary and every accented label came out mangled —
  `naïve` → `NaïVe`, `résumé` → `RéSumé`. Before this release those tokens could not exist.
  It now splits on whitespace, which has no character-class opinion. And the topic frequency
  maps were plain objects, so the word **`constructor`** — which users of an AI *coding*
  assistant type constantly — read `Object.prototype.constructor`, concatenated onto a
  function, and made the sort comparator return `NaN` for every pair involving it, leaving the
  order of the WHOLE topic list implementation-defined. `Object.create(null)` on all five maps.
  Pre-existing, but the first is newly *triggered* by widening the class.
- **Not fixed, and not silently:** key points are still unavailable in Korean, because
  `KEY_POINT_PATTERNS` is a set of English regexes — a different mechanism, recorded in
  ROADMAP rather than folded in here.
- **Sub-segment labels in Korean carry particle-attached forms** (세션이 rather than 세션),
  because the tokens feeding label generation are the matching tokens. A display-only
  normalizer would fix the reading without touching any measure; it is deliberately not
  bundled, and the live check is the right instrument for deciding whether it is wanted.

---

## DEC-042: A Translation That Is Never Called Is Not a Translation — Wire the Panel, and Template What Cannot Be Concatenated (v12.7a)
**Date:** 2026-08-02 | **Stage:** v12.7a

### Decision
The Tools and Plan usage panels call `i18n()` for every user-visible string. Reset phrases in the
Plan usage panel use `{placeholder}` templates through `i18n(key, replacements)` rather than
string concatenation. The `/Commands` section stays in **English**, by owner instruction.

### Context — the defect was not missing translations
The owner live-tested v12.7 with the interface set to Korean and reported the Tools panel still
entirely English. The cause was not a gap in `I18N.ko`: **thirteen Korean strings already existed
there and not one was ever read.** `buildToolsPanel` and `renderUsageBars` rendered English
literals unconditionally. Someone had written the translations and never connected them, and
nothing detected it — a dead key is invisible to the suite, to the type system (there isn't one)
and to review, because the code and the table are both individually correct.

Only one word had to be authored: `exports` → **파일 내보내기**, supplied by the owner.

### Why templating, not concatenation — the load-bearing part
The reset phrase was built as:

```js
'resets ' + dayName + ' ' + hr12 + ':' + minStr + ' ' + ampm
```

Korean places the meridiem **before** the time — 오후 3:05, not 3:05 오후. **No reordering of
concatenated fragments can produce correct Korean**, because the concatenation order is fixed in
the code and the correct order differs per language. The strings became templates
(`'{day} {ampm} {time} 초기화'`) fed through `i18n(key, replacements)` — a capability the helper
has had since it was written and which had exactly one prior user (`searchResults: '{count} matches'`).

**Generalise this before adding the next user-facing string:** any sentence assembled from more
than one variable is a translation defect waiting to happen. Word ORDER is part of what a
translation changes, and concatenation hard-codes it.

### Alternatives considered
- **Translate `/Commands`:** rejected by the owner, and the reasoning generalises — "slash
  command" functions as its own noun in Korean developer usage, and a translated form would be
  *less* recognisable than the English. **The owner later stated this as a standing position**
  rather than a one-off call, having reviewed Korean mode live: *"some things are actually better
  to stay in english than force translation to korean when they can understand some english… i am
  fine with how the korean mode looks."* Consequence for future work: an unwired i18n key is a
  QUESTION (does Korean help this label?), not a defect. ROADMAP 0c is a review list on that
  basis, and driving the dead-key audit to zero is explicitly not the goal.
- **Rebuild the Tools panel on language switch:** rejected. The product's contract is
  "refresh to apply" and the toast says so; the switch handler deliberately updates only dot
  labels and panel headers. Accepted consequence, owner-confirmed: switching language without
  reloading leaves Tools mixed — the gallery header re-renders on panel open, the exports section
  is built at injection and does not. The owner's words: *"that is a limitation i am willing to
  accept since we already warn about it anyway."*
- **Leave the English descriptions as the inline literals:** rejected. Three `|| 'fallback'`
  branches were unreachable (the `||` fires only when a key is ABSENT, and these keys exist) AND
  disagreed with the table value that actually renders, so the code claimed the old English was
  preserved when it was not.

### Key properties
- **English is byte-identical, measured rather than argued.** `formatResetTime` was extracted from
  both the pre-change and post-change builds and run over **58 cases** — every minute-bucket
  boundary (-5, 0, 1, 17, 59, 60, 61, 90, 180, 1439, 1440, …) and every weekday × hour combination
  reaching the date branch. **0 differences.**
- **The audit that found the rest:** `grep -c "i18n('<key>'"` over every key in the `en` table.
  Thirteen scored zero. That one-line check is worth running whenever a key is added — a key with
  no call site is a translation that does not exist.
- **Key parity is now 78/78** between `en` and `ko`. Thirteen keys were added and one removed:
  `session` was superseded by `usageSession` (which carries the duration, so the Korean reads
  세션 (5시간) rather than mixing an English unit into it) and was left with no call site by this
  very change — leaving it would have reproduced the defect this decision exists to fix.
- **A typo the wiring exposed:** the footer read 더 많은 도구가 **곳** 추가됩니다 — 곳 is "place";
  it should be 곧, "soon". It had been in the table, unrendered, since the string was written.

---

## DEC-043: Documentation Names Its Members Instead of Counting Them — and a Review Loop Needs a Pre-Committed Stopping Criterion (PR #72)
**Date:** 2026-08-03 | **Stage:** post-v12.7a, docs only

### Decision
Coverage claims in project documentation **name the specific surfaces involved** rather than
stating a ratio. Tallies are permitted in exactly one place — `agent_docs/conventions.md`'s dead-key
audit baseline — because there the number is load-bearing (it lets a later run distinguish a
regression from the known state) and every member of every group is named alongside it.

Separately: when a review loop is run to convergence, the criterion for stopping is
**written down before the round runs**, not judged after seeing the findings.

### Context — ten findings, and a perfectly clean split
PR #72 began as a small reframing: the owner had reviewed Korean mode live and accepted partial
English, so ROADMAP 0c had to stop reading as a defect list. Four GitHub Codex rounds produced ten
findings. The split by *kind of claim* was total:

| Claim type | Outcome |
|---|---|
| **Qualitative** — "a dead key is a question, not a defect"; "these two are missing behaviour, not preferences"; "two docs assert incompatible failure contracts" | **Every one survived** four adversarial rounds untouched |
| **Quantified** — "13 of 14" keys, "21 of 31" toasts, "9 vs 5" tooltips, "~5 questionPrefix sites", "everything else applies after a refresh" | **Every one was wrong**, most of them twice |

By provenance, all ten were errors introduced *by this PR*; none existed on `main`. That is normally
the signal to stop immediately (DEC-029). The reason it was not read that way for two further rounds
is recorded below.

### Why the tallies failed — three distinct mechanisms, none of them carelessness
1. **A `title:` key is not a tooltip.** The tooltip audit matched `\btitle:\s*` and swept in the
   `PLATFORMS` registry's platform *display names*. Caught, corrected — and then the corrected line
   made the **same error again** with the `TOOLS_EXPORT` data objects, whose `title:` fields are
   visible labels rendered via `textContent`. The second instance was written inside the sentence
   documenting the first.
2. **A length-capped regex corrupts the DENOMINATOR, not the numerator.** The toast count
   ("21 of 31") capped each call site at 120 characters, so a multi-line conditional fell out of the
   *population* entirely — classified as neither literal nor `i18n`. The total was wrong, which is
   far harder to notice than a misclassification: the parts still looked self-consistent.
3. **Arithmetic that double-counts a category.** "Thirteen of the fourteen unwired keys are a
   per-string judgement" applied the owner's acceptance to all fourteen, then excluded two, without
   lowering the total. The correct breakdown is 9 (`/Commands`) + 3 (preference) + 2 (missing
   behaviour).

### Why naming beats counting
**A named surface can be checked against the code in one grep. A tally can only be re-derived.**
And a stale tally is worse than no tally, because it reads as authoritative while being wrong —
it is precisely the shape that survives review, since a reviewer must reconstruct the whole
measurement to falsify it. Every number in this PR was also a future staleness bug: correct on the
day it was written, wrong the next time anyone touched a string.

This is the same family as the three v12.6 defects (see the statistic-over-the-wrong-population
note in the v12.6 record) and the measurement-context rule in `CLAUDE.md`. The new part is the
**remedy**: do not compute the statistic more carefully — stop putting it in the document.

What the docs record instead is the **audit traps**, which are what actually cost the time: match
only real DOM attributes when counting tooltips; beware a length cap silently shrinking the
population; verify the parts sum to the total before trusting either.

### The stopping criterion — and why it was needed
DEC-029 says end a loop on finding *provenance*: once most findings are the loop's own fixes, stop.
By round 2 that condition was already met and the loop still ran twice more. The failure was that
"is this still converging?" was being judged **after** each round, against evidence that always
admitted an optimistic reading ("yes, but these are smaller than last time").

The fix was to write the criterion down first: *one more round; if it returns any new finding in
prose I wrote, stop regardless of how small it is.* Round 4 returned three, including mechanism (1)
above — and the pre-commitment made that unarguable, where a post-hoc judgement would have found
"but they're only P3 recounts" available again.

**Generalise:** a stopping rule evaluated after seeing the results is not a stopping rule. This
matches the project's existing preference for pre-committed criteria and for discrete metrics over
continuous ones near a threshold.

### Alternatives considered
- **Correct the counts a fifth time.** Rejected on evidence: four rounds, four different tallies,
  every one wrong at least once. The demonstrated failure rate was ~100%, and each fix was itself a
  new hand-written number with the same exposure.
- **Keep the counts but add "verified <date>" stamps.** Rejected — the numbers were already dated.
  Dating a wrong number does not make it right, and dating a right number does not stop it going
  stale; it only shifts the reader's burden from "is this true?" to "is this current?", which they
  cannot answer without recounting anyway.
- **Drop the coverage section entirely.** Rejected — the qualitative content was the part that
  survived review, and it is genuinely useful: a maintainer needs to know that `Clear all bookmarks`
  and the bookmark tooltips are hardcoded. Only the arithmetic was load-free.

### Also settled by this PR
- **`usageUnavailable` is a BUG, not a translation preference** — a failed usage fetch left
  the panel reading "Plan usage loading…" indefinitely, in both languages, because
  `fetchClaudeUsage` hands `null` to `renderUsageBars` and its `!data` branch rendered
  `planUsageLoading`. **The remedy was an owner decision**: `docs/PLAN-USAGE.md` specified rendering
  nothing on failure, while the existence of the `usageUnavailable` string implied a message was
  intended. The repo asserted *both*; this PR recorded the choice as open.
  **Resolved in v12.8 — the owner chose explicit. See DEC-044.**
- **`summaryLanguageNote` needs an owner decision, not wiring** — empty English value, Korean-only
  disclaimer, never rendered, and v12.7 made its text substantially untrue.
- **A dead key is not automatically a preference.** Check whether the surface behaves correctly
  without it before filing it as one. Two of the fourteen did not.

---

## DEC-044: A Failed Usage Fetch Says So — Explicit Over Silent, and Two States That Looked Like One (v12.8)
**Date:** 2026-08-05 | **Stage:** v12.8

### Decision
When the Claude usage request fails, the panel renders **`usageUnavailable`** ("Usage data
unavailable" / "사용량 데이터를 불러올 수 없습니다"). It does not keep saying "loading", and it
does not vanish silently. The owner chose **explicit** over silent.

### Context — the bug was a conflated null, not a missing string
`renderUsageBars` received `null` for two unrelated reasons — *no fetch has finished yet* and
*a fetch finished and produced nothing* — and rendered `planUsageLoading` for both. The first
resolves on its own; the second never does. So a failed usage request left the panel reading
**"Plan usage loading…" forever, in both languages**, telling the user to keep waiting for
something that was never coming.

`usageUnavailable` had existed in both string tables, with a Korean translation someone had
deliberately written, and **had no call site**. The v12.7a audit found it and filed it with the
other dead keys as a translation preference. That classification was wrong, and the correction is
the transferable part: **a preference presupposes something rendering to have a preference
about.** Nothing rendered here in either language, so there was no English surface for the owner
to prefer — it was a missing failure state wearing a translation costume.

### Why explicit, and why it needed the owner
The repo asserted **both** answers. `docs/PLAN-USAGE.md` §"Fetch fails" specified rendering
nothing at all ("no error messages; usage display is informational, not critical"), while the
existence of `usageUnavailable` in both tables implied someone intended a message. Those are
mutually exclusive, so an implementer could satisfy neither doc. The **bug** held under either
design — a panel must not report an in-flight fetch that has already failed — but the **remedy**
was a product call, so it was put to the owner rather than picked silently.

Chosen: explicit. A Korean translation had already been written for this exact string, and a
usage section that simply empties gives the user no way to tell "you have no limits" from
"we could not ask". `docs/PLAN-USAGE.md` was rewritten to match, with the superseded wording
preserved rather than deleted.

### Two ordering rules that are load-bearing, both from Tier 3 review
- **Clear the flag BEFORE calling `fetchClaudeUsage`.** The missing-`GM_xmlhttpRequest` path
  invokes its callback **synchronously**; clearing afterwards would erase the failure the
  callback had just recorded.
- **Each request carries a generation token** (`_usageReqSeq`), and supersession is
  **ASYMMETRIC**. The stale-response guard inside `fetchClaudeUsage` keys on the *org uuid*,
  which cannot separate two overlapping requests for the **same** org — and `ciInvalidate()`
  zeroes the usage cooldown while a request may still be pending, which makes that reachable.
  Without the token a slow failure landing after a fast success erases good data; that also
  fixes the **pre-existing** half of the race, which applied to `_usageData` before this change.
  **But dropping every superseded response was too aggressive** (Codex, PR #73): switch chats
  while the first fetch is in flight and let the second one hang or fail, and a perfectly good
  older success was discarded while the panel showed "unavailable". The rule that holds is that
  a late response's **emptiness** is stale and its **content** is not — usage is org-scoped and
  all these requests are same-org. So a superseded EMPTY response is dropped, a superseded
  response CARRYING DATA is used when nothing newer produced any, and dropped when it did.
  **"Newer data already landed" is measured by GENERATION (`_usageDataSeq`), not by whether
  `_usageData` is non-empty** — a third correction, from the same review. `ciInvalidate()`
  zeroes the cooldown but leaves `_usageData` populated, so for a multi-org user the surviving
  value can be a PREVIOUS org's bars; keying off truthiness discarded a valid new-org response
  and left the wrong org's quota on screen.
  **All three wrong forms are gated, each by a distinct check:** no guard fails U8, the
  drop-everything form fails U9, the truthiness form fails U10.
- **Setting a flag is not repainting.** `orbPopulateNavigate` early-returns on an unchanged
  question-list fingerprint *before* it reaches `maybeRefreshUsage`, so on a settled page nothing
  would redraw and a retry would keep showing "unavailable" while a request was genuinely in
  flight. The fix repaints at fetch start — but **only when a placeholder is already up**:
  replacing real bars with "loading…" on every five-minute poll would be a worse lie than the
  one this change exists to fix.

### Alternatives considered
- **Silent (render nothing on failure).** The spec's original answer, and defensible: usage is
  informational. Rejected by the owner. It would also have meant deleting `usageUnavailable`
  from both tables, discarding an existing Korean translation.
- **Keep the bars and overlay a warning.** More informative, but the data is a quota that may be
  minutes stale, and presenting stale numbers as current is the same class of lie.
- **Leave it and document it.** What the previous session did. Correct at the time — it is a code
  change on a network path, so it needed a version bump and a live confirm — but it left a
  user-visible defect shipped.

### Verification
`probes/check-usage-state.js`, 8 checks, wired into CI (ubuntu+chromium). It drives the real UI
by opening the Navigate panel and reading the DOM — no instrumentation hook.

**Every claim was mutation-tested against a build with that specific fix removed**, because a
check that cannot fail is not a gate:

| Build | Result |
|---|---|
| Pre-fix | 6 of 8 fail |
| Fix minus generation token | U8 fails — `bars=0`, late failure erased a newer success |
| Fix minus repaint | **all pass — this fix is NOT gated** |
| Fixed | all 8 pass |

**The repaint is retained on a reading, not a test, and that is stated rather than glossed.**
`orbPopulateNavigate`'s early return at `:5800` demonstrably precedes its `maybeRefreshUsage()`
call, so the defect is real; but no check fails without the fix. A draft of this record claimed
U7 gated it, on the strength of a run where the no-repaint mutant did fail U7 — U7 was racy at
the time and its race produced the *same symptom as the mutant*. With the race fixed, the mutant
passes. Both results are kept, per the rule that a contradiction between two measurements is
itself the finding.

Suite 1120/1120 both engines. **Still owed: a live confirm (DEC-031)** — no mock reproduces a
real 5xx from claude.ai, and the standing rule is that a green suite is a context-scoped finding.

### What this cost, recorded because it is the reusable part
The probe's first two drafts were both **fixed sleeps sampling a transient state** — the panel
re-renders on MutationObserver cycles, so the same scenario passed one run and failed the next
with nothing changed. Replaced by a stable-read loop that requires two agreeing consecutive
reads, with an explicit `stable` marker every assertion must satisfy. Then U8's first version
route-changed while initialisation was still running and issued **no second request at all**,
reporting `requests=0` — which reads as a failure of the code under test rather than of the
scenario. Both are the same lesson the project already has: *a single run is not a measurement*,
and **check that the fixture did the thing before believing what it says about the code.**
