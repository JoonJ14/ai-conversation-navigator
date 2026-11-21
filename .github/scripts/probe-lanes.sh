#!/usr/bin/env bash
# One probe job of the CI rebuild (ROADMAP 0e): its two lanes run side by side, each lane's probes one after
# another. Layout B, the owner's choice of 2026-11-11: two blocks per probe job, so the 9 suite jobs and the 9 probe
# jobs run at once (18; `changes` before them, `ci-ok` after) within GitHub Free's 20 concurrent jobs.
#
#   probe-lanes.sh <group> <browser> [--no-retry]
#
# Every probe in a lane runs even after one fails; the job fails if any probe failed. Each line a probe prints is
# prefixed with its lane and probe, live, and a table of exit codes and times ends the log.
# A probe that exits non-zero is run ONCE more, announced, in a fresh node process and so a fresh browser (the owner,
# 2026-11-21; DEC-066; TESTING.md "Retries and flakes"). Passes the second time: FLAKY, counted as passed, with a
# ::warning annotation naming the first run's FAIL lines. Fails again: GENUINE, the job fails; when both runs print
# the same FAIL lines it is also called deterministic. --no-retry turns the retry off.
# Lane times are CI's, one probe at a time (run 42437401493, chromium; firefox and webkit 1-4% more).
set -uo pipefail

group=${1:-}
browser=${2:-}
retry=1
[ "${3:-}" = --no-retry ] && retry=0

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

# GitHub workflow-command escaping for an annotation's message.
gh_escape() {
    local s=$1
    s=${s//'%'/%25}; s=${s//$'\r'/%0D}; s=${s//$'\n'/%0A}
    printf '%s' "$s"
}

# One run of one probe: its lines go to the log, prefixed, and to the file $3; the exit code is the probe's.
run_probe() {
    local tag=$1 p=$2 out=$3 name=${2%%.js*}
    # $p is word-split on purpose: "check-gemini-index.js --part 1" is a probe and its flag.
    # shellcheck disable=SC2086
    node probes/$p --browser "$browser" 2>&1 | tee "$out" | awk -v t="[$tag $name] " '{ print t $0; fflush() }'
    return "${PIPESTATUS[0]}"
}

run_lane() {
    local tag=$1; shift
    local p name t0 t1 rc rc2 out1 out2 fails1 fails2 verdict secs1 timing first line tname
    for p in "$@"; do
        name=${p%%.js*}
        t0=$(date +%s)
        out1=$(mktemp); out2=$(mktemp)
        verdict=-
        echo "[$tag $name] start $(date -u +%H:%M:%SZ)"
        run_probe "$tag" "$p" "$out1"; rc=$?
        echo "[$tag $name] exit $rc after $(( $(date +%s) - t0 )) s"
        if [ "$rc" != 0 ] && [ "$retry" = 1 ]; then
            secs1=$(( $(date +%s) - t0 ))
            fails1=$(grep -E '^[[:space:]]*(FAIL|INVALID)[[:space:]]' "$out1" || true)
            echo "[$tag $name] [retry] exit $rc on the first run; running the probe once more (a fresh process and browser)"
            if [ -n "$fails1" ]; then
                printf '%s\n' "$fails1" | sed "s/^/[$tag $name] [retry] first run: /"
            else
                echo "[$tag $name] [retry] first run: no FAIL line (exit $rc); the last lines were:"
                tail -n 5 "$out1" | sed "s/^/[$tag $name] [retry]   /"
            fi
            t1=$(date +%s)
            run_probe "$tag" "$p" "$out2"; rc2=$?
            echo "[$tag $name] exit $rc2 after $(( $(date +%s) - t1 )) s (retry)"
            if [ "$rc2" = 0 ]; then
                verdict=FLAKY
                echo "[$tag $name] [retry] FLAKY: the retry passed; the first run's failure is reported as a flake"
                first=${fails1:-"exit $rc, no FAIL line; last line: $(tail -n 1 "$out1")"}
                timing=$(printf '%s\n' "$fails1" | grep -oE 'vis=[a-z]+, raf10=-?[0-9]+ms' | sort -u | paste -sd ' ' - || true)
                timing="${timing:+$timing; }probe ${secs1} s on the first run, $(( $(date +%s) - t1 )) s on the retry"
                while IFS= read -r line; do
                    [ -n "$line" ] || continue
                    line=$(printf '%s' "$line" | sed 's/^[[:space:]]*//')
                    tname=$(printf '%s' "${line%% — *}" | sed -E 's/^(FAIL|INVALID)[[:space:]]+//')
                    echo "::warning title=Flaky test::$(gh_escape "probes/$name ($browser) :: $tname: first run: $line; timing: $timing")"
                done <<< "$first"
            else
                fails2=$(grep -E '^[[:space:]]*(FAIL|INVALID)[[:space:]]' "$out2" || true)
                if [ -n "$fails1" ] && [ "$fails1" = "$fails2" ]; then
                    verdict="GENUINE (deterministic)"
                    echo "[$tag $name] [retry] GENUINE: failed on both runs (deterministic: the same FAIL lines twice in a row)"
                else
                    verdict=GENUINE
                    echo "[$tag $name] [retry] GENUINE: failed on both runs"
                fi
                while IFS= read -r line; do
                    [ -n "$line" ] || continue
                    echo "::error title=Test failed::$(gh_escape "probes/$name ($browser) :: $(printf '%s' "$line" | sed 's/^[[:space:]]*//')")"
                done <<< "${fails2:-exit $rc2 on both runs, no FAIL line}"
            fi
            rc=$rc2
        elif [ "$rc" != 0 ]; then
            verdict="not retried (--no-retry)"
        fi
        rm -f "$out1" "$out2"
        echo "$tag|$p|$rc|$(( $(date +%s) - t0 ))|$verdict" >> "$results"
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
echo "probe job $group ($browser): lane | probe | exit | seconds | retry; $(( $(date +%s) - t00 )) s in all"
bad=0
total=0
flaky=0
while IFS='|' read -r tag p rc secs verdict; do
    total=$((total + 1))
    echo "  $tag | $p | $rc | $secs | $verdict"
    [ "$rc" = 0 ] || bad=$((bad + 1))
    [ "$verdict" = FLAKY ] && flaky=$((flaky + 1))
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
if [ "$flaky" -gt 0 ]; then
    echo "probe job $group ($browser): all $total probes passed ($flaky FLAKY: failed once, passed on the retry)"
else
    echo "probe job $group ($browser): all $total probes passed"
fi
