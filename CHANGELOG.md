# Changelog

All notable changes to this project will be documented in this file.

## [6.0] - 2026-02-07

### Changed
- **New hover-expand button design** — Button now shows only the platform icon by default, and smoothly expands to reveal "Navigate" text on hover. Cleaner look with a smaller screen footprint.
- **Platform-specific icons** — Each platform now has a unique symbol on the toggle button instead of a generic 📍 pin emoji:
  - Claude: ✳ (eight-spoked asterisk — evokes Anthropic's starburst logo)
  - ChatGPT: ⏣ (benzene ring — evokes OpenAI's hexagonal logo)
  - Grok: X (xAI / X branding)
  - Gemini: ✦ (four-pointed star — evokes Gemini's sparkle)
- Icons use common Unicode symbols to avoid any trademark, copyright, or proprietary issues with company logos

### Design Notes
The hover-expand design was chosen to balance minimalism with discoverability. The icon-only resting state keeps the button unobtrusive, while the hover expansion ensures users can always confirm what the button does. This design also scales well for potential future feature buttons (Search, Settings, etc.) that could stack alongside Navigate.

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
- Gemini (gemini.google.com) support with blue theme (`#4285f4` — Gemini's brand blue)
- Platform-specific color themes for all four AI assistants
- Fallback selectors for Gemini (`div.query-text` → `.query-text-line` → `p.query-text-line`)

### Supported Platforms
- Claude (Orange)
- ChatGPT (White/Gray)
- Grok (Red)
- Gemini (Blue)

### Development Notes — Gemini Challenges
Adding Gemini was the most complex platform integration. Key challenges we worked through:

1. **Custom web components** — Initial web research suggested Gemini used custom elements like `<chat-window>`, `<model-response>`, and `<code-block>` instead of regular HTML divs. Existing userscripts referenced selectors like `chat-window infinite-scroller` and `#chat-history`, but these turned out to be outdated or incorrect.

2. **Bundled user queries** — Unlike Claude/ChatGPT/Grok where user messages have clear, separate DOM elements, early research indicated Gemini might bundle user queries inside `<model-response>` elements alongside the AI's response. This would have required a completely different extraction approach.

3. **Obfuscated Angular classes** — Gemini is built on Angular, which adds dynamically-generated attributes like `_ngcontent-ng-c2926687459` to elements. These change between sessions and can't be used as reliable selectors.

4. **Finding the real selector** — The breakthrough came from manually inspecting the DOM using browser DevTools (right-click message → Inspect). This revealed the actual structure was simpler than expected:
   ```html
   <div class="query-text gds-body-l query-text-animated">
       <p class="query-text-line ng-star-inserted">message text</p>
   </div>
   ```
   The stable selector turned out to be `div.query-text` — the Angular-specific attributes were ignorable.

5. **Lesson learned** — Web research and existing scripts can be outdated. The most reliable approach is always to manually inspect the live DOM with DevTools to find current selectors.

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
