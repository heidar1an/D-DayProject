/*
 * پل لیگ و گیمیفیکیشن بین فرانت و v1 (فاز ۱۴) — تنها نقطهٔ تماس UI با endpointهای لیگ.
 *
 * قرارداد v1 (فقط خواندنی — هیچ mutationای برای XP/رتبه/نشان وجود ندارد):
 *   GET /me/league                            → { season, membership, rank, neighbors }
 *   GET /league/seasons/{id}/leaderboard      → { entries } + meta { page, perPage, total, lastPage }
 *   GET /me/challenges                        → { items }
 *   GET /me/achievements                      → { items }
 *
 * قواعد:
 *   ۱. هویت از سشن است؛ هیچ userId‌ای به سرور نمی‌رود.
 *   ۲. رتبه و ترتیب کاملاً سروری است (xp_total DESC, user_id ASC) — کلاینت مرتب نمی‌کند.
 *   ۳. `display_name` هویت عمومی مستعار است؛ تلفن/ایمیل/شناسهٔ کاربر هرگز به UI نمی‌آید.
 *
 * سوئیچ UI: مثل examV1، سویچ کردن import در leagueService به cutover اتمی موکول است؛
 * این پل شکل مصرفی camelCase را از الان آماده و با `v1:contract:check` قفل می‌کند.
 */

import { v1Request } from '../api/v1';

function toSeason(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    slug: row.slug ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    status: row.status ?? null,
    daysRemaining: Number(row.days_remaining ?? 0),
  };
}

function toEntry(row) {
  if (!row) return null;

  return {
    rank: Number(row.rank ?? 0),
    displayName: row.display_name ?? null,
    avatarKey: row.avatar_key ?? null,
    university: row.university ?? null,
    xpTotal: Number(row.xp_total ?? 0),
    isYou: row.is_you === true,
  };
}

/**
 * نمای لیگ کاربر جاری — فصل جاری، امتیاز، رتبه، همسایه‌ها.
 * `membership: null` یعنی هنوز XP واقعی این فصل نگرفته و در leaderboard نیست.
 */
export async function fetchLeagueV1Overview() {
  const result = await v1Request('/me/league');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const row = result.data ?? {};

  return {
    ok: true,
    overview: {
      season: toSeason(row.season),
      membership:
        row.membership === null || row.membership === undefined
          ? null
          : {
              xpTotal: Number(row.membership.xp_total ?? 0),
              joinedAt: row.membership.joined_at ?? null,
            },
      rank: row.rank === null || row.rank === undefined ? null : Number(row.rank),
      neighbors: (row.neighbors ?? []).map(toEntry),
    },
  };
}

/**
 * leaderboard یک فصل — صفحه‌بندی سروری با سقف perPage.
 * `seasonId` باید UUID باشد؛ فصل ناشناخته ۴۰۴ می‌دهد.
 */
export async function fetchLeagueV1Leaderboard(seasonId, { page = 1, perPage } = {}) {
  const params = new URLSearchParams();

  if (page) params.set('page', String(page));
  if (perPage) params.set('perPage', String(perPage));

  const query = params.toString();
  const result = await v1Request(`/league/seasons/${encodeURIComponent(seasonId)}/leaderboard${query ? `?${query}` : ''}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const meta = result.meta ?? {};

  return {
    ok: true,
    entries: (result.data?.entries ?? []).map(toEntry),
    page: Number(meta.page ?? 1),
    perPage: Number(meta.perPage ?? 0),
    total: Number(meta.total ?? 0),
    lastPage: Number(meta.lastPage ?? 1),
  };
}

/**
 * چالش‌های دورهٔ جاری (روزانه/هفتگی) با پیشرفت واقعی کاربر.
 */
export async function fetchLeagueV1Challenges() {
  const result = await v1Request('/me/challenges');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    items: (result.data?.items ?? []).map((row) => ({
      id: row.id ?? null,
      code: row.code ?? null,
      name: row.name ?? null,
      description: row.description ?? null,
      kind: row.kind ?? null,
      metric: row.metric ?? null,
      target: Number(row.target ?? 0),
      xpReward: Number(row.xp_reward ?? 0),
      status: row.status ?? null,
      progress: Number(row.progress ?? 0),
      completedAt: row.completed_at ?? null,
      isDone: row.status === 'completed',
    })),
  };
}

/**
 * نشان‌ها — تعریف کامل + وضعیت باز شدن برای کاربر جاری.
 */
export async function fetchLeagueV1Achievements() {
  const result = await v1Request('/me/achievements');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const items = (result.data?.items ?? []).map((row) => ({
    id: row.id ?? null,
    code: row.code ?? null,
    name: row.name ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    unlocked: row.unlocked === true,
    unlockedAt: row.unlocked_at ?? null,
  }));

  return { ok: true, items, unlockedCount: items.filter((item) => item.unlocked).length };
}
