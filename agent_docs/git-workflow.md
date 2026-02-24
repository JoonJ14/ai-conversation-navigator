# Git Workflow

## Branch Protection

- `main` is protected — **never push directly to main**
- All changes must go through pull requests
- CI must pass before merging

## Feature Branches

- Always create feature branches for changes
- Use descriptive branch names (e.g., `add-platform-x`, `fix-arc-rendering`)
- Keep branches focused on a single concern

## Pull Requests

- All changes go through PRs with clear descriptions
- PRs are reviewed via CI (cross-platform tests) and Claude Code automated review
- Ensure all 14 platform tests pass before requesting merge

## Version Bumping

- Bump `ACN_VERSION` constant in the userscript when making releases
- Also update the `@version` field in the userscript header block
- Keep CHANGELOG.md updated with version history

## Commit Conventions

- Write clear, descriptive commit messages
- Focus on the "why" not just the "what"
- Keep commits atomic — one logical change per commit
