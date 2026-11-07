# Testing

## Prerequisites

- Node.js 22+
- npm

## Setup

```bash
npm install
npx playwright install --with-deps
```

## Running Tests

```bash
# Run the whole suite: 26 platform entries, 560 tests as of v12.9 (2026-10-22)
npm test

# Run on specific browsers
node tests/test-all-platforms.js --browser firefox
node tests/test-all-platforms.js --browser chromium,firefox,webkit

# Generate screenshots for visual verification
npm run test:screenshots

# Shell wrapper
./tests/run-tests.sh
```

## Test Architecture

Tests use Playwright with route interception:
1. Load mock HTML from `tests/mock-pages/{platform}.html`
2. Inject the userscript (stripping the header lines 1-27)
3. Navigate to `https://{platform-hostname}/`
4. Assert against `data-acn-*` contract attributes

## Test Contract Attributes

The test suite queries only stable `data-acn-*` attributes — never internal CSS classes or IDs. Current contract:

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-acn-role="zone"` | Main container | Injection verified |
| `data-acn-role="styles"` | `<style>` element | CSS injection verified |
| `data-acn-role="nav-trigger"` | Nav dot/button | Click target |
| `data-acn-role="nav-panel"` | Nav panel | Panel open/close |
| `data-acn-role="nav-stat"` | Stats bar | Question count via `data-acn-count` |
| `data-acn-role="nav-list"` | List container | Question item container |
| `data-acn-role="nav-item"` | Question row | Individual question |
| `data-acn-role="nav-item-text"` | Text inside row | Display text |
| `data-acn-role="panel-close"` | Close button | Dismisses panel |
| `data-acn-accent="#hex"` | On zone | Platform accent color |
| `data-acn-ui="orbital"|"legacy"` | On zone | UI system type |
| `data-acn-dot="nav|search|…"` | On each orbital dot | Feature ID (orbital only) |
| `data-acn-open="true"` | On nav-panel | Panel open state |
| `data-acn-count="N"` | On nav-stat | Question count |
| `data-acn-index-status="degraded\|loading\|ready-with-notes"` | **On the index BANNER inside the nav panel** — NOT the zone (this row said "On zone" for a release; a readiness probe built on that claim was a 0ms no-op, Tier 3 v12.3). Only refreshed while the Navigate panel is the open one, so it is NOT a readiness signal when other panels are open — use the GM shim's `__convFetches` counter in tests instead | Conversation-index banner state (Claude, v12.0+) |
| `data-acn-jumping="true"` | On panel | A jump is in flight |
| `data-acn-jump-resolved="N"` | On zone | The `data-index` a completed jump actually resolved — durable, because the resolved element is detached by the re-render `scrollIntoView` triggers. Stamped by BOTH jump routes (`orbMarkJumpTarget`), so it identifies the resolution, not the route |
| `data-acn-role="sum-generate"` | Summary generate button | Click target (v12.3) |
| `data-acn-role="sum-results"` | Summary results container | Render target (v12.3) |
| `data-acn-role="sum-stats"` + `data-acn-sum-total/user/ai` | Stats section | Machine-readable whole-conversation counts (v12.3) |
| `data-acn-role="sum-segment"` + `data-acn-sum-start/end` | Conversation-map segment | Addressable by timeline span, so a fixture can click the segment covering a known-unmounted entry (v12.3) |
| `data-acn-role="sum-subsegment"` + `data-acn-sub-start/end` | Sub-segment inside a segment | The only surface showing that sub-segments were attached at all — they are built once per surviving segment (v12.5, DEC-039) |
| `data-acn-role="tool-export"` + `data-acn-export="full\|bookmarks\|summary"` | Tools export options | Click targets (v12.3) |
| `data-acn-role="toast"` | `#acn-toast` | Transient message text, e.g. the stale-summary refusal (v12.3) |

**Two rules for virtualized assertions** (both learned the hard way — see DEC-025):
assert on what the implementation *resolved* via `data-acn-jump-resolved`, never on
ambient DOM state; and look the resolved row's text up with
`__mockVirtualization.rowText(i)`, never with `querySelector('[data-index="N"]')`, because
that row is routinely recycled away before the assertion runs. Reading the DOM there made
the check pass on Linux and fail on Windows for the same correct jump.

## Modification Checklist

When modifying the userscript, ensure:
- All `data-acn-*` attributes remain intact
- Mock pages match the real platform DOM structure
- Tests pass across all 26 platform entries as of v12.9 (the 14 real platforms plus the Claude
  fixture entries — among them the virtualized degraded, index-backed, and index-backed-with-markdown
  entries whose DOM/API text deliberately does NOT match)

## CI/CD

GitHub Actions runs on push/PR to `main`:
- **cross-platform-tests.yml:** 3 OS (Ubuntu, macOS, Windows) x 3 browsers (Chromium, Firefox, WebKit) = 9 test matrix jobs
  - Every job runs `tests/test-all-platforms.js` on its engine.
  - `ubuntu + chromium` also runs `check-tokenizer` and `check-subsegments` (string behaviour) and
    `check-usage-state` (the usage panel's network states; it has an open Firefox flake, TROUBLESHOOTING).
  - Every `ubuntu` job also runs `check-transport-ladder` on its own engine (v12.9, DEC-045). It adds about
    2m20s per job.
  - Every `ubuntu` job also runs `check-index-adapters` on its own engine (v12.10, DEC-046): the ChatGPT and
    Perplexity adapters against two mocks that genuinely unmount (`chatgpt-windowed.html`,
    `perplexity-windowed.html`). Run it with `ACN_SCRIPT=<old build>` to see the new fixtures fail there.
  - Every `ubuntu` job also runs `check-turn-counter` on its own engine (v12.11): Claude's turn-counter dots
    when the index lands after Navigate opens, across a switch, and on an empty page; since v12.16 the expected
    colours come from the meter's percentage, and A6 asserts no dot is redder than the meter (DEC-056).
  - Every `ubuntu` job also runs `check-gm-storage` on its own engine (v12.12): bookmarks and settings surviving a
    reload with only the async `GM.getValue` / `GM.setValue` (Safari's Userscripts), the sync path left untouched,
    and a load that never answers; since v12.13, two tabs saving the same collection, a stored value that cannot be
    read, and the save queue (DEC-050).
  - Every `ubuntu` job also runs `check-answer-bookmarks` on its own engine (v12.14, DEC-051): Claude answer flags
    in a project chat and outside one, "Answer to Q#n" labels, jumps, existing answer bookmarks binding on proof,
    and no refetch while scrolling. `node probes/run-answer-mutants.js` (not in CI) runs 18 targeted mutants.
    22 of the 36 checks fail under some mutant. Seven more are shown to fail only by v12.13, and the guards by
    nothing (DEC-051, Gates).
  - Every `ubuntu` job also runs three v12.15 probes on its own engine: `check-ix-jumps` (one-click jumps on the
    windowed ChatGPT and Perplexity mocks, and the Perplexity question compare, DEC-052), `check-ix-bookmarks`
    (ChatGPT and Perplexity bookmarks by message id, DEC-053) and `check-claude-turnkeys` (Claude rows by
    `data-turn-key`, DEC-054). They took the ubuntu jobs to about 22 minutes, so the job cap is 30 since v12.15.
    `check-ix-jumps` J15 has a known timing race in CI (TROUBLESHOOTING, OPEN): a failure reading
    `resolved=10 toast=no inView=true err=0px` clears on one re-run. It has also failed locally, on all three
    engines by now (Chromium and Firefox in v12.18's runs).
  - Every `ubuntu` job also runs three v12.16 probes on its own engine: `check-claude-far-jump` (Claude's latest
    question from the top lands in one click, on the virtualizing mock with `tailAtEnd`, DEC-055), `check-ctx-limit`
    (the context window by the conversation's model, DEC-056) and `check-gemini-history` (Gemini's history note on
    `gemini-history.html`, DEC-057, about 45 s per engine with one real 8 s wait). They took the ubuntu jobs to
    about 24 minutes (23m28s–24m6s on PR #90's run 41257520872), against the 30-minute cap.
  - Every `ubuntu` job also runs `check-feature-gaps` on its own engine (v12.17, DEC-059): Search, Export, Summary
    and the gallery reading the whole conversation on the windowed Claude, ChatGPT and Perplexity mocks and on
    `gemini-history.html`, Gemini bookmarks by turn id, and the landings (42 checks; guards G7, G8, L3, L5, E). Its
    mutants (21) ran from a scratch runner and are listed in the commit messages, not in the repo. With it the
    ubuntu jobs took about 29–30 minutes (29m1s–29m35s on PR #92's run 41388828440), so their cap was **40 since
    v12.17** (the owner's stopgap until the CI rebuild, ROADMAP 0e); macOS and Windows keep 30.
  - Every `ubuntu` job also runs two v12.18 probes on its own engine (DEC-060, DEC-061): `check-context-meter`
    (M1–M16 Claude, C1–C10 ChatGPT, S1–S7 Gemini and Perplexity: summary awareness, the model label, notices, the
    95% alert, the plan setting, the size estimate and its dots) and `check-gpt-fallback` (F1–F8: ChatGPT answer
    records rewritten to the index's key, flags in sync, Safari's queued replay). They took about 4.3–4.6 min per
    engine in the final local run, and 4m16s–4m22s in CI (run 42095450049 on `3ccf84b`, where healthy ubuntu jobs
    took 33m18s–33m51s). Since `b48996a` the ubuntu jobs' browser install is bounded: the system packages get up to 3
    attempts of 4 minutes (the apt mirror stalled for 10–25 minutes three times; ROADMAP 0e). Its first measured
    switch: azure got about 3 MB in 4 minutes, then archive.ubuntu.com served 111 MB in 36 s (run 42117334465). The ubuntu cap is **50 since v12.18** (the owner's
    second stopgap: an apt-mirror stall took `webkit on ubuntu-latest` past 40 on the `8909d92` merge run; ROADMAP 0e).
  - Every `ubuntu` job also runs `check-gemini-index` on its own engine (v12.19, DEC-063): Gemini's full question
    list from its own history read (`hNvQHb`) on `gemini-history.html` with the mock's opt-in `rpc` server, answered
    through a route bridge in Phase 1's framing: the request's shape, the failure classes, the self-check, the
    refresh, jumps that page the DOM in, and the "Load full history" fallback. 72 checks (62 `[new]`, 10 `[guard]`);
    `--slow` adds I6s (the 5-strike cap, 330 s), not run in CI. `--proof` with `ACN_SCRIPT` at v12.18
    (`git show ab7ea21:ai-conversation-navigator.user.js`) exits 0 iff every `[new]` fails there, every `[guard]`
    passes and nothing is INVALID. It took about 567 s on chromium for the finished build (this Mac, 2026-11-07);
    Firefox and WebKit, and its time in CI, are not measured yet. With it the ubuntu jobs' headroom under the
    50-minute cap is about 7 minutes by the v12.18 figures (33m18s–33m51s + ~9.5); raising the cap is the owner's call.
    `check-gemini-history` and `check-feature-gaps` gate the FALLBACK since v12.19: `--gm-endpoint refuse|abort|none`
    (default `refuse`, the one CI runs) plants the page's token in the mock so the index really sends its read, then
    answers it with a 403 (`refuse`), a network failure (`abort`), or leaves the page as v12.18's (`none`, no token).
    Their checks are unchanged in every mode, plus H0/G0 [guard] (no retry loop, by failure class) and HP/GP [guard]
    (no paging status). Run `abort` and `none` once each in the final three-engine run.
  - **Why only the ubuntu jobs take ~34 minutes** (v12.18's figures; v12.19 adds `check-gemini-index`): the probe steps run on ubuntu only, one after another (about 27
    minutes), after the same ~5¾-minute suite every job runs; macOS and Windows run the suite alone (6–10 minutes).
    Measured on run 42118079878: every job started 2–3 s after it was created, and the ubuntu steps ran with 0 s
    between them, so the time is work, not queueing. Splitting the probes into parallel jobs is the rebuild's option
    (ROADMAP 0e).

**Windows is the runner that catches timing assumptions.** It is materially slower than
the Ubuntu and macOS runners, so an assertion that races the virtualizer passes on two OSes
and fails on the third. Treat a Windows-only failure as a real finding about the assertion,
not as runner flakiness. The one documented exception is the harness's `page.goto … interrupted by another
navigation` cascade on `firefox on windows-latest`: usually three Claude entries in a row (16, through Codex Web,
on 2026-11-02), no userscript assertion among them, seen 2026-08-02, 2026-10-23 and 2026-11-02 (TESTING.md). A
single re-run clears it; GitHub allows `gh run rerun --failed` only once the whole run has completed. Do not add `--single-process` to the Chromium launcher — it removes
crash isolation and reports one renderer fault as every-platform-after-it failing (DEC-026).

**webkit-on-macos is the one exception with a known environment signature.** A job running
40+ minutes (healthy: 6–10) with `got null` acceptance jumps pinned at ~4.3–5.4s each while
sibling entries stay exact at ~300ms is a degraded macOS runner episode, not code — verified
2026-07-30 on identical commits green minutes apart. Check `vis=`/`raf10=` on the failure
lines (~160ms rAF sample = healthy; seconds = throttled; -1 = stopped) and the per-entry
wall clocks, then re-run the job once. Full signature and procedure:
`TESTING.md` → "CI: reading a webkit-on-macos failure or hang". The job `timeout-minutes` (30 since v12.15;
40 on ubuntu since v12.17, 50 since v12.18) exists for this; do not raise assertion budgets to make a sick runner green.

**A local mac WebKit failure is NOT that signature** (found 2026-10-22). On the owner's Mac, four acceptance
entries fail on every run, on v12.8 and v12.9 alike. They give up at ~1.46s with healthy `raf10`, on jumps
near the end of a conversation; CI's mac WebKit, a newer build, passes them. It was misfiled as the runner signature once. Match on timing,
frequency and host, not on `got null`: TROUBLESHOOTING, "OPEN — Local mac WebKit".
- **claude.yml:** Claude Code integration for automated issue/PR responses
- **claude-code-review.yml:** Automated code review

## Related Documentation

For deeper testing and debugging context, see these root-level files:

- **`TESTING.md`** — Comprehensive testing guide with additional detail beyond this summary
- **`TROUBLESHOOTING.md`** — Platform-specific diagnostics, known issues, and debugging steps
- **`DOM-REFERENCE.md`** — Real DOM structures for all 14 platforms; essential when fixing broken selectors or updating mock pages
