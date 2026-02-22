// ==UserScript==
// @name         AI Conversation Navigator v10.0
// @namespace    http://tampermonkey.net/
// @version      10.0
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
// ==/UserScript==

(function () {
    'use strict';

    // === DUPLICATE EXECUTION GUARD ===
    if (window._aiNavAlreadyLoaded) {
        console.log('AI Nav: Script already loaded, skipping duplicate execution.');
        return;
    }
    window._aiNavAlreadyLoaded = true;

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
        },

        v0: {
            id: 'v0',
            title: 'V0',
            match: function (host) { return host.includes('v0.app'); },
            theme: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)' },
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
            orbClosePanel();
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
            orbClosePanel();
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
        chatgpt:        { bg: '#10a37f', rgb: '16,163,127',  shadow: 'rgba(16,163,127,.25)' },
        grok:           { bg: '#e53e3e', rgb: '229,62,62',   shadow: 'rgba(229,62,62,.25)' },
        gemini:         { bg: '#4285f4', rgb: '66,133,244',  shadow: 'rgba(66,133,244,.25)' },
        perplexity:     { bg: '#20b2aa', rgb: '32,178,170',  shadow: 'rgba(32,178,170,.25)' },
    };
    // App builders use Claude orange
    var orbTheme = ORB_COLORS[platform.id] || ORB_COLORS.claude;

    // ── Feature registry ────────────────────────────────────────
    var ORB_FEATURES = [
        { id: 'nav',       icon: '\u2733', label: 'Navigate',  panelId: 'acn-panel-nav' },
        { id: 'search',    icon: '\u2315', label: 'Search',    panelId: 'acn-panel-search' },
        { id: 'bookmarks', icon: '\u2691', label: 'Bookmarks', panelId: 'acn-panel-bookmarks' },
        { id: 'summary',   icon: '\u03A3', label: 'Summary',   panelId: 'acn-panel-summary' },
        { id: 'export',    icon: '\u2197', label: 'Export',    panelId: 'acn-panel-export' },
        { id: 'settings',  icon: '\u2699', label: 'Settings',  panelId: 'acn-panel-settings' },
    ];
    var ORB_N    = ORB_FEATURES.length;  // 6
    var ORB_MAIN = 0;                     // Navigate is always index 0
    var ORB_CX   = 42;                    // center axis from right edge (px)

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
            orbMode           = saved.mode    || 'show-all';
            orbScrollInverted = saved.natural === true;
        } catch (e) {}
    }
    function orbSaveSettings() {
        try {
            localStorage.setItem('_acnv10', JSON.stringify({
                mode:    orbMode,
                natural: orbScrollInverted,
            }));
        } catch (e) {}
    }

    // ── Orbital panel update hook (called by scanConversation) ──
    function orbOnScanComplete() {
        if (orbPanel === 'nav')    orbPopulateNavigate();
        if (orbPanel === 'search') orbPopulateSearch(orbSearchQuery);
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
            '.acn-zone{position:fixed;right:0;top:0;bottom:0;width:160px;z-index:2147483640;transition:right .3s cubic-bezier(.4,0,.2,1)}',
            '.acn-zone.acn-hp{right:310px}',
            '.acn-hitzone{position:absolute;right:0;top:0;bottom:0;width:160px;z-index:1}',

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

            // Hover label
            '.acn-lbl{position:absolute;right:calc(100% + 10px);font-size:10px;font-weight:600;',
            'color:var(--acn-accent);white-space:nowrap;opacity:0;',
            'transition:opacity .15s,transform .15s;transform:translateX(4px);',
            'pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.5)}',
            '.acn-dot:hover .acn-lbl,.acn-dot.acn-act .acn-lbl{opacity:1;transform:translateX(0)}',

            // Connectors (Show All mode)
            '.acn-conn{position:absolute;width:1px;z-index:2;pointer-events:none;',
            'transition:all .3s;opacity:0}',
            '.acn-conn.acn-vis{opacity:1}',

            // Wheel hint
            '.acn-whint{position:absolute;right:18px;font-size:9px;color:#555;text-align:center;',
            'width:36px;pointer-events:none;opacity:0;transition:opacity .3s}',
            '.acn-whint.acn-vis{opacity:1}',
            '@keyframes acn-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}',
            '.acn-whint span{display:block;animation:acn-bounce 1.5s ease-in-out infinite}',

            // Panel — slides from right
            '.acn-panel{position:fixed;right:0;top:0;bottom:0;width:310px;',
            'background:#1a1a1a;border-left:1px solid #2a2a2a;',
            'transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);',
            'display:flex;flex-direction:column;overflow:hidden;',
            'z-index:2147483639;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
            'color:#e5e5e5;user-select:none}',
            '.acn-panel.acn-open{transform:translateX(0)}',

            // Panel header
            '.acn-ph{padding:12px 14px;display:flex;justify-content:space-between;',
            'align-items:center;border-bottom:1px solid #2a2a2a;flex-shrink:0}',
            '.acn-ph h3{font-size:13px;font-weight:600;margin:0;color:#fff}',
            '.acn-xb{font-size:10px;background:rgba(255,255,255,.06);border:none;color:#888;',
            'padding:4px 10px;border-radius:5px;cursor:pointer;font-family:inherit}',
            '.acn-xb:hover{background:rgba(255,255,255,.12);color:#ccc}',

            // Context bar (Navigate panel)
            '.acn-ctx{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}',
            '.acn-ctx-r{display:flex;justify-content:space-between;margin-bottom:5px}',
            '.acn-ctx-l{font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;font-weight:500}',
            '.acn-ctx-pct{font-family:monospace;font-size:10px;font-weight:600}',
            '.acn-ctx-bar{height:4px;background:#222;border-radius:2px;overflow:hidden}',
            '.acn-ctx-fill{height:100%;border-radius:2px;transition:width .5s,background .5s}',
            '.acn-ctx-meta{font-size:8px;color:#444;margin-top:3px}',

            // Stats + question list
            '.acn-pstat{padding:7px 14px;font-size:10px;color:#777;',
            'border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}',
            '.acn-ql{flex:1;overflow-y:auto;padding:2px 0}',
            '.acn-ql::-webkit-scrollbar{width:4px}',
            '.acn-ql::-webkit-scrollbar-track{background:transparent}',
            '.acn-ql::-webkit-scrollbar-thumb{background:#333;border-radius:2px}',
            '.acn-qi{padding:9px 14px;border-left:2px solid transparent;cursor:pointer;transition:all .12s}',
            '.acn-qi:hover{background:rgba(var(--acn-rgb),.06);border-left-color:var(--acn-accent)}',
            '.acn-qn{font-size:9px;font-weight:600;color:var(--acn-accent);margin-bottom:2px}',
            '.acn-qt{font-size:11px;color:#999;line-height:1.35;',
            'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
            '.acn-qw{font-size:9px;color:#444;margin-top:2px}',
            '.acn-empty{padding:40px 14px;text-align:center;font-size:11px;color:#555;line-height:1.6}',

            // Search input
            '.acn-search-wrap{padding:14px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}',
            '.acn-si{width:100%;padding:9px 11px;background:#222;border:1px solid #333;',
            'border-radius:7px;color:#ddd;font-size:12px;font-family:inherit;outline:none;box-sizing:border-box}',
            '.acn-si:focus{border-color:var(--acn-accent)}',
            '.acn-si::placeholder{color:#555}',
            '.acn-sh{margin-top:8px;font-size:10px;color:#444;text-align:center}',
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
            '.acn-plat-name{font-size:11px;color:#aaa;flex:1}',
            '.acn-reset-btn{width:100%;padding:10px;background:rgba(239,68,68,.08);',
            'border:1px solid rgba(239,68,68,.2);border-radius:7px;color:#ef4444;font-size:11px;',
            'font-weight:600;font-family:inherit;cursor:pointer;margin-top:4px}',
            '.acn-reset-btn:hover{background:rgba(239,68,68,.15)}',
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
        var sp = 42;
        // Compute above/below split dynamically from ORB_N
        var nSats  = ORB_N - 1;
        var nAbove = Math.floor(nSats / 2);
        var above  = [], below  = [];
        for (var i = 1; i <= nAbove; i++) above.push(i);
        for (var i = nAbove + 1; i < ORB_N; i++) below.push(i);

        // Navigate — always visible, rounded square
        orbDots[ORB_MAIN].style.background = orbTheme.bg;
        orbSd(orbDots[ORB_MAIN], {
            w: 42, h: 42, fs: 17,
            right: ORB_CX - 21, top: cy - 21,
            rad: '13px', op: 1, click: true, shad: true,
        });

        // Satellites — same platform color, circles, fade on hover
        above.forEach(function (idx, i) {
            orbDots[idx].style.background = orbTheme.bg;
            var y = cy - (i + 1) * sp;
            orbSd(orbDots[idx], {
                w: 28, h: 28, fs: 12,
                right: ORB_CX - 14, top: y - 14,
                rad: '50%', op: show ? 1 : 0, click: show, shad: false,
            });
        });

        below.forEach(function (idx, i) {
            orbDots[idx].style.background = orbTheme.bg;
            var y = cy + (i + 1) * sp;
            orbSd(orbDots[idx], {
                w: 28, h: 28, fs: 12,
                right: ORB_CX - 14, top: y - 14,
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
        { op: 1.0,  size: 30, fs: 13 },  // slot 0: focus
        { op: 0.65, size: 26, fs: 11 },  // slot ±1: adjacent
        { op: 0.40, size: 22, fs: 10 },  // slot ±2: far
        { op: 0.25, size: 20, fs: 9  },  // slot ±3+: distant
    ];

    function orbRenderArc(cy, show) {
        // Navigate — always at center
        orbDots[ORB_MAIN].style.background = orbTheme.bg;
        orbSd(orbDots[ORB_MAIN], {
            w: 42, h: 42, fs: 17,
            right: ORB_CX - 21, top: cy - 21,
            rad: '13px', op: 1, click: true, shad: true,
        });

        var sats   = [];
        for (var i = 0; i < ORB_N; i++) { if (i !== ORB_MAIN) sats.push(i); }
        var nS     = sats.length;
        var radius = 76;

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
        { size: 42, fs: 17, op: 1.0  },  // slot 0: center (active)
        { size: 28, fs: 12, op: 0.50 },  // slot ±1: adjacent
        { size: 20, fs: 9,  op: 0.18 },  // slot ±2: far
        // slot ±3+: invisible
    ];
    var WHEEL_HIDDEN = { size: 14, fs: 7, op: 0 };
    var NAV_BOOST    = 0.15;  // additive opacity for Navigate when off-center

    function orbRenderWheel(cy, show) {
        var sp = 48;

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
            rad: isCenter ? '13px' : '50%',
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
        zone.style.right = (base + (orbPanel ? 310 : 0)) + 'px';

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

        // Close existing panel first
        document.querySelectorAll('.acn-panel').forEach(function (p) {
            p.classList.remove('acn-open');
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
        if (fid === 'nav')    orbPopulateNavigate();
        if (fid === 'search') {
            orbPopulateSearch('');
            setTimeout(function () {
                var si = document.getElementById('acn-search-input');
                if (si) si.focus();
            }, 350);
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
            textEl.setAttribute('data-acn-role', 'nav-item-text');
            var metaEl = createElement('div', { className: 'acn-qw', textContent: words + ' words' });
            var item   = createElement('div', { className: 'acn-qi' }, [numEl, textEl, metaEl]);
            item.setAttribute('data-acn-role', 'nav-item');

            item.addEventListener('click', function () {
                orbScrollToQuestion(q);
            });

            list.appendChild(item);
        });
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
        orbSearchQuery = query || '';
        var list = document.getElementById('acn-search-list');
        var hint = document.getElementById('acn-search-hint');
        if (!list) return;

        while (list.firstChild) list.removeChild(list.firstChild);

        var q = orbSearchQuery.trim();

        if (!q) {
            if (hint) {
                hint.style.display = '';
                hint.textContent = 'Search through your conversation';
            }
            return;
        }

        if (hint) hint.style.display = 'none';

        var qLower   = q.toLowerCase();
        var matches  = _questions.filter(function (msg) {
            return msg.text.toLowerCase().indexOf(qLower) !== -1;
        });

        if (matches.length === 0) {
            var empty = createElement('div', { className: 'acn-empty',
                textContent: 'No matches for "' + q + '"' });
            list.appendChild(empty);
            return;
        }

        matches.forEach(function (msg, idx) {
            var text  = msg.text;
            var lower = text.toLowerCase();
            var pos   = lower.indexOf(qLower);
            var start = Math.max(0, pos - 40);
            var end   = Math.min(text.length, pos + q.length + 40);

            var pre  = (start > 0 ? '...' : '') + text.substring(start, pos);
            var hit  = text.substring(pos, pos + q.length);
            var post = text.substring(pos + q.length, end) + (end < text.length ? '...' : '');

            var numEl  = createElement('div', { className: 'acn-qn',
                textContent: 'Q#' + (_questions.indexOf(msg) + 1) });
            var mark   = createElement('span', { className: 'acn-smatch', textContent: hit });
            var textEl = createElement('div', { className: 'acn-qt' }, [
                document.createTextNode(pre),
                mark,
                document.createTextNode(post),
            ]);
            var item = createElement('div', { className: 'acn-qi' }, [numEl, textEl]);

            item.addEventListener('click', function () { orbScrollToQuestion(msg); });
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

        panel.appendChild(orbBuildPanelHeader('\u2733 Navigate'));

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
        panel.appendChild(orbBuildPanelHeader('\u2315 Search'));

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

    function orbBuildPanelBookmarks() {
        var panel = createElement('div', { id: 'acn-panel-bookmarks', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\u2691 Bookmarks'));

        var stat = createElement('div', { className: 'acn-pstat', textContent: '3 bookmarks' });
        panel.appendChild(stat);

        var list = createElement('div', { className: 'acn-ql' });

        var items = [
            { type: '\uD83D\uDCCC Response', text: 'The context window for Claude is 200K tokens...', meta: 'Msg #14' },
            { type: '\uD83D\uDCCC Question', text: 'Difference between context tracking and rate limit tracking?', meta: 'Msg #8' },
            { type: '\uD83D\uDCCC Code', text: 'function estimateContextUsage() { const messages = getAll()...', meta: 'Msg #22' },
        ];

        items.forEach(function (item) {
            var typeEl = createElement('div', { className: 'acn-bk-type', textContent: item.type });
            var textEl = createElement('div', { className: 'acn-bk-text', textContent: item.text });
            var metaEl = createElement('div', { className: 'acn-bk-meta', textContent: item.meta });
            list.appendChild(createElement('div', { className: 'acn-bk' }, [typeEl, textEl, metaEl]));
        });

        panel.appendChild(list);
        return panel;
    }

    function orbBuildPanelSummary() {
        var panel = createElement('div', { id: 'acn-panel-summary', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\u03A3 Summary'));

        var scroll = createElement('div', { style: 'flex:1;overflow-y:auto' });

        // Topics
        var topicsSec   = createElement('div', { className: 'acn-sum-sec' });
        topicsSec.appendChild(createElement('div', { className: 'acn-sum-title', textContent: 'Topics' }));
        ['Orbital UI', 'Navigation', 'Conversation'].forEach(function (t) {
            topicsSec.appendChild(createElement('span', { className: 'acn-sum-topic', textContent: t }));
        });
        scroll.appendChild(topicsSec);

        // Key points
        var keysSec = createElement('div', { className: 'acn-sum-sec' });
        keysSec.appendChild(createElement('div', { className: 'acn-sum-title', textContent: 'Key Points' }));
        ['→', '→'].forEach(function (b, i) {
            var bullet = createElement('span', { className: 'acn-sum-bullet', textContent: b });
            var text   = createElement('span', null,
                [i === 0 ? 'Navigate between user questions' : 'Search conversation content']);
            keysSec.appendChild(createElement('div', { className: 'acn-sum-action' }, [bullet, text]));
        });
        scroll.appendChild(keysSec);

        // Generate button
        var genSec = createElement('div', { className: 'acn-sum-sec' });
        var genBtn = createElement('button', { className: 'acn-gen-btn',
            textContent: '\u21BB Generate Summary' });
        genSec.appendChild(genBtn);
        scroll.appendChild(genSec);

        panel.appendChild(scroll);
        return panel;
    }

    function orbBuildPanelExport() {
        var panel = createElement('div', { id: 'acn-panel-export', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\u2197 Export'));

        var opts = [
            { icon: '\uD83D\uDCC4', title: 'Full Conversation', desc: 'Markdown with all messages and code blocks.' },
            { icon: '\uD83D\uDCCC', title: 'Bookmarks Only',    desc: 'Pinned messages as structured document.' },
            { icon: '\uD83D\uDCCB', title: 'Summary',           desc: 'Topics, decisions, and action items.' },
            { icon: '\uD83D\uDD17', title: 'Share Link',        desc: 'Copy shareable link (platform dependent).' },
        ];

        opts.forEach(function (opt) {
            var iconEl  = createElement('div', { className: 'acn-exp-icon',  textContent: opt.icon });
            var titleEl = createElement('div', { className: 'acn-exp-title', textContent: opt.title });
            var descEl  = createElement('div', { className: 'acn-exp-desc',  textContent: opt.desc });
            panel.appendChild(createElement('div', { className: 'acn-exp-opt' }, [iconEl, titleEl, descEl]));
        });

        return panel;
    }

    function orbBuildPanelSettings() {
        var panel  = createElement('div', { id: 'acn-panel-settings', className: 'acn-panel' });
        panel.appendChild(orbBuildPanelHeader('\u2699 Settings'));

        var scroll = createElement('div', { className: 'acn-set-scroll' });

        // ── Display group ──
        var dispGroup = createElement('div', { className: 'acn-set-group' });
        dispGroup.appendChild(createElement('div', { className: 'acn-set-gtitle', textContent: 'Display' }));

        // Mode selector
        var modeSel = createElement('select', { id: 'acn-mode-sel', className: 'acn-set-sel' });
        [['show-all', 'Show all'], ['arc', 'Arc'], ['wheel', 'Wheel']].forEach(function (opt) {
            var o = createElement('option', { value: opt[0] }, [opt[1]]);
            if (opt[0] === orbMode) o.setAttribute('selected', '');
            modeSel.appendChild(o);
        });
        modeSel.addEventListener('change', function () { orbSetMode(modeSel.value); });
        dispGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
            createElement('div', { className: 'acn-set-label', textContent: 'Orbital mode' }),
            modeSel,
        ]));

        // Scroll direction
        var dirSel = createElement('select', { id: 'acn-dir-sel', className: 'acn-set-sel' });
        [['standard', 'Standard'], ['natural', 'Natural']].forEach(function (opt) {
            var o = createElement('option', { value: opt[0] }, [opt[1]]);
            if ((opt[0] === 'natural') === orbScrollInverted) o.setAttribute('selected', '');
            dirSel.appendChild(o);
        });
        dirSel.addEventListener('change', function () {
            orbScrollInverted = dirSel.value === 'natural';
            orbSaveSettings();
        });
        dispGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
            createElement('div', { className: 'acn-set-label', textContent: 'Scroll direction' }),
            dirSel,
        ]));

        scroll.appendChild(dispGroup);

        // ── Platforms group ──
        var platGroup = createElement('div', { className: 'acn-set-group' });
        platGroup.appendChild(createElement('div', { className: 'acn-set-gtitle', textContent: 'Platforms' }));

        var platList = [
            { icon: '\u2733', color: '#d97706', name: 'Claude' },
            { icon: '\u23E3', color: '#10a37f', name: 'ChatGPT' },
            { icon: 'X',      color: '#ef4444', name: 'Grok' },
            { icon: '\u2726', color: '#4285f4', name: 'Gemini' },
            { icon: '\u2733', color: '#20b8cd', name: 'Perplexity' },
        ];
        platList.forEach(function (p) {
            var iconEl = createElement('span', { className: 'acn-plat-icon',
                style: 'color:' + p.color, textContent: p.icon });
            var nameEl = createElement('span', { className: 'acn-plat-name', textContent: p.name });
            var tog    = createElement('div', { className: 'acn-toggle acn-on' });
            tog.addEventListener('click', function () { tog.classList.toggle('acn-on'); });
            platGroup.appendChild(createElement('div', { className: 'acn-plat-row' },
                [iconEl, nameEl, tog]));
        });
        scroll.appendChild(platGroup);

        // ── About group ──
        var aboutGroup = createElement('div', { className: 'acn-set-group' });
        aboutGroup.appendChild(createElement('div', { className: 'acn-set-gtitle', textContent: 'About' }));
        aboutGroup.appendChild(createElement('div', { className: 'acn-set-row' }, [
            createElement('div', { className: 'acn-set-label',
                style: 'color:#777', textContent: 'AI Conversation Navigator v10.0' }),
        ]));
        var resetBtn = createElement('button', { className: 'acn-reset-btn',
            textContent: 'Reset to Default' });
        resetBtn.addEventListener('click', function () {
            orbSetMode('show-all');
            orbScrollInverted = false;
            orbSaveSettings();
            var dirSelEl = document.getElementById('acn-dir-sel');
            if (dirSelEl) dirSelEl.value = 'standard';
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
        zone.setAttribute('data-acn-role',    'zone');
        zone.setAttribute('data-acn-accent',  orbTheme.bg);   // platform hex color
        zone.setAttribute('data-acn-version', '10.0');

        // Set CSS variables for platform theming
        zone.style.setProperty('--acn-accent', orbTheme.bg);
        zone.style.setProperty('--acn-rgb',    orbTheme.rgb);
        zone.style.setProperty('--acn-shadow', orbTheme.shadow);

        // Hitzone — captures hover/scroll events
        var hitzone = createElement('div', { id: 'acn-hitzone', className: 'acn-hitzone' });
        zone.appendChild(hitzone);

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
        zone.addEventListener('mouseenter', handleEnter);

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
        zone.addEventListener('mouseleave', handleExit);

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

        // Build and append panels
        document.body.appendChild(orbBuildPanelNav());
        document.body.appendChild(orbBuildPanelSearch());
        document.body.appendChild(orbBuildPanelBookmarks());
        document.body.appendChild(orbBuildPanelSummary());
        document.body.appendChild(orbBuildPanelExport());
        document.body.appendChild(orbBuildPanelSettings());

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
            container.style.right   = btnRight;
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
            '.ai-nav-floating-btn{background:' + theme.accent + '!important;color:' + (theme.textColor || '#fff') + '!important;border:none!important;cursor:pointer!important;border-radius:6px 0 0 6px!important;box-shadow:-2px 0 8px rgba(0,0,0,.3)!important;display:flex!important;align-items:center!important;justify-content:center!important;width:14px!important;height:52px!important;padding:0!important;font-weight:800!important;font-size:20px!important;overflow:hidden!important;transition:width .3s cubic-bezier(.4,0,.2,1),height .3s cubic-bezier(.4,0,.2,1),opacity .3s ease!important;white-space:nowrap!important;opacity:0!important;pointer-events:auto!important;position:relative!important;}' +
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
            '#ai-nav-panel{position:fixed!important;left:auto!important;right:65%;top:0!important;width:320px!important;height:100vh!important;background:#1a1a1a!important;border-right:1px solid #333!important;z-index:2147483646!important;clip-path:inset(0 0 0 100%)!important;transition:clip-path .3s ease!important;display:flex!important;flex-direction:column!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;pointer-events:none!important;}' +
            '#ai-nav-panel.open{clip-path:inset(0 0 0 0)!important;pointer-events:auto!important;}'
        ) : (
            '#ai-nav-panel{position:fixed!important;right:-320px!important;top:0!important;width:320px!important;height:100vh!important;background:#1a1a1a!important;border-left:1px solid #333!important;z-index:2147483646!important;transition:right .3s ease!important;display:flex!important;flex-direction:column!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;}' +
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
                if (isLeftChat && c) c.classList.remove('open');
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
                if (isLeftChat && container) container.classList.add('open');
                scanConversation();
                legacyRenderPanel();
            } else {
                if (panel)     { panel.classList.remove('open'); panel.removeAttribute('data-acn-open'); }
                if (btn)       btn.classList.remove('open');
                if (isLeftChat && container) container.classList.remove('open');
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
                    if (legacyNavOpen) { con.classList.add('open'); b.classList.add('open'); }
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
    // Inject now (body is available — Tampermonkey runs at document-end)
    // ============================================================
    if (useOrbital) {
        injectOrbital();
    } else {
        injectLegacy();
    }

    console.log('AI Conversation Navigator v10.0 loaded for ' + platform.title +
        (isLeftChat ? ' (left-chat mode)' : '') + (useOrbital ? ' [orbital]' : ' [legacy]') + '.');
})();
