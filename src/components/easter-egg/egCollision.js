/*
 * برخوردِ سبک و قطعی.
 * همهٔ موجودیت‌ها با مرکز (x,y) و ابعاد (w,h) توصیف می‌شوند.
 * AABB کافی است: همهٔ ضربه‌ها جعبه‌ای و قابل پیش‌بینی‌اند و هزینه‌اش صفر.
 */

export function hits(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
