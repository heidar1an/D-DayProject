/*
 * کاتالوگ نمایشی آزمون‌ها — فقط متادیتا، بدون هیچ سؤال و کلید پاسخ.
 *
 * تنها مصرف‌کنندهٔ این فایل «مسیر سبز/greenPath» است که به عنوان‌ها و رنگ‌ها
 * نیاز دارد. مرجع حقیقت تعریف آزمون‌ها و زمان‌ها سرور است
 * (`database/examSeed.mjs` ← `examStore`) و این نسخهٔ ثابت فقط برای نمایش است.
 *
 * ⚠️ سؤال‌ها و `correctAnswer` هرگز نباید به فایل‌های کلاینت برگردند —
 * بانک سؤال فقط در سرور زندگی می‌کند (سند امنیتی، PHASE 9).
 */

const DAY = 86400000;
const MINUTE = 60000;
const now = () => Date.now();

function atCleanHour(offsetDays, hour, minute = 0) {
  const date = new Date(Date.now() + offsetDays * DAY);
  date.setHours(hour, minute, 0, 0);
  if (offsetDays === 0 && date.getTime() < Date.now()) date.setDate(date.getDate() + 1);
  return date.getTime();
}

export const EXAMS = [
  {
    id: 'exam-basic-national-01',
    slug: 'basic-sciences-national-01',
    title: 'آزمون جامع هماهنگ علوم پایه تپش',
    shortName: 'جامع علوم پایه',
    type: 'national',
    organizer: 'تیم آزمون تپش',
    description:
      'جامع‌ترین آزمون هماهنگ علوم پایه بین دانشجویان سراسر کشور؛ با سؤال‌های تالیفی هم‌سو با آزمون علوم پایه وزارت بهداشت طراحی شده تا نقطهٔ ایستایی خود را قبل از آزمون اصلی بسنجید.',
    subject: 'علوم پایه پزشکی',
    topics: ['فیزیولوژی', 'بیوشیمی', 'آناتومی', 'بافت‌شناسی', 'جنین‌شناسی', 'ایمونولوژی'],
    difficulty: 'hard',
    audience: 'دانشجویان پزشکی، دندان‌پزشکی و داروسازی',
    level: 'پایان دورهٔ علوم پایه',
    duration: 120,
    questionCount: 100,
    startTime: now() - 30 * MINUTE,
    endTime: now() + 90 * MINUTE,
    participantsCount: 3482,
    universities: ['تهران', 'شهید بهشتی', 'ایران', 'مشهد', 'تبریز', 'شیراز', 'اصفهان', 'سایر دانشگاه‌ها'],
    accent: '#61D192',
    glyph: 'shield',
    featured: true,
  },
  {
    id: 'exam-physio-live-01',
    slug: 'physio-heart-live-01',
    title: 'آزمون هماهنگ فیزیولوژی قلب',
    shortName: 'هماهنگ فیزیولوژی',
    type: 'subject',
    organizer: 'تیم آزمون تپش',
    description:
      'آزمون هماهنگ موضوعی روی فیزیولوژی قلب و گردش خون؛ هم‌زمان با دانشجویان سراسر کشور و با کارنامه و رتبهٔ لحظه‌ای بعد از پایان.',
    subject: 'فیزیولوژی',
    topics: ['فیزیولوژی قلب', 'پتانسیل عمل قلبی', 'چرخهٔ قلبی', 'ECG', 'تنظیم فشار خون'],
    difficulty: 'medium',
    audience: 'دانشجویان علوم پزشکی — ترم ۳ به بالا',
    level: 'میان‌ترم',
    duration: 90,
    questionCount: 8,
    startTime: now() - 32 * MINUTE,
    endTime: now() + 88 * MINUTE,
    participantsCount: 1286,
    accent: '#937fcd',
    glyph: 'orbit',
  },
  {
    id: 'exam-daily-quiz',
    slug: 'daily-quiz',
    title: 'آزمونک روزانه تپش',
    shortName: 'آزمونک روزانه',
    type: 'quiz',
    organizer: 'تیم محتوای تپش',
    description:
      'پنج سؤال کوتاه هر روز از مباحث پرتکرار؛ بدون ثبت‌نام، همیشه در دسترس — برای گرم‌کردن ذهن قبل از مطالعه.',
    subject: 'علوم پایه',
    topics: ['هیبرید دائم', 'چرخهٔ کربس', 'ویتامین‌ها', 'فیزیولوژی عمومی'],
    difficulty: 'easy',
    audience: 'همهٔ دانشجویان علوم پزشکی',
    level: 'متفرقه',
    duration: 5,
    questionCount: 5,
    alwaysAvailable: true,
    startTime: now() - DAY,
    endTime: now() + DAY,
    participantsCount: 5217,
    accent: '#e0b45c',
    glyph: 'spark',
  },
  {
    id: 'exam-biochem-past-01',
    slug: 'biochem-subject-01',
    title: 'آزمون موضوعی بیوشیمی — متابولیسم',
    shortName: 'موضوعی بیوشیمی',
    type: 'subject',
    organizer: 'تیم آزمون تپش',
    description:
      'آزمون موضوعی بیوشیمی با تمرکز روی گلیکولیز، چرخهٔ کربس و متابولیسم انرژی؛ برگزارشده در مرداد ماه.',
    subject: 'بیوشیمی',
    topics: ['گلیکولیز', 'چرخهٔ کربس', 'متساوی‌انرژی', 'ساختار پروتئین'],
    difficulty: 'medium',
    audience: 'دانشجویان پزشکی و دندان‌پزشکی',
    level: 'پایان مبحث',
    duration: 45,
    questionCount: 6,
    startTime: now() - 12 * DAY,
    endTime: now() - 12 * DAY + 45 * MINUTE,
    participantsCount: 842,
    accent: '#77b787',
    glyph: 'delta',
  },
  {
    id: 'exam-basic-mock-aug',
    slug: 'basic-sciences-mock-aug',
    title: 'آزمون آزمایشی علوم پایه مرداد',
    shortName: 'آزمایشی مرداد',
    type: 'mock',
    organizer: 'تیم آزمون تپش',
    description:
      'شبیه‌ساز کامل آزمون علوم پایه وزارت بهداشت با تراز و رتبهٔ کشوری؛ برای سنجش وضعیت قبل از جمع‌بندی.',
    subject: 'علوم پایه پزشکی',
    topics: ['فیزیولوژی', 'بیوشیمی', 'آناتومی'],
    difficulty: 'hard',
    audience: 'دانشجویان علوم پزشکی',
    level: 'شبیه‌ساز رسمی',
    duration: 150,
    questionCount: 120,
    startTime: now() - 26 * DAY,
    endTime: now() - 26 * DAY + 150 * MINUTE,
    participantsCount: 2614,
    accent: '#5b8cc7',
    glyph: 'arch',
  },
  {
    id: 'exam-first-term-01',
    slug: 'first-term-comprehensive-01',
    title: 'آزمون جامع اول ترم — آبان',
    shortName: 'جامع اول ترم',
    type: 'comprehensive',
    organizer: 'تیم آزمون تپش',
    description:
      'آزمون جامع شروع نیم‌سال؛ پوشش مباحث ترم جاری برای جهت‌گیری مطالعه از ابتدای سال تحصیلی. ثبت‌نام به‌زودی باز می‌شود.',
    subject: 'علوم پایه',
    topics: ['فیزیولوژی', 'آناتومی', 'هیستولوژی'],
    difficulty: 'medium',
    audience: 'دانشجویان جدیدالورود و ترم ۲',
    level: 'شروع ترم',
    duration: 90,
    questionCount: 60,
    startTime: atCleanHour(2, 16, 0),
    endTime: atCleanHour(2, 16, 0) + 90 * MINUTE,
    participantsCount: 0,
    accent: '#937fcd',
    glyph: 'compass',
  },
];
