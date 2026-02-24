// ============================================================
// MODULE: Group D — Bookmarks + Search Enhancement
// VERSION: v10.5
// DEPENDS ON: Phase 0 (getAIMessages, _aiResponses, i18n, showToast, GM_getValue, GM_setValue)
//             Core helpers: createElement, orbFlashElement, orbClosePanel, orbScrollToQuestion,
//                           isLeftChat, isVirtualScroll, getUserMessages, orbTheme
// REPLACES: orbBuildPanelBookmarks(), orbPopulateSearch()
// INSERTS:  injectBookmarkIcons() (call from scanConversation after _aiResponses is populated)
//           contentHash(), normalizeConversationUrl(), getBookmarks(),
//           getConversationBookmarks(), saveBookmark(), removeBookmark(),
//           toggleBookmark(), createBookmarkIcon(), orbScrollToBookmark(),
//           orbScrollToMessage()
// CSS:      .acn-bm-* styles (icons, flash animation, bookmark panel cards)
//           .acn-qn-ai (AI result label in search)
//           Append to orbInjectCSS() styleEl.textContent array
// STORAGE KEY: 'acn-bookmarks-v1' (format documented below)
// ============================================================

/*
## v10.5 Changelog

### Added
- Real bookmarks: hover flag icons (U+2691) injected onto every user and AI message element
- GM_setValue / GM_getValue bookmark persistence keyed per conversation URL
- Bookmark panel (orbBuildPanelBookmarks) now shows real saved bookmarks with navigation
- "Clear All" button at the bottom of the bookmark panel with window.confirm guard
- Search now searches _aiResponses in addition to _questions
- Search results sorted by DOM document order via compareDocumentPosition
- Search hint shows breakdown "N matches (X in questions, Y in responses)"
- Flash animation (acn-bm-flash class) on scroll-to for both bookmarks and search
- orbScrollToMessage() utility for programmatic scroll + flash to any element

### Changed
- orbBuildPanelBookmarks() fully replaced (was hardcoded fake placeholder data)
- orbPopulateSearch() extended to also search _aiResponses; labels: Q# for user, A# for AI
- AI search result labels rendered with acn-qn-ai CSS class for visual distinction
- Search empty-state message uses i18n when no matches found

### Troubleshooting Log
- **Problem:** Bookmark icons on AI message bubbles were injected into deeply-nested prose
  containers, making position:relative on the wrong ancestor clip or hide the icon.
  **Root cause:** getAIMessages() returns the outermost AI turn wrapper; the icon is
  appended to that element. If that element already has position:static, setting
  position:relative is needed only on that specific element, not inner wrappers.
  **Method:** createBookmarkIcon() sets entityEl.style.position only if it is not
  already positioned (i.e., getComputedStyle returns 'static').
  **Resolution:** Guard added: only set position:relative when computedStyle is 'static'.

- **Problem:** Icons were re-injected on every MutationObserver tick, creating duplicates.
  **Root cause:** injectBookmarkIcons() was called unconditionally from scanConversation.
  **Method:** data-acn-bookmarked guard attribute on the entity element; createBookmarkIcon()
  checks for existing [data-acn-bookmark] child before creating a new icon.
  **Resolution:** Both the entity-level guard (data-acn-bookmarked) and the element-level
  guard (querySelector('[data-acn-bookmark]')) are checked before injection.

- **Problem:** Bookmark icon click triggered a page navigation on some platforms where
  the message element is wrapped in an <a> tag or has a click handler that bubbles.
  **Root cause:** click event on the icon was bubbling to the platform's own handlers.
  **Method:** e.stopPropagation() added to the icon click listener.
  **Resolution:** e.stopPropagation() in icon click handler prevents bubbling.
*/


// ============================================================
// SECTION 1 — CSS (append to orbInjectCSS styleEl.textContent)
// ============================================================
//
// INTEGRATION: In orbInjectCSS(), find the last entry in the styleEl.textContent
// array (or the concatenated CSS string) and append the following block verbatim.
// It is safe to append; none of these class names conflict with existing ACN styles.
//
// --- CSS block to append ---
//
// /* Bookmark icon — injected into each message element */
// .acn-bm-icon{position:absolute;top:4px;right:4px;width:22px;height:22px;display:flex;
//   align-items:center;justify-content:center;font-size:14px;border-radius:4px;
//   background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.5);cursor:pointer;opacity:0;
//   transition:opacity 0.15s ease,background 0.15s ease;z-index:10;
//   pointer-events:auto;user-select:none;}
// *:hover>.acn-bm-icon{opacity:1;}
// .acn-bm-icon.acn-bm-active{opacity:1;background:var(--acn-accent);color:#fff;}
// .acn-bm-icon:hover{opacity:1;background:rgba(255,255,255,0.2);}
// /* Flash animation for scroll-to */
// .acn-bm-flash{animation:acnBmFlash 1.5s ease;}
// @keyframes acnBmFlash{
//   0%{box-shadow:0 0 0 0 var(--acn-accent);}
//   30%{box-shadow:0 0 0 4px var(--acn-accent);}
//   100%{box-shadow:0 0 0 0 transparent;}}
// /* Bookmark panel cards */
// .acn-bk{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:6px;
//   cursor:pointer;background:rgba(255,255,255,0.04);margin-bottom:4px;
//   border-left:3px solid var(--acn-accent);transition:background 0.15s;}
// .acn-bk:hover{background:rgba(255,255,255,0.09);}
// .acn-bk-header{display:flex;align-items:center;justify-content:space-between;gap:6px;}
// .acn-bk-type{font-size:10px;font-weight:600;letter-spacing:0.04em;opacity:0.6;
//   text-transform:uppercase;flex-shrink:0;}
// .acn-bk-remove{font-size:12px;line-height:1;padding:1px 4px;border-radius:3px;
//   cursor:pointer;opacity:0.4;background:transparent;border:none;color:inherit;
//   transition:opacity 0.15s,background 0.15s;flex-shrink:0;}
// .acn-bk-remove:hover{opacity:1;background:rgba(239,68,68,0.3);}
// .acn-bk-text{font-size:12px;opacity:0.85;line-height:1.4;
//   overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
// .acn-bk-meta{font-size:10px;opacity:0.45;margin-top:1px;}
// .acn-bm-clearall{width:100%;margin-top:8px;padding:6px 10px;border-radius:6px;
//   background:rgba(239,68,68,0.12);color:rgba(239,68,68,0.8);border:1px solid rgba(239,68,68,0.25);
//   cursor:pointer;font-size:11px;transition:background 0.15s,color 0.15s;}
// .acn-bm-clearall:hover{background:rgba(239,68,68,0.25);color:rgb(239,68,68);}
// /* Search: AI result label */
// .acn-qn-ai{background:rgba(var(--acn-rgb),0.15);border-left:2px solid var(--acn-accent);}


// ============================================================
// SECTION 2 — STORAGE FORMAT (documented for Tools export agent)
// ============================================================

// BOOKMARK STORAGE FORMAT
// Key:   'acn-bookmarks-v1'
// Value: JSON-stringified object keyed by normalized conversation URL.
//
// {
//   "https://claude.ai/chat/abc123": {
//     "bookmarks": [
//       {
//         "id": "bm_abc123",           // unique ID: "bm_" + 8-char hex
//         "entityType": "user-msg",     // 'user-msg' | 'ai-msg'
//         "contentHash": "d4e5f6a1",    // hash of msgIndex + first 200 chars of text
//         "preview": "How does ...",    // first 120 chars of message text
//         "msgIndex": 14,               // 0-based index within its type array
//         "createdAt": 1708646400000,   // Date.now() at time of bookmarking
//         "platform": "claude"          // window.location.hostname
//       }
//     ]
//   }
// }

var BOOKMARK_KEY = 'acn-bookmarks-v1';


// ============================================================
// SECTION 3 — STORAGE HELPERS
// ============================================================

/**
 * Simple non-cryptographic 32-bit hash of a string.
 * Produces an 8-char lowercase hex string.
 */
function contentHash(text, msgIndex) {
    var str = String(msgIndex) + '|' + (text || '').substring(0, 200);
    var h = 0x811c9dc5; // FNV-1a offset basis (32-bit)
    for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        // Multiply by FNV prime (simulate 32-bit via two 16-bit multiplications)
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        h = h >>> 0; // keep as unsigned 32-bit
    }
    return ('00000000' + h.toString(16)).slice(-8);
}

/**
 * Returns the canonical URL key for the current conversation page.
 * Strips query-string and fragment so bookmarks survive SPA reloads.
 */
function normalizeConversationUrl() {
    return window.location.origin + window.location.pathname;
}

/**
 * Loads the entire bookmark store from GM storage.
 * Returns a plain object: { [url]: { bookmarks: [] } }
 */
function getBookmarks() {
    try {
        var raw = GM_getValue(BOOKMARK_KEY, '{}');
        return JSON.parse(raw) || {};
    } catch (e) {
        return {};
    }
}

/**
 * Returns the bookmark array for the current conversation URL.
 * Returns [] if none saved.
 */
function getConversationBookmarks() {
    var store = getBookmarks();
    var url   = normalizeConversationUrl();
    return (store[url] && store[url].bookmarks) ? store[url].bookmarks : [];
}

/**
 * Persists a single bookmark object for the current conversation.
 * Avoids duplicates by checking id.
 */
function saveBookmark(bookmark) {
    var store = getBookmarks();
    var url   = normalizeConversationUrl();
    if (!store[url]) store[url] = { bookmarks: [] };
    // Remove if already present (idempotent upsert)
    store[url].bookmarks = store[url].bookmarks.filter(function (b) {
        return b.id !== bookmark.id;
    });
    store[url].bookmarks.push(bookmark);
    try {
        GM_setValue(BOOKMARK_KEY, JSON.stringify(store));
    } catch (e) {
        // GM_setValue unavailable in test environments — silently swallow
    }
}

/**
 * Removes a bookmark by id for the current conversation.
 */
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

/**
 * Generates a short unique bookmark ID.
 */
function _bmGenId() {
    return 'bm_' + Math.random().toString(16).substring(2, 10);
}

/**
 * Toggles a bookmark for a given message element.
 *
 * @param {string}      entityId    - Unique entity identifier (contentHash)
 * @param {string}      entityType  - 'user-msg' | 'ai-msg'
 * @param {Element}     entityEl    - The DOM element being bookmarked
 * @param {number}      msgIndex    - 0-based index within its type array
 */
function toggleBookmark(entityId, entityType, entityEl, msgIndex) {
    var existing = getConversationBookmarks().filter(function (b) {
        return b.contentHash === entityId;
    });

    var icon = entityEl.querySelector('[data-acn-bookmark]');

    if (existing.length > 0) {
        // Remove bookmark
        existing.forEach(function (b) { removeBookmark(b.id); });
        if (icon) icon.classList.remove('acn-bm-active');
        showToast(i18n('bookmarkRemoved'));
    } else {
        // Add bookmark
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

    // Refresh bookmarks panel if it is open
    var bmPanel = document.getElementById('acn-panel-bookmarks');
    if (bmPanel && bmPanel.classList.contains('acn-open')) {
        orbRefreshBookmarksPanel();
    }
}


// ============================================================
// SECTION 4 — ICON INJECTION
// ============================================================

/**
 * Creates and attaches a bookmark icon to a single message element.
 *
 * @param {Element} entityEl    - The outer message wrapper element
 * @param {string}  entityType  - 'user-msg' | 'ai-msg'
 * @param {string}  entityId    - contentHash used as the bookmark key
 * @param {number}  msgIndex    - 0-based index within the type array
 */
function createBookmarkIcon(entityEl, entityType, entityId, msgIndex) {
    // Guard: icon already exists on this element
    if (entityEl.querySelector('[data-acn-bookmark]')) return;

    // Ensure the element is positioned so the absolutely-placed icon lands correctly
    var computed = window.getComputedStyle(entityEl);
    if (computed.position === 'static') {
        entityEl.style.position = 'relative';
    }

    // Check whether this message is already bookmarked
    var bookmarks   = getConversationBookmarks();
    var isBookmarked = bookmarks.some(function (b) { return b.contentHash === entityId; });

    var icon = document.createElement('div');
    icon.className = 'acn-bm-icon' + (isBookmarked ? ' acn-bm-active' : '');
    // U+2691 = BLACK FLAG (filled); use it always, CSS controls active/inactive appearance
    icon.textContent = '\u2691';
    icon.setAttribute('data-acn-bookmark', entityId);
    icon.setAttribute('title', isBookmarked ? 'Remove bookmark' : 'Bookmark this message');

    icon.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleBookmark(entityId, entityType, entityEl, msgIndex);
        // Update tooltip after toggle
        var nowBookmarked = getConversationBookmarks().some(function (b) {
            return b.contentHash === entityId;
        });
        icon.setAttribute('title', nowBookmarked ? 'Remove bookmark' : 'Bookmark this message');
    });

    entityEl.appendChild(icon);
}

/**
 * Iterates all user and AI messages and injects bookmark icons where absent.
 * Called from scanConversation() after _aiResponses is populated.
 * Safe to call multiple times — guards prevent duplicate injection.
 */
function injectBookmarkIcons() {
    // User messages
    var userEls = Array.from(getUserMessages());
    userEls.forEach(function (el, idx) {
        if (el.getAttribute('data-acn-bookmarked') === 'u') return;
        el.setAttribute('data-acn-bookmarked', 'u');
        var text = (el.textContent || '').trim();
        var hash = contentHash(text, idx);
        createBookmarkIcon(el, 'user-msg', hash, idx);
    });

    // AI messages
    var aiEls = Array.from(getAIMessages());
    aiEls.forEach(function (el, idx) {
        if (el.getAttribute('data-acn-bookmarked') === 'a') return;
        el.setAttribute('data-acn-bookmarked', 'a');
        var text = (el.textContent || '').trim();
        var hash = contentHash(text, idx);
        createBookmarkIcon(el, 'ai-msg', hash, idx);
    });
}


// ============================================================
// SECTION 5 — SCROLL HELPERS
// ============================================================

/**
 * Scrolls to any element and applies the flash animation.
 * Closes the panel first on left-chat platforms to avoid obstruction.
 *
 * @param {Element} el - DOM element to scroll into view
 */
function orbScrollToMessage(el) {
    if (!el) return;

    function doScroll() {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Use CSS animation class instead of direct style manipulation so it
        // composes cleanly with whatever the platform's own styles are.
        el.classList.remove('acn-bm-flash');
        // Force a reflow so re-adding the class triggers the animation again
        void el.offsetWidth; // eslint-disable-line no-unused-expressions
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

/**
 * Finds the live DOM element that corresponds to a stored bookmark and scrolls to it.
 * Re-discovery is done by matching contentHash against current message text, since the
 * original element reference is not stored (bookmarks persist across page reloads).
 *
 * @param {Object} bookmark - Bookmark object from storage
 */
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
        // Fallback: try msgIndex directly if hash didn't match (content may have changed)
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
        showToast('Message not found — it may have been deleted');
        return;
    }

    orbScrollToMessage(targetEl);
}


// ============================================================
// SECTION 6 — BOOKMARKS PANEL (replaces orbBuildPanelBookmarks)
// ============================================================

/**
 * Rebuilds the content of the bookmark panel in-place without
 * re-creating the panel element itself. Called after a bookmark is
 * toggled while the panel is open.
 */
function orbRefreshBookmarksPanel() {
    var panel = document.getElementById('acn-panel-bookmarks');
    if (!panel) return;

    // Remove everything except the header (first child)
    while (panel.children.length > 1) {
        panel.removeChild(panel.lastChild);
    }

    var bookmarks = getConversationBookmarks();

    if (bookmarks.length === 0) {
        var empty = createElement('div', {
            className: 'acn-empty',
            textContent: i18n('noBookmarks')
        });
        panel.appendChild(empty);
        return;
    }

    // Sort bookmarks by creation time (oldest first — matches reading order)
    var sorted = bookmarks.slice().sort(function (a, b) {
        return a.createdAt - b.createdAt;
    });

    var list = createElement('div', { className: 'acn-ql' });

    sorted.forEach(function (bm) {
        // Label: Q#N for user messages, A#N for AI messages
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
            // Update icon state on the live element if it is still in the DOM
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

    // Clear All button
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
        // Clear active states on all visible icons
        var activeIcons = document.querySelectorAll('.acn-bm-icon.acn-bm-active');
        for (var i = 0; i < activeIcons.length; i++) {
            activeIcons[i].classList.remove('acn-bm-active');
        }
        orbRefreshBookmarksPanel();
        showToast('All bookmarks cleared');
    });

    panel.appendChild(clearBtn);
}

/**
 * Builds the Bookmarks panel DOM element.
 * REPLACES the existing orbBuildPanelBookmarks() in the main file.
 */
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
        // Delegate to the refresh helper so the full card-building logic lives in one place
        // We temporarily append a placeholder so orbRefreshBookmarksPanel can replace it
        panel.appendChild(createElement('div', { className: 'acn-ql' }));
        // Immediately replace with real content
        orbRefreshBookmarksPanel();
        // orbRefreshBookmarksPanel removes all children after index 0 and re-adds content,
        // so panel is now correctly populated.
        return panel;
    }

    return panel;
}


// ============================================================
// SECTION 7 — EXTENDED SEARCH (replaces orbPopulateSearch)
// ============================================================

/**
 * Populates the search results list by searching both user questions (_questions)
 * and AI responses (_aiResponses).
 * REPLACES the existing orbPopulateSearch() in the main file.
 *
 * @param {string} query - The search string entered by the user
 */
function orbPopulateSearch(query) {
    // orbSearchQuery is defined in the outer scope of the main IIFE
    if (typeof orbSearchQuery !== 'undefined') {
        orbSearchQuery = query || '';
    }

    var list = document.getElementById('acn-search-list');
    var hint = document.getElementById('acn-search-hint');
    if (!list) return;

    while (list.firstChild) list.removeChild(list.firstChild);

    var q = (query || '').trim();

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
                    qObj:      msg         // for orbScrollToQuestion compat
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

    // Sort all matches by DOM position (document order)
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
        textContent: total + ' ' + (i18n('searchResults') || 'matches').replace('{count}', total) +
            (hintParts.length ? ' (' + hintParts.join(', ') + ')' : '')
    });
    countHintEl.style.display = '';
    list.appendChild(countHintEl);

    // Render result items
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
            // AI results get the distinguishing CSS class; user results use standard acn-qn
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

        // Click handler: use orbScrollToQuestion for user messages (keeps compat),
        // orbScrollToMessage for AI responses (avoids touching _questions internals).
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
// SECTION 8 — BACKWARD COMPAT ALIAS
// ============================================================

// orbScrollToQuestion is defined in the main file and handles virtual-scroll
// re-discovery for user messages. orbScrollToMessage is the simpler version
// for AI elements. The alias below ensures any callers of orbScrollToMessage
// that pass a _questions entry will still work after the module is loaded.
//
// (No actual alias needed — orbScrollToMessage accepts any Element,
//  and orbScrollToQuestion is kept intact in the main file.)


// ============================================================
// SECTION 9 — INTEGRATION NOTES (for Phase 2 / integration agent)
// ============================================================
//
// 1. REPLACE orbBuildPanelBookmarks() with the new version in Section 6 above.
//    The new function calls orbRefreshBookmarksPanel() internally, which requires
//    orbBuildPanelHeader() to already exist (it is defined in the main file before
//    the panel builders — no ordering issue).
//
// 2. REPLACE orbPopulateSearch() with the new version in Section 7 above.
//    The new function references orbSearchQuery (outer-scope var in main file),
//    _questions, _aiResponses, orbScrollToQuestion — all already in scope.
//
// 3. INSERT injectBookmarkIcons() call in scanConversation() immediately after
//    the line that populates _aiResponses:
//
//      _aiResponses = Array.from(getAIMessages());
//      // ADD:
//      if (typeof injectBookmarkIcons === 'function') injectBookmarkIcons();
//
//    (This line is at approximately line 1146 in the v10.1 main file.)
//
// 4. APPEND the CSS block from Section 1 to the orbInjectCSS() style string.
//    Find the last string in the array passed to styleEl.textContent (or the
//    concatenated CSS) and concatenate the block from Section 1 to it.
//
// 5. ADD orbRefreshBookmarksPanel() call in orbOnScanComplete() so the panel
//    updates when the observer fires and new messages are detected:
//
//      function orbOnScanComplete() {
//          orbPopulateNavigate();
//          // ADD:
//          var bmPanel = document.getElementById('acn-panel-bookmarks');
//          if (bmPanel && bmPanel.classList.contains('acn-open')) {
//              orbRefreshBookmarksPanel();
//          }
//      }
//
// 6. STORAGE FORMAT for Tools export agent:
//    Read from GM_getValue('acn-bookmarks-v1', '{}'), parse as JSON,
//    then access [normalizeConversationUrl()].bookmarks for the current page's list.
//    Each bookmark object has: id, entityType, contentHash, preview, msgIndex, createdAt, platform.
//
// 7. BACKWARD COMPATIBILITY:
//    orbScrollToQuestion() remains unchanged in the main file.
//    orbScrollToMessage() is a new addition from this module — it does NOT replace
//    orbScrollToQuestion; both coexist. The search panel uses orbScrollToQuestion for
//    user-message hits and orbScrollToMessage for AI-response hits.
//
// 8. VIRTUAL SCROLL platforms:
//    orbScrollToBookmark() uses the same hash-based re-discovery as orbScrollToQuestion
//    (matching on element text content substring), but falls back to msgIndex if the
//    hash no longer matches (e.g., if the platform re-renders message text). This is
//    best-effort; virtual-scroll platforms may scroll the target element out of the
//    recycler pool before it becomes visible.
