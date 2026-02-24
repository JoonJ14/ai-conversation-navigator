# CLAUDE.md — AI Assistant Guide

## Project Overview

**AI Conversation Navigator** is a browser userscript (Tampermonkey/Greasemonkey) that adds an orbital navigation sidebar to AI chat platforms, allowing users to jump to any previous question in one click. It supports 14 platform variants across 12 websites.

**Supported platforms:** Claude, Claude Code, ChatGPT, Codex, Grok, Gemini, Perplexity, Bolt.new, Lovable, Replit, V0, Base44, Emergent, Firebase Studio.

**Key architectural facts:**
- Single-file userscript (`ai-conversation-navigator.user.js`, ~6,000 lines, ~275KB)
- No build step, no bundler, no minification — deployed as-is
- Zero runtime dependencies — pure vanilla JavaScript
- ES5 compatible (no arrow functions, no classes, no async/await, no template literals)
- All styling injected via `GM_addStyle()` — no external CSS

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

## Technology Stack

| Category | Technology |
|----------|-----------|
| Language | Vanilla JavaScript (ES5 compatible) |
| Runtime | Tampermonkey/Greasemonkey userscript manager |
| Build | None — single file, no build step |
| Testing | Playwright (headless Chromium/Firefox/WebKit) |
| Storage | `GM_setValue`/`GM_getValue` + `localStorage` |
| Networking | `GM_xmlhttpRequest`, Fetch API monkey-patching (SSE) |
| Browser APIs | MutationObserver, TreeWalker, ResizeObserver |

## Code Conventions

### Language Constraints (CRITICAL)

The userscript must remain **ES5 compatible**. This means:
- **NO** arrow functions — use `function () {}`
- **NO** classes — use constructor functions or plain objects
- **NO** `async`/`await` — use callbacks or Promises with `.then()`
- **NO** template literals — use string concatenation
- **NO** `let`/`const` in the main userscript — use `var` (note: `const PLATFORMS` exists as a legacy exception)
- **NO** destructuring, spread operators, default parameters, or other ES6+ features
- **NO** external dependencies at runtime

### Naming Conventions

| Prefix | Scope | Example |
|--------|-------|---------|
| `acn-` | CSS classes | `.acn-zone`, `.acn-dot`, `.acn-panel` |
| `orb` | Orbital system functions | `orbBuildZone()`, `orbRender*()`, `orbScrollToQuestion()` |
| `_` | Private/internal variables | `_questions`, `_aiResponses`, `_sseTokenData` |
| `data-acn-` | DOM test contract attributes | `data-acn-role`, `data-acn-open`, `data-acn-count` |

### CSS Conventions

- All styles injected via single `GM_addStyle()` call
- CSS classes prefixed with `acn-` to avoid conflicts with host pages
- Theme colors via CSS variables: `var(--acn-accent)`
- ID namespace: `#acn-zone` for the main container

### Storage Keys

| Key | Purpose |
|-----|---------|
| `'acn-settings'` | General settings (mode, language, scroll direction) |
| `'acn-bookmarks-v1'` | Message bookmarks per conversation |
| `'acn-commands-v1'` | Saved /commands |
| `'_acnv10'` | localStorage for panel width |
| `'acn-ctx-cache'` | Claude context window cache |

## Architecture

### Userscript Structure

The main file is organized into logical phases within a single IIFE:

1. **Initialization (~lines 1–250):** Duplicate guard, i18n strings, settings, version constant
2. **Platform Registry (~lines 251–950):** `PLATFORMS` object with 14 entries, each defining hostname matching, selectors, theme colors, and message extraction functions
3. **Orbital UI System (~lines 950–5000):** Zone construction, panel builders (Navigate, Search, Bookmarks, Summary, Tools, Settings), rendering modes
4. **Helpers & Utilities (~lines 5000+):** Scroll handling, SSE interception, context estimation, bookmark persistence

### Platform Registry Pattern

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

### Test Contract (`data-acn-*` Attributes)

Tests query **only** these stable DOM attributes — they are the public test API:
```
data-acn-role="zone"          → Main container
data-acn-role="nav-panel"     → Navigation panel
data-acn-role="nav-item"      → Individual question entry
data-acn-role="nav-item-text" → Question text within nav item
data-acn-role="panel-close"   → Close button
data-acn-role="styles"        → Injected style element
data-acn-open="true"          → Panel is open
data-acn-count="N"            → Question count
data-acn-accent="#hexcolor"   → Theme accent color
data-acn-version="10.9"       → Script version
data-acn-mode="arc"           → Current display mode
data-acn-platform="claude"    → Detected platform ID
```

Never remove or rename these attributes — tests depend on them.

### Three Display Modes

1. **Show All** — all 6 orbital dots visible at equal opacity
2. **Arc** — polygon arc with 3 visible dots, scroll-driven rotation
3. **Wheel** — conveyor belt rotation, Navigate always highlighted

## Development Workflow

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
npm install
npx playwright install --with-deps
```

### Running Tests

```bash
# Run all 14 platform tests on Chromium (default)
npm test

# Run on specific browsers
node tests/test-all-platforms.js --browser firefox
node tests/test-all-platforms.js --browser chromium,firefox,webkit

# Generate screenshots for visual verification
npm run test:screenshots

# Shell wrapper
./tests/run-tests.sh
```

### Test Architecture

Tests use Playwright with route interception:
1. Load mock HTML from `tests/mock-pages/{platform}.html`
2. Inject the userscript (stripping the header lines 1–27)
3. Navigate to `https://{platform-hostname}/`
4. Assert against `data-acn-*` contract attributes

When modifying the userscript, ensure:
- All `data-acn-*` attributes remain intact
- Mock pages match the real platform DOM structure
- Tests pass across all 14 platforms

### CI/CD

GitHub Actions runs on push/PR to `main`:
- **cross-platform-tests.yml:** 3 OS (Ubuntu, macOS, Windows) × 3 browsers (Chromium, Firefox, WebKit) = 9 test matrix jobs
- **claude.yml:** Claude Code integration for automated issue/PR responses
- **claude-code-review.yml:** Automated code review

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

## Important Guidelines

1. **Never break ES5 compatibility** — the script runs in Tampermonkey across all browsers
2. **Never remove `data-acn-*` attributes** — the test suite depends on them
3. **Keep it single-file** — the userscript must remain one deployable `.user.js` file
4. **No external dependencies** — everything runs in the browser with only Tampermonkey APIs
5. **Fallback chains** — platform selectors should always have fallbacks since host sites change their DOM frequently
6. **Prefix everything** — CSS classes with `acn-`, functions with `orb`, to avoid host-page conflicts
7. **Test all 14 platforms** — run `npm test` after any change to verify cross-platform compatibility
8. **Update the version** — bump `ACN_VERSION` and the `@version` header when making releases
9. **Respect IIFE scope** — all code lives inside the `(function () { ... })()` wrapper
10. **DOM observation resilience** — use MutationObserver patterns for SPA-aware re-scanning; never assume DOM is static
