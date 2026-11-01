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

- All changes go through PRs with clear descriptions
- PRs are reviewed via CI (cross-platform tests) and Claude Code automated review
- **A GitHub Codex "clean" signal can belong to an older commit.** On PR #90 the babysit poll reported
  `CLEAN … signal=thumbs-up` against head `e252bd4`'s cutoff, but the 👍 and the summary's `commit_sha` were the
  review of `efbe143`: the docs commits were pushed while that review ran. Before calling a round clean, confirm the
  summary's `commit_sha` (the "Commit" column) is the head; if it is not, post `@codex review` again
- Local Codex CLI rounds (the review pipeline's Tier 3, `gpt-5.6-terra` at `xhigh`) took about 3.5–11 minutes each on
  v12.16. Run them in the background and wait on the `-o` output file: a 600 s foreground wait timed out. Uncommitted
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
