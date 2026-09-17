/*
 * تنظیمات دامنهٔ مسیر سبز.
 *
 * چرا: قوانین برنامه‌ریزی باید یک‌جا قابل تغییر باشند؛ هدف‌ها، نوع فعالیت‌ها و
 * ضریب‌های امتیازدهی نباید داخل کامپوننت یا چند موتور مختلف پخش شوند.
 */

export const GREEN_PATH_STORAGE_KEY = 'tapesh:green-path:v1';
export const GREEN_PATH_API_BASE = '/api/green-path';

export const TASK_TYPES = Object.freeze({
  LEARN: 'LEARN',
  REVIEW: 'REVIEW',
  PRACTICE: 'PRACTICE',
  TEST: 'TEST',
  ANALYZE: 'ANALYZE',
  READ_REFERENCE: 'READ_REFERENCE',
  WIKI_REVIEW: 'WIKI_REVIEW',
  KNOWLEDGE_LINK: 'KNOWLEDGE_LINK',
  FLASHCARD_REVIEW: 'FLASHCARD_REVIEW',
  MOCK_EXAM: 'MOCK_EXAM',
  REST: 'REST',
  BUFFER: 'BUFFER',
});

export const TASK_STATES = Object.freeze({
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  RESCHEDULED: 'rescheduled',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
});

export const GOAL_PROFILES = Object.freeze({
  'semester-excellence': {
    id: 'semester-excellence',
    title: 'کسب معدل الف',
    description: 'پوشش منظم درس‌ها، مرور پیش از امتحان و حفظ ریتم هفتگی.',
    taskMix: { LEARN: 0.34, REVIEW: 0.2, PRACTICE: 0.22, TEST: 0.16, ANALYZE: 0.08 },
    phaseOrder: ['foundation', 'consolidation', 'testing', 'final-review'],
    relevance: { semester: 1, basicSciences: 0.55, exam: 0.85 },
  },
  'university-rank': {
    id: 'university-rank',
    title: 'کسب رتبه برتر دانشگاه',
    description: 'عمق مفهومی، تست ترکیبی، تحلیل خطا و تثبیت قابل‌اندازه‌گیری.',
    taskMix: { LEARN: 0.24, REVIEW: 0.2, PRACTICE: 0.25, TEST: 0.2, ANALYZE: 0.11 },
    phaseOrder: ['foundation', 'consolidation', 'integration', 'testing', 'final-review'],
    relevance: { semester: 0.95, basicSciences: 0.7, exam: 0.9 },
  },
  'basic-sciences': {
    id: 'basic-sciences',
    title: 'آمادگی علوم پایه',
    description: 'پوشش وسیع، مرور چندمرحله‌ای، اتصال بین‌درسی و آزمون‌های شبیه‌ساز.',
    taskMix: { LEARN: 0.22, REVIEW: 0.22, PRACTICE: 0.2, TEST: 0.2, ANALYZE: 0.16 },
    phaseOrder: ['foundation', 'integration', 'testing', 'final-review'],
    relevance: { semester: 0.7, basicSciences: 1, exam: 0.95 },
  },
  'deep-basic-sciences': {
    id: 'deep-basic-sciences',
    title: 'تسلط عمیق بر علوم پایه',
    description: 'یادگیری مفهومی با رفرنس، شبکه دانش و بازآزمایی فاصله‌دار.',
    taskMix: { LEARN: 0.25, REVIEW: 0.2, PRACTICE: 0.2, TEST: 0.17, ANALYZE: 0.18 },
    phaseOrder: ['foundation', 'consolidation', 'integration', 'testing'],
    relevance: { semester: 0.65, basicSciences: 1, exam: 0.9 },
  },
  'catch-up': {
    id: 'catch-up',
    title: 'جبران عقب‌ماندگی',
    description: 'تمرکز روی مباحث پُربازده، پیش‌نیازها و جبران با ظرفیت کنترل‌شده.',
    taskMix: { LEARN: 0.35, REVIEW: 0.2, PRACTICE: 0.2, TEST: 0.15, ANALYZE: 0.1 },
    phaseOrder: ['recovery', 'foundation', 'testing', 'final-review'],
    relevance: { semester: 0.9, basicSciences: 0.6, exam: 1 },
  },
  balanced: {
    id: 'balanced',
    title: 'مطالعه متعادل و مستمر',
    description: 'پیشروی آهسته اما پایدار با مرور و تست در کنار یادگیری.',
    taskMix: { LEARN: 0.3, REVIEW: 0.22, PRACTICE: 0.2, TEST: 0.16, ANALYZE: 0.12 },
    phaseOrder: ['foundation', 'consolidation', 'testing', 'final-review'],
    relevance: { semester: 0.85, basicSciences: 0.65, exam: 0.8 },
  },
});

export const PHASE_META = Object.freeze({
  foundation: { title: 'Foundation', label: 'یادگیری پایه', description: 'ساختن فهم اولیه و عبور از پیش‌نیازها.' },
  consolidation: { title: 'Consolidation', label: 'تثبیت', description: 'مرور فعال و تبدیل مطالعه به یادآوری قابل اتکا.' },
  testing: { title: 'Testing', label: 'تست و تحلیل', description: 'حل تست هدفمند، زمان‌دار و تحلیل خطا.' },
  integration: { title: 'Integration', label: 'اتصال مفاهیم', description: 'وصل‌کردن موضوعات بین درس‌ها فقط وقتی ارزش یادگیری دارد.' },
  recovery: { title: 'Recovery', label: 'جبران کنترل‌شده', description: 'جمع‌کردن عقب‌افتادگی بدون پرکردن خطرناک فردا.' },
  'final-review': { title: 'Final Review', label: 'مرور نهایی', description: 'مرور هدفمند نزدیک به ددلاین و آزمون.' },
});

export const DEFAULT_PLANNING_CONFIG = Object.freeze({
  horizonDays: 28,
  minimumTaskMinutes: 12,
  bufferRatio: 0.2,
  maxRecoveryRatio: 0.25,
  reviewIntervalsDays: [1, 3, 7, 14],
  priorityWeights: {
    importance: 0.17,
    urgency: 0.2,
    weakness: 0.2,
    examWeight: 0.15,
    goalRelevance: 0.14,
    dependency: 0.08,
    historicalError: 0.06,
  },
  readinessWeights: {
    coverage: 0.35,
    accuracy: 0.3,
    revision: 0.2,
    volume: 0.15,
  },
});

export const RECOVERY_MODES = Object.freeze({
  conservative: { label: 'کم‌فشار', maxExtraRatio: 0.1, preserveReview: true },
  balanced: { label: 'متعادل', maxExtraRatio: 0.18, preserveReview: true },
  aggressive: { label: 'سریع', maxExtraRatio: 0.25, preserveReview: false },
});

export const RESOURCE_TYPES = Object.freeze({
  MICRO_LESSON: 'micro_lesson',
  COMPREHENSIVE_LESSON: 'comprehensive_lesson',
  REFERENCE: 'reference',
  QUESTION_BANK: 'question_bank',
  WIKI: 'wiki',
  KNOWLEDGE_NETWORK: 'knowledge_network',
  FLASHCARD: 'flashcard',
  COORDINATED_EXAM: 'coordinated_exam',
});

export const RESOURCE_LABELS = Object.freeze({
  micro_lesson: 'میکرو درسنامه',
  comprehensive_lesson: 'درسنامه جامع',
  reference: 'رفرنس',
  question_bank: 'بانک تست',
  wiki: 'ویکی تپش',
  knowledge_network: 'شبکه دانش',
  flashcard: 'فلش‌کارت',
  coordinated_exam: 'آزمون هماهنگ',
});

/* هویت بصری منابع در مسیر سبز: هر داده از اکوسیستم با بخش و اکسنت خودش دیده می‌شود. */
export const GREEN_PATH_SECTIONS = Object.freeze({
  'course-micro': { id: 'course-micro', label: 'میکرو درسنامه', group: 'courses', accent: 'var(--purple-ink)', shortLabel: 'میکرو' },
  'course-comprehensive': { id: 'course-comprehensive', label: 'درسنامه جامع', group: 'courses', accent: 'var(--blue-ink)', shortLabel: 'جامع' },
  'test-bank': { id: 'test-bank', label: 'بانک تست', group: 'testing', accent: 'var(--green-ink)', shortLabel: 'تست' },
  analytics: { id: 'analytics', label: 'تحلیل عملکرد', group: 'feedback', accent: 'var(--gold-ink)', shortLabel: 'تحلیل' },
  reference: { id: 'reference', label: 'رفرنس', group: 'resources', accent: 'var(--copper-ink)', shortLabel: 'رفرنس' },
  wiki: { id: 'wiki', label: 'ویکی تپش', group: 'resources', accent: 'var(--blue-bright)', shortLabel: 'ویکی' },
  knowledge: { id: 'knowledge', label: 'شبکه دانش', group: 'resources', accent: 'var(--purple-bright)', shortLabel: 'شبکه' },
  flashcards: { id: 'flashcards', label: 'فلش‌کارت', group: 'review', accent: 'var(--rose)', shortLabel: 'فلش' },
  'coordinated-exam': { id: 'coordinated-exam', label: 'آزمون هماهنگ', group: 'testing', accent: 'var(--red-ink)', shortLabel: 'هماهنگ' },
  deadline: { id: 'deadline', label: 'ددلاین', group: 'milestone', accent: 'var(--orange-ink)', shortLabel: 'ددلاین' },
  milestone: { id: 'milestone', label: 'نقطه عطف', group: 'milestone', accent: 'var(--white)', shortLabel: 'هدف' },
});

export const SECTION_BY_TASK_TYPE = Object.freeze({
  LEARN: 'course-micro',
  REVIEW: 'course-comprehensive',
  PRACTICE: 'test-bank',
  TEST: 'test-bank',
  ANALYZE: 'analytics',
  READ_REFERENCE: 'reference',
  WIKI_REVIEW: 'wiki',
  KNOWLEDGE_LINK: 'knowledge',
  FLASHCARD_REVIEW: 'flashcards',
  MOCK_EXAM: 'coordinated-exam',
});

export const COURSE_COLORS = Object.freeze({
  anatomy: 'var(--blue-ink)',
  physiology: 'var(--copper-ink)',
  biochemistry: 'var(--green-ink)',
  histology: 'var(--green-bright)',
  microbiology: 'var(--brown-bright)',
  immunology: 'var(--purple-ink)',
  pathology: 'var(--red-ink)',
  genetics: 'var(--purple-bright)',
  virology: 'var(--rose)',
  mycology: 'var(--brown-bright)',
  parasitology: 'var(--gold-ink)',
  embryology: 'var(--blue-bright)',
  pharmacology: 'var(--purple-ink)',
  hygiene: 'var(--blue-ink)',
  english: 'var(--copper-ink)',
});

export const toFa = (value) => String(value ?? '').replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
