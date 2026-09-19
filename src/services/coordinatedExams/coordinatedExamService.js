/*
 * سرویس «آزمون‌های هماهنگ تپش» — نسخهٔ Server-Authoritative.
 *
 * نسخهٔ Mock/localStorage حذف شد: حالا هر تابع بدنهٔ خودش یک فراخوانی واقعی به
 * API سرور است (`database/examApi.js` ← `examStore.js`) و همان قراردادی که از
 * ابتدا در سربرگ این فایل مستند بود. امضای خروجی توابع عمداً حفظ شده تا UI
 * (ExamHub/ExamDetail/ExamRoom/ExamResult/ExamReview) بدون تغییر بماند.
 *
 * اصول امنیتی که این سرویس به آن‌ها پایبند است (سند امنیتی تپش):
 *  - هیچ State امنیتی در localStorage نیست؛ هویت از سشن کوکی HttpOnly سرور
 *    می‌آید و سرور مستقلاً مالکیت هر Attempt را چک می‌کند.
 *  - `endsAt` و وضعیت‌ها همگی از سرور می‌آیند؛ `getServerTime` فقط اختلاف ساعت
 *    سرور را (از `/api/exams/server-time`) روی ساعت محلی اعمال می‌کند.
 *  - کلید پاسخ هرگز از سرور به این لایه نمی‌رسد؛ تصحیح فقط با submit سمت سرور.
 *  - saveAttemptProgress فقط delta پاسخ‌ها را می‌فرستد و در قطعی شبکه در صف
 *    درون‌حافظه‌ای می‌ماند تا بعد از اتصال دوباره بفرستد (idempotency سمت سرور
 *    باعث می‌شود ارسال تکراری بی‌ضرر باشد). این صف «حقیقت» نیست؛ فقط بافر ارسال
 *    است — تا لحظهٔ تأیید سرور هیچ پاسخی ثبت‌شده محسوب نمی‌شود.
 */

const API_BASE = '/api/exams';
const SECURITY_HEADERS = { 'x-tapesh-exam': '1' };

/* ────────────────────────── زمان سرور ────────────────────────── */

/*
 * منبع واحد زمان برای Countdown و Timer. اختلاف ساعت با سرور (با جبران نصف RTT)
 * محاسبه و کش می‌شود؛ پیش از اولین sync صفر است و تایمر روی ساعت محلی می‌افتد —
 * فقط نمایش است؛ اعتبار زمانی همیشه در سرور بررسی می‌شود.
 */
let timeOffsetMs = 0;

export async function syncServerTime() {
  try {
    const startedAt = Date.now();
    const data = await examApi('/server-time');
    const rtt = Date.now() - startedAt;
    timeOffsetMs = data.serverTime - (startedAt + Math.min(rtt / 2, 5000));
  } catch {
    /* سرور در دسترس نیست — offset قبلی می‌ماند؛ اعتبار نهایی با سرور است */
  }
}

export function getServerTime() {
  return Date.now() + timeOffsetMs;
}

if (typeof window !== 'undefined') {
  setTimeout(syncServerTime, 0);
  setInterval(syncServerTime, 10 * 60 * 1000);
}

/* ────────────────────────── Transport ────────────────────────── */

async function examApi(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...SECURITY_HEADERS,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success !== true) {
    /* کد بیزینسی (reason) اولویت دارد تا UI مثل قبل روی 'not-registered' و… تصمیم بگیرد */
    const reason = payload?.error?.reason ?? payload?.error?.code ?? 'request-failed';
    throw new Error(reason);
  }

  return payload.data;
}

/* ────────────────────────── وضعیت آزمون (نمایشی) ────────────────────────── */

/*
 * برچسب وضعیت برای UI — صرفاً نمایشی و از فیلدهای سروری مشتق می‌شود.
 * تصمیم امنیتی (چه چیزی مجاز است) همیشه از `userState` سرور می‌آید.
 */
export function computeExamStatus(exam, now = getServerTime()) {
  if (exam.cancelled) return 'CANCELLED';
  if (exam.alwaysAvailable) return 'AVAILABLE';
  if (now >= exam.startTime && now <= exam.endTime) return 'LIVE';
  if (now > exam.endTime) {
    return exam.resultReleaseAt && now >= exam.resultReleaseAt ? 'RESULTS_AVAILABLE' : 'FINISHED';
  }
  if (exam.registrationDeadline && now >= exam.registrationDeadline) return 'REGISTRATION_CLOSED';
  if (exam.registrationOpenAt && now < exam.registrationOpenAt) return 'UPCOMING';
  return 'REGISTRATION_OPEN';
}

export const STATUS_META = {
  UPCOMING: { label: 'در انتظار برگزاری', accent: '#8a8a8a' },
  REGISTRATION_OPEN: { label: 'ثبت‌نام فعال', accent: '#61D192' },
  REGISTRATION_CLOSED: { label: 'ثبت‌نام بسته', accent: '#e0b45c' },
  LIVE: { label: 'در حال برگزاری', accent: '#e26d6d' },
  FINISHED: { label: 'پایان یافته', accent: '#8a8a8a' },
  RESULTS_AVAILABLE: { label: 'کارنامه آماده', accent: '#937fcd' },
  AVAILABLE: { label: 'آماده شروع', accent: '#61D192' },
  CANCELLED: { label: 'لغو شده', accent: '#e26d6d' },
};

export const TYPE_META = {
  national: { label: 'هماهنگ سراسری', accent: '#61D192' },
  comprehensive: { label: 'آزمون جامع', accent: '#937fcd' },
  subject: { label: 'آزمون موضوعی', accent: '#5b8cc7' },
  course: { label: 'آزمون درس', accent: '#77b787' },
  quiz: { label: 'آزمونک', accent: '#e0b45c' },
  occasion: { label: 'مناسبتی', accent: '#e26d6d' },
  mock: { label: 'آزمایشی', accent: '#b99a86' },
};

/* ────────────────────────── پاداش لیگ (نمایشی) ────────────────────────── */

/* همان فرمول سرور؛ سرور در پاسخ submit مقدار رسمی را می‌فرستد — اینجا فقط
 * برای مسیرهای نمایشی (کارنامهٔ ذخیره‌شده) دوباره محاسبه می‌شود. */
export function rewardOf(result, exam) {
  if (!result || !exam) return null;
  const base = exam.type === 'quiz' ? 5 : 10;
  const bonus = Math.round(result.percentage / 10);
  return { hearts: base + bonus, base, bonus };
}

/* ────────────────────────── API: محتوا ────────────────────────── */

/* GET /api/exams — خلاصهٔ همهٔ آزمون‌ها + وضعیت کاربر برای هرکدام (از سرور) */
export async function fetchExams(_userId) {
  const data = await examApi('');
  return data.exams ?? [];
}

/* GET /api/exams/:slug */
export async function fetchExam(slug, _userId) {
  return examApi(`/${encodeURIComponent(slug)}`);
}

/* ────────────────────────── API: ثبت‌نام ────────────────────────── */

/* POST /api/exams/:slug/registration */
export function registerUser(_userId, slug) {
  return examApi(`/${encodeURIComponent(slug)}/registration`, { method: 'POST' });
}

/* DELETE /api/exams/:slug/registration */
export function cancelRegistration(_userId, slug) {
  return examApi(`/${encodeURIComponent(slug)}/registration`, { method: 'DELETE' });
}

/* ────────────────────────── API: Attempt ────────────────────────── */

/*
 * POST /api/exams/:slug/attempts — زمان پایان (endsAt) صریحاً از سرور می‌آید.
 * دو بارکلیک/دو درخواست همزمان بی‌ضرر است: سرور همان Attempt باز قبلی را برمی‌گرداند.
 */
export function startAttempt(_userId, slug) {
  return examApi(`/${encodeURIComponent(slug)}/attempts`, { method: 'POST' });
}

/* GET /api/attempts/:id — برای Resume بعد از Refresh (مالکیت سرور چک می‌شود) */
export async function fetchAttempt(_userId, attemptId) {
  const data = await examApi(`/attempts/${encodeURIComponent(attemptId)}`);
  return data.attempt;
}

/* GET /api/attempts/active — آخرین Attempt در جریان؛ بازگشت خودکار بعد از Refresh */
export async function fetchActiveAttempt(_userId) {
  const data = await examApi('/attempts/active');
  return data.attempt;
}

/*
 * GET /api/attempts/:id/questions — تنها مسیر دریافت سؤال؛ سؤالِ بدون Attemptِ
 * فعال اصلاً از سرور بیرون نمی‌رود (ضد Enumeration و ضد لو رفتن قبل از شروع).
 */
export async function fetchAttemptQuestions(attemptId) {
  return examApi(`/attempts/${encodeURIComponent(attemptId)}/questions`);
}

/* ────────────────────────── ذخیرهٔ خودکار (autosave) ────────────────────────── */

/*
 * ادغام به‌جای جایگزینی — فقط delta پاسخ‌ها به سرور می‌رود (PUT /answers) و
 * وضعیت نمایشی (marked/currentIndex/subjectTab/exitedAt) جداگانه (PUT /progress).
 * در قطعی شبکه، deltaها در صف درون‌حافظه می‌مانند و در اولین فرصت دوباره
 * ارسال می‌شوند؛ ارسال تکراری سمت سرور idempotent است.
 */
const lastSynced = new Map(); // attemptId → { answers: {qid: selected}, marked: [], exitedAt }
let pendingOps = []; // [{ attemptId, delta, progress }]
let flushing = null;

function queueOp(op) {
  pendingOps.push(op);
}

async function flushQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    while (pendingOps.length) {
      const op = pendingOps[0];
      try {
        await sendOp(op);
        pendingOps.shift();
      } catch {
        break; /* هنوز آفلاینیم — برای دفعهٔ بعد می‌ماند */
      }
    }
  })();
  try {
    await flushing;
  } finally {
    flushing = null;
  }
}

function sendOp({ attemptId, delta, progress }) {
  if (delta && Object.keys(delta).length) {
    return examApi(`/attempts/${encodeURIComponent(attemptId)}/answers`, { method: 'PUT', body: { answers: delta } });
  }
  if (progress) {
    return examApi(`/attempts/${encodeURIComponent(attemptId)}/progress`, { method: 'PUT', body: progress });
  }
  return Promise.resolve();
}

/* snapshot انتخاب‌های سالم (nullها ذخیره نمی‌شوند تا دوباره ارسال نشوند) */
function snapshotOf(attempt) {
  const answers = {};
  for (const [questionId, value] of Object.entries(attempt.answers ?? {})) {
    const selected = value?.selected ?? null;
    if (selected !== null) answers[questionId] = selected;
  }
  return { answers, marked: [...(attempt.marked ?? [])], exitedAt: attempt.exitedAt ?? null };
}

export async function saveAttemptProgress(_userId, attempt) {
  const attemptId = attempt?.id;
  if (!attemptId) return attempt;

  await flushQueue();

  /* اولین sync برای هر Attempt از وضعیت خودِ سرور مقداردهی می‌شود تا resume
     باعث ارسال مجدد همهٔ پاسخ‌های قبلی نشود */
  const previous = lastSynced.get(attemptId) ?? snapshotOf(attempt);
  const current = attempt.answers ?? {};

  /* delta پاسخ‌ها — اضافه/تغییر/لغو (null) نسبت به آخرین sync موفق */
  const delta = {};
  for (const [questionId, value] of Object.entries(current)) {
    const selected = value?.selected ?? null;
    if (selected === null) {
      if (previous.answers[questionId] !== undefined) delta[questionId] = null;
      continue;
    }
    if (previous.answers[questionId] !== selected) delta[questionId] = { selected };
  }
  for (const [questionId, prevSelected] of Object.entries(previous.answers)) {
    if (!(questionId in current) && prevSelected !== undefined) delta[questionId] = null;
  }

  const markedChanged = JSON.stringify(previous.marked) !== JSON.stringify(attempt.marked ?? []);
  const exitedChanged = (attempt.exitedAt ?? null) !== previous.exitedAt;
  const progress = markedChanged || exitedChanged
    ? {
        marked: attempt.marked ?? [],
        ...(Number.isInteger(attempt.currentIndex) ? { currentIndex: attempt.currentIndex } : {}),
        ...(attempt.subjectTab != null ? { subjectTab: attempt.subjectTab } : {}),
        exitedAt: attempt.exitedAt ?? null,
      }
    : null;

  if ((delta && Object.keys(delta).length) || progress) {
    const op = { attemptId, delta, progress };
    try {
      await sendOp(op);
      lastSynced.set(attemptId, snapshotOf(attempt));
    } catch {
      /* آفلاین/خطا — در صف می‌ماند؛ هیچ State محلی «حقیقت» نمی‌شود */
      queueOp(op);
    }
  }

  return attempt;
}

/*
 * POST /api/attempts/:id/submit — تصحیح و صدور کارنامه کاملاً سمت سرور.
 * قبل از submit صف autosave تخلیه می‌شود تا آخرین پاسخ‌ها رسیده باشند.
 */
export async function submitAttempt(_userId, attemptId, { reason = 'user' } = {}) {
  await flushQueue();
  return examApi(`/attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', body: { reason } });
}

/* ────────────────────────── API: کارنامه و مرور ────────────────────────── */

/*
 * GET /api/exams/:slug/result — ماشین وضعیت صفحهٔ کارنامه:
 *   ready | processing | not_participated  (تصمیم با سرور)
 */
export function fetchResult(_userId, slug) {
  return examApi(`/${encodeURIComponent(slug)}/result`);
}

/* GET /api/exams/:slug/questions/review — کلید پاسخ فقط اینجا و فقط سرور تصمیم می‌گیرد */
export function fetchReviewQuestions(_userId, slug) {
  return examApi(`/${encodeURIComponent(slug)}/questions/review`);
}

/* POST /api/questions/:id/report — گزارش ایراد سؤال (Append-Only سمت سرور) */
export function reportQuestion(_userId, questionId, { reason, note = '', examId = null, attemptId = null } = {}) {
  return examApi(`/questions/${encodeURIComponent(questionId)}/report`, {
    method: 'POST',
    body: { reason, note, examId, attemptId },
  });
}

/* GET /api/exams/:slug/ranking — مقایسهٔ جامعه‌محور (فقط دادهٔ تجمیعی) */
export function fetchRanking(_userId, slug) {
  return examApi(`/${encodeURIComponent(slug)}/ranking`);
}

/* ────────────────────────── Analytics stub ────────────────────────── */

export function trackEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[exams:track] ${name}`, payload);
  }
}
