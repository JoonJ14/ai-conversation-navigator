// ============================================================
// MODULE: Group C — Settings Panel
// VERSION: v10.4
// DEPENDS ON: Phase 0 (i18n, loadSettings, saveSettings, showToast, ACN_VERSION,
//             DEFAULT_SETTINGS, SUPPORTED_LANGUAGES)
//             Orbital core (orbMode, orbScrollInverted, orbSetMode, orbSaveSettings,
//             createElement, orbBuildPanelHeader, platform)
// REPLACES: orbBuildPanelSettings() entirely
// ============================================================

/*
## v10.4 Changelog

### Added
- Language selector with SUPPORTED_LANGUAGES dropdown
- Platform toggles now functional with GM_setValue persistence via saveSettings()
- Three lockout prevention rules:
    Rule A: Can't disable current platform (🔒 visual lock + toast on click)
    Rule B: Can't disable the last enabled platform (toast on click)
    Rule C: Changes take effect after page refresh (info note below platform toggles)
- 🔒 visual lock indicator on current platform toggle
- Reset button with confirm() dialog — resets language, platforms, mode, scroll direction
- Dynamic version number sourced from ACN_VERSION constant
- GitHub link in About section using acn-about-link class
- All user-visible strings run through i18n()

### Changed
- orbBuildPanelSettings() completely rewritten
- Platform toggles are now wired to persistent settings instead of being purely visual

### CSS additions required (append to orbInjectCSS array before .join('')):
    '.acn-toggle-locked{opacity:.4;cursor:not-allowed}'
    '.acn-plat-lock{font-size:10px;margin-left:4px;vertical-align:middle}'
    '.acn-about-link{color:var(--acn-accent);font-size:12px;text-decoration:none;display:block;margin-top:4px}'
    '.acn-about-link:hover{text-decoration:underline}'
    '.acn-set-refresh-note{font-size:11px;color:#666;margin-top:6px;font-style:italic}'

### Troubleshooting Log
- The existing orbSaveSettings() persists only orbMode and orbScrollInverted to localStorage
  (_acnv10). This is intentional and unchanged. Language and platform toggles persist via
  saveSettings() which uses GM_setValue('acn-settings', ...). Both can coexist because they
  write to separate storage keys.
- The reset handler rebuilds the DOM selects in-place (modeSel.value, dirSel.value) so the
  panel does not need to be re-opened to show the reset state.
- isCurrent detection uses platform.id (the detected platform object from detectPlatform()).
  If platform is not in the platList (e.g. an app builder), the lock simply won't match any
  entry, which is the correct behaviour — no lockout occurs on non-listed platforms.
*/

// --- REPLACE: orbBuildPanelSettings ---
function orbBuildPanelSettings() {
    var panel = createElement('div', { id: 'acn-panel-settings', className: 'acn-panel' });
    panel.appendChild(orbBuildPanelHeader('\u2699 ' + i18n('settings')));

    var scroll = createElement('div', { className: 'acn-set-scroll' });

    // ── Display group ──────────────────────────────────────────────
    var dispGroup = createElement('div', { className: 'acn-set-group' });
    dispGroup.appendChild(createElement('div', {
        className: 'acn-set-gtitle',
        textContent: i18n('display'),
    }));

    // Mode selector
    var modeSel = createElement('select', { id: 'acn-mode-sel', className: 'acn-set-sel' });
    [['show-all', 'Show all'], ['arc', 'Arc'], ['wheel', 'Wheel']].forEach(function (opt) {
        var o = createElement('option', { value: opt[0] }, [opt[1]]);
        if (opt[0] === orbMode) o.setAttribute('selected', '');
        modeSel.appendChild(o);
    });
    modeSel.addEventListener('change', function () { orbSetMode(modeSel.value); });
    dispGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
        createElement('div', { className: 'acn-set-label', textContent: i18n('orbitalMode') }),
        modeSel,
    ]));

    // Scroll direction
    var dirSel = createElement('select', { id: 'acn-dir-sel', className: 'acn-set-sel' });
    [['standard', i18n('standard')], ['natural', i18n('natural')]].forEach(function (opt) {
        var o = createElement('option', { value: opt[0] }, [opt[1]]);
        if ((opt[0] === 'natural') === orbScrollInverted) o.setAttribute('selected', '');
        dirSel.appendChild(o);
    });
    dirSel.addEventListener('change', function () {
        orbScrollInverted = dirSel.value === 'natural';
        orbSaveSettings();
    });
    dispGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
        createElement('div', { className: 'acn-set-label', textContent: i18n('scrollDirection') }),
        dirSel,
    ]));

    scroll.appendChild(dispGroup);

    // ── Language group ─────────────────────────────────────────────
    var langGroup = createElement('div', { className: 'acn-set-group' });
    langGroup.appendChild(createElement('div', {
        className: 'acn-set-gtitle',
        textContent: i18n('language'),
    }));

    var settings = loadSettings();

    var langSel = createElement('select', { id: 'acn-lang-sel', className: 'acn-set-sel' });
    SUPPORTED_LANGUAGES.forEach(function (lang) {
        var o = createElement('option', { value: lang.code }, [lang.label]);
        if (lang.code === settings.language) o.setAttribute('selected', '');
        langSel.appendChild(o);
    });
    langSel.addEventListener('change', function () {
        var s = loadSettings();
        s.language = langSel.value;
        saveSettings(s);
        showToast(i18n('languageChanged'));
    });
    langGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
        createElement('div', { className: 'acn-set-label', textContent: i18n('language') }),
        langSel,
    ]));

    scroll.appendChild(langGroup);

    // ── Platforms group ────────────────────────────────────────────
    var platGroup = createElement('div', { className: 'acn-set-group' });
    platGroup.appendChild(createElement('div', {
        className: 'acn-set-gtitle',
        textContent: i18n('platforms'),
    }));

    var platList = [
        { id: 'claude',     name: 'Claude',     icon: '\u2733', color: '#d97706' },
        { id: 'chatgpt',    name: 'ChatGPT',    icon: '\u23e3', color: '#ffffff' },
        { id: 'grok',       name: 'Grok',       icon: 'X',      color: '#e53e3e' },
        { id: 'gemini',     name: 'Gemini',     icon: '\u2726', color: '#4285f4' },
        { id: 'perplexity', name: 'Perplexity', icon: '\u2733', color: '#20b2aa' },
    ];

    // Snapshot the current platform id once — platform is set at detection time and never changes
    var currentPlatformId = (platform && platform.id) ? platform.id : '';

    platList.forEach(function (p) {
        var platformId = p.id;
        var isCurrent  = platformId === currentPlatformId;

        // Re-read settings fresh so the snapshot reflects what's actually persisted
        var platSettings = loadSettings();
        // A platform is enabled when its value is anything other than explicit false
        var isEnabled = platSettings.platforms[platformId] !== false;

        // Icon element
        var iconEl = createElement('span', {
            className: 'acn-plat-icon',
            style: 'color:' + p.color,
            textContent: p.icon,
        });

        // Name element, plus a lock indicator if this is the current platform
        var nameEl = createElement('span', {
            className: 'acn-plat-name',
            textContent: p.name,
        });
        if (isCurrent) {
            var lockEl = createElement('span', {
                className: 'acn-plat-lock',
                textContent: '\uD83D\uDD12', // 🔒
            });
            nameEl.appendChild(lockEl);
        }

        // Toggle pill
        var tog = createElement('div', {
            className: 'acn-toggle' + (isEnabled ? ' acn-on' : '') +
                       (isCurrent ? ' acn-toggle-locked' : ''),
        });

        tog.addEventListener('click', function () {
            // Rule A: can't disable the currently active platform
            if (isCurrent) {
                showToast(i18n('cantDisableCurrent'));
                return;
            }

            // Rule B: must keep at least one platform enabled
            var currentSettings = loadSettings();
            var enabledCount = Object.keys(currentSettings.platforms).filter(function (k) {
                return currentSettings.platforms[k] !== false;
            }).length;
            var currentlyEnabled = currentSettings.platforms[platformId] !== false;

            if (currentlyEnabled && enabledCount <= 1) {
                showToast(i18n('mustHaveOnePlatform'));
                return;
            }

            // Toggle the state in the persisted settings
            var newState = !currentlyEnabled;
            currentSettings.platforms[platformId] = newState;
            tog.classList.toggle('acn-on', newState);
            saveSettings(currentSettings);

            // Rule C: inform user that the change needs a refresh
            showToast(i18n('refreshToApply'));
        });

        platGroup.appendChild(createElement('div', { className: 'acn-plat-row' },
            [iconEl, nameEl, tog]));
    });

    // Refresh-to-apply note beneath the platform list
    platGroup.appendChild(createElement('div', {
        className: 'acn-set-refresh-note',
        textContent: i18n('refreshToApply'),
    }));

    scroll.appendChild(platGroup);

    // ── About group ────────────────────────────────────────────────
    var aboutGroup = createElement('div', { className: 'acn-set-group' });
    aboutGroup.appendChild(createElement('div', {
        className: 'acn-set-gtitle',
        textContent: i18n('about'),
    }));

    // Dynamic version string
    aboutGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
        createElement('div', {
            className: 'acn-set-label',
            style: 'color:#777',
            textContent: 'AI Conversation Navigator v' + ACN_VERSION,
        }),
    ]));

    // GitHub link
    var ghLink = createElement('a', {
        className: 'acn-about-link',
        textContent: 'github.com/joonj14/ai-conversation-navigator',
    });
    ghLink.setAttribute('href', 'https://github.com/joonj14/ai-conversation-navigator');
    ghLink.setAttribute('target', '_blank');
    ghLink.setAttribute('rel', 'noopener noreferrer');
    aboutGroup.appendChild(ghLink);

    // Reset button
    var resetBtn = createElement('button', {
        className: 'acn-reset-btn',
        textContent: i18n('resetToDefault'),
    });
    resetBtn.addEventListener('click', function () {
        if (!confirm(i18n('resetConfirm'))) return;

        // Reset mode and scroll direction via orbital save path
        orbSetMode('show-all');
        orbScrollInverted = false;
        orbSaveSettings();

        // Reset language and platforms via GM_setValue path
        var fresh = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        saveSettings(fresh);

        // Sync the in-panel selects so they show the reset state immediately
        var modSelEl = document.getElementById('acn-mode-sel');
        if (modSelEl) modSelEl.value = 'show-all';

        var dirSelEl = document.getElementById('acn-dir-sel');
        if (dirSelEl) dirSelEl.value = 'standard';

        var langSelEl = document.getElementById('acn-lang-sel');
        if (langSelEl) langSelEl.value = DEFAULT_SETTINGS.language;

        // Re-sync platform toggles to the default (all on).
        // querySelectorAll returns rows in DOM order matching platList order.
        var rows = platGroup.querySelectorAll('.acn-plat-row');
        platList.forEach(function (p, idx) {
            if (rows[idx]) {
                var togEl = rows[idx].querySelector('.acn-toggle');
                if (togEl) togEl.classList.add('acn-on');
            }
        });

        showToast(i18n('resetComplete'));
    });
    aboutGroup.appendChild(resetBtn);

    scroll.appendChild(aboutGroup);

    panel.appendChild(scroll);
    return panel;
}

// ============================================================
// INTEGRATION NOTES FOR THE INTEGRATION AGENT
// ============================================================
//
// 1. FUNCTION TO REPLACE
//    Find the function signature:
//        function orbBuildPanelSettings() {
//    starting at approximately line 2190 and ending at the closing brace on
//    approximately line 2274. Replace the entire function body (including the
//    opening and closing braces) with the orbBuildPanelSettings() defined above.
//
// 2. CSS TO APPEND
//    In orbInjectCSS(), locate the css array that ends with:
//        '.acn-reset-btn:hover{background:rgba(239,68,68,.15)}'
//    and append the following entries BEFORE the closing ].join('') call:
//
//        '.acn-toggle-locked{opacity:.4;cursor:not-allowed}',
//        '.acn-plat-lock{font-size:10px;margin-left:4px;vertical-align:middle}',
//        '.acn-about-link{color:var(--acn-accent);font-size:12px;text-decoration:none;display:block;margin-top:4px}',
//        '.acn-about-link:hover{text-decoration:underline}',
//        '.acn-set-refresh-note{font-size:11px;color:#666;margin-top:6px;font-style:italic}',
//
//    The existing CSS for .acn-plat-row, .acn-plat-icon and .acn-plat-name that
//    is already present in the array does NOT need to change.
//
// 3. NO CHANGES NEEDED TO
//    - orbLoadSettings() / orbSaveSettings()  (still used for mode + scroll direction)
//    - loadSettings() / saveSettings()        (used for language + platforms)
//    - Any other function — this module is self-contained.
