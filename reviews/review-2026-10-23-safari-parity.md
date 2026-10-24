# Review — 2026-10-23 — v12.12 Safari parity: usage on the ladder, async GM storage (PR B)

- **Branch:** `fix/safari-parity` → `main` | **PR:** #82 | **First head reviewed:** `4a17ffc` | **Final:** `e87aa27`
- **Diff:** the userscript, `probes/check-usage-state.js`, a new `probes/check-gm-storage.js`, B0's owner-run
  `probes/safari-gm-storage-check.user.js`, `probes/check-transport-ladder.js`, `package.json`, CI and docs.
- **Tiers run:** all three (adaptive: 50+ lines, new files). Started for the spec's per-PR review.

| Tier | Reviewer bound | Model that ran |
|---|---|---|
| 1 — structural | `session` (shipped default) | Claude Opus 5.5, this session |
| 2 — deep logic | `session` (shipped default) | Claude Opus 5.5, this session |
| 3 — independent | `cli:codex` (owner's config) | Codex CLI, the model in the owner's `~/.codex/config.toml` |

## Tier 1 — PASS after one fix

- All six GM keys' 17 call sites go through `acnGetValue` / `acnSetValue`; no direct `GM_getValue` / `GM_setValue`
  call is left.
- The new functions are hoisted declarations, so the top of `acnMain` can call them before any `var` below it is
  assigned. That is why `acnStoreLoad` takes its bound and keys as literals: a first draft read a `var` bound
  that was still undefined there, which would have timed out at once. Caught by reading, before any run.
- ES5 only; no `data-acn-*` attribute was touched.
- The version bump covers `@version`, `ACN_VERSION` and the README badge. The new probe is in
  `npm run test:probes` and CI.
- **Fixed (`4a17ffc`):** the ladder probe recorded every `/api/` fetch. Since B1 the usage request can reach
  fetch (first in Userscripts order, after the GM watchdog otherwise), so its `fetchCalls.length === 0` checks
  could fail on a request they are not about. Usage requests are now refused and not counted.
- **The ladder's mutant builder, run only (no battery):** every mutant that builds on main builds on v12.12,
  41 of 41. M08, M09, M21 and M34 have been broken since v12.10 (ROADMAP 0d); nothing new broke.

## Tier 2 — PASS after one doc fix

- DEC-044's rules hold on the new path: one caller; the flag cleared before the call, and the callback can still
  be synchronous when neither transport can run; supersession untouched; the stale-org drop is the first line of
  the ladder's single callback, so it covers success and failure from either transport.
- **Documented (`4a17ffc`):** the usage GM request now carries the ladder's 45 s timeout and 50 s watchdog. A hung
  request used to say "loading" forever; it now ends as "Usage data unavailable". This changes behaviour on every
  browser, so it is in the CHANGELOG.

## Tier 3 — rounds

| Round | Findings | Verified real | Fixed | Tokens |
|---|---|---|---|---|
| 1 | 5 WARN, 2 NOTE | 7 | 6, 1 logged (`5942bd3`) | 197,886 |
| 2 | 2 WARN | 2 | 2 (`e87aa27`) | 212,013 |
| post-fix | 0 WARN, 1 NOTE (`5942bd3`, `379de06`, `e87aa27`) | 1 | 0, recorded below | 177,111 |

Round 1:
- **WARN, fixed:** two async writes of one key could land out of order and leave the older value stored.
  `acnSetValue` now rewrites the newest when an older write finishes after it. Not a queue, so a write that
  never answers holds nothing up. Whether Userscripts ever reorders writes is unmeasured.
- **WARN, fixed:** with no `lastActiveOrg` cookie, a late org-list answer from chat A could start a request for
  its org, overwrite `_usageOrgUuid`, and push chat B's answer out while A's was shown. The race predates PR B, in
  code it rewrote. A later request now supersedes a pending org list (`_usageOrgListSeq`).
- **WARN, fixed:** G4 recorded the startup time but never asserted it.
- **WARN, fixed:** U11 always had the cookie, so the org-list branch's move to the ladder was ungated. U11b: no
  cookie, every GM request refused.
- **WARN, logged (ROADMAP 0d):** no check covers the cross-org stale-response drop. U8–U10 overlap requests for one
  org by design. The gap predates PR B, which keeps the line as it was; a gate needs a two-org fixture whose second
  org is validated mid-request.
- **NOTE, fixed:** G1 now asserts the load asks for all six keys.
- **NOTE, fixed:** G5 gates a rejecting `GM.setValue` (logged once, no page error).

Round 2:
- **WARN, fixed:** the rewrite was still ungated, since the stub's writes always finished in order. G6: the stub
  finishes a key's first write last.
- **WARN, fixed:** G4's lower bound timed from navigation, so a shorter bound plus the page load could pass. G4 is
  now timed in the page, from the first `GM.getValue` to the cluster's insertion: 2000–4000 ms.

Post-fix validation, **APPROVED**:
- **NOTE, not fixed:** U11b does not show that the usage path's org list asked gmxhr before fetch. A count of GM
  org-list requests cannot tell, because the index asks GM for the org list in the same scenario. Recorded as
  ungated.

**Verdict: APPROVED + POST-FIX VALIDATED.** The Codex sandbox could not start Playwright (`EPERM`) in any round,
so every fix was measured locally.

## Gates after review, Playwright page realm, headless, this Mac

| Build | Result |
|---|---|
| v12.11 | fails U11, U11b, U12 (Chromium; U11 and U12 also on Firefox) and G1, G2, G4, G5 (Chromium) |
| v12.12 | passes U1–U12 and G1–G6 on Chromium; per-engine results of the final run are in the PR |
| v12.12 with no rewrite in `acnSetValue` | fails G6 only |
| v12.12 with a 1.5 s load bound | fails G4 only |

**Self-inflicted, caught before commit:** a regex added inside `check-usage-state`'s page template lost a
backslash and became a `//` comment, so the stub stopped parsing and most checks failed for that reason alone.
The probe's own comments warn about this trap.

## Totals

- **Tier 1/2:** 2 found, 2 fixed.
- **Tier 3:** 10 raised, 10 verified real; 8 fixed, 1 logged (the cross-org gate), 1 recorded as ungated (U11b's
  transport order).

**GitHub rounds needed afterwards:** to be recorded when PR #82's GitHub Codex review completes.
