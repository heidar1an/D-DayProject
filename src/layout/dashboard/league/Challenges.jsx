/*
 * Challenges — چالش‌های روزانه و هفتگی با پیشرفت واقعی، نبردهای رقابتی و
 * پروتوتایپ دوئل دوستانه. کامل‌شدن چالش از طریق onEarnHearts به هیرو و توست
 * قلب لحظه‌ای می‌رسد (در نسخهٔ واقعی: POST challenges/:id/claim با اعتبارسنجی سمت سرور).
 */
import { useEffect, useState } from 'react';
import { fetchChallenges, trackEvent } from '../../../services/league/leagueService';
import {
  EmptyState,
  HeartReward,
  Icon,
  IconHeart,
  ProgressBar,
  Skeleton,
  UserAvatar,
  faNum,
  toFa,
} from './leagueShared';
import { useAsyncData } from './useAsyncData';

const DAILY_STEP = { d1: 4, d2: 6, d3: 1, d4: 1 };

function ChallengeCard({ challenge, step, onProgress }) {
  const done = challenge.progress >= challenge.goal;
  const percent = Math.round((challenge.progress / challenge.goal) * 100);

  return (
    <article
      className={`flex flex-col gap-3 rounded-[1.75rem] border p-5 transition-colors ${
        done ? 'border-[#77b787]/40 bg-[#77b787]/[0.06]' : 'border-white/8 bg-[var(--surface-soft)] hover:bg-[var(--surface-soft)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
            done ? 'bg-[#77b787]/15 text-[var(--green-ink)]' : 'bg-[#937fcd]/15 text-[var(--purple-soft-ink)]'
          }`}
        >
          <Icon name={done ? 'check' : challenge.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-6 [font-family:'Doran','Vazir',Tahoma,sans-serif]">{challenge.title}</h3>
          <p className="text-xs text-[var(--faint)]">{challenge.note}</p>
        </div>
        <HeartReward amount={challenge.reward} />
      </div>

      <div className="flex items-center gap-3">
        <ProgressBar value={challenge.progress} max={challenge.goal} color={done ? '#77b787' : '#937fcd'} className="flex-1" />
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {toFa(challenge.progress)} / {toFa(challenge.goal)}
        </span>
      </div>

      {done ? (
        <p className="rounded-xl bg-[#77b787]/10 py-2 text-center text-xs text-[var(--green-soft-ink)]">
          تمام شد! {faNum(challenge.reward)} قلب گرفتی ✨
        </p>
      ) : (
        <button
          type="button"
          onClick={() => onProgress(challenge.id, step)}
          className="cursor-pointer rounded-xl bg-white/5 py-2 text-xs text-[var(--muted)] transition-colors hover:bg-[#937fcd]/25 hover:text-white"
        >
          ثبت ادامهٔ پیشرفت
        </button>
      )}
      <span className="sr-only">{toFa(percent)} درصد تکمیل</span>
    </article>
  );
}

function BattleCard({ battle, onJoin }) {
  return (
    <article className="rounded-[1.75rem] border border-white/8 bg-[var(--surface-soft)] p-5 transition-colors hover:bg-[var(--surface-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e26d6d]/12 text-[var(--red-ink)]">
            <Icon name="swords" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[15px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">{battle.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--faint)]">
              <span>{toFa(battle.questions)} سؤال</span>
              <span>{faNum(battle.participants)} شرکت‌کننده</span>
              <span className="inline-flex items-center gap-1">
                <i className={`lg-live-dot inline-block h-1.5 w-1.5 rounded-full ${battle.endsLabel.includes('شروع') ? 'bg-[var(--gold)]' : 'bg-[var(--green-bright)]'}`} />
                {battle.endsLabel}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HeartReward amount={battle.reward} />
          <button
            type="button"
            onClick={() => onJoin(battle)}
            aria-pressed={battle.joined}
            className={`cursor-pointer rounded-xl px-4 py-2 text-sm transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
              battle.joined
                ? 'bg-[#77b787]/20 text-[var(--green-soft-ink)]'
                : 'bg-gradient-to-l from-[var(--purple-bright)] to-[var(--purple-bright)] text-white hover:from-[var(--purple-bright)] hover:to-[var(--purple-bright)]'
            }`}
          >
            {battle.joined ? 'شرکت کردی ✓' : 'شرکت می‌کنم'}
          </button>
        </div>
      </div>

      {battle.podium && (
        <ol className="mt-4 grid gap-2 rounded-2xl bg-black/25 p-3 sm:grid-cols-3">
          {battle.podium.map((row, index) => (
            <li key={row.name} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm odd:bg-white/[0.04]">
              <span className="flex items-center gap-2">
                <RankDot rank={index + 1} />
                {row.name}
              </span>
              <span className="text-xs text-[var(--muted)]">{faNum(row.score)}</span>
            </li>
          ))}
        </ol>
      )}

      {battle.type === 'university' && !battle.podium && (
        <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl bg-black/25 py-4 [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <span className="text-sm text-[var(--purple-soft-ink)]">قم</span>
          <span className="rounded-full bg-[#937fcd]/20 px-3 py-1 text-xs text-[var(--purple-soft-ink)]">در برابر</span>
          <span className="text-sm text-[var(--blue-soft-ink)]">تهران</span>
        </div>
      )}
    </article>
  );
}

function RankDot({ rank }) {
  const colors = { 1: '#e0b45c', 2: '#b9c2cc', 3: '#ab8e7c' };
  return (
    <span
      className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-[var(--ink-deep)]"
      style={{ background: colors[rank] ?? 'rgb(var(--wash-rgb) / 0.1)', color: colors[rank] ? '#1c1c1c' : '#aaa' }}
    >
      {toFa(rank)}
    </span>
  );
}

function DuelCard({ duel, me }) {
  return (
    <article className="relative overflow-hidden rounded-[1.75rem] border border-[#937fcd]/30 bg-gradient-to-l from-[#937fcd]/12 via-transparent to-[#e26d6d]/10 p-5 md:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[15px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <Icon name="swords" className="h-4.5 w-4.5 text-[var(--purple-soft-ink)]" />
          دوئل دوستانه
        </h3>
        <span className="rounded-full bg-[#e0b45c]/15 px-3 py-1 text-[11px] text-[var(--gold-ink)]">نسخهٔ آزمایشی</span>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <UserAvatar avatar={me?.avatar} size={52} />
          <strong className="text-sm">تو</strong>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e26d6d]/15 px-3 py-1 text-xs text-[var(--red-ink)]">
            <IconHeart className="h-3.5 w-3.5" />
            دوئل {faNum(duel.stake)} قلبی
          </span>
          <span className="text-2xl [font-family:'Doran','Vazir',Tahoma,sans-serif] text-[var(--purple-soft-ink)]">VS</span>
          <span className="text-xs text-[var(--faint)]">{toFa(duel.questions)} سؤال · برنده +{faNum(duel.winnerReward)} / بازنده +{faNum(duel.loserReward)}</span>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <UserAvatar avatar={duel.opponent.avatar} size={52} />
          <strong className="text-sm">{duel.opponent.name}</strong>
        </div>
      </div>

      <EmptyState
        icon="users"
        title="هنوز دوستی به لیگ دعوت نکردی"
        note="به‌زودی می‌توانی دوستانت را به دوئل قلبی بطلان؛ آماده‌اش را بچین."
      />
    </article>
  );
}

function ChallengesSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-[1.75rem]" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-[1.75rem]" />
      <Skeleton className="h-36 rounded-[1.75rem]" />
    </div>
  );
}

export default function Challenges({ me, onEarnHearts }) {
  const { data, loading } = useAsyncData(fetchChallenges, []);
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [battles, setBattles] = useState([]);

  useEffect(() => {
    if (!data) return;
    setDaily(data.daily);
    setWeekly(data.weekly);
    setBattles(data.battles);
  }, [data]);

  /* رویدادهای جانبی (توست قلب) بیرون از updater اجرا می‌شوند تا در StrictMode دوبار نباشند */
  const handleDailyProgress = (id, step) => {
    const target = daily.find((item) => item.id === id);
    if (!target) return;
    const progress = Math.min(target.goal, target.progress + step);
    const becameDone = progress >= target.goal && target.progress < target.goal;
    setDaily((prev) => prev.map((item) => (item.id === id ? { ...item, progress } : item)));
    if (becameDone) {
      trackEvent('challenge_complete', { id, kind: 'daily' });
      onEarnHearts?.(target.reward, target.title);
    }
  };

  const handleWeeklyProgress = () => {
    if (!weekly) return;
    const progress = Math.min(weekly.goal, weekly.progress + 10);
    const becameDone = progress >= weekly.goal && weekly.progress < weekly.goal;
    setWeekly({ ...weekly, progress });
    if (becameDone) {
      trackEvent('challenge_complete', { id: weekly.id, kind: 'weekly' });
      onEarnHearts?.(weekly.reward, weekly.title);
    }
  };

  const handleJoin = (battle) => {
    setBattles((prev) =>
      prev.map((item) =>
        item.id === battle.id ? { ...item, joined: !item.joined } : item,
      ),
    );
    if (!battle.joined) trackEvent('challenge_start', { id: battle.id, kind: 'battle' });
  };

  if (loading) return <ChallengesSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <section aria-label="چالش‌های امروز" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg text-white md:text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">چالش‌های امروز</h2>
          <span className="text-xs text-[var(--faint)]">هر روز تازه می‌شوند؛ جا ننداز.</span>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {daily.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              step={DAILY_STEP[challenge.id] ?? 1}
              onProgress={handleDailyProgress}
            />
          ))}
        </div>
      </section>

      {weekly && (
        <section aria-label="چالش هفتگی" className="rounded-[2.5rem] border border-[#e0b45c]/25 bg-gradient-to-l from-[#e0b45c]/10 via-[var(--surface-soft)] to-[var(--surface-soft)] p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-[#e0b45c]/15 text-[var(--gold-ink)]">
              <Icon name="trophy" className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs text-[var(--faint)]">چالش هفتگی</p>
              <h2 className="text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">{weekly.title}</h2>
              <p className="mt-1 max-w-md text-sm leading-6 text-[var(--muted)]">{weekly.note}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <HeartReward amount={weekly.reward} size="lg" />
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--gold-ink)]">
              <Icon name="star" className="h-3.5 w-3.5" />
              {weekly.achievement}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <ProgressBar value={weekly.progress} max={weekly.goal} color="var(--gold-ink)" height={10} className="flex-1" />
          <span className="shrink-0 text-sm text-[var(--muted)]">
            {toFa(weekly.progress)} / {toFa(weekly.goal)}
          </span>
          {weekly.progress < weekly.goal ? (
            <button
              type="button"
              onClick={handleWeeklyProgress}
              className="shrink-0 cursor-pointer rounded-xl bg-[#e0b45c]/15 px-4 py-2 text-xs text-[var(--gold-ink)] transition-colors hover:bg-[#e0b45c]/25"
            >
              +۱۰ سؤال فیزیولوژی
            </button>
          ) : (
            <span className="shrink-0 rounded-xl bg-[#77b787]/15 px-4 py-2 text-xs text-[var(--green-soft-ink)]">کامل شد!</span>
          )}
        </div>
      </section>
      )}

      {/* نبردهای فعال و دوئل دوستانه در یک ردیف */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="نبردهای رقابتی" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-8">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg text-white md:text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">نبردهای فعال</h2>
            <span className="text-xs text-[var(--faint)]">تکی، دانشگاهی یا با دوستانت</span>
          </header>
          <div className="space-y-4">
            {battles.map((battle) => (
              <BattleCard key={battle.id} battle={battle} onJoin={handleJoin} />
            ))}
          </div>
        </section>

        <DuelCard duel={data.duel} me={me} />
      </div>
    </div>
  );
}
