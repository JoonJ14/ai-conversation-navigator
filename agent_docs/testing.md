# Testing

## Prerequisites

- Node.js 22+
- npm

## Setup

```bash
npm install
npx playwright install --with-deps
```

## Running Tests

```bash
# Run all tests on all 17 platform entries (294 total: 14 tests × orbital, 13 × legacy,
# + virtualization and jump tests on the three Claude (virtualized) entries)
npm test

# Run on specific browsers
node tests/test-all-platforms.js --browser firefox
node tests/test-all-platforms.js --browser chromium,firefox,webkit

# Generate screenshots for visual verification
npm run test:screenshots

# Shell wrapper
./tests/run-tests.sh
```

## Test Architecture

Tests use Playwright with route interception:
1. Load mock HTML from `tests/mock-pages/{platform}.html`
2. Inject the userscript (stripping the header lines 1-27)
3. Navigate to `https://{platform-hostname}/`
4. Assert against `data-acn-*` contract attributes

## Test Contract Attributes

The test suite queries only stable `data-acn-*` attributes — never internal CSS classes or IDs. Current contract:

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-acn-role="zone"` | Main container | Injection verified |
| `data-acn-role="styles"` | `<style>` element | CSS injection verified |
| `data-acn-role="nav-trigger"` | Nav dot/button | Click target |
| `data-acn-role="nav-panel"` | Nav panel | Panel open/close |
| `data-acn-role="nav-stat"` | Stats bar | Question count via `data-acn-count` |
| `data-acn-role="nav-list"` | List container | Question item container |
| `data-acn-role="nav-item"` | Question row | Individual question |
| `data-acn-role="nav-item-text"` | Text inside row | Display text |
| `data-acn-role="panel-close"` | Close button | Dismisses panel |
| `data-acn-accent="#hex"` | On zone | Platform accent color |
| `data-acn-ui="orbital"|"legacy"` | On zone | UI system type |
| `data-acn-dot="nav|search|…"` | On each orbital dot | Feature ID (orbital only) |
| `data-acn-open="true"` | On nav-panel | Panel open state |
| `data-acn-count="N"` | On nav-stat | Question count |
| `data-acn-index-status="degraded\|loading\|ready-with-notes"` | On zone | Conversation-index banner state (Claude, v12.0+) |
| `data-acn-jumping="true"` | On panel | A jump is in flight |
| `data-acn-jump-resolved="N"` | On zone | The `data-index` a completed jump actually resolved — durable, because the resolved element is detached by the re-render `scrollIntoView` triggers |

**Two rules for virtualized assertions** (both learned the hard way — see DEC-025):
assert on what the implementation *resolved* via `data-acn-jump-resolved`, never on
ambient DOM state; and look the resolved row's text up with
`__mockVirtualization.rowText(i)`, never with `querySelector('[data-index="N"]')`, because
that row is routinely recycled away before the assertion runs. Reading the DOM there made
the check pass on Linux and fail on Windows for the same correct jump.

## Modification Checklist

When modifying the userscript, ensure:
- All `data-acn-*` attributes remain intact
- Mock pages match the real platform DOM structure
- Tests pass across all 17 platform entries (14 real platforms + three Claude virtualized
  entries: degraded, index-backed, and index-backed with markdown API text whose DOM/API
  text deliberately does NOT match)

## CI/CD

GitHub Actions runs on push/PR to `main`:
- **cross-platform-tests.yml:** 3 OS (Ubuntu, macOS, Windows) x 3 browsers (Chromium, Firefox, WebKit) = 9 test matrix jobs

**Windows is the runner that catches timing assumptions.** It is materially slower than
the Ubuntu and macOS runners, so an assertion that races the virtualizer passes on two OSes
and fails on the third. Treat a Windows-only failure as a real finding about the assertion,
not as runner flakiness. Do not add `--single-process` to the Chromium launcher — it removes
crash isolation and reports one renderer fault as every-platform-after-it failing (DEC-026).
- **claude.yml:** Claude Code integration for automated issue/PR responses
- **claude-code-review.yml:** Automated code review

## Related Documentation

For deeper testing and debugging context, see these root-level files:

- **`TESTING.md`** — Comprehensive testing guide with additional detail beyond this summary
- **`TROUBLESHOOTING.md`** — Platform-specific diagnostics, known issues, and debugging steps
- **`DOM-REFERENCE.md`** — Real DOM structures for all 14 platforms; essential when fixing broken selectors or updating mock pages
