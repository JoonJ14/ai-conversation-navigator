# Review — PR #72, i18n documentation reframing (2026-08-03)

**Branch:** `docs/i18n-preference-not-defect` → merged `fac7d50`
**Base:** `main` at `980aa68` | **Diff:** docs only, no code touched
**Backend:** GitHub Codex (PR review bot). No local tier pipeline — the change is
documentation, and Tiers 1–2 check code structure and logic.
**Final CI:** 9/9 green (3 OS × 3 engines), including `webkit on macos-latest`.

---

## What the PR set out to do

The owner reviewed Korean mode live and stated a standing position, not a one-off call about
`/Commands`:

> "some things are actually better to stay in english than force translation to korean when they
> can understand some english… i am fine with how the korean mode looks."

ROADMAP 0c was written as five defects awaiting a fix. That framing would have pushed a future
session to mass-translate toward a zero dead-key count — the opposite of what is wanted.

## Rounds

| Round | Commit reviewed | Findings | Provenance |
|---|---|---|---|
| 1 | `6542e07` | 2 (P2) | Both introduced by this PR |
| 2 | `e2d86bd` | 2 (P2) | Both traced to `fc10443`, this PR's first commit |
| 3 | `4821793` | 3 (2×P2, 1×P3) | All three this PR's |
| 4 | `b7e38f1` | 3 (2×P2, 1×P3) | All three this PR's |

**Ten findings. All ten were errors this PR introduced; none existed on `main`.**

## The finding that decided it

Round 4, `docs/SETTINGS.md`: the tooltip audit claimed "9 hardcoded vs **5** wired". Only **2**
are real DOM tooltips (`navBtn.title`, `dlBtn.title`). The other three are `TOOLS_EXPORT`
data-object `title:` fields rendered as visible labels via `textContent`.

This is the identical population error caught one round earlier with the `PLATFORMS` registry —
committed again *inside the sentence that documented it*. A commit message explaining a
population error, containing the same population error.

## The split that matters

| Claim type | Result across 10 findings |
|---|---|
| Qualitative — the reframing, the two behaviour gaps, the contradictory failure contracts | **All survived** four adversarial rounds untouched |
| Quantified — "13 of 14", "21 of 31", "9 vs 5", "~5 sites", "everything else" | **All failed**, most twice |

Resolution: the counts were **removed**, not corrected a fifth time. Documentation now names
members instead of tallying them. See **DEC-043**.

## Real defects the audit exposed (pre-existing, not this PR's)

1. **`usageUnavailable` — open bug.** A failed usage fetch leaves the panel reading "Plan usage
   loading…" indefinitely, in both languages (`:4962`, `:5030`). **Not fixed** — it is a code
   change on a network path, so it needs a version bump and a DEC-031 live confirm. The remedy
   is also an owner decision: `docs/PLAN-USAGE.md` specifies rendering nothing on failure, while
   the existence of the string implies a message was intended. Both options are written out in
   ROADMAP 0c; the bug holds under either.
2. **`summaryLanguageNote`** — empty English value, Korean-only disclaimer, zero call sites, and
   v12.7 made its text substantially untrue. Needs an owner decision, not wiring.
3. **`docs/PLAN-USAGE.md` contradicted the shipped code** — its "Fetch fails" section and its
   "handled silently (no broken UI)" acceptance checkbox both describe behaviour the code does
   not have.
4. **README over-promised twice** — first "all labels update live", then "everything else applies
   after a page refresh". Unwired strings never change on any refresh.

## Process notes

- **A poller reported TIMEOUT while the work had already completed.** The cutoff was set *after*
  Codex had replied, so it polled for something already posted. Checking the artifact directly
  (the PR comments) rather than the wrapper's verdict surfaced it. Same shape as the `exit 0`
  and `codex exec` cases in `CLAUDE.md`.
- **The stopping rule needs to be pre-committed.** By round 2 the provenance condition in DEC-029
  was already met and the loop ran twice more, because "is this converging?" was judged *after*
  each round against evidence that always admitted an optimistic reading. Writing the criterion
  down first made round 4 unarguable. See DEC-043.
- **A git-config side effect, fixed:** the repo had accumulated per-branch `remote.origin.fetch`
  refspecs pointing at merged-and-deleted branches, so `git pull` failed outright. Restored to
  the standard `+refs/heads/*:refs/remotes/origin/*`.
