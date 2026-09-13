/*
 * ExamHub — صفحهٔ اصلی «آزمون‌های هماهنگ».
 * ترتیب روایت صفحه (مطابق سند محصول): آزمون در حال برگزاری → آزمون بعدی (Featured با
 * Countdown) → آزمونک‌های سریع → آزمون‌های آینده (Timeline) → فهرست کامل با فیلتر.
 * این کامپوننت صرفاً نمایش است؛ هر گذار با callback به لایهٔ روتر می‌رود.
 */
import { useMemo, useState } from 'react';
import {
  DifficultyBadge,
  EmptyState,
  ExamCountdown,
  Icon,
  StatusBadge,
  TYPE_META,
  TypeBadge,
  faNum,
  formatShortDate,
  formatTime,
  formatMonth,
  formatDuration,
  toFa,
} from './coordinatedShared';

/* CTA متناسب با وضعیت هر آزمون — همان منطق سند §۶ */
function ctaFor(exam) {
  switch (exam.status) {
    case 'LIVE':
      return exam.activeAttemptId
        ? { label: 'ادامه آزمون', accent: '#e26d6d' }
        : { label: 'ورود به آزمون', accent: '#e26d6d' };
    case 'AVAILABLE':
      return exam.attemptsUsed > 0
        ? { label: 'شروع مجدد آزمونک', accent: '#e0b45c' }
        : { label: 'شروع سریع', accent: '#61D192' };
    case 'REGISTRATION_OPEN':
      return exam.registered ? { label: 'ثبت‌نام شد ✓', accent: '#61D192' } : { label: 'ثبت‌نام در آزمون', accent: '#61D192' };
    case 'REGISTRATION_CLOSED':
      return { label: 'مشاهده جزئیات', accent: '#8a8a8a' };
    case 'RESULTS_AVAILABLE':
      return exam.resultReady ? { label: 'مشاهده کارنامه', accent: '#937fcd' } : { label: 'مشاهده نتایج', accent: '#937fcd' };
    case 'FINISHED':
      return { label: 'مشاهده جزئیات', accent: '#8a8a8a' };
    default:
      return { label: 'مشاهده جزئیات', accent: '#8a8a8a' };
  }
}

const STATUS_FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'open', label: 'ثبت‌نام فعال' },
  { id: 'live', label: 'در حال برگزاری' },
  { id: 'future', label: 'آینده' },
  { id: 'past', label: 'گذشته' },
];

const FUTURE_STATUSES = ['UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'];

function ExamRow({ exam, onOpen }) {
  const cta = ctaFor(exam);
  return (
    <button
      type="button"
      onClick={() => onOpen(exam.slug)}
      className="group flex w-full cursor-pointer items-center gap-4 rounded-[1.6rem] border border-white/[0.06] bg-[#242426] p-4 text-right transition-colors hover:border-white/[0.14] hover:bg-[#2a2a2d] md:p-5"
      aria-label={`${exam.title} — ${cta.label}`}
    >
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl md:h-14 md:w-14"
        style={{ background: `${exam.accent}14`, color: exam.accent }}
      >
        <Icon name={exam.glyph === 'spark' ? 'spark' : 'shield'} className="h-6 w-6" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="truncate text-[15px] text-white md:text-base [font-family:'Doran',Tahoma,sans-serif]">
            {exam.title}
          </strong>
          <StatusBadge status={exam.status} size="sm" />
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9a9a9a]">
          <span className="inline-flex items-center gap-1">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {formatShortDate(exam.startTime)}، {formatTime(exam.startTime)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="list" className="h-3.5 w-3.5" />
            {faNum(exam.effectiveQuestionCount)} سؤال
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="timer" className="h-3.5 w-3.5" />
            {formatDuration(exam.duration)}
          </span>
          {exam.participantsCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="users" className="h-3.5 w-3.5" />
              {faNum(exam.participantsCount)} نفر
            </span>
          )}
        </span>
      </span>

      <span
        className="hidden shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold sm:inline-block"
        style={{ background: `${cta.accent}16`, color: cta.accent }}
      >
        {cta.label}
      </span>
      <Icon name="back" className="h-4 w-4 shrink-0 text-[#6a6a6a] transition-colors group-hover:text-white sm:hidden" />
    </button>
  );
}

export default function ExamHub({ exams, onOpenExam, onQuickStart }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const liveExams = exams?.filter((exam) => exam.status === 'LIVE' && exam.type !== 'quiz') ?? [];
  const liveExam = liveExams[0];
  const featuredExam =
    exams
      ?.filter((exam) => exam.featured && FUTURE_STATUSES.includes(exam.status))
      .sort((a, b) => a.startTime - b.startTime)[0] ?? null;
  const quizzes = exams?.filter((exam) => exam.type === 'quiz' && exam.status === 'AVAILABLE') ?? [];
  const futureExams =
    exams
      ?.filter((exam) => FUTURE_STATUSES.includes(exam.status) && exam.id !== featuredExam?.id)
      .sort((a, b) => a.startTime - b.startTime) ?? [];
  const pastExams =
    exams
      ?.filter((exam) => ['FINISHED', 'RESULTS_AVAILABLE'].includes(exam.status))
      .sort((a, b) => b.startTime - a.startTime) ?? [];

  /* Timeline ماه‌های آینده */
  const timelineMonths = useMemo(() => {
    const map = new Map();
    for (const exam of [featuredExam, ...futureExams].filter(Boolean)) {
      const key = formatMonth(exam.startTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(exam);
    }
    return [...map.entries()];
  }, [featuredExam, futureExams]);

  const typeOptions = useMemo(() => {
    const present = [...new Set((exams ?? []).map((exam) => exam.type))];
    return [{ id: 'all', label: 'همهٔ نوع‌ها' }, ...present.map((id) => ({ id, label: TYPE_META[id]?.label ?? id }))];
  }, [exams]);

  const filteredList = useMemo(() => {
    const all = [...(liveExam ? [liveExam] : []), ...(featuredExam ? [featuredExam] : []), ...quizzes, ...futureExams, ...pastExams];
    const seen = new Set();
    const unique = all.filter((exam) => {
      if (seen.has(exam.id)) return false;
      seen.add(exam.id);
      return true;
    });

    return unique.filter((exam) => {
      if (typeFilter !== 'all' && exam.type !== typeFilter) return false;
      if (statusFilter === 'open' && exam.status !== 'REGISTRATION_OPEN') return false;
      if (statusFilter === 'live' && exam.status !== 'LIVE' && exam.status !== 'AVAILABLE') return false;
      if (statusFilter === 'future' && !FUTURE_STATUSES.includes(exam.status) && exam.status !== 'AVAILABLE') return false;
      if (statusFilter === 'past' && !['FINISHED', 'RESULTS_AVAILABLE'].includes(exam.status)) return false;
      if (search.trim() && !`${exam.title} ${exam.subject} ${exam.topics?.join(' ')}`.includes(search.trim())) return false;
      return true;
    });
  }, [liveExam, featuredExam, quizzes, futureExams, pastExams, statusFilter, typeFilter, search]);

  if (!exams) return null;

  return (
    <div className="space-y-8">
      {/* ── سربرگ و فلسفه ── */}
      <header className="dash-stagger space-y-2">
        <h1 className="text-2xl text-white md:text-[1.7rem] [font-family:'Doran',Tahoma,sans-serif]">
          آزمون‌های هماهنگ
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[#9a9a9a]">
          آزمون‌هایی که تیم تپش طراحی و سراسر کشور هم‌زمان برگزار می‌کند؛ با کارنامه،
          تراز و مقایسهٔ عملکرد. سنجیدن، اولین قدم بهتر شدن است.
        </p>
      </header>

      {/* ── آزمون در حال برگزاری ── */}
      {liveExam && (
        <section
          aria-label="آزمون در حال برگزاری"
          className="dash-stagger relative overflow-hidden rounded-[2.2rem] border border-[#e26d6d]/30 bg-[#242426] p-6 md:p-8"
        >
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#e26d6d]/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="LIVE" />
                <TypeBadge type={liveExam.type} />
              </div>
              <h2 className="text-xl text-white md:text-2xl [font-family:'Doran',Tahoma,sans-serif]">
                {liveExam.title}
              </h2>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9a9a9a]">
                <span>تا {formatTime(liveExam.endTime)} ادامه دارد</span>
                <span>{faNum(liveExam.effectiveQuestionCount)} سؤال</span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="users" className="h-3.5 w-3.5" />
                  {faNum(liveExam.participantsCount)} شرکت‌کننده
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenExam(liveExam.slug)}
              className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[#e26d6d] px-6 py-3 text-sm font-bold text-[#2a1010] transition-colors hover:bg-[#ea7f7f]"
            >
              <Icon name="play" className="h-4 w-4" />
              {liveExam.activeAttemptId ? 'ادامه آزمون' : 'ورود به آزمون'}
            </button>
          </div>
        </section>
      )}

      {/* ── Featured: آزمون بعدی با Countdown ── */}
      {featuredExam && (
        <section
          aria-label="آزمون بعدی"
          className="dash-stagger relative overflow-hidden rounded-[2.2rem] border border-white/[0.07] bg-[#242426] p-6 md:p-8"
        >
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#61D192]/10 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#61D192]/12 px-3 py-1 text-[11px] font-bold text-[#61D192]">
                  <Icon name="spark" className="h-3.5 w-3.5" />
                  آزمون بعدی تپش
                </span>
                <StatusBadge status={featuredExam.status} size="sm" />
                <TypeBadge type={featuredExam.type} />
              </div>

              <h2 className="text-2xl leading-snug text-white md:text-[1.65rem] [font-family:'Doran',Tahoma,sans-serif]">
                {featuredExam.title}
              </h2>

              <p className="max-w-xl text-sm leading-7 text-[#a5a5a5]">{featuredExam.description}</p>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                {[
                  { label: 'تاریخ', value: `${formatShortDate(featuredExam.startTime)}` },
                  { label: 'ساعت', value: `${formatTime(featuredExam.startTime)} تا ${formatTime(featuredExam.endTime)}` },
                  { label: 'مدت', value: formatDuration(featuredExam.duration) },
                  { label: 'تعداد سؤال', value: `${faNum(featuredExam.questionCount)} سؤال` },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-[11px] text-[#7a7a7a]">{item.label}</dt>
                    <dd className="mt-0.5 text-[13px] font-semibold text-[#ddd]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-[1.8rem] bg-black/30 p-5">
              <p className="text-xs text-[#9a9a9a]">شروع آزمون در:</p>
              <ExamCountdown targetTs={featuredExam.startTime} />
              <button
                type="button"
                onClick={() => onOpenExam(featuredExam.slug)}
                className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#61D192] px-6 py-3 text-sm font-bold text-[#0d1f16] transition-colors hover:bg-[#74dd9f]"
              >
                {featuredExam.registered ? 'مشاهده جزئیات آزمون' : 'ثبت‌نام در آزمون'}
                <Icon name="back" className="h-4 w-4" />
              </button>
              <p className="text-[11px] text-[#7a7a7a]">
                تاکنون {faNum(featuredExam.participantsCount)} نفر ثبت‌نام کرده‌اند
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── آزمونک‌های سریع ── */}
      {quizzes.length > 0 && (
        <section aria-label="آزمونک‌های سریع" className="dash-stagger grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex items-center justify-between gap-4 rounded-[1.6rem] border border-white/[0.06] bg-[#242426] p-5"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[15px] text-white [font-family:'Doran',Tahoma,sans-serif]">{quiz.title}</strong>
                  <StatusBadge status={quiz.status} size="sm" />
                </div>
                <p className="text-xs text-[#9a9a9a]">
                  {faNum(quiz.effectiveQuestionCount)} سؤال • {formatDuration(quiz.duration)} • بدون ثبت‌نام
                </p>
              </div>
              <button
                type="button"
                onClick={() => onQuickStart(quiz.slug)}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#61D192]/15 px-4 py-2.5 text-xs font-bold text-[#61D192] transition-colors hover:bg-[#61D192]/25"
              >
                <Icon name="play" className="h-3.5 w-3.5" />
                شروع سریع
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ── Timeline آزمون‌های آینده ── */}
      {timelineMonths.length > 0 && (
        <section aria-label="تقویم آزمون‌های آینده" className="dash-stagger space-y-3">
          <h2 className="flex items-center gap-2 text-base text-white [font-family:'Doran',Tahoma,sans-serif]">
            <Icon name="calendar" className="h-4.5 w-4.5 text-[#937fcd]" />
            تقویم آزمون‌ها
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {timelineMonths.map(([month, items]) => (
              <div key={month} className="min-w-[15rem] flex-1 space-y-2 rounded-[1.4rem] bg-[#242426] p-4">
                <p className="text-xs font-bold text-[#937fcd]">{month}</p>
                {items.map((exam) => (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => onOpenExam(exam.slug)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-right text-xs text-[#ccc] transition-colors hover:bg-white/[0.07]"
                  >
                    <span className="truncate">{exam.shortName}</span>
                    <span className="shrink-0 text-[11px] text-[#8a8a8a]">{formatShortDate(exam.startTime)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── فیلتر و جست‌وجو ── */}
      <section aria-label="فهرست آزمون‌ها" className="dash-stagger space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={statusFilter === filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs transition-colors [font-family:'Doran',Tahoma,sans-serif] ${
                  statusFilter === filter.id ? 'bg-[#61D192] text-[#0d1f16]' : 'bg-[#242426] text-[#aaa] hover:bg-[#2e2e30] hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="فیلتر نوع آزمون"
              className="cursor-pointer rounded-xl border border-white/[0.08] bg-[#242426] px-3.5 py-2.5 text-xs text-[#ccc] outline-none focus:border-[#61D192]/50"
            >
              {typeOptions.map((option) => (
                <option key={option.id} value={option.id} className="bg-[#242426]">
                  {option.label}
                </option>
              ))}
            </select>
            <label className="relative">
              <Icon name="search" className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a7a7a]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جست‌وجوی آزمون…"
                aria-label="جست‌وجوی آزمون"
                className="w-full rounded-xl border border-white/[0.08] bg-[#242426] py-2.5 pr-10 pl-3 text-xs text-white placeholder:text-[#666] outline-none focus:border-[#61D192]/50 sm:w-56"
              />
            </label>
          </div>
        </div>

        {filteredList.length > 0 ? (
          <div className="space-y-3">
            {filteredList.map((exam) => (
              <ExamRow key={exam.id} exam={exam} onOpen={onOpenExam} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="search"
            title="آزمونی پیدا نشد"
            note="با تغییر فیلترها یا عبارت جست‌وجو دوباره تلاش کن؛ آزمون‌های جدید به‌زودی اضافه می‌شوند."
          />
        )}
      </section>
    </div>
  );
}
