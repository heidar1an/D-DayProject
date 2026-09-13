/*
 * Achievements — دستاوردها با دسته‌بندی و کمیابی. افسانه‌ای‌ها درخشش ملایم دارند؛
 * قفل‌ها پیشرفت واقعی نشان می‌دهند تا مسیر بعدی کاربر همیشه روشن باشد.
 */
import { useMemo, useState } from 'react';
import { fetchAchievements } from '../../../services/league/leagueService';
import { ACHIEVEMENT_CATEGORIES, RARITY } from '../../../services/league/mockData';
import { trackEvent } from '../../../services/league/leagueService';
import {
  EmptyState,
  Icon,
  ProgressBar,
  Skeleton,
  toFa,
} from './leagueShared';
import { useAsyncData } from './useAsyncData';

function AchievementCard({ item }) {
  const rarity = RARITY[item.rarity];

  return (
    <article
      className={`relative flex flex-col gap-3 rounded-[1.75rem] border p-5 transition-colors ${
        item.unlocked
          ? 'border-white/8 bg-[#2a2a2a] hover:bg-[#303030]'
          : 'border-dashed border-white/10 bg-white/[0.015]'
      } ${item.rarity === 'legendary' && !item.unlocked ? 'lg-glow-legendary border-solid' : ''} ${
        item.rarity === 'legendary' && item.unlocked ? 'lg-glow-legendary' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{
            background: item.unlocked ? `${rarity.color}1f` : 'rgba(255,255,255,0.04)',
            color: item.unlocked ? rarity.color : '#6d6d6d',
          }}
        >
          <Icon name={item.unlocked ? item.icon : 'lock'} className="h-6 w-6" />
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[10px]"
          style={{ background: `${rarity.color}14`, color: rarity.color }}
        >
          {rarity.label}
        </span>
      </div>

      <div>
        <h3 className={`text-[15px] [font-family:'Doran',Tahoma,sans-serif] ${item.unlocked ? 'text-white' : 'text-[#8a8a8a]'}`}>
          {item.title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">{item.description}</p>
      </div>

      {item.unlocked ? (
        <p className="mt-auto inline-flex items-center gap-1.5 text-[11px] text-[#9ed3ab]">
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
          باز شد · {item.unlockedAt}
        </p>
      ) : (
        <div className="mt-auto flex items-center gap-3">
          <ProgressBar value={item.progress ?? 0} max={item.goal ?? 1} color={rarity.color} height={6} className="flex-1" />
          <span className="shrink-0 text-[10px] text-[#8a8a8a]">{item.progressNote}</span>
        </div>
      )}
    </article>
  );
}

function AchievementsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-44 rounded-[1.75rem]" />
      ))}
    </div>
  );
}

export default function Achievements() {
  const { data, loading } = useAsyncData(fetchAchievements, []);
  const [category, setCategory] = useState('all');

  const visible = useMemo(
    () => data?.items.filter((item) => category === 'all' || item.category === category) ?? [],
    [data, category],
  );

  if (loading) return <AchievementsSkeleton />;
  if (!data) return null;

  const total = data.items.length;

  return (
    <section aria-label="دستاوردها" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg text-white md:text-xl [font-family:'Doran',Tahoma,sans-serif]">دستاوردها</h2>
          <p className="mt-1 text-xs text-[#8a8a8a]">
            {toFa(data.unlockedCount)} از {toFa(total)} دستاورد را باز کردی — رکوردت رو بشکن.
          </p>
        </div>
        <span className="text-xs text-[#aaa]">افسانه‌ای‌ها با درخشش مشخص می‌شوند ✦</span>
      </header>

      <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-full bg-black/40 p-1.5" role="tablist" aria-label="دستهٔ دستاورد">
        {ACHIEVEMENT_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            onClick={() => {
              setCategory(item.id);
              trackEvent('achievement_filter', { category: item.id });
            }}
            className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              category === item.id ? 'bg-[#937fcd] text-white' : 'text-[#aaa] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="trophy"
          title="هنوز در این دسته دستاوردی نداری"
          note="اولین چالش خودت را شروع کن؛ هر قلبی که می‌گیری تو را به دستاورد بعدی نزدیک‌تر می‌کند."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <AchievementCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
