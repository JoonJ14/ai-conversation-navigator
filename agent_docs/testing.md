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

## Test Architecture

Tests use Playwright with route interception:
1. Load mock HTML from `tests/mock-pages/{platform}.html`
2. Inject the userscript (stripping the header lines 1-27)
3. Navigate to `https://{platform-hostname}/`
4. Assert against `data-acn-*` contract attributes

## Modification Checklist

When modifying the userscript, ensure:
- All `data-acn-*` attributes remain intact
- Mock pages match the real platform DOM structure
- Tests pass across all 14 platforms

## CI/CD

GitHub Actions runs on push/PR to `main`:
- **cross-platform-tests.yml:** 3 OS (Ubuntu, macOS, Windows) x 3 browsers (Chromium, Firefox, WebKit) = 9 test matrix jobs
- **claude.yml:** Claude Code integration for automated issue/PR responses
- **claude-code-review.yml:** Automated code review

## Related Documentation

For deeper testing and debugging context, see these root-level files:

- **`TESTING.md`** — Comprehensive testing guide with additional detail beyond this summary
- **`TROUBLESHOOTING.md`** — Platform-specific diagnostics, known issues, and debugging steps
- **`DOM-REFERENCE.md`** — Real DOM structures for all 14 platforms; essential when fixing broken selectors or updating mock pages
