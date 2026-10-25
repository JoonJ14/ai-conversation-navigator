# DOM Reference — AI Conversation Navigator

This document records the **real DOM structure** of user messages on each supported platform, the selectors we chose, and the debugging history that led to each choice. This prevents context loss across sessions.

Last updated: Jul 29, 2026 (v12.1 — Probe E added: the conversation payload's thinking-block shape. Claude's DOM was fully re-inspected Jul 26, 2026 for v12.0; the other 13 platforms were last verified Feb 18, 2026 and have NOT been re-checked since)

> ⚠️ **Staleness warning.** Claude's selectors drifted substantially between Feb and Jul 2026 without anyone noticing, because the fallback chains absorbed it and the mock-based test suite stayed green. Assume the other 13 entries carry the same risk until re-inspected.

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

Before using any selector below: [Virtualization status](#virtualization-status--check-this-before-trusting-any-selector-count) — the DOM is only a complete record on platforms that do not virtualize.

Live probes (measurement context stated in each): [Probe D — no native scroll-to-index](#probe-d--no-native-scroll-to-index-2026-07-27-chromium-page-realm-live-claudeai) · [Probe E — conversation payload thinking-block shape](#probe-e--conversation-payload-thinking-block-shape-2026-07-29-chromium-page-realm-live-claudeai)

---

## Virtualization status — check this before trusting any selector count

**Every selector in this document describes what is in the DOM. On a virtualizing platform that is
not the same thing as what is in the conversation.** Claude proved that the hard way (see
`TROUBLESHOOTING.md` → "Why v12.0 and v12.1 Exist"), and there is no reason the others will not
follow — virtualization is the standard fix for a slow chat page, not a Claude quirk.

| Platform | Virtualizes? | Last checked | Strategy in use |
|---|---|---|---|
| **Claude** (`claude.ai/chat`) | **YES — Virtuoso-style recycling**, ~3–7 of N turns mounted | Jul 26, 2026 | **API-backed conversation index** (DEC-021). DOM is the labelled fallback. |
| **Emergent** (`app.emergent.sh`) | **YES — Virtuoso recycling**, `[data-testid="virtuoso-scroller"]` | Feb 15, 2026 | **Accumulation only** — scans keep messages the user has already scrolled past, plus click-time re-resolution of stale references. **Nothing sweeps.** See the ⚠️ below. |
| **Gemini** | **NO recycling at n≤10 — measured**; unresolved at 100+ | Jul 30, 2026 | DOM. Measured live (Chromium, page realm, owner's account, visible tab, 10-turn conversation — the longest available): all 10 turns mounted at top/middle/bottom scroll positions, held references stayed `isConnected` with text intact; zero `cdk-virtual-scroll-viewport` nodes. Owner's Firefox observation at n≈10–20 corroborates. `docs/CONTEXT-TRACKING.md` / `docs/BOOKMARKS.md` claims that "only viewport messages exist in DOM" are **contradicted at this scale** — but the scroller is literally `<infinite-scroller class="chat-history">`, so lazy-loading at 100+ turns remains possible and unmeasured. No conversation that long exists on the test account. |
| **ChatGPT** (`chatgpt.com/c/<id>`) | **YES — a sliding window**, 4–7 user turns mounted, the rest removed | Oct 23, 2026 | **API-backed index adapter** (v12.10, DEC-046). DOM is the labelled fallback. Measured live (Chrome, page realm, owner's account, visible tab; 10- and 130-question conversations). |
| **Perplexity** (`perplexity.ai/search/<id>`) | **YES — the entries in view plus the latest**, the rest removed | Oct 23, 2026 | **API-backed index adapter** (v12.10, DEC-046). DOM is the labelled fallback. Measured live (Chrome, page realm, owner's account; 12-entry thread). |
| Grok | not observed | Feb 18, 2026 | DOM |
| Claude Code Web · Codex Web | not observed | Feb 18, 2026 | DOM |
| Bolt · Lovable · Replit · V0 · Base44 · Firebase Studio | not observed | Feb 18, 2026 | DOM |

> ⚠️ **"Not observed" is not "verified absent."** The rows marked "not observed" were checked in February, *before anyone
> knew to look for this failure mode*, and a short test conversation cannot distinguish a virtualized
> list from a complete one. Claude's own answer flipped between February and July with no
> announcement, no error, and a green test suite.

### ⚠️ The `virtualScroll` platform flag does NOT mean "this platform virtualizes"

Read this before using the flag to assess anything. In the platform registry:

```js
claude:   { virtualScroll: false, ... }   // the MOST virtualized platform in the project
emergent: { virtualScroll: true,  ... }   // the only `true` in the file
```

The flag selects **accumulative scanning** (keep messages across scans instead of clearing), not the
platform property. Claude is `false` because it does not use that strategy — it
uses the index instead. So grepping `virtualScroll` to find virtualized platforms returns exactly the
wrong answer, and the name invites that mistake. **This table, not the flag, is the record of which
platforms virtualize.** A rename is on the backlog; it touches 12 platform configs and so needs the
full acceptance matrix.

### Two questions, not one

"Does it virtualize?" only opens the decision. The second question decides the whole response, and
this project has a worked example of each answer:

| | **Sweep may be viable** | **Sweep is not viable** |
|---|---|---|
| Candidate | short sessions — estimate the cost before assuming | **Claude** — 147+ turns, ~372,000 px of scroll height, and a measured sweep across 0/25/50/75/100% never accumulated past 3 unique turns |
| Strategy | scroll the container in viewport steps, accumulate, re-resolve stale references at click time | non-DOM source of truth (API index) + resolve-on-arrival jumping |
| Cost | modest, but **nobody here has built one yet** | a release, plus a second one for persisted data |

Estimate the sweep cost before choosing: `scrollHeight / clientHeight` viewport steps at ~250 ms each.
Claude's would be roughly **500 steps — minutes on every panel open**, which rules it out on cost
alone.

**Be careful what the Claude coverage measurement actually supports.** It sampled five positions
(0/25/50/75/100%) and found the same 3 turns at each, cumulative unique 3. That is strong evidence
against a *coarse* sweep and it is **not** evidence that a viewport-step sweep would stay incomplete —
intermediate positions were never sampled and could expose different rows. Nobody has run the
fine-grained test on Claude, because the cost argument settled it first. If you are tempted to cite
this measurement for another platform, cite what it measured.

> ⚠️ **Emergent is NOT a worked example of the sweep strategy. It has no sweep.**
> This entry previously said otherwise, and the Emergent section below still claimed a
> "scroll-through collection ... on panel open (250 ms per viewport step)". **That code does not
> exist** — verified by enumerating every scroll mutation in the userscript: the only container
> scroll is Claude's jump machinery, the rest are `scrollIntoView` click handlers, and there is no
> stepped loop anywhere. It is not in `modules/` either, and git history shows no removal. It
> appears to have been documented as designed and never built.
>
> What Emergent *actually* has is **accumulation**: `scanConversation` keeps messages across scans
> instead of clearing, so the Navigate list holds whatever the user has scrolled past **and nothing
> else**. Open a long Emergent session, click Navigate without scrolling, and the panel shows the
> mounted window — the Claude v12.0 failure mode, unmitigated, on a platform the docs described as
> handled.
>
> Compounding it: accumulation dedupes on **normalized message text** (`_vsAccumulatedKeys`), so
> two identical prompts — "continue", "yes", "fix it", routine in an app-builder session — collapse
> into one entry even where coverage is complete. Virtuoso's `data-index` is read three lines later
> and would key it structurally.
>
> Neither issue is measured against a real long Emergent session yet. Both are legible in the code.
> Tracked in `ROADMAP.md` backlog item 7.

### The check, in full

Run on a conversation you **know** is long (100+ turns). A short conversation cannot distinguish a
virtualized list from a complete one — that ambiguity is exactly what hid the Claude break.

**This block is the canonical procedure.** `TROUBLESHOOTING.md` and `ROADMAP.md` point here rather
than restating it — earlier revisions of this PR kept three drifting copies and fixed them one at a
time.

```js
// STEP 0 — Is the selector still good? Do this FIRST.
//   Count what the selector matches, then count the user turns you can SEE on screen.
//   FEWER matches than visible turns => Layer 1 selector drift, not virtualization.
//   (A drifted selector produces the same single-digit, flat count as recycling.)
//   MORE matches than visible is not automatically drift — virtualizers mount overscan
//   rows above/below the viewport and often pin the first or last row permanently (our
//   own claude-virtualized mock mounts a 6-row window PLUS a pinned tail). But do not
//   accept the surplus blindly: a selector that has drifted BROAD matches assistant
//   turns, status rows and other chrome, which also inflates the count. Spot-check that
//   the extra matches are user turns before carrying the number into step 1.

// STEP 1 — How much of the conversation is in the DOM?
document.querySelectorAll('<the user-message selector for this platform>').length
// Single digit on a conversation you KNOW is long => virtualized. Continue.

// STEP 2 — Recycling or lazy loading? Scroll the full length, then re-run step 1.
//   Count grows and STAYS grown  -> lazy loading
//   Count stays flat             -> recycling

// STEP 3 — (recycling only) Does a STEPPED SWEEP accumulate the whole conversation?
//   Scroll in viewport-sized steps; at each stop, add the matches to a Set keyed on
//   something structural. Then ask: does the union reach BOTH ends of the conversation,
//   and how long did the sweep take?
```

**Step 2's two outcomes:**

- **Lazy loading** — nodes accumulate. A sweep before scanning fixes it and the DOM stays a valid
  source. Cheap.
- **Recycling** — the client serves a fixed-size window. Held element references stop being
  trustworthy, which is the expensive part regardless of what else you decide.

**Step 3 is the one that actually decides the architecture, and it is easy to skip.** A flat count in
step 2 proves recycling — *it does not prove that a sweep is futile*. The recycler exposes **different
rows** as the container moves, so scanning at each stop can accumulate the complete set even though
the instantaneous count never rises. Only two results force a non-DOM source of truth:

1. the union stays incomplete no matter how finely you step — **untested on Claude**; only five
   coarse positions were sampled there, see the caveat below — or
2. the sweep is too slow to run whenever a panel opens (Claude: ~500 steps, minutes). **This is the
   condition Claude actually met**, and it was sufficient on its own.

If neither holds, a sweep may be the entire fix. Key the accumulator on something **structural** —
Virtuoso exposes `data-index` — never on message text, or duplicate prompts silently collapse.

**Confirming recycling — accept either form.** Virtualizers come in two flavours and a test for one
gives a false negative on the other:

- **Same-node repurposing** — hold a reference to a mounted row, scroll far away, and inspect the
  reference **while the original row is still off-screen**: the same `Node` now shows *different
  text*. Do not scroll back before looking. A fixed node pool may hand that node to another row while
  you are away and return it to its original content when you come back, which reads as "no
  recycling" when the opposite is true.
- **Detach and remount** — the row is destroyed and a new node created in its place, so the held
  reference reads `isConnected === false` and will *never* show different text.
  `tests/mock-pages/claude-virtualized.html` models this form.

**Which form does Claude use? The repo asserts both, and neither claim is a live measurement.**
`injectBookmarkIcons` guards on recorded identity *because* "React reuses the same DOM node for a
different message" — a real guard written against an observed stale icon. Meanwhile
`claude-virtualized.html` models destroy-and-rebuild and the suite asserts `isConnected === false`
on a scrolled-away node. A mock is a model, not evidence about the live site, and React
reconciliation can legitimately do either depending on keying. **Nobody has characterized the live
behaviour, so defend against both** — which is what the code already does. Resolving it is an open
question (ROADMAP backlog).

Either one means every cached element reference in the codebase is a latent bug, though they fail
*differently*: same-node repurposing scrolls confidently to the **wrong message**, while
detach-and-remount usually produces a silent **no-op** on a disconnected node. Test for both:
`node.isConnected === false` **or** the node's text changed.

**If a platform is recycling, do not start with selectors.** The response is scoped in
`ROADMAP.md` → "Porting the Layer 4 response to another platform".

## Claude

**Inspected:** Jul 26, 2026 (live site — full re-inspection)
**Selector:** `[data-testid="user-message"]`
**Fallback:** `[data-testid="user-human-turn"]`, `.\!font-user-message`, `[data-testid="user_message"]`, `div.bg-bg-300` filtered by `.items-end`

> ⚠️ **Claude virtualizes its message list with recycling.** Only ~3–5 user turns are mounted at any moment; the rest are unmounted. Selector counts here describe the *mounted window*, not the conversation. Message enumeration comes from the API-backed conversation index (DEC-021), not from these selectors. They remain the degraded fallback.

### October 2026: answers, rows and the project link (measured live, Chrome page realm, 2026-10-23/24)

Context: the owner's real Chrome profile, Tampermonkey, v12.12 then v12.13, a visible tab, read through the page
console; seven of the owner's chats (4 to 147 questions, three in a project). Safari and Firefox were not measured
here; the owner's console counts from them are in TROUBLESHOOTING ("Claude answer bookmarks").

| What | Live (Oct 2026) | July 2026 record below |
|---|---|---|
| Answer node | `div[data-testid="assistant-message"]` inside the row; children: `h3.sr-only.select-none` ("Claude responded: <first words>…"), the content (`.prose`), `[data-testid="message-actions"]` | `.font-claude-response` (5 live); `assistant-message` 0 |
| `.font-claude-response` | **outside every row**: in a project chat, the project's name ("Tech", "Jobs") in `div.w-0 > … > a[href="/project/<uuid>"]`, a zero-width side panel (x beyond the window); none outside projects | the answer node |
| Row | `div[data-testid="transcript-row"][data-index][data-rs-index]`, plus `data-perf-row="human"\|"assistant"`, `data-perf-row-from-tail`, `data-perf-row-streaming`, `data-last-message`; the answer node sits five levels below the row (row > 4 `div`s > `assistant-message`) | `[data-index][data-rs-index]`, no testid |
| `aria-setsize` | on a descendant of the row (74 for a 37-question chat) | the `role="article"` wrapper |
| Mount window | about 5 rows at the bottom at load, even in a 4- or 8-question chat; scrolled up, the last ~3 rows stay mounted too (`7b4e5079` at `scrollTop` 0: rows 0–7 plus 13–15; `964bf232` after 50 wheel ticks up: rows 7–15 plus 19–21) | the last ~3 rows always mounted |

- **The project link, exactly** (`9f7c3684`, v12.13): `div.font-claude-response.text-secondary-control.leading-tight`
  (with `group-hover/project:underline`). Its ancestors, innermost first:
  - `a[href="/project/019c14db…"].group/project`
  - `div.rounded-lg.border.px-3.py-4`
  - `div.mt-4`
  - `div.flex.flex-col.gap-5`
  - `div.w-0`

  It also sits inside a `div.opacity-0`. Its box is x = 1249, y = 97, 32×18, in a 1214-px-wide window. Its
  `offsetParent` is not null: it is laid out, not `display: none`, so a visibility filter on `offsetParent` would not
  exclude it.
- **The activity line.** Some answers show a line above the text ("Organizing owner tasks…", "Clarifying refund
  timelines…"), which the payload's text blocks do not hold. An answer that shows it never equals its payload text.
  Where the line sits in the tree was not measured. The sr-only `h3` is dropped by `_cleanText` [code].
  - **The text differs beyond the line too.** On rows 291 and 293 of the 147-question chat (two answers that open with
    thinking, one text block and one `.prose` each), the payload's first 120 characters appear nowhere in the
    rendered text. Full equality, the 200-character key and the 120-character prefix all fail, with the first
    difference at character 1 and 0. The last `.prose` node's text does not equal the last text block either
    [measured, Chrome page realm, v12.12].
  - **Answers with no activity line can still match.** The claim "never equals" rests on the answers measured. An
    answer with no activity line, whose text normalizes equal, still gets a uuid in code (DEC-051).
  - **Against the thinking summaries** [measured, Chrome, v12.12]: rows 289, 291 and 293 open "Organizing owner
    tasks, clea…", "Checking overlooked details…" and "Explaining how federated aut…". Only row 293's text starts with
    its thinking summary. Rows 289 and 291, with two summaries each, contain none at the start. This is consistent
    with July's finding that the line is truncated. 130 of the 147 answers carry thinking summaries.
- **The actions bar holds text that changes:** in `57549439`, `[data-testid="message-actions"]` held 11 characters on
  the last answer (row 73) and 0 on rows 67, 69 and 71 [measured, Chrome page realm, v12.13]. `_cleanText` does not
  exclude it (DEC-051 has the consequence).
- **Rows still line up with the path:** `data-index` was the path position and `data-perf-row` the path's sender on
  every row checked. That was 53 row observations over 5 scroll stops on the 147-question chat (the tail rows were
  counted at every stop, so there were fewer distinct rows), plus the 7 and 5 rows of two other chats. The question
  flags' uuids equalled the path's (16 checked, 0 mismatches).
- **What the payload holds** (`65dfa4f2`, the 147-question chat) [measured, Chrome page realm, v12.12, 2026-10-24]:
  - **Counts:** `chat_messages` 301 (every branch). The active path is 294 (147 questions and 147 answers, strictly
    alternating), with 294 well-formed, unique uuids. No answer lacks a `stop_reason`, and `aria-setsize` is 294.
  - **Text blocks:** 18 of the 147 questions have no text block; every answer has one.
  - **How answers open:** the first block is thinking in 129, text in 16, and tool_use in 2.
  - **Answer block totals:** text 153, thinking 194, tool_use 121, tool_result 121.
  - **The per-message `index` field** runs 0 → 300, strictly increasing along the path, but it is NOT the path
    position. It counts across the whole tree. Production code never reads it; never key on it.
  - **"N messages in payload"** in the console's "conversation index ready" line counts `chat_messages.length` over
    every branch, not the path. DEC-031's v12.9 "295 messages in the payload" counts the same way.
  - A smaller chat, `7b4e5079`: 18 messages, path 16 (one off-path pair).
  - **Open:** whether DEC-031's "144-question conversation" (v12.9–v12.11) is this chat three turns earlier (v12.9
    logged "144 questions (295 messages)"), or whether Navigate's count differs because it drops questions with no
    text. Both fit; neither was verified.
- **Routing** [measured, Chrome page realm, the owner's profile, read-only, 2026-10-24; the installed userscript
  version was not checked]:
  - A project's page (`/project/019c14db…`) had 30 `a[href*="/chat/"]` links, none of the form
    `/project/<id>/chat/<id>`.
  - `/project/019c14db…/chat/9f7c3684…` kept that address (no redirect), showed the title "Claude", and had 0
    `[data-testid="transcript-row"]`.

  So a chat is served at `/chat/<id>` whether or not it is in a project. Bookmarks key on that address
  (docs/BOOKMARKS.md).
- **Questions** render a multi-line message as separate blocks (`<p>`, `<ol>`/`<li>`); the list numbers are CSS, so
  `textContent` lacks them and the breaks between blocks (row 290 of the 147-question chat: 8 `<p>`, 18 `<li>`,
  2 `<ol>`). July's record below has one pre-wrap `<p>` per question.
- `getAIMessages` stops at its first matching selector across the document, so in a project chat it returns only the
  project link. v12.14's bookmarks look for answers inside rows instead (DEC-051).

### v12.0 selector drift (measured live, Jul 26 2026)

The structure documented for v11.x below is **stale**. What changed:

| Selector | v11.x role | Jul 2026 live count |
|---|---|---|
| `[data-testid="user-human-turn"]` | primary | **0** — removed from the turn wrapper |
| `[data-testid="user-message"]` | fallback ("not present in current DOM") | **3** — now the only live user selector |
| `.font-user-message` | fallback | **0** — class is now `!font-user-message` |
| `[data-testid="user_message"]` | fallback | **0** |
| `.font-claude-response` | AI primary | **5** — only live AI selector |
| `[data-testid="ai-turn"]` / `assistant-message` / `.font-claude-message` | AI fallbacks | **0** |
| `[data-testid$="-turn"]` | AI last resort | **0** |

Three things worth internalising:

1. **`data-testid="user-message"` moved.** It used to be a wrapper-level attribute; it now sits on the **inner content node** (old element J). Anything treating the returned element as a *turn* — bookmark icon placement, `getMessageContext`, scroll targets — is now operating on a different node than v11.x assumed. Its `textContent` is clean (no sr-only label, no doubling).
2. **`.font-user-message` → `!font-user-message`.** Tailwind's important prefix. A plain `.font-user-message` selector cannot match it; the escaped form `.\!font-user-message` is required.
3. **Both chains were down to a single working link.** The fallback chains had been silently absorbing this the whole time.

### Virtualizer metadata — the basis for jump-to-message (v12.0)

Claude's virtualizer identifies itself as **rocksteady** and publishes positional metadata
on every rendered row. This is what makes DOM→conversation mapping possible **without text
matching**, which matters because text matching already caused one CRITICAL in v12.0 (the
script's own injected bookmark icon contaminating `textContent`).

| Attribute | Where | Value / meaning |
|---|---|---|
| `data-index`, `data-rs-index` | turn wrapper (9 levels above the message node) | contiguous, **0-based**, covers **both senders** — it indexes MESSAGES, not turns |
| `aria-posinset`, `aria-setsize` | `role="article"` wrapper (level 8) | 1-based position / total row count (`aria-posinset === data-index + 1`) |
| `role="feed"` | the list (level 11) | the virtualized region |
| `data-rocksteady-sizer`, `data-sizer-excess` | sizer (level 10) | virtualizer internals |
| `data-autoscroll-container="true"` | scroller (level 15) | **stable selector for the scroll container** |
| `data-test-render-count` | render wrapper (level 7) | render bookkeeping |

There is **no message uuid anywhere in the DOM** — a full attribute scan of mounted rows,
all ancestors and all descendants returned zero matches against the API's message uuids.
`data-index` is the only stable identifier available.

**Alignment is NOT assumed.** `aria-setsize` reported 294 while the API active path had 295
entries, i.e. one leading message is never rendered. The measured offset was +1, but from a
single matched row — so production re-derives it on every jump from every mounted user row
and refuses to convert when they disagree. Do not hardcode it.

**Corrected 2026-10-24: the non-rendered message is not a leading one.** The July record above is conversation
`b3c603a4` (the code's comment at the offset sweep names it). Read again through the API in October [Chrome page
realm, the owner's profile, 2026-10-24]: its active path now holds 299 entries (149 questions, the conversation has
grown), the first is a question, and the only answer without a `stop_reason` is at path index 199, as the
predicate's comment in the code says. So the offset is 0 before that entry and +1 after it; the "+1" July measured
came from a row after it. A different 147-question chat measured in October (`65dfa4f2`) has 294 entries, none
without a `stop_reason`, `aria-setsize` 294 and offset 0: not a conflict with July, two conversations. The code
derives the offset either way.

**The mounted set is NON-CONTIGUOUS.** The last ~3 rows stay mounted at *every* scroll
position. At `scrollTop = 0` the mounted set was `[0,1,2,3,291,292,293]`. Any "is my target
mounted?" check must use the cluster nearest the scroll position and exclude that tail —
plain set membership reports a false hit for tail indices from anywhere in the conversation.

**`scrollHeight` is not stable.** Measured across a scroll sweep it moved 387,132 → 375,082
(12,050 px / 3.21%), decreasing monotonically as the virtualizer measures real row heights.
That is ~9–10 messages of error, so any absolute pixel target computed once goes stale.

**"Load earlier messages" is not a pagination gate.** It is a `BUTTON` with class
`sr-only select-none`, 1×1 px, positioned off-screen — a keyboard affordance. All rows are
in the virtualizer from load: a single jump from the bottom to offset 0 mounted index 0 and
`aria-setsize` did not change.

**Imperative API:** none for indexing. The container's React ref exposes
`getScrollContainer`, `scrollToBottom`, `setPinToBottom`, `isPinned`, `getLastUserInputAt`,
`markUserInput` — an autoscroll/pin controller. Do not couple to it: the component is
minified to `Oj` and renames every deploy.

### Current structure (Jul 2026, live)

```
A: div.overflow-y-auto.overflow-x-hidden.[scrollbar-gutter:stable].mt-12.pt-2.flex-1  (scroll container)
   └─ measured: scrollHeight 124064 / clientHeight 746 (166x) — full height reserved via spacers
  C: div.mb-1.group                                    (turn wrapper — NO data-testid any more)
    D: div.flex.flex-col.items-end.gap-1               (alignment — items-end for user)
      E: div.group.relative.inline-flex.gap-2.bg-bg-300.rounded-xl   (bubble — note bg-bg-300, not bg-bg-200)
        F: div.flex.flex-row.gap-2.relative
          G: div.flex-1
            H: div[data-testid="user-message"].font-large.!font-user-message.py-0.5.grid.grid-cols-1.gap-2   (OUR TARGET)
              I: p.whitespace-pre-wrap.break-words     (actual text)
```

Assistant turns: `div.font-claude-response`, left-aligned (`items-start`).

**Scroll container:** locate it by walking up from a mounted message for the first ancestor with computed `overflowY` of `auto`/`scroll` **and** `scrollHeight > clientHeight`, guarded by `clientHeight > innerHeight * 0.4` and `scrollHeight > clientHeight * 1.5`. Do **not** select on its class string — it has already changed once (`overflow-y-scroll` → `overflow-y-auto`, `pt-6` → `mt-12 pt-2`). The guard matters because code blocks and tables inside messages are themselves `overflow: auto`.

**`window.scrollY` is always `0`** — the conversation scrolls in the inner container, not the window.

**Driving the virtualizer: reposition ONLY. Do NOT dispatch a synthetic `scroll` event.**

An earlier revision of this file said the opposite. It was wrong twice over — see DEC-024.

| Approach | Result |
|---|---|
| `scrollTo({top})` alone | drift **exactly −360 px** across three identical runs; cluster lands where expected |
| `scrollTo({top})` + dispatched `scroll` | drift −2784 / −6249 / −6249 px, and **cluster identity moves ~6 rows** past the ±5 tolerance — a real, reproducible overshoot |

Dispatching makes the app run its own scroll handling, which triggers an extra
height-measurement pass and shifts the coordinate system mid-jump.

The old justification ("`scrollTop` alone did not remount on Chromium") came from a
measurement taken in a **hidden window**, where rAF is throttled and the virtualizer does
not run at all. `CLAUDE.md`'s measurement-context table lists it as a corrected finding.

**There is no pin/autoscroll interference.** A probe once reported "DISPATCH HARMFUL —
pin/autoscroll", but `scrollTop` and cluster identity were static across all eight samples
over 3.2 s, the drift was *negative* (away from the bottom; a pin pulls toward it), and
`SNAPPED_BACK_TO_BOTTOM` was false every time. Do not build a pin-interference abort.

| Condition | `scrollTop = x` alone | `scrollTo()` + dispatched `scroll` |
|---|---|---|
| Chromium, DevTools console (page realm) | ❌ no remount after 3 s | ✅ |
| Firefox, Tampermonkey sandbox | ✅ remounted | ✅ |

An earlier revision of this file stated flatly that `scrollTop` alone never works. Probe B disproved that on Firefox. The discrepancy is unresolved — it may be engine-, timing-, or warm-up-related — so do not rely on either mechanism alone.

**Realm safety:** verified from inside the Tampermonkey sandbox on Firefox (`exportFunction` present). Sandbox-created `Event` and `WheelEvent` both work; `unsafeWindow`-constructed events are **not** required. This is not a DEC-019/DEC-020-class boundary.

---

### Historical: v11.x structure (superseded — kept for context)

**Inspected:** Feb 16, 2026

### Real DOM Structure (A→K nesting)

```
A: div.overflow-y-scroll.overflow-x-hidden.pt-6.flex-1  (scroll container)
  B: div.mx-auto.font-size-full.max-w-3xl.flex-col.md:px-2
    C: div.flex-1.flex.px-4.max-w-3xl.mx-auto.w-full.pt-1
      D: div[data-test-render-count]  (render wrapper)
      E: div[data-testid="user-human-turn"].mb-1.mt-6.group  (message group — OUR PRIMARY TARGET)
        F: div.flex.flex-col.items-end.gap-1  (alignment — items-end for user)
          G: div.group.relative.inline-flex.gap-2.bg-bg-300.rounded-xl.pl-2.5.py-2.5.break-words.text-text-100.transition-all.max-w-[75ch].max-w-[85%]  (bubble)
            H: div.flex.flex-row.gap-2.relative
              I: div.flex-1
                J: div.font-large.font-user-message.grid.grid-cols-1.gap-2.py-0.5[data-testid="user_message"]  (text container — fallback targets)
                  K: <p class="whitespace-pre-wrap break-words">actual text</p>
          L: div.absolute.bottom-0.left-0.right-0.h-12.bg-gradient-to-t  (gradient overlay for "Show more")
```

AI messages use `items-start` (left-aligned), no `bg-bg-300`, `data-testid="assistant-turn"`.

### Notes
- Both Claude Chat and Claude Code Web share the same hostname (`claude.ai`), differentiated by path
- `data-testid="user-human-turn"` is the primary target (element E)
- `.font-user-message` class lives deeper at element J (fallback)
- `data-testid="user_message"` (underscore) also exists at J as additional fallback

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure has 11-level nesting with render-count wrappers, bg-bg-300 bubble, font-user-message grid, and gradient overlays.

---

## ChatGPT

### Current structure (Oct 2026 app shell; measured live, Chrome, page realm, 2026-10-23)

**Selector (v12.10):** `[data-user-message-bubble="true"]`, then `[data-content-search-unit-key$=":user"]`,
both **scoped to `[data-app-action-timeline-scroll][role="region"]`**. The legacy selectors below match
nothing on the live site (0 of 10) and stay as harmless fallbacks. **The full list comes from the API**
(`/backend-api/conversation/<id>`, DEC-046); the DOM is the fallback.

User bubble, inner → outer (relevant attributes only):

```
div[data-user-message-bubble="true"]
div[data-content-search-unit-key="fallback-turn-N:0:user"]
div[data-chatgpt-search-unit-key="fallback-turn-N:0:user"][data-chatgpt-search-message-ids="<message-id>"]
div[data-talvt-turn-state="complete"]                        (fragile: do not use)
div[data-content-search-turn-key="fallback-turn-N"]
div[data-turn-key="<message-id>"]                            = the API node id: THE identity
div[data-chatgpt-conversation-selection-target="<conversation-id>"][data-thread-find-target="conversation"]
div[data-mcp-app-portal-target="true"][data-thread-user-message-navigation-content="true"]
div[data-app-action-timeline-scroll][role="region"]          THE scroller (overflow-y: auto)
main[data-codex-history-swipe-page="true"][data-app-shell-main-surface="browser"]
```

- **`data-content-search-turn-key` is not a reliable position.** While the page loaded it was
  window-relative (`fallback-turn-0` on question 5); after loading it equalled the 0-based position. Use
  `data-turn-key` against the index.
- **A hidden second timeline** (`role="presentation"`, every bubble 0×0) sits beside the real one during a
  navigation, doubling every unscoped count. Scope to `role="region"`.
- **Windowing:** 4–7 user turns mounted. Turn 0 mounted only after `scrollTop = 0` was set more than once,
  because the page re-estimates heights as it goes.
- No visible native "jump between your messages" control was found (`data-thread-user-message-navigation-content`
  exists on one container; buttons read only Copy, Edit and Scroll to bottom). Reported, not acted on.
- Hashed classes (`block-…`) and `data-talvt-*` are unstable; do not select on them.

### Historical: Feb 2026 structure (superseded)

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `[data-message-author-role]` filtered by value `=== 'user'`

### Real DOM Structure (A→K nesting)

```
A: article[data-testid="conversation-turn-N"][data-turn="user"][data-turn-id="{uuid}"][data-scroll-anchor="false"]  (turn wrapper)
  B: h5.sr-only  "You said:"
  C: div.text-base.my-auto.mx-auto.pt-12
    D: div[--thread-content-max-width:48rem].relative.flex.w-full.min-w-0.flex-col
      E: div.flex.max-w-full.flex-col.group
        F: div.min-h-8.text-message.relative.flex.w-full.flex-col.items-end[data-message-author-role="user"][data-message-id="{uuid}"]  (OUR TARGET)
          G: div.flex.w-full.flex-col.gap-1.empty:hidden.items-end
            H: div.user-message-bubble-color.corner-superellipse.relative.max-w-[var(--user-chat-width,70%)]  (bubble)
              I: div.whitespace-pre-wrap
                J: div  (text content)
          K: div.z-0.flex.justify-end  (action buttons)
  L: span.sr-only  (screen reader content)
```

AI messages use `article[data-turn="assistant"]`, `data-message-author-role="assistant"`, `items-start`, `h5.sr-only "ChatGPT said:"`.

### Notes
- `data-message-author-role` has values `"user"`, `"assistant"`, `"system"`
- Both ChatGPT Chat and Codex Web share the same hostname (`chatgpt.com`), differentiated by path
- User bubble has `.user-message-bubble-color.corner-superellipse` (superellipse border shape)
- `article` elements wrap each conversation turn with sequential `data-testid="conversation-turn-N"`

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure uses article turn wrappers, sr-only headings, thread-content-max-width CSS variables, superellipse bubble corners, and items-end alignment.

---

## Grok

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `div.message-bubble` filtered by class containing `user`/`human`, or parent class, or even index

### Real DOM Structure (A→F nesting)

```
A: div.flex.flex-col.items-center  (scroll/content container)
  B: div#response-{uuid}.relative.group.flex.flex-col.justify-center.w-full.max-w-[var(--content-max-width)].pb-0.5.items-end  (message wrapper — items-end for user)
    C: div.message-bubble.relative.rounded-3xl.text-primary.min-h-7.max-w-[100%].px-4.rounded-br-lg  (bubble — OUR TARGET, has .user class for user messages)
      D: div.relative
        E: div.response-content-markdown  (text container)
          F: <p class="break-words" dir="auto" style="white-space: pre-wrap;">actual text</p>
    G: section.inline-media-container.flex.flex-col.gap-1.clear-both  (media)
    H: section.auto-notification.flex.flex-col.gap-1  (notifications)
  I: div.action-buttons.h-8.mt-0.5.mb-2.flex.flex-row.flex-wrap.w-full.justify-end.print:hidden  (action buttons)
```

AI messages use `items-start` on element B, no `user` class on the bubble, `rounded-bl-lg` instead of `rounded-br-lg`.

### Notes
- `div.message-bubble` exists on ALL messages — filtered by `.user` class
- `id="response-{uuid}"` on each message wrapper
- Falls back to `[data-role="user"]` and `[class*="user-message"]`, then even-index heuristic
- `.response-content-markdown` contains the prose text
- Action buttons use `justify-end` for user, `justify-start` for AI

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure uses response-{uuid} IDs, rounded-3xl bubbles, response-content-markdown text containers, section elements for media/notifications, and action-buttons rows.

---

## Gemini

**Inspected:** Feb 16, 2026 (live site); turn internals re-measured **Jul 30, 2026** (Chromium,
page realm, live site, owner's account, visible tab — ACN installed in the measurement browser,
version unknown; probes read raw DOM and the findings below are Gemini's own nodes)
**Selector:** `div.query-text`

### Real DOM Structure (A→L nesting, Jul 30 2026)

```
A: user-query[_ngcontent-ng-c…]  (Angular custom element — NOTE: no longer carries class "user-query")
  B: span.user-query-container[_ngcontent-ng-c…]
    C: user-query-content.user-query-container.enable-luminous-prompt-bubble.enable-luminous-fast-follows
      D: div.user-query-container[_ngcontent-ng-c…]
        E: div.file-preview-container.ng-star-inserted[_ngcontent-ng-c…]
        F: div#user-query-content-N.query-content.ng-star-inserted[data-turn="user"]
          G: div.ng-star-inserted[_ngcontent-ng-c…]
          H: span.user-query-bubble-with-background.ng-star-inserted  (bubble)
            I: span.horizontal-container[_ngcontent-ng-c…]
              J: div.query-text.gds-body-l.query-text-animated[role="heading"][aria-level="5"]  (OUR TARGET)
                K0: span.cdk-visually-hidden.screen-reader-user-query-label  → "You said"  ⚠ INSIDE the target
                K:  p.query-text-line.ng-star-inserted  → the question text (bare text node in Feb)
              L: button.mdc-icon-button[aria-label="Expand text"]  (expand button)
```

**⚠ K0 is the "You said" leak** (v12.2): a hidden screen-reader label inside the primary selector
target. Every raw text read of J includes it. `_cleanText` strips `cdk-visually-hidden` since
v12.2 (it previously knew only `sr-only`). Not present in the Feb 2026 record — added by Gemini
between Feb and Jul 2026, or missed by the Feb inspection.

### AI messages (re-measured Jul 30, 2026)

```
model-response  (custom element)
  div.response-container.response-container-with-gpi
    div.presented-response-container
      div.response-container-content
        div.response-content
          thinking-overlay  (when present)
          div.model-response-label-announcer
            h2.cdk-visually-hidden.screen-reader-model-response-label  → "Gemini said"  ⚠
          structured-content-container.model-response-text  (the response body)
          div.response-footer
```

**⚠ `div.model-response-text` no longer exists** — the class moved to the
`structured-content-container` custom element, so the registry's tag-qualified primary AI
selector (`div.model-response-text`) matches nothing and the chain survives on the
`.response-content` fallback. That fallback over-captures the announcer (the "Gemini said"
h2 — stripped since v12.2 because it is `cdk-visually-hidden`) and `div.response-footer`.

**Footer measured Jul 30, 2026 (v12.3 close-out): text-empty on all 12 conversations on the
test account.** Its children (`sources-list`, `election-info-disclaimer`) carried no
textContent anywhere, and the total `.response-content` vs `.model-response-text` text delta
was exactly the stripped h2 (12 chars). **The re-chain is therefore closed-by-measurement:**
no assertion grounded in measured data can distinguish the selectors (DEC-032 — an
unprovable change), and inventing footer text for the mock would manufacture the evidence.
Re-opens the day a text-bearing footer is observed — a search-grounded response with a
populated sources-list is the expected shape — and that same observation makes the fix
ancestor-gatable.

### Notes
- Angular app with `_ngcontent-ng-c*` hash attributes (change per build)
- `<user-query>` custom element wraps each query, but the `.user-query` **class** is gone —
  fallback 5 (`.user-query`) now matches nothing (verified Jul 30, 2026)
- `[data-query-text]` (fallback 4) also matches nothing (verified Jul 30, 2026)
- `.query-text` lives deep inside (element J) — still reliable, only on user queries, 1 per turn
- `.query-text-line` / `p.query-text-line` (fallbacks 2–3) now match K, 1 per turn — they were
  designed for older Gemini builds and work again by coincidence of the Jul 2026 structure
- Virtualization: **none observed at n=10** (see the status table at the top of this file for
  the full measurement and its context); scroller is `<infinite-scroller class="chat-history">`

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure uses Angular custom elements (user-query, user-query-content, model-response), deep nesting with ngcontent hash attributes, horizontal-container spans, and Material Design icon buttons.
- v12.2 (Jul 30, 2026): Live probe found the hidden `cdk-visually-hidden` sender labels ("You
  said" / "Gemini said") leaking into every text read — the owner reported the prefix on every
  Navigate row. Same probe: AI primary selector dead (class moved off `div`), `.user-query` and
  `[data-query-text]` fallbacks dead, no recycling at n=10. Mock rebuilt to the measured
  structure; `_cleanText` extended to strip `cdk-visually-hidden`.

---

## Claude Code Web

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `div.bg-bg-200.rounded-lg` filtered by `.items-end` parent

### Real DOM Structure (A→H nesting)

```
A: div.pb-4[content-visibility:auto][contain-intrinsic-size:auto 500px]  (lazy-rendered wrapper — one per message)
  B: div.flex.flex-col.items-end.gap-2.max-w-[85%]  (alignment — items-end for user)
    C: div.group\/message.flex.items-start.gap-1
      D: div.relative.bg-bg-200.rounded-lg.px-3.py-2.font-base.break-words.min-w-0.overflow-hidden.text-text-000  (bubble — OUR TARGET)
        E: div.relative[style="max-height: none; overflow: hidden;"]
          F: div.space-y-2
            G: <p>actual text</p>
    H: div.shrink-0.mt-2.5.flex.items-start.justify-center  (action buttons)
```

AI messages have NO `items-end` parent and NO `bg-bg-200` class.

### Notes
- Completely different DOM from Claude Chat — no `data-testid` attributes anywhere
- Uses `content-visibility: auto` for lazy rendering (performance optimization)
- `group/message` class on the flex wrapper (Tailwind group variant)
- Only activates as a fallback when all Claude Chat selectors find nothing (same hostname `claude.ai`)
- The selector chain: `[data-testid="user-human-turn"]` → `[data-testid="user-message"]` → `.font-user-message` → all miss → `bg-bg-200.rounded-lg` inside `.items-end` succeeds

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure uses content-visibility lazy wrappers, group/message class, bg-bg-200 rounded-lg bubbles, space-y-2 text containers, and shrink-0 action button rows.

---

## Codex Web

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `div.self-end.bg-token-bg-tertiary`

### Real DOM Structure (A→J nesting)

```
A: div.h-full.flex.w-full.scroll-pt-3.flex-col.items-center.overflow-y-auto.px-6  (scroll container)
  B: div.@container.w-full.md:max-w-3xl
    C: div.relative.h-full.w-full.flex-col
      D: div.flex.h-fit.min-h-full.shrink-0.flex-col.gap-6.pt-6.text-sm
        E: div.flex.flex-col.gap-4
          F: div.flex.flex-col.gap-2
            G: div.self-end.bg-token-bg-tertiary.text-token-text-primary.relative.group.py-2.scroll-mt-2.rounded-2xl  (user message — OUR TARGET)
              H: div.group.max-w-full.line-clamp-5.overflow-hidden[role="button"]  (clickable text wrapper)
                I: div.px-4.text-sm.break-words.whitespace-pre-wrap  (text)
              J: div.absolute.inset-x-0.-bottom-4.flex.justify-end.gap-1.pointer-events-none  (hover-reveal action buttons)
```

AI messages have NO `self-end` or `bg-token-bg-tertiary`. They use `markdown prose dark-prose-invert` styling and `border-token-border-default` separators.

### Notes
- Completely different DOM from ChatGPT Chat — no `data-message-author-role` attributes
- Uses a task/thread/item model rather than a traditional chat layout
- `role="button"` + `line-clamp-5` on the text wrapper (expandable)
- Only activates as a fallback when the ChatGPT Chat selector finds nothing (same hostname `chatgpt.com`)
- The selector chain: `[data-message-author-role]` → returns empty → `div.self-end.bg-token-bg-tertiary` succeeds

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure uses @container wrapper, 10-level nesting depth, role="button" expandable text, line-clamp-5 overflow, and positioned hover-reveal action buttons.

---

## Perplexity

### Current structure (Oct 2026; measured live, Chrome, page realm, 2026-10-23)

**Selector (v12.10):** `[data-message-bubble="right"]` (the user bubble; answers never carry it). Position:
the nearest ancestor `[data-workflow-entry="N"]`, 0-based, equal to the API entry index. The legacy selectors
below match nothing on the live site and stay as fallbacks. **The full list comes from the API**
(`/rest/thread/<id>`, DEC-046); the DOM is the fallback.

- **Scroller:** `div.scrollable-container` (`overflow: auto`), found by walking up from a bubble.
  **It pins itself to the bottom:** a programmatic `scrollTop` reverted within 300ms every time until a wheel
  event arrived; after one (even a synthetic one) it stayed put.
- **Windowing:** the entries in view plus the latest. Bottom: entries 10–11 of 12; top: 0–4 and 11; middle:
  4–9 and 11.
- Long questions are clipped visually (`max-h-[144px] overflow-hidden`); the text is all in the DOM.
- Do not use `data-renderer="lm"` (answers carry it too) or hashed classes (`_root_128yu_7`).

### Historical: Feb 2026 structure (superseded)

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `.group\/query` (Tailwind group variant)
**Fallback:** `.group\/title .select-text`

### Real DOM Structure (A→L nesting)

```
A: div.relative.z-10
  B: div.group.relative.flex.items-end.gap-0.5
    C: div.-inset-md.pointer-events-none.absolute.select-none  (invisible overlay)
    D: div
      E: div.relative.min-v-0.flex-1.flex.justify-end
        F: div.flex.shrink-0.items-center.gap-1.opacity-0  (action buttons — hidden by default)
        G: div.group\/title.relative.inline-flex.flex-col  (fallback parent)
          H: div[style="transition: none; overflow: hidden;"]
            I: div
              J: div.group\/query.relative.whitespace-pre-line.!text-wrap.break-words  (OUR PRIMARY TARGET)
                K: div.min-w-[48px].select-none.p-3.bg-subtler.rounded-2xl.flex.items-center.justify-center  (bubble)
                  L: span.font-sans.text-base.text-foreground.font-normal.select-text  (text — fallback target)
```

### Notes
- Search/answer interface, NOT a chat sidebar — user queries appear above AI answers
- `group/query` class (literal forward slash) — must be escaped as `group\/query` in querySelectorAll
- `.group/title` parent + `.select-text` span for the fallback selector path
- `.bg-subtler.rounded-2xl` is the query bubble styling
- Answer sections include source citations with numbered badges
- Very reliable selector, minimal filtering needed

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure has 12-level nesting with relative z-10 wrapper, items-end group, hidden action buttons, group/title parent, height-constrained overflow wrapper, bg-subtler rounded-2xl bubble, and font-sans text span.

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
- ~~**Scroll-through collection**: On panel open, script programmatically scrolls through the entire virtuoso container (250ms per viewport step) to force-render and collect all user messages, then restores scroll position.~~
  **❌ THIS IS NOT TRUE AND APPEARS NEVER TO HAVE BEEN** (corrected 2026-07-29, found by Codex review of PR #60). No such traversal exists in the userscript: enumerating every `scrollTop=` / `scrollTo(` / `scrollBy(` / `scrollIntoView(` call finds only Claude's jump machinery and click handlers, with no stepped loop; it is absent from `modules/` and git history shows no removal. Coverage on Emergent is therefore **only what the user has scrolled past**, retained by the accumulation below. This entry is struck rather than deleted because a doc that described an unbuilt mitigation as shipped is exactly why the gap survived — see `ROADMAP.md` backlog item 7.
- **Stale DOM references**: When clicking a nav item, the original DOM element may have been recycled. The click handler re-searches the DOM for a matching element at click time using `isConnected` check.
- **Broad fallbacks removed**: Fallbacks 3-7 (rounded-br-none, items-end, text-wrap, etc.) were matching AI agent status messages when user messages scrolled out of view. Only the primary selector and user-task ID fallback remain.

---

## Firebase Studio

**Inspected:** Feb 16, 2026 (live site)
**Selector:** `[class*="_chatMessage_"][class*="_isUser_"]` (CSS module pattern)

### Real DOM Structure (A→K nesting)

```
A: div._pane._rxexh_5[style="flex: 0.3 1 0; min-width: 300px;"]  (right pane in split layout)
  B: div._chatbox._vnhv_1
    C: div._chatMessages._vnhv_58
      D: div._chatHistoryContainer._qlgvg_1
        E: div._chatHistory._qlgvg_1._scrollEdges._tclap_1._standardFadeTop._tclap_5._standardFadeBottom._tclap_6  (scroll container)
          F: div._chatHistoryContent._qlgvg_25
            G: div._chatMessage._qlgvg_30._isUser._qlgvg_47  (user message — OUR TARGET, grid layout)
              H: div._messageAvatar._qlgvg_59  (user avatar with initial)
              I: div._messageBody._qlgvg_55  (message body)
                J: <p>actual text</p>
              K: div._messageAttachments._qlgvg_209  (attachments area)
```

AI messages have `_chatMessage._qlgvg_30` but NOT `_isUser_`. Last message may also have `_isLastInThread._qlgvg_55`.

### Iframe Architecture (Critical — Unique to Firebase Studio)

Firebase Studio is the only supported platform where the chat UI lives in a cross-origin iframe, not the top-level document. The script must inject into the correct iframe to find chat elements.

```
Top frame: studio.firebase.google.com (shell, ~157 elements, no chat)
  ├── iframe #1: 6000-firebase-studio-{id}.cluster-{hash}.cloudworkstations.dev/capra/...
  │     ← WORKSPACE: contains the chat UI above + app preview. THIS IS WHERE THE SCRIPT RUNS.
  │     └── nested iframe: same 6000-firebase-studio-... domain, path "/"
  │           ← APP PREVIEW: renders user's generated app (e.g., FridgeChef). Script must NOT run here.
  ├── iframe #2: firebase-studio-{id}.cluster-{hash}.cloudworkstations.dev/env/msg/...
  │     ← MESSAGING ENDPOINT: blank internal page. Script must NOT run here.
  └── iframe #3: accounts.google.com/... (auth)
```

**Port-prefixed hostnames:** The workspace uses `6000-firebase-studio-...` where `6000-` is a port prefix. The messaging endpoint uses `firebase-studio-...` (no port prefix). The `@include` pattern must match both, and the script uses `/capra/` path check to select only the workspace.

**Hostname format:** `{port}-firebase-studio-{numeric-id}.cluster-{alphanum-hash}.cloudworkstations.dev`

### Notes
- CSS module classes with dynamic hash suffixes (e.g., `_qlgvg_30`) — change between deployments
- We match the stable prefix part: `_chatMessage_` and `_isUser_`
- Split layout: preview iframe on left, chat on right (within the workspace iframe)
- Messages use CSS Grid layout (`grid-template-columns: 32px 1fr`) with avatar + body
- Multiple fallbacks: `_isUser_` alone, then `_chatMessage_` filtered by `_isUser_`/`isUser`
- `_scrollEdges._tclap_1` on the scroll container provides fade effects
- Tampermonkey `@grant GM_addStyle` creates a sandbox — `window._aiNavAlreadyLoaded` is NOT visible from DevTools console. Use console log messages to verify script execution.

### Debugging History
- v7.7 (Feb 16, 2026): Rebuilt mock from live DevTools screenshot. Real structure uses split pane layout with _rxexh hash classes, deep wrapper hierarchy (_chatbox → _chatMessages → _chatHistoryContainer → _chatHistory), grid-based message layout with avatar/body/attachments columns, and _scrollEdges fade effects.
- v7.8 (Feb 16, 2026): Discovered multi-iframe architecture. Script was injecting into wrong iframes (messaging endpoint and app preview instead of workspace). Fixed with broader `@include` pattern, `hostname.includes()` instead of start-anchored regex in `detectSite()`, and `/capra/` path discrimination to select only the workspace iframe. Three bugs fixed: (1) `@include` pattern too narrow for port-prefixed hostnames, (2) `detectSite()` regex rejecting port-prefixed hostnames, (3) script running in app preview and messaging iframes creating duplicate buttons.

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


## Probe D — no native scroll-to-index (2026-07-27, Chromium page realm, live claude.ai)

Run so nobody repeats the investigation. Rocksteady exposes **no usable imperative path**:

- **Keyboard:** `role="feed"` does not hold focus (`document.activeElement` never lands
  inside it); ArrowUp/PageUp dispatched at it move nothing. The sr-only arrow-key
  instruction notwithstanding, keyboard is not a scroll-to-index channel.
- **Sizer:** one `div[data-rocksteady-sizer][data-sizer-excess="0"]` carrying only the
  total height (372,642px observed). No per-row offsets, no serialised position map on
  any element.
- **`offsetTop` is NOT in container-content coordinates** — 0/32 samples agreed with
  rect-derived positions. Compute row positions as
  `el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop`.
- **Local density** varies 1,033→1,221 px/row across regions (~18%).
- **Newton-step trial:** from the bottom, one move computed from purely local geometry
  (nearest mounted row's rect + local px/row) mounted row 0. Local measurement is a
  sufficient positioning primitive; a global average is not.

Context: Chromium, page realm. API-surface findings (attributes, focus behaviour) are
engine-independent; re-verify only if Firefox behaves visibly differently.

---

## Probe E — conversation payload thinking-block shape (2026-07-29, Chromium page realm, live claude.ai)

Measured by fetching one real conversation with the userscript's own parameters —
`?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong` — and counting
shapes rather than reasoning about them. **Context: 297 messages, one conversation (n=1), page
realm, Chromium.** This is the evidence rule C of the legacy-bookmark ladder rests on (DEC-034).

| Observation | Count |
|---|---|
| Messages in the payload | 297 |
| Thinking content blocks | 61 |
| Thinking blocks carrying `summaries: [{ summary }]` | **55** |
| Thinking blocks with no summaries array | 6 |

Two properties that matter, neither derivable from the DOM:

1. **Shape is `block.summaries[].summary`** — an array of objects, not a string. A defensive
   `Array.isArray` guard is required: a string-valued `summaries` would iterate per character.
2. **The DOM header truncates the summary for display.** A bookmark preview captured from the
   collapsed activity header therefore holds a *truncated* — and frequently *doubled*, the header
   text repeated — copy, while the payload holds the full text. Whole-string prefix matching fails
   **in both directions** on 3 of the 6 live shapes tested; a 40-character bidirectional probe
   binds all 6, each uniquely.

**Regression signal.** The migration diagnostic prints `summaries=<n>` per unresolved record. On a
conversation that visibly contains extended thinking, `summaries=0` means this shape moved and rule
C is dead. That is the check to run before re-deriving anything here.

**Limit of this probe:** one conversation. It establishes the shape exists and how it is displayed;
it does not establish a distribution across account types, models, or older conversations.
