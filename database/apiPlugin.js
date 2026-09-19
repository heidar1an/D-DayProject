/*
 * پلاگین ویت برای API کاربران سایت و جریان گوگل.
 *
 * منطق در `usersApi.js` و `googleAuth.js` است تا همین کد در پروداکشن
 * (`server.js`) هم بدون تغییر اجرا شود — قبلاً این مسیرها فقط در توسعه بودند.
 */

import { handleGoogleAuthApi } from './googleAuth.js';
import { handleUsersApi } from './usersApi.js';

export default function usersApiPlugin() {
  const middleware = async (request, response, next) => {
    try {
      const handledUsers = await handleUsersApi(request, response);
      if (handledUsers) return;

      const handledGoogle = await handleGoogleAuthApi(request, response);
      if (handledGoogle) return;

      next();
    } catch (error) {
      console.error('[tapesh-users-api]', error);
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      response.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'خطای سرور' } }));
    }
  };

  return {
    name: 'tapesh-users-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
