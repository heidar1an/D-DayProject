/*
 * سرویس لیگ تپش — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی Mock است.
 * با اتصال Backend کافی است بدنهٔ هر تابع به fetch تبدیل شود؛ امضای خروجی عوض نمی‌شود.
 *
 * قراردادهای آینده:
 *   GET  /api/league/overview
 *   GET  /api/league/leaderboard?scope=university|universities|global&metric=total|avg|active&offset&limit
 *   GET  /api/league/challenges
 *   GET  /api/league/achievements
 *   GET  /api/league/profile-details
 *   GET  /api/league/notifications
 *   GET  /api/league/friends/notifications
 *   POST /api/league/challenges/:id/claim   ← اعتبارسنجی سمت سرور (Anti-Cheat)
 *   POST /api/league/battles/:id/join
 *   POST /api/league/duels                  ← نسخهٔ نهایی Duel
 *   POST /api/league/events                 ← Analytics
 *
 * نکتهٔ Anti-Cheat: هیچ rewardای از سمت Frontend قابل درج نیست؛ همهٔ امتیازها با
 * HeartTransaction سمت سرور ثبت و قبل از ثبت اعتبارسنجی می‌شوند (README بخش ۵).
 */

import {
  ACHIEVEMENTS,
  ACTIVITY_FEED,
  BATTLES,
  DAILY_CHALLENGES,
  DUEL,
  FRIENDS,
  FRIENDS_LEAGUE_NOTIFICATIONS,
  GLOBAL_TOP,
  GLOBAL_WINDOW,
  HEART_LEDGER,
  LEAGUE_NOTIFICATIONS,
  LEAGUE_TIERS,
  LIVE_EVENTS,
  ME,
  PAST_SEASONS,
  REWARDS,
  SEASON,
  STREAK_HISTORY,
  TITLES,
  UNIVERSITY_PLAYERS,
  UNIVERSITIES,
  WEEKLY_CHALLENGE,
} from './mockData';

const LATENCY_MS = 620;
const PAGE_SIZE = 10;

let simulateFailure = false;

/* برای تست حالت خطا از کنسول: __leagueService.__setFailure(true) */
export function __setFailure(next) {
  simulateFailure = next;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function respond(build) {
  await delay(LATENCY_MS + Math.random() * 260);
  if (simulateFailure) {
    simulateFailure = false;
    throw new Error('network-error');
  }
  return build();
}

/* پروفایل کاربر واقعی + لایهٔ لیگ */
function buildMe(userData) {
  const profile = userData?.profile ?? {};
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

  return {
    ...ME,
    id: userData?.id ?? 'guest',
    name: name || profile.username || 'کاربر تپش',
    university: profile.university || 'دانشگاه علوم پزشکی قم',
    avatar: profile.avatar ?? null,
    title: ME.title,
  };
}

/* GET /api/league/overview */
export function fetchLeagueOverview(userData) {
  return respond(() => {
    const me = buildMe(userData);
    const tier = LEAGUE_TIERS.find((item) => item.id === me.tierId);
    const above = [...UNIVERSITY_PLAYERS].sort((a, b) => b.hearts - a.hearts)[me.rank - 2];
    const gapToPrev = above ? above.hearts - me.hearts : 0;

    return {
      me,
      tier,
      tiers: LEAGUE_TIERS,
      season: SEASON,
      liveEvents: LIVE_EVENTS,
      activity: ACTIVITY_FEED,
      nextRank: {
        rank: me.rank - 1,
        gap: gapToPrev,
        label: gapToPrev > 0 ? `${gapToPrev} قلب تا رتبه ${me.rank - 1}` : null,
      },
      levelProgress: {
        level: me.level,
        step: me.hearts % me.levelStep,
        stepMax: me.levelStep,
      },
      tierProgress: {
        percent: Math.round(((me.hearts - tier.min) / (tier.max - tier.min)) * 100),
        toNextTier: tier.max - me.hearts + 1,
        nextName: LEAGUE_TIERS[LEAGUE_TIERS.findIndex((item) => item.id === tier.id) + 1]?.name ?? tier.name,
      },
    };
  });
}

/* GET /api/league/leaderboard — scope: university | universities | global */
export function fetchLeaderboard({ scope = 'university', metric = 'total', offset = 0 }) {
  return respond(() => {
    if (scope === 'universities') {
      const key = metric === 'avg' ? 'avg' : metric === 'active' ? 'active' : 'total';
      const sorted = [...UNIVERSITIES].sort((a, b) => b[key] - a[key]);
      return {
        items: sorted.slice(offset, offset + PAGE_SIZE).map((item, index) => ({ ...item, rank: offset + index + 1 })),
        total: sorted.length,
        nextOffset: offset + PAGE_SIZE < sorted.length ? offset + PAGE_SIZE : null,
        metric: key,
        /* جایگاه دانشگاه کاربر در معیار فعلی */
        meRank: sorted.findIndex((item) => item.id === 'qom') + 1,
      };
    }

    if (scope === 'global') {
      const ranked = GLOBAL_WINDOW.map((item, index) => ({ ...item, rank: 1279 + index }));
      const items = offset === 0 ? [...GLOBAL_TOP.map((item, i) => ({ ...item, rank: i + 1, seed: 40 + i })), ...ranked] : ranked.slice(offset - 3);
      return {
        items,
        total: 14200,
        nextOffset: null,
        meRank: ME.globalRank,
      };
    }

    const sorted = [...UNIVERSITY_PLAYERS]
      .sort((a, b) => b.hearts - a.hearts)
      .map((player, index) => ({
        ...player,
        rank: index < ME.rank - 1 ? index + 1 : index + 2,
      }));
    const withMe = [
      ...sorted.slice(0, ME.rank - 1),
      {
        id: 'me',
        name: ME.name,
        hearts: ME.hearts,
        avatar: null,
        university: 'دانشگاه علوم پزشکی قم',
        isYou: true,
        rank: ME.rank,
      },
      ...sorted.slice(ME.rank - 1),
    ];

    return {
      items: withMe.slice(offset, offset + PAGE_SIZE),
      total: withMe.length,
      nextOffset: offset + PAGE_SIZE < withMe.length ? offset + PAGE_SIZE : null,
      meRank: ME.rank,
      gapToPrev: withMe[ME.rank - 2]?.hearts - ME.hearts,
    };
  });
}

/* GET /api/league/challenges */
export function fetchChallenges() {
  return respond(() => ({
    daily: DAILY_CHALLENGES.map((item) => ({ ...item, done: item.progress >= item.goal })),
    weekly: WEEKLY_CHALLENGE,
    battles: BATTLES,
    duel: DUEL,
  }));
}

/* GET /api/league/achievements */
export function fetchAchievements() {
  return respond(() => ({
    items: ACHIEVEMENTS,
    unlockedCount: ACHIEVEMENTS.filter((item) => item.unlocked).length,
  }));
}

/* GET /api/league/profile-details */
export function fetchProfileDetails(userData) {
  return respond(() => ({
    me: buildMe(userData),
    titles: TITLES,
    rewards: REWARDS,
    ledger: HEART_LEDGER,
    streakHistory: STREAK_HISTORY,
    pastSeasons: PAST_SEASONS,
    season: SEASON,
  }));
}

/* GET /api/league/notifications
 * اعلان‌های شخصی لیگ (رتبه، رقیب، نبرد، رویداد) — تغذیه‌کنندهٔ فهرست لایهٔ اعلان‌های هدر.
 */
export function fetchLeagueNotifications() {
  return respond(() => ({
    items: LEAGUE_NOTIFICATIONS,
    unreadCount: LEAGUE_NOTIFICATIONS.filter((item) => item.unread).length,
  }));
}

export function markLeagueNotificationsRead() {
  return respond(() => {
    LEAGUE_NOTIFICATIONS.forEach((item) => {
      item.unread = false;
    });

    return { ok: true };
  });
}

/* GET /api/league/friends/notifications
 * فعالیت‌ها، نتایج و دستاوردهای «فقط همخوان‌ها» — تغذیه‌کنندهٔ فهرست لایهٔ اعلان‌های هدر.
 * markAllRead: بعد از باز شدن لایه، unreadها را مصرف می‌کند (در نسخهٔ واقعی: PATCH روی سرور).
 */
export function fetchFriendsLeagueNotifications() {
  return respond(() => ({
    friends: FRIENDS,
    items: FRIENDS_LEAGUE_NOTIFICATIONS,
    unreadCount: FRIENDS_LEAGUE_NOTIFICATIONS.filter((item) => item.unread).length,
  }));
}

export function markFriendsLeagueNotificationsRead() {
  return respond(() => {
    FRIENDS_LEAGUE_NOTIFICATIONS.forEach((item) => {
      item.unread = false;
    });

    return { ok: true };
  });
}

/*
 * Analytics stub — رویدادهای کلیدی (league_view, challenge_claim, achievement_unlock,
 * rank_changed, season_join, promotion, demotion, streak_extended).
 * در نسخهٔ واقعی: POST /api/league/events
 */
export function trackEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[league:track] ${name}`, payload);
  }
}
