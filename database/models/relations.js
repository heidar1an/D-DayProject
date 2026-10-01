/*
 * گراف ارتباط بین Entityها و قواعد حذف.
 *
 * ⚠️ هیچ قاعده‌ای اینجا **حدس** نیست. هر `deleteRule` از بدنهٔ تابع حذف
 * واقعی در Repository استخراج شده و ستون `evidence` فایل و تابع را نام می‌برد.
 * اگر رفتار فروشگاه عوض شود، این جدول باید با آن هم‌گام شود — و تست
 * `dataIntegrity.test.mjs` بخش «Delete Rules» همین را بررسی می‌کند.
 *
 * ── واژگان قواعد حذف ──────────────────────────────────────────────────────
 *   RESTRICT     حذف والد ممنوع است تا وقتی فرزند دارد (خطای CONFLICT)
 *   SET_NULL     ارجاع فرزند `null` می‌شود؛ فرزند می‌ماند
 *   DETACH       عضو از آرایهٔ فرزند برداشته می‌شود (نسخهٔ آرایه‌ای SET_NULL)
 *   CASCADE      رکورد وابستهٔ همراه (مثل راز) هم حذف می‌شود
 *   SOFT         ارجاع نرم/تاریخی؛ نبودِ والد خطا نیست و حذف محدود نمی‌شود
 *   FREE         بدون وابسته؛ حذف آزاد
 */

/* ─────────────────────────── واژگان ─────────────────────────── */

export const DELETE_RULES = Object.freeze({
  RESTRICT: 'RESTRICT',
  SET_NULL: 'SET_NULL',
  DETACH: 'DETACH',
  CASCADE: 'CASCADE',
  SOFT: 'SOFT',
  FREE: 'FREE',
});

/** شدت خطای نبودِ والد: `error` ⇒ یکپارچگی می‌شکند · `warn` ⇒ تاریخی/چندریختی */
export const MISSING_PARENT = Object.freeze({ ERROR: 'error', WARN: 'warn' });

/* ─────────────────────────── جدول ارتباط‌ها ─────────────────────────── */

/**
 * @typedef {object} Relation
 * @property {string} child      مجموعهٔ فرزند
 * @property {string} field      فیلد ارجاع در فرزند
 * @property {string} parent     مجموعهٔ والد
 * @property {string} [parentField='id']
 * @property {boolean} required  آیا ارجاع الزامی است؟ (`null` مجاز نیست)
 * @property {boolean} [array]   آرایه‌ای است؟
 * @property {string} deleteRule یکی از DELETE_RULES
 * @property {string} onMissing  MISSING_PARENT
 * @property {string[]} [sentinels] مقادیر ویژه‌ای که ارجاع نیستند
 * @property {string} evidence   شاهد در کد
 */

/** @type {Relation[]} */
export const RELATIONS = [
  /* ── محتوا ── */
  {
    child: 'articles', field: 'category', parent: 'categories', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'contentStore.js → deleteCategory (CONFLICT اگر مقاله دارد)',
  },
  {
    child: 'intlCourses', field: 'providerId', parent: 'intlProviders', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'contentStore.js → intlProviderPayload/delete (منبع باید موجود باشد)',
  },

  /* ── مرکز رسانه: پلتفرم ── */
  {
    child: 'mediaAccounts', field: 'platform', parent: 'mediaPlatforms', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:438 → deletePlatform (CONFLICT اگر اکانت دارد)',
  },
  {
    child: 'mediaTeam', field: 'platformIds', parent: 'mediaPlatforms', array: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:438 → deletePlatform (فقط اکانت چک می‌شود؛ آرایه‌ها بازمانده‌اند)',
  },
  {
    child: 'mediaCampaigns', field: 'platformIds', parent: 'mediaPlatforms', array: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:438 → deletePlatform',
  },

  /* ── مرکز رسانه: اکانت ── */
  {
    child: 'mediaContents', field: 'accountId', parent: 'mediaAccounts', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:592 → deleteAccount (CONFLICT اگر محتوا دارد)',
  },
  {
    child: 'mediaInbox', field: 'accountId', parent: 'mediaAccounts', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:592 → deleteAccount',
  },
  {
    child: 'mediaMetrics', field: 'accountId', parent: 'mediaAccounts', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:592 → deleteAccount (سنجه‌ها چک نمی‌شوند — ریسک بازمانده)',
  },
  {
    child: 'mediaAccounts', field: 'publishChannelId', parent: 'publishChannels',
    deleteRule: DELETE_RULES.SET_NULL, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:592 — فیلد اختیاری؛ در همهٔ رکوردها null است',
  },

  /* ── مرکز رسانه: محتوا ── */
  {
    child: 'mediaContents', field: 'campaignId', parent: 'mediaCampaigns', required: true,
    deleteRule: DELETE_RULES.SET_NULL, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1617 → deleteCampaign (محتوا جدا می‌شود، حذف نمی‌شود)',
  },
  {
    child: 'mediaContents', field: 'authorId', parent: 'mediaTeam', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1724 → deleteTeamMember (CONFLICT اگر محتوا دارد)',
  },
  {
    child: 'mediaContents', field: 'reviewerId', parent: 'mediaTeam',
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1724 → deleteTeamMember',
  },
  {
    child: 'mediaInbox', field: 'assignedToId', parent: 'mediaTeam',
    deleteRule: DELETE_RULES.SET_NULL, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:2039 → deleteInboxItem — ارجاع اختیاری',
  },
  {
    child: 'mediaContents', field: 'tagIds', parent: 'mediaTags', array: true,
    deleteRule: DELETE_RULES.DETACH, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1794 → deleteTag (از آرایهٔ محتواها برداشته می‌شود)',
  },
  {
    child: 'mediaCampaigns', field: 'tagIds', parent: 'mediaTags', array: true,
    deleteRule: DELETE_RULES.DETACH, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1794 → deleteTag',
  },
  {
    child: 'mediaMentions', field: 'keywordId', parent: 'mediaTags', required: true,
    deleteRule: DELETE_RULES.FREE, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:2100 → deleteMention (بدون چک والد — ریسک بازمانده)',
  },
  {
    child: 'mediaContents', field: 'utmId', parent: 'mediaUtm',
    deleteRule: DELETE_RULES.SET_NULL, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:2391 → deleteUtm (بدون جداسازی — ریسک بازمانده)',
  },
  {
    child: 'mediaCampaigns', field: 'utmId', parent: 'mediaUtm',
    deleteRule: DELETE_RULES.SET_NULL, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:2391 → deleteUtm',
  },
  {
    child: 'mediaUtm', field: 'campaignId', parent: 'mediaCampaigns', required: true,
    deleteRule: DELETE_RULES.FREE, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:2391 → deleteUtm / 1617 → deleteCampaign (utmId چک نمی‌شود)',
  },
  {
    child: 'mediaUtm', field: 'contentId', parent: 'mediaContents', required: true,
    deleteRule: DELETE_RULES.FREE, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1048 → deleteContent (utmId چک نمی‌شود)',
  },
  {
    child: 'mediaTeam', field: 'campaignIds', parent: 'mediaCampaigns', array: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1617 → deleteCampaign (آرایه چک نمی‌شود — ریسک بازمانده)',
  },
  {
    child: 'mediaTeam', field: 'adminId', parent: 'admins',
    deleteRule: DELETE_RULES.SET_NULL, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js — اتصال اختیاری؛ در همهٔ رکوردها null است',
  },
  {
    child: 'mediaAccounts', field: 'managerId', parent: 'mediaTeam',
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1724 → deleteTeamMember',
  },
  {
    child: 'mediaAccounts', field: 'memberIds', parent: 'mediaTeam', array: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1724 → deleteTeamMember',
  },
  {
    child: 'mediaPlatforms', field: 'managerId', parent: 'mediaTeam',
    deleteRule: DELETE_RULES.SET_NULL, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:438 — ارجاع اختیاری',
  },
  {
    child: 'mediaCampaigns', field: 'ownerId', parent: 'mediaTeam', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1617 / 1724 → deleteTeamMember',
  },
  {
    child: 'mediaInbox', field: 'contentId', parent: 'mediaContents', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'mediaStore.js:1048 → deleteContent',
  },

  /* ── انتشار ── */
  {
    child: 'publishLog', field: 'channelId', parent: 'publishChannels',
    /* ارجاع نرم: لاگ تاریخی پس از حذف کانال باید بماند. شاهد: دو رکورد یتیم
       واقعی در داده (`ch-p5yo48cgn`) — یعنی این رفتار در عمل رخ داده. */
    deleteRule: DELETE_RULES.SOFT, onMissing: MISSING_PARENT.WARN,
    evidence: 'publishingStore.js:233 → deleteChannel (لاگ دست‌نخورده می‌ماند)',
  },
  {
    child: 'publishChannels', field: 'createdBy', parent: 'admins',
    deleteRule: DELETE_RULES.SOFT, onMissing: MISSING_PARENT.WARN,
    evidence: 'publishingStore.js:233 → deleteChannel — نام مدیر کپی شده',
  },
  {
    child: 'publishLog', field: 'adminId', parent: 'admins',
    deleteRule: DELETE_RULES.SOFT, onMissing: MISSING_PARENT.WARN,
    evidence: 'publishingStore.js — لاگ تاریخی',
  },

  /* ── آزمون ── */
  {
    child: 'examQuestions', field: 'examId', parent: 'exams', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'examStore.js — سؤال بدون آزمون بی‌معناست',
  },
  {
    child: 'examAttempts', field: 'examId', parent: 'exams', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'examStore.js:296 → attemptForExam',
  },
  {
    child: 'examReports', field: 'examId', parent: 'exams',
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'examStore.js — گزارش بدون آزمون بی‌معناست',
  },
  {
    child: 'examReports', field: 'questionId', parent: 'examQuestions',
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'examStore.js — گزارش به سؤال مشخص وصل است',
  },
  {
    child: 'testBankAnswers', field: 'questionId', parent: 'testBankQuestions', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'contentStore.js — پاسخ بدون سؤال بی‌معناست',
  },
  {
    child: 'testBankHeartRewards', field: 'questionId', parent: 'testBankQuestions', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'contentStore.js — پاداش بدون سؤال بی‌معناست',
  },

  /* ── پلتفرم ── */
  {
    child: 'notes', field: 'authorId', parent: 'admins', required: true,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'contentStore.js → deleteAdmin (یادداشت‌ها چک نمی‌شوند — ریسک بازمانده)',
  },
  {
    child: 'activity', field: 'userId', parent: 'admins',
    /* لاگ فقط‌افزودنی: مدیر می‌تواند حذف شود و رکورد تاریخی می‌ماند.
       مقدار ویژهٔ `system` هم اصلاً ارجاع نیست. */
    deleteRule: DELETE_RULES.SOFT, onMissing: MISSING_PARENT.WARN,
    sentinels: ['system'],
    evidence: 'contentStore.js:906 → logActivity (userId = admin?.id ?? "system")',
  },
  {
    /*
     * ⚠️ `feedbackReply` و `feedback` **یک مجموعه** را شریک‌اند
     * (`database/content/feedback.json` → `{ items, replies }`). پس نام فرزند
     * باید نام مجموعه باشد (`feedback`)، نه نام Entity.
     *
     * `required: false` عمدی است: نبودِ `targetId` روی **آیتم بازخورد** طبیعی
     * است و نبودش روی **پاسخ** کار `ref('feedback')` در خودِ Schema است.
     * اینجا فقط «اگر مقدار هست، والد وجود دارد؟» سنجیده می‌شود.
     */
    child: 'feedback', field: 'targetId', parent: 'feedback', required: false,
    deleteRule: DELETE_RULES.RESTRICT, onMissing: MISSING_PARENT.ERROR,
    evidence: 'feedbackStore.js — پاسخ بدون بازخورد والد بی‌معناست',
  },
];

/* ─────────────────────────── ارجاع‌های چندریختی ─────────────────────────── */

/**
 * ارجاع‌هایی که والدشان به فیلد دیگری وابسته است.
 * این‌ها در جدول بالا نمی‌آیند چون «والد» ثابت نیست.
 */
export const POLYMORPHIC_RELATIONS = [
  {
    child: 'mediaNotifications', field: 'entityId', byField: 'entityType',
    map: { 'media-content': 'mediaContents', 'media-campaign': 'mediaCampaigns' },
    sentinels: ['failed-queue', 'review-queue'],
    onMissing: MISSING_PARENT.WARN,
    evidence: 'mediaStore.js → notify() — شناسهٔ صف برای اعلان‌های گروهی',
  },
];

/* ─────────────────────────── کمکی‌ها ─────────────────────────── */

/** ارتباط‌های یک مجموعهٔ فرزند. */
export function relationsOf(child) {
  return RELATIONS.filter((relation) => relation.child === child);
}

/** ارتباط‌هایی که یک مجموعه والد دارد. */
export function dependentsOf(parent) {
  return RELATIONS.filter((relation) => relation.parent === parent);
}

/** نگاشت نام مجموعه → مجموعهٔ والد (برای اسکنر). */
export function relationIndex() {
  const index = new Map();
  for (const relation of RELATIONS) {
    if (!index.has(relation.child)) index.set(relation.child, []);
    index.get(relation.child).push(relation);
  }
  return index;
}

/** قواعد حذف به‌تفکیک مجموعهٔ والد — برای گزارش. */
export function deleteRuleReport() {
  const out = new Map();
  for (const relation of RELATIONS) {
    if (!out.has(relation.parent)) out.set(relation.parent, []);
    out.get(relation.parent).push({
      child: relation.child,
      field: relation.field,
      rule: relation.deleteRule,
      required: Boolean(relation.required),
      array: Boolean(relation.array),
    });
  }
  return out;
}
