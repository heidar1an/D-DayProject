import { useEffect, useMemo, useRef, useState } from 'react';
import './internationalCourses.css';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import { createNote } from '../../../services/notes/notesService';
/* لوگوهای نوار متحرک — از وب گرفته و در `images/logos/` ذخیره شده‌اند (تصویر لوگویی در پروژه نبود). */
import harvardMedLogo from '../../../../images/logos/harvard-med.png';
import johnsHopkinsLogo from '../../../../images/logos/johns-hopkins.png';
import stanfordMedLogo from '../../../../images/logos/stanford-med.png';
import oxfordLogo from '../../../../images/logos/oxford.png';
import cambridgeLogo from '../../../../images/logos/cambridge.png';
import nejmLogo from '../../../../images/logos/nejm.png';
import courseraLogo from '../../../../images/logos/coursera.png';
import whoLogo from '../../../../images/logos/who.png';
import khanAcademyLogo from '../../../../images/logos/khan-academy.png';
import harvardUniversityLogo from '../../../../images/logos/harvard.png';
import mitLogo from '../../../../images/logos/mit.png';
import bbcLogo from '../../../../images/logos/bbc.png';
import torontoLogo from '../../../../images/logos/toronto.png';
/* تصویر کارت هر دوره — از تصویرهای خودِ پروژه (تصویر تازه‌ای دانلود نشد) */
import globalHealthImage from '../../../../images/courses/Asset 6.webp';
import visualScienceImage from '../../../../images/courses/immono.webp';
import scientificEnglishImage from '../../../../images/courses/english.webp';
import mediaLiteracyImage from '../../../../images/pictures/character-search.png';
import neuroscienceImage from '../../../../images/pictures/images (1).jpeg';
import researchMethodsImage from '../../../../images/courses/Asset 5.webp';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* نمای پیش‌فرض لایه — کاتالوگ با فیلتر «همه دوره‌ها».
   باید ثابت و بیرون از کامپوننت بماند (قرارداد useLayerRoute). */
const INTL_COURSES_VIEW = { name: 'catalog', filter: 'all' };

const FILTERS = [
  { id: 'all', label: 'همه دوره‌ها' },
  { id: 'medicine', label: 'پزشکی و سلامت' },
  { id: 'science', label: 'علوم پایه' },
  { id: 'skills', label: 'مهارت‌های دانشگاهی' },
  { id: 'media', label: 'رسانه و تفکر' },
];

/* فهرست دوره‌ها — از «دوره‌های من» هم به همین منبع لینک می‌شود */
export const COURSES = [
  {
    id: 'global-health',
    providerId: 'harvard',
    providerLogo: harvardUniversityLogo,
    image: globalHealthImage,
    title: 'نگاهی جهانی به سلامت',
    provider: 'دانشگاه هاروارد',
    providerEn: 'Harvard University',
    category: 'medicine',
    categoryLabel: 'پزشکی و سلامت',
    level: 'مقدماتی',
    duration: 8,
    lessons: 24,
    progress: 64,
    accent: '#5b8cc7',
    accentSoft: '#1d314a',
    badge: 'پربازدید',
    description: 'در این مسیر با چالش‌های سلامت عمومی، نابرابری‌های درمانی و راهکارهای اثرگذار در جوامع مختلف آشنا می‌شوی.',
    tags: ['سلامت عمومی', 'اپیدمیولوژی', 'جامعه'],
  },
  {
    id: 'visual-science',
    providerId: 'mit',
    providerLogo: mitLogo,
    image: visualScienceImage,
    title: 'علم را چطور ببینیم؟',
    provider: 'موسسه فناوری ماساچوست',
    providerEn: 'MIT OpenCourseWare',
    category: 'science',
    categoryLabel: 'علوم پایه',
    level: 'متوسط',
    duration: 6,
    lessons: 18,
    progress: 18,
    accent: '#937fcd',
    accentSoft: '#2d2744',
    badge: 'جدید',
    description: 'یک دوره تصویری برای فهم بهتر مدل‌ها، آزمایش‌ها و ایده‌های علمی؛ از مشاهده دقیق تا ساختن یک توضیح قابل اعتماد.',
    tags: ['تفکر علمی', 'مدل‌سازی', 'آزمایش'],
  },
  {
    id: 'scientific-english',
    providerId: 'cambridge',
    providerLogo: cambridgeLogo,
    image: scientificEnglishImage,
    title: 'انگلیسی برای مطالعه علمی',
    provider: 'دانشگاه کمبریج',
    providerEn: 'University of Cambridge',
    category: 'skills',
    categoryLabel: 'مهارت‌های دانشگاهی',
    level: 'متوسط',
    duration: 5,
    lessons: 16,
    progress: 0,
    accent: '#77b787',
    accentSoft: '#20392a',
    badge: 'پیشنهاد تپش',
    description: 'واژگان و الگوهای ضروری برای خواندن مقاله، دنبال کردن ویدیوهای دانشگاهی و نوشتن خلاصه‌های دقیق.',
    tags: ['Academic English', 'مقاله‌خوانی', 'واژگان'],
  },
  {
    id: 'media-literacy',
    providerId: 'bbc',
    providerLogo: bbcLogo,
    image: mediaLiteracyImage,
    title: 'سواد رسانه‌ای در عصر داده',
    provider: 'بی‌بی‌سی ماندارین',
    providerEn: 'BBC Learning',
    category: 'media',
    categoryLabel: 'رسانه و تفکر',
    level: 'مقدماتی',
    duration: 4,
    lessons: 12,
    progress: 0,
    accent: '#ab8e7c',
    accentSoft: '#3b2e28',
    badge: 'کوتاه و کاربردی',
    description: 'با چند ابزار ساده، خبرها و محتوای آنلاین را دقیق‌تر بخوان، منبع را ارزیابی کن و گرفتار شایعه نشو.',
    tags: ['خبرخوانی', 'منبع‌شناسی', 'داده'],
  },
  {
    id: 'neuroscience',
    providerId: 'toronto',
    providerLogo: torontoLogo,
    image: neuroscienceImage,
    title: 'مغز، یادگیری و حافظه',
    provider: 'دانشگاه تورنتو',
    providerEn: 'University of Toronto',
    category: 'medicine',
    categoryLabel: 'پزشکی و سلامت',
    level: 'متوسط',
    duration: 7,
    lessons: 21,
    progress: 0,
    accent: '#5b8cc7',
    accentSoft: '#1d314a',
    badge: 'منتخب سردبیر',
    description: 'سفر تصویری از نورون تا رفتار؛ سازوکارهای یادگیری، حافظه و شکل‌گیری عادت‌ها را با مثال‌های روزمره دنبال کن.',
    tags: ['علوم اعصاب', 'یادگیری', 'حافظه'],
  },
  {
    id: 'research-methods',
    providerId: 'oxford',
    providerLogo: oxfordLogo,
    image: researchMethodsImage,
    title: 'از سؤال تا پژوهش معتبر',
    provider: 'دانشگاه آکسفورد',
    providerEn: 'University of Oxford',
    category: 'skills',
    categoryLabel: 'مهارت‌های دانشگاهی',
    level: 'پیشرفته',
    duration: 9,
    lessons: 28,
    progress: 0,
    accent: '#77b787',
    accentSoft: '#20392a',
    badge: 'پیشرفته',
    description: 'از تبدیل یک ایده به سؤال پژوهشی تا طراحی مطالعه، خواندن نتایج و ارائه یک نتیجه‌گیری مسئولانه.',
    tags: ['روش تحقیق', 'نقد مقاله', 'داده‌خوانی'],
  },
];

/* اطلاعات منابع (دانشگاه/نهاد) — برای لایهٔ هر منبع که با کلیک روی نام ناشر باز می‌شود.
   کلیدها همان `providerId` هر دوره است؛ لوگو و نام نمایشی از خود دوره خوانده می‌شود. */
const PROVIDER_DATA = {
  harvard: {
    nameEn: 'Harvard University',
    country: 'ایالات متحده',
    founded: '۱۶۳۶',
    description: 'قدیمی‌ترین دانشگاه آمریکا و یکی از قطب‌های پژوهش سلامت در جهان؛ دانشکدهٔ پزشکی و مدرسهٔ سلامت عمومی آن مرجع آموزش اپیدمیولوژی و سیاست‌گذاری درمانی‌اند.',
    focus: ['سلامت عمومی', 'اپیدمیولوژی', 'سیاست سلامت'],
  },
  mit: {
    nameEn: 'MIT OpenCourseWare',
    country: 'ایالات متحده',
    founded: '۱۸۶۱',
    description: 'مؤسسهٔ فناوری ماساچوست با انتشار آزاد درس‌هایش، مدل‌های علمی را ساده و تصویری توضیح می‌دهد؛ تمرکزش بر روش‌شناسی و تفکر کمّی است.',
    focus: ['تفکر علمی', 'مدل‌سازی', 'آموزش باز'],
  },
  cambridge: {
    nameEn: 'University of Cambridge',
    country: 'بریتانیا',
    founded: '۱۲۰۹',
    description: 'دانشگاه کمبریج در آموزش زبان آکادمیک و مهارت‌های مطالعهٔ منابع انگلیسی پیشتاز است؛ دوره‌هایش برای خواندن مقاله و سخنرانی دانشگاهی طراحی شده‌اند.',
    focus: ['زبان آکادمیک', 'مقاله‌خوانی', 'نوشتن علمی'],
  },
  bbc: {
    nameEn: 'BBC Learning',
    country: 'بریتانیا',
    founded: '۱۹۲۲',
    description: 'بخش آموزشی بی‌بی‌سی محتوای کوتاه و کاربردی برای سواد رسانه‌ای می‌سازد؛ تمرکزش بر ارزیابی منبع، تشخیص شایعه و خواندن درست داده است.',
    focus: ['سواد رسانه‌ای', 'منبع‌شناسی', 'تفکر انتقادی'],
  },
  toronto: {
    nameEn: 'University of Toronto',
    country: 'کانادا',
    founded: '۱۸۲۷',
    description: 'دانشگاه تورنتو یکی از قطب‌های علوم اعصاب و روان‌شناسی شناختی است؛ پژوهش‌هایش دربارهٔ حافظه، توجه و شکل‌گیری عادت در دوره‌هایش بازتاب یافته.',
    focus: ['علوم اعصاب', 'حافظه', 'یادگیری'],
  },
  oxford: {
    nameEn: 'University of Oxford',
    country: 'بریتانیا',
    founded: '۱۰۹۶',
    description: 'دانشگاه آکسفورد با سنت پژوهش کیفی و کمّی، چارچوبی روشن برای طراحی مطالعه، نقد مقاله و نتیجه‌گیری مسئولانه ارائه می‌دهد.',
    focus: ['روش تحقیق', 'نقد مقاله', 'داده‌خوانی'],
  },
};

const COURSE_DETAIL_DATA = {
  'global-health': {
    duration: '۰۸:۴۲:۰۰',
    lessons: [
      { id: 'gh-01', time: '۰۰:۰۰', title: 'چرا سلامت عمومی به مرزها محدود نیست؟', desc: 'تفاوت نگاه فردمحور و جامعه‌محور به سلامت و این‌که چرا یک بیماری محلی می‌تواند مسئله‌ای جهانی شود.' },
      { id: 'gh-02', time: '۰۵:۱۵', title: 'نابرابری درمانی و نقش جامعه', desc: 'چگونه درآمد، محل زندگی و دسترسی به خدمات، نتیجهٔ درمان را تغییر می‌دهد.' },
      { id: 'gh-03', time: '۲۲:۲۵', title: 'خواندن داده‌های سلامت در جهان', desc: 'با شاخص‌های پایه مثل امید به زندگی و مرگ‌ومیر کودکان، وضعیت یک جامعه را بخوان.' },
      { id: 'gh-04', time: '۳۴:۵۰', title: 'طراحی مداخله‌های اثرگذار', desc: 'از تشخیص مسئله تا انتخاب مداخله‌ای که واقعاً قابل اجرا و سنجش باشد.' },
      { id: 'gh-05', time: '۵۰:۳۰', title: 'جمع‌بندی: از مسئله تا اثر', desc: 'مرور مسیر کامل یک پروژهٔ سلامت عمومی و معیارهای سنجش اثر آن.' },
    ],
  },
  'visual-science': {
    duration: '۰۶:۱۸:۰۰',
    lessons: [
      { id: 'vs-01', time: '۰۰:۰۰', title: 'دیدن پیش از توضیح دادن', desc: 'تفاوت مشاهدهٔ دقیق با تفسیر شتاب‌زده و تمرین ثبت آنچه واقعاً دیده می‌شود.' },
      { id: 'vs-02', time: '۰۷:۴۰', title: 'مدل‌ها چگونه فکر ما را شکل می‌دهند؟', desc: 'مدل‌های علمی ابزار ساده‌سازی‌اند؛ با مثال می‌بینی کجا کمک می‌کنند و کجا گمراه.' },
      { id: 'vs-03', time: '۲۱:۱۰', title: 'آزمایش خوب چه چیزی را جدا می‌کند؟', desc: 'نقش گروه شاهد، متغیر و تکرار در این‌که نتیجه به یک علت نسبت داده شود.' },
      { id: 'vs-04', time: '۳۹:۲۵', title: 'تصویرسازی برای فهم داده', desc: 'انتخاب شکل درست نمودار و پرهیز از تصویرهایی که داده را بزرگ‌تر از واقع نشان می‌دهند.' },
      { id: 'vs-05', time: '۵۲:۴۰', title: 'ساختن یک توضیح قابل اعتماد', desc: 'از مشاهده تا فرضیه و از فرضیه تا توضیحی که دیگران بتوانند بیازمایند.' },
    ],
  },
  'scientific-english': {
    duration: '۰۵:۰۵:۰۰',
    lessons: [
      { id: 'se-01', time: '۰۰:۰۰', title: 'نقشهٔ یک مقالهٔ علمی', desc: 'ساختار استاندارد چکیده، روش، نتیجه و بحث و این‌که هر بخش را با چه سرعتی بخوانی.' },
      { id: 'se-02', time: '۰۶:۲۵', title: 'واژگان پرتکرار در چکیده‌ها', desc: 'فهرست کوتاهی از فعل‌ها و عبارت‌هایی که در بیشتر چکیده‌ها تکرار می‌شوند.' },
      { id: 'se-03', time: '۱۹:۴۰', title: 'دنبال کردن یک سخنرانی دانشگاهی', desc: 'نشانه‌های گفتاری که ساختار سخنرانی را لو می‌دهند و کمکت می‌کنند جا نمانی.' },
      { id: 'se-04', time: '۳۳:۱۵', title: 'خلاصه‌نویسی بدون از دست دادن معنا', desc: 'الگوهای جمله‌سازی برای خلاصه‌ای دقیق و بی‌طرف از یک متن علمی.' },
      { id: 'se-05', time: '۴۴:۵۰', title: 'تمرین خواندن سریع و دقیق', desc: 'تمرین عملی اسکن متن برای یافتن عدد، نتیجه و محدودیت‌های مطالعه.' },
    ],
  },
  'media-literacy': {
    duration: '۰۴:۱۲:۰۰',
    lessons: [
      { id: 'ml-01', time: '۰۰:۰۰', title: 'چرا هر چیزی که می‌بینیم خبر نیست؟', desc: 'تفاوت خبر، گزارش، تبلیغ و نظر شخصی و این‌که چرا مرزشان در شبکه‌ها محو می‌شود.' },
      { id: 'ml-02', time: '۰۴:۵۰', title: 'ردیابی منبع و تاریخ انتشار', desc: 'چند پرسش ساده برای فهمیدن این‌که خبر از کجا آمده و چه‌قدر تازه است.' },
      { id: 'ml-03', time: '۱۷:۲۰', title: 'تصویر، تیتر و خطای ذهن', desc: 'چگونه تیتر و تصویر بیرون از متن، برداشت ما را جهت می‌دهند.' },
      { id: 'ml-04', time: '۲۸:۴۰', title: 'خواندن داده در شبکه‌های اجتماعی', desc: 'تشخیص نمودارهای بریده و آمارهای بی‌منبع در محتوای پرطرفدار.' },
      { id: 'ml-05', time: '۳۸:۰۰', title: 'چک‌لیست یک خوانندهٔ دقیق', desc: 'چک‌لیست کوتاه و قابل استفادهٔ روزمره پیش از بازنشر هر محتوا.' },
    ],
  },
  neuroscience: {
    duration: '۰۷:۲۶:۰۰',
    lessons: [
      { id: 'ns-01', time: '۰۰:۰۰', title: 'مغز چگونه یادگیری را ثبت می‌کند؟', desc: 'از نورون تا رفتار؛ مرور سادهٔ سازوکاری که تجربه را به حافظه تبدیل می‌کند.' },
      { id: 'ns-02', time: '۰۸:۱۰', title: 'توجه، حافظهٔ کاری و حواس‌پرتی', desc: 'چرا ظرفیت توجه محدود است و چه‌طور محیط مطالعه آن را می‌بلعد.' },
      { id: 'ns-03', time: '۲۴:۳۵', title: 'نقش خواب در تثبیت خاطره', desc: 'آنچه در خواب با آموخته‌های روز اتفاق می‌افتد و اثر کم‌خوابی بر یادگیری.' },
      { id: 'ns-04', time: '۴۲:۲۰', title: 'ساختن عادت‌های پایدار', desc: 'حلقهٔ نشانه، رفتار و پاداش و راه ساختن عادت مطالعهٔ روزانه.' },
      { id: 'ns-05', time: '۵۹:۱۰', title: 'تمرین: طراحی برنامهٔ یادگیری', desc: 'تمرین گام‌به‌گام برای چیدن یک برنامهٔ هفتگی بر پایهٔ یافته‌های این دوره.' },
    ],
  },
  'research-methods': {
    duration: '۰۹:۱۰:۰۰',
    lessons: [
      { id: 'rm-01', time: '۰۰:۰۰', title: 'از کنجکاوی تا سؤال پژوهشی', desc: 'تبدیل یک ایدهٔ کلی به سؤالی دقیق، قابل سنجش و قابل پاسخ.' },
      { id: 'rm-02', time: '۰۹:۳۰', title: 'انتخاب طراحی مطالعه', desc: 'مقایسهٔ طراحی‌های مقطعی، کوهورت و کارآزمایی و تناسب هرکدام با سؤال.' },
      { id: 'rm-03', time: '۲۶:۴۵', title: 'خواندن نتایج بدون فریب آماری', desc: 'فاصلهٔ اطمینان، اندازهٔ اثر و معناداری؛ چه چیزی واقعاً مهم است.' },
      { id: 'rm-04', time: '۴۶:۱۰', title: 'نقد مقاله با یک چارچوب ثابت', desc: 'چهار پرسش ثابت که با آن‌ها هر مقاله را در چند دقیقه ارزیابی می‌کنی.' },
      { id: 'rm-05', time: '۶۷:۲۰', title: 'نوشتن نتیجه‌گیری مسئولانه', desc: 'مرز میان یافته‌های مطالعه و ادعاهایی که داده پشتیبانشان نیست.' },
    ],
  },
};

/* لوگوهای نوار متحرک زیر هیرو — دانشگاه‌ها و مراجع آموزش پزشکی مطرح جهان (به ترتیب نمایش).
   `name` فقط برای screen reader است؛ در نوار چیزی جز لوگو دیده نمی‌شود. */
const SOURCE_LOGOS = [
  { name: 'دانشکدهٔ پزشکی هاروارد', logo: harvardMedLogo },
  { name: 'دانشگاه جانز هاپکینز', logo: johnsHopkinsLogo },
  { name: 'دانشکدهٔ پزشکی استنفورد', logo: stanfordMedLogo },
  { name: 'دانشگاه آکسفورد', logo: oxfordLogo },
  { name: 'دانشگاه کمبریج', logo: cambridgeLogo },
  { name: 'ژورنال پزشکی نیوانگلند', logo: nejmLogo },
  { name: 'کورسرا', logo: courseraLogo },
  { name: 'سازمان جهانی بهداشت', logo: whoLogo },
  { name: 'خان آکادمی', logo: khanAcademyLogo },
];

/* نوار بی‌پایان: فهرست **چهار بار** تکرار می‌شود و انیمیشن فقط به اندازهٔ یک نسخه
   (۲۵٪ کل ترک) جابه‌جا می‌شود. با دو نسخه، به‌ازای صفحه‌های پهن، «یک نسخه» از پنجرهٔ
   دید باریک‌تر می‌شد و انتهای چرخه جای خالی دیده می‌شد. */
const MARQUEE_LOGOS = [...SOURCE_LOGOS, ...SOURCE_LOGOS, ...SOURCE_LOGOS, ...SOURCE_LOGOS];

function Icon({ name, className = 'h-5 w-5' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (name === 'back') return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></svg>;
  if (name === 'play') return <svg {...common}><path d="m9 6 9 6-9 6z" fill="currentColor" stroke="none" /></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="8.7" /><path d="M12 7v5l3.2 2" /></svg>;
  if (name === 'pause') return <svg {...common}><path d="M9 6v12M15 6v12" /></svg>;
  if (name === 'volume') return <svg {...common}><path d="M5 10v4h3l4 3V7l-4 3H5Z" /><path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.2 7.2 0 0 1 0 10" /></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3.1" /><path d="M12 3v2.4M12 18.6V21M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /></svg>;
  if (name === 'chevron') return <svg {...common}><path d="M15 6l-6 6 6 6" /></svg>;
  if (name === 'more') return <svg {...common}><circle cx="6" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="18" cy="12" r="1" fill="currentColor" /></svg>;
  if (name === 'heart') return <svg {...common}><path d="M20.8 8.7c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" /></svg>;
  if (name === 'flag') return <svg {...common}><path d="M6 21V4" /><path d="M6 4h11l-2.2 4L17 12H6" /></svg>;
  if (name === 'expand') return <svg {...common}><path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" /></svg>;
  if (name === 'bright') return <svg {...common}><circle cx="12" cy="12" r="3.8" /><path d="M12 2.9v2M12 19.1v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.9 12h2M19.1 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (name === 'subtitle') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2.4" /><path d="M6.6 14h4.2M13.2 14h4.2" /></svg>;
  if (name === 'note') return <svg {...common}><path d="M4 20h4L18 10l-4-4L4 16v4Z" /><path d="m14.4 5.6 4 4" /></svg>;
  return null;
}

function CourseCard({ course, onOpen }) {
  return (
    <article className="intl-courses-card" style={{ '--course-accent': course.accent, '--course-soft': course.accentSoft }}>
      {/* بخش تصویر کارت: تصویر واقعی دوره + پردهٔ تیره تا عنوان روی آن خوانا بماند */}
      <div className="intl-courses-card__artwork-wrap">
        <img className="intl-courses-card__photo" src={course.image} alt="" loading="lazy" decoding="async" />
        <span className="intl-courses-card__shade" aria-hidden="true" />
        <span className="intl-courses-card__title">{course.title}</span>
      </div>

      <div className="intl-courses-card__body">
        <div className="intl-courses-card__provider">
          <img className="intl-courses-card__provider-logo" src={course.providerLogo} alt="" loading="lazy" decoding="async" />
          <span>{course.provider}</span>
        </div>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <div className="intl-courses-card__meta">
          <span><Icon name="clock" className="h-3.5 w-3.5" /> {toFa(course.duration)} ساعت</span>
          <span><Icon name="play" className="h-3.5 w-3.5" /> {toFa(course.lessons)} ویدیو</span>
          {course.progress > 0 && (
            <div className="intl-courses-card__progress-track" aria-label={`پیشرفت ${toFa(course.progress)} درصد`}>
              <i style={{ width: `${course.progress}%` }} />
            </div>
          )}
        </div>
        <button type="button" className="intl-courses-card__enter" onClick={() => onOpen(course.id)}>
          <Icon name="play" className="h-3.5 w-3.5" />
          ورود به دوره
        </button>
      </div>
    </article>
  );
}

/* زبان‌های زیرنویس — پیش از اتصال به سرویس، همین‌جا تعریف می‌شوند */
const SUBTITLE_LANGS = [
  { id: 'fa', label: 'فارسی' },
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
];

/* تنظیم عددی (صدا/نور) — دکمهٔ کم و زیاد */
function PlayerStepper({ label, icon, value, onChange, min = 0, max = 100, step = 10 }) {
  const clamp = (next) => Math.min(max, Math.max(min, next));
  return (
    <span className="intl-course-player__stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`کم کردن ${label}`} onClick={() => onChange(clamp(value - step))}>−</button>
      <span className="intl-course-player__stepper-value" title={label}>
        <Icon name={icon} className="h-4 w-4" />
        {toFa(value)}٪
      </span>
      <button type="button" aria-label={`زیاد کردن ${label}`} onClick={() => onChange(clamp(value + step))}>+</button>
    </span>
  );
}

function CoursePlayer({ course, detail, lesson, lessonIndex }) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [brightness, setBrightness] = useState(100);
  const [subtitle, setSubtitle] = useState(null);
  const [subtitleOpen, setSubtitleOpen] = useState(false);
  const shellRef = useRef(null);
  const activeSubtitle = SUBTITLE_LANGS.find((item) => item.id === subtitle);

  const togglePlay = () => setPlaying((value) => !value);

  const toggleFullscreen = () => {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else node.requestFullscreen?.();
  };

  return (
    <div className="intl-course-player" aria-label={`پخش ${lesson.title}`} ref={shellRef}>
      <img
        className="intl-course-player__image"
        src={course.image}
        alt=""
        style={{ filter: `brightness(${brightness / 100})` }}
      />
      <span className="intl-course-player__shade" aria-hidden="true" />
      <button
        type="button"
        className="intl-course-player__play"
        aria-label={playing ? 'توقف ویدیو' : 'پخش ویدیو'}
        aria-pressed={playing}
        onClick={togglePlay}
      >
        <Icon name={playing ? 'pause' : 'play'} className="h-8 w-8" />
      </button>

      {activeSubtitle && <span className="intl-course-player__caption">زیرنویس {activeSubtitle.label} روشن است</span>}

      <div className="intl-course-player__controls">
        <button type="button" aria-label={playing ? 'توقف ویدیو' : 'پخش ویدیو'} onClick={togglePlay}>
          <Icon name={playing ? 'pause' : 'play'} className="h-4 w-4" />
        </button>
        <PlayerStepper label="صدا" icon="volume" value={volume} onChange={setVolume} />
        <PlayerStepper label="نور" icon="bright" value={brightness} onChange={setBrightness} min={50} />
        <div className="intl-course-player__progress" aria-hidden="true"><span style={{ width: `${Math.max(18, (lessonIndex + 1) * 16)}%` }} /></div>
        <span className="intl-course-player__time">{lesson.time} / {detail.duration}</span>
        <span className="intl-course-player__subtitle">
          <button
            type="button"
            aria-label="زیرنویس"
            aria-expanded={subtitleOpen}
            className={subtitle ? 'is-active' : ''}
            onClick={() => setSubtitleOpen((value) => !value)}
          >
            <Icon name="subtitle" className="h-4 w-4" />
          </button>
          {subtitleOpen && (
            <span className="intl-course-player__menu" role="menu" aria-label="انتخاب زبان زیرنویس">
              <button type="button" role="menuitemradio" aria-checked={!subtitle} onClick={() => { setSubtitle(null); setSubtitleOpen(false); }}>خاموش</button>
              {SUBTITLE_LANGS.map((lang) => (
                <button key={lang.id} type="button" role="menuitemradio" aria-checked={subtitle === lang.id} onClick={() => { setSubtitle(lang.id); setSubtitleOpen(false); }}>{lang.label}</button>
              ))}
            </span>
          )}
        </span>
        <button type="button" aria-label="تنظیمات پخش"><Icon name="settings" className="h-4 w-4" /></button>
        <button type="button" aria-label="تمام‌صفحه" onClick={toggleFullscreen}><Icon name="expand" className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/* زیر ویدیو: عنوان و توضیح همان ویدیو + یادداشت‌برداری */
function LessonInfo({ course, lesson, userId }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!body.trim()) return;
    await createNote({ id: userId }, {
      title: `یادداشت — ${lesson.title}`,
      kind: 'text',
      body,
      subjectId: course.id,
      tags: ['یادداشت ویدیو'],
      sourceType: 'lesson',
      sourceTitle: `${course.title} · ${lesson.title}`,
    });
    setBody('');
    setOpen(false);
    setSaved(true);
  };

  return (
    <section className="intl-course-lesson" aria-label="اطلاعات این ویدیو">
      <div className="intl-course-lesson__head">
        <h2>{lesson.title}</h2>
        <button type="button" className={`intl-course-lesson__note${open ? ' is-active' : ''}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); setSaved(false); }}>
          <Icon name="note" className="h-4 w-4" />
          یادداشت‌برداری
        </button>
      </div>
      <p>{lesson.desc}</p>

      {open && (
        <div className="intl-course-lesson__form">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="نکته‌ای که می‌خواهی بمانَد…" aria-label="متن یادداشت" />
          <div>
            <button type="button" className="is-primary" onClick={save} disabled={!body.trim()}>ذخیره در یادداشت‌ها</button>
            <button type="button" onClick={() => setOpen(false)}>انصراف</button>
          </div>
        </div>
      )}
      {saved && !open && <p className="intl-course-lesson__saved">یادداشت ذخیره شد؛ در بخش «یادداشت‌ها» پیدایش می‌کنی.</p>}
    </section>
  );
}

/* سرصفحهٔ دوره — کادر اطلاعات (هشتک‌ها، عنوان، ناشر، کنش‌ها).
   طبق بازخورد کاربر این کادر **بالای ویدیوهای دوره** می‌نشیند. */
function CourseInfoHead({ course, liked, onToggleLike, onOpenProvider }) {
  return (
    <header className="intl-course-detail__head">
      <div className="intl-course-detail__tags">
        {course.tags.map((tag) => <span key={tag}>{tag}</span>)}
        <span>{course.categoryLabel}</span>
      </div>
      <h1>{course.title}</h1>
      <p className="intl-course-detail__lead">{course.description}</p>
      <div className="intl-course-detail__meta-row">
        <button type="button" className="intl-course-detail__author" onClick={() => onOpenProvider(course.providerId)}>
          <img src={course.providerLogo} alt="" />
          <span><strong>{course.provider}</strong><small>{course.providerEn}</small></span>
          <Icon name="chevron" className="h-4 w-4" />
        </button>
        <div className="intl-course-detail__actions">
          <button type="button" className={liked ? 'is-active' : ''} aria-pressed={liked} onClick={onToggleLike}>
            <Icon name="heart" className="h-4 w-4" />
            <span>{liked ? 'پسندیده شد' : 'پسندیدن'}</span>
          </button>
          <button type="button">
            <Icon name="flag" className="h-4 w-4" />
            <span>گزارش</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function CourseDetailView({ course, userId, onBack, onOpenCourse, onOpenProvider }) {
  const detail = COURSE_DETAIL_DATA[course.id] ?? COURSE_DETAIL_DATA['global-health'];
  const [lessonIndex, setLessonIndex] = useState(1);
  const [liked, setLiked] = useState(false);
  const lesson = detail.lessons[lessonIndex] ?? detail.lessons[0];
  const suggestedCourse = COURSES.find((item) => item.id !== course.id);

  return (
    <section className="intl-course-detail" aria-label={`دورهٔ ${course.title}`} style={{ '--course-accent': course.accent }}>
      <div className="intl-course-detail__topbar">
        <button type="button" className="intl-course-detail__back" onClick={onBack}>
          <Icon name="back" className="h-4 w-4" />
          بازگشت به دوره‌ها
        </button>
        <span className="intl-course-detail__crumb">دوره‌های بین‌الملل <b>/</b> {course.provider}</span>
      </div>

      <CourseInfoHead
        course={course}
        liked={liked}
        onToggleLike={() => setLiked((value) => !value)}
        onOpenProvider={onOpenProvider}
      />

      <div className="intl-course-detail__layout">
        <main className="intl-course-detail__main">
          <CoursePlayer course={course} detail={detail} lesson={lesson} lessonIndex={lessonIndex} />
          <LessonInfo course={course} lesson={lesson} userId={userId} />
        </main>

        <aside className="intl-course-detail__aside">
          <section className="intl-course-playlist" aria-labelledby="intl-playlist-title">
            <header>
              <div><h2 id="intl-playlist-title">محتوای دوره</h2><span>{toFa(course.lessons)} ویدیو · {course.level}</span></div>
              <button type="button" aria-label="گزینه‌های فهرست"><Icon name="more" className="h-4 w-4" /></button>
            </header>
            <ol>
              {detail.lessons.map((item, index) => (
                <li key={item.id} className={index === lessonIndex ? 'is-active' : ''}>
                  <button type="button" onClick={() => setLessonIndex(index)} aria-current={index === lessonIndex ? 'true' : undefined}>
                    <span className="intl-course-playlist__frame">
                      <img src={course.image} alt="" />
                      <span className="intl-course-playlist__time">{item.time}</span>
                    </span>
                    <span className="intl-course-playlist__title">{item.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="intl-course-suggestions" aria-labelledby="intl-suggestions-title">
            <h2 id="intl-suggestions-title">دوره‌های پیشنهادی</h2>
            {suggestedCourse && (
              <button type="button" className="intl-course-suggestion" onClick={() => onOpenCourse(suggestedCourse.id)}>
                <img src={suggestedCourse.image} alt="" />
                <span><strong>{suggestedCourse.title}</strong><small>{suggestedCourse.description}</small></span>
              </button>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

/* لایهٔ «منبع» — با کلیک روی نام دانشگاه/نهاد باز می‌شود: معرفی منبع + دوره‌های همان منبع در تپش. */
function ProviderView({ providerId, onBack, onOpenCourse }) {
  const provider = PROVIDER_DATA[providerId];
  const ownCourses = COURSES.filter((course) => course.providerId === providerId);
  if (!provider || ownCourses.length === 0) return null;

  const head = ownCourses[0];
  const siblingCourses = COURSES.filter((course) => course.providerId !== providerId && course.category === head.category);

  return (
    <section className="intl-provider" aria-label={`منبع ${head.provider}`} style={{ '--course-accent': head.accent }}>
      <div className="intl-course-detail__topbar">
        <button type="button" className="intl-course-detail__back" onClick={onBack}>
          <Icon name="back" className="h-4 w-4" />
          بازگشت
        </button>
        <span className="intl-course-detail__crumb">منابع بین‌الملل <b>/</b> {head.provider}</span>
      </div>

      <header className="intl-provider__hero">
        <img className="intl-provider__logo" src={head.providerLogo} alt="" />
        <div className="intl-provider__identity">
          <h1>{head.provider}</h1>
          <span>{provider.nameEn}</span>
          <div className="intl-provider__facts">
            <span>کشور: {provider.country}</span>
            <span>سال بنیان: {provider.founded}</span>
            <span>{toFa(ownCourses.length)} دوره در تپش</span>
          </div>
        </div>
        <p className="intl-provider__description">{provider.description}</p>
        <div className="intl-provider__focus">
          {provider.focus.map((item) => <span key={item}>{item}</span>)}
        </div>
      </header>

      <section className="intl-provider__courses" aria-labelledby="intl-provider-courses-title">
        <h2 id="intl-provider-courses-title">دوره‌های این منبع در تپش</h2>
        <div className="intl-courses-grid">
          {ownCourses.map((course) => <CourseCard key={course.id} course={course} onOpen={onOpenCourse} />)}
        </div>
      </section>

      {siblingCourses.length > 0 && (
        <section className="intl-provider__courses" aria-labelledby="intl-provider-related-title">
          <h2 id="intl-provider-related-title">دوره‌های مرتبط در همین حوزه</h2>
          <div className="intl-courses-grid">
            {siblingCourses.map((course) => <CourseCard key={course.id} course={course} onOpen={onOpenCourse} />)}
          </div>
        </section>
      )}
    </section>
  );
}

export default function InternationalCoursesLayer({ userId = 'guest', onBack }) {
  /* فیلتر و دورهٔ باز روی مسیر داشبورد می‌نشینند؛ متن کادر جست‌وجو محلی می‌ماند */
  const [view, setView, patchView] = useLayerRoute(LAYER_IDS.intlCourses, INTL_COURSES_VIEW);
  const [query, setQuery] = useState('');
  const activeFilter = view.filter ?? 'all';
  const selectedCourse = view.name === 'detail' ? COURSES.find((course) => course.id === view.courseId) : null;
  const setActiveFilter = (filter) => patchView({ name: 'catalog', filter });
  const openCourse = (courseId) => setView({ name: 'detail', courseId, filter: activeFilter });
  const closeCourse = () => setView({ name: 'catalog', filter: activeFilter });
  const openProvider = (providerId) => setView({ name: 'provider', providerId, fromCourseId: view.courseId, filter: activeFilter });
  const closeProvider = () => setView(
    view.fromCourseId
      ? { name: 'detail', courseId: view.fromCourseId, filter: activeFilter }
      : { name: 'catalog', filter: activeFilter },
  );

  /* جابه‌جایی نماها باید از بالای لایه شروع شود؛ اسکرول باید **بعد از** رندر انجام شود،
     وگرنه مرورگر ارتفاع صفحهٔ قبلی را نگه می‌دارد و نما از میان لایه باز می‌شود. */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view.name, view.courseId, view.providerId]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    return COURSES.filter((course) => {
      const matchesFilter = activeFilter === 'all' || course.category === activeFilter;
      const matchesQuery = !normalizedQuery || [course.title, course.provider, course.providerEn, ...course.tags].some((value) => value.toLocaleLowerCase('fa').includes(normalizedQuery));
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  if (selectedCourse) {
    return (
      <section dir="rtl" aria-label={`دورهٔ ${selectedCourse.title}`} className="intl-courses-layer">
        <CourseDetailView
          course={selectedCourse}
          userId={userId}
          onBack={closeCourse}
          onOpenCourse={openCourse}
          onOpenProvider={openProvider}
        />
      </section>
    );
  }

  if (view.name === 'provider') {
    return (
      <section dir="rtl" aria-label="منبع بین‌الملل" className="intl-courses-layer">
        <ProviderView providerId={view.providerId} onBack={closeProvider} onOpenCourse={openCourse} />
      </section>
    );
  }

  return (
    <section dir="rtl" aria-label="دوره‌های بین‌الملل" className="intl-courses-layer">
      <header className="intl-courses-header">
        <div className="intl-courses-header__left">
          <button type="button" className="intl-courses-back" onClick={onBack}>
            <Icon name="back" className="h-4 w-4" />
            بازگشت به دوره‌ها
          </button>
        </div>
      </header>

      {/* سربرگ وسط‌چین — عین تیتر هیروی بخش فلش‌کارت */}
      <header className="intl-courses-hero dash-stagger">
        <h1 className="intl-courses-hero__title">
          <span className="intl-courses-hero__title-top">یادگیری فراتر از مرزها</span>
          <span className="intl-courses-hero__title-accent">دانش جهانی، به زبان تپش</span>
        </h1>
        <p className="intl-courses-hero__subtitle">ویدیوها و دوره‌های آموزشی منتخب از دانشگاه‌ها و رسانه‌های معتبر جهان؛ یک‌جا، دسته‌بندی‌شده و آماده برای یادگیری عمیق.</p>
      </header>

      {/* نوار لوگوهای متحرک — یک ردیف بی‌پایان از مراجع آموزش پزشکی جهان.
          `loading="lazy"` اینجا ممنوع است: مرورگر تصمیم تنبل‌بودن را از **جای چیدمانی**
          تصویر می‌گیرد و ترکِ نوار با `transform` جابه‌جا می‌شود، پس تصویرهایی که در
          چیدمان بیرون از پنجره‌اند هیچ‌وقت وارد پنجره نمی‌شوند و هرگز بارگذاری نمی‌شوند
          (نتیجه: انتهای هر نسخه خالی می‌ماند و نوار «تمام» به نظر می‌رسد). */}
      <div className="intl-courses-marquee" aria-label="دانشگاه‌ها و مراجع آموزش پزشکی جهان">
        <div className="intl-courses-marquee__track">
          {MARQUEE_LOGOS.map((source, index) => (
            <span className="intl-courses-marquee__logo" key={`${source.name}-${index}`} aria-hidden={index >= SOURCE_LOGOS.length ? 'true' : undefined}>
              <img src={source.logo} alt={source.name} loading="eager" decoding="async" />
            </span>
          ))}
        </div>
      </div>

      <section id="intl-course-catalog" className="intl-courses-catalog" aria-labelledby="intl-catalog-title">
        <div className="intl-courses-catalog__heading"><h2 id="intl-catalog-title">دوره مناسب خودت را پیدا کن</h2></div>
        <div className="intl-courses-toolbar">
          <label className="intl-courses-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی دوره، دانشگاه یا موضوع..." aria-label="جست‌وجوی دوره‌ها" /></label>
          <div className="intl-courses-filters" role="tablist" aria-label="دسته‌بندی دوره‌ها">{FILTERS.map((filter) => <button type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? 'is-active' : ''} key={filter.id} onClick={() => setActiveFilter(filter.id)}>{filter.label}</button>)}</div>
        </div>
        {filteredCourses.length > 0 ? <div className="intl-courses-grid">{filteredCourses.map((course) => <CourseCard key={course.id} course={course} onOpen={openCourse} />)}</div> : <div className="intl-courses-empty"><Icon name="search" className="h-7 w-7" /><strong>دوره‌ای با این مشخصات پیدا نشد</strong><span>عبارت جست‌وجو یا فیلتر را تغییر بده و دوباره امتحان کن.</span></div>}
      </section>
    </section>
  );
}
