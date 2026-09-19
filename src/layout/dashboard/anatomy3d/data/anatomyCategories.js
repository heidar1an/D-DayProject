/*
 * دسته‌بندی نمایشی ساختارهای آناتومیک — پل بین دادهٔ واقعی Z-Anatomy و پنل لایه‌های تپش.
 *
 * دادهٔ خام: manifest.json (ساخته‌شده توسط scripts/anatomy/build-anatomy-models.mjs) برای هر
 * مش، دستهٔ «بومی» Z-Anatomy را از فایل‌های Assets/Models/Layers/*.txt می‌گیرد:
 *   bones | muscles | nerves | arteries | veins | viscera | ligaments | fasciae | lymph | skin | refs | other
 *
 * این فایل همان دادهٔ بومی را به دسته‌های نمایشی نگاشت می‌کند:
 *   - نگاشت مستقیم (استخوان‌ها، عضلات، …)
 *   - زیرشکستن Viscera به سیستم‌های تنفسی/گوارشی/ادراری/تولیدمثل با قاعدهٔ کلیدواژه‌ای
 *   - جداکردن مغز و نخاع از بقیهٔ دستگاه عصبی
 *
 * قواعد فقط «تکمیل‌کنندهٔ» دادهٔ بومی‌اند و جای آن را نمی‌گیرند؛ افزودن ساختار جدید یا
 * اصلاح نگاشت، بدون دست‌زدن به Viewer امکان‌پذیر است.
 */

/* دسته‌های نمایشی — ترتیب، برچسب و رنگ (رنگ از متریال‌های واقعی Z-Anatomy)
 * پوست به‌صورت پیش‌فرض خاموش است تا نمای اول، بدن عضلانی (نمای شاخص Z-Anatomy) باشد. */
export const ANATOMY_CATEGORIES = [
  { id: 'skin',         fa: 'پوست',               en: 'Skin',             color: '#e0b39c', defaultOn: false },
  { id: 'bones',        fa: 'استخوان‌ها',          en: 'Bones',            color: '#dcd3bc', defaultOn: true },
  { id: 'muscles',      fa: 'عضلات',              en: 'Muscles',          color: '#ec9077', defaultOn: true },
  { id: 'nerves',       fa: 'اعصاب',              en: 'Nerves',           color: '#e5d9a8', defaultOn: true },
  { id: 'cns',          fa: 'مغز و نخاع',         en: 'Brain & Spinal',   color: '#cf95a8', defaultOn: true },
  { id: 'arteries',     fa: 'شریان‌ها',            en: 'Arteries',         color: '#e07a7c', defaultOn: true },
  { id: 'veins',        fa: 'وریدها',             en: 'Veins',            color: '#81b7e8', defaultOn: true },
  { id: 'respiratory',  fa: 'سیستم تنفسی',        en: 'Respiratory',      color: '#dd9cb0', defaultOn: true },
  { id: 'digestive',    fa: 'سیستم گوارشی',       en: 'Digestive',        color: '#cf9d63', defaultOn: true },
  { id: 'urinary',      fa: 'سیستم ادراری',       en: 'Urinary',          color: '#8fb7c9', defaultOn: true },
  { id: 'reproductive', fa: 'سیستم تولیدمثل',     en: 'Reproductive',     color: '#bd8ba0', defaultOn: true },
  { id: 'ligaments',    fa: 'رباط‌ها',             en: 'Ligaments',        color: '#c4d5ea', defaultOn: true },
  { id: 'lymph',        fa: 'سیستم لنفاوی',       en: 'Lymphatic',        color: '#9cc49c', defaultOn: true },
  { id: 'fasciae',      fa: 'فاسیاها',            en: 'Fasciae',          color: '#c9bba9', defaultOn: true },
  { id: 'refs',         fa: 'صفحات مرجع',         en: 'Reference planes', color: '#7f8ea3', defaultOn: false },
  { id: 'other',        fa: 'سایر ساختارها',      en: 'Other structures', color: '#a9adb5', defaultOn: true },
];

/* زیرگروه‌بندی احشا — به ترتیب ارزیابی می‌شوند (اولین تطابق برنده است) */
const VISCERA_RULES = [
  ['reproductive', /\b(testis|epididymis|ductus deferens|spermatic|seminal gland|ejaculatory|prostate|penis|cavernosum|spongiosum|glans penis|scrotum)\b/i],
  ['urinary',      /\b(kidney|renal pelvis|ureter|urinary bladder|urethra)\b/i],
  ['respiratory',  /\b(trachea|bronch|lung|lobe of (left|right) lung|pleura|larynx|epiglottis|nasopharynx|oropharynx|laryngopharynx|nasal cavity|pharynx)\b/i],
  ['digestive',    /\b(oesophagus|esophagus|stomach|duodenum|jejunum|ileum|colon|appendix|meso-appendix|mesocolon|taenia|omentum|liver|gallbladder|bile duct|pancreas|tongue|gingiva|salivary|parotid|sublingual|submandibular|palate|uvula|intestine|rectum|anal|cecum)\b/i],
  ['other',        /\b(thyroid|parathyroid|suprarenal|pineal|hypophysis|adenohypophysis|neurohypophysis)\b/i],
];

/* جداسازی مغز و نخاع از اعصاب محیطی — فقط روی نام‌های دستهٔ بومی «nerves» اعمال می‌شود */
const CNS_RULE = /\b(brain|cerebr|cerebell|brainstem|midbrain|mesencephalon|pons|medulla|thalam|hypothalam|epithalam|ventricle|aqueduct|spinal cord|cauda equina|meninges|dura mater|arachnoid|pia mater|cistern|insula|limbic|hippocamp|amygdala|corpus callosum|fornix|septum pellucidum|choroid|gyrus|sulcus|claustrum|caudate|putamen|pallidum|mammillary|colliculus|peduncle|internal capsule|optic radiation|commissure|nuclei of|reticular formation)\b/i;

/**
 * دستهٔ نمایشی یک ساختار را از دستهٔ بومی + نام انگلیسی تعیین می‌کند.
 * @param {string} rawCategory  دستهٔ بومی Z-Anatomy از manifest
 * @param {string} englishName  نام پایهٔ ساختار (بدون پسوند راست/چپ)
 * @returns {string} شناسهٔ دستهٔ نمایشی
 */
export function resolveDisplayCategory(rawCategory, englishName) {
  if (rawCategory === 'viscera') {
    for (const [cat, rule] of VISCERA_RULES) {
      if (rule.test(englishName)) return cat;
    }
    return 'other';
  }
  if (rawCategory === 'nerves' && CNS_RULE.test(englishName)) return 'cns';
  if (rawCategory === 'refs') return 'refs';
  /* دسته‌های بومی که یک‌به‌یک نگاشت می‌شوند */
  const known = ANATOMY_CATEGORIES.find((c) => c.id === rawCategory);
  return known ? rawCategory : 'other';
}

/* نمای پیش‌فرض پنل لایه‌ها */
export function defaultVisibility() {
  const map = {};
  for (const cat of ANATOMY_CATEGORIES) map[cat.id] = cat.defaultOn;
  return map;
}
