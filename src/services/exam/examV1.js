/*
 * پل موتور آزمون بین فرانت و v1 (فاز ۷).
 *
 * قرارداد v1:
 *   GET    /exams?kind&status&page&perPage          → { exams[], meta }
 *   GET    /exams/{idOrSlug}                        → { exam }
 *   GET    /exams/{idOrSlug}/ranking?limit          → { ranking }
 *   POST   /exams/{idOrSlug}/registrations          → { registration }
 *   DELETE /exams/{idOrSlug}/registrations          → { registration }
 *   POST   /exams/{idOrSlug}/attempts               → { attempt, resumed }
 *   GET    /exam-attempts/{id}                      → { attempt, questions[], answers[] }
 *   PUT    /exam-attempts/{id}/answers              → { answer }   body: { questionId, selectedOptionId, revision, timeSpent }
 *   POST   /exam-attempts/{id}/finish               → { attempt, result, result_released, idempotent }
 *   GET    /exam-attempts/{id}/result               → { result }
 *   GET    /exam-attempts/{id}/review               → { questions[] }
 *
 * ────────────────────────── دو ناسازگاری واقعی ──────────────────────────
 *
 * ۱. **هویت گزینه: اندیس در برابر UUID.**
 *    UI فعلی (`coordinatedExamService`) پاسخ را با **اندیس گزینه** نگه می‌دارد؛
 *    v1 `selected_option_id` یک **UUID درون Snapshot** است. اگر این نگاشت بی‌صدا
 *    اشتباه شود، کاربر پاسخ درست را می‌فرستد و نمرهٔ غلط می‌گیرد.
 *    این پل تنها جایی است که ترجمه انجام می‌شود: هر گزینه هم `id` (UUID) و هم
 *    `index` (۰-پایه، همان چیزی که UI می‌شناسد) دارد. `optionIdAt()` و
 *    `indexOfOptionId()` هرگز حدس نمی‌زنند — ورودی ناشناس ⇒ `null` / `-1`.
 *
 * ۲. **`revision` اجباری است (قفل خوش‌بینانه).**
 *    v1 برای هر نوشتن پاسخ `revision` می‌خواهد و **`0` یعنی «هنوز پاسخی ثبت
 *    نشده»**. اگر پل همیشه `0` بفرستد، هر ویرایش دوم ۴۰۹ می‌گیرد. پس `revision`
 *    از پاسخ خوانده‌شدهٔ سرور می‌آید و در `saveAnswers` مدیریت می‌شود.
 *
 * ────────────────────────── مرز کلید پاسخ ──────────────────────────
 *
 * `mapExamQuestion` **هیچ‌وقت** کلید را نمی‌سازد و استخراج نمی‌کند؛ در schema v1
 * هم اصلاً وجود ندارد. کلید فقط در `mapReviewQuestion` ظاهر می‌شود و آن هم پشت
 * چهار شرط سرور (انتشار نتیجه + قاعدهٔ آزمون + وضعیت `graded` + مالکیت).
 * `FORBIDDEN_KEY_FIELDS` فهرست نام‌هایی است که این پل هرگز مصرف نمی‌کند.
 *
 * ────────────────────────── شکاف‌های صریح با legacy ──────────────────────────
 *
 * - **`/api/exams/server-time` معادل v1 ندارد.** v1 زمان سرور را جدا برنمی‌گرداند.
 *   `deadline_at` از سرور می‌آید و مرجع نهایی هم سرور است؛ شمارش معکوس کلاینت
 *   فقط **نمایشی** است. `clockSkewMs()` اینجا `0` است و صریح علامت خورده تا کسی
 *   تصور نکند اختلاف ساعت جبران می‌شود.
 * - **پاداش/`reward` در v1 نیست** (XP فاز ۱۲/۱۴ است) ⇒ `rewardOf()` همیشه صفر.
 * - **`trackEvent` در v1 نیست** — هیچ ingestion رویداد کلاینت وجود ندارد.
 */

import { newRequestKey, v1Request } from '../api/v1';

/*
 * نام‌هایی که اگر روزی در پاسخ v1 ظاهر شوند، یعنی مرز کلید شکسته.
 * این پل هرگز آن‌ها را نمی‌خواند؛ فهرست فقط برای بازبینی قرارداد است.
 */
export const FORBIDDEN_KEY_FIELDS = [
  'key_snapshot_encrypted',
  'correct_option_id',
  'correctOptionId',
  'correct_answer',
  'correctAnswer',
  'answer_key',
  'answerKey',
  'explanation',
  'is_correct',
];

/* ────────────────────────── نگاشت گزینه و سؤال ────────────────────────── */

/*
 * گزینه: هم `id` (UUID درون Snapshot) و هم `index` (۰-پایه).
 * `index` از **ترتیب بازگشتی** سرور می‌آید، نه از `position` — تا اگر روزی
 * `position` ۱-پایه یا ناپیوسته شد، اندیس UI جابه‌جا نشود.
 */
function mapOption(option, index) {
  return {
    id: option?.id ?? null,
    index,
    position: Number(option?.position ?? index + 1),
    label: option?.label ?? '',
    body: option?.body ?? '',
  };
}

function mapOptions(options) {
  return (Array.isArray(options) ? options : []).map(mapOption);
}

/*
 * سؤال آزمون در حین شرکت.
 *
 * `examQuestionId` همان چیزی است که در `PUT /answers` به‌عنوان `questionId`
 * فرستاده می‌شود (`SaveExamAnswerRequest` صریحاً می‌گوید شناسهٔ سؤال **در این
 * آزمون**، نه شناسهٔ سؤال در بانک). `questionId` (بانک) فقط برای ارجاع نمایشی
 * و گزارش سؤال است.
 */
export function mapExamQuestion(row) {
  if (!row) return null;

  const options = mapOptions(row.options);

  return {
    examQuestionId: row.exam_question_id ?? null,
    questionId: row.question_id ?? null,
    position: Number(row.position ?? 0),
    stem: row.stem ?? '',
    figure: row.figure_key ?? null,
    type: row.type ?? null,
    difficulty: row.difficulty ?? null,
    subject: row.subject ?? null,
    topic: row.topic ?? null,
    options,
    optionTexts: options.map((option) => option.body),
    /* تعداد گزینه — UI برای چیدمان و کلید میان‌بر لازم دارد. */
    optionCount: options.length,
  };
}

/**
 * اندیس UI → UUID گزینه. ورودی نامعتبر ⇒ `null` (نه حدس، نه گزینهٔ اول).
 */
export function optionIdAt(question, index) {
  const option = question?.options?.[index];

  return option?.id ?? null;
}

/**
 * UUID گزینه → اندیس UI. پیدا نشد ⇒ `-1` (نه `0` که با «گزینهٔ اول» قاطی شود).
 */
export function indexOfOptionId(question, optionId) {
  if (optionId === null || optionId === undefined) return -1;

  return (question?.options ?? []).findIndex((option) => option.id === optionId);
}

/* ────────────────────────── نگاشت آزمون ────────────────────────── */

export function mapExam(row) {
  if (!row) return null;

  const state = row.user_state ?? {};

  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind ?? null,
    type: row.type ?? null,
    title: row.title ?? '',
    shortName: row.short_name ?? null,
    description: row.description ?? null,
    subject: row.subject ?? null,
    status: row.status ?? null,
    /* `phase` مرجع امنیتی سرور است؛ `uiStatus` همان برچسب نمایشی legacy. */
    phase: row.phase ?? null,
    uiStatus: row.phase ?? null,
    opensAt: row.opens_at ?? null,
    closesAt: row.closes_at ?? null,
    registrationOpensAt: row.registration_opens_at ?? null,
    registrationClosesAt: row.registration_closes_at ?? null,
    resultReleaseAt: row.result_release_at ?? null,
    durationMinutes: row.duration_minutes ?? null,
    graceSeconds: Number(row.grace_seconds ?? 0),
    attemptLimit: Number(row.attempt_limit ?? 1),
    negativeMarking: Number(row.negative_marking ?? 0),
    questionCount: Number(row.question_count ?? 0),
    /* قواعد غیر‌کوئری‌محور؛ تصمیم‌های امنیتی از ستون‌ها می‌آیند، نه از اینجا. */
    rules: row.rules ?? null,
    meta: row.meta ?? null,
    userState: {
      registered: state.registered === true,
      registeredAt: state.registered_at ?? null,
      canRegister: state.can_register === true,
      canCancelRegistration: state.can_cancel_registration === true,
      attemptsUsed: Number(state.attempts_used ?? 0),
      attemptLimit: Number(state.attempt_limit ?? row.attempt_limit ?? 1),
      canStart: state.can_start === true,
      activeAttemptId: state.active_attempt_id ?? null,
      lastAttemptId: state.last_attempt_id ?? null,
      resultReady: state.result_ready === true,
      hasParticipated: state.has_participated === true,
    },
  };
}

export function mapAttempt(row) {
  if (!row) return null;

  return {
    id: row.id,
    examId: row.exam_id ?? null,
    attemptNo: Number(row.attempt_no ?? 1),
    status: row.status ?? null,
    startedAt: row.started_at ?? null,
    deadlineAt: row.deadline_at ?? null,
    submittedAt: row.submitted_at ?? null,
    submitReason: row.submit_reason ?? null,
    answeredCount: Number(row.answered_count ?? 0),
    hasResult: row.has_result === true,
  };
}

/*
 * پاسخ ثبت‌شده. `selectedOptionId` یک UUID است ⇒ `selectedIndex` هم می‌دهیم تا
 * UI مجبور نشود خودش ترجمه کند. ترجمه فقط با فهرست گزینه‌های همان سؤال ممکن است،
 * پس `mapAnswer` فهرست را به‌عنوان پارامتر می‌گیرد و اگر نبود `null` می‌گذارد.
 */
export function mapAnswer(row, questions = []) {
  if (!row) return null;

  const question = questions.find((item) => item.examQuestionId === row.exam_question_id) ?? null;

  return {
    examQuestionId: row.exam_question_id ?? null,
    selectedOptionId: row.selected_option_id ?? null,
    selectedIndex: question ? indexOfOptionId(question, row.selected_option_id) : -1,
    /* `revision` را برای نوشتن بعدی برمی‌گردانیم — بدون آن هر ویرایش ۴۰۹ می‌گیرد. */
    revision: Number(row.revision ?? 0),
    answeredAt: row.answered_at ?? null,
  };
}

export function mapResult(row) {
  if (!row) return null;

  return {
    id: row.id,
    attemptId: row.attempt_id ?? null,
    examId: row.exam_id ?? null,
    submitReason: row.submit_reason ?? null,
    score: Number(row.score ?? 0),
    maxScore: Number(row.max_score ?? 0),
    percentage: Number(row.percentage ?? 0),
    correctCount: Number(row.correct_count ?? 0),
    wrongCount: Number(row.wrong_count ?? 0),
    blankCount: Number(row.blank_count ?? 0),
    negativeMarking: Number(row.negative_marking ?? 0),
    timeSpentSec: Number(row.time_spent_sec ?? 0),
    subjectBreakdown: row.subject_breakdown ?? [],
    /*
     * `teraz` عمداً محاسبه نمی‌شود (policy رسمی ندارد) و سرور `null` می‌دهد.
     * مقدار جایگزین نمی‌سازیم.
     */
    teraz: row.teraz ?? null,
    gradedAt: row.graded_at ?? null,
  };
}

/*
 * بازبینی — **تنها** جایی که کلید پاسخ از سرور می‌آید.
 * `correctIndex` همراه `correctOptionId` می‌آید تا UI برای نمایش نیازی به ترجمه
 * نداشته باشد. پر بودن این تابع به‌تنهایی یعنی سرور چهار شرط را تأیید کرده است.
 */
export function mapReviewQuestion(row) {
  if (!row) return null;

  const options = (Array.isArray(row.options) ? row.options : []).map((option, index) => ({
    ...mapOption(option, index),
    isCorrect: option?.is_correct === true,
    isSelected: option?.is_selected === true,
  }));

  const correctIndex = options.findIndex((option) => option.isCorrect);
  const selectedIndex = options.findIndex((option) => option.isSelected);

  return {
    examQuestionId: row.exam_question_id ?? null,
    position: Number(row.position ?? 0),
    stem: row.stem ?? '',
    figure: row.figure_key ?? null,
    subject: row.subject ?? null,
    topic: row.topic ?? null,
    options,
    optionTexts: options.map((option) => option.body),
    selectedOptionId: row.selected_option_id ?? null,
    selectedIndex,
    correctOptionId: row.correct_option_id ?? null,
    correctIndex,
    isCorrect: row.is_correct === true,
    explanation: row.explanation ?? null,
  };
}

export function mapRanking(row) {
  if (!row) return null;

  const me = row.me ?? null;

  return {
    examId: row.exam_id ?? null,
    participantsCount: Number(row.participants_count ?? 0),
    topPercent: Number(row.top_percent ?? 0),
    medianPercent: Number(row.median_percent ?? 0),
    averagePercent: Number(row.average_percent ?? 0),
    /*
     * `me` تهی یعنی کاربر در رتبه‌بندی نیست (شرکت نکرده یا نتیجه‌اش منتشر نشده).
     * عدد ساختگی نمی‌سازیم — UI باید حالت «رتبه‌ای نیست» را نشان دهد.
     */
    me: me
      ? {
          percentage: Number(me.percentage ?? 0),
          rank: Number(me.rank ?? 0),
          percentile: Number(me.percentile ?? 0),
        }
      : null,
  };
}

/* ────────────────────────── شکاف‌های صریح ────────────────────────── */

/*
 * v1 معادل `/api/exams/server-time` ندارد. این تابع صفر برمی‌گرداند تا هیچ
 * مصرف‌کننده‌ای خیال نکند اختلاف ساعت جبران شده است. اعتبار زمانی همیشه سمت
 * سرور بررسی می‌شود؛ این فقط برای Countdown نمایشی است.
 */
export const clockSkewMs = () => 0;

/* v1 هیچ پاداشی برای آزمون نمی‌دهد (XP فاز ۱۲/۱۴ است). */
export function rewardOf() {
  return { awarded: false, amount: 0 };
}

/* v1 ingestion رویداد کلاینت ندارد. */
export function trackEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[exam-v1:track] ${name}`, payload);
  }
}

/* ────────────────────────── خواندن ────────────────────────── */

function toQueryString(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }

  const text = search.toString();

  return text ? `?${text}` : '';
}

function failure(result) {
  return {
    ok: false,
    reason: result.reason,
    status: result.status,
    code: result.code ?? null,
    /* ۴۰۹ در آزمون سه معنا دارد (revision، idempotency، وضعیت بسته) ⇒ جدا می‌دهیم. */
    conflict: result.status === 409,
  };
}

export async function listExams({ kind = null, status = null, page = 1, perPage = null } = {}) {
  const result = await v1Request(`/exams${toQueryString({ kind, status, page, perPage })}`);

  if (!result.ok) return failure(result);

  return {
    ok: true,
    exams: (result.data?.exams ?? []).map(mapExam),
    pagination: {
      page: Number(result.meta?.page ?? page),
      perPage: Number(result.meta?.perPage ?? perPage ?? 0),
      total: Number(result.meta?.total ?? 0),
      lastPage: Number(result.meta?.lastPage ?? 1),
    },
  };
}

export async function fetchExam(idOrSlug) {
  const result = await v1Request(`/exams/${encodeURIComponent(idOrSlug)}`);

  if (!result.ok) return failure(result);

  return { ok: true, exam: mapExam(result.data?.exam) };
}

export async function fetchRanking(idOrSlug, { limit = null } = {}) {
  const result = await v1Request(`/exams/${encodeURIComponent(idOrSlug)}/ranking${toQueryString({ limit })}`);

  if (!result.ok) return failure(result);

  return { ok: true, ranking: mapRanking(result.data?.ranking) };
}

/* ────────────────────────── ثبت‌نام ────────────────────────── */

export async function registerExam(idOrSlug) {
  const result = await v1Request(`/exams/${encodeURIComponent(idOrSlug)}/registrations`, {
    method: 'POST',
    idempotencyKey: newRequestKey('exam-register'),
  });

  if (!result.ok) return failure(result);

  return { ok: true, registration: result.data?.registration ?? null };
}

export async function cancelRegistration(idOrSlug) {
  const result = await v1Request(`/exams/${encodeURIComponent(idOrSlug)}/registrations`, {
    method: 'DELETE',
    idempotencyKey: newRequestKey('exam-cancel'),
  });

  if (!result.ok) return failure(result);

  return { ok: true, registration: result.data?.registration ?? null };
}

/* ────────────────────────── Attempt ────────────────────────── */

/*
 * شروع Attempt. کلید idempotency یعنی دو بارکلیک یک Attempt می‌سازد؛ سرور
 * `resumed: true` برمی‌گرداند اگر Attempt باز موجود باشد.
 */
export async function startAttempt(idOrSlug, { requestKey = null } = {}) {
  const key = requestKey ?? newRequestKey('exam-start');

  const result = await v1Request(`/exams/${encodeURIComponent(idOrSlug)}/attempts`, {
    method: 'POST',
    idempotencyKey: key,
  });

  if (!result.ok) return failure(result);

  return {
    ok: true,
    attempt: mapAttempt(result.data?.attempt),
    /* `resumed` یعنی Attempt باز قبلی برگردانده شد، نه Attempt تازه. */
    resumed: result.data?.resumed === true,
  };
}

/**
 * خواندن Attempt همراه سؤال‌ها و پاسخ‌های ثبت‌شده.
 *
 * سؤال‌ها از Snapshot سرور می‌آیند و **هیچ کلیدی ندارند**. `revisionByQuestion`
 * خروجی، ورودی `saveAnswers` است.
 */
export async function fetchAttempt(attemptId) {
  const result = await v1Request(`/exam-attempts/${encodeURIComponent(attemptId)}`);

  if (!result.ok) return failure(result);

  const questions = (result.data?.questions ?? []).map(mapExamQuestion);
  const answers = (result.data?.answers ?? []).map((row) => mapAnswer(row, questions));

  const revisionByQuestion = {};
  for (const answer of answers) {
    if (answer.examQuestionId) revisionByQuestion[answer.examQuestionId] = answer.revision;
  }

  return {
    ok: true,
    attempt: mapAttempt(result.data?.attempt),
    questions,
    answers,
    revisionByQuestion,
  };
}

/**
 * نوشتن پاسخ‌ها — `PUT` با یک پاسخ در هر فراخوانی.
 *
 * `revision` از `revisionByQuestion` می‌آید و اگر نبود **`0`** است (قرارداد v1:
 * «هنوز پاسخی ثبت نشده»). `selectedIndex` (اندیس UI) به UUID ترجمه می‌شود؛ اگر
 * سؤال در فهرست نباشد یا اندیس نامعتبر باشد، **خطای صریح** برمی‌گردد و هیچ
 * درخواستی فرستاده نمی‌شود — سکوت اینجا یعنی نمرهٔ غلط.
 */
export async function saveAnswer(
  attemptId,
  question,
  { selectedIndex = null, revision = 0, timeSpent = null } = {},
) {
  if (!question?.examQuestionId) {
    return { ok: false, reason: 'local', code: 'UNKNOWN_QUESTION', conflict: false, status: 0 };
  }

  const selectedOptionId = selectedIndex === null ? null : optionIdAt(question, selectedIndex);

  if (selectedIndex !== null && selectedOptionId === null) {
    return { ok: false, reason: 'local', code: 'OPTION_NOT_IN_ATTEMPT', conflict: false, status: 0 };
  }

  const result = await v1Request(`/exam-attempts/${encodeURIComponent(attemptId)}/answers`, {
    method: 'PUT',
    body: {
      questionId: question.examQuestionId,
      selectedOptionId,
      revision: Number(revision ?? 0),
      timeSpent,
    },
  });

  if (!result.ok) return failure(result);

  const answer = mapAnswer(result.data?.answer ?? result.data, [question]);

  return { ok: true, answer };
}

/**
 * فرستادن چند پاسخ پشت سر هم.
 *
 * اگر یکی ۴۰۹ `REVISION_CONFLICT` بگیرد، **متوقف می‌شویم** و وضعیت را برمی‌گردانیم؛
 * ادامه‌دادن با `revision` کهنه فقط ۴۰۹ بیشتری تولید می‌کند. مصرف‌کننده باید
 * `fetchAttempt` را دوباره صدا بزند و `revisionByQuestion` تازه بگیرد.
 */
export async function saveAnswers(attemptId, entries) {
  const saved = [];
  const conflicts = [];

  for (const entry of entries) {
    const result = await saveAnswer(attemptId, entry.question, entry);

    if (!result.ok) {
      if (result.conflict) conflicts.push(entry.question?.examQuestionId ?? null);

      return { ok: false, saved, conflicts, reason: result.reason, status: result.status, code: result.code ?? null };
    }

    saved.push(result.answer);
  }

  return { ok: true, saved, conflicts: [] };
}

/*
 * پایان Attempt.
 *
 * `reason` **فرستاده نمی‌شود** — سرور آن را از ساعت خودش مشتق می‌کند
 * (`user`/`grace`/`timeout`). کلاینت نمی‌تواند بگوید «زمانم تمام شد».
 * `resultReleased` جدا برمی‌گردد: اگر `false` باشد، نتیجه وجود دارد ولی هنوز
 * قابل افشا نیست و UI نباید آن را نشان دهد.
 */
export async function finishAttempt(attemptId, { requestKey = null } = {}) {
  const result = await v1Request(`/exam-attempts/${encodeURIComponent(attemptId)}/finish`, {
    method: 'POST',
    idempotencyKey: requestKey ?? newRequestKey('exam-finish'),
  });

  if (!result.ok) return failure(result);

  return {
    ok: true,
    attempt: mapAttempt(result.data?.attempt),
    result: mapResult(result.data?.result),
    resultReleased: result.data?.result_released === true,
    /* بازپخش: پایان دوم رکورد تازه نمی‌سازد. */
    idempotent: result.data?.idempotent === true,
  };
}

/**
 * نتیجه — فقط اگر سرور منتشر کرده باشد. پیش از `result_release_at` سرور خطا
 * می‌دهد و این پل آن را به `ok: false` تبدیل می‌کند، نه به نتیجهٔ خالی.
 */
export async function fetchResult(attemptId) {
  const result = await v1Request(`/exam-attempts/${encodeURIComponent(attemptId)}/result`);

  if (!result.ok) return failure(result);

  return { ok: true, result: mapResult(result.data?.result) };
}

/* بازبینی — تنها مسیرِ کلید پاسخ. پشت چهار شرط سرور. */
export async function fetchReview(attemptId) {
  const result = await v1Request(`/exam-attempts/${encodeURIComponent(attemptId)}/review`);

  if (!result.ok) return failure(result);

  return { ok: true, questions: (result.data?.questions ?? []).map(mapReviewQuestion) };
}
