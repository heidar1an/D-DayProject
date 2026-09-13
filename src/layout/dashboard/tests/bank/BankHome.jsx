/*
 * BankHome — داشبورد ورود به بانک تست. همهٔ مسیرهای تست‌زدن («چطور می‌خواهی تست بزنی؟»)
 * کارت‌های داده‌محورند و با افزودن آیتم جدید به آرایه، بدون تغییر UI اضافه می‌شوند.
 */
import { useState } from 'react';
import {
  DIFFICULTIES,
  EmptyState,
  Icon,
  Skeleton,
  SourceBadge,
  faNum,
  toFa,
} from './bankShared';
import { formatAgo } from './bankShared';

const MODE_LABEL = { practice: 'تمرین', exam: 'آزمون', review: 'مرور' };

/* کارت مسیر — واحد تکرارشوندهٔ بخش «چطور می‌خواهی تست بزنی؟» */
function PathCard({ icon, accent = '#61D192', title, description, meta, onClick, wide = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex cursor-pointer flex-col justify-between gap-4 rounded-[1.75rem] border border-white/8 bg-[#242426] p-5 text-right transition-all hover:-translate-y-0.5 hover:border-white/16 hover:bg-[#2a2a2c] ${
        wide ? 'md:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: `${accent}14`, color: accent }}
        >
          <Icon name={icon} className="h-5.5 w-5.5" />
        </span>
        {meta != null && meta !== '' && (
          <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-[#aaa]">{meta}</span>
        )}
      </div>
      <div>
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold [font-family:'Doran',Tahoma,sans-serif]">
          {title}
          <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90 text-[#666] transition-colors group-hover:text-[#61D192]" />
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-6 text-[#9a9a9a]">{description}</p>
      </div>
    </button>
  );
}

/* ── جستجوی سریع سربرگ ── */
function HeroSearch({ onSearch }) {
  const [query, setQuery] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) onSearch(query.trim());
      }}
      className="relative"
      role="search"
    >
      <Icon name="search" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#777]" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="جستجو در سؤال‌ها… مثلاً «پتانسیل عمل»"
        aria-label="جستجوی سؤال در بانک تست"
        className="w-full rounded-2xl border border-white/8 bg-[#2a2a2a] py-3.5 pe-4 ps-12 text-sm text-white placeholder:text-[#666] focus:border-[#61D192]/50 focus:outline-none"
      />
      {query.trim() && (
        <button
          type="submit"
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-xl bg-[#61D192] px-4 py-2 text-xs font-bold text-[#12271a] transition-transform hover:-translate-y-[calc(50%+2px)]"
        >
          جستجو
        </button>
      )}
    </form>
  );
}

/* ── کارت انتخاب درس ── */
export function SubjectPicker({ overview, onPick }) {
  return (
    <div>
      <p className="mb-4 text-sm text-[#9a9a9a]">درس را انتخاب کن تا سؤال‌های همان درس باز شود.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {overview.subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            disabled={subject.questionCount === 0}
            onClick={() => onPick(subject.id)}
            className={`group flex items-center justify-between gap-2 rounded-2xl border border-white/8 bg-[#242426] px-4 py-3.5 text-right transition-colors ${
              subject.questionCount ? 'cursor-pointer hover:border-white/20 hover:bg-[#2a2a2c]' : 'cursor-default opacity-45'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject.accent }} aria-hidden="true" />
              <span className="truncate text-[13.5px] font-bold [font-family:'Doran',Tahoma,sans-serif]">{subject.name}</span>
            </span>
            <span className="shrink-0 text-[11px] text-[#888]">
              {subject.questionCount ? `${toFa(subject.questionCount)} سؤال` : 'به‌زودی'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════ BankHome ══════════════════════════ */
export default function BankHome({ overview, onNavigate }) {
  if (!overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-52 rounded-[2.5rem]" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-[1.75rem]" />
          ))}
        </div>
      </div>
    );
  }

  const { bank, user, tags } = overview;

  const pathCards = [
    {
      icon: 'calendar',
      title: 'آزمون‌های سال به سال',
      description: 'سؤال‌های رسمی آزمون علوم پایه، سال‌به‌سال و هم‌سو با سبک وزارت بهداشت',
      meta: `${toFa(bank.yearsCovered)} سال`,
      onClick: () => onNavigate('years'),
    },
    {
      icon: 'layers',
      title: 'تست مبحثی',
      description: 'درس ← مبحث ← زیرمبحث را انتخاب کن و تمرین کن',
      onClick: () => onNavigate('topics'),
    },
    {
      icon: 'book',
      title: 'بر اساس درس',
      description: 'فیزیولوژی، آناتومی، بیوشیمی و سایر دروس علوم پایه',
      meta: `${toFa(bank.subjectsCovered)} درس`,
      onClick: () => onNavigate('subjects'),
    },
    {
      icon: 'spark',
      accent: '#937fcd',
      title: 'منتخب تپش',
      description: 'سؤال‌هایی که تیم محتوا برای مرور جدی انتخاب کرده است',
      meta: `${toFa(tags.featured)} سؤال`,
      onClick: () => onNavigate('browse', { filters: { tags: ['منتخب'] } }),
    },
    {
      icon: 'x',
      accent: '#e26d6d',
      title: 'غلط‌های من',
      description: user.wrongCount
        ? 'سؤال‌هایی که تا الان اشتباه زده‌ای؛ وقت مرورشان رسیده'
        : 'هنوز سؤالی اشتباه نزده‌ای',
      meta: user.wrongCount ? `${toFa(user.wrongCount)} سؤال` : null,
      onClick: () => user.wrongCount && onNavigate('browse', { filters: { status: 'wrong' } }),
    },
    {
      icon: 'heart',
      accent: '#ef9196',
      title: 'نشان‌شده‌ها',
      description: user.bookmarkCount ? 'گلچین‌های خودت برای مرور سریع' : 'سؤال‌های مهم را با قلب نشان بگیر',
      meta: user.bookmarkCount ? `${toFa(user.bookmarkCount)} سؤال` : null,
      onClick: () => user.bookmarkCount && onNavigate('browse', { filters: { status: 'bookmarked' } }),
    },
    {
      icon: 'target',
      accent: '#e0b45c',
      title: 'تست‌های پرتکرار',
      description: 'سؤال‌هایی که در آزمون‌های اخیر بیشترین تکرار را دارند',
      meta: `${toFa(tags.frequent)} سؤال`,
      onClick: () => onNavigate('browse', { filters: { tags: ['پرتکرار'] } }),
    },
    {
      icon: 'bolt',
      accent: '#ef9196',
      title: 'تست‌های چالشی',
      description: 'سخت و بسیار سخت؛ برای حس‌کردن سقف آمادگی',
      meta: `${toFa(tags.challenging)} سؤال`,
      onClick: () => onNavigate('browse', { filters: { difficulties: ['hard', 'very_hard'] } }),
    },
    {
      icon: 'dice',
      accent: '#5b8cc7',
      title: 'آزمون تصادفی',
      description: 'از کل بانک، سؤال‌های شانسی در حالت آزمون',
      onClick: () => onNavigate('builder', { preset: 'random' }),
    },
    {
      icon: 'card',
      accent: '#b99a86',
      title: 'آزمون‌های من',
      description: user.sessionCount
        ? 'آزمون‌های ذخیره‌شده‌ات با روند پیشرفت و تلاش‌های اخیر'
        : 'آزمون‌هایی که در آزمون‌ساز ذخیره می‌کنی اینجا می‌مانند',
      onClick: () => onNavigate('my-exams'),
      wide: true,
    },
    {
      icon: 'target',
      accent: '#937fcd',
      title: 'آزمون‌ساز شخصی',
      description: 'هدف، درس، مبحث، سختی، زمان و Blueprint — آزمون دقیقاً به‌اندازهٔ نیازت بساز',
      onClick: () => onNavigate('builder'),
      wide: true,
    },
  ];

  const quickAccess = [
    { icon: 'heart', label: 'نشان‌شده‌ها', count: user.bookmarkCount, filters: { status: 'bookmarked' } },
    { icon: 'x', label: 'غلط‌های من', count: user.wrongCount, filters: { status: 'wrong' } },
    { icon: 'refresh', label: 'نیاز به مرور', count: user.reviewCount, filters: { status: 'review' } },
    { icon: 'history', label: 'تاریخچه', count: user.sessionCount, history: true },
  ];

  return (
    <div className="space-y-6">
      {/* ── سربرگ + جستجو ── */}
      <section className="dash-stagger rounded-[2.5rem] border border-white/8 bg-[#242426] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#61D192] [font-family:'Doran',Tahoma,sans-serif] md:text-3xl">
              بانک تست علوم پایه
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[#aaa]">
              {faNum(bank.totalQuestions)} سؤال از {toFa(bank.subjectsCovered)} درس و {toFa(bank.yearsCovered)} سال
              آزمون؛ با تحلیل کامل هر سؤال و آمار واقعی پاسخ‌دهندگان. هر تست را به یک واحد یادگیری تبدیل کن.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <span className="tb-badge" style={{ background: 'rgba(97,209,146,0.1)', color: '#61D192' }}>
              <Icon name="users" className="h-3.5 w-3.5" />
              {faNum(bank.totalSolves)} حل ثبت‌شده
            </span>
          </div>
        </div>

        <div className="mt-5">
          <HeroSearch onSearch={(search) => onNavigate('browse', { filters: { search } })} />
        </div>

        {/* دسترسی سریع */}
        <div className="mt-4 flex flex-wrap gap-2">
          {quickAccess.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => (item.history ? onNavigate('history') : onNavigate('browse', { filters: item.filters }))}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2 text-xs text-[#bbb] transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon name={item.icon} className="h-3.5 w-3.5" />
              {item.label}
              <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-[#ddd]">{toFa(item.count)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── آمار کاربر ── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="آمار تو در بانک تست">
        {[
          { label: 'سؤال حل‌شده', value: user.solvedCount, accent: '#61D192' },
          { label: 'دقت کل', value: user.accuracy === null ? '—' : `${toFa(user.accuracy)}٪`, accent: '#937fcd' },
          { label: 'سشن کامل‌شده', value: user.sessionCount, accent: '#5b8cc7' },
          { label: 'میانگین پاسخ جامعه', value: `${toFa(bank.averageCorrect)}٪`, accent: '#e0b45c' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-white/8 bg-[#242426] px-4 py-4 text-center">
            <strong className="block text-xl [font-family:'Doran',Tahoma,sans-serif]" style={{ color: stat.accent }}>
              {typeof stat.value === 'number' ? faNum(stat.value) : stat.value}
            </strong>
            <span className="mt-1 block text-[11px] text-[#8a8a8a]">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* ── مسیرها ── */}
      <section aria-label="چطور می‌خواهی تست بزنی؟">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold [font-family:'Doran',Tahoma,sans-serif]">چطور می‌خواهی تست بزنی؟</h2>
          <span className="h-px flex-1 bg-white/8" aria-hidden="true" />
        </div>
        <div className="dash-stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pathCards.map((card) => (
            <PathCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      {/* ── آخرین سشن‌ها ── */}
      <section aria-label="آخرین سشن‌های تو">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold [font-family:'Doran',Tahoma,sans-serif]">آخرین کارنامه‌ها</h2>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="flex cursor-pointer items-center gap-1 text-xs text-[#61D192] transition-colors hover:text-[#7ee0ac]"
          >
            تاریخچهٔ کامل
            <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
          </button>
        </div>
        {user.history.length === 0 ? (
          <EmptyState
            icon="history"
            title="هنوز سشنی نداری"
            note="اولین تمرین یا آزمون‌ات را بزن؛ کارنامه و تحلیل همان‌جا ساخته می‌شود."
            action={
              <button
                type="button"
                onClick={() => onNavigate('topics')}
                className="mt-3 cursor-pointer rounded-xl bg-[#61D192] px-5 py-2.5 text-sm font-bold text-[#12271a] transition-transform hover:-translate-y-0.5"
              >
                شروع تمرین
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-white/6 overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#242426]">
            {user.history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate('result', { sessionId: item.id })}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-right transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        item.mode === 'exam' ? 'bg-[#937fcd]/15 text-[#c9bdf0]' : 'bg-[#61D192]/12 text-[#61D192]'
                      }`}
                    >
                      <Icon name={item.mode === 'exam' ? 'timer' : 'book'} className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-[13.5px] [font-family:'Doran',Tahoma,sans-serif]">{item.title}</strong>
                      <span className="text-[11px] text-[#8a8a8a]">
                        {MODE_LABEL[item.mode] ?? item.mode} · {faNum(item.total)} سؤال · {formatAgo(item.submittedAt)}
                      </span>
                    </span>
                  </span>
                  {item.percentage !== null && (
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold [font-family:'Doran',Tahoma,sans-serif] ${
                        item.percentage >= 60 ? 'bg-[#61D192]/12 text-[#61D192]' : 'bg-[#e26d6d]/12 text-[#ef9196]'
                      }`}
                    >
                      {toFa(item.percentage)}٪
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
