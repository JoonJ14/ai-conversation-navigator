# AI Conversation Navigator

A browser userscript that adds a navigation sidebar to AI chat interfaces. Easily jump to any of your previous questions in long conversations.

## Supported Platforms

| Platform | Color | Status |
|----------|-------|--------|
| [Claude](https://claude.ai) | 🟠 Orange | ✅ Supported |
| [ChatGPT](https://chatgpt.com) | ⚪ White | ✅ Supported |
| [Grok](https://grok.com) | 🔴 Red | ✅ Supported |
| [Gemini](https://gemini.google.com) | 🔵 Blue | ✅ Supported |

## Features

- **📍 Quick Navigation** — Click any question to scroll directly to it
- **📝 Smart Summaries** — Shows the first sentence or question from each message
- **🎨 Platform-Specific Themes** — Each AI platform gets its own color scheme
- **🔄 Auto-Refresh** — Updates every 10 seconds while the panel is open
- **✨ Visual Feedback** — Highlights messages when you navigate to them

## Installation

### Prerequisites

Install a userscript manager for your browser:

- **Chrome/Edge**: [Tampermonkey](https://www.tampermonkey.net/)
- **Firefox**: [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
- **Safari**: [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887)

### Install the Script

#### Option 1: Direct Install
Click here to install: [ai-conversation-navigator.user.js](../../raw/main/ai-conversation-navigator.user.js)

#### Option 2: Manual Install
1. Open your userscript manager's dashboard
2. Create a new script
3. Copy and paste the contents of `ai-conversation-navigator.user.js`
4. Save the script

### Chrome Users: Important Setup

Chrome requires **Developer Mode** enabled for Tampermonkey to work:

1. Go to `chrome://extensions/`
2. Toggle **"Developer mode"** ON (top right corner)
3. Refresh the AI chat page

## Usage

1. Go to any supported AI chat platform
2. Look for the **"📍 Navigate"** button on the right edge of the screen
3. Click it to open the navigation panel
4. Click any question to jump to that part of the conversation

## How It Works

The script injects a sidebar panel into AI chat pages. It scans the page for your messages using platform-specific CSS selectors:

| Platform | Selector |
|----------|----------|
| Claude | `[data-testid="user-human-turn"]` |
| ChatGPT | `[data-message-author-role="user"]` |
| Grok | `div.message-bubble` |
| Gemini | `div.query-text` |

## Troubleshooting

### Script not appearing?
- Make sure the userscript manager is enabled
- Chrome users: Enable Developer Mode in `chrome://extensions/`
- Try refreshing the page

### Messages not detected?
- The site's HTML structure may have changed
- Open an issue with details about which platform is affected
- You can inspect the page to find the new selectors

### Firefox AI Sidebar
The script works in regular Firefox tabs but **not** in Firefox's built-in AI sidebar (it's a protected browser context).

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
4. Add the site title to `siteTitles`
5. Add selector logic in `getUserMessages()`

## Future Ideas

- [ ] Keyboard shortcuts (e.g., Alt+1 through Alt+9 to jump to questions)
- [ ] Search/filter questions
- [ ] Export conversation outline as markdown
- [ ] Collapsible sections grouped by topic
- [ ] Convert to standalone browser extension

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with the help of Claude (Anthropic) in a single collaborative session. Started as a personal tool to navigate long AI conversations and grew into a multi-platform solution.
