# Review — Tools panel i18n wiring

**Date:** 2026-08-02 | **Branch:** `fix/tokenizer-korean-v12.7` | **Base:** `main` @ `2ad8dc1`
**Diff:** 26 insertions / 12 deletions, 1 file, 0 new files | **Tiers run:** 1, 2

Tier 3 not selected: the adaptive rule puts a 26-line single-file change at Tiers 1+2, and the
`opus` backend was measured at **90+ minutes** on the previous round — disproportionate for
i18n wiring with no logic change.

---

## Verdict

**APPROVED.** One WARN found and fixed (unreachable fallbacks disagreeing with the table).
Two NOTEs recorded, neither blocking. Suite 1120/1120 both engines.

## What changed

The Tools panel never called `i18n()`. Thirteen keys had Korean translations written and
**none was ever read** — the panel rendered English literals regardless of the language
setting. All thirteen are now wired, plus one new key (`exports`). `/Commands` is left in
English by owner instruction.

## Tier 1 — structural

| Check | Result |
|---|---|
| New key in BOTH tables | PASS — `exports` present in `en` (:74) and `ko` (:142) |
| en/ko key parity | PASS — all **66** en keys have ko values |
| English fallback on every call | PASS — 14/14 have `|| '<English>'` |
| Escape convention | PASS — the new ko value uses `\uXXXX`; no raw non-ASCII added to functional lines |
| ES5 | PASS — no arrow/let/const/template literals in added code |

## Tier 2 — deep logic

**WARN (fixed) — three fallbacks were unreachable AND disagreed with what renders.**
`i18n('exportFullDesc') || 'Markdown with all messages and code blocks.'` — the `||` branch
fires only when the key is *absent*, and these keys exist, so the fallback text could never
appear. It also differed from the `en` table value that does render. The code therefore read
as though the old English wording was preserved when it was not. Aligned to the table values.
This is the project's "a comment describing behaviour is not evidence the behaviour exists"
family, in fallback form.

**NOTE — English export descriptions changed**, because they now come from the `en` table
rather than the inline literals:

| was (literal) | now (table) |
|---|---|
| Markdown with all messages and code blocks. | Markdown with all messages |
| Pinned messages as structured document. | Pinned messages as document |
| Topics, decisions, and action items. | Topics, map, key points |

The third is arguably more accurate since v12.6 added the map. **Raised with the owner rather
than decided** — reverting means editing the three `en` values.

**NOTE — a language switch leaves Tools mixed-language until refresh.** Measured, not argued
(Chromium, settings switched in-place without reload, panel closed and reopened):

```
before switch (en) : Image Gallery (0) | Exports | Full Conversation
after switch to ko : 이미지 갤러리 (0)   | Exports | Full Conversation
```

The gallery header re-renders on panel open, so it updates immediately; the Exports section is
built once at injection, so it does not. Pre-existing contract — the switch handler updates
only dot labels and panel `h3`s, and the toast says *"Language updated — refresh to apply"*.
After a refresh everything is Korean. Before this change the panel was uniformly English in
both states, so the mixed state is new, but it is transient and strictly better post-refresh.
Not fixed: rebuilding the panel on switch is a larger change than the contract warrants.

**Traced clean:** no listeners, timers or observers added; no mutable state; `i18n()` already
guards its `GM_getValue` in a try/catch; no test asserts on any of the changed strings
(grepped); export *actions* and the `data-acn-*` test contract untouched.

## Second pass — owner-directed additions (2026-08-02)

**`Exports` → 파일 내보내기**, the owner's wording (파일 "file" + 내보내기 "export").

**The Plan usage panel, done in full.** The owner authorised this on the premise that "we
already have the words ready" — worth recording that the premise was wrong: only 3 of ~15
user-visible strings had translations (`session`, `weekly`, `usageUnavailable`). The rest
needed new keys and new Korean, listed below for correction.

**Templated, not concatenated, and that is load-bearing.** The reset phrase was built as
`'resets ' + day + ' ' + time + ' ' + ampm`. Korean puts the meridiem BEFORE the time
(오후 3:05), so no reordering of concatenated fragments can produce correct Korean. The strings
are now `{placeholder}` templates fed through `i18n(key, replacements)`, which the helper has
supported all along (precedent: `searchResults: '{count} matches'`).

| English | Korean chosen |
|---|---|
| Plan usage | 플랜 사용량 |
| Plan usage loading… | 플랜 사용량 불러오는 중… |
| Session (5h) | 세션 (5시간) |
| Weekly | 주간 *(pre-existing)* |
| Sonnet (7d) | Sonnet (7일) *(model name kept)* |
| {pct}% used | {pct}% 사용 |
| resetting soon | 곧 초기화 |
| resets in {n} min | {n}분 후 초기화 |
| resets in {h}h / {h}h {m}m | {h}시간 후 초기화 / {h}시간 {m}분 후 초기화 |
| resets {day} {time} {ampm} | {day} {ampm} {time} 초기화 |
| Sun,Mon,… | 일,월,화,수,목,금,토 |
| AM / PM | 오전 / 오후 |

**English proven unchanged rather than argued:** `formatResetTime` was extracted from both the
pre-change build and this one and run over **58 cases** — every minute-bucket boundary
(-5, 0, 1, 17, 59, 60, 61, 90, 180, 1439, 1440, …) and every weekday × hour combination that
reaches the date branch. **0 differences.** Korean renders `수 오후 3:05 초기화`.

---

## Related, NOT fixed (owner's call)

~~The Plan usage panel has the identical defect.~~ **Done in the second pass above.**
Remaining untranslated by explicit owner instruction: the **/Commands** section — "slash
command" reads as its own noun and translating it would confuse rather than help.

## Verification

Suite **1120/1120** both engines · Tools panel rendered and read in both languages ·
userscript parses · en/ko key parity 66/66.
