/*
 * تست هدرهای امنیتی — فاز ۸.
 *
 * چه اثبات می‌کند (و چرا این assertها):
 *   • CSP در production **بدون** `'unsafe-inline'` و **بدون** `'unsafe-eval'` است.
 *   • هش اسکریپت inline از خودِ HTML محاسبه می‌شود (نه ثابت هارد‌کد) و اگر متن
 *     عوض شود هش هم عوض می‌شود.
 *   • HSTS روی HTTP محلی فرستاده **نمی‌شود** (وگرنه dev برای ماه‌ها قفل می‌شد) و
 *     روی HTTPS در production فرستاده می‌شود.
 *   • `frame-ancestors 'none'` و `X-Frame-Options: DENY` هر دو حاضرند.
 *
 * اجرا: node --test database/securityHeaders.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySecurityHeaders,
  buildCsp,
  extractInlineScripts,
  inlineScriptHashes,
  isHttpsRequest,
  staticSecurityHeaders,
} from './securityHeaders.js';
import { securityPosture } from './securityPosture.js';

/** پاسخ جعلی حداقلی — فقط آن‌قدر که ماژول لازم دارد. */
function fakeResponse() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
  };
}

const SAMPLE_HTML = `<!doctype html><html><head><script>window.__x = 1;</script></head>
<body><script type="module" src="/assets/app.js"></script></body></html>`;

test('استخراج اسکریپت inline: فقط بلوک‌های بدون src', () => {
  const blocks = extractInlineScripts(SAMPLE_HTML);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /window\.__x = 1;/);
});

test('هش اسکریپت inline با تغییر متن عوض می‌شود', () => {
  const first = inlineScriptHashes(SAMPLE_HTML);
  const second = inlineScriptHashes(SAMPLE_HTML.replace('__x = 1', '__x = 2'));
  assert.equal(first.length, 1);
  assert.match(first[0], /^'sha256-[A-Za-z0-9+/=]+'$/);
  assert.notEqual(first[0], second[0], 'هش باید به متن اسکریپت وابسته باشد');
});

test('CSP production: بدون unsafe-inline / unsafe-eval در script-src', () => {
  const csp = buildCsp({ dev: false, scriptHashes: inlineScriptHashes(SAMPLE_HTML) });
  const scriptSrc = csp.split('; ').find((part) => part.startsWith('script-src '));

  assert.ok(scriptSrc, 'script-src باید وجود داشته باشد');
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), 'production نباید unsafe-inline در script-src داشته باشد');
  assert.ok(!csp.includes("'unsafe-eval'"), 'unsafe-eval هرگز مجاز نیست');
  assert.match(scriptSrc, /'sha256-/, 'هش اسکریپت inline باید در script-src باشد');
});

test('CSP: بستن object/base/form/frame', () => {
  const csp = buildCsp({ dev: false, scriptHashes: [] });
  for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
    assert.ok(csp.includes(directive), `دستور «${directive}» در CSP نیست`);
  }
});

test('CSP dev: استثنای inline برای تزریق استایل ویت هست، ولی unsafe-eval نیست', () => {
  const csp = buildCsp({ dev: true, scriptHashes: [] });
  assert.ok(csp.includes("'unsafe-inline'"), 'dev باید استثنای inline داشته باشد');
  assert.ok(!csp.includes("'unsafe-eval'"), 'حتی dev هم unsafe-eval نمی‌گیرد');
});

test('هدرهای ثابت: nosniff / DENY / referrer / permissions', () => {
  const headers = staticSecurityHeaders();
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
  assert.match(headers['Permissions-Policy'], /microphone=\(\)/);
});

test('isHttpsRequest: پروکسی و سوکت', () => {
  assert.equal(isHttpsRequest({ headers: { 'x-forwarded-proto': 'https' }, socket: {} }), true);
  assert.equal(isHttpsRequest({ headers: { 'x-forwarded-proto': 'http' }, socket: {} }), false);
  assert.equal(isHttpsRequest({ headers: {}, socket: { encrypted: true } }), true);
  assert.equal(isHttpsRequest({ headers: {}, socket: {} }), false);
});

test('HSTS: روی HTTP محلی هرگز، روی HTTPS production بله', () => {
  const local = fakeResponse();
  const localResult = applySecurityHeaders(local, { headers: {}, socket: {} }, { dev: false, scriptHashes: [], hsts: true });
  assert.equal(localResult.hsts, false);
  assert.equal(local.getHeader('Strict-Transport-Security'), undefined);

  const https = fakeResponse();
  const httpsResult = applySecurityHeaders(https, { headers: { 'x-forwarded-proto': 'https' }, socket: {} }, { dev: false, scriptHashes: [], hsts: true });
  assert.equal(httpsResult.hsts, true);
  assert.match(https.getHeader('Strict-Transport-Security'), /max-age=31536000/);

  const devHttps = fakeResponse();
  applySecurityHeaders(devHttps, { headers: { 'x-forwarded-proto': 'https' }, socket: {} }, { dev: true, scriptHashes: [], hsts: true });
  assert.equal(devHttps.getHeader('Strict-Transport-Security'), undefined, 'در dev حتی روی https هم HSTS ممنوع است');
});

test('securityPosture با وضعیت واقعی هم‌خوان است و HSTS توسعه را غایب جا نمی‌زند', () => {
  const productionHttps = securityPosture({ production: true, https: true, insecureCookie: false });
  const developmentHttp = securityPosture({ production: false, https: false, insecureCookie: false });
  const productionHttp = securityPosture({ production: true, https: false, insecureCookie: false });
  const statusOf = (rows, key) => rows.find((item) => item.key === key)?.status;

  assert.equal(statusOf(productionHttps, 'csp'), 'active');
  assert.equal(statusOf(productionHttps, 'hsts'), 'active');
  assert.equal(statusOf(productionHttps, 'x-frame-options'), 'active');
  assert.equal(productionHttps.find((item) => item.key === 'referrer-policy').value, 'strict-origin-when-cross-origin');
  assert.equal(statusOf(productionHttp, 'hsts'), 'conditional', 'روی HTTP، HSTS عمداً ارسال نمی‌شود');
  assert.equal(statusOf(developmentHttp, 'csp'), 'conditional', 'سیاست توسعه به‌عمد از production ضعیف‌تر است');
  assert.equal(statusOf(developmentHttp, 'cookie-secure'), 'conditional');
});

test('applySecurityHeaders: همهٔ هدرهای لازم روی پاسخ می‌نشیند', () => {
  const response = fakeResponse();
  applySecurityHeaders(response, { headers: {}, socket: {} }, { dev: false, scriptHashes: inlineScriptHashes(SAMPLE_HTML) });

  for (const name of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) {
    assert.ok(response.getHeader(name), `هدر «${name}» ست نشد`);
  }
});
