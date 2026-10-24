# Review — 2026-10-24 — v12.13 cross-tab saves (the cross-tab PR)

- **Branch:** `fix/cross-tab-storage` → `main` | **PR:** (number on opening) | **First head reviewed:** `698e27f` |
  **Final:** `c4d1ec4` (later commits are docs only)
- **Diff:** the userscript (`acnUpdateValue`, `acnPersist`, the four collections' callers), `probes/check-gm-storage.js`
  (G7–G30), C0's owner-run `probes/cross-tab-gm-check.user.js`, and docs.
- **Tiers run:** all three (adaptive: 500+ lines, two new files), plus an adversarial workflow alongside Tier 1–2,
  as for PR A.

| Tier | Reviewer bound | Model that ran |
|---|---|---|
| 1 — structural | `session` (shipped default) | Claude Opus 5.5, this session |
| 2 — deep logic | `session` (shipped default) | Claude Opus 5.5, this session |
| 3 — independent | `cli:codex` (owner's config) | Codex CLI, the model in the owner's `~/.codex/config.toml` |
| extra — adversarial | a workflow: 4 finder lenses, one refuter per finding | Claude Opus 5.5 subagents, 26 agents |

## Tier 1 — PASS

- `acnUpdateValue` is wired into all four collections; every `saveCommands` caller was converted; no GM key added,
  so `acnStoreLoad`'s list is unchanged. The new i18n key has an English and a Korean string and one call site.
- `saveBookmark` now returns a boolean; only the toggle reads it, and the click handler's title re-read still runs.
- ES5 only; no `data-acn-*` attribute touched. The storage helpers are hoisted declarations, and `_acnRefused` /
  `_acnWatchers` are assigned before any save can run (the Safari first pass returns before them).
- NOTE: comments cited DEC-050 before the docs commit added it.

## Tier 2 — PASS, one WARN (documentation)

- **WARN, fixed in docs:** the storage rule said "always `acnGetValue`/`acnSetValue`"; a future collection saved
  with `acnSetValue` would bring the loss back. `agent_docs/conventions.md` now says collections save through
  `acnUpdateValue`; the CLAUDE.md wording is proposed in the PR for the owner's approval, not committed.
- NOTEs: a Safari page's copy of a collection refreshes only on its own save (a duplicate record is possible, no
  loss); command ids could collide in one millisecond (later fixed by Tier 3, round 2 and 3); G13's stub assumed
  six startup reads.

## Adversarial workflow — 22 findings, 19 confirmed by refuters

Measured where it mattered (Playwright Chromium, page realm, stubbed storage). The four WARNs, all fixed in `633a14c`:
- **The first command on an empty Safari store was stored twice:** the in-memory step mutated the `[]` default
  object, and the persist step reused it (measured: `["only","only"]` stored). Each read now gets its own copy (G19).
- **A failed write lost its change for good,** and the next save removed it from the page too (measured: v12.12
  kept 2 of 2, the build kept 1). The queue now keeps every change until a write that includes it succeeds (G20).
- **One GM call that never answered held every later save of its key** for the rest of the page. A step is now
  abandoned after 5 s, its changes kept (G21, G22).
- **No check covered the deletion half of the merge** (G17, G18 added; v12.12 fails both).
NOTEs fixed: replayed changes work on copies; a rename keeps names unique; a Tampermonkey save that throws is
logged; the clear-all comment; G8/G9 read the flag after the first click; C0 says which line counts. NOTEs recorded
as residuals in DEC-050: the round-trip race, a whole-record migration update, a reload inside one round trip, the
unreadable-value lock, a refusal found only at write time.

## Tier 3 — rounds

| Round | Findings | Verified real | Fixed / disposition | Tokens |
|---|---|---|---|---|
| 1 | 6 WARN | 6 | 4 fixed (`633a14c`), 2 recorded (the round-trip race; a stale-tab edit after a delete elsewhere) | 155,675 |
| 2 | 4 WARN | 4 | 4 fixed (`eff22e7`) | 193,209 |
| 3 | 4 WARN, 1 NOTE | 4 | 3 WARN + the NOTE fixed (`16f858e`); 1 false positive (G16's encoding) | 200,399 |
| 4 | 2 WARN, 1 NOTE | 3 | 1 WARN + the NOTE fixed (`a9bf93a`); 1 kept by decision (a stored `null` on Safari) | 316,788 |
| 5 | 3 WARN | 3 | 2 fixed (`af9eaec`); 1 pre-existing, logged (ROADMAP 0d) | 182,649 |
| 6 | 2 WARN | 2 | 2 fixed (`b524cdb`) | 151,865 |
| 7 | 1 WARN, 1 NOTE | 2 | both fixed (`122c537`) | 202,481 |
| 8 | **APPROVED**, 2 NOTE | 2 | both fixed (`c4d1ec4`) | 167,586 |
| post-fix | **VALIDATED** (fix commits `633a14c`…`c4d1ec4`) | — | — | 148,325 |

What each round found, in short:
- **1:** the two-tab race inside one round trip (recorded; accepted by the owner); a conversation entry that is not a
  list (fixed; unreachable from the UI); two tabs creating one command name (fixed: `name-2`, G15); create/edit
  reporting success on a refused save (fixed, G16); a stale-tab edit after another tab's delete (recorded: a deletion
  elsewhere wins); no gate for the context cache (G14).
- **2:** a change made during a step that then failed waited for a third save (G23); Clear all deleted by the page's
  copy, not the panel (fixed; G24 is a guard, since a scan redraw closes the gap within ~500 ms); command ids
  colliding in one millisecond; the open /Commands list keeping a pre-write name (G25, through `acnWatch`).
- **3:** a `null`/`false`/`0` entry treated as missing and written over (G26); a prototype lookup making
  `constructor` a taken name (G27); 16 random bits too few for ids; C0's 16-bit tab label. False positive: G16
  hands the stub the raw text directly.
- **4:** a stored `null` on Safari treated as missing — kept: refusing it could block every first save if
  `GM.getValue` returns `null` for a never-stored key, which is unmeasured, and a `null` holds no records; G24 not
  proving the panel showed every record (strengthened); no check for a read failing after startup (G28).
- **5:** flags not reset after a write merged another tab's removal, so a click re-added it (G29); the id fallback
  could itself collide (removed); a Tampermonkey migration whose save throws is not retried (pre-existing in
  v12.12; logged).
- **6:** a watcher's save during `finish` could start a second, overlapping step (watchers now run while busy;
  `acnPersist` refuses a second step; not gated); a command use counted twice on replay (guarded; not gated).
- **7:** the queue kept the first change's validity check for the whole key, so after a page moved conversations a
  change was checked against the wrong conversation and dropped silently (G30).
- **8:** a late rejection after the 5 s abandonment logged a second warning; two uses in one millisecond counted
  once. Both fixed.

## Totals

- Tier 3: 22 WARN and 5 NOTE raw over 8 rounds; 26 verified real (1 false positive); 22 fixed in code or gates, 1
  kept by decision, 1 pre-existing logged, 2 recorded as residuals. Tokens: 1,718,977 over the 8 rounds and the
  post-fix pass (Codex CLI's own reporting).
- Adversarial workflow: 22 findings, 19 confirmed, 4 WARNs fixed.
- Gates added: G7–G30 in `check-gm-storage` (G8b dropped: unreachable from the UI). Each fixed mechanism has a check
  that fails on the build before it, except those listed as not gated in DEC-050.
- **GitHub Codex rounds needed afterwards:** (filled in after the PR's review cycle)

## Measurement context

Every gate result above is Playwright's page realm, headless, this Mac, with both GM APIs stubbed over
`localStorage`; no manager's real storage. C0 is the real-browser measurement the fix depends on: the owner, all
three managers, PASS (DEC-050). Real-browser acceptance of v12.13: DEC-031.
