// ============================================================
// MODULE: Group E1 — Summary Panel
// VERSION: v10.6
// DEPENDS ON: Phase 0 (getAIMessages, _questions, _aiResponses, i18n, showToast)
//             Orbital core (createElement, orbBuildPanelHeader)
// REPLACES: orbBuildPanelSummary() entirely
// EXPORTS (for Group E2): generateFullSummary() function
// CSS: .acn-map-*, .acn-topic-*, .acn-kp-*, .acn-gen-*
// ============================================================

/*
## v10.6 Changelog

### Added
- Real Summary panel with heuristic extraction (no AI, pure JS)
- Conversation map timeline with topic segments and entity markers
- Topic extraction using TF-IDF + bigrams, stop word filtering
- Key point detection using signal phrase pattern matching
- Conversation stats (turn count, message lengths, avg lengths)
- Code & file inventory with click-to-scroll on code blocks
- generateFullSummary() callable function (used by Tools export)
- Disclaimer about being heuristic-based (not AI)
- Section collapsing: each section is togglable by clicking its title
- Generate/Regenerate button state management with loading spinner text

### Changed
- orbBuildPanelSummary() completely rewritten

### Troubleshooting Log
- generateFullSummary() is attached to window so Group E2 can call it from outside
  this closure. It must NOT be declared inside any IIFE or module wrapper.
- getAIMessages() returns a NodeList/array of DOM elements, not objects with .text.
  We map them to { element, text, type:'ai' } inside generateFullSummary().
- _questions may be empty on first open before scanConversation() has run.
  The Generate button handles this gracefully by showing "No messages detected yet."
- topicOverlap() intentionally finds pair with LOWEST overlap for merging (most-similar
  adjacent segments share the most topics, meaning higher overlap = more similar).
  The variable name minDiff tracks the lowest overlap score, which corresponds to the
  most similar pair — this is correct per the spec algorithm.
- scanEntities() queries inside the message element's DOM subtree only; it guards
  against detached nodes using a try/catch around querySelectorAll.
- The CSS appended here via a <style> tag uses data-acn-role="summary-styles" so the
  integration agent can locate and remove it if needed. It does NOT interfere with
  the main #acn-style block.

### generateFullSummary() RETURN FORMAT (used by Group E2 Tools export):
// {
//   map: [
//     {
//       startIdx: 0,        // global message index (0-based over interleaved timeline)
//       endIdx: 7,
//       label: "Hover zone",   // auto-generated label from top topics
//       topics: ["hover", "zone", "CSS fix"],
//       entities: [
//         { type: 'code', icon: 'CODE', label: 'javascript code', element: <el>, msgIndex: 3 }
//       ],
//       messages: [
//         { element: <el>, text: "...", type: 'user'|'ai', globalIdx: 0 }
//       ]
//     }
//   ],
//   topics: ["hover zone", "bookmarks", "SSE tokens"],
//   keyPoints: [
//     { text: "...", type: "decision"|"finding"|"action", source: "user"|"ai", position: N }
//   ],
//   stats: {
//     totalMessages: N,
//     userMessages: N,
//     aiMessages: N,
//     userChars: N,
//     aiChars: N,
//     avgUserLen: N,
//     avgAiLen: N
//   },
//   inventory: {
//     codeBlocks: [ { label: "...", element: <el>, msgIndex: N } ],
//     files: [ { label: "...", element: <el>|null, msgIndex: N } ]
//   }
// }
*/


// ============================================================
// SECTION 1 — CSS ADDITIONS
// ============================================================
//
// Integration note: append the following CSS to the orbInjectCSS() styleEl.textContent
// array, OR leave as-is — this module self-injects its own <style> tag on first call
// to orbBuildPanelSummary() under id "acn-summary-style".
//
// Either approach works. Self-injection is the default here so this module requires
// zero changes to the main file's CSS block.

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


// ============================================================
// SECTION 2 — STOP WORDS & SIGNAL PATTERNS
// ============================================================

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
    // Decisions
    { re: /\b(decided?|choosing|chosen|going with|we('ll| will) use|settled on|picked)\b/i,    type: 'decision' },
    { re: /\b(the (answer|solution|fix|approach) is|it('s| is) (because|due to))\b/i,          type: 'decision' },
    { re: /\b(conclusion:|in conclusion|to summarize|in summary|the key (point|takeaway))\b/i, type: 'decision' },
    { re: /\bshould (use|avoid|not|be|always|never)\b/i,                                        type: 'decision' },

    // Actions / TODOs
    { re: /\b(you('ll| will| should| need to)|next step|action item|todo|to.do|make sure|ensure)\b/i, type: 'action' },
    { re: /\b(don't forget|remember to|be sure to|need to|have to|must)\b/i,                         type: 'action' },
    { re: /\b(let me|i('ll| will)|going to|i'm going to|plan to)\b/i,                               type: 'action' },
    { re: /\b(try|attempt|run|execute|install|update|add|remove|delete|replace|create|build)\b/i,    type: 'action' },

    // Findings / discoveries
    { re: /\b(found|discovered|noticed|realized|turns out|it turns out|appears that|seems like)\b/i, type: 'finding' },
    { re: /\b(the (bug|issue|problem|error|cause) (is|was)|root cause|actually)\b/i,                type: 'finding' },
    { re: /\b(important(ly)?|note that|keep in mind|worth noting|caveat|warning|caution)\b/i,       type: 'finding' },
    { re: /\b(because|reason|why|explanation|this (means|is why|causes))\b/i,                      type: 'finding' }
];

// Domain-hint words used to label segments
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

// File extension patterns for inventory
var FILE_EXTENSION_RE = /\b[\w\-]+\.(js|ts|jsx|tsx|css|html|py|rb|go|rs|java|c|cpp|h|json|yaml|yml|md|sh|bash|env|txt|csv|sql|graphql|vue|svelte)\b/gi;

// Code language hints inside fenced blocks
var CODE_LANG_RE = /^```(\w+)/m;


// ============================================================
// SECTION 3 — TEXT ANALYSIS UTILITIES
// ============================================================

function _sumTokenize(text) {
    return text
        .toLowerCase()
        .replace(/```[\s\S]*?```/g, ' ')   // strip code fences
        .replace(/`[^`]+`/g, ' ')           // strip inline code
        .replace(/https?:\/\/\S+/g, ' ')    // strip URLs
        .replace(/[^a-z0-9\s]/g, ' ')       // strip punctuation
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

// TF-IDF-style topic extraction from a single text string
function _sumExtractTopicsFromText(text, maxTopics) {
    maxTopics = maxTopics || 8;
    var words   = _sumTokenize(text);
    var bigrams = _sumExtractBigrams(words);
    var freq    = {};

    // Unigrams
    words.forEach(function (w) {
        if (w.length < 3) return;
        freq[w] = (freq[w] || 0) + 1;
    });
    // Bigrams — weighted 2x to prefer phrases
    bigrams.forEach(function (b) {
        freq[b] = (freq[b] || 0) + 2;
    });

    // Sort by frequency, pick top N unique (de-overlap: skip unigrams already covered by top bigrams)
    var sorted = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; });
    var chosen = [];
    var coveredWords = {};

    for (var i = 0; i < sorted.length && chosen.length < maxTopics; i++) {
        var term = sorted[i];
        // Skip short low-freq terms
        if (freq[term] < 1) continue;
        // If a bigram covers both its words, skip bare unigrams for those words
        if (term.indexOf(' ') === -1 && coveredWords[term]) continue;
        chosen.push(term);
        if (term.indexOf(' ') !== -1) {
            term.split(' ').forEach(function (w) { coveredWords[w] = true; });
        }
    }
    return chosen;
}

// Combined topic extraction across all questions (weight 1.5x) and AI responses (1.0x)
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

    questions.forEach(function (q)    { addTerms(q.text || '', 1.5); });
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

// Fuzzy word-overlap ratio between two text strings (0.0 – 1.0)
function _sumWordOverlap(textA, textB) {
    var wordsA = new Set(_sumTokenize(textA));
    var wordsB = new Set(_sumTokenize(textB));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    var intersection = 0;
    wordsA.forEach(function (w) { if (wordsB.has(w)) intersection++; });
    return intersection / Math.max(wordsA.size, wordsB.size);
}

// Topic-set overlap ratio (Jaccard) between two topic arrays
function _sumTopicOverlap(topicsA, topicsB) {
    if (!topicsA.length || !topicsB.length) return 0;
    var setA = new Set(topicsA);
    var setB = new Set(topicsB);
    var intersection = 0;
    setA.forEach(function (t) { if (setB.has(t)) intersection++; });
    var union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

// Merge two topic arrays, deduplicate, keep top 6
function _sumMergeTopics(topicsA, topicsB) {
    var seen = {};
    var merged = [];
    topicsA.concat(topicsB).forEach(function (t) {
        if (!seen[t]) { seen[t] = true; merged.push(t); }
    });
    return merged.slice(0, 6);
}

// Remove near-duplicate key points (word overlap > 0.6)
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


// ============================================================
// SECTION 4 — KEY POINT EXTRACTION
// ============================================================

function _sumExtractKeyPoints(questions, aiResponses) {
    var points = [];

    function checkMessage(msg, source, position) {
        var text = msg.text || '';
        // Split into sentences roughly
        var sentences = text.split(/(?<=[.!?])\s+|(?<=\n)\s*/).filter(function (s) {
            return s.trim().length > 20;
        });
        sentences.forEach(function (sentence) {
            var trimmed = sentence.trim();
            for (var p = 0; p < KEY_POINT_PATTERNS.length; p++) {
                if (KEY_POINT_PATTERNS[p].re.test(trimmed)) {
                    // Cap sentence display length
                    var display = trimmed.length > 140 ? trimmed.substring(0, 137) + '...' : trimmed;
                    points.push({ text: display, type: KEY_POINT_PATTERNS[p].type, source: source, position: position });
                    break; // one type per sentence
                }
            }
        });
    }

    questions.forEach(function (q, i)    { checkMessage(q, 'user', i); });
    aiResponses.forEach(function (r, i)  { checkMessage(r, 'ai',   i); });

    // Deduplicate, then cap at 20 most varied points
    return _sumDeduplicatePoints(points).slice(0, 20);
}


// ============================================================
// SECTION 5 — STATS
// ============================================================

function _sumGenerateStats(questions, aiResponses) {
    var userChars = questions.reduce(function (s, q)   { return s + (q.text || '').length; }, 0);
    var aiChars   = aiResponses.reduce(function (s, r) { return s + (r.text || '').length; }, 0);
    return {
        totalMessages: questions.length + aiResponses.length,
        userMessages:  questions.length,
        aiMessages:    aiResponses.length,
        userChars:     userChars,
        aiChars:       aiChars,
        avgUserLen:    questions.length    ? Math.round(userChars / questions.length)   : 0,
        avgAiLen:      aiResponses.length  ? Math.round(aiChars  / aiResponses.length) : 0
    };
}


// ============================================================
// SECTION 6 — CODE & FILE INVENTORY
// ============================================================

function _sumInventoryCodeAndFiles(aiResponses) {
    var codeBlocks = [];
    var files      = [];
    var seenFiles  = {};

    aiResponses.forEach(function (r, msgIndex) {
        var el = r.element;
        if (!el) return;

        // Code blocks — scan <pre> and <pre><code> elements
        try {
            var pres = el.querySelectorAll('pre');
            pres.forEach(function (pre, blockIdx) {
                var codeEl  = pre.querySelector('code') || pre;
                var rawText = (codeEl.textContent || '').trim();
                if (!rawText) return;

                // Try to detect language from class or leading fence hint
                var lang = '';
                var cls  = codeEl.className || pre.className || '';
                var langMatch = cls.match(/language-(\w+)/);
                if (langMatch) lang = langMatch[1];

                // Fall back: guess from content
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
        } catch (e) { /* detached node guard */ }

        // File references — download links
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

        // File references — plain text mentions of filenames
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


// ============================================================
// SECTION 7 — CONVERSATION MAP (TIMELINE + SEGMENTATION)
// ============================================================

// Interleave user questions and AI responses sorted by DOM position
function _sumBuildTimeline(questions, aiResponses) {
    var all = [];

    questions.forEach(function (q, i) {
        all.push({ element: q.element, text: q.text || '', type: 'user', srcIndex: i });
    });
    aiResponses.forEach(function (r, i) {
        all.push({ element: r.element, text: r.text || '', type: 'ai',   srcIndex: i });
    });

    // Sort by DOM order; fall back to source index ordering if elements are detached
    all.sort(function (a, b) {
        if (!a.element || !b.element) return 0;
        try {
            var pos = a.element.compareDocumentPosition(b.element);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        } catch (e) {}
        return 0;
    });

    // Assign global indices
    all.forEach(function (m, i) { m.globalIdx = i; });
    return all;
}

// Scan entities (code, images, files) within a set of message elements
function _sumScanEntities(messages) {
    var entities = [];
    messages.forEach(function (msg) {
        var el = msg.element;
        if (!el) return;
        var idx = msg.globalIdx;

        // Code blocks
        try {
            el.querySelectorAll('pre').forEach(function (pre) {
                var codeEl = pre.querySelector('code') || pre;
                var cls    = codeEl.className || '';
                var langM  = cls.match(/language-(\w+)/);
                var lang   = langM ? langM[1] : 'code';
                entities.push({ type: 'code', icon: 'CODE', label: lang + ' code', element: pre, msgIndex: idx });
            });
        } catch (e) {}

        // Images
        try {
            el.querySelectorAll('img[src]').forEach(function (img) {
                var alt = img.getAttribute('alt') || 'image';
                entities.push({ type: 'image', icon: 'IMG', label: alt, element: img, msgIndex: idx });
            });
        } catch (e) {}

        // Linked files
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

// Determine a representative icon string for a segment's topic set
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

// Generate a human-readable label from the top 1-2 topics
function _sumGenerateSegmentLabel(segment) {
    var topics = segment.topics || [];
    if (!topics.length) return 'Discussion';
    // Capitalize each word
    function cap(str) {
        return str.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    if (topics.length === 1) return cap(topics[0]);
    return cap(topics[0]) + ' / ' + cap(topics[1]);
}

// Window size logic
var _SEGMENT_WINDOW = 4;

function _sumGetWindowSize(totalMessages) {
    if (totalMessages < 4)   return totalMessages || 1;
    if (totalMessages > 100) return 6;
    return _SEGMENT_WINDOW;
}

// Merge segments until at most 12 remain
function _sumMergeExcessSegments(segments) {
    while (segments.length > 12) {
        // Find adjacent pair with HIGHEST topic overlap (most similar = best merge candidates)
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

// Full segmentation algorithm
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


// ============================================================
// SECTION 8 — PUBLIC API: generateFullSummary()
// ============================================================

// NOTE: This function is attached to window so Group E2 (Tools) can call it globally.
// It must NOT be enclosed in any IIFE or private scope that would hide it.

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


// ============================================================
// SECTION 9 — RENDERING
// ============================================================

function _sumMakeCollapsibleSection(titleText, bodyEl) {
    var arrow   = createElement('span', { className: 'acn-section-arrow', textContent: '\u25BE' }); // ▾
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
        // Brief highlight flash
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

        // Topic mini-pills inside segment
        if (seg.topics.length) {
            var pillWrap = createElement('div', { className: 'acn-topic-pills', style: 'margin-top:4px;margin-bottom:2px' });
            seg.topics.slice(0, 3).forEach(function (t) {
                pillWrap.appendChild(createElement('span', { className: 'acn-topic-pill', textContent: t }));
            });
            segEl.appendChild(pillWrap);
        }

        // Entity list inside segment
        seg.entities.slice(0, 4).forEach(function (ent) {
            var entEl = createElement('div', { className: 'acn-map-entity', textContent: ent.icon + ' ' + ent.label });
            entEl.addEventListener('click', function (e) {
                e.stopPropagation();
                _sumScrollToElement(ent.element);
            });
            segEl.appendChild(entEl);
        });

        // Click segment header to scroll to first message of segment
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
    // Clear previous results
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


// ============================================================
// SECTION 10 — PANEL ENTRY POINT: orbBuildPanelSummary()
// ============================================================

// --- REPLACE: orbBuildPanelSummary ---
function orbBuildPanelSummary() {
    _acnInjectSummaryCSS();

    var panel = createElement('div', { id: 'acn-panel-summary', className: 'acn-panel' });
    panel.appendChild(orbBuildPanelHeader('\u03A3 ' + (i18n('summary') || 'Summary')));

    var scroll = createElement('div', { style: 'flex:1;overflow-y:auto;padding:4px 10px 10px' });

    // ── Generate button + disclaimer ──────────────────────────
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

    // ── Results container (populated on generate) ─────────────
    var resultsContainer = createElement('div', { className: 'acn-sum-results' });
    scroll.appendChild(resultsContainer);

    // ── Button handler ────────────────────────────────────────
    var hasGenerated = false;
    genBtn.addEventListener('click', function () {
        genBtn.disabled     = true;
        genBtn.textContent  = i18n('analyzing') || 'Analyzing...';

        // Yield to the browser to update the button state, then run analysis
        setTimeout(function () {
            var data;
            try {
                data = generateFullSummary();
            } catch (e) {
                console.error('ACN Summary: generateFullSummary() threw:', e);
                data = null;
            }

            renderSummaryResults(resultsContainer, data);

            genBtn.disabled    = false;
            hasGenerated       = true;
            genBtn.textContent = i18n('regenerateSummary') || 'Regenerate Summary';

            // Notify user only on first generation
            if (!hasGenerated) {
                try { showToast('Summary generated'); } catch (e) {}
            }
        }, 40);
    });

    panel.appendChild(scroll);
    return panel;
}
