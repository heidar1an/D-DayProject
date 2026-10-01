/*
 * سرویس «بانک تست علوم پایه تپش» — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی
 * Mock است و وضعیت کاربر (پاسخ‌ها، گلچین، نیاز به مرور، گزارش‌ها، فیلترهای ذخیره و
 * تاریخچهٔ سشن) در localStorage (کلید tapesh:testbank:v1:<userId>) ذخیره می‌شود.
 * با اتصال Backend فقط بدنهٔ توابع به fetch تبدیل می‌شود؛ امضا و شکل Entityها عوض نمی‌شود.
 *
 * قراردادهای آینده:
 *   GET  /api/bank/overview?bankKind=&track=      → fetchBankOverview()      (نمای کلی درون دامنه)
 *   POST /api/bank/questions/search             → searchQuestions()          (فیلتر + صفحه‌بندی)
 *   GET  /api/bank/questions/:id                → fetchQuestion()
 *   GET  /api/bank/questions/:id/attempts       → fetchQuestionAttemptStats()  (شکست تلاش‌های کاربر روی یک سؤال)
 *   POST /api/bank/sessions                     → createSession()            (blueprint سمت سرور به سؤال تبدیل می‌شود)
 *   GET  /api/sessions/:id                      → fetchSession()
 *   PUT  /api/sessions/:id/progress             → saveSessionProgress()      (autosave)
 *   POST /api/sessions/:id/submit               → submitSession()            (تصحیح سمت سرور)
 *   POST /api/bank/bookmarks/:questionId/toggle → toggleBookmark()
 *   POST /api/bank/review/:questionId/toggle    → toggleNeedReview()
 *   POST /api/bank/questions/:id/report         → reportQuestion()
 *   GET/POST/DELETE /api/bank/filters           → فیلترهای ذخیره‌شده («آزمون من»)
 *   GET  /api/bank/history                      → fetchHistory()
 *
 * دو محور طبقه‌بندی محتوا (هر دو فیلد استاندارد فیلتر و blueprint سشن‌اند):
 *   bankKinds → national «بانک تست کشوری» | authored «بانک تست تألیفی»
 *   tracks    → medicine «علوم پایه پزشکی» | dentistry «علوم پایه دندان‌پزشکی»
 * هر دو از خود رکورد سؤال مشتق می‌شوند (source/track)؛ UI هیچ‌وقت لیست دستی نگه نمی‌دارد.
 *
 * اصول طراحی:
 *  - حلّهٔ سؤال (questionIds) همیشه در سشن سمت سرویس ساخته می‌شود؛ UI هرگز blueprint
 *    را به لیست سؤال تبدیل نمی‌کند تا بعداً منطق پیشنهاد هوشمند همین‌جا جایگزین شود.
 *  - در حالت Exam، fetchSessionQuestions فیلد پاسخ و تحلیل را حذف می‌کند (sanitize)؛
 *    کلید پاسخ فقط بعد از submit از طریق fetchReviewSession برمی‌گردد.
 *  - وضعیت «حل‌شده/غلط/نیاز به مرور» هر سؤال از خود سشن‌ها مشتق می‌شود، نه فیلد دستی.
 */

import {
  BANK_KINDS,
  BANK_YEARS,
  BANK_STATS,
  DIFFICULTIES,
  QUESTION_TYPES,
  QUESTIONS,
  SOURCES,
  SUBJECTS,
  TOPIC_TREE,
  TRACKS,
  bankKindOf,
  buildStats,
  questionById,
  trackOf,
} from './mockData';

import { FEEDBACK_SOURCES, sendFeedback } from '../feedback/userFeedback';

const STATE_KEY_PREFIX = 'tapesh:testbank:v1:';
const LATENCY_MS = 280;
let bankLoad = null;
let bankRevision = null;
let bankCheckedAt = 0;
let bankSignal = null;

async function loadPublishedQuestions(force = false) {
  if (typeof window === 'undefined') return false;
  let signal = null;
  try { signal = window.localStorage.getItem('tapesh:testbank:changed'); } catch { /* ذخیرهٔ محلی اختیاری است */ }
  if (signal !== bankSignal) { bankSignal = signal; bankCheckedAt = 0; }
  if (!force && bankRevision !== null && Date.now() - bankCheckedAt < 3000) return false;
  if (bankLoad) return bankLoad;
  bankLoad = (async () => {
    const revisionResponse = await fetch('/api/public/test-bank/revision', { cache: 'no-store' });
    if (!revisionResponse.ok) throw new Error('bank-unavailable');
    const revisionPayload = await revisionResponse.json();
    const revision = revisionPayload.data?.revision;
    if (!revisionPayload.success || !revision) throw new Error('bank-unavailable');
    bankCheckedAt = Date.now();
    if (revision === bankRevision) return false;
    const response = await fetch('/api/public/test-bank/questions', { cache: 'no-store' });
    if (!response.ok) throw new Error('bank-unavailable');
    const payload = await response.json();
    if (!payload.success || !Array.isArray(payload.data?.questions)) throw new Error('bank-unavailable');
    QUESTIONS.splice(0, QUESTIONS.length, ...payload.data.questions);
    BANK_YEARS.splice(0, BANK_YEARS.length, ...[...new Set(QUESTIONS.filter((question) => question.source === 'official').map((question) => question.year).filter(Boolean))].sort((a, b) => a - b));
    Object.assign(BANK_STATS, buildStats(QUESTIONS));
    bankRevision = payload.data.revision ?? revision;
    return true;
  })().finally(() => { bankLoad = null; });
  return bankLoad;
}

export const refreshPublishedTestBankQuestions = () => loadPublishedQuestions(true);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * ── بازگشایی کنترل‌شده (PHASE 2) ──
 *
 * کلید پاسخ دیگر در Bundle و در payload عمومی نیست. تنها راه رسیدن به آن، ثبت
 * پاسخ است؛ سرور درستی را تعیین می‌کند و `correctAnswer`/`explanation`/توزیع
 * گزینه‌ها را **برای همان سؤال** برمی‌گرداند. این تابع نتیجه را روی همان شیء
 * سؤال می‌نشاند تا کد نمایشی موجود (`question.correctAnswer`،
 * `question.explanation`) بدون تغییر کار کند.
 *
 * نکته: `correctAnswer === undefined` یعنی «هنوز پاسخ داده نشده»، نه «نادرست».
 * هیچ تصمیم‌گیری‌ای نباید از نبودنش نتیجهٔ غلط بگیرد.
 */
function applyReveal(questionId, reveal) {
  const question = questionById(questionId);
  if (!question || !reveal) return;
  if (reveal.correctAnswer !== undefined && reveal.correctAnswer !== null) question.correctAnswer = reveal.correctAnswer;
  if (reveal.explanation) question.explanation = reveal.explanation;
  if (Array.isArray(reveal.optionPercents)) {
    question.stats = { ...(question.stats ?? {}), optionPercents: reveal.optionPercents };
  }
}

/*
 * POST /api/users/test-bank/answers
 *
 * فقط «واقعیت» می‌فرستد: کدام گزینه انتخاب شد. `isCorrect` را کلاینت تعیین
 * نمی‌کند و اگر بفرستد سرور نادیده می‌گیرد. پاسخ سرور شامل پاداش‌های گرفته‌شده
 * و بازگشایی هر سؤال است.
 */
async function reportAnswers(answers) {
  if (typeof window === 'undefined') return { awardedQuestionIds: [], results: [] };
  const response = await fetch('/api/users/test-bank/answers', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, selected: answer.selected, timeSpent: answer.timeSpent, answeredAt: answer.answeredAt })) }),
  });
  if (!response.ok) return { awardedQuestionIds: [], results: [] };
  bankCheckedAt = 0;
  const payload = await response.json();
  const awardedQuestionIds = Array.isArray(payload.awardedQuestionIds) ? payload.awardedQuestionIds : [];
  const results = Array.isArray(payload.results) ? payload.results : [];
  for (const reveal of results) applyReveal(reveal.questionId, reveal);
  if (awardedQuestionIds.length) window.dispatchEvent(new Event('tapesh:hearts:changed'));
  return { awardedQuestionIds, results };
}

/* ثبت یک پاسخ — خروجی: پاداش گرفته‌شده + بازگشایی همان سؤال (یا null) */
export async function recordBankAnswer(questionId, answer) {
  try {
    const { awardedQuestionIds, results } = await reportAnswers({ [questionId]: answer });
    return {
      awarded: awardedQuestionIds.includes(questionId),
      reveal: results.find((entry) => entry.questionId === questionId) ?? null,
    };
  } catch {
    return { awarded: false, reveal: null };
  }
}

/*
 * بررسی یک پاسخ برای مصرف‌کننده‌های دیگر (میکرو درسنامه، تست‌های بخشِ درسنامهٔ
 * جامع). همان قرارداد واحد: درستی از سرور، کلید فقط برای همین سؤال.
 * `selected` شمارهٔ گزینه (۰-پایه) است.
 */
export async function checkBankAnswer(questionId, selected) {
  const { reveal } = await recordBankAnswer(questionId, { selected, timeSpent: 0, answeredAt: Date.now() });
  return reveal;
}

/*
 * POST /api/users/test-bank/grade — تصحیح authoritative تلاش.
 * نمره در کلاینت ساخته نمی‌شود؛ سرور با کلید خودش تصحیح می‌کند و اعداد را
 * برمی‌گرداند. اگر سرور در دسترس نباشد، **نمرهٔ ساختگی ساخته نمی‌شود** — خطا
 * بالا می‌رود تا UI پیام بدهد (اصل «Client نباید حقیقت نتیجه را تعیین کند»).
 */
async function gradeBankAttempt(session) {
  const response = await fetch('/api/users/test-bank/grade', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionIds: session.questionIds,
      answers: session.answers ?? {},
      negativeMarking: session.negativeMarking ?? 0,
    }),
  });
  if (!response.ok) throw new Error('grade-unavailable');
  const payload = await response.json();
  if (!payload?.result) throw new Error('grade-unavailable');
  return payload.result;
}
const respond = async (build) => {
  await loadPublishedQuestions();
  await delay(LATENCY_MS + Math.random() * 160);
  return build();
};

export function trackEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[testbank:track] ${name}`, payload);
  }
}

/* ────────────────────────── وضعیت کاربر ────────────────────────── */

const EMPTY_STATE = {
  sessions: [], //Attempt-like: {id, mode, title, subtitle, blueprint, questionIds, answers, marked, ...}
  bookmarks: [], // qid[] — نشان‌شده‌ها
  review: [], // qid[] — نیاز به مرور
  reports: [], // {questionId, reason, note, at}
  savedFilters: [], // {id, name, createdAt, blueprint}
  seeded: false,
};

function resolveUserKey(userRef) {
  if (typeof userRef === 'string') return userRef || 'guest';
  const identity = userRef?.id ?? userRef?.phone;
  return identity ? String(identity) : 'guest';
}

const stateKey = (userId) => `${STATE_KEY_PREFIX}${resolveUserKey(userId)}`;

function loadState(userId) {
  if (typeof window === 'undefined') return { ...EMPTY_STATE };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(stateKey(userId)) || 'null');
    return parsed && typeof parsed === 'object' ? { ...EMPTY_STATE, ...parsed } : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function saveState(userId, state) {
  if (typeof window === 'undefined') return state;
  try {
    window.localStorage.setItem(stateKey(userId), JSON.stringify(state));
  } catch {
    /* محدودیت فضای localStorage وضعیت بانک را نمی‌شکند */
  }
  return state;
}

function mutateState(userId, mutator) {
  const state = loadState(userId);
  mutator(state);
  return saveState(userId, state);
}

/* ────────────────────────── موتور فیلتر ────────────────────────── */

/* فیلتر استاندارد بانک — UI و Blueprint سشن هر دو از همین شکل استفاده می‌کنند */
export const EMPTY_FILTERS = {
  bankKinds: [], // national | authored — «بانک تست کشوری / بانک تست تألیفی»
  tracks: [], // medicine | dentistry — «علوم پایه پزشکی / علوم پایه دندان‌پزشکی»
  subjectIds: [],
  topicPaths: [], // ['قلب و عروق'] یا ['قلب و عروق', 'ECG']
  yearFrom: null,
  yearTo: null,
  sources: [],
  types: [],
  difficulties: [],
  tags: [],
  status: null, // unsolved | solved | wrong | weak | bookmarked | review
  search: '',
};

export function normalizeFilters(filters = {}) {
  const merged = { ...EMPTY_FILTERS, ...filters };
  return {
    bankKinds: [...(merged.bankKinds ?? [])],
    tracks: [...(merged.tracks ?? [])],
    subjectIds: [...(merged.subjectIds ?? [])],
    topicPaths: [...(merged.topicPaths ?? [])],
    yearFrom: merged.yearFrom ?? null,
    yearTo: merged.yearTo ?? null,
    sources: [...(merged.sources ?? [])],
    types: [...(merged.types ?? [])],
    difficulties: [...(merged.difficulties ?? [])],
    tags: [...(merged.tags ?? [])],
    status: merged.status ?? null,
    search: (merged.search ?? '').trim(),
  };
}

/*
 * «دامنهٔ بانک» — انتخاب سطح بالای کاربر: نوع بانک (کشوری/تألیفی) و رشته
 * (پزشکی/دندان‌پزشکی). شکل واحدی دارد و همهٔ نماها آن را با scopeToFilters
 * به فیلتر استاندارد تبدیل می‌کنند، پس منطق فیلتر فقط در filterQuestions می‌ماند.
 */
export const EMPTY_SCOPE = { bankKind: null, track: null };

export const normalizeScope = (scope = {}) => ({
  bankKind: scope?.bankKind ?? null,
  track: scope?.track ?? null,
});

export const scopeToFilters = (scope) => {
  const s = normalizeScope(scope);
  return normalizeFilters({
    bankKinds: s.bankKind ? [s.bankKind] : [],
    tracks: s.track ? [s.track] : [],
  });
};

export const scopeLabel = (scope) => {
  const s = normalizeScope(scope);
  const bank = s.bankKind ? BANK_KINDS[s.bankKind]?.short : null;
  const track = s.track ? TRACKS[s.track]?.short : null;
  return [bank, track].filter(Boolean).join(' · ');
};

export const activeFilterCount = (filters) => {
  const f = normalizeFilters(filters);
  return (
    f.bankKinds.length +
    f.tracks.length +
    f.subjectIds.length +
    f.topicPaths.length +
    (f.yearFrom ? 1 : 0) +
    (f.yearTo ? 1 : 0) +
    f.sources.length +
    f.types.length +
    f.difficulties.length +
    f.tags.length +
    (f.status ? 1 : 0) +
    (f.search ? 1 : 0)
  );
};

/* نمای کاربر از هر سؤال — از سشن‌ها مشتق می‌شود */
function userQuestionStats(state) {
  const map = new Map(); // qid → {attempts, correct, wrong, lastCorrect, lastAnsweredAt}
  for (const session of state.sessions) {
    if (session.status === 'in_progress') continue;
    for (const [qid, answer] of Object.entries(session.answers ?? {})) {
      const entry = map.get(qid) ?? { attempts: 0, correct: 0, wrong: 0, lastCorrect: null, lastAnsweredAt: 0 };
      entry.attempts += 1;
      if (answer.isCorrect) entry.correct += 1;
      else entry.wrong += 1;
      entry.lastCorrect = Boolean(answer.isCorrect);
      entry.lastAnsweredAt = Math.max(entry.lastAnsweredAt, answer.answeredAt ?? session.submittedAt ?? 0);
      map.set(qid, entry);
    }
  }
  return map;
}

function filterQuestions(filters, state) {
  const f = normalizeFilters(filters);
  const stats = userQuestionStats(state);
  const query = f.search.toLowerCase();

  return QUESTIONS.filter((question) => {
    if (f.bankKinds.length && !f.bankKinds.includes(bankKindOf(question))) return false;
    if (f.tracks.length && !f.tracks.includes(trackOf(question))) return false;
    if (f.subjectIds.length && !f.subjectIds.includes(question.subject)) return false;
    if (f.topicPaths.length) {
      const match = f.topicPaths.some((topic) => question.topicPath.includes(topic));
      if (!match) return false;
    }
    if (f.yearFrom && question.year < f.yearFrom) return false;
    if (f.yearTo && question.year > f.yearTo) return false;
    if (f.sources.length && !f.sources.includes(question.source)) return false;
    if (f.types.length && !f.types.includes(question.type)) return false;
    if (f.difficulties.length && !f.difficulties.includes(question.difficulty)) return false;
    if (f.tags.length && !f.tags.some((tag) => question.tags.includes(tag))) return false;
    if (query) {
      const haystack = `${question.stem} ${question.topicPath.join(' ')} ${subjectById(question.subject)?.name ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (f.status) {
      const userStat = stats.get(question.id);
      const bookmarked = state.bookmarks.includes(question.id);
      const inReview = state.review.includes(question.id);
      switch (f.status) {
        case 'unsolved':
          if (userStat) return false;
          break;
        case 'solved':
          if (!userStat) return false;
          break;
        case 'wrong':
          if (!userStat || userStat.wrong === 0) return false;
          break;
        case 'weak':
          if (!userStat || userStat.correct / userStat.attempts >= 0.5) return false;
          break;
        case 'bookmarked':
          if (!bookmarked) return false;
          break;
        case 'review':
          if (!inReview) return false;
          break;
        default:
          break;
      }
    }
    return true;
  }).map((question) => ({
    question,
    userStat: stats.get(question.id) ?? null,
    bookmarked: state.bookmarks.includes(question.id),
    inReview: state.review.includes(question.id),
  }));
}

const subjectById = (id) => SUBJECTS.find((subject) => subject.id === id) ?? null;

/* ────────────────────────── API: نمای کلی بانک ────────────────────────── */

/*
 * GET /api/bank/overview — آمار بانک + شمارنده‌های کاربر؛ همهٔ اعداد UI از همین
 * پاسخ می‌آید تا هیچ جایی به شمارش مستقیم دادهٔ Mock وابسته نباشد.
 *
 * scope = { bankKind, track } — نمای کلی «درون دامنهٔ انتخابی» محاسبه می‌شود:
 * آمار بانک، درس‌ها، سال‌ها، مباحث و برچسب‌ها همه از همان مجموعهٔ فیلترشده می‌آیند.
 * در عوض شمارنده‌های کاربر و «نقشهٔ تعداد» دو محور (banks/tracks) همیشه کل بانک را
 * نشان می‌دهند تا سوییچر انتخاب بانک همیشه عدد واقعی داشته باشد.
 *
 * سال‌ها فقط بر پایهٔ سؤال‌های رسمی (official) ساخته می‌شوند، چون «آزمون سال‌به‌سال»
 * دقیقاً همان سؤال‌ها را اجرا می‌کند؛ پس عدد کارت سال با محتوای آزمون یکی است.
 */
export function fetchBankOverview(userId, scope = EMPTY_SCOPE) {
  return respond(() => {
    const state = loadState(userId);
    const stats = userQuestionStats(state);
    const activeScope = normalizeScope(scope);
    const scoped = filterQuestions(scopeToFilters(activeScope), state).map((entry) => entry.question);

    const subjectCounts = SUBJECTS.map((subject) => ({
      ...subject,
      questionCount: scoped.filter((question) => question.subject === subject.id).length,
    }));

    const yearPool = scoped.filter((question) => question.source === 'official');
    const yearCounts = [...new Set(yearPool.map((question) => question.year).filter(Boolean))].sort((a, b) => b - a).map((year) => {
      const items = yearPool.filter((question) => question.year === year);
      const community = items.length
        ? Math.round(items.reduce((sum, question) => sum + question.stats.correctPercent, 0) / items.length)
        : 0;
      return {
        year,
        questionCount: items.length,
        communityCorrectPercent: community,
        durationMinutes: items.length * 2,
        userBestPercent: bestPercentForYear(state, items.map((question) => question.id)),
      };
    }).filter((entry) => entry.questionCount > 0);

    const answeredAll = [...stats.values()];
    const attemptsTotal = answeredAll.reduce((sum, entry) => sum + entry.attempts, 0);
    const correctTotal = answeredAll.reduce((sum, entry) => sum + entry.correct, 0);

    const topicCounts = {};
    for (const question of scoped) {
      const topic = question.topicPath[0];
      topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
    }

    return {
      scope: activeScope,
      bank: buildStats(scoped),
      /* نقشهٔ دو محور برای سوییچر — شمارندهٔ کل بانک (بدون اعمال scope) */
      banks: Object.entries(BANK_KINDS).map(([id, meta]) => ({
        id,
        ...meta,
        questionCount: QUESTIONS.filter((question) => bankKindOf(question) === id).length,
      })),
      tracks: Object.entries(TRACKS).map(([id, meta]) => ({
        id,
        ...meta,
        questionCount: QUESTIONS.filter((question) => trackOf(question) === id).length,
      })),
      subjects: subjectCounts,
      years: yearCounts,
      topics: topicCounts,
      tags: {
        featured: scoped.filter((question) => question.tags.includes('منتخب')).length,
        frequent: scoped.filter((question) => question.tags.includes('پرتکرار')).length,
        challenging: scoped.filter((question) => ['hard', 'very_hard'].includes(question.difficulty)).length,
      },
      user: {
        solvedCount: stats.size,
        wrongCount: [...stats.values()].filter((entry) => entry.wrong > 0).length,
        bookmarkCount: state.bookmarks.length,
        reviewCount: state.review.length,
        sessionCount: state.sessions.filter((session) => session.status !== 'in_progress').length,
        attemptsTotal,
        accuracy: attemptsTotal ? Math.round((correctTotal / attemptsTotal) * 100) : null,
        history: latestHistory(state, 5),
      },
    };
  });
}

function bestPercentForYear(state, yearQuestionIds) {
  const graded = state.sessions.filter(
    (session) => session.status === 'submitted' && session.mode === 'exam' &&
      session.questionIds.every((id) => yearQuestionIds.includes(id)) &&
      session.questionIds.length === yearQuestionIds.length,
  );
  if (!graded.length) return null;
  return Math.max(...graded.map((session) => session.result?.percentage ?? 0));
}

function latestHistory(state, limit) {
  return state.sessions
    .filter((session) => session.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
    .slice(0, limit)
    .map((session) => ({
      id: session.id,
      mode: session.mode,
      title: session.title,
      subtitle: session.subtitle,
      percentage: session.result?.percentage ?? null,
      correct: session.result?.correct ?? 0,
      total: session.questionIds.length,
      submittedAt: session.submittedAt,
    }));
}

/* ────────────────────────── API: جستجو و فیلتر ────────────────────────── */

/*
 * POST /api/bank/questions/search — فیلتر + صفحه‌بندی.
 * هر آیتم حاوی خود سؤال + نمای کاربر (وضعیت حل، گلچین، نیاز به مرور) است.
 */
export function searchQuestions(userId, filters, { page = 1, pageSize = 8 } = {}) {
  return respond(() => {
    const state = loadState(userId);
    const matches = filterQuestions(filters, state);
    const start = (page - 1) * pageSize;
    return {
      items: matches.slice(start, start + pageSize),
      total: matches.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(matches.length / pageSize)),
      hasMore: start + pageSize < matches.length,
    };
  });
}

export function fetchQuestion(questionId) {
  return respond(() => {
    const question = questionById(questionId);
    if (!question) throw new Error('question-not-found');
    return question;
  });
}

/*
 * GET /api/bank/questions/:id/attempts — شکستِ تلاش‌های کاربر روی یک سؤال.
 * عددها از سشن‌ها مشتق می‌شوند (هیچ شمارندهٔ دستی ذخیره نمی‌شود): سشن‌های ثبت‌شده به‌علاوهٔ
 * تمرین‌های در جریان که پاسخشان همان لحظه تصحیح می‌شود تا آمار بعد از هر ثبت پاسخ تازه بماند.
 *   attempts → بارهایی که پاسخ ثبت شده   |  correct / wrong → نتیجهٔ همان بارها
 *   skipped  → سؤال در سشن ثبت‌شده بوده ولی بی‌پاسخ مانده
 *   doubted  → در حین حل علامت‌گذاری شده («شک داشتم»)
 *   lastAnsweredAt / lastCorrect → تازه‌ترین پاسخ ثبت‌شده
 */
export function fetchQuestionAttemptStats(userId, questionId) {
  return respond(() => {
    const state = loadState(userId);
    const question = questionById(questionId);

    let attempts = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let doubted = 0;
    let lastAnsweredAt = 0;
    let lastCorrect = null;

    for (const session of state.sessions) {
      if (!session.questionIds?.includes(questionId)) continue;

      /* تمرینِ در جریان: پاسخ همان لحظه تصحیح می‌شود، پس بلافاصله در آمار می‌نشیند؛
         آزمونِ در جریان هنوز کلید ندارد و بعد از submit می‌شمارد. */
      if (session.status === 'in_progress') {
        const answer = session.answers?.[questionId];
        if (session.mode !== 'exam' && answer) {
          attempts += 1;
          if (answer.isCorrect) correct += 1;
          else wrong += 1;
          const at = answer.answeredAt ?? 0;
          if (at >= lastAnsweredAt) {
            lastAnsweredAt = at;
            lastCorrect = Boolean(answer.isCorrect);
          }
        }
        continue;
      }

      const answer = session.answers?.[questionId];
      if (answer) {
        /* درستی از حکم سرور می‌آید (`answer.isCorrect` هنگام ثبت پاسخ نوشته می‌شود).
           `question.correctAnswer` فقط پس از بازگشایی وجود دارد و معیار نیست. */
        const isCorrect = typeof answer.isCorrect === 'boolean'
          ? answer.isCorrect
          : answer.selected === question?.correctAnswer;
        attempts += 1;
        if (isCorrect) correct += 1;
        else wrong += 1;

        const at = answer.answeredAt ?? session.submittedAt ?? 0;
        if (at >= lastAnsweredAt) {
          lastAnsweredAt = at;
          lastCorrect = isCorrect;
        }
      } else {
        skipped += 1;
      }

      if (session.marked?.includes(questionId)) doubted += 1;
    }

    return {
      questionId,
      appearances: attempts + skipped,
      attempts,
      correct,
      wrong,
      skipped,
      doubted,
      lastAnsweredAt: lastAnsweredAt || null,
      lastCorrect,
    };
  });
}

/*
 * POST /api/bank/questions/stats — آمار مخزن یک فیلتر برای «آزمون‌ساز شخصی»:
 * همهٔ عددهایی که UI سازنده دربارهٔ در دسترس بودن نشان می‌دهد از همین‌جا می‌آید
 * (کل، تفکیک وضعیت کاربر، تفکیک سختی، تفکیک درس) — هیچ عددی تزئینی نیست.
 */
export function fetchPoolStats(userId, filters) {
  return respond(() => {
    const state = loadState(userId);
    const matches = filterQuestions(filters, state);
    const stats = {
      total: matches.length,
      byStatus: { unsolved: 0, solved: 0, wrong: 0, bookmarked: 0, review: 0 },
      byDifficulty: { easy: 0, medium: 0, hard: 0, very_hard: 0 },
      bySubject: {},
    };
    let timeSum = 0;
    let timeCount = 0;
    for (const { question, userStat, bookmarked, inReview } of matches) {
      stats.byDifficulty[question.difficulty] = (stats.byDifficulty[question.difficulty] ?? 0) + 1;
      if (question.stats?.avgTimeSec) {
        timeSum += question.stats.avgTimeSec;
        timeCount += 1;
      }
      const subjectEntry = (stats.bySubject[question.subject] ??= { total: 0, unsolved: 0, wrong: 0 });
      subjectEntry.total += 1;
      if (!userStat) {
        stats.byStatus.unsolved += 1;
        subjectEntry.unsolved += 1;
      } else {
        stats.byStatus.solved += 1;
        if (userStat.wrong > 0) {
          stats.byStatus.wrong += 1;
          subjectEntry.wrong += 1;
        }
      }
      if (bookmarked) stats.byStatus.bookmarked += 1;
      if (inReview) stats.byStatus.review += 1;
    }
    stats.avgTimeSec = timeCount ? Math.round(timeSum / timeCount) : null;
    return stats;
  });
}

/*
 * GET /api/bank/performance — پروفایل عملکرد کاربر (پایهٔ «آزمون نقاط ضعف من»):
 * دقت و تسلط در سطح درس و مبحث، مشتق‌شده از سشن‌های ثبت‌شده — نه فیلد دستی.
 * تسلط = دقت وزن‌خورده با حجم تلاش‌ها؛ درس‌های کم‌تلاش هنوز «نسنجیده» محسوب می‌شوند.
 */
export function fetchPerformanceProfile(userId) {
  return respond(() => {
    const state = loadState(userId);
    const stats = userQuestionStats(state);

    const subjects = new Map(); // subjectId → {attempts, correct, questions}
    const topics = new Map(); // topicPath.join(' › ') → {subjectId, topic, subtopic, attempts, correct, questions}

    for (const question of QUESTIONS) {
      const userStat = stats.get(question.id);
      if (!userStat) continue;

      const subjectEntry = subjects.get(question.subject) ?? {
        subjectId: question.subject,
        name: subjectById(question.subject)?.name ?? question.subject,
        accent: subjectById(question.subject)?.accent ?? '#9aa5b1',
        attempts: 0,
        correct: 0,
        questions: 0,
      };
      subjectEntry.attempts += userStat.attempts;
      subjectEntry.correct += userStat.correct;
      subjectEntry.questions += 1;
      subjects.set(question.subject, subjectEntry);

      const topicKey = question.topicPath.join(' › ');
      const topicEntry = topics.get(topicKey) ?? {
        subjectId: question.subject,
        topic: question.topicPath[0],
        subtopic: question.topicPath[1] ?? null,
        path: topicKey,
        attempts: 0,
        correct: 0,
        questions: 0,
      };
      topicEntry.attempts += userStat.attempts;
      topicEntry.correct += userStat.correct;
      topicEntry.questions += 1;
      topics.set(topicKey, topicEntry);
    }

    const shape = (entry) => ({
      ...entry,
      accuracy: entry.attempts ? Math.round((entry.correct / entry.attempts) * 100) : null,
    });

    return {
      subjects: [...subjects.values()].map(shape),
      topics: [...topics.values()].map(shape),
      attemptedCount: stats.size,
    };
  });
}

/* ────────────────────────── API: سشن (Attempt) ────────────────────────── */

/*
 * POST /api/bank/sessions — حلّهٔ سؤال از blueprint ساخته می‌شود:
 *   questionIds فوری | {count, shuffle} | فیلترهای استاندارد بانک
 * mode: 'practice' (بازخورد فوری) یا 'exam' (کارنامه در پایان؛ endsAt از سرویس)
 */
export function createSession(userId, config = {}) {
  return respond(() => {
    const {
      mode = 'practice',
      title = 'تمرین بانک تست',
      subtitle = '',
      blueprint = {},
      durationMinutes = null,
      negativeMarking = 0,
      count = null,
      shuffle = false,
      questionIds = null,
      filters = null,
      reviewMode = false,
      explainDepth = 'full', // full | answer-only — «فقط گزینهٔ صحیح» بدون تحلیل تشریحی
    } = config;

    let pool;
    let resolvedBlueprint = { ...blueprint };

    if (Array.isArray(questionIds) && questionIds.length) {
      pool = questionIds.map((id) => questionById(id)).filter(Boolean);
      /* blueprint منبع (مثل آزمون شخصی با examId) حفظ می‌شود تا Attemptها به آزمون وصل بمانند */
      resolvedBlueprint = { kind: 'explicit', ...blueprint, count: pool.length };
    } else if (filters) {
      const state = loadState(userId);
      pool = filterQuestions(filters, state).map((entry) => entry.question);
      resolvedBlueprint = { kind: 'filters', filters: normalizeFilters(filters) };
    } else {
      pool = [...QUESTIONS];
      resolvedBlueprint = { kind: 'all' };
    }

    let selected = pool;
    if (count && count < pool.length) {
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      selected = shuffled.slice(0, count);
      resolvedBlueprint = { ...resolvedBlueprint, requested: count, resolved: selected.length };
    } else if (shuffle) {
      selected = [...pool].sort(() => Math.random() - 0.5);
    }

    if (!selected.length) throw new Error('no-questions-matched');

    const now = Date.now();
    const session = {
      id: `tb-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      userId: resolveUserKey(userId),
      mode: reviewMode ? 'review' : mode,
      reviewOf: reviewMode ? config.reviewOf ?? null : null,
      title,
      subtitle,
      blueprint: resolvedBlueprint,
      explainDepth,
      negativeMarking,
      questionIds: selected.map((question) => question.id),
      currentIndex: 0,
      answers: {}, // qid → {selected, isCorrect?, timeSpent, answeredAt}
      marked: [],
      startedAt: now,
      endsAt: mode === 'exam' && durationMinutes ? now + durationMinutes * 60000 : null,
      submittedAt: null,
      status: 'in_progress',
      reason: null,
      result: null,
    };

    mutateState(userId, (draft) => {
      draft.sessions.push(session);
    });
    trackEvent('bank_session_started', { sessionId: session.id, mode: session.mode, count: selected.length });
    return session;
  });
}

/* GET /api/sessions/:id — برای Resume و ورود دوباره */
export function fetchSession(userId, sessionId) {
  return respond(() => {
    const session = loadState(userId).sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error('session-not-found');
    return session;
  });
}

/*
 * سؤال‌های سشن — در حالت exam بدون کلید پاسخ و تحلیل (sanitize)؛
 * در practice/review کامل تا بازخورد فوری و تحلیل ممکن باشد.
 */
export function fetchSessionQuestions(session) {
  return respond(async () => {
    const items = session.questionIds.map((id) => questionById(id)).filter(Boolean);
    if (session.mode === 'exam') {
      return items.map((question) => ({
        id: question.id,
        subject: question.subject,
        track: trackOf(question),
        topicPath: question.topicPath,
        type: question.type,
        difficulty: question.difficulty,
        year: question.year,
        examMonth: question.examMonth,
        source: question.source,
        sourceLabel: SOURCES[question.source]?.label,
        stem: question.stem,
        figure: question.figure,
        options: question.options,
      }));
    }
    /*
     * تمرین/مرور: پاسخ‌های ثبت‌شده از سرور بازگشایی می‌شوند تا پس از Refresh هم
     * کلید و تحلیل همان سؤال‌های پاسخ‌داده‌شده برگردد (نه کل بانک).
     */
    if (Object.keys(session.answers ?? {}).length) {
      try {
        await reportAnswers(session.answers);
      } catch {
        /* بی‌کلید هم تمرین ادامه‌پذیر است؛ فقط تحلیل باز نمی‌شود. */
      }
    }
    return items;
  });
}

/* PUT /api/sessions/:id/progress — ادغام به‌جای جایگزینی (رفع race دو کلیک پشت‌سرهم) */
export function saveSessionProgress(userId, session) {
  const state = mutateState(userId, (draft) => {
    const index = draft.sessions.findIndex((item) => item.id === session.id);
    if (index === -1) return;
    const stored = draft.sessions[index];
    draft.sessions[index] = {
      ...stored,
      ...session,
      answers: { ...(stored.answers ?? {}), ...(session.answers ?? {}) },
      marked: Array.isArray(session.marked) ? session.marked : (stored.marked ?? []),
    };
  });
  return state.sessions.find((item) => item.id === session.id) ?? session;
}

/*
 * POST /api/sessions/:id/submit — کارنامه.
 *
 * PHASE 2 — اعداد کارنامه **سرورساز** هستند:
 *   ۱. `POST /api/users/test-bank/grade` با کلید سرور تصحیح می‌کند (correct/wrong/
 *      unanswered/score/percentage/wrongIds) — کلاینت هیچ‌کدام را تعیین نمی‌کند.
 *   ۲. `POST /api/users/test-bank/answers` پاسخ‌ها را ثبت می‌کند، پاداش قلب را
 *      می‌دهد و کلید هر سؤال را برمی‌گرداند (بازگشایی کنترل‌شده).
 *   ۳. تفکیک درس/مبحث فقط **ارائه** است و از درستیِ همان پاسخ سرور ساخته می‌شود.
 *
 * اگر سرور در دسترس نباشد نمرهٔ ساختگی ساخته نمی‌شود؛ خطا بالا می‌رود و UI
 * پیام می‌دهد. Idempotent: submit دوباره روی سشن بسته، همان کارنامهٔ اول را
 * برمی‌گرداند و هیچ پاداش/نمرهٔ دومی تولید نمی‌کند.
 */
export function submitSession(userId, sessionId, { reason = 'user' } = {}) {
  return respond(async () => {
    const state = loadState(userId);
    const index = state.sessions.findIndex((item) => item.id === sessionId);
    if (index === -1) throw new Error('session-not-found');
    const session = state.sessions[index];
    if (session.status !== 'in_progress') return session;

    const now = Date.now();
    const graded = await gradeBankAttempt(session);

    let reveals = [];
    let heartAwards = 0;
    if (graded.answered) {
      try {
        const reported = await reportAnswers(session.answers ?? {});
        reveals = reported.results;
        heartAwards = reported.awardedQuestionIds.length;
      } catch {
        /* کارنامه حتی در صورت قطع ارتباط با سرور قابل نمایش است؛ اعداد همان‌هایی
           است که سرور در مرحلهٔ تصحیح برگردانده — نه محاسبهٔ محلی. */
      }
    }
    const correctById = new Map(reveals.map((entry) => [entry.questionId, entry.correct]));

    let timeSum = 0;
    const subjectMap = new Map();
    const topicMap = new Map();

    for (const questionId of session.questionIds) {
      const question = questionById(questionId);
      const answer = session.answers?.[questionId];
      if (!question) continue;

      const isCorrect = correctById.has(questionId)
        ? correctById.get(questionId)
        : (typeof answer?.isCorrect === 'boolean' ? answer.isCorrect : null);

      const subjectEntry = subjectMap.get(question.subject) ?? {
        subjectId: question.subject,
        subjectName: subjectById(question.subject)?.name ?? question.subject,
        correct: 0,
        wrong: 0,
        unanswered: 0,
        total: 0,
      };
      subjectEntry.total += 1;
      if (isCorrect === true) subjectEntry.correct += 1;
      else if (isCorrect === false) subjectEntry.wrong += 1;
      else subjectEntry.unanswered += 1;
      subjectMap.set(question.subject, subjectEntry);

      const topicKey = question.topicPath.join(' › ');
      const topicEntry = topicMap.get(topicKey) ?? {
        topic: question.topicPath[0],
        subtopic: question.topicPath[1] ?? null,
        subjectId: question.subject,
        correct: 0,
        wrong: 0,
        unanswered: 0,
        total: 0,
      };
      topicEntry.total += 1;
      if (isCorrect === true) topicEntry.correct += 1;
      else if (isCorrect === false) topicEntry.wrong += 1;
      else topicEntry.unanswered += 1;
      topicMap.set(topicKey, topicEntry);

      timeSum += answer?.timeSpent ?? 0;
    }

    const total = graded.total;
    const answered = graded.answered;
    const timedOut = reason === 'timeout' || Boolean(session.endsAt && now > session.endsAt);
    const totalSeconds = Math.round((now - session.startedAt) / 1000);
    const timeSpent = session.endsAt
      ? Math.min(totalSeconds, Math.round((session.endsAt - session.startedAt) / 1000))
      : totalSeconds;

    const subjects = [...subjectMap.values()]
      .map((entry) => ({ ...entry, percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
      .sort((a, b) => b.percent - a.percent);
    const topics = [...topicMap.values()]
      .map((entry) => ({ ...entry, percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
      .sort((a, b) => b.percent - a.percent);

    const result = {
      reason: timedOut ? 'timeout' : reason,
      submittedAt: now,
      total,
      answered,
      correct: graded.correct,
      wrong: graded.wrong,
      unanswered: graded.unanswered,
      score: graded.score,
      maxScore: graded.maxScore,
      negativeMarking: graded.negativeMarking,
      percentage: graded.percentage,
      timeSpent,
      avgTimeSec: graded.avgTimeSec,
      subjects,
      topics,
      wrongIds: graded.wrongIds,
      unansweredIds: graded.unansweredIds,
      strongest: subjects[0] ?? null,
      weakest: subjects.length > 1 ? subjects[subjects.length - 1] : null,
      /* ادغام میانگین زمانِ محاسبه‌شدهٔ محلی (ارائه) با اعداد سرور */
      localAvgTimeSec: answered ? Math.round(timeSum / answered) : 0,
    };

    const submitted = {
      ...session,
      status: 'submitted',
      submittedAt: now,
      reason: result.reason,
      result,
      heartAwards,
    };

    mutateState(userId, (draft) => {
      const storedIndex = draft.sessions.findIndex((item) => item.id === sessionId);
      if (storedIndex !== -1) draft.sessions[storedIndex] = submitted;
    });

    trackEvent('bank_session_submitted', {
      sessionId,
      mode: session.mode,
      percentage: result.percentage,
      answered,
      total,
    });
    return submitted;
  });
}

/*
 * سؤال‌های سشن همراه کلید پاسخ — فقط بعد از submit (مرور کارنامه).
 * کلید از سرور می‌آید (بازگشایی کنترل‌شده)؛ سشنِ در جریان هرگز کلید نمی‌گیرد.
 */
export function fetchReviewSession(userId, sessionId) {
  return respond(async () => {
    const state = loadState(userId);
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error('session-not-found');
    if (session.status === 'in_progress') throw new Error('review-not-allowed');

    try {
      await reportAnswers(session.answers ?? {});
    } catch {
      /* بی‌کلید هم کارنامه نمایش‌دادنی است؛ فقط تحلیل باز نمی‌شود. */
    }

    const questions = session.questionIds.map((id) => {
      const question = questionById(id);
      return { ...question, userAnswer: session.answers?.[id] ?? null, marked: session.marked?.includes(id) ?? false };
    });
    return { session, questions };
  });
}

/* ────────────────────────── API: نشان‌ها، مرور، گزارش ────────────────────────── */

/* POST /api/bank/bookmarks/:questionId/toggle */
export function toggleBookmark(userId, questionId, forceOn = null) {
  return respond(() => {
    let isOn = false;
    mutateState(userId, (state) => {
      const has = state.bookmarks.includes(questionId);
      if (forceOn === true || (forceOn === null && !has)) {
        state.bookmarks = [...new Set([...state.bookmarks, questionId])];
        isOn = true;
      } else {
        state.bookmarks = state.bookmarks.filter((id) => id !== questionId);
        isOn = false;
      }
    });
    trackEvent(isOn ? 'bank_bookmark_added' : 'bank_bookmark_removed', { questionId });
    return isOn;
  });
}

/* POST /api/bank/review/:questionId/toggle */
export function toggleNeedReview(userId, questionId, forceOn = null) {
  return respond(() => {
    let isOn = false;
    mutateState(userId, (state) => {
      const has = state.review.includes(questionId);
      if (forceOn === true || (forceOn === null && !has)) {
        state.review = [...new Set([...state.review, questionId])];
        isOn = true;
      } else {
        state.review = state.review.filter((id) => id !== questionId);
        isOn = false;
      }
    });
    trackEvent(isOn ? 'bank_review_added' : 'bank_review_removed', { questionId });
    return isOn;
  });
}

/* POST /api/bank/questions/:id/report */
export function reportQuestion(userId, questionId, { reason, note = '' }) {
  return respond(() => {
    mutateState(userId, (state) => {
      state.reports.push({ questionId, reason, note, at: Date.now() });
    });
    trackEvent('bank_question_reported', { questionId, reason });
    /* نسخهٔ سروری هم می‌رود تا بخش بازخورد پنل، منبع «بانک تست» را ببیند؛
       شکست شبکه ثبت محلی بالا را خراب نمی‌کند */
    sendFeedback({
      source: FEEDBACK_SOURCES.testBank,
      subject: reason,
      category: 'گزارش ایراد سؤال',
      message: note,
      meta: { questionId },
    });
    return { ok: true };
  });
}

/* ────────────────────────── API: فیلترهای ذخیره («آزمون من») ────────────────────────── */

export function fetchSavedFilters(userId) {
  return respond(() => loadState(userId).savedFilters);
}

/* POST /api/bank/filters */
export function saveFilterPreset(userId, { name, blueprint }) {
  return respond(() => {
    const preset = {
      id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim() || 'آزمون من',
      blueprint: normalizeFilters(blueprint),
      createdAt: Date.now(),
    };
    mutateState(userId, (state) => {
      state.savedFilters.push(preset);
    });
    trackEvent('bank_filter_saved', { presetId: preset.id });
    return preset;
  });
}

/* DELETE /api/bank/filters/:id */
export function deleteFilterPreset(userId, presetId) {
  return respond(() => {
    mutateState(userId, (state) => {
      state.savedFilters = state.savedFilters.filter((preset) => preset.id !== presetId);
    });
    trackEvent('bank_filter_deleted', { presetId });
    return { ok: true };
  });
}

/* ────────────────────────── API: تاریخچه ────────────────────────── */

export function fetchHistory(userId) {
  return respond(() => ({
    items: latestHistory(loadState(userId), 50),
    bookmarks: loadState(userId).bookmarks.map((id) => questionById(id)).filter(Boolean),
    review: loadState(userId).review.map((id) => questionById(id)).filter(Boolean),
  }));
}

/*
 * GET /api/bank/sessions?status=submitted — همهٔ سشن‌های ثبت‌شدهٔ کاربر (همگام).
 * مصرف‌کنندهٔ اصلی: سرویس تحلیل عملکرد که سشن‌های واقعی را با تاریخچهٔ تحلیل ادغام می‌کند.
 */
export function fetchSubmittedSessions(userId) {
  return loadState(userId).sessions.filter((session) => session.status === 'submitted');
}

/* ────────────────────────── خروجی‌های ثابت برای UI ────────────────────────── */

export {
  BANK_KINDS,
  BANK_YEARS,
  BANK_STATS,
  DIFFICULTIES,
  QUESTION_TYPES,
  QUESTIONS,
  SOURCES,
  SUBJECTS,
  TOPIC_TREE,
  TRACKS,
  bankKindOf,
  trackOf,
};
