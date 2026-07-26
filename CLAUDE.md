# CLAUDE.md — AI Assistant Guide

## Project Overview

AI Conversation Navigator is a single-file browser userscript (Tampermonkey/Greasemonkey) that adds an orbital button cluster to 14 AI chat platforms, letting users jump to any previous question in one click. ~6,400 lines of ES5-compatible vanilla JavaScript, no build step, no dependencies.

## Tech Stack

- **Language:** Vanilla JavaScript (ES5 compatible) — no arrow functions, no classes, no async/await
- **Runtime:** Tampermonkey/Greasemonkey userscript manager
- **Build:** None — single file (`ai-conversation-navigator.user.js`), deployed as-is
- **Testing:** Playwright (Chromium/Firefox/WebKit) across 14 platform mock pages
- **Storage:** `GM_setValue`/`GM_getValue` + `localStorage`
- **Browser APIs:** MutationObserver, TreeWalker, ResizeObserver

## Critical Rules (Apply to ALL Tasks)

1. **Never break ES5 compatibility** — NO arrow functions, NO classes, NO async/await, NO template literals, NO let/const (use `var`), NO destructuring/spread/defaults
2. **Never remove `data-acn-*` attributes** — the test suite depends on them
3. **Keep it single-file** — the userscript must remain one deployable `.user.js` file
4. **No external dependencies** — only Tampermonkey APIs at runtime
5. **Prefix everything** — CSS classes with `acn-`, functions with `orb`, to avoid host-page conflicts
6. **Never push directly to main** — use feature branches and PRs
7. **Test all 14 platforms** — run `npm test` after any change to verify cross-platform compatibility
8. **If you make a mistake or need to debug** — suggest adding the lesson to `agent_docs/conventions.md` so the user can decide whether to codify it
9. **Wrap replaced page globals with `exportFunction()` when available** — any function assigned to `unsafeWindow.*` or built-in objects like `history.*` must use the guarded pattern: `if (typeof exportFunction === 'function') { target.fn = exportFunction(proxy, target); } else { target.fn = proxy; }`. `exportFunction` is Firefox-only; the `else` fallback is required for Chrome. Note: this only works for functions whose return values the page does NOT inspect (like `pushState`). For `fetch` and similar, skip interception on Firefox entirely (see DEC-019, DEC-020).

## Platform Risk Awareness

This project injects code into web applications we don't control. There are **four distinct categories** of breakage — fixing one does not protect against the others. Any agent working on this codebase must understand all four.

**Layer 1 — DOM breaks:** Platform changes HTML structure. Our selectors return empty. Features degrade but the host page works fine. This is the most common break. Fix by updating selectors and mock pages. The planned automated DOM validation framework targets this layer.

**Layer 2 — Feature breaks:** Platform ships native features that overlap with ours. Our tool becomes redundant or conflicts. Fix by disabling/adapting specific features per-platform.

**Layer 3 — Execution breaks (CRITICAL):** Platform changes vendor bundles, CSP headers, or security policies in ways that cause our injected code to crash the HOST PAGE entirely — not just our features. Users see a black screen or broken app. This is qualitatively different: Layers 1–2 degrade our tool, Layer 3 kills the platform. First occurrence: v11.6 (Claude's Visualizer update broke Firefox via cross-compartment `.bind()` on our replaced `fetch`). See TROUBLESHOOTING.md v11.6 entry and DEC-019.

**Layer 4 — State breaks (CRITICAL):** Platform keeps the full data but stops putting it in the DOM. Message-list virtualization with recycling mounts a window of turns and unmounts the rest. Selectors still match; every match is still correct; there are just far fewer of them and no error anywhere. First occurrence: v12.0 (Claude — 3 of 96 turns mounted, ~3% coverage). This is the only layer that **reports success on a fraction of the data**, which is why it hid for so long: a 4-question panel on a 147-question conversation looks exactly like a short conversation. Fix by changing data source, not selectors. See DEC-021, DEC-022.

**Why Layer 3 matters for agents:** DOM validation and Playwright mock tests CANNOT catch Layer 3 breaks — they don't have real vendor bundles or CSP headers. If you're doing defensive work, DOM selectors are necessary but not sufficient. Any code that replaces page globals (`unsafeWindow.fetch`, `history.pushState`, etc.) is a latent Layer 3 risk. Minimize global patching. Always use `exportFunction()` wrapping.

**Why Layer 4 matters for agents:** it defeats *both* of the tools built for the other layers. DOM validation targets Layer 1 and would pass — the selectors are fine. Playwright mock tests pass too, because every static mock mounts all its turns permanently; **a suite of static mocks structurally cannot fail on a Layer 4 break.** Before trusting any count derived from `querySelectorAll`, ask whether the platform virtualizes. If you add a virtualizing platform, ship a mock that genuinely *unmounts* nodes (`tests/mock-pages/claude-virtualized.html` is the reference) — hiding them with `display:none` does not reproduce the failure. And whenever a feature falls back to DOM scanning, that degradation must be **visible in the UI**, never console-only.

Full risk model with examples and mitigation strategies: see ROADMAP.md "Platform Risk Model" section.

## Data Source Awareness (v12.0+)

On `claude.ai/chat/<uuid>`, `_questions` is populated from the **API-backed conversation index** (`ci*` functions), not from the DOM. The DOM scan is the fallback. Before changing anything that enumerates messages:

- `ciIsReady()` tells you which path is live. `getUserMessages()` returns only the ~3 mounted turns on Claude and is **not** a conversation-length signal.
- `q.element` is `null` for any question outside the mounted window. Never assume it exists; use `_relocateQuestionElement(q)` and fail visibly if it returns null.
- Never order messages with `compareDocumentPosition` across unmounted nodes — detached nodes compare as DISCONNECTED, the comparator returns 0, and the sort silently degrades to arbitrary order. Use the index order.
- Never key persisted data to a DOM index. Use the message uuid (see the bookmarks schema-2 migration).

## Measurement Context Is Part of the Finding (v12.0+)

**Problem.** Three separate findings in v12.0 were verified, written down as settled fact, and later proved false — not because the measurement was sloppy, but because it was taken in a context different from the one the code runs in.

| Finding | Verified in | False in | Cost |
|---|---|---|---|
| API `text` field is usable | shape inspection | actual contents — empty on all 192 messages | would have rendered 147 blank rows |
| A bare `fetch` returns 200 | DevTools console (page realm) | Tampermonkey sandbox — never tested there | caught pre-ship by review |
| `scrollTop` alone does not drive the virtualizer | a **hidden** window with rAF throttled | a visible window, and the Firefox sandbox | written into **three committed files** before correction |

**Technical root cause.** Each measurement was correct *where it was taken*. The failure was promoting a context-scoped observation to a general one. This codebase has an unusually large number of contexts that change behaviour: page realm vs Tampermonkey sandbox; Chrome vs Firefox (cross-compartment rules differ — DEC-019, DEC-020); visible vs hidden tab (rAF and timers throttle, and a virtualizer simply stops running); one platform's DOM vs another's. A claim true in one is routinely false in the next.

**Method chosen.** Record the measurement context alongside every finding, and treat the finding as **context-scoped until reproduced in the context where the code will run** — for this project that means the Tampermonkey sandbox, in a visible window, on Firefox.

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
