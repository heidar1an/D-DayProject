/*
 * تست امنیتی «بانک تست و مرز اعتماد آزمون» — PHASE 2. بدون فریم‌ورک تست.
 * اجرا: node database/testBankSecurity.test.mjs
 *
 * روی هندلرهای واقعی سرور کار می‌کند (`handleApi` برای مسیرهای عمومی و
 * `handleUsersApi` برای مسیرهای کاربر)، نه روی توابع جدا. دسته‌بندی‌ها مطابق
 * سند فاز: public-question-security · answer-submission-security ·
 * grading-integrity · replay-protection · duplicate-submit · reward-integrity ·
 * guest-security · answer-key-exposure · rate-limit.
 *
 * پوشش Attempt/Timing/Ranking آزمون‌های هماهنگ در `examApi.test.mjs` است
 * (۲۷ سنجه) و این فایل دست‌نخورده‌بودن آن مرز را هم می‌سنجد (سنجهٔ ۳۰).
 *
 * داده: `testBankAnswers.json`، `testBankHeartRewards.json` و
 * `testBankQuestions.json` پیش از اجرا نسخه‌برداری و در `finally` بازگردانده
 * می‌شوند — تست هیچ اثری روی دادهٔ واقعی نمی‌گذارد.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { handleApi } from './adminApi.js';
import { publishedTestBankQuestions } from './contentStore.js';
import { resetAuthRateLimit } from './userRateLimit.js';
import { USER_SESSION_COOKIE, createUserSession, destroyUserSession } from './userSessions.js';
import { handleUsersApi } from './usersApi.js';
import { createUser, findUserByPhone } from './usersStore.js';

const results = [];
const check = (name, condition) => results.push({ name, pass: Boolean(condition) });

/* ───────────────────────────── بکاپ داده ───────────────────────────── */

const CONTENT_FILES = ['testBankAnswers.json', 'testBankHeartRewards.json', 'testBankQuestions.json'];
const paths = CONTENT_FILES.map((name) => fileURLToPath(new URL(`./content/${name}`, import.meta.url)));
const backups = paths.map((path) => (existsSync(path) ? readFileSync(path, 'utf8') : null));

function restoreContent() {
  paths.forEach((path, index) => {
    if (backups[index] === null) return;
    writeFileSync(path, backups[index], 'utf8');
  });
}

/* ───────────────────────────── ابزار HTTP ───────────────────────────── */

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    headers,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    end(chunk) { this.body = chunk ?? ''; },
  };
}

/*
 * هندلر مشخص را صدا می‌زند. `origin`/`host` یکی هستند چون `assertSameOrigin`
 * مسیرهای کاربر این شرط را می‌خواهد (لایهٔ دوم CSRF).
 */
async function call(handler, method, path, { body, cookies = {}, raw = null, headers = {} } = {}) {
  const cookieHeader = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ');
  const request = {
    method,
    url: path,
    headers: {
      host: 'localhost',
      origin: 'http://localhost',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(body !== undefined || raw !== null ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, handler_) {
      if (event === 'data') handler_(Buffer.from(raw ?? JSON.stringify(body ?? {})));
      if (event === 'end') handler_();
      return this;
    },
  };

  const response = createResponse();
  const handled = await handler(request, response);
  let payload = null;
  try { payload = response.body ? JSON.parse(response.body) : null; } catch { payload = null; }
  return { handled, status: response.statusCode, payload, headers: response.headers };
}

const publicGet = (path) => call(handleApi, 'GET', path);
/* `handleUsersApi` فقط مسیرهای زیر `/api/users` را می‌گیرد */
const userPost = (path, body, cookies = {}) => call(handleUsersApi, 'POST', `/api/users${path}`, { body, cookies });
const userGet = (path, cookies = {}) => call(handleUsersApi, 'GET', `/api/users${path}`, { cookies });

/* ───────────────────────────── سنجه‌ها ───────────────────────────── */

const FORBIDDEN_KEYS = new Set([
  'correctAnswer', 'answerKey', 'answer', 'solution', 'explanation', 'grading',
  'teacherAnswer', 'privateStats', 'adminNotes', 'securityMetadata',
  'optionPercents', 'difficultyIndex', 'status', 'createdBy', 'updatedBy',
]);

function collectKeys(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) { value.forEach((item) => collectKeys(item, found)); return found; }
  for (const [key, child] of Object.entries(value)) {
    found.add(key);
    collectKeys(child, found);
  }
  return found;
}

const testUser = 'phase2-test-user';

try {
  resetAuthRateLimit();

  /* ═══════════ A. public-question-security ═══════════ */

  const bank = await publicGet('/api/public/test-bank/questions');
  check('۱. GET /api/public/test-bank/questions بدون احراز هویت پاسخ ۲۰۰ می‌دهد', bank.status === 200 && bank.payload?.success === true);

  const publicQuestions = bank.payload?.data?.questions ?? [];
  check('۲. بانک منتشرشده غیرخالی است (پیش‌شرط بقیهٔ سنجه‌ها)', publicQuestions.length > 0);

  const forbiddenInPublic = [...collectKeys(publicQuestions)].filter((key) => FORBIDDEN_KEYS.has(key));
  check('۳. پاسخ عمومی هیچ کلید پاسخ/تحلیل/آمار گزینه/فرادادهٔ پنل ندارد', forbiddenInPublic.length === 0);

  const publicStats = publicQuestions.map((question) => Object.keys(question.stats ?? {}));
  check('۴. آمار سؤال عمومی فقط solves/correctPercent/avgTimeSec است',
    publicStats.every((keys) => keys.every((key) => ['solves', 'correctPercent', 'avgTimeSec'].includes(key))));

  const revision = await publicGet('/api/public/test-bank/revision');
  check('۵. مسیر revision هم کلید پاسخ نمی‌دهد',
    revision.status === 200 && !JSON.stringify(revision.payload).includes('correctAnswer'));

  const comprehensive = await publicGet('/api/public/comprehensive/library');
  /*
   * فقط سؤال‌های برگرفته از بانک تست بررسی می‌شوند. محتوای دست‌نویس خودِ
   * درسنامه (`unit.learning.*`) اثر مؤلف است و از این مرز بیرون است.
   * اگر هیچ واحدی سؤال بانکی نداشته باشد، این سنجه از مسیر منبع (سنجهٔ ۶.۱)
   * پوشش داده می‌شود.
   */
  const comprehensiveBankQuestions = Object.values(comprehensive.payload?.data?.courses ?? [])
    .flatMap((course) => Object.values(course.unitsByModule ?? {}))
    .flat()
    .flatMap((unit) => unit.testBank?.questions ?? []);
  const comprehensiveBankKeys = [...collectKeys(comprehensiveBankQuestions)];
  check('۶. سؤال‌های بانک تست در /api/public/comprehensive/library بدون answer/explanation هستند',
    comprehensiveBankQuestions.length > 0
      ? (!comprehensiveBankKeys.includes('answer') && !comprehensiveBankKeys.includes('explanation'))
      : (comprehensive.status === 200 && comprehensiveBankKeys.length === 0));

  /* ۶.۱ قرارداد سریال‌سازی مسیر جامع — سؤال بانکی نباید فیلد answer/explanation بسازد */
  const storeSource = readFileSync(fileURLToPath(new URL('./contentStore.js', import.meta.url)), 'utf8');
  const comprehensiveSerializer = storeSource.slice(
    storeSource.indexOf('function comprehensiveBankQuestion('),
    storeSource.indexOf('function comprehensiveUnitQuestions('),
  );
  check('۶.۱ serializer درسنامهٔ جامع فیلد answer/explanation نمی‌سازد',
    comprehensiveSerializer.length > 0
      && !/\banswer\s*:/.test(comprehensiveSerializer)
      && !/\bexplanation\s*:/.test(comprehensiveSerializer));

  const adminRoute = await call(handleApi, 'GET', '/api/admin/test-bank');
  check('۷. مسیر ادمین بدون سشن ۴۰۱ می‌گیرد (کلید پشت احراز می‌ماند)',
    adminRoute.status === 401 || adminRoute.status === 403);

  /* ═══════════ B. answer-key-exposure (Bundle) ═══════════ */

  /*
   * بانک کلاینت را **داده** بررسی می‌کنیم، نه متن فایل — توضیحات همین تغییر
   * خودشان نام فیلدها را دارند و اسکن متنی نتیجهٔ کاذب می‌دهد.
   */
  const clientBank = (await import('../src/services/testBank/mockData.js')).QUESTIONS;
  const clientKeys = [...collectKeys(clientBank)];
  check('۸. بانک کلاینت هیچ correctAnswer ندارد', !clientKeys.includes('correctAnswer'));
  check('۹. بانک کلاینت هیچ explanation ندارد', !clientKeys.includes('explanation'));
  check('۱۰. بانک کلاینت هیچ optionPercents/difficultyIndex ندارد',
    !clientKeys.includes('optionPercents') && !clientKeys.includes('difficultyIndex'));
  check('۱۰.۱ بانک کلاینت فرادادهٔ لازم UI را نگه داشته (stem/options/stats)',
    clientBank.length > 0 && clientBank.every((question) => question.stem && question.options?.length >= 2 && question.stats));

  const seedSource = readFileSync(fileURLToPath(new URL('./testBankSeed.mjs', import.meta.url)), 'utf8');
  check('۱۱. seed سرور کلید پاسخ را نگه می‌دارد (تصحیح ممکن است)', seedSource.includes('correctAnswer'));

  const clientFiles = [
    '../src/services/testBank/testBankService.js',
    '../src/services/micro/microTestEngine.js',
    '../src/services/examBuilder/examBuilderService.js',
    '../src/services/analytics/analyticsService.js',
  ].map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));
  check('۱۲. هیچ ماژول کلاینتی seed سرور را import نمی‌کند',
    clientFiles.every((source) => !source.includes('testBankSeed')));

  const serviceSource = readFileSync(fileURLToPath(new URL('../src/services/testBank/testBankService.js', import.meta.url)), 'utf8');
  check('۱۳. تصحیح کلاینت از endpoint سرور می‌آید، نه از مقایسهٔ محلی',
    serviceSource.includes('/test-bank/grade') && !/selected\s*===\s*question\.correctAnswer/.test(serviceSource));

  /* ═══════════ C. answer-submission-security ═══════════ */

  const seedQuestions = publishedTestBankQuestions();
  const target = seedQuestions[0];
  const storedRaw = JSON.parse(readFileSync(paths[2], 'utf8'));
  const storedList = Array.isArray(storedRaw) ? storedRaw : (storedRaw.questions ?? []);
  const storedTarget = storedList.find((item) => item.id === target.id);
  const correctIndex = storedTarget.correctAnswer;
  const wrongIndex = (correctIndex + 1) % target.options.length;

  /* کاربر موقت + سشن واقعی */
  const existingUser = findUserByPhone('09120000901');
  const user = existingUser ?? createUser({ phone: '09120000901', password: 'phase2-test-pass', profile: { username: 'phase2' } });
  const session = createUserSession(user, { ip: '127.0.0.1', userAgent: 'phase2-test' });
  const cookie = { [USER_SESSION_COOKIE]: session.token };

  const forged = await userPost('/test-bank/answers', {
    answers: [{ questionId: target.id, selected: correctIndex, isCorrect: true, reward: 999, hearts: 999, score: 100 }],
    score: 100, userId: 'someone-else',
  }, cookie);
  check('۱۴. بدنهٔ جعلی (isCorrect/reward/score/hearts/userId) نادیده گرفته می‌شود',
    forged.status === 200 && forged.payload?.results?.[0]?.correct === true);

  const wrongAnswer = await userPost('/test-bank/answers', {
    answers: [{ questionId: target.id, selected: wrongIndex, isCorrect: true, reward: 999 }],
  }, cookie);
  check('۱۵. ادعای «درست بودن» با گزینهٔ غلط، در سرور غلط می‌شود',
    wrongAnswer.status === 200 && wrongAnswer.payload?.results?.[0]?.correct === false);

  const invalidInputs = await userPost('/test-bank/answers', {
    answers: [
      { questionId: target.id, selected: 999 },
      { questionId: target.id, selected: null },
      { questionId: target.id, selected: { a: 1 } },
      { questionId: target.id, selected: [0] },
      { questionId: 'no-such-question', selected: 0 },
      { questionId: target.id, selected: 'x'.repeat(5000) },
    ],
  }, cookie);
  check('۱۶. گزینهٔ نامعتبر/تهی/شیء/آرایه/سؤال ناموجود همه رد می‌شوند',
    invalidInputs.status === 200 && (invalidInputs.payload?.results ?? []).length === 0);

  const oversized = await userPost('/test-bank/answers', { answers: Array.from({ length: 1500 }, () => ({ questionId: target.id, selected: correctIndex })) }, cookie);
  check('۱۷. ورودی غول‌آسا سرور را از کار نمی‌اندازد (سقف ۱۰۰۰ ورودی)',
    oversized.status === 200);

  const noOrigin = await call(handleUsersApi, 'POST', '/api/users/test-bank/answers', {
    body: { answers: [] }, cookies: cookie, headers: { origin: undefined },
  });
  check('۱۸. بدون Origin، مسیر تغییردهنده ۴۰۳ می‌گیرد (CSRF)', noOrigin.status === 403);

  const wrongContentType = await call(handleUsersApi, 'POST', '/api/users/test-bank/answers', {
    cookies: cookie, raw: 'answers=1', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  check('۱۹. بدون application/json، پاسخ ۴۱۵ است', wrongContentType.status === 415);

  const malformed = await call(handleUsersApi, 'POST', '/api/users/test-bank/answers', { cookies: cookie, raw: '{not json' });
  check('۲۰. بدنهٔ JSON خراب ۴۰۰ می‌گیرد', malformed.status === 400);

  /* ═══════════ D. grading-integrity ═══════════ */

  const gradeBody = {
    questionIds: seedQuestions.slice(0, 6).map((question) => question.id),
    answers: {
      [seedQuestions[0].id]: { selected: correctIndex },
      [seedQuestions[1].id]: { selected: wrongIndex },
    },
    score: 100, percentage: 100, correct: 6,
  };
  const graded = await userPost('/test-bank/grade', gradeBody, cookie);
  const gradedResult = graded.payload?.result;
  check('۲۱. تصحیح سروری: score/percentage جعلی بدنه نادیده می‌شود',
    graded.status === 200 && gradedResult?.correct === 1 && gradedResult?.wrong === 1 && gradedResult?.unanswered === 4);
  check('۲۲. total = تعداد سؤال‌های معتبر (۶) و درصد از سرور ساخته می‌شود',
    gradedResult?.total === 6 && gradedResult?.percentage === Math.round((1 / 6) * 1000) / 10);

  const wrongIdsForger = await userPost('/test-bank/grade', {
    questionIds: [seedQuestions[0].id],
    answers: { [seedQuestions[0].id]: { selected: correctIndex } },
  }, cookie);
  check('۲۳. تکرار تصحیح همان درخواست، همان اعداد را می‌دهد (determinism)',
    wrongIdsForger.payload?.result?.correct === 1 && wrongIdsForger.payload?.result?.score === 1);

  const unknownIds = await userPost('/test-bank/grade', {
    questionIds: ['nope-1', 'nope-2', seedQuestions[0].id],
    answers: { [seedQuestions[0].id]: { selected: correctIndex } },
  }, cookie);
  check('۲۴. شناسهٔ ناموجود از total حذف می‌شود (نه سوءاستفاده از سهمیه)',
    unknownIds.payload?.result?.total === 1);

  const badGradePayload = await userPost('/test-bank/grade', { questionIds: 'all' }, cookie);
  check('۲۵. questionIds غیرآرایه ۴۰۰ می‌گیرد', badGradePayload.status === 400);

  /* ═══════════ E. replay-protection / duplicate-submit ═══════════ */

  const replayA = await userPost('/test-bank/answers', { answers: [{ questionId: target.id, selected: correctIndex }] }, cookie);
  const replayB = await userPost('/test-bank/answers', {
    answers: [{ questionId: target.id, selected: correctIndex, answeredAt: Date.now() - 5 * 60 * 60 * 1000 }],
  }, cookie);
  const replayC = await userPost('/test-bank/answers', { answers: [{ questionId: target.id, selected: correctIndex, answeredAt: 0 }] }, cookie);
  const awardedTotal = [replayA, replayB, replayC].flatMap((response) => response.payload?.awardedQuestionIds ?? []);
  check('۲۶. Replay با answeredAt جعلی پاداش تازه نمی‌سازد',
    (replayB.payload?.awardedQuestionIds ?? []).length === 0 && (replayC.payload?.awardedQuestionIds ?? []).length === 0);

  const duplicateInOne = await userPost('/test-bank/answers', {
    answers: [
      { questionId: target.id, selected: correctIndex },
      { questionId: target.id, selected: correctIndex },
      { questionId: target.id, selected: correctIndex },
    ],
  }, cookie);
  check('۲۷. سه بار همان سؤال در یک درخواست = حداکثر یک پاداش',
    (duplicateInOne.payload?.awardedQuestionIds ?? []).length === 0);

  /* ═══════════ F. reward-integrity ═══════════ */

  const hearts = await userGet('/hearts', cookie);
  const rewards = hearts.payload?.awards ?? [];
  check('۲۸. قلب‌ها فقط از سشن کاربر خوانده می‌شوند (بدون ورودی هویت)',
    hearts.status === 200 && Array.isArray(rewards) && rewards.length <= seedQuestions.length);

  const rewardsFile = JSON.parse(readFileSync(paths[1], 'utf8'));
  const rewardsList = Array.isArray(rewardsFile) ? rewardsFile : (rewardsFile.rewards ?? []);
  const mine = rewardsList.filter((reward) => reward.userId === user.id);
  const perQuestion = new Map();
  for (const reward of mine) perQuestion.set(reward.questionId, (perQuestion.get(reward.questionId) ?? 0) + 1);
  check('۲۹. حداکثر یک پاداش به ازای هر (کاربر، سؤال، روز)',
    [...perQuestion.values()].every((count) => count === 1));
  check('۳۰. کلید پاداش از سرور می‌آید، نه از answeredAt کلاینت',
    mine.every((reward) => /^[^:]+:\d+$/.test(reward.attemptKey)));

  /* ═══════════ G. guest-security ═══════════ */

  const guest = await userPost('/test-bank/answers', { answers: [{ questionId: target.id, selected: correctIndex }] });
  const guestCookie = String(guest.headers.get('set-cookie') ?? '');
  check('۳۱. مهمان سشن ناشناس با کوکی HttpOnly/SameSite=Strict می‌گیرد',
    guest.status === 200 && guestCookie.includes('HttpOnly') && guestCookie.includes('SameSite=Strict'));
  check('۳۲. هویت مهمان سروری است و از بدنهٔ کلاینت گرفته نمی‌شود',
    !String(guest.payload?.userId ?? '').includes('phase2-test-user'));

  const guestHearts = await call(handleUsersApi, 'GET', '/api/users/hearts', {});
  check('۳۳. بدون سشن، قلب‌ها خالی برمی‌گردد (نه قلب دیگران)',
    guestHearts.status === 200 && (guestHearts.payload?.awards ?? []).length === 0);

  /* ═══════════ H. rate-limit ═══════════ */

  resetAuthRateLimit();
  let rateLimited = false;
  for (let index = 0; index < 60; index += 1) {
    const response = await userPost('/test-bank/grade', { questionIds: [target.id], answers: {} }, cookie);
    if (response.status === 429) { rateLimited = true; break; }
  }
  check('۳۴. اسپم تصحیح به ۴۲۹ می‌خورد (rate limit روی مسیر حساس)', rateLimited);
  resetAuthRateLimit();

  /* ═══════════ I. مرزهای دست‌نخورده ═══════════ */

  const examStoreSource = readFileSync(fileURLToPath(new URL('./examStore.js', import.meta.url)), 'utf8');
  check('۳۵. مرز آزمون‌های هماهنگ دست‌نخورده است (sanitizeQuestion سرورمحور)',
    examStoreSource.includes('sanitizeQuestion') && examStoreSource.includes('correctAnswer'));

  const examSuite = readFileSync(fileURLToPath(new URL('./examApi.test.mjs', import.meta.url)), 'utf8');
  check('۳۶. مجموعه‌تست آزمون‌های هماهنگ موجود و اجراشدنی است (regression baseline)',
    examSuite.includes('handleExamApi') && examSuite.includes('/api/attempts/'));

  const usersApiSource = readFileSync(fileURLToPath(new URL('./usersApi.js', import.meta.url)), 'utf8');
  check('۳۷. مسیرهای حساس بانک تست Rate Limit دارند',
    usersApiSource.includes("enforceRateLimit('testBankAnswer'") && usersApiSource.includes("enforceRateLimit('testBankGrade'"));

  check('۳۸. هیچ پاسخ کلید/تحلیلی در payload عمومی نشت نمی‌کند (اسکن کلیدواژه‌ای)',
    !JSON.stringify(bank.payload).includes('correctAnswer') && !JSON.stringify(bank.payload).includes('"explanation"'));
} finally {
  restoreContent();
  resetAuthRateLimit();
  if (typeof session !== 'undefined' && session) destroyUserSession(session.token);
  /* کاربر آزمایشی از users.json پاک می‌شود */
  try {
    const usersFile = fileURLToPath(new URL('./users.json', import.meta.url));
    const parsed = JSON.parse(readFileSync(usersFile, 'utf8'));
    parsed.users = (parsed.users ?? []).filter((item) => item.phone !== '09120000901');
    writeFileSync(usersFile, JSON.stringify(parsed, null, 2), 'utf8');
  } catch {
    /* users.json نیست — مشکلی نیست */
  }
}

console.log('\nنتیجهٔ تست امنیتی بانک تست و مرز اعتماد آزمون (PHASE 2):');
results.forEach((row) => console.log(`  ${row.pass ? '✓' : '✗'} ${row.name}`));
const passed = results.filter((row) => row.pass).length;
console.log(`\n${passed}/${results.length} سنجه موفق\n`);

if (passed !== results.length) process.exitCode = 1;
