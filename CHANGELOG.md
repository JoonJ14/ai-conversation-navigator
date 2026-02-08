# Changelog

All notable changes to this project will be documented in this file.

## [5.0] - 2026-02-07

### Fixed
- **Gemini on Chrome: Navigate button unresponsive** — Gemini enforces a Trusted Types Content Security Policy (CSP) that blocks all `innerHTML` assignments. The panel was being created as an empty shell, so clicking the button had nothing to show. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#gemini-navigate-button-does-nothing-chrome-only) for full details.

### Changed
- Replaced all `innerHTML` usage with programmatic DOM creation (`createElement`, `textContent`, `appendChild`) for full Trusted Types compliance
- Added DOM Guardian (MutationObserver) to detect and re-inject elements if removed by SPA re-rendering
- Added SPA navigation hooks (`pushState`, `replaceState`, `popstate`) for Gemini route changes
- Added periodic health check (every 3 seconds) on Gemini to ensure elements survive DOM rebuilds
- Increased z-index to max (`2147483647`) with `!important` on critical positioning and visibility styles
- Merged duplicate click handlers on the toggle button into a single unified handler

## [4.0] - 2026-02-05

### Added
- Gemini (gemini.google.com) support with blue theme
- Platform-specific color themes for all four AI assistants

### Supported Platforms
- Claude (Orange)
- ChatGPT (White/Gray)
- Grok (Red)
- Gemini (Blue)

## [3.0] - 2026-02-05

### Added
- Grok (grok.com) support with red theme
- Updated color scheme: ChatGPT changed from green to white/grayscale

## [2.0] - 2026-02-05

### Added
- ChatGPT (chatgpt.com, chat.openai.com) support
- Site detection to apply different selectors per platform
- Platform-specific accent colors (Orange for Claude, Green for ChatGPT)

## [1.0] - 2026-02-05

### Added
- Initial release
- Claude.ai support
- Navigation sidebar with question bookmarks
- Smart summary generation (extracts questions or first sentences)
- Click-to-scroll with highlight animation
- Auto-refresh every 10 seconds while panel is open
- Dark theme UI
