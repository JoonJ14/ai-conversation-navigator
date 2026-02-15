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
- Perplexity (`perplexity.ai`) — added in v7.1

### Coding Agents (Web)
- Claude Code (`claude.ai/code`)
- Codex (`chatgpt.com/codex`)

### AI App-Builder Platforms (added in v7.0, expanded in v7.1)
- Bolt.new (`bolt.new`) — Sky Blue theme, ⚡ icon, ghost notch
- Lovable (`lovable.dev`) — Violet theme, ♥ icon, ghost notch
- Replit (`replit.com`) — Orange theme, ⠕ icon, ghost notch
- V0 (`v0.app`) — White theme, ▽ icon, ghost notch — added in v7.1
- Base44 (`app.base44.com`) — Indigo theme, ⬢ icon, ghost notch — added in v7.1
- Emergent (`app.emergent.sh`) — Emerald theme, e icon, ghost notch — added in v7.1
- Firebase Studio (`studio.firebase.google.com`) — Dark Tangerine theme, ☄ icon, standard button — added in v7.1

**Note:** All app-builder platform selectors were developed using open-source forks, production extension analysis, and live site testing. Selectors may need tuning if platforms update their DOM structure. See CHANGELOG for per-platform selector details.

---

## Current Status: v7.3

The ghost notch button system for left-chat platforms has gone through three iterations (v7.1 → v7.2 → v7.3) to solve visibility issues on home/dashboard pages and boundary fluctuation bugs. The current v7.3 three-phase `updateLeftChatPositions()` architecture is stable. See CHANGELOG v7.3 and TROUBLESHOOTING for the full technical history.

**What still needs live testing:**
- Replit selectors are speculative (Emotion CSS-in-JS hash classes). The `data-testid` approach should work but needs live DOM validation. If Replit doesn't use `data-testid`, the fallback chain (ARIA roles, computed styles) activates.
- All left-chat platforms: the `_walkUpToChatContainer()` heuristic (`rect.left < 80`, width 200-65%, height > 40%) has been validated on Bolt, Lovable, and Emergent but not exhaustively on all viewport sizes.
- Perplexity's `.group\/query` selector (Tailwind group variant) is stable but could change if Perplexity moves away from Tailwind.

---

## Future: General Feature Ideas

- [ ] Search/filter questions within the navigation panel
- [ ] Keyboard shortcuts for navigation
- [ ] Export conversation outline
- [ ] Settings panel for customization
- [ ] Convert to a standalone browser extension (beyond userscript)

---

*Last updated: 2026-02-15*
