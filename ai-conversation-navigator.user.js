// ==UserScript==
// @name         AI Conversation Navigator v7.5
// @namespace    http://tampermonkey.net/
// @version      7.5
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
        [SITE.PERPLEXITY]: '\u29BE', // ⦾ (circled white bullet)
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
            opacity: ${currentSite === SITE.EMERGENT ? '0.75' : '0.35'} !important;
            ${currentSite === SITE.EMERGENT ? 'width: 14px !important;' : ''}
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
            scanConversation();
            // Retry scan after delay if 0 questions found (virtual scroll / lazy rendering)
            setTimeout(function() {
                var items = document.querySelectorAll('.ai-nav-item');
                if (items.length === 0) scanConversation();
            }, 2000);
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
            // The AI Agent chat is a pane inside the IDE workspace. Cannot rely on class names.
            // Must use data-* attributes, ARIA roles, structural patterns, and computed styles.
            // Source: Replit engineering blog (RUI, Emotion, Jotai architecture)

            // Primary: data-* attribute selectors
            messages = document.querySelectorAll('[data-testid*="user-message"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-message-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-author="user"]');

            // Deduplicate step 1: nesting — data-testid*="user-message" can match at multiple
            // nesting levels (outer wrapper, middle container, inner text div).
            // Keep only innermost matches so each question appears once.
            if (messages.length > 0) {
                var replitArr = Array.from(messages);
                var deduped = replitArr.filter(function(el) {
                    return !replitArr.some(function(other) {
                        return other !== el && el.contains(other);
                    });
                });
                if (deduped.length > 0) messages = deduped;
            }

            // Deduplicate step 2: text content — siblings/cousins at the same nesting
            // level can match the same selector with identical text. Keep only the first
            // element for each unique text to avoid showing the same question N times.
            if (messages.length > 0) {
                var replitSeen = {};
                var replitTextDeduped = [];
                var replitMsgArr = Array.isArray(messages) ? messages : Array.from(messages);
                for (var ri = 0; ri < replitMsgArr.length; ri++) {
                    var replitTxt = replitMsgArr[ri].textContent.trim();
                    if (replitTxt && !replitSeen[replitTxt]) {
                        replitSeen[replitTxt] = true;
                        replitTextDeduped.push(replitMsgArr[ri]);
                    }
                }
                if (replitTextDeduped.length > 0) messages = replitTextDeduped;
            }

            // Fallback 1: CSS module pattern — class contains "user" or "User"
            if (messages.length === 0) {
                var replitUserEls = document.querySelectorAll('[class*="userMessage"], [class*="user-message"], [class*="UserMessage"]');
                messages = Array.from(replitUserEls).filter(function(el) {
                    return el.textContent.trim().length > 0;
                });
            }

            // Fallback 2: ARIA role="log" container + structural analysis
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

            // Fallback 3: find chat panel via textarea, then scan siblings
            if (messages.length === 0) {
                var replitInput = document.querySelector('textarea[placeholder*="message" i]') ||
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
            // V0 uses Vercel's design system (Geist) with various data attributes and Tailwind.
            // Try multiple data attribute patterns, then structural patterns.
            // Note: copy buttons and SVG icons also use justify-end/self-end — must filter them out.
            messages = document.querySelectorAll('[data-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-message-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-message-author-role="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-message-author="user"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-testid*="user-message"]');
            if (messages.length === 0) messages = document.querySelectorAll('[data-sender="user"]');

            // Fallback 0.5: data-message-id containers filtered to user messages (right-aligned)
            if (messages.length === 0) {
                var v0MsgAll = document.querySelectorAll('[data-message-id]');
                if (v0MsgAll.length > 0) {
                    messages = Array.from(v0MsgAll).filter(function(el) {
                        var cls = el.className || '';
                        var isUser = cls.includes('justify-end') || cls.includes('self-end') ||
                            cls.includes('ml-auto') ||
                            el.querySelector('.justify-end, .self-end, .ml-auto, [class*="bg-muted"]');
                        var isNotButton = el.tagName !== 'BUTTON' && !el.closest('button');
                        return isUser && isNotButton && el.textContent.trim().length > 0;
                    });
                }
            }

            // Fallback 1: V0 user message bubbles — bg-muted rounded with ml-auto
            if (messages.length === 0) {
                var v0MutedBubbles = document.querySelectorAll('[class*="bg-muted"][class*="rounded"], [class*="bg-secondary"][class*="rounded"]');
                messages = Array.from(v0MutedBubbles).filter(function(el) {
                    var cls = el.className || '';
                    var hasText = el.textContent.trim().length > 5;
                    var isRightAligned = cls.includes('ml-auto') || (el.parentElement && (el.parentElement.className || '').includes('justify-end'));
                    var isNotButton = !el.closest('button') && el.tagName !== 'BUTTON';
                    return hasText && isRightAligned && isNotButton;
                });
            }

            // Fallback 2: look inside a chat/message container specifically
            if (messages.length === 0) {
                var v0Container = document.querySelector('[class*="chat"], [class*="messages"], [role="log"], [class*="thread"]');
                if (v0Container) {
                    var v0Candidates = v0Container.querySelectorAll('.justify-end, .self-end, .ml-auto');
                    messages = Array.from(v0Candidates).filter(function(el) {
                        var hasText = el.textContent.trim().length > 10;
                        var isNotButton = !el.closest('button') && el.tagName !== 'BUTTON';
                        var isNotIcon = el.tagName !== 'SVG' && !el.querySelector('svg:only-child');
                        var isLeaf = el.querySelectorAll('.justify-end, .self-end').length === 0;
                        var isNotCopyWidget = !(el.className || '').includes('copy');
                        return hasText && isNotButton && isNotIcon && isLeaf && isNotCopyWidget;
                    });
                }
            }

            // Fallback 3: scan for text-wrap/break-words divs that look like message content
            if (messages.length === 0) {
                var v0TextDivs = document.querySelectorAll('[class*="text-wrap"][class*="break-words"], [class*="whitespace-pre-wrap"]');
                messages = Array.from(v0TextDivs).filter(function(el) {
                    var hasText = el.textContent.trim().length > 5;
                    var isNotInput = !el.closest('[contenteditable]') && !el.closest('textarea');
                    var isNotNav = !el.closest('nav') && !el.closest('header');
                    // Check if this is a user message by looking for right-alignment in ancestors
                    var parent = el.closest('.justify-end, .self-end, [class*="ml-auto"]');
                    return hasText && isNotInput && isNotNav && parent;
                });
            }

            // Fallback 4: broader scan with strict text length and element type filters
            if (messages.length === 0) {
                var v0Bubbles = document.querySelectorAll('.justify-end, .self-end, .ml-auto');
                messages = Array.from(v0Bubbles).filter(function(el) {
                    var text = el.textContent.trim();
                    var hasText = text.length > 10;
                    var isInChat = !el.closest('nav') && !el.closest('header') && !el.closest('[class*="toolbar"]');
                    var isNotButton = !el.closest('button') && el.tagName !== 'BUTTON';
                    var isNotIcon = el.tagName !== 'SVG' && !el.querySelector('svg:only-child');
                    var isLeaf = el.querySelectorAll('.justify-end, .self-end').length === 0;
                    var isNotCopyWidget = !(el.className || '').includes('copy') && !(el.className || '').includes('transition');
                    return hasText && isInChat && isLeaf && isNotButton && isNotIcon && isNotCopyWidget;
                });
            }

            // Fallback 5: find user messages by scanning scrollable chat container children
            if (messages.length === 0) {
                var v0ScrollContainers = document.querySelectorAll('[class*="overflow-y"], [class*="overflow-auto"]');
                for (var vi = 0; vi < v0ScrollContainers.length; vi++) {
                    var v0Scroll = v0ScrollContainers[vi];
                    var v0Rect = v0Scroll.getBoundingClientRect();
                    // Chat panel: left portion, tall, reasonable width
                    if (v0Rect.width > 200 && v0Rect.width < window.innerWidth * 0.6 && v0Rect.height > window.innerHeight * 0.3) {
                        var v0Divs = v0Scroll.querySelectorAll('div');
                        messages = Array.from(v0Divs).filter(function(el) {
                            var style = window.getComputedStyle(el);
                            var isRightAligned = style.marginLeft === 'auto' || style.alignSelf === 'flex-end';
                            var hasText = el.textContent.trim().length > 5;
                            var isLeaf = el.querySelectorAll('div').length < 3;
                            var isNotButton = el.tagName !== 'BUTTON' && !el.closest('button');
                            return isRightAligned && hasText && isLeaf && isNotButton;
                        });
                        if (messages.length > 0) break;
                    }
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
            // Emergent: user messages have data-testid="user-message-{id}".
            // The actual text content is often inside a nested div with text-wrap/break-words.
            // The bubble wrapper has bg-[#273638] + rounded-br-none (user side, no bottom-right radius).
            messages = document.querySelectorAll('[data-testid^="user-message"]');

            // Deduplicate: keep only innermost matches (same issue as Replit — nested testids)
            if (messages.length > 0) {
                var emergentArr = Array.from(messages);
                var emergentDeduped = emergentArr.filter(function(el) {
                    return !emergentArr.some(function(other) {
                        return other !== el && el.contains(other);
                    });
                });
                if (emergentDeduped.length > 0) messages = emergentDeduped;
            }

            // Fallback 1: id starts with "user-"
            if (messages.length === 0) {
                messages = document.querySelectorAll('[id^="user-"]');
            }

            // Fallback 2: look for user task elements
            if (messages.length === 0) {
                messages = document.querySelectorAll('[id^="user-task"], [data-testid*="user-task"]');
            }

            // Fallback 3: user message bubbles — rounded-br-none indicates user side
            // (assistant bubbles use rounded-bl-none). Target the text content div inside.
            if (messages.length === 0) {
                var emergentBubbles = document.querySelectorAll('[class*="rounded-br-none"]');
                if (emergentBubbles.length > 0) {
                    messages = Array.from(emergentBubbles).filter(function(el) {
                        return el.textContent.trim().length > 0;
                    });
                }
            }

            // Fallback 4: items-end containers with teal-ish background in chat area
            if (messages.length === 0) {
                var emergentCandidates = document.querySelectorAll('[class*="items-end"]');
                messages = Array.from(emergentCandidates).filter(function(el) {
                    var cls = el.className || '';
                    var hasBg = cls.includes('bg-') && !cls.includes('bg-transparent');
                    var hasText = el.textContent.trim().length > 0;
                    var isNotNav = !el.closest('nav') && !el.closest('header');
                    return hasBg && hasText && isNotNav;
                });
            }

            // Fallback 5: text-wrap break-words divs that are user content
            if (messages.length === 0) {
                var emergentTextDivs = document.querySelectorAll('[class*="text-wrap"][class*="break-words"]');
                messages = Array.from(emergentTextDivs).filter(function(el) {
                    var hasText = el.textContent.trim().length > 5;
                    var isNotNav = !el.closest('nav') && !el.closest('header') && !el.closest('[contenteditable]');
                    return hasText && isNotNav;
                });
            }

            // Fallback 6: right-aligned message bubbles in chat area
            if (messages.length === 0) {
                var emergentChat = document.querySelector('[role="log"], [class*="chat"], [class*="messages"]');
                if (emergentChat) {
                    messages = Array.from(emergentChat.querySelectorAll('.justify-end, .self-end, .ml-auto')).filter(function(el) {
                        return el.textContent.trim().length > 5;
                    });
                }
            }

            // Fallback 7: broad scan — find divs with select-text class (user-selectable content)
            if (messages.length === 0) {
                var selectableTexts = document.querySelectorAll('[class*="select-text"]');
                messages = Array.from(selectableTexts).filter(function(el) {
                    var hasText = el.textContent.trim().length > 5;
                    var isNotInput = !el.closest('[contenteditable]') && !el.closest('textarea');
                    var isNotNav = !el.closest('nav') && !el.closest('header');
                    // Check if inside a user-message-like container (has teal/dark bg)
                    var parent = el.closest('[class*="bg-"]');
                    return hasText && isNotInput && isNotNav && parent;
                });
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
            // Message body text is inside _messageBody_ nested elements.

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

            // Fallback 3: look for isUser (camelCase, no underscores) pattern
            if (messages.length === 0) {
                messages = document.querySelectorAll('[class*="isUser"]');
            }

            // Fallback 4: right-aligned messages in chat area
            if (messages.length === 0) {
                var fbChat = document.querySelector('[class*="_chatContainer_"], [class*="_chat_"], [role="log"]');
                if (fbChat) {
                    messages = Array.from(fbChat.querySelectorAll('[class*="_messageBody_"]')).filter(function(el) {
                        var parent = el.closest('[class*="_isUser_"]') || el.closest('[class*="isUser"]');
                        return parent && el.textContent.trim().length > 0;
                    });
                }
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
        setInterval(function() {
            if (!isOpen) {
                _lastBoundaryX = null;
                updateLeftChatPositions();
            }
        }, 3000);
    }

    // Initial scan after page load
    setTimeout(scanConversation, 2000);

    console.log('AI Conversation Navigator v7.5 loaded for ' + siteTitle + (isLeftChat ? ' (left-chat mode)' : '') + '!');
})();
