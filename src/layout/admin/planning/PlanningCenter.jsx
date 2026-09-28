/*
 * ماژول «برنامه‌ریزی و مدیریت» — پوستهٔ اصلی.
 *
 * یک پوسته، نُه بخش. تب فعال در آدرس هم می‌نشیند (`#admin/planning/tasks`) تا
 * رفرش و دکمه‌های Back/Forward همان بخش را نگه دارند؛ دقیقاً همان قراردادی که
 * `AnalyticsCenter` و `MediaCenter` دارند.
 *
 * نوار بالای ماژول دو چیز همیشه‌حاضر دارد: کلید «تازه‌سازی» و زنگ اعلان‌ها با
 * شمارندهٔ خوانده‌نشده‌ها. اعلان‌ها از سرویس می‌آیند و کلیک روی هرکدام کاربر را
 * به همان بخش مرتبط می‌برد.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  EmptyState, Spinner, useAsync, useToast,
} from '../adminShared';
import {
  IconBell, IconCalendar, IconClose, IconCoins, IconDashboard, IconList,
  IconReport, IconSend, IconSliders, IconStandard,
} from '../adminIcons';
import { planning, setViewer } from '../../../services/planning/planningService';
import { adminToUser } from '../../../services/planning/planningSources';
import { NOTIFICATION_KINDS, PRIORITIES, labelOf, toneOf } from '../../../services/planning/planningTypes';
import { relativeFa, toFa } from '../../../services/planning/jalali';
import { Pill, Tip } from './planningKit';

import OverviewSection from './sections/overview';
import CalendarSection from './sections/calendar';
import TasksSection from './sections/tasks';
import AssignmentsSection from './sections/assignments';
import RemindersSection from './sections/reminders';
import SopSection from './sections/sop';
import FinanceSection from './sections/finance';
import ReportsSection from './sections/reports';
import PlanningSettingsSection from './sections/settings';

export const PLANNING_TABS = [
  { key: 'overview', label: 'نمای کلی', icon: IconDashboard },
  { key: 'calendar', label: 'تقویم', icon: IconCalendar },
  { key: 'tasks', label: 'تسک‌ها', icon: IconList },
  { key: 'assignments', label: 'ابلاغ‌ها', icon: IconSend },
  { key: 'reminders', label: 'یادآوری', icon: IconBell },
  { key: 'sop', label: 'SOPها', icon: IconStandard },
  { key: 'finance', label: 'مالی', icon: IconCoins },
  { key: 'reports', label: 'گزارش‌ها', icon: IconReport },
  { key: 'settings', label: 'تنظیمات برنامه‌ریزی', icon: IconSliders },
];

export const PLANNING_TAB_IDS = new Set(PLANNING_TABS.map((tab) => tab.key));

/* نگاشت بخش → کامپوننت */
const SECTION_VIEWS = {
  overview: OverviewSection,
  calendar: CalendarSection,
  tasks: TasksSection,
  assignments: AssignmentsSection,
  reminders: RemindersSection,
  sop: SopSection,
  finance: FinanceSection,
  reports: ReportsSection,
  settings: PlanningSettingsSection,
};

export default function PlanningCenter({ admin, tab, onTabChange }) {
  const notify = useToast();

  const activeTab = PLANNING_TAB_IDS.has(tab) ? tab : 'overview';

  /*
   * «کاربر جاری» ماژول از نشست واقعی پنل ساخته می‌شود.
   *
   * سطح سازمانی و واحد از نقش و مجوزهای همان مدیر استنتاج می‌شود
   * (`adminToUser`)، پس نیازی به انتظار برای فهرست کاربران نیست: نمای درست از
   * همان لحظهٔ اول اعمال می‌شود و نشت دادهٔ واحدهای دیگر رخ نمی‌دهد.
   */
  useEffect(() => {
    if (!admin) return;
    const user = adminToUser(admin);
    setViewer({ id: user.id, name: user.name, level: user.level, unitId: user.unitId, role: user.role });
  }, [admin]);

  /* اگر تبِ آدرس ناشناخته باشد، تب واقعی در آدرس نوشته می‌شود */
  useEffect(() => {
    if (tab !== activeTab) onTabChange(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tab]);

  /* ── شمارندهٔ اعلان‌های خوانده‌نشده ── */
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    planning.reminders.unreadCount().then(setUnread).catch(() => setUnread(0));
  }, []);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  /* ── زنگ اعلان‌ها ── */
  const [bellOpen, setBellOpen] = useState(false);
  const [bellKind, setBellKind] = useState('');
  const [bellPriority, setBellPriority] = useState('');
  const bellRef = useRef(null);

  const notificationsLoader = useCallback(
    () => planning.reminders.notifications({ kind: bellKind || undefined, priority: bellPriority || undefined }),
    [bellKind, bellPriority],
  );

  const {
    data: notifications, loading: bellLoading, error: bellError, reload: reloadBell,
  } = useAsync(notificationsLoader, [notificationsLoader]);

  useEffect(() => {
    if (!bellOpen) return undefined;
    const onDown = (event) => {
      if (!bellRef.current?.contains(event.target)) setBellOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [bellOpen]);

  const openBell = () => {
    setBellOpen((value) => !value);
    reloadBell();
  };

  const markRead = async (id) => {
    await planning.reminders.markRead(id);
    reloadBell();
    refreshUnread();
  };

  const markAllRead = async () => {
    await planning.reminders.markAllRead();
    reloadBell();
    refreshUnread();
    notify('همهٔ اعلان‌ها خوانده‌شده شدند');
  };

  const goTo = (view) => {
    setBellOpen(false);
    if (view && PLANNING_TAB_IDS.has(view)) onTabChange(view);
    else notify('مقصد این اعلان در دسترس نیست', 'error');
  };

  const SectionView = SECTION_VIEWS[activeTab];
  const activeLabel = useMemo(
    () => PLANNING_TABS.find((item) => item.key === activeTab)?.label ?? '',
    [activeTab],
  );

  return (
    <div className="pl-root">
      <div className="pl-toolbar pl-toolbar--sticky">
        <nav className="pl-tabs" aria-label="بخش‌های برنامه‌ریزی و مدیریت">
          {PLANNING_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`pl-tab ${item.key === activeTab ? 'is-active' : ''}`}
                onClick={() => onTabChange(item.key)}
                aria-current={item.key === activeTab ? 'page' : undefined}
              >
                <Icon width={15} height={15} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="pl-toolbar__end">
          <span className="pl-toolbar__hint">بخش: <b>{activeLabel}</b></span>

          <Tip text="اعلان‌ها">
            <button
              type="button"
              className={`pl-bell ${bellOpen ? 'is-open' : ''}`}
              onClick={openBell}
              aria-label={`اعلان‌ها${unread ? ` — ${toFa(unread)} خوانده‌نشده` : ''}`}
              aria-expanded={bellOpen}
            >
              <IconBell width={17} height={17} />
              {unread ? <span className="pl-bell__count">{toFa(unread > 99 ? '۹۹+' : unread)}</span> : null}
            </button>
          </Tip>
        </div>

        {bellOpen ? (
          <div className="pl-bellpanel" ref={bellRef} role="dialog" aria-label="اعلان‌ها">
            <header className="pl-bellpanel__head">
              <div>
                <strong>اعلان‌ها</strong>
                <small>{unread ? `${toFa(unread)} مورد خوانده‌نشده` : 'همه خوانده شده‌اند'}</small>
              </div>
              <div className="pl-bellpanel__actions">
                <button type="button" className="pl-linkbtn" onClick={markAllRead} disabled={!unread}>خواندن همه</button>
                <button type="button" className="pl-iconbtn" onClick={() => setBellOpen(false)} aria-label="بستن">
                  <IconClose width={14} height={14} />
                </button>
              </div>
            </header>

            <div className="pl-bellpanel__filters">
              <select value={bellKind} onChange={(event) => setBellKind(event.target.value)} aria-label="نوع اعلان">
                <option value="">همهٔ نوع‌ها</option>
                {NOTIFICATION_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>{kind.label}</option>
                ))}
              </select>
              <select value={bellPriority} onChange={(event) => setBellPriority(event.target.value)} aria-label="اهمیت اعلان">
                <option value="">همهٔ اهمیت‌ها</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>{priority.label}</option>
                ))}
              </select>
            </div>

            <div className="pl-bellpanel__body">
              {bellLoading && !notifications ? <div className="pl-boot"><Spinner size="sm" /> در حال خواندن اعلان‌ها…</div> : null}
              {bellError ? <div className="pl-boot">اعلان‌ها دریافت نشد.</div> : null}
              {notifications && notifications.length === 0 ? (
                <EmptyState title="اعلانی نیست" description="با فیلترهای دیگر امتحان کنید." />
              ) : null}

              {(notifications ?? []).map((item) => (
                <article key={item.id} className={`pl-notif ${item.read ? 'is-read' : ''}`}>
                  <div className="pl-notif__top">
                    <Pill tone={toneOf(NOTIFICATION_KINDS, item.kind)}>{labelOf(NOTIFICATION_KINDS, item.kind, 'اعلان')}</Pill>
                    <Pill tone={toneOf(PRIORITIES, item.priority)} soft={false}>{labelOf(PRIORITIES, item.priority)}</Pill>
                    <span className="pl-notif__time">{relativeFa(item.at)}</span>
                  </div>
                  <h4>{item.title}</h4>
                  {item.body ? <p>{item.body}</p> : null}
                  <div className="pl-notif__actions">
                    {item.linkView ? (
                      <button type="button" className="pl-linkbtn" onClick={() => goTo(item.linkView)}>
                        رفتن به بخش
                      </button>
                    ) : null}
                    {!item.read ? (
                      <button type="button" className="pl-linkbtn" onClick={() => markRead(item.id)}>خوانده شد</button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="pl-body">
        <SectionView
          admin={admin}
          onNavigate={onTabChange}
          onRefreshUnread={refreshUnread}
          onNotify={notify}
        />
      </div>
    </div>
  );
}
