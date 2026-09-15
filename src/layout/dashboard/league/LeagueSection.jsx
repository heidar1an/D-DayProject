/*
 * لیگ تپش — لایهٔ اجتماعی و انگیزشی روی سیستم آموزشی.
 *
 * معماری این بخش (مستند کامل: README.md کنار همین پوشه):
 *   LeagueSection  → پوستهٔ لایه: هیرو (League Header)، نردبان لیگ، ناوبری زیربخش‌ها
 *   Leaderboard    → سه مقیاس رقابت + پودیوم + کاربر چسبان
 *   Challenges     → روزانه/هفتگی/نبرد/دوئل
 *   LeagueAchievements → دستاوردها با کمیابی
 *   LeagueProfile  → آمار، استریک، دفتر قلب، فصل‌ها، ریوارد، حریم خصوصی
 * همهٔ داده‌ها از src/services/league/leagueService.js می‌آیند (فعلاً Mock، قرارداد API واقعی).
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
  TierBadge,
  UserAvatar,
  faNum,
  toFa,
} from './leagueShared';
import { useAsyncData } from './useAsyncData';

const VIEWS = [
  { id: 'overview', label: 'نمای کلی', icon: 'spark' },
  { id: 'board', label: 'جدول رتبه‌بندی', icon: 'trophy' },
  { id: 'challenges', label: 'چالش‌ها', icon: 'swords' },
  { id: 'achievements', label: 'دستاوردها', icon: 'star' },
  { id: 'profile', label: 'پروفایل', icon: 'users' },
];

/* شمارش معکوس زندهٔ فصل */
function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!endsAt) return '';
  const left = Math.max(0, endsAt - now);
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const minutes = Math.floor((left % 3600000) / 60000);
  return `${toFa(days)} روز و ${toFa(hours)}:${toFa(String(minutes).padStart(2, '0'))}`;
}

function LeagueErrorState({ onRetry }) {
  return (
    <div className="rounded-[2.5rem] bg-[#282828] p-10 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#ff6969]/12 text-[#ff6969]">
        <Icon name="warn" className="h-7 w-7" />
      </span>
      <strong className="block text-lg [font-family:'Doran',Tahoma,sans-serif]">لیگ این لحظه در دسترس نیست</strong>
      <p className="mt-2 text-sm text-[#8a8a8a]">اتصالت را چک کن و دوباره تلاش کن.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 cursor-pointer rounded-xl bg-[#937fcd] px-6 py-2.5 text-sm text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran',Tahoma,sans-serif]"
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

/* نوار نردبان لیگ‌ها — جایگاه فعلی، ناحیهٔ صعود و سقوط */
function LeagueLadder({ tiers, currentTier, meRank }) {
  return (
    <div className="rounded-[1.75rem] border border-white/8 bg-black/25 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {tiers.map((tier) => {
          const isCurrent = tier.id === currentTier.id;
          return (
            <span
              key={tier.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                isCurrent ? 'font-bold' : 'text-[#8a8a8a]'
              }`}
              style={
                isCurrent
                  ? { background: `${tier.color}22`, color: tier.color, boxShadow: `inset 0 0 0 1px ${tier.color}66` }
                  : undefined
              }
            >
              <Icon name={tier.icon} className="h-3.5 w-3.5" style={{ color: tier.color }} />
              {tier.name}
              {isCurrent && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white">تو اینجایی</span>}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[#8a8a8a]">
        پایان فصل: <span className="text-[#9ed3ab]">۳ نفر اول صعود</span> می‌کنند،{' '}
        <span className="text-[#ef9196]">۳ نفر آخر سقوط</span> — جایگاهت همین حالا: رتبهٔ {toFa(meRank)} {currentTier.name}.
      </p>
    </div>
  );
}

/* نمای کلی — پاسخ سریع به «کجاییم، چند قلب دارم، چی تا رتبهٔ بعدی مونده؟» */
function Overview({ overview, onOpenView }) {
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

  const topThree = (board.data?.items ?? []).filter((item) => item.rank <= 3);
  const youRow = (board.data?.items ?? []).find((item) => item.isYou);
  const dailies = (challenges.data?.daily ?? []).slice(0, 2);
  const weekly = challenges.data?.weekly;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* فاصله تا رتبه بعدی */}
        <section aria-label="تا رتبه بعدی" className="rounded-[2.5rem] border border-[#e26d6d]/30 bg-gradient-to-l from-[#e26d6d]/10 to-transparent p-5 md:p-7">
          <h2 className="flex items-center gap-2 text-lg [font-family:'Doran',Tahoma,sans-serif]">
            <Icon name="up" className="h-5 w-5 text-[#ef9196]" />
            رتبه بعدی نزدیک است!
          </h2>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-[#e26d6d]/15 text-2xl text-[#ef9196] [font-family:'Doran',Tahoma,sans-serif]">
              #{toFa(overview.nextRank.rank)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-6 text-[#e6e6e6]">
                فقط <strong className="text-[#ef9196]">{faNum(overview.nextRank.gap)} قلب</strong> تا ورود به رتبهٔ {toFa(overview.nextRank.rank)}!
              </p>
              <ProgressBar value={overview.me.hearts} max={overview.me.hearts + overview.nextRank.gap} color="#e26d6d" height={8} className="mt-3" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenView('challenges')}
            className="mt-5 cursor-pointer rounded-xl bg-[#e26d6d]/15 px-4 py-2 text-xs text-[#ef9196] transition-colors hover:bg-[#e26d6d]/25"
          >
            چالش‌های امروز را ببین
          </button>
        </section>

        {/* رویدادهای زنده */}
        <section aria-label="رویدادهای زنده" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-7">
          <h2 className="flex items-center gap-2 text-lg [font-family:'Doran',Tahoma,sans-serif]">
            <i className="lg-live-dot inline-block h-2 w-2 rounded-full bg-[#77b787]" />
            رویدادهای زنده
          </h2>
          <ul className="mt-4 space-y-2.5">
            {overview.liveEvents.map((event) => (
              <li key={event.id} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[#2a2a2a] px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${event.accent}1f`, color: event.accent }}>
                  <Icon name={event.status === 'live' ? 'flame' : 'calendar'} className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{event.title}</strong>
                  <span className="block truncate text-[11px] text-[#8a8a8a]">{event.note}</span>
                </span>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px]" style={{ background: `${event.accent}14`, color: event.accent }}>
                  {event.leftLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* خلاصهٔ جدول */}
        <section aria-label="خلاصه جدول رتبه‌بندی" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-7">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-lg [font-family:'Doran',Tahoma,sans-serif]">سران جدول دانشگاهت</h2>
            <button
              type="button"
              onClick={() => onOpenView('board')}
              className="cursor-pointer text-xs text-[#937fcd] transition-colors hover:text-[#c9bdf0]"
            >
              جدول کامل
            </button>
          </header>

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
        </section>

        {/* چالش‌های امروز + هفتگی */}
        <section aria-label="چالش‌های در جریان" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-7">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-lg [font-family:'Doran',Tahoma,sans-serif]">امروز چیکار می‌تونی بکنی؟</h2>
            <button
              type="button"
              onClick={() => onOpenView('challenges')}
              className="cursor-pointer text-xs text-[#937fcd] transition-colors hover:text-[#c9bdf0]"
            >
              همهٔ چالش‌ها
            </button>
          </header>

          <div className="space-y-2.5">
            {challenges.loading
              ? Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)
              : dailies.map((challenge) => (
                  <div key={challenge.id} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[#2a2a2a] px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#937fcd]/15 text-[#b3a3e8]">
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
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e0b45c]/15 text-[#e0b45c]">
                  <Icon name="trophy" className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">هفتگی: {weekly.title}</strong>
                  <ProgressBar value={weekly.progress} max={weekly.goal} color="#e0b45c" height={5} className="mt-1.5" />
                </span>
                <span className="shrink-0 text-xs text-[#aaa]">{toFa(weekly.progress)}/{toFa(weekly.goal)}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* شناسنامهٔ دانشگاه */}
        <UniversityCard overview={overview} />

        {/* فید فعالیت */}
        <section aria-label="فید فعالیت" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-7">
          <h2 className="mb-4 text-lg [font-family:'Doran',Tahoma,sans-serif]">این ساعت در تپش</h2>
          <ul className="space-y-2.5">
            {overview.activity.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[#2a2a2a] px-4 py-3">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.accent }} />
                <span className="min-w-0 flex-1 text-sm">{item.text}</span>
                <span className="shrink-0 text-[11px] text-[#8a8a8a]">{item.time}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[#6d6d6d]">فقط فعالیت‌های عمومی نمایش داده می‌شود؛ تنظیماتش در پروفایل است.</p>
        </section>
      </div>
    </div>
  );
}

/* کارت شناسنامهٔ دانشگاه — رتبه در معیار مجموع + آمار قابل تنظیم */
function UniversityCard({ overview }) {
  const board = useAsyncData(() => fetchLeaderboard({ scope: 'universities', metric: 'total', offset: 0 }), []);
  const uni = (board.data?.items ?? []).find((item) => item.id === 'qom');

  if (board.loading || !uni) return <Skeleton className="h-56 rounded-[2.5rem]" />;

  return (
    <section aria-label="شناسنامهٔ دانشگاه" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-7">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg [font-family:'Doran',Tahoma,sans-serif]">دانشگاه تو</h2>
        <span className="rounded-full bg-[#5b8cc7]/15 px-3 py-1 text-xs text-[#9cc0e8]">رتبهٔ #{toFa(uni.rank)} کشور</span>
      </header>
      <strong className="block text-base">{uni.name}</strong>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'قلب کل', value: faNum(uni.total), heart: true },
          { label: 'دانشجوی فعال', value: faNum(uni.active) },
          { label: 'میانگین قلب', value: faNum(uni.avg) },
          { label: 'رتبهٔ فصل', value: `#${toFa(overview.me.seasonRank)}` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/6 bg-[#2a2a2a] p-3 text-center">
            {stat.heart ? (
              <IconHeart className="mx-auto mb-1 h-4 w-4" />
            ) : (
              <Icon name="users" className="mx-auto mb-1 h-4 w-4 text-[#77b787]" />
            )}
            <strong className="block text-base [font-family:'Doran',Tahoma,sans-serif]">{stat.value}</strong>
            <span className="text-[11px] text-[#8a8a8a]">{stat.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-[#8a8a8a]">
        رتبهٔ دانشگاه با میانگین و نرخ مشارکت هم قابل محاسبه است؛ این معیارها به‌زودی از پنل مدیریت تنظیم می‌شوند.
      </p>
    </section>
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

  /* کسب قلب: به‌روزرسانی هیرو + توست لحظه‌ای (در نسخهٔ واقعی نتیجهٔ POST claim سمت سرور است) */
  const handleEarnHearts = (amount, label) => {
    setHearts((prev) => (prev ?? 0) + amount);
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, amount, label }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 2800);
    trackEvent('heart_earned', { amount, label });
  };

  const countdown = useCountdown(overview?.season.endsAt);

  const openView = (viewId) => {
    setActiveView(viewId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const me = overview?.me
    ? { ...overview.me, hearts: hearts ?? overview.me.hearts, tier: overview.tier, tierProgress: overview.tierProgress }
    : null;

  return (
    <section dir="rtl" aria-label="لیگ تپش" className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]">
      {/* سربرگ لایه */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[#937fcd] md:text-4xl [font-family:'Doran',Tahoma,sans-serif]">لیگ تپش</h1>
          {overview && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#aaa]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#937fcd]/12 px-3 py-1 text-xs text-[#c9bdf0]">
                فصل {toFa(overview.season.number)} · «{overview.season.name}»
              </span>
              <span className="lg-countdown text-xs">
                {toFa(overview.season.durationDays)} روزه — {countdown} مانده
              </span>
            </p>
          )}
        </div>
      </header>

      {loading && <HeroSkeleton />}
      {error && <LeagueErrorState onRetry={retry} />}

      {overview && me && (
        <div className="space-y-6">
          {/* هیرو: در چند ثانیه اول جواب همه‌چیز اینجاست */}
          <div className="dash-stagger space-y-4">
            <div className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
              <div className="flex flex-wrap items-center gap-5">
                <UserAvatar config={me.avatarConfig} size={84} isYou />
                <div className="min-w-0">
                  <h2 className="text-2xl [font-family:'Doran',Tahoma,sans-serif]">{me.name}</h2>
                  <p className="mt-1 text-sm text-[#aaa]">{me.university}</p>
                  {me.title && (
                    <span className="mt-2 inline-block rounded-full bg-[#937fcd]/15 px-3 py-1 text-xs text-[#c9bdf0]">
                      {me.title}
                    </span>
                  )}
                </div>

                <div className="ms-auto flex flex-wrap items-center gap-x-8 gap-y-4">
                  <div className="flex items-center gap-2.5">
                    <span key={hearts} className="lg-heart-pop">
                      <IconHeart className="h-8 w-8" />
                    </span>
                    <span>
                      <strong className="block text-2xl leading-7 [font-family:'Doran',Tahoma,sans-serif]">{faNum(hearts)}</strong>
                      <span className="text-xs text-[#8a8a8a]">قلب</span>
                    </span>
                  </div>

                  <div>
                    <strong className="block text-2xl leading-7 text-[#e0b45c] [font-family:'Doran',Tahoma,sans-serif]">
                      #{toFa(me.rank)}
                    </strong>
                    <span className="text-xs text-[#8a8a8a]">رتبه در دانشگاه</span>
                  </div>

                  <div>
                    <strong className="flex items-center gap-1.5 text-2xl leading-7 [font-family:'Doran',Tahoma,sans-serif]">
                      <Icon name="flame" className="h-6 w-6 text-[#ef9196]" />
                      {toFa(me.streak)}
                    </strong>
                    <span className="text-xs text-[#8a8a8a]">روز استریک</span>
                  </div>

                  <div>
                    <TierBadge tier={me.tier} />
                    <p className="mt-1.5 text-xs text-[#8a8a8a]">سطح {toFa(overview.levelProgress.level)} · {toFa(overview.levelProgress.step)}/{toFa(overview.levelProgress.stepMax)} تا سطح بعد</p>
                    <ProgressBar value={overview.levelProgress.step} max={overview.levelProgress.stepMax} height={5} className="mt-1.5 w-40" />
                  </div>
                </div>
              </div>
            </div>

            <LeagueLadder tiers={overview.tiers} currentTier={overview.tier} meRank={me.rank} />
          </div>

          {/* ناوبری زیربخش‌ها */}
          <nav className="flex gap-1.5 overflow-x-auto rounded-full bg-black/50 p-1.5" aria-label="بخش‌های لیگ">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                aria-current={activeView === view.id ? 'page' : undefined}
                onClick={() => setActiveView(view.id)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors [font-family:'Doran',Tahoma,sans-serif] ${
                  activeView === view.id
                    ? 'bg-[#937fcd] text-white'
                    : 'text-[#aaa] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon name={view.icon} className="h-4 w-4" />
                {view.label}
              </button>
            ))}
          </nav>

          {/* محتوای زیربخش */}
          <div key={activeView}>
            {activeView === 'overview' && <Overview overview={overview} onOpenView={openView} />}
            {activeView === 'board' && <Leaderboard me={me} />}
            {activeView === 'challenges' && <Challenges me={me} onEarnHearts={handleEarnHearts} />}
            {activeView === 'achievements' && <LeagueAchievements />}
            {activeView === 'profile' && <LeagueProfile userData={userData} me={me} />}
          </div>
        </div>
      )}

      {/* توست‌های قلب */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="lg-toast flex items-center gap-2.5 rounded-full border border-[#e26d6d]/40 bg-[#26191b]/95 px-5 py-3 text-sm shadow-[0_18px_40px_-14px_rgba(0,0,0,0.9)] backdrop-blur"
          >
            <span className="lg-heart-pop">
              <IconHeart className="h-5 w-5" />
            </span>
            <strong className="text-[#ef9196]">+{faNum(toast.amount)} قلب</strong>
            <span className="text-[#aaa]">· {toast.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
