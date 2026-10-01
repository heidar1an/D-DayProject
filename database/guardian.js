import { safePathname } from './observability.js';

/*
 * Guardian v1 — rules-only, read-only status assembly.
 *
 * This module receives already-collected, process-local snapshots. It never
 * reads or writes storage, emits network requests, blocks traffic, revokes
 * sessions, repairs files, or labels an IP/account as malicious.
 */

export const GUARDIAN_WINDOW_MS = 5 * 60_000;
export const GUARDIAN_THRESHOLDS = Object.freeze({
  serverErrors: 5,
  authFailures: 8,
});

const asCount = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
const fileNameOf = (value) => String(value ?? '').split(/[\\/]/).filter(Boolean).at(-1) ?? '';

export function buildGuardianStatus({
  metrics = {},
  readiness = null,
  storage = { corrupt: 0, files: [] },
  headers = [],
  system = null,
  sourceMode = 'process-local',
  now = Date.now(),
} = {}) {
  const hasWindow = Boolean(metrics.window);
  const window = metrics.window ?? {};
  const byStatusClass = window.byStatusClass ?? {};
  const serverErrors = asCount(byStatusClass['5xx']);
  const authFailures = asCount(window.authFailures);
  const authRateLimited = asCount(window.authRateLimited);
  const corruptCount = asCount(storage.corrupt);
  const alerts = [];

  if (!hasWindow) {
    alerts.push({
      id: 'request-metrics-unavailable',
      severity: 'warning',
      title: 'سنجهٔ درخواست در دسترس نیست',
      detail: 'منبع درخواست این پروسه پنجرهٔ آماری قابل‌استفاده ارائه نکرده است؛ وضعیت ترافیک نامشخص است.',
    });
  }

  if (readiness && readiness.ready === false) {
    alerts.push({
      id: 'service-not-ready',
      severity: 'critical',
      title: 'سرویس آماده نیست',
      detail: 'حداقل یکی از بررسی‌های readiness ناموفق است؛ این وضعیت فقط گزارش می‌شود و اقدامی انجام نمی‌دهد.',
    });
  }

  if (corruptCount > 0) {
    alerts.push({
      id: 'storage-corruption-observed',
      severity: 'critical',
      title: 'خرابی داده در این پروسه مشاهده شده',
      detail: `${corruptCount} فایل داده هنگام استفادهٔ همین پروسه نامعتبر دیده شده است. Guardian فایل را تعمیر یا بازنویسی نمی‌کند.`,
    });
  }

  if (serverErrors >= GUARDIAN_THRESHOLDS.serverErrors) {
    alerts.push({
      id: 'server-error-burst',
      severity: 'warning',
      title: 'تعداد خطاهای ۵xx بالا است',
      detail: `${serverErrors} خطای ۵xx در نمونهٔ پنجرهٔ فعلی ثبت شده است؛ مسیرها در بخش خطاهای اخیر قابل بررسی‌اند.`,
    });
  }

  if (authFailures >= GUARDIAN_THRESHOLDS.authFailures) {
    alerts.push({
      id: 'auth-failure-burst',
      severity: 'warning',
      title: 'تلاش‌های ناموفق ورود زیاد شده',
      detail: `${authFailures} پاسخ ۴۰۱ برای مسیرهای ورود در نمونهٔ فعلی ثبت شده است. IPها تفکیک نشده‌اند و هیچ حساب یا IP مسدود نشده است.`,
    });
  }

  if (window.complete === false) {
    alerts.push({
      id: 'metrics-window-incomplete',
      severity: 'warning',
      title: 'نمونهٔ ترافیک ناقص است',
      detail: 'به‌علت سقف حافظه، بخشی از رویدادهای پنجره نگه‌داری نشده؛ شمارش‌ها حداقلِ مشاهده‌شده‌اند.',
    });
  }

  const status = alerts.some((alert) => alert.severity === 'critical')
    ? 'critical'
    : alerts.length ? 'warning' : 'observing';

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    process: {
      startedAt: metrics.startedAt ?? null,
      uptimeSeconds: asCount(metrics.uptimeSeconds),
    },
    readiness: readiness ? {
      ready: Boolean(readiness.ready),
      checks: (Array.isArray(readiness.checks) ? readiness.checks : []).map((check) => ({
        name: String(check?.name ?? ''),
        ok: Boolean(check?.ok),
        detail: String(check?.detail ?? ''),
      })),
    } : { ready: null, checks: [] },
    traffic: {
      windowSecondsConfigured: Math.round(asCount(window.durationMs || GUARDIAN_WINDOW_MS) / 1000),
      windowSecondsObserved: Math.round(asCount(window.observedMs) / 1000),
      sampleComplete: window.complete === true,
      authScope: String(window.authScope ?? 'ورودهای کاربران و مدیران ثبت‌شده در این پروسه'),
      requestCount: asCount(window.total),
      errorCount: asCount(window.errors),
      serverErrorCount: serverErrors,
      authFailures,
      authRateLimited,
      byStatusClass: {
        '2xx': asCount(byStatusClass['2xx']),
        '3xx': asCount(byStatusClass['3xx']),
        '4xx': asCount(byStatusClass['4xx']),
        '5xx': serverErrors,
      },
      topPaths: (Array.isArray(window.topPaths) ? window.topPaths : []).slice(0, 8).map((item) => ({
        path: safePathname(item?.path),
        count: asCount(item?.count),
        errors: asCount(item?.errors),
      })),
      recentErrors: (Array.isArray(window.recentErrors) ? window.recentErrors : []).slice(0, 10).map((item) => ({
        t: String(item?.t ?? ''),
        method: String(item?.method ?? ''),
        path: safePathname(item?.path),
        status: asCount(item?.status),
      })),
    },
    storage: {
      corruptObserved: corruptCount,
      files: (Array.isArray(storage.files) ? storage.files : []).map(fileNameOf).filter(Boolean).slice(0, 20),
      scope: 'خرابی‌هایی که این پروسه هنگام خواندن/نوشتن دیده؛ اسکن هش همهٔ فایل‌ها نیست.',
    },
    securityHeaders: (Array.isArray(headers) ? headers : []).map((item) => ({
      key: String(item?.key ?? ''),
      label: String(item?.label ?? ''),
      value: item?.value == null ? null : String(item.value),
      status: ['active', 'conditional', 'missing'].includes(item?.status) ? item.status : 'unknown',
    })),
    system: system ? {
      cpuLoadPercent: system.cpuLoadPercent != null && Number.isFinite(Number(system.cpuLoadPercent)) ? Number(system.cpuLoadPercent) : null,
      processRssBytes: asCount(system.processRssBytes),
      diskUsedPercent: system.diskUsedPercent != null && Number.isFinite(Number(system.diskUsedPercent)) ? Number(system.diskUsedPercent) : null,
    } : { cpuLoadPercent: null, processRssBytes: null, diskUsedPercent: null },
    alerts,
    policy: {
      serverErrorsInWindow: GUARDIAN_THRESHOLDS.serverErrors,
      authFailuresInWindow: GUARDIAN_THRESHOLDS.authFailures,
      automaticActions: false,
    },
    scope: {
      requestSource: String(sourceMode),
      processLocal: true,
      historicalBaselineDays: 0,
      persistentIncidentLog: false,
      externalMonitor: false,
      ipGeolocation: false,
      perIpAttribution: false,
      automatedBlocking: false,
      sessionRevocation: false,
      rollback: false,
    },
  };
}
