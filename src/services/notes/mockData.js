/*
 * داده‌های دامنهٔ بخش یادداشت تپش.
 * شکل هر موجودیت همان قرارداد Backend آینده است؛ seed ها فقط برای اولین ورود کاربر
 * پر می‌شوند و بعد از آن همهٔ تغییرات در localStorage می‌ماند (notesService.js).
 *
 * Note {
 *   id: string
 *   userId: string            ← مالک یادداشت
 *   title: string
 *   kind: 'text' | 'checklist'
 *   body: string              ← برای kind === 'text' (چندخطی ساده)
 *   items: [{ id, text, done }]  ← برای kind === 'checklist'
 *   subjectId: string         ← یکی از SUBJECTS (همان لیست ویکی + «عمومی»)
 *   tags: string[]
 *   color: string             ← یکی از NOTE_COLORS؛ رنگ نوار کارت
 *   pinned: boolean           ← گلچین؛ بالای فهرست می‌ماند
 *   source: { sourceType, title } | null
 *       sourceType: 'lesson' | 'question' | 'article' | 'wiki' | 'book' | 'other'
 *       ← پایهٔ «ساخت یادداشت از درسنامه/تست/مقاله» در نسخه‌های بعدی
 *   createdAt / updatedAt: ISO string
 * }
 */

/* موضوع‌ها — همان لیست ویکی تپش با همان اکسنت‌ها + «عمومی» برای یادداشت‌های فرادرسی */
export const SUBJECTS = [
  { id: 'physiology', label: 'فیزیولوژی', accent: '#5b8cc7' },
  { id: 'anatomy', label: 'آناتومی', accent: '#ab8e7c' },
  { id: 'biochemistry', label: 'بیوشیمی', accent: '#937fcd' },
  { id: 'histology', label: 'بافت‌شناسی', accent: '#77b787' },
  { id: 'neuroscience', label: 'علوم اعصاب', accent: '#7fa6d9' },
  { id: 'pathology', label: 'پاتولوژی', accent: '#e26d6d' },
  { id: 'microbiology', label: 'میکروب‌شناسی', accent: '#8fc79b' },
  { id: 'pharmacology', label: 'فارماکولوژی', accent: '#c2a48c' },
  { id: 'immunology', label: 'ایمونولوژی', accent: '#a690d8' },
  { id: 'general', label: 'عمومی', accent: '#8a8a8a' },
];

/* پالت رنگ کارت — از پالت فعلی تپش، بدون رنگ جدید */
export const NOTE_COLORS = ['#e26d6d', '#5b8cc7', '#77b787', '#e0b45c', '#937fcd', '#c2a48c'];

/* نوع منبعی که یادداشت به آن وصل است */
export const SOURCE_TYPES = [
  { id: 'lesson', label: 'درسنامه' },
  { id: 'question', label: 'بانک تست' },
  { id: 'article', label: 'مقاله' },
  { id: 'wiki', label: 'ویکی تپش' },
  { id: 'book', label: 'کتاب' },
  { id: 'other', label: 'سایر' },
];

/* ── Seed اولیه: چند یادداشت واقعی دانش پزشکی تا داشبورد خالی نباشد ──
   dayOffsets در سرویس به createdAt/updatedAt واقعی تبدیل می‌شود. */
export const SEED_NOTES = [
  {
    title: 'چرخهٔ قلبی؛ نکات کلیدی',
    kind: 'text',
    body: `• سیستول = انقباض و خروج خون؛ دیاستول = پرشدگی بطن.
• S1 (میترال/تریكوسپید) شروع سیستول، S2 (آئورتی/پولمونر) شروع دیاستول؛ بازشدن S2 یعنی فشار آئورت > فشار بطن چپ.
• فاز پرشدگی سریع بیشترین حجم را می‌دهد؛ صدای S3 در جوانان می‌تواند طبیعی باشد.
نکتهٔ آزمونی: EDV تابع بازگشت وریدی است (مکانیزم فرانک-استارلینگ) و برون‌ده قلبی = ضربان × حجم ضربه‌ای.`,
    subjectId: 'physiology',
    tags: ['high-yield', 'علوم پایه', 'مرور'],
    color: '#e26d6d',
    pinned: true,
    source: { sourceType: 'lesson', title: 'درسنامهٔ جامع فیزیولوژی — قلب و گردش خون' },
    dayOffsets: { created: 12, updated: 2 },
  },
  {
    title: 'مهارکننده‌های ACE — خلاصهٔ شخصی',
    kind: 'text',
    body: `کارپوپریل، انالاپریل، لیزینوپریل، رامیپریل.
• مکانیزم: مهار تبدیل آنژیوتانسین I به II → وازودیلاتاسیون + کاهش آلدوسترون.
• عوارض کلیدی: سرفهٔ خشک (تجمع برادی‌کینین)، هایپرکالمی، افت فشار اول دوز، آنژیوادم (نادر).
• منع مصرف: بارداری، تنگی دوطرفهٔ شریان رنال، هایپرکالمی.
یادآوری: «سرفه و پتاسیم بالا با ARB ها ندارد» — جایگزین منطقی بیمار.`,
    subjectId: 'pharmacology',
    tags: ['داروها', 'آزمون'],
    color: '#77b787',
    pinned: false,
    source: { sourceType: 'question', title: 'آزمون‌های هدفمند داروشناسی — دستگاه قلب و عروق' },
    dayOffsets: { created: 6, updated: 1 },
  },
  {
    title: 'عصب‌های کرانیال — ترفند حفظ‌کردن',
    kind: 'text',
    body: `ترتیب شماره‌ها با جملهٔ خودم: «ببین ببین گیر آورده تروآ فلک فاص هیپ» (I تا XII).
• حسی خالص: I، II، VIII — حرکتی خالص: III، IV، VI، XI، XII — مختلط: بقیه.
• کدام از سوراخ‌های جمجمه رد می‌شوند؟ Jugular foramen: IX، X، XI — آزمون عاشق این است!
نکته: فلج عصب IV → اختلاف‌بینایی هنگام پایین‌نگاه‌کردن (مثلاً پایین رفتن از پله).`,
    subjectId: 'anatomy',
    tags: ['حفظی', 'مرور', 'آزمون'],
    color: '#937fcd',
    pinned: false,
    source: null,
    dayOffsets: { created: 20, updated: 5 },
  },
  {
    title: 'برنامهٔ جمع‌بندی آخر هفته',
    kind: 'checklist',
    body: '',
    items: [
      { id: 'seed-ck-1', text: 'مرور فلش‌کارت‌های عقب‌افتادهٔ فیزیولوژی', done: true },
      { id: 'seed-ck-2', text: '۴۰ تست فیزیولوژی گوارش و کبد', done: false },
      { id: 'seed-ck-3', text: 'خلاصه‌نویسی فصل ایمنی همورال', done: false },
      { id: 'seed-ck-4', text: 'مرور اشتباهات آزمون جمعه', done: false },
      { id: 'seed-ck-5', text: 'مرور سریع آنتی‌بیوتیک‌ها از یادداشت داروها', done: false },
    ],
    subjectId: 'general',
    tags: ['برنامه', 'جمع‌بندی'],
    color: '#e0b45c',
    pinned: true,
    source: null,
    dayOffsets: { created: 1, updated: 1 },
  },
  {
    title: 'چرخهٔ کربس؛ بازده انرژی',
    kind: 'text',
    body: `هر استیل‌کوآ در یک دور چرخه: ۳ NADH + ۱ FADH2 + ۱ GTP ≈ ۱۰ ATP.
• گام‌های تنظیمی: ایزوسیترات دهیدروژناز (ACP) و آلفا-کتوگلوتارات دهیدروژناز.
• مهار با آرسنیک/فلورواستات سوال کلاسیک است.
جمع‌بندی گلوکز هوازی کل: حدود ۳۰ تا ۳۲ ATP (بسته به شاتل مالات/گلیسرول فسفات).`,
    subjectId: 'biochemistry',
    tags: ['high-yield', 'انرژی'],
    color: '#5b8cc7',
    pinned: false,
    source: { sourceType: 'lesson', title: 'میکرو درسنامهٔ بیوشیمی — متابولیسم' },
    dayOffsets: { created: 9, updated: 3 },
  },
  {
    title: 'باکتری‌های گرم مثبت — نقشهٔ ذهنی',
    kind: 'text',
    body: `استافیلوکوک: خوشه‌ای، کاتالاز مثبت — استرپتوکوک: زنجیره‌ای، کاتالاز منفی.
• استاف اورئوس: کواگولاز مثبت؛ درمان ارجح MRSA → ونکومایسین.
• همولیز: آلفا (سبز ناقص — پنوموکوک، ویریدانس) / بتا (شفاف کامل — استرپ پیوژنز group A، حساس به باسیتراسین).
نقشهٔ آزمونی: «کاتالاز اول، بعد کواگولاز، بعد همولیز».`,
    subjectId: 'microbiology',
    tags: ['میکروب', 'طبقه‌بندی'],
    color: '#c2a48c',
    pinned: false,
    source: { sourceType: 'wiki', title: 'ویکی تپش — استافیلوکوک اورئوس' },
    dayOffsets: { created: 15, updated: 8 },
  },
  {
    title: 'اشتباهات پرتکرارم در آزمون‌ها',
    kind: 'text',
    body: `۱. بی‌دقتی در سوالات «کدام گزینه نادرست است» — از این به بعد عبارت سوال را زیرش خط می‌کشم.
۲. کم‌آوردن وقت در ۱۰ سوال آخر → تایم‌باکس: هر بلوک ۵۰ سوال، ۵۵ دقیقه.
۳. رها کردن تست‌های محاسباتی؛ این‌ها سریع‌ترین نمرهٔ شهرند.
هفتهٔ بعد دوباره همین یادداشت را می‌خوانم و تیک می‌زنم کدام اصلاح شد.`,
    subjectId: 'general',
    tags: ['تحلیل', 'پیشرفت'],
    color: '#8a8a8a',
    pinned: false,
    source: null,
    dayOffsets: { created: 30, updated: 10 },
  },
];
