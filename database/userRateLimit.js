/*
 * Rate Limit احراز هویت کاربران سایت (login/register).
 *
 * الگو از `examApi.js` گرفته شده (پنجرهٔ ثابت درون-پروسسی، `Map` با پاک‌سازی
 * گاه‌به‌گاه) ولی منطق کپی نشده: اینجا **دو** سطل هم‌زمان سنجیده می‌شود —
 * یکی روی IP و یکی روی «IP + شناسه». دلیل:
 *
 *   • سطل IP جلوی password spraying و ثبت‌نام انبوه از یک ماشین را می‌گیرد.
 *   • سطل «IP + شناسه» جلوی brute force روی یک حساب را می‌گیرد، ولی چون به IP
 *     گره خورده، یک مهاجم نمی‌تواند با پر کردن سهمیهٔ یک شماره، کاربر واقعی را
 *     از همه‌جا قفل کند.
 *   • پنجره ثابت است، پس قفل «دائمی» نیست و بعد از پایان پنجره خودش باز می‌شود
 *     (کاربران پشت NAT مشترک هم برای همیشه قفل نمی‌شوند).
 *
 * محدودیت مستندشده: درون-پروسسی است. برای استقرار چند-نودی باید با یک
 * ذخیره‌گاه مشترک (Redis) جایگزین شود؛ همان محدودیتِ ثبت‌شدهٔ `examApi.js`.
 */

const BUCKETS = new Map();

export const AUTH_RATE_POLICY = {
  login: { windowMs: 60_000, perIp: 30, perIdentity: 8 },
  register: { windowMs: 300_000, perIp: 10, perIdentity: 3 },
  /*
   * مسیرهای بانک تست (PHASE 2). سقف‌ها سخاوتمندانه‌اند تا پاسخ‌دادن طبیعی
   * مختل نشود: یک کاربر در تمرین حدود ۶–۲۰ درخواست در دقیقه می‌زند و «ثبت
   * پایان آزمون» یک درخواست با چند صد ورودی است. هدف، بستن اسپم و استخراج
   * انبوه است، نه محدود کردن کاربر واقعی.
   */
  testBankAnswer: { windowMs: 60_000, perIp: 600, perIdentity: 150 },
  testBankGrade: { windowMs: 60_000, perIp: 120, perIdentity: 40 },
};

const MAX_TRACKED_KEYS = 20_000;

function normalizePart(value) {
  return String(value ?? '').trim().toLowerCase() || 'unknown';
}

function bucketKeys(scope, ip, identifier) {
  const normalizedIp = normalizePart(ip);
  const normalizedId = normalizePart(identifier);
  return {
    ipKey: `${scope}:ip:${normalizedIp}`,
    identityKey: `${scope}:id:${normalizedIp}|${normalizedId}`,
  };
}

function readBucket(key, windowMs, now) {
  const bucket = BUCKETS.get(key);
  if (!bucket || bucket.windowStart + windowMs <= now) return { count: 0, windowStart: now };
  return bucket;
}

/*
 * مصرف یک تلاش. همهٔ سطل‌ها **اول** سنجیده می‌شوند و بعد شمارش بالا می‌رود؛
 * یعنی درخواست بلاک‌شده سهمیهٔ اضافه مصرف نمی‌کند.
 */
export function consumeAuthAttempt(scope, { ip = '', identifier = '' } = {}, now = Date.now()) {
  const policy = AUTH_RATE_POLICY[scope] ?? AUTH_RATE_POLICY.login;
  const { ipKey, identityKey } = bucketKeys(scope, ip, identifier);

  const checks = [
    { key: ipKey, limit: policy.perIp },
    { key: identityKey, limit: policy.perIdentity },
  ].map((entry) => ({ ...entry, bucket: readBucket(entry.key, policy.windowMs, now) }));

  const blocked = checks.find((entry) => entry.bucket.count >= entry.limit);
  if (blocked) {
    const resetsAt = blocked.bucket.windowStart + policy.windowMs;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - now) / 1000)),
    };
  }

  for (const entry of checks) {
    BUCKETS.set(entry.key, { windowStart: entry.bucket.windowStart, count: entry.bucket.count + 1 });
  }

  /* سقف تعداد کلیدها تا `Map` در ترافیک سنگین رشد نکند */
  if (BUCKETS.size > MAX_TRACKED_KEYS) sweepAuthRateLimit(now);

  return { allowed: true, retryAfterSeconds: 0 };
}

export function sweepAuthRateLimit(now = Date.now()) {
  const longest = Math.max(
    ...Object.values(AUTH_RATE_POLICY).map((policy) => policy.windowMs),
  );

  for (const [key, bucket] of BUCKETS) {
    if (bucket.windowStart + longest * 2 <= now) BUCKETS.delete(key);
  }
}

/* فقط برای تست‌ها: پاک‌کردن کامل پنجره‌ها */
export function resetAuthRateLimit() {
  BUCKETS.clear();
}

export function authRateLimitStats() {
  return { trackedKeys: BUCKETS.size, policy: AUTH_RATE_POLICY };
}

setInterval(() => sweepAuthRateLimit(), 120_000).unref?.();
