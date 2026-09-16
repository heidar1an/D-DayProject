/*
 * مرکز رسانه و فضای مجازی تپش — پوستهٔ بخش.
 *
 * این لایه *داخل* پوستهٔ پنل مدیریت زندگی می‌کند و همان قرارداد روتر پروژه را
 * دنبال می‌کند: تب فعال در `#admin/media-center/<tab>` می‌نشیند، پس رفرش،
 * Back و Forward کار می‌کنند و لینک مستقیم به هر تب ممکن است.
 *
 * یک قاعدهٔ مهم: هر سنجه یا از دادهٔ واقعی می‌آید یا `null` می‌ماند. این پوسته
 * هیچ عددی نمی‌سازد و هیچ‌جا «۰» را جای «نامعلوم» نمی‌گذارد.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { mediaCenter } from '../../../services/admin/adminService';
import {
  IconAnalytics, IconArchive, IconArticle, IconBroadcast, IconCalendar, IconCampaign,
  IconDashboard, IconHashtag, IconImage, IconInbox, IconLog, IconQueue, IconRefresh,
  IconReport, IconSend, IconSettings, IconTag, IconTeam, IconUtm, IconWarning,
} from '../adminIcons';

import {
  CentralSearch, RangePicker, SkeletonCards, ErrorBlock, Pill, toFa,
  useLoader,
} from './mediaKit';

import OverviewSection from './sections/OverviewSection';
import PlatformsSection from './sections/PlatformsSection';
import AccountsSection from './sections/AccountsSection';
import CalendarSection from './sections/CalendarSection';
import ContentSection from './sections/ContentSection';
import QueueSection from './sections/QueueSection';
import CampaignsSection from './sections/CampaignsSection';
import LibrarySection from './sections/LibrarySection';
import TeamSection from './sections/TeamSection';
import InboxSection from './sections/InboxSection';
import ListeningSection from './sections/ListeningSection';
import AnalyticsSection from './sections/AnalyticsSection';
import TagsSection from './sections/TagsSection';
import UtmSection from './sections/UtmSection';
import ReportsSection from './sections/ReportsSection';
import NotificationsSection from './sections/NotificationsSection';
import AuditSection from './sections/AuditSection';
import SettingsSection from './sections/SettingsSection';
import PublishingSection from './sections/PublishingSection';

/*
 * ترتیب تب‌ها همان ترتیب پرامپت است: داشبورد → پلتفرم → اکانت → محتوا →
 * کمپین → کتابخانه → تیم → اینباکس → تحلیل → هشتگ → UTM → گزارش → رویداد →
 * تنظیمات. تب‌های «صف انتشار»، «رصد نام» و «اعلان‌ها» بخش‌های فرعی همان
 * پرامپت هستند که جای مستقل گرفته‌اند تا شلوغ نشوند.
 *
 * `permission` هر تب با `media.read` شروع می‌شود؛ فقط دو تب استثنا دارند:
 * گزارش رویدادها مجوز مستقل می‌خواهد و «انتشار در کانال‌ها» همان مجوز بخش
 * انتشار را نگه می‌دارد تا با پنل موجود یکی بماند.
 */
export const MEDIA_TABS = [
  { id: 'overview', label: 'نمای کلی', icon: IconDashboard, permission: 'media.read' },
  { id: 'platforms', label: 'پلتفرم‌ها', icon: IconBroadcast, permission: 'media.read' },
  { id: 'accounts', label: 'اکانت‌ها و کانال‌ها', icon: IconTeam, permission: 'media.read' },
  { id: 'calendar', label: 'تقویم محتوا', icon: IconCalendar, permission: 'media.read' },
  { id: 'content', label: 'مدیریت محتوا', icon: IconArticle, permission: 'media.read' },
  { id: 'queue', label: 'صف انتشار', icon: IconQueue, permission: 'media.read' },
  { id: 'campaigns', label: 'کمپین‌ها', icon: IconCampaign, permission: 'media.read' },
  { id: 'library', label: 'کتابخانهٔ رسانه', icon: IconImage, permission: 'media.read' },
  { id: 'team', label: 'تیم رسانه', icon: IconTeam, permission: 'media.read' },
  { id: 'inbox', label: 'اینباکس', icon: IconInbox, permission: 'media.read' },
  { id: 'listening', label: 'رصد نام', icon: IconHashtag, permission: 'media.read' },
  { id: 'analytics', label: 'تحلیل', icon: IconAnalytics, permission: 'media.read' },
  { id: 'tags', label: 'هشتگ و موضوع', icon: IconTag, permission: 'media.read' },
  { id: 'utm', label: 'مدیریت UTM', icon: IconUtm, permission: 'media.read' },
  { id: 'reports', label: 'گزارش‌ها', icon: IconReport, permission: 'media.read' },
  { id: 'notifications', label: 'اعلان‌ها', icon: IconWarning, permission: 'media.read' },
  { id: 'audit', label: 'گزارش رویدادها', icon: IconLog, permission: 'media.audit.read' },
  { id: 'publishing', label: 'انتشار در کانال‌ها', icon: IconSend, permission: 'publishing.read' },
  { id: 'settings', label: 'تنظیمات', icon: IconSettings, permission: 'media.read' },
];

export const MEDIA_TAB_IDS = new Set(MEDIA_TABS.map((tab) => tab.id));

/* تب‌هایی که انتخاب بازه رویشان اثر دارد */
const RANGE_TABS = new Set(['overview', 'analytics', 'reports', 'campaigns']);

/* شش اقدام سریع — همان‌هایی که پرامپت خواسته است */
const QUICK_ACTIONS = [
  { id: 'compose', label: 'ساخت محتوا', tab: 'content', icon: IconArticle },
  { id: 'campaign', label: 'کمپین جدید', tab: 'campaigns', icon: IconCampaign },
  { id: 'schedule', label: 'زمان‌بندی انتشار', tab: 'queue', icon: IconQueue },
  { id: 'platform', label: 'افزودن پلتفرم', tab: 'platforms', icon: IconBroadcast },
  { id: 'upload', label: 'بارگذاری فایل', tab: 'library', icon: IconImage },
  { id: 'report', label: 'گزارش جدید', tab: 'reports', icon: IconReport },
];

export default function MediaCenter({ admin, tab, onTabChange }) {
  const active = MEDIA_TAB_IDS.has(tab) ? tab : 'overview';

  const [range, setRange] = useState({ range: '30d', from: null, to: null });
  const [intent, setIntent] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const can = useCallback(
    (permission) => !permission || admin?.permissions?.includes(permission),
    [admin],
  );

  const config = useLoader(() => mediaCenter.config(), [refreshKey]);
  const summary = useLoader(() => mediaCenter.summary(), [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  /* تب‌هایی که کاربر دسترسی ندارد حذف می‌شوند، نه غیرفعال */
  const tabs = useMemo(() => MEDIA_TABS.filter((row) => can(row.permission)), [can]);

  const counts = useMemo(() => {
    const data = summary.data;
    if (!data) return {};
    return {
      accounts: data.accounts ?? null,
      content: (data.pendingReview ?? 0) + (data.failed ?? 0) || null,
      queue: data.scheduled ?? null,
      inbox: data.unreadInbox ?? null,
      notifications: data.unreadNotifications ?? null,
    };
  }, [summary.data]);

  const openTab = useCallback((nextTab, nextIntent = null) => {
    setIntent(nextIntent ? { ...nextIntent, nonce: Date.now() } : null);
    onTabChange?.(nextTab);
  }, [onTabChange]);

  const clearIntent = useCallback(() => setIntent(null), []);

  /* نتیجهٔ جست‌وجوی مرکزی به تب مربوطه می‌پرد */
  const handlePick = useCallback((item) => {
    const targets = {
      content: 'content',
      campaign: 'campaigns',
      account: 'accounts',
      platform: 'platforms',
      team: 'team',
      asset: 'library',
      tag: 'tags',
    };
    openTab(targets[item.target] ?? 'overview', { action: 'open', id: item.targetId });
  }, [openTab]);

  const sectionProps = {
    admin,
    can,
    config: config.data,
    summary: summary.data,
    range,
    setRange,
    intent,
    clearIntent,
    refresh,
    openTab,
  };

  const renderSection = () => {
    switch (active) {
      case 'platforms': return <PlatformsSection {...sectionProps} />;
      case 'accounts': return <AccountsSection {...sectionProps} />;
      case 'calendar': return <CalendarSection {...sectionProps} />;
      case 'content': return <ContentSection {...sectionProps} />;
      case 'queue': return <QueueSection {...sectionProps} />;
      case 'campaigns': return <CampaignsSection {...sectionProps} />;
      case 'library': return <LibrarySection {...sectionProps} />;
      case 'team': return <TeamSection {...sectionProps} />;
      case 'inbox': return <InboxSection {...sectionProps} />;
      case 'listening': return <ListeningSection {...sectionProps} />;
      case 'analytics': return <AnalyticsSection {...sectionProps} />;
      case 'tags': return <TagsSection {...sectionProps} />;
      case 'utm': return <UtmSection {...sectionProps} />;
      case 'reports': return <ReportsSection {...sectionProps} />;
      case 'notifications': return <NotificationsSection {...sectionProps} />;
      case 'audit': return <AuditSection {...sectionProps} />;
      case 'publishing': return <PublishingSection {...sectionProps} />;
      case 'settings': return <SettingsSection {...sectionProps} />;
      default: return <OverviewSection {...sectionProps} />;
    }
  };

  if (config.error) return <ErrorBlock error={config.error} onRetry={config.reload} />;
  if (!config.data) return <SkeletonCards count={6} />;

  const demo = config.data.demo === true || summary.data?.demo === true;

  return (
    <div className="mc-root">
      {/* ─── نوار کنترل: جست‌وجو، بازه، تب‌ها ─── */}
      <div className="mc-toolbar">
        <div className="mc-toolbar__top">
          <CentralSearch onSearch={(term) => mediaCenter.search(term)} onPick={handlePick} />

          <span className="mc-toolbar__spacer" />

          <button
            type="button"
            className="mc-quick__btn"
            onClick={refresh}
            title="تازه‌سازی دادهٔ همهٔ بخش‌ها"
          >
            <IconRefresh width={15} height={15} />
            تازه‌سازی
          </button>

          {config.data.forcedDryRun ? (
            <Pill tone="warn" dot>حالت آزمایشی سراسری روشن است</Pill>
          ) : null}
        </div>

        <div className="mc-toolbar__top">
          <div className="mc-quick">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className="mc-quick__btn"
                onClick={() => openTab(action.tab, { action: action.id })}
              >
                <action.icon width={14} height={14} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <nav className="mc-tabs" aria-label="بخش‌های مرکز رسانه">
          {tabs.map((row) => {
            const count = counts[row.id];
            return (
              <button
                key={row.id}
                type="button"
                className={`mc-tab ${active === row.id ? 'is-active' : ''}`}
                onClick={() => openTab(row.id)}
                aria-current={active === row.id ? 'page' : undefined}
              >
                <row.icon width={15} height={15} />
                {row.label}
                {count ? <span className="mc-tab__count">{toFa(count)}</span> : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── بنر دادهٔ نمونه: شفاف، با راه خروج ─── */}
      {demo ? (
        <div className="mc-demo">
          <span>
            <strong>دادهٔ نمونه فعال است.</strong>{' '}
            برای اینکه بتوانید همهٔ بخش‌ها را ببینید، رکوردهای نمایشی ساخته شده‌اند. هر رکورد نمونه
            با برچسب مشخص است و پاک‌کردن آن‌ها به دادهٔ واقعی کاری ندارد.
          </span>
          <span className="mc-demo__spacer" />
          {can('media.platforms.manage') ? (
            <button
              type="button"
              className="mc-quick__btn"
              onClick={async () => {
                // eslint-disable-next-line no-alert
                if (!window.confirm('همهٔ رکوردهای نمونهٔ مرکز رسانه پاک شوند؟ دادهٔ واقعی دست‌نخورده می‌ماند.')) return;
                await mediaCenter.clearDemo();
                refresh();
              }}
            >
              <IconArchive width={14} height={14} />
              پاک‌کردن دادهٔ نمونه
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ─── بازهٔ زمانی — فقط برای تب‌هایی که معنا دارد ─── */}
      {RANGE_TABS.has(active) ? (
        <div className="mc-controls">
          <RangePicker
            ranges={config.data.ranges}
            value={range.range}
            from={range.from}
            to={range.to}
            onChange={setRange}
          />
          <span className="mc-muted">
            مقایسه با بازهٔ قبل
            {summary.data?.connectedAccounts === 0 ? ' — هیچ اکانتی به API وصل نیست' : ''}
          </span>
        </div>
      ) : null}

      {/* ─── بخش فعال ─── */}
      {renderSection()}
    </div>
  );
}
