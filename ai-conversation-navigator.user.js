// ==UserScript==
// @name         AI Conversation Navigator
// @namespace    http://tampermonkey.net/
// @version      12.0
// @description  Orbital navigation interface for AI chat platforms — Claude, ChatGPT, Grok, Gemini, Bolt, Lovable, Replit, V0, Base44, Emergent, Perplexity, and Firebase Studio
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://grok.com/*
// @match        https://gemini.google.com/*
// @match        https://bolt.new/*
// @match        https://lovable.dev/*
// @match        https://replit.com/*
// @match        https://v0.app/*
// @match        https://app.base44.com/*
// @match        https://app.emergent.sh/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://studio.firebase.google.com/*
// @match        https://*.cloudworkstations.dev/*
// @include      https://*cloudworkstations.dev/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      claude.ai
// ==/UserScript==

(function () {
    'use strict';

    // === DUPLICATE EXECUTION GUARD ===
    if (window._aiNavAlreadyLoaded) {
        console.log('AI Nav: Script already loaded, skipping duplicate execution.');
        return;
    }
    window._aiNavAlreadyLoaded = true;

    // ============================================================
    // VERSION
    // ============================================================
    var ACN_VERSION = '12.0';

    // ============================================================
    // i18n — internationalization string table
    // ============================================================
    var I18N = {
        en: {
            navigate: 'Navigate',
            search: 'Search',
            bookmarks: 'Bookmarks',
            summary: 'Summary',
            tools: 'Tools',
            settings: 'Settings',
            questionPrefix: 'Q#',
            noQuestions: 'No questions detected yet',
            searchPlaceholder: 'Search conversation...',
            searchResults: '{count} matches',
            searchInQuestions: 'in questions',
            searchInResponses: 'in responses',
            noBookmarks: 'No bookmarks yet',
            bookmarkAdded: 'Bookmark added',
            bookmarkRemoved: 'Bookmark removed',
            generateSummary: 'Generate Summary',
            regenerateSummary: 'Regenerate Summary',
            analyzing: 'Analyzing...',
            summaryDisclaimer: "Pattern matching, not AI. For a real summary, just ask \u2014 you're literally inside one!",
            conversationMap: 'Conversation Map',
            topics: 'Topics',
            keyPoints: 'Key Points',
            stats: 'Stats',
            summaryLanguageNote: '',
            imageGallery: 'Image Gallery',
            noImages: 'No images in this conversation',
            goToMessage: 'Go to message',
            downloadImage: 'Download image',
            imageDownloaded: 'Image downloaded',
            openedInNewTab: 'Opened in new tab \u2014 right-click to save',
            exportFull: 'Full Conversation',
            exportFullDesc: 'Markdown with all messages',
            exportBookmarks: 'Bookmarks Only',
            exportBookmarksDesc: 'Pinned messages as document',
            exportSummary: 'Summary',
            exportSummaryDesc: 'Topics, map, key points',
            noBookmarksToExport: 'No bookmarks in this conversation',
            moreToolsSoon: 'More tools coming soon.\nGot ideas? Open an issue on GitHub!',
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
            languageChanged: 'Language updated \u2014 refresh to apply',
            session: 'Session',
            weekly: 'Weekly',
            usageUnavailable: 'Usage data unavailable',
            commands: 'Commands',
            newCommand: 'New command',
            commandName: 'Command name',
            commandText: 'Command text',
            saveCommand: 'Save',
            deleteCommand: 'Delete',
            noCommands: 'No commands saved yet',
            commandPalette: 'Commands',
            insertCommand: 'Insert',
        },
        ko: {
            navigate: '\ud0d0\uc0c9',
            search: '\uac80\uc0c9',
            bookmarks: '\ubd81\ub9c8\ud06c',
            summary: '\uc694\uc57d',
            tools: '\ub3c4\uad6c',
            settings: '\uc124\uc815',
            questionPrefix: 'Q#',
            noQuestions: '\uc544\uc9c1 \uac10\uc9c0\ub41c \uc9c8\ubb38\uc774 \uc5c6\uc2b5\ub2c8\ub2e4',
            searchPlaceholder: '\ub300\ud654 \uac80\uc0c9...',
            searchResults: '{count}\uac1c \uc77c\uce58',
            searchInQuestions: '\uc9c8\ubb38\uc5d0\uc11c',
            searchInResponses: '\uc751\ub2f5\uc5d0\uc11c',
            noBookmarks: '\uc544\uc9c1 \ubd81\ub9c8\ud06c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4',
            bookmarkAdded: '\ubd81\ub9c8\ud06c \ucd94\uac00\ub428',
            bookmarkRemoved: '\ubd81\ub9c8\ud06c \uc0ad\uc81c\ub428',
            generateSummary: '\uc694\uc57d \uc0dd\uc131',
            regenerateSummary: '\uc694\uc57d \ub2e4\uc2dc \uc0dd\uc131',
            analyzing: '\ubd84\uc11d \uc911...',
            summaryDisclaimer: '\ud328\ud134 \ub9e4\uce6d \uae30\ubc18\uc774\uba70 AI\uac00 \uc544\ub2d9\ub2c8\ub2e4. \uc9c4\uc9dc \uc694\uc57d\uc740 AI\uc5d0\uac8c \uc9c1\uc811 \ubb3c\uc5b4\ubcf4\uc138\uc694!',
            conversationMap: '\ub300\ud654 \uc9c0\ub3c4',
            topics: '\uc8fc\uc81c',
            keyPoints: '\uc8fc\uc694 \ud3ec\uc778\ud2b8',
            stats: '\ud1b5\uacc4',
            summaryLanguageNote: '\u2139\ufe0f \uc694\uc57d \ubd84\uc11d\uc740 \uc601\uc5b4 \ub300\ud654\uc5d0\uc11c \uac00\uc7a5 \uc798 \uc791\ub3d9\ud569\ub2c8\ub2e4.',
            imageGallery: '\uc774\ubbf8\uc9c0 \uac24\ub7ec\ub9ac',
            noImages: '\uc774 \ub300\ud654\uc5d0 \uc774\ubbf8\uc9c0\uac00 \uc5c6\uc2b5\ub2c8\ub2e4',
            goToMessage: '\uba54\uc2dc\uc9c0\ub85c \uc774\ub3d9',
            downloadImage: '\uc774\ubbf8\uc9c0 \ub2e4\uc6b4\ub85c\ub4dc',
            imageDownloaded: '\uc774\ubbf8\uc9c0 \ub2e4\uc6b4\ub85c\ub4dc \uc644\ub8cc',
            openedInNewTab: '\uc0c8 \ud0ed\uc5d0\uc11c \uc5f4\ub9bc \u2014 \uc6b0\ud074\ub9ad\ud558\uc5ec \uc800\uc7a5',
            exportFull: '\uc804\uccb4 \ub300\ud654',
            exportFullDesc: '\ubaa8\ub4e0 \uba54\uc2dc\uc9c0\ub97c \ub9c8\ud06c\ub2e4\uc6b4\uc73c\ub85c',
            exportBookmarks: '\ubd81\ub9c8\ud06c\ub9cc',
            exportBookmarksDesc: '\uace0\uc815\ub41c \uba54\uc2dc\uc9c0\ub97c \ubb38\uc11c\ub85c',
            exportSummary: '\uc694\uc57d',
            exportSummaryDesc: '\uc8fc\uc81c, \uc9c0\ub3c4, \uc8fc\uc694 \ud3ec\uc778\ud2b8',
            noBookmarksToExport: '\uc774 \ub300\ud654\uc5d0 \ubd81\ub9c8\ud06c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4',
            moreToolsSoon: '\ub354 \ub9ce\uc740 \ub3c4\uad6c\uac00 \uacf3 \ucd94\uac00\ub429\ub2c8\ub2e4.\n\uc544\uc774\ub514\uc5b4\uac00 \uc788\uc73c\uc2dc\uba74 GitHub\uc5d0\uc11c \uc774\uc288\ub97c \uc5f4\uc5b4\uc8fc\uc138\uc694!',
            display: '\ub514\uc2a4\ud50c\ub808\uc774',
            orbitalMode: '\uc624\ube44\ud0c8 \ubaa8\ub4dc',
            scrollDirection: '\uc2a4\ud06c\ub864 \ubc29\ud5a5',
            standard: '\ud45c\uc900',
            natural: '\uc790\uc5f0',
            language: '\uc5b8\uc5b4',
            platforms: '\ud50c\ub7ab\ud3fc',
            cantDisableCurrent: '\ud604\uc7ac \uc0ac\uc6a9 \uc911\uc778 \ud50c\ub7ab\ud3fc\uc740 \ube44\ud65c\uc131\ud654\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4',
            mustHaveOnePlatform: '\ucd5c\uc18c \ud558\ub098\uc758 \ud50c\ub7ab\ud3fc\uc774 \ud65c\uc131\ud654\ub418\uc5b4 \uc788\uc5b4\uc57c \ud569\ub2c8\ub2e4',
            refreshToApply: '\ubcc0\uacbd\uc0ac\ud56d\uc740 \ud398\uc774\uc9c0 \uc0c8\ub85c\uace0\uce68 \ud6c4 \uc801\uc6a9\ub429\ub2c8\ub2e4',
            about: '\uc815\ubcf4',
            resetToDefault: '\uae30\ubcf8\uac12\uc73c\ub85c \ucd08\uae30\ud654',
            resetConfirm: '\ubaa8\ub4e0 \uc124\uc815\uc744 \uae30\ubcf8\uac12\uc73c\ub85c \ucd08\uae30\ud654\ud558\uc2dc\uac4c\uc2b5\ub2c8\uae4c?',
            resetComplete: '\uc124\uc815\uc774 \uae30\ubcf8\uac12\uc73c\ub85c \ucd08\uae30\ud654\ub418\uc5c8\uc2b5\ub2c8\ub2e4',
            languageChanged: '\uc5b8\uc5b4\uac00 \ubcc0\uacbd\ub428 \u2014 \uc0c8\ub85c\uace0\uce68\ud558\uc5ec \uc801\uc6a9',
            session: '\uc138\uc158',
            weekly: '\uc8fc\uac04',
            usageUnavailable: '\uc0ac\uc6a9\ub7c9 \ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc62c \uc218 \uc5c6\uc2b5\ub2c8\ub2e4',
            commands: '\ucee4\ub9e8\ub4dc',
            newCommand: '\uc0c8 \ucee4\ub9e8\ub4dc',
            commandName: '\ucee4\ub9e8\ub4dc \uc774\ub984',
            commandText: '\ucee4\ub9e8\ub4dc \ud14d\uc2a4\ud2b8',
            saveCommand: '\uc800\uc7a5',
            deleteCommand: '\uc0ad\uc81c',
            noCommands: '\uc800\uc7a5\ub41c \ucee4\ub9e8\ub4dc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4',
            commandPalette: '\ucee4\ub9e8\ub4dc',
            insertCommand: '\uc0bd\uc785',
        }
    };

    function i18n(key, replacements) {
        var lang = 'en';
        try { lang = GM_getValue('acn-settings', {}).language || 'en'; } catch(e) {}
        var str = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
        if (replacements) {
            Object.keys(replacements).forEach(function (k) {
                str = str.replace('{' + k + '}', replacements[k]);
            });
        }
        return str;
    }

    // ============================================================
    // Settings storage
    // ============================================================
    var DEFAULT_SETTINGS = {
        orbMode: 'show-all',
        scrollInverted: false,
        language: 'en',
        platforms: {
            claude: true,
            chatgpt: true,
            grok: true,
            gemini: true,
            perplexity: true
        }
    };

    var SUPPORTED_LANGUAGES = [
        { code: 'en', label: 'English' },
        { code: 'ko', label: '\ud55c\uad6d\uc5b4' }
    ];

    function loadSettings() {
        var stored = {};
        try { stored = GM_getValue('acn-settings', {}); } catch(e) {}
        var settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        if (stored.orbMode) settings.orbMode = stored.orbMode;
        if (stored.scrollInverted !== undefined) settings.scrollInverted = stored.scrollInverted;
        if (stored.language) settings.language = stored.language;
        if (stored.platforms) {
            Object.keys(stored.platforms).forEach(function (key) {
                settings.platforms[key] = stored.platforms[key];
            });
        }
        return settings;
    }

    function saveSettings(settings) {
        try { GM_setValue('acn-settings', settings); } catch(e) {}
    }

    // ================================================================
    // PLATFORMS REGISTRY
    // ================================================================
    var PLATFORMS = {
        claude: {
            id: 'claude',
            title: 'Claude',
            match: function (host) { return host.includes('claude.ai'); },
            theme: { accent: '#d97706', accentHover: '#b45309', accentLight: 'rgba(217, 119, 6, 0.2)' },
            icon: '\u2733',
            layout: 'standard',
            useOrbital: true,
            virtualScroll: false,
            spa: false,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            // v12.0 selector refresh — re-inspected live July 2026.
            // Claude removed data-testid="user-human-turn" from the turn wrapper and
            // moved data-testid="user-message" onto the INNER content node. Measured
            // live: user-human-turn 0, user-message 3, .font-user-message 0,
            // user_message 0, [data-testid$="-turn"] 0. Both chains were surviving on
            // a single link. Note .font-user-message stopped matching because the class
            // is now !font-user-message (Tailwind important prefix), which needs
            // escaping in a selector. See DOM-REFERENCE.md.
            getUserMessages: function () {
                var messages = document.querySelectorAll('[data-testid="user-message"]');
                if (messages.length === 0) messages = document.querySelectorAll('[data-testid="user-human-turn"]');
                if (messages.length === 0) messages = document.querySelectorAll('.\\!font-user-message, .font-user-message');
                if (messages.length === 0) messages = document.querySelectorAll('[data-testid="user_message"]');
                if (messages.length === 0) {
                    var bubbles = document.querySelectorAll(
                        'div.bg-bg-300.rounded-xl, div.bg-bg-300.rounded-lg, div.bg-bg-200.rounded-lg');
                    messages = Array.from(bubbles).filter(function (bubble) {
                        return bubble.closest('.items-end');
                    });
                }
                return messages;
            },
            getAIMessages: function () {
                // .font-claude-response is the only live link as of July 2026 (5 mounted);
                // every other entry below measured 0 and is retained as insurance.
                var messages = document.querySelectorAll('.font-claude-response');
                if (messages.length === 0) messages = document.querySelectorAll('.\\!font-claude-response');
                if (messages.length === 0) messages = document.querySelectorAll('[data-testid="ai-turn"]');
                if (messages.length === 0) messages = document.querySelectorAll('[data-testid="assistant-message"]');
                if (messages.length === 0) messages = document.querySelectorAll('.font-claude-message');
                if (messages.length === 0) {
                    var allTurns = document.querySelectorAll('[data-testid$="-turn"]');
                    messages = Array.from(allTurns).filter(function (el) {
                        return !el.getAttribute('data-testid').includes('human');
                    });
                }
                return messages;
            },
            // Claude.ai serves uploaded files from its own API endpoint.
            // As of March 2026, thumbnails are rendered in a hidden FILES PANEL
            // (div.w-0, opacity-0) that is separate from the conversation turn
            // elements returned by getUserMessages(). Per-message querySelectorAll
            // finds nothing; imageSelectorScope:'document' queries the full page.
            getMessageContext: function (msgEl) {
                var inner = msgEl.closest('.group');
                if (!inner) return msgEl;
                var outer = inner.parentElement ? inner.parentElement.closest('.group') : null;
                return outer || inner;
            },
            imageSelector: 'img[src*="/api/"][src*="/files/"]',
            imageSelectorScope: 'document',
            // Files panel is hidden (opacity-0); unassociated images have no usable
            // scroll target — the image element itself is inside the hidden container.
            imagesOrphaned: true,
        },

        chatgpt: {
            id: 'chatgpt',
            title: 'ChatGPT',
            match: function (host) { return host.includes('chatgpt.com') || host.includes('chat.openai.com'); },
            theme: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)' },
            icon: '\u23E3',
            layout: 'standard',
            useOrbital: true,
            virtualScroll: false,
            spa: false,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var allMessages = document.querySelectorAll('[data-message-author-role]');
                var messages = Array.from(allMessages).filter(function (msg) {
                    return msg.getAttribute('data-message-author-role') === 'user';
                });
                if (messages.length === 0) {
                    messages = document.querySelectorAll('div.self-end.bg-token-bg-tertiary');
                }
                return messages;
            },
            getAIMessages: function () {
                var allMessages = document.querySelectorAll('[data-message-author-role]');
                var messages = Array.from(allMessages).filter(function (msg) {
                    return msg.getAttribute('data-message-author-role') === 'assistant';
                });
                if (messages.length === 0) {
                    messages = Array.from(document.querySelectorAll('.markdown.prose')).filter(function (el) {
                        return !el.closest('.bg-token-bg-tertiary');
                    });
                }
                return messages;
            },
            // As of March 2026 ChatGPT serves uploaded images from its own backend
            // proxy (chatgpt.com/backend-api/estuary/content) rather than the old
            // files.oaiusercontent.com CDN. Images remain inside the user message
            // element so per-message scoping still works; only the selector changed.
            imageSelector: 'img[src*="backend-api/estuary/content"]',
        },

        grok: {
            id: 'grok',
            title: 'Grok',
            match: function (host) { return host.includes('grok.com'); },
            theme: { accent: '#dc2626', accentHover: '#b91c1c', accentLight: 'rgba(220, 38, 38, 0.2)' },
            icon: 'X',
            layout: 'standard',
            useOrbital: true,
            virtualScroll: false,
            spa: false,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var allBubbles = document.querySelectorAll('div.message-bubble');
                var messages = [];
                if (allBubbles.length > 0) {
                    messages = Array.from(allBubbles).filter(function (bubble, index) {
                        var classList = bubble.className.toLowerCase();
                        if (classList.includes('user') || classList.includes('human')) return true;
                        var parent = bubble.closest('[class*="user"], [class*="human"], [data-role="user"]');
                        if (parent) return true;
                        return index % 2 === 0;
                    });
                }
                if (messages.length === 0) messages = document.querySelectorAll('[data-role="user"]');
                if (messages.length === 0) messages = document.querySelectorAll('[class*="user-message"]');
                return messages;
            },
            getAIMessages: function () {
                var allBubbles = document.querySelectorAll('div.message-bubble');
                var messages = [];
                if (allBubbles.length > 0) {
                    messages = Array.from(allBubbles).filter(function (bubble, index) {
                        var classList = bubble.className.toLowerCase();
                        if (classList.includes('assistant') || classList.includes('bot') || classList.includes('ai')) return true;
                        var parent = bubble.closest('[class*="assistant"], [class*="bot"], [data-role="assistant"]');
                        if (parent) return true;
                        return index % 2 === 1;
                    });
                }
                if (messages.length === 0) messages = Array.from(document.querySelectorAll('[data-role="assistant"]'));
                return messages;
            },
            // Uploaded images are hosted on assets.grok.com; object-cover class excludes profile pictures.
            // imageSelectorScope:'document' needed because Grok places uploaded images outside
            // div.message-bubble (they live in div#response-* / div#last-reply-container).
            imageSelector: 'img[src*="assets.grok.com"][class*="object-cover"]',
            imageSelectorScope: 'document',
        },

        gemini: {
            id: 'gemini',
            title: 'Gemini',
            match: function (host) { return host.includes('gemini.google.com'); },
            theme: { accent: '#4285f4', accentHover: '#3367d6', accentLight: 'rgba(66, 133, 244, 0.2)' },
            icon: '\u2726',
            layout: 'standard',
            useOrbital: true,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var messages = document.querySelectorAll('div.query-text');
                if (messages.length === 0) messages = document.querySelectorAll('.query-text-line');
                if (messages.length === 0) messages = document.querySelectorAll('p.query-text-line');
                if (messages.length === 0) messages = document.querySelectorAll('[data-query-text]');
                if (messages.length === 0) messages = document.querySelectorAll('.user-query');
                return messages;
            },
            getAIMessages: function () {
                var messages = document.querySelectorAll('div.model-response-text');
                if (messages.length === 0) messages = document.querySelectorAll('.response-content');
                if (messages.length === 0) messages = document.querySelectorAll('model-response');
                if (messages.length === 0) {
                    var allContent = document.querySelectorAll('.conversation-container > div');
                    messages = Array.from(allContent).filter(function (el) {
                        return !el.querySelector('.query-text') && el.textContent.trim().length > 0;
                    });
                }
                return messages;
            },
            // Angular test attribute — stable across DOM updates (verified March 12, 2026).
            // imageSelectorScope:'document' needed because uploaded images live in user-query →
            // user-query-file-carousel, which is a sibling of div.query-text (getUserMessages target),
            // not a descendant — per-message querySelectorAll would find nothing.
            imageSelector: 'img[data-test-id="uploaded-img"]',
            imageSelectorScope: 'document',
        },

        bolt: {
            id: 'bolt',
            title: 'Bolt',
            match: function (host) { return host === 'bolt.new'; },
            theme: { accent: '#38BDF8', accentHover: '#0EA5E9', accentLight: 'rgba(56, 189, 248, 0.2)' },
            icon: '\u26A1\uFE0E',
            layout: 'left-chat',
            useOrbital: false,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 16,
            boundarySelectors: '[class*="bg-bolt-elements-messages-background"], [class*="max-w-chat"], [class*="_Chat_"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var messages = [];
                var boltMsgAll = document.querySelectorAll('[data-message-id]');
                if (boltMsgAll.length > 0) {
                    messages = Array.from(boltMsgAll).filter(function (el) {
                        var cls = el.className || '';
                        var isSelfEnd = cls.includes('self-end') || el.querySelector('.self-end');
                        var isBoltUserBg = cls.includes('bg-bolt-elements-messages');
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return (isSelfEnd || isBoltUserBg) && !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var boltSelfEnd = document.querySelectorAll('.self-end[class*="bg-bolt-elements"], [class*="bg-bolt-elements-messages-background"]');
                    messages = Array.from(boltSelfEnd).filter(function (el) {
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var boltMarkdown = document.querySelectorAll('[class*="_MarkdownContent_"]');
                    messages = Array.from(boltMarkdown).filter(function (el) {
                        var userParent = el.closest('.self-end, [class*="bg-bolt-elements-messages"]');
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return userParent && !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var boltCandidates = document.querySelectorAll('[class*="bg-bolt-elements-messages-background"]');
                    if (boltCandidates.length > 0) {
                        messages = Array.from(boltCandidates).filter(function (el) {
                            var cls = el.className || '';
                            if (cls.includes('w-full')) return false;
                            if (cls.includes('items-start') && cls.includes('gap-')) return false;
                            var parent = el.closest('[class*="items-start"][class*="gap-"]');
                            if (parent && parent !== el) return false;
                            var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                            return !isPromptArea && el.textContent.trim().length > 0;
                        });
                    }
                }
                if (messages.length === 0) {
                    var mlAutoBubbles = document.querySelectorAll('.ml-auto.rounded-lg, .ml-auto.rounded-xl');
                    messages = Array.from(mlAutoBubbles).filter(function (el) {
                        var cls = el.className || '';
                        if (cls.includes('items-start') && cls.includes('gap-')) return false;
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var gridChildren = document.querySelectorAll('.grid.w-full > div');
                    messages = Array.from(gridChildren).filter(function (el) {
                        var cls = el.className || '';
                        var isAssistant = cls.includes('overflow-hidden') && cls.includes('w-full');
                        var isAlert = cls.includes('items-start') && cls.includes('gap-');
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return !isAssistant && !isAlert && !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                return messages;
            },
            getAIMessages: function () { return []; },
        },

        lovable: {
            id: 'lovable',
            title: 'Lovable',
            match: function (host) { return host.includes('lovable.dev'); },
            theme: { accent: '#9b87f5', accentHover: '#7c3aed', accentLight: 'rgba(155, 135, 245, 0.2)' },
            icon: '\u2665',
            layout: 'left-chat',
            useOrbital: false,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: 'div[role="log"], div.ChatMessageContainer, .justify-end',
            boundaryStrategy: 'walk-up',
            pathGuard: function (path) { return path.includes('/projects/'); },
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var messages = [];
                if (!window.location.pathname.includes('/projects/')) return messages;
                var chatLog = document.querySelector('div[role="log"]');
                if (chatLog) {
                    messages = Array.from(chatLog.querySelectorAll('.justify-end')).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var lovableBubbles = document.querySelectorAll('div.bg-neutral-200.rounded-xl, div.bg-neutral-700.rounded-xl');
                    messages = Array.from(lovableBubbles).filter(function (el) {
                        return el.closest('.justify-end') || el.classList.contains('ml-auto');
                    });
                }
                if (messages.length === 0) {
                    var lovableContainer = document.querySelector('div.ChatMessageContainer');
                    if (lovableContainer) {
                        messages = Array.from(lovableContainer.querySelectorAll('.justify-end')).filter(function (el) {
                            return el.textContent.trim().length > 0;
                        });
                    }
                }
                if (messages.length === 0) {
                    messages = document.querySelectorAll('div.self-end[class*="bg-neutral"]');
                }
                if (messages.length === 0) {
                    var lovableMain = document.querySelector('main');
                    if (lovableMain) {
                        messages = Array.from(lovableMain.querySelectorAll('div')).filter(function (el) {
                            var cls = el.className || '';
                            var isRightAligned = cls.includes('justify-end') || cls.includes('self-end') || cls.includes('ml-auto');
                            var hasText = el.textContent.trim().length > 5;
                            var isNotNav = !el.closest('nav') && !el.closest('header');
                            return isRightAligned && hasText && isNotNav;
                        });
                    }
                }
                return messages;
            },
            getAIMessages: function () { return []; },
        },

        replit: {
            id: 'replit',
            title: 'Replit',
            match: function (host) { return host.includes('replit.com'); },
            theme: { accent: '#F26522', accentHover: '#D4541A', accentLight: 'rgba(242, 101, 34, 0.2)' },
            icon: '\u2815',
            layout: 'left-chat',
            useOrbital: false,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: '[data-cy="user-message"], [data-event-type="user-message"], [role="log"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [{
                // Replit project pages are /@username/project-name.
                // Homepage (/~), profile (/), community pages, etc. are excluded.
                check: function () { return !window.location.pathname.startsWith('/@'); },
                msg: 'Replit: not a project workspace, skipping.'
            }],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var messages = document.querySelectorAll('[data-cy="user-message"]');
                if (messages.length === 0) messages = document.querySelectorAll('[data-event-type="user-message"]');
                if (messages.length === 0) {
                    var replitEventRenderers = document.querySelectorAll('[class*="EventRenderer"][class*="userMessage"]');
                    messages = Array.from(replitEventRenderers).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var replitUserEls = document.querySelectorAll('[class*="userMessage"], [class*="UserMessage"]');
                    var replitFiltered = Array.from(replitUserEls).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                    var replitDeduped = replitFiltered.filter(function (el) {
                        return !replitFiltered.some(function (other) {
                            return other !== el && el.contains(other);
                        });
                    });
                    var replitSeen = {};
                    var replitTextDeduped = [];
                    for (var ri = 0; ri < replitDeduped.length; ri++) {
                        var replitTxt = replitDeduped[ri].textContent.trim();
                        if (replitTxt && !replitSeen[replitTxt]) {
                            replitSeen[replitTxt] = true;
                            replitTextDeduped.push(replitDeduped[ri]);
                        }
                    }
                    if (replitTextDeduped.length > 0) messages = replitTextDeduped;
                }
                if (messages.length === 0) {
                    var replitLog = document.querySelector('[role="log"]');
                    if (!replitLog) replitLog = document.querySelector('[role="list"][aria-label*="chat" i]');
                    if (!replitLog) replitLog = document.querySelector('[aria-label*="Chat" i]');
                    if (replitLog) {
                        var replitBlocks = replitLog.querySelectorAll(':scope > div > div, :scope > div');
                        messages = Array.from(replitBlocks).filter(function (el) {
                            var cls = el.className || '';
                            var style = window.getComputedStyle(el);
                            var isRightAligned = cls.includes('end') || cls.includes('right') ||
                                style.marginLeft === 'auto' || style.alignSelf === 'flex-end';
                            var hasDistinctBg = style.backgroundColor &&
                                style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                                style.backgroundColor !== 'transparent';
                            return (isRightAligned || hasDistinctBg) && el.textContent.trim().length > 0;
                        });
                    }
                }
                return messages;
            },
            getAIMessages: function () { return []; },
        },

        v0: {
            id: 'v0',
            title: 'V0',
            match: function (host) { return host.includes('v0.app'); },
            theme: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)', textColor: '#000', toggleBorder: '1px solid rgba(0,0,0,0.2)' },
            icon: '\u25BD',
            layout: 'left-chat',
            useOrbital: false,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: '[data-testid="message"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var messages = [];
                var v0MsgAll = document.querySelectorAll('[data-testid="message"]');
                if (v0MsgAll.length > 0) {
                    messages = Array.from(v0MsgAll).filter(function (el) {
                        var cls = el.className || '';
                        return cls.includes('origin-right') && cls.includes('items-end');
                    });
                }
                if (messages.length === 0 && v0MsgAll.length > 0) {
                    messages = Array.from(v0MsgAll).filter(function (el) {
                        var cls = el.className || '';
                        return cls.includes('items-end') && !cls.includes('items-start');
                    });
                }
                if (messages.length === 0) {
                    var v0Bubbles = document.querySelectorAll('[class*="bg-v0-gray-200"][class*="message-bubble"], [class*="group/message-bubble"]');
                    messages = Array.from(v0Bubbles).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var v0ListItems = document.querySelectorAll('[role="listitem"]');
                    if (v0ListItems.length > 0) {
                        messages = Array.from(v0ListItems).filter(function (el) {
                            var cls = el.className || '';
                            return (cls.includes('origin-right') || cls.includes('items-end')) &&
                                el.textContent.trim().length > 0;
                        });
                    }
                }
                return messages;
            },
            getAIMessages: function () { return []; },
        },

        base44: {
            id: 'base44',
            title: 'Base44',
            match: function (host) { return host.includes('base44.com'); },
            theme: { accent: '#6366f1', accentHover: '#4f46e5', accentLight: 'rgba(99, 102, 241, 0.2)' },
            icon: '\u2B22',
            layout: 'left-chat',
            useOrbital: false,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: '[id^="message-"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var base44Messages = document.querySelectorAll('[id^="message-"]');
                var messages = Array.from(base44Messages).filter(function (el) {
                    return el.querySelector('.justify-end') && el.textContent.trim().length > 0;
                });
                if (messages.length === 0) {
                    messages = document.querySelectorAll('.bg-slate-200.rounded-xl');
                }
                return messages;
            },
            getAIMessages: function () { return []; },
        },

        emergent: {
            id: 'emergent',
            title: 'Emergent',
            match: function (host) { return host.includes('emergent.sh'); },
            theme: { accent: '#10b981', accentHover: '#059669', accentLight: 'rgba(16, 185, 129, 0.2)' },
            icon: 'e',
            layout: 'left-chat',
            useOrbital: false,
            virtualScroll: true,
            spa: true,
            scrollbarOffset: 14,
            boundarySelectors: '[data-testid^="user-message"], [id^="user-"]',
            boundaryStrategy: 'virtuoso',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: function (msg) { return msg.querySelector('.prose'); },
            getUserMessages: function () {
                var messages = document.querySelectorAll('[data-testid^="user-message"]');
                if (messages.length > 0) {
                    var emergentArr = Array.from(messages);
                    var emergentDeduped = emergentArr.filter(function (el) {
                        return !emergentArr.some(function (other) {
                            return other !== el && el.contains(other);
                        });
                    });
                    if (emergentDeduped.length > 0) messages = emergentDeduped;
                }
                if (messages.length === 0) {
                    messages = document.querySelectorAll('[id^="user-task"]');
                }
                return messages;
            },
            getAIMessages: function () { return []; },
        },

        perplexity: {
            id: 'perplexity',
            title: 'Perplexity',
            match: function (host) { return host.includes('perplexity.ai'); },
            theme: { accent: '#20b8cd', accentHover: '#1a9aab', accentLight: 'rgba(32, 184, 205, 0.2)' },
            icon: '\u2733\uFE0E',
            layout: 'standard',
            useOrbital: true,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            textExtractor: null,
            getUserMessages: function () {
                var perplexityQueries = document.querySelectorAll('.group\\/query');
                var messages = Array.from(perplexityQueries).filter(function (el) {
                    return el.textContent.trim().length > 0;
                });
                if (messages.length === 0) {
                    messages = document.querySelectorAll('.group\\/title .select-text');
                }
                return messages;
            },
            getAIMessages: function () {
                var messages = document.querySelectorAll('[class*="prose"]');
                if (messages.length === 0) messages = document.querySelectorAll('.col-span-8 .prose, .col-span-8 [class*="Answer"]');
                if (messages.length === 0) {
                    var responseBlocks = document.querySelectorAll('[class*="response"], [class*="Result"]');
                    messages = Array.from(responseBlocks).filter(function (el) {
                        return el.textContent.trim().length > 50;
                    });
                }
                return messages;
            },
            // Perplexity attachments are text labels in a dropdown, not inline <img> tags.
            // S3 URLs require programmatic modal clicks to access and have expiry params.
            // Gallery will correctly show "No images in this conversation" on Perplexity.
            imageSelector: null,
        },

        firebase_studio: {
            id: 'firebase_studio',
            title: 'Firebase Studio',
            match: function (host) {
                if (host.includes('studio.firebase.google.com')) return true;
                if (host.includes('cloudworkstations.dev') && host.includes('firebase-studio-')) return true;
                return false;
            },
            theme: { accent: '#FFA611', accentHover: '#F5820D', accentLight: 'rgba(255, 166, 17, 0.2)' },
            icon: '\u2726',
            layout: 'standard',
            useOrbital: false,
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [
                {
                    check: function () {
                        return window === window.top &&
                            window.location.hostname.includes('studio.firebase.google.com');
                    },
                    msg: 'Firebase Studio top frame (shell), deferring to iframe instance.'
                },
                {
                    check: function () {
                        return window.location.hostname.includes('cloudworkstations.dev') &&
                            !window.location.pathname.startsWith('/capra/');
                    },
                    msg: 'Firebase Studio non-workspace iframe (' + window.location.pathname + '), skipping.'
                }
            ],
            retryDelays: [5000, 10000, 20000],
            textExtractor: null,
            getUserMessages: function () {
                var firebaseMessages = document.querySelectorAll('[class*="_chatMessage_"][class*="_isUser_"]');
                var messages = Array.from(firebaseMessages).filter(function (el) {
                    return el.textContent.trim().length > 0;
                });
                if (messages.length === 0) {
                    firebaseMessages = document.querySelectorAll('[class*="_isUser_"]');
                    messages = Array.from(firebaseMessages).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                }
                if (messages.length === 0) {
                    var allFirebaseMessages = document.querySelectorAll('[class*="_chatMessage_"]');
                    messages = Array.from(allFirebaseMessages).filter(function (el) {
                        return (el.className || '').includes('_isUser_') || (el.className || '').includes('isUser');
                    });
                }
                return messages;
            },
            getAIMessages: function () { return []; },
        },
    };

    // ================================================================
    // PLATFORM DETECTION
    // ================================================================
    function detectPlatform() {
        var hostname = window.location.hostname;
        var keys = Object.keys(PLATFORMS);
        for (var i = 0; i < keys.length; i++) {
            if (PLATFORMS[keys[i]].match(hostname)) return PLATFORMS[keys[i]];
        }
        return null;
    }

    var platform = detectPlatform();
    if (!platform) {
        console.log('AI Conversation Navigator: Unknown site, exiting.');
        return;
    }

    function shouldRunOnThisPlatform() {
        if (!platform) return false;
        var settings = loadSettings();
        return settings.platforms[platform.id] !== false;
    }

    if (!shouldRunOnThisPlatform()) {
        console.log('AI Nav: Platform "' + (platform ? platform.id : 'unknown') + '" disabled in settings, skipping.');
        return;
    }

    for (var gi = 0; gi < platform.initGuards.length; gi++) {
        if (platform.initGuards[gi].check()) {
            console.log('AI Conversation Navigator: ' + platform.initGuards[gi].msg);
            return;
        }
    }

    var isLeftChat = platform.layout === 'left-chat';
    var isVirtualScroll = platform.virtualScroll;
    // Orbital system only for platforms with useOrbital: true in the registry.
    // App-builder platforms keep the legacy ghost-notch / right-edge button.
    var useOrbital = !!platform.useOrbital;

    // Wire up Claude SSE interceptor for exact token tracking.
    // _loadCachedSSEData is deferred (setTimeout 0) so it runs after _sseTokenData
    // is initialized further down the file — var hoisting leaves it undefined here.
    if (platform.id === 'claude') {
        setupClaudeSSEInterceptor();
        setTimeout(_loadCachedSSEData, 0);
    }

    // ============================================================
    // DOM CREATION HELPER — no innerHTML (Trusted Types safe)
    // ============================================================
    function createElement(tag, attrs, children) {
        var el = document.createElement(tag);
        if (attrs) {
            var keys = Object.keys(attrs);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i], value = attrs[key];
                if (key === 'className') {
                    el.className = value;
                } else if (key === 'textContent') {
                    el.textContent = value;
                } else if (key.startsWith('on') && typeof value === 'function') {
                    el.addEventListener(key.substring(2).toLowerCase(), value);
                } else {
                    el.setAttribute(key, value);
                }
            }
        }
        if (children) {
            if (!Array.isArray(children)) children = [children];
            for (var j = 0; j < children.length; j++) {
                var child = children[j];
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child) {
                    el.appendChild(child);
                }
            }
        }
        return el;
    }

    // ============================================================
    // TOAST NOTIFICATION UTILITY
    // ============================================================
    function showToast(message) {
        var existing = document.getElementById('acn-toast');
        if (existing) existing.remove();
        var toast = createElement('div', {
            id: 'acn-toast',
            style: 'position:fixed;bottom:80px;right:20px;background:rgba(0,0,0,0.85);color:#fff;' +
                   'padding:8px 14px;border-radius:8px;font-size:13px;z-index:2147483647;' +
                   'pointer-events:none;opacity:1;transition:opacity 0.4s;',
            textContent: message
        });
        document.body.appendChild(toast);
        setTimeout(function () { toast.style.opacity = '0'; }, 2000);
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2500);
    }

    // ============================================================
    // CHAT BOUNDARY DETECTION — left-chat platforms only
    // ============================================================
    function _walkUpToChatContainer(startEl) {
        var el = startEl;
        while (el && el !== document.body) {
            var rect = el.getBoundingClientRect();
            if (rect.width > 200 && rect.width < window.innerWidth * 0.65 &&
                rect.height > window.innerHeight * 0.4) {
                return rect.left > window.innerWidth * 0.4 ? rect.left : rect.right;
            }
            el = el.parentElement;
        }
        return null;
    }

    function getChatBoundaryX() {
        if (!isLeftChat) return null;
        if (platform.pathGuard && !platform.pathGuard(window.location.pathname)) return null;

        if (platform.boundaryStrategy === 'virtuoso') {
            var vs = document.querySelector('[data-testid="virtuoso-scroller"], [data-virtuoso-scroller="true"]');
            if (vs) {
                var vsRect = vs.getBoundingClientRect();
                if (vsRect.width > 200 && vsRect.width < window.innerWidth * 0.75 &&
                    vsRect.height > window.innerHeight * 0.3) {
                    return vsRect.right;
                }
            }
        }

        var inputs = document.querySelectorAll(
            'textarea[placeholder*="message" i], textarea[placeholder*="Message"], ' +
            'textarea[placeholder*="Send" i], textarea[placeholder*="Type" i], ' +
            '[contenteditable="true"][role="textbox"], [contenteditable="true"], ' +
            'textarea[class*="chat"], textarea[class*="prompt"]'
        );
        for (var i = 0; i < inputs.length; i++) {
            var rect = inputs[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth) {
                var b = _walkUpToChatContainer(inputs[i]);
                if (b) return b;
            }
        }

        if (platform.boundarySelectors) {
            var msgEls = document.querySelectorAll(platform.boundarySelectors);
            for (var j = 0; j < msgEls.length; j++) {
                var mRect = msgEls[j].getBoundingClientRect();
                if (mRect.width > 0 && mRect.height > 0 && mRect.right > 0 && mRect.left < window.innerWidth) {
                    var b2 = _walkUpToChatContainer(msgEls[j]);
                    if (b2) return b2;
                }
            }
        }

        var iframes = document.querySelectorAll('iframe');
        for (var k = 0; k < iframes.length; k++) {
            var iRect = iframes[k].getBoundingClientRect();
            if (iRect.left > window.innerWidth * 0.25 && iRect.left < window.innerWidth * 0.75 &&
                iRect.height > window.innerHeight * 0.3 && iRect.width > window.innerWidth * 0.2) {
                return iRect.left;
            }
        }

        return null;
    }

    var _lastBoundaryX = null;
    var _boundaryDetected = false;

    function updateLeftChatPositions() {
        if (!isLeftChat) return;

        var boundaryX = getChatBoundaryX();

        if (!boundaryX) {
            _lastBoundaryX = null;
            _boundaryDetected = false;
            if (useOrbital) { orbApplyZonePosition(); } else { legacyApplyPosition(); }
            return;
        }

        if (_boundaryDetected) {
            if (!_lastBoundaryX || Math.abs(boundaryX - _lastBoundaryX) >= 3) {
                _lastBoundaryX = boundaryX;
                if (useOrbital) { orbApplyZonePosition(); } else { legacyApplyPosition(); }
            }
            return;
        }

        if (_lastBoundaryX && Math.abs(boundaryX - _lastBoundaryX) < 3) {
            _boundaryDetected = true;
            _lastBoundaryX = boundaryX;
            if (useOrbital) { orbApplyZonePosition(); } else { legacyApplyPosition(); }
            return;
        }

        _lastBoundaryX = boundaryX;
    }

    // ============================================================
    // CONVERSATION INDEX — API-backed message enumeration (v12.0)
    // ============================================================
    // WHY THIS EXISTS
    // Claude virtualizes its message list with recycling: only ~3-5 turns are
    // mounted at any moment (measured: 3 mounted of 96 real turns, ~3%).
    // Everything outside that window is unmounted and torn down, so
    // document.querySelectorAll() is no longer a complete record of the
    // conversation. This is not a selector problem and cannot be fixed by
    // changing selectors — it needs a different data source.
    //
    // Claude's own client already downloads the entire conversation as JSON on
    // page load and then chooses to render a window of it. We read that same
    // endpoint. This is an ORDINARY OUTBOUND REQUEST, not fetch interception:
    // it replaces no page global and carries none of the Firefox
    // cross-compartment risk that forced DEC-019 / DEC-020.
    //
    // See DEC-021 and the "Layer 4: State Breaks" section of ROADMAP.md.

    // Root messages carry this sentinel as parent_message_uuid rather than null.
    // The tree walk MUST test for it explicitly — relying on the uuid simply
    // being absent from the message map is an accidental pass-through that
    // would silently break if the API ever returned the root node itself.
    var CI_ROOT_PARENT_UUID = '00000000-0000-4000-8000-000000000000';

    var CI_ORG_CACHE_KEY    = 'acn-claude-org-v1';
    var CI_FETCH_TIMEOUT_MS = 45000;  // 3.3MB payloads measured at ~2.1s foreground
    // Minimum gap between tree-change refetches. Without it, a tree-change signal
    // that survives the refetch would re-trigger on the very next MutationObserver
    // tick — a 3.3MB download every ~500ms. _ciInFlight only prevents CONCURRENT
    // fetches, not a sequential loop.
    var CI_REFETCH_COOLDOWN_MS = 15000;

    // ── Index state ─────────────────────────────────────────────
    var _ciIndex          = null;   // array of human turns, or null when unavailable
    var _ciFullPath       = null;   // full ordered active path (human + assistant), for Export
    var _ciConversationId = null;   // conversation uuid the index was built for
    var _ciStatus         = 'idle'; // 'idle' | 'loading' | 'ready' | 'degraded'
    var _ciDegradedReason = '';     // human-readable, surfaced in the UI
    var _ciTruncatedCount = 0;      // messages on the active path with truncated:true
    var _ciUsedLeafFallback = false;
    var _ciPathComplete   = true;  // false when the tree walk never reached the root sentinel
    var _ciLoadGen        = 0;      // bumped per load: uuid comparison alone cannot
                                    // catch A->B->A, where the STALE A callback still
                                    // sees a matching uuid (Codex R6 :1605)
    var _ciInFlightCid    = null;   // conversation uuid the in-flight load is FOR.
    var _ciInFlightGen    = 0;      // generation that OWNS the marker. A stale callback
                                    // must clear ONLY its own marker: clearing by uuid
                                    // alone would let old-A clobber new-A's marker
                                    // (the R6 race), while never clearing left the
                                    // marker stuck after leaving a chat route, so
                                    // revisiting the SAME uuid could never load again
                                    // without a page reload (Codex R9 :1608).
                                    // A boolean here let a slow request for the OLD
                                    // conversation block every load attempt for the
                                    // newly opened one until timeout (Codex :1570).
    var _ciOrgUuid        = null;
    var _ciLastRefetchAt  = 0;

    // The two real Claude conversation routes, and ONLY those:
    //     /chat/<uuid>
    //     /project/<uuid>/chat/<uuid>
    //
    // Anchoring to ^/chat/ alone left every Project conversation on the DOM-only
    // path AND suppressed its degraded banner (ciIsClaudeChat() was false, so the
    // banner never rendered). But a loose /(?:^|\/)chat\// is the opposite error:
    // it also matches /code/x/chat/<uuid> and any other route containing a "chat"
    // segment, which would enable the index and fire a fetch against an id that is
    // not a conversation. Anchor at the start, allow only the optional project
    // segment, and require a path boundary after the uuid.
    var CI_CHAT_PATH_RE = /^\/(?:project\/[0-9a-f-]{36}\/)?chat\/([0-9a-f-]{36})(?:\/|$)/i;

    function ciIsClaudeChat() {
        return !!(platform && platform.id === 'claude' &&
                  CI_CHAT_PATH_RE.test(window.location.pathname));
    }

    function ciGetConversationUuid() {
        var m = window.location.pathname.match(CI_CHAT_PATH_RE);
        return m ? m[1] : null;
    }

    function ciGetCookie(name) {
        var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
        return m ? decodeURIComponent(m[1]) : null;
    }

    // GM_xmlhttpRequest rather than fetch: this exact transport is already proven
    // against claude.ai in fetchClaudeUsage(), and it keeps the response entirely
    // out of the page realm. The spec's "bare fetch returns 200" was verified in
    // the DevTools console (page realm), NOT the Tampermonkey sandbox — so
    // sandbox-realm fetch is treated as unverified here.
    function ciRequestJSON(url, cb) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            cb(new Error('GM_xmlhttpRequest unavailable'), null, 0);
            return;
        }
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: CI_FETCH_TIMEOUT_MS,
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
            onload: function (res) {
                if (res.status !== 200) {
                    cb(new Error('HTTP ' + res.status), null, res.status);
                    return;
                }
                var data;
                try {
                    data = JSON.parse(res.responseText);
                } catch (e) {
                    cb(new Error('malformed JSON'), null, res.status);
                    return;
                }
                cb(null, data, res.status);
            },
            onerror:   function () { cb(new Error('network error'), null, 0); },
            ontimeout: function () { cb(new Error('timeout'), null, 0); }
        });
    }

    // ── Org UUID resolution ─────────────────────────────────────
    // The conversation uuid is in the URL; the org uuid is not. Resolution is
    // ordered by reliability, and the caller VALIDATES the choice by using it —
    // a wrong org returns 404 on the conversation fetch, which triggers the next
    // candidate. We never probe speculatively: the conversation fetch is needed
    // anyway, so making it the validator costs nothing extra.
    function ciAccountKey() {
        return ciGetCookie('ajs_user_id') || ciGetCookie('lastActiveOrg') || 'default';
    }

    function ciReadCachedOrg() {
        try {
            var raw = GM_getValue(CI_ORG_CACHE_KEY, '');
            if (!raw) return null;
            var o = JSON.parse(raw);
            // Cached per account, not per conversation — the same org serves every
            // conversation the account owns.
            return (o && o.acct === ciAccountKey() && o.org) ? o.org : null;
        } catch (e) { return null; }
    }

    function ciWriteCachedOrg(org) {
        try {
            GM_setValue(CI_ORG_CACHE_KEY, JSON.stringify({ acct: ciAccountKey(), org: org }));
        } catch (e) {}
    }

    // Returns an ordered candidate list via callback. Cheapest, most-likely first.
    function ciResolveOrgCandidates(cb) {
        var candidates = [];
        function add(u) {
            if (u && candidates.indexOf(u) === -1) candidates.push(u);
        }

        add(ciReadCachedOrg());
        add(ciGetCookie('lastActiveOrg'));

        // Sidebar's own request URLs — readable without intercepting anything.
        try {
            var entries = window.performance.getEntriesByType('resource');
            for (var i = 0; i < entries.length; i++) {
                var m = entries[i].name.match(/\/api\/organizations\/([0-9a-f-]{36})/i);
                if (m) add(m[1]);
            }
        } catch (e) {}

        // If the cheap sources produced anything, use them; the caller falls back
        // to the full org list only when every candidate 404s.
        if (candidates.length) { cb(candidates); return; }

        ciRequestJSON('https://claude.ai/api/organizations', function (err, orgs) {
            if (err || !Array.isArray(orgs)) { cb(candidates); return; }
            cb(ciRankOrgs(orgs));
        });
    }

    // Orgs that can hold chats advertise the 'chat' capability. Ranking by it
    // replaces the old orgs[0] positional guess, which silently picked the wrong
    // org for anyone belonging to more than one.
    function ciRankOrgs(orgs) {
        var chatOrgs = [], others = [];
        for (var i = 0; i < orgs.length; i++) {
            var o = orgs[i];
            if (!o || !o.uuid) continue;
            var caps = o.capabilities || [];
            if (caps.indexOf('chat') !== -1) chatOrgs.push(o.uuid);
            else others.push(o.uuid);
        }
        return chatOrgs.concat(others);
    }

    function ciConversationUrl(org, cid) {
        return 'https://claude.ai/api/organizations/' + org + '/chat_conversations/' + cid +
               '?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong';
    }

    // ── Text extraction ─────────────────────────────────────────
    // The top-level `text` field is EMPTY on every message under
    // rendering_mode=messages (verified: 0 of 192 non-empty). Content lives in
    // content[] blocks. Reading `text` would render a panel full of blank rows.
    // Where ciExtractText() found an entry's text. 'content' means it is the message body
    // and therefore appears in the DOM; anything else means it does NOT — a large paste
    // becomes an attachment whose extracted_content the page renders as a file chip, so
    // comparing API text against DOM text for those rows can only ever fail.
    function ciTextSource(msg) {
        var content = msg.content || [], i;
        for (i = 0; i < content.length; i++) {
            if (content[i].type === 'text' && content[i].text && content[i].text.trim()) return 'content';
        }
        var att = msg.attachments || [];
        for (i = 0; i < att.length; i++) {
            if (att[i].extracted_content && att[i].extracted_content.trim()) return 'attachment';
        }
        for (i = 0; i < att.length; i++) if (att[i].file_name) return 'attachment';
        if ((msg.files || []).length) return 'files';
        return '';
    }

    function ciExtractText(msg) {
        var out = [];
        var content = msg.content || [];
        for (var i = 0; i < content.length; i++) {
            if (content[i].type === 'text' && content[i].text) out.push(content[i].text);
        }
        var joined = out.join('\n').trim();
        if (joined) return joined;

        // Large pastes become a txt attachment with an empty file_name and the
        // body in extracted_content — the message itself carries no text block.
        // 14 of 147 human turns on the branch fixture were this shape.
        // ALL bodies, not the first: a turn can carry several documents, and
        // returning early hid every one after the first from Search, Summary and
        // the context totals (Codex R10 :1337).
        var att = msg.attachments || [];
        var bodies = [];
        for (var j = 0; j < att.length; j++) {
            if (att[j].extracted_content && att[j].extracted_content.trim()) {
                bodies.push(att[j].extracted_content.trim());
            }
        }
        if (bodies.length) return bodies.join('\n\n');
        for (var k = 0; k < att.length; k++) {
            if (att[k].file_name) return '[' + att[k].file_name + ']';
        }

        var files = msg.files || [], names = [];
        for (var f = 0; f < files.length; f++) {
            names.push(files[f].file_name || files[f].file_kind || 'file');
        }
        if (names.length) return '[' + names.join(', ') + ']';

        return '';
    }

    function ciCountBlockChars(msg, type) {
        var content = msg.content || [], n = 0;
        for (var i = 0; i < content.length; i++) {
            if (content[i].type !== type) continue;
            var v = content[i].thinking || content[i].text || '';
            n += v.length;
        }
        return n;
    }

    // ── Tree walk ───────────────────────────────────────────────
    // Editing or regenerating creates a branch, so chat_messages contains
    // abandoned branches alongside the live conversation. Listing every
    // sender==='human' message would surface questions the user edited away —
    // silently presenting discarded content as current.
    function ciInferLeafUuid(msgs) {
        var isParent = {};
        for (var i = 0; i < msgs.length; i++) {
            if (msgs[i].parent_message_uuid) isParent[msgs[i].parent_message_uuid] = true;
        }
        var newest = null;
        for (var j = 0; j < msgs.length; j++) {
            if (isParent[msgs[j].uuid]) continue;
            if (!newest || new Date(msgs[j].created_at) > new Date(newest.created_at)) {
                newest = msgs[j];
            }
        }
        return newest ? newest.uuid : null;
    }

    function ciResolveActivePath(data) {
        var msgs = (data && data.chat_messages) || [];
        if (!msgs.length) return { path: [], usedFallback: false };

        var byId = {};
        for (var i = 0; i < msgs.length; i++) byId[msgs[i].uuid] = msgs[i];

        var leafUuid = data.current_leaf_message_uuid;
        var usedFallback = false;
        if (!leafUuid || !byId[leafUuid]) {
            leafUuid = ciInferLeafUuid(msgs);
            usedFallback = true;
            console.warn('[ACN] conversation index: current_leaf_message_uuid missing or ' +
                         'unresolvable — falling back to newest-leaf heuristic. ' +
                         'This is inference, not the authoritative pointer.');
        }

        var path = [];
        var cur  = byId[leafUuid];
        var guard = 0;
        var reachedRoot = false;
        // Iteration cap: a cycle in the data would otherwise spin forever.
        while (cur && guard < msgs.length) {
            guard++;
            path.push(cur);
            var pid = cur.parent_message_uuid;
            // ONLY the sentinel proves the root was reached. A missing/null parent on
            // a malformed or truncated record used to count as "complete", so Export
            // labelled a partial path as complete conversation history (Codex R4).
            if (pid === CI_ROOT_PARENT_UUID) { reachedRoot = true; break; }
            if (!pid) break;
            cur = byId[pid];
        }
        path.reverse();

        // Terminating is not the same as succeeding. Exiting because a parent uuid
        // was missing from the map, or because the cycle cap tripped, yields a
        // PARTIAL path — which must not then be exported as "complete conversation
        // history". Track it so the banner and the export header can say so.
        if (!reachedRoot) {
            console.warn('[ACN] conversation index: active path did not reach the root ' +
                         'sentinel (' + path.length + ' of ' + msgs.length + ' messages ' +
                         'walked). The tree is malformed or truncated — treating the ' +
                         'resulting path as INCOMPLETE.');
        }
        return { path: path, usedFallback: usedFallback, reachedRoot: reachedRoot };
    }

    function ciValidateShape(data) {
        return !!(data && typeof data === 'object' &&
                  Array.isArray(data.chat_messages) &&
                  data.chat_messages.length > 0 &&
                  data.chat_messages[0] &&
                  typeof data.chat_messages[0].uuid === 'string' &&
                  typeof data.chat_messages[0].sender === 'string');
    }

    function ciBuildIndex(data) {
        var resolved = ciResolveActivePath(data);
        var path = resolved.path;
        var turns = [];
        var truncated = 0;

        // Full ordered path (human AND assistant) — Export needs both sides to
        // produce a complete file. Without this, Export would still emit only the
        // assistant messages that happened to be mounted.
        _ciFullPath = [];
        for (var p = 0; p < path.length; p++) {
            _ciFullPath.push({
                uuid:      path[p].uuid,
                sender:    path[p].sender,
                text:      ciExtractText(path[p]),
                textSource: ciTextSource(path[p]),
                // Retained because it predicts whether this entry RENDERS A ROW, which is
                // what makes dataIndex -> path index resolvable. See ciEntryRenders().
                stopReason: path[p].stop_reason || null,
                // Extended thinking is invisible to DOM scraping but consumes real
                // context. content[] exposes it directly, which beats the old
                // "count [aria-expanded] blocks x 600 tokens" heuristic — and that
                // heuristic could only see mounted blocks anyway.
                thinkingChars: ciCountBlockChars(path[p], 'thinking'),
                truncated: !!path[p].truncated,
                files:     path[p].files || [],
                attachments: path[p].attachments || []
            });
        }

        for (var i = 0; i < path.length; i++) {
            var m = path[i];
            if (m.truncated) truncated++;
            if (m.sender !== 'human') continue;
            var text = ciExtractText(m);
            if (!text) continue;
            turns.push({
                uuid:       m.uuid,
                text:       text,
                summary:    generateSummary(text),
                pathIndex:  i,
                createdAt:  m.created_at,
                attachments: m.attachments || [],
                files:      m.files || [],
                truncated:  !!m.truncated,
                element:    null,       // bound opportunistically to mounted DOM
                provisional: false      // true for DOM-merged turns not yet in the API
            });
        }

        _ciTruncatedCount   = truncated;
        _ciUsedLeafFallback = resolved.usedFallback;
        _ciPathComplete     = resolved.reachedRoot;
        ciBuildRenderable();
        ciResetAnchors();
        // A mid-jump refetch for the SAME conversation (edit/regenerate resync) rebuilds
        // the path without going through ciInvalidate, so indices shift underneath an
        // in-flight jump and it would verify against the new array — landing confidently
        // on a different message than the one clicked.
        _ciJumpToken++;
        _ciTextToUuid       = null;   // rebuilt lazily against the new path
        _ciIndexGen++;
        return turns;
    }

    // ── Fetch orchestration ─────────────────────────────────────
    // Tries candidate orgs in order. A 404 means "wrong org" and advances to the
    // next; any other failure is terminal and drops us to degraded mode.
    function ciFetchWithOrgFallback(cid, candidates, idx, cb, exhaustedCb) {
        if (idx >= candidates.length) {
            // Every cheap candidate was rejected. A stale cached org (account
            // switched, org migrated) would otherwise dead-end here permanently,
            // since ciResolveOrgCandidates short-circuits before ever querying
            // /api/organizations when a cached value exists.
            if (exhaustedCb) { exhaustedCb(); return; }
            cb(new Error('no org candidate accepted the conversation'), null);
            return;
        }
        var org = candidates[idx];
        ciRequestJSON(ciConversationUrl(org, cid), function (err, data, status) {
            if (!err) {
                // NO commit here. A stale org-A request completing after org-B's ran
                // these writes BEFORE finish() rejected the stale generation, so B's
                // validated org cache was overwritten with A — wrong usage quota and
                // wrong org for every later load (Codex R10 :1521). The successful org
                // rides to the generation-guarded completion path, which commits it
                // only after the guard passes.
                cb(null, data, org);
                return;
            }
            if (status === 404 || status === 403) {
                ciFetchWithOrgFallback(cid, candidates, idx + 1, cb, exhaustedCb);
                return;
            }
            cb(err, null);
        });
    }

    // Full org list, used only after the cheap candidates have all been rejected.
    function ciFetchFromAllOrgs(cid, tried, cb) {
        ciRequestJSON('https://claude.ai/api/organizations', function (err, orgs) {
            if (err || !Array.isArray(orgs)) {
                cb(new Error('no org candidate accepted the conversation'), null);
                return;
            }
            var ranked = ciRankOrgs(orgs).filter(function (u) { return tried.indexOf(u) === -1; });
            if (!ranked.length) {
                cb(new Error('no org candidate accepted the conversation'), null);
                return;
            }
            ciFetchWithOrgFallback(cid, ranked, 0, cb, null);
        });
    }

    var _ciRetryDelayMs = 0;   // 0 = plain cooldown. Permanent failure classes back
                               // off exponentially: an API/schema change used to
                               // re-download and re-parse the 3.3MB payload every 15s
                               // indefinitely — hundreds of MB per hour on an open
                               // tab (Codex R12 :3564).
    function ciSetDegraded(cid, reason) {
        _ciStatus         = 'degraded';
        _ciDegradedReason = reason;
        var permanent = /unexpected response shape|malformed message data/.test(reason || '');
        if (permanent) {
            _ciRetryDelayMs = _ciRetryDelayMs ? Math.min(_ciRetryDelayMs * 4, 1800000)
                                              : 60000;
            console.warn('[ACN] index failure looks PERMANENT (' + reason + ') — ' +
                         'next retry in ' + Math.round(_ciRetryDelayMs / 1000) + 's');
        } else {
            _ciRetryDelayMs = 0;
        }
        // Clear the FULL derived state, not just _ciIndex. Every consumer guards on
        // ciIsReady() so stale data could not be read, but leaving a multi-megabyte
        // _ciFullPath (and the truncated/leaf-fallback flags describing a different
        // conversation) alive after a failed load is a leak waiting to become a bug.
        _ciIndex            = null;
        _ciFullPath         = null;
        _ciTextToUuid       = null;
        _ciTruncatedCount   = 0;
        _ciUsedLeafFallback = false;
        _ciPathComplete     = true;
        // Record which conversation failed so the retry condition in
        // scanConversation() does not hammer a permanently failing endpoint every
        // 500ms, while still retrying when the user opens a different conversation.
        _ciConversationId = cid;
        // Stamp the attempt so a TRANSIENT failure (network blip, timeout) recovers
        // on its own after the cooldown instead of leaving the panel degraded for
        // the rest of the session.
        _ciLastRefetchAt  = Date.now();
        console.warn('[ACN] conversation index unavailable — falling back to DOM scan. ' +
                     'Reason: ' + reason);
    }

    // Loads the index for the current conversation. `done` is invoked with a
    // boolean indicating whether an API-backed index is now available.
    function ciLoadIndex(force, done) {
        if (!ciIsClaudeChat()) { if (done) done(false); return; }

        var cid = ciGetConversationUuid();
        if (!cid) { if (done) done(false); return; }

        // Cached and still the same conversation — nothing to do. Avoids
        // re-downloading 3.3MB every time a panel opens.
        if (!force && _ciIndex && _ciConversationId === cid) {
            if (done) done(true);
            return;
        }
        if (_ciInFlightCid === cid) { if (done) done(false); return; }
        var myGen = ++_ciLoadGen;
        _ciInFlightCid = cid;
        _ciInFlightGen = myGen;
        // KEEP the ready index during a same-conversation background refresh: setting
        // 'loading' unconditionally made ciIsReady() false for the whole multi-MB
        // request, so the next scan collapsed navigation/export/context to the mounted
        // 3-5 turns until it completed (Codex :1573). The stale snapshot is strictly
        // better than the DOM window; it is swapped atomically in finish().
        if (!(_ciIndex && _ciConversationId === cid && _ciStatus === 'ready')) {
            _ciStatus = 'loading';
        }

        ciResolveOrgCandidates(function (candidates) {
            if (!candidates.length) {
                if (_ciInFlightCid === cid && _ciInFlightGen === myGen) _ciInFlightCid = null;
                if (myGen !== _ciLoadGen || ciGetConversationUuid() !== cid) { if (done) done(false); return; }
                ciSetDegraded(cid, 'could not resolve organization UUID');
                if (done) done(false);
                return;
            }
            function finish(err, data, org) {
                // SUPERSESSION GUARD (Codex R4): conversation scoping lets a NEW load
                // start while the OLD request is still pending — but the old callback
                // still fires. Without this check, an old request failing AFTER the
                // new one succeeded called ciSetDegraded() over the fresh ready index,
                // and clearing the in-flight marker unconditionally could clobber the
                // NEW load's marker. A stale callback must touch nothing.
                // Release OUR OWN marker first — ownership is the generation pair, so
                // this cannot clobber a newer request's marker, and a request whose
                // conversation the user left no longer wedges future loads of it.
                if (_ciInFlightCid === cid && _ciInFlightGen === myGen) _ciInFlightCid = null;
                if (myGen !== _ciLoadGen || ciGetConversationUuid() !== cid) return;
                if (org) {                 // guard passed: THIS load owns the state
                    _ciOrgUuid = org;
                    ciWriteCachedOrg(org);
                    // Usage fetched against a guessed org (multi-org user opened the
                    // panel before validation) stays cached for up to 5 minutes showing
                    // the WRONG org's quota (Codex R12 :4204). Validating a different
                    // org invalidates it.
                    if (_usageOrgUuid && _usageOrgUuid !== org) _usageLastFetch = 0;
                }
                if (err) {
                    ciSetDegraded(cid, err.message);
                    if (done) done(false);
                    return;
                }
                if (!ciValidateShape(data)) {
                    ciSetDegraded(cid, 'unexpected response shape');
                    if (done) done(false);
                    return;
                }
                try {
                    _ciIndex = ciBuildIndex(data);
                } catch (buildErr) {
                    // Shape validation only inspects chat_messages[0]; a malformed
                    // record further in would throw here. Without this catch the
                    // exception escaped after _ciInFlight was already cleared,
                    // stranding _ciStatus at 'loading' — which is neither 'idle'
                    // nor 'degraded', so no retry ever fired and no banner showed.
                    ciSetDegraded(cid, 'malformed message data: ' + buildErr.message);
                    if (done) done(false);
                    return;
                }
                _ciConversationId = cid;
                _ciStatus         = 'ready';
                _ciDegradedReason = '';
                _ciRetryDelayMs   = 0;
                console.log('[ACN] conversation index ready: ' + _ciIndex.length +
                            ' questions (' + (data.chat_messages || []).length +
                            ' messages in payload)');
                if (done) done(true);
            }

            ciFetchWithOrgFallback(cid, candidates, 0, finish, function () {
                ciFetchFromAllOrgs(cid, candidates, finish);
            });
        });
    }

    // Total characters across the whole active path. Replaces reading innerText
    // off the scroll container, which on a virtualized list only ever sees the
    // mounted window.
    function ciTotalChars() {
        if (!ciIsReady() || !_ciFullPath) return 0;
        var n = 0;
        for (var i = 0; i < _ciFullPath.length; i++) {
            var e = _ciFullPath[i];
            n += (e.text || '').length;
            // "summarize this" + an uploaded document consumes the document's context
            // too. When the entry's text came from the message body, attachment
            // bodies are ADDITIONAL content; when the text IS the attachment
            // (textSource !== 'content'), it is already counted (Codex :1315).
            if (e.textSource === 'content' && e.attachments) {
                for (var a = 0; a < e.attachments.length; a++) {
                    n += (e.attachments[a].extracted_content || '').length;
                }
            }
        }
        return n;
    }

    function ciTotalThinkingChars() {
        if (!ciIsReady() || !_ciFullPath) return 0;
        var n = 0;
        for (var i = 0; i < _ciFullPath.length; i++) n += (_ciFullPath[i].thinkingChars || 0);
        return n;
    }

    // Shared scroll-container locator. Anchors on a mounted message and walks up
    // for the first genuinely scrollable ancestor. Deliberately class-name-free:
    // Claude's container classes have already changed once (overflow-y-scroll ->
    // overflow-y-auto, pt-6 -> mt-12 pt-2) since they were last documented.
    var _ciScrollContainer = null;

    function ciFindScrollContainer() {
        if (_ciScrollContainer && _ciScrollContainer.isConnected) return _ciScrollContainer;
        _ciScrollContainer = null;

        var anchors = Array.from(getUserMessages());
        if (!anchors.length) anchors = Array.from(getAIMessages());
        if (!anchors.length) return null;

        var node = anchors[0].parentElement;
        while (node && node !== document.documentElement) {
            var st = window.getComputedStyle(node);
            var scrolls = (st.overflowY === 'auto' || st.overflowY === 'scroll') &&
                          node.scrollHeight > node.clientHeight;
            // Guard against latching onto a small inner scroller — code blocks and
            // tables inside messages are themselves overflow:auto.
            if (scrolls &&
                node.clientHeight > window.innerHeight * 0.4 &&
                node.scrollHeight > node.clientHeight * 1.5) {
                _ciScrollContainer = node;
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    // ============================================================
    // VIRTUALIZER BRIDGE — data-index <-> conversation index (v12.0, Phase 3)
    // ============================================================
    // Claude's virtualizer ("rocksteady") tags each rendered row with data-index:
    // contiguous, 0-based, covering BOTH senders. That is a positional identifier,
    // so mapping a mounted DOM node to a conversation position needs no text
    // matching at all — which removes the whole contamination class that produced
    // the Tier 3 CRITICAL.
    //
    // What it does NOT give us is the alignment. _ciFullPath has 295 entries while
    // aria-setsize reports 294 rows, so some constant offset exists. Measured once
    // it was +1, but from a single matched row — and a wrong offset lands EVERY
    // jump one message off, silently.
    //
    // So the offset is never hardcoded. It is re-derived on each jump from EVERY
    // mounted user row, and all of them must agree. Disagreement means the mapping
    // assumption is broken (a deploy changed the row model, a branch switch
    // renumbered things) and we refuse to convert rather than jump somewhere wrong.
    // That makes the check permanent and self-correcting instead of a one-time probe.

    var CI_ROW_ATTR = 'data-index';

    // Rows currently mounted, as { dataIndex, el, isUser }, ascending.
    // Resolves the message-feed root once. EVERY row query must be scoped to it:
    // [data-index] is not unique to Claude's feed (sidebar/virtuoso lists and carousels
    // use it too). A foreign row entering the set fragments a real contiguous run and
    // its geometry is converted against the wrong container, so it can win the
    // nearest-cluster contest and drive the settle key and the anchor interpolation.
    function ciFeedRoot() {
        return document.querySelector('[role="feed"]') ||
               document.querySelector('[data-autoscroll-container="true"]') ||
               document;
    }

    function ciMountedRows() {
        var els = ciFeedRoot().querySelectorAll('[' + CI_ROW_ATTR + ']');
        var rows = [];
        for (var i = 0; i < els.length; i++) {
            var raw = els[i].getAttribute(CI_ROW_ATTR);
            var n = parseInt(raw, 10);
            if (isNaN(n)) continue;
            rows.push({
                dataIndex: n,
                el: els[i],
                isUser: !!els[i].querySelector('[data-testid="user-message"]')
            });
        }
        rows.sort(function (a, b) { return a.dataIndex - b.dataIndex; });
        return rows;
    }

    // Derives the offset such that:  _ciFullPath index === dataIndex + offset
    // Returns null when it cannot be established or the rows disagree.
    // `diag`, when supplied, is filled with one record per mounted user row explaining
    // whether it produced an offset vote and, if not, why. This path is the single most
    // likely cause of a live jump failure and the hardest to see: returning null sends
    // the loop into the blind-probe branch, which scrolls to 1/9, 2/9 ... 8/9 of the
    // document looking for a window it can align — 8 moves, ~1.05s each, visible churn
    // across the whole conversation, then the honest-failure toast. Without this
    // breakdown a debug log shows the thrashing but not the reason for it.
    //
    // Why it can fail on the real site while CI is green: the DOM holds RENDERED text
    // and the API holds RAW MARKDOWN, so a question containing a code fence, a list, a
    // link or an em-dash need not round-trip to the same normalised key. ~10% of human
    // turns also carry no text block at all (large pastes become attachments), giving
    // an empty API side. CI's fixture uses plain prose identical on both sides, so it
    // cannot reproduce any of that.
    function ciDeriveRowOffset(diag) {
        if (!ciIsReady() || !_ciFullPath) {
            if (diag) diag.push({ why: 'index-not-ready' });
            return null;
        }
        var rows = ciMountedRows();
        var offsets = [];
        var i, j;

        for (i = 0; i < rows.length; i++) {
            if (!rows[i].isUser) continue;   // assistant text is less reliably matched
            // isUser is defined as "has a [data-testid=user-message] descendant", so
            // this querySelector always resolves — the old `|| rows[i].el` fallback
            // was unreachable. Reading the INNER node also keeps the platform's
            // sr-only sender label (which lives on the row wrapper) out of the key.
            var inner = rows[i].el.querySelector('[data-testid="user-message"]');
            if (!inner) continue;
            var key = _normalizeKey(_readMessageText(inner));
            if (!key) {
                if (diag) diag.push({ row: rows[i].dataIndex, why: 'empty-dom-text' });
                continue;
            }
            var matches = [];
            for (j = 0; j < _ciFullPath.length; j++) {
                if (_ciFullPath[j].sender !== 'human') continue;
                if (_normalizeKey(_ciFullPath[j].text || '') === key) matches.push(j);
            }
            // Ambiguous text (the same question asked twice) proves nothing about
            // alignment — skip it rather than letting it vote.
            if (matches.length !== 1) {
                if (diag) {
                    // Record enough to tell "the API text is different" from "the API
                    // text is missing" without dumping message bodies into the log.
                    var apiHuman = 0, apiEmpty = 0;
                    for (j = 0; j < _ciFullPath.length; j++) {
                        if (_ciFullPath[j].sender !== 'human') continue;
                        apiHuman++;
                        if (!_normalizeKey(_ciFullPath[j].text || '')) apiEmpty++;
                    }
                    diag.push({ row: rows[i].dataIndex,
                                why: matches.length ? 'ambiguous-x' + matches.length
                                                    : 'no-api-match',
                                domKeyLen: key.length,
                                domKeyHead: key.slice(0, 40),
                                apiHumanCount: apiHuman,
                                apiEmptyTextCount: apiEmpty });
                }
                continue;
            }
            offsets.push(matches[0] - rows[i].dataIndex);
            if (diag) diag.push({ row: rows[i].dataIndex, why: 'ok',
                                  offset: matches[0] - rows[i].dataIndex });
        }

        // WITHDRAWN GUARD: this used to refuse whenever mounted rows disagreed. That was
        // wrong — under a piecewise map, disagreement means A STEP EXISTS BETWEEN THEM,
        // which is correct data. The pinned tail row legitimately sits past a step and
        // votes a different offset from local rows on nearly every jump, so the old guard
        // fired constantly and sent the loop into a blind document sweep. Mapping is now
        // resolved by ciResolveRowForPath() against measured anchors; this function
        // survives only as a cross-check and as a single-segment convenience.
        if (!offsets.length) {
            if (diag) diag.push({ why: 'NO-OFFSET-DERIVED',
                                  mountedRows: rows.length,
                                  mountedUserRows: rows.filter(function (r) {
                                      return r.isUser;
                                  }).length });
            return null;
        }
        for (i = 1; i < offsets.length; i++) {
            if (offsets[i] !== offsets[0]) {
                // Not an error. Return null so callers fall through to the anchor-based
                // piecewise resolver, which handles a step correctly, and log at debug
                // level only — this fires on most jumps in a conversation containing an
                // interrupted generation and is entirely expected there.
                if (ciJumpDebugOn()) {
                    console.log('[ACN] mounted rows span a mapping step (offsets ' +
                                offsets.join(', ') + ') — resolving via anchors');
                }
                return null;
            }
        }
        // HONEST SCOPE: every sample comes from the 3-10 row mount window, so they sit
        // within a few rows of each other. This proves the offset LOCALLY, not globally.
        // If the mapping were piecewise (a virtualizer row that is not a path message,
        // or a path entry the virtualizer never renders — which already happens once at
        // the head), all local samples would agree and this check would still pass.
        // That is why the jump VERIFIES the landed row's text before reporting success
        // rather than trusting this value. Do not remove that verification on the
        // grounds that "the offset is already checked here".
        return offsets[0];
    }

    // ============================================================
    // PIECEWISE ROW MAP  (dataIndex <-> _ciFullPath index)
    // ============================================================
    //
    // THE OFFSET IS NOT CONSTANT. Measured live on conversation b3c603a4 by sweeping 61
    // scroll positions and harvesting 81 exact anchors: offsets {0, 1}, exactly one step,
    // between row 198 and row 200. The earlier code demanded that every mounted user row
    // agree on ONE offset and refused to convert otherwise — so the pinned tail row (292),
    // which sits past the step and legitimately votes 1 while local rows vote 0, caused a
    // refusal on nearly every jump. That refusal is what sent the loop into a blind
    // document sweep: ~12s of visible thrashing, then honest failure.
    //
    // DISAGREEMENT BETWEEN ROWS MEANS A STEP EXISTS BETWEEN THEM. It is data, not error.
    //
    // Two independent unknowns, deliberately kept apart (they were previously tangled,
    // so a MAPPING failure triggered a GEOMETRY search — solving the wrong problem):
    //     MAPPING   pathIndex <-> dataIndex   "which row is my target?"   <- this section
    //     GEOMETRY  dataIndex <-> scrollTop   "where is that row?"        <- the settle loop
    //
    // Sources of truth, in priority order:
    //   1. _ciAnchors  — MEASURED (dataIndex, pathIndex) pairs. Ground truth. Accumulated
    //                    all session from mounted rows and, critically, from rows the jump
    //                    LANDED on whose verification failed (a mismatch identifies the
    //                    true mapping at that position exactly — see ciJumpToFullPathIndex).
    //   2. _ciRenderable — predicted, from the stop_reason predicate below. A seed only.
    //
    // ROBUSTNESS TARGET: N unrendered entries at arbitrary positions must not degrade
    // correctness, only speed. Correctness therefore never depends on the predicate being
    // right — anchors override it, and a wrong prediction costs an extra iteration.

    var _ciRenderable = null;   // path indices predicted to render, in order; position === dataIndex
    var _ciAnchors    = [];     // [{row, path}] measured, kept sorted by row, deduped
    var _ciAnchorRows = null;   // Set of rows already anchored
    var _ciPredicateWarned = false;
    var _ciRowsAtBuild = null;   // aria-setsize MEASURED for this index generation.
                                 // The new-turn boundary must be the real row count:
                                 // a predicate-blind entry makes _ciRenderable.length
                                 // one too long, and a genuinely new message lands at
                                 // dataIndex === realRows — inside the predicted range,
                                 // silently classified as old (Codex R8 :3322).

    // THE PREDICATE — a hypothesis, not ground truth.
    //
    // An entry renders a row unless it is an assistant message with NO stop_reason: an
    // interrupted or superseded generation, which the client never paints.
    //
    // Evidence: on the 147-turn conversation exactly one such entry exists (path 199) and
    // 295 path entries - 1 == 294 == aria-setsize, with all 81 measured anchors reproduced
    // exactly. On a second conversation containing a `stop_sequence` entry (a COMPLETED
    // generation) the predicate correctly counts it as rendering: 32 == 32. Across 14
    // conversations / 688 path entries, no other non-rendering category appeared.
    //
    // Note it keys on the ABSENCE of stop_reason, not on any particular value —
    // "end_turn" and "stop_sequence" both render.
    function ciEntryRenders(entry) {
        return !(entry && entry.sender === 'assistant' && !entry.stopReason);
    }

    function ciBuildRenderable() {
        _ciRenderable = [];
        if (!_ciFullPath) return;
        for (var i = 0; i < _ciFullPath.length; i++) {
            if (ciEntryRenders(_ciFullPath[i])) _ciRenderable.push(i);
        }
        _ciPredicateWarned = false;
        _ciRowsAtBuild = null;   // re-measured by the next scan for THIS generation
    }

    function ciResetAnchors() {
        _ciAnchors = [];
        _ciAnchorRows = null;
    }

    // Continuous self-validation, run whenever the DOM can tell us the true row count.
    // Equality silently confirms the predicate; inequality is a loud warning carrying both
    // numbers, so evidence accumulates for or against it at no cost. Never fatal — anchors
    // are what correctness rests on.
    function ciValidatePredicate() {
        if (!_ciRenderable) return;
        var total = ciTotalRows();
        if (!total) return;
        if (_ciRowsAtBuild === null) _ciRowsAtBuild = total;
        if (_ciPredicateWarned) return;
        if (_ciRenderable.length !== total) {
            _ciPredicateWarned = true;
            console.warn('[ACN] renderable-entry predicate disagrees with the DOM: ' +
                'predicted ' + _ciRenderable.length + ' rendered rows, aria-setsize reports ' +
                total + ' (path length ' + (_ciFullPath ? _ciFullPath.length : '?') + '). ' +
                'Falling back to measured anchors, which override the prediction. If you ' +
                'see this, the stop_reason predicate needs revisiting.');
        }
    }

    // Records a MEASURED pair. Rejects only a genuinely broken mapping — a non-monotonic
    // anchor set — never mere disagreement between offsets.
    function ciRecordAnchor(row, pathIndex) {
        if (typeof row !== 'number' || typeof pathIndex !== 'number') return false;
        if (row < 0 || pathIndex < 0) return false;
        if (!_ciFullPath || pathIndex >= _ciFullPath.length) return false;
        if (!_ciAnchorRows) _ciAnchorRows = {};
        var key = String(row);
        if (_ciAnchorRows.hasOwnProperty(key)) {
            // Same row resolving to a DIFFERENT path entry means the virtualizer
            // renumbered underneath us (a new message, or a branch switch). Old anchors
            // are stale; keep the new observation and drop the rest.
            if (_ciAnchorRows[key] !== pathIndex) {
                console.warn('[ACN] row ' + row + ' now maps to path ' + pathIndex +
                             ' (was ' + _ciAnchorRows[key] + ') — discarding stale anchors');
                ciResetAnchors();
                _ciAnchorRows = {};
                _ciAnchorRows[key] = pathIndex;
                _ciAnchors = [{ row: row, path: pathIndex }];
                return true;
            }
            return false;
        }
        // Monotonicity: offset must be non-decreasing in row, and path order must follow
        // row order. A violation means the mapping itself is broken, not merely stepped.
        var off = pathIndex - row;
        for (var i = 0; i < _ciAnchors.length; i++) {
            var a = _ciAnchors[i], aOff = a.path - a.row;
            if ((a.row < row && (aOff > off || a.path >= pathIndex)) ||
                (a.row > row && (aOff < off || a.path <= pathIndex))) {
                console.warn('[ACN] NON-MONOTONIC row mapping: row ' + row + '->path ' +
                    pathIndex + ' contradicts row ' + a.row + '->path ' + a.path +
                    '. Discarding anchors and re-deriving.');
                ciResetAnchors();
                _ciAnchorRows = {};
                _ciAnchorRows[String(row)] = pathIndex;
                _ciAnchors = [{ row: row, path: pathIndex }];
                return true;
            }
        }
        _ciAnchorRows[key] = pathIndex;
        _ciAnchors.push({ row: row, path: pathIndex });
        _ciAnchors.sort(function (x, y) { return x.row - y.row; });
        return true;
    }



    // ── THE ONE MATCHER family (resolve-on-arrival core) ─────────────────────
    // One row -> its unique path entry. BOTH senders: restricting to user rows left
    // dead regions wherever questions were short or duplicated (live: path 210-228
    // unanchorable while neighbours anchored). User rows match by exact normalized
    // key with a markdown-insensitive fallback; assistant rows by markdown-insensitive
    // 120-char prefix (rendered tool blocks and citations do not round-trip).
    // Attachment-sourced entries never participate: their text is not in the DOM at
    // all, so they can neither match nor be allowed to match something else.
    function ciMatchRowToPath(rowObj) {
        if (!_ciFullPath) return null;
        var isUser = rowObj.isUser;
        var inner = isUser
            ? rowObj.el.querySelector('[data-testid="user-message"]')
            : ciMessageNodeWithin(rowObj.el);
        if (!inner || inner === rowObj.el) return null;
        var domTxt = _readMessageText(inner);
        var key = isUser ? _normalizeKey(domTxt) : _normalizeCompare(domTxt);
        if (!key || (!isUser && key.length < 60)) return null;
        var keyMd = isUser ? _normalizeCompare(domTxt) : null;
        var probe = isUser ? null : key.slice(0, 120);
        var matches = [], j;
        for (j = 0; j < _ciFullPath.length; j++) {
            var e = _ciFullPath[j];
            if (e.sender !== (isUser ? 'human' : 'assistant')) continue;
            if (e.textSource && e.textSource !== 'content') continue;
            if (isUser) {
                if (_normalizeKey(e.text || '') === key ||
                    (keyMd && _normalizeCompare(e.text || '') === keyMd)) matches.push(j);
            } else {
                var apiTxt = _normalizeCompare(e.text || '');
                if (apiTxt.length >= 60 && apiTxt.slice(0, 120) === probe) matches.push(j);
            }
        }
        return matches.length === 1 ? matches[0] : null;
    }

    // Window-local (dataIndex -> pathIndex) pairs from whatever is mounted. Records
    // into the anchor store as a side effect (idempotent) — arrival observations are
    // the same observations harvesting wants.
    function ciLocalPairs(rows) {
        var out = [], i;
        for (i = 0; i < rows.length; i++) {
            var m = ciMatchRowToPath(rows[i]);
            if (m === null) continue;
            ciRecordAnchor(rows[i].dataIndex, m);
            out.push({ d: rows[i].dataIndex, p: m });
        }
        return out;
    }

    // 3b — exact target row from window-local pairs. Bracketing pairs with equal
    // offsets pin it directly; unequal offsets mean steps lie in the gap, and the
    // predicate says where (measured pairs already overrode it where they disagree).
    // One-sided pairs extrapolate with predicate step-counting. Returns null when the
    // nearest pair is too far to trust locally (geometry's job, not mapping's).
    var CI_LOCAL_HORIZON = 24;   // rows; ~2 mount windows either side
    // meta.exact reports whether the result is MEASURED (bracketed/stepped by pairs)
    // or a predicate-favoured GUESS. A guess is a fine aim point but must never be
    // ACCEPTED as the landing: Codex round-2 caught the fast path publishing a mounted
    // guessed row as a successful jump right after 3a had failed to verify it.
    function ciResolveFromPairs(pairs, P, U, meta) {
        if (meta) meta.exact = true;
        if (!pairs.length || !_ciFullPath) return null;
        var lo = null, hi = null, i;
        for (i = 0; i < pairs.length; i++) {
            if (pairs[i].p <= P && (!lo || pairs[i].p > lo.p)) lo = pairs[i];
            if (pairs[i].p >= P && (!hi || pairs[i].p < hi.p)) hi = pairs[i];
        }
        if (lo && lo.p === P) return lo.d;
        if (hi && hi.p === P) return hi.d;
        var near = lo || hi;
        if (lo && hi) near = (P - lo.p <= hi.p - P) ? lo : hi;
        if (Math.abs(near.p - P) > CI_LOCAL_HORIZON) return null;
        function stepsBetween(a, b) {   // unrendered entries in (a, b]
            var n = 0, j;
            for (j = a + 1; j <= b; j++) if (!ciEntryRenders(_ciFullPath[j])) n++;
            return n;
        }
        if (lo && hi) {
            var oL = lo.p - lo.d, oH = hi.p - hi.d;
            if (oL === oH) return P - oL;
            var k = stepsBetween(lo.p, hi.p);
            if (k === oH - oL) return P - (oL + stepsBetween(lo.p, P));
            // Predicate blind to a step in this gap: bound the answer and take the
            // predicate-favoured side; a wrong pick self-corrects on the next arrival
            // (the landed window yields fresh pairs that tighten the gap).
            if (meta) meta.exact = false;
            var guess = ciPredictRowForPath(P);
            var a2 = P - oH, b2 = P - oL;
            if (guess !== null && guess >= Math.min(a2, b2) && guess <= Math.max(a2, b2)) return guess;
            return Math.round((a2 + b2) / 2);
        }
        var off = near.p - near.d;
        // One-sided: the step count between the pair and the target comes from the
        // PREDICATE, and a predicate-blind unrendered entry makes it wrong — leaving
        // meta.exact true here let both exact-gated paths accept an adjacent row as a
        // confident landing for text-unverifiable targets (Codex R6 :2090).
        //
        // EXCEPT the ADJACENT case, which is predicate-free by pigeonhole: with
        // |near.p - P| === 1 there is no integer between the two path indices, so no
        // hidden unrendered entry can sit in the gap and the target's row follows
        // exactly. Without this carve-out, targets at the PATH EDGES — where
        // bracketing is structurally impossible (nothing exists below the first
        // question) — could never resolve at all: the hostile fixture's chip Q1
        // regressed the moment one-sided became unconditionally inexact.
        if (meta) meta.exact = (Math.abs(near.p - P) === 1);
        if (near.p < P)  return P - off - stepsBetween(near.p, P);
        return P - off + stepsBetween(P, near.p);
    }

    // 3a — THE arrival matcher, shared verbatim by the settle loop and the fast path
    // (_relocateQuestionElement). Matches the TARGET'S OWN text among mounted user
    // rows; a multi-match (duplicated short question) is disambiguated by the
    // candidate range [P-U, P] — the offset can only be 0..U. Returns the ROW OBJECT
    // or null. Matching the target's own text cannot select a different message,
    // which is what makes this the verification as well as the resolution.
    function ciMatchTargetInWindow(targetFullPathIdx, rows, U) {
        if (!_ciFullPath) return null;
        var entry = _ciFullPath[targetFullPathIdx];
        if (!entry || (entry.textSource && entry.textSource !== 'content')) return null;
        var key = _normalizeKey(entry.text || '');
        var keyMd = _normalizeCompare(entry.text || '');
        if (!key && !keyMd) return null;
        // Rows must AGREE WITH THE TARGET'S SENDER. Assistant targets (Search and
        // Bookmarks jump to them) previously matched against USER rows only, so a
        // same-text user message inside the candidate range was accepted as the
        // assistant target (Codex R11 :2160).
        var wantUser = entry.sender === 'human';
        var hits = [], i;
        for (i = 0; i < rows.length; i++) {
            if (rows[i].isUser !== wantUser) continue;
            var inner = wantUser
                ? rows[i].el.querySelector('[data-testid="user-message"]')
                : ciMessageNodeWithin(rows[i].el);
            if (!inner || inner === rows[i].el) continue;
            var domTxt = wantUser ? _readMessageText(inner) : _readAIText(inner);
            if ((key && _normalizeKey(domTxt) === key) ||
                (keyMd && _normalizeCompare(domTxt) === keyMd)) hits.push(rows[i]);
        }
        // The candidate-range bound applies to EVERY hit: the target's row lies in
        // [P-U, P] unconditionally, so a hit outside it is the WRONG TWIN however
        // unique it is in this window.
        var inRange = [];
        for (i = 0; i < hits.length; i++) {
            if (hits[i].dataIndex >= targetFullPathIdx - U &&
                hits[i].dataIndex <= targetFullPathIdx) inRange.push(hits[i]);
        }
        if (inRange.length !== 1) return null;
        // DUPLICATED TARGET TEXT: the range excludes impossible rows but does not
        // establish WHICH duplicate this is — with twins closer together than U, the
        // wrong twin can be the only mounted hit and still sit inside [P-U, P]
        // (Codex R8 :2142). When the target's text occurs more than once on the path,
        // demand a MEASURED row identity that names exactly P.
        var dupCount = 0;
        for (i = 0; i < _ciFullPath.length && dupCount < 2; i++) {
            var de = _ciFullPath[i];
            if (de.sender !== entry.sender) continue;
            if (de.textSource && de.textSource !== 'content') continue;
            if ((key && _normalizeKey(de.text || '') === key) ||
                (keyMd && _normalizeCompare(de.text || '') === keyMd)) dupCount++;
        }
        if (dupCount > 1) {
            return (ciResolvePathForRowStrict(inRange[0].dataIndex) === targetFullPathIdx)
                ? inRange[0] : null;
        }
        return inRange[0];
    }

    // Harvests exact anchors from whatever is mounted right now. Cheap and idempotent;
    // called on every scan and every settle, so the map sharpens with use.
    function ciHarvestAnchors() {
        if (!ciIsReady() || !_ciFullPath) return 0;
        var rows = ciMountedRows(), added = 0;
        for (var i = 0; i < rows.length; i++) {
            if (_ciAnchorRows && _ciAnchorRows.hasOwnProperty(String(rows[i].dataIndex))) continue;
            var m = ciMatchRowToPath(rows[i]);
            if (m !== null && ciRecordAnchor(rows[i].dataIndex, m)) added++;
        }
        return added;
    }

    // Nearest measured anchors bracketing a path index.
    function ciBracketByPath(pathIndex) {
        var lo = null, hi = null;
        for (var i = 0; i < _ciAnchors.length; i++) {
            var a = _ciAnchors[i];
            if (a.path <= pathIndex && (!lo || a.path > lo.path)) lo = a;
            if (a.path >= pathIndex && (!hi || a.path < hi.path)) hi = a;
        }
        return { lo: lo, hi: hi };
    }

    // MAPPING RESOLUTION: path index -> row.
    // Returns { row: N }            when the answer is exact,
    //         { lo: A, hi: B }      when it is confined to a small range (a step lies
    //                               between the bracketing anchors) — caller searches it,
    //         null                  when nothing can be said.
    function ciResolveRowForPath(pathIndex) {
        if (!_ciFullPath || pathIndex < 0 || pathIndex >= _ciFullPath.length) return null;

        var b = ciBracketByPath(pathIndex);
        if (b.lo && b.hi) {
            var offLo = b.lo.path - b.lo.row, offHi = b.hi.path - b.hi.row;
            if (offLo === offHi) return { row: pathIndex - offLo };   // same segment: exact
            // A step sits between them. The answer is bounded by the two offsets, and
            // additionally by the bracketing rows themselves.
            var a = pathIndex - offHi, c = pathIndex - offLo;
            var lo = Math.max(Math.min(a, c), b.lo.row);
            var hi = Math.min(Math.max(a, c), b.hi.row);
            if (lo === hi) return { row: lo };
            if (lo > hi) return null;
            return { lo: lo, hi: hi };
        }
        // Only one side anchored: the offset can only grow with row, so a single anchor
        // bounds the answer on one side and the predicate supplies the other.
        var pred = ciPredictRowForPath(pathIndex);
        if (b.lo && !b.hi) {
            var oL = b.lo.path - b.lo.row;
            var rL = pathIndex - oL;                 // assumes no further step: upper bound on row
            if (pred === null) return { row: rL };
            return (pred === rL) ? { row: rL } : { lo: Math.min(pred, rL), hi: Math.max(pred, rL) };
        }
        if (b.hi && !b.lo) {
            var oH = b.hi.path - b.hi.row;
            var rH = pathIndex - oH;
            if (pred === null) return { row: rH };
            return (pred === rH) ? { row: rH } : { lo: Math.min(pred, rH), hi: Math.max(pred, rH) };
        }
        return pred === null ? null : { row: pred };
    }

    // Predicate-only estimate. Seed, never authority.
    function ciPredictRowForPath(pathIndex) {
        if (!_ciRenderable) return null;
        // _ciRenderable is ascending, so binary search it.
        var lo = 0, hi = _ciRenderable.length - 1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (_ciRenderable[mid] === pathIndex) return mid;
            if (_ciRenderable[mid] < pathIndex) lo = mid + 1; else hi = mid - 1;
        }
        // pathIndex itself is predicted NOT to render (e.g. an interrupted generation).
        // `lo` is the count of renderable entries before it, which is the row that would
        // follow it — the best available answer for a non-rendering target.
        return Math.min(Math.max(lo, 0), _ciRenderable.length - 1);
    }

    // Anchors-only inverse. Returns null rather than guessing — used where a MEASURED
    // fact is required (verification), as opposed to a best effort (targeting).
    function ciResolvePathForRowStrict(row) {
        if (typeof row !== 'number' || row < 0) return null;
        if (_ciAnchorRows && _ciAnchorRows.hasOwnProperty(String(row))) {
            return _ciAnchorRows[String(row)];
        }
        var lo = null, hi = null;
        for (var i = 0; i < _ciAnchors.length; i++) {
            var a = _ciAnchors[i];
            if (a.row < row && (!lo || a.row > lo.row)) lo = a;
            if (a.row > row && (!hi || a.row < hi.row)) hi = a;
        }
        // Both sides measured AND in the same segment => the offset between them is
        // constant, so this row's path index follows exactly.
        if (lo && hi && (lo.path - lo.row) === (hi.path - hi.row)) return row + (lo.path - lo.row);
        return null;
    }

    // Inverse: row -> path index. Exact when anchored or when the predicate is trusted.
    function ciResolvePathForRow(row) {
        if (typeof row !== 'number' || row < 0) return null;
        if (_ciAnchorRows && _ciAnchorRows.hasOwnProperty(String(row))) {
            return _ciAnchorRows[String(row)];
        }
        var lo = null, hi = null;
        for (var i = 0; i < _ciAnchors.length; i++) {
            var a = _ciAnchors[i];
            if (a.row < row && (!lo || a.row > lo.row)) lo = a;
            if (a.row > row && (!hi || a.row < hi.row)) hi = a;
        }
        if (lo && hi && (lo.path - lo.row) === (hi.path - hi.row)) {
            return row + (lo.path - lo.row);      // inside one segment: exact
        }
        if (_ciRenderable && row < _ciRenderable.length) return _ciRenderable[row];
        return null;
    }

    // Named wrappers. Both return null when the offset cannot be trusted; every
    // caller must treat null as "fail visibly", never as 0.
    function ciDataIndexToFullPath(dataIndex, offset) {
        if (offset === null || offset === undefined) return null;
        var v = dataIndex + offset;
        if (v < 0 || !_ciFullPath || v >= _ciFullPath.length) return null;
        return v;
    }

    function ciFullPathToDataIndex(fullPathIndex, offset, totalRows) {
        if (offset === null || offset === undefined) return null;
        var v = fullPathIndex - offset;
        if (v < 0) return null;
        // Symmetric with ciDataIndexToFullPath, which bounds both ends. Without the
        // upper bound a skewed offset yields a row that can never mount, and the
        // caller burns all 8 iterations (~8.4s of forced scrolling) before failing.
        if (typeof totalRows === 'number' && totalRows > 0 && v >= totalRows) return null;
        return v;
    }

    // ============================================================
    // JUMP-TO-MESSAGE — settle loop (v12.0, Phase 3.1)
    // ============================================================
    // scrollIntoView cannot work on a node that is not mounted, and ~97% of a long
    // conversation is unmounted. So: estimate an offset, scroll, see which rows
    // actually mounted, and interpolate again from that real anchor.
    //
    // MEASURED CONSTRAINTS (Phase 3.0, live, Firefox sandbox + Chromium; Probe C
    // re-run three times — run 1 was the outlier and its conclusions were wrong):
    //
    //  - scrollHeight DRIFTS as rows are measured: 12,050px / 3.2% on the test
    //    conversation, monotonically decreasing, ~9-10 messages of error. It also
    //    differs per page load (387132 / 388841 / 390502 observed). So the target
    //    offset is re-normalised every iteration and never cached absolutely.
    //
    //  - DO NOT DISPATCH A SYNTHETIC SCROLL EVENT. Reposition only. Measured across
    //    three identical runs: without dispatch the drift was EXACTLY -360px every
    //    time; with dispatch it was -2784 then -6249 then -6249. Worse, cluster
    //    identity showed a real overshoot — the dispatch run targeted a LOWER
    //    document position (136292 vs 134056) yet landed ~6 rows HIGHER
    //    ([113,114,115,116] vs [119,120,121,122]), beyond the +/-5 tolerance.
    //    Mechanism: dispatching makes the app run its own scroll handling, which
    //    triggers an extra height-measurement pass and shifts the coordinate system
    //    mid-jump. See DEC-024.
    //
    //  - There is NO pin/autoscroll interference. Probe C runs 2 and 3 initially
    //    printed "DISPATCH HARMFUL - pin/autoscroll" but that diagnosis is wrong:
    //    scrollTop and cluster identity were static across all 8 samples over 3.2s,
    //    drift was NEGATIVE (away from the bottom; a pin pulls toward it), and
    //    SNAPPED_BACK_TO_BOTTOM was false in every run. The movement is entirely
    //    scrollHeight re-normalisation, before sampling begins. Do NOT add a
    //    pin-interference abort — there is nothing to abort.
    //
    //  - The mounted set is NOT contiguous, and the extra cluster is NOT a
    //    fixed-size tail. Probe C Part A saw one at every sample; Part B saw none.
    //    So clusters are detected structurally and selected by real geometry against
    //    the current scroll offset. Nothing is excluded by index value.
    //
    //  - Settle: median 309ms, max 668ms -> 800ms cap with early exit.
    //  - Mount window 3-10 rows -> +/-5 tolerance.
    //  - A hidden tab throttles rAF and the virtualizer does not run at all, so the
    //    loop cannot converge. Guarded, and rAF polling has a timer escape hatch.

    // 24, not 8. The old cap was sized for ~1s settles gating a global estimator;
    // arrival-architecture settles measure ~130ms in CI / ~300ms live, and the binding
    // budget is the 5s wall-clock inside the jump. A converging nudge walk (one row per
    // pass through an unmeasured tall region) was failing at 9 passes with the target
    // one row away.
    var CI_JUMP_MAX_ITERATIONS = 24;
    var CI_JUMP_SETTLE_CAP_MS  = 800;
    var CI_JUMP_TOLERANCE_ROWS = 5;

    var _ciJumpToken = 0;      // increments to cancel an in-flight jump
    var _ciLastJumpToken = 0;  // token of the most recently STARTED jump

    // ── Jump instrumentation ─────────────────────────────────────────────────
    //
    // The settle loop converges in CI and does NOT converge on the live site. That
    // gap cannot be closed by reasoning about the code, because the thing that
    // differs is the data: real row heights span 102-2624 px with long runs of
    // similar sizes, and CI's mock is our model of that. So the loop reports what
    // it actually did, per iteration, and the live log is the measurement.
    //
    // Off by default — a jump is on the click path and must not pay for logging.
    // Enable from the page console, then reload:
    //     localStorage.setItem('acnJumpDebug', '1')
    // Disable with:
    //     localStorage.removeItem('acnJumpDebug')
    //
    // Each iteration prints one line; the final line prints the whole run as JSON
    // on a single line so it can be copied in one piece. Traces are NOT published
    // on window/unsafeWindow: crossing the sandbox boundary to hand the page an
    // object is the DEC-019/DEC-020 hazard class, and it buys nothing the console
    // does not already give us.
    function ciJumpDebugOn() {
        try { return localStorage.getItem('acnJumpDebug') === '1'; } catch (e) { return false; }
    }

    function ciMakeTrace(targetFullPathIdx) {
        var on = ciJumpDebugOn();
        var t0 = Date.now();
        var data = { target: targetFullPathIdx, totalRows: null,
                     iterations: [], exit: null, elapsedMs: 0 };
        function n(v) { return (v === null || v === undefined) ? -1 : Math.round(v); }
        return {
            on: on,
            setTotalRows: function (v) { data.totalRows = v; },
            step: function (r) {
                if (!on) return;
                data.iterations.push(r);
                console.log('[ACN jump] i=' + r.i +
                    ' targetRow=' + n(r.targetRow) + ' offset=' + n(r.offset) +
                    ' sH=' + n(r.scrollHeight) + ' cH=' + n(r.clientHeight) +
                    ' low=' + n(r.lowRow) + '@' + n(r.lowPx) +
                    ' high=' + n(r.highRow) + '@' + n(r.highPx) +
                    ' est=' + n(r.estimatePx) + ' actual=' + n(r.actualPx) +
                    ' mounted=[' + (r.mounted || '') + ']' +
                    ' cluster=' + (r.clusterLo === null ? 'none'
                                   : n(r.clusterLo) + '-' + n(r.clusterHi)) +
                    ' reset=' + (r.bracketReset ? 1 : 0) +
                    ' remounted=' + (r.changed ? 1 : 0) +
                    ' settle=' + n(r.settleMs) + 'ms' +
                    (r.settleExit ? '/' + r.settleExit : '') +
                    (r.note ? ' note=' + r.note : ''));
            },
            end: function (reason) {
                if (!on || data.exit !== null) return;   // idempotent: finish() is guarded
                                                         // by safeDone, but do not rely on it
                data.exit = reason || 'unknown';
                data.elapsedMs = Date.now() - t0;
                console.log('[ACN jump] EXIT=' + data.exit +
                            ' iterations=' + data.iterations.length +
                            ' elapsed=' + data.elapsedMs + 'ms');
                try {
                    console.log('[ACN jump] TRACE ' + JSON.stringify(data));
                } catch (e) { /* a circular value would only ever be our own plain data */ }
            }
        };
    }

    function ciFindScrollContainerStable() {
        // Attribute first — stable across the class-name churn that already broke
        // DOM-REFERENCE once. Walk-up retained as fallback and verified to resolve
        // to the same node.
        var c = document.querySelector('[data-autoscroll-container="true"]');
        if (c && c.scrollHeight > c.clientHeight) return c;
        return ciFindScrollContainer();
    }

    function ciTotalRows() {
        // Scope to the message feed. aria-setsize is generic ARIA and appears on
        // sidebar conversation lists, menus and comboboxes; an unscoped
        // document.querySelector could return a 20-item sidebar, which collapses
        // high.row, drives frac out of range, inverts the anchors and makes the loop
        // oscillate to the iteration cap.
        var scope = document.querySelector('[role="feed"]') ||
                    document.querySelector('[data-autoscroll-container="true"]');
        var a = null;
        if (scope) a = scope.querySelector('[aria-setsize]');
        if (!a) a = document.querySelector('[' + CI_ROW_ATTR + '] [aria-setsize]');
        var n = a ? parseInt(a.getAttribute('aria-setsize'), 10) : NaN;
        return isNaN(n) ? null : n;
    }

    function ciRowElement(dataIndex) {
        var scope = document.querySelector('[role="feed"]') ||
                    document.querySelector('[data-autoscroll-container="true"]') ||
                    document;
        return scope.querySelector('[' + CI_ROW_ATTR + '="' + dataIndex + '"]');
    }

    // Groups mounted rows into contiguous runs, then returns the run nearest the
    // current scroll position by REAL GEOMETRY.
    //
    // Deliberately NOT "the largest run", and deliberately no fixed tail exclusion:
    // an earlier version did both, and both were wrong. A stale cluster can be larger
    // than the live viewport window, and the extra cluster is not a stable size (one
    // probe run showed none at all, another showed one at every sample). Measuring
    // where the rows actually are is correct whether the extras are a pinned tail,
    // rows clearing late, or anything else.
    function ciSelectCluster(container, rows) {
        if (!rows || !rows.length) return null;

        var clusters = [];
        var cur = { lo: rows[0].dataIndex, hi: rows[0].dataIndex, els: [rows[0].el] };
        for (var i = 1; i < rows.length; i++) {
            if (rows[i].dataIndex === cur.hi + 1) {
                cur.hi = rows[i].dataIndex;
                cur.els.push(rows[i].el);
            } else {
                clusters.push(cur);
                cur = { lo: rows[i].dataIndex, hi: rows[i].dataIndex, els: [rows[i].el] };
            }
        }
        clusters.push(cur);
        if (clusters.length === 1) return clusters[0];

        // Viewport centre in container-content coordinates.
        var viewCentre = container.scrollTop + container.clientHeight / 2;
        var contRect = container.getBoundingClientRect();

        var best = null, bestDist = Infinity;
        for (var c = 0; c < clusters.length; c++) {
            var els = clusters[c].els;
            var sum = 0, n = 0;
            for (var e = 0; e < els.length; e++) {
                if (!els[e] || !els[e].getBoundingClientRect) continue;
                var r = els[e].getBoundingClientRect();
                // Convert viewport coords -> container content coords.
                sum += (r.top - contRect.top) + container.scrollTop + r.height / 2;
                n++;
            }
            if (!n) continue;
            var dist = Math.abs((sum / n) - viewCentre);
            if (dist < bestDist) { bestDist = dist; best = clusters[c]; }
        }
        return best || clusters[0];
    }

    // Reposition ONLY. No synthetic scroll event — see the constraints block above
    // and DEC-024. Returns the clamped position actually requested.
    function ciMoveTo(container, top) {
        var max = Math.max(0, container.scrollHeight - container.clientHeight);
        var clamped = Math.max(0, Math.min(top, max));
        container.scrollTo({ top: clamped, behavior: 'auto' });
        return clamped;
    }

    // Waits for the SELECTED cluster to stabilise — not merely for the whole mounted
    // set to stop changing. A stale cluster clearing late makes the full set churn and
    // then settle while the real viewport window is still moving, so keying on the set
    // can exit early on a position that is about to change.
    // `requestedTop`, when supplied, lets the poll recognise a SETTLED state that is
    // identical to the starting one. Without it the early exit required the cluster key to
    // CHANGE (stableSince was assigned only inside `if (key !== lastKey)`), so any move
    // that did not remount could exit only via the 800ms cap or the 1050ms guard. Live
    // traces showed every remounted=0 line paying ~810ms, which is the dominant cost of a
    // failing jump: 8 such iterations is the ~12s of thrashing.
    function ciWaitForSettle(container, beforeKey, cb, requestedTop) {
        var start = Date.now();
        var lastKey = beforeKey;
        var stableSince = null;
        var finished = false;
        var polls = 0;
        var exitReason = 'none';

        function clusterKey() {
            var cl = ciSelectCluster(container, ciMountedRows());
            return cl ? (cl.lo + '-' + cl.hi) : '';
        }

        function onVisibilityLost() {
            // rAF stops when the page is not being rendered, so the poll never runs again
            // and the guard timer becomes the only exit — and background timers are
            // clamped, so it lands well past its nominal deadline. A live trace showed
            // settle=1491ms against a 1050ms guard for exactly this reason. Failing
            // immediately is both faster and honest: the virtualizer is not running, so
            // there is nothing to wait for.
            if (document.visibilityState !== 'visible') { exitReason = 'hidden'; finishOnce(false); }
        }
        document.addEventListener('visibilitychange', onVisibilityLost);

        function finishOnce(changed) {
            if (finished) return;
            finished = true;
            clearTimeout(guardTimer);
            document.removeEventListener('visibilitychange', onVisibilityLost);
            // Second argument reports the settle's OWN measurement. Callers previously
            // timed it as (Date.now() - t) around the whole block, which also bracketed
            // pre-move geometry, the move itself, the guard's own clusterKey pass and the
            // post-settle instrumentation — so the reported figure exceeded the guard by
            // construction and was not a settle duration at all.
            cb(changed, { ms: Date.now() - start, exit: exitReason, polls: polls,
                          vis: document.visibilityState });
        }

        // requestAnimationFrame STOPS when the tab is hidden. Without this timer the
        // poll would never run again, the callback would never fire, and the busy
        // flag would never clear. Always terminate.
        var guardTimer = setTimeout(function () {
            // Evaluated OUTSIDE any caller try/catch — this is a timer callback, so a
            // throw here (geometry reads on a detached container) would mean the
            // callback never fires and the jump never completes.
            var changed = false;
            try { changed = clusterKey() !== beforeKey; } catch (e) {}
            exitReason = 'guard';
            finishOnce(changed);
        }, CI_JUMP_SETTLE_CAP_MS + 250);

        var unchangedSince = Date.now();
        (function poll() {
            if (finished) return;
            polls++;
            var key, now = Date.now();
            try { key = clusterKey(); } catch (e) { exitReason = 'throw'; finishOnce(false); return; }
            if (key !== lastKey) { lastKey = key; stableSince = now; unchangedSince = now; }

            // Fast path, unchanged: the set moved and has now held still.
            if (stableSince && key !== beforeKey && now - stableSince > 100) {
                exitReason = 'stable'; finishOnce(true); return;
            }

            // SETTLED-BUT-IDENTICAL. The scroll reached where we asked and the mounted set
            // has been stable for a while — that is settled, even though it matches what we
            // started with. The 150ms floor keeps us from declaring victory before a slow
            // virtualizer has begun reacting at all.
            if (requestedTop !== undefined && requestedTop !== null &&
                Math.abs(container.scrollTop - requestedTop) <= 2 &&
                now - unchangedSince > 150 && now - start > 150) {
                exitReason = 'settled-nochange'; finishOnce(key !== beforeKey); return;
            }

            if (now - start > CI_JUMP_SETTLE_CAP_MS) {
                exitReason = 'cap'; finishOnce(key !== beforeKey); return;
            }
            requestAnimationFrame(poll);
        }());
    }

    // Confirms the row we landed on really is the requested message, by mapping the
    // row index BACK through the offset and comparing text against the index.
    //
    // Without this, a wrong-but-locally-consistent offset produces a confident jump to
    // the wrong message — the exact failure class this module was written to remove.
    // The offset agreement check in ciDeriveRowOffset only proves the offset LOCALLY
    // (all its samples come from one mount window); this is the global check.
    // The API returns RAW MARKDOWN while the DOM holds RENDERED text, so a plain
    // normalized compare fails for any message whose first 200 chars contain **bold**,
    // a heading, a list marker or a code fence. That made assistant-target jumps
    // (reachable from AI bookmarks) unable to verify at all, burning every iteration.
    function _normalizeCompare(text) {
        return _normalizeKey(
            String(text == null ? '' : text)
                // Links: keep the visible label, drop the destination — the DOM renders
                // only the label, so 'label(https://...)' on the API side could never
                // match (Codex :2540).
                .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
                // Fences: strip the MARKERS and language tag, KEEP the enclosed code —
                // deleting whole blocks made code-bearing messages unmatchable, since
                // the DOM keeps their text (Codex :2539).
                .replace(/```[a-zA-Z0-9_-]*\n?/g, ' ')
                .replace(/[*_`~>#\[\]()]/g, '')
                .replace(/^[\s-]+/gm, ' ')
        );
    }

    // ciVerifyLandedRow was deleted with the resolve-on-arrival rebuild (DEC-027):
    // 3a matches the target's OWN text, which cannot select a different message, so
    // arrival matching IS the verification. 3b results are exact by construction from
    // measured local pairs, bounded by [P-U, P].

    // Returns the message-level node for a row, never the row wrapper itself. The
    // wrapper is the virtualizer's recycling unit and carries the platform's sr-only
    // sender label; storing it as q.element makes it type-inconsistent with everything
    // getUserMessages() returns.
    function ciMessageNodeWithin(rowEl) {
        if (!rowEl) return null;
        return rowEl.querySelector('[data-testid="user-message"]') ||
               rowEl.querySelector('.font-claude-response') ||
               // Tailwind important-prefix variant, same as the user-side selector chain.
               rowEl.querySelector('.\\!font-claude-response') ||
               rowEl;
    }

    /**
     * Scrolls a message into view by its position in _ciFullPath, paging the
     * virtualizer until the row mounts.
     *
     * @param targetFullPathIdx  index into _ciFullPath
     * @param done               callback(success, resolvedMessageElementOrNull)
     */
    // Returns the token identifying THIS jump, so the caller can scope its busy-state
    // reset to it and a superseded jump cannot clear a live jump's flag.
    // done(ok, element, reason). `reason` distinguishes a genuine miss from an ABORT
    // (superseded by a newer jump, user took control, conversation switched). Callers
    // must not show "not currently rendered" for an abort: the user either started
    // another jump or scrolled deliberately, and a failure toast for their own action
    // is noise. It also stops a superseded jump from clearing the live jump's busy flag.
    function ciJumpToFullPathIndex(targetFullPathIdx, done) {
        var finishedOnce = false;
        // Boxed so safeDone (defined before myToken is assigned) can read it later.
        var myTokenRef = { v: 0 };
        // Constructed FIRST, before the container lookup, the visibility check and the
        // row-count check. Those three exit through safeDone directly, so a trace built
        // later cannot report them — and `if (!container)` logs nothing at all, making
        // that failure invisible in both channels. Instrumentation that cannot report
        // the failures occurring before it exists is instrumentation with a blind spot
        // exactly where a jump is most likely to die early.
        var trace = ciMakeTrace(targetFullPathIdx);
        function safeDone(ok, el, reason) {
            if (finishedOnce) return;
            finishedOnce = true;
            // Every exit is traced here rather than in a finish() wrapper, so prologue
            // exits are covered too. Idempotent on both sides.
            try { trace.end(reason || (ok ? 'resolved' : 'failed')); } catch (e) {}
            // Always release OUR token's claim before handing back.
            try { orbSetJumpBusyFor(myTokenRef.v, false); } catch (e) {}
            try { done(ok, el, reason || null); } catch (e) {
                console.error('[ACN] jump completion handler threw:', e);
            }
        }

        var container;
        try {
            container = ciFindScrollContainerStable();
        } catch (e) {
            // The prologue runs AFTER the caller set the busy flag and only `done`
            // clears it, so a throw here (getComputedStyle walk, scrollHeight reads)
            // would latch the panel dimmed and click-blocked until reload.
            console.error('[ACN] jump prologue threw:', e);
            safeDone(false, null); return;
        }
        if (!container) { safeDone(false, null); return; }

        if (document.visibilityState !== 'visible') {
            console.warn('[ACN] jump aborted: tab is not visible, the virtualizer is paused');
            safeDone(false, null);
            return;
        }

        var myToken = ++_ciJumpToken;
        myTokenRef.v = myToken;
        _ciLastJumpToken = myToken;
        // The jump owns the busy state for its own token. Callers previously set it and
        // cleared it from their completion callback via a GLOBAL "latest token", which
        // reads whatever the newest jump wrote — so with two sequential jumps the first
        // callback could not clear, and the flag stuck on permanently.
        orbSetJumpBusyFor(myToken, true);
        var userScrolled = false;
        var totalRows = ciTotalRows();
        if (!totalRows) {
            // Without a row count, high.row collapses to 0, frac clamps to 1 and every
            // estimate slams the container to the bottom — 8 forced scrolls then failure.
            // Fail immediately instead of dragging the viewport.
            console.warn('[ACN] jump aborted: could not read aria-setsize (row count)');
            safeDone(false, null);
            return;
        }

        var SCROLL_KEYS = {
            PageUp: 1, PageDown: 1, Home: 1, End: 1, ArrowUp: 1, ArrowDown: 1, ' ': 1
        };
        function onUserScroll(e) {
            // Our own repositioning is not a trusted event, so this cannot self-abort.
            if (!e || !e.isTrusted) return;
            if (e.type === 'keydown') {
                // Only keys that actually scroll, and never while the user is typing —
                // an unfiltered document-level keydown aborted the jump on any keystroke,
                // including typing in the composer, and surfaced the failure toast.
                var t = e.target;
                if (t && (t.isContentEditable ||
                          t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                          t.getAttribute && t.getAttribute('role') === 'textbox')) return;
                if (!SCROLL_KEYS[e.key]) return;
            }
            userScrolled = true;
        }
        // wheel/touch cover pointer scrolling; mousedown catches scrollbar drags,
        // which emit no wheel event; keydown is bound on the DOCUMENT because
        // PageDown/Home/arrows land on body unless the scroller holds focus.
        container.addEventListener('wheel', onUserScroll, { passive: true });
        container.addEventListener('touchstart', onUserScroll, { passive: true });
        container.addEventListener('mousedown', onUserScroll, { passive: true });
        document.addEventListener('keydown', onUserScroll, true);

        function cleanup() {
            container.removeEventListener('wheel', onUserScroll);
            container.removeEventListener('touchstart', onUserScroll);
            container.removeEventListener('mousedown', onUserScroll);
            document.removeEventListener('keydown', onUserScroll, true);
        }
        // EVERY exit runs through here, including supersession — an earlier version
        // returned on supersession without calling done(), so the caller's
        // orbSetJumpBusy(false) never ran and the panel stayed dimmed forever.
        function finish(ok, el, reason) {
            cleanup();
            // Put the user back where they were. Not on success (we moved them on
            // purpose), not when THEY scrolled (that would fight them), and not when a
            // newer jump superseded this one (it owns the viewport now).
            if (!ok && reason !== 'user' && reason !== 'superseded') {
                try {
                    if (container.isConnected && typeof _entryScrollTop === 'number') {
                        ciMoveTo(container, _entryScrollTop);
                    }
                } catch (e) {}
            }
            safeDone(ok, el, reason);
        }

        var low  = { row: 0, px: 0 };
        var high = { row: (totalRows || 1) - 1,
                     px: Math.max(0, container.scrollHeight - container.clientHeight) };
        var iterations = 0;
        var shifts = 0;                          // consecutive 3c no-match moves
        var nudges = 0;                          // consecutive NON-IMPROVING local nudges
        var lastNudgeDist = Infinity;            // rows from window to target, last arrival
        var brkLoPx = null, brkHiPx = null;      // px landings straddling the target
        var brkForRow = null;                    // which resolved row the bracket is for
        var _lastProgressKey = null, _noProgressPasses = 0;
        var _entryScrollTop = container.scrollTop;
        var tJump = Date.now();
        var HARD_CAP_MS = 5000;                  // wall-clock: no jump may exceed this
        trace.setTotalRows(totalRows);

        // Mapping uncertainty: the target's dataIndex lies in [P-U, P], always.
        var U = Math.max(0, (_ciFullPath ? _ciFullPath.length : 0) - totalRows);

        function guards() {
            if (myToken !== _ciJumpToken) { finish(false, null, 'superseded'); return false; }
            if (userScrolled) { finish(false, null, 'user'); return false; }
            if (!container.isConnected) { finish(false, null, 'container-gone'); return false; }
            if (document.visibilityState !== 'visible') { finish(false, null, 'hidden'); return false; }
            if (!ciIsReady() || !_ciFullPath || targetFullPathIdx >= _ciFullPath.length) {
                finish(false, null, 'index-invalidated'); return false;
            }
            if (Date.now() - tJump > HARD_CAP_MS) { finish(false, null, 'budget'); return false; }
            return true;
        }

        function succeed(rowObj, how) {
            var el = ciMessageNodeWithin(rowObj.el) || rowObj.el;
            if (trace.on) console.log('[ACN jump] ARRIVE via ' + how +
                                      ' row=' + rowObj.dataIndex);
            finish(true, el, how);
        }

        function rowTop(el) {
            return el.getBoundingClientRect().top -
                   container.getBoundingClientRect().top + container.scrollTop;
        }

        function moveAndArrive(px, note) {
            var beforeCl = ciSelectCluster(container, ciMountedRows());
            var beforeKey = beforeCl ? (beforeCl.lo + '-' + beforeCl.hi) : '';
            var req = Math.max(0, Math.min(Math.round(px),
                Math.max(0, container.scrollHeight - container.clientHeight)));
            var tMove = Date.now();
            ciMoveTo(container, req);
            ciWaitForSettle(container, beforeKey, function (changed, info) {
                try {
                    if (trace.on) {
                        var mr0 = ciMountedRows();
                        var cl0 = ciSelectCluster(container, mr0);
                        trace.step({ i: iterations, targetRow: null, offset: null,
                            scrollHeight: container.scrollHeight,
                            clientHeight: container.clientHeight,
                            lowRow: low.row, lowPx: low.px,
                            highRow: high.row, highPx: high.px,
                            estimatePx: req, actualPx: Math.round(container.scrollTop),
                            mounted: mr0.map(function (r) {
                                return r.dataIndex + (r.isUser ? 'u' : '');
                            }).join(','),
                            clusterLo: cl0 ? cl0.lo : null, clusterHi: cl0 ? cl0.hi : null,
                            bracketReset: false, changed: !!changed,
                            settleMs: (info && info.ms) || (Date.now() - tMove),
                            settleExit: info ? info.exit : null,
                            note: note });
                    }
                } catch (e) { console.error('[ACN] jump trace threw:', e); }
                arrive();
            }, req);
        }

        // RESOLVE-ON-ARRIVAL. One arrival path for extremes, aimed moves, nudges and
        // shifts alike — there is no separate success logic anywhere else.
        function arrive() {
            try {
                if (!guards()) return;
                if (++iterations > CI_JUMP_MAX_ITERATIONS) {
                    finish(false, null, 'iteration-cap'); return;
                }
                var rows = ciMountedRows();

                // 3a — the target's own text among mounted user rows. THE matcher;
                // matching its own text cannot select a different message.
                var hit = ciMatchTargetInWindow(targetFullPathIdx, rows, U);
                if (hit) { succeed(hit, '3a-text'); return; }

                // 3b — window-local pairs give local offsets; the target's exact row
                // follows. Predicate counts steps inside gaps; measured pairs override.
                var pairs = ciLocalPairs(rows);
                if (pairs.length) {
                    var resMeta = {};
                    var res = ciResolveFromPairs(pairs, targetFullPathIdx, U, resMeta);
                    if (res !== null) {
                        var el = null, r;
                        for (r = 0; r < rows.length; r++) {
                            if (rows[r].dataIndex === res) { el = rows[r]; break; }
                        }
                        if (el && resMeta.exact) {
                            // Mounted. For a content-sourced target 3a already had its
                            // chance, so only accept by construction when the target is
                            // text-unmatchable (chip/attachment) or markdown-skewed.
                            succeed(el, '3b-local'); return;
                        }
                        // Known row, not mounted: nudge by LOCAL geometry (Probe D:
                        // one Newton step on measured local density reached row 0).
                        // The cap bounds NON-IMPROVING nudges only. Local density
                        // extrapolated over 10-20 heavy-tailed rows lands short
                        // routinely, and each re-land halves the distance — capping
                        // total nudges failed 52 converging jumps at 3 steps each.
                        var near = rows[0], best = 1e9, k;
                        for (k = 0; k < rows.length; k++) {
                            var dd = Math.abs(rows[k].dataIndex - res);
                            if (dd < best) { best = dd; near = rows[k]; }
                        }
                        if (best < lastNudgeDist) nudges = 0;   // progress: converging
                        var gain = 1 + 0.25 * Math.min(nudges, 4);
                        lastNudgeDist = best;

                        // STRADDLE -> BISECT. Estimate-density steps are too coarse in
                        // regions whose rows are already MEASURED (real heights run ~2x
                        // finer than the estimate there), so the window can jump clean
                        // over the target zone and oscillate: [48-53] <-> [63-68] around
                        // 56, forever, in the traces. But those two landings BRACKET the
                        // target in pixel space, and bisecting between them converges in
                        // <=4 passes regardless of any density assumption. The bracket
                        // resets when the resolved row moves (fresh pairs refined it).
                        if (brkForRow === null || Math.abs(brkForRow - res) > 2) {
                            brkLoPx = null; brkHiPx = null; brkForRow = res;
                        }
                        var curPx = Math.round(container.scrollTop);
                        var winLo = rows[0].dataIndex, winHi = rows[rows.length - 1].dataIndex;
                        // Ignore the pinned tail when judging which side we landed on.
                        var mainHi = winHi;
                        for (k = rows.length - 1; k > 0; k--) {
                            if (rows[k].dataIndex - rows[k - 1].dataIndex > 1) {
                                mainHi = rows[k - 1].dataIndex;
                            } else break;
                        }
                        if (mainHi < res)      { if (brkLoPx === null || curPx > brkLoPx) brkLoPx = curPx; }
                        else if (winLo > res)  { if (brkHiPx === null || curPx < brkHiPx) brkHiPx = curPx; }
                        if (brkLoPx !== null && brkHiPx !== null && brkHiPx - brkLoPx > 4) {
                            moveAndArrive((brkLoPx + brkHiPx) / 2, 'bisect->' + res);
                            return;
                        }

                        if (nudges++ < 3) {
                            // THE VIRTUALIZER'S OWN DENSITY, not measured local
                            // heights. Rows between here and the target are mostly
                            // UNMEASURED, and the virtualizer positions unmeasured
                            // rows at its per-row ESTIMATE — so px-distance to the
                            // target is (rows x estimate), whatever the real heights
                            // turn out to be. Both locally-measured alternatives
                            // failed in CI: the span MEAN, inflated 10x by one
                            // 15,000px row, overshot to the bottom and oscillated to
                            // no-progress; the MEDIAN from a short-row region
                            // understepped 4x and walked one row per pass into the
                            // iteration cap. scrollHeight/totalRows IS the estimate,
                            // kept current as measurements land.
                            var pxr = container.scrollHeight / Math.max(1, totalRows);
                            var dest = rowTop(near.el) +
                                       (res - near.dataIndex) * pxr * gain -
                                       container.clientHeight / 3;
                            moveAndArrive(dest, 'nudge->' + res); return;
                        }
                        finish(false, null, 'nudge-cap'); return;
                    }
                    nudges = 0;
                    // Pairs exist but the target is far: GEOMETRY miss, not mapping.
                    // Anchor the interpolation with what we actually observed.
                    var mid = pairs[pairs.length >> 1];
                    var obsPx = Math.round(container.scrollTop);
                    if (mid.d < targetFullPathIdx - U) {
                        if (mid.d >= low.row) low = { row: mid.d, px: obsPx };
                    } else if (mid.d > targetFullPathIdx) {
                        if (mid.d <= high.row) high = { row: mid.d, px: obsPx };
                    }
                    var maxPx = Math.max(0, container.scrollHeight - container.clientHeight);
                    if (high.px > maxPx) high.px = maxPx;
                    if (low.px > maxPx) low.px = maxPx;
                    if (high.row - low.row < 1 || high.px - low.px < 1) {
                        low = { row: 0, px: 0 };
                        high = { row: totalRows - 1, px: maxPx };
                    }
                    var aimRow = ciPredictRowForPath(targetFullPathIdx);
                    if (aimRow === null) aimRow = Math.max(0, targetFullPathIdx - U);
                    var frac = (aimRow - low.row) / ((high.row - low.row) || 1);
                    if (frac < 0) frac = 0; if (frac > 1) frac = 1;
                    var noProgKey = aimRow + '|' + obsPx + '|' +
                                    rows.map(function (x) { return x.dataIndex; }).join(',');
                    if (noProgKey === _lastProgressKey) {
                        if (++_noProgressPasses >= 2) {
                            finish(false, null, 'no-progress'); return;
                        }
                    } else { _noProgressPasses = 0; }
                    _lastProgressKey = noProgKey;
                    shifts = 0;
                    moveAndArrive(low.px + (high.px - low.px) * frac, 'geo->' + aimRow);
                    return;
                }

                // 3c — nothing in the window matches anything. Shift one viewport
                // toward the predicate's guess; after 2 such moves, fail honestly.
                if (shifts++ >= 2) { finish(false, null, 'no-local-match'); return; }
                var gRow = ciPredictRowForPath(targetFullPathIdx);
                if (gRow === null) gRow = Math.max(0, targetFullPathIdx - U);
                var maxPx2 = Math.max(0, container.scrollHeight - container.clientHeight);
                var gPx = (totalRows > 1) ? maxPx2 * (gRow / (totalRows - 1)) : 0;
                var cur = container.scrollTop;
                var step = container.clientHeight *
                           (gPx > cur ? 1 : -1);
                moveAndArrive(Math.abs(gPx - cur) <= container.clientHeight ? gPx
                              : cur + step, '3c-shift');
            } catch (err) {
                console.error('[ACN] jump arrival threw:', err);
                finish(false, null, 'threw');
            }
        }

        // AIM — one initial move; extremes are exact positions through the SAME
        // arrival detection (this is what fixes Q#1 by construction: arrival is one
        // code path, so "row 0 is mounted" cannot go unrecognised again).
        try {
            var destPx;
            var maxPx0 = Math.max(0, container.scrollHeight - container.clientHeight);
            if (_ciRenderable && _ciRenderable.length &&
                targetFullPathIdx === _ciRenderable[0]) destPx = 0;
            else if (_ciRenderable && _ciRenderable.length &&
                targetFullPathIdx === _ciRenderable[_ciRenderable.length - 1]) destPx = maxPx0;
            else {
                var seed = ciResolveRowForPath(targetFullPathIdx);
                var seedRow = (seed && typeof seed.row === 'number') ? seed.row
                    : (seed && typeof seed.lo === 'number')
                        ? Math.floor((seed.lo + seed.hi) / 2)
                        : ciPredictRowForPath(targetFullPathIdx);
                if (seedRow === null) seedRow = Math.max(0, targetFullPathIdx - U);
                destPx = (totalRows > 1) ? maxPx0 * (seedRow / (totalRows - 1)) : 0;
            }
            // Already there? arrive() without moving — the fast path and the loop
            // share arrival, so a mounted target resolves before any scroll.
            var pre = ciMatchTargetInWindow(targetFullPathIdx, ciMountedRows(), U);
            if (pre) { iterations++; succeed(pre, '3a-premove'); return; }
            moveAndArrive(destPx, 'aim');
        } catch (e) {
            console.error('[ACN] jump aim threw:', e);
            finish(false, null, 'threw');
        }
    }

    // Maps normalized message text -> stable message uuid, for callers that only
    // have a DOM node to work from (bookmarks). Built lazily, cleared with the index.
    var _ciTextToUuid = null;

    // `el`, when given, disambiguates DUPLICATE texts: the text map deliberately
    // keeps only the first uuid, so twin messages got one identity and a bookmark on
    // the second twin jumped to the first (Codex round-1 P2). A mounted element's ROW
    // resolves to its exact path entry regardless of what the text says.
    function ciUuidForText(text, el) {
        if (!ciIsReady() || !_ciFullPath) return null;
        if (el && el.closest) {
            var rowEl = el.closest('[' + CI_ROW_ATTR + ']');
            if (rowEl) {
                var di = parseInt(rowEl.getAttribute(CI_ROW_ATTR), 10);
                if (!isNaN(di)) {
                    // MEASURED resolution only. This uuid gets PERSISTED (bookmarks),
                    // and the predicate fallback assigned an adjacent message's
                    // identity whenever the stop-reason predicate missed an unrendered
                    // entry — a durably wrong bookmark (Codex R8 :3022). Unresolvable
                    // stays unresolved; the text map / content hash below are honest.
                    var p = ciResolvePathForRowStrict(di);
                    if (p !== null && _ciFullPath[p]) return _ciFullPath[p].uuid;
                }
            }
        }
        if (!_ciTextToUuid) {
            _ciTextToUuid = {};
            // Ambiguity POISONS a key rather than first-wins resolving it: two
            // messages sharing normalized text (a user and assistant both saying
            // "OK") each got the first one's uuid, and a schema-2 bookmark persisted
            // that wrong identity durably (Codex R11 :3088). A poisoned key returns
            // null and the caller falls back to the honest content hash.
            for (var i = 0; i < _ciFullPath.length; i++) {
                // Markdown-insensitive: the index holds RAW MARKDOWN while callers pass
                // RENDERED DOM text. Keyed on _normalizeKey, any assistant message whose
                // first 200 chars contain **, ##, `, or a list marker never matched, so
                // its bookmark silently degraded to the position-dependent schema 1 —
                // which, with the positional fallback deleted, is unresolvable.
                var t = _normalizeCompare(_ciFullPath[i].text || '');
                if (!t) continue;
                if (_ciTextToUuid.hasOwnProperty(t)) _ciTextToUuid[t] = null; // poisoned
                else _ciTextToUuid[t] = _ciFullPath[i].uuid;
            }
        }
        return _ciTextToUuid[_normalizeCompare(text || '')] || null;
    }

    function ciIsReady() {
        return _ciStatus === 'ready' && !!_ciIndex &&
               _ciConversationId === ciGetConversationUuid();
    }

    function ciInvalidate() {
        // Cancel any in-flight jump: it captured a target index against the OLD path,
        // and the scroll container survives an SPA route change, so the loop would keep
        // driving and could land on a same-numbered row in a different conversation.
        // Safe to bump now that every superseded path calls finish() -> done(), so the
        // caller's busy flag is always cleared.
        _ciJumpToken++;
        _ciIndex          = null;
        _ciFullPath       = null;
        _ciTextToUuid     = null;
        _ciInFlightCid    = null;   // never let an old conversation's request block the new one
        // Usage quota is org-scoped; a conversation switch can land in a different
        // org, and a warm cooldown would show org A's quota for org B for up to five
        // minutes (Codex :3943).
        _usageLastFetch   = 0;
        // Anchors are (dataIndex -> path index) pairs for THIS conversation's tree. A
        // route change renumbers everything, so carrying them over would map confidently
        // into the wrong conversation.
        _ciRenderable     = null;
        ciResetAnchors();
        _ciConversationId = null;
        _ciStatus         = 'idle';
        _ciDegradedReason = '';
        _ciTruncatedCount = 0;
        _ciUsedLeafFallback = false;
        _ciPathComplete   = true;
        // Org is per-account, but a stale in-memory value would survive an account
        // switch; the GM cache is account-validated, so re-resolving is cheap.
        _ciOrgUuid        = null;
    }

    // ============================================================
    // QUESTION DETECTION ENGINE
    // ============================================================
    function getUserMessages() {
        return platform.getUserMessages();
    }

    function getAIMessages() {
        if (platform && platform.getAIMessages) return platform.getAIMessages();
        return [];
    }

    // Detected questions — consumed by Navigate and Search panels
    var _aiResponses = [];

    function generateSummary(text) {
        var summary = text.trim();
        summary = summary.replace(/```[\s\S]*?```/g, '[code]');
        var questionMatch = summary.match(/^[^.!?]*\?/);
        if (questionMatch && questionMatch[0].length > 10) {
            return questionMatch[0].trim();
        }
        var firstSentence = summary.match(/^[^.!?\n]+[.!?]?/);
        if (firstSentence) summary = firstSentence[0];
        if (summary.length > 120) summary = summary.substring(0, 117) + '...';
        return summary || text.substring(0, 100) + '...';
    }

    // Detected questions — consumed by Navigate and Search panels
    var _questions = []; // [{ element, text, summary, vsIndex? }]
    var _vsAccumulatedKeys = new Set();
    var _navListFingerprint    = ''; // used to skip DOM rebuild when questions are unchanged
    var _searchListFingerprint = ''; // same guard for search panel
    var _ciIndexGen = 0;             // bumped on every index (re)build: a same-count
                                     // branch swap must still invalidate cached search
                                     // results (Codex R5 :1617)
    var _bmListFingerprint     = ''; // same guard for bookmarks panel
    var _panelWidth            = 310; // current panel width — persisted in localStorage

    // ── Tier 1: Claude SSE hybrid token state ─────────────────
    var _sseTokenData = {
        lastUpdated:          0,
        exact:                false,  // true = SSE thinking data available this session
        cached:               false,  // true = loaded from GM cache
        cumulativeThinkingChars: 0,   // total thinking chars across ALL messages (never resets)
        sseMessageCount:         0    // fully-completed assistant messages observed via SSE
    };
    // Per-message accumulator (reset on each message_start)
    var _currentMsgThinkingChars = 0;
    var _compactionCount  = 0;  // total number of compactions observed this session
    var _compactionHistory = []; // turn numbers at which compaction was detected

    // ── Tier 2: Non-Claude turn counter state ─────────────────
    var _turnCounter = {
        totalTurns:          0,
        turnsSinceCompact:   0,
        compactionCount:     0,
        cycleLengths:        [],   // lengths of completed cycles between compactions
        predictedCycleLength: null,
        lastCompactTurn:     0
    };

    // ── Plan usage (Claude only) ───────────────────────────────
    var USAGE_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
    var _usageData     = null;
    var _usageLastFetch = 0;
    var _usageOrgUuid   = null;   // org the cached usage was fetched FOR
    var _usageRefreshTimer = null; // debounce timer for maybeRefreshUsage

    // Extracts display text from a mounted DOM node, shared by the DOM scan and
    // the index's DOM-merge path.
    // Reads a node's text while EXCLUDING our own injected bookmark icon.
    //
    // createBookmarkIcon() appends the icon as a child of the message element, so
    // a naive textContent read picks up its glyph. That contamination is not
    // cosmetic: the conversation index matches DOM text against API text by
    // normalized 200-char prefix, so every message shorter than 200 characters
    // would fail to match, be treated as new, get appended as a provisional
    // entry (duplicating it in the list), and keep _ciNeedsResync() permanently
    // true — triggering a 3.3MB refetch every cooldown period, forever.
    // Nodes excluded from EVERY text read, platform-wide:
    //
    //   [data-acn-bookmark]  our own injected bookmark icon. Reading it back
    //                        contaminated index<->DOM matching for short messages
    //                        and drove a permanent refetch loop (Tier 3 CRITICAL).
    //
    //   .sr-only             the platform's screen-reader-only labels. ChatGPT emits
    //                        "You said:", Claude emits "Claude responded:" and a
    //                        "Load earlier messages" button, and all of it lands in
    //                        textContent. Previously only ChatGPT's was handled, by
    //                        a regex in one caller — so Claude's assistant prefix
    //                        still reached Search, Export and Summary.
    //
    // Fixed here, in the shared extractor, rather than per-caller: every consumer
    // reads through this path, so a per-caller strip is guaranteed to miss one.
    // Matches sr-only as a whole class token, INCLUDING Tailwind responsive variants
    // (sm:sr-only, md:sr-only) whose separator is ':' not whitespace — but NOT
    // `not-sr-only`, whose entire purpose is to make content visible again.
    // Token boundary is start/whitespace, optionally preceded by a variant prefix.
    // Variant prefixes can contain '/', '&', '[', ']', '>', ':' etc.
    // (group-hover/edit:sr-only, [&>*]:sr-only), so the prefix class is permissive —
    // but it must NOT swallow a preceding '-', or `not-sr-only` would match.
    var _SR_ONLY_RE = /(^|\s)(?:[^\s-]|[^\s]-[^\s])*?[:\]]sr-only(\s|$)|(^|\s)sr-only(\s|$)/i;

    function _isSrOnlyClassList(cls) {
        cls = (typeof cls === 'string' ? cls : (cls && cls.baseVal) || '');
        return _SR_ONLY_RE.test(cls);
    }

    function _isExcludedFromText(n) {
        if (!n || n.nodeType !== 1) return false;
        if (n.getAttribute && n.getAttribute('data-acn-bookmark') !== null) return true;
        return _isSrOnlyClassList(n.className);
    }

    function _cleanText(el) {
        if (!el) return '';
        // Fast path: nothing excluded inside, read it directly.
        // [class*="sr-only"] so the fast path also catches variant-prefixed tokens
        // (sm:sr-only) that the slow path's regex excludes — otherwise the two paths
        // disagree and a variant label survives into the text.
        if (!el.querySelector ||
            !el.querySelector('[data-acn-bookmark], .sr-only, [class*="sr-only"]')) {
            return el.textContent || el.innerText || '';
        }
        var out = '';
        var kids = el.childNodes;
        for (var i = 0; i < kids.length; i++) {
            var n = kids[i];
            // ONLY elements (1) and text nodes (3). Recursing into a Comment node (8)
            // would emit its contents: CharacterData.textContent IS the comment body,
            // while Element.textContent excludes comments entirely. That made the slow
            // path and the fast path return DIFFERENT strings for the same element,
            // depending only on whether a bookmark icon had been injected yet.
            // Verified live: Grok's first Navigate entry rendered "D: Inner layout
            // wrapper..." — the mock's HTML comment — instead of the question.
            // Load-bearing beyond cosmetics: it breaks ciDeriveRowOffset (no row
            // matches the API text), which kills jump entirely, and makes every
            // mounted message look new to _ciMergeLiveMessages, which reinstates the
            // permanent-refetch loop this extractor exists to prevent.
            if (n.nodeType !== 1 && n.nodeType !== 3) continue;
            if (_isExcludedFromText(n)) continue;
            out += _cleanText(n);
        }
        return out;
    }

    function _readMessageText(msg) {
        var proseEl = platform.textExtractor ? platform.textExtractor(msg) : null;
        // No "You said:" regex any more — the label is an .sr-only node and is now
        // removed structurally. A regex could never distinguish the platform's label
        // from a user message that legitimately begins with those words.
        return (_cleanText(proseEl || msg) || '').trim();
    }

    // Assistant-side reader. Same exclusions — this is where Claude's
    // "Claude responded:" sr-only prefix used to leak into Search and Export.
    function _readAIText(el) {
        return (_cleanText(el) || '').trim();
    }

    function _normalizeKey(text) {
        // Coerce rather than trusting callers: several call sites pass the result of
        // a DOM read or an index lookup without a `|| ''` guard.
        return String(text == null ? '' : text)
            .substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // Binds index entries to whichever DOM nodes happen to be mounted right now.
    // Under virtualization only a handful will match; the rest keep element:null
    // until Phase 3's settle loop mounts them on demand.
    function _ciBindMountedElements(questions) {
        var mounted = Array.from(getUserMessages());
        if (!mounted.length) return;
        // Both normalizers: the index holds RAW MARKDOWN, the DOM holds RENDERED
        // text, so _normalizeKey alone never matched a markdown-bearing question and
        // its element stayed null even while mounted.
        // ROW IDENTITY FIRST (Codex :2489): with two mounted "continue" turns a text
        // map overwrote the earlier node with the later one and bound BOTH indexed
        // occurrences to it — clicking either Navigate entry confidently scrolled to
        // the latest duplicate. A row's path position is exact regardless of text.
        var byPath = {};
        var rowsB = (typeof ciMountedRows === 'function' && ciIsClaudeChat()) ? ciMountedRows() : [];
        for (var r = 0; r < rowsB.length; r++) {
            if (!rowsB[r].isUser) continue;
            var pth = ciResolvePathForRowStrict(rowsB[r].dataIndex);
            if (pth === null) pth = ciMatchRowToPath(rowsB[r]);
            if (pth === null && _ciRenderable && rowsB[r].dataIndex < _ciRenderable.length) {
                pth = _ciRenderable[rowsB[r].dataIndex];
            }
            if (pth !== null) {
                var node = rowsB[r].el.querySelector('[data-testid="user-message"]');
                if (node) byPath[pth] = node;
            }
        }
        var byKey = {};
        for (var i = 0; i < mounted.length; i++) {
            var t = _readMessageText(mounted[i]);
            if (!t) continue;
            byKey[_normalizeKey(t)] = mounted[i];
            byKey[_normalizeCompare(t)] = mounted[i];
        }
        for (var j = 0; j < questions.length; j++) {
            var el = byPath[questions[j].pathIndex] ||
                     byKey[_normalizeKey(questions[j].text)] ||
                     byKey[_normalizeCompare(questions[j].text)];
            questions[j].element = el || null;
        }
    }

    // Appends messages that are mounted but absent from the index. The index is a
    // snapshot, so a turn sent after it was fetched would otherwise be missing.
    // New turns are always mounted (the user is at the bottom when they send one),
    // so a DOM read is sufficient and costs no network. Provisional entries carry
    // no uuid until the next refetch.
    function _ciMergeLiveMessages(questions) {
        var mounted = Array.from(getUserMessages());
        if (!mounted.length) return false;

        // Markdown-insensitive membership, matching the jump and bookmark paths.
        // With _normalizeKey alone, a mounted question whose API text carries markdown
        // never matched its own index entry: it was appended as a provisional
        // duplicate AND _ciNeedsResync() kept refetching the multi-megabyte
        // conversation every cooldown, indefinitely (Codex round-1 P1).
        // OCCURRENCE COUNTS, not set membership. Exact repeats ("continue") are
        // common; with a plain set the second send matched the first occurrence, was
        // never appended, and - since provisionals are also the resync signal - the
        // index never refreshed either: the new turn was invisible everywhere
        // (Codex :1822, P1). A repeat only counts as known while the index holds at
        // least as many occurrences as are mounted.
        // ROW IDENTITY decides what is NEW (Codex round-3 P1). Text-count comparison
        // failed twice: a set suppressed exact repeats entirely, and comparing
        // mounted-window counts against WHOLE-HISTORY counts still suppressed a new
        // prompt that repeated an old, unmounted turn ("continue" repeating last
        // week's "continue"). A genuinely new turn is appended by the virtualizer at
        // a dataIndex BEYOND the indexed renderable range — no text needed. A row
        // inside the range that resolves to a path entry is known regardless of what
        // its text matches.
        var newRowEls = null;
        if (ciIsClaudeChat() && _ciRenderable && typeof ciMountedRows === 'function') {
            newRowEls = [];
            var mrRows = ciMountedRows();
            for (var mr = 0; mr < mrRows.length; mr++) {
                if (!mrRows[mr].isUser) continue;
                var mDi = mrRows[mr].dataIndex;
                // Boundary for THE FETCHED SNAPSHOT. While the predicate holds
                // (unwarned), renderable length IS the snapshot's row count — crucially
                // it cannot be inflated by a message sent while the fetch was in
                // flight, which the lazily-measured aria-setsize CAN be: measuring
                // after the new row appeared classified that new prompt as inside the
                // index, so it never went provisional (Codex R12 :3388). The measured
                // capture survives only as the fallback once the predicate has been
                // caught wrong, where the smaller of the two bounds is honest.
                var newBound = _ciPredicateWarned && _ciRowsAtBuild !== null
                    ? Math.min(_ciRowsAtBuild, _ciRenderable.length)
                    : _ciRenderable.length;
                if (mDi < newBound) continue;                          // within indexed range
                if (ciResolvePathForRowStrict(mDi) !== null) continue; // anchored: known
                var mNode = mrRows[mr].el.querySelector('[data-testid="user-message"]');
                if (mNode) newRowEls.push(mNode);
            }
        }
        // Canonical-key counting stays as the NON-ROW fallback (no virtualizer
        // metadata -> no row identity to use).
        var known = {};
        for (var i = 0; i < questions.length; i++) {
            var kc = _normalizeCompare(questions[i].text);
            known[kc] = (known[kc] || 0) + 1;
        }
        var seen = {};
        var appended = false;
        var mergeList = (newRowEls !== null) ? newRowEls : mounted;
        for (var j = 0; j < mergeList.length; j++) {
            var text = _readMessageText(mergeList[j]);
            if (!text) continue;
            var key = _normalizeCompare(text);
            if (newRowEls === null) {
                seen[key] = (seen[key] || 0) + 1;
                if ((known[key] || 0) >= seen[key]) continue;
                known[key] = (known[key] || 0) + 1;
            }
            questions.push({
                uuid:        null,
                text:        text,
                summary:     generateSummary(text),
                pathIndex:   Number.MAX_SAFE_INTEGER,  // sorts to the end
                createdAt:   null,
                attachments: [],
                files:       [],
                truncated:   false,
                element:     mergeList[j],
                provisional: true
            });
            appended = true;
        }
        return appended;
    }

    // Signals that the index no longer matches reality and should be refetched.
    //
    // A provisional entry means the DOM holds a turn the index does not. That is
    // either a newly sent message or an edit/regenerate that rewrote the tree —
    // and the DOM genuinely cannot distinguish the two, because neither changes
    // the URL and only ~3 turns are visible. Refetching resyncs either case, and
    // also upgrades provisional entries to real uuids so bookmarks can key to them.
    //
    // (An earlier version compared the newest mounted turn against the question
    // list. That could never fire: the merge runs first and guarantees every
    // mounted turn is present, so the tail always matched.)
    function _ciNeedsResync(questions) {
        for (var i = 0; i < questions.length; i++) {
            if (questions[i].provisional) return true;
        }
        return false;
    }

    // Assistant-side staleness. Provisional HUMAN turns were the only resync signal,
    // so regenerating an answer — which changes no prompt — left Search, Summary,
    // Export and context tracking on the previous branch until the next distinct
    // prompt (Codex :3252, P1). A mounted assistant row that matches no path entry is
    // the tell. STREAMING GUARD: a mid-generation answer also matches nothing and
    // grows every scan, so only a mismatch signature that is IDENTICAL across two
    // consecutive scans counts — a stream changes length; a settled regeneration
    // does not.
    var _ciLastAsstMismatch = '';
    function _ciAssistantStale() {
        if (!ciIsReady() || !_ciFullPath) return false;
        var rows = ciMountedRows(), sig = '', i;
        for (i = 0; i < rows.length; i++) {
            var inner = ciMessageNodeWithin(rows[i].el);
            if (!inner || inner === rows[i].el) continue;
            var t = _normalizeCompare(_readMessageText(inner));
            if (rows[i].isUser) {
                // EDITED PROMPT (Codex R5 :3301): an edit keeps its row INSIDE the
                // indexed range, so row-identity marks it known — but its content no
                // longer matches its own path entry. Compare against the entry the
                // row resolves to; a stable mismatch is the resync signal the merge
                // and the short-answer assistant check both miss.
                if (!t) continue;
                var up = ciResolvePathForRowStrict(rows[i].dataIndex);
                if (up === null && _ciRenderable &&
                    rows[i].dataIndex < _ciRenderable.length) {
                    up = _ciRenderable[rows[i].dataIndex];
                }
                if (up === null || !_ciFullPath[up]) continue;
                var ue = _ciFullPath[up];
                if (ue.sender !== 'human') continue;
                if (ue.textSource && ue.textSource !== 'content') continue;
                var ut = _normalizeCompare(ue.text || '');
                if (ut && t !== ut) sig += 'e' + rows[i].dataIndex + ':' + t.length + ';';
                continue;
            }
            // Long responses: global unique text match. SHORT responses cannot match
            // globally (the 60-char floor exists to avoid collisions), which used to
            // mean a regenerated short answer never reached this signal at all
            // (Codex R7 :3417) — compare those against the entry their ROW resolves
            // to, the same identity path the user-row edit check uses.
            if (t.length >= 60) {
                if (ciMatchRowToPath(rows[i]) === null) {
                    sig += rows[i].dataIndex + ':' + t.length + ';';
                }
                continue;
            }
            if (!t) continue;
            var ap = ciResolvePathForRowStrict(rows[i].dataIndex);
            if (ap === null && _ciRenderable &&
                rows[i].dataIndex < _ciRenderable.length) {
                ap = _ciRenderable[rows[i].dataIndex];
            }
            if (ap === null || !_ciFullPath[ap]) continue;
            var ae = _ciFullPath[ap];
            if (ae.sender !== 'assistant') continue;
            if (ae.textSource && ae.textSource !== 'content') continue;
            var at2 = _normalizeCompare(ae.text || '');
            if (at2 && t !== at2) sig += 's' + rows[i].dataIndex + ':' + t.length + ';';
        }
        if (!sig) { _ciLastAsstMismatch = ''; return false; }
        if (sig === _ciLastAsstMismatch) return true;
        _ciLastAsstMismatch = sig;
        return false;
    }

    function scanConversation(forceReset) {
        // ── Claude: index-backed path ────────────────────────────
        // The DOM holds ~3% of a long conversation, so it cannot be the source of
        // truth. When the index is available it wins; the DOM scan below stays as
        // the fallback and remains the path for every other platform.
        if (ciIsClaudeChat()) {
            // Conversation switched: drop the previous payload immediately rather
            // than holding a multi-megabyte active path for a conversation the user
            // has navigated away from. Claude is registered with spa:false, so the
            // pushState/popstate handlers never fire here — this is the only place
            // a conversation change is observed.
            if (_ciConversationId && _ciConversationId !== ciGetConversationUuid()) {
                ciInvalidate();
            }

            if (ciIsReady()) {
                // Harvest row anchors from whatever the virtualizer currently has mounted.
                // The scan runs on every mutation batch, so ORDINARY SCROLLING builds the
                // row map before any jump is ever requested — by the time the user clicks,
                // the target is usually already bracketed and resolves exactly. Cheap
                // (only unanchored rows are examined) and idempotent.
                ciHarvestAnchors();
                ciValidatePredicate();

                var indexed = _ciIndex.slice();
                _ciMergeLiveMessages(indexed);
                indexed.sort(function (a, b) { return a.pathIndex - b.pathIndex; });
                _ciBindMountedElements(indexed);
                _questions = indexed;

                _aiResponses = Array.from(getAIMessages());
                if (typeof injectBookmarkIcons === 'function') injectBookmarkIcons();
                if (typeof orbOnScanComplete === 'function') orbOnScanComplete();

                if ((_ciNeedsResync(_questions) || _ciAssistantStale()) &&
                    (Date.now() - _ciLastRefetchAt) > CI_REFETCH_COOLDOWN_MS) {
                    _ciLastRefetchAt = Date.now();
                    console.log('[ACN] index out of sync with DOM (new message, edit, or ' +
                                'regenerate) — refetching');
                    ciLoadIndex(true, function () { scanConversation(true); });
                }
                return;
            }
            // Not ready yet: kick off a load, then fall through to the DOM scan so
            // the panel shows something immediately rather than an empty list.
            var degradedRetryDue = _ciStatus === 'degraded' &&
                (Date.now() - _ciLastRefetchAt) >
                    Math.max(CI_REFETCH_COOLDOWN_MS, _ciRetryDelayMs);
            if (_ciStatus === 'idle' ||
                _ciConversationId !== ciGetConversationUuid() ||
                degradedRetryDue) {
                if (degradedRetryDue) _ciLastRefetchAt = Date.now();
                ciLoadIndex(false, function (ok) {
                    if (ok) scanConversation(true);
                });
            }
        }

        var messages = getUserMessages();

        if (isVirtualScroll && !forceReset) {
            if (messages.length === 0) return;
            var addedNew = false;
            messages.forEach(function (msg) {
                var text = _readMessageText(msg);
                if (!text.trim()) return;
                var key = _normalizeKey(text);
                if (!_vsAccumulatedKeys.has(key)) {
                    _vsAccumulatedKeys.add(key);
                    var virtuosoItem = msg.closest('[data-index]');
                    var vsIndex = virtuosoItem
                        ? parseInt(virtuosoItem.getAttribute('data-index'), 10)
                        : _questions.length;
                    _questions.push({ element: msg, text: text, summary: generateSummary(text), vsIndex: vsIndex });
                    addedNew = true;
                }
            });
            if (addedNew) {
                _questions.sort(function (a, b) { return (a.vsIndex || 0) - (b.vsIndex || 0); });
            }
        } else {
            if (isVirtualScroll) _vsAccumulatedKeys.clear();
            _questions = [];
            if (messages.length > 0) {
                messages.forEach(function (msg) {
                    var text = _readMessageText(msg);
                    if (!text.trim()) return;
                    if (isVirtualScroll) {
                        var key = _normalizeKey(text);
                        _vsAccumulatedKeys.add(key);
                        var virtuosoItem = msg.closest('[data-index]');
                        var vsIndex = virtuosoItem
                            ? parseInt(virtuosoItem.getAttribute('data-index'), 10)
                            : _questions.length;
                        _questions.push({ element: msg, text: text, summary: generateSummary(text), vsIndex: vsIndex });
                    } else {
                        _questions.push({ element: msg, text: text, summary: generateSummary(text) });
                    }
                });
            }
        }

        // Refresh AI responses array in sync with question scan
        _aiResponses = Array.from(getAIMessages());
        if (typeof injectBookmarkIcons === 'function') injectBookmarkIcons();

        // Notify orbital panels of updated question list
        if (typeof orbOnScanComplete === 'function') orbOnScanComplete();
    }

    // ============================================================
    // MESSAGE OBSERVER
    // ============================================================
    function startMessageObserver() {
        var scanTimeout = null;
        var observer = new MutationObserver(function () {
            // Guard orbital zone — SPAs can rip it out
            if (orbInjected && !document.getElementById('acn-zone')) {
                orbInjected = false;
                setTimeout(injectOrbital, 0);
            }
            // Debounced re-scan
            if (scanTimeout) clearTimeout(scanTimeout);
            scanTimeout = setTimeout(scanConversation, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return observer;
    }

    // ============================================================
    // INITIALIZATION (Phase 1 infrastructure)
    // ============================================================
    if (platform.spa) {
        var _origPushState = history.pushState;
        var _origReplaceState = history.replaceState;

        var pushProxy = function () {
            _origPushState.apply(this, arguments);
            if (isVirtualScroll) _vsAccumulatedKeys.clear();
            _questions = [];
            resetTurnCounter();
            if (platform.id === 'claude') setTimeout(_loadCachedSSEData, 600);
            if (typeof orbClosePanel === 'function') orbClosePanel();
            setTimeout(scanConversation, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };

        var replaceProxy = function () {
            _origReplaceState.apply(this, arguments);
            _questions = [];
            resetTurnCounter();
            if (platform.id === 'claude') setTimeout(_loadCachedSSEData, 600);
            setTimeout(scanConversation, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };

        // Firefox cross-compartment fix: history.pushState and replaceState are
        // page-context functions. If our replacements live in the userscript sandbox,
        // any page JS that calls .bind() on them will crash with "Permission denied".
        // exportFunction clones them into the page context.
        if (typeof exportFunction === 'function') {
            history.pushState = exportFunction(pushProxy, history);
            history.replaceState = exportFunction(replaceProxy, history);
        } else {
            history.pushState = pushProxy;
            history.replaceState = replaceProxy;
        }

        window.addEventListener('popstate', function () {
            if (isVirtualScroll) _vsAccumulatedKeys.clear();
            _questions = [];
            resetTurnCounter();
            if (platform.id === 'claude') setTimeout(_loadCachedSSEData, 600);
            if (typeof orbClosePanel === 'function') orbClosePanel();
            setTimeout(scanConversation, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        });
    }

    if (isLeftChat) {
        setTimeout(updateLeftChatPositions, 500);
        setTimeout(updateLeftChatPositions, 900);
        setTimeout(updateLeftChatPositions, 1500);
        setTimeout(updateLeftChatPositions, 3000);
        setTimeout(updateLeftChatPositions, 6000);

        window.addEventListener('resize', function () {
            _lastBoundaryX = null;
            updateLeftChatPositions();
        });

        window.addEventListener('scroll', updateLeftChatPositions, { passive: true });
        setInterval(updateLeftChatPositions, 3000);
    }

    // Unconditional resize listener for hitzone geometry (needed on all platforms)
    window.addEventListener('resize', orbUpdateHitzone);

    startMessageObserver();
    setTimeout(scanConversation, 2000);

    if (platform.retryDelays.length > 0) {
        platform.retryDelays.forEach(function (delay) {
            setTimeout(function () {
                if (_questions.length === 0) {
                    console.log('AI Nav: retry scan at ' + delay + 'ms (' + platform.title + ')...');
                    scanConversation();
                }
            }, delay);
        });
    }


    // ============================================================
    // ============================================================
    // PHASE 2: ORBITAL BUTTON SYSTEM
    // ============================================================
    // ============================================================

    // ── Platform color palette ──────────────────────────────────
    var ORB_COLORS = {
        claude:         { bg: '#d97706', rgb: '217,119,6',   shadow: 'rgba(217,119,6,.25)' },
        chatgpt:        { bg: '#ffffff', rgb: '255,255,255', shadow: 'rgba(255,255,255,.25)' },
        grok:           { bg: '#e53e3e', rgb: '229,62,62',   shadow: 'rgba(229,62,62,.25)' },
        gemini:         { bg: '#4285f4', rgb: '66,133,244',  shadow: 'rgba(66,133,244,.25)' },
        perplexity:     { bg: '#20b2aa', rgb: '32,178,170',  shadow: 'rgba(32,178,170,.25)' },
    };
    // App builders use Claude orange
    var orbTheme = ORB_COLORS[platform.id] || ORB_COLORS.claude;

    // ── Feature registry ────────────────────────────────────────
    var ORB_FEATURES = [
        { id: 'nav',       i18nKey: 'navigate',  icon: '\u2733', label: i18n('navigate')  || 'Navigate',  panelId: 'acn-panel-nav' },
        { id: 'search',    i18nKey: 'search',    icon: '\u2315', label: i18n('search')    || 'Search',    panelId: 'acn-panel-search' },
        { id: 'bookmarks', i18nKey: 'bookmarks', icon: '\u2691', label: i18n('bookmarks') || 'Bookmarks', panelId: 'acn-panel-bookmarks' },
        { id: 'summary',   i18nKey: 'summary',   icon: '\u03A3', label: i18n('summary')   || 'Summary',   panelId: 'acn-panel-summary' },
        { id: 'tools',     i18nKey: 'tools',     icon: '\uD83D\uDD27', label: i18n('tools') || 'Tools',   panelId: 'acn-panel-tools' },
        { id: 'settings',  i18nKey: 'settings',  icon: '\u2699', label: i18n('settings')  || 'Settings',  panelId: 'acn-panel-settings' },
    ];
    var ORB_N    = ORB_FEATURES.length;  // 6
    var ORB_MAIN = 0;                     // Navigate is always index 0
    var ORB_CX   = 42;                    // center axis from right edge (px)

    var HITZONE_PAD_X = 30;  // px of extra width beyond the rightmost dot edge
    var HITZONE_PAD_Y = 40;  // px of vertical padding above/below the dot stack

    // Context window token limits per platform (for usage bar estimation)
    var CTX_LIMITS = {
        claude:     200000,
        chatgpt:    128000,
        grok:       131072,
        gemini:     1000000,
        perplexity: 127072,
    };

    // ── Orbital state ───────────────────────────────────────────
    var orbMode      = 'show-all'; // 'show-all' | 'arc' | 'wheel'
    var orbPanel     = null;       // open panel feature id, or null
    var orbHovering  = false;
    var orbRotIdx    = 0;
    var orbPrevRotIdx = 0;
    var orbAnimLock  = false;
    var orbInjected  = false;
    var orbDots      = [];
    var orbConns     = [];
    var orbScrollInverted = false; // true = natural scroll
    var orbSearchQuery = '';

    // ── Zone drag state ─────────────────────────────────────────
    var _orbYRatio              = 0.5;   // vertical center as fraction of viewport height
    var _orbDragActive          = false; // true while mouse is held down
    var _orbDragMoved           = false; // true once 5px threshold is crossed
    var _orbDragStartY          = 0;     // clientY at mousedown
    var _orbDragStartRatio      = 0.5;   // _orbYRatio at drag start
    var _orbGlobalHandlersAttached = false; // guard against stacking on SPA reinjection

    // ── Settings persistence ────────────────────────────────────
    function orbLoadSettings() {
        try {
            var saved = JSON.parse(localStorage.getItem('_acnv10') || '{}');
            orbMode           = saved.mode      || 'show-all';
            orbScrollInverted = saved.natural   === true;
            _panelWidth       = saved.panelWidth || 310;
        } catch (e) {}
    }
    function orbSaveSettings() {
        try {
            localStorage.setItem('_acnv10', JSON.stringify({
                mode:       orbMode,
                natural:    orbScrollInverted,
                panelWidth: _panelWidth,
            }));
        } catch (e) {}
    }

    // ── Zone position persistence (per-platform, GM storage) ───
    function _orbLoadZonePosition() {
        try {
            var positions = GM_getValue('acn-zone-positions', {});
            _orbYRatio = (positions[platform.id] !== undefined) ? positions[platform.id] : 0.5;
            _orbYRatio = _orbClampYRatio(_orbYRatio);
        } catch (e) { _orbYRatio = 0.5; }
    }
    function _orbSaveZonePosition() {
        try {
            var positions = GM_getValue('acn-zone-positions', {});
            positions[platform.id] = _orbYRatio;
            GM_setValue('acn-zone-positions', positions);
        } catch (e) {}
    }
    // Returns the vertical center pixel for the orbital cluster
    function _orbGetCy() {
        return _orbYRatio * window.innerHeight;
    }
    // Clamps a Y ratio so all dots (worst-case: show-all mode) stay within viewport
    function _orbClampYRatio(ratio) {
        var h = window.innerHeight;
        // show-all: topmost satellite at cy - 2*48 - 16 = cy - 112; topmost Navigate edge at cy - 24
        // bottommost satellite at cy + 3*48 + 16 = cy + 160
        var PAD    = 20;
        var minCy  = 112 + PAD;
        var maxCy  = h - 160 - PAD;
        if (maxCy < minCy) { minCy = h * 0.2; maxCy = h * 0.8; }
        var r = ratio;
        if (r < minCy / h) r = minCy / h;
        if (r > maxCy / h) r = maxCy / h;
        return r;
    }

    // ── Global drag handlers (module scope — one reference, safe to add once) ──
    // Defined here so they are the same function reference across SPA reinjections,
    // making it safe to guard registration with _orbGlobalHandlersAttached.
    function _orbDragMove(e) {
        if (!_orbDragActive) return;
        var deltaY = e.clientY - _orbDragStartY;
        if (!_orbDragMoved && Math.abs(deltaY) > 5) {
            _orbDragMoved = true;
            if (orbPanel) { orbClosePanel(); }
            var z = document.getElementById('acn-zone');
            if (z) z.classList.add('acn-dragging');
        }
        if (!_orbDragMoved) return;
        // Clamp _orbYRatio to the final position (used on mouseup)
        _orbYRatio = _orbClampYRatio(_orbDragStartRatio + deltaY / window.innerHeight);
        // During drag: move the zone with a GPU-composited transform instead of
        // calling orbRender() on every mousemove event. This avoids per-frame
        // layout reflows and makes the drag feel instant.
        var zone = document.getElementById('acn-zone');
        if (zone) {
            var offsetPx = (_orbYRatio - _orbDragStartRatio) * window.innerHeight;
            zone.style.transform = 'translateY(' + offsetPx + 'px)';
        }
    }
    function _orbDragEnd() {
        if (!_orbDragActive) return;
        _orbDragActive = false;
        var z = document.getElementById('acn-zone');
        if (z) {
            z.classList.remove('acn-dragging');
            z.style.transform = ''; // Clear drag transform before final render
        }
        if (_orbDragMoved) {
            _orbSaveZonePosition();
            orbUpdateHitzone();
            orbRender(); // One render to set correct dot positions at new location
            // Suppress the click event that immediately follows mouseup after a drag.
            // Store the reference so the timeout can also remove it — without this,
            // if mouseup fired outside the browser window (blur path), no click ever
            // fires and the canceller would swallow the user's next legitimate click.
            var _cancelDragClick = function (ev) {
                ev.stopImmediatePropagation();
                ev.preventDefault();
                document.removeEventListener('click', _cancelDragClick, true);
            };
            document.addEventListener('click', _cancelDragClick, true);
            setTimeout(function () {
                document.removeEventListener('click', _cancelDragClick, true);
            }, 300);
        }
        _orbDragMoved = false;
    }
    function _orbResizeHandler() {
        _orbYRatio = _orbClampYRatio(_orbYRatio);
        orbUpdateHitzone();
        orbRender();
    }
    // Call once per page load — subsequent calls from SPA reinjection are no-ops
    function _orbAttachGlobalDragHandlers() {
        if (_orbGlobalHandlersAttached) return;
        _orbGlobalHandlersAttached = true;
        document.addEventListener('mousemove', _orbDragMove);
        document.addEventListener('mouseup',   _orbDragEnd);
        // Reset drag state when the user releases the mouse outside the browser window
        window.addEventListener('blur',   _orbDragEnd);
        window.addEventListener('resize', _orbResizeHandler);
    }

    // ── Orbital panel update hook (called by scanConversation) ──
    function orbOnScanComplete() {
        if (orbPanel === 'nav')    orbPopulateNavigate();
        if (orbPanel === 'search') orbPopulateSearch(orbSearchQuery);
        updateTurnCounter();
        var bmPanel = document.getElementById('acn-panel-bookmarks');
        if (bmPanel && bmPanel.classList.contains('acn-open')) {
            orbRefreshBookmarksPanel();
        }
    }

    // ============================================================
    // SSE INTERCEPTOR — Tier 1 (Claude exact token tracking)
    // ============================================================

    function setupClaudeSSEInterceptor() {
        // Firefox cross-compartment: even with exportFunction() wrapping, our fetch
        // proxy contaminates the response pipeline. Sandbox-compartment functions
        // that call page-context fetch produce tainted return values — breaking
        // Claude's chat history, connectors, and conversation loading. SSE token
        // tracking is not worth breaking core Claude functionality.
        // Skip fetch interception entirely on Firefox.
        if (typeof exportFunction === 'function') return;

        // Tampermonkey sandbox: `window` is a wrapper, not the real page window.
        // Claude.ai's JS uses the real window.fetch — we must patch that one.
        var pw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

        if (typeof pw.fetch !== 'function') return;
        if (pw._acnFetchPatched) return; // idempotent
        pw._acnFetchPatched = true;

        var _nativeFetch = pw.fetch.bind(pw);

        pw.fetch = function acnFetchProxy(input, init) {
            var url = (typeof input === 'string') ? input :
                      (input && input.url) ? input.url : '';

            var isClaude = url.indexOf('claude.ai') !== -1 ||
                           url.indexOf('/api/organizations') !== -1 ||
                           url.indexOf('/api/append_message') !== -1 ||
                           url.indexOf('/completion') !== -1;

            var result = _nativeFetch.apply(this, arguments);

            if (isClaude) {
                // Fire-and-forget: tap SSE streams without touching the return chain.
                result.then(function (response) {
                    var ct = response.headers && response.headers.get('content-type');
                    if (ct && ct.indexOf('text/event-stream') !== -1) {
                        var cloned = response.clone();
                        readSSEStream(cloned.body);
                    }
                }).catch(function () {});
            }

            return result;
        };
    }

    function readSSEStream(body) {
        if (!body || typeof body.getReader !== 'function') return;

        var reader  = body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer  = '';

        function pump() {
            reader.read().then(function (result) {
                if (result.done) return;

                // Cross-realm fix: page-realm Uint8Array must be copied into sandbox realm
                var copied = new Uint8Array(result.value);
                buffer += decoder.decode(copied, { stream: true });

                // Split on double-newline (SSE event boundary, Claude uses \r\n)
                var parts = buffer.split(/\r?\n\r?\n/);
                buffer = parts.pop(); // last part may be incomplete

                for (var i = 0; i < parts.length; i++) {
                    if (parts[i].trim()) {
                        parseSSEEvent(parts[i]);
                    }
                }

                pump(); // recurse
            }).catch(function () {
                // Stream was aborted — silently ignore
            });
        }

        pump();
    }

    function parseSSEEvent(eventStr) {
        var lines = eventStr.split(/\r?\n/);
        var eventType = '';
        var dataStr   = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('event:') === 0) {
                eventType = line.slice(6).trim();
            } else if (line.indexOf('data:') === 0) {
                dataStr = line.slice(5).trim();
            }
        }

        if (!dataStr || dataStr === '[DONE]') return;

        var payload;
        try {
            payload = JSON.parse(dataStr);
        } catch (e) {
            return;
        }

        // ── message_start: reset per-message accumulator ───────────
        if (eventType === 'message_start') {
            _currentMsgThinkingChars = 0;
        }

        // ── content_block_delta: accumulate thinking chars ──────────
        if (eventType === 'content_block_delta' && payload.delta) {
            if (payload.delta.type === 'thinking_delta' && payload.delta.thinking) {
                _currentMsgThinkingChars += payload.delta.thinking.length;
            }
        }

        // ── message_delta: finalize message, add to cumulative total ─
        if (eventType === 'message_delta') {
            _sseTokenData.cumulativeThinkingChars += _currentMsgThinkingChars;
            _sseTokenData.sseMessageCount++;
            _sseTokenData.lastUpdated              = Date.now();
            _sseTokenData.exact                    = true;
            _sseTokenData.cached                   = false;

            // Debounced plan usage refresh (3 s after last SSE activity)
            if (_usageRefreshTimer) clearTimeout(_usageRefreshTimer);
            _usageRefreshTimer = setTimeout(maybeRefreshUsage, 3000);

            _cacheSSEData();
            orbUpdateContextBar();
        }

        // ── message_stop: final UI refresh ─────────────────────────
        if (eventType === 'message_stop') {
            orbUpdateContextBar();
        }
    }

    // ── GM cache helpers for Claude context data ──────────
    function _getConvId() {
        // URL: /chat/6873dd1a-f895-4fef-a564-6f0e03b7e8ed
        var parts = window.location.pathname.split('/');
        var id = parts[parts.length - 1];
        // Validate it looks like a UUID (8 hex chars, dash, 4 hex chars)
        return (id && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) ? id : null;
    }

    function _cacheSSEData() {
        var convId = _getConvId();
        if (!convId || !_sseTokenData.exact) return;
        try {
            var cache = GM_getValue('acn_ctx_cache', {});
            cache[convId] = {
                cumulativeThinkingChars: _sseTokenData.cumulativeThinkingChars,
                sseMessageCount:         _sseTokenData.sseMessageCount,
                timestamp:               Date.now()
            };

            // Prune to 50 most recent conversations
            var keys = Object.keys(cache);
            if (keys.length > 50) {
                keys.sort(function (a, b) {
                    return (cache[b].timestamp || 0) - (cache[a].timestamp || 0);
                });
                var pruned = {};
                for (var i = 0; i < 50; i++) pruned[keys[i]] = cache[keys[i]];
                cache = pruned;
            }

            GM_setValue('acn_ctx_cache', cache);
        } catch (e) {}
    }

    function _loadCachedSSEData() {
        var convId = _getConvId();
        if (!convId) return;
        try {
            var cache = GM_getValue('acn_ctx_cache', {});
            var entry = cache[convId];
            if (entry && entry.sseMessageCount) {
                _sseTokenData.cumulativeThinkingChars = entry.cumulativeThinkingChars;
                _sseTokenData.sseMessageCount         = entry.sseMessageCount || 0;
                _sseTokenData.lastUpdated             = entry.timestamp;
                _sseTokenData.exact                   = false;
                _sseTokenData.cached                  = true;
            }
        } catch (e) {}
    }

    // Returns the estimated token overhead for content invisible to DOM scraping:
    // Claude system prompt, tool definitions, memory, project instructions, etc.
    // These are never in the conversation DOM but always consume context window space.
    //
    // Breakdown (approximate):
    //   Standard chat:  system prompt (~20K) + tool defs (~8K) = ~28K  → use 30K
    //   Claude Project: adds project instructions (5–100K) + memory    → use 50K
    //
    // Project detection: Claude Project URLs contain "/project/" in the pathname.
    // Regular chat URL:  /chat/{uuid}
    // Project chat URL:  /project/{uuid}/chat/{uuid}
    function _estimateClaudeOverhead() {
        var inProject = window.location.pathname.indexOf('/project/') !== -1;
        return inProject ? 50000 : 30000;
    }

    // ============================================================
    // TURN COUNTER HELPERS (Tier 2 — non-Claude platforms)
    // ============================================================

    function updateTurnCounter() {
        var newTotal = _questions.length;

        // SPA navigation: if message count decreased, we're in a new conversation
        if (newTotal < _turnCounter.totalTurns) {
            resetTurnCounter();
        }

        if (newTotal <= _turnCounter.totalTurns) return;

        var added = newTotal - _turnCounter.totalTurns;
        _turnCounter.totalTurns        += added;
        _turnCounter.turnsSinceCompact += added;
    }

    function resetTurnCounter() {
        _turnCounter.totalTurns          = 0;
        _turnCounter.turnsSinceCompact   = 0;
        _turnCounter.compactionCount     = 0;
        _turnCounter.cycleLengths        = [];
        _turnCounter.predictedCycleLength = null;
        _turnCounter.lastCompactTurn     = 0;

        // Reset hybrid SSE tracking for the new conversation
        _sseTokenData.cumulativeThinkingChars = 0;
        _sseTokenData.sseMessageCount         = 0;
        _sseTokenData.lastUpdated             = 0;
        _sseTokenData.exact                   = false;
        _sseTokenData.cached                  = false;
        _currentMsgThinkingChars              = 0;
        _compactionCount                      = 0;
        _compactionHistory                    = [];
    }

    // ============================================================
    // PLAN USAGE (Claude only)
    // ============================================================

    function getBarColor(pct) {
        if (pct < 70)  return '#22c55e';
        if (pct < 85)  return '#eab308';
        return '#ef4444';
    }

    function fetchClaudeUsage(callback) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            callback(null);
            return;
        }

        function fetchUsageFor(uuid) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://claude.ai/api/organizations/' + uuid + '/usage',
                headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
                onload: function (r2) {
                    try {
                        var data = JSON.parse(r2.responseText);
                        callback(parseUsageFromJSON(data));
                    } catch (e) { callback(null); }
                },
                onerror: function () { callback(null); }
            });
        }

        // Reuse the org already resolved (and validated) by the conversation index
        // rather than re-deriving it. The previous implementation took orgs[0] —
        // a positional guess that silently returned another organization's usage
        // numbers for anyone belonging to more than one.
        if (_ciOrgUuid) { fetchUsageFor(_ciOrgUuid); return; }

        var cookieOrg = ciGetCookie('lastActiveOrg');
        if (cookieOrg) { fetchUsageFor(cookieOrg); return; }

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://claude.ai/api/organizations',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
            onload: function (r1) {
                var uuid = null;
                try {
                    var orgs = JSON.parse(r1.responseText);
                    // Rank by the 'chat' capability instead of array position.
                    var ranked = Array.isArray(orgs) ? ciRankOrgs(orgs) : [];
                    if (ranked.length) uuid = ranked[0];
                } catch (e) { /* skip */ }

                if (!uuid) { callback(null); return; }
                fetchUsageFor(uuid);
            },
            onerror: function () { callback(null); }
        });
    }

    function parseUsageFromJSON(data) {
        if (!data || typeof data !== 'object') return null;
        function parseTier(t) {
            if (!t) return null;
            return { utilization: t.utilization || 0, resetsAt: t.resets_at || null };
        }
        var result = {
            fiveHour:      parseTier(data.five_hour),
            sevenDay:      parseTier(data.seven_day),
            sevenDaySonnet: parseTier(data.seven_day_sonnet)
        };
        // Return null if all tiers are missing
        if (!result.fiveHour && !result.sevenDay && !result.sevenDaySonnet) return null;
        return result;
    }


    function renderUsageBars(container, data) {
        if (!container) return;
        while (container.firstChild) container.removeChild(container.firstChild);

        if (!data) {
            var ph = document.createElement('div');
            ph.style.cssText = 'font-size:10px;color:#555;padding:2px 0';
            ph.textContent   = 'Plan usage loading\u2026';
            container.appendChild(ph);
            return;
        }

        var title = document.createElement('div');
        title.className   = 'acn-usage-title';
        title.textContent = 'Plan usage';
        container.appendChild(title);

        var bars = [
            { label: 'Session (5h)',  tier: data.fiveHour },
            { label: 'Weekly',        tier: data.sevenDay },
            { label: 'Sonnet (7d)',   tier: data.sevenDaySonnet }
        ];

        for (var i = 0; i < bars.length; i++) {
            var bar  = bars[i];
            var tier = bar.tier;
            if (!tier) continue;

            var pct   = Math.min(100, tier.utilization || 0);
            var color = getBarColor(pct);
            var reset = tier.resetsAt ? formatResetTime(tier.resetsAt) : '';

            var labelLeft = document.createElement('span');
            labelLeft.textContent = bar.label;

            var labelRight = document.createElement('span');
            labelRight.textContent = pct + '% used' +
                                     (reset ? ' \u00b7 ' + reset : '');

            var labelRow = document.createElement('div');
            labelRow.className = 'acn-usage-label';
            labelRow.appendChild(labelLeft);
            labelRow.appendChild(labelRight);

            var fillEl = document.createElement('div');
            fillEl.className        = 'acn-usage-fill';
            fillEl.style.width      = pct + '%';
            fillEl.style.background = color;

            var trackEl = document.createElement('div');
            trackEl.className = 'acn-usage-track';
            trackEl.appendChild(fillEl);

            var barEl = document.createElement('div');
            barEl.className = 'acn-usage-bar';
            barEl.appendChild(labelRow);
            barEl.appendChild(trackEl);

            container.appendChild(barEl);
        }
    }

    function maybeRefreshUsage() {
        if (typeof platform === 'undefined' || platform.id !== 'claude') return;
        var now = Date.now();
        if (now - _usageLastFetch < USAGE_POLL_INTERVAL) {
            var section = document.getElementById('acn-usage-section');
            if (section) renderUsageBars(section, _usageData);
            return;
        }

        _usageLastFetch = now;
        _usageOrgUuid   = _ciOrgUuid;
        fetchClaudeUsage(function (data) {
            _usageData = data;
            var section = document.getElementById('acn-usage-section');
            if (section) renderUsageBars(section, _usageData);
        });
    }

    function formatResetTime(resetsAt) {
        var target;
        try {
            target = new Date(resetsAt);
            if (isNaN(target.getTime())) return '';
        } catch (e) { return ''; }

        var now    = Date.now();
        var diffMs = target.getTime() - now;

        if (diffMs <= 0) return 'resetting soon';

        var diffMin  = Math.round(diffMs / 60000);
        var diffHour = diffMin / 60;

        if (diffMin < 60) {
            return 'resets in ' + diffMin + ' min';
        }

        var h = Math.floor(diffHour);
        var m = Math.round(diffMin - h * 60);

        var todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        if (target <= todayEnd) {
            return 'resets in ' + h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
        }

        var days    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var dayName = days[target.getDay()];
        var hr      = target.getHours();
        var min     = target.getMinutes();
        var ampm    = hr >= 12 ? 'PM' : 'AM';
        var hr12    = hr % 12 || 12;
        var minStr  = min < 10 ? '0' + min : String(min);
        return 'resets ' + dayName + ' ' + hr12 + ':' + minStr + ' ' + ampm;
    }

    // ============================================================
    // CSS INJECTION
    // ============================================================
    function orbInjectCSS() {
        if (document.getElementById('acn-style')) return; // already injected (e.g. SPA re-inject)
        var styleEl = document.createElement('style');
        styleEl.id = 'acn-style';
        styleEl.setAttribute('data-acn-role', 'styles');
        // CSS uses var(--acn-accent) and rgba(var(--acn-rgb), alpha) set on the zone
        styleEl.textContent = [
            // Zone + hitzone
            '.acn-zone{position:fixed;right:0;top:0;bottom:0;width:160px;z-index:2147483640;pointer-events:none;transition:right .3s cubic-bezier(.4,0,.2,1);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif}',
            '.acn-zone.acn-hp{right:var(--acn-panel-w,310px)}',
            '.acn-hitzone{position:absolute;right:0;z-index:1;pointer-events:auto;cursor:ns-resize}',
            '.acn-zone.acn-dragging{opacity:0.7}',

            // Dots — critical: fast opacity, slow position
            '.acn-dot{position:absolute;display:flex;align-items:center;justify-content:center;',
            'border-radius:50%;cursor:pointer;z-index:5;color:#000;font-weight:600;',
            'transition:top .3s cubic-bezier(.25,.8,.5,1),right .3s cubic-bezier(.25,.8,.5,1),',
            'width .3s cubic-bezier(.25,.8,.5,1),height .3s cubic-bezier(.25,.8,.5,1),',
            'font-size .3s cubic-bezier(.25,.8,.5,1),border-radius .3s cubic-bezier(.25,.8,.5,1),',
            'box-shadow .3s cubic-bezier(.25,.8,.5,1),opacity .08s linear;',
            'opacity:0;pointer-events:none;user-select:none}',
            '.acn-dot.acn-vis{pointer-events:auto}',
            '.acn-dot.acn-no-t{transition:none!important}',
            '.acn-dot:hover{filter:brightness(1.3);z-index:20}',
            '.acn-dot.acn-act{box-shadow:0 0 16px rgba(var(--acn-rgb),.5)!important}',

            // Hover label — default: appears to the LEFT of the dot
            '.acn-lbl{position:absolute;right:calc(100% + 10px);font-size:12px;font-weight:600;',
            'color:var(--acn-accent);white-space:nowrap;opacity:0;',
            'transition:opacity .15s,transform .15s;transform:translateX(4px);',
            'pointer-events:none}',
            '.acn-dot:hover .acn-lbl,.acn-dot.acn-act .acn-lbl{opacity:1;transform:translateX(0)}',
            // Arc mode: labels appear BELOW the dot to avoid overlapping adjacent dots
            '#acn-zone[data-acn-mode="arc"] .acn-lbl{right:auto;left:50%;top:calc(100% + 5px);',
            'transform:translateX(-50%) translateY(-4px);text-align:center}',
            '#acn-zone[data-acn-mode="arc"] .acn-dot:hover .acn-lbl,',
            '#acn-zone[data-acn-mode="arc"] .acn-dot.acn-act .acn-lbl{opacity:1;transform:translateX(-50%) translateY(0)}',
            // ChatGPT: button is light, icon must stay black in both modes; label is black light / white dark
            '#acn-zone[data-acn-platform="chatgpt"] .acn-dot{color:#000}',
            '#acn-zone[data-acn-platform="chatgpt"] .acn-lbl{color:#000}',
            // Dark mode: all platform icons go white; labels keep platform color (var(--acn-accent))
            '@media(prefers-color-scheme:dark){',
            '.acn-dot{color:#fff}',
            // ChatGPT exception: icon stays black on its light button; label turns white
            '#acn-zone[data-acn-platform="chatgpt"] .acn-dot{color:#000}',
            '#acn-zone[data-acn-platform="chatgpt"] .acn-lbl{color:#fff}',
            '}',

            // Connectors (Show All mode)
            '.acn-conn{position:absolute;width:1px;z-index:2;pointer-events:none;',
            'transition:all .3s;opacity:0}',
            '.acn-conn.acn-vis{opacity:1}',

            // Wheel hint
            '.acn-whint{position:absolute;right:18px;font-size:11px;color:#555;text-align:center;',
            'width:36px;pointer-events:none;opacity:0;transition:opacity .3s}',
            '.acn-whint.acn-vis{opacity:1}',
            '@keyframes acn-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}',
            '.acn-whint span{display:block;animation:acn-bounce 1.5s ease-in-out infinite}',

            // Panel — slides from right
            '.acn-panel{position:fixed;right:0;top:0;bottom:0;width:var(--acn-panel-w,310px);',
            'background:#1a1a1a;border-left:1px solid #2a2a2a;',
            'transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);',
            'display:flex;flex-direction:column;overflow:hidden;',
            'z-index:2147483641;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif;',
            'color:#e5e5e5;user-select:none}',
            '.acn-panel.acn-open{transform:translateX(0)}',

            // Panel resize handle (left edge drag)
            '.acn-resize-handle{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize;',
            'z-index:10;transition:background .15s}',
            '.acn-resize-handle:hover,.acn-resize-handle.acn-resizing{background:rgba(255,255,255,.15)}',

            // Panel header
            '.acn-ph{padding:12px 14px;display:flex;justify-content:space-between;',
            'align-items:center;border-bottom:1px solid #2a2a2a;flex-shrink:0}',
            '.acn-ph h3{font-size:15px;font-weight:600;margin:0;color:#fff}',
            '.acn-xb{font-size:12px;background:rgba(255,255,255,.06);border:none;color:#888;',
            'padding:4px 10px;border-radius:5px;cursor:pointer;font-family:inherit}',
            '.acn-xb:hover{background:rgba(255,255,255,.12);color:#ccc}',

            // Context bar (Navigate panel)
            '.acn-ctx{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}',
            '.acn-ctx-r{display:flex;justify-content:space-between;margin-bottom:5px}',
            '.acn-ctx-l{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.5px;font-weight:500}',
            '.acn-ctx-pct{font-family:monospace;font-size:12px;font-weight:600}',
            '.acn-ctx-bar{height:4px;background:#222;border-radius:2px;overflow:hidden}',
            '.acn-ctx-fill{height:100%;border-radius:2px;transition:width .5s,background .5s}',
            '.acn-ctx-meta{font-size:10px;color:#666;margin-top:3px}',

            // Stats + question list
            '.acn-pstat{padding:7px 14px;font-size:12px;color:#777;',
            'border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}',
            '.acn-ql{flex:1;overflow-y:auto;padding:2px 0}',
            '.acn-ql::-webkit-scrollbar{width:4px}',
            '.acn-ql::-webkit-scrollbar-track{background:transparent}',
            '.acn-ql::-webkit-scrollbar-thumb{background:#333;border-radius:2px}',
            '.acn-qi{padding:9px 14px;border-left:2px solid rgba(var(--acn-rgb),.25);cursor:pointer;transition:all .15s}',
            '.acn-qi:hover{background:rgba(var(--acn-rgb),.14);border-left-color:var(--acn-accent)}',
            '.acn-qn{font-size:11px;font-weight:700;color:var(--acn-accent);margin-bottom:4px;',
            'display:inline-block;background:rgba(var(--acn-rgb),.18);border-radius:3px;padding:1px 6px}',
            '.acn-qt{font-size:13px;color:#ddd;line-height:1.35;',
            'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
            '.acn-qw{font-size:11px;color:#666;margin-top:2px}',
            '.acn-empty{padding:40px 14px;text-align:center;font-size:13px;color:#555;line-height:1.6}',
            '.acn-ci-banner{padding:7px 10px;margin:0 0 6px;border-radius:6px;font-size:11px;line-height:1.45}',
            // Actually blocks re-entrant clicks while a jump is in flight. The busy
            // state previously only dimmed the list, so the re-entrancy the jump token
            // exists to make safe was directly reachable by the user.
            // Covers Navigate/Search rows (.acn-qi) AND bookmark rows (.acn-bk); an
            // earlier rule matched only .acn-qi, so bookmark clicks were never blocked.
            '.acn-panel[data-acn-jumping="true"] .acn-qi,',
            '.acn-panel[data-acn-jumping="true"] .acn-bk{pointer-events:none}',
            '.acn-panel[data-acn-jumping="true"]{cursor:progress}',
            '.acn-ci-degraded{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)}',
            '.acn-ci-loading{background:rgba(255,255,255,.05);color:#888}',
            '.acn-ci-note{background:rgba(234,179,8,.12);color:#eab308;border:1px solid rgba(234,179,8,.3)}',

            // Search input
            '.acn-search-wrap{padding:14px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}',
            '.acn-si{width:100%;padding:9px 11px;background:#222;border:1px solid #333;',
            'border-radius:7px;color:#ddd;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box}',
            '.acn-si:focus{border-color:var(--acn-accent)}',
            '.acn-si::placeholder{color:#555}',
            '.acn-sh{margin-top:8px;font-size:12px;color:#444;text-align:center}',
            '.acn-smatch{background:rgba(var(--acn-rgb),.2);color:var(--acn-accent);',
            'border-radius:2px;padding:0 2px;font-weight:600}',

            // Bookmarks
            '.acn-bk{padding:10px 14px;border-left:2px solid var(--acn-accent);cursor:pointer;',
            'transition:all .12s;margin:4px 10px;background:rgba(var(--acn-rgb),.04);',
            'border-radius:0 6px 6px 0}',
            '.acn-bk:hover{background:rgba(var(--acn-rgb),.1)}',
            '.acn-bk-type{font-size:9px;font-weight:600;color:var(--acn-accent);margin-bottom:2px}',
            '.acn-bk-text{font-size:11px;color:#999;line-height:1.35}',
            '.acn-bk-meta{font-size:9px;color:#555;margin-top:3px}',

            // Summary
            '.acn-sum-sec{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05)}',
            '.acn-sum-title{font-size:10px;font-weight:600;color:var(--acn-accent);',
            'text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}',
            '.acn-sum-topic{display:inline-block;padding:3px 8px;',
            'background:rgba(var(--acn-rgb),.08);border:1px solid rgba(var(--acn-rgb),.15);',
            'border-radius:5px;font-size:10px;color:var(--acn-accent);margin:2px 3px 2px 0}',
            '.acn-sum-action{padding:6px 0;font-size:11px;color:#aaa;display:flex;',
            'align-items:flex-start;gap:6px}',
            '.acn-sum-bullet{color:var(--acn-accent);font-weight:600;flex-shrink:0}',
            '.acn-gen-btn{width:100%;padding:10px;background:rgba(var(--acn-rgb),.08);',
            'border:1px solid rgba(var(--acn-rgb),.2);border-radius:7px;color:var(--acn-accent);',
            'font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;margin-top:8px}',
            '.acn-gen-btn:hover{background:rgba(var(--acn-rgb),.15)}',

            // Export
            '.acn-exp-icon{font-size:18px;margin-bottom:4px}',
            '.acn-exp-title{font-size:12px;font-weight:600;color:#ccc;margin-bottom:3px}',
            '.acn-exp-desc{font-size:10px;color:#666;line-height:1.4}',

            // Settings
            '.acn-set-scroll{flex:1;overflow-y:auto;padding:4px 0}',
            '.acn-set-group{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05)}',
            '.acn-set-gtitle{font-size:10px;font-weight:600;color:var(--acn-accent);',
            'text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}',
            '.acn-set-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0}',
            '.acn-set-label{font-size:11px;color:#aaa}',
            '.acn-set-desc{font-size:9px;color:#555;margin-top:1px}',
            '.acn-toggle{width:36px;height:20px;background:#333;border-radius:10px;cursor:pointer;',
            'position:relative;transition:background .2s;flex-shrink:0;margin-left:10px}',
            '.acn-toggle.acn-on{background:var(--acn-accent)}',
            '.acn-toggle::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;',
            'background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}',
            '.acn-toggle.acn-on::after{transform:translateX(16px)}',
            '.acn-set-sel{background:#222;color:#ccc;border:1px solid #333;border-radius:5px;',
            'padding:4px 8px;font-size:10px;font-family:inherit;outline:none;cursor:pointer;',
            'flex-shrink:0;margin-left:10px}',
            '.acn-plat-row{display:flex;align-items:center;gap:8px;padding:5px 0}',
            '.acn-plat-icon{font-size:14px;width:22px;text-align:center}',
            '.acn-plat-name{font-size:13px;color:#aaa;flex:1}',
            '.acn-reset-btn{width:100%;padding:10px;background:rgba(239,68,68,.08);',
            'border:1px solid rgba(239,68,68,.2);border-radius:7px;color:#ef4444;font-size:13px;',
            'font-weight:600;font-family:inherit;cursor:pointer;margin-top:4px}',
            '.acn-reset-btn:hover{background:rgba(239,68,68,.15)}',
            // Usage bars (Group B)
            '.acn-usage-bar{margin-bottom:4px}',
            '.acn-usage-label{font-size:10px;color:#aaa;display:flex;justify-content:space-between}',
            '.acn-usage-track{height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}',
            '.acn-usage-fill{height:100%;border-radius:2px;transition:width .3s ease}',
            '.acn-usage-separator{height:1px;background:rgba(255,255,255,.1);margin:6px 0}',
            '.acn-usage-section{margin-top:4px;padding:0 14px 10px}',
            '.acn-usage-title{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.5px;font-weight:500;margin-bottom:6px}',
            '.acn-ctx-compact{font-size:10px;color:#a478f0;margin-top:3px}',
            '.acn-ctx-warn{font-size:10px;color:#f87171;margin-top:3px}',
            '.acn-ctx-dots{display:flex;gap:3px;margin-top:5px;flex-wrap:wrap}',
            '.acn-ctx-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
            // Settings panel additions (Group C)
            '.acn-toggle-locked{opacity:.4;cursor:not-allowed}',
            '.acn-plat-lock{font-size:10px;margin-left:4px;vertical-align:middle}',
            '.acn-about-link{color:var(--acn-accent);font-size:12px;text-decoration:none;display:block;margin-top:4px}',
            '.acn-about-link:hover{text-decoration:underline}',
            '.acn-set-refresh-note{font-size:11px;color:#666;margin-top:6px;font-style:italic}',
            // Bookmark icons + flash + panel cards (Group D)
            '.acn-bm-icon{position:absolute;top:4px;right:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:14px;border-radius:4px;background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.5);cursor:pointer;opacity:0;transition:opacity 0.15s ease,background 0.15s ease;z-index:10;pointer-events:auto;user-select:none}',
            '*:hover>.acn-bm-icon{opacity:1}',
            '.acn-bm-icon.acn-bm-active{opacity:1;background:var(--acn-accent);color:#fff}',
            '.acn-bm-icon:hover{opacity:1;background:rgba(0,0,0,0.55);color:#fff}',
            // Keep orange when hovering an already-bookmarked icon
            '.acn-bm-icon.acn-bm-active:hover{background:var(--acn-accent);filter:brightness(1.2);color:#fff}',
            '.acn-bm-flash{animation:acnBmFlash 1.5s ease}',
            '@keyframes acnBmFlash{0%{box-shadow:0 0 0 0 var(--acn-accent)}30%{box-shadow:0 0 0 4px var(--acn-accent)}100%{box-shadow:0 0 0 0 transparent}}',
            '.acn-bk{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:6px;cursor:pointer;background:rgba(255,255,255,0.04);margin-bottom:4px;border-left:3px solid var(--acn-accent);transition:background 0.15s}',
            '.acn-bk:hover{background:rgba(255,255,255,0.09)}',
            '.acn-bk-header{display:flex;align-items:center;justify-content:space-between;gap:6px}',
            '.acn-bk-type{font-size:10px;font-weight:600;letter-spacing:0.04em;opacity:0.6;text-transform:uppercase;flex-shrink:0}',
            '.acn-bk-remove{font-size:12px;line-height:1;padding:1px 4px;border-radius:3px;cursor:pointer;opacity:0.4;background:transparent;border:none;color:inherit;transition:opacity 0.15s,background 0.15s;flex-shrink:0}',
            '.acn-bk-remove:hover{opacity:1;background:rgba(239,68,68,0.3)}',
            '.acn-bk-text{font-size:12px;opacity:0.85;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
            '.acn-bk-meta{font-size:10px;opacity:0.45;margin-top:1px}',
            '.acn-bm-clearall{width:100%;margin-top:8px;padding:6px 10px;border-radius:6px;background:rgba(239,68,68,0.12);color:rgba(239,68,68,0.8);border:1px solid rgba(239,68,68,0.25);cursor:pointer;font-size:11px;transition:background 0.15s,color 0.15s}',
            '.acn-bm-clearall:hover{background:rgba(239,68,68,0.25);color:rgb(239,68,68)}',
            '.acn-qn-ai{background:rgba(var(--acn-rgb),0.15);border-left:2px solid var(--acn-accent)}',
            // E2: Tools panel, image gallery, command palette, /commands
            '.acn-tool-section{border-top:1px solid rgba(255,255,255,.07);padding-top:2px}',
            '.acn-tool-section-header{font-size:11px;font-weight:700;color:var(--acn-accent);text-transform:uppercase;letter-spacing:.6px;padding:10px 14px 4px}',
            '.acn-gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px 12px}',
            '.acn-gallery-card{position:relative;border-radius:6px;overflow:hidden;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:border-color .15s ease}',
            '.acn-gallery-card:hover{border-color:var(--acn-accent)}',
            '.acn-gallery-thumb{width:100%;height:80px;object-fit:cover;display:block}',
            '.acn-gallery-thumb-fallback{width:100%;height:80px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#555;background:rgba(255,255,255,.03)}',
            '.acn-gallery-label{font-size:10px;color:#aaa;text-align:center;padding:3px 0}',
            '.acn-gallery-actions{position:absolute;top:4px;right:4px;display:none;gap:4px}',
            '.acn-gallery-card:hover .acn-gallery-actions{display:flex}',
            '.acn-gallery-btn{width:20px;height:20px;background:rgba(0,0,0,.7);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;color:#fff}',
            '.acn-gallery-btn:hover{background:var(--acn-accent)}',
            '.acn-gallery-empty{font-size:12px;color:#666;padding:12px;text-align:center;font-style:italic}',
            '.acn-highlight-flash{animation:acn-flash 1.5s ease}',
            '@keyframes acn-flash{0%{outline:2px solid var(--acn-accent);outline-offset:2px}100%{outline:2px solid transparent;outline-offset:2px}}',
            '.acn-palette-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;justify-content:center;padding-top:20vh}',
            '.acn-palette{width:480px;max-height:400px;background:#1a1a2e;border:1px solid #333;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.4);overflow:hidden;display:flex;flex-direction:column}',
            '.acn-palette-input{padding:12px 16px;background:transparent;border:none;border-bottom:1px solid #333;color:#eee;font-size:15px;outline:none;font-family:inherit}',
            '.acn-palette-list{overflow-y:auto;flex:1}',
            '.acn-palette-item{padding:10px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.05)}',
            '.acn-palette-item:hover,.acn-palette-item.acn-selected{background:rgba(255,255,255,.08)}',
            '.acn-palette-item-left{flex:1;min-width:0}',
            '.acn-palette-item-name{font-family:monospace;font-weight:bold;color:#eee;font-size:14px}',
            '.acn-palette-item-desc{color:#888;font-size:12px;margin-top:2px}',
            '.acn-palette-item-run{flex-shrink:0;margin-left:10px;color:#888;font-size:13px;padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,.1)}',
            '.acn-palette-empty{padding:20px 16px;color:#555;font-size:13px;text-align:center}',
            '.acn-cmd-card{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;justify-content:space-between;align-items:flex-start;gap:8px}',
            '.acn-cmd-card:hover{background:rgba(255,255,255,.03)}',
            '.acn-cmd-info{flex:1;min-width:0}',
            '.acn-cmd-name{font-family:monospace;font-weight:700;font-size:12px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.acn-cmd-desc{font-size:10px;color:#666;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.acn-cmd-btns{display:flex;gap:4px;flex-shrink:0}',
            '.acn-cmd-btn{width:22px;height:22px;background:rgba(255,255,255,.07);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;color:#aaa;border:none;font-family:inherit;transition:background .1s,color .1s}',
            '.acn-cmd-btn:hover{background:var(--acn-accent);color:#fff}',
            '.acn-cmd-btn.acn-cmd-del-confirm{background:#b91c1c;color:#fff}',
            '.acn-cmd-empty{padding:12px 14px;font-size:11px;color:#555;line-height:1.6}',
            '.acn-cmd-tip{padding:6px 14px 10px;font-size:10px;color:#444;font-style:italic}',
            '.acn-cmd-new-btn{margin:8px 14px;padding:7px 12px;width:calc(100% - 28px);background:rgba(var(--acn-rgb),.08);border:1px solid rgba(var(--acn-rgb),.2);border-radius:7px;color:var(--acn-accent);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;text-align:center;box-sizing:border-box}',
            '.acn-cmd-new-btn:hover{background:rgba(var(--acn-rgb),.15)}',
            '.acn-cmd-form{padding:10px 14px}',
            '.acn-cmd-form-title{font-size:11px;font-weight:700;color:var(--acn-accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}',
            '.acn-cmd-label{font-size:10px;color:#888;margin-bottom:3px;display:block}',
            '.acn-cmd-name-row{display:flex;align-items:center;gap:4px;margin-bottom:8px}',
            '.acn-cmd-prefix{font-family:monospace;font-size:13px;color:#aaa}',
            '.acn-cmd-input{width:100%;padding:5px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:5px;color:#ddd;font-size:12px;font-family:inherit;box-sizing:border-box;outline:none}',
            '.acn-cmd-input:focus{border-color:var(--acn-accent)}',
            '.acn-cmd-textarea{width:100%;padding:6px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:5px;color:#ddd;font-size:11px;font-family:inherit;box-sizing:border-box;outline:none;resize:vertical;min-height:90px;line-height:1.5}',
            '.acn-cmd-textarea:focus{border-color:var(--acn-accent)}',
            '.acn-cmd-form-err{font-size:10px;color:#f87171;margin-top:4px;min-height:14px}',
            '.acn-cmd-form-btns{display:flex;gap:8px;margin-top:10px}',
            '.acn-cmd-form-save{flex:1;padding:7px;background:var(--acn-accent);border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:600;font-family:inherit;cursor:pointer}',
            '.acn-cmd-form-cancel{flex:1;padding:7px;background:rgba(255,255,255,.08);border:none;border-radius:6px;color:#aaa;font-size:11px;font-family:inherit;cursor:pointer}',
            '.acn-exp-opt{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer;transition:background .12s}',
            '.acn-exp-opt:hover{background:rgba(var(--acn-rgb),.06)}',
            '.acn-exp-icon{font-size:16px;margin-bottom:3px}',
            '.acn-exp-title{font-size:12px;font-weight:600;color:#ccc;margin-bottom:2px}',
            '.acn-exp-desc{font-size:10px;color:#666;line-height:1.4}',
        ].join('');
        document.head.appendChild(styleEl);
    }

    // ============================================================
    // DOT POSITIONING HELPER — only function that touches dot styles
    // ============================================================
    function orbSd(dot, p) {
        dot.style.width          = p.w + 'px';
        dot.style.height         = p.h + 'px';
        dot.style.fontSize       = p.fs + 'px';
        dot.style.right          = p.right + 'px';
        dot.style.top            = p.top + 'px';
        dot.style.borderRadius   = p.rad || '50%';
        dot.style.opacity        = p.op;
        dot.style.pointerEvents  = p.click ? 'auto' : 'none';
        dot.style.boxShadow      = p.shad ? '0 2px 14px ' + orbTheme.shadow : 'none';
        dot.classList.toggle('acn-vis', p.op > 0.05);
    }

    // ============================================================
    // RENDER ENGINE
    // ============================================================
    function orbRender() {
        var zone = document.getElementById('acn-zone');
        if (!zone) return;

        // Keep data-acn-mode in sync so CSS can target arc/wheel/show-all label positions
        zone.setAttribute('data-acn-mode', orbMode);

        var cy   = _orbGetCy();
        var show = orbHovering || orbPanel !== null;

        // Wheel/arc hint
        var hint = document.getElementById('acn-whint');
        if (hint) {
            hint.classList.toggle('acn-vis',
                (orbMode === 'wheel' || orbMode === 'arc') && orbHovering && !orbPanel);
            hint.style.top = (cy + 78) + 'px';
        }

        // Hide all connectors before re-drawing
        orbConns.forEach(function (c) { c.classList.remove('acn-vis'); });

        if (orbMode === 'show-all') orbRenderShowAll(cy, show);
        else if (orbMode === 'arc')  orbRenderArc(cy, show);
        else                         orbRenderWheel(cy, show);
    }

    // ── Show All ─────────────────────────────────────────────────
    // Navigate at center, satellites above and below in a column.
    // ALL buttons share the same platform color — equal brightness.
    function orbRenderShowAll(cy, show) {
        var sp = 48;
        // Compute above/below split dynamically from ORB_N
        var nSats  = ORB_N - 1;
        var nAbove = Math.floor(nSats / 2);
        var above  = [], below  = [];
        for (var i = 1; i <= nAbove; i++) above.push(i);
        for (var i = nAbove + 1; i < ORB_N; i++) below.push(i);

        // Navigate — always visible, rounded square
        orbDots[ORB_MAIN].style.background = orbTheme.bg;
        orbSd(orbDots[ORB_MAIN], {
            w: 48, h: 48, fs: 20,
            right: ORB_CX - 24, top: cy - 24,
            rad: '14px', op: 1, click: true, shad: true,
        });

        // Satellites — same platform color, circles, fade on hover
        above.forEach(function (idx, i) {
            orbDots[idx].style.background = orbTheme.bg;
            var y = cy - (i + 1) * sp;
            orbSd(orbDots[idx], {
                w: 32, h: 32, fs: 14,
                right: ORB_CX - 16, top: y - 16,
                rad: '50%', op: show ? 1 : 0, click: show, shad: false,
            });
        });

        below.forEach(function (idx, i) {
            orbDots[idx].style.background = orbTheme.bg;
            var y = cy + (i + 1) * sp;
            orbSd(orbDots[idx], {
                w: 32, h: 32, fs: 14,
                right: ORB_CX - 16, top: y - 16,
                rad: '50%', op: show ? 1 : 0, click: show, shad: false,
            });
        });

        // Connectors: visual top→bottom order is above-reversed, main, below
        if (show) {
            var ordered = above.slice().reverse().concat([ORB_MAIN]).concat(below);
            for (var c = 0; c < orbConns.length && c < ordered.length - 1; c++) {
                var d1 = orbDots[ordered[c]], d2 = orbDots[ordered[c + 1]];
                var y1 = parseFloat(d1.style.top) + parseFloat(d1.style.height);
                var y2 = parseFloat(d2.style.top);
                orbConns[c].style.right  = ORB_CX + 'px';
                orbConns[c].style.top    = y1 + 'px';
                orbConns[c].style.height = Math.max(0, y2 - y1) + 'px';
                orbConns[c].style.background = 'rgba(' + orbTheme.rgb + ',.1)';
                orbConns[c].classList.add('acn-vis');
            }
        }
    }

    // ── Arc ──────────────────────────────────────────────────────
    // Navigate at center. Satellites form a regular polygon.
    // Scrolling rotates which satellite is at focus (angle 0 = left of center).
    var ARC_RULES = [
        { op: 1.0,  size: 34, fs: 15 },  // slot 0: focus
        { op: 0.65, size: 30, fs: 13 },  // slot ±1: adjacent
        { op: 0.40, size: 25, fs: 11 },  // slot ±2: far
        { op: 0.25, size: 22, fs: 10 },  // slot ±3+: distant
    ];

    function orbRenderArc(cy, show) {
        // Navigate — always at center
        orbDots[ORB_MAIN].style.background = orbTheme.bg;
        orbSd(orbDots[ORB_MAIN], {
            w: 48, h: 48, fs: 20,
            right: ORB_CX - 24, top: cy - 24,
            rad: '14px', op: 1, click: true, shad: true,
        });

        var sats   = [];
        for (var i = 0; i < ORB_N; i++) { if (i !== ORB_MAIN) sats.push(i); }
        var nS     = sats.length;
        var radius = 88;

        sats.forEach(function (featIdx, satI) {
            orbDots[featIdx].style.background = orbTheme.bg;

            // Vertex angle: evenly divide 2π by satellite count, shifted by rotation
            var vertexAngle = (satI / nS) * Math.PI * 2;
            var angle = vertexAngle - (orbRotIdx / nS) * Math.PI * 2;

            // Normalize to [-π, π] — angle 0 = directly LEFT of center
            var a = ((angle % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;

            var px = ORB_CX + Math.cos(a) * radius;
            var py = cy + Math.sin(a) * radius;

            // Slot = vertex steps from focus
            var slot = satI - orbRotIdx;
            while (slot > nS / 2)  slot -= nS;
            while (slot < -nS / 2) slot += nS;
            var dist = Math.abs(slot);
            var rule = ARC_RULES[Math.min(Math.floor(dist), ARC_RULES.length - 1)];

            orbSd(orbDots[featIdx], {
                w: rule.size, h: rule.size, fs: rule.fs,
                right: px - rule.size / 2, top: py - rule.size / 2,
                rad: '50%', op: show ? rule.op : 0,
                click: show, shad: false,
            });
        });
    }

    // ── Wheel ────────────────────────────────────────────────────
    // Vertical conveyor belt. ALL buttons share strict slot rules.
    // Navigate gets a small brightness boost but obeys same rules.
    var WHEEL_RULES = [
        { size: 48, fs: 20, op: 1.0  },  // slot 0: center (active)
        { size: 32, fs: 14, op: 0.50 },  // slot ±1: adjacent
        { size: 22, fs: 10, op: 0.18 },  // slot ±2: far
        // slot ±3+: invisible
    ];
    var WHEEL_HIDDEN = { size: 16, fs: 8, op: 0 };
    var NAV_BOOST    = 0.15;  // additive opacity for Navigate when off-center

    function orbRenderWheel(cy, show) {
        var sp = 54;

        orbDots.forEach(function (dot, i) {
            dot.style.background = orbTheme.bg;

            var slot = i - orbRotIdx;
            while (slot > ORB_N / 2)  slot -= ORB_N;
            while (slot <= -ORB_N / 2) slot += ORB_N; // <= for symmetric tie-breaking

            var prevSlot = i - orbPrevRotIdx;
            while (prevSlot > ORB_N / 2)  prevSlot -= ORB_N;
            while (prevSlot <= -ORB_N / 2) prevSlot += ORB_N;

            // Conveyor belt wrap animation: teleport to staging (invisible) then slide in
            var wrapped = Math.abs(slot - prevSlot) > ORB_N / 2;
            if (wrapped && show) {
                var staging = slot > 0 ? 3.5 : -3.5;
                dot.classList.add('acn-no-t');
                orbApplyWheelSlot(dot, i, staging, cy, sp, show);
                void dot.offsetHeight; // force reflow before re-enabling transition
                dot.classList.remove('acn-no-t');
            }

            orbApplyWheelSlot(dot, i, slot, cy, sp, show);
        });

        orbPrevRotIdx = orbRotIdx;
    }

    function orbApplyWheelSlot(dot, featureIdx, slot, cy, sp, show) {
        var dist    = Math.abs(slot);
        var ruleIdx = Math.floor(dist);
        var rule    = ruleIdx < WHEEL_RULES.length ? WHEEL_RULES[ruleIdx] : WHEEL_HIDDEN;

        var op = rule.op;
        // Navigate brightness boost: additive, does NOT override slot visibility
        if (featureIdx === ORB_MAIN && op > 0 && op < 1) {
            op = Math.min(1, op + NAV_BOOST);
        }

        var y        = cy + slot * sp;
        var isCenter = dist < 0.5;
        // When not hovering: only Navigate is visible (at slot 0 = full, since rotIdx resets)
        var finalOp  = show ? op : (featureIdx === ORB_MAIN ? Math.min(op, 1) : 0);

        orbSd(dot, {
            w: rule.size, h: rule.size, fs: rule.fs,
            right: ORB_CX - rule.size / 2, top: y - rule.size / 2,
            rad: isCenter ? '14px' : '50%',
            op: finalOp,
            click: show && op > 0.05,
            shad: isCenter,
        });
    }

    // ============================================================
    // LEFT-CHAT ZONE POSITIONING
    // ============================================================
    // For left-chat platforms: zone and panels sit at the chat boundary.
    // Standard platforms: CSS classes handle the 310px panel offset.
    function orbApplyZonePosition() {
        if (!isLeftChat) return;

        var zone = document.getElementById('acn-zone');
        if (!zone) return;

        if (!_boundaryDetected || !_lastBoundaryX) {
            zone.style.visibility = 'hidden';
            return;
        }
        zone.style.visibility = '';

        var base = window.innerWidth - _lastBoundaryX;
        // Zone shifts left by panel width when panel is open (mirrors .acn-zone.acn-hp)
        zone.style.right = (base + (orbPanel ? _panelWidth : 0)) + 'px';

        // Position all panels to open from the chat boundary
        document.querySelectorAll('.acn-panel').forEach(function (p) {
            p.style.right = base + 'px';
        });
    }

    // ============================================================
    // PANEL MANAGEMENT
    // ============================================================
    function orbOpenPanel(fid) {
        if (orbPanel === fid) { orbClosePanel(); return; }

        // Close existing panel first — clear both CSS class AND data-acn-open contract attribute
        document.querySelectorAll('.acn-panel').forEach(function (p) {
            p.classList.remove('acn-open');
            p.removeAttribute('data-acn-open');
        });
        orbDots.forEach(function (d) { d.classList.remove('acn-act'); });

        orbPanel   = fid;
        orbHovering = true;

        var f = null;
        for (var i = 0; i < ORB_FEATURES.length; i++) {
            if (ORB_FEATURES[i].id === fid) { f = ORB_FEATURES[i]; break; }
        }
        if (!f) return;

        var panelEl = document.getElementById(f.panelId);
        if (panelEl) {
            panelEl.classList.add('acn-open');
            panelEl.setAttribute('data-acn-open', 'true');
        }

        orbDots[ORB_FEATURES.indexOf(f)].classList.add('acn-act');

        if (isLeftChat) {
            orbApplyZonePosition();
        } else {
            var zone = document.getElementById('acn-zone');
            if (zone) zone.classList.add('acn-hp');
        }

        // Populate functional panels
        if (fid === 'nav')       orbPopulateNavigate();
        if (fid === 'bookmarks') orbRefreshBookmarksPanel();
        if (fid === 'search') {
            orbPopulateSearch('');
            setTimeout(function () {
                var si = document.getElementById('acn-search-input');
                if (si) si.focus();
            }, 350);
        }
        if (fid === 'summary') {
            setTimeout(function () {
                var genBtn = document.querySelector('#acn-panel-summary .acn-gen-btn');
                if (genBtn && !genBtn.dataset.generated) genBtn.click();
            }, 50);
        }
        if (fid === 'tools') {
            var gallerySection = document.getElementById('acn-gallery-section');
            if (gallerySection) renderImageGallery(gallerySection);
        }

        orbRender();
    }

    function orbClosePanel() {
        if (!orbPanel) return;

        document.querySelectorAll('.acn-panel').forEach(function (p) {
            p.classList.remove('acn-open');
            p.removeAttribute('data-acn-open');
        });
        orbDots.forEach(function (d) { d.classList.remove('acn-act'); });

        orbPanel = null;

        if (isLeftChat) {
            orbApplyZonePosition();
        } else {
            var zone = document.getElementById('acn-zone');
            if (zone) zone.classList.remove('acn-hp');
        }

        // Reset to Navigate on close
        orbPrevRotIdx = orbRotIdx;
        orbRotIdx     = 0;

        orbRender();
    }

    // Degraded-mode banner. Silent degradation is exactly what let the
    // virtualization bug hide for so long — a truncated list looked like a short
    // conversation. When the index is unavailable the user must be able to SEE
    // that the list is incomplete, not just find it in the console.
    function orbRenderIndexBanner(list) {
        if (!ciIsClaudeChat()) return;

        var banner = null;

        if (_ciStatus === 'degraded') {
            banner = createElement('div', {
                className: 'acn-ci-banner acn-ci-degraded',
                textContent: '\u26a0 Showing only on-screen messages \u2014 full history unavailable (' +
                             _ciDegradedReason + ')'
            });
            banner.setAttribute('data-acn-index-status', 'degraded');
        } else if (_ciStatus === 'loading') {
            banner = createElement('div', {
                className: 'acn-ci-banner acn-ci-loading',
                textContent: '\u2026 Loading full conversation history'
            });
            banner.setAttribute('data-acn-index-status', 'loading');
        } else if (_ciStatus === 'ready') {
            var notes = [];
            if (_ciTruncatedCount > 0) {
                notes.push(_ciTruncatedCount + ' message' + (_ciTruncatedCount !== 1 ? 's' : '') +
                           ' truncated by Claude');
            }
            if (_ciUsedLeafFallback) notes.push('active branch inferred');
            if (!_ciPathComplete) notes.push('history incomplete \u2014 conversation tree is malformed');
            if (notes.length) {
                banner = createElement('div', {
                    className: 'acn-ci-banner acn-ci-note',
                    textContent: '\u26a0 ' + notes.join(' \u00b7 ')
                });
                banner.setAttribute('data-acn-index-status', 'ready-with-notes');
            }
        }

        if (banner) list.appendChild(banner);
    }

    // ============================================================
    // NAVIGATE PANEL CONTENT
    // ============================================================
    function orbPopulateNavigate() {
        var list  = document.getElementById('acn-nav-list');
        var stat  = document.getElementById('acn-nav-stat');
        if (!list) return;

        // Skip DOM rebuild if questions haven't changed — prevents hover flicker caused
        // by MutationObserver firing on SPA animations and rebuilding the list mid-hover
        // (index status is part of the fingerprint so the banner appears without a
        //  content change having to trigger the rebuild)
        // _ciIndexGen for the same reason the Search fingerprint carries it: an
        // edited prompt that keeps its first 100 chars survives a ready-to-ready
        // refetch with an identical fingerprint, and the open panel kept click
        // handlers closed over the PREVIOUS branch's q objects (Codex R7 :4950).
        var fp = _questions.map(function (q) { return q.text.substring(0, 100); }).join('|') +
                 '||' + _ciStatus + '|g' + _ciIndexGen;
        if (fp === _navListFingerprint && list.firstChild) return;
        _navListFingerprint = fp;

        // Clear
        while (list.firstChild) list.removeChild(list.firstChild);

        orbRenderIndexBanner(list);

        if (_questions.length === 0) {
            var empty = createElement('div', { className: 'acn-empty' },
                ['No questions detected yet.\n\nStart a conversation — questions and prompts will appear here.']);
            list.appendChild(empty);
            if (stat) { stat.textContent = '0 questions found'; stat.setAttribute('data-acn-count', '0'); }
            return;
        }

        if (stat) {
            stat.textContent = _questions.length + ' question' +
                (_questions.length !== 1 ? 's' : '') + ' detected';
            stat.setAttribute('data-acn-count', String(_questions.length));
        }

        _questions.forEach(function (q, idx) {
            var words = q.text.split(/\s+/).length;

            var numEl  = createElement('div', { className: 'acn-qn', textContent: 'Q#' + (idx + 1) });
            var textEl = createElement('div', { className: 'acn-qt', textContent: q.summary });
            if (q.element && hasContentImage(q.element)) {
                textEl.textContent = '\uD83D\uDDBC\uFE0F ' + textEl.textContent;
            }
            textEl.setAttribute('data-acn-role', 'nav-item-text');
            var metaEl = createElement('div', { className: 'acn-qw', textContent: words + ' words' });
            var item   = createElement('div', { className: 'acn-qi' }, [numEl, textEl, metaEl]);
            item.setAttribute('data-acn-role', 'nav-item');

            item.addEventListener('click', function () {
                orbScrollToQuestion(q);
            });

            list.appendChild(item);
        });

        orbUpdateContextBar();
        if (platform.id === 'claude') maybeRefreshUsage();
    }

    // Context bar — multi-path rendering (Claude SSE exact / estimated / turn-dots)
    function orbUpdateContextBar() {
        var pct  = document.getElementById('acn-ctx-pct');
        var fill = document.getElementById('acn-ctx-fill');
        var meta = document.getElementById('acn-ctx-meta');
        if (!pct || !fill) return;

        var limit = (typeof CTX_LIMITS !== 'undefined' && platform && CTX_LIMITS[platform.id])
                    ? CTX_LIMITS[platform.id]
                    : 128000;

        // ── Path A: Claude with hybrid SSE data ───────────────
        if (platform && platform.id === 'claude' &&
            (_sseTokenData.exact || _sseTokenData.cached)) {

            // ── DOM: walk scroll container for all visible text (user + AI) ──
            // [data-is-streaming] is only present while actively streaming, so
            // per-element selectors miss completed turns. The scroll container
            // innerText captures everything regardless of streaming state.
            // Index-backed: count the entire active path. The DOM path below could
            // only ever see the mounted window — with ~3 of 147 turns rendered that
            // undercounted by roughly 35x, which is the real cause of the
            // long-standing "turn counter red but context shows 19%" mismatch.
            // The old coverage correction could not save it either: _questions was
            // rebuilt from live DOM on every scan, so nInDOM always equalled
            // _questions.length and coverage was always exactly 1.0.
            var domChars = 0;
            var domTokens;
            if (ciIsReady()) {
                domChars  = ciTotalChars();
                domTokens = Math.round(domChars / 4);
            } else {
                var scrollNode = ciFindScrollContainer();
                if (scrollNode) domChars = (scrollNode.innerText || '').length;
                if (!domChars) {
                    domChars = _questions.reduce(function (s, q) { return s + q.text.length; }, 0) * 3;
                }
                var nInDOM = _questions.filter(function (q) {
                    return q.element && document.body.contains(q.element);
                }).length;
                var coverage = nInDOM / Math.max(1, _questions.length);
                domTokens = Math.round((domChars / 4) / Math.max(0.25, coverage));
            }

            // ── SSE: cumulative thinking tokens (invisible in DOM) ──────
            // max() with the INDEXED total: SSE only accumulates thinking streamed in
            // THIS session, so the first streamed answer used to replace the whole
            // history's thinking with one turn's worth and the display dropped
            // sharply (Codex :4855). The index carries history; SSE covers turns the
            // index has not refetched yet; max() never double-counts.
            var thinkChars = _sseTokenData.cumulativeThinkingChars || 0;
            if (ciIsReady()) thinkChars = Math.max(thinkChars, ciTotalThinkingChars());
            var thinkingTokens = Math.round(thinkChars / 4);

            // ── System overhead: system prompt + tool defs + memory/project instructions ─
            // Dynamic: 50K for Claude Projects (detected via URL), 30K for standard chat.
            // These are invisible to DOM scraping but always consume context window space.
            var systemOverhead = _estimateClaudeOverhead();

            // ── Total ───────────────────────────────────────────────────
            var totalTok = domTokens + thinkingTokens + systemOverhead;
            var pctNum   = Math.min(100, Math.round((totalTok / limit) * 100));
            var color    = getBarColor(pctNum);

            var tokFmt = totalTok.toLocaleString();
            var limFmt = Math.round(limit / 1000) + 'K';

            pct.textContent       = pctNum + '%';
            pct.style.color       = color;
            fill.style.width      = pctNum + '%';
            fill.style.background = color;

            if (meta) {
                var label = _sseTokenData.cached ? '(last known)' : '(hybrid)';
                meta.textContent = '~' + tokFmt + ' / ' + limFmt + ' tokens ' + label;
                meta.style.color = _sseTokenData.cached ? '#666' : '#888';
            }

            // ── Also render turn dots + compaction info below the bar ───
            _renderTurnDots();
            _renderCompactionInfo(pctNum);
            return;
        }

        // ── Path B: Claude but no SSE data yet ────────────────
        // (Firefox: SSE interception disabled due to sandbox contamination — DEC-020)
        // (Chrome: SSE data not yet received, e.g. page just loaded)
        if (platform && platform.id === 'claude') {
            _renderEstimatedBar(pct, fill, meta, limit);
            _renderTurnDots();
            _renderCompactionInfo(0);
            return;
        }

        // ── Path C: Non-Claude — turn dots only ───────────────
        // DOM-based token estimation is too inaccurate (15-20x undercount).
        // Turn dots with weighted-average compaction prediction are more honest.
        if (_questions.length === 0) {
            pct.textContent  = '\u2014';
            pct.style.color  = '';
            fill.style.width = '0%';
            if (meta) { meta.textContent = 'No messages detected'; meta.style.color = ''; }
            _removeTurnDots();
            return;
        }

        // Hide percentage bar elements — turn dots are the primary indicator
        pct.textContent  = '';
        fill.style.width = '0%';
        if (meta) { meta.textContent = ''; }

        _renderTurnDots();
        _renderTurnCompactionInfo();
    }

    function _renderEstimatedBar(pct, fill, meta, limit) {
        var totalChars = 0;
        var estTokens;
        var node  = null;
        var found = false;

        // Same correction as Path A — see the comment there. On Firefox this is the
        // ONLY path (SSE interception is disabled per DEC-020), so the undercount
        // was permanent for Firefox users.
        if (ciIsReady()) {
            totalChars = ciTotalChars();
            estTokens  = Math.round(totalChars / 4);
            node       = ciFindScrollContainer();
            found      = !!node;
        } else {
            node  = ciFindScrollContainer();
            found = !!node;
            if (found) totalChars = (node.innerText || '').length;
            if (!totalChars) {
                totalChars = _questions.reduce(function (s, q) { return s + q.text.length; }, 0) * 3;
            }
            var nInDOM   = _questions.filter(function(q) { return q.element && document.body.contains(q.element); }).length;
            var coverage = nInDOM / Math.max(1, _questions.length);
            estTokens = Math.round((totalChars / 4) / Math.max(0.25, coverage));
        }

        // For Claude: add invisible overhead that DOM scraping can never see.
        // (1) System prompt + tool defs — same dynamic estimate as Path A for consistency.
        // (2) Extended thinking — each collapsed [aria-expanded] thinking summary in the
        //     conversation represents hidden thinking content (~600 tokens each on average).
        if (platform && platform.id === 'claude' && ciIsReady()) {
            // Real thinking content from the index — no heuristic needed.
            estTokens += _estimateClaudeOverhead();
            estTokens += Math.round(ciTotalThinkingChars() / 4);
        } else if (platform && platform.id === 'claude' && found && node) {
            estTokens += _estimateClaudeOverhead();
            var uiKw = ['hide','show','expand','collapse','menu','chat','chats','project','artifact','recent','starred'];
            var thinkingCount = 0;
            node.querySelectorAll('[aria-expanded]').forEach(function(el) {
                var txt = (el.textContent || '').trim().toLowerCase();
                var isUI = txt.length < 5 || uiKw.some(function(w) { return txt.indexOf(w) !== -1; });
                if (!isUI) thinkingCount++;
            });
            estTokens += thinkingCount * 600;
        }

        var pctNum = Math.min(100, Math.round((estTokens / limit) * 100));
        var color  = getBarColor(pctNum);

        pct.textContent  = pctNum + '%';
        pct.style.color  = color;
        fill.style.width      = pctNum + '%';
        fill.style.background = color;

        if (meta) {
            var kEst   = (estTokens / 1000).toFixed(1);
            var kLimit = Math.round(limit / 1000);
            meta.textContent = '~' + kEst + 'K / ' + kLimit + 'K tokens (est.)';
            meta.style.color = '#666';
        }
    }

    function _renderCompactionInfo(pctNum) {
        var ctx = document.getElementById('acn-ctx-pct');
        if (!ctx) return;
        var container = ctx.closest ? ctx.closest('.acn-ctx') : null;
        if (!container) return;

        var badge = document.getElementById('acn-ctx-compact');
        if (_compactionCount > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id        = 'acn-ctx-compact';
                badge.className = 'acn-ctx-compact';
                container.appendChild(badge);
            }
            badge.textContent = '\u26a1 ' + _compactionCount +
                ' compaction' + (_compactionCount !== 1 ? 's' : '') + ' detected';
        } else if (badge) {
            badge.remove();
        }

        var warn = document.getElementById('acn-ctx-warn');
        if (pctNum >= 85) {
            if (!warn) {
                warn = document.createElement('div');
                warn.id        = 'acn-ctx-warn';
                warn.className = 'acn-ctx-warn';
                container.appendChild(warn);
            }
            warn.textContent = '\u26a0 Context nearly full \u2014 quality may degrade';
        } else if (warn) {
            warn.remove();
        }
    }

    function _renderTurnDots() {
        var ctx = document.getElementById('acn-ctx-pct');
        if (!ctx) return;
        var container = ctx.closest ? ctx.closest('.acn-ctx') : null;
        if (!container) return;

        var dotsEl = document.getElementById('acn-ctx-dots');
        if (!dotsEl) {
            dotsEl = document.createElement('div');
            dotsEl.id        = 'acn-ctx-dots';
            dotsEl.className = 'acn-ctx-dots';
            container.appendChild(dotsEl);
        }

        while (dotsEl.firstChild) dotsEl.removeChild(dotsEl.firstChild);

        var predicted = _turnCounter.predictedCycleLength;
        var since     = _turnCounter.turnsSinceCompact;
        var total     = predicted || 40;

        var dotsToShow = Math.min(since, 40);
        for (var i = 0; i < dotsToShow; i++) {
            var dot = document.createElement('div');
            dot.className = 'acn-ctx-dot';

            var pct = predicted ? (i / predicted) : (i / total);
            if (pct < 0.70)      dot.style.background = '#22c55e';
            else if (pct < 0.85) dot.style.background = '#eab308';
            else                 dot.style.background = '#ef4444';

            if (_compactionHistory.indexOf(_turnCounter.lastCompactTurn - since + i) !== -1) {
                dot.style.background = '#a478f0';
            }

            dotsEl.appendChild(dot);
        }
    }

    function _removeTurnDots() {
        var el = document.getElementById('acn-ctx-dots');
        if (el) el.remove();
    }

    function _renderTurnCompactionInfo() {
        var ctx = document.getElementById('acn-ctx-pct');
        if (!ctx) return;
        var container = ctx.closest ? ctx.closest('.acn-ctx') : null;
        if (!container) return;

        var badge = document.getElementById('acn-ctx-compact');
        if (_turnCounter.compactionCount > 0 || _turnCounter.totalTurns > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id        = 'acn-ctx-compact';
                badge.className = 'acn-ctx-compact';
                container.appendChild(badge);
            }
            var since     = _turnCounter.turnsSinceCompact;
            var predicted = _turnCounter.predictedCycleLength;
            var txt = 'Turn ' + _turnCounter.totalTurns;
            if (_turnCounter.compactionCount > 0) {
                txt += ' \u2022 ' + _turnCounter.compactionCount + ' compaction' +
                       (_turnCounter.compactionCount !== 1 ? 's' : '');
            }
            if (predicted && since > 0) {
                var remaining = Math.max(0, predicted - since);
                txt += ' \u2022 ~' + remaining + ' turns to next';
            }
            badge.textContent = txt;
        } else if (badge) {
            badge.remove();
        }

        var warn = document.getElementById('acn-ctx-warn');
        var predicted2 = _turnCounter.predictedCycleLength;
        var showWarn   = predicted2 && (_turnCounter.turnsSinceCompact / predicted2) >= 0.85;
        if (showWarn) {
            if (!warn) {
                warn = document.createElement('div');
                warn.id        = 'acn-ctx-warn';
                warn.className = 'acn-ctx-warn';
                container.appendChild(warn);
            }
            warn.textContent = '\u26a0 Approaching compaction \u2014 context may degrade';
        } else if (warn) {
            warn.remove();
        }
    }

    function _prefersReducedMotion() {
        try {
            return window.matchMedia &&
                   window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) { return false; }
    }

    // A multi-iteration jump can take a second or more; the panel must not look
    // frozen. Marks the panel busy and disables further clicks while in flight.
    // Token-aware so a SUPERSEDED jump cannot clear the busy state of the jump that
    // superseded it. Without this, a second click started jump B, jump A was cancelled,
    // and A's completion callback cleared the flag while B was still running — leaving B
    // unguarded and firing a spurious failure toast.
    var _ciBusyToken = 0;

    function orbSetJumpBusyFor(token, busy) {
        if (busy) { _ciBusyToken = token; orbSetJumpBusy(true); return; }
        if (token !== _ciBusyToken) return;   // a newer jump owns the flag
        orbSetJumpBusy(false);
    }

    function orbSetJumpBusy(busy) {
        // Mark BOTH panels that can start a jump. An earlier version only marked the
        // Navigate panel, so a bookmark-initiated jump gave no feedback at all for its
        // whole multi-second duration.
        // Search included: its results can start jumps too (unmounted assistant
        // matches route through the bridge), and without the guard repeated result
        // clicks supersede and restart the in-flight jump (Codex :5143).
        var ids = ['acn-panel-nav', 'acn-panel-bookmarks', 'acn-panel-search'];
        for (var i = 0; i < ids.length; i++) {
            var panel = document.getElementById(ids[i]);
            if (!panel) continue;
            if (busy) panel.setAttribute('data-acn-jumping', 'true');
            else panel.removeAttribute('data-acn-jumping');
        }
        // Dimming alone left the list fully interactive despite the comment claiming
        // otherwise; the click-blocking is done by the [data-acn-jumping] CSS rule.
        // getElementById('acn-bm-list') was always null — the bookmarks list is an
        // unnamed .acn-ql inside #acn-panel-bookmarks. Dim by structure instead.
        var list = document.getElementById('acn-nav-list');
        if (list) list.style.opacity = busy ? '0.55' : '';
        var bmPanel = document.getElementById('acn-panel-bookmarks');
        var bmList  = bmPanel ? bmPanel.querySelector('.acn-ql') : null;
        if (bmList) bmList.style.opacity = busy ? '0.55' : '';
    }

    // Re-locates a question's DOM node among whatever is mounted right now.
    // Under recycling the stored element reference goes stale constantly, so
    // matching on normalized text is the only durable handle we have until the
    // node carries a stable id.
    function _relocateQuestionElement(q) {
        // Index-backed disambiguation first. Matching on normalized text alone returns
        // the FIRST mounted match, so a repeated question — or two sharing a 200-char
        // prefix — resolves to the wrong one, and the caller then treats the question as
        // found and never enters the jump. q.pathIndex is authoritative; use it.
        if (ciIsClaudeChat() && ciIsReady() && !q.provisional &&
            typeof q.pathIndex === 'number' && _ciFullPath) {
            // ONE MATCHER. This is the same 3a/3b arrival resolution the settle loop
            // uses — markdown-tolerant, candidate-range disambiguation, both senders.
            // The fast path runs far more often than the loop, so a second legacy
            // matcher here is where drift would start; there isn't one.
            var relRows = ciMountedRows();
            var relU = Math.max(0, _ciFullPath.length - (ciTotalRows() || _ciFullPath.length));
            var relHit = ciMatchTargetInWindow(q.pathIndex, relRows, relU);
            if (relHit) return ciMessageNodeWithin(relHit.el);
            var relMeta = {};
            var relRes = ciResolveFromPairs(ciLocalPairs(relRows), q.pathIndex, relU, relMeta);
            if (relRes !== null && relMeta.exact) {
                var relEl = ciRowElement(relRes);
                if (relEl) return ciMessageNodeWithin(relEl);
            }
            // Not mounted (or not resolvable here): fall through to the jump rather
            // than returning a same-text impostor.
            return null;
        }
        // isConnected alone is NOT sufficient. Under recycling the virtualizer reuses
        // the same DOM node for a different message, so a still-connected node can be
        // displaying different content — the same trap the bookmark-icon guard
        // documents. Re-validate the text before trusting the cached reference.
        if (q.element && q.element.isConnected &&
            _normalizeKey(_readMessageText(q.element)) === _normalizeKey(q.text)) {
            return q.element;
        }
        var wanted  = _normalizeKey(q.text);
        var current = Array.from(getUserMessages());
        for (var i = 0; i < current.length; i++) {
            if (_normalizeKey(_readMessageText(current[i])) === wanted) return current[i];
        }
        return null;
    }

    function orbScrollToQuestion(q) {
        var target = _relocateQuestionElement(q);

        // Not mounted. On Claude the settle loop can page the virtualizer to it.
        // The other 13 platforms are not known to virtualize, so they short-circuit
        // here and keep the plain behaviour — the seam stays clean for the
        // cross-platform audit to add platforms later.
        if (!target) {
            // pathIndex must be a REAL position in the active path. Provisional
            // entries (DOM-merged, not yet in the index) carry MAX_SAFE_INTEGER as
            // a sort key — jumping to that would burn all 8 iterations chasing a
            // row that cannot exist.
            if (ciIsClaudeChat() && ciIsReady() && _ciFullPath &&
                !q.provisional && typeof q.pathIndex === 'number' &&
                q.pathIndex >= 0 && q.pathIndex < _ciFullPath.length) {
                ciJumpToFullPathIndex(q.pathIndex, function (ok, el, reason) {
                    if (ok && el) {
                        q.element = el;
                        orbMarkJumpTarget(el);
                        el.scrollIntoView({ behavior: _prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
                        orbFlashElement(el);
                    } else if (reason !== 'superseded' && reason !== 'user') {
                        // Honest failure retained — but only for a genuine miss. A
                        // superseded jump or a user-initiated scroll is not a failure.
                        showToast('That message is not currently rendered — scroll toward it and try again');
                    }
                });
                return;
            }
            showToast('That message is not currently rendered — scroll toward it and try again');
            return;
        }
        q.element = target;
        // The fast path IS a resolution — the target was found mounted and verified.
        // Publishing it through the same contract as the settle loop keeps success
        // observable on ONE channel: without this, a sequential sweep (click Q1, then
        // Q2...) reported 147/147 failures while every jump was actually correct,
        // because each next target sat inside the mount window and resolved here.
        orbMarkJumpTarget(target);

        if (isLeftChat) {
            // Close panel first so it doesn't obscure the chat
            orbClosePanel();
            setTimeout(function () {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                orbFlashElement(target);
            }, 350);
        } else {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            orbFlashElement(target);
        }
    }

    // Publishes WHICH element a jump actually resolved, as part of the data-acn-*
    // test contract.
    //
    // Why this exists: a mutation test proved the suite could not tell a correct jump
    // from a confidently wrong one. Asserting on post-hoc DOM state — "is row N mounted
    // and does it read right" — passes even when the navigator resolved a DIFFERENT
    // message, because the mount window is several rows wide and an off-by-one target
    // lands in the same window. Forcing the row offset to 0 and stubbing verification
    // to true made the jump resolve the ASSISTANT reply instead of the question, and
    // the whole suite stayed green. The only sound assertion is on the element the
    // implementation handed back, so it has to be observable.
    function orbMarkJumpTarget(el) {
        var prev = document.querySelectorAll('[data-acn-jump-target]');
        for (var i = 0; i < prev.length; i++) prev[i].removeAttribute('data-acn-jump-target');
        if (el && el.setAttribute) el.setAttribute('data-acn-jump-target', 'true');

        // ALSO record the resolution on the zone, which is stable.
        // Marking only the element is not enough: scrollIntoView fires a scroll, the
        // virtualizer re-renders, and the resolved node is detached before anything can
        // read it — the mark disappears precisely because virtualization works. The row
        // index is the durable identity.
        var zone = document.getElementById('acn-zone');
        if (!zone) return;
        var rowEl = (el && el.closest) ? el.closest('[' + CI_ROW_ATTR + ']') : null;
        if (rowEl) zone.setAttribute('data-acn-jump-resolved', rowEl.getAttribute(CI_ROW_ATTR));
        else zone.removeAttribute('data-acn-jump-resolved');
    }

    function orbFlashElement(el) {
        if (!el) return;
        // Re-entrancy: a second flash within the window would capture the FIRST flash's
        // tint as "original" and write it back permanently. Cancel any flash already in
        // progress on this node and restore its true baseline first.
        if (el.__acnFlash) {
            clearTimeout(el.__acnFlash.timer);
            el.style.backgroundColor = el.__acnFlash.bg;
            el.style.transition      = el.__acnFlash.tran;
            el.__acnFlash = null;
        }
        var orig     = el.style.backgroundColor;
        var origTran = el.style.transition;
        el.style.backgroundColor = 'rgba(' + orbTheme.rgb + ',.15)';
        el.style.transition = 'background-color .3s';
        var timer = setTimeout(function () {
            el.__acnFlash = null;
            // Always restore, connected or not: skipping cleanup on a detached node left
            // our inline background/transition on a row the virtualizer can re-attach.
            el.style.backgroundColor = orig;
            el.style.transition = origTran;
        }, 1500);
        el.__acnFlash = { timer: timer, bg: orig, tran: origTran };
    }

    // ============================================================
    // SEARCH PANEL CONTENT
    // ============================================================
    function orbPopulateSearch(query) {
        if (typeof orbSearchQuery !== 'undefined') {
            orbSearchQuery = query || '';
        }

        var list = document.getElementById('acn-search-list');
        var hint = document.getElementById('acn-search-hint');
        if (!list) return;

        var q = (query || '').trim();

        // Skip DOM teardown+rebuild if query and data are unchanged — prevents hover
        // flicker caused by MutationObserver firing orbOnScanComplete every ~500ms
        if (q) {
            // _ciIndexGen: a regenerated/edited branch can swap the index with
            // UNCHANGED counts; without the generation the early-return kept showing
            // the old branch's results until the query changed (Codex R5 :1617).
            var sfp = q + '|' + _questions.length + '|' + (_aiResponses ? _aiResponses.length : 0) +
                      '|g' + _ciIndexGen;
            if (sfp === _searchListFingerprint && list.firstChild) return;
            _searchListFingerprint = sfp;
        }

        while (list.firstChild) list.removeChild(list.firstChild);

        if (!q) {
            if (hint) {
                hint.style.display = '';
                hint.textContent = i18n('searchPlaceholder') || 'Search through your conversation';
            }
            return;
        }

        if (hint) hint.style.display = 'none';

        var qLower = q.toLowerCase();

        // --- Gather user-message matches ---
        var questionMatches = [];
        if (typeof _questions !== 'undefined') {
            _questions.forEach(function (msg, idx) {
                if (msg.text.toLowerCase().indexOf(qLower) !== -1) {
                    questionMatches.push({
                        element:   msg.element,
                        text:      msg.text,
                        labelText: 'Q#' + (idx + 1),
                        isAI:      false,
                        qObj:      msg
                    });
                }
            });
        }

        // --- Gather AI-response matches ---
        // Index-backed when available. _aiResponses is rebuilt from mounted DOM on
        // every scan, so on a virtualized platform it holds only the ~3 visible
        // responses — searching it alone matched every indexed QUESTION but only
        // the on-screen ANSWERS, which fails the "search anywhere in the
        // conversation" requirement for half the conversation.
        var aiMatches = [];
        if (ciIsClaudeChat() && ciIsReady() && _ciFullPath) {
            var aiSeq = 0;
            for (var fp = 0; fp < _ciFullPath.length; fp++) {
                if (_ciFullPath[fp].sender === 'human') continue;
                // Interrupted/superseded entries have NO virtualizer row: a click could
                // never land, and the mapping fallback could report a neighbouring row
                // as success (Codex R6 :5544). They are not reachable content.
                if (!ciEntryRenders(_ciFullPath[fp])) continue;
                aiSeq++;
                var aiText = _ciFullPath[fp].text || '';
                if (aiText.toLowerCase().indexOf(qLower) === -1) continue;
                aiMatches.push({
                    element:   null,          // resolved on click if mounted
                    text:      aiText,
                    labelText: 'A#' + aiSeq,
                    isAI:      true,
                    qObj:      null,
                    uuid:      _ciFullPath[fp].uuid,
                    pathIndex: fp
                });
            }
        } else if (typeof _aiResponses !== 'undefined') {
            _aiResponses.forEach(function (el, idx) {
                var text = _readAIText(el);
                if (text.toLowerCase().indexOf(qLower) !== -1) {
                    aiMatches.push({
                        element:   el,
                        text:      text,
                        labelText: 'A#' + (idx + 1),
                        isAI:      true,
                        qObj:      null
                    });
                }
            });
        }

        var allMatches = questionMatches.concat(aiMatches);

        if (allMatches.length === 0) {
            var empty = createElement('div', {
                className: 'acn-empty',
                textContent: 'No matches for "' + q + '"'
            });
            list.appendChild(empty);
            return;
        }

        // Sort by conversation position. Under virtualization almost every indexed
        // match has element:null, so the DOM comparator returned 0 for them and the
        // list stayed in concatenation order — all questions, then all answers
        // (Codex round-1 P2). Path position is authoritative when either side has it.
        allMatches.sort(function (a, b) {
            var ap = a.qObj ? a.qObj.pathIndex : a.pathIndex;
            var bp = b.qObj ? b.qObj.pathIndex : b.pathIndex;
            if (typeof ap === 'number' && typeof bp === 'number' && ap !== bp) {
                return ap - bp;
            }
            if (!a.element || !b.element) return 0;
            var pos = a.element.compareDocumentPosition(b.element);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING)  return  1;
            return 0;
        });

        // Build count hint
        var qCount  = questionMatches.length;
        var aiCount = aiMatches.length;
        var total   = allMatches.length;
        var hintParts = [];
        if (qCount  > 0) hintParts.push(qCount  + ' ' + (i18n('searchInQuestions') || 'in questions'));
        if (aiCount > 0) hintParts.push(aiCount + ' ' + (i18n('searchInResponses') || 'in responses'));

        var countHintEl = createElement('div', {
            className: 'acn-sh',
            textContent: (i18n('searchResults') || '{count} matches').replace('{count}', total) +
                (hintParts.length ? ' (' + hintParts.join(', ') + ')' : '')
        });
        countHintEl.style.display = '';
        list.appendChild(countHintEl);

        allMatches.forEach(function (match) {
            var text  = match.text;
            var lower = text.toLowerCase();
            var pos   = lower.indexOf(qLower);
            var start = Math.max(0, pos - 40);
            var end   = Math.min(text.length, pos + q.length + 40);

            var pre  = (start > 0 ? '...' : '') + text.substring(start, pos);
            var hit  = text.substring(pos, pos + q.length);
            var post = text.substring(pos + q.length, end) + (end < text.length ? '...' : '');

            var numEl = createElement('div', {
                className: match.isAI ? 'acn-qn acn-qn-ai' : 'acn-qn',
                textContent: match.labelText
            });

            var mark   = createElement('span', { className: 'acn-smatch', textContent: hit });
            var textEl = createElement('div', { className: 'acn-qt' }, [
                document.createTextNode(pre),
                mark,
                document.createTextNode(post)
            ]);

            var item = createElement('div', { className: 'acn-qi' }, [numEl, textEl]);

            item.addEventListener('click', (function (m) {
                return function () {
                    if (!m.isAI && m.qObj) {
                        orbScrollToQuestion(m.qObj);
                        return;
                    }
                    // Index-backed AI matches carry no element — the message may not
                    // be mounted. Try to locate it among what IS mounted, and fail
                    // visibly rather than silently doing nothing.
                    var target = m.element;
                    if ((!target || !target.isConnected) && typeof m.pathIndex === 'number' &&
                        ciIsClaudeChat() && ciIsReady()) {
                        // INDEXED match: resolve by ROW IDENTITY only. The old
                        // text-prefix scan accepted the first mounted response sharing
                        // the same 200-char normalized prefix, so boilerplate-prefixed
                        // answers scrolled to the wrong message (Codex R4). A mounted
                        // row that RESOLVES to this match's path entry is the target;
                        // anything else falls through to the uuid jump bridge below.
                        var mrows = ciMountedRows();
                        for (var ri = 0; ri < mrows.length; ri++) {
                            if (mrows[ri].isUser) continue;
                            var rp = ciResolvePathForRowStrict(mrows[ri].dataIndex);
                            if (rp === null) rp = ciMatchRowToPath(mrows[ri]);
                            if (rp === m.pathIndex) {
                                target = ciMessageNodeWithin(mrows[ri].el);
                                break;
                            }
                        }
                    } else if (!target || !target.isConnected) {
                        // Non-indexed platforms: text matching is all there is.
                        var wanted = _normalizeKey(m.text);
                        var live   = Array.from(getAIMessages());
                        for (var i = 0; i < live.length; i++) {
                            // MUST use the same extractor the stored text came from
                            // (_readAIText) — raw textContent includes our injected
                            // bookmark glyph.
                            if (_normalizeKey(_readAIText(live[i])) === wanted) {
                                target = live[i];
                                break;
                            }
                        }
                    }
                    if (!target) {
                        // Unmounted assistant match: resolve its uuid to a path index
                        // and use the jump bridge — the settle loop supports assistant
                        // rows. Toast only when even that cannot resolve (Codex P1).
                        var jp = null;
                        if (m.uuid && ciIsReady() && _ciFullPath) {
                            if (typeof m.pathIndex === 'number') jp = m.pathIndex;
                            else {
                                for (var pi = 0; pi < _ciFullPath.length; pi++) {
                                    if (_ciFullPath[pi].uuid === m.uuid) { jp = pi; break; }
                                }
                            }
                        }
                        if (jp !== null) {
                            ciJumpToFullPathIndex(jp, function (ok, el2, reason) {
                                if (ok && el2) {
                                    orbMarkJumpTarget(el2);
                                    el2.scrollIntoView({ behavior: _prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
                                    orbFlashElement(el2);
                                } else if (reason !== 'superseded' && reason !== 'user') {
                                    showToast('That message is not currently rendered — scroll toward it and try again');
                                }
                            });
                            return;
                        }
                        showToast('That message is not currently rendered — scroll toward it and try again');
                        return;
                    }
                    orbScrollToMessage(target);
                };
            }(match)));

            list.appendChild(item);
        });
    }

    // ============================================================
    // MODE SELECTOR
    // ============================================================
    function orbSetMode(mode) {
        orbMode = mode;
        orbPrevRotIdx = orbRotIdx;
        orbRotIdx = 0;
        orbSaveSettings();

        // Sync settings panel selector if it exists
        var sel = document.getElementById('acn-mode-sel');
        if (sel) sel.value = mode;

        orbDots.forEach(function (d) { d.classList.remove('acn-no-t'); });
        orbRender();
        orbUpdateHitzone();
    }

    // ============================================================
    // DOM BUILDERS
    // ============================================================
    function orbBuildPanelHeader(title, closeBtn) {
        var h3  = createElement('h3', null, [title]);
        var btn = createElement('button', { className: 'acn-xb', textContent: '\u2715' });
        btn.setAttribute('data-acn-role', 'panel-close');
        btn.addEventListener('click', orbClosePanel);
        var hdr = createElement('div', { className: 'acn-ph' }, [h3, btn]);
        return hdr;
    }

    function orbBuildPanelNav() {
        var panel = createElement('div', { id: 'acn-panel-nav', className: 'acn-panel' });
        panel.setAttribute('data-acn-role', 'nav-panel');

        panel.appendChild(orbBuildPanelHeader('\u2733 ' + (i18n('navigate') || 'Navigate')));

        // Context bar
        var ctxLabelText = (platform.id === 'claude') ? 'Context window' : 'Conversation turns';
        var ctxLabel = createElement('span', { className: 'acn-ctx-l', textContent: ctxLabelText });
        var ctxPct   = createElement('span', { id: 'acn-ctx-pct', className: 'acn-ctx-pct',
            textContent: '—' });
        var ctxRow   = createElement('div', { className: 'acn-ctx-r' }, [ctxLabel, ctxPct]);
        var ctxFill  = createElement('div', { id: 'acn-ctx-fill', className: 'acn-ctx-fill',
            style: 'width:0%' });
        var ctxBar   = createElement('div', { className: 'acn-ctx-bar' }, [ctxFill]);
        var ctxMeta  = createElement('div', { id: 'acn-ctx-meta', className: 'acn-ctx-meta',
            textContent: 'Estimated from visible text' });
        var ctx      = createElement('div', { className: 'acn-ctx' }, [ctxRow, ctxBar, ctxMeta]);
        panel.appendChild(ctx);

        // Plan usage section (Claude only)
        if (platform.id === 'claude') {
            var usageSection = createElement('div', {
                id: 'acn-usage-section',
                className: 'acn-usage-section'
            });
            ctx.appendChild(usageSection);
        }

        var stat = createElement('div', { id: 'acn-nav-stat', className: 'acn-pstat',
            textContent: '0 questions found' });
        stat.setAttribute('data-acn-role',  'nav-stat');
        stat.setAttribute('data-acn-count', '0');
        panel.appendChild(stat);

        var list = createElement('div', { id: 'acn-nav-list', className: 'acn-ql' });
        list.setAttribute('data-acn-role', 'nav-list');
        panel.appendChild(list);

        return panel;
    }

    function orbBuildPanelSearch() {
        var panel = createElement('div', { id: 'acn-panel-search', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\u2315 ' + (i18n('search') || 'Search')));

        var input = createElement('input', {
            id: 'acn-search-input',
            className: 'acn-si',
            type: 'text',
            placeholder: 'Search keywords...',
        });
        var searchTimeout = null;
        input.addEventListener('input', function () {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function () {
                orbPopulateSearch(input.value);
            }, 200);
        });

        var hint = createElement('div', { id: 'acn-search-hint', className: 'acn-sh',
            textContent: 'Search through your conversation' });

        var wrap = createElement('div', { className: 'acn-search-wrap' }, [input, hint]);
        panel.appendChild(wrap);

        var list = createElement('div', { id: 'acn-search-list', className: 'acn-ql' });
        panel.appendChild(list);

        return panel;
    }

    // ============================================================
    // BOOKMARKS — storage helpers, icon injection, panel (Group D)
    // ============================================================

    var BOOKMARK_KEY = 'acn-bookmarks-v1';

    function contentHash(text, msgIndex) {
        var str = String(msgIndex) + '|' + (text || '').substring(0, 200);
        var h = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
            h = h >>> 0;
        }
        return ('00000000' + h.toString(16)).slice(-8);
    }

    function normalizeConversationUrl() {
        return window.location.origin + window.location.pathname;
    }

    function getBookmarks() {
        try {
            var raw = GM_getValue(BOOKMARK_KEY, '{}');
            return JSON.parse(raw) || {};
        } catch (e) {
            return {};
        }
    }

    function getConversationBookmarks() {
        var store = getBookmarks();
        var url   = normalizeConversationUrl();
        return (store[url] && store[url].bookmarks) ? store[url].bookmarks : [];
    }

    function saveBookmark(bookmark) {
        var store = getBookmarks();
        var url   = normalizeConversationUrl();
        if (!store[url]) store[url] = { bookmarks: [] };
        store[url].bookmarks = store[url].bookmarks.filter(function (b) {
            return b.id !== bookmark.id;
        });
        store[url].bookmarks.push(bookmark);
        try {
            GM_setValue(BOOKMARK_KEY, JSON.stringify(store));
        } catch (e) {}
    }

    // Removal must also RESET icon state. A pre-v12 bookmark's mounted icon
    // carries the new uuid identity while the stored record kept its legacy hash;
    // removal by the stored hash cannot find that icon, and injectBookmarkIcons'
    // identity guard then skips recomputing it — the flag stayed visibly active and
    // clicking it re-added the bookmark (Codex R9 :6118). Clearing the recorded
    // identity on every mounted icon forces the next scan to rebuild all of them
    // from the now-current store; a handful of icons is cheap.
    function _bmResetIconState() {
        var marked = document.querySelectorAll('[data-acn-bookmarked]');
        for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute('data-acn-bookmarked');
            var ic = marked[i].querySelector('[data-acn-bookmark]');
            if (ic && ic.parentNode) ic.parentNode.removeChild(ic);
        }
        if (typeof injectBookmarkIcons === 'function') injectBookmarkIcons();
    }

    function removeBookmark(bookmarkId) {
        var store = getBookmarks();
        var url   = normalizeConversationUrl();
        if (!store[url]) return;
        store[url].bookmarks = store[url].bookmarks.filter(function (b) {
            return b.id !== bookmarkId;
        });
        try {
            GM_setValue(BOOKMARK_KEY, JSON.stringify(store));
        } catch (e) {}
        _bmResetIconState();
    }

    function _bmGenId() {
        return 'bm_' + Math.random().toString(16).substring(2, 10);
    }

    function toggleBookmark(entityId, entityType, entityEl, msgIndex, legacyIds) {
        // Match the legacy id too. createBookmarkIcon() renders a pre-v12.0 record
        // as active via legacyId, so without this the toggle would add a SECOND
        // record under the new identity and leave the old one behind — the icon
        // would then never clear.
        var existing = getConversationBookmarks().filter(function (b) {
            return b.contentHash === entityId || _bmInLegacySet(b, legacyIds);
        });

        var icon = entityEl.querySelector('[data-acn-bookmark]');

        if (existing.length > 0) {
            existing.forEach(function (b) { removeBookmark(b.id); });
            if (icon) icon.classList.remove('acn-bm-active');
            showToast(i18n('bookmarkRemoved'));
        } else {
            // Through the shared extractor like every other consumer: raw textContent
            // ends in our own bookmark glyph for messages under 120 chars.
            var text    = _cleanText(entityEl).trim();
            var preview = text.substring(0, 120);
            // schema 2 records key to the stable message uuid. schema 1 records key
            // to contentHash(text, msgIndex) — where msgIndex is a position in the
            // live NodeList. Under virtualization that index changes as the user
            // scrolls, so schema 1 records silently stop matching their own message.
            var isUuid = /^[0-9a-f-]{36}$/i.test(entityId);
            var bm = {
                id:          _bmGenId(),
                schema:      isUuid ? 2 : 1,
                entityType:  entityType,
                contentHash: entityId,
                msgUuid:     isUuid ? entityId : null,
                preview:     preview,
                msgIndex:    msgIndex,
                createdAt:   Date.now(),
                platform:    window.location.hostname
            };
            saveBookmark(bm);
            if (icon) icon.classList.add('acn-bm-active');
            showToast(i18n('bookmarkAdded'));
        }

        var bmPanel = document.getElementById('acn-panel-bookmarks');
        if (bmPanel && bmPanel.classList.contains('acn-open')) {
            orbRefreshBookmarksPanel();
        }
    }

    function createBookmarkIcon(entityEl, entityType, entityId, msgIndex, legacyIds) {
        if (entityEl.querySelector('[data-acn-bookmark]')) return;

        var computed = window.getComputedStyle(entityEl);
        if (computed.position === 'static') {
            entityEl.style.position = 'relative';
        }

        var bookmarks    = getConversationBookmarks();
        var isBookmarked = bookmarks.some(function (b) {
            return b.contentHash === entityId || _bmInLegacySet(b, legacyIds);
        });

        var icon = document.createElement('div');
        icon.className = 'acn-bm-icon' + (isBookmarked ? ' acn-bm-active' : '');
        icon.textContent = '\u2691';
        icon.setAttribute('data-acn-bookmark', entityId);
        icon.setAttribute('title', isBookmarked ? 'Remove bookmark' : 'Bookmark this message');

        icon.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleBookmark(entityId, entityType, entityEl, msgIndex, legacyIds);
            var nowBookmarked = getConversationBookmarks().some(function (b) {
                return b.contentHash === entityId || _bmInLegacySet(b, legacyIds);
            });
            icon.setAttribute('title', nowBookmarked ? 'Remove bookmark' : 'Bookmark this message');
        });

        entityEl.appendChild(icon);
    }

    // Resolves the stable identity for a message element. Prefers the API message
    // uuid; falls back to the legacy position-dependent content hash on platforms
    // (or conversations) where no index is available.
    function _bmEntityId(el, idx, text) {
        return ciUuidForText(text, el) || contentHash(text, idx);
    }

    // Pre-v12.0 records hashed the RAW textContent. v12.0 routes user-message text
    // through _readMessageText(), which applies the platform textExtractor and a
    // corrected "You said:" strip — so the hash input changed for Emergent (the one
    // platform with a textExtractor) and for ChatGPT (whose sr-only label ends in a
    // colon the old pattern could not match). Recognising the legacy id keeps those
    // bookmarks working instead of silently orphaning them.
    function _bmLegacyId(el, idx) {
        return contentHash((el.textContent || '').trim(), idx);
    }

    // Pre-v12.0 records exist in BOTH shapes, because the icon is injected into the
    // message element: records written before the first injection hashed clean text,
    // records written after hashed text ending in the glyph. Two call sites disagreed
    // — one evaluated with the icon removed, one with it present — so each recognised
    // records the other could not. Both variants are returned here and every consumer
    // checks the whole set.
    // Reads textContent with ONLY our injected bookmark icon removed — sr-only labels
    // and everything else kept. That is exactly what v11.8 hashed.
    function _textAsLegacy(el) {
        if (!el) return '';
        if (!el.querySelector || !el.querySelector('[data-acn-bookmark]')) {
            return el.textContent || '';
        }
        var out = '', kids = el.childNodes;
        for (var i = 0; i < kids.length; i++) {
            var k = kids[i];
            if (k.nodeType !== 1 && k.nodeType !== 3) continue;
            if (k.nodeType === 1 && k.getAttribute &&
                k.getAttribute('data-acn-bookmark') !== null) continue;
            out += _textAsLegacy(k);
        }
        return out;
    }

    // v11.8 hashed trim(textContent) BEFORE createBookmarkIcon appended the glyph — its
    // injectBookmarkIcons was one-shot-guarded on data-acn-bookmarked === 'u'. So the
    // "hashed with the glyph" shape CANNOT exist in stored data, and the shape that does
    // exist must be reproduced with the glyph removed but sr-only KEPT (v11.8 did not
    // strip it). An earlier version derived the set from whatever the live DOM happened
    // to hold, so the two call sites — one evaluated with the icon removed, one with it
    // present — produced different sets and each missed records the other found.
    function _bmLegacyIdSet(el, idx) {
        var ids   = [contentHash(_textAsLegacy(el).trim(), idx)];
        var clean = _cleanText(el).trim();
        var plain = (el.textContent || '').trim();
        if (clean !== ids[0]) ids.push(contentHash(clean, idx));
        if (plain !== ids[0]) ids.push(contentHash(plain, idx));
        return ids;
    }

    function _bmInLegacySet(bookmark, legacyIds) {
        if (!legacyIds) return false;
        for (var i = 0; i < legacyIds.length; i++) {
            if (bookmark.contentHash === legacyIds[i]) return true;
        }
        return false;
    }

    function _bmMatchesLegacy(bookmark, el, idx) {
        var ids = _bmLegacyIdSet(el, idx);
        for (var i = 0; i < ids.length; i++) {
            if (bookmark.contentHash === ids[i]) return true;
        }
        return false;
    }

    function injectBookmarkIcons() {
        // The guard below compares the RECORDED identity, not merely "has an icon".
        // Under recycling React reuses the same DOM node for a different message,
        // so a presence-only guard would leave a stale icon showing another
        // message's bookmark state.
        function inject(el, idx, type, text) {
            if (!text) return;
            var id = _bmEntityId(el, idx, text);
            if (el.getAttribute('data-acn-bookmarked') === id) return;
            var stale = el.querySelector('[data-acn-bookmark]');
            if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
            el.setAttribute('data-acn-bookmarked', id);
            createBookmarkIcon(el, type, id, idx, _bmLegacyIdSet(el, idx));
        }

        // Ordinal from the PATH, not the mounted window: under virtualization idx
        // is the position among the 3-5 mounted nodes, so a bookmark on question 100
        // rendered as Q#2 in the panel even though its uuid jumped correctly
        // (Codex :5868). Row identity resolves the true ordinal; mounted-window
        // index remains the non-indexed fallback.
        function pathOrdinal(el, sender, fallbackIdx) {
            if (!ciIsClaudeChat() || !ciIsReady() || !_ciFullPath) return fallbackIdx;
            var uuid = ciUuidForText(sender === 'human' ? _readMessageText(el) : _readAIText(el), el);
            if (!uuid) return fallbackIdx;
            var ord = 0;
            for (var i = 0; i < _ciFullPath.length; i++) {
                if (_ciFullPath[i].sender !== sender) continue;
                if (_ciFullPath[i].uuid === uuid) return ord;
                ord++;
            }
            return fallbackIdx;
        }
        Array.from(getUserMessages()).forEach(function (el, idx) {
            inject(el, pathOrdinal(el, 'human', idx), 'user-msg', _readMessageText(el));
        });
        Array.from(getAIMessages()).forEach(function (el, idx) {
            inject(el, pathOrdinal(el, 'assistant', idx), 'ai-msg', _readAIText(el));
        });
    }

    function orbScrollToMessage(el) {
        if (!el) return;

        function doScroll() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.remove('acn-bm-flash');
            void el.offsetWidth;
            el.classList.add('acn-bm-flash');
            setTimeout(function () { el.classList.remove('acn-bm-flash'); }, 1600);
        }

        if (typeof isLeftChat !== 'undefined' && isLeftChat) {
            orbClosePanel();
            setTimeout(doScroll, 350);
        } else {
            doScroll();
        }
    }

    function orbScrollToBookmark(bookmark) {
        var targetEl = null;
        var isUser   = bookmark.entityType === 'user-msg';
        var els      = Array.from(isUser ? getUserMessages() : getAIMessages());
        var i;

        function textOf(el) {
            return isUser ? _readMessageText(el) : _readAIText(el);
        }

        // Preferred: stable uuid match against whatever is mounted.
        var wantUuid = bookmark.msgUuid ||
                       (/^[0-9a-f-]{36}$/i.test(bookmark.contentHash) ? bookmark.contentHash : null);
        if (wantUuid) {
            for (i = 0; i < els.length; i++) {
                if (ciUuidForText(textOf(els[i]), els[i]) === wantUuid) { targetEl = els[i]; break; }
            }
        }

        // Legacy schema 1: recompute the position-dependent hash. Note this only
        // matches when the message happens to sit at the same index it did when
        // bookmarked, which is why these records are migrated on sight below.
        if (!targetEl) {
            for (i = 0; i < els.length; i++) {
                if (contentHash(textOf(els[i]), i) === bookmark.contentHash) { targetEl = els[i]; break; }
            }
        }

        // Pre-v12.0 hash input (raw textContent) — see _bmLegacyId().
        if (!targetEl) {
            for (i = 0; i < els.length; i++) {
                // Both pre-v12.0 shapes: hashed before the icon existed, and hashed
                // after it was injected. Evaluating only one shape here while
                // createBookmarkIcon evaluated the other meant each recognised records
                // the other could not — the icon showed active but the jump failed.
                if (_bmMatchesLegacy(bookmark, els[i], i)) { targetEl = els[i]; break; }
            }
        }

        // Not mounted: route through the SAME settle loop Navigate uses, resolving
        // by message uuid -> position in the active path. Previously this was a
        // separate resolution path ending in `els[bookmark.msgIndex]`, which with
        // ~3 of 147 turns mounted resolved to an unrelated message and scrolled to
        // and highlighted it as if correct. That positional fallback is deleted;
        // failing visibly is strictly better than a confident wrong answer.
        if (!targetEl && wantUuid && ciIsClaudeChat() && ciIsReady() && _ciFullPath) {
            var pathIdx = -1;
            for (i = 0; i < _ciFullPath.length; i++) {
                if (_ciFullPath[i].uuid === wantUuid) { pathIdx = i; break; }
            }
            if (pathIdx >= 0) {
                ciJumpToFullPathIndex(pathIdx, function (ok, el, reason) {
                    if (ok && el) {
                        orbMarkJumpTarget(el);
                        el.scrollIntoView({ behavior: _prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
                        orbFlashElement(el);
                    } else if (reason !== 'superseded' && reason !== 'user') {
                        // Not a failure when the user scrolled or started another jump.
                        showToast('That message is not currently rendered \u2014 scroll toward it and try again');
                    }
                });
                return;
            }
        }

        if (!targetEl) {
            showToast('That message is not currently rendered \u2014 scroll toward it and try again');
            return;
        }

        // Opportunistic migration: once a legacy record is positively identified,
        // upgrade it to a uuid so it stops depending on scroll position.
        if (!bookmark.msgUuid) {
            // Pass the element: without it a duplicate-text bookmark migrated to the
            // FIRST twin's uuid (the text map is deliberately first-wins) and every
            // later click jumped to the wrong message (Codex round-3).
            var resolved = ciUuidForText(textOf(targetEl), targetEl);
            if (resolved) {
                bookmark.msgUuid    = resolved;
                bookmark.contentHash = resolved;
                bookmark.schema     = 2;
                saveBookmark(bookmark);
            }
        }

        orbScrollToMessage(targetEl);
    }

    function orbRefreshBookmarksPanel() {
        var panel = document.getElementById('acn-panel-bookmarks');
        if (!panel) return;

        var bookmarks = getConversationBookmarks();

        // Skip DOM teardown+rebuild if bookmarks unchanged — prevents hover flicker
        // caused by MutationObserver firing orbOnScanComplete every ~500ms
        var bfp = bookmarks.map(function (b) { return b.id; }).join('|');
        if (bfp === _bmListFingerprint && panel.children.length > 1) return;
        _bmListFingerprint = bfp;

        while (panel.children.length > 1) {
            panel.removeChild(panel.lastChild);
        }

        if (bookmarks.length === 0) {
            var empty = createElement('div', {
                className: 'acn-empty',
                textContent: i18n('noBookmarks')
            });
            panel.appendChild(empty);
            return;
        }

        var sorted = bookmarks.slice().sort(function (a, b) {
            return a.createdAt - b.createdAt;
        });

        var list = createElement('div', { className: 'acn-ql' });

        sorted.forEach(function (bm) {
            var labelText = bm.entityType === 'user-msg'
                ? 'Q#' + (bm.msgIndex + 1)
                : 'A#' + (bm.msgIndex + 1);

            var typeEl = createElement('div', {
                className: 'acn-bk-type',
                textContent: labelText
            });

            var removeBtn = createElement('button', {
                className: 'acn-bk-remove',
                textContent: '\u2715',
                title: 'Remove bookmark'
            });
            removeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                removeBookmark(bm.id);
                var icon = document.querySelector('[data-acn-bookmark="' + bm.contentHash + '"]');
                if (icon) icon.classList.remove('acn-bm-active');
                orbRefreshBookmarksPanel();
                showToast(i18n('bookmarkRemoved'));
            });

            var header = createElement('div', { className: 'acn-bk-header' }, [typeEl, removeBtn]);

            var textEl = createElement('div', {
                className: 'acn-bk-text',
                textContent: bm.preview || '(empty message)'
            });

            var dateStr = bm.createdAt
                ? new Date(bm.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : '';
            var metaEl = createElement('div', {
                className: 'acn-bk-meta',
                textContent: dateStr
            });

            var card = createElement('div', { className: 'acn-bk' }, [header, textEl, metaEl]);

            card.addEventListener('click', function () {
                orbScrollToBookmark(bm);
            });

            list.appendChild(card);
        });

        panel.appendChild(list);

        var clearBtn = createElement('button', {
            className: 'acn-bm-clearall',
            textContent: 'Clear all bookmarks'
        });
        clearBtn.addEventListener('click', function () {
            if (!window.confirm('Remove all bookmarks for this conversation?')) return;
            var store = getBookmarks();
            var url   = normalizeConversationUrl();
            if (store[url]) {
                store[url].bookmarks = [];
                try {
                    GM_setValue(BOOKMARK_KEY, JSON.stringify(store));
                } catch (e) {}
            }
            var activeIcons = document.querySelectorAll('.acn-bm-icon.acn-bm-active');
            for (var i = 0; i < activeIcons.length; i++) {
                activeIcons[i].classList.remove('acn-bm-active');
            }
            orbRefreshBookmarksPanel();
            showToast('All bookmarks cleared');
        });

        panel.appendChild(clearBtn);
    }

    function orbBuildPanelBookmarks() {
        var panel = createElement('div', { id: 'acn-panel-bookmarks', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\u2691 ' + i18n('bookmarks')));

        var bookmarks = getConversationBookmarks();

        if (bookmarks.length === 0) {
            var empty = createElement('div', {
                className: 'acn-empty',
                textContent: i18n('noBookmarks')
            });
            panel.appendChild(empty);
        } else {
            panel.appendChild(createElement('div', { className: 'acn-ql' }));
            orbRefreshBookmarksPanel();
            return panel;
        }

        return panel;
    }

    // ============================================================
    // SUMMARY — heuristic analysis engine (Group E1)
    // ============================================================

    var _acnSummaryStyleInjected = false;

    function _acnInjectSummaryCSS() {
        if (_acnSummaryStyleInjected) return;
        if (document.getElementById('acn-summary-style')) { _acnSummaryStyleInjected = true; return; }
        var s = document.createElement('style');
        s.id = 'acn-summary-style';
        s.setAttribute('data-acn-role', 'summary-styles');
        s.textContent = [
            '.acn-gen-btn{width:100%;padding:10px;background:var(--acn-accent);color:#000;',
            'border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;}',
            '.acn-gen-btn:hover{filter:brightness(1.15)}',
            '.acn-gen-btn:disabled{opacity:0.6;cursor:not-allowed;filter:none}',
            '.acn-gen-wrap{margin-bottom:12px}',
            '.acn-sum-disclaimer{font-size:11px;color:#888;margin-top:6px;font-style:italic}',
            // D2 bracket map container — column of rows; each row = bracket + snapshot zone
            '.acn-map-container{display:flex;flex-direction:column;gap:0}',
            '.acn-map-row{display:flex;align-items:stretch}',
            '.acn-map-row+.acn-map-row{border-top:1px solid rgba(var(--acn-rgb),0.06)}',
            // D2 parent segments
            '.acn-seg-d2{flex:1;min-width:0;display:flex;align-items:stretch;cursor:pointer;position:relative}',
            '.acn-seg-d2:hover>.acn-seg-d2-inner{background:rgba(var(--acn-rgb),0.06)}',
            '.acn-seg-d2-bracket{width:10px;flex-shrink:0;position:relative;margin-right:4px}',
            '.acn-seg-d2-bracket::before{content:"";position:absolute;top:0;bottom:0;left:2px;width:2px;background:var(--acn-accent);opacity:0.5}',
            '.acn-seg-d2-bracket::after{content:"";position:absolute;top:0;left:2px;width:6px;height:2px;background:var(--acn-accent);opacity:0.5}',
            '.acn-seg-d2-cap{position:absolute;bottom:0;left:2px;width:6px;height:2px;background:var(--acn-accent);opacity:0.5}',
            '.acn-seg-d2-inner{flex:1;display:flex;flex-direction:column;justify-content:flex-start;padding:5px 6px;border-radius:4px;transition:background 0.15s;min-width:0}',
            '.acn-seg-d2-label{font-size:12px;font-weight:600;color:var(--acn-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.acn-seg-d2-meta{font-size:10px;color:#888;margin-top:1px;font-family:monospace}',
            '.acn-seg-d2-children{margin-top:6px;display:flex;flex-direction:column;gap:0}',
            // Sub-segments
            '.acn-seg-d2-sub{display:flex;align-items:stretch;margin-left:8px;cursor:pointer;border-radius:3px}',
            '.acn-seg-d2-sub:hover>.acn-seg-d2-sub-inner{background:rgba(var(--acn-rgb),0.08)}',
            '.acn-seg-d2-sub-bracket{width:7px;flex-shrink:0;position:relative;margin-right:4px}',
            '.acn-seg-d2-sub-bracket::before{content:"";position:absolute;top:0;bottom:0;left:1px;width:1.5px;background:var(--acn-accent);opacity:0.3}',
            '.acn-seg-d2-sub-bracket::after{content:"";position:absolute;top:0;left:1px;width:5px;height:1.5px;background:var(--acn-accent);opacity:0.3}',
            '.acn-seg-d2-sub-cap{position:absolute;bottom:0;left:1px;width:5px;height:1.5px;background:var(--acn-accent);opacity:0.3}',
            '.acn-seg-d2-sub-inner{flex:1;padding:3px 4px;border-radius:3px;transition:background 0.15s;min-width:0}',
            '.acn-seg-d2-sub-label{font-size:11px;font-weight:500;color:rgba(var(--acn-rgb),0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.acn-seg-d2-sub-meta{font-size:9px;color:#555;font-family:monospace;margin-top:1px}',
            // Snapshot zone — one per row; display:none when hidden so content cannot drive row height
            '.acn-snap-zone{flex-shrink:0;overflow:hidden;display:none;flex-direction:column;position:relative;opacity:0;transition:opacity 0.3s ease,margin 0.3s ease}',
            '.acn-snap-zone.acn-snap-visible{display:flex;opacity:1;margin-left:8px}',
            '.acn-snap-msg{padding:1px 3px;margin-bottom:0.5px;position:relative;flex-shrink:0}',
            '.acn-snap-user{background:rgba(var(--acn-rgb),0.12);border-left:2px solid var(--acn-accent);margin-right:15%;border-radius:1px}',
            '.acn-snap-ai{background:rgba(255,255,255,0.03);border-left:2px solid #444;margin-right:0;border-radius:1px}',
            '.acn-snap-lines{display:flex;flex-direction:column;gap:1px;padding:1px 0}',
            '.acn-snap-line{height:1.2px;border-radius:1px;opacity:0.45}',
            '.acn-snap-user .acn-snap-line{background:var(--acn-accent)}',
            '.acn-snap-ai .acn-snap-line{background:#777}',
            // Expanded mode: sub-segment container fills available space for flex-grow sizing
            '.acn-map-expanded .acn-seg-d2-children{flex:1}',
            // Hover highlight: subtle orange glow on corresponding snapshot messages
            '.acn-snap-msg.acn-snap-highlight{background:rgba(255,165,0,0.18)!important;outline:1px solid rgba(255,165,0,0.35)}',
            '.acn-topic-pills{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}',
            '.acn-topic-pill{padding:2px 8px;border-radius:12px;',
            'background:rgba(var(--acn-rgb),0.2);color:var(--acn-accent);font-size:11px}',
            '.acn-kp-item{font-size:12px;padding:3px 0;color:#ccc}',
            '.acn-kp-badge{display:inline-block;font-size:10px;font-weight:700;border-radius:3px;',
            'padding:1px 5px;margin-right:5px;vertical-align:middle}',
            '.acn-kp-decision{background:rgba(var(--acn-rgb),0.25);color:var(--acn-accent)}',
            '.acn-kp-action{background:rgba(0,180,120,0.25);color:#4caf90}',
            '.acn-kp-finding{background:rgba(160,120,220,0.25);color:#b08de8}',
            '.acn-stats-line{font-size:11px;color:#888;margin:4px 0}',
            '.acn-code-item{font-size:11px;color:#aaa;padding:2px 0;cursor:pointer}',
            '.acn-code-item:hover{color:#fff}',
            '.acn-section-title{font-size:11px;font-weight:700;text-transform:uppercase;',
            'letter-spacing:0.5px;color:#666;margin:10px 0 4px;cursor:pointer;',
            'display:flex;align-items:center;justify-content:space-between;user-select:none}',
            '.acn-section-title:hover{color:#999}',
            '.acn-section-arrow{font-size:10px;transition:transform 0.2s}',
            '.acn-section-body.acn-collapsed{display:none}',
            '.acn-sum-empty{font-size:12px;color:#666;padding:8px 0;font-style:italic}',
            '.acn-sum-results{padding:0 2px}'
        ].join('');
        (document.head || document.documentElement).appendChild(s);
        _acnSummaryStyleInjected = true;
    }

    var SUMMARY_STOP_WORDS = new Set([
        'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
        'up','about','into','through','during','before','after','above','below','between',
        'out','off','over','under','again','further','then','once','here','there','when',
        'where','why','how','all','both','each','few','more','most','other','some','such',
        'no','nor','not','only','own','same','so','than','too','very','can','will','just',
        'do','does','did','has','have','had','is','are','was','were','be','been','being',
        'it','its','i','you','he','she','we','they','them','their','what','which','who',
        'this','that','these','those','am','if','as','me','my','your','our','would',
        'could','should','may','might','shall','get','got','let','now','also','like',
        'use','used','using','make','made','way','see','look','go','going','new','one',
        'two','three','time','day','back','need','still','even','much','many','first',
        'last','want','know','think','come','take','give','find','work','well','yes',
        'no','ok','okay','yeah','sure','hi','hey','hello','thanks','thank','please'
    ]);

    var KEY_POINT_PATTERNS = [
        { re: /\b(decided?|choosing|chosen|going with|we('ll| will) use|settled on|picked)\b/i,    type: 'decision' },
        { re: /\b(the (answer|solution|fix|approach) is|it('s| is) (because|due to))\b/i,          type: 'decision' },
        { re: /\b(conclusion:|in conclusion|to summarize|in summary|the key (point|takeaway))\b/i, type: 'decision' },
        { re: /\bshould (use|avoid|not|be|always|never)\b/i,                                        type: 'decision' },
        { re: /\b(you('ll| will| should| need to)|next step|action item|todo|to.do|make sure|ensure)\b/i, type: 'action' },
        { re: /\b(don't forget|remember to|be sure to|need to|have to|must)\b/i,                         type: 'action' },
        { re: /\b(i('ll| will)|going to|i'm going to|plan to)\b/i,                                      type: 'action' },
        // Note: the generic try/run/install/build pattern was removed — too broad for technical conversations
        { re: /\b(found|discovered|noticed|realized|turns out|it turns out|appears that|seems like)\b/i, type: 'finding' },
        { re: /\b(the (bug|issue|problem|error|cause) (is|was)|root cause)\b/i,                         type: 'finding' },
        { re: /\b(important(ly)?|note that|keep in mind|worth noting|caveat|warning|caution)\b/i,       type: 'finding' },
        { re: /\b(this (means|is why|causes)|the reason (is|being|for))\b/i,                            type: 'finding' }
    ];

    // SEGMENT_ICON_MAP removed — prefix labels like BUG/CODE/MSG were not useful
    // and made segment labels noisy. _sumGenerateSegmentLabel() provides clean labels.

    // Pivot phrases that force a segment break regardless of word-overlap score.
    // Only tested on user messages.
    // Note: bare "pivot" is intentionally excluded — it fires on "pivot table",
    // "pivot point", etc. Only explicit transition phrasings are matched.
    var PIVOT_PHRASES = /\b(by the way|btw|actually let'?s pivot|let'?s pivot|pivot to|switch gears|switch topics|different topic|change of topic|on another note|unrelated question|off topic|something else entirely|new topic)\b/i;

    var FILE_EXTENSION_RE = /\b[\w\-]+\.(js|ts|jsx|tsx|css|html|py|rb|go|rs|java|c|cpp|h|json|yaml|yml|md|sh|bash|env|txt|csv|sql|graphql|vue|svelte)\b/gi;

    function _sumTokenize(text) {
        return text
            .toLowerCase()
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/`[^`]+`/g, ' ')
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(function (w) { return w.length > 2 && !SUMMARY_STOP_WORDS.has(w); });
    }

    function _sumExtractBigrams(words) {
        var bigrams = [];
        for (var i = 0; i < words.length - 1; i++) {
            if (!SUMMARY_STOP_WORDS.has(words[i]) && !SUMMARY_STOP_WORDS.has(words[i + 1])) {
                bigrams.push(words[i] + ' ' + words[i + 1]);
            }
        }
        return bigrams;
    }

    function _sumExtractTopicsFromText(text, maxTopics) {
        maxTopics = maxTopics || 8;
        var words   = _sumTokenize(text);
        var bigrams = _sumExtractBigrams(words);
        var freq    = {};

        words.forEach(function (w) {
            if (w.length < 3) return;
            freq[w] = (freq[w] || 0) + 1;
        });
        bigrams.forEach(function (b) {
            freq[b] = (freq[b] || 0) + 2;
        });

        var sorted = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; });
        var chosen = [];
        var coveredWords = {};

        for (var i = 0; i < sorted.length && chosen.length < maxTopics; i++) {
            var term = sorted[i];
            if (freq[term] < 1) continue;
            if (term.indexOf(' ') === -1 && coveredWords[term]) continue;
            chosen.push(term);
            if (term.indexOf(' ') !== -1) {
                term.split(' ').forEach(function (w) { coveredWords[w] = true; });
            }
        }
        return chosen;
    }

    function _sumExtractTopics(questions, aiResponses) {
        var freq = {};

        function addTerms(text, weight) {
            var words   = _sumTokenize(text);
            var bigrams = _sumExtractBigrams(words);
            var local   = {};

            words.forEach(function (w)   { if (w.length > 2) local[w]  = (local[w]  || 0) + 1; });
            bigrams.forEach(function (b) { local[b] = (local[b] || 0) + 2; });

            Object.keys(local).forEach(function (term) {
                freq[term] = (freq[term] || 0) + local[term] * weight;
            });
        }

        questions.forEach(function (q)   { addTerms(q.text || '', 1.5); });
        aiResponses.forEach(function (r) { addTerms(r.text || '', 1.0); });

        var sorted = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; });
        var result = [];
        var coveredWords = {};

        for (var i = 0; i < sorted.length && result.length < 8; i++) {
            var term = sorted[i];
            if (freq[term] < 1.5) continue;
            if (term.indexOf(' ') === -1 && coveredWords[term]) continue;
            result.push(term);
            if (term.indexOf(' ') !== -1) {
                term.split(' ').forEach(function (w) { coveredWords[w] = true; });
            }
        }
        return result;
    }

    function _sumWordOverlap(textA, textB) {
        var wordsA = new Set(_sumTokenize(textA));
        var wordsB = new Set(_sumTokenize(textB));
        if (wordsA.size === 0 || wordsB.size === 0) return 0;
        var intersection = 0;
        wordsA.forEach(function (w) { if (wordsB.has(w)) intersection++; });
        return intersection / Math.max(wordsA.size, wordsB.size);
    }

    function _sumTopicOverlap(topicsA, topicsB) {
        if (!topicsA.length || !topicsB.length) return 0;
        var setA = new Set(topicsA);
        var setB = new Set(topicsB);
        var intersection = 0;
        setA.forEach(function (t) { if (setB.has(t)) intersection++; });
        var union = setA.size + setB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }

    function _sumMergeTopics(topicsA, topicsB) {
        var seen = {};
        var merged = [];
        topicsA.concat(topicsB).forEach(function (t) {
            if (!seen[t]) { seen[t] = true; merged.push(t); }
        });
        return merged.slice(0, 6);
    }

    function _sumDeduplicatePoints(points) {
        var kept = [];
        points.forEach(function (pt) {
            var isDup = kept.some(function (k) {
                return _sumWordOverlap(k.text, pt.text) > 0.6;
            });
            if (!isDup) kept.push(pt);
        });
        return kept;
    }

    function _sumExtractKeyPoints(questions, aiResponses) {
        var points = [];

        function checkMessage(msg, source, position) {
            var text = msg.text || '';
            var sentences = text.split(/(?<=[.!?])\s+|(?<=\n)\s*/).filter(function (s) {
                return s.trim().length > 40;
            });
            sentences.forEach(function (sentence) {
                var trimmed = sentence.trim();
                for (var p = 0; p < KEY_POINT_PATTERNS.length; p++) {
                    if (KEY_POINT_PATTERNS[p].re.test(trimmed)) {
                        var display = trimmed.length > 140 ? trimmed.substring(0, 137) + '...' : trimmed;
                        points.push({ text: display, type: KEY_POINT_PATTERNS[p].type, source: source, position: position });
                        break;
                    }
                }
            });
        }

        questions.forEach(function (q, i)   { checkMessage(q, 'user', i); });
        aiResponses.forEach(function (r, i) { checkMessage(r, 'ai',   i); });

        // Scale cap with conversation length: short convos get fewer key points
        var cap = Math.max(1, Math.min(10, Math.floor((questions.length + aiResponses.length) / 4)));
        return _sumDeduplicatePoints(points).slice(0, cap);
    }

    function _sumGenerateStats(questions, aiResponses) {
        var userChars = questions.reduce(function (s, q)   { return s + (q.text || '').length; }, 0);
        var aiChars   = aiResponses.reduce(function (s, r) { return s + (r.text || '').length; }, 0);
        return {
            totalMessages: questions.length + aiResponses.length,
            userMessages:  questions.length,
            aiMessages:    aiResponses.length,
            userChars:     userChars,
            aiChars:       aiChars,
            avgUserLen:    questions.length   ? Math.round(userChars / questions.length)   : 0,
            avgAiLen:      aiResponses.length ? Math.round(aiChars  / aiResponses.length) : 0
        };
    }

    function _sumInventoryCodeAndFiles(aiResponses) {
        var codeBlocks = [];
        var files      = [];
        var seenFiles  = {};

        aiResponses.forEach(function (r, msgIndex) {
            var el = r.element;
            if (!el) {
                // Indexed, unmounted: derive from CONTENT. Fenced blocks give the
                // code inventory; files/attachments metadata gives the file list.
                var txt = r.text || '';
                var fenceRe = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, fm;
                while ((fm = fenceRe.exec(txt)) !== null) {
                    var body = (fm[2] || '').trim();
                    if (!body) continue;
                    // Same `label` shape the mounted branch builds — the renderer reads
                    // cb.label, and {language,text} rendered as `undefined` for exactly
                    // the off-screen content this path recovers (Codex R6 :6619).
                    var lbl = (fm[1] ? fm[1] + ' — ' : '') +
                              body.split('\n')[0].substring(0, 40);
                    codeBlocks.push({ label: lbl, element: null, msgIndex: msgIndex });
                }
                var metas = (r.files || []).concat(r.attachments || []);
                for (var mi = 0; mi < metas.length; mi++) {
                    var fn = metas[mi].file_name;
                    if (fn && !seenFiles[fn]) { seenFiles[fn] = true;
                        files.push({ label: fn, element: null, msgIndex: msgIndex }); }
                }
                return;
            }

            try {
                var pres = el.querySelectorAll('pre');
                pres.forEach(function (pre) {
                    var codeEl  = pre.querySelector('code') || pre;
                    var rawText = (codeEl.textContent || '').trim();
                    if (!rawText) return;

                    var lang = '';
                    var cls  = codeEl.className || pre.className || '';
                    var langMatch = cls.match(/language-(\w+)/);
                    if (langMatch) lang = langMatch[1];

                    if (!lang) {
                        if (/^\s*</.test(rawText))             lang = 'html';
                        else if (/^\s*\{/.test(rawText))       lang = 'json';
                        else if (/def |import |print\(/.test(rawText)) lang = 'python';
                        else if (/function |const |var |let /.test(rawText)) lang = 'javascript';
                    }

                    var preview = rawText.substring(0, 60).replace(/\n/g, ' ');
                    if (preview.length === 60) preview += '...';
                    var label = (lang ? lang.toUpperCase() + ': ' : '') + preview;
                    codeBlocks.push({ label: label, element: pre, msgIndex: msgIndex });
                });
            } catch (e) {}

            try {
                var links = el.querySelectorAll('a[href]');
                links.forEach(function (a) {
                    var href = a.getAttribute('href') || '';
                    var text = (a.textContent || '').trim();
                    var extMatch = (href + ' ' + text).match(FILE_EXTENSION_RE);
                    if (extMatch) {
                        extMatch.forEach(function (fname) {
                            if (!seenFiles[fname]) {
                                seenFiles[fname] = true;
                                files.push({ label: fname, element: a, msgIndex: msgIndex });
                            }
                        });
                    }
                });
            } catch (e) {}

            try {
                var textContent = (el.textContent || '');
                var textMatches = textContent.match(FILE_EXTENSION_RE);
                if (textMatches) {
                    textMatches.forEach(function (fname) {
                        if (!seenFiles[fname]) {
                            seenFiles[fname] = true;
                            files.push({ label: fname, element: null, msgIndex: msgIndex });
                        }
                    });
                }
            } catch (e) {}
        });

        return { codeBlocks: codeBlocks, files: files };
    }

    function _sumBuildTimeline(questions, aiResponses) {
        var all = [];
        var i;

        // Index-backed: the active path is already in conversation order and
        // covers the whole conversation, so no positional sort is needed.
        if (ciIsClaudeChat() && ciIsReady() && _ciFullPath && _ciFullPath.length) {
            for (i = 0; i < _ciFullPath.length; i++) {
                all.push({
                    element:  null,
                    text:     _ciFullPath[i].text || '',
                    type:     _ciFullPath[i].sender === 'human' ? 'user' : 'ai',
                    srcIndex: i
                });
            }
            all.forEach(function (m, idx) { m.globalIdx = idx; });
            return all;
        }

        questions.forEach(function (q, qi) {
            all.push({ element: q.element, text: q.text || '', type: 'user', srcIndex: qi });
        });
        aiResponses.forEach(function (r, ri) {
            all.push({ element: r.element, text: r.text || '', type: 'ai',   srcIndex: ri });
        });

        // compareDocumentPosition returns DOCUMENT_POSITION_DISCONNECTED for
        // detached nodes, matching neither FOLLOWING nor PRECEDING — the
        // comparator then returns 0 and the sort degrades to arbitrary order.
        // Drop unmounted entries from the ordering rather than letting them
        // scramble the sequence.
        var mounted   = [];
        var unmounted = [];
        for (i = 0; i < all.length; i++) {
            if (all[i].element && all[i].element.isConnected) mounted.push(all[i]);
            else unmounted.push(all[i]);
        }

        mounted.sort(function (a, b) {
            try {
                var pos = a.element.compareDocumentPosition(b.element);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            } catch (e) {}
            return 0;
        });

        all = mounted.concat(unmounted);
        all.forEach(function (m, idx) { m.globalIdx = idx; });
        return all;
    }

    function _sumScanEntities(messages) {
        var entities = [];
        messages.forEach(function (msg) {
            var el = msg.element;
            if (!el) return;
            var idx = msg.globalIdx;

            try {
                el.querySelectorAll('pre').forEach(function (pre) {
                    var codeEl = pre.querySelector('code') || pre;
                    var cls    = codeEl.className || '';
                    var langM  = cls.match(/language-(\w+)/);
                    var lang   = langM ? langM[1] : 'code';
                    entities.push({ type: 'code', icon: 'CODE', label: lang + ' code', element: pre, msgIndex: idx });
                });
            } catch (e) {}

            try {
                el.querySelectorAll('img[src]').forEach(function (img) {
                    var alt = img.getAttribute('alt') || 'image';
                    entities.push({ type: 'image', icon: 'IMG', label: alt, element: img, msgIndex: idx });
                });
            } catch (e) {}

            try {
                el.querySelectorAll('a[href]').forEach(function (a) {
                    var href = (a.getAttribute('href') || '');
                    var m    = href.match(FILE_EXTENSION_RE);
                    if (m) {
                        entities.push({ type: 'file', icon: 'FILE', label: m[0], element: a, msgIndex: idx });
                    }
                });
            } catch (e) {}
        });
        return entities;
    }

    function _sumGenerateSegmentLabel(segment) {
        var topics = segment.topics || [];
        if (!topics.length) return 'Discussion';
        function cap(str) {
            return str.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        }
        if (topics.length === 1) return cap(topics[0]);
        return cap(topics[0]) + ' / ' + cap(topics[1]);
    }

    function _sumMergeExcessSegments(segments) {
        while (segments.length > 5) {
            var maxOverlap = -1;
            var mergeIdx   = 0;
            for (var i = 0; i < segments.length - 1; i++) {
                var overlap = _sumTopicOverlap(segments[i].topics, segments[i + 1].topics);
                if (overlap > maxOverlap) {
                    maxOverlap = overlap;
                    mergeIdx   = i;
                }
            }
            var a = segments[mergeIdx];
            var b = segments[mergeIdx + 1];
            var mergedMsgs = a.messages.concat(b.messages);
            var merged = {
                startIdx:  a.startIdx,
                endIdx:    b.endIdx,
                messages:  mergedMsgs,
                topics:    _sumMergeTopics(a.topics, b.topics),
                entities:  a.entities.concat(b.entities),
                children:  _sumBuildSubSegments(mergedMsgs),
                label:     ''
            };
            merged.label = _sumGenerateSegmentLabel(merged);
            segments.splice(mergeIdx, 2, merged);
        }
        return segments;
    }

    function _sumIsPivotMessage(text) {
        return PIVOT_PHRASES.test(text);
    }

    // Secondary segmentation pass for large segments (8+ messages).
    // Detects genuine topic shifts within a long segment using a high overlap threshold.
    // Purely content-driven — no count-based caps. A post-merge pass absorbs tiny
    // fragments (< 3 messages) that form when a single off-topic exchange slips through.
    // Returns an array of sub-segments (children), or [] if no meaningful split found.
    function _sumBuildSubSegments(messages) {
        if (messages.length < 12) return [];
        var SUB_THRESHOLD = 0.42;  // split on meaningful vocabulary divergence within a segment
        var CONTEXT       = 4;
        var subs          = [];
        var cur           = [messages[0]];

        for (var i = 1; i < messages.length; i++) {
            var msg     = messages[i];
            var win     = cur.slice(-CONTEXT);
            var winText = win.map(function (m) { return m.text; }).join(' ');
            var overlap = _sumWordOverlap(msg.text, winText);
            if (overlap >= SUB_THRESHOLD) {
                cur.push(msg);
            } else {
                var segText = cur.map(function (m) { return m.text; }).join(' ');
                var topics  = _sumExtractTopicsFromText(segText, 3);
                subs.push({
                    label:    _sumGenerateSegmentLabel({ topics: topics }),
                    startIdx: cur[0].globalIdx,
                    endIdx:   cur[cur.length - 1].globalIdx,
                    messages: cur
                });
                cur = [msg];
            }
        }
        if (cur.length) {
            var lastText   = cur.map(function (m) { return m.text; }).join(' ');
            var lastTopics = _sumExtractTopicsFromText(lastText, 3);
            subs.push({
                label:    _sumGenerateSegmentLabel({ topics: lastTopics }),
                startIdx: cur[0].globalIdx,
                endIdx:   cur[cur.length - 1].globalIdx,
                messages: cur
            });
        }

        // Post-merge: absorb any fragment smaller than 3 messages into its neighbor.
        // Prefer merging with the next neighbor; fall back to prev.
        var changed = true;
        while (changed && subs.length > 1) {
            changed = false;
            for (var k = 0; k < subs.length; k++) {
                if (subs[k].messages.length < 3) {
                    var target = k < subs.length - 1 ? k + 1 : k - 1;
                    var lo = Math.min(k, target);
                    var hi = Math.max(k, target);
                    var combinedMsgs = subs[lo].messages.concat(subs[hi].messages);
                    var combinedStart = subs[lo].startIdx;
                    var combinedText = combinedMsgs.map(function (m) { return m.text; }).join(' ');
                    var combinedTopics = _sumExtractTopicsFromText(combinedText, 3);
                    subs.splice(lo, 2, {
                        label:    _sumGenerateSegmentLabel({ topics: combinedTopics }),
                        startIdx: combinedStart,
                        endIdx:   combinedMsgs[combinedMsgs.length - 1].globalIdx,
                        messages: combinedMsgs
                    });
                    changed = true;
                    break;
                }
            }
        }

        return subs.length > 1 ? subs : [];
    }

    function _sumBuildConversationMap(questions, aiResponses) {
        var timeline = _sumBuildTimeline(questions, aiResponses);
        if (!timeline.length) return [];

        // Short conversations: keep as a single segment
        if (timeline.length <= 6) {
            var combined = timeline.map(function (m) { return m.text; }).join(' ');
            var seg = {
                startIdx: 0,
                endIdx:   timeline.length - 1,
                messages: timeline,
                topics:   _sumExtractTopicsFromText(combined, 5),
                entities: _sumScanEntities(timeline),
                children: _sumBuildSubSegments(timeline),
                label:    ''
            };
            seg.label = _sumGenerateSegmentLabel(seg);
            return [seg];
        }

        // Content-aware segmentation: compare each message against the recent
        // context of the current segment using word overlap.
        // If overlap drops below the threshold — or if the user message contains
        // an explicit pivot phrase — start a new segment.
        var SPLIT_THRESHOLD = 0.15; // below this overlap → new segment
        var CONTEXT_WINDOW  = 4;    // compare new msg against last N msgs in segment

        var segments    = [];
        var currentMsgs = [timeline[0]];

        for (var i = 1; i < timeline.length; i++) {
            var msg        = timeline[i];
            var windowMsgs = currentMsgs.slice(-CONTEXT_WINDOW);
            var windowText = windowMsgs.map(function (m) { return m.text; }).join(' ');
            var overlap    = _sumWordOverlap(msg.text, windowText);
            var isPivot    = msg.type === 'user' && _sumIsPivotMessage(msg.text);

            if (!isPivot && overlap >= SPLIT_THRESHOLD) {
                currentMsgs.push(msg);
            } else {
                // Commit current segment
                var segText = currentMsgs.map(function (m) { return m.text; }).join(' ');
                var newSeg = {
                    startIdx: currentMsgs[0].globalIdx,
                    endIdx:   currentMsgs[currentMsgs.length - 1].globalIdx,
                    messages: currentMsgs,
                    topics:   _sumExtractTopicsFromText(segText, 5),
                    entities: _sumScanEntities(currentMsgs),
                    children: _sumBuildSubSegments(currentMsgs),
                    label:    ''
                };
                newSeg.label = _sumGenerateSegmentLabel(newSeg);
                segments.push(newSeg);
                currentMsgs = [msg];
            }
        }

        // Commit the final segment
        if (currentMsgs.length) {
            var lastText = currentMsgs.map(function (m) { return m.text; }).join(' ');
            var lastSeg = {
                startIdx: currentMsgs[0].globalIdx,
                endIdx:   currentMsgs[currentMsgs.length - 1].globalIdx,
                messages: currentMsgs,
                topics:   _sumExtractTopicsFromText(lastText, 5),
                entities: _sumScanEntities(currentMsgs),
                children: _sumBuildSubSegments(currentMsgs),
                label:    ''
            };
            lastSeg.label = _sumGenerateSegmentLabel(lastSeg);
            segments.push(lastSeg);
        }

        // Post-merge: absorb segments with fewer than MIN_SEGMENT_SIZE messages into
        // their most topically similar neighbor. Fixes the cold-start window bias —
        // after any topic split, currentMsgs resets to 1 message, making the window
        // unrepresentative. The next few messages often fragment incorrectly before the
        // window accumulates enough context. This pass reassembles those fragments.
        var MIN_SEGMENT_SIZE = 3;
        var mergeChanged = true;
        while (mergeChanged && segments.length > 1) {
            mergeChanged = false;
            for (var k = 0; k < segments.length; k++) {
                if (segments[k].messages.length < MIN_SEGMENT_SIZE) {
                    var prevOv = k > 0
                        ? _sumTopicOverlap(segments[k].topics, segments[k - 1].topics) : -1;
                    var nextOv = k < segments.length - 1
                        ? _sumTopicOverlap(segments[k].topics, segments[k + 1].topics) : -1;
                    var target = prevOv >= nextOv ? k - 1 : k + 1;
                    var lo = Math.min(k, target);
                    var hi = Math.max(k, target);
                    var ma = segments[lo];
                    var mb = segments[hi];
                    var mergedMsgs = ma.messages.concat(mb.messages);
                    var merged = {
                        startIdx: ma.startIdx,
                        endIdx:   mb.endIdx,
                        messages: mergedMsgs,
                        topics:   _sumMergeTopics(ma.topics, mb.topics),
                        entities: ma.entities.concat(mb.entities),
                        children: _sumBuildSubSegments(mergedMsgs),
                        label:    ''
                    };
                    merged.label = _sumGenerateSegmentLabel(merged);
                    segments.splice(lo, 2, merged);
                    mergeChanged = true;
                    break;
                }
            }
        }

        return _sumMergeExcessSegments(segments);
    }

    function generateFullSummary() {
        // Index-backed when available: only the timeline used the index, so topics,
        // key points, stats and inventory ran on the 3-5 MOUNTED assistant responses
        // while the map covered all 147 — internally inconsistent and truncated
        // (Codex :6474, P1). element stays null for unmounted entries; the hover
        // highlight degrades gracefully.
        var aiMsgs;
        if (ciIsClaudeChat() && ciIsReady() && _ciFullPath) {
            // Bind mounted elements by row identity so DOM-dependent analyzers keep
            // working for what IS on screen; carry text and attachments for the rest —
            // element:null alone made the inventory report no code or files at all
            // (Codex R5 :6974).
            var elByPath = {};
            var sRows = ciMountedRows();
            for (var sr = 0; sr < sRows.length; sr++) {
                if (sRows[sr].isUser) continue;
                var sp = ciResolvePathForRowStrict(sRows[sr].dataIndex);
                if (sp === null) sp = ciMatchRowToPath(sRows[sr]);
                if (sp !== null) elByPath[sp] = ciMessageNodeWithin(sRows[sr].el);
            }
            aiMsgs = [];
            for (var fp = 0; fp < _ciFullPath.length; fp++) {
                if (_ciFullPath[fp].sender !== 'assistant') continue;
                aiMsgs.push({ element: elByPath[fp] || null,
                              text: _ciFullPath[fp].text || '',
                              attachments: _ciFullPath[fp].attachments || [],
                              files: _ciFullPath[fp].files || [],
                              type: 'ai' });
            }
        } else {
            aiMsgs = Array.from(getAIMessages()).map(function (el) {
                return { element: el, text: _readAIText(el), type: 'ai' };
            });
        }

        return {
            map:       _sumBuildConversationMap(_questions, aiMsgs),
            topics:    _sumExtractTopics(_questions, aiMsgs),
            keyPoints: _sumExtractKeyPoints(_questions, aiMsgs),
            stats:     _sumGenerateStats(_questions, aiMsgs),
            inventory: _sumInventoryCodeAndFiles(aiMsgs)
        };
    }

    // Normalize a message's text length to an approximate line count (capped at 15).
    // Used for proportional sizing throughout the conversation map.
    function _sumMsgLines(text) {
        return Math.min(15, Math.max(1, Math.ceil((text || '').length / 80)));
    }

    // Attach mouseenter/mouseleave listeners to el that add/remove 'acn-snap-highlight'
    // on each element in msgEls, linking a bracket item to its snapshot messages.
    function _sumAttachHighlight(el, msgEls) {
        el.addEventListener('mouseenter', function () {
            for (var i = 0; i < msgEls.length; i++) {
                msgEls[i].classList.add('acn-snap-highlight');
            }
        });
        el.addEventListener('mouseleave', function () {
            for (var i = 0; i < msgEls.length; i++) {
                msgEls[i].classList.remove('acn-snap-highlight');
            }
        });
    }

    function _sumMakeCollapsibleSection(titleText, bodyEl) {
        var arrow   = createElement('span', { className: 'acn-section-arrow', textContent: '\u25BE' });
        var titleEl = createElement('div', { className: 'acn-section-title' }, [titleText, arrow]);
        bodyEl.classList.add('acn-section-body');

        var collapsed = false;
        titleEl.addEventListener('click', function () {
            collapsed = !collapsed;
            if (collapsed) {
                bodyEl.classList.add('acn-collapsed');
                arrow.style.transform = 'rotate(-90deg)';
            } else {
                bodyEl.classList.remove('acn-collapsed');
                arrow.style.transform = '';
            }
        });

        var wrapper = document.createElement('div');
        wrapper.appendChild(titleEl);
        wrapper.appendChild(bodyEl);
        return wrapper;
    }

    function _sumScrollToElement(el) {
        if (!el) return;
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            var prev = el.style.outline;
            el.style.outline = '2px solid var(--acn-accent, #d97706)';
            el.style.outlineOffset = '3px';
            setTimeout(function () {
                el.style.outline = prev;
                el.style.outlineOffset = '';
            }, 1400);
        } catch (e) {}
    }

    function _sumRenderConversationMap(mapData) {
        var body = document.createElement('div');
        if (!mapData.length) {
            body.appendChild(createElement('div', { className: 'acn-sum-empty', textContent: 'Not enough messages to segment.' }));
            return _sumMakeCollapsibleSection(i18n('conversationMap') || 'Conversation Map', body);
        }

        // Compute total text lines across all segments for proportional flex-grow sizing
        var totalLines = 0;
        mapData.forEach(function (seg) {
            seg._lineCount = 0;
            seg.messages.forEach(function (m) {
                seg._lineCount += _sumMsgLines(m.text);
            });
            totalLines += seg._lineCount;
        });
        if (totalLines === 0) totalLines = 1;

        // Flex container: brackets column (left) + snapshot column (right)
        // Scale map height with conversation length — short chats stay compact
        var mapBaseline = Math.max(150, Math.min(500, totalLines * 2.2));

        var container = document.createElement('div');
        container.className = 'acn-map-container';

        // Each segment is a row containing its bracket segment (left) and snapshot zone (right).
        // Row height is governed by whichever side is taller — no independent-column drift.
        // In expanded mode (.acn-map-expanded), sub-segments and snapshot messages use flex-grow
        // weighted by line count so both sides fill proportionally.
        mapData.forEach(function (seg) {
            var rowMinH = Math.max(36, Math.floor((seg._lineCount / totalLines) * mapBaseline));

            var row = document.createElement('div');
            row.className = 'acn-map-row';
            row.style.minHeight = rowMinH + 'px';

            // ── Bracket + label (left side) ──────────────────────────────────────
            var msgStart = seg.startIdx + 1;
            var msgEnd   = seg.endIdx + 1;
            var msgCount = seg.messages.length;
            var metaText = 'msgs ' + msgStart + '\u2013' + msgEnd + ' \u00B7 ' + msgCount + ' msgs';

            var cap = document.createElement('div');
            cap.className = 'acn-seg-d2-cap';

            var bracket = document.createElement('div');
            bracket.className = 'acn-seg-d2-bracket';
            bracket.appendChild(cap);

            var labelEl = document.createElement('div');
            labelEl.className = 'acn-seg-d2-label';
            labelEl.textContent = seg.label;

            var metaEl = document.createElement('div');
            metaEl.className = 'acn-seg-d2-meta';
            metaEl.textContent = metaText;

            var inner = document.createElement('div');
            inner.className = 'acn-seg-d2-inner';
            inner.appendChild(labelEl);
            inner.appendChild(metaEl);

            // ── Snapshot zone (right side) ────────────────────────────────────────
            // Built before sub-segments so cross-references can be stored for hover.
            var zone = document.createElement('div');
            zone.className = 'acn-snap-zone';
            var snapMsgEls = [];

            seg.messages.forEach(function (msg) {
                var msgLines = _sumMsgLines(msg.text);
                var isUser   = msg.type === 'user';

                var linesWrap = document.createElement('div');
                linesWrap.className = 'acn-snap-lines';

                for (var li = 0; li < msgLines; li++) {
                    var line = document.createElement('div');
                    line.className = 'acn-snap-line';
                    var w = isUser ? (55 + Math.floor(Math.random() * 40)) : (35 + Math.floor(Math.random() * 60));
                    if (li === msgLines - 1) {
                        w = Math.floor(w * (0.25 + Math.random() * 0.4));
                    }
                    line.style.width = w + '%';
                    linesWrap.appendChild(line);
                }

                var msgEl = document.createElement('div');
                msgEl.className = 'acn-snap-msg ' + (isUser ? 'acn-snap-user' : 'acn-snap-ai');
                // Proportional sizing in expanded mode: flex-grow by message text length
                msgEl.style.flexGrow = String(msgLines);
                msgEl.appendChild(linesWrap);
                zone.appendChild(msgEl);
                snapMsgEls.push(msgEl);
            });

            // ── Sub-segments ──────────────────────────────────────────────────────
            // Each sub-segment gets flex-grow proportional to its line count so it
            // fills vertical space matching its corresponding snapshot messages.
            // Cross-references enable hover highlighting without DOM queries.
            var hasChildren = seg.children && seg.children.length > 0;
            if (hasChildren) {
                var childrenWrap = document.createElement('div');
                childrenWrap.className = 'acn-seg-d2-children';

                for (var ci = 0; ci < seg.children.length; ci++) {
                    var child = seg.children[ci];

                    // Collect the snapshot message elements that belong to this child
                    // and compute the child's total line count for flex-grow sizing.
                    var childSnapMsgs = [];
                    var childLineCount = 0;
                    for (var mi = 0; mi < seg.messages.length; mi++) {
                        var segMsg = seg.messages[mi];
                        if (segMsg.globalIdx >= child.startIdx && segMsg.globalIdx <= child.endIdx) {
                            childLineCount += _sumMsgLines(segMsg.text);
                            childSnapMsgs.push(snapMsgEls[mi]);
                        }
                    }

                    var subCap = document.createElement('div');
                    subCap.className = 'acn-seg-d2-sub-cap';

                    var subBracket = document.createElement('div');
                    subBracket.className = 'acn-seg-d2-sub-bracket';
                    subBracket.appendChild(subCap);

                    var subLabelEl = document.createElement('div');
                    subLabelEl.className = 'acn-seg-d2-sub-label';
                    subLabelEl.textContent = child.label;

                    var subMetaEl = document.createElement('div');
                    subMetaEl.className = 'acn-seg-d2-sub-meta';
                    subMetaEl.textContent = 'msgs ' + (child.startIdx + 1) + '\u2013' + (child.endIdx + 1);

                    var subInner = document.createElement('div');
                    subInner.className = 'acn-seg-d2-sub-inner';
                    subInner.appendChild(subLabelEl);
                    subInner.appendChild(subMetaEl);

                    var subEl = document.createElement('div');
                    subEl.className = 'acn-seg-d2-sub';
                    // Proportional sizing in expanded mode
                    subEl.style.flexGrow = String(childLineCount || 1);
                    subEl.appendChild(subBracket);
                    subEl.appendChild(subInner);

                    (function (c) {
                        subEl.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var firstMsg = c.messages && c.messages[0];
                            if (firstMsg) _sumScrollToElement(firstMsg.element);
                        });
                    })(child);
                    // Highlight corresponding snapshot messages on hover
                    _sumAttachHighlight(subEl, childSnapMsgs);

                    childrenWrap.appendChild(subEl);
                }
                inner.appendChild(childrenWrap);
            }

            var segEl = document.createElement('div');
            segEl.className = 'acn-seg-d2';
            segEl.appendChild(bracket);
            segEl.appendChild(inner);

            (function (s) {
                segEl.addEventListener('click', function () {
                    var firstMsg = s.messages && s.messages[0];
                    if (firstMsg) _sumScrollToElement(firstMsg.element);
                });
            })(seg);
            // For segments without sub-segments, hovering the block highlights all its messages
            if (!hasChildren) {
                _sumAttachHighlight(segEl, snapMsgEls);
            }

            row.appendChild(segEl);
            row.appendChild(zone);
            container.appendChild(row);
        });

        body.appendChild(container);

        // Wire up snapshot visibility: show at panel width >= 420px, scale with width
        setTimeout(function () {
            var panel = document.getElementById('acn-panel-summary');
            if (!panel) return;

            function updateSnapshot() {
                var panelW = panel.offsetWidth;
                var zones  = container.querySelectorAll('.acn-snap-zone');
                var i, ri;
                if (panelW >= 420) {
                    var sw = Math.max(70, Math.min(160, Math.round((panelW - 420) * 0.45 + 70)));
                    for (i = 0; i < zones.length; i++) {
                        zones[i].style.width = sw + 'px';
                        zones[i].classList.add('acn-snap-visible');
                    }
                    // Expanded mode: enable flex-grow proportional sizing on both sides.
                    // Sub-segments fill the bracket column proportionally (via flex-grow set
                    // inline at render time). Snap-msgs fill the zone column proportionally.
                    // Offset the snapshot top to align with the sub-segment area (below the
                    // parent label+meta), measured from live layout for accuracy.
                    container.classList.add('acn-map-expanded');
                    var rows = container.querySelectorAll('.acn-map-row');
                    for (ri = 0; ri < rows.length; ri++) {
                        var zoneEl = rows[ri].querySelector('.acn-snap-zone');
                        if (!zoneEl) continue;
                        var wrap = rows[ri].querySelector('.acn-seg-d2-children');
                        if (wrap) {
                            // Align snapshot top with the sub-segment area by measuring the
                            // childrenWrap position relative to the row after layout.
                            var rowTop  = rows[ri].getBoundingClientRect().top;
                            var wrapTop = wrap.getBoundingClientRect().top;
                            zoneEl.style.paddingTop = Math.max(0, Math.round(wrapTop - rowTop)) + 'px';
                        } else {
                            zoneEl.style.paddingTop = '';
                        }
                    }
                } else {
                    for (i = 0; i < zones.length; i++) {
                        zones[i].classList.remove('acn-snap-visible');
                        zones[i].style.width = '';
                        zones[i].style.paddingTop = '';
                    }
                    container.classList.remove('acn-map-expanded');
                }
            }

            updateSnapshot();

            if (window.ResizeObserver) {
                var ro = new ResizeObserver(updateSnapshot);
                ro.observe(panel);
                var checkRemoved = setInterval(function () {
                    if (!document.contains(container)) {
                        ro.disconnect();
                        clearInterval(checkRemoved);
                    }
                }, 500);
            }
        }, 0);

        return _sumMakeCollapsibleSection(i18n('conversationMap') || 'Conversation Map', body);
    }

    function _sumRenderTopics(topics) {
        var body = document.createElement('div');
        if (!topics.length) {
            body.appendChild(createElement('div', { className: 'acn-sum-empty', textContent: 'No topics detected.' }));
            return _sumMakeCollapsibleSection(i18n('topics') || 'Topics', body);
        }
        var pills = createElement('div', { className: 'acn-topic-pills' });
        topics.forEach(function (t) {
            pills.appendChild(createElement('span', { className: 'acn-topic-pill', textContent: t }));
        });
        body.appendChild(pills);
        return _sumMakeCollapsibleSection(i18n('topics') || 'Topics', body);
    }

    function _sumRenderKeyPoints(keyPoints) {
        var body = document.createElement('div');
        if (!keyPoints.length) {
            body.appendChild(createElement('div', { className: 'acn-sum-empty', textContent: 'No key points detected.' }));
            return _sumMakeCollapsibleSection(i18n('keyPoints') || 'Key Points', body);
        }

        keyPoints.forEach(function (pt) {
            var badgeClass = 'acn-kp-badge acn-kp-' + pt.type;
            var badge = createElement('span', { className: badgeClass, textContent: pt.type.toUpperCase() });
            var item  = createElement('div',  { className: 'acn-kp-item' });
            item.appendChild(badge);
            item.appendChild(document.createTextNode(pt.text));
            body.appendChild(item);
        });

        return _sumMakeCollapsibleSection(i18n('keyPoints') || 'Key Points', body);
    }

    function _sumRenderStats(stats) {
        var body = document.createElement('div');
        var lines = [
            'Total turns: ' + stats.totalMessages + ' (' + stats.userMessages + ' user, ' + stats.aiMessages + ' AI)',
            'User: ' + stats.userChars.toLocaleString() + ' chars (avg ' + stats.avgUserLen + '/msg)',
            'AI: '   + stats.aiChars.toLocaleString()   + ' chars (avg ' + stats.avgAiLen  + '/msg)'
        ];
        lines.forEach(function (line) {
            body.appendChild(createElement('div', { className: 'acn-stats-line', textContent: line }));
        });
        return _sumMakeCollapsibleSection(i18n('stats') || 'Stats', body);
    }

    function _sumRenderInventory(inventory) {
        var body = document.createElement('div');
        var hasContent = false;

        if (inventory.codeBlocks.length) {
            hasContent = true;
            body.appendChild(createElement('div', { className: 'acn-section-title', style: 'cursor:default', textContent: 'Code Blocks (' + inventory.codeBlocks.length + ')' }));
            inventory.codeBlocks.slice(0, 10).forEach(function (cb) {
                var item = createElement('div', { className: 'acn-code-item', textContent: cb.label });
                item.addEventListener('click', function () { _sumScrollToElement(cb.element); });
                body.appendChild(item);
            });
        }

        if (inventory.files.length) {
            hasContent = true;
            body.appendChild(createElement('div', { className: 'acn-section-title', style: 'cursor:default', textContent: 'Files (' + inventory.files.length + ')' }));
            inventory.files.slice(0, 10).forEach(function (f) {
                var item = createElement('div', { className: 'acn-code-item', textContent: f.label });
                if (f.element) {
                    item.addEventListener('click', function () { _sumScrollToElement(f.element); });
                }
                body.appendChild(item);
            });
        }

        if (!hasContent) {
            body.appendChild(createElement('div', { className: 'acn-sum-empty', textContent: 'No code blocks or files found.' }));
        }

        return _sumMakeCollapsibleSection('Code & Files', body);
    }

    function renderSummaryResults(container, summaryData) {
        while (container.firstChild) container.removeChild(container.firstChild);

        if (!summaryData) {
            container.appendChild(createElement('div', { className: 'acn-sum-empty', textContent: 'No data to display.' }));
            return;
        }

        var stats = summaryData.stats;
        if (!stats || stats.totalMessages === 0) {
            container.appendChild(createElement('div', { className: 'acn-sum-empty', textContent: 'No messages detected yet. Start a conversation first.' }));
            return;
        }

        container.appendChild(_sumRenderStats(summaryData.stats));
        container.appendChild(_sumRenderTopics(summaryData.topics));
        container.appendChild(_sumRenderConversationMap(summaryData.map));
        container.appendChild(_sumRenderKeyPoints(summaryData.keyPoints));
        container.appendChild(_sumRenderInventory(summaryData.inventory));
    }

    function orbBuildPanelSummary() {
        _acnInjectSummaryCSS();

        var panel = createElement('div', { id: 'acn-panel-summary', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\u03A3 ' + (i18n('summary') || 'Summary')));

        var scroll = createElement('div', { style: 'flex:1;overflow-y:auto;padding:4px 10px 10px' });

        var genBtn = createElement('button', {
            className:   'acn-gen-btn',
            textContent: i18n('generateSummary') || 'Generate Summary'
        });

        var disclaimer = createElement('div', {
            className:   'acn-sum-disclaimer',
            textContent: i18n('summaryDisclaimer') ||
                "Pattern matching, not AI. For a real summary, just ask \u2014 you're literally inside one!"
        });

        var genWrap = createElement('div', { className: 'acn-gen-wrap' }, [genBtn, disclaimer]);
        scroll.appendChild(genWrap);

        var resultsContainer = createElement('div', { className: 'acn-sum-results' });
        scroll.appendChild(resultsContainer);

        genBtn.addEventListener('click', function () {
            genBtn.disabled     = true;
            genBtn.textContent  = i18n('analyzing') || 'Analyzing...';

            setTimeout(function () {
                var data;
                try {
                    data = generateFullSummary();
                } catch (e) {
                    console.error('ACN Summary: generateFullSummary() threw:', e);
                    data = null;
                }

                renderSummaryResults(resultsContainer, data);

                genBtn.disabled          = false;
                genBtn.dataset.generated = 'true';
                genBtn.textContent       = i18n('regenerateSummary') || 'Regenerate Summary';
            }, 40);
        });

        panel.appendChild(scroll);
        return panel;
    }

    // ============================================================
    // E2: Tools Panel — Image Gallery + Exports + /Commands
    // ============================================================

    function getSummaryForExport() {
        if (typeof generateFullSummary === 'function') return generateFullSummary();
        return null;
    }

    function isContentImage(img) {
        var w = img.naturalWidth  || img.width  || parseInt(img.getAttribute('width'))  || 0;
        var h = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || 0;
        if ((w > 0 && w < 50) || (h > 0 && h < 50)) return false;
        if (img.getAttribute('aria-hidden') === 'true') return false;
        if (img.getAttribute('role') === 'presentation') return false;
        var src = (img.src || '').toLowerCase();
        if (src.indexOf('data:image/svg') === 0) return false;
        if (src.indexOf('avatar')   !== -1) return false;
        if (src.indexOf('favicon')  !== -1) return false;
        if (src.indexOf('emoji')    !== -1) return false;
        if (src.indexOf('logo')     !== -1) return false;
        var parent = img.parentElement;
        var msgAncestor = img.closest('[class*="message"]') || document.body;
        while (parent && parent !== msgAncestor) {
            var cls = (parent.className || '').toLowerCase();
            if (cls.indexOf('avatar')  !== -1 ||
                cls.indexOf('icon')    !== -1 ||
                cls.indexOf('toolbar') !== -1) {
                return false;
            }
            parent = parent.parentElement;
        }
        if (w >= 50 && h >= 50) return true;
        if (w === 0 && h === 0) return true;
        return true;
    }

    function hasContentImage(questionEl) {
        if (!questionEl) return false;
        // Check inside the element itself
        var imgs = questionEl.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
            if (isContentImage(imgs[i])) return true;
        }
        // Also check broader ancestor context (claude.ai keeps thumbnails in a
        // sibling div above the user-message, both under a common .group element)
        if (platform && typeof platform.getMessageContext === 'function') {
            var ctx = platform.getMessageContext(questionEl);
            if (ctx && ctx !== questionEl) {
                var ctxImgs = ctx.querySelectorAll('img');
                for (var j = 0; j < ctxImgs.length; j++) {
                    if (isContentImage(ctxImgs[j])) return true;
                }
            }
        }
        return false;
    }

    function getConversationImages() {
        var allImages = [];
        if (typeof platform === 'undefined' || !platform) return allImages;

        // imageSelector: null  → platform explicitly unsupported (e.g. Perplexity)
        // imageSelector: string → use as querySelectorAll argument within each message context
        // imageSelector: undefined → fall through to generic isContentImage filter
        // imageSelectorScope: 'document' → query entire document instead of per-message context
        //   (needed when images live outside getUserMessages() elements, e.g. Gemini/Grok)
        if (platform.imageSelector === null) return allImages;

        var imgSel   = platform.imageSelector;   // string or undefined
        var userMsgs = platform.getUserMessages ? Array.from(platform.getUserMessages()) : [];
        var aiMsgs   = platform.getAIMessages   ? Array.from(platform.getAIMessages())   : [];
        var seenImgs = [];  // dedup tracker

        // Document-wide path: used when uploaded images live outside message elements.
        // Queries the full document, then associates each image to its nearest message by
        // checking direct containment or one level up (handles sibling containers like Gemini).
        if (imgSel && platform.imageSelectorScope === 'document') {
            var docImgs = document.querySelectorAll(imgSel);
            for (var di = 0; di < docImgs.length; di++) {
                var dImg = docImgs[di];
                if (seenImgs.indexOf(dImg) !== -1) continue;
                seenImgs.push(dImg);
                var scrollTarget = dImg;  // fallback: scroll to image itself
                var dMsgIdx = -1;  // -1 = no message association found (e.g. Claude files panel)
                var dIsUser = true;
                var dFound  = false;

                for (var du = 0; du < userMsgs.length; du++) {
                    var duCtx = (platform.getMessageContext ? platform.getMessageContext(userMsgs[du]) : null) || userMsgs[du];
                    if (duCtx.contains(dImg) || (duCtx.parentElement && duCtx.parentElement.contains(dImg))) {
                        scrollTarget = userMsgs[du];
                        dMsgIdx = du;
                        dIsUser = true;
                        dFound  = true;
                        break;
                    }
                }
                if (!dFound) {
                    for (var da = 0; da < aiMsgs.length; da++) {
                        if (aiMsgs[da].contains(dImg) || (aiMsgs[da].parentElement && aiMsgs[da].parentElement.contains(dImg))) {
                            scrollTarget = aiMsgs[da];
                            dMsgIdx = userMsgs.length + da;
                            dIsUser = false;
                            break;
                        }
                    }
                }
                allImages.push({
                    element:    dImg,
                    src:        dImg.src,
                    alt:        dImg.alt || '',
                    msgElement: scrollTarget,
                    msgIndex:   dMsgIdx,
                    isUserMsg:  dIsUser,
                    width:      dImg.naturalWidth  || dImg.width  || 0,
                    height:     dImg.naturalHeight || dImg.height || 0
                });
            }
            return allImages;
        }

        // Per-message path: iterate over message elements, searching within each context.
        // Used by Claude (broad filter selector) and ChatGPT (specific src selector).

        // User messages — use broader context if platform provides one
        // (claude.ai keeps uploaded image thumbnails in a sibling div, not inside user-message)
        userMsgs.forEach(function (msgEl, idx) {
            var contextEl = (platform.getMessageContext ? platform.getMessageContext(msgEl) : null) || msgEl;
            var imgs = imgSel ? contextEl.querySelectorAll(imgSel) : contextEl.querySelectorAll('img');
            imgs.forEach(function (img) {
                if (seenImgs.indexOf(img) !== -1) return;
                if (!imgSel && !isContentImage(img)) return;  // generic filter only when no platform selector
                seenImgs.push(img);
                allImages.push({
                    element:    img,
                    src:        img.src,
                    alt:        img.alt || '',
                    msgElement: msgEl,
                    msgIndex:   idx,
                    isUserMsg:  true,
                    width:      img.naturalWidth  || img.width  || 0,
                    height:     img.naturalHeight || img.height || 0
                });
            });
        });

        // AI messages — search inside the message element directly
        aiMsgs.forEach(function (msgEl, idx) {
            var imgs = imgSel ? msgEl.querySelectorAll(imgSel) : msgEl.querySelectorAll('img');
            imgs.forEach(function (img) {
                if (seenImgs.indexOf(img) !== -1) return;
                if (!imgSel && !isContentImage(img)) return;
                seenImgs.push(img);
                allImages.push({
                    element:    img,
                    src:        img.src,
                    alt:        img.alt || '',
                    msgElement: msgEl,
                    msgIndex:   userMsgs.length + idx,
                    isUserMsg:  false,
                    width:      img.naturalWidth  || img.width  || 0,
                    height:     img.naturalHeight || img.height || 0
                });
            });
        });

        return allImages;
    }

    function getExtFromMime(mimeType) {
        var map = {
            'image/png':  '.png',
            'image/jpeg': '.jpg',
            'image/gif':  '.gif',
            'image/webp': '.webp',
            'image/avif': '.avif',
            'image/bmp':  '.bmp',
        };
        return map[mimeType] || '.png';
    }

    function downloadImage(src, filename) {
        fetch(src, { mode: 'cors', credentials: 'include' })
            .then(function (response) {
                if (!response.ok) throw new Error('Fetch failed: ' + response.status);
                return response.blob();
            })
            .then(function (blob) {
                var blobUrl = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href     = blobUrl;
                link.download = filename + getExtFromMime(blob.type);
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(function () {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(blobUrl);
                }, 100);
                if (typeof showToast === 'function') showToast('Image downloaded');
            })
            .catch(function () {
                window.open(src, '_blank');
                if (typeof showToast === 'function') showToast('Opened in new tab — right-click to save');
            });
    }

    function renderImageGallery(container) {
        while (container.firstChild) container.removeChild(container.firstChild);
        var images = getConversationImages();
        var header = document.createElement('div');
        header.className = 'acn-tool-section-header';
        header.textContent = '\uD83D\uDDBC\uFE0F Image Gallery (' + images.length + ')';
        container.appendChild(header);
        if (images.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'acn-gallery-empty';
            empty.textContent = 'No images in this conversation';
            container.appendChild(empty);
            return;
        }
        var grid = document.createElement('div');
        grid.className = 'acn-gallery-grid';
        images.forEach(function (imgData, i) {
            var card = document.createElement('div');
            card.className = 'acn-gallery-card';
            var thumb = document.createElement('img');
            thumb.className = 'acn-gallery-thumb';
            thumb.src       = imgData.src;
            thumb.alt       = imgData.alt || ('Image ' + (i + 1));
            thumb.setAttribute('loading', 'lazy');
            var label = document.createElement('div');
            label.className   = 'acn-gallery-label';
            label.textContent = (imgData.msgIndex === -1 && platform.imagesOrphaned)
                ? 'Upload'
                : imgData.msgIndex === -1
                    ? (imgData.isUserMsg ? 'Q#?' : 'A#?')
                    : imgData.isUserMsg
                        ? 'Q#' + (imgData.msgIndex + 1)
                        : 'A#' + (imgData.msgIndex + 1);
            thumb.addEventListener('error', (function (lbl) {
                return function () {
                    thumb.style.display = 'none';
                    var fallback = document.createElement('div');
                    fallback.className   = 'acn-gallery-thumb-fallback';
                    fallback.textContent = '\uD83D\uDDBC\uFE0F \u2715';
                    card.insertBefore(fallback, lbl);
                };
            })(label));
            var actions = document.createElement('div');
            actions.className = 'acn-gallery-actions';
            var navBtn = document.createElement('span');
            navBtn.className   = 'acn-gallery-btn';
            navBtn.textContent = '\u2197';
            navBtn.title       = 'Go to message';
            if (imgData.msgIndex === -1 && platform.imagesOrphaned) {
                // Images are in a hidden container (e.g. Claude files panel) — no usable scroll target
                navBtn.style.opacity = '0.3';
                navBtn.style.cursor  = 'default';
                navBtn.title         = 'No message link available';
                navBtn.addEventListener('click', function (e) { e.stopPropagation(); });
            } else {
                // msgElement is either a message element or the image itself (visible fallback)
                navBtn.addEventListener('click', (function (data) {
                    return function (e) {
                        e.stopPropagation();
                        data.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        data.msgElement.classList.add('acn-highlight-flash');
                        setTimeout(function () { data.msgElement.classList.remove('acn-highlight-flash'); }, 1500);
                    };
                })(imgData));
            }
            var dlBtn = document.createElement('span');
            dlBtn.className   = 'acn-gallery-btn';
            dlBtn.textContent = '\u2B07';
            dlBtn.title       = 'Download image';
            dlBtn.addEventListener('click', (function (data, idx) {
                return function (e) {
                    e.stopPropagation();
                    downloadImage(data.src, 'image-' + (idx + 1));
                };
            })(imgData, i));
            actions.appendChild(navBtn);
            actions.appendChild(dlBtn);
            if (!(imgData.msgIndex === -1 && platform.imagesOrphaned)) {
                thumb.addEventListener('click', (function (data) {
                    return function () {
                        data.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        data.msgElement.classList.add('acn-highlight-flash');
                        setTimeout(function () { data.msgElement.classList.remove('acn-highlight-flash'); }, 1500);
                    };
                })(imgData));
            }
            card.appendChild(thumb);
            card.appendChild(label);
            card.appendChild(actions);
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    function buildTimeline(questions, aiMsgs) {
        var items = [];
        // Keep unmounted entries. Emergent accumulates questions across its own
        // virtual scroll, so by the time the user exports, most stored elements
        // are detached — filtering them out silently dropped them from the file
        // while the header still counted them ("Messages: 3 (40 user, 0 AI)").
        questions.forEach(function (q, i) {
            if (q.element) items.push({ type: 'user', element: q.element, src: i });
        });
        aiMsgs.forEach(function (el, j) {
            if (el) items.push({ type: 'ai', element: el, src: j });
        });
        // Pick ONE ordering key for the whole set. Mixing document position with a
        // source-order fallback inside a single comparator is intransitive —
        // detached-vs-mounted pairs answer by src while mounted pairs answer by DOM
        // position, which admits cycles (a<b, b<c, c<a) and makes Array.sort emit
        // arbitrary output.
        var allMounted = true;
        for (var k = 0; k < items.length; k++) {
            if (!items[k].element.isConnected) { allMounted = false; break; }
        }

        if (allMounted) {
            items.sort(function (a, b) {
                if (a.element === b.element) return 0;
                var pos = a.element.compareDocumentPosition(b.element);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING)  return 1;
                return 0;
            });
            return items;
        }

        // Anything detached: order by (source index, question-before-answer). That
        // is a genuine total order, and on accumulating virtual-scroll platforms
        // _questions is already sorted by vsIndex, so it is chronological.
        items.sort(function (a, b) {
            if (a.src !== b.src) return a.src - b.src;
            if (a.type === b.type) return 0;
            return a.type === 'user' ? -1 : 1;
        });
        return items;
    }

    function extractMarkdownContent(el) {
        var result = [];
        function isUIChrome(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            // node.className is SVGAnimatedString on SVG elements — use baseVal fallback
            var rawCls = node.className;
            var cls = (typeof rawCls === 'string' ? rawCls : (rawCls && rawCls.baseVal) || '').toLowerCase();
            var role = (node.getAttribute && node.getAttribute('aria-hidden')) || '';
            if (role === 'true') return true;
            // 'sr-only' added v12.0: screen-reader labels ("You said:",
            // "Claude responded:", "Load earlier messages") were being written into
            // exported markdown. Phase 1.5 flagged the omission; it was never fixed.
            // sr-only is handled by _isSrOnlyClassList, NOT by substring: a plain
            // indexOf('sr-only') also matches `not-sr-only` / `sm:not-sr-only`, whose
            // whole purpose is to make content VISIBLE — the export path was deleting
            // exactly the content those utilities exist to show. Two predicates that
            // disagreed on the same class list; now one.
            if (_isSrOnlyClassList(rawCls)) return true;
            var chromeFragments = ['copy-button', 'action-bar', 'toolbar', 'btn', 'button',
                                   'avatar', 'feedback', 'thumb', 'vote', 'tooltip'];
            for (var i = 0; i < chromeFragments.length; i++) {
                if (cls.indexOf(chromeFragments[i]) !== -1) return true;
            }
            return false;
        }
        // FILTER_REJECT genuinely skips the whole subtree. Advancing with
        // nextSibling() does not: per the DOM traverse-siblings algorithm, when the
        // rejected element is the LAST child, nextSibling() walks up, accepts the
        // parent, and returns null WITHOUT moving currentNode — so the nextNode()
        // fallback descends straight back into the element just rejected. Measured:
        // "<div>REAL TEXT B</div><h5 class='sr-only'>You said:</h5>" produced
        // "REAL TEXT BYou said:". Source-parsed mocks hid it because HTML indentation
        // leaves a whitespace text node after every element; React-rendered DOM has none.
        var walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            { acceptNode: function (n) {
                if (n.nodeType === Node.ELEMENT_NODE && isUIChrome(n)) {
                    return NodeFilter.FILTER_REJECT;   // skips this node AND its subtree
                }
                return NodeFilter.FILTER_ACCEPT;
            } },
            false
        );
        var node = walker.nextNode();
        while (node) {
            // Chrome elements never reach here — the NodeFilter above rejects their
            // entire subtree.
            if (node.nodeType === Node.TEXT_NODE) {
                var text = node.textContent;
                if (text) result.push(text);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                var tag = node.nodeName;
                if (tag === 'PRE') {
                    var codeEl  = node.querySelector('code');
                    var lang    = '';
                    if (codeEl) {
                        var langMatch = (codeEl.className || '').match(/language-(\w+)/);
                        if (langMatch) lang = langMatch[1];
                    }
                    var codeText = (codeEl ? codeEl : node).textContent.trim();
                    result.push('\n```' + lang + '\n' + codeText + '\n```\n');
                    node = walker.nextNode();
                    while (node && node.nodeType) {
                        if (!el.contains(node)) break;
                        if (!node.parentNode) break;
                        // advance past all PRE children
                        var tmp = walker.nextNode();
                        if (!tmp) { node = null; break; }
                        if (!codeEl || !codeEl.contains(tmp)) {
                            node = tmp;
                            break;
                        }
                    }
                    continue;
                }
                if (tag === 'BR')  { result.push('\n'); }
                if (tag === 'P'  || tag === 'DIV') { result.push('\n'); }
                if (tag === 'H1' || tag === 'H2' || tag === 'H3') { result.push('\n## '); }
                if (tag === 'LI') { result.push('\n- '); }
                if (tag === 'A' && node.href) {
                    var linkText = node.textContent.trim();
                    result.push('[' + linkText + '](' + node.href + ')');
                    node = walker.nextNode();
                    continue;
                }
            }
            node = walker.nextNode();
        }
        return result.join('').replace(/\n{3,}/g, '\n\n').trim();
    }

    function downloadFile(filename, content) {
        var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        var url  = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href          = url;
        link.download      = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Index-backed export. This is the highest-priority consumer: a truncated
    // navigation list is visible to the user, a truncated export file is not.
    // The old DOM path silently wrote "**Messages:** 8" for a 147-turn
    // conversation — an authoritative-looking count over 3% of the data.
    function _exportFromIndex() {
        var path = _ciFullPath || [];
        var users = 0, ais = 0, truncated = 0;
        for (var i = 0; i < path.length; i++) {
            if (path[i].sender === 'human') users++; else ais++;
            if (path[i].truncated) truncated++;
        }

        var dateStr = new Date().toISOString().split('T')[0];
        var lines = [];
        lines.push('# Conversation Export');
        lines.push('**Platform:** ' + platform.title);
        lines.push('**Date:** ' + dateStr);
        lines.push('**Messages:** ' + path.length + ' (' + users + ' user, ' + ais + ' AI)');
        lines.push('**Source:** ' + (_ciPathComplete
            ? 'complete conversation history (API)'
            : 'PARTIAL conversation history (API) \u2014 see warning below'));
        if (!_ciPathComplete) {
            lines.push('');
            lines.push('> \u26a0 **Incomplete history.** Walking the conversation tree from its ' +
                       'current tip never reached the root message, so this export begins ' +
                       'part-way through the conversation. Earlier messages are missing.');
        }
        if (truncated > 0) {
            lines.push('');
            lines.push('> \u26a0 **Incomplete:** ' + truncated + ' message' + (truncated !== 1 ? 's' : '') +
                       ' in this conversation are marked truncated by Claude. Their full text is ' +
                       'not available and the content below is partial.');
        }
        if (_ciUsedLeafFallback) {
            lines.push('');
            lines.push('> \u26a0 The active conversation branch was inferred rather than read from ' +
                       'the authoritative pointer. If this conversation has edited or regenerated ' +
                       'messages, verify the branch is the one you expect.');
        }
        lines.push('');
        lines.push('---');

        var qIdx = 0, aIdx = 0;
        for (var j = 0; j < path.length; j++) {
            var m = path[j];
            lines.push('');
            if (m.sender === 'human') { qIdx++; lines.push('## User (Q#' + qIdx + ')'); }
            else                      { aIdx++; lines.push('## Assistant (A#' + aIdx + ')'); }
            if (m.truncated) lines.push('*(truncated by Claude — partial content)*');
            lines.push('');
            lines.push(m.text || '*(no text content)*');
            if (m.files && m.files.length) {
                var names = [];
                for (var f = 0; f < m.files.length; f++) {
                    names.push(m.files[f].file_name || m.files[f].file_kind || 'file');
                }
                lines.push('');
                lines.push('**Attachments:** ' + names.join(', '));
            }
            // attachments[] is a separate channel from files[] — large pastes live in
            // attachments[].extracted_content and were silently omitted from a file
            // labelled as complete API history (Codex round-1 P1). ciExtractText
            // already returns extracted_content when the message has NO text block, so
            // only emit it here when it is NOT already the body.
            // Skip entirely when the body WAS the attachments: after R10's
            // aggregation the message text is all bodies joined, and the
            // per-attachment != comparison re-emitted every large document a second
            // time (Codex R11 :8147).
            if (m.attachments && m.attachments.length &&
                (!m.textSource || m.textSource === 'content')) {
                for (var at = 0; at < m.attachments.length; at++) {
                    var att = m.attachments[at];
                    var body = att.extracted_content && att.extracted_content.trim();
                    if (body && body !== (m.text || '').trim()) {
                        lines.push('');
                        lines.push('**Attached content' +
                                   (att.file_name ? ' (' + att.file_name + ')' : '') + ':**');
                        lines.push('');
                        lines.push('```');
                        lines.push(body);
                        lines.push('```');
                    } else if (!body && att.file_name) {
                        lines.push('');
                        lines.push('**Attachment:** ' + att.file_name);
                    }
                }
            }
            lines.push('');
            lines.push('---');
        }

        downloadFile('conversation-export.md', lines.join('\n'));
        showToast('Saved: conversation-export.md (' + path.length + ' messages)');
    }

    function exportFullConversation() {
        try {
        // Prefer the complete index; fall back to the DOM scan, which on a
        // virtualized platform can only see what is mounted.
        if (ciIsClaudeChat() && ciIsReady() && _ciFullPath && _ciFullPath.length) {
            _exportFromIndex();
            return;
        }
        var questions = typeof _questions !== 'undefined' ? _questions : [];
        var aiMsgsArr = [];
        if (typeof platform !== 'undefined' && platform && platform.getAIMessages) {
            aiMsgsArr = Array.from(platform.getAIMessages());
        } else if (typeof getAIMessages === 'function') {
            aiMsgsArr = Array.from(getAIMessages());
        }
        if (typeof showToast === 'function') showToast('Exporting ' + (questions.length + aiMsgsArr.length) + ' messages\u2026');
        var timeline = buildTimeline(questions, aiMsgsArr);
        var platformTitle = (typeof platform !== 'undefined' && platform && platform.title)
            ? platform.title : window.location.hostname;
        var dateStr = new Date().toISOString().split('T')[0];
        var lines = [];
        lines.push('# Conversation Export');
        lines.push('**Platform:** ' + platformTitle);
        lines.push('**Date:** ' + dateStr);
        lines.push('**Messages:** ' + timeline.length +
            ' (' + questions.length + ' user, ' + aiMsgsArr.length + ' AI)');
        // Never let a DOM-scraped export imply completeness on a platform that
        // only mounts a window of the conversation.
        if (ciIsClaudeChat()) {
            lines.push('**Source:** on-screen messages only — DEGRADED');
            lines.push('');
            lines.push('> \u26a0 **This export is incomplete.** The full conversation history could ' +
                       'not be loaded' + (_ciDegradedReason ? ' (' + _ciDegradedReason + ')' : '') +
                       ', so only messages currently rendered on screen are included. ' +
                       'Claude renders roughly 3\u20135 turns at a time.');
        }
        lines.push('');
        lines.push('---');
        var qIdx = 0;
        var aIdx = 0;
        timeline.forEach(function (msg) {
            lines.push('');
            if (msg.type === 'user') {
                qIdx++;
                lines.push('## User (Q#' + qIdx + ')');
            } else {
                aIdx++;
                lines.push('## Assistant (A#' + aIdx + ')');
            }
            lines.push('');
            lines.push(extractMarkdownContent(msg.element));
            lines.push('');
            lines.push('---');
        });
        downloadFile('conversation-export.md', lines.join('\n'));
        if (typeof showToast === 'function') showToast('Saved: conversation-export.md');
        } catch (err) {
            console.error('[ACN] exportFullConversation failed:', err);
            if (typeof showToast === 'function') showToast('Export failed — see console');
        }
    }

    function exportBookmarks() {
        var bookmarks = getConversationBookmarks();
        if (bookmarks.length === 0) {
            if (typeof showToast === 'function') showToast('No bookmarks in this conversation');
            return;
        }
        bookmarks.sort(function (a, b) { return (a.msgIndex || 0) - (b.msgIndex || 0); });
        var typeIcons  = { 'user-msg': '\uD83D\uDCCC', 'ai-msg': '\uD83D\uDCCC', 'code': '\uD83D\uDCBB', 'file': '\uD83D\uDCC4' };
        var typeLabels = { 'user-msg': 'Your Question', 'ai-msg': 'AI Response', 'code': 'Code Block', 'file': 'File' };
        var platformTitle = (typeof platform !== 'undefined' && platform && platform.title)
            ? platform.title : window.location.hostname;
        var dateStr = new Date().toISOString().split('T')[0];
        var lines = [];
        lines.push('# Bookmarked Items');
        lines.push('**Platform:** ' + platformTitle);
        lines.push('**Date:** ' + dateStr);
        lines.push('**Bookmarks:** ' + bookmarks.length);
        lines.push('');
        lines.push('---');
        bookmarks.forEach(function (bm) {
            var icon   = typeIcons[bm.entityType]  || '\uD83D\uDCCC';
            var label  = typeLabels[bm.entityType] || 'Item';
            var prefix = (bm.entityType === 'user-msg')
                ? 'Q#' + ((bm.msgIndex || 0) + 1)
                : 'A#' + ((bm.msgIndex || 0) + 1);
            lines.push('');
            lines.push('## ' + icon + ' ' + prefix + ' \u2014 ' + label);
            lines.push('');
            lines.push(bm.preview || '(no preview available)');
            lines.push('');
            lines.push('---');
        });
        downloadFile('bookmarks-export.md', lines.join('\n'));
        if (typeof showToast === 'function') showToast('Bookmarks exported');
    }

    function exportSummary() {
        var summary = getSummaryForExport();
        if (!summary) {
            if (typeof showToast === 'function') showToast('Summary not available yet');
            return;
        }
        var platformTitle = (typeof platform !== 'undefined' && platform && platform.title)
            ? platform.title : window.location.hostname;
        var dateStr = new Date().toISOString().split('T')[0];
        var lines = [];
        lines.push('# Conversation Summary');
        lines.push('**Platform:** ' + platformTitle);
        lines.push('**Date:** ' + dateStr);
        lines.push('');
        lines.push('> \u2139\uFE0F This summary was generated by heuristic pattern matching, not AI.');
        lines.push('');
        lines.push('---');
        if (summary.topics && summary.topics.length > 0) {
            lines.push('');
            lines.push('## Topics');
            lines.push(summary.topics.join(' \u00B7 '));
        }
        if (summary.map && summary.map.length > 0) {
            lines.push('');
            lines.push('## Conversation Map');
            summary.map.forEach(function (seg) {
                var range = 'Q' + ((seg.startIdx || 0) + 1) + '\u2013Q' + ((seg.endIdx || 0) + 1);
                lines.push('- **' + seg.label + '** (' + range + ')');
                if (Array.isArray(seg.entities)) {
                    seg.entities.forEach(function (ent) {
                        lines.push('  - ' + (ent.icon || '') + ' ' + ent.label);
                    });
                }
            });
        }
        if (summary.keyPoints && summary.keyPoints.length > 0) {
            lines.push('');
            lines.push('## Key Points');
            summary.keyPoints.forEach(function (kp) {
                var icon = kp.type === 'decision' ? '\uD83D\uDD39' :
                           kp.type === 'finding'  ? '\uD83D\uDD38' : '\uD83D\uDD3A';
                lines.push('- ' + icon + ' ' + kp.text);
            });
        }
        if (summary.stats) {
            lines.push('');
            lines.push('## Stats');
            var inv = summary.inventory || {};
            lines.push(
                (summary.stats.totalMessages || 0) + ' messages (' +
                (summary.stats.userMessages  || 0) + ' user, ' +
                (summary.stats.aiMessages    || 0) + ' AI) \u00B7 ' +
                ((inv.codeBlocks && inv.codeBlocks.length) || 0) + ' code blocks \u00B7 ' +
                ((inv.files && inv.files.length) || 0) + ' files'
            );
        }
        downloadFile('conversation-summary.md', lines.join('\n'));
        if (typeof showToast === 'function') showToast('Summary exported');
    }

    // /Commands — storage and CRUD
    var COMMANDS_KEY = 'acn-commands';

    function loadCommands() {
        try { return GM_getValue(COMMANDS_KEY, []); } catch (e) { return []; }
    }

    function saveCommands(commands) {
        try { GM_setValue(COMMANDS_KEY, commands); } catch (e) {}
    }

    function getCommandByName(name) {
        var commands = loadCommands();
        for (var i = 0; i < commands.length; i++) {
            if (commands[i].name === name) return commands[i];
        }
        return null;
    }

    function sanitizeCommandName(raw) {
        return raw.toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9-]/g, '')
                  .substring(0, 30);
    }

    function createCommand(name, description, prompt) {
        name = sanitizeCommandName(name);
        if (!name || name.length === 0) {
            return { error: 'Name must be 1-30 lowercase characters, numbers, or hyphens' };
        }
        if (getCommandByName(name)) {
            return { error: 'A command with this name already exists' };
        }
        if (!prompt || !prompt.trim()) {
            return { error: 'Prompt is required' };
        }
        var commands = loadCommands();
        var command = {
            id:          'cmd_' + Date.now(),
            name:        name,
            description: description || '',
            prompt:      prompt.trim(),
            createdAt:   Date.now(),
            updatedAt:   Date.now(),
            usageCount:  0,
            lastUsedAt:  null
        };
        commands.push(command);
        saveCommands(commands);
        return { success: true, command: command };
    }

    function updateCommand(id, updates) {
        var commands = loadCommands();
        for (var i = 0; i < commands.length; i++) {
            if (commands[i].id === id) {
                if (updates.name !== undefined && updates.name !== commands[i].name) {
                    var cleanName = sanitizeCommandName(updates.name);
                    if (!cleanName) return { error: 'Name must be 1-30 lowercase characters, numbers, or hyphens' };
                    var existing = getCommandByName(cleanName);
                    if (existing && existing.id !== id) return { error: 'A command with this name already exists' };
                    commands[i].name = cleanName;
                }
                if (updates.description !== undefined) commands[i].description = updates.description;
                if (updates.prompt !== undefined) {
                    if (!updates.prompt.trim()) return { error: 'Prompt is required' };
                    commands[i].prompt = updates.prompt.trim();
                }
                commands[i].updatedAt = Date.now();
                saveCommands(commands);
                return { success: true };
            }
        }
        return { error: 'Command not found' };
    }

    function deleteCommand(id) {
        var commands = loadCommands().filter(function (cmd) { return cmd.id !== id; });
        saveCommands(commands);
    }

    function sortCommands(commands) {
        return commands.slice().sort(function (a, b) {
            if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
            if (a.lastUsedAt) return -1;
            if (b.lastUsedAt) return 1;
            return b.createdAt - a.createdAt;
        });
    }

    function filterCommands(query, commands) {
        if (!query) return commands;
        var q = query.toLowerCase();
        return commands.filter(function (cmd) {
            return cmd.name.toLowerCase().indexOf(q)        !== -1 ||
                   cmd.description.toLowerCase().indexOf(q) !== -1;
        });
    }

    // /Commands — injection mechanism
    function findChatInput() {
        var platformId = (typeof platform !== 'undefined' && platform) ? platform.id : '';
        var selectors = {
            claude:     ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"].prose', 'fieldset textarea'],
            chatgpt:    ['#prompt-textarea', 'textarea[data-id="root"]', 'div[contenteditable="true"]#prompt-textarea'],
            grok:       ['textarea', '[contenteditable="true"]'],
            gemini:     ['div.ql-editor[contenteditable="true"]', '.text-input-field [contenteditable="true"]', 'rich-textarea [contenteditable="true"]'],
            perplexity: ['textarea', '[contenteditable="true"]']
        };
        var tryList = selectors[platformId] || ['textarea', '[contenteditable="true"]'];
        for (var i = 0; i < tryList.length; i++) {
            var el = document.querySelector(tryList[i]);
            if (el) return el;
        }
        return null;
    }

    function copyToClipboard(text) {
        function fallbackCopy(t) {
            var ta = document.createElement('textarea');
            ta.value = t;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
    }

    function tryDirectInject(text) {
        try {
            var input = findChatInput();
            if (!input) return false;
            if (input.tagName === 'TEXTAREA') {
                var nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
                nativeSetter.call(input, text);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            if (input.contentEditable === 'true') {
                input.focus();
                input.textContent = '';
                document.execCommand('insertText', false, text);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        } catch (e) { return false; }
        return false;
    }

    function focusChatInput() {
        var input = findChatInput();
        if (!input) return;
        input.focus();
        if (input.tagName === 'TEXTAREA') {
            input.selectionStart = input.selectionEnd = input.value.length;
        } else if (input.contentEditable === 'true') {
            try {
                var range = document.createRange();
                range.selectNodeContents(input);
                range.collapse(false);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) {}
        }
    }

    function executeCommand(command) {
        var commands = loadCommands();
        for (var i = 0; i < commands.length; i++) {
            if (commands[i].id === command.id) {
                commands[i].usageCount = (commands[i].usageCount || 0) + 1;
                commands[i].lastUsedAt = Date.now();
                break;
            }
        }
        saveCommands(commands);
        var prompt = command.prompt;
        copyToClipboard(prompt);
        var injected = tryDirectInject(prompt);
        focusChatInput();
        if (typeof showToast === 'function') {
            if (injected) {
                showToast('\u2713 /' + command.name + ' injected \u2014 press Enter to send');
            } else {
                showToast('\uD83D\uDCCB /' + command.name + ' copied \u2014 Ctrl+V to paste');
            }
        }
    }

    // /Commands — floating palette
    var _paletteOpen           = false;
    var _paletteSelIdx         = -1;
    var _paletteFiltered       = [];
    var _paletteInputTriggered = false; // true when palette opened by typing /cmd in chat

    function isPaletteOpen() { return _paletteOpen; }

    function toggleCommandPalette() {
        if (_paletteOpen) { closeCommandPalette(); } else { openCommandPalette(); }
    }

    function openCommandPalette(initialQuery) {
        if (_paletteOpen) return;
        _paletteOpen   = true;
        _paletteSelIdx = -1;
        var overlay = document.createElement('div');
        overlay.className = 'acn-palette-overlay';
        overlay.id        = 'acn-palette-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Command palette');
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { _paletteInputTriggered = false; closeCommandPalette(); }
        });
        var palette = document.createElement('div');
        palette.className = 'acn-palette';
        var input = document.createElement('input');
        input.className   = 'acn-palette-input';
        input.id          = 'acn-palette-input';
        input.type        = 'text';
        input.placeholder = 'Search commands\u2026';
        input.setAttribute('aria-label', 'Search commands');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        if (initialQuery) input.value = initialQuery;
        var list = document.createElement('div');
        list.className = 'acn-palette-list';
        list.id        = 'acn-palette-list';
        list.setAttribute('role', 'listbox');
        _refreshPaletteList(list, initialQuery || '');
        input.addEventListener('input', function () {
            _paletteSelIdx = -1;
            _refreshPaletteList(list, input.value);
        });
        palette.appendChild(input);
        palette.appendChild(list);
        overlay.appendChild(palette);
        document.body.appendChild(overlay);
        // Don't steal focus from chat input when palette opened by /cmd typing
        if (!_paletteInputTriggered) {
            setTimeout(function () { input.focus(); }, 20);
        }
    }

    function closeCommandPalette() {
        _paletteOpen           = false;
        _paletteSelIdx         = -1;
        _paletteFiltered       = [];
        _paletteInputTriggered = false;
        var overlay = document.getElementById('acn-palette-overlay');
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function _refreshPaletteList(listEl, query) {
        while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
        var commands = sortCommands(filterCommands(query, loadCommands()));
        _paletteFiltered = commands;
        if (commands.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'acn-palette-empty';
            empty.textContent = loadCommands().length === 0
                ? 'No commands yet. Create one in Tools \u2192 /Commands'
                : 'No commands match "' + query + '"';
            listEl.appendChild(empty);
            return;
        }
        commands.forEach(function (cmd, idx) {
            var item = document.createElement('div');
            item.className = 'acn-palette-item';
            item.setAttribute('role', 'option');
            item.setAttribute('data-cmd-id', cmd.id);
            var left = document.createElement('div');
            left.className = 'acn-palette-item-left';
            var nameEl = document.createElement('div');
            nameEl.className   = 'acn-palette-item-name';
            nameEl.textContent = '/' + cmd.name;
            var descEl = document.createElement('div');
            descEl.className   = 'acn-palette-item-desc';
            descEl.textContent = cmd.description || '';
            left.appendChild(nameEl);
            if (cmd.description) left.appendChild(descEl);
            var runEl = document.createElement('div');
            runEl.className   = 'acn-palette-item-run';
            runEl.textContent = '\u25B6';
            item.appendChild(left);
            item.appendChild(runEl);
            item.addEventListener('click', (function (command) {
                return function () { executeCommand(command); closeCommandPalette(); };
            })(cmd));
            item.addEventListener('mouseenter', (function (i) {
                return function () { _paletteSelIdx = i; _updatePaletteSelection(listEl); };
            })(idx));
            listEl.appendChild(item);
        });
    }

    function _updatePaletteSelection(listEl) {
        var items = listEl.querySelectorAll('.acn-palette-item');
        for (var i = 0; i < items.length; i++) {
            if (i === _paletteSelIdx) {
                items[i].classList.add('acn-selected');
                items[i].scrollIntoView({ block: 'nearest' });
            } else {
                items[i].classList.remove('acn-selected');
            }
        }
    }

    function moveSelection(dir) {
        var overlay = document.getElementById('acn-palette-overlay');
        if (!overlay) return;
        var list  = overlay.querySelector('#acn-palette-list');
        if (!list) return;
        var items = list.querySelectorAll('.acn-palette-item');
        if (items.length === 0) return;
        _paletteSelIdx += dir;
        if (_paletteSelIdx < 0)             _paletteSelIdx = items.length - 1;
        if (_paletteSelIdx >= items.length) _paletteSelIdx = 0;
        _updatePaletteSelection(list);
    }

    function executeSelected() {
        var idx = _paletteSelIdx;
        if (idx < 0 && _paletteFiltered.length > 0) idx = 0;
        if (idx < 0 || idx >= _paletteFiltered.length) return;
        executeCommand(_paletteFiltered[idx]);
        closeCommandPalette();
    }

    // /Commands — tools panel UI
    function renderCommandsSection(container) {
        var section = document.createElement('div');
        section.className = 'acn-tool-section';
        var header = document.createElement('div');
        header.className   = 'acn-tool-section-header';
        header.textContent = '\u2328\uFE0F /Commands';
        section.appendChild(header);
        var body = document.createElement('div');
        body.id = 'acn-cmd-body';
        section.appendChild(body);
        container.appendChild(section);
        _renderCommandListView(body, null);
    }

    function _renderCommandListView(body, _unused) {
        while (body.firstChild) body.removeChild(body.firstChild);
        var commands = sortCommands(loadCommands());
        if (commands.length === 0) {
            var emptyEl = document.createElement('div');
            emptyEl.className = 'acn-cmd-empty';
            emptyEl.textContent = 'No commands yet.\nCreate reusable prompts you can inject into any AI chat with one click.';
            emptyEl.style.whiteSpace = 'pre-line';
            body.appendChild(emptyEl);
        } else {
            commands.forEach(function (cmd) {
                body.appendChild(_buildCommandCard(cmd, body));
            });
        }
        var newBtn = document.createElement('button');
        newBtn.className   = 'acn-cmd-new-btn';
        newBtn.textContent = '+ New Command';
        newBtn.addEventListener('click', function () { _renderCommandForm(body, null); });
        body.appendChild(newBtn);
        var tip = document.createElement('div');
        tip.className   = 'acn-cmd-tip';
        tip.textContent = 'Tip: Ctrl+/ to open quick palette';
        body.appendChild(tip);
    }

    function _buildCommandCard(cmd, body) {
        var card = document.createElement('div');
        card.className = 'acn-cmd-card';
        card.setAttribute('data-cmd-id', cmd.id);
        var info = document.createElement('div');
        info.className = 'acn-cmd-info';
        var nameEl = document.createElement('div');
        nameEl.className   = 'acn-cmd-name';
        nameEl.textContent = '/' + cmd.name;
        var descEl = document.createElement('div');
        descEl.className   = 'acn-cmd-desc';
        descEl.textContent = cmd.description || '';
        info.appendChild(nameEl);
        info.appendChild(descEl);
        var btns = document.createElement('div');
        btns.className = 'acn-cmd-btns';
        var playBtn = document.createElement('button');
        playBtn.className   = 'acn-cmd-btn';
        playBtn.textContent = '\u25B6';
        playBtn.title       = 'Execute';
        playBtn.addEventListener('click', function () { executeCommand(cmd); });
        var editBtn = document.createElement('button');
        editBtn.className   = 'acn-cmd-btn';
        editBtn.textContent = '\u270E';
        editBtn.title       = 'Edit';
        editBtn.addEventListener('click', function () { _renderCommandForm(body, cmd); });
        var delBtn = document.createElement('button');
        delBtn.className   = 'acn-cmd-btn';
        delBtn.textContent = '\u2715';
        delBtn.title       = 'Delete';
        var delConfirmTimer = null;
        var awaitingConfirm = false;
        delBtn.addEventListener('click', function () {
            if (awaitingConfirm) {
                clearTimeout(delConfirmTimer);
                deleteCommand(cmd.id);
                _renderCommandListView(body, null);
            } else {
                awaitingConfirm     = true;
                delBtn.textContent  = 'Sure?';
                delBtn.classList.add('acn-cmd-del-confirm');
                delConfirmTimer = setTimeout(function () {
                    awaitingConfirm     = false;
                    delBtn.textContent  = '\u2715';
                    delBtn.classList.remove('acn-cmd-del-confirm');
                }, 3000);
            }
        });
        btns.appendChild(playBtn);
        btns.appendChild(editBtn);
        btns.appendChild(delBtn);
        card.appendChild(info);
        card.appendChild(btns);
        return card;
    }

    function _renderCommandForm(body, existingCmd) {
        while (body.firstChild) body.removeChild(body.firstChild);
        var isEdit = !!existingCmd;
        var form = document.createElement('div');
        form.className = 'acn-cmd-form';
        var titleEl = document.createElement('div');
        titleEl.className   = 'acn-cmd-form-title';
        titleEl.textContent = isEdit ? 'Edit Command' : 'Create Command';
        form.appendChild(titleEl);
        var nameLbl = document.createElement('label');
        nameLbl.className   = 'acn-cmd-label';
        nameLbl.textContent = 'Name';
        form.appendChild(nameLbl);
        var nameRow = document.createElement('div');
        nameRow.className = 'acn-cmd-name-row';
        var prefix = document.createElement('span');
        prefix.className   = 'acn-cmd-prefix';
        prefix.textContent = '/';
        var nameInput = document.createElement('input');
        nameInput.type        = 'text';
        nameInput.className   = 'acn-cmd-input';
        nameInput.style.flex  = '1';
        nameInput.placeholder = 'e.g. handoff';
        nameInput.maxLength   = 30;
        nameInput.setAttribute('autocomplete', 'off');
        nameInput.setAttribute('spellcheck', 'false');
        if (isEdit) nameInput.value = existingCmd.name;
        nameRow.appendChild(prefix);
        nameRow.appendChild(nameInput);
        form.appendChild(nameRow);
        var descLbl = document.createElement('label');
        descLbl.className   = 'acn-cmd-label';
        descLbl.textContent = 'Description';
        descLbl.style.marginTop = '8px';
        form.appendChild(descLbl);
        var descInput = document.createElement('input');
        descInput.type        = 'text';
        descInput.className   = 'acn-cmd-input';
        descInput.style.width = '100%';
        descInput.placeholder = 'One-line description (optional)';
        descInput.setAttribute('autocomplete', 'off');
        if (isEdit) descInput.value = existingCmd.description || '';
        form.appendChild(descInput);
        var promptLbl = document.createElement('label');
        promptLbl.className   = 'acn-cmd-label';
        promptLbl.textContent = 'Prompt';
        promptLbl.style.marginTop = '8px';
        form.appendChild(promptLbl);
        var promptTA = document.createElement('textarea');
        promptTA.className   = 'acn-cmd-textarea';
        promptTA.rows        = 6;
        promptTA.placeholder = 'The full prompt text\u2026';
        if (isEdit) promptTA.value = existingCmd.prompt || '';
        form.appendChild(promptTA);
        var errEl = document.createElement('div');
        errEl.className = 'acn-cmd-form-err';
        form.appendChild(errEl);
        var btnRow = document.createElement('div');
        btnRow.className = 'acn-cmd-form-btns';
        var cancelBtn = document.createElement('button');
        cancelBtn.className   = 'acn-cmd-form-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () { _renderCommandListView(body, null); });
        var saveBtn = document.createElement('button');
        saveBtn.className   = 'acn-cmd-form-save';
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Save Command';
        saveBtn.addEventListener('click', function () {
            var nameVal   = nameInput.value.trim();
            var descVal   = descInput.value.trim();
            var promptVal = promptTA.value;
            var result;
            if (isEdit) {
                result = updateCommand(existingCmd.id, { name: nameVal, description: descVal, prompt: promptVal });
            } else {
                result = createCommand(nameVal, descVal, promptVal);
            }
            if (result.error) { errEl.textContent = result.error; return; }
            _renderCommandListView(body, null);
        });
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        form.appendChild(btnRow);
        body.appendChild(form);
        setTimeout(function () { nameInput.focus(); }, 20);
    }

    function orbBuildPanelTools() {
        var panel = createElement('div', { id: 'acn-panel-tools', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\uD83D\uDD27 ' + (i18n('tools') || 'Tools')));
        var scroll = createElement('div', { style: 'flex:1;overflow-y:auto' });

        // 1. Image Gallery — rendered on open by orbOpenPanel, not at injection time
        var gallerySection = document.createElement('div');
        gallerySection.className = 'acn-tool-section';
        gallerySection.id = 'acn-gallery-section';
        scroll.appendChild(gallerySection);

        // 2. Exports
        var exportSection = document.createElement('div');
        exportSection.className = 'acn-tool-section';
        var exportHeader = document.createElement('div');
        exportHeader.className   = 'acn-tool-section-header';
        exportHeader.textContent = '\uD83D\uDCCB Exports';
        exportSection.appendChild(exportHeader);
        var TOOLS_EXPORT = [
            { icon: '\uD83D\uDCC4', title: 'Full Conversation',  desc: 'Markdown with all messages and code blocks.', action: exportFullConversation },
            { icon: '\uD83D\uDCCC', title: 'Bookmarks Only',     desc: 'Pinned messages as structured document.',     action: exportBookmarks },
            { icon: '\u03A3',       title: 'Summary',            desc: 'Topics, decisions, and action items.',        action: exportSummary }
        ];
        TOOLS_EXPORT.forEach(function (tool) {
            var iconEl  = createElement('div', { className: 'acn-exp-icon',  textContent: tool.icon });
            var titleEl = createElement('div', { className: 'acn-exp-title', textContent: tool.title });
            var descEl  = createElement('div', { className: 'acn-exp-desc',  textContent: tool.desc });
            var opt     = createElement('div', { className: 'acn-exp-opt' }, [iconEl, titleEl, descEl]);
            opt.addEventListener('click', function () { tool.action(); });
            exportSection.appendChild(opt);
        });
        scroll.appendChild(exportSection);

        // 3. /Commands
        renderCommandsSection(scroll);

        // 4. Footer
        var footer = createElement('div', {
            style: 'padding:12px 14px;font-size:10px;color:#444;line-height:1.6;border-top:1px solid rgba(255,255,255,.05)',
            textContent: 'More tools coming soon. Got ideas? Open an issue on GitHub!'
        });
        scroll.appendChild(footer);

        panel.appendChild(scroll);
        return panel;
    }

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
            // Update dot labels and panel headers live without a page reload
            ORB_FEATURES.forEach(function (f) {
                var dot = document.getElementById('acn-dot-' + f.id);
                if (dot) {
                    var lbl = dot.querySelector('.acn-lbl');
                    if (lbl) lbl.textContent = i18n(f.i18nKey) || f.label;
                }
                var panel = document.getElementById('acn-panel-' + f.id);
                if (panel) {
                    var h3 = panel.querySelector('.acn-ph h3');
                    if (h3) h3.textContent = f.icon + ' ' + (i18n(f.i18nKey) || f.label);
                }
            });
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

        var currentPlatformId = (platform && platform.id) ? platform.id : '';

        platList.forEach(function (p) {
            var platformId = p.id;
            var isCurrent  = platformId === currentPlatformId;

            var platSettings = loadSettings();
            var isEnabled = platSettings.platforms[platformId] !== false;

            var iconEl = createElement('span', {
                className: 'acn-plat-icon',
                style: 'color:' + p.color,
                textContent: p.icon,
            });

            var nameEl = createElement('span', {
                className: 'acn-plat-name',
                textContent: p.name,
            });
            if (isCurrent) {
                var lockEl = createElement('span', {
                    className: 'acn-plat-lock',
                    textContent: '\uD83D\uDD12',
                });
                nameEl.appendChild(lockEl);
            }

            var tog = createElement('div', {
                className: 'acn-toggle' + (isEnabled ? ' acn-on' : '') +
                           (isCurrent ? ' acn-toggle-locked' : ''),
            });

            tog.addEventListener('click', function () {
                if (isCurrent) {
                    showToast(i18n('cantDisableCurrent'));
                    return;
                }

                var currentSettings = loadSettings();
                var enabledCount = Object.keys(currentSettings.platforms).filter(function (k) {
                    return currentSettings.platforms[k] !== false;
                }).length;
                var currentlyEnabled = currentSettings.platforms[platformId] !== false;

                if (currentlyEnabled && enabledCount <= 1) {
                    showToast(i18n('mustHaveOnePlatform'));
                    return;
                }

                var newState = !currentlyEnabled;
                currentSettings.platforms[platformId] = newState;
                tog.classList.toggle('acn-on', newState);
                saveSettings(currentSettings);

                showToast(i18n('refreshToApply'));
            });

            platGroup.appendChild(createElement('div', { className: 'acn-plat-row' },
                [iconEl, nameEl, tog]));
        });

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

        aboutGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
            createElement('div', {
                className: 'acn-set-label',
                style: 'color:#777',
                textContent: 'AI Conversation Navigator v' + ACN_VERSION,
            }),
        ]));

        var ghLink = createElement('a', {
            className: 'acn-about-link',
            textContent: 'github.com/joonj14/ai-conversation-navigator',
        });
        ghLink.setAttribute('href', 'https://github.com/joonj14/ai-conversation-navigator');
        ghLink.setAttribute('target', '_blank');
        ghLink.setAttribute('rel', 'noopener noreferrer');
        aboutGroup.appendChild(ghLink);

        var resetBtn = createElement('button', {
            className: 'acn-reset-btn',
            textContent: i18n('resetToDefault'),
        });
        resetBtn.addEventListener('click', function () {
            if (!confirm(i18n('resetConfirm'))) return;

            orbSetMode('show-all');
            orbScrollInverted = false;
            orbSaveSettings();

            var fresh = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            saveSettings(fresh);

            var modSelEl = document.getElementById('acn-mode-sel');
            if (modSelEl) modSelEl.value = 'show-all';

            var dirSelEl = document.getElementById('acn-dir-sel');
            if (dirSelEl) dirSelEl.value = 'standard';

            var langSelEl = document.getElementById('acn-lang-sel');
            if (langSelEl) langSelEl.value = DEFAULT_SETTINGS.language;

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
    // ZONE + DOTS BUILDER
    // ============================================================
    function orbBuildZone() {
        var zone = createElement('div', { id: 'acn-zone', className: 'acn-zone' });
        // Stable test-contract attributes — tests use these roles, not internal IDs/classes
        zone.setAttribute('data-acn-role',     'zone');
        zone.setAttribute('data-acn-ui',       'orbital');      // distinguishes orbital vs legacy UI system
        zone.setAttribute('data-acn-accent',   orbTheme.bg);   // platform hex color
        zone.setAttribute('data-acn-version',  ACN_VERSION);
        zone.setAttribute('data-acn-platform', platform.id);   // for platform-specific CSS rules

        // Set CSS variables for platform theming on :root so panels (which are
        // document.body siblings of zone, not zone descendants) can also inherit them
        document.documentElement.style.setProperty('--acn-accent', orbTheme.bg);
        document.documentElement.style.setProperty('--acn-rgb',    orbTheme.rgb);
        document.documentElement.style.setProperty('--acn-shadow', orbTheme.shadow);
        zone.style.setProperty('--acn-accent', orbTheme.bg);
        zone.style.setProperty('--acn-rgb',    orbTheme.rgb);
        zone.style.setProperty('--acn-shadow', orbTheme.shadow);

        // Hitzone — captures hover/scroll events
        var hitzone = createElement('div', { id: 'acn-hitzone', className: 'acn-hitzone' });
        zone.appendChild(hitzone);
        // orbUpdateHitzone() called after zone is in DOM (in injectOrbital)

        // Wheel/arc hint
        var hint = createElement('div', { id: 'acn-whint', className: 'acn-whint' });
        hint.appendChild(createElement('span', null, ['\u2195 scroll']));
        zone.appendChild(hint);

        // Feature dots
        orbDots = [];
        ORB_FEATURES.forEach(function (f, i) {
            var dot = createElement('div', {
                id: 'acn-dot-' + f.id,
                className: 'acn-dot',
            });
            dot.style.background = orbTheme.bg;
            // Stable test-contract attribute — identifies each dot by feature
            dot.setAttribute('data-acn-dot', f.id);
            // Navigate dot is the entry point for the core navigation feature
            if (f.id === 'nav') dot.setAttribute('data-acn-role', 'nav-trigger');
            // Label
            var lbl = createElement('span', { className: 'acn-lbl', textContent: f.label });
            // Navigate dot shows the platform's own icon; all others use the feature icon
            dot.appendChild(document.createTextNode(f.id === 'nav' ? platform.icon : f.icon));
            dot.appendChild(lbl);
            dot.addEventListener('click', (function (id) {
                return function (e) { e.stopPropagation(); orbOpenPanel(id); };
            })(f.id));
            zone.appendChild(dot);
            orbDots.push(dot);
        });

        // Connectors (N-1 of them)
        orbConns = [];
        for (var i = 0; i < ORB_N - 1; i++) {
            var conn = createElement('div', { className: 'acn-conn' });
            zone.appendChild(conn);
            orbConns.push(conn);
        }

        // ── Event handlers ──

        // Hover enter
        function handleEnter() { orbHovering = true; orbRender(); }
        hitzone.addEventListener('mouseenter', handleEnter);
        // NOTE: zone.addEventListener('mouseenter') removed — zone has pointer-events:none

        // Hover exit — resets rotIdx to Navigate when leaving and no panel open
        function handleExit(e) {
            var related = e.relatedTarget;
            if (related && (
                related.closest && (
                    related.closest('.acn-dot') ||
                    related.closest('.acn-zone') ||
                    related.closest('.acn-panel')
                )
            )) return;
            if (orbPanel) return;
            orbHovering = false;
            if (orbMode === 'wheel' || orbMode === 'arc') {
                orbPrevRotIdx = orbRotIdx;
                orbRotIdx     = 0;
            }
            orbRender();
        }
        hitzone.addEventListener('mouseleave', handleExit);
        // NOTE: zone.addEventListener('mouseleave') removed — zone has pointer-events:none

        // Dot-level mouseleave safety net — catches fast movements that escape the hitzone
        orbDots.forEach(function (dot) {
            dot.addEventListener('mouseenter', handleEnter);
            dot.addEventListener('mouseleave', function (e) {
                var related = e.relatedTarget;
                // Stay hovered if the mouse moved to another dot, the hitzone, or an open panel
                if (related && related.closest && (
                    related.closest('.acn-dot')    ||
                    related.closest('#acn-hitzone') ||
                    related.closest('.acn-panel')
                )) return;
                // Stay hovered if a panel is currently open (panel keeps UI alive)
                if (orbPanel) return;
                orbHovering = false;
                if (orbMode === 'wheel' || orbMode === 'arc') {
                    orbPrevRotIdx = orbRotIdx;
                    orbRotIdx     = 0;
                }
                orbRender();
            });
        });

        // Scroll — rotates arc/wheel
        zone.addEventListener('wheel', function (e) {
            if (orbMode === 'show-all') return;
            if (!orbHovering && !orbPanel) return;
            e.preventDefault();
            if (orbAnimLock) return;
            orbAnimLock = true;

            var delta = e.deltaY;
            if (orbScrollInverted) delta = -delta;

            orbPrevRotIdx = orbRotIdx;

            if (orbMode === 'wheel') {
                orbRotIdx = (delta > 0)
                    ? (orbRotIdx + 1) % ORB_N
                    : (orbRotIdx - 1 + ORB_N) % ORB_N;
            } else if (orbMode === 'arc') {
                var nS = ORB_N - 1;
                orbRotIdx = (delta > 0)
                    ? (orbRotIdx + 1) % nS
                    : (orbRotIdx - 1 + nS) % nS;
            }

            orbRender();
            setTimeout(function () { orbAnimLock = false; }, 250);
        }, { passive: false });

        // ── Drag to reposition (orbital platforms only) ──────────
        // _orbDragStart is element-local (attached to hitzone/dots that are recreated
        // each injection), so it stays here. The move/end/resize handlers live at
        // module scope and are registered only once via _orbAttachGlobalDragHandlers().
        function _orbDragStart(e) {
            if (e.button !== 0) return; // left button only
            _orbDragActive     = true;
            _orbDragMoved      = false;
            _orbDragStartY     = e.clientY;
            _orbDragStartRatio = _orbYRatio;
            e.preventDefault(); // prevent text selection during drag
        }
        hitzone.addEventListener('mousedown', _orbDragStart);
        orbDots.forEach(function (dot) {
            dot.addEventListener('mousedown', _orbDragStart);
        });
        // Register document/window listeners once — no-op on SPA reinjection
        _orbAttachGlobalDragHandlers();

        return zone;
    }

    // ============================================================
    // HITZONE GEOMETRY — computes tight hitzone bounds from dot stack
    // ============================================================
    function orbUpdateHitzone() {
        var hitzone = document.getElementById('acn-hitzone');
        if (!hitzone) return;

        // Vertical center of viewport (mirrors orbRender's `cy` computation)
        var cy = _orbGetCy();

        // show-all geometry: Navigate at cy, satellites spread above/below at sp-px intervals
        var sp = 48;

        var nSats  = ORB_N - 1;           // satellite dots (all except Navigate)
        var nAbove = Math.floor(nSats / 2);
        var nBelow = nSats - nAbove;

        // Topmost pixel of the highest dot
        var stackTop    = cy - Math.max(nAbove * sp + 16, 24);
        // Bottommost pixel of the lowest dot
        var stackBottom = cy + Math.max(nBelow * sp + 16, 24);

        // Hitzone bounds with padding
        var hitzoneTop    = Math.max(0, stackTop - HITZONE_PAD_Y);
        var hitzoneBottom = Math.min(window.innerHeight, stackBottom + HITZONE_PAD_Y);
        var hitzoneHeight = hitzoneBottom - hitzoneTop;

        // Width must cover the furthest dot in the active mode.
        // show-all/wheel: dots are on the center axis (ORB_CX ± 24px)
        // arc: focused satellite extends ORB_CX + radius + half-dot from the right edge
        var baseWidth = ORB_CX + 24 + HITZONE_PAD_X;      // 96px — covers show-all & wheel
        var arcWidth  = ORB_CX + 88 + 17 + HITZONE_PAD_X; // 177px — covers arc focused dot

        var hitzoneWidth = (orbMode === 'arc') ? arcWidth : baseWidth;

        hitzone.style.top    = hitzoneTop + 'px';
        hitzone.style.height = hitzoneHeight + 'px';
        hitzone.style.width  = hitzoneWidth + 'px';
        hitzone.style.bottom = 'auto';   // override any inherited CSS bottom value
    }

    // ============================================================
    // MAIN INJECTION
    // ============================================================
    function injectOrbital() {
        if (orbInjected) return;
        if (document.getElementById('acn-zone')) { orbInjected = true; return; }
        orbInjected = true;

        // Clean up any orphaned panels from a previous injection cycle
        document.querySelectorAll('.acn-panel').forEach(function (p) { p.remove(); });

        orbLoadSettings();
        _orbLoadZonePosition();
        orbInjectCSS();

        // Build and append zone
        var zone = orbBuildZone();
        document.body.appendChild(zone);
        orbUpdateHitzone(); // must run after zone is in DOM so getElementById works

        // Apply saved panel width via CSS variable (before panels are built)
        document.documentElement.style.setProperty('--acn-panel-w', _panelWidth + 'px');

        // Build and append panels
        document.body.appendChild(orbBuildPanelNav());
        document.body.appendChild(orbBuildPanelSearch());
        document.body.appendChild(orbBuildPanelBookmarks());
        document.body.appendChild(orbBuildPanelSummary());
        document.body.appendChild(orbBuildPanelTools());
        document.body.appendChild(orbBuildPanelSettings());

        // Add resize handle to each panel
        addPanelResizeHandles();

        // Set up /cmd typing detection in the chat input
        setTimeout(setupChatInputSlashDetection, 1500);

        // For left-chat: initially hidden until boundary is detected
        if (isLeftChat) {
            zone.style.visibility = 'hidden';
        }

        orbRender();
    }

    // ============================================================
    // LEGACY GHOST-NOTCH SYSTEM (app-builder platforms)
    // ============================================================

    // Position #ai-nav-button-container and #ai-nav-panel at the chat boundary
    function legacyApplyPosition() {
        var container = document.getElementById('ai-nav-button-container');
        var panel     = document.getElementById('ai-nav-panel');
        if (!_boundaryDetected || !_lastBoundaryX) {
            if (container) { container.style.display = 'none'; container.classList.remove('ai-nav-positioned'); }
            if (panel)     panel.style.display = 'none';
            return;
        }
        var offset    = platform.scrollbarOffset || 0;
        var panelRight  = (window.innerWidth - _lastBoundaryX) + 'px';
        var btnRight    = (window.innerWidth - _lastBoundaryX + offset) + 'px';
        if (container) {
            container.style.display = '';
            // If panel is open (isLeftChat mode), keep button flush with panel's left edge
            // No scrollbarOffset when open — the button is at the panel edge, not the chat boundary
            var panelOpen = isLeftChat && container.classList.contains('open');
            container.style.right   = panelOpen ? (window.innerWidth - _lastBoundaryX + 320) + 'px' : btnRight;
            // Fade in on first detection
            setTimeout(function () { if (container) container.classList.add('ai-nav-positioned'); }, 300);
        }
        if (panel) {
            panel.style.display = '';
            panel.style.right   = panelRight;
        }
    }

    function injectLegacy() {
        if (document.getElementById('ai-nav-style-legacy')) return;

        var theme     = platform.theme;
        var siteIcon  = platform.icon;
        var siteTitle = platform.title;

        // ── CSS ──────────────────────────────────────────────────
        var buttonCSS = isLeftChat ? (
            '#ai-nav-button-container{position:fixed!important;left:auto!important;right:65%;top:50%!important;transform:translateY(-50%)!important;z-index:2147483647!important;display:flex!important;flex-direction:column!important;gap:2px!important;pointer-events:none!important;transition:right 0.3s ease!important;}' +
            '#ai-nav-button-container.open{pointer-events:auto!important;}' +
            '.ai-nav-floating-btn{background:' + theme.accent + '!important;color:' + (theme.textColor || '#fff') + '!important;border:' + (theme.toggleBorder || 'none') + '!important;cursor:pointer!important;border-radius:6px 0 0 6px!important;box-shadow:-2px 0 8px rgba(0,0,0,.3)!important;display:flex!important;align-items:center!important;justify-content:center!important;width:14px!important;height:52px!important;padding:0!important;font-weight:800!important;font-size:20px!important;overflow:hidden!important;transition:width .3s cubic-bezier(.4,0,.2,1),height .3s cubic-bezier(.4,0,.2,1),opacity .3s ease!important;white-space:nowrap!important;opacity:0!important;pointer-events:auto!important;position:relative!important;}' +
            '.ai-nav-floating-btn .ai-nav-icon{font-size:14px!important;opacity:0!important;transform:scale(.6)!important;transition:opacity .25s ease .05s,transform .25s ease .05s!important;}' +
            '.ai-nav-floating-btn .ai-nav-expand-text{display:none!important;}' +
            '#ai-nav-button-container.ai-nav-positioned .ai-nav-floating-btn{opacity:0.65!important;}' +
            '#ai-nav-button-container.ai-nav-positioned .ai-nav-floating-btn:hover,.ai-nav-floating-btn:hover,#ai-nav-button-container.open:hover .ai-nav-floating-btn{width:32px!important;height:40px!important;opacity:1!important;}' +
            '#ai-nav-button-container.ai-nav-positioned .ai-nav-floating-btn:hover .ai-nav-icon,.ai-nav-floating-btn:hover .ai-nav-icon,#ai-nav-button-container.open:hover .ai-nav-floating-btn .ai-nav-icon{opacity:1!important;transform:scale(1)!important;}' +
            '.ai-nav-floating-btn.open{opacity:1!important;background:' + theme.accentHover + '!important;}'
        ) : (
            '#ai-nav-button-container{position:fixed!important;right:0!important;top:50%!important;transform:translateY(-50%)!important;z-index:2147483647!important;display:flex!important;flex-direction:column!important;gap:2px!important;pointer-events:none!important;transition:right .3s ease!important;}' +
            '#ai-nav-button-container.open{right:320px!important;pointer-events:auto!important;}' +
            '.ai-nav-floating-btn{background:' + theme.accent + '!important;color:' + (theme.textColor || '#fff') + '!important;border:' + (theme.toggleBorder || 'none') + '!important;cursor:pointer!important;border-radius:8px 0 0 8px!important;box-shadow:-2px 0 10px rgba(0,0,0,.3)!important;display:flex!important;align-items:center!important;gap:0px!important;padding:12px!important;font-weight:800!important;font-size:20px!important;overflow:hidden!important;transition:all .25s ease!important;white-space:nowrap!important;opacity:1!important;pointer-events:auto!important;align-self:flex-end!important;box-sizing:border-box!important;width:48px!important;position:relative!important;}' +
            '.ai-nav-floating-btn .ai-nav-icon{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:24px!important;height:24px!important;flex-shrink:0!important;}' +
            '.ai-nav-floating-btn:hover,#ai-nav-button-container.open:hover .ai-nav-floating-btn{padding-right:16px!important;width:127px!important;}' +
            '.ai-nav-floating-btn .ai-nav-expand-text{width:0!important;opacity:0!important;overflow:hidden!important;transition:width .25s ease,opacity .2s ease,margin-left .25s ease!important;font-size:13px!important;font-weight:500!important;margin-left:0!important;display:inline-block!important;white-space:nowrap!important;}' +
            '.ai-nav-floating-btn:hover .ai-nav-expand-text,#ai-nav-button-container.open:hover .ai-nav-floating-btn .ai-nav-expand-text{width:65px!important;opacity:1!important;margin-left:10px!important;}' +
            '.ai-nav-floating-btn.open{background:' + theme.accentHover + '!important;}'
        );
        var panelCSS = isLeftChat ? (
            '#ai-nav-panel{position:fixed!important;left:auto!important;right:65%;top:0!important;width:320px!important;height:100vh!important;background:#1a1a1a!important;border-right:1px solid #333!important;z-index:2147483646!important;clip-path:inset(0 0 0 100%)!important;transition:clip-path .3s ease!important;display:flex!important;flex-direction:column!important;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif!important;pointer-events:none!important;}' +
            '#ai-nav-panel.open{clip-path:inset(0 0 0 0)!important;pointer-events:auto!important;}'
        ) : (
            '#ai-nav-panel{position:fixed!important;right:-320px!important;top:0!important;width:320px!important;height:100vh!important;background:#1a1a1a!important;border-left:1px solid #333!important;z-index:2147483646!important;transition:right .3s ease!important;display:flex!important;flex-direction:column!important;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif!important;}' +
            '#ai-nav-panel.open{right:0!important;}'
        );
        var sharedCSS = (
            '#ai-nav-header{padding:16px;background:#252525;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;}' +
            '#ai-nav-header h3{margin:0;color:#fff;font-size:14px;font-weight:600;}' +
            '#ai-nav-refresh{background:#333;border:none;color:#aaa;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;}' +
            '#ai-nav-refresh:hover{background:#444;color:#fff;}' +
            '#ai-nav-stats{padding:12px 16px;background:#202020;border-bottom:1px solid #333;color:#888;font-size:12px;}' +
            '#ai-nav-list{flex:1;overflow-y:auto;padding:8px;}' +
            '.ai-nav-item{padding:12px;margin-bottom:6px;background:#252525;border-radius:8px;cursor:pointer;border-left:3px solid ' + theme.accent + ';transition:all .15s ease;}' +
            '.ai-nav-item:hover{background:#303030;border-left-color:' + theme.accentHover + ';}' +
            '.ai-nav-number{color:' + (theme.numberColor || theme.accent) + ';font-size:11px;font-weight:600;margin-bottom:4px;}' +
            '.ai-nav-summary{color:#e5e5e5;font-size:13px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}' +
            '#ai-nav-empty{color:#666;text-align:center;padding:40px 20px;font-size:13px;}' +
            '#ai-nav-list::-webkit-scrollbar{width:6px;}#ai-nav-list::-webkit-scrollbar-track{background:#1a1a1a;}#ai-nav-list::-webkit-scrollbar-thumb{background:#444;border-radius:3px;}'
        );

        var styleEl = document.createElement('style');
        styleEl.id = 'ai-nav-style-legacy';
        styleEl.setAttribute('data-acn-role', 'styles');   // contract attribute
        styleEl.textContent = buttonCSS + panelCSS + sharedCSS;
        document.head.appendChild(styleEl);

        // ── State ────────────────────────────────────────────────
        var legacyNavOpen = false;

        // ── Build panel DOM ──────────────────────────────────────
        function buildLegacyPanel() {
            var closeBtn = createElement('button', { id: 'ai-nav-close', textContent: '\u00D7' });
            closeBtn.setAttribute('data-acn-role', 'panel-close');  // contract attribute
            closeBtn.addEventListener('click', function () {
                legacyNavOpen = false;
                var p = document.getElementById('ai-nav-panel');
                var b = document.getElementById('ai-nav-toggle');
                var c = document.getElementById('ai-nav-button-container');
                if (p) { p.classList.remove('open'); p.removeAttribute('data-acn-open'); }
                if (b) b.classList.remove('open');
                if (c) {
                    c.classList.remove('open');
                    if (isLeftChat && _lastBoundaryX) {
                        var off = platform.scrollbarOffset || 0;
                        c.style.right = (window.innerWidth - _lastBoundaryX + off) + 'px';
                    }
                }
            });
            var header = createElement('div', { id: 'ai-nav-header' }, [
                createElement('h3', null, [siteIcon + ' ' + siteTitle + ' - Questions']),
                createElement('button', { id: 'ai-nav-refresh', textContent: '\u21BB Refresh' })
            ]);
            header.appendChild(closeBtn);
            header.querySelector('#ai-nav-refresh').addEventListener('click', function () {
                scanConversation(true);
                legacyRenderPanel();
            });
            var stats = createElement('div', { id: 'ai-nav-stats' });
            stats.setAttribute('data-acn-role', 'nav-stat');    // contract attribute
            stats.setAttribute('data-acn-count', '0');
            var list  = createElement('div', { id: 'ai-nav-list' });
            list.setAttribute('data-acn-role', 'nav-list');     // contract attribute
            var panel = createElement('div', { id: 'ai-nav-panel' });
            panel.setAttribute('data-acn-role', 'nav-panel');   // contract attribute
            panel.appendChild(header);
            panel.appendChild(stats);
            panel.appendChild(list);
            return panel;
        }

        // ── Render questions into panel ──────────────────────────
        function legacyRenderPanel() {
            var list  = document.getElementById('ai-nav-list');
            var stats = document.getElementById('ai-nav-stats');
            if (!list || !stats) return;
            while (list.firstChild) list.removeChild(list.firstChild);
            stats.setAttribute('data-acn-count', String(_questions.length));
            if (_questions.length === 0) {
                list.appendChild(createElement('div', { id: 'ai-nav-empty', textContent: 'No questions found. Try clicking \u21BB Refresh.' }));
                stats.textContent = '0 questions found';
                return;
            }
            stats.textContent = _questions.length + ' question' + (_questions.length !== 1 ? 's' : '') + ' found';
            _questions.forEach(function (q, idx) {
                var textEl = createElement('div', { className: 'ai-nav-summary', textContent: q.summary || q.text });
                textEl.setAttribute('data-acn-role', 'nav-item-text');  // contract attribute
                var item = createElement('div', { className: 'ai-nav-item' }, [
                    createElement('div', { className: 'ai-nav-number', textContent: 'Question #' + (idx + 1) }),
                    textEl
                ]);
                item.setAttribute('data-acn-role', 'nav-item');         // contract attribute
                item.addEventListener('click', function () {
                    if (!q.element) return;
                    var target = q.element.isConnected ? q.element : (function () {
                        var msgs = Array.from(getUserMessages());
                        return msgs.find(function (m) {
                            // q.text comes from _readMessageText (sr-only stripped structurally),
                        // so comparing against raw textContent fails whenever a label is
                        // present and the legacy nav item's click becomes a silent no-op.
                        return _readMessageText(m).startsWith((q.text || '').substring(0, 60));
                        }) || null;
                    })();
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        target.style.transition = 'background .3s';
                        target.style.background = theme.accentLight || 'rgba(217,119,6,.2)';
                        setTimeout(function () { target.style.background = ''; }, 1500);
                    }
                });
                list.appendChild(item);
            });
        }

        // ── Toggle handler ───────────────────────────────────────
        function handleLegacyToggle() {
            legacyNavOpen = !legacyNavOpen;
            var panel     = document.getElementById('ai-nav-panel');
            var btn       = document.getElementById('ai-nav-toggle');
            var container = document.getElementById('ai-nav-button-container');
            if (legacyNavOpen) {
                if (panel)     { panel.classList.add('open'); panel.setAttribute('data-acn-open', 'true'); }
                if (btn)       btn.classList.add('open');
                if (container) {
                    container.classList.add('open');
                    if (isLeftChat && _lastBoundaryX) {
                        container.style.right = (window.innerWidth - _lastBoundaryX + 320) + 'px';
                    }
                }
                scanConversation();
                legacyRenderPanel();
            } else {
                if (panel)     { panel.classList.remove('open'); panel.removeAttribute('data-acn-open'); }
                if (btn)       btn.classList.remove('open');
                if (container) {
                    container.classList.remove('open');
                    if (isLeftChat && _lastBoundaryX) {
                        var off = platform.scrollbarOffset || 0;
                        container.style.right = (window.innerWidth - _lastBoundaryX + off) + 'px';
                    }
                }
            }
        }

        // ── Create button ────────────────────────────────────────
        function buildLegacyButton() {
            var btn;
            if (isLeftChat) {
                btn = createElement('div', { id: 'ai-nav-toggle', className: 'ai-nav-floating-btn' }, [
                    createElement('span', { className: 'ai-nav-icon', textContent: siteIcon })
                ]);
            } else {
                btn = createElement('div', { id: 'ai-nav-toggle', className: 'ai-nav-floating-btn' }, [
                    document.createTextNode(siteIcon),
                    createElement('span', { className: 'ai-nav-expand-text', textContent: 'Navigate' })
                ]);
            }
            btn.setAttribute('data-acn-role', 'nav-trigger');   // contract attribute
            btn.addEventListener('click', handleLegacyToggle);
            return btn;
        }

        // ── DOM Guardian ─────────────────────────────────────────
        var guardianTimer = null;
        new MutationObserver(function () {
            if (guardianTimer) clearTimeout(guardianTimer);
            guardianTimer = setTimeout(function () {
                if (!document.getElementById('ai-nav-panel')) {
                    var p = buildLegacyPanel();
                    if (isLeftChat && !_boundaryDetected) p.style.display = 'none';
                    if (legacyNavOpen) { p.classList.add('open'); p.setAttribute('data-acn-open', 'true'); legacyRenderPanel(); }
                    document.body.appendChild(p);
                }
                if (!document.getElementById('ai-nav-button-container')) {
                    var b   = buildLegacyButton();
                    var con = createElement('div', { id: 'ai-nav-button-container' });
                    con.setAttribute('data-acn-role', 'zone');
                    con.setAttribute('data-acn-ui', 'legacy');
                    con.setAttribute('data-acn-accent', theme.accent);
                    con.setAttribute('data-acn-version', ACN_VERSION);
                    con.appendChild(b);
                    if (isLeftChat) {
                        con.style.display = _boundaryDetected ? '' : 'none';
                        if (_boundaryDetected) con.classList.add('ai-nav-positioned');
                        if (_lastBoundaryX)    con.style.right = (window.innerWidth - _lastBoundaryX + (platform.scrollbarOffset || 0)) + 'px';
                    }
                    if (legacyNavOpen) {
                        con.classList.add('open'); b.classList.add('open');
                        if (isLeftChat && _lastBoundaryX) {
                            con.style.right = (window.innerWidth - _lastBoundaryX + 320) + 'px';
                        }
                    }
                    document.body.appendChild(con);
                }
            }, 200);
        }).observe(document.body, { childList: true, subtree: true });

        // ── Initial injection ────────────────────────────────────
        var initPanel = buildLegacyPanel();
        var initBtn   = buildLegacyButton();
        var initCon   = createElement('div', { id: 'ai-nav-button-container' });
        initCon.setAttribute('data-acn-role',    'zone');           // contract attribute
        initCon.setAttribute('data-acn-ui',      'legacy');          // contract attribute
        initCon.setAttribute('data-acn-accent',  theme.accent);     // contract attribute
        initCon.setAttribute('data-acn-version', ACN_VERSION);      // contract attribute
        initCon.appendChild(initBtn);
        if (isLeftChat) {
            initPanel.style.display = 'none';
            initCon.style.display   = 'none';
        }
        document.body.appendChild(initPanel);
        document.body.appendChild(initCon);

        // Populate on first open (also triggered by scan)
        setTimeout(function () {
            scanConversation();
            // if panel is open at load time (shouldn't be, but guard)
            if (legacyNavOpen) legacyRenderPanel();
        }, 2000);
    }

    // ============================================================
    // E3: Slash command detection — open palette when /cmd typed in chat
    // ============================================================
    function setupChatInputSlashDetection() {
        var lastInputEl = null;
        function tryAttach() {
            var el = findChatInput();
            if (!el || el === lastInputEl) return;
            lastInputEl = el;
            el.addEventListener('input', function () {
                var text = (el.value !== undefined ? el.value : el.textContent || '').trim();
                if (text.charAt(0) === '/' && text.length > 1 && text.indexOf(' ') === -1) {
                    var query = text.substring(1);
                    var cmds  = loadCommands();
                    var hasMatch = cmds.some(function (c) { return c.name.indexOf(query) === 0; });
                    if (hasMatch) {
                        if (!isPaletteOpen()) {
                            _paletteInputTriggered = true;
                            openCommandPalette(query);
                        } else if (_paletteInputTriggered) {
                            // Update live filter as user keeps typing
                            var pi = document.getElementById('acn-palette-input');
                            if (pi && pi.value !== query) {
                                pi.value = query;
                                pi.dispatchEvent(new Event('input'));
                            }
                        }
                    } else if (_paletteInputTriggered && isPaletteOpen()) {
                        closeCommandPalette();
                    }
                } else if (_paletteInputTriggered && isPaletteOpen()) {
                    closeCommandPalette();
                }
            });
        }
        tryAttach();
        setInterval(tryAttach, 2000); // re-attach after SPA navigation replaces input
    }

    // ============================================================
    // E4: Panel resize handle — drag left edge to widen/narrow
    // ============================================================
    function addPanelResizeHandles() {
        var ACN_MIN_W = 240;
        var ACN_MAX_W = 640;
        document.querySelectorAll('.acn-panel').forEach(function (panel) {
            var handle = createElement('div', { className: 'acn-resize-handle' });
            handle.addEventListener('mousedown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                handle.classList.add('acn-resizing');
                var prevCursor  = document.body.style.cursor;
                var prevSelect  = document.body.style.userSelect;
                document.body.style.cursor     = 'ew-resize';
                document.body.style.userSelect = 'none';
                function onMove(ev) {
                    var newW = Math.max(ACN_MIN_W, Math.min(ACN_MAX_W, window.innerWidth - ev.clientX));
                    _panelWidth = newW;
                    document.documentElement.style.setProperty('--acn-panel-w', newW + 'px');
                    if (isLeftChat && orbPanel) orbApplyZonePosition();
                }
                function onUp() {
                    handle.classList.remove('acn-resizing');
                    document.body.style.cursor     = prevCursor;
                    document.body.style.userSelect = prevSelect;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup',   onUp);
                    orbSaveSettings();
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup',   onUp);
            });
            panel.appendChild(handle);
        });
    }

    // ============================================================
    // E2: Keyboard listener — Ctrl+/ toggles command palette
    // ============================================================
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            _paletteInputTriggered = false; // Ctrl+/ always uses focused palette
            toggleCommandPalette();
            return;
        }
        if (!isPaletteOpen()) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeCommandPalette();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveSelection(1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveSelection(-1);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            executeSelected();
            return;
        }
    });

    // ============================================================
    // Inject now (body is available — Tampermonkey runs at document-end)
    // ============================================================
    if (useOrbital) {
        injectOrbital();
    } else {
        injectLegacy();
    }

    console.log('AI Conversation Navigator v' + ACN_VERSION + ' loaded for ' + platform.title +
        (isLeftChat ? ' (left-chat mode)' : '') + (useOrbital ? ' [orbital]' : ' [legacy]') + '.');
})();
