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

## Current Status: v7.5

The extension now supports 14 platform variants across 12 websites. The ghost notch button system (v7.1 → v7.3) is stable, and v7.4/v7.5 focused on improving selector accuracy through live site testing. All 140 automated tests pass (10 tests × 14 platforms).

**What's working well:**
- Claude, ChatGPT, Codex, Grok, Gemini, Perplexity, Firebase Studio — all selectors validated on live sites
- Lovable, Base44 — selectors working correctly on live sites
- Bolt.new — v7.5 reworked selectors to use `data-message-id` + `self-end` pattern, excluding the "You've used all your tokens" subscription warning
- Ghost notch button positioning and boundary detection stable across all left-chat platforms

**What needs live testing and follow-up work:**
- Perplexity's `.group\/query` selector (Tailwind group variant) is stable but could change if Perplexity moves away from Tailwind.

---

## Next Priority: Platform Selector Deep-Dive

These three platforms have confirmed issues from live site testing that need dedicated attention. A separate feature branch should be created for each to do focused live DOM inspection and selector iteration.

### Replit — Question Deduplication (3x repeats)
- **Issue:** Each question appears 3 times in the navigation panel
- **Current state:** Nesting dedup + text-content dedup applied as mitigation, but root cause unknown
- **What's needed:** Live DOM inspection to understand why 3 elements match per question
- **Possible causes:** `data-testid*="user-message"` matching siblings, primary selector miss causing fallback 3x match, or Emotion CSS-in-JS class changes
- **See:** TROUBLESHOOTING.md → "Replit — Questions repeating 3 times"

### V0 — No Questions Detected
- **Issue:** "0 questions found" despite multiple questions asked
- **Current state:** 6+ data-attribute selectors and 5 structural fallbacks all return 0
- **What's needed:** Live DOM inspection to discover V0's actual element structure
- **Likely cause:** V0's Geist design system uses completely different patterns than assumed
- **See:** TROUBLESHOOTING.md → "V0 — No questions detected"

### Emergent — Button Visibility + Panel Spacing
- **Issue 1:** Ghost notch button invisible until hover (even after opacity increase to 0.75)
- **Issue 2:** Panel expanding with unexpected spacing/gap
- **Current state:** Opacity and width increased, scrollbar offset applied, but may need design rethink
- **What's needed:** Live testing to validate opacity, diagnose panel spacing, consider alternative button design
- **See:** TROUBLESHOOTING.md → "Emergent — Button invisible until hover"

---

## Future: General Feature Ideas

- [ ] Search/filter questions within the navigation panel
- [ ] Keyboard shortcuts for navigation
- [ ] Export conversation outline
- [ ] Settings panel for customization
- [ ] Convert to a standalone browser extension (beyond userscript)

---

*Last updated: 2026-02-15*
