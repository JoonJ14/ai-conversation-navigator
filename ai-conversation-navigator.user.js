// ==UserScript==
// @name         AI Conversation Navigator v10.7.11
// @namespace    http://tampermonkey.net/
// @version      10.7.11
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
    var ACN_VERSION = '10.7';

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

    function migrateOldSettings() {
        try {
            var oldSettings = GM_getValue('acn-orb-settings', null);
            if (oldSettings && !GM_getValue('acn-settings', null)) {
                var newSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                if (oldSettings.mode) newSettings.orbMode = oldSettings.mode;
                if (oldSettings.scrollInverted !== undefined) newSettings.scrollInverted = oldSettings.scrollInverted;
                saveSettings(newSettings);
            }
        } catch(e) {}
    }

    // ================================================================
    // PLATFORMS REGISTRY
    // ================================================================
    const PLATFORMS = {
        claude: {
            id: 'claude',
            title: 'Claude',
            match: function (host) { return host.includes('claude.ai'); },
            theme: { accent: '#d97706', accentHover: '#b45309', accentLight: 'rgba(217, 119, 6, 0.2)' },
            icon: '\u2733',
            layout: 'standard',
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
                var messages = document.querySelectorAll('[data-testid="user-human-turn"]');
                if (messages.length === 0) messages = document.querySelectorAll('[data-testid="user-message"]');
                if (messages.length === 0) messages = document.querySelectorAll('.font-user-message');
                if (messages.length === 0) {
                    var bubbles = document.querySelectorAll('div.bg-bg-200.rounded-lg');
                    messages = Array.from(bubbles).filter(function (bubble) {
                        return bubble.closest('.items-end');
                    });
                }
                return messages;
            },
            getAIMessages: function () {
                // Verified starting points — fallback chain
                var messages = document.querySelectorAll('.font-claude-response');
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
            // Claude.ai keeps uploaded image thumbnails in a sibling div, both
            // inside an outer .group turn container. The user-message itself is
            // inside an inner .group bubble. We need the outer (second) .group
            // ancestor so image searches also find uploaded file thumbnails.
            getMessageContext: function (msgEl) {
                var inner = msgEl.closest('.group');
                if (!inner) return msgEl;
                var outer = inner.parentElement ? inner.parentElement.closest('.group') : null;
                return outer || inner;
            },
        },

        chatgpt: {
            id: 'chatgpt',
            title: 'ChatGPT',
            match: function (host) { return host.includes('chatgpt.com') || host.includes('chat.openai.com'); },
            theme: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)' },
            icon: '\u23E3',
            layout: 'standard',
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
        },

        grok: {
            id: 'grok',
            title: 'Grok',
            match: function (host) { return host.includes('grok.com'); },
            theme: { accent: '#dc2626', accentHover: '#b91c1c', accentLight: 'rgba(220, 38, 38, 0.2)' },
            icon: 'X',
            layout: 'standard',
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
        },

        gemini: {
            id: 'gemini',
            title: 'Gemini',
            match: function (host) { return host.includes('gemini.google.com'); },
            theme: { accent: '#4285f4', accentHover: '#3367d6', accentLight: 'rgba(66, 133, 244, 0.2)' },
            icon: '\u2726',
            layout: 'standard',
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
        },

        bolt: {
            id: 'bolt',
            title: 'Bolt',
            match: function (host) { return host === 'bolt.new'; },
            theme: { accent: '#38BDF8', accentHover: '#0EA5E9', accentLight: 'rgba(56, 189, 248, 0.2)' },
            icon: '\u26A1\uFE0E',
            layout: 'left-chat',
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
    // Orbital system only for core AI chat platforms.
    // App-builder platforms keep the legacy ghost-notch / right-edge button.
    var useOrbital = ['claude', 'chatgpt', 'grok', 'gemini', 'perplexity'].indexOf(platform.id) >= 0;

    // Wire up Claude SSE interceptor for exact token tracking
    if (platform.id === 'claude') setupClaudeSSEInterceptor();

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
    // QUESTION DETECTION ENGINE
    // ============================================================
    function getUserMessages() {
        return platform.getUserMessages();
    }

    function getAIMessages() {
        if (platform && platform.getAIMessages) return platform.getAIMessages();
        return [];
    }

    function getAllMessagesOrdered() {
        var userMsgs = Array.from(getUserMessages()).map(function (el) {
            return { element: el, type: 'user' };
        });
        var aiMsgs = Array.from(getAIMessages()).map(function (el) {
            return { element: el, type: 'ai' };
        });
        var all = userMsgs.concat(aiMsgs);
        all.sort(function (a, b) {
            var pos = a.element.compareDocumentPosition(b.element);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });
        return all;
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
    var _bmListFingerprint     = ''; // same guard for bookmarks panel
    var _panelWidth            = 310; // current panel width — persisted in localStorage

    // ── Tier 1: Claude SSE exact token state ──────────────────
    var _sseTokenData = {
        inputTokens:  0,
        outputTokens: 0,
        lastUpdated:  0,
        exact:        false   // true once we have at least one message_start reading
    };
    var _prevInputTokens  = 0;  // input tokens from previous message_start (compaction detect)
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
    var _usageRefreshTimer = null; // debounce timer for maybeRefreshUsage

    function scanConversation(forceReset) {
        var messages = getUserMessages();

        if (isVirtualScroll && !forceReset) {
            if (messages.length === 0) return;
            var addedNew = false;
            messages.forEach(function (msg) {
                var proseEl = platform.textExtractor ? platform.textExtractor(msg) : null;
                var text = proseEl
                    ? (proseEl.textContent || '').trim()
                    : (msg.textContent || msg.innerText || '').trim();
                text = text.replace(/^You said\s*/i, '');
                if (!text.trim()) return;
                var key = text.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
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
                    var proseEl = platform.textExtractor ? platform.textExtractor(msg) : null;
                    var text = proseEl
                        ? (proseEl.textContent || '').trim()
                        : (msg.textContent || msg.innerText || '').trim();
                    text = text.replace(/^You said\s*/i, '');
                    if (!text.trim()) return;
                    if (isVirtualScroll) {
                        var key = text.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
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

        history.pushState = function () {
            _origPushState.apply(this, arguments);
            if (isVirtualScroll) _vsAccumulatedKeys.clear();
            _questions = [];
            if (typeof orbClosePanel === 'function') orbClosePanel();
            setTimeout(scanConversation, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };

        history.replaceState = function () {
            _origReplaceState.apply(this, arguments);
            _questions = [];
            setTimeout(scanConversation, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };

        window.addEventListener('popstate', function () {
            if (isVirtualScroll) _vsAccumulatedKeys.clear();
            _questions = [];
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

    // ── Orbital panel update hook (called by scanConversation) ──
    function orbOnScanComplete() {
        if (orbPanel === 'nav')    orbPopulateNavigate();
        if (orbPanel === 'search') orbPopulateSearch(orbSearchQuery);
        if (platform.id !== 'claude') updateTurnCounter();
        var bmPanel = document.getElementById('acn-panel-bookmarks');
        if (bmPanel && bmPanel.classList.contains('acn-open')) {
            orbRefreshBookmarksPanel();
        }
    }

    // ============================================================
    // SSE INTERCEPTOR — Tier 1 (Claude exact token tracking)
    // ============================================================

    function setupClaudeSSEInterceptor() {
        if (typeof window.fetch !== 'function') return;
        if (window._acnFetchPatched) return; // idempotent
        window._acnFetchPatched = true;

        var _nativeFetch = window.fetch;

        window.fetch = function acnFetchProxy(input, init) {
            var url = (typeof input === 'string') ? input :
                      (input && input.url) ? input.url : '';

            // Only intercept streaming requests to Claude's backend
            var isClaude = url.indexOf('claude.ai') !== -1 ||
                           url.indexOf('/api/organizations') !== -1 ||
                           url.indexOf('/api/append_message') !== -1 ||
                           url.indexOf('/completion') !== -1;

            var result = _nativeFetch.apply(this, arguments);

            if (!isClaude) return result;

            return result.then(function (response) {
                // Only attempt to tap text/event-stream responses
                var ct = response.headers && response.headers.get('content-type');
                if (!ct || ct.indexOf('text/event-stream') === -1) return response;

                // We must clone: the original stream can only be consumed once
                var cloned = response.clone();
                readSSEStream(cloned.body);
                return response;
            });
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

                buffer += decoder.decode(result.value, { stream: true });

                // Split on double-newline (SSE event boundary)
                var parts = buffer.split(/\n\n/);
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
        var lines = eventStr.split('\n');
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

        if (eventType === 'message_start' && payload.message && payload.message.usage) {
            var usage       = payload.message.usage;
            var newInput    = usage.input_tokens  || 0;
            var newOutput   = usage.output_tokens || 0;

            // ── Compaction detection ──────────────────────────────────
            if (_sseTokenData.exact &&
                _prevInputTokens > 2000 &&
                newInput < _prevInputTokens * 0.60) {
                _compactionCount++;
                _compactionHistory.push(_turnCounter.totalTurns);

                _turnCounter.compactionCount = _compactionCount;

                var cycleLen = _turnCounter.turnsSinceCompact;
                if (cycleLen > 0) {
                    _turnCounter.cycleLengths.push(cycleLen);
                    _turnCounter.predictedCycleLength = predictNextCycleLength();
                }
                _turnCounter.turnsSinceCompact = 0;
                _turnCounter.lastCompactTurn   = _turnCounter.totalTurns;
            }

            _prevInputTokens        = newInput;
            _sseTokenData.inputTokens  = newInput;
            _sseTokenData.outputTokens = newOutput;
            _sseTokenData.lastUpdated  = Date.now();
            _sseTokenData.exact        = true;

            orbUpdateContextBar();

        } else if (eventType === 'message_delta' && payload.usage) {
            _sseTokenData.outputTokens = payload.usage.output_tokens || _sseTokenData.outputTokens;
            _sseTokenData.lastUpdated  = Date.now();

            // Debounced plan usage refresh (3 s after last SSE activity)
            if (_usageRefreshTimer) clearTimeout(_usageRefreshTimer);
            _usageRefreshTimer = setTimeout(maybeRefreshUsage, 3000);

            orbUpdateContextBar();
        }
    }

    // ============================================================
    // TURN COUNTER HELPERS (Tier 2 — non-Claude platforms)
    // ============================================================

    function updateTurnCounter() {
        var newTotal = _questions.length;
        if (newTotal <= _turnCounter.totalTurns) return;

        var added = newTotal - _turnCounter.totalTurns;
        _turnCounter.totalTurns        += added;
        _turnCounter.turnsSinceCompact += added;
    }

    function predictNextCycleLength() {
        var cycles = _turnCounter.cycleLengths;
        var n = cycles.length;
        if (n === 0) return null;
        if (n === 1) return cycles[0];

        var totalWeight  = 0;
        var weightedSum  = 0;
        for (var i = 0; i < n; i++) {
            var weight;
            if (i === n - 1)      weight = 0.5;
            else if (i === n - 2) weight = 0.3;
            else                  weight = 0.2 / Math.max(n - 2, 1);
            totalWeight += weight;
            weightedSum += cycles[i] * weight;
        }
        return Math.round(weightedSum / totalWeight);
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

        // Step 1: get org UUID from /api/organizations
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://claude.ai/api/organizations',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
            onload: function (r1) {
                var uuid = null;
                try {
                    var orgs = JSON.parse(r1.responseText);
                    if (Array.isArray(orgs) && orgs[0] && orgs[0].uuid) {
                        uuid = orgs[0].uuid;
                    }
                } catch (e) { /* skip */ }

                if (!uuid) { callback(null); return; }

                // Step 2: fetch usage for that org
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
        fetchClaudeUsage(function (data) {
            _usageData = data;
            var section = document.getElementById('acn-usage-section');
            if (section) renderUsageBars(section, _usageData);
        });
    }

    function formatResetTime(resetsAt) {
        var target;
        try {
            target = (typeof resetsAt === 'number') ? new Date(resetsAt) : new Date(resetsAt);
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
            '.acn-hitzone{position:absolute;right:0;z-index:1;pointer-events:auto}',

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
            '.acn-exp-opt{padding:14px;border-bottom:1px solid rgba(255,255,255,.05);',
            'cursor:pointer;transition:background .12s}',
            '.acn-exp-opt:hover{background:rgba(var(--acn-rgb),.06)}',
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

        var cy   = window.innerHeight / 2;
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

    // ============================================================
    // NAVIGATE PANEL CONTENT
    // ============================================================
    function orbPopulateNavigate() {
        var list  = document.getElementById('acn-nav-list');
        var stat  = document.getElementById('acn-nav-stat');
        if (!list) return;

        // Skip DOM rebuild if questions haven't changed — prevents hover flicker caused
        // by MutationObserver firing on SPA animations and rebuilding the list mid-hover
        var fp = _questions.map(function (q) { return q.text.substring(0, 100); }).join('|');
        if (fp === _navListFingerprint && list.firstChild) return;
        _navListFingerprint = fp;

        // Clear
        while (list.firstChild) list.removeChild(list.firstChild);

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

        // ── Path A: Claude with exact SSE token data ──────────
        if (platform && platform.id === 'claude' && _sseTokenData.exact) {
            var inputTok = _sseTokenData.inputTokens;
            var pctNum   = Math.min(100, Math.round((inputTok / limit) * 100));
            var color    = getBarColor(pctNum);

            var tokFmt   = inputTok.toLocaleString();
            var limFmt   = Math.round(limit / 1000) + 'K';
            pct.textContent  = pctNum + '%';
            pct.style.color  = color;
            fill.style.width      = pctNum + '%';
            fill.style.background = color;

            if (meta) {
                meta.textContent = tokFmt + ' / ' + limFmt + ' tokens (exact)';
                meta.style.color = '#888';
            }

            _renderCompactionInfo(pctNum);
            return;
        }

        // ── Path B: Claude but no SSE data yet ────────────────
        if (platform && platform.id === 'claude') {
            _renderEstimatedBar(pct, fill, meta, limit);
            _renderCompactionInfo(0);
            return;
        }

        // ── Path C: Non-Claude — turn counter ─────────────────
        if (_questions.length === 0) {
            pct.textContent  = '\u2014';
            pct.style.color  = '';
            fill.style.width = '0%';
            if (meta) { meta.textContent = 'No messages detected'; meta.style.color = ''; }
            _removeTurnDots();
            return;
        }

        _renderEstimatedBar(pct, fill, meta, limit);
        _renderTurnDots();
        _renderTurnCompactionInfo();
    }

    function _renderEstimatedBar(pct, fill, meta, limit) {
        var totalChars = 0;
        var anchor = _questions.length > 0 ? _questions[0].element : null;
        var node   = anchor ? anchor.parentElement : null;
        var found  = false;

        while (node && node !== document.body) {
            var st = window.getComputedStyle(node);
            if (st.overflowY === 'auto' || st.overflowY === 'scroll' ||
                st.overflow  === 'auto' || st.overflow  === 'scroll') {
                totalChars = (node.innerText || '').length;
                found = true;
                break;
            }
            node = node.parentElement;
        }

        if (!found || totalChars === 0) {
            totalChars = _questions.reduce(function (s, q) { return s + q.text.length; }, 0) * 3;
        }

        // Correct for virtual scroll: if _questions has more entries than are currently in
        // the DOM, the innerText only covers the live DOM portion — scale up accordingly.
        var nInDOM   = _questions.filter(function(q) { return q.element && document.body.contains(q.element); }).length;
        var coverage = nInDOM / Math.max(1, _questions.length);
        var estTokens = Math.round((totalChars / 4) / Math.max(0.25, coverage));

        // For Claude: add invisible overhead that DOM scraping can never see.
        // (1) System prompt — claude.ai injects ~15K tokens of system context always.
        // (2) Extended thinking — each collapsed [aria-expanded] thinking summary in the
        //     conversation represents hidden thinking content (~600 tokens each on average).
        if (platform && platform.id === 'claude' && found && node) {
            estTokens += 15000;
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

    function orbScrollToQuestion(q) {
        var target = q.element;

        // Virtual scroll: element may have been recycled — try to re-find it
        if (isVirtualScroll && target && !target.isConnected) {
            var searchText = q.text.substring(0, 200);
            var current = getUserMessages();
            var found = null;
            for (var i = 0; i < current.length; i++) {
                if ((current[i].textContent || '').trim().substring(0, 200) === searchText) {
                    found = current[i];
                    break;
                }
            }
            if (!found) return; // not in DOM right now
            target = found;
        }

        if (!target) return;

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

    function orbFlashElement(el) {
        var orig = el.style.backgroundColor;
        el.style.backgroundColor = 'rgba(' + orbTheme.rgb + ',.15)';
        el.style.transition = 'background-color .3s';
        setTimeout(function () { el.style.backgroundColor = orig; }, 1500);
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
            var sfp = q + '|' + _questions.length + '|' + (_aiResponses ? _aiResponses.length : 0);
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
        var aiMatches = [];
        if (typeof _aiResponses !== 'undefined') {
            _aiResponses.forEach(function (el, idx) {
                var text = (el.textContent || '').trim();
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

        // Sort all matches by DOM position
        allMatches.sort(function (a, b) {
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
                    } else {
                        orbScrollToMessage(m.element);
                    }
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
        var ctxLabel = createElement('span', { className: 'acn-ctx-l', textContent: 'Context window' });
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
    }

    function _bmGenId() {
        return 'bm_' + Math.random().toString(16).substring(2, 10);
    }

    function toggleBookmark(entityId, entityType, entityEl, msgIndex) {
        var existing = getConversationBookmarks().filter(function (b) {
            return b.contentHash === entityId;
        });

        var icon = entityEl.querySelector('[data-acn-bookmark]');

        if (existing.length > 0) {
            existing.forEach(function (b) { removeBookmark(b.id); });
            if (icon) icon.classList.remove('acn-bm-active');
            showToast(i18n('bookmarkRemoved'));
        } else {
            var text    = (entityEl.textContent || '').trim();
            var preview = text.substring(0, 120);
            var bm = {
                id:          _bmGenId(),
                entityType:  entityType,
                contentHash: entityId,
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

    function createBookmarkIcon(entityEl, entityType, entityId, msgIndex) {
        if (entityEl.querySelector('[data-acn-bookmark]')) return;

        var computed = window.getComputedStyle(entityEl);
        if (computed.position === 'static') {
            entityEl.style.position = 'relative';
        }

        var bookmarks    = getConversationBookmarks();
        var isBookmarked = bookmarks.some(function (b) { return b.contentHash === entityId; });

        var icon = document.createElement('div');
        icon.className = 'acn-bm-icon' + (isBookmarked ? ' acn-bm-active' : '');
        icon.textContent = '\u2691';
        icon.setAttribute('data-acn-bookmark', entityId);
        icon.setAttribute('title', isBookmarked ? 'Remove bookmark' : 'Bookmark this message');

        icon.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleBookmark(entityId, entityType, entityEl, msgIndex);
            var nowBookmarked = getConversationBookmarks().some(function (b) {
                return b.contentHash === entityId;
            });
            icon.setAttribute('title', nowBookmarked ? 'Remove bookmark' : 'Bookmark this message');
        });

        entityEl.appendChild(icon);
    }

    function injectBookmarkIcons() {
        var userEls = Array.from(getUserMessages());
        userEls.forEach(function (el, idx) {
            if (el.getAttribute('data-acn-bookmarked') === 'u') return;
            el.setAttribute('data-acn-bookmarked', 'u');
            var text = (el.textContent || '').trim();
            var hash = contentHash(text, idx);
            createBookmarkIcon(el, 'user-msg', hash, idx);
        });

        var aiEls = Array.from(getAIMessages());
        aiEls.forEach(function (el, idx) {
            if (el.getAttribute('data-acn-bookmarked') === 'a') return;
            el.setAttribute('data-acn-bookmarked', 'a');
            var text = (el.textContent || '').trim();
            var hash = contentHash(text, idx);
            createBookmarkIcon(el, 'ai-msg', hash, idx);
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

        if (bookmark.entityType === 'user-msg') {
            var userEls = Array.from(getUserMessages());
            for (var i = 0; i < userEls.length; i++) {
                var text = (userEls[i].textContent || '').trim();
                if (contentHash(text, i) === bookmark.contentHash) {
                    targetEl = userEls[i];
                    break;
                }
            }
            if (!targetEl && userEls[bookmark.msgIndex]) {
                targetEl = userEls[bookmark.msgIndex];
            }
        } else if (bookmark.entityType === 'ai-msg') {
            var aiEls = Array.from(getAIMessages());
            for (var j = 0; j < aiEls.length; j++) {
                var aiText = (aiEls[j].textContent || '').trim();
                if (contentHash(aiText, j) === bookmark.contentHash) {
                    targetEl = aiEls[j];
                    break;
                }
            }
            if (!targetEl && aiEls[bookmark.msgIndex]) {
                targetEl = aiEls[bookmark.msgIndex];
            }
        }

        if (!targetEl) {
            showToast('Message not found \u2014 it may have been deleted');
            return;
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
            '.acn-map-segment{position:relative;padding:8px 12px;margin:0 0 2px 16px;',
            'border-left:3px solid var(--acn-accent);background:rgba(var(--acn-rgb),0.05);',
            'border-radius:0 6px 6px 0;cursor:pointer;transition:background 0.15s ease}',
            '.acn-map-segment:hover{background:rgba(var(--acn-rgb),0.12)}',
            '.acn-map-label{font-size:13px;font-weight:600;color:var(--acn-accent);margin-bottom:4px}',
            '.acn-map-range{font-size:11px;color:#888;float:right}',
            '.acn-map-entity{font-size:11px;color:#aaa;padding:1px 0;cursor:pointer}',
            '.acn-map-entity:hover{color:#fff}',
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
        { re: /\b(let me|i('ll| will)|going to|i'm going to|plan to)\b/i,                               type: 'action' },
        { re: /\b(try|attempt|run|execute|install|update|add|remove|delete|replace|create|build)\b/i,    type: 'action' },
        { re: /\b(found|discovered|noticed|realized|turns out|it turns out|appears that|seems like)\b/i, type: 'finding' },
        { re: /\b(the (bug|issue|problem|error|cause) (is|was)|root cause|actually)\b/i,                type: 'finding' },
        { re: /\b(important(ly)?|note that|keep in mind|worth noting|caveat|warning|caution)\b/i,       type: 'finding' },
        { re: /\b(because|reason|why|explanation|this (means|is why|causes))\b/i,                      type: 'finding' }
    ];

    var SEGMENT_ICON_MAP = [
        { keywords: ['bug','error','fix','broken','crash','fail','issue','problem'],  icon: 'BUG'    },
        { keywords: ['setup','install','config','configure','environment','init'],    icon: 'SETUP'  },
        { keywords: ['code','function','class','variable','refactor','implement'],    icon: 'CODE'   },
        { keywords: ['design','ui','ux','layout','style','css','color','theme'],      icon: 'DESIGN' },
        { keywords: ['test','spec','assert','expect','mock','coverage','unit'],       icon: 'TEST'   },
        { keywords: ['deploy','build','ci','cd','pipeline','release','publish'],      icon: 'DEPLOY' },
        { keywords: ['data','database','schema','query','sql','api','endpoint'],      icon: 'DATA'   },
        { keywords: ['doc','document','readme','comment','explain','description'],    icon: 'DOCS'   },
        { keywords: ['plan','roadmap','idea','feature','proposal','strategy'],        icon: 'PLAN'   }
    ];

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

        for (var i = 0; i < sorted.length && result.length < 15; i++) {
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
                return s.trim().length > 20;
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

        return _sumDeduplicatePoints(points).slice(0, 20);
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
            if (!el) return;

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

        questions.forEach(function (q, i) {
            all.push({ element: q.element, text: q.text || '', type: 'user', srcIndex: i });
        });
        aiResponses.forEach(function (r, i) {
            all.push({ element: r.element, text: r.text || '', type: 'ai',   srcIndex: i });
        });

        all.sort(function (a, b) {
            if (!a.element || !b.element) return 0;
            try {
                var pos = a.element.compareDocumentPosition(b.element);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            } catch (e) {}
            return 0;
        });

        all.forEach(function (m, i) { m.globalIdx = i; });
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

    function _sumGetSegmentIcon(segment) {
        var topics = (segment.topics || []).join(' ').toLowerCase();
        var text   = (segment.messages || []).map(function (m) { return m.text || ''; }).join(' ').toLowerCase();
        var combined = topics + ' ' + text;

        for (var i = 0; i < SEGMENT_ICON_MAP.length; i++) {
            var entry = SEGMENT_ICON_MAP[i];
            for (var j = 0; j < entry.keywords.length; j++) {
                if (combined.indexOf(entry.keywords[j]) !== -1) return entry.icon;
            }
        }
        return 'MSG';
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

    var _SEGMENT_WINDOW = 4;

    function _sumGetWindowSize(totalMessages) {
        if (totalMessages < 4)   return totalMessages || 1;
        if (totalMessages > 100) return 6;
        return _SEGMENT_WINDOW;
    }

    function _sumMergeExcessSegments(segments) {
        while (segments.length > 12) {
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
            var merged = {
                startIdx:  a.startIdx,
                endIdx:    b.endIdx,
                messages:  a.messages.concat(b.messages),
                topics:    _sumMergeTopics(a.topics, b.topics),
                entities:  a.entities.concat(b.entities),
                label:     ''
            };
            merged.label = _sumGenerateSegmentLabel(merged);
            segments.splice(mergeIdx, 2, merged);
        }
        return segments;
    }

    function _sumBuildConversationMap(questions, aiResponses) {
        var timeline = _sumBuildTimeline(questions, aiResponses);
        if (!timeline.length) return [];

        var windowSize = _sumGetWindowSize(timeline.length);
        var segments   = [];

        for (var i = 0; i < timeline.length; i += windowSize) {
            var slice    = timeline.slice(i, i + windowSize);
            var combined = slice.map(function (m) { return m.text; }).join(' ');
            var topics   = _sumExtractTopicsFromText(combined, 5);
            var entities = _sumScanEntities(slice);

            var seg = {
                startIdx: i,
                endIdx:   Math.min(i + windowSize - 1, timeline.length - 1),
                messages: slice,
                topics:   topics,
                entities: entities,
                label:    ''
            };
            seg.label = _sumGenerateSegmentLabel(seg);
            segments.push(seg);
        }

        return _sumMergeExcessSegments(segments);
    }

    function generateFullSummary() {
        var aiMsgs = Array.from(getAIMessages()).map(function (el) {
            return { element: el, text: (el.textContent || el.innerText || '').trim(), type: 'ai' };
        });

        return {
            map:       _sumBuildConversationMap(_questions, aiMsgs),
            topics:    _sumExtractTopics(_questions, aiMsgs),
            keyPoints: _sumExtractKeyPoints(_questions, aiMsgs),
            stats:     _sumGenerateStats(_questions, aiMsgs),
            inventory: _sumInventoryCodeAndFiles(aiMsgs)
        };
    }

    // Expose globally for Group E2 cross-module access
    window.generateFullSummary = generateFullSummary;

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

        mapData.forEach(function (seg) {
            var icon      = _sumGetSegmentIcon(seg);
            var rangeText = 'Msgs ' + (seg.startIdx + 1) + '-' + (seg.endIdx + 1);

            var rangeEl = createElement('div', { className: 'acn-map-range', textContent: rangeText });
            var labelEl = createElement('div', { className: 'acn-map-label', textContent: icon + '  ' + seg.label });
            var segEl   = createElement('div', { className: 'acn-map-segment' }, [rangeEl, labelEl]);

            if (seg.topics.length) {
                var pillWrap = createElement('div', { className: 'acn-topic-pills', style: 'margin-top:4px;margin-bottom:2px' });
                seg.topics.slice(0, 3).forEach(function (t) {
                    pillWrap.appendChild(createElement('span', { className: 'acn-topic-pill', textContent: t }));
                });
                segEl.appendChild(pillWrap);
            }

            seg.entities.slice(0, 4).forEach(function (ent) {
                var entEl = createElement('div', { className: 'acn-map-entity', textContent: ent.icon + ' ' + ent.label });
                entEl.addEventListener('click', function (e) {
                    e.stopPropagation();
                    _sumScrollToElement(ent.element);
                });
                segEl.appendChild(entEl);
            });

            segEl.addEventListener('click', function () {
                var firstMsg = seg.messages && seg.messages[0];
                if (firstMsg) _sumScrollToElement(firstMsg.element);
            });

            body.appendChild(segEl);
        });

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
        container.appendChild(_sumRenderKeyPoints(summaryData.keyPoints));
        container.appendChild(_sumRenderConversationMap(summaryData.map));
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
        var userMsgs = platform.getUserMessages ? Array.from(platform.getUserMessages()) : [];
        var aiMsgs   = platform.getAIMessages   ? Array.from(platform.getAIMessages())   : [];
        var seenImgs = [];  // dedup tracker

        // User messages — use broader context if platform provides one
        // (claude.ai keeps uploaded image thumbnails in a sibling div, not inside user-message)
        userMsgs.forEach(function (msgEl, idx) {
            var contextEl = (platform.getMessageContext ? platform.getMessageContext(msgEl) : null) || msgEl;
            var imgs = contextEl.querySelectorAll('img');
            imgs.forEach(function (img) {
                if (seenImgs.indexOf(img) !== -1) return;
                if (!isContentImage(img)) return;
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
            var imgs = msgEl.querySelectorAll('img');
            imgs.forEach(function (img) {
                if (seenImgs.indexOf(img) !== -1) return;
                if (!isContentImage(img)) return;
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
            label.textContent = imgData.isUserMsg
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
            navBtn.addEventListener('click', (function (data) {
                return function (e) {
                    e.stopPropagation();
                    data.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    data.msgElement.classList.add('acn-highlight-flash');
                    setTimeout(function () { data.msgElement.classList.remove('acn-highlight-flash'); }, 1500);
                };
            })(imgData));
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
            thumb.addEventListener('click', (function (data) {
                return function () {
                    data.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    data.msgElement.classList.add('acn-highlight-flash');
                    setTimeout(function () { data.msgElement.classList.remove('acn-highlight-flash'); }, 1500);
                };
            })(imgData));
            card.appendChild(thumb);
            card.appendChild(label);
            card.appendChild(actions);
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    function buildTimeline(questions, aiMsgs) {
        var items = [];
        questions.forEach(function (q) {
            if (q.element) items.push({ type: 'user', element: q.element });
        });
        aiMsgs.forEach(function (el) {
            items.push({ type: 'ai', element: el });
        });
        items.sort(function (a, b) {
            if (a.element === b.element) return 0;
            var pos = a.element.compareDocumentPosition(b.element);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING)  return 1;
            return 0;
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
            var chromeFragments = ['copy-button', 'action-bar', 'toolbar', 'btn', 'button',
                                   'avatar', 'feedback', 'thumb', 'vote', 'tooltip'];
            for (var i = 0; i < chromeFragments.length; i++) {
                if (cls.indexOf(chromeFragments[i]) !== -1) return true;
            }
            return false;
        }
        var walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            null,
            false
        );
        var node = walker.nextNode();
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && isUIChrome(node)) {
                node = walker.nextNode();
                continue;
            }
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

    function exportFullConversation() {
        try {
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
        zone.setAttribute('data-acn-accent',   orbTheme.bg);   // platform hex color
        zone.setAttribute('data-acn-version',  '10.0');
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

        return zone;
    }

    // ============================================================
    // HITZONE GEOMETRY — computes tight hitzone bounds from dot stack
    // ============================================================
    function orbUpdateHitzone() {
        var hitzone = document.getElementById('acn-hitzone');
        if (!hitzone) return;

        // Vertical center of viewport (mirrors orbRender's `cy` computation)
        var cy = window.innerHeight / 2;

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

        // Width: from right edge inward far enough to cover the widest dot
        var hitzoneWidth = ORB_CX + 24 + HITZONE_PAD_X;

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
                            return (m.textContent || '').trim().startsWith((q.text || '').substring(0, 60));
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
                    con.setAttribute('data-acn-accent', theme.accent);
                    con.setAttribute('data-acn-version', '10.0');
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
        initCon.setAttribute('data-acn-accent',  theme.accent);     // contract attribute
        initCon.setAttribute('data-acn-version', '10.0');           // contract attribute
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

    console.log('AI Conversation Navigator v10.7 loaded for ' + platform.title +
        (isLeftChat ? ' (left-chat mode)' : '') + (useOrbital ? ' [orbital]' : ' [legacy]') + '.');
})();
