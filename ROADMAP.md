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

## Current Status: v7.6

The extension now supports 14 platform variants across 12 websites. The ghost notch button system (v7.1 → v7.3) is stable. v7.6 fixed Replit using live DOM inspection. All 140 automated tests pass (10 tests × 14 platforms).

**What's working well:**
- Claude, ChatGPT, Codex, Grok, Gemini, Perplexity, Firebase Studio — all selectors validated on live sites
- Lovable, Base44 — selectors working correctly on live sites
- Bolt.new — v7.5 reworked selectors to use `data-message-id` + `self-end` pattern, excluding the "You've used all your tokens" subscription warning
- Replit — v7.6 fixed using `data-cy="user-message"` from live DOM inspection. Both the 3x duplicate bug and ghost notch first-load bug are resolved.
- Ghost notch button positioning and boundary detection stable across all left-chat platforms

**What needs live testing and follow-up work:**
- Perplexity's `.group\/query` selector (Tailwind group variant) is stable but could change if Perplexity moves away from Tailwind.

---

## Next Priority: V0 and Emergent Selector Deep-Dive

Two platforms still have confirmed issues from live site testing. Each needs the same treatment Replit got: live DOM inspection → correct selectors → update mock test page.

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

## Upcoming: DOM-REFERENCE.md

After V0 and Emergent are fixed, create a `DOM-REFERENCE.md` file documenting the real DOM structure of ALL supported platforms. This prevents context loss across Claude Code sessions — no more re-inspecting the same DOMs. Include:
- Copy-pasted outerHTML for each platform's user message element + parent chain
- Screenshots in a `screenshots/` folder
- Which selector is used and why
- Edge cases to exclude (like Bolt's subscription warning)
- Date of last inspection

---

## Future: General Feature Ideas

- [ ] Search/filter questions within the navigation panel
- [ ] Keyboard shortcuts for navigation
- [ ] Export conversation outline
- [ ] Settings panel for customization
- [ ] Convert to a standalone browser extension (beyond userscript)

---

*Last updated: 2026-02-15*
