/*
 * وضعیت واقعی کنترل‌های امنیتی پیکربندی‌شده — بدون امتیازدهی کلی.
 * این نما وضعیت شرطی محیط را از «غایب» جدا می‌کند؛ مثلاً HSTS عمداً فقط
 * روی HTTPS در production فرستاده می‌شود.
 */

import { staticSecurityHeaders } from './securityHeaders.js';

export function securityPosture({
  production = process.env.NODE_ENV === 'production',
  https = false,
  insecureCookie = process.env.TAPESH_INSECURE_COOKIE === '1',
} = {}) {
  const headers = staticSecurityHeaders();
  const cspStatus = production ? 'active' : 'conditional';
  const hstsActive = production && https;
  const secureCookieActive = production && !insecureCookie;
  const secureCookieStatus = secureCookieActive ? 'active' : production && insecureCookie ? 'missing' : 'conditional';

  return [
    {
      key: 'csp',
      label: 'Content-Security-Policy',
      value: production ? 'سیاست سخت‌گیرانهٔ production' : 'سیاست توسعه (inline برای Vite مجاز است)',
      status: cspStatus,
    },
    { key: 'x-content-type-options', label: 'X-Content-Type-Options', value: headers['X-Content-Type-Options'], status: 'active' },
    { key: 'x-frame-options', label: 'X-Frame-Options', value: headers['X-Frame-Options'], status: 'active' },
    { key: 'referrer-policy', label: 'Referrer-Policy', value: headers['Referrer-Policy'], status: 'active' },
    { key: 'coop', label: 'Cross-Origin-Opener-Policy', value: headers['Cross-Origin-Opener-Policy'], status: 'active' },
    { key: 'corp', label: 'Cross-Origin-Resource-Policy', value: headers['Cross-Origin-Resource-Policy'], status: 'active' },
    { key: 'permissions-policy', label: 'Permissions-Policy', value: headers['Permissions-Policy'], status: 'active' },
    {
      key: 'hsts',
      label: 'Strict-Transport-Security',
      value: hstsActive ? 'max-age=31536000; includeSubDomains' : null,
      status: hstsActive ? 'active' : 'conditional',
    },
    {
      key: 'cookie-secure',
      label: 'Cookie Secure',
      value: secureCookieActive ? 'Secure' : production && insecureCookie ? 'TAPESH_INSECURE_COOKIE فعال است' : null,
      status: secureCookieStatus,
    },
    { key: 'cookie-httponly', label: 'Cookie HttpOnly', value: 'HttpOnly', status: 'active' },
    { key: 'cookie-samesite', label: 'Cookie SameSite', value: 'Strict', status: 'active' },
    { key: 'csrf', label: 'CSRF', value: 'x-tapesh-csrf روی درخواست‌های تغییردهنده', status: 'active' },
    { key: 'cache-control', label: 'Cache-Control', value: 'no-store روی پاسخ‌های API پنل', status: 'active' },
  ];
}
