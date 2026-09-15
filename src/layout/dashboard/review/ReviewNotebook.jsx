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

const dateFormatter = new Intl.DateTimeFormat(PERSIAN_LOCALE, { day: 'numeric', month: 'long' });
const fullDateFormatter = new Intl.DateTimeFormat(PERSIAN_LOCALE, {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const monthFormatter = new Intl.DateTimeFormat(PERSIAN_LOCALE, { month: 'long', year: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat(PERSIAN_LOCALE, { weekday: 'long' });
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

const STAGE_MINUTES = { 1: 20, 2: 16, 3: 12, 4: 10, 5: 8 };
const PLAN_START_MINUTES = 8 * 60;
const PLAN_BREAK_MINUTES = 5;

function formatClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return toFa(`${hours}:${minutes}`);
}

const FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'today', label: 'موعد امروز' },
  { id: 'upcoming', label: 'پیش رو' },
  { id: 'mastered', label: 'تثبیت‌شده' },
];

function timingCopy(timing, dueAt) {
  if (timing.state === 'mastered') return 'چرخه کامل شده';
  if (timing.state === 'today') return 'موعد مرور امروز';
  if (timing.state === 'overdue') return `${toFa(timing.days)} روز عقب‌افتاده`;
  if (timing.days === 1) return 'فردا';
  return `${toFa(timing.days)} روز دیگر · ${dateFormatter.format(new Date(dueAt))}`;
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

function StageRail({ currentStage, mastered }) {
  return (
    <div className="review-stage-rail" aria-label={mastered ? 'چرخه G5 کامل شده' : `مرحله G${currentStage}`}>
      {G5_STAGES.map((stage) => {
        const isDone = mastered || stage.stage < currentStage;
        const isCurrent = !mastered && stage.stage === currentStage;
        return (
          <div className={`review-stage ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`} key={stage.id}>
            <span>{isDone ? '✓' : stage.id}</span>
            <small>{toFa(stage.intervalDays)} روز</small>
          </div>
        );
      })}
    </div>
  );
}

function ReviewCard({ item, onComplete, onRestart, onRemove, onOpenLearning }) {
  const timing = ReviewNotebookService.getTiming(item);
  const activity = REVIEW_ACTIVITY_TYPES[item.activityType] || REVIEW_ACTIVITY_TYPES.other;
  const mastered = item.status === 'mastered';

  return (
    <article className={`review-item review-item--${timing.state}`} style={{ '--review-accent': activity.color }}>
      <header className="review-item__header">
        <div>
          <span className="review-item__type">{activity.label}</span>
          <h3>{item.title}</h3>
          <p>{[item.subject, item.description].filter(Boolean).join(' · ') || 'مبحث شخصی'}</p>
        </div>
        <span className={`review-item__due review-item__due--${timing.state}`}>
          {timingCopy(timing, item.dueAt)}
        </span>
      </header>

      <StageRail currentStage={item.stage} mastered={mastered} />

      <footer className="review-item__footer">
        <small>
          {mastered
            ? `در ${dateFormatter.format(new Date(item.completedAt))} تثبیت شد`
            : `${G5_STAGES[item.stage - 1].label} · فاصله ${toFa(G5_STAGES[item.stage - 1].intervalDays)} روز`}
        </small>
        <div>
          {item.sourceType === 'course-unit' && !mastered && (
            <button type="button" className="review-button review-button--ghost" onClick={onOpenLearning}>
              رفتن به درسنامه
            </button>
          )}
          {!mastered && (
            <button type="button" className="review-button review-button--soft" onClick={() => onRestart(item.id)}>
              هنوز یادم نیست
            </button>
          )}
          {!mastered ? (
            <button type="button" className="review-button review-button--primary" onClick={() => onComplete(item.id)}>
              مرور شد؛ مرحله بعد
            </button>
          ) : (
            <button type="button" className="review-button review-button--ghost" onClick={() => onRemove(item.id)}>
              حذف از دفترچه
            </button>
          )}
        </div>
      </footer>
    </article>
  );
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

export default function ReviewNotebook({ userData, onOpenLearning }) {
  const userId = userData?.id ?? userData?.phone ?? 'guest';
  const [items, setItems] = useState(() => ReviewNotebookService.getAll(userId));
  const [filter, setFilter] = useState('all');
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

  const counts = useMemo(() => items.reduce((result, item) => {
    const timing = ReviewNotebookService.getTiming(item);
    result.all += 1;
    if (timing.state === 'today' || timing.state === 'overdue') result.today += 1;
    if (timing.state === 'upcoming') result.upcoming += 1;
    if (timing.state === 'mastered') result.mastered += 1;
    return result;
  }, { all: 0, today: 0, upcoming: 0, mastered: 0 }), [items]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === 'all') return true;
    const timing = ReviewNotebookService.getTiming(item);
    if (filter === 'today') return timing.state === 'today' || timing.state === 'overdue';
    return timing.state === filter;
  }), [filter, items]);

  /* ── شبکهٔ مربعی ماه شمسی (سبک گوگل‌کلندر): از شنبهٔ قبلِ اول ماه تا تکمیل هفتهٔ آخر ── */
  const monthLength = useMemo(() => persianMonthLength(monthStart), [monthStart]);
  const monthEnd = addDays(monthStart, monthLength);
  const calendarDays = useMemo(() => {
    const gridStart = startOfPersianWeek(monthStart);
    const leading = Math.round((startOfDay(monthStart) - gridStart) / DAY);
    const total = Math.ceil((leading + monthLength) / 7) * 7;
    return Array.from({ length: total }, (_, index) => addDays(gridStart, index));
  }, [monthLength, monthStart]);

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
      {/* ── سرتیتر: هم‌سبک هیرو «درسنامهٔ جامع» — خط کوچک + خط بزرگ گرادیانی ── */}
      <header className="review-hero">
        <div className="review-hero__content">
          <h1 className="review-hero__title">
            <span className="review-hero__title-top">دفترچه مرور</span>
            <span className="review-hero__title-accent">مرور فاصله‌دار</span>
          </h1>
          <p className="review-hero__subtitle">
            برنامه هر روز دقیقاً مشخص می‌کند کدام مبحث را در کدام مرحله G مرور کنی.
          </p>
          <button
            type="button"
            className="review-help"
            aria-expanded={showStages}
            aria-controls="review-stages-help"
            aria-label="مراحل مرور G چطور کار می‌کند؟"
            title="مراحل مرور G چطور کار می‌کند؟"
            onClick={() => setShowStages((value) => !value)}
          >
            <ReviewIcon name="help" className="review-help__icon" />
          </button>
        </div>
        <aside className="review-today-tile" aria-label="تقویم روز">
          <small>{weekdayFormatter.format(new Date(today))}</small>
          <strong>{dayFormatter.format(new Date(today))}</strong>
          <span>{monthFormatter.format(new Date(today))}</span>
        </aside>
      </header>

      {showStages && (
        <section className="review-stages-help" id="review-stages-help" aria-label="مراحل مرور G">
          <header>
            <strong>مراحل مرور G چطور کار می‌کند؟</strong>
            <span>
              هر مبحثی که یاد می‌گیری وارد G1 می‌شود؛ با هر مرور موفق فاصله دو برابر می‌شود تا در G5 تثبیت شود.
              مجموع چرخه: ۳۱ روز.
            </span>
          </header>
          <div className="review-stages-help__rail">
            {G5_STAGES.map((stage, index) => (
              <div className="review-stages-help__stage" key={stage.id}>
                <span>{stage.id}</span>
                <strong>{toFa(stage.intervalDays)} روز بعد</strong>
                <small>{index === G5_STAGES.length - 1 ? 'تثبیت نهایی' : stage.label}</small>
              </div>
            ))}
          </div>
        </section>
      )}

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

      <section className="review-calendar" aria-label="تقویم مرور شمسی">
        <header className="review-calendar__header">
          <div>
            <small>تقویم مرور</small>
            <h2>{monthFormatter.format(new Date(monthStart))}</h2>
          </div>
          <div className="review-calendar__nav">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">→</button>
            <button type="button" className="review-calendar__today" onClick={goToToday}>امروز</button>
            <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">←</button>
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

      <section className="daily-plan" aria-labelledby="daily-plan-title">
        <header className="daily-plan__header">
          <div>
            <small>{isTodaySelected ? 'برنامه امروز' : 'برنامه روز انتخاب‌شده'}</small>
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

      <div className="review-library-heading">
        <div>
          <small>مدیریت دفترچه</small>
          <h2>همه مباحث و مسیرهای مرور</h2>
        </div>
        <button type="button" className="review-add-button" onClick={() => setIsAdding((value) => !value)}>
          <span aria-hidden="true">＋</span>
          افزودن مبحث
        </button>
      </div>

      {isAdding && (
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
      )}

      <section className="review-notebook__toolbar">
        <div className="review-filters" role="tablist" aria-label="فیلتر مرورها">
          {FILTERS.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? 'is-active' : ''}
              onClick={() => setFilter(item.id)}
              key={item.id}
            >
              {item.label}<span>{toFa(counts[item.id])}</span>
            </button>
          ))}
        </div>
        <p>{counts.today ? `${toFa(counts.today)} مرور موعددار یا عقب‌افتاده` : 'مرور عقب‌افتاده‌ای نداری'}</p>
      </section>

      <section className="review-list" aria-live="polite">
        {visibleItems.length ? visibleItems.map((item) => (
          <ReviewCard
            item={item}
            key={item.id}
            onComplete={completeReview}
            onRestart={restartReview}
            onRemove={(itemId) => { ReviewNotebookService.remove(userId, itemId); refresh(); }}
            onOpenLearning={onOpenLearning}
          />
        )) : (
          <div className="review-empty">
            <span aria-hidden="true">✓</span>
            <h2>{filter === 'today' ? 'مرور امروز تمام شد' : 'هنوز مبحثی اینجا نیست'}</h2>
            <p>{filter === 'today' ? 'با خیال راحت سراغ یادگیری بعدی برو.' : 'با تکمیل یک واحد یادگیری یا افزودن دستی، چرخه G1 آغاز می‌شود.'}</p>
          </div>
        )}
      </section>
    </main>
  );
}
