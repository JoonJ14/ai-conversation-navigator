# Changelog

All notable changes to this project will be documented in this file. Each entry documents not just what changed, but *why* — the problem, the technical root cause, the approach we chose, and how it resolved the issue.

---

## [7.6] - 2026-02-15

### Fixed — Replit: 3x Duplicate Questions + Ghost Notch Button Not Appearing on First Load

Two bugs fixed by replacing incorrect selectors with ones derived from live DOM inspection.

#### Bug 1: Each Question Appeared 3 Times in the Navigation Panel

**Root cause:** All four primary selectors failed because Replit uses `data-cy` (Cypress test attribute), NOT `data-testid`:
- `[data-testid*="user-message"]` → 0 matches (wrong attribute name)
- `[data-message-role="user"]` → 0 matches (doesn't exist)
- `[data-role="user"]` → 0 matches (doesn't exist)
- `[data-author="user"]` → 0 matches (doesn't exist)

Since all primaries returned 0, the dedup logic was skipped entirely (it only runs when `messages.length > 0`). Then Fallback 1 fired: `[class*="userMessage"], [class*="UserMessage"]`, which matched **3 nested elements per user message**:

```
A: div.EventRenderer-module_RTGgnG_userMessage       ← matches [class*="userMessage"] (outermost)
  B: div[data-cy="user-message"]                     ← THE CORRECT TARGET (no userMessage in class)
    C: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades  ← matches (middle)
      D: span
        E: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades  ← matches (innermost)
          F: div.rendered-markdown
            G: div.Markdown-module_KWqogW_markdownTheme
              H: <p>actual text</p>
```

Elements A, C, and E all contain "userMessage" in their CSS module class names. No dedup ran on these fallback results, so all 3 were shown per question.

**Fix:** Changed primary selector to `[data-cy="user-message"]`, which targets element B — exactly one per user message. Added `[data-event-type="user-message"]` as secondary (same element, alternate attribute). Restructured fallback chain with proper dedup as safety net.

#### Bug 2: Ghost Notch Button Not Appearing on First Page Load

**Root cause:** In `getChatBoundaryX()` Strategy 2, the Replit message selector was `[data-testid*="user-message"]` — same wrong attribute. Strategy 2 found no messages → couldn't walk up to the chat container → returned null → button stayed hidden. After a page refresh, the SPA rendered faster from cache and Strategy 1 (textarea walkup) or Strategy 3 (iframe detection) succeeded.

**Fix:** Updated Strategy 2's Replit selector to `[data-cy="user-message"], [data-event-type="user-message"]`.

#### Mock Test Page Updated

Rewrote `tests/mock-pages/replit.html` to match the real Replit DOM structure:
- Full A→H nesting hierarchy with CSS module classes
- `data-cy="user-message"` and `data-event-type="user-message"` attributes
- Double `UserMessage-module` elements (C and E) that caused the 3x bug
- `EventRenderer-module` with `userMessage` in class name
- `AutoScroller-module` container wrapper
- All 140 tests pass (14 platforms × 10 tests)

V0 and Emergent were fixed in v7.7 (see below). `DOM-REFERENCE.md` created with real DOM structures of all platforms.

---

## [7.7] - 2026-02-15

### Fixed — V0: 0 Questions Detected + Button Invisible Until Refresh

**Root cause (message detection):** ALL 6 primary selectors were guesses that don't exist in V0's DOM:
- `[data-role="user"]` — doesn't exist
- `[data-message-role="user"]` — doesn't exist
- `[data-message-author-role="user"]` — doesn't exist
- `[data-message-author="user"]` — doesn't exist
- `[data-testid*="user-message"]` — actual value is `"message"` (no "user" in it)
- `[data-sender="user"]` — doesn't exist

ALL 6 fallbacks also failed because V0 doesn't use the alignment classes our fallbacks relied on:
- No `justify-end`, `self-end`, `ml-auto` — V0 uses `items-end`, `origin-right` instead
- No `bg-muted`, `bg-secondary` — V0 uses `bg-v0-gray-200`
- No `[data-message-id]` — V0 uses regular `id` attribute with hash

**Root cause (button invisible):** Boundary detection Strategy 2 used `[data-role="user"]` which also doesn't exist. No boundary found → `getChatBoundaryX()` returns null → `.ai-nav-positioned` class never added → opacity stays at 0. Button only appeared after page refresh when Strategy 1 (textarea walkup) succeeded on faster SPA re-render.

**Fix (message detection):** Replaced entire V0 selector chain with approach based on live DOM inspection:
```javascript
// Primary: data-testid="message" filtered by origin-right (user = right-aligned)
var v0MsgAll = document.querySelectorAll('[data-testid="message"]');
messages = Array.from(v0MsgAll).filter(function(el) {
    var cls = el.className || '';
    return cls.includes('origin-right') && cls.includes('items-end');
});
```
V0 uses `data-testid="message"` on ALL messages (user + AI). User messages have `origin-right items-end` classes; AI messages have `origin-left items-start`. Filtering by both classes reliably distinguishes user messages.

Fallback chain:
1. `items-end` only (in case `origin-right` changes)
2. Bubble class `bg-v0-gray-200` / `group/message-bubble`
3. `role="listitem"` with alignment check

**Fix (button invisible):** Updated boundary detection selector to `[data-testid="message"]`.

**Mock page rewritten:** `tests/mock-pages/v0.html` now matches real V0 DOM — includes `data-testid="message"` with `origin-right items-end` for user messages and `origin-left items-start` for AI messages, full A→I nesting with `@container/message`, `group/message-bubble`, `bg-v0-gray-200`, and copy buttons that should NOT be detected.

### Fixed — Emergent: Ghost Notch Button Invisible (Two Root Causes)

The Emergent ghost notch button stayed at `opacity: 0` indefinitely, never transitioning to the resting `opacity: 0.35`. This had two independent root causes that both needed fixing.

**Root cause 1 — Boundary detection failure:** The standard `_walkUpToChatContainer()` walks up from a message element looking for a container with `width < 65% viewport`. Emergent uses `div.absolute.inset-0` as a layout container, which inherits full viewport width from its flex parent. Walking up past this element hits full-width ancestors that fail the width check → `getChatBoundaryX()` returns null → `.ai-nav-positioned` never added → opacity stays at 0.

**Root cause 2 — Periodic interval killing stability:** The 3-second periodic boundary check was resetting `_lastBoundaryX = null` before each call to `updateLeftChatPositions()`. The two-consecutive-stable-polls requirement could never be met via the interval because the first poll always compared against null (treated as unstable). Even if boundary detection eventually succeeded after the page fully rendered, the reset killed it.

**Fix 1 — Emergent-specific boundary detection:** Added a new branch at the top of `getChatBoundaryX()` that bypasses `_walkUpToChatContainer` entirely for Emergent:
```javascript
if (currentSite === SITE.EMERGENT) {
    var virtuosoScroller = document.querySelector(
        '[data-testid="virtuoso-scroller"], [data-virtuoso-scroller="true"]'
    );
    if (virtuosoScroller) {
        var vsRect = virtuosoScroller.getBoundingClientRect();
        if (vsRect.width > 200 && vsRect.width < window.innerWidth * 0.75
            && vsRect.height > window.innerHeight * 0.3) {
            return vsRect.right;
        }
    }
}
```
The virtuoso scroller `div` has a reliable `data-testid` attribute and its bounding rect directly represents the chat panel's dimensions.

**Fix 2 — Removed periodic `_lastBoundaryX` reset:** The `_lastBoundaryX = null` line was removed from the periodic interval. This allows late-rendering platforms to eventually achieve two consecutive stable polls, even if the boundary detection only starts working after initial page load completes.

### Fixed — Emergent: Reverted Opacity Band-Aid

A previous agent session increased Emergent's resting opacity from 0.35 to 0.75 and width from 8px to 14px as a workaround for the invisible button. Now that the actual root cause is fixed (boundary detection), the band-aid was reverted:
- Removed conditional `opacity: ${currentSite === SITE.EMERGENT ? '0.75' : '0.35'}` → now uses `0.35` for all platforms
- Removed conditional `width: 14px !important` override → now uses default `8px` for all platforms

### Fixed — Emergent: Question List Changing on Scroll (Virtual Scroll Architecture)

**What it looked like:** As the user scrolled through the chat, the navigation panel showed different questions appearing and disappearing. Many of the shown items were NOT user questions at all — they were AI agent status messages like "Backend is running", "Good progress!".

**Root cause:** Emergent uses **virtuoso virtual scrolling** — only DOM elements currently visible in the viewport exist in the DOM. Elements are recycled as the user scrolls. This caused two problems:

1. The 10-second periodic re-scan cleared and rebuilt the question list each time. When user messages scrolled out of view, the primary selector (`[data-testid^="user-message"]`) returned 0 results.
2. With 0 primary results, broad fallback selectors (3-7: `rounded-br-none`, `items-end`, `text-wrap`, `select-text`, chat container scan) fired and matched AI agent content that was currently visible.

**Why this only affects Emergent:** All other supported platforms keep all messages in the DOM regardless of scroll position. Emergent is the only platform using virtuoso virtual scrolling.

**Fix — Three-part approach:**

1. **Removed broad Emergent fallbacks 3-7:** Only the primary selector (`[data-testid^="user-message"]`) and ID-based fallback (`[id^="user-task"]`) remain. This prevents AI content from ever being matched.

2. **Added accumulative scanning for virtual scroll platforms:**
   ```javascript
   const VIRTUAL_SCROLL_SITES = [SITE.EMERGENT];
   const isVirtualScroll = VIRTUAL_SCROLL_SITES.includes(currentSite);
   var _vsAccumulatedKeys = new Set();
   ```
   In accumulation mode, `scanConversation()` adds newly discovered messages to the existing list without clearing it. Deduplication uses a text key (first 200 chars, normalized). The Refresh button does a full reset via `scanConversation(true)`. SPA navigation also clears the accumulated set.

3. **Stale DOM reference handling:** When the user clicks a nav item, the originally captured DOM element may have been recycled by virtuoso. The click handler checks `msg.isConnected` and, if stale, re-searches the current DOM for a matching element by text content. If the target message isn't currently in the DOM (scrolled far away), the click is silently ignored.

### Fixed — Emergent: No Questions on Initial Load

**What it looked like:** When Emergent first loaded, the navigation panel showed 0 questions. The user had to manually scroll all the way up through the chat for questions to appear in the panel.

**Root cause:** Emergent loads with the chat scrolled to the bottom. Virtuoso only renders messages currently in the viewport. Messages at the top of the conversation don't exist in the DOM until the user scrolls up to them. Since our scanner runs on page load (when only the bottom is rendered), it finds 0 user messages.

**Fix — Scroll-through collection on panel open:** When the panel opens on a virtual scroll platform, the script programmatically scrolls through the entire virtuoso container to force-render every message:
1. Saves the current `scrollTop` position
2. Forces a full reset (`scanConversation(true)`)
3. Builds an array of scroll positions: `[0, 80%_viewport, 160%_viewport, ...]` up to `scrollHeight`
4. Steps through each position with 250ms delays (for virtuoso to render)
5. At each position, runs `scanConversation()` in accumulation mode
6. After reaching the end, restores the original scroll position

This collects all user messages across the entire conversation regardless of initial scroll position.

### Fixed — Emergent: "No Messages Found" Text Persisting Above Questions

**What it looked like:** After questions loaded via accumulation, the "No messages found yet" placeholder text remained visible above the actual question list.

**Root cause:** The empty message element was created with `id="ai-nav-empty"` but the accumulation code used `.ai-nav-empty` (class selector) to find and remove it. The selector never matched.

**Fix:** Changed `list.querySelector('.ai-nav-empty')` to `document.getElementById('ai-nav-empty')`.

### Mock Page and Documentation Updates

- **`tests/mock-pages/emergent.html`:** Rewritten to match real Emergent DOM — includes virtuoso scroller (`data-testid="virtuoso-scroller"`), full A→M nesting hierarchy with `data-testid="user-message-user-task"`, icon sidebar, chat panel constrained by flex (`max-width:40%`), and preview panel.
- **`DOM-REFERENCE.md`:** Created comprehensive reference covering all 14 platform variants. Detailed DOM structures and debugging history for Replit, V0, Bolt.new, and Emergent (from live site inspection). Selector info and notes for all other platforms. Includes general patterns and common pitfalls section.
- All 140 tests pass (14 platforms × 10 tests).

---

## [7.5] - 2026-02-15

### Problem — Platform Selectors Not Matching Live DOM

After deploying v7.4 (which added mock test pages for 5 new platforms), live site testing on Bolt.new, Replit, V0, and Emergent revealed four distinct issues:

1. **Bolt.new** showed "You've used all your tokens" (a subscription warning) instead of actual user questions
2. **Replit** showed every question 3 times instead of once
3. **V0** showed 0 questions found
4. **Emergent** button was invisible until mouse hover, and the panel had spacing issues

### Technical Root Causes and Fixes

#### Bolt.new — Token Warning Picked Up as a Question

**Root cause:** The v7.4 primary selector `[class*="backdrop-blur"][class*="rounded"]` was based on the bolt.diy open-source fork, but bolt.new's actual production DOM uses a different structure:
- User messages: `<div data-message-id="..." class="self-end bg-bolt-elements-messages-background ...">` with text inside `<div class="_MarkdownContent_...">` children
- The "You've used all your tokens" warning: a `<span>` inside a `<div class="bg-bolt-elements-prompt-subscribeButton-background">` at the bottom of the page

The bolt.diy selectors found 0 user messages (no `backdrop-blur` in production), so fallbacks fired and matched the token warning text (which sat inside elements with `ml-auto` or `rounded-*` classes).

**Fix:** Reworked the entire Bolt selector chain:
1. **New primary:** `[data-message-id]` filtered by `self-end` class or `bg-bolt-elements-messages` — directly targets the production DOM structure
2. **Fallback 1:** `.self-end[class*="bg-bolt-elements"]` — alternate attribute-based match
3. **Fallback 2:** `[class*="_MarkdownContent_"]` inside `.self-end` parents — targets the text content divs
4. **Fallback 3:** Original `backdrop-blur` + `rounded` pattern (kept for bolt.diy fork compatibility)
5. **Fallback 4-5:** `ml-auto` rounded bubbles and grid children (kept from v7.4)
6. **All selectors:** Added `subscribeButton` and `prompt-subscribe` exclusion filters to prevent token/subscription warnings from ever being matched

Updated `tests/mock-pages/bolt.html` to use the production DOM structure (`data-message-id`, `self-end`, `bg-bolt-elements-messages-background`, `_MarkdownContent_`) and include a token warning element that should NOT be detected.

#### Replit — 3x Question Duplication

**Root cause:** The existing nesting deduplication (keep only innermost elements) handles the case where `data-testid*="user-message"` matches at multiple nesting levels (parent contains child). But on live Replit, 3 elements per message are matching the selector and they are NOT nested — they're siblings or cousins at the same DOM level. Each has identical `textContent`, but `el.contains(other)` returns `false` for all pairs, so nesting dedup keeps all 3.

**Fix:** Added a second deduplication step after the existing nesting dedup:
```javascript
// Text-content dedup: keep only the first element for each unique text
var replitSeen = {};
var replitTextDeduped = [];
for (var ri = 0; ri < replitMsgArr.length; ri++) {
    var replitTxt = replitMsgArr[ri].textContent.trim();
    if (replitTxt && !replitSeen[replitTxt]) {
        replitSeen[replitTxt] = true;
        replitTextDeduped.push(replitMsgArr[ri]);
    }
}
```

**Limitation:** This is a mitigation, not a root-cause fix. If a user genuinely asks the exact same question twice, the second instance would be filtered out. The proper fix requires live DOM inspection to understand why 3 elements match per question and to target only the correct one. See TROUBLESHOOTING.md for full diagnosis notes.

#### V0 — No Questions Detected

**Root cause:** All primary selectors (`[data-role="user"]`, `[data-message-role="user"]`, `[data-message-author-role="user"]`) and all 5 structural fallbacks return 0 results on the live V0 site. V0's Geist design system likely uses completely different data attributes and DOM patterns than what we assumed from research.

**Fix:** Added more selector variants to increase coverage:
- `[data-message-author="user"]`
- `[data-testid*="user-message"]`
- `[data-sender="user"]`
- New fallback: `[data-message-id]` containers filtered by alignment classes (`justify-end`, `self-end`, `ml-auto`, or containing `bg-muted` children)

**Limitation:** These additional selectors are educated guesses. Without live DOM inspection, we can't know V0's actual attribute patterns. See TROUBLESHOOTING.md for what's needed.

#### Emergent — Button Invisible Until Hover

**Root cause:** The ghost notch button at rest has `opacity: 0.35` and `width: 8px`. Against Emergent's dark interface, this combination makes the button virtually invisible — a 8px-wide strip at 35% opacity on a dark background doesn't register visually.

**Fix:** Added Emergent-specific CSS overrides:
```css
#ai-nav-toggle.ai-nav-positioned {
    opacity: 0.75 !important;  /* Was 0.35 for all platforms */
    width: 14px !important;    /* Was 8px */
}
```

This uses a conditional template literal in the CSS generation:
```javascript
opacity: ${currentSite === SITE.EMERGENT ? '0.75' : '0.35'} !important;
${currentSite === SITE.EMERGENT ? 'width: 14px !important;' : ''}
```

**Limitation:** Still under investigation — the 0.75 opacity + 14px width may still be insufficient on some Emergent page backgrounds. The panel spacing issue (gap when panel expands) is also unresolved. See TROUBLESHOOTING.md.

### Known Issues Remaining

All four fixes improve the situation but three platforms (Replit, V0, Emergent) need further live DOM inspection for complete resolution. See TROUBLESHOOTING.md → "Known Issues Under Investigation" and ROADMAP.md → "Next Priority: Platform Selector Deep-Dive" for the full plan.

---

## [7.4] - 2026-02-15

### Added — Mock Test Pages for 5 New Platforms + Selector Improvements

Extended the automated test suite from 9 platform variants to 14 by adding mock HTML pages for V0, Base44, Emergent, Perplexity, and Firebase Studio. Also refined selectors and visibility for 6 platforms based on initial testing.

#### New Mock Test Pages
- `tests/mock-pages/v0.html` — V0 with `data-role="user"` + copy button filtering
- `tests/mock-pages/base44.html` — Base44 with `id="message-{uuid}"` + justify-end filter
- `tests/mock-pages/emergent.html` — Emergent with `data-testid="user-message-*"` + prose containers
- `tests/mock-pages/perplexity.html` — Perplexity with `.group/query` Tailwind variant
- `tests/mock-pages/firebase.html` — Firebase Studio with CSS Modules `_isUser_` pattern

#### Selector Refinements
- **Replit:** Added nesting deduplication — keeps only innermost elements when `data-testid*="user-message"` matches at multiple DOM levels
- **Emergent:** Added deduplication (same pattern as Replit) + scrollbar offset (14px left shift to avoid thick scrollbar overlap)
- **V0:** Added copy button/icon exclusion across all fallbacks

#### Icon Change
- **Firebase Studio:** Changed icon from ☄ (comet) to ✦ (four-pointed star) — same as Gemini since Firebase Studio runs Gemini under the hood, differentiated by the dark tangerine color theme

### Test Suite Results
All 140 tests pass (10 tests × 14 platform variants) on Chromium. The test infrastructure now covers every supported platform.

---

## [7.3] - 2026-02-15

### Problem — Ghost Notch Button Appearing on Home/Dashboard Pages

After deploying v7.1, the ghost notch button was appearing on pages where it shouldn't — specifically on **home/dashboard pages** of left-chat platforms (Bolt.new homepage, Lovable's project list, Emergent's home screen). These pages have no active chat session, so there's nothing to navigate. The button either showed at a fixed 35% position (wrong) or briefly flashed visible before disappearing (confusing).

### Technical Root Cause (Three Bugs, Fixed Across v7.2 → v7.3)

The v7.1 ghost notch had a fundamental design flaw: it used a **35% viewport fallback** when boundary detection couldn't find the chat panel edge. This meant the button ALWAYS appeared somewhere — even on pages with no chat panel at all. The fallback was added as a safety net during initial development, but it turned out to be exactly the wrong behavior for home pages.

Removing the fallback revealed two deeper bugs in the boundary detection and visibility lifecycle:

#### Bug 1: The 35% Viewport Fallback (v7.1 → fixed in v7.2)

**Root cause:** `getChatBoundaryX()` had a last-resort fallback at the bottom:
```javascript
// Last resort: assume 35% viewport
return window.innerWidth * 0.35;
```

This meant `getChatBoundaryX()` NEVER returned `null` — it always returned a number. So the "no chat detected → hide" branch in `updateLeftChatPositions` was unreachable dead code. The button always positioned itself somewhere.

**Why the fallback existed:** During v7.1 development, the boundary detection strategies (input walkup, message walkup, iframe detection) hadn't been validated on live sites yet. The 35% fallback was a conservative safety net — "if we can't figure out where the chat panel ends, at least put the button somewhere reasonable." In hindsight, "somewhere reasonable" on a home page is "nowhere."

**Fix (v7.2):** Removed the 35% fallback entirely. `getChatBoundaryX()` now returns `null` when no chat panel is detected, which causes `updateLeftChatPositions()` to hide the button with `display: none`.

**New concern this raised:** Without the fallback, the button's visibility now depends entirely on `getChatBoundaryX()` correctly distinguishing chat pages from home pages. This is harder than it sounds because **home pages on these platforms often have chat-like textareas** (Bolt: "Let's build a customer portal...", Emergent: "Build me a clone of netflix..."). These textareas could match Strategy 1's broad input selectors and trick the boundary detection into returning a value.

**Why it still works on home pages:** The `_walkUpToChatContainer()` function requires the input's ancestor to satisfy ALL of: `rect.left < 80` (starts near left edge), `width > 200 && width < 65% viewport` (narrow panel, not full-width), `height > 40% viewport` (tall). On home pages, these centered input cards have `rect.left > 80` (they're centered, not left-aligned), so walkup fails → returns null → button stays hidden. On real chat pages, the chat panel starts at the left edge (`rect.left ≈ 0`), is 30-50% of viewport width, and is full height — matching all criteria.

#### Bug 2: Elements Starting Visible at Opacity 0 (v7.2 → fixed in v7.3)

**Root cause:** Even after fixing Bug 1, on some pages the button would **briefly flash visible** before being hidden. This happened because elements were created with `display: ''` (visible) and `opacity: 0` (transparent). The CSS had hover rules that set `opacity: 1`, so if the user's mouse happened to be in the right area, they could discover the invisible button before `updateLeftChatPositions()` had a chance to set `display: none`.

The timeline was:
1. Script loads → toggle created with `display: ''`, `opacity: 0` (in DOM, hoverable)
2. 500ms later → first `updateLeftChatPositions()` poll runs → `getChatBoundaryX()` returns null → sets `display: none`
3. In that 500ms window, the element existed and was hoverable

**Fix:** Changed the initialization to create elements with `display: none` from the start on left-chat sites. Elements are ONLY made visible (`display: ''`) after `getChatBoundaryX()` returns a stable boundary. The `ensureElementsExist()` re-injection function also starts re-created elements as `display: none` when boundary hasn't been confirmed yet.

#### Bug 3: Boundary Fluctuation Causing Re-Hide Loop (v7.3)

**Root cause:** This was the most subtle bug. After the button successfully appeared at `0.35` opacity on a chat page, it would **go invisible again** and only be discoverable by hovering. The user described: "the buttons are not visible at all until I toggle a mouse over."

The problem was in `updateLeftChatPositions()`. The function polled every 500ms and compared the current boundary to `_lastBoundaryX` with a 3px tolerance. If the boundary shifted by more than 3px between polls, the code treated this as "boundary changed" and executed a full reset: `display: none`, remove `ai-nav-positioned` class, set `_boundaryDetected = false`.

On real sites, the chat panel boundary **fluctuates by small amounts** (4-8px) between polls due to:
- Layout reflows when new content streams in
- Scrollbar appearing/disappearing as message content changes height
- CSS transitions completing between polls
- The preview iframe adjusting its dimensions

This created a destructive cycle:
```
Poll 1: boundary = 500px → _lastBoundaryX = 500, position invisibly
Poll 2: boundary = 500px → stable! → show button, start fade-in
Poll 3: boundary = 504px → shift > 3px! → HIDE button, reset everything
Poll 4: boundary = 500px → shift from 504! → update _lastBoundaryX, stay hidden
Poll 5: boundary = 504px → shift from 500! → stays hidden
... cycles forever, or eventually stabilizes and re-shows, only to be hidden again on the next fluctuation
```

The button would appear for about 1 second (polls 2-3), then vanish and enter this hide/show/hide cycle. Because the cycle often settled back to hidden, the user only saw the button when explicitly hovering over its position.

**Additional sub-bug:** The original fade-in used a **3-second opacity transition** (`transition: opacity 3s ease` in the `ai-nav-positioned` class). This was designed for v7.1 where the position might shift, giving the button time to "settle." But combined with the display-none-first approach, it meant the button took 3+ seconds to reach even 0.2 opacity — making it appear invisible even when it WAS technically fading in. Users couldn't distinguish a button at 0.1 opacity from no button at all.

**Fix (v7.3 final):** Restructured `updateLeftChatPositions()` into three clearly separated phases:

```javascript
// Phase 1: No boundary → hide + full reset
if (!boundaryX) { hide; reset; return; }

// Phase 2: Already confirmed → just reposition smoothly, NEVER hide
if (_boundaryDetected) { update position; return; }

// Phase 3: Not yet confirmed → require 2 stable polls before showing
if (stable) { show; fade in; return; }
else { position invisibly; wait; }
```

The critical change: **once `_boundaryDetected` is true, the button is NEVER hidden again for position shifts** — only a `null` boundary (navigating away from the chat page entirely) will hide it. Position shifts during Phase 2 are handled by smoothly updating `style.right`, not by hiding and re-showing.

Also changed the opacity transition from 3s to 0.5s and removed the two-phase `ai-nav-ready` system (which existed solely to switch from 3s fade to fast hover transitions after the fade completed — unnecessary now that the fade itself is fast).

### Architecture: Final `updateLeftChatPositions()` Design

The function now has a clean three-phase structure with clear invariants:

| Phase | Condition | What happens | Can hide the button? |
|-------|-----------|-------------|---------------------|
| **1. No chat** | `boundaryX` is `null` | Full reset: `display: none`, clear timers, remove classes, reset `_boundaryDetected` | Yes — this is the ONLY path that hides |
| **2. Confirmed** | `_boundaryDetected === true` | Update `style.right` if boundary shifted ≥3px. No visibility changes. | No — never |
| **3. Detecting** | `_boundaryDetected === false` | If boundary matches `_lastBoundaryX` within 3px on two consecutive polls → confirm. Otherwise, store boundary and position invisibly. | No — stays hidden until confirmed |

**State transitions:**
```
[Page load] → Phase 3 (detecting)
Phase 3 + stable boundary → Phase 2 (confirmed, visible)
Phase 2 + null boundary → Phase 1 (hidden, reset) → Phase 3 on next non-null
Phase 2 + shifted boundary → Phase 2 (reposition, stay visible)
Phase 3 + shifting boundary → Phase 3 (keep waiting)
Phase 3 + null boundary → Phase 1 (hidden, reset)
```

### CSS Changes

```css
/* Before (v7.1): Two-phase fade system */
#ai-nav-toggle.ai-nav-positioned {
    opacity: 0.35 !important;
    transition: ... opacity 3s ease ... !important;  /* Slow 3-second fade */
}
#ai-nav-toggle.ai-nav-ready {
    transition: ... opacity 0.3s ease ... !important;  /* Fast for hover */
}

/* After (v7.3): Single-phase, fast fade */
#ai-nav-toggle.ai-nav-positioned {
    opacity: 0.35 !important;
    transition: ... opacity 0.5s ease ... !important;  /* Quick 0.5s appearance */
}
/* ai-nav-ready class removed entirely */
```

### Changes to Element Initialization

```javascript
// Before (v7.1): Elements created visible
document.body.appendChild(createToggle());  // display: '' by default

// After (v7.3): Left-chat elements start hidden
var initToggle = createToggle();
if (isLeftChat) initToggle.style.display = 'none';  // Hidden until confirmed
document.body.appendChild(initToggle);

// Same in ensureElementsExist() re-injection:
if (isLeftChat && !_boundaryDetected) toggle.style.display = 'none';
```

### What's Working Now

- **Home pages** (Bolt.new `/`, Lovable dashboard, Emergent `/home`): Button never appears — `getChatBoundaryX()` returns null because centered input cards fail the `rect.left < 80` check
- **Chat pages**: Button appears after ~1 second (2 polls × 500ms), fades to 0.35 opacity over 0.5s, stays visible permanently regardless of boundary micro-fluctuations
- **Chat → Home navigation** (SPA): Boundary becomes null → button hides → full state reset → ready for next chat
- **Home → Chat navigation** (SPA): Boundary detected → 2 stable polls → button appears

### Known Limitations / Things to Watch

1. **The `rect.left < 80` heuristic** in `_walkUpToChatContainer` is what prevents false positives on home pages. If any platform redesigns its home page to have a left-aligned input panel (not centered), this could trigger a false positive. The 80px threshold accounts for icon sidebars (common on app builders) but assumes home page inputs are centered.

2. **The 3px jitter tolerance** means the boundary must stabilize within 3px across two consecutive 500ms polls before the button appears. If a platform has a chat panel that animates for more than 1 second on page load, the button appearance will be delayed until the animation completes.

3. **Home pages with left-aligned chat-like panels** could theoretically trick the detection. The current defense is the `_walkUpToChatContainer` height/width/position requirements. A panel that starts at the left edge, is 200-65% of viewport width, and is 40%+ of viewport height would be treated as a chat panel regardless of whether it actually is one.

4. **`getChatBoundaryX()` Strategy 3 (iframe detection)** looks for preview iframes in the right portion of the viewport. If a home page has a large promotional iframe or embedded demo, it could return a false boundary. This hasn't been observed in practice.

---

## [7.1] - 2026-02-15

### Added — 5 New Platforms + Ghost Notch Button for Left-Chat Sites

Expanded from 7 platforms to 12, adding V0, Base44, Emergent, Perplexity, and Firebase Studio. Also introduced a new "ghost notch" toggle button design for left-chat platforms where the chat panel sits on the left and a workspace/preview occupies the right.

#### V0 (`v0.app`)
- **Theme:** White (`#ffffff`) with dark text — matches Vercel's monochrome design language
- **Icon:** ▽ (U+25BD, white down-pointing triangle — evokes Vercel's triangle/delta logo)
- **Selectors:** Multi-strategy chain:
  1. `[data-role="user"]` — data attribute selector (most reliable if present)
  2. `[data-message-role="user"]` — alternate data attribute pattern
  3. Structural fallback: `.justify-end`, `.self-end`, `.ml-auto` elements filtered by text content, excluding nav/header elements, and checking for leaf nodes (no nested right-aligned children)
- **Layout:** Left-chat (chat on left, generated app preview on right) → uses ghost notch button
- **SPA hooks:** Yes — Next.js-based routing requires pushState/replaceState interception

#### Base44 (`app.base44.com`)
- **Theme:** Indigo (`#6366f1`) — matches Base44's purple-indigo UI accents
- **Icon:** ⬢ (U+2B22, black hexagon — evokes a modular building block, fitting Base44's "build anything" premise)
- **Selectors:** Multi-strategy chain:
  1. `[id^="message-"]` elements filtered by presence of `.justify-end` child (user messages are right-aligned within their message container, each message has `id="message-{uuid}"`)
  2. Fallback: `.bg-slate-200.rounded-xl` elements (user message bubble styling)
- **Layout:** Left-chat → uses ghost notch button
- **SPA hooks:** Yes — React SPA with dynamic routing

#### Emergent (`app.emergent.sh`)
- **Theme:** Emerald green (`#10b981`) — matches Emergent's green accent color
- **Icon:** e (lowercase letter — Emergent brand initial)
- **Selectors:** Highly reliable data-testid approach:
  1. `[data-testid^="user-message"]` — Emergent uses descriptive data-testid attributes, making this the most reliable selector of any platform
  2. Fallback: `[id^="user-"]` — alternate ID-based pattern
- **Layout:** Left-chat → uses ghost notch button
- **SPA hooks:** Yes

#### Perplexity (`perplexity.ai`)
- **Theme:** Teal/cyan (`#20b8cd`) — matches Perplexity's signature teal brand color
- **Icon:** ⦾ (U+29BE, circled white bullet — evokes Perplexity's circular logo/search motif)
- **Selectors:** Tailwind group variant approach:
  1. `.group\/query` — Perplexity uses Tailwind's group variant `.group/query` on each user query block. The `\/` is the CSS escape for the `/` character. This is a very stable selector since it's a semantic class name rather than a styling utility.
  2. Fallback: `.group\/title .select-text` — alternate query text extraction pattern
- **Layout:** Standard center-chat → uses right-edge hover-expand button
- **SPA hooks:** Yes — Next.js SPA with aggressive client-side routing
- **@match note:** Both `www.perplexity.ai` and `perplexity.ai` are matched since Perplexity serves from both hostnames

#### Firebase Studio (`studio.firebase.google.com`)
- **Theme:** Dark Tangerine (`#FFA611`) — matches Firebase's primary brand color
- **Icon:** ☄ (U+2604, comet — evokes Firebase's fiery branding)
- **Selectors:** CSS module class pattern:
  1. `[class*="_isUser_"]` — Firebase Studio uses CSS Modules which generate class names like `_isUser_abc123`. The hash suffix changes per build, but the `_isUser_` semantic prefix remains stable across deployments. This `*=` attribute selector matches any class containing that substring.
  2. Fallback: `[class*="_chatMessage_"]` elements filtered by checking if className string includes `_isUser_` — broader net catching all chat messages first, then filtering to user messages only
- **Layout:** Standard center-chat (Gemini-based interface) → uses right-edge hover-expand button
- **SPA hooks:** Yes — Angular-based (inherits Gemini's SPA behavior)
- **Key technical note:** Firebase Studio is essentially Google's Gemini integrated into the Firebase console with a code workspace. It shares Gemini's Angular foundation and Trusted Types CSP enforcement, so the same programmatic DOM creation approach (no innerHTML) from v5.0 applies here.

### Added — Ghost Notch V1 Toggle Button (Left-Chat Platforms)

Introduced a new toggle button design for platforms where the chat panel occupies the left side of the screen (Bolt, Lovable, Replit, V0, Base44, Emergent). The standard right-edge button doesn't work well on these platforms because the right side is occupied by the app preview/workspace — clicking a button at the screen's right edge feels disconnected from the chat content.

#### Design: Ghost Notch V1
- **At rest:** An 8px-wide vertical bar at 35% opacity, positioned flush against the right edge of the chat panel. Nearly invisible — a subtle "notch" in the boundary between chat and workspace.
- **On hover:** Expands to 32px wide, revealing the platform icon which scales in from 60% to 100%. Height shrinks from 52px to 40px for a more compact feel. Opacity rises to 100%. Uses `cubic-bezier(0.4, 0, 0.2, 1)` easing for a natural material-design feel.
- **When open:** Button stays at 32px/full opacity. Panel slides from the left edge, covering the chat area. Button repositions to the right edge of the open panel (320px from left).
- **Auto-close on navigate:** When user clicks a question in the nav panel, the panel closes first (350ms animation), then scrolls to and highlights the message. This is necessary because the panel overlays the chat — the user needs to see the destination.

#### Boundary Detection (`getChatBoundaryX()`)
The ghost notch button needs to know where the chat panel ends and the workspace begins. This boundary varies across platforms and can change when the user resizes panes.

**Detection strategy (3 strategies, no fallback — returns `null` if none match):**

1. **Strategy 1 — Chat input walkup:** Find the chat input element via a broad selector (`textarea[placeholder*="message" i]`, `textarea[placeholder*="Send" i]`, `textarea[placeholder*="Type" i]`, `[contenteditable="true"][role="textbox"]`, `textarea[class*="chat"]`, `textarea[class*="prompt"]`). Walk up the DOM tree from the input, measuring each ancestor's bounding rect. The chat panel is identified as the first ancestor that: starts near the left edge (`rect.left < 80` to allow for icon sidebars), is between 200px and 65% of viewport width, and is at least 40% of viewport height. Return `rect.right`.

2. **Strategy 2 — Platform-specific message walkup:** Use platform-specific selectors (e.g., `[data-testid^="user-message"]` for Emergent, `[id^="message-"]` for Base44) to find a known message element, then walk up to the chat container using the same `_walkUpToChatContainer()` function.

3. **Strategy 3 — Preview iframe detection:** Find `<iframe>` elements positioned in the right portion of the viewport (left edge between 25-75% of viewport, tall, reasonably wide). The iframe's `rect.left` is the boundary.

4. **No fallback:** If all three strategies fail, return `null`. This is critical — it tells `updateLeftChatPositions()` to hide the button entirely. This prevents the button from appearing on home/dashboard pages. See v7.3 changelog for the full story of why the original 35% fallback was removed.

**Positioning updates:**
- `updateLeftChatPositions()` polls every 500ms via `setInterval`
- Button starts with `display: none` and only becomes visible after two consecutive polls return a stable boundary (within 3px)
- Once visible, position shifts are handled smoothly without hiding
- Only a `null` boundary (leaving the chat page) will hide the button again
- Window resize listener also triggers repositioning
- SPA navigation hooks trigger repositioning after route changes

#### Panel Behavior (Left-Chat Mode)
- Panel slides from the **left** edge (`left: -320px` → `left: 0`) instead of the right
- Uses `border-right` instead of `border-left` for the panel edge
- Toggle button animates its `left` position smoothly when panel opens/closes (via CSS `transition: left 0.3s ease`)

### Changed — SPA Hooks Expanded
The `history.pushState`/`replaceState` interception and periodic health check now applies to all SPA platforms: Gemini, Bolt, Lovable, Replit, V0, Base44, Emergent, Firebase Studio, and Perplexity. Left-chat platforms also trigger `updateLeftChatPositions()` on navigation events.

### Architecture Notes

- **`isLeftChat` flag:** A single boolean computed at initialization that drives all left-chat vs standard behavioral differences. Controlled by the `LEFT_CHAT_SITES` array: `[SITE.BOLT, SITE.LOVABLE, SITE.REPLIT, SITE.V0, SITE.BASE44, SITE.EMERGENT]`.
- **CSS is conditionally assembled:** `toggleStyles` and `panelStyles` are computed separately based on `isLeftChat`, then concatenated with the shared styles (header, stats, list items, scrollbar) into the final `styles` string. This avoids CSS specificity conflicts between the two button designs.
- **No breaking changes:** All existing platforms (Claude, ChatGPT, Grok, Gemini, Claude Code, Codex, Bolt, Lovable, Replit) retain their exact previous behavior. The ghost notch is additive for left-chat sites; standard sites are untouched.
- **`_lastBoundaryX` jitter guard:** Button position only updates when the boundary moves more than 3px, preventing visual jitter from sub-pixel layout recalculations.
- **Three-phase `updateLeftChatPositions()`:** See v7.3 changelog for the full architecture. Phase 1 (no boundary → hide), Phase 2 (confirmed → reposition smoothly), Phase 3 (detecting → wait for stability). Once confirmed, the button is NEVER hidden for position shifts — only for null boundaries.

---

## [7.0] - 2026-02-14

### Added — AI App-Builder Platform Support

Added support for three AI app-builder platforms, expanding the navigator from 4 platforms to 7 (plus their sub-platform variants). These are the first non-chatbot platforms supported — all three are code-generation IDEs where users build apps through iterative conversation, and all three suffer from the same long-conversation navigation problem.

#### Bolt.new (`bolt.new`)
- **Theme:** Sky Blue (`#38BDF8`) — matches Bolt's sky-400 brand color
- **Icon:** ⚡ (U+26A1, lightning bolt with text presentation selector to prevent emoji rendering)
- **Selectors:** Multi-strategy fallback chain based on bolt.diy open-source fork analysis:
  1. `backdrop-blur` + `rounded` elements that are not `w-full` (user messages have accent-tinted blur background)
  2. `ml-auto` rounded bubbles (right-aligned user messages)
  3. Structural filtering on `.grid.w-full > div` children — assistant messages have `overflow-hidden w-full`, user messages do not
  4. Computed `backgroundColor` check as last resort (user messages have non-transparent accent tint)
- **SPA hooks:** Yes — Remix-based routing requires `pushState`/`replaceState` interception + periodic health check
- **Site detection:** Uses exact hostname match (`hostname === 'bolt.new'`) instead of `.includes()` to avoid matching deployed project subdomains (`yourapp.bolt.new`)
- **Key technical note:** Bolt uses UnoCSS (not Tailwind), which has similar syntax but may generate different production class names. The computed-style fallback provides resilience against UnoCSS class name changes.

#### Lovable (`lovable.dev`)
- **Theme:** Violet (`#9b87f5`) — inspired by Lovable's heart gradient logo (warm-to-cool purple spectrum)
- **Icon:** ♥ (U+2665, black heart suit — directly evokes the "Lovable" brand heart logo)
- **Selectors:** Multi-strategy fallback chain based on Adorable open-source clone + Lovable.dev Add-ons extension analysis:
  1. `div[role="log"] .justify-end` — ARIA log container + right-aligned user message wrappers
  2. `bg-neutral-200.rounded-xl` / `bg-neutral-700.rounded-xl` bubbles inside `.justify-end` ancestors
  3. `div.ChatMessageContainer .justify-end` — class name observed in extension DOM utils
  4. `div.self-end[class*="bg-neutral"]` — alternate alignment pattern
  5. Broad scan of `main` element filtering by alignment heuristics
- **Page guard:** Only scans when URL contains `/projects/` (homepage, pricing, docs pages have no chat interface)
- **SPA hooks:** Yes — React Router SPA requires `pushState`/`replaceState` interception + periodic health check
- **Layout note:** Split-panel interface (chat left, preview right). Our fixed-position right sidebar overlays the preview panel when open, which is acceptable since users explicitly toggle navigation.

#### Replit (`replit.com`)
- **Theme:** Red-orange (`#F26522`) — Replit's official brand orange. Visually distinct from Claude's amber (`#d97706`) — Replit's is more red-leaning (hue 19°) vs Claude's warm amber (hue 40°).
- **Icon:** ⠕ (U+2815, Braille Pattern Dots-135 — the Unicode character the Replit community adopted to simulate Replit's three-dot prompt logo)
- **Selectors:** Defensive multi-strategy chain designed for Emotion CSS-in-JS (hash classes change per deployment):
  1. `data-testid`, `data-message-role`, `data-role` attribute selectors (if Replit uses them)
  2. ARIA `role="log"` container + computed style analysis (checking `marginLeft: auto`, `alignSelf: flex-end`, non-transparent `backgroundColor`)
  3. Chat panel discovery via `textarea[placeholder*="message"]`, then structural scan of sibling elements with right-alignment and leaf-node heuristics
- **SPA hooks:** Yes — Next.js SPA with Jotai state management and Crosis WebSocket streaming. Chat panel can be opened/closed/repositioned within the IDE's pane system.
- **Key technical note:** This is the hardest platform to support due to Emotion's unstable hash classes. Selectors are necessarily speculative and will require live DOM validation. The fallback chain prioritizes stable attributes (`data-*`, ARIA roles, computed styles) over class names.

### Architecture Notes

- **SPA hooks consolidated:** The `history.pushState`/`replaceState` interception and periodic health check (previously Gemini-only) now applies to all four SPA platforms: Gemini, Bolt, Lovable, and Replit. This is a single shared code block rather than duplicated per-platform.
- **No breaking changes:** All existing platform support (Claude, ChatGPT, Grok, Gemini, Claude Code, Codex) remains unchanged. New platforms are additive — new entries in lookup tables + new `else if` branches in `getUserMessages()`.
- **Research methodology:** Each platform was researched by a dedicated agent in parallel — one expert per platform — analyzing open-source forks (bolt.diy), production extensions (Lovable.dev Add-ons), engineering blog posts (Replit RUI/Emotion), and community resources.

---

## [6.4] - 2026-02-14

### Problem
Opening the Navigate sidebar on **Codex web** (`chatgpt.com/codex`) showed the sidebar correctly (since the hostname is still `chatgpt.com`) but detected **0 questions** — no user messages appeared in the navigation list. The sidebar worked perfectly on regular ChatGPT Chat (`chatgpt.com`).

### Technical Root Cause
Codex web uses a completely different DOM structure from ChatGPT Chat. The existing ChatGPT selector relied on `data-message-author-role` attributes on message elements — **which do not exist in Codex web's DOM**.

Codex web uses a task/thread-based interface where:
- Each conversation is a **thread** containing multiple **turns**
- Each turn contains **items** (user message, agent message, tool execution, diffs, etc.)
- The DOM structure reflects this item-based model rather than ChatGPT's chat message model
- There are no `data-message-author-role` attributes anywhere in the Codex web DOM

Since the extension tried the ChatGPT Chat selector, found nothing, and had no further fallback, it reported 0 questions.

### Method Chosen and Why
Added a **fallback selector** in `getUserMessages()` that activates only when the existing ChatGPT Chat selector finds nothing — the same pattern used for Claude Code support in v6.2:

```javascript
if (messages.length === 0) {
    messages = document.querySelectorAll('div.self-end.bg-token-bg-tertiary');
}
```

This approach:
1. **Selects user message bubbles** (`self-end.bg-token-bg-tertiary`) — Codex web user messages are right-aligned (`self-end` in Tailwind) with a tertiary token background (`bg-token-bg-tertiary`), while agent messages are left-aligned and use a different background
2. **Good scroll target** — the bubble element works well with both `scrollIntoView()` and the background color highlight animation since it's the visually prominent container
3. **Non-breaking** — only activates as a fallback after the ChatGPT Chat selector fails, so regular ChatGPT continues to work unchanged
4. **No `@match` changes needed** — `chatgpt.com/*` already covers `chatgpt.com/codex`

### Result
Codex web conversations now show all user messages in the navigation panel, with correct summaries and click-to-scroll functionality. Regular ChatGPT Chat remains unaffected because its selector matches before the fallback is reached.

---

## [6.3] - 2026-02-12

### Problem
On **Firefox + Linux only**, the Gemini site displayed **"You said"** prepended to every question summary in the navigation panel (e.g. "You said what is vertex ai?" instead of "what is vertex ai?"). This did not reproduce on macOS Firefox with the identical script and identical Gemini conversations.

### Technical Root Cause
Gemini includes a visually-hidden accessibility element (e.g. `<span class="sr-only">You said</span>`) inside each user message container for screen readers. When extracting text via `textContent`, this hidden text is included in the string — `textContent` returns **all** text within an element, including text from elements hidden via CSS.

On Mac, Gemini may serve slightly different HTML based on user-agent detection, or the selector may land on a child element that excludes the accessibility span. On Firefox/Linux, the selected element captures the full container including the hidden prefix.

### First Attempt — Failed
Added a `text.replace(/^You said\s*/i, '')` regex strip in `scanConversation()` right after extracting `textContent`:

```javascript
let text = msg.textContent || msg.innerText || '';
text = text.replace(/^You said\s*/i, '');
```

**Why it failed:** The `^` anchor in the regex matches only the very start of the string. But `textContent` on a DOM element with nested children returns the raw text of the entire subtree, **including whitespace and newlines from HTML indentation**. The actual string looked something like `"\n    You said i already updated..."` — the leading whitespace meant "You said" wasn't at position 0, so `^You said` never matched. The regex was correct in logic but wrong in assumption about the input format.

**Tested:** Restarted Firefox, refreshed Gemini — "You said" still appeared on every question. Confirmed the fix did not work.

### Second Attempt — Success
Added `.trim()` to the text extraction **before** applying the regex:

```javascript
let text = (msg.textContent || msg.innerText || '').trim();
text = text.replace(/^You said\s*/i, '');
```

**Why this works:** `.trim()` strips all leading and trailing whitespace (including `\n`, `\t`, spaces) from the raw `textContent` output. After trimming, the string starts directly with "You said", and the `^`-anchored regex now matches correctly. The trim is harmless for all other platforms — user message text never has meaningful leading/trailing whitespace.

### Result
After the second fix, question summaries on Gemini display clean text without the "You said" accessibility prefix. Confirmed working on Firefox/Linux after a full browser restart. The fix is a no-op on other platforms where the prefix doesn't exist.

---

## [6.2] - 2026-02-12

### Problem
Opening the Navigate sidebar on **Claude Code** (`claude.ai/code`) showed the sidebar correctly (since the hostname is still `claude.ai`) but detected **0 questions** — no user messages appeared in the navigation list.

### Technical Root Cause
Claude Code uses a completely different DOM structure from Claude Chat. The existing selectors for Claude relied on `data-testid` attributes (`user-human-turn`, `user-message`) and the `.font-user-message` class — **none of which exist in Claude Code's DOM**.

In Claude Code, the conversation uses a Tailwind CSS-based layout where:
- Each turn is wrapped in a `div.pb-4` container
- **User messages** are right-aligned via `div.flex.flex-col.items-end.ml-auto`
- The message bubble uses `div.bg-bg-200.rounded-lg`
- Text content sits inside nested `<p>` tags
- There are no `data-testid` attributes anywhere in the DOM

### Method Chosen and Why
Added a **fallback selector chain** in `getUserMessages()` that activates only when the existing Claude Chat selectors find nothing:

```javascript
const bubbles = document.querySelectorAll('div.bg-bg-200.rounded-lg');
messages = Array.from(bubbles).filter(function(bubble) {
    return bubble.closest('.items-end');
});
```

This approach:
1. **Selects message bubbles** (`bg-bg-200.rounded-lg`) — the visible rounded containers that hold message text
2. **Filters for user messages only** by checking if the bubble is inside a right-aligned container (`.items-end`) — assistant messages are left-aligned and won't match
3. **Works well with existing scroll/highlight logic** — the bubble element is ideal for both `scrollIntoView()` and the background color highlight animation since it's the visually prominent container
4. **Non-breaking** — only activates as a last fallback after all Claude Chat selectors fail, so Claude Chat continues to work unchanged

---

## [6.1] - 2026-02-09

### Problem
On Linux (NVIDIA DGX Spark, Ubuntu-based), clicking the Navigate button in Firefox caused a second identical button to appear. Both buttons were fully functional — hovering expanded either one, clicking either one toggled the panel — but having two buttons caused state corruption. Clicking the "stationary" duplicate would close the panel normally, but clicking the "correct" button that moved with the panel would sometimes cause all questions to disappear or their labels to shorten from "Question #1" to "Q1". This happened across all four AI platforms (Claude, ChatGPT, Grok, Gemini) but only on Linux Firefox — the exact same script worked perfectly on macOS Firefox.

### Technical Root Cause
The v6.0 code had a **race condition** between three systems that fire during page load:

1. **Initialization code** at the bottom of the script runs `document.body.appendChild(createToggle())`, which adds the toggle button to the DOM.
2. **DOM Guardian** — a `MutationObserver` watching `document.body` with `{ childList: true, subtree: true }` — immediately detects this DOM mutation and fires its callback.
3. **`ensureElementsExist()`** — called by the DOM Guardian's callback — checks `if (!document.getElementById('ai-nav-toggle'))`. If this check runs *during* the `appendChild` call (before the browser has finished attaching the element), it evaluates to `true` and creates a second toggle.

The key difference between operating systems: **macOS Firefox batches MutationObserver callbacks asynchronously**, so by the time the observer fires, both `createToggle()` and `createPanel()` have already been appended and their IDs are queryable. **Linux Firefox fires the observer synchronously during the DOM mutation itself**, so `getElementById` can't find the element that's in the middle of being attached.

A secondary cause: Tampermonkey on Linux Firefox occasionally fires the entire userscript twice during the document lifecycle (related to how Firefox on Linux handles `document-start` vs `document-end` timing), which would create two complete, independent sets of elements with no awareness of each other.

The state corruption (disappearing questions, "Question #1" labels shortening to "Q1") happened because two independent toggle buttons maintained their own click handlers but shared the same `isOpen` state variable and the same panel. Clicking one button would flip `isOpen` and trigger `scanConversation()`, but the other button's state was now out of sync, leading to the panel being "open" according to one button and "closed" according to the other.

### Method Chosen and Why
We needed to prevent duplication at every possible entry point, since the duplication could come from multiple sources (script double-firing, MutationObserver racing, or both). A single fix wouldn't be sufficient because the script fires twice through *different* code paths. We chose four complementary guards:

1. **Execution guard (`window._aiNavAlreadyLoaded`)** — A flag on the global `window` object, checked at the very top of the IIFE before any code runs. If `true`, the entire script exits immediately. We chose `window` (not a local variable) because each Tampermonkey execution gets its own closure, but they share the same `window`. This catches the "Tampermonkey fires twice" scenario.

2. **Duplicate element cleanup in `ensureElementsExist()`** — Before checking if elements are missing, we first check if *multiple* elements with the same ID exist and remove the extras. This is a safety net — even if a duplicate somehow gets created through a path we didn't anticipate, it gets cleaned up the next time any code path calls `ensureElementsExist()`.

3. **Debounced DOM Guardian (200ms)** — Instead of the MutationObserver callback immediately calling `ensureElementsExist()`, it now sets a 200ms `setTimeout` and clears any previous timeout. This means rapid-fire mutations (like our own initialization appending multiple elements) get batched into a single check after everything settles. 200ms was chosen because it's long enough for initialization to complete but short enough that a genuinely removed element gets re-injected quickly. This directly addresses the race condition — the observer still fires during our `appendChild`, but it just sets a timer instead of immediately checking/injecting.

4. **Guarded initialization** — The `document.body.appendChild(createToggle())` calls at the bottom are now wrapped in `if (!document.getElementById('ai-nav-toggle'))`. This prevents the initialization code itself from creating duplicates if it somehow runs after the DOM Guardian has already created elements. Belt and suspenders.

### How It Fixed Things
After applying all four guards, the duplicate button is completely eliminated on Linux Firefox. The execution guard catches the most common case (double script firing). The debounced observer prevents the race condition. The guarded initialization and duplicate cleanup serve as safety nets. Together, they ensure exactly one toggle and one panel exist regardless of how many times or in what order the code paths execute.

### What Didn't Work (Red Herrings)
During debugging, we also observed the ChatGPT button being invisible and Claude showing 0 questions. We spent time investigating these as potential script bugs:
- **Attempted fix: Broader CSS selectors for Claude** — Added fallback selectors like `[data-testid*="human"]` and filtered `[data-testid*="user"]` queries. Did not help because the original selectors were correct.
- **Attempted fix: Changed ChatGPT icon from ⏣ to ⬡** — Theorized that the benzene ring character (U+23E3) wasn't rendering on Linux's default fonts. Changed to white hexagon (U+2B21). Did not help because the icon was rendering fine.
- **Attempted fix: Added scan retry logic** — Created `scanWithRetry()` that would retry up to 5 times at 1.5-second intervals if 0 messages were found on a conversation page. Did not help.

All three issues turned out to be caused by **system resource exhaustion** on the DGX Spark — too many Firefox tabs open, system under memory pressure. Symptoms included keyboard input freezing and pages not rendering correctly. A system reboot resolved all rendering issues without any code changes. We reverted all unnecessary patches to keep the codebase clean.

**Lesson learned:** On resource-constrained systems with many browser tabs open, rule out system-level issues (`free -h`, `htop`) before debugging the script.

---

## [6.0] - 2026-02-07

### Changed
- **New hover-expand button design** — Button now shows only the platform icon by default, and smoothly expands to reveal "Navigate" text on hover. Cleaner look with a smaller screen footprint.
- **Platform-specific icons** — Each platform now has a unique symbol on the toggle button instead of a generic 📍 pin emoji:
  - Claude: ✳ (eight-spoked asterisk — evokes Anthropic's starburst logo)
  - ChatGPT: ⏣ (benzene ring — evokes OpenAI's hexagonal logo)
  - Grok: X (xAI / X branding)
  - Gemini: ✦ (four-pointed star — evokes Gemini's sparkle)
- Icons use common Unicode symbols to avoid any trademark, copyright, or proprietary issues with company logos

### Design Notes
The hover-expand design was chosen to balance minimalism with discoverability. The icon-only resting state keeps the button unobtrusive, while the hover expansion ensures users can always confirm what the button does. This design also scales well for potential future feature buttons (Search, Settings, etc.) that could stack alongside Navigate.

---

## [5.0] - 2026-02-07

### Problem
On Gemini in Chrome, the Navigate button appeared on screen but clicking it did nothing — the sidebar panel never slid out. The button worked fine on Firefox. It sometimes worked immediately after first installing the script, but broke after a page refresh.

### Technical Root Cause
Gemini enforces a **Trusted Types Content Security Policy (CSP)** on Chrome. This is a browser security feature that blocks all direct `innerHTML` assignments to prevent Cross-Site Scripting (XSS) attacks.

Our script (v4.0) was using `innerHTML` to build the panel contents — the header, refresh button, question list, and empty state message. When the script ran on Gemini in Chrome, every single `innerHTML` assignment was silently blocked by the CSP. The result: the panel `<div>` was created and appended to the DOM, but it was completely empty inside. The toggle button would technically slide open an empty, zero-height, invisible panel — making it look like the button was completely broken.

DevTools Console showed: `TypeError: Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.`

This only affected Chrome because Firefox does not enforce Trusted Types CSP the same way.

A secondary problem was that Gemini is built on Angular and aggressively re-renders its DOM. Even when elements were successfully injected, Angular's change detection cycle could silently remove them. The button and panel would simply vanish without any error message, making the issue intermittent and hard to diagnose.

### Method Chosen and Why
**For the Trusted Types issue:** We replaced every instance of `innerHTML` with **programmatic DOM creation** using `document.createElement()`, `.textContent`, and `.appendChild()`. This approach is inherently Trusted Types compliant because you never assign raw HTML strings — you're building the DOM tree element by element. We created a reusable helper function `createElement(tag, attrs, children)` to keep the code readable despite the more verbose syntax.

**For Gemini's DOM re-rendering:** We added three defensive systems:
- **DOM Guardian** (MutationObserver) — continuously watches `document.body` and re-injects elements if Gemini removes them. This catches Angular's silent element removal.
- **SPA navigation hooks** — intercepts `history.pushState` and `history.replaceState` so elements survive when switching conversations (which Gemini handles as SPA route changes, not full page loads).
- **Periodic health check** — a `setInterval` running every 3 seconds on Gemini only, verifying elements are still in the DOM as a last line of defense.

We also merged two separate `addEventListener('click', ...)` handlers on the toggle button into a single unified handler (`handleToggleClick`), eliminating a potential race condition where both handlers could fire independently.

### How It Fixed Things
After replacing all `innerHTML` with programmatic DOM creation, the panel builds correctly on Gemini Chrome because no Trusted Types violation occurs. The three defensive systems ensure elements survive Gemini's aggressive re-rendering. The fix is backward-compatible — programmatic DOM creation works identically on all browsers, so no platform-specific code branching was needed.

---

## [4.0] - 2026-02-05

### Added
- Gemini (gemini.google.com) support with blue theme
- Platform-specific color themes for all four AI assistants

### Supported Platforms
- Claude (Orange)
- ChatGPT (White/Gray)
- Grok (Red)
- Gemini (Blue)

---

## [3.0] - 2026-02-05

### Added
- Grok (grok.com) support with red theme
- Updated color scheme: ChatGPT changed from green to white/grayscale

---

## [2.0] - 2026-02-05

### Added
- ChatGPT (chatgpt.com, chat.openai.com) support
- Site detection to apply different selectors per platform
- Platform-specific accent colors (Orange for Claude, Green for ChatGPT)

---

## [1.0] - 2026-02-05

### Added
- Initial release
- Claude.ai support
- Navigation sidebar with question bookmarks
- Smart summary generation (extracts questions or first sentences)
- Click-to-scroll with highlight animation
- Auto-refresh every 10 seconds while panel is open
- Dark theme UI
