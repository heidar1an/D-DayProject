/*
 * دادهٔ محتوایی «بانک تست علوم پایه تپش» — لایهٔ CONTENT.
 *
 * اصل جدایی داده: این فایل فقط محتوای عمومی بانک (درس، درخت مبحث، سؤال، تحلیل، آمار جامعه)
 * را نگه می‌دارد. هیچ وضعیت وابسته به کاربر (پاسخ، گلچین، نیاز به مرور، تاریخچه) اینجا نیست؛
 * آن‌ها در testBankService.js و localStorage هر کاربر ذخیره می‌شوند.
 *
 * شکل رکورد سؤال (قرارداد پایدار — با اتصال Backend همین شکل از API می‌آید):
 *   id | subject (id از SUBJECTS) | track (رشته) | topicPath (مسیر سلسله‌مراتبی) | type
 *   difficulty | year | source (kind بانک از آن مشتق می‌شود) | tags | stem | figure
 *   options
 *   stats { solves, correctPercent, avgTimeSec }
 *   createdAt | updatedAt
 *
 * ⚠️ PHASE 2 — **کلید پاسخ اینجا نیست.** پیش‌تر این فایل `correctAnswer`،
 * `explanation` و `stats.optionPercents` را داشت و چون در Bundle مرورگر می‌رفت،
 * هر کاربری با DevTools پاسخ درست همهٔ سؤال‌ها را می‌دید. اکنون:
 *
 *   • بانک کامل (با کلید) → `database/testBankSeed.mjs` (فقط سرور)
 *   • این فایل             → فرادادهٔ سؤال بدون کلید
 *   • کلید در زمان اجرا از `/api/users/test-bank/answers` و **فقط پس از ثبت
 *     پاسخ** برمی‌گردد و روی همان شیء سؤال می‌نشیند (بازگشایی کنترل‌شده).
 *
 * پس `question.correctAnswer` تا وقتی کاربر پاسخ نداده `undefined` است. هیچ
 * کدی نباید از نبودنش نتیجهٔ «نادرست» بگیرد.
 *
 * دو محور طبقه‌بندی محتوا (هر دو از فیلدهای خود رکورد مشتق می‌شوند، نه لیست جدا):
 *   bankKind (نوع بانک)  → national «کشوری» (official/comprehensive) | authored «تالیفی» (tapesh)
 *   track (رشته)         → medicine «علوم پایه پزشکی» | dentistry «علوم پایه دندان‌پزشکی»
 *
 * سؤال‌ها تالیفی تیم محتوای تپش و نمونه‌سازی هم‌سو با آزمون علوم پایه وزارت بهداشت‌اند؛
 * در نسخهٔ واقعی این بانک از سرور تغذیه می‌شود و آمار جامعه از Results محاسبه خواهد شد.
 */

/* ────────────────────────── دروس علوم پایه (SUBJECTS) ────────────────────────── */

export const SUBJECTS = [
  { id: 'physiology', name: 'فیزیولوژی', accent: '#937fcd', topics: true },
  { id: 'anatomy', name: 'آناتومی', accent: '#5b8cc7', topics: true },
  { id: 'biochemistry', name: 'بیوشیمی', accent: '#77b787', topics: true },
  { id: 'microbiology', name: 'میکروب‌شناسی', accent: '#ab8e7c', topics: true },
  { id: 'immunology', name: 'ایمنی‌شناسی', accent: '#61D192', topics: false },
  { id: 'pathology', name: 'پاتولوژی', accent: '#e0b45c', topics: false },
  { id: 'virology', name: 'ویروس‌شناسی', accent: '#ef9196', topics: false },
  { id: 'mycology', name: 'قارچ‌شناسی', accent: '#b99a86', topics: false },
  { id: 'parasitology', name: 'انگل‌شناسی', accent: '#d5bba9', topics: false },
  { id: 'genetics', name: 'ژنتیک', accent: '#c9bdf0', topics: false },
  { id: 'histology', name: 'بافت‌شناسی', accent: '#8fbcd4', topics: false },
  { id: 'esl', name: 'زبان تخصصی', accent: '#9aa5b1', topics: false },
];

const subjectById = (id) => SUBJECTS.find((subject) => subject.id === id) ?? null;

/* ────────────────────────── درخت مبحث (TOPIC TREE) ────────────────────────── */

/*
 * درخت سلسله‌مراتبی چندسطحی: subject → topic → subtopic (و قابل تعمیم به سطح‌های بعد).
 * فقط شاخه‌هایی که در بانک سؤال دارند فعلاً فهرست شده‌اند؛ سطح‌های جدید با افزودن
 * children (و حتی زیرِ زیرمبحث) بدون تغییر UI پشتیبانی می‌شوند.
 */
export const TOPIC_TREE = {
  physiology: [
    {
      name: 'قلب و عروق',
      children: ['الکتروفیزیولوژی قلب', 'چرخهٔ قلبی', 'ECG', 'تنظیم فشار خون'],
    },
    {
      name: 'تنفس',
      children: ['حجم‌ها و ظرفیت‌های ریوی', 'انتقال گازها'],
    },
    {
      name: 'کلیه',
      children: ['فیزیولوژی لوله‌های نفرون', 'تعادل اسید-باز'],
    },
    {
      name: 'عصب',
      children: ['سیناپس و گیرنده‌ها', 'سیستم عصبی خودکار'],
    },
    { name: 'گوارش', children: ['هورمون‌های گوارشی'] },
    { name: 'غدد درون‌ریز', children: ['غدهٔ تیروئید'] },
    { name: 'خون', children: ['انعقاد خون'] },
    { name: 'عضله', children: ['فیزیولوژی انقباض'] },
    { name: 'غدد بزاقی', children: ['ترشح و تنظیم بزاق'] },
  ],
  anatomy: [
    {
      name: 'اندام فوقانی',
      children: ['اعصاب اندام فوقانی', 'استخوان‌شناسی', 'ناحیهٔ سرشانه و براکیال پلکسوس'],
    },
    { name: 'قلب و توراکس', children: ['آناتومی قلب', 'دیافراگم'] },
    { name: 'اندام تحتانی', children: ['اعصاب اندام تحتانی'] },
    { name: 'شکم و لگن', children: ['کانال اینگوینال'] },
    { name: 'سر و گردن', children: ['ترایگل‌های گردن', 'عصب سه‌قلو و شاخه‌ها'] },
    { name: 'نوروآناتومی', children: ['سیستم بینایی', 'عروق مغز'] },
  ],
  biochemistry: [
    { name: 'آنزیم‌ها', children: ['سینتیک آنزیمی', 'مهارکننده‌های آنزیمی'] },
    {
      name: 'متابولیسم کربوهیدرات',
      children: ['گلیکولیز و گلوکونئوژنز', 'شنت هگزوز مونوفسفات'],
    },
    { name: 'متابولیسم لیپید', children: ['سنتز اسید چرب'] },
    { name: 'بیوشیمی مولکولی', children: ['ترجمهٔ پروتئین', 'جهش‌ها', 'ساختار کلاژن'] },
    { name: 'ویتامین‌ها', children: ['ویتامین‌های محلول در چربی'] },
    { name: 'تعادل اسید-باز', children: ['بافرها'] },
    { name: 'چرخهٔ اوره', children: [] },
  ],
  histology: [
    { name: 'بافت‌شناسی دهان و دندان', children: ['مینا و عاج', 'مخاط دهان'] },
    { name: 'بافت پوششی', children: ['اپیتلیوم‌ها'] },
  ],
  microbiology: [
    { name: 'باکتری‌های گرم مثبت', children: ['استافیلوکوک', 'استرپتوکوک'] },
    { name: 'باکتری‌های گرم منفی', children: ['آنتروباکتریاسه'] },
  ],
  immunology: [
    { name: 'پاسخ ایمنی هومورال', children: ['ایمونوگلوبولین‌ها'] },
    { name: 'ایمنی سلولی', children: ['لنفوسیت T'] },
  ],
  pathology: [{ name: 'پاتولوژی دهان', children: ['ضایعات پیش‌بدخیم'] }],
};

/* ────────────────────────── متادیتای سؤال ────────────────────────── */

export const QUESTION_TYPES = {
  single: { label: 'تک‌گزینه‌ای' },
  concept: { label: 'مفهومی' },
  memorization: { label: 'حفظی' },
  calculation: { label: 'محاسباتی' },
  clinical: { label: 'بالینی' },
  image: { label: 'شکل‌محور' },
  combined: { label: 'ترکیبی' },
};

export const DIFFICULTIES = {
  easy: { label: 'آسان', accent: '#77b787', dots: 1 },
  medium: { label: 'متوسط', accent: '#e0b45c', dots: 2 },
  hard: { label: 'سخت', accent: '#ef9196', dots: 3 },
  very_hard: { label: 'بسیار سخت', accent: '#e26d6d', dots: 4 },
};

export const SOURCES = {
  official: { label: 'آزمون علوم پایه وزارت بهداشت', accent: '#937fcd' },
  comprehensive: { label: 'آزمون جامع علوم پایه', accent: '#5b8cc7' },
  tapesh: { label: 'تألیفی تپش', accent: '#61D192' },
};

/* ────────────────────────── نوع بانک (کشوری / تالیفی) ────────────────────────── */

/*
 * محور اول طبقه‌بندی: منبع هر سؤال به یکی از دو «بانک» نگاشت می‌شود.
 *   national = سؤال‌های آزمون‌های کشوری (وزارت بهداشت + جامع)
 *   authored = سؤال‌های تألیفی اختصاصی تیم محتوای تپش
 * این نگاشت تنها جای تعریف رابطهٔ منبع↔بانک است؛ UI و فیلترها از خود رکورد
 * سؤال (source) به bankKind می‌رسند و هیچ‌جا لیست دستی نگه‌داری نمی‌شود.
 */
export const BANK_KINDS = {
  national: {
    label: 'بانک تست کشوری',
    short: 'کشوری',
    accent: '#937fcd',
    description: 'سؤال‌های رسمی آزمون‌های کشوری علوم پایه (وزارت بهداشت و جامع)',
  },
  authored: {
    label: 'بانک تست تألیفی',
    short: 'تألیفی',
    accent: '#61D192',
    description: 'سؤال‌های تألیفی اختصاصی تیم محتوای تپش، هم‌سو با سبک آزمون کشوری',
  },
};

export const SOURCE_BANK = {
  official: 'national',
  comprehensive: 'national',
  tapesh: 'authored',
};

/* ────────────────────────── رشته (پزشکی / دندان‌پزشکی) ────────────────────────── */

/*
 * محور دوم طبقه‌بندی: هر سؤال به یک رشته تعلق دارد تا سؤال‌های علوم پایهٔ
 * پزشکی و دندان‌پزشکی از هم جدا شوند. در نسخهٔ واقعی، محتوای مشترک دو رشته
 * می‌تواند با دو رکورد (یا فیلد چندمقداری) از سرور بیاید؛ اینجا برای سادگی
 * هر سؤال یک رشته دارد و درخت مبحث هم به‌ازای هر رشته ساخته می‌شود.
 */
export const TRACKS = {
  medicine: { label: 'علوم پایه پزشکی', short: 'پزشکی', accent: '#5b8cc7' },
  dentistry: { label: 'علوم پایه دندان‌پزشکی', short: 'دندان‌پزشکی', accent: '#e0b45c' },
};

export const BANK_YEARS = [1398, 1399, 1400, 1401, 1402, 1403, 1404];

/* ────────────────────────── سؤال‌های بانک (QUESTIONS) ────────────────────────── */

export const QUESTIONS = [
  {
    "id": "tb-phy-01",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1399,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "صدای اول قلب (S1) عمدتاً به بسته‌شدن کدام دریچه‌ها مربوط است؟",
    "figure": null,
    "options": [
      "دریچه‌های میترال و سه‌لختی (AV) در ابتدای سیستول",
      "دریچه‌های آئورت و ششی در ابتدای دیاستول",
      "دریچه‌های میترال و سه‌لختی در ابتدای دیاستول",
      "دریچه‌های آئورت و ششی در ابتدای سیستول"
    ],
    "createdAt": "2025-11-02",
    "updatedAt": "2026-08-19",
    "stats": {
      "solves": 4128,
      "correctPercent": 78,
      "avgTimeSec": 26
    }
  },
  {
    "id": "tb-phy-02",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "ECG"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1400,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "در نوار ECG نرمال، موج T نمایندهٔ کدام رخداد الکتریکی است؟",
    "figure": null,
    "options": [
      "دپولاریزاسیون دهلیزها",
      "دپولاریزاسیون بطن‌ها",
      "ریپولاریزاسیون بطن‌ها",
      "ریپولاریزاسیون دهلیزها"
    ],
    "createdAt": "2025-10-21",
    "updatedAt": "2026-07-30",
    "stats": {
      "solves": 5231,
      "correctPercent": 71,
      "avgTimeSec": 24
    }
  },
  {
    "id": "tb-phy-03",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "تنظیم فشار خون"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1401,
    "source": "official",
    "tags": [
      "پرتکرار",
      "منتخب"
    ],
    "stem": "افزایش ناگهانی فشار خون شریانی، از طریق رفلکس بارورترب چه اثری بر فعالیت عصب واگ و تعداد ضربان قلب دارد؟",
    "figure": null,
    "options": [
      "افزایش فعالیت واگ و برادی‌کاردی",
      "کاهش فعالیت واگ و تاکی‌کاردی",
      "افزایش فعالیت واگ و تاکی‌کاردی",
      "بدون اثر بر فعالیت واگ؛ فقط افزایش مقاومت محیطی"
    ],
    "createdAt": "2025-12-08",
    "updatedAt": "2026-08-02",
    "stats": {
      "solves": 3984,
      "correctPercent": 63,
      "avgTimeSec": 38
    }
  },
  {
    "id": "tb-phy-04",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "الکتروفیزیولوژی قلب"
    ],
    "type": "image",
    "difficulty": "hard",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "stem": "در شکل مقابل، نمودار پتانسیل عمل دو نوع سلول قلبی رسم شده است. منحنی A مربوط به میوکارد بطنی و منحنی B مربوط به سلول گرهی SA است. فاز صعودی آهستهٔ منحنی B ناشی از کدام جریان یونی است؟",
    "figure": "cardiac-ap",
    "options": [
      "ورود سریع سدیم از کانال‌های Fast Na",
      "ورود کلسیم از کانال‌های نوع L",
      "خروج پتاسیم از کانال‌های تأخیری",
      "ورود کلسیم از کانال‌های نوع T در ابتدای فاز صفر"
    ],
    "createdAt": "2026-02-11",
    "updatedAt": "2026-08-25",
    "stats": {
      "solves": 2412,
      "correctPercent": 54,
      "avgTimeSec": 47
    }
  },
  {
    "id": "tb-phy-05",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "تنفس",
      "حجم‌ها و ظرفیت‌های ریوی"
    ],
    "type": "calculation",
    "difficulty": "easy",
    "year": 1398,
    "source": "official",
    "tags": [],
    "stem": "در یک فرد سالم، حجم جاری (TV) برابر ۵۰۰ میلی‌لیتر، حجم ذخیرهٔ دمی (IRV) برابر ۳۰۰۰ میلی‌لیتر و حجم ذخیرهٔ بازدمی (ERV) برابر ۱۱۰۰ میلی‌لیتر است. حجم انقضای واجب (VC) چقدر است؟",
    "figure": null,
    "options": [
      "۴۱۰۰ میلی‌لیتر",
      "۴۶۰۰ میلی‌لیتر",
      "۵۲۰۰ میلی‌لیتر",
      "۵۷۰۰ میلی‌لیتر"
    ],
    "createdAt": "2025-09-14",
    "updatedAt": "2026-06-28",
    "stats": {
      "solves": 4890,
      "correctPercent": 82,
      "avgTimeSec": 31
    }
  },
  {
    "id": "tb-phy-06",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "تنفس",
      "انتقال گازها"
    ],
    "type": "image",
    "difficulty": "hard",
    "year": 1402,
    "source": "official",
    "tags": [
      "پرتکرار",
      "منتخب"
    ],
    "stem": "در شکل، منحنی تفکیک اکسی‌هموگلوبین فرد سالم (خط ممتد) و فردی با افزایش دمای بدن (خط‌چین) رسم شده است. جابه‌جایی منحنی به راست چه پیامدی دارد؟",
    "figure": "o2-curve",
    "options": [
      "افزایش P50 و سهولت آزادسازی O₂ در بافت‌ها",
      "کاهش P50 و افزایش تمایل Hb به اکسیژن",
      "کاهش ظرفیت حمل O₂ بدون تغییر P50",
      "افزایش میزان ترکیب O₂ با Hb در ریه"
    ],
    "createdAt": "2026-01-09",
    "updatedAt": "2026-08-11",
    "stats": {
      "solves": 3127,
      "correctPercent": 58,
      "avgTimeSec": 45
    }
  },
  {
    "id": "tb-phy-07",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "کلیه",
      "فیزیولوژی لوله‌های نفرون"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1403,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "قسمت صعودی ضخیم حلقهٔ هنله (TAL) با بازجذب فعال NaK-2Cl، خمیرای غلافی میسازد. اثر دیورتیک لوپ (فوروزماید) روی این قطعه کدام پارامتر را بیشترین تغییر می‌دهد؟",
    "figure": null,
    "options": [
      "افزایش بازجذب آب در TAL",
      "از بین رفتن گرادیان اوزموتیک خمیرای غلافی و افزایش دفع Na⁺",
      "افزایش بازجذب کلسیم در لولهٔ دیستال",
      "کاهش حجم ادرار به دلیل بازجذب جبرانی آب"
    ],
    "createdAt": "2026-03-04",
    "updatedAt": "2026-08-29",
    "stats": {
      "solves": 2948,
      "correctPercent": 61,
      "avgTimeSec": 43
    }
  },
  {
    "id": "tb-phy-08",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "کلیه",
      "تعادل اسید-باز"
    ],
    "type": "clinical",
    "difficulty": "hard",
    "year": 1404,
    "source": "official",
    "tags": [],
    "stem": "زن ۲۸ ساله‌ای با سابقهٔ استفراغ مکرر مراجعه کرده است. گاز خون: pH = ۷٫۵۰، PaCO₂ = ۴۵ mmHg، HCO₃⁻ = ۳۴ mEq/L. کدام تفسیر صحیح است؟",
    "figure": null,
    "options": [
      "آلکالوز متابولیک با جبران تنفسی ناکافی",
      "آلکالوز تنفسی با جبران متابولیک",
      "اسیدوز متابولیک با جبران تنفسی",
      "آلکالوز مخلوط تنفسی-متابولیک"
    ],
    "createdAt": "2026-04-02",
    "updatedAt": "2026-09-01",
    "stats": {
      "solves": 2035,
      "correctPercent": 49,
      "avgTimeSec": 52
    }
  },
  {
    "id": "tb-phy-09",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "عصب",
      "سیناپس و گیرنده‌ها"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1400,
    "source": "comprehensive",
    "tags": [
      "پرتکرار"
    ],
    "stem": "اثر مهاری گیرنده‌های GABA-A در سیناپس‌های CNS عمدتاً از چه سازوکاری ناشی می‌شود؟",
    "figure": null,
    "options": [
      "فعال‌سازی کانال کاتیونی و ورود Na⁺",
      "افزایش هدایت کلری و هیپرپلاریزاسیون غشا",
      "کاهش هدایت پتاسیمی غشا",
      "مهار آنزیم آدنیلات سیکلاز در سلول پس‌سیناپسی"
    ],
    "createdAt": "2025-10-30",
    "updatedAt": "2026-07-14",
    "stats": {
      "solves": 4471,
      "correctPercent": 69,
      "avgTimeSec": 33
    }
  },
  {
    "id": "tb-phy-10",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "عصب",
      "سیستم عصبی خودکار"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1398,
    "source": "official",
    "tags": [],
    "stem": "فعال‌سازی گیرنده‌های بتا-۱ قلبی، کدام اثر را ایجاد می‌کند؟",
    "figure": null,
    "options": [
      "کاهش تعداد ضربان و قدرت انقباض",
      "افزایش تعداد ضربان و قدرت انقباض",
      "افزایش تعداد ضربان با کاهش قدرت انقباض",
      "اتساع عروق کرونر بدون اثر بر انقباض"
    ],
    "createdAt": "2025-09-01",
    "updatedAt": "2026-06-11",
    "stats": {
      "solves": 5612,
      "correctPercent": 87,
      "avgTimeSec": 19
    }
  },
  {
    "id": "tb-phy-11",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "گوارش",
      "هورمون‌های گوارشی"
    ],
    "type": "memorization",
    "difficulty": "medium",
    "year": 1401,
    "source": "official",
    "tags": [
      "منتخب"
    ],
    "stem": "هورمونی که با کاهش اسیدیتهٔ دوازدهه و تحریک پانکراس به ترشح بیکربنات، محیط لازم برای آنزیم‌های روده فراهم می‌کند کدام است؟",
    "figure": null,
    "options": [
      "گاسترین",
      "سکرتین",
      "کوله‌سیستوکینین (CCK)",
      "موتولین"
    ],
    "createdAt": "2025-12-18",
    "updatedAt": "2026-07-22",
    "stats": {
      "solves": 3390,
      "correctPercent": 66,
      "avgTimeSec": 29
    }
  },
  {
    "id": "tb-phy-12",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "غدد درون‌ریز",
      "غدهٔ تیروئید"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1402,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "در مقایسه با T4، هورمون T3 دارای کدام ویژگی برجسته است؟",
    "figure": null,
    "options": [
      "غلظت پلاسمایی بالاتر و نیمه‌عمر طولانی‌تر",
      "فعالیت بیولوژیک بیشتر، اما غلظت پلاسمایی کمتر و نیمه‌عمر کوتاه‌تر",
      "عدم اتصال به پروتئین‌های حامل",
      "ساخته‌شدن فقط در غدهٔ تیروئید و بدون وابستگی به ید"
    ],
    "createdAt": "2026-01-20",
    "updatedAt": "2026-07-29",
    "stats": {
      "solves": 3564,
      "correctPercent": 64,
      "avgTimeSec": 34
    }
  },
  {
    "id": "tb-phy-13",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "خون",
      "انعقاد خون"
    ],
    "type": "clinical",
    "difficulty": "hard",
    "year": 1403,
    "source": "comprehensive",
    "tags": [],
    "stem": "هپارین با اتصال به آنتی‌ترومبین III کدام فاکتور انعقادی را بیشترین هدف‌گیری می‌کند و برای پایش اثر آن کدام آزمون به کار می‌رود؟",
    "figure": null,
    "options": [
      "فاکتور VII؛ PT",
      "ترومبین (IIa) و فاکتور Xa؛ aPTT",
      "فاکتور XIII؛ زمان خونریزی",
      "فیبرینوژن؛ INR"
    ],
    "createdAt": "2026-03-16",
    "updatedAt": "2026-08-07",
    "stats": {
      "solves": 1892,
      "correctPercent": 57,
      "avgTimeSec": 41
    }
  },
  {
    "id": "tb-phy-14",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "عضله",
      "فیزیولوژی انقباض"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1399,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "در فرآیند اتصال میوزین به اکتین، نقش کلسیم آزادشده از شبکه سارکوپلاسمی چیست؟",
    "figure": null,
    "options": [
      "اتصال مستقیم به میوزین و فعال‌سازی ATPase آن",
      "اتصال به تروپونین C و جابه‌جایی تروپومیوزین از محل اتصال",
      "تسریع تجزیه ATP مستقل از تروپونین",
      "افزایش هدایت سدیمی غشای تی‌توبول"
    ],
    "createdAt": "2025-11-11",
    "updatedAt": "2026-06-30",
    "stats": {
      "solves": 4305,
      "correctPercent": 72,
      "avgTimeSec": 30
    }
  },
  {
    "id": "tb-phy-15",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "calculation",
    "difficulty": "easy",
    "year": 1404,
    "source": "official",
    "tags": [],
    "stem": "اگر حجم ضربه‌ای (SV) قلبی ۷۰ میلی‌لیتر و تعداد ضربان ۷۵ بار در دقیقه باشد، برون‌ده قلبی چقدر است؟",
    "figure": null,
    "options": [
      "۵٫۲۵ لیتر در دقیقه",
      "۴٫۵ لیتر در دقیقه",
      "۶٫۷۵ لیتر در دقیقه",
      "۷ لیتر در دقیقه"
    ],
    "createdAt": "2026-04-25",
    "updatedAt": "2026-09-03",
    "stats": {
      "solves": 6103,
      "correctPercent": 89,
      "avgTimeSec": 22
    }
  },
  {
    "id": "tb-ana-01",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "اندام فوقانی",
      "ناحیهٔ سرشانه و براکیال پلکسوس"
    ],
    "type": "clinical",
    "difficulty": "hard",
    "year": 1402,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "نوزادی پس از زایمان دیستوسیک، بازوی آویزان و چرخیده به داخل و ساعد پرناتور دارد. کدام ریشه‌ها و آسیب مسئول این تصویر است؟",
    "figure": null,
    "options": [
      "C8-T1؛ فلج کلومپکه (پارالیز تحتانی براکیال پلکسوس)",
      "C5-C6؛ فلج ارب (پارالیز فوقانی براکیال پلکسوس)",
      "C7؛ آسیب عصب توراسیک بلند",
      "C5-T1؛ آسیب کامل پلکسوس"
    ],
    "createdAt": "2026-01-28",
    "updatedAt": "2026-08-16",
    "stats": {
      "solves": 2714,
      "correctPercent": 61,
      "avgTimeSec": 44
    }
  },
  {
    "id": "tb-ana-02",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "اندام فوقانی",
      "اعصاب اندام فوقانی"
    ],
    "type": "clinical",
    "difficulty": "medium",
    "year": 1401,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "فردی پس از شکستگی شفت هیومروس، افتادگی مچ دست (Wrist Drop) پیدا کرده است. کدام عصب آسیب دیده است؟",
    "figure": null,
    "options": [
      "عصب مدیان",
      "عصب اولنار",
      "عصب رادیال",
      "عصب موسکولوکوتانئوس"
    ],
    "createdAt": "2025-12-02",
    "updatedAt": "2026-07-08",
    "stats": {
      "solves": 3988,
      "correctPercent": 76,
      "avgTimeSec": 25
    }
  },
  {
    "id": "tb-ana-03",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "اندام فوقانی",
      "استخوان‌شناسی"
    ],
    "type": "memorization",
    "difficulty": "medium",
    "year": 1400,
    "source": "official",
    "tags": [],
    "stem": "سایتی که شکستگی آن بیشترین خطر آسیب به عصب آگزیلاری را دارد کدام است؟",
    "figure": null,
    "options": [
      "آناتومیکال نک هیومروس",
      "سورجیکال نک هیومروس",
      "گریت تیوبروزیتی",
      "کلمهٔ پروگزیمال هیومروس در بچه‌ها"
    ],
    "createdAt": "2025-10-15",
    "updatedAt": "2026-06-25",
    "stats": {
      "solves": 2143,
      "correctPercent": 52,
      "avgTimeSec": 37
    }
  },
  {
    "id": "tb-ana-04",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "قلب و توراکس",
      "آناتومی قلب"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1399,
    "source": "official",
    "tags": [],
    "stem": "ساختاری که در نمای آنتریر قلب، در مرز بین دهلیز راست و بطن راست قرار دارد و دریچهٔ سه‌لختی را نگه می‌دارد، در کدام ناحیه است؟",
    "figure": null,
    "options": [
      "گرهٔ سینوسی-دهلیزی",
      "سولکوس کروناری (AV گروو)",
      "اینترونتریکولار آنتریر",
      "ناچ آپیکال"
    ],
    "createdAt": "2025-11-19",
    "updatedAt": "2026-07-01",
    "stats": {
      "solves": 2876,
      "correctPercent": 68,
      "avgTimeSec": 27
    }
  },
  {
    "id": "tb-ana-05",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "قلب و توراکس",
      "دیافراگم"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1398,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "عصب حرکتی دیافراگم از کدام ریشه‌های نخاعی منشأ می‌گیرد؟",
    "figure": null,
    "options": [
      "C3-C4-C5",
      "C5-C6-C7",
      "T1-T4",
      "C6-C7-C8"
    ],
    "createdAt": "2025-08-30",
    "updatedAt": "2026-06-05",
    "stats": {
      "solves": 5432,
      "correctPercent": 84,
      "avgTimeSec": 18
    }
  },
  {
    "id": "tb-ana-06",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "اندام تحتانی",
      "اعصاب اندام تحتانی"
    ],
    "type": "clinical",
    "difficulty": "medium",
    "year": 1400,
    "source": "comprehensive",
    "tags": [],
    "stem": "بعد از شکستگی نک فیبولا، فردی ناتوانی در دورسفلکشن پا و افتادگی پا (Foot Drop) دارد. کدام عصب آسیب دیده است؟",
    "figure": null,
    "options": [
      "عصب تیبیال",
      "عصب فیبیال کامون (عصب پریونئال کامون)",
      "عصب فمورال",
      "عصب ابترتور"
    ],
    "createdAt": "2025-10-25",
    "updatedAt": "2026-07-04",
    "stats": {
      "solves": 3712,
      "correctPercent": 74,
      "avgTimeSec": 26
    }
  },
  {
    "id": "tb-ana-07",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "شکم و لگن",
      "کانال اینگوینال"
    ],
    "type": "memorization",
    "difficulty": "hard",
    "year": 1403,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "دیوارهٔ خلفی کانال اینگوینال به‌ترتیب از بالا به پایین از چه ساختارهایی تشکیل شده است؟",
    "figure": null,
    "options": [
      "آپونوروز ترانسوسوس ابدومینیس و فاسیای ترانسورسالیس",
      "عصب ایلوینگوینال و فاسیای ترانسورسالیس",
      "لیگامان اینگوینال و عضلهٔ رکتوس ابدومینیس",
      "رینگ اینگوینال سطحی و فاسیا اسپرماتیک"
    ],
    "createdAt": "2026-03-22",
    "updatedAt": "2026-08-21",
    "stats": {
      "solves": 1604,
      "correctPercent": 47,
      "avgTimeSec": 49
    }
  },
  {
    "id": "tb-ana-08",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "سر و گردن",
      "ترایگل‌های گردن"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1402,
    "source": "official",
    "tags": [],
    "stem": "محتوای اصلی ترایگل خلفی گردن کدام ساختارها هستند؟",
    "figure": null,
    "options": [
      "عصب هیپوگلوس و غدهٔ تیروئید",
      "عصب اسپینال اکسسوری، ریشه‌های پلکسوس براکیال و عضلهٔ اوموهیوئید",
      "عصب فرنیک و شریان کاروتید",
      "غدهٔ سوب‌ماندیبولار و عصب لینگوال"
    ],
    "createdAt": "2026-01-05",
    "updatedAt": "2026-07-19",
    "stats": {
      "solves": 2388,
      "correctPercent": 59,
      "avgTimeSec": 36
    }
  },
  {
    "id": "tb-ana-09",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "نوروآناتومی",
      "سیستم بینایی"
    ],
    "type": "clinical",
    "difficulty": "hard",
    "year": 1404,
    "source": "official",
    "tags": [
      "منتخب"
    ],
    "stem": "بیماری با ضایعهٔ کامل در کیاسما اپتیکوم (اواسط آن) مراجعه کرده است. کدام اختلال میدان بینایی انتظار می‌رود؟",
    "figure": null,
    "options": [
      "همونیموس همی‌آنوپی چپ",
      "بی‌تمپورال همی‌آنوپی",
      "مونوکولار بینایی از دست رفته در چشم چپ",
      "بی‌نازال همی‌آنوپی"
    ],
    "createdAt": "2026-04-18",
    "updatedAt": "2026-08-31",
    "stats": {
      "solves": 1421,
      "correctPercent": 55,
      "avgTimeSec": 48
    }
  },
  {
    "id": "tb-ana-10",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "نوروآناتومی",
      "عروق مغز"
    ],
    "type": "clinical",
    "difficulty": "hard",
    "year": 1401,
    "source": "comprehensive",
    "tags": [],
    "stem": "سکتهٔ ایسکمیک در ناحیهٔ قشنگی که نمای حرکتی اندام فوقانی و صورت را تغذیه می‌کند، بیشترین احتمال مربوط به کدام شریان است؟",
    "figure": null,
    "options": [
      "شریان مغزی قدامی (ACA)",
      "شریان مغزی میانی (MCA)",
      "شریان مغزی خلفی (PCA)",
      "شریان بازیلار"
    ],
    "createdAt": "2025-12-26",
    "updatedAt": "2026-07-26",
    "stats": {
      "solves": 2051,
      "correctPercent": 62,
      "avgTimeSec": 39
    }
  },
  {
    "id": "tb-bio-01",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "آنزیم‌ها",
      "سینتیک آنزیمی"
    ],
    "type": "image",
    "difficulty": "medium",
    "year": 1400,
    "source": "official",
    "tags": [
      "پرتکرار",
      "منتخب"
    ],
    "stem": "در شکل مقابل، منحنی اشباع سوبسترای یک آنزیم رسم شده است. مقدار Km بر اساس این نمودار کدام است؟",
    "figure": "enzyme-kinetics",
    "options": [
      "غلظت سوبسترایی که سرعت واکنش را به نصف Vmax می‌رساند",
      "غلظت سوبسترایی که آنزیم را کاملاً اشباع می‌کند",
      "سرعت واکنش در غلظت نصف سوبسترای اشباع",
      "برعکسِ ثابت تفکیک آنزیم-مهارکننده"
    ],
    "createdAt": "2025-10-08",
    "updatedAt": "2026-07-12",
    "stats": {
      "solves": 4612,
      "correctPercent": 73,
      "avgTimeSec": 32
    }
  },
  {
    "id": "tb-bio-02",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "آنزیم‌ها",
      "مهارکننده‌های آنزیمی"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1399,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "در مهار رقابتی، افزایش غلظت سوبسترا چه اثری بر Vmax و Km ظاهری دارد؟",
    "figure": null,
    "options": [
      "Vmax کاهش، Km کاهش",
      "Vmax ثابت، Km افزایش ظاهری",
      "Vmax کاهش، Km ثابت",
      "Vmax و Km هر دو ثابت"
    ],
    "createdAt": "2025-11-08",
    "updatedAt": "2026-06-20",
    "stats": {
      "solves": 4988,
      "correctPercent": 70,
      "avgTimeSec": 28
    }
  },
  {
    "id": "tb-bio-03",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "متابولیسم کربوهیدرات",
      "گلیکولیز و گلوکونئوژنز"
    ],
    "type": "calculation",
    "difficulty": "hard",
    "year": 1402,
    "source": "comprehensive",
    "tags": [],
    "stem": "سود خالص ATP تولیدشده از مسیر سوبسترا-سطحی (بدون احتساب NADH و FADH₂) از گلیکولیز تا پایان چرخهٔ کربس برای یک مولکول گلوکز چقدر است؟",
    "figure": null,
    "options": [
      "۲ ATP",
      "۴ ATP",
      "۸ ATP (با احتساب NADH)",
      "۳۰ تا ۳۲ ATP (اکسیداسیون کامل)"
    ],
    "createdAt": "2026-01-14",
    "updatedAt": "2026-08-09",
    "stats": {
      "solves": 1782,
      "correctPercent": 44,
      "avgTimeSec": 55
    }
  },
  {
    "id": "tb-bio-04",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "متابولیسم کربوهیدرات",
      "شنت هگزوز مونوفسفات"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1398,
    "source": "official",
    "tags": [],
    "stem": "کمبود آنزیم G6PD عمدتاً با کدام پیامد بالینی همراه است؟",
    "figure": null,
    "options": [
      "کم‌خونی همولیتیک با گویچه‌های bite cell",
      "کم‌خونی میکروسیتیک هیپوکروم",
      "اسیدوز لاکتیک",
      "هیپرگلیسمی عصبی"
    ],
    "createdAt": "2025-09-20",
    "updatedAt": "2026-06-15",
    "stats": {
      "solves": 3567,
      "correctPercent": 80,
      "avgTimeSec": 24
    }
  },
  {
    "id": "tb-bio-05",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "ویتامین‌ها",
      "ویتامین‌های محلول در چربی"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1400,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "ویتامینی که به‌عنوان آنتی‌اکسیدان زنجیره‌ای در غشاهای سلولی عمل می‌کند کدام است؟",
    "figure": null,
    "options": [
      "ویتامین A (رتینول)",
      "ویتامین D (کالسیفرول)",
      "ویتامین E (توکوفرول)",
      "ویتامین K (فیلوکینون)"
    ],
    "createdAt": "2025-10-02",
    "updatedAt": "2026-06-22",
    "stats": {
      "solves": 4102,
      "correctPercent": 83,
      "avgTimeSec": 21
    }
  },
  {
    "id": "tb-bio-06",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "متابولیسم لیپید",
      "سنتز اسید چرب"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1401,
    "source": "official",
    "tags": [],
    "stem": "در سنتز اسید چرب، آنزیم آسیل-CoA کربوکسیلاز (ACC) با کدام مکانیسم تنظیم می‌شود؟",
    "figure": null,
    "options": [
      "فعال‌سازی با فسفوریلاسیون توسط PKA",
      "فعال‌سازی با دفسفوریلاسیون (انسولین) و آلوستری با سیترات",
      "مهار با سیترات و فعال‌سازی با پالمیتات",
      "تنظیم مستقل از وضعیت انرژی سلول"
    ],
    "createdAt": "2025-12-12",
    "updatedAt": "2026-07-17",
    "stats": {
      "solves": 2634,
      "correctPercent": 60,
      "avgTimeSec": 38
    }
  },
  {
    "id": "tb-bio-07",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "بیوشیمی مولکولی",
      "ترجمهٔ پروتئین"
    ],
    "type": "memorization",
    "difficulty": "medium",
    "year": 1403,
    "source": "official",
    "tags": [],
    "stem": "کدون آغاز ترجمه در باکتری‌ها کدام آمینواسید را کدگذاری می‌کند؟",
    "figure": null,
    "options": [
      "متیونین",
      "N-فرمیل‌متیونین",
      "لوسین",
      "والین"
    ],
    "createdAt": "2026-03-09",
    "updatedAt": "2026-08-05",
    "stats": {
      "solves": 2210,
      "correctPercent": 65,
      "avgTimeSec": 30
    }
  },
  {
    "id": "tb-bio-08",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "بیوشیمی مولکولی",
      "جهش‌ها"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1404,
    "source": "official",
    "tags": [
      "منتخب"
    ],
    "stem": "جهشی که یک کدون معنادار را به کدون توقف (UAA، UAG، UGA) تبدیل می‌کند چه نام دارد؟",
    "figure": null,
    "options": [
      "میس‌سنس",
      "نان‌سنس",
      "سایلنت",
      "فریم‌شیفت"
    ],
    "createdAt": "2026-04-08",
    "updatedAt": "2026-08-27",
    "stats": {
      "solves": 1953,
      "correctPercent": 68,
      "avgTimeSec": 33
    }
  },
  {
    "id": "tb-bio-09",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "تعادل اسید-باز",
      "بافرها"
    ],
    "type": "calculation",
    "difficulty": "hard",
    "year": 1401,
    "source": "comprehensive",
    "tags": [],
    "stem": "بر اساس معادلهٔ هندرسون-هاسلباخ (pKa بیکربنات = ۶٫۱)، اگر نسبت HCO₃⁻ به H₂CO₃ برابر ۲۰ باشد، pH خون چقدر است؟",
    "figure": null,
    "options": [
      "۷٫۱",
      "۷٫۴",
      "۶٫۹",
      "۷٫۸"
    ],
    "createdAt": "2025-12-04",
    "updatedAt": "2026-07-24",
    "stats": {
      "solves": 1687,
      "correctPercent": 51,
      "avgTimeSec": 47
    }
  },
  {
    "id": "tb-bio-10",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "چرخهٔ اوره"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1402,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "در کمبود آنزیم اورنیتین ترانس‌کاربامیلاز (OTC)، کدام یافتهٔ آزمایشگاهی تیپیک است؟",
    "figure": null,
    "options": [
      "افزایش اورنیتین و اسید اوروتیک در ادرار",
      "افزایش سیترولین و اسید آرژینوسوکسینیک",
      "افزایش هموگلوبین گلیکوزیله",
      "کاهش آمونیاک خون"
    ],
    "createdAt": "2026-01-27",
    "updatedAt": "2026-08-13",
    "stats": {
      "solves": 1502,
      "correctPercent": 46,
      "avgTimeSec": 51
    }
  },
  {
    "id": "tb-phy-16",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "کلیه",
      "فیزیولوژی لوله‌های نفرون"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "stem": "هورمون ADH (وازوپرسین) در سلول‌های مجرای جمع‌کنندهٔ نفرون با کدام مسیر، بازجذب آب را افزایش می‌دهد؟",
    "figure": null,
    "options": [
      "اتصال به گیرندهٔ V2، افزایش cAMP و درج آکوپورین-۲ در غشای اپیکال",
      "اتصال به گیرندهٔ V1، افزایش IP₃ و انقباض عضلهٔ صاف عروق",
      "مهار مستقیم کانال‌های سدیمی اپیکال بدون واسطهٔ پیام‌رسان ثانویه",
      "اتصال به گیرندهٔ V2 و کاهش cAMP در سلول مجرای جمع‌کننده"
    ],
    "createdAt": "2026-05-04",
    "updatedAt": "2026-09-05",
    "stats": {
      "solves": 1893,
      "correctPercent": 62,
      "avgTimeSec": 34
    }
  },
  {
    "id": "tb-ana-11",
    "track": "medicine",
    "subject": "anatomy",
    "topicPath": [
      "اندام فوقانی",
      "اعصاب اندام فوقانی"
    ],
    "type": "clinical",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "پرتکرار"
    ],
    "stem": "در سندرم تونل کارپال، کدام عصب زیر رتیناکولوم فلکسور فشرده می‌شود و بیشترین اختلال حس در کدام ناحیه است؟",
    "figure": null,
    "options": [
      "عصب اولنار؛ حس انگشت کوچک و کنارهٔ داخلی دست",
      "عصب مدیان؛ حس سطح پالمار سه انگشت و نیم اول",
      "عصب رادیال؛ حس پشت دست و فضای بین‌انگشتی اول",
      "عصب مدیان؛ حس تمام انگشتان شامل انگشت کوچک"
    ],
    "createdAt": "2026-05-11",
    "updatedAt": "2026-09-06",
    "stats": {
      "solves": 2244,
      "correctPercent": 71,
      "avgTimeSec": 29
    }
  },
  {
    "id": "tb-bio-11",
    "track": "medicine",
    "subject": "biochemistry",
    "topicPath": [
      "متابولیسم کربوهیدرات",
      "گلیکولیز و گلوکونئوژنز"
    ],
    "type": "memorization",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "stem": "در گلوکونئوژنز، کدام آنزیم با کربوکسیله‌کردن پیروات به اگزالواستات این نقطهٔ کنترل گلیکولیز را دور می‌زند و کوفاکتور آن چیست؟",
    "figure": null,
    "options": [
      "پیروات کربوکسیلاز؛ بیوتین",
      "پیروات دهیدروژناز؛ NAD⁺ و تیامین",
      "فسفوفروکتوکیناز-۱؛ ATP",
      "پیروات کیناز؛ فروکتوز-۲٬۶-بیس‌فسفات"
    ],
    "createdAt": "2026-05-18",
    "updatedAt": "2026-09-07",
    "stats": {
      "solves": 1671,
      "correctPercent": 59,
      "avgTimeSec": 36
    }
  },
  {
    "id": "tb-imm-01",
    "track": "medicine",
    "subject": "immunology",
    "topicPath": [
      "پاسخ ایمنی هومورال",
      "ایمونوگلوبولین‌ها"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "پرتکرار"
    ],
    "stem": "آنتی‌بادی غالب در ترشحات مخاطی (بزاق، شیر مادر، ترشح بینی) کدام است و ویژگی ساختاری آن چیست؟",
    "figure": null,
    "options": [
      "IgM؛ پنتامر متصل با زنجیرهٔ J",
      "IgA ترشحی؛ دایمر متصل با زنجیرهٔ J و قطعهٔ ترشحی",
      "IgG؛ مونومر با توان عبور از جفت",
      "IgE؛ مونومر متصل به گیرندهٔ ماست‌سل"
    ],
    "createdAt": "2026-05-22",
    "updatedAt": "2026-09-08",
    "stats": {
      "solves": 3102,
      "correctPercent": 76,
      "avgTimeSec": 24
    }
  },
  {
    "id": "tb-mic-01",
    "track": "medicine",
    "subject": "microbiology",
    "topicPath": [
      "باکتری‌های گرم مثبت",
      "استافیلوکوک"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "stem": "مطمئن‌ترین آزمون آزمایشگاهی برای تفکیک استافیلوکوکوس اورئوس از سایر گونه‌های کوآگولاز-منفی این جنس کدام است؟",
    "figure": null,
    "options": [
      "کاتالاز مثبت بودن",
      "آزمون کوآگولاز (لخته‌شدن پلاسما)",
      "همولیز بتا روی بلاد آگار",
      "رشد روی محیط مانیتول سالت آگار"
    ],
    "createdAt": "2026-05-26",
    "updatedAt": "2026-09-09",
    "stats": {
      "solves": 2760,
      "correctPercent": 68,
      "avgTimeSec": 27
    }
  },
  {
    "id": "tb-den-01",
    "track": "dentistry",
    "subject": "anatomy",
    "topicPath": [
      "سر و گردن",
      "عصب سه‌قلو و شاخه‌ها"
    ],
    "type": "memorization",
    "difficulty": "medium",
    "year": 1403,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "عصب آلوئولار تحتانی (IAN) شاخهٔ کدام تقسیم عصب سه‌قلو است و از کدام مسیر عبور می‌کند؟",
    "figure": null,
    "options": [
      "شاخهٔ V2 (ماگزیلاری)؛ از سینوس ماگزیلاری",
      "شاخهٔ V3 (ماندیبولار)؛ از کانال ماندیبول",
      "شاخهٔ V1 (افتالمیک)؛ از شکاف اوربیتال فوقانی",
      "شاخهٔ V3؛ از سوراخ مِنتال به سمت داخل"
    ],
    "createdAt": "2026-02-03",
    "updatedAt": "2026-08-20",
    "stats": {
      "solves": 1988,
      "correctPercent": 66,
      "avgTimeSec": 31
    }
  },
  {
    "id": "tb-den-02",
    "track": "dentistry",
    "subject": "histology",
    "topicPath": [
      "بافت‌شناسی دهان و دندان",
      "مینا و عاج"
    ],
    "type": "concept",
    "difficulty": "easy",
    "year": 1402,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "مینای دندان توسط کدام سلول ساخته می‌شود و مهم‌ترین ویژگی آن نسبت به سایر بافت‌های بدن چیست؟",
    "figure": null,
    "options": [
      "ادونتوبلاست؛ بافتی زنده با بازسازی مداوم در طول عمر",
      "آملوبلاست؛ سخت‌ترین بافت بدن و بدون توان بازسازی پس از تکامل",
      "سمنتوبلاست؛ بافتی شبیه استخوان با عروق فراوان",
      "فیبروبلاست پالپ؛ مینای ثانویه را در تمام عمر می‌سازد"
    ],
    "createdAt": "2026-02-10",
    "updatedAt": "2026-08-22",
    "stats": {
      "solves": 2340,
      "correctPercent": 74,
      "avgTimeSec": 26
    }
  },
  {
    "id": "tb-den-03",
    "track": "dentistry",
    "subject": "histology",
    "topicPath": [
      "بافت‌شناسی دهان و دندان",
      "مینا و عاج"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "stem": "عاج (Dentin) توسط کدام سلول و با چه الگویی ساخته می‌شود؟",
    "figure": null,
    "options": [
      "آملوبلاست؛ با ترشح لایه‌به‌لایه از خارج به داخل",
      "ادونتوبلاست؛ با عقب‌نشینی تدریجی و جای‌گذاشتن زائدهٔ سلولی در کانالیکول",
      "سمنتوبلاست؛ فقط در ریشه و پس از بسته‌شدن آپکس",
      "فیبروبلاست؛ با رسوب کلاژن نوع I بدون سلول اختصاصی"
    ],
    "createdAt": "2026-05-30",
    "updatedAt": "2026-09-10",
    "stats": {
      "solves": 1614,
      "correctPercent": 69,
      "avgTimeSec": 28
    }
  },
  {
    "id": "tb-den-04",
    "track": "dentistry",
    "subject": "microbiology",
    "topicPath": [
      "باکتری‌های گرم مثبت",
      "استرپتوکوک"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1401,
    "source": "official",
    "tags": [
      "پرتکرار",
      "منتخب"
    ],
    "stem": "عامل اصلی شروع پوسیدگی مینا کدام باکتری است و مکانیسم چسبیدن آن به سطح دندان چیست؟",
    "figure": null,
    "options": [
      "لاکتوباسیلوس؛ تولید پروتئاز تخریب‌کنندهٔ ماتریکس مینا",
      "استرپتوکوکوس موتانس؛ تولید گلوکان نامحلول از ساکارز و تشکیل بیوفیلم",
      "پورفیروموناس ژینژیوالیس؛ تخریب کلاژن پریودنشیوم",
      "کاندیدا آلبیکانس؛ تخریب کلاژن عاج در دندان‌های پوسیده"
    ],
    "createdAt": "2026-02-16",
    "updatedAt": "2026-08-24",
    "stats": {
      "solves": 2871,
      "correctPercent": 72,
      "avgTimeSec": 27
    }
  },
  {
    "id": "tb-den-05",
    "track": "dentistry",
    "subject": "physiology",
    "topicPath": [
      "غدد بزاقی",
      "ترشح و تنظیم بزاق"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1400,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "ترشح آبکی بزاق (حجم و جریان) عمدتاً تحت کنترل کدام بخش دستگاه عصبی و کدام گیرنده است؟",
    "figure": null,
    "options": [
      "سمپاتیک؛ نوراپی‌نفرین با گیرندهٔ α₁",
      "پاراسمپاتیک؛ استیل‌کولین با گیرندهٔ موسکارینی (M₃)",
      "پاراسمپاتیک؛ استیل‌کولین با گیرندهٔ نیکوتینی روی سلول آسینار",
      "سمپاتیک؛ دوپامین با گیرندهٔ D₁"
    ],
    "createdAt": "2026-02-22",
    "updatedAt": "2026-08-26",
    "stats": {
      "solves": 2065,
      "correctPercent": 64,
      "avgTimeSec": 30
    }
  },
  {
    "id": "tb-den-06",
    "track": "dentistry",
    "subject": "biochemistry",
    "topicPath": [
      "بیوشیمی مولکولی",
      "ساختار کلاژن"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "stem": "کدام تغییر پس از ترجمه، پایداری مارپیچ سه‌گانهٔ کلاژن را تأمین می‌کند و کمبود ویتامین C چگونه به لق‌شدن دندان و خونریزی لثه می‌انجامد؟",
    "figure": null,
    "options": [
      "هیدروکسیلاسیون پرولین و لیزین؛ کمبود ویتامین C این واکنش را متوقف و مارپیچ را ناپایدار می‌کند",
      "فسفوریلاسیون سرین در انتهای زنجیره؛ کمبود ویتامین C کیناز را مهار می‌کند",
      "گلیکوزیلاسیون آسپاراژین؛ کمبود ویتامین C مسیر N-گلیکوزیلاسیون را می‌بندد",
      "کراس‌لینک دی‌سولفیدی بین زنجیره‌ها؛ کمبود ویتامین C اکسیداسیون سیستئین را می‌خواباند"
    ],
    "createdAt": "2026-06-02",
    "updatedAt": "2026-09-11",
    "stats": {
      "solves": 1422,
      "correctPercent": 52,
      "avgTimeSec": 44
    }
  },
  {
    "id": "tb-den-07",
    "track": "dentistry",
    "subject": "pathology",
    "topicPath": [
      "پاتولوژی دهان",
      "ضایعات پیش‌بدخیم"
    ],
    "type": "clinical",
    "difficulty": "medium",
    "year": 1403,
    "source": "official",
    "tags": [
      "پرتکرار"
    ],
    "stem": "کدام ضایعه، شایع‌ترین اختلال بالقوه بدخیم مخاط دهان است و به‌صورت پلاک سفیدی دیده می‌شود که قابل جدا کردن نیست؟",
    "figure": null,
    "options": [
      "کاندیدیازیس دهانی",
      "لوکوپلاکیا",
      "آفت راجعهٔ دهانی",
      "لیکن پلانوس اروزیو"
    ],
    "createdAt": "2026-03-02",
    "updatedAt": "2026-08-28",
    "stats": {
      "solves": 1755,
      "correctPercent": 61,
      "avgTimeSec": 32
    }
  },
  {
    "id": "tb-phy-c01",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "memorization",
    "difficulty": "easy",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "پرتکرار"
    ],
    "conceptIds": [
      "edv-esv",
      "preload",
      "cardiac-cycle-phases"
    ],
    "stem": "در یک فرد بالغ سالم در حالت استراحت، حجم پایان دیاستولی (EDV) بطن چپ تقریباً چقدر است؟",
    "figure": null,
    "options": [
      "۵۰ میلی‌لیتر",
      "۷۰ میلی‌لیتر",
      "۱۲۰ میلی‌لیتر",
      "۱۸۰ میلی‌لیتر"
    ],
    "createdAt": "2026-08-10",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 2210,
      "correctPercent": 74,
      "avgTimeSec": 21
    }
  },
  {
    "id": "tb-phy-c02",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب",
      "پرتکرار"
    ],
    "conceptIds": [
      "ventricular-pressure",
      "valve-events",
      "cardiac-cycle-phases"
    ],
    "stem": "در فاز انقباض ایزومتریک (ایزوولومتریک) بطن، کدام مجموعه رخداد رخ می‌دهد؟",
    "figure": null,
    "options": [
      "بسته‌شدن دریچه‌های AV و سیمیولنار با افزایش سریع فشار بطنی",
      "باز بودن هر چهار دریچه و خروج خون از بطن",
      "بسته‌شدن دریچه‌های AV و باز شدن دریچه‌های سیمیولنار",
      "باز شدن دریچه‌های AV و بسته شدن دریچه‌های سیمیولنار"
    ],
    "createdAt": "2026-08-10",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 1890,
      "correctPercent": 68,
      "avgTimeSec": 29
    }
  },
  {
    "id": "tb-phy-c03",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1403,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "conceptIds": [
      "heart-sounds",
      "edv-esv",
      "cardiac-cycle-phases"
    ],
    "stem": "شنیدن صدای سوم قلب (S3) در یک بزرگسال ۵۵ ساله با سابقه نارسایی قلبی، بیش از هر چیز چه چیزی را نشان می‌دهد؟",
    "figure": null,
    "options": [
      "بسته شدن نابه‌جا دریچه آئورت",
      "افزایش حجم و فشار دیاستولی بطن (پرشدگی حجمی)",
      "سفت‌شدن دیواره بطن و کاهش تطابق آن",
      "افت فشار اولیه دیاستول در شریان آئورت"
    ],
    "createdAt": "2026-08-12",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 1310,
      "correctPercent": 49,
      "avgTimeSec": 38
    }
  },
  {
    "id": "tb-phy-c04",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "easy",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "پرتکرار",
      "منتخب"
    ],
    "conceptIds": [
      "frank-starling",
      "preload",
      "cardiac-output"
    ],
    "stem": "بر اساس مکانیسم فرانک-استارلینگ، افزایش بازگشت وریدی به بطن چپ موجب چه اثری می‌شود؟",
    "figure": null,
    "options": [
      "افزایش طول اولیه فیبریل‌ها و افزایش حجم ضربه‌ای در همان ضربان",
      "کاهش نیروی انقباضی به دلیل کشیده شدن بیش از حد فیبریل‌ها",
      "افزایش فرکانس قلبی به‌صورت بازتابی و مستقیم",
      "کاهش فشار پایان دیاستولی و کاهش حجم ضربه‌ای"
    ],
    "createdAt": "2026-08-10",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 2450,
      "correctPercent": 81,
      "avgTimeSec": 22
    }
  },
  {
    "id": "tb-phy-c05",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1403,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "conceptIds": [
      "ventricular-pressure",
      "cardiac-cycle-phases"
    ],
    "stem": "مشتق زمانی فشار بطنی در فاز انقباض ایزومتریک (dP/dt) به‌عنوان شاخص چه چیزی استفاده می‌شود؟",
    "figure": null,
    "options": [
      "پیش‌بار بطن",
      "پس‌بار بطن",
      "انقباض‌پذیری (کافکتنسیلیته) میوکارد",
      "تطابق (کامپلاینس) دیاستولی بطن"
    ],
    "createdAt": "2026-08-12",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 980,
      "correctPercent": 44,
      "avgTimeSec": 42
    }
  },
  {
    "id": "tb-phy-c06",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "پرتکرار"
    ],
    "conceptIds": [
      "heart-sounds",
      "valve-events"
    ],
    "stem": "صدای دوم قلب (S2) دقیقاً با کدام رخداد هم‌زمان است؟",
    "figure": null,
    "options": [
      "باز شدن دریچه‌های میترال و سه‌لختی",
      "بسته شدن دریچه‌های آئورت و ششی در پایان سیستول",
      "بسته شدن دریچه‌های میترال و سه‌لختی در آغاز سیستول",
      "باز شدن دریچه آئورت در پایان انقباض ایزومتریک"
    ],
    "createdAt": "2026-08-10",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 2380,
      "correctPercent": 76,
      "avgTimeSec": 24
    }
  },
  {
    "id": "tb-phy-c07",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "clinical",
    "difficulty": "hard",
    "year": 1403,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "conceptIds": [
      "afterload",
      "ejection-fraction",
      "cardiac-output"
    ],
    "stem": "در بیمار مبتلا به هیپرتانسیون مزمن، افزایش پس‌بار بطن چپ بلافاصله چه اثری بر تخلیه بطن دارد؟",
    "figure": null,
    "options": [
      "افزایش حجم ضربه‌ای به دلیل افزایش انقباض‌پذیری بازتابی",
      "کاهش حجم ضربه‌ای و افزایش حجم پایان سیستولی در همان ضربان",
      "بدون اثر بر حجم ضربه‌ای؛ فقط افزایش فشار پایان دیاستولی",
      "افزایش فراکسیون تخلیه با کاهش EDV"
    ],
    "createdAt": "2026-08-12",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 1120,
      "correctPercent": 54,
      "avgTimeSec": 40
    }
  },
  {
    "id": "tb-phy-c08",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "conceptIds": [
      "pv-loop",
      "ejection-fraction"
    ],
    "stem": "مساحت زیر حلقه فشار-حجم بطن چپ (Pressure-Volume Loop) نشان‌دهنده چیست؟",
    "figure": null,
    "options": [
      "کار خارجی ضربه‌ای (Stroke Work) بطن",
      "حجم پایان دیاستولی بطن",
      "انرژی کل مصرفی متابولیک میوکارد",
      "کشیدگی دیواره در پایان دیاستول"
    ],
    "createdAt": "2026-08-14",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 890,
      "correctPercent": 47,
      "avgTimeSec": 41
    }
  },
  {
    "id": "tb-phy-c09",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "clinical",
    "difficulty": "medium",
    "year": 1403,
    "source": "tapesh",
    "tags": [
      "پرتکرار"
    ],
    "conceptIds": [
      "cardiac-cycle-phases",
      "edv-esv",
      "cardiac-output"
    ],
    "stem": "در بیمار مبتلا به فیبریلاسیون دهلیزی، از دست رفتن سهم انقباض دهلیزی (atrial kick) در حالت استراحت معمولاً چه پیامدی دارد؟",
    "figure": null,
    "options": [
      "افت شدید و تهدیدکننده حیات برون‌ده قلبی",
      "کاهش نسبی EDV و کاهش حجم ضربه‌ای؛ در حالت استراحت معمولاً تحمل‌پذیر",
      "افزایش EDV به دلیل افزایش فشار دهلیزی",
      "بدون هیچ اثری بر حجم‌های بطنی در حالت استراحت"
    ],
    "createdAt": "2026-08-12",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 1520,
      "correctPercent": 58,
      "avgTimeSec": 34
    }
  },
  {
    "id": "tb-phy-c10",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "calculation",
    "difficulty": "easy",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "پرتکرار"
    ],
    "conceptIds": [
      "cardiac-output",
      "ejection-fraction",
      "edv-esv"
    ],
    "stem": "بیماری EDV بطن چپ او ۱۴۰ میلی‌لیتر و ESV او ۷۰ میلی‌لیتر است و ضربان قلبش ۷۰ بار در دقیقه است. برون‌ده قلبی او چند لیتر بر دقیقه است؟",
    "figure": null,
    "options": [
      "۴٫۹ لیتر بر دقیقه",
      "۷ لیتر بر دقیقه",
      "۹٫۸ لیتر بر دقیقه",
      "۱۴ لیتر بر دقیقه"
    ],
    "createdAt": "2026-08-10",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 2140,
      "correctPercent": 83,
      "avgTimeSec": 26
    }
  },
  {
    "id": "tb-phy-c11",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "hard",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "منتخب"
    ],
    "conceptIds": [
      "wiggers-diagram",
      "valve-events",
      "ventricular-pressure"
    ],
    "stem": "در نمودار وینگرز، موج c فشار وریدی گردنی (JVP) با کدام رخداد هم‌زمان است؟",
    "figure": null,
    "options": [
      "بسته شدن دریچه سه‌لختی و برآمدن برگشت آن به سمت دهلیز",
      "باز شدن دریچه سه‌لختی و شروع پرشدگی سریع",
      "انقباض دهلیزی در پایان دیاستول",
      "پرشدگی غیرفعال وریدی در وسط دیاستول"
    ],
    "createdAt": "2026-08-14",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 760,
      "correctPercent": 38,
      "avgTimeSec": 45
    }
  },
  {
    "id": "tb-phy-c12",
    "track": "medicine",
    "subject": "physiology",
    "topicPath": [
      "قلب و عروق",
      "چرخهٔ قلبی"
    ],
    "type": "concept",
    "difficulty": "medium",
    "year": 1404,
    "source": "tapesh",
    "tags": [
      "پرتکرار"
    ],
    "conceptIds": [
      "cardiac-cycle-phases",
      "ventricular-pressure",
      "edv-esv"
    ],
    "stem": "کدام گزینه توصیف درست از تفاوت فاز تخلیه سریع و فاز کاهش تخلیه (reduced ejection) است؟",
    "figure": null,
    "options": [
      "در تخلیه سریع فشار بطنی همچنان در حال افزایش و در فاز کاهش، فشار هر دو حفره در حال افت است",
      "در هر دو فاز فشار بطنی ثابت است و فقط حجم تغییر می‌کند",
      "تخلیه سریع با دریچه سیمیولنار بسته رخ می‌دهد",
      "در فاز کاهش تخلیه، حجم ضربه‌ای اصلی تخلیه می‌شود"
    ],
    "createdAt": "2026-08-14",
    "updatedAt": "2026-09-14",
    "stats": {
      "solves": 1290,
      "correctPercent": 56,
      "avgTimeSec": 33
    }
  }
];

/* ────────────────────────── شاخص‌های مشتق (INDEXES) ────────────────────────── */

export const questionById = (id) => QUESTIONS.find((question) => question.id === id) ?? null;

export const questionsBySubject = (subjectId) =>
  QUESTIONS.filter((question) => question.subject === subjectId);

export const yearQuestionIds = (year) =>
  QUESTIONS.filter((question) => question.year === year).map((question) => question.id);

/* ── مشتق‌های دو محور طبقه‌بندی ──
   bankKind و track همیشه از خود رکورد سؤال خوانده می‌شوند تا افزودن محتوای جدید
   (یا اتصال Backend) نیازی به نگه‌داری هیچ فهرست دستی نداشته باشد. */
export const bankKindOf = (question) =>
  SOURCE_BANK[question?.source] ?? (question?.bank ?? 'authored');

export const trackOf = (question) => question?.track ?? 'medicine';

export const questionsByBank = (kind) =>
  QUESTIONS.filter((question) => bankKindOf(question) === kind);

export const questionsByTrack = (track) =>
  QUESTIONS.filter((question) => trackOf(question) === track);

/*
 * آمار یک مجموعهٔ سؤال — پایهٔ شمارنده‌های «نمای کلی بانک».
 * چون سرویس می‌تواند مجموعه را با فیلتر (نوع بانک/رشته) کوچک کند، آمار را
 * به‌جای ثابت‌بودن، تابع مجموعه می‌سازیم.
 */
export const buildStats = (questions = QUESTIONS) => ({
  totalQuestions: questions.length,
  subjectsCovered: [...new Set(questions.map((question) => question.subject))].length,
  yearsCovered: [...new Set(questions.map((question) => question.year))].length,
  totalSolves: questions.reduce((sum, question) => sum + question.stats.solves, 0),
  averageCorrect: questions.length
    ? Math.round(questions.reduce((sum, question) => sum + question.stats.correctPercent, 0) / questions.length)
    : 0,
});

export const BANK_STATS = buildStats(QUESTIONS);
