/*
 * API پنل مدیریت تپش — یک هندلر مستقل از فریم‌ورک.
 *
 * چرا هندلر مستقل؟ تا همان کد هم در middleware سرور توسعهٔ Vite اجرا شود
 * (`database/adminApiPlugin.js`) و هم در سرور پروداکشن بدون وابستگی جدید
 * (`server.js`). یک منبع حقیقت، دو میزبان.
 *
 * قرارداد پاسخ:
 *   موفق   → { success: true,  data: ... }
 *   ناموفق → { success: false, error: { code, message, fields? } }
 *
 * لایه‌های امنیتی این فایل:
 *   - نشست با کوکی HttpOnly + SameSite=Strict (توکن در JS قابل خواندن نیست).
 *   - CSRF: هر درخواست تغییردهنده باید هدر `x-tapesh-csrf` هم‌ارز توکن نشست بفرستد.
 *   - مجوزدهی بر پایهٔ Permission برای هر Route (نه فقط مخفی‌کردن آدرس).
 *   - محدودیت حجم بدنه + محدودیت تلاش ورود (در contentStore).
 *   - خطاها هرگز stack trace برنمی‌گردانند.
 */

import {
  PERMISSIONS,
  ROLES,
  ARTICLE_STATUSES,
  authenticate,
  changeOwnPassword,
  clearExpiredSessions,
  createAdmin,
  createArticle,
  createBanner,
  createMedia,
  createPage,
  createSession,
  dashboardStats,
  deleteAdmin,
  deleteArticle,
  deleteBanner,
  deleteCategory,
  deleteMedia,
  deletePage,
  destroySession,
  ensureStore,
  getArticle,
  getPage,
  getSession,
  hasPermission,
  listActivity,
  listAdmins,
  listArticles,
  listBanners,
  listCategories,
  listMedia,
  listPages,
  logActivity,
  publicAdmin,
  publicSettings,
  publishedArticles,
  publishedBanners,
  readSettings,
  saveCategory,
  setArticleStatus,
  updateAdmin,
  updateArticle,
  updateBanner,
  updateMedia,
  updatePage,
  writeSettings,
} from './contentStore.js';

export const SESSION_COOKIE = 'tapesh_admin_session';
export const CSRF_HEADER = 'x-tapesh-csrf';

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

const MAX_BODY_BYTES = 12 * 1024 * 1024; /* سقف کلی؛ سقف واقعی فایل از settings خوانده می‌شود */

function fail(code, message, fields) {
  throw Object.assign(new Error(message), { code, fields });
}

/* ───────────────────────────── ابزار HTTP ───────────────────────────── */

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(body);
}

function ok(response, data, status = 200) {
  sendJson(response, status, { success: true, data });
}

function sendError(response, error) {
  const code = error?.code && STATUS_BY_CODE[error.code] ? error.code : 'INTERNAL_ERROR';
  const status = STATUS_BY_CODE[code];

  if (code === 'INTERNAL_ERROR') {
    /* در Production هیچ جزئیاتی به بیرون درز نمی‌کند؛ فقط در کنسول سرور ثبت می‌شود */
    console.error('[tapesh-admin]', error);
  }

  sendJson(response, status, {
    success: false,
    error: {
      code,
      message: code === 'INTERNAL_ERROR' ? 'خطای غیرمنتظره در سرور' : error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  });
}

function readBody(request, limit = MAX_BODY_BYTES) {
  return new Promise((resolvePromise, rejectPromise) => {
    let raw = '';
    let size = 0;

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        request.destroy();
        rejectPromise(Object.assign(new Error('حجم درخواست بیش از حد مجاز است'), { code: 'PAYLOAD_TOO_LARGE' }));
        return;
      }
      raw += chunk;
    });

    request.on('end', () => {
      if (!raw) return resolvePromise({});
      try {
        const parsed = JSON.parse(raw);
        resolvePromise(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        rejectPromise(Object.assign(new Error('بدنهٔ درخواست JSON معتبر نیست'), { code: 'VALIDATION_ERROR' }));
      }
    });

    request.on('error', () => {
      rejectPromise(Object.assign(new Error('خطا در خواندن درخواست'), { code: 'VALIDATION_ERROR' }));
    });
  });
}

function parseCookies(request) {
  const header = request.headers?.cookie ?? '';
  const jar = {};

  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) jar[key] = decodeURIComponent(value);
  });

  return jar;
}

function clientIp(request) {
  const forwarded = request.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return request.socket?.remoteAddress ?? '';
}

function cookieHeader(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' && process.env.TAPESH_INSECURE_COOKIE !== '1';
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

function safeEqual(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

/* ───────────────────────────── مسیرها ───────────────────────────── */

function matchRoute(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[index]);
      continue;
    }
    if (part !== pathParts[index]) return null;
  }

  return params;
}

/* [method, pattern, permission|null, handler] */
const ROUTES = [
  /* احراز هویت */
  ['POST', '/api/admin/auth/login', null, async (ctx) => {
    const username = String(ctx.body.username ?? '').trim();
    const password = String(ctx.body.password ?? '');

    if (!username || !password) fail('VALIDATION_ERROR', 'نام کاربری و رمز عبور الزامی است');

    const result = authenticate({ username, password });

    if (result.error === 'locked') {
      fail('RATE_LIMITED', `تلاش‌های ناموفق زیاد بوده است؛ ${result.retryAfter} ثانیه دیگر تلاش کنید`);
    }
    if (result.error) fail('INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور نادرست است');

    const session = createSession(result.admin.id, {
      userAgent: ctx.request.headers?.['user-agent'] ?? '',
      ip: clientIp(ctx.request),
    });

    ctx.response.setHeader('Set-Cookie', cookieHeader(session.token, 60 * 60 * 12));

    logActivity({
      admin: result.admin,
      action: 'auth.login',
      entityType: 'admin',
      entityId: result.admin.id,
      entityLabel: result.admin.username,
      ip: clientIp(ctx.request),
      userAgent: ctx.request.headers?.['user-agent'] ?? '',
    });

    return { admin: publicAdmin(result.admin), csrfToken: session.csrfToken };
  }],

  ['POST', '/api/admin/auth/logout', null, async (ctx) => {
    const token = parseCookies(ctx.request)[SESSION_COOKIE];
    const active = getSession(token);

    destroySession(token);
    ctx.response.setHeader('Set-Cookie', cookieHeader('', 0));

    if (active) {
      logActivity({
        admin: active.admin,
        action: 'auth.logout',
        entityType: 'admin',
        entityId: active.admin.id,
        entityLabel: active.admin.username,
        ip: clientIp(ctx.request),
      });
    }

    return { loggedOut: true };
  }],

  ['GET', '/api/admin/auth/me', null, async (ctx) => ({
    admin: publicAdmin(ctx.admin),
    csrfToken: ctx.session.csrfToken,
  })],

  ['POST', '/api/admin/auth/password', null, async (ctx) => {
    const result = changeOwnPassword(ctx.admin.id, {
      currentPassword: ctx.body.currentPassword,
      nextPassword: ctx.body.nextPassword,
    });

    if (result.error === 'invalid-credentials') fail('INVALID_CREDENTIALS', 'رمز عبور فعلی نادرست است');
    if (result.error === 'weak-password') fail('VALIDATION_ERROR', 'رمز عبور جدید حداقل ۴ کاراکتر باشد');
    if (result.error) fail('NOT_FOUND', 'حساب پیدا نشد');

    logActivity({
      admin: ctx.admin,
      action: 'auth.password-changed',
      entityType: 'admin',
      entityId: ctx.admin.id,
      entityLabel: ctx.admin.username,
      ip: clientIp(ctx.request),
    });

    return { admin: result.admin };
  }],

  /* داشبورد و متادیتا */
  ['GET', '/api/admin/stats', 'articles.read', async () => dashboardStats()],

  ['GET', '/api/admin/meta', null, async () => ({
    roles: Object.values(ROLES).map(({ id, label, description }) => ({ id, label, description })),
    permissions: PERMISSIONS,
    statuses: ARTICLE_STATUSES,
    categories: listCategories(),
    settings: readSettings(),
  })],

  /* مقالات */
  ['GET', '/api/admin/articles', 'articles.read', async (ctx) => listArticles({
    search: ctx.query.get('search') ?? '',
    status: ctx.query.get('status') ?? 'all',
    category: ctx.query.get('category') ?? 'all',
    sort: ctx.query.get('sort') ?? 'newest',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 10,
  })],

  ['GET', '/api/admin/articles/:id', 'articles.read', async (ctx) => {
    const article = getArticle(ctx.params.id);
    if (!article) fail('NOT_FOUND', 'مقاله پیدا نشد');
    return { article };
  }],

  ['POST', '/api/admin/articles', 'articles.create', async (ctx) => {
    const article = createArticle(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'article.created', entityType: 'article',
      entityId: article.id, entityLabel: article.title,
      metadata: { status: article.status, category: article.category },
      ip: clientIp(ctx.request),
    });
    return { article };
  }],

  ['PUT', '/api/admin/articles/:id', 'articles.update', async (ctx) => {
    const article = updateArticle(ctx.params.id, ctx.body, ctx.admin);
    if (!article) fail('NOT_FOUND', 'مقاله پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'article.updated', entityType: 'article',
      entityId: article.id, entityLabel: article.title,
      metadata: { status: article.status },
      ip: clientIp(ctx.request),
    });
    return { article };
  }],

  ['POST', '/api/admin/articles/:id/status', 'articles.publish', async (ctx) => {
    const status = String(ctx.body.status ?? '');
    if (status === 'published' && !hasPermission(ctx.admin, 'articles.publish')) {
      fail('FORBIDDEN', 'برای انتشار مقاله دسترسی ندارید');
    }

    const article = setArticleStatus(ctx.params.id, status, ctx.admin);
    if (!article) fail('NOT_FOUND', 'مقاله پیدا نشد');

    logActivity({
      admin: ctx.admin,
      action: status === 'published' ? 'article.published' : 'article.unpublished',
      entityType: 'article',
      entityId: article.id,
      entityLabel: article.title,
      metadata: { status },
      ip: clientIp(ctx.request),
    });

    return { article };
  }],

  ['DELETE', '/api/admin/articles/:id', 'articles.delete', async (ctx) => {
    const article = deleteArticle(ctx.params.id);
    if (!article) fail('NOT_FOUND', 'مقاله پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'article.deleted', entityType: 'article',
      entityId: article.id, entityLabel: article.title, ip: clientIp(ctx.request),
    });
    return { deleted: article.id };
  }],

  /* دسته‌بندی‌ها */
  ['GET', '/api/admin/categories', 'articles.read', async () => ({ categories: listCategories() })],

  ['POST', '/api/admin/categories', 'categories.create', async (ctx) => {
    const category = saveCategory(ctx.body);
    logActivity({
      admin: ctx.admin, action: 'category.created', entityType: 'category',
      entityId: category.id, entityLabel: category.label, ip: clientIp(ctx.request),
    });
    return { category };
  }],

  ['PUT', '/api/admin/categories/:id', 'categories.update', async (ctx) => {
    const category = saveCategory(ctx.body, ctx.params.id);
    if (!category) fail('NOT_FOUND', 'دسته‌بندی پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'category.updated', entityType: 'category',
      entityId: category.id, entityLabel: category.label, ip: clientIp(ctx.request),
    });
    return { category };
  }],

  ['DELETE', '/api/admin/categories/:id', 'categories.delete', async (ctx) => {
    const category = deleteCategory(ctx.params.id);
    if (!category) fail('NOT_FOUND', 'دسته‌بندی پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'category.deleted', entityType: 'category',
      entityId: category.id, entityLabel: category.label, ip: clientIp(ctx.request),
    });
    return { deleted: category.id };
  }],

  /* صفحات */
  ['GET', '/api/admin/pages', 'pages.read', async (ctx) => listPages({
    search: ctx.query.get('search') ?? '',
    status: ctx.query.get('status') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 10,
  })],

  ['GET', '/api/admin/pages/:id', 'pages.read', async (ctx) => {
    const page = getPage(ctx.params.id);
    if (!page) fail('NOT_FOUND', 'صفحه پیدا نشد');
    return { page };
  }],

  ['POST', '/api/admin/pages', 'pages.create', async (ctx) => {
    const page = createPage(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'page.created', entityType: 'page',
      entityId: page.id, entityLabel: page.title, ip: clientIp(ctx.request),
    });
    return { page };
  }],

  ['PUT', '/api/admin/pages/:id', 'pages.update', async (ctx) => {
    const page = updatePage(ctx.params.id, ctx.body, ctx.admin);
    if (!page) fail('NOT_FOUND', 'صفحه پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'page.updated', entityType: 'page',
      entityId: page.id, entityLabel: page.title, metadata: { status: page.status },
      ip: clientIp(ctx.request),
    });
    return { page };
  }],

  ['DELETE', '/api/admin/pages/:id', 'pages.delete', async (ctx) => {
    const page = deletePage(ctx.params.id);
    if (!page) fail('NOT_FOUND', 'صفحه پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'page.deleted', entityType: 'page',
      entityId: page.id, entityLabel: page.title, ip: clientIp(ctx.request),
    });
    return { deleted: page.id };
  }],

  /* رسانه */
  ['GET', '/api/admin/media', 'media.read', async (ctx) => listMedia({
    search: ctx.query.get('search') ?? '',
    type: ctx.query.get('type') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 24,
  })],

  ['POST', '/api/admin/media', 'media.upload', async (ctx) => {
    const media = createMedia({
      originalName: ctx.body.originalName,
      mimeType: ctx.body.mimeType,
      base64: ctx.body.data,
      altText: ctx.body.altText,
      admin: ctx.admin,
    });

    logActivity({
      admin: ctx.admin, action: 'media.uploaded', entityType: 'media',
      entityId: media.id, entityLabel: media.originalName,
      metadata: { size: media.size, mimeType: media.mimeType },
      ip: clientIp(ctx.request),
    });

    return { media };
  }],

  ['PUT', '/api/admin/media/:id', 'media.upload', async (ctx) => {
    const media = updateMedia(ctx.params.id, ctx.body);
    if (!media) fail('NOT_FOUND', 'فایل پیدا نشد');
    return { media };
  }],

  ['DELETE', '/api/admin/media/:id', 'media.delete', async (ctx) => {
    const media = deleteMedia(ctx.params.id);
    if (!media) fail('NOT_FOUND', 'فایل پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.deleted', entityType: 'media',
      entityId: media.id, entityLabel: media.originalName, ip: clientIp(ctx.request),
    });
    return { deleted: media.id };
  }],

  /* بنرها */
  ['GET', '/api/admin/banners', 'articles.read', async () => ({ banners: listBanners() })],

  ['POST', '/api/admin/banners', 'banners.create', async (ctx) => {
    const banner = createBanner(ctx.body);
    logActivity({
      admin: ctx.admin, action: 'banner.created', entityType: 'banner',
      entityId: banner.id, entityLabel: banner.title, ip: clientIp(ctx.request),
    });
    return { banner };
  }],

  ['PUT', '/api/admin/banners/:id', 'banners.update', async (ctx) => {
    const banner = updateBanner(ctx.params.id, ctx.body);
    if (!banner) fail('NOT_FOUND', 'بنر پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'banner.updated', entityType: 'banner',
      entityId: banner.id, entityLabel: banner.title, ip: clientIp(ctx.request),
    });
    return { banner };
  }],

  ['DELETE', '/api/admin/banners/:id', 'banners.delete', async (ctx) => {
    const banner = deleteBanner(ctx.params.id);
    if (!banner) fail('NOT_FOUND', 'بنر پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'banner.deleted', entityType: 'banner',
      entityId: banner.id, entityLabel: banner.title, ip: clientIp(ctx.request),
    });
    return { deleted: banner.id };
  }],

  /* مدیران */
  ['GET', '/api/admin/users', 'users.read', async (ctx) => listAdmins({
    search: ctx.query.get('search') ?? '',
    role: ctx.query.get('role') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 10,
  })],

  ['POST', '/api/admin/users', 'users.create', async (ctx) => {
    const admin = createAdmin(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'admin.created', entityType: 'admin',
      entityId: admin.id, entityLabel: admin.username, metadata: { role: admin.role },
      ip: clientIp(ctx.request),
    });
    return { admin };
  }],

  ['PUT', '/api/admin/users/:id', 'users.update', async (ctx) => {
    const admin = updateAdmin(ctx.params.id, ctx.body, ctx.admin);
    if (!admin) fail('NOT_FOUND', 'کاربر پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'admin.updated', entityType: 'admin',
      entityId: admin.id, entityLabel: admin.username, metadata: { role: admin.role },
      ip: clientIp(ctx.request),
    });
    return { admin };
  }],

  ['DELETE', '/api/admin/users/:id', 'users.delete', async (ctx) => {
    const admin = deleteAdmin(ctx.params.id, ctx.admin.id);
    if (!admin) fail('NOT_FOUND', 'کاربر پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'admin.deleted', entityType: 'admin',
      entityId: admin.id, entityLabel: admin.username, ip: clientIp(ctx.request),
    });
    return { deleted: admin.id };
  }],

  /* تنظیمات */
  ['GET', '/api/admin/settings', 'settings.read', async () => ({ settings: readSettings() })],

  ['PUT', '/api/admin/settings', 'settings.update', async (ctx) => {
    const before = readSettings();
    const settings = writeSettings(ctx.body);

    const changedKeys = Object.keys(ctx.body ?? {}).filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(settings[key]),
    );

    logActivity({
      admin: ctx.admin, action: 'settings.updated', entityType: 'settings',
      entityId: 'settings', entityLabel: 'تنظیمات سایت',
      metadata: { changed: changedKeys },
      ip: clientIp(ctx.request),
    });

    return { settings };
  }],

  /* گزارش رویدادها */
  ['GET', '/api/admin/logs', 'logs.read', async (ctx) => listActivity({
    search: ctx.query.get('search') ?? '',
    action: ctx.query.get('action') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 15,
  })],
];

/* [pattern, handler] — مسیرهای عمومی سایت، بدون احراز هویت */
const PUBLIC_ROUTES = [
  ['/api/public/articles', async () => ({ articles: publishedArticles({ limit: 100 }) })],
  ['/api/public/banners', async () => ({ banners: publishedBanners() })],
  ['/api/public/settings', async () => ({ settings: publicSettings() })],
  ['/api/public/pages/:slug', async (ctx) => {
    const page = getPage(ctx.params.slug);
    if (!page) fail('NOT_FOUND', 'صفحه پیدا نشد');
    return { page };
  }],
];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/* مسیرهایی که پیش از احراز هویت لازم است باز باشند (فقط ورود) */
const PUBLIC_ADMIN_PATHS = new Set(['/api/admin/auth/login']);

/*
 * خروجی: true اگر درخواست مدیریت شد، false اگر به لایهٔ بعدی (مثلاً فایل استاتیک) واگذار شود.
 */
export async function handleApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isPublicApi = pathname === '/api/public' || pathname.startsWith('/api/public/');
  if (!isAdminApi && !isPublicApi) return false;

  response.setHeader('Referrer-Policy', 'same-origin');

  try {
    ensureStore();

    /* ── مسیرهای عمومی ── */
    if (isPublicApi) {
      for (const [pattern, handler] of PUBLIC_ROUTES) {
        const params = matchRoute(pathname, pattern);
        if (!params) continue;
        if (request.method !== 'GET') fail('NOT_FOUND', 'مسیر پیدا نشد');

        const data = await handler({ params, query: url.searchParams, body: {}, request, response });
        ok(response, data);
        return true;
      }
      fail('NOT_FOUND', 'مسیر پیدا نشد');
    }

    /* ── مسیرهای پنل ── */
    const route = ROUTES.find(([method, pattern]) => method === request.method && matchRoute(pathname, pattern));

    if (!route) {
      /* اگر مسیر وجود دارد ولی متد اشتباه است، ۴۰۵ بده نه ۴۰۴ */
      const exists = ROUTES.some(([, pattern]) => matchRoute(pathname, pattern));
      fail(exists ? 'VALIDATION_ERROR' : 'NOT_FOUND', exists ? 'متد درخواست پشتیبانی نمی‌شود' : 'مسیر پیدا نشد');
    }

    const [, pattern, permission, handler] = route;
    const params = matchRoute(pathname, pattern);
    const token = parseCookies(request)[SESSION_COOKIE];
    const active = getSession(token);

    /* مسیر ورود نباید نشست داشته باشد؛ بقیهٔ مسیرها بدون نشست معتبر پاسخ نمی‌گیرند */
    if (!PUBLIC_ADMIN_PATHS.has(pathname) && !active) {
      fail('UNAUTHENTICATED', 'برای دسترسی به پنل باید وارد شوید');
    }

    if (MUTATING.has(request.method)) {
      const header = request.headers?.[CSRF_HEADER];
      if (!PUBLIC_ADMIN_PATHS.has(pathname) && !safeEqual(header, active.session.csrfToken)) {
        fail('FORBIDDEN', 'درخواست از منبع نامعتبر رد شد');
      }
    }

    if (permission && !hasPermission(active.admin, permission)) {
      fail('FORBIDDEN', 'برای این عملیات دسترسی ندارید');
    }

    const body = MUTATING.has(request.method) ? await readBody(request) : {};

    const data = await handler({
      params,
      query: url.searchParams,
      body,
      admin: active?.admin ?? null,
      session: active?.session ?? null,
      request,
      response,
    });

    ok(response, data);
    return true;
  } catch (error) {
    sendError(response, error);
    return true;
  } finally {
    clearExpiredSessions();
  }
}

export default handleApi;
