# Roadmap

Future directions and ideas for AI Conversation Navigator.

This document tracks features and platform expansions we're considering but haven't started yet. It's meant to capture research, reasoning, and priorities so we (or contributors) can pick things up when the time is right.

---

## Supported Today

### AI Chatbots
- Claude (`claude.ai`)
- ChatGPT (`chatgpt.com`)
- Grok (`grok.com`)
- Gemini (`gemini.google.com`)

### Coding Agents (Web)
- Claude Code (`claude.ai/code`)
- Codex (`chatgpt.com/codex`)

---

## Future: AI App-Builder Platforms

AI-powered app-builder websites like Lovable, Bolt.new, and Replit all use a chat-based interface where users iteratively build apps through conversation. Their users run into the **exact same pain point** our script solves — long conversations with no way to jump back to a specific point.

None of these platforms have built-in conversation navigation. This is a real opportunity.

### Lovable (`lovable.dev`)

- **How it works:** Split-panel interface — chat on the left, live app preview on the right. Users describe what they want in natural language, the AI generates/modifies code, and the cycle repeats. Conversations get very long (10-30+ exchanges per project).
- **Models:** Wrapper around **Claude Opus** (primary) and **GPT-4 Mini** (preprocessing). No proprietary models. Originally called "GPT Engineer" before rebranding and switching to Claude.
- **Web or app:** 100% browser-based. No desktop or mobile app.
- **DOM accessibility:** Standard React + Tailwind CSS app. DOM is queryable. Not canvas-based. Tailwind utility classes make selectors less semantic but still workable — structural/positional selectors would be needed. Browser extensions already exist that manipulate Lovable's DOM, confirming feasibility.
- **Navigation pain point:** Has a version history panel for code checkpoints, but no in-conversation navigation. Users must scroll manually through the full chat.
- **Estimated difficulty:** Medium

### Bolt.new (`bolt.new`)

- **How it works:** Chat interface + code editor + live preview. Users prompt the AI to build web apps, iterate through conversation. Very similar interaction pattern to Lovable.
- **Models:** Wrapper around **Claude Sonnet 4.5 / Opus 4.6** (primary). Has also used GPT models. No proprietary models.
- **Web or app:** 100% browser-based.
- **DOM accessibility:** Built with Remix/React + Tailwind. Has recognizable CSS classes like `text-bolt-elements-textPrimary`. The open-source fork **bolt.diy** exposes the full component structure (`UserMessage.tsx`, `AssistantMessage.tsx`, `Messages.client.tsx`), making DOM research straightforward.
- **Navigation pain point:** Users have filed GitHub issues about chat history navigation. No built-in solution.
- **Estimated difficulty:** Easiest of the three — open-source fork means we can study exact DOM structure without DevTools.

### Replit (`replit.com`)

- **How it works:** Chat panel integrated into a full cloud IDE with file explorer, terminal, and live preview. The AI agent can create files, run commands, and install packages. Conversations are project-scoped.
- **Models:** Uses **Claude Sonnet** for its Agent feature, **Gemini** for design tasks, **GPT-4** for code review. Also has a small proprietary model (`replit-code-v1.5-3b`) but only for free-tier autocomplete — the agent itself runs on Claude.
- **Web or app:** Primarily browser-based. Has an Electron desktop app and mobile apps, but most users are on web.
- **DOM accessibility:** React + Redux app. CSS classes are **auto-generated at build time** (e.g., `.css-1p94a1z`) and change between deployments. Would need to rely on `data-*` attributes or ARIA roles instead of class names.
- **Navigation pain point:** Replit itself warns users "Large chats can affect performance. Start a new chat" — users complain about losing conversation history.
- **Estimated difficulty:** Medium-Hard — unstable CSS selectors are the main challenge.

### Implementation Priority

| Platform | Difficulty | User Base | Recommended Order |
|----------|-----------|-----------|-------------------|
| Bolt.new | Easiest | Large | 1st |
| Lovable | Medium | Large | 2nd |
| Replit | Medium-Hard | Very Large | 3rd |

### Key Technical Notes

- All three are standard web apps with queryable DOMs (none are canvas-based).
- All three use React, so `MutationObserver` will be needed to track dynamically rendered messages.
- The main challenge across all three is **non-semantic CSS selectors** (Tailwind utility classes or auto-generated hashes), unlike ChatGPT's clean `data-message-author-role="user"` attributes.
- Bolt.new has the easiest path because its open-source fork (bolt.diy) lets us study the component tree directly.

---

## Future: General Feature Ideas

- [ ] Search/filter questions within the navigation panel
- [ ] Keyboard shortcuts for navigation
- [ ] Export conversation outline
- [ ] Settings panel for customization
- [ ] Convert to a standalone browser extension (beyond userscript)

---

*Last updated: 2026-02-14*
