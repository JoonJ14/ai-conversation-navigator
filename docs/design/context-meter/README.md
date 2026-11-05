# Context meter: design options and decision

Mockups from the owner's design review, 2026-11-04. All seven options are drawn in `context-meter-options.html` in this folder, a self-contained page you can open in any browser.

Every option shows the same three moments:

1. A 353.6K-token chat on Opus 5 (1M).
2. The same chat after switching to Opus 4.8 (500K).
3. A 612K chat switched to Opus 4.8, which no longer fits its window.

## Decision (owner, 2026-11-04)

**Baseline, applied to every display we ever ship:**

- **The change notice** (from option A). When the conversation's model changes, a dismissible notice explains it, for example "Model changed: Opus 5 → Opus 4.8. Window 1M → 500K, so 35% → 71%". When the chat no longer fits the new window, the notice says Claude will summarize earlier messages.
- **Compaction awareness** (option G). On Claude, the context is counted from the last summary, the meter says "summarized N×", and a notice appears when a new summary happens. In Navigate, questions before the last summary carry a "summary" tag, with a divider at the summary point.

**The display to implement next:**

- **A, the percentage and label:** a percentage bar, with the model and window named under it ("Opus 4.8 · 500K window").

**Candidates for a later version:**

- **C, the window ruler.** The bar is a ruler marked 0 · 200K · 500K · 1M, and the model's limit is a moving "wall". On a switch, the fill stays and the wall moves; the change notice fires at the same moment.
- **D, three tiers.** One row each for 1M, 500K and 200K models, showing this chat's share on each, with the active row marked.

**Kept as ideas (not planned):**

- **B, ghost trail.** A dashed outline of the previous percentage after a switch.
- **E, pre-send preview.** A warning read from the model picker before sending. It depends on claude.ai's picker markup, so it could only ever be a hint.
- **F, headroom first.** "Tokens left" as the main number.

Any future display keeps the baseline. For example, the window ruler would move its wall on a switch, and the change notice would explain it.

## Measured facts behind the design (2026-11-04)

These were measured live in Chrome + Tampermonkey (build 12.17), on the owner's profile, read-only except one throwaway chat.

- **Model switches on claude.ai:**
  - claude.ai stores one model per conversation, never per message.
  - Switching in the picker saves nothing until the next message is sent; a reload before sending reverts it.
  - The navigator already picks up a saved switch on the refetch the new message triggers, but until now silently (3% → 6% with no explanation).
- **Compaction on claude.ai:**
  - The conversation JSON the navigator already downloads marks each summary: `compaction_summary` on the assistant message where it happened. The owner's account had 87 of them across 39 of 236 chats, including every chat whose estimate exceeds its window.
  - No token count is reported after a summary. The context since the last summary can be estimated from the summary plus everything after it.
  - The trigger size has varied over time (a median of about 76K in February 2026, about 330K on 1M models in October), so "distance to the next summary" can't be predicted honestly.
  - Details: DOM-REFERENCE, Claude, "Compaction".
- **Other sites:**
  - No summary marker was found on ChatGPT, Gemini or Perplexity; Grok was checked signed out only.
  - ChatGPT records the model of each answer (`metadata.model_slug`), but OpenAI publishes context windows by plan and mode, not by model, and the plan isn't in the conversation data.
  - Details: DOM-REFERENCE, each platform's "Context and summaries" section, and ROADMAP 12.

## Open, for the implementation spec

- How the meter behaves on sites without a summary marker. The proposal: a ChatGPT plan setting so the percentage can be real; on Gemini and Perplexity, the token estimate with a caveat and no percentage; everywhere, a "likely past the window" alert. Not yet decided by the owner.
- The live "Compacting…" stream event (`compaction_status`) is visible only on Chrome, and its wire format is unmeasured.
