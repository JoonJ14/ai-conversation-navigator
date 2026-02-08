# AI Conversation Navigator

A browser userscript that adds a navigation sidebar to AI chat interfaces. Easily jump to any of your previous questions in long conversations.

If you are like me, I just go on and on with chat ai, learning one thing and it spurs another questions. Which is good in a sense I am constantly learning, but it turns out to be one very long conversation script. I know that the models have to compress and save it to memory and I should start another chat to save token consumage, but I just continually ask in chat and it kinda shows the flow of thought and learning. I just like it this way, what can I say. So it becomes troublesome trying to go back to chat ai's previous answers, I have to play the guessing game of "I think you said something about this here somewhere...". I thought soon OpenAI or Anthropic would add simple feature on the scroll bar to show my previous questions and I can "jump" to that part of conversation, but it hasn't came out yet, so I decided to make my own, for now. 

I still think they should make a feature like this for each of their company, which will show their different design philosophies and many other features that could come with this.

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
- **Safari**: [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) - (I will be working on this.. Chrome and Firefox confirmed to work)
- **Atlas**: ChatGPT integrated browser, I am not too sure how to make it work on that yet, maybe a future direction..

### Install the Script

#### Option 1: Direct Install
Click here to install: [ai-conversation-navigator.user.js](../../raw/main/ai-conversation-navigator.user.js)

#### Option 2: Manual Install
1. Open your userscript manager's dashboard
2. Create a new script
3. Copy and paste the contents of `ai-conversation-navigator.user.js`
4. Save the script

### Chrome Users: Important Setup

Chrome requires **Developer Mode** enabled for Tampermonkey to work. I learned this the hard way, so that you don't have to:

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

## Currently pursuing..
2/7/2026 v5.0
- Fixed the Gemini not working only on Chrome issue. It first worked when I tested v4.0, then it wouldn't work after awhile you hit refresh, and the previous questions tab won't come out. The troubleshooting is described in details in CHANGELOG.md

2/6/2026 v4.0
- I found that the current version (v4) works for awhile and then after awhile, the navigate tab won't come out, only in gemini on Chrome. It works well in Gemini when it's on Firefox, which is my main browser. Working on it to fix that problem. I'm guessing it's maybe a special unique feature that gemini has with chrome since they are both Google product?  - Solved ✅ in v5.0 -

- Need to make it work on Safari, although I have to say what it once used to be my main and favorite browser is being used less everyday. Have to use userscripts for safari, not tampermonkey I belive.

- I'm not really sure I like the 📍 design next to Navigate button, nor the word Navigate. I just can't think of better one at the moment, but I might change those soon.
  
## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with the help of Claude (Anthropic) in a single collaborative session. Started as a personal tool to navigate long AI conversations and grew into a multi-platform solution.
