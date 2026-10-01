/*
 * تست رگرسیون روتر — `src/router/appRoute.js` و `src/router/routeHashes.js`.
 *
 * چرا وجود دارد: ممیزی این دو فایل را صریحاً «حساس» خوانده و شرط گذاشته که بدون
 * آزمون regression تغییر نکنند (MASTER-AUDIT-2026-09-29.md:648-650, :1864) — ولی
 * هیچ تستی برایشان نبود. این فایل همان آزمون است و **هیچ فایل `src/` را عوض
 * نمی‌کند**.
 *
 * چرا باندل: `routeHashes.js` → `DashboardLayout.jsx` زنجیرهٔ سنگین (لایه‌های
 * lazy، three، CSS) را می‌کشد. پس `DashboardLayout` در باندل **استاب** می‌شود،
 * ولی استاب دستی نوشته نشده: بلوک `COURSE_LAYERS` **از خود سورس استخراج** و با
 * `LAYER_IDS` واقعی `dashboardRoute.jsx` ساخته می‌شود. یعنی اگر نگاشت واقعی عوض
 * شود، همین آزمون با نگاشت تازه اجرا می‌شود — نه یک کپی کهنه.
 *
 * اجرا: `npm run router:test`  (یا `node scripts/router-test.mjs`)
 * خروجی: خروجی عددی + کد خروج (۱ = شکست). فایل موقت در `node_modules/.cache/`.
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, 'node_modules/.cache/router-test');
const BUNDLE = resolve(CACHE, 'router-bundle.mjs');

const APP_ROUTE = resolve(ROOT, 'src/router/appRoute.js');
const ROUTE_HASHES = resolve(ROOT, 'src/router/routeHashes.js');
const DASHBOARD_LAYOUT = resolve(ROOT, 'src/layout/dashboard/DashboardLayout.jsx');
const DASHBOARD_ROUTE = resolve(ROOT, 'src/layout/dashboard/dashboardRoute.jsx');

/* ─────────────────────────── ۱. استخراج COURSE_LAYERS ─────────────────────────── */

const layoutSource = readFileSync(DASHBOARD_LAYOUT, 'utf8');
const courseLayersBlock = /export const COURSE_LAYERS = \{([\s\S]*?)\n\};/.exec(layoutSource);

if (!courseLayersBlock) {
  console.error('❌ بلوک COURSE_LAYERS در DashboardLayout.jsx پیدا نشد — استاب ساخته نمی‌شود.');
  process.exit(1);
}

const courseLayersBody = courseLayersBlock[1];

/*
 * استاب = همان بدنهٔ واقعی + import واقعی `LAYER_IDS`. پس مقدارها ساختگی نیستند.
 * `resolveDir` روی پوشهٔ خودِ DashboardLayout است تا ایمپورت‌های نسبی حل شوند.
 */
const stubContents = [
  `import { LAYER_IDS } from ${JSON.stringify(DASHBOARD_ROUTE)};`,
  'export const COURSE_LAYERS = {',
  courseLayersBody,
  '};',
  '',
].join('\n');

/* ─────────────────────────── ۲. ساخت باندل ─────────────────────────── */

mkdirSync(CACHE, { recursive: true });

await build({
  stdin: {
    contents: [
      `export * from ${JSON.stringify(APP_ROUTE)};`,
      `export * from ${JSON.stringify(ROUTE_HASHES)};`,
      `export { LAYER_IDS, dashboardRouteHash, EMPTY_DASHBOARD_ROUTE, DASHBOARD_SECTIONS } from ${JSON.stringify(DASHBOARD_ROUTE)};`,
      `export { COURSE_LAYERS } from ${JSON.stringify(DASHBOARD_LAYOUT)};`,
    ].join('\n'),
    resolveDir: ROOT,
    loader: 'js',
  },
  outfile: BUNDLE,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  jsx: 'automatic',
  logLevel: 'silent',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  loader: {
    '.css': 'empty', '.png': 'empty', '.webp': 'empty', '.jpg': 'empty', '.jpeg': 'empty',
    '.svg': 'empty', '.glb': 'empty', '.woff': 'empty', '.woff2': 'empty', '.vtt': 'text',
  },
  plugins: [
    {
      name: 'stub-dashboard-layout',
      setup(api) {
        /*
         * `(?:\.jsx)?$` لازم است: خودِ entry با مسیر مطلق `.../DashboardLayout.jsx`
         * ایمپورت می‌کند، ولی `routeHashes.js` بدون پسوند. با فیلتر ساده فقط
         * دومی گرفته می‌شد و زنجیرهٔ سنگین از راه entry وارد می‌شد.
         */
        api.onResolve({ filter: /DashboardLayout(?:\.jsx)?$/ }, () => ({
          path: 'dashboard-layout-stub',
          namespace: 'layout-stub',
        }));
        api.onLoad({ filter: /.*/, namespace: 'layout-stub' }, () => ({
          contents: stubContents,
          loader: 'js',
          resolveDir: dirname(DASHBOARD_LAYOUT),
        }));
      },
    },
  ],
});

/* ─────────────────────────── ۳. شیم مرورگر ─────────────────────────── */

const location = { hash: '', pathname: '/', search: '' };
const history = {
  state: null,
  replaceState(state) { history.state = state; },
  pushState(state) { history.state = state; },
};

globalThis.window = {
  location,
  history,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  scrollTo() {},
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
};
globalThis.document = {
  documentElement: { getAttribute: () => null, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } },
  body: { classList: { add() {}, remove() {}, toggle() {} } },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
};

const router = await import(pathToFileURL(BUNDLE).href);

/* ─────────────────────────── ۴. هارنس ─────────────────────────── */

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  if (Object.is(actual, expected)) {
    passed += 1;
    console.log('✅ ' + label);
    return true;
  }
  failures.push(label + ' → انتظار ' + JSON.stringify(expected) + ' ولی ' + JSON.stringify(actual));
  console.log('❌ ' + label + ' → انتظار ' + JSON.stringify(expected) + ' ولی ' + JSON.stringify(actual));
  return false;
}

function checkTrue(label, value, detail) {
  if (value) {
    passed += 1;
    console.log('✅ ' + label);
    return true;
  }
  failures.push(label + (detail ? ' → ' + detail : ''));
  console.log('❌ ' + label + (detail ? ' → ' + detail : ''));
  return false;
}

/* موقعیت را مستقیم می‌نویسیم؛ توابع در زمان صدا‌زدن می‌خوانند، نه در زمان import */
function setLocation({ hash = '', pathname = '/', search = '' } = {}) {
  location.hash = hash;
  location.pathname = pathname;
  location.search = search;
  history.state = null;
}

function setState(state) {
  history.state = state;
}

function routeOf(hash, state = null) {
  setLocation({ hash });
  setState(state);
  return router.getAppRoute();
}

/* ── ۱. جدول هش → مسیر ── */

const HASH_ROUTES = [
  ['#dashboard', 'dashboard'],
  ['#dashboard?s=tests', 'dashboard'],
  ['#dashboard?s=tests&l=test-bank', 'dashboard'],
  ['#dashboard/', 'dashboard'],
  ['#onboarding', 'onboarding'],
  ['#auth', 'auth'],
  ['#auth/register', 'auth'],
  ['#auth/login', 'auth'],
  ['#group', 'group'],
  ['#articles', 'articles'],
  ['#articles/stress-heart-rate', 'articles'],
  ['#articles/category/physiology', 'articles'],
  ['#admin', 'admin'],
  ['#admin/media-center', 'admin'],
];

for (const [hash, expected] of HASH_ROUTES) {
  check('هش ' + hash + ' ⇒ ' + expected, routeOf(hash), expected);
}

/* ── ۲. مجموعه‌های هش از خودِ ماژول، نه رشتهٔ دستی ── */

for (const hash of router.PRICING_HASHES) {
  check('هش تعرفه ' + hash + ' ⇒ pricing', routeOf(hash), 'pricing');
}
for (const hash of router.PRODUCTS_HASHES) {
  check('هش محصولات ' + hash + ' ⇒ products', routeOf(hash), 'products');
}
for (const hash of router.ABOUT_HASHES) {
  check('هش درباره ' + hash + ' ⇒ about', routeOf(hash), 'about');
}

/* ── ۳. مسیرهای ناشناخته و لنگرها ⇒ home ── */

for (const hash of ['', '#', '#top', '#nothing', '#dashboards', '#article', '#admi']) {
  check('هش ناشناخته ' + JSON.stringify(hash) + ' ⇒ home', routeOf(hash), 'home');
}

/*
 * ⚠️ تشخیص پیشوندی ممنوع (قاعدهٔ پروژه). `#dashboards`/`#article`/`#admi` بالا
 * همین را قفل می‌کنند: پیشوندِ نزدیک نباید مسیر را ببلعد.
 */

/* ── ۴. اولویت هش بر state کهنه ── */

check(
  'هش dashboard بر state کهنهٔ home مقدم است',
  routeOf('#dashboard', { tapeshRoute: 'home' }),
  'dashboard',
);
check(
  'هش articles بر state کهنهٔ admin مقدم است',
  routeOf('#articles', { tapeshRoute: 'admin' }),
  'articles',
);

/* ── ۵. fallback به history.state وقتی هش خالی است ── */

for (const route of ['dashboard', 'onboarding', 'auth', 'pricing', 'products', 'about', 'group', 'articles']) {
  check('state.tapeshRoute=' + route + ' ⇒ ' + route, routeOf('', { tapeshRoute: route }), route);
}

const BOOLEAN_FLAGS = [
  ['tapeshDashboard', 'dashboard'],
  ['tapeshOnboarding', 'onboarding'],
  ['tapeshAuth', 'auth'],
  ['tapeshPricing', 'pricing'],
  ['tapeshProducts', 'products'],
  ['tapeshAbout', 'about'],
  ['tapeshGroup', 'group'],
  ['tapeshArticles', 'articles'],
];

for (const [flag, route] of BOOLEAN_FLAGS) {
  check('state.' + flag + '=true ⇒ ' + route, routeOf('', { [flag]: true }), route);
}

check('state ناشناخته ⇒ home', routeOf('', { tapeshRoute: 'nonsense' }), 'home');
check('state خالی ⇒ home', routeOf('', {}), 'home');
check('state=null ⇒ home', routeOf('', null), 'home');

/* ── ۶. getAuthMode ── */

setLocation({ hash: '#auth/register' });
check('getAuthMode روی #auth/register ⇒ register', router.getAuthMode(), 'register');
setLocation({ hash: '#auth/register/step2' });
check('getAuthMode روی #auth/register/step2 ⇒ register', router.getAuthMode(), 'register');
setLocation({ hash: '#auth' });
check('getAuthMode روی #auth ⇒ login', router.getAuthMode(), 'login');
setLocation({ hash: '#auth/login' });
check('getAuthMode روی #auth/login ⇒ login', router.getAuthMode(), 'login');
setLocation({ hash: '#pricing' });
check('getAuthMode روی #pricing ⇒ login', router.getAuthMode(), 'login');

/* ── ۷. getArticleSlug ── */

const SLUG_CASES = [
  ['#articles/stress-heart-rate', 'stress-heart-rate'],
  ['#articles/saved', 'saved'],
  ['#articles/category/physiology', 'category/physiology'],
  ['#articles/a/b/c', 'a/b/c'],
  ['#articles', null],
  ['#articles/', null],
  ['#articles/UPPER-CASE', null],
  ['#articles/has_underscore', null],
  ['#articles/x?y=1', null],
  ['#pricing', null],
];

for (const [hash, expected] of SLUG_CASES) {
  setLocation({ hash });
  check('getArticleSlug روی ' + hash + ' ⇒ ' + JSON.stringify(expected), router.getArticleSlug(), expected);
}

/* ── ۸. getRouteUrl — حفظ زیرمسیرها ── */

setLocation({ hash: '', pathname: '/', search: '' });
check('getRouteUrl(home) بدون هش', router.getRouteUrl('home'), '/');

setLocation({ hash: '#articles/stress-heart-rate', pathname: '/', search: '' });
check(
  'getRouteUrl(articles) اسلاگ را حفظ می‌کند',
  router.getRouteUrl('articles'),
  '/#articles/stress-heart-rate',
);

setLocation({ hash: '#dashboard?s=tests&l=test-bank', pathname: '/', search: '' });
check(
  'getRouteUrl(dashboard) مسیر داخلی را حفظ می‌کند',
  router.getRouteUrl('dashboard'),
  '/#dashboard?s=tests&l=test-bank',
);

setLocation({ hash: '#auth/register', pathname: '/', search: '' });
check(
  'getRouteUrl(auth) زیرمسیر ثبت‌نام را حفظ می‌کند (قاعدهٔ README)',
  router.getRouteUrl('auth'),
  '/#auth/register',
);

setLocation({ hash: '#group?join=ABC123', pathname: '/', search: '' });
check(
  'getRouteUrl(group) کد دعوت را حفظ می‌کند',
  router.getRouteUrl('group'),
  '/#group?join=ABC123',
);

setLocation({ hash: '#auth', pathname: '/', search: '' });
check('getRouteUrl(auth) بدون زیرمسیر ⇒ #auth', router.getRouteUrl('auth'), '/#auth');

setLocation({ hash: '#articles', pathname: '/', search: '?utm=x' });
check('getRouteUrl با query موجود', router.getRouteUrl('pricing'), '/?utm=x#pricing');

/* ── ۹. ناواردایی رفت‌وبرگشت: هر مسیر ⇒ آدرس ⇒ همان مسیر ── */

const ALL_ROUTES = [
  'home', 'dashboard', 'onboarding', 'auth', 'pricing', 'products', 'about', 'group', 'articles', 'admin',
];

for (const route of ALL_ROUTES) {
  setLocation({ hash: '', pathname: '/', search: '' });
  const url = router.getRouteUrl(route);
  const at = url.indexOf('#');
  setLocation({ hash: at === -1 ? '' : url.slice(at), pathname: '/', search: '' });
  check('رفت‌وبرگشت ' + route + ' ⇒ ' + JSON.stringify(url), router.getAppRoute(), route);
}

/* ── ۱۰. getRouteState — دقیقاً یک پرچم روشن ── */

const STATE_FLAGS = ['tapeshAuth', 'tapeshOnboarding', 'tapeshDashboard', 'tapeshArticles',
  'tapeshPricing', 'tapeshProducts', 'tapeshAbout', 'tapeshGroup'];

checkTrue(
  'getRouteState همهٔ پرچم‌ها را می‌سازد',
  STATE_FLAGS.every((flag) => flag in router.getRouteState('home')),
  STATE_FLAGS.filter((flag) => !(flag in router.getRouteState('home'))).join(','),
);

for (const route of ALL_ROUTES) {
  const state = router.getRouteState(route);
  const on = STATE_FLAGS.filter((flag) => state[flag] === true);
  const expectedCount = route === 'home' || route === 'admin' ? 0 : 1;
  check('getRouteState(' + route + ') شمار پرچم روشن', on.length, expectedCount);
  check('getRouteState(' + route + ') مقدار tapeshRoute', state.tapeshRoute, route);
}

checkTrue(
  'getRouteState(state قبلی) کلیدهای دیگر را حفظ می‌کند',
  router.getRouteState('pricing', { scrollY: 42 }).scrollY === 42,
);

/* ── ۱۱. قرارداد routeHashes ── */

for (const [name, set] of [['PRICING_HASHES', router.PRICING_HASHES],
  ['PRODUCTS_HASHES', router.PRODUCTS_HASHES], ['ABOUT_HASHES', router.ABOUT_HASHES]]) {
  checkTrue(name + ' یک Set ناتهی است', set instanceof Set && set.size > 0, 'size=' + set.size);
  checkTrue(
    name + ' همهٔ عضوها با # شروع می‌شوند',
    [...set].every((hash) => hash.startsWith('#')),
    [...set].join(','),
  );
}

checkTrue('GROUP_HASH با # شروع می‌شود', router.GROUP_HASH.startsWith('#'));

check(
  'GREEN_PATH_DASHBOARD_HASH از خودِ dashboardRouteHash ساخته شده',
  router.GREEN_PATH_DASHBOARD_HASH,
  router.dashboardRouteHash({ layer: router.LAYER_IDS.greenPath }),
);

check(
  'courseDashboardHash(ناموجود) ⇒ null',
  router.courseDashboardHash('این-دوره-نیست'),
  null,
);

/* ── ۱۲. اتصال واقعی: هر کارت دوره به یک لایهٔ واقعی داشبورد می‌رسد ── */

const layerIds = Object.values(router.LAYER_IDS);
const courseIds = Object.keys(router.COURSE_LAYERS);

checkTrue('نگاشت COURSE_LAYERS ناتهی است', courseIds.length > 0, 'شمار=' + courseIds.length);

for (const courseId of courseIds) {
  const layerId = router.COURSE_LAYERS[courseId];
  const hash = router.courseDashboardHash(courseId);

  checkTrue(
    'دورهٔ ' + courseId + ' به لایهٔ واقعی اشاره می‌کند (' + layerId + ')',
    layerIds.includes(layerId),
    'لایهٔ ' + layerId + ' در LAYER_IDS نیست',
  );
  check(
    'هش کارت دورهٔ ' + courseId,
    hash,
    router.dashboardRouteHash({ layer: layerId }),
  );
  check(
    'هش کارت دورهٔ ' + courseId + ' ⇒ مسیر dashboard',
    routeOf(hash),
    'dashboard',
  );
}

/* ── ۱۳. هیچ مسیر تعرفه/محصولات/درباره با مسیر دیگری هم‌پوشانی ندارد ── */

const knownHashes = [
  ...router.PRICING_HASHES, ...router.PRODUCTS_HASHES, ...router.ABOUT_HASHES,
  router.GROUP_HASH, router.GREEN_PATH_DASHBOARD_HASH,
];
check('شمار هش‌های شناخته‌شده = شمار یکتا', new Set(knownHashes).size, knownHashes.length);

/* ─────────────────────────── ۵. نتیجه ─────────────────────────── */

console.log('');
console.log('─'.repeat(60));
if (failures.length) {
  console.log('شکست‌ها:');
  for (const line of failures) console.log('  • ' + line);
  console.log(passed + ' قبول · ' + failures.length + ' رد');
  process.exit(1);
}
console.log(passed + ' قبول · 0 رد');
process.exit(0);
