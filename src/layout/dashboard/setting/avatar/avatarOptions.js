/*
 * گزینه‌ها، پالت‌ها و مقادیر پیش‌فرض آواتارساز تپش.
 *
 * سبک مرجع: تصویرسازی تخت با خط دور (flat line-art).
 *  • پس‌زمینه‌ها همه روشن و پاستلی‌اند تا چهره بیرون بزند.
 *  • پالت‌ها اشباع بالاتری دارند چون کنار خط دور تیره می‌نشینند.
 *  • کانفیگ آواتار یک آبجکت کوچک JSON است تا حجم localStorage ناچیز بماند.
 */

export const GENDERS = [
  { id: 'female', label: 'دخترانه' },
  { id: 'male', label: 'پسرانه' },
];

/* ---------- پالت‌های رنگی ---------- */

export const SKIN_TONES = [
  { id: 't1', label: 'خیلی روشن', hex: '#f9d8bb' },
  { id: 't2', label: 'روشن', hex: '#f2bb92' },
  { id: 't3', label: 'هلویی', hex: '#e5a473' },
  { id: 't4', label: 'گندمی', hex: '#cf8c5c' },
  { id: 't5', label: 'برنزه', hex: '#a96b40' },
  { id: 't6', label: 'قهوه‌ای', hex: '#84512f' },
  { id: 't7', label: 'تیره', hex: '#5f3a22' },
];

export const HAIR_COLORS = [
  { id: 'black', label: 'مشکی', hex: '#20202a' },
  { id: 'brown-dark', label: 'قهوه‌ای تیره', hex: '#422b1d' },
  { id: 'brown', label: 'قهوه‌ای', hex: '#6f4426' },
  { id: 'honey', label: 'عسلی', hex: '#a5643a' },
  { id: 'ginger', label: 'نارنجی', hex: '#e2552b' },
  { id: 'burgundy', label: 'شرابی', hex: '#8e2f3c' },
  { id: 'blond', label: 'بلوند', hex: '#e8c46a' },
  { id: 'blue', label: 'آبی', hex: '#8ec5e8' },
  { id: 'gray', label: 'خاکستری', hex: '#9aa0a6' },
  { id: 'white', label: 'سفید', hex: '#f2efe9' },
];

export const EYE_COLORS = [
  { id: 'black', label: 'مشکی', hex: '#23232b' },
  { id: 'brown', label: 'قهوه‌ای', hex: '#5b3a26' },
  { id: 'honey', label: 'عسلی', hex: '#a5743a' },
  { id: 'green', label: 'سبز', hex: '#3f7a4f' },
  { id: 'blue', label: 'آبی', hex: '#3f6f9e' },
];

export const CLOTH_COLORS = [
  { id: 'white', label: 'سفید', hex: '#ffffff' },
  { id: 'cream', label: 'کرم', hex: '#f3e7d3' },
  { id: 'sky', label: 'آبی روشن', hex: '#cfe2f3' },
  { id: 'blue', label: 'آبی', hex: '#7ba7d7' },
  { id: 'navy', label: 'سرمه‌ای', hex: '#33415c' },
  { id: 'mint', label: 'نعنایی', hex: '#a8dcc0' },
  { id: 'green', label: 'سبز', hex: '#5cb85c' },
  { id: 'forest', label: 'سبز تیره', hex: '#3d8b4f' },
  { id: 'yellow', label: 'زرد', hex: '#f5cf46' },
  { id: 'orange', label: 'نارنجی', hex: '#e8703a' },
  { id: 'rose', label: 'گلبهی', hex: '#e79a9a' },
  { id: 'gray', label: 'طوسی', hex: '#9aa0a6' },
  { id: 'black', label: 'مشکی', hex: '#2b2b33' },
];

export const COVERING_COLORS = [
  { id: 'black', label: 'مشکی', hex: '#2b2b33' },
  { id: 'cream', label: 'کرم', hex: '#f3e7d3' },
  { id: 'white', label: 'سفید', hex: '#ffffff' },
  { id: 'rose', label: 'گلبهی', hex: '#e79a9a' },
  { id: 'sky', label: 'آبی روشن', hex: '#cfe2f3' },
  { id: 'mint', label: 'نعنایی', hex: '#a8dcc0' },
  { id: 'orange', label: 'نارنجی', hex: '#e8703a' },
  { id: 'navy', label: 'سرمه‌ای', hex: '#33415c' },
];

/* پس‌زمینه‌ها همه روشن‌اند تا خط دور و رنگ‌های جسور چهره دیده شوند */
export const BG_COLORS = [
  { id: 'cream', label: 'کرم', hex: '#f4efea' },
  { id: 'peach', label: 'هلویی', hex: '#fbe6db' },
  { id: 'rose', label: 'گلبهی', hex: '#fbe2e4' },
  { id: 'mint', label: 'نعنایی', hex: '#e3f2e8' },
  { id: 'sky', label: 'آبی روشن', hex: '#e2ecf8' },
  { id: 'lilac', label: 'بنفش روشن', hex: '#eee7f7' },
  { id: 'sand', label: 'شنی', hex: '#f6eddb' },
  { id: 'gray', label: 'طوسی', hex: '#ededed' },
];

/* ---------- گزینه‌های ساختاری ---------- */

export const FACE_SHAPES = [
  { id: 'oval', label: 'بیضی' },
  { id: 'round', label: 'گرد' },
  { id: 'long', label: 'کشیده' },
  { id: 'square', label: 'مربع‌گون' },
];

export const HAIR_STYLES = [
  { id: 'long-wavy', label: 'بلند و باز', genders: ['female'] },
  { id: 'bob', label: 'کوتاه (باب)', genders: ['female'] },
  { id: 'ponytail', label: 'دم‌اسبی', genders: ['female'] },
  { id: 'bun', label: 'شینیون', genders: ['female'] },
  { id: 'braids', label: 'بافته', genders: ['female'] },
  { id: 'curly-long', label: 'فر بلند', genders: ['female'] },
  { id: 'short', label: 'کوتاه کلاسیک', genders: ['male'] },
  { id: 'buzz', label: 'خیلی کوتاه', genders: ['male'] },
  { id: 'sidepart', label: 'وسط‌کنار', genders: ['male'] },
  { id: 'spiky', label: 'فوش', genders: ['male'] },
  { id: 'curly', label: 'فر', genders: ['male'] },
  { id: 'shoulder', label: 'بلند مردانه', genders: ['male'] },
];

export const EYE_STYLES = [
  { id: 'dot', label: 'نقطه‌ای' },
  { id: 'round', label: 'گرد' },
  { id: 'almond', label: 'بادامی' },
  { id: 'sleepy', label: 'آرام' },
  { id: 'happy', label: 'خندان' },
];

export const BROW_STYLES = [
  { id: 'thin', label: 'ظریف' },
  { id: 'normal', label: 'معمولی' },
  { id: 'thick', label: 'پرپشت' },
];

export const MOUTH_STYLES = [
  { id: 'smile', label: 'لبخند ملایم' },
  { id: 'grin', label: 'لبخند وسیع' },
  { id: 'laugh', label: 'قهقهه' },
  { id: 'neutral', label: 'خنثی' },
];

export const NOSE_STYLES = [
  { id: 'button', label: 'گرد و کوچک' },
  { id: 'line', label: 'برجسته' },
];

export const FACIAL_HAIR_STYLES = [
  { id: 'none', label: 'بدون ریش' },
  { id: 'mustache', label: 'سبیل' },
  { id: 'stubble', label: 'ریش کوتاه' },
  { id: 'full', label: 'ریش پر' },
];

export const BODY_SIZES = [
  { id: 'slim', label: 'لاغر' },
  { id: 'medium', label: 'معمولی' },
  { id: 'large', label: 'درشت' },
];

export const CLOTH_STYLES = [
  { id: 'tshirt', label: 'تی‌شرت', genders: ['female', 'male'] },
  { id: 'shirt', label: 'پیراهن', genders: ['female', 'male'] },
  { id: 'scrubs', label: 'لباس پزشکی', genders: ['female', 'male'] },
  { id: 'coat', label: 'روپوش سفید', genders: ['female', 'male'] },
  { id: 'manteau', label: 'مانتو', genders: ['female'] },
  { id: 'hoodie', label: 'هودی', genders: ['female', 'male'] },
];

export const COVERING_STYLES = [
  { id: 'none', label: 'بدون پوشش', genders: ['female', 'male'] },
  { id: 'headscarf', label: 'روسری', genders: ['female'] },
  { id: 'maghnaeh', label: 'مقنعه', genders: ['female'] },
  { id: 'chador', label: 'چادر', genders: ['female'] },
  { id: 'cap', label: 'کلاه لبه‌دار', genders: ['female', 'male'] },
  { id: 'beanie', label: 'کلاه بافت', genders: ['female', 'male'] },
];

export const ACCESSORY_STYLES = [
  { id: 'glasses-round', label: 'عینک گرد' },
  { id: 'glasses-square', label: 'عینک مربعی' },
  { id: 'sunglasses', label: 'عینک آفتابی' },
  { id: 'earrings', label: 'گوشواره' },
  { id: 'earphones', label: 'هندزفری' },
  { id: 'stethoscope', label: 'گوشی پزشکی' },
];

/* ---------- مقادیر پیش‌فرض و ابزارها ---------- */

const BASE_DEFAULT = {
  skin: 't3',
  face: 'oval',
  hairColor: 'black',
  eyes: 'dot',
  eyeColor: 'brown',
  brows: 'normal',
  mouth: 'smile',
  nose: 'button',
  facialHair: 'none',
  body: 'medium',
  covering: 'none',
  coveringColor: 'cream',
  accessories: [],
  bg: 'cream',
};

export const DEFAULT_CONFIGS = {
  female: {
    ...BASE_DEFAULT,
    gender: 'female',
    hair: 'long-wavy',
    cloth: 'tshirt',
    clothColor: 'green',
  },
  male: {
    ...BASE_DEFAULT,
    gender: 'male',
    hair: 'short',
    cloth: 'tshirt',
    clothColor: 'sky',
  },
};

export function defaultAvatarConfig(gender = 'female') {
  return { ...DEFAULT_CONFIGS[gender], accessories: [] };
}

/* با تغییر جنسیت، گزینه‌های مشترک حفظ و گزینه‌های وابسته به جنسیت بازنشانی می‌شوند */
export function configForGender(config, gender) {
  const next = { ...config, gender };
  const defaults = DEFAULT_CONFIGS[gender];

  const hairAllowed = HAIR_STYLES.some(
    (style) => style.id === config.hair && style.genders.includes(gender),
  );
  if (!hairAllowed) next.hair = defaults.hair;

  const clothAllowed = CLOTH_STYLES.some(
    (style) => style.id === config.cloth && style.genders.includes(gender),
  );
  if (!clothAllowed) next.cloth = defaults.cloth;

  const coveringAllowed = COVERING_STYLES.some(
    (style) => style.id === config.covering && style.genders.includes(gender),
  );
  if (!coveringAllowed) next.covering = 'none';

  next.facialHair = gender === 'male' ? config.facialHair : 'none';

  return next;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)].id;
}

export function randomAvatarConfig(gender) {
  const chosenGender = gender ?? pick(GENDERS);
  const config = {
    ...defaultAvatarConfig(chosenGender),
    skin: pick(SKIN_TONES),
    face: pick(FACE_SHAPES),
    hair: pick(HAIR_STYLES.filter((style) => style.genders.includes(chosenGender))),
    hairColor: pick(HAIR_COLORS),
    eyes: pick(EYE_STYLES),
    eyeColor: pick(EYE_COLORS),
    brows: pick(BROW_STYLES),
    mouth: pick(MOUTH_STYLES),
    nose: pick(NOSE_STYLES),
    body: pick(BODY_SIZES),
    cloth: pick(CLOTH_STYLES.filter((style) => style.genders.includes(chosenGender))),
    clothColor: pick(CLOTH_COLORS),
    covering: pick(COVERING_STYLES.filter((style) => style.genders.includes(chosenGender))),
    coveringColor: pick(COVERING_COLORS),
    bg: pick(BG_COLORS),
  };

  if (chosenGender === 'male') {
    config.facialHair = pick(FACIAL_HAIR_STYLES);
  }

  config.accessories = ACCESSORY_STYLES.filter(() => Math.random() < 0.25).map((item) => item.id);

  return config;
}

/* پیدا کردن رنگ از پالت با تحمل مقادیر ناشناخته (کانفیگ‌های قدیمی) */
export function paletteColor(palette, id, fallbackId) {
  return palette.find((item) => item.id === id) ?? palette.find((item) => item.id === fallbackId) ?? palette[0];
}
