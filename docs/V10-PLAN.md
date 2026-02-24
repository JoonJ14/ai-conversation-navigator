# v10.1–10.7 Implementation Plan

Task list for the next development cycle. Each task has a dedicated spec document with full implementation details — this file is the index. Each task produces its own sub-version (v10.1 through v10.7) with independent documentation.

**Last updated:** 2026-02-23  
**Branch from:** v10.0 (current)  
**Target:** v10.7 (all features integrated)

---

## Tasks

### 0. Add `getAIMessages()`  *(v10.1)* selectors for all platforms (prerequisite)

Multiple features need to identify AI response elements in the DOM. Add `getAIMessages()` to each PLATFORMS entry following the same fallback-chain pattern as `getUserMessages()`. Live-verify selectors on all 5 orbital platforms first (Claude, ChatGPT, Grok, Gemini, Perplexity), then IDE platforms. Add global `_aiResponses` array and `getAllMessagesOrdered()` utility for conversation-order access. Research starting points are documented in the spec — every selector must be verified on the live platform before committing.

**Spec:** `docs/GET-AI-MESSAGES.md`  
**Requires:** Nothing (this IS the prerequisite)  
**Blocks:** Tasks #1, #3, #4, #5, #6

---

### 1. Fix context window monitor  *(v10.3)*

The context bar currently undercounts by 15–20× due to scroll-container walk-up failures and invisible token overhead. Replace with a two-tier system: exact SSE token interception for Claude, adaptive turn counter with weighted-average compaction prediction for all other platforms. Add universal degradation warnings when multiple compactions are detected.

**Spec:** `docs/CONTEXT-TRACKING.md`  
**Requires:** Task #0 (`getAIMessages()` for DOM estimation path)

---

### 2. Fix hover zone blocking platform UI  *(v10.2)*

The orbital sidebar's hover detection zone spans 160px × full screen height, blocking platform buttons across the entire right edge (Claude artifact X, Grok "Private" toggle, Gemini profile icon, etc.). Shrink the hitzone to cover only the actual button cluster area, add dot-level mouseleave handlers as safety net.

**Spec:** `docs/HOVER-ZONE-FIX.md`

---

### 3. Implement real bookmarks  *(v10.5)* (replace placeholder)

The Bookmarks panel currently shows 3 hardcoded fake entries. Replace with working bookmarks: inject hover-triggered bookmark icons directly onto user and AI messages in the platform DOM. Users click to pin, bookmarks persist via `GM_setValue`, panel shows real bookmarks with scroll-to navigation. Phase 2 adds sub-entity bookmarks on code blocks and file downloads within AI responses.

**Spec:** `docs/BOOKMARKS.md`  
**Requires:** Task #0 (`getAIMessages()` for AI message icon injection)

---

### 4. Extend search to include AI responses  *(v10.5)*

Search currently only looks through `_questions` (user messages). AI responses — where most important information lives (technical terms, code, explanations, file outputs) — are invisible to search. Add `_aiResponses` array populated from `getAIMessages()`, search both arrays, display results with "Q#" / "A#" labels in conversation order, and generalize scroll-to to work on any message type.

**Spec:** `docs/SEARCH-ENHANCEMENT.md`  
**Requires:** Task #0 (`getAIMessages()` for AI response indexing)

---

### 5. Implement real summary  *(v10.6)* (replace placeholder)

The Summary panel currently shows hardcoded fake topics and a non-functional Generate button. Replace with working heuristic extraction: a conversation map timeline showing topic segments with entity markers (images, code blocks, files), topic detection via word frequency and bigram analysis, key point detection via signal phrase pattern matching (decisions, findings, action items), conversation stats, and code/file inventory. Segment heights are proportional to message count, everything is clickable for navigation. Pure JavaScript, no AI, no API keys. Includes honest disclaimer on the Generate button pointing users to "just ask the AI" for a real summary.

**Spec:** `docs/SUMMARY.md`  
**Requires:** Task #0 (`getAIMessages()` for AI response analysis)

---

### 6. Rename Export to Tools  *(v10.7)*, implement utility panel

Rename the "Export" orbital feature to "Tools" (🔧) — a utility drawer with an Image Gallery, export functions, and /Commands. Image Gallery shows thumbnail grid of all uploaded images with click-to-navigate and download. Three exports: Full Conversation (MD), Bookmarks Only (MD, depends on task #3), Summary (MD, depends on task #5). /Commands: user-created reusable prompts saved via GM_setValue, accessible from Tools panel and a floating palette (Ctrl+/ keyboard shortcut). Also adds 🖼️ indicator to questions with attached images in Navigate panel. Panel designed with extensible architecture for future community-requested tools.

**Spec:** `docs/TOOLS.md`, `docs/COMMANDS.md`  
**Requires:** Task #0 (`getAIMessages()`). Partial dependency on Task #3 (Bookmarks export) and Task #5 (Summary export), but Full Conversation and Code Blocks exports work independently.

---

### 7. Settings panel upgrade  *(v10.4)*

Make platform toggles functional with persistent `GM_setValue` storage and three lockout prevention safeguards: can't disable current platform (🔒), must keep at least one enabled, changes require page refresh. Add language selector with i18n string table — English and Korean at launch, all UI labels translated via `i18n()` function. Content analysis (topics, key points) stays English-only for v10.1 with honest disclaimer for non-English users. Update About section with dynamic version and GitHub link. Add confirm dialog to Reset button.

**Spec:** `docs/SETTINGS.md`  
**Requires:** None (can be implemented in parallel with other tasks)

---

### 8. Claude plan usage tracker  *(v10.3)* (Claude-only)

Display the user's Claude plan usage (session limit, weekly limits, extra usage) as bars below the context window monitor. Fetches data from `claude.ai/settings/usage` page, parses the embedded usage JSON (RSC payload), and renders matching bar UI. Three bars: Current Session (5-hour reset), Weekly All Models (7-day reset), Weekly Sonnet (7-day reset). Polling interval ~5 minutes to avoid unnecessary requests. Claude-only feature — hidden on all other platforms.

**Spec:** `docs/PLAN-USAGE.md`  
**Requires:** None (self-contained, Claude-only)

---

## Workflow

This plan is implemented using Claude Code multi-agent parallelization with per-feature versioning. See `AGENT-PLAN.md` for the full orchestration strategy:

- **Phase 0** (1 agent): Task #0 → produces **v10.1**
- **Phase 1** (6 agents parallel): Groups A(#2), B(#1+#8), C(#7), D(#3+#4), E1(#5), E2(#6)
- **Phase 2** (1 agent): Merge sequentially → **v10.2** through **v10.7** (one commit per version)
- **Phase 3** (1 agent): Run all testing checklists, finalize CHANGELOG.md

Each agent documents their changes during development (reasoning-flow format). Phase 2 stitches changelogs into unified CHANGELOG.md.

## Spec Documents

| Version | Task | Spec file |
|---------|------|-----------|
| v10.1 | #0 getAIMessages + foundation | `docs/GET-AI-MESSAGES.md` |
| v10.2 | #2 Hover zone fix | `docs/HOVER-ZONE-FIX.md` |
| v10.3 | #1 Context tracking | `docs/CONTEXT-TRACKING.md` |
| v10.3 | #8 Plan usage tracker | `docs/PLAN-USAGE.md` |
| v10.4 | #7 Settings | `docs/SETTINGS.md` |
| v10.5 | #3 Bookmarks | `docs/BOOKMARKS.md` |
| v10.5 | #4 Search enhancement | `docs/SEARCH-ENHANCEMENT.md` |
| v10.6 | #5 Summary | `docs/SUMMARY.md` |
| v10.7 | #6 Tools | `docs/TOOLS.md`, `docs/COMMANDS.md` |
| — | Orchestration | `docs/AGENT-PLAN.md` |

---

*Add new tasks as numbered entries with a one-paragraph summary and a pointer to their spec doc.*
