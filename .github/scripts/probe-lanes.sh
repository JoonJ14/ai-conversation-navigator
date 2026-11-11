#!/usr/bin/env bash
# One probe job of the CI rebuild (ROADMAP 0e): its two lanes run side by side, each lane's probes one after
# another. Layout B, the owner's choice of 2026-11-11: two blocks per probe job, so the 9 suite jobs, the 9 probe
# jobs and claude-code-review fit in GitHub Free's 20 concurrent jobs.
#
#   probe-lanes.sh <group> <browser>
#
# Every probe in a lane runs even after one fails (nothing is retried); the job fails if any probe failed. Each line
# a probe prints is prefixed with its lane and probe, live, and a table of exit codes and times ends the log.
# Lane times are CI's, one probe at a time (run 42437401493, chromium; firefox and webkit 1-4% more).
set -uo pipefail

group=${1:-}
browser=${2:-}

case "$group" in
    gemini-index)
        lane_a=("check-gemini-index.js --part 1")                   # 375.5 s
        lane_b=("check-gemini-index.js --part 2") ;;                # 388.4 s
    features+bookmarks)
        lane_a=("check-feature-gaps.js" "check-transport-ladder.js")  # 275 + 138 s
        lane_b=("check-ix-bookmarks.js" "check-answer-bookmarks.js" "check-gemini-history.js") ;;  # 232 + 121 + 44 s
    meter+jumps)
        lane_a=("check-context-meter.js" "check-claude-turnkeys.js" "check-index-adapters.js")  # 219 + 126 + 58 s
        lane_b=("check-ix-jumps.js" "check-gm-storage.js" "check-gpt-fallback.js" "check-turn-counter.js"
                "check-ctx-limit.js" "check-claude-far-jump.js")  # 201 + 69 + 37 + 31 + 27 + 24 s
        # The string probes stay on chromium only (they assert pure string behaviour; 26 s together).
        if [ "$browser" = chromium ]; then
            lane_b+=("check-tokenizer.js" "check-subsegments.js" "check-usage-state.js")
        fi ;;
    *)
        echo "::error::probe-lanes.sh: unknown group '$group'"; exit 2 ;;
esac
case "$browser" in
    chromium | firefox | webkit) ;;
    *) echo "::error::probe-lanes.sh: unknown browser '$browser'"; exit 2 ;;
esac

results=$(mktemp)

run_lane() {
    local tag=$1; shift
    local p name t0 rc
    for p in "$@"; do
        name=${p%%.js*}
        t0=$(date +%s)
        echo "[$tag $name] start $(date -u +%H:%M:%SZ)"
        # $p is word-split on purpose: "check-gemini-index.js --part 1" is a probe and its flag.
        # shellcheck disable=SC2086
        node probes/$p --browser "$browser" 2>&1 | awk -v t="[$tag $name] " '{ print t $0; fflush() }'
        rc=${PIPESTATUS[0]}
        echo "[$tag $name] exit $rc after $(( $(date +%s) - t0 )) s"
        echo "$tag|$p|$rc|$(( $(date +%s) - t0 ))" >> "$results"
    done
}

t00=$(date +%s)
run_lane A "${lane_a[@]}" &
pa=$!
run_lane B "${lane_b[@]}" &
pb=$!
wait "$pa"
wait "$pb"

echo
echo "probe job $group ($browser): lane | probe | exit | seconds; $(( $(date +%s) - t00 )) s in all"
bad=0
total=0
while IFS='|' read -r tag p rc secs; do
    total=$((total + 1))
    echo "  $tag | $p | $rc | $secs"
    [ "$rc" = 0 ] || bad=$((bad + 1))
done < <(sort "$results")
rm -f "$results"
expected=$(( ${#lane_a[@]} + ${#lane_b[@]} ))
if [ "$total" -ne "$expected" ]; then
    echo "::error::probe job $group ($browser): $total of $expected probes reported an exit code"
    exit 1
fi
if [ "$bad" -ne 0 ]; then
    echo "::error::probe job $group ($browser): $bad of $total probes failed"
    exit 1
fi
echo "probe job $group ($browser): all $total probes passed"
