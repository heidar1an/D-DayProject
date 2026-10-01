/*
 * آداپتور اینستاگرام — Instagram Graph API.
 *
 * اینستاگرام با بقیه فرق دارد و همین باعث می‌شود آداپتور جدا داشته باشد:
 *
 *   ۱) احراز هویت دو بخشی است: `App ID` + `App Secret` برای اپ، و یک
 *      Access Token برای صفحه/اکانت. (بله و تلگرام فقط یک توکن دارند.)
 *   ۲) انتشار دومرحله‌ای است: اول یک «ظرف» ساخته می‌شود، بعد منتشر می‌شود.
 *   ۳) **مدیا باید از یک آدرس عمومی HTTPS قابل دسترسی باشد.** فایل‌های
 *      `public/uploads` روی سرور محلی به اینترنت باز نیستند، پس انتشار واقعی
 *      فقط وقتی کار می‌کند که `PUBLIC_SITE_URL` تنظیم شده باشد. اگر نباشد،
 *      آداپتور صریح می‌گوید چرا — به‌جای خطای مبهم از سمت اینستاگرام.
 *
 * آنچه واقعاً کار می‌کند: تأیید توکن، خواندن پروفایل و سنجه‌ها
 * (دنبال‌کننده، تعداد پست) و انتشار در صورت وجود آدرس عمومی.
 *
 * آنچه کار نمی‌کند و صادقانه اعلام می‌شود: خواندن کامنت و دایرکت (نیازمند
 * مجوزهای جدا و بازبینی اپ توسط متا) — پس `capabilities.comments = false`.
 */

import { assertSafeApiBase } from './urlGuard.js';

const DEFAULT_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const DEFAULT_TIMEOUT_MS = 20_000;

/* فقط تصویر و ویدئو از این آدرس عمومی قابل انتشارند */
const IMAGE_MIME = ['image/jpeg', 'image/png'];
const VIDEO_MIME = ['video/mp4', 'video/quicktime'];

export const INSTAGRAM_PLATFORM = {
  id: 'instagram',
  label: 'اینستاگرام',
  family: 'social',
  apiKind: 'graph',
  description: 'اینستاگرام — اکانت Business/Creator، اتصال با Graph API متا',
  targetLabel: 'شناسهٔ اکانت (IG User ID)',
  targetHint: 'شناسهٔ عددی اکانت اینستاگرام. با «تست اتصال» از روی توکن پیدا می‌شود.',
  tokenLabel: 'Access Token',
  tokenHint: 'توکن دسترسی بلندمدت اکانت بیزینس از Graph API متا',
  appIdLabel: 'App ID',
  appIdHint: 'شناسهٔ اپ در Meta for Developers',
  appSecretLabel: 'App Secret',
  appSecretHint: 'کلید اپ؛ فقط روی سرور ذخیره می‌شود و هرگز برنمی‌گردد',
  tokenEnv: 'INSTAGRAM_ACCESS_TOKEN',
  docsUrl: 'https://developers.facebook.com/docs/instagram-platform',
  setupSteps: [
    'اکانت اینستاگرام را به Professional (Business یا Creator) تبدیل کن.',
    'در developers.facebook.com یک App بساز و محصول Instagram Graph API را اضافه کن.',
    'صفحهٔ فیسبوک متصل را به اپ وصل کن و Access Token اکانت را بگیر.',
    'شناسهٔ IG User را با «تست اتصال» پیدا کن — پنل خودش از روی توکن می‌خواند.',
    'برای انتشار واقعی، آدرس عمومی سایت (PUBLIC_SITE_URL) هم باید تنظیم باشد.',
  ],
  supports: ['text', 'image', 'video'],
  contentTypes: ['post', 'story', 'reel', 'carousel', 'video'],
  metrics: ['followers', 'following', 'posts', 'reach', 'impressions', 'views', 'likes', 'comments', 'shares', 'saves', 'engagement'],
  capabilities: {
    publish: true,
    metrics: true,
    /* کامنت و دایرکت مجوز جدا و بازبینی متا می‌خواهد */
    comments: false,
    messages: false,
    sync: true,
  },
};

function graphBase() {
  return assertSafeApiBase(String(process.env.INSTAGRAM_GRAPH_BASE || DEFAULT_GRAPH_BASE), {
    envName: 'INSTAGRAM_GRAPH_BASE',
    platform: 'اینستاگرام',
  });
}

function timeoutMs() {
  const value = Number(process.env.PUBLISH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

export function instagramEnvToken() {
  return String(process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
}

function instagramError(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/* خطاهای متا کد عددی دارند؛ این جدول همان‌ها را به فارسی می‌برد */
function friendlyError(payload, status) {
  const error = payload?.error ?? {};
  const raw = String(error.message ?? '').trim();
  const code = Number(error.code);

  if (code === 190 || status === 401) return 'توکن اینستاگرام منقضی یا نامعتبر است؛ توکن تازه بگیرید';
  if (code === 10 || code === 200) return 'این اپ مجوز لازم برای این عملیات را ندارد (نیازمند بازبینی متا)';
  if (code === 4 || code === 17 || code === 32 || status === 429) return 'سقف درخواست اینستاگرام پر شده؛ بعداً تلاش کنید';
  if (code === 100) return 'پارامتر نامعتبر؛ شناسهٔ اکانت یا آدرس مدیا را بررسی کنید';
  if (/cannot be loaded|not reachable|url/i.test(raw)) return 'اینستاگرام به فایل دسترسی نداشت؛ آدرس باید عمومی و HTTPS باشد';
  if (status === 404) return 'اکانت یا منبع پیدا نشد؛ شناسهٔ اکانت را بررسی کنید';

  return raw || `اینستاگرام درخواست را نپذیرفت (کد ${status})`;
}

/* ───────────────────────── فراخوانی Graph API ───────────────────────── */

async function callGraph(token, path, { method = 'GET', params = {} } = {}) {
  if (!token) throw instagramError('توکن اینستاگرام تنظیم نشده است', 'PUBLISH_NO_TOKEN');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  const search = new URLSearchParams({ ...params, access_token: token });

  let response;
  try {
    response = method === 'POST'
      ? await fetch(`${graphBase()}${path}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: search.toString(),
      })
      : await fetch(`${graphBase()}${path}?${search.toString()}`, { method: 'GET', signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw instagramError(`پاسخ اینستاگرام در ${timeoutMs() / 1000} ثانیه نرسید`, 'PUBLISH_TIMEOUT');
    }
    throw instagramError('ارتباط با سرور اینستاگرام برقرار نشد؛ اتصال شبکه را بررسی کنید', 'PUBLISH_UNREACHABLE');
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!payload || typeof payload !== 'object') {
    throw instagramError(`پاسخ اینستاگرام قابل خواندن نبود (کد ${response.status})`, 'PUBLISH_FAILED', { httpStatus: response.status });
  }

  if (payload.error) {
    const message = friendlyError(payload, response.status);
    const code = Number(payload.error.code) === 190 ? 'PUBLISH_UNAUTHORIZED' : 'PUBLISH_FAILED';
    throw instagramError(message, code, { httpStatus: response.status, platformCode: payload.error.code ?? null });
  }

  if (!response.ok) {
    throw instagramError(friendlyError(payload, response.status), 'PUBLISH_FAILED', { httpStatus: response.status });
  }

  return payload;
}

/* ────────────────────────────── متدها ────────────────────────────── */

/* خودِ اپ/توکن چه کسی است — اولین بررسی اعتبار */
export async function getInstagramIdentity(token) {
  const payload = await callGraph(token, '/me', { params: { fields: 'id,name,username' } });
  return { id: payload.id ?? null, name: payload.name ?? '', username: payload.username ?? '' };
}

/* پروفایل و سنجه‌های پایهٔ اکانت اینستاگرام */
export async function getInstagramProfile(token, igUserId) {
  const payload = await callGraph(token, `/${encodeURIComponent(igUserId)}`, {
    params: { fields: 'id,username,name,followers_count,follows_count,media_count,profile_picture_url' },
  });

  return {
    id: payload.id ?? null,
    username: payload.username ?? '',
    name: payload.name ?? '',
    followers: Number(payload.followers_count) || 0,
    following: Number(payload.follows_count) || 0,
    posts: Number(payload.media_count) || 0,
    avatar: payload.profile_picture_url ?? '',
  };
}

/*
 * سنجه‌های بازه‌ای (Reach/Impressions). متا این‌ها را فقط برای اکانت‌های
 * Business با مجوز `instagram_manage_insights` می‌دهد؛ اگر نداد، `null`
 * برمی‌گردد تا UI صادقانه بگوید داده‌ای نیست.
 */
export async function getInstagramInsights(token, igUserId, { since, until } = {}) {
  try {
    const payload = await callGraph(token, `/${encodeURIComponent(igUserId)}/insights`, {
      params: {
        metric: 'reach,impressions,profile_views',
        period: 'day',
        ...(since ? { since } : {}),
        ...(until ? { until } : {}),
      },
    });

    const values = {};
    (payload.data ?? []).forEach((row) => {
      const total = (row.values ?? []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
      values[row.name] = total;
    });

    return {
      reach: values.reach ?? null,
      impressions: values.impressions ?? null,
      profileVisits: values.profile_views ?? null,
    };
  } catch {
    /* مجوز نداشتن نباید کل تحلیل را بشکند — فقط «داده‌ای نیست» */
    return null;
  }
}

/*
 * آدرس عمومی یک فایل آپلودی. اینستاگرام فقط آدرس HTTPS عمومی می‌پذیرد.
 * اگر `PUBLIC_SITE_URL` تنظیم نشده باشد، صریح خطا می‌دهیم.
 */
function publicMediaUrl(media) {
  const base = String(process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  if (!base) {
    throw instagramError(
      'برای انتشار در اینستاگرام، متغیر PUBLIC_SITE_URL باید تنظیم باشد تا فایل آدرس عمومی داشته باشد',
      'VALIDATION_ERROR',
    );
  }
  if (!base.startsWith('https://')) {
    throw instagramError('اینستاگرام فقط آدرس HTTPS را می‌پذیرد؛ PUBLIC_SITE_URL را با https تنظیم کنید', 'VALIDATION_ERROR');
  }
  if (!media?.url) throw instagramError('انتشار در اینستاگرام بدون تصویر یا ویدئو ممکن نیست', 'VALIDATION_ERROR');
  return `${base}${media.url}`;
}

export function instagramPlan({ text, media }) {
  const body = String(text ?? '').trim();
  const steps = [];

  if (!media) {
    steps.push({
      method: 'unsupported',
      label: 'بدون مدیا قابل انتشار نیست',
      text: body,
      media: null,
      warning: 'اینستاگرام پست بدون تصویر یا ویدئو نمی‌پذیرد.',
    });
    return steps;
  }

  const isVideo = VIDEO_MIME.includes(media.mimeType) || media.kind === 'video';

  steps.push({
    method: 'createContainer',
    label: isVideo ? 'ساخت ظرف ویدئو/ریلز' : 'ساخت ظرف تصویر',
    caption: body,
    media,
  });
  steps.push({ method: 'publishContainer', label: 'انتشار ظرف', text: '', media: null });

  return steps;
}

export function summarizeInstagramPlan(steps, target) {
  return {
    api: 'Instagram Graph API',
    target,
    steps: steps.map((step) => ({
      method: step.method,
      label: step.label,
      textLength: step.text ? step.text.length : (step.caption ?? '').length,
      hasMedia: Boolean(step.media),
      mediaFilename: step.media?.filename ?? null,
      mediaKind: step.media?.kind ?? null,
      warning: step.warning ?? null,
    })),
  };
}

/*
 * انتشار دومرحله‌ای. مرحلهٔ دوم فقط وقتی صدا زده می‌شود که اولی ظرف ساخته باشد؛
 * اگر شکست بخورد، خطای همان مرحله با «ظرف ساخته‌شده اما منتشر نشد» برمی‌گردد.
 */
export async function sendToInstagram({ token, target, text, media, options = {} }) {
  const steps = instagramPlan({ text, media });
  const first = steps[0];
  if (first.method === 'unsupported') throw instagramError(first.warning, 'VALIDATION_ERROR');

  const url = publicMediaUrl(media);
  const isVideo = VIDEO_MIME.includes(media.mimeType) || media.kind === 'video';

  const container = await callGraph(token, `/${encodeURIComponent(target)}/media`, {
    method: 'POST',
    params: {
      ...(isVideo ? { media_type: options.mediaType || 'REELS', video_url: url } : { image_url: url }),
      ...(text ? { caption: text } : {}),
    },
  });

  if (!container?.id) throw instagramError('اینستاگرام ظرف انتشار را نساخت', 'PUBLISH_FAILED');

  try {
    const published = await callGraph(token, `/${encodeURIComponent(target)}/media_publish`, {
      method: 'POST',
      params: { creation_id: container.id },
    });

    return {
      messages: [
        { method: 'createContainer', label: first.label, messageId: container.id },
        { method: 'publishContainer', label: 'انتشار ظرف', messageId: published?.id ?? null },
      ],
      messageId: published?.id ?? null,
    };
  } catch (error) {
    throw instagramError(`${error.message} — ظرف ساخته شد (${container.id}) ولی منتشر نشد`, error.code || 'PUBLISH_FAILED', {
      containerId: container.id,
    });
  }
}

export async function instagramMetrics({ token, target }) {
  const profile = await getInstagramProfile(token, target);
  const insights = await getInstagramInsights(token, target);

  return {
    followers: profile.followers,
    following: profile.following,
    posts: profile.posts,
    reach: insights?.reach ?? null,
    impressions: insights?.impressions ?? null,
    profileVisits: insights?.profileVisits ?? null,
    followersAt: new Date().toISOString(),
  };
}

/* ────────────────────────────── تست اعتبار ────────────────────────────── */

export async function verifyInstagram({ token, target, appId = '' }) {
  const value = String(token ?? '').trim();
  const igUserId = String(target ?? '').trim();

  if (!value) {
    return {
      ok: false,
      complete: false,
      account: null,
      target: null,
      checks: [{ id: 'token', label: INSTAGRAM_PLATFORM.tokenLabel, ok: false, message: 'توکن را وارد کنید' }],
    };
  }

  const checks = [];
  let account = null;

  try {
    account = await getInstagramIdentity(value);
    checks.push({
      id: 'token',
      label: INSTAGRAM_PLATFORM.tokenLabel,
      ok: true,
      message: `توکن پذیرفته شد${account.name ? ` — «${account.name}»` : ''}`,
    });
  } catch (error) {
    checks.push({ id: 'token', label: INSTAGRAM_PLATFORM.tokenLabel, ok: false, message: error?.message || 'توکن پذیرفته نشد' });
    return { ok: false, complete: false, account: null, target: null, checks };
  }

  if (appId) {
    checks.push({ id: 'app', label: 'App ID', ok: true, message: `اپ ${appId} ثبت شده است` });
  } else {
    checks.push({
      id: 'app',
      label: 'App ID',
      ok: null,
      message: 'اختیاری است؛ برای بازبینی و مدیریت اپ در متا لازم می‌شود',
    });
  }

  if (!igUserId) {
    checks.push({
      id: 'target',
      label: INSTAGRAM_PLATFORM.targetLabel,
      ok: null,
      message: account?.id ? `شناسهٔ پیشنهادی از روی توکن: ${account.id}` : 'برای بررسی، شناسهٔ اکانت را وارد کنید',
    });
    return { ok: true, complete: false, account, target: account?.id ? { id: account.id, username: account.username, title: account.name } : null, checks };
  }

  try {
    const profile = await getInstagramProfile(value, igUserId);
    checks.push({
      id: 'target',
      label: INSTAGRAM_PLATFORM.targetLabel,
      ok: true,
      message: `اکانت «${profile.username || profile.name || profile.id}» — ${profile.followers.toLocaleString('en-US')} دنبال‌کننده، ${profile.posts.toLocaleString('en-US')} پست`,
    });
    return { ok: true, complete: true, account, target: profile, checks };
  } catch (error) {
    checks.push({
      id: 'target',
      label: INSTAGRAM_PLATFORM.targetLabel,
      ok: false,
      message: error?.message || 'اکانت اینستاگرام در دسترس توکن نیست',
    });
    return { ok: false, complete: false, account, target: null, checks };
  }
}

export default {
  PLATFORM: INSTAGRAM_PLATFORM,
  verify: verifyInstagram,
  plan: instagramPlan,
  summarize: summarizeInstagramPlan,
  send: sendToInstagram,
  metrics: instagramMetrics,
};
