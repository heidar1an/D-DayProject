/*
 * LeagueProfile — نمای پروفایلی لیگ: آمار، مقایسهٔ اجتماعی در چند مقیاس، تقویم
 * استریک، دفتر قلب (HeartTransaction)، تاریخچهٔ فصل‌ها، ریوارد، عنوان پروفایل و
 * تنظیمات حریم خصوصی. همه از سرویس می‌آیند؛ فقط انتخاب عنوان و سوییچ‌ها محلی‌اند.
 */
import { useState } from 'react';
import { fetchProfileDetails } from '../../../services/league/leagueService';
import {
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

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const PRIVACY_ITEMS = [
  { id: 'rank', label: 'نمایش رتبه من', note: 'جایگاهت در جدول‌های عمومی دیده شود' },
  { id: 'achievements', label: 'نمایش دستاوردها', note: 'دستاوردهایت در فید فعالیت دیده شود' },
  { id: 'university', label: 'مشارکت در رتبه دانشگاه', note: 'قلب‌هایت به رتبهٔ دانشگاهت اضافه شود' },
  { id: 'activity', label: 'نمایش فعالیت من', note: 'رویدادهای آموزشیت در فید عمومی بیاید' },
];

function PrivacyToggle({ item }) {
  const [on, setOn] = useState(item.id !== 'activity');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn((prev) => !prev)}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[#2a2a2a] px-4 py-3 text-right transition-colors hover:bg-[#303030]"
    >
      <span className="min-w-0">
        <strong className="block text-sm">{item.label}</strong>
        <span className="block text-xs text-[#8a8a8a]">{item.note}</span>
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-[#937fcd]' : 'bg-white/12'}`}>
        <span
          className="absolute right-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: `translateY(-50%) translateX(${on ? -16 : 0}px)` }}
        />
      </span>
    </button>
  );
}

function StatTile({ icon, label, value, accent = '#937fcd', heart = false }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-[#2a2a2a] p-4">
      <span className="flex items-center gap-2 text-xs text-[#8a8a8a]">
        {heart ? <IconHeart className="h-4 w-4" /> : <Icon name={icon} className="h-4 w-4" style={{ color: accent }} />}
        {label}
      </span>
      <strong className="mt-2 block text-xl [font-family:'Doran',Tahoma,sans-serif]">{value}</strong>
    </div>
  );
}

function StreakCalendar({ history }) {
  /* تقویم ۵ هفتهٔ اخیر؛ خانهٔ روشن = روزی با حداقل یک فعالیت آموزشی معتبر */
  const rows = [];
  for (let i = 0; i < history.length; i += 7) rows.push(history.slice(i, i + 7));

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[10px] text-[#6d6d6d]">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-7 gap-1.5">
            {row.map((active, colIndex) => {
              const index = rowIndex * 7 + colIndex;
              const isToday = index === history.length - 1;
              return (
                <span
                  key={colIndex}
                  className={`lg-heat grid aspect-square place-items-center rounded-lg text-[10px] ${
                    active
                      ? isToday
                        ? 'bg-[#e26d6d] text-white'
                        : 'bg-[#937fcd]/45 text-white/90'
                      : 'bg-white/[0.045] text-[#5d5d5d]'
                  }`}
                  style={{ '--i': index }}
                  title={active ? 'روز فعال' : 'روز غیرفعال'}
                >
                  {active ? <Icon name="check" className="h-3 w-3" strokeWidth={3} /> : '·'}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[#8a8a8a]">
        استریک یعنی هر روز حداقل یک فعالیت آموزشی معتبر — فقط ورود کافی نیست.
      </p>
    </div>
  );
}

export default function LeagueProfile({ userData, me }) {
  const { data, loading } = useAsyncData(() => fetchProfileDetails(userData), [userData]);
  const [equippedTitle, setEquippedTitle] = useState(me?.title ?? '');

  if (loading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-36 rounded-[2.5rem]" />
        <Skeleton className="h-48 rounded-[2.5rem]" />
        <Skeleton className="h-64 rounded-[2.5rem]" />
      </div>
    );
  }
  if (!data) return null;

  const { me: profile, titles, rewards, ledger, streakHistory, pastSeasons, season } = data;

  const comparison = [
    { label: 'دوستان', rank: profile.friendsRank, icon: 'users', color: '#77b787' },
    { label: 'دانشگاه من', rank: profile.rank, icon: 'shield', color: '#5b8cc7' },
    { label: 'فصل فعلی', rank: profile.seasonRank, icon: 'calendar', color: '#937fcd' },
    { label: 'کل تپش', rank: profile.globalRank, icon: 'spark', color: '#ab8e7c' },
  ];

  return (
    <div className="space-y-6">
      {/* هویت لیگ */}
      <section aria-label="پروفایل لیگ" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar config={profile.avatarConfig} size={84} isYou />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl [font-family:'Doran',Tahoma,sans-serif]">{profile.name}</h2>
            <p className="mt-1 text-sm text-[#aaa]">{profile.university}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TierBadge tier={me?.tier} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e26d6d]/12 px-3 py-1.5 text-sm text-[#ef9196]">
                <IconHeart className="h-4 w-4" />
                {faNum(profile.hearts)}
              </span>
            </div>
          </div>
          {me?.tier && (
            <div className="w-full max-w-56 md:w-56">
              <div className="mb-2 flex items-center justify-between text-xs text-[#aaa]">
                <span>پیشرفت تا لیگ بعدی</span>
                <span>{toFa(me.tierProgress?.percent ?? 0)}٪</span>
              </div>
              <ProgressBar value={me.tierProgress?.percent ?? 0} max={100} color={me.tier.color} />
              <p className="mt-2 text-[11px] text-[#8a8a8a]">
                {faNum(me.tierProgress?.toNextTier ?? 0)} قلب تا لیگ {me.tierProgress?.nextName ?? 'بعدی'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatTile heart label="قلب کل" value={faNum(profile.hearts)} accent="#e26d6d" />
          <StatTile icon="star" label="رتبه فعلی" value={`#${toFa(profile.rank)}`} accent="#5b8cc7" />
          <StatTile icon="trophy" label="بهترین رتبه" value={`#${toFa(profile.bestRank)}`} accent="#e0b45c" />
          <StatTile icon="flame" label="استریک فعلی" value={`${toFa(profile.streak)} روز`} accent="#e26d6d" />
          <StatTile icon="flame" label="بلندترین استریک" value={`${toFa(profile.longestStreak)} روز`} accent="#ab8e7c" />
          <StatTile icon="spark" label="سطح" value={toFa(profile.level)} accent="#937fcd" />
        </div>
      </section>

      {/* مقایسهٔ اجتماعی سالم در چند مقیاس */}
      <section aria-label="جایگاه تو در چند مقیاس" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
        <h2 className="mb-4 text-lg [font-family:'Doran',Tahoma,sans-serif]">تو کجای لیگ هستی؟</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {comparison.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/6 bg-[#2a2a2a] p-4 text-center">
              <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full" style={{ background: `${item.color}1c`, color: item.color }}>
                <Icon name={item.icon} className="h-4.5 w-4.5" />
              </span>
              <strong className="block text-lg [font-family:'Doran',Tahoma,sans-serif]">#{toFa(item.rank)}</strong>
              <span className="text-xs text-[#8a8a8a]">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* تقویم استریک */}
        <section aria-label="تقویم استریک" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
          <header className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg [font-family:'Doran',Tahoma,sans-serif]">
              <Icon name="flame" className="h-5 w-5 text-[#ef9196]" />
              {toFa(profile.streak)} روز پیوسته
            </h2>
            <span className="text-xs text-[#8a8a8a]">رکوردت: {toFa(profile.longestStreak)} روز</span>
          </header>
          <StreakCalendar history={streakHistory} />
        </section>

        {/* دفتر قلب */}
        <section aria-label="دفتر قلب" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
          <header className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg [font-family:'Doran',Tahoma,sans-serif]">
              <IconHeart className="h-5 w-5" />
              دفتر قلب
            </h2>
            <span className="text-xs text-[#8a8a8a]">هر قلب یک منبع دارد</span>
          </header>
          <ul className="space-y-2">
            {ledger.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[#2a2a2a] px-4 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e26d6d]/12 text-[#ef9196]">
                  <IconHeart className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{row.source}</strong>
                  <span className="block text-[11px] text-[#8a8a8a]">{row.date}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-[#ef9196]">+{faNum(row.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* فصل‌ها */}
        <section aria-label="فصل‌های لیگ" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
          <h2 className="mb-4 text-lg [font-family:'Doran',Tahoma,sans-serif]">فصل‌ها</h2>

          <div className="mb-4 rounded-2xl border border-[#937fcd]/30 bg-[#937fcd]/[0.07] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-[#c9bdf0]">فصل {toFa(season.number)} در جریان است</p>
                <strong className="text-base [font-family:'Doran',Tahoma,sans-serif]">«{season.name}»</strong>
              </div>
              <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-[#c9bdf0]">
                {toFa(season.durationDays)} روزه
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#aaa]">
              پایان فصل: ثبت رتبه‌ها، اعطای ریوارد و ریست نرمِ لیگ. بهترین رتبهٔ فعلی تو: #{toFa(profile.seasonRank)} دانشگاه.
            </p>
          </div>

          {pastSeasons.map((item) => (
            <div key={item.id} className="mb-3 flex items-center gap-3 rounded-2xl border border-white/6 bg-[#2a2a2a] px-4 py-3 last:mb-0">
              <span className="grid h-9 w-9 place-items-center rounded-xl text-[#1c1c1c]" style={{ background: item.badgeColor }}>
                <Icon name="shield" className="h-4.5 w-4.5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm">فصل {toFa(item.number)} · {item.name}</strong>
                <span className="block text-[11px] text-[#8a8a8a]">
                  رتبه #{toFa(item.rank)} {item.scope} · لیگ {item.tier}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[#ef9196]">+{faNum(item.heartsEarned)} قلب</span>
            </div>
          ))}

          <div className="mt-4 rounded-2xl bg-black/25 p-4">
            <p className="mb-2 text-xs text-[#8a8a8a]">ریواردهای پایان فصل:</p>
            <ul className="flex flex-wrap gap-2">
              {season.rewards.map((reward) => (
                <li key={reward} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-[#c9c9c9]">{reward}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ریواردها و عناوین */}
        <section aria-label="ریواردها و عناوین" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
          <h2 className="mb-4 text-lg [font-family:'Doran',Tahoma,sans-serif]">گنجینهٔ ریوارد</h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className={`rounded-2xl border p-4 ${reward.owned ? 'border-white/8 bg-[#2a2a2a]' : 'border-dashed border-white/10 bg-transparent opacity-70'}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: reward.owned ? reward.color : 'transparent', boxShadow: `inset 0 0 0 2px ${reward.color}` }} />
                  <strong className="text-sm">{reward.label}</strong>
                </div>
                <p className="mt-2 text-[11px] text-[#8a8a8a]">{reward.note}</p>
                <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] ${reward.owned ? 'bg-[#77b787]/15 text-[#9ed3ab]' : 'bg-white/5 text-[#8a8a8a]'}`}>
                  {reward.owned ? 'در گنجینه‌ات' : 'قفل'}
                </span>
              </div>
            ))}
          </div>

          <h3 className="mb-3 text-sm text-[#aaa]">عنوان پروفایل — یکی را انتخاب کن</h3>
          <div className="flex flex-wrap gap-2">
            {titles.map((title) => (
              <button
                key={title.id}
                type="button"
                disabled={!title.owned}
                onClick={() => {
                  setEquippedTitle(title.label);
                }}
                aria-pressed={equippedTitle === title.label}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  equippedTitle === title.label
                    ? 'bg-[#937fcd] text-white'
                    : 'bg-white/5 text-[#aaa] hover:bg-white/10 hover:text-white'
                }`}
              >
                {title.owned ? title.label : `🔒 ${title.label}`}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* حریم خصوصی */}
      <section aria-label="حریم خصوصی لیگ" className="rounded-[2.5rem] bg-[#282828] p-5 md:p-8">
        <h2 className="mb-1.5 text-lg [font-family:'Doran',Tahoma,sans-serif]">حریم خصوصی</h2>
        <p className="mb-5 text-xs text-[#8a8a8a]">تو تصمیم می‌گیری چه چیزی از فعالیتت دیده شود.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {PRIVACY_ITEMS.map((item) => (
            <PrivacyToggle key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
