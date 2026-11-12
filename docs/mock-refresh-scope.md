# Mock refresh — scope (read-only), 2026-11-11

The CI rebuild's third step (ROADMAP 0e; the owner, 2026-11-07: "then refresh the mocks"; 2026-11-11: "scoping
only: a read-only report per mock page … ranked by risk. Live reads need my OK, with a count; I'll choose").
Nothing here was measured live; every date is the last live measurement the repo records. Sources: each mock's own
header, `DOM-REFERENCE.md` (its "Virtualization status" table and per-platform sections), `TESTING.md` →
"Limitations and Caveats", `HANDOFF.md` §G.1, `git log` on each file, and `grep` for every suite entry and probe that
loads it (all read 2026-11-11).

**Why a stale mock matters here:** a mock is a static model of a site that changes (TESTING.md). A suite that
models last month's site stays green while the live site breaks (Layer 1), and a mock that models behaviour never
seen live can pass a gate the live site would fail. CI is mock evidence only; a refresh does not change that.

## Ranked by risk

Risk weighs: how much a shipped feature rests on the mock's fidelity (the four index adapters most); how old the last
live measurement is; behaviour the mock models but no one has seen live; and how many gates load it.

| # | Mock | Models | Last live measurement | Known drift / unmeasured | Gates that load it | Risk |
|---|---|---|---|---|---|---|
| 1 | `gemini-history.html` | Gemini's paging DOM (10 turns a page, the ~4.6 s render block) and, opt-in, the `hNvQHb` history read (route bridge) | 2026-10-31 (paging), 2026-11-05 (the read, Phase 1, one 32-turn chat) | Answers a size-100 read in 400 ms where live took 6.2 s (~15x); models live behaviour never seen: `rpc.drafts`, `rpc.firstNewest`, `noQuestion` (an image-only prompt), `endlessDom`; synthetic payloads far smaller than live's 13.5M characters; Gem and `/u/N/` paths unmeasured | `check-gemini-index` (81), `check-gemini-history` (14), `check-feature-gaps`, `check-context-meter` | **High** — the newest feature (v12.19), merged before acceptance; the most modelled-but-unmeasured behaviour of any mock |
| 2 | `chatgpt-windowed.html` | The Oct 2026 app shell, the 4–7-turn sliding window, `data-turn-key`, history paging, the two-node "fallback" turn, models and summaries | 2026-10-23 (structure); 11-01 (paging, answers); 11-04/05 (models, a fallback turn re-measured) | The fallback turn was seen live with ONE wrapper on 2026-11-05 (`69a0c6f8`, n=1) and with TWO on 11-01; `check-gpt-fallback` gates the two-wrapper variant, not seen since 11-01 (DOM-REFERENCE, ChatGPT, "a fallback turn re-measured"); the structure is 19 days old on a site that changed its shell in October | `check-index-adapters`, `check-ix-jumps`, `check-ix-bookmarks`, `check-feature-gaps`, `check-context-meter`, `check-gpt-fallback` | **High** |
| 3 | `claude-virtualized.html` | Claude's recycling virtualizer (3–7 of N rows), the Oct 2026 answer markup (`answerTestid`, `answerHeaders`), the project link (`decoy`), `tailAtEnd` | 2026-10-23/24 (markup); July 2026 (virtualizer metadata) | Does not recycle nodes (R6 moves them by hand); the pinned tail's geometry is modelled (`tailAtEnd`, v12.16); compaction (measured 11-04) is in the data, not this DOM | 12 suite entries and 12 probes (the widest blast radius of any mock) | **High** (impact) |
| 4 | `perplexity-windowed.html` | Oct 2026 entries (question/answer slots), the entries-in-view window, the stick-to-bottom pin, markdown bubbles, attachments | 2026-10-23/24/25; 11-01 (answers, attachments) | The pin is a model (J15's `pinEvery` since this PR, `pinMs` elsewhere); `qLag`, `drift`, `estimate` reserves are from single measurements | `check-index-adapters`, `check-ix-jumps`, `check-ix-bookmarks`, `check-feature-gaps`, `check-context-meter` | **Medium-high** |
| 5 | `claude.html` | The basic "Claude" suite entry (DOM path, `/chat/test`) | **February 2026** (the file's last commit is 2026-02-16) | **Models a structure Claude no longer has:** it uses `data-testid="user-human-turn"` and `user_message`, both measured at **0** live on 2026-07-26 (DOM-REFERENCE, "v12.0 selector drift"). The entry passes because the userscript keeps those selectors as fallbacks; the live markup is covered only by `claude-virtualized.html` | 1 suite entry | **Medium-high** — a green check on a superseded DOM |
| 6 | `grok.html` | Grok's chat DOM | February 2026 (checked signed out 2026-02-18; a signed-out code search 2026-11-04, partly conclusive) | Unknown; 9 months; virtualization "not observed" (not verified absent) | 1 suite entry | **High, but the Grok PR's** (ROADMAP "Next" item 5 redoes the search signed in) |
| 7 | `gemini.html` | The basic "Gemini" suite entry | 2026-07-30 | The Oct 31 paging measurement and the v12.19 index are in `gemini-history.html`, not here | 1 suite entry | Medium |
| 8 | `emergent.html` | Emergent (Virtuoso recycling; accumulation only) | February 2026 | 9 months; a virtualizing site | 1 suite entry | Medium-low |
| 9 | `chatgpt.html`, `perplexity.html` | The basic suite entries | 2026-10-23 | Measured with the windowed mocks | 1 suite entry each | Low-medium |
| 10 | `claude-code.html`, `codex.html` | Claude Code Web, Codex Web | February 2026 | 9 months; "not observed" virtualization | 1 suite entry each | Low-medium |
| 11 | `lovable.html`, `replit.html`, `bolt.html`, `v0.html`, `base44.html`, `firebase.html` | The six builders (Firebase in an iframe) | February 2026 | 9 months; Replit's Emotion classes change per deployment (the mock freezes `data-testid`) | 1 suite entry each | Low |

## What a refresh would read live (for the owner's OK; counts are estimates)

Every read below is in the owner's accounts and needs the owner's OK first. A GET page load and reading the DOM sends
nothing; a POST, a read RPC included, counts as sending (the owner's rule).

| Mock | Live reads | Requests the navigator would send |
|---|---|---|
| `gemini-history.html` | 1–2 long chats opened and scrolled to the top (Gemini's own paging); the timing of one size-100 read; an image-only prompt's DOM if a chat has one | **2 POSTs** of `hNvQHb` (a read RPC, so "sending"; v12.19's spec allowance does not carry over: a new OK) |
| `chatgpt-windowed.html` | 1 long chat (the window, paging), 1 chat with a fallback turn if one exists | 2 GETs of `backend-api/conversation/<id>` |
| `claude-virtualized.html` (+ `claude.html` from the same visit) | 1 long chat, 1 project chat | 2 GETs of the conversation JSON |
| `perplexity-windowed.html` (+ `perplexity.html`) | 1 long thread, 1 with a markdown question | 1–2 GETs of the thread JSON |
| `gemini.html`, `chatgpt.html` | the same visits as above | none extra |
| The Feb 2026 mocks (#8, #10, #11) | 1 chat each where the owner has an account | none (DOM only) |

## The owner's decision (2026-11-11)

"No other mock refresh for now: the live verification layer (the next spec) is what will catch site drift." `claude.html` (#5) is logged in ROADMAP ("Next" item 4): retire or replace its suite entry in a later PR. The recommendation below is kept as written.

## Recommendation (the agent's, for the owner's decision)

Refresh #1–#5 in one pass, in that order, from the visits above (about 7 page visits, 2 POSTs, about 6 GETs), with
each mock's numbers taken from the measurement (CLAUDE.md: a mock's model takes its numbers from live measurements).
Leave #6 to the Grok PR. #7–#11 can follow the same pass at one page visit each, or wait for a reported break. Each
refreshed mock keeps its gates' counts, or explains every change; a gate whose premise changes is reported, never
loosened.
