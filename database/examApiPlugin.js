/*
 * پلاگین ویت برای API آزمون‌های هماهنگ — دقیقاً الگوی `adminApiPlugin.js`:
 * middleware توسعه/پیش‌نمایش؛ منطق در `examApi.js` تا در پروداکشن (`server.js`)
 * هم بدون تغییر همان کد اجرا شود.
 */

import { handleExamApi } from './examApi.js';

export default function examApiPlugin() {
  const middleware = async (request, response, next) => {
    try {
      const handled = await handleExamApi(request, response);
      if (!handled) next();
    } catch (error) {
      /* هندلر خودش خطاها را مدیریت می‌کند؛ این فقط تور ایمنی است */
      console.error('[tapesh-exam-api]', error);
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      response.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'خطای سرور' } }));
    }
  };

  return {
    name: 'tapesh-exam-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
