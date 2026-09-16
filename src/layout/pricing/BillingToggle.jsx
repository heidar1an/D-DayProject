import { useRef } from 'react';

import { formatPercentFa, getBillingCycles } from '../../services/pricing/pricingService';

/*
 * کنترلر دورهٔ پرداخت.
 *
 * عمداً یک toggle معمولی نیست: سه چرخه دارد، نشانگر لغزان دارد و تخفیف را
 * به‌عنوان بخشی از همان کنترل نشان می‌دهد (نه یک برچسب تبلیغاتی جدا).
 *
 * دسترس‌پذیری: نقش `radiogroup`/`radio` با پیمایش کلیدهای جهت‌دار. چون رابط
 * راست‌به‌چپ است، کلید چپ به گزینهٔ بعدی و کلید راست به گزینهٔ قبلی می‌رود.
 */
export default function BillingToggle({ cycleId, onChange, discountPercent = 0 }) {
  const cycles = getBillingCycles();
  const activeIndex = Math.max(
    0,
    cycles.findIndex((cycle) => cycle.id === cycleId),
  );
  const optionRefs = useRef([]);

  const select = (index) => {
    const next = cycles[(index + cycles.length) % cycles.length];
    if (!next) return;

    onChange(next.id);
    optionRefs.current[(index + cycles.length) % cycles.length]?.focus();
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        select(activeIndex + 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        select(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        select(0);
        break;
      case 'End':
        event.preventDefault();
        select(cycles.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="pr-billing">
      <div
        className="pr-billing__control"
        role="radiogroup"
        aria-label="دورهٔ پرداخت"
        onKeyDown={handleKeyDown}
        style={{
          '--pr-cycle-count': cycles.length,
          '--pr-cycle-index': activeIndex,
        }}
      >
        <span className="pr-billing__indicator" aria-hidden="true" />

        {cycles.map((cycle, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              className={`pr-billing__option ${isActive ? 'is-active' : ''}`}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${cycle.label}${cycle.discountPercent ? ` — ${formatPercentFa(cycle.discountPercent)} تخفیف` : ''}`}
              tabIndex={isActive ? 0 : -1}
              key={cycle.id}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              onClick={() => onChange(cycle.id)}
            >
              <span className="pr-billing__option-label">{cycle.label}</span>
              <small className="pr-billing__option-hint">{cycle.hint}</small>
            </button>
          );
        })}
      </div>

      {/*
        برچسب تخفیف با `key` دوباره ساخته می‌شود تا انیمیشن ورودش هر بار
        اجرا شود؛ ولی فقط وقتی تخفیفی هست ساخته می‌شود تا نویز بصری نسازد.
      */}
      <span className="pr-billing__discount" key={`discount-${cycleId}`}>
        {discountPercent > 0
          ? `${formatPercentFa(discountPercent)} تخفیف روی این دوره`
          : 'تخفیفی روی این دوره اعمال نمی‌شود'}
      </span>
    </div>
  );
}
