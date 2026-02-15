// ==UserScript==
// @name         AI Conversation Navigator v7.1
// @namespace    http://tampermonkey.net/
// @version      7.1
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
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // === DUPLICATE EXECUTION GUARD ===
    // On Linux Firefox, Tampermonkey can fire the script twice or the
    // MutationObserver can race with initialization. This prevents duplicates.
    if (window._aiNavAlreadyLoaded) {
        console.log('AI Nav: Script already loaded, skipping duplicate execution.');
        return;
    }
    window._aiNavAlreadyLoaded = true;

    // Detect which site we're on
    const SITE = {
        CLAUDE: 'claude',
        CHATGPT: 'chatgpt',
        GROK: 'grok',
        GEMINI: 'gemini',
        BOLT: 'bolt',
        LOVABLE: 'lovable',
        REPLIT: 'replit',
        V0: 'v0',
        BASE44: 'base44',
        EMERGENT: 'emergent',
        PERPLEXITY: 'perplexity',
        FIREBASE_STUDIO: 'firebase_studio'
    };

    function detectSite() {
        const hostname = window.location.hostname;
        if (hostname.includes('claude.ai')) return SITE.CLAUDE;
        if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return SITE.CHATGPT;
        if (hostname.includes('grok.com')) return SITE.GROK;
        if (hostname.includes('gemini.google.com')) return SITE.GEMINI;
        if (hostname === 'bolt.new') return SITE.BOLT;
        if (hostname.includes('lovable.dev')) return SITE.LOVABLE;
        if (hostname.includes('replit.com')) return SITE.REPLIT;
        if (hostname.includes('v0.app')) return SITE.V0;
        if (hostname.includes('base44.com')) return SITE.BASE44;
        if (hostname.includes('emergent.sh')) return SITE.EMERGENT;
        if (hostname.includes('perplexity.ai')) return SITE.PERPLEXITY;
        if (hostname.includes('studio.firebase.google.com')) return SITE.FIREBASE_STUDIO;
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
        [SITE.GEMINI]: { accent: '#4285f4', accentHover: '#3367d6', accentLight: 'rgba(66, 133, 244, 0.2)', textColor: 'white' },
        [SITE.BOLT]: { accent: '#38BDF8', accentHover: '#0EA5E9', accentLight: 'rgba(56, 189, 248, 0.2)', textColor: 'white' },
        [SITE.LOVABLE]: { accent: '#9b87f5', accentHover: '#7c3aed', accentLight: 'rgba(155, 135, 245, 0.2)', textColor: 'white' },
        [SITE.REPLIT]: { accent: '#F26522', accentHover: '#D4541A', accentLight: 'rgba(242, 101, 34, 0.2)', textColor: 'white' },
        [SITE.V0]: { accent: '#ffffff', accentHover: '#e0e0e0', accentLight: 'rgba(255, 255, 255, 0.15)', textColor: '#1a1a1a' },
        [SITE.BASE44]: { accent: '#6366f1', accentHover: '#4f46e5', accentLight: 'rgba(99, 102, 241, 0.2)', textColor: 'white' },
        [SITE.EMERGENT]: { accent: '#10b981', accentHover: '#059669', accentLight: 'rgba(16, 185, 129, 0.2)', textColor: 'white' },
        [SITE.PERPLEXITY]: { accent: '#20b8cd', accentHover: '#1a9aab', accentLight: 'rgba(32, 184, 205, 0.2)', textColor: 'white' },
        [SITE.FIREBASE_STUDIO]: { accent: '#f59e0b', accentHover: '#d97706', accentLight: 'rgba(245, 158, 11, 0.2)', textColor: 'white' }
    };

    const theme = THEME[currentSite];

    // Site-specific icons (common symbols to avoid trademark/copyright issues)
    const ICONS = {
        [SITE.CLAUDE]: '\u2733',   // ✳
        [SITE.CHATGPT]: '\u23E3',  // ⏣
        [SITE.GROK]: 'X',
        [SITE.GEMINI]: '\u2726',   // ✦
        [SITE.BOLT]: '\u26A1\uFE0E',  // ⚡ (lightning bolt, text presentation)
        [SITE.LOVABLE]: '\u2665',  // ♥ (heart suit)
        [SITE.REPLIT]: '\u2815',   // ⠕ (Braille dots-135, Replit prompt logo)
        [SITE.V0]: '\u25B3',      // △ (triangle, Vercel logo shape)
        [SITE.BASE44]: '\u2B22',  // ⬢ (hexagon)
        [SITE.EMERGENT]: '\u2736', // ✶ (six-pointed star)
        [SITE.PERPLEXITY]: '\u29BE', // ⦾ (circled white bullet)
        [SITE.FIREBASE_STUDIO]: '\u2B50\uFE0E' // ★ (star, text presentation)
    };

    const siteIcon = ICONS[currentSite];

    // Site-specific title
    const siteTitles = {
        [SITE.CLAUDE]: 'Claude',
        [SITE.CHATGPT]: 'ChatGPT',
        [SITE.GROK]: 'Grok',
        [SITE.GEMINI]: 'Gemini',
        [SITE.BOLT]: 'Bolt',
        [SITE.LOVABLE]: 'Lovable',
        [SITE.REPLIT]: 'Replit',
        [SITE.V0]: 'V0',
        [SITE.BASE44]: 'Base44',
        [SITE.EMERGENT]: 'Emergent',
        [SITE.PERPLEXITY]: 'Perplexity',
        [SITE.FIREBASE_STUDIO]: 'Firebase Studio'
    };
    const siteTitle = siteTitles[currentSite];

    // Left-chat platforms: chat panel on the left, workspace on the right.
    // These get the ghost notch button (inside chat, flush against right boundary).
    const LEFT_CHAT_SITES = [SITE.BOLT, SITE.LOVABLE, SITE.REPLIT, SITE.V0, SITE.BASE44, SITE.EMERGENT];
    const isLeftChat = LEFT_CHAT_SITES.includes(currentSite);

    // Inject styles — toggle button and panel differ for left-chat vs standard platforms
    const toggleStyles = isLeftChat ? `
        /* === GHOST NOTCH V1 TOGGLE (left-chat platforms) === */
        #ai-nav-toggle {
            position: fixed !important;
            left: auto !important;
            right: 65%;
            top: 50% !important;
            transform: translateY(-50%) !important;
            z-index: 2147483647 !important;
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
        }
        #ai-nav-toggle .ai-nav-icon {
            font-size: 14px !important;
            opacity: 0 !important;
            transform: scale(0.6) !important;
            transition: opacity 0.25s ease 0.05s, transform 0.25s ease 0.05s !important;
        }
        #ai-nav-toggle .ai-nav-expand-text {
            display: none !important;
        }
        #ai-nav-toggle.ai-nav-positioned {
            opacity: 0.35 !important;
        }
        #ai-nav-toggle:hover {
            width: 32px !important;
            height: 40px !important;
            opacity: 1 !important;
            border-radius: 6px 0 0 6px !important;
        }
        #ai-nav-toggle:hover .ai-nav-icon {
            opacity: 1 !important;
            transform: scale(1) !important;
        }
        #ai-nav-toggle.open {
            opacity: 1 !important;
            width: 32px !important;
            height: 40px !important;
        }
        #ai-nav-toggle.open .ai-nav-icon {
            opacity: 1 !important;
            transform: scale(1) !important;
        }
    ` : `
        /* === STANDARD HOVER-EXPAND TOGGLE (right-edge platforms) === */
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
    `;

    const panelStyles = isLeftChat ? `
        /* === NAVIGATION PANEL (left-chat: anchored at boundary, reveals leftward) === */
        #ai-nav-panel {
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
        #ai-nav-panel.open {
            clip-path: inset(0 0 0 0) !important;
            pointer-events: auto !important;
        }
    ` : `
        /* === NAVIGATION PANEL (standard: slides from right) === */
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

    // --- Detect chat panel right edge for left-chat platforms ---
    // Walk up from an element to find the chat panel container, return its right edge
    function _walkUpToChatContainer(startEl) {
        var el = startEl;
        while (el && el !== document.body) {
            var rect = el.getBoundingClientRect();
            // Chat panel: starts in the left portion of the viewport (allowing for icon sidebars
            // up to ~80px), reasonable width (200-55% of viewport), and tall (≥40% viewport).
            if (rect.left < 80 && rect.width > 200 && rect.width < window.innerWidth * 0.55 &&
                rect.height > window.innerHeight * 0.4) {
                return rect.right;
            }
            el = el.parentElement;
        }
        return null;
    }

    function getChatBoundaryX() {
        if (!isLeftChat) return null;

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
        var msgSelectors = {
            bolt: '[class*="backdrop-blur"][class*="rounded"], [class*="max-w-chat"]',
            lovable: 'div[role="log"], div.ChatMessageContainer, .justify-end',
            replit: '[data-testid*="user-message"], [data-message-role="user"], [role="log"]',
            v0: '[data-role="user"], [data-message-role="user"]',
            base44: '[id^="message-"]',
            emergent: '[data-testid^="user-message"], [id^="user-"]'
        };
        var sel = msgSelectors[currentSite];
        if (sel) {
            var msgEl = document.querySelector(sel);
            if (msgEl) {
                var boundary = _walkUpToChatContainer(msgEl);
                if (boundary) return boundary;
            }
        }

        // Last resort: assume chat is roughly 35% of viewport
        return window.innerWidth * 0.35;
    }

    // --- Position toggle button AND panel at the chat boundary ---
    var _lastBoundaryX = null;
    var _boundaryDetected = false;
    function updateLeftChatPositions() {
        if (!isLeftChat) return;

        var boundaryX = getChatBoundaryX();
        if (!boundaryX) return;

        // Only update if boundary changed significantly (avoid jitter)
        if (_lastBoundaryX && Math.abs(boundaryX - _lastBoundaryX) < 3) return;
        _lastBoundaryX = boundaryX;

        var rightVal = (window.innerWidth - boundaryX) + 'px';

        // Panel: right edge anchored at boundary (always, open or closed)
        var panel = document.getElementById('ai-nav-panel');
        if (panel) {
            panel.style.right = rightVal;
        }

        // Button: right edge at boundary when closed, pushed left by 320 when open
        var toggle = document.getElementById('ai-nav-toggle');
        if (toggle && !isOpen) {
            toggle.style.right = rightVal;
            // First successful detection: fade in the button (it starts at opacity 0)
            if (!_boundaryDetected) {
                _boundaryDetected = true;
                requestAnimationFrame(function() {
                    toggle.classList.add('ai-nav-positioned');
                });
            }
        }
    }

    // --- Create toggle button ---
    function createToggle() {
        var btn;
        if (isLeftChat) {
            // Ghost notch V1: icon wrapped in span for scale animation
            btn = createElement('button', { id: 'ai-nav-toggle', onClick: handleToggleClick }, [
                createElement('span', { className: 'ai-nav-icon', textContent: siteIcon })
            ]);
        } else {
            // Standard: icon + expandable text
            btn = createElement('button', { id: 'ai-nav-toggle', onClick: handleToggleClick }, [
                document.createTextNode(siteIcon),
                createElement('span', { className: 'ai-nav-expand-text', textContent: 'Navigate' })
            ]);
        }
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
            // For left-chat platforms, close panel first since it overlays the chat
            if (isLeftChat && isOpen) {
                handleToggleClick(); // close panel
                // Scroll after panel close animation completes
                setTimeout(function() {
                    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    var originalBg = msg.style.backgroundColor;
                    msg.style.backgroundColor = theme.accentLight;
                    msg.style.transition = 'background-color 0.3s';
                    setTimeout(function() {
                        msg.style.backgroundColor = originalBg;
                    }, 1500);
                }, 350);
            } else {
                msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                var originalBg = msg.style.backgroundColor;
                msg.style.backgroundColor = theme.accentLight;
                msg.style.transition = 'background-color 0.3s';
                setTimeout(function() {
                    msg.style.backgroundColor = originalBg;
                }, 1500);
            }
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

        // For left-chat: push button left by panel width (mirrors standard right: 0 → 320)
        if (isLeftChat && toggle) {
            var bx = _lastBoundaryX || getChatBoundaryX() || (window.innerWidth * 0.35);
            if (isOpen) {
                // Button pushed left by 320px from boundary — sits at panel's left edge
                toggle.style.right = (window.innerWidth - bx + 320) + 'px';
            } else {
                // Restore to boundary position
                _lastBoundaryX = null; // force recalculation
                updateLeftChatPositions();
            }
        }

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

    // --- Ensure our elements exist in the DOM (with duplicate cleanup) ---
    function ensureElementsExist() {
        // --- Remove any duplicates first ---
        const toggles = document.querySelectorAll('#ai-nav-toggle');
        const panels = document.querySelectorAll('#ai-nav-panel');
        const styleEls = document.querySelectorAll('#ai-nav-style');

        if (toggles.length > 1) {
            for (let i = 1; i < toggles.length; i++) toggles[i].remove();
            console.log('AI Nav: Removed ' + (toggles.length - 1) + ' duplicate toggle(s).');
        }
        if (panels.length > 1) {
            for (let i = 1; i < panels.length; i++) panels[i].remove();
            console.log('AI Nav: Removed ' + (panels.length - 1) + ' duplicate panel(s).');
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

    // --- DOM Guardian (debounced to prevent race conditions on Linux Firefox) ---
    function startDOMGuardian() {
        let guardianTimeout = null;

        const observer = new MutationObserver(function() {
            if (guardianTimeout) clearTimeout(guardianTimeout);
            guardianTimeout = setTimeout(function() {
                if (!document.getElementById('ai-nav-toggle') || !document.getElementById('ai-nav-panel')) {
                    console.log('AI Nav: DOM Guardian detected missing elements, re-injecting...');
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
        let messages = [];

        if (currentSite === SITE.CLAUDE) {
            // Claude Chat selectors
            messages = document.querySelectorAll('[data-testid="user-human-turn"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-testid="user-message"]');
            if (messages.length === 0) messages = document.querySelectorAll('.font-user-message');

            // Claude Code fallback: no data-testid attributes exist; user messages
            // are right-aligned (items-end + ml-auto) with bg-bg-200 bubbles.
            if (messages.length === 0) {
                const bubbles = document.querySelectorAll('div.bg-bg-200.rounded-lg');
                messages = Array.from(bubbles).filter(function(bubble) {
                    return bubble.closest('.items-end');
                });
            }
        }
        else if (currentSite === SITE.CHATGPT) {
            const allMessages = document.querySelectorAll('[data-message-author-role]');
            messages = Array.from(allMessages).filter(function(msg) {
                return msg.getAttribute('data-message-author-role') === 'user';
            });

            // Codex web fallback: chatgpt.com/codex uses a task/thread-based interface
            // with different DOM structure from ChatGPT chat. No data-message-author-role
            // attributes exist; user messages are right-aligned (self-end) bubbles with
            // bg-token-bg-tertiary background.
            if (messages.length === 0) {
                messages = document.querySelectorAll('div.self-end.bg-token-bg-tertiary');
            }
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
        else if (currentSite === SITE.BOLT) {
            // Bolt.new user messages: right-aligned bubbles with accent background + backdrop blur.
            // Built with UnoCSS (Tailwind-like). User messages have bg-accent-500/10 + backdrop-blur-sm
            // + ml-auto (right-aligned). Assistant messages have overflow-hidden + w-full (left/full-width).
            // Source: bolt.diy open-source fork (UserMessage.tsx, AssistantMessage.tsx)

            // Primary: accent-tinted backdrop-blur bubbles that are NOT full-width (user only)
            var boltCandidates = document.querySelectorAll('[class*="backdrop-blur"][class*="rounded"]');
            if (boltCandidates.length > 0) {
                messages = Array.from(boltCandidates).filter(function(el) {
                    var cls = el.className || '';
                    return !cls.includes('w-full') && el.textContent.trim().length > 0;
                });
            }

            // Fallback 1: right-aligned rounded bubbles inside chat area
            if (messages.length === 0) {
                var mlAutoBubbles = document.querySelectorAll('.ml-auto.rounded-lg, .ml-auto.rounded-xl');
                messages = Array.from(mlAutoBubbles).filter(function(el) {
                    return el.textContent.trim().length > 0;
                });
            }

            // Fallback 2: distinguish by structure — assistant root is overflow-hidden w-full,
            // user root is NOT. Check direct children of the grid wrapper.
            if (messages.length === 0) {
                var gridChildren = document.querySelectorAll('.grid.w-full > div');
                messages = Array.from(gridChildren).filter(function(el) {
                    var cls = el.className || '';
                    // User messages do NOT have the overflow-hidden + w-full combo
                    var isAssistant = cls.includes('overflow-hidden') && cls.includes('w-full');
                    return !isAssistant && el.textContent.trim().length > 0;
                });
            }

            // Fallback 3: computed style check — user messages have a non-transparent background
            if (messages.length === 0) {
                var chatArea = document.querySelector('[class*="max-w-chat"]');
                if (chatArea) {
                    var cells = chatArea.querySelectorAll('.grid > div');
                    messages = Array.from(cells).filter(function(el) {
                        var bg = window.getComputedStyle(el).backgroundColor;
                        return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
                    });
                }
            }
        }
        else if (currentSite === SITE.LOVABLE) {
            // Lovable user messages: right-aligned bubbles (justify-end) with neutral background.
            // Built with React + Tailwind + shadcn/ui. Split-panel layout (chat left, preview right).
            // User messages have justify-end wrapper + bg-neutral-200/700 rounded-xl bubble + ml-auto.
            // Assistant messages are left-aligned with no background and prose class for markdown.
            // Source: Adorable open-source clone, Lovable.dev Add-ons extension

            // Guard: only scan on project pages where the chat exists
            if (window.location.pathname.includes('/projects/')) {
                // Primary: ARIA role="log" container + right-aligned message wrappers
                var chatLog = document.querySelector('div[role="log"]');
                if (chatLog) {
                    messages = Array.from(chatLog.querySelectorAll('.justify-end')).filter(function(el) {
                        return el.textContent.trim().length > 0;
                    });
                }

                // Fallback 1: neutral-background bubbles inside right-aligned containers
                if (messages.length === 0) {
                    var lovableBubbles = document.querySelectorAll(
                        'div.bg-neutral-200.rounded-xl, div.bg-neutral-700.rounded-xl'
                    );
                    messages = Array.from(lovableBubbles).filter(function(el) {
                        return el.closest('.justify-end') || el.classList.contains('ml-auto');
                    });
                }

                // Fallback 2: ChatMessageContainer class (from extension DOM utils)
                if (messages.length === 0) {
                    var lovableContainer = document.querySelector('div.ChatMessageContainer');
                    if (lovableContainer) {
                        messages = Array.from(lovableContainer.querySelectorAll('.justify-end')).filter(function(el) {
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
                        messages = Array.from(lovableMain.querySelectorAll('div')).filter(function(el) {
                            var cls = el.className || '';
                            var isRightAligned = cls.includes('justify-end') || cls.includes('self-end') || cls.includes('ml-auto');
                            var hasText = el.textContent.trim().length > 5;
                            var isNotNav = !el.closest('nav') && !el.closest('header');
                            return isRightAligned && hasText && isNotNav;
                        });
                    }
                }
            }
        }
        else if (currentSite === SITE.REPLIT) {
            // Replit user messages: React + Emotion CSS-in-JS (hash classes change per deployment).
            // The AI Agent chat is a pane inside the IDE workspace. Cannot rely on class names.
            // Must use data-* attributes, ARIA roles, structural patterns, and computed styles.
            // Source: Replit engineering blog (RUI, Emotion, Jotai architecture)

            // Primary: data-* attribute selectors (if Replit uses them)
            messages = document.querySelectorAll('[data-testid*="user-message"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-message-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-role="user"]');

            // Fallback 1: ARIA role="log" container + structural analysis
            if (messages.length === 0) {
                var replitLog = document.querySelector('[role="log"]');
                if (!replitLog) replitLog = document.querySelector('[role="list"][aria-label*="chat"]');
                if (replitLog) {
                    // User messages typically have a distinct background or alignment
                    var replitBlocks = replitLog.querySelectorAll(':scope > div > div, :scope > div');
                    messages = Array.from(replitBlocks).filter(function(el) {
                        var cls = el.className || '';
                        var style = window.getComputedStyle(el);
                        // User messages are often right-aligned or have a non-transparent bg
                        var isRightAligned = cls.includes('end') || cls.includes('right') ||
                            style.marginLeft === 'auto' || style.alignSelf === 'flex-end';
                        var hasDistinctBg = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                            style.backgroundColor !== 'transparent';
                        return (isRightAligned || hasDistinctBg) && el.textContent.trim().length > 0;
                    });
                }
            }

            // Fallback 2: find chat panel via textarea, then scan siblings
            if (messages.length === 0) {
                var replitInput = document.querySelector('textarea[placeholder*="message"]') ||
                    document.querySelector('textarea[placeholder*="Message"]') ||
                    document.querySelector('[contenteditable="true"][role="textbox"]');
                if (replitInput) {
                    var replitChat = replitInput.closest('[class*="css-"]');
                    if (replitChat && replitChat.parentElement) {
                        var scrollContainer = replitChat.parentElement.querySelector('[style*="overflow"]') ||
                            replitChat.parentElement;
                        var allBlocks = scrollContainer.querySelectorAll('div');
                        messages = Array.from(allBlocks).filter(function(el) {
                            var style = window.getComputedStyle(el);
                            var isAlignedRight = style.marginLeft === 'auto' || style.alignSelf === 'flex-end' ||
                                style.textAlign === 'right';
                            var hasContent = el.textContent.trim().length > 5;
                            var isLeaf = el.querySelectorAll('div').length < 3;
                            return isAlignedRight && hasContent && isLeaf;
                        });
                    }
                }
            }
        }
        else if (currentSite === SITE.V0) {
            // V0 (Vercel): chat on left side of app builder.
            // User messages are right-aligned within the chat panel.
            // Try data attributes first, then structural patterns.
            messages = document.querySelectorAll('[data-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-message-role="user"]');

            // Fallback: right-aligned message bubbles
            if (messages.length === 0) {
                var v0Bubbles = document.querySelectorAll('.justify-end, .self-end, .ml-auto');
                messages = Array.from(v0Bubbles).filter(function(el) {
                    var hasText = el.textContent.trim().length > 3;
                    var isInChat = !el.closest('nav') && !el.closest('header');
                    var isLeaf = el.querySelectorAll('.justify-end, .self-end').length === 0;
                    return hasText && isInChat && isLeaf;
                });
            }
        }
        else if (currentSite === SITE.BASE44) {
            // Base44: messages have id="message-{uuid}".
            // User messages contain a parent div with justify-end (right-aligned).
            // AI messages do not have justify-end.
            var base44Messages = document.querySelectorAll('[id^="message-"]');
            messages = Array.from(base44Messages).filter(function(el) {
                return el.querySelector('.justify-end') && el.textContent.trim().length > 0;
            });

            // Fallback: look for bg-slate-200 bubbles (user message style)
            if (messages.length === 0) {
                messages = document.querySelectorAll('.bg-slate-200.rounded-xl');
            }
        }
        else if (currentSite === SITE.EMERGENT) {
            // Emergent: user messages have data-testid="user-message-{id}".
            // Very reliable selector.
            messages = document.querySelectorAll('[data-testid^="user-message"]');

            // Fallback: id starts with "user-"
            if (messages.length === 0) {
                messages = document.querySelectorAll('[id^="user-"]');
            }
        }
        else if (currentSite === SITE.PERPLEXITY) {
            // Perplexity: user queries use the class group/query.
            // This is a Tailwind group variant class — very reliable identifier.
            var perplexityQueries = document.querySelectorAll('.group\\/query');
            messages = Array.from(perplexityQueries).filter(function(el) {
                return el.textContent.trim().length > 0;
            });

            // Fallback: look for query text spans
            if (messages.length === 0) {
                messages = document.querySelectorAll('.group\\/title .select-text');
            }
        }
        else if (currentSite === SITE.FIREBASE_STUDIO) {
            // Firebase Studio (Gemini): CSS module classes with _isUser_ prefix.
            // The hash suffix changes per build, but _isUser_ stays consistent.
            var firebaseMessages = document.querySelectorAll('[class*="_isUser_"]');
            messages = Array.from(firebaseMessages).filter(function(el) {
                return el.textContent.trim().length > 0;
            });

            // Fallback: _chatMessage_ class (all messages), then filter by _isUser_
            if (messages.length === 0) {
                var allFirebaseMessages = document.querySelectorAll('[class*="_chatMessage_"]');
                messages = Array.from(allFirebaseMessages).filter(function(el) {
                    return (el.className || '').includes('_isUser_');
                });
            }
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
            let text = (msg.textContent || msg.innerText || '').trim();
            // Strip accessibility prefixes (e.g. Gemini adds "You said" for screen readers)
            text = text.replace(/^You said\s*/i, '');
            if (!text.trim()) return;
            list.appendChild(createNavItem(msg, index, text));
        });
    }

    // === INITIALIZATION (with duplicate guards) ===

    if (!document.getElementById('ai-nav-toggle')) {
        document.body.appendChild(createToggle());
    }
    if (!document.getElementById('ai-nav-panel')) {
        document.body.appendChild(createPanel());
    }

    // Start the DOM Guardian AFTER initial elements are in place
    startDOMGuardian();

    // SPA navigation hooks for platforms with aggressive DOM re-rendering
    var SPA_SITES = [SITE.GEMINI, SITE.BOLT, SITE.LOVABLE, SITE.REPLIT,
                     SITE.V0, SITE.BASE44, SITE.EMERGENT, SITE.FIREBASE_STUDIO, SITE.PERPLEXITY];
    if (SPA_SITES.indexOf(currentSite) !== -1) {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function() {
            originalPushState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };

        window.addEventListener('popstate', function() {
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
        setTimeout(updateLeftChatPositions, 1500);
        setTimeout(updateLeftChatPositions, 3000);
        setTimeout(updateLeftChatPositions, 6000);

        // Reposition on window resize (right is viewport-relative)
        window.addEventListener('resize', function() {
            _lastBoundaryX = null; // force recalculation
            if (isOpen) {
                var bx = getChatBoundaryX() || (window.innerWidth * 0.35);
                var panel = document.getElementById('ai-nav-panel');
                var toggle = document.getElementById('ai-nav-toggle');
                if (panel) panel.style.right = (window.innerWidth - bx) + 'px';
                if (toggle) toggle.style.right = (window.innerWidth - bx + 320) + 'px';
            } else {
                updateLeftChatPositions();
            }
        });

        // Periodic boundary check (chat panels can resize dynamically)
        setInterval(function() {
            if (!isOpen) {
                _lastBoundaryX = null;
                updateLeftChatPositions();
            }
        }, 3000);
    }

    // Initial scan after page load
    setTimeout(scanConversation, 2000);

    console.log('AI Conversation Navigator v7.1 loaded for ' + siteTitle + (isLeftChat ? ' (left-chat mode)' : '') + '!');
})();
