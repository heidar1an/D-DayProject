/*
 * نام‌های فارسی و مترادف‌های جست‌وجو — مجموعهٔ آغازین (نمونه‌های آزمایشی فاز اول).
 *
 * کلید: نام پایهٔ انگلیسی ساختار، دقیقاً همان‌طور که در Z-Anatomy آمده (بدون پسوند .r/.l
 * و بدون پسوندهای فنی .t/.j/…). مقدار: نام فارسی + آرایهٔ مترادف برای جست‌وجو.
 *
 * این فایل تنها منبع نام فارسی است و در فاز بعد به دیتابیس آموزشی تپش وصل می‌شود؛
 * ساختارش مستقل از Viewer است و افزودن مدخل جدید نیاز به تغییر کد Viewer ندارد.
 */

export const PERSIAN_NAMES = {
  /* ── استخوان‌ها ─────────────────────────────────────────────────────────── */
  'Skull': { fa: 'جمجمه', aliases: ['جمجمه', 'skull'] },
  'Cranium': { fa: 'جمجمه', aliases: ['جمجمه'] },
  'Mandible': { fa: 'فک پایین', aliases: ['فک پایین', 'مندیبل'] },
  'Maxilla': { fa: 'فک بالا', aliases: ['فک بالا', 'مازیلا'] },
  'Frontal bone': { fa: 'استخوان پیشانی', aliases: ['پیشانی'] },
  'Parietal bone': { fa: 'استخوان آهیانه', aliases: ['آهیانه'] },
  'Temporal bone': { fa: 'استخوان گیجگاهی', aliases: ['گیجگاهی', 'تمپورال'] },
  'Occipital bone': { fa: 'استخوان پس‌سری', aliases: ['پس‌سری'] },
  'Zygomatic bone': { fa: 'استخوان گونه', aliases: ['گونه'] },
  'Sphenoid bone': { fa: 'استخوان پروانه‌ای', aliases: ['پروانه‌ای', 'اسفنوئید'] },
  'Ethmoid bone': { fa: 'استخوان غربالی', aliases: ['غربالی', 'اتموئید'] },
  'Vertebral column': { fa: 'ستون فقرات', aliases: ['ستون فقرات', 'ستون مهره'] },
  'Cervical vertebrae': { fa: 'مهره‌های گردنی', aliases: ['گردن'] },
  'Thoracic vertebrae': { fa: 'مهره‌های پشتی', aliases: ['مهره پشتی'] },
  'Lumbar vertebrae': { fa: 'مهره‌های کمری', aliases: ['کمر', 'مهره کمری'] },
  'Sacrum': { fa: 'استخوان خاجی', aliases: ['خاجی', 'ساکروم'] },
  'Coccyx': { fa: 'استخوان دنبالچه', aliases: ['دنبالچه'] },
  'Sternum': { fa: 'استخوان جناغ', aliases: ['جناغ'] },
  'Rib': { fa: 'دنده', aliases: ['دنده'] },
  'Ribs': { fa: 'دنده‌ها', aliases: ['دنده'] },
  'Clavicle': { fa: 'ترقوه', aliases: ['ترقوه'] },
  'Scapula': { fa: 'استخوان کتف', aliases: ['کتف'] },
  'Humerus': { fa: 'استخوان بازو', aliases: ['بازو', 'هومروس'] },
  'Radius': { fa: 'زند زبرین', aliases: ['رادیوس', 'زند زبرین'] },
  'Ulna': { fa: 'زند زیرین', aliases: ['اولنا', 'زند زیرین'] },
  'Femur': { fa: 'استخوان ران', aliases: ['ران', 'فمور'] },
  'Patella': { fa: 'کشکک', aliases: ['کشکک'] },
  'Tibia': { fa: 'درشت‌نی', aliases: ['درشت نی', 'تیبیا'] },
  'Fibula': { fa: 'نازک‌نی', aliases: ['نازک نی', 'فیبولا'] },
  'Pelvis': { fa: 'لگن', aliases: ['لگن'] },
  'Hip bone': { fa: 'استخوان بی‌نام', aliases: ['بی‌نام'] },
  'Hyoid bone': { fa: 'استخوان لامی', aliases: ['لامی'] },

  /* ── عضلات ─────────────────────────────────────────────────────────────── */
  'Biceps brachii muscle': { fa: 'عضله دوسر بازویی', aliases: ['دوسر بازویی', 'بایسپس'] },
  'Triceps brachii muscle': { fa: 'عضله سه‌سر بازویی', aliases: ['سه‌سر بازویی', 'ترایسپس'] },
  'Deltoid muscle': { fa: 'عضله دلتوئید', aliases: ['دلتوئید', 'مثلثی'] },
  'Pectoralis major muscle': { fa: 'عضله سینه‌ای بزرگ', aliases: ['سینه‌ای بزرگ'] },
  'Pectoralis minor muscle': { fa: 'عضله سینه‌ای کوچک', aliases: ['سینه‌ای کوچک'] },
  'Rectus abdominis muscle': { fa: 'عضله راست شکمی', aliases: ['راست شکمی', 'شکم'] },
  'External oblique muscle': { fa: 'عضله مایل خارجی شکم', aliases: ['مایل خارجی'] },
  'Internal oblique muscle': { fa: 'عضله مایل داخلی شکم', aliases: ['مایل داخلی'] },
  'Trapezius muscle': { fa: 'عضله ذوزنقه‌ای', aliases: ['ذوزنقه‌ای', 'تراپزیوس'] },
  'Latissimus dorsi muscle': { fa: 'عضله پشتی بزرگ', aliases: ['پشتی بزرگ', 'لتیسیموس'] },
  'Gluteus maximus muscle': { fa: 'عضله سرینی بزرگ', aliases: ['سرینی بزرگ', 'باسن'] },
  'Gluteus medius muscle': { fa: 'عضله سرینی میانی', aliases: ['سرینی میانی'] },
  'Quadriceps femoris muscle': { fa: 'عضله چهارسر رانی', aliases: ['چهارسر', 'کوادریسپس'] },
  'Rectus femoris muscle': { fa: 'عضله راست رانی', aliases: ['راست رانی'] },
  'Vastus lateralis muscle': { fa: 'عضله پهن جانبی', aliases: ['پهن جانبی'] },
  'Vastus medialis muscle': { fa: 'عضله پهن داخلی', aliases: ['پهن داخلی'] },
  'Biceps femoris muscle': { fa: 'عضله دوسر رانی', aliases: ['دوسر رانی'] },
  'Semitendinosus muscle': { fa: 'عضله نیم‌وتری', aliases: ['نیم‌وتری'] },
  'Semimembranosus muscle': { fa: 'عضله نیم‌غشایی', aliases: ['نیم‌غشایی'] },
  'Gastrocnemius muscle': { fa: 'عضله دوقلو', aliases: ['دوقلو', 'گاستروکنمیوس'] },
  'Soleus muscle': { fa: 'عضله نعلی', aliases: ['نعلی', 'سولئوس'] },
  'Tibialis anterior muscle': { fa: 'عضله درشت‌نی قدامی', aliases: ['درشت‌نی قدامی'] },
  'Sternocleidomastoid muscle': { fa: 'عضله جناغی‌چنبری‌پستانی', aliases: ['جناغی چنبری پستانی', 'اس‌سی‌ام'] },
  'Masseter muscle': { fa: 'عضله جویده‌ای', aliases: ['جویده‌ای', 'ماستر'] },
  'Temporalis muscle': { fa: 'عضله گیجگاهی', aliases: ['گیجگاهی', 'تمپورالیس'] },
  'Diaphragm': { fa: 'دیافراگم', aliases: ['دیافراگم', 'حجاب حاجز'] },
  'Sartorius muscle': { fa: 'عضله خیاطه', aliases: ['خیاطه'] },
  'Gracilis muscle': { fa: 'عضله نازک', aliases: ['نازک', 'گراسیلیس'] },
  'Erector spinae muscle': { fa: 'عضله راست‌کننده ستون فقرات', aliases: ['راست‌کننده ستون فقرات'] },

  /* ── احشا و سیستم‌ها ────────────────────────────────────────────────────── */
  'Heart': { fa: 'قلب', aliases: ['قلب', 'دل'] },
  'Lung': { fa: 'شش', aliases: ['شش', 'ریه'] },
  'Liver': { fa: 'کبد', aliases: ['کبد', 'جگر'] },
  'Stomach': { fa: 'معده', aliases: ['معده'] },
  'Kidney': { fa: 'کلیه', aliases: ['کلیه'] },
  'Urinary bladder': { fa: 'مثانه', aliases: ['مثانه'] },
  'Spleen': { fa: 'طحال', aliases: ['طحال'] },
  'Pancreas': { fa: 'لوزالمعده', aliases: ['لوزالمعده', 'پانکراس'] },
  'Gallbladder': { fa: 'کیسه صفرا', aliases: ['کیسه صفرا', 'صفرا'] },
  'Oesophagus': { fa: 'مری', aliases: ['مری', 'مِری'] },
  'Trachea': { fa: 'نای', aliases: ['نای'] },
  'Larynx': { fa: 'حنجره', aliases: ['حنجره'] },
  'Thyroid gland': { fa: 'غده تیروئید', aliases: ['تیروئید', 'درقی'] },
  'Tongue': { fa: 'زبان', aliases: ['زبان'] },
  'Small intestine': { fa: 'روده باریک', aliases: ['روده باریک'] },
  'Large intestine': { fa: 'روده بزرگ', aliases: ['روده بزرگ'] },
  'Duodenum': { fa: 'دوازدهه', aliases: ['دوازدهه'] },
  'Appendix': { fa: 'آپاندیس', aliases: ['آپاندیس'] },
  'Vermiform appendix': { fa: 'آپاندیس', aliases: ['آپاندیس'] },
  'Testis': { fa: 'بیضه', aliases: ['بیضه'] },
  'Prostate': { fa: 'پروستات', aliases: ['پروستات'] },
  'Ureter': { fa: 'حالب', aliases: ['حالب'] },
  'Urethra': { fa: 'مجرای ادرار', aliases: ['مجرای ادرار', 'پیشابراه'] },
  'Renal pelvis': { fa: 'لگنچه کلیه', aliases: ['لگنچه'] },

  /* ── دستگاه عصبی ───────────────────────────────────────────────────────── */
  'Brain': { fa: 'مغز', aliases: ['مغز'] },
  'Cerebellum': { fa: 'مخچه', aliases: ['مخچه'] },
  'Spinal cord': { fa: 'نخاع', aliases: ['نخاع', 'نخاع شوکی'] },
  'Sciatic nerve': { fa: 'عصب سیاتیک', aliases: ['سیاتیک'] },
  'Median nerve': { fa: 'عصب میانی', aliases: ['عصب میانی', 'مدین'] },
  'Ulnar nerve': { fa: 'عصب زند زیرین', aliases: ['اولنار', 'زند زیرین'] },
  'Radial nerve': { fa: 'عصب زند زبرین', aliases: ['رادیال', 'زند زبرین'] },
  'Brachial plexus': { fa: 'شبکه بازویی', aliases: ['شبکه بازویی'] },
  'Vagus nerve': { fa: 'عصب واگ', aliases: ['واگ', 'عصب دهم'] },
  'Optic nerve': { fa: 'عصب بینایی', aliases: ['بینایی'] },
  'Facial nerve': { fa: 'عصب صورتی', aliases: ['صورتی', 'عصب هفتم'] },
  'Trigeminal nerve': { fa: 'عصب سه‌شاخه', aliases: ['سه شاخه', 'تریژمینال'] },
  'Phrenic nerve': { fa: 'عصب دیافراگمی', aliases: ['فرنیک', 'دیافراگمی'] },

  /* ── عروق ──────────────────────────────────────────────────────────────── */
  'Aorta': { fa: 'آئورت', aliases: ['آئورت', 'اورت'] },
  'Arch of aorta': { fa: 'قوس آئورت', aliases: ['قوس آئورت'] },
  'Pulmonary artery': { fa: 'شریان ریوی', aliases: ['شریان ریوی'] },
  'Superior vena cava': { fa: 'ورید اجوف فوقانی', aliases: ['اجوف فوقانی'] },
  'Inferior vena cava': { fa: 'ورید اجوف تحتانی', aliases: ['اجوف تحتانی'] },
  'Common carotid artery': { fa: 'شریان کاروتید مشترک', aliases: ['کاروتید'] },
  'Internal carotid artery': { fa: 'شریان کاروتید داخلی', aliases: ['کاروتید داخلی'] },
  'Femoral artery': { fa: 'شریان رانی', aliases: ['شریان رانی'] },
  'Brachial artery': { fa: 'شریان بازویی', aliases: ['شریان بازویی'] },
  'Radial artery': { fa: 'شریان زند زبرین', aliases: ['رادیال'] },
  'Ulnar artery': { fa: 'شریان زند زیرین', aliases: ['اولنار'] },
  'Coronary artery': { fa: 'شریان کرونری', aliases: ['کرونری', 'تاجی'] },

  /* ── رباط‌ها ───────────────────────────────────────────────────────────── */
  'Anterior cruciate ligament': { fa: 'رباط صلیبی قدامی', aliases: ['صلیبی قدامی', ' ACL'] },
  'Posterior cruciate ligament': { fa: 'رباط صلیبی خلفی', aliases: ['صلیبی خلفی', 'PCL'] },
  'Medial collateral ligament': { fa: 'رباط جانبی داخلی', aliases: ['جانبی داخلی', 'MCL'] },
  'Lateral collateral ligament': { fa: 'رباط جانبی خارجی', aliases: ['جانبی خارجی', 'LCL'] },
};

/* نرمال‌سازی متن جست‌وجو — فارسی و انگلیسی */
export function normalizeQuery(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u200c\u200f\u200e]/g, '') /* نیم‌فاصله و علائم جهت */
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ۀﻪ]/g, 'ه')
    .replace(/\s+/g, ' ');
}

/**
 * نام فارسی یک ساختار را برمی‌گرداند؛ اگر ثبت نشده باشد null.
 * @param {string} baseName نام پایهٔ انگلیسی
 */
export function persianOf(baseName) {
  return PERSIAN_NAMES[baseName]?.fa ?? null;
}

/**
 * مترادف‌های جست‌وجوی یک ساختار (شامل نام انگلیسی و فارسی) — برای ساخت ایندکس.
 */
export function aliasesOf(baseName) {
  const entry = PERSIAN_NAMES[baseName];
  const list = [baseName];
  if (entry?.fa) list.push(entry.fa);
  if (entry?.aliases) list.push(...entry.aliases);
  return list;
}
