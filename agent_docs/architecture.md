# Architecture

## Directory Structure

```
├── ai-conversation-navigator.user.js   # Main userscript (single deployable file)
├── package.json                        # Node metadata + test scripts
├── agent_docs/                         # AI assistant documentation (progressive disclosure)
├── modules/                            # Modular feature groups (reference/future integration)
│   ├── groupA-hover-zone.js            # Hover zone hitzone geometry
│   ├── groupB-context-tracking.js      # SSE interception, token counting
│   ├── groupC-settings.js              # Settings panel, language selection
│   ├── groupD-bookmarks-search.js      # Bookmarks, search, filtering
│   ├── groupE1-summary.js              # Summary panel, conversation analysis
│   └── groupE2-tools-gallery.js        # Tools, image gallery, exports, commands
├── tests/
│   ├── test-all-platforms.js           # Playwright test suite
│   ├── run-tests.sh                    # Convenience shell wrapper
│   └── mock-pages/                     # 14 mock HTML files matching real platform DOMs
├── docs/                               # Feature specs, design docs, agent plans
├── assets/                             # Demo GIFs for README
├── .github/workflows/                  # CI: cross-platform tests, Claude Code integration
├── CHANGELOG.md                        # Detailed version history
├── DECISIONS.md                        # Architectural decision log
├── TESTING.md                          # Comprehensive testing guide
├── TROUBLESHOOTING.md                  # Platform-specific diagnostics
├── DOM-REFERENCE.md                    # Real DOM structures for all 14 platforms
└── ROADMAP.md                          # Future directions
```

## Userscript Structure

The main file is organized into logical phases within a single IIFE:

1. **Initialization (~lines 1-250):** Duplicate guard, i18n strings, settings, version constant
2. **Platform Registry (~lines 251-950):** `PLATFORMS` object with 14 entries, each defining hostname matching, selectors, theme colors, and message extraction functions
3. **Conversation Index (~lines 1100-1600):** `ci*` functions — API-backed message enumeration for Claude (see below)
4. **Orbital UI System (~lines 1600-5600):** Zone construction, panel builders (Navigate, Search, Bookmarks, Summary, Tools, Settings), rendering modes
5. **Helpers & Utilities (~lines 5600+):** Scroll handling, SSE interception, context estimation, bookmark persistence

## Conversation Index (v12.0)

**Read this before touching anything that enumerates messages.**

Claude virtualizes its message list with recycling — only ~3–5 user turns are mounted at any moment, so `document.querySelectorAll()` sees roughly 3% of a long conversation. `_questions` on `claude.ai/chat/<uuid>` is therefore populated from Claude's own conversation JSON, not from the DOM. See DEC-021 (the index) and DEC-022 (Layer 4: State Breaks).

**Claude is not the only virtualized platform — Emergent recycles too** (Virtuoso), and is handled entirely in the DOM: sweep the scroller on panel open, accumulate, re-resolve stale references at click time. Two virtualized platforms, two completely different strategies, because a full sweep is viable on Emergent's short sessions and is not on a 147-turn Claude conversation. **Beware the `virtualScroll` platform flag: it selects the Emergent DOM mitigation, not the platform property, so `claude` is `virtualScroll: false`.** The `DOM-REFERENCE.md` table is the record of which platforms virtualize.

**The remaining twelve are "not observed", not "verified absent", and that is a fact with a date on it.** Virtualization is the standard fix for a slow chat page; Claude's own answer flipped between February and July 2026 with no announcement, no error, and a green test suite. Treat "platform X is not virtualized" as *unverified* rather than *verified false* — per-platform status and the two-command check are in `DOM-REFERENCE.md` → "Virtualization status".

If one of the other 13 flips, do **not** start from selectors. The order of operations, what is already generic (resolve-on-arrival, identity-keyed bookmarks, the degraded-state UI) and what has to be built per platform (the fetch, the auth, the payload walk) is in `ROADMAP.md` → "Porting the Layer 4 response to another platform". The reasoning behind the whole architecture — why a repair was impossible and why it took two releases — is in `TROUBLESHOOTING.md` → "Why v12.0 and v12.1 Exist".

**The single most transferable rule: a held element reference is not an identity.** On a recycling platform the browser reuses that node for a different message, so cached references fail by scrolling confidently to the wrong content rather than by throwing.

| Function | Role |
|---|---|
| `ciIsClaudeChat()` | Guard — true only on `claude.ai/chat/<uuid>` |
| `ciLoadIndex(force, done)` | Resolves org, fetches, builds. Idempotent; `_ciInFlight` blocks concurrency |
| `ciResolveActivePath(data)` | Walks `current_leaf_message_uuid` → root, excluding abandoned branches |
| `ciExtractText(msg)` | `content[]` text blocks → attachment `extracted_content` → file names |
| `ciIsReady()` | **Check this before reading the index.** False on other platforms and while degraded |
| `ciUuidForText(text)` | Normalized text → stable message uuid (used by bookmarks) |
| `ciFindScrollContainer()` | Shared, class-name-free scroll-container locator |
| `ciTotalChars()` / `ciTotalThinkingChars()` | Whole-conversation counts for context tracking |

State lives in `_ci*` module variables. `_ciIndex` holds human turns; `_ciFullPath` holds the full ordered path (human + assistant) and is what Export reads.

### Jump-to-message (Phase 3)

Clicking a question must reach messages that are not in the DOM. `ciJumpToFullPathIndex()`
scrolls, waits for the virtualizer to remount, reads which rows landed, and interpolates
again from that real anchor.

| Function | Role |
|---|---|
| `ciJumpToFullPathIndex(idx, done)` | the settle loop; `done(ok, element)` |
| `ciMountedRows()` | mounted rows as `{dataIndex, el, isUser}` — reads the virtualizer's own `data-index` |
| `ciDeriveRowOffset()` | `data-index → _ciFullPath` offset, re-derived per jump from EVERY mounted user row; `null` on disagreement |
| `ciDataIndexToFullPath()` / `ciFullPathToDataIndex()` | named conversions; **return `null` rather than guessing** |
| `ciSelectCluster()` | contiguous runs, chosen by REAL GEOMETRY against the scroll offset — no index-based tail exclusion |
| `ciWaitForSettle()` | waits for the SELECTED CLUSTER to stabilise (not the whole set); rAF poll + timer escape hatch + single-fire latch |
| `ciFindScrollContainerStable()` | `[data-autoscroll-container="true"]`, computed-style walk-up as fallback |
| `orbSetJumpBusy()` / `orbSetJumpBusyFor(token, busy)` | visible progress. **The jump owns its own busy state** — callers must not set or clear it |
| `ciFeedRoot()` | the message-feed root; **every** row query must be scoped to it |
| `ciVerifyLandedRow()` | maps the row back through the offset AND compares text before success |
| `_normalizeCompare()` | markdown-insensitive comparison (API returns raw markdown, DOM holds rendered text) |
| `_textAsLegacy()` | reproduces v11.8's exact bookmark-hash input (our glyph removed, sr-only kept) |

Constants are measured, not guessed: `CI_JUMP_SETTLE_CAP_MS` 800 (median settle 309 ms,
max 668), `CI_JUMP_TOLERANCE_ROWS` 5 (window is 3–10 rows), `CI_JUMP_MAX_ITERATIONS` 8.
There is deliberately no pinned-tail constant: the extra cluster is not a stable size
(one probe run showed none at all, another showed one at every sample).

**Invariants specific to the loop:**

- **Never hardcode the offset.** `+1` was measured once from a single row. Derive it per
  jump; refuse to convert when mounted rows disagree.
- **Re-read `scrollHeight` every iteration.** It drifts 3.2% as rows are measured, so a
  cached absolute pixel offset goes stale by ~9–10 messages.
- **Exclude the pinned tail from landing detection.** The last ~3 rows are mounted at every
  scroll position; plain set membership gives false hits for tail indices from anywhere.
- **Reposition ONLY — never dispatch a synthetic scroll event** (DEC-024). Dispatching
  causes a reproducible ~6-row overshoot. Read *actual* `scrollTop` after every move; the
  landed position is a constant −360 px off the requested one.
- **There is no pin-interference to defend against.** Do not add an abort for it.
- **Verify the landed row before reporting success.** `ciVerifyLandedRow` maps the row
  index back through the offset and compares text. The offset agreement check proves the
  offset only *locally* — all its samples come from one mount window.
- **Guard `document.visibilityState`.** A hidden tab throttles rAF and the virtualizer
  stops entirely, so the loop cannot converge. `requestAnimationFrame` polling needs a
  timer escape hatch for the same reason.
- **User input always wins.** Abort on a trusted scroll/wheel/key event; never fight the user.
- **Non-virtualized platforms short-circuit** to plain `scrollIntoView`.
- **Scope every `[data-index]` query to `ciFeedRoot()`.** That attribute is not unique to
  Claude's feed; a foreign row fragments a real contiguous cluster and its geometry is
  converted against the wrong container.
- **"Nothing to compare" must FAIL verification, never pass.** The index-mapping half of
  `ciVerifyLandedRow` is a tautology by construction — the text compare is the only real
  check, so an empty expectation would accept any row.
- **Compare with `_normalizeCompare`, not `_normalizeKey`,** anywhere API text meets DOM
  text. The API returns raw markdown; the DOM holds rendered text. Plain normalization
  makes assistant messages never match, which silently degrades their bookmarks and makes
  assistant-target jumps unverifiable.
- **The jump owns the busy flag.** A caller clearing it from its completion callback reads
  whichever jump wrote last, so a superseded jump clears a live one's flag — or, with two
  sequential jumps, nobody clears it and the panel stays locked.
- **`done(ok, el, reason)`** — `reason` is `'superseded'` or `'user'` for aborts. Callers
  must not show a failure toast for those: the user either started another jump or scrolled
  deliberately.
- **Use a `NodeFilter` returning `FILTER_REJECT` to skip subtrees.** `walker.nextSibling()`
  returns null *without moving currentNode* when the rejected element is the last child, so
  the `nextNode()` fallback descends straight back into it. Source-parsed mocks hide this
  because HTML indentation leaves whitespace text nodes; React-rendered DOM does not.

### Text extraction

`_cleanText()` is the single path for reading message text. It removes our own injected
bookmark icon (`[data-acn-bookmark]`) and the platform's `.sr-only` labels — ChatGPT's
"You said:", Claude's "Claude responded:" and "Load earlier messages". Both leaked into
`textContent` and both caused real defects: the icon broke index↔DOM matching for short
messages, and the sr-only labels reached Search, Export and exported markdown.

`_readMessageText()` (user) and `_readAIText()` (assistant) both route through it. There is
no longer a `"You said:"` regex — a regex cannot distinguish the platform's label from a
user message that begins with those words.

### Invariants

- **Never delete the DOM scanner.** It is the fallback and the only path for the other 13 platforms.
- **`q.element` may be `null`** — any question outside the mounted window has no DOM node. Use `_relocateQuestionElement(q)`; if it returns null, fail *visibly*.
- **Never order messages with `compareDocumentPosition` across unmounted nodes.** Detached nodes return `DOCUMENT_POSITION_DISCONNECTED`, matching neither FOLLOWING nor PRECEDING, so the comparator returns 0 and the sort silently degrades to arbitrary order.
- **Never key persisted data to a DOM index.** Use the message uuid (bookmarks schema 2).
- **Degradation must be visible.** `orbRenderIndexBanner()` renders `data-acn-index-status`. Silent fallback is what hid this bug.
- **Never refetch without the cooldown.** `_ciInFlight` prevents only *concurrent* fetches; `CI_REFETCH_COOLDOWN_MS` prevents a sequential loop of 3.3 MB downloads.

## Platform Registry Pattern

Each platform is an entry in the `PLATFORMS` object with properties:
```javascript
{
    id: 'claude',
    title: 'Claude',
    match: function (host) { return host.includes('claude.ai'); },
    theme: { accent: '#d97706', accentHover: '#b45309', accentLight: '...' },
    icon: '\u2733',
    layout: 'standard',           // 'standard' | 'left-chat'
    useOrbital: true,             // true = orbital cluster, false = legacy ghost-notch
    virtualScroll: false,
    spa: false,
    getUserMessages: function () { /* fallback selector chain */ },
    getAIMessages: function () { /* fallback selector chain */ },
    pathGuard: null,              // optional URL path filter
    initGuards: [],               // startup prerequisite checks
    // ... more properties
}
```

When adding a new platform, follow the existing entry structure exactly.

### Platform Quick Reference

There are 12 platform entries covering 14 platform variants (Claude/Claude Code share `claude`; ChatGPT/Codex share `chatgpt`).

| ID | Title | Hostname(s) | Layout | useOrbital |
|----|-------|-------------|--------|-----------|
| `claude` | Claude | `claude.ai` | standard | `true` |
| `chatgpt` | ChatGPT | `chatgpt.com`, `chat.openai.com` | standard | `true` |
| `grok` | Grok | `grok.com` | standard | `true` |
| `gemini` | Gemini | `gemini.google.com` | standard | `true` |
| `perplexity` | Perplexity | `perplexity.ai`, `www.perplexity.ai` | standard | `true` |
| `bolt` | Bolt | `bolt.new` | left-chat | `false` |
| `lovable` | Lovable | `lovable.dev` | left-chat | `false` |
| `replit` | Replit | `replit.com` | left-chat | `false` |
| `v0` | V0 | `v0.app` | left-chat | `false` |
| `base44` | Base44 | `app.base44.com` | left-chat | `false` |
| `emergent` | Emergent | `app.emergent.sh` | left-chat | `false` |
| `firebase_studio` | Firebase Studio | `studio.firebase.google.com`, `*.cloudworkstations.dev` | standard | `false` |

## Test Contract (`data-acn-*` Attributes)

Tests query **only** these stable DOM attributes — they are the public test API.

**Roles** (queried via `[data-acn-role="..."]`):
```
data-acn-role="zone"          -> Main container injected into the page
data-acn-role="styles"        -> Injected <style> element
data-acn-role="nav-trigger"   -> Element that opens the navigation panel on click
data-acn-role="nav-panel"     -> The navigation panel element
data-acn-role="nav-stat"      -> Shows the detected question count
data-acn-role="nav-list"      -> Container holding the question items
data-acn-role="nav-item"      -> Each individual question entry
data-acn-role="nav-item-text" -> Display text inside each nav-item
data-acn-role="panel-close"   -> Closes the currently open panel on click
```

**Data attributes** (queried on the elements above):
```
data-acn-accent="#hexcolor"              -> Platform accent colour (on the zone element)
data-acn-ui="orbital"|"legacy"          -> UI system (on zone; distinct from data-acn-mode which tracks arc/wheel/show-all)
data-acn-dot="nav|search|bookmarks|…"   -> Feature ID on each orbital dot (orbital platforms only)
data-acn-open="true"                    -> Present on nav-panel when open, absent when closed
data-acn-count="N"                      -> Number of detected questions (on nav-stat element)
data-acn-index-status="degraded|loading|ready-with-notes"
                                        -> Conversation-index banner state (Claude only, v12.0+).
                                           Absent when the index is healthy with nothing to report.
data-acn-jumping="true"                 -> On any panel with a jump in flight. Also blocks clicks via CSS.
data-acn-jump-resolved="N"              -> On the ZONE: the data-index a completed jump actually
                                           resolved. Durable — the resolved ELEMENT is detached by
                                           the re-render scrollIntoView triggers, so marking only
                                           the element is unreadable by the time a test looks.
```

Never remove or rename these attributes — tests depend on them.

### Mock pages and virtualization

`tests/mock-pages/claude-virtualized.html` is the reference for a **virtualizing** mock: it holds 40 turns in JavaScript and mounts 3, genuinely removing the rest from the document. Every other mock is static and mounts all its turns permanently.

**Assert on what the implementation RESOLVED, never on ambient DOM state.** A mutation
test proved the difference: with the row offset forced to 0 and verification stubbed out,
the navigator resolved the *assistant reply* instead of Question 1 — and the suite stayed
green, because checking "is row 0 mounted and does it read right" passes whenever the
6-row mount window happens to contain the intended row. Only `data-acn-jump-resolved`
distinguishes a correct jump from a confidently wrong one.

**And look the answer up in the backing data, not the DOM.** Resolving the row *index*
durably is only half of it. The first version then read that row's text back out of the
live DOM, where it is usually already recycled away again — the re-render `scrollIntoView`
triggers is what unmounts it. The check consequently tracked machine speed: green on Linux
and macOS, red on all three Windows engines, for the same correct jump. Use
`__mockVirtualization.rowText(i)`, which reads the mock's `MESSAGES` array. Same rule the
product follows — do not ask the DOM for data the index already holds (DEC-025).

This distinction is load-bearing. A suite of static mocks **structurally cannot fail** on a Layer 4 state break — the entire suite stayed green while Navigate was showing 3% of the conversation. If you add a platform that virtualizes, ship a mock that genuinely unmounts nodes; `display:none` does not reproduce the failure.

## Three Display Modes

1. **Show All** — all 6 orbital dots visible at equal opacity
2. **Arc** — polygon arc with 3 visible dots, scroll-driven rotation
3. **Wheel** — conveyor belt rotation, Navigate always highlighted

## Common Tasks

### Adding a New Platform

1. Add an entry to the `PLATFORMS` object in the main userscript following the existing pattern
2. Implement `getUserMessages()` and `getAIMessages()` with a fallback selector chain
3. Create a mock HTML page at `tests/mock-pages/{platform-id}.html` matching the real DOM
4. Add the platform to the test suite in `tests/test-all-platforms.js`
5. Add `@match` URL to the userscript header

### Modifying Panel UI

- Panel builders are functions named `orbBuildPanel{Name}()` (e.g., `orbBuildPanelNav()`, `orbBuildPanelSearch()`)
- Maintain `data-acn-role` attributes on key elements for test stability
- Use `acn-` prefixed CSS classes for all new styling

### Modifying the Orbital Zone

- Zone construction: `orbBuildZone()`
- Rendering: `orbRenderShowAll()`, `orbRenderArc()`, `orbRenderWheel()`
- CSS injection: `orbInjectCSS()`

## The `modules/` Directory

The `modules/` folder contains **extracted reference implementations** of feature groups from the main userscript. Each file isolates a logical subsystem with its own version and dependency notes. These are **not imported at runtime** — the main userscript is the single deployable file. The modules serve as:

- Development references when working on a specific feature area
- Historical snapshots of how features were integrated
- Potential future integration targets if the project ever moves to a build step

| File | Feature Area |
|------|-------------|
| `groupA-hover-zone.js` | Hover zone hitzone geometry (`orbUpdateHitzone()`) |
| `groupB-context-tracking.js` | SSE interception, token counting |
| `groupC-settings.js` | Settings panel, language selection |
| `groupD-bookmarks-search.js` | Bookmarks, search, filtering |
| `groupE1-summary.js` | Summary panel, conversation analysis |
| `groupE2-tools-gallery.js` | Tools, image gallery, exports, commands |

When modifying a feature, check the corresponding module file for design context, then make changes in the main userscript.

## The `docs/` Directory

The `docs/` folder contains detailed feature specs, design documents, and agent plans. These are valuable references when working on specific features:

| File | Topic |
|------|-------|
| `BOOKMARKS.md` | Bookmarks feature spec |
| `COMMANDS.md` | Commands feature spec |
| `CONTEXT-TRACKING.md` | Context tracking design |
| `FIX-V10.8-CONTEXT-TRACKING.md` | Context tracking v10.8 fix details |
| `FIX-V10.9-HYBRID-CONTEXT-TRACKING.md` | Hybrid context tracking v10.9 fix |
| `GET-AI-MESSAGES.md` | AI message extraction spec |
| `HOVER-ZONE-FIX.md` | Hover zone fix spec |
| `SEARCH-ENHANCEMENT.md` | Search enhancement spec |
| `SETTINGS.md` | Settings panel spec |
| `SUMMARY.md` | Summary panel spec |
| `TOOLS.md` | Tools panel spec |
| `PLAN-USAGE.md` | Usage/plan tracking spec |
| `V10-PLAN.md` | v10 release plan |
| `AGENT-PLAN.md` | Agent implementation plan |
| `claude_specific_context_tracking_calculation.md` | Claude-specific context math |
| `orbital/` | Orbital UI specs and reference HTML |

## Root-Level Documentation

These files at the repo root provide additional context:

| File | Purpose |
|------|---------|
| `TESTING.md` | Comprehensive testing guide (more detailed than `agent_docs/testing.md`) |
| `TROUBLESHOOTING.md` | Platform-specific diagnostics and known issues |
| `DOM-REFERENCE.md` | Real DOM structures for all 14 platforms — essential for selector work |
| `DECISIONS.md` | Architectural decision log with rationale |
| `CHANGELOG.md` | Detailed version history |
| `ROADMAP.md` | Future directions and planned features |
