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
3. **Orbital UI System (~lines 950-5000):** Zone construction, panel builders (Navigate, Search, Bookmarks, Summary, Tools, Settings), rendering modes
4. **Helpers & Utilities (~lines 5000+):** Scroll handling, SSE interception, context estimation, bookmark persistence

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

| ID | Title | Hostname(s) | Layout |
|----|-------|-------------|--------|
| `claude` | Claude | `claude.ai` | standard |
| `chatgpt` | ChatGPT | `chatgpt.com`, `chat.openai.com` | standard |
| `grok` | Grok | `grok.com` | standard |
| `gemini` | Gemini | `gemini.google.com` | standard |
| `bolt` | Bolt | `bolt.new` | standard |
| `lovable` | Lovable | `lovable.dev` | standard |
| `replit` | Replit | `replit.com` | standard |
| `v0` | V0 | `v0.app` | standard |
| `base44` | Base44 | `app.base44.com` | standard |
| `emergent` | Emergent | `app.emergent.sh` | standard |
| `perplexity` | Perplexity | `perplexity.ai`, `www.perplexity.ai` | standard |
| `firebase_studio` | Firebase Studio | `studio.firebase.google.com`, `*.cloudworkstations.dev` | standard |

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
data-acn-accent="#hexcolor"   -> Platform accent colour (on the zone element)
data-acn-open="true"          -> Present on nav-panel when open, absent when closed
data-acn-count="N"            -> Number of detected questions (on nav-stat element)
```

Never remove or rename these attributes — tests depend on them.

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
