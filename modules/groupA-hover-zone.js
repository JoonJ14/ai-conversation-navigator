// ============================================================
// MODULE: Group A — Hover Zone Fix
// VERSION: v10.2
// DEPENDS ON: Nothing (standalone fix)
// REPLACES: CSS .acn-zone and .acn-hitzone lines, zone mouseenter/mouseleave listeners
// INSERTS: orbUpdateHitzone() function, dot-level mouseenter/mouseleave handlers
// ============================================================

/*
## v10.2 Changelog

### Added
- orbUpdateHitzone() function computes tight hitzone bounds based on ORB_N and window height
- Dot-level mouseleave safety net handlers to catch fast mouse movements that escape the hitzone

### Changed
- .acn-zone: added pointer-events:none so the zone element itself does not capture mouse events
  and block platform UI elements (Claude artifact X button, Grok Private toggle, etc.)
- .acn-hitzone: removed top:0;bottom:0;width:160px — JS now positions the hitzone dynamically
  via orbUpdateHitzone() so it only covers the vertical band that contains the orbital dots,
  not the entire screen height
- Removed mouseenter/mouseleave listeners from zone element (zone now has pointer-events:none,
  so those listeners would never fire anyway). Only hitzone and individual dots need listeners.

### Troubleshooting Log
- zone.addEventListener('mouseenter'/'mouseleave') was catching pointer events in the full
  160px × viewport-height rectangle, blocking platform buttons at top and bottom of the sidebar
  column. The fix is two-pronged: (1) pointer-events:none on the zone, (2) a compact hitzone
  whose dimensions are recomputed from the actual dot stack geometry.
- orbDots is populated inside orbBuildZone() (not injectOrbital()), specifically in the
  ORB_FEATURES.forEach loop at lines 2307-2325 of the v10.0 main file. Dot handlers must
  therefore be attached inside orbBuildZone(), after the forEach loop completes and orbDots
  has been fully populated.
- handleEnter and handleExit are closures defined inside orbBuildZone(). The dot handlers
  below must reference handleEnter by name (they are added in the same scope), and must
  replicate the guard logic of handleExit rather than calling it directly so they can omit
  the '.acn-zone' guard (the zone is no longer a hover target).
*/


// ============================================================
// SECTION 1 — CSS REPLACEMENTS
// ============================================================
//
// These are drop-in string replacements inside orbInjectCSS().
// The integration agent should do exact-string substitution on
// the styleEl.textContent array entries.
//
// --- Replacement A: .acn-zone ---
//
// SEARCH FOR (exact string in styleEl.textContent array, line 1320):
//   '.acn-zone{position:fixed;right:0;top:0;bottom:0;width:160px;z-index:2147483640;transition:right .3s cubic-bezier(.4,0,.2,1);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif}'
//
// REPLACE WITH:
//   '.acn-zone{position:fixed;right:0;top:0;bottom:0;width:160px;z-index:2147483640;pointer-events:none;transition:right .3s cubic-bezier(.4,0,.2,1);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif}'
//
// CHANGE: inserted `pointer-events:none;` immediately after `z-index:2147483640;`
// WHY: The zone spans the full screen height. With pointer-events enabled it silently
//      swallows clicks and hovers on platform UI (artifact close buttons, toggles, etc.).
//      All hover interaction is now handled by the compact hitzone and individual dots.
//
//
// --- Replacement B: .acn-hitzone ---
//
// SEARCH FOR (exact string in styleEl.textContent array, line 1322):
//   '.acn-hitzone{position:absolute;right:0;top:0;bottom:0;width:160px;z-index:1}'
//
// REPLACE WITH:
//   '.acn-hitzone{position:absolute;right:0;z-index:1;pointer-events:auto}'
//
// CHANGE: Removed top:0;bottom:0;width:160px (JS sets these dynamically via orbUpdateHitzone).
//         Added pointer-events:auto to override the zone's pointer-events:none for the hitzone
//         child element, restoring hover capture for the compact active area only.
// WHY: CSS-static dimensions lock the hitzone to the full sidebar column. Dynamic sizing via
//      orbUpdateHitzone() constrains it to the vertical band actually occupied by the dots.


// ============================================================
// SECTION 2 — NEW FUNCTION: orbUpdateHitzone()
// ============================================================
//
// INSERT LOCATION: after orbBuildZone() closes (after line 2392 in the v10.0 main file),
//                  OR at the top of orbBuildZone() body and called from within — either
//                  placement works because it only queries the DOM by ID.
//
// The integration agent MUST also call orbUpdateHitzone() at two additional sites:
//   (a) Inside orbBuildZone(), immediately after the hitzone element is created and
//       appended (after line 2298: zone.appendChild(hitzone)).
//   (b) Inside the existing resize handler at line 1210 in the v10.0 main file.
//       That handler currently only calls updateLeftChatPositions(). Add a call to
//       orbUpdateHitzone() at the end of the handler body.
//
// CONSTANTS — these can be placed at the same scope as ORB_N / ORB_CX (around line 1260):
//
//   var HITZONE_PAD_X = 30;  // px of extra width beyond the rightmost dot edge
//   var HITZONE_PAD_Y = 40;  // px of vertical padding above/below the dot stack

var HITZONE_PAD_X = 30;
var HITZONE_PAD_Y = 40;

// Full function body — paste verbatim into the main file:
function orbUpdateHitzone() {
    var hitzone = document.getElementById('acn-hitzone');
    if (!hitzone) return;

    // Vertical center of viewport (mirrors orbRender's `cy` computation)
    var cy = window.innerHeight / 2;

    // show-all geometry: Navigate at cy, satellites spread above/below at sp-px intervals
    // This matches orbRenderShowAll() which uses sp=48 and the same nAbove/nBelow split.
    var sp = 48;

    var nSats  = ORB_N - 1;           // satellite dots (all except Navigate)
    var nAbove = Math.floor(nSats / 2);
    var nBelow = nSats - nAbove;

    // Topmost pixel of the highest dot (Navigate = cy±24; highest sat = cy - nAbove*sp - 16)
    // Use Navigate top (cy-24) as fallback when nAbove === 0
    var stackTop    = cy - Math.max(nAbove * sp + 16, 24);
    // Bottommost pixel of the lowest dot
    var stackBottom = cy + Math.max(nBelow * sp + 16, 24);

    // Hitzone bounds with padding
    var hitzoneTop    = Math.max(0, stackTop - HITZONE_PAD_Y);
    var hitzoneBottom = Math.min(window.innerHeight, stackBottom + HITZONE_PAD_Y);
    var hitzoneHeight = hitzoneBottom - hitzoneTop;

    // Width: from right edge inward far enough to cover the widest dot (Navigate = 48px wide,
    // positioned at right = ORB_CX - 24, so its left edge is at ORB_CX + 24 from the right)
    var hitzoneWidth = ORB_CX + 24 + HITZONE_PAD_X;

    hitzone.style.top    = hitzoneTop + 'px';
    hitzone.style.height = hitzoneHeight + 'px';
    hitzone.style.width  = hitzoneWidth + 'px';
    hitzone.style.bottom = 'auto';   // override any inherited CSS bottom value
}


// ============================================================
// SECTION 3 — CHANGES TO orbBuildZone()
// ============================================================
//
// The integration agent must apply ALL of the following changes
// inside the orbBuildZone() function body.
//
//
// --- Change 3-A: Call orbUpdateHitzone() after hitzone is created ---
//
// LOCATION: After line 2298 in the v10.0 main file:
//   var hitzone = createElement('div', { id: 'acn-hitzone', className: 'acn-hitzone' });
//   zone.appendChild(hitzone);
//
// ADD immediately after zone.appendChild(hitzone):
//   orbUpdateHitzone();
//
//
// --- Change 3-B: Remove zone-level mouseenter / mouseleave listeners ---
//
// REMOVE line 2340 (zone.addEventListener mouseenter):
//   zone.addEventListener('mouseenter', handleEnter);
//
// REMOVE line 2361 (zone.addEventListener mouseleave):
//   zone.addEventListener('mouseleave', handleExit);
//
// WHY: The zone now has pointer-events:none, so these listeners would never fire.
//      Removing them also eliminates any residual risk of the zone swallowing events
//      if pointer-events is ever temporarily toggled during animation frames.
//
// KEEP the hitzone listeners — they are correct and must remain:
//   hitzone.addEventListener('mouseenter', handleEnter);   // line 2339 — KEEP
//   hitzone.addEventListener('mouseleave', handleExit);    // line 2360 — KEEP
//
//
// --- Change 3-C: Add dot-level mouseenter / mouseleave handlers ---
//
// LOCATION: After the ORB_FEATURES.forEach loop closes (after line 2325, after
//   orbDots.push(dot)) — i.e., after the loop body but still inside orbBuildZone().
//   The orbDots array is fully populated at this point.
//
// INSERT the following block verbatim:
//
// orbDots.forEach(function (dot) {
//     dot.addEventListener('mouseenter', handleEnter);
//     dot.addEventListener('mouseleave', function (e) {
//         var related = e.relatedTarget;
//         // Stay hovered if the mouse moved to another dot, the hitzone, or an open panel
//         if (related && related.closest && (
//             related.closest('.acn-dot')   ||
//             related.closest('#acn-hitzone') ||
//             related.closest('.acn-panel')
//         )) return;
//         // Stay hovered if a panel is currently open (panel keeps UI alive)
//         if (orbPanel) return;
//         orbHovering = false;
//         if (orbMode === 'wheel' || orbMode === 'arc') {
//             orbPrevRotIdx = orbRotIdx;
//             orbRotIdx     = 0;
//         }
//         orbRender();
//     });
// });
//
// WHY: A fast mouse movement can carry the cursor from a dot to empty space outside
//      the hitzone without triggering hitzone's mouseleave (the hitzone's spatial
//      coverage may not include the transition path). Dot-level handlers catch this
//      case. The relatedTarget guard ensures orbHovering is not incorrectly cleared
//      when moving between dots or into an open panel.
//
// NOTE on handleEnter / handleExit scope: Both closures are defined inside
//      orbBuildZone() at lines 2338 and 2343. The forEach block above must be placed
//      within orbBuildZone() (after orbDots is fully built) so it closes over the
//      same handleEnter reference. Do not extract handleEnter to an outer scope.
//
// NOTE on guard difference from handleExit: The dot mouseleave handler intentionally
//      omits the '.acn-zone' guard that handleExit has (line 2349). The zone now has
//      pointer-events:none so it is never a valid relatedTarget; including it in the
//      guard would make the guard silently fail if a browser quirk reports it.


// ============================================================
// SECTION 4 — RESIZE HANDLER ADDITION
// ============================================================
//
// LOCATION: The existing resize handler starting at line 1210 in the v10.0 main file:
//
//   window.addEventListener('resize', function () {
//       _lastBoundaryX = null;
//       updateLeftChatPositions();
//   });
//
// ADD a call to orbUpdateHitzone() at the end of that handler body:
//
//   window.addEventListener('resize', function () {
//       _lastBoundaryX = null;
//       updateLeftChatPositions();
//       orbUpdateHitzone();   // <-- ADD THIS LINE
//   });
//
// NOTE: This handler is currently guarded by `if (isLeftChat)` (line 1203). The
//       orbUpdateHitzone() call is equally needed for non-leftChat platforms (the
//       hitzone geometry depends on window.innerHeight which changes on any resize).
//       The integration agent should therefore ALSO add a separate unconditional
//       resize handler for non-leftChat platforms, OR restructure the existing guard
//       so orbUpdateHitzone() is called regardless of isLeftChat:
//
//   // Option A — simplest, add a second handler outside the isLeftChat block:
//   window.addEventListener('resize', orbUpdateHitzone);
//
//   // Option B — restructure the existing guard (more invasive, use only if
//   //             the team agrees on the refactor):
//   //   Move orbUpdateHitzone() to a position outside the if (isLeftChat) block.
//
// RECOMMENDATION: Use Option A (a second unconditional resize listener) to keep
//                 the diff minimal and avoid touching the leftChat guard block.


// ============================================================
// SECTION 5 — INTEGRATION CHECKLIST (for Phase 2 agent)
// ============================================================
//
// Apply changes in this order to minimise merge conflicts:
//
// [1] CSS in orbInjectCSS() (styleEl.textContent array, lines 1320 and 1322):
//     - Replace .acn-zone string  (add pointer-events:none)
//     - Replace .acn-hitzone string  (remove top/bottom/width, add pointer-events:auto)
//
// [2] Add constants near ORB_N / ORB_CX (around line 1260):
//     var HITZONE_PAD_X = 30;
//     var HITZONE_PAD_Y = 40;
//
// [3] Add orbUpdateHitzone() function body after orbBuildZone() closes (after line 2392).
//
// [4] Inside orbBuildZone(), after zone.appendChild(hitzone) (line 2298):
//     Add:  orbUpdateHitzone();
//
// [5] Inside orbBuildZone(), remove:
//     zone.addEventListener('mouseenter', handleEnter);   // line 2340
//     zone.addEventListener('mouseleave', handleExit);    // line 2361
//
// [6] Inside orbBuildZone(), after the ORB_FEATURES.forEach loop (after line 2325):
//     Add the dot-level orbDots.forEach handler block from Section 3-C above.
//
// [7] Add unconditional resize listener (outside any if-block, near the bottom of
//     the startup section, after line 1217):
//     window.addEventListener('resize', orbUpdateHitzone);
//
// VERIFICATION after integration:
// - In show-all mode, hover over the orbital column: dots should expand.
// - Move cursor to the very top of the viewport (above the dots): dots should collapse.
// - Move cursor to the very bottom of the viewport: dots should collapse.
// - On Claude.ai, verify the artifact panel's X close button is clickable without
//   first hovering the orbital zone.
// - On Grok, verify the "Private" toggle in the top-right corner is clickable.
// - On Gemini, verify the profile icon in the top-right corner is clickable.
// - Resize the browser window: dots should remain centred and hitzone should follow.
