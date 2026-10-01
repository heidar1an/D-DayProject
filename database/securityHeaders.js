/*
 * هدرهای امنیتی — فاز ۸.
 *
 * چرا وجود دارد: پیش از این **هیچ** هدر امنیتی روی پاسخ‌ها نبود (تنها
 * `X-Content-Type-Options` روی فایل‌های استاتیک و `X-Request-Id`). یعنی مرورگر
 * هیچ محدودیتی برای اسکریپت/فریم/فرم نداشت.
 *
 * طراحی CSP — بر پایهٔ **موجودی واقعی**، نه کپی از یک قالب:
 *   ۱. اسکریپت inline: دقیقاً **یکی** در `index.html` هست (ضد‌پرش تم). به‌جای
 *      `'unsafe-inline'`، هش SHA-256 همان بلوک از خودِ HTML محاسبه می‌شود؛ پس
 *      اگر روزی متن اسکریپت عوض شود، هش هم خودکار عوض می‌شود و CSP نمی‌شکند.
 *   ۲. استایل inline: ۵۰۷ `style={{…}}` در سورس هست، ولی React استایل را از راه
 *      CSSOM می‌نویسد و CSP **CSSOM را محدود نمی‌کند** (فقط `style=""` در HTML و
 *      `<style>` را محدود می‌کند). پس `style-src 'self'` کافی است و
 *      `'unsafe-inline'` لازم نیست. در حالت dev، ویت استایل را با `<style>` تزریق
 *      می‌کند و همان‌جا استثنا لازم است.
 *   ۳. `eval` / `new Function`: صفر مورد در سورس ⇒ `'unsafe-eval'` هرگز، حتی در dev.
 *   ۴. منبع بیرونی: هیچ. همه‌چیز same-origin است ⇒ `default-src 'self'`.
 *
 * `frame-ancestors 'none'` جای `X-Frame-Options: DENY` را می‌گیرد، ولی هر دو
 * فرستاده می‌شوند (مرورگرهای قدیمی `X-Frame-Options` را می‌فهمند).
 *
 * ⚠️ HSTS فقط در production و فقط روی درخواست HTTPS فرستاده می‌شود؛ فرستادنش روی
 * HTTP محلی، مرورگر را برای ماه‌ها به HTTPS قفل می‌کند و محیط dev را نابود می‌کند.
 */

import { createHash } from 'node:crypto';

/** بلوک‌های `<script>` بدون `src` — همان‌هایی که CSP بدون هش/نانس بلاک می‌کند. */
export function extractInlineScripts(html) {
  const blocks = [];
  const re = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(String(html ?? ''))) !== null) blocks.push(match[1]);
  return blocks;
}

/** هش SHA-256 به قالب CSP: `'sha256-<base64>'`. */
export function inlineScriptHashes(html) {
  return extractInlineScripts(html).map((code) => {
    const digest = createHash('sha256').update(code, 'utf8').digest('base64');
    return `'sha256-${digest}'`;
  });
}

/**
 * ساخت مقدار CSP.
 * @param {{dev?: boolean, scriptHashes?: string[], extraConnect?: string[]}} options
 */
export function buildCsp({ dev = false, scriptHashes = [], extraConnect = [] } = {}) {
  const scriptSrc = ["'self'", ...scriptHashes];
  /* dev: ویت HMR از WebSocket و eval-free sourcemap استفاده می‌کند؛ `<style>` تزریقی هم inline است. */
  if (dev) scriptSrc.push("'unsafe-inline'");

  const styleSrc = dev ? ["'self'", "'unsafe-inline'"] : ["'self'"];
  const connectSrc = ["'self'", ...extraConnect];
  if (dev) connectSrc.push('ws:', 'wss:');

  const directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    /* استایل React از CSSOM می‌آید و CSP آن را نمی‌گیرد؛ این دو خط صریح‌سازی‌اند. */
    'style-src': styleSrc,
    'style-src-attr': ["'unsafe-inline'"],
    'style-src-elem': styleSrc,
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'media-src': ["'self'", 'blob:'],
    'connect-src': connectSrc,
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };
  if (!dev) directives['upgrade-insecure-requests'] = [];

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/** سیاست‌های ثابت (بدون وابستگی به محیط) — برای تست و بازاستفاده. */
export function staticSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
  };
}

/** آیا این درخواست از دید پروکسی HTTPS است؟ */
export function isHttpsRequest(request) {
  const proto = String(request?.headers?.['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') return true;
  return Boolean(request?.socket?.encrypted);
}

/**
 * اعمال همهٔ هدرهای امنیتی روی پاسخ.
 * @param {import('node:http').ServerResponse} response
 * @param {import('node:http').IncomingMessage|null} request
 * @param {{dev?: boolean, scriptHashes?: string[], hsts?: boolean}} options
 * @returns {{csp: string, hsts: boolean}}
 */
export function applySecurityHeaders(response, request = null, { dev = false, scriptHashes = [], hsts = false } = {}) {
  const csp = buildCsp({ dev, scriptHashes });

  for (const [name, value] of Object.entries(staticSecurityHeaders())) {
    response.setHeader(name, value);
  }
  response.setHeader('Content-Security-Policy', csp);

  /*
   * HSTS: فقط production + درخواست HTTPS. روی HTTP محلی، مرورگر دامنه را برای
   * ماه‌ها به HTTPS قفل می‌کند و dev نابود می‌شود.
   */
  const hstsOn = Boolean(hsts) && !dev && isHttpsRequest(request);
  if (hstsOn) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return { csp, hsts: hstsOn };
}

/** آیا این پاسخ باید CSP بگیرد؟ (فایل‌های آپلودی کاربر نباید CSP سایت را بگیرند) */
export function shouldApply(response) {
  return Boolean(response) && !response.headersSent;
}
