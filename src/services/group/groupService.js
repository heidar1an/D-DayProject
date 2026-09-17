/*
 * ── سرویس اشتراک گروهی («با رفقا درس بخون») — لایهٔ `#group` ──
 *
 * چرا جدا از UI: قاعدهٔ معماری پروژه. UI فقط رندر می‌کند؛ هر متن، هر درصد و هر
 * مبلغ از همین‌جا می‌آید.
 *
 * ⚠️ هیچ عددی این‌جا نوشته نمی‌شود. پلن گروهی همان `getPlanById('group')` است
 * (ظرفیت ۲ تا ۳ نفر، تخفیف پله‌ای) و محاسبهٔ مبلغ همان `quote()` تعرفه‌هاست. پس
 * صفحهٔ `#pricing` و این لایه هرگز از هم جدا نمی‌افتند: تغییر قیمت یا درصد، فقط
 * در `pricingService.js` انجام می‌شود و هر دو صفحه خودشان را تطبیق می‌دهند.
 *
 * وضعیت واقعی (صادقانه): کد اشتراک روی **همین دستگاه** ساخته و نگه داشته
 * می‌شود. یعنی «ساخت گروه و گرفتن کد» کامل کار می‌کند و «پیوستن به گروهی که روی
 * این دستگاه ساخته شده» هم کار می‌کند؛ ولی کدی که دوستت از دستگاه خودش برایت
 * فرستاده، تا وقتی سرور وصل نشده قابل بررسی نیست — و همان را صریح می‌گوید
 * (`GROUP_CODE_NOT_FOUND`) به‌جای اینکه تیک سبز بی‌پشتوانه بزند.
 *
 * هویت: تا وقتی سرور نیست، «من» با یک شناسهٔ محلی روی همین دستگاه شناخته
 * می‌شود (نه با شمارهٔ موبایل) تا گروه ساخته‌شده با ورود/خروج از حساب گم نشود.
 * بعد از اتصال، شناسهٔ حساب جای آن را می‌گیرد و `getViewerId` حذف می‌شود.
 *
 * قرارداد REST آینده (بدنهٔ توابع به fetch تبدیل می‌شود، امضاها ثابت می‌مانند):
 *   GET    /api/group/tiers                        → { tiers: GroupTier[] }
 *   GET    /api/group/groups/:code                 → { group: Group }
 *   POST   /api/group/groups                       → { group: Group }
 *          body: { cycleId, seats, displayName }
 *   POST   /api/group/groups/:code/join            → { group: Group }
 *   POST   /api/group/groups/:id/code              → { code: string }   (چرخش کد — مالک)
 *   DELETE /api/group/groups/:id/members/:memberId → { group: Group }   (حذف عضو — مالک)
 *   DELETE /api/group/groups/:id                   → { success: true }  (انحلال — مالک)
 */

import {
  PAYMENT_STATUS,
  PRICING_META,
  formatNumberFa,
  formatPercentFa,
  formatToman,
  getBillingCycles,
  getCycleById,
  getPlanById,
  quote,
  toFa,
} from '../pricing/pricingService';

/* قالب‌بندی اعداد هم از همان سرویس تعرفه می‌آید — دو نسخه نمی‌شود */
export { formatNumberFa, formatPercentFa, formatToman, toFa };

/* ── کلیدهای ذخیره‌سازی (نسخه‌دار، قاعدهٔ پروژه) ── */
const REGISTRY_KEY = 'tapesh:group:v1';
const VIEWER_KEY = 'tapesh:group:v1:viewer';

const GROUP_PLAN_ID = 'group';

/*
 * مسیر این لایه — تنها منبع حقیقت.
 * دو جای دیگر هم به همین صفحه لینک می‌دهند (کارت «با رفقا درس بخون» در صفحهٔ
 * اصلی و CTA پلن گروهی در `#pricing`). اگر روزی مسیر عوض شود، فقط همین‌جا
 * عوض می‌شود — نه چند رشتهٔ دستی در UI (تلهٔ ۱۰ فایل README).
 */
export const GROUP_PAGE_HASH = '#group';

/*
 * الفبای کد اشتراک: بدون I و O و بدون ۰ و ۱.
 * چرا: کد با پیام‌رسان دست‌به‌دست می‌شود و این چهار نویسه بیشترین اشتباه تایپ
 * را می‌سازند (I/l/۱ و O/۰). کد فقط با حرف بزرگ و رقم ساخته می‌شود.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PREFIX = 'TP-';
const CODE_BODY_LENGTH = 6;
const CODE_PATTERN = /^TP-[A-Z2-9]{6}$/;

/* ── خطاها: کلید ماشین‌خوان + پیام فارسی. UI هرگز متن خطا نمی‌سازد. ── */
export const GROUP_ERRORS = {
  CODE_FORMAT: 'قالب کد درست نیست؛ کد اشتراک تپش با TP- شروع می‌شود و ۶ نویسه دارد.',
  CODE_NOT_FOUND:
    'گروهی با این کد روی این دستگاه پیدا نشد. بررسی کدهای دیگران کار سرور است و آن اتصال هنوز برقرار نشده است.',
  CODE_RETIRED: 'این کد بازنشسته شده است؛ میزبان کد تازه‌ای ساخته و کد قبلی از کار افتاده.',
  GROUP_FULL: 'ظرفیت این گروه پر شده است؛ با میزبان برای گروه تازه هماهنگ کن.',
  ALREADY_MEMBER: 'تو همین حالا عضو این گروهی.',
  ALREADY_IN_GROUP: 'تو در یک گروه دیگر عضوی؛ اول از آن گروه خارج شو.',
  NOT_OWNER: 'این کار فقط برای میزبان گروه است.',
  NOT_MEMBER: 'تو عضو این گروه نیستی.',
  STORAGE: 'ذخیره‌سازی این مرورگر در دسترس نیست؛ گروه ساخته نشد.',
  UNAVAILABLE: 'سرویس اشتراک گروهی موقتاً در دسترس نیست.',
};

const fail = (code) => ({ ok: false, error: { code, message: GROUP_ERRORS[code] ?? GROUP_ERRORS.UNAVAILABLE } });

/* ── سرآغاز لایه ── */
const GROUP_INTRO = {
  eyebrow: 'اشتراک گروهی تپش',
  title: 'با رفقا درس بخون',
  lead:
    'اشتراک گروهی همان پوشش کامل اشتراک پرو است، فقط بین ۲ تا ۳ نفر تقسیم می‌شود. هر نفر بیشتر، تخفیف بیشتر — و یک کد که همه را به یک گروه وصل می‌کند.',
  footnote:
    'کد اشتراک روی همین دستگاه ساخته می‌شود و درست کار می‌کند. اتصال گروه‌های روی دستگاه‌های دیگر کار سرور است که هنوز وصل نشده است.',
};

/*
 * ── مراحل کار ──
 * چهار مرحلهٔ استاندارد اشتراک گروهی: ساخت → کد → پیوستن → فعال‌سازی.
 */
const GROUP_STEPS = [
  {
    id: 'create',
    index: '۰۱',
    title: 'گروه را بساز',
    text: 'ظرفیت (۲ یا ۳ نفر) و دورهٔ پرداخت را انتخاب کن؛ پلن گروهی همان امکانات پرو را برای هر نفر می‌دهد.',
  },
  {
    id: 'code',
    index: '۰۲',
    title: 'کد اشتراک بگیر',
    text: 'تپش یک کد یکتا می‌سازد. کد را کپی کن یا لینک دعوت را برای رفقایت بفرست.',
  },
  {
    id: 'join',
    index: '۰۳',
    title: 'رفقا با کد وارد شوند',
    text: 'هر نفر کد را در همین صفحه وارد می‌کند و همان لحظه عضو گروه می‌شود؛ ظرفیت گروه یکی‌یکی پر می‌شود.',
  },
  {
    id: 'activate',
    index: '۰۴',
    title: 'گروه کامل، اشتراک فعال',
    text: 'وقتی ظرفیت پر شد، مبلغ گروه با تخفیف همان تعداد نفر نهایی می‌شود و پرداخت گروه یک‌جا انجام می‌شود.',
  },
];

/* ── پرسش‌های پرتکرار ── */
const GROUP_FAQ = [
  {
    id: 'code-share',
    question: 'کد اشتراک را چطور به رفقا بدهم؟',
    answer:
      'دو راه داری: خودِ کد را کپی کنی و بفرستی، یا لینک دعوت را بفرستی که کد را خودش در فرم پر می‌کند. هر دو از کارت گروه، بلافاصله بعد از ساخت، در دسترس‌اند.',
  },
  {
    id: 'code-rotate',
    question: 'اگر کد دست کسی بیفتد که نباید؟',
    answer:
      'میزبان هر وقت بخواهد می‌تواند کد تازه بسازد. با این کار کد قبلی بازنشسته می‌شود و از آن به بعد پیام «کد بازنشسته شده» می‌گیرد؛ اعضای فعلی گروه دست‌نخورده می‌مانند.',
  },
  {
    id: 'seats',
    question: 'می‌شود بعداً نفرات را عوض کرد؟',
    answer:
      'ظرفیت گروه در لحظهٔ ساخت انتخاب می‌شود و مبنای تخفیف است. تغییر ظرفیت یعنی ساخت گروه تازه؛ پس اگر شک داری، ظرفیت بزرگ‌تر را انتخاب کن — تا وقتی پُر نشود، مبلغ نهایی روی نفرات واقعی حساب می‌شود.',
  },
  {
    id: 'payment',
    question: 'پرداخت گروه چطور انجام می‌شود؟',
    answer:
      'پرداخت گروهی یک‌جا و توسط میزبان انجام می‌شود؛ بقیه فقط با کد به گروه می‌پیوندند. درگاه پرداخت آنلاین تپش هنوز متصل نشده است، پس این مرحله فعلاً «در حال اتصال» است و هیچ مبلغی بدون تأیید نهایی گرفته نمی‌شود.',
  },
];

/* ═══ ذخیره‌سازی ═══ */

function readRegistry() {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(REGISTRY_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (group) => group && typeof group.code === 'string' && Array.isArray(group.members),
        )
      : [];
  } catch {
    return [];
  }
}

function writeRegistry(groups) {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(groups));
    return true;
  } catch {
    return false;
  }
}

/*
 * شناسهٔ «من» روی این دستگاه. با شمارهٔ موبایل ساخته نمی‌شود تا گروه بعد از
 * ورود/خروج از حساب گم نشود (توضیح بالای فایل). نبودِ `crypto` هم مشکلی
 * نمی‌سازد — فقط یک شناسهٔ محلی است، نه چیز امنیتی.
 */
export function getViewerId() {
  if (typeof window === 'undefined') return 'local';

  try {
    const existing = window.localStorage.getItem(VIEWER_KEY);
    if (existing) return existing;

    const created = `local-${randomToken(10)}`;
    window.localStorage.setItem(VIEWER_KEY, created);
    return created;
  } catch {
    return 'local';
  }
}

function randomToken(length) {
  const bytes = new Uint8Array(length);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function generateCode(taken) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = `${CODE_PREFIX}${randomToken(CODE_BODY_LENGTH)}`;
    if (!taken.has(code)) return code;
  }

  return null;
}

/*
 * نام پیش‌فرض برای فهرست اعضا: فقط نام پروفایل.
 * ⚠️ عمداً به شمارهٔ موبایل برنمی‌گردد (برخلاف `getDisplayName` هدر سایت) —
 * این نام در گروهی دیده می‌شود که ممکن است چند نفر دیگر هم عضو آن باشند.
 */
export function defaultDisplayName(user) {
  const profile = user?.profile ?? {};
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

  return fullName || profile.username || '';
}

/* ═══ کد اشتراک ═══ */

/*
 * کد را به شکل استاندارد برمی‌گرداند: حرف بزرگ، بدون فاصله/خط تیرهٔ اضافه و با
 * پیشوند TP-. ارقام فارسی و لاتین هر دو پذیرفته می‌شوند، چون کاربر کد را از
 * پیام‌رسان کپی می‌کند و ممکن است با ارقام فارسی رسیده باشد.
 */
export function normalizeCode(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .toUpperCase()
    .replace(/[\s\-_]/g, '');

  const body = cleaned.startsWith('TP') ? cleaned.slice(2) : cleaned;
  return body ? `${CODE_PREFIX}${body}` : '';
}

export function validateCode(raw) {
  const code = normalizeCode(raw);

  if (!CODE_PATTERN.test(code)) return { ok: false, code, error: GROUP_ERRORS.CODE_FORMAT };
  return { ok: true, code, error: null };
}

export function findGroupByCode(raw) {
  const { ok, code } = validateCode(raw);
  if (!ok) return null;

  return readRegistry().find((group) => group.code === code) ?? null;
}

/* کدهای بازنشسته هم نگه داشته می‌شوند تا پیام «کد منقضی» بدهیم، نه «کد نامعتبر» */
function wasRetired(code) {
  return readRegistry().some(
    (group) => Array.isArray(group.retiredCodes) && group.retiredCodes.includes(code),
  );
}

/* ═══ پلن و پله‌های تخفیف ═══ */

export const getGroupPlan = () => getPlanById(GROUP_PLAN_ID);
export const getCycles = () => getBillingCycles();
export const getCycle = (cycleId) => getCycleById(cycleId);
export const getPaymentStatus = () => PAYMENT_STATUS;
/* همان پرچم شفافیت مبالغ صفحهٔ تعرفه‌ها — دو یادداشت جدا نمی‌سازیم */
export const getAmountsMeta = () => PRICING_META;
export const getIntro = () => GROUP_INTRO;
export const getSteps = () => GROUP_STEPS;
export const getFaq = () => GROUP_FAQ;

export function getCapacityRange() {
  const plan = getGroupPlan();
  if (!plan?.seats) return { min: 1, max: 1, options: [1] };

  const options = [];
  for (let seats = plan.seats.min; seats <= plan.seats.max; seats += 1) options.push(seats);

  return { min: plan.seats.min, max: plan.seats.max, options };
}

export function clampSeats(seats) {
  const plan = getGroupPlan();
  const range = getCapacityRange();
  const raw = Number(seats);

  if (!plan?.seats || !Number.isFinite(raw)) return plan?.seats?.defaultSeats ?? range.min;
  return Math.min(range.max, Math.max(range.min, Math.round(raw)));
}

/*
 * پله‌های تخفیف برای یک دورهٔ پرداخت. `isBest` را خودِ سرویس تعیین می‌کند
 * (بیشترین تخفیف) تا UI هیچ درصدی را «انتخاب» نکند.
 */
export function getSeatTiers(cycleId = 'monthly') {
  const plan = getGroupPlan();
  if (!plan) return [];

  const tiers = getCapacityRange().options.map((seats) => {
    const price = quote({ planId: plan.id, cycleId, seats });

    return {
      id: `seats-${seats}`,
      seats,
      label: `${toFa(seats)} نفر`,
      /* جایی که بعد از ساخت گروه (میزبان) خالی می‌ماند — UI خودش حساب نمی‌کند */
      openSeats: Math.max(0, seats - 1),
      months: price?.months ?? 1,
      discountPercent: price?.discountPercent ?? 0,
      perMonth: price?.perMonth ?? plan.monthlyAmount,
      listPerMonth: price?.listPerMonth ?? plan.monthlyAmount,
      savedPerMonth: price?.savedPerMonth ?? 0,
      perSeatTotal: price?.perSeatTotal ?? 0,
      total: price?.total ?? 0,
      savedTotal: price?.savedTotal ?? 0,
      currency: price?.currency ?? '',
    };
  });

  const best = tiers.reduce(
    (acc, tier) => (!acc || tier.discountPercent > acc.discountPercent ? tier : acc),
    null,
  );

  return tiers.map((tier) => ({ ...tier, isBest: Boolean(best) && tier.seats === best.seats }));
}

export function getTier(cycleId, seats) {
  const count = clampSeats(seats);
  return getSeatTiers(cycleId).find((tier) => tier.seats === count) ?? null;
}

/* ═══ خواندن گروه ═══ */

export function getMyGroup(viewerId) {
  if (!viewerId) return null;

  return (
    readRegistry().find((group) => group.members.some((member) => member.id === viewerId)) ?? null
  );
}

export function getGroupById(groupId) {
  return readRegistry().find((group) => group.id === groupId) ?? null;
}

/*
 * نمای آمادهٔ نمایش گروه: هیچ محاسبه‌ای در UI نیست.
 * مبلغ گروه روی **نفرات واقعی** حساب می‌شود، نه ظرفیت — تا گروه نیمه‌پر، مبلغ
 * گروه کامل را وعده ندهد.
 */
export function summarizeGroup(group, viewerId) {
  if (!group) return null;

  const filled = group.members.length;
  const capacity = clampSeats(group.seats);
  const activeSeats = Math.max(1, Math.min(filled, capacity));
  const price = quote({ planId: GROUP_PLAN_ID, cycleId: group.cycleId, seats: activeSeats });
  const isFull = filled >= capacity;
  const isOwner = group.ownerId === viewerId;
  const capacityPrice = quote({ planId: GROUP_PLAN_ID, cycleId: group.cycleId, seats: capacity });
  /*
   * تعداد نفری که **واقعاً** مبلغ روی آن حساب شده — نه تعداد اعضای فعلی.
   * چرا جدا نگه داشته می‌شود: پلن گروهی حداقل ۲ نفره است، پس `quote` یک گروه
   * یک‌نفره را روی حداقل (۲) قیمت می‌زند. اگر برچسب با `filled` ساخته شود،
   * «مبلغ گروه برای ۱ نفر» می‌نویسد در حالی که مبلغ دو نفر است — یعنی عدد
   * درست و متن گمراه‌کننده. UI باید همین `billedSeats` را نشان دهد.
   */
  const billedSeats = price?.seats ?? activeSeats;

  return {
    id: group.id,
    code: group.code,
    cycleId: group.cycleId,
    cycleLabel: getCycle(group.cycleId).label,
    months: getCycle(group.cycleId).months,
    capacity,
    filled,
    openSeats: Math.max(0, capacity - filled),
    /* نفری که مبلغ رویش حساب شده — ممکن است از `filled` بیشتر باشد (حداقل پلن) */
    billedSeats,
    isBelowMinimum: billedSeats > filled,
    isFull,
    isOwner,
    members: group.members.map((member) => ({
      ...member,
      isOwner: member.id === group.ownerId,
      isViewer: member.id === viewerId,
    })),
    perMonth: price?.perMonth ?? 0,
    perSeatTotal: price?.perSeatTotal ?? 0,
    total: price?.total ?? 0,
    savedTotal: price?.savedTotal ?? 0,
    discountPercent: price?.discountPercent ?? 0,
    currency: price?.currency ?? '',
    /* مبلغ گروهِ کامل — برای نشان‌دادن «اگر پر شود» */
    fullTotal: capacityPrice?.total ?? 0,
    fullDiscountPercent: capacityPrice?.discountPercent ?? 0,
    status: isFull
      ? { id: 'full', label: 'ظرفیت پر — آمادهٔ پرداخت' }
      : { id: 'open', label: `منتظر ${toFa(capacity - filled)} نفر` },
  };
}

/* لینک دعوت — همان مسیر لایه با کد در query تا فرمِ پیوستن خودش پُر شود */
export function buildInviteLink(code) {
  if (typeof window === 'undefined') return `#group?join=${code}`;

  return `${window.location.origin}${window.location.pathname}#group?join=${code}`;
}

/*
 * تاریخ پیوستن، شمسی و بدون کتابخانه (قاعدهٔ پروژه: `Intl`).
 * اگر مرورگر تقویم فارسی نداشت، به تاریخ میلادی کوتاه برمی‌گردد تا چیزی نشکند.
 */
export function formatJoinDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(date);
  }
}

export function readInviteCode() {
  if (typeof window === 'undefined') return '';

  const { hash } = window.location;
  const query = hash.startsWith('#group?') ? hash.slice('#group?'.length) : '';

  try {
    return new URLSearchParams(query).get('join') ?? '';
  } catch {
    return '';
  }
}

/* ═══ نوشتن گروه ═══ */

export function createGroup({ viewerId, displayName, cycleId = 'monthly', seats }) {
  if (failureMode) return fail('UNAVAILABLE');
  if (!viewerId) return fail('STORAGE');
  if (getMyGroup(viewerId)) return fail('ALREADY_IN_GROUP');

  const groups = readRegistry();
  const code = generateCode(new Set(groups.map((group) => group.code)));
  if (!code) return fail('UNAVAILABLE');

  const group = {
    id: `grp-${randomToken(8)}`,
    code,
    ownerId: viewerId,
    cycleId: getCycle(cycleId).id,
    seats: clampSeats(seats),
    createdAt: new Date().toISOString(),
    members: [
      {
        id: viewerId,
        name: displayName?.trim() || 'میزبان',
        role: 'owner',
        joinedAt: new Date().toISOString(),
      },
    ],
    retiredCodes: [],
  };

  if (!writeRegistry([...groups, group])) return fail('STORAGE');

  return { ok: true, group, error: null };
}

export function joinGroup({ viewerId, displayName, code }) {
  if (failureMode) return fail('UNAVAILABLE');

  const { ok, code: normalized, error } = validateCode(code);
  if (!ok) return { ok: false, error: { code: 'CODE_FORMAT', message: error } };

  const groups = readRegistry();
  const index = groups.findIndex((group) => group.code === normalized);

  if (index === -1) {
    return fail(wasRetired(normalized) ? 'CODE_RETIRED' : 'CODE_NOT_FOUND');
  }

  const group = groups[index];
  const isMember = group.members.some((member) => member.id === viewerId);

  /* عضو بودن خطا نیست؛ نتیجه همان گروه است و UI می‌گوید «از قبل عضو بودی» */
  if (isMember) return { ok: true, group, already: true, error: null };

  if (getMyGroup(viewerId)) return fail('ALREADY_IN_GROUP');
  if (group.members.length >= clampSeats(group.seats)) return fail('GROUP_FULL');

  const next = {
    ...group,
    members: [
      ...group.members,
      {
        id: viewerId,
        name: displayName?.trim() || 'عضو تازه',
        role: 'member',
        joinedAt: new Date().toISOString(),
      },
    ],
  };

  const nextGroups = [...groups];
  nextGroups[index] = next;

  if (!writeRegistry(nextGroups)) return fail('STORAGE');

  return { ok: true, group: next, already: false, error: null };
}

export function rotateCode({ viewerId, groupId }) {
  if (failureMode) return fail('UNAVAILABLE');

  const groups = readRegistry();
  const index = groups.findIndex((group) => group.id === groupId);
  if (index === -1) return fail('NOT_MEMBER');
  if (groups[index].ownerId !== viewerId) return fail('NOT_OWNER');

  const code = generateCode(new Set(groups.flatMap((group) => [group.code, ...(group.retiredCodes ?? [])])));
  if (!code) return fail('UNAVAILABLE');

  const next = {
    ...groups[index],
    code,
    retiredCodes: [groups[index].code, ...(groups[index].retiredCodes ?? [])].slice(0, 12),
  };

  const nextGroups = [...groups];
  nextGroups[index] = next;

  if (!writeRegistry(nextGroups)) return fail('STORAGE');

  return { ok: true, group: next, code, error: null };
}

export function removeMember({ viewerId, groupId, memberId }) {
  if (failureMode) return fail('UNAVAILABLE');

  const groups = readRegistry();
  const index = groups.findIndex((group) => group.id === groupId);
  if (index === -1) return fail('NOT_MEMBER');
  if (groups[index].ownerId !== viewerId) return fail('NOT_OWNER');
  if (groups[index].ownerId === memberId) return fail('NOT_OWNER');

  const next = {
    ...groups[index],
    members: groups[index].members.filter((member) => member.id !== memberId),
  };

  const nextGroups = [...groups];
  nextGroups[index] = next;

  if (!writeRegistry(nextGroups)) return fail('STORAGE');

  return { ok: true, group: next, error: null };
}

/*
 * خروج از گروه. میزبان با خروج، گروه را منحل می‌کند (گروه بدون میزبان معنا
 * ندارد) و اعضا آزاد می‌شوند تا گروه تازه بسازند یا به گروه دیگری بپیوندند.
 */
export function leaveGroup({ viewerId, groupId }) {
  if (failureMode) return fail('UNAVAILABLE');

  const groups = readRegistry();
  const index = groups.findIndex((group) => group.id === groupId);
  if (index === -1) return fail('NOT_MEMBER');

  const group = groups[index];
  if (!group.members.some((member) => member.id === viewerId)) return fail('NOT_MEMBER');

  const isOwner = group.ownerId === viewerId;
  const nextGroups = isOwner
    ? groups.filter((item) => item.id !== groupId)
    : groups.map((item, position) =>
        position === index
          ? { ...item, members: item.members.filter((member) => member.id !== viewerId) }
          : item,
      );

  if (!writeRegistry(nextGroups)) return fail('STORAGE');

  return { ok: true, disbanded: isOwner, error: null };
}

/* ── تست حالت خطا از کنسول: __groupService.__setFailure(true) ── */
let failureMode = false;

export function __setFailure(next) {
  failureMode = Boolean(next);
  return failureMode;
}

if (typeof window !== 'undefined') {
  window.__groupService = { __setFailure, getViewerId, readRegistry };
}
