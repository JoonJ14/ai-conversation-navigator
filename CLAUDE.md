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

This project injects code into web applications we don't control. There are **three distinct categories** of breakage — fixing one does not protect against the others. Any agent working on this codebase must understand all three.

**Layer 1 — DOM breaks:** Platform changes HTML structure. Our selectors return empty. Features degrade but the host page works fine. This is the most common break. Fix by updating selectors and mock pages. The planned automated DOM validation framework targets this layer.

**Layer 2 — Feature breaks:** Platform ships native features that overlap with ours. Our tool becomes redundant or conflicts. Fix by disabling/adapting specific features per-platform.

**Layer 3 — Execution breaks (CRITICAL):** Platform changes vendor bundles, CSP headers, or security policies in ways that cause our injected code to crash the HOST PAGE entirely — not just our features. Users see a black screen or broken app. This is qualitatively different: Layers 1–2 degrade our tool, Layer 3 kills the platform. First occurrence: v11.6 (Claude's Visualizer update broke Firefox via cross-compartment `.bind()` on our replaced `fetch`). See TROUBLESHOOTING.md v11.6 entry and DEC-019.

**Why Layer 3 matters for agents:** DOM validation and Playwright mock tests CANNOT catch Layer 3 breaks — they don't have real vendor bundles or CSP headers. If you're doing defensive work, DOM selectors are necessary but not sufficient. Any code that replaces page globals (`unsafeWindow.fetch`, `history.pushState`, etc.) is a latent Layer 3 risk. Minimize global patching. Always use `exportFunction()` wrapping.

Full risk model with examples and mitigation strategies: see ROADMAP.md "Platform Risk Model" section.

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
