// ============================================================
// MODULE: Group E2 — Tools Panel + Image Gallery + /Commands
// VERSION: v10.7
// DEPENDS ON: Phase 0 (getAIMessages, _questions, _aiResponses, i18n, showToast,
//             GM_getValue, GM_setValue, createElement)
//             platform (global, set by detectPlatform() before injectOrbital())
// REPLACES: orbBuildPanelExport() -> orbBuildPanelTools()
//           ORB_FEATURES 'export' entry -> 'tools'
//           orbPopulateNavigate() -> adds image-indicator prefix detection
// INSERTS: Image gallery, isContentImage(), downloadImage(), all exports,
//          /Commands CRUD, floating palette, keyboard listener (Ctrl+/)
// CSS: .acn-gallery-*, .acn-palette-*, .acn-cmd-*, .acn-highlight-flash,
//      .acn-tool-section-header, .acn-tool-section, .acn-exp-opt reused
// CROSS-DEPENDENCY: generateFullSummary() from Group E1 (stubbed, wired in Phase 2)
// CROSS-DEPENDENCY: Bookmarks from Group D (reads 'acn-bookmarks-v1' key)
// ============================================================

/*
## v10.7 Changelog

### Added
- Tools panel (replaces Export placeholder)
- Image Gallery: 3-column thumbnail grid of conversation images
- Navigate panel image indicator on questions with uploads (see integration note below)
- Full Conversation export (MD)
- Bookmarks Only export (MD, reads Group D bookmark storage)
- Summary export (MD, calls Group E1's generateFullSummary())
- /Commands: CRUD for reusable prompts, persist via GM_setValue
- Floating command palette: Ctrl+/ to open, search, arrow keys, Enter to execute
- Direct prompt injection into platform chat inputs

### Changed
- ORB_FEATURES 'export' -> 'tools' (wrench icon U+1F527)
- orbBuildPanelExport() -> orbBuildPanelTools()
- orbPopulateNavigate() updated to add image-indicator prefix to questions with images

### Integration Notes
The integration agent must apply four changes to the main file:

  1. ORB_FEATURES array (approx line 1257):
     FIND:    { id: 'export', icon: '\u2197', label: 'Export', panelId: 'acn-panel-export' },
     REPLACE: { id: 'tools',  icon: '\uD83D\uDD27', label: i18n('tools') || 'Tools', panelId: 'acn-panel-tools' },

  2. orbBuildZone() panel construction (approx line 2307, in the ORB_FEATURES.forEach block
     where panels are built):
     FIND:    orbBuildPanelExport()
     REPLACE: orbBuildPanelTools()

  3. orbBuildPanelExport() function (approx lines 2169-2188):
     REMOVE the entire function — orbBuildPanelTools() defined here replaces it.

  4. orbPopulateNavigate() item-rendering loop (approx lines 1839-1854):
     Inside the _questions.forEach callback, after:
         var textEl = createElement('div', { className: 'acn-qt', textContent: q.summary });
     ADD the following two lines:
         if (q.element && hasContentImage(q.element)) {
             textEl.textContent = '\uD83D\uDDBC\uFE0F ' + textEl.textContent;
         }
     This uses hasContentImage() defined in this module. The integration must occur AFTER
     this module's script block is evaluated (place module code before injectOrbital() call
     or in the same IIFE scope where orbPopulateNavigate is defined).

  5. CSS: Add the CSS block from SECTION 1 below to orbInjectCSS() alongside other panel CSS.
     The simplest integration is to append the CSS string to the styleEl.textContent assignment.

  6. Keyboard listener: The document.addEventListener('keydown', ...) block at the bottom of
     this file must be placed at module level inside the main IIFE, after all functions have
     been defined (e.g. just before or just after injectOrbital() is called).

### Troubleshooting Log
- (fill in issues encountered during live testing)
*/


// ============================================================
// SECTION 1 — CSS
// All styles live here as a single injectable string. The integration
// agent appends this to the GM_addStyle / styleEl.textContent call
// inside orbInjectCSS() in the main file.
// ============================================================

var ACN_E2_CSS = [
    // --- Image Gallery ---
    '.acn-tool-section{border-top:1px solid rgba(255,255,255,.07);padding-top:2px}',
    '.acn-tool-section-header{font-size:11px;font-weight:700;color:var(--acn-accent);',
    'text-transform:uppercase;letter-spacing:.6px;padding:10px 14px 4px}',
    '.acn-gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px 12px}',
    '.acn-gallery-card{position:relative;border-radius:6px;overflow:hidden;',
    'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);',
    'cursor:pointer;transition:border-color .15s ease}',
    '.acn-gallery-card:hover{border-color:var(--acn-accent)}',
    '.acn-gallery-thumb{width:100%;height:80px;object-fit:cover;display:block}',
    '.acn-gallery-thumb-fallback{width:100%;height:80px;display:flex;align-items:center;',
    'justify-content:center;font-size:18px;color:#555;background:rgba(255,255,255,.03)}',
    '.acn-gallery-label{font-size:10px;color:#aaa;text-align:center;padding:3px 0}',
    '.acn-gallery-actions{position:absolute;top:4px;right:4px;display:none;gap:4px}',
    '.acn-gallery-card:hover .acn-gallery-actions{display:flex}',
    '.acn-gallery-btn{width:20px;height:20px;background:rgba(0,0,0,.7);border-radius:4px;',
    'display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;color:#fff}',
    '.acn-gallery-btn:hover{background:var(--acn-accent)}',
    '.acn-gallery-empty{font-size:12px;color:#666;padding:12px;text-align:center;font-style:italic}',
    // Highlight flash for navigate-to-message
    '.acn-highlight-flash{animation:acn-flash 1.5s ease}',
    '@keyframes acn-flash{0%{outline:2px solid var(--acn-accent);outline-offset:2px}',
    '100%{outline:2px solid transparent;outline-offset:2px}}',
    // --- Floating command palette ---
    '.acn-palette-overlay{position:fixed;top:0;left:0;right:0;bottom:0;',
    'background:rgba(0,0,0,.5);z-index:99999;display:flex;justify-content:center;padding-top:20vh}',
    '.acn-palette{width:480px;max-height:400px;background:#1a1a2e;',
    'border:1px solid #333;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.4);',
    'overflow:hidden;display:flex;flex-direction:column}',
    '.acn-palette-input{padding:12px 16px;background:transparent;border:none;',
    'border-bottom:1px solid #333;color:#eee;font-size:15px;outline:none;font-family:inherit}',
    '.acn-palette-list{overflow-y:auto;flex:1}',
    '.acn-palette-item{padding:10px 16px;cursor:pointer;display:flex;',
    'justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.acn-palette-item:hover,.acn-palette-item.acn-selected{background:rgba(255,255,255,.08)}',
    '.acn-palette-item-left{flex:1;min-width:0}',
    '.acn-palette-item-name{font-family:monospace;font-weight:bold;color:#eee;font-size:14px}',
    '.acn-palette-item-desc{color:#888;font-size:12px;margin-top:2px}',
    '.acn-palette-item-run{flex-shrink:0;margin-left:10px;color:#888;font-size:13px;',
    'padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,.1)}',
    '.acn-palette-empty{padding:20px 16px;color:#555;font-size:13px;text-align:center}',
    // --- /Commands panel section ---
    '.acn-cmd-card{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05);',
    'display:flex;justify-content:space-between;align-items:flex-start;gap:8px}',
    '.acn-cmd-card:hover{background:rgba(255,255,255,.03)}',
    '.acn-cmd-info{flex:1;min-width:0}',
    '.acn-cmd-name{font-family:monospace;font-weight:700;font-size:12px;color:#ccc;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.acn-cmd-desc{font-size:10px;color:#666;margin-top:2px;white-space:nowrap;',
    'overflow:hidden;text-overflow:ellipsis}',
    '.acn-cmd-btns{display:flex;gap:4px;flex-shrink:0}',
    '.acn-cmd-btn{width:22px;height:22px;background:rgba(255,255,255,.07);border-radius:5px;',
    'display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;',
    'color:#aaa;border:none;font-family:inherit;transition:background .1s,color .1s}',
    '.acn-cmd-btn:hover{background:var(--acn-accent);color:#fff}',
    '.acn-cmd-btn.acn-cmd-del-confirm{background:#b91c1c;color:#fff}',
    '.acn-cmd-empty{padding:12px 14px;font-size:11px;color:#555;line-height:1.6}',
    '.acn-cmd-tip{padding:6px 14px 10px;font-size:10px;color:#444;font-style:italic}',
    '.acn-cmd-new-btn{margin:8px 14px;padding:7px 12px;width:calc(100% - 28px);',
    'background:rgba(var(--acn-rgb),.08);border:1px solid rgba(var(--acn-rgb),.2);',
    'border-radius:7px;color:var(--acn-accent);font-size:11px;font-weight:600;',
    'font-family:inherit;cursor:pointer;text-align:center;box-sizing:border-box}',
    '.acn-cmd-new-btn:hover{background:rgba(var(--acn-rgb),.15)}',
    // Command form
    '.acn-cmd-form{padding:10px 14px}',
    '.acn-cmd-form-title{font-size:11px;font-weight:700;color:var(--acn-accent);',
    'text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}',
    '.acn-cmd-label{font-size:10px;color:#888;margin-bottom:3px;display:block}',
    '.acn-cmd-name-row{display:flex;align-items:center;gap:4px;margin-bottom:8px}',
    '.acn-cmd-prefix{font-family:monospace;font-size:13px;color:#aaa}',
    '.acn-cmd-input{width:100%;padding:5px 8px;background:rgba(255,255,255,.06);',
    'border:1px solid rgba(255,255,255,.12);border-radius:5px;color:#ddd;',
    'font-size:12px;font-family:inherit;box-sizing:border-box;outline:none}',
    '.acn-cmd-input:focus{border-color:var(--acn-accent)}',
    '.acn-cmd-textarea{width:100%;padding:6px 8px;background:rgba(255,255,255,.06);',
    'border:1px solid rgba(255,255,255,.12);border-radius:5px;color:#ddd;',
    'font-size:11px;font-family:inherit;box-sizing:border-box;outline:none;',
    'resize:vertical;min-height:90px;line-height:1.5}',
    '.acn-cmd-textarea:focus{border-color:var(--acn-accent)}',
    '.acn-cmd-form-err{font-size:10px;color:#f87171;margin-top:4px;min-height:14px}',
    '.acn-cmd-form-btns{display:flex;gap:8px;margin-top:10px}',
    '.acn-cmd-form-save{flex:1;padding:7px;background:var(--acn-accent);border:none;',
    'border-radius:6px;color:#fff;font-size:11px;font-weight:600;font-family:inherit;cursor:pointer}',
    '.acn-cmd-form-cancel{flex:1;padding:7px;background:rgba(255,255,255,.08);border:none;',
    'border-radius:6px;color:#aaa;font-size:11px;font-family:inherit;cursor:pointer}',
    // Export options (reuse acn-exp-* from main file, add section wrapper)
    '.acn-exp-opt{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);',
    'cursor:pointer;transition:background .12s}',
    '.acn-exp-opt:hover{background:rgba(var(--acn-rgb),.06)}',
    '.acn-exp-icon{font-size:16px;margin-bottom:3px}',
    '.acn-exp-title{font-size:12px;font-weight:600;color:#ccc;margin-bottom:2px}',
    '.acn-exp-desc{font-size:10px;color:#666;line-height:1.4}',
].join('');


// ============================================================
// SECTION 2 — CROSS-DEPENDENCY STUBS
// ============================================================

// CROSS-DEPENDENCY: Export Summary calls generateFullSummary() from Group E1.
// During Phase 1, stub with a graceful fallback.
function getSummaryForExport() {
    if (typeof generateFullSummary === 'function') return generateFullSummary();
    return null; // Group E1 not integrated yet
}

// CROSS-DEPENDENCY: Export Bookmarks reads from Group D's storage.
// Storage key: 'acn-bookmarks-v1'
// Value: JSON object keyed by normalizeConversationUrl()
//   { [url]: { bookmarks: [ { entityType, msgIndex, preview, ... } ] } }
function getConversationBookmarks() {
    var url = normalizeConversationUrl();
    var raw = '{}';
    try { raw = GM_getValue('acn-bookmarks-v1', '{}'); } catch (e) {}
    var all;
    try { all = JSON.parse(raw); } catch (e) { all = {}; }
    var entry = all[url];
    if (!entry || !Array.isArray(entry.bookmarks)) return [];
    return entry.bookmarks;
}


// ============================================================
// SECTION 3 — IMAGE GALLERY
// ============================================================

/**
 * Returns true when the given <img> element is a user-uploaded or
 * AI-generated content image, rather than UI chrome.
 *
 * Used both by getConversationImages() (gallery) and by
 * hasContentImage() (Navigate panel indicator) so both features
 * stay in sync with the same detection logic.
 */
function isContentImage(img) {
    // 1. Size filter: reject tiny images (icons, avatars, tracking pixels)
    var w = img.naturalWidth  || img.width  || parseInt(img.getAttribute('width'))  || 0;
    var h = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || 0;
    if ((w > 0 && w < 50) || (h > 0 && h < 50)) return false;

    // 2. Accessibility / decorative filter
    if (img.getAttribute('aria-hidden') === 'true') return false;
    if (img.getAttribute('role') === 'presentation') return false;

    // 3. Source filter: reject known non-content patterns
    var src = (img.src || '').toLowerCase();
    if (src.indexOf('data:image/svg') === 0) return false; // inline SVG icons
    if (src.indexOf('avatar')   !== -1) return false;
    if (src.indexOf('favicon')  !== -1) return false;
    if (src.indexOf('emoji')    !== -1) return false;
    if (src.indexOf('logo')     !== -1) return false;

    // 4. Class/parent filter: reject images inside known UI chrome
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

    // 5. Large enough — likely content
    if (w >= 50 && h >= 50) return true;

    // 6. Dimensions unknown (not yet loaded) — include by default
    if (w === 0 && h === 0) return true;

    return true;
}

/**
 * Returns true if a question element (the raw DOM node stored in q.element)
 * contains at least one content image.
 *
 * Called from orbPopulateNavigate() to add the image-indicator prefix.
 * Integration: see SECTION 4 below and the integration note at the top.
 */
function hasContentImage(questionEl) {
    if (!questionEl) return false;
    var imgs = questionEl.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
        if (isContentImage(imgs[i])) return true;
    }
    return false;
}

/**
 * Scans all user and AI messages for content images.
 * Returns an array of image-descriptor objects:
 *   { element, src, alt, msgElement, msgIndex, isUserMsg, width, height }
 */
function getConversationImages() {
    var allImages = [];

    if (typeof platform === 'undefined' || !platform) return allImages;

    var userMsgs = platform.getUserMessages
        ? Array.from(platform.getUserMessages())
        : [];
    var aiMsgs = platform.getAIMessages
        ? Array.from(platform.getAIMessages())
        : [];
    var allMsgs = userMsgs.concat(aiMsgs);

    allMsgs.forEach(function (msgEl, idx) {
        var isUser = userMsgs.indexOf(msgEl) !== -1;
        var imgs = msgEl.querySelectorAll('img');
        imgs.forEach(function (img) {
            if (!isContentImage(img)) return;
            allImages.push({
                element:    img,
                src:        img.src,
                alt:        img.alt || '',
                msgElement: msgEl,
                msgIndex:   idx,
                isUserMsg:  isUser,
                width:      img.naturalWidth  || img.width  || 0,
                height:     img.naturalHeight || img.height || 0
            });
        });
    });

    return allImages;
}

/**
 * Returns the file-extension string that corresponds to a MIME type.
 * Falls back to '.png' for unknown types.
 */
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

/**
 * Downloads an image by fetching it as a blob (CORS permitting).
 * Falls back to opening in a new tab with an informative toast.
 */
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

/**
 * Builds the 3-column thumbnail grid inside a Tools panel container.
 * Appends a section header and grid (or empty notice) directly to `container`.
 */
function renderImageGallery(container) {
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

        // Thumbnail — same src as original; CSS constrains display size
        var thumb = document.createElement('img');
        thumb.className = 'acn-gallery-thumb';
        thumb.src       = imgData.src;
        thumb.alt       = imgData.alt || ('Image ' + (i + 1));
        thumb.setAttribute('loading', 'lazy');

        // Broken-image fallback
        thumb.addEventListener('error', function () {
            thumb.style.display = 'none';
            var fallback = document.createElement('div');
            fallback.className   = 'acn-gallery-thumb-fallback';
            fallback.textContent = '\uD83D\uDDBC\uFE0F \u2715';
            card.insertBefore(fallback, label);
        });

        // Label: Q#N for user messages, A#N for AI responses
        var label = document.createElement('div');
        label.className   = 'acn-gallery-label';
        label.textContent = imgData.isUserMsg
            ? 'Q#' + (imgData.msgIndex + 1)
            : 'A#' + (imgData.msgIndex + 1);

        // Action buttons — hidden until card hover (CSS controls visibility)
        var actions = document.createElement('div');
        actions.className = 'acn-gallery-actions';

        // Navigate button
        var navBtn = document.createElement('span');
        navBtn.className   = 'acn-gallery-btn';
        navBtn.textContent = '\u2197'; // arrow up-right
        navBtn.title       = 'Go to message';
        navBtn.addEventListener('click', (function (data) {
            return function (e) {
                e.stopPropagation();
                data.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                data.msgElement.classList.add('acn-highlight-flash');
                setTimeout(function () {
                    data.msgElement.classList.remove('acn-highlight-flash');
                }, 1500);
            };
        })(imgData));

        // Download button
        var dlBtn = document.createElement('span');
        dlBtn.className   = 'acn-gallery-btn';
        dlBtn.textContent = '\u2B07'; // downwards arrow
        dlBtn.title       = 'Download image';
        dlBtn.addEventListener('click', (function (data, idx) {
            return function (e) {
                e.stopPropagation();
                downloadImage(data.src, 'image-' + (idx + 1));
            };
        })(imgData, i));

        actions.appendChild(navBtn);
        actions.appendChild(dlBtn);

        // Clicking the thumbnail navigates to the source message
        thumb.addEventListener('click', (function (data) {
            return function () {
                data.msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                data.msgElement.classList.add('acn-highlight-flash');
                setTimeout(function () {
                    data.msgElement.classList.remove('acn-highlight-flash');
                }, 1500);
            };
        })(imgData));

        card.appendChild(thumb);
        card.appendChild(label);
        card.appendChild(actions);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}


// ============================================================
// SECTION 4 — NAVIGATE PANEL: IMAGE INDICATOR INTEGRATION
// ============================================================
//
// The integration agent must modify orbPopulateNavigate() in the main file.
// Inside the _questions.forEach callback, locate:
//
//   var textEl = createElement('div', { className: 'acn-qt', textContent: q.summary });
//
// Immediately AFTER that line, insert:
//
//   if (q.element && hasContentImage(q.element)) {
//       textEl.textContent = '\uD83D\uDDBC\uFE0F ' + textEl.textContent;
//   }
//
// hasContentImage() is defined in SECTION 3 above. No other changes to
// orbPopulateNavigate() are needed. The fingerprint logic, stat counter,
// and click handler remain unchanged.
//
// ============================================================


// ============================================================
// SECTION 5 — EXPORT UTILITIES
// ============================================================

/**
 * Returns the canonical URL used as a key for per-conversation storage.
 * Strips query params and hash so the URL is stable across page refreshes.
 */
function normalizeConversationUrl() {
    return window.location.origin + window.location.pathname;
}

/**
 * Interleaves user questions and AI messages into a single timeline
 * sorted by DOM position (compareDocumentPosition).
 * Returns an array of { type: 'user'|'ai', element }.
 */
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
        // DOCUMENT_POSITION_FOLLOWING means b comes after a
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING)  return 1;
        return 0;
    });

    return items;
}

/**
 * Walks the DOM tree of `el`, producing a markdown-like text string.
 * Preserves code blocks with fenced markdown, basic link syntax,
 * and strips known platform UI chrome.
 */
function extractMarkdownContent(el) {
    var result = [];
    var skipUntil = null; // used to skip subtrees we've already processed

    // Classes and attributes that mark UI chrome to skip
    function isUIChrome(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        var cls = (node.className || '').toLowerCase();
        var role = (node.getAttribute && node.getAttribute('aria-hidden')) || '';
        if (role === 'true') return true;
        // Common chrome class fragments across platforms
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
        // Skip UI chrome subtrees
        if (node.nodeType === Node.ELEMENT_NODE && isUIChrome(node)) {
            // Jump past all descendants by moving to next sibling territory
            node = walker.nextNode();
            // Skip all nodes that are inside the chrome element we just saw.
            // We do this by checking if it's still a descendant.
            // Because TreeWalker visits depth-first we simply keep advancing
            // until we exit the skipped subtree.
            continue;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            var text = node.textContent;
            if (text) result.push(text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            var tag = node.nodeName;

            if (tag === 'PRE') {
                // Fenced code block — collect the entire PRE as one unit
                var codeEl  = node.querySelector('code');
                var lang    = '';
                if (codeEl) {
                    var langMatch = (codeEl.className || '').match(/language-(\w+)/);
                    if (langMatch) lang = langMatch[1];
                }
                var codeText = (codeEl ? codeEl : node).textContent.trim();
                result.push('\n```' + lang + '\n' + codeText + '\n```\n');
                // Skip all children of PRE — we've consumed the content
                // Advance to the next node at the same level or above
                while (walker.currentNode !== node && walker.currentNode) {
                    var next = walker.nextNode();
                    if (!next) break;
                    // If next is no longer inside the PRE, we're done skipping
                    if (!node.contains(next)) {
                        // Put the cursor here and let the outer loop re-process
                        // We cannot "push back" in TreeWalker, so we process it now
                        node = next;
                        continue;
                    }
                }
                node = walker.nextNode();
                continue;
            }

            if (tag === 'BR')  { result.push('\n'); }
            if (tag === 'P'  || tag === 'DIV') { result.push('\n'); }
            if (tag === 'H1' || tag === 'H2' || tag === 'H3') { result.push('\n## '); }
            if (tag === 'LI') { result.push('\n- '); }

            if (tag === 'A' && node.href) {
                var linkText = node.textContent.trim();
                result.push('[' + linkText + '](' + node.href + ')');
                // Skip link children since we've handled text
                node = walker.nextNode();
                while (node && node !== el && (node.nodeType === Node.TEXT_NODE ||
                       (node.nodeType === Node.ELEMENT_NODE && node.closest('a') === node))) {
                    node = walker.nextNode();
                }
                continue;
            }
        }

        node = walker.nextNode();
    }

    return result.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Creates a Blob from `content` and triggers a browser file download.
 * The link element is created, clicked, and cleaned up in 100 ms.
 */
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

/**
 * Exports the entire conversation (user + AI messages) as a Markdown file.
 * Messages are ordered by DOM position via buildTimeline().
 */
function exportFullConversation() {
    var questions = typeof _questions !== 'undefined' ? _questions : [];
    var aiMsgsArr = [];
    if (typeof platform !== 'undefined' && platform && platform.getAIMessages) {
        aiMsgsArr = Array.from(platform.getAIMessages());
    } else if (typeof getAIMessages === 'function') {
        aiMsgsArr = Array.from(getAIMessages());
    }

    var timeline = buildTimeline(questions, aiMsgsArr);

    var platformTitle = (typeof platform !== 'undefined' && platform && platform.title)
        ? platform.title
        : window.location.hostname;
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

    var md = lines.join('\n');
    downloadFile('conversation-export.md', md);
    if (typeof showToast === 'function') showToast('Conversation exported');
}

/**
 * Exports bookmarked items (from Group D storage) as a Markdown file.
 * Falls back to a toast if no bookmarks are found.
 */
function exportBookmarks() {
    var bookmarks = getConversationBookmarks();

    if (bookmarks.length === 0) {
        if (typeof showToast === 'function') showToast('No bookmarks in this conversation');
        return;
    }

    // Sort by msgIndex ascending
    bookmarks.sort(function (a, b) { return (a.msgIndex || 0) - (b.msgIndex || 0); });

    var typeIcons = {
        'user-msg': '\uD83D\uDCCC',
        'ai-msg':   '\uD83D\uDCCC',
        'code':     '\uD83D\uDCBB',
        'file':     '\uD83D\uDCC4'
    };
    var typeLabels = {
        'user-msg': 'Your Question',
        'ai-msg':   'AI Response',
        'code':     'Code Block',
        'file':     'File'
    };

    var platformTitle = (typeof platform !== 'undefined' && platform && platform.title)
        ? platform.title
        : window.location.hostname;
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

/**
 * Calls generateFullSummary() (Group E1), formats the result as Markdown,
 * and triggers a file download. Falls back with a toast when E1 is absent.
 */
function exportSummary() {
    var summary = getSummaryForExport();

    if (!summary) {
        if (typeof showToast === 'function') {
            showToast('Summary not available yet — Group E1 not integrated');
        }
        return;
    }

    var platformTitle = (typeof platform !== 'undefined' && platform && platform.title)
        ? platform.title
        : window.location.hostname;
    var dateStr = new Date().toISOString().split('T')[0];

    var lines = [];
    lines.push('# Conversation Summary');
    lines.push('**Platform:** ' + platformTitle);
    lines.push('**Date:** ' + dateStr);
    lines.push('');
    lines.push('> \u2139\uFE0F This summary was generated by heuristic pattern matching, not AI.');
    lines.push('');
    lines.push('---');

    // Topics
    if (summary.topics && summary.topics.length > 0) {
        lines.push('');
        lines.push('## Topics');
        lines.push(summary.topics.join(' \u00B7 '));
    }

    // Conversation Map
    if (summary.map && summary.map.length > 0) {
        lines.push('');
        lines.push('## Conversation Map');
        summary.map.forEach(function (seg) {
            // Kept in sync with the userscript (v12.3): startIdx/endIdx are
            // combined-timeline positions, not question numbers.
            var range = 'msgs ' + ((seg.startIdx || 0) + 1) + '\u2013' + ((seg.endIdx || 0) + 1);
            lines.push('- **' + seg.label + '** (' + range + ')');
            if (Array.isArray(seg.entities)) {
                seg.entities.forEach(function (ent) {
                    lines.push('  - ' + (ent.icon || '') + ' ' + ent.label);
                });
            }
        });
    }

    // Key Points
    if (summary.keyPoints && summary.keyPoints.length > 0) {
        lines.push('');
        lines.push('## Key Points');
        summary.keyPoints.forEach(function (kp) {
            var icon = kp.type === 'decision' ? '\uD83D\uDD39' :
                       kp.type === 'finding'  ? '\uD83D\uDD38' : '\uD83D\uDD3A';
            lines.push('- ' + icon + ' ' + kp.text);
        });
    }

    // Stats
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


// ============================================================
// SECTION 6 — /COMMANDS: STORAGE AND CRUD
// ============================================================

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

/**
 * Sanitizes a command name to lowercase alphanumeric + hyphens, max 30 chars.
 * Spaces become hyphens. Other special chars are stripped.
 */
function sanitizeCommandName(raw) {
    return raw.toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '')
              .substring(0, 30);
}

/**
 * Creates a new command. Returns { success: true, command } or { error: string }.
 */
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

/**
 * Updates an existing command by id. Returns { success: true } or { error: string }.
 */
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
            if (updates.description !== undefined) {
                commands[i].description = updates.description;
            }
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

/**
 * Deletes the command with the given id from storage.
 */
function deleteCommand(id) {
    var commands = loadCommands().filter(function (cmd) { return cmd.id !== id; });
    saveCommands(commands);
}

/**
 * Returns a copy of `commands` sorted by lastUsedAt descending,
 * with never-used commands at the bottom sorted by createdAt descending.
 */
function sortCommands(commands) {
    return commands.slice().sort(function (a, b) {
        if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        return b.createdAt - a.createdAt;
    });
}

/**
 * Filters `commands` by substring match on name and description.
 * Returns all commands when `query` is empty.
 */
function filterCommands(query, commands) {
    if (!query) return commands;
    var q = query.toLowerCase();
    return commands.filter(function (cmd) {
        return cmd.name.toLowerCase().indexOf(q)        !== -1 ||
               cmd.description.toLowerCase().indexOf(q) !== -1;
    });
}


// ============================================================
// SECTION 7 — /COMMANDS: INJECTION MECHANISM
// ============================================================

/**
 * Returns the chat input element for the current platform.
 * Tries platform-specific selectors in order, falls back to generic.
 */
function findChatInput() {
    var platformId = (typeof platform !== 'undefined' && platform) ? platform.id : '';
    var selectors = {
        claude: [
            'div.ProseMirror[contenteditable="true"]',
            '[contenteditable="true"].prose',
            'fieldset textarea'
        ],
        chatgpt: [
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'div[contenteditable="true"]#prompt-textarea'
        ],
        grok: [
            'textarea',
            '[contenteditable="true"]'
        ],
        gemini: [
            'div.ql-editor[contenteditable="true"]',
            '.text-input-field [contenteditable="true"]',
            'rich-textarea [contenteditable="true"]'
        ],
        perplexity: [
            'textarea',
            '[contenteditable="true"]'
        ]
    };

    var tryList = selectors[platformId] || ['textarea', '[contenteditable="true"]'];
    for (var i = 0; i < tryList.length; i++) {
        var el = document.querySelector(tryList[i]);
        if (el) return el;
    }
    return null;
}

/**
 * Copies `text` to the clipboard.
 * Tries the modern Clipboard API first, falls back to execCommand.
 */
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

/**
 * Attempts to inject `text` directly into the platform's chat input.
 * Returns true on success, false if injection is not possible.
 *
 * - TEXTAREA: uses the native value setter so React/Vue listeners fire.
 * - contenteditable (ProseMirror etc.): uses execCommand('insertText').
 */
function tryDirectInject(text) {
    try {
        var input = findChatInput();
        if (!input) return false;

        if (input.tagName === 'TEXTAREA') {
            var nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype, 'value'
            ).set;
            nativeSetter.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        if (input.contentEditable === 'true') {
            input.focus();
            // Clear existing content first
            input.textContent = '';
            // Insert using execCommand so the editor's undo stack is preserved
            document.execCommand('insertText', false, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }
    } catch (e) {
        // Direct injection failed; clipboard fallback is already done
        return false;
    }
    return false;
}

/**
 * Focuses the platform chat input and moves the cursor to the end.
 */
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
            range.collapse(false); // collapse to end
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {}
    }
}

/**
 * Executes a command: copy to clipboard, attempt direct injection,
 * focus input, update usage stats, show toast.
 */
function executeCommand(command) {
    // Update usage stats
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

    // Step 1: Always copy to clipboard
    copyToClipboard(prompt);

    // Step 2: Try direct injection
    var injected = tryDirectInject(prompt);

    // Step 3: Focus input
    focusChatInput();

    // Step 4: Inform user
    if (typeof showToast === 'function') {
        if (injected) {
            showToast('\u2713 /' + command.name + ' injected \u2014 press Enter to send');
        } else {
            showToast('\uD83D\uDCCB /' + command.name + ' copied \u2014 Ctrl+V to paste');
        }
    }
}


// ============================================================
// SECTION 8 — FLOATING COMMAND PALETTE
// ============================================================

var _paletteOpen      = false;
var _paletteSelIdx    = -1;   // currently highlighted item index
var _paletteFiltered  = [];   // current filtered+sorted command list displayed

function isPaletteOpen() {
    return _paletteOpen;
}

/**
 * Toggles the command palette open or closed.
 */
function toggleCommandPalette() {
    if (_paletteOpen) {
        closeCommandPalette();
    } else {
        openCommandPalette();
    }
}

/**
 * Creates the palette overlay DOM and inserts it into document.body.
 * Auto-focuses the search input.
 */
function openCommandPalette() {
    if (_paletteOpen) return;
    _paletteOpen   = true;
    _paletteSelIdx = -1;

    var overlay = document.createElement('div');
    overlay.className  = 'acn-palette-overlay';
    overlay.id         = 'acn-palette-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Command palette');

    // Close on overlay background click
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeCommandPalette();
    });

    var palette = document.createElement('div');
    palette.className = 'acn-palette';

    // Search input
    var input = document.createElement('input');
    input.className   = 'acn-palette-input';
    input.type        = 'text';
    input.placeholder = 'Search commands\u2026';
    input.setAttribute('aria-label', 'Search commands');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    // List container
    var list = document.createElement('div');
    list.className  = 'acn-palette-list';
    list.id         = 'acn-palette-list';
    list.setAttribute('role', 'listbox');

    // Initial render
    _refreshPaletteList(list, '');

    input.addEventListener('input', function () {
        _paletteSelIdx = -1;
        _refreshPaletteList(list, input.value);
    });

    palette.appendChild(input);
    palette.appendChild(list);
    overlay.appendChild(palette);
    document.body.appendChild(overlay);

    // Auto-focus the search input
    setTimeout(function () { input.focus(); }, 20);
}

/**
 * Removes the palette overlay and resets state.
 */
function closeCommandPalette() {
    _paletteOpen      = false;
    _paletteSelIdx    = -1;
    _paletteFiltered  = [];
    var overlay = document.getElementById('acn-palette-overlay');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

/**
 * Rebuilds the palette list items based on the current search query.
 * Clears and repopulates `listEl` in place.
 */
function _refreshPaletteList(listEl, query) {
    // Clear
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
        item.className   = 'acn-palette-item';
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
        runEl.textContent = '\u25B6'; // play triangle

        item.appendChild(left);
        item.appendChild(runEl);

        item.addEventListener('click', (function (command) {
            return function () {
                executeCommand(command);
                closeCommandPalette();
            };
        })(cmd));

        item.addEventListener('mouseenter', (function (i) {
            return function () {
                _paletteSelIdx = i;
                _updatePaletteSelection(listEl);
            };
        })(idx));

        listEl.appendChild(item);
    });
}

/**
 * Applies the .acn-selected class to the item at _paletteSelIdx,
 * removing it from all others, and scrolls the selected item into view.
 */
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

/**
 * Moves the palette selection highlight by `dir` (+1 down, -1 up).
 */
function moveSelection(dir) {
    var overlay = document.getElementById('acn-palette-overlay');
    if (!overlay) return;
    var list  = overlay.querySelector('#acn-palette-list');
    if (!list) return;
    var items = list.querySelectorAll('.acn-palette-item');
    if (items.length === 0) return;

    _paletteSelIdx += dir;
    if (_paletteSelIdx < 0)              _paletteSelIdx = items.length - 1;
    if (_paletteSelIdx >= items.length)  _paletteSelIdx = 0;

    _updatePaletteSelection(list);
}

/**
 * Executes the currently highlighted palette item.
 * If nothing is highlighted, executes the first item.
 */
function executeSelected() {
    var idx = _paletteSelIdx;
    if (idx < 0 && _paletteFiltered.length > 0) idx = 0;
    if (idx < 0 || idx >= _paletteFiltered.length) return;
    var cmd = _paletteFiltered[idx];
    executeCommand(cmd);
    closeCommandPalette();
}


// ============================================================
// SECTION 9 — /COMMANDS: TOOLS PANEL UI
// ============================================================

/**
 * Renders the full /Commands section (header + card list or empty state + form area)
 * into `container`. `container` is a scrollable wrapper inside the Tools panel.
 *
 * The form state is managed by swapping contents of `commandsBody`:
 *   - list view:  card list + "New Command" button + tip
 *   - form view:  inline create/edit form
 */
function renderCommandsSection(container) {
    var section = document.createElement('div');
    section.className = 'acn-tool-section';

    var header = document.createElement('div');
    header.className   = 'acn-tool-section-header';
    header.textContent = '\u2328\uFE0F /Commands';
    section.appendChild(header);

    // Body area — swapped between list and form views
    var body = document.createElement('div');
    body.id = 'acn-cmd-body';
    section.appendChild(body);

    container.appendChild(section);

    // Initial render: list view
    _renderCommandListView(body, null);
}

/**
 * Renders the list view inside `body`.
 * `editingId` is the id of the command being edited, or null for create mode.
 * (Passed through when refreshing after save/cancel.)
 */
function _renderCommandListView(body, _unused) {
    // Clear body
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

    // "New Command" button
    var newBtn = document.createElement('button');
    newBtn.className   = 'acn-cmd-new-btn';
    newBtn.textContent = '+ New Command';
    newBtn.addEventListener('click', function () {
        _renderCommandForm(body, null);
    });
    body.appendChild(newBtn);

    // Keyboard shortcut tip
    var tip = document.createElement('div');
    tip.className   = 'acn-cmd-tip';
    tip.textContent = 'Tip: Ctrl+/ to open quick palette';
    body.appendChild(tip);
}

/**
 * Builds a single command card element.
 * Includes play, edit, and delete buttons with inline delete confirmation.
 */
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

    // Play button
    var playBtn = document.createElement('button');
    playBtn.className   = 'acn-cmd-btn';
    playBtn.textContent = '\u25B6';
    playBtn.title       = 'Execute';
    playBtn.addEventListener('click', function () {
        executeCommand(cmd);
    });

    // Edit button
    var editBtn = document.createElement('button');
    editBtn.className   = 'acn-cmd-btn';
    editBtn.textContent = '\u270E'; // pencil
    editBtn.title       = 'Edit';
    editBtn.addEventListener('click', function () {
        _renderCommandForm(body, cmd);
    });

    // Delete button — inline confirmation
    var delBtn = document.createElement('button');
    delBtn.className   = 'acn-cmd-btn';
    delBtn.textContent = '\u2715';
    delBtn.title       = 'Delete';
    var delConfirmTimer = null;
    var awaitingConfirm = false;

    delBtn.addEventListener('click', function () {
        if (awaitingConfirm) {
            // Second click: confirm delete
            clearTimeout(delConfirmTimer);
            deleteCommand(cmd.id);
            _renderCommandListView(body, null);
        } else {
            // First click: arm confirmation
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

/**
 * Renders the create/edit form inside `body`.
 * `existingCmd` is null for create mode, or a command object for edit mode.
 */
function _renderCommandForm(body, existingCmd) {
    // Clear body
    while (body.firstChild) body.removeChild(body.firstChild);

    var isEdit = !!existingCmd;

    var form = document.createElement('div');
    form.className = 'acn-cmd-form';

    var titleEl = document.createElement('div');
    titleEl.className   = 'acn-cmd-form-title';
    titleEl.textContent = isEdit ? 'Edit Command' : 'Create Command';
    form.appendChild(titleEl);

    // Name row
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
    nameInput.placeholder = 'handoff';
    nameInput.maxLength   = 30;
    nameInput.setAttribute('autocomplete', 'off');
    nameInput.setAttribute('spellcheck', 'false');
    if (isEdit) nameInput.value = existingCmd.name;

    nameRow.appendChild(prefix);
    nameRow.appendChild(nameInput);
    form.appendChild(nameRow);

    // Description row
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

    // Prompt row
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

    // Error display
    var errEl = document.createElement('div');
    errEl.className = 'acn-cmd-form-err';
    form.appendChild(errEl);

    // Buttons
    var btnRow = document.createElement('div');
    btnRow.className = 'acn-cmd-form-btns';

    var cancelBtn = document.createElement('button');
    cancelBtn.className   = 'acn-cmd-form-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
        _renderCommandListView(body, null);
    });

    var saveBtn = document.createElement('button');
    saveBtn.className   = 'acn-cmd-form-save';
    saveBtn.textContent = isEdit ? 'Save Changes' : 'Save Command';
    saveBtn.addEventListener('click', function () {
        var nameVal   = nameInput.value.trim();
        var descVal   = descInput.value.trim();
        var promptVal = promptTA.value;
        var result;

        if (isEdit) {
            result = updateCommand(existingCmd.id, {
                name:        nameVal,
                description: descVal,
                prompt:      promptVal
            });
        } else {
            result = createCommand(nameVal, descVal, promptVal);
        }

        if (result.error) {
            errEl.textContent = result.error;
            return;
        }

        _renderCommandListView(body, null);
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    form.appendChild(btnRow);

    body.appendChild(form);
    // Focus the name field
    setTimeout(function () { nameInput.focus(); }, 20);
}


// ============================================================
// SECTION 10 — MAIN PANEL BUILDER: orbBuildPanelTools()
// ============================================================

/**
 * Builds the Tools panel DOM element.
 *
 * REPLACES orbBuildPanelExport() in the main file.
 * The panel id is 'acn-panel-tools' (was 'acn-panel-export').
 *
 * Structure:
 *   - Panel header "Wrench Tools" with close button
 *   - Scrollable body containing:
 *       1. Image Gallery section
 *       2. Exports section (3 clickable cards)
 *       3. /Commands section (CRUD + list)
 *       4. Footer note
 */
function orbBuildPanelTools() {
    var panel = createElement('div', { id: 'acn-panel-tools', className: 'acn-panel' });
    panel.appendChild(orbBuildPanelHeader('\uD83D\uDD27 Tools'));

    // Scrollable body — all sections live inside this
    var scroll = createElement('div', { style: 'flex:1;overflow-y:auto' });

    // ── 1. Image Gallery ────────────────────────────────────────────
    var gallerySection = document.createElement('div');
    gallerySection.className = 'acn-tool-section';
    renderImageGallery(gallerySection);
    scroll.appendChild(gallerySection);

    // ── 2. Exports ──────────────────────────────────────────────────
    var exportSection = document.createElement('div');
    exportSection.className = 'acn-tool-section';

    var exportHeader = document.createElement('div');
    exportHeader.className   = 'acn-tool-section-header';
    exportHeader.textContent = '\uD83D\uDCCB Exports';
    exportSection.appendChild(exportHeader);

    var TOOLS_EXPORT = [
        {
            id:     'export-full',
            icon:   '\uD83D\uDCC4',
            title:  'Full Conversation',
            desc:   'Markdown with all messages and code blocks.',
            action: exportFullConversation
        },
        {
            id:      'export-bookmarks',
            icon:    '\uD83D\uDCCC',
            title:   'Bookmarks Only',
            desc:    'Pinned messages as structured document.',
            action:  exportBookmarks,
            requires: 'bookmarks'   // informational; action handles missing data gracefully
        },
        {
            id:      'export-summary',
            icon:    '\u03A3',
            title:   'Summary',
            desc:    'Topics, decisions, and action items.',
            action:  exportSummary,
            requires: 'summary'     // informational; action handles missing E1 gracefully
        }
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

    // ── 3. /Commands ────────────────────────────────────────────────
    renderCommandsSection(scroll);

    // ── 4. Footer note ──────────────────────────────────────────────
    var footer = createElement('div', {
        style: 'padding:12px 14px;font-size:10px;color:#444;line-height:1.6;border-top:1px solid rgba(255,255,255,.05)',
        textContent: 'More tools coming soon. Got ideas? Open an issue on GitHub!'
    });
    scroll.appendChild(footer);

    panel.appendChild(scroll);
    return panel;
}


// ============================================================
// SECTION 11 — CSS INJECTION HELPER
// ============================================================

/**
 * Injects the module's CSS into the page.
 *
 * Integration option A (preferred): The integration agent appends ACN_E2_CSS
 * to the existing styleEl.textContent inside orbInjectCSS() in the main file.
 *
 * Integration option B (standalone): Call this function from injectOrbital()
 * if the integration agent cannot modify orbInjectCSS() directly.
 */
function injectE2CSS() {
    var existing = document.getElementById('acn-e2-style');
    if (existing) return;
    var styleEl = document.createElement('style');
    styleEl.id          = 'acn-e2-style';
    styleEl.textContent = ACN_E2_CSS;
    document.head.appendChild(styleEl);
}

// Auto-inject CSS when the module is evaluated
// (Safe to call multiple times; guarded by id check above)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectE2CSS);
} else {
    injectE2CSS();
}


// ============================================================
// SECTION 12 — KEYBOARD LISTENER
// ============================================================
//
// Integration: This block must be placed at module level inside the main IIFE,
// after all functions defined in this module are in scope.
// The integration agent should append this listener call alongside the other
// document.addEventListener calls in the main file (around line 2335-2410).
//
// The listener is self-contained: it checks isPaletteOpen() and delegates
// to module-level functions only, so no changes to existing listeners are needed.

document.addEventListener('keydown', function (e) {
    // Ctrl+/ or Cmd+/ — toggle command palette
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleCommandPalette();
        return;
    }

    // Remaining keys only matter when palette is open
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
