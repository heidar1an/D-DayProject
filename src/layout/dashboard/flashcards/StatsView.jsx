/*
 * StatsView — آمار یادگیری فلش‌کارت: مینیمال و قابل فهم، نه داشبورد شلوغ.
 * نمودار مرور روزانه + هیت‌مپ تقویمی (به سبک تپش، نه کپی GitHub) + مبحث‌های ضعیف.
 */
import { useEffect, useState } from 'react';
import { fetchStats, trackEvent } from '../../../services/flashcards/flashcardService';
import { Icon, MasteryRing, Skeleton, StateChip, faNum, toFa } from './flashcardShared';
import { SUBJECTS } from '../../../services/flashcards/mockData';

const MAX_BAR = 30;

function DailyBars({ daily }) {
  const max = Math.max(1, ...daily.map((day) => day.count));
  const last14 = daily.slice(-14);
  return (
    <div className="flex h-32 items-end gap-1.5" role="img" aria-label="نمودار مرور روزانه">
      {last14.map((day, index) => (
        <span key={day.date} className="group relative flex-1">
          <span
            className="fc-bar block w-full rounded-t-lg bg-[#5b8cc7]/75 transition-colors group-hover:bg-[var(--blue-bright)]"
            style={{
              height: `${Math.max(6, (day.count / max) * 100)}%`,
              maxHeight: '100%',
              '--i': index,
              minHeight: day.count ? undefined : '4px',
              opacity: day.count ? undefined : 0.25,
            }}
          />
          <span className="pointer-events-none absolute -top-8 right-1/2 hidden translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--muted)] shadow-lg group-hover:block">
            {toFa(day.count)} مرور
          </span>
        </span>
      ))}
    </div>
  );
}

function Heatmap({ daily }) {
  /* تقویم ۵×۷ به سبک تپش: خانه‌های گرد با شدت بنفش — نه گراف سهمیهٔ GitHub */
  const byDay = new Map(daily.map((day) => [new Date(day.date).toDateString(), day.count]));
  const today = new Date();
  const cells = [];
  for (let i = 34; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const count = byDay.get(date.toDateString()) ?? 0;
    cells.push({ date, count, isFuture: i < 0 });
  }

  const level = (count) => {
    if (!count) return 'rgb(var(--wash-rgb) / 0.05)';
    if (count < 8) return 'rgba(147,127,205,0.35)';
    if (count < 16) return 'rgba(147,127,205,0.6)';
    if (count < 24) return 'rgba(147,127,205,0.85)';
    return '#937fcd';
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5" role="img" aria-label="تقویم مطالعه">
        {cells.map((cell, index) => (
          <span
            key={cell.date.toISOString()}
            className="fc-heat-cell aspect-square rounded-lg"
            style={{ background: level(cell.count), '--i': index }}
            title={`${toFa(cell.count)} مرور`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--ghost)]">
        <span>۵ هفته اخیر</span>
        <span className="flex items-center gap-1.5">
          کم
          {['rgb(var(--wash-rgb) / 0.05)', 'rgba(147,127,205,0.35)', 'rgba(147,127,205,0.6)', 'rgba(147,127,205,0.85)', '#937fcd'].map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded" style={{ background: color }} />
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
        <Skeleton className="h-28 rounded-[2.5rem]" />
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
      {/* نوار خلاصه */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'مرور این هفته', value: faNum(reviewedThisWeek), color: 'var(--blue-ink)' },
          { label: 'روز استریک', value: toFa(streak), color: 'var(--red-ink)', icon: 'flame' },
          { label: 'دقت کل', value: `${toFa(performance.accuracy)}٪`, color: 'var(--green-ink)' },
          { label: 'ماندگاری', value: `${toFa(performance.retention)}٪`, color: 'var(--gold-ink)' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[2rem] bg-[var(--surface-soft)] p-4 text-center md:p-5">
            <strong className="block text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: stat.color }}>
              {stat.icon ? <Icon name={stat.icon} className="mb-1 inline h-5 w-5" style={{ color: stat.color }} /> : null}
              {stat.value}
            </strong>
            <span className="mt-1 block text-[11px] text-[var(--faint)]">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* مرور روزانه */}
        <section aria-label="مرور روزانه" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <header className="mb-5 flex items-center justify-between">
            <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">مرور روزانه</h2>
            <span className="text-xs text-[var(--ghost)]">۱۴ روز اخیر · میانگین پاسخ {toFa(Math.round(performance.avgTimeSpent / 1000))} ثانیه</span>
          </header>
          <DailyBars daily={daily} />
        </section>

        {/* تقویم مطالعه */}
        <section aria-label="تقویم مطالعه" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
          <h2 className="mb-5 text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">روال مطالعه‌ات</h2>
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
                    <strong className="shrink-0 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: weak ? '#ef9196' : '#e0b45c' }}>
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
          <p className="mt-5 border-t border-white/6 pt-4 text-[11px] leading-5 text-[var(--ghost)]">
            امتیاز تسلط ترکیبی از صحت، ماندگاری فاصله‌ها، تازگی مرور و سختی کارت محاسبه می‌شود — نه صرفاً تعداد مرور.
          </p>
        </section>
      </div>
    </div>
  );
}
