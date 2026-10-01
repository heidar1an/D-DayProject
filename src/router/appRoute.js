/*
 * خواندن/نوشتن مسیر ریشهٔ اپ (هش‌محور).
 *
 * از `src/App.jsx` جدا شد تا آن فایل غولِ تک‌فایلی نماند.
 */

import { ABOUT_HASHES, GROUP_HASH, PRICING_HASHES, PRODUCTS_HASHES } from './routeHashes.js';
import { useEffect, useRef, useState } from 'react';

function getAppRoute() {
  if (typeof window === 'undefined') return 'home';

  const { hash } = window.location;

  /* اولویت با hash است تا ناوبری داخل سشن (مثل داشبورد → مقالات)، state قدیمی را باطل کند */
  /* داشبورد مسیر داخلی خودش را در query همان hash نگه می‌دارد: #dashboard?s=tests&l=test-bank */
  if (hash === '#dashboard' || hash.startsWith('#dashboard?') || hash.startsWith('#dashboard/')) {
    return 'dashboard';
  }
  if (hash === '#onboarding') return 'onboarding';
  /*
   * صفحهٔ ورود و ثبت‌نام یکی است و با کلید داخلش جابه‌جا می‌شود؛ زیرمسیر
   * `#auth/register` فقط «با فرم ثبت‌نام باز کن» را می‌گوید تا CTAهای صفحهٔ اصلی
   * کاربر تازه را روی فرم ثبت‌نام بنشانند، نه فرم ورود.
   */
  if (hash === '#auth' || hash.startsWith('#auth/')) return 'auth';
  if (PRICING_HASHES.has(hash)) return 'pricing';
  if (PRODUCTS_HASHES.has(hash)) return 'products';
  if (ABOUT_HASHES.has(hash)) return 'about';
  if (hash === GROUP_HASH || hash.startsWith(`${GROUP_HASH}?`)) return 'group';
  if (hash === '#articles' || hash.startsWith('#articles/')) return 'articles';
  if (hash === '#admin' || hash.startsWith('#admin/')) return 'admin';

  const state = window.history.state ?? {};

  if (state.tapeshRoute === 'dashboard' || state.tapeshDashboard === true) {
    return 'dashboard';
  }

  if (state.tapeshRoute === 'onboarding' || state.tapeshOnboarding === true) {
    return 'onboarding';
  }

  if (state.tapeshRoute === 'auth' || state.tapeshAuth === true) {
    return 'auth';
  }

  if (state.tapeshRoute === 'pricing' || state.tapeshPricing === true) {
    return 'pricing';
  }

  if (state.tapeshRoute === 'products' || state.tapeshProducts === true) {
    return 'products';
  }

  if (state.tapeshRoute === 'about' || state.tapeshAbout === true) {
    return 'about';
  }

  if (state.tapeshRoute === 'group' || state.tapeshGroup === true) {
    return 'group';
  }

  if (state.tapeshRoute === 'articles' || state.tapeshArticles === true) {
    return 'articles';
  }

  return 'home';
}

/* حالت اولیهٔ فرمِ صفحهٔ ورود/ثبت‌نام از خودِ آدرس می‌آید: `#auth/register` ⇒
   فرم ثبت‌نام. هر آدرس دیگری ⇒ فرم ورود (رفتار قبلی، دست‌نخورده). */
function getAuthMode() {
  if (typeof window === 'undefined') return 'login';

  return window.location.hash.startsWith('#auth/register') ? 'register' : 'login';
}

/* مسیر داخلی مقالات از hash؛ مثلا:
   #articles/stress-heart-rate → stress-heart-rate
   #articles/saved             → لیست مطالعه
   #articles/category/physiology → دسته‌بندی */
function getArticleSlug() {
  if (typeof window === 'undefined') return null;

  const match = window.location.hash.match(/^#articles\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/);
  return match ? match[1] : null;
}

function getRouteUrl(route) {
  if (typeof window === 'undefined' || route === 'home') {
    return typeof window === 'undefined'
      ? ''
      : `${window.location.pathname}${window.location.search}`;
  }

  /* هنگام نرمال‌سازی لینک مستقیم، اسلاگ مقاله در hash حفظ شود */
  if (route === 'articles' && window.location.hash.startsWith('#articles')) {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  /* مسیر داخلی داشبورد (بخش/لایه) هم در لینک مستقیم و رفرش حفظ می‌شود */
  if (route === 'dashboard' && window.location.hash.startsWith('#dashboard?')) {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  /* `#auth/register` هم باید از نرمال‌سازی جانِ سالم به در ببرد، وگرنه لینک
     مستقیمِ فرم ثبت‌نام روی فرم ورود می‌افتد */
  if (route === 'auth' && window.location.hash.startsWith('#auth/')) {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  /*
   * لینک دعوت اشتراک گروهی (`#group?join=CODE`) هم باید در نرمال‌سازی آدرس
   * زنده بماند؛ وگرنه کاربر تازه‌وارد، کد را از دست می‌دهد و فرم خالی می‌ماند.
   */
  if (route === 'group' && window.location.hash.startsWith(`${GROUP_HASH}?`)) {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  return `${window.location.pathname}${window.location.search}#${route}`;
}

function getRouteState(route, previousState = {}) {
  return {
    ...previousState,
    tapeshRoute: route,
    tapeshAuth: route === 'auth',
    tapeshOnboarding: route === 'onboarding',
    tapeshDashboard: route === 'dashboard',
    tapeshArticles: route === 'articles',
    tapeshPricing: route === 'pricing',
    tapeshProducts: route === 'products',
    tapeshAbout: route === 'about',
    tapeshGroup: route === 'group',
  };
}

/*
 * بازگشت از یک لایهٔ مستقل به صفحهٔ اصلی: اگر مقصد یک لنگر بود (مثلاً فوتر)،
 * همان بخش در صفحهٔ اصلی پیدا و به آن اسکرول می‌شود. چرا دو فریم صبر: لایه‌ای
 * که بسته شده هنوز دارد unmount می‌شود و اندازهٔ سند تا رندرِ بعدی درست نیست.
 */
function useReturnToAnchor(isOpen) {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      const hash = window.location.hash;

      if (hash && hash !== '#top') {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));

        if (target) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          });
        }
      }
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}


export { getAppRoute, getAuthMode, getArticleSlug, getRouteUrl, getRouteState, useReturnToAnchor, useOnlineStatus };
