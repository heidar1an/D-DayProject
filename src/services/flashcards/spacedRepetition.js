/*
 * موتور Spaced Repetition تپش — کاملاً مستقل از UI و Service.
 *
 * اصول:
 *   - ورودی/خروجی داده خالص است؛ هیچ وابستگی به React یا localStorage ندارد.
 *   - الگوریتم در ALGORITHM_CONFIG متمرکز است و از نسخه (algorithmVersion) پشتیبانی می‌کند؛
 *     در آینده SM-2 → FSRS یا الگوریتم اختصاصی تپش با تغییر همین فایل اضافه می‌شود.
 *   - UI هرگز مستقیماً محاسبات فاصله را انجام نمی‌دهد؛ فقط از previewRating خروجی می‌گیرد.
 *
 * الهام: SM-2 (SuperMemo) با گام‌های یادگیری سبک Anki + فاکتور سادگی (ease) و بازپروری (lapse).
 */

export const ALGORITHM_VERSION = 'sm2-tapesh-v1';

/* ⚙️ پیکربندی پیش‌فرض الگوریتم — از پنل تنظیمات کاربر قابل Override است */
export const DEFAULT_ALGORITHM_CONFIG = {
  learningStepsMinutes: [10, 1440], // گام‌های یادگیری: ۱۰ دقیقه، ۱ روز
  relearningStepsMinutes: [10], // گام‌های یادگیری مجدد
  graduatingIntervalDays: 4, // فاصله اول پس از فارغ‌التحصیلی از گام‌ها (Good)
  easyIntervalDays: 10, // فاصله اول برای Easy
  startingEase: 2.5,
  easyBonus: 1.3, // ضریب Easy روی فاصله عادی
  hardFactor: 1.2, // ضریب Hard روی فاصله عادی
  intervalModifier: 1.0, // ضریب سراسری — برای تنظیم retention هدف (FSRS-style)
  maxIntervalDays: 365,
  minEase: 1.3,
  lapseEasePenalty: 0.2,
  newIntervalAfterLapseDays: 1,
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export const RATINGS = ['again', 'hard', 'good', 'easy'];

export const INITIAL_USER_STATE = {
  state: 'new',
  dueAt: null,
  lastReviewedAt: null,
  reviewCount: 0,
  lapseCount: 0,
  correctCount: 0,
  incorrectCount: 0,
  easeFactor: DEFAULT_ALGORITHM_CONFIG.startingEase,
  stability: 0,
  difficulty: 0.3,
  intervalMinutes: 0,
  learningStep: 0,
  suspended: false,
  buriedUntil: null,
  bookmarked: false,
  masteryScore: 0,
  updatedAt: null,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isLearningState = (state) => state === 'learning' || state === 'relearning';

/* ظرف یادگیری تمام نشده؟ (فاصله بعدی ≤ آخرین گام روزانه → همان روز می‌ماند) */
function stepDuration(config, steps, stepIndex) {
  const minutes = steps[stepIndex];
  if (minutes == null) return config.graduatingIntervalDays * 24 * 60;
  return minutes;
}

/*
 * محاسبه اصلی: وضعیت کارت + ارزیابی کاربر → وضعیت و زمان مرور بعدی.
 * ورودی state باید UserCardState باشد (مقادیر new کارت نو را نشان می‌دهد).
 */
export function rate(state, rating, configOverride = {}, now = Date.now()) {
  const config = { ...DEFAULT_ALGORITHM_CONFIG, ...configOverride };
  const prev = { ...state };
  const prevInterval = prev.intervalMinutes ?? 0;
  const prevEase = prev.easeFactor ?? config.startingEase;
  let nextState;
  let nextDue;
  let intervalMinutes;
  let ease = prevEase;
  let learningStep = prev.learningStep ?? 0;

  if (rating === 'again') {
    /* lapse — کارت برمی‌گردد به ابتدای چرخه یادگیری (بدون حس شکست؛ بخشی از فرایند است) */
    ease = clamp(prevEase - config.lapseEasePenalty, config.minEase, 5);
    const steps = prev.state === 'relearning' || isLearningState(prev.state)
      ? config.relearningStepsMinutes
      : config.relearningStepsMinutes; // هر دو حالت به گام‌های relearning برمی‌گردند
    learningStep = 0;
    nextState = 'relearning';
    intervalMinutes = stepDuration(config, steps, 0);
    nextDue = now + intervalMinutes * MINUTE;
  } else if (isLearningState(prev.state) || prev.state === 'new') {
    /* هنوز در گام‌های یادگیری */
    const steps = prev.state === 'relearning'
      ? config.relearningStepsMinutes
      : config.learningStepsMinutes;

    if (rating === 'hard') {
      learningStep = Math.max(0, learningStep); // در همان گام می‌ماند
      intervalMinutes = stepDuration(config, steps, learningStep);
      nextState = prev.state === 'new' ? 'learning' : prev.state;
      nextDue = now + Math.max(intervalMinutes, 6) * MINUTE;
    } else if (rating === 'good') {
      learningStep += 1;
      if (learningStep >= steps.length) {
        // فارغ‌التحصیل → مرور عادی
        nextState = 'review';
        intervalMinutes = config.graduatingIntervalDays * 24 * 60;
        nextDue = now + intervalMinutes * MINUTE;
      } else {
        nextState = prev.state === 'new' ? 'learning' : prev.state;
        intervalMinutes = stepDuration(config, steps, learningStep);
        nextDue = now + intervalMinutes * MINUTE;
      }
    } else {
      // easy — پرش مستقیم به مرور با فاصله آسان
      nextState = 'review';
      intervalMinutes = config.easyIntervalDays * 24 * 60;
      nextDue = now + intervalMinutes * MINUTE;
    }
  } else {
    /* حالت مرور عادی — SM-2 کلاسیک روی فاصله فعلی */
    const currentDays = Math.max(prevInterval / (24 * 60), 1);
    let factor;
    if (rating === 'hard') {
      ease = clamp(prevEase - 0.15, config.minEase, 5);
      factor = config.hardFactor;
    } else if (rating === 'good') {
      factor = 1; // رشد واقعی = ease
    } else {
      ease = clamp(prevEase + 0.1, config.minEase, 5);
      factor = config.easyBonus;
    }

    const grown = rating === 'good' ? currentDays * ease : currentDays * factor;
    const baseDays = prev.reviewCount <= 1 && rating !== 'hard'
      ? config.graduatingIntervalDays
      : Math.max(grown, config.graduatingIntervalDays);
    const days = clamp(Math.round(baseDays * config.intervalModifier), 1, config.maxIntervalDays);

    nextState = 'review';
    intervalMinutes = days * 24 * 60;
    nextDue = now + days * DAY;
  }

  const next = {
    ...prev,
    state: nextState,
    dueAt: nextDue,
    lastReviewedAt: now,
    reviewCount: prev.reviewCount + 1,
    lapseCount: prev.lapseCount + (rating === 'again' ? 1 : 0),
    correctCount: prev.correctCount + (rating === 'again' ? 0 : 1),
    incorrectCount: prev.incorrectCount + (rating === 'again' ? 1 : 0),
    easeFactor: ease,
    stability: clamp(intervalMinutes / (24 * 60), 0, config.maxIntervalDays),
    difficulty: clamp(prev.difficulty + (rating === 'again' ? 0.12 : rating === 'hard' ? 0.06 : rating === 'easy' ? -0.06 : 0), 0, 1),
    intervalMinutes,
    learningStep: isLearningState(nextState) ? learningStep : 0,
    suspended: false,
    buriedUntil: null,
    updatedAt: now,
    masteryScore: computeMastery({ ...prev, state: nextState, intervalMinutes, lapseCount: prev.lapseCount + (rating === 'again' ? 1 : 0), correctCount: prev.correctCount + (rating === 'again' ? 0 : 1), reviewCount: prev.reviewCount + 1 }, now),
  };

  return { next, log: { rating, previousState: prev.state, newState: nextState, previousInterval: prevInterval, newInterval: intervalMinutes } };
}

/*
 * امتیاز تسلط ۰ تا ۱۰۰ — ترکیبی از صحت، ماندگاری (فاصله فعلی)، حجم مرور و تازگی.
 * فرمول در اینجا متمرکز است تا در آینده با FSRS جایگزین/بهینه شود.
 */
export function computeMastery(state, now = Date.now()) {
  if (!state || state.state === 'new') return 0;
  if (state.state === 'mastered') return 100;

  const reviews = Math.max(1, state.reviewCount ?? 1);
  const accuracy = (state.correctCount ?? 0) / reviews;
  const stability = clamp((state.intervalMinutes ?? 0) / (60 * 24 * 30), 0, 1); // ۱ ماه = سقف
  const lapses = clamp((state.lapseCount ?? 0) / reviews, 0, 1);
  const difficultyPenalty = (state.difficulty ?? 0) * 0.15;

  const daysSinceReview = state.lastReviewedAt ? (now - state.lastReviewedAt) / DAY : 0;
  const recency = clamp(1 - daysSinceReview / 60, 0, 1); // ۲ ماه = سرد شدن کامل

  const raw = accuracy * 55 + stability * 30 + recency * 15 - lapses * 10 - difficultyPenalty;
  return Math.round(clamp(raw, 0, 100));
}

/*
 * پیش‌نمایش فاصله برای دکمه‌های ارزیابی (مثل «۱۰د» زیر دکمه Easy در Anki)
 * بدون تغییر وضعیت واقعی کارت.
 */
export function previewIntervals(state, configOverride = {}, now = Date.now()) {
  const preview = {};
  for (const rating of RATINGS) {
    const { next } = rate(state, rating, configOverride, now);
    preview[rating] = next.intervalMinutes;
  }
  return preview;
}

/* «۱۸ / ۴۲» و «۴ روز» و «۱۰ دقیقه» — قالب‌بندی خوانا برای UI */
export function formatInterval(minutes, toFa) {
  if (minutes == null) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${toFa(m)} دقیقه`;
  if (m < 60 * 24) return `${toFa(Math.round(m / 60))} ساعت`;
  const days = m / (60 * 24);
  if (days < 30) return `${toFa(Math.round(days))} روز`;
  if (days < 365) return `${toFa(Math.round(days / 30))} ماه`;
  return `${toFa(Math.round(days / 365))} سال`;
}

/* برچسب حالت یادگیری برای UI */
export const STATE_LABELS = {
  new: 'جدید',
  learning: 'در حال یادگیری',
  review: 'در حال مرور',
  relearning: 'یادگیری مجدد',
  mastered: 'تسلط یافته',
  suspended: 'معلق',
  archived: 'آرشیو',
};

/* آیا کارت الان Due است؟ */
export function isDue(state, now = Date.now()) {
  if (!state || state.suspended) return false;
  if (state.buriedUntil && state.buriedUntil > now) return false;
  if (state.state === 'new') return true;
  return (state.dueAt ?? Infinity) <= now;
}

/* آیا کارت «تسلط‌یافته» حساب می‌شود؟ (masteryScore + فاصله بلند) */
export function isMastered(state) {
  return (state?.masteryScore ?? 0) >= 85 && (state?.intervalMinutes ?? 0) >= 21 * 24 * 60;
}

/* شروع روز محلی برای مرز «امروز» در محدودیت‌های روزانه */
export function startOfLocalDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
