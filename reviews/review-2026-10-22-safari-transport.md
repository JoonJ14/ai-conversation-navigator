# Review — the Safari/Userscripts transport ladder, v12.9 (2026-10-22)

**Branch:** `fix/safari-transport-fallback` | **Base:** `main` @ `b471ddc` (v12.8) | **Head at review:** working tree
**Merged:** 2026-10-23 as `4c72ca9` (head `9ed5182`); as merged, 21 files, userscript +597 / −134, probe 1326 lines
**Diff at review:** userscript +601 / −135 lines + 1 new probe (1434 lines) + CI/package wiring + docs
(13 files) → **all three tiers** per adaptive scaling (50+ lines, new files, 3+ files)
**Reviewers (resolved by `resolve-reviewers.sh --host claude`):** Tier 1 `session` · Tier 2 `session` ·
Tier 3 `cli:codex` (personal `review.conf` `[claude]`) — model `gpt-5.6-terra`, reasoning `xhigh`, read-only sandbox

---

## What changed

The Claude conversation index gets a second transport. `GM_xmlhttpRequest` (v12.8's request, byte-for-byte)
and `fetch(location.origin + path, {credentials: 'include'})` behind `ciApiGet`; ordered by
`GM_info.scriptHandler` or `GM.info` (Userscripts → fetch first); the second tried when every candidate refused
the first (401/403/404) or it could not run; the winner — the transport that delivered a usable index — cached
per page session; a refusal never PERMANENT until both were tried; fetch's never-cancelled requests bounded
page-wide (two timed out, six open); one diagnostic line per request naming its transport. DEC-045.

---

## Tier 1 — structural scan (session)

**PASS** on all four code files — 0 CRITICAL, 0 WARN, 1 NOTE.

| Check | Result |
|---|---|
| Registration completeness | PASS — every new `ci*` function defined once and used; `ciRequestJSON` / `ciConversationUrl` gone from all live code and docs (ROADMAP item 3 updated) |
| Interface contracts | PASS — every caller of `ciResolveOrgCandidates`, `ciFetchWithOrgFallback`, `ciFetchFromAllOrgs` passes the new `trace`; `ciSetDegraded`'s third argument is optional, so v12.8's callers are unchanged |
| Config hygiene | PASS — `CI_API_ORIGIN`, `_ciTransport`, `CI_FETCH_STALL_MAX` / `_ciFetchStalled` documented (`CI_FETCH_OPEN_MAX` / `_ciFetchOpen`, added in Tier 3 round 6, likewise); the gmxhr watchdog is `CI_FETCH_TIMEOUT_MS + 5000` with its reason |
| File placement / wiring | PASS — probe in `probes/`, in `npm run test:probes` and a CI step; `package.json` parses; workflow YAML parses |
| Project rules | PASS — ES5 only in added code; functional non-ASCII escaped; `@grant` untouched; no `data-acn-*` removed; version 12.9 in both places |
| **NOTE** | the new probe defaults to chromium where the older probes default to firefox — harmless, CI passes `--browser` |

## Tier 2 — deep logic (session, plus a six-lens adversarially-verified review)

The session pass traced every exit of `ciLoadIndex` against the state it touches (in-flight marker, done
semantics incl. v12.8's superseded-noOrg asymmetry, the org/transport commits behind the guard, timers on
every callback path): 0 CRITICAL, 0 WARN, 4 NOTE (below). A six-lens review (ladder correctness, spec
compliance, runtime/realm, test validity, docs accuracy, ES5/conventions) ran alongside, each finding checked
by one or two skeptics told to refute it: **29 findings → 22 confirmed, 7 refuted.** All seven refutations were
benign — four because the working tree already contained the proposed fix by the time the skeptic looked,
three judged correct as written (one with stronger evidence: Tampermonkey 5.5.0's shipped `page.js` sends the
exact `background shutdown` payload).

**Confirmed and fixed (code):**
| Finding | Fix |
|---|---|
| `walk()` comment claimed it caught ranking throws; `ciRankOrgs` runs in a response callback, so an object `capabilities` still wedged the load at "loading" (pre-existing; reproduced on v12.8) | `ciRankOrgs` tolerates any shape (order unchanged for valid input); comment corrected; **LR** |
| A first walk mixing 404 and 403 went PERMANENT with the other transport never asked — the exact v12.8 Safari line, and detection-dependent (spec 2.2/2.3) | 404 counts as a refusal (the walk already treats it like 403); **LM1** |
| Single-transport summary lines did not name the transport (spec 2.4) | every reason from the org walk starts with `[gmxhr]`/`[fetch]` (two post-fetch validation reasons do not — see "Scope against the spec"); **LM3** |
| `fetch` targeted `location.origin` while platform detection is `host.includes('claude.ai')`: a look-alike host could receive credentialed requests (new in v12.9) — and the pre-existing gmxhr path could render the user's real conversation into such a page | `fetch` refuses any origin but `https://claude.ai` (**LO**); the index requires the exact host (**LH**) |
| README privacy claims (`@connect` restricts all reads; "no network requests" on Safari) now inaccurate | README rewritten for both transports |

**Confirmed and fixed (tests):** mixed-walk shapes LM1–LM5; L3d-retry (the combined-failure path must
retry — L3-backoff alone could not tell "backs off" from "never retries"); L4b/L3c/L4c now prove the throwing
transport was called; L1-list + L7f (one line per request, counted). **Docs:** overstated invariants (CLAUDE.md,
architecture.md, the userscript header comment), "fetch never first on Tampermonkey" vs the winner cache, the
DEC-021 addendum's unlabelled realm inference, ROADMAP 0d's persistence entry, the Layer 3 definition, and three
probe/comment attributions.

**Session NOTEs (not fixed, recorded):** (1) a timed-out fetch is ignored, not aborted — by design, since no
AbortSignal crosses realms (and later bounded, see Tier 3 WARN 2); (2) our own fetches leave resource-timing
entries that later loads harvest as org candidates (TESTING.md); (3) the usage panel stays GM-only on Safari
(ROADMAP 0d); (4) Userscripts' missing synchronous storage — nothing kept in GM storage works on Safari (ROADMAP 0d).

## Tier 3 — codex

| Round | Findings | Verified | Fixed | False positive | Tokens | Notes |
|---|---|---|---|---|---|---|
| 1 | 2 WARN | 1 | 1 | 1 | 204k | |
| 2 | 3 WARN | 3 | 3 | 0 | 195k | 3+ WARN → blocks |
| 3 | 2 WARN | 2 | 2 | 0 | 160k | below the block, fixed anyway (pipeline rule: fix every verified WARN) |
| 4 | 2 WARN | 2 | 2 | 0 | 138k | below the block, fixed anyway |
| 5 | 4 WARN | 3 | 3 | 1 | 193k | 3+ WARN → blocks; WARN 1 + 2 share one fix |
| 6 | 2 WARN, 1 NOTE | 3 | 3 | 0 | 210k | below the block, fixed anyway |
| 7 | 3 WARN | 3 | 3 | 0 | 152k | 3+ WARN → blocks |
| 8 | 2 WARN | 2 | 2 | 0 | 169k | below the block, fixed anyway |
| 9 | 3 WARN | 3 | 3 | 0 | 151k | 3+ WARN → blocks |
| 10 | none | — | — | — | 181k | **APPROVED** — the last round the pipeline's 10-iteration cap allows, run as full review AND post-fix validation |
| **total** | **23 WARN, 1 NOTE** | **22** | **22** | **2** | **~1.75M** | |

**Round 1, WARN 1 — "a 401 does not advance to the next candidate, so the ladder switches transports first":
FALSE_POSITIVE as a defect.** 401-terminal is v12.8's own walk rule (spec 2.5: do not change the walk);
v12.8 never tried a later candidate after a 401 either, it went straight to PERMANENT — v12.9 tries the other
transport first, which is strictly better. 401 means unauthenticated (a wrong org answers 403), so switching
transports is the right move. The coverage gap it pointed at was real: **LM5** now pins the 401 path.

**Round 1, WARN 2 — "a timed-out fetch is never cancelled; each ~16s retry starts another": VERIFIED, fixed.**
At most one timed-out fetch may linger; while it does, a new attempt reports a timeout without sending, and a
late answer is not read. **LWb-cap.** (Rounds 3–5 kept finding edges in where that count lived; round 5
replaced it with a page-wide cap of two — below.)

**Round 2 (on the post-fix code), all three VERIFIED and fixed:**
- **WARN — the new host guard checked only `hostname`.** `@match` patterns ignore ports, so on
  `https://claude.ai:<port>/chat/<uuid>` fetch refused the differing origin — and the ladder then used gmxhr
  against production `https://claude.ai`, rendering the conversation into a page of a different origin.
  (Exploiting it needs a valid TLS certificate for claude.ai, so this was defense in depth, not an open
  hole.) Fixed: `ciIsClaudeChat` requires the exact origin. **LO** now asserts the index never runs there.
  The fetch transport's own origin refusal is consequently unreachable — kept as defense in depth, recorded
  as ungated in the matrix rather than claimed.
- **WARN — L5b proved fetch→gmxhr fallback but never started a second load,** so caching a *gmxhr* winner
  was ungated (only fetch winners were, by L1b). **L5b-cache** added.
- **WARN — the watchdog coverage modelled a fetch that never settles, not one that settles after timing
  out,** so the stalled-slot release was ungated: lose it and every later fetch fails fast forever. **LWc**
  added (first answer at 50s, after the 45s timeout; the ~61s retry must send and load the full list).

**Round 3, both VERIFIED and fixed:**
- **WARN — `_ciFetchStalled` was global and survived a conversation switch.** A fetch that hung in chat A
  made every fetch in chat B fail fast without a request until A's obsolete promise settled — forever if it
  never did. Fixed with an epoch bumped in `ciInvalidate`: a switch starts a fresh count, and a request
  from an older epoch neither counts nor releases. **LWd** (hang in A, switch to B: B sends and loads).
- **WARN — a mixed second walk lost the first's refusal.** gmxhr refused everywhere; fetch then met a
  wrong-org 403 and silence. The round-2 rule counted that 403 as "fetch got a verdict", classified the
  failure transient, and re-polled both refused walks every ~16s. Codex's rule adopted: the second upholds
  the first's refusal unless it met an actual server verdict (5xx, 429, bad body). Every earlier
  classification check keeps its outcome under the new rule. **LM6.**

**Round 4, both VERIFIED and fixed:**
- **WARN — round 3's epoch reset lived in `ciInvalidate`, which a switch during the FIRST load never
  reaches** (`_ciConversationId` is still null then, and the switch path only invalidates when it is set).
  A's later timeout then counted in the epoch B was using. The reset now runs in `ciLoadIndex`, keyed to the
  conversation each load is for — one mechanism, and the `ciInvalidate` copy removed. **LWe** (switch while
  A's first fetch hangs; B's retries forced past A's 45s timeout must still send). The `ciInvalidate`-only
  form is kept as mutant M29b and fails LWe — so LWd and LWe gate different halves.
- **WARN — every scenario seeded `lastActiveOrg`, so the fresh-session path was untested**: no candidates,
  gmxhr's 403 on the org list ends the walk through the `noOrg` exit, and that exit must still hand the load
  to fetch. **LN.** (Its first draft over-asserted one gmxhr request: with no cookie the usage panel makes
  its own GM org-list request, which the shim cannot tell apart — the check now counts the index's own log
  lines.)

**Round 5 — four WARNs: three VERIFIED and fixed, one FALSE_POSITIVE as a defect.**
- **WARN 1 + WARN 2 — the per-conversation stall count still had edges: VERIFIED.** A → a non-chat page → A
  kept A's epoch, so a hang from the earlier visit counted against the later one's retries; and A → B → A
  reset the count, so navigating while requests hung started one more uncancellable request per visit,
  without bound. A fourth re-keying would have been the third patch to one mechanism, so the mechanism was
  replaced: at most **two** timed-out fetches may linger, **page-wide**. One lingering request blocks
  nothing (a lone hang is no evidence the path is dead); two at once is. Navigation cannot exceed it, a lone
  hang cannot trip it, and the epoch code is gone. The accepted cost, recorded in DEC-045: two requests that
  never end keep the index degraded, with its banner, until a reload. Gated from both sides — **LWb-cap**
  rebuilt (stalls in chats A and B; chat C must report a timeout without sending, on its retry too), **LWc**
  rebuilt (B's late answer must free a slot, so C sends and loads), and LWd/LWe now pin the lower side.
  Mutants: M31 (cap of one) fails LWd + LWe, M32 (cap of three) fails LWb-cap; rounds 3–4's epoch mutants
  M29/M29b retired with the mechanism.
- **WARN 3 — the probe never drove the manager's own `ontimeout`: VERIFIED.** Its only timeout-like gmxhr case
  was a total hang, which exercises the watchdog. A misclassified `ontimeout` would make a real manager
  timeout fall through to fetch and cache it, with every check green. **LM7** (the shim's new `timeout` mode:
  one `error=timeout` line, fetch never asked, not PERMANENT); mutant M30 fails it.
- **WARN 4 — "the old-build and mutation proofs are not executed by CI": FALSE_POSITIVE as a defect.** The
  spec asks that the old build *demonstrably* fail fixture 1; it was run (`ACN_SCRIPT` → v12.8 from
  `git show b471ddc`) and is recorded with its context in the probe header, DEC-045, CHANGELOG and
  TROUBLESHOOTING (consolidated into this record on 2026-10-22) — how this project records every probe measurement (`probes/README.md`). The placeholders
  Codex saw are filled from the final battery before commit. A CI job that re-runs the v12.8 baseline would
  pin CI to a historical commit; it is offered to the owner as a follow-up, not added unasked.

**Round 6 — two WARNs and one NOTE, all VERIFIED and fixed.**
- **WARN — the winner was cached before its body was validated.** `_ciTransport` was committed alongside the
  org, before the shape check and the index build. A fallback fetch answering 200 with a parseable but
  unusable body became the session's winner; every later load asked fetch first, its 200 ended each walk
  before the ladder could look at gmxhr, and a gmxhr that had started working was never asked again. The
  cache now commits only once the index has validated and built. **L1v** (gmxhr refused; fetch 200 with an
  empty `chat_messages`: degraded with "unexpected response shape", and the next load's order line is
  gmxhr-first by detection). Mutant M33 (round 5's position) fails it.
- **WARN — the stall cap saw a request only after its 45s timeout, so a burst of conversation switches could
  open any number.** VERIFIED — and it falsified a claim this branch had written into the code comment and
  DEC-045 ("navigation cannot exceed it"). Fixed in code, not in wording: a second page-wide bound, at most
  **six fetches open at all**, timed out or not. Six is far above real use (one load per conversation,
  ~2.1s for 3.3MB, DEC-021), so only a burst into a hanging path reaches it. Every exit of `ciFetchGet`
  frees its slot, including the two synchronous-throw paths that before had nothing to free. **LWf** (six
  conversations opened back to back into a hanging path all send; a seventh is refused without sending —
  no timeout involved) and **LWg** (seven answered loads in a row all load). Mutants M35 (no open bound) and
  M37 (a bound of five) fail LWf; M36 (never released) fails LWg.
- **NOTE — the fetch fixture answers by path, and L1-shape checked only a URL prefix,** so a fetch that
  dropped the query string still got the payload. L1-shape now pins the URL in full; mutant M34 fails it.

**Round 7 — three WARNs (3+ → blocks), all VERIFIED and fixed.**
- **WARN — an org list that answered 200 but held no usable org was not counted as a server verdict.**
  `ciApiStep` counts only failed responses, and the walk judges the org list after it, so `200 {}` — or an
  array with no uuid — counted as nothing. When gmxhr was refused and fetch then met a wrong-org 403 and such
  a list, the second walk looked like "only refusals", upheld gmxhr's refusal and went PERMANENT, where v12.8
  classified the same generic reason as transient. `ciCountUnusableOrgList` now counts it as a verdict on
  both org-list paths; the walk's own path and reasons are untouched. **LM8** (the all-orgs path, `{}`) and
  **LM8b** (the first org-list path — no cookie — with an array holding no uuid); mutants M41 and M40 fail
  them respectively.
- **WARN — detection through `GM.info` was ungated.** No scenario exposed the manager's name only as
  `GM.info`, and whether Userscripts provides `GM_info` without a grant is unmeasured, so that branch may
  be the one Safari takes. **L5c**; mutant M38 fails it.
- **WARN — no scenario produced unparseable JSON,** so the parse-failure classification (a verdict: no
  fallback) was ungated. **LM9** (gmxhr 200 with a truncated body: fetch never called, v12.8's PERMANENT
  "malformed JSON"); mutant M39 (a parse failure classed as "could not run") fails it.

**Round 8 — two WARNs, both VERIFIED and fixed.**
- **WARN — an unusable org list on the all-orgs path inherited the cheap candidates' 403.** v12.8 appends
  that status ("every cheap candidate 403'd and the org list held nothing new") so an unauthorized tab backs
  off. With an array holding no usable org the list request itself answered 200 — the tab is authorized —
  yet the stale "(HTTP 403)" sent this one shape to the PERMANENT backoff while the other two retried on the
  cooldown, contradicting what round 7 had just documented. The reason now says the list held no usable org;
  a usable list with nothing untried keeps v12.8's status. The only change to a reason the walk produces,
  recorded in DEC-045. **LM8c**; mutant M42 fails it. **Reverted on the owner's decision after the PR opened
  (2026-10-22):** the reason is v12.8's again, LM8c now holds v12.8's PERMANENT class, and M42 is now the
  round-8 change itself.
- **WARN — a missing `GM_xmlhttpRequest` (Greasemonkey 4) was ungated:** every scenario installed the shim.
  The shim gained an `absent` mode; **L4d** (no API, `GM.info` names Greasemonkey: gmxhr cannot run, the
  fallback line says so, fetch loads the full list, no page error). Mutant M43 (a missing API read as "no
  answer") fails it.

**Round 9 — three WARNs (3+ → blocks), all VERIFIED and fixed.**
- **WARN — a late answer freed its slots but left its body streaming.** The stalled branch returned
  without reading the body — on purpose, it may be megabytes — but without cancelling it either, so a late
  3.3MB answer kept downloading while the bounds counted it as gone. `discard()` now cancels the body
  stream of any response nobody will read (the late answer, and one whose reading threw). **LWc** now also
  requires the late answer's body to have been cancelled (the probe's fetch spy counts `body.cancel`);
  mutant M44 fails it.
- **WARN — the cleanup on a REJECTED fetch was ungated:** L6b rejects once and closes its context, so a
  rejection that kept its slot would pass until six had piled up. **LWh** (six conversations rejected in a
  row, then a seventh that must load); mutant M45 fails it.
- **WARN — the watchdog's place in time was ungated.** LWa never calls back at all and LM7's `ontimeout`
  fires after 5ms, so a watchdog moved to or before the manager's 45s would pass both — while handing every
  merely-slow gmxhr request to fetch and caching it. The shim gained a `timeout-real` mode (`ontimeout` at
  the request's own `timeout`); **LWi**; mutant M46 (the watchdog AT 45s) fails it.

**Round 10 — APPROVED: no CRITICAL, WARN or NOTE.** The pipeline caps the main loop plus post-fix validation
at 10 iterations, and the loop first came back clean on the tenth — so round 10 ran as both. Its prompt kept
the full five-lens review and added the post-fix validation brief: every fix area from rounds 1–9 by
function, with the three questions the validation pass exists for (did a fix break what it preserved; does
new state leak, go negative or wedge; is any fix incomplete on a sibling path, or any probe check unable to
fail). One comment line in the userscript header was corrected while the round ran (the org list's 403 is
read off v12.8's own reason line, not the owner's probe); a comments-stripped diff against the reviewed
snapshot is empty.

## Measurement — mutation matrix

Results, measured 2026-10-22 against snapshot builds (Playwright 1.58.2 — chromium-1208, firefox-1509,
webkit-2248 — macOS arm64, page realm): **v12.9 passes all 63 checks on chromium, firefox and webkit; v12.8
fails 52 of 63** on chromium and firefox — the same list on both, L1 (spec fixture 1, the Safari shape)
among them. The 11 it passes are the guards both builds must keep — the Firefox path and its byte-identical
request (L2, L2-shape, L2b), the backoff and the network-error rule (L3, L3-backoff, L6, L6-retry), the
sentinel (L0) — and three it passes trivially, having no fetch to misuse (L7d, LM2, LM4).

**Re-measured after the owner's revert of the unusable-org-list reason (2026-10-22, same context).** LM8c now
asserts v12.8's class: "(HTTP 403)", PERMANENT. The reverted build passes all 63 checks on chromium, firefox
and webkit, and v12.8 still fails the same 52 on chromium and firefox (LM8c among them, since v12.8 has no
fetch). All 46 mutants were rebuilt against the reverted code. The five whose recorded failures included
LM8c (M01, M04, M11, M41, M42) were re-run, plus M46. M01, M11 and M46 are unchanged. M04 and M41 no longer fail LM8c, because the second
transport's own "(HTTP 403)" now makes that case PERMANENT whatever they remove. M42 is redefined as the
round-8 change itself, and LM8c catches it. The table below is updated to match; 43 of 46 are still gated.

| Mutant | Mechanism removed | Checks that fail |
|---|---|---|
| M01 | no ladder — a failed first walk is final | L1, L1-list, L1-log, L1-shape, L1b, L1c, L1-slow, L5b, L5b-cache, L1v, L4a, L4b, L4d, L3-order, L3d, L3d-retry, LM1, LM5, LM6, LM8, LM8b, LM8c, LN, L3b, L3c, L4c, LWa |
| M02 | detection ignored — gmxhr always first | L5, L5c, L5b, L4b, L6b, LWb, LWb-cap, LWc, LWd, LWe, LWf, LWh |
| M03 | fallback on ANY failed walk (network errors included) | LM2, LM3, LM4, LM7, LM9, L6, L6-retry, L6b, LWb, LWc, LWd, LWe, LWh, LWi |
| M04 | both failed: classify by the first transport only | L3d, L3d-retry, LM8, LM8b |
| M05 | both failed: a second with no verdict no longer upholds the first's refusal | LM6, L3b, L3c |
| M06 | the winner is never cached | L1b, L5b-cache |
| M07 | a synchronous GM throw escapes (v12.8) | L4a, L4c |
| M08 | gmxhr request no longer byte-identical (Cache-Control dropped) | L2-shape |
| M09 | fetch grows a custom header | L1-shape |
| M10 | error.type printed unvetted | L7e |
| M11 | per-REQUEST fallback on every 403 | L1-list, L1b, L1-slow, L7f, L2, L5, L5c, L5b-cache, L4a, L4b, L4d, LM2, LM3, LM4, LM5, LM6, LM8c, LM9, LN, L3b, L3c, LWa |
| M12 | detection unguarded — a throwing GM_info getter escapes | L1c |
| M13 | a rejected fetch counts as "threw" (fallback-eligible) | L6b, LWh |
| M14 | no gmxhr watchdog | LWa |
| M15 | no fetch timeout timer | LWb, LWb-cap, LWc |
| M16 | no try/catch around the walk prefix | L8 |
| M17 | onerror detail not logged | L6-log |
| M18 | no single-fire latch on finish() | **none — not gated:** insurance — every path calls `finish` once by construction; the latch makes that a guarantee |
| M19 | a throw from a callback is swallowed, not rethrown | **none — not gated:** diagnostic only — rethrows a callback's exception on a fresh stack so it shows as a page error; no callback throws any more (`ciRankOrgs` was made total) |
| M20 | 404 is a verdict again, not a refusal | LM1 |
| M21 | fetch sends from any page origin | **none — not gated:** unreachable while `ciIsClaudeChat` holds — the index never runs on another origin; kept as defense in depth |
| M22 | the index runs on any page detected as Claude | LO, LH |
| M22b | index guard checks hostname only (any port passes) | LO |
| M23 | no cap on timed-out fetches (the open bound stays) | LWb-cap |
| M24 | v12.8 ranking — object `capabilities` throws in the callback | LR |
| M25 | single-transport reasons no longer name the transport | LM3, LM9 |
| M26 | a late answer no longer frees its stalled slot | LWc |
| M27 | only FETCH winners are cached | L5b-cache |
| M28 | round 2's rule: any refusal on the second walk lets the re-poll loop through | LM6 |
| M30 | gmxhr's own timeout classed as "could not run" (fallback-eligible) | LM7, LWi |
| M31 | stall cap of ONE — a lone hang blocks every later fetch | LWc, LWd, LWe |
| M32 | stall cap of THREE | LWb-cap |
| M33 | winner cached before its body is validated (round 5's position) | L1v |
| M34 | fetch drops the query string | L1-shape |
| M35 | no bound on OPEN fetches (only timed-out ones counted) | LWf |
| M36 | an open fetch never frees its slot when it ends | LWe, LWg, LWh |
| M37 | open bound of FIVE | LWf |
| M38 | detection ignores GM.info (reads GM_info only) | L5c |
| M39 | unparseable JSON classed as "could not run" (fallback-eligible) | LM9 |
| M40 | an unusable org list is no verdict — first org-list path | LM8b |
| M41 | an unusable org list is no verdict — all-orgs path | LM8 |
| M42 | an unusable org list drops the cheap candidates' 403 (round 8's change, reverted by the owner) | LM8c |
| M43 | a missing GM_xmlhttpRequest read as "no answer" (no fallback) | L4d |
| M44 | a late answer's body is left streaming (not cancelled) | LWc |
| M45 | a rejected fetch never frees its open slot | LWh |
| M46 | gmxhr watchdog AT the manager's 45s timeout, not past it | LWi |

## Totals

| | Found | Verified | Fixed | False positive / refuted | Recorded, not fixed |
|---|---|---|---|---|---|
| Tier 1 | 1 NOTE | 1 | 0 | 0 | 1 NOTE |
| Tier 2 | 29 (six-lens) + 4 NOTEs (session trace) | 26 | 22 | 7 | 4 NOTEs |
| Tier 3 | 23 WARN + 1 NOTE over 10 rounds | 22 | 22 | 2 | 0 |
| **all** | **58** | **49** | **44** | **9** | **5 NOTEs** |

**PIPELINE APPROVED — 3 tiers passed, 44 issues found and fixed** (the owner later reverted one of those fixes, round 8's reason change). Tier 3 reached APPROVED on its tenth
and last permitted round, run as the full review and the post-fix validation together.

### Other measurements
- Full suite (`tests/test-all-platforms.js`, `ACN_SCRIPT` = `74c8811`'s userscript, the build before the owner's #5 revert; after the revert the full suite ran only in CI): chromium **560/560**, firefox **560/560** (macOS arm64, `ACN_SCRIPT` = the final build). webkit **556/560 on BOTH v12.9 and v12.8** — the same four jump-acceptance entries (`got null` at ~1.46s with healthy `raf10` ≈ 150ms), identical in an A/B under the same load and again when run alone — so not this change. **Corrected after the PR opened:** this line first called it TESTING.md's webkit-on-macos signature and named CI's webkit jobs the reference. Neither holds: that signature pins jumps at the 4.3–5.4s give-up ceiling on a degraded CI runner, while these give up at ~1.46s with healthy `raf10` on every run, and every printed failure targets one of the last ~10 questions of its conversation. CI's mac WebKit (build 2370) passed 560/560 on the same commit; this machine's is build 2248. Cause unknown — TROUBLESHOOTING, "OPEN — Local mac WebKit".
- On the round-7 snapshot (the tokenizer, subsegment and usage paths are unchanged since): `check-tokenizer`
  and `check-subsegments` pass. `check-usage-state` passes on chromium (CI's engine for it)
  on both builds, 2 of 2 each. On **firefox** its U10 times out intermittently on **both** builds: v12.8 3 of
  3 runs, v12.9 3 of 5 (macOS arm64, up to five probes in parallel). The flake predates this change and is
  left for a separate one.

## After the PR opened (2026-10-22)

- **GitHub Codex reviewed `ae3ada1` twice and found nothing both times:** the automatic review on PR open, and
  a manual `@codex review`. The summary comment read `has_any_findings: false`, the receipt said "Didn't find
  any major issues", and there were no inline comments.
- **CI, run 39847332312.** In attempt 1, 8 of 9 jobs were green, and `firefox on ubuntu-latest` was cancelled at
  the 20-minute cap inside the browser install (apt at ~35–55 KB/s), before any test. In attempt 2, all nine
  re-ran and all nine were green. TROUBLESHOOTING has the entry.
- **Correction:** the webkit line under "Other measurements" above, first written as TESTING.md's runner
  signature.
- **Rule 9 (spec 2.1 says "confirm that in review"):** this record had not said so. Confirmed against HEAD:
  `ciFetchGet` calls `fetch` and assigns no page global, so `exportFunction` does not apply.
- **`9ee5222`** (the owner's decisions): CI run 39875539777 went 9/9, and Codex found nothing.
- **`9ed5182`** (CLAUDE.md, owner-approved): Codex found nothing. CI run 39877202022 lost `firefox on
  windows-latest` to the `page.goto` harness flake (TESTING.md); one re-run went 9/9.
- **Merged 2026-10-23 as `4c72ca9`, on the owner's call, before the live acceptance** (a DEC-031 waiver). The
  post-merge `main` run 39878964613 lost `webkit on ubuntu-latest` to an install stall; one re-run went 9/9.

## Scope against the spec (2026-10-22, owner's request)

Four readers, each blind to the author's own classification, classified every change against the owner's spec,
read-only. They covered the userscript against the spec, the userscript against v12.8, the probe and CI, and
the docs. The author's own read agreed on every item below except two placements: the fetch bounds, which the author
had as needed by the fix (the readers split between needed and extra), and the fallback for a missing
`GM_xmlhttpRequest`, which the author had under the spec's "a transport that is unusable in a given runtime
cannot break the index" (the tests reader called it extra). The readers also split among themselves on the
unusable-org-list reason (pre-existing or extra), the `finish` latch (extra or pre-existing) and the callback
rethrow (needed or extra).

- **The fix the spec asked for:**
  - `ciApiGet` over `gmxhr` (v12.8's request, byte for byte) and `fetch`;
  - ordering by `GM_info.scriptHandler`;
  - the refusal / could-not-run trigger;
  - the winner cache;
  - PERMANENT only after both transports have failed;
  - per-request diagnostic lines and transport-tagged reasons;
  - the version bump, the CLAUDE.md reasoning-flow example, and Chrome's 403 as an open item;
  - probe checks L1–L5.
- **Problems that already existed in v12.8, fixed on the way** (each would be valid as its own PR against v12.8):
  - the exact-origin guard in `ciIsClaudeChat`;
  - `ciRankOrgs` on a non-array `capabilities`;
  - the malformed-cookie wedge (the walk's try/catch);
  - the gmxhr never-called-back watchdog;
  - the unusable-org-list reason, which **changed Firefox/Chrome behaviour**: cheap 403s followed by a 200 org
    list with no usable org were PERMANENT in v12.8 and retried every ~16s in v12.9 (**reverted** on the
    owner's decision, 2026-10-22);
  - three comments.
- **Added without being asked:**
  - the page-wide fetch bounds and the body cancel (the readers split between "needed" and "extra"; the 45s
    fetch timer itself is needed);
  - the fetch origin refusal, which is unreachable;
  - the `index order`, `index fallback` and `error=` log text;
  - the `finish` latch and the callback rethrow;
  - skipping the fallback for a conversation already left;
  - the CI probe step;
  - most of the docs: DEC-045, four copies of the verification record and mutation matrix (consolidated into
    this record on 2026-10-22), the TROUBLESHOOTING
    entry, the TESTING and architecture notes, the CLAUDE.md Layer 3 definition rewritten in place, and ROADMAP
    findings about other features (the usage panel, persistence, `scriptHandler`, the usage-path cookie throw).
  - The README privacy section is mixed. Disclosing the fetch path is needed. Correcting v12.8's false "no
    network requests" claim is pre-existing.
- **Where the code departs from the spec's wording.** The owner kept all of these as they are (decision below):
  - 404 counts as a refusal;
  - a rejected fetch is a network error, so on Safari it does not fall back to gmxhr;
  - a 429 or malformed body from the first transport goes PERMANENT without asking the second (the code
    follows 2.2's "only when" over 2.3);
  - the `[transport]` tag also reaches the degraded banner and Markdown exports;
  - the "unexpected response shape" and "malformed message data" reasons carry no tag (a 2.4 gap);
  - fixture 3 asserts the 60s first step, not the ×4 escalation (L3-backoff checks the 16s point only).
- **Coupling, if anything is split:**
  - the extra log lines are observation points for probe checks (L1-slow, L5c, L5b-cache, L1v, LO, LH, L4b, L4d);
  - the pre-existing fixes are written against v12.9's structure (`walk()`, the `threw` kind, the settle latch)
    and would need rebasing onto v12.8;
  - the unusable-org-list count is tied to the both-failed rule;
  - the probe's 63/52/46 counts were repeated in five docs; since 2026-10-22 they are kept only in this record.

**Owner's decision (2026-10-22):** keep everything except the unusable-org-list reason, which is reverted. v12.8's
PERMANENT backoff for that case is restored, and probe LM8c holds it.
