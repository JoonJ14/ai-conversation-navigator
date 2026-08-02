# Claude Plan Usage Tracker — Implementation Spec

> **v12.7a update (2026-08-02) — this panel is now i18n-wired, and its reset phrases are
> TEMPLATED.** `formatResetTime` used to build output by concatenation
> (`'resets ' + day + ' ' + time + ' ' + ampm`), which cannot be translated into Korean at all:
> Korean puts the meridiem BEFORE the time (오후 3:05), and concatenation hard-codes the order.
> They are now `{placeholder}` templates resolved through `i18n(key, replacements)` — keys
> `usageResetDay` / `usageResetHM` / `usageResetH` / `usageResetMin` / `usageResetSoon`, plus
> `weekdayShort` and `am`/`pm`. English output is byte-identical (verified over 58 cases).
> See DEC-042. `usageUnavailable` still has no call site — ROADMAP item 0c.


Display the user's Claude subscription usage (session limit, weekly limits) as bars in the sidebar, right below the context window monitor. Claude-only feature — hidden on all other platforms.

**Last updated:** 2026-02-23  
**Applies to:** v10.1+  
**Status:** Ready for implementation  
**Depends on:** Nothing (self-contained)

---

## Table of Contents

1. [Overview](#overview)
2. [Data Source](#data-source)
3. [Fetching Strategy](#fetching-strategy)
4. [Data Format](#data-format)
5. [Display Design](#display-design)
6. [Polling & Caching](#polling--caching)
7. [Edge Cases](#edge-cases)
8. [Implementation Details](#implementation-details)
9. [Testing Checklist](#testing-checklist)

---

## Overview

Claude's settings page (`claude.ai/settings/usage`) shows plan usage limits:
- **Current session** — 5-hour rolling window, shows "X% used, resets in Y min"
- **Weekly: All models** — 7-day window, shows "X% used, resets Thu HH:MM PM"
- **Weekly: Sonnet only** — 7-day window, separate Sonnet-specific limit
- **Extra usage** — overage spending if enabled ($X spent of $Y limit)

This data is available via a same-domain fetch. We read it and render matching bars below the context monitor, so users can see both "how full is this conversation" AND "how much of my plan have I used today" without navigating away from their chat.

This is Claude-only. Other platforms don't expose plan usage data. The entire feature is wrapped in a `if (platform.id === 'claude')` guard.

---

## Data Source

### Investigation results (2026-02-23)

**Usage endpoint:**
```
GET https://claude.ai/settings/usage?_rsc=1fnlm
```

This is a Next.js React Server Component request. The `_rsc` parameter is a cache-buster that changes between deployments. The response `content-type` is `text/x-component` (RSC streaming format), but it contains embedded JSON with usage data.

**Response JSON structure:**
```json
{
    "five_hour": {
        "resets_at": "2026-02-23T08:00:00.805536+00:00",
        "utilization": 58.0
    },
    "seven_day": {
        "resets_at": "2026-02-26T18:00:00.805558+00:00",
        "utilization": 41.0
    },
    "seven_day_oauth_apps": null,
    "seven_day_opus": null,
    "seven_day_sonnet": {
        "resets_at": "2026-02-26T20:00:00.805570+00:00",
        "utilization": 17.0
    },
    "seven_day_cowork": null,
    "iguana_necktie": null,
    "extra_usage": null
}
```

**Key fields:**
- `five_hour.utilization` → Current session percentage (0-100)
- `five_hour.resets_at` → ISO timestamp for when session limit resets
- `seven_day.utilization` → Weekly all-models percentage (0-100)
- `seven_day.resets_at` → Weekly reset timestamp
- `seven_day_sonnet.utilization` → Sonnet-specific weekly percentage
- `seven_day_sonnet.resets_at` → Sonnet weekly reset timestamp
- Any field can be `null` (e.g., `seven_day_opus` is null if user isn't on a plan with Opus limits)

**Overage endpoint (separate request):**
```
GET https://claude.ai/api/organizations/{org_id}/overage_spend_limit
```

Response:
```json
{
    "organization_uuid": "...",
    "monthly_credit_limit": 10000,
    "currency": "USD",
    "used_credits": 5277,
    "is_enabled": true,
    "out_of_credits": false
}
```

Credits are in cents (5277 = $52.77, 10000 = $100.00).

**Subscription endpoint:**
```
GET https://claude.ai/api/organizations/{org_id}/subscription_details
```

Contains plan type (`billing_interval: "monthly"`), status, payment info. Not needed for usage display but could be useful for detecting plan tier in the future.

---

## Fetching Strategy

### Approach: Fetch page HTML and extract JSON

Rather than reverse-engineering Next.js RSC parameters (`_rsc` values change between deployments), we use a more robust approach:

**Option A: GM_xmlhttpRequest to fetch the page**

Tampermonkey's `GM_xmlhttpRequest` can fetch any URL without CORS restrictions:

```javascript
function fetchClaudeUsage(callback) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://claude.ai/settings/usage',
        headers: {
            'Accept': 'text/html'
        },
        onload: function (response) {
            if (response.status === 200) {
                var usageData = parseUsageFromHTML(response.responseText);
                if (usageData) callback(usageData);
            }
        },
        onerror: function () {
            // Silently fail — usage display is a nice-to-have
        }
    });
}
```

**Option B: Parse from embedded Next.js data**

Next.js pages embed their data as `<script>` tags with `__NEXT_DATA__` or as inline JSON. The HTML response will contain the usage JSON somewhere in the page payload:

```javascript
function parseUsageFromHTML(html) {
    // Strategy 1: Look for the usage JSON pattern in the page source
    var patterns = [
        /"five_hour"\s*:\s*\{[^}]*"utilization"\s*:\s*([\d.]+)/,
        /five_hour.*?utilization.*?([\d.]+)/
    ];

    // Strategy 2: Parse the full page and find __NEXT_DATA__
    var match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/);
    if (match) {
        try {
            var nextData = JSON.parse(match[1]);
            // Navigate the Next.js data tree to find usage data
            // Path depends on the page structure — needs live verification
            return extractUsageFromNextData(nextData);
        } catch (e) {}
    }

    // Strategy 3: Find JSON embedded in RSC payload
    // RSC responses contain lines like: 1:{"five_hour":{"resets_at":"...","utilization":58.0},...}
    var rscMatch = html.match(/\{[^{}]*"five_hour"\s*:\s*\{[^}]*\}[^{}]*"seven_day"\s*:\s*\{[^}]*\}[^}]*\}/);
    if (rscMatch) {
        try {
            return JSON.parse(rscMatch[0]);
        } catch (e) {}
    }

    return null;
}
```

**Option C: Intercept the XHR that the usage page makes**

Since the page itself makes an XHR to get the usage data (as seen in the Network tab), we could also fetch the page in a hidden iframe or just call the same API endpoint directly. But the `_rsc` parameter instability makes this fragile.

**Recommended: Start with Option A + Strategy 3 (RSC payload parsing).** If that breaks, fall back to Option A + Strategy 2 (Next.js data). If the HTML approach breaks entirely, try fetching the API endpoint with `GM_xmlhttpRequest` directly using the URL pattern observed.

### Why not just call the API endpoint directly?

The usage data comes through as an RSC response to `/settings/usage?_rsc=...`. The `_rsc` parameter changes between deployments. Without the right parameter, the server might return the full HTML page instead of the RSC payload. Since `GM_xmlhttpRequest` can fetch the full HTML anyway, parsing from HTML is more stable.

---

## Data Format

### Parsed usage object

```javascript
var usageData = {
    session: {
        utilization: 58.0,     // percentage 0-100
        resetsAt: Date object,  // parsed from ISO string
        label: 'Session'
    },
    weeklyAll: {
        utilization: 41.0,
        resetsAt: Date object,
        label: 'Weekly'
    },
    weeklySonnet: {             // null if not applicable
        utilization: 17.0,
        resetsAt: Date object,
        label: 'Sonnet'
    },
    extraUsage: {               // null if not enabled
        usedCents: 5277,
        limitCents: 10000,
        utilization: 52.77,
        label: 'Extra'
    },
    fetchedAt: Date.now()
};
```

### Reset time formatting

```javascript
function formatResetTime(resetsAt) {
    var now = new Date();
    var diff = resetsAt - now;

    if (diff <= 0) return 'resetting...';

    var minutes = Math.floor(diff / 60000);
    var hours = Math.floor(minutes / 60);

    if (minutes < 60) return 'resets in ' + minutes + ' min';
    if (hours < 24) return 'resets in ' + hours + 'h ' + (minutes % 60) + 'm';

    // For weekly resets, show day + time
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var day = days[resetsAt.getDay()];
    var h = resetsAt.getHours();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return 'resets ' + day + ' ' + h + ':00 ' + ampm;
}
```

---

## Display Design

Bars render below the context window monitor, matching its visual style. Only shown on Claude.

```
┌─────────────────────────────────┐
│  Context  22.6%  45K / 200K     │  ← existing context bar
│  █████░░░░░░░░░░░░░░░░░░░░░░░  │
│                                 │
│  Session  58%  resets in 14 min │  ← NEW: plan usage bars
│  ██████████████░░░░░░░░░░░░░░  │
│                                 │
│  Weekly   41%  resets Thu 12 PM │
│  ██████████░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────┘
```

### Bar color scheme

Use the same green/yellow/red thresholds as the context bar, so the visual language is consistent:

| Utilization | Color | Meaning |
|-------------|-------|---------|
| 0-69% | Green | Plenty of usage left |
| 70-84% | Yellow | Getting close to limit |
| 85-100% | Red | Near or at limit |

### Compact mode

If there are too many bars (context + session + weekly + sonnet), stack them tightly:

```css
.acn-usage-bar {
    margin-bottom: 4px;  /* tight spacing between bars */
}

.acn-usage-label {
    font-size: 10px;
    color: #aaa;
    display: flex;
    justify-content: space-between;
}

.acn-usage-track {
    height: 4px;  /* thinner than context bar */
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
}

.acn-usage-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
}
```

### Rendering

```javascript
function renderUsageBars(container, usageData) {
    if (!usageData || platform.id !== 'claude') return;

    // Clear previous usage bars
    var existing = container.querySelector('.acn-usage-section');
    if (existing) existing.remove();

    var section = createElement('div', { className: 'acn-usage-section' });

    // Separator between context bar and usage bars
    var sep = createElement('div', {
        className: 'acn-usage-separator',
        style: 'height:1px;background:rgba(255,255,255,0.1);margin:6px 0;'
    });
    section.appendChild(sep);

    var bars = [];

    if (usageData.session) {
        bars.push({
            label: i18n('session'),
            pct: usageData.session.utilization,
            reset: formatResetTime(usageData.session.resetsAt)
        });
    }

    if (usageData.weeklyAll) {
        bars.push({
            label: i18n('weekly'),
            pct: usageData.weeklyAll.utilization,
            reset: formatResetTime(usageData.weeklyAll.resetsAt)
        });
    }

    // Only show Sonnet bar if it exists and is different from the "all models" bar
    if (usageData.weeklySonnet && usageData.weeklyAll &&
        usageData.weeklySonnet.utilization !== usageData.weeklyAll.utilization) {
        bars.push({
            label: 'Sonnet',
            pct: usageData.weeklySonnet.utilization,
            reset: formatResetTime(usageData.weeklySonnet.resetsAt)
        });
    }

    bars.forEach(function (bar) {
        var row = createElement('div', { className: 'acn-usage-bar' });

        var labelRow = createElement('div', { className: 'acn-usage-label' });
        labelRow.appendChild(createElement('span', {
            textContent: bar.label + '  ' + Math.round(bar.pct) + '%'
        }));
        labelRow.appendChild(createElement('span', {
            textContent: bar.reset,
            style: 'color:#666;'
        }));

        var track = createElement('div', { className: 'acn-usage-track' });
        var fill = createElement('div', {
            className: 'acn-usage-fill',
            style: 'width:' + Math.min(bar.pct, 100) + '%;background:' + getBarColor(bar.pct) + ';'
        });
        track.appendChild(fill);

        row.appendChild(labelRow);
        row.appendChild(track);
        section.appendChild(row);
    });

    container.appendChild(section);
}

function getBarColor(pct) {
    if (pct >= 85) return '#ef4444';  // red
    if (pct >= 70) return '#eab308';  // yellow
    return '#22c55e';                  // green
}
```

---

## Polling & Caching

### Fetch frequency

The usage page shows "Last updated: X minutes ago" — the data isn't real-time. Polling every 5 minutes is sufficient:

```javascript
var USAGE_POLL_INTERVAL = 5 * 60 * 1000;  // 5 minutes
var _usageData = null;
var _usageLastFetch = 0;

function maybeRefreshUsage() {
    if (platform.id !== 'claude') return;
    if (Date.now() - _usageLastFetch < USAGE_POLL_INTERVAL) return;

    fetchClaudeUsage(function (data) {
        _usageData = data;
        _usageLastFetch = Date.now();
        renderUsageBars(contextBarContainer, data);
    });
}
```

### When to fetch

- On script initialization (after a short delay to not block page load)
- Every 5 minutes while the conversation is active
- After each Claude response (SSE `message_delta` end event) — usage likely changed

```javascript
// In the SSE parser, after detecting message completion:
if (eventType === 'message_delta' && parsed.usage) {
    // ... existing context token update ...
    
    // Also refresh plan usage (debounced)
    clearTimeout(_usageRefreshTimer);
    _usageRefreshTimer = setTimeout(maybeRefreshUsage, 3000);
}
```

The 3-second delay after message completion avoids fetching before the server has updated the usage numbers.

### Cache in GM_setValue

To avoid a fetch on every page load, cache the last known usage data:

```javascript
function fetchClaudeUsage(callback) {
    // Try cache first
    var cached = GM_getValue('acn-usage-cache', null);
    if (cached && Date.now() - cached.fetchedAt < USAGE_POLL_INTERVAL) {
        callback(cached);
        return;
    }

    // Fetch fresh data
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://claude.ai/settings/usage',
        // ... fetch and parse ...
        onload: function (response) {
            var data = parseUsageFromHTML(response.responseText);
            if (data) {
                data.fetchedAt = Date.now();
                GM_setValue('acn-usage-cache', data);
                callback(data);
            }
        }
    });
}
```

---

## Edge Cases

### Free plan users

Free plan users have different (more restrictive) limits. The API still returns the same JSON structure with `utilization` percentages — the limits are just lower. No special handling needed; the bars display whatever the API returns.

### Plan limits not available

If a field is `null` (e.g., `seven_day_opus: null`), don't show a bar for it. Only render bars for non-null entries.

### Fetch fails

If `GM_xmlhttpRequest` fails (network error, auth cookie expired, page structure changed), silently skip — no usage bars shown. The context bar still works independently. No error messages; usage display is informational, not critical.

### User not logged in / session expired

The fetch to `/settings/usage` will redirect to login. Detect non-200 status codes or HTML that contains login forms, and skip rendering.

### Data format changes

If Anthropic changes the JSON structure, parsing will fail and `parseUsageFromHTML` returns null. Bars silently disappear. Add a `console.debug` log for developers to diagnose.

### Extra usage display

If `extra_usage` is present in the data (user has overage enabled), show an additional compact bar. Use the overage endpoint data (`used_credits / monthly_credit_limit`). Style differently — maybe a lighter color since this is spending, not a limit.

---

## Implementation Details

### GM_xmlhttpRequest permission

Add `@grant GM_xmlhttpRequest` to the userscript header if not already present. This is required for cross-page fetching.

### File section

All plan usage code goes in the same section as the context bar — the monitoring/status area. This keeps related UI together and means one agent (Group B) handles the entire monitoring stack.

### Summary of changes

| Location | Change |
|----------|--------|
| Userscript header | Add `@grant GM_xmlhttpRequest` if not present |
| Context bar section | Add usage bars below context bar |
| New functions | `fetchClaudeUsage()`, `parseUsageFromHTML()`, `renderUsageBars()`, `formatResetTime()`, `maybeRefreshUsage()` |
| SSE parser | Add usage refresh trigger after message completion |
| CSS | Add `.acn-usage-*` styles |

### i18n strings

```javascript
// English
session: 'Session',
weekly: 'Weekly',
usageUnavailable: 'Usage data unavailable',

// Korean
session: '세션',
weekly: '주간',
usageUnavailable: '사용량 데이터를 불러올 수 없습니다',
```

---

## Testing Checklist

### Data fetching
- [ ] `GM_xmlhttpRequest` successfully fetches `/settings/usage` from conversation page
- [ ] Usage JSON parsed correctly from HTML/RSC response
- [ ] `five_hour`, `seven_day`, `seven_day_sonnet` fields extracted
- [ ] Null fields handled (no bar rendered for null entries)
- [ ] Fetch failure handled silently (no errors, no broken UI)
- [ ] Cache in `GM_setValue` prevents redundant fetches within 5 minutes

### Display
- [ ] Session bar shows correct percentage and reset countdown
- [ ] Weekly bar shows correct percentage and reset day/time
- [ ] Sonnet bar shown only when it differs from all-models bar
- [ ] Bar colors match thresholds: green (<70%), yellow (70-84%), red (85%+)
- [ ] Bars match context bar visual style
- [ ] Thin separator between context bar and usage bars
- [ ] Usage bars hidden on non-Claude platforms

### Polling
- [ ] Fresh data fetched on page load (with short delay)
- [ ] Data refreshed after each Claude response (3-second debounce)
- [ ] No fetch more often than every 5 minutes
- [ ] Reset countdown updates visually (not stale)

### Edge cases
- [ ] Free plan users see appropriate bars
- [ ] Bars render correctly at 0%, 50%, 100%
- [ ] Reset time formats correctly: "in X min", "in Xh Ym", "Thu 12:00 PM"
- [ ] Works after page refresh without re-fetching immediately

---

*This spec is referenced from V10-PLAN.md task #8. Grouped with task #1 in Agent Group B (Claude-specific monitoring). No dependencies on other tasks.*
