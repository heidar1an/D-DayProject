/*
 * داده‌های دامنهٔ بخش یادداشت تپش.
 * شکل هر موجودیت همان قرارداد Backend آینده است؛ فضای هر کاربر از خالی شروع می‌شود
 * (هیچ یادداشت پیش‌فرضی seed نمی‌شود) و همهٔ تغییرات در localStorage می‌ماند (notesService.js).
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
 *   tags: string[]            ← تگ‌های آزاد کاربر؛ رنگ هر تگ از خود متن تگ مشتق می‌شود
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

/* پالت رنگ تگ — همه از پالت موجود تپش (رنگ کارت‌ها + اکسنت موضوع‌ها)؛ رنگ تازه‌ای ساخته نشد.
   دسته‌بندی تگ‌ها حذف شد: رنگ هر تگ از خودِ متن تگ مشتق می‌شود (`tagAccent` در سرویس)
   پس هر تگ رنگ تصادفیِ خودش را دارد، ولی همان تگ همیشه همان رنگ را می‌گیرد. */
export const TAG_COLORS = [
  '#e26d6d', '#5b8cc7', '#77b787', '#e0b45c', '#937fcd',
  '#c2a48c', '#7fa6d9', '#8fc79b', '#a690d8', '#ab8e7c',
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


