/*
 * کاتالوگ خالص «دوره‌های بین‌الملل» — تک منبع حقیقتِ seed و fallback.
 *
 * چرا این فایل وجود دارد: مثل `referenceCatalog.js`، دادهٔ ثابتِ لایه باید هم
 * برای seed سرور (`contentStore.js`) خوانده شود و هم سمت مرورگر fallback باشد.
 * پس اینجا **هیچ import تصویری نیست** (نود نمی‌تواند `.webp` را import کند)؛
 * به‌جای آدرس فایل، کلید دارایی (`imageKey`/`logoKey`) نگه داشته می‌شود و
 * نگاشت کلید→آدرس باندل‌شده در `intlAssets.js` سمت مرورگر است.
 *
 * شکل داده — هر دوره یک موجودیت کامل است (فراداده + بخش‌ها و ویدیوهایش) و
 * هر منبع (دانشگاه/نهاد) یک رکورد جدا. ناشر دوره فقط با `providerId` به منبع
 * وصل می‌شود تا نام و لوگو یک منبع حقیقت داشته باشد و ویرایش منبع، همه‌جا اثر کند.
 */

/* نوع دوره — فیلترهای کاتالوگ از همین فهرست ساخته می‌شوند */
export const INTL_COURSE_CATEGORIES = [
  { id: 'medicine', label: 'پزشکی و سلامت' },
  { id: 'science', label: 'علوم پایه' },
  { id: 'skills', label: 'مهارت‌های دانشگاهی' },
  { id: 'media', label: 'رسانه و تفکر' },
];

export const INTL_LEVELS = ['مقدماتی', 'متوسط', 'پیشرفته'];

/*
 * زبان‌های پیشنهادی زیرنویس — فقط **پیشنهاد** برای فرم پنل.
 *
 * زبان روی هر زیرنویس رشتهٔ آزاد است (مدیر می‌تواند هر زبانی اضافه کند) و این
 * فهرست تنها برای پر کردن سریع کد زبان و برچسب پیش‌فرض است. سمت کاربر هم
 * فهرست زیرنویس‌ها از خودِ زیرنویس‌های بارگذاری‌شده ساخته می‌شود، نه از اینجا.
 */
export const INTL_SUBTITLE_LANGS = [
  { id: 'fa', label: 'فارسی' },
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'ru', label: 'Русский' },
  { id: 'zh', label: '中文' },
];

/* نوع منبع (دانشگاه / رسانه / نشریه / نهاد) */
export const INTL_PROVIDER_KINDS = [
  { id: 'university', label: 'دانشگاه' },
  { id: 'media', label: 'رسانه آموزشی' },
  { id: 'journal', label: 'نشریه علمی' },
  { id: 'organization', label: 'نهاد بین‌المللی' },
];

/*
 * فایل‌های مجاز بارگذاری ویدیو و زیرنویس.
 * پسوندها اینجا متمرکزند تا کلاینت (`accept` فیلد فایل) و سرور (اعتبارسنجی
 * واقعی) از یک فهرست بخوانند و از هم دور نیفتند.
 */
export const INTL_VIDEO_MIME_EXTENSIONS = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
};

export const INTL_SUBTITLE_MIME_EXTENSIONS = {
  'text/vtt': 'vtt',
  'application/x-subrip': 'srt',
  'text/plain': 'srt',
};

export const INTL_UPLOAD_MIME_EXTENSIONS = {
  ...INTL_VIDEO_MIME_EXTENSIONS,
  ...INTL_SUBTITLE_MIME_EXTENSIONS,
};

/*
 * پسوندهای هر گروه — تنها مرجع «این فایل ویدیو است یا زیرنویس».
 *
 * چرا پسوند مقدم است نه نوع مرورگر: مرورگرها برای زیرنویس قابل اتکا نیستند.
 * کروم روی مک `.vtt` را گاهی `text/plain` و `.srt` را خالی اعلام می‌کند؛ اگر
 * فقط به نوع مرورگر تکیه کنیم، زیرنویس یا رد می‌شود یا با پسوند اشتباه
 * (`srt` به‌جای `vtt`) ذخیره می‌شود — همان «قاطی شدن با فرمت ویدیو».
 */
export const INTL_VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'mov', 'mkv'];
export const INTL_SUBTITLE_EXTENSIONS = ['vtt', 'srt'];
export const INTL_UPLOAD_EXTENSIONS = [...INTL_VIDEO_EXTENSIONS, ...INTL_SUBTITLE_EXTENSIONS];

/*
 * پسوند → نوع MIME. **صریح** نوشته می‌شود، نه با معکوس‌کردن نگاشت بالا:
 * `text/plain` هم به `srt` نگاشت شده و معکوس‌سازی خودکار، کلید تکراری `srt` را
 * با `text/plain` بازنویسی می‌کرد.
 */
export const INTL_UPLOAD_EXTENSION_MIME = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  vtt: 'text/vtt',
  srt: 'application/x-subrip',
};

/* رشتهٔ `accept` هر فیلد فایل — از همان فهرست ساخته می‌شود تا با سرور یکی بماند */
export const INTL_VIDEO_ACCEPT = [
  ...INTL_VIDEO_EXTENSIONS.map((extension) => `.${extension}`),
  ...Object.keys(INTL_VIDEO_MIME_EXTENSIONS),
].join(',');

export const INTL_SUBTITLE_ACCEPT = [
  ...INTL_SUBTITLE_EXTENSIONS.map((extension) => `.${extension}`),
  ...Object.keys(INTL_SUBTITLE_MIME_EXTENSIONS),
].join(',');

export const INTL_UPLOAD_ACCEPT = [
  ...INTL_UPLOAD_EXTENSIONS.map((extension) => `.${extension}`),
  ...Object.keys(INTL_UPLOAD_MIME_EXTENSIONS),
].join(',');

/* پسوند فایل — کوچک و بدون نقطه؛ رشتهٔ خالی اگر پسوندی نباشد */
export function extensionOfName(name) {
  const text = String(name ?? '');
  const dot = text.lastIndexOf('.');
  return dot === -1 ? '' : text.slice(dot + 1).toLowerCase();
}

export function uploadExtensionOf(file) {
  return extensionOfName(file?.name);
}

/*
 * پسوند ذخیره‌سازی یک بارگذاری (سرور). پسوند نام فایل مقدم است — مرورگر برای
 * زیرنویس نوع قابل اتکا نمی‌فرستد — و اگر پسوند ناشناخته بود، نوع اعلامی
 * مرورگر باید در فهرست مجاز باشد. خروجی خالی یعنی «پشتیبانی نمی‌شود».
 */
export function uploadExtensionFor(name, mimeType) {
  const extension = extensionOfName(name);
  if (INTL_UPLOAD_EXTENSIONS.includes(extension)) return extension;
  return INTL_UPLOAD_MIME_EXTENSIONS[String(mimeType ?? '').toLowerCase()] ?? '';
}

/* «video» یا «subtitle» یا خالی — پسوند مقدم است، بعد نوع مرورگر */
export function uploadKindOf(file) {
  const extension = uploadExtensionOf(file);
  if (INTL_VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (INTL_SUBTITLE_EXTENSIONS.includes(extension)) return 'subtitle';

  const type = String(file?.type ?? '').toLowerCase();
  if (INTL_VIDEO_MIME_EXTENSIONS[type]) return 'video';
  if (INTL_SUBTITLE_MIME_EXTENSIONS[type]) return 'subtitle';
  return '';
}

/*
 * نوع MIME برای بارگذاری: اگر پسوند شناخته باشد، از پسوند (قابل اتکا)، وگرنه
 * از نوع مرورگر. `kind` اجازه نمی‌دهد فایل گروه دیگر بی‌صدا از این فیلتر رد شود.
 * خروجی خالی یعنی «پشتیبانی نمی‌شود».
 */
export function uploadMimeOf(file, kind = '') {
  const extension = uploadExtensionOf(file);
  const known = INTL_UPLOAD_EXTENSIONS.includes(extension);
  const resolvedKind = known ? uploadKindOf(file) : '';

  if (kind && resolvedKind && resolvedKind !== kind) return '';
  if (known) return INTL_UPLOAD_EXTENSION_MIME[extension];

  const type = String(file?.type ?? '').toLowerCase();
  if (!INTL_UPLOAD_MIME_EXTENSIONS[type]) return '';
  if (kind && uploadKindOf(file) !== kind) return '';
  return type;
}

/* سقف پیش‌فرض بارگذاری ویدیو (مگابایت) — قابل تغییر در تنظیمات سایت */
export const INTL_DEFAULT_MAX_VIDEO_MB = 512;

/*
 * منابع (دانشگاه‌ها و مراجع). `sortOrder` ترتیب فهرست پنل است و
 * `marqueeOrder` ترتیب نوار متحرک؛ صفر یعنی «در نوار نمایش داده نشود».
 * منابعی که دوره‌ای در تپش ندارند هم رکورد دارند (مثل ژورنال نیوانگلند) تا
 * فقط در نوار دیده شوند.
 */
export const INTL_PROVIDER_CATALOG = [
  {
    id: 'harvard',
    name: 'دانشگاه هاروارد',
    nameEn: 'Harvard University',
    kind: 'university',
    country: 'ایالات متحده',
    founded: '۱۶۳۶',
    description: 'قدیمی‌ترین دانشگاه آمریکا و یکی از قطب‌های پژوهش سلامت در جهان؛ دانشکدهٔ پزشکی و مدرسهٔ سلامت عمومی آن مرجع آموزش اپیدمیولوژی و سیاست‌گذاری درمانی‌اند.',
    focus: ['سلامت عمومی', 'اپیدمیولوژی', 'سیاست سلامت'],
    logoKey: 'harvard',
    sortOrder: 10,
    marqueeOrder: 0,
  },
  {
    id: 'mit',
    name: 'موسسه فناوری ماساچوست',
    nameEn: 'MIT OpenCourseWare',
    kind: 'university',
    country: 'ایالات متحده',
    founded: '۱۸۶۱',
    description: 'مؤسسهٔ فناوری ماساچوست با انتشار آزاد درس‌هایش، مدل‌های علمی را ساده و تصویری توضیح می‌دهد؛ تمرکزش بر روش‌شناسی و تفکر کمّی است.',
    focus: ['تفکر علمی', 'مدل‌سازی', 'آموزش باز'],
    logoKey: 'mit',
    sortOrder: 20,
    marqueeOrder: 0,
  },
  {
    id: 'cambridge',
    name: 'دانشگاه کمبریج',
    nameEn: 'University of Cambridge',
    kind: 'university',
    country: 'بریتانیا',
    founded: '۱۲۰۹',
    description: 'دانشگاه کمبریج در آموزش زبان آکادمیک و مهارت‌های مطالعهٔ منابع انگلیسی پیشتاز است؛ دوره‌هایش برای خواندن مقاله و سخنرانی دانشگاهی طراحی شده‌اند.',
    focus: ['زبان آکادمیک', 'مقاله‌خوانی', 'نوشتن علمی'],
    logoKey: 'cambridge',
    sortOrder: 30,
    marqueeOrder: 50,
  },
  {
    id: 'bbc',
    name: 'بی‌بی‌سی ماندارین',
    nameEn: 'BBC Learning',
    kind: 'media',
    country: 'بریتانیا',
    founded: '۱۹۲۲',
    description: 'بخش آموزشی بی‌بی‌سی محتوای کوتاه و کاربردی برای سواد رسانه‌ای می‌سازد؛ تمرکزش بر ارزیابی منبع، تشخیص شایعه و خواندن درست داده است.',
    focus: ['سواد رسانه‌ای', 'منبع‌شناسی', 'تفکر انتقادی'],
    logoKey: 'bbc',
    sortOrder: 40,
    marqueeOrder: 0,
  },
  {
    id: 'toronto',
    name: 'دانشگاه تورنتو',
    nameEn: 'University of Toronto',
    kind: 'university',
    country: 'کانادا',
    founded: '۱۸۲۷',
    description: 'دانشگاه تورنتو یکی از قطب‌های علوم اعصاب و روان‌شناسی شناختی است؛ پژوهش‌هایش دربارهٔ حافظه، توجه و شکل‌گیری عادت در دوره‌هایش بازتاب یافته.',
    focus: ['علوم اعصاب', 'حافظه', 'یادگیری'],
    logoKey: 'toronto',
    sortOrder: 50,
    marqueeOrder: 0,
  },
  {
    id: 'oxford',
    name: 'دانشگاه آکسفورد',
    nameEn: 'University of Oxford',
    kind: 'university',
    country: 'بریتانیا',
    founded: '۱۰۹۶',
    description: 'دانشگاه آکسفورد با سنت پژوهش کیفی و کمّی، چارچوبی روشن برای طراحی مطالعه، نقد مقاله و نتیجه‌گیری مسئولانه ارائه می‌دهد.',
    focus: ['روش تحقیق', 'نقد مقاله', 'داده‌خوانی'],
    logoKey: 'oxford',
    sortOrder: 60,
    marqueeOrder: 40,
  },
  {
    id: 'harvard-med',
    name: 'دانشکدهٔ پزشکی هاروارد',
    nameEn: 'Harvard Medical School',
    kind: 'university',
    country: 'ایالات متحده',
    founded: '۱۷۸۲',
    description: '',
    focus: [],
    logoKey: 'harvard-med',
    sortOrder: 70,
    marqueeOrder: 10,
  },
  {
    id: 'johns-hopkins',
    name: 'دانشگاه جانز هاپکینز',
    nameEn: 'Johns Hopkins University',
    kind: 'university',
    country: 'ایالات متحده',
    founded: '۱۸۷۶',
    description: '',
    focus: [],
    logoKey: 'johns-hopkins',
    sortOrder: 80,
    marqueeOrder: 20,
  },
  {
    id: 'stanford-med',
    name: 'دانشکدهٔ پزشکی استنفورد',
    nameEn: 'Stanford School of Medicine',
    kind: 'university',
    country: 'ایالات متحده',
    founded: '۱۹۰۸',
    description: '',
    focus: [],
    logoKey: 'stanford-med',
    sortOrder: 90,
    marqueeOrder: 30,
  },
  {
    id: 'nejm',
    name: 'ژورنال پزشکی نیوانگلند',
    nameEn: 'New England Journal of Medicine',
    kind: 'journal',
    country: 'ایالات متحده',
    founded: '۱۸۱۲',
    description: '',
    focus: [],
    logoKey: 'nejm',
    sortOrder: 100,
    marqueeOrder: 60,
  },
  {
    id: 'coursera',
    name: 'کورسرا',
    nameEn: 'Coursera',
    kind: 'media',
    country: 'ایالات متحده',
    founded: '۲۰۱۲',
    description: '',
    focus: [],
    logoKey: 'coursera',
    sortOrder: 110,
    marqueeOrder: 70,
  },
  {
    id: 'who',
    name: 'سازمان جهانی بهداشت',
    nameEn: 'World Health Organization',
    kind: 'organization',
    country: 'سوئیس',
    founded: '۱۹۴۸',
    description: '',
    focus: [],
    logoKey: 'who',
    sortOrder: 120,
    marqueeOrder: 80,
  },
  {
    id: 'khan-academy',
    name: 'خان آکادمی',
    nameEn: 'Khan Academy',
    kind: 'media',
    country: 'ایالات متحده',
    founded: '۲۰۰۸',
    description: '',
    focus: [],
    logoKey: 'khan-academy',
    sortOrder: 130,
    marqueeOrder: 90,
  },
];

/* بخش‌های هر دوره در کاتالوگ ثابت — ویدیو و زیرنویسشان خالی است و در پنل پر می‌شود */
const section = (id, time, title, desc) => ({ id, time, title, desc, videoUrl: '', videoMime: '', subtitles: [] });

export const INTL_COURSE_CATALOG = [
  {
    id: 'global-health',
    title: 'نگاهی جهانی به سلامت',
    providerId: 'harvard',
    imageKey: 'global-health',
    category: 'medicine',
    categoryLabel: 'پزشکی و سلامت',
    level: 'مقدماتی',
    duration: 8,
    totalDuration: '۰۸:۴۲:۰۰',
    progress: 64,
    accent: '#5b8cc7',
    accentSoft: '#1d314a',
    badge: 'پربازدید',
    description: 'در این مسیر با چالش‌های سلامت عمومی، نابرابری‌های درمانی و راهکارهای اثرگذار در جوامع مختلف آشنا می‌شوی.',
    tags: ['سلامت عمومی', 'اپیدمیولوژی', 'جامعه'],
    sortOrder: 10,
    sections: [
      section('gh-01', '۰۰:۰۰', 'چرا سلامت عمومی به مرزها محدود نیست؟', 'تفاوت نگاه فردمحور و جامعه‌محور به سلامت و این‌که چرا یک بیماری محلی می‌تواند مسئله‌ای جهانی شود.'),
      section('gh-02', '۰۵:۱۵', 'نابرابری درمانی و نقش جامعه', 'چگونه درآمد، محل زندگی و دسترسی به خدمات، نتیجهٔ درمان را تغییر می‌دهد.'),
      section('gh-03', '۲۲:۲۵', 'خواندن داده‌های سلامت در جهان', 'با شاخص‌های پایه مثل امید به زندگی و مرگ‌ومیر کودکان، وضعیت یک جامعه را بخوان.'),
      section('gh-04', '۳۴:۵۰', 'طراحی مداخله‌های اثرگذار', 'از تشخیص مسئله تا انتخاب مداخله‌ای که واقعاً قابل اجرا و سنجش باشد.'),
      section('gh-05', '۵۰:۳۰', 'جمع‌بندی: از مسئله تا اثر', 'مرور مسیر کامل یک پروژهٔ سلامت عمومی و معیارهای سنجش اثر آن.'),
    ],
  },
  {
    id: 'visual-science',
    title: 'علم را چطور ببینیم؟',
    providerId: 'mit',
    imageKey: 'visual-science',
    category: 'science',
    categoryLabel: 'علوم پایه',
    level: 'متوسط',
    duration: 6,
    totalDuration: '۰۶:۱۸:۰۰',
    progress: 18,
    accent: '#937fcd',
    accentSoft: '#2d2744',
    badge: 'جدید',
    description: 'یک دوره تصویری برای فهم بهتر مدل‌ها، آزمایش‌ها و ایده‌های علمی؛ از مشاهده دقیق تا ساختن یک توضیح قابل اعتماد.',
    tags: ['تفکر علمی', 'مدل‌سازی', 'آزمایش'],
    sortOrder: 20,
    sections: [
      section('vs-01', '۰۰:۰۰', 'دیدن پیش از توضیح دادن', 'تفاوت مشاهدهٔ دقیق با تفسیر شتاب‌زده و تمرین ثبت آنچه واقعاً دیده می‌شود.'),
      section('vs-02', '۰۷:۴۰', 'مدل‌ها چگونه فکر ما را شکل می‌دهند؟', 'مدل‌های علمی ابزار ساده‌سازی‌اند؛ با مثال می‌بینی کجا کمک می‌کنند و کجا گمراه.'),
      section('vs-03', '۲۱:۱۰', 'آزمایش خوب چه چیزی را جدا می‌کند؟', 'نقش گروه شاهد، متغیر و تکرار در این‌که نتیجه به یک علت نسبت داده شود.'),
      section('vs-04', '۳۹:۲۵', 'تصویرسازی برای فهم داده', 'انتخاب شکل درست نمودار و پرهیز از تصویرهایی که داده را بزرگ‌تر از واقع نشان می‌دهند.'),
      section('vs-05', '۵۲:۴۰', 'ساختن یک توضیح قابل اعتماد', 'از مشاهده تا فرضیه و از فرضیه تا توضیحی که دیگران بتوانند بیازمایند.'),
    ],
  },
  {
    id: 'scientific-english',
    title: 'انگلیسی برای مطالعه علمی',
    providerId: 'cambridge',
    imageKey: 'scientific-english',
    category: 'skills',
    categoryLabel: 'مهارت‌های دانشگاهی',
    level: 'متوسط',
    duration: 5,
    totalDuration: '۰۵:۰۵:۰۰',
    progress: 0,
    accent: '#77b787',
    accentSoft: '#20392a',
    badge: 'پیشنهاد تپش',
    description: 'واژگان و الگوهای ضروری برای خواندن مقاله، دنبال کردن ویدیوهای دانشگاهی و نوشتن خلاصه‌های دقیق.',
    tags: ['Academic English', 'مقاله‌خوانی', 'واژگان'],
    sortOrder: 30,
    sections: [
      section('se-01', '۰۰:۰۰', 'نقشهٔ یک مقالهٔ علمی', 'ساختار استاندارد چکیده، روش، نتیجه و بحث و این‌که هر بخش را با چه سرعتی بخوانی.'),
      section('se-02', '۰۶:۲۵', 'واژگان پرتکرار در چکیده‌ها', 'فهرست کوتاهی از فعل‌ها و عبارت‌هایی که در بیشتر چکیده‌ها تکرار می‌شوند.'),
      section('se-03', '۱۹:۴۰', 'دنبال کردن یک سخنرانی دانشگاهی', 'نشانه‌های گفتاری که ساختار سخنرانی را لو می‌دهند و کمکت می‌کنند جا نمانی.'),
      section('se-04', '۳۳:۱۵', 'خلاصه‌نویسی بدون از دست دادن معنا', 'الگوهای جمله‌سازی برای خلاصه‌ای دقیق و بی‌طرف از یک متن علمی.'),
      section('se-05', '۴۴:۵۰', 'تمرین خواندن سریع و دقیق', 'تمرین عملی اسکن متن برای یافتن عدد، نتیجه و محدودیت‌های مطالعه.'),
    ],
  },
  {
    id: 'media-literacy',
    title: 'سواد رسانه‌ای در عصر داده',
    providerId: 'bbc',
    imageKey: 'media-literacy',
    category: 'media',
    categoryLabel: 'رسانه و تفکر',
    level: 'مقدماتی',
    duration: 4,
    totalDuration: '۰۴:۱۲:۰۰',
    progress: 0,
    accent: '#ab8e7c',
    accentSoft: '#3b2e28',
    badge: 'کوتاه و کاربردی',
    description: 'با چند ابزار ساده، خبرها و محتوای آنلاین را دقیق‌تر بخوان، منبع را ارزیابی کن و گرفتار شایعه نشو.',
    tags: ['خبرخوانی', 'منبع‌شناسی', 'داده'],
    sortOrder: 40,
    sections: [
      section('ml-01', '۰۰:۰۰', 'چرا هر چیزی که می‌بینیم خبر نیست؟', 'تفاوت خبر، گزارش، تبلیغ و نظر شخصی و این‌که چرا مرزشان در شبکه‌ها محو می‌شود.'),
      section('ml-02', '۰۴:۵۰', 'ردیابی منبع و تاریخ انتشار', 'چند پرسش ساده برای فهمیدن این‌که خبر از کجا آمده و چه‌قدر تازه است.'),
      section('ml-03', '۱۷:۲۰', 'تصویر، تیتر و خطای ذهن', 'چگونه تیتر و تصویر بیرون از متن، برداشت ما را جهت می‌دهند.'),
      section('ml-04', '۲۸:۴۰', 'خواندن داده در شبکه‌های اجتماعی', 'تشخیص نمودارهای بریده و آمارهای بی‌منبع در محتوای پرطرفدار.'),
      section('ml-05', '۳۸:۰۰', 'چک‌لیست یک خوانندهٔ دقیق', 'چک‌لیست کوتاه و قابل استفادهٔ روزمره پیش از بازنشر هر محتوا.'),
    ],
  },
  {
    id: 'neuroscience',
    title: 'مغز، یادگیری و حافظه',
    providerId: 'toronto',
    imageKey: 'neuroscience',
    category: 'medicine',
    categoryLabel: 'پزشکی و سلامت',
    level: 'متوسط',
    duration: 7,
    totalDuration: '۰۷:۲۶:۰۰',
    progress: 0,
    accent: '#5b8cc7',
    accentSoft: '#1d314a',
    badge: 'منتخب سردبیر',
    description: 'سفر تصویری از نورون تا رفتار؛ سازوکارهای یادگیری، حافظه و شکل‌گیری عادت‌ها را با مثال‌های روزمره دنبال کن.',
    tags: ['علوم اعصاب', 'یادگیری', 'حافظه'],
    sortOrder: 50,
    sections: [
      section('ns-01', '۰۰:۰۰', 'مغز چگونه یادگیری را ثبت می‌کند؟', 'از نورون تا رفتار؛ مرور سادهٔ سازوکاری که تجربه را به حافظه تبدیل می‌کند.'),
      section('ns-02', '۰۸:۱۰', 'توجه، حافظهٔ کاری و حواس‌پرتی', 'چرا ظرفیت توجه محدود است و چه‌طور محیط مطالعه آن را می‌بلعد.'),
      section('ns-03', '۲۴:۳۵', 'نقش خواب در تثبیت خاطره', 'آنچه در خواب با آموخته‌های روز اتفاق می‌افتد و اثر کم‌خوابی بر یادگیری.'),
      section('ns-04', '۴۲:۲۰', 'ساختن عادت‌های پایدار', 'حلقهٔ نشانه، رفتار و پاداش و راه ساختن عادت مطالعهٔ روزانه.'),
      section('ns-05', '۵۹:۱۰', 'تمرین: طراحی برنامهٔ یادگیری', 'تمرین گام‌به‌گام برای چیدن یک برنامهٔ هفتگی بر پایهٔ یافته‌های این دوره.'),
    ],
  },
  {
    id: 'research-methods',
    title: 'از سؤال تا پژوهش معتبر',
    providerId: 'oxford',
    imageKey: 'research-methods',
    category: 'skills',
    categoryLabel: 'مهارت‌های دانشگاهی',
    level: 'پیشرفته',
    duration: 9,
    totalDuration: '۰۹:۱۰:۰۰',
    progress: 0,
    accent: '#77b787',
    accentSoft: '#20392a',
    badge: 'پیشرفته',
    description: 'از تبدیل یک ایده به سؤال پژوهشی تا طراحی مطالعه، خواندن نتایج و ارائه یک نتیجه‌گیری مسئولانه.',
    tags: ['روش تحقیق', 'نقد مقاله', 'داده‌خوانی'],
    sortOrder: 60,
    sections: [
      section('rm-01', '۰۰:۰۰', 'از کنجکاوی تا سؤال پژوهشی', 'تبدیل یک ایدهٔ کلی به سؤالی دقیق، قابل سنجش و قابل پاسخ.'),
      section('rm-02', '۰۹:۳۰', 'انتخاب طراحی مطالعه', 'مقایسهٔ طراحی‌های مقطعی، کوهورت و کارآزمایی و تناسب هرکدام با سؤال.'),
      section('rm-03', '۲۶:۴۵', 'خواندن نتایج بدون فریب آماری', 'فاصلهٔ اطمینان، اندازهٔ اثر و معناداری؛ چه چیزی واقعاً مهم است.'),
      section('rm-04', '۴۶:۱۰', 'نقد مقاله با یک چارچوب ثابت', 'چهار پرسش ثابت که با آن‌ها هر مقاله را در چند دقیقه ارزیابی می‌کنی.'),
      section('rm-05', '۶۷:۲۰', 'نوشتن نتیجه‌گیری مسئولانه', 'مرز میان یافته‌های مطالعه و ادعاهایی که داده پشتیبانشان نیست.'),
    ],
  },
];

export default { INTL_COURSE_CATALOG, INTL_PROVIDER_CATALOG };
