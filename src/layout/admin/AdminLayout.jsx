/*
 * پوستهٔ پنل مدیریت — دروازهٔ احراز هویت + چیدمان + روتر داخلی.
 *
 * روتر داخلی دقیقاً همان قرارداد بقیهٔ لایه‌های پروژه است: یک state به شکل
 * `{ name, payload }`. برای اینکه رفرش صفحه بخش جاری را از دست ندهد، همین state
 * با hash آدرس (`#admin/pages`) هم‌گام نگه داشته می‌شود؛ اما منبع حقیقت state است.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import logoMark from '../../../images/pictures/600ppi/logo-mark.webp';
import { auth, getMeta } from '../../services/admin/adminService';
import ThemeToggle from '../ThemeToggle';
import AdminLogin from './AdminLogin';
import AdminDashboard from './views/AdminDashboard';
import AdminContentEditor from './views/AdminContentEditor';
import AdminPages from './views/AdminPages';
import AdminFlashcards from './views/AdminFlashcards';
import AdminReferences from './views/AdminReferences';
import AdminArticleLibrary from './views/AdminArticleLibrary';
import AdminMicro from './views/AdminMicro';
import AdminTestBank from './views/AdminTestBank';
import AdminComprehensive from './views/AdminComprehensive';
import AdminMedia from './views/AdminMedia';
import AdminPublishing from './views/AdminPublishing';
import AdminUsers from './views/AdminUsers';
import AdminSettings from './views/AdminSettings';
import AdminLogs from './views/AdminLogs';
import AdminNotes from './views/AdminNotes';
import AdminProfile from './views/AdminProfile';
import AnalyticsCenter from './analytics/AnalyticsCenter';
import MediaCenter, { MEDIA_TAB_IDS } from './media/MediaCenter';
import {
  Button, Spinner, ToastProvider, faDate, toFa, useToast,
} from './adminShared';
import {
  IconAnalytics, IconBroadcast, IconChevron, IconDashboard, IconLog,
  IconLogout, IconMedia, IconMenu, IconNote, IconPage, IconSend, IconSettings, IconUser,
} from './adminIcons';

const SECTIONS = [
  { id: 'dashboard', label: 'داشبورد', icon: IconDashboard, permission: null },
  { id: 'analytics', label: 'مرکز تحلیل', icon: IconAnalytics, permission: 'analytics.read' },
  { id: 'media-center', label: 'مدیریت رسانه و فضای مجازی', icon: IconBroadcast, permission: 'media.read' },
  { id: 'pages', label: 'صفحات', icon: IconPage, permission: 'pages.read' },
  { id: 'media', label: 'کتابخانهٔ رسانه', icon: IconMedia, permission: 'media.read' },
  { id: 'publishing', label: 'انتشار در کانال‌ها', icon: IconSend, permission: 'publishing.read' },
  { id: 'users', label: 'کاربران و نقش‌ها', icon: IconUser, permission: 'users.read' },
  { id: 'settings', label: 'تنظیمات سایت', icon: IconSettings, permission: 'settings.read' },
  { id: 'logs', label: 'گزارش رویدادها', icon: IconLog, permission: 'logs.read' },
  { id: 'notes', label: 'یادداشت‌ها', icon: IconNote, permission: 'notes.read' },
];

const SECTION_IDS = new Set(SECTIONS.map((section) => section.id));

/*
 * نماهایی که از راه hash باز می‌شوند ولی آیتم سایدبار نیستند.
 *
 * «کتابخانهٔ فلش‌کارت تپش»، «مراجع تپش» و «میکرو درسنامه تپش» سه لایهٔ داخل
 * پنل‌اند که از کارت‌های همان لایه‌ها در بخش «صفحات» باز می‌شوند. بدون افزودنشان
 * به این مجموعه، `#admin/flashcard-library` و `#admin/reference-library` و
 * `#admin/micro-lesson` ناشناخته می‌مانند و مستقیم به داشبورد برمی‌گشتند
 * (رفرش، بخش را از دست می‌داد).
 */
const ROUTABLE_VIEWS = new Set([...SECTION_IDS, 'flashcard-library', 'reference-library', 'article-library', 'micro-lesson', 'test-bank-library', 'comprehensive-library']);

/*
 * زیرنمایش‌هایی که شناسه‌شان با بخش مادرشان یکی نیست.
 *
 * قبلاً تشخیص آیتم فعال با پیشوند انجام می‌شد (`view.name.startsWith('media-')`)
 * و همین باعث یک باگ می‌شد: `media-center` با `media-` شروع می‌شود، پس باز کردن
 * «مدیریت رسانه و فضای مجازی» آیتم «کتابخانهٔ رسانه» را هم هم‌زمان فعال می‌کرد.
 * نگاشت صریح جای حدس پیشوندی را می‌گیرد.
 */
const SECTION_SUBVIEWS = {
  'page-editor': 'pages',
  'flashcard-library': 'pages',
  'reference-library': 'pages',
  'article-library': 'pages',
  'micro-lesson': 'pages',
  'test-bank-library': 'pages',
  'comprehensive-library': 'pages',
};

/* نام هر نمایش → شناسهٔ بخشی که به آن تعلق دارد */
function sectionOf(viewName) {
  return SECTION_SUBVIEWS[viewName] ?? viewName;
}

/* عنوان سرصفحه برای نماهایی که آیتم سایدبار ندارند */
const VIEW_TITLES = {
  'page-editor': 'ویرایش محتوا',
  'flashcard-library': 'کتابخانهٔ فلش‌کارت تپش',
  'reference-library': 'مراجع تپش',
  'article-library': 'مقالات تپش',
  'micro-lesson': 'میکرو درسنامه تپش',
  'test-bank-library': 'بانک تست علوم پایه',
  'comprehensive-library': 'درسنامه جامع علوم پایه',
};

/* `#admin` یا `#admin/pages` یا `#admin/analytics/traffic` یا `#admin/pages/page-1234` */
function parseHashView() {
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  const match = hash.match(/^#admin(?:\/([a-z-]+))?(?:\/([^/]+))?$/);
  if (!match) return { name: 'dashboard', payload: null };

  const section = match[1];
  if (!section || !ROUTABLE_VIEWS.has(section)) return { name: 'dashboard', payload: null };

  /* مرکز تحلیل: پاراگراف دوم نام تب است (`#admin/analytics/traffic`) */
  if (section === 'analytics') {
    return { name: 'analytics', payload: match[2] ? { tab: match[2] } : null };
  }

  /* مرکز رسانه: پاراگراف دوم نام تب است (`#admin/media-center/overview`) */
  if (section === 'media-center') {
    return { name: 'media-center', payload: match[2] ? { tab: MEDIA_TAB_IDS.has(match[2]) ? match[2] : 'overview' } : null };
  }

  return { name: section, payload: null };
}

/*
 * پوستهٔ پنل بعد از احراز هویت.
 *
 * به‌صورت named export می‌آید تا در بررسی بدون مرورگر بتوان همین پوسته را با یک
 * مدیر جعلی رندر کرد و چیدمان/وضعیت فعال سایدبار را سنجید — بدون رد شدن از
 * `AdminLayout` که برای پر شدن نشست به افکت (و در نتیجه DOM) نیاز دارد.
 */
export function AdminShell({ admin, onExit, onLogout }) {
  const notify = useToast();
  const [view, setView] = useState(() => parseHashView());
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  /* کشوی موبایل (`is-open`) و ریل جمع‌شوی دسکتاپ (`is-collapsed`) دو چیز جدااند:
     اولی فقط زیر ۸۶۱px معنا دارد، دومی فقط بالای آن. */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const can = useCallback(
    (permission) => !permission || admin.permissions?.includes(permission),
    [admin.permissions],
  );

  const navigate = useCallback((name, payload = null) => {
    setView({ name, payload });
    setSidebarOpen(false);

    const hash = name === 'page-editor' && payload?.id
      ? `#admin/pages/${payload.id}`
      : name === 'analytics' && payload?.tab
        ? `#admin/analytics/${payload.tab}`
        : name === 'media-center' && payload?.tab
          ? `#admin/media-center/${payload.tab}`
          : `#admin/${name}`;

    if (window.location.hash !== hash) {
      window.history.replaceState(window.history.state, '', hash);
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    let alive = true;

    getMeta()
      .then((data) => { if (alive) setMeta(data); })
      .catch((error) => { if (alive) setMetaError(error); });

    return () => { alive = false; };
  }, []);

  /*
   * پشتیبانی از دکمه‌های back/forward مرورگر و لینک مستقیم.
   * `navigate` از replaceState استفاده می‌کند (رویداد hashchange نمی‌دهد)، پس این
   * شنونده فقط وقتی فعال می‌شود که واقعاً آدرس از بیرون عوض شده باشد.
   */
  useEffect(() => {
    const syncFromHash = () => {
      const next = parseHashView();
      setView((current) => (
        current.name === next.name
        && current.payload?.id === next.payload?.id
        && current.payload?.tab === next.payload?.tab
          ? current
          : next
      ));
    };

    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  /* اگر کاربر مستقیماً روی بخشی بدون دسترسی نشسته باشد، به داشبورد برگردد */
  useEffect(() => {
    const section = SECTIONS.find((item) => item.id === sectionOf(view.name));
    if (section && !can(section.permission)) navigate('dashboard');
  }, [view.name, can, navigate]);

  const visibleSections = useMemo(() => SECTIONS.filter((section) => can(section.permission)), [can]);

  const categories = meta?.categories ?? [];
  const roles = meta?.roles ?? [];

  const editorProps = { admin, meta, navigate, categories, roles, onExit };

  const renderView = () => {
    switch (view.name) {
      case 'analytics':
        return (
          <AnalyticsCenter
            admin={admin}
            tab={view.payload?.tab ?? null}
            onTabChange={(tab) => navigate('analytics', { tab })}
          />
        );
      case 'media-center':
        return (
          <MediaCenter
            admin={admin}
            tab={view.payload?.tab ?? 'overview'}
            onTabChange={(tab) => navigate('media-center', { tab })}
          />
        );
      case 'pages':
        return <AdminPages {...editorProps} />;
      case 'flashcard-library':
        return <AdminFlashcards admin={admin} onBack={() => navigate('pages')} />;
      case 'reference-library':
        return <AdminReferences admin={admin} onBack={() => navigate('pages')} />;
      case 'article-library':
        return <AdminArticleLibrary admin={admin} onBack={() => navigate('pages')} />;
      case 'micro-lesson':
        return <AdminMicro admin={admin} onBack={() => navigate('pages')} />;
      case 'test-bank-library':
        return <AdminTestBank admin={admin} onBack={() => navigate('pages')} />;
      case 'comprehensive-library':
        return <AdminComprehensive admin={admin} onBack={() => navigate('pages')} />;
      case 'page-editor':
        return <AdminContentEditor {...editorProps} kind="page" id={view.payload?.id ?? null} />;
      case 'media':
        return <AdminMedia {...editorProps} />;
      case 'publishing':
        return <AdminPublishing {...editorProps} />;
      case 'users':
        return <AdminUsers {...editorProps} />;
      case 'settings':
        return <AdminSettings {...editorProps} />;
      case 'logs':
        return <AdminLogs {...editorProps} />;
      case 'notes':
        return <AdminNotes {...editorProps} />;
      case 'profile':
        return <AdminProfile admin={admin} navigate={navigate} />;
      default:
        return <AdminDashboard {...editorProps} />;
    }
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch {
      /* حتی اگر سرور پاسخ نداد، نشست محلی بسته می‌شود */
    }
    notify('از پنل خارج شدید');
    onLogout?.();
  };

  return (
    <div className="ad-root" dir="rtl">
      <aside
        id="ad-sidebar"
        className={`ad-sidebar ${sidebarOpen ? 'is-open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}
      >
        <div className="ad-sidebar__brand">
          <span className="ad-sidebar__logo" aria-hidden="true">
            <img src={logoMark} alt="" />
          </span>
          <div>
            <strong>تپش</strong>
            <small>پنل مدیریت محتوا</small>
          </div>
        </div>

        <nav className="ad-nav" aria-label="بخش‌های پنل">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            const isActive = sectionOf(view.name) === section.id;

            return (
              <button
                type="button"
                key={section.id}
                className={`ad-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => navigate(section.id)}
                aria-current={isActive ? 'page' : undefined}
                /* فقط در حالت جمع، عنوان را به‌صورت راهنمای شناور نشان بده؛
                   در حالت باز خودِ برچسب کنار آیکون هست و راهنما تکراری می‌شود. */
                title={sidebarCollapsed ? section.label : undefined}
              >
                <Icon width={18} height={18} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ad-sidebar__foot">
          {/* کلید جمع/باز کردن نوار — فقط روی دسکتاپ کار می‌کند (زیر ۸۶۱px پنهان است،
              چون آن‌جا نوار اصلاً کشوی روی‌هم‌افتاده است و ریلی وجود ندارد). */}
          <button
            type="button"
            className="ad-nav__item ad-sidebar__collapse"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-expanded={!sidebarCollapsed}
            aria-controls="ad-sidebar"
            title={sidebarCollapsed ? 'باز کردن منو' : undefined}
          >
            <IconChevron
              width={18}
              height={18}
              style={{ transform: sidebarCollapsed ? 'none' : 'rotate(180deg)' }}
            />
            <span>{sidebarCollapsed ? 'باز کردن منو' : 'جمع کردن منو'}</span>
          </button>

          {/*
           * حساب کاربری — از هدر به کادر سمت راست («حساب من» در فوتر نوار کناری)
           * منتقل شد. خودِ بلوک به «حساب من» می‌رود و دکمهٔ خروج کنارش می‌نشیند؛
           * دو دکمهٔ جدا هستند چون دکمهٔ تودرتو در HTML مجاز نیست.
           */}
          <div className="ad-account">
            <button
              type="button"
              className={`ad-account__open ${sectionOf(view.name) === 'profile' ? 'is-active' : ''}`}
              onClick={() => navigate('profile')}
              title={sidebarCollapsed ? 'حساب من' : undefined}
            >
              <span className="ad-avatar" aria-hidden="true">{(admin.name || admin.username).slice(0, 1)}</span>
              <span className="ad-account__meta">
                <strong>{admin.name || admin.username}</strong>
                <small>{admin.roleLabel}{admin.permissions?.length ? ` · ${toFa(admin.permissions.length)} دسترسی` : ''}</small>
              </span>
            </button>

            <button
              type="button"
              className="ad-iconbtn"
              onClick={handleLogout}
              title="خروج"
              aria-label="خروج"
            >
              <IconLogout width={16} height={16} />
            </button>
          </div>

          <button
            type="button"
            className="ad-nav__item"
            onClick={() => navigate('profile')}
            title={sidebarCollapsed ? 'حساب من' : undefined}
          >
            <IconUser width={18} height={18} />
            <span>حساب من</span>
          </button>
          <button
            type="button"
            className="ad-nav__item"
            onClick={onExit}
            title={sidebarCollapsed ? 'بازگشت به سایت' : undefined}
          >
            <IconPage width={18} height={18} />
            <span>بازگشت به سایت</span>
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button type="button" className="ad-scrim" aria-label="بستن منو" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <div className="ad-main">
        <header className="ad-header">
          {/* کلید کشوی موبایل — فقط زیر ۸۶۱px دیده می‌شود (`.ad-iconbtn.ad-header__menu`
              قاعدهٔ `display: none` را می‌برد؛ قبلاً استایل پایهٔ دکمهٔ آیکونی آن را
              باطل می‌کرد و آیکون در همهٔ عرض‌ها کنار عنوان می‌ایستاد). */}
          <button
            type="button"
            className="ad-iconbtn ad-header__menu"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label="منو"
          >
            <IconMenu />
          </button>

          {/* عنوان بخش و «آخرین ورود» هم‌ردیف‌اند؛ بلوک حساب کاربری به فوتر نوار
              کناری (کادر سمت راست) منتقل شده است. */}
          <div className="ad-header__title">
            <h1>{view.name === 'profile' ? 'حساب من' : (VIEW_TITLES[view.name] ?? SECTIONS.find((s) => s.id === view.name)?.label ?? 'ویرایش محتوا')}</h1>
            <p>{meta ? `آخرین ورود: ${faDate(admin.lastLoginAt)}` : 'در حال آماده‌سازی…'}</p>
          </div>

          <ThemeToggle className="ad-header__theme" />
        </header>

        <main className="ad-content">
          {metaError ? (
            <div className="ad-error" role="alert">
              <strong>اطلاعات پایهٔ پنل دریافت نشد</strong>
              <p>{metaError.message}</p>
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>تلاش دوباره</Button>
            </div>
          ) : null}

          {!meta && !metaError ? (
            <div className="ad-boot"><Spinner /> در حال آماده‌سازی پنل…</div>
          ) : (
            renderView()
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ onExit }) {
  const [admin, setAdmin] = useState(null);
  const [booting, setBooting] = useState(true);

  /* بازیابی نشست: اگر کوکی معتبر باشد، مستقیم وارد پنل می‌شویم */
  useEffect(() => {
    let alive = true;

    auth.me()
      .then((data) => { if (alive) setAdmin(data); })
      .catch(() => { if (alive) setAdmin(null); })
      .finally(() => { if (alive) setBooting(false); });

    return () => { alive = false; };
  }, []);

  if (booting) {
    return (
      <div className="ad-root ad-root--center" dir="rtl">
        <div className="ad-boot"><Spinner /> در حال بررسی نشست…</div>
      </div>
    );
  }

  if (!admin) {
    return (
      <ToastProvider>
        <AdminLogin onSuccess={setAdmin} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AdminShell admin={admin} onExit={onExit} onLogout={() => setAdmin(null)} />
    </ToastProvider>
  );
}
