/*
 * سرویس فلش‌کارت تپش — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی Mock با
 * persistence در localStorage (تا مرورها و وضعیت یادگیری کاربر بین رفرش‌ها بماند).
 *
 * قراردادهای آینده (اتصال Backend فقط بدنهٔ این توابع را تغییر می‌دهد):
 *   GET  /api/flashcards/overview            ← آمار امروز + دک‌ها + ضعیف‌ها + پیشنهادها
 *   GET  /api/flashcards/decks               ← دک‌های من + دک‌های تپش
 *   GET  /api/flashcards/library             ← کتابخانهٔ رسمی تپش
 *   GET  /api/flashcards/decks/:id           ← دک + کارت‌ها + وضعیت کاربر
 *   POST /api/flashcards/decks               ← ساخت دک
 *   PATCH/DELETE /api/flashcards/decks/:id
 *   POST /api/flashcards/cards               ← ساخت کارت (تک یا دسته‌ای)
 *   PATCH/DELETE /api/flashcards/cards/:id
 *   GET  /api/flashcards/review/queue?mode=today|deck|weak|cram&deckId=
 *   POST /api/flashcards/review/:cardId/rate ← ثبت ارزیابی + محاسبهٔ مرور بعدی (اعتبارسنجی سمت سرور)
 *   POST /api/flashcards/cards/:id/suspend|unsuspend|bury|bookmark
 *   GET  /api/flashcards/stats
 *   PATCH /api/flashcards/settings
 *   POST /api/flashcards/events              ← Analytics
 *
 * اصول:
 *   - محاسبات الگوریتم فقط در spacedRepetition.js انجام می‌شود؛ اینجا فقط orchestration است.
 *   - دادهٔ محتوایی کارت (Flashcard) از وضعیت یادگیری کاربر (UserCardState) کاملاً جدا است.
 *   - هیچ reward یا امتیازی از سمت Frontend قابل جعل نیست؛ در نسخهٔ سرور، ارزیابی با
 *     اعتبارسنجی ثبت می‌شود و ReviewLog نسخهٔ الگوریتم را حمل می‌کند.
 */

import {
  SEED_USER_CARDS,
  SEED_USER_DECK,
  SMART_SUGGESTIONS,
  SUBJECTS,
  TAPESH_CARDS,
  TAPESH_DECKS,
} from './mockData';
import {
  ALGORITHM_VERSION,
  DEFAULT_ALGORITHM_CONFIG,
  INITIAL_USER_STATE,
  INITIAL_USER_STATE as freshState,
  computeMastery,
  isDue,
  isMastered,
  previewIntervals,
  rate,
  startOfLocalDay,
} from './spacedRepetition';

const STORAGE_KEY = 'tapesh:flashcards:v1';
const LATENCY_MS = 420;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function respond(build) {
  await delay(LATENCY_MS + Math.random() * 180);
  return build();
}

/* ── لایهٔ ذخیره‌سازی (در نسخهٔ واقعی: Backend) ── */

let simulateFailure = false;
/* برای تست حالت خطا از کنسول: __flashcardService.__setFailure(true) */
export function __setFailure(next) {
  simulateFailure = next;
}

/* کش درون‌حافظه — منبع حقیقت نشست. اگر localStorage بنویسد و پر باشد (مثلاً
 * با حجم صدا/تصویر زیاد) خواندن‌های بعدی دادهٔ کهنه برنمی‌گردانند؛ وگرنه
 * «افزودن شد ولی در فهرست نمی‌آمد» اتفاق می‌افتاد. */
let storeCache = null;

function readStore() {
  if (storeCache) return storeCache;
  if (typeof window === 'undefined') return {};
  try {
    storeCache = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') ?? {};
  } catch {
    storeCache = {};
  }
  return storeCache;
}

function writeStore(store) {
  storeCache = store;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* حافظه پر یا غیرفعال — نشست جاری در حافظه ادامه می‌یابد؛ فقط ماندگاری
       بین رفرش‌ها کم می‌شود (در نسخهٔ واقعی: Sync-Queue سمت سرور) */
  }
}

/* Sync Queue — آماده‌سازی برای Offline Mode: هر تغییر کاربر در همین صف ثبت و
 * در نسخهٔ واقعی با بازگشت اینترنت به سرور ارسال می‌شود. */
let pendingOps = [];

function flushPending() {
  pendingOps = [];
}

const userKey = (userData) => `u:${userData?.id ?? 'guest'}`;

function getUserSpace(userData) {
  const store = readStore();
  if (!store[userKey(userData)]) {
    store[userKey(userData)] = seedUserSpace(userData);
    writeStore(store);
  }
  return store[userKey(userData)];
}

function mutateUserSpace(userData, mutator) {
  const store = readStore();
  const key = userKey(userData);
  if (!store[key]) store[key] = seedUserSpace(userData);
  mutator(store[key]);
  writeStore(store);
  flushPending();
  return store[key];
}

/* ── Seed اولیه: یک دک تپش اضافه‌شده + یک دک شخصی + تاریخچهٔ مرور زنده ── */

function stateFor(patch = {}) {
  return { ...INITIAL_USER_STATE, ...patch };
}

function seedReviewHistory(space) {
  /* ۲۱ روز گذشته: روزهای مطالعه‌شده، صحت و زمان پاسخ — برای آمار، استریک و هیت‌مپ */
  const logs = [];
  const now = startOfLocalDay();
  const studiedDays = [1, 2, 3, 5, 6, 7, 9, 10, 13, 14]; // روز قبل از امروز؛ استریک فعلی: ۳ روز
  let seed = 7;

  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  studiedDays.forEach((daysAgo) => {
    const count = 6 + Math.floor(rand() * 16);
    for (let i = 0; i < count; i += 1) {
      const ratingPool = ['good', 'good', 'good', 'easy', 'hard', 'again'];
      const rating = ratingPool[Math.floor(rand() * ratingPool.length)];
      logs.push({
        id: `log-seed-${daysAgo}-${i}`,
        userId: space.userId,
        cardId: `c-ph-00${(i % 8) + 1}`,
        deckId: 'deck-physio-heart',
        rating,
        previousState: 'review',
        newState: rating === 'again' ? 'relearning' : 'review',
        previousInterval: 3 * 24 * 60,
        newInterval: rating === 'again' ? 10 : 4 * 24 * 60,
        timeSpent: 8000 + Math.floor(rand() * 9000),
        reviewedAt: now - daysAgo * 24 * 60 * 60 * 1000 + (8 + (i % 8)) * 60 * 60 * 1000,
        algorithmVersion: ALGORITHM_VERSION,
        mode: 'today',
      });
    }
  });
  space.reviewLogs = [...space.reviewLogs, ...logs];
}

function seedUserSpace(userData) {
  const now = Date.now();
  const userId = userData?.id ?? 'guest';
  const libraryAdded = ['deck-physio-heart'];

  const cardStates = {};
  /* فیزیولوژی قلب: ترکیب واقع‌نمایانه از حالت‌ها برای داشبورد زنده */
  const physioStates = {
    'c-ph-001': { state: 'review', dueAt: now - 26 * 60 * 60 * 1000, lastReviewedAt: now - 4.3 * 24 * 60 * 60 * 1000, reviewCount: 4, correctCount: 3, incorrectCount: 1, intervalMinutes: 4 * 24 * 60, easeFactor: 2.36, masteryScore: 58 },
    'c-ph-002': { state: 'learning', dueAt: now - 18 * 60 * 1000, lastReviewedAt: now - 30 * 60 * 1000, reviewCount: 2, correctCount: 1, incorrectCount: 1, intervalMinutes: 10, learningStep: 1, masteryScore: 22 },
    'c-ph-004': { state: 'review', dueAt: now + 2.2 * 60 * 60 * 1000, lastReviewedAt: now - 1.8 * 24 * 60 * 60 * 1000, reviewCount: 3, correctCount: 3, intervalMinutes: 3 * 24 * 60, masteryScore: 64 },
    'c-ph-006': { state: 'review', dueAt: now + 21 * 24 * 60 * 60 * 1000, lastReviewedAt: now - 24 * 24 * 60 * 60 * 1000, reviewCount: 6, correctCount: 6, intervalMinutes: 24 * 24 * 60, masteryScore: 94 },
    'c-ph-007': { state: 'review', dueAt: now - 3.4 * 24 * 60 * 60 * 1000, lastReviewedAt: now - 7.2 * 24 * 60 * 60 * 1000, reviewCount: 5, correctCount: 4, incorrectCount: 1, lapseCount: 1, intervalMinutes: 5 * 24 * 60, masteryScore: 49 },
    'c-ph-008': { state: 'review', dueAt: now + 40 * 60 * 1000, lastReviewedAt: now - 2.9 * 24 * 60 * 60 * 1000, reviewCount: 3, correctCount: 3, intervalMinutes: 3 * 24 * 60, masteryScore: 66 },
    'c-ph-010': { state: 'review', dueAt: now + 5 * 24 * 60 * 60 * 1000, lastReviewedAt: now - 2 * 24 * 60 * 60 * 1000, reviewCount: 2, correctCount: 2, intervalMinutes: 5 * 24 * 60, masteryScore: 71 },
    'c-ph-011': { state: 'learning', dueAt: now + 6 * 60 * 1000, lastReviewedAt: now - 12 * 60 * 1000, reviewCount: 1, correctCount: 0, incorrectCount: 1, intervalMinutes: 10, learningStep: 1, masteryScore: 14 },
    'c-ph-012': { state: 'review', dueAt: now - 9 * 60 * 60 * 1000, lastReviewedAt: now - 3.6 * 24 * 60 * 60 * 1000, reviewCount: 4, correctCount: 3, incorrectCount: 1, intervalMinutes: 4 * 24 * 60, masteryScore: 55 },
  };
  Object.entries(physioStates).forEach(([cardId, patch]) => {
    cardStates[cardId] = stateFor({ ...patch, masteryScore: computeMastery({ ...freshState, ...patch }, now) || patch.masteryScore, updatedAt: now });
  });

  /* دک شخصی «اشتباهات من» */
  cardStates['c-us-001'] = stateFor({
    state: 'relearning', dueAt: now - 45 * 60 * 1000, lastReviewedAt: now - 75 * 60 * 1000,
    reviewCount: 7, correctCount: 4, incorrectCount: 3, lapseCount: 3,
    intervalMinutes: 10, learningStep: 0, easeFactor: 2.1, difficulty: 0.62,
    updatedAt: now,
  });
  cardStates['c-us-001'].masteryScore = computeMastery({ ...freshState, reviewCount: 7, correctCount: 4, incorrectCount: 3, lapseCount: 3, intervalMinutes: 10, state: 'relearning' }, now);
  cardStates['c-us-002'] = stateFor({ state: 'review', dueAt: now + 2 * 24 * 60 * 60 * 1000, lastReviewedAt: now - 2.1 * 24 * 60 * 60 * 1000, reviewCount: 3, correctCount: 2, incorrectCount: 1, lapseCount: 1, intervalMinutes: 3 * 24 * 60, updatedAt: now });
  cardStates['c-us-002'].masteryScore = computeMastery({ ...freshState, reviewCount: 3, correctCount: 2, lapseCount: 1, intervalMinutes: 3 * 24 * 60, state: 'review' }, now);

  /* دک‌های کتابخانهٔ تپش که هنوز اضافه نشده‌اند: state ندارند — با «افزودن» seed می‌شوند */

  const space = {
    userId,
    decks: [SEED_USER_DECK],
    /* کارت‌های محتواییِ ساختهٔ کاربر — کارت‌های دک‌های تپش در mockData می‌مانند */
    userCards: [...SEED_USER_CARDS],
    libraryAdded,
    cardStates,
    reviewLogs: [],
    settings: {
      newCardsPerDay: 20,
      maxReviewsPerDay: 100,
      desiredRetention: 0.9,
      showSource: true,
      keyboardShortcuts: true,
      autoPlayAudio: false,
      textSize: 'medium',
      algorithmConfig: {}, // Override الگوریتم در سطح کاربر — خالی = پیش‌فرض موتور
    },
  };
  seedReviewHistory(space);
  return space;
}

/* ── مجموعهٔ کامل کارت‌ها (تپش + کاربر) ── */

function allCards(space) {
  const tapeshCards = TAPESH_CARDS.filter((card) => space.libraryAdded.includes(card.deckId));
  return [...tapeshCards, ...space.userCards];
}

function cardById(space, cardId) {
  return allCards(space).find((card) => card.id === cardId) ?? null;
}

function activeStates(space) {
  const now = Date.now();
  return Object.entries(space.cardStates).filter(([, state]) => !state.suspended && state.state !== 'archived');
}

/* ── آمار یک مجموعه کارت ── */

function summarizeStates(space, cardIds) {
  const now = Date.now();
  const stats = { total: cardIds.length, new: 0, learning: 0, review: 0, mastered: 0, due: 0, suspended: 0, bookmarked: 0, masterySum: 0, masteryCount: 0 };

  cardIds.forEach((cardId) => {
    const state = space.cardStates[cardId];
    if (!state) {
      stats.new += 1;
      return;
    }
    if (state.suspended) stats.suspended += 1;
    if (state.bookmarked) stats.bookmarked += 1;
    if (state.state === 'new' || !state.dueAt) stats.new += 1;
    else if (state.state === 'learning' || state.state === 'relearning') stats.learning += 1;
    else if (isMastered(state)) stats.mastered += 1;
    else stats.review += 1;

    if (isDue(state, now)) stats.due += 1;
    if (state.masteryScore > 0) {
      stats.masterySum += state.masteryScore;
      stats.masteryCount += 1;
    }
  });

  stats.mastery = stats.masteryCount ? Math.round(stats.masterySum / stats.masteryCount) : 0;
  return stats;
}

function lastReviewOf(space, cardIds) {
  let latest = null;
  cardIds.forEach((cardId) => {
    const at = space.cardStates[cardId]?.lastReviewedAt;
    if (at && (!latest || at > latest)) latest = at;
  });
  return latest;
}

function deckStats(space, deck) {
  const cards = allCards(space).filter((card) => card.deckId === deck.id && card.status === 'active');
  const stats = summarizeStates(space, cards.map((card) => card.id));
  return {
    ...deck,
    cardCount: stats.total,
    new: stats.new,
    learning: stats.learning,
    due: stats.due,
    mastered: stats.mastered,
    mastery: stats.mastery,
    bookmarked: stats.bookmarked,
    lastReviewedAt: lastReviewOf(space, cards.map((card) => card.id)),
  };
}

/* ── استریک، صحت و ماندگاری از ReviewLog ── */

function computeStreak(reviewLogs) {
  const days = new Set(reviewLogs.map((log) => startOfLocalDay(log.reviewedAt)));
  const today = startOfLocalDay();
  let streak = 0;
  let cursor = days.has(today) ? today : today - 24 * 60 * 60 * 1000;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

function computePerformance(reviewLogs) {
  const real = reviewLogs.filter((log) => log.mode !== 'cram');
  const total = real.length;
  const again = real.filter((log) => log.rating === 'again').length;
  const correct = total - again;
  const avgTime = total ? real.reduce((sum, log) => sum + (log.timeSpent ?? 0), 0) / total : 11000;
  return {
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    retention: total ? Math.round(((total - again) / total) * 100) : 0,
    avgTimeSpent: avgTime,
    totalReviews: total,
  };
}

/* ── مباحث ضعیف: میانگین تسلط هر topic ── */

function computeWeakTopics(space, minCards = 2) {
  const topics = {};
  allCards(space).forEach((card) => {
    if (!card.topicId) return;
    topics[card.topicId] ??= { topicId: card.topicId, subjectId: card.subjectId, cardIds: [] };
    topics[card.topicId].cardIds.push(card.id);
  });

  return Object.values(topics)
    .filter((topic) => topic.cardIds.length >= minCards)
    .map((topic) => {
      const stats = summarizeStates(space, topic.cardIds);
      return {
        topicId: topic.topicId,
        subjectId: topic.subjectId,
        cardCount: stats.total,
        mastery: stats.mastery,
      };
    })
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 4);
}

/* ── محدودیت‌های روزانه ── */

function todayProgress(space) {
  const todayStart = startOfLocalDay();
  const todayLogs = space.reviewLogs.filter((log) => log.reviewedAt >= todayStart && log.mode !== 'cram');
  const introducedNew = todayLogs.filter((log) => log.previousState === 'new').length;
  const reviewsDone = todayLogs.length;
  return { introducedNew, reviewsDone };
}

/* ── صف مرور: اولویت‌بندی بر اساس احتمال فراموشی، نه تصادف ── */

function buildQueue(space, { mode = 'today', deckId = null } = {}) {
  const now = Date.now();
  const settings = space.settings;
  let cards = allCards(space).filter((card) => card.status === 'active');

  if (deckId) cards = cards.filter((card) => card.deckId === deckId);
  if (mode === 'cram') {
    /* مرور آزاد: همهٔ کارت‌های فعال، ترتیب تصادفی — بدون تغییر زمان‌بندی */
    return shuffle(cards).map((card) => ({ card, state: space.cardStates[card.id] ?? stateFor(), mode }));
  }

  const dueCards = [];
  const newCards = [];
  cards.forEach((card) => {
    const state = space.cardStates[card.id] ?? stateFor();
    if (state.suspended || (state.buriedUntil && state.buriedUntil > now)) return;

    if (state.state === 'new' || !space.cardStates[card.id]) {
      if (mode !== 'weak') newCards.push({ card, state });
      return;
    }
    if (isDue(state, now) || state.state === 'learning' || state.state === 'relearning') {
      dueCards.push({ card, state });
    } else if (mode === 'weak' && (state.masteryScore ?? 0) < 50) {
      dueCards.push({ card, state });
    }
  });

  const { introducedNew, reviewsDone } = todayProgress(space);
  const reviewBudget = Math.max(0, settings.maxReviewsPerDay - reviewsDone);
  const newBudget = Math.max(0, settings.newCardsPerDay - introducedNew);

  /* ترتیب: گام‌های یادگیری عقب‌افتاده → مرورهای overdue (قدیمی‌ترین) → کارت‌های ضعیف */
  dueCards.sort((a, b) => {
    const aLearning = a.state.state === 'learning' || a.state.state === 'relearning' ? 0 : 1;
    const bLearning = b.state.state === 'learning' || b.state.state === 'relearning' ? 0 : 1;
    if (aLearning !== bLearning) return aLearning - bLearning;
    const aMastery = a.state.masteryScore ?? 100;
    const bMastery = b.state.masteryScore ?? 100;
    if (Math.abs(aMastery - bMastery) > 10) return aMastery - bMastery; // ضعیف‌تر اول
    return (a.state.dueAt ?? 0) - (b.state.dueAt ?? 0); // overdue قدیمی‌تر اول
  });

  const limitedDue = dueCards.slice(0, mode === 'today' ? reviewBudget : dueCards.length);
  const limitedNew = mode === 'today' ? newCards.slice(0, newBudget) : newCards;

  /* کارت‌های جدید بین مرورها پخش می‌شوند تا خستگی دسته‌ای نشود */
  const queue = [];
  const newStride = limitedNew.length ? Math.max(1, Math.floor(limitedDue.length / Math.max(1, limitedNew.length))) : 0;
  let newIdx = 0;
  limitedDue.forEach((item, index) => {
    queue.push({ ...item, mode });
    if (newStride && index > 0 && index % newStride === 0 && newIdx < limitedNew.length) {
      queue.push({ ...limitedNew[newIdx], mode });
      newIdx += 1;
    }
  });
  queue.push(...limitedNew.slice(newIdx).map((item) => ({ ...item, mode })));

  return queue;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ═══════════════ API ═══════════════ */

/* GET /api/flashcards/overview */
export function fetchOverview(userData) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    const now = Date.now();

    const deckList = space.decks
      .map((deck) => deckStats(space, deck))
      .concat(space.libraryAdded.map((id) => TAPESH_DECKS.find((deck) => deck.id === id)).filter(Boolean).map((deck) => deckStats(space, deck)));

    const allCardIds = allCards(space).filter((card) => card.status === 'active').map((card) => card.id);
    const totals = summarizeStates(space, allCardIds);
    const queue = buildQueue(space, { mode: 'today' });
    const performance = computePerformance(space.reviewLogs);
    const streak = computeStreak(space.reviewLogs);
    const weakTopics = computeWeakTopics(space);

    const estimatedMinutes = Math.max(1, Math.round((queue.length * (performance.avgTimeSpent || 11000)) / 60000));

    return {
      today: {
        due: queue.filter((item) => item.state.state !== 'new').length,
        new: queue.filter((item) => item.state.state === 'new').length,
        total: queue.length,
        estimatedMinutes,
        plan: {
          review: queue.filter((item) => ['review', 'learning', 'relearning'].includes(item.state.state)).length,
          weak: queue.filter((item) => (item.state.masteryScore ?? 100) < 45).length,
          new: queue.filter((item) => item.state.state === 'new').length,
        },
      },
      counts: {
        totalCards: totals.total,
        dueToday: totals.due,
        newCards: totals.new,
        learning: totals.learning,
        review: totals.review,
        mastered: totals.mastered,
        suspended: totals.suspended,
        bookmarked: totals.bookmarked,
        mastery: totals.mastery,
      },
      streak,
      performance,
      weakTopics,
      decks: deckList,
      suggestions: SMART_SUGGESTIONS,
      limits: { ...todayProgress(space), newCardsPerDay: space.settings.newCardsPerDay, maxReviewsPerDay: space.settings.maxReviewsPerDay },
      generatedAt: now,
    };
  });
}

/* GET /api/flashcards/decks — فقط دک‌های من + دک‌های تپشِ اضافه‌شده */
export function fetchMyDecks(userData) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    return {
      userDecks: space.decks.map((deck) => deckStats(space, deck)),
      tapeshDecks: space.libraryAdded
        .map((id) => TAPESH_DECKS.find((deck) => deck.id === id))
        .filter(Boolean)
        .map((deck) => deckStats(space, deck)),
      subjects: SUBJECTS,
      colors: undefined, // رنگ‌ها از DECK_COLORS در UI import می‌شوند
    };
  });
}

/* GET /api/flashcards/library — کتابخانهٔ رسمی تپش */
export function fetchLibrary(userData) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    return {
      decks: TAPESH_DECKS.map((deck) => ({
        ...deck,
        added: space.libraryAdded.includes(deck.id),
        cardCount: TAPESH_CARDS.filter((card) => card.deckId === deck.id).length,
      })),
    };
  });
}

/* POST /api/flashcards/library/:deckId/add — افزودن دک تپش + seed وضعیت‌های جدید */
export function addLibraryDeck(userData, deckId) {
  return respond(() => {
    mutateUserSpace(userData, (space) => {
      if (!space.libraryAdded.includes(deckId)) space.libraryAdded.push(deckId);
    });
    return { ok: true };
  });
}

/* POST /api/flashcards/library/:deckId/remove */
export function removeLibraryDeck(userData, deckId) {
  return respond(() => {
    mutateUserSpace(userData, (space) => {
      space.libraryAdded = space.libraryAdded.filter((id) => id !== deckId);
      space.decks = space.decks;
      /* کارت‌های دک حذف نمی‌شوند؛ فقط از دسترس خارج می‌شوند (immutability محتوای تپش) */
    });
    return { ok: true };
  });
}

/* GET /api/flashcards/decks/:id */
export function fetchDeck(userData, deckId) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    const deck = space.decks.find((item) => item.id === deckId)
      ?? TAPESH_DECKS.find((item) => item.id === deckId && space.libraryAdded.includes(deckId));
    if (!deck) throw new Error('deck-not-found');

    const cards = allCards(space)
      .filter((card) => card.deckId === deckId && card.status === 'active')
      .map((card) => ({
        ...card,
        userState: space.cardStates[card.id] ?? stateFor(),
      }));

    return {
      deck: deckStats(space, deck),
      cards,
      preview: previewIntervals(stateFor(), space.settings.algorithmConfig),
    };
  });
}

/* POST /api/flashcards/decks */
export function createDeck(userData, draft) {
  return respond(() => {
    const deck = {
      id: `deck-user-${Date.now().toString(36)}`,
      userId: userData?.id ?? 'guest',
      title: draft.title.trim(),
      description: draft.description?.trim() ?? '',
      type: 'user',
      visibility: draft.visibility ?? 'private',
      subjectId: draft.subjectId ?? 'general',
      level: null,
      cover: draft.cover ?? '#5b8cc7',
      byTapesh: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mutateUserSpace(userData, (space) => {
      space.decks.push(deck);
    });
    return deck;
  });
}

/* PATCH /api/flashcards/decks/:id */
export function updateDeck(userData, deckId, patch) {
  return respond(() => {
    let updated = null;
    mutateUserSpace(userData, (space) => {
      const deck = space.decks.find((item) => item.id === deckId);
      if (!deck) return;
      Object.assign(deck, patch, { updatedAt: new Date().toISOString() });
      updated = deck;
    });
    if (!updated) throw new Error('deck-not-found');
    return updated;
  });
}

/* DELETE /api/flashcards/decks/:id — دک کاربر حذف می‌شود؛ دک تپش فقط از کتابخانه خارج می‌شود */
export function deleteDeck(userData, deckId) {
  return respond(() => {
    mutateUserSpace(userData, (space) => {
      space.decks = space.decks.filter((deck) => deck.id !== deckId);
      space.libraryAdded = space.libraryAdded.filter((id) => id !== deckId);
      const removedIds = space.userCards.filter((card) => card.deckId === deckId).map((card) => card.id);
      space.userCards = space.userCards.filter((card) => card.deckId !== deckId);
      removedIds.forEach((id) => delete space.cardStates[id]);
    });
    return { ok: true };
  });
}

/* ── اشتراک مجموعه با لینک — فقط میان کاربران ثبت‌نام‌شدهٔ تپش ──
 * ساختار آیندهٔ Backend:
 *   POST /api/flashcards/decks/:id/share  ← توکن اشتراک می‌سازد
 *   POST /api/flashcards/shares/redeem    ← گیرنده با توکن به مجموعه دسترسی پیدا می‌کند
 * در نسخهٔ Mock، توکن‌ها در localStorage مشترک می‌مانند تا جریان «لینک → دریافت»
 * بین دو حساب همان مرورگر قابل آزمودن باشد.
 */

const SHARE_KEY = 'tapesh:flashcards:shares:v1';

function readShares() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(SHARE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeShares(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHARE_KEY, JSON.stringify(list));
  } catch {
    /* حافظه پر — ساخت لینک این بار شکست خورده؛ UI پیام خطا می‌دهد */
  }
}

const requireTapeshUser = (userData) => {
  if (!userData?.id) throw new Error('tapesh-user-required');
  return userData.id;
};

/* POST /api/flashcards/decks/:id/share */
export function createDeckShare(userData, deckId) {
  return respond(() => {
    const ownerId = requireTapeshUser(userData);
    const space = getUserSpace(userData);
    const deck = space.decks.find((item) => item.id === deckId);
    if (!deck) throw new Error('deck-not-found');

    const token = `fcshare-${deckId.replace(/^deck-/, '').slice(0, 12)}-${Math.random().toString(36).slice(2, 10)}`;
    writeShares([...readShares(), { token, deckId, ownerId, createdAt: Date.now() }]);
    return { token, deckTitle: deck.title };
  });
}

/* POST /api/flashcards/shares/redeem — ورودی: توکن یا خودِ لینک کامل */
export function redeemDeckShare(userData, input) {
  return respond(() => {
    const recipientId = requireTapeshUser(userData);
    const raw = String(input ?? '').trim();
    const match = raw.match(/share=([A-Za-z0-9-]+)/);
    const token = match ? match[1] : raw;
    const share = readShares().find((item) => item.token === token);
    if (!share) throw new Error('share-not-found');

    /* فضای مالک — بدون seed؛ اگر حساب مالک در این مرورگر نیست، لینک بی‌اعتبار است */
    const ownerSpace = readStore()[`u:${share.ownerId}`];
    const ownerDeck = ownerSpace?.decks?.find((item) => item.id === share.deckId);
    if (!ownerSpace || !ownerDeck) throw new Error('share-not-found');

    let result = null;
    mutateUserSpace(userData, (space) => {
      /* هر لینک فقط یک‌بار به فهرست گیرنده اضافه می‌شود */
      if (space.decks.some((item) => item.sharedFromToken === token)) {
        result = { already: true, deckTitle: ownerDeck.title };
        return;
      }
      const stamp = Date.now().toString(36);
      const sharedDeck = {
        ...ownerDeck,
        id: `deck-shared-${stamp}`,
        userId: recipientId,
        byTapesh: false,
        visibility: 'shared',
        sharedFromToken: token,
        sharedFromUserId: share.ownerId,
        updatedAt: new Date().toISOString(),
      };
      space.decks.push(sharedDeck);

      const ownerCards = ownerSpace.userCards.filter((card) => card.deckId === share.deckId && card.status === 'active');
      ownerCards.forEach((card, index) => {
        const copy = { ...card, id: `card-shared-${stamp}-${index}`, deckId: sharedDeck.id };
        space.userCards.push(copy);
        space.cardStates[copy.id] = stateFor();
      });
      result = { already: false, deckTitle: sharedDeck.title, cardCount: ownerCards.length };
    });
    return result;
  });
}

/* POST /api/flashcards/cards */
export function createCard(userData, deckId, draft) {
  return respond(() => {
    const media = draft.media ?? (draft.imageUrl ? { imageUrl: draft.imageUrl } : null);
    const cleanMedia =
      media && (media.frontImageUrl || media.backImageUrl || media.imageUrl || media.audioUrl)
        ? {
            frontImageUrl: media.frontImageUrl ?? null,
            backImageUrl: media.backImageUrl ?? null,
            imageUrl: media.imageUrl ?? null,
            audioUrl: media.audioUrl ?? null,
          }
        : null;
    const card = {
      id: `card-user-${Date.now().toString(36)}`,
      deckId,
      type: draft.type ?? 'basic',
      front: draft.front.trim(),
      back: draft.back.trim(),
      hint: draft.hint?.trim() || null,
      media: cleanMedia,
      tags: (draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      subjectId: draft.subjectId ?? null,
      topicId: draft.topicId ?? null,
      source: draft.source ?? { sourceType: 'user', sourceId: null, title: null, url: null },
      language: draft.language ?? 'fa',
      status: 'active',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      /* گزینه‌های کارت چهارگزینه‌ای — بدون این، کارت MCQ تازه‌ساخته در مرور گزینه‌هایش را از دست می‌دهد */
      ...(Array.isArray(draft.options) && draft.options.length ? { options: draft.options } : {}),
    };
    /* کارت تصویری می‌تواند بی‌متن باشد (عکس نقش صورت را دارد)؛ پاسخ کلوز همان جای خالی‌های
       صورت کارت است و توضیحش اختیاری؛ بقیه به صورت+پاسخ متنی نیاز دارند */
    if (!card.front && !card.media?.frontImageUrl) throw new Error('front-required');
    if (!card.back && card.type !== 'mcq' && card.type !== 'cloze') throw new Error('back-required');
    if (card.type === 'image' && !card.media?.frontImageUrl) throw new Error('image-required');

    mutateUserSpace(userData, (space) => {
      space.userCards.push(card);
      space.cardStates[card.id] = stateFor();
    });
    return card;
  });
}

/* PATCH /api/flashcards/cards/:id */
export function updateCard(userData, cardId, patch) {
  return respond(() => {
    let updated = null;
    mutateUserSpace(userData, (space) => {
      const card = space.userCards.find((item) => item.id === cardId);
      if (card) {
        Object.assign(card, patch, { updatedAt: new Date().toISOString() });
        updated = { ...card };
        return;
      }
      /* ویرایش کارت تپش: نسخهٔ کاربر محفوظ می‌ماند (نسخه‌بندی card.version) */
      const tapeshCard = TAPESH_CARDS.find((item) => item.id === cardId);
      if (tapeshCard) {
        const local = { ...tapeshCard, ...patch, version: tapeshCard.version + 1, updatedAt: new Date().toISOString() };
        const index = space.userCards.findIndex((item) => item.id === cardId);
        if (index >= 0) space.userCards[index] = local;
        else space.userCards.push(local);
        updated = local;
      }
    });
    if (!updated) throw new Error('card-not-found');
    return updated;
  });
}

/* DELETE /api/flashcards/cards/:id — فقط کارت‌های کاربر؛ کارت تپش فقط آرشیو */
export function deleteCard(userData, cardId) {
  return respond(() => {
    mutateUserSpace(userData, (space) => {
      const card = space.userCards.find((item) => item.id === cardId);
      if (card && card.source?.sourceType === 'user') {
        space.userCards = space.userCards.filter((item) => item.id !== cardId);
        delete space.cardStates[cardId];
      } else {
        archiveCardInternal(space, cardId, true);
      }
    });
    return { ok: true };
  });
}

function archiveCardInternal(space, cardId, archived) {
  const card = space.userCards.find((item) => item.id === cardId);
  if (card) {
    card.status = archived ? 'archived' : 'active';
    card.updatedAt = new Date().toISOString();
  }
  if (space.cardStates[cardId]) {
    space.cardStates[cardId].state = archived ? 'archived' : 'new';
  }
}

/* POST /api/flashcards/cards/:id/archive | unarchive */
export function setCardArchived(userData, cardId, archived) {
  return respond(() => {
    mutateUserSpace(userData, (space) => archiveCardInternal(space, cardId, archived));
    return { ok: true };
  });
}

/* GET /api/flashcards/review/queue?mode=&deckId= */
export function fetchReviewQueue(userData, { mode = 'today', deckId = null } = {}) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    const queue = buildQueue(space, { mode, deckId });
    return {
      mode,
      deckId,
      items: queue.map(({ card, state }) => ({ card, state })),
      preview: previewIntervals(stateFor(), space.settings.algorithmConfig),
      settings: space.settings,
    };
  });
}

/* POST /api/flashcards/review/:cardId/rate */
export function rateCard(userData, cardId, rating, { timeSpent = 0, mode = 'today', deckId = null } = {}) {
  return respond(() => {
    const now = Date.now();
    let result = null;

    mutateUserSpace(userData, (space) => {
      const config = space.settings.algorithmConfig;
      const current = space.cardStates[cardId] ?? stateFor();

      if (mode === 'cram') {
        /* مرور آزاد: فقط ثبت لاگ — زمان‌بندی واقعی تغییر نمی‌کند */
        space.reviewLogs.push({
          id: `log-${now}-${Math.random().toString(36).slice(2, 7)}`,
          userId: space.userId,
          cardId,
          deckId,
          rating,
          previousState: current.state,
          newState: current.state,
          previousInterval: current.intervalMinutes,
          newInterval: current.intervalMinutes,
          timeSpent,
          reviewedAt: now,
          algorithmVersion: ALGORITHM_VERSION,
          mode,
        });
        result = { state: current, changed: false };
        return;
      }

      const { next, log } = rate(current, rating, config, now);
      space.cardStates[cardId] = next;
      space.reviewLogs.push({
        id: `log-${now}-${Math.random().toString(36).slice(2, 7)}`,
        userId: space.userId,
        cardId,
        deckId,
        ...log,
        timeSpent,
        reviewedAt: now,
        algorithmVersion: ALGORITHM_VERSION,
        mode,
      });
      result = { state: next, changed: true };
    });

    return {
      cardId,
      state: result.state,
      changed: result.changed,
      nextDueAt: result.state.dueAt,
      masteryScore: result.state.masteryScore,
    };
  });
}

/* POST /api/flashcards/cards/:id/suspend | unsuspend */
export function setCardSuspended(userData, cardId, suspended) {
  return respond(() => {
    mutateUserSpace(userData, (space) => {
      const state = space.cardStates[cardId] ?? stateFor();
      state.suspended = suspended;
      state.updatedAt = Date.now();
      space.cardStates[cardId] = state;
    });
    return { ok: true };
  });
}

/* POST /api/flashcards/cards/:id/bury — تا پایان روز از صف خارج می‌شود (با سوسپند فرق دارد) */
export function buryCard(userData, cardId) {
  return respond(() => {
    mutateUserSpace(userData, (space) => {
      const state = space.cardStates[cardId] ?? stateFor();
      const endOfDay = startOfLocalDay() + 24 * 60 * 60 * 1000;
      state.buriedUntil = endOfDay;
      state.updatedAt = Date.now();
      space.cardStates[cardId] = state;
    });
    return { ok: true };
  });
}

/* POST /api/flashcards/cards/:id/bookmark — گلچین (مستقل از وضعیت یادگیری) */
export function setCardBookmarked(userData, cardId, bookmarked) {
  return respond(() => {
    mutateUserSpace(userData, (space) => {
      const state = space.cardStates[cardId] ?? stateFor();
      state.bookmarked = bookmarked;
      state.updatedAt = Date.now();
      space.cardStates[cardId] = state;
    });
    return { ok: true };
  });
}

/* GET /api/flashcards/cards?query=&filters= — جستجو و فیلتر سراسری */
export function searchCards(userData, { query = '', deckId = null, tag = null, state = null, bookmarked = null } = {}) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    const q = query.trim().toLowerCase();

    let cards = allCards(space).filter((card) => card.status === 'active');

    if (deckId) cards = cards.filter((card) => card.deckId === deckId);
    if (q) {
      cards = cards.filter((card) =>
        [card.front, card.back, card.hint ?? '', (card.tags ?? []).join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    if (tag) cards = cards.filter((card) => (card.tags ?? []).includes(tag));

    const withState = cards.map((card) => {
      const userState = space.cardStates[card.id] ?? stateFor();
      return { ...card, userState };
    });

    let filtered = withState;
    if (state === 'bookmarked') filtered = filtered.filter((card) => card.userState.bookmarked);
    else if (state === 'due') filtered = filtered.filter((card) => isDue(card.userState));
    else if (state) filtered = filtered.filter((card) => card.userState.state === state);

    if (bookmarked === true) filtered = filtered.filter((card) => card.userState.bookmarked);

    return { items: filtered, total: filtered.length };
  });
}

/* GET /api/flashcards/stats */
export function fetchStats(userData) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    const performance = computePerformance(space.reviewLogs);
    const streak = computeStreak(space.reviewLogs);

    /* شمارش روزانهٔ ۴۲ روز اخیر برای نمودار و تقویم ۵ هفته‌ایِ تراز با روزهای هفته */
    const todayStart = startOfLocalDay();
    const daily = [];
    for (let i = 41; i >= 0; i -= 1) {
      const dayStart = todayStart - i * 24 * 60 * 60 * 1000;
      const dayLogs = space.reviewLogs.filter((log) => log.reviewedAt >= dayStart && log.reviewedAt < dayStart + 24 * 60 * 60 * 1000);
      daily.push({
        date: dayStart,
        count: dayLogs.length,
        correct: dayLogs.filter((log) => log.rating !== 'again').length,
      });
    }

    const allCardIds = allCards(space).filter((card) => card.status === 'active').map((card) => card.id);
    const totals = summarizeStates(space, allCardIds);

    return {
      daily,
      streak,
      performance,
      counts: totals,
      weakTopics: computeWeakTopics(space),
    };
  });
}

/* PATCH /api/flashcards/settings */
export function updateSettings(userData, patch) {
  return respond(() => {
    let settings = null;
    mutateUserSpace(userData, (space) => {
      space.settings = { ...space.settings, ...patch };
      settings = space.settings;
    });
    return settings;
  });
}

/* GET /api/flashcards/settings */
export function fetchSettings(userData) {
  return respond(() => {
    if (simulateFailure) {
      simulateFailure = false;
      throw new Error('network-error');
    }
    const space = getUserSpace(userData);
    return {
      settings: space.settings,
      algorithmVersion: ALGORITHM_VERSION,
      algorithmDefaults: DEFAULT_ALGORITHM_CONFIG,
    };
  });
}

/* ── ورود داده (Import) — خروجی متنی انکی و CSV/TSV ──
 * انکی در مسیر File › Export نوع «Text separated by …» می‌دهد: سطرهای
 * «جلو<جداکننده>پاسخ» با سرخط‌های اختیاری #separator / #html / #tags column.
 * بستهٔ .apkg (پایگاه‌دادهٔ sqlite فشرده) در مرورگر بدون موتور SQL باز نمی‌شود؛
 * مسیر پشتیبانی‌شده همان خروجی متنی رسمی انکی است.
 */

const ANKI_SEPARATORS = { tab: '\t', comma: ',', semicolon: ';', pipe: '|', colon: ':', space: ' ' };
const IMPORT_LIMIT = 500;

/* جداکننده را از سرخط #separator یا سِنیگ نخستین سطر داده تشخیص می‌دهد */
function detectAnkiSeparator(lines) {
  for (const line of lines) {
    if (!line.startsWith('#')) break;
    const match = /^#separator:\s*['"]?([\w-]+)['"]?/i.exec(line);
    if (match) return ANKI_SEPARATORS[match[1].toLowerCase()] ?? null;
  }
  const sample = lines.find((line) => line.trim() && !line.startsWith('#')) ?? '';
  const candidates = ['\t', ';', '|', ','].map((sep) => [sep, sample.split(sep).length - 1]);
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : '\t';
}

/* جداسازی فیلدها با پشتیبانی نقل‌قول RFC («""» = گیومه داخل متن) */
function splitAnkiFields(line, separator) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i += 1; }
        else inQuotes = false;
      } else current += char;
    } else if (char === '"' && current === '') inQuotes = true;
    else if (char === separator) { fields.push(current); current = ''; }
    else current += char;
  }
  fields.push(current);
  return fields;
}

/* متن خام خروجی انکی → فهرست کارت‌های خام؛ بدون وابستگی به DOM و localStorage */
export function parseAnkiText(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const lines = raw.split(/\r?\n/);
  const separator = detectAnkiSeparator(lines);
  const cards = [];

  for (const line of lines) {
    if (cards.length >= IMPORT_LIMIT) break;
    if (!line.trim() || line.startsWith('#')) continue;

    const fields = splitAnkiFields(line, separator);
    const front = fields[0].replace(/<br\s*\/?>/gi, '\n').trim();
    if (!front) continue;
    const back = (fields[1] ?? '').replace(/<br\s*\/?>/gi, '\n').trim();
    /* ستون سوم انکی در خروجیِ همراه تگ، خودِ تگ‌هاست */
    const tags = (fields[2] ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);

    cards.push({
      type: /\{\{c\d+::/.test(front) ? 'cloze' : 'basic',
      front,
      back,
      tags,
    });
  }
  return cards;
}

/* POST /api/flashcards/import — ورود دسته‌ای کارت به یک مجموعه */
export function importCards(userData, deckId, cards) {
  return respond(() => {
    if (!deckId) throw new Error('deck-required');
    const now = new Date().toISOString();
    let imported = 0;

    mutateUserSpace(userData, (space) => {
      cards.slice(0, IMPORT_LIMIT).forEach((draft) => {
        const front = String(draft.front ?? '').trim();
        if (!front) return;
        const card = {
          id: `card-user-${Date.now().toString(36)}-${imported}`,
          deckId,
          type: draft.type ?? 'basic',
          front,
          back: String(draft.back ?? '').trim(),
          hint: null,
          media: null,
          tags: (draft.tags ?? []).filter(Boolean),
          subjectId: null,
          topicId: null,
          source: { sourceType: 'import', sourceId: null, title: 'ورود از فایل', url: null },
          language: 'fa',
          status: 'active',
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        space.userCards.push(card);
        space.cardStates[card.id] = stateFor();
        imported += 1;
      });
    });

    return { imported };
  });
}

/* — Analytics stub — رویدادهای flashcard_view, review_start, review_complete,
 * card_rated, card_created, deck_created, suggestion_accepted … */
export function trackEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[flashcards:track] ${name}`, payload);
  }
}
