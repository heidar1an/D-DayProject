/* به‌روزرسانی docs/openapi.v1.json با مسیرها و schemaهای فاز ۷ و ۸.
   اجرا: node scripts/…  — یک‌بارمصرف. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const file = path.join(__dirname, '..', 'docs', 'openapi.v1.json');
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));

const uuid = { type: 'string', format: 'uuid' };
const uuidNullable = { type: 'string', format: 'uuid', nullable: true };
const dateTime = { type: 'string', format: 'date-time', nullable: true };

const okHeaders = { 'X-Request-Id': { $ref: '#/components/headers/RequestId' } };

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const envelope = (dataProperties) => ({
  type: 'object',
  properties: {
    data: { type: 'object', properties: dataProperties },
    requestId: { type: 'string' },
  },
});

const json = (schema) => ({ 'application/json': { schema } });

const pathParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description,
});

const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  schema: { type: 'string', maxLength: 96 },
};

const session = [{ sessionCookie: [] }];

/* ─────────────────────────── schemaها ─────────────────────────── */

Object.assign(spec.components.schemas, {
  Exam: {
    type: 'object',
    description:
      'شکل عمومی آزمون. `rules` فقط زیرمجموعهٔ امن است (`deadline_mode` و وضعیت guest بیرون می‌مانند). هیچ سؤال یا کلیدی اینجا نیست.',
    properties: {
      id: uuid,
      slug: { type: 'string' },
      kind: { type: 'string', enum: ['quiz', 'personal', 'coordinated', 'international'] },
      type: { type: 'string', nullable: true, description: 'برچسب نمایشی legacy' },
      title: { type: 'string' },
      short_name: { type: 'string', nullable: true },
      description: { type: 'string', nullable: true },
      subject: {
        type: 'object',
        nullable: true,
        properties: { id: uuid, slug: { type: 'string' }, title: { type: 'string' } },
      },
      status: { type: 'string', enum: ['draft', 'scheduled', 'open', 'closed', 'archived'] },
      phase: {
        type: 'string',
        enum: ['DRAFT', 'ARCHIVED', 'SCHEDULED', 'LIVE', 'GRACE', 'FINISHED', 'RESULTS', 'AVAILABLE'],
        description: 'از ساعت سرور مشتق می‌شود؛ تنها مرجع تصمیم امنیتی.',
      },
      opens_at: dateTime,
      closes_at: dateTime,
      registration_opens_at: dateTime,
      registration_closes_at: dateTime,
      result_release_at: dateTime,
      duration_minutes: { type: 'integer' },
      grace_seconds: { type: 'integer' },
      attempt_limit: { type: 'integer' },
      negative_marking: { type: 'number' },
      question_count: { type: 'integer' },
      rules: {
        type: 'object',
        properties: {
          allow_review: { type: 'boolean' },
          allow_answer_change: { type: 'boolean' },
          allow_back_navigation: { type: 'boolean' },
          allow_marking: { type: 'boolean' },
        },
      },
      meta: { type: 'object', nullable: true, additionalProperties: true },
      user_state: {
        type: 'object',
        properties: {
          registered: { type: 'boolean' },
          registered_at: dateTime,
          can_register: { type: 'boolean' },
          can_cancel_registration: { type: 'boolean' },
          attempts_used: { type: 'integer' },
          attempt_limit: { type: 'integer' },
          can_start: { type: 'boolean' },
          active_attempt_id: uuidNullable,
          last_attempt_id: uuidNullable,
          result_ready: { type: 'boolean' },
          has_participated: { type: 'boolean' },
        },
      },
    },
  },

  ExamQuestion: {
    type: 'object',
    description:
      'سؤال snapshotشده. **کلید پاسخ هرگز اینجا نیست** — نه `correct_option_id`، نه `explanation`. گزینه‌ها شناسهٔ درون‌snapshot دارند.',
    properties: {
      exam_question_id: uuid,
      position: { type: 'integer' },
      question_id: uuidNullable,
      stem: { type: 'string' },
      figure_key: { type: 'string', nullable: true },
      type: { type: 'string', nullable: true },
      difficulty: { type: 'string', nullable: true },
      subject: { type: 'object', nullable: true, additionalProperties: true },
      topic: { type: 'object', nullable: true, additionalProperties: true },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: uuid,
            position: { type: 'integer' },
            label: { type: 'string', nullable: true },
            body: { type: 'string' },
          },
        },
      },
    },
  },

  ExamAttempt: {
    type: 'object',
    description:
      '`deadline_at` تنها از ساعت سرور محاسبه می‌شود. `user_id`, `submit_key` و `version` عمداً افشا نمی‌شوند.',
    properties: {
      id: uuid,
      exam_id: uuid,
      attempt_no: { type: 'integer' },
      status: { type: 'string', enum: ['in_progress', 'graded', 'expired'] },
      started_at: dateTime,
      deadline_at: dateTime,
      submitted_at: dateTime,
      submit_reason: { type: 'string', nullable: true, enum: ['user', 'auto', 'grace', 'timeout', null] },
      answered_count: { type: 'integer' },
      has_result: { type: 'boolean' },
    },
  },

  ExamAnswer: {
    type: 'object',
    description:
      '`is_correct` عمداً وجود ندارد: درستی پاسخ بخشی از کارنامه است و تا انتشار نباید درز کند.',
    properties: {
      exam_question_id: uuid,
      selected_option_id: uuidNullable,
      revision: { type: 'integer' },
      answered_at: dateTime,
    },
  },

  ExamResult: {
    type: 'object',
    description:
      'همهٔ اعداد **سرور-مشتق**. `teraz` عمداً `null` است (فرمول legacy دموی بود و policy رسمی ندارد). `community` وجود ندارد — توزیع مصنوعی بازتولید نشده.',
    properties: {
      id: uuid,
      attempt_id: uuid,
      exam_id: uuid,
      submit_reason: { type: 'string', nullable: true },
      score: { type: 'number' },
      max_score: { type: 'number' },
      percentage: { type: 'number' },
      correct_count: { type: 'integer' },
      wrong_count: { type: 'integer' },
      blank_count: { type: 'integer' },
      negative_marking: { type: 'number' },
      time_spent_sec: { type: 'integer' },
      subject_breakdown: { type: 'array', items: { type: 'object', additionalProperties: true } },
      teraz: { type: 'number', nullable: true },
      graded_at: dateTime,
    },
  },

  ExamReviewQuestion: {
    type: 'object',
    description:
      '**تنها جایی که کلید پاسخ از سرور بیرون می‌رود.** پیش‌شرط‌ها: نتیجه منتشر شده، `rules.allow_review` روشن، Attempt تمام‌شده و متعلق به همین کاربر.',
    properties: {
      exam_question_id: uuid,
      position: { type: 'integer' },
      stem: { type: 'string' },
      figure_key: { type: 'string', nullable: true },
      subject: { type: 'object', nullable: true, additionalProperties: true },
      topic: { type: 'object', nullable: true, additionalProperties: true },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: uuid,
            position: { type: 'integer' },
            label: { type: 'string', nullable: true },
            body: { type: 'string' },
            is_correct: { type: 'boolean' },
            is_selected: { type: 'boolean' },
          },
        },
      },
      selected_option_id: uuidNullable,
      correct_option_id: uuidNullable,
      is_correct: { type: 'boolean' },
      explanation: { type: 'object', nullable: true, additionalProperties: true },
    },
  },

  ExamRanking: {
    type: 'object',
    description:
      'تجمیع + رتبهٔ خودِ کاربر، **بدون هیچ PII**. هیچ فهرست شرکت‌کننده‌ای برنمی‌گردد. منبع: فقط `exam_results` آزمون‌های منتشرشده.',
    properties: {
      exam_id: uuid,
      participants_count: { type: 'integer' },
      top_percent: { type: 'integer' },
      median_percent: { type: 'integer' },
      average_percent: { type: 'number' },
      me: {
        type: 'object',
        nullable: true,
        properties: {
          percentage: { type: 'number' },
          rank: { type: 'integer' },
          percentile: { type: 'integer', description: 'فرمول legacy: (تعداد − رتبه) / تعداد' },
        },
      },
    },
  },

  AnalyticsOverview: {
    type: 'object',
    description:
      'هر عدد منبع مستقل خودش را دارد. **`study_seconds` و `reading_seconds` هرگز جمع نمی‌شوند.** `questions.accuracy` فقط از `question_attempts` است و `exam_answers` در مخرجش نمی‌آید.',
    properties: {
      study: {
        type: 'object',
        properties: {
          study_seconds: { type: 'integer', description: 'Σ study_sessions.duration_sec' },
          reading_seconds: { type: 'integer', description: 'Σ learning_progress.seconds_spent' },
          study_sessions: { type: 'integer' },
          tracked_pages: { type: 'integer' },
        },
      },
      learning: {
        type: 'object',
        properties: {
          completed_pages: { type: 'integer' },
          completed_lessons: { type: 'integer', description: 'درسِ یکتا با حداقل یک صفحهٔ تکمیل‌شده' },
        },
      },
      questions: {
        type: 'object',
        properties: {
          answered: { type: 'integer' },
          correct: { type: 'integer' },
          wrong: { type: 'integer' },
          accuracy: { type: 'number' },
        },
      },
      exams: {
        type: 'object',
        properties: {
          attempts: { type: 'integer' },
          graded: { type: 'integer', description: 'فقط نتایج منتشرشده' },
          average_score: { type: 'number' },
          highest_score: { type: 'number' },
        },
      },
      recent_activity: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            event_type: { type: 'string' },
            occurred_at: { type: 'string' },
            properties: { type: 'object', nullable: true, additionalProperties: true },
          },
        },
      },
    },
  },

  TopicAnalytics: {
    type: 'object',
    description: 'از `question_attempts` واقعی. **`exam_answers` اینجا نمی‌آید.**',
    properties: {
      topics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic_id: uuidNullable,
            topic_slug: { type: 'string', nullable: true },
            topic_title: { type: 'string' },
            subject_slug: { type: 'string', nullable: true },
            subject_title: { type: 'string', nullable: true },
            attempts: { type: 'integer' },
            correct: { type: 'integer' },
            wrong: { type: 'integer' },
            accuracy: { type: 'number' },
          },
        },
      },
      totals: {
        type: 'object',
        properties: {
          topics: { type: 'integer' },
          attempts: { type: 'integer' },
          correct: { type: 'integer' },
          accuracy: { type: 'number' },
        },
      },
    },
  },

  ExamAnalytics: {
    type: 'object',
    description:
      'دقت آزمون = `correct / (correct + wrong + blank)` از `exam_results` منتشرشده. `question_attempts` در این مخرج نمی‌آید.',
    properties: {
      totals: {
        type: 'object',
        properties: {
          attempts: { type: 'integer' },
          graded: { type: 'integer' },
          average_score: { type: 'number' },
          highest_score: { type: 'number' },
          accuracy: { type: 'number' },
        },
      },
      subjects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            total: { type: 'integer' },
            correct: { type: 'integer' },
            wrong: { type: 'integer' },
            blank: { type: 'integer' },
            accuracy: { type: 'number' },
          },
        },
      },
      recent: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            result_id: uuid,
            exam_id: uuid,
            exam_slug: { type: 'string' },
            exam_title: { type: 'string' },
            percentage: { type: 'number' },
            correct_count: { type: 'integer' },
            wrong_count: { type: 'integer' },
            blank_count: { type: 'integer' },
            time_spent_sec: { type: 'integer' },
            submit_reason: { type: 'string', nullable: true },
            graded_at: { type: 'string' },
          },
        },
      },
    },
  },

  ProgressAnalytics: {
    type: 'object',
    description:
      'دیتابیس همیشه UTC است؛ سطل‌بندی زمانی با `tz` درخواست انجام می‌شود و هیچ timezone ای hardcode نیست.',
    properties: {
      courses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            course_id: uuid,
            course_slug: { type: 'string' },
            course_title: { type: 'string' },
            subject_slug: { type: 'string', nullable: true },
            subject_title: { type: 'string', nullable: true },
            tracked_pages: { type: 'integer' },
            completed_pages: { type: 'integer' },
            total_pages: { type: 'integer' },
            percent: { type: 'integer' },
            seconds_spent: { type: 'integer' },
          },
        },
      },
      subjects: { type: 'array', items: { type: 'object', additionalProperties: true } },
      totals: {
        type: 'object',
        properties: {
          tracked_pages: { type: 'integer' },
          completed_pages: { type: 'integer' },
          completed_lessons: { type: 'integer' },
          reading_seconds: { type: 'integer' },
          study_sessions: { type: 'integer' },
          study_seconds: { type: 'integer' },
        },
      },
      trend: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bucket: { type: 'string' },
            study_seconds: { type: 'integer' },
            completed_pages: { type: 'integer' },
          },
        },
      },
    },
  },
});

/* ─────────────────────────── tagها ─────────────────────────── */

spec.tags.push(
  { name: 'exams', description: 'موتور آزمون — مسیر دانشجو (فاز ۷)' },
  { name: 'analytics', description: 'تحلیل کاربر جاری (فاز ۸)' },
);

/* ─────────────────────────── مسیرها ─────────────────────────── */

const examRef = { $ref: '#/components/schemas/Exam' };

spec.paths['/api/v1/exams'] = {
  get: {
    tags: ['exams'],
    summary: 'فهرست آزمون‌های قابل مشاهده',
    description:
      'آزمون‌های `draft` هرگز دیده نمی‌شوند. `phase` و `user_state` از ساعت سرور و سشن محاسبه می‌شوند. `server_time` در `meta` برمی‌گردد تا تایمر کلاینت با مرجع یکی شود.\n\n**Rate limit:** `exam_read`.',
    parameters: [
      { name: 'kind', in: 'query', required: false, schema: { type: 'string', enum: ['quiz', 'personal', 'coordinated', 'international'] } },
      { name: 'subject_id', in: 'query', required: false, schema: uuid },
      { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['scheduled', 'open', 'closed', 'archived'] } },
      { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
      { name: 'per_page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } },
    ],
    responses: {
      200: {
        description: 'فهرست آزمون‌ها',
        headers: okHeaders,
        content: json({
          type: 'object',
          properties: {
            data: { type: 'array', items: examRef },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
            requestId: { type: 'string' },
          },
        }),
      },
      400: errorResponse('پارامتر ناشناخته (UNKNOWN_QUERY_PARAMETER).'),
      422: { $ref: '#/components/responses/ValidationFailed' },
      429: { $ref: '#/components/responses/RateLimited' },
    },
  },
};

spec.paths['/api/v1/exams/{idOrSlug}'] = {
  get: {
    tags: ['exams'],
    summary: 'جزئیات آزمون',
    description:
      '`idOrSlug` هم UUID و هم slug را می‌پذیرد. آزمون `draft` ⇒ ۴۰۴. `user_state` همان تصمیمی است که سرور گرفته، نه بازمحاسبه در کلاینت.',
    parameters: [pathParam('idOrSlug', 'شناسه یا slug آزمون')],
    responses: {
      200: { description: 'جزئیات آزمون', headers: okHeaders, content: json(envelope({ exam: examRef, server_time: { type: 'string', format: 'date-time' } })) },
      404: errorResponse('آزمون یافت نشد یا منتشر نشده.'),
      429: { $ref: '#/components/responses/RateLimited' },
    },
  },
};

spec.paths['/api/v1/exams/{idOrSlug}/ranking'] = {
  get: {
    tags: ['exams'],
    summary: 'رتبه‌بندی آزمون',
    description:
      'منبع: **فقط `exam_results` آزمون‌های منتشرشده**. پیش از انتشار ⇒ ۴۰۹ `RESULT_NOT_RELEASED`. هیچ فهرست شرکت‌کننده‌ای افشا نمی‌شود — فقط تجمیع و رتبهٔ خودِ کاربر. توزیع مصنوعی legacy بازتولید **نشده** است.',
    parameters: [pathParam('idOrSlug', 'شناسه یا slug آزمون')],
    responses: {
      200: { description: 'رتبه‌بندی', headers: okHeaders, content: json(envelope({ ranking: { $ref: '#/components/schemas/ExamRanking' } })) },
      404: errorResponse('آزمون یافت نشد.'),
      409: errorResponse('نتیجه هنوز منتشر نشده (RESULT_NOT_RELEASED).'),
      429: { $ref: '#/components/responses/RateLimited' },
    },
  },
};

spec.paths['/api/v1/exams/{idOrSlug}/registrations'] = {
  post: {
    tags: ['exams'],
    summary: 'ثبت‌نام در آزمون',
    description:
      'idempotent: ثبت‌نام دوباره ۲۰۰ می‌دهد، نه ردیف تازه. پنجرهٔ ثبت‌نام: `registration_opens_at` تا `registration_closes_at ?? (late_registration ? closes_at : opens_at)`. بسته بودن ⇒ ۴۰۹ `REGISTRATION_CLOSED`.\n\nنیازمند `Origin` و `X-CSRF-Token`. **Rate limit:** `exam_registration`.',
    parameters: [pathParam('idOrSlug', 'شناسه یا slug آزمون')],
    responses: {
      201: { description: 'ثبت‌نام شد', headers: okHeaders, content: json(envelope({ registration: { type: 'object', additionalProperties: true } })) },
      200: { description: 'قبلاً ثبت‌نام شده بود', headers: okHeaders, content: json(envelope({ registration: { type: 'object', additionalProperties: true } })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: errorResponse('آزمون یافت نشد.'),
      409: errorResponse('REGISTRATION_CLOSED یا EXAM_NOT_FOUND.'),
      422: { $ref: '#/components/responses/ValidationFailed' },
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
  delete: {
    tags: ['exams'],
    summary: 'لغو ثبت‌نام',
    description: 'لغو فقط تا پیش از شروع Attempt مجاز است. نیازمند `Origin` و `X-CSRF-Token`.',
    parameters: [pathParam('idOrSlug', 'شناسه یا slug آزمون')],
    responses: {
      200: { description: 'لغو شد', headers: okHeaders, content: json(envelope({ cancelled: { type: 'boolean' } })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: errorResponse('آزمون یافت نشد.'),
      409: errorResponse('لغو در این وضعیت مجاز نیست.'),
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
};

spec.paths['/api/v1/exams/{idOrSlug}/attempts'] = {
  post: {
    tags: ['exams'],
    summary: 'شروع (یا ادامهٔ) Attempt',
    description:
      '**کلاینت هیچ‌کدام از این‌ها را تعیین نمی‌کند:** `questionIds`, `duration`, `deadline`, `startedAt`, `status`, `attempt_no`. فهرست سؤال از Snapshot آزمون می‌آید و مهلت از ساعت سرور.\n\nاگر Attempt باز وجود داشته باشد، همان با `resumed = true` و ۲۰۰ برمی‌گردد. سهمیه پر ⇒ ۴۰۹ `ATTEMPT_LIMIT_REACHED`. آزمون بسته ⇒ ۴۰۹ `EXAM_NOT_OPEN`.\n\nهدر `Idempotency-Key` توصیه می‌شود. **Rate limit:** `exam_attempt_start`.',
    parameters: [pathParam('idOrSlug', 'شناسه یا slug آزمون'), idempotencyHeader],
    responses: {
      201: { description: 'Attempt تازه', headers: okHeaders, content: json(envelope({ attempt: { $ref: '#/components/schemas/ExamAttempt' }, questions: { type: 'array', items: { $ref: '#/components/schemas/ExamQuestion' } }, resumed: { type: 'boolean' } })) },
      200: { description: 'Attempt باز موجود برگردانده شد', headers: okHeaders, content: json(envelope({ attempt: { $ref: '#/components/schemas/ExamAttempt' }, questions: { type: 'array', items: { $ref: '#/components/schemas/ExamQuestion' } }, resumed: { type: 'boolean' } })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: errorResponse('آزمون یافت نشد.'),
      409: errorResponse('EXAM_NOT_OPEN / NOT_REGISTERED / ATTEMPT_LIMIT_REACHED / IDEMPOTENCY_KEY_REUSED.'),
      422: { $ref: '#/components/responses/ValidationFailed' },
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
};

spec.paths['/api/v1/exam-attempts/{id}'] = {
  get: {
    tags: ['exams'],
    summary: 'خواندن Attempt',
    description:
      'Attempt کاربر دیگر ⇒ **۴۰۴** (نه ۴۰۳ — وجودش لو نمی‌رود). اگر مهلت گذشته باشد، همان لحظه نهایی می‌شود. سؤال‌ها **بدون کلید پاسخ** برمی‌گردند.',
    parameters: [pathParam('id', 'شناسهٔ Attempt')],
    responses: {
      200: { description: 'Attempt و سؤال‌هایش', headers: okHeaders, content: json(envelope({ attempt: { $ref: '#/components/schemas/ExamAttempt' }, questions: { type: 'array', items: { $ref: '#/components/schemas/ExamQuestion' } } })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      404: errorResponse('Attempt یافت نشد یا متعلق به کاربر دیگری است.'),
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
};

spec.paths['/api/v1/exam-attempts/{id}/answers'] = {
  put: {
    tags: ['exams'],
    summary: 'ثبت/تغییر پاسخ',
    description:
      '**فقط سه واقعیت از کلاینت:** کدام سؤال، کدام گزینه، نسخهٔ قبلی. `score`, `isCorrect`, `correctAnswer`, `negativeMarking` هیچ قاعده‌ای ندارند و بی‌اثرند.\n\n`selectedOptionId = null` یعنی «پاسخ را پاک کن». گزینه‌ای که به Snapshot همین سؤال تعلق نداشته باشد ⇒ ۴۲۲.\n\n`revision` قفل خوش‌بینانه است؛ عدم تطابق ⇒ ۴۰۹ `REVISION_CONFLICT`. پس از مهلت ⇒ ۴۰۹ `TIME_OVER`. Attempt بسته ⇒ ۴۰۹ `ATTEMPT_CLOSED`.\n\n**Rate limit:** `exam_answer`.',
    parameters: [pathParam('id', 'شناسهٔ Attempt')],
    requestBody: {
      required: true,
      content: json({
        type: 'object',
        required: ['questionId', 'revision'],
        properties: {
          questionId: { ...uuid, description: 'شناسهٔ سؤال در این آزمون (`exam_question_id`)' },
          selectedOptionId: { type: 'string', maxLength: 64, nullable: true, description: 'null = پاک‌کردن پاسخ' },
          revision: { type: 'integer', minimum: 0, description: '۰ = هنوز پاسخی ثبت نشده' },
          timeSpent: { type: 'integer', minimum: 0, maximum: 86400, nullable: true },
        },
      }),
    },
    responses: {
      200: { description: 'پاسخ ثبت شد', headers: okHeaders, content: json(envelope({ answer: { $ref: '#/components/schemas/ExamAnswer' }, revision: { type: 'integer' } })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: errorResponse('سؤال به این Attempt تعلق ندارد (QUESTION_NOT_IN_ATTEMPT).'),
      404: errorResponse('Attempt یافت نشد.'),
      409: errorResponse('REVISION_CONFLICT / TIME_OVER / ATTEMPT_CLOSED / ANSWER_CHANGE_NOT_ALLOWED.'),
      422: { $ref: '#/components/responses/ValidationFailed' },
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
};

spec.paths['/api/v1/exam-attempts/{id}/finish'] = {
  post: {
    tags: ['exams'],
    summary: 'پایان Attempt و تصحیح سرور',
    description:
      '**بدنهٔ خالی.** `score`, `correct`, `negativeMarking`, `status`, `result`, `reason` پذیرفته نمی‌شوند؛ دلیل پایان از ساعت سرور مشتق می‌شود (`user` پیش از مهلت، `grace` در پنجرهٔ گریس، `timeout` پس از آن).\n\nidempotent: پایان دوباره همان نتیجه را برمی‌گرداند و دوباره تصحیح نمی‌کند. `UNIQUE(attempt_id)` روی `exam_results` لایهٔ دوم دفاع است.\n\n⚠️ **نتیجه فقط اگر منتشرشده باشد در بدنه می‌آید.** پیش از `result_release_at` پاسخ `result: null` و `result_released: false` است — تفاوت عمدی با legacy که نمره را پیش از موعد لو می‌داد.\n\n**Rate limit:** `exam_finish`.',
    parameters: [pathParam('id', 'شناسهٔ Attempt'), idempotencyHeader],
    responses: {
      200: { description: 'پایان یافت', headers: okHeaders, content: json(envelope({ attempt: { $ref: '#/components/schemas/ExamAttempt' }, result: { $ref: '#/components/schemas/ExamResult' }, result_released: { type: 'boolean' }, idempotent: { type: 'boolean' } })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: errorResponse('Attempt یافت نشد.'),
      409: errorResponse('ATTEMPT_CLOSED / IDEMPOTENCY_KEY_REUSED.'),
      422: { $ref: '#/components/responses/ValidationFailed' },
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
};

spec.paths['/api/v1/exam-attempts/{id}/result'] = {
  get: {
    tags: ['exams'],
    summary: 'کارنامه',
    description:
      'ماشین وضعیت `ready | processing | not_participated`. پیش از انتشار، پاسخ **فقط** `{state: processing, release_at}` است — هیچ عددی (نه نمره، نه درصد، نه تعداد درست) افشا نمی‌شود.',
    parameters: [pathParam('id', 'شناسهٔ Attempt')],
    responses: {
      200: { description: 'وضعیت کارنامه', headers: okHeaders, content: json(envelope({ state: { type: 'string', enum: ['ready', 'processing', 'not_participated'] }, attempt: { $ref: '#/components/schemas/ExamAttempt' }, result: { $ref: '#/components/schemas/ExamResult' }, release_at: dateTime })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      404: errorResponse('Attempt یافت نشد.'),
      409: errorResponse('ATTEMPT_NOT_FINISHED.'),
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
};

spec.paths['/api/v1/exam-attempts/{id}/review'] = {
  get: {
    tags: ['exams'],
    summary: 'مرور سؤال‌ها با کلید پاسخ',
    description:
      '**تنها مسیری که `correct_option_id` و `explanation` از سرور بیرون می‌روند.** چهار پیش‌شرط، همه سمت سرور: مالکیت (۴۰۴)، Attempt تمام‌شده (۴۰۹)، `rules.allow_review` روشن (۴۰۳)، نتیجه منتشرشده (۴۰۹).',
    parameters: [pathParam('id', 'شناسهٔ Attempt')],
    responses: {
      200: { description: 'سؤال‌های مرور', headers: okHeaders, content: json(envelope({ attempt: { $ref: '#/components/schemas/ExamAttempt' }, questions: { type: 'array', items: { $ref: '#/components/schemas/ExamReviewQuestion' } } })) },
      401: { $ref: '#/components/responses/Unauthenticated' },
      403: errorResponse('REVIEW_NOT_ALLOWED.'),
      404: errorResponse('Attempt یافت نشد.'),
      409: errorResponse('ATTEMPT_NOT_FINISHED / RESULT_NOT_RELEASED.'),
      429: { $ref: '#/components/responses/RateLimited' },
    },
    security: session,
  },
};

const analyticsQuery = [
  { name: 'bucket', in: 'query', required: false, schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
  { name: 'tz', in: 'query', required: false, schema: { type: 'string', description: 'یکی از `timezone_identifiers_list()`' } },
  { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
  { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
];

const analyticsOperation = (summary, description, schemaRef, extraParameters = []) => ({
  tags: ['analytics'],
  summary,
  description:
    description +
    '\n\n**مالکیت فقط از سشن.** `userId` هیچ قاعده‌ای ندارد و فرستادنش ⇒ ۴۰۰ `UNKNOWN_QUERY_PARAMETER`. **Rate limit:** `analytics_read`.',
  parameters: extraParameters,
  responses: {
    200: { description: 'تحلیل', headers: okHeaders, content: json(envelope({ analytics: { $ref: schemaRef } })) },
    400: errorResponse('پارامتر ناشناخته (UNKNOWN_QUERY_PARAMETER).'),
    401: { $ref: '#/components/responses/Unauthenticated' },
    422: { $ref: '#/components/responses/ValidationFailed' },
    429: { $ref: '#/components/responses/RateLimited' },
  },
  security: session,
});

spec.paths['/api/v1/me/analytics/overview'] = {
  get: analyticsOperation(
    'نمای کلی',
    'هر عدد از منبع مستقل خودش. نتیجهٔ منتشرنشده هرگز وارد تجمیع نمی‌شود — حتی برای صاحبش.',
    '#/components/schemas/AnalyticsOverview',
  ),
};

spec.paths['/api/v1/me/analytics/topics'] = {
  get: analyticsOperation(
    'عملکرد موضوعی',
    'از `question_attempts` واقعی. `exam_answers` در این مخرج نمی‌آید.',
    '#/components/schemas/TopicAnalytics',
  ),
};

spec.paths['/api/v1/me/analytics/exams'] = {
  get: analyticsOperation(
    'عملکرد آزمون',
    'فقط نتایج منتشرشده. عملکرد درس‌محور از `exam_results.subject_breakdown` خوانده می‌شود.',
    '#/components/schemas/ExamAnalytics',
  ),
};

spec.paths['/api/v1/me/analytics/progress'] = {
  get: analyticsOperation(
    'پیشرفت و روند',
    'دیتابیس همیشه UTC است؛ سطل‌بندی با `tz` انجام می‌شود. مخرج درصد دوره = صفحه‌های **قابل مشاهدهٔ** دوره.',
    '#/components/schemas/ProgressAnalytics',
    analyticsQuery,
  ),
};

/* ─────────────────────────── سرصفحه ─────────────────────────── */

spec.info.version = '1.4.0';
spec.info.title = 'TAPESH API v1 — Identity (Phase 2) + Learning (Phase 5) + Question Bank (Phase 6) + Exam Engine (Phase 7) + Analytics (Phase 8)';
spec.info.description =
  'قرارداد جدید فقط روی `/api/v1`. سطح قدیمی `/api/*` (سرور Node) دست‌نخورده است و در این سند توصیف نمی‌شود.\n\n' +
  'این فایل توسط `tests/Feature/ApiV1ContractTest.php` دوطرفه با پیاده‌سازی واقعی قفل شده است: هر مسیر تازه بدون به‌روزرسانی این سند، تست را می‌شکند.\n\n' +
  '**قاعدهٔ کلید پاسخ:** `correct_option_id` و `explanation` هرگز در `GET /questions*` و هرگز در سؤال‌های در جریان آزمون حاضر نیستند. تنها مسیر افشا: `POST /questions/{id}/answers` (همان سؤال) و `GET /exam-attempts/{id}/review` (پس از انتشار + مجوز قاعده + مالکیت).\n\n' +
  '**مرز سه‌گانهٔ دامنه:** بانک سؤال مالک سؤال است · موتور آزمون مالک آزمون/Snapshot/Attempt/پاسخ/نتیجه · Analytics فقط **مصرف‌کنندهٔ** دادهٔ مشتق‌شده است و هیچ منبع حقیقت تازه‌ای نمی‌سازد.\n\n' +
  '**زمان:** تنها مرجع، ساعت سرور است. تایمر کلاینت نمایشی است.\n\n' +
  '**نتیجهٔ آزمون:** تغییرناپذیر، بدون soft delete، بدون cascade روی دادهٔ تاریخی. `teraz` عمداً `null` و توزیع جامعهٔ مصنوعی عمداً حذف شده است.';

fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');

process.stdout.write(
  'paths=' + Object.keys(spec.paths).length + ' schemas=' + Object.keys(spec.components.schemas).length + '\n',
);
