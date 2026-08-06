# Settings Panel — Implementation Spec

Upgrade the partially-working Settings panel with persistent platform toggles (with lockout prevention), language selector (i18n), and refined display options. All settings persist via `GM_setValue` and survive script updates.

**Last updated:** 2026-02-23  
**Applies to:** v10.1+  
**Status:** Ready for implementation  
**Depends on:** None (self-contained)

---

## Table of Contents

1. [Overview](#overview)
2. [Current State (Partially Working)](#current-state-partially-working)
3. [Settings Storage](#settings-storage)
4. [Display Group](#display-group)
5. [Language Group](#language-group)
6. [Platform Toggles](#platform-toggles)
7. [Platform Toggle Safety (Lockout Prevention)](#platform-toggle-safety-lockout-prevention)
8. [About Group](#about-group)
9. [i18n Architecture](#i18n-architecture)
10. [Panel Layout](#panel-layout)
11. [Implementation Details](#implementation-details)
12. [Testing Checklist](#testing-checklist)

---

## Overview

Settings is the configuration hub. It currently has a working mode selector (show-all / arc / wheel) and scroll direction toggle, plus non-functional platform toggles that toggle visually but don't persist or do anything.

v10.1 makes everything functional: platform toggles actually disable/enable the script per platform, a new language selector switches UI strings, and all settings persist across sessions and script updates via `GM_setValue`.

---

## Current State (Partially Working)

`orbBuildPanelSettings()` (line 1852) has three groups:

| Group | Status |
|-------|--------|
| Display (mode selector, scroll direction) | ✅ Working, persists via `orbSaveSettings()` |
| Platforms (5 toggle switches) | ❌ Visual only — toggles `acn-on` class but doesn't persist or affect behavior |
| About (version label, reset button) | ✅ Working, but version is hardcoded "v10.0" |

---

## Settings Storage

All settings stored as a single object in `GM_setValue`:

```javascript
// Default settings (for new installs or missing keys)
var DEFAULT_SETTINGS = {
    // Display
    orbMode: 'show-all',
    scrollInverted: false,

    // Language
    language: 'en',

    // Platform toggles (all enabled by default)
    platforms: {
        claude: true,
        chatgpt: true,
        grok: true,
        gemini: true,
        perplexity: true
        // New platforms added in future versions auto-default to true
    }
};

function loadSettings() {
    var stored = GM_getValue('acn-settings', {});
    // Merge with defaults: stored values take precedence, missing keys get defaults
    var settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    if (stored.orbMode) settings.orbMode = stored.orbMode;
    if (stored.scrollInverted !== undefined) settings.scrollInverted = stored.scrollInverted;
    if (stored.language) settings.language = stored.language;

    if (stored.platforms) {
        // Merge stored platform prefs — new platforms not in storage default to true
        Object.keys(stored.platforms).forEach(function (key) {
            settings.platforms[key] = stored.platforms[key];
        });
    }

    return settings;
}

function saveSettings(settings) {
    GM_setValue('acn-settings', settings);
}
```

### Persistence guarantees

- `GM_setValue` data is tied to `@name` + `@namespace` in the userscript header
- Survives: page refresh, browser restart, computer restart, script updates
- Only wiped by: uninstalling script, changing @name/@namespace, uninstalling Tampermonkey, clearing all extension data

### New platforms in future versions

When we add support for Bolt.new in v11.0, it won't exist in stored settings from v10.1. The `loadSettings()` merge handles this: any platform not in stored `platforms` object inherits from `DEFAULT_SETTINGS` (which will include the new platform as `true`). No migration logic needed.

---

## Display Group

Already working. Minor updates:

### Orbital mode selector

No changes needed. Already works and persists.

### Scroll direction

No changes needed. Already works and persists.

### Future display settings

Room to add settings like:
- Sidebar position (left/right) — if requested
- Theme override (auto/light/dark) — if requested
- Font size — if requested

These are placeholder ideas, not planned for v10.1.

---

## Language Group

New settings group between Display and Platforms.

### Language selector

```javascript
var SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'ko', label: '한국어' }
    // Future: add more languages here
];
```

Renders as a dropdown identical in style to the mode selector:

```javascript
// Language selector
var langSel = createElement('select', { id: 'acn-lang-sel', className: 'acn-set-sel' });
SUPPORTED_LANGUAGES.forEach(function (lang) {
    var o = createElement('option', { value: lang.code, textContent: lang.label });
    if (lang.code === settings.language) o.setAttribute('selected', '');
    langSel.appendChild(o);
});
langSel.addEventListener('change', function () {
    settings.language = langSel.value;
    saveSettings(settings);
    showToast(i18n('languageChanged'));
    // Language change takes effect on refresh (consistent with platform toggle behavior)
});
```

### Scope of translation

> **⚠ This list was inverted in BOTH directions and is corrected below (2026-08-03).** It
> claimed every UI string was translated while all content analysis stayed English. v12.7 made
> content analysis read Korean, and the v12.7a audit found UI strings that were never wired.
> Original text preserved at the end of this section.

**None of the bullets below is a blanket claim, and none of them carries a tally.** Coverage is
**partial on every UI surface**. Two things were learned the hard way writing this section
(PR #72, four review rounds):

1. **Every blanket claim here was wrong**, in a way no maintainer could see without grepping.
   So the bullets name *specific* surfaces.
2. **Every tally here was also wrong** — "21 of 31" toasts, "9 vs 5" tooltips, "13 of 14" keys.
   Each was miscounted by including or excluding the wrong population: a `title:` field in a
   config object or a data object is not a DOM tooltip, and a regex with a length cap silently
   drops long call sites out of the denominator rather than misclassifying them.
   **So this section names members instead of counting them.** A named surface can be checked
   against the code in one grep; a tally can only be re-derived, and a stale tally looks
   authoritative while being wrong.

To get current numbers, run the audit — `agent_docs/conventions.md` → i18n Conventions. Do not
transcribe its output back into this file.

What gets translated (UI strings) — **partially, on every line**:
- Orbital feature labels (Navigate, Search, Bookmarks, Summary, Tools, Settings)
- Panel headers and section titles
- **Some** button labels and tooltips — **not all**. Hardcoded English remains on
  `Clear all bookmarks`, on the `Remove bookmark` / `Bookmark this message` tooltip, and on the
  Navigate row's `No message link available`. The `/Commands` panel's Execute/Edit/Delete
  tooltips are hardcoded **deliberately** (DEC-042).
  **When auditing tooltips, match only real DOM attributes** — `.title =`,
  `setAttribute('title', …)`, and `title:` in a `createElement` *options* object. A `title:`
  key in the `PLATFORMS` registry is a platform display name, and a `title:` key in the
  `TOOLS_EXPORT` data objects is a visible label rendered via `textContent`. Neither is a
  tooltip; both were wrongly swept into this population once each.
- **Some** toasts — **most are hardcoded English**, including the export progress and success
  messages, "Summary exported" and "All bookmarks cleared". Not an exception list anyone
  decided; just unwired. **Note when auditing:** at least one call site passes a *conditional*
  whose branches are both English literals, so a scan that only matches a leading quote will
  miss it.
- The Tools panel — Image Gallery, 파일 내보내기 and its export options (wired in **v12.7a**;
  the translations existed from the start but were never read)
- The Plan usage panel, including reset phrases, which are `{placeholder}` templates because
  Korean orders the meridiem before the time

What stays in English **on purpose**:
- `/Commands` — "slash command" reads better untranslated (DEC-042)
- **Three** surfaces by owner preference, not oversight: question-list prefixes, the
  no-questions empty state, the no-bookmarks-to-export message (ROADMAP 0c).
  **Partial English in Korean mode is accepted** — do not treat those three as defects.
- **Not in this category: `usageUnavailable`.** It was listed here as a fourth preference and
  that was wrong — the message rendered in *neither* language, so there was no English surface
  to prefer. It was a bug (permanent "Plan usage loading…" after a failed fetch), **fixed in
  v12.8** (DEC-044). Nor is `summaryLanguageNote`, which still needs an owner decision — see the
  notice below.

What reads Korean **since v12.7** (content analysis):
- **Topic extraction** — the tokenizer keeps Hangul and uses a script-aware minimum length
- **The conversation map**, both levels, including segment labels
- Deduplication and word-overlap, which read the same token stream

What still does NOT read Korean:
- **Key points** — `KEY_POINT_PATTERNS` is a set of English phrase regexes, a mechanism no
  tokenizer change reaches. This is the one real remaining gap (ROADMAP 0a).

<details><summary>Original list, preserved</summary>

```
What gets translated (UI strings):
- All orbital feature labels (Navigate, Search, Bookmarks, Summary, Tools, Settings)
- All panel headers, section titles, button labels
- Toast messages, empty states, tooltips
- Question list prefixes ("Q#1" stays as-is — numbers are universal)
- Export file headers

What stays in English (content analysis):
- Topic extraction (English stop words, English tokenization)
- Key point signal phrases (English regex patterns)
- Conversation map segment labels (derived from English topic extraction)
```
</details>

> **⚠ This notice has never actually rendered (found 2026-08-03).** `summaryLanguageNote` has
> zero call sites — the section below describes intended behaviour, not shipped behaviour.
> **And v12.7 made its text substantially untrue:** topics and the conversation map now read
> Korean; only key points do not. Do not wire the existing string. See ROADMAP 0c for the three
> options and the owner decision it needs.

### Disclaimer for non-English users

When language is set to non-English, the Summary panel shows a note:

```
ℹ️ 요약 분석은 영어 대화에서 가장 잘 작동합니다.
   (Summary analysis works best with English conversations.)
```

This is honest and sets expectations. Future versions can add language-specific stop words and signal phrases — the architecture supports it, it's just labor per language.

---

## Platform Toggles

### Current behavior (broken)

Toggles flip visually but don't persist or affect anything:
```javascript
tog.addEventListener('click', function () { tog.classList.toggle('acn-on'); });
```

### New behavior

Toggles update `settings.platforms[platformId]`, persist via `saveSettings()`, and take effect on page refresh.

```javascript
platList.forEach(function (p) {
    var platformId = p.id; // 'claude', 'chatgpt', etc.
    var isEnabled = settings.platforms[platformId] !== false;
    var isCurrent = platform.id === platformId;

    var iconEl = createElement('span', {
        className: 'acn-plat-icon',
        style: 'color:' + p.color,
        textContent: p.icon
    });
    var nameEl = createElement('span', {
        className: 'acn-plat-name',
        textContent: p.name
    });
    var tog = createElement('div', {
        className: 'acn-toggle' + (isEnabled ? ' acn-on' : '') +
                   (isCurrent ? ' acn-toggle-locked' : '')
    });

    if (isCurrent) {
        // Rule A: Can't disable the platform you're currently on
        var lockIcon = createElement('span', {
            className: 'acn-plat-lock',
            textContent: '🔒',
            title: i18n('cantDisableCurrent')
        });
        nameEl.appendChild(lockIcon);
    }

    tog.addEventListener('click', function () {
        // Rule A: Block toggling the current platform
        if (isCurrent) {
            showToast(i18n('cantDisableCurrent'));
            return;
        }

        // Rule B: Prevent disabling the last enabled platform
        var enabledCount = Object.keys(settings.platforms).filter(function (k) {
            return settings.platforms[k] !== false;
        }).length;

        if (isEnabled && enabledCount <= 1) {
            showToast(i18n('mustHaveOnePlatform'));
            return;
        }

        // Toggle
        var newState = !settings.platforms[platformId];
        settings.platforms[platformId] = newState;
        tog.classList.toggle('acn-on', newState);
        saveSettings(settings);

        // Note: changes take effect on refresh
        showToast(i18n('refreshToApply'));
    });

    platGroup.appendChild(createElement('div', { className: 'acn-plat-row' },
        [iconEl, nameEl, tog]));
});
```

### Script initialization check

At the very top of the script's initialization, before anything else runs:

```javascript
function shouldRunOnThisPlatform() {
    var settings = loadSettings();
    var currentPlatform = detectCurrentPlatform(); // returns platform id string

    if (!currentPlatform) return false; // not on a supported platform

    // Check if this platform is enabled in settings
    return settings.platforms[currentPlatform] !== false;
}

// Early exit if disabled
if (!shouldRunOnThisPlatform()) return;
```

This means the entire script doesn't execute at all on disabled platforms — zero DOM injection, zero observers, zero resource usage.

---

## Platform Toggle Safety (Lockout Prevention)

Three complementary safeguards:

### Rule A: Can't disable current platform

The toggle for the platform you're currently browsing is visually locked (🔒 icon, greyed out styling) and clicking it shows a toast: "Can't disable while you're on this platform."

**Why:** Prevents the immediate scenario of disabling the platform you're on and losing access to settings.

### Rule B: At least one platform must remain enabled

If only one platform is enabled and the user tries to toggle it off, the action is blocked with a toast: "At least one platform must be enabled."

**Why:** Prevents total lockout where the script is disabled everywhere and the user has no way to re-enable it without editing Tampermonkey storage directly.

### Rule C: Changes require page refresh

Platform toggles save immediately to `GM_setValue` but don't take effect until the page is refreshed. A note below the toggles says "Changes take effect after page refresh."

**Why:** Gives the user a safety window. If they accidentally toggle something off, they can toggle it back on before refreshing. The script running right now was loaded with the previous settings — nothing changes mid-session.

### Locked toggle CSS

```css
.acn-toggle-locked {
    opacity: 0.4;
    cursor: not-allowed;
}

.acn-plat-lock {
    font-size: 10px;
    margin-left: 4px;
    vertical-align: middle;
}
```

### Recovery: worst case scenario

Even with all three safeguards, if somehow a user does get locked out (e.g., manually editing Tampermonkey storage), the fix is:

1. Open Tampermonkey Dashboard → Storage tab for this script
2. Find `acn-settings` key
3. Delete it (or edit the platforms object)
4. Refresh — script loads with all defaults (everything enabled)

This is documented in TROUBLESHOOTING.md as a recovery procedure but should essentially never be needed thanks to Rules A + B + C.

---

## About Group

### Version display

Update from hardcoded string to reading from a constant:

```javascript
var ACN_VERSION = '10.1';

// In the About group:
aboutGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
    createElement('div', {
        className: 'acn-set-label',
        style: 'color:#777',
        textContent: 'AI Conversation Navigator v' + ACN_VERSION
    }),
]));
```

### Reset to Default

Current behavior resets mode and scroll direction. Update to also reset language and platform toggles:

```javascript
resetBtn.addEventListener('click', function () {
    if (!confirm(i18n('resetConfirm'))) return;

    // Reset all settings to defaults
    saveSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));

    // Update UI elements to reflect defaults
    var modeSel = document.getElementById('acn-mode-sel');
    if (modeSel) modeSel.value = 'show-all';

    var dirSel = document.getElementById('acn-dir-sel');
    if (dirSel) dirSel.value = 'standard';

    var langSel = document.getElementById('acn-lang-sel');
    if (langSel) langSel.value = 'en';

    // Reset orbital mode
    orbSetMode('show-all');
    orbScrollInverted = false;

    showToast(i18n('resetComplete'));
});
```

Added a `confirm()` dialog since reset now affects more settings. Prevents accidental data loss.

### GitHub link

Add a subtle link to the project repo:

```javascript
var ghLink = createElement('a', {
    href: 'https://github.com/joonj14/ai-conversation-navigator',
    textContent: 'GitHub',
    target: '_blank',
    className: 'acn-about-link'
});
aboutGroup.appendChild(ghLink);
```

---

## i18n Architecture

### String table structure

```javascript
var I18N = {
    en: {
        // Orbital feature labels
        navigate: 'Navigate',
        search: 'Search',
        bookmarks: 'Bookmarks',
        summary: 'Summary',
        tools: 'Tools',
        settings: 'Settings',

        // Navigate panel
        questionPrefix: 'Q#',
        noQuestions: 'No questions detected yet',

        // Search panel
        searchPlaceholder: 'Search conversation...',
        searchResults: '{count} matches',
        searchInQuestions: 'in questions',
        searchInResponses: 'in responses',

        // Bookmarks panel
        noBookmarks: 'No bookmarks yet',
        bookmarkAdded: 'Bookmark added',
        bookmarkRemoved: 'Bookmark removed',

        // Summary panel
        generateSummary: 'Generate Summary',
        regenerateSummary: 'Regenerate Summary',
        analyzing: 'Analyzing...',
        summaryDisclaimer: "Pattern matching, not AI. For a real summary, just ask — you're literally inside one!",
        conversationMap: 'Conversation Map',
        topics: 'Topics',
        keyPoints: 'Key Points',
        stats: 'Stats',
        summaryLanguageNote: '',  // empty for English

        // Tools panel
        imageGallery: 'Image Gallery',
        noImages: 'No images in this conversation',
        goToMessage: 'Go to message',
        downloadImage: 'Download image',
        imageDownloaded: 'Image downloaded',
        openedInNewTab: 'Opened in new tab — right-click to save',
        exportFull: 'Full Conversation',
        exportFullDesc: 'Markdown with all messages',
        exportBookmarks: 'Bookmarks Only',
        exportBookmarksDesc: 'Pinned messages as document',
        exportSummary: 'Summary',
        exportSummaryDesc: 'Topics, map, key points',
        noBookmarksToExport: 'No bookmarks in this conversation',
        moreToolsSoon: 'More tools coming soon.\nGot ideas? Open an issue on GitHub!',

        // Settings panel
        display: 'Display',
        orbitalMode: 'Orbital mode',
        scrollDirection: 'Scroll direction',
        standard: 'Standard',
        natural: 'Natural',
        language: 'Language',
        platforms: 'Platforms',
        cantDisableCurrent: "Can't disable while you're on this platform",
        mustHaveOnePlatform: 'At least one platform must be enabled',
        refreshToApply: 'Changes take effect after page refresh',
        about: 'About',
        resetToDefault: 'Reset to Default',
        resetConfirm: 'Reset all settings to defaults?',
        resetComplete: 'Settings reset to defaults',
        languageChanged: 'Language updated — refresh to apply',
    },

    ko: {
        // Orbital feature labels
        navigate: '탐색',
        search: '검색',
        bookmarks: '북마크',
        summary: '요약',
        tools: '도구',
        settings: '설정',

        // Navigate panel
        questionPrefix: 'Q#',
        noQuestions: '아직 감지된 질문이 없습니다',

        // Search panel
        searchPlaceholder: '대화 검색...',
        searchResults: '{count}개 일치',
        searchInQuestions: '질문에서',
        searchInResponses: '응답에서',

        // Bookmarks panel
        noBookmarks: '아직 북마크가 없습니다',
        bookmarkAdded: '북마크 추가됨',
        bookmarkRemoved: '북마크 삭제됨',

        // Summary panel
        generateSummary: '요약 생성',
        regenerateSummary: '요약 다시 생성',
        analyzing: '분석 중...',
        summaryDisclaimer: '패턴 매칭 기반이며 AI가 아닙니다. 진짜 요약은 AI에게 직접 물어보세요!',
        conversationMap: '대화 지도',
        topics: '주제',
        keyPoints: '주요 포인트',
        stats: '통계',
        summaryLanguageNote: 'ℹ️ 요약 분석은 영어 대화에서 가장 잘 작동합니다.',

        // Tools panel
        imageGallery: '이미지 갤러리',
        noImages: '이 대화에 이미지가 없습니다',
        goToMessage: '메시지로 이동',
        downloadImage: '이미지 다운로드',
        imageDownloaded: '이미지 다운로드 완료',
        openedInNewTab: '새 탭에서 열림 — 우클릭하여 저장',
        exportFull: '전체 대화',
        exportFullDesc: '모든 메시지를 마크다운으로',
        exportBookmarks: '북마크만',
        exportBookmarksDesc: '고정된 메시지를 문서로',
        exportSummary: '요약',
        exportSummaryDesc: '주제, 지도, 주요 포인트',
        noBookmarksToExport: '이 대화에 북마크가 없습니다',
        moreToolsSoon: '더 많은 도구가 곧 추가됩니다.\n아이디어가 있으시면 GitHub에서 이슈를 열어주세요!',

        // Settings panel
        display: '디스플레이',
        orbitalMode: '오비탈 모드',
        scrollDirection: '스크롤 방향',
        standard: '표준',
        natural: '자연',
        language: '언어',
        platforms: '플랫폼',
        cantDisableCurrent: '현재 사용 중인 플랫폼은 비활성화할 수 없습니다',
        mustHaveOnePlatform: '최소 하나의 플랫폼이 활성화되어 있어야 합니다',
        refreshToApply: '변경사항은 페이지 새로고침 후 적용됩니다',
        about: '정보',
        resetToDefault: '기본값으로 초기화',
        resetConfirm: '모든 설정을 기본값으로 초기화하시겠습니까?',
        resetComplete: '설정이 기본값으로 초기화되었습니다',
        languageChanged: '언어가 변경됨 — 새로고침하여 적용',
    }
};
```

### i18n function

```javascript
function i18n(key, replacements) {
    var lang = GM_getValue('acn-settings', {}).language || 'en';
    var str = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;

    // Simple template replacement: {count} → actual value
    if (replacements) {
        Object.keys(replacements).forEach(function (k) {
            str = str.replace('{' + k + '}', replacements[k]);
        });
    }

    return str;
}
```

### Usage pattern

Replace all hardcoded strings throughout the codebase:

```javascript
// Before:
panel.appendChild(orbBuildPanelHeader('🔧 Tools'));

// After:
panel.appendChild(orbBuildPanelHeader('🔧 ' + i18n('tools')));
```

```javascript
// Before:
showToast('Bookmark added');

// After:
showToast(i18n('bookmarkAdded'));
```

### Adding new languages

Adding a language is a two-step process:

1. Add an entry to `SUPPORTED_LANGUAGES`:
   ```javascript
   { code: 'ja', label: '日本語' }
   ```

2. Add a translation object to `I18N`:
   ```javascript
   ja: {
       navigate: 'ナビゲート',
       search: '検索',
       // ... all keys
   }
   ```

Community contributors can submit translations as pull requests. The structure is simple enough that a bilingual user can translate the full string table in 30-60 minutes.

### Future: Content analysis i18n

When there's demand, content analysis (stop words, signal phrases) can be made language-aware:

```javascript
var STOP_WORDS = {
    en: ['the', 'and', 'is', 'in', 'to', 'a', 'of', 'for', 'that', 'this', ...],
    ko: ['은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', ...]
};

var SIGNAL_PHRASES = {
    en: [/let's go with (.{10,80})/i, /decided to (.{10,80})/i, ...],
    ko: [/(.{5,80})로 하자/i, /(.{5,80})로 결정/i, ...]
};
```

This is architecturally supported but not implemented in v10.1. Noted as a future enhancement in the README.

---

## Panel Layout

```
┌──────────────────────────────────────┐
│ ⚙ 설정 (Settings)                 ✕ │
├──────────────────────────────────────┤
│                                      │
│  디스플레이 (Display)                │
│  ┌────────────────────────────────┐  │
│  │ 오비탈 모드     [ Show all ▾ ] │  │
│  │ 스크롤 방향     [ 표준     ▾ ] │  │
│  └────────────────────────────────┘  │
│                                      │
│  언어 (Language)                     │
│  ┌────────────────────────────────┐  │
│  │ 언어            [ 한국어   ▾ ] │  │
│  └────────────────────────────────┘  │
│                                      │
│  플랫폼 (Platforms)                  │
│  ┌────────────────────────────────┐  │
│  │ ✳ Claude         🔒 [■■■■]   │  │
│  │ ⏣ ChatGPT          [■■■■]   │  │
│  │ X Grok              [    ]   │  │
│  │ ✦ Gemini            [■■■■]   │  │
│  │ ✳ Perplexity        [■■■■]   │  │
│  │                                │  │
│  │ ℹ️ 변경사항은 페이지 새로고침   │  │
│  │    후 적용됩니다               │  │
│  └────────────────────────────────┘  │
│                                      │
│  정보 (About)                        │
│  ┌────────────────────────────────┐  │
│  │ AI Conversation Navigator      │  │
│  │ v10.1                          │  │
│  │                                │  │
│  │ GitHub                         │  │
│  │                                │  │
│  │ [ 기본값으로 초기화 ]          │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

Note: Claude toggle shows 🔒 because user is currently on Claude (Rule A). Grok is toggled off. The "refresh to apply" note sits below the platform toggles.

---

## Implementation Details

### Summary of file changes

| Location | Change |
|----------|--------|
| Top of script | Add `shouldRunOnThisPlatform()` early exit check |
| Constants section | Add `I18N` string table, `DEFAULT_SETTINGS`, `SUPPORTED_LANGUAGES` |
| `orbBuildPanelSettings()` (~line 1852) | Rewrite with persistent toggles, language selector, lockout prevention |
| All panel build functions | Replace hardcoded strings with `i18n()` calls |
| All `showToast()` calls | Replace hardcoded strings with `i18n()` calls |
| About group | Dynamic version from `ACN_VERSION` constant, add GitHub link |
| Reset button | Add `confirm()` dialog, reset all settings including language and platforms |

### Migration from current settings

The current code stores settings via `orbSaveSettings()` which likely uses a different `GM_setValue` key. The new system should check for the old key on first load and migrate:

```javascript
function migrateOldSettings() {
    var oldSettings = GM_getValue('acn-orb-settings', null);
    if (oldSettings && !GM_getValue('acn-settings', null)) {
        // Migrate old display settings into new structure
        var newSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        if (oldSettings.mode) newSettings.orbMode = oldSettings.mode;
        if (oldSettings.scrollInverted !== undefined) {
            newSettings.scrollInverted = oldSettings.scrollInverted;
        }
        saveSettings(newSettings);
    }
}
```

Call `migrateOldSettings()` once at initialization.

---

## Testing Checklist

### Display settings
- [ ] Mode selector changes orbital layout
- [ ] Mode selection persists across page refresh
- [ ] Scroll direction toggles and persists

### Language
- [ ] Language dropdown shows all supported languages
- [ ] Selecting Korean changes UI strings to Korean
- [ ] Language change persists across refresh
- [ ] i18n() falls back to English for missing keys
- [ ] Summary panel shows language disclaimer when non-English selected
- [ ] Brand names unchanged (Claude, ChatGPT, AI Conversation Navigator)

### Platform toggles
- [ ] Toggles reflect stored settings on panel open
- [ ] Toggle changes persist to GM_setValue
- [ ] Current platform toggle is locked (🔒) and shows toast on click
- [ ] Cannot disable the last remaining enabled platform
- [ ] Disabling a platform prevents script from running on that site after refresh
- [ ] Re-enabling a platform restores script functionality after refresh
- [ ] New platforms (added in future versions) default to enabled

### Reset
- [ ] Confirm dialog appears before reset
- [ ] Reset restores all settings to defaults
- [ ] UI elements update to reflect defaults after reset
- [ ] Canceling confirm dialog does not reset

### About
- [ ] Version number reads from ACN_VERSION constant
- [ ] GitHub link opens in new tab

### i18n coverage
- [ ] Navigate panel labels translated
- [ ] Search panel placeholder and results translated
- [ ] Bookmarks panel strings translated
- [ ] Summary panel strings translated
- [ ] Tools panel strings translated
- [ ] Settings panel strings translated
- [ ] Toast messages translated

---

*This spec is referenced from V10-PLAN.md task #7. No dependencies on other tasks — can be implemented in parallel.*
