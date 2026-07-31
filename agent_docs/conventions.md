# Code Conventions

## Language Constraints (CRITICAL)

The userscript must remain **ES5 compatible**. This means:
- **NO** arrow functions — use `function () {}`
- **NO** classes — use constructor functions or plain objects
- **NO** `async`/`await` — use callbacks or Promises with `.then()`
- **NO** template literals — use string concatenation
- **NO** `let`/`const` in the main userscript — use `var` (note: `const PLATFORMS` exists as a legacy exception)
- **NO** destructuring, spread operators, default parameters, or other ES6+ features
- **NO** external dependencies at runtime

## Naming Conventions

| Prefix | Scope | Example |
|--------|-------|---------|
| `acn-` | CSS classes | `.acn-zone`, `.acn-dot`, `.acn-panel` |
| `orb` | Orbital system functions | `orbBuildZone()`, `orbRender*()`, `orbScrollToQuestion()` |
| `_` | Private/internal variables | `_questions`, `_aiResponses`, `_sseTokenData` |
| `data-acn-` | DOM test contract attributes | `data-acn-role`, `data-acn-open`, `data-acn-count` |

## CSS Conventions

- All styles injected via single `GM_addStyle()` call
- CSS classes prefixed with `acn-` to avoid conflicts with host pages
- Theme colors via CSS variables: `var(--acn-accent)`
- ID namespace: `#acn-zone` for the main container

## Storage Keys

| Key | Purpose |
|-----|---------|
| `'acn-settings'` | General settings (mode, language, scroll direction) |
| `'acn-bookmarks-v1'` | Message bookmarks per conversation |
| `'acn-commands-v1'` | Saved /commands |
| `'_acnv10'` | localStorage for panel width |
| `'acn-ctx-cache'` | Claude context window cache |
| `'acn-zone-positions'` | Orbital zone Y position per platform (fraction of viewport height, added v10.10) |

## Design Principles

- **Fallback chains** — platform selectors should always have fallbacks since host sites change their DOM frequently
- **Respect IIFE scope** — all code lives inside the `(function () { ... })()` wrapper
- **DOM observation resilience** — use MutationObserver patterns for SPA-aware re-scanning; never assume DOM is static
- **`exportFunction()` for replaced globals** — when assigning a function to `unsafeWindow.*` or built-in objects (`history.pushState`, etc.), always wrap with `exportFunction()` on Firefox. Page JS may call `.bind()` on these, and Firefox blocks cross-compartment `.bind()`. Pattern: `if (typeof exportFunction === 'function') { target.fn = exportFunction(proxy, target); } else { target.fn = proxy; }` — see DEC-019. **Critical caveat:** `exportFunction()` only works for functions whose return values the page does NOT inspect (like `pushState` which returns `undefined`). For functions that return values the page uses (like `fetch` returning `Promise<Response>`), the sandbox taints the return pipeline and there is no fix — skip interception on Firefox entirely. See DEC-020.

## Debugging & Mistakes Policy

If you make a mistake or discover something non-obvious during debugging, suggest adding it to this file so the user can decide whether to codify the lesson. Format:

> **Issue:** Describe what went wrong.
> **Correct approach:** What the fix or correct pattern is.
> **Why:** Why it matters / what breaks if ignored.

The user will decide whether it was a minor one-off or a recurring pattern worth documenting here.

## Lessons Learned

> **Issue:** During mutation-verification, `git checkout -- <file>` was used to restore between
> mutants while the fixtures being verified were still UNCOMMITTED — twice in one session. The
> restore resets to HEAD, so it silently destroyed the uncommitted work; three of four mutant
> results measured the wrong code the first time, and a full re-application from conversation
> context was needed both times.
> **Correct approach:** COMMIT the code under test before running any mutate → test → restore
> loop. The restore is then provably returning to the intended state, and the mutation results
> cite a hash.
> **Why:** a mutant run against the wrong baseline produces confident, wrong verdicts — red for
> the wrong reason is indistinguishable from red for the right one in the summary line. (DEC-037.)

> **Issue:** The test harness served mock pages with no charset declaration for an entire
> release. Browsers decoded them as windows-1252, so every LITERAL non-ASCII character in the
> inlined userscript was mojibake in-page ('—' → 'â€”'); only `\uXXXX` escapes survived. It was
> caught only when a new assertion compared a literal em-dash.
> **Correct approach:** `<meta charset="utf-8">` in generated test pages AND
> `contentType: 'text/html; charset=utf-8'` on route fulfillment. If an assertion on a literal
> non-ASCII string fails inexplicably, check `document.characterSet` first.
> **Why:** the mojibake is invisible to every ASCII assertion, so a green suite says nothing
> about it — it is a context mismatch between the file's encoding and the page's decoding.
> (DEC-037 corollary.)
