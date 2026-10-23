#!/bin/bash
# Mutation battery for probes/check-transport-ladder.js, the gate on the Claude index's transport
# ladder (v12.9, DEC-045). Builds every mutant (probes/build-ladder-mutants.js), runs the probe on
# each one and on two references, then prints the mutation matrix (probes/ladder-mutation-matrix.js).
# Not run by CI. Run it after any change to the ladder or to the probe, and paste the new matrix
# into reviews/review-2026-10-22-safari-transport.md.
#
# Run: probes/run-ladder-mutants.sh [-j N] [-o DIR] [ID ...]
#   -j N    probe runs in parallel (default 3). One run takes ~2-3 minutes, most of it timers the
#           scenarios wait out, so the full battery of 51 runs takes ~45 minutes at 3.
#   -o DIR  battery directory, which must not exist yet (default: a new temp directory)
#   ID      only these mutants, short (M42) or full id; default all of them
#
# References, always run: the working tree's build on chromium, firefox and webkit (it must pass
# every check), and the build before the ladder (ACN_BASELINE_REF, default b471ddc = main just
# before PR #75, v12.8) on chromium and firefox (it fails 52 of 63). Mutants run on chromium only.
#
# EVERYTHING RUNS AGAINST A SNAPSHOT. The build, the probe and these scripts are copied into the
# battery directory before anything runs (tests/ and node_modules/ are symlinked), so editing the
# repo mid-run cannot change a result. Two hand-run batches that read the live tree were
# contaminated that way (TESTING.md). After ANY code change, stop a running battery and start a
# new one: a battery testing a superseded build gives confident, stale verdicts.
#
# Output: one line per run as it finishes, then the matrix. Full logs in DIR/results/, the lines in
# DIR/summary.txt. Exits 1 if the build under test failed a check or any run was invalid.

set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
P=3
B=''
while getopts 'j:o:' opt; do
    case "$opt" in
        j) P="$OPTARG" ;;
        o) B="$OPTARG" ;;
        *) sed -n '8,12p' "$0" >&2; exit 2 ;;
    esac
done
shift $((OPTIND - 1))
ONLY=$(IFS=,; echo "$*")

if [ -z "$B" ]; then
    B=$(mktemp -d "${TMPDIR:-/tmp}/acn-ladder-mutants.XXXXXX") || exit 1
elif [ -e "$B" ]; then
    echo "battery directory already exists: $B (results from two batteries must never mix)" >&2
    exit 2
else
    mkdir -p "$B" || exit 1
fi
B=$(cd "$B" && pwd)
BASE_REF="${ACN_BASELINE_REF:-b471ddc}"

mkdir -p "$B/build" "$B/probes" "$B/results" || exit 1
cp "$REPO/ai-conversation-navigator.user.js" "$B/build/new.user.js" || exit 1
git -C "$REPO" show "$BASE_REF:ai-conversation-navigator.user.js" > "$B/build/baseline.user.js" || exit 1
for f in check-transport-ladder.js build-ladder-mutants.js ladder-mutation-matrix.js; do
    cp "$REPO/probes/$f" "$B/probes/" || exit 1
done
ln -s "$REPO/node_modules" "$B/node_modules" && ln -s "$REPO/tests" "$B/tests" || exit 1

echo "battery: $B"
echo "under test: working tree @ $(git -C "$REPO" rev-parse --short HEAD)$(git -C "$REPO" diff --quiet HEAD -- ai-conversation-navigator.user.js || echo ' + uncommitted changes'), $(grep -m1 '@version' "$B/build/new.user.js" | awk '{print "v" $3}')"
echo "baseline:   $BASE_REF, $(grep -m1 '@version' "$B/build/baseline.user.js" | awk '{print "v" $3}')"
node "$B/probes/build-ladder-mutants.js" "$B/build/new.user.js" "$B/mutants" "$ONLY" > "$B/build/mutants.log" || {
    cat "$B/build/mutants.log" >&2; exit 1; }
echo "mutants:    $(ls "$B/mutants" | wc -l | tr -d ' ') built; $P runs in parallel"

# Jobs carry paths relative to the battery, so xargs never splits a path with a space in it.
{
    for e in chromium firefox webkit; do echo "new $e build/new.user.js"; done
    for e in chromium firefox; do echo "baseline $e build/baseline.user.js"; done
    for m in "$B"/mutants/*.user.js; do echo "$(basename "$m" .user.js) chromium mutants/$(basename "$m")"; done
} > "$B/jobs.txt"

run_one() {
    id="$1"; engine="$2"; rel="$3"
    log="$BATTERY/results/$id.$engine.log"
    ACN_SCRIPT="$BATTERY/$rel" node "$BATTERY/probes/check-transport-ladder.js" --browser "$engine" > "$log" 2>&1
    code=$?
    fails=$(grep '^  FAIL' "$log" | awk '{print $2}' | tr '\n' ' ')
    total=$(grep -cE '^  (PASS|FAIL)' "$log")
    crashed=$(grep -c '^check-transport-ladder crashed' "$log")
    echo "$id [$engine] exit=$code checks=$total crashed=$crashed FAIL: ${fails:-none}"
}
export -f run_one
export BATTERY="$B"
xargs -P "$P" -L 1 bash -c 'run_one "$0" "$1" "$2"' < "$B/jobs.txt" | tee "$B/summary.txt"

echo
node "$B/probes/ladder-mutation-matrix.js" "$B/summary.txt"
status=$?
echo "battery: $B"
exit $status
