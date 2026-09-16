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

const { default: App } = await import('__ROOT__/src/App.jsx');
const { default: DashboardHeader } = await import('__ROOT__/src/layout/dashboard/DashboardHeader.jsx');
const { default: AdminLogin } = await import('__ROOT__/src/layout/admin/AdminLogin.jsx');
const { default: SecondaryRegistrationLayout } = await import('__ROOT__/src/layout/SecondaryRegistrationLayout.jsx');
const { default: OfflinePage } = await import('__ROOT__/src/layout/OfflinePage.jsx');
const theme = await import('__ROOT__/src/services/theme/themeService.js');
const pricing = await import('__ROOT__/src/services/pricing/pricingService.js');

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
check('ناوبری اصلی سه لینک دارد', navLinks === 3, String(navLinks));
check('لینک ورود/ثبت‌نام هست', /ورود \/ ثبت نام/.test(home));
/* محصولات دیگر یک بخشِ صفحهٔ اصلی نیست؛ لایهٔ مستقل #products است. پس صفحهٔ
   اصلی نباید هیچ اثری از آن داشته باشد و هدر باید به همان مسیر اشاره کند. */
check('صفحهٔ اصلی دیگر بخش محصولات ندارد',
  !/ps-section/.test(home) && !/id="products-title"/.test(home));
check('لینک محصولاتِ هدر به مسیر مستقل اشاره می‌کند', /href="#products"/.test(home));
check('بخش مقالات رندر می‌شود', /article-card/.test(home));
check('فوتر رندر می‌شود', /class="site-footer"/.test(home));

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
const productsCount = (productsPage.match(/class="ps-eyebrow"/g) || []).length;
check('هشت محصول معرفی می‌شود', productsCount === 8, String(productsCount));
check('سه واقعیتِ سرآغاز از خودِ داده می‌آید', /ps-hero__facts/.test(productsPage));
check('هر محصول مقصدِ واقعیِ داشبورد دارد',
  (productsPage.match(/href="#dashboard\?/g) || []).length >= 8,
  String((productsPage.match(/href="#dashboard\?/g) || []).length));
check('نمای چسبانِ بانک تست رندر می‌شود', /ps-sticky__visual-inner/.test(productsPage));
check('فراخوان پایانیِ صفحه رندر می‌شود', /ps-final__panel/.test(productsPage));
check('صفحهٔ محصولات به تعرفه‌ها راه دارد', /href="#pricing"/.test(productsPage));
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
check('شبکهٔ دانش یازده مفهوم دارد',
  (aboutPage.match(/class="ab-net__node /g) || []).length === 11,
  String((aboutPage.match(/class="ab-net__node /g) || []).length));
check('چهار مرحلهٔ نگاه ما رندر می‌شود',
  (aboutPage.match(/class="ab-philosophy__word /g) || []).length === 4,
  String((aboutPage.match(/class="ab-philosophy__word /g) || []).length));
check('ده گره در سیستم محصولات هست',
  (aboutPage.match(/class="ab-system__node /g) || []).length === 10,
  String((aboutPage.match(/class="ab-system__node /g) || []).length));
check('هفت مرحلهٔ چرخهٔ یادگیری هست',
  (aboutPage.match(/class="ab-cycle__phase /g) || []).length === 7,
  String((aboutPage.match(/class="ab-cycle__phase /g) || []).length));
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
  (aboutPage.match(/class="ab-footnote"/g) || []).length === 2,
  String((aboutPage.match(/class="ab-footnote"/g) || []).length));
check('فراخوان پایانیِ صفحه هست', /ab-closing__cta/.test(aboutPage));
check('لینک دربارهٔ هدر به مسیر مستقل اشاره می‌کند', /href="#about"/.test(home));
check('هدر و فوتر سایت روی صفحهٔ درباره هستند',
  /class="site-header"/.test(aboutPage) && /class="site-footer"/.test(aboutPage));

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
       * تنها استاب: ماژول آواتار در سطح خودش `import.meta.glob` (ویژهٔ Vite)
       * را صدا می‌زند که esbuild نمی‌شناسدش. بقیهٔ سرویس‌ها دست‌نخورده‌اند.
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
