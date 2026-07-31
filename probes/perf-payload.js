// Deterministic paragraph-scale conversation generator for the Summary perf probe.
//
// WHY: the committed harness fixture's messages are ~70 chars; the owner's real
// messages are paragraphs (TROUBLESHOOTING OPEN entry, known-unmeasured fact #3).
// A perf measurement on 70-char messages measures the wrong environment.
//
// Shape mirrors tests/test-all-platforms.js buildGmFixtureShim: linear chain,
// one leading interrupted assistant entry (no stop_reason, renders no row),
// human/assistant alternating, content[].text carrying the body. Texts are
// deterministic (seeded LCG) so a run is reproducible; topics rotate in blocks
// so word-overlap segmentation does REAL work (uniform vocabulary would never
// split and the merge loops would never run).

'use strict';

function lcg(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const COMMON = ('system value result process data function module handler request response state ' +
    'update change logic method object array string number index buffer cache queue event ' +
    'listener callback promise thread worker branch merge commit release version test case ' +
    'error warning message log output input option setting config field record entry table ' +
    'row column query filter sort group batch chunk stream parse build render layout style').split(' ');

const TOPICS = [
    'authentication login session token cookie password oauth refresh expiry credential scope identity provider redirect grant'.split(' '),
    'database migration schema index postgres transaction rollback constraint foreign key sequence vacuum replica shard partition'.split(' '),
    'frontend component react props hooks effect memo virtual dom hydration bundle webpack chunk lazy suspense'.split(' '),
    'deployment docker container kubernetes pod service ingress helm registry image rollout replica autoscale probe liveness'.split(' '),
    'performance profiling latency throughput benchmark flamegraph allocation garbage collector heap sampling regression budget percentile jitter'.split(' '),
    'testing playwright fixture assertion mock selector harness coverage mutation flake retry timeout headless engine viewport'.split(' '),
    'networking websocket http header proxy timeout retry backoff dns certificate handshake payload compression keepalive multiplex'.split(' '),
    'analytics dashboard metric aggregation funnel cohort retention churn segment export visualization drilldown anomaly forecast'.split(' '),
];

const KEYPOINT_TEMPLATES = [
    'It turns out the {A} {B} was holding the {C} open longer than the {D} allowed in practice.',
    'The root cause is that the {A} {B} never releases its {C} before the {D} finishes.',
    'You should use a dedicated {A} {B} for every {C} instead of sharing one {D} across them.',
    'We decided to go with the {A} {B} approach because the {C} keeps the {D} simple.',
    'Note that the {A} {B} must be flushed before the {C} reads the {D} again.',
    'Make sure the {A} {B} is committed before any {C} mutation touches the {D}.',
];

const FILES = ['config.js', 'pipeline.py', 'schema.sql', 'report.csv', 'index.html', 'deploy.yaml', 'notes.md'];

function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }

function sentence(rnd, vocab, words, terminal) {
    const parts = [];
    for (let i = 0; i < words; i++) {
        const pool = rnd() < 0.55 ? vocab : COMMON;
        parts.push(pick(rnd, pool));
    }
    let s = parts.join(' ');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s + (terminal || '.');
}

function fillTemplate(rnd, vocab, tpl) {
    return tpl.replace(/\{[A-D]\}/g, () => pick(rnd, rnd() < 0.6 ? vocab : COMMON));
}

// A user question: 2-4 sentences, ends in a question. ~200-450 chars.
function questionText(rnd, vocab, turn) {
    const n = 2 + Math.floor(rnd() * 3);
    const ss = [];
    for (let i = 0; i < n - 1; i++) ss.push(sentence(rnd, vocab, 10 + Math.floor(rnd() * 8)));
    ss.push(sentence(rnd, vocab, 9 + Math.floor(rnd() * 7), '?'));
    return 'Turn ' + turn + ': ' + ss.join(' ');
}

// An assistant answer: 3-5 paragraphs of 3-6 sentences (~1500-4500 chars),
// with occasional key-point sentences, a fenced code block on every 3rd answer,
// and occasional file mentions — so keyPoints, inventory and the fence regex all
// do real work.
// Env knobs for sensitivity runs (defaults reproduce the baseline):
//   PARA_BOOST — multiplies paragraphs per answer (text volume)
//   KP_RATE    — multiplies the key-point-sentence density
const PARA_BOOST = +(process.env.PARA_BOOST || 1);
const KP_RATE = +(process.env.KP_RATE || 1);

function answerText(rnd, vocab, turn) {
    const paras = [];
    const np = Math.max(1, Math.round((3 + Math.floor(rnd() * 3)) * PARA_BOOST));
    for (let p = 0; p < np; p++) {
        const ns = 3 + Math.floor(rnd() * 4);
        const ss = [];
        for (let i = 0; i < ns; i++) {
            if (rnd() < 0.18 * KP_RATE) {
                ss.push(fillTemplate(rnd, vocab, pick(rnd, KEYPOINT_TEMPLATES)));
            } else if (rnd() < 0.08) {
                ss.push('The change belongs in ' + pick(rnd, FILES) + ' next to the existing ' +
                        pick(rnd, vocab) + ' ' + pick(rnd, COMMON) + '.');
            } else {
                ss.push(sentence(rnd, vocab, 12 + Math.floor(rnd() * 12)));
            }
        }
        paras.push(ss.join(' '));
    }
    let text = 'Answer ' + turn + ': ' + paras.join('\n\n');
    if (turn % 3 === 0) {
        text += '\n\n```javascript\nfunction handle_' + turn + '(input) {\n' +
                '    var ' + pick(rnd, vocab).replace(/[^a-z]/g, '') + ' = normalize(input);\n' +
                '    if (!input.valid) { throw new Error("rejected at turn ' + turn + '"); }\n' +
                '    return transform(input, { retries: ' + (turn % 5) + ' });\n}\n```';
    }
    return text;
}

// Builds the claude.ai-shaped payload: q user turns => 2q alternating messages,
// plus the leading interrupted assistant entry. Topic blocks of ~12-20 turns.
function buildConversation(q, seed, conversationUuid) {
    const rnd = lcg(seed);
    const messages = [];
    let sequence = 0;
    const uuidFor = (i) => 'aaaaaaaa-0000-4000-8000-' + String(i).padStart(12, '0');
    const push = (m) => {
        m.uuid = uuidFor(sequence);
        m.parent_message_uuid = sequence === 0
            ? '00000000-0000-4000-8000-000000000000' : uuidFor(sequence - 1);
        m.index = sequence;
        m.created_at = '2026-07-01T00:00:00Z';
        m.attachments = m.attachments || [];
        m.files = [];
        messages.push(m);
        sequence++;
    };

    push({ sender: 'assistant', text: '',
           content: [{ type: 'text', text: 'Conversation started.' }] });

    let userChars = 0, aiChars = 0;
    let topicIdx = 0, turnsLeftInTopic = 12 + Math.floor(rnd() * 9);
    for (let turn = 1; turn <= q; turn++) {
        if (turnsLeftInTopic-- <= 0) {
            topicIdx = (topicIdx + 1) % TOPICS.length;
            turnsLeftInTopic = 12 + Math.floor(rnd() * 9);
        }
        const vocab = TOPICS[topicIdx];
        const qt = questionText(rnd, vocab, turn);
        userChars += qt.length;
        push({ sender: 'human', text: '', content: [{ type: 'text', text: qt }] });
        const at = answerText(rnd, vocab, turn);
        aiChars += at.length;
        push({ sender: 'assistant', text: '', stop_reason: 'end_turn',
               content: [{ type: 'text', text: at }] });
    }

    const payload = {
        uuid: conversationUuid,
        name: 'Perf probe conversation (' + q + ' questions)',
        current_leaf_message_uuid: uuidFor(sequence - 1),
        chat_messages: messages,
    };
    return {
        payload,
        stats: {
            questions: q,
            totalMessages: 2 * q,
            userChars,
            aiChars,
            totalChars: userChars + aiChars,
            avgUserLen: Math.round(userChars / q),
            avgAiLen: Math.round(aiChars / q),
        },
    };
}

module.exports = { buildConversation };
