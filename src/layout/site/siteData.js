/*
 * جدول‌های دادهٔ پوسته و صفحهٔ اصلی (بدون JSX).
 *
 * از `src/App.jsx` جدا شد تا آن فایل غولِ تک‌فایلی نماند.
 */

import { GREEN_PATH_DASHBOARD_HASH } from '../../router/routeHashes.js';
import trophyIcon from '../../../images/icons/trophy.png';
import aiIcon from '../../../images/icons/ai-technology.png';
import checklistIcon from '../../../images/icons/checklist.png';
import distanceIcon from '../../../images/icons/distance.png';
import { getLatestArticles } from '../../services/articles/articlesService';
import { LAYER_IDS, OVERLAY_IDS, dashboardRouteHash } from '../dashboard/dashboardRoute';
import baleSocialIcon from '../../../images/icons/Asset 13.webp';
import eitaaSocialIcon from '../../../images/icons/eitaa.svg';
import telegramSocialIcon from '../../../images/icons/Asset 11.webp';
import instagramSocialIcon from '../../../images/icons/Asset 14.webp';
import youtubeSocialIcon from '../../../images/icons/youtube.svg';

const benefitRows = [
  [
    {
      title: 'یادگیری نوین دروس پزشکی',
      description: 'با استفاده از جدیدترین متدهای یادگیری و یک رابط گرافیکی جذاب، دیگه درس خوندن سخت نخواهد بود.',
      accent: 'lavender',
      size: 'wide',
    },
    {
      title: 'درساتو از یک حرفه‌ای بپرس',
      description: 'جایی در مورد چیزی سوال داشتی؟ با چند کلیک اطلاعات پزشکی‌تو بروز کن؛ دستیار هوشمند کنار توست.',
      accent: 'sky',
      size: 'regular',
    },
  ],
  [
    {
      title: 'با بهترین‌ها رقابت کن',
      description: 'با همکلاسی‌هات و دانشجوهای سراسر کشور رقابت کن؛ به همراه آزمون‌های آنلاین.',
      accent: 'mint',
      size: 'regular',
    },
    {
      title: 'خودتو برای علوم پایه آماده کن',
      description: 'در کوتاه‌ترین زمان و با کیفیت بالا خودتو برای علوم پایه آماده کن؛ بهترین دوره‌ها منتظر تو هستند.',
      accent: 'copper',
      size: 'wide',
    },
  ],
];

const tapeshFeatures = [
  {
    title: 'با بهترین‌ها رقابت کن',
    icon: trophyIcon,
    accent: 'green',
  },
  {
    title: 'با یک دستیار هوشمند درس بخون',
    icon: aiIcon,
    accent: 'blue',
  },
  {
    title: 'از بانک تست استفاده کن',
    icon: checklistIcon,
    accent: 'brown',
  },
  {
    title: 'با مسیر سبز یادبگیر',
    icon: distanceIcon,
    accent: 'purple',
  },
];

/* سه مقالهٔ آخر، مستقیم از لایه دادهٔ مقالات — همان منبع صفحهٔ مقالات */
const homeArticles = getLatestArticles(3);

const faqItems = [
  {
    question: 'تپش برای چه دانشجویانی مناسب است؟',
    answer: 'تپش برای دانشجویان علوم پزشکی طراحی شده است؛ از شروع ترم و یادگیری مفهومی تا جمع‌بندی و آمادگی آزمون.',
  },
  {
    question: 'دوره مسیر سبز چیست؟',
    answer: 'مسیر سبز، یک برنامه جامع مرحله به مرحله برای ساختن عادت مطالعه، یادگیری هدفمند، رنک دانشگاه شدن و پیشرفت پیوسته در دروس پزشکی است.',
  },
  {
    question: 'محتوای آموزشی تپش شامل چه چیزهایی است؟',
    answer: 'درسنامه‌های جامع، خلاصه نکات، بانک تست، آزمون‌های آنلاین و ابزارهای هوشمند یادگیری در تپش قرار دارند.',
  },
  {
    question: 'تپش چگونه به من کمک می‌کند نقاط ضعفم را پیدا کنم؟',
    answer: 'با تحلیل پاسخ‌ها، آزمون‌های هدفمند و مرور مباحث، بخش‌هایی که نیاز به تمرین بیشتری دارند برای شما مشخص می‌شوند.',
  },
  {
    question: 'آیا محتوای تپش به درد امتحانات دانشگاه می‌خورد؟',
    answer: 'بله؛ محتوای تپش برای مطالعه طول ترم، امتحانات دانشگاه و آمادگی آزمون‌های علوم پزشکی قابل استفاده است.',
  },
  {
    question: 'چگونه اشتراک تپش را تهیه کنم؟',
    answer: 'از بخش محصولات، دوره موردنظر خود را انتخاب کنید و پس از ورود یا ثبت‌نام، مراحل تهیه اشتراک را ادامه دهید.',
  },
];

/*
 * نوار چرخانِ انتهای فوتر — چهار کادرِ دسته‌بندی. هر کدام به بخش واقعیِ خودش
 * می‌رسد، نه به یک لنگرِ تزئینی (تلهٔ ۱۰): سه مقصد لایهٔ داشبوردند و از
 * `dashboardRouteHash` + `LAYER_IDS` ساخته می‌شوند؛ «علوم پایه» تنها مقصدِ
 * غیرداشبوردی است و به صفحهٔ مستقلِ محصولات می‌رود (همان نگاشتی که فوترِ قبلی داشت).
 */
const motionItems = [
  { title: 'دستیار', accent: 'blue', href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.ai }) },
  { title: 'علوم پایه', accent: 'brown', href: '#products' },
  { title: 'بانک تست', accent: 'green', href: dashboardRouteHash({ section: 'tests', layer: LAYER_IDS.testBank }) },
  { title: 'درسنامه جامع', accent: 'purple', href: dashboardRouteHash({ section: 'courses', layer: LAYER_IDS.comprehensive }) },
];

/* نشانِ تپش در هدرِ صفحهٔ اصلی.
   روی همین نشان شمارندهٔ ایستر اگ نشسته است؛ منطقِ شمارش در
   `useEasterEggClick` است تا در هدرِ داشبورد هم دقیقاً همین رفتار تکرار شود
   و دو پیاده‌سازیِ موازی نداشته باشیم. */
const FOOTER_PRODUCT_LINKS = [
  { title: 'درسنامه جامع', href: dashboardRouteHash({ section: 'courses', layer: LAYER_IDS.comprehensive }) },
  { title: 'میکرو درسنامه', href: dashboardRouteHash({ section: 'courses', layer: LAYER_IDS.micro }) },
  { title: 'بانک تست', href: dashboardRouteHash({ section: 'tests', layer: LAYER_IDS.testBank }) },
  { title: 'دستیار هوشمند', href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.ai }) },
  { title: 'مسیر سبز', href: GREEN_PATH_DASHBOARD_HASH },
];

const FOOTER_SECTION_LINKS = [
  { title: 'ویکی تپش', href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.wiki }) },
  { title: 'شبکه دانش', href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.knowledge }) },
  { title: 'مقالات', href: '#articles' },
  /* پشتیبانی یک تبِ پنل تنظیمات است، نه لایه؛ مقصدش همان مسیر واقعی است */
  { title: 'پشتیبانی', href: dashboardRouteHash({ overlay: OVERLAY_IDS.settings, tab: 'support' }) },
];

/*
 * پنج فضای مجازی تپش. نشانهٔ هر کدام یک تصویر تک‌فام است — دو تای اولِ قبلی
 * (ایتا با حرف «e» و یوتیوب با مثلث) نشانهٔ تایپی بودند و کنار سه نشانهٔ تصویریِ
 * دیگر ناهمگون می‌شدند؛ جایشان لوگوی واقعی و هم‌اندازهٔ همان‌ها نشست.
 * رنگشان از `filter: var(--icon-filter)` می‌آید (سفید در تم تیره، تیره در تم روشن).
 */
const FOOTER_SOCIAL_LINKS = [
  { id: 'bale', label: 'بله', href: 'https://ble.ir/tapesh_production', image: baleSocialIcon },
  { id: 'eitaa', label: 'ایتا', href: 'https://eitaa.com/tapesh_production', image: eitaaSocialIcon },
  { id: 'telegram', label: 'تلگرام', href: 'https://t.me/tapesh_production', image: telegramSocialIcon },
  { id: 'instagram', label: 'اینستاگرام', href: 'https://www.instagram.com/tapesh_production/', image: instagramSocialIcon },
  { id: 'youtube', label: 'یوتیوب', href: 'https://www.youtube.com/@tapesh_production', image: youtubeSocialIcon },
];

/*
 * ── کادرهای تبلیغی محصولات سرصفحه ──
 *
 * چهار محصولی که کاربر باید از همان صفحهٔ اصلی ببیند. هر کادر سه چیز دارد:
 * یک برچسبِ کوتاهِ رده (`eyebrow`)، نام محصول (`title`) و یک جملهٔ توضیح. نشانهٔ
 * گرافیکی هر کادر از `CatalogIcon` می‌آید — همان مجموعه‌ای که کارت‌های کاتالوگ هم
 * از آن لوگو می‌گیرند، پس شکل آیکون‌ها یک تعریف دارد و دو مصرف.
 *
 * مقصد هر کادر یک لایهٔ واقعیِ داشبورد است، نه لنگرِ تزیینیِ صفحه (تلهٔ ۱۰):
 * آدرس‌ها از `dashboardRouteHash` + `LAYER_IDS` ساخته می‌شوند، پس با تغییر نام
 * یک لایه هیچ‌کدام از کارت‌ها بی‌صدا از کار نمی‌افتند.
 *
 * چرا `export`: دکمهٔ کادرها `<button>` است و مقصدش در HTML نمی‌نشیند، پس تنها
 * راهِ سنجیدنِ «هر چهار کادر به یک لایهٔ واقعی می‌روند» خواندن خودِ همین داده در
 * هارنس است — همان دلیلی که `SignupPromptModal` هم `export` شد.
 */
const homePromoCards = [
  {
    id: 'test-bank',
    eyebrow: 'تمرین',
    title: 'بانک تست علوم پایه',
    accent: '#5b8cc7',
    description: 'تست‌های طبقه‌بندی‌شده با پاسخ تشریحی؛ بعد از هر آزمون، تحلیل می‌گوید کجا وقت کم آوردی.',
    href: dashboardRouteHash({ section: 'tests', layer: LAYER_IDS.testBank }),
  },
  {
    id: 'tapesh-ai',
    eyebrow: 'دستیار',
    title: 'تپش هوشمند',
    accent: '#937fcd',
    description: 'سؤالت را همان‌جا که گیر کرده‌ای بپرس؛ پاسخ متناسب با همان مبحثی که در آن هستی.',
    href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.ai }),
  },
  {
    id: 'wiki',
    eyebrow: 'مرجع',
    title: 'ویکی تپش',
    accent: '#b99a86',
    description: 'مقالات مرجعِ پیوسته به هم؛ از یک مفهوم شروع کن و تا مثال بالینی و تست‌های همان مبحث برو.',
    href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.wiki }),
  },
  {
    id: 'knowledge',
    eyebrow: 'ارتباط',
    title: 'شبکه دانش',
    accent: '#77b787',
    description: 'هر مفهوم به درس‌ها، مقالات و تست‌های مرتبط وصل است؛ ببین یک موضوع کجای نقشه می‌نشیند.',
    href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.knowledge }),
  },
];

/*
 * پاپ‌آپ «اول ثبت‌نام کن» — دیگر به هیچ کارتی وصل نیست.
 *
 * چرا باقی مانده: کارت‌های دورهٔ هیرو گاردِ ثبت‌نام ندارند و همه مستقیم وارد
 * لایهٔ دوره می‌شوند، پس این پاپ‌آپ در جریان عادی سایت باز نمی‌شود. کامپوننت
 * حذف نشد چون تنها جایی است که «مسیر ثبت‌نام» را قدم‌به‌قدم توضیح می‌دهد و
 * هارنس مستقیم رندرش می‌کند؛ اگر روزی مسیرِ پولی/قفل‌شده‌ای اضافه شد، از همین
 * استفاده می‌کند. Escape و کلیک روی پرده می‌بندند (قرارداد مودال‌های پروژه).
 *
 * چرا `export`: این پاپ‌آپ پشت state است و در رندر سرور (بدون کلیک) هرگز باز
 * نمی‌شود، پس تنها راهِ سنجیدنِ محتوایش رندر مستقیم خودش است — همان کاری که
 * برای `AdminShell` انجام شد.
 */

export { benefitRows, tapeshFeatures, homeArticles, faqItems, motionItems, FOOTER_PRODUCT_LINKS, FOOTER_SECTION_LINKS, FOOTER_SOCIAL_LINKS, homePromoCards };
