# v10.1–10.7 Agent Parallelization Plan

Strategy for using Claude Code multi-agent workflow to implement v10.x features efficiently without merge conflicts or broken logic. Each feature gets its own sub-version (v10.1 through v10.7), documented independently by the agent that builds it, then merged sequentially.

**Last updated:** 2026-02-23  
**For use with:** Claude Code agent teams

---

## The Core Problem

Everything lives in ONE file: `ai-conversation-navigator.user.js` (2,377 lines). If multiple agents edit the same file simultaneously, merge conflicts corrupt the codebase. We need a strategy that maximizes parallelism while preventing collisions.

---

## Versioning Strategy

Instead of one monolithic v10.1 release, each feature gets its own version number. This keeps agent context windows focused, makes debugging traceable, and produces documentation while context is fresh — not after the fact when details are lost.

| Version | Task | Agent | Integration order |
|---------|------|-------|-------------------|
| v10.1 | #0 Foundation (getAIMessages, i18n, settings storage) | Phase 0 | 1st |
| v10.2 | #2 Hover zone fix | Group A | 2nd |
| v10.3 | #1 + #8 Context tracking + Plan usage | Group B | 3rd |
| v10.4 | #7 Settings + i18n panel | Group C | 4th |
| v10.5 | #3 + #4 Bookmarks + Search | Group D | 5th |
| v10.6 | #5 Summary | Group E1 | 6th |
| v10.7 | #6 Tools + Gallery | Group E2 | 7th |

Version numbers reflect **integration order** (simplest/most independent first), not development order. All Phase 1 agents develop in parallel, but Phase 2 merges them sequentially, producing a versioned git commit and changelog entry for each.

### Why this order?

1. **v10.1 Foundation** — everything depends on it
2. **v10.2 Hover zone** — simplest, zero dependencies, validates the merge process works
3. **v10.3 Context + usage** — new sections only (SSE interceptor, usage bars), low conflict risk
4. **v10.4 Settings** — self-contained panel, but i18n strings are now available for remaining merges
5. **v10.5 Bookmarks + Search** — establishes bookmark storage format before v10.7 exports need it
6. **v10.6 Summary** — establishes `generateFullSummary()` before v10.7 export needs it
7. **v10.7 Tools** — last because it depends on v10.5 (bookmark export) and v10.6 (summary export)

### Per-agent documentation

Each agent writes a changelog + troubleshooting doc during development using the project's reasoning-flow format: **problem → technical root cause → method chosen + why → how it fixed**. This documentation is written DURING development, not reconstructed after. The module file includes a `CHANGELOG` section at the top.

```
## v10.X Changelog

### Added
- Feature description

### Changed
- What was modified and why

### Troubleshooting Log
- **Problem:** [description]
  **Root cause:** [technical explanation]
  **Method:** [approach chosen + why]
  **Resolution:** [how it fixed]
```

Phase 2 integration agent stitches all changelogs into a unified CHANGELOG.md ordered v10.1 → v10.7.

---

## Dependency Graph

```
                    ┌─────────────────────────────┐
                    │  Phase 0: FOUNDATION         │
                    │  (1 agent, sequential)        │
                    │                               │
                    │  #0 getAIMessages()           │
                    │  + i18n() infrastructure      │
                    │  + Settings storage functions  │
                    └──────────────┬────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
              ▼                    ▼                     ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │ Phase 1: GROUP A  │ │ Phase 1: GROUP B  │ │ Phase 1: GROUP C  │
   │ (1 agent)         │ │ (1 agent)         │ │ (1 agent)         │
   │                   │ │                   │ │                   │
   │ #2 Hover zone fix │ │ #1 Context track  │ │ #7 Settings panel │
   │                   │ │ + Claude SSE      │ │ + platform toggles│
   │ (independent)     │ │ #8 Plan usage     │ │ + i18n panel      │
   └────────┬──────────┘ └────────┬──────────┘ └────────┬──────────┘
            │                     │                      │
            │   ┌─────────────────┼──────────────────┐   │
            │   │                 │                   │   │
            │   ▼                 │                   ▼   │
            │ ┌──────────────────┐│ ┌──────────────────┐  │
            │ │ Phase 1: GROUP D  ││ │ Phase 1: GROUP E1 │ │
            │ │ (1 agent)         ││ │ (1 agent)         │ │
            │ │                   ││ │                   │ │
            │ │ #3 Bookmarks      ││ │ #5 Summary        │ │
            │ │ #4 Search         ││ │ (map, topics,     │ │
            │ │                   ││ │  key points, stats)│ │
            │ │ (both need #0)    ││ │                   │ │
            │ └────────┬──────────┘│ └────────┬──────────┘ │
            │          │           │          │            │
            │          │           │ ┌────────▼──────────┐ │
            │          │           │ │ Phase 1: GROUP E2  │ │
            │          │           │ │ (1 agent)         │ │
            │          │           │ │                   │ │
            │          │           │ │ #6 Tools + Gallery│ │
            │          │           │ │ + Navigate 🖼️     │ │
            │          │           │ │                   │ │
            │          │           │ └────────┬──────────┘ │
            │          │           │          │            │
            └──────────┼───────────┼──────────┼────────────┘
                       │           │          │
                       ▼           ▼          ▼
              ┌─────────────────────────────────────────┐
              │  Phase 2: INTEGRATION                    │
              │  (1 agent, sequential)                   │
              │                                          │
              │  Merge all modules into main file        │
              │  Wire cross-feature dependencies         │
              │  i18n string replacement pass            │
              │  CSS consolidation                       │
              └──────────────┬──────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────────────────┐
              │  Phase 3: TESTING                        │
              │  (1 agent)                               │
              │                                          │
              │  Run all spec checklists                 │
              │  Cross-feature integration tests         │
              │  Browser compatibility spot-checks       │
              └─────────────────────────────────────────┘
```

---

## Why This Grouping

### Phase 0 must be first (no exceptions)

Task #0 (`getAIMessages`) is the prerequisite for 5 of the 7 other tasks. The i18n infrastructure and settings storage are needed by multiple agents too. Without Phase 0, agents would each implement their own incompatible versions of these shared functions.

Phase 0 also establishes the **interfaces** that all other agents code against:
- `getAIMessages()` → returns NodeList/Array of AI message elements
- `_aiResponses` → global array parallel to `_questions`
- `getAllMessagesOrdered()` → interleaved conversation-order array
- `i18n(key, replacements)` → returns translated string
- `loadSettings()` / `saveSettings()` → GM_setValue persistence
- `showToast(message)` → notification function

### Phase 1 groups are conflict-free

Each group edits **different sections** of the codebase:

| Group | File sections touched | Line ranges (approx) |
|-------|----------------------|---------------------|
| A: #2 Hover zone | `orbBuildZone()`, zone CSS | 1941-2055, CSS block |
| B: #1+#8 Context tracking + Plan usage | Context bar section, NEW SSE interceptor section, NEW usage fetcher/bars | 2090-2365, new sections |
| C: #7 Settings | `orbBuildPanelSettings()`, init guard | 1852-1937, top of file |
| D: #3+#4 Bookmarks+Search | `orbBuildPanelBookmarks()`, `orbBuildPanelSearch()`, `orbPopulateSearch()` | 1739-1794, 1617-1677 |
| E1: #5 Summary | `orbBuildPanelSummary()` | 1795-1830 |
| E2: #6 Tools+Gallery | `orbBuildPanelExport()` → `orbBuildPanelTools()`, `orbPopulateNavigate()` (🖼️), `ORB_FEATURES` | 1831-1851, 1473-1616, 914-921 |

**Zero overlap in panel functions.** The only shared touch point is CSS (all groups add styles), which is handled by having each agent write CSS to their module file and consolidating in Phase 2.

### Why #3 + #4 are grouped together

- Both depend on `_aiResponses` from Task #0
- Search needs to search through bookmarked content labels
- Both involve DOM injection patterns (bookmark icons on messages, search highlighting)
- Both panels are adjacent in the codebase
- One agent can ensure consistent Q#/A# labeling between bookmarks and search

### Why #5 and #6 are split into E1 and E2

Originally grouped together because Tools Export Summary calls Summary's `generateFullSummary()`. But this is a single function call — the Phase 2 integration agent wires it. The actual code they touch is separate:

- **E1 (Summary):** `orbBuildPanelSummary()` — conversation map, topic extraction, bigrams, key points, stats, code/file inventory. Entirely self-contained.
- **E2 (Tools):** `orbBuildPanelTools()`, Image Gallery, three exports, `isContentImage()` filter, Navigate 🖼️ indicator. Also self-contained.

E2's "Export Summary" button calls `generateFullSummary()` which E1 defines. During Phase 1, E2 stubs this call. Phase 2 wires it to E1's real function. If Summary isn't ready yet, the export button shows "Summary not available" gracefully.

### Why #7 is isolated

Settings is self-contained. It reads/writes its own storage, builds its own panel, and its only cross-cutting concern (i18n) is handled by Phase 0's infrastructure. The agent just uses `i18n()` calls from the start.

---

## Module File Strategy

To avoid merge conflicts, **Phase 1 agents do NOT edit the main file directly.** Instead:

### Each agent writes to a separate module file:

```
/home/claude/modules/
├── phase0-foundation.js       ← Phase 0 output (applied to main file)
├── groupA-hover-zone.js       ← Group A: replacement functions + CSS
├── groupB-context-tracking.js ← Group B: new SSE section + context bar rewrite + usage bars
├── groupC-settings.js         ← Group C: settings panel rewrite + init guard
├── groupD-bookmarks-search.js ← Group D: bookmarks + search panels + DOM injection
├── groupE1-summary.js         ← Group E1: summary panel + all extraction functions
├── groupE2-tools-gallery.js   ← Group E2: tools panel + image gallery + exports + Navigate 🖼️
└── integration-notes.md       ← Each agent documents merge instructions
```

### Module file format:

Each module file contains:
1. **CHANGELOG** — version changelog and troubleshooting log (reasoning-flow format)
2. **REPLACE blocks** — clearly marked old→new function replacements
3. **INSERT blocks** — new code with explicit insertion points (before/after which function)
4. **CSS additions** — new styles to append to the CSS block
5. **Dependencies** — what this module expects to exist (from Phase 0 or other modules)
6. **Integration notes** — any cross-wiring the integration agent needs to do

```javascript
// ============================================================
// MODULE: Group D — Bookmarks + Search
// VERSION: v10.5
// DEPENDS ON: Phase 0 (getAIMessages, _aiResponses, i18n, showToast)
// REPLACES: orbBuildPanelBookmarks(), orbBuildPanelSearch(), orbPopulateSearch()
// INSERTS: bookmark DOM injection system (after observer setup)
// CSS: append .acn-bm-* and .acn-search-* styles
// ============================================================

/*
## v10.5 Changelog

### Added
- Working bookmarks with GM_setValue persistence
- Hover-triggered bookmark icons on user and AI messages
- Search through AI responses with Q#/A# labels
- Highlight flash animation on scroll-to

### Changed
- orbPopulateSearch() now searches _aiResponses alongside _questions
- Search results sorted by DOM position (conversation order)

### Troubleshooting Log
- **Problem:** Bookmark icons appearing twice on Claude
  **Root cause:** MutationObserver firing during initial DOM setup
  **Method:** Added data-acn-bookmarked attribute guard
  **Resolution:** Check for attribute before injecting icon
*/

// --- REPLACE: orbBuildPanelBookmarks ---
function orbBuildPanelBookmarks() {
    // ... full new implementation using i18n() ...
}
```

---

## Phase 0: Foundation — Detailed Instructions

**Agent count:** 1  
**Input:** Current `ai-conversation-navigator.user.js` + specs: `GET-AI-MESSAGES.md`, `SETTINGS.md`  
**Output:** Updated main file with foundation in place

### Tasks:

1. **Add `getAIMessages()` to all 5 orbital PLATFORMS entries**
   - Follow fallback-chain pattern from `GET-AI-MESSAGES.md` spec
   - Add to: claude, chatgpt, grok, gemini, perplexity
   - IDE platforms can use placeholder `getAIMessages: function() { return []; }`

2. **Add global wrapper and array**
   ```javascript
   var _aiResponses = [];
   
   function getAIMessages() {
       if (platform.getAIMessages) return platform.getAIMessages();
       return [];
   }
   
   function getAllMessagesOrdered() { /* from spec */ }
   ```

3. **Wire `_aiResponses` into the observer**
   - Populate alongside `_questions` in the MutationObserver/polling callback

4. **Add i18n infrastructure**
   ```javascript
   var I18N = { en: { /* all strings */ }, ko: { /* all strings */ } };
   function i18n(key, replacements) { /* from SETTINGS.md spec */ }
   ```

5. **Add settings storage**
   ```javascript
   var DEFAULT_SETTINGS = { /* from SETTINGS.md spec */ };
   function loadSettings() { /* from spec */ }
   function saveSettings(settings) { /* from spec */ }
   ```

6. **Add `shouldRunOnThisPlatform()` early exit**
   - At top of script, before any DOM injection

7. **Add `showToast()` utility** (used by multiple features)

8. **Add `ACN_VERSION` constant** set to `'10.1'`

### Verification:
- `getAIMessages()` returns elements on Claude (at minimum)
- `i18n('navigate')` returns 'Navigate' (English default)
- `i18n('navigate')` returns '탐색' when language setting is 'ko'
- `loadSettings()` returns merged defaults
- `showToast('test')` shows and fades

---

## Phase 1: Parallel Features — Detailed Instructions

**Agent count:** Up to 6 (one per group)  
**Input:** Updated main file from Phase 0 + relevant spec docs  
**Output:** Module files in `/home/claude/modules/`

### Group A: Hover Zone Fix (1 agent)

**Reads:** `HOVER-ZONE-FIX.md`  
**Writes to:** `groupA-hover-zone.js`  
**Edits:** `orbBuildZone()` function, zone CSS  
**Touches nothing else.** Smallest task — should complete fastest.

### Group B: Context Tracking + Claude SSE + Plan Usage (1 agent)

**Reads:** `CONTEXT-TRACKING.md`, `PLAN-USAGE.md`  
**Writes to:** `groupB-context-tracking.js`  
**Edits:** Context bar rendering section, adds NEW `setupClaudeSSEInterceptor()` section, adds NEW plan usage fetcher and bars  
**Key:** The SSE interceptor and plan usage fetcher are entirely new code (no conflicts). The context bar UI rewrite is in an isolated section. Style the token display and usage bars to match — they're visually stacked. Plan usage triggers a refresh after each SSE message completion. Needs `@grant GM_xmlhttpRequest` in the userscript header.

### Group C: Settings Panel (1 agent)

**Reads:** `SETTINGS.md`  
**Writes to:** `groupC-settings.js`  
**Edits:** `orbBuildPanelSettings()` only  
**Key:** Phase 0 already created `loadSettings()`, `saveSettings()`, `i18n()`. This agent just builds the panel UI using those functions. Must implement the three lockout safeguards (Rules A+B+C).

### Group D: Bookmarks + Search (1 agent)

**Reads:** `BOOKMARKS.md`, `SEARCH-ENHANCEMENT.md`  
**Writes to:** `groupD-bookmarks-search.js`  
**Edits:** `orbBuildPanelBookmarks()`, `orbBuildPanelSearch()`, `orbPopulateSearch()`  
**Adds:** Bookmark DOM injection system (hover icons on messages), bookmark storage  
**Key:** Must define the bookmark storage format clearly because Group E's Tools export reads from it. Document the format in integration notes:
```javascript
// Bookmark storage format (GM_setValue):
// Key: 'acn-bookmarks'
// Value: { 'msg-index-3': { text: '...', type: 'user', timestamp: 1234567890 }, ... }
```

### Group E1: Summary (1 agent)

**Reads:** `SUMMARY.md`  
**Writes to:** `groupE1-summary.js`  
**Edits:** `orbBuildPanelSummary()`  
**Adds:** Conversation map timeline, topic extraction (TF-IDF + bigrams), key point detection (signal phrase regex), conversation stats, code/file inventory, `generateFullSummary()` function  
**Key:** `generateFullSummary()` must be a clean, callable function that returns a structured object — Group E2's "Export Summary" will call it. Document the return format clearly in integration notes:
```javascript
// generateFullSummary() return format:
// { topics: [...], keyPoints: [...], stats: {...}, inventory: { codeBlocks: [...], files: [...] } }
```

### Group E2: Tools + Image Gallery + /Commands (1 agent)

**Reads:** `TOOLS.md`, `COMMANDS.md`  
**Writes to:** `groupE2-tools-gallery.js`  
**Edits:** `orbBuildPanelExport()` (→ `orbBuildPanelTools()`), `orbPopulateNavigate()` (🖼️ indicator), `ORB_FEATURES` array (rename export→tools)  
**Adds:** Image Gallery, `isContentImage()` filter, `downloadImage()`, three export functions (Full Conversation, Bookmarks, Summary), Navigate 🖼️ prefix, /Commands CRUD + storage, floating command palette (Ctrl+/ trigger), platform-specific chat input injection  
**Key:** For Export Summary, stub the `generateFullSummary()` call. Phase 2 wires it to E1's real function. For Export Bookmarks, read from the storage format defined by Group D. The floating palette is an independent overlay (no conflict with other groups). The keyboard listener (`Ctrl+/`) should only activate when the script's platform detection has fired. Document all cross-references in integration notes:
```javascript
// CROSS-DEPENDENCY: Export Summary calls generateFullSummary() from Group E1
// CROSS-DEPENDENCY: Export Bookmarks reads GM_getValue('acn-bookmarks') from Group D
// INDEPENDENT: /Commands and floating palette are fully self-contained
```

---

## Phase 2: Integration — Detailed Instructions

**Agent count:** 1  
**Input:** Updated main file from Phase 0 (v10.1) + all 6 module files from Phase 1  
**Output:** Fully integrated `ai-conversation-navigator.user.js` at v10.7, unified CHANGELOG.md

### Integration process

Each step: apply module → update `ACN_VERSION` → verify no errors → git commit → next.

**v10.2 — Apply Group A** (hover zone) — smallest, validates merge process
   - Replace `orbBuildZone()`
   - Append CSS
   - Set `ACN_VERSION = '10.2'`
   - Commit: `v10.2: Fix hover zone blocking platform UI`

**v10.3 — Apply Group B** (context tracking + plan usage) — new sections, low conflict
   - Replace context bar rendering
   - Insert SSE interceptor as new section
   - Insert plan usage fetcher and bars
   - Add `@grant GM_xmlhttpRequest` to header if not present
   - Append CSS
   - Set `ACN_VERSION = '10.3'`
   - Commit: `v10.3: Context tracking (SSE) + Claude plan usage bars`

**v10.4 — Apply Group C** (settings) — isolated panel, i18n now verified
   - Replace `orbBuildPanelSettings()`
   - Append CSS
   - Set `ACN_VERSION = '10.4'`
   - Commit: `v10.4: Settings panel with platform toggles + i18n`

**v10.5 — Apply Group D** (bookmarks + search) — establishes bookmark storage format
   - Replace `orbBuildPanelBookmarks()` and `orbBuildPanelSearch()`
   - Replace `orbPopulateSearch()`
   - Insert bookmark DOM injection into observer callback
   - Append CSS
   - Set `ACN_VERSION = '10.5'`
   - Commit: `v10.5: Working bookmarks + AI response search`

**v10.6 — Apply Group E1** (summary) — establishes `generateFullSummary()`
   - Replace `orbBuildPanelSummary()`
   - Verify `generateFullSummary()` is exported/accessible globally
   - Append CSS
   - Set `ACN_VERSION = '10.6'`
   - Commit: `v10.6: Summary with conversation map + topic extraction`

**v10.7 — Apply Group E2** (tools + gallery) — wires cross-dependencies
   - Replace `orbBuildPanelExport()` → `orbBuildPanelTools()`
   - Update `ORB_FEATURES` array (rename export→tools, update icon)
   - Update `orbPopulateNavigate()` (add 🖼️ indicator)
   - Wire: Export Summary calls E1's `generateFullSummary()`
   - Wire: Export Bookmarks reads from Group D's bookmark storage format
   - Append CSS
   - Set `ACN_VERSION = '10.7'`
   - Commit: `v10.7: Tools panel with Image Gallery + exports`

### Post-merge cleanup (still in v10.7 commit or as v10.7.1):

8. **i18n verification pass:**
   - Scan for any remaining hardcoded English strings in panel functions
   - Replace with `i18n()` calls
   - Verify Korean translations are present for every key

9. **CSS deduplication:**
   - Check for duplicate class names across modules
   - Consolidate into single CSS block
   - Verify no class name collisions

10. **Build unified CHANGELOG.md:**
    - Extract changelog + troubleshooting sections from each module file
    - Stitch together in reverse order (newest first): v10.7 → v10.1
    - Include all troubleshooting logs — these capture reasoning-flow documentation
    - Place in repo root as `CHANGELOG.md`

### Integration verification (run after each version commit):
- [ ] Script loads without errors
- [ ] All 6 orbital features open their panels
- [ ] Navigate shows question list with 🖼️ indicators where appropriate
- [ ] Search finds text in both user and AI messages
- [ ] Bookmarks can be added, persist across refresh, appear in panel
- [ ] Summary generates topics, key points, stats, conversation map
- [ ] Tools shows Image Gallery and three export buttons
- [ ] Settings shows language selector, functional platform toggles
- [ ] Context bar shows SSE-based token count on Claude
- [ ] Hover zone doesn't block platform UI buttons
- [ ] Korean language setting translates all UI strings
- [ ] Reset button restores all defaults

---

## Phase 3: Testing — Detailed Instructions

**Agent count:** 1  
**Input:** Integrated v10.1 file  
**Output:** Test results, bug fixes

Run through every testing checklist from every spec:
- `GET-AI-MESSAGES.md` testing checklist
- `HOVER-ZONE-FIX.md` testing checklist
- `CONTEXT-TRACKING.md` testing checklist
- `BOOKMARKS.md` testing checklist
- `SEARCH-ENHANCEMENT.md` testing checklist
- `SUMMARY.md` testing checklist
- `TOOLS.md` testing checklist
- `SETTINGS.md` testing checklist

Focus areas:
- Cross-feature interactions (bookmark a message → shows in Tools export?)
- Edge cases (empty conversation, conversation with only 1 message)
- i18n completeness (switch to Korean, check every panel)
- Platform toggle lockout prevention (all three rules)
- SSE interceptor doesn't break Claude's normal operation

---

## Timing Estimates

| Phase | Agents | Est. time | Notes |
|-------|--------|-----------|-------|
| Phase 0 | 1 | 15-20 min | Foundation, must be thorough |
| Phase 1 | 6 parallel | 15-25 min | Bottleneck is now Group B or D, not a single mega-agent |
| Phase 2 | 1 | 20-30 min | Careful merge, lots of verification, E1↔E2 wiring |
| Phase 3 | 1 | 15-20 min | Run checklists, fix issues |
| **Total** | — | **~65-95 min** | vs. ~4-6 hours sequential |

With the E1/E2 split, no single agent is dramatically larger than the others. Group B (context + SSE + usage) and Group D (bookmarks + search) are the heaviest, but comparable in scope.

---

## Critical Rules for All Agents

1. **Never edit the main .user.js file during Phase 1.** Write to your module file only.
2. **Always use `i18n()` for user-facing strings.** Never hardcode English text in panel functions.
3. **Always use `createElement()` for DOM creation.** Never use `innerHTML` (Gemini CSP breaks it).
4. **Document your storage keys.** If you write to `GM_setValue`, document the key name and data format in your integration notes.
5. **Read Phase 0's output first.** Your module should call functions that Phase 0 created (`i18n()`, `getAIMessages()`, `showToast()`, `loadSettings()`).
6. **Test independently where possible.** Your module's functions should work in isolation with mock data.
7. **Write your changelog DURING development, not after.** Include a `## vX.Y Changelog` section at the top of your module file with Added/Changed sections and a Troubleshooting Log in reasoning-flow format (problem → root cause → method → resolution). This documentation is written while context is fresh — don't defer it.

---

## Spec File Reference

Each agent should read their relevant spec(s) BEFORE writing any code:

| Agent | Must read | Reference read (for interfaces) |
|-------|-----------|-------------------------------|
| Phase 0 | `GET-AI-MESSAGES.md`, `SETTINGS.md` (i18n section only) | All specs (to understand what interfaces are needed) |
| Group A | `HOVER-ZONE-FIX.md` | — |
| Group B | `CONTEXT-TRACKING.md`, `PLAN-USAGE.md` | — |
| Group C | `SETTINGS.md` | — |
| Group D | `BOOKMARKS.md`, `SEARCH-ENHANCEMENT.md` | `TOOLS.md` (to understand export format) |
| Group E1 | `SUMMARY.md` | — |
| Group E2 | `TOOLS.md`, `COMMANDS.md` | `BOOKMARKS.md` (storage format for export), `SUMMARY.md` (return format of `generateFullSummary()`) |
| Phase 2 | All specs | All module files |
| Phase 3 | All specs (testing checklists) | — |

---

*This plan is the orchestration layer for v10.1 implementation. Each spec doc contains the feature details — this doc tells agents HOW to work together without breaking each other's code.*
