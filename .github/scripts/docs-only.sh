#!/usr/bin/env bash
# The docs-only fast path (the owner, 2026-11-11; the CI rebuild, ROADMAP 0e). Writes docs_only=true|false to
# $GITHUB_OUTPUT (stdout when unset) and logs the reason and the changed files.
#
#   docs-only.sh <event name> <base sha> <head sha>
#
# docs_only=true only on a pull_request whose changed files (base...head: the PR's own changes since it left its
# base) are ALL documentation: a path ending in .md, or under docs/. Anything else runs everything:
#   - any other event (a push to main, workflow_dispatch), whatever it changed;
#   - a PR with no changed files, or one whose file list cannot be computed (a warning, never a skip);
#   - a PR with any other path, including a deleted file and either side of a rename: renames are listed as a
#     deletion plus an addition (--no-renames), so moving code into docs/ still runs everything.
# No test or probe reads a .md file or docs/ (they read the userscript, tests/mock-pages/ and probes/fixtures/).
set -uo pipefail

event=${1:-}
base=${2:-}
head=${3:-}
out=${GITHUB_OUTPUT:-/dev/stdout}

decide() {
    echo "docs_only=$1" >> "$out"
    echo "docs-only fast path: docs_only=$1 ($2)"
    exit 0
}

[ "$event" = pull_request ] || decide false "event '$event': everything runs"
if [ -z "$base" ] || [ -z "$head" ]; then
    echo "::warning::docs-only check: no base or head sha; everything runs"
    decide false "no base or head sha"
fi

list=$(mktemp)
if ! git diff --name-only --no-renames -z "$base...$head" > "$list"; then
    echo "::warning::docs-only check: git diff $base...$head failed; everything runs"
    decide false "the file list could not be computed"
fi

n=0
code=0
while IFS= read -r -d '' f; do
    n=$((n + 1))
    case "$f" in
        *.md | docs/*) echo "  docs: $f" ;;
        *) echo "  not docs: $f"; code=$((code + 1)) ;;
    esac
done < "$list"
rm -f "$list"

[ "$n" -gt 0 ] || decide false "no changed files in $base...$head: everything runs"
[ "$code" -eq 0 ] || decide false "$code of $n changed files are not docs"
decide true "all $n changed files are docs"
