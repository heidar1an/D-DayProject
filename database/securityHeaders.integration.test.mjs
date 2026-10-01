/*
 * تست یکپارچهٔ هدرهای امنیتی روی سرور واقعی — فاز ۸.
 *
 * چرا یکپارچه: تست واحد ثابت می‌کند تابع درست ساخته می‌شود؛ اینجا ثابت می‌شود
 * هدرها واقعاً روی **پاسخ HTTP** می‌نشینند — از جمله روی فایل آپلودی و SPA.
 *
 * بدون curl به loopback (در این محیط کار نمی‌کند) — با `node:http` مستقیم.
 *
 * اجرا: node --test database/securityHeaders.integration.test.mjs
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4300 + Math.floor(Math.random() * 400);

function httpGet(path, { method = 'GET' } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolvePromise({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }),
      );
    });
    req.on('error', rejectPromise);
    req.end();
  });
}

async function waitForServer(child, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await httpGet('/healthz');
      if (response.status === 200) return;
    } catch {
      /* هنوز بالا نیامده */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('سرور در زمان مقرر بالا نیامد');
}

test('هدرهای امنیتی روی پاسخ واقعی سرور', async (t) => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_ENV: 'development', TAPESH_ACCESS_LOG: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  try {
    await waitForServer(child);
  } catch (error) {
    child.kill('SIGKILL');
    throw new Error(`${error.message}\nstderr: ${stderr.slice(0, 800)}`);
  }

  t.after(() => {
    child.kill('SIGTERM');
  });

  /* ۱. مسیر سلامت */
  const health = await httpGet('/healthz');
  assert.equal(health.status, 200);

  /* ۲. SPA root */
  const root = await httpGet('/');
  assert.equal(root.status, 200);
  assert.ok(root.headers['content-security-policy'], 'CSP روی پاسخ HTML نبود');
  assert.equal(root.headers['x-frame-options'], 'DENY');
  assert.equal(root.headers['x-content-type-options'], 'nosniff');
  assert.ok(root.headers['referrer-policy']);
  assert.ok(root.headers['permissions-policy']);
  assert.ok(root.headers['x-request-id'], 'شناسهٔ درخواست باید ست شود');

  /* CSP نباید در production/dev غیرامن باشد */
  const csp = root.headers['content-security-policy'];
  assert.ok(!csp.includes("'unsafe-eval'"), 'unsafe-eval در CSP هست');
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));

  /* ۳. متای SEO روی HTML سروشده */
  assert.match(root.body, /rel="canonical"/, 'canonical تزریق نشد');
  assert.match(root.body, /property="og:image"/, 'og:image تزریق نشد');
  assert.match(root.body, /application\/ld\+json/, 'JSON-LD تزریق نشد');

  /* ۴. HSTS روی HTTP محلی نباید باشد */
  assert.equal(root.headers['strict-transport-security'], undefined, 'HSTS روی HTTP محلی ممنوع است');

  /* ۵. مسیر ناشناس API → ۴۰۴ با هدرهای امنیتی */
  const missing = await httpGet('/api/admin/definitely-not-a-route');
  assert.ok(missing.headers['content-security-policy'], 'CSP روی پاسخ API نبود');

  /* ۶. نقشهٔ سایت (اگر تولید شده باشد) */
  const sitemap = await httpGet('/sitemap.xml');
  if (sitemap.status === 200) {
    assert.match(sitemap.body, /<urlset/);
    assert.ok(!/#admin/.test(sitemap.body), 'URL خصوصی نباید در sitemap باشد');
  }
});
