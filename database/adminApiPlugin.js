/*
 * پلاگین ویت برای API پنل مدیریت.
 *
 * دقیقاً همان الگوی `database/apiPlugin.js` موجود پروژه است: یک middleware روی
 * سرور توسعه. خود منطق در `adminApi.js` است تا همین کد در پروداکشن (`server.js`)
 * هم بدون تغییر اجرا شود.
 */

import { handleApi } from './adminApi.js';

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

  return {
    name: 'tapesh-content-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
