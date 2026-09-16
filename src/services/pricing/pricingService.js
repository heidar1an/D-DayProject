/*
 * سرویس تعرفه — تنها منبع حقیقتِ داده و منطق قیمت لایهٔ «تعرفه‌ها».
 *
 * چرا این فایل جدا از UI است: قاعدهٔ معماری پروژه این است که UI هرگز مستقیم به
 * داده و محاسبه دست نمی‌زند. پس هر عدد، درصد تخفیف، ضریب چرخهٔ پرداخت و متن
 * قابل‌نمایش از همین‌جا می‌آید و کامپوننت‌ها فقط رندر می‌کنند.
 *
 * ⚠️ مبالغ این فایل «نمونه» هستند تا طراحی کامل و قابل‌اجرا باشد. مالک محصول
 * باید آن‌ها را در `PRICING_AMOUNTS` بگذارد و `amountsConfirmed` را true کند؛
 * تا آن لحظه، UI خودش یک یادداشت شفاف نشان می‌دهد (هیچ عددی جعل نمی‌شود).
 *
 * قرارداد REST آینده (بدنهٔ توابع به fetch تبدیل می‌شود، امضاها ثابت می‌مانند):
 *   GET  /api/pricing/plans                      → { plans: PricingPlan[] }
 *   GET  /api/pricing/cycles                     → { cycles: BillingCycle[] }
 *   GET  /api/pricing/capabilities               → { rows: CapabilityRow[] }
 *   POST /api/pricing/quote                      → { quote: PriceQuote }
 *        body: { planId, cycleId, seats }
 */

/* ── ارقام فارسی: هر لایه نسخهٔ خودش را دارد (قاعدهٔ پروژه) ── */
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const toFa = (value) => String(value ?? '').replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/*
 * ── مبالغ نمونه (تومان، ماهانه برای یک نفر) ──
 * تنها جایی که عدد قیمت نوشته می‌شود. بقیهٔ سیستم از همین‌جا محاسبه می‌کند.
 */
const PRICING_AMOUNTS = {
  regular: 249000,
  pro: 449000,
  group: 199000,
};

/*
 * `false` یعنی مبالغ تأییدنشده‌اند. UI بر اساس همین پرچم، یادداشت شفافیت را
 * نشان می‌دهد و هرگز مبلغی را «قطعی» جا نمی‌زند.
 */
export const PRICING_META = {
  currency: 'تومان',
  amountsConfirmed: false,
  note: 'مبالغ این صفحه نمونه است و پیش از خرید نهایی تأیید می‌شود.',
};

/* ── چرخه‌های پرداخت ── */
export const BILLING_CYCLES = [
  { id: 'monthly', label: 'ماهانه', months: 1, discountPercent: 0, hint: 'انعطاف کامل' },
  { id: 'quarterly', label: 'سه‌ماهه', months: 3, discountPercent: 10, hint: '۱۰٪ تخفیف' },
  { id: 'yearly', label: 'سالانه', months: 12, discountPercent: 20, hint: '۲۰٪ تخفیف' },
];

/*
 * ── قابلیت‌ها ──
 * `coverage` سطح پوشش هر قابلیت در هر پلن است:
 *   full = کامل · partial = محدود · none = ندارد
 * همهٔ این قابلیت‌ها در محصول واقعی وجود دارند (بخش‌های داشبورد)؛ فقط سطح
 * پوشش در پلن‌ها متفاوت است.
 */
export const CAPABILITY_ROWS = [
  {
    id: 'lessons',
    label: 'درسنامه جامع و میکرو درسنامه',
    short: 'درسنامه',
    hint: 'مسیر آموزشی کامل دروس علوم پایه',
    coverage: { regular: 'full', pro: 'full', group: 'full' },
  },
  {
    id: 'bank',
    label: 'بانک تست علوم پایه',
    short: 'بانک تست',
    hint: 'بانک تست با طبقه‌بندی مبحث و سال',
    coverage: { regular: 'partial', pro: 'full', group: 'full' },
  },
  {
    id: 'builder',
    label: 'آزمون‌ساز شخصی',
    short: 'آزمون‌ساز',
    hint: 'ساخت آزمون بر اساس مبحث، سطح و زمان',
    coverage: { regular: 'partial', pro: 'full', group: 'full' },
  },
  {
    id: 'intl',
    label: 'آزمون‌ها و دوره‌های بین‌الملل',
    short: 'بین‌الملل',
    hint: 'USMLE، PLAB و آزمون‌های مشابه',
    coverage: { regular: 'none', pro: 'full', group: 'full' },
  },
  {
    id: 'review',
    label: 'فلش‌کارت و دفترچهٔ مرور',
    short: 'مرور',
    hint: 'مرور فاصله‌دار با الگوریتم SM-2',
    coverage: { regular: 'partial', pro: 'full', group: 'full' },
  },
  {
    id: 'analytics',
    label: 'تحلیل عملکرد و آنالیز وضعیت',
    short: 'تحلیل',
    hint: 'ریشه‌یابی ضعف‌ها از روی پاسخ‌های واقعی',
    coverage: { regular: 'none', pro: 'full', group: 'full' },
  },
  {
    id: 'ai',
    label: 'تپش هوشمند (دستیار مطالعه)',
    short: 'تپش هوشمند',
    hint: 'پرسش و پاسخ متنی روی محتوای تپش',
    coverage: { regular: 'partial', pro: 'full', group: 'full' },
  },
  {
    id: 'wiki',
    label: 'ویکی تپش و شبکهٔ دانش',
    short: 'ویکی',
    hint: 'دانشنامهٔ پزشکی با گراف مفاهیم',
    coverage: { regular: 'full', pro: 'full', group: 'full' },
  },
  {
    id: 'league',
    label: 'لیگ، رقابت و دستاورد',
    short: 'لیگ',
    hint: 'رتبه‌بندی، چالش و اقتصاد قلب',
    coverage: { regular: 'full', pro: 'full', group: 'full' },
  },
  {
    id: 'support',
    label: 'منتورینگ و پشتیبانی اختصاصی',
    short: 'منتورینگ',
    hint: 'برنامه‌ریزی و رفع اشکال با تیم تپش',
    coverage: { regular: 'none', pro: 'full', group: 'partial' },
  },
];

/* ── پلن‌ها ── */
export const PRICING_PLANS = [
  {
    id: 'regular',
    name: 'عادی',
    kicker: 'شروع منظم',
    tagline: 'برای مطالعهٔ روزمره و ساختن عادت',
    description:
      'مسیرهای آموزشی پایه، درسنامه‌ها و تمرین روزانه؛ همان چیزی که برای شروع منظم لازم داری.',
    accent: 'blue',
    recommended: false,
    monthlyAmount: PRICING_AMOUNTS.regular,
    seats: null,
    cta: { label: 'شروع با اشتراک عادی', mode: 'single' },
    /* «شامل» به‌جای تکرار: امکانات مشترک یک‌بار گفته می‌شوند */
    features: [
      { id: 'lessons', label: 'درسنامهٔ جامع و میکرو درسنامه' },
      { id: 'bank-limited', label: 'دسترسی محدود به بانک تست' },
      { id: 'review-limited', label: 'فلش‌کارت و دفترچهٔ مرور' },
      { id: 'ai-limited', label: 'استفادهٔ محدود از تپش هوشمند' },
      { id: 'wiki', label: 'ویکی تپش و شبکهٔ دانش' },
      { id: 'league', label: 'لیگ، رقابت و دستاورد' },
    ],
  },
  {
    id: 'pro',
    name: 'پرو',
    kicker: 'مسیر کامل',
    tagline: 'برای آمادگی جدی و جمع‌بندی هدفمند',
    description:
      'همهٔ قابلیت‌های تپش بدون سقف: آزمون، تحلیل عملکرد، دستیار هوشمند و پشتیبانی اختصاصی.',
    accent: 'purple',
    recommended: true,
    monthlyAmount: PRICING_AMOUNTS.pro,
    seats: null,
    cta: { label: 'انتخاب اشتراک پرو', mode: 'single' },
    /* ارجاع به پلن پایه، نه تکرار شش خط امکانات مشترک */
    includesRef: 'regular',
    features: [
      { id: 'all', label: 'همهٔ امکانات اشتراک عادی' },
      { id: 'bank-full', label: 'بانک تست بدون سقف' },
      { id: 'builder', label: 'آزمون‌ساز شخصی و آزمون‌های هماهنگ' },
      { id: 'intl', label: 'دوره‌ها و آزمون‌های بین‌الملل' },
      { id: 'analytics', label: 'تحلیل عملکرد و آنالیز وضعیت' },
      { id: 'ai-full', label: 'تپش هوشمند بدون سقف' },
      { id: 'support', label: 'منتورینگ و پشتیبانی اختصاصی' },
    ],
  },
  {
    id: 'group',
    name: 'گروهی',
    kicker: 'دو تا سه نفر',
    tagline: 'همهٔ امکانات پرو، با تخفیف گروهی',
    description:
      'برای مطالعهٔ جمعی؛ همان پوشش اشتراک پرو، اما با تخفیف پله‌ای برای هر نفر بیشتر.',
    accent: 'copper',
    recommended: false,
    monthlyAmount: PRICING_AMOUNTS.group,
    seats: { min: 2, max: 3, defaultSeats: 2, discounts: { 2: 15, 3: 30 } },
    cta: { label: 'ساخت اشتراک گروهی', mode: 'group' },
    includesRef: 'pro',
    features: [
      { id: 'all-pro', label: 'همهٔ امکانات اشتراک پرو برای هر نفر' },
      { id: 'seats', label: 'مدیریت یکجا برای ۲ تا ۳ نفر' },
      { id: 'seat-discount', label: 'تخفیف پله‌ای: ۱۵٪ برای ۲ نفر، ۳۰٪ برای ۳ نفر' },
      { id: 'support-shared', label: 'پشتیبانی مشترک گروه' },
    ],
  },
];

/*
 * ── محصولاتی که اشتراک‌ها پوشش می‌دهند ──
 * این فهرست «قبل از تعرفه‌ها» در همان لایه معرفی می‌شود تا کاربر بداند
 * دارد برای چه چیزی هزینه می‌دهد. متن‌ها همان چیزی است که در محصول واقعی
 * وجود دارد؛ `mark` فقط کلید شکل انتزاعی هر محصول است (نه تصویر آماده).
 */
export const PRICING_PRODUCTS = [
  {
    id: 'lessons',
    index: '۰۱',
    title: 'درسنامهٔ جامع و میکرو درسنامه',
    description:
      'یادگیری کامل دروس علوم پایه با متن روان، خلاصهٔ نکات و مثال‌های بالینی؛ از شروع ترم تا جمع‌بندی.',
    accent: 'blue',
    mark: 'layers',
    capabilities: ['درسنامهٔ متنی', 'خلاصهٔ نکات', 'مثال بالینی'],
  },
  {
    id: 'bank',
    index: '۰۲',
    title: 'بانک تست علوم پایه',
    description:
      'بانک تست با طبقه‌بندی مبحث و سال، پاسخ تشریحی و امکان آزمون زمان‌دار برای سنجش واقعی.',
    accent: 'purple',
    mark: 'grid',
    capabilities: ['طبقه‌بندی مبحث', 'پاسخ تشریحی', 'آزمون زمان‌دار'],
  },
  {
    id: 'ai',
    index: '۰۳',
    title: 'تپش هوشمند (دستیار مطالعه)',
    description:
      'دستیار هوشمند روی محتوای تپش؛ بپرس، خلاصه بگیر و مفهوم‌های سخت را گام‌به‌گام مرور کن.',
    accent: 'copper',
    mark: 'pulse',
    capabilities: ['پرسش و پاسخ', 'خلاصه‌سازی', 'توضیح گام‌به‌گام'],
  },
  {
    id: 'analytics',
    index: '۰۴',
    title: 'آنالیز وضعیت و مسیر سبز',
    description:
      'تحلیل عملکرد بر پایهٔ پاسخ‌های واقعی؛ نقاط ضعف پیدا می‌شود و مسیر مطالعهٔ هفتهٔ بعد پیشنهاد می‌شود.',
    accent: 'green',
    mark: 'chart',
    capabilities: ['ریشه‌یابی ضعف', 'پیشنهاد مطالعه', 'پیشرفت هفتگی'],
  },
];

/* ── وضعیت پرداخت ──
   درگاه پرداخت هنوز به پروژه وصل نشده است (همان وضعیتی که مرکز تحلیل هم
   گزارش می‌کند). این وضعیت صریح گفته می‌شود تا صفحهٔ تعرفه چیزی را وعده ندهد
   که هنوز وجود ندارد. */
export const PAYMENT_STATUS = {
  id: 'connecting',
  label: 'در حال اتصال',
  note: 'درگاه پرداخت آنلاین هنوز متصل نشده است؛ مبلغ نهایی پیش از تأیید خرید نمایش داده می‌شود.',
};

/* ── خواننده‌ها (شکل نهایی: پاسخ JSON همان API) ── */
export const getBillingCycles = () => BILLING_CYCLES;
export const getPlans = () => PRICING_PLANS;
export const getProducts = () => PRICING_PRODUCTS;
export const getCapabilityRows = () => CAPABILITY_ROWS;
export const getPlanById = (planId) => PRICING_PLANS.find((plan) => plan.id === planId) ?? null;
export const getCycleById = (cycleId) =>
  BILLING_CYCLES.find((cycle) => cycle.id === cycleId) ?? BILLING_CYCLES[0];

/*
 * درصد تخفیف یک پلن در یک چرخه.
 * پلن گروهی تخفیف خودش را از تعداد نفرات می‌گیرد، پس تخفیف چرخه روی آن
 * اعمال نمی‌شود (جلوگیری از جمع‌شدن دو تخفیف و وعدهٔ اشتباه به کاربر).
 */
export function discountPercentFor(plan, cycle, seats) {
  if (plan?.seats) {
    const seatCount = clampSeats(plan, seats);
    return plan.seats.discounts[seatCount] ?? 0;
  }

  return cycle?.discountPercent ?? 0;
}

export function clampSeats(plan, seats) {
  if (!plan?.seats) return 1;
  const raw = Number(seats);
  if (!Number.isFinite(raw)) return plan.seats.defaultSeats;
  return Math.min(plan.seats.max, Math.max(plan.seats.min, Math.round(raw)));
}

/*
 * قیمت‌گذاری — تنها منبع محاسبهٔ مبلغ.
 * خروجی برای نمایش آماده است: هر عدد کنار متن و واحد خودش.
 */
export function quote({ planId, cycleId, seats }) {
  const plan = getPlanById(planId);
  if (!plan) return null;

  const cycle = getCycleById(cycleId);
  const seatCount = clampSeats(plan, seats);
  const discountPercent = discountPercentFor(plan, cycle, seatCount);

  /* مبلغ هر نفر در هر ماه، پیش از تخفیف */
  const listPerMonth = plan.monthlyAmount;
  const perMonth = Math.round(listPerMonth * (1 - discountPercent / 100));
  const months = cycle.months;

  /* برای پلن گروهی، مبلغ نهایی مجموع نفرات است */
  const perSeatTotal = perMonth * months;
  const total = perSeatTotal * seatCount;
  const listTotal = listPerMonth * months * seatCount;
  const savedTotal = listTotal - total;

  return {
    planId: plan.id,
    planName: plan.name,
    cycleId: cycle.id,
    cycleLabel: cycle.label,
    months,
    seats: seatCount,
    discountPercent,
    listPerMonth,
    perMonth,
    perSeatTotal,
    total,
    listTotal,
    savedTotal,
    savedPerMonth: listPerMonth - perMonth,
    currency: PRICING_META.currency,
  };
}

/* ── قالب‌بندی اعداد فارسی ── */
const numberFormatter = new Intl.NumberFormat('fa-IR');

export function formatNumberFa(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return toFa(numberFormatter.format(safe)).replace(/,/g, '٬');
}

export function formatToman(value) {
  return `${formatNumberFa(value)} ${PRICING_META.currency}`;
}

export function formatPercentFa(value) {
  return `${toFa(value)}٪`;
}

/* ── متن پوشش قابلیت در ماتریس مقایسه ── */
export const COVERAGE_LABELS = {
  full: 'کامل',
  partial: 'محدود',
  none: 'ندارد',
};

export function coverageOf(row, planId) {
  const coverage = row?.coverage?.[planId] ?? 'none';
  return { id: coverage, label: COVERAGE_LABELS[coverage] };
}
