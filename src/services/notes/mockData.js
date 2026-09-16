/*
 * داده‌های دامنهٔ بخش یادداشت تپش.
 * شکل هر موجودیت همان قرارداد Backend آینده است؛ seed ها فقط برای اولین ورود کاربر
 * پر می‌شوند و بعد از آن همهٔ تغییرات در localStorage می‌ماند (notesService.js).
 *
 * Note {
 *   id: string
 *   userId: string            ← مالک یادداشت
 *   title: string
 *   kind: 'text' | 'checklist' | 'qa' | 'table'
 *   body: string              ← برای kind === 'text' (چندخطی ساده)
 *   items: [{ id, text, done }]              ← برای kind === 'checklist'
 *   pairs: [{ id, question, answer }]        ← برای kind === 'qa' (بازیابی فعال)
 *   table: { columns: [{ id, label }], rows: [{ id, cells: { [columnId]: text } }] }
 *                                            ← برای kind === 'table' (جدول مقایسه)
 *   subjectId: string         ← یکی از SUBJECTS (همان لیست ویکی + «عمومی»)
 *   tags: string[]            ← تگ‌های آزاد؛ در UI زیر عنوان دسته‌شان (TAG_GROUPS) می‌آیند
 *   color: string             ← یکی از NOTE_COLORS؛ رنگ نوار کارت
 *   pinned: boolean           ← گلچین؛ بالای فهرست می‌ماند
 *   source: { sourceType, title } | null
 *       sourceType: 'lesson' | 'question' | 'article' | 'wiki' | 'book' | 'other'
 *       ← پایهٔ «ساخت یادداشت از درسنامه/تست/مقاله» در نسخه‌های بعدی
 *   createdAt / updatedAt: ISO string
 * }
 *
 * فقط فیلد مربوط به kind خودش پر می‌شود؛ بقیه خالی می‌مانند (sanitizeDraft در سرویس).
 */

/* چهار حالت یادداشت. «پرسش و پاسخ» و «جدول مقایسه» دو حالت حیاتی درس‌خواندن‌اند:
   اولی بازیابی فعال (Active Recall) و دومی مقایسهٔ سریع چند مورد روی چند معیار. */
export const NOTE_KINDS = [
  { id: 'text', label: 'متنی', long: 'یادداشت متنی', icon: 'text', hint: 'نکته، توضیح و خلاصهٔ آزاد' },
  { id: 'checklist', label: 'چک‌لیست', long: 'چک‌لیست', icon: 'list', hint: 'کارها و مراحل تیک‌خور' },
  { id: 'qa', label: 'پرسش و پاسخ', long: 'پرسش و پاسخ', icon: 'qa', hint: 'پرسش بنویس و جواب را پنهان نگه دار تا خودت بازیابی کنی' },
  { id: 'table', label: 'جدول مقایسه', long: 'جدول مقایسه', icon: 'table', hint: 'چند مورد را روی چند معیار کنار هم بچین' },
];

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

/* تگ‌های پیشنهادی هر درس — تگ‌ها بی‌صاحب نیستند؛ هر تگ زیر عنوان دستهٔ خودش
   (همان موضوع‌های SUBJECTS) دسته‌بندی می‌شود تا فهرست تگ‌ها به‌هم‌ریخته نشود. */
const TAG_MAP = {
  physiology: ['قلب و عروق', 'تنفس', 'کلیه و مایعات', 'غدد و متابولیسم', 'گوارش و کبد', 'عصب و عضله', 'خون و انعقاد'],
  anatomy: ['آناتومی تنه', 'سر و گردن', 'اندام‌ها', 'نوروآناتومی', 'تصویرنگاری'],
  biochemistry: ['متابولیسم', 'آنزیم و کوآنزیم', 'ویتامین‌ها', 'بیولوژی مولکولی', 'هورمون‌ها', 'انرژی'],
  histology: ['بافت‌های پایه', 'میکروسکوپی', 'رنگ‌آمیزی'],
  neuroscience: ['مسیرهای عصبی', 'نوروترانسمیتر', 'سیستم حسی', 'سیستم حرکتی'],
  pathology: ['التهاب و ترمیم', 'نئوپلازی', 'هماتوپاتولوژی', 'آسیب سلولی'],
  microbiology: ['گرم مثبت', 'گرم منفی', 'آنتی‌بیوتیک‌ها', 'کشت و تشخیص', 'میکروب', 'طبقه‌بندی'],
  pharmacology: ['مکانیزم دارو', 'عوارض دارویی', 'تداخل دارویی', 'دوز و تجویز', 'داروها'],
  immunology: ['ایمنی هومورال', 'ایمنی سلولی', 'واکسن‌ها', 'اختلالات ایمنی'],
  general: ['high-yield', 'علوم پایه', 'آزمون', 'مرور', 'حفظی', 'برنامه', 'جمع‌بندی', 'تحلیل', 'پیشرفت', 'خلاصه‌نویسی', 'ترفند حفظ'],
};

/* دسته‌های تگ — دقیقاً هم‌رنگ و هم‌نام SUBJECTS تا رنگ درس در کل اکوسیستم یکی بماند */
export const TAG_GROUPS = SUBJECTS.map((subject) => ({
  id: subject.id,
  label: subject.label,
  accent: subject.accent,
  tags: TAG_MAP[subject.id] ?? [],
}));

/* دستهٔ تگ‌های آزاد کاربر (تگی که در هیچ دستهٔ پیش‌فرضی نیست) */
export const CUSTOM_TAG_GROUP = { id: 'custom', label: 'تگ‌های خودت', accent: '#8a8a8a' };

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
    color: 'var(--red-ink)',
    pinned: true,
    source: { sourceType: 'lesson', title: 'درسنامهٔ جامع فیزیولوژی — قلب و گردش خون' },
    dayOffsets: { created: 12, updated: 2 },
  },
  {
    title: 'پرسش‌های بازیابی — فیزیولوژی قلب',
    kind: 'qa',
    body: '',
    pairs: [
      {
        id: 'seed-qa-1',
        question: 'صد اول (S1) دقیقاً کِی تولید می‌شود؟',
        answer: 'در آغاز سیستول، با بسته شدن دریچه‌های میترال و تریکوسپید.',
      },
      {
        id: 'seed-qa-2',
        question: 'چرا S2 در ابتدای دیاستول شنیده می‌شود؟',
        answer: 'چون در پایان سیستول فشار بطن چپ از فشار آئورت پایین می‌آید و دریچه‌های آئورتی/پولمونر بسته می‌شوند.',
      },
      {
        id: 'seed-qa-3',
        question: 'بیشترین حجم پرشدگی بطن در کدام فاز است؟',
        answer: 'فاز پرشدگی سریع دیاستول — بیشترین سهم پر شدن بطن از همین‌جاست، نه از انقباض دهلیزی.',
      },
      {
        id: 'seed-qa-4',
        question: 'برون‌ده قلبی با چه رابطه‌ای حساب می‌شود؟',
        answer: 'CO = ضربان قلب × حجم ضربه‌ای (HR × SV) و SV خودش تابع EDV و ESV است.',
      },
    ],
    subjectId: 'physiology',
    tags: ['مرور', 'high-yield'],
    color: 'var(--blue-ink)',
    pinned: true,
    source: { sourceType: 'lesson', title: 'درسنامهٔ جامع فیزیولوژی — قلب و گردش خون' },
    dayOffsets: { created: 3, updated: 1 },
  },
  {
    title: 'مقایسهٔ داروهای کاهندهٔ فشار خون',
    kind: 'table',
    body: '',
    table: {
      columns: [
        { id: 'seed-tb-c1', label: 'دارو' },
        { id: 'seed-tb-c2', label: 'مکانیزم' },
        { id: 'seed-tb-c3', label: 'نکتهٔ آزمونی' },
      ],
      rows: [
        { id: 'seed-tb-r1', cells: { 'seed-tb-c1': 'ACEI', 'seed-tb-c2': 'مهار تبدیل آنژیوتانسین I به II', 'seed-tb-c3': 'سرفهٔ خشک؛ ممنوع در بارداری' } },
        { id: 'seed-tb-r2', cells: { 'seed-tb-c1': 'ARB', 'seed-tb-c2': 'بلوک گیرندهٔ AT1', 'seed-tb-c3': 'همان اثر ACEI بدون سرفه' } },
        { id: 'seed-tb-r3', cells: { 'seed-tb-c1': 'بتابلوکر', 'seed-tb-c2': 'کاهش ضربان، قدرت انقباض و ترشح رنین', 'seed-tb-c3': 'هر دو بال (CO و TPR) را کم می‌کند' } },
        { id: 'seed-tb-r4', cells: { 'seed-tb-c1': 'دیورتیک تیازیدی', 'seed-tb-c2': 'کاهش حجم و در نتیجه CO', 'seed-tb-c3': 'هایپوناترمی و هایپراورسمی' } },
      ],
    },
    subjectId: 'pharmacology',
    tags: ['داروها', 'آزمون', 'طبقه‌بندی'],
    color: 'var(--gold-ink)',
    pinned: false,
    source: { sourceType: 'question', title: 'آزمون‌های هدفمند داروشناسی — دستگاه قلب و عروق' },
    dayOffsets: { created: 5, updated: 2 },
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
    color: 'var(--green-ink)',
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
    color: 'var(--purple-ink)',
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
    color: 'var(--gold-ink)',
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
    color: 'var(--blue-ink)',
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
    color: 'var(--gold-ink)',
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
    color: 'var(--faint)',
    pinned: false,
    source: null,
    dayOffsets: { created: 30, updated: 10 },
  },
];
