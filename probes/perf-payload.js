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

// VOCAB_MULT — multiplies the DISTINCT vocabulary by appending morphological
// variants of every base word. Vocabulary size is what drives the initial
// segment count: _sumWordOverlap divides by max(|A|,|B|), so a message that
// re-uses a small shared pool scores high overlap and never splits. The default
// pool (~115 distinct words per topic block) keeps overlap above the 0.15 split
// threshold, which is why the seeded payload produced ~10 segments while the
// owner's real conversation produced ~218 (TROUBLESHOOTING live entry).
// VOCAB_MULT=1 reproduces every earlier measurement byte-for-byte.
const VOCAB_MULT = Math.max(1, Math.round(+(process.env.VOCAB_MULT || 1)));
const SUFFIXES = ['ing', 'ers', 'ally', 'ised', 'ment', 'ance', 'ility', 'ative', 'ology', 'esque'];

function expandVocab(words) {
    if (VOCAB_MULT <= 1) return words;
    const out = words.slice();
    for (let k = 0; k < VOCAB_MULT - 1; k++) {
        for (const w of words) out.push(w + SUFFIXES[k % SUFFIXES.length]);
    }
    return out;
}

const COMMON = expandVocab(('system value result process data function module handler request response state ' +
    'update change logic method object array string number index buffer cache queue event ' +
    'listener callback promise thread worker branch merge commit release version test case ' +
    'error warning message log output input option setting config field record entry table ' +
    'row column query filter sort group batch chunk stream parse build render layout style').split(' '));

const TOPICS = [
    'authentication login session token cookie password oauth refresh expiry credential scope identity provider redirect grant'.split(' '),
    'database migration schema index postgres transaction rollback constraint foreign key sequence vacuum replica shard partition'.split(' '),
    'frontend component react props hooks effect memo virtual dom hydration bundle webpack chunk lazy suspense'.split(' '),
    'deployment docker container kubernetes pod service ingress helm registry image rollout replica autoscale probe liveness'.split(' '),
    'performance profiling latency throughput benchmark flamegraph allocation garbage collector heap sampling regression budget percentile jitter'.split(' '),
    'testing playwright fixture assertion mock selector harness coverage mutation flake retry timeout headless engine viewport'.split(' '),
    'networking websocket http header proxy timeout retry backoff dns certificate handshake payload compression keepalive multiplex'.split(' '),
    'analytics dashboard metric aggregation funnel cohort retention churn segment export visualization drilldown anomaly forecast'.split(' '),
].map(expandVocab);

const KEYPOINT_TEMPLATES = [
    'It turns out the {A} {B} was holding the {C} open longer than the {D} allowed in practice.',
    'The root cause is that the {A} {B} never releases its {C} before the {D} finishes.',
    'You should use a dedicated {A} {B} for every {C} instead of sharing one {D} across them.',
    'We decided to go with the {A} {B} approach because the {C} keeps the {D} simple.',
    'Note that the {A} {B} must be flushed before the {C} reads the {D} again.',
    'Make sure the {A} {B} is committed before any {C} mutation touches the {D}.',
];

const FILES = ['config.js', 'pipeline.py', 'schema.sql', 'report.csv', 'index.html', 'deploy.yaml', 'notes.md'];

// ---------------------------------------------------------------------------
// PAYLOAD_LANG — which SCRIPT the conversation is written in. Added 2026-08-02
// for the tokenizer arc (ROADMAP 0a): `_sumTokenize` strips [^a-z0-9\s], so a
// Korean conversation yields zero tokens and every content-derived Summary
// feature is dead for it. Scoring that claim, and any fix for it, needs a
// payload the harness's ground-truth machinery already understands — so this is
// the SAME generator with the same topic blocks and the same boundary indices,
// only the words change. Nothing else about the shape moves.
//
// 'en' is the default and reproduces every earlier measurement byte-for-byte:
// the English path below is untouched and is not routed through any of this.
//
// Language scope (owner, 2026-08-02): the product ships English (default) and
// Korean — Korean is the ONLY translation. 'lat' is not a supported language;
// it is accented/punctuated English used to measure what widening the character
// class does to ASCII-adjacent text that real English users actually type
// (café, naïve, smart quotes, em dashes).
// ---------------------------------------------------------------------------
const LANG = String(process.env.PAYLOAD_LANG || 'en').toLowerCase();

// Korean topic pools, block-for-block parallel to TOPICS above so the ground
// truth (`topicBoundaries`) means the same thing in both languages.
const KO_TOPICS = [
    '인증 로그인 세션 토큰 쿠키 비밀번호 권한 갱신 만료 자격증명 범위 신원 제공자 리다이렉트 발급'.split(' '),
    '데이터베이스 마이그레이션 스키마 색인 트랜잭션 롤백 제약 외래키 시퀀스 복제본 샤딩 분할 정합성 백업 잠금'.split(' '),
    '프론트엔드 컴포넌트 렌더링 속성 상태관리 효과 가상돔 번들 지연로딩 스타일 레이아웃 반응형 마운트 재조정'.split(' '),
    '배포 컨테이너 이미지 레지스트리 서비스 오토스케일 롤아웃 헬스체크 클러스터 노드 파드 인그레스 무중단 회수'.split(' '),
    '성능 프로파일링 지연시간 처리량 벤치마크 할당 가비지 샘플링 회귀 예산 백분위 병목 최적화 측정치'.split(' '),
    '테스트 픽스처 단언 목업 선택자 하네스 커버리지 변이 재시도 시간초과 헤드리스 엔진 뷰포트 검증 회귀검사'.split(' '),
    '네트워크 웹소켓 헤더 프록시 재시도 백오프 인증서 핸드셰이크 페이로드 압축 연결유지 다중화 대역폭 경로'.split(' '),
    '분석 대시보드 지표 집계 퍼널 코호트 유지율 이탈 세그먼트 내보내기 시각화 이상탐지 예측 추이 표본'.split(' '),
];

// Deliberately includes 2-syllable nouns (값, 결과, 처리, 상태, 오류 …). Korean
// content words are commonly two syllables, which is exactly the population the
// shipped `w.length > 2` filter discards — so the payload has to contain them
// for that filter's effect to be measurable rather than assumed.
const KO_COMMON = ('시스템 결과 처리 데이터 함수 모듈 핸들러 요청 응답 상태 변경 논리 방법 객체 배열 ' +
    '문자열 숫자 인덱스 버퍼 캐시 대기열 이벤트 리스너 콜백 프로미스 스레드 작업자 브랜치 병합 커밋 ' +
    '릴리스 버전 오류 경고 메시지 기록 출력 입력 옵션 설정 필드 레코드 항목 테이블 조회 필터 정렬 ' +
    '그룹 배치 청크 스트림 파싱 빌드 렌더 구조 정책 계층 기능 방식 관리 구현 동작 조건 결정').split(' ');

// Korean compounding for VOCAB_MULT: real Korean widens vocabulary by forming
// compounds (인증 → 인증처리, 인증정책), not by suffixing English morphemes.
const KO_SUFFIXES = ['처리', '관리', '설정', '방식', '구조', '정책', '계층', '기능', '로직', '규칙'];

function expandVocabKo(words) {
    if (VOCAB_MULT <= 1) return words;
    const out = words.slice();
    for (let k = 0; k < VOCAB_MULT - 1; k++) {
        for (const w of words) out.push(w + KO_SUFFIXES[k % KO_SUFFIXES.length]);
    }
    return out;
}

// Korean particle selection depends on whether the preceding syllable ends in a
// final consonant (받침). Getting this right matters for the measurement, not
// for looks: it is what makes one noun appear as several distinct surface forms
// (토큰이 / 토큰을 / 토큰은), which is the agglutination that a whitespace
// tokenizer cannot see through.
function hasFinal(word) {
    const c = word.charCodeAt(word.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return false;     // not a Hangul syllable
    return (c - 0xac00) % 28 !== 0;
}
function withParticle(word, ifFinal, ifNoFinal) {
    return word + (hasFinal(word) ? ifFinal : ifNoFinal);
}

const KO_PREDICATES = [
    '있습니다', '없습니다', '발생합니다', '동작합니다', '필요합니다', '보입니다',
    '되었습니다', '확인했습니다', '수정했습니다', '남아있습니다',
];
const KO_CONNECTIVES = ['그리고', '하지만', '그래서', '또한', '다만', '결국'];

// A Korean sentence: subject phrase + a couple of oblique phrases + predicate.
// `words` is the same knob the English builder takes, so message LENGTH stays
// comparable between the two languages.
function koSentence(rnd, vocab, words, terminal) {
    const parts = [];
    const pool = () => (rnd() < 0.55 ? vocab : KO_COMMON);
    if (rnd() < 0.25) parts.push(pick(rnd, KO_CONNECTIVES));
    parts.push(withParticle(pick(rnd, pool()), '이', '가'));
    const middle = Math.max(1, words - 3);
    for (let i = 0; i < middle; i++) {
        const w = pick(rnd, pool());
        const r = rnd();
        if (r < 0.28)      parts.push(withParticle(w, '을', '를'));
        else if (r < 0.48) parts.push(w + '에서');
        else if (r < 0.62) parts.push(w + '의');
        else if (r < 0.74) parts.push(withParticle(w, '은', '는'));
        else if (r < 0.84) parts.push(withParticle(w, '으로', '로'));
        else               parts.push(w);
    }
    parts.push(pick(rnd, KO_PREDICATES));
    return parts.join(' ') + (terminal || '.');
}

// Korean key-point-shaped sentences. KEY_POINT_PATTERNS is a set of ENGLISH
// regexes, so these match nothing today — that is the point: it makes "key
// points are dead for Korean" a number rather than an inference, and gives any
// future Korean pattern set something to be scored against.
// Particles attach to FIXED words here, never to a {slot}: Korean particle
// choice depends on the preceding syllable's final consonant, and a template
// cannot know what will be substituted in. Slot-adjacent particles produced
// forms like `기록가` (should be `기록이`) in the first draft.
const KO_KEYPOINT_TEMPLATES = [
    '확인해보니 {A} {B} 쪽에서 {C} 관련 {D} 처리가 예상보다 오래 걸렸습니다.',
    '근본 원인은 {A} {B} 단계에서 {C} 자원을 {D} 완료 전에 반환하지 않는 것입니다.',
    '{C} 공유 대신 {A}마다 별도의 {B} 인스턴스를 사용해야 합니다.',
    '{C} 구조가 {D} 부분을 단순하게 유지하므로 {A} {B} 방식으로 결정했습니다.',
    '{A} {B} 변경은 {C} 쪽에서 {D} 값을 다시 읽기 전에 반드시 반영되어야 합니다.',
    '{C} 변경이 {D} 영역에 닿기 전에 {A} {B} 부분을 커밋했는지 확인하세요.',
];

function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }

function sentence(rnd, vocab, words, terminal) {
    if (LANG === 'ko') return koSentence(rnd, vocab, words, terminal);
    const parts = [];
    for (let i = 0; i < words; i++) {
        const pool = rnd() < 0.55 ? vocab : COMMON;
        parts.push(pick(rnd, pool));
    }
    let s = parts.join(' ');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (LANG === 'lat') s = accentize(s);
    return s + (terminal || '.');
}

// 'lat' — the SAME English text with the diacritics, smart quotes and dashes a
// real English conversation contains. Not a language: a probe for what the
// widened character class does to text the current tokenizer already mangles
// (`café` → `caf`). Deterministic, driven by the same seeded rnd via the caller.
const ACCENT_MAP = [
    [/\bdata\b/g, 'dáta'], [/\bcache\b/g, 'caché'], [/\bnaive\b/g, 'naïve'],
    [/\bresume\b/g, 'résumé'], [/\brole\b/g, 'rôle'], [/\bstate\b/g, 'stäte'],
    [/\bquery\b/g, 'quéry'], [/\bmerge\b/g, 'mergé'],
];
function accentize(s) {
    let out = s;
    for (const [re, rep] of ACCENT_MAP) out = out.replace(re, rep);
    return out.replace(/'/g, '’').replace(/ - /g, ' — ');
}

function fillTemplate(rnd, vocab, tpl) {
    return tpl.replace(/\{[A-D]\}/g, () => pick(rnd, rnd() < 0.6 ? vocab : (LANG === 'ko' ? KO_COMMON : COMMON)));
}

// A user question: 2-4 sentences, ends in a question. ~200-450 chars.
function questionText(rnd, vocab, turn) {
    const n = 2 + Math.floor(rnd() * 3);
    const ss = [];
    for (let i = 0; i < n - 1; i++) ss.push(sentence(rnd, vocab, 10 + Math.floor(rnd() * 8)));
    ss.push(sentence(rnd, vocab, 9 + Math.floor(rnd() * 7), '?'));
    const prefix = LANG === 'ko' ? '질문 ' + turn + '. ' : 'Turn ' + turn + ': ';
    return prefix + ss.join(' ');
}

// An assistant answer: 3-5 paragraphs of 3-6 sentences (~1500-4500 chars),
// with occasional key-point sentences, a fenced code block on every 3rd answer,
// and occasional file mentions — so keyPoints, inventory and the fence regex all
// do real work.
// Env knobs for sensitivity runs (defaults reproduce the baseline):
//   PARA_BOOST — multiplies paragraphs per answer (text volume)
//   KP_RATE    — multiplies the key-point-sentence density
//   VOCAB_MULT — multiplies distinct vocabulary (drives the segment count; see above)
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
                ss.push(fillTemplate(rnd, vocab,
                    pick(rnd, LANG === 'ko' ? KO_KEYPOINT_TEMPLATES : KEYPOINT_TEMPLATES)));
            } else if (rnd() < 0.08) {
                ss.push(LANG === 'ko'
                    ? ('이 변경은 기존 ' + pick(rnd, vocab) + ' ' + pick(rnd, KO_COMMON) +
                       ' 옆에 있는 ' + pick(rnd, FILES) + ' 에 들어가야 합니다.')
                    : ('The change belongs in ' + pick(rnd, FILES) + ' next to the existing ' +
                       pick(rnd, vocab) + ' ' + pick(rnd, COMMON) + '.'));
            } else {
                ss.push(sentence(rnd, vocab, 12 + Math.floor(rnd() * 12)));
            }
        }
        paras.push(ss.join(' '));
    }
    let text = (LANG === 'ko' ? '답변 ' + turn + '. ' : 'Answer ' + turn + ': ') + paras.join('\n\n');
    if (turn % 3 === 0) {
        // Kept in every language: a real Korean technical conversation contains
        // ASCII code too, and the fenced block is what the tokenizer strips
        // before anything else. `|| 'value'` because a Korean vocab word reduces
        // to the empty string under [^a-z].
        const varName = pick(rnd, vocab).replace(/[^a-z]/g, '') || 'value';
        text += '\n\n```javascript\nfunction handle_' + turn + '(input) {\n' +
                '    var ' + varName + ' = normalize(input);\n' +
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
           content: [{ type: 'text', text: LANG === 'ko' ? '대화를 시작합니다.' : 'Conversation started.' }] });

    // Topic pools for the selected script. The BLOCK STRUCTURE is identical in
    // every language — same seed, same rotation, same boundary indices — so a
    // score on one language is directly comparable to a score on another.
    const TOPIC_POOL = LANG === 'ko' ? KO_TOPICS.map(expandVocabKo) : TOPICS;

    let userChars = 0, aiChars = 0;
    let topicIdx = 0, turnsLeftInTopic = 12 + Math.floor(rnd() * 9);
    // GROUND TRUTH for segmentation accuracy: the timeline index of the first
    // message of every topic block after the first. The generator knows exactly
    // where the topic changes, so a segmenter can be SCORED instead of eyeballed
    // (added 2026-08-01 with the sub-segmentation fix). Timeline layout: index 0
    // is the leading interrupted entry, then turn t occupies 2t-1 (user) and 2t
    // (assistant) — so a topic change at turn t starts at index 2t-1.
    const topicBoundaries = [];
    for (let turn = 1; turn <= q; turn++) {
        if (turnsLeftInTopic-- <= 0) {
            topicIdx = (topicIdx + 1) % TOPIC_POOL.length;
            turnsLeftInTopic = 12 + Math.floor(rnd() * 9);
            topicBoundaries.push(2 * turn - 1);
        }
        const vocab = TOPIC_POOL[topicIdx];
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
        topicBoundaries,
        stats: {
            lang: LANG,
            questions: q,
            totalMessages: 2 * q,
            topicBlocks: topicBoundaries.length + 1,
            userChars,
            aiChars,
            totalChars: userChars + aiChars,
            avgUserLen: Math.round(userChars / q),
            avgAiLen: Math.round(aiChars / q),
        },
    };
}

module.exports = { buildConversation };
