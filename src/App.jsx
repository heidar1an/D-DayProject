import { useEffect, useRef, useState } from 'react';

import blueRobot from '../images/pictures/ChatGPT Image ۲۷ مرداد ۱۴۰۵، ۱۷_۲۰_۲۷.png';
import greenTest from '../images/pictures/ChatGPT Image ۲۷ مرداد ۱۴۰۵، ۱۷_۱۵_۳۴.png';
import purpleBook from '../images/pictures/ChatGPT Image ۲۷ مرداد ۱۴۰۵، ۱۷_۰۹_۵۰.png';
import professor from '../images/pictures/images (1).jpeg';
import brownTest from '../images/pictures/01.png';
import heartbeatMark from '../images/pictures/600ppi/logo-mark.webp';
import friendsDoctorsIllustration from '../images/pictures/Asset 3.webp';
import baleSocialIcon from '../images/icons/Asset 13.webp';
import eitaaSocialIcon from '../images/icons/eitaa.svg';
import telegramSocialIcon from '../images/icons/Asset 11.webp';
import instagramSocialIcon from '../images/icons/Asset 14.webp';
import youtubeSocialIcon from '../images/icons/youtube.svg';
import tapeshCollage from '../images/pictures/Asset 7.webp';
import trophyIcon from '../images/icons/trophy.png';
import aiIcon from '../images/icons/ai-technology.png';
import checklistIcon from '../images/icons/checklist.png';
import distanceIcon from '../images/icons/distance.png';
import OfflinePage from './layout/OfflinePage';
import SecondaryRegistrationLayout from './layout/SecondaryRegistrationLayout';
import ThemeToggle from './layout/ThemeToggle';
import DashboardLayout, { COURSE_LAYERS } from './layout/dashboard/DashboardLayout';
import { CATALOG_COURSES, CatalogCourseCard, CatalogIcon } from './layout/dashboard/CoursesSection';
import { dashboardRouteHash, LAYER_IDS, OVERLAY_IDS } from './layout/dashboard/dashboardRoute';
import ArticlesPage from './layout/articles/ArticlesPage';
import ArticlePage from './layout/articles/ArticlePage';
import ReadingListPage from './layout/articles/ReadingListPage';
import AdminLayout from './layout/admin/AdminLayout';
import PricingPage from './layout/pricing/PricingPage';
import ProductsPage from './layout/products/ProductsPage';
import AboutPage from './layout/about/AboutPage';
import GroupPage from './layout/group/GroupPage';
import { ArticleCover } from './layout/articles/articlesShared';
import { avatarSrc } from './layout/dashboard/setting/avatar/avatarOptions';
import './layout/admin/admin.css';

/* صفحه‌ای که برای مسیر داخلی مقالات رندر می‌شود؛ خود hash کاملاً پایدار می‌ماند */
function ArticlesRoute({ articleSlug }) {
  if (!articleSlug) return <ArticlesPage />;

  if (articleSlug === 'saved') return <ReadingListPage />;

  if (articleSlug.startsWith('category/')) {
    return <ArticlesPage key={articleSlug} initialCategory={articleSlug.slice('category/'.length)} />;
  }

  return <ArticlePage key={articleSlug} slug={articleSlug} />;
}
import { getLatestArticles } from './services/articles/articlesService';
import {
  clearGoogleReturn,
  clearStoredUser,
  consumeGoogleHandoff,
  getDisplayName,
  getGoogleAuthStatus,
  getStoredUser,
  loginUser,
  readGoogleReturn,
  saveUserRecord,
  startGoogleAuth,
} from './services/userStorage';
import { identify, startTracking, trackLogin, trackLogout, trackSignup } from './services/telemetry/trafficTracker';
import { GROUP_PAGE_HASH } from './services/group/groupService';
import './layout/dashboard/dashboard.css';
import './layout/admin/analytics/analytics.css';
import './layout/admin/media/media.css';

const authHighlights = [
  {
    title: 'خودتو برای علوم پایه آماده کن',
    description: 'در کوتاه‌ترین زمان و با کیفیت بالا خودتو برای علوم پایه آماده کن؛ بهترین دوره‌ها منتظر تو هستند.',
    image: brownTest,
    accent: 'copper',
  },
  {
    title: 'یادگیری نوین دروس پزشکی',
    description: 'با استفاده از جدیدترین متدهای یادگیری و با یک رابط گرافیکی جذاب، دیگه درس خوندن سخت نخواهد بود.',
    image: purpleBook,
    accent: 'lavender',
  },
  {
    title: 'درساتو از یک حرفه‌ای بپرس',
    description: 'جایی رو متوجه نشدی؟ با چند کلیک اطلاعات پزشکیت رو بروز کن؛ دستیار هوشمند کنار توست.',
    image: blueRobot,
    accent: 'sky',
  },
  {
    title: 'با بهترین‌ها رقابت کن',
    description: 'با همکلاسی‌هات و دانشجوهای سراسر کشور رقابت کن؛ به همراه آزمون‌های تالیفی.',
    image: greenTest,
    accent: 'mint',
  },
];

const authAnimatedPhrases = [
  { text: 'درسنامه های جامع داره', accent: 'blue' },
  { text: 'روان توضیح میده', accent: 'green' },
  { text: 'مطالب رو سریع جمع میکنه', accent: 'brown' },
  { text: 'بانک تست کاملی داره', accent: 'purple' },
];

/*
 * پیام‌های بازگشت از گوگل. کدها را سرور در آدرس می‌گذارد (`database/googleAuth.js`)
 * و هر کدام باید کاربر را به «کار درست» بفرستد، نه به یک پیام مبهم — همان قاعدهٔ
 * ترجمهٔ خطای انتشار: اول متنِ سرویس، بعد کد وضعیت.
 */
const GOOGLE_RETURN_MESSAGES = {
  unconfigured:
    'ورود با گوگل روی این سرور فعال نشده است (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
  offline: 'سرور ورود با گوگل در دسترس نیست؛ اتصال خود را بررسی کنید.',
  cancelled: 'ورود با گوگل لغو شد.',
  state: 'نشست ورود با گوگل منقضی شد؛ یک‌بار دیگر تلاش کنید.',
  failed: 'ورود با گوگل انجام نشد؛ یک‌بار دیگر تلاش کنید.',
};

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

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="بازگشت به ابتدای صفحه">
      <span className="brand__mark">
        <img src={heartbeatMark} alt="" />
      </span>
      <span className="brand__word">تپش</span>
    </a>
  );
}

function ArrowIcon() {
  return (
    <span className="arrow-icon" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M10 38 38 10M19 10h19v19" />
      </svg>
    </span>
  );
}

function ArrowLeftIcon() {
  return <span aria-hidden="true">←</span>;
}

function HeaderUserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="var(--blue-ink)"
        d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.42Z"
      />
      <path
        fill="var(--green-ink)"
        d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.75Z"
      />
      <path
        fill="var(--gold-ink)"
        d="M6.53 13.83A5.85 5.85 0 0 1 6.22 12c0-.64.11-1.26.31-1.83V7.64H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.36l3.25-2.53Z"
      />
      <path
        fill="var(--red-ink)"
        d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.23 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 7.86 9.45 6.14 12 6.14Z"
      />
    </svg>
  );
}

function MotionStrip() {
  const trackRef = useRef(null);
  const sequenceRef = useRef(null);
  const loopWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const targetVelocityRef = useRef(1);
  const completedLoopsRef = useRef(0);
  const finishedRef = useRef(false);
  const stoppingRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    const sequence = sequenceRef.current;
    if (!track || !sequence) return undefined;

    const measureLoop = () => {
      const trackStyles = window.getComputedStyle(track);
      const sequenceGap = parseFloat(trackStyles.columnGap || trackStyles.gap) || 0;

      loopWidthRef.current = sequence.getBoundingClientRect().width + sequenceGap;
    };

    measureLoop();
    const resizeObserver =
      'ResizeObserver' in window ? new ResizeObserver(measureLoop) : null;

    resizeObserver?.observe(sequence);
    document.fonts?.ready.then(measureLoop);
    window.addEventListener('resize', measureLoop);

    let animationFrame = 0;
    let lastTime = performance.now();
    const loopDuration = 24000;
    const totalLoops = 12;

    const animate = (time) => {
      const delta = Math.min(time - lastTime, 50);
      lastTime = time;

      if (!finishedRef.current && loopWidthRef.current > 0) {
        const loopWidth = loopWidthRef.current;
        const targetSpeed = targetVelocityRef.current * (loopWidth / loopDuration);
        const easing = 1 - Math.exp(-delta / (stoppingRef.current ? 900 : 420));

        velocityRef.current += (targetSpeed - velocityRef.current) * easing;
        offsetRef.current -= velocityRef.current * delta;

        if (offsetRef.current <= -loopWidth) {
          offsetRef.current += loopWidth;
          completedLoopsRef.current += 1;

          if (completedLoopsRef.current >= totalLoops) {
            completedLoopsRef.current = totalLoops;
            stoppingRef.current = true;
            targetVelocityRef.current = 0;
          }
        }

        if (stoppingRef.current && Math.abs(velocityRef.current) < 0.0001) {
          velocityRef.current = 0;
          finishedRef.current = true;
        }

        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureLoop);
    };
  }, []);

  const pauseMotion = () => {
    if (!finishedRef.current) targetVelocityRef.current = 0;
  };

  const resumeMotion = () => {
    if (!finishedRef.current && !stoppingRef.current) targetVelocityRef.current = 1;
  };

  return (
    <div
      className="motion-strip"
      aria-label="دسته‌بندی‌های تپش"
      onPointerEnter={pauseMotion}
      onPointerLeave={resumeMotion}
    >
      <div className="motion-track" ref={trackRef}>
        {[0, 1, 2, 3, 4].map((sequenceIndex) => {
          /*
           * پنج نسخهٔ یکسان برای بی‌درز شدن چرخش تکرار می‌شوند؛ فقط نسخهٔ اول
           * «واقعی» است. چهار نسخهٔ تکراری از درخت دسترس‌پذیری و ترتیب تب بیرون
           * می‌مانند (aria-hidden + tabIndex=-1) وگرنه فوتر بیست وقفهٔ تبی می‌ساخت
           * در حالی که کاربر فقط چهار مقصد می‌بیند. کلیک روی نسخه‌های تکراری
           * دست‌نخورده کار می‌کند.
           */
          const isClone = sequenceIndex > 0;

          return (
            <div
              className="motion-sequence"
              ref={sequenceIndex === 0 ? sequenceRef : undefined}
              key={sequenceIndex}
              aria-hidden={isClone || undefined}
            >
              {motionItems.map((item) => (
                <a
                  className={`motion-pill motion-pill--${item.accent}`}
                  href={item.href}
                  tabIndex={isClone ? -1 : undefined}
                  key={`${sequenceIndex}-${item.title}`}
                >
                  {item.title}
                </a>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* هدر سایت — یک نسخه واحد برای صفحه اصلی و صفحه مقالات */
function SiteHeader({ menuOpen, onMenuOpenChange, userData, onOpenDashboard, onOpenAuth }) {
  const closeMenu = () => onMenuOpenChange(false);

  return (
    <header className="site-header" data-reveal="header">
      <Brand />

      <button
        className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
        type="button"
        aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
        aria-expanded={menuOpen}
        onClick={() => onMenuOpenChange(!menuOpen)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="ناوبری اصلی">
        <a className="site-nav__link site-nav__link--products" href="#products" onClick={closeMenu}>
          محصولات
        </a>
        <a className="site-nav__link site-nav__link--pricing" href="#pricing" onClick={closeMenu}>
          تعرفه‌ها
        </a>
        <a className="site-nav__link site-nav__link--about" href="#about" onClick={closeMenu}>
          درباره ما
        </a>
        {/* مقالات یک مسیر مستقل است (`#articles`) — مثل سه لینک دیگر، فقط hash
            عوض می‌شود و روتر خودش صفحه را بالا می‌آورد. */}
        <a className="site-nav__link site-nav__link--articles" href="#articles" onClick={closeMenu}>
          مقالات
        </a>
      </nav>

      <div className="site-header__actions">
        <ThemeToggle />

        {userData ? (
          <button
            className="auth-link auth-link--user"
            type="button"
            aria-label={`ورود به داشبورد ${getDisplayName(userData)}`}
            onClick={onOpenDashboard}
          >
            <span className="auth-link__avatar">
              {avatarSrc(userData.profile?.avatar) ? (
                <img src={avatarSrc(userData.profile?.avatar)} alt="" />
              ) : (
                <HeaderUserIcon />
              )}
            </span>
            <span className="auth-link__name">{getDisplayName(userData)}</span>
          </button>
        ) : (
          <a className="auth-link auth-link--login" href="#auth" onClick={onOpenAuth}>
            ورود / ثبت نام
          </a>
        )}
      </div>
    </header>
  );
}

/* فوتر سایت — مشترک بین صفحهٔ اصلی و بقیهٔ لایه‌های عمومی */
function SiteFooter() {
  return (
    <footer className="site-footer" id="footer" data-reveal>
      <div className="site-footer__inner section-shell">
        <div className="site-footer__brand">
          <Brand />
          <small>نسخه ۱.۵.۵.۲۷</small>
          <div className="site-footer__about">
            <p>
              والا ما اومدیم دور هم یک چایی بخوریم گفتیم ی پلتفرم نزنیم بچه‌های
              پزشکی رو دور هم جمع کنیم؟ اینجوری شد که بار نیسان سر از اینجا در
              آوردیم. اگه بازم این حوالی راهت خورد بیا پیش خودمون ی چایی مهمون ما باش!
            </p>
          </div>
        </div>

        <nav className="site-footer__column" aria-label="محصولات">
          <h2>محصولات</h2>
          {FOOTER_PRODUCT_LINKS.map((link) => (
            <a key={link.title} href={link.href}>
              {link.title}
            </a>
          ))}
        </nav>

        <nav className="site-footer__column" aria-label="سایر بخش‌ها">
          <h2>سایر بخش‌ها</h2>
          {FOOTER_SECTION_LINKS.map((link) => (
            <a key={link.title} href={link.href}>
              {link.title}
            </a>
          ))}
        </nav>

        <nav className="site-footer__social" aria-label="فضاهای مجازی تپش">
          <h2>ما را دنبال کنید</h2>
          <div className="site-footer__social-links">
            {FOOTER_SOCIAL_LINKS.map((item) => (
              <a
                key={item.id}
                className={`site-footer__social-link site-footer__social-link--${item.id}`}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                aria-label={item.label}
                title={item.label}
              >
                <img src={item.image} alt="" />
              </a>
            ))}
          </div>
        </nav>
      </div>
    </footer>
  );
}

function useAuthTypewriter(phrases, enabled) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedPhrase, setDisplayedPhrase] = useState('');
  const [phase, setPhase] = useState('typing');

  useEffect(() => {
    if (!enabled) {
      setPhraseIndex(0);
      setDisplayedPhrase('');
      setPhase('typing');
      return undefined;
    }

    const phraseCharacters = Array.from(phrases[phraseIndex].text);
    let timer;

    if (phase === 'typing') {
      if (displayedPhrase.length < phraseCharacters.length) {
        timer = window.setTimeout(() => {
          setDisplayedPhrase(
            phraseCharacters.slice(0, displayedPhrase.length + 1).join(''),
          );
        }, 140);
      } else {
        setPhase('holding');
      }
    }

    if (phase === 'holding') {
      timer = window.setTimeout(() => setPhase('deleting'), 10000);
    }

    if (phase === 'deleting') {
      if (displayedPhrase.length > 0) {
        timer = window.setTimeout(() => {
          setDisplayedPhrase(
            phraseCharacters.slice(0, displayedPhrase.length - 1).join(''),
          );
        }, 90);
      } else {
        timer = window.setTimeout(() => {
          setPhraseIndex((currentIndex) => (currentIndex + 1) % phrases.length);
          setPhase('typing');
        }, 2000);
      }
    }

    return () => window.clearTimeout(timer);
  }, [displayedPhrase, enabled, phase, phraseIndex, phrases]);

  return { displayedPhrase, phraseIndex };
}

/*
 * `export` عمدی است — مثل `SignupPromptModal` و `AdminShell`: صفحهٔ ورود پشت
 * state (`authOpen`) قفل است و در رندر سرور به آن نمی‌رسیم، پس هارنس
 * `scripts/verify-render.mjs` باید بتواند همین کامپوننت را مستقیم رندر کند.
 */
export function AuthPage({ onBack, onLoginSuccess, onRegisterSuccess }) {
  const [mode, setMode] = useState('login');
  const [isEntered, setIsEntered] = useState(false);
  const [isFormSwitching, setIsFormSwitching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  /* وضعیت گوگل: `null` یعنی هنوز از سرور نپرسیده‌ایم — با `false` اشتباه نشود */
  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleNotice, setGoogleNotice] = useState('');
  const [isGooglePending, setIsGooglePending] = useState(false);
  const modeSwitchTimerRef = useRef(null);
  const isRegistering = mode === 'register';
  const {
    displayedPhrase: animatedPhrase,
    phraseIndex: animatedPhraseIndex,
  } = useAuthTypewriter(authAnimatedPhrases, !isRegistering);

  const clearFieldError = (fieldName) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const phoneInput = form.querySelector('#auth-phone');
    const passwordInput = form.querySelector('#auth-password');
    const confirmationInput = form.querySelector('#auth-password-confirm');
    const requiredFields = isRegistering
      ? ['phone', 'password', 'password-confirm']
      : ['phone', 'password'];
    const nextErrors = {};

    [phoneInput, passwordInput, confirmationInput].forEach((input) => {
      input?.setCustomValidity('');
    });

    requiredFields.forEach((fieldName) => {
      const value = String(formData.get(fieldName) || '').trim();

      if (!value) {
        nextErrors[fieldName] = 'لطفا این بخش را پر کنید.';
      }
    });

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = form.querySelector(
        `[name="${Object.keys(nextErrors)[0]}"]`,
      );
      requestAnimationFrame(() => firstInvalidField?.focus({ preventScroll: true }));
      return;
    }

    const normalizeDigits = (value) =>
      value
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const phone = normalizeDigits(String(formData.get('phone') || '').trim());
    const password = String(formData.get('password') || '');
    const confirmation = String(formData.get('password-confirm') || '');

    if (isRegistering && password !== confirmation) {
      confirmationInput?.setCustomValidity('رمز عبور و تکرار آن یکسان نیستند.');
      confirmationInput?.reportValidity();
      return;
    }

    if (isRegistering) {
      const user = await saveUserRecord({ phone, password });
      onRegisterSuccess?.(user);
      return;
    }

    const user = await loginUser({ phone, password });
    if (!user) {
      setFieldErrors({ password: 'شماره تلفن یا رمز عبور نادرست است.' });
      passwordInput?.focus({ preventScroll: true });
      return;
    }

    onLoginSuccess?.(user);
  };

  const switchMode = () => {
    if (isFormSwitching) return;

    setFieldErrors({});
    setIsFormSwitching(true);
    window.clearTimeout(modeSwitchTimerRef.current);
    modeSwitchTimerRef.current = window.setTimeout(() => {
      setMode((currentMode) => (currentMode === 'login' ? 'register' : 'login'));
      requestAnimationFrame(() => setIsFormSwitching(false));
    }, 240);
  };

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setIsEntered(true));
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(modeSwitchTimerRef.current);
  }, []);

  /*
   * callbackها در ref می‌مانند چون `deps` این افکت عمداً خالی است:
   * `onLoginSuccess`/`onRegisterSuccess` در App توابع inline تازه‌اند و اگر در
   * deps بیایند، هر رندر یک‌بار دیگر اجرا می‌شد؛ `setGoogleStatus` هم شیء تازه
   * می‌سازد ⇒ حلقهٔ بی‌پایان fetch (همان تلهٔ `useAsync(loader, deps)` در README).
   */
  const authCallbacksRef = useRef({ onLoginSuccess, onRegisterSuccess });

  useEffect(() => {
    authCallbacksRef.current = { onLoginSuccess, onRegisterSuccess };
  });

  /*
   * ورود با گوگل — دو کار در زمان mount:
   *   ۱. پرسیدن وضعیت پیکربندی سرور، تا دکمه چیزی را که نیست ادعا نکند.
   *   ۲. اگر با `?google=…` برگشتیم: نشانه را از آدرس پاک کنیم (تا رفرش جریان را
   *      تکرار نکند) و کاربرِ «دست‌دادن» را تحویل بگیریم.
   *
   * پروفایل ناقص ⇒ همان مسیر ثبت‌نام (آنبوردینگ)؛ حساب کامل ⇒ ورود مستقیم.
   * یعنی کاربر گوگلیِ تازه هم «ثبت نام اولیه» را همان‌جا تمام می‌کند.
   *
   * ⚠️ گاردِ `googleBootRef` یک‌بارمصرف است، نه فلگ `active`: پروژه زیر
   * `StrictMode` اجرا می‌شود و افکت در توسعه دو بار اجرا می‌شود
   * (mount → cleanup → mount). با فلگ `active`، ادامهٔ async اجرای اول دور
   * ریخته می‌شد و اجرای دوم — چون اجرای اول پارامتر آدرس را پاک کرده بود —
   * `returned = null` می‌دید؛ یعنی «دست‌دادن» هیچ‌وقت تحویل نمی‌شد و کاربر
   * بی‌هیچ خطایی روی `#auth` می‌ماند.
   */
  const googleBootRef = useRef(false);

  useEffect(() => {
    if (googleBootRef.current) return;
    googleBootRef.current = true;

    const returned = readGoogleReturn();
    if (returned) clearGoogleReturn();

    const boot = async () => {
      const status = await getGoogleAuthStatus();
      setGoogleStatus(status);

      if (!returned) return;

      if (returned !== 'handoff') {
        setGoogleNotice(GOOGLE_RETURN_MESSAGES[returned] ?? GOOGLE_RETURN_MESSAGES.failed);
        return;
      }

      setIsGooglePending(true);
      const user = await consumeGoogleHandoff();
      setIsGooglePending(false);

      if (!user) {
        setGoogleNotice(GOOGLE_RETURN_MESSAGES.failed);
        return;
      }

      if (user.profile?.username) authCallbacksRef.current.onLoginSuccess?.(user);
      else authCallbacksRef.current.onRegisterSuccess?.(user);
    };

    boot();
  }, []);

  const handleGoogleAuth = () => {
    if (isGooglePending) return;

    /* پیکربندی‌نشده را همین‌جا می‌گوییم؛ رفتن به سرور و برگشتن فقط وقت می‌برد */
    if (googleStatus && !googleStatus.configured) {
      setGoogleNotice(GOOGLE_RETURN_MESSAGES.unconfigured);
      return;
    }

    setIsGooglePending(true);
    startGoogleAuth();
  };

  const googleNote =
    googleNotice ||
    (googleStatus && !googleStatus.configured
      ? googleStatus.reachable
        ? GOOGLE_RETURN_MESSAGES.unconfigured
        : GOOGLE_RETURN_MESSAGES.offline
      : '');

  const isGoogleReady = googleStatus?.configured !== false;

  return (
    <main className="auth-page" dir="rtl">
      <div className={`auth-page__shell ${isEntered ? 'is-visible' : ''}`}>
        <section className="auth-highlights" aria-label="مزایای تپش">
          {authHighlights.map((card) => (
            <article className={`auth-highlight auth-highlight--${card.accent}`} key={card.title}>
              <img className="auth-highlight__image" src={card.image} alt="" />
              <div className="auth-highlight__copy">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <button
            className="auth-panel__logo-button"
            type="button"
            aria-label="بازگشت به صفحه اصلی"
            onClick={onBack}
          >
            <img src={heartbeatMark} alt="تپش" />
          </button>

          <h1
            id="auth-title"
            className={`auth-panel__title ${
              isRegistering ? 'auth-panel__title--register' : 'auth-panel__title--login'
            } ${isFormSwitching ? 'is-switching' : ''}`}
          >
            {isRegistering ? (
              <>
                ثبت نام در <span>تپش</span>
              </>
            ) : (
              <>
                من عضو تپش هستم
                <br />
                چون{' '}
                <span
                  className={`auth-animated-phrase auth-animated-phrase--${authAnimatedPhrases[animatedPhraseIndex].accent}`}
                  aria-live="polite"
                >
                  {animatedPhrase}
                  <span className="auth-typewriter__cursor" aria-hidden="true" />
                </span>
              </>
            )}
          </h1>

          <form
            className={`auth-form ${isFormSwitching ? 'is-switching' : ''}`}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="auth-form__fields">
              <label htmlFor="auth-phone">شماره تلفن</label>
              <input
                id="auth-phone"
                name="phone"
                className={fieldErrors.phone ? 'is-error' : ''}
                type="tel"
                inputMode="tel"
                placeholder="مثلا: ۰۹۱۲۳۴۵۶۷۸۹"
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'auth-phone-error' : undefined}
                onChange={() => clearFieldError('phone')}
                required
              />
              {fieldErrors.phone && (
                <span className="auth-form__error" id="auth-phone-error" role="alert">
                  {fieldErrors.phone}
                </span>
              )}

              <label htmlFor="auth-password">رمز عبور</label>
              <input
                id="auth-password"
                name="password"
                className={fieldErrors.password ? 'is-error' : ''}
                type="password"
                placeholder="رمز عبور"
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                onChange={() => clearFieldError('password')}
                required
              />
              {fieldErrors.password && (
                <span className="auth-form__error" id="auth-password-error" role="alert">
                  {fieldErrors.password}
                </span>
              )}

              {isRegistering && (
                <>
                  <label htmlFor="auth-password-confirm">تکرار رمز عبور</label>
                  <input
                    id="auth-password-confirm"
                    name="password-confirm"
                    className={fieldErrors['password-confirm'] ? 'is-error' : ''}
                    type="password"
                    placeholder="تکرار رمز عبور"
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors['password-confirm'])}
                    aria-describedby={
                      fieldErrors['password-confirm']
                        ? 'auth-password-confirm-error'
                        : undefined
                    }
                    onChange={() => clearFieldError('password-confirm')}
                    required
                  />
                  {fieldErrors['password-confirm'] && (
                    <span
                      className="auth-form__error"
                      id="auth-password-confirm-error"
                      role="alert"
                    >
                      {fieldErrors['password-confirm']}
                    </span>
                  )}
                </>
              )}

              {!isRegistering && (
                <button className="auth-form__forgot" type="button">
                  فراموشی رمز / ارسال پیامک
                </button>
              )}
            </div>

            <div className="auth-form__actions">
              <button className="auth-form__submit" type="submit">
                {isRegistering ? 'ثبت نام' : 'ورود'}
              </button>

              {/*
                یک دکمه برای هر دو حالت ورود و ثبت‌نام: گوگل خودش می‌فهمد حساب
                هست یا نه (`prompt=select_account`)، پس جدا کردنشان فقط دو
                دکمهٔ بی‌تفاوت می‌ساخت.
              */}
              <button
                className={`auth-form__google${isGoogleReady ? '' : ' is-unavailable'}`}
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGooglePending}
                aria-busy={isGooglePending}
              >
                <GoogleIcon />
                <span>
                  {isGooglePending ? 'در حال ورود با گوگل…' : 'ورود / ثبت نام با گوگل'}
                </span>
              </button>

              {googleNote && (
                <p className="auth-form__google-note" role="status">
                  {googleNote}
                </p>
              )}

              <button className="auth-form__switch" type="button" onClick={switchMode}>
                {isRegistering ? 'ورود' : 'ثبت نام'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

/*
 * لنگرهای داخلی لایهٔ تعرفه‌ها. نگاشت صریح است، نه حدس پیشوندی — چون پیشوند
 * `#pr-` با هیچ مسیر دیگری شریک نیست ولی تکیه بر پیشوند همان تلهٔ تأییدشدهٔ
 * پروژه است (دو آیتم هم‌زمان فعال می‌شوند). هر لنگر تازه باید این‌جا اضافه شود.
 */
const PRICING_HASHES = new Set(['#pricing', '#pr-products', '#pr-plans', '#pr-compare']);
/* صفحهٔ محصولات یک مسیر تک‌لنگر است: `#products` */
const PRODUCTS_HASHES = new Set(['#products']);
/* صفحهٔ «دربارهٔ تپش» هم مسیر تک‌لنگر است: `#about` */
const ABOUT_HASHES = new Set(['#about']);
/*
 * صفحهٔ اشتراک گروهی: `#group`. لینک دعوت هم از همین مسیر می‌آید
 * (`#group?join=CODE`) و کد را در query می‌آورد تا فرمِ پیوستن خودش پُر شود —
 * پس برخلاف سه لایهٔ دیگر، تطبیق **دقیق** کافی نیست و پیشوند هم لازم است.
 * هیچ مسیر دیگری با `#group` شروع نمی‌شود، پس پیشوند امن است.
 * ⚠️ خودِ مسیر از سرویس گروه می‌آید (`GROUP_PAGE_HASH`) تا کارتِ صفحهٔ اصلی،
 * CTA پلن گروهی در تعرفه‌ها و این روتر هر سه یک رشته را بخوانند.
 */
const GROUP_HASH = GROUP_PAGE_HASH;
/* مقصد واحد Green Path — از شناسهٔ روتر ساخته می‌شود تا لینک عمومی و داشبورد جدا نشوند. */
const GREEN_PATH_DASHBOARD_HASH = dashboardRouteHash({ layer: LAYER_IDS.greenPath });

/*
 * مقصد هر یک از پنج کارتِ دورهٔ صفحهٔ اصلی. از همان نگاشت داشبورد (`COURSE_LAYERS`)
 * ساخته می‌شود؛ اگر روزی مقصد یک دوره عوض شود، کارت صفحهٔ اصلی و کارت داشبورد با هم
 * عوض می‌شوند. رشتهٔ دستی این‌جا نوشته نمی‌شود (تلهٔ ۱۰ فایل README).
 */
function courseDashboardHash(courseId) {
  const layerId = COURSE_LAYERS[courseId];
  return layerId ? dashboardRouteHash({ layer: layerId }) : null;
}

/*
 * ── مقصدهای فوتر ──
 *
 * هر عنوانِ فوتر به لایهٔ واقعیِ خودش می‌رسد، نه به یک لنگرِ بی‌ربط (تلهٔ ۱۰).
 * آدرس‌ها از `dashboardRouteHash` + `LAYER_IDS` ساخته می‌شوند، پس با تغییر نام یک
 * لایه هیچ لینکی بی‌صدا از کار نمی‌افتد. تنها مقصد غیرِداشبوردی «مقالات» است که
 * مسیر مستقل خودش را دارد و «علوم پایه» که به صفحهٔ محصولات می‌رود.
 *
 * چرا `export`: مثل `homePromoCards`، هارنس از همین دو جدول می‌سنجد که هر مقصد
 * یک لایهٔ واقعی است — چیزی که در HTML به‌تنهایی قابل اثبات نیست.
 */
export const FOOTER_PRODUCT_LINKS = [
  { title: 'درسنامه جامع', href: dashboardRouteHash({ section: 'courses', layer: LAYER_IDS.comprehensive }) },
  { title: 'میکرو درسنامه', href: dashboardRouteHash({ section: 'courses', layer: LAYER_IDS.micro }) },
  { title: 'بانک تست', href: dashboardRouteHash({ section: 'tests', layer: LAYER_IDS.testBank }) },
  { title: 'دستیار هوشمند', href: dashboardRouteHash({ section: 'other', layer: LAYER_IDS.ai }) },
  { title: 'مسیر سبز', href: GREEN_PATH_DASHBOARD_HASH },
];

export const FOOTER_SECTION_LINKS = [
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
export const homePromoCards = [
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

function getAppRoute() {
  if (typeof window === 'undefined') return 'home';

  const { hash } = window.location;

  /* اولویت با hash است تا ناوبری داخل سشن (مثل داشبورد → مقالات)، state قدیمی را باطل کند */
  /* داشبورد مسیر داخلی خودش را در query همان hash نگه می‌دارد: #dashboard?s=tests&l=test-bank */
  if (hash === '#dashboard' || hash.startsWith('#dashboard?') || hash.startsWith('#dashboard/')) {
    return 'dashboard';
  }
  if (hash === '#onboarding') return 'onboarding';
  if (hash === '#auth') return 'auth';
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

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [authOpen, setAuthOpen] = useState(
    () => getAppRoute() === 'auth',
  );
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
  const [userData, setUserData] = useState(() => getStoredUser());
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

  /* هویت کاربر با ورود/خروج عوض می‌شود؛ فقط شبه‌نام یک‌طرفه به سرور می‌رود */
  useEffect(() => {
    identify(userData);
  }, [userData]);

  const closeMenu = () => setMenuOpen(false);
  const openAuth = (event) => {
    /* رویداد اختیاری است: مسیرهایی مثل کادرهای تبلیغی محصولات بدون کلیک هم به ورود می‌فرستند */
    event?.preventDefault();
    closeMenu();
    window.history.pushState(
      getRouteState('auth'),
      '',
      getRouteUrl('auth'),
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
    const updatedUser = await saveUserRecord({
      phone: userData?.phone,
      profile,
    });
    const destination = pendingDashboardHash;
    setPendingDashboardHash(null);
    openDashboard(updatedUser, { hash: destination });
  };

  /* خروج از حساب: فقط سشن پاک می‌شود تا حساب کاربر برای ورود بعدی باقی بماند */
  const handleLogout = () => {
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
    return <AdminLayout onExit={closeAdmin} />;
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
    return (
      <DashboardLayout
        userData={userData}
        onUserDataChange={setUserData}
        onLogout={handleLogout}
      />
    );
  }

  if (authOpen) {
    return (
      <AuthPage
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

        <SiteFooter />
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

        <SiteFooter />
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

        <SiteFooter />
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

        <SiteFooter />
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

        <SiteFooter />
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
            <a className="button button--primary" href="#products">
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
              <a className="button button--blue" href="#products">
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

      <SiteFooter />

      <MotionStrip />
    </div>
  );
}

export default App;
