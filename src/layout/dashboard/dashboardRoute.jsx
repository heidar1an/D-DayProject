/*
 * مسیر داشبورد — تنها منبع حقیقتِ «کدام بخش، کدام لایه، کدام نما».
 *
 * چرا: دکمهٔ Back/Forward مرورگر باید بین لایه‌ها (و نمای داخلی هر لایه) جابه‌جا شود و
 * رفرش کاربر را دقیقاً در همان‌جایی که بود نگه دارد. پس وضعیت ناوبری داخل hash آدرس
 * می‌نشیند:
 *
 *   #dashboard
 *   #dashboard?s=tests
 *   #dashboard?s=tests&l=test-bank&v=%7B%22name%22%3A%22topics%22%7D
 *   #dashboard?s=other&o=settings&t=security
 *
 * هر لایه با هوک `useLayerRoute` نمای داخلی خودش را از همین آدرس می‌خواند و می‌نویسد؛
 * بقیهٔ state های لایه (فیلترهای گذرا، دادهٔ واکشی‌شده، اتاق آزمون در حال اجرا) مثل قبل
 * محلی می‌مانند. لایه‌های تودرتو (مثل مسیر آناتومی داخل درسنامهٔ جامع) با `slot` در
 * همان view جا می‌گیرند تا هم‌زمان با والدشان ذخیره شوند.
 *
 * قرارداد نوشتن: تغییر «صفحه» یک ورودی تاریخچه می‌سازد (push) و تغییر درون همان صفحه
 * (فیلتر، تب، جست‌وجو) ورودی فعلی را به‌روز می‌کند (replace) — دقیقاً مثل رفتار مرورگر.
 * نماهایی که به دادهٔ زمان‌اجرا وابسته‌اند (`volatile`) هیچ‌وقت در آدرس نمی‌نشینند تا
 * رفرش به یک صفحهٔ نیمه‌کاره نیفتد.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* بخش‌های اصلی داشبورد — همان کلیدهایی که DashboardLayout در `sections` می‌سازد */
export const DASHBOARD_SECTIONS = [
  'dashboard',
  'courses',
  'tests',
  'flashcards',
  'notes',
  'review-notebook',
  'other',
  'league',
  'pomodoro',
];

/* شناسهٔ لایه‌ها — تنها جایی که این رشته‌ها تعریف می‌شوند */
export const LAYER_IDS = {
  myCourses: 'my-courses',
  comprehensive: 'course-comprehensive',
  micro: 'course-micro',
  reference: 'course-reference',
  intlCourses: 'intl-courses',
  intlExams: 'intl-exams',
  coordinated: 'coordinated-exams',
  testBank: 'test-bank',
  analytics: 'analytics',
  wiki: 'wiki',
  knowledge: 'knowledge',
  ai: 'tapesh-ai',
};

export const OVERLAY_IDS = { settings: 'settings', notifications: 'notifications' };

const LAYER_LIST = Object.values(LAYER_IDS);
const OVERLAY_LIST = Object.values(OVERLAY_IDS);

/* مسیر پیش‌فرض داشبورد: بخش خانه، بدون لایه و بدون پنل */
export const EMPTY_DASHBOARD_ROUTE = {
  section: 'dashboard',
  layer: null,
  view: null,
  overlay: null,
  tab: 'profile',
};

const DashboardRouteContext = createContext(null);

function parseView(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/* ── تبدیل مسیر ↔ آدرس ── */

export function dashboardRouteHash(route = {}) {
  const params = new URLSearchParams();

  if (route.section && route.section !== EMPTY_DASHBOARD_ROUTE.section) params.set('s', route.section);
  if (route.overlay) params.set('o', route.overlay);
  if (route.overlay === OVERLAY_IDS.settings && route.tab && route.tab !== EMPTY_DASHBOARD_ROUTE.tab) {
    params.set('t', route.tab);
  }
  if (route.layer) {
    params.set('l', route.layer);
    if (route.view) params.set('v', JSON.stringify(route.view));
  }

  const query = params.toString();
  return query ? `#dashboard?${query}` : '#dashboard';
}

export function dashboardRouteUrl(route) {
  if (typeof window === 'undefined') return dashboardRouteHash(route);
  return `${window.location.pathname}${window.location.search}${dashboardRouteHash(route)}`;
}

/* آدرس → مسیر؛ مقادیر ناشناخته بی‌صدا به پیش‌فرض برمی‌گردند */
export function readDashboardRoute(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const route = { ...EMPTY_DASHBOARD_ROUTE };
  if (typeof hash !== 'string' || !hash.startsWith('#dashboard')) return route;

  const mark = hash.indexOf('?');
  if (mark === -1) return route;

  const params = new URLSearchParams(hash.slice(mark + 1));

  const section = params.get('s');
  if (section && DASHBOARD_SECTIONS.includes(section)) route.section = section;

  const overlay = params.get('o');
  if (overlay && OVERLAY_LIST.includes(overlay)) {
    /* پنل تنظیمات/اعلان‌ها و لایه هم‌زمان باز نمی‌شوند */
    route.overlay = overlay;
    route.tab = params.get('t') ?? EMPTY_DASHBOARD_ROUTE.tab;
    return route;
  }

  const layer = params.get('l');
  if (layer && LAYER_LIST.includes(layer)) {
    route.layer = layer;
    route.view = parseView(params.get('v'));
  }

  return route;
}

/* ── وضعیت مسیر در DashboardLayout ── */

/*
 * state مسیر + نوشتن در تاریخچه. هر جای داشبورد که بخواهد کاربر را جابه‌جا کند
 * فقط از push/replace استفاده می‌کند؛ خود مرورگر بقیهٔ Back/Forward را می‌چرخاند.
 */
export function useDashboardRouteState() {
  const [route, setRoute] = useState(() => readDashboardRoute());
  const hashRef = useRef(null);
  /* آخرین مسیر — چند نوشتن پشت‌سرهم در یک تیک (مثل تغییر هم‌زمان فیلتر و صفحه) نباید
     نوشتهٔ قبلی را از دست بدهد، پس خواندن از state همان رندر کافی نیست. */
  const routeRef = useRef(route);
  routeRef.current = route;

  if (hashRef.current === null) hashRef.current = dashboardRouteHash(route);

  const applyRoute = useCallback((next, { replace = false } = {}) => {
    const hash = dashboardRouteHash(next);

    if (typeof window !== 'undefined' && hash !== hashRef.current) {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      /* state هم‌شکل با روتر بیرونی سایت تا مسیر «داشبورد» حفظ شود */
      const state = {
        ...(window.history.state ?? {}),
        tapeshRoute: 'dashboard',
        tapeshAuth: false,
        tapeshOnboarding: false,
        tapeshDashboard: true,
        tapeshArticles: false,
      };

      if (replace) window.history.replaceState(state, '', url);
      else window.history.pushState(state, '', url);

      hashRef.current = hash;
    }

    routeRef.current = next;
    setRoute(next);
  }, []);

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      if (hash === hashRef.current) return;
      /* پیمایش‌های بیرون از داشبورد (لنگرهای صفحه اصلی و …) کاری به این لایه ندارند */
      if (!hash.startsWith('#dashboard')) return;
      hashRef.current = hash;
      setRoute(readDashboardRoute(hash));
    };

    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);

    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  return { route, routeRef, applyRoute };
}

export function DashboardRouteProvider({ value, children }) {
  return <DashboardRouteContext.Provider value={value}>{children}</DashboardRouteContext.Provider>;
}

export function useDashboardRoute() {
  return useContext(DashboardRouteContext);
}

/* ── ناوبری داخل لایه‌ها ── */

const EMPTY_VOLATILE = [];

/* «صفحه»ی لایه از فیلد name/mode خوانده می‌شود؛ تغییر آن یک ورودی تاریخچه می‌سازد */
const defaultScreenOf = (view) => {
  if (typeof view?.name === 'string') return view.name;
  if (typeof view?.mode === 'string') return view.mode;
  return 'main';
};

/*
 * نمای داخلی یک لایه را به مسیر داشبورد وصل می‌کند.
 *
 *   const [view, setView, patchView] = useLayerRoute(LAYER_IDS.wiki, { mode: 'home' });
 *
 * initialView باید ثابت (خارج از کامپوننت) باشد.
 * slot برای لایه‌های تودرتو، و volatile برای نماهایی است که در آدرس نمی‌نشینند.
 */
export function useLayerRoute(layerId, initialView, options = {}) {
  const { slot = null, volatile = EMPTY_VOLATILE, screenOf = defaultScreenOf } = options;
  const context = useContext(DashboardRouteContext);
  const route = context?.route ?? null;

  const routeView = route && route.layer === layerId ? route.view : null;
  const incoming = slot ? routeView?.[slot] : routeView;

  const [view, setViewState] = useState(() => incoming ?? initialView);
  const viewRef = useRef(view);
  /* آخرین مقداری که خودمان در مسیر نوشتیم؛ برای تشخیص Back/Forward از تغییر خودمان */
  const writtenRef = useRef(incoming);

  useEffect(() => {
    if (incoming === writtenRef.current) return;
    writtenRef.current = incoming;
    const next = incoming ?? initialView;
    viewRef.current = next;
    setViewState(next);
  }, [incoming, initialView]);

  const setView = useCallback(
    (next, { replace = false } = {}) => {
      const resolved = typeof next === 'function' ? next(viewRef.current) : next;
      viewRef.current = resolved;
      setViewState(resolved);

      if (!context || !resolved) return;
      /* نمای گذرا (اتاق آزمون، کارنامهٔ در حافظه) در آدرس نمی‌نشیند */
      if (volatile.includes(screenOf(resolved))) return;

      const currentRoute = context.routeRef?.current ?? context.route ?? EMPTY_DASHBOARD_ROUTE;
      const baseView = currentRoute.layer === layerId && currentRoute.view ? currentRoute.view : {};
      const currentSlot = slot ? baseView[slot] : baseView;
      const nextRouteView = slot ? { ...baseView, [slot]: resolved } : resolved;

      const sameContent = JSON.stringify(currentSlot ?? null) === JSON.stringify(resolved);
      const sameScreen = screenOf(currentSlot) === screenOf(resolved);
      const write = replace || sameContent || sameScreen ? context.replace : context.push;

      writtenRef.current = resolved;
      write({ ...currentRoute, layer: layerId, view: nextRouteView, overlay: null });
    },
    [context, layerId, slot, screenOf, volatile],
  );

  const patchView = useCallback(
    (partial, options_) => setView({ ...(viewRef.current ?? {}), ...partial }, options_),
    [setView],
  );

  return [view, setView, patchView];
}
