/* ── لایه سرویس مراجع (Reference Reader API) ──
   قرارداد API برای اتصال به بک‌اند:
     GET    /references                       → listReferences()
     GET    /references/:id                   → getReference(id)          (متادیتا + پیشرفت + آخرین مطالعه)
     GET    /chapters/:id                     → getChapterContent(_, id)  (بخش‌ها و بلوک‌های محتوا)
     GET    /references/:id/search?q=         → searchReference(id, q)
     POST   /highlights | DELETE /highlights/:id
     POST   /notes      | DELETE /notes/:id
     POST   /bookmarks  | DELETE /bookmarks/:id
     PUT    /me/reader-settings
   الان همه‌چیز با داده موک + localStorage جواب می‌دهد؛ برای اتصال به بک‌اند کافی است
   هر تابع به fetch همین مسیرها تبدیل شود — هیچ کامپوننتی به جزئیات mock وابسته نیست.
   توجه حفاظت محتوا: در نسخه واقعی، متن بلوک‌ها فقط از بک‌اند و برای کاربر دارای
   Authorization برگردانده می‌شود و جلوی استخراج انبوه سمت سرور گرفته می‌شود. */

import anatomyFigure from '../../images/courses/ChatGPT Image ۲۰ شهریور ۱۴۰۵، ۱۶_۴۴_۱۳.png';
import histologyFigure from '../../images/courses/QW2X7THz15isfPOypUmHX3UULX8-zM29LGSsSUChN3UXdLb3uQ.png';

/* ─────────────────────────── متادیتای مراجع ─────────────────────────── */

export const REFERENCES = [
  {
    id: 'gray',
    title: 'آناتومی گری',
    latin: "Gray's Anatomy for Students",
    edition: 'ویرایش چهارم',
    authors: 'Drake · Vogl · Mitchell',
    subject: 'آناتومی',
    accent: '#5b8cc7',
    pages: 1160,
    glyph: 'bone',
    chapters: [
      { id: 'gray-ch1', number: 1, title: 'بدن و مفاهیم پایه', sections: 2, minutes: 8, available: true },
      { id: 'gray-ch2', number: 2, title: 'پشت', sections: 5, minutes: 14, available: false },
      { id: 'gray-ch3', number: 3, title: 'قفسه سینه', sections: 6, minutes: 16, available: false },
      { id: 'gray-ch4', number: 4, title: 'شکم', sections: 6, minutes: 15, available: false },
      { id: 'gray-ch5', number: 5, title: 'لگن و پرینه', sections: 5, minutes: 12, available: false },
      { id: 'gray-ch6', number: 6, title: 'اندام تحتانی', sections: 7, minutes: 18, available: false },
      { id: 'gray-ch7', number: 7, title: 'اندام فوقانی', sections: 7, minutes: 17, available: false },
      { id: 'gray-ch8', number: 8, title: 'سر و گردن', sections: 8, minutes: 20, available: false },
      { id: 'gray-ch9', number: 9, title: 'نوروآناتومی', sections: 6, minutes: 16, available: false },
    ],
  },
  {
    id: 'junqueira',
    title: 'بافت‌شناسی جان کوئیرا',
    latin: "Junqueira's Basic Histology",
    edition: 'ویرایش هفدهم',
    authors: 'Anthony Mescher',
    subject: 'بافت‌شناسی',
    accent: '#77b787',
    pages: 800,
    glyph: 'cell',
    chapters: [
      { id: 'jun-ch1', number: 1, title: 'هیستولوژی و روش‌های مطالعه آن', sections: 2, minutes: 7, available: true },
      { id: 'jun-ch2', number: 2, title: 'سیتوپلاسم و اندامک‌های سلولی', sections: 4, minutes: 12, available: false },
      { id: 'jun-ch3', number: 3, title: 'هسته سلول', sections: 3, minutes: 9, available: false },
      { id: 'jun-ch4', number: 4, title: 'اپی‌تلیوم', sections: 4, minutes: 11, available: false },
      { id: 'jun-ch5', number: 5, title: 'بافت همبند', sections: 4, minutes: 12, available: false },
      { id: 'jun-ch6', number: 6, title: 'غضروف', sections: 3, minutes: 8, available: false },
      { id: 'jun-ch7', number: 7, title: 'استخوان', sections: 4, minutes: 12, available: false },
      { id: 'jun-ch8', number: 8, title: 'بافت عصبی', sections: 4, minutes: 13, available: false },
      { id: 'jun-ch9', number: 9, title: 'عضله', sections: 4, minutes: 12, available: false },
    ],
  },
  {
    id: 'guyton',
    title: 'فیزیولوژی گایتون',
    latin: 'Guyton & Hall Physiology',
    edition: 'ویرایش چهاردهم',
    authors: 'John E. Hall',
    subject: 'فیزیولوژی',
    accent: '#ab8e7c',
    pages: 1152,
    glyph: 'heart',
    chapters: [
      { id: 'guy-ch1', number: 1, title: 'مقدمه: سلول و عملکرد عمومی بدن', sections: 4, minutes: 12, available: true },
      { id: 'guy-ch2', number: 2, title: 'فیزیولوژی غشا، عصب و عضله', sections: 3, minutes: 15, available: true },
      { id: 'guy-ch3', number: 3, title: 'قلب', sections: 6, minutes: 20, available: false },
      { id: 'guy-ch4', number: 4, title: 'گردش خون', sections: 7, minutes: 22, available: false },
      { id: 'guy-ch5', number: 5, title: 'مایعات بدن و کلیه‌ها', sections: 6, minutes: 19, available: false },
      { id: 'guy-ch6', number: 6, title: 'تنظیم اسید و باز', sections: 4, minutes: 13, available: false },
      { id: 'guy-ch7', number: 7, title: 'گلبول‌های خون، ایمنی و انعقاد', sections: 5, minutes: 16, available: false },
      { id: 'guy-ch8', number: 8, title: 'تنفس', sections: 6, minutes: 18, available: false },
      { id: 'guy-ch9', number: 9, title: 'سیستم عصبی', sections: 8, minutes: 25, available: false },
      { id: 'guy-ch10', number: 10, title: 'دستگاه گوارش', sections: 5, minutes: 15, available: false },
      { id: 'guy-ch11', number: 11, title: 'متابولیسم و تنظیم دمای بدن', sections: 5, minutes: 16, available: false },
      { id: 'guy-ch12', number: 12, title: 'غدد درون‌ریز و تولید مثل', sections: 6, minutes: 19, available: false },
    ],
  },
];

/* ─────────────────────────── محتوای فصل‌ها ───────────────────────────
   هر فصل: sections → هر section → blocks. نوع بلوک‌ها:
   h1/h2/h3، p، quote، callout (variant: important/exam/clinical/warning/definition/keypoint)،
   image، table، formula، divider
   شناسه بلوک‌ها هنگام تحویل به UI به‌صورت قطعی ساخته می‌شود (chapterId-section-index). */

const CHAPTER_CONTENTS = {
  'guy-ch1': {
    sections: [
      {
        id: 'guy-ch1-s1',
        title: 'هدف مطالعه فیزیولوژی',
        blocks: [
          { type: 'p', text: 'فیزیولوژی علم بررسی عملکرد بدن موجود زنده است؛ یعنی توضیح اینکه میلیون‌ها سلول، چگونه با هم سازمان می‌یابند تا ارگان‌های اختصاصی را بسازند و این ارگان‌ها چگونه در قالب سیستم‌های یکپارچه، زندگی را ممکن می‌کنند. هدف نهایی مطالعه فیزیولوژی، توضیح مکانیسم‌های عملکردی در سطح مولکول، سلول، بافت و ارگان و در نهایت کل بدن است.' },
          { type: 'p', text: 'برای درک فیزیولوژی پزشکی، باید هم‌زمان دو نگاه را حفظ کرد: نگاه مکانیستی (چگونه یک سازوکار گام‌به‌گام کار می‌کند) و نگاه تنظیمی (بدن چگونه این سازوکار را در شرایط مختلف کنترل می‌کند). اکثر آزمون‌های علوم پایه دقیقاً از همین تلاقی «مکانیسم + تنظیم» طرح می‌شوند.' },
          { type: 'quote', text: 'ثبات محیط داخلی، شرط حیات آزاد است.', cite: 'کلود برنار — بنیان‌گذار مفهوم محیط داخلی' },
        ],
      },
      {
        id: 'guy-ch1-s2',
        title: 'سلول، مایعات بدن و همئوستاز',
        blocks: [
          { type: 'p', text: 'بدن انسان حدود ۳۷ تریلیون سلول دارد. هر سلول در یک محیط آبی زندگی می‌کند؛ مایعی که اطراف سلول‌ها را می‌گیرد مایع خارج سلولی (ECF) نام دارد و مایع درون سلول‌ها مایع درون سلولی (ICF) است. این دو، با غشای سلولی از هم جدا می‌شوند ولی پیوسته بین‌شان تبادل مواد انجام می‌گیرد.' },
          { type: 'callout', variant: 'definition', title: 'همئوستاز (Homeostasis)', text: 'حفظ شرایط تقریباً ثابت در مایعات خارج سلولی، به‌طوری که همه سلول‌ها بتوانند عملکرد بهینه داشته باشند. همه ارگان‌ها و بافت‌های بدن برای اجرای نقش خود در حفظ همئوستاز مشارکت می‌کنند.' },
          { type: 'table', caption: 'تقسیم‌بندی مایعات بدن در فرد سالم بالغ', headers: ['فضا', 'حجم تقریبی (لیتر)', 'سهم از وزن بدن'], rows: [['مایع درون سلولی (ICF)', '۲۵', '۴۰٪'], ['مایع بین‌بینی (Interstitial)', '۱۱', '۱۶٪'], ['پلاسمای خون', '۳', '۴٪'], ['مایع خارج سلولی کل (ECF)', '۱۴', '۲۰٪']] },
          { type: 'image', src: histologyFigure, alt: 'نمای میکروسکوپی بافت به‌عنوان نمودار آموزشی نمونه', caption: 'شکل ۱-۱ — سلول‌ها در محیط آبی خود؛ هر سلول باید در تعادل با مایع اطرافش بماند. (تصویر نمونه — بعداً جای تصویر مرجع را می‌گیرد)' },
          { type: 'callout', variant: 'clinical', title: 'ارتباط بالینی — ادم', text: 'وقتی تعادل بین خروج مایع از مویرگ‌ها و بازگشت آن به هم می‌خورد (مثلاً کاهش فشار انکوتیک پلاسما در هیپوآلبومینمی)، مایع در فضای بین‌بینی تجمع می‌کند و ادم ایجاد می‌شود؛ نمونه‌ای کلاسیک از اختلال همئوستاز مایعات.' },
        ],
      },
      {
        id: 'guy-ch1-s3',
        title: 'سیستم‌های کنترل و بازخورد',
        blocks: [
          { type: 'p', text: 'بدن برای حفظ متغیرهای حیاتی (فشار خون، دما، گلوکز، pH و...) از سیستم‌های کنترل استفاده می‌کند. رایج‌ترین الگو، بازخورد منفی است: هرگاه متغیر از محدوده هدف خارج شود، پاسخ سیستم کنترل، آن را به سمت مقدار مطلوب برمی‌گرداند. برخلاف آن، بازخورد مثبت پاسخ را تقویت می‌کند و معمولاً به یک رخداد پایان‌دهنده نیاز دارد (مثل انعقاد خون یا انقباض زایمانی).' },
          { type: 'formula', expr: 'BP = CO × TPR', note: 'فشار شریانی = برون‌ده قلبی × مقاومت محیطی کل؛ مثال کلاسیک متغیر تنظیم‌شونده با دو مؤلفه مستقل' },
          { type: 'p', text: 'در تنظیم فشار خون، گیرنده‌های فشاری کاروتید و آئورت تغییر فشار را به مرکز عصبی گزارش می‌کنند و پاسخ عصبی-هورمونی، هم برون‌ده قلبی و هم مقاومت محیطی را اصلاح می‌کند. دقت کنید که هر مؤلفه فرمول بالا یک مسیر درمانی مستقل هم هست.' },
          { type: 'callout', variant: 'important', title: 'نکته مهم', text: 'هر سیستم کنترل شامل سه جزء است: گیرنده (سنسور)، مرکز کنترل و اثرکننده. در سؤالات آزمون، تشخیص اینکه کدام ساختار نقش «گیرنده» دارد، از پرتکرارترین طرح‌هاست.' },
          { type: 'callout', variant: 'exam', title: 'نقطه امتحانی', text: 'تمایز بازخورد منفی و مثبت با مثال: بازخورد منفی ← تنظیم دما، گلوکز، فشار خون. بازخورد مثبت ← آبشاری انعقاد، جهش LH، زایمان. اگر پاسخ سیستم، انحراف را بیشتر کند، بازخورد مثبت است.' },
        ],
      },
      {
        id: 'guy-ch1-s4',
        title: 'جمع‌بندی فصل',
        blocks: [
          { type: 'callout', variant: 'keypoint', title: 'نکات کلیدی فصل ۱', text: '۱) واحد ساختاری بدن سلول است و محیط زندگی آن، مایع خارج سلولی. ۲) همئوستاز یعنی ثبات تقریبی مایع خارج سلولی، نه ثبات مطلق. ۳) بازخورد منفی پایه‌ی اغلب تنظیم‌های بدن است؛ بازخورد مثبت محدود و پایان‌دار است. ۴) BP = CO × TPR ستون فقرات فصل گردش خون است.' },
          { type: 'p', text: 'در فصل بعد، این مفاهیم در سطح غشای سلول و سیگنال‌دهی عصبی-عضلانی ادامه پیدا می‌کنند؛ همان جایی که پتانسیل غشایی، مبنای همه فعالیت‌های الکتریکی بدن می‌شود.' },
          { type: 'divider' },
        ],
      },
    ],
  },

  'guy-ch2': {
    sections: [
      {
        id: 'guy-ch2-s1',
        title: 'غشای سلول و انتقال مواد',
        blocks: [
          { type: 'p', text: 'غشای سلول از دولایه فسفولیپید و پروتئین‌های غشایی ساخته شده است. این ساختار، آب‌دوست/آب‌گریز بودن محیط دو طرف را مدیریت می‌کند: مولکول‌های چربی‌دوست به‌راحتی عبور می‌کنند، اما مواد قطعی و یونی بدون پروتئین انتقالی نمی‌توانند از غشا بگذرند.' },
          { type: 'table', caption: 'مقایسه سازوکارهای انتقال غشایی', headers: ['سازوکار', 'انرژی مستقیم', 'پروتئین حمل‌کننده', 'مثال'], rows: [['نفوذ ساده', 'ندارد', 'ندارد', 'اکسیژن، CO₂، الکل'], ['نفوذ تسهیل‌شده', 'ندارد', 'کانال یا حامل', 'گلوکز (GLUT)'], ['انتقال فعال اولیه', 'ATP', 'پمپ', 'Na⁺/K⁺-ATPase'], ['انتقال فعال ثانویه', 'غیرمستقیم', 'سیم‌پورت/آنتی‌پورت', 'جذب گلوکز با SGLT']] },
          { type: 'callout', variant: 'definition', title: 'انتقال فعال ثانویه', text: 'انتقال ماده بر خلاف گرادیان خود، با استفاده مستقیم از انرژی گرادیان یونی دیگری (معمولاً سدیم) که خودش توسط انتقال فعال اولیه ساخته شده است. انرژی مستقیم ATP مصرف نمی‌شود ولی منشأ انرژی همچنان پمپ سدیم است.' },
          { type: 'callout', variant: 'warning', title: 'هشدار آزمونی', text: 'اشتباه رایج: در انتقال فعال ثانویه «ATP مصرف نمی‌شود» درست است، اما ادعای «انرژی لازم ندارد» نادرست است؛ منبع انرژی، گرادیان سدیم است. اگر پمپ سدیم مهار شود، انتقال ثانویه هم می‌ایستد.' },
        ],
      },
      {
        id: 'guy-ch2-s2',
        title: 'پتانسیل غشایی و پتانسیل عمل',
        blocks: [
          { type: 'p', text: 'در حالت پایه، داخل سلول نسبت به بیرون حدود -۷۰ تا -۹۰ میلی‌ولت پتانسیل دارد (پتانسیل غشایی پایه). سه عامل اصلی آن عبارت‌اند از: اختلاف غلظت یون‌ها در دو طرف غشا، نفوذپذیری غشا نسبت به هر یون و پمپ سدیم-پتاسیم الکتروژنیک.' },
          { type: 'formula', expr: 'V = (RT/zF) · ln([ion]out / [ion]in)', note: 'معادله نرنست: پتانسیل تعادلی هر یون بر اساس گرادیان غلظت آن' },
          { type: 'p', text: 'پتانسیل عمل وقتی ایجاد می‌شود که دپولاریزاسیون به آستانه برسد و کانال‌های وابسته به ولتاژ سدیم به‌صورت بازخورد مثبت باز شوند. فاز صعودی با ورود سدیم، فاز نزولی با خروج پتاسیم و بازگشت به حالت پایه با پمپ سدیم-پتاسیم انجام می‌شود.' },
          { type: 'callout', variant: 'exam', title: 'نقطه امتحانی', text: 'دوره تحریک‌ناپذیری مطلق به غیرفعال بودن دروازه‌های سدیم مربوط است؛ در این دوره هیچ محرکی، حتی قوی‌ترین، پتانسیل عمل تولید نمی‌کند. همین ویژگی، انتشار یک‌طرفه پتانسیل عمل را تضمین می‌کند.' },
          { type: 'callout', variant: 'keypoint', title: 'نکته کلیدی', text: 'پمپ سدیم-پتاسیم برای هر ATP: ۳ سدیم بیرون، ۲ پتاسیم داخل. نتیجه خالص، الکتروژنیک بودن پمپ و سهم مستقیم آن در پتانسیل غشایی (حدود چند میلی‌ولت) است.' },
        ],
      },
      {
        id: 'guy-ch2-s3',
        title: 'انقباض عضلانی',
        blocks: [
          { type: 'p', text: 'انقباض عضله با نظریه فیلامان لغزان توضیح داده می‌شود: سر میوزین بعد از اتصال به اکتین، با مصرف ATP چرخش می‌کند و فیلامان اکتین را به مرکز سارکومر می‌کشد. یون کلسیم با اتصال به تروپونین، ماسک اتصالی تروپومیزین را برداشته و چرخه اتصالی را ممکن می‌کند.' },
          { type: 'callout', variant: 'clinical', title: 'ارتباط بالینی — جمود نعشی', text: 'چند ساعت پس از مرگ، ذخیره ATP تمام می‌شود و پل‌های میوزین بدون انرژی از اکتین جدا نمی‌شوند؛ نتیجه سفت‌شدن عضلات (جمود نعشی) است. این مثال، جایگاه ATP در «جداشدن» پل اتصالی را به‌خوبی نشان می‌دهد.' },
          { type: 'p', text: 'جمع‌بندی چرخه: پتانسیل عمل → پتانسیل انتقالی در T-tubule → آزادسازی کلسیم از رتیکولوم سارکوپلاسمیک → انقباض → بازجذب کلسیم با پمپ کلسیمی → شل‌شدن. هر اختلال در این زنجیره، بیماری عضلانی خاص خود را می‌سازد.' },
        ],
      },
    ],
  },

  'gray-ch1': {
    sections: [
      {
        id: 'gray-ch1-s1',
        title: 'ترمینولوژی آناتومیک',
        blocks: [
          { type: 'p', text: 'برای توصیف یکنواخت ساختارهای بدن، آناتومی از موقعیت استاندارد آناتومیک استفاده می‌کند: ایستاده، رو به مشاهده‌گر، بازوها در طرفین و کف دست‌ها رو به جلو. همه اصطلاحات جهت‌دار (قدامی/خلفی، فوقانی/تحتانی، میانی/وحشانی) بر اساس همین موقعیت تعریف می‌شوند، فارغ از وضعیت واقعی بدن.' },
          { type: 'callout', variant: 'definition', title: 'صفحات آناتومیک', text: 'صفحه ساژیتال میانی، بدن را به نیمه راست و چپ تقسیم می‌کند؛ صفحه کرونال به قدامی و خلفی؛ و صفحه آگزیال (عرضی) به فوقانی و تحتانی. صفحه‌ها مبنای برش‌های تصویربرداری (CT و MRI) هستند.' },
          { type: 'callout', variant: 'exam', title: 'نقطه امتحانی', text: 'در توصیف اندام‌ها، قدامی = سطح رو به جلو در موقعیت آناتومیک (برای دست: کف دست)، خلفی = رو به پشت. در پا، سطح رو به پایین (کف پا) سطح پلانتار نام دارد؛ دقت در همین اصطلاحات، پاسخ‌های تشریحی را قطعی می‌کند.' },
        ],
      },
      {
        id: 'gray-ch1-s2',
        title: 'سازمان‌دهی بدن و سیستم‌ها',
        blocks: [
          { type: 'p', text: 'سلسله‌مراتب ساختاری بدن: سلول → بافت → ارگان → سیستم. چهار بافت پایه وجود دارد: اپی‌تلیوم، بافت همبند، بافت عضلانی و بافت عصبی. هر ارگان ترکیبی نسبتاً ثابت از این بافت‌هاست و هر سیستم، ارگان‌هایی با یک وظیفه فیزیولوژیک مشترک است.' },
          { type: 'callout', variant: 'keypoint', title: 'نکته کلیدی', text: 'شناسایی نوع بافت سازنده هر لایه ارگان (مثلاً مخاط، سروزا، غدد)، کلید پاسخ به سؤالات ترکیبی آناتومی-هیستولوژی در آزمون علوم پایه است.' },
        ],
      },
    ],
  },

  'jun-ch1': {
    sections: [
      {
        id: 'jun-ch1-s1',
        title: 'آماده‌سازی بافت برای مطالعه',
        blocks: [
          { type: 'p', text: 'برای مطالعه میکروسکوپی، بافت باید از حالت زنده به لام پایدار تبدیل شود: ثبوت (Fixation) با فرمالدهید برای توقف متابولیسم و حفظ ساختار، آب‌گیری، شفاف‌سازی، پارافین‌دهی، برش با میکروتوم (۴ تا ۶ میکرومتر) و در نهایت رنگ‌آمیزی.' },
          { type: 'callout', variant: 'definition', title: 'ثبوت (Fixation)', text: 'فرآیند ایجاد پیوندهای عرضی بین پروتئین‌ها با فیکساتیو (معمولاً فرمالدهید) تا ساختار بافت هنگام مراحل بعدی تغییر نکند و آنزیم‌ها بافت را نابود نکنند.' },
          { type: 'callout', variant: 'warning', title: 'هشدار — آرتیفکت', text: 'هر خطای آماده‌سازی در لام، آرتیفکت نام دارد: چروکیدگی ناشی از آب‌گیری سریع، جدا شدن اپی‌تلیوم از لامینا پروپریا و فشردگی برش، همه آرتیفکت‌اند و نباید با پاتولوژی اشتباه گرفته شوند.' },
        ],
      },
      {
        id: 'jun-ch1-s2',
        title: 'رنگ‌آمیزی هماتوکسیلین-ائوزین',
        blocks: [
          { type: 'p', text: 'پرکاربردترین رنگ در هیستولوژی H&E است: هماتوکسیلین، بازیک است و ساختارهای اسیدی (بازدوست) مثل DNA و ریبوزوم‌ها را آبی-بنفش می‌کند؛ ائوزین، اسیدی است و ساختارهای بازی (اسیددوست) مثل پروتئین‌های سیتوپلاسم و کلاژن را صورتی می‌کند.' },
          { type: 'callout', variant: 'exam', title: 'نقطه امتحانی', text: 'اصطلاح «بازدوست» از دید رنگ است نه بافت: ساختار بازدوست، رنگ بازی (هماتوکسیلین) را می‌گیرد چون خودش اسیدی است. این جابه‌جایی مفاهیم، منبع اصلی اشتباه در سؤالات هیستولوژی است.' },
          { type: 'image', src: histologyFigure, alt: 'نمونه لام هیستولوژی رنگ‌آمیزی‌شده', caption: 'شکل ۱-۱ — نمای کلی بافت رنگ‌آمیزی‌شده (تصویر نمونه).' },
        ],
      },
    ],
  },
};

/* ─────────────────────────── ابزارهای داخلی ─────────────────────────── */

const delay = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));

const makeId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

/* نگهداری داده‌های کاربر (هایلایت/نوت/بوکمارک/پیشرفت/تنظیمات) — الان localStorage؛
   در نسخه بک‌اند این توابع POST/DELETE می‌شوند و شناسه کاربر از توکن می‌آید. */
const STORE_PREFIX = 'tapesh:reader';

const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(`${STORE_PREFIX}:${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStore = (key, value) => {
  try {
    localStorage.setItem(`${STORE_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    /* حافظه پر یا غیرفعال — عملیات خواندن همچنان کار می‌کند */
  }
};

const userId = () => readStore('user', 'local-user');

/* شناسه قطعی بلوک: برای لنگر کردن هایلایت/نوت به متن، مستقل از رندر */
export const blockId = (chapterId, sectionId, index) => `${chapterId}|${sectionId}|${index}`;

const decorate = (content, chapterId) => ({
  sections: content.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((b, i) => ({ ...b, id: blockId(chapterId, section.id, i) })),
  })),
});

/* ─────────────────────────── API عمومی ─────────────────────────── */

export async function listReferences() {
  await delay(200);
  return REFERENCES.map(({ chapters, ...meta }) => ({ ...meta, chapterCount: chapters.length }));
}

/* GET /references/:id — متادیتا + وضعیت مطالعه همان کاربر */
export async function getReference(id) {
  await delay(280);
  const reference = REFERENCES.find((ref) => ref.id === id);
  if (!reference) throw new Error('REFERENCE_NOT_FOUND');
  return {
    reference,
    progress: readStore(`${id}:progress`, {}),
    lastRead: readStore(`${id}:lastread`, null),
  };
}

/* GET /chapters/:id — محتوای ساختاریافته فصل (فقط برای کاربر دارای دسترسی) */
export async function getChapterContent(referenceId, chapterId) {
  await delay(420);
  const reference = REFERENCES.find((ref) => ref.id === referenceId);
  const chapter = reference?.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) throw new Error('CHAPTER_NOT_FOUND');
  const raw = CHAPTER_CONTENTS[chapterId];
  if (!raw) {
    const error = new Error('CONTENT_NOT_AVAILABLE');
    error.code = 'CONTENT_NOT_AVAILABLE';
    throw error;
  }
  return decorate(raw, chapterId);
}

/* GET /references/:id/search?q= — جست‌وجوی متنی؛ در آینده semantic می‌شود */
export async function searchReference(referenceId, query) {
  await delay(180);
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const reference = REFERENCES.find((ref) => ref.id === referenceId);
  if (!reference) return [];

  const results = [];
  for (const chapter of reference.chapters) {
    const raw = CHAPTER_CONTENTS[chapter.id];
    if (!raw) continue;
    for (const section of raw.sections) {
      section.blocks.forEach((b, index) => {
        const text =
          b.type === 'table'
            ? [b.caption, ...b.headers, ...b.rows.flat()].join(' ')
            : b.type === 'callout'
              ? `${b.title ?? ''} ${b.text}`
              : b.type === 'image'
                ? `${b.caption ?? ''}`
                : b.text ?? '';
        const at = text.toLowerCase().indexOf(term);
        if (at === -1 || results.length >= 40) return;
        const from = Math.max(0, at - 42);
        results.push({
          blockId: blockId(chapter.id, section.id, index),
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          sectionId: section.id,
          sectionTitle: section.title,
          snippet: `${from > 0 ? '…' : ''}${text.slice(from, at + term.length + 60).trim()}…`,
          matchLength: term.length,
        });
      });
      if (results.length >= 40) break;
    }
    if (results.length >= 40) break;
  }
  return results;
}

/* ── داده‌های تعاملی کاربر ── */

const readList = (referenceId, kind) => readStore(`${referenceId}:${kind}`, []);

export async function loadReaderState(referenceId) {
  await delay(160);
  return {
    userId: userId(),
    settings: readStore('settings', null),
    highlights: readList(referenceId, 'highlights'),
    notes: readList(referenceId, 'notes'),
    bookmarks: readList(referenceId, 'bookmarks'),
    progress: readStore(`${referenceId}:progress`, {}),
    lastRead: readStore(`${referenceId}:lastread`, null),
  };
}

const addToList = async (referenceId, kind, item) => {
  await delay(120);
  const list = readList(referenceId, kind);
  list.push(item);
  writeStore(`${referenceId}:${kind}`, list);
  return item;
};

const removeFromList = async (referenceId, kind, itemId) => {
  await delay(120);
  writeStore(
    `${referenceId}:${kind}`,
    readList(referenceId, kind).filter((item) => item.id !== itemId),
  );
  return itemId;
};

/* POST /highlights */
export const saveHighlight = (referenceId, highlight) =>
  addToList(referenceId, 'highlights', { ...highlight, id: makeId(), createdAt: Date.now() });
/* DELETE /highlights/:id */
export const deleteHighlight = (referenceId, id) => removeFromList(referenceId, 'highlights', id);

/* POST /notes */
export const saveNote = (referenceId, note) =>
  addToList(referenceId, 'notes', { ...note, id: makeId(), createdAt: Date.now() });
/* DELETE /notes/:id */
export const deleteNote = (referenceId, id) => removeFromList(referenceId, 'notes', id);

/* POST /bookmarks — هر بوکمارک به یک بخش از یک فصل لنگر می‌شود */
export const saveBookmark = (referenceId, bookmark) =>
  addToList(referenceId, 'bookmarks', { ...bookmark, id: makeId(), createdAt: Date.now() });
/* DELETE /bookmarks/:id */
export const deleteBookmark = (referenceId, id) => removeFromList(referenceId, 'bookmarks', id);

/* PUT /me/reader-settings — تنظیمات خواندن بین همه مراجع مشترک است */
export async function saveSettings(settings) {
  await delay(100);
  writeStore('settings', settings);
  return settings;
}

/* PUT /references/:id/progress — بخش‌های دیده‌شده هر فصل */
export async function saveProgress(referenceId, chapterId, seenSections) {
  const progress = readStore(`${referenceId}:progress`, {});
  progress[chapterId] = { seen: [...new Set(seenSections)], at: Date.now() };
  writeStore(`${referenceId}:progress`, progress);
  return progress;
}

/* PUT /references/:id/last-read — برای بازگشایی دقیق از همان نقطه */
export async function saveLastRead(referenceId, lastRead) {
  writeStore(`${referenceId}:lastread`, { ...lastRead, at: Date.now() });
  return lastRead;
}

/* نتیجه جست‌وجو فقط برای فصل‌های در دسترس معنا دارد؛ در UI نمایش داده می‌شود */
export const chapterLabel = (chapter) => `فصل ${chapter.number} — ${chapter.title}`;
