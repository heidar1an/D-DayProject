/*
 * هستهٔ مشترک آداپتورهای «تلگرام‌گونه».
 *
 * بله، تلگرام و ایتا هر سه یک شکل API دارند (ایتا و بله عمداً خودشان را با
 * تلگرام سازگار کرده‌اند):
 *
 *   POST {base}{token}/{method}   →  { ok: true, result }  |  { ok: false, description }
 *
 * پس منطق تکراری در یک جا نوشته می‌شود و هر پلتفرم فقط پیکربندی خودش را
 * می‌دهد. `bale.js` دست‌نخورده مانده چون قرارداد خودش را دارد و تست‌ها به آن
 * تکیه دارند؛ این فایل برای پلتفرم‌های تازه است.
 *
 * قواعد ثابت (همان قواعد بله، چون همان ریسک‌ها وجود دارد):
 *   - توکن هرگز لاگ نمی‌شود و هرگز در پاسخ برنمی‌گردد.
 *   - هر فراخوانی Timeout دارد؛ سرور بی‌پاسخ درخواست را قفل نمی‌کند.
 *   - خطاهای رایج به فارسی قابل‌فهم ترجمه می‌شوند.
 *   - هیچ وابستگی بیرونی ندارد؛ فقط `fetch`/`FormData`/`Blob` خودِ Node.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/* سقف متن همراه مدیا (قرارداد تلگرام/بله/ایتا) */
export const CAPTION_LIMIT = 1000;

/* این پلتفرم‌ها ۲ پیام در ثانیه به هر گفتگو اجازه می‌دهند */
const PAUSE_BETWEEN_MESSAGES_MS = 600;

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];

function timeoutMs() {
  const value = Number(process.env.PUBLISH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function platformError(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/*
 * ترجمهٔ خطاهای رایج به فارسی. اگر الگویی نخورد، متن خود سرویس برگردانده
 * می‌شود (بدون توکن) تا کاربر حداقل پیام اصلی را ببیند.
 *
 * ترتیب مهم است: «ربات عضو/ادمین نیست» باید **پیش از** بررسی توکن بیاید، چون
 * تلگرام برای کمبود دسترسی هم کد ۴۰۳ می‌دهد — همان کدی که برای توکن باطل می‌دهد
 * (متنش: `Forbidden: bot is not a member of the channel chat`). اگر ۴۰۳ بی‌قید
 * «توکن نامعتبر» ترجمه شود، کاربری که فقط باید ربات را ادمین کانال کند، دنبال
 * توکن تازه می‌رود و مشکل واقعی هیچ‌وقت دیده نمی‌شود.
 */
function friendlyDescription(raw, status) {
  const text = String(raw ?? '').trim();
  const haystack = text.toLowerCase();

  if (status === 429 || haystack.includes('too many requests') || haystack.includes('retry after')) {
    return 'محدودیت نرخ ارسال؛ چند لحظه بعد دوباره تلاش کنید';
  }
  if (haystack.includes('chat not found') || haystack.includes('peer_id_invalid')) {
    return 'کانال پیدا نشد؛ شناسهٔ کانال را بررسی کنید (مثل @tapesh یا شناسهٔ عددی)';
  }
  if (haystack.includes('bot was blocked') || haystack.includes('user is deactivated')) {
    return 'ربات توسط گیرنده مسدود شده است';
  }
  if (
    haystack.includes('not a member')
    || haystack.includes('not enough rights')
    || haystack.includes('chat_admin_required')
    || haystack.includes('not enough permission')
    || haystack.includes('chat_write_forbidden')
    || haystack.includes('member list is inaccessible')
    || haystack.includes('forbidden')
  ) {
    return 'ربات در این کانال عضو یا ادمین نیست؛ آن را با اجازهٔ ارسال پست ادمین کنید';
  }
  if (status === 401 || haystack.includes('unauthorized') || haystack.includes('invalid token')) {
    return 'توکن ربات نامعتبر است یا باطل شده';
  }
  if (haystack.includes('wrong file identifier') || haystack.includes('file is too big')) {
    return 'فایل برای ارسال مناسب نیست یا حجمش بیش از حد مجاز است';
  }

  return text || 'سرویس درخواست را نپذیرفت';
}

function toBlob(media) {
  return new Blob([media.buffer], { type: media.mimeType || 'application/octet-stream' });
}

function sleep(ms) {
  return new Promise((resolvePromise) => { setTimeout(resolvePromise, ms); });
}

/* ─────────────────────── ساخت یک آداپتور با پیکربندی ─────────────────────── */

export function createTelegramLikeAdapter(config) {
  const {
    id, label, description, family, apiBaseEnv, defaultApiBase, tokenEnv,
    targetLabel, targetHint, tokenLabel, tokenHint, docsUrl, setupSteps,
    supports, contentTypes, metrics: metricKeys, apiName, setupUrl, setupUrlLabel,
    /* آیا «اجازهٔ ارسال» هم بررسی شود؟ فقط جایی که API اجازه می‌دهد (تلگرام) */
    probeAdmin = false,
  } = config;

  const PLATFORM = {
    id,
    label,
    family: family ?? 'messenger',
    description,
    apiKind: 'telegram-like',
    targetLabel,
    targetHint,
    tokenLabel,
    tokenHint,
    tokenEnv,
    docsUrl,
    /* لینک راه‌اندازی هر پلتفرم جدا است (BotFather در تلگرام، پنل ایتایار و…) */
    setupUrl: setupUrl ?? '',
    setupUrlLabel: setupUrlLabel ?? '',
    setupSteps,
    supports: supports ?? ['text', 'image', 'document'],
    contentTypes,
    metrics: metricKeys ?? ['followers'],
    /*
     * `capabilities` تعیین می‌کند پنل چه دکمه‌ای نشان بدهد. اگر API یک
     * پلتفرم آمار نمی‌دهد، همان‌جا صادقانه `metrics: false` می‌ماند و UI
     * به‌جای عدد ساختگی «نیازمند اتصال» نشان می‌دهد.
     */
    capabilities: {
      publish: true,
      metrics: (metricKeys ?? []).length > 0,
      comments: false,
      messages: false,
      sync: false,
    },
  };

  function apiBase() {
    return String(process.env[apiBaseEnv] || defaultApiBase).replace(/\/+$/, '');
  }

  function envToken() {
    return String(process.env[tokenEnv] || '').trim();
  }

  async function callMethod(token, method, { json, form } = {}) {
    if (!token) throw platformError(`توکن ${label} تنظیم نشده است`, 'PUBLISH_NO_TOKEN');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs());
    let response;

    try {
      response = await fetch(`${apiBase()}${token}/${method}`, {
        method: 'POST',
        signal: controller.signal,
        ...(form
          ? { body: form }
          : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json ?? {}) }),
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw platformError(`پاسخ ${label} در ${timeoutMs() / 1000} ثانیه نرسید`, 'PUBLISH_TIMEOUT');
      }
      throw platformError(`ارتباط با سرور ${label} برقرار نشد؛ اتصال شبکه را بررسی کنید`, 'PUBLISH_UNREACHABLE');
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
      throw platformError(`پاسخ ${label} قابل خواندن نبود (کد ${response.status})`, 'PUBLISH_FAILED', { httpStatus: response.status });
    }

    if (payload.ok === false) {
      const description_ = friendlyDescription(payload.description, response.status);
      /* ۴۰۳ کد «دسترسی» است نه «توکن باطل» — کد خطا هم باید همین را بگوید */
      const code = response.status === 401 ? 'PUBLISH_UNAUTHORIZED'
        : response.status === 403 ? 'PUBLISH_FORBIDDEN'
          : 'PUBLISH_FAILED';
      throw platformError(description_, code, {
        httpStatus: response.status,
        platformCode: payload.error_code ?? null,
        /* متن اصلی سرویس نگه داشته می‌شود تا بالادست بتواند روی علت دقیق تصمیم بگیرد */
        platformDescription: String(payload.description ?? ''),
      });
    }

    if (!response.ok) {
      throw platformError(friendlyDescription(payload.description, response.status), 'PUBLISH_FAILED', {
        httpStatus: response.status,
        platformCode: payload.error_code ?? null,
      });
    }

    return payload.result ?? null;
  }

  /* ── متدهای عمومی ── */

  async function getMe(token) {
    const result = await callMethod(token, 'getMe');
    return {
      id: result?.id ?? null,
      username: result?.username ?? '',
      name: result?.name ?? result?.first_name ?? '',
    };
  }

  async function getChat(token, target) {
    const result = await callMethod(token, 'getChat', { json: { chat_id: target } });
    return {
      id: result?.id ?? null,
      type: result?.type ?? '',
      title: result?.title ?? result?.first_name ?? '',
      username: result?.username ?? '',
      memberCount: result?.member_count ?? null,
    };
  }

  /* تعداد اعضا = دنبال‌کنندهٔ واقعی کانال؛ اگر پلتفرم ندهد، null می‌ماند */
  async function getMemberCount(token, target) {
    try {
      const result = await callMethod(token, 'getChatMemberCount', { json: { chat_id: target } });
      const count = typeof result === 'number' ? result : result?.count ?? null;
      return Number.isFinite(count) ? Number(count) : null;
    } catch {
      return null;
    }
  }

  /*
   * آیا ربات واقعاً اجازهٔ ارسال دارد؟
   *
   * چرا لازم است؟ `getChat` برای کانال **عمومی** حتی وقتی ربات اصلاً عضو نیست هم
   * موفق می‌شود (آزمون واقعی روی `@mytapesh`). پس `getChat` فقط می‌گوید «کانال
   * وجود دارد»، نه «ربات می‌تواند در آن پست بگذارد» — و پنلی که از آن تیک سبز
   * بسازد، دروغ گفته است.
   *
   * `getChatAdministrators` این را می‌گوید: اگر ربات ادمین باشد لیست ادمین‌ها را
   * می‌دهد، وگرنه «member list is inaccessible» می‌گیرد.
   *
   * فقط همین دو حالت قطعی خوانده می‌شود؛ هر خطای دیگری «نامعلوم» می‌ماند تا هیچ‌وقت
   * ادعای نادرست نکنیم (مثلاً قطع‌شدن شبکه نباید «ربات ادمین نیست» ترجمه شود).
   */
  async function probeAdminAccess(token, target) {
    try {
      await callMethod(token, 'getChatAdministrators', { json: { chat_id: target } });
      return { admin: true };
    } catch (error) {
      const raw = String(error?.platformDescription ?? '').toLowerCase();
      if (raw.includes('member list is inaccessible') || raw.includes('not enough rights')) {
        return { admin: false };
      }
      return { admin: null };
    }
  }

  function plan({ text, media }) {
    const body = String(text ?? '').trim();
    const steps = [];

    if (media) {
      const fitsInCaption = body.length > 0 && body.length <= CAPTION_LIMIT;
      const method = media.kind === 'image' ? 'sendPhoto' : media.kind === 'video' ? 'sendVideo' : 'sendDocument';
      steps.push({
        method,
        label: media.kind === 'image' ? 'ارسال تصویر' : media.kind === 'video' ? 'ارسال ویدئو' : 'ارسال فایل',
        caption: fitsInCaption ? body : '',
        media,
      });
      if (body && !fitsInCaption) {
        steps.push({ method: 'sendMessage', label: 'ارسال متن کامل', text: body, media: null });
      }
    } else if (body) {
      steps.push({ method: 'sendMessage', label: 'ارسال متن', text: body, media: null });
    }

    return steps;
  }

  function summarize(steps, target) {
    return {
      api: apiName ?? label,
      target,
      steps: steps.map((step) => ({
        method: step.method,
        label: step.label,
        textLength: step.text ? step.text.length : (step.caption ?? '').length,
        hasMedia: Boolean(step.media),
        mediaFilename: step.media?.filename ?? null,
        mediaKind: step.media?.kind ?? null,
      })),
    };
  }

  async function send({ token, target, text, media, options = {} }) {
    const steps = plan({ text, media });
    if (!steps.length) throw platformError('متن پیام خالی است', 'VALIDATION_ERROR');

    const sent = [];

    for (const step of steps) {
      if (sent.length) await sleep(PAUSE_BETWEEN_MESSAGES_MS);

      let result;
      if (step.method === 'sendMessage') {
        result = await callMethod(token, 'sendMessage', {
          json: {
            chat_id: target,
            text: step.text,
            disable_notification: Boolean(options.disableNotification),
          },
        });
      } else {
        const form = new FormData();
        form.append('chat_id', target);
        if (step.caption) form.append('caption', step.caption);
        if (options.disableNotification) form.append('disable_notification', 'true');
        form.append(step.method === 'sendPhoto' ? 'photo' : step.method === 'sendVideo' ? 'video' : 'document', toBlob(step.media), step.media.filename);

        result = await callMethod(token, step.method, { form });
      }

      sent.push({ method: step.method, label: step.label, messageId: result?.message_id ?? null });
    }

    return { messages: sent, messageId: sent[0]?.messageId ?? null };
  }

  /*
   * سنجهٔ واقعی این خانواده فقط «تعداد اعضا» است. عدد دیگر (بازدید، تعامل)
   * را API ربات نمی‌دهد؛ پس برنمی‌گردانیم تا در UI «نیازمند اتصال» بماند.
   */
  async function metrics({ token, target }) {
    const followers = await getMemberCount(token, target);
    if (followers === null) return null;
    return { followers, followersAt: new Date().toISOString() };
  }

  /* ── تست اعتبار: توکن، بعد دسترسی به مقصد ── */
  async function verify({ token, target }) {
    const value = String(token ?? '').trim();
    const dest = String(target ?? '').trim();

    if (!value) {
      return {
        ok: false,
        complete: false,
        account: null,
        target: null,
        checks: [{ id: 'token', label: tokenLabel, ok: false, message: 'توکن را وارد کنید' }],
      };
    }

    const checks = [];
    let account = null;

    try {
      account = await getMe(value);
      checks.push({
        id: 'token',
        label: tokenLabel,
        ok: true,
        message: `ربات «${account.name || account.username || account.id}» شناسایی شد`,
      });
    } catch (error) {
      checks.push({ id: 'token', label: tokenLabel, ok: false, message: error?.message || 'توکن پذیرفته نشد' });
      return { ok: false, complete: false, account: null, target: null, checks };
    }

    if (!dest) {
      checks.push({
        id: 'target',
        label: `دسترسی به ${targetLabel}`,
        ok: null,
        message: `برای بررسی دسترسی، ${targetLabel} را وارد کنید`,
      });
      return { ok: true, complete: false, account, target: null, checks };
    }

    try {
      const info = await getChat(value, dest);
      checks.push({
        id: 'target',
        label: `دسترسی به ${targetLabel}`,
        ok: true,
        message: `${targetLabel} «${info.title || info.username || info.id}» در دسترس ربات است`,
      });

      /*
       * کانال عمومی را هر رباتی می‌بیند، پس `getChat` به‌تنهایی «اجازهٔ ارسال» را
       * ثابت نمی‌کند. برای پلتفرم‌هایی که این را می‌شود بررسی کرد، یک گام جلوتر
       * می‌رویم؛ وگرنه همین‌جا تمام می‌شود (رفتار قبلی، بدون تغییر).
       */
      if (probeAdmin) {
        const probe = await probeAdminAccess(value, dest);

        if (probe.admin === true) {
          checks.push({
            id: 'admin',
            label: 'اجازهٔ ارسال',
            ok: true,
            message: 'ربات ادمین این کانال است و می‌تواند پست بگذارد',
          });
          return { ok: true, complete: true, account, target: info, checks };
        }

        if (probe.admin === false) {
          checks.push({
            id: 'admin',
            label: 'اجازهٔ ارسال',
            ok: false,
            /*
             * دو حالت واقعی که هر دو به همین خطا می‌رسند و کاربر باید بتواند
             * تفکیکشان کند: (۱) ربات ادمین نشده، (۲) ربات را ادمین کرده ولی در
             * کانال **دیگری** — یوزرنیم‌های مشابه (`mtapesh` و `mytapesh`) این را
             * به یک تلهٔ واقعی تبدیل می‌کند.
             */
            message: 'ربات ادمین این کانال نیست؛ آن را با اجازهٔ ارسال پست ادمین کنید. '
              + 'اگر ادمینش کرده‌اید، شناسهٔ همین کانال را بررسی کنید — ممکن است کانال دیگری باشد (یوزرنیم‌های مشابه را جابه‌جا نگیرید).',
          });
          return { ok: false, complete: false, account, target: info, checks };
        }

        checks.push({
          id: 'admin',
          label: 'اجازهٔ ارسال',
          ok: null,
          message: 'اجازهٔ ارسال از API معلوم نشد؛ اولین ارسال واقعی مشخص می‌کند',
        });
        return { ok: true, complete: true, account, target: info, checks };
      }

      return { ok: true, complete: true, account, target: info, checks };
    } catch (error) {
      checks.push({
        id: 'target',
        label: `دسترسی به ${targetLabel}`,
        ok: false,
        message: error?.message || `${targetLabel} در دسترس ربات نیست`,
      });
      return { ok: false, complete: false, account, target: null, checks };
    }
  }

  return {
    PLATFORM,
    apiBase,
    envToken,
    callMethod,
    getMe,
    getChat,
    plan,
    summarize,
    send,
    metrics,
    verify,
  };
}

export { IMAGE_MIME, VIDEO_MIME };
