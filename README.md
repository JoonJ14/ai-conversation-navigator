# AI Conversation Navigator

A browser userscript that adds a navigation sidebar to long AI chat conversations. Quickly jump to any of your previous questions with a single click.

If you are like me, I just go on and on with chat ai, learning one thing and it spurs another questions. Which is good in a sense I am constantly learning, but it turns out to be one very long conversation script. I know that the models have to compress and save it to memory and I should start another chat to save token consumage, but I just continually ask in chat and it kinda shows the flow of thought and learning. I just like it this way, what can I say. So it becomes troublesome trying to go back to chat ai's previous answers, I have to play the guessing game of "I think you said something about this here somewhere...". I thought soon OpenAI or Anthropic would add simple feature on the scroll bar to show my previous questions and I can "jump" to that part of conversation, but it hasn't came out yet, so I decided to make my own, for now. 

I still think they should make a feature like this for each of their company, which will show their different design philosophies and many other features that could come with this concept. For example, while testing I just found out that Grok does have feature similar to this, with modern line design and summary of the question popping up. Exactly what I'm talking about, like I still wonder why other companies are not implementing it. I think its necessary design, espeically for people who have prolonged conversation with those ai models and interact with it daily. I'll still be building my product to be used all across different web browsers and ai models, but I do think in near future that each company shoudl and will come out with their own feature for this, and like I wouldn't be mad getting replaced. I'd be excited to see how each company has different philosophies and approach to thinking how us humans can maximize utility and efficiency with those ai models.

But until then, I'll just keep making, building, and improving this project. Stay tuned.


![Version](https://img.shields.io/badge/version-7.6-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Supported Platforms

### AI Chatbots

| Platform | Icon | Color | Status |
|----------|------|-------|--------|
| [Claude](https://claude.ai) | ✳ | 🟠 Orange | ✅ Supported |
| [ChatGPT](https://chatgpt.com) | ⏣ | ⚪ White | ✅ Supported |
| [Grok](https://grok.com) | X | 🔴 Red | ✅ Supported |
| [Gemini](https://gemini.google.com) | ✦ | 🔵 Blue | ✅ Supported |
| [Perplexity](https://perplexity.ai) | ⦾ | 🩵 Teal | ✅ Supported |

### Coding Agents (Web)

| Platform | Icon | Color | Status |
|----------|------|-------|--------|
| [Claude Code](https://claude.ai/code) | ✳ | 🟠 Orange | ✅ Supported |
| [Codex](https://chatgpt.com/codex) | ⏣ | ⚪ White | ✅ Supported |

I use those coding agents mostly in terminal CLI, and I find them incredibly effective there too. Or inside the terminal of VS fork IDEs, like Cursor or Antigravity. Claude code on web is only a research preview, and codex even has a separate app for mac OS. However, I do think web version also has its merits and I do use them too, so I thought I'd add support on anyway.

### AI App-Builder Platforms

| Platform | Icon | Color | Button Style | Status |
|----------|------|-------|-------------|--------|
| [Bolt.new](https://bolt.new) | ⚡ | 🩵 Sky Blue | Ghost Notch (left-chat) | ✅ Beta |
| [Lovable](https://lovable.dev) | ♥ | 🟣 Violet | Ghost Notch (left-chat) | ✅ Beta |
| [Replit](https://replit.com) | ⠕ | 🟠 Red-Orange | Ghost Notch (left-chat) | ✅ Beta |
| [V0](https://v0.app) | ▽ | ⚪ White | Ghost Notch (left-chat) | ✅ Beta |
| [Base44](https://app.base44.com) | ⬢ | 🟣 Indigo | Ghost Notch (left-chat) | ✅ Beta |
| [Emergent](https://app.emergent.sh) | e | 🟢 Emerald | Ghost Notch (left-chat) | ✅ Beta |
| [Firebase Studio](https://studio.firebase.google.com) | ✦ | 🟠 Dark Tangerine | Standard (right-edge) | ✅ Beta |

> **Beta Notice:** The initial support for these app-builder platforms was developed using **mock DOM testing** — we built replica HTML pages based on open-source forks and research, then validated our selectors against those replicas with automated Playwright tests (see [TESTING.md](TESTING.md)). Later, we created free accounts on each platform to test against the live sites and refine the selectors they use for the questions we ask. This means the selectors are informed by real DOM inspection, but these platforms update frequently and may change their HTML structure at any time. **If you try it and run into problems, please [open an issue](https://github.com/JoonJ14/ai-conversation-navigator/issues) describing what you see.** Your real-world feedback is exactly what will help us fix selectors and make this work well. We genuinely welcome it.

> **Note on icons:** Each platform's button uses a common Unicode symbol that *evokes* the platform's branding rather than the actual company logo. This avoids any trademark or copyright concerns. See [Icon Choices](#icon-choices) for details.

## Supported Web Browsers

Chrome, Firefox, Safari, Edge

## Features

- **🔍 Hover-Expand Button** — Compact icon on the screen edge, smoothly reveals "Navigate" label on hover
- **🎯 Quick Navigation** — Click any question to scroll directly to it
- **📝 Smart Summaries** — Automatically extracts the key part of each question
- **🔄 Auto-Refresh** — Updates every 10 seconds while the panel is open
- **🎨 Platform-Specific Themes** — Colors and icons match each platform's branding
- **✨ Visual Feedback** — Briefly highlights the message when you navigate to it
- **👻 Ghost Notch Button** — For left-chat app builders, a nearly-invisible 8px notch at the chat boundary that expands to reveal the icon on hover
- **🛡️ SPA-Resilient** — DOM Guardian, SPA navigation hooks, and periodic health checks keep the button alive through aggressive re-rendering (Gemini, Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio, Perplexity)

## Installation

### Step 1: Install a Userscript Manager

Install one of these extensions for your browser:

- **Chrome/Edge**: [Tampermonkey](https://www.tampermonkey.net/)
- **Firefox**: [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
- **Safari**: [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) (You can use tampermonkey with Safari too, but unlike Chrome and Firefox, you have to buy tampermonkey in app store for $2.99. Userscript is free and our code works with userscript, so you don't have to pay, unless you already bought it.)

### Step 2: Browser-Specific Setup

Some browsers need extra configuration before userscripts will work. **Find your browser below**, follow those steps, then move on to [Step 3](#step-3-install-the-script).

> **Firefox users:** No extra setup needed — skip straight to [Step 3](#step-3-install-the-script).

<details>
<summary><strong>Chrome</strong></summary>

Chrome requires **Developer Mode** enabled for Tampermonkey to run userscripts:

1. Go to `chrome://extensions/` or press the puzzle button right next to the URL bar
2. Toggle **"Developer mode"** ON (top-right corner)
3. Find **Tampermonkey** → click **Details**
4. Scroll down and toggle **"Allow User Scripts"** ON
5. Click **"Relaunch"** when Chrome prompts you or refresh — changes won't take effect without this
6. After relaunch, refresh any open AI chat pages

</details>

<details>
<summary><strong>Edge</strong></summary>

Edge is built on the same engine as Chrome, so the setup is very similar — but the URLs are different.

1. Install [Tampermonkey](https://www.tampermonkey.net/) from the Edge Add-ons store
2. Go to `edge://extensions/` or press the puzzle button right next to the URL bar
3. Toggle **"Developer mode"** ON (mid-left side of the screen)
4. Find **Tampermonkey** → click **Details**
5. Scroll down and toggle **"Allow User Scripts"** ON
6. Click **"Relaunch"** when Edge prompts you or refresh — changes won't take effect without this
7. After relaunch, refresh any open AI chat pages

</details>

<details>
<summary><strong>Safari</strong></summary>

After installing [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887), Safari will ask which websites the extension can access.

**Recommended: Per-Site Permissions (default)**

Grant access only to the AI chat sites you use:

1. Open Safari → Settings → Extensions → Userscripts
2. Under "Permissions", set to **"Ask for Each Website"** (this is the default)
3. Visit each AI site you use ([claude.ai](https://claude.ai), [chatgpt.com](https://chatgpt.com), [grok.com](https://grok.com), [gemini.google.com](https://gemini.google.com))
4. When Safari asks, click **"Allow for One Day"** or **"Always Allow on This Website"**

This way the extension only has access to the specific sites you approve.

**Alternative: Allow on All Websites**

If you prefer not to approve each site individually, you can set the extension to **"Allow on All Websites"** — and it is still safe. Here's why:

1. **`@match` rules are enforced by the extension** — The script's metadata declares exactly which URLs it should run on (`claude.ai`, `chatgpt.com`, `grok.com`, `gemini.google.com`). Userscripts.app reads these `@match` patterns and *only injects the script on those matching pages*, regardless of the Safari permission level.
2. **The script itself only activates on recognized sites** — Even if somehow injected elsewhere, the code detects which platform it's on and does nothing if the site isn't one of the four supported platforms.
3. **No data leaves your browser** — The script is purely local DOM manipulation. It doesn't make network requests, collect data, or communicate with any external server.
4. **Fully open source** — You can read every line of the script to verify all of the above.

So "Allow on All Websites" effectively behaves the same as per-site permissions for this script. But per-site is still the recommended default because it's good security hygiene for *any* extension.

**Important quirk:** Unlike Tampermonkey, Userscripts.app does not auto-detect external file changes. If you manually edit or update the `.user.js` file outside of Safari, you must **open the Userscripts extension popup once** for the changes to take effect.

</details>

### Step 3: Install the Script

#### Option 1: Direct Install
Click here to install: [ai-conversation-navigator.user.js](../../raw/main/ai-conversation-navigator.user.js)

#### Option 2: Manual Install
1. Open your userscript manager's dashboard
2. Create a new script
3. Copy and paste the contents of `ai-conversation-navigator.user.js`
4. Save the script

## Usage

1. Go to any supported AI chat platform
2. Look for the platform icon on the screen edge:
   - **AI chatbots & Firebase Studio:** Icon appears on the **right edge** — hover to see the "Navigate" label
   - **App builders (Bolt, Lovable, Replit, V0, Base44, Emergent):** A thin notch appears at the **chat/workspace boundary** — hover to reveal the icon
3. Click to open the navigation panel
4. Click any question to jump to that part of the conversation

## How It Works

The script injects a hover-expand button and sidebar panel into AI chat pages. It scans the page for your messages using platform-specific CSS selectors:

| Platform | Selector |
|----------|----------|
| Claude | `[data-testid="user-human-turn"]` |
| Claude Code | `div.bg-bg-200.rounded-lg` + fallback chain |
| ChatGPT | `[data-message-author-role="user"]` |
| Codex Web | `div.self-end.bg-token-bg-tertiary` |
| Grok | `div.message-bubble` |
| Gemini | `div.query-text` |
| Perplexity | `.group\/query` (Tailwind group variant) |
| Bolt.new | `[data-message-id]` + `self-end` filter + fallback chain |
| Lovable | `div[role="log"] .justify-end` + fallback chain |
| Replit | `[data-cy="user-message"]` (Cypress attribute, one per message) |
| V0 | `[data-role="user"]` + multi-attribute + structural fallback |
| Base44 | `[id^="message-"]` + `.justify-end` filter |
| Emergent | `[data-testid^="user-message"]` |
| Firebase Studio | `[class*="_isUser_"]` (CSS Modules partial match) |

## Icon Choices

Each platform's toggle button uses a Unicode symbol chosen to suggest the platform's visual identity without using actual trademarked logos:

| Platform | Icon | Why |
|----------|------|-----|
| Claude | ✳ (eight-spoked asterisk) | Evokes Anthropic's starburst logo shape |
| ChatGPT | ⏣ (benzene ring) | Evokes OpenAI's hexagonal knot logo |
| Grok | X | Represents xAI / X branding |
| Gemini | ✦ (four-pointed star) | Evokes Gemini's sparkle motif |
| Perplexity | ⦾ (circled white bullet) | Evokes Perplexity's circular logo/search motif |
| Bolt.new | ⚡ (high voltage) | Evokes "Bolt" lightning branding |
| Lovable | ♥ (heart suit) | Evokes Lovable's heart logo |
| Replit | ⠕ (Braille dots-135) | Community-adopted symbol for Replit's three-dot prompt logo |
| V0 | ▽ (inverted triangle) | Evokes Vercel's triangle/delta logo |
| Base44 | ⬢ (black hexagon) | Evokes a modular building block |
| Emergent | e (lowercase letter) | Emergent brand initial |
| Firebase Studio | ✦ (four-pointed star) | Same as Gemini — Firebase Studio runs Gemini under the hood, with dark tangerine color theme |

These are standard Unicode characters, not proprietary artwork, so there are no trademark, copyright, or licensing concerns.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for platform-specific issues and solutions.

### Script not appearing?
- Make sure the userscript manager is enabled
- **Chrome users:** Enable **Developer Mode** in `chrome://extensions/`, then find Tampermonkey → Details → enable **"Allow User Scripts"**, then **relaunch Chrome**
- **Edge users:** Same as Chrome, but go to `edge://extensions/` instead. Enable **Developer Mode**, then find Tampermonkey → Details → enable **"Allow User Scripts"**, then **relaunch Edge**
- **Safari users:** Make sure you've granted Userscripts permission for the site (see [Safari Users: Permissions Setup](#safari-users-permissions-setup)). If you edited the script file externally, open the Userscripts extension popup once to reload changes.
- Try hard-refreshing the page (Ctrl+Shift+R / Cmd+Shift+R)

### Quick Fixes
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

- [x] ~~**Support AI app-builder platforms** — Lovable, Bolt.new, and Replit~~ (added in v7.0, expanded with V0, Base44, Emergent, Firebase Studio in v7.1)
- [x] ~~**Support Perplexity**~~ (added in v7.1)
- [ ] Search/filter questions
- [ ] Keyboard shortcuts
- [ ] Export conversation outline
- [ ] Settings panel
- [ ] Convert to standalone browser extension

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with the help of Claude (Anthropic) as a learning project to explore browser userscripts, DOM manipulation, and frontend JavaScript development.
