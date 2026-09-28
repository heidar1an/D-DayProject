/*
 * پلاگین ویت برای API پنل مدیریت.
 *
 * دقیقاً همان الگوی `database/apiPlugin.js` موجود پروژه است: یک middleware روی
 * سرور توسعه. خود منطق در `adminApi.js` است تا همین کد در پروداکشن (`server.js`)
 * هم بدون تغییر اجرا شود.
 */

import { handleApi } from './adminApi.js';
import { serveUploadRequest } from './uploadsFile.js';

export default function contentApiPlugin() {
  const middleware = async (request, response, next) => {
    try {
      const handled = await handleApi(request, response);
      if (!handled) next();
    } catch (error) {
      /* هندلر خودش خطاها را مدیریت می‌کند؛ این فقط تور ایمنی است */
      console.error('[tapesh-content-api]', error);
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      response.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'خطای سرور' } }));
    }
  };

  /*
   * فایل‌های آپلودی پنل (`/uploads/…`).
   *
   * ویت فهرست فایل‌های `public/` را در زمان راه‌اندازی کش می‌کند، پس فایلی که
   * بعد از بالا آمدن سرور توسعه بارگذاری شود سرو نمی‌شود و درخواستش به HTML
   * اسپا می‌افتد؛ ویدیو در پخش‌کننده سیاه می‌ماند. این middleware در هر درخواست
   * از دیسک می‌خواند (همان ماژولی که `server.js` استفاده می‌کند).
   */
  const uploadsMiddleware = (request, response, next) => {
    const raw = String(request.url ?? '');
    const query = raw.indexOf('?');
    let pathname = query === -1 ? raw : raw.slice(0, query);
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      /* آدرس بدشکل — همان خام را نگه می‌داریم */
    }

    if (serveUploadRequest(request, response, pathname)) return;
    next();
  };

  return {
    name: 'tapesh-content-api',
    configureServer(server) {
      server.middlewares.use(uploadsMiddleware);
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(uploadsMiddleware);
      server.middlewares.use(middleware);
    },
  };
}
