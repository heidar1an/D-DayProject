/*
 * تاب‌آوری فراخوانی سرویس‌های بیرونی انتشار — مدارشکن + تلاش مجدد کنترل‌شده.
 *
 * ── چرا این فایل وجود دارد ──
 * آداپتورهای انتشار فقط «مهلت» داشتند (`PUBLISH_TIMEOUT_MS` با `AbortController`).
 * وقتی یک پلتفرم از کار می‌افتاد، هر انتشار بعدی هم مستقل به همان سرویس مرده
 * می‌کوبید و کاربر منتظر مهلت ۱۵ ثانیه‌ای می‌ماند. هیچ حالتی از «این سرویس الان
 * خراب است» نگه داشته نمی‌شد.
 *
 * ── قواعدی که عمداً رعایت شده ──
 *   ۱) **کد خطای جدید ساخته نمی‌شود.** مدار باز با همان `PUBLISH_UNREACHABLE`
 *      (۵۰۲، retryable) گزارش می‌شود تا جدول قرارداد API و تست‌هایش دست‌نخورده
 *      بمانند. نشانهٔ «مدار باز» در پرچم `circuitOpen` می‌ماند، نه در کد.
 *   ۲) **تلاش مجدد برای «ارسال» به‌صورت پیش‌فرض خاموش است.** مهلت‌تمام‌شدن
 *      مبهم است: ممکن است پیام واقعاً رفته باشد؛ تلاش مجدد خودکار ⇒ پیام تکراری.
 *      پس ارسال «حداکثر یک‌بار» است مگر فراخوان صریحاً `retry` بدهد.
 *   ۳) تلاش مجدد برای عملیات **خواندنی** (`verify`/`metrics`) امن است و روشن است.
 *   ۴) فقط خطاهای **گذرا** دوباره تلاش می‌شوند: ۴۲۹، ۵xx، مهلت، قطع ارتباط.
 *      ۴۰۱/۴۰۳/۴۰۰ هرگز — چون تکرارشان فقط تأخیر است، نه درمان.
 *   ۵) خالص و بدون I/O بیرونی؛ `now`/`sleep` تزریق‌پذیرند تا تست قطعی باشد.
 */

export const CIRCUIT_OPEN_FLAG = 'circuitOpen';

const DEFAULTS = {
  failureThreshold: 5,
  cooldownMs: 60_000,
  baseDelayMs: 400,
  maxDelayMs: 5_000,
};

/* کدهای خطایی که نبودِ وضعیت HTTP را «گذرا» تفسیر می‌کنند */
const TRANSIENT_CODES = new Set(['PUBLISH_TIMEOUT', 'PUBLISH_UNREACHABLE', 'PUBLISH_FAILED']);

/*
 * آیا این خطا گذراست؟ (⇒ تلاش مجدد می‌ارزد)
 * ۴۰۱/۴۰۳/۴۰۰/۴۰۴ پاسخ قطعی سرویس‌اند؛ تکرار فقط مهلت را طولانی می‌کند.
 */
export function isTransient(error) {
  if (!error) return false;

  const status = Number(error.httpStatus);
  if (Number.isFinite(status) && status > 0) return status === 429 || status >= 500;

  return TRANSIENT_CODES.has(String(error.code ?? ''));
}

export function createCircuitBreaker({
  failureThreshold = DEFAULTS.failureThreshold,
  cooldownMs = DEFAULTS.cooldownMs,
  now = Date.now,
} = {}) {
  const states = new Map();

  function stateOf(key) {
    let state = states.get(key);
    if (!state) {
      state = { failures: 0, openedAt: 0 };
      states.set(key, state);
    }
    return state;
  }

  /* آیا اجازهٔ فراخوانی هست؟ اگر مدار باز و مهلت گذشته باشد، یک «کاوش» مجاز است. */
  function allow(key) {
    const state = stateOf(key);
    if (state.failures < failureThreshold) return { allowed: true };

    const elapsed = now() - state.openedAt;
    if (elapsed >= cooldownMs) {
      /* نیمه‌باز: یک تلاش آزمایشی. موفق ⇒ بسته؛ ناموفق ⇒ دوباره باز. */
      state.failures = 0;
      state.openedAt = 0;
      return { allowed: true, probe: true };
    }

    return { allowed: false, retryAfterMs: Math.max(0, cooldownMs - elapsed) };
  }

  function recordSuccess(key) {
    const state = stateOf(key);
    state.failures = 0;
    state.openedAt = 0;
  }

  function recordFailure(key) {
    const state = stateOf(key);
    state.failures += 1;
    if (state.failures >= failureThreshold) state.openedAt = now();
  }

  function snapshot(key) {
    const state = stateOf(key);
    const open = state.failures >= failureThreshold;
    return {
      open,
      failures: state.failures,
      retryAfterMs: open ? Math.max(0, cooldownMs - (now() - state.openedAt)) : 0,
    };
  }

  function reset(key) {
    if (key === undefined) states.clear();
    else states.delete(key);
  }

  return { allow, recordSuccess, recordFailure, snapshot, reset };
}

const sleepReal = (ms) => new Promise((done) => setTimeout(done, ms));

/*
 * تلاش مجدد با backoff نمایی. `attempts` = تعداد کل تلاش‌ها (۱ = بدون تکرار).
 * `shouldRetry` تعیین می‌کند چه خطایی ارزش تکرار دارد.
 */
export async function withRetry(run, {
  attempts = 1,
  baseDelayMs = DEFAULTS.baseDelayMs,
  maxDelayMs = DEFAULTS.maxDelayMs,
  shouldRetry = isTransient,
  sleep = sleepReal,
  onRetry = null,
} = {}) {
  const total = Math.max(1, Math.floor(attempts));
  let lastError;

  for (let attempt = 1; attempt <= total; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt >= total || !shouldRetry(error)) throw error;

      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      if (typeof onRetry === 'function') onRetry({ attempt, delay, error });
      await sleep(delay);
    }
  }

  throw lastError;
}

/*
 * نمونهٔ مشترک پروسه. عمداً یک نمونه است تا وضعیت مدار بین همهٔ فراخوانی‌های
 * همان پروسه مشترک بماند (همان محدودیت ثبت‌شدهٔ نشست‌ها/متریک: تک‌پروسه‌ای).
 */
export const publisherBreaker = createCircuitBreaker();

export function resetPublisherBreaker() {
  publisherBreaker.reset();
}

/*
 * اجرای محافظت‌شده: اول دروازهٔ مدار، بعد تلاش مجدد، و در پایان ثبت نتیجه.
 * خطای «مدار باز» با همان کد `PUBLISH_UNREACHABLE` پرتاب می‌شود (بدون کد جدید)
 * و پرچم `circuitOpen: true` می‌گیرد تا در لاگ از یک قطعی واقعی تفکیک شود.
 */
export async function guardedCall(key, { run, retry = {}, breaker = publisherBreaker } = {}) {
  const gate = breaker.allow(key);

  if (!gate.allowed) {
    const error = Object.assign(
      new Error('سرویس بیرونی موقتاً کنار گذاشته شد (مدار باز)؛ چند لحظه بعد دوباره تلاش کنید'),
      { code: 'PUBLISH_UNREACHABLE', [CIRCUIT_OPEN_FLAG]: true, retryAfterMs: Math.ceil(gate.retryAfterMs) },
    );
    throw error;
  }

  try {
    const value = await withRetry(run, retry);
    breaker.recordSuccess(key);
    return value;
  } catch (error) {
    /* فقط شکستِ گذرا مدار را جلو می‌برد؛ خطای قطعی (۴۰۳/۴۰۰) سرویس را «خراب» نمی‌کند */
    if (isTransient(error)) breaker.recordFailure(key);
    throw error;
  }
}

export { DEFAULTS as RESILIENCE_DEFAULTS };
