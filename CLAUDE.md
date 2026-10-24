# CLAUDE.md — AI Assistant Guide

## Project Overview

AI Conversation Navigator is a single-file browser userscript (Tampermonkey/Greasemonkey; Userscripts on Safari) that adds an orbital button cluster to 14 AI chat platforms, letting users jump to any previous question in one click. ~12,700 lines of ES5-compatible vanilla JavaScript, no build step, no dependencies.

## Tech Stack

- **Language:** Vanilla JavaScript (ES5 compatible) — no arrow functions, no classes, no async/await
- **Runtime:** a userscript manager — Tampermonkey (Chrome, Firefox), Userscripts (Safari), Greasemonkey (untested). Each ships its own `GM_*` implementation (v12.9, Layer 3)
- **Build:** None — single file (`ai-conversation-navigator.user.js`), deployed as-is
- **Testing:** Playwright (Chromium/Firefox/WebKit) across 14 platforms' mock pages (17 files, including the three virtualizing mocks: Claude, ChatGPT and Perplexity)
- **Storage:** GM storage + `localStorage`. Always go through `acnGetValue`/`acnSetValue`/`acnUpdateValue`, never `GM_getValue`/`GM_setValue` directly: Safari's Userscripts has only the async `GM.getValue`/`GM.setValue`, which the wrapper preloads at startup. A key that holds a collection saves through `acnUpdateValue`, never `acnSetValue`: writing back a copy read earlier erases what other tabs saved since. A new GM key must also be added to `acnStoreLoad`'s list, or it silently resets to its default on every Safari page load (agent_docs/conventions.md → Storage Keys; agent_docs/architecture.md → Runtime matrix).
- **Browser APIs:** MutationObserver, TreeWalker, ResizeObserver

## Critical Rules (Apply to ALL Tasks)

1. **Never break ES5 compatibility** — NO arrow functions, NO classes, NO async/await, NO template literals, NO let/const (use `var`), NO destructuring/spread/defaults
2. **Never remove `data-acn-*` attributes** — the test suite depends on them
3. **Keep it single-file** — the userscript must remain one deployable `.user.js` file
4. **No external dependencies** — only userscript-manager (`GM_*`) APIs and standard browser APIs at runtime
5. **Prefix everything** — CSS classes with `acn-`, functions with `orb`, to avoid host-page conflicts
6. **Never push directly to main** — use feature branches and PRs
7. **Test all 14 platforms** — run `npm test` and `npm run test:probes` after any change (the transport ladder and the usage panel's states can only fail in the probes)
8. **If you make a mistake or need to debug** — suggest adding the lesson to `agent_docs/conventions.md` so the user can decide whether to codify it
9. **Wrap replaced page globals with `exportFunction()` when available** — any function assigned to `unsafeWindow.*` or built-in objects like `history.*` must use the guarded pattern: `if (typeof exportFunction === 'function') { target.fn = exportFunction(proxy, target); } else { target.fn = proxy; }`. `exportFunction` is Firefox-only; the `else` fallback is required for Chrome. Note: this only works for functions whose return values the page does NOT inspect (like `pushState`). For `fetch` and similar, skip interception on Firefox entirely (see DEC-019, DEC-020).

## Platform Risk Awareness

This project injects code into web applications we don't control. There are **four distinct categories** of breakage — fixing one does not protect against the others. Any agent working on this codebase must understand all four.

**Layer 1 — DOM breaks:** Platform changes HTML structure. Our selectors return empty. Features degrade but the host page works fine. This is the most common break. Fix by updating selectors and mock pages. The planned automated DOM validation framework targets this layer.

**Layer 2 — Feature breaks:** Platform ships native features that overlap with ours. Our tool becomes redundant or conflicts. Fix by disabling/adapting specific features per-platform.

**Layer 3 — Execution breaks (CRITICAL):** Platform changes vendor bundles, CSP headers, or security policies in ways that cause our injected code to crash the HOST PAGE entirely — not just our features. Users see a black screen or broken app. This is qualitatively different: Layers 1–2 degrade our tool, Layer 3 kills the platform. First occurrence: v11.6 (Claude's Visualizer update broke Firefox via cross-compartment `.bind()` on our replaced `fetch`). See TROUBLESHOOTING.md v11.6 entry and DEC-019. **Layer 3 also has a quiet face** (v12.9, below): the execution context — which userscript manager, in which browser — withholds something our code relies on, and our features fail while the host page is fine. Do not rule Layer 3 out because the page is alive.

**Layer 4 — State breaks (CRITICAL):** Platform keeps the full data but stops putting it in the DOM. Message-list virtualization with recycling mounts a window of turns and unmounts the rest. Selectors still match; every match is still correct; there are just far fewer of them and no error anywhere. First occurrence: v12.0 (Claude — 3 of 96 turns mounted, ~3% coverage). This is the only layer that **reports success on a fraction of the data**, which is why it hid for so long: a 4-question panel on a 147-question conversation looks exactly like a short conversation. Fix by changing data source, not selectors. See DEC-021, DEC-022.

**Why Layer 3 matters for agents:** DOM validation and Playwright mock tests CANNOT catch Layer 3 breaks — they don't have real vendor bundles or CSP headers. If you're doing defensive work, DOM selectors are necessary but not sufficient. Any code that replaces page globals (`unsafeWindow.fetch`, `history.pushState`, etc.) is a latent Layer 3 risk. Minimize global patching. Always use `exportFunction()` wrapping.

**Layer 3 has a second face: the userscript manager is part of the execution context (v12.9).** Same site, same tab, and nothing crashed: the index had simply never been measured under Safari's Userscripts app, and there it could not work. Recorded as a reasoning flow, because the shape is reusable:

- **Problem.** On Safari with the Userscripts app, the Claude conversation index *always* failed: 403 from every org candidate, classified PERMANENT, backing off 60s → 240s → 960s, so Navigate showed the 1–5 mounted turns of a long conversation. Firefox + Tampermonkey worked. Chrome + Tampermonkey failed the same way at least once, then recovered with no update — still unexplained.
- **Root cause.** `GM_xmlhttpRequest` is not one API. Every manager ships its own implementation, and Userscripts' does not carry the claude.ai session. Measured on Safari, v12.8, same tab and conversation (the owner's manual probe): its `GM_xmlhttpRequest` got 403 from every org, while `fetch(…, {credentials: 'include'})` from the *same* content-script world got 200 for the right org. (The org list's 403 through `GM_xmlhttpRequest` comes from the script's own v12.8 console reason, not from that probe.) Same call, same site, different credentials — chosen by whichever manager ran the script.
- **Method chosen, and why.** A transport ladder (DEC-045): `gmxhr` (v12.8's request, byte-for-byte) and `fetch`. `GM_info.scriptHandler` only *orders* them (Userscripts → fetch first); the rule for trying the second is the same in either order. It runs when every candidate *refused* the first transport (401/403/404) or the first could not run; a refusal is never final until both have been tried (one owner-chosen exception: an unusable org list on the first transport, DEC-045), and the winner is cached for the page session. A rate limit, a server error, a malformed body or no answer at all does *not* trigger the other transport — those keep v12.8's classification, and are the one case where the order can matter (if they strike only the first). Rejected: switching wholesale to `fetch` (trades Firefox's proven path for one never measured in the Tampermonkey sandbox), dropping the `GM_xmlhttpRequest` grant (Userscripts forces `@inject-into content` *because* of it — the grant decides the realm), and per-request fallback (doubles the requests for orgs that legitimately answer 403).
- **Result.** Measured in the Playwright page realm (`probes/check-transport-ladder.js`): the Safari shape lists the whole conversation via `fetch` where v12.8 degraded to the 3 mounted turns, and the Firefox shape never calls `fetch` while its requests stay byte-identical to v12.8's. Live confirmation status: DEC-031.
- **The lesson.** **`GM_*` APIs are runtime-specific implementations.** A finding about one — "`GM_xmlhttpRequest` returns 200" — is scoped to the manager *and* the browser it was measured in, exactly as a DevTools-console result is scoped to the page realm (see the measurement table below). That is why every index request now logs one line naming the transport that produced it: a failure log from a user's browser says which transport failed, without a probe.

**Why Layer 4 matters for agents:** it defeats *both* of the tools built for the other layers. DOM validation targets Layer 1 and would pass — the selectors are fine. Playwright mock tests pass too, because every static mock mounts all its turns permanently; **a suite of static mocks structurally cannot fail on a Layer 4 break.** Before trusting any count derived from `querySelectorAll`, ask whether the platform virtualizes. If you add a virtualizing platform, ship a mock that genuinely *unmounts* nodes (`tests/mock-pages/claude-virtualized.html` is the reference) — hiding them with `display:none` does not reproduce the failure. And whenever a feature falls back to DOM scanning, that degradation must be **visible in the UI**, never console-only.

**Layers 1 and 4 at once, on two more sites (Oct 2026, v12.10).** Recorded as a reasoning flow:

- **Problem.** On ChatGPT and Perplexity, Navigate listed **zero** questions in all three browsers, while the script loaded and the button cluster appeared.
- **Root cause.** Two independent breaks per site. Layer 1: ChatGPT moved to a new app shell and Perplexity changed its markup, so the user-turn selectors matched nothing (0 of 10 live). Layer 4: both now window their message lists (ChatGPT a sliding 4–7 turns; Perplexity the entries in view plus the latest), so even the right selectors see only part of a conversation. Fixing either alone leaves the panel wrong.
- **Method chosen, and why.** New selectors for the DOM fallback, and an index adapter per platform reading each site's own JSON (DEC-046), through the v12.9 transport ladder and only from the exact origin. Rejected: selectors alone (a correct partial list is the Layer 4 failure itself), and restructuring the ladder (its mutation tooling anchors on its exact code). Two things the live measurement changed: positions come from ChatGPT's `data-turn-key`, because `data-content-search-turn-key` was window-relative while the page loaded; and the Perplexity jump releases the scroller's stick-to-bottom pin with a wheel event first.
- **Result.** In Playwright's page realm, against mocks that genuinely unmount (`probes/check-index-adapters.js`), the new build lists every question and jumps to the first from the bottom on both sites; v12.9 lists 0. Real-browser acceptance on all three browsers is the owner's; live confirmation status: DEC-031.

Full risk model with examples and mitigation strategies: see ROADMAP.md "Platform Risk Model" section.

## Data Source Awareness (v12.0+)

On `claude.ai/chat/<uuid>`, `_questions` is populated from the **API-backed conversation index** (`ci*` functions), not from the DOM. The DOM scan is the fallback. Before changing anything that enumerates messages:

- `ciIsReady()` tells you which path is live. `getUserMessages()` returns only the ~3 mounted turns on Claude and is **not** a conversation-length signal.
- `q.element` is `null` for any question outside the mounted window. Never assume it exists; use `_relocateQuestionElement(q)` and fail visibly if it returns null.
- Never order messages with `compareDocumentPosition` across unmounted nodes — detached nodes compare as DISCONNECTED, the comparator returns 0, and the sort silently degrades to arbitrary order. Use the index order.
- Never key persisted data to a DOM index. Use the message uuid (see the bookmarks schema-2 migration).
- **Since v12.10 the same holds on `chatgpt.com/c/<id>` and `perplexity.ai/search/<id>`** through their index adapters (DEC-046): `q.element` is null outside the mounted window there too, and `q.ixPosition` / `q.ixId` are the identity.

## Measurement Context Is Part of the Finding (v12.0+)

**Problem.** Three separate findings in v12.0 were verified, written down as settled fact, and later proved false — not because the measurement was sloppy, but because it was taken in a context different from the one the code runs in.

| Finding | Verified in | False in | Cost |
|---|---|---|---|
| API `text` field is usable | shape inspection | actual contents — empty on all 192 messages | would have rendered 147 blank rows |
| A bare `fetch` returns 200 | DevTools console (page realm) | Tampermonkey sandbox — never tested there | caught pre-ship by review |
| `scrollTop` alone does not drive the virtualizer | a **hidden** window with rAF throttled | a visible window, and the Firefox sandbox | written into **three committed files** before correction |

**v12.9 adds a context to the second row without replacing it:** a bare `fetch(…, {credentials: 'include'})` from the **Safari + Userscripts content-script world** returned 200 for the right org (owner's manual probe, short conversation; not recorded whether the script was loaded at the time — if it was, that `fetch` was our own SSE proxy, which Userscripts lets the interceptor install on the content world's `window`). It is *still* unmeasured in the **Tampermonkey sandbox** — which is why detection never puts `fetch` first there. It runs under Tampermonkey only after `gmxhr` was refused or could not run, and once it has won a load it goes first for the rest of that page session (the cached winner, DEC-045).

**Technical root cause.** Each measurement was correct *where it was taken*. The failure was promoting a context-scoped observation to a general one. This codebase has an unusually large number of contexts that change behaviour: page realm vs Tampermonkey sandbox; Chrome vs Firefox (cross-compartment rules differ — DEC-019, DEC-020); visible vs hidden tab (rAF and timers throttle, and a virtualizer simply stops running); one platform's DOM vs another's; **and the machine itself — a green suite locally is a context-scoped finding, not a general one.** A claim true in one is routinely false in the next.

**A fifth instance, and the subtlest: reading ONE context's signal as describing ANOTHER's.**
Hunting a live jump failure, a probe on the MOCK produced no jump trace. That silence was a
*fast-path success* — the healthy outcome. It was read as evidence about the LIVE failure
("no trace means the refusal happens upstream of the jump machinery"), and it sent the hunt
after code that had never run. The instruction it produced — instrument the silent pre-jump
path — was still correct and was what eventually cracked the case. **The reasoning was wrong
and the resulting action was right, and the record should say both**: a context-mismatched
inference is not automatically a useless one, but it must never be reported as a measurement.
Ask "silence in WHICH build, under WHICH conditions, and does that build even exhibit the
symptom?" before drawing from an absence.

**A fourth instance, found in CI after the rule above was written.** A jump assertion passed on Linux and macOS and failed on all three Windows engines, for an identical and correct jump — it read the resolved row's text from the live DOM, and on slower runners the virtualizer had already recycled that row away. The implementation was right on every OS; only the observation raced. Runner speed belongs in the list above (DEC-025), as does anything the launcher does to the browser: `--single-process` reported one renderer fault as thirteen broken platforms (DEC-026). So does **which version of your own script is installed in the measurement browser** — the MCP browser was found running v11.8 mid-investigation (DEC-027); raw-console measurements survived only because they never invoked the userscript and stripped its DOM artifacts before matching.

**Method chosen.** Record the measurement context alongside every finding, and treat the finding as **context-scoped until reproduced in the context where the code will run** — for this project that means a visible window in each supported runtime — Safari + Userscripts, Chrome + Tampermonkey and Firefox + Tampermonkey, equal priority (DEC-047); a `GM_*` or transport-ladder finding is specific to the manager it was measured in (v12.9). Where you can't drive a setup yourself (Safari + Userscripts today), list it explicitly as owner acceptance in the PR instead of reporting it as verified.

In practice:

- Write findings as *"X, measured in \<context\>"*, never bare *"X"*.
- Before writing a finding into `DOM-REFERENCE.md`, `TROUBLESHOOTING.md` or a decision record, ask which context it was taken in and whether that is the context that matters.
- `document.visibilityState !== 'visible'` invalidates **any** timing, rendering, or virtualizer measurement. Check it first; a hidden tab produces plausible, stable, wrong numbers rather than obvious failure.
- A DevTools console result does not establish sandbox behaviour. Probe from a userscript when the sandbox is what matters.
- When a later measurement contradicts a documented one, correct the document and record **both** results with their contexts. Do not silently replace one with the other — the contradiction is itself the finding.

**How it fixed it.** The `scrollTop` claim was corrected in `DOM-REFERENCE.md` and `TROUBLESHOOTING.md` to present both results with their contexts. It later turned out that even the "safe in every context" compromise (reposition **and** dispatch) was wrong — three repeated runs showed the dispatch causes a reproducible ~6-row overshoot, so it was removed entirely (DEC-024).

**Two more shapes of the same mistake, both hit in v12.0:**

- **A single run is not a measurement.** Probe C run 1 supported "dispatch is harmless"; runs 2 and 3, with nothing changed, showed the opposite. The metric that mattered (landing *cluster identity*) only diverged in runs 2–3, while the metric being watched (pixel drift) straddled a threshold. **Repeat before concluding, and prefer a metric that is discrete over one that is continuous near a threshold.**
- **A success signal from a wrapper is not a success signal from the work.** A background task reported `exit 0` for a review that had not started — the launcher had launched. Likewise `codex exec` printed a token count for a round that produced no output. Check the artifact the work was supposed to produce, not the exit code of whatever spawned it.

**And a corollary that caught several defects here:** *a comment describing behaviour is not evidence the behaviour exists.* v12.0 shipped a comment claiming clicks were disabled during a jump (no such CSS rule existed), a settle function that computed a `changed` signal its caller never bound, and an inverse index mapper that was defined and never called. When reviewing, check comment-versus-code agreement explicitly.

## Agent Documentation

**IMPORTANT: Before starting any task, review the listing below and read any files relevant to your current task.**

| File | Description |
|------|-------------|
| `agent_docs/architecture.md` | Project structure, IIFE organization, platform registry pattern, test contract, display modes, common tasks |
| `agent_docs/conventions.md` | ES5 constraints (detailed), naming conventions, CSS rules, storage keys, debugging policy |
| `agent_docs/testing.md` | Prerequisites, setup, running tests, test architecture, CI/CD pipelines |
| `agent_docs/git-workflow.md` | Branch protection, feature branches, PR process, commit conventions, version bumping |

**Supplementary references** (not in agent_docs/ but useful for specific tasks):

| Location | When to read |
|----------|-------------|
| `docs/*.md` | Working on a specific feature (bookmarks, search, context tracking, etc.) — contains detailed specs |
| `modules/*.js` | Understanding a feature's design — extracted reference implementations (not imported at runtime) |
| `TESTING.md`, `TROUBLESHOOTING.md` | Deep testing/debugging — more detail than `agent_docs/testing.md` |
| `DOM-REFERENCE.md` | Fixing selectors or updating mock pages — real DOM structures for all 14 platforms |
| `DECISIONS.md` | Understanding why something was built a certain way — architectural decision log |
| `HANDOFF.md` | **Read first in any new session.** Current state, what the last session did and why, what comes next, and the risk caveats that are not derivable from the code. Predecessors are archived under `docs/handoffs/`. |
