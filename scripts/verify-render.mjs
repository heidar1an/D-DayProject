/*
 * verify-render — بررسی بدون مرورگر: تم روشن/تیره + پایداری هدر داشبورد.
 *
 * چرا این فایل وجود دارد:
 *   پروژه `npm run build` را ممنوع کرده (پوشهٔ dist/assets را پاک می‌کند) و
 *   `npm install` هم بلاک است، پس jsdom نداریم. از طرفی `ErrorBoundary` وجود
 *   ندارد؛ یعنی یک `ReferenceError` در یک لایه، کل درخت را بی‌هیچ خطای UI خالی
 *   می‌کند. پس «رندر بدون خطا» خودش باارزش‌ترین سنجه است.
 *
 * چه چیزی سنجیده می‌شود:
 *   ۱. منطق خالص سرویس تم (خواندن/نوشتن/تعویض + مقدار آشغال).
 *   ۲. رندر همهٔ سطوح و وجود دکمهٔ تم در هرکدام.
 *   ۳. هدر داشبورد: نبود انیمیشن ورودی، سالم بودن آیکون‌ها و ناوبری.
 *   ۴. رگرسیون صفحهٔ اصلی.
 *
 * چه چیزی سنجیده **نمی‌شود** (صادقانه): افکت‌ها، تعامل، چیدمان و CSS.
 * برای CSS، `scripts/theme-verify.mjs` و `scripts/theme-contrast.mjs` هست.
 *
 * خروجی موقت در `node_modules/.cache/tapesh-verify/` می‌نشیند تا در مخزن نماند.
 * اجرا: node scripts/verify-render.mjs
 *
 * ⚠️ از `const HARNESS` تا بک‌تیک پایانی‌اش **یک رشتهٔ واحد** است (String.raw). پس هر
 * بک‌تیک یا «${» داخل سنجه‌ها و کامنت‌های همان بازه، رشته را از هم می‌پاشد و خطا در
 * جای کاملاً بی‌ربط گزارش می‌شود (یک‌بار همین اتفاق افتاد). در آن بازه فقط کوتیشن
 * تک‌کوتیشنی و «گیومه» بنویس.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, 'node_modules/.cache/tapesh-verify');

mkdirSync(CACHE, { recursive: true });

/* ══════════════════════════════════════════════════════════════
 * هارنس — به‌صورت رشته نوشته می‌شود تا کل بررسی در یک فایل بماند
 * ══════════════════════════════════════════════════════════════ */
const HARNESS = String.raw`
/* ═══ شیم حداقلی DOM پیش از هر import ═══ */
const attrs = {};
const store = {};

globalThis.document = {
  documentElement: {
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    setAttribute: (name, value) => { attrs[name] = String(value); },
    removeAttribute: (name) => { delete attrs[name]; },
  },
  querySelector: () => null,
  addEventListener() {},
  removeEventListener() {},
  head: { appendChild() {} },
  createElement: () => ({}),
  fonts: { ready: Promise.resolve() },
};

function makeStorage() {
  const bag = {};
  return {
    getItem: (key) => (key in bag ? bag[key] : null),
    setItem: (key, value) => { bag[key] = String(value); },
    removeItem: (key) => { delete bag[key]; },
  };
}

globalThis.window = {
  location: { hash: '', pathname: '/', search: '' },
  history: { state: null, pushState() {}, replaceState() {} },
  localStorage: {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
  },
  sessionStorage: makeStorage(),
  addEventListener() {},
  removeEventListener() {},
  scrollTo() {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  requestAnimationFrame: (fn) => setTimeout(() => fn(0), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  innerWidth: 1440,
  innerHeight: 900,
  getComputedStyle: () => ({ columnGap: '0', gap: '0' }),
};

/* در Node 22، navigator فقط getter است ⇒ defineProperty */
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, userAgent: 'node' },
  configurable: true,
  writable: true,
});

globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame;
globalThis.localStorage = globalThis.window.localStorage;

const { renderToStaticMarkup } = await import('react-dom/server');
const React = await import('react');
const { readFileSync } = await import('node:fs');

const { default: App, SignupPromptModal, AuthPage, homePromoCards, FOOTER_PRODUCT_LINKS, FOOTER_SECTION_LINKS } = await import('__ROOT__/src/App.jsx');
const { default: DashboardHeader } = await import('__ROOT__/src/layout/dashboard/DashboardHeader.jsx');
const { default: DashboardLayout } = await import('__ROOT__/src/layout/dashboard/DashboardLayout.jsx');
const { default: AdminLogin } = await import('__ROOT__/src/layout/admin/AdminLogin.jsx');
const { AdminShell } = await import('__ROOT__/src/layout/admin/AdminLayout.jsx');
const { default: SecondaryRegistrationLayout } = await import('__ROOT__/src/layout/SecondaryRegistrationLayout.jsx');
const { default: OfflinePage } = await import('__ROOT__/src/layout/OfflinePage.jsx');
const { LAYER_IDS, readDashboardRoute } = await import('__ROOT__/src/layout/dashboard/dashboardRoute.jsx');
const { COURSE_LAYERS } = await import('__ROOT__/src/layout/dashboard/DashboardLayout.jsx');
const { CATALOG_COURSES, CatalogIcon } = await import('__ROOT__/src/layout/dashboard/CoursesSection.jsx');
const { IconMicroLesson } = await import('__ROOT__/src/layout/admin/adminIcons.jsx');
const theme = await import('__ROOT__/src/services/theme/themeService.js');
const pricing = await import('__ROOT__/src/services/pricing/pricingService.js');
const group = await import('__ROOT__/src/services/group/groupService.js');
const userStorage = await import('__ROOT__/src/services/userStorage.js');

const lines = [];
const checks = [];

const log = (text) => lines.push(text);

function check(label, condition, detail = '') {
  checks.push({ label, ok: Boolean(condition) });
  log((condition ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  — ' + detail : ''));
}

function render(Component, props, label) {
  const name = label || Component.name || 'کامپوننت';
  try {
    const markup = renderToStaticMarkup(React.createElement(Component, props));
    check('رندر ' + name + ' بدون خطا', true);
    return markup;
  } catch (error) {
    check('رندر ' + name + ' بدون خطا', false, String(error.message).slice(0, 150));
    return '';
  }
}

function flush() { console.log(lines.join('\n')); }

process.on('uncaughtException', (error) => {
  log('\n✗ خطای اجرا: ' + error.message);
  flush();
  process.exitCode = 1;
});

/* هر دکمهٔ تم یک span.theme-toggle__icon دارد */
const countToggles = (markup) => (markup.match(/class="theme-toggle__icon"/g) || []).length;

/* ═══ ۱. منطق خالص سرویس تم ═══ */
log('── ۱. منطق سرویس تم ──');

check('پیش‌فرض تیره است (بدون اتریبیوت)', theme.getTheme() === 'dark', theme.getTheme());
check('بدون انتخاب کاربر، چیزی ذخیره نشده', theme.getStoredTheme() === null);

theme.setTheme('light');
check('setTheme(light) اتریبیوت را می‌نشاند', attrs['data-theme'] === 'light', JSON.stringify(attrs));
check('getTheme تم روشن را می‌خواند', theme.getTheme() === 'light');
check('در localStorage ذخیره شد', store['tapesh:theme'] === 'light');

theme.setTheme('dark');
check('setTheme(dark) اتریبیوت را برمی‌دارد', !('data-theme' in attrs));
check('تم تیره هم ذخیره می‌شود', store['tapesh:theme'] === 'dark');

check('toggle از تیره به روشن', theme.toggleTheme() === 'light');
check('toggle از روشن به تیره', theme.toggleTheme() === 'dark');
check('مقدار نامعتبر به پیش‌فرض برمی‌گردد', theme.applyTheme('neon') === 'dark');

store['tapesh:theme'] = 'garbage';
check('مقدار آشغال در localStorage نادیده گرفته می‌شود', theme.getStoredTheme() === null);
delete store['tapesh:theme'];
theme.setTheme('dark');

/* ═══ ۲. دکمهٔ تم در همهٔ سطوح ═══ */
log('\n── ۲. دکمهٔ تم در همهٔ سطوح ──');

window.location.hash = '';
const home = render(App, {}, 'صفحهٔ اصلی');
check('صفحهٔ اصلی دکمهٔ تم دارد', countToggles(home) === 1, countToggles(home) + ' مورد');
check('برچسب دکمه در تم تیره «حالت روشن» است', /aria-label="تغییر به حالت روشن"/.test(home));
check('دکمهٔ تم داخل wrapper اکشن‌های هدر است',
  /class="site-header__actions"[\s\S]*?theme-toggle[\s\S]*?auth-link/.test(home));

window.location.hash = '#auth';
const auth = render(App, {}, 'صفحهٔ ورود');
check('صفحهٔ ورود دکمهٔ تم دارد', countToggles(auth) === 1, countToggles(auth) + ' مورد');
check('دکمهٔ تم صفحهٔ ورود کلاس خودش را دارد', /auth-panel__theme/.test(auth));
check('فرم ورود سالم است', /id="auth-phone"/.test(auth) && /id="auth-password"/.test(auth));
check('دکمهٔ سوئیچ به ثبت‌نام هست', /auth-form__switch/.test(auth));

window.location.hash = '#onboarding';
const onboarding = render(SecondaryRegistrationLayout, {}, 'کارت ثبت‌نام');
check('کارت ثبت‌نام دکمهٔ تم دارد', countToggles(onboarding) === 1, countToggles(onboarding) + ' مورد');
check('دکمهٔ تم کارت ثبت‌نام کلاس خودش را دارد', /onboarding-card__theme/.test(onboarding));

const header = render(DashboardHeader, {
  activeSection: 'tests',
  onSectionChange() {},
  isSettingsOpen: false,
  onSettingsToggle() {},
  areNotificationsOpen: false,
  onNotificationsToggle() {},
  notificationsUnreadCount: 3,
  headerTime: '۲۵:۰۰',
  isPomodoroActive: false,
  isPomodoroRunning: false,
  isPomodoroBreak: false,
  isPomodoroFinished: false,
  onPomodoroOpen() {},
}, 'هدر داشبورد');
check('هدر داشبورد دکمهٔ تم دارد', countToggles(header) === 1, countToggles(header) + ' مورد');
check('دکمهٔ تم هدر داشبورد کلاس خودش را دارد', /dashboard-header__theme/.test(header));
check('دکمهٔ تم داخل ردیف اکشن‌های هدر است',
  /dashboard-header__actions[\s\S]*theme-toggle/.test(header));

const adminLogin = render(AdminLogin, { onSuccess() {} }, 'ورود پنل مدیریت');
check('ورود پنل مدیریت دکمهٔ تم دارد', countToggles(adminLogin) === 1, countToggles(adminLogin) + ' مورد');
check('دکمهٔ تم ورود پنل کلاس خودش را دارد', /ad-login__theme/.test(adminLogin));

const offline = render(OfflinePage, {}, 'صفحهٔ آفلاین');
check('صفحهٔ آفلاین دکمهٔ تم دارد', countToggles(offline) === 1, countToggles(offline) + ' مورد');

/* ═══ ۳. پایداری هدر داشبورد ═══ */
log('\n── ۳. پایداری هدر داشبورد ──');

check('انیمیشن ورودی از هدر برداشته شده', !/dashboard-layer-reveal--down/.test(header),
  (header.match(/class="dashboard-header[^"]*"/) || [])[0] || '(هدر رندر نشد)');
check('هدر کلاس پایه را نگه داشته', /class="dashboard-header"/.test(header));
check('زمان/اعلان/تنظیمات دست‌نخورده‌اند',
  /dashboard-header__time/.test(header) &&
  /dashboard-header__icon-btn/.test(header) &&
  /dashboard-header__icon-badge/.test(header));

/*
 * نشانگر ناوبری در SSR رندر نمی‌شود چون مقدارش با useLayoutEffect و از روی
 * offsetLeft/offsetWidth ساخته می‌شود و افکت‌ها در رندر سرور اجرا نمی‌شوند.
 * پس آن را از منبع می‌سنجیم، نه از markup.
 */
const headerSource = readFileSync('__ROOT__/src/layout/dashboard/DashboardHeader.jsx', 'utf8');
check('نشانگر ناوبری در منبع هست (SSR اجرا نمی‌شود)', /dashboard-nav__indicator/.test(headerSource));
check('نشانگر بخش «تست» رنگ برنزی دارد', /tests:\s*'var\(--brown\)'/.test(headerSource),
  (headerSource.match(/tests:\s*'[^']*'/) || [])[0] || '');
check('پنج آیتم ناوبری رندر شد', (header.match(/class="dashboard-nav__link/g) || []).length === 5,
  String((header.match(/class="dashboard-nav__link/g) || []).length));
check('آیتم فعال aria-current دارد', /aria-current="page"/.test(header));

/* ═══ ۴. رگرسیون صفحهٔ اصلی ═══ */
log('\n── ۴. رگرسیون صفحهٔ اصلی ──');

const navLinks = (home.match(/<a class="site-nav__link /g) || []).length;
check('هدر سایت رندر می‌شود', /class="site-header"/.test(home));
check('برند تپش هست', /تپش/.test(home));
check('ناوبری اصلی چهار لینک دارد', navLinks === 4, String(navLinks));
check('لینک مقالاتِ هدر به مسیر مستقل اشاره می‌کند',
  /site-nav__link--articles" href="#articles"/.test(home));
check('لینک ورود/ثبت‌نام هست', /ورود \/ ثبت نام/.test(home));
/* محصولات دیگر یک بخشِ صفحهٔ اصلی نیست؛ لایهٔ مستقل #products است. پس صفحهٔ
   اصلی نباید هیچ اثری از آن داشته باشد و هدر باید به همان مسیر اشاره کند. */
check('صفحهٔ اصلی دیگر بخش محصولات ندارد',
  !/ps-section/.test(home) && !/id="products-title"/.test(home));
check('لینک محصولاتِ هدر به مسیر مستقل اشاره می‌کند', /href="#products"/.test(home));
check('بخش مقالات رندر می‌شود', /article-card/.test(home));
check('فوتر رندر می‌شود', /class="site-footer"/.test(home));

/*
 * چیدمان هدر سایت در رندر سرور سنجیده نمی‌شود: نه CSS اجرا می‌شود و نه عرضی
 * وجود دارد. پس قاعدهٔ «ناوبری وسطِ کل صفحه، نه وسطِ ردیف هدر» را از خودِ
 * منبع می‌سنجیم — همان کاری که برای نشانگر ناوبری داشبورد کردیم.
 */
/*
 * CSS ریشه به پوشهٔ src/styles/ شکسته شده و src/styles.css فقط @import دارد. این
 * کمکی همان ترتیبِ import را بازمی‌گرداند تا سنجه‌های منبع‌محور دست‌نخورده بمانند.
 */
const readStyles = () => {
  const entry = readFileSync('__ROOT__/src/styles.css', 'utf8');
  const parts = [...entry.matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1]);
  if (!parts.length) return entry;
  return parts.map((name) => readFileSync('__ROOT__/src/styles/' + name, 'utf8')).join('\n');
};

const siteCss = readStyles();
const desktopHeader = siteCss.split('@media (min-width: 641px)')[1] || '';
check('دو ستون کناری هدر هم‌عرض شده‌اند (ناوبری وسط کل صفحه)',
  /\.site-header > \.brand,\s*\.site-header__actions\s*\{\s*flex: 1 1 0;/.test(desktopHeader));
/*
 * گاردِ رگرسیون: کلاس brand کامپوننت مشترک هدر سایت و هدر داشبورد است. اگر این
 * قاعده یک روز دوباره مقید‌نشده نوشته شود، هدر داشبورد به‌هم می‌ریزد — همان
 * باگی که یک‌بار رخ داد. پس «مقید بودن به .site-header» خودش سنجه است.
 */
check('قاعدهٔ ستون‌های هدر به .site-header مقید است (هدر داشبورد دست‌نخورده)',
  !/\n\s*\.brand,\n\s*\.site-header__actions/.test(desktopHeader) &&
  /\.site-header > \.brand/.test(desktopHeader));
check('اکشن‌های هدر به لبهٔ چپ چسبیده‌اند',
  /\.site-header__actions\s*\{\s*justify-content: flex-end;/.test(desktopHeader));
check('ناوبری در دسکتاپ مارجین خودکار ندارد',
  /\.site-nav\s*\{\s*margin-inline: 0;/.test(desktopHeader));
check('لینک مقالات رنگ سبزِ خودِ لایهٔ مقالات را دارد',
  /\.site-nav__link--articles::after \{\s*background: var\(--green-bright\);/.test(siteCss));

/*
 * نوار پنج دورهٔ اصلی زیر دکمهٔ هیرو — همان کارت‌های کاتالوگ بخش «دوره‌ها»ی داشبورد.
 *
 * دو چیز این‌جا سنجیده می‌شود:
 *   ۱. هر پنج کارت واقعاً رندر می‌شوند (نه یک کارتِ نمونه).
 *   ۲. مقصد هر کارت یک **لایهٔ واقعی داشبورد** است. این نگاشت از COURSE_LAYERS
 *      (در DashboardLayout) می‌آید؛ اگر کارت ششمی به کاتالوگ اضافه شود و به نگاشت
 *      اضافه نشود، کلیکش بی‌صدا هیچ کاری نمی‌کند — همان تلهٔ تأییدشدهٔ «دکمه هیچ
 *      کاری نمی‌کند». پس نبودِ نگاشت خودش سنجه است.
 */
check('نوار پنج دورهٔ اصلی زیر هیرو رندر می‌شود', /class="hero__courses"/.test(home));

/*
 * صفحهٔ اصلی **دو** مصرف‌کننده از کارتِ کاتالوگ دارد: نوار پنجگانهٔ زیر هیرو و
 * کادرهای تبلیغی محصولات. پس شمردنِ کارت‌ها باید در بازهٔ خودش انجام شود؛ وگرنه
 * سنجهٔ «پنج کارتِ هیرو» با چهار کارتِ تازه ۹ می‌شود و بی‌صدا می‌افتد.
 * مرز دو بازه: همان ظرفی که شناسهٔ «courses» دارد و کادرهای تبلیغی داخلش نشسته‌اند.
 */
const promoMark = home.indexOf('<div id="courses"');
const beforePromos = promoMark > 0 ? home.slice(0, promoMark) : home;
const promoStrip = promoMark > 0 ? home.slice(promoMark) : '';
const countCatalogCards = (markup) => (markup.match(/aria-label="ورود به /g) || []).length;

check('هر پنج کارتِ دوره در نوار هیرو هست',
  countCatalogCards(beforePromos) === 5,
  String(countCatalogCards(beforePromos)));

const unmappedCourses = CATALOG_COURSES.filter(
  (course) => !Object.values(LAYER_IDS).includes(COURSE_LAYERS[course.id]),
);
check('هر پنج کارتِ کاتالوگ مقصدِ واقعیِ داشبورد دارند',
  CATALOG_COURSES.length === 5 && unmappedCourses.length === 0,
  unmappedCourses.length ? unmappedCourses.map((course) => course.id).join('، ') : String(CATALOG_COURSES.length));
check('عنوان و توضیح هر پنج کارت از خودِ داده می‌آید',
  CATALOG_COURSES.every((course) => home.includes(course.title) && home.includes(course.tagline)));

/*
 * ── سه چیزِ هیرو که هیچ سنجهٔ دیگری نمی‌گیرد ──
 *   ۱. CTA هیرو باید به فرمِ **ثبت‌نام** برود. قبلاً «#products» بود و روی صفحهٔ
 *      اصلی هیچ عنصری با آن شناسه وجود ندارد؛ یعنی دکمه به لنگرِ بی‌مقصد می‌رفت
 *      (تلهٔ ۱۰) و از نظر مرورگر هم هیچ‌چیز «خراب» نبود.
 *   ۲. توضیحِ کارتِ درسنامه جامع جملهٔ خواسته‌شده است (قبلاً «... و تست» داشت).
 *   ۳. آذرخشِ آیکونِ میکرو درسنامه یک چندضلعیِ **بسته** است، نه خطِ شکستهٔ باز؛
 *      نسخهٔ قبلی سه پارهٔ نامتقارن بود و کج دیده می‌شد. کارتِ کاتالوگ و پنل هر
 *      دو از یک رشتهٔ مسیر می‌آیند، پس هر دو جدا سنجیده می‌شوند.
 */
const heroMarkup = (home.match(/<section class="hero"[\s\S]*?<\/section>/) || [''])[0];
const MICRO_BOLT = 'M13.4 6.2 10.6 12.4h2.5l-.3 4.2 2.8-6.2h-2.5z';
check('CTA هیرو به فرم ثبت‌نام می‌رود', heroMarkup.includes('href="#auth/register"'));
check('CTA هیرو به لنگرِ بی‌مقصد #products نمی‌رود', !heroMarkup.includes('href="#products"'));
check('توضیح کارتِ درسنامه جامع همان جملهٔ خواسته‌شده است',
  CATALOG_COURSES.some(
    (course) => course.id === 'comprehensive' && course.tagline === 'پوشش کامل دروس پایه با درسنامه'));
check('آذرخشِ آیکونِ میکرو در کارتِ کاتالوگ چندضلعیِ بسته است',
  home.includes(MICRO_BOLT) && render(CatalogIcon, { name: 'micro' }, 'آیکون میکرو').includes(MICRO_BOLT));
check('آذرخشِ آیکونِ میکرو در پنل هم همان چندضلعیِ بسته است',
  render(IconMicroLesson, {}, 'آیکون میکرو پنل').includes(MICRO_BOLT));

/*
 * ── متنِ مقاله: هم **وسطِ صفحه** و هم پهن‌تر ──
 * چیدمان قبلی دوستونی بود و ستونِ کنار، متن را به راست می‌راند (ناهم‌محور با
 * سرتیترِ وسط‌چین). حالا شبکه سه ستونِ متقارن است و متن در ستونِ وسط می‌نشیند،
 * با پهنای ۸۶۰px — همان عرضِ سرتیترِ مقاله. سنجه روی خودِ CSS است، چون چیدمان
 * در رندر سرور دیده نمی‌شود (همان محدودیتِ اعلام‌شدهٔ بالای همین فایل).
 */
const articleCss = readFileSync('__ROOT__/src/layout/articles/articles.css', 'utf8');
const articleLayoutRule = (articleCss.match(/\.ap-article__layout \{[\s\S]*?\}/) || [''])[0];
const articleContentRule = (articleCss.match(/\.ap-article__content \{[\s\S]*?\}/) || [''])[0];
check('چیدمان مقاله سه ستونِ متقارن دارد (متن وسط می‌ماند)',
  /grid-template-columns: var\(--ap-rail\) minmax\(0, 1fr\) var\(--ap-rail\);/.test(articleLayoutRule));
check('متنِ مقاله در ستونِ وسط و هم‌عرضِ سرتیتر (۸۶۰px) است',
  /grid-column: 2;/.test(articleContentRule) &&
    /max-width: var\(--ap-read\);/.test(articleContentRule) &&
    /--ap-read: 860px;/.test(articleLayoutRule));

/*
 * کادرهای تبلیغی محصولات سرصفحه (بانک تست، تپش هوشمند، ویکی تپش، شبکهٔ دانش) —
 * چیدمانِ دو ردیفِ نامتقارن با قالبِ خودشان («.promo-grid» > «.promo-card»)، جدا از کارتِ
 * کاتالوگِ نوار هیرو.
 *
 * چرا سنجه لازم است: دکمهٔ این کادرها <button> است و مقصدش در HTML نمی‌نشیند؛
 * پس اگر روزی مقصد یکی از آن‌ها به یک لنگرِ تزیینی برگردد، از نظر مرورگر هیچ
 * چیزی خراب نیست و هیچ سنجهٔ دیگری نمی‌گیردش (تلهٔ ۱۰). این‌جا هم شمردنشان
 * سنجیده می‌شود، هم اینکه هر چهار مقصد یک لایهٔ واقعیِ داشبورد باشند.
 *
 * و یک لایهٔ ظریف‌تر: پنلِ رنگی و اکسنتِ متن‌خوان از توکن‌های CSS می‌آیند، پس
 * اگر روزی قاعدهٔ «.promo-card--<id>» جا بیفتد، کادر با پنلِ پیش‌فرض رندر می‌شود
 * و هیچ‌چیز هم نمی‌شکند — دقیقاً همان چیزی که هیچ سنجهٔ دیگری نمی‌گیرد.
 */
const promoCount = countCatalogCards(promoStrip);
check('چهار کادر تبلیغی محصولات سرصفحه رندر می‌شود', promoCount === 4, String(promoCount));

const promoCardMarks = (promoStrip.match(/class="promo-card promo-card--/g) || []).length;
check('کادرهای تبلیغی قالبِ خودشان را دارند (نه قالبِ کارتِ کاتالوگ)',
  promoCardMarks === 4 && !/bg-\[var\(--surface\)\]/.test(promoStrip),
  String(promoCardMarks) + ' کادرِ promo-card');

check('هر کادر یک بلوکِ متن و یک نشانهٔ گرافیکی دارد',
  (promoStrip.match(/promo-card__art/g) || []).length === 4 &&
  (promoStrip.match(/promo-card__body/g) || []).length === 4 &&
  (promoStrip.match(/promo-card__go/g) || []).length === 4);

check('عنوان، برچسبِ رده و توضیح هر کادر از خودِ داده می‌آید',
  homePromoCards.every((card) =>
    promoStrip.includes(card.title) &&
    promoStrip.includes(card.eyebrow) &&
    promoStrip.includes(card.description)));
check('اکسنت هر کادر تبلیغی روی خودِ کارت می‌نشیند',
  homePromoCards.every((card) => card.accent && promoStrip.includes(card.accent)));

/* هر محصول یک قاعدهٔ پنل/اکسنتِ متن‌خوان در CSS دارد و پنلش همان «--surface» کارت‌های اصلی است.
   ⚠️ الگو باید بلوکی را پیدا کند که خودش «--promo-panel» را تعریف می‌کند: همان انتخابگر
   در «@media (min-width: 641px)» هم برای عرض ستون تکرار شده و اولین تطبیق، بلوکِ
   بی‌ربطِ grid-column می‌شد ⇒ سنجه بی‌دلیل قرمز می‌ماند. */
const promoThemeRules = homePromoCards.map(
  (card) => (siteCss.match(new RegExp('\\.promo-card--' + card.id + ' \\{[^}]*--promo-panel[^}]*\\}')) || [''])[0],
);
check('هر کادر تبلیغی همان پس‌زمینهٔ کارت‌های اصلی و اکسنتِ متن‌خوانِ خودش را می‌گیرد',
  promoThemeRules.every((rule) => /--promo-panel: var\(--surface\)/.test(rule) && /--promo-ink: var\(--[a-z-]+-ink\)/.test(rule)),
  promoThemeRules.map((rule) => (rule.match(/--promo-panel: var\(([^)]+)\)/) || ['', '?'])[1]).join(' ، '));
const knowledgeThemeRule = promoThemeRules[homePromoCards.findIndex((card) => card.id === 'knowledge')] || '';
check('آیکون شبکهٔ دانش از سبزِ پروژه استفاده می‌کند', /--promo-ink: var\(--green-ink\)/.test(knowledgeThemeRule));
const promoGridBlocks = [...siteCss.matchAll(/\.promo-grid \{[^}]*\}/g)].map((m) => m[0]);
check('شبکهٔ کادرهای تبلیغی دوازده‌ستونه است و در موبایل یک ستون می‌شود',
  promoGridBlocks.some((block) => /grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/.test(block)) &&
  promoGridBlocks.some((block) => /grid-template-columns: minmax\(0, 1fr\);/.test(block)),
  String(promoGridBlocks.length) + ' قاعدهٔ .promo-grid');

const promoRoutes = homePromoCards.map((card) => readDashboardRoute(card.href));
check('هر کادر تبلیغی مقصدِ واقعیِ داشبورد دارد (نه لنگرِ تزیینی)',
  homePromoCards.length === 4 &&
    promoRoutes.every((route) => Object.values(LAYER_IDS).includes(route.layer)),
  homePromoCards.map((card) => card.href).join(' ، '));
check('هیچ دو کادر تبلیغی به یک لایه نمی‌روند',
  new Set(homePromoCards.map((card) => card.href)).size === homePromoCards.length);
check('ظرف کادرهای تبلیغی لنگرِ «#courses» را نگه داشته', promoMark > 0);

/*
 * نوار هیرو باید دقیقاً هم‌عرض «.section-shell» باشد. چیدمان در رندر سرور سنجیده
 * نمی‌شود، پس هر دو طرفِ معادله را از خودِ CSS می‌سنجیم:
 *   ۱. نوار «var(--content-width)» می‌گیرد و سقف قدیمیِ «1180px» برداشته شده.
 *   ۲. هیرو **پدینگ افقی ندارد** و فاصله‌اش را به‌صورت «--hero-gutter» به فرزندان
 *      می‌دهد. این همان دلیلی است که درصد برای هیرو و «.section-shell» یکی حساب
 *      می‌شود؛ اگر پدینگ افقی به هیرو برگردد، نوار بی‌صدا باریک‌تر می‌افتد.
 *   ۳. کارت‌ها نسخهٔ بزرگ‌تر (size="lg") می‌گیرند — همان تایپِ پله‌ای «2xl:».
 */
const heroCoursesBlock = (siteCss.match(/\.hero__courses \{[^}]*\}/) || [''])[0];
const heroBlock = siteCss.slice(siteCss.indexOf('\n.hero {'), siteCss.indexOf('.hero__content {'));
const mobileHeroBlock = (siteCss.match(/\.hero \{[^}]*--hero-gutter: 16px[^}]*\}/) || [''])[0];

check('نوار پنج دوره سقف عرض ندارد و همان عرض استاندارد بخش‌ها را دارد',
  /width: var\(--content-width\);/.test(heroCoursesBlock) && !/max-width/.test(heroCoursesBlock),
  heroCoursesBlock.replace(/\s+/g, ' ').slice(0, 80));
check('هیرو پدینگ افقی ندارد (مبنای درصد با .section-shell یکی است)',
  /--hero-gutter: 24px;/.test(heroBlock) && /padding: 70px 0 32px;/.test(heroBlock),
  heroBlock.replace(/\s+/g, ' ').slice(0, 80));
check('فاصلهٔ افقی هیرو به فرزندانش داده می‌شود',
  /\.hero__content \{[\s\S]*?padding-inline: var\(--hero-gutter\);/.test(siteCss));
check('در موبایل هم فاصلهٔ هیرو با بخش‌های دیگر یکی می‌ماند',
  /padding: 54px 0 24px;/.test(mobileHeroBlock) &&
  /@media \(max-width: 640px\)[\s\S]*?calc\(100% - 2 \* var\(--hero-gutter\)\)/.test(siteCss));
/*
 * همان بازهٔ «beforePromos» بالا استفاده می‌شود — نه کل صفحه: کادرهای تبلیغی
 * محصولات هم همان کارتِ کاتالوگ را با size="lg" رندر می‌کنند (یک تعریف، چند
 * مصرف)، پس شمردن در کل صفحه ۹ می‌دهد و سنجه را بی‌دلیل می‌شکند.
 */
check('کارت‌های نوار هیرو نسخهٔ بزرگ‌تر می‌گیرند',
  (beforePromos.match(/2xl:min-h-\[380px\]/g) || []).length === 5,
  String((beforePromos.match(/2xl:min-h-\[380px\]/g) || []).length) + ' کارتِ lg در نوار');
check('کادر «با رفقا درس بخون» به لایهٔ واقعیِ اشتراک گروهی می‌رود',
  /class="button button--orange" href="#group"/.test(home));

/* کاربر واردنشده: پاپ‌آپ بسته است تا خودش با کلیک باز شود */
check('پاپ‌آپ ثبت‌نام در بار اولِ صفحه بسته است', !/class="signup-modal"/.test(home));

/*
 * محتوای پاپ‌آپ — پشت state است و در رندر سرور باز نمی‌شود، پس مستقیم رندر می‌شود.
 * سنجهٔ اصلی: «راه و دکمهٔ ثبت‌نام» واقعاً داخلش هست.
 */
const signupModal = render(
  SignupPromptModal,
  { course: CATALOG_COURSES[0], onClose() {}, onConfirm() {} },
  'پاپ‌آپ ثبت‌نام',
);
check('پاپ‌آپ یک دیالوگ برچسب‌دار است',
  /role="dialog"/.test(signupModal) && /aria-modal="true"/.test(signupModal) &&
  /aria-labelledby="signup-modal-title"/.test(signupModal));
check('پاپ‌آپ نام همان دوره را نشان می‌دهد',
  signupModal.includes(CATALOG_COURSES[0].title));
check('سه مرحلهٔ ثبت‌نام در پاپ‌آپ هست',
  (signupModal.match(/class="signup-modal__step-index"/g) || []).length === 3);
check('دکمهٔ پاپ‌آپ به مسیر ورود/ثبت‌نام اشاره می‌کند',
  /class="button button--primary" href="#auth"/.test(signupModal));
check('پاپ‌آپ راه بستن هم دارد',
  /class="signup-modal__scrim"/.test(signupModal) && /signup-modal__later/.test(signupModal));

/* ═══ ۴.۱ فوتر، نوار چرخان و ورود مهمان ═══ */
log('\n── ۴.۱ فوتر و ورود مهمان ──');

/*
 * مقصدِ هر عنوانِ فوتر باید یک لایه/مسیر واقعی باشد، نه یک لنگرِ تزئینی (تلهٔ ۱۰).
 * از نظر مرورگر یک href معتبرِ بی‌ربط هیچ چیزی را نمی‌شکند، پس این تنها سنجه‌ای است
 * که «لینک شد» را از «به جای درست لینک شد» جدا می‌کند.
 */
const footerProductRoutes = FOOTER_PRODUCT_LINKS.map((link) => readDashboardRoute(link.href));
/* رندر سرور «&» را در href به «&amp;» تبدیل می‌کند؛ برای مقایسه باید برگردانده شود */
const unescapeAmp = (value) => value.replace(/&amp;/g, '&');
const hrefAttr = (href) => 'href="' + href.replace(/&/g, '&amp;') + '"';
check('هر عنوانِ «محصولات» فوتر یک لایهٔ واقعیِ داشبورد است',
  FOOTER_PRODUCT_LINKS.length === 5 &&
    footerProductRoutes.every((route) => Object.values(LAYER_IDS).includes(route.layer)),
  FOOTER_PRODUCT_LINKS.map((link) => link.title + ' → ' + link.href).join(' ، '));
check('هیچ دو لینکِ محصولات به یک مقصد نمی‌روند',
  new Set(FOOTER_PRODUCT_LINKS.map((link) => link.href)).size === FOOTER_PRODUCT_LINKS.length);
check('هر پنج عنوانِ محصولات در فوتر رندر شده‌اند',
  FOOTER_PRODUCT_LINKS.every((link) => home.includes(hrefAttr(link.href) + '>' + link.title + '</a>')));

const footerSectionLayerLinks = FOOTER_SECTION_LINKS.filter((link) => link.href.startsWith('#dashboard'));
check('عنوانِ «بخش‌ها» به «سایر بخش‌ها» تغییر کرده و چهار عنوانِ خواسته‌شده را دارد',
  /aria-label="سایر بخش‌ها"/.test(home) &&
    FOOTER_SECTION_LINKS.length === 4 &&
    ['ویکی تپش', 'شبکه دانش', 'مقالات', 'پشتیبانی'].every((title) =>
      FOOTER_SECTION_LINKS.some((link) => link.title === title)) &&
    FOOTER_SECTION_LINKS.every((link) => home.includes(hrefAttr(link.href) + '>' + link.title + '</a>')));
check('عنوان‌های «سایر بخش‌ها» به لایه/مسیر واقعی می‌روند (سه لایه + مقالات)',
  footerSectionLayerLinks.length === 3 &&
    FOOTER_SECTION_LINKS.some((link) => link.href === '#articles') &&
    footerSectionLayerLinks.every((link) => {
      const route = readDashboardRoute(link.href);
      return Object.values(LAYER_IDS).includes(route.layer) || Boolean(route.overlay);
    }));

/*
 * پاراگراف معرفی باید **ردیفِ اولِ** شبکهٔ فوتر باشد و هم‌راستا با لوگو/سرتیترها.
 * ترتیب در HTML سنجیده می‌شود و تراز از CSS — چون هیچ‌کدام در رندر سرور دیده نمی‌شوند.
 */
check('پاراگراف معرفی، اولین فرزند شبکهٔ فوتر است',
  /class="site-footer__inner section-shell"><div class="site-footer__about"/.test(home));
const footerAboutRule = (siteCss.match(/\.site-footer__about \{[^}]*grid-column[^}]*\}/) || [''])[0];
check('پاراگراف معرفی تمام‌عرض و راست‌چین است (هم‌راستا با لوگو و سرتیترها)',
  /grid-column: 1 \/ -1;/.test(footerAboutRule) &&
    /text-align: right;/.test(footerAboutRule) &&
    !/align-self: center;/.test(footerAboutRule),
  footerAboutRule.replace(/\s+/g, ' ').slice(0, 90));
const footerInnerRule = (siteCss.match(/\.site-footer__inner \{[^}]*\}/) || [''])[0];
check('شبکهٔ فوتر سه ستون دارد (ستونِ پاراگراف حذف شده)',
  /grid-template-columns: 1fr 0.9fr 0.85fr;/.test(footerInnerRule),
  footerInnerRule.replace(/\s+/g, ' ').slice(0, 90));

/*
 * نوار چرخانِ انتهای فوتر — چهار کادر که هر کدام به بخش خودش می‌رود. نوار پنج نسخهٔ
 * یکسان دارد تا بی‌درز بچرخد؛ فقط نسخهٔ اول باید در ترتیب تب باشد، وگرنه فوتر بیست
 * وقفهٔ تبی می‌سازد.
 */
const motionStripMarkup = (home.match(/<div class="motion-strip"[\s\S]*$/) || [''])[0];
const motionHrefs = [...motionStripMarkup.matchAll(/<a class="motion-pill[^"]*" href="([^"]+)"/g)]
  .map((m) => unescapeAmp(m[1]));
const uniqueMotionHrefs = [...new Set(motionHrefs)];
check('چهار کادرِ چرخانِ فوتر لینک شده‌اند (پنج نسخه × چهار کادر)',
  motionHrefs.length === 20 && uniqueMotionHrefs.length === 4,
  String(motionHrefs.length) + ' لینک، ' + String(uniqueMotionHrefs.length) + ' مقصد');
check('هر کادرِ چرخان مقصدِ واقعی دارد (سه لایه + صفحهٔ محصولات)',
  uniqueMotionHrefs.filter((href) => href === '#products').length === 1 &&
    uniqueMotionHrefs.filter((href) => href.startsWith('#dashboard')).length === 3 &&
    uniqueMotionHrefs
      .filter((href) => href.startsWith('#dashboard'))
      .every((href) => Object.values(LAYER_IDS).includes(readDashboardRoute(href).layer)),
  uniqueMotionHrefs.join(' ، '));
check('فقط نسخهٔ اولِ نوار در ترتیب تب است',
  (motionStripMarkup.match(/tabindex="-1"/g) || []).length === 16,
  String((motionStripMarkup.match(/tabindex="-1"/g) || []).length) + ' وقفهٔ تبیِ حذف‌شده');

/*
 * ورود مهمان: کارت‌های هیرو گاردِ ثبت‌نام ندارند، پس داشبورد باید بدون حساب هم
 * رندر شود. ErrorBoundary وجود ندارد؛ یک خطای رندر کل درخت را خالی می‌کند — پس
 * «رندر شد و لایهٔ خواسته‌شده باز شد» تنها سنجهٔ معتبر است.
 */
window.location.hash = '#dashboard?l=course-comprehensive';
const guestDashboard = render(DashboardLayout, { userData: null }, 'داشبورد مهمان (بدون حساب)');
check('داشبورد بدون حساب هم رندر می‌شود (حالت مهمان)',
  /class="dashboard"/.test(guestDashboard) && /class="dashboard-header"/.test(guestDashboard));
check('لایهٔ دوره برای کاربر واردنشده باز می‌شود',
  /class="dars-layer"/.test(guestDashboard));
window.location.hash = '';

/* ═══ ۵. لایهٔ تعرفه‌ها (مسیر مستقل #pricing) ═══ */
log('\n── ۵. لایهٔ تعرفه‌ها ──');

/* منطق خالص سرویس: تخفیف دوره، تخفیف پله‌ای گروه و سقف نفرات */
const monthlyQuote = pricing.quote({ planId: 'pro', cycleId: 'monthly', seats: 1 });
const yearlyQuote = pricing.quote({ planId: 'pro', cycleId: 'yearly', seats: 1 });
const groupQuote2 = pricing.quote({ planId: 'group', cycleId: 'monthly', seats: 2 });
const groupQuote3 = pricing.quote({ planId: 'group', cycleId: 'monthly', seats: 3 });
const clampedQuote = pricing.quote({ planId: 'group', cycleId: 'monthly', seats: 99 });

check('دورهٔ ماهانه بدون تخفیف است',
  monthlyQuote.discountPercent === 0 && monthlyQuote.perMonth === monthlyQuote.listPerMonth,
  pricing.formatNumberFa(monthlyQuote.perMonth));
check('دورهٔ سالانه ۲۰٪ تخفیف می‌دهد',
  yearlyQuote.discountPercent === 20 &&
    yearlyQuote.perMonth === Math.round(monthlyQuote.listPerMonth * 0.8),
  pricing.formatNumberFa(yearlyQuote.perMonth));
check('مبلغ کل = مبلغ ماهانه × تعداد ماه',
  yearlyQuote.total === yearlyQuote.perMonth * 12,
  pricing.formatNumberFa(yearlyQuote.total));
check('صرفه‌جویی = مبلغ بدون تخفیف − مبلغ نهایی',
  yearlyQuote.savedTotal === monthlyQuote.listPerMonth * 12 - yearlyQuote.total,
  pricing.formatNumberFa(yearlyQuote.savedTotal));
check('تخفیف گروهی پله‌ای است (۲ نفر ۱۵٪، ۳ نفر ۳۰٪)',
  groupQuote2.discountPercent === 15 && groupQuote3.discountPercent === 30);
check('تعداد نفرات به بازهٔ پلن محدود می‌شود', clampedQuote.seats === 3, String(clampedQuote.seats));
check('مبلغ گروهی در تعداد نفرات ضرب می‌شود', groupQuote3.total === groupQuote3.perMonth * 3);
check('عدد فارسی جداکنندهٔ هزارگان دارد',
  pricing.formatNumberFa(249000).indexOf('٬') > 0, pricing.formatNumberFa(249000));
check('پلن ناشناس، نقل‌قول null می‌دهد', pricing.quote({ planId: 'nope', cycleId: 'monthly' }) === null);

window.location.hash = '#pricing';
const pricingPage = render(App, {}, 'صفحهٔ تعرفه‌ها');

check('صفحهٔ تعرفه رندر می‌شود', /class="pr-page"/.test(pricingPage));
check('سه پلن رندر می‌شود',
  (pricingPage.match(/class="pr-card /g) || []).length === 3,
  String((pricingPage.match(/class="pr-card /g) || []).length));
check('پلن پیشنهادی عمق و لایهٔ دوم دارد', /pr-card--purple is-recommended/.test(pricingPage));
check('پلن پیش‌فرض انتخاب‌شده است', /pr-card--purple is-recommended is-selected/.test(pricingPage));
check('معرفی محصولات پیش از تعرفه‌ها رندر می‌شود',
  /class="pr-products /.test(pricingPage) && /pr-product__mark/.test(pricingPage));
check('چهار محصول معرفی می‌شود',
  (pricingPage.match(/class="pr-product /g) || []).length === 4,
  String((pricingPage.match(/class="pr-product /g) || []).length));
check('هر محصول نشانهٔ گرافیکی متحرک دارد',
  (pricingPage.match(/pathLength="1"/g) || []).length >= 8,
  String((pricingPage.match(/pathLength="1"/g) || []).length));
check('ترتیب درست است: اول محصول، بعد تعرفه',
  pricingPage.indexOf('pr-products__list') < pricingPage.indexOf('pr-plans__bar'));
check('مدار توانایی از لایه حذف شده', !/pr-orbit/.test(pricingPage));
/* دقت الگو: کلاس‌های option-label و option-hint پیشوند مشترک دارند، پس کاراکتر
   بعدی باید فاصله باشد وگرنه تعداد اشتباه شمرده می‌شود. */
check('کنترلر دوره سه گزینه دارد',
  (pricingPage.match(/class="pr-billing__option[ "]/g) || []).length === 3,
  String((pricingPage.match(/class="pr-billing__option[ "]/g) || []).length));
check('گزینهٔ فعال دوره با aria-checked مشخص است', /role="radio" aria-checked="true"/.test(pricingPage));
check('بلوک شفافیت مالی رندر می‌شود', /pr-finance__rows/.test(pricingPage));
check('ماتریس مقایسه در دو ترکیب‌بندی رندر می‌شود',
  /pr-matrix__table/.test(pricingPage) && /pr-matrix__mobile/.test(pricingPage));
check('جدول مقایسه سرفصل هر سه پلن را دارد',
  (pricingPage.match(/scope="col"/g) || []).length === 4,
  String((pricingPage.match(/scope="col"/g) || []).length));
check('دکمهٔ انتخاب پلن وضعیت فشرده دارد', /class="pr-card__select"[^>]*aria-pressed="true"/.test(pricingPage));
check('یادداشت شفافیت مبالغ تا تأیید نشدن اعداد هست', /pr-footnote/.test(pricingPage));
check('لینک تعرفهٔ هدر به مسیر مستقل اشاره می‌کند', /href="#pricing"/.test(home));
check('صفحهٔ اصلی دیگر بخش تعرفه ندارد',
  !/class="pr-page"/.test(home) && !/id="pricing"/.test(home));

/* ═══ ۶. لایهٔ محصولات (مسیر مستقل #products) ═══ */
log('\n── ۶. لایهٔ محصولات ──');

window.location.hash = '#products';
const productsPage = render(App, {}, 'صفحهٔ محصولات');

check('صفحهٔ محصولات رندر می‌شود', /class="ps-page"/.test(productsPage));
check('بدنهٔ محصولات در صفحهٔ مستقل هست', /class="ps-section/.test(productsPage));
check('تیتر صفحه یک h1 برچسب‌دار است',
  /<h1 class="ps-intro__title" id="products-title"/.test(productsPage));
check('هیروی محصولات هدرِ دوخطیِ تازه دارد',
  /ps-intro__title-top/.test(productsPage) && /ps-intro__title-accent/.test(productsPage));
check('هاله و کادرهای آماری قدیمی از هیرو حذف شده‌اند',
  !/ps-hero__glow/.test(productsPage) && !/ps-hero__facts/.test(productsPage));

/* CSS همین لایه — سنجه‌های ظاهری که از HTML تنها درنمی‌آید */
const productsCss = readFileSync('__ROOT__/src/layout/products/products.css', 'utf8');
check('دو تکهٔ تیترِ محصولات هم‌سطح و سبز شده‌اند',
  /\.ps-intro__title-top,\s*\.ps-intro__title-accent \{[^}]*color: var\(--green-ink\)[^}]*font-size: 1em/.test(
    productsCss,
  ));
check('تیترِ سرآغازِ محصولات بزرگ‌تر شده است',
  /\.ps-intro__title \{[^}]*font-size: clamp\(2\.6rem, 5\.2vw, 4\.8rem\)/.test(productsCss));

/* سیاهِ خالص در پس‌زمینه‌ها — توکنِ عمیق، پردهٔ سطح، و پلِ Tailwind */
check('هیچ پس‌زمینهٔ سیاهِ خالصی در توکن‌ها نمانده است',
  /--deep: #121212;/.test(siteCss) &&
    !/--deep: #000000;/.test(siteCss) &&
    /--scrim-rgb: 18 18 18;/.test(siteCss) &&
    /:root \{[^}]*--color-black: var\(--deep\)/.test(siteCss));
check('سیاهِ سایه/پردهٔ مودال عمداً تیره مانده است',
  /--shadow-rgb: 0 0 0;/.test(siteCss));

const productsCount = (productsPage.match(/class="ps-eyebrow"/g) || []).length;
check('نه محصول معرفی می‌شود', productsCount === 9, String(productsCount));
check('هر محصول مقصدِ واقعیِ داشبورد دارد',
  (productsPage.match(/href="#dashboard\?/g) || []).length >= 8,
  String((productsPage.match(/href="#dashboard\?/g) || []).length));
check('برگه‌های پشت‌سرهمِ درسنامه رندر می‌شوند',
  /ps-sheets/.test(productsPage) && (productsPage.match(/class="ps-sheet /g) || []).length === 5,
  String((productsPage.match(/class="ps-sheet /g) || []).length));
check('کادرهای بانک تست در یک ردیفِ قابل چرخش هستند',
  /ps-panels/.test(productsPage) && (productsPage.match(/class="ps-panels__tab /g) || []).length === 4,
  String((productsPage.match(/class="ps-panels__tab /g) || []).length));

/* ترتیبِ خواسته‌شده: آزمون‌ساز → مقالات (کارتِ مستقل) → ویکی */
const examTitleAt = productsPage.indexOf('class="ps-card__title">آزمون');
const articlesTitleAt = productsPage.indexOf('class="ps-card__title">مقالات');
const wikiTitleAt = productsPage.indexOf('class="ps-card__title">ویکی');
check('مقالات کارتِ مستقلِ خودش را دارد و بین آزمون‌ساز و ویکی نشسته',
  examTitleAt > 0 && articlesTitleAt > examTitleAt && wikiTitleAt > articlesTitleAt,
  examTitleAt + ' < ' + articlesTitleAt + ' < ' + wikiTitleAt);
check('مقالات دیگر داخل کارتِ ویکی نیست',
  productsPage.indexOf('ps-articles') > 0 &&
    productsPage.indexOf('ps-articles') < productsPage.indexOf('ps-card--wiki'));
check('کارتِ ویکی آینهٔ هدرِ لایه است، نه کادرِ جست‌وجوی قدیمی',
  /ps-wiki-header/.test(productsPage) && !/ps-wiki__input/.test(productsPage));
check('عنوانِ کارتِ ویکی دیگر اکسنتِ مسی نمی‌گیرد',
  /\.ps-card--wiki \.ps-card__title/.test(productsCss) &&
    !/\.ps-card--wiki \.ps-card__title \{[^}]*copper-soft-ink/.test(productsCss));

check('تصویر شبکهٔ دانش و دفترچهٔ مرور رندر می‌شوند',
  /ps-network-image/.test(productsPage) && /ps-review/.test(productsPage));
check('قابِ شبکهٔ دانش بدون پس‌زمینه و بدون دایرهٔ تزئینی است',
  !/ps-network-image__orbit/.test(productsPage) &&
    !/ps-network-image__veil/.test(productsPage) &&
    /\.ps-network-image \{[^}]*direction: ltr/.test(productsCss) &&
    !/\.ps-network-image \{[^}]*background/.test(productsCss));
check('برچسب‌های اکوسیستم در RTL کنارِ گوی‌ها می‌نشینند',
  /\.ps-eco__label \{[^}]*direction: rtl/.test(productsCss) &&
    /class="ps-eco__label"[^>]*text-anchor="end"/.test(productsPage) &&
    /class="ps-eco__label"[^>]*text-anchor="start"/.test(productsPage));

check('کادر پایانیِ جداگانه حذف شده و اکوسیستمِ متحرک مانده است',
  !/ps-final__panel/.test(productsPage) && /ps-eco__orbit-ring/.test(productsPage));
check('هدر و فوتر سایت روی صفحهٔ محصولات هستند',
  /class="site-header"/.test(productsPage) && /class="site-footer"/.test(productsPage));

/* ═══ ۷. لایهٔ «دربارهٔ تپش» (مسیر مستقل #about) ═══ */
log('\n── ۷. لایهٔ دربارهٔ تپش ──');

window.location.hash = '#about';
const aboutPage = render(App, {}, 'صفحهٔ دربارهٔ تپش');

check('صفحهٔ درباره رندر می‌شود', /class="ab-page"/.test(aboutPage));
check('جملهٔ آغازین روی یک h1 است', /<h1 class="ab-hero__line" id="ab-hero-line"/.test(aboutPage));
check('جملهٔ دومِ آغازین هم در DOM هست (بدون اسکرول)', /ab-hero__second/.test(aboutPage));
check('چهار جملهٔ بخش مسئله رندر می‌شود',
  (aboutPage.match(/class="ab-problem__line /g) || []).length === 4,
  String((aboutPage.match(/class="ab-problem__line /g) || []).length));
check('المان دلیل ساختن تپش در صفحه هست',
  /class="ab-why-flow /.test(aboutPage) && /فهمِ قابل استفاده/.test(aboutPage),
  String(/class="ab-why-flow /.test(aboutPage)));
check('سه ورودی به فهم متصل‌اند',
  (aboutPage.match(/class="ab-why-flow__source-card"/g) || []).length === 3,
  String((aboutPage.match(/class="ab-why-flow__source-card"/g) || []).length));
check('چهار مرحلهٔ نگاه ما رندر می‌شود',
  (aboutPage.match(/class="ab-philosophy__word /g) || []).length === 4,
  String((aboutPage.match(/class="ab-philosophy__word /g) || []).length));
check('ده گره در سیستم محصولات هست',
  (aboutPage.match(/class="ab-system__node /g) || []).length === 10,
  String((aboutPage.match(/class="ab-system__node /g) || []).length));
check('هفت مرحلهٔ چرخهٔ یادگیری هست',
  (aboutPage.match(/class="ab-cycle__phase /g) || []).length === 7,
  String((aboutPage.match(/class="ab-cycle__phase /g) || []).length));
check('چرخه نشانگرِ متحرک دارد', /class="ab-cycle__pointer"/.test(aboutPage) && /class="ab-cycle__marker"/.test(aboutPage));
check('هشت مرحلهٔ تاریخچه هست',
  (aboutPage.match(/class="ab-timeline__step /g) || []).length === 8,
  String((aboutPage.match(/class="ab-timeline__step /g) || []).length));
check('شش اصل رندر می‌شود',
  (aboutPage.match(/class="ab-principle ab-principle--/g) || []).length === 6,
  String((aboutPage.match(/class="ab-principle ab-principle--/g) || []).length));
check('پنج سناریوی یادگیرنده هست',
  (aboutPage.match(/class="ab-learners__item /g) || []).length === 5,
  String((aboutPage.match(/class="ab-learners__item /g) || []).length));
/* سنجه فقط روی بلوکِ تاریخچه اجرا می‌شود: مختصاتِ SVG در بخش‌های دیگر پر از
   عدد است و ربطی به «تاریخِ ساختگی» ندارد. اندیس‌ها هم فارسی‌اند (toFa). */
const timelineBlock = aboutPage.slice(
  aboutPage.indexOf('ab-timeline'),
  aboutPage.indexOf('ab-principles'),
);
/* تاریخچه نباید سال یا تاریخ داشته باشد؛ اندیس‌ها با تابعِ فارسی‌ساز تک‌رقمی‌اند،
   پس هر عددِ چهاررقمی در این بلوک یعنی تاریخِ ساختگی. */
const tlYears = timelineBlock.match(/\d{4}|[۰-۹]{4}/g) || [];
check('هیچ سالِ ساختگی در تاریخچه نیست', tlYears.length === 0, JSON.stringify(tlYears.slice(0, 4)));
check('یادداشتِ شفافِ تاریخچه تا تأیید نشدن هست',
  (aboutPage.match(/class="ab-footnote"/g) || []).length === 1,
  String((aboutPage.match(/class="ab-footnote"/g) || []).length));
check('شش اصل با سیگنال‌های متفاوت رندر می‌شوند',
  (aboutPage.match(/class="ab-principle ab-principle--/g) || []).length === 6 &&
    (aboutPage.match(/class="ab-principle__signal"/g) || []).length === 6,
  String((aboutPage.match(/class="ab-principle__signal"/g) || []).length));
check('بخش آیندهٔ حذف‌شده در صفحه نیست', !/این پایان تپش نیست|class="ab-future/.test(aboutPage));
check('کادر صدای یادگیرنده سالم است',
  /class="ab-learners__voice"/.test(aboutPage) && /class="ab-learners__voice-head"/.test(aboutPage));
check('فراخوان پایانیِ صفحه هست', /ab-closing__cta/.test(aboutPage));
check('لینک دربارهٔ هدر به مسیر مستقل اشاره می‌کند', /href="#about"/.test(home));
check('هدر و فوتر سایت روی صفحهٔ درباره هستند',
  /class="site-header"/.test(aboutPage) && /class="site-footer"/.test(aboutPage));

window.location.hash = '';

/* ═══ ۸. نوار کناری پنل مدیریت ═══ */
log('\n── ۸. نوار کناری پنل مدیریت ──');

const adminShell = render(AdminShell, {
  admin: { name: 'مدیر تپش', username: '0135', roleLabel: 'مدیر کل', permissions: [], lastLoginAt: Date.now() },
  onExit() {},
  onLogout() {},
}, 'پوستهٔ پنل مدیریت');

/* پیش‌فرض باید دقیقاً همان حالت قبل باشد: باز، با عنوان‌ها. */
check('نوار کناری به‌صورت پیش‌فرض جمع نیست', /class="ad-sidebar\s*"/.test(adminShell),
  (adminShell.match(/class="ad-sidebar[^"]*"/) || [])[0] || '(رندر نشد)');
check('نوار کناری شناسهٔ aria-controls را دارد', /id="ad-sidebar"/.test(adminShell));
check('کلید جمع کردن منو هست', /class="ad-nav__item ad-sidebar__collapse"/.test(adminShell));
check('کلید در حالت باز aria-expanded=true دارد', /ad-sidebar__collapse"[\s\S]{0,220}aria-expanded="true"/.test(adminShell));
check('برچسب کلید در حالت باز «جمع کردن منو» است', /جمع کردن منو/.test(adminShell));
check('حساب من و بازگشت به سایت دست‌نخورده‌اند',
  /حساب من/.test(adminShell) && /بازگشت به سایت/.test(adminShell));

/*
 * چیدمان نوار کناری در رندر سرور سنجیده نمی‌شود (نه CSS اجرا می‌شود و نه عرضی
 * هست)، پس قواعدش را از خودِ فایل CSS لایهٔ پنل می‌سنجیم.
 */
const adminCss = readFileSync('__ROOT__/src/layout/admin/admin.css', 'utf8');
const desktopSidebar = adminCss.split('@media (min-width: 861px)')[1]?.split('@media (max-width: 860px)')[0] || '';
const mobileSidebar = adminCss.split('@media (max-width: 860px)')[1] || '';

check('حالت جمع با کلاس is-collapsed تعریف شده (نه هاور)',
  /\.ad-sidebar\.is-collapsed\s*\{[\s\S]{0,160}width: var\(--ad-sidebar-w-min\)/.test(desktopSidebar) &&
  !/\.ad-sidebar:hover\s*\{/.test(adminCss));
check('ریل جمع، برچسب‌ها و فاصله‌ها را صفر می‌کند',
  /\.ad-sidebar\.is-collapsed \.ad-nav__item > span/.test(desktopSidebar) &&
  /\.ad-sidebar\.is-collapsed \.ad-nav__item,\s*\.ad-sidebar\.is-collapsed \.ad-sidebar__brand\s*\{\s*gap: 0;/.test(desktopSidebar));
/* گارد رگرسیون: بدون این، flex آیکون ۱۸px را در ریل به عرض باقی‌ماندهٔ خط می‌کوبید */
check('آیکون آیتم‌های نوار کناری فشرده نمی‌شود',
  /\.ad-nav__item > svg \{\s*flex-shrink: 0;/.test(adminCss));
check('لوگو در ریل جمع نمی‌شود', /\.ad-sidebar__logo \{[\s\S]{0,120}flex-shrink: 0;/.test(adminCss));
check('کلید جمع کردن در موبایل پنهان است',
  /\.ad-sidebar__collapse \{\s*display: none;/.test(mobileSidebar));
check('نوار کناری انیمیشن عرض دارد', /transition: width 0\.22s ease, flex-basis 0\.22s ease;/.test(adminCss));

/* ═══ ۹. صفحهٔ ورود / ثبت‌نام (#auth) و ورود با گوگل ═══ */
log('\n── ۹. صفحهٔ ورود / ثبت‌نام و ورود با گوگل ──');

const authPage = render(
  AuthPage,
  { onBack() {}, onLoginSuccess() {}, onRegisterSuccess() {} },
  'صفحهٔ ورود/ثبت‌نام',
);

check('دکمهٔ گوگل رندر می‌شود', /class="auth-form__google/.test(authPage));
check('برچسب دکمه هم «ورود» و هم «ثبت نام» را می‌گوید',
  /ورود \/ ثبت نام با گوگل/.test(authPage));
check('آیکون گوگل کنار دکمه هست', /class="google-icon"/.test(authPage));

/*
 * رندر سرور هندلرها را حذف می‌کند، پس «دکمه واقعاً وصل است» از خودِ منبع سنجیده
 * می‌شود — همان تلهٔ تأییدشدهٔ «دکمه هیچ کاری نمی‌کند». و چون گوگل خودش حساب را
 * تشخیص می‌دهد، دکمه باید در هر دو حالت باشد، نه فقط ثبت‌نام.
 */
/*
 * پوستهٔ سایت و صفحهٔ ورود از src/App.jsx جدا شده‌اند؛ سنجه‌های منبع‌محورِ گوگل
 * دنبال همان کد می‌گردند، پس هر دو فایل یک‌جا خوانده می‌شوند.
 */
const appSource = readFileSync('__ROOT__/src/App.jsx', 'utf8')
  + '\n' + readFileSync('__ROOT__/src/layout/auth/AuthPage.jsx', 'utf8');
/*
 * بازهٔ سنجش: ردیفِ ورودهای اجتماعی بالای فرم تا شروع فیلدها. دکمهٔ گوگل در
 * بازطراحی از نوار دکمه‌های پایین به همین ردیف منتقل شد (قرارداد چهارچوب مرجع:
 * ورودهای اجتماعی بالا، فرم پایین)، پس تکیه بر «auth-form__actions» دیگر
 * جواب نمی‌دهد. قصد سنجه عوض نشده است.
 */
const authSocialRow = appSource.split('auth-form__social')[1]?.split('auth-form__fields')[0] || '';

check('دکمهٔ گوگل هندلر دارد (دکمهٔ مرده نیست)', /onClick=\{handleGoogleAuth\}/.test(appSource));
check('هندلر به سرویس وصل است، نه یک تابع تعریف‌نشده', /startGoogleAuth\(\)/.test(appSource));
check('دکمهٔ گوگل در هر دو حالت ورود و ثبت‌نام می‌آید',
  /auth-form__google/.test(authSocialRow) && !/isRegistering &&/.test(authSocialRow));
check('بازگشت از گوگل نشانهٔ آدرس را پاک می‌کند تا رفرش جریان را تکرار نکند',
  /clearGoogleReturn\(\)/.test(appSource));

/*
 * زیر StrictMode هر افکت در توسعه دو بار اجرا می‌شود. اگر افکت گوگل با فلگ
 * «active» نوشته شود، اجرای دوم چون پارامتر آدرس را اجرای اول پاک کرده،
 * «دست‌دادن» را از دست می‌دهد و کاربر بی‌خطا روی #auth می‌ماند.
 */
const authSource = readFileSync('__ROOT__/src/layout/auth/AuthPage.jsx', 'utf8');
check('افکت گوگل یک‌بارمصرف است، نه فلگ active (تلهٔ StrictMode)',
  /googleBootRef\.current/.test(authSource) && !/let active = true;/.test(authSource));
check('حساب گوگلیِ ناقص به آنبوردینگ می‌رود و حساب کامل مستقیم وارد می‌شود',
  /user\.profile\?\.username/.test(appSource));
check('برای حالت «پیکربندی نشده» پیام صریح هست، نه سکوت',
  /GOOGLE_RETURN_MESSAGES/.test(appSource) && /GOOGLE_CLIENT_ID/.test(appSource));

const authCss = readStyles();
check('حالت «گوگل پیکربندی نشده» استایل دارد', /\.auth-form__google\.is-unavailable \{/.test(authCss));
check('متن راهنمای گوگل استایل دارد', /\.auth-form__google-note \{/.test(authCss));

/* بدون سرور، وضعیت باید صریحاً «پیکربندی‌نشده» باشد — هیچ ورود ساختگی‌ای */
const googleStatus = await userStorage.getGoogleAuthStatus();
check('بی‌سرور، وضعیت گوگل صریحاً پیکربندی‌نشده است، نه true',
  googleStatus.configured === false && googleStatus.reachable === false);
check('در نبود پارامتر، نشانهٔ بازگشت از گوگل null است', userStorage.readGoogleReturn() === null);

/* ═══ ۱۰. پس‌زمینهٔ صفحهٔ داشبورد — هم‌رنگ صفحهٔ اصلی ═══ */
log('\n── ۱۰. پس‌زمینهٔ صفحهٔ داشبورد ──');

/*
 * «همان کد رنگ صفحهٔ اصلی» یعنی هر دو سطح از یک توکن بخوانند. پس سنجه، خودِ
 * توکن است نه یک hex: اگر روزی کسی رنگ را دستی عوض کند، این‌جا سرخ می‌شود.
 * رندر سرور CSS اجرا نمی‌کند، پس از خودِ فایل‌های CSS می‌خوانیم — مثل بخش ۳.
 */
const dashCss = readFileSync('__ROOT__/src/layout/dashboard/dashboard.css', 'utf8');
const gpCss = readFileSync('__ROOT__/src/layout/dashboard/greenPath/greenPath.css', 'utf8');
const baseCss = readStyles();

check('پوستهٔ داشبورد پس‌زمینه را از --background می‌گیرد، نه --deep',
  /\.dashboard \{\s*min-height: 100vh;\s*background: var\(--background\);/.test(dashCss));
check('هدر داشبورد همان رنگ بدنه است (بدون درز)',
  /\.dashboard-header \{[\s\S]{0,220}background: var\(--background\);/.test(dashCss));
check('لایهٔ مسیر سبز هم --background می‌گیرد', /--gp-bg: var\(--background\);/.test(gpCss));

const bodyBlock = baseCss.split('\nbody {')[1]?.split('}')[0] || '';
check('بدنهٔ سایت و پوستهٔ داشبورد از یک توکن می‌خوانند',
  /background:[\s\S]*var\(--background\);/.test(bodyBlock));

/* bg-black یک hex ثابت است (Tailwind در تم تیره #000 می‌دهد) و تم‌پذیر نیست. */
const pageSections = ['CoursesSection.jsx', 'TestsSection.jsx', 'notes/NotesSection.jsx'];
let bareBlack = '';
let tokenBg = 0;
for (const file of pageSections) {
  const src = readFileSync('__ROOT__/src/layout/dashboard/' + file, 'utf8');
  if (/bg-black(?=[" ])/.test(src)) bareBlack += file + ' ';
  tokenBg += (src.match(/bg-\[var\(--background\)\]/g) || []).length;
}
check('هیچ بخش داشبورد پس‌زمینهٔ مشکیِ ثابت نمی‌کشد', bareBlack === '', bareBlack || '(پاک)');
check('پس‌زمینهٔ هر سه بخش از توکن تم‌پذیر می‌آید', tokenBg >= 4, String(tokenBg));

/* ═══ ۱۱. پیش‌بارگذاری فونت (ضد پرش فونت) ═══ */
log('\n── ۱۱. پیش‌بارگذاری فونت ──');

/*
 * چرا سنجه لازم است: بدون preload، مرورگر فونت را فقط هنگام رندر متن درخواست
 * می‌کند (یعنی بعد از کل جاوااسکریپت) و کاربر ~۱ ثانیه متن را با فونت پشتیبان
 * می‌بیند. اگر کسی این چهار خط را از index.html بردارد، هیچ چیز دیگری قرمز
 * نمی‌شود و پرش بی‌صدا برمی‌گردد. پس خودش سنجه است.
 */
const { existsSync } = await import('node:fs');

const htmlSource = readFileSync('__ROOT__/index.html', 'utf8');
const preloadTags = [...htmlSource.matchAll(/<link[^>]*rel="preload"[^>]*>/g)].map((m) => m[0]);
const preloadHrefs = preloadTags
  .map((tag) => (tag.match(/href="([^"]+)"/) || [])[1])
  .filter(Boolean);

check('چهار فونتِ صفحهٔ اول پیش‌بارگذاری شده‌اند', preloadHrefs.length === 4, String(preloadHrefs.length));
check('همهٔ پیش‌بارگذاری‌ها از نوع فونت‌اند', preloadTags.every((tag) => /as="font"/.test(tag)));
/* بدون crossorigin مرورگر همان فایل را دو بار می‌گیرد (فونت با CORS می‌آید) */
check('هر پیش‌بارگذاری crossorigin دارد', preloadTags.every((tag) => /crossorigin/.test(tag)));

const missingFonts = preloadHrefs.filter((href) => !existsSync('__ROOT__/' + href));
check('هر مسیر پیش‌بارگذاری روی دیسک هست (preload بی‌۴۰۴)', missingFonts.length === 0,
  missingFonts.join(', ') || '(همه موجود)');

/* هر مسیر preload باید دقیقاً یکی از srcهای @font-face باشد، وگرنه فایل اشتباه
   یا مرده‌ای دانلود می‌شود. */
const faceUrls = [...readStyles()
  .matchAll(/url\('\.\.\/\.\.\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
const undeclared = preloadHrefs
  .map((href) => href.replace('./fonts/', ''))
  .filter((file) => !faceUrls.includes(file));
check('هر پیش‌بارگذاری یک @font-face واقعی دارد', undeclared.length === 0,
  undeclared.join(', ') || '(همه اعلام‌شده)');

const wantedFonts = ['Pinar-VF', 'Doran-Regular', 'Doran-Medium', 'Doran-Bold'];
const covered = wantedFonts.filter((name) => preloadHrefs.some((href) => href.includes(name)));
check('هر چهار فونت مصرفیِ صفحهٔ اول در لیست هستند', covered.length === wantedFonts.length,
  covered.join(', '));

/* ═══ ۱۲. لایهٔ اشتراک گروهی (مسیر مستقل #group) ═══ */
log('\n── ۱۲. لایهٔ اشتراک گروهی ──');

/* ── ۱۲.۱ کد اشتراک ── */
check('کد نرمال می‌شود: حرف بزرگ، بدون فاصله، با پیشوند TP-',
  group.normalizeCode(' tp-abc ۲۳۴ ') === 'TP-ABC234', group.normalizeCode(' tp-abc ۲۳۴ '));
check('ارقام فارسی به لاتین برمی‌گردند',
  group.normalizeCode('TP-AB۲۳۴۵') === 'TP-AB2345', group.normalizeCode('TP-AB۲۳۴۵'));
check('ارقام عربی هم پذیرفته می‌شوند',
  group.normalizeCode('TP-AB٣٤٥٦') === 'TP-AB3456', group.normalizeCode('TP-AB٣٤٥٦'));
check('کد خالی به رشتهٔ خالی نرمال می‌شود', group.normalizeCode('') === '');
check('کد بدون پیشوند اصلاح می‌شود', group.validateCode('abc234').code === 'TP-ABC234');
check('کد کوتاه رد می‌شود', group.validateCode('TP-ABC23').ok === false);
check('کد ناشناس با قالب درست پیدا نمی‌شود', group.findGroupByCode('TP-ZZZZZZ') === null);

window.location.hash = '#group?join=TP-ABC234';
check('کد از لینک دعوت خوانده می‌شود', group.readInviteCode() === 'TP-ABC234',
  group.readInviteCode());
window.location.hash = '#group';
check('بدون query، کد لینک دعوت خالی است', group.readInviteCode() === '');

check('نام پیشنهادی از پروفایل می‌آید و هرگز شمارهٔ موبایل نیست',
  group.defaultDisplayName({ profile: { firstName: 'زهرا', lastName: 'محمدی', phone: '09121234567' } }) === 'زهرا محمدی' &&
  group.defaultDisplayName({ profile: { phone: '09121234567' } }) === '');

/* ── ۱۲.۲ ظرفیت و پله‌های تخفیف ── */
const groupPlan = pricing.getPlanById('group');
const capacityRange = group.getCapacityRange();
check('ظرفیت گروه از خودِ پلن تعرفه می‌آید، نه از لایه',
  capacityRange.min === groupPlan.seats.min && capacityRange.max === groupPlan.seats.max,
  group.formatNumberFa(capacityRange.min) + '–' + group.formatNumberFa(capacityRange.max));
check('ظرفیت بیرون بازه به کف و سقف برمی‌گردد',
  group.clampSeats(99) === capacityRange.max && group.clampSeats(0) === capacityRange.min);
check('ظرفیت نامعتبر به مقدار پیش‌فرض پلن برمی‌گردد',
  group.clampSeats('آشغال') === groupPlan.seats.defaultSeats);

const groupTiers = group.getSeatTiers('monthly');
check('برای هر ظرفیت مجاز یک پله ساخته می‌شود',
  groupTiers.length === capacityRange.options.length, String(groupTiers.length));
check('درصد هر پله از quote() تعرفه‌ها می‌آید، نه از خودِ لایه',
  groupTiers.every((tier) => tier.discountPercent ===
    pricing.quote({ planId: 'group', cycleId: 'monthly', seats: tier.seats }).discountPercent));
const bestTiers = groupTiers.filter((tier) => tier.isBest);
check('دقیقاً یک پله «پیشنهاد تپش» است', bestTiers.length === 1, String(bestTiers.length));
check('پلهٔ پیشنهادی بیشترین تخفیف را دارد',
  bestTiers.length === 1 &&
    bestTiers[0].discountPercent === groupTiers.reduce((max, tier) => Math.max(max, tier.discountPercent), 0));
check('جای خالی میزبان از خودِ سرویس می‌آید',
  groupTiers.every((tier) => tier.openSeats === tier.seats - 1));
check('هر پله مبلغ هر نفر و مجموع را با خودش می‌آورد',
  groupTiers.every((tier) => tier.perMonth > 0 && tier.total === tier.perSeatTotal * tier.seats));
check('تخفیف پلهٔ بزرگ‌تر کمتر نیست',
  groupTiers.every((tier, index) => index === 0 || tier.discountPercent >= groupTiers[index - 1].discountPercent));

/* ── ۱۲.۳ چرخهٔ ساخت، پیوستن، چرخش کد و خروج ── */
const created = group.createGroup({ viewerId: 'test-owner', displayName: 'میزبان', cycleId: 'monthly', seats: 3 });
check('گروه ساخته می‌شود و کد می‌گیرد',
  created.ok === true && /^TP-[A-Z2-9]{6}$/.test(created.group.code), created.group?.code);
check('کد ساخته‌شده حرف و رقم گیج‌کننده ندارد (I، O، صفر، یک)',
  !/[IO01]/.test(created.group.code), created.group.code);
check('سازنده میزبان و تنها عضو است',
  created.group.members.length === 1 && created.group.ownerId === 'test-owner');

/*
 * گروه یک‌نفره: پلن گروهی حداقل ۲ نفره است، پس «quote» آن را روی حداقل قیمت
 * می‌زند. سرویس باید تعدادِ **قیمت‌خورده** را جدا اعلام کند، وگرنه UI می‌نویسد
 * «مبلغ گروه برای ۱ نفر» در حالی که مبلغ دو نفر است — عدد درست، متن گمراه‌کننده.
 */
const solo = group.summarizeGroup(created.group, 'test-owner');
check('گروه یک‌نفره روی حداقل پلن قیمت می‌خورد، نه روی یک نفر',
  solo.filled === 1 && solo.billedSeats === groupPlan.seats.min && solo.isBelowMinimum === true,
  'filled=' + solo.filled + ' billed=' + solo.billedSeats);
check('مبلغ گروه یک‌نفره با مبلغ همان حداقل یکی است',
  solo.total === pricing.quote({ planId: 'group', cycleId: 'monthly', seats: groupPlan.seats.min }).total,
  pricing.formatToman(solo.total));
check('ساخت گروه دوم روی همان دستگاه رد می‌شود',
  group.createGroup({ viewerId: 'test-owner', seats: 2 }).error?.code === 'ALREADY_IN_GROUP');

const joined = group.joinGroup({ viewerId: 'test-friend', displayName: 'رفیق', code: created.group.code });
check('پیوستن با کد کار می‌کند',
  joined.ok === true && joined.group.members.length === 2, String(joined.group?.members.length));
const rejoined = group.joinGroup({ viewerId: 'test-friend', code: created.group.code });
check('پیوستن دوباره خطا نیست، «از قبل عضو» است',
  rejoined.ok === true && rejoined.already === true && rejoined.group.members.length === 2);

const partial = group.summarizeGroup(joined.group, 'test-owner');
check('مبلغ گروه روی نفرات واقعی حساب می‌شود، نه ظرفیت',
  partial.perMonth === pricing.quote({ planId: 'group', cycleId: 'monthly', seats: 2 }).perMonth,
  pricing.formatToman(partial.perMonth));
check('مبلغ گروهِ کامل جدا نگه داشته می‌شود (وعدهٔ اشتباه ساخته نشود)',
  partial.fullTotal === pricing.quote({ planId: 'group', cycleId: 'monthly', seats: 3 }).total &&
    partial.fullTotal > partial.total);
check('ظرفیت خالی، پُری و نقش میزبان از خودِ سرویس می‌آید',
  partial.openSeats === 1 && partial.isFull === false && partial.isOwner === true);
check('نشانهٔ «تو» و «میزبان» هرکدام دقیقاً روی یک نفر می‌نشیند',
  partial.members.filter((member) => member.isViewer).length === 1 &&
    partial.members.filter((member) => member.isOwner).length === 1);

const filledGroup = group.joinGroup({ viewerId: 'test-third', displayName: 'رفیق سوم', code: created.group.code });
const fullSummary = group.summarizeGroup(filledGroup.group, 'test-owner');
check('پر شدن ظرفیت وضعیت را عوض می‌کند', fullSummary.isFull === true);
check('گروه پُر روی همهٔ نفرات قیمت می‌خورد و حداقل‌گیر نمی‌شود',
  fullSummary.billedSeats === 3 && fullSummary.isBelowMinimum === false,
  'billed=' + fullSummary.billedSeats);
check('پیوستن به گروه پُر رد می‌شود',
  group.joinGroup({ viewerId: 'test-fourth', code: created.group.code }).error?.code === 'GROUP_FULL');
check('کد با قالب درست ولی ناشناس، «پیدا نشد» می‌دهد',
  group.joinGroup({ viewerId: 'test-stranger', code: 'TP-ZZZZZZ' }).error?.code === 'CODE_NOT_FOUND');
check('کد بی‌قالب، «قالب نامعتبر» می‌دهد',
  group.joinGroup({ viewerId: 'test-stranger', code: '!!' }).error?.code === 'CODE_FORMAT');
check('کسی که خودش گروه دارد به گروه دیگری نمی‌پیوندد',
  group.createGroup({ viewerId: 'test-stranger', displayName: 'غریبه', seats: 2 }).ok === true &&
    group.joinGroup({ viewerId: 'test-stranger', code: created.group.code }).error?.code === 'ALREADY_IN_GROUP');

const oldCode = created.group.code;
check('چرخش کد فقط دست میزبان است',
  group.rotateCode({ viewerId: 'test-friend', groupId: created.group.id }).error?.code === 'NOT_OWNER');
const rotated = group.rotateCode({ viewerId: 'test-owner', groupId: created.group.id });
check('میزبان کد تازه می‌گیرد', rotated.ok === true && rotated.code !== oldCode, rotated.code);
check('کد قبلی «منقضی» می‌شود، نه «نامعتبر»',
  group.joinGroup({ viewerId: 'test-stranger-2', code: oldCode }).error?.code === 'CODE_RETIRED');

check('حذف عضو فقط دست میزبان است',
  group.removeMember({ viewerId: 'test-friend', groupId: created.group.id, memberId: 'test-third' }).error?.code === 'NOT_OWNER');
check('میزبان نمی‌تواند خودش را حذف کند',
  group.removeMember({ viewerId: 'test-owner', groupId: created.group.id, memberId: 'test-owner' }).error?.code === 'NOT_OWNER');
const afterRemove = group.removeMember({ viewerId: 'test-owner', groupId: created.group.id, memberId: 'test-third' });
check('حذف عضو تعداد را کم می‌کند', afterRemove.ok === true && afterRemove.group.members.length === 2);

const memberLeft = group.leaveGroup({ viewerId: 'test-friend', groupId: created.group.id });
check('عضو عادی با خروج گروه را منحل نمی‌کند',
  memberLeft.ok === true && memberLeft.disbanded === false &&
    group.getGroupById(created.group.id).members.length === 1);
const ownerLeft = group.leaveGroup({ viewerId: 'test-owner', groupId: created.group.id });
check('خروج میزبان گروه را منحل می‌کند',
  ownerLeft.ok === true && ownerLeft.disbanded === true && group.getGroupById(created.group.id) === null);
check('گروه منحل‌شده در «گروه من» نمی‌آید', group.getMyGroup('test-owner') === null);

group.__setFailure(true);
check('حالت خرابی، ساخت گروه را بی‌صدا موفق نمی‌کند',
  group.createGroup({ viewerId: 'test-owner', seats: 2 }).ok === false);
group.__setFailure(false);

const invite = group.buildInviteLink('TP-ABC234');
check('لینک دعوت کد را در query می‌آورد', invite.endsWith('#group?join=TP-ABC234'), invite);
check('تاریخ پیوستن شمسی برمی‌گردد', group.formatJoinDate(new Date().toISOString()).length > 0);
check('تاریخ نامعتبر رشتهٔ خالی می‌دهد', group.formatJoinDate('آشغال') === '');

/* ── ۱۲.۴ رندر مسیر #group ── */
window.location.hash = '#group';
const groupPage = render(App, {}, 'صفحهٔ اشتراک گروهی');

check('صفحهٔ اشتراک گروهی رندر می‌شود', /class="grp-page"/.test(groupPage));
check('تیتر صفحه یک h1 برچسب‌دار است', /<h1 class="grp-title" id="grp-title"/.test(groupPage));
check('سه واقعیتِ سرآغاز از خودِ داده می‌آید', /class="grp-hero__facts"/.test(groupPage));
check('پله‌های تخفیف رندر می‌شود', /class="grp-tiers section-shell" id="grp-plan"/.test(groupPage));
check('برای هر ظرفیت مجاز یک کارت رادیویی هست',
  (groupPage.match(/class="grp-tier /g) || []).length === capacityRange.options.length,
  String((groupPage.match(/class="grp-tier /g) || []).length));
check('ظرفیت انتخاب‌شده روی همان کارت علامت‌خورده است',
  (groupPage.match(/class="grp-tier is-active[^"]*"[^>]*role="radio" aria-checked="true"/g) || []).length === 1);
check('گروه ظرفیت یک radiogroup برچسب‌دار است',
  /class="grp-tiers__grid" role="radiogroup" aria-label="ظرفیت گروه"/.test(groupPage));
check('یک پله با نشان «پیشنهاد تپش» مشخص است',
  (groupPage.match(/class="grp-tier__badge"/g) || []).length === 1);
check('دو تب مسیر اشتراک هست', (groupPage.match(/role="tab"/g) || []).length === 2,
  String((groupPage.match(/role="tab"/g) || []).length));
check('تب پیش‌فرض «ساخت گروه و گرفتن کد» است',
  /id="grp-tab-create"[^>]*aria-selected="true"/.test(groupPage));
check('هر دو پنل در DOM هستند (پنهان‌شده با hidden)',
  (groupPage.match(/class="grp-panel"/g) || []).length === 2,
  String((groupPage.match(/class="grp-panel"/g) || []).length));
check('ورودی کد اشتراک چپ‌به‌راست است (کد لاتین وارونه نشود)',
  /class="grp-field__input grp-field__input--code"[^>]*dir="ltr"/.test(groupPage));
check('چهار قدم اشتراک گروهی رندر می‌شود',
  (groupPage.match(/class="grp-step"/g) || []).length === 4,
  String((groupPage.match(/class="grp-step"/g) || []).length));
check('پرسش‌های پرتکرار با details بومی رندر می‌شوند',
  (groupPage.match(/class="grp-faq__item"/g) || []).length === 4,
  String((groupPage.match(/class="grp-faq__item"/g) || []).length));
check('فراخوان پایانی و وضعیت پرداخت هست',
  /grp-final__panel/.test(groupPage) && /grp-final__status-chip/.test(groupPage));
check('یادداشت شفافیت مبالغ تا تأیید نشدن اعداد هست', /class="grp-footnote"/.test(groupPage));
check('صفحهٔ اشتراک گروهی به تعرفه‌ها راه دارد', /href="#pricing"/.test(groupPage));
check('کاربر واردنشده راه ورود/ثبت‌نام دارد', /href="#auth"/.test(groupPage));
check('هدر و فوتر سایت روی این لایه هستند',
  /class="site-header"/.test(groupPage) && /class="site-footer"/.test(groupPage));

window.location.hash = '#group?join=TP-ABC234';
const groupInvite = render(App, {}, 'صفحهٔ اشتراک گروهی با لینک دعوت');
check('لینک دعوت تب «پیوستن» را باز می‌کند',
  /id="grp-tab-join"[^>]*aria-selected="true"/.test(groupInvite));
check('کد از لینک دعوت در فرم نشسته است', /value="TP-ABC234"/.test(groupInvite));
check('فرم می‌گوید کد از لینک دعوت آمده است', /از لینک دعوت پر شده است/.test(groupInvite));
window.location.hash = '';

/* ═══ نتیجه ═══ */
const failed = checks.filter((c) => !c.ok);
log('\n' + checks.length + ' سنجه — ' + (checks.length - failed.length) + ' قبول، ' + failed.length + ' رد');
if (failed.length) {
  log('\nرد‌شده‌ها:');
  for (const f of failed) log('  ✗ ' + f.label);
}

flush();
/* exitCode نه exit() — تا پاک‌سازی پوشهٔ موقت در بیرون از این فایل اجرا شود */
process.exitCode = failed.length ? 1 : 0;
`;

const entryFile = path.join(CACHE, 'entry.mjs');
const outFile = path.join(CACHE, 'out.mjs');
/* مسیر مطلق تزریق می‌شود چون هارنس در node_modules/.cache می‌نشیند، نه کنار src */
writeFileSync(entryFile, HARNESS.replaceAll('__ROOT__', ROOT));

await build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  jsx: 'automatic',
  absWorkingDir: ROOT,
  logLevel: 'warning',
  plugins: [
    {
      /*
       * ماژول آواتار در سطح خودش `import.meta.glob` (ویژهٔ Vite) را صدا می‌زند
       * که esbuild نمی‌شناسدش. بقیهٔ سرویس‌ها دست‌نخورده‌اند.
       */
      name: 'stub-vite-glob',
      setup(api) {
        api.onLoad({ filter: /setting\/avatar\/avatarOptions\.js$/ }, () => ({
          contents: `
            export const AVATAR_IDS = ['a1', 'a2'];
            export const AVATAR_IMAGES = [{ id: 'a1', src: '' }, { id: 'a2', src: '' }];
            export const DEFAULT_AVATAR = 'a1';
            export function isValidAvatar(id) { return AVATAR_IDS.includes(id); }
            export function avatarSrc(value) { return value ? '/avatar/' + value + '.webp' : null; }
            export function fallbackAvatarSrc() { return '/avatar/a1.webp'; }
          `,
          loader: 'js',
        }));
      },
    },
    {
      /*
       * موتور سه‌بعدی آناتومی — تنها دو ماژولی که `three` را import می‌کنند.
       *
       * چرا استاب: بستهٔ نصب‌شدهٔ `node_modules/three` در این محیط package.json
       * ندارد، پس esbuild اصلاً نمی‌تواند حلش کند و کل هارنس با
       * «Could not resolve three» می‌افتد (خروجی هیچ سنجه‌ای نمی‌دهد). این هارنس
       * هیچ‌وقت صحنهٔ سه‌بعدی را رندر نمی‌کند (لایه‌اش `lazy` است و در
       * `renderToStaticMarkup` اصلاً بالا نمی‌آید)، پس استاب بی‌اثر است.
       *
       * ⚠️ هزینه‌اش: تا وقتی این استاب هست، خطای import داخل خودِ این دو فایل
       * سنجیده نمی‌شود. اگر روزی `three` درست نصب شد، این بلوک را بردار.
       */
      name: 'stub-three-engine',
      setup(api) {
        api.onLoad(
          { filter: /anatomy3d[\\/]engine[\\/](AnatomyEngine|anatomyMaterials)\.js$/ },
          () => ({
            contents: `
              export class AnatomyEngine {
                constructor() {}
                mount() {}
                dispose() {}
                reset() {}
              }
              export function buildCategoryMaterials() {
                return { default: {}, hover: {}, selected: {} };
              }
            `,
            loader: 'js',
          }),
        );
      },
    },
  ],
  /* React هرگز باندل نشود — وگرنه خروجی ~۱٫۲MB می‌شود و پروسه با SIGTERM می‌میرد */
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
  loader: {
    '.css': 'empty',
    '.png': 'empty',
    '.webp': 'empty',
    '.svg': 'empty',
    '.jpeg': 'empty',
    '.jpg': 'empty',
    '.woff2': 'empty',
  },
});

try {
  await import(pathToFileURL(outFile).href);
} finally {
  /* خروجی موقت پاک شود تا در مخزن نماند */
  rmSync(CACHE, { recursive: true, force: true });
}
