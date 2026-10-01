import { useEffect, useState } from 'react';
import professor from '../images/pictures/images (1).jpeg';
import friendsDoctorsIllustration from '../images/pictures/Asset 3.webp';
import tapeshCollage from '../images/pictures/Asset 7.webp';
import OfflinePage from './layout/OfflinePage';
import SecondaryRegistrationLayout from './layout/SecondaryRegistrationLayout';
import DashboardLayout from './layout/dashboard/DashboardLayout';
import { CATALOG_COURSES, CatalogCourseCard, CatalogIcon } from './layout/dashboard/CoursesSection';
import ArticlesPage from './layout/articles/ArticlesPage';
import ArticlePage from './layout/articles/ArticlePage';
import ReadingListPage from './layout/articles/ReadingListPage';
import AdminLayout from './layout/admin/AdminLayout';
import PricingPage from './layout/pricing/PricingPage';
import ProductsPage from './layout/products/ProductsPage';
import AboutPage from './layout/about/AboutPage';
import GroupPage from './layout/group/GroupPage';
import { ArticleCover } from './layout/articles/articlesShared';
import './layout/admin/admin.css';

import { getAppRoute, getArticleSlug, getAuthMode, getRouteState, getRouteUrl, useOnlineStatus, useReturnToAnchor } from './router/appRoute.js';
import { AuthPage } from './layout/auth/AuthPage.jsx';
import { courseDashboardHash } from './router/routeHashes.js';
import { MotionStrip, SiteFooter, SiteHeader } from './layout/site/SiteChrome.jsx';
import { benefitRows, faqItems, homeArticles, homePromoCards, tapeshFeatures } from './layout/site/siteData.js';
import { ArrowLeftIcon } from './layout/site/siteIcons.jsx';

/* صفحه‌ای که برای مسیر داخلی مقالات رندر می‌شود؛ خود hash کاملاً پایدار می‌ماند */
function ArticlesRoute({ articleSlug }) {
  if (!articleSlug) return <ArticlesPage />;

  if (articleSlug === 'saved') return <ReadingListPage />;

  if (articleSlug.startsWith('category/')) {
    return <ArticlesPage key={articleSlug} initialCategory={articleSlug.slice('category/'.length)} />;
  }

  return <ArticlePage key={articleSlug} slug={articleSlug} />;
}

import TapeshEasterEgg from './components/easter-egg/TapeshEasterEgg';
/* مرز خطا (فاز ۶) — سه سطح: ریشه (main.jsx)، داشبورد، پنل مدیریت */
import ErrorBoundary from './components/ErrorBoundary';
import { clearStoredUser, fetchCurrentUser, saveProfile } from './services/userStorage';
import { identify, startTracking, trackLogin, trackLogout, trackSignup } from './services/telemetry/trafficTracker';
import './layout/dashboard/dashboard.css';
import './layout/admin/analytics/analytics.css';
import './layout/admin/media/media.css';
import './layout/admin/planning/planning.css';

export { FOOTER_PRODUCT_LINKS, FOOTER_SECTION_LINKS, FOOTER_SOCIAL_LINKS, homePromoCards } from './layout/site/siteData.js';
export { AuthPage } from './layout/auth/AuthPage.jsx';


export function SignupPromptModal({ course, onClose, onConfirm }) {
  useEffect(() => {
    if (!course) return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [course, onClose]);

  if (!course) return null;

  return (
    <div
      className="signup-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
    >
      <button
        type="button"
        className="signup-modal__scrim"
        aria-label="بستن"
        onClick={onClose}
      />

      <div className="signup-modal__panel">
        <span
          className="signup-modal__badge"
          style={{
            color: course.accent,
            backgroundColor: `${course.accent}1f`,
            borderColor: `${course.accent}3d`,
          }}
        >
          <CatalogIcon name={course.id} className="signup-modal__badge-icon" />
          {course.title}
        </span>

        <h2 className="signup-modal__title" id="signup-modal-title">
          برای شروع این دوره اول ثبت‌نام کن
        </h2>

        <p className="signup-modal__text">
          «{course.title}» برای دانشجوهای ثبت‌نام‌شده فعال است. ثبت‌نام رایگان است و
          کمتر از یک دقیقه طول می‌کشد؛ بعد از آن مستقیم وارد همین دوره می‌شوی.
        </p>

        <ol className="signup-modal__steps">
          <li>
            <span className="signup-modal__step-index" aria-hidden="true">
              ۱
            </span>
            شمارهٔ موبایلت را وارد کن و کد تأیید را بزن.
          </li>
          <li>
            <span className="signup-modal__step-index" aria-hidden="true">
              ۲
            </span>
            پروفایل کوتاهت را کامل کن.
          </li>
          <li>
            <span className="signup-modal__step-index" aria-hidden="true">
              ۳
            </span>
            وارد «{course.title}» می‌شوی.
          </li>
        </ol>

        <div className="signup-modal__actions">
          <a className="button button--primary" href="#auth" onClick={onConfirm}>
            ثبت‌نام و ورود به دوره
          </a>
          <button type="button" className="signup-modal__later" onClick={onClose}>
            بعداً
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [authOpen, setAuthOpen] = useState(
    () => getAppRoute() === 'auth',
  );
  /* فرمِ بازشده در صفحهٔ ورود/ثبت‌نام: از آدرس می‌آید و با هر CTA عوض می‌شود */
  const [authMode, setAuthMode] = useState(() => getAuthMode());
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => getAppRoute() === 'onboarding',
  );
  const [dashboardOpen, setDashboardOpen] = useState(
    () => getAppRoute() === 'dashboard',
  );
  const [articlesOpen, setArticlesOpen] = useState(
    () => getAppRoute() === 'articles',
  );
  /* صفحهٔ تعرفه‌ها یک مسیر مستقل است: لایهٔ `#pricing` */
  const [pricingOpen, setPricingOpen] = useState(
    () => getAppRoute() === 'pricing',
  );
  /* صفحهٔ محصولات هم مسیر مستقل است: لایهٔ `#products` */
  const [productsOpen, setProductsOpen] = useState(
    () => getAppRoute() === 'products',
  );
  /* صفحهٔ «دربارهٔ تپش» مسیر مستقل است: لایهٔ `#about` */
  const [aboutOpen, setAboutOpen] = useState(
    () => getAppRoute() === 'about',
  );
  /* صفحهٔ اشتراک گروهی مسیر مستقل است: لایهٔ `#group` (و `#group?join=CODE`) */
  const [groupOpen, setGroupOpen] = useState(
    () => getAppRoute() === 'group',
  );
  /* پنل مدیریت یک مسیر مستقل است و برای ورود به آن به حساب کاربری سایت نیاز نیست */
  const [adminOpen, setAdminOpen] = useState(
    () => getAppRoute() === 'admin',
  );
  const [articleSlug, setArticleSlug] = useState(() =>
    getAppRoute() === 'articles' ? getArticleSlug() : null,
  );
  /*
   * `userData` فقط از سرور می‌آید. `tapesh:current-user` در localStorage یک کش
   * نمایشی است، نه مدرک هویت: اگر سرور جواب ندهد یا بگوید وارد نیستی، کاربر
   * «واردنشده» می‌ماند. (پیش‌تر مقدار اولیهٔ این state از localStorage خوانده
   * می‌شد و یک رکورد جعلی محلی، کاربر را وارد می‌کرد.)
   */
  const [userData, setUserData] = useState(null);
  const [pendingDashboardHash, setPendingDashboardHash] = useState(null);
  const isOnline = useOnlineStatus();

  /*
   * ردیاب ترافیک — تنها منبع «بازدید واقعی» مرکز تحلیل در پنل.
   * یک‌بار در کل عمر اپ روشن می‌شود (خودش idempotent است) و صفحهٔ اول را
   * بی‌درنگ ثبت می‌کند. اگر کاربر Do-Not-Track بفرستد، هیچ‌چیز ثبت نمی‌شود.
   */
  useEffect(() => {
    startTracking();
  }, []);

  /*
   * تأیید سشن با سرور در اولین بارگذاری — تنها منبع حقیقت احراز هویت.
   * «سرور در دسترس نیست» با «وارد نشده‌ام» قاطی نمی‌شود، ولی هیچ‌کدام ورود
   * نمی‌سازند؛ در هر دو حالت کاربر واردنشده می‌ماند.
   */
  useEffect(() => {
    let active = true;

    fetchCurrentUser().then((result) => {
      if (!active) return;

      if (result.status === 'authenticated') {
        setUserData(result.user);
        return;
      }

      if (result.status === 'unauthenticated') {
        clearStoredUser();
        setUserData(null);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  /* هویت کاربر با ورود/خروج عوض می‌شود؛ فقط شبه‌نام یک‌طرفه به سرور می‌رود */
  useEffect(() => {
    identify(userData);
  }, [userData]);

  const closeMenu = () => setMenuOpen(false);
  const openAuth = (event, mode = 'login') => {
    /* رویداد اختیاری است: مسیرهایی مثل کادرهای تبلیغی محصولات بدون کلیک هم به ورود می‌فرستند */
    event?.preventDefault();
    closeMenu();
    /*
     * `#auth/register` فرم ثبت‌نام را باز می‌کند و `#auth` فرم ورود. هر دو یک
     * مسیر (`auth`) اند، پس منطق مسیرها دست‌نخورده می‌ماند و فقط حالتِ فرم
     * از آدرس می‌آید.
     */
    const authHash = mode === 'register' ? '#auth/register' : '#auth';
    setAuthMode(mode);
    window.history.pushState(
      getRouteState('auth'),
      '',
      `${window.location.pathname}${window.location.search}${authHash}`,
    );
    setAuthOpen(true);
    setOnboardingOpen(false);
    setDashboardOpen(false);
    setArticlesOpen(false);
    setPricingOpen(false);
    setProductsOpen(false);
    setAboutOpen(false);
    setGroupOpen(false);
    setArticleSlug(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  /* ورود به بخش مقالات (فهرست) با pushState تا دکمه Back به صفحه اصلی برگردد */
  const openArticles = (event) => {
    event?.preventDefault();
    closeMenu();
    window.history.pushState(
      getRouteState('articles'),
      '',
      getRouteUrl('articles'),
    );
    setAuthOpen(false);
    setOnboardingOpen(false);
    setDashboardOpen(false);
    setArticlesOpen(true);
    setArticleSlug(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const closeAuth = () => {
    setPendingDashboardHash(null);
    if (getAppRoute() === 'auth') {
      window.history.back();
      return;
    }

    window.history.replaceState(
      getRouteState('home'),
      '',
      getRouteUrl('home'),
    );
    setAuthOpen(false);
    setOnboardingOpen(false);
    setDashboardOpen(false);
    setArticlesOpen(false);
    setPricingOpen(false);
    setProductsOpen(false);
    setAboutOpen(false);
    setGroupOpen(false);
    setArticleSlug(null);
  };

  useEffect(() => {
    /* آخرین مسیر دیده‌شده — تا اسکرول به بالا فقط «هنگام ورود» به لایه اجرا شود،
       نه با هر پرش لنگر داخلی همان لایه (مثل #pr-compare). */
    let previousRoute = getAppRoute();

    const syncAuthRoute = () => {
      const route = getAppRoute();
      const enteredRoute = route !== previousRoute;
      previousRoute = route;

      setAuthOpen(route === 'auth');
      if (route === 'auth') setAuthMode(getAuthMode());
      setOnboardingOpen(route === 'onboarding');
      setDashboardOpen(route === 'dashboard');
      setArticlesOpen(route === 'articles');
      setAdminOpen(route === 'admin');
      setPricingOpen(route === 'pricing');
      setProductsOpen(route === 'products');
      setAboutOpen(route === 'about');
      setGroupOpen(route === 'group');
      setArticleSlug(route === 'articles' ? getArticleSlug() : null);

      /* ورود به مقالات (فهرست یا مقاله) همیشه از بالای صفحه شروع شود؛
         لایه‌های تعرفه و محصولات فقط وقتی از مسیر دیگری وارد می‌شوند */
      if (
        route === 'articles' ||
        ((route === 'pricing' || route === 'products' || route === 'about' || route === 'group') &&
          enteredRoute)
      ) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };

    const initialRoute = getAppRoute();
    const currentState = window.history.state || {};
    const hasManagedRoute =
      currentState.tapeshRoute ||
      currentState.tapeshAuth === true ||
      currentState.tapeshOnboarding === true ||
      currentState.tapeshDashboard === true ||
      currentState.tapeshPricing === true ||
      currentState.tapeshProducts === true ||
      currentState.tapeshAbout === true ||
      currentState.tapeshGroup === true;

    if (!hasManagedRoute && initialRoute !== 'home') {
      /* آدرس مقصد قبل از نرمال‌سازی محاسبه شود تا اسلاگ مقاله در لینک مستقیم حفظ شود */
      const targetUrl = getRouteUrl(initialRoute);

      window.history.replaceState(getRouteState('home', currentState), '', getRouteUrl('home'));

      if (initialRoute === 'onboarding') {
        window.history.pushState(getRouteState('auth'), '', getRouteUrl('auth'));
      }

      window.history.pushState(getRouteState(initialRoute), '', targetUrl);
    } else if (!currentState.tapeshRoute) {
      window.history.replaceState(
        getRouteState(initialRoute, currentState),
        '',
        window.location.href,
      );
    }

    syncAuthRoute();
    window.addEventListener('popstate', syncAuthRoute);
    window.addEventListener('hashchange', syncAuthRoute);

    return () => {
      window.removeEventListener('popstate', syncAuthRoute);
      window.removeEventListener('hashchange', syncAuthRoute);
    };
  }, []);

  useEffect(() => {
    if (authOpen || onboardingOpen || dashboardOpen) return undefined;
    const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));
    const pendingFrames = new Set();

    const revealElement = (element) => {
      if (
        element.classList.contains('is-visible') ||
        element.dataset.revealQueued === 'true'
      ) {
        return;
      }

      element.dataset.revealQueued = 'true';

      const firstFrame = requestAnimationFrame(() => {
        pendingFrames.delete(firstFrame);

        const secondFrame = requestAnimationFrame(() => {
          element.classList.add('is-visible');
          delete element.dataset.revealQueued;
          pendingFrames.delete(secondFrame);
        });

        pendingFrames.add(secondFrame);
      });

      pendingFrames.add(firstFrame);
    };

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach(revealElement);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          revealElement(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    const initialCheck = window.setTimeout(() => {
      const viewportHeight = window.innerHeight;

      revealElements.forEach((element) => {
        const bounds = element.getBoundingClientRect();

        if (bounds.top < viewportHeight * 0.94 && bounds.bottom > 0) {
          revealElement(element);
        }
      });
    }, 0);

    return () => {
      window.clearTimeout(initialCheck);
      observer.disconnect();
      pendingFrames.forEach((frame) => cancelAnimationFrame(frame));
    };
  }, [authOpen, onboardingOpen, dashboardOpen, articlesOpen, articleSlug, pricingOpen, productsOpen, aboutOpen, groupOpen]);

  /*
   * بازگشت از یک لایه به صفحهٔ اصلی: اگر مقصد یک لنگر بود (مثلاً فوتر)، به
   * همان بخش اسکرول شود. مقالات، تعرفه‌ها و محصولات دقیقاً همین رفتار را
   * دارند — یک هوک، تا سه نسخهٔ کپی از این منطق ساخته نشود.
   */
  useReturnToAnchor(articlesOpen);
  useReturnToAnchor(pricingOpen);
  useReturnToAnchor(productsOpen);
  useReturnToAnchor(aboutOpen);
  useReturnToAnchor(groupOpen);

  const openOnboarding = () => {
    window.history.pushState(
      getRouteState('onboarding'),
      '',
      getRouteUrl('onboarding'),
    );
    setAuthOpen(false);
    setOnboardingOpen(true);
    setDashboardOpen(false);
    setArticlesOpen(false);
    setPricingOpen(false);
    setProductsOpen(false);
    setAboutOpen(false);
    setGroupOpen(false);
    setArticleSlug(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const closeOnboarding = () => {
    if (getAppRoute() === 'onboarding') {
      window.history.back();
      return;
    }

    window.history.replaceState(
      getRouteState('home'),
      '',
      getRouteUrl('home'),
    );
    setOnboardingOpen(false);
    setAuthOpen(false);
    setDashboardOpen(false);
    setArticlesOpen(false);
    setPricingOpen(false);
    setProductsOpen(false);
    setAboutOpen(false);
    setGroupOpen(false);
    setArticleSlug(null);
  };

  /*
   * `hash` مقصدِ مشخص داخل داشبورد است (مثلاً لایهٔ یک محصول از بخشِ محصولاتِ
   * صفحهٔ اصلی). وقتی هست، مقدم است بر مسیرِ پیش‌فرض — وگرنه لایهٔ درخواستی در
   * نرمال‌سازیِ آدرس گم می‌شد.
   */
  const openDashboard = (user, { replaceHistory = true, hash = null } = {}) => {
    setUserData(user);
    const routeState = getRouteState('dashboard');
    const routeUrl = hash
      ? `${window.location.pathname}${window.location.search}${hash}`
      : getRouteUrl('dashboard');

    /* ورود از هدر صفحه اصلی با pushState انجام می‌شود تا دکمه Back کاربر را به صفحه اصلی برگرداند */
    if (replaceHistory) {
      window.history.replaceState(routeState, '', routeUrl);
    } else {
      window.history.pushState(routeState, '', routeUrl);
    }

    setOnboardingOpen(false);
    setAuthOpen(false);
    setDashboardOpen(true);
    setArticlesOpen(false);
    setPricingOpen(false);
    setProductsOpen(false);
    setAboutOpen(false);
    setGroupOpen(false);
    setArticleSlug(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  /*
   * کادرهای تبلیغی محصولات سرصفحه. کاربر واردنشده مقصدش را در
   * `pendingDashboardHash` نگه می‌دارد تا پس از ورود یا تکمیل پروفایل دقیقاً همان
   * لایه فرود بیاید — همان قراردادی که کارت‌های دوره و لینک فوتر دارند.
   * امضای `onOpen` کارتِ کاتالوگ فقط شناسهٔ کارت را می‌فرستد، پس رویداد کلیک لازم نیست.
   */
  const openHomePromo = (promoId) => {
    const card = homePromoCards.find((promo) => promo.id === promoId);
    if (!card) return;

    closeMenu();

    if (!userData) {
      setPendingDashboardHash(card.href);
      openAuth();
      return;
    }

    openDashboard(userData, { replaceHistory: false, hash: card.href });
  };

  /* مقصد عمومی مسیر سبز از خودِ جدول لینک‌های فوتر می‌آید؛ تابع جدا لازم نیست. */

  /*
   * CTA صفحه‌های تعرفه و محصولات: کاربر واردشده مستقیم به داشبورد می‌رود و
   * کاربر تازه به ورود/ثبت‌نام. یک تابع، چون کارت‌های تعرفه، فراخوان پایانی
   * هر دو صفحه و دکمه‌های محصولات همگی از همین استفاده می‌کنند (بدون منطق
   * تکراری در UI).
   */
  const enterTapesh = (event) => {
    event?.preventDefault();

    if (userData) {
      openDashboard(userData, { replaceHistory: false });
      return;
    }

    openAuth(event);
  };

  /*
   * پنج کارتِ دورهٔ زیر هیرو. هیچ گاردِ ثبت‌نامی این‌جا نیست: لایه‌های دوره برای
   * همه باز است و کاربرِ واردنشده هم مستقیم وارد همان لایه می‌شود (داشبورد در
   * حالت مهمان رندر می‌شود). پیش‌تر کاربرِ واردنشده پاپ‌آپ ثبت‌نام می‌گرفت و
   * اصلاً به لایه نمی‌رسید.
   */
  const openHomeCourse = (courseId) => {
    const hash = courseDashboardHash(courseId);
    if (!hash) return;

    openDashboard(userData, { replaceHistory: false, hash });
  };

  const finishOnboarding = async (profile) => {
    /*
     * پروفایل با سشن سرور ذخیره می‌شود (`PATCH /api/users/me`)، نه با شمارهٔ
     * تلفن. اگر ذخیره نشد، کاربر همان‌طور که هست (واردشده) ادامه می‌دهد —
     * خرابی ذخیرهٔ پروفایل هرگز هویت را عوض نمی‌کند.
     */
    const updatedUser = await saveProfile({ profile });
    const destination = pendingDashboardHash;
    setPendingDashboardHash(null);
    openDashboard(updatedUser ?? userData, { hash: destination });
  };

  /* خروج از حساب: فقط سشن پاک می‌شود تا حساب کاربر برای ورود بعدی باقی بماند */
  const handleLogout = async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* پاک‌سازی رابط کاربر حتی هنگام قطع ارتباط انجام می‌شود. */
    }
    trackLogout();
    identify(null);
    clearStoredUser();
    setPendingDashboardHash(null);
    setUserData(null);
    window.history.replaceState(getRouteState('home'), '', getRouteUrl('home'));
    setDashboardOpen(false);
    setAuthOpen(false);
    setOnboardingOpen(false);
    setArticlesOpen(false);
    setPricingOpen(false);
    setProductsOpen(false);
    setAboutOpen(false);
    setGroupOpen(false);
    setArticleSlug(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  /*
   * CTAهای بخش محصولات — مقصدِ هر محصول یک لایهٔ واقعیِ داشبورد است، نه یک
   * لنگرِ تزیینیِ صفحهٔ اصلی (پیش از این همهٔ کارت‌ها به یک بخشِ بی‌ربط
   * می‌رفتند). کاربرِ واردنشده ابتدا به ورود هدایت می‌شود؛ همان رفتاری که
   * لایهٔ تعرفه‌ها دارد.
   */
  const openProduct = (event, href) => {
    event?.preventDefault();
    closeMenu();

    /*
     * مقصدهای غیرداشبوردی (مثل «مقالات» که مسیرِ مستقلِ خودش را دارد) نباید به
     * عنوانِ hashِ داخلیِ داشبورد صدا زده شوند — وگرنه آدرس `#articles` می‌شد
     * و کاربر به‌جای لایه، به صفحهٔ مقالاتِ سایت می‌رفت.
     */
    if (href && !href.startsWith('#dashboard')) {
      if (href.startsWith('#articles')) {
        openArticles(event);
        return;
      }

      window.location.hash = href;
      return;
    }

    if (!userData) {
      openAuth(event);
      return;
    }

    openDashboard(userData, { replaceHistory: false, hash: href });
  };

  /*
   * CTAهای «از الان شروع کنید» صفحهٔ اصلی و لینک‌های ستون «محصولات» فوتر.
   * قاعدهٔ واحد: کاربرِ **ثبت‌نام‌نکرده** به فرم ثبت‌نام می‌رود و مقصدش در
   * `pendingDashboardHash` می‌ماند تا پس از ثبت‌نام و تکمیل پروفایل دقیقاً روی
   * همان لایه فرود بیاید؛ کاربرِ **ثبت‌نام‌شده** مستقیم به مقصد خودش می‌رود —
   * لایهٔ همان محصول، و اگر مقصدی تعیین نشده باشد، خودِ داشبورد.
   */
  const startFromLanding = (event, href = null) => {
    event?.preventDefault();
    closeMenu();

    if (!userData) {
      if (href) setPendingDashboardHash(href);
      openAuth(event, 'register');
      return;
    }

    openDashboard(userData, { replaceHistory: false, hash: href });
  };

  /* بازگشت از پنل مدیریت به سایت؛ نشست مدیر دست‌نخورده می‌ماند */
  const closeAdmin = () => {
    window.history.replaceState(getRouteState('home'), '', getRouteUrl('home'));
    setAdminOpen(false);
    setAuthOpen(false);
    setOnboardingOpen(false);
    setDashboardOpen(false);
    setArticlesOpen(false);
    setPricingOpen(false);
    setProductsOpen(false);
    setAboutOpen(false);
    setGroupOpen(false);
    setArticleSlug(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (!isOnline) {
    return <OfflinePage />;
  }

  /* پنل مدیریت: پیش از همهٔ مسیرها بررسی می‌شود چون خودش نشست و ورود مستقل دارد */
  if (adminOpen) {
    /*
     * مرز خطای مستقل پنل (فاز ۶): خطای یک صفحهٔ پنل نباید کاربر را در صفحهٔ
     * سفید زندانی کند. «بازگشت» همان `closeAdmin` است، پس راه خروج همیشه هست.
     */
    return (
      <ErrorBoundary scope="admin" resetKey="admin" onExit={closeAdmin} exitLabel="خروج از پنل">
        <AdminLayout onExit={closeAdmin} />
      </ErrorBoundary>
    );
  }

  if (onboardingOpen) {
    return (
      <SecondaryRegistrationLayout
        onBack={closeOnboarding}
        onComplete={finishOnboarding}
        userData={userData}
      />
    );
  }

  /*
   * داشبورد برای کاربرِ واردنشده هم رندر می‌شود (حالت مهمان): لایه‌های دوره و
   * محصولات گاردِ ثبت‌نام ندارند. سرویس‌ها `userData?.id ?? 'guest'` را به‌عنوان
   * هویت می‌گیرند، پس نبودِ حساب خطا نمی‌سازد. هدر سایت بیرون از داشبورد همچنان
   * «ورود / ثبت نام» را نشان می‌دهد چون `userData` دست‌نخورده می‌ماند.
   */
  if (dashboardOpen) {
    /*
     * مرز خطای مستقل داشبورد (فاز ۶): یک لایهٔ عمیق (مثلاً موتور ۳بعدی آناتومی)
     * اگر بترکد، فقط همین بخش خطا نشان می‌دهد و هدر/فوتر سایت سالم می‌ماند.
     */
    return (
      <ErrorBoundary
        scope="dashboard"
        resetKey="dashboard"
        /* خروج بدون logout: فقط برگشت به صفحهٔ اصلی — حساب کاربر دست‌نخورده می‌ماند */
        onExit={() => {
          window.history.replaceState(getRouteState('home'), '', getRouteUrl('home'));
          setDashboardOpen(false);
        }}
        exitLabel="بازگشت به سایت"
      >
        <DashboardLayout
          userData={userData}
          onUserDataChange={setUserData}
          onLogout={handleLogout}
        />
      </ErrorBoundary>
    );
  }

  if (authOpen) {
    return (
      <AuthPage
        key={authMode}
        initialMode={authMode}
        onBack={closeAuth}
        onLoginSuccess={(user) => {
          trackLogin();
          const destination = pendingDashboardHash;
          setPendingDashboardHash(null);
          openDashboard(user, { hash: destination });
        }}
        onRegisterSuccess={(user) => {
          trackSignup();
          setUserData(user);
          openOnboarding();
        }}
      />
    );
  }

  if (pricingOpen) {
    return (
      <div className="app" id="top">
        <SiteHeader
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          userData={userData}
          onOpenDashboard={() => openDashboard(userData, { replaceHistory: false })}
          onOpenAuth={openAuth}
        />

        <PricingPage hasAccount={Boolean(userData)} onStart={enterTapesh} />

        <SiteFooter onProductLink={startFromLanding} />
      </div>
    );
  }

  if (productsOpen) {
    return (
      <div className="app app--scroll" id="top">
        <SiteHeader
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          userData={userData}
          onOpenDashboard={() => openDashboard(userData, { replaceHistory: false })}
          onOpenAuth={openAuth}
        />

        <ProductsPage
          hasAccount={Boolean(userData)}
          onOpenProduct={openProduct}
          onStart={enterTapesh}
        />

        <SiteFooter onProductLink={startFromLanding} />
      </div>
    );
  }

  if (aboutOpen) {
    return (
      <div className="app app--scroll" id="top">
        <SiteHeader
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          userData={userData}
          onOpenDashboard={() => openDashboard(userData, { replaceHistory: false })}
          onOpenAuth={openAuth}
        />

        <AboutPage
          hasAccount={Boolean(userData)}
          onStart={enterTapesh}
          onOpenProduct={openProduct}
        />

        <SiteFooter onProductLink={startFromLanding} />
      </div>
    );
  }

  if (groupOpen) {
    return (
      <div className="app app--scroll" id="top">
        <SiteHeader
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          userData={userData}
          onOpenDashboard={() => openDashboard(userData, { replaceHistory: false })}
          onOpenAuth={openAuth}
        />

        <GroupPage userData={userData} onStart={enterTapesh} />

        <SiteFooter onProductLink={startFromLanding} />
      </div>
    );
  }

  if (articlesOpen) {
    return (
      <div className="app" id="top">
        <SiteHeader
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          userData={userData}
          onOpenDashboard={() => openDashboard(userData, { replaceHistory: false })}
          onOpenAuth={openAuth}
        />

        {articleSlug ? <ArticlesRoute articleSlug={articleSlug} /> : <ArticlesPage />}

        <SiteFooter onProductLink={startFromLanding} />
      </div>
    );
  }

  return (
    <div className="app" id="top">
      <SiteHeader
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        userData={userData}
        onOpenDashboard={() => openDashboard(userData, { replaceHistory: false })}
        onOpenAuth={openAuth}
      />

      <main>
        <section className="hero" data-reveal="hero" aria-labelledby="hero-title">
          <div className="hero__content">
            <h1 id="hero-title">
              <span>یادگیری پزشکی</span>
              <span>ساده‌تر از هر زمان دیگری</span>
            </h1>
            <p>
              دروس پزشکی، آمادگی برای علوم پایه، جمع‌بندی هوشمند و خیلی چیزهای
              دیگر منتظر شما هستند.
            </p>
            {/*
             * CTA هیرو ⇒ صفحهٔ ثبت‌نام (`#auth/register`). قبلاً لنگرِ `#products`
             * بود که روی صفحهٔ اصلی هیچ عنصری با آن شناسه وجود ندارد (تلهٔ ۱۰).
             */}
            <a
              className="button button--primary"
              href="#auth/register"
              onClick={(event) => openAuth(event, 'register')}
            >
              از الان شروع کنید
            </a>
          </div>

          {/*
           * پنج دورهٔ اصلی — همان کارت‌های کاتالوگ بخش «دوره‌ها» در داشبورد،
           * بلافاصله زیر دکمهٔ «از الان شروع کنید» تا مسیر شروع از خودِ هیرو
           * مشخص باشد. `size="lg"` همان کارت است با اندازهٔ بزرگ‌ترِ همین نوار
           * (فقط از ۱۵۳۶px به بعد، جایی که نوار از سقف قبلی‌اش پهن‌تر می‌شود).
           */}
          <div className="hero__courses" data-reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-5">
              {CATALOG_COURSES.map((course) => (
                <CatalogCourseCard
                  key={course.id}
                  course={course}
                  size="lg"
                  onOpen={openHomeCourse}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          className="benefits section-shell"
          id="benefits"
          data-reveal
          aria-labelledby="benefits-title"
        >
          <h2 className="section-title" id="benefits-title">
            تپش؛ ضربان زندگی دانشجویان علوم پزشکی
          </h2>
          <div className="benefits__rows">
            {benefitRows.map((row, rowIndex) => (
              <div className="benefits__row" key={`benefit-row-${rowIndex}`}>
                {row.map((card) => (
                  <article
                    className={`benefit-card benefit-card--${card.size} benefit-card--${card.accent}`}
                    key={card.title}
                  >
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section
          className="quote section-shell"
          id="quote"
          data-reveal
          aria-labelledby="quote-title"
        >
          <div className="quote__mark quote__mark--open" aria-hidden="true">
            “
          </div>
          <blockquote id="quote-title">
            پزشک باید درد بیمار را بفهمد و با او همدرد باشد، نه اینکه تنها به
            فکر درمان یک عضو یا یک آزمایشگاه باشد
          </blockquote>
          <div className="quote__mark quote__mark--close" aria-hidden="true">
            ”
          </div>
          <div className="quote__author">
            <img src={professor} alt="پروفسور علیرضا یلدا" />
            <div>
              <strong>پروفسور علیرضا یلدا</strong>
              <span>پدر بیماری‌های عفونی ایران</span>
            </div>
          </div>
        </section>

        <section className="continuation section-shell" aria-label="مسیرهای یادگیری تپش">
          <article className="friends-banner" id="start" data-reveal>
            <div className="friends-banner__visual">
              <img
                src={friendsDoctorsIllustration}
                alt="دو پزشک در حال گفت‌وگو"
                className="friends-banner__image"
              />
            </div>
            <div className="friends-banner__content">
              <h2>با رفقا درس بخون</h2>
              <p>
                با تهیه اشتراک گروهی می‌توانید تا ۳۰٪ تخفیف بین ۲ الی ۳ نفر به
                همراه دوستانتان مطالعه داشته باشید.
              </p>
              {/*
               * مقصد، لایهٔ واقعیِ اشتراک گروهی است (`#group`) — همان قاعدهٔ
               * تلهٔ ۱۰: CTA نباید به یک لنگرِ بی‌ربط ختم شود. پیش از این به
               * `#courses` می‌رفت، یعنی فقط کمی پایین‌تر.
               */}
              <a className="button button--orange" href="#group">
                از الان شروع کنید
              </a>
            </div>
          </article>

          {/*
           * کادرهای تبلیغی محصولات سرصفحه — چیدمانِ دو در دو (`.promo-grid`).
           *
           * هر کادر یک ترکیبِ مورّب است: بلوکِ متن پایینِ سمت راست (برچسبِ رده →
           * نام محصول → یک جملهٔ توضیح) و نشانهٔ گرافیکیِ بزرگ بالا سمت چپ.
           * دکمهٔ فلشِ گوشهٔ پایین-چپ فقط برای این است که «کلیک‌شدنی» بودنِ کادر
           * دیده شود، چون خودِ کارت یک <button> است و مقصدش در HTML نمی‌نشیند.
           *
           * پنلِ رنگی و نسخهٔ متن‌خوانِ اکسنت (`--promo-ink`) از توکن‌های لایهٔ
           * استایل می‌آیند — قاعدهٔ `.promo-card--<id>` در styles.css؛ خودِ اکسنتِ
           * خامِ داده فقط پشتِ هالهٔ تزیینیِ لوگو می‌نشیند. دلیلش این است که هگزِ
           * خام در تم روشن روی پنلِ پاستلی متن‌خوان نیست.
           *
           * `id="courses"` عمداً همین‌جاست: لینک‌های فوتر و صفحهٔ مقاله به
           * `#courses` می‌روند و باید به یک لنگرِ موجود برسند (تلهٔ ۱۰).
           */}
          <div id="courses" className="promo-grid" data-reveal>
            {homePromoCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => openHomePromo(card.id)}
                aria-label={`ورود به ${card.title}`}
                className={`promo-card promo-card--${card.id}`}
                style={{ '--promo-accent': card.accent }}
              >
                <span className="promo-card__art" aria-hidden="true">
                  <CatalogIcon name={card.id} className="promo-card__glyph" />
                </span>

                <span className="promo-card__body">
                  <span className="promo-card__eyebrow">{card.eyebrow}</span>
                  <span className="promo-card__title">{card.title}</span>
                  <span className="promo-card__text">{card.description}</span>
                </span>

                <span className="promo-card__go" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M19 12H5m6-6-6 6 6 6" />
                  </svg>
                </span>
              </button>
            ))}
          </div>

          <article className="tapesh-intro" id="tapesh-intro" data-reveal>
            <div className="tapesh-intro__visual">
              <img
                src={tapeshCollage}
                alt="کلاژی از دانشجو، هوش مصنوعی و مفاهیم پزشکی"
                className="tapesh-intro__image"
              />
            </div>
            <div className="tapesh-intro__content">
              <h2>هر آنچه همه خوبان دارند ما یکجا داریم</h2>
              <p>
                با طرح‌های اختصاصی برای شما به یک پزشک متخصص و حرفه‌ای تبدیل
                شوید؛ با استفاده از منابع و تست‌های تپش از پس هر امتحانی برمی‌آیید.
              </p>
              <div className="tapesh-features">
                {tapeshFeatures.map((feature) => (
                  <div className="tapesh-feature" key={feature.title}>
                    <span className={`tapesh-feature__icon tapesh-feature__icon--${feature.accent}`}>
                      <img src={feature.icon} alt="" />
                    </span>
                    <span>{feature.title}</span>
                  </div>
                ))}
              </div>
              <a
                className="button button--blue"
                href="#auth/register"
                onClick={(event) => startFromLanding(event)}
              >
                از الان شروع کنید
              </a>
            </div>
          </article>
        </section>

        <section
          className="articles section-shell"
          id="articles"
          data-reveal
          aria-labelledby="articles-title"
        >
          <h2 className="lower-section-title" id="articles-title">
            مقالات
          </h2>
          <div className="article-grid">
            {homeArticles.map((article) => (
              <article className="article-card" key={article.slug}>
                <div className="article-card__image" aria-hidden="true">
                  <ArticleCover article={article} />
                </div>
                <div className="article-card__content">
                  <h3>
                    <a className="article-card__title-link" href={`#articles/${article.slug}`} aria-label={`مطالعه مقاله ${article.title}`}>
                      {article.title}
                    </a>
                  </h3>
                  <p>{article.excerpt}</p>
                  <span className="article-card__go" aria-hidden="true">
                    <ArrowLeftIcon />
                  </span>
                </div>
              </article>
            ))}
          </div>
          <div className="articles__all">
            <a className="articles-all-link" href="#articles" onClick={openArticles}>
              مشاهده همه مقالات
              <span aria-hidden="true">←</span>
            </a>
          </div>
        </section>

        <section
          className="faq section-shell"
          id="faq"
          data-reveal
          aria-labelledby="faq-title"
        >
          <h2 className="lower-section-title" id="faq-title">
            سوالات متداول
          </h2>
          <div className="faq-grid">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div className={`faq-item ${isOpen ? 'is-open' : ''}`} key={item.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                  >
                    <span>{item.question}</span>
                    <span className="faq-item__plus" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  <div className="faq-item__answer" aria-hidden={!isOpen}>
                    <p>{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter onProductLink={startFromLanding} />

      <MotionStrip />
    </div>
  );
}

/*
 * ریشهٔ اپ.
 *
 * `App` همان درختِ مسیرهاست و دست‌نخورده می‌ماند؛ پوستهٔ ایستر اگ فقط یک
 * خواهرِ آن است. این‌طوری activation در همهٔ مسیرها (صفحهٔ اصلی، مقالات،
 * تعرفه‌ها، محصولات، و کلِ لایهٔ داشبورد) کار می‌کند بدون آنکه یک خط به
 * منطقِ routing اضافه شود. خودِ پوسته وقتی بسته است `null` برمی‌گرداند،
 * پس هیچ گره‌ای به DOM اضافه نمی‌کند.
 */
export default function TapeshApp() {
  return (
    <>
      <App />
      <TapeshEasterEgg />
    </>
  );
}
