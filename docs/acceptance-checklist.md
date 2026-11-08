# Owner acceptance checklist (one consolidated pass)

**The owner's decision, 2026-11-05 (DEC-062):** owner acceptance is deferred to **one consolidated pass at about
v12.20**, covering every feature on every site and browser at once, on the build current then. Until that pass:

- **This file is the one checklist.** It is seeded from the acceptance steps of PRs #88 (v12.15), #90 (v12.16), #92
  (v12.17) and #93 (v12.18). **Every future PR appends its own steps** in a new section at the end (template below),
  as well as posting them as the PR's first comment. The final pass then works from this list alone.
- **DEC-031 keeps recording waivers** (a merge before acceptance), as it does now. "Acceptance owed" per version is
  expected until the pass, not an open problem to raise every session.
- **Results go in DEC-031 only**, exactly as the owner reports them, per browser and per step. A box left blank is
  "not reported", nothing more.
- **After each merge, the agent reminds the owner of the optional 5-minute Safari smoke check** (below). Safari +
  Userscripts is the one runtime the agent cannot drive.

Each step names the version that introduced it. Where a later version changed what the step should show, a
**Since …** note says so. Steps written for an older build describe that build's expected text; if the current build
words a line differently, judge the behaviour, and note the wording.

---

## Before the pass, once per browser

Run on **Safari + Userscripts**, **Chrome + Tampermonkey** and **Firefox + Tampermonkey** (equal priority, DEC-047).

- Install the current build. Confirm the navigator reports the expected version before anything else (DEC-027): the
  Settings panel's About, or `document.querySelector('[data-acn-version]').getAttribute('data-acn-version')`.
- Use a visible window (a hidden tab throttles timers and the virtualizers).
- Test bookmarks and exports are fine; delete the test ones afterwards. Never "Remove all" (it would delete your own).
- Downloads need a real click; if a browser asks to "allow multiple downloads", allow it for the site.

**Chats** (named by id prefix; the PRs' own comments give their titles):

| Site | Chat | Used by |
|---|---|---|
| Claude | `65dfa4f2` — the 147-question project chat (7 images) | v12.15, v12.17 |
| Claude | `3d7b6dc1` — the long chat, 140 questions on its active path | v12.16 |
| Claude | `ccf551fb` — the summarized chat (90 questions, Opus 4.7, 3 summaries) | v12.18 |
| Claude | a new throwaway chat (delete it afterwards) | v12.15 (optional), v12.18 |
| ChatGPT | the 24-question chat inside a project (address `/g/…/c/<id>`) | v12.15 |
| ChatGPT | `69a0c6f8` — 49 questions, in a project (Q15 has 3 images; Q45's answer is a "fallback" turn) | v12.17, v12.18 |
| ChatGPT | any chat with 10 or more questions | v12.15 |
| Perplexity | `de5dd7ce` — the 12-question thread (Q11 and Q12 have 6 image attachments) | v12.15, v12.17, v12.18 |
| Gemini | `96b519c1…` — 32 questions (loads 10 at a time from the top) | v12.16, v12.17, v12.18, v12.19 |
| Gemini | any chat under 10 questions | v12.16 |

---

## Safari smoke check (optional, about 5 minutes, after each merge)

On Safari + Userscripts, with the merged build installed:
1. **The question list loads:** open a long Claude chat and Navigate lists all its questions (not just the 1–5 on
   screen).
2. **A bookmark survives a reload:** bookmark one question, reload, and the bookmark is still in the panel; then
   delete it.
3. **The meter shows:** Navigate's context meter shows a percentage or an estimate, with its line under the bar.

Record a run in DEC-031 as "Safari smoke check" under the merged version, exactly as reported.

---

## v12.15 (PR #88): one-click jumps on Perplexity and ChatGPT; bookmarks by message id; Claude rows by `data-turn-key`

### ChatGPT
1. **Labels are distinct and right.** Bookmark three questions: one near the bottom, one you reach only after
   scrolling up a long way, and one in between. Each card reads **Q#n**, where n is Navigate's number for that
   question, and no two cards share a number.
   Safari [ ]  Chrome [ ]  Firefox [ ]
2. **Every answer has a flag.** Scroll from the bottom to the top, hovering each answer: every answer shows exactly
   one flag, including answers that appeared only after scrolling. Bookmark two answers (one far up): each reads
   **Answer to Q#n**, with n the question right above it.
   Safari [ ]  Chrome [ ]  Firefox [ ]
3. **Bookmark jumps land in one click.** From the far end of the chat, click each bookmark from steps 1–2 in the
   Bookmarks panel. Each lands on its message, in view, in **one** click, with no "not currently rendered". Note any
   that need a second click.
   Safari [ ]  Chrome [ ]  Firefox [ ]
4. **Navigate jumps land in one click.** From the bottom, click Navigate's Q1, then a question in the middle, then
   (from the top) one near the end. Each lands on the **question** (not the answer above it), in one click.
   Safari [ ]  Chrome [ ]  Firefox [ ]
5. **One set of bookmarks per chat, whichever address.** In the project chat, note a bookmark made at `/g/…/c/<id>`.
   Open the same chat at `https://chatgpt.com/c/<id>` (same id, without the `/g/…` part): the flag is lit and the
   card is in the panel.
   Safari [ ]  Chrome [ ]  Firefox [ ]
6. **Older bookmarks** (made by v12.14 or earlier on ChatGPT, if you have any): each reads **Q#n** (proven) or
   **Q#?** / **A#?**. Clicking a "#?" one says it cannot be matched; ✕ deletes it. Note how many of each.
   Safari [ ]  Chrome [ ]  Firefox [ ]

### Perplexity
7. **Labels are distinct and right.** As step 1, on `de5dd7ce`: **Q#n** equals Navigate's number, no two the same.
   Safari [ ]  Chrome [ ]  Firefox [ ]
8. **One flag per answer.** Scroll top to bottom, hovering each answer: exactly **one** flag per answer, including
   answers that appeared after scrolling. Bookmark two answers: each reads **Answer to Q#n**, and its jump lands on
   the answer.
   Safari [ ]  Chrome [ ]  Firefox [ ]
9. **Jumps land in one click.** From the top, click Navigate's Q2, then Q8; from the bottom (Q12), click Q5, then Q1.
   Each lands with that question in view in **one** click. Then the same with the bookmarks from steps 7–8. Note the
   clicks needed for any that miss; paste any `[ACN] jump: alignment cap reached …` console line. Also from the top:
   click **Q10** (the long pasted question): it lands in one click, and its question flag saves ("Bookmark added").
   Safari [ ]  Chrome [ ]  Firefox [ ]
10. **One set of bookmarks, www or not.** With a bookmark made on `https://www.perplexity.ai/search/<id>`, open
    `https://perplexity.ai/search/<id>`: the flag is lit and the card is in the panel (if the bare address redirects
    to `www.`, note that).
    Safari [ ]  Chrome [ ]  Firefox [ ]
11. **Older bookmarks** (v12.14 or earlier on Perplexity, if any): **Q#n**, or **Q#?** / **A#?**, deletable, as step 6.
    Safari [ ]  Chrome [ ]  Firefox [ ]

### Claude (regression, `65dfa4f2`)
12. **Existing bookmarks still work.** Your existing question and answer bookmarks read as before (**Q#n**, **Answer to
    Q#n**; any "#?" stays "#?"), and each jumps from the far end and lands. Navigate's count is 147.
    Safari [ ]  Chrome [ ]  Firefox [ ]
13. **No refetching while scrolling.** With the console open, scroll slowly from the bottom to the top: **no**
    `[ACN] index out of sync … refetching` line appears. Paste the one line like `[ACN] turn keys: N of N mounted rows
    carry a usable data-turn-key, N of them on the fetched path`, and any line containing `has no usable
    data-turn-key` or `not used as identity`.
    Safari [ ]  Chrome [ ]  Firefox [ ]

### Optional (unmeasured live; skipping blocks nothing)
14. **Claude, a throwaway chat:** send a message, bookmark the answer (**Answer to Q#n** within a few seconds), then
    **regenerate** it: at most one `[ACN] index out of sync … refetching` line, after the new answer finishes, ending
    `[k]` or `[p]`; the flag and a new bookmark read **Answer to Q#n**.
15. **Claude, edit a question** in that chat: note whether an `out of sync` line appears and what it ends with, and
    what a bookmark made on the edited question reads.
16. **ChatGPT, an image-generation answer:** bookmark it, wait or reload, and note its label (the code predicts
    **A#?**).

---

## v12.16 (PR #90): Claude's latest-question jump; Claude's context meter by model; Gemini's history note

17. **Claude, the latest question from the top** (`3d7b6dc1`):
    - a. Scroll to the very top, open Navigate, click the last question (Q140): it lands in one click.
    - b. Bookmark Q140 (a test bookmark), scroll to the top, click its card: it lands in one click. Delete it.
    - c. A couple of mid-conversation jumps (Q70 from the top, Q5 from the bottom) still land.
    Safari [ ]  Chrome [ ]  Firefox [ ]
18. **Claude, the context meter and the turn dots** (same chat, Navigate open):
    - a. The meter reads a sensible percentage (Chrome, v12.16: 35%, "~353.6K / 1M tokens (est.)").
    - b. `document.getElementById('acn-ctx-pct').dataset` shows `acnCtxModel` `claude-opus-5`, `acnCtxLimit`
      `1000000`, `acnCtxLimitSource` `model`; the console shows one `[ACN] context limit: model=claude-opus-5
      limit=1000000 source=model`.
    - c. The turn dots under the meter are not red while the meter is low.
    - d. Optional: a chat on an older model (e.g. Opus 4.7) reads 500K; a chat on Opus 5.5 reads 1M.
    - **Since v12.18:** a line under the bar names the model and window ("Opus 5 · 1M window"); if the chat has been
      summarized, the percentage counts from the last summary and a second line reads "Summarized N× · whole chat ~X".
    Safari [ ]  Chrome [ ]  Firefox [ ]
19. **Gemini, the history note** (`96b519c1…`):
    - a. After a reload, Navigate lists 10 and shows "↑ Older messages are not loaded yet — scroll to the top of the
      chat to load them".
    - b. Scroll to the top repeatedly until nothing more loads: the count reaches 32 and the note goes (at the last
      load, or about 8 s after the view rests at the top).
    - c. One-click jumps to Q1 and Q32 land.
    - d. A short chat (under 10 questions) shows no note.
    - **Since v12.19:** Navigate lists all 32 at once from Gemini's own history read, with no note (step 33). The note
      and the count above apply only where that read cannot run or has degraded (step 37).
    Safari [ ]  Chrome [ ]  Firefox [ ]

---

## v12.17 (PR #92): every feature reads the whole conversation; Gemini bookmarks by turn; ChatGPT's jump through history pages

Chats: Claude `65dfa4f2`, ChatGPT `69a0c6f8`, Perplexity `de5dd7ce`, Gemini `96b519c1…` (load its history first:
scroll to the top until nothing more loads). Steps 20–23 run on **each** of the four sites. **Since v12.19** Gemini needs
no loading first: Search, Export and Summary read the whole chat from its history read (steps 35–36), and the "older
messages not loaded" lines below show only where that read cannot run; the gallery keeps its own note.

20. **Search** (start at the bottom): search a word that appears only in an early question, then one only in an early
    answer. Both are found, in conversation order (Q#1, A#1, Q#2, …); each result lands in one click, with no "not
    currently rendered". Gemini, before the history is loaded: Search shows "↑ Older messages are not loaded yet".
    Claude [S / C / F]  ChatGPT [S / C / F]  Perplexity [S / C / F]  Gemini [S / C / F]
21. **Export → Full Conversation:** every question and answer, in order; its "Messages" line equals Navigate's count
    × 2. Gemini with history not loaded: the file says "Older messages were not loaded".
    Claude [S / C / F]  ChatGPT [S / C / F]  Perplexity [S / C / F]  Gemini [S / C / F]
22. **Summary → Generate:** the stats count every message (ChatGPT "98 (49 user, 49 AI)"), the map is in order, and an
    early segment clicked from the bottom lands.
    Claude [S / C / F]  ChatGPT [S / C / F]  Perplexity [S / C / F]  Gemini [S / C / F]
23. **Image gallery** (Tools):
    - Claude: 7 cards, Q#106, Q#107, Q#115, Q#136, Q#138, Q#139, Q#139, with real thumbnails; a click lands on its
      question.
    - ChatGPT: 3 cards, Q#15: a placeholder with the file name until Q15 has been on screen, then real thumbnails; a
      click lands on Q#15.
    - Perplexity: 6 cards, Q#11 and Q#12, **placeholders with file names only, by design** (no new requests or hosts,
      DEC-059); a click lands on its question.
    - Gemini: only uploaded images ("No images" here); before the history loads, the "older messages not loaded" note.
    Claude [S / C / F]  ChatGPT [S / C / F]  Perplexity [S / C / F]  Gemini [S / C / F]
24. **Gemini only, bookmarks:**
    - Reload (only the newest 10 turns load). Bookmark the latest question: it reads **"Q#…"**.
    - Load the whole history: it becomes **Q#32**.
    - Bookmark Q1 and its answer: **Q#1** and **"Answer to Q#1"**; from the bottom, both land.
    - Reload: all three read "Q#…" again, and Q#1's card says older messages are not loaded.
    - Old Gemini bookmarks from before 12.17 show their number (bound on proof) or "Q#?" / "A#?" (deletable).
    - Delete the test bookmarks.
    - **Since v12.19:** with the history read working, labels are final once the index is ready (the latest reads
      **Q#32** after a reload once the read has landed, and Q#1's card has no "not loaded" line). While the read is
      still loading, the latest reads **"Q#…"** as above (the read took 6.2 s on `96b519c1` in Phase 1, Chrome page
      realm), so check a few seconds after the reload. The "Q#…" behaviour above is also what a degraded or absent
      read shows (a Gem or `/u/N/` chat).
    Safari [ ]  Chrome [ ]  Firefox [ ]
25. **ChatGPT only, the jump fix:** reload `69a0c6f8`, then Navigate → Q15 and → Q1 from the bottom. Each lands in one
    click; the first may take several seconds while ChatGPT loads older turns.
    Safari [ ]  Chrome [ ]  Firefox [ ]
26. **Bookmarks on Claude and ChatGPT:** Claude: a bookmark on an early answer (e.g. Answer to Q#5), clicked from the
    top, lands with its start in view. ChatGPT: answer bookmarks keep their "Answer to Q#n" label, including on a long
    answer the page splits into two blocks.
    Safari [ ]  Chrome [ ]  Firefox [ ]

---

## v12.18 (PR #93): the context meter makes model-dependent limits clear; ChatGPT fallback bookmarks

27. **Claude, a summarized chat** (`ccf551fb`): the meter shows the context since the last summary, about **45%**,
    with **"Opus 4.7 · 500K window"** and **"Summarized 3× · whole chat ~600K"**; no "limit assumed", no alert. In
    Navigate, Q#1–Q#70 carry a **"summary"** tag, with the divider **"Summarized above · word for word below"** before
    Q#71.
    Safari [ ]  Chrome [ ]  Firefox [ ]
28. **Claude, a model change** (a fresh throwaway chat): send one message, switch the model in the picker (e.g. Opus
    5.5 → Opus 4.8), send one more. The meter shows **"Model changed: Opus 5.5 → Opus 4.8. Window 1M → 500K, so a% →
    b%."**, and ✕ dismisses it. Delete the chat afterwards.
    Safari [ ]  Chrome [ ]  Firefox [ ]
29. **ChatGPT, the plan setting** (`69a0c6f8`):
    - With the plan unset (the default): **"~61.9K tokens (est.) · window depends on your plan"**, a **"Set your
      plan"** control, and no percentage.
    - Click "Set your plan": Settings opens at **Context meter → ChatGPT plan**. Pick your real plan: a percentage and
      **"<mode> · <window> window (<plan>)"** (this chat's newest answer is Thinking: Plus reads 256K, 24%), and a
      "Plan changed" notice.
    - Change the plan again: the meter follows.
    Safari [ ]  Chrome [ ]  Firefox [ ]
30. **Gemini and Perplexity, the size estimate** (`96b519c1…`, `de5dd7ce`): **"~X tokens (est.) · window not
    published"**, no percentage; dots coloured by estimated size against 1M (a chat of short questions stays green);
    the caption names the site ("Estimated size (1M scale). Gemini may summarize older messages …"). Gemini, before
    the history is loaded: **"↑ Older messages are not loaded yet — the estimate covers the loaded part only"**.
    **Since v12.19** the estimate covers the whole Gemini chat at once, and that line shows only where the history read
    cannot run.
    Gemini [S / C / F]  Perplexity [S / C / F]
31. **ChatGPT, a fallback turn** (`69a0c6f8`): bookmark Q45's answer. It reads **"Answer to Q#45"**, and the jump to it
    from the top lands. Delete the test bookmark afterwards. (The agent's live check could not do this step: its safety
    classifier blocked creating the bookmark.)
    Safari [ ]  Chrome [ ]  Firefox [ ]
32. **CI:** done by the agent, not a browser step. PR #93's checks finished 9/9 on `4cdc730`, and `main`'s first run
    after the merge (`ab7ea21`, run 42123189982) was 9/9 green (DEC-031).

---

## v12.19 (PR #94): Gemini's full question list on open

Chat: Gemini `96b519c1…` (32 questions). Confirm `data-acn-version` reads **12.19** first. Gemini's history read uses
`fetch` on all three managers (Phase 0, DEC-063), so the "Load full history" fallback is expected only on a Gem chat or
a `/u/N/` address (another signed-in account), or if the read fails. Step 37 needs one of those; if you have none, mark
it "n/a".

33. **Gemini, the full list on open** (`96b519c1…`): reload at the bottom and open Navigate without scrolling. It lists
    **32** questions (Q#1–Q#32) within a few seconds, with **no** "↑ Older messages are not loaded yet" note and no
    "Load full history" button. (On a manager or chat that falls back instead: the note and the **"Load full history"**
    button, and Navigate lists only the loaded turns.)
    Safari [ ]  Chrome [ ]  Firefox [ ]
34. **Gemini, a jump to Q1 from the bottom:** in Navigate, click Q1. A small **"Loading earlier messages…"** status
    shows while Gemini loads its older pages (3 pages for this chat; the spec expects 10–20 s), then the view lands on
    Q1 and the status goes. A scroll of your own during the wait stops it.
    Safari [ ]  Chrome [ ]  Firefox [ ]
35. **Gemini, Search** (from the bottom, nothing loaded above): search a word that appears only in an early answer. It
    is found at once (an "A#n" result for an early n), with no scrolling.
    Safari [ ]  Chrome [ ]  Firefox [ ]
36. **Gemini, Export → Full Conversation** (from the bottom, nothing loaded above): the file holds all **32** questions
    and their **32** answers, in order, and does not say older messages were not loaded.
    Safari [ ]  Chrome [ ]  Firefox [ ]
37. **Gemini, the fallback** (a Gem chat or a `/u/N/` chat longer than 10 questions, if you have one): Navigate shows
    the note and **"Load full history"**. Scroll a little way up among the loaded questions, then click the button: it reads
    **"Loading… N of ?"** while it loads, the list reaches the chat's full count, the note and the button go, and the
    view comes back to the question you were on. During a load, a second click stops it and brings the view back; a
    scroll of your own stops it where you are.
    Safari [ ]  Chrome [ ]  Firefox [ ]

---

## Template for the next PR's section

```
## v12.NN (PR #NNN): <title>

NN. **<Site>, <what to check>** (`<chat id prefix>`): <the steps, and exactly what each should show>.
    Safari [ ]  Chrome [ ]  Firefox [ ]
```
Number the steps on from the last section's, so a result can be recorded as "step N, Safari: pass".
