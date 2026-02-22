// ==UserScript==
// @name         AI Conversation Navigator v9.4
// @namespace    http://tampermonkey.net/
// @version      9.4
// @description  Adds a sidebar with bookmarks to navigate long conversations on Claude, ChatGPT, Codex, Grok, Gemini, Bolt, Lovable, Replit, V0, Base44, Emergent, Perplexity, and Firebase Studio
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
    // On Linux Firefox, Tampermonkey can fire the script twice or the
    // MutationObserver can race with initialization. This prevents duplicates.
    if (window._aiNavAlreadyLoaded) {
        console.log('AI Nav: Script already loaded, skipping duplicate execution.');
        return;
    }
    window._aiNavAlreadyLoaded = true;

    // ================================================================
    // PLATFORMS REGISTRY — Single source of truth for all platform data
    // ================================================================
    // Each entry defines everything about one platform: detection, theme,
    // icon, layout mode, virtual-scroll flag, and other metadata.
    // To add a new platform, add ONE entry here — nothing else to touch.
    const PLATFORMS = {
        claude: {
            id: 'claude',
            title: 'Claude',
            match: function (host) { return host.includes('claude.ai'); },
            theme: { accent: '#d97706', accentHover: '#b45309', accentLight: 'rgba(217, 119, 6, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u2733',   // ✳
            layout: 'standard',
            virtualScroll: false,
            spa: false,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: 200000,
            tokensPerChar: 0.25,
            contextTracking: true,
            fetchInterceptEndpoint: '/chat_conversations',
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: null,
            getUserMessages: function () {
                // Claude Chat selectors
                var messages = document.querySelectorAll('[data-testid="user-human-turn"]');
                if (messages.length === 0) messages = document.querySelectorAll('[data-testid="user-message"]');
                if (messages.length === 0) messages = document.querySelectorAll('.font-user-message');
                // Claude Code fallback: no data-testid attributes exist; user messages
                // are right-aligned (items-end + ml-auto) with bg-bg-200 bubbles.
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
            theme: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)', textColor: '#1a1a1a', toggleBorder: '1px solid #333', numberColor: '#aaa' },
            icon: '\u23E3',   // ⏣
            layout: 'standard',
            virtualScroll: false,
            spa: false,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: 128000,
            tokensPerChar: 0.25,
            contextTracking: true,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: null,
            getUserMessages: function () {
                var allMessages = document.querySelectorAll('[data-message-author-role]');
                var messages = Array.from(allMessages).filter(function (msg) {
                    return msg.getAttribute('data-message-author-role') === 'user';
                });
                // Codex web fallback: chatgpt.com/codex uses a task/thread-based interface
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
            theme: { accent: '#dc2626', accentHover: '#b91c1c', accentLight: 'rgba(220, 38, 38, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
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
            contextWindow: 128000,
            tokensPerChar: 0.25,
            contextTracking: true,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
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
            theme: { accent: '#4285f4', accentHover: '#3367d6', accentLight: 'rgba(66, 133, 244, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u2726',   // ✦
            layout: 'standard',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: 1000000,
            tokensPerChar: 0.25,
            contextTracking: true,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
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
            theme: { accent: '#38BDF8', accentHover: '#0EA5E9', accentLight: 'rgba(56, 189, 248, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u26A1\uFE0E',  // ⚡ (lightning bolt, text presentation)
            layout: 'left-chat',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: '[class*="backdrop-blur"][class*="rounded"], [class*="max-w-chat"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: null,
            getUserMessages: function () {
                var messages = [];
                // Primary: data-message-id containers filtered to user messages (self-end)
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
                // Fallback 1: self-end elements with bolt message background
                if (messages.length === 0) {
                    var boltSelfEnd = document.querySelectorAll('.self-end[class*="bg-bolt-elements"], [class*="bg-bolt-elements-messages-background"]');
                    messages = Array.from(boltSelfEnd).filter(function (el) {
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                // Fallback 2: MarkdownContent inside self-end containers
                if (messages.length === 0) {
                    var boltMarkdown = document.querySelectorAll('[class*="_MarkdownContent_"]');
                    messages = Array.from(boltMarkdown).filter(function (el) {
                        var userParent = el.closest('.self-end, [class*="bg-bolt-elements-messages"]');
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return userParent && !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                // Fallback 3: bolt.diy fork — backdrop-blur + rounded bubbles
                if (messages.length === 0) {
                    var boltCandidates = document.querySelectorAll('[class*="backdrop-blur"][class*="rounded"]');
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
                // Fallback 4: right-aligned rounded bubbles inside chat area
                if (messages.length === 0) {
                    var mlAutoBubbles = document.querySelectorAll('.ml-auto.rounded-lg, .ml-auto.rounded-xl');
                    messages = Array.from(mlAutoBubbles).filter(function (el) {
                        var cls = el.className || '';
                        if (cls.includes('items-start') && cls.includes('gap-')) return false;
                        var isPromptArea = el.closest('[class*="subscribeButton"]') || el.closest('[class*="prompt-subscribe"]');
                        return !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
                // Fallback 5: grid children — assistant is overflow-hidden w-full, user is NOT
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
            theme: { accent: '#9b87f5', accentHover: '#7c3aed', accentLight: 'rgba(155, 135, 245, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u2665',  // ♥ (heart suit)
            layout: 'left-chat',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: 'div[role="log"], div.ChatMessageContainer, .justify-end',
            boundaryStrategy: 'walk-up',
            pathGuard: function (path) { return path.includes('/projects/'); },
            initGuards: [],
            retryDelays: [],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: null,
            getUserMessages: function () {
                var messages = [];
                // Guard: only scan on project pages where the chat exists
                if (window.location.pathname.includes('/projects/')) {
                    // Primary: ARIA role="log" container + right-aligned message wrappers
                    var chatLog = document.querySelector('div[role="log"]');
                    if (chatLog) {
                        messages = Array.from(chatLog.querySelectorAll('.justify-end')).filter(function (el) {
                            return el.textContent.trim().length > 0;
                        });
                    }
                    // Fallback 1: neutral-background bubbles inside right-aligned containers
                    if (messages.length === 0) {
                        var lovableBubbles = document.querySelectorAll('div.bg-neutral-200.rounded-xl, div.bg-neutral-700.rounded-xl');
                        messages = Array.from(lovableBubbles).filter(function (el) {
                            return el.closest('.justify-end') || el.classList.contains('ml-auto');
                        });
                    }
                    // Fallback 2: ChatMessageContainer class
                    if (messages.length === 0) {
                        var lovableContainer = document.querySelector('div.ChatMessageContainer');
                        if (lovableContainer) {
                            messages = Array.from(lovableContainer.querySelectorAll('.justify-end')).filter(function (el) {
                                return el.textContent.trim().length > 0;
                            });
                        }
                    }
                    // Fallback 3: self-end with neutral background
                    if (messages.length === 0) {
                        messages = document.querySelectorAll('div.self-end[class*="bg-neutral"]');
                    }
                    // Fallback 4: broad scan — right-aligned divs within main
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
                }
                return messages;
            },
        },
        replit: {
            id: 'replit',
            title: 'Replit',
            match: function (host) { return host.includes('replit.com'); },
            theme: { accent: '#F26522', accentHover: '#D4541A', accentLight: 'rgba(242, 101, 34, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u2815',   // ⠕ (Braille dots-135, Replit prompt logo)
            layout: 'left-chat',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: '[data-cy="user-message"], [data-event-type="user-message"], [role="log"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: null,
            getUserMessages: function () {
                // Primary: data-cy="user-message" — Replit's Cypress test attribute (one per message)
                var messages = document.querySelectorAll('[data-cy="user-message"]');
                // Secondary: data-event-type
                if (messages.length === 0) messages = document.querySelectorAll('[data-event-type="user-message"]');
                // Fallback 1: EventRenderer class with userMessage
                if (messages.length === 0) {
                    var replitEventRenderers = document.querySelectorAll('[class*="EventRenderer"][class*="userMessage"]');
                    messages = Array.from(replitEventRenderers).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                }
                // Fallback 2: CSS module pattern — deduplicate nested matches
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
                // Fallback 3: ARIA role="log" container + structural analysis
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
                            var hasDistinctBg = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
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
            theme: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)', textColor: '#1a1a1a', toggleBorder: 'none', numberColor: null },
            icon: '\u25BD',      // ▽ (inverted triangle, Vercel logo shape)
            layout: 'left-chat',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: '[data-testid="message"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: null,
            getUserMessages: function () {
                var messages = [];
                // Primary: data-testid="message" filtered by origin-right (user = right-aligned)
                var v0MsgAll = document.querySelectorAll('[data-testid="message"]');
                if (v0MsgAll.length > 0) {
                    messages = Array.from(v0MsgAll).filter(function (el) {
                        var cls = el.className || '';
                        return cls.includes('origin-right') && cls.includes('items-end');
                    });
                }
                // Fallback 1: data-testid="message" with only items-end
                if (messages.length === 0 && v0MsgAll.length > 0) {
                    messages = Array.from(v0MsgAll).filter(function (el) {
                        var cls = el.className || '';
                        return cls.includes('items-end') && !cls.includes('items-start');
                    });
                }
                // Fallback 2: message bubble with bg-v0-gray-200
                if (messages.length === 0) {
                    var v0Bubbles = document.querySelectorAll('[class*="bg-v0-gray-200"][class*="message-bubble"], [class*="group/message-bubble"]');
                    messages = Array.from(v0Bubbles).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                }
                // Fallback 3: role="listitem" containers filtered by right-alignment
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
            theme: { accent: '#6366f1', accentHover: '#4f46e5', accentLight: 'rgba(99, 102, 241, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u2B22',  // ⬢ (hexagon)
            layout: 'left-chat',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: '[id^="message-"]',
            boundaryStrategy: 'walk-up',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
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
            theme: { accent: '#10b981', accentHover: '#059669', accentLight: 'rgba(16, 185, 129, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: 'e',     // lowercase e (Emergent brand initial)
            layout: 'left-chat',
            virtualScroll: true,
            spa: true,
            scrollbarOffset: 14,
            boundarySelectors: '[data-testid^="user-message"], [id^="user-"]',
            boundaryStrategy: 'virtuoso',
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: function (msg) { return msg.querySelector('.prose'); },
            getUserMessages: function () {
                var messages = document.querySelectorAll('[data-testid^="user-message"]');
                // Deduplicate: keep only innermost matches
                if (messages.length > 0) {
                    var emergentArr = Array.from(messages);
                    var emergentDeduped = emergentArr.filter(function (el) {
                        return !emergentArr.some(function (other) {
                            return other !== el && el.contains(other);
                        });
                    });
                    if (emergentDeduped.length > 0) messages = emergentDeduped;
                }
                // Fallback: id starts with "user-task"
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
            theme: { accent: '#20b8cd', accentHover: '#1a9aab', accentLight: 'rgba(32, 184, 205, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u2733\uFE0E', // ✳︎ (eight spoked asterisk, text presentation — same as Claude)
            layout: 'standard',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [],
            retryDelays: [],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
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
                // Firebase Studio renders chat in a cross-origin iframe on cloudworkstations.dev.
                // The actual workspace (with chat) uses a port-prefixed hostname like
                // "6000-firebase-studio-...cloudworkstations.dev". Match any hostname containing
                // both "firebase-studio-" and "cloudworkstations.dev".
                if (host.includes('cloudworkstations.dev') && host.includes('firebase-studio-')) return true;
                return false;
            },
            theme: { accent: '#FFA611', accentHover: '#F5820D', accentLight: 'rgba(255, 166, 17, 0.2)', textColor: 'white', toggleBorder: 'none', numberColor: null },
            icon: '\u2726', // ✦ (same as Gemini — Firebase Studio runs Gemini)
            layout: 'standard',
            virtualScroll: false,
            spa: true,
            scrollbarOffset: 0,
            boundarySelectors: null,
            boundaryStrategy: null,
            pathGuard: null,
            initGuards: [
                // Firebase Studio: the top frame (studio.firebase.google.com) is just a shell with ~157 elements.
                // The actual chat lives in a cross-origin iframe (firebase-studio-*.cloudworkstations.dev).
                // Skip the top frame — the script will also run inside the iframe via @include.
                {
                    check: function () {
                        return window === window.top &&
                            window.location.hostname.includes('studio.firebase.google.com');
                    },
                    msg: 'Firebase Studio top frame (shell), deferring to iframe instance.'
                },
                // Firebase Studio: multiple iframes on cloudworkstations.dev match our @include rule
                // (workspace, app preview, /env/msg endpoint). Only the workspace has the chat UI,
                // and its path always starts with /capra/. Skip all other cloudworkstations.dev iframes.
                {
                    check: function () {
                        return window.location.hostname.includes('cloudworkstations.dev') &&
                            !window.location.pathname.startsWith('/capra/');
                    },
                    msg: 'Firebase Studio non-workspace iframe (' + window.location.pathname + '), skipping.'
                }
            ],
            retryDelays: [5000, 10000, 20000],
            contextWindow: null,
            tokensPerChar: null,
            contextTracking: false,
            fetchInterceptEndpoint: null,
            textCleanup: [{ regex: /^You said\s*/i, replace: '' }],
            textExtractor: null,
            getUserMessages: function () {
                // Primary: elements with both _chatMessage_ and _isUser_ in class
                var firebaseMessages = document.querySelectorAll('[class*="_chatMessage_"][class*="_isUser_"]');
                var messages = Array.from(firebaseMessages).filter(function (el) {
                    return el.textContent.trim().length > 0;
                });
                // Fallback 1: _isUser_ alone
                if (messages.length === 0) {
                    firebaseMessages = document.querySelectorAll('[class*="_isUser_"]');
                    messages = Array.from(firebaseMessages).filter(function (el) {
                        return el.textContent.trim().length > 0;
                    });
                }
                // Fallback 2: _chatMessage_ class (all messages), then filter by _isUser_
                if (messages.length === 0) {
                    var allFirebaseMessages = document.querySelectorAll('[class*="_chatMessage_"]');
                    messages = Array.from(allFirebaseMessages).filter(function (el) {
                        return (el.className || '').includes('_isUser_') || (el.className || '').includes('isUser');
                    });
                }
                return messages;
            },
        }
    };

    // --- Platform detection ---
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

    // --- Init guards (e.g. Firebase top-frame skip, non-workspace iframe skip) ---
    for (var gi = 0; gi < platform.initGuards.length; gi++) {
        if (platform.initGuards[gi].check()) {
            console.log('AI Conversation Navigator: ' + platform.initGuards[gi].msg);
            return;
        }
    }

    // === BRIDGE VARIABLES ===
    // Map new registry fields → old variable names so all downstream code works unchanged.
    const theme = platform.theme;
    const siteIcon = platform.icon;
    const siteTitle = platform.title;
    const isLeftChat = platform.layout === 'left-chat';
    const isVirtualScroll = platform.virtualScroll;

    // Inject styles — button container and panel differ for left-chat vs standard platforms
    const toggleStyles = isLeftChat ? `
        /* === GHOST NOTCH V1 BUTTON CONTAINER (left-chat platforms) === */
        #ai-nav-button-container {
            position: fixed !important;
            left: auto !important;
            right: 65%;
            top: 50% !important;
            transform: translateY(-50%) !important;
            z-index: 2147483647 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 2px !important;
            pointer-events: none !important;
        }
        #ai-nav-button-container.open {
            pointer-events: auto !important;
        }
        .ai-nav-floating-btn {
            background: ${theme.accent} !important;
            color: ${theme.textColor} !important;
            border: none !important;
            cursor: pointer !important;
            border-radius: 6px 0 0 6px !important;
            box-shadow: -2px 0 8px rgba(0,0,0,0.3) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 8px !important;
            height: 52px !important;
            padding: 0 !important;
            font-weight: 800 !important;
            font-size: 20px !important;
            overflow: hidden !important;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, border-radius 0.3s ease, right 0.3s ease !important;
            white-space: nowrap !important;
            visibility: visible !important;
            opacity: 0 !important;
            pointer-events: auto !important;
            position: relative !important;
        }
        .ai-nav-floating-btn::after {
            content: '' !important;
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: -2px !important;
            height: 2px !important;
            background: transparent !important;
            pointer-events: auto !important;
        }
        .ai-nav-floating-btn .ai-nav-icon {
            font-size: 14px !important;
            opacity: 0 !important;
            transform: scale(0.6) !important;
            transition: opacity 0.25s ease 0.05s, transform 0.25s ease 0.05s !important;
        }
        .ai-nav-floating-btn .ai-nav-expand-text {
            display: none !important;
        }
        #ai-nav-button-container.ai-nav-positioned .ai-nav-floating-btn {
            opacity: 0.35 !important;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease, border-radius 0.3s ease, right 0.3s ease !important;
        }
        .ai-nav-floating-btn:hover,
        #ai-nav-button-container.open:hover .ai-nav-floating-btn {
            width: 32px !important;
            height: 40px !important;
            opacity: 1 !important;
            border-radius: 6px 0 0 6px !important;
        }
        .ai-nav-floating-btn:hover .ai-nav-icon,
        #ai-nav-button-container.open:hover .ai-nav-floating-btn .ai-nav-icon {
            opacity: 1 !important;
            transform: scale(1) !important;
        }
        .ai-nav-floating-btn.open {
            opacity: 1 !important;
            background: ${theme.accentHover} !important;
        }
    ` : `
        /* === STANDARD HOVER-EXPAND BUTTON CONTAINER (right-edge platforms) === */
        #ai-nav-button-container {
            position: fixed !important;
            right: 0 !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            z-index: 2147483647 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 2px !important;
            pointer-events: none !important;
            transition: right 0.3s ease !important;
        }
        #ai-nav-button-container.open {
            right: 320px !important;
            pointer-events: auto !important;
        }
        .ai-nav-floating-btn {
            background: ${theme.accent} !important;
            color: ${theme.textColor} !important;
            border: ${theme.toggleBorder} !important;
            cursor: pointer !important;
            border-radius: 8px 0 0 8px !important;
            box-shadow: -2px 0 10px rgba(0,0,0,0.3) !important;
            display: flex !important;
            align-items: center !important;
            gap: 0px !important;
            padding: 12px 12px !important;
            font-weight: 800 !important;
            font-size: 20px !important;
            overflow: hidden !important;
            transition: all 0.25s ease !important;
            white-space: nowrap !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            align-self: flex-end !important;
            box-sizing: border-box !important;
            width: 48px !important;
            position: relative !important;
        }
        .ai-nav-floating-btn::after {
            content: '' !important;
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: -2px !important;
            height: 2px !important;
            background: transparent !important;
            pointer-events: auto !important;
        }
        .ai-nav-floating-btn .ai-nav-icon {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 24px !important;
            height: 24px !important;
            flex-shrink: 0 !important;
        }
        .ai-nav-floating-btn:hover,
        #ai-nav-button-container.open:hover .ai-nav-floating-btn {
            padding-right: 16px !important;
            width: 127px !important;
        }
        .ai-nav-floating-btn .ai-nav-expand-text {
            width: 0 !important;
            opacity: 0 !important;
            overflow: hidden !important;
            transition: width 0.25s ease, opacity 0.2s ease, margin-left 0.25s ease !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            margin-left: 0 !important;
            display: inline-block !important;
            text-align: left !important;
            white-space: nowrap !important;
        }
        .ai-nav-floating-btn:hover .ai-nav-expand-text,
        #ai-nav-button-container.open:hover .ai-nav-floating-btn .ai-nav-expand-text {
            width: 65px !important;
            opacity: 1 !important;
            margin-left: 10px !important;
        }
        .ai-nav-floating-btn.open {
            background: ${theme.accentHover} !important;
        }
    `;

    const panelStyles = isLeftChat ? `
        /* === NAVIGATION PANEL (left-chat: anchored at boundary, reveals leftward) === */
        #ai-nav-panel, #ai-context-panel, #ai-search-panel {
            position: fixed !important;
            left: auto !important;
            right: 65%;
            top: 0 !important;
            width: 320px !important;
            height: 100vh !important;
            background: #1a1a1a !important;
            border-right: 1px solid #333 !important;
            border-left: none !important;
            z-index: 2147483646 !important;
            clip-path: inset(0 0 0 100%) !important;
            transition: clip-path 0.3s ease !important;
            display: flex !important;
            flex-direction: column !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: none !important;
        }
        #ai-nav-panel.open, #ai-context-panel.open, #ai-search-panel.open {
            clip-path: inset(0 0 0 0) !important;
            pointer-events: auto !important;
        }
    ` : `
        /* === NAVIGATION PANEL (standard: slides from right) === */
        #ai-nav-panel, #ai-context-panel, #ai-search-panel {
            position: fixed !important;
            right: -320px !important;
            top: 0 !important;
            width: 320px !important;
            height: 100vh !important;
            background: #1a1a1a !important;
            border-left: 1px solid #333 !important;
            z-index: 2147483646 !important;
            transition: right 0.3s ease !important;
            display: flex !important;
            flex-direction: column !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
        }
        #ai-nav-panel.open, #ai-context-panel.open, #ai-search-panel.open {
            right: 0 !important;
        }
    `;

    const styles = toggleStyles + panelStyles + `
        #ai-nav-header {
            padding: 16px;
            background: #252525;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #ai-nav-header h3 {
            margin: 0;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
        }
        #ai-nav-refresh {
            background: #333;
            border: none;
            color: #aaa;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        #ai-nav-refresh:hover {
            background: #444;
            color: #fff;
        }

        #ai-nav-stats {
            padding: 12px 16px;
            background: #202020;
            border-bottom: 1px solid #333;
            color: #888;
            font-size: 12px;
        }

        #ai-nav-context {
            padding: 16px;
            font-size: 13px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            line-height: 1.5;
            min-height: 0;
            transition: opacity 0.3s;
        }
        #ai-nav-context:empty {
            display: none;
            padding: 0;
            border: none;
        }
        
        #ai-search-input {
            width: 100%;
            padding: 8px 12px;
            background: #333;
            border: 1px solid #444;
            color: #fff;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
        }
        #ai-search-input:focus {
            border-color: ${theme.accent};
        }
        .ai-nav-search-highlight {
            background-color: rgba(255, 255, 0, 0.3);
            color: #fff;
            font-weight: bold;
            padding: 0 2px;
            border-radius: 2px;
        }
        .ai-search-item {
            padding: 12px 16px;
            border-bottom: 1px solid #333;
            cursor: pointer;
            transition: background 0.2s;
        }
        .ai-search-item:hover {
            background: #2a2a2a;
        }
        .ai-search-item.user {
            border-left: 3px solid ${theme.accent};
        }
        .ai-search-item.agent {
            border-left: 3px solid #555;
        }
        .ai-search-item-role {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
            color: #888;
        }
        .ai-search-item.user .ai-search-item-role {
            color: ${theme.accent};
        }
        .ai-search-item-text {
            font-size: 13px;
            color: #ccc;
            line-height: 1.5;
            word-wrap: break-word;
        }
        #ai-search-empty {
            padding: 24px;
            text-align: center;
            color: #777;
            font-size: 13px;
            font-style: italic;
        }
        .ai-nav-context-warning {
            margin-top: 16px;
            padding: 12px;
            background: rgba(234, 179, 8, 0.1);
            border: 1px solid rgba(234, 179, 8, 0.3);
            border-radius: 6px;
            color: #eab308;
            font-size: 12px;
            line-height: 1.5;
        }

        #ai-nav-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }

        .ai-nav-item {
            padding: 12px;
            margin-bottom: 6px;
            background: #252525;
            border-radius: 8px;
            cursor: pointer;
            border-left: 3px solid ${theme.accent};
            transition: all 0.15s ease;
        }
        .ai-nav-item:hover {
            background: #303030;
            border-left-color: ${theme.accentHover};
        }

        .ai-nav-number {
            color: ${theme.numberColor || theme.accent};
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .ai-nav-summary {
            color: #e5e5e5;
            font-size: 13px;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .ai-nav-meta {
            color: #666;
            font-size: 11px;
            margin-top: 6px;
        }

        #ai-nav-empty {
            color: #666;
            text-align: center;
            padding: 40px 20px;
            font-size: 13px;
        }

        /* Scrollbar styling */
        #ai-nav-list::-webkit-scrollbar { width: 6px; }
        #ai-nav-list::-webkit-scrollbar-track { background: #1a1a1a; }
        #ai-nav-list::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
    `;

    // Add styles to page
    const styleEl = document.createElement('style');
    styleEl.id = 'ai-nav-style';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // --- State ---
    let isNavOpen = false;
    let isContextOpen = false;
    let isSearchOpen = false;
    let scanInterval = null;
    var _interceptedTokens = {
        inputTokens: 0,
        outputTokens: 0,
        lastUpdated: 0,
        available: false
    };
    var _fetchInterceptorInstalled = false;

    // ============================================================
    // DOM CREATION HELPERS — No innerHTML anywhere (Trusted Types)
    // ============================================================

    function createElement(tag, attrs, children) {
        const el = document.createElement(tag);
        if (attrs) {
            for (const [key, value] of Object.entries(attrs)) {
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
            for (const child of children) {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child) {
                    el.appendChild(child);
                }
            }
        }
        return el;
    }

    // --- Detect chat panel right edge for left-chat platforms ---
    // Walk up from an element to find the chat panel container, return its right edge
    function _walkUpToChatContainer(startEl) {
        var el = startEl;
        while (el && el !== document.body) {
            var rect = el.getBoundingClientRect();
            // Chat panel: starts in the left portion of the viewport (allowing for icon sidebars
            // up to ~80px), reasonable width (200-65% of viewport), and tall (≥40% viewport).
            if (rect.left < 80 && rect.width > 200 && rect.width < window.innerWidth * 0.65 &&
                rect.height > window.innerHeight * 0.4) {
                return rect.right;
            }
            el = el.parentElement;
        }
        return null;
    }

    function getChatBoundaryX() {
        if (!isLeftChat) return null;

        // Path guard: some platforms only show chat on specific pages (e.g. Lovable → /projects/)
        if (platform.pathGuard && !platform.pathGuard(window.location.pathname)) {
            return null;
        }

        // Virtuoso virtual scroller: The walk-up approach fails because parent containers use
        // absolute inset-0 which spans full viewport width. Find the virtuoso scroller directly —
        // its right edge IS the chat boundary.
        if (platform.boundaryStrategy === 'virtuoso') {
            var virtuosoScroller = document.querySelector('[data-testid="virtuoso-scroller"], [data-virtuoso-scroller="true"]');
            if (virtuosoScroller) {
                var vsRect = virtuosoScroller.getBoundingClientRect();
                if (vsRect.width > 200 && vsRect.width < window.innerWidth * 0.75 && vsRect.height > window.innerHeight * 0.3) {
                    return vsRect.right;
                }
            }
        }

        // Strategy 1: Find chat input and walk up to chat container
        var input = document.querySelector(
            'textarea[placeholder*="message" i], textarea[placeholder*="Message"], ' +
            'textarea[placeholder*="Send" i], textarea[placeholder*="Type" i], ' +
            '[contenteditable="true"][role="textbox"], [contenteditable="true"], ' +
            'textarea[class*="chat"], textarea[class*="prompt"]'
        );
        if (input) {
            var boundary = _walkUpToChatContainer(input);
            if (boundary) return boundary;
        }

        // Strategy 2: Find a known message element (platform-specific) and walk up
        var sel = platform.boundarySelectors;
        if (sel) {
            var msgEl = document.querySelector(sel);
            if (msgEl) {
                var boundary = _walkUpToChatContainer(msgEl);
                if (boundary) return boundary;
            }
        }

        // Strategy 3: Find the right-side preview panel (iframe) — its left edge is the boundary
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
            var rect = iframes[i].getBoundingClientRect();
            // Right-side preview panel: left edge in middle portion, tall, reasonably wide
            if (rect.left > window.innerWidth * 0.25 && rect.left < window.innerWidth * 0.75 &&
                rect.height > window.innerHeight * 0.3 && rect.width > window.innerWidth * 0.2) {
                return rect.left;
            }
        }

        // No chat panel detected — return null to hide the button
        // (prevents button from appearing on home/dashboard pages)
        return null;
    }

    // --- Position toggle button AND panel at the chat boundary ---
    var _lastBoundaryX = null;
    var _boundaryDetected = false;
    var _fadeTimer = null;
    function updateLeftChatPositions() {
        if (!isLeftChat) return;

        var boundaryX = getChatBoundaryX();
        var container = document.getElementById('ai-nav-button-container');
        var panel = document.getElementById('ai-nav-panel');
        var contextPanel = document.getElementById('ai-context-panel');
        var searchPanel = document.getElementById('ai-search-panel');
        var anyOpen = isNavOpen || isContextOpen || isSearchOpen;

        // No chat panel detected → hide and reset all state
        // But never hide while panel is actively open (user is interacting)
        if (!boundaryX) {
            if (anyOpen) return;
            if (container) container.style.display = 'none';
            if (panel) panel.style.display = 'none';
            if (contextPanel) contextPanel.style.display = 'none';
            if (searchPanel) searchPanel.style.display = 'none';
            _lastBoundaryX = null;
            if (_boundaryDetected) {
                _boundaryDetected = false;
                if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
                if (container) container.classList.remove('ai-nav-positioned');
            }
            return;
        }

        // Emergent has a thick scrollbar at the chat boundary — offset toggle left
        // so it doesn't overlap. Panel stays flush with the boundary.
        var toggleScrollbarOffset = platform.scrollbarOffset || 0;

        // Already confirmed — just update position smoothly, never hide
        if (_boundaryDetected) {
            // Safety: ensure container always has positioned class (DOM guardian may recreate it)
            if (container && !container.classList.contains('ai-nav-positioned') && !anyOpen) {
                container.classList.add('ai-nav-positioned');
            }
            if (!_lastBoundaryX || Math.abs(boundaryX - _lastBoundaryX) >= 3) {
                _lastBoundaryX = boundaryX;
                var panelRight = (window.innerWidth - boundaryX) + 'px';
                var toggleRight = (window.innerWidth - boundaryX + toggleScrollbarOffset) + 'px';
                if (panel) panel.style.right = panelRight;
                if (contextPanel) contextPanel.style.right = panelRight;
                if (searchPanel) searchPanel.style.right = panelRight;
                if (container && !anyOpen) container.style.right = toggleRight;
            }
            return;
        }

        // Not yet confirmed — require two consecutive stable polls before showing
        if (_lastBoundaryX && Math.abs(boundaryX - _lastBoundaryX) < 3) {
            // Stable! Show and fade in
            _boundaryDetected = true;
            if (container) container.style.display = '';
            if (panel) panel.style.display = '';
            if (contextPanel) contextPanel.style.display = '';
            if (searchPanel) searchPanel.style.display = '';
            if (container) {
                _fadeTimer = setTimeout(function () {
                    _fadeTimer = null;
                    container.classList.add('ai-nav-positioned');
                }, 300);
            }
            return;
        }

        // First detection or position still settling — store and position invisibly
        _lastBoundaryX = boundaryX;
        var panelRight = (window.innerWidth - boundaryX) + 'px';
        var toggleRight = (window.innerWidth - boundaryX + toggleScrollbarOffset) + 'px';
        if (panel) panel.style.right = panelRight;
        if (contextPanel) contextPanel.style.right = panelRight;
        if (searchPanel) searchPanel.style.right = panelRight;
        if (container && !anyOpen) container.style.right = toggleRight;
    }

    // --- Create button container (holds multiple floating buttons) ---
    function createButtonContainer() {
        var container = createElement('div', { id: 'ai-nav-button-container' });

        var navBtn, ctxBtn, searchBtn;
        if (isLeftChat) {
            navBtn = createElement('button', { id: 'ai-nav-toggle', className: 'ai-nav-floating-btn', onClick: handleNavToggleClick }, [
                createElement('span', { className: 'ai-nav-icon', textContent: siteIcon })
            ]);
            ctxBtn = createElement('button', { id: 'ai-context-toggle', className: 'ai-nav-floating-btn', onClick: handleContextToggleClick }, [
                createElement('span', { className: 'ai-nav-icon', textContent: '\uD83D\uDCCA' })
            ]);
            searchBtn = createElement('button', { id: 'ai-search-toggle', className: 'ai-nav-floating-btn', onClick: handleSearchToggleClick }, [
                createElement('span', { className: 'ai-nav-icon', textContent: '\uD83D\uDD0D' })
            ]);
        } else {
            navBtn = createElement('button', { id: 'ai-nav-toggle', className: 'ai-nav-floating-btn', onClick: handleNavToggleClick }, [
                document.createTextNode(siteIcon),
                createElement('span', { className: 'ai-nav-expand-text', textContent: 'Navigate' })
            ]);
            ctxBtn = createElement('button', { id: 'ai-context-toggle', className: 'ai-nav-floating-btn', onClick: handleContextToggleClick }, [
                document.createTextNode('\uD83D\uDCCA'),
                createElement('span', { className: 'ai-nav-expand-text', textContent: 'Context' })
            ]);
            searchBtn = createElement('button', { id: 'ai-search-toggle', className: 'ai-nav-floating-btn', onClick: handleSearchToggleClick }, [
                document.createTextNode('\uD83D\uDD0D'),
                createElement('span', { className: 'ai-nav-expand-text', textContent: 'Search' })
            ]);
        }

        container.appendChild(navBtn);
        if (platform.contextTracking) container.appendChild(ctxBtn);
        const isCoreChat = ['claude', 'chatgpt', 'grok', 'gemini'].includes(platform.id);
        if (isCoreChat && searchBtn) container.appendChild(searchBtn);

        return container;
    }

    // --- Create nav panel (fully programmatic, no innerHTML) ---
    function createPanel() {
        const header = createElement('div', { id: 'ai-nav-header' }, [
            createElement('h3', null, [siteIcon + ' ' + siteTitle + ' - Questions']),
            createElement('button', {
                id: 'ai-nav-refresh',
                textContent: '\u21BB Refresh',
                onClick: function () {
                    scanConversation(true);
                }
            })
        ]);

        const stats = createElement('div', { id: 'ai-nav-stats' });
        const list = createElement('div', { id: 'ai-nav-list' });

        return createElement('div', { id: 'ai-nav-panel' }, [header, stats, list]);
    }

    // --- Create context panel ---
    function createContextPanel() {
        const header = createElement('div', { id: 'ai-nav-header' }, [
            createElement('h3', null, ['\uD83D\uDCCA Context Tracker']),
            createElement('button', {
                id: 'ai-context-refresh',
                textContent: '\u21BB Refresh',
                onClick: function () {
                    updateContextIndicator();
                }
            })
        ]);

        const contextIndicator = createElement('div', { id: 'ai-nav-context' });

        const warningText = createElement('div', { className: 'ai-nav-context-warning' }, [
            document.createTextNode('Start thinking about starting a new chat when the context is nearing 70%. The ai will have to compact your conversation probably around 80% to continue talking to you. You can still continue talking after ai compacts context window after 80%, but it might lose some memory of the earlier chats')
        ]);

        const container = createElement('div', { style: 'padding: 16px; flex: 1; overflow-y: auto;' }, [
            contextIndicator,
            warningText
        ]);

        return createElement('div', { id: 'ai-context-panel' }, [header, container]);
    }

    // --- Create search panel ---
    let _searchTimeout = null;
    function createSearchPanel() {
        const header = createElement('div', { id: 'ai-nav-header' }, [
            createElement('h3', null, ['\uD83D\uDD0D Search Conversation']),
        ]);

        const searchBoxContainer = createElement('div', { style: 'padding: 16px; border-bottom: 1px solid #333;' }, [
            createElement('input', {
                id: 'ai-search-input',
                type: 'text',
                placeholder: 'Search keywords...',
                onInput: function (e) {
                    if (_searchTimeout) clearTimeout(_searchTimeout);
                    _searchTimeout = setTimeout(function () {
                        executeConversationSearch(e.target.value);
                    }, 300);
                }
            })
        ]);

        const resultsContainer = createElement('div', { id: 'ai-search-results', style: 'flex: 1; overflow-y: auto;' });

        return createElement('div', { id: 'ai-search-panel' }, [header, searchBoxContainer, resultsContainer]);
    }

    // --- Universal Conversation Search ---
    function executeConversationSearch(query) {
        var resultsContainer = document.getElementById('ai-search-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';
        query = (query || '').trim();
        if (!query) {
            resultsContainer.innerHTML = '<div id="ai-search-empty">Type a keyword across the whole conversation...</div>';
            return;
        }

        var queryLower = query.toLowerCase();

        // Find user messages so we can categorize "user" vs "agent"
        var userMessages = Array.from(getUserMessages());

        var mainContent = document.querySelector('main') || document.body;

        // Use TreeWalker to find all text nodes
        var walker = document.createTreeWalker(mainContent, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                var parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                var tag = parent.tagName.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;

                if (parent.closest('#ai-nav-panel') || parent.closest('#ai-context-panel') || parent.closest('#ai-search-panel') || parent.closest('#ai-nav-button-container')) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (node.nodeValue.toLowerCase().includes(queryLower)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        });

        var matches = [];
        var currentNode;
        while ((currentNode = walker.nextNode())) {
            matches.push(currentNode);
        }

        if (matches.length === 0) {
            resultsContainer.innerHTML = '<div id="ai-search-empty">No results found for "' + query + '".</div>';
            return;
        }

        var uniqueBlocks = [];
        var seenParents = new Set();

        for (var i = 0; i < matches.length; i++) {
            var node = matches[i];
            var hitParent = node.parentElement;
            var blockAncestor = hitParent.closest('p, div, li, td, h1, h2, h3, h4, h5, h6, blockquote, pre, span');
            if (!blockAncestor) blockAncestor = hitParent;

            if (seenParents.has(blockAncestor)) continue;
            seenParents.add(blockAncestor);

            var fullText = (blockAncestor.textContent || '').trim();
            if (!fullText) continue;

            var role = 'agent';
            for (var u = 0; u < userMessages.length; u++) {
                if (userMessages[u].contains(blockAncestor)) {
                    role = 'user';
                    break;
                }
            }

            uniqueBlocks.push({
                element: blockAncestor,
                text: fullText,
                role: role
            });
            if (uniqueBlocks.length >= 50) break;
        }

        if (uniqueBlocks.length === 0) {
            resultsContainer.innerHTML = '<div id="ai-search-empty">No block results found for "' + query + '".</div>';
            return;
        }

        uniqueBlocks.forEach(function (match) {
            var item = createElement('div', { className: 'ai-search-item ' + match.role });

            var roleDiv = createElement('div', { className: 'ai-search-item-role', textContent: match.role === 'user' ? 'Question' : 'Answer' });
            item.appendChild(roleDiv);

            var lowerText = match.text.toLowerCase();
            var index = lowerText.indexOf(queryLower);

            var start = Math.max(0, index - 40);
            var end = Math.min(match.text.length, index + query.length + 40);
            var prefix = (start > 0 ? '...' : '') + match.text.substring(start, index);
            var highlightToken = match.text.substring(index, index + query.length);
            var postfix = match.text.substring(index + query.length, end) + (end < match.text.length ? '...' : '');

            var textDiv = createElement('div', { className: 'ai-search-item-text' }, [
                document.createTextNode(prefix),
                createElement('span', { className: 'ai-nav-search-highlight', textContent: highlightToken }),
                document.createTextNode(postfix)
            ]);
            item.appendChild(textDiv);

            item.addEventListener('click', function () {
                if (isLeftChat && isSearchOpen) {
                    handleSearchToggleClick();
                    setTimeout(function () {
                        match.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        var origBg = match.element.style.backgroundColor;
                        match.element.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
                        match.element.style.transition = 'background-color 0.3s';
                        setTimeout(function () { match.element.style.backgroundColor = origBg; }, 1500);
                    }, 350);
                } else {
                    match.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    var origBg2 = match.element.style.backgroundColor;
                    match.element.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
                    match.element.style.transition = 'background-color 0.3s';
                    setTimeout(function () { match.element.style.backgroundColor = origBg2; }, 1500);
                }
            });

            resultsContainer.appendChild(item);
        });
    }

    // --- Create empty state message ---
    function createEmptyMessage() {
        const container = createElement('div', { id: 'ai-nav-empty' });
        container.appendChild(document.createTextNode('No messages found yet.'));
        container.appendChild(createElement('br'));
        container.appendChild(createElement('br'));
        container.appendChild(document.createTextNode('Start a conversation and click refresh!'));
        container.appendChild(createElement('br'));
        container.appendChild(createElement('br'));
        container.appendChild(createElement('small', null, [
            'If messages exist but aren\'t detected,',
            createElement('br'),
            'the site\'s structure may have changed.'
        ]));
        return container;
    }

    // --- Create a nav item for a question ---
    function createNavItem(msg, index, text) {
        const summary = generateSummary(text);
        const wordCount = text.split(/\s+/).length;

        const item = createElement('div', { className: 'ai-nav-item' }, [
            createElement('div', { className: 'ai-nav-number', textContent: 'Question #' + (index + 1) }),
            createElement('div', { className: 'ai-nav-summary', textContent: summary }),
            createElement('div', { className: 'ai-nav-meta', textContent: wordCount + ' words' })
        ]);

        item.addEventListener('click', function () {
            // For virtual scroll platforms, the original msg DOM element may have been
            // recycled by the virtual scroller. Re-find it by matching text content.
            var targetMsg = msg;
            if (isVirtualScroll && !msg.isConnected) {
                var currentMessages = getUserMessages();
                var searchText = text.substring(0, 200);
                var found = Array.from(currentMessages).find(function (m) {
                    return (m.textContent || '').trim().substring(0, 200) === searchText;
                });
                if (found) {
                    targetMsg = found;
                } else {
                    // Message not currently in DOM — can't scroll to it
                    return;
                }
            }

            // For left-chat platforms, close panel first since it overlays the chat
            if (isLeftChat && isOpen) {
                handleToggleClick(); // close panel
                // Scroll after panel close animation completes
                setTimeout(function () {
                    targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    var originalBg = targetMsg.style.backgroundColor;
                    targetMsg.style.backgroundColor = theme.accentLight;
                    targetMsg.style.transition = 'background-color 0.3s';
                    setTimeout(function () {
                        targetMsg.style.backgroundColor = originalBg;
                    }, 1500);
                }, 350);
            } else {
                targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                var originalBg = targetMsg.style.backgroundColor;
                targetMsg.style.backgroundColor = theme.accentLight;
                targetMsg.style.transition = 'background-color 0.3s';
                setTimeout(function () {
                    targetMsg.style.backgroundColor = originalBg;
                }, 1500);
            }
        });

        return item;
    }

    // --- Independent toggle handlers ---
    function handleNavToggleClick() {
        if (isContextOpen) handleContextToggleClick(); // auto-close other
        if (isSearchOpen) handleSearchToggleClick();

        ensureElementsExist();
        const panel = document.getElementById('ai-nav-panel');
        const toggle = document.getElementById('ai-nav-toggle');
        const container = document.getElementById('ai-nav-button-container');

        if (!panel || !toggle || !container) return;

        isNavOpen = !isNavOpen;
        panel.classList.toggle('open', isNavOpen);
        toggle.classList.toggle('open', isNavOpen);
        container.classList.toggle('open', isNavOpen || isContextOpen || isSearchOpen);

        // For left-chat: push container left by panel width (mirrors standard right: 0 → 320)
        if (isLeftChat) {
            var bx = _lastBoundaryX || getChatBoundaryX() || (window.innerWidth * 0.35);
            var panelRight = (window.innerWidth - bx) + 'px';
            if (isNavOpen) {
                if (panel) panel.style.right = panelRight;
                container.style.right = (window.innerWidth - bx + 320) + 'px';
            } else {
                _lastBoundaryX = null;
                updateLeftChatPositions();
            }
        }

        if (isNavOpen) {
            if (isVirtualScroll) {
                scanConversation(true);
                var scroller = document.querySelector('[data-testid="virtuoso-scroller"], [data-virtuoso-scroller="true"]');
                if (scroller && scroller.scrollHeight > scroller.clientHeight) {
                    var savedScrollTop = scroller.scrollTop;
                    var totalHeight = scroller.scrollHeight;
                    var viewHeight = scroller.clientHeight;
                    var positions = [0];
                    for (var pos = viewHeight * 0.8; pos < totalHeight; pos += viewHeight * 0.8) {
                        positions.push(Math.floor(pos));
                    }
                    positions.push(savedScrollTop);

                    var step = 0;
                    function _vsScrollStep() {
                        if (step >= positions.length) return;
                        scroller.scrollTop = positions[step];
                        setTimeout(function () {
                            if (step < positions.length - 1) {
                                scanConversation();
                            }
                            step++;
                            if (step < positions.length) {
                                _vsScrollStep();
                            }
                        }, 250);
                    }
                    _vsScrollStep();
                }
            } else {
                scanConversation();
                setTimeout(function () {
                    var items = document.querySelectorAll('.ai-nav-item');
                    if (items.length === 0) scanConversation();
                }, 2000);
            }
            if (scanInterval) clearInterval(scanInterval);
            scanInterval = setInterval(scanConversation, 10000);
        } else {
            if (scanInterval) {
                clearInterval(scanInterval);
                scanInterval = null;
            }
        }
    }

    function handleContextToggleClick() {
        if (isNavOpen) handleNavToggleClick(); // auto-close other
        if (isSearchOpen) handleSearchToggleClick();

        ensureElementsExist();
        const panel = document.getElementById('ai-context-panel');
        const toggle = document.getElementById('ai-context-toggle');
        const container = document.getElementById('ai-nav-button-container');

        if (!panel || !toggle || !container) return;

        isContextOpen = !isContextOpen;
        panel.classList.toggle('open', isContextOpen);
        toggle.classList.toggle('open', isContextOpen);
        container.classList.toggle('open', isNavOpen || isContextOpen || isSearchOpen);

        if (isLeftChat) {
            var bx = _lastBoundaryX || getChatBoundaryX() || (window.innerWidth * 0.35);
            var panelRight = (window.innerWidth - bx) + 'px';
            if (isContextOpen) {
                if (panel) panel.style.right = panelRight;
                container.style.right = (window.innerWidth - bx + 320) + 'px';
            } else {
                _lastBoundaryX = null;
                updateLeftChatPositions();
            }
        }

        if (isContextOpen) {
            updateContextIndicator();
        }
    }

    function handleSearchToggleClick() {
        if (isNavOpen) handleNavToggleClick(); // auto-close other
        if (isContextOpen) handleContextToggleClick();

        ensureElementsExist();
        const panel = document.getElementById('ai-search-panel');
        const toggle = document.getElementById('ai-search-toggle');
        const container = document.getElementById('ai-nav-button-container');

        if (!panel || !toggle || !container) return;

        isSearchOpen = !isSearchOpen;
        panel.classList.toggle('open', isSearchOpen);
        toggle.classList.toggle('open', isSearchOpen);
        container.classList.toggle('open', isNavOpen || isContextOpen || isSearchOpen);

        if (isLeftChat) {
            var bx = _lastBoundaryX || getChatBoundaryX() || (window.innerWidth * 0.35);
            var panelRight = (window.innerWidth - bx) + 'px';
            if (isSearchOpen) {
                if (panel) panel.style.right = panelRight;
                container.style.right = (window.innerWidth - bx + 320) + 'px';
            } else {
                _lastBoundaryX = null;
                updateLeftChatPositions();
            }
        }

        if (isSearchOpen) {
            var searchInput = document.getElementById('ai-search-input');
            if (searchInput) setTimeout(function () { searchInput.focus(); }, 300);
        }
    }

    // --- Ensure our elements exist in the DOM (with duplicate cleanup) ---
    function ensureElementsExist() {
        // --- Remove any duplicates first ---
        const containers = document.querySelectorAll('#ai-nav-button-container');
        const navPanels = document.querySelectorAll('#ai-nav-panel');
        const contextPanels = document.querySelectorAll('#ai-context-panel');
        const searchPanels = document.querySelectorAll('#ai-search-panel');
        const styleEls = document.querySelectorAll('#ai-nav-style');

        if (containers.length > 1) {
            for (let i = 1; i < containers.length; i++) containers[i].remove();
            console.log('AI Nav: Removed ' + (containers.length - 1) + ' duplicate container(s).');
        }
        if (navPanels.length > 1) {
            for (let i = 1; i < navPanels.length; i++) navPanels[i].remove();
        }
        if (contextPanels.length > 1) {
            for (let i = 1; i < contextPanels.length; i++) contextPanels[i].remove();
        }
        if (searchPanels.length > 1) {
            for (let i = 1; i < searchPanels.length; i++) searchPanels[i].remove();
        }
        if (styleEls.length > 1) {
            for (let i = 1; i < styleEls.length; i++) styleEls[i].remove();
        }

        // --- Re-inject if missing ---
        if (!document.getElementById('ai-nav-style')) {
            const s = document.createElement('style');
            s.id = 'ai-nav-style';
            s.textContent = styles;
            document.head.appendChild(s);
            console.log('AI Nav: Re-injected styles.');
        }

        if (!document.getElementById('ai-nav-panel')) {
            const panel = createPanel();
            if (isLeftChat && !_boundaryDetected) panel.style.display = 'none';
            document.body.appendChild(panel);
            if (isNavOpen) panel.classList.add('open');
            console.log('AI Nav: Re-injected nav panel.');
        }

        if (platform.contextTracking && !document.getElementById('ai-context-panel')) {
            const ctxPanel = createContextPanel();
            if (isLeftChat && !_boundaryDetected) ctxPanel.style.display = 'none';
            document.body.appendChild(ctxPanel);
            if (isContextOpen) ctxPanel.classList.add('open');
            console.log('AI Nav: Re-injected context panel.');
        }

        const isCoreChat = ['claude', 'chatgpt', 'grok', 'gemini'].includes(platform.id);
        if (isCoreChat && !document.getElementById('ai-search-panel')) {
            const searchPanel = createSearchPanel();
            if (isLeftChat && !_boundaryDetected) searchPanel.style.display = 'none';
            document.body.appendChild(searchPanel);
            if (isSearchOpen) searchPanel.classList.add('open');
            console.log('AI Nav: Re-injected search panel.');
        }

        if (!document.getElementById('ai-nav-button-container')) {
            const container = createButtonContainer();
            if (isLeftChat && !_boundaryDetected) {
                container.style.display = 'none';
            } else if (isLeftChat && _boundaryDetected) {
                container.classList.add('ai-nav-positioned');
                if (_lastBoundaryX) {
                    container.style.right = (window.innerWidth - _lastBoundaryX) + 'px';
                }
            }
            document.body.appendChild(container);

            // Re-apply open states to individual buttons if they were open
            if (isNavOpen && document.getElementById('ai-nav-toggle')) {
                document.getElementById('ai-nav-toggle').classList.add('open');
            }
            if (isContextOpen && document.getElementById('ai-context-toggle')) {
                document.getElementById('ai-context-toggle').classList.add('open');
            }
            if (isSearchOpen && document.getElementById('ai-search-toggle')) {
                document.getElementById('ai-search-toggle').classList.add('open');
            }
            console.log('AI Nav: Re-injected button container.');
        }
    }

    // --- DOM Guardian (debounced to prevent race conditions on Linux Firefox) ---
    function startDOMGuardian() {
        let guardianTimeout = null;

        const observer = new MutationObserver(function () {
            if (guardianTimeout) clearTimeout(guardianTimeout);
            guardianTimeout = setTimeout(function () {
                const isCoreChat = ['claude', 'chatgpt', 'grok', 'gemini'].includes(platform.id);
                if (!document.getElementById('ai-nav-button-container') || !document.getElementById('ai-nav-panel') || (isCoreChat && !document.getElementById('ai-search-panel')) || (platform.contextTracking && !document.getElementById('ai-context-panel'))) {
                    ensureElementsExist();
                }
            }, 200);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return observer;
    }

    // --- Generate smart summary ---
    function generateSummary(text) {
        let summary = text.trim();
        summary = summary.replace(/```[\s\S]*?```/g, '[code]');

        const questionMatch = summary.match(/^[^.!?]*\?/);
        if (questionMatch && questionMatch[0].length > 10) {
            return questionMatch[0].trim();
        }

        const firstSentence = summary.match(/^[^.!?\n]+[.!?]?/);
        if (firstSentence) {
            summary = firstSentence[0];
        }

        if (summary.length > 120) {
            summary = summary.substring(0, 117) + '...';
        }

        return summary || text.substring(0, 100) + '...';
    }

    // --- Get user messages based on current site ---
    function getUserMessages() {
        return platform.getUserMessages();
    }

    // --- Get all message elements (user + assistant) for context estimation ---
    function getAllMessages() {
        if (!platform.contextTracking) return [];

        var allMessages = [];

        switch (platform.id) {
            case 'claude':
                allMessages = document.querySelectorAll(
                    '[data-testid="user-message"], [data-testid="user-human-turn"], [data-testid="assistant-turn"]'
                );
                if (allMessages.length === 0) {
                    var containers = new Set();
                    document.querySelectorAll('.font-user-message, [data-testid="action-bar-copy"]').forEach(function (el) {
                        var parent = el.closest('.group');
                        if (parent) containers.add(parent);
                    });
                    allMessages = Array.from(containers);
                }
                if (allMessages.length === 0) {
                    allMessages = document.querySelectorAll('div.rounded-lg.px-4');
                }
                break;

            case 'chatgpt':
                allMessages = document.querySelectorAll('[data-message-author-role]');
                break;

            case 'grok':
                allMessages = document.querySelectorAll('div.message-bubble');
                if (allMessages.length === 0) {
                    allMessages = document.querySelectorAll('[class*="message"]');
                }
                break;

            case 'gemini':
                allMessages = document.querySelectorAll('user-query, model-response');
                if (allMessages.length === 0) {
                    allMessages = document.querySelectorAll('.query-text, .response-text');
                }
                break;
        }

        return allMessages;
    }

    // --- Estimate conversation context usage ---
    function estimateContextUsage() {
        if (!platform.contextTracking) return null;

        if (_interceptedTokens.available && (Date.now() - _interceptedTokens.lastUpdated < 300000)) {
            var realTokens = _interceptedTokens.inputTokens + _interceptedTokens.outputTokens;
            var realPercentage = Math.min(100, Math.round((realTokens / platform.contextWindow) * 100));
            return {
                estimatedTokens: realTokens,
                adjustedTokens: realTokens,
                contextWindow: platform.contextWindow,
                percentage: realPercentage,
                messageCount: getAllMessages().length,
                totalChars: 0,
                source: 'intercepted'
            };
        }

        var messages = getAllMessages();
        if (messages.length === 0) return null;

        var totalChars = 0;
        messages.forEach(function (msg) {
            var text = (msg.textContent || msg.innerText || '').trim();
            totalChars += text.length;
        });

        var estimatedTokens = Math.round(totalChars * platform.tokensPerChar);
        var SYSTEM_PROMPT_BUFFER = 10000;
        var adjustedTokens = estimatedTokens + SYSTEM_PROMPT_BUFFER;
        var percentage = Math.min(100, Math.round((adjustedTokens / platform.contextWindow) * 100));

        return {
            estimatedTokens: estimatedTokens,
            adjustedTokens: adjustedTokens,
            contextWindow: platform.contextWindow,
            percentage: percentage,
            messageCount: messages.length,
            totalChars: totalChars,
            source: 'dom-estimate'
        };
    }

    // --- Render context indicator in panel ---
    function updateContextIndicator() {
        var indicator = document.getElementById('ai-nav-context');
        if (!indicator || !platform.contextTracking) return;

        var usage = estimateContextUsage();

        while (indicator.firstChild) {
            indicator.removeChild(indicator.firstChild);
        }

        if (!usage) {
            indicator.textContent = '';
            indicator.title = '';
            return;
        }

        var color;
        if (usage.percentage < 60) color = '#22c55e';
        else if (usage.percentage < 80) color = '#eab308';
        else if (usage.percentage < 90) color = '#f97316';
        else color = '#ef4444';

        var filled = Math.round(usage.percentage / 10);
        var bar = '';
        for (var i = 0; i < 10; i++) {
            bar += i < filled ? '█' : '░';
        }

        var formatK = function (n) {
            return n >= 1000 ? Math.round(n / 1000) + 'K' : n.toString();
        };

        var sourceLabel = usage.source === 'intercepted' ? '' : '~';

        var barSpan = createElement('span', {
            textContent: bar,
            style: 'color: ' + color + '; font-family: monospace; letter-spacing: 1px;'
        });

        var textSpan = createElement('span', {
            textContent: ' ' + sourceLabel + formatK(usage.adjustedTokens) + ' / ' + formatK(usage.contextWindow) + ' (' + usage.percentage + '%)',
            style: 'color: ' + color + '; margin-left: 4px;'
        });

        indicator.appendChild(barSpan);
        indicator.appendChild(textSpan);

        if (usage.percentage >= 80) {
            var warningSpan = createElement('div', {
                textContent: usage.percentage >= 90
                    ? '⚠ Context nearly full — responses may degrade'
                    : '⚡ Context getting high — consider starting a new chat',
                style: 'color: ' + color + '; font-size: 10px; margin-top: 2px; opacity: 0.9;'
            });
            indicator.appendChild(warningSpan);
        }

        if (usage.source === 'dom-estimate') {
            indicator.title = 'Estimated from visible text (~4 chars/token + 10K system prompt buffer). Actual usage may be higher due to images, files, and hidden formatting.';
        } else {
            indicator.title = '';
        }
    }

    // --- Experimental: fetch interception for real token data (Claude only) ---
    function installFetchInterceptor() {
        if (!platform.contextTracking) return;
        if (platform.id !== 'claude') return;
        if (_fetchInterceptorInstalled) return;

        var originalFetch = window.fetch;
        window.fetch = async function () {
            var args = arguments;
            var firstArg = args[0];
            var url = (firstArg && typeof firstArg === 'string') ? firstArg : ((firstArg && firstArg.url) || '');
            var response = await originalFetch.apply(this, args);

            var endpoint = platform.fetchInterceptEndpoint;
            var isChatRequest = !!(endpoint && url.includes(endpoint));
            if (!isChatRequest && url.includes('/completion')) {
                isChatRequest = true;
            }

            if (isChatRequest) {
                try {
                    var cloned = response.clone();
                    parseStreamForTokens(cloned);
                } catch (e) {
                    console.log('AI Nav: fetch intercept error (non-critical):', e.message);
                }
            }

            return response;
        };

        _fetchInterceptorInstalled = true;
    }

    async function parseStreamForTokens(response) {
        try {
            if (!response || !response.body || !response.body.getReader) return;

            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            while (true) {
                var result = await reader.read();
                if (result.done) break;

                buffer += decoder.decode(result.value, { stream: true });
                var lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line.startsWith('data: ')) continue;

                    try {
                        var data = JSON.parse(line.substring(6));

                        if (data.type === 'message_start' && data.message && data.message.usage) {
                            _interceptedTokens.inputTokens = data.message.usage.input_tokens || 0;
                            if (typeof data.message.usage.output_tokens === 'number') {
                                _interceptedTokens.outputTokens = data.message.usage.output_tokens;
                            }
                            _interceptedTokens.lastUpdated = Date.now();
                            _interceptedTokens.available = true;
                        }
                        if (data.type === 'message_delta' && data.usage) {
                            _interceptedTokens.outputTokens = data.usage.output_tokens || 0;
                            _interceptedTokens.lastUpdated = Date.now();
                            _interceptedTokens.available = true;
                        }
                    } catch (parseErr) {
                        // Not valid JSON or not a token event — ignore.
                    }
                }
            }

            if (_interceptedTokens.available) {
                updateContextIndicator();
            }
        } catch (e) {
            // Stream reading failed — non-critical fallback to DOM estimate.
        }
    }

    // --- Scan conversation for user messages ---
    // Track accumulated text keys for virtual scroll platforms (deduplication across scans)
    var _vsAccumulatedKeys = new Set();

    function scanConversation(forceReset) {
        ensureElementsExist();

        const list = document.getElementById('ai-nav-list');
        const stats = document.getElementById('ai-nav-stats');
        if (!list || !stats) return;

        const messages = getUserMessages();

        // Virtual scroll platforms: accumulate messages across scans.
        // Only visible messages exist in the DOM at any time (virtuoso recycles the rest).
        // Without accumulation, the list would change every time the user scrolls.
        if (isVirtualScroll && !forceReset) {
            // If no new messages found AND we already have items, keep existing list
            if (messages.length === 0) {
                if (!list.querySelector('.ai-nav-item')) {
                    if (!list.firstChild) list.appendChild(createEmptyMessage());
                    stats.textContent = '0 questions found';
                }
                return;
            }

            var addedNew = false;
            messages.forEach(function (msg) {
                // Extract text from platform-specific container (excludes timestamps/buttons)
                var proseEl = platform.textExtractor ? platform.textExtractor(msg) : null;
                let text = proseEl ? (proseEl.textContent || '').trim() : (msg.textContent || msg.innerText || '').trim();
                text = text.replace(/^You said\s*/i, '');
                if (!text.trim()) return;

                // Deduplicate by first 200 chars (normalized)
                var key = text.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
                if (!_vsAccumulatedKeys.has(key)) {
                    _vsAccumulatedKeys.add(key);
                    // Remove "no questions" empty message if present
                    var emptyMsg = document.getElementById('ai-nav-empty');
                    if (emptyMsg) list.removeChild(emptyMsg);
                    var itemCount = list.querySelectorAll('.ai-nav-item').length;
                    var navItem = createNavItem(msg, itemCount, text);
                    navItem.setAttribute('data-text-key', key);
                    // Store virtuoso data-index for sorting (chronological order)
                    var virtuosoItem = msg.closest('[data-index]');
                    if (virtuosoItem) navItem.setAttribute('data-vs-index', virtuosoItem.getAttribute('data-index'));
                    list.appendChild(navItem);
                    addedNew = true;
                }
            });

            if (addedNew || list.querySelector('.ai-nav-item')) {
                // Sort nav items by virtuoso data-index (chronological order)
                // Without this, items appear in discovery order (newest first if user scrolls up)
                var navItems = Array.from(list.querySelectorAll('.ai-nav-item'));
                if (navItems.length > 1 && navItems[0].hasAttribute('data-vs-index')) {
                    navItems.sort(function (a, b) {
                        return parseInt(a.getAttribute('data-vs-index') || '0') - parseInt(b.getAttribute('data-vs-index') || '0');
                    });
                    navItems.forEach(function (item) { list.appendChild(item); });
                }
                var total = navItems.length || list.querySelectorAll('.ai-nav-item').length;
                stats.textContent = total + ' question' + (total !== 1 ? 's' : '') + ' found';
                // Re-number all items sequentially
                list.querySelectorAll('.ai-nav-number').forEach(function (numEl, i) {
                    numEl.textContent = 'Question #' + (i + 1);
                });
            }
            return;
        }

        // Standard mode (non-virtual-scroll, or forceReset): clear and rebuild
        if (isVirtualScroll) _vsAccumulatedKeys.clear();
        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }

        if (messages.length === 0) {
            list.appendChild(createEmptyMessage());
            stats.textContent = '0 questions found';
            return;
        }

        stats.textContent = messages.length + ' question' + (messages.length !== 1 ? 's' : '') + ' found';

        messages.forEach(function (msg, index) {
            // Extract text from platform-specific container (excludes timestamps/buttons)
            var proseEl = platform.textExtractor ? platform.textExtractor(msg) : null;
            let text = proseEl ? (proseEl.textContent || '').trim() : (msg.textContent || msg.innerText || '').trim();
            // Strip accessibility prefixes (e.g. Gemini adds "You said" for screen readers)
            text = text.replace(/^You said\s*/i, '');
            if (!text.trim()) return;
            var navItem = createNavItem(msg, index, text);
            if (isVirtualScroll) {
                var key = text.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
                _vsAccumulatedKeys.add(key);
                navItem.setAttribute('data-text-key', key);
                var virtuosoItem = msg.closest('[data-index]');
                if (virtuosoItem) navItem.setAttribute('data-vs-index', virtuosoItem.getAttribute('data-index'));
            }
            list.appendChild(navItem);
        });
    }

    // === INITIALIZATION (with duplicate guards) ===

    if (!document.getElementById('ai-nav-button-container')) {
        var initContainer = createButtonContainer();
        if (isLeftChat) initContainer.style.display = 'none';
        document.body.appendChild(initContainer);
    }
    if (!document.getElementById('ai-nav-panel')) {
        var initNavPanel = createPanel();
        if (isLeftChat) initNavPanel.style.display = 'none';
        document.body.appendChild(initNavPanel);
    }
    if (platform.contextTracking && !document.getElementById('ai-context-panel')) {
        var initCtxPanel = createContextPanel();
        if (isLeftChat) initCtxPanel.style.display = 'none';
        document.body.appendChild(initCtxPanel);
    }

    // Start the DOM Guardian AFTER initial elements are in place
    startDOMGuardian();

    // SPA navigation hooks for platforms with aggressive DOM re-rendering
    if (platform.spa) {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
            originalPushState.apply(this, arguments);
            if (isVirtualScroll) _vsAccumulatedKeys.clear(); // reset on navigation
            setTimeout(ensureElementsExist, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };
        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };

        window.addEventListener('popstate', function () {
            if (isVirtualScroll) _vsAccumulatedKeys.clear(); // reset on navigation
            setTimeout(ensureElementsExist, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        });

        // Periodic health check (every 3 seconds) — these SPAs can silently remove injected elements
        setInterval(ensureElementsExist, 3000);
    }

    // Left-chat: position button at chat boundary on init, resize, and periodically
    if (isLeftChat) {
        // Initial positioning — rapid retries for fast-rendering platforms,
        // then longer delays for slow-rendering ones (SPA frameworks)
        setTimeout(updateLeftChatPositions, 500);
        setTimeout(updateLeftChatPositions, 900);
        setTimeout(updateLeftChatPositions, 1500);
        setTimeout(updateLeftChatPositions, 3000);
        setTimeout(updateLeftChatPositions, 6000);

        // Reposition on window resize (right is viewport-relative)
        window.addEventListener('resize', function () {
            _lastBoundaryX = null; // force recalculation
            if (isNavOpen || isContextOpen) {
                var bx = getChatBoundaryX() || (window.innerWidth * 0.35);
                var panelRight = (window.innerWidth - bx) + 'px';
                var containerRight = (window.innerWidth - bx + 320) + 'px';

                var navPanel = document.getElementById('ai-nav-panel');
                var ctxPanel = document.getElementById('ai-context-panel');
                var container = document.getElementById('ai-nav-button-container');

                if (isNavOpen && navPanel) navPanel.style.right = panelRight;
                if (isContextOpen && ctxPanel) ctxPanel.style.right = panelRight;
                if (container) container.style.right = containerRight;
            } else {
                updateLeftChatPositions();
            }
        });

        // Scroll listener — repositions button when page/chat scrolls (boundary can shift)
        window.addEventListener('scroll', function () {
            if (!isNavOpen && !isContextOpen) {
                updateLeftChatPositions();
            }
        }, { passive: true });

        // Periodic boundary check (chat panels can resize dynamically)
        setInterval(function () {
            if (!isNavOpen && !isContextOpen) {
                updateLeftChatPositions();
            }
        }, 3000);
    }

    // Install fetch interceptor for Tier 2 token tracking (experimental)
    try {
        installFetchInterceptor();
    } catch (e) {
        console.log('AI Nav: Fetch interceptor failed to install (non-critical):', e.message);
    }

    // Initial scan after page load
    setTimeout(scanConversation, 2000);

    // Firebase Studio and other heavy SPAs: chat may not render within 2 seconds.
    // Add aggressive retries for platforms that lazy-load their chat panels.
    if (platform.retryDelays.length > 0) {
        platform.retryDelays.forEach(function (delay) {
            setTimeout(function () {
                var items = document.querySelectorAll('.ai-nav-item');
                if (items.length === 0) {
                    console.log('AI Nav: Firebase retry scan at ' + delay + 'ms...');
                    scanConversation();
                }
            }, delay);
        });
    }

    console.log('AI Conversation Navigator v9.3 loaded for ' + siteTitle + (isLeftChat ? ' (left-chat mode)' : '') + '!');
})();
