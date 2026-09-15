/*
 * پل دسترسی کلاینت به پاک‌ساز HTML.
 *
 * منطق پاک‌سازی در `database/sanitizeHtml.js` است — همان ماژولی که سرور پیش از
 * ذخیره اجرا می‌کند. این فایل فقط یک مسیر تمیز برای import در لایهٔ UI می‌سازد تا
 * قاعدهٔ پاک‌سازی در کل پروژه تک‌نسخه بماند.
 */

export { buildExcerpt, htmlToText, sanitizeHtml } from '../../../database/sanitizeHtml.js';
