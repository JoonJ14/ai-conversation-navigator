# Architecture

## Directory Structure

```
├── ai-conversation-navigator.user.js   # Main userscript (single deployable file)
├── package.json                        # Node metadata + test scripts
├── agent_docs/                         # AI assistant documentation (progressive disclosure)
├── modules/                            # Modular feature groups (reference/future integration)
│   ├── groupA-hover-zone.js            # Hover zone hitzone geometry
│   ├── groupB-context-tracking.js      # SSE interception, token counting
│   ├── groupC-settings.js              # Settings panel, language selection
│   ├── groupD-bookmarks-search.js      # Bookmarks, search, filtering
│   ├── groupE1-summary.js              # Summary panel, conversation analysis
│   └── groupE2-tools-gallery.js        # Tools, image gallery, exports, commands
├── tests/
│   ├── test-all-platforms.js           # Playwright test suite
│   ├── run-tests.sh                    # Convenience shell wrapper
│   └── mock-pages/                     # 15 mock HTML files matching real platform DOMs
├── probes/                             # Standalone probes; CI runs them (see probes/README.md)
├── reviews/                            # Review-pipeline records, one per reviewed change
├── docs/                               # Feature specs, design docs, agent plans
├── assets/                             # Demo GIFs for README
├── .github/workflows/                  # CI: cross-platform tests, Claude Code integration
├── CHANGELOG.md                        # Detailed version history
├── DECISIONS.md                        # Architectural decision log
├── TESTING.md                          # Comprehensive testing guide
├── TROUBLESHOOTING.md                  # Platform-specific diagnostics
├── DOM-REFERENCE.md                    # Real DOM structures for all 14 platforms
└── ROADMAP.md                          # Future directions
```

## Userscript Structure

The main file is organized into logical phases within a single IIFE:

Line numbers are v12.9's and drift with every release. Search the `// ====` section banners instead; they
move less.

1. **Initialization (~1–265):** duplicate guard, version, i18n strings, settings storage
2. **Platform registry and detection (~265–1130):** `var PLATFORMS` (14 entries: hostname matching, selectors, theme colors, message extraction), detection, the DOM/toast helpers, chat-boundary detection
3. **Conversation Index (~1131–4060):** `ci*` functions. The API index and the v12.9 transport ladder (~1131–2440), the virtualizer bridge and row map (~2444–3050), and the jump settle loop (~3050–4060) — see below
4. **Detection, observer, init, SSE, usage (~4062–5616):** question detection, the message observer, initialization, the SSE interceptor (~5111), turn counters, the Plan usage panel (~5356)
5. **Orbital UI (~5617–12340):** CSS injection, the render engine, panels (Navigate ~6289, Search ~6922, Bookmarks ~7378, Summary ~8605, Tools ~10416), the zone builder, main injection (~12296)
6. **Legacy ghost-notch and late handlers (~12341–end):** app-builder platforms, slash commands, panel resize, keyboard

## Conversation Index (v12.0)

**Read this before touching anything that enumerates messages.**

Claude virtualizes its message list with recycling — only ~3–5 user turns are mounted at any moment, so `document.querySelectorAll()` sees roughly 3% of a long conversation. `_questions` on `claude.ai/chat/<uuid>` is therefore populated from Claude's own conversation JSON, not from the DOM. See DEC-021 (the index) and DEC-022 (Layer 4: State Breaks).

**Claude is not the only virtualized platform — Emergent recycles too** (Virtuoso), and it is **not** handled the same way. Emergent has only *passive accumulation*: `scanConversation` keeps messages the user has already scrolled past, so on a long session the Navigate list is the mounted window plus whatever they happened to scroll. `DOM-REFERENCE.md` claimed a panel-open sweep for five months; that code never existed (ROADMAP backlog item 7). **Beware the `virtualScroll` platform flag: it selects that accumulation behaviour, not the platform property, so `claude` — the most virtualized platform here — is `virtualScroll: false`.** The `DOM-REFERENCE.md` table is the record of which platforms virtualize.

**The remaining twelve are "not observed", not "verified absent", and that is a fact with a date on it.** Virtualization is the standard fix for a slow chat page; Claude's own answer flipped between February and July 2026 with no announcement, no error, and a green test suite. Treat "platform X is not virtualized" as *unverified* rather than *verified false* — per-platform status and the two-command check are in `DOM-REFERENCE.md` → "Virtualization status".

If one of the other 12 flips, do **not** start from selectors. The order of operations is in `ROADMAP.md` → "Porting the Layer 4 response to another platform". Note what that section says about scope: the index loader, the jump bridge and the bookmark identity paths are all gated behind `ciIsClaudeChat()` (37 occurrences in the file), so resolve-on-arrival and identity-keyed bookmarks are **proven designs to extract and parameterize, not machinery to call**. What transfers is the reasoning about which failure modes to refuse rather than guess at. The reasoning behind the whole architecture — why a repair was impossible and why it took two releases — is in `TROUBLESHOOTING.md` → "Why v12.0 and v12.1 Exist".

**The single most transferable rule: a held element reference is not an identity.** Neither form of recycling throws: with same-node repurposing the browser reuses that node for another message and the code scrolls confidently to the **wrong content**; with detach-and-remount the node is destroyed and the stored reference is disconnected, so the action is a silent **no-op**. Which form Claude uses has never been measured live — this repo asserts both (the icon guard vs the mock), so **defend against both**. Checking only that a stored element still shows the right text misses the second.

| Function | Role |
|---|---|
| `ciIsClaudeChat()` | Guard — true only when the page origin is exactly `https://claude.ai` and the path is `/chat/<uuid>` (or `/project/<uuid>/chat/<uuid>`). The origin check is v12.9's |
| `ciLoadIndex(force, done)` | Resolves org, fetches, builds. Idempotent; `_ciInFlightCid` + `_ciInFlightGen` block concurrency. Runs the **transport ladder** (v12.9, DEC-045) |
| `ciApiGet(transport, path, cb)` | ONE request over ONE transport (`'gmxhr'` or `'fetch'`), normalised to `{ok, kind, status, json, errorType, transport, error}`; never throws, calls back exactly once |
| `ciWalkOrgs(transport, cid, cb)` | v12.8's org walk (cheap candidates → org list), run on one transport; reports a per-response `trace` the ladder decides from |
| `ciTransportOrder()` | `[first, second]` — this session's last winner, else `GM_info.scriptHandler` (Userscripts → fetch first). **Orders only**: the rule for trying the second transport is the same in either order |
| `ciResolveActivePath(data)` | Walks `current_leaf_message_uuid` → root, excluding abandoned branches |
| `ciExtractText(msg)` | `content[]` text blocks → attachment `extracted_content` → file names |
| `ciIsReady()` | **Check this before reading the index.** False on other platforms and while degraded |
| `ciUuidForText(text)` | Normalized text → stable message uuid (used by bookmarks) |
| `ciFindScrollContainer()` | Shared, class-name-free scroll-container locator |
| `ciTotalChars()` / `ciTotalThinkingChars()` | Whole-conversation counts for context tracking |

State lives in `_ci*` module variables. `_ciIndex` holds human turns; `_ciFullPath` holds the full ordered path (human + assistant) and is what Export reads.

**Two transports, because `GM_xmlhttpRequest` is not one API (v12.9, DEC-045).** Each userscript manager implements it, and Safari's Userscripts app does not send the claude.ai session with it — 403 from every org — while a plain `fetch` from the same content-script world does. So the index can use either. The rules that matter when touching it:

- **The second transport is tried when every candidate *refused* the first (401, 403 or 404 — what the walk itself reads as "this org will not serve it") or the first could not run** (threw, does not exist, or — gmxhr only — never called back within 50s, past the manager's own 45s timeout). **Not** on network errors, manager-reported timeouts, 429s, 5xx or malformed bodies — an org list that parses but holds no usable org counts as one (`ciCountUnusableOrgList`): those are verdicts about the network, the account or the server, and falling back on a blip would move Firefox onto `fetch` for the rest of the session (the winner — the transport that delivered a usable index — is cached). They keep v12.8's classification on one transport — the one case where the order can matter.
- **The gmxhr request is byte-for-byte v12.8's** — Firefox + Tampermonkey is the proven path. `probes/check-transport-ladder.js` L2-shape compares every option.
- **The fetch request is exactly the measured one**: `fetch(location.origin + path, {credentials: 'include'})`, and only when the page origin is exactly `https://claude.ai`. No custom headers (Cache-Control would make it a non-simple, preflighted request) and no AbortSignal (an object crossing realms). The timeout is a timer plus a single-fire latch. A fetch is never cancelled, so two page-wide bounds apply before new attempts fail fast: two timed out and still pending (`CI_FETCH_STALL_MAX`) or six open at all (`CI_FETCH_OPEN_MAX`) — never a per-conversation count (DEC-045). Every path out of `ciFetchGet` must reach `ended()`, or a slot is held for the rest of the page; a response nobody will read goes through `discard()` first, which cancels its body.
- **A refusal is never declared PERMANENT until both transports have failed** (one owner-chosen exception: if the FIRST transport's cheap candidates are refused and its org list answers 200 with an array holding no usable org, that walk keeps v12.8's "(HTTP 403)" reason and ends PERMANENT alone — DEC-045), and a second transport that met nothing explaining its failure — only refusals, throws or silence; no 5xx, 429 or bad body — upholds the first's refusal (otherwise a logged-out tab re-polls every ~16s). A 429 or a malformed body on one transport still gets v12.8's PERMANENT backoff without the other being tried — deliberately. `ciIsPermanentReason()` is the one classifier; the ladder passes its decision to `ciSetDegraded` explicitly.
- **Every request logs one line naming its transport** (`[ACN] index: transport=… org=<8 chars>… status=…`), and every reason from the org walk starts with `[gmxhr]`/`[fetch]` (the two post-fetch validation reasons, `unexpected response shape` and `malformed message data`, carry none yet). Keep it that way: on a user's machine those lines are the only evidence of which transport failed.
- **The index runs only on the exact origin `https://claude.ai`** (`ciIsClaudeChat`), not wherever platform detection's `host.includes('claude.ai')` matches, and not on claude.ai at another port (`@match` patterns ignore ports) — it sends credentialed requests and renders the answer into the page.

### Runtime matrix — what differs by userscript manager (v12.9)

The code is the same everywhere; what differs is what each manager provides. Labels: **[code]** = read from the
userscript; **[US src]** = read from Userscripts' source (quoid/userscripts v4.8.6: `entry-userscripts.js`,
`api.js`, `Functions.swift`, the background `main.js`); **[measured: who, where]**; **[inferred]**. **Live
confirmation status: DEC-031.** A cell measured in the owner's v12.9 acceptance says so.

| Concern | Firefox + Tampermonkey | Chrome + Tampermonkey | Safari + Userscripts |
|---|---|---|---|
| Where the script runs | TM's sandbox; `exportFunction` exists [measured: owner, v12.0, DOM-REFERENCE.md] | the page's main world [inferred; DEC-021 addendum] | the extension's **content-script world**: any valid `@grant` makes Userscripts inject into content [US src; measured: its console line, owner, v12.8] |
| `unsafeWindow` | provided, unused (the SSE interceptor returns first) [code] | the page window; the SSE interceptor patches `unsafeWindow.fetch` [code] | **absent** (not a supported grant) [US src] |
| `exportFunction` | present: SSE interceptor skipped (DEC-020); SPA history hooks wrapped [code] | absent: interceptor installs; hooks assigned directly [code] | absent [inferred], so the interceptor and the SPA history hooks land on the content world's own `window.fetch` / `history`, which page code never calls [inferred, not measured] |
| `GM_info.scriptHandler` | `Tampermonkey` [TM source] | `Tampermonkey` [inferred] | `Userscripts` [measured: owner's v12.9 acceptance, DEC-031; US src: since 4.1.0] |
| Index transport order (`ciTransportOrder`) | gmxhr → fetch [code] | gmxhr → fetch [code] | **fetch → gmxhr** [code; measured: owner's v12.9 acceptance, DEC-031] |
| `GM_xmlhttpRequest` and the claude.ai session | carries it [measured: owner, through v12.8; v12.9: DEC-031] | carries it; failed at least once, then recovered, unexplained (ROADMAP 0d) [owner report] | **403 from every org** [measured: owner's probe, v12.8, 6-message conversation]. Sent from Userscripts' background page [US src]; why the session is missing is inferred (WebKit SameSite cookies, bug 260676) |
| The index's `fetch` | runs only after gmxhr was refused or could not run; unmeasured in the sandbox | same; unmeasured | the primary path; **200** for the right org [measured: owner's probe, v12.8, content world; and v12.9's own index in the owner's acceptance, DEC-031]. It passes through our own `acnFetchProxy`, so a change to that proxy is a change to this transport (DEC-021 addendum) [code + US src] |
| SSE / context-window bar | interceptor skipped: the bar reads `(est.)` from index totals [code] | `(hybrid)` / `(last known)` from SSE [code] | the interceptor sees only the content world's own calls: no SSE, the bar reads `(est.)` [inferred, not measured] |
| SPA route hooks (the nine `spa:true` platforms; Claude is `spa:false`) | wrapped with `exportFunction` [code] | assigned to the page's `history` [code] | on the content world's `history`, so page navigations are not seen [inferred, not measured] |
| Plan usage panel | `GM_xmlhttpRequest` only (v12.8 rules, DEC-044) [code] | same | same, so expected to read "Usage data unavailable" [inferred] |
| GM storage: `acn-settings` (language, platform toggles), bookmarks, `acn-commands`, `acn-zone-positions`, `acn_ctx_cache`, the org cache | works | works | **absent**: Userscripts has no synchronous `GM_getValue`/`GM_setValue` [US src]. Every call site is try/caught, so it fails silently: bookmarks and commands are never stored, and the language and platform toggles can't change, since they are re-read from GM on every use [code] |
| `localStorage` (`_acnv10`: mode, scroll direction, panel width) | works | works | works [inferred: the page's storage is shared across worlds] |
| Exact-origin guard | covers the **index only** (`ciIsClaudeChat`). The usage panel and the SSE install are gated by platform detection's `host.includes('claude.ai')` alone. OPEN, ROADMAP 0d [code] | same | same |

**Design rules that follow, for any new feature:**
1. **Credentialed claude.ai requests** go through `ciApiGet`'s ladder and the exact-origin guard. `GM_xmlhttpRequest` alone is refused on Safari.
2. **Anything that must persist on Safari** needs `localStorage`, or the async `GM.getValue` / `GM.setValue` with an in-memory copy loaded at startup. Synchronous GM storage does not exist there (agent_docs/conventions.md → Storage Keys).
3. **Replacing a page global does nothing on Safari** (no `unsafeWindow`). The SSE tap and the SPA history hooks do not reach the page there.
4. **No Playwright engine is any of these runtimes.** The harness inlines the script into the page realm (TESTING.md). A claim that depends on the runtime stays owner acceptance until it is measured on the device (CLAUDE.md, measurement context).

### Jump-to-message (Phase 3)

Clicking a question must reach messages that are not in the DOM. `ciJumpToFullPathIndex()`
scrolls, waits for the virtualizer to remount, reads which rows landed, and interpolates
again from that real anchor.

| Function | Role |
|---|---|
| `ciJumpToFullPathIndex(idx, done)` | the settle loop; `done(ok, element)` |
| `ciMountedRows()` | mounted rows as `{dataIndex, el, isUser}` — reads the virtualizer's own `data-index` |
| `ciDeriveRowOffset()` | `data-index → _ciFullPath` offset, re-derived per jump from EVERY mounted user row; `null` on disagreement |
| `ciDataIndexToFullPath()` / `ciFullPathToDataIndex()` | named conversions; **return `null` rather than guessing** |
| `ciSelectCluster()` | contiguous runs, chosen by REAL GEOMETRY against the scroll offset — no index-based tail exclusion |
| `ciWaitForSettle()` | waits for the SELECTED CLUSTER to stabilise (not the whole set); rAF poll + timer escape hatch + single-fire latch |
| `ciFindScrollContainerStable()` | `[data-autoscroll-container="true"]`, computed-style walk-up as fallback |
| `orbSetJumpBusy()` / `orbSetJumpBusyFor(token, busy)` | visible progress. **The jump owns its own busy state** — callers must not set or clear it |
| `ciFeedRoot()` | the message-feed root; **every** row query must be scoped to it |
| `ciVerifyLandedRow()` | maps the row back through the offset AND compares text before success |
| `_normalizeCompare()` | markdown-insensitive comparison (API returns raw markdown, DOM holds rendered text) |
| `_textAsLegacy()` | reproduces v11.8's exact bookmark-hash input (our glyph removed, sr-only kept) |

Constants are measured, not guessed: `CI_JUMP_SETTLE_CAP_MS` 800 (median settle 309 ms,
max 668), `CI_JUMP_TOLERANCE_ROWS` 5 (window is 3–10 rows), `CI_JUMP_MAX_ITERATIONS` 24 (raised from 8 in `5f2a8be`, resolve-on-arrival).
There is deliberately no pinned-tail constant: the extra cluster is not a stable size
(one probe run showed none at all, another showed one at every sample).

**Invariants specific to the loop:**

- **Never hardcode the offset.** `+1` was measured once from a single row. Derive it per
  jump; refuse to convert when mounted rows disagree.
- **Re-read `scrollHeight` every iteration.** It drifts 3.2% as rows are measured, so a
  cached absolute pixel offset goes stale by ~9–10 messages.
- **Exclude the pinned tail from landing detection.** The last ~3 rows are mounted at every
  scroll position; plain set membership gives false hits for tail indices from anywhere.
- **Reposition ONLY — never dispatch a synthetic scroll event** (DEC-024). Dispatching
  causes a reproducible ~6-row overshoot. Read *actual* `scrollTop` after every move; the
  landed position is a constant −360 px off the requested one.
- **There is no pin-interference to defend against.** Do not add an abort for it.
- **Verify the landed row before reporting success.** `ciVerifyLandedRow` maps the row
  index back through the offset and compares text. The offset agreement check proves the
  offset only *locally* — all its samples come from one mount window.
- **Guard `document.visibilityState`.** A hidden tab throttles rAF and the virtualizer
  stops entirely, so the loop cannot converge. `requestAnimationFrame` polling needs a
  timer escape hatch for the same reason.
- **User input always wins.** Abort on a trusted scroll/wheel/key event; never fight the user.
- **Non-virtualized platforms short-circuit** to plain `scrollIntoView`.
- **Scope every `[data-index]` query to `ciFeedRoot()`.** That attribute is not unique to
  Claude's feed; a foreign row fragments a real contiguous cluster and its geometry is
  converted against the wrong container.
- **"Nothing to compare" must FAIL verification, never pass.** The index-mapping half of
  `ciVerifyLandedRow` is a tautology by construction — the text compare is the only real
  check, so an empty expectation would accept any row.
- **Compare with `_normalizeCompare`, not `_normalizeKey`,** anywhere API text meets DOM
  text. The API returns raw markdown; the DOM holds rendered text. Plain normalization
  makes assistant messages never match, which silently degrades their bookmarks and makes
  assistant-target jumps unverifiable.
- **The jump owns the busy flag.** A caller clearing it from its completion callback reads
  whichever jump wrote last, so a superseded jump clears a live one's flag — or, with two
  sequential jumps, nobody clears it and the panel stays locked.
- **`done(ok, el, reason)`** — `reason` is `'superseded'` or `'user'` for aborts. Callers
  must not show a failure toast for those: the user either started another jump or scrolled
  deliberately.
- **Use a `NodeFilter` returning `FILTER_REJECT` to skip subtrees.** `walker.nextSibling()`
  returns null *without moving currentNode* when the rejected element is the last child, so
  the `nextNode()` fallback descends straight back into it. Source-parsed mocks hide this
  because HTML indentation leaves whitespace text nodes; React-rendered DOM does not.

### Text extraction

`_cleanText()` is the single path for reading message text. It removes our own injected
bookmark icon (`[data-acn-bookmark]`) and the platform's hidden screen-reader labels —
`.sr-only` (ChatGPT's "You said:", Claude's "Claude responded:" and "Load earlier messages")
and, since v12.2, Angular CDK's `.cdk-visually-hidden` (Gemini's "You said" / "Gemini said").
All of it leaked into `textContent` and caused real defects: the icon broke index↔DOM
matching for short messages, the sr-only labels reached Search, Export and exported markdown,
and the cdk labels prefixed every Gemini surface. The hidden-label idiom is per-framework
(`sr-only`, `cdk-visually-hidden`, Bootstrap's `visually-hidden`), so a new platform — or a
redesign of a handled one — can reintroduce this class of leak; the predicate to extend is
`_isSrOnlyClassList`, which also serves the export walker.

`_readMessageText()` (user) and `_readAIText()` (assistant) both route through it. There is
no longer a `"You said:"` regex — a regex cannot distinguish the platform's label from a
user message that begins with those words.

### Invariants

- **Never delete the DOM scanner.** It is the fallback and the only path for the other 13 platforms.
- **`q.element` may be `null`** — any question outside the mounted window has no DOM node. Use `_relocateQuestionElement(q)`; if it returns null, fail *visibly*.
- **Never order messages with `compareDocumentPosition` across unmounted nodes.** Detached nodes return `DOCUMENT_POSITION_DISCONNECTED`, matching neither FOLLOWING nor PRECEDING, so the comparator returns 0 and the sort silently degrades to arbitrary order.
- **Never key persisted data to a DOM index.** Use the message uuid (bookmarks schema 2).
- **Degradation must be visible.** `orbRenderIndexBanner()` renders `data-acn-index-status`. Silent fallback is what hid this bug.
- **Never refetch without the cooldown.** `_ciInFlightCid` prevents only *concurrent* fetches; `CI_REFETCH_COOLDOWN_MS` prevents a sequential loop of 3.3 MB downloads.

## Platform Registry Pattern

Each platform is an entry in the `PLATFORMS` object with properties:
```javascript
{
    id: 'claude',
    title: 'Claude',
    match: function (host) { return host.includes('claude.ai'); },
    theme: { accent: '#d97706', accentHover: '#b45309', accentLight: '...' },
    icon: '\u2733',
    layout: 'standard',           // 'standard' | 'left-chat'
    useOrbital: true,             // true = orbital cluster, false = legacy ghost-notch
    virtualScroll: false,
    spa: false,
    getUserMessages: function () { /* fallback selector chain */ },
    getAIMessages: function () { /* fallback selector chain */ },
    pathGuard: null,              // optional URL path filter
    initGuards: [],               // startup prerequisite checks
    // ... more properties
}
```

When adding a new platform, follow the existing entry structure exactly.

### Platform Quick Reference

There are 12 platform entries covering 14 platform variants (Claude/Claude Code share `claude`; ChatGPT/Codex share `chatgpt`).

| ID | Title | Hostname(s) | Layout | useOrbital |
|----|-------|-------------|--------|-----------|
| `claude` | Claude | `claude.ai` | standard | `true` |
| `chatgpt` | ChatGPT | `chatgpt.com`, `chat.openai.com` | standard | `true` |
| `grok` | Grok | `grok.com` | standard | `true` |
| `gemini` | Gemini | `gemini.google.com` | standard | `true` |
| `perplexity` | Perplexity | `perplexity.ai`, `www.perplexity.ai` | standard | `true` |
| `bolt` | Bolt | `bolt.new` | left-chat | `false` |
| `lovable` | Lovable | `lovable.dev` | left-chat | `false` |
| `replit` | Replit | `replit.com` | left-chat | `false` |
| `v0` | V0 | `v0.app` | left-chat | `false` |
| `base44` | Base44 | `app.base44.com` | left-chat | `false` |
| `emergent` | Emergent | `app.emergent.sh` | left-chat | `false` |
| `firebase_studio` | Firebase Studio | `studio.firebase.google.com`, `*.cloudworkstations.dev` | standard | `false` |

## Test Contract (`data-acn-*` Attributes)

Tests query **only** these stable DOM attributes — they are the public test API.

**Roles** (queried via `[data-acn-role="..."]`):
```
data-acn-role="zone"          -> Main container injected into the page
data-acn-role="styles"        -> Injected <style> element
data-acn-role="nav-trigger"   -> Element that opens the navigation panel on click
data-acn-role="nav-panel"     -> The navigation panel element
data-acn-role="nav-stat"      -> Shows the detected question count
data-acn-role="nav-list"      -> Container holding the question items
data-acn-role="nav-item"      -> Each individual question entry
data-acn-role="nav-item-text" -> Display text inside each nav-item
data-acn-role="panel-close"   -> Closes the currently open panel on click
```

**Data attributes** (queried on the elements above):
```
data-acn-accent="#hexcolor"              -> Platform accent colour (on the zone element)
data-acn-ui="orbital"|"legacy"          -> UI system (on zone; distinct from data-acn-mode which tracks arc/wheel/show-all)
data-acn-dot="nav|search|bookmarks|…"   -> Feature ID on each orbital dot (orbital platforms only)
data-acn-open="true"                    -> Present on nav-panel when open, absent when closed
data-acn-count="N"                      -> Number of detected questions (on nav-stat element)
data-acn-index-status="degraded|loading|ready-with-notes"
                                        -> Conversation-index banner state (Claude only, v12.0+).
                                           Absent when the index is healthy with nothing to report.
                                           LOCATION: on the banner INSIDE the nav panel's list —
                                           never on the zone — and only refreshed while Navigate
                                           is the open panel. Not a readiness signal otherwise
                                           (a zone-scoped probe was a 0ms no-op; Tier 3 v12.3).
data-acn-jumping="true"                 -> On any panel with a jump in flight. Also blocks clicks via CSS.
data-acn-jump-resolved="N"              -> On the ZONE: the data-index a completed jump actually
                                           resolved. Durable — the resolved ELEMENT is detached by
                                           the re-render scrollIntoView triggers, so marking only
                                           the element is unreadable by the time a test looks.
                                           Stamped by BOTH routes (orbMarkJumpTarget): it names the
                                           resolution, never the route taken.
data-acn-role="sum-generate"            -> Summary panel generate button (v12.3)
data-acn-role="sum-results"             -> Summary results container (v12.3)
data-acn-role="sum-stats"               -> Stats section, with data-acn-sum-total / -user / -ai
                                           machine-readable counts (v12.3)
data-acn-role="sum-segment"             -> Conversation-map segment, with data-acn-sum-start / -end
                                           timeline span (v12.3)
data-acn-role="sum-subsegment"          -> Sub-segment (child) inside a segment, with
                                           data-acn-sub-start / -end timeline span (v12.5)
data-acn-role="tool-export"             -> Tools export option, with data-acn-export="full|bookmarks|summary" (v12.3)
data-acn-role="toast"                   -> The transient #acn-toast message (v12.3)
```

Never remove or rename these attributes — tests depend on them.

### Mock pages and virtualization

`tests/mock-pages/claude-virtualized.html` is the reference for a **virtualizing** mock: it holds 40 turns in JavaScript and mounts 3, genuinely removing the rest from the document. Every other mock is static and mounts all its turns permanently.

**Assert on what the implementation RESOLVED, never on ambient DOM state.** A mutation
test proved the difference: with the row offset forced to 0 and verification stubbed out,
the navigator resolved the *assistant reply* instead of Question 1 — and the suite stayed
green, because checking "is row 0 mounted and does it read right" passes whenever the
6-row mount window happens to contain the intended row. Only `data-acn-jump-resolved`
distinguishes a correct jump from a confidently wrong one.

**And look the answer up in the backing data, not the DOM.** Resolving the row *index*
durably is only half of it. The first version then read that row's text back out of the
live DOM, where it is usually already recycled away again — the re-render `scrollIntoView`
triggers is what unmounts it. The check consequently tracked machine speed: green on Linux
and macOS, red on all three Windows engines, for the same correct jump. Use
`__mockVirtualization.rowText(i)`, which reads the mock's `MESSAGES` array. Same rule the
product follows — do not ask the DOM for data the index already holds (DEC-025).

This distinction is load-bearing. A suite of static mocks **structurally cannot fail** on a Layer 4 state break — the entire suite stayed green while Navigate was showing 3% of the conversation. If you add a platform that virtualizes, ship a mock that genuinely unmounts nodes; `display:none` does not reproduce the failure.

## Three Display Modes

1. **Show All** — all 6 orbital dots visible at equal opacity
2. **Arc** — polygon arc with 3 visible dots, scroll-driven rotation
3. **Wheel** — conveyor belt rotation, Navigate always highlighted

## Common Tasks

### Adding a New Platform

1. Add an entry to the `PLATFORMS` object in the main userscript following the existing pattern
2. Implement `getUserMessages()` and `getAIMessages()` with a fallback selector chain
3. Create a mock HTML page at `tests/mock-pages/{platform-id}.html` matching the real DOM
4. Add the platform to the test suite in `tests/test-all-platforms.js`
5. Add `@match` URL to the userscript header

### Modifying Panel UI

- Panel builders are functions named `orbBuildPanel{Name}()` (e.g., `orbBuildPanelNav()`, `orbBuildPanelSearch()`)
- Maintain `data-acn-role` attributes on key elements for test stability
- Use `acn-` prefixed CSS classes for all new styling

### Modifying the Orbital Zone

- Zone construction: `orbBuildZone()`
- Rendering: `orbRenderShowAll()`, `orbRenderArc()`, `orbRenderWheel()`
- CSS injection: `orbInjectCSS()`

## The `modules/` Directory

The `modules/` folder contains **extracted reference implementations** of feature groups from the main userscript. Each file isolates a logical subsystem with its own version and dependency notes. These are **not imported at runtime** — the main userscript is the single deployable file. The modules serve as:

- Development references when working on a specific feature area
- Historical snapshots of how features were integrated
- Potential future integration targets if the project ever moves to a build step

| File | Feature Area |
|------|-------------|
| `groupA-hover-zone.js` | Hover zone hitzone geometry (`orbUpdateHitzone()`) |
| `groupB-context-tracking.js` | SSE interception, token counting |
| `groupC-settings.js` | Settings panel, language selection |
| `groupD-bookmarks-search.js` | Bookmarks, search, filtering |
| `groupE1-summary.js` | Summary panel, conversation analysis |
| `groupE2-tools-gallery.js` | Tools, image gallery, exports, commands |

When modifying a feature, check the corresponding module file for design context, then make changes in the main userscript.

## The `docs/` Directory

The `docs/` folder contains detailed feature specs, design documents, and agent plans. These are valuable references when working on specific features:

| File | Topic |
|------|-------|
| `BOOKMARKS.md` | Bookmarks feature spec |
| `COMMANDS.md` | Commands feature spec |
| `CONTEXT-TRACKING.md` | Context tracking design |
| `FIX-V10.8-CONTEXT-TRACKING.md` | Context tracking v10.8 fix details |
| `FIX-V10.9-HYBRID-CONTEXT-TRACKING.md` | Hybrid context tracking v10.9 fix |
| `GET-AI-MESSAGES.md` | AI message extraction spec |
| `HOVER-ZONE-FIX.md` | Hover zone fix spec |
| `SEARCH-ENHANCEMENT.md` | Search enhancement spec |
| `SETTINGS.md` | Settings panel spec |
| `SUMMARY.md` | Summary panel spec |
| `TOOLS.md` | Tools panel spec |
| `PLAN-USAGE.md` | Usage/plan tracking spec |
| `V10-PLAN.md` | v10 release plan |
| `AGENT-PLAN.md` | Agent implementation plan |
| `claude_specific_context_tracking_calculation.md` | Claude-specific context math |
| `orbital/` | Orbital UI specs and reference HTML |

## Root-Level Documentation

These files at the repo root provide additional context:

| File | Purpose |
|------|---------|
| `TESTING.md` | Comprehensive testing guide (more detailed than `agent_docs/testing.md`) |
| `TROUBLESHOOTING.md` | Platform-specific diagnostics and known issues |
| `DOM-REFERENCE.md` | Real DOM structures for all 14 platforms — essential for selector work |
| `DECISIONS.md` | Architectural decision log with rationale |
| `CHANGELOG.md` | Detailed version history |
| `ROADMAP.md` | Future directions and planned features |
