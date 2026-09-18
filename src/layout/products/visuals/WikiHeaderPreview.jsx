/*
 * ── پیش‌نمایش هدرِ ویکی تپش ──
 *
 * پیش‌نمایشِ داخل کارت، همان زبان بصریِ هدرِ واقعیِ لایهٔ ویکی را نگه می‌دارد:
 * نشانِ دانشنامه، عنوانِ گرادیانی، توضیح کوتاه و نوارِ جست‌وجوی آرام.
 * جست‌وجوی این کارت عمداً کنترل واقعی نیست؛ CTA خودِ کارت مقصدِ واقعیِ ویکی
 * است و این بخش فقط آینهٔ بصریِ لایه است.
 */

export default function WikiHeaderPreview() {
  return (
    <div className="ps-wiki-header" role="img" aria-label="پیش‌نمایش هدر ویکی تپش">
      <span className="ps-wiki-header__badge">
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M12 3.5c1 5 2.6 6.7 7.5 7.5-4.9.8-6.5 2.5-7.5 7.5-1-5-2.6-6.7-7.5-7.5 4.9-.8 6.5-2.5 7.5-7.5Z" />
        </svg>
        دانشنامه تخصصی علوم پزشکی
      </span>

      <h4 className="ps-wiki-header__title">ویکی تپش</h4>
      <p className="ps-wiki-header__subtitle">
        موتور کشف دانش پزشکی — جست‌وجو کن، بفهم، بین مفاهیم حرکت کن.
      </p>

      <div className="ps-wiki-header__search" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <span>جست‌وجو در ویکی تپش</span>
        <kbd>⌘ K</kbd>
      </div>
    </div>
  );
}
