#!/usr/bin/env node
/*
 * بازبینی قرارداد فرانت ↔ v1 (فاز ۵ و ۶).
 *
 * این اسکریپت سه چیز را قطعی می‌سنجد:
 *
 *   ۱. **هر فیلدی که پل فرانت مصرف می‌کند در OpenAPI v1 وجود دارد.** نام‌ها در
 *      `CONSUMED` اینجا نوشته شده‌اند؛ اگر سرور فیلدی را تغییر نام بدهد، تست
 *      می‌شکند نه اینکه UI بی‌صدا `undefined` ببیند.
 *   ۲. **هیچ فیلد کلید پاسخ در schema عمومی سؤال نیست** (`Question`,
 *      `QuestionOption`, `BankSession`). این همان چیزی است که
 *      `AnswerKeyIsolationTest` در بک‌اند تضمین می‌کند؛ اینجا از سمت قرارداد
 *      هم قفل می‌شود.
 *   ۳. **این اسکریپت از پل‌ها عقب نمی‌افتد.** هر شناسهٔ snake_case که در فایل‌های
 *      پل دیده شود باید در `CONSUMED` اعلام شده باشد، وگرنه تست می‌شکند.
 *
 * اجرا: `npm run v1:contract:check`
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI = resolve(ROOT, 'backend/docs/openapi.v1.json');

const ADAPTERS = [
  'src/services/api/v1.js',
  'src/services/learning/progressV1.js',
  'src/services/testBank/testBankV1.js',
  'src/services/exam/examV1.js',
  'src/services/flashcards/flashcardsV1.js',
  'src/services/wiki/wikiV1.js',
  'src/services/knowledge/knowledgeV1.js',
  'src/services/greenPath/greenPathV1.js',
  'src/services/league/leagueV1.js',
  'src/services/pricing/pricingV1.js',
  'src/services/commerce/commerceV1.js',
  'src/services/international/internationalV1.js',
];

/*
 * فیلدهای مصرف‌شده — آینهٔ نگاشت‌های پل.
 * هر کلید نام schema در OpenAPI است؛ مقدار، فیلدهای سطح بالای آن.
 */
const CONSUMED = {
  Progress: ['id', 'lesson_page_id', 'status', 'last_position', 'seconds_spent', 'version', 'completed_at', 'updated_at'],
  ProgressSummary: ['totals', 'courses'],
  StudySession: ['id', 'lesson_page_id', 'source', 'started_at', 'ended_at', 'duration_sec'],
  Question: ['id', 'stem', 'figure_key', 'type', 'difficulty', 'source', 'track', 'year', 'exam_month', 'subject', 'topic', 'options'],
  QuestionOption: ['id', 'position', 'label', 'body'],
  QuestionAttemptResult: ['attempt_id', 'question_id', 'question_version', 'selected_option_id', 'is_correct', 'answered_at', 'reward', 'reveal'],
  QuestionReport: ['id', 'question_id', 'kind', 'status', 'created_at'],
  BankSession: ['session_id', 'mode', 'expires_at', 'questions'],
  PaginationMeta: ['page', 'perPage', 'total', 'lastPage'],
  /* فاز ۷ — موتور آزمون. */
  Exam: ['id', 'slug', 'kind', 'type', 'title', 'short_name', 'description', 'subject', 'status', 'phase', 'opens_at', 'closes_at', 'registration_opens_at', 'registration_closes_at', 'result_release_at', 'duration_minutes', 'grace_seconds', 'attempt_limit', 'negative_marking', 'question_count', 'rules', 'meta', 'user_state'],
  ExamQuestion: ['exam_question_id', 'position', 'question_id', 'stem', 'figure_key', 'type', 'difficulty', 'subject', 'topic', 'options'],
  ExamAttempt: ['id', 'exam_id', 'attempt_no', 'status', 'started_at', 'deadline_at', 'submitted_at', 'submit_reason', 'answered_count', 'has_result'],
  ExamAnswer: ['exam_question_id', 'selected_option_id', 'revision', 'answered_at'],
  ExamResult: ['id', 'attempt_id', 'exam_id', 'submit_reason', 'score', 'max_score', 'percentage', 'correct_count', 'wrong_count', 'blank_count', 'negative_marking', 'time_spent_sec', 'subject_breakdown', 'teraz', 'graded_at'],
  ExamReviewQuestion: ['exam_question_id', 'position', 'stem', 'figure_key', 'subject', 'topic', 'options', 'selected_option_id', 'correct_option_id', 'is_correct', 'explanation'],
  ExamRanking: ['exam_id', 'participants_count', 'top_percent', 'median_percent', 'average_percent', 'me'],
  /* فاز ۹ — فلشکارت. */
  FlashcardDeck: ['id', 'title', 'description', 'status', 'visibility', 'is_official', 'is_owned', 'cards_count', 'version', 'published_at', 'created_at', 'updated_at'],
  Flashcard: ['id', 'deck_id', 'front', 'back', 'position', 'status', 'created_at', 'updated_at'],
  FlashcardState: ['card_id', 'state', 'algorithm_version', 'due_at', 'interval_days', 'interval_minutes', 'ease', 'review_count', 'lapse_count', 'correct_count', 'incorrect_count', 'difficulty', 'stability', 'mastery_score', 'suspended', 'buried_until', 'bookmarked', 'last_reviewed_at', 'version'],
  FlashcardReview: ['id', 'state_id', 'rating', 'previous_state', 'new_state', 'previous_due_at', 'next_due_at', 'previous_interval_minutes', 'next_interval_minutes', 'previous_ease', 'next_ease', 'algorithm_version', 'reviewed_at'],
  FlashcardQueueItem: ['card', 'deck', 'state', 'preview'],
  FlashcardReviewResult: ['card_id', 'deck_id', 'state', 'review', 'preview'],
  FlashcardProgress: ['total', 'new', 'learning', 'due', 'reviewed_today', 'mastered', 'suspended'],
  /* فاز ۱۰ — ویکی. */
  WikiCategory: ['id', 'slug', 'name', 'description', 'parent_id', 'sort_order', 'status', 'articles_count', 'children'],
  WikiArticleSummary: ['id', 'slug', 'title', 'summary', 'subject', 'content_type', 'difficulty', 'read_minutes', 'popularity', 'category', 'published_at', 'updated_at'],
  WikiArticle: ['id', 'slug', 'title', 'summary', 'body', 'subject', 'content_type', 'difficulty', 'key_facts', 'keywords', 'read_minutes', 'popularity', 'category', 'published_at', 'updated_at'],
  WikiRelation: ['article_id', 'slug', 'title', 'summary', 'subject', 'content_type', 'difficulty', 'kind', 'kind_label', 'direction'],
  WikiBookmark: ['id', 'article_id', 'created_at', 'article'],
  /* فاز ۱۲ — گراف دانش. */
  KnowledgeNode: ['id', 'label', 'kind', 'article'],
  KnowledgeEdge: ['from', 'to', 'relation', 'weight'],
  KnowledgeNeighbor: ['node', 'relation'],
  KnowledgeGraphMeta: ['root', 'depth'],
  /* فاز ۱۳ — مسیر سبز. */
  GreenPathStep: ['id', 'kind', 'target', 'position', 'status', 'due_at', 'completed_at', 'version'],
  GreenPathProfile: ['user_id', 'username', 'first_name', 'last_name', 'university', 'grade', 'term', 'goal_key', 'plan_version', 'plan_start', 'plan_end'],
  GreenPathRoadmap: ['path', 'steps', 'current_step', 'next_step', 'progress', 'meta'],
  GreenPathCalendar: ['from', 'to', 'days'],
  GreenPathPerformance: ['steps', 'study_time', 'exams', 'trend'],
  /* فاز ۱۴ — لیگ و گیمیفیکیشن. */
  LeagueSeasonInfo: ['id', 'slug', 'starts_at', 'ends_at', 'status', 'days_remaining'],
  LeagueEntry: ['rank', 'display_name', 'avatar_key', 'university', 'xp_total', 'is_you'],
  LeagueOverview: ['season', 'membership', 'rank', 'neighbors'],
  ChallengeInfo: ['id', 'code', 'name', 'description', 'kind', 'metric', 'target', 'xp_reward', 'status', 'progress', 'completed_at'],
  AchievementInfo: ['id', 'code', 'name', 'description', 'status', 'unlocked', 'unlocked_at'],
  /* فاز ۱۷ — کاتالوگ بین‌الملل. */
  InternationalProvider: ['id', 'slug', 'name', 'name_en', 'kind', 'country', 'founded', 'description', 'focus', 'logo_media_id', 'logo_url', 'sort_order', 'marquee_order'],
  InternationalCourse: ['id', 'slug', 'title', 'description', 'category', 'level', 'tags', 'cover_media_id', 'cover_url', 'accent', 'accent_soft', 'badge', 'duration_minutes', 'total_duration_label', 'required_capability', 'locked', 'sort_order', 'provider'],
  AdminInternationalProvider: ['id', 'slug', 'name', 'name_en', 'kind', 'country', 'founded', 'description', 'focus', 'logo_media_id', 'sort_order', 'marquee_order', 'status', 'origin', 'published_at', 'created_at', 'updated_at'],
  AdminInternationalCourse: ['id', 'slug', 'title', 'description', 'category', 'level', 'tags', 'cover_media_id', 'accent', 'accent_soft', 'badge', 'duration_minutes', 'total_duration_label', 'required_capability', 'sort_order', 'status', 'origin', 'published_at', 'provider', 'created_at', 'updated_at'],
  /*
   * فاز ۱۸ — قیمت‌گذاری. `checkout` عمداً مصرف می‌شود: UI باید بداند درگاه
   * پیکربندی شده یا نه، وگرنه کاربر دکمهٔ خرید می‌زند و ۵۰۳ می‌گیرد.
   */
  PricingCatalog: ['currency', 'currencyLabel', 'amountsConfirmed', 'checkout', 'cycles', 'plans'],
  CheckoutState: ['enabled', 'gateway', 'configured'],
  PricingCycle: ['id', 'months', 'discountPercent'],
  PricingPlan: ['id', 'product', 'name', 'kind', 'currency', 'approved', 'purchasable', 'seats', 'capabilities', 'cycles'],
  ProductCapability: ['code', 'coverage'],
  Quote: ['product', 'product_name', 'plan', 'cycle', 'months', 'seats', 'discount_percent', 'list_per_month_minor', 'per_month_minor', 'per_seat_total_minor', 'total_minor', 'list_total_minor', 'saved_total_minor', 'currency', 'approved', 'purchasable'],
  /* فاز ۱۸ — سفارش، پرداخت، اشتراک و دسترسی. */
  Order: ['id', 'status', 'total_minor', 'currency', 'quote_snapshot', 'expires_at', 'paid_at', 'created_at', 'lines'],
  OrderLine: ['id', 'product_id', 'plan_id', 'unit_minor', 'quantity', 'line_total_minor', 'snapshot'],
  Payment: ['id', 'order_id', 'provider', 'authority', 'status', 'amount_minor', 'currency', 'verified_at', 'created_at'],
  Subscription: ['id', 'status', 'effective', 'starts_at', 'ends_at', 'plan'],
  Entitlement: ['id', 'capability', 'active', 'revoked', 'source_order_id', 'starts_at', 'ends_at', 'revoked_at'],
};

/* فیلدهای کلید پاسخ/متادیتای داخلی که **نباید** در schema عمومی باشند. */
const FORBIDDEN_IN_PUBLIC = {
  Question: ['correct_option_id', 'correct_answer', 'answer_key', 'key', 'explanation', 'stats', 'option_percents', 'status', 'version', 'legacy_id', 'author_admin_id'],
  QuestionOption: ['is_correct', 'correct', 'answer'],
  BankSession: ['key', 'answer_key', 'explanation'],
  /*
   * فاز ۷: کلید پاسخ در Snapshot با نام `key_snapshot_encrypted` ذخیره می‌شود.
   * اگر روزی در schema عمومی ظاهر شود، مرز کلید شکسته است.
   */
  Exam: ['key_snapshot_encrypted', 'answer_key'],
  ExamQuestion: ['key_snapshot_encrypted', 'correct_option_id', 'correct_answer', 'answer_key', 'is_correct', 'explanation', 'stats'],
  ExamAttempt: ['key_snapshot_encrypted'],
  ExamReviewQuestion: ['key_snapshot_encrypted', 'correct_answer', 'answer_key'],
  /*
   * فاز ۹/۱۰: مالکیت و متادیتای داخلی هرگز به کلاینت نمی‌آید.
   * `owner_user_id` در دک فقط سرور می‌داند؛ API عمومی ویکی نه وضعیت مقاله
   * (`status`/`version`) می‌دهد نه نویسنده/شمارندهٔ بازدید؛ نشانک `user_id` ندارد
   * (دامنه از سشن می‌آید)؛ تاریخچهٔ مرور `request_key` را لو نمی‌دهد.
   */
  FlashcardDeck: ['owner_user_id', 'legacy_id'],
  FlashcardReview: ['request_key'],
  WikiArticle: ['status', 'version', 'author_admin_id', 'editor_admin_id', 'view_count', 'legacy_id'],
  WikiBookmark: ['user_id'],
  /*
   * فاز ۱۲: نود عمومی هرگز `status`/پیوند خام مقاله/timestamp نمی‌دهد؛ یال
   * عمومی شناسهٔ داخلی ندارد (فقط پنل `id` می‌گیرد).
   */
  KnowledgeNode: ['status', 'wiki_article_id', 'legacy_id', 'created_at', 'updated_at'],
  KnowledgeEdge: ['id', 'created_at', 'updated_at'],
  /*
   * فاز ۱۳: هدف قدم فقط از طریق `target{}` می‌آید؛ FKهای خام هرگز به schema
   * عمومی قدم راه نمی‌یابند.
   */
  GreenPathStep: ['lesson_id', 'question_id', 'exam_id'],
  /*
   * فاز ۱۴: ورودی leaderboard مستعار است — شناسهٔ کاربر هرگز به UI نمی‌آید.
   */
  LeagueEntry: ['user_id'],
  /*
   * فاز ۱۷/۱۸: مالکیت و چرخهٔ عمر هرگز به کلاینت نمی‌آید.
   *
   *   • `Order`/`Payment`/`Subscription`/`Entitlement` هیچ `user_id` ندارند —
   *     مالکیت فقط از سشن می‌آید، وگرنه UI می‌توانست «مالک» را نشان دهد و
   *     مهاجرت بعدی روی شناسهٔ لو رفته بنا شود.
   *   • کاتالوگ عمومی بین‌الملل `status`/`origin`/`legacy_id` ندارد؛ شمارش
   *     پیش‌نویس‌ها و شناسهٔ مهاجرت سطح حمله است، نه دادهٔ مصرف‌کننده.
   */
  Order: ['user_id'],
  Payment: ['user_id'],
  Subscription: ['user_id'],
  Entitlement: ['user_id'],
  InternationalProvider: ['status', 'origin', 'legacy_id'],
  InternationalCourse: ['status', 'origin', 'legacy_id', 'progress'],
};

/* فیلدهای تودرتویی که پل می‌خواند: schema → فیلد فرزند → فیلدهای نوه. */
const NESTED = [
  { schema: 'Question', path: ['subject'], expect: ['id', 'slug', 'title'] },
  { schema: 'Question', path: ['topic'], expect: ['id', 'slug', 'title'] },
  { schema: 'QuestionAttemptResult', path: ['reward'], expect: ['awarded', 'amount'] },
  { schema: 'QuestionAttemptResult', path: ['reveal'], expect: ['correct_option_id', 'explanation'] },
  { schema: 'Exam', path: ['user_state'], expect: ['registered', 'registered_at', 'can_register', 'can_cancel_registration', 'attempts_used', 'attempt_limit', 'can_start', 'active_attempt_id', 'last_attempt_id', 'result_ready', 'has_participated'] },
  { schema: 'Exam', path: ['subject'], expect: ['id', 'slug', 'title'] },
  { schema: 'ExamQuestion', path: ['options'], expect: ['id', 'position', 'label', 'body'] },
  { schema: 'ExamReviewQuestion', path: ['options'], expect: ['id', 'position', 'label', 'body', 'is_correct', 'is_selected'] },
  { schema: 'ExamRanking', path: ['me'], expect: ['percentage', 'rank', 'percentile'] },
  /* فاز ۹ — اقلام صف مرور و نتیجهٔ مرور تودرتو هستند. */
  { schema: 'FlashcardQueueItem', path: ['card'], expect: ['id', 'deck_id', 'front', 'back', 'position', 'status'] },
  { schema: 'FlashcardQueueItem', path: ['state'], expect: ['card_id', 'state', 'algorithm_version', 'due_at'] },
  { schema: 'FlashcardReviewResult', path: ['state'], expect: ['card_id', 'state', 'algorithm_version', 'due_at'] },
  { schema: 'FlashcardReviewResult', path: ['review'], expect: ['id', 'state_id', 'rating', 'new_state', 'next_due_at', 'algorithm_version', 'reviewed_at'] },
  /* فاز ۱۰ — نشانک، خلاصهٔ مقاله را حمل می‌کند. */
  { schema: 'WikiBookmark', path: ['article'], expect: ['id', 'slug', 'title', 'subject', 'content_type'] },
  /* فاز ۱۲ — همسایه، نود را حمل می‌کند؛ نود ارجاع مقالهٔ منتشرشده را. */
  { schema: 'KnowledgeNeighbor', path: ['node'], expect: ['id', 'label', 'kind', 'article'] },
  { schema: 'KnowledgeNode', path: ['article'], expect: ['slug', 'title'] },
  /* فاز ۱۳ — قدم، هدف و مسیر را حمل می‌کند. */
  { schema: 'GreenPathStep', path: ['target'], expect: ['type', 'id'] },
  { schema: 'GreenPathRoadmap', path: ['path'], expect: ['id', 'goal_key', 'plan_version', 'status', 'starts_at'] },
  { schema: 'GreenPathRoadmap', path: ['progress'], expect: ['total_steps', 'completed_steps', 'percent'] },
  { schema: 'GreenPathRoadmap', path: ['meta'], expect: ['plan_version', 'goal_key', 'generated_at'] },
  { schema: 'GreenPathPerformance', path: ['steps'], expect: ['total', 'completed', 'overdue', 'completion_rate'] },
  { schema: 'GreenPathPerformance', path: ['study_time'], expect: ['sessions', 'seconds'] },
  { schema: 'GreenPathPerformance', path: ['exams'], expect: ['taken', 'avg_percentage'] },
  /* فاز ۱۴ — نمای لیگ، فصل و عضویت را حمل می‌کند. */
  { schema: 'LeagueOverview', path: ['season'], expect: ['id', 'slug', 'starts_at', 'ends_at', 'status', 'days_remaining'] },
  { schema: 'LeagueOverview', path: ['membership'], expect: ['xp_total', 'joined_at'] },
  /* فاز ۱۷ — دوره، ناشر را حمل می‌کند (نام/لوگو از همان منبع). */
  { schema: 'InternationalCourse', path: ['provider'], expect: ['id', 'slug', 'name', 'name_en', 'kind', 'country', 'logo_media_id', 'logo_url'] },
  { schema: 'AdminInternationalCourse', path: ['provider'], expect: ['id', 'slug', 'name', 'status', 'origin'] },
  /* فاز ۱۸ — سفارش، سطرهایش را حمل می‌کند؛ اشتراک، پلنش را. */
  { schema: 'Order', path: ['lines'], expect: ['id', 'product_id', 'plan_id', 'unit_minor', 'quantity', 'line_total_minor', 'snapshot'] },
  { schema: 'Subscription', path: ['plan'], expect: ['code', 'cycle_months', 'product'] },
];

const failures = [];
const checks = [];

function loadOpenApi() {
  try {
    return JSON.parse(readFileSync(OPENAPI, 'utf8'));
  } catch (error) {
    failures.push(`OpenAPI خوانده نشد: ${error.message}`);
    return null;
  }
}

/* `$ref` یک‌سطحی؛ برای همهٔ ارجاع‌های این سند کافی است. */
function deref(spec, node) {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.$ref === 'string') {
    const name = node.$ref.split('/').pop();
    return spec.components?.schemas?.[name] ?? null;
  }
  return node;
}

/* فیلدهای یک schema، شامل `required` نبودن — نام مهم است نه الزام. */
function propertiesOf(spec, schemaName) {
  const schema = deref(spec, { $ref: `#/components/schemas/${schemaName}` });

  if (!schema || typeof schema.properties !== 'object') return null;

  return schema.properties;
}

function checkConsumed(spec) {
  for (const [schemaName, fields] of Object.entries(CONSUMED)) {
    const properties = propertiesOf(spec, schemaName);

    if (properties === null) {
      failures.push(`schema «${schemaName}» در OpenAPI نیست`);
      continue;
    }

    const missing = fields.filter((field) => !(field in properties));

    if (missing.length) failures.push(`${schemaName}: فیلدهای اعلام‌شده در OpenAPI نیستند → ${missing.join(', ')}`);
    else checks.push(`${schemaName}: ${fields.length} فیلد مصرفی تأیید شد`);
  }
}

function checkForbidden(spec) {
  for (const [schemaName, forbidden] of Object.entries(FORBIDDEN_IN_PUBLIC)) {
    const properties = propertiesOf(spec, schemaName);

    if (properties === null) {
      failures.push(`schema «${schemaName}» در OpenAPI نیست`);
      continue;
    }

    const leaked = forbidden.filter((field) => field in properties);

    if (leaked.length) failures.push(`${schemaName}: فیلد ممنوع در schema عمومی → ${leaked.join(', ')}`);
    else checks.push(`${schemaName}: هیچ فیلد کلید/متادیتای داخلی ندارد`);
  }
}

/*
 * یک node را تا شیئی که `properties` دارد باز می‌کند: `$ref` را deref می‌کند و
 * **آرایه را به `items` خودش باز می‌کند**.
 *
 * چرا لازم شد: فیلدهای تودرتوی فاز ۵/۶ همه `$ref` بودند، ولی `ExamQuestion.options`
 * و `ExamReviewQuestion.options` آرایه‌اند و خصوصیات در `items.properties` هستند.
 * بدون این بازکردن، چک تودرتو روی آرایه‌ها **بی‌صدا** «پیدا نشد» می‌داد.
 */
function objectSchemaOf(spec, node) {
  let current = deref(spec, node);

  if (current && current.type === 'array') current = deref(spec, current.items);

  return current && typeof current.properties === 'object' ? current : null;
}

function checkNested(spec) {
  for (const { schema, path, expect } of NESTED) {
    const properties = propertiesOf(spec, schema);
    const child = objectSchemaOf(spec, properties?.[path[0]]);

    if (child === null) {
      failures.push(`${schema}.${path[0]} در OpenAPI پیدا نشد`);
      continue;
    }

    const missing = expect.filter((field) => !(field in child.properties));

    if (missing.length) failures.push(`${schema}.${path[0]}: فیلدهای مصرفی نیستند → ${missing.join(', ')}`);
    else checks.push(`${schema}.${path[0]}: ${expect.length} فیلد تأیید شد`);
  }
}

/*
 * شناسه‌های snake_case داخل پل‌ها.
 * فقط رشته‌های داخل کوتیشن و کلیدهای شیئی شمرده می‌شوند تا کامنت‌ها و متن فارسی
 * نتیجه را آلوده نکنند.
 */
function snakeCaseTokens(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  const tokens = new Set();

  for (const match of withoutComments.matchAll(/['"`]([a-z][a-z0-9]*(?:_[a-z0-9]+)+)['"`]/g)) {
    tokens.add(match[1]);
  }

  return [...tokens];
}

function checkAdapterDrift() {
  const declared = new Set(Object.values(CONSUMED).flat());
  /* فیلدهای تودرتو و شناسه‌های غیر-فیلد (کوکی، مقدار enum، کلید پوشش) مجازند. */
  const allowedExtra = new Set([
    ...NESTED.flatMap((item) => item.expect),
    'idempotency_key',
    'not_v1',
    'study_session',
    'bank_session',
    /* نام کوکی CSRF — نه فیلد پاسخ. */
    'tapesh_csrf',
    /* مقادیر enum وضعیت پیشرفت و دستهٔ گزارش — نه نام فیلد. */
    'not_started',
    'in_progress',
    'wrong_answer',
    /*
     * نام‌های «ممنوع» که پل فاز ۷ **اعلام** می‌کند تا هرگز مصرف نشوند
     * (`FORBIDDEN_KEY_FIELDS`). این‌ها فیلد مصرفی نیستند — سند مرز کلیداند.
     */
    'key_snapshot_encrypted',
    'correct_answer',
    'answer_key',
    /*
     * فیلد سطح endpoint (نه schema): خروجی `POST /finish` می‌گوید نتیجه ساخته
     * شده ولی منتشر نشده. مصرفش اجباری است، وگرنه UI نتیجهٔ منتشرنشده را نشان می‌دهد.
     */
    'result_released',
    /*
     * فیلد سطح endpoint (نه schema): پاسخ `GET /me/green-path/today` فاز ۱۳
     * `path_id` را داخل response درون‌خطی می‌دهد — schema نام‌دار ندارد.
     */
    'path_id',
    /*
     * مقدار enum وضعیت سفارش (فاز ۱۸) — نه نام فیلد. `ORDER_STATUS` آینهٔ
     * مقادیر سرور است تا UI بتواند تصمیم نمایشی بگیرد.
     */
    'awaiting_payment',
  ]);

  let scanned = 0;

  for (const relative of ADAPTERS) {
    let source;

    try {
      source = readFileSync(resolve(ROOT, relative), 'utf8');
    } catch (error) {
      failures.push(`${relative} خوانده نشد: ${error.message}`);
      continue;
    }

    scanned += 1;

    const undeclared = snakeCaseTokens(source).filter((token) => !declared.has(token) && !allowedExtra.has(token));

    if (undeclared.length) failures.push(`${relative}: شناسه‌های اعلام‌نشده → ${undeclared.join(', ')}`);
  }

  if (scanned === ADAPTERS.length) checks.push(`${scanned} پل فرانت اسکن شد؛ همهٔ شناسه‌ها اعلام‌شده‌اند`);
}

const spec = loadOpenApi();

if (spec) {
  checkConsumed(spec);
  checkForbidden(spec);
  checkNested(spec);
  checkAdapterDrift();
}

const mode = process.argv.includes('--json') ? 'json' : 'text';

if (mode === 'json') {
  process.stdout.write(`${JSON.stringify({ ok: failures.length === 0, checks, failures }, null, 2)}\n`);
} else {
  for (const line of checks) console.log(`  ✓ ${line}`);
  for (const line of failures) console.log(`  ✗ ${line}`);
  console.log(`\n${failures.length === 0 ? 'OK' : 'FAILED'} — ${checks.length} بررسی سبز، ${failures.length} شکست`);
}

/* `process.exitCode` به‌جای `process.exit` تا خروجی pipe کامل تخلیه شود. */
process.exitCode = failures.length === 0 ? 0 : 1;
