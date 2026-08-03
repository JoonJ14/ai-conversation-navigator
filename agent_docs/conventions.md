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

## i18n Conventions

The product ships **English (default) and Korean** (`I18N.ko`). Korean is the only translation
and was added for one specific user.

**A key that is never called is not a translation.** v12.7a found **thirteen** Korean strings in
`I18N.ko` with **zero call sites** — the Tools and Plan usage panels rendered English literals
unconditionally, so a Korean user got an English panel while the table looked complete. Nothing
detected it: the table is correct in isolation, the render code is correct in isolation, the
suite asserts on English fixtures and cannot distinguish a translated panel from an untranslated
one, and there is no type system to flag an unreferenced key.

**Run this whenever you add a key, or touch a panel:**

```bash
# every en key with no call site
node -e "
const s=require('fs').readFileSync('ai-conversation-navigator.user.js','utf8');
const en=s.slice(s.indexOf('        en: {'), s.indexOf('        ko: {'));
const keys=[...en.matchAll(/^\s{12}(\w+):/gm)].map(m=>m[1]);
const dead=keys.filter(k=>!new RegExp(\"i18n\\\\('\"+k+\"'\").test(s));
console.log(dead.length? 'DEAD: '+dead.join(', ') : 'every key is called');"
```

**Current state of that audit (2026-08-02), so a hit is not mistaken for a regression:**
14 keys have no call site — and **a dead key is not automatically a defect.** Nine are the
`/Commands` section, deliberately English. Four (`questionPrefix`, `noQuestions`,
`noBookmarksToExport`, `usageUnavailable`) render English in Korean mode and are a **review list,
not a fix list** (ROADMAP 0c) — the owner reviewed Korean mode live and is satisfied with it, so
each is a per-string judgement about whether Korean helps that label.
**Do not mass-translate to drive this count to zero.** The audit exists to make the choice
visible, not to make the number zero.
**One of the fourteen is a different animal:** `summaryLanguageNote` has an EMPTY English value
and a Korean-only disclaimer, so it cannot "stay English" — it is a notice that has never
rendered while `docs/SETTINGS.md` says it does, and v12.7 made its text substantially untrue.
It needs an owner decision, not wiring (ROADMAP 0c).

**Never assemble a translated sentence by concatenation.** Word ORDER is part of what a
translation changes. `'resets ' + day + ' ' + time + ' ' + ampm` cannot be translated into Korean
at all, because Korean puts the meridiem *before* the time (오후 3:05) and the concatenation order
is fixed in the code. Use `{placeholder}` templates through `i18n(key, replacements)` — the helper
has supported this since it was written. Any sentence built from more than one variable is a
translation defect waiting to happen.

**Every `i18n()` call needs an English fallback** (`i18n('key') || 'English'`), and the fallback
must match the `en` table value. A fallback that differs is unreachable *and* misleading: the
`||` fires only when the key is ABSENT, so a differing fallback makes the code claim a wording
it can never render.

**Not everything should be translated — this is the owner's standing position, not a one-off.**
Verbatim (2026-08-02, after reviewing Korean mode live): *"some things are actually better to
stay in english than force translation to korean when they can understand some english."*
`/Commands` is the settled case — "slash command" functions as its own noun in Korean developer
usage, and a translated form would be less recognisable, not more. **Partial English in Korean
mode is acceptable.** Ask before translating domain jargon, and treat "this key has no call
site" as a question, not a bug report.

**Language changes require a refresh**, by design. The switch handler updates only dot labels and
panel headers; anything built at injection keeps its old language until reload, and the
`languageChanged` toast says so. Consequence to expect, not to fix: a panel can be mixed-language
between switch and refresh.

Functional non-ASCII must use `\uXXXX` escapes (see Language Constraints above); comments may
use literal characters.

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

> **Issue:** A cache-key signature was built from normalized text — three separate review
> rounds each found a collision class: a 200-char truncation cap, case/whitespace folding plus
> markdown flattening (`array[x]` vs `arrayx`), and a bare join delimiter forgeable by text
> containing it (`a␁b` vs `a`,`b`).
> **Correct approach:** identity keys use RAW data with length-prefix framing (`len:text` —
> injective). Normalizers (`_normalizeCompare`, `_normalizeFull`, `_mdFlatten`) are for
> MATCHING two differently-formatted views of the same thing, never for identity. And release
> the cache at every point where its key dies (`ciInvalidate`, `ciBuildIndex` commit) — an
> unreleased dead entry pins the conversation, it doesn't cache it.
> **Why:** a lossy identity key trades a harmless false miss (one recompute) for a harmful
> false hit (serving the previous prompt's data under a frozen stamp). (DEC-038.)

> **Issue:** A fixture fix (the S5 leg reorder) was documented in TESTING.md, CHANGELOG and the
> review artifact before it had actually been applied to the harness — the docs described a
> gate the suite could not fail on. The post-commit mutant battery caught it: the mutant the
> reorder exists to kill sailed through green.
> **Correct approach:** after documenting any fix, run the named killing mutation against the
> COMMIT before trusting the docs. And when a fix adds a REDUNDANT defense (e.g. a release that
> empties a cache a key-check also guards), re-derive every killing mutation — the single-
> defense mutant may now be absorbed and the honest mutation becomes the compound.
> **Why:** DEC-037's silent-non-execution class, self-inflicted mid-review; docs claiming
> untestable coverage are how dead zones are born. (DEC-038.)
