/*
 * لیگ تپش — لایهٔ اجتماعی و انگیزشی روی سیستم آموزشی.
 *
 * معماری این بخش (مستند کامل: README.md کنار همین پوشه):
 *   LeagueSection  → پوستهٔ لایه: هیرو وسط‌چین، نردبان لیگ، ناوبری زیربخش‌ها
 *   Leaderboard    → سه مقیاس رقابت + پودیوم + کاربر چسبان
 *   Challenges     → روزانه/هفتگی/نبرد/دوئل
 *   LeagueAchievements → دستاوردها با کمیابی
 *   LeagueProfile  → آمار، استریک، دفتر قلب، فصل‌ها، ریوارد، حریم خصوصی، سطح‌بندی
 * همهٔ داده‌ها از src/services/league/leagueService.js می‌آیند (فعلاً Mock، قرارداد API واقعی).
 *
 * نمای کلی: کادر «سران جدول دانشگاهت» (شناسنامهٔ دانشگاه درونش ترکیب شده) و زیر آن یک ردیف
 * سه‌کادری: «رتبه بعدی نزدیک است!» / «رویدادهای زنده» / «امروز چیکار می‌تونی بکنی؟».
 * اطلاعات سطح‌بندی (آیکن «؟») در تب پروفایل نشسته است.
 */
import { useEffect, useState } from 'react';
import {
  fetchChallenges,
  fetchLeaderboard,
  fetchLeagueOverview,
  trackEvent,
} from '../../../services/league/leagueService';
import './league.css';
import Challenges from './Challenges';
import Leaderboard, { LeaderRow, PodiumCard } from './Leaderboard';
import LeagueAchievements from './LeagueAchievements';
import LeagueProfile from './LeagueProfile';
import {
  HeartReward,
  Icon,
  IconHeart,
  ProgressBar,
  Skeleton,
  faNum,
  toFa,
} from './leagueShared';
import { useAsyncData } from './useAsyncData';

const VIEWS = [
  { id: 'overview', label: 'نمای کلی', icon: 'spark', accent: '#e0b45c' },
  { id: 'board', label: 'جدول رتبه‌بندی', icon: 'trophy', accent: '#5b8cc7' },
  { id: 'challenges', label: 'چالش‌ها', icon: 'swords', accent: '#ef9196' },
  { id: 'achievements', label: 'دستاوردها', icon: 'star', accent: '#61d192' },
  { id: 'profile', label: 'پروفایل', icon: 'users', accent: '#937fcd' },
];

function LeagueErrorState({ onRetry }) {
  return (
    <div className="rounded-[2.5rem] bg-[var(--surface-soft)] p-10 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#ff6969]/12 text-[var(--red-ink)]">
        <Icon name="warn" className="h-7 w-7" />
      </span>
      <strong className="block text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">لیگ این لحظه در دسترس نیست</strong>
      <p className="mt-2 text-sm text-[var(--faint)]">اتصالت را چک کن و دوباره تلاش کن.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 cursor-pointer rounded-xl bg-[var(--purple-bright)] px-6 py-2.5 text-sm text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
      >
        تلاش دوباره
      </button>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-44 rounded-[2.5rem]" />
      <Skeleton className="h-16 rounded-[1.75rem]" />
    </div>
  );
}

/* ── کادر «رتبه بعدی نزدیک است!» ── */
function NextRankCard({ overview, hearts, onOpenView }) {
  const current = hearts ?? overview.me.hearts;

  return (
    <section
      aria-label="تا رتبه بعدی"
      className="flex flex-col rounded-[2.5rem] border border-[#e26d6d]/30 bg-gradient-to-l from-[#e26d6d]/10 to-transparent p-5 md:p-7"
    >
      <h2 className="flex items-center gap-2 text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">
        <Icon name="up" className="h-5 w-5 text-[var(--red-ink)]" />
        رتبه بعدی نزدیک است!
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-[#e26d6d]/15 text-2xl text-[var(--red-ink)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          #{toFa(overview.nextRank.rank)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-[var(--white)]">
            فقط <strong className="text-[var(--red-ink)]">{faNum(overview.nextRank.gap)} قلب</strong> تا ورود به رتبهٔ{' '}
            {toFa(overview.nextRank.rank)}!
          </p>
          <ProgressBar
            value={current}
            max={current + overview.nextRank.gap}
            color="var(--red-ink)"
            height={8}
            className="mt-3"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenView('challenges')}
        className="mt-5 w-fit cursor-pointer rounded-xl bg-[#e26d6d]/15 px-4 py-2 text-xs text-[var(--red-ink)] transition-colors hover:bg-[#e26d6d]/25"
      >
        چالش‌های امروز را ببین
      </button>
    </section>
  );
}

/* ── رویدادهای زنده ── */
function LiveEventsCard({ events }) {
  return (
    <section aria-label="رویدادهای زنده" className="flex flex-col rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
      <h2 className="flex items-center gap-2 text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">
        <i className="lg-live-dot inline-block h-2 w-2 rounded-full bg-[var(--green-bright)]" />
        رویدادهای زنده
      </h2>
      <ul className="mt-4 flex-1 space-y-2.5">
        {events.map((event) => (
          <li key={event.id} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${event.accent}1f`, color: event.accent }}>
              <Icon name={event.status === 'live' ? 'flame' : 'calendar'} className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{event.title}</strong>
              <span className="block truncate text-[11px] text-[var(--faint)]">{event.note}</span>
            </span>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px]" style={{ background: `${event.accent}14`, color: event.accent }}>
              {event.leftLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── امروز چیکار می‌تونی بکنی؟ — چالش‌های روزانه + هفتگی ── */
function TodayCard({ dailies, weekly, loading, onOpenView }) {
  return (
    <section aria-label="چالش‌های در جریان" className="flex flex-col rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">امروز چیکار می‌تونی بکنی؟</h2>
        <button
          type="button"
          onClick={() => onOpenView('challenges')}
          className="cursor-pointer text-xs text-[var(--purple-ink)] transition-colors hover:text-[var(--purple-soft-ink)]"
        >
          همهٔ چالش‌ها
        </button>
      </header>

      <div className="flex-1 space-y-2.5">
        {loading
          ? Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)
          : dailies.map((challenge) => (
              <div key={challenge.id} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[var(--surface-soft)] px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#937fcd]/15 text-[var(--purple-soft-ink)]">
                  <Icon name={challenge.icon} className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{challenge.title}</strong>
                  <ProgressBar value={challenge.progress} max={challenge.goal} height={5} className="mt-1.5" />
                </span>
                <HeartReward amount={challenge.reward} />
              </div>
            ))}

        {weekly && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#e0b45c]/25 bg-[#e0b45c]/[0.05] px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e0b45c]/15 text-[var(--gold-ink)]">
              <Icon name="trophy" className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">هفتگی: {weekly.title}</strong>
              <ProgressBar value={weekly.progress} max={weekly.goal} color="var(--gold-ink)" height={5} className="mt-1.5" />
            </span>
            <span className="shrink-0 text-xs text-[var(--muted)]">
              {toFa(weekly.progress)}/{toFa(weekly.goal)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── سران جدول دانشگاهت + شناسنامهٔ دانشگاه، در یک کادر واحد ── */
function LeadersCard({ overview, board, onOpenView }) {
  const uniBoard = useAsyncData(() => fetchLeaderboard({ scope: 'universities', metric: 'total', offset: 0 }), []);
  const uni = (uniBoard.data?.items ?? []).find((item) => item.id === 'qom');

  const items = board.data?.items ?? [];
  const topThree = items.filter((item) => item.rank <= 3);
  const youRow = items.find((item) => item.isYou);

  return (
    <section aria-label="سران جدول دانشگاهت" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-7">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">سران جدول دانشگاهت</h2>
        <button
          type="button"
          onClick={() => onOpenView('board')}
          className="cursor-pointer text-xs text-[var(--purple-ink)] transition-colors hover:text-[var(--purple-soft-ink)]"
        >
          جدول کامل
        </button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div>
          {board.loading ? (
            <Skeleton className="h-40 rounded-[1.75rem]" />
          ) : (
            <>
              <div className="flex items-end gap-2.5">
                <PodiumCard entry={topThree[1]} place={2} />
                <PodiumCard entry={topThree[0]} place={1} />
                <PodiumCard entry={topThree[2]} place={3} />
              </div>
              {youRow && (
                <ul className="mt-3">
                  <LeaderRow entry={youRow} />
                </ul>
              )}
            </>
          )}
        </div>

        {/* شناسنامهٔ دانشگاه — ترکیب‌شده با همین کادر */}
        <div className="rounded-[1.75rem] border border-white/6 bg-[rgb(var(--wash-rgb)/0.03)] p-4 md:p-5">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">دانشگاه تو</h3>
            {uni && (
              <span className="rounded-full bg-[#5b8cc7]/15 px-3 py-1 text-xs text-[var(--blue-soft-ink)]">
                رتبهٔ #{toFa(uni.rank)} کشور
              </span>
            )}
          </header>

          {uniBoard.loading || !uni ? (
            <Skeleton className="mt-4 h-32 rounded-2xl" />
          ) : (
            <>
              <strong className="mt-3 block text-base">{uni.name}</strong>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {[
                  { label: 'قلب کل', value: faNum(uni.total), heart: true },
                  { label: 'دانشجوی فعال', value: faNum(uni.active) },
                  { label: 'رتبهٔ فصل', value: `#${toFa(overview.me.seasonRank)}` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/6 bg-[var(--surface-soft)] p-3 text-center">
                    {stat.heart ? (
                      <IconHeart className="mx-auto mb-1 h-4 w-4" />
                    ) : (
                      <Icon name="users" className="mx-auto mb-1 h-4 w-4 text-[var(--green-ink)]" />
                    )}
                    <strong className="block text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">{stat.value}</strong>
                    <span className="text-[11px] text-[var(--faint)]">{stat.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[var(--faint)]">
                رتبهٔ دانشگاه با میانگین و نرخ مشارکت هم قابل محاسبه است؛ این معیارها به‌زودی از پنل مدیریت تنظیم می‌شوند.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* نمای کلی — سران جدول دانشگاه بالا، سپس رتبه بعدی / رویدادهای زنده / چالش‌های امروز */
function Overview({ overview, hearts, onOpenView }) {
  /* صفحهٔ اول سران جدول + صفحه‌ای که کاربر در آن است */
  const board = useAsyncData(
    () =>
      Promise.all([
        fetchLeaderboard({ scope: 'university', offset: 0 }),
        fetchLeaderboard({ scope: 'university', offset: 10 }),
      ]).then(([first, second]) => ({ items: [...first.items, ...second.items] })),
    [],
  );
  const challenges = useAsyncData(() => fetchChallenges(), []);

  return (
    <div className="space-y-6">
      <LeadersCard overview={overview} board={board} onOpenView={onOpenView} />

      <div className="grid gap-6 xl:grid-cols-3">
        <NextRankCard overview={overview} hearts={hearts} onOpenView={onOpenView} />
        <LiveEventsCard events={overview.liveEvents} />
        <TodayCard
          dailies={(challenges.data?.daily ?? []).slice(0, 2)}
          weekly={challenges.data?.weekly}
          loading={challenges.loading}
          onOpenView={onOpenView}
        />
      </div>
    </div>
  );
}

export default function LeagueSection({ userData }) {
  const { data: overview, loading, error, retry } = useAsyncData(() => fetchLeagueOverview(userData), [userData]);
  const [activeView, setActiveView] = useState('overview');
  const [hearts, setHearts] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    trackEvent('league_view');
  }, []);

  useEffect(() => {
    if (overview && hearts === null) setHearts(overview.me.hearts);
  }, [overview, hearts]);

  /* کسب قلب: به‌روزرسانی اعداد + توست لحظه‌ای (در نسخهٔ واقعی نتیجهٔ POST claim سمت سرور است) */
  const handleEarnHearts = (amount, label) => {
    setHearts((prev) => (prev ?? 0) + amount);
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, amount, label }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 2800);
    trackEvent('heart_earned', { amount, label });
  };

  const openView = (viewId) => {
    setActiveView(viewId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const me = overview?.me
    ? { ...overview.me, hearts: hearts ?? overview.me.hearts, tier: overview.tier, tierProgress: overview.tierProgress }
    : null;

  return (
    <section dir="rtl" aria-label="لیگ تپش" className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]">
      {/* سربرگ وسط‌چین لایه — همانند هیروی فلش‌کارت */}
      <header className="lg-hero dash-stagger">
        <h1 className="lg-hero__title">
          <span className="lg-hero__title-top">سیستم رقابت و انگیزه</span>
          <span className="lg-hero__title-accent">لیگ تپش</span>
        </h1>
        <p className="lg-hero__subtitle">
          با هم‌دانشگاهی‌هایت رقابت کن، چالش روزانه را بزن و هر روز قلبی بیشتر بساز — جدول هر لحظه زنده است.
        </p>
      </header>

      {loading && <HeroSkeleton />}
      {error && <LeagueErrorState onRetry={retry} />}

      {overview && me && (
        <div className="space-y-6">
          {/* ناوبری زیربخش‌ها — چیپ‌های هم‌ریخت با فلش‌کارت، وسط‌چین */}
          <nav className="lg-scroll-x dash-stagger mb-6 overflow-x-auto pb-2" aria-label="بخش‌های لیگ">
            <div className="mx-auto flex w-max gap-2.5">
              {VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  aria-current={activeView === view.id ? 'page' : undefined}
                  onClick={() => setActiveView(view.id)}
                  className={`flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-[13px] transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                    activeView === view.id
                      ? 'border-[#937fcd]/60 bg-[#937fcd]/15 text-white'
                      : 'border-white/8 bg-[var(--surface)] text-[var(--muted)] hover:border-white/20 hover:bg-[var(--surface-soft)] hover:text-white'
                  }`}
                >
                  <Icon name={view.icon} className="h-4 w-4 shrink-0" style={{ color: view.accent }} />
                  {view.label}
                </button>
              ))}
            </div>
          </nav>

          {/* محتوای زیربخش */}
          <div key={activeView}>
            {activeView === 'overview' && <Overview overview={overview} hearts={hearts} onOpenView={openView} />}
            {activeView === 'board' && <Leaderboard me={me} />}
            {activeView === 'challenges' && <Challenges me={me} onEarnHearts={handleEarnHearts} />}
            {activeView === 'achievements' && <LeagueAchievements />}
            {activeView === 'profile' && (
              <LeagueProfile userData={userData} me={me} levelProgress={overview.levelProgress} />
            )}
          </div>
        </div>
      )}

      {/* توست‌های قلب */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="lg-toast flex items-center gap-2.5 rounded-full border border-[#e26d6d]/40 bg-[#26191b]/95 px-5 py-3 text-sm shadow-[0_18px_40px_-14px_rgb(var(--shadow-rgb) / 0.9)] backdrop-blur"
          >
            <span className="lg-heart-pop">
              <IconHeart className="h-5 w-5" />
            </span>
            <strong className="text-[var(--red-ink)]">+{faNum(toast.amount)} قلب</strong>
            <span className="text-[var(--muted)]">· {toast.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
