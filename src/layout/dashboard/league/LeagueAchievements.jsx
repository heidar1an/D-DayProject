/*
 * Achievements — دستاوردها با دسته‌بندی و کمیابی. افسانه‌ای‌ها درخشش ملایم دارند؛
 * قفل‌ها پیشرفت واقعی نشان می‌دهند تا مسیر بعدی کاربر همیشه روشن باشد.
 */
import { fetchAchievements } from '../../../services/league/leagueService';
import { RARITY } from '../../../services/league/mockData';
import {
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
          ? 'border-white/8 bg-[var(--surface-soft)] hover:bg-[var(--surface-soft)]'
          : 'border-dashed border-white/10 bg-white/[0.015]'
      } ${item.rarity === 'legendary' && !item.unlocked ? 'lg-glow-legendary border-solid' : ''} ${
        item.rarity === 'legendary' && item.unlocked ? 'lg-glow-legendary' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{
            background: item.unlocked ? `${rarity.color}1f` : 'rgb(var(--wash-rgb) / 0.04)',
            color: item.unlocked ? rarity.color: 'var(--ghost)',
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
        <h3 className={`text-[15px] [font-family:'Doran','Vazir',Tahoma,sans-serif] ${item.unlocked ? 'text-white' : 'text-[var(--faint)]'}`}>
          {item.title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--faint)]">{item.description}</p>
      </div>

      {item.unlocked ? (
        <p className="mt-auto inline-flex items-center gap-1.5 text-[11px] text-[var(--green-soft-ink)]">
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
          باز شد · {item.unlockedAt}
        </p>
      ) : (
        <div className="mt-auto flex items-center gap-3">
          <ProgressBar value={item.progress ?? 0} max={item.goal ?? 1} color={rarity.color} height={6} className="flex-1" />
          <span className="shrink-0 text-[10px] text-[var(--faint)]">{item.progressNote}</span>
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

  if (loading) return <AchievementsSkeleton />;
  if (!data) return null;

  const total = data.items.length;

  return (
    <section aria-label="دستاوردها" className="rounded-[2.5rem] bg-[var(--surface-soft)] p-5 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg text-white md:text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">دستاوردها</h2>
          <p className="mt-1 text-xs text-[var(--faint)]">
            {toFa(data.unlockedCount)} از {toFa(total)} دستاورد را باز کردی — رکوردت رو بشکن.
          </p>
        </div>
        <span className="text-xs text-[var(--muted)]">افسانه‌ای‌ها با درخشش مشخص می‌شوند ✦</span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => (
          <AchievementCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
