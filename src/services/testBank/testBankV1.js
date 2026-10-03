/*
 * پل بانک سؤال بین فرانت و v1 (فاز ۶).
 *
 * قرارداد v1:
 *   GET  /questions?subject&topic&chapter&lesson&difficulty&type&source&track&year&q&sort&page&perPage
 *   GET  /questions/{id}
 *   POST /questions/{id}/answers          → { attempt: { attempt_id, is_correct, reveal, reward, ... } }
 *   POST /questions/{id}/reports          → { report }
 *   POST /bank/sessions                   → { bank_session: { session_id, mode, expires_at, questions[] } }
 *   GET  /bank/sessions/{id}              → { bank_session: ... }
 *
 * **کلید پاسخ هرگز در پاسخ‌های خواندنی نیست.** `reveal` فقط پس از ثبت پاسخ و
 * فقط برای همان سؤال برمی‌گردد. این پل هیچ‌جا کلید را از `question` استخراج
 * نمی‌کند و نمی‌سازد.
 *
 * سه ناسازگاری واقعی که اینجا صریح مدیریت می‌شوند (نه بی‌صدا):
 *   ۱. v1 هر فیلتر را **تک‌مقداری** می‌گیرد (`subject` یک slug، `difficulty` یک
 *      مقدار) ولی UI چندانتخابی است ⇒ مقادیر اضافی در `unsupported` گزارش می‌شوند.
 *   ۲. `topic` در v1 یک **slug** است، ولی UI عنوان مسیر می‌فرستد ⇒ نگاشت از روی
 *      مسیر موضوع در `topicSlug()`.
 *   ۳. `stats` (تعداد حل‌ها/درصد پاسخ صحیح/میانگین زمان) در v1 **عمومی نیست** —
 *      چون توزیع پاسخ‌ها خودش کلید را لو می‌دهد. `stats` با مقادیر «ناموجود»
 *      برمی‌گردد تا ویجت آمار خودش را پنهان کند، نه اینکه عدد ساختگی ببیند.
 */

import { newRequestKey, v1Request } from '../api/v1';

/* ────────────────────────── نگاشت سؤال ────────────────────────── */

/*
 * شکلی که UI انتظار دارد (هم‌شکل mock فعلی) تا هیچ کامپوننتی عوض نشود.
 * `tags` خالی می‌ماند: v1 در فاز ۶ برچسب عمومی ندارد (بدون مصرف‌کنندهٔ واقعی).
 */
function mapOption(option) {
  return {
    id: option.id ?? null,
    position: Number(option.position ?? 0),
    label: option.label ?? '',
    body: option.body ?? '',
  };
}

export function mapQuestion(row) {
  if (!row) return null;

  return {
    id: row.id,
    track: row.track ?? null,
    subject: row.subject?.slug ?? null,
    subjectId: row.subject?.id ?? null,
    subjectTitle: row.subject?.title ?? null,
    /* v1 فقط برگ موضوع را در resource عمومی می‌دهد ⇒ مسیر یک‌عضو دارد. */
    topicPath: row.topic ? [row.topic.title] : [],
    topic: row.topic ? { id: row.topic.id, slug: row.topic.slug, title: row.topic.title } : null,
    type: row.type ?? null,
    difficulty: row.difficulty ?? null,
    year: row.year ?? null,
    examMonth: row.exam_month ?? null,
    source: row.source ?? null,
    tags: [],
    stem: row.stem ?? '',
    figure: row.figure_key ?? null,
    /* گزینه‌ها هم شکل رشته‌ای (mock) و هم شیئی (v1) را نگه می‌دارند. */
    options: (row.options ?? []).map(mapOption),
    optionTexts: (row.options ?? []).map((option) => option.body ?? ''),
    /* توزیع پاسخ عمومی نیست — `solves: 0` یعنی «نمایش نده». */
    stats: { solves: 0, correctPercent: null, avgTimeSec: null },
  };
}

/* ────────────────────────── فیلترها ────────────────────────── */

/*
 * «نوع بانک» به `source` نگاشت می‌شود چون v1 مفهوم bankKind ندارد و این دو
 * دقیقاً روی همان منابع منطبق‌اند (کشوری = رسمی/جامع، تألیفی = تپش).
 */
const BANK_KIND_SOURCES = {
  national: ['official', 'comprehensive'],
  authored: ['tapesh'],
};

const SINGLE = (values, name, unsupported) => {
  const list = Array.isArray(values) ? values : [];

  if (list.length > 1) unsupported.push(`${name} (تک‌مقداری)`);

  return list.length ? list[0] : null;
};

/**
 * فیلتر UI → query params مجاز v1.
 *
 * خروجی: `{ query, unsupported }` — `unsupported` فیلترهایی هستند که v1 نمی‌تواند
 * بیان کند. صدا زننده باید آن‌ها را به کاربر نشان دهد یا آگاهانه نادیده بگیرد؛
 * این تابع هیچ‌وقت بی‌صدا چیزی را حذف نمی‌کند.
 */
export function buildQuestionQuery(filters = {}) {
  const unsupported = [];
  const query = {};

  const bankKinds = filters.bankKinds ?? [];
  if (bankKinds.length === 1) {
    const sources = BANK_KIND_SOURCES[bankKinds[0]] ?? [];
    if (sources.length === 1) query.source = sources[0];
    else unsupported.push('bankKinds (چند منبع)');
  } else if (bankKinds.length > 1) {
    unsupported.push('bankKinds');
  }

  const subject = SINGLE(filters.subjectIds, 'subjectIds', unsupported);
  if (subject) query.subject = subject;

  const track = SINGLE(filters.tracks, 'tracks', unsupported);
  if (track) query.track = track;

  const difficulty = SINGLE(filters.difficulties, 'difficulties', unsupported);
  if (difficulty) query.difficulty = difficulty;

  const type = SINGLE(filters.types, 'types', unsupported);
  if (type) query.type = type;

  const source = SINGLE(filters.sources, 'sources', unsupported);
  if (source) query.source = source;

  const topic = SINGLE(filters.topicPaths, 'topicPaths', unsupported);
  if (topic) {
    const slug = topicSlug(topic);
    if (slug) query.topic = slug;
    else unsupported.push('topicPaths (عنوان بدون slug)');
  }

  /* v1 فقط یک `year` دارد، نه بازه. */
  if (filters.yearFrom || filters.yearTo) unsupported.push('yearFrom/yearTo');

  /* برچسب و وضعیت حل‌شده در v1 وجود ندارند. */
  if ((filters.tags ?? []).length) unsupported.push('tags');
  if (filters.status) unsupported.push('status');

  const search = (filters.search ?? '').trim();
  if (search) query.q = search;

  return { query, unsupported };
}

/* عنوان فارسی موضوع → slug لاتین. اگر عنوان ناشناس باشد، `null` (نه حدس). */
const TOPIC_SLUGS = {
  'قلب و عروق': 'cardiovascular',
  ECG: 'ecg',
  'چرخهٔ قلبی': 'cardiac-cycle',
};

export function topicSlug(title) {
  if (typeof title !== 'string') return null;

  return TOPIC_SLUGS[title] ?? null;
}

function toQueryString(query, extra = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...query, ...extra })) {
    if (value === null || value === undefined || value === '') continue;
    params.set(key, String(value));
  }

  const text = params.toString();

  return text ? `?${text}` : '';
}

/* ────────────────────────── خواندن ────────────────────────── */

/** فهرست سؤال‌های منتشرشده. صفحه‌بندی v1: `page`/`perPage` (سقف در config سرور). */
export async function listQuestions({ filters = {}, page = 1, perPage = null, sort = null } = {}) {
  const { query, unsupported } = buildQuestionQuery(filters);

  const result = await v1Request(`/questions${toQueryString(query, { page, perPage, sort })}`);

  if (!result.ok) {
    return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null, unsupported };
  }

  return {
    ok: true,
    unsupported,
    questions: (result.data?.questions ?? []).map(mapQuestion),
    pagination: {
      page: Number(result.meta?.page ?? page),
      perPage: Number(result.meta?.perPage ?? perPage ?? 0),
      total: Number(result.meta?.total ?? 0),
      lastPage: Number(result.meta?.lastPage ?? 1),
    },
  };
}

export async function fetchQuestion(questionId) {
  const result = await v1Request(`/questions/${encodeURIComponent(questionId)}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, question: mapQuestion(result.data?.question) };
}

/* ────────────────────────── پاسخ ────────────────────────── */

/**
 * ثبت پاسخ. کلاینت **فقط** گزینهٔ انتخابی را می‌فرستد.
 *
 * `isCorrect`/`score`/`reward` از بدنه خوانده نمی‌شوند و نمی‌توانند تعیین شوند.
 * `attemptKey` همان idempotency است: double-click یا retry شبکه دو تلاش نمی‌سازد
 * (بازپخش، `status` را ۲۰۰ می‌کند). همان کلید با payload متفاوت ⇒ ۴۰۹.
 */
export async function answerQuestion(questionId, { selectedOptionId = null, attemptKey } = {}) {
  const result = await v1Request(`/questions/${encodeURIComponent(questionId)}/answers`, {
    method: 'POST',
    body: { selectedOptionId, attemptKey: attemptKey ?? newRequestKey('answer') },
    idempotencyKey: attemptKey ?? null,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      conflict: result.status === 409,
    };
  }

  const attempt = result.data?.attempt ?? {};

  return {
    ok: true,
    attemptId: attempt.attempt_id ?? null,
    questionId: attempt.question_id ?? null,
    questionVersion: Number(attempt.question_version ?? 0),
    selectedOptionId: attempt.selected_option_id ?? null,
    isCorrect: attempt.is_correct === true,
    answeredAt: attempt.answered_at ?? null,
    reward: {
      awarded: attempt.reward?.awarded === true,
      amount: Number(attempt.reward?.amount ?? 0),
    },
    /* `reveal` فقط پس از ثبت موفق و اگر محصول اجازه بدهد پر است. */
    reveal: attempt.reveal
      ? { correctOptionId: attempt.reveal.correct_option_id ?? null, explanation: attempt.reveal.explanation ?? null }
      : null,
  };
}

/* ────────────────────────── گزارش سؤال ────────────────────────── */

/*
 * برچسب‌های UI به پنج دستهٔ canonical v1 نگاشت می‌شوند. هر برچسبی که معادل
 * صریح ندارد به `other` می‌رود — هیچ دستهٔ ساختگی و هیچ نگاشت حدسی‌ای نیست.
 */
export const REPORT_KIND_BY_LABEL = {
  'ایراد علمی': 'error',
  'ایراد نگارشی': 'typo',
  'گزینه‌های مبهم': 'ambiguity',
  'تصویر مشکل دارد': 'other',
  'پاسخ اشتباه': 'wrong_answer',
  سایر: 'other',
  'پاسخ صحیح اشتباه به نظر می‌رسد': 'wrong_answer',
  'توضیح ناقص یا نادرست است': 'error',
  'متن سؤال مبهم است': 'ambiguity',
  'مشکل در ترجمهٔ فارسی': 'typo',
  'مشکل فنی در نمایش': 'other',
};

export const reportKindFor = (label) => REPORT_KIND_BY_LABEL[label] ?? 'other';

export async function reportQuestion(questionId, { reason, note = '' } = {}) {
  const result = await v1Request(`/questions/${encodeURIComponent(questionId)}/reports`, {
    method: 'POST',
    body: { kind: reportKindFor(reason), body: note || null },
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, report: result.data?.report ?? null };
}

/* ────────────────────────── Bank Session ────────────────────────── */

/*
 * انتخاب سؤال **سمت سرور** است. کلاینت فقط فیلتر و تعداد می‌فرستد؛ فهرست
 * شناسهٔ دلخواه پذیرفته نمی‌شود (v1 `questionIds` را رد می‌کند).
 */
export async function startBankSession({ filters = {}, count = null, mode = 'practice' } = {}) {
  const { query, unsupported } = buildQuestionQuery(filters);

  const result = await v1Request('/bank/sessions', {
    method: 'POST',
    body: { filters: query, count, mode },
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null, unsupported };
  }

  return { ok: true, unsupported, session: mapBankSession(result.data?.bank_session) };
}

export async function fetchBankSession(sessionId) {
  const result = await v1Request(`/bank/sessions/${encodeURIComponent(sessionId)}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, session: mapBankSession(result.data?.bank_session) };
}

function mapBankSession(session) {
  if (!session) return null;

  return {
    sessionId: session.session_id ?? null,
    mode: session.mode ?? null,
    expiresAt: session.expires_at ?? null,
    questions: (session.questions ?? []).map(mapQuestion),
  };
}
