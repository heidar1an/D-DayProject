/*
 * گزینه‌ها، پالت‌های رنگی و مقادیر پیش‌فرض آواتارساز تپش.
 * ساختار کانفیگ آواتار به‌صورت یک آبجکت کوچک JSON ذخیره می‌شود
 * تا حجم localStorage در قیاس با عکس data-url ناچیز بماند.
 */

export const GENDERS = [
  { id: 'female', label: 'دخترانه' },
  { id: 'male', label: 'پسرانه' },
];

/* ---------- پالت‌های رنگی (هماهنگ با تم بژ/قهوه‌ای تپش) ---------- */

export const SKIN_TONES = [
  { id: 't1', label: 'خیلی روشن', hex: '#ffe3c9' },
  { id: 't2', label: 'روشن', hex: '#f5cfae' },
  { id: 't3', label: 'گندمی', hex: '#eab98d' },
  { id: 't4', label: 'برنزه', hex: '#d29a6b' },
  { id: 't5', label: 'تیره', hex: '#a96f45' },
  { id: 't6', label: 'خیلی تیره', hex: '#7e4f30' },
];

export const HAIR_COLORS = [
  { id: 'black', label: 'مشکی', hex: '#262220' },
  { id: 'brown-dark', label: 'قهوه‌ای تیره', hex: '#40291d' },
  { id: 'brown', label: 'قهوه‌ای', hex: '#5c3d26' },
  { id: 'honey', label: 'عسلی', hex: '#8a5a33' },
  { id: 'blond', label: 'بلوند', hex: '#c79a63' },
  { id: 'gray', label: 'خاکستری', hex: '#a3a3a3' },
  { id: 'white', label: 'سفید', hex: '#e9e5df' },
  { id: 'burgundy', label: 'شرابی', hex: '#6e3440' },
];

export const EYE_COLORS = [
  { id: 'brown', label: 'قهوه‌ای', hex: '#5b3a26' },
  { id: 'black', label: 'مشکی', hex: '#2b2b2b' },
  { id: 'green', label: 'سبز', hex: '#4f7a58' },
  { id: 'blue', label: 'آبی', hex: '#4a6f9b' },
  { id: 'honey', label: 'عسلی', hex: '#9b7440' },
];

export const CLOTH_COLORS = [
  { id: 'white', label: 'سفید', hex: '#f1ece3' },
  { id: 'cream', label: 'کرم', hex: '#ddd0bf' },
  { id: 'beige', label: 'بژ', hex: '#b99a86' },
  { id: 'brown', label: 'قهوه‌ای', hex: '#7a5c49' },
  { id: 'olive', label: 'زیتونی', hex: '#6f7461' },
  { id: 'mint', label: 'سبز پزشکی', hex: '#7fa08f' },
  { id: 'navy', label: 'سرمه‌ای', hex: '#2f3d52' },
  { id: 'gray', label: 'طوسی', hex: '#565656' },
  { id: 'black', label: 'مشکی', hex: '#2e2e2e' },
  { id: 'rose', label: 'گلبهی', hex: '#c98d84' },
];

export const COVERING_COLORS = [
  { id: 'black', label: 'مشکی', hex: '#26221f' },
  { id: 'gray', label: 'طوسی', hex: '#565656' },
  { id: 'beige', label: 'بژ', hex: '#b99a86' },
  { id: 'cream', label: 'کرم', hex: '#ddd0bf' },
  { id: 'brown', label: 'قهوه‌ای', hex: '#7a5c49' },
  { id: 'navy', label: 'سرمه‌ای', hex: '#2f3d52' },
  { id: 'rose', label: 'گلبهی', hex: '#c98d84' },
  { id: 'olive', label: 'زیتونی', hex: '#6f7461' },
];

export const BG_COLORS = [
  { id: 'beige', label: 'بژ تپشی', hex: '#b99a86' },
  { id: 'cream', label: 'کرم', hex: '#e6dccc' },
  { id: 'tan', label: 'کرم تیره', hex: '#8a7360' },
  { id: 'brown', label: 'قهوه‌ای', hex: '#4a392e' },
  { id: 'mint', label: 'سبز', hex: '#9db8a9' },
  { id: 'navy', label: 'سرمه‌ای', hex: '#33415c' },
  { id: 'gray', label: 'طوسی تیره', hex: '#3a3a3a' },
  { id: 'rose', label: 'گلبهی', hex: '#d8a79e' },
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
  { id: 'cap', label: 'کلاه', genders: ['female', 'male'] },
];

export const ACCESSORY_STYLES = [
  { id: 'glasses-round', label: 'عینک گرد' },
  { id: 'glasses-square', label: 'عینک مربعی' },
  { id: 'stethoscope', label: 'گوشی پزشکی' },
  { id: 'earrings', label: 'گوشواره' },
];

/* ---------- مقادیر پیش‌فرض و ابزارها ---------- */

const BASE_DEFAULT = {
  skin: 't2',
  face: 'oval',
  hairColor: 'black',
  eyes: 'almond',
  eyeColor: 'brown',
  brows: 'normal',
  mouth: 'smile',
  nose: 'button',
  facialHair: 'none',
  body: 'medium',
  covering: 'none',
  coveringColor: 'beige',
  accessories: [],
  bg: 'beige',
};

export const DEFAULT_CONFIGS = {
  female: {
    ...BASE_DEFAULT,
    gender: 'female',
    hair: 'long-wavy',
    cloth: 'tshirt',
    clothColor: 'cream',
  },
  male: {
    ...BASE_DEFAULT,
    gender: 'male',
    hair: 'short',
    cloth: 'tshirt',
    clothColor: 'navy',
  },
};

export function defaultAvatarConfig(gender = 'female') {
  return { ...DEFAULT_CONFIGS[gender] , accessories: [] };
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

  config.accessories = ACCESSORY_STYLES.filter(() => Math.random() < 0.3).map(
    (item) => item.id,
  );

  return config;
}

/* پیدا کردن رنگ از پالت با تحمل مقادیر ناشناخته (کانفیگ‌های قدیمی) */
export function paletteColor(palette, id, fallbackId) {
  return palette.find((item) => item.id === id) ?? palette.find((item) => item.id === fallbackId);
}
