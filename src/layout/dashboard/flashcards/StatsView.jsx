/*
 * StatsView — آمار یادگیری فلش‌کارت: مینیمال و قابل فهم، نه داشبورد شلوغ.
 * نمودار مرور روزانه (ستون‌های برچسب‌دار با تاریخ شمسی) + تقویم مطالعهٔ ۵×۷
 * (تراز با روزهای هفته، عدد شمسی داخل هر خانه، ۳ سطح رنگ) + مبحث‌های ضعیف.
 *
 * برچسب‌های تاریخ (روز هفته، روز ماه جلالی، نام ماه) با Intl لوکیل fa-IR ساخته
 * می‌شوند — تقویم شمسی و اعداد فارسی بدون هیچ کتابخانه‌ای (هم‌روش heartSeries).
 */
import { useEffect, useState } from 'react';
import { fetchStats, trackEvent } from '../../../services/flashcards/flashcardService';
import { Icon, MasteryRing, Skeleton, StateChip, faNum, toFa } from './flashcardShared';
import { SUBJECTS } from '../../../services/flashcards/mockData';

/* ── قالب‌بندی فارسی (جلالی) ── */
const fWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' });
const fDayMonth = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' });
const fDay = new Intl.DateTimeFormat('fa-IR', { day: 'numeric' });
const fMonth = new Intl.DateTimeFormat('fa-IR', { month: 'long' });

/* ── نمودار مرور روزانه: هر ستون، خودش را توضیح می‌دهد ──
 * عدد مرور بالای ستون + حرف روز هفته و روز شمسی زیر آن؛
 * امروز با رنگ پررنگ مشخص است تا «کجا ایستاده‌ای» معلوم باشد. */
function DailyBars({ daily }) {
  const last14 = daily.slice(-14);
  const max = Math.max(1, ...last14.map((day) => day.count));
  const todayKey = new Date().toDateString();

  return (
    <div>
      <div className="flex h-40 items-stretch gap-1.5" role="img" aria-label="نمودار مرور روزانه — ۱۴ روز اخیر؛ ارتفاع هر ستون تعداد مرور آن روز است">
        {last14.map((day, index) => {
          const date = new Date(day.date);
          const isToday = date.toDateString() === todayKey;
          return (
            <div key={day.date} className="group relative flex min-w-0 flex-1 flex-col items-center">
              <span className="fc-num h-4 text-[10px] leading-4 text-[var(--muted)]">{day.count ? toFa(day.count) : ''}</span>
              <div className="flex w-full flex-1 items-end">
                <span
                  className={`fc-bar block w-full rounded-t-md transition-colors ${
                    isToday ? 'bg-[var(--blue-bright)]' : 'bg-[#5b8cc7]/60 group-hover:bg-[var(--blue-bright)]'
                  }`}
                  style={{
                    height: `${Math.max(3, (day.count / max) * 100)}%`,
                    minHeight: day.count ? '4px' : '3px',
                    opacity: day.count ? undefined : 0.25,
                    '--i': index,
                  }}
                />
              </div>
              <span className="pointer-events-none absolute -top-8 right-1/2 z-10 hidden translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--muted)] shadow-lg group-hover:block">
                {fWeekday.format(date)} {fDayMonth.format(date)} · {toFa(day.count)} مرور
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {last14.map((day) => {
          const date = new Date(day.date);
          const isToday = date.toDateString() === todayKey;
          return (
            <span key={day.date} className="min-w-0 flex-1 text-center">
              <span className={`block text-[9px] leading-4 ${isToday ? 'text-[var(--blue-soft-ink)]' : 'text-[var(--ghost)]'}`}>
                {fWeekday.format(date).charAt(0)}
              </span>
              <span className={`fc-num block text-[10px] leading-4 ${isToday ? 'font-bold text-[var(--blue-soft-ink)]' : 'text-[var(--faint)]'}`}>
                {fDay.format(date)}
              </span>
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-[var(--ghost)]" aria-hidden="true">
        روزهای بی‌ستون = استراحت
      </p>
    </div>
  );
}

/* ── تقویم مطالعه: تقویم واقعی، نه گراف انتزاعی ──
 * ستون‌ها با روزهای هفته ترازند (شنبه تا جمعه)، عدد شمسیِ روز داخل هر خانه
 * نشسته و رنگ فقط سه سطح دارد: استراحت / کم / زیاد. */
const HEAT_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const HEAT_LEVELS = [
  { bg: 'rgb(var(--wash-rgb) / 0.05)', title: 'بدون مرور' },
  { bg: 'rgba(147,127,205,0.45)', title: 'مرور کم' },
  { bg: '#937fcd', title: 'مرور زیاد' },
];

function Heatmap({ daily }) {
  const byDay = new Map(daily.map((day) => [new Date(day.date).toDateString(), day.count]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /* ۵ هفتهٔ تمامِ اخیر که ستون اول شنبه باشد — هم‌روش هفتهٔ ایران */
  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - 28);
  firstDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 1) % 7));

  const weeks = [];
  for (let w = 0; w < 5; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + w * 7 + d);
      days.push({
        date,
        count: byDay.get(date.toDateString()) ?? 0,
        isFuture: date > today,
        isToday: date.getTime() === today.getTime(),
      });
    }
    weeks.push(days);
  }

  /* مرز «زیاد» نسبی است تا هم برای روزهای پرکار و هم شروعِ مسیر، معنادار بماند */
  const activeMax = Math.max(1, ...weeks.flat().map((cell) => cell.count));
  const highThreshold = Math.max(1, Math.ceil(activeMax * 0.55));
  const levelOf = (count) => (!count ? 0 : count < highThreshold ? 1 : 2);

  /* نام ماه جلالی بالای ستونی که ماه در آن عوض می‌شود — مثل تقویم دیواری */
  const monthLabels = weeks.map((week, w) => {
    if (w === 0) return fMonth.format(week[0].date);
    const prevMonth = fMonth.format(weeks[w - 1][6].date);
    const changed = week.find((cell) => fMonth.format(cell.date) !== prevMonth);
    return changed ? fMonth.format(changed.date) : '';
  });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
        {monthLabels.map((label, index) => (
          <span key={index} className="h-4 truncate text-[10px] leading-4 text-[var(--ghost)]">{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center" aria-hidden="true">
        {HEAT_WEEKDAYS.map((letter) => (
          <span key={letter} className="h-4 text-[10px] leading-4 text-[var(--ghost)]">{letter}</span>
        ))}
      </div>
      <div
        className="mt-1 space-y-1.5"
        role="img"
        aria-label="تقویم مطالعه — ۵ هفتهٔ اخیر؛ عدد داخل هر خانه تاریخ شمسی آن روز است و پررنگ‌تر بودن خانه یعنی مرور بیشتر"
      >
        {weeks.map((week, w) => (
          <div key={w} className="grid grid-cols-7 gap-1.5">
            {week.map((cell, d) => {
              if (cell.isFuture) return <span key={d} />;
              const level = levelOf(cell.count);
              return (
                <span
                  key={d}
                  className={`fc-heat-cell fc-num grid aspect-square place-items-center rounded-lg text-xs ${
                    cell.isToday ? 'ring-2 ring-[#5b8cc7]/70' : ''
                  } ${level === 0 ? 'text-[var(--ghost)]' : 'text-[var(--white)]'}`}
                  style={{ background: HEAT_LEVELS[level].bg, '--i': w * 7 + d }}
                  title={`${fWeekday.format(cell.date)} ${fDayMonth.format(cell.date)} — ${cell.count ? `${toFa(cell.count)} مرور` : HEAT_LEVELS[0].title}`}
                >
                  {fDay.format(cell.date)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--ghost)]">
        <span>۵ هفتهٔ اخیر · عدد داخل خانه = روز ماه (شمسی)</span>
        <span className="flex items-center gap-1.5">
          کم
          {HEAT_LEVELS.map((level) => (
            <span key={level.title} className="h-2.5 w-2.5 rounded" style={{ background: level.bg }} title={level.title} />
          ))}
          زیاد
        </span>
      </div>
    </div>
  );
}

export default function StatsView({ userData, onReviewWeak, reloadKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRoutineHelp, setShowRoutineHelp] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchStats(userData)
      .then((payload) => {
        if (alive) {
          setData(payload);
          setLoading(false);
        }
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userData, reloadKey]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-52 rounded-[2.5rem]" />
          <Skeleton className="h-52 rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  const { daily, streak, performance, counts, weakTopics } = data;
  const reviewedThisWeek = daily.slice(-7).reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {/* مرور روزانه — «مرور این هفته» از نوار خلاصه به همین‌جا آمد */}
        <section aria-label="مرور روزانه" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <header className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">مرور روزانه</h2>
            <span className="text-xs text-[var(--ghost)]">
              ۱۴ روز اخیر · این هفته: <strong className="fc-num text-[var(--blue-soft-ink)]">{faNum(reviewedThisWeek)}</strong> مرور · میانگین پاسخ{' '}
              {toFa(Math.round(performance.avgTimeSpent / 1000))} ثانیه
            </span>
          </header>
          <DailyBars daily={daily} />
        </section>

        {/* تقویم مطالعه — «روز استریک» به سربرگ همین بخش آمد + دکمهٔ توضیح */}
        <section aria-label="تقویم مطالعه" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <header className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">روال مطالعه‌ات</h2>
              <button
                type="button"
                onClick={() => setShowRoutineHelp((prev) => !prev)}
                aria-expanded={showRoutineHelp}
                aria-label="توضیح جدول روال مطالعه"
                title="توضیح این جدول"
                className={`grid h-6 w-6 cursor-pointer place-items-center rounded-full border text-xs transition-colors ${
                  showRoutineHelp
                    ? 'border-[#5b8cc7]/60 bg-[#5b8cc7]/15 text-white'
                    : 'border-white/12 bg-white/5 text-[var(--muted)] hover:border-[#5b8cc7]/50 hover:text-white'
                }`}
              >
                ؟
              </button>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--faint)]">
              <Icon name="flame" className="h-4 w-4 text-[var(--red-ink)]" />
              <strong className="fc-num text-[var(--white)]">{toFa(streak)}</strong> روز استریک
            </span>
          </header>

          {showRoutineHelp && (
            <p className="mb-4 rounded-2xl border border-[#5b8cc7]/25 bg-[#5b8cc7]/8 px-4 py-3 text-xs leading-6 text-[var(--muted)]">
              این یک تقویم واقعی ۵ هفتهٔ اخیر است: ستون‌ها از شنبه تا جمعه‌اند و عدد داخل هر خانه، روزِ ماهِ شمسی همان روز.
              خانهٔ خالی یعنی استراحت؛ بنفشِ کم‌رنگ یعنی مرور کم و بنفشِ پررنگ یعنی مرور زیاد آن روز. خانهٔ امروز کادر آبی دارد.
            </p>
          )}

          <Heatmap daily={daily} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* مبحث‌های ضعیف */}
        <section aria-label="مباحث ضعیف" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <header className="mb-5 flex items-center justify-between">
            <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">مبحث‌هایی که باید قوی‌تر شوند</h2>
          </header>

          {weakTopics.length ? (
            <ul className="space-y-3">
              {weakTopics.map((topic) => {
                const subject = SUBJECTS.find((item) => item.id === topic.subjectId);
                const weak = topic.mastery < 45;
                return (
                  <li key={topic.topicId} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${weak ? 'bg-[var(--rose)]' : 'bg-[var(--gold)]'}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {topic.topicId}
                        <span className="mr-2 text-[11px] text-[var(--ghost)]">· {subject?.title ?? 'عمومی'} · {toFa(topic.cardCount)} کارت</span>
                      </p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${topic.mastery}%`, background: weak ? '#ef9196' : '#e0b45c' }}
                        />
                      </div>
                    </div>
                    <strong className="fc-num shrink-0 text-sm" style={{ color: weak ? '#ef9196' : '#e0b45c' }}>
                      {toFa(topic.mastery)}٪
                    </strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm leading-7 text-[var(--faint)]">
              هنوز داده کافی جمع نشده؛ بعد از چند جلسه مرور، مباحث ضعیف‌ات اینجا خودشان را نشان می‌دهند.
            </p>
          )}

          {weakTopics.length > 0 && (
            <button
              type="button"
              onClick={() => {
                trackEvent('weak_topics_review');
                onReviewWeak();
              }}
              className="mt-5 cursor-pointer rounded-xl bg-[#ef9196]/12 px-5 py-2.5 text-xs text-[var(--red-ink)] transition-colors hover:bg-[#ef9196]/20"
            >
              مرور مباحث ضعیف
            </button>
          )}
        </section>

        {/* ترکیب کارت‌ها */}
        <section aria-label="ترکیب کارت‌ها" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <h2 className="mb-5 text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">وضعیت کل کارت‌هایت</h2>
          <div className="flex items-center gap-6">
            <MasteryRing value={counts.mastery} size={96} stroke={7} color="var(--blue-ink)" label="تسلط" />
            <ul className="flex-1 space-y-2 text-sm">
              {[
                { state: 'new', label: 'جدید', count: counts.newCards },
                { state: 'learning', label: 'در حال یادگیری', count: counts.learning },
                { state: 'review', label: 'در حال مرور', count: counts.review },
                { state: 'mastered', label: 'تسلط‌یافته', count: counts.mastered },
                { state: 'suspended', label: 'معلق', count: counts.suspended },
              ].map((row) => (
                <li key={row.state} className="flex items-center justify-between gap-3">
                  <StateChip state={row.state} />
                  <strong className="text-[var(--white)]">{faNum(row.count)}</strong>
                </li>
              ))}
            </ul>
          </div>

          {/* «دقت کل» و «ماندگاری» از نوار خلاصه حذف‌شده به همین‌جا آمدند */}
          <ul className="mt-4 space-y-2 border-t border-white/6 pt-4 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">دقت کل پاسخ‌ها</span>
              <strong className="fc-num text-[var(--green-ink)]">{toFa(performance.accuracy)}٪</strong>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">ماندگاری حافظه</span>
              <strong className="fc-num text-[var(--gold-ink)]">{toFa(performance.retention)}٪</strong>
            </li>
          </ul>

          <p className="mt-5 border-t border-white/6 pt-4 text-[11px] leading-5 text-[var(--ghost)]">
            امتیاز تسلط ترکیبی از صحت، ماندگاری فاصله‌ها، تازگی مرور و سختی کارت محاسبه می‌شود — نه صرفاً تعداد مرور.
          </p>
        </section>
      </div>
    </div>
  );
}
