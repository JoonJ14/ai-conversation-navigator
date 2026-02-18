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
- Firebase Studio (`studio.firebase.google.com`) — Dark Tangerine theme, ✦ icon, standard button — added in v7.1

---

## Current Status: v8.0

The extension supports 14 platform variants across 12 websites. All platforms have been debugged on live sites (Firefox/Linux). All 140 automated tests pass (10 tests × 14 platforms).

**v8.0 Architecture: Platform Registry**

All platform-specific data is consolidated into a single `PLATFORMS` registry object. Adding a new platform requires only ONE entry in this registry (plus a `@match` URL). The old `SITE` enum, `detectSite()`, `THEME`, `ICONS`, `siteTitles`, `LEFT_CHAT_SITES`, `VIRTUAL_SCROLL_SITES`, `SPA_SITES`, and the 400-line `getUserMessages()` if/else chain have all been replaced.

**All platforms working:**
- Claude, ChatGPT, Codex, Grok, Gemini, Perplexity — selectors validated on live sites
- Lovable, Base44 — selectors working correctly on live sites
- Bolt.new — `data-message-id` + `self-end` pattern, excluding subscription warnings
- Replit (v7.6) — `data-cy="user-message"` from live DOM inspection
- V0 (v7.7) — `data-testid="message"` filtered by `origin-right` + `items-end` from live DOM inspection
- Emergent (v7.7) — `data-testid^="user-message"` with virtuoso-specific boundary detection, accumulative scanning, and scroll-through collection
- Firebase Studio (v7.8) — cross-origin iframe injection into correct workspace iframe (`/capra/` path discrimination), `[class*="_isUser_"]` CSS module selectors

**Documentation:**
- `DOM-REFERENCE.md` — real DOM structures of all 14 platforms with selector rationale, debugging history, and Firebase iframe architecture
- `CHANGELOG.md` — detailed technical changelog with root cause analysis for every fix
- `TROUBLESHOOTING.md` — platform-specific diagnostic guides including Firebase iframe injection

**Not yet tested:**
- Chrome/macOS — all debugging so far has been on Firefox/Linux (DGX Spark). May need follow-up if cross-browser issues arise.

---

## Future: General Feature Ideas

- [ ] Search/filter questions within the navigation panel
- [ ] Keyboard shortcuts for navigation
- [ ] Export conversation outline
- [ ] Settings panel for customization
- [ ] Convert to a standalone browser extension (beyond userscript)

---

*Last updated: 2026-02-18*
