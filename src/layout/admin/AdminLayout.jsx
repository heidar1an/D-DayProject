/*
 * پوستهٔ پنل مدیریت — دروازهٔ احراز هویت + چیدمان + روتر داخلی.
 *
 * روتر داخلی دقیقاً همان قرارداد بقیهٔ لایه‌های پروژه است: یک state به شکل
 * `{ name, payload }`. برای اینکه رفرش صفحه بخش جاری را از دست ندهد، همین state
 * با hash آدرس (`#admin/articles`) هم‌گام نگه داشته می‌شود؛ اما منبع حقیقت state است.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { auth, getMeta } from '../../services/admin/adminService';
import AdminLogin from './AdminLogin';
import AdminDashboard from './views/AdminDashboard';
import AdminArticles from './views/AdminArticles';
import AdminContentEditor from './views/AdminContentEditor';
import AdminCategories from './views/AdminCategories';
import AdminPages from './views/AdminPages';
import AdminMedia from './views/AdminMedia';
import AdminBanners from './views/AdminBanners';
import AdminUsers from './views/AdminUsers';
import AdminSettings from './views/AdminSettings';
import AdminLogs from './views/AdminLogs';
import AdminNotes from './views/AdminNotes';
import AdminProfile from './views/AdminProfile';
import AnalyticsCenter from './analytics/AnalyticsCenter';
import {
  Button, Spinner, ToastProvider, faDate, toFa, useToast,
} from './adminShared';
import {
  IconAnalytics, IconArticle, IconBanner, IconDashboard, IconLog, IconLogout, IconMedia,
  IconMenu, IconNote, IconPage, IconSettings, IconTag, IconUser,
} from './adminIcons';

const SECTIONS = [
  { id: 'dashboard', label: 'داشبورد', icon: IconDashboard, permission: null },
  { id: 'analytics', label: 'مرکز تحلیل', icon: IconAnalytics, permission: 'analytics.read' },
  { id: 'articles', label: 'مقالات', icon: IconArticle, permission: 'articles.read' },
  { id: 'categories', label: 'دسته‌بندی‌ها', icon: IconTag, permission: 'articles.read' },
  { id: 'pages', label: 'صفحات', icon: IconPage, permission: 'pages.read' },
  { id: 'media', label: 'کتابخانهٔ رسانه', icon: IconMedia, permission: 'media.read' },
  { id: 'banners', label: 'بنرها', icon: IconBanner, permission: 'articles.read' },
  { id: 'users', label: 'کاربران و نقش‌ها', icon: IconUser, permission: 'users.read' },
  { id: 'settings', label: 'تنظیمات سایت', icon: IconSettings, permission: 'settings.read' },
  { id: 'logs', label: 'گزارش رویدادها', icon: IconLog, permission: 'logs.read' },
  { id: 'notes', label: 'یادداشت‌ها', icon: IconNote, permission: 'notes.read' },
];

const SECTION_IDS = new Set(SECTIONS.map((section) => section.id));

/* `#admin` یا `#admin/articles` یا `#admin/analytics/traffic` یا `#admin/articles/art-1234` */
function parseHashView() {
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  const match = hash.match(/^#admin(?:\/([a-z-]+))?(?:\/([^/]+))?$/);
  if (!match) return { name: 'dashboard', payload: null };

  const section = match[1];
  if (!section || !SECTION_IDS.has(section)) return { name: 'dashboard', payload: null };

  /* مرکز تحلیل: پاراگراف دوم نام تب است (`#admin/analytics/traffic`) */
  if (section === 'analytics') {
    return { name: 'analytics', payload: match[2] ? { tab: match[2] } : null };
  }

  /* در بخش مقالات، پاراگراف دوم شناسهٔ مقاله برای ویرایش است */
  if (section === 'articles' && match[2]) return { name: 'article-editor', payload: { id: match[2] } };

  return { name: section, payload: null };
}

function AdminShell({ admin, onExit, onLogout }) {
  const notify = useToast();
  const [view, setView] = useState(() => parseHashView());
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const can = useCallback(
    (permission) => !permission || admin.permissions?.includes(permission),
    [admin.permissions],
  );

  const navigate = useCallback((name, payload = null) => {
    setView({ name, payload });
    setSidebarOpen(false);

    const hash = name === 'article-editor' && payload?.id
      ? `#admin/articles/${payload.id}`
      : name === 'page-editor' && payload?.id
        ? `#admin/pages/${payload.id}`
        : name === 'analytics' && payload?.tab
          ? `#admin/analytics/${payload.tab}`
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
    const section = SECTIONS.find((item) => item.id === view.name);
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
      case 'articles':
        return <AdminArticles {...editorProps} />;
      case 'article-editor':
        return <AdminContentEditor {...editorProps} kind="article" id={view.payload?.id ?? null} />;
      case 'pages':
        return <AdminPages {...editorProps} />;
      case 'page-editor':
        return <AdminContentEditor {...editorProps} kind="page" id={view.payload?.id ?? null} />;
      case 'categories':
        return <AdminCategories {...editorProps} />;
      case 'media':
        return <AdminMedia {...editorProps} />;
      case 'banners':
        return <AdminBanners {...editorProps} />;
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
      <aside className={`ad-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="ad-sidebar__brand">
          <span className="ad-sidebar__logo" aria-hidden="true">ت</span>
          <div>
            <strong>تپش</strong>
            <small>پنل مدیریت محتوا</small>
          </div>
        </div>

        <nav className="ad-nav" aria-label="بخش‌های پنل">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            const isActive = view.name === section.id || view.name.startsWith(`${section.id}-`);

            return (
              <button
                type="button"
                key={section.id}
                className={`ad-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => navigate(section.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon width={18} height={18} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ad-sidebar__foot">
          <button type="button" className="ad-nav__item" onClick={() => navigate('profile')}>
            <IconUser width={18} height={18} />
            <span>حساب من</span>
          </button>
          <button type="button" className="ad-nav__item" onClick={onExit}>
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
          <button
            type="button"
            className="ad-iconbtn ad-header__menu"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label="منو"
          >
            <IconMenu />
          </button>

          <div className="ad-header__title">
            <h1>{view.name === 'profile' ? 'حساب من' : SECTIONS.find((s) => s.id === view.name)?.label ?? 'ویرایش محتوا'}</h1>
            <p>{meta ? `آخرین ورود: ${faDate(admin.lastLoginAt)}` : 'در حال آماده‌سازی…'}</p>
          </div>

          <div className="ad-header__user">
            <span className="ad-avatar" aria-hidden="true">{(admin.name || admin.username).slice(0, 1)}</span>
            <span className="ad-header__userinfo">
              <strong>{admin.name || admin.username}</strong>
              <small>{admin.roleLabel}{admin.permissions?.length ? ` · ${toFa(admin.permissions.length)} دسترسی` : ''}</small>
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <IconLogout width={16} height={16} />
              خروج
            </Button>
          </div>
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
