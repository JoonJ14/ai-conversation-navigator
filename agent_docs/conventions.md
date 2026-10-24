# Code Conventions

## Language Constraints (CRITICAL)

The userscript must remain **ES5 compatible**. This means:
- **NO** arrow functions — use `function () {}`
- **NO** classes — use constructor functions or plain objects
- **NO** `async`/`await` — use callbacks or Promises with `.then()`
- **NO** template literals — use string concatenation
- **NO** `let`/`const` in the main userscript — use `var` (`PLATFORMS` is `var` too)
- **Functional non-ASCII must be a `\uXXXX` escape** in code strings. Comments may hold literal characters. See the
  charset lesson under Lessons Learned, and write such code through a script file (the tool lesson there)
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

- All styles injected through one `<style id="acn-style">` element (`orbInjectCSS`). `GM_addStyle` is granted but never called.
- CSS classes prefixed with `acn-` to avoid conflicts with host pages
- Theme colors via CSS variables: `var(--acn-accent)`
- ID namespace: `#acn-zone` for the main container

## Storage Keys

Checked against the code in v12.12. **Every GM key goes through `acnGetValue` / `acnSetValue`, never
`GM_getValue` / `GM_setValue` directly.** Under Safari + Userscripts the synchronous functions do not exist
(the owner's B0 run, Userscripts 4.8.6), so the wrapper serves the GM keys from a copy that `acnStoreLoad`
reads through `GM.getValue` before the script runs. **A new GM key must also be added to `acnStoreLoad`'s
list**, or on Safari it reads as its default on every page load.

| Key | Store | Purpose |
|-----|-------|---------|
| `'acn-settings'` | GM | Language and platform toggles. Re-read on every `i18n()` call and platform check |
| `'acn-bookmarks-v1'` | GM | Message bookmarks per conversation (`BOOKMARK_KEY`) |
| `'acn-commands'` | GM | Saved /commands (`COMMANDS_KEY`) |
| `'acn_ctx_cache'` | GM | Claude context window cache |
| `'acn-zone-positions'` | GM | Orbital zone Y position per platform (fraction of viewport height, added v10.10) |
| `'acn-claude-org-v1'` | GM | The conversation index's validated org uuid (`CI_ORG_CACHE_KEY`) |
| `'_acnv10'` | localStorage | Display mode, scroll direction (`natural`) and panel width (`orbSaveSettings`) |
| `'acnJumpDebug'` | localStorage | Opt-in jump-trace flag: set it to `'1'` by hand; the script only reads it |

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

**Current state of that audit (updated 2026-08-05 for v12.8), so a hit is not mistaken for a
regression:** **13** keys have no call site — and **a dead key is not automatically a defect.**
- **Nine** — the `/Commands` section, deliberately English (DEC-042).
- **Three** — `questionPrefix`, `noQuestions`, `noBookmarksToExport`. These render English in
  Korean mode and are a **review list, not a fix list** (ROADMAP 0c): the owner reviewed Korean
  mode live and is satisfied with it, so each is a per-string judgement about whether Korean
  helps that label. **Do not mass-translate to drive this count to zero.** The audit exists to
  make the choice visible, not to make the number zero.
- **One** — `summaryLanguageNote`. Not a preference: it has an EMPTY English value and a
  Korean-only disclaimer, so it cannot "stay English". It is a notice that has never rendered
  while `docs/SETTINGS.md` says it does, and v12.7 made its text substantially untrue. Needs an
  owner decision, not wiring (ROADMAP 0c).

**Was 9 + 3 + 2 = 14 until v12.8.** `usageUnavailable` was the fourteenth and is now **wired**:
a failed usage fetch used to leave the panel reading "Plan usage loading…" forever, in both
languages, and now renders the unavailable message (DEC-044). **A dead key is not automatically
a preference either** — check whether the surface has a working behaviour without it before
filing it as one. That check is what turned this key from a translation question into a bug.

**This 9 + 3 + 1 baseline is the ONE tally the project keeps, deliberately** (DEC-043). It is
load-bearing — it is what lets a later run tell a regression from the known state — and every
member of every group is named beside it, so it can be checked rather than merely believed.
**Do not add coverage tallies elsewhere.** Every other one written during PR #72 ("21 of 31"
toasts, "9 vs 5" tooltips, "13 of 14" keys) was wrong, usually twice; docs name surfaces
instead. If you re-run this audit, update the named membership here — do **not** transcribe
counts into `docs/SETTINGS.md`, `README.md` or `HANDOFF.md`.

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

> **Issue:** On PR #75 (v12.9), four WebKit jump-acceptance entries that failed on the owner's Mac were filed
> as TESTING.md's documented webkit-on-macos runner episode, because both read `got null` on mac WebKit. That
> claim went into the CHANGELOG, the review record and the PR description. The signatures differed on every
> axis. The documented episode gives up at the ~4.3–5.4s ceiling, intermittently, on a degraded CI runner.
> These gave up at ~1.46s with a healthy frame rate (`raf10` 135–168ms), on every run, on a local machine —
> and CI's newer WebKit passed them.
> **Correct approach:** match a known failure by its SIGNATURE — timing, frame rate (`raf10`), frequency,
> host — not by its name or its error text. Before citing a documented signature, compare each element and
> write down which ones match.
> **Why:** a name match explains a failure away. The real cause stays open, and the wrong explanation spreads
> into every doc that quotes it (TROUBLESHOOTING, "OPEN — Local mac WebKit").

> **Issue:** The Edit tool and inline Bash commands turn `\uXXXX` escapes into the literal character. In
> v12.9 four functional `\u2026`/`\u2192`-style escapes written through Edit landed in the userscript as
> literal characters, and an inline `node -e` script broke when `\u0027` became `'`.
> **Correct approach:** write code that needs `\uXXXX` escapes through a SCRIPT FILE that builds the
> backslash itself (for example with `String.fromCharCode(92)`), then grep the added non-comment lines for
> non-ASCII before testing.
> **Why:** the decoded character looks right in review. The rule that functional non-ASCII must be an escape
> exists because literal characters have broken in-page before (the charset lesson above).

> **Issue:** Diagnosing Claude's frozen turn-counter dots (v12.10 close-out), the first write-up said the
> `pushState` / `popstate` hooks close the panel on Chrome and Firefox and do not reach the page on Safari, so the
> bug was Safari-only. The hook code was read, but not the guard around it: the block runs only
> `if (platform.spa)`, and Claude is `spa: false`. The hooks never run on Claude in any browser. GitHub Codex
> caught it on the docs PR (#79), after the explanation had shaped one of the owner's fix decisions.
> **Correct approach:** before reasoning about what code does on a platform, read that platform's registry entry
> (`spa`, `virtualScroll`, `useOrbital`, the selectors) and every guard between the entry point and the code.
> Label an explanation [code] only once the whole path from the registry to the line is read.
> **Why:** a mechanism that exists in the file but never runs on the platform reads exactly like the real cause.
> And it is most persuasive when it fits the observations, as this one did.

> **Issue:** A short spoken acceptance report ("it passed all the tests") was recorded in DEC-031 as Safari
> passing ChatGPT and Perplexity, listing and jumping. The owner's detailed report the same day said those were
> still owed on Safari. Later reports arrived as templates with unfilled choices ("[PASS / not checked]").
> **Correct approach:** record acceptance per browser AND per site, exactly as reported. A cell nobody named is
> "not reported" or "owed"; an unfilled template choice is not a choice. Ask about each gap, and point out any
> contradiction with an earlier report.
> **Why:** DEC-031 is the only place live status is kept, so an overclaim there has nothing else to catch it.

> **Issue:** Building the turn-counter fix (v12.11), the spec's redraw on every scan was tried first as written.
> The orbital panel sits inside `document.body`, which `startMessageObserver` watches (`childList`, `subtree`)
> with a 500 ms debounced `scanConversation`. Each redraw scheduled the next scan, and that scan the next redraw.
> An idle page with Navigate open produced 744 mutation records in 6 s, against 0 without the redraw [measured,
> Playwright page realm, Chromium and Firefox, scratch build; the gate's A4 later counted 984].
> **Correct approach:** any DOM write that a scan triggers anywhere inside `document.body`, our own panels
> included, writes only when what it draws has changed. Compare with a record of the last draw (v12.11:
> `_ctxDrawnTurns`), not a timer or a throttle. Gate it with an idle-page mutation count that fails on the
> unguarded write (`probes/check-turn-counter.js`, A4).
> **Why:** the loop raises no error and shows nothing. The panel looks right while the page runs a scan every
> half second, so no functional assertion can catch it.

> **Issue:** In the v12.11 work I called the guarded unchanged-list redraw unreachable [code]. Every path I had
> read sets `_navListFingerprint` and `_ctxDrawnTurns` together. But the SSE handlers (`message_delta`,
> `message_stop`; Chrome + Claude) call `orbUpdateContextBar()` without touching the list, so they record a drawn
> counter the list never saw. The adversarial review's regressions lens found it and measured it with an
> instrumented build. By then the claim was in the code comment, TROUBLESHOOTING, the probes README and the
> CHANGELOG.
> **Correct approach:** before calling a branch unreachable, list every writer of each piece of state its
> condition reads, and every caller of each function that writes it. Label it unreachable [code] only once that
> list is complete; until then write "not reached by \<the paths read\>".
> **Why:** an "unreachable" label stops anyone from gating the branch or reasoning about it. A probe that never
> reaches it (this one has no SSE) then passes, and the pass looks like confirmation.

> **Issue:** v12.12's async GM storage path starts at the very top of `acnMain`, before any `var` below it has been
> assigned. The first draft of `acnStoreLoad` read its 2 s bound from a `var ACN_STORE_LOAD_MS = 2000` declared
> further down. Hoisting made the name exist but left it `undefined` at that point, and `setTimeout(fn, undefined)`
> fires at once. So every Safari page would have logged a load timeout and run on defaults, which reads like a
> slow manager rather than a bug. Caught by reading, before any run.
> **Correct approach:** code that runs before the body (the duplicate guard, `acnStoreIsAsync`, `acnStoreLoad`)
> may call hoisted function declarations, but must not read any module-level `var`: give it literals or locals.
> When adding such code, list every identifier it reads and check where each one is assigned.
> **Why:** a hoisted `var` is `undefined` rather than missing, so nothing throws. The code runs with a wrong value,
> and the symptom points at the runtime instead of at the code.

> **Issue:** While adding U11b to `probes/check-usage-state.js` through a Python heredoc, a regex inside the page's
> template literal reached the file as `/\/usage$/` instead of `/\\/usage$/`: the non-raw Python string halved the
> backslash once. The template literal then turned `\/` into `/`, so the generated page held `//usage$/…`, a line
> comment. The stub script stopped parsing, U3–U6 failed with `requests=undefined`, and U7 timed out, all for that
> reason alone. The probe's own comments warn about this trap.
> **Correct approach:** inside a JS template literal every backslash must be doubled in the file, and a non-raw
> Python string halves it once more. Write such edits with a raw string (`r'''...'''`) or from a file, and grep the
> line as it landed. When many unrelated checks fail at once with values like `undefined`, suspect the harness
> before the code.
> **Why:** the failure looks like a broken build under test, and it was the same family as the `\uXXXX` lesson
> above: each layer of quoting the text passes through can eat an escape.
