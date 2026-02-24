# Architecture

## Directory Structure

```
├── ai-conversation-navigator.user.js   # Main userscript (single deployable file)
├── package.json                        # Node metadata + test scripts
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

## Test Contract (`data-acn-*` Attributes)

Tests query **only** these stable DOM attributes — they are the public test API:
```
data-acn-role="zone"          -> Main container
data-acn-role="nav-panel"     -> Navigation panel
data-acn-role="nav-item"      -> Individual question entry
data-acn-role="nav-item-text" -> Question text within nav item
data-acn-role="panel-close"   -> Close button
data-acn-role="styles"        -> Injected style element
data-acn-open="true"          -> Panel is open
data-acn-count="N"            -> Question count
data-acn-accent="#hexcolor"   -> Theme accent color
data-acn-version="10.9"       -> Script version
data-acn-mode="arc"           -> Current display mode
data-acn-platform="claude"    -> Detected platform ID
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
