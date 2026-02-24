# CLAUDE.md — AI Assistant Guide

## Project Overview

AI Conversation Navigator is a single-file browser userscript (Tampermonkey/Greasemonkey) that adds an orbital navigation sidebar to 14 AI chat platforms, letting users jump to any previous question in one click. ~6,000 lines of ES5-compatible vanilla JavaScript, no build step, no dependencies.

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

## Agent Documentation

**IMPORTANT: Before starting any task, review the listing below and read any files relevant to your current task.**

| File | Description |
|------|-------------|
| `agent_docs/architecture.md` | Project structure, IIFE organization, platform registry pattern, test contract, display modes, common tasks |
| `agent_docs/conventions.md` | ES5 constraints (detailed), naming conventions, CSS rules, storage keys, debugging policy |
| `agent_docs/testing.md` | Prerequisites, setup, running tests, test architecture, CI/CD pipelines |
| `agent_docs/git-workflow.md` | Branch protection, feature branches, PR process, commit conventions, version bumping |
