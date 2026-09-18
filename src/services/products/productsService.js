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
 *                 panels   بلوکِ تمام‌عرض با کادرهای چرخان
 *                 duo      کارتِ ستونی در ردیف دو‌تایی
 *                 feature  بخشِ بزرگِ میانی (فقط یکی)
 *                 compact  کارتِ فشرده در ردیف سه‌تایی
 *   visualType  کلیدِ پیش‌نمایش تعاملی (نگاشت در ProductVisual)
 *   href        مقصد واقعی محصول در داشبورد — نه لنگرِ تزیینی
 *
 * دو میدانِ اختیاریِ دیگر، ریتم را از داده می‌سازند (نه از کامپوننت):
 *   sheets      برگه‌های پشت‌سرهمِ نمای بزرگ (`showcase`) — با اسکرول ورق می‌خورند
 *   panels      کادرهای چرخانِ بلوکِ `panels` — برچسب‌ها در یک ردیف
 *
 * `href` با همان قراردادی ساخته می‌شود که `dashboardRoute` می‌خواند، و کلیدهای
 * لایه از خودِ `LAYER_IDS` می‌آیند تا با تغییر نام یک لایه، اینجا از کار نیفتد.
 *
 * دو جا دادهٔ «قرضی» آمده و از سرویسِ صاحبش خوانده می‌شود، نه بازنویسی:
 *   · «مقالات تپش» از `services/articles` (عنوان و دستهٔ واقعی همان مقالات)
 *   · پله‌های مرور از `services/reviewNotebook` (همان G5)
 */

import { LAYER_IDS } from '../../layout/dashboard/dashboardRoute';
import { ARTICLES, CATEGORIES } from '../articles/mockData';
import { G5_STAGES } from '../reviewNotebook/reviewNotebookService';

import coursesHero from '../../../images/pictures/courses-hero.jpg';
import testBankHero from '../../../images/pictures/test-bank-hero.png';
import knowledgeNetwork from '../../../images/pictures/knowledge-network.jpg';

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
  headingTop: 'محصولات',
  headingAccent: 'تپش',
  heading: 'محصولات تپش',
  subheading: 'از یادگیری عمیق و مرور هوشمند تا آزمون، تحلیل و ساختن شبکه‌ای از دانش.',
};

/*
 * ── برگه‌های نمای بزرگ ──
 * خانوادهٔ دوره‌ها؛ هنگام اسکرول یکی‌یکی ورق می‌خورند. برگهٔ اول خودِ
 * «درسنامه جامع» است و تصویر سرتیترش را حمل می‌کند.
 */
const LESSON_SHEETS = [
  {
    id: 'comprehensive',
    title: 'درسنامه جامع',
    tagline: 'پوشش کامل دروس پایه با درسنامه و تست',
    accent: 'green',
    cover: coursesHero,
    href: dashboardHref({ section: 'courses', layer: LAYER_IDS.comprehensive }),
  },
  {
    id: 'micro',
    title: 'میکرو درسنامه',
    tagline: 'خلاصهٔ سریع درس‌ها برای مرور فشرده',
    accent: 'purple',
    href: dashboardHref({ section: 'courses', layer: LAYER_IDS.micro }),
  },
  {
    id: 'reference',
    title: 'رفرنس',
    tagline: 'مرجع کامل نکات و جدول‌ها',
    accent: 'gold',
    href: dashboardHref({ section: 'courses', layer: LAYER_IDS.reference }),
  },
  {
    id: 'green-path',
    title: 'مسیر سبز',
    tagline: 'مسیر ساختار‌یافته برای معدل الف',
    accent: 'green',
    href: dashboardHref({ section: 'courses', layer: LAYER_IDS.greenPath }),
  },
  {
    id: 'international',
    title: 'دوره‌های بین‌الملل',
    tagline: 'USMLE · PLAB · AMC · MCCQE · IFOM',
    accent: 'blue',
    href: dashboardHref({ section: 'courses', layer: LAYER_IDS.intlCourses }),
  },
];

/*
 * ── کادرهای چرخانِ بانک تست ──
 * برچسب‌ها یک ردیف‌اند و کادرِ فعال با انیمیشن عوض می‌شود. `visual` می‌گوید
 * هر کادر با کدام پیش‌نمایش پر شود؛ همهٔ مقصدها لایهٔ واقعیِ داشبوردند.
 */
const TEST_PANELS = [
  {
    id: 'bank',
    label: 'بانک تست',
    title: 'بانک تست علوم پایه',
    text: 'تست‌های طبقه‌بندی‌شده با پاسخ تشریحی؛ هر سؤال با درس، مبحث، سال و سطح دشواری برچسب خورده است.',
    accent: 'blue',
    visual: 'image',
    cover: testBankHero,
    href: dashboardHref({ section: 'tests', layer: LAYER_IDS.testBank }),
  },
  {
    id: 'analysis',
    label: 'آنالیز شخصی',
    title: 'آنالیز وضعیت',
    text: 'درصد پاسخ صحیح، زمان پاسخ‌گویی و موضوعات ضعیف و قوی کنار هم می‌آیند تا بدانی کجا وقت کم می‌آوری.',
    accent: 'purple',
    visual: 'analysis',
    stats: [
      { label: 'پاسخ صحیح', value: '۷۴٪' },
      { label: 'زمان پاسخ', value: '۳۸ ثانیه' },
      { label: 'تست حل‌شده', value: '۴۲۸' },
    ],
    bars: [38, 52, 44, 67, 58, 74],
    href: dashboardHref({ section: 'tests', layer: LAYER_IDS.analytics }),
  },
  {
    id: 'coordinated',
    label: 'آزمون‌های هماهنگ',
    title: 'آزمون‌های هماهنگ‌شده',
    text: 'آزمون‌های جامع و درس‌به‌درس با شرکت‌کنندگان سراسر کشور؛ رتبه و میانگین واقعی، نه تخمینی.',
    accent: 'red',
    visual: 'coordinated',
    stats: [
      { label: 'شرکت‌کننده', value: '۱۲٬۴۸۰' },
      { label: 'رتبهٔ شما', value: '۳۴۲' },
      { label: 'میانگین', value: '۱۳٫۸' },
    ],
    href: dashboardHref({ section: 'tests', layer: LAYER_IDS.coordinated }),
  },
  {
    id: 'international',
    label: 'آزمون‌های بین‌الملل',
    title: 'آزمون‌های بین‌الملل',
    text: 'سؤال‌های هم‌سو با آزمون‌های بین‌المللی پزشکی، با پاسخ تشریحی و تحلیل عملکرد.',
    accent: 'green',
    visual: 'international',
    exams: ['USMLE', 'PLAB', 'AMC', 'MCCQE', 'IFOM'],
    stats: [
      { label: 'تست حل‌شده', value: '۲۴۰' },
      { label: 'دقت پاسخ', value: '۶۸٪' },
    ],
    href: dashboardHref({ section: 'tests', layer: LAYER_IDS.intlExams }),
  },
];

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
    accent: 'green',
    layout: 'showcase',
    featured: true,
    visualType: 'sheets',
    sheets: LESSON_SHEETS,
    href: dashboardHref({ section: 'courses', layer: LAYER_IDS.comprehensive }),
  },
  {
    id: 'bank',
    index: '۰۲',
    eyebrow: 'تمرین',
    title: 'بانک تست علوم پایه',
    subtitle: 'تمرین کن. تحلیل کن. بهتر شو.',
    description:
      'بانک تست تپش فقط سؤال نیست؛ سه کادر کنارش هم دارند: آنالیز شخصی، آزمون‌های هماهنگ و آزمون‌های بین‌الملل.',
    cta: 'ورود به بانک تست',
    accent: 'blue',
    layout: 'panels',
    visualType: null,
    panels: TEST_PANELS,
    href: dashboardHref({ section: 'tests', layer: LAYER_IDS.testBank }),
  },
  {
    id: 'examBuilder',
    index: '۰۳',
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
    id: 'articles',
    index: '۰۴',
    eyebrow: 'خواندن',
    title: 'مقالات تپش',
    subtitle: 'یک مفهوم را باز کن؛ عمیق‌تر برو.',
    description:
      'مقاله‌های علوم پایه، فیزیولوژی و مهارت مطالعه؛ کوتاه، دقیق و متصل به مسیر یادگیری تو.',
    cta: 'رفتن به مقالات',
    accent: 'copper',
    layout: 'duo',
    visualType: 'articles',
    heroStyle: 'articles',
    href: '#articles',
  },
  {
    id: 'wiki',
    index: '۰۵',
    eyebrow: 'مرجع',
    title: 'ویکی تپش',
    subtitle: 'موتور کشف دانش پزشکی — جست‌وجو کن، بفهم، بین مفاهیم حرکت کن.',
    description:
      'از مخفف‌ها و مترادف‌ها تا شبکهٔ ارتباط مفاهیم بالینی و پایه؛ هر مفهوم به مقاله و تست همان مبحث وصل است.',
    cta: 'ورود به ویکی',
    accent: 'copper',
    layout: 'duo',
    visualType: 'wikiHeader',
    heroStyle: 'wiki',
    href: dashboardHref({ section: 'other', layer: LAYER_IDS.wiki }),
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
    cover: knowledgeNetwork,
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
    id: 'reviewNotebook',
    index: '۰۷',
    eyebrow: 'مرور',
    title: 'دفترچهٔ مرور',
    subtitle: 'هرچه یاد گرفتی، سر وقت برمی‌گردد.',
    description:
      'هر مبحثی که یاد می‌گیری وارد پله‌های مرور می‌شود؛ سرِ موعد خودش یادآوری می‌شود تا ماندگار شود.',
    cta: 'ورود به دفترچهٔ مرور',
    accent: 'copper',
    layout: 'compact',
    visualType: 'reviewNotebook',
    href: dashboardHref({ section: 'review-notebook' }),
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
  heading: 'همه ابزارهای یادگیری، یک‌جا',
  text: 'تپش فقط مجموعه‌ای از ابزارها نیست؛ یک محیط یکپارچه برای یادگیری پزشکی است.',
  cta: 'شروع یادگیری',
  href: dashboardHref({ section: 'courses', layer: LAYER_IDS.comprehensive }),
};

/* گره‌های نمودار پایانی — همان محصولات، به شکل یک سیستم واحد */
const ECOSYSTEM_NODES = [
  { id: 'lessons', label: 'درسنامه', accent: 'green' },
  { id: 'bank', label: 'بانک تست', accent: 'blue' },
  { id: 'flashcards', label: 'فلش‌کارت', accent: 'green' },
  { id: 'wiki', label: 'ویکی', accent: 'copper' },
  { id: 'knowledge', label: 'شبکه دانش', accent: 'gold' },
  { id: 'examBuilder', label: 'آزمون‌ساز', accent: 'blue' },
  { id: 'reviewNotebook', label: 'دفترچهٔ مرور', accent: 'copper' },
  { id: 'league', label: 'لیگ', accent: 'orange' },
];

/* ── داده‌های درون پیش‌نمایش‌ها ──
   این‌ها «رابطِ محصول» هستند، نه آمار ادعایی؛ همان چیزی که کاربر داخل محصول
   می‌بیند. هیچ عددی به عنوان دستاوردِ تپش در متن‌های معرفی نیامده است. */

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

/*
 * ── مقالات تپش ──
 * از خودِ سرویس مقالات خوانده می‌شود (عنوان و دستهٔ واقعی)، نه فهرستِ ساختگی.
 * فقط چند میدانِ لازم برداشته می‌شود تا این پیش‌نمایش به بدنهٔ مقاله وابسته نشود.
 */
const ARTICLE_PREVIEW = ARTICLES.filter((article) => article.recommended)
  .slice(0, 3)
  .map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    category: CATEGORIES.find((entry) => entry.id === article.category)?.label ?? '',
    readingTime: article.readingTime,
  }));

const REVIEW_NOTEBOOK_PREVIEW = {
  dueToday: 4,
  /* پله‌های واقعیِ G5 — همان چیزی که سرویس دفترچهٔ مرور می‌خواند */
  stages: G5_STAGES.map((stage) => stage.label),
  items: [
    { id: 'rv-1', title: 'پتانسیل عمل میوکارد', subject: 'فیزیولوژی', stage: 3, due: 'امروز' },
    { id: 'rv-2', title: 'چرخهٔ کربس', subject: 'بیوشیمی', stage: 2, due: 'فردا' },
    { id: 'rv-3', title: 'جزایر لانگرهانس', subject: 'آناتومی', stage: 1, due: '۳ روز دیگر' },
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

/* آزمون‌های بین‌الملل — فقط نامِ آزمون‌ها؛ هیچ ادعای آماری پشتشان نیست */
const INTERNATIONAL_EXAMS_PREVIEW = {
  title: 'آزمون‌های بین‌الملل',
  exams: ['USMLE', 'PLAB', 'AMC', 'MCCQE', 'IFOM'],
  solved: 240,
  accuracy: 68,
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

export const getQuestionBankPreview = () => QUESTION_BANK_PREVIEW;
export const getFlashcardPreview = () => FLASHCARD_PREVIEW;
export const getArticlePreview = () => ARTICLE_PREVIEW;
export const getReviewNotebookPreview = () => REVIEW_NOTEBOOK_PREVIEW;
export const getExamBuilderPreview = () => EXAM_BUILDER_PREVIEW;
export const getCoordinatedExamPreview = () => COORDINATED_EXAM_PREVIEW;
export const getInternationalExamsPreview = () => INTERNATIONAL_EXAMS_PREVIEW;
export const getLeaguePreview = () => LEAGUE_PREVIEW;

/* محصولِ شاخص — همان که نمای بزرگِ تمام‌عرض را می‌گیرد */
export const getFeaturedProduct = () => PRODUCTS.find((product) => product.featured) ?? PRODUCTS[0];
