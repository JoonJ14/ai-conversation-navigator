// ==UserScript==
// @name         AI Conversation Navigator v7.7
// @namespace    http://tampermonkey.net/
// @version      7.7
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
// @include      https://firebase-studio-*.cloudworkstations.dev/*
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
        // Firebase Studio renders chat in a cross-origin iframe on cloudworkstations.dev
        if (hostname.includes('cloudworkstations.dev') && hostname.includes('firebase-studio')) return SITE.FIREBASE_STUDIO;
        return null;
    }

    const currentSite = detectSite();
    if (!currentSite) {
        console.log('AI Conversation Navigator: Unknown site, exiting.');
        return;
    }

    // Firebase Studio: the top frame (studio.firebase.google.com) is just a shell with ~157 elements.
    // The actual chat lives in a cross-origin iframe (firebase-studio-*.cloudworkstations.dev).
    // Skip the top frame — the script will also run inside the iframe via @include.
    if (currentSite === SITE.FIREBASE_STUDIO &&
        window === window.top &&
        window.location.hostname.includes('studio.firebase.google.com')) {
        console.log('AI Conversation Navigator: Firebase Studio top frame (shell), deferring to iframe instance.');
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
        [SITE.FIREBASE_STUDIO]: { accent: '#FFA611', accentHover: '#F5820D', accentLight: 'rgba(255, 166, 17, 0.2)', textColor: 'white' }
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
        [SITE.V0]: '\u25BD',      // ▽ (inverted triangle, Vercel logo shape)
        [SITE.BASE44]: '\u2B22',  // ⬢ (hexagon)
        [SITE.EMERGENT]: 'e',     // lowercase e (Emergent brand initial)
        [SITE.PERPLEXITY]: '\u2733', // ✳ (eight spoked asterisk — same as Claude, renders on Linux/Firefox)
        [SITE.FIREBASE_STUDIO]: '\u2726' // ✦ (same as Gemini — Firebase Studio runs Gemini)
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

    // Virtual scroll platforms: only render visible messages in the DOM (e.g. virtuoso).
    // These need accumulative scanning since messages scroll in/out of existence.
    const VIRTUAL_SCROLL_SITES = [SITE.EMERGENT];
    const isVirtualScroll = VIRTUAL_SCROLL_SITES.includes(currentSite);

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
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease, border-radius 0.3s ease, right 0.3s ease !important;
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

        // Lovable: only show on project pages (chat exists only inside /projects/)
        if (currentSite === SITE.LOVABLE && !window.location.pathname.includes('/projects/')) {
            return null;
        }

        // Emergent-specific: Uses virtuoso virtual scroller. The walk-up approach fails because
        // parent containers use absolute inset-0 which spans full viewport width.
        // Instead, find the virtuoso scroller directly — its right edge IS the chat boundary.
        if (currentSite === SITE.EMERGENT) {
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
        var msgSelectors = {
            bolt: '[class*="backdrop-blur"][class*="rounded"], [class*="max-w-chat"]',
            lovable: 'div[role="log"], div.ChatMessageContainer, .justify-end',
            replit: '[data-cy="user-message"], [data-event-type="user-message"], [role="log"]',
            v0: '[data-testid="message"]',
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
        var toggle = document.getElementById('ai-nav-toggle');
        var panel = document.getElementById('ai-nav-panel');

        // No chat panel detected → hide and reset all state
        // But never hide while panel is actively open (user is interacting)
        if (!boundaryX) {
            if (isOpen) return;
            if (toggle) toggle.style.display = 'none';
            if (panel) panel.style.display = 'none';
            _lastBoundaryX = null;
            if (_boundaryDetected) {
                _boundaryDetected = false;
                if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
                if (toggle) toggle.classList.remove('ai-nav-positioned');
            }
            return;
        }

        // Emergent has a thick scrollbar at the chat boundary — offset toggle left
        // so it doesn't overlap. Panel stays flush with the boundary.
        var toggleScrollbarOffset = (currentSite === SITE.EMERGENT) ? 14 : 0;

        // Already confirmed — just update position smoothly, never hide
        if (_boundaryDetected) {
            // Safety: ensure toggle always has positioned class (DOM guardian may recreate it)
            if (toggle && !toggle.classList.contains('ai-nav-positioned') && !isOpen) {
                toggle.classList.add('ai-nav-positioned');
            }
            if (!_lastBoundaryX || Math.abs(boundaryX - _lastBoundaryX) >= 3) {
                _lastBoundaryX = boundaryX;
                var panelRight = (window.innerWidth - boundaryX) + 'px';
                var toggleRight = (window.innerWidth - boundaryX + toggleScrollbarOffset) + 'px';
                if (panel) panel.style.right = panelRight;
                if (toggle && !isOpen) toggle.style.right = toggleRight;
            }
            return;
        }

        // Not yet confirmed — require two consecutive stable polls before showing
        if (_lastBoundaryX && Math.abs(boundaryX - _lastBoundaryX) < 3) {
            // Stable! Show and fade in
            _boundaryDetected = true;
            if (toggle) toggle.style.display = '';
            if (panel) panel.style.display = '';
            if (toggle) {
                _fadeTimer = setTimeout(function() {
                    _fadeTimer = null;
                    toggle.classList.add('ai-nav-positioned');
                }, 300);
            }
            return;
        }

        // First detection or position still settling — store and position invisibly
        _lastBoundaryX = boundaryX;
        var panelRight = (window.innerWidth - boundaryX) + 'px';
        var toggleRight = (window.innerWidth - boundaryX + toggleScrollbarOffset) + 'px';
        if (panel) panel.style.right = panelRight;
        if (toggle && !isOpen) toggle.style.right = toggleRight;
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
                onClick: function() { scanConversation(true); }
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
            // For virtual scroll platforms, the original msg DOM element may have been
            // recycled by the virtual scroller. Re-find it by matching text content.
            var targetMsg = msg;
            if (isVirtualScroll && !msg.isConnected) {
                var currentMessages = getUserMessages();
                var searchText = text.substring(0, 200);
                var found = Array.from(currentMessages).find(function(m) {
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
                setTimeout(function() {
                    targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    var originalBg = targetMsg.style.backgroundColor;
                    targetMsg.style.backgroundColor = theme.accentLight;
                    targetMsg.style.transition = 'background-color 0.3s';
                    setTimeout(function() {
                        targetMsg.style.backgroundColor = originalBg;
                    }, 1500);
                }, 350);
            } else {
                targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                var originalBg = targetMsg.style.backgroundColor;
                targetMsg.style.backgroundColor = theme.accentLight;
                targetMsg.style.transition = 'background-color 0.3s';
                setTimeout(function() {
                    targetMsg.style.backgroundColor = originalBg;
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
            var panelRight = (window.innerWidth - bx) + 'px';
            if (isOpen) {
                // Sync panel to boundary before opening
                if (panel) panel.style.right = panelRight;
                // Button pushed left by 320px from boundary — sits at panel's left edge
                toggle.style.right = (window.innerWidth - bx + 320) + 'px';
            } else {
                // Restore to boundary position
                _lastBoundaryX = null; // force recalculation
                updateLeftChatPositions();
            }
        }

        if (isOpen) {
            if (isVirtualScroll) {
                // Virtual scroll platforms: scroll through the chat to collect all messages.
                // Virtuoso only renders visible items, so we must scroll to each section,
                // wait for rendering, scan (accumulate), then move to the next section.
                scanConversation(true); // force reset, start fresh
                var scroller = document.querySelector('[data-testid="virtuoso-scroller"], [data-virtuoso-scroller="true"]');
                if (scroller && scroller.scrollHeight > scroller.clientHeight) {
                    var savedScrollTop = scroller.scrollTop;
                    var totalHeight = scroller.scrollHeight;
                    var viewHeight = scroller.clientHeight;
                    // Build scroll positions: top, then increments of 80% viewport, then original
                    var positions = [0];
                    for (var pos = viewHeight * 0.8; pos < totalHeight; pos += viewHeight * 0.8) {
                        positions.push(Math.floor(pos));
                    }
                    positions.push(savedScrollTop); // restore original position at end

                    var step = 0;
                    function _vsScrollStep() {
                        if (step >= positions.length) return;
                        scroller.scrollTop = positions[step];
                        setTimeout(function() {
                            if (step < positions.length - 1) {
                                scanConversation(); // accumulate mode
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
                // Retry scan after delay if 0 questions found (lazy rendering)
                setTimeout(function() {
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
            if (isLeftChat && !_boundaryDetected) panel.style.display = 'none';
            document.body.appendChild(panel);
            if (isOpen) panel.classList.add('open');
            console.log('AI Nav: Re-injected panel.');
        }

        if (!document.getElementById('ai-nav-toggle')) {
            const toggle = createToggle();
            if (isLeftChat && !_boundaryDetected) {
                toggle.style.display = 'none';
            } else if (isLeftChat && _boundaryDetected) {
                // Boundary already confirmed — restore positioned state immediately
                toggle.classList.add('ai-nav-positioned');
                if (_lastBoundaryX) {
                    toggle.style.right = (window.innerWidth - _lastBoundaryX) + 'px';
                }
            }
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
            // Bolt.new user messages: containers with data-message-id and self-end alignment.
            // User messages have bg-bolt-elements-messages-background + self-end class.
            // Assistant messages do NOT have self-end. Token/subscription warnings live in
            // a separate prompt area (bg-bolt-elements-prompt-subscribeButton) — must exclude.
            // Also supports bolt.diy fork which uses backdrop-blur + ml-auto pattern.

            // Primary: data-message-id containers filtered to user messages (self-end)
            var boltMsgAll = document.querySelectorAll('[data-message-id]');
            if (boltMsgAll.length > 0) {
                messages = Array.from(boltMsgAll).filter(function(el) {
                    var cls = el.className || '';
                    // User messages have self-end or contain a self-end child
                    var isSelfEnd = cls.includes('self-end') || el.querySelector('.self-end');
                    // Or have bolt-specific user message background
                    var isBoltUserBg = cls.includes('bg-bolt-elements-messages');
                    // Exclude subscription/token warning areas
                    var isPromptArea = el.closest('[class*="subscribeButton"]') ||
                        el.closest('[class*="prompt-subscribe"]');
                    return (isSelfEnd || isBoltUserBg) && !isPromptArea && el.textContent.trim().length > 0;
                });
            }

            // Fallback 1: self-end elements with bolt message background
            if (messages.length === 0) {
                var boltSelfEnd = document.querySelectorAll('.self-end[class*="bg-bolt-elements"], [class*="bg-bolt-elements-messages-background"]');
                messages = Array.from(boltSelfEnd).filter(function(el) {
                    var isPromptArea = el.closest('[class*="subscribeButton"]') ||
                        el.closest('[class*="prompt-subscribe"]');
                    return !isPromptArea && el.textContent.trim().length > 0;
                });
            }

            // Fallback 2: MarkdownContent inside self-end containers (bolt.new specific)
            if (messages.length === 0) {
                var boltMarkdown = document.querySelectorAll('[class*="_MarkdownContent_"]');
                messages = Array.from(boltMarkdown).filter(function(el) {
                    var userParent = el.closest('.self-end, [class*="bg-bolt-elements-messages"]');
                    var isPromptArea = el.closest('[class*="subscribeButton"]') ||
                        el.closest('[class*="prompt-subscribe"]');
                    return userParent && !isPromptArea && el.textContent.trim().length > 0;
                });
            }

            // Fallback 3: bolt.diy fork — backdrop-blur + rounded bubbles (original pattern)
            if (messages.length === 0) {
                var boltCandidates = document.querySelectorAll('[class*="backdrop-blur"][class*="rounded"]');
                if (boltCandidates.length > 0) {
                    messages = Array.from(boltCandidates).filter(function(el) {
                        var cls = el.className || '';
                        if (cls.includes('w-full')) return false;
                        if (cls.includes('items-start') && cls.includes('gap-')) return false;
                        var parent = el.closest('[class*="items-start"][class*="gap-"]');
                        if (parent && parent !== el) return false;
                        var isPromptArea = el.closest('[class*="subscribeButton"]') ||
                            el.closest('[class*="prompt-subscribe"]');
                        return !isPromptArea && el.textContent.trim().length > 0;
                    });
                }
            }

            // Fallback 4: right-aligned rounded bubbles inside chat area
            if (messages.length === 0) {
                var mlAutoBubbles = document.querySelectorAll('.ml-auto.rounded-lg, .ml-auto.rounded-xl');
                messages = Array.from(mlAutoBubbles).filter(function(el) {
                    var cls = el.className || '';
                    if (cls.includes('items-start') && cls.includes('gap-')) return false;
                    var isPromptArea = el.closest('[class*="subscribeButton"]') ||
                        el.closest('[class*="prompt-subscribe"]');
                    return !isPromptArea && el.textContent.trim().length > 0;
                });
            }

            // Fallback 5: grid children — assistant is overflow-hidden w-full, user is NOT
            if (messages.length === 0) {
                var gridChildren = document.querySelectorAll('.grid.w-full > div');
                messages = Array.from(gridChildren).filter(function(el) {
                    var cls = el.className || '';
                    var isAssistant = cls.includes('overflow-hidden') && cls.includes('w-full');
                    var isAlert = cls.includes('items-start') && cls.includes('gap-');
                    var isPromptArea = el.closest('[class*="subscribeButton"]') ||
                        el.closest('[class*="prompt-subscribe"]');
                    return !isAssistant && !isAlert && !isPromptArea && el.textContent.trim().length > 0;
                });
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
            // The AI Agent chat is a pane inside the IDE workspace.
            //
            // Real DOM structure (from live site inspection, Feb 2026):
            //   A: div.EventRenderer-module_RTGgnG_userMessage (outer event wrapper)
            //     B: div[data-cy="user-message"][data-event-type="user-message"] (message wrapper — TARGET)
            //       C: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades (outer surface)
            //         D: span (layout wrapper)
            //           E: div.UserMessage-module_wrN9Aa_userMessageSurfaceShades[data-acknowledged="true"] (bubble)
            //             F: div.rendered-markdown
            //               G: div.Markdown-module_KWqogW_markdownTheme
            //                 H: <p>actual question text</p>
            //
            // Key: Replit uses data-cy (Cypress), NOT data-testid. Element B is the correct
            // target — exactly one per user message. Elements A, C, E all contain "userMessage"
            // in CSS module class names, which caused 3x duplication when using class-based fallbacks.

            // Primary: data-cy="user-message" — Replit's Cypress test attribute (one per message)
            messages = document.querySelectorAll('[data-cy="user-message"]');

            // Secondary: data-event-type (same element as data-cy, alternate attribute)
            if (messages.length === 0) messages = document.querySelectorAll('[data-event-type="user-message"]');

            // Fallback 1: EventRenderer class with userMessage — the outer event wrapper.
            // Since this is ONE level per message (not nested), it gives 1 match per message.
            if (messages.length === 0) {
                var replitEventRenderers = document.querySelectorAll('[class*="EventRenderer"][class*="userMessage"]');
                messages = Array.from(replitEventRenderers).filter(function(el) {
                    return el.textContent.trim().length > 0;
                });
            }

            // Fallback 2: CSS module pattern — class contains "userMessage" or "UserMessage".
            // This matches 3 elements per message (A, C, E in the nesting above), so we must
            // deduplicate: keep only innermost, then by text content.
            if (messages.length === 0) {
                var replitUserEls = document.querySelectorAll('[class*="userMessage"], [class*="UserMessage"]');
                var replitFiltered = Array.from(replitUserEls).filter(function(el) {
                    return el.textContent.trim().length > 0;
                });
                // Nesting dedup: keep only innermost matches
                var replitDeduped = replitFiltered.filter(function(el) {
                    return !replitFiltered.some(function(other) {
                        return other !== el && el.contains(other);
                    });
                });
                // Text dedup: keep first element per unique text
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
                    messages = Array.from(replitBlocks).filter(function(el) {
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
        }
        else if (currentSite === SITE.V0) {
            // V0 (Vercel): chat on left side of app builder.
            // Real DOM (Feb 2026): All messages use data-testid="message" with role="listitem".
            // User messages are distinguished by origin-right + items-end classes (right-aligned).
            // AI messages have origin-left + items-start (left-aligned).
            // Each message container has a unique id attribute (hash string).
            // Text lives inside: div.group/message-bubble > div.prose.prose-sm > p

            // Primary: data-testid="message" filtered by origin-right (user = right-aligned)
            var v0MsgAll = document.querySelectorAll('[data-testid="message"]');
            if (v0MsgAll.length > 0) {
                messages = Array.from(v0MsgAll).filter(function(el) {
                    var cls = el.className || '';
                    return cls.includes('origin-right') && cls.includes('items-end');
                });
            }

            // Fallback 1: data-testid="message" with only items-end (in case origin-right changes)
            if (messages.length === 0 && v0MsgAll.length > 0) {
                messages = Array.from(v0MsgAll).filter(function(el) {
                    var cls = el.className || '';
                    return cls.includes('items-end') && !cls.includes('items-start');
                });
            }

            // Fallback 2: message bubble with bg-v0-gray-200 (user bubble color)
            if (messages.length === 0) {
                var v0Bubbles = document.querySelectorAll('[class*="bg-v0-gray-200"][class*="message-bubble"], [class*="group/message-bubble"]');
                messages = Array.from(v0Bubbles).filter(function(el) {
                    return el.textContent.trim().length > 0;
                });
            }

            // Fallback 3: role="listitem" containers filtered by right-alignment
            if (messages.length === 0) {
                var v0ListItems = document.querySelectorAll('[role="listitem"]');
                if (v0ListItems.length > 0) {
                    messages = Array.from(v0ListItems).filter(function(el) {
                        var cls = el.className || '';
                        return (cls.includes('origin-right') || cls.includes('items-end')) &&
                            el.textContent.trim().length > 0;
                    });
                }
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
            // Emergent: user messages have data-testid="user-message-{id}" (e.g. "user-message-user-task").
            // IMPORTANT: Emergent uses virtuoso virtual scrolling — only visible messages exist in DOM.
            // Do NOT add broad fallback selectors; they will match AI agent status messages
            // when user messages are scrolled out of view and the primary returns 0.
            messages = document.querySelectorAll('[data-testid^="user-message"]');

            // Deduplicate: keep only innermost matches (nested testids possible)
            if (messages.length > 0) {
                var emergentArr = Array.from(messages);
                var emergentDeduped = emergentArr.filter(function(el) {
                    return !emergentArr.some(function(other) {
                        return other !== el && el.contains(other);
                    });
                });
                if (emergentDeduped.length > 0) messages = emergentDeduped;
            }

            // Fallback: id starts with "user-task" (specific to user task elements only)
            if (messages.length === 0) {
                messages = document.querySelectorAll('[id^="user-task"]');
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
            // Firebase Studio (Gemini): CSS module classes with _isUser_ pattern.
            // Class names look like: _chatMessage_qlgvg_30 _isUser_qlgvg_47
            // The hash suffix changes per build, but _isUser_ and _chatMessage_ stay consistent.
            //
            // Architecture: Firebase Studio top frame (studio.firebase.google.com) is a shell.
            // Chat lives in a cross-origin iframe (firebase-studio-*.cloudworkstations.dev).
            // The top frame is skipped at init; this code runs inside the iframe via @include.

            // Primary: elements with both _chatMessage_ and _isUser_ in class
            var firebaseMessages = document.querySelectorAll('[class*="_chatMessage_"][class*="_isUser_"]');
            messages = Array.from(firebaseMessages).filter(function(el) {
                return el.textContent.trim().length > 0;
            });

            // Fallback 1: _isUser_ alone
            if (messages.length === 0) {
                firebaseMessages = document.querySelectorAll('[class*="_isUser_"]');
                messages = Array.from(firebaseMessages).filter(function(el) {
                    return el.textContent.trim().length > 0;
                });
            }

            // Fallback 2: _chatMessage_ class (all messages), then filter by _isUser_
            if (messages.length === 0) {
                var allFirebaseMessages = document.querySelectorAll('[class*="_chatMessage_"]');
                messages = Array.from(allFirebaseMessages).filter(function(el) {
                    return (el.className || '').includes('_isUser_') || (el.className || '').includes('isUser');
                });
            }
        }

        return messages;
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
            messages.forEach(function(msg) {
                // Emergent: extract text from prose container only (excludes timestamps/buttons)
                var proseEl = msg.querySelector('.prose');
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
                    navItems.sort(function(a, b) {
                        return parseInt(a.getAttribute('data-vs-index') || '0') - parseInt(b.getAttribute('data-vs-index') || '0');
                    });
                    navItems.forEach(function(item) { list.appendChild(item); });
                }
                var total = navItems.length || list.querySelectorAll('.ai-nav-item').length;
                stats.textContent = total + ' question' + (total !== 1 ? 's' : '') + ' found';
                // Re-number all items sequentially
                list.querySelectorAll('.ai-nav-number').forEach(function(numEl, i) {
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

        messages.forEach(function(msg, index) {
            // Emergent: extract text from prose container only (excludes timestamps/buttons)
            var proseEl = (currentSite === SITE.EMERGENT) ? msg.querySelector('.prose') : null;
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

    if (!document.getElementById('ai-nav-toggle')) {
        var initToggle = createToggle();
        if (isLeftChat) initToggle.style.display = 'none';
        document.body.appendChild(initToggle);
    }
    if (!document.getElementById('ai-nav-panel')) {
        var initPanel = createPanel();
        if (isLeftChat) initPanel.style.display = 'none';
        document.body.appendChild(initPanel);
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
            if (isVirtualScroll) _vsAccumulatedKeys.clear(); // reset on navigation
            setTimeout(ensureElementsExist, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            setTimeout(ensureElementsExist, 500);
            if (isLeftChat) setTimeout(updateLeftChatPositions, 600);
        };

        window.addEventListener('popstate', function() {
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

        // Scroll listener — repositions button when page/chat scrolls (boundary can shift)
        window.addEventListener('scroll', function() {
            if (!isOpen) {
                updateLeftChatPositions();
            }
        }, { passive: true });

        // Periodic boundary check (chat panels can resize dynamically)
        // Note: Do NOT reset _lastBoundaryX here. Resetting prevented the two-consecutive-
        // stable-polls requirement from ever being met via the interval, blocking late-rendering
        // platforms (like Emergent's virtuoso scroller) from ever showing the ghost notch.
        // The stability check in updateLeftChatPositions already handles boundary position changes.
        setInterval(function() {
            if (!isOpen) {
                updateLeftChatPositions();
            }
        }, 3000);
    }

    // Initial scan after page load
    setTimeout(scanConversation, 2000);

    // Firebase Studio and other heavy SPAs: chat may not render within 2 seconds.
    // Add aggressive retries for platforms that lazy-load their chat panels.
    if (currentSite === SITE.FIREBASE_STUDIO) {
        [5000, 10000, 20000].forEach(function(delay) {
            setTimeout(function() {
                var items = document.querySelectorAll('.ai-nav-item');
                if (items.length === 0) {
                    console.log('AI Nav: Firebase retry scan at ' + delay + 'ms...');
                    scanConversation();
                }
            }, delay);
        });
    }

    console.log('AI Conversation Navigator v7.7 loaded for ' + siteTitle + (isLeftChat ? ' (left-chat mode)' : '') + '!');
})();
