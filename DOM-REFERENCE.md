# DOM Reference — AI Conversation Navigator

This document records the **real DOM structure** of user messages on each supported platform, the selectors we chose, and the debugging history that led to each choice. This prevents context loss across sessions.

Last updated: Feb 16, 2026 (v7.7)

---

## Table of Contents
1. [Claude](#claude)
2. [ChatGPT](#chatgpt)
3. [Grok](#grok)
4. [Gemini](#gemini)
5. [Claude Code Web](#claude-code-web)
6. [Codex Web](#codex-web)
7. [Perplexity](#perplexity)
8. [Lovable](#lovable)
9. [Replit](#replit)
10. [Bolt.new](#boltnew)
11. [V0](#v0)
12. [Base44](#base44)
13. [Emergent](#emergent)
14. [Firebase Studio](#firebase-studio)

---

## Claude

**Selector:** `[data-testid="user-human-turn"]`
**Fallback:** `[data-testid="user-message"]`, `.font-user-message`

### Notes
- Reliable data-testid attribute, rarely changes
- Both Claude Chat and Claude Code Web share the same hostname (`claude.ai`), differentiated by path

---

## ChatGPT

**Selector:** `[data-message-author-role]` filtered by value `=== 'user'`

### Notes
- `data-message-author-role` has values like `"user"`, `"assistant"`, `"system"`
- Both ChatGPT Chat and Codex Web share the same hostname (`chatgpt.com`), differentiated by path

---

## Grok

**Selector:** `div.message-bubble` filtered by class containing `user`/`human`, or parent class, or odd index

### Notes
- Less reliable than other platforms — uses heuristic-based detection
- Falls back to `[data-role="user"]` and `[class*="user-message"]`
- May need re-inspection if Grok redesigns

---

## Gemini

**Selector:** `div.query-text`

### Notes
- Very clean, reliable class-based selector
- No filtering needed — all `query-text` elements are user queries
- Multiple fallbacks: `.query-text-line`, `p.query-text-line`, `[data-query-text]`, `.user-query`

---

## Claude Code Web

**Selector:** `div.bg-bg-200.rounded-lg` filtered by `.items-end` parent

### Notes
- Completely different DOM from Claude Chat — no `data-testid` attributes anywhere
- User messages are right-aligned via `div.flex.flex-col.items-end.ml-auto`
- The message bubble is `div.bg-bg-200.rounded-lg`, text inside nested `<p>` tags
- Only activates as a fallback when all Claude Chat selectors find nothing (same hostname `claude.ai`)

---

## Codex Web

**Selector:** `div.self-end.bg-token-bg-tertiary`

### Notes
- Completely different DOM from ChatGPT Chat — no `data-message-author-role` attributes
- Uses a task/thread/item model rather than a traditional chat layout
- User messages are right-aligned (`self-end`) with tertiary token background
- Only activates as a fallback when the ChatGPT Chat selector finds nothing (same hostname `chatgpt.com`, detected by `/codex` path)

---

## Perplexity

**Selector:** `.group\/query` (Tailwind group variant)

### Notes
- Clean Tailwind group class selector with escaped slash
- Filter by text content length > 0
- Fallback: `.group\/title .select-text`
- Very reliable, minimal filtering needed

---

## Lovable

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `div[role="log"]` → query `.justify-end` children
**Path guard:** Only active on `/projects/` routes

### Real DOM Structure (A→L nesting)

```
A: div[position:absolute, width:100%, top:..., visibility:visible]  (positioned container — virtual scroll layout)
  B: div#umsg_{id}[data-message-id="umsg_{id}"].flex-col.pb-2.group  (message wrapper)
    C: div  (empty wrapper)
      D: div.mb-2.flex.w-full.flex-col.items-center.text-muted-foreground.@container
        E: div.relative
          F: div.group.flex.flex-col.gap-2.items-end.pr-4  (alignment — items-end for user)
            G: div.flex.w-full.items-start.gap-2.justify-end  (justify-end for user — OUR TARGET)
              H: div.overflow-wrap-anywhere.max-w-[75%].rounded-[18px].bg-muted.px-4.py-2.5  (bubble)
                I: div
                  J: div.flex.flex-col.gap-2
                    K: div.prose.prose-zinc.prose-markdown-mobile.max-w-full.PromptBox_customProse
                      L: <p>actual text</p>
            M: div.mt-1.flex.w-full.gap-1.justify-end  (action buttons — SVG icons, no text)
```

AI messages use `items-start` + `justify-start` instead, and `data-message-id="msg_{id}"` (no `umsg_` prefix).

### Selector Rationale
- `role="log"` scopes the search to the chat container
- `.justify-end` distinguishes user messages (right-aligned) from AI (left-aligned)
- `data-message-id="umsg_..."` could be used but `role="log"` + `.justify-end` works reliably
- Action button rows also have `.justify-end` but contain only SVG icons (no text content), so text-content filtering excludes them
- Split-panel layout: chat on left, preview iframe on right
- Uses positioned containers (`position: absolute`) suggesting virtual scroll layout

### Debugging History
- v7.4: Original mock worked but was not based on live DOM
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Discovered real structure uses positioned containers, `data-message-id` with `umsg_`/`msg_` prefixes, `@container` class, and `prose-zinc prose-markdown-mobile` text containers. Fixed mock action buttons from emoji text to SVG to prevent false `.justify-end` matches.

---

## Replit

**Inspected:** Feb 2026 (live site)
**Selector:** `[data-cy="user-message"]`
**Boundary detection:** `[data-cy="user-message"], [data-event-type="user-message"], [role="log"]`

### Real DOM Structure (A→H nesting)

```
A: div.EventRenderer-module_{hash}_userMessage  (outer event wrapper)
  B: div[data-cy="user-message"][data-event-type="user-message"]  (message wrapper — OUR TARGET)
    C: div.UserMessage-module_{hash}_userMessageSurfaceShades  (outer surface)
      D: span  (layout wrapper)
        E: div.UserMessage-module_{hash}_userMessageSurfaceShades[data-acknowledged="true"]  (bubble)
          F: div.rendered-markdown
            G: div.Markdown-module_{hash}_markdownTheme
              H: <p>actual text</p>
```

### Debugging History & Selector Choice

**Problem (v7.5):** 3x duplicate questions detected per message.

**Root cause:** Elements A, C, and E all contain `userMessage` in their CSS module class names. A class-based selector like `[class*="userMessage"]` matched all three per message, giving 3x results.

**Why `[data-cy="user-message"]` was chosen:**
- It's a Cypress test attribute (stable, unlikely to change)
- Only exists on element B — exactly 1 per user message
- We originally used `[data-testid="user-message"]` which returned 0 (wrong attribute name!)
- `data-cy` is Replit's convention, NOT `data-testid`

**Other rejected selectors:**
- `[class*="userMessage"]` → 3x duplicates (matches A, C, E)
- `[data-testid="user-message"]` → 0 results (attribute doesn't exist)
- `[data-acknowledged="true"]` → would match the bubble (E), but less semantically clear

**Ghost notch first-load bug (also v7.5):** Boundary detection Strategy 2 had the same wrong `data-testid` selector. Fixing it to `data-cy` also fixed the ghost notch.

---

## Bolt.new

**Inspected:** Earlier sessions (live site)
**Selector:** `[data-message-id]` filtered by `.self-end` or `bg-bolt-elements-messages` class
**Boundary detection:** `[class*="backdrop-blur"][class*="rounded"], [class*="max-w-chat"]`

### DOM Structure

```
div[data-message-id="msg-{n}"].self-end.bg-bolt-elements-messages-background.rounded-lg
  div._MarkdownContent_{hash}_1
    <p>actual text</p>
```

AI messages have `data-message-id` but do NOT have `.self-end`.

### Debugging History & Selector Choice

**Problem:** Token/subscription warning alerts (`"You've used all your tokens"`) were being detected as user questions.

**Root cause:** The warning area has class `bg-bolt-elements-prompt-subscribeButton-background` and lives in the prompt section. A broad selector that just looked for text in the chat area would pick it up.

**Why `[data-message-id]` + `.self-end` filter was chosen:**
- `data-message-id` exists on actual message containers only (not warnings/alerts)
- `.self-end` distinguishes user messages (right-aligned) from AI messages
- Explicit exclusion of `[class*="subscribeButton"]` and `[class*="prompt-subscribe"]` as safety net
- Also supports bolt.diy fork which uses `backdrop-blur` + `ml-auto` pattern instead

**Other notes:**
- bolt.diy fork uses different classes — multiple fallbacks handle both versions
- `_MarkdownContent_` class has a hash suffix that can change between deployments

---

## V0

**Inspected:** Feb 15, 2026 (live site)
**Selector:** `[data-testid="message"]` filtered by `origin-right` + `items-end` classes
**Boundary detection:** `[data-testid="message"]`

### Real DOM Structure

```
A: div.flex.items-end.sm:max-w-[min(fit-content,80%)].max-w-[90%].origin-top-right  (outer alignment wrapper)
  B: div[data-testid="message"][role="listitem"].origin-right.items-end  (message container — OUR TARGET)
     id="B5MFcT4HjyB5mw53ouX4mT897ZCGZdsm" (unique hash)
     class="@container/message group w-full break-words flex flex-col gap-2 origin-right items-end"
     data-touch-active="false"
    C: div.flex.items-center.gap-1.5.pr-1  (avatar/link row)
      D: a[data-state="closed"] href="/chat/api/profile/redirect?..."  (user profile link)
    E: div.flex.items-end  (bubble wrapper, style="transform: none; opacity: 1")
      F: div.border.border-v0-gray-200.bg-v0-gray-200.group/message-bubble.rounded-[16px]  (the bubble)
        G: svg  (small decoration icon, absolute positioned)
        H: div.prose.prose-sm.prose-gray.min-w-0.break-words.w-full  (text container)
          I: <p>actual question text</p>
```

AI messages use the same `data-testid="message"` but with `origin-left items-start` instead.

### Debugging History & Selector Choice

**Problem (pre-v7.7):** 0 questions detected. Button invisible until page refresh.

**Root cause:** ALL 6 primary selectors were guesses that don't exist in V0's DOM:
- `[data-role="user"]` — doesn't exist
- `[data-message-role="user"]` — doesn't exist
- `[data-message-author-role="user"]` — doesn't exist
- `[data-message-author="user"]` — doesn't exist
- `[data-testid*="user-message"]` — actual value is `"message"` (no "user" in it)
- `[data-sender="user"]` — doesn't exist

ALL 6 fallbacks also failed because V0 doesn't use:
- `justify-end`, `self-end`, `ml-auto` (V0 uses `items-end`, `origin-right` instead)
- `bg-muted`, `bg-secondary` (V0 uses `bg-v0-gray-200`)
- `[data-message-id]` (V0 uses regular `id` attribute with hash)

**Why button was invisible:** Boundary detection Strategy 2 used `[data-role="user"]` which also doesn't exist. No boundary found → button stays hidden. Fixing to `[data-testid="message"]` fixes both problems.

**Why `[data-testid="message"]` + class filter was chosen:**
- `data-testid="message"` is on ALL messages (user + AI)
- User messages have `origin-right` and `items-end` classes
- AI messages have `origin-left` and `items-start` classes
- Filtering by `origin-right && items-end` reliably distinguishes user messages

**Other rejected approaches:**
- Using bubble class `bg-v0-gray-200` — less reliable, could change with themes
- Using `role="listitem"` — matches both user and AI, same filtering needed
- Using the unique `id` attribute — IDs are random hashes, not predictable

---

## Base44

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `[id^="message-"]` filtered by containing `.justify-end` child

### Real DOM Structure (A→J nesting)

```
A: div.flex-grow.overflow-y-auto.px-4.space-y-2.pb-4.scrollbar-auto-hide.relative.z-10  (scroll container)
  B: div.relative
    C: div#message-{uuid}.transition-opacity.duration-300  (message wrapper — matched by [id^="message-"])
      D: div.mb-6.relative.flex.justify-end.items-start.gap-2  (alignment — justify-end for user)
        E: div.text-sm.rounded-xl.p-3.bg-slate-200.max-w-[85%].min-w-[250px].relative  (bubble)
          F: div
            G: div.prose.dark:prose-invert.max-w-none.base44-markdown.relative  (text container)
              H: <p>actual text</p>
          I: div.text-xs.text-gray-400.mt-2.flex.items-center.justify-between  (metadata/timestamp)
        J: span.relative.flex.overflow-hidden.rounded-full.h-6.w-6.shrink-0  (avatar)
```

AI messages use `justify-start` instead of `justify-end` in element D, and `bg-white` instead of `bg-slate-200` for the bubble.

### Selector Rationale
- `id="message-{uuid}"` exists on ALL messages (user + AI) — needs filtering
- User messages have a `.justify-end` child div (right-aligned)
- AI messages have `justify-start` (left-aligned)
- Fallback uses `bg-slate-200.rounded-xl` bubble color (user-specific)
- Parent container has `id="chat-panel-container"` and `scrollbar-auto-hide` class
- Avatar spans (`rounded-full h-6 w-6`) appear after user bubble, before AI bubble

### Debugging History
- v7.4: Original mock worked but was not based on live DOM
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Discovered real structure uses `transition-opacity duration-300`, `chat-panel-container` parent, `base44-markdown` text class, avatar spans with `rounded-full h-6 w-6`, and timestamp metadata rows.

---

## Emergent

**Inspected:** Feb 15, 2026 (live site)
**Selector:** `[data-testid^="user-message"]` with innermost deduplication
**Boundary detection:** Emergent-specific: `[data-testid="virtuoso-scroller"]` → use right edge directly

### Real DOM Structure (A→M nesting)

```
A: div[data-index="N"][data-item-index="N"][data-known-size="..."]  (virtuoso item wrapper)
  B: div.flex.justify-center.w-full.min-h-[1px]  (centering)
    C: div.w-full.hover:bg-rgba(255,255,255,0.02)  (hover background)
      D: div.mx-auto.px-4  (auto margin)
        E: div#user-task[data-testid="user-message-user-task"].relative.group.flex.justify-center  (OUR TARGET)
          F: div.my-4.group.flex.flex-col.space-y-[10px]...justify-end.items-end  (alignment wrapper)
            G: div.px-4.py-1.rounded-xl.rounded-br-none.bg-[#273638]  (the bubble)
              H: div.flex.items-start.gap-3  (content row)
                I: div.flex-1.min-w-0  (text wrapper)
                  J: div.prose.prose-invert.max-w-none  (prose container)
                    K: div.my-1.overflow-hidden.text-[#acfe3e6]  (font styling)
                      L: div.text-wrap.break-words  (text wrap)
                        M: p.my-4.font-['Inter']  (actual text)
```

Chat container uses virtuoso virtual scroller:
```
div.relative.flex-1.w-full.h-full.overflow-hidden  (chat panel — flex child)
  div.absolute.inset-0  (full coverage overlay)
    div[data-testid="virtuoso-scroller"][data-virtuoso-scroller="true"]  (scroll container)
      div[data-testid="virtuoso-item-list"]  (virtual list)
        div[data-index="N"]  (individual items — recycled on scroll)
```

### Debugging History & Selector Choice

**Problem 1: Ghost notch button invisible (stays at opacity 0 until hover)**

**Root cause (boundary detection failure):** The standard `_walkUpToChatContainer` walks up from a message element looking for a container with `width < 65% viewport`. But Emergent's DOM uses `div.absolute.inset-0` which can span the full viewport width (because its positioned parent `div.relative.flex-1.w-full` inherits width from the flex layout). Walking up past this point hits full-width elements that fail the width check → `getChatBoundaryX()` returns null → `.ai-nav-positioned` class never added → opacity stays at 0.

**Root cause (recovery failure):** The periodic boundary check (every 3 seconds) was resetting `_lastBoundaryX = null` before each call to `updateLeftChatPositions()`. This prevented the two-consecutive-stable-polls requirement from ever being satisfied via the interval. Even if boundary detection eventually worked (after the page fully rendered), the null reset killed it.

**Fix:**
1. Added Emergent-specific boundary detection: find `[data-testid="virtuoso-scroller"]` directly and use its `rect.right` as the chat boundary (bypasses the walk-up entirely)
2. Removed `_lastBoundaryX = null` from the periodic interval to allow late-rendering platforms to eventually achieve stable detection

**Why `[data-testid^="user-message"]` was chosen for message detection:**
- `data-testid="user-message-user-task"` is a clear, specific attribute
- Only exists on user messages (AI messages use different testid patterns like `assistant-message-*`)
- Deduplication filter (keep innermost only) prevents nested matches

**Other notes:**
- User message bubbles have `rounded-br-none` (bottom-right corner sharp), AI bubbles have `rounded-bl-none`
- Virtual scrolling means DOM elements are recycled — messages scrolled far out of view may not be in the DOM
- **Accumulative scanning**: Because of virtuoso, `scanConversation` uses accumulation mode for Emergent — it adds new messages to the list without clearing existing ones. This prevents the list from changing as the user scrolls. The Refresh button does a full reset.
- **Scroll-through collection**: On panel open, script programmatically scrolls through the entire virtuoso container (250ms per viewport step) to force-render and collect all user messages, then restores scroll position.
- **Stale DOM references**: When clicking a nav item, the original DOM element may have been recycled. The click handler re-searches the DOM for a matching element at click time using `isConnected` check.
- **Broad fallbacks removed**: Fallbacks 3-7 (rounded-br-none, items-end, text-wrap, etc.) were matching AI agent status messages when user messages scrolled out of view. Only the primary selector and user-task ID fallback remain.

---

## Firebase Studio

**Selector:** `[class*="_chatMessage_"][class*="_isUser_"]` (CSS module pattern)

### Notes
- CSS module classes with dynamic hash suffixes (e.g., `_chatMessage_qlgvg_30 _isUser_qlgvg_47`)
- Requires BOTH module class substrings present in the class attribute
- Hash values change between deployments — we match the stable prefix part
- Multiple fallbacks test individual module names and camelCase variants (`chatMessage`, `isUser`)

---

## General Patterns

1. **Best selectors** (in order of reliability):
   - `data-testid` / `data-cy` attributes (Claude, Replit, Emergent)
   - `data-message-author-role` attributes (ChatGPT)
   - Stable class names (Gemini's `query-text`, Perplexity's `group/query`)
   - `data-message-id` + alignment filter (Bolt, V0)
   - ARIA roles + alignment (Lovable)

2. **Common pitfalls**:
   - CSS module hash classes change between deploys — match prefix only
   - Nested elements sharing similar attributes → deduplication needed
   - Subscription/warning areas can match broad selectors → explicit exclusion
   - `data-testid` vs `data-cy` — platforms use different conventions
   - Alignment classes differ: `self-end`/`justify-end`/`ml-auto` vs `items-end`/`origin-right`
