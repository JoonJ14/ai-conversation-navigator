# Orbital Button System — Implementation Spec for AI Conversation Navigator v10.0

## Overview

This document specifies the **orbital button system** for the AI Conversation Navigator Tampermonkey userscript. The orbital system replaces the previous single "Navigate" button with a multi-feature hub that provides access to 6 features: Navigate, Search, Bookmarks, Summary, Export, and Settings.

The system has **three display modes** (Show All, Arc, Wheel) and uses a **slot-based architecture** where appearance rules are defined in lookup tables — not hardcoded per-button. This makes the system scalable: adding new features automatically adjusts the layout.

**Reference implementation**: See the companion file `orbital-v11.html` for a working interactive prototype with all three modes, panels, and animations. That HTML file is the source of truth for visual behavior.

---

## Architecture

### Feature Registry

All features are defined in a single array. The system derives everything (button count, polygon shape, slot ranges) from this array's length.

```javascript
const features = [
  { id: 'nav',       icon: '✳', label: 'Navigate',  bg: '#d97706', panel: 'panel-nav' },
  { id: 'search',    icon: '⌕', label: 'Search',    bg: '#c2770a', panel: 'panel-search' },
  { id: 'bookmarks', icon: '⚑', label: 'Bookmarks', bg: '#a3630d', panel: 'panel-bookmarks' },
  { id: 'summary',   icon: 'Σ', label: 'Summary',   bg: '#8b5410', panel: 'panel-summary' },
  { id: 'export',    icon: '↗', label: 'Export',    bg: '#734613', panel: 'panel-export' },
  { id: 'settings',  icon: '⚙', label: 'Settings',  bg: '#5c3916', panel: 'panel-settings' },
];
const N = features.length;   // 6
const MAIN = 0;               // Navigate is always index 0
```

**Icons are Unicode symbols** (not SVGs, not images) to avoid trademark issues across platforms. Each platform gets its own theme color — the `bg` gradient above is for Claude's orange theme.

**Platform themes** (each platform gets ONE unified color for all buttons):
The "unified color" rule means all buttons within a platform share the same base color — slot opacity is the only brightness variable. Each platform has its own theme:
- Claude / Claude Code web: `#d97706` (orange)
- ChatGPT / Codex: `#ffffff` (white)
- Grok: `#e53e3e` (red)
- Gemini: `#4285f4` (blue)
- Perplexity: `#20b2aa` (teal)

The `bg` gradient values in the features array are NOT used during rendering. Instead, at render time, all buttons get the platform's single unified color. Example for Claude: every button gets `#d97706`. Example for Grok: every button gets `#e53e3e`.

**Supported platforms** (URL matching):
- `claude.ai` — Claude and Claude Code web
- `chatgpt.com` — ChatGPT and Codex
- `grok.com`, `x.com/grok` — Grok
- `gemini.google.com` — Gemini
- `perplexity.ai` — Perplexity
- `bolt.new`, `lovable.dev`, `replit.com` — App builder sites

### Constants

```javascript
const CX = 42;  // Horizontal center offset from right edge (pixels)
```

All buttons are positioned using `right` CSS property, measured from the right edge of the viewport. `CX` is the center axis — the main ✳ button sits centered on this axis.

---

## Display Modes

### Mode 1: Show All

The simplest mode. Navigate (✳) sits at the vertical center. Other buttons stack above and below in a column.

**Layout**:
- Navigate: centered vertically at `cy` (container midpoint), 42×42px, rounded-square (`border-radius: 13px`)
- Satellites above: indices [1, 2] — Search, Bookmarks
- Satellites below: indices [3, 4, 5] — Summary, Export, Settings
- Spacing: 42px between centers
- All satellites: 28px circles, `border-radius: 50%`

**Color rules for Show All**:
- Navigate: platform theme color
- ALL satellites: same platform theme color — ensures truly equal brightness
- This override is applied each render cycle via `dots[idx].style.background = PLATFORM_COLOR`
- On Claude, that's `#d97706`. On Grok, `#e53e3e`. Etc.

**Visibility**:
- Navigate: always visible (opacity 1), even when not hovering
- Satellites: opacity 0 when not hovering, opacity 1 when hovering
- All buttons are the same brightness — no gradient, no hierarchy

**Connectors**: Thin vertical lines drawn between consecutive buttons (in visual order: bookmarks → search → navigate → summary → export → settings). Use absolutely-positioned divs with 1px width and `background: rgba(217,119,6,0.15)`.

**Hover behavior**: Mouse enters the orbital zone → satellites fade in. Mouse leaves → satellites fade out. No scroll interaction in this mode.

### Mode 2: Arc (Auto-polygon)

Navigate stays at center. Satellites orbit around it in a **regular polygon** shape. Scrolling rotates which satellite is at the "focus" position (directly left of center).

**Geometry**:
- Satellites are placed at vertices of a regular polygon
- For 5 satellites → pentagon, for 6 → hexagon, for 7 → heptagon, etc.
- Vertex angle: `(satIndex / satelliteCount) * 2π`
- Rotation offset: `-(rotIdx / satelliteCount) * 2π`
- Radius: 76px from center
- Angle 0 = directly LEFT of the main button
- Position: `px = CX + cos(angle) * radius`, `py = cy + sin(angle) * radius`

**Slot-based brightness** (distance from focus position at angle 0):

```javascript
const ARC_RULES = [
  { op: 1.0,  size: 30, fs: 13 },  // slot 0: focus (directly left)
  { op: 0.65, size: 26, fs: 11 },  // slot ±1: adjacent vertices
  { op: 0.40, size: 22, fs: 10 },  // slot ±2: far vertices
  { op: 0.25, size: 20, fs: 9  },  // slot ±3+: distant (clamp to last rule)
];
```

Slot distance is computed as vertex steps from focus, NOT angular distance:
```javascript
let slot = satIndex - rotIdx;
while (slot > nS / 2) slot -= nS;
while (slot < -nS / 2) slot += nS;
const dist = Math.abs(slot);
const rule = ARC_RULES[Math.min(Math.floor(dist), ARC_RULES.length - 1)];
```

**Color rules for Arc**:
- Navigate: platform theme color
- ALL satellites: platform theme color (unified, so opacity is the ONLY visual variable)

**Scroll**: Each scroll step increments/decrements `rotIdx` modulo `nS` (satellite count, NOT total count). This rotates the polygon, shifting which satellite is at focus.

### Mode 3: Wheel (Vertical Carousel)

All buttons (including Navigate) participate in a vertical conveyor belt. Scrolling shifts which button is at center. Strict slot rules — no exceptions.

**Slot rules** (lookup table):

```javascript
const WHEEL_RULES = [
  { size: 42, fs: 17, op: 1.0  },  // slot 0: center (active)
  { size: 28, fs: 12, op: 0.50 },  // slot ±1: adjacent
  { size: 20, fs: 9,  op: 0.18 },  // slot ±2: far
  // slot ±3+: INVISIBLE
];
const WHEEL_HIDDEN = { size: 14, fs: 7, op: 0 };
```

**Navigate brightness boost**: +0.15 additive to opacity when Navigate is NOT at center. This does NOT override slot visibility — if Navigate is at slot ±3, it's still invisible.
```javascript
const NAV_BOOST = 0.15;
if (featureIdx === MAIN && op > 0 && op < 1) {
  op = Math.min(1, op + NAV_BOOST);
}
```

**Color rules for Wheel**: All buttons use the platform's unified theme color (same as Arc and Show All). The `bg` gradient values in the features array are NOT used during rendering. Slot-based opacity is the ONLY visual variable across all three modes.

**Implementation**: Define a `PLATFORM_COLOR` constant at initialization based on detected platform:
```javascript
const PLATFORM_COLORS = {
  claude:     { bg: '#d97706', text: '#000', shadow: 'rgba(217,119,6,.25)' },
  chatgpt:    { bg: '#ffffff', text: '#000', shadow: 'rgba(255,255,255,.25)' },
  grok:       { bg: '#e53e3e', text: '#000', shadow: 'rgba(229,62,62,.25)' },
  gemini:     { bg: '#4285f4', text: '#000', shadow: 'rgba(66,133,244,.25)' },
  perplexity: { bg: '#20b2aa', text: '#000', shadow: 'rgba(32,178,170,.25)' },
};
const theme = PLATFORM_COLORS[detectedPlatform] || PLATFORM_COLORS.claude;
```
All render functions use `theme.bg` for button backgrounds, `theme.text` for icon color, and `theme.shadow` for box-shadow. Panel accent colors (borders, highlights, text labels) should also derive from `theme.bg`.

**Slot calculation with symmetric wrapping**:
```javascript
let slot = i - rotIdx;
while (slot > N / 2) slot -= N;
while (slot <= -N / 2) slot += N;  // <= for symmetric tie-breaking
```
The `<=` on the lower bound is critical — with even N (like 6), `N/2 = 3` creates a boundary condition. Using `<=` ensures both scroll directions handle the wrap identically.

**Conveyor belt wrapping animation**:
When a button wraps around (jumps from one side to the other), it should NOT visibly teleport. Instead:
1. Detect wrap: `Math.abs(currentSlot - previousSlot) > N/2`
2. Instantly teleport to staging position (±3.5) with transitions disabled
3. Force browser reflow (`void element.offsetHeight`)
4. Re-enable transitions
5. Animate to actual slot position

Since slot ±3 is invisible (opacity 0), the staging at ±3.5 is also invisible, making the entry seamless.

```javascript
if (wrapped && show) {
  const staging = slot > 0 ? 3.5 : -3.5;
  dot.classList.add('no-t');  // disable transitions
  applyWheelSlot(dot, i, staging, cy, sp, show);
  void dot.offsetHeight;      // force reflow
  dot.classList.remove('no-t');
}
applyWheelSlot(dot, i, slot, cy, sp, show);
```

**Spacing**: 48px between slot centers.

---

## Shared Behaviors (All Modes)

### Main Button (✳ Navigate)

- **Always visible** at opacity 1, regardless of hover state
- Size: 42×42px
- Border-radius: 13px (rounded square, NOT circle)
- Box-shadow: `0 2px 14px rgba(R,G,B,0.25)` using platform color RGB values when at center/active
- Position: `right: CX - 21` (centered on CX axis), `top: cy - 21` (centered vertically)

### CSS Transitions

**Critical**: Opacity must transition FAST (near-instant) while position/size transition smoothly. This makes brightness feel tied to the POSITION, not the button.

```css
.orb-dot {
  transition:
    top .3s cubic-bezier(.25,.8,.5,1),
    right .3s cubic-bezier(.25,.8,.5,1),
    width .3s cubic-bezier(.25,.8,.5,1),
    height .3s cubic-bezier(.25,.8,.5,1),
    font-size .3s cubic-bezier(.25,.8,.5,1),
    border-radius .3s cubic-bezier(.25,.8,.5,1),
    box-shadow .3s cubic-bezier(.25,.8,.5,1),
    opacity .08s linear;
}
```

This ensures that when a button slides from slot 0 (bright) to slot 1 (dim), the brightness drops almost immediately while the button is still physically sliding. The focus position stays bright, and incoming buttons pick up that brightness right away.

### Hover Labels

Each button shows its label text to the LEFT of the button on hover:
```css
.orb-dot .olbl {
  position: absolute;
  right: calc(100% + 10px);
  font-size: 10px;
  font-weight: 600;
  color: var(--acn-accent);  /* PLATFORM_COLOR — e.g. #d97706 on Claude, #e53e3e on Grok */
  white-space: nowrap;
  opacity: 0;
  transition: opacity .15s, transform .15s;
  transform: translateX(4px);
  pointer-events: none;
}
.orb-dot:hover .olbl {
  opacity: 1;
  transform: translateX(0);
}
```

### Hover on Buttons

All buttons get `filter: brightness(1.3)` on `:hover` for a visible highlight effect.

### Scroll Handling

- Scroll is captured on the orbital zone element
- `e.preventDefault()` to stop page scroll
- Animation lock: 250ms cooldown between scroll steps to prevent rapid-fire
- Support "natural" vs "standard" scroll direction (configurable in Settings)
- Wheel mode: rotIdx cycles through N (all features)
- Arc mode: rotIdx cycles through N-1 (satellites only, Navigate doesn't participate)

### Hover Exit Reset

When the mouse leaves the orbital zone AND no panel is open:
1. Set `isHovering = false`
2. Store current `rotIdx` as `prevRotIdx` (for wrap detection)
3. Reset `rotIdx = 0` (Navigate returns to center/focus)
4. Re-render

This ensures Navigate is always the "home" position — users always return to a familiar state.

### Panel Behavior

Clicking a feature button opens its panel (slides in from the right). The orbital zone shifts left by the panel width (310px) via a CSS class:
```css
.orb-zone.hp { right: 310px; }
```

Clicking the same button again closes the panel. When a panel is open, hover-exit doesn't trigger (the zone stays expanded). Closing the panel resets `rotIdx` to 0.

---

## Positioning Helper

All dot positioning goes through one function:

```javascript
function sd(dot, p) {
  dot.style.width = p.w + 'px';
  dot.style.height = p.h + 'px';
  dot.style.fontSize = p.fs + 'px';
  dot.style.right = p.right + 'px';
  dot.style.top = p.top + 'px';
  dot.style.borderRadius = p.rad || '50%';
  dot.style.opacity = p.op;
  dot.style.pointerEvents = p.click ? 'auto' : 'none';
  dot.style.boxShadow = p.shad ? `0 2px 14px ${PLATFORM_SHADOW}` : 'none';  // PLATFORM_SHADOW derived from PLATFORM_COLOR
  dot.classList.toggle('vis', p.op > 0.05);
}
```

This is the ONLY function that touches dot styles. Everything else computes the parameters and passes them here.

---

## Panel Specifications

Each feature has a slide-in panel (310px wide, full height minus top bar). Panels share common structure:

### Panel Header
```html
<div class="ph">
  <h3>Panel Title</h3>
  <button class="xb" onclick="closePanel()">✕ close</button>
</div>
```

### Navigate Panel
- **Context bar**: Shows estimated context window usage (percentage bar + token estimate)
- **Stats row**: "X questions detected · Y words total"
- **Question list**: Scrollable list of detected user questions with:
  - Question number (Q#1, Q#2, etc.)
  - Question text (2-line clamp)
  - Word count for that message
  - Click to scroll to that question in the conversation

### Search Panel
- **Search input**: Text field with placeholder "Search this conversation..."
- **Results list**: Matching questions/messages, same format as Navigate list
- **Hint text**: "Search through questions and responses"

### Bookmarks Panel
- **Auto-bookmarks**: Code blocks, links, key decisions detected in conversation
- **Manual bookmarks**: User-added bookmarks via a mechanism TBD
- Each bookmark shows: type badge (Code/Link/Decision), preview text, position in conversation

### Summary Panel
- **Topics section**: Tag pills showing detected topics
- **Key points section**: Bulleted list of main takeaways
- **Action items section**: Extracted action items/todos
- **Generate button**: "Generate Summary" button to trigger AI-powered summary

### Export Panel
- **Format options**, each as a clickable row:
  - Markdown (.md) — "Clean text with formatting"
  - PDF — "Formatted document"
  - JSON — "Structured data with metadata"
  - Text (.txt) — "Plain text, no formatting"
- Each option shows: icon, title, description

### Settings Panel
- **Scrollable settings groups**:
  - Display: Orbital mode selector, button size slider, opacity slider
  - Behavior: Auto-detect questions toggle, scroll direction selector, auto-open toggle
  - Platforms: Status indicators for Claude/ChatGPT/Grok/Gemini with toggles
  - About: Version number, reset button

---

## Integration with Tampermonkey Userscript

### DOM Injection

The orbital zone is injected as a fixed-position container on the right edge of the viewport:

```javascript
const zone = document.createElement('div');
zone.className = 'orb-zone';
zone.innerHTML = `<div class="orb-hitzone" id="hitzone"></div>`;
document.body.appendChild(zone);
```

Feature dots are created dynamically from the `features` array and appended to the zone.

### Platform Detection

The userscript already detects platforms via URL matching. The orbital system needs to:
1. Use the correct theme colors per platform
2. Adjust `CX` if the platform has a different right-side layout
3. Respect the platform's existing sidebar behavior (especially Claude's panel system)

**Platform grouping** — some platforms share a host domain:
- `claude.ai` serves both Claude chat and Claude Code web. Distinguish via URL path if needed.
- `chatgpt.com` serves both ChatGPT and Codex. Distinguish via URL path (e.g., `/codex`).
- Each platform may have different DOM structures for conversation messages, so selectors must be platform-specific even when sharing a domain.

### CSS Isolation

All orbital CSS should be scoped to prevent conflicts with platform styles. Either:
- Prefix all classes with `acn-` (AI Conversation Navigator)
- Or inject into a Shadow DOM (preferred for isolation)

### Question Detection

The Navigate feature depends on detecting user questions in the conversation. This is already implemented in the existing userscript — the orbital system should use the same detection engine and just display results in the Navigate panel instead of the old sidebar.

### Platform Abstraction Layer

**Critical**: The orbital UI is platform-agnostic (fixed CSS overlay), but features inside panels need to read conversation messages from platform-specific DOM structures. ALL platform-dependent logic must go through a single adapter interface:

```javascript
// Each platform implements:
{
  getMessages()      → [{ element, text, role, index }]
  scrollToMessage(index)
  getCodeBlocks()    → [{ element, language, text }]
  getLinks()         → [{ element, href, text }]
  isStreaming()      → boolean
}
```

**Feature dependency on this layer**:
- Navigate: `getMessages()`, `scrollToMessage()` — HIGH
- Search: same as Navigate (filters detected messages) — HIGH
- Bookmarks: `getCodeBlocks()`, `getLinks()` — MEDIUM
- Summary: reads from already-detected messages (text analysis) — LOW
- Export: reads from already-detected messages (formatting) — LOW
- Settings: no DOM dependency — ZERO

If the adapter works for a platform, all features work. If it's missing or broken, features should gracefully degrade (show "Platform not fully supported" rather than crashing). Feature code should NEVER contain direct DOM queries — everything goes through the adapter.

### MutationObserver

The existing userscript uses MutationObserver to detect new messages. The orbital system should hook into the same observer to:
- Update question count in the Navigate panel
- Update search results as new messages arrive
- Update bookmarks when code blocks or links are detected
- NOT re-inject the orbital zone (guard against duplicates)

### Duplicate Prevention

Critical on Linux Firefox where MutationObserver callbacks fire synchronously:
```javascript
let orbitalInjected = false;
function injectOrbital() {
  if (orbitalInjected) return;
  if (document.querySelector('.orb-zone')) return;
  orbitalInjected = true;
  // ... inject
}
```

---

## Scalability Design

The entire system is designed so adding a new feature requires ONLY:

1. Add one entry to the `features` array
2. Create the panel HTML
3. Implement the panel's functionality

Everything else adapts automatically:
- Show All: column grows (more items above/below center)
- Arc: polygon gains a vertex (pentagon → hexagon → etc.)
- Wheel: carousel gains a slot (wrapping math adjusts via N)
- Slot rules: applied by distance, not by name — new buttons get the same rules

**DO NOT** add feature-specific positioning logic, per-button opacity overrides, or manual angle calculations. The lookup tables handle everything.

---

## Key Design Decisions (and why)

| Decision | Rationale |
|----------|-----------|
| Unicode icons, not SVGs | Avoids trademark issues, works cross-platform, tiny footprint |
| Slot-based lookup tables | Adding features can't break layout — rules are positional |
| Fast opacity transition (80ms) vs slow position (300ms) | Brightness feels tied to position, not to the button identity |
| Unified color per platform in ALL modes | Prevents base color gradient from interfering with slot opacity. Each platform has its own color, but within that platform every button shares it. |
| Navigate always visible | Brand anchor — users always know where the tool is |
| Hover-exit resets to Navigate | Consistent home state, no confusion about which button is active |
| `<=` in wheel slot wrapping | Fixes asymmetric entry with even N (critical edge case) |
| Conveyor belt staging at ±3.5 | Since ±3 is invisible, staging beyond it ensures seamless entry |

---

## File Structure Recommendation

```
src/
├── orbital/
│   ├── orbital-core.js       # Feature registry, state, render loop, sd() helper
│   ├── orbital-modes.js      # renderShowAll(), renderArc(), renderWheel()
│   ├── orbital-panels.js     # Panel open/close, panel content rendering
│   ├── orbital-scroll.js     # Scroll handler, animation lock, direction support
│   ├── orbital-hover.js      # Hover enter/exit, reset logic
│   └── orbital-styles.css    # All orbital CSS (scoped with .acn- prefix)
├── features/
│   ├── navigate.js           # Question detection, list rendering, scroll-to
│   ├── search.js             # Search input, filtering, result display
│   ├── bookmarks.js          # Auto-detection of code/links, manual bookmarks
│   ├── summary.js            # Topic extraction, key points, action items
│   ├── export.js             # Markdown/PDF/JSON/Text generation and download
│   └── settings.js           # Preferences storage, platform toggles, reset
└── platforms/
    ├── claude.js             # Claude + Claude Code web selectors, theme, quirks
    ├── chatgpt.js            # ChatGPT + Codex selectors, theme, quirks
    ├── grok.js               # Grok-specific selectors, theme, quirks
    ├── gemini.js             # Gemini-specific selectors, theme, quirks
    ├── perplexity.js         # Perplexity-specific selectors, theme, quirks
    └── appbuilders.js        # Bolt.new, Lovable, Replit shared selectors
```

For the Tampermonkey userscript, all of this will be bundled into a single `.user.js` file. The modular structure above is for development organization — the build step concatenates everything.

---

## Testing Checklist

- [ ] Show All: all satellites same brightness, Navigate stays at center
- [ ] Show All: hover shows all buttons, exit hides satellites
- [ ] Arc: all satellites visible as polygon vertices
- [ ] Arc: scroll rotates focus, brightness follows slot position (not button)
- [ ] Arc: adding a 7th feature creates hexagonal arrangement
- [ ] Wheel: slot ±3 is INVISIBLE for ALL buttons including Navigate
- [ ] Wheel: scrolling up and down produce symmetric entry animations
- [ ] Wheel: Navigate has subtle brightness boost at ±1 and ±2 slots
- [ ] Wheel: hover exit resets Navigate to center
- [ ] Panel: opens on click, closes on re-click or close button
- [ ] Panel: orbital zone shifts left when panel is open
- [ ] Panel: hover-exit does NOT trigger when panel is open
- [ ] Transitions: opacity snaps fast (80ms), position slides smooth (300ms)
- [ ] Labels: appear on button hover, positioned to the left
- [ ] Cross-platform: works on Claude, ChatGPT, Grok, Gemini, Claude Code web, Codex, Perplexity
- [ ] App builder sites: works on Bolt.new, Lovable, Replit
- [ ] Cross-browser: works on Chrome, Firefox, Safari (via Tampermonkey)
- [ ] No duplicate injection on SPA navigation
- [ ] No resource exhaustion on DGX Spark (check RAM/CPU first if glitches appear)
