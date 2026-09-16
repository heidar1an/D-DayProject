/*
 * ── دادهٔ بخش «محصولات» صفحهٔ اصلی ──
 *
 * چرا این فایل وجود دارد: هیچ متن، مسیر یا ترتیبی درون کامپوننت‌ها نوشته نشده.
 * UI فقط این اشیاء را مصرف می‌کند؛ پس اضافه‌کردن یک محصول تازه تنها یک شیء
 * تازه در `PRODUCTS` است و هیچ کامپوننتی بازنویسی نمی‌شود.
 *
 * قرارداد هر محصول:
 *   id          کلید یکتا
 *   index       شمارهٔ روایت (فارسی)
 *   eyebrow     برچسب کوتاهِ رده
 *   title       نام محصول
 *   subtitle    یک جملهٔ تیز — نه شعار تبلیغاتی
 *   description معرفی کوتاه
 *   cta         متن دکمه
 *   accent      یکی از: purple | blue | green | gold | copper | orange | red
 *   layout      جای محصول در ریتم روایت:
 *                 showcase بخشِ بزرگِ تمام‌عرض (فقط یکی، همان featured)
 *                 sticky   نمای چسبان با تعویض ویژگی هنگام اسکرول
 *                 duo      کارتِ ستونی در ردیف دو‌تایی
 *                 feature  بخشِ بزرگِ میانی (فقط یکی)
 *                 compact  کارتِ فشرده در ردیف سه‌تایی
 *   visualType  کلیدِ پیش‌نمایش تعاملی (نگاشت در ProductVisual)
 *   href        مقصد واقعی محصول در داشبورد — نه لنگرِ تزیینی
 *
 * `href` با همان قراردادی ساخته می‌شود که `dashboardRoute` می‌خواند، و کلیدهای
 * لایه از خودِ `LAYER_IDS` می‌آیند تا با تغییر نام یک لایه، اینجا از کار نیفتد.
 */

import { LAYER_IDS } from '../../layout/dashboard/dashboardRoute';

/* آدرس داشبورد — همان چیزی که dashboardRouteHash می‌سازد */
function dashboardHref({ section, layer = null, view = null }) {
  const params = new URLSearchParams();

  if (section) params.set('s', section);
  if (layer) params.set('l', layer);
  if (layer && view) params.set('v', JSON.stringify(view));

  const query = params.toString();
  return query ? `#dashboard?${query}` : '#dashboard';
}

/* ── سرآغاز بخش ── */
const PRODUCTS_INTRO = {
  eyebrow: 'اکوسیستم یادگیری تپش',
  heading: 'برای هر مرحله از یادگیری، یک ابزار.',
  subheading: 'از یادگیری عمیق و مرور هوشمند تا آزمون، تحلیل و ساختن شبکه‌ای از دانش.',
};

/* ── محصولات ── */
const PRODUCTS = [
  {
    id: 'lessons',
    index: '۰۱',
    eyebrow: 'یادگیری',
    title: 'درسنامه جامع',
    subtitle: 'همه‌چیز را فقط نخوان؛ بفهم.',
    description:
      'درسنامه‌های ساختاریافتهٔ تپش برای یادگیری عمیق علوم پایه، مرور سریع و آمادگی آزمون.',
    cta: 'ورود به درسنامه',
    accent: 'purple',
    layout: 'showcase',
    featured: true,
    visualType: 'reader',
    href: dashboardHref({ section: 'courses', layer: LAYER_IDS.comprehensive }),
  },
  {
    id: 'bank',
    index: '۰۲',
    eyebrow: 'تمرین',
    title: 'بانک تست علوم پایه',
    subtitle: 'تمرین کن. تحلیل کن. بهتر شو.',
    description:
      'تست‌های طبقه‌بندی‌شده با پاسخ تشریحی؛ بعد از هر آزمون، تحلیل می‌گوید کجا وقت کم آوردی.',
    cta: 'ورود به بانک تست',
    accent: 'blue',
    layout: 'sticky',
    visualType: 'questionBank',
    /* ویژگی‌هایی که هنگام اسکرول یکی‌یکی فعال می‌شوند و پیش‌نمایش همراهشان عوض می‌شود */
    features: [
      {
        id: 'question',
        label: 'سؤال طبقه‌بندی‌شده',
        text: 'هر سؤال با درس، مبحث، سال و سطح دشواری برچسب خورده است.',
        stage: 'question',
      },
      {
        id: 'answer',
        label: 'پاسخ تشریحی',
        text: 'فقط گزینهٔ درست را نمی‌بینی؛ دلیل رد شدن بقیهٔ گزینه‌ها را هم می‌خوانی.',
        stage: 'answer',
      },
      {
        id: 'analysis',
        label: 'تحلیل عملکرد',
        text: 'درصد پاسخ صحیح، زمان پاسخ‌گویی و موضوعات ضعیف و قوی کنار هم می‌آیند.',
        stage: 'analysis',
      },
      {
        id: 'trend',
        label: 'روند پیشرفت',
        text: 'نمودار پیشرفت نشان می‌دهد هر مبحث در طول زمان کجا ایستاده است.',
        stage: 'trend',
      },
    ],
    href: dashboardHref({ section: 'tests', layer: LAYER_IDS.testBank }),
  },
  {
    id: 'wiki',
    index: '۰۳',
    eyebrow: 'مرجع',
    title: 'ویکی تپش',
    subtitle: 'یک موتور دانش پزشکی، نه یک واژه‌نامه.',
    description:
      'مقالات مرجعِ پیوسته به هم؛ از یک مفهوم شروع کن و تا مثال بالینی و تست‌های همان مبحث برو.',
    cta: 'جست‌وجو در ویکی',
    accent: 'copper',
    layout: 'duo',
    visualType: 'wiki',
    href: dashboardHref({ section: 'other', layer: LAYER_IDS.wiki }),
  },
  {
    id: 'examBuilder',
    index: '۰۴',
    eyebrow: 'ساختن',
    title: 'آزمون‌ساز شخصی',
    subtitle: 'آزمون را خودت بساز؛ دقیقاً همان‌قدر که لازم داری.',
    description:
      'درس، مبحث، تعداد سؤال، سطح دشواری و زمان را تعیین کن و آزمونِ خودت را تحویل بگیر.',
    cta: 'ساخت آزمون',
    accent: 'blue',
    layout: 'duo',
    visualType: 'examBuilder',
    href: dashboardHref({
      section: 'tests',
      layer: LAYER_IDS.testBank,
      view: { name: 'builder', payload: { preset: null } },
    }),
  },
  {
    id: 'knowledge',
    index: '۰۵',
    eyebrow: 'ارتباط',
    title: 'شبکه دانش',
    subtitle: 'دانش، جزیره نیست.',
    description:
      'هر مفهوم به درس‌ها، مقالات و تست‌های مرتبط وصل است؛ ببین یک موضوع کجای نقشه می‌نشیند.',
    cta: 'ورود به شبکه دانش',
    accent: 'gold',
    layout: 'feature',
    visualType: 'knowledgeGraph',
    href: dashboardHref({ section: 'other', layer: LAYER_IDS.knowledge }),
  },
  {
    id: 'flashcards',
    index: '۰۶',
    eyebrow: 'مرور',
    title: 'فلش‌کارت',
    subtitle: 'مرور هوشمند برای ماندگار شدن.',
    description: 'هر کارت درست زمانی برمی‌گردد که نزدیک است فراموشش کنی.',
    cta: 'شروع مرور',
    accent: 'green',
    layout: 'compact',
    visualType: 'flashcard',
    href: dashboardHref({ section: 'flashcards' }),
  },
  {
    id: 'coordinatedExams',
    index: '۰۷',
    eyebrow: 'سنجش',
    title: 'آزمون‌های هماهنگ‌شده',
    subtitle: 'خودت را در مقیاس واقعی بسنج.',
    description: 'آزمون‌های هماهنگ با شرکت‌کنندگان سراسر کشور، رتبه و میانگین واقعی.',
    cta: 'دیدن آزمون‌ها',
    accent: 'red',
    layout: 'compact',
    visualType: 'coordinatedExam',
    href: dashboardHref({ section: 'tests', layer: LAYER_IDS.coordinated }),
  },
  {
    id: 'league',
    index: '۰۸',
    eyebrow: 'انگیزه',
    title: 'لیگ تپش',
    subtitle: 'ادامه دادن، وقتی تنها هستی هم ممکن است.',
    description: 'امتیاز تپش (Heart) جمع کن، جایگاهت را ببین و چالش هفتگی را کامل کن.',
    cta: 'ورود به لیگ',
    accent: 'orange',
    layout: 'compact',
    visualType: 'league',
    href: dashboardHref({ section: 'league' }),
  },
];

/* ── فراخوان پایانی ── */
const PRODUCTS_OUTRO = {
  heading: 'همه ابزارهای یادگیری، یک‌جا.',
  text: 'تپش فقط مجموعه‌ای از ابزارها نیست؛ یک محیط یکپارچه برای یادگیری پزشکی است.',
  cta: 'شروع یادگیری',
  href: dashboardHref({ section: 'courses', layer: LAYER_IDS.comprehensive }),
};

/* گره‌های نمودار پایانی — همان محصولات، به شکل یک سیستم واحد */
const ECOSYSTEM_NODES = [
  { id: 'lessons', label: 'درسنامه', accent: 'purple' },
  { id: 'bank', label: 'بانک تست', accent: 'blue' },
  { id: 'flashcards', label: 'فلش‌کارت', accent: 'green' },
  { id: 'wiki', label: 'ویکی', accent: 'copper' },
  { id: 'knowledge', label: 'شبکه دانش', accent: 'gold' },
  { id: 'examBuilder', label: 'آزمون‌ساز', accent: 'blue' },
  { id: 'coordinatedExams', label: 'آزمون هماهنگ', accent: 'red' },
  { id: 'league', label: 'لیگ', accent: 'orange' },
];

/* ── داده‌های درون پیش‌نمایش‌ها ──
   این‌ها «رابطِ محصول» هستند، نه آمار ادعایی؛ همان چیزی که کاربر داخل محصول
   می‌بیند. هیچ عددی به عنوان دستاوردِ تپش در متن‌های معرفی نیامده است. */

const READER_PREVIEW = {
  chapter: 'فصل ۴ · فیزیولوژی قلب',
  title: 'پتانسیل عمل سلول‌های میوکارد',
  sidebar: [
    { label: 'مقدمه', active: false },
    { label: 'کانال‌های یونی', active: true },
    { label: 'فاز‌های پتانسیل عمل', active: false },
    { label: 'دورهٔ تحریک‌ناپذیری', active: false },
    { label: 'نکات مهم', active: false },
  ],
  paragraphs: [
    'سلول‌های میوکارد برخلاف سلول‌های اسکلتی، پس از شروع پتانسیل عمل مدتی طولانی در فاز پلاتو می‌مانند؛ این مکث همان چیزی است که اجازه نمی‌دهد قلب دچار تتانوس شود.',
    'ورود کلسیم از کانال‌های نوع L در فاز پلاتو، هم پتانسیل را طولانی می‌کند و هم پیام شیمیایی انقباض را به سارکومر می‌رساند.',
  ],
  highlight: 'مکثِ فاز پلاتو دلیلِ نبودِ تتانوس در عضلهٔ قلبی است.',
  note: 'نکتهٔ مهم: هر دارویی که کانال کلسیمی نوع L را مهار کند، قدرت انقباض را هم کم می‌کند.',
  progress: 62,
  pageLabel: 'صفحه ۱۲۴ از ۲۰۱',
};

const QUESTION_BANK_PREVIEW = {
  topic: 'فیزیولوژی · قلب',
  number: 14,
  total: 30,
  difficulty: 'متوسط',
  timer: '۰۰:۴۲',
  question: 'کدام مورد دلیل اصلی نبودِ تتانوس در عضلهٔ قلبی است؟',
  options: [
    { id: 'a', text: 'کوتاه بودن دورهٔ تحریک‌ناپذیری مطلق' },
    { id: 'b', text: 'طولانی بودن فاز پلاتوی پتانسیل عمل', correct: true },
    { id: 'c', text: 'نبودِ کانال‌های سدیمی وابسته به ولتاژ' },
    { id: 'd', text: 'سرعت بالای هدایت در گرهٔ دهلیزی‌بطنی' },
  ],
  analysis: {
    correctPercent: 74,
    responseTime: '۳۸ ثانیه',
    weak: ['فارماکولوژی قلب', 'الکتروفیزیولوژی'],
    strong: ['همودینامیک', 'آناتومی قلب'],
    solved: 428,
    trend: [38, 44, 41, 52, 58, 63, 71],
  },
};

const FLASHCARD_PREVIEW = {
  front: 'دورهٔ تحریک‌ناپذیری مؤثر',
  back: 'بازه‌ای که در آن هیچ محرکی — هرقدر قوی — پتانسیل عمل تازه‌ای ایجاد نمی‌کند؛ طولش تقریباً برابرِ فاز پلاتو است.',
  due: 24,
  mastery: 72,
  streak: 12,
};

const KNOWLEDGE_GRAPH_PREVIEW = {
  center: { id: 'diabetes', label: 'دیابت' },
  nodes: [
    {
      id: 'physiology',
      label: 'فیزیولوژی',
      detail: 'تنظیم گلوکز و نقش انسولین در بافت هدف',
      courses: 4,
      articles: 12,
      questions: 86,
    },
    {
      id: 'biochemistry',
      label: 'بیوشیمی',
      detail: 'مسیرهای گلیکولیز و گلوکونئوژنز',
      courses: 3,
      articles: 9,
      questions: 74,
    },
    {
      id: 'anatomy',
      label: 'آناتومی',
      detail: 'جزایر لانگرهانس و ساختار پانکراس',
      courses: 2,
      articles: 5,
      questions: 31,
    },
    {
      id: 'pathology',
      label: 'پاتولوژی',
      detail: 'تغییرات عروقی و آسیب اندام‌های هدف',
      courses: 3,
      articles: 11,
      questions: 68,
    },
    {
      id: 'pharmacology',
      label: 'فارماکولوژی',
      detail: 'مهارکننده‌های SGLT2 و biguanideها',
      courses: 2,
      articles: 8,
      questions: 52,
    },
  ],
};

const WIKI_PREVIEW = {
  placeholder: 'مثلاً: Acetylcholine',
  terms: [
    {
      id: 'acetylcholine',
      title: 'Acetylcholine',
      subtitle: 'Neurotransmitter',
      topics: ['Physiology', 'Pharmacology'],
    },
    {
      id: 'acetylcholinesterase',
      title: 'Acetylcholinesterase',
      subtitle: 'Enzyme',
      topics: ['Biochemistry', 'Pharmacology'],
    },
    {
      id: 'acetyl-coa',
      title: 'Acetyl-CoA',
      subtitle: 'Metabolite',
      topics: ['Biochemistry'],
    },
    {
      id: 'acid-base',
      title: 'Acid–Base Balance',
      subtitle: 'Physiology',
      topics: ['Physiology', 'Nephrology'],
    },
    {
      id: 'action-potential',
      title: 'Action Potential',
      subtitle: 'Physiology',
      topics: ['Physiology', 'Neuroscience'],
    },
  ],
};

const EXAM_BUILDER_PREVIEW = {
  groups: [
    { id: 'subject', label: 'درس', options: ['فیزیولوژی', 'بیوشیمی', 'آناتومی'] },
    { id: 'topic', label: 'مبحث', options: ['قلب', 'کلیه', 'غدد'] },
    { id: 'count', label: 'تعداد سؤال', options: ['۱۰', '۲۰', '۳۰'] },
    { id: 'difficulty', label: 'سطح سختی', options: ['آسان', 'متوسط', 'سخت'] },
    { id: 'time', label: 'زمان', options: ['۱۵ دقیقه', '۳۰ دقیقه', 'آزاد'] },
    { id: 'kind', label: 'نوع آزمون', options: ['آموزشی', 'زمان‌دار'] },
  ],
  cta: 'ساخت آزمون',
  running: {
    label: 'آزمون آماده شد',
    question: 'کدام نفرون بیشترین توانایی تغلیظ ادرار را دارد؟',
    options: ['نفرون کورتیکال', 'نفرون جاکستامدولاری'],
    timer: '۲۹:۵۴',
    progress: 2,
    total: 30,
  },
};

const COORDINATED_EXAM_PREVIEW = {
  title: 'آزمون هماهنگ علوم پایه',
  participants: 12480,
  rank: 342,
  average: '۱۳٫۸',
  days: 3,
  hours: 7,
  minutes: 20,
};

const LEAGUE_PREVIEW = {
  position: 4,
  university: 'دانشگاه علوم پزشکی تهران',
  hearts: 8640,
  challenge: '۳۰ تست فیزیولوژی قلب',
  achievements: ['۷ روز پیاپی', '۱۰۰ تست هفته', 'مرور کامل'],
  rows: [
    { rank: 1, name: 'سارا م.', university: 'تهران', hearts: 12400 },
    { rank: 2, name: 'امیر ح.', university: 'شهید بهشتی', hearts: 11800 },
    { rank: 3, name: 'نرگس ر.', university: 'اصفهان', hearts: 10200 },
    { rank: 4, name: 'شما', university: 'تهران', hearts: 8640, isYou: true },
  ],
};

/* ── خواننده‌ها (شکل نهایی: پاسخ JSON همان API) ── */
export const getProducts = () => PRODUCTS;
export const getProductsIntro = () => PRODUCTS_INTRO;
export const getProductsOutro = () => PRODUCTS_OUTRO;
export const getEcosystemNodes = () => ECOSYSTEM_NODES;

export const getReaderPreview = () => READER_PREVIEW;
export const getQuestionBankPreview = () => QUESTION_BANK_PREVIEW;
export const getFlashcardPreview = () => FLASHCARD_PREVIEW;
export const getKnowledgeGraphPreview = () => KNOWLEDGE_GRAPH_PREVIEW;
export const getWikiPreview = () => WIKI_PREVIEW;
export const getExamBuilderPreview = () => EXAM_BUILDER_PREVIEW;
export const getCoordinatedExamPreview = () => COORDINATED_EXAM_PREVIEW;
export const getLeaguePreview = () => LEAGUE_PREVIEW;

/* محصولِ شاخص — همان که نمای بزرگِ تمام‌عرض را می‌گیرد */
export const getFeaturedProduct = () => PRODUCTS.find((product) => product.featured) ?? PRODUCTS[0];
