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

## Current Status: v10.0

The extension supports 14 platform variants across 12 websites. v10.0 is a complete architectural rewrite — a new orbital button system replaces the previous floating button/sidebar UI.

**v10.0 Accomplishments:**
- **Orbital Button System:** Six feature dots (Navigate ✳, Search ⌕, Bookmarks ⚑, Summary Σ, Export ↗, Settings ⚙) in three display modes — show-all, arc, wheel. Scroll wheel rotates arc/wheel focus. Settings persist to localStorage.
- **Dual-System Architecture:** Orbital UI for the 5 primary AI platforms (Claude, ChatGPT, Grok, Gemini, Perplexity). Legacy ghost-notch button for the 7 app-builder platforms.
- **Live Testing Fixes:** isLeftChat button-panel sync across 4 code sites; Bolt.new scrollbarOffset open-state bug; V0 light mode visibility (textColor + toggleBorder); arc mode labels below dot via `data-acn-mode` CSS; panel z-index above orbital dots.
- **Context Window Bar:** DOM walk to scroll container reads full conversation (user + AI) text; CTX_LIMITS per platform; green/amber/red color coding.
- **Font Unification:** `system-ui` stack set on `.acn-zone` root; all children inherit consistently across all 14 platforms.
- **Contract-Based Tests:** `data-acn-role` / `data-acn-*` attributes are the stable test interface — 14 platforms × 12 tests = 168 total. Tests survive complete UI rewrites as long as the 9 contract attributes are maintained.
- **Full CI Matrix:** GitHub Actions runs Playwright across 3 OSes (ubuntu, macos, windows) × 3 browsers (chromium, firefox, webkit) = 9 checks on every PR.

**v9.4 - v9.6 Accomplishments (historical):**
- **Universal Search (v9.4):** High-performance keyword search across 14 platforms using DOM `TreeWalker`.
- **Trusted Types Security (v9.6):** Refactored UI engine for strict Content Security Policy compliance.
- **Left-Chat Synchronization (v9.6):** Solved panel animation desync for Bolt.new, Lovable, Replit, and V0.

**v8.0 Architecture: Platform Registry**
All platform-specific data is consolidated into a single `PLATFORMS` registry. Adding a new platform requires only one entry in the registry (plus a `@match` URL).

**All platforms working:**
- Claude, ChatGPT, Codex, Grok, Gemini, Perplexity — selectors validated on live sites
- Lovable, Base44 — selectors working correctly on live sites
- Bolt.new — `data-message-id` + `self-end` pattern, excluding subscription warnings
- Replit — `data-cy="user-message"` with homepage guard (skip non-project pages)
- V0 — `data-testid="message"` filtered by `origin-right` + `items-end`
- Emergent — `data-testid^="user-message"` with virtuoso-specific boundary detection and accumulative scanning
- Firebase Studio — cross-origin iframe injection into workspace iframe (`/capra/` path discrimination), `[class*="_isUser_"]` CSS module selectors

**Documentation:**
- `DOM-REFERENCE.md` — real DOM structures of all 14 platforms with selector rationale and debugging history
- `CHANGELOG.md` — detailed technical changelog with root cause analysis for every fix
- `TROUBLESHOOTING.md` — platform-specific diagnostic guides
- `DECISIONS.md` — architectural decision log (DEC-001 through DEC-009)

---

## Future: General Feature Ideas

- [ ] Keyboard shortcuts for navigation
- [ ] Export conversation outline (stub panel exists in v10.0)
- [ ] Bookmarks panel (stub panel exists in v10.0)
- [ ] Conversation summary panel (stub panel exists in v10.0)
- [ ] Per-platform accent colors for app-builder platforms
- [ ] Convert to a standalone browser extension (beyond userscript)

---

*Last updated: 2026-02-22*

