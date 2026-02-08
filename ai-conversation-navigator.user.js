// ==UserScript==
// @name         AI Conversation Navigator
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  Adds a sidebar with bookmarks to navigate long conversations on Claude, ChatGPT, Grok, and Gemini
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://grok.com/*
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Detect which site we're on
    const SITE = {
        CLAUDE: 'claude',
        CHATGPT: 'chatgpt',
        GROK: 'grok',
        GEMINI: 'gemini'
    };

    function detectSite() {
        const hostname = window.location.hostname;
        if (hostname.includes('claude.ai')) return SITE.CLAUDE;
        if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return SITE.CHATGPT;
        if (hostname.includes('grok.com')) return SITE.GROK;
        if (hostname.includes('gemini.google.com')) return SITE.GEMINI;
        return null;
    }

    const currentSite = detectSite();
    if (!currentSite) {
        console.log('AI Conversation Navigator: Unknown site, exiting.');
        return;
    }

    // Site-specific colors
    const THEME = {
        [SITE.CLAUDE]: { accent: '#d97706', accentHover: '#b45309', accentLight: 'rgba(217, 119, 6, 0.2)', textColor: 'white' },
        [SITE.CHATGPT]: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)', textColor: '#1a1a1a' },
        [SITE.GROK]: { accent: '#dc2626', accentHover: '#b91c1c', accentLight: 'rgba(220, 38, 38, 0.2)', textColor: 'white' },
        [SITE.GEMINI]: { accent: '#4285f4', accentHover: '#3367d6', accentLight: 'rgba(66, 133, 244, 0.2)', textColor: 'white' }
    };

    const theme = THEME[currentSite];

    // Site-specific icons (common symbols to avoid trademark/copyright issues)
    // ✳ Eight-spoked asterisk for Claude (evokes Anthropic's starburst)
    // ⏣ Benzene ring for ChatGPT (evokes OpenAI's hexagonal logo)
    // X for Grok (xAI / X branding)
    // ✦ Four-pointed star for Gemini (evokes Gemini's sparkle)
    const ICONS = {
        [SITE.CLAUDE]: '\u2733',   // ✳
        [SITE.CHATGPT]: '\u23E3',  // ⏣
        [SITE.GROK]: 'X',
        [SITE.GEMINI]: '\u2726'    // ✦
    };

    const siteIcon = ICONS[currentSite];

    // Site-specific title
    const siteTitles = {
        [SITE.CLAUDE]: 'Claude',
        [SITE.CHATGPT]: 'ChatGPT',
        [SITE.GROK]: 'Grok',
        [SITE.GEMINI]: 'Gemini'
    };
    const siteTitle = siteTitles[currentSite];

    // Inject styles
    const styles = `
        /* === HOVER-EXPAND TOGGLE BUTTON === */
        #ai-nav-toggle {
            position: fixed !important;
            right: 0 !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            z-index: 2147483647 !important;
            background: ${theme.accent} !important;
            color: ${theme.textColor} !important;
            border: ${currentSite === SITE.CHATGPT ? '1px solid #333' : 'none'} !important;
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
        }
        #ai-nav-toggle:hover {
            padding-right: 16px !important;
        }
        #ai-nav-toggle .ai-nav-expand-text {
            max-width: 0 !important;
            opacity: 0 !important;
            overflow: hidden !important;
            transition: max-width 0.25s ease, opacity 0.2s ease, margin-left 0.25s ease !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            margin-left: 0 !important;
        }
        #ai-nav-toggle:hover .ai-nav-expand-text {
            max-width: 80px !important;
            opacity: 1 !important;
            margin-left: 10px !important;
        }
        #ai-nav-toggle.open {
            right: 320px !important;
        }

        /* === NAVIGATION PANEL === */
        #ai-nav-panel {
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
        #ai-nav-panel.open {
            right: 0 !important;
        }

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
            color: ${currentSite === SITE.CHATGPT ? '#aaa' : theme.accent};
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
    let isOpen = false;
    let scanInterval = null;

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

    // --- Create toggle button (hover-expand: icon only, text appears on hover) ---
    function createToggle() {
        const btn = createElement('button', { id: 'ai-nav-toggle', onClick: handleToggleClick }, [
            document.createTextNode(siteIcon),
            createElement('span', { className: 'ai-nav-expand-text', textContent: 'Navigate' })
        ]);
        return btn;
    }

    // --- Create panel (fully programmatic, no innerHTML) ---
    function createPanel() {
        const header = createElement('div', { id: 'ai-nav-header' }, [
            createElement('h3', null, [siteIcon + ' ' + siteTitle + ' - Your Questions']),
            createElement('button', {
                id: 'ai-nav-refresh',
                textContent: '\u21BB Refresh',
                onClick: scanConversation
            })
        ]);

        const stats = createElement('div', { id: 'ai-nav-stats' });
        const list = createElement('div', { id: 'ai-nav-list' });

        return createElement('div', { id: 'ai-nav-panel' }, [header, stats, list]);
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

        item.addEventListener('click', function() {
            msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            var originalBg = msg.style.backgroundColor;
            msg.style.backgroundColor = theme.accentLight;
            msg.style.transition = 'background-color 0.3s';
            setTimeout(function() {
                msg.style.backgroundColor = originalBg;
            }, 1500);
        });

        return item;
    }

    // --- Single unified toggle handler ---
    function handleToggleClick() {
        ensureElementsExist();

        const panel = document.getElementById('ai-nav-panel');
        const toggle = document.getElementById('ai-nav-toggle');

        if (!panel || !toggle) {
            console.warn('AI Nav: Elements missing even after re-inject attempt.');
            return;
        }

        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
        toggle.classList.toggle('open', isOpen);

        if (isOpen) {
            scanConversation();
            if (scanInterval) clearInterval(scanInterval);
            scanInterval = setInterval(scanConversation, 10000);
        } else {
            if (scanInterval) {
                clearInterval(scanInterval);
                scanInterval = null;
            }
        }
    }

    // --- Ensure our elements exist in the DOM ---
    function ensureElementsExist() {
        if (!document.getElementById('ai-nav-style')) {
            const s = document.createElement('style');
            s.id = 'ai-nav-style';
            s.textContent = styles;
            document.head.appendChild(s);
            console.log('AI Nav: Re-injected styles.');
        }

        if (!document.getElementById('ai-nav-panel')) {
            const panel = createPanel();
            document.body.appendChild(panel);
            if (isOpen) panel.classList.add('open');
            console.log('AI Nav: Re-injected panel.');
        }

        if (!document.getElementById('ai-nav-toggle')) {
            const toggle = createToggle();
            document.body.appendChild(toggle);
            if (isOpen) toggle.classList.add('open');
            console.log('AI Nav: Re-injected toggle button.');
        }
    }

    // --- DOM Guardian ---
    function startDOMGuardian() {
        const observer = new MutationObserver(function() {
            if (!document.getElementById('ai-nav-toggle') || !document.getElementById('ai-nav-panel')) {
                console.log('AI Nav: DOM Guardian detected missing elements, re-injecting...');
                ensureElementsExist();
            }
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
        let messages = [];

        if (currentSite === SITE.CLAUDE) {
            messages = document.querySelectorAll('[data-testid="user-human-turn"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-testid="user-message"]');
            if (messages.length === 0) messages = document.querySelectorAll('.font-user-message');
        }
        else if (currentSite === SITE.CHATGPT) {
            const allMessages = document.querySelectorAll('[data-message-author-role]');
            messages = Array.from(allMessages).filter(function(msg) {
                return msg.getAttribute('data-message-author-role') === 'user';
            });
        }
        else if (currentSite === SITE.GROK) {
            const allBubbles = document.querySelectorAll('div.message-bubble');
            if (allBubbles.length > 0) {
                messages = Array.from(allBubbles).filter(function(bubble, index) {
                    const classList = bubble.className.toLowerCase();
                    if (classList.includes('user') || classList.includes('human')) return true;
                    const parent = bubble.closest('[class*="user"], [class*="human"], [data-role="user"]');
                    if (parent) return true;
                    return index % 2 === 0;
                });
            }
            if (messages.length === 0) messages = document.querySelectorAll('[data-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[class*="user-message"]');
        }
        else if (currentSite === SITE.GEMINI) {
            messages = document.querySelectorAll('div.query-text');
            if (messages.length === 0) messages = document.querySelectorAll('.query-text-line');
            if (messages.length === 0) messages = document.querySelectorAll('p.query-text-line');
            if (messages.length === 0) messages = document.querySelectorAll('[data-query-text]');
            if (messages.length === 0) messages = document.querySelectorAll('.user-query');
        }

        return messages;
    }

    // --- Scan conversation for user messages ---
    function scanConversation() {
        ensureElementsExist();

        const list = document.getElementById('ai-nav-list');
        const stats = document.getElementById('ai-nav-stats');
        if (!list || !stats) return;

        const messages = getUserMessages();

        // Clear list safely (no innerHTML)
        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }

        if (messages.length === 0) {
            list.appendChild(createEmptyMessage());
            stats.textContent = '0 questions found';
            return;
        }

        stats.textContent = messages.length + ' question' + (messages.length !== 1 ? 's' : '') + ' found';

        messages.forEach(function(msg, index) {
            const text = msg.textContent || msg.innerText || '';
            if (!text.trim()) return;
            list.appendChild(createNavItem(msg, index, text));
        });
    }

    // === INITIALIZATION ===

    document.body.appendChild(createToggle());
    document.body.appendChild(createPanel());

    // Start the DOM Guardian (critical for Gemini)
    startDOMGuardian();

    // SPA navigation hooks for Gemini
    if (currentSite === SITE.GEMINI) {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function() {
            originalPushState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
        };
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
        };

        window.addEventListener('popstate', function() {
            setTimeout(ensureElementsExist, 500);
        });

        // Periodic health check for Gemini (every 3 seconds)
        setInterval(ensureElementsExist, 3000);
    }

    // Initial scan after page load
    setTimeout(scanConversation, 2000);

    console.log('AI Conversation Navigator v6.0 loaded for ' + siteTitle + '!');
})();
