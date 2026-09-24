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
  createFlashcardDeck,
  createMedia,
  createMicroCourse,
  createNote,
  createPage,
  createSession,
  dashboardStats,
  deleteAdmin,
  deleteArticle,
  deleteBanner,
  deleteCategory,
  deleteFlashcardDeck,
  deleteMedia,
  deleteMicroCourse,
  deleteNote,
  deletePage,
  destroySession,
  ensureStore,
  getArticle,
  getFlashcardDeck,
  getMicroCourse,
  getNote,
  getPage,
  getSession,
  hasPermission,
  listActivity,
  listAdmins,
  listArticles,
  listBanners,
  listCategories,
  listFlashcardDecks,
  listMedia,
  listMicroCourses,
  listNotes,
  listPages,
  logActivity,
  microSubjectCatalog,
  publicAdmin,
  publicSettings,
  publishedArticles,
  publishedBanners,
  publishedFlashcardDecks,
  publishedMicroCourses,
  readSettings,
  saveCategory,
  searchTestBankQuestions,
  setArticleStatus,
  setMicroCourseStatus,
  setNotePinned,
  toggleNoteItem,
  updateAdmin,
  updateArticle,
  updateBanner,
  updateFlashcardDeck,
  updateMedia,
  updateMicroCourse,
  updateNote,
  updatePage,
  writeSettings,
} from './contentStore.js';

import {
  allowCollect,
  clearEvents,
  dataSources,
  deleteAlert,
  listAlerts,
  recordApiRequest,
  recordEvents,
  recordFailedLogin,
  requestMetrics,
  saveAlert,
  systemMetrics,
} from './analyticsStore.js';

import {
  buildContext,
  contentSection,
  educationSection,
  overviewSection,
  performanceSection,
  productsSection,
  revenueSection,
  securitySection,
  seoSection,
  trafficSection,
  usersSection,
} from './analyticsEngine.js';

import {
  aiSection,
  alertsSection,
  errorsSection,
  marketingSection,
  realtimeSection,
  systemSection,
} from './analyticsInsights.js';

import {
  createChannel,
  deleteChannel,
  listChannels,
  listLog,
  previewPublish,
  publish,
  publishingConfig,
  publishingStats,
  publishTargets,
  setChannelToken,
  testChannel,
  testCredentials,
  updateChannel,
} from './publishingStore.js';

import {
  accountSeries,
  approveContent,
  archiveAsset,
  assignInboxItem,
  buildReport,
  buildUtmUrl,
  clearDemoData,
  contentAnalytics,
  contentCalendar,
  createAccount,
  createContent,
  deleteAccount,
  deleteAsset,
  deleteCampaign,
  deleteContent,
  deleteInboxItem,
  deleteMention,
  deleteMetrics,
  deletePlatform,
  deleteTag,
  deleteTeamMember,
  deleteUtm,
  ensureMediaStore,
  getAccount,
  getCampaign,
  getContent,
  importPublishChannels,
  listAccounts,
  listAssets,
  listCampaigns,
  listContents,
  listInbox,
  listMediaAudit,
  listMentions,
  listMetrics,
  listNotifications,
  listPlatforms,
  listTags,
  listTeam,
  listUtm,
  listeningSummary,
  markAllNotificationsRead,
  mediaAnalytics,
  mediaConfig,
  mediaOverview,
  mediaSearch,
  mediaSummary,
  previewContent,
  publishContent,
  publishQueue,
  refreshNotifications,
  replyInboxItem,
  requestContentRevision,
  retryContent,
  runSchedule,
  saveCampaign,
  saveInboxItem,
  saveMention,
  saveMetrics,
  savePlatform,
  saveTag,
  saveTeamMember,
  saveUtm,
  scheduleContent,
  setAccountCredentials,
  setContentStatus,
  setInboxStatus,
  setNotificationState,
  submitContentForReview,
  syncAccount,
  syncAllAccounts,
  testAccountConnection,
  testAccountDraft,
  updateAccount,
  updateAsset,
  updateContent,
} from './mediaStore.js';

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
  /* انتشار در کانال‌ها — خطای سرویس بیرونی، نه خطای درخواست کاربر */
  PUBLISH_NO_TOKEN: 409,
  PUBLISH_UNAUTHORIZED: 502,
  /* ۴۰۳ یعنی «دسترسی ندارد» (ربات ادمین نیست) — نه توکن باطل */
  PUBLISH_FORBIDDEN: 502,
  PUBLISH_UNREACHABLE: 502,
  PUBLISH_TIMEOUT: 504,
  PUBLISH_FAILED: 502,
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

/* ───────────────────────────── مرکز تحلیل ───────────────────────────── */

/*
 * هر بخش تحلیل یک Permission مستقل دارد تا دادهٔ حساس (کاربران، مالی، امنیتی)
 * به نقش‌های غیرمجاز داده نشود. جدول‌محور تعریف شده تا افزودن بخش تازه یک خط باشد.
 */
const ANALYTICS_ROUTES = [
  ['overview', 'analytics.read', overviewSection],
  ['traffic', 'analytics.read', trafficSection],
  ['users', 'analytics.users.read', usersSection],
  ['education', 'analytics.read', educationSection],
  ['seo', 'analytics.seo.read', seoSection],
  ['performance', 'analytics.read', performanceSection],
  ['security', 'analytics.security.read', securitySection],
  ['revenue', 'analytics.revenue.read', revenueSection],
  ['products', 'analytics.read', productsSection],
  ['content', 'analytics.read', contentSection],
  ['marketing', 'analytics.read', marketingSection],
  ['system', 'analytics.read', systemSection],
  ['errors', 'analytics.read', errorsSection],
  ['realtime', 'analytics.read', realtimeSection],
  ['alerts', 'analytics.read', alertsSection],
  ['ai', 'analytics.read', aiSection],
];

const ANALYTICS_SECTION_MAP = Object.fromEntries(ANALYTICS_ROUTES.map(([name, , handler]) => [name, handler]));

/* یک context برای هر درخواست — خواندن فایل‌ها تکرار نمی‌شود */
function analyticsContext(ctx) {
  return buildContext({
    range: ctx.query.get('range') ?? '30d',
    from: ctx.query.get('from') ?? null,
    to: ctx.query.get('to') ?? null,
  });
}

/* آیا درخواست روی HTTPS رسیده است؟ برای گزارش واقعی وضعیت امنیتی */
function isSecureRequest(request) {
  const proto = request.headers?.['x-forwarded-proto'];
  if (typeof proto === 'string' && proto) return proto.split(',')[0].trim() === 'https';
  return Boolean(request.socket?.encrypted);
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
      recordFailedLogin({
        username,
        ip: clientIp(ctx.request),
        userAgent: ctx.request.headers?.['user-agent'] ?? '',
        reason: 'locked',
      });
      fail('RATE_LIMITED', `تلاش‌های ناموفق زیاد بوده است؛ ${result.retryAfter} ثانیه دیگر تلاش کنید`);
    }
    if (result.error) {
      /* ورود ناموفق واقعی ثبت می‌شود تا مرکز امنیت دادهٔ واقعی داشته باشد */
      recordFailedLogin({
        username,
        ip: clientIp(ctx.request),
        userAgent: ctx.request.headers?.['user-agent'] ?? '',
        reason: 'invalid-credentials',
      });
      fail('INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور نادرست است');
    }

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

  /* کتابخانهٔ فلش‌کارت تپش */
  ['GET', '/api/admin/flashcards', 'flashcards.read', async (ctx) => listFlashcardDecks({
    search: ctx.query.get('search') ?? '',
    status: ctx.query.get('status') ?? 'all',
    kind: ctx.query.get('kind') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 10,
  })],

  ['GET', '/api/admin/flashcards/:id', 'flashcards.read', async (ctx) => {
    const deck = getFlashcardDeck(ctx.params.id);
    if (!deck) fail('NOT_FOUND', 'مجموعه پیدا نشد');
    return { deck };
  }],

  ['POST', '/api/admin/flashcards', 'flashcards.create', async (ctx) => {
    const deck = createFlashcardDeck(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'flashcard-deck.created', entityType: 'flashcard-deck',
      entityId: deck.id, entityLabel: deck.title, ip: clientIp(ctx.request),
    });
    return { deck };
  }],

  ['PUT', '/api/admin/flashcards/:id', 'flashcards.update', async (ctx) => {
    const deck = updateFlashcardDeck(ctx.params.id, ctx.body, ctx.admin);
    if (!deck) fail('NOT_FOUND', 'مجموعه پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'flashcard-deck.updated', entityType: 'flashcard-deck',
      entityId: deck.id, entityLabel: deck.title, metadata: { status: deck.status, cards: deck.cards.length },
      ip: clientIp(ctx.request),
    });
    return { deck };
  }],

  ['DELETE', '/api/admin/flashcards/:id', 'flashcards.delete', async (ctx) => {
    const deck = deleteFlashcardDeck(ctx.params.id);
    if (!deck) fail('NOT_FOUND', 'مجموعه پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'flashcard-deck.deleted', entityType: 'flashcard-deck',
      entityId: deck.id, entityLabel: deck.title, ip: clientIp(ctx.request),
    });
    return { deleted: deck.id };
  }],

  /* ── میکرو درسنامه ──
   *
   * ساختار کامل درسنامه (مبحث → واحد → صفحه → بلوک‌ها → ایستگاه تست) در یک
   * رکورد ذخیره می‌شود، پس ویرایش هم یک PUT کامل است؛ مثل مجموعهٔ فلش‌کارت.
   * مجوزها جدا هستند: `micro.read` برای دیدن، `micro.update` برای ویرایش ساختار،
   * `micro.publish` برای انتشار در دسترس همهٔ کاربران تپش.
   */

  ['GET', '/api/admin/micro', 'micro.read', async (ctx) => listMicroCourses({
    search: ctx.query.get('search') ?? '',
    status: ctx.query.get('status') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 20,
  })],

  /* فهرست درس‌های رجیستری برای فرم «درسنامهٔ تازه» — مثل `test-bank` باید پیش از
     مسیر `/:id` بیاید وگرنه «subjects» به‌عنوان شناسهٔ درسنامه تفسیر می‌شود. */
  ['GET', '/api/admin/micro/subjects', 'micro.read', async () => ({
    subjects: microSubjectCatalog(),
  })],

  /* انتخاب از بانک تست — باید **پیش از** مسیر `/:id` بیاید وگرنه «test-bank»
     به‌عنوان شناسهٔ درسنامه تفسیر می‌شود. */
  ['GET', '/api/admin/micro/test-bank', 'micro.read', async (ctx) => searchTestBankQuestions({
    search: ctx.query.get('search') ?? '',
    subjectId: ctx.query.get('subjectId') ?? '',
    topicPath: ctx.query.get('topicPath') ?? '',
    difficulty: ctx.query.get('difficulty') ?? 'all',
    limit: ctx.query.get('limit') ?? 40,
  })],

  ['GET', '/api/admin/micro/:id', 'micro.read', async (ctx) => {
    const course = getMicroCourse(ctx.params.id);
    if (!course) fail('NOT_FOUND', 'درسنامه پیدا نشد');
    return { course };
  }],

  ['POST', '/api/admin/micro', 'micro.create', async (ctx) => {
    const course = createMicroCourse(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'micro-course.created', entityType: 'micro-course',
      entityId: course.id, entityLabel: course.title, ip: clientIp(ctx.request),
    });
    return { course };
  }],

  ['PUT', '/api/admin/micro/:id', 'micro.update', async (ctx) => {
    const course = updateMicroCourse(ctx.params.id, ctx.body, ctx.admin);
    if (!course) fail('NOT_FOUND', 'درسنامه پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'micro-course.updated', entityType: 'micro-course',
      entityId: course.id, entityLabel: course.title,
      metadata: { status: course.status, topics: course.topics.length },
      ip: clientIp(ctx.request),
    });
    return { course };
  }],

  /* انتشار / لغو انتشار — تنها راهی که محتوای میکرو به کاربران تپش می‌رسد */
  ['POST', '/api/admin/micro/:id/status', 'micro.publish', async (ctx) => {
    const course = setMicroCourseStatus(ctx.params.id, ctx.body?.status, ctx.admin);
    if (!course) fail('NOT_FOUND', 'درسنامه پیدا نشد');

    const published = course.status === 'published';
    logActivity({
      admin: ctx.admin,
      action: published ? 'micro-course.published' : 'micro-course.unpublished',
      entityType: 'micro-course', entityId: course.id, entityLabel: course.title,
      metadata: { status: course.status, topics: course.topics.length },
      ip: clientIp(ctx.request),
    });
    return { course };
  }],

  ['DELETE', '/api/admin/micro/:id', 'micro.delete', async (ctx) => {
    const course = deleteMicroCourse(ctx.params.id);
    if (!course) fail('NOT_FOUND', 'درسنامه پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'micro-course.deleted', entityType: 'micro-course',
      entityId: course.id, entityLabel: course.title, ip: clientIp(ctx.request),
    });
    return { deleted: course.id };
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

  /* یادداشت‌های پنل — دفترچهٔ شخصی هر مدیر (فقط یادداشت‌های خودش) */
  ['GET', '/api/admin/notes', 'notes.read', async (ctx) => listNotes({
    adminId: ctx.admin.id,
    search: ctx.query.get('search') ?? '',
    kind: ctx.query.get('kind') ?? 'all',
    sort: ctx.query.get('sort') ?? 'updated',
  })],

  ['GET', '/api/admin/notes/:id', 'notes.read', async (ctx) => {
    const note = getNote(ctx.params.id, ctx.admin.id);
    if (!note) fail('NOT_FOUND', 'یادداشت پیدا نشد');
    return { note };
  }],

  ['POST', '/api/admin/notes', 'notes.create', async (ctx) => {
    const note = createNote(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'note.created', entityType: 'note',
      entityId: note.id, entityLabel: note.title || 'یادداشت بی‌عنوان',
      metadata: { kind: note.kind },
      ip: clientIp(ctx.request),
    });
    return { note };
  }],

  ['PUT', '/api/admin/notes/:id', 'notes.update', async (ctx) => {
    const note = updateNote(ctx.params.id, ctx.body, ctx.admin);
    if (!note) fail('NOT_FOUND', 'یادداشت پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'note.updated', entityType: 'note',
      entityId: note.id, entityLabel: note.title || 'یادداشت بی‌عنوان',
      metadata: { kind: note.kind },
      ip: clientIp(ctx.request),
    });
    return { note };
  }],

  ['POST', '/api/admin/notes/:id/pin', 'notes.update', async (ctx) => {
    const note = setNotePinned(ctx.params.id, ctx.body.pinned, ctx.admin);
    if (!note) fail('NOT_FOUND', 'یادداشت پیدا نشد');
    return { note };
  }],

  ['POST', '/api/admin/notes/:id/items/:itemId/toggle', 'notes.update', async (ctx) => {
    const note = toggleNoteItem(ctx.params.id, ctx.params.itemId, ctx.admin);
    if (!note) fail('NOT_FOUND', 'آیتم چک‌لیست پیدا نشد');
    return { note };
  }],

  ['DELETE', '/api/admin/notes/:id', 'notes.delete', async (ctx) => {
    const note = deleteNote(ctx.params.id, ctx.admin);
    if (!note) fail('NOT_FOUND', 'یادداشت پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'note.deleted', entityType: 'note',
      entityId: note.id, entityLabel: note.title || 'یادداشت بی‌عنوان',
      ip: clientIp(ctx.request),
    });
    return { deleted: note.id };
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

  /* ─────────────────── انتشار در کانال‌های پیام‌رسان ───────────────────
   *
   * سه مجوز جدا:
   *   publishing.read             → دیدن کانال‌ها، تاریخچه و پیش‌نمایش
   *   publishing.send             → ارسال واقعی و تست اتصال
   *   publishing.channels.manage  → ساخت/ویرایش/حذف کانال و ثبت توکن
   *
   * توکن ربات هرگز در پاسخ هیچ‌یک از این مسیرها برنمی‌گردد؛ فقط `hasToken`
   * و یک راهنمای ماسک‌شده. ثبت توکن هم در گزارش رویدادها ثبت **نمی‌شود**
   * (نه مقدارش، نه طولش).
   */

  ['GET', '/api/admin/publishing/overview', 'publishing.read', async () => ({
    ...publishingConfig(),
    stats: publishingStats(),
  })],

  ['GET', '/api/admin/publishing/channels', 'publishing.read', async () => ({
    ...listChannels(),
    stats: publishingStats(),
    config: publishingConfig(),
  })],

  ['POST', '/api/admin/publishing/channels', 'publishing.channels.manage', async (ctx) => {
    const channel = createChannel(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'channel.created', entityType: 'channel',
      entityId: channel.id, entityLabel: channel.name,
      metadata: { platform: channel.platform, chatId: channel.chatId },
      ip: clientIp(ctx.request),
    });
    return { channel: listChannels().channels.find((row) => row.id === channel.id) };
  }],

  ['PUT', '/api/admin/publishing/channels/:id', 'publishing.channels.manage', async (ctx) => {
    const channel = updateChannel(ctx.params.id, ctx.body, ctx.admin);
    if (!channel) fail('NOT_FOUND', 'کانال پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'channel.updated', entityType: 'channel',
      entityId: channel.id, entityLabel: channel.name,
      metadata: { platform: channel.platform, isActive: channel.isActive !== false },
      ip: clientIp(ctx.request),
    });

    return { channel: listChannels().channels.find((row) => row.id === channel.id) };
  }],

  ['DELETE', '/api/admin/publishing/channels/:id', 'publishing.channels.manage', async (ctx) => {
    const channel = deleteChannel(ctx.params.id);
    if (!channel) fail('NOT_FOUND', 'کانال پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'channel.deleted', entityType: 'channel',
      entityId: channel.id, entityLabel: channel.name, ip: clientIp(ctx.request),
    });

    return { deleted: channel.id };
  }],

  ['POST', '/api/admin/publishing/channels/:id/token', 'publishing.channels.manage', async (ctx) => {
    const result = setChannelToken(ctx.params.id, ctx.body.token);
    if (!result) fail('NOT_FOUND', 'کانال پیدا نشد');

    logActivity({
      admin: ctx.admin,
      action: result.hasToken ? 'channel.token-set' : 'channel.token-cleared',
      entityType: 'channel',
      entityId: ctx.params.id,
      entityLabel: '',
      /* فقط اینکه توکن ثبت/پاک شد — نه مقدار، نه طول، نه بخشی از آن */
      metadata: { hasToken: result.hasToken },
      ip: clientIp(ctx.request),
    });

    return result;
  }],

  ['POST', '/api/admin/publishing/channels/:id/test', 'publishing.send', async (ctx) => {
    const result = await testChannel(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'کانال پیدا نشد');

    if (result.ok) {
      logActivity({
        admin: ctx.admin, action: 'channel.tested', entityType: 'channel',
        entityId: ctx.params.id, entityLabel: result.bot?.name ?? '',
        metadata: { ok: true, complete: Boolean(result.complete) }, ip: clientIp(ctx.request),
      });
    }

    return result;
  }],

  /*
   * تست اعتبار **پیش از ذخیره کانال**. اینجا توکن از بدنهٔ درخواست می‌آید (چون
   * هنوز کانالی وجود ندارد)، پس مجوزش `channels.manage` است نه `send` — کسی که
   * اجازهٔ دیدن توکن را ندارد، نباید بتواند توکن دلخواه را هم تست کند.
   *
   * توکن نه در پاسخ برمی‌گردد، نه در گزارش رویدادها ثبت می‌شود.
   */
  ['POST', '/api/admin/publishing/test', 'publishing.channels.manage', async (ctx) => {
    const result = await testCredentials({
      platform: ctx.body.platform ?? 'bale',
      token: ctx.body.token,
      chatId: ctx.body.chatId,
    });

    logActivity({
      admin: ctx.admin, action: 'channel.credentials-tested', entityType: 'channel',
      entityId: null, entityLabel: String(ctx.body.chatId ?? '').slice(0, 120),
      metadata: { ok: result.ok, complete: Boolean(result.complete) },
      ip: clientIp(ctx.request),
    });

    return result;
  }],

  /* پیش‌نمایش — بدون هیچ درخواست شبکه‌ای؛ همان چیزی که ارسال می‌شود */
  ['POST', '/api/admin/publishing/preview', 'publishing.read', async (ctx) => previewPublish(ctx.body)],

  ['GET', '/api/admin/publishing/targets', 'publishing.read', async () => publishTargets()],

  ['POST', '/api/admin/publishing/send', 'publishing.send', async (ctx) => {
    const result = await publish({
      channelIds: ctx.body.channelIds,
      content: ctx.body.content,
      admin: ctx.admin,
      forceDryRun: ctx.body.dryRun === true,
    });

    logActivity({
      admin: ctx.admin, action: 'publish.sent', entityType: 'publish',
      entityId: result.results.map((row) => row.channelId).join(','),
      entityLabel: result.results.map((row) => row.channelName).join('، ').slice(0, 200),
      metadata: { sent: result.sent, failed: result.failed, dryRun: result.dryRun },
      ip: clientIp(ctx.request),
    });

    return result;
  }],

  ['GET', '/api/admin/publishing/log', 'publishing.read', async (ctx) => listLog({
    channelId: ctx.query.get('channelId') ?? 'all',
    status: ctx.query.get('status') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 15,
  })],

  /* ══════════════════ مرکز رسانه و فضای مجازی ══════════════════
   *
   * هشت مجوز، هرکدام برای یک کار:
   *   media.read               → دیدن همهٔ نماها و تحلیل‌ها
   *   media.content.manage     → ساخت/ویرایش/حذف محتوا، کمپین، هشتگ، فایل
   *   media.content.review     → تأیید یا درخواست اصلاح
   *   media.content.publish    → زمان‌بندی، انتشار و تلاش دوباره
   *   media.platforms.manage   → پلتفرم، اکانت و کلید API
   *   media.team.manage        → اعضای تیم رسانه
   *   media.ops.manage         → اینباکس، رصد نام، UTM و اعلان‌ها
   *   media.audit.read         → گزارش رویدادهای مرکز
   *
   * ترتیب مهم است: مسیرهای ثابت (`/accounts/test`، `/contents/preview`) باید
   * **قبل** از مسیرهای پارامتری (`/accounts/:id`) بیایند، وگرنه `matchRoute`
   * اولی را می‌گیرد و پارامتر «test» می‌شود.
   *
   * توکن و کلید اپ هرگز در پاسخ هیچ‌یک از این مسیرها برنمی‌گردد؛ فقط
   * `hasToken`/`hasAppKeys` و راهنمای ماسک‌شده.
   */

  ['GET', '/api/admin/media/config', 'media.read', async () => mediaConfig()],
  ['GET', '/api/admin/media/summary', 'media.read', async () => mediaSummary()],

  ['GET', '/api/admin/media/overview', 'media.read', async (ctx) => mediaOverview({
    range: ctx.query.get('range') ?? '30d',
    from: ctx.query.get('from'),
    to: ctx.query.get('to'),
  })],

  ['GET', '/api/admin/media/analytics', 'media.read', async (ctx) => mediaAnalytics({
    range: ctx.query.get('range') ?? '30d',
    from: ctx.query.get('from'),
    to: ctx.query.get('to'),
    compare: (ctx.query.get('compare') ?? '').split(',').filter(Boolean),
  })],

  ['GET', '/api/admin/media/search', 'media.read', async (ctx) => mediaSearch(ctx.query.get('term') ?? '')],

  ['GET', '/api/admin/media/report', 'media.read', async (ctx) => buildReport({
    kind: ctx.query.get('kind') ?? 'platform',
    range: ctx.query.get('range') ?? '30d',
    from: ctx.query.get('from'),
    to: ctx.query.get('to'),
    campaignId: ctx.query.get('campaignId'),
    platform: ctx.query.get('platform'),
    teamId: ctx.query.get('teamId'),
  })],

  /* ── پلتفرم‌ها ── */

  ['GET', '/api/admin/media/platforms', 'media.read', async () => ({ platforms: listPlatforms() })],

  ['POST', '/api/admin/media/platforms', 'media.platforms.manage', async (ctx) => {
    const platform = savePlatform(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.platform.saved', entityType: 'media-platform',
      entityId: platform.id, entityLabel: platform.label,
      metadata: { isActive: platform.isActive, adapter: platform.adapter },
      ip: clientIp(ctx.request),
    });
    return { platform };
  }],

  ['DELETE', '/api/admin/media/platforms/:id', 'media.platforms.manage', async (ctx) => {
    const platform = deletePlatform(ctx.params.id, ctx.admin);
    if (!platform) fail('NOT_FOUND', 'پلتفرم ثبت نشده است');
    logActivity({
      admin: ctx.admin, action: 'media.platform.removed', entityType: 'media-platform',
      entityId: platform.id, entityLabel: platform.label, ip: clientIp(ctx.request),
    });
    return { deleted: platform.id };
  }],

  /* ── اکانت‌ها و کانال‌ها ── */

  ['GET', '/api/admin/media/accounts', 'media.read', async (ctx) => ({
    accounts: listAccounts({
      platform: ctx.query.get('platform') ?? 'all',
      kind: ctx.query.get('kind') ?? 'all',
      active: ctx.query.get('active') ?? 'all',
      search: ctx.query.get('search') ?? '',
    }),
  })],

  ['POST', '/api/admin/media/accounts', 'media.platforms.manage', async (ctx) => {
    const account = createAccount(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.account.created', entityType: 'media-account',
      entityId: account.id, entityLabel: account.name,
      metadata: { platform: account.platform, kind: account.kind },
      ip: clientIp(ctx.request),
    });
    return { account };
  }],

  /*
   * وارد کردن کانال‌های انتشار موجود به‌عنوان اکانت رسانه — همان ادغام بخشی که
   * از قبل طراحی شده. توکن دوباره ثبت نمی‌شود؛ به همان کانال وصل می‌ماند.
   */
  ['POST', '/api/admin/media/accounts/import', 'media.platforms.manage', async (ctx) => {
    const result = importPublishChannels(ctx.admin);
    if (result.created) {
      logActivity({
        admin: ctx.admin, action: 'media.account.imported', entityType: 'media-account',
        entityId: null, entityLabel: `${result.created} کانال انتشار`,
        metadata: { created: result.created }, ip: clientIp(ctx.request),
      });
    }
    return result;
  }],

  /* تست اعتبار پیش از ذخیره — توکن از بدنهٔ فرم می‌آید، پس مجوزش manage است */
  ['POST', '/api/admin/media/accounts/test', 'media.platforms.manage', async (ctx) => {
    const result = await testAccountDraft({
      platform: ctx.body.platform,
      token: ctx.body.token,
      externalId: ctx.body.externalId,
      appId: ctx.body.appId,
    });

    logActivity({
      admin: ctx.admin, action: 'media.account.credentials-tested', entityType: 'media-account',
      entityId: null, entityLabel: String(ctx.body.platform ?? '').slice(0, 40),
      metadata: { ok: result.ok, complete: Boolean(result.complete) }, ip: clientIp(ctx.request),
    });

    return result;
  }],

  ['POST', '/api/admin/media/accounts/sync', 'media.platforms.manage', async (ctx) => {
    const result = await syncAllAccounts({ platform: ctx.query.get('platform') ?? 'all', admin: ctx.admin });
    logActivity({
      admin: ctx.admin, action: 'media.accounts.synced', entityType: 'media-account',
      entityId: null, entityLabel: 'همگام‌سازی همهٔ اکانت‌ها',
      metadata: { synced: result.synced, manual: result.manual, noToken: result.noToken },
      ip: clientIp(ctx.request),
    });
    return result;
  }],

  ['GET', '/api/admin/media/accounts/:id', 'media.read', async (ctx) => {
    const account = listAccounts().find((row) => row.id === ctx.params.id);
    if (!account) fail('NOT_FOUND', 'اکانت پیدا نشد');
    return { account };
  }],

  ['GET', '/api/admin/media/accounts/:id/series', 'media.read', async (ctx) => {
    const data = accountSeries(ctx.params.id, {
      range: ctx.query.get('range') ?? '30d',
      from: ctx.query.get('from'),
      to: ctx.query.get('to'),
    });
    if (!data) fail('NOT_FOUND', 'اکانت پیدا نشد');
    return data;
  }],

  ['PUT', '/api/admin/media/accounts/:id', 'media.platforms.manage', async (ctx) => {
    const account = updateAccount(ctx.params.id, ctx.body, ctx.admin);
    if (!account) fail('NOT_FOUND', 'اکانت پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.account.updated', entityType: 'media-account',
      entityId: account.id, entityLabel: account.name,
      metadata: { platform: account.platform, isActive: account.isActive },
      ip: clientIp(ctx.request),
    });
    return { account };
  }],

  ['DELETE', '/api/admin/media/accounts/:id', 'media.platforms.manage', async (ctx) => {
    const account = deleteAccount(ctx.params.id);
    if (!account) fail('NOT_FOUND', 'اکانت پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.account.deleted', entityType: 'media-account',
      entityId: account.id, entityLabel: account.name, ip: clientIp(ctx.request),
    });
    return { deleted: account.id };
  }],

  /* ثبت/پاک‌کردن اعتبار اکانت. مقدار هرگز در پاسخ یا در گزارش رویدادها نمی‌آید. */
  ['POST', '/api/admin/media/accounts/:id/credentials', 'media.platforms.manage', async (ctx) => {
    const result = setAccountCredentials(ctx.params.id, {
      token: ctx.body.token,
      appId: ctx.body.appId,
      appSecret: ctx.body.appSecret,
    });
    if (!result) fail('NOT_FOUND', 'اکانت پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'media.account.credentials-set', entityType: 'media-account',
      entityId: ctx.params.id, entityLabel: '',
      /* فقط اینکه ثبت شد یا نه — نه مقدار، نه طول، نه بخشی از آن */
      metadata: { hasToken: result.hasToken, hasAppKeys: result.hasAppKeys },
      ip: clientIp(ctx.request),
    });

    return result;
  }],

  ['POST', '/api/admin/media/accounts/:id/test', 'media.platforms.manage', async (ctx) => {
    const result = await testAccountConnection(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'اکانت پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'media.account.tested', entityType: 'media-account',
      entityId: ctx.params.id, entityLabel: '',
      metadata: { ok: result.ok, complete: Boolean(result.complete) }, ip: clientIp(ctx.request),
    });

    return result;
  }],

  ['POST', '/api/admin/media/accounts/:id/sync', 'media.platforms.manage', async (ctx) => {
    const result = await syncAccount(ctx.params.id, { admin: ctx.admin });
    if (!result) fail('NOT_FOUND', 'اکانت پیدا نشد');
    return result;
  }],

  /* ── محتوا ── */

  ['GET', '/api/admin/media/contents', 'media.read', async (ctx) => listContents({
    search: ctx.query.get('search') ?? '',
    status: ctx.query.get('status') ?? 'all',
    platform: ctx.query.get('platform') ?? 'all',
    accountId: ctx.query.get('accountId') ?? 'all',
    campaignId: ctx.query.get('campaignId') ?? 'all',
    contentType: ctx.query.get('contentType') ?? 'all',
    authorId: ctx.query.get('authorId') ?? 'all',
    from: ctx.query.get('from'),
    to: ctx.query.get('to'),
    sort: ctx.query.get('sort') ?? 'newest',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 20,
  })],

  ['GET', '/api/admin/media/calendar', 'media.read', async (ctx) => contentCalendar({
    from: ctx.query.get('from'),
    to: ctx.query.get('to'),
  })],

  ['GET', '/api/admin/media/queue', 'media.read', async () => publishQueue()],

  /* پیش‌نمایش — بدون هیچ درخواست شبکه‌ای؛ همان چیزی که منتشر می‌شود */
  ['POST', '/api/admin/media/contents/preview', 'media.read', async (ctx) => previewContent(ctx.body)],

  ['POST', '/api/admin/media/queue/run', 'media.content.publish', async (ctx) => {
    const result = await runSchedule({ admin: ctx.admin, limit: Number(ctx.body.limit) || 10 });

    logActivity({
      admin: ctx.admin, action: 'media.queue.ran', entityType: 'media-content',
      entityId: null, entityLabel: `${result.processed} محتوا`,
      metadata: { sent: result.sent, dryRun: result.dryRun, failed: result.failed },
      ip: clientIp(ctx.request),
    });

    return result;
  }],

  ['GET', '/api/admin/media/contents/:id', 'media.read', async (ctx) => {
    const content = getContent(ctx.params.id);
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');
    return { content };
  }],

  ['GET', '/api/admin/media/contents/:id/analytics', 'media.read', async (ctx) => {
    const data = contentAnalytics(ctx.params.id);
    if (!data) fail('NOT_FOUND', 'محتوا پیدا نشد');
    return data;
  }],

  ['POST', '/api/admin/media/contents', 'media.content.manage', async (ctx) => {
    const content = createContent(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.content.created', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title,
      metadata: { platform: content.platform, contentType: content.contentType, status: content.status },
      ip: clientIp(ctx.request),
    });
    return { content };
  }],

  ['PUT', '/api/admin/media/contents/:id', 'media.content.manage', async (ctx) => {
    const content = updateContent(ctx.params.id, ctx.body, ctx.admin);
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.content.updated', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title,
      metadata: { status: content.status }, ip: clientIp(ctx.request),
    });
    return { content };
  }],

  ['DELETE', '/api/admin/media/contents/:id', 'media.content.manage', async (ctx) => {
    const content = deleteContent(ctx.params.id, ctx.admin);
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.content.deleted', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title, ip: clientIp(ctx.request),
    });
    return { deleted: content.id };
  }],

  /* تغییر وضعیت با اعتبارسنجی گذار — گذار غیرمجاز ۴۰۹ می‌دهد نه بی‌صدا */
  ['POST', '/api/admin/media/contents/:id/status', 'media.content.manage', async (ctx) => {
    const content = setContentStatus(ctx.params.id, String(ctx.body.status ?? ''), {
      admin: ctx.admin,
      note: ctx.body.note ?? '',
    });
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'media.content.status-changed', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title,
      metadata: { status: content.status }, ip: clientIp(ctx.request),
    });

    return { content };
  }],

  ['POST', '/api/admin/media/contents/:id/submit', 'media.content.manage', async (ctx) => {
    const content = submitContentForReview(ctx.params.id, {
      admin: ctx.admin,
      reviewerId: ctx.body.reviewerId ?? null,
      note: ctx.body.note ?? '',
    });
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'media.content.submitted', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title, ip: clientIp(ctx.request),
    });

    return { content };
  }],

  ['POST', '/api/admin/media/contents/:id/approve', 'media.content.review', async (ctx) => {
    const content = approveContent(ctx.params.id, { admin: ctx.admin, note: ctx.body.note ?? '' });
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'media.content.approved', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title, ip: clientIp(ctx.request),
    });

    return { content };
  }],

  /* درخواست اصلاح: دلیل، توضیح و زمان روی خود محتوا ثبت می‌شود */
  ['POST', '/api/admin/media/contents/:id/revision', 'media.content.review', async (ctx) => {
    const content = requestContentRevision(ctx.params.id, {
      admin: ctx.admin,
      reason: ctx.body.reason ?? '',
      comment: ctx.body.comment ?? '',
    });
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'media.content.revision-requested', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title,
      metadata: { reason: content.rejection?.reason ?? '' }, ip: clientIp(ctx.request),
    });

    return { content };
  }],

  ['POST', '/api/admin/media/contents/:id/schedule', 'media.content.publish', async (ctx) => {
    const content = scheduleContent(ctx.params.id, {
      admin: ctx.admin,
      scheduledAt: ctx.body.scheduledAt,
      note: ctx.body.note ?? '',
    });
    if (!content) fail('NOT_FOUND', 'محتوا پیدا نشد');

    logActivity({
      admin: ctx.admin, action: 'media.content.scheduled', entityType: 'media-content',
      entityId: content.id, entityLabel: content.title,
      metadata: { scheduledAt: content.scheduledAt }, ip: clientIp(ctx.request),
    });

    return { content };
  }],

  ['POST', '/api/admin/media/contents/:id/publish', 'media.content.publish', async (ctx) => {
    const result = await publishContent(ctx.params.id, {
      admin: ctx.admin,
      forceDryRun: ctx.body.dryRun === true,
    });
    if (!result) fail('NOT_FOUND', 'محتوا پیدا نشد');

    logActivity({
      admin: ctx.admin, action: `media.content.publish-${result.status}`, entityType: 'media-content',
      entityId: ctx.params.id, entityLabel: result.content?.title ?? '',
      metadata: { status: result.status }, ip: clientIp(ctx.request),
    });

    return result;
  }],

  ['POST', '/api/admin/media/contents/:id/retry', 'media.content.publish', async (ctx) => {
    const result = await retryContent(ctx.params.id, { admin: ctx.admin });
    if (!result) fail('NOT_FOUND', 'محتوا پیدا نشد');

    logActivity({
      admin: ctx.admin, action: `media.content.retry-${result.status}`, entityType: 'media-content',
      entityId: ctx.params.id, entityLabel: result.content?.title ?? '',
      metadata: { status: result.status }, ip: clientIp(ctx.request),
    });

    return result;
  }],

  /* ── کمپین‌ها ── */

  ['GET', '/api/admin/media/campaigns', 'media.read', async (ctx) => ({
    campaigns: listCampaigns({
      search: ctx.query.get('search') ?? '',
      status: ctx.query.get('status') ?? 'all',
      platform: ctx.query.get('platform') ?? 'all',
    }),
  })],

  ['GET', '/api/admin/media/campaigns/:id', 'media.read', async (ctx) => {
    const campaign = getCampaign(ctx.params.id);
    if (!campaign) fail('NOT_FOUND', 'کمپین پیدا نشد');
    return { campaign };
  }],

  ['POST', '/api/admin/media/campaigns', 'media.content.manage', async (ctx) => {
    const campaign = saveCampaign(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.campaign.created', entityType: 'media-campaign',
      entityId: campaign.id, entityLabel: campaign.name,
      metadata: { status: campaign.status }, ip: clientIp(ctx.request),
    });
    return { campaign };
  }],

  ['PUT', '/api/admin/media/campaigns/:id', 'media.content.manage', async (ctx) => {
    const campaign = saveCampaign({ ...ctx.body, id: ctx.params.id }, ctx.admin);
    if (!campaign) fail('NOT_FOUND', 'کمپین پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.campaign.updated', entityType: 'media-campaign',
      entityId: campaign.id, entityLabel: campaign.name,
      metadata: { status: campaign.status }, ip: clientIp(ctx.request),
    });
    return { campaign };
  }],

  ['DELETE', '/api/admin/media/campaigns/:id', 'media.content.manage', async (ctx) => {
    const result = deleteCampaign(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'کمپین پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.campaign.deleted', entityType: 'media-campaign',
      entityId: result.deleted, entityLabel: '',
      metadata: { detachedContents: result.detachedContents }, ip: clientIp(ctx.request),
    });
    return result;
  }],

  /* ── تیم رسانه ── */

  ['GET', '/api/admin/media/team', 'media.read', async (ctx) => ({
    team: listTeam({
      search: ctx.query.get('search') ?? '',
      role: ctx.query.get('role') ?? 'all',
      active: ctx.query.get('active') ?? 'all',
    }),
  })],

  ['POST', '/api/admin/media/team', 'media.team.manage', async (ctx) => {
    const member = saveTeamMember(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.team.added', entityType: 'media-team',
      entityId: member.id, entityLabel: member.name,
      metadata: { role: member.role }, ip: clientIp(ctx.request),
    });
    return { member };
  }],

  ['PUT', '/api/admin/media/team/:id', 'media.team.manage', async (ctx) => {
    const member = saveTeamMember({ ...ctx.body, id: ctx.params.id }, ctx.admin);
    if (!member) fail('NOT_FOUND', 'عضو تیم پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.team.updated', entityType: 'media-team',
      entityId: member.id, entityLabel: member.name,
      metadata: { role: member.role }, ip: clientIp(ctx.request),
    });
    return { member };
  }],

  ['DELETE', '/api/admin/media/team/:id', 'media.team.manage', async (ctx) => {
    const result = deleteTeamMember(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'عضو تیم پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.team.removed', entityType: 'media-team',
      entityId: result.deleted, entityLabel: '', ip: clientIp(ctx.request),
    });
    return result;
  }],

  /* ── هشتگ و موضوع ── */

  ['GET', '/api/admin/media/tags', 'media.read', async (ctx) => ({
    tags: listTags({ kind: ctx.query.get('kind') ?? 'all', search: ctx.query.get('search') ?? '' }),
  })],

  ['POST', '/api/admin/media/tags', 'media.content.manage', async (ctx) => {
    const tag = saveTag(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.tag.created', entityType: 'media-tag',
      entityId: tag.id, entityLabel: tag.label, metadata: { kind: tag.kind }, ip: clientIp(ctx.request),
    });
    return { tag };
  }],

  ['PUT', '/api/admin/media/tags/:id', 'media.content.manage', async (ctx) => {
    const tag = saveTag({ ...ctx.body, id: ctx.params.id }, ctx.admin);
    if (!tag) fail('NOT_FOUND', 'هشتگ یا موضوع پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.tag.updated', entityType: 'media-tag',
      entityId: tag.id, entityLabel: tag.label, ip: clientIp(ctx.request),
    });
    return { tag };
  }],

  ['DELETE', '/api/admin/media/tags/:id', 'media.content.manage', async (ctx) => {
    const result = deleteTag(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'هشتگ یا موضوع پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.tag.deleted', entityType: 'media-tag',
      entityId: result.deleted, entityLabel: '', ip: clientIp(ctx.request),
    });
    return result;
  }],

  /* ── سنجه‌ها ── */

  ['GET', '/api/admin/media/metrics', 'media.read', async (ctx) => ({
    metrics: listMetrics({
      accountId: ctx.query.get('accountId') ?? 'all',
      platform: ctx.query.get('platform') ?? 'all',
      from: ctx.query.get('from'),
      to: ctx.query.get('to'),
      limit: ctx.query.get('limit') ?? 400,
    }),
  })],

  ['POST', '/api/admin/media/metrics', 'media.content.manage', async (ctx) => {
    const metric = saveMetrics(ctx.body);
    logActivity({
      admin: ctx.admin, action: 'media.metrics.saved', entityType: 'media-account',
      entityId: metric.accountId, entityLabel: metric.date,
      metadata: { platform: metric.platform, source: metric.source }, ip: clientIp(ctx.request),
    });
    return { metric };
  }],

  ['DELETE', '/api/admin/media/metrics/:id', 'media.content.manage', async (ctx) => {
    const result = deleteMetrics(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'رکورد سنجه پیدا نشد');
    return result;
  }],

  /* ── کتابخانهٔ رسانه ── */

  ['GET', '/api/admin/media/assets', 'media.read', async (ctx) => listAssets({
    search: ctx.query.get('search') ?? '',
    kind: ctx.query.get('kind') ?? 'all',
    folder: ctx.query.get('folder') ?? 'all',
    archived: ctx.query.get('archived') ?? 'all',
    sort: ctx.query.get('sort') ?? 'newest',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 24,
  })],

  ['PUT', '/api/admin/media/assets/:id', 'media.content.manage', async (ctx) => {
    const asset = updateAsset(ctx.params.id, ctx.body, ctx.admin);
    if (!asset) fail('NOT_FOUND', 'فایل پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.asset.updated', entityType: 'media-asset',
      entityId: asset.id, entityLabel: asset.originalName, ip: clientIp(ctx.request),
    });
    return { asset };
  }],

  ['POST', '/api/admin/media/assets/:id/archive', 'media.content.manage', async (ctx) => {
    const asset = archiveAsset(ctx.params.id, ctx.body.isArchived !== false, ctx.admin);
    if (!asset) fail('NOT_FOUND', 'فایل پیدا نشد');
    return { asset };
  }],

  ['DELETE', '/api/admin/media/assets/:id', 'media.content.manage', async (ctx) => {
    const result = deleteAsset(ctx.params.id, { force: ctx.body.force === true });
    if (!result) fail('NOT_FOUND', 'فایل پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.asset.deleted', entityType: 'media-asset',
      entityId: result.deleted, entityLabel: '',
      metadata: { detachedFrom: result.detachedFrom }, ip: clientIp(ctx.request),
    });
    return result;
  }],

  /* ── اینباکس ── */

  ['GET', '/api/admin/media/inbox', 'media.read', async (ctx) => listInbox({
    platform: ctx.query.get('platform') ?? 'all',
    accountId: ctx.query.get('accountId') ?? 'all',
    status: ctx.query.get('status') ?? 'all',
    kind: ctx.query.get('kind') ?? 'all',
    assignedToId: ctx.query.get('assignedToId') ?? 'all',
    search: ctx.query.get('search') ?? '',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 20,
  })],

  ['POST', '/api/admin/media/inbox', 'media.ops.manage', async (ctx) => {
    const item = saveInboxItem(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.inbox.created', entityType: 'media-inbox',
      entityId: item?.id ?? null, entityLabel: item?.authorName ?? '',
      metadata: { platform: item?.platform, kind: item?.kind }, ip: clientIp(ctx.request),
    });
    return { item };
  }],

  ['POST', '/api/admin/media/inbox/:id/status', 'media.ops.manage', async (ctx) => {
    const result = setInboxStatus(ctx.params.id, String(ctx.body.status ?? ''), ctx.admin);
    if (!result) fail('NOT_FOUND', 'پیام پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.inbox.status-changed', entityType: 'media-inbox',
      entityId: result.id, entityLabel: '', metadata: { status: result.status }, ip: clientIp(ctx.request),
    });
    return result;
  }],

  ['POST', '/api/admin/media/inbox/:id/assign', 'media.ops.manage', async (ctx) => {
    const result = assignInboxItem(ctx.params.id, ctx.body.assignedToId ?? null, ctx.admin);
    if (!result) fail('NOT_FOUND', 'پیام پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.inbox.assigned', entityType: 'media-inbox',
      entityId: result.id, entityLabel: '', metadata: { assignedToId: result.assignedToId },
      ip: clientIp(ctx.request),
    });
    return result;
  }],

  ['POST', '/api/admin/media/inbox/:id/reply', 'media.ops.manage', async (ctx) => {
    const result = replyInboxItem(ctx.params.id, { text: ctx.body.text, admin: ctx.admin });
    if (!result) fail('NOT_FOUND', 'پیام پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'media.inbox.replied', entityType: 'media-inbox',
      entityId: result.id, entityLabel: '', ip: clientIp(ctx.request),
    });
    return result;
  }],

  ['DELETE', '/api/admin/media/inbox/:id', 'media.ops.manage', async (ctx) => {
    const result = deleteInboxItem(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'پیام پیدا نشد');
    return result;
  }],

  /* ── رصد نام و کلیدواژه ── */

  ['GET', '/api/admin/media/mentions/summary', 'media.read', async () => listeningSummary()],

  ['GET', '/api/admin/media/mentions', 'media.read', async (ctx) => ({
    mentions: listMentions({
      platform: ctx.query.get('platform') ?? 'all',
      keyword: ctx.query.get('keyword') ?? 'all',
      sentiment: ctx.query.get('sentiment') ?? 'all',
      handled: ctx.query.get('handled') ?? 'all',
      search: ctx.query.get('search') ?? '',
    }),
  })],

  ['POST', '/api/admin/media/mentions', 'media.ops.manage', async (ctx) => {
    const mention = saveMention(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.mention.created', entityType: 'media-mention',
      entityId: mention?.id ?? null, entityLabel: mention?.keywordLabel ?? '',
      metadata: { platform: mention?.platform }, ip: clientIp(ctx.request),
    });
    return { mention };
  }],

  ['PUT', '/api/admin/media/mentions/:id', 'media.ops.manage', async (ctx) => {
    const mention = saveMention({ ...ctx.body, id: ctx.params.id }, ctx.admin);
    if (!mention) fail('NOT_FOUND', 'منشن پیدا نشد');
    return { mention };
  }],

  ['DELETE', '/api/admin/media/mentions/:id', 'media.ops.manage', async (ctx) => {
    const result = deleteMention(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'منشن پیدا نشد');
    return result;
  }],

  /* ── اعلان‌ها ── */

  ['GET', '/api/admin/media/notifications', 'media.read', async (ctx) => listNotifications({
    status: ctx.query.get('status') ?? 'all',
    level: ctx.query.get('level') ?? 'all',
  })],

  /* بررسی دوره‌ای اعلان‌ها — فقط از دادهٔ موجود، بدون اعلان تزئینی */
  ['POST', '/api/admin/media/notifications/refresh', 'media.read', async (ctx) => refreshNotifications()],

  ['POST', '/api/admin/media/notifications/read-all', 'media.ops.manage', async (ctx) => {
    const result = markAllNotificationsRead();
    logActivity({
      admin: ctx.admin, action: 'media.notifications.read-all', entityType: 'media-notification',
      entityId: null, entityLabel: '', ip: clientIp(ctx.request),
    });
    return result;
  }],

  ['POST', '/api/admin/media/notifications/:id', 'media.ops.manage', async (ctx) => {
    const notification = setNotificationState(ctx.params.id, {
      isRead: ctx.body.isRead,
      isArchived: ctx.body.isArchived,
    });
    if (!notification) fail('NOT_FOUND', 'اعلان پیدا نشد');
    return { notification };
  }],

  /* ── UTM ── */

  ['GET', '/api/admin/media/utm', 'media.read', async (ctx) => ({
    links: listUtm({
      campaignId: ctx.query.get('campaignId') ?? 'all',
      platform: ctx.query.get('platform') ?? 'all',
    }),
  })],

  /* ساخت آدرس بدون ذخیره — برای دیدن زندهٔ لینک در فرم */
  ['POST', '/api/admin/media/utm/preview', 'media.read', async (ctx) => ({
    url: buildUtmUrl(ctx.body),
  })],

  ['POST', '/api/admin/media/utm', 'media.ops.manage', async (ctx) => {
    const link = saveUtm(ctx.body, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'media.utm.created', entityType: 'media-utm',
      entityId: link?.id ?? null, entityLabel: link?.label ?? '',
      metadata: { source: link?.source, medium: link?.medium }, ip: clientIp(ctx.request),
    });
    return { link };
  }],

  ['PUT', '/api/admin/media/utm/:id', 'media.ops.manage', async (ctx) => {
    const link = saveUtm({ ...ctx.body, id: ctx.params.id }, ctx.admin);
    if (!link) fail('NOT_FOUND', 'لینک پیدا نشد');
    return { link };
  }],

  ['DELETE', '/api/admin/media/utm/:id', 'media.ops.manage', async (ctx) => {
    const result = deleteUtm(ctx.params.id);
    if (!result) fail('NOT_FOUND', 'لینک پیدا نشد');
    return result;
  }],

  /* ── گزارش رویدادهای مرکز رسانه ── */

  ['GET', '/api/admin/media/audit', 'media.audit.read', async (ctx) => listMediaAudit({
    search: ctx.query.get('search') ?? '',
    action: ctx.query.get('action') ?? 'all',
    entityType: ctx.query.get('entityType') ?? 'all',
    page: ctx.query.get('page') ?? 1,
    perPage: ctx.query.get('perPage') ?? 20,
  })],

  /* ── دادهٔ نمونه ── */

  /*
   * پاک‌کردن **فقط** رکوردهای نمونه. دادهٔ واقعی دست‌نخورده می‌ماند، پس این
   * عملیات بی‌خطر است و نیازی به تأیید دوم ندارد.
   */
  ['POST', '/api/admin/media/demo/clear', 'media.platforms.manage', async (ctx) => {
    const result = clearDemoData();
    logActivity({
      admin: ctx.admin, action: 'media.demo.cleared', entityType: 'media-platform',
      entityId: null, entityLabel: 'پاک‌سازی دادهٔ نمونه',
      metadata: { removed: result.total }, ip: clientIp(ctx.request),
    });
    return result;
  }],

  /* بارگذاری دوبارهٔ دادهٔ نمونه — برای وقتی کاربر می‌خواهد دمو را ببیند */
  ['POST', '/api/admin/media/demo/seed', 'media.platforms.manage', async (ctx) => {
    const result = ensureMediaStore({ force: true });
    logActivity({
      admin: ctx.admin, action: 'media.demo.seeded', entityType: 'media-platform',
      entityId: null, entityLabel: 'بارگذاری دادهٔ نمونه',
      metadata: { counts: result.counts }, ip: clientIp(ctx.request),
    });
    return result;
  }],

  /* ───────────────────────── مرکز تحلیل ───────────────────────── */

  /* منابع داده — شفاف‌ترین بخش: کدام منبع وصل است و کدام نه */
  ['GET', '/api/admin/analytics/sources', 'analytics.read', async () => ({
    sources: dataSources(),
    permissions: { ...PERMISSIONS },
  })],

  /* Monitoring API — برای ابزارهای مانیتورینگ بیرونی */
  ['GET', '/api/admin/analytics/ping', 'analytics.read', async () => {
    const system = systemMetrics();
    const requests = requestMetrics();
    return {
      status: requests.errorRate >= 15 ? 'critical' : requests.errorRate >= 5 ? 'warn' : 'healthy',
      uptimeSeconds: system.server.uptimeSeconds,
      cpuPercent: system.cpu.usedPercent,
      processRssMb: Math.round(system.memory.processRssBytes / 1048576),
      memoryUsedPercent: system.memory.usedPercent,
      diskUsedPercent: system.disk?.usedPercent ?? null,
      api: { total: requests.total, errorRate: requests.errorRate, averageMs: requests.averageMs, rpm: requests.rpm },
      checkedAt: new Date().toISOString(),
    };
  }],

  /* هر بخش یک Route با Permission مستقل — بخش حساس به نقش غیرمجاز داده نمی‌شود */
  ...ANALYTICS_ROUTES.map(([name, permission, handler]) => [
    'GET',
    `/api/admin/analytics/${name}`,
    permission,
    async (ctx) => {
      const context = analyticsContext(ctx);
      const data = await handler(context, { secure: isSecureRequest(ctx.request) });
      return { section: name, range: context.resolved, data };
    },
  ]),

  /* دادهٔ خروجی (Export) — یک پاسخ تخت برای CSV/Excel سمت کلاینت */
  ['GET', '/api/admin/analytics/export', 'analytics.export', async (ctx) => {
    const context = analyticsContext(ctx);
    const section = String(ctx.query.get('section') ?? 'traffic');
    const handler = ANALYTICS_SECTION_MAP[section];
    if (!handler) fail('VALIDATION_ERROR', 'بخش خروجی نامعتبر است');

    const data = await handler(context, { secure: isSecureRequest(ctx.request) });
    return { section, range: context.resolved, data };
  }],

  /* هشدارها */
  ['GET', '/api/admin/analytics/alerts', 'analytics.read', async (ctx) => {
    const context = analyticsContext(ctx);
    return alertsSection(context);
  }],

  ['POST', '/api/admin/analytics/alerts', 'analytics.alerts.manage', async (ctx) => {
    const alert = saveAlert(ctx.body, null, ctx.admin);
    logActivity({
      admin: ctx.admin, action: 'alert.created', entityType: 'alert',
      entityId: alert.id, entityLabel: alert.name,
      metadata: { metric: alert.metric, threshold: alert.threshold },
      ip: clientIp(ctx.request),
    });
    return { alert };
  }],

  ['PUT', '/api/admin/analytics/alerts/:id', 'analytics.alerts.manage', async (ctx) => {
    const alert = saveAlert(ctx.body, ctx.params.id, ctx.admin);
    if (!alert) fail('NOT_FOUND', 'هشدار پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'alert.updated', entityType: 'alert',
      entityId: alert.id, entityLabel: alert.name, ip: clientIp(ctx.request),
    });
    return { alert };
  }],

  ['DELETE', '/api/admin/analytics/alerts/:id', 'analytics.alerts.manage', async (ctx) => {
    const alert = deleteAlert(ctx.params.id);
    if (!alert) fail('NOT_FOUND', 'هشدار پیدا نشد');
    logActivity({
      admin: ctx.admin, action: 'alert.deleted', entityType: 'alert',
      entityId: alert.id, entityLabel: alert.name, ip: clientIp(ctx.request),
    });
    return { deleted: alert.id };
  }],

  /* پاک‌سازی رویدادها — ابزار توسعه، فقط برای مدیر کل */
  ['POST', '/api/admin/analytics/reset', 'analytics.alerts.manage', async (ctx) => {
    const result = clearEvents();
    logActivity({
      admin: ctx.admin, action: 'analytics.reset', entityType: 'analytics',
      entityId: 'events', entityLabel: 'پاک‌سازی رویدادهای تحلیل', ip: clientIp(ctx.request),
    });
    return result;
  }],
];

/* [pattern, handler] — مسیرهای عمومی سایت، بدون احراز هویت */
const PUBLIC_ROUTES = [
  ['/api/public/articles', async () => ({ articles: publishedArticles({ limit: 100 }) })],
  ['/api/public/banners', async () => ({ banners: publishedBanners() })],
  ['/api/public/settings', async () => ({ settings: publicSettings() })],
  /* کتابخانهٔ رسمی فلش‌کارت تپش — فقط دک‌های منتشرشده (عادی + آناتومی تصویری) */
  ['/api/public/flashcards/library', async () => ({ decks: publishedFlashcardDecks() })],
  /*
   * میکرو درسنامه — درسنامه‌های منتشرشده برای همهٔ کاربران تپش.
   * خروجی با قرارداد دادهٔ موتور میکرو یکسان است تا خوانندهٔ درسنامه بدون تبدیل
   * مصرفش کند. آنچه منتشر نشده اینجا نیست.
   */
  ['/api/public/micro/library', async () => ({ courses: publishedMicroCourses() })],
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
 * مسیرهایی که درخواست‌هایشان شمرده نمی‌شود: پنل هر ۱۰ ثانیه «لحظه‌ای» را
 * می‌خواند؛ اگر این درخواست‌ها در سنجه‌ها بیایند، اندازه‌گیری خودش را آلوده می‌کند.
 */
const NOT_MEASURED_PREFIXES = ['/api/admin/analytics'];

/*
 * خروجی: true اگر درخواست مدیریت شد، false اگر به لایهٔ بعدی (مثلاً فایل استاتیک) واگذار شود.
 */
export async function handleApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isPublicApi = pathname === '/api/public' || pathname.startsWith('/api/public/');
  if (!isAdminApi && !isPublicApi) return false;

  const startedAt = Date.now();
  let caught = null;

  response.setHeader('Referrer-Policy', 'same-origin');

  try {
    ensureStore();

    /*
     * مرکز رسانه فقط وقتی آماده‌سازی می‌شود که واقعاً کسی سراغش رفته باشد.
     * `ensureMediaStore` یک‌بار دادهٔ نمونه را می‌سازد و بعد فقط یک فایل کوچک
     * فراداده می‌خواند؛ ولی حتی همین هم نباید به قیمت هر درخواست پنل تمام شود.
     */
    if (pathname.startsWith('/api/admin/media')) ensureMediaStore();

    /* ── مسیرهای عمومی ── */
    if (isPublicApi) {
      /* تلمتری مرورگر — تنها مسیر عمومی غیر-GET، با محدودیت نرخ */
      if (pathname === '/api/public/analytics/collect') {
        if (request.method !== 'POST') fail('VALIDATION_ERROR', 'این مسیر فقط POST می‌پذیرد');

        const gate = allowCollect(clientIp(request));
        if (!gate.allowed) {
          fail('RATE_LIMITED', `درخواست بیش از حد مجاز؛ ${gate.retryAfter} ثانیه دیگر تلاش کنید`);
        }

        const body = await readBody(request, 64 * 1024);
        const batch = Array.isArray(body?.events)
          ? body.events.slice(0, 50)
          : [body?.event].filter(Boolean);
        if (!batch.length) fail('VALIDATION_ERROR', 'رویدادی ارسال نشد');

        const userAgent = request.headers?.['user-agent'] ?? '';
        const result = recordEvents(batch.map((event) => ({ ...event, userAgent: event.userAgent || userAgent })));
        ok(response, result, 202);
        return true;
      }

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
    caught = error;
    sendError(response, error);
    return true;
  } finally {
    /* سنجهٔ واقعی درخواست — خطاها هم ثبت می‌شوند تا بخش «خطاها» داده داشته باشد */
    if (!NOT_MEASURED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      recordApiRequest({
        path: pathname,
        method: request.method,
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
        error: caught,
      });
    }
    clearExpiredSessions();
  }
}

export default handleApi;
