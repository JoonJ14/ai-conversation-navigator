// ============================================================
// MODULE: Group B — Context Tracking + Plan Usage
// VERSION: v10.3
// DEPENDS ON: Phase 0 (showToast, platform, CTX_LIMITS, createElement)
// REPLACES: orbUpdateContextBar() (completely rewritten — see REPLACE marker)
// INSERTS: setupClaudeSSEInterceptor(), readSSEStream(), parseSSEEvent()
//          _sseTokenData, _turnCounter, _compactionHistory state vars
//          fetchClaudeUsage(), parseUsageFromHTML(), renderUsageBars()
//          maybeRefreshUsage(), formatResetTime(), getBarColor()
// HEADER: Integration agent must add @grant GM_xmlhttpRequest to userscript header
//         if not already present. Place it after the last @grant line.
// CSS: Integration agent must inject .acn-usage-* styles (see CSS BLOCK below).
//      Append them to the existing GM_addStyle / style-injection call.
// ============================================================
//
// INTEGRATION CHECKLIST (for the integration agent):
// ─────────────────────────────────────────────────
// 1. @grant GM_xmlhttpRequest   → add to userscript header (@grant block, line ~22-24)
// 2. State variables            → paste the STATE VARIABLES block near line 1088,
//                                 alongside _questions, _navListFingerprint, etc.
// 3. setupClaudeSSEInterceptor  → call right after platform detection resolves,
//                                 guarded by: if (platform.id === 'claude') setupClaudeSSEInterceptor();
//                                 Suggested location: after line 887 (useOrbital assignment)
// 4. orbUpdateContextBar        → REPLACE existing function (lines 1860-1913) with
//                                 the new version at the REPLACE marker below.
// 5. maybeRefreshUsage          → call inside parseSSEEvent(), after processing
//                                 message_delta events, debounced 3 s.
// 6. renderUsageBars            → call inside orbBuildPanelNav() after the ctx block
//                                 (after line 2062). Example:
//                                     if (platform.id === 'claude') {
//                                         var usageSection = createElement('div', {
//                                             id: 'acn-usage-section',
//                                             className: 'acn-usage-section'
//                                         });
//                                         ctx.appendChild(usageSection);
//                                     }
//                                 Then in orbPopulateNavigate() after orbUpdateContextBar():
//                                     if (platform.id === 'claude') maybeRefreshUsage();
// 7. CSS block                  → append to the existing CSS injection (acn-usage-* rules)
// ============================================================


// ============================================================
// CSS BLOCK — append to existing style injection
// ============================================================
/*
'.acn-usage-bar{margin-bottom:4px}',
'.acn-usage-label{font-size:10px;color:#aaa;display:flex;justify-content:space-between}',
'.acn-usage-track{height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}',
'.acn-usage-fill{height:100%;border-radius:2px;transition:width .3s ease}',
'.acn-usage-separator{height:1px;background:rgba(255,255,255,.1);margin:6px 0}',
'.acn-usage-section{margin-top:4px;padding:0 14px 10px}',
'.acn-usage-title{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.5px;' +
    'font-weight:500;margin-bottom:6px}',
'.acn-ctx-compact{font-size:10px;color:#a478f0;margin-top:3px}',
'.acn-ctx-warn{font-size:10px;color:#f87171;margin-top:3px}',
'.acn-ctx-dots{display:flex;gap:3px;margin-top:5px;flex-wrap:wrap}',
'.acn-ctx-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
*/


// ============================================================
// STATE VARIABLES
// INSERT near line 1088, alongside _questions, _navListFingerprint
// ============================================================

    // ── Tier 1: Claude SSE exact token state ──────────────────
    var _sseTokenData = {
        inputTokens:  0,
        outputTokens: 0,
        lastUpdated:  0,
        exact:        false   // true once we have at least one message_start reading
    };
    var _prevInputTokens  = 0;  // input tokens from previous message_start (compaction detect)
    var _compactionCount  = 0;  // total number of compactions observed this session
    var _compactionHistory = []; // turn numbers at which compaction was detected

    // ── Tier 2: Non-Claude turn counter state ─────────────────
    var _turnCounter = {
        totalTurns:          0,
        turnsSinceCompact:   0,
        compactionCount:     0,
        cycleLengths:        [],   // lengths of completed cycles between compactions
        predictedCycleLength: null,
        lastCompactTurn:     0
    };

    // ── Plan usage (Claude only) ───────────────────────────────
    var USAGE_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
    var _usageData     = null;
    var _usageLastFetch = 0;
    var _usageRefreshTimer = null; // debounce timer for maybeRefreshUsage


// ============================================================
// SSE INTERCEPTOR — Tier 1 (Claude only)
// INSERT: call setupClaudeSSEInterceptor() after platform detection,
//         guarded by: if (platform.id === 'claude') setupClaudeSSEInterceptor();
// ============================================================

    /**
     * Monkey-patches window.fetch so that every response going to
     * api.claude.ai is tapped for SSE token data.  All other fetch
     * calls are unaffected.  The original fetch is called normally;
     * we only tee off a side-reader on the response body stream.
     */
    function setupClaudeSSEInterceptor() {
        if (typeof window.fetch !== 'function') return;
        if (window._acnFetchPatched) return; // idempotent
        window._acnFetchPatched = true;

        var _nativeFetch = window.fetch;

        window.fetch = function acnFetchProxy(input, init) {
            var url = (typeof input === 'string') ? input :
                      (input && input.url) ? input.url : '';

            // Only intercept streaming requests to Claude's backend
            var isClaude = url.indexOf('claude.ai') !== -1 ||
                           url.indexOf('/api/organizations') !== -1 ||
                           url.indexOf('/api/append_message') !== -1 ||
                           url.indexOf('/completion') !== -1;

            var result = _nativeFetch.apply(this, arguments);

            if (!isClaude) return result;

            return result.then(function (response) {
                // Only attempt to tap text/event-stream responses
                var ct = response.headers && response.headers.get('content-type');
                if (!ct || ct.indexOf('text/event-stream') === -1) return response;

                // We must clone: the original stream can only be consumed once
                var cloned = response.clone();
                readSSEStream(cloned.body);
                return response;
            });
        };
    }

    /**
     * Consumes a ReadableStream of SSE bytes from a cloned Claude response.
     * Decodes chunks and forwards complete events to parseSSEEvent().
     * Errors are swallowed so they never affect the actual page response.
     *
     * @param {ReadableStream} body
     */
    function readSSEStream(body) {
        if (!body || typeof body.getReader !== 'function') return;

        var reader  = body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer  = '';

        function pump() {
            reader.read().then(function (result) {
                if (result.done) return;

                buffer += decoder.decode(result.value, { stream: true });

                // Split on double-newline (SSE event boundary)
                var parts = buffer.split(/\n\n/);
                buffer = parts.pop(); // last part may be incomplete

                for (var i = 0; i < parts.length; i++) {
                    if (parts[i].trim()) {
                        parseSSEEvent(parts[i]);
                    }
                }

                pump(); // recurse
            }).catch(function () {
                // Stream was aborted (user navigated, cancelled request, etc.)
                // Silently ignore — this is expected.
            });
        }

        pump();
    }

    /**
     * Parses a single SSE event string.  Looks for:
     *   - message_start  → captures exact input_tokens (+ output_tokens)
     *   - message_delta  → accumulates output_tokens, triggers usage refresh debounce
     *
     * Compaction detection: if the new input_tokens are significantly *lower* than
     * the previous message_start value, a compaction event occurred.
     *
     * @param {string} eventStr  Raw SSE event text (may contain "event:" and "data:" lines)
     */
    function parseSSEEvent(eventStr) {
        var lines = eventStr.split('\n');
        var eventType = '';
        var dataStr   = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('event:') === 0) {
                eventType = line.slice(6).trim();
            } else if (line.indexOf('data:') === 0) {
                dataStr = line.slice(5).trim();
            }
        }

        if (!dataStr || dataStr === '[DONE]') return;

        var payload;
        try {
            payload = JSON.parse(dataStr);
        } catch (e) {
            return;
        }

        if (eventType === 'message_start' && payload.message && payload.message.usage) {
            var usage       = payload.message.usage;
            var newInput    = usage.input_tokens  || 0;
            var newOutput   = usage.output_tokens || 0;

            // ── Compaction detection ──────────────────────────────────
            // A significant drop in input_tokens means the conversation was
            // compacted (Claude silently summarised older messages).
            // Threshold: new input is < 60% of previous and previous was non-trivial.
            if (_sseTokenData.exact &&
                _prevInputTokens > 2000 &&
                newInput < _prevInputTokens * 0.60) {
                _compactionCount++;
                _compactionHistory.push(_turnCounter.totalTurns);

                // Update non-Claude turn counter structure too (shared compaction count)
                _turnCounter.compactionCount = _compactionCount;

                // Record cycle length for weighted prediction
                var cycleLen = _turnCounter.turnsSinceCompact;
                if (cycleLen > 0) {
                    _turnCounter.cycleLengths.push(cycleLen);
                    _turnCounter.predictedCycleLength = predictNextCycleLength();
                }
                _turnCounter.turnsSinceCompact = 0;
                _turnCounter.lastCompactTurn   = _turnCounter.totalTurns;
            }

            _prevInputTokens        = newInput;
            _sseTokenData.inputTokens  = newInput;
            _sseTokenData.outputTokens = newOutput;
            _sseTokenData.lastUpdated  = Date.now();
            _sseTokenData.exact        = true;

            orbUpdateContextBar();

        } else if (eventType === 'message_delta' && payload.usage) {
            _sseTokenData.outputTokens = payload.usage.output_tokens || _sseTokenData.outputTokens;
            _sseTokenData.lastUpdated  = Date.now();

            // Debounced plan usage refresh (3 s after last SSE activity)
            if (_usageRefreshTimer) clearTimeout(_usageRefreshTimer);
            _usageRefreshTimer = setTimeout(maybeRefreshUsage, 3000);

            orbUpdateContextBar();
        }
    }


// ============================================================
// TURN COUNTER HELPERS (Tier 2 — non-Claude platforms)
// ============================================================

    /**
     * Called by the integration agent from orbOnScanComplete()
     * when the platform is NOT Claude.  Increments turn counters
     * whenever _questions.length grows.
     *
     * INSERT: add a call to this function inside orbOnScanComplete(),
     * guarded by: if (platform.id !== 'claude') updateTurnCounter();
     */
    function updateTurnCounter() {
        var newTotal = _questions.length;
        if (newTotal <= _turnCounter.totalTurns) return; // no new turns

        var added = newTotal - _turnCounter.totalTurns;
        _turnCounter.totalTurns        += added;
        _turnCounter.turnsSinceCompact += added;
    }

    /**
     * Weighted rolling average of past cycle lengths.
     * Most recent cycle gets 50%, second-most-recent gets 30%,
     * all earlier cycles share the remaining 20%.
     *
     * @returns {number|null}
     */
    function predictNextCycleLength() {
        var cycles = _turnCounter.cycleLengths;
        var n = cycles.length;
        if (n === 0) return null;
        if (n === 1) return cycles[0];

        var totalWeight  = 0;
        var weightedSum  = 0;
        for (var i = 0; i < n; i++) {
            var weight;
            if (i === n - 1)      weight = 0.5;
            else if (i === n - 2) weight = 0.3;
            else                  weight = 0.2 / Math.max(n - 2, 1);
            totalWeight += weight;
            weightedSum += cycles[i] * weight;
        }
        return Math.round(weightedSum / totalWeight);
    }


// ============================================================
// CONTEXT BAR — REPLACE orbUpdateContextBar() ENTIRELY
// Original location: ~lines 1860-1913
// ============================================================

    /**
     * REPLACE the existing orbUpdateContextBar() with this function.
     *
     * Rendering logic:
     *   • Claude + exact SSE data  → token count bar ("24,012 / 200K")
     *   • All other cases           → turn-dot bar
     * Both paths show compaction count and degradation warning.
     */
    function orbUpdateContextBar() {
        var pct  = document.getElementById('acn-ctx-pct');
        var fill = document.getElementById('acn-ctx-fill');
        var meta = document.getElementById('acn-ctx-meta');
        if (!pct || !fill) return;

        var limit = (typeof CTX_LIMITS !== 'undefined' && platform && CTX_LIMITS[platform.id])
                    ? CTX_LIMITS[platform.id]
                    : 128000;

        // ── Path A: Claude with exact SSE token data ──────────
        if (platform && platform.id === 'claude' && _sseTokenData.exact) {
            var inputTok = _sseTokenData.inputTokens;
            var pctNum   = Math.min(100, Math.round((inputTok / limit) * 100));
            var color    = getBarColor(pctNum);

            // Format: "24,012 / 200K"
            var tokFmt   = inputTok.toLocaleString();
            var limFmt   = Math.round(limit / 1000) + 'K';
            pct.textContent  = pctNum + '%';
            pct.style.color  = color;
            fill.style.width      = pctNum + '%';
            fill.style.background = color;

            if (meta) {
                meta.textContent = tokFmt + ' / ' + limFmt + ' tokens (exact)';
                meta.style.color = '#888';
            }

            // Compaction badge
            _renderCompactionInfo(pctNum);
            return;
        }

        // ── Path B: Claude but no SSE data yet ────────────────
        if (platform && platform.id === 'claude') {
            _renderEstimatedBar(pct, fill, meta, limit);
            _renderCompactionInfo(0);
            return;
        }

        // ── Path C: Non-Claude — turn counter ─────────────────
        if (_questions.length === 0) {
            pct.textContent  = '—';
            pct.style.color  = '';
            fill.style.width = '0%';
            if (meta) { meta.textContent = 'No messages detected'; meta.style.color = ''; }
            _removeTurnDots();
            return;
        }

        // For non-Claude, fall back to char-based estimate for the bar itself,
        // and layer the turn-dot visualization below.
        _renderEstimatedBar(pct, fill, meta, limit);
        _renderTurnDots();
        _renderTurnCompactionInfo();
    }

    /**
     * Char-based estimated bar (shared by non-Claude and Claude-pre-SSE).
     * @private
     */
    function _renderEstimatedBar(pct, fill, meta, limit) {
        var totalChars = 0;
        var anchor = _questions.length > 0 ? _questions[0].element : null;
        var node   = anchor ? anchor.parentElement : null;
        var found  = false;

        while (node && node !== document.body) {
            var st = window.getComputedStyle(node);
            if (st.overflowY === 'auto' || st.overflowY === 'scroll' ||
                st.overflow  === 'auto' || st.overflow  === 'scroll') {
                totalChars = (node.innerText || '').length;
                found = true;
                break;
            }
            node = node.parentElement;
        }

        if (!found || totalChars === 0) {
            totalChars = _questions.reduce(function (s, q) { return s + q.text.length; }, 0) * 3;
        }

        var estTokens = Math.round(totalChars / 4);
        var pctNum    = Math.min(100, Math.round((estTokens / limit) * 100));
        var color     = getBarColor(pctNum);

        pct.textContent  = pctNum + '%';
        pct.style.color  = color;
        fill.style.width      = pctNum + '%';
        fill.style.background = color;

        if (meta) {
            var kEst   = (estTokens / 1000).toFixed(1);
            var kLimit = Math.round(limit / 1000);
            meta.textContent = '~' + kEst + 'K / ' + kLimit + 'K tokens (est.)';
            meta.style.color = '#666';
        }
    }

    /**
     * Renders / updates the compaction count badge and degradation warning
     * below the context bar (Claude SSE path).
     * @private
     */
    function _renderCompactionInfo(pctNum) {
        var ctx = document.getElementById('acn-ctx-pct');
        if (!ctx) return;
        var container = ctx.closest ? ctx.closest('.acn-ctx') : null;
        if (!container) return;

        // Compaction badge
        var badge = document.getElementById('acn-ctx-compact');
        if (_compactionCount > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id        = 'acn-ctx-compact';
                badge.className = 'acn-ctx-compact';
                container.appendChild(badge);
            }
            badge.textContent = '\u26a1 ' + _compactionCount +
                ' compaction' + (_compactionCount !== 1 ? 's' : '') + ' detected';
        } else if (badge) {
            badge.remove();
        }

        // Degradation warning at ≥ 85%
        var warn = document.getElementById('acn-ctx-warn');
        if (pctNum >= 85) {
            if (!warn) {
                warn = document.createElement('div');
                warn.id        = 'acn-ctx-warn';
                warn.className = 'acn-ctx-warn';
                container.appendChild(warn);
            }
            warn.textContent = '\u26a0 Context nearly full — quality may degrade';
        } else if (warn) {
            warn.remove();
        }
    }

    /**
     * Renders coloured dots representing turns since last compaction
     * for non-Claude platforms.
     * @private
     */
    function _renderTurnDots() {
        var ctx = document.getElementById('acn-ctx-pct');
        if (!ctx) return;
        var container = ctx.closest ? ctx.closest('.acn-ctx') : null;
        if (!container) return;

        var dotsEl = document.getElementById('acn-ctx-dots');
        if (!dotsEl) {
            dotsEl = document.createElement('div');
            dotsEl.id        = 'acn-ctx-dots';
            dotsEl.className = 'acn-ctx-dots';
            container.appendChild(dotsEl);
        }

        while (dotsEl.firstChild) dotsEl.removeChild(dotsEl.firstChild);

        var predicted = _turnCounter.predictedCycleLength;
        var since     = _turnCounter.turnsSinceCompact;
        var total     = predicted || 40; // fallback if no prediction yet

        // Show up to 40 dots (one per turn since last compaction)
        var dotsToShow = Math.min(since, 40);
        for (var i = 0; i < dotsToShow; i++) {
            var dot = document.createElement('div');
            dot.className = 'acn-ctx-dot';

            var pct = predicted ? (i / predicted) : (i / total);
            if (pct < 0.70)      dot.style.background = '#22c55e';
            else if (pct < 0.85) dot.style.background = '#eab308';
            else                 dot.style.background = '#ef4444';

            // Compaction markers shown in purple
            if (_compactionHistory.indexOf(_turnCounter.lastCompactTurn - since + i) !== -1) {
                dot.style.background = '#a478f0';
            }

            dotsEl.appendChild(dot);
        }
    }

    function _removeTurnDots() {
        var el = document.getElementById('acn-ctx-dots');
        if (el) el.remove();
    }

    /**
     * Renders turn-based compaction info for non-Claude platforms.
     * @private
     */
    function _renderTurnCompactionInfo() {
        var ctx = document.getElementById('acn-ctx-pct');
        if (!ctx) return;
        var container = ctx.closest ? ctx.closest('.acn-ctx') : null;
        if (!container) return;

        var badge = document.getElementById('acn-ctx-compact');
        if (_turnCounter.compactionCount > 0 || _turnCounter.totalTurns > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id        = 'acn-ctx-compact';
                badge.className = 'acn-ctx-compact';
                container.appendChild(badge);
            }
            var since     = _turnCounter.turnsSinceCompact;
            var predicted = _turnCounter.predictedCycleLength;
            var txt = 'Turn ' + _turnCounter.totalTurns;
            if (_turnCounter.compactionCount > 0) {
                txt += ' \u2022 ' + _turnCounter.compactionCount + ' compaction' +
                       (_turnCounter.compactionCount !== 1 ? 's' : '');
            }
            if (predicted && since > 0) {
                var remaining = Math.max(0, predicted - since);
                txt += ' \u2022 ~' + remaining + ' turns to next';
            }
            badge.textContent = txt;
        } else if (badge) {
            badge.remove();
        }

        // Degradation warning: ≥85% of predicted cycle
        var warn = document.getElementById('acn-ctx-warn');
        var predicted2 = _turnCounter.predictedCycleLength;
        var showWarn   = predicted2 && (_turnCounter.turnsSinceCompact / predicted2) >= 0.85;
        if (showWarn) {
            if (!warn) {
                warn = document.createElement('div');
                warn.id        = 'acn-ctx-warn';
                warn.className = 'acn-ctx-warn';
                container.appendChild(warn);
            }
            warn.textContent = '\u26a0 Approaching compaction — context may degrade';
        } else if (warn) {
            warn.remove();
        }
    }


// ============================================================
// PLAN USAGE (Claude only)
// Integration: call maybeRefreshUsage() from orbPopulateNavigate()
//              when platform.id === 'claude', after orbUpdateContextBar().
// ============================================================

    /**
     * Colour for a bar fill given a percentage value.
     * Green < 70%, Yellow 70-84%, Red ≥ 85%.
     *
     * @param {number} pct  0-100
     * @returns {string} CSS colour string
     */
    function getBarColor(pct) {
        if (pct < 70)  return '#22c55e';
        if (pct < 85)  return '#eab308';
        return '#ef4444';
    }

    /**
     * Fetches claude.ai/settings/usage via GM_xmlhttpRequest (bypasses CORS).
     * Claude returns an RSC (React Server Component) payload.  We look for the
     * JSON object that contains five_hour_usage, seven_day_usage, etc.
     *
     * @param {function(object|null)} callback  Called with parsed data or null on error
     */
    function fetchClaudeUsage(callback) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            callback(null);
            return;
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://claude.ai/settings/usage',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cache-Control': 'no-cache'
            },
            onload: function (response) {
                var parsed = parseUsageFromHTML(response.responseText || '');
                callback(parsed);
            },
            onerror: function () {
                callback(null);
            }
        });
    }

    /**
     * Extracts plan usage numbers from the RSC HTML payload returned by
     * claude.ai/settings/usage.
     *
     * Claude embeds usage data as JSON inside a <script> tag or inline RSC
     * stream.  We look for an object containing "five_hour_usage" which is
     * reliably present regardless of RSC version.
     *
     * Returns an object with the keys:
     *   fiveHour:  { used, limit, resetsAt }
     *   sevenDay:  { used, limit, resetsAt }
     *   sevenDaySonnet: { used, limit, resetsAt }
     *
     * @param {string} html
     * @returns {object|null}
     */
    function parseUsageFromHTML(html) {
        if (!html) return null;

        // Strategy 1: find a JSON object containing the known keys
        var keywordRx = /five_hour_usage|fiveHour|"messages_used"/;
        if (!keywordRx.test(html)) return null;

        // Walk through script-tag contents and look for JSON blobs
        var scriptRx = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        var m;
        while ((m = scriptRx.exec(html)) !== null) {
            var content = m[1];
            if (!keywordRx.test(content)) continue;

            // Find the outermost JSON object containing the keyword
            var obj = _extractFirstJSON(content);
            if (obj) {
                var result = _normaliseUsageObject(obj);
                if (result) return result;
            }
        }

        // Strategy 2: scan raw text for JSON blobs (RSC inline streaming)
        var jsonBlobRx = /\{[^{}]{10,}\}/g;
        var blob;
        while ((blob = jsonBlobRx.exec(html)) !== null) {
            if (!keywordRx.test(blob[0])) continue;
            try {
                var parsed = JSON.parse(blob[0]);
                var result2 = _normaliseUsageObject(parsed);
                if (result2) return result2;
            } catch (e) { /* skip */ }
        }

        return null;
    }

    /**
     * Attempts to JSON.parse a string, returning the object on success.
     * Walks the string to find balanced { } blocks.
     * @private
     */
    function _extractFirstJSON(str) {
        var depth  = 0;
        var start  = -1;
        for (var i = 0; i < str.length; i++) {
            if (str[i] === '{') {
                if (depth === 0) start = i;
                depth++;
            } else if (str[i] === '}') {
                depth--;
                if (depth === 0 && start !== -1) {
                    try {
                        return JSON.parse(str.slice(start, i + 1));
                    } catch (e) {
                        // Reset and continue searching
                        start = -1;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Maps a raw usage object (various Claude API shapes) to our canonical form.
     * Returns null if the object doesn't look like usage data.
     * @private
     */
    function _normaliseUsageObject(obj) {
        if (!obj || typeof obj !== 'object') return null;

        // Shape A: keys like five_hour_usage, seven_day_usage
        if (obj.five_hour_usage !== undefined || obj.fiveHourUsage !== undefined) {
            var fh = obj.five_hour_usage  || obj.fiveHourUsage  || {};
            var sd = obj.seven_day_usage  || obj.sevenDayUsage  || {};
            var ss = obj.seven_day_sonnet_usage || obj.sevenDaySonnetUsage || {};
            return {
                fiveHour: {
                    used:     fh.messages_used   || fh.used  || 0,
                    limit:    fh.messages_limit  || fh.limit || 0,
                    resetsAt: fh.resets_at       || fh.resetsAt || null
                },
                sevenDay: {
                    used:     sd.messages_used   || sd.used  || 0,
                    limit:    sd.messages_limit  || sd.limit || 0,
                    resetsAt: sd.resets_at       || sd.resetsAt || null
                },
                sevenDaySonnet: {
                    used:     ss.messages_used   || ss.used  || 0,
                    limit:    ss.messages_limit  || ss.limit || 0,
                    resetsAt: ss.resets_at       || ss.resetsAt || null
                }
            };
        }

        // Shape B: nested inside a "data" envelope
        if (obj.data && typeof obj.data === 'object') {
            return _normaliseUsageObject(obj.data);
        }

        return null;
    }

    /**
     * Renders three stacked usage bars (Session / Weekly / Sonnet) into
     * the given container element.  Safe to call on re-render — it clears
     * and rebuilds the container contents.
     *
     * @param {HTMLElement} container  Target element (id="acn-usage-section")
     * @param {object}      data       Normalised usage object from parseUsageFromHTML()
     */
    function renderUsageBars(container, data) {
        if (!container) return;
        while (container.firstChild) container.removeChild(container.firstChild);

        if (!data) {
            // Show a subtle placeholder while waiting for first fetch
            var ph = document.createElement('div');
            ph.style.cssText = 'font-size:10px;color:#555;padding:2px 0';
            ph.textContent   = 'Plan usage loading…';
            container.appendChild(ph);
            return;
        }

        // Title row
        var title = document.createElement('div');
        title.className   = 'acn-usage-title';
        title.textContent = 'Plan usage';
        container.appendChild(title);

        var bars = [
            { label: 'Session (5h)',  tier: data.fiveHour },
            { label: 'Weekly',        tier: data.sevenDay },
            { label: 'Sonnet (7d)',   tier: data.sevenDaySonnet }
        ];

        for (var i = 0; i < bars.length; i++) {
            var bar  = bars[i];
            var tier = bar.tier;
            if (!tier || tier.limit === 0) continue;

            var pct   = Math.min(100, Math.round((tier.used / tier.limit) * 100));
            var color = getBarColor(pct);
            var reset = tier.resetsAt ? formatResetTime(tier.resetsAt) : '';

            // Label row: "Session (5h)  47 / 100 · resets in 2h 14m"
            var labelLeft = document.createElement('span');
            labelLeft.textContent = bar.label;

            var labelRight = document.createElement('span');
            labelRight.textContent = tier.used + ' / ' + tier.limit +
                                     (reset ? ' \u00b7 ' + reset : '');

            var labelRow = document.createElement('div');
            labelRow.className = 'acn-usage-label';
            labelRow.appendChild(labelLeft);
            labelRow.appendChild(labelRight);

            // Track + fill
            var fillEl = document.createElement('div');
            fillEl.className        = 'acn-usage-fill';
            fillEl.style.width      = pct + '%';
            fillEl.style.background = color;

            var trackEl = document.createElement('div');
            trackEl.className = 'acn-usage-track';
            trackEl.appendChild(fillEl);

            var barEl = document.createElement('div');
            barEl.className = 'acn-usage-bar';
            barEl.appendChild(labelRow);
            barEl.appendChild(trackEl);

            container.appendChild(barEl);
        }
    }

    /**
     * Checks if enough time has elapsed since the last usage fetch, and if so
     * triggers fetchClaudeUsage().  Safe to call frequently — it self-throttles.
     *
     * Should be called from:
     *   1. orbPopulateNavigate()  (when nav panel opens)
     *   2. Inside parseSSEEvent() after message_delta, debounced 3 s
     */
    function maybeRefreshUsage() {
        if (typeof platform === 'undefined' || platform.id !== 'claude') return;
        var now = Date.now();
        if (now - _usageLastFetch < USAGE_POLL_INTERVAL) {
            // Still fresh — just re-render with cached data
            var section = document.getElementById('acn-usage-section');
            if (section) renderUsageBars(section, _usageData);
            return;
        }

        _usageLastFetch = now;
        fetchClaudeUsage(function (data) {
            _usageData = data;
            var section = document.getElementById('acn-usage-section');
            if (section) renderUsageBars(section, _usageData);
        });
    }

    /**
     * Formats an ISO timestamp into a human-readable reset string.
     *   < 60 min   → "resets in 47 min"
     *   same day   → "resets in 2h 14m"
     *   future day → "resets Thu 12:00 PM"
     *
     * @param {string|number} resetsAt  ISO date string or Unix ms timestamp
     * @returns {string}
     */
    function formatResetTime(resetsAt) {
        var target;
        try {
            target = (typeof resetsAt === 'number') ? new Date(resetsAt) : new Date(resetsAt);
            if (isNaN(target.getTime())) return '';
        } catch (e) { return ''; }

        var now    = Date.now();
        var diffMs = target.getTime() - now;

        if (diffMs <= 0) return 'resetting soon';

        var diffMin  = Math.round(diffMs / 60000);
        var diffHour = diffMin / 60;

        if (diffMin < 60) {
            return 'resets in ' + diffMin + ' min';
        }

        var h = Math.floor(diffHour);
        var m = Math.round(diffMin - h * 60);

        // Same calendar day
        var todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        if (target <= todayEnd) {
            return 'resets in ' + h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
        }

        // Different day — show weekday + time
        var days    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var dayName = days[target.getDay()];
        var hr      = target.getHours();
        var min     = target.getMinutes();
        var ampm    = hr >= 12 ? 'PM' : 'AM';
        var hr12    = hr % 12 || 12;
        var minStr  = min < 10 ? '0' + min : String(min);
        return 'resets ' + dayName + ' ' + hr12 + ':' + minStr + ' ' + ampm;
    }
