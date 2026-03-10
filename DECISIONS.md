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
