# AI Conversation Navigator

A browser userscript that adds a navigation sidebar to long AI chat conversations. Quickly jump to any of your previous questions with a single click.

![Version](https://img.shields.io/badge/version-6.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Supported Platforms

| Platform | Icon | Color | Status |
|----------|------|-------|--------|
| [Claude](https://claude.ai) | ✳ | 🟠 Orange | ✅ Supported |
| [ChatGPT](https://chatgpt.com) | ⏣ | ⚪ White | ✅ Supported |
| [Grok](https://grok.com) | X | 🔴 Red | ✅ Supported |
| [Gemini](https://gemini.google.com) | ✦ | 🔵 Blue | ✅ Supported |

> **Note on icons:** Each platform's button uses a common Unicode symbol that *evokes* the platform's branding rather than the actual company logo. This avoids any trademark or copyright concerns. See [Icon Choices](#icon-choices) for details.

## Features

- **🔍 Hover-Expand Button** — Compact icon on the screen edge, smoothly reveals "Navigate" label on hover
- **🎯 Quick Navigation** — Click any question to scroll directly to it
- **📝 Smart Summaries** — Automatically extracts the key part of each question
- **🔄 Auto-Refresh** — Updates every 10 seconds while the panel is open
- **🎨 Platform-Specific Themes** — Colors and icons match each platform's branding
- **✨ Visual Feedback** — Briefly highlights the message when you navigate to it
- **🛡️ Gemini-Resilient** — DOM Guardian and SPA hooks keep the button alive through Gemini's aggressive re-rendering

## Installation

### Prerequisites

Install a userscript manager for your browser:

- **Chrome/Edge**: [Tampermonkey](https://www.tampermonkey.net/)
- **Firefox**: [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
- **Safari**: [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887)

### Chrome Users: Enable Developer Mode

Chrome requires Developer Mode for Tampermonkey to work:

1. Go to `chrome://extensions/`
2. Toggle **"Developer mode"** ON (top right corner)
3. Refresh the AI chat page

### Install the Script

#### Option 1: Direct Install
Click here to install: [ai-conversation-navigator.user.js](../../raw/main/ai-conversation-navigator.user.js)

#### Option 2: Manual Install
1. Open your userscript manager's dashboard
2. Create a new script
3. Copy and paste the contents of `ai-conversation-navigator.user.js`
4. Save the script

## Usage

1. Go to any supported AI chat platform
2. Look for the platform icon (✳, ⏣, X, or ✦) on the right edge of the screen
3. Hover over it to see the "Navigate" label
4. Click to open the navigation panel
5. Click any question to jump to that part of the conversation

## How It Works

The script injects a hover-expand button and sidebar panel into AI chat pages. It scans the page for your messages using platform-specific CSS selectors:

| Platform | Selector |
|----------|----------|
| Claude | `[data-testid="user-human-turn"]` |
| ChatGPT | `[data-message-author-role="user"]` |
| Grok | `div.message-bubble` |
| Gemini | `div.query-text` |

## Icon Choices

Each platform's toggle button uses a Unicode symbol chosen to suggest the platform's visual identity without using actual trademarked logos:

| Platform | Icon | Why |
|----------|------|-----|
| Claude | ✳ (eight-spoked asterisk) | Evokes Anthropic's starburst logo shape |
| ChatGPT | ⏣ (benzene ring) | Evokes OpenAI's hexagonal knot logo |
| Grok | X | Represents xAI / X branding |
| Gemini | ✦ (four-pointed star) | Evokes Gemini's sparkle motif |

These are standard Unicode characters, not proprietary artwork, so there are no trademark, copyright, or licensing concerns.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for platform-specific issues and solutions.

### Quick Fixes

- **Script not appearing?** — Make sure Tampermonkey is enabled. Chrome users: enable Developer Mode in `chrome://extensions/`
- **Messages not detected?** — The platform may have updated its HTML. Try clicking ↻ Refresh in the panel, or open an issue.
- **Gemini button broken on Chrome?** — Make sure you're on v5.0+. Earlier versions used `innerHTML` which is blocked by Gemini's Trusted Types CSP.

## Contributing

Found a bug or want to add a feature? Contributions are welcome!

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Adding Support for New Platforms

To add a new AI platform:

1. Add the site to `@match` in the userscript header
2. Add the site to the `SITE` object
3. Add a color theme to `THEME`
4. Add an icon to `ICONS`
5. Add the site title to `siteTitles`
6. Add selector logic in `getUserMessages()`

## Future Ideas

- [ ] Search/filter questions
- [ ] Keyboard shortcuts
- [ ] Export conversation outline
- [ ] Settings panel
- [ ] Convert to standalone browser extension

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with the help of Claude (Anthropic) as a learning project to explore browser userscripts, DOM manipulation, and frontend JavaScript development.
