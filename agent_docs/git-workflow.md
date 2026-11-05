# Git Workflow

## Branch Protection

- `main` is protected — **never push directly to main**
- All changes must go through pull requests
- CI must pass before merging. `main`'s ruleset requires all nine checks and has **no bypass actors**, so
  `gh pr merge --admin` fails ("Repository rule violations found"). A job that a runner problem cancelled (the
  ubuntu install stall, TROUBLESHOOTING) is re-run with `gh run rerun <id> --failed`; it cannot be skipped

## Feature Branches

- Always create feature branches for changes
- Use descriptive branch names (e.g., `add-platform-x`, `fix-arc-rendering`)
- Keep branches focused on a single concern

## Pull Requests

**The owner's procedure for a code PR** (2026-11-01, v12.17; one PR holds the code and its docs, no docs-only PR):
1. The review pipeline: Tiers 1–2, then Tier 3 (`cli:codex`) **capped at 5 rounds**. The owner briefly allowed 10 and
   withdrew it: GitHub Codex is more accurate (it can call the code), saves tokens, and keeps the open findings on
   GitHub instead of in the agent's context. Whatever round 5 leaves goes to GitHub Codex; say in the PR that no
   local round reviewed round 5's fixes.
2. Reinstall the final build in the owner's Chrome through Tampermonkey and retest live once (TESTING.md, "Installing
   a build"), not after every fix.
3. The pre-approved final run (`npm test` and every probe on Chromium, Firefox and WebKit; about 84 minutes on this
   Mac for v12.17, not the 30–40 first estimated; 1h42m for v12.18, with 17 probes on Chromium and 14 each on Firefox
   and WebKit). Then open the PR, with the owner's acceptance steps as its first
   comment.
4. `/babysit-pr-cycle` with GitHub Codex until it reports no major issues, **plus one more `@codex review` on the clean
   head**. On v12.17 that confirming review found a new P2 four times out of five (on v12.18 it was clean). **A docs push draws an automatic
   review too**: on PR #92 two docs-only pushes each drew a real code finding, so poll after every push, docs included,
   until it is clean. A "Something went wrong" reply is
   not a review: re-trigger with `@codex review` (seven times on PR #92, each worked).
5. Reinstall the Codex-reviewed build and retest live as an A/B: the previous version by Tampermonkey's Downgrade,
   showing the old failures, then the final build. On v12.17 this found one more bug (`c88ed1c`).
6. Re-read the session's whole transcript (`.jsonl`) and the memory files, not a compacted summary, then run
   `/update-project-docs` and commit the docs into the same PR.
7. Tell the owner. The owner watches CI and merges.

When the owner has said they are away, take over their Chrome windows and tabs for installs and live tests without
asking; stop only if they said they are using Chrome at that moment.

- All changes go through PRs with clear descriptions
- PRs are reviewed via CI (cross-platform tests) and Claude Code automated review
- **A GitHub Codex "clean" signal can belong to an older commit.** On PR #90 the babysit poll reported
  `CLEAN … signal=thumbs-up` against head `e252bd4`'s cutoff, but the 👍 and the summary's `commit_sha` were the
  review of `efbe143`: the docs commits were pushed while that review ran. Before calling a round clean, confirm the
  summary's `commit_sha` (the "Commit" column) is the head; if it is not, post `@codex review` again
- Local Codex CLI rounds (the review pipeline's Tier 3, `gpt-5.6-terra` at `xhigh`) took about 3.5–11 minutes each on
  v12.16, and about 12.5–22 minutes each on v12.18 (five rounds on 2026-11-05, launch to the `-o` file: ~17, ~15,
  ~15.5, ~22 and ~12.5 min, on a userscript diff of +719 / −26). Run them in the background and wait on the `-o`
  output file: 600 s foreground waits timed out on both releases. Uncommitted
  files from parallel agents re-triggered the Stop hook mid-pipeline
- Ensure the full suite (`npm test`) and the probes (`npm run test:probes`) pass before requesting merge
- **List anything you cannot test yourself as owner acceptance in the PR** (today: Safari + Userscripts). Never
  report it as verified (CLAUDE.md, measurement context)
- **Merging is the owner's call, per PR.** This repo merges with merge commits (`gh pr merge --merge`); auto-merge
  is disabled. To merge only the head that was checked, add `--match-head-commit` with the FULL SHA
  (`--match-head-commit "$(git rev-parse HEAD)"`): an abbreviated one fails with "Could not coerce value … to
  GitObjectID" (PR #85). A merge before a release's live confirm is an owner waiver of DEC-031: record it there

## Version Bumping

- Bump `ACN_VERSION` constant in the userscript when making releases
- Also update the `@version` field in the userscript header block
- Keep CHANGELOG.md updated with version history

## Commit Conventions

- Write clear, descriptive commit messages
- Focus on the "why" not just the "what"
- Keep commits atomic — one logical change per commit
