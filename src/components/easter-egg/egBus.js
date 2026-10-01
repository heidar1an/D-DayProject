/*
 * اتوبوسِ رویدادِ ایستر اگ.
 *
 * چرا رویداد به‌جای prop: نشانِ تپش در چند هدرِ متفاوت (هدرِ صفحهٔ اصلی،
 * هدرِ فوتر، هدرِ داشبورد) رندر می‌شود و این هدرها از درخت‌های جداگانه‌ای
 * می‌آیند. اگر activation با prop به ریشه وصل شود، باید همان prop از
 * `App` تا هر هدر پایین برود. یک رویدادِ سراسری این گره را حذف می‌کند:
 * هر نشان فقط رویداد را منتشر می‌کند و پوستهٔ بازی (که یک بار در ریشه
 * مانت می‌شود) آن را می‌شنود.
 */

const OPEN_EVENT = 'tapesh:easter-egg:open';

export function triggerEasterEgg() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function onEasterEggTrigger(handler) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
