/*
 * Leaderboard — هستهٔ لیگ. سه مقیاس رقابت: دانشگاه من، دانشگاه‌ها، کل تپش.
 * سه نفر اول پودیوم ویژه دارند؛ رتبه‌های بعدی فهرست خوانا؛ کاربر همیشه با نوار
 * چسبان پایین، جایگاه خودش را می‌بیند. معیار رتبه‌بندی دانشگاه‌ها قابل‌تعویض است
 * تا در آینده Average/Participation جایگزین مجموع شود.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchLeaderboard, trackEvent } from '../../../services/league/leagueService';
import { avatarForSeed } from '../../../services/league/mockData';
import {
  Icon,
  IconHeart,
  ProgressBar,
  RankChip,
  Skeleton,
  UserAvatar,
  faNum,
  toFa,
} from './leagueShared';

/* آواتار ورودی‌ها: شناسهٔ صریح، یا آواتار ساخته‌شده از seed دترمینیستیکی */
const avatarOf = (entry) => entry.avatar ?? (entry.seed !== undefined ? avatarForSeed(entry.seed) : null);

const SCOPES = [
  { id: 'university', label: 'دانشگاه من' },
  { id: 'universities', label: 'دانشگاه‌ها' },
  { id: 'global', label: 'کل تپش' },
];

const METRICS = [
  { id: 'total', label: 'مجموع قلب‌ها', icon: 'heart' },
  { id: 'active', label: 'دانشجویان فعال', icon: 'users' },
];

const ME_UNIVERSITY = 'دانشگاه علوم پزشکی قم';

export function PodiumCard({ entry, place, metric, onOpenProfile }) {
  const isCenter = place === 1;
  const value = metric ? entry[metric.id] : entry.hearts;

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(entry)}
      className={`lg-podium__step flex flex-1 flex-col items-center gap-2 rounded-[1.75rem] border px-3 pb-4 pt-5 text-center transition-colors ${onOpenProfile ? 'cursor-pointer hover:border-[#937fcd]/50 hover:bg-white/[0.05]' : 'cursor-default'} ${
        isCenter ? 'border-[#e0b45c]/40 bg-[#e0b45c]/[0.07]' : 'border-white/8 bg-white/[0.03]'
      } ${isCenter ? 'md:-translate-y-3 md:pt-7' : ''}`}
      style={{ animationDelay: `${place * 90}ms` }}
    >
      <RankChip rank={place} size="lg" />
      <UserAvatar avatar={avatarOf(entry)} size={isCenter ? 62 : 48} />
      <strong className="mt-1 line-clamp-1 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
        {entry.name}
      </strong>
      {!metric && (
        <span className="line-clamp-1 text-[11px] text-[var(--faint)]">{entry.university}</span>
      )}
      <span className="inline-flex items-center gap-1.5 text-sm text-white/90">
        {metric?.icon === 'users' ? (
          <Icon name="users" className="h-4 w-4 text-[var(--green-ink)]" />
        ) : (
          <IconHeart className="h-4 w-4" />
        )}
        {faNum(value)}
      </span>
    </button>
  );
}

export function LeaderRow({ entry, metric, onOpenProfile }) {
  const value = metric ? entry[metric.id] : entry.hearts;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenProfile?.(entry)}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-right transition-colors ${onOpenProfile ? 'cursor-pointer hover:border-[#937fcd]/40 hover:bg-white/[0.04]' : 'cursor-default'} ${
        entry.isYou
          ? 'border-[#e26d6d]/40 bg-[#e26d6d]/[0.08]'
          : 'border-white/6 bg-[var(--surface-soft)] hover:bg-[var(--surface-soft)]'
      }`}
      >
      <RankChip rank={entry.rank} />
      <UserAvatar avatar={avatarOf(entry)} size={40} isYou={entry.isYou} />
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          {entry.name}
          {entry.isYou && <span className="mr-2 text-xs font-normal text-[var(--red-ink)]">(شما)</span>}
        </strong>
        {entry.university && (
          <span className="block truncate text-[11px] text-[var(--faint)]">{entry.university}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-sm text-white/90">
        {metric?.icon === 'users' ? (
          <Icon name="users" className="h-4 w-4 text-[var(--green-ink)]" />
        ) : (
          <IconHeart className="h-4 w-4" />
        )}
        {faNum(value)}
      </span>
      </button>
    </li>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex gap-3">
        <Skeleton className="h-40 flex-1 rounded-[1.75rem]" />
        <Skeleton className="h-44 flex-1 rounded-[1.75rem]" />
        <Skeleton className="h-40 flex-1 rounded-[1.75rem]" />
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

export default function Leaderboard({ me, userData, onOpenProfile }) {
  const [scope, setScope] = useState('university');
  const [metric, setMetric] = useState('total');
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadTokenRef = useRef(0);

  const activeMetric = METRICS.find((item) => item.id === metric) ?? METRICS[0];

  /* ردیف «شما» در پاسخ سرویس آواتار ندارد؛ آواتار واقعی کاربر همان‌جا تزریق می‌شود */
  const withMyAvatar = (list) =>
    list.map((entry) => (entry.isYou && me?.avatar ? { ...entry, avatar: me.avatar } : entry));

  useEffect(() => {
    const token = ++loadTokenRef.current;
    setLoading(true);
    trackEvent('leaderboard_view', { scope, metric });

    fetchLeaderboard({ scope, metric, offset: 0 })
      .then((result) => {
        if (token !== loadTokenRef.current) return;
        setData(result);
        setItems(withMyAvatar(result.items));
      })
      .finally(() => {
        if (token === loadTokenRef.current) setLoading(false);
      });
  }, [scope, metric]);

  const loadMore = () => {
    if (!data?.nextOffset) return;
    const token = ++loadTokenRef.current;
    fetchLeaderboard({ scope, metric, offset: data.nextOffset }).then((result) => {
      if (token !== loadTokenRef.current) return;
      setItems((prev) => [...prev, ...withMyAvatar(result.items)]);
      setData(result);
    });
  };

  const hasPodium = items.length >= 3 && items[0].rank === 1 && scope !== 'universities';
  const podiumEntries = items.slice(0, 3);
  /* در Scope دانشگاه‌ها پودیوم جداگانه داریم؛ از لیست حذف می‌شوند تا تکرار نشوند */
  const listEntries = items.slice(hasPodium || scope === 'universities' ? 3 : 0);

  const meSticky =
    scope === 'university'
      ? { rank: data?.meRank, label: 'شما', value: me?.hearts, gap: data?.gapToPrev, gapRank: (data?.meRank ?? 2) - 1 }
      : scope === 'global'
        ? { rank: data?.meRank ?? 1284, label: 'شما', value: me?.hearts }
        : { rank: data?.meRank, label: ME_UNIVERSITY, value: 1187420 };

  return (
    <section aria-label="جدول رتبه‌بندی لیگ" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg text-white md:text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          جدول رتبه‌بندی
        </h2>

        <div className="flex gap-1.5 overflow-x-auto rounded-full bg-black/40 p-1.5" role="tablist" aria-label="مقیاس رقابت">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={scope === item.id}
              onClick={() => setScope(item.id)}
              className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm transition-colors [font-family:'Doran','Vazir',Tahoma,sans-serif] ${
                scope === item.id ? 'bg-[var(--purple-bright)] text-white' : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {scope === 'universities' && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--faint)]">معیار رتبه‌بندی:</span>
          {METRICS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={metric === item.id}
              onClick={() => setMetric(item.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                metric === item.id
                  ? 'bg-[#937fcd]/25 text-[var(--purple-soft-ink)]'
                  : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
              }`}
            >
              {item.icon === 'users' ? (
                <Icon name="users" className="h-3.5 w-3.5" />
              ) : (
                <IconHeart className="h-3.5 w-3.5" />
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LeaderboardSkeleton />
      ) : (
        <>
          {hasPodium && (
            <div className="mb-5 flex items-end gap-3">
              <PodiumCard entry={podiumEntries[1]} place={2} onOpenProfile={onOpenProfile && (() => onOpenProfile(podiumEntries[1]))} />
              <PodiumCard entry={podiumEntries[0]} place={1} onOpenProfile={onOpenProfile && (() => onOpenProfile(podiumEntries[0]))} />
              <PodiumCard entry={podiumEntries[2]} place={3} onOpenProfile={onOpenProfile && (() => onOpenProfile(podiumEntries[2]))} />
            </div>
          )}

          {scope === 'universities' && items.length >= 3 && (
            <div className="mb-5 flex items-end gap-3">
              <PodiumCard entry={items[1]} place={2} metric={activeMetric} />
              <PodiumCard entry={items[0]} place={1} metric={activeMetric} />
              <PodiumCard entry={items[2]} place={3} metric={activeMetric} />
            </div>
          )}

          <ul className="space-y-2.5">
            {listEntries.map((entry) => (
              <LeaderRow key={entry.id ?? entry.rank} entry={entry} metric={scope === 'universities' ? activeMetric : null} onOpenProfile={scope === 'universities' ? undefined : onOpenProfile && (() => onOpenProfile(entry))} />
            ))}
          </ul>

          {data?.nextOffset !== null && data?.nextOffset !== undefined && (
            <button
              type="button"
              onClick={loadMore}
              className="mt-4 w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-sm text-[var(--muted)] transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              نمایش ۱۰ نفر بعدی
            </button>
          )}
        </>
      )}

      {/* نوار چسبان کاربر — همیشه جایگاه خودش را می‌بیند */}
      {!loading && meSticky.rank && (
        <div className="sticky bottom-3 z-10 mt-4">
          <div className="rounded-2xl border border-[#e26d6d]/35 bg-[#1e1a1a]/95 p-3 shadow-[0_18px_40px_-18px_rgb(var(--shadow-rgb) / 0.9)] backdrop-blur">
            <div className="flex items-center gap-3">
              <RankChip rank={meSticky.rank} />
              <span className="flex-1 text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                {meSticky.label}
                <span className="mr-2 text-xs font-normal text-[var(--faint)]">جایگاه تو</span>
              </span>
              {meSticky.value && (
                <span className="flex items-center gap-1.5 text-sm text-white">
                  <IconHeart className="h-4 w-4" />
                  {faNum(meSticky.value)}
                </span>
              )}
            </div>
            {meSticky.gap > 0 && (
              <div className="mt-2.5 flex items-center gap-3">
                <ProgressBar value={meSticky.value ?? 0} max={meSticky.value + meSticky.gap} color="var(--red-ink)" height={6} className="flex-1" />
                <span className="shrink-0 text-xs text-[var(--red-ink)]">
                  {faNum(meSticky.gap)} قلب تا رتبه {toFa(meSticky.gapRank)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
