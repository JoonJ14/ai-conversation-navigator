# Hover Zone Fix — Sidebar Activation Area

Implementation spec for fixing the oversized hover detection zone that blocks platform UI buttons.

**Last updated:** 2026-02-22  
**Applies to:** v10.0+ (Orbital UI)  
**Status:** Ready for implementation

---

## Problem

The orbital sidebar's hover detection zone spans **160px wide × the entire screen height** (`top:0; bottom:0`). This invisible rectangle captures mouse events across the entire right edge of every platform, blocking users from clicking:

- Claude: Artifact panel X (close) button, Copy button
- Grok: "Private" toggle, top-right navigation icons
- Gemini: Google account profile button, top-right controls
- ChatGPT: Top-right UI elements
- Any platform button within 160px of the right edge, at any vertical position

The actual orbital button stack occupies roughly **66px wide × 272px tall**, centered vertically — a fraction of the hover zone.

---

## Root Cause

Two overlapping elements both span full screen height with mouse listeners:

```css
/* Line 982 */
.acn-zone    { position:fixed; right:0; top:0; bottom:0; width:160px; z-index:2147483640; }

/* Line 984 */
.acn-hitzone { position:absolute; right:0; top:0; bottom:0; width:160px; z-index:1; }
```

Both have `mouseenter`/`mouseleave` handlers (lines 2000–2023) that set `orbHovering = true` and trigger `orbRender()`, which expands all satellite dots.

```javascript
// Line 2000-2002
function handleEnter() { orbHovering = true; orbRender(); }
hitzone.addEventListener('mouseenter', handleEnter);
zone.addEventListener('mouseenter', handleEnter);
```

**Result:** Mouse anywhere within 160px of right edge, at ANY height, triggers the orbital to expand.

---

## Actual Button Footprint

In show-all mode with 6 features (ORB_N = 6):

| Element | Size | Position (from right edge) | Vertical position |
|---------|------|---------------------------|-------------------|
| Navigate (main) | 48×48px | right: 18px (ORB_CX - 24) | cy - 24 to cy + 24 |
| Satellite above 1 | 32×32px | right: 26px (ORB_CX - 16) | cy - 64 to cy - 32 |
| Satellite above 2 | 32×32px | right: 26px | cy - 112 to cy - 80 |
| Satellite below 1 | 32×32px | right: 26px | cy + 32 to cy + 64 |
| Satellite below 2 | 32×32px | right: 26px | cy + 80 to cy + 112 |
| Satellite below 3 | 32×32px | right: 26px | cy + 128 to cy + 160 |

Where `cy = window.innerHeight / 2` and `ORB_CX = 42`.

**Total bounding box:** ~66px wide (right edge to left edge of main dot) × ~272px tall (top satellite to bottom satellite). Center of stack is at viewport vertical midpoint.

---

## Fix Strategy

Three coordinated changes:

### 1. Make `.acn-zone` pass-through for mouse events

The zone element must remain full-height because dots use absolute positioning with `top` values relative to it. But it should NOT capture mouse events.

**CSS change:**

```css
/* BEFORE */
.acn-zone { position:fixed; right:0; top:0; bottom:0; width:160px; z-index:2147483640; ... }

/* AFTER */
.acn-zone { position:fixed; right:0; top:0; bottom:0; width:160px; z-index:2147483640; pointer-events:none; ... }
```

**JS change:** Remove `mouseenter`/`mouseleave` listeners from `zone`. Only `hitzone` and individual dots need them.

```javascript
// REMOVE these two lines:
zone.addEventListener('mouseenter', handleEnter);   // line 2002
zone.addEventListener('mouseleave', handleExit);     // line 2023
```

### 2. Shrink `.acn-hitzone` to button cluster area

Replace the full-height hitzone with a compact rectangle that covers only the button stack plus comfortable padding.

**CSS change:**

```css
/* BEFORE */
.acn-hitzone { position:absolute; right:0; top:0; bottom:0; width:160px; z-index:1; }

/* AFTER — static CSS sets base styles, JS positions dynamically */
.acn-hitzone { position:absolute; right:0; z-index:1; pointer-events:auto; }
```

**JS change — dynamic sizing:** The hitzone dimensions depend on `ORB_N` (number of features) and must update when the window resizes. Add a function to compute and apply hitzone bounds:

```javascript
var HITZONE_PAD_X = 30;  // horizontal padding beyond dots (px)
var HITZONE_PAD_Y = 40;  // vertical padding above/below outermost dots (px)

function orbUpdateHitzone() {
    var hitzone = document.getElementById('acn-hitzone');
    if (!hitzone) return;

    var cy = window.innerHeight / 2;
    var sp = 48;  // dot spacing in show-all mode

    // Calculate stack extents based on current ORB_N
    var nSats  = ORB_N - 1;
    var nAbove = Math.floor(nSats / 2);
    var nBelow = nSats - nAbove;

    // Topmost dot center: cy - nAbove * sp
    // Bottommost dot center: cy + nBelow * sp
    // Main dot is 48px, satellites are 32px — use 48/2 = 24 as max radius
    var stackTop    = cy - nAbove * sp - 24;
    var stackBottom = cy + nBelow * sp + 24;

    // Apply with padding
    var hitzoneTop    = Math.max(0, stackTop - HITZONE_PAD_Y);
    var hitzoneBottom = stackBottom + HITZONE_PAD_Y;
    var hitzoneWidth  = ORB_CX + 24 + HITZONE_PAD_X;  // rightmost dot edge + padding

    hitzone.style.top    = hitzoneTop + 'px';
    hitzone.style.height = (hitzoneBottom - hitzoneTop) + 'px';
    hitzone.style.width  = hitzoneWidth + 'px';
    hitzone.style.bottom = 'auto';  // override the old bottom:0
}
```

Call `orbUpdateHitzone()`:
- Once during `injectOrbital()` after hitzone is created
- On `window.resize` (debounced, since `cy` depends on `innerHeight`)
- After any ORB_N change (if features are added/removed dynamically)

**Resulting hitzone for 6 features on a 900px viewport:**

```
cy = 450
nAbove = 2, nBelow = 3
stackTop    = 450 - 2*48 - 24 = 330
stackBottom = 450 + 3*48 + 24 = 618

hitzoneTop    = 330 - 40 = 290
hitzoneBottom = 618 + 40 = 658
hitzoneHeight = 368px
hitzoneWidth  = 42 + 24 + 30 = 96px
```

Compare: **96×368px** vs the old **160×900px**. The hitzone is now ~25% of the old area and doesn't reach the top or bottom of the screen where platform buttons live.

### 3. Add dot-level mouseleave as safety net

With the zone no longer capturing events, there's a gap: if the mouse moves from a dot directly outside (skipping the hitzone — possible with fast mouse movement), `mouseleave` on the hitzone won't fire because the mouse was never "in" it.

Add `mouseleave` to each individual dot:

```javascript
// During dot creation in injectOrbital()
orbDots.forEach(function (dot) {
    dot.addEventListener('mouseenter', handleEnter);
    dot.addEventListener('mouseleave', function (e) {
        // Only collapse if mouse didn't move to another dot, hitzone, or panel
        var related = e.relatedTarget;
        if (related && related.closest && (
            related.closest('.acn-dot') ||
            related.closest('.acn-hitzone') ||
            related.closest('.acn-panel')
        )) return;
        if (orbPanel) return;
        orbHovering = false;
        orbRender();
    });
});
```

This ensures the orbital always collapses when the mouse truly leaves the button area, regardless of which exit path the mouse takes.

---

## Edge Cases

### Panel open state

When a panel is open (`orbPanel !== null`), the zone shifts left by 310px (`.acn-zone.acn-hp{right:310px}`). The hitzone must shift with it (it will, since it's a child of the zone with `position:absolute`). No additional handling needed — the hitzone moves with its parent.

### Arc and wheel modes

Arc and wheel modes spread dots in a circular pattern that may extend beyond the show-all column footprint. Two options:

**Option A (recommended):** Keep the hitzone sized for show-all (the default mode). Arc/wheel users are already power users who hover intentionally — the hitzone just needs to be big enough to "catch" the initial approach, and once `orbHovering = true`, the dots themselves have `pointer-events:auto` and individual `mouseenter` handlers keep the hover alive.

**Option B:** Dynamically resize hitzone per mode. More complex, and arc/wheel are less commonly used. Defer unless users report issues.

### Window resize

The button stack recenters on resize (since `cy = innerHeight / 2`). The hitzone must follow. Wire into the existing resize handler:

```javascript
window.addEventListener('resize', debounce(function () {
    orbUpdateHitzone();
    orbRender();
}, 150));
```

### Zone shift when panel opens

When `.acn-hp` is added (panel opens), the zone slides to `right:310px`. The hitzone is a child with `position:absolute; right:0` so it stays flush with the zone's right edge — no extra handling. The hitzone just moves with its parent.

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| CSS: `.acn-zone` | 982 | Add `pointer-events:none` |
| CSS: `.acn-hitzone` | 984 | Remove `top:0;bottom:0;width:160px;` — JS positions dynamically |
| JS: zone listeners | 2002, 2023 | Remove `mouseenter`/`mouseleave` from `zone` |
| JS: new function | — | Add `orbUpdateHitzone()` to compute hitzone bounds |
| JS: `injectOrbital()` | after hitzone creation | Call `orbUpdateHitzone()` |
| JS: resize handler | existing | Add `orbUpdateHitzone()` call |
| JS: dot creation | during `injectOrbital()` | Add `mouseenter`/`mouseleave` to each dot |

### Testing Checklist

- [ ] Claude: Can click artifact X button and Copy button in top-right
- [ ] Grok: Can click "Private" toggle and top-right icons
- [ ] Gemini: Can click Google profile button in top-right
- [ ] ChatGPT: Can click top-right UI elements
- [ ] Orbital still expands when hovering directly over the button cluster
- [ ] Orbital collapses when mouse leaves button area (all directions)
- [ ] Panel opens/closes normally when clicking dots
- [ ] Orbital stays expanded while panel is open
- [ ] Hitzone recenters correctly after window resize
- [ ] Arc and wheel modes still activate on hover approach
- [ ] Fast mouse movement across dots doesn't leave orbital stuck in expanded state

---

*This spec is referenced from the v10.1 implementation plan. See `V10-PLAN.md` for the full task list.*
