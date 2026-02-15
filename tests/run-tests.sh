#!/bin/bash
# AI Conversation Navigator — Run all platform tests
#
# Usage:
#   ./tests/run-tests.sh                       # Run with Chromium (default)
#   ./tests/run-tests.sh --browser firefox     # Run with Firefox only
#   ./tests/run-tests.sh --browser all         # Run with all available engines
#   ./tests/run-tests.sh --browser chromium,firefox,webkit
#   ./tests/run-tests.sh --screenshots          # Capture PNG screenshots
#   ./tests/run-tests.sh --browser all --screenshots
#
# This script:
#   1. Serves mock HTML pages on localhost
#   2. Launches headless browser(s) via Playwright
#   3. Injects the userscript into each mock page
#   4. Verifies selectors, theme, icons, and navigation
#   5. Prints a pass/fail report
#
# Requirements: Node.js, Playwright (npm install playwright)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Running AI Conversation Navigator test suite..."
echo ""

NODE_PATH=/opt/node22/lib/node_modules node "$SCRIPT_DIR/test-all-platforms.js" "$@"
