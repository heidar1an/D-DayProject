/*
 * تست امنیتی API آزمون‌های هماهنگ — بدون هیچ فریم‌ورک تست.
 * اجرا: node database/examApi.test.mjs
 *
 * روی هندلر واقعی `handleExamApi` کار می‌کند و Invariantهای سند امنیتی را
 * می‌سنجد (PHASE 35/36/37 سند): احراز هویت، مالکیت (IDOR)، تحویل سؤال بدون
 * کلید پاسخ، عبور سؤال از مرز Attempt، انقضا، idempotency، mass-assignment،
 * نمرهٔ سرورمحور، rate limit و زنجیرهٔ حسابرسی.
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

import { handleExamApi } from './examApi.js';
import { __examTestHooks, __resetExamStore, verifyAuditChain } from './examStore.js';
import { USER_SESSION_COOKIE, createUserSession, destroyUserSession } from './userSessions.js';
import { findUserByPhone, publicUser, saveUser } from './usersStore.js';

const hooks = __examTestHooks();

const ORIGIN = 'http://localhost';
const results = [];

function check(name, condition) {
  results.push({ name, pass: Boolean(condition) });
}

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    headers,
    setHeader(name_, value) {
      headers.set(name_.toLowerCase(), value);
    },
    end(chunk) {
      this.body = chunk ?? '';
    },
  };
}

async function call(method, path, { body, cookies = {}, headers = {} } = {}) {
  const cookieHeader = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ');
  const request = {
    method,
    url: path,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      /* متدهای تغییردهنده طبق خط‌مشی API هدر امنیتی می‌خواهند */
      ...(method !== 'GET' && method !== 'HEAD' ? { 'x-tapesh-exam': '1' } : {}),
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, handler) {
      if (event === 'data' && body !== undefined) handler(Buffer.from(JSON.stringify(body)));
      if (event === 'end') handler();
      return this;
    },
  };

  const response = createResponse();
  const handled = await handleExamApi(request, response);
  let payload = null;
  try {
    payload = response.body ? JSON.parse(response.body) : null;
  } catch {
    payload = null;
  }
  return { handled, status: response.statusCode, payload, headers: response.headers };
}

/* کاربران موقت — پایان تست از users.json حذف می‌شوند */
function createTestUser(phone) {
  const existing = findUserByPhone(phone);
  if (existing) return existing;
  return saveUser({ phone, password: 'exam-test-pass-1', profile: { username: `t-${phone.slice(-4)}` } });
}

function deleteTestUser(phone) {
  const usersFile = new URL('./users.json', import.meta.url).pathname;
  try {
    const parsed = JSON.parse(readFileSync(usersFile, 'utf8'));
    parsed.users = (parsed.users ?? []).filter((user) => user.phone !== phone);
    writeFileSync(usersFile, JSON.stringify(parsed, null, 2), 'utf8');
  } catch {
    /* users.json نیست — مشکلی نیست */
  }
}

const userA = createTestUser('09120000101');
const userB = createTestUser('09120000102');
const sessionA = createUserSession(userA, { ip: '127.0.0.1', userAgent: 'exam-test' });
const sessionB = createUserSession(userB, { ip: '127.0.0.1', userAgent: 'exam-test' });
const cookieA = { [USER_SESSION_COOKIE]: sessionA.token };
const cookieB = { [USER_SESSION_COOKIE]: sessionB.token };

/* دادهٔ تمیز برای هر اجرا — فقط Attempt/گزارش/حسابرسی پاک می‌شوند */
__resetExamStore({ fullSeed: false });

const PHYSIO_SLUG = 'physio-heart-live-01';
const QUIZ_SLUG = 'daily-quiz';
const PHYSIO_ID = 'exam-physio-live-01';
const QUIZ_ID = 'exam-daily-quiz';

/* زمان‌های آزمون‌ها برای قطعیت تست دوباره لنگر می‌شوند */
hooks.reanchorExam(PHYSIO_ID);
hooks.reanchorExam(QUIZ_ID);

/* ── ۱. ساعت سرور عمومی است ── */
const serverTime = await call('GET', '/api/exams/server-time');
check('۱. GET server-time بدون احراز پاسخ ۲۰۰ با ساعت سرور می‌دهد',
  serverTime.status === 200 && Number.isFinite(serverTime.payload?.data?.serverTime));

/* ── ۲. فهرست آزمون عمومی؛ بدون درز دادهٔ ثبت‌نامی ── */
const examsList = await call('GET', '/api/exams');
const physioSummary = examsList.payload?.data?.exams?.find((exam) => exam.slug === PHYSIO_SLUG);
check('۲. فهرست آزمون بدون سشن ۲۰۰ است و فیلد ثبت‌نامی‌ها به بیرون درز نمی‌کند',
  examsList.status === 200 && physioSummary && !('registrations' in physioSummary));

/* ── ۳/۴. عملیات امنیتی بدون هویت رد می‌شود ── */
const anonRegister = await call('POST', `/api/exams/${PHYSIO_SLUG}/registration`);
check('۳. ثبت‌نام بدون سشن → ۴۰۱', anonRegister.status === 401);

const anonAttempt = await call('POST', `/api/exams/${PHYSIO_SLUG}/attempts`);
check('۴. شروع Attempt آزمون جدی بدون سشن → ۴۰۱', anonAttempt.status === 401);

/* ── ۵. متغیر بدون هدر امنیتی رد می‌شود (لایهٔ دوم CSRF) ── */
const noCsrf = await call('POST', `/api/exams/${PHYSIO_SLUG}/registration`, {
  cookies: cookieA,
  headers: { 'x-tapesh-exam': '' },
});
check('۵. درخواست تغییردهنده بدون هدر x-tapesh-exam → ۴۰۳', noCsrf.status === 403);

/* ── ۶. ثبت‌نام مجاز (ثبت‌نام دیرهنگام فعال است) ── */
const register = await call('POST', `/api/exams/${PHYSIO_SLUG}/registration`, { cookies: cookieA });
check('۶. ثبت‌نام کاربر واردشده در پنجرهٔ مجاز → ۲۰۰', register.status === 200 && register.payload?.data?.ok === true);

/* ── ۷. شروع Attempt: زمان پایان سرور، ID غیرترتیبی ── */
const attemptStart = await call('POST', `/api/exams/${PHYSIO_SLUG}/attempts`, { cookies: cookieA });
const attempt = attemptStart.payload?.data?.attempt;
check('۷. Attempt با endsAt سرور و ID تصادفی ۳۲کاراکتری ساخته می‌شود',
  attemptStart.status === 200
  && attempt?.endsAt > Date.now()
  && /^att-[0-9a-f]{32}$/.test(attempt?.id ?? ''));

/* ── ۸. تحویل سؤال بدون Attempt → رد ── */
const questionsNoAttempt = await call('GET', `/api/attempts/no-such-id/questions`, { cookies: cookieA });
check('۸. سؤال با Attempt ناموجود → ۴۰۴', questionsNoAttempt.status === 404);

/* ── ۹. تحویل سؤال sanitize است — هیچ کلید پاسخی عبور نمی‌کند ── */
const delivered = await call('GET', `/api/attempts/${attempt.id}/questions`, { cookies: cookieA });
const questions = delivered.payload?.data?.questions ?? [];
const leaked = questions.some((question) => 'correctAnswer' in question || 'explanation' in question || 'keyPoint' in question);
check('۹. سؤال‌های تحویلی فاقد correctAnswer/explanation/keyPoint هستند',
  delivered.status === 200 && questions.length === 8 && !leaked);

/* ── ۱۰. پاسخِ سؤال خارج از snapshot Attempt → رد (Cross-Exam) ── */
const crossExam = await call('PUT', `/api/attempts/${attempt.id}/answers`, {
  cookies: cookieA,
  body: { answers: { 'q-bio-01': { selected: 1 } } },
});
check('۱۰. پاسخ به سؤال آزمون دیگر → ۴۰۳', crossExam.status === 403);

/* ── ۱۱. گزینهٔ نامعتبر → رد ── */
const badOption = await call('PUT', `/api/attempts/${attempt.id}/answers`, {
  cookies: cookieA,
  body: { answers: { 'q-phys-01': { selected: 99 } } },
});
check('۱۱. شمارهٔ گزینهٔ خارج از محدوده → ۴۰۰', badOption.status === 400);

/* ── ۱۲. ثبت پاسخ معتبر ── */
const answerOk = await call('PUT', `/api/attempts/${attempt.id}/answers`, {
  cookies: cookieA,
  body: { answers: { 'q-phys-01': { selected: 1 }, 'q-phys-02': { selected: 0 } } },
});
check('۱۲. پاسخ معتبر ثبت و answeredAt سرور صادر می‌شود',
  answerOk.status === 200
  && answerOk.payload?.data?.attempt?.answers?.['q-phys-01']?.selected === 1
  && answerOk.payload?.data?.attempt?.answers?.['q-phys-01']?.answeredAt <= Date.now());

/* ── ۱۳. mass-assignment: تلاش برای تعیین status/score از کلاینت ── */
const massAssignment = await call('PUT', `/api/attempts/${attempt.id}/progress`, {
  cookies: cookieA,
  body: {
    marked: ['q-phys-03'],
    status: 'submitted',
    result: { percentage: 100, rank: 1 },
    score: 999,
    currentIndex: 2,
  },
});
const afterMass = massAssignment.payload?.data?.attempt;
check('۱۳. فیلدهای امنیتی ارسالی کلاینت نادیده گرفته می‌شوند؛ marked/currentIndex اعمال می‌شود',
  massAssignment.status === 200
  && afterMass?.status === 'in_progress'
  && afterMass?.result === null
  && afterMass?.currentIndex === 2
  && afterMass?.marked?.includes('q-phys-03'));

/* ── ۱۴. IDOR: Attempt کاربر دیگر برای کاربر B وجود ندارد ── */
const idor = await call('GET', `/api/attempts/${attempt.id}`, { cookies: cookieB });
check('۱۴. دسترسی کاربر B به Attempt کاربر A → ۴۰۴', idor.status === 404);

/* ── ۱۵. مرور قبل از شرکت → رد ── */
const reviewDenied = await call('GET', `/api/exams/${PHYSIO_SLUG}/questions/review`, { cookies: cookieB });
check('۱۵. مرور بدون Attempt تکمیل‌شده → ۴۰۳', reviewDenied.status === 403);

/* ── ۱۶. Submit: تصحیح سرور + Idempotency ── */
const submit = await call('POST', `/api/attempts/${attempt.id}/submit`, { cookies: cookieA, body: { reason: 'user' } });
const result = submit.payload?.data?.result;
check('۱۶. submit نتیجهٔ سرورمحور می‌سازد (۲ پاسخ درست، نمرهٔ منفی صفر تا اینجا)',
  submit.status === 200
  && result?.correct === 2
  && result?.percentage >= 0
  && typeof result?.rank === 'number');

const submitAgain = await call('POST', `/api/attempts/${attempt.id}/submit`, { cookies: cookieA, body: { reason: 'user' } });
check('۱۷. submit دوباره idempotent است: همان نتیجه، بدون تغییر',
  submitAgain.status === 200
  && submitAgain.payload?.data?.idempotent === true
  && submitAgain.payload?.data?.result?.percentage === result.percentage
  && submitAgain.payload?.data?.result?.attemptId === result.attemptId);

/* ── ۱۸. کارنامهٔ آزمون LIVE تا resultReleaseAt «پردازشی» است ── */
const resultGate = await call('GET', `/api/exams/${PHYSIO_SLUG}/result`, { cookies: cookieA });
check('۱۸. کارنامهٔ آزمون در حال برگزاری تا زمان انتشار → processing',
  resultGate.status === 200 && resultGate.payload?.data?.state === 'processing');

/* ── ۱۹. آزمونک مهمان: سشن ناشناس خودکار + کل مسیر ── */
const anonQuiz = await call('POST', `/api/exams/${QUIZ_SLUG}/attempts`, { body: {} });
const anonCookieHeader = anonQuiz.headers?.get?.('set-cookie') ?? '';
const anonToken = /tapesh_user_session=([0-9a-f]+)/.exec(anonCookieHeader)?.[1] ?? null;
const anonQuizAttempt = anonQuiz.payload?.data?.attempt;
check('۱۹. آزمونک برای مهمان سشن ناشناس کوکی‌محور می‌سازد',
  anonQuiz.status === 200 && Boolean(anonToken) && anonQuizAttempt?.id?.startsWith('att-'));

/* پاسخ‌های درست آزمونک از فایل سرور خوانده می‌شود (تست، نه کلاینت) */
const bankFile = JSON.parse(readFileSync(hooks.files.questions, 'utf8'));
const quizQuestions = bankFile.questions.filter((question) => question.examId === QUIZ_ID);
const correctDelta = Object.fromEntries(quizQuestions.map((question) => [question.id, { selected: question.correctAnswer }]));
const anonAnswers = await call('PUT', `/api/attempts/${anonQuizAttempt.id}/answers`, {
  cookies: { [USER_SESSION_COOKIE]: anonToken },
  body: { answers: correctDelta },
});
const anonSubmit = await call('POST', `/api/attempts/${anonQuizAttempt.id}/submit`, {
  cookies: { [USER_SESSION_COOKIE]: anonToken },
  body: { reason: 'user' },
});
check('۲۰. تصحیح سرور دترمنیستیک است: همهٔ پاسخ‌های درست → ۱۰۰٪',
  anonAnswers.status === 200 && anonSubmit.payload?.data?.result?.percentage === 100);

/* ── ۲۱. مرور بعد از submit شامل کلید پاسخ است (فقط برای صاحب Attempt) ── */
const review = await call('GET', `/api/exams/${QUIZ_SLUG}/questions/review`, { cookies: { [USER_SESSION_COOKIE]: anonToken } });
const reviewQuestions = review.payload?.data?.questions ?? [];
check('۲۱. مرور فقط برای شرکت‌کننده باز می‌شود و کلید پاسخ را دارد',
  review.status === 200
  && reviewQuestions.length === 5
  && reviewQuestions.every((question) => typeof question.correctAnswer === 'number'));

/* ── ۲۲. انقضا: پاسخ پس از endsAt رد و Attempt به timeout می‌رود ── */
const expiryStart = await call('POST', `/api/exams/${QUIZ_SLUG}/attempts`, { cookies: cookieA });
const expiryAttempt = expiryStart.payload?.data?.attempt;
const storeAttempt = hooks.getStore().attempts.find((row) => row.id === expiryAttempt.id);
storeAttempt.endsAt = Date.now() - 1000; /* شبیه‌سازی گذر زمان سرور */

const lateAnswer = await call('PUT', `/api/attempts/${expiryAttempt.id}/answers`, {
  cookies: cookieA,
  body: { answers: { [quizQuestions[0].id]: { selected: 0 } } },
});
check('۲۲. پاسخ پس از پایان زمان سرور → رد (time-over)', lateAnswer.status === 409);

const swept = await call('GET', `/api/attempts/${expiryAttempt.id}`, { cookies: cookieA });
check('۲۳. Attempt گذشته از مهلت با reason timeout نهایی شده است',
  swept.payload?.data?.attempt?.status === 'submitted' && swept.payload?.data?.attempt?.reason === 'timeout');

/* ── ۲۴. لغو پاسخ (null) — سؤال به حالت بی‌پاسخ برمی‌گردد ── */
const retryStart = await call('POST', `/api/exams/${QUIZ_SLUG}/attempts`, { cookies: cookieA });
const retryAttempt = retryStart.payload?.data?.attempt;
await call('PUT', `/api/attempts/${retryAttempt.id}/answers`, {
  cookies: cookieA,
  body: { answers: { [quizQuestions[0].id]: { selected: 2 } } },
});
const cleared = await call('PUT', `/api/attempts/${retryAttempt.id}/answers`, {
  cookies: cookieA,
  body: { answers: { [quizQuestions[0].id]: null } },
});
check('۲۴. ارسال null پاسخ را حذف می‌کند (سؤال بی‌پاسخ)',
  cleared.status === 200 && cleared.payload?.data?.attempt?.answers?.[quizQuestions[0].id] === undefined);

/* ── ۲۵. Rate limit شروع Attempt ── */
let rateLimited = false;
for (let index = 0; index < 14; index += 1) {
  const response = await call('POST', `/api/exams/${QUIZ_SLUG}/attempts`, { cookies: cookieA });
  if (response.status === 429) {
    rateLimited = true;
    break;
  }
}
check('۲۵. اسپم شروع Attempt به ۴۲۹ می‌خورد', rateLimited);

/* ── ۲۶. گزارش ایراد سؤال — append-only با هویت سرور ── */
const report = await call('POST', `/api/questions/${quizQuestions[0].id}/report`, {
  cookies: cookieA,
  body: { reason: 'پاسخ صحیح اشتباه است', note: 'تست خودکار', examId: QUIZ_ID, attemptId: retryAttempt.id },
});
check('۲۶. گزارش سؤال با هویت سرور ثبت می‌شود', report.status === 200 && report.payload?.data?.report?.userId === userA.id);

/* ── ۲۷. زنجیرهٔ حسابرسی دست‌نخورده است ── */
const chain = verifyAuditChain();
check('۲۷. زنجیرهٔ hash حسابرسی معتبر است', chain.valid === true && chain.seq > 0);

/* ── پاک‌سازی ── */
__resetExamStore({ fullSeed: false });
destroyUserSession(sessionA.token);
destroyUserSession(sessionB.token);
if (anonToken) destroyUserSession(anonToken);
deleteTestUser('09120000101');
deleteTestUser('09120000102');

console.log('\nنتیجهٔ تست امنیتی API آزمون:');
results.forEach((result_) => console.log(`  ${result_.pass ? '✓' : '✗'} ${result_.name}`));
console.log(`\n${results.filter((row) => row.pass).length}/${results.length} سنجه موفق\n`);

if (results.some((row) => !row.pass)) process.exitCode = 1;
