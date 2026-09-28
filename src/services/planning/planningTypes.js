/*
 * مدل‌های داده و واژگان ماژول «برنامه‌ریزی و مدیریت».
 *
 * پروژه جاوااسکریپت است و `tsconfig` ندارد، پس مدل‌ها اینجا با `@typedef` جاوادوک
 * توصیف شده‌اند: همان قرارداد «TypeScript در حد پایه» را می‌دهد (تکمیل خودکار
 * ویرایشگر + مستندسازی شکل داده) بدون افزودن ابزار ساخت تازه به پروژه.
 *
 * قلم‌های وضعیت/اولویت/نوع یک‌جا و به‌صورت «فهرست رکورد» تعریف شده‌اند تا
 * برچسب فارسی، رنگ و ترتیب نمایش در یک جا بماند و در همهٔ نماها یکی باشد.
 */

/* ───────────────────────────── کاربر و سازمان ───────────────────────────── */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name            نام و نام خانوادگی
 * @property {string} role            عنوان شغلی
 * @property {string} unitId          واحد سازمانی
 * @property {OrgLevel} level         سطح در سلسله‌مراتب
 * @property {string} email
 * @property {string} phone
 * @property {string} avatar          حرف اول برای آواتار
 * @property {boolean} active
 */

/**
 * @typedef {Object} OrganizationUnit
 * @property {string} id
 * @property {string} name
 * @property {string} parentId        null برای واحدهای ریشه
 * @property {OrgLevel} level
 * @property {string} headId          شناسهٔ مسئول واحد
 * @property {string} description
 */

/** @typedef {'director'|'manager'|'lead'|'member'} OrgLevel */

export const ORG_LEVELS = [
  { value: 'director', label: 'مدیر کل', rank: 4 },
  { value: 'manager', label: 'مدیر واحد', rank: 3 },
  { value: 'lead', label: 'مسئول بخش', rank: 2 },
  { value: 'member', label: 'عضو تیم', rank: 1 },
];

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} title
 * @property {string} unitId
 * @property {string} ownerId
 * @property {string} color          کلید رنگ دسته‌بندی
 * @property {string} status         active | paused | closed
 */

/* ───────────────────────────── تقویم ───────────────────────────── */

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {EventType} type
 * @property {string} date            میلادی ISO (YYYY-MM-DD)
 * @property {string} start           HH:mm
 * @property {string} end             HH:mm
 * @property {boolean} allDay
 * @property {string} projectId
 * @property {string} ownerId         مسئول
 * @property {string[]} attendeeIds
 * @property {Priority} priority
 * @property {TaskStatus} status
 * @property {string} location
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @typedef {'meeting'|'deadline'|'reminder'|'training'|'review'|'leave'} EventType */

export const EVENT_TYPES = [
  { value: 'meeting', label: 'جلسه', color: 'accent', icon: 'team' },
  { value: 'deadline', label: 'مهلت', color: 'danger', icon: 'clock' },
  { value: 'reminder', label: 'یادآوری', color: 'gold', icon: 'bell' },
  { value: 'training', label: 'آموزش', color: 'blue', icon: 'book' },
  { value: 'review', label: 'بازبینی', color: 'green', icon: 'check' },
  { value: 'leave', label: 'مرخصی', color: 'muted', icon: 'calendar' },
];

/**
 * @typedef {Object} Holiday
 * @property {string} id
 * @property {string} title
 * @property {string} date            میلادی ISO
 * @property {boolean} official
 * @property {boolean} recurring      هر سال تکرار می‌شود
 * @property {string} [jy]/[jm]/[jd]  معادل شمسی برای تکرار سالانه
 */

/* ───────────────────────────── تسک ───────────────────────────── */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} code             شناسهٔ خوانا مثل TSK-1042
 * @property {string} title
 * @property {string} description
 * @property {string} projectId
 * @property {string} unitId
 * @property {string} ownerId          مسئول اصلی
 * @property {string[]} recipientIds   افراد/واحدهای دریافت‌کننده
 * @property {string} startDate        میلادی ISO
 * @property {string} dueDate          میلادی ISO
 * @property {Priority} priority
 * @property {TaskStatus} status
 * @property {number} progress         ۰ تا ۱۰۰
 * @property {Attachment[]} attachments
 * @property {string[]} tags
 * @property {TaskComment[]} comments
 * @property {ActivityLog[]} history
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @typedef {'low'|'medium'|'high'|'critical'} Priority */

export const PRIORITIES = [
  { value: 'low', label: 'کم', tone: 'neutral', rank: 1, color: 'muted' },
  { value: 'medium', label: 'متوسط', tone: 'info', rank: 2, color: 'blue' },
  { value: 'high', label: 'زیاد', tone: 'warn', rank: 3, color: 'gold' },
  { value: 'critical', label: 'بحرانی', tone: 'danger', rank: 4, color: 'danger' },
];

/** @typedef {'draft'|'issued'|'in-progress'|'paused'|'done'|'canceled'} TaskStatus */

export const TASK_STATUSES = [
  { value: 'draft', label: 'پیش‌نویس', tone: 'neutral', color: 'muted' },
  { value: 'issued', label: 'ابلاغ‌شده', tone: 'info', color: 'blue' },
  { value: 'in-progress', label: 'در حال انجام', tone: 'accent', color: 'accent' },
  { value: 'paused', label: 'متوقف‌شده', tone: 'warn', color: 'gold' },
  { value: 'done', label: 'تکمیل‌شده', tone: 'ok', color: 'green' },
  { value: 'canceled', label: 'لغوشده', tone: 'danger', color: 'danger' },
];

/* وضعیت‌هایی که در برد کانبان ستون می‌گیرند */
export const KANBAN_STATUSES = TASK_STATUSES.filter((status) => status.value !== 'canceled');

/** @typedef {'todo'|'doing'|'done'} KanbanLane */

/**
 * @typedef {Object} Attachment
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {number} size            بایت
 * @property {string} kind            image | document | sheet | other
 * @property {string} uploadedAt
 * @property {string} uploadedBy
 */

/**
 * @typedef {Object} TaskComment
 * @property {string} id
 * @property {string} authorId
 * @property {string} body
 * @property {string} createdAt
 */

/* ───────────────────────────── ابلاغ ───────────────────────────── */

/**
 * @typedef {Object} TaskAssignment
 * @property {string} id
 * @property {string} taskId
 * @property {string[]} recipientIds
 * @property {string[]} unitIds
 * @property {AccessLevel} accessLevel
 * @property {string} dueDate
 * @property {boolean} requireReport
 * @property {ReportCycle} reportCycle
 * @property {boolean} notifyInApp
 * @property {boolean} notifyEmail
 * @property {string} issuedById
 * @property {string} issuedAt
 * @property {AssignmentState} state
 * @property {string} seenAt
 * @property {string} respondedAt
 * @property {string} returnNote
 * @property {string} note
 */

/** @typedef {'view'|'comment'|'edit'|'manage'} AccessLevel */

export const ACCESS_LEVELS = [
  { value: 'view', label: 'فقط مشاهده' },
  { value: 'comment', label: 'مشاهده و ثبت نظر' },
  { value: 'edit', label: 'ویرایش تسک' },
  { value: 'manage', label: 'مدیریت کامل' },
];

/** @typedef {'sent'|'seen'|'accepted'|'returned'|'rejected'} AssignmentState */

export const ASSIGNMENT_STATES = [
  { value: 'sent', label: 'ارسال‌شده', tone: 'neutral' },
  { value: 'seen', label: 'مشاهده‌شده', tone: 'info' },
  { value: 'accepted', label: 'پذیرفته‌شده', tone: 'ok' },
  { value: 'returned', label: 'بازگشتی برای اصلاح', tone: 'warn' },
  { value: 'rejected', label: 'ردشده', tone: 'danger' },
];

/** @typedef {'daily'|'weekly'|'monthly'|'none'} ReportCycle */

export const REPORT_CYCLES = [
  { value: 'none', label: 'گزارش لازم نیست' },
  { value: 'daily', label: 'روزانه' },
  { value: 'weekly', label: 'هفتگی' },
  { value: 'monthly', label: 'ماهانه' },
];

/* ───────────────────────────── یادآوری ───────────────────────────── */

/**
 * @typedef {Object} Reminder
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {'task'|'event'|'deadline'|'sop'} targetType
 * @property {string} targetId
 * @property {number} offsetMinutes     دقیقه پیش از سررسید (۰ = همان لحظه)
 * @property {Recurrence} recurrence
 * @property {Priority} priority
 * @property {boolean} enabled
 * @property {string} userId
 * @property {string} createdAt
 */

/** @typedef {'none'|'daily'|'weekly'|'monthly'|'yearly'} Recurrence */

export const RECURRENCES = [
  { value: 'none', label: 'بدون تکرار' },
  { value: 'daily', label: 'روزانه' },
  { value: 'weekly', label: 'هفتگی' },
  { value: 'monthly', label: 'ماهانه' },
  { value: 'yearly', label: 'سالانه' },
];

export const OFFSET_PRESETS = [
  { value: 0, label: 'در لحظهٔ سررسید' },
  { value: 60, label: '۱ ساعت قبل' },
  { value: 180, label: '۳ ساعت قبل' },
  { value: 1440, label: '۱ روز قبل' },
  { value: 2880, label: '۲ روز قبل' },
  { value: 10080, label: '۱ هفته قبل' },
];

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {NotificationKind} kind
 * @property {Priority} priority
 * @property {string} at                میلادی ISO + ساعت
 * @property {boolean} read
 * @property {string} linkView          نمای مقصد در ماژول
 * @property {string} linkId
 */

/** @typedef {'reminder'|'assignment'|'overdue'|'approval'|'system'} NotificationKind */

export const NOTIFICATION_KINDS = [
  { value: 'reminder', label: 'یادآوری', tone: 'accent' },
  { value: 'assignment', label: 'ابلاغ', tone: 'info' },
  { value: 'overdue', label: 'عقب‌افتاده', tone: 'danger' },
  { value: 'approval', label: 'تأیید', tone: 'gold' },
  { value: 'system', label: 'سیستمی', tone: 'neutral' },
];

/**
 * @typedef {Object} ReminderSettings
 * @property {boolean} inApp
 * @property {boolean} email
 * @property {boolean} dailyDigest
 * @property {string} digestTime       HH:mm
 * @property {number} defaultOffset
 * @property {boolean} quietHours
 * @property {string} quietFrom
 * @property {string} quietTo
 * @property {string[]} mutedKinds
 */

/* ───────────────────────────── مالی ───────────────────────────── */

/**
 * @typedef {Object} FinancialTransaction
 * @property {string} id
 * @property {string} code
 * @property {string} title
 * @property {'income'|'direct-cost'|'indirect-cost'} kind
 * @property {number} amount           تومان
 * @property {string} date             میلادی ISO
 * @property {string} projectId
 * @property {string} unitId
 * @property {PaymentMode} payment     حالت پرداخت
 * @property {string} reference        شمارهٔ پیگیری/سند
 * @property {string} party            طرف حساب (پرداخت‌کننده یا دریافت‌کننده)
 * @property {string} note
 * @property {string} createdBy
 * @property {string} createdAt
 */

/** @typedef {'income'|'direct-cost'|'indirect-cost'} TransactionKind */

export const TRANSACTION_KINDS = [
  { value: 'income', label: 'درآمد', tone: 'ok', sign: 1 },
  { value: 'direct-cost', label: 'هزینهٔ مستقیم', tone: 'warn', sign: -1 },
  { value: 'indirect-cost', label: 'هزینهٔ غیرمستقیم', tone: 'danger', sign: -1 },
];

/*
 * حالت پرداخت — فقط دو حالت، چون درگاه پرداخت آنلاین هنوز به پروژه وصل نشده
 * است (`PAYMENT_STATUS` در `services/pricing` هم همین را می‌گوید). تا وقتی
 * درگاه واقعی نیامده، هر تسویه یا از مسیر بانکی انجام می‌شود یا مستقیم
 * (حضوری/نقدی)؛ ثبت حالت سومی معنا ندارد و گزارش را نادرست می‌کند.
 */

/** @typedef {'bank'|'direct'} PaymentMode */

export const PAYMENT_MODES = [
  { value: 'bank', label: 'بانکی', tone: 'info', hint: 'انتقال بانکی، حواله یا کارت‌به‌کارت' },
  { value: 'direct', label: 'مستقیم', tone: 'accent', hint: 'تسویهٔ مستقیم و حضوری' },
];

/* پیش‌فرض حالت پرداخت — بانکی، چون مسیر رسمی تسویه‌های پروژه است */
export const DEFAULT_PAYMENT_MODE = 'bank';

/**
 * @typedef {Object} FinancialSummary
 * @property {number} inflow          مجموع پول ورودی
 * @property {number} directCost
 * @property {number} indirectCost
 * @property {number} expenses        مجموع هزینه‌ها
 * @property {number} grossProfit     سود ناخالص = درآمد − هزینهٔ مستقیم
 * @property {number} netProfit       سود خالص = درآمد − همهٔ هزینه‌ها
 * @property {number} margin          درصد حاشیهٔ سود
 * @property {number} transactions    تعداد تراکنش‌ها
 * @property {number} monthlyAverage  میانگین درآمد ماهانه
 */

/* ───────────────────────────── SOP ───────────────────────────── */

/**
 * @typedef {Object} SOP
 * @property {string} id
 * @property {string} title
 * @property {string} code            مثل SOP-CNT-001
 * @property {string} unitId          واحد مالک
 * @property {string} authorId
 * @property {string} reviewerId      ناظر / تأییدکننده
 * @property {string} version         مثل ۱٫۲
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} nextReviewAt
 * @property {SopStatus} status
 * @property {string} purpose         هدف
 * @property {string} scope           دامنهٔ کاربرد
 * @property {string} responsibilities
 * @property {string} prerequisites
 * @property {string} body            HTML مراحل اجرا
 * @property {ChecklistItem[]} checklist
 * @property {KpiItem[]} kpis
 * @property {string} pitfalls        خطاهای رایج
 * @property {Attachment[]} attachments
 * @property {SOPVersion[]} versions
 * @property {TaskComment[]} comments
 * @property {string} changeNote
 */

/** @typedef {'draft'|'review'|'approved'|'obsolete'} SopStatus */

export const SOP_STATUSES = [
  { value: 'draft', label: 'پیش‌نویس', tone: 'neutral' },
  { value: 'review', label: 'در حال بررسی', tone: 'warn' },
  { value: 'approved', label: 'تأییدشده', tone: 'ok' },
  { value: 'obsolete', label: 'منسوخ‌شده', tone: 'danger' },
];

/**
 * @typedef {Object} SOPVersion
 * @property {string} id
 * @property {string} version
 * @property {string} savedAt
 * @property {string} authorId
 * @property {string} note
 * @property {SopStatus} status
 * @property {string} snapshot        HTML کامل نسخه
 */

/**
 * @typedef {Object} ChecklistItem
 * @property {string} id
 * @property {string} text
 * @property {boolean} done
 */

/**
 * @typedef {Object} KpiItem
 * @property {string} id
 * @property {string} title
 * @property {string} target
 * @property {string} measure
 */

/* ───────────────────────────── فعالیت ───────────────────────────── */

/**
 * @typedef {Object} ActivityLog
 * @property {string} id
 * @property {string} actorId
 * @property {string} action          متن کوتاه عمل
 * @property {string} targetType      task | event | sop | assignment | reminder
 * @property {string} targetId
 * @property {string} targetTitle
 * @property {string} detail
 * @property {string} at              میلادی ISO + ساعت
 */

/* ───────────────────────────── کمکی‌های واژگان ───────────────────────────── */

export function optionOf(list, value) {
  return list.find((item) => item.value === value) ?? null;
}

export function labelOf(list, value, fallback = '—') {
  return optionOf(list, value)?.label ?? fallback;
}

export function toneOf(list, value, fallback = 'neutral') {
  return optionOf(list, value)?.tone ?? fallback;
}

export function colorOf(list, value, fallback = 'muted') {
  return optionOf(list, value)?.color ?? fallback;
}

/* ترتیب اولویت برای مرتب‌سازی نزولی */
export const priorityRank = (value) => optionOf(PRIORITIES, value)?.rank ?? 0;

/* آیا وضعیت، تسک را «باز» نگه می‌دارد؟ */
export const isOpenStatus = (value) => !['done', 'canceled'].includes(value);
