# Claude Code Task: Orbital Button System Implementation (v10.0)

## Context

This is the AI Conversation Navigator — a Tampermonkey userscript that adds navigation sidebars to AI chat platforms (Claude, ChatGPT, Grok, Gemini, Claude Code web, Codex, Perplexity, and app builder sites like Bolt.new, Lovable, Replit).

The codebase has gone through recent changes by another AI assistant (Gemini) that added two new buttons (a context/token tracking button and another feature button). During that work, architectural changes were introduced that broke button rendering on app builder sites — a bug that may or may not be fully resolved yet. There has been extensive debugging, which means the code may contain:
- Redundant guards or checks added during debugging
- Commented-out code or dead code paths
- Architectural changes that rippled beyond their intended scope
- Inconsistent patterns between old code and newly added code

**The goal is NOT to patch on top of this. The goal is to replace the entire button system with a new orbital design, cleanly.**

---

## Phase 0: Audit the Current Codebase

Before writing ANY new code, read and understand the full codebase.

**Repository**: github.com/joonj14/ai-conversation-navigator

### What to examine:
1. **Entry point and initialization flow**: How does the script detect which platform it's on? How does it decide when to inject UI elements?
2. **Button injection**: How are buttons currently created and injected into the DOM? What guards exist against duplicate injection?
3. **MutationObserver setup**: What does it observe? What callbacks does it trigger? Are there race conditions?
4. **Platform-specific logic**: How does the script handle different platforms? Are there separate code paths or a unified approach?
5. **Question detection engine**: How does it find user questions in the conversation? This is CORE functionality we want to KEEP.
6. **The recent Gemini changes**: Look for recently added button code (context/token tracking button). Understand what architectural changes were made and whether they affected the injection flow for other platforms.
7. **DOM selectors**: What CSS selectors does each platform use? Are these up to date?

### What to report before proceeding:
- List the core modules/functions and what they do
- Identify what should be KEPT (question detection, platform selectors, MutationObserver core)
- Identify what should be REMOVED (old button UI, old sidebar, context indicator button, any debugging artifacts)
- Flag any architectural concerns (race conditions, duplicate injection risks, dead code)
- Note if the recent debugging left the code in a messy state that needs cleanup

**Wait for my approval before proceeding to Phase 1.**

---

## Phase 1: Clean Foundation

Strip the codebase down to its healthy core. Remove all existing button/sidebar UI code and the recent context button additions. Keep:

### KEEP (core engine):
- Platform detection logic (URL matching, platform-specific selectors)
- Question/message detection engine (the algorithm that finds user questions)
- MutationObserver setup (but review for race conditions)
- Duplicate injection guards (but simplify if over-engineered from debugging)
- GM_storage / settings persistence
- CHANGELOG.md, README.md structure

### REMOVE (replacing with orbital system):
- All existing button creation code (the old Navigate button, the context/token button)
- All existing sidebar/panel HTML and CSS
- Any button positioning logic
- Any per-platform button injection quirks that were added during debugging
- Dead code, commented-out experiments, debugging artifacts

### REFACTOR if needed:
- If the recent changes tangled button injection with question detection, separate them
- If MutationObserver callbacks directly create buttons, decouple them (observer should detect messages, a separate renderer should handle UI)
- Ensure the initialization flow is clean: detect platform → wait for DOM ready → inject UI → start observing

**The result of Phase 1 should be a working script that detects platforms and finds questions, but has NO UI. This is our clean foundation.**

### Critical Architecture Note: Platform Abstraction Layer

The orbital buttons and panel UI are platform-agnostic (fixed CSS overlay). But the FEATURES inside panels depend on reading conversation messages from each platform's DOM, and every platform structures its messages differently.

**All platform-dependent logic must go through a single abstraction layer:**

```javascript
// Every platform must implement these functions:
getPlatformAdapter(platform) → {
  getMessages()      → [{ element, text, role, index }]
  scrollToMessage(index)
  getCodeBlocks()    → [{ element, language, text }]
  getLinks()         → [{ element, href, text }]
  isStreaming()      → boolean
}
```

This is critical because Navigate, Search, Bookmarks, Summary, and Export ALL depend on message detection. If the abstraction layer works for a platform, all features work. If it breaks, all break. There should be ZERO direct DOM queries in feature code — everything goes through the adapter.

For platforms where selectors aren't yet verified (Claude Code web, Codex, Perplexity), the adapter should gracefully degrade — show "Platform not fully supported yet" in panels rather than crashing. Features should never assume messages will be found.

---

## Phase 2: Implement Orbital Button System

Now build the new UI on top of the clean foundation.

### Reference files:
- **ORBITAL-BUTTON-SPEC.md**: Full technical specification with architecture, slot rules, math, and design decisions
- **orbital-v11-reference.html**: Working interactive prototype — open it in a browser to see exactly how it should look and feel

### Implementation approach:

**Read ORBITAL-BUTTON-SPEC.md thoroughly before writing code.** It contains:
- The feature registry pattern (single array drives everything)
- Three display modes (Show All, Arc, Wheel) with exact slot rule lookup tables
- CSS transition split (80ms opacity vs 300ms position) — this is critical for the feel
- Arc auto-polygon geometry (scales automatically with feature count)
- Wheel conveyor belt wrapping (staging, reflow, symmetric boundary)
- Color rules: ALL buttons use unified `#d97706` in ALL modes
- Hover-exit reset behavior
- Panel slide-in mechanics

**Open orbital-v11-reference.html in a browser and interact with it.** Hover, scroll through all three modes, open panels, test hover-exit. This is what the final result should feel like.

### Key implementation rules:

1. **Slot-based lookup tables drive ALL appearance.** Never hardcode per-button styles. Adding a 7th feature should require only adding one entry to the features array and creating its panel.

2. **Unified color: `#d97706` for ALL buttons in ALL modes.** The gradient colors in the features array exist for potential future platform theming but are NOT used during rendering. Opacity is the only brightness variable.

3. **CSS transitions must be split.** Position/size at 300ms, opacity at 80ms. This makes brightness feel anchored to position, not to the moving button. Without this, the whole system feels wrong.

4. **The orbital zone must not conflict with platform UI.** Inject as a fixed-position element. Consider Shadow DOM for CSS isolation. Test that it doesn't break Claude's sidebar, ChatGPT's panel, etc.

5. **Question detection feeds into the Navigate panel.** The existing detection engine provides data; the orbital Navigate panel displays it. Don't duplicate detection logic.

6. **Guard against duplicate injection.** Especially on Linux Firefox where MutationObserver fires synchronously. Use both a flag AND a DOM check.

7. **Platform themes are future work.** For now, use Claude's orange theme everywhere. The spec mentions per-platform themes — that's a later task. Get the system working first.

### Panel implementation priority:

For the initial implementation, panels can have placeholder content except for Navigate (which should actually list detected questions). Priority order:

1. **Navigate**: Fully functional — show detected questions, click to scroll to them
2. **Search**: Functional — filter the question list by search input
3. **Settings**: Functional — mode selector, scroll direction, basic toggles
4. **Bookmarks**: Placeholder with sample data
5. **Summary**: Placeholder with "Generate Summary" button (non-functional)
6. **Export**: Placeholder showing format options (non-functional)

---

## Phase 3: Test Across Platforms

After implementation, verify on each platform:

### Must work:
- [ ] Claude (claude.ai) — primary platform
- [ ] ChatGPT (chatgpt.com)
- [ ] Grok (grok.com or x.com/grok)
- [ ] Gemini (gemini.google.com)
- [ ] Claude Code web (claude.ai/code or similar)
- [ ] Codex (chatgpt.com/codex or similar — OpenAI's coding agent)
- [ ] Perplexity (perplexity.ai)

### Should work (verify selectors first):
- [ ] Bolt.new
- [ ] Lovable
- [ ] Replit

### Test matrix:
- [ ] Show All mode: all buttons equal brightness, hover shows/hides
- [ ] Arc mode: polygon visible, scroll rotates focus, brightness follows position
- [ ] Wheel mode: smooth scrolling, symmetric wrapping, Navigate boost visible
- [ ] Panel open/close on each platform
- [ ] No duplicate buttons on SPA navigation
- [ ] No interference with platform's own sidebar/panels
- [ ] Hover-exit resets to Navigate

---

## Important Notes

- The orbital system is a COMPLETE REPLACEMENT of the existing button UI, not an addition to it
- The old context/token tracking button is being removed — its functionality will eventually live inside the Navigate panel's context bar, but that's future work
- If you find the codebase is too tangled to cleanly separate core engine from UI, it may be better to restructure the whole file rather than try to surgically extract pieces
- When in doubt about visual behavior, refer to orbital-v11-reference.html — it is the source of truth
- The owner tests on both Mac (Chrome/Firefox) and an NVIDIA DGX Spark running Ubuntu (Firefox). If you see rendering glitches on Linux, check if it's a resource issue before debugging code
