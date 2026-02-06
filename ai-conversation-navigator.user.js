// ==UserScript==
// @name         AI Conversation Navigator
// @namespace    http://tampermonkey.net/
// @version      4.0
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
        if (hostname.includes('claude.ai')) {
            return SITE.CLAUDE;
        } else if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
            return SITE.CHATGPT;
        } else if (hostname.includes('grok.com')) {
            return SITE.GROK;
        } else if (hostname.includes('gemini.google.com')) {
            return SITE.GEMINI;
        }
        return null;
    }

    const currentSite = detectSite();
    if (!currentSite) {
        console.log('AI Conversation Navigator: Unknown site, exiting.');
        return;
    }

    // Site-specific colors
    const THEME = {
        [SITE.CLAUDE]: {
            accent: '#d97706',           // Orange
            accentHover: '#b45309',
            accentLight: 'rgba(217, 119, 6, 0.2)',
            textColor: 'white'
        },
        [SITE.CHATGPT]: {
            accent: '#ffffff',           // White
            accentHover: '#e0e0e0',
            accentLight: 'rgba(255, 255, 255, 0.15)',
            textColor: '#1a1a1a'         // Dark text on white button
        },
        [SITE.GROK]: {
            accent: '#dc2626',           // Red
            accentHover: '#b91c1c',
            accentLight: 'rgba(220, 38, 38, 0.2)',
            textColor: 'white'
        },
        [SITE.GEMINI]: {
            accent: '#4285f4',           // Google Blue
            accentHover: '#3367d6',
            accentLight: 'rgba(66, 133, 244, 0.2)',
            textColor: 'white'
        }
    };

    const theme = THEME[currentSite];

    // Inject styles
    const styles = `
        #ai-nav-toggle {
            position: fixed;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            z-index: 10000;
            background: ${theme.accent};
            color: ${theme.textColor};
            border: ${currentSite === SITE.CHATGPT ? '1px solid #333' : 'none'};
            padding: 12px 8px;
            cursor: pointer;
            border-radius: 8px 0 0 8px;
            font-size: 14px;
            writing-mode: vertical-rl;
            text-orientation: mixed;
            box-shadow: -2px 0 10px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
        }
        #ai-nav-toggle:hover {
            background: ${theme.accentHover};
            padding-right: 12px;
        }
        #ai-nav-toggle.open {
            right: 320px;
        }

        #ai-nav-panel {
            position: fixed;
            right: -320px;
            top: 0;
            width: 320px;
            height: 100vh;
            background: #1a1a1a;
            border-left: 1px solid #333;
            z-index: 9999;
            transition: right 0.3s ease;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #ai-nav-panel.open {
            right: 0;
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
        #ai-nav-list::-webkit-scrollbar {
            width: 6px;
        }
        #ai-nav-list::-webkit-scrollbar-track {
            background: #1a1a1a;
        }
        #ai-nav-list::-webkit-scrollbar-thumb {
            background: #444;
            border-radius: 3px;
        }
    `;

    // Add styles to page
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create toggle button
    const toggle = document.createElement('button');
    toggle.id = 'ai-nav-toggle';
    toggle.textContent = '📍 Navigate';
    document.body.appendChild(toggle);

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'ai-nav-panel';

    // Site-specific title
    const siteTitles = {
        [SITE.CLAUDE]: 'Claude',
        [SITE.CHATGPT]: 'ChatGPT',
        [SITE.GROK]: 'Grok',
        [SITE.GEMINI]: 'Gemini'
    };
    const siteTitle = siteTitles[currentSite];

    panel.innerHTML = `
        <div id="ai-nav-header">
            <h3>💬 ${siteTitle} - Your Questions</h3>
            <button id="ai-nav-refresh">↻ Refresh</button>
        </div>
        <div id="ai-nav-stats"></div>
        <div id="ai-nav-list"></div>
    `;
    document.body.appendChild(panel);

    // Toggle panel
    let isOpen = false;
    toggle.addEventListener('click', () => {
        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
        toggle.classList.toggle('open', isOpen);
        if (isOpen) {
            scanConversation();
        }
    });

    // Refresh button
    document.getElementById('ai-nav-refresh').addEventListener('click', scanConversation);

    // Generate smart summary
    function generateSummary(text) {
        // Clean up the text
        let summary = text.trim();

        // Remove code blocks for summary
        summary = summary.replace(/```[\s\S]*?```/g, '[code]');

        // If it's a question, try to capture the question
        const questionMatch = summary.match(/^[^.!?]*\?/);
        if (questionMatch && questionMatch[0].length > 10) {
            return questionMatch[0].trim();
        }

        // Get first meaningful sentence or chunk
        const firstSentence = summary.match(/^[^.!?\n]+[.!?]?/);
        if (firstSentence) {
            summary = firstSentence[0];
        }

        // Truncate if too long
        if (summary.length > 120) {
            summary = summary.substring(0, 117) + '...';
        }

        return summary || text.substring(0, 100) + '...';
    }

    // Get user messages based on current site
    function getUserMessages() {
        let messages = [];

        if (currentSite === SITE.CLAUDE) {
            // Claude selectors - try multiple approaches
            messages = document.querySelectorAll('[data-testid="user-human-turn"]');
            
            if (messages.length === 0) {
                messages = document.querySelectorAll('[data-testid="user-message"]');
            }
            if (messages.length === 0) {
                messages = document.querySelectorAll('.font-user-message');
            }
        } 
        else if (currentSite === SITE.CHATGPT) {
            // ChatGPT selector - find all messages with author role, then filter to user only
            const allMessages = document.querySelectorAll('[data-message-author-role]');
            messages = Array.from(allMessages).filter(msg => {
                return msg.getAttribute('data-message-author-role') === 'user';
            });
        }
        else if (currentSite === SITE.GROK) {
            // Grok selector - message bubbles
            const allBubbles = document.querySelectorAll('div.message-bubble');
            
            if (allBubbles.length > 0) {
                messages = Array.from(allBubbles).filter((bubble, index) => {
                    // Check if it has any user-indicating class
                    const classList = bubble.className.toLowerCase();
                    if (classList.includes('user') || classList.includes('human')) {
                        return true;
                    }
                    // Check parent elements for user indicators
                    const parent = bubble.closest('[class*="user"], [class*="human"], [data-role="user"]');
                    if (parent) {
                        return true;
                    }
                    // Fallback: alternating pattern heuristic
                    return index % 2 === 0;
                });
            }
            
            // Fallback selectors for Grok
            if (messages.length === 0) {
                messages = document.querySelectorAll('[data-role="user"]');
            }
            if (messages.length === 0) {
                messages = document.querySelectorAll('[class*="user-message"]');
            }
        }
        else if (currentSite === SITE.GEMINI) {
            // Gemini selector - query-text contains user messages
            messages = document.querySelectorAll('div.query-text');
            
            // Fallback selectors for Gemini
            if (messages.length === 0) {
                messages = document.querySelectorAll('.query-text-line');
            }
            if (messages.length === 0) {
                messages = document.querySelectorAll('p.query-text-line');
            }
        }

        return messages;
    }

    // Scan conversation for user messages
    function scanConversation() {
        const list = document.getElementById('ai-nav-list');
        const stats = document.getElementById('ai-nav-stats');

        const messages = getUserMessages();

        if (messages.length === 0) {
            list.innerHTML = `<div id="ai-nav-empty">No messages found yet.<br><br>Start a conversation and click refresh!<br><br><small>If messages exist but aren't detected,<br>the site's structure may have changed.</small></div>`;
            stats.textContent = '0 questions found';
            return;
        }

        stats.textContent = `${messages.length} question${messages.length !== 1 ? 's' : ''} found`;

        list.innerHTML = '';

        messages.forEach((msg, index) => {
            const text = msg.textContent || msg.innerText || '';
            if (!text.trim()) return;

            const item = document.createElement('div');
            item.className = 'ai-nav-item';

            const summary = generateSummary(text);
            const wordCount = text.split(/\s+/).length;

            item.innerHTML = `
                <div class="ai-nav-number">Question #${index + 1}</div>
                <div class="ai-nav-summary">${escapeHtml(summary)}</div>
                <div class="ai-nav-meta">${wordCount} words</div>
            `;

            item.addEventListener('click', () => {
                msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight briefly
                const originalBg = msg.style.backgroundColor;
                msg.style.backgroundColor = theme.accentLight;
                msg.style.transition = 'background-color 0.3s';
                setTimeout(() => {
                    msg.style.backgroundColor = originalBg;
                }, 1500);
            });

            list.appendChild(item);
        });
    }

    // Helper to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Auto-scan when panel opens and periodically
    let scanInterval;
    toggle.addEventListener('click', () => {
        if (isOpen) {
            scanConversation();
            // Rescan every 10 seconds while open
            scanInterval = setInterval(scanConversation, 10000);
        } else {
            clearInterval(scanInterval);
        }
    });

    // Initial scan after page load
    setTimeout(scanConversation, 2000);

    console.log(`AI Conversation Navigator v4.0 loaded for ${siteTitle}!`);
})();
