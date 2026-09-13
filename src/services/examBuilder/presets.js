/*
 * Presetهای «آزمون‌ساز شخصی» — هر preset یک Configuration واقعی است، نه صرفاً UI.
 * `apply` یک patch روی draft برمی‌گرداند؛ همهٔ مقادیر بعداً توسط کاربر قابل تغییرند
 * (اصل: preset نقطهٔ شروع است، نه قفس).
 */

/* ── برچسب‌های مشترک ── */
export const STATUS_LABELS = {
  unsolved: 'حل‌نشده',
  solved: 'حل‌شده',
  wrong: 'اشتباه قبلی',
  correct: 'صحیح‌سابق',
  bookmarked: 'نشان‌شده',
  review: 'نیاز به مرور',
};

/* تبدیل ارقام به فارسی برای متن‌های داخل سرویس (هشدارها/نُت‌ها) */
export const faDigits = (value) =>
  String(value ?? '').replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit]);

export const DIFFICULTY_LABELS = {
  easy: 'آسان',
  medium: 'متوسط',
  hard: 'سخت',
  very_hard: 'بسیار سخت',
};

export const MODE_LABELS = {
  exam: 'حالت آزمون',
  practice: 'حالت تمرین',
  review: 'حالت مرور',
  simulation: 'شبیه‌سازی واقعی',
};

/* حالت UI → تنظیم واقعی سشن بانک */
export const MODE_PRESETS = {
  exam: { sessionMode: 'exam', durationMode: 'suggested', negative: true, note: 'پاسخ‌ها تا پایان نمایش داده نمی‌شوند؛ کارنامه در انتها.' },
  practice: { sessionMode: 'practice', durationMode: 'none', negative: false, note: 'بعد از هر سؤال، پاسخ صحیح و تحلیل را می‌بینی.' },
  review: { sessionMode: 'practice', durationMode: 'none', negative: false, note: 'حرکت آزاد بین سؤال‌ها برای مرور سریع.' },
  simulation: { sessionMode: 'exam', durationMode: 'custom', negative: true, note: 'زمان، نمرهٔ منفی و بازخورد دقیقاً مثل آزمون واقعی.' },
};

/* ── اهداف آزمون (مرحلهٔ ۱) ── */
export const PURPOSES = [
  {
    id: 'personal',
    label: 'آزمون شخصی',
    description: 'هر ترکیبی که خودت می‌خواهی',
    icon: 'shuffle',
    accent: '#61D192',
    apply: () => ({}),
  },
  {
    id: 'daily-review',
    label: 'مرور روزانه',
    description: 'چند تست کوتاه برای حفظ تداوم',
    icon: 'refresh',
    accent: '#77b787',
    apply: () => ({
      questionCount: 10,
      mode: 'practice',
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 40, medium: 50, hard: 10, very_hard: 0 } },
    }),
  },
  {
    id: 'topic-practice',
    label: 'تمرین یک مبحث',
    description: 'تمرکز عمیق روی یک مبحث خاص',
    icon: 'target',
    accent: '#937fcd',
    apply: () => ({
      questionCount: 15,
      mode: 'practice',
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 25, medium: 50, hard: 25, very_hard: 0 } },
    }),
  },
  {
    id: 'course-summary',
    label: 'جمع‌بندی یک درس',
    description: 'پوشش کل مباحث یک درس',
    icon: 'book',
    accent: '#5b8cc7',
    apply: () => ({
      questionCount: 25,
      mode: 'exam',
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 20, medium: 55, hard: 25, very_hard: 0 } },
    }),
  },
  {
    id: 'comprehensive',
    label: 'آزمون جامع',
    description: 'ترکیبی از چند درس و چند مبحث',
    icon: 'layers',
    accent: '#e0b45c',
    apply: () => ({
      subjectIds: [],
      topicPaths: [],
      questionCount: 30,
      mode: 'exam',
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 20, medium: 50, hard: 30, very_hard: 0 } },
    }),
  },
  {
    id: 'basic-sciences',
    label: 'آمادگی علوم پایه',
    description: 'هم‌سو با سبک آزمون وزارت بهداشت',
    icon: 'calendar',
    accent: '#c9bdf0',
    apply: () => ({
      questionCount: 30,
      mode: 'simulation',
      negativeMarking: true,
      advanced: { sources: ['official', 'comprehensive'] },
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 20, medium: 50, hard: 25, very_hard: 5 } },
    }),
  },
  {
    id: 'olympiad',
    label: 'آمادگی المپیاد',
    description: 'تست‌های دشوار و عمیق مفهومی',
    icon: 'bolt',
    accent: '#ef9196',
    apply: () => ({
      questionCount: 15,
      mode: 'practice',
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 0, medium: 20, hard: 50, very_hard: 30 } },
    }),
  },
  {
    id: 'weakness',
    label: 'رفع نقاط ضعف',
    description: 'تمرکز بر مباحثی که ضعیف‌تری',
    icon: 'chart',
    accent: '#e26d6d',
    apply: () => ({
      weaknessFocus: true,
      questionCount: 20,
      mode: 'practice',
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 20, medium: 50, hard: 30, very_hard: 0 } },
    }),
  },
  {
    id: 'simulation',
    label: 'آزمون شبیه‌سازی‌شده',
    description: 'ساختار، زمان و نمرهٔ منفی واقعی',
    icon: 'timer',
    accent: '#b99a86',
    apply: () => ({
      questionCount: 30,
      mode: 'simulation',
      negativeMarking: true,
      advanced: { sources: ['official'] },
      statuses: { base: 'any', quotas: [] },
    }),
  },
];

/* ── پریست‌های هوشمند مسیر سریع (Hub) ── */
export const SMART_PRESETS = [
  {
    id: 'quick-review',
    label: 'مرور ۲۰ دقیقه‌ای',
    description: '۱۰–۱۵ تست از مباحث اخیر؛ کوتاه و تازه',
    icon: 'timer',
    accent: '#77b787',
    apply: () => ({
      purpose: 'daily-review',
      questionCount: 12,
      mode: 'practice',
      durationMode: 'custom',
      durationMinutes: 20,
      advanced: { yearFrom: 1402 },
    }),
  },
  {
    id: 'daily-exam',
    label: 'آزمون روزانه',
    description: '۲۰ تست ترکیبی از کل بانک',
    icon: 'calendar',
    accent: '#61D192',
    apply: () => ({
      purpose: 'comprehensive',
      questionCount: 20,
      mode: 'exam',
      durationMode: 'suggested',
    }),
  },
  {
    id: 'weakness',
    label: 'رفع نقاط ضعف',
    description: 'تمرکز روی مباحثی که دقتت پایین است',
    icon: 'chart',
    accent: '#e26d6d',
    apply: () => ({
      purpose: 'weakness',
      weaknessFocus: true,
      questionCount: 15,
      mode: 'practice',
    }),
  },
  {
    id: 'comprehensive',
    label: 'آزمون جامع',
    description: 'همهٔ دروس در یک آزمون متوازن',
    icon: 'layers',
    accent: '#e0b45c',
    apply: () => ({
      purpose: 'comprehensive',
      questionCount: 30,
      mode: 'exam',
      durationMode: 'suggested',
      negativeMarking: true,
    }),
  },
  {
    id: 'basic-sciences-sim',
    label: 'شبیه‌سازی علوم پایه',
    description: 'سؤال‌های رسمی، زمان‌دار با نمرهٔ منفی',
    icon: 'target',
    accent: '#937fcd',
    apply: () => ({
      purpose: 'simulation',
      questionCount: 30,
      mode: 'simulation',
      durationMode: 'custom',
      durationMinutes: 60,
      negativeMarking: true,
      advanced: { sources: ['official', 'comprehensive'] },
    }),
  },
  {
    id: 'hard-challenge',
    label: 'چالش سخت',
    description: 'سخت و بسیار سخت؛ برای سنجش سقف',
    icon: 'bolt',
    accent: '#ef9196',
    apply: () => ({
      purpose: 'olympiad',
      questionCount: 15,
      mode: 'exam',
      durationMode: 'suggested',
      difficulty: { mode: 'mixed', level: null, distribution: { easy: 0, medium: 25, hard: 50, very_hard: 25 } },
    }),
  },
];

/* ── عنوان پیش‌فرض آزمون از دل پیکربندی ── */
export function buildExamTitle(config, subjectNames = []) {
  const names = subjectNames.filter(Boolean);
  const purpose = PURPOSES.find((item) => item.id === config.purpose);
  if (config.purpose === 'weakness') return 'آزمون رفع نقاط ضعف';
  if (names.length === 1) return `${purpose?.label ?? 'آزمون شخصی'} — ${names[0]}`;
  if (names.length === 2) return `${purpose?.label ?? 'آزمون شخصی'} — ${names[0]} و ${names[1]}`;
  if (names.length > 2) return `${purpose?.label ?? 'آزمون شخصی'} — ترکیبی از ${names.length} درس`;
  return purpose?.label ?? 'آزمون شخصی من';
}
