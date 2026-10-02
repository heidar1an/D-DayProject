import { useEffect, useMemo, useState } from 'react';
import {
  G5_STAGES,
  REVIEW_ACTIVITY_TYPES,
  ReviewNotebookService,
} from '../../../services/reviewNotebook/reviewNotebookService';
import './reviewNotebook.css';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
const PERSIAN_LOCALE = 'fa-IR-u-ca-persian';
const PERSIAN_LATIN = 'fa-IR-u-ca-persian-nu-latn';
const DAY = 24 * 60 * 60 * 1000;
/* ترتیب هفتهٔ شمسی — شنبه ستون اول است و در RTL از راست شروع می‌شود */
const WEEKDAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const fullDateFormatter = new Intl.DateTimeFormat(PERSIAN_LOCALE, {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const monthFormatter = new Intl.DateTimeFormat(PERSIAN_LOCALE, { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat(PERSIAN_LOCALE, { day: 'numeric' });
/* ارقام لاتین برای محاسبهٔ ماه شمسی (نمایش همان ارقام فارسی است) */
const persianDayNumber = new Intl.DateTimeFormat(PERSIAN_LATIN, { day: 'numeric' });
const persianMonthNumber = new Intl.DateTimeFormat(PERSIAN_LATIN, { month: 'numeric' });

/* ── آیکن‌های خطی دفترچه — هم‌زبان آیکن‌های لایهٔ بانک تست ── */
const ICONS = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.4 12.4 2.5 2.5 4.7-5.2" />
    </>
  ),
  timer: (
    <>
      <path d="M9 2.5h6" />
      <circle cx="12" cy="13.5" r="8" />
      <path d="M12 10v3.5l2.4 1.6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1 .8-1 1.5v.3" />
      <path d="M12 16.8h.01" />
    </>
  ),
};

function ReviewIcon({ name, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function ReviewModal({ open, onClose, title, children, wide = false }) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      return undefined;
    }
    if (!visible) return undefined;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  useEffect(() => {
    if (!visible || closing) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closing, onClose, visible]);

  if (!visible) return null;

  return (
    <div className={`review-modal ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="review-modal__backdrop" aria-label="بستن پنجره" onClick={onClose} />
      <div className={`review-modal__panel ${wide ? 'review-modal__panel--wide' : ''}`}>
        <header className="review-modal__header">
          <h2>{title}</h2>
          <button type="button" className="review-modal__close" onClick={onClose} aria-label="بستن">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

const STAGE_MINUTES = { 1: 20, 2: 16, 3: 12, 4: 10, 5: 8 };
const PLAN_START_MINUTES = 8 * 60;
const PLAN_BREAK_MINUTES = 5;

function formatClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return toFa(`${hours}:${minutes}`);
}

function startOfDay(value = Date.now()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addDays(value, count) {
  const date = new Date(value);
  date.setDate(date.getDate() + count);
  return startOfDay(date);
}

function startOfPersianWeek(value) {
  const date = new Date(startOfDay(value));
  const daysFromSaturday = (date.getDay() + 1) % 7;
  return addDays(date, -daysFromSaturday);
}

function isSameDay(first, second) {
  return startOfDay(first) === startOfDay(second);
}

/* ── ماه شمسی: اول ماه و تعداد روزهای آن ──
   با تقویم فارسی Intl حساب می‌شود تا نیازی به جدول تبدیل تاریخ نباشد. */
function persianMonthStart(value = Date.now()) {
  const date = new Date(startOfDay(value));
  for (let step = 0; step < 31; step += 1) {
    if (Number(persianDayNumber.format(date)) === 1) return startOfDay(date);
    date.setDate(date.getDate() - 1);
  }
  return startOfDay(value);
}

function persianMonthLength(monthStart) {
  const month = Number(persianMonthNumber.format(new Date(monthStart)));
  const cursor = new Date(startOfDay(monthStart));
  let length = 0;
  for (let step = 0; step < 32; step += 1) {
    if (Number(persianMonthNumber.format(cursor)) !== month) break;
    length += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return length;
}

function stageCopy(stage) {
  const current = G5_STAGES[stage - 1];
  return `${current.label} با فاصله ${toFa(current.intervalDays)} روزه`;
}

function DailyTask({ item, index, isOverdue, startsAt, endsAt, duration, onComplete, onRestart, onOpenLearning }) {
  const activity = REVIEW_ACTIVITY_TYPES[item.activityType] || REVIEW_ACTIVITY_TYPES.other;
  const timing = ReviewNotebookService.getTiming(item);

  return (
    <article className={`daily-task ${isOverdue ? 'daily-task--overdue' : ''}`} style={{ '--review-accent': activity.color }}>
      <div className="daily-task__order">
        <small>{startsAt}</small>
        <strong>{toFa(index + 1)}</strong>
      </div>
      <div className="daily-task__content">
        <div className="daily-task__badges">
          <span className="daily-task__stage">G{toFa(item.stage)}</span>
          <span style={{ color: activity.color }}>{activity.label}</span>
          {isOverdue && <span className="daily-task__late">{toFa(timing.days)} روز تأخیر</span>}
        </div>
        <h3>{item.title}</h3>
        <p>{[item.subject, item.description].filter(Boolean).join(' · ') || 'مبحث شخصی'}</p>
        <div className="daily-task__reason">
          <span>امروز چه کار کنم؟</span>
          <strong>{stageCopy(item.stage)}؛ ابتدا بدون نگاه‌کردن بازیابی کن، سپس نکات جاافتاده را مرور کن.</strong>
        </div>
      </div>
      <aside className="daily-task__action">
        <div className="daily-task__duration">
          <small>بازه پیشنهادی</small>
          <strong>{startsAt} تا {endsAt}</strong>
          <span>حدود {toFa(duration)} دقیقه</span>
        </div>
        {item.sourceType === 'course-unit' && (
          <button type="button" className="review-button review-button--ghost" onClick={onOpenLearning}>بازکردن درسنامه</button>
        )}
        <button type="button" className="review-button review-button--primary" onClick={() => onComplete(item.id)}>مرور کردم</button>
        <button type="button" className="review-button review-button--soft" onClick={() => onRestart(item.id)}>نیاز به شروع دوباره</button>
      </aside>
    </article>
  );
}

export default function ReviewNotebook({ userData, onOpenLearning, onBack }) {
  const userId = userData?.id ?? userData?.phone ?? 'guest';
  const [items, setItems] = useState(() => ReviewNotebookService.getAll(userId));
  const [isAdding, setIsAdding] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', activityType: 'learning' });
  const [selectedDate, setSelectedDate] = useState(() => startOfDay());
  const [monthStart, setMonthStart] = useState(() => persianMonthStart(Date.now()));
  const today = startOfDay();

  const refresh = () => setItems(ReviewNotebookService.getAll(userId));

  useEffect(() => {
    refresh();
    window.addEventListener('tapesh:review-notebook-updated', refresh);
    return () => window.removeEventListener('tapesh:review-notebook-updated', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ── شبکهٔ مربعی ماه شمسی (سبک گوگل‌کلندر): از شنبهٔ قبلِ اول ماه تا تکمیل هفتهٔ آخر ── */
  const monthLength = useMemo(() => persianMonthLength(monthStart), [monthStart]);
  const monthEnd = addDays(monthStart, monthLength);
  const calendarDays = useMemo(() => {
    const gridStart = startOfPersianWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [monthStart]);

  const activeItems = useMemo(() => items.filter((item) => item.status !== 'mastered'), [items]);
  const overdueItems = useMemo(
    () => activeItems.filter((item) => startOfDay(item.dueAt) < today),
    [activeItems, today],
  );
  const selectedDayItems = useMemo(
    () => activeItems.filter((item) => isSameDay(item.dueAt, selectedDate)),
    [activeItems, selectedDate],
  );
  const isTodaySelected = isSameDay(selectedDate, today);
  const dailyPlan = useMemo(() => {
    const scheduled = [...selectedDayItems].sort((a, b) => b.stage - a.stage);
    if (!isTodaySelected) return scheduled.map((item) => ({ item, isOverdue: false }));
    const late = [...overdueItems]
      .sort((a, b) => a.dueAt - b.dueAt)
      .map((item) => ({ item, isOverdue: true }));
    return [...late, ...scheduled.map((item) => ({ item, isOverdue: false }))];
  }, [isTodaySelected, overdueItems, selectedDayItems]);

  const totalMinutes = dailyPlan.reduce((sum, entry) => sum + STAGE_MINUTES[entry.item.stage], 0);

  const scheduledPlan = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let cursor = isTodaySelected
      ? Math.max(PLAN_START_MINUTES, Math.ceil(nowMinutes / 15) * 15)
      : PLAN_START_MINUTES;
    return dailyPlan.map(({ item, isOverdue }) => {
      const duration = STAGE_MINUTES[item.stage];
      const start = cursor;
      const end = start + duration;
      cursor = end + PLAN_BREAK_MINUTES;
      return { item, isOverdue, start, end, duration };
    });
  }, [dailyPlan, isTodaySelected]);

  const planWindow = scheduledPlan.length
    ? `${formatClock(scheduledPlan[0].start)} تا ${formatClock(scheduledPlan[scheduledPlan.length - 1].end)}`
    : null;
  const completedToday = items.filter((item) => (item.history || []).some(
    (event) => event.type === 'reviewed' && isSameDay(event.at, today),
  )).length;

  const countForDay = (day) => activeItems.filter((item) => isSameDay(item.dueAt, day)).length;

  /* ── چهار کادر زیرین: چیپ‌های یک‌ردیفی، هم‌سبک ردیف مسیرهای بانک تست ── */
  const summaryChips = [
    {
      id: 'remaining',
      icon: 'clock',
      accent: '#5b8cc7',
      label: 'مانده امروز',
      value: dailyPlan.length,
      hint: 'مبحث برای مرور',
    },
    {
      id: 'late',
      icon: 'alert',
      accent: '#e26d6d',
      label: 'عقب‌افتاده',
      value: overdueItems.length,
      hint: overdueItems.length ? 'در اولویت امروز' : 'همه‌چیز مرتب است',
    },
    {
      id: 'done',
      icon: 'check',
      accent: '#77b787',
      label: 'انجام‌شده امروز',
      value: completedToday,
      hint: 'مرور ثبت‌شده',
    },
    {
      id: 'time',
      icon: 'timer',
      accent: '#e0b45c',
      label: 'زمان تقریبی',
      value: totalMinutes,
      unit: 'دقیقه',
      hint: 'زمان تقریبی مطالعه امروز',
    },
  ];

  const goToToday = () => {
    setSelectedDate(today);
    setMonthStart(persianMonthStart(today));
  };
  const moveMonth = (direction) => {
    const anchor = direction > 0
      ? addDays(monthStart, monthLength)
      : addDays(monthStart, -1);
    const next = persianMonthStart(anchor);
    setMonthStart(next);
    setSelectedDate(next);
  };
  const pickDay = (day) => {
    setSelectedDate(day);
    if (day < monthStart || day >= monthEnd) setMonthStart(persianMonthStart(day));
  };

  const completeReview = (itemId) => {
    ReviewNotebookService.completeReview(userId, itemId);
    refresh();
  };

  const restartReview = (itemId) => {
    ReviewNotebookService.restart(userId, itemId);
    refresh();
  };

  const handleAdd = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    ReviewNotebookService.add(userId, {
      title: form.title,
      subject: form.subject,
      activityType: form.activityType,
      sourceType: 'manual',
    });
    setForm({ title: '', subject: '', activityType: 'learning' });
    setIsAdding(false);
  };

  return (
    <main className="review-notebook dash-stagger" dir="rtl">
      <div className="review-topbar dash-stagger">
        <button className="review-topbar__back" type="button" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به داشبورد
        </button>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="review-topbar__cta flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm transition-colors hover:border-[#5b8cc7]/50 hover:bg-[#5b8cc7]/12 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[var(--blue-soft-ink)]" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          ساخت مبحث
        </button>
      </div>

      {/* ── سرتیترِ وسط‌چین، هم‌سبک لایه‌های داشبورد ── */}
      <header className="review-hero">
        <div className="review-hero__content">
          <h1 className="review-hero__title">
            <span className="review-hero__title-top">دفترچه مرور</span>
            <span className="review-hero__title-accent">مرور فاصله‌دار</span>
          </h1>
          <p className="review-hero__subtitle">
            برنامه هر روز دقیقاً مشخص می‌کند کدام مبحث را در کدام مرحله G مرور کنی.
          </p>
        </div>
      </header>

      <section className="review-chips" aria-label="خلاصه برنامه امروز">
        {summaryChips.map((chip) => (
          <div
            className="review-chip"
            key={chip.id}
            title={chip.hint}
            style={{ '--chip-accent': chip.accent }}
          >
            <ReviewIcon name={chip.icon} className="review-chip__icon" />
            <span>{chip.label}</span>
            <strong>{toFa(chip.value)}{chip.unit ? ` ${chip.unit}` : ''}</strong>
          </div>
        ))}
      </section>

      <div className="review-dashboard-grid">
        <section className="review-calendar" aria-label="تقویم مرور شمسی">
        <header className="review-calendar__header">
          <div>
            <h2>{monthFormatter.format(new Date(monthStart))}</h2>
          </div>
          <div className="review-calendar__tools">
            <button
              type="button"
              className="review-help"
              aria-expanded={showStages}
              aria-controls="review-g5-explainer"
              aria-label="فلسفه مرور فاصله‌دار ۵G چیست؟"
              title="فلسفه مرور فاصله‌دار ۵G چیست؟"
              onClick={() => setShowStages((value) => !value)}
            >
              <ReviewIcon name="help" className="review-help__icon" />
            </button>
            <div className="review-calendar__nav">
              <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">→</button>
              <button type="button" className="review-calendar__today" onClick={goToToday}>امروز</button>
              <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">←</button>
            </div>
          </div>
        </header>

        <div className="review-calendar__weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
        </div>

        <div className="review-calendar__grid">
          {calendarDays.map((day) => {
            const count = countForDay(day);
            const selected = isSameDay(day, selectedDate);
            const current = isSameDay(day, today);
            const outside = day < monthStart || day >= monthEnd;
            return (
              <button
                type="button"
                className={`review-calendar__cell ${selected ? 'is-selected' : ''} ${current ? 'is-today' : ''} ${outside ? 'is-outside' : ''}`}
                onClick={() => pickDay(day)}
                key={day}
                aria-pressed={selected}
                aria-label={`${fullDateFormatter.format(new Date(day))}${count ? ` — ${toFa(count)} مرور` : ''}`}
              >
                <strong>{dayFormatter.format(new Date(day))}</strong>
                {count > 0 && <span className="review-calendar__count">{toFa(count)}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="review-dashboard-grid__main">
        <section className="daily-plan" aria-labelledby="daily-plan-title">
        <header className="daily-plan__header">
          <div>
            <h2 id="daily-plan-title">{fullDateFormatter.format(new Date(selectedDate))}</h2>
            <p>{isTodaySelected
              ? (overdueItems.length ? 'ابتدا عقب‌افتاده‌ها، سپس موعدِ امروز؛ ساعت‌ها از همین لحظه شروع می‌شوند.' : 'زمان‌بندی پیشنهادی امروز از همین ساعت شروع می‌شود.')
              : 'زمان‌بندی پیشنهادی این روز از صبح.'}</p>
          </div>
          <div className="daily-plan__total">
            <strong>{toFa(dailyPlan.length)}</strong>
            <span>مبحث · {toFa(totalMinutes)} دقیقه</span>
            {planWindow && <span>از ساعت {planWindow}</span>}
          </div>
        </header>

        <div className="daily-plan__list" aria-live="polite">
          {dailyPlan.length ? scheduledPlan.map(({ item, isOverdue, start, end, duration }, index) => (
            <DailyTask
              item={item}
              index={index}
              isOverdue={isOverdue}
              startsAt={formatClock(start)}
              endsAt={formatClock(end)}
              duration={duration}
              onComplete={completeReview}
              onRestart={restartReview}
              onOpenLearning={onOpenLearning}
              key={item.id}
            />
          )) : (
            <div className="daily-plan__empty">
              <span aria-hidden="true">✓</span>
              <div>
                <h3>{isTodaySelected ? 'کار مرور امروز تمام شده' : 'برای این روز مروری ثبت نشده'}</h3>
                <p>{isTodaySelected ? 'می‌توانی یک مبحث تازه یاد بگیری تا وارد چرخه G1 شود.' : 'روز دیگری را از تقویم انتخاب کن یا یک مبحث تازه اضافه کن.'}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      </div>
      </div>

      <ReviewModal
        open={showStages}
        onClose={() => setShowStages(false)}
        title="فلسفه مرور فاصله‌دار ۵G"
        wide
      >
        <div id="review-g5-explainer" className="review-g5-explainer space-y-5">
          <p className="text-sm leading-8 text-[var(--muted)]">
            یادگیری فقط دیدن و دوباره‌خواندن نیست؛ باید بتوانی مطلب را زمانی که دیگر جلوی چشمت نیست به یاد بیاوری.
            مرور فاصله‌دار، یادآوری را درست پیش از کم‌رنگ‌شدن حافظه تکرار می‌کند تا مسیر بازیابی اطلاعات با تمرین تقویت شود.
          </p>
          <div className="review-g5-explainer__principles">
            <section>
              <h3>اول به‌یاد بیاور، بعد بررسی کن</h3>
              <p>پیش از بازکردن درس یا پاسخ، چند لحظه تلاش کن نکته‌ها را از حافظه بازسازی کنی. سپس پاسخ را بررسی کن و فقط بخش‌های فراموش‌شده یا نادقیق را اصلاح کن.</p>
            </section>
            <section>
              <h3>تکرارها را فاصله‌دار کن</h3>
              <p>فشرده‌خوانی ممکن است حس آشنایی ایجاد کند، اما یادآوری پس از گذشت زمان نشان می‌دهد چه چیزی واقعاً در حافظه مانده است. فاصله‌ها تدریجی بیشتر می‌شوند تا مطلب چند بار و در زمان‌های جداگانه بازیابی شود.</p>
            </section>
          </div>
          <section>
            <h3 className="mb-3 text-sm text-white [font-family:'Doran','Vazir',Tahoma,sans-serif]">پنج گام چرخه در دفترچه مرور</h3>
            <p className="mb-3 text-xs leading-7 text-[var(--faint)]">
              در این چرخه، فاصلهٔ هر مرور بعدی دو برابر می‌شود: ۱، ۲، ۴، ۸ و ۱۶ روز. اگر مرورها سرِ موعد انجام شوند، نوبت‌ها به‌ترتیب در روزهای ۱، ۳، ۷، ۱۵ و ۳۱ پس از یادگیری قرار می‌گیرند.
            </p>
            <div className="review-g5-explainer__stages">
              {G5_STAGES.map((stage, index) => (
                <div className="review-g5-explainer__stage" key={stage.id}>
                  <strong>{stage.id}</strong>
                  <span>{stage.label}</span>
                  <small>{index === 0 ? 'یک روز پس از یادگیری' : `${toFa(stage.intervalDays)} روز پس از مرور قبلی`}</small>
                </div>
              ))}
            </div>
          </section>
          <p className="review-g5-explainer__note">
            هر بار که مرور را انجام دادی، مرحله بعدی با فاصله بیشتر در تقویم ثبت می‌شود؛ مرور موفق G5 چرخه را کامل می‌کند.
            اگر مطلب را به یاد نیاوردی، «نیاز به شروع دوباره» چرخه را به G1 برمی‌گرداند. این برنامه یک راهنمای منظم برای تمرین یادآوری است، نه تضمین حفظ دائمی؛ مرور با تمرکز و اصلاح خطاها همچنان مهم است.
          </p>
        </div>
      </ReviewModal>

      <ReviewModal open={isAdding} onClose={() => setIsAdding(false)} title="ساخت مبحث">
        <form className="review-add-form" onSubmit={handleAdd}>
          <label>
            <span>عنوان مبحث</span>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="مثلاً آناتومی شبکه بازویی" autoFocus />
          </label>
          <label>
            <span>درس یا منبع</span>
            <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="مثلاً آناتومی" />
          </label>
          <label>
            <span>نوع فعالیت</span>
            <select value={form.activityType} onChange={(event) => setForm({ ...form, activityType: event.target.value })}>
              {Object.entries(REVIEW_ACTIVITY_TYPES).map(([id, item]) => <option value={id} key={id}>{item.label}</option>)}
            </select>
          </label>
          <button type="submit" className="review-button review-button--primary">شروع چرخه G1</button>
        </form>
      </ReviewModal>
    </main>
  );
}
