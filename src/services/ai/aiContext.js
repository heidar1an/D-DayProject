/*
 * سرویس Context هوشمند تپش.
 *
 * هر بخش داشبورد (بانک تست، درسنامه، فلش‌کارت، ...) می‌تواند با یک فراخوان بگوید
 * کاربر الان کجاست؛ AI Card بر اساس همین Context پیشنهادها و Placeholder را عوض می‌کند
 * و در درخواست چت هم برای مدل ارسال می‌شود.
 *
 * استفاده در آینده (مثلاً داخل بانک تست):
 *   setAIContext({ page: 'question-bank', subject: 'physiology', topic: 'cardiovascular', questionId: 'q-41' });
 *   ... و هنگام ترک صفحه: clearAIContext();
 *
 * Personalization (سطح کاربر، مباحث ضعیف، تست‌های غلط) در فیلد user جمع می‌شود؛
 * فعلاً خالی است و بعداً از userData داشبورد پر می‌شود — UI به شکل این فیلد وابسته نیست.
 */

const listeners = new Set();

const DEFAULT_CONTEXT = {
  page: 'dashboard-other', /* بخش «سایر بخش‌ها» */
  source: 'dashboard',
  subject: null,
  topic: null,
  questionId: null,
  lessonId: null,
  flashcardId: null,
  user: {
    level: null,
    weakTopics: [],
    wrongQuestionIds: [],
    progress: null,
  },
};

let currentContext = DEFAULT_CONTEXT;

export function getAIContext() {
  return currentContext;
}

export function setAIContext(patch) {
  currentContext = { ...currentContext, ...patch };
  listeners.forEach((listener) => listener(currentContext));
}

export function clearAIContext() {
  currentContext = DEFAULT_CONTEXT;
  listeners.forEach((listener) => listener(currentContext));
}

export function subscribeAIContext(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ── پیشنهادهای Context-aware ─────────────────────────────────────────────── */

const CONTEXT_SUGGESTIONS = {
  'question-bank': [
    { label: 'این تست را برایم تحلیل کن', prompt: 'این تست را قدم‌به‌قدم برایم تحلیل کن' },
    { label: 'چرا این گزینه درست است؟', prompt: 'چرا گزینهٔ درست، درست است و بقیه چرا اشتباه؟' },
    { label: 'از این مبحث ۱۰ تست بساز', prompt: 'از همین مبحث ۱۰ تست شبیه آزمون بساز' },
  ],
  lesson: [
    { label: 'این قسمت را ساده توضیح بده', prompt: 'این قسمت از درسنامه را ساده و ریشه‌ای توضیح بده' },
    { label: 'از این بخش فلش‌کارت بساز', prompt: 'از این بخش درسنامه فلش‌کارت بساز' },
    { label: 'از این مطلب تست بساز', prompt: 'از این مطلب چند تست بساز' },
  ],
  flashcard: [
    { label: 'این کارت را بهتر توضیح بده', prompt: 'این کارت را با مثال ساده‌تر توضیح بده' },
    { label: 'از این مبحث کارت بیشتری بساز', prompt: 'از همین مبحث کارت‌های بیشتری بساز' },
    { label: 'برنامهٔ مرور این کارت‌ها', prompt: 'برای مرور این کارت‌ها برنامهٔ تکرار بچین' },
  ],
  default: [
    { label: 'یک مفهوم پزشکی را ساده توضیح بده', prompt: 'یک مفهوم مهم پزشکی را ساده توضیح بده' },
    { label: 'از فیزیولوژی برایم تست بساز', prompt: 'از فیزیولوژی قلب چند تست بساز' },
    { label: 'این سؤال را تحلیل کن', prompt: 'این سؤال را قدم‌به‌قدم تحلیل کن' },
    { label: 'برای امتحانم برنامه بده', prompt: 'برای امتحانم برنامهٔ مطالعهٔ این هفته بچین' },
  ],
};

export function getContextSuggestions(context = getAIContext()) {
  return CONTEXT_SUGGESTIONS[context.page] ?? CONTEXT_SUGGESTIONS.default;
}
