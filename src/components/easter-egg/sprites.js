/*
 * اسپرایت‌های فشرده.
 *
 * اسپرایت‌های عادی پروژه (`pixelArts.js`) آرایه‌ای از آرایهٔ رنگ‌اند. برای
 * باسِ بزرگ که ۱۶×۱۲ خانه است، همان قالب ۱۹۲ مقدار می‌شود و خواندنش سخت
 * است؛ پس اینجا با یک پالتِ حرفی نوشته شده و در زمانِ بارگذاری decode
 * می‌شود. خروجی دقیقاً همان ساختار آرایه‌ای است.
 */

const PALETTE = {
  '.': null,
  k: '#111114', // مشکی
  w: '#ffffff',
  y: '#e0b45c', // طلاییِ نشانِ تپش
  o: '#ff9717',
  r: '#e26d6d',
  g: '#61d192',
  b: '#5b8cc7',
  p: '#937fcd',
  n: '#ab8e7c',
  d: '#604e42',
};

export function decode(rows) {
  return rows.map((row) => Array.from(row, (ch) => PALETTE[ch] ?? null));
}

/*
 * باس: «کتابِ امتحانیِ عصبی» — کتابی قهوه‌ای که بدنِ باکتری‌وار دارد،
 * دو چشمِ خشمگین و ردیفِ دندان. طنز و بی‌آزار، بدون هیچ ارجاعِ پزشکیِ
 * کلیشه‌ای.
 */
export const BOSS_PIXELS = decode([
  '..dddddddddddd..',
  '.dnnnnnnnnnnnnd.',
  'dnwwwwwwwwwwwwnd',
  'dnwkkwwwwwwkkwnd',
  'dnwrrwwwwwwrrwnd',
  'dnwkkwwwwwwkkwnd',
  'dnwwwwwwwwwwwwnd',
  'dnwwwwwwwwwwwwnd',
  'dnwkwkwkwkwkwknd',
  'dnnnnnnnnnnnnnnd',
  '.dnnnnnnnnnnnnd.',
  '..dddddddddddd..',
]);
