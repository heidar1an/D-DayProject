import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGuardianStatus } from './guardian.js';
import { securitySection } from './analyticsEngine.js';
import { recordApiRequest, requestMetrics } from './analyticsStore.js';

const baseMetrics = {
  startedAt: '2026-10-01T10:00:00.000Z',
  uptimeSeconds: 3600,
  window: {
    durationMs: 300_000,
    observedMs: 300_000,
    complete: true,
    total: 16,
    errors: 9,
    authFailures: 8,
    authRateLimited: 1,
    byStatusClass: { '2xx': 7, '3xx': 0, '4xx': 4, '5xx': 5 },
    topPaths: [{ path: '/api/users/09123456789?email=private@example.test', count: 3, errors: 1 }],
    recentErrors: [{ t: '2026-10-01T10:04:00.000Z', method: 'GET', path: '/private/09123456789', status: 500 }],
  },
};

test('Guardian فقط وضعیت‌های مشاهده‌شده و هشدارهای deterministic را می‌سازد', () => {
  const report = buildGuardianStatus({
    metrics: baseMetrics,
    readiness: { ready: true, checks: [{ name: 'build-artifact', ok: true, detail: 'dist/index.html' }] },
    storage: { corrupt: 1, files: ['/private/database/content/articles.json'] },
    headers: [
      { key: 'csp', label: 'Content-Security-Policy', status: 'active', value: 'configured' },
      { key: 'hsts', label: 'Strict-Transport-Security', status: 'conditional', value: null },
    ],
    system: { cpuLoadPercent: 3.5, processRssBytes: 1_048_576, diskUsedPercent: null },
    now: Date.parse('2026-10-01T10:05:00.000Z'),
  });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.status, 'critical');
  assert.equal(report.traffic.serverErrorCount, 5);
  assert.equal(report.traffic.authFailures, 8);
  assert.equal(report.securityHeaders[1].status, 'conditional');
  assert.equal(report.storage.files[0], 'articles.json');
  assert.equal(report.system.diskUsedPercent, null);
  assert.ok(report.alerts.some((item) => item.id === 'server-error-burst'));
  assert.ok(report.alerts.some((item) => item.id === 'auth-failure-burst'));
  assert.ok(report.alerts.some((item) => item.id === 'storage-corruption-observed'));
  assert.equal(report.policy.automaticActions, false);
  assert.equal(report.scope.persistentIncidentLog, false);

  const serialized = JSON.stringify(report);
  for (const sensitive of ['09123456789', 'private@example.test', 'private/database', 'userAgent', 'password', 'cookie']) {
    assert.equal(serialized.includes(sensitive), false, `دادهٔ حساس ${sensitive} نباید در Guardian برگردد`);
  }
  assert.equal('score' in report, false, 'امتیاز امنیتی ساختگی نباید برگردد');
});

test('نبودن پنجرهٔ متریک، «سلامت کامل» جا زده نمی‌شود', () => {
  const report = buildGuardianStatus({ now: Date.parse('2026-10-01T10:05:00.000Z') });
  assert.equal(report.status, 'warning');
  assert.equal(report.traffic.sampleComplete, false);
  assert.ok(report.alerts.some((item) => item.id === 'request-metrics-unavailable'));
});

test('پنجرهٔ قطع‌شده هشدار عدم‌کامل‌بودن می‌دهد', () => {
  const report = buildGuardianStatus({
    metrics: { ...baseMetrics, window: { ...baseMetrics.window, complete: false } },
    readiness: { ready: true, checks: [] },
  });
  assert.equal(report.status, 'warning');
  assert.ok(report.alerts.some((item) => item.id === 'metrics-window-incomplete'));
});

test('مرکز امنیت هدرهای فعال را غایب و تلاش تکراری را IP مسدودشده جا نمی‌زند', () => {
  const now = Date.now();
  const data = securitySection({
    resolved: { key: '30d' },
    activity: Array.from({ length: 8 }, (_, index) => ({
      action: 'auth.login-failed',
      ip: '198.51.100.7',
      createdAt: new Date(now - index * 1000).toISOString(),
      metadata: { reason: 'invalid-credentials' },
    })),
    requests: { byStatus: { '4xx': 0 } },
    events: [],
    previousEvents: [],
    sources: {},
  }, { secure: true });

  assert.equal(data.score, null);
  assert.equal(data.headers.find((item) => item.key === 'x-frame-options')?.status, 'active');
  assert.notEqual(data.headers.find((item) => item.key === 'csp')?.status, 'missing');
  assert.notEqual(data.headers.find((item) => item.key === 'hsts')?.status, 'missing');
  assert.equal(data.headers.find((item) => item.key === 'referrer-policy')?.value, 'strict-origin-when-cross-origin');
  assert.equal(data.suspicious[0].reviewRecommended, true);
  assert.equal('blocked' in data.suspicious[0], false);
  assert.match(data.note, /IP و User-Agent/);
});

test('requestMetrics پنجرهٔ پنج‌دقیقه‌ای و ورود مدیر را بدون query/PII می‌شمارد', () => {
  const before = requestMetrics().window;
  recordApiRequest({ path: '/api/admin/auth/login?username=user@example.test', method: 'POST', status: 401 });
  recordApiRequest({ path: '/api/admin/auth/login?username=user@example.test', method: 'POST', status: 429 });
  const after = requestMetrics().window;

  assert.equal(after.total, before.total + 2);
  assert.equal(after.authFailures, before.authFailures + 1);
  assert.equal(after.authRateLimited, before.authRateLimited + 1);
  assert.equal(after.authScope, 'admin-login-only');
  assert.equal(JSON.stringify(after).includes('user@example.test'), false);
  assert.equal(after.topPaths.some((item) => item.path.includes('?')), false);
});
