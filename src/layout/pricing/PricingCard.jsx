import {
  PRICING_META,
  formatNumberFa,
  formatPercentFa,
  formatToman,
  toFa,
} from '../../services/pricing/pricingService';
import { AnimatedNumber, ArrowStartIcon, CheckIcon, useSurfacePointer } from './pricingShared';

/*
 * کارت پلن — لایه‌ای، نه یک کارت ساده.
 *
 * ترتیب لایه‌ها از پایین به بالا:
 *   ۱. سطح کارت (`background` + `border`)
 *   ۲. `aura`  — نور آرام پشت کارت که با موقعیت اشاره‌گر جابه‌جا می‌شود
 *   ۳. `mesh`  — بافت شبکهٔ بسیار محو (هویت داده‌محور)
 *   ۴. `edge`  — خط لبهٔ روشن که فقط روی هاور/انتخاب دیده می‌شود
 *   ۵. محتوا (در `__tilt` تا تیلت روی متن اثر نگذارد)
 *
 * همهٔ لایه‌ها با CSS variable جابه‌جا می‌شوند؛ هیچ state ری‌اکتی برای حرکت
 * ماوس وجود ندارد، پس هاور هیچ رندر دوباره‌ای نمی‌سازد.
 */

function SeatSelector({ plan, seats, onSeatChange }) {
  const options = [];
  for (let count = plan.seats.min; count <= plan.seats.max; count += 1) {
    options.push(count);
  }

  return (
    <div className="pr-seats" role="radiogroup" aria-label="تعداد نفرات اشتراک گروهی">
      <span className="pr-seats__label">تعداد نفرات</span>
      <div className="pr-seats__options">
        {options.map((count) => {
          const isActive = count === seats;
          const discount = plan.seats.discounts[count] ?? 0;

          return (
            <button
              className={`pr-seats__option ${isActive ? 'is-active' : ''}`}
              type="button"
              role="radio"
              aria-checked={isActive}
              key={count}
              onClick={() => onSeatChange(count)}
            >
              <span>{toFa(count)} نفر</span>
              {discount > 0 && <small>{formatPercentFa(discount)} تخفیف</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PricingCard({
  plan,
  price,
  seats,
  isSelected,
  onSelect,
  onSeatChange,
  onCta,
  ctaHref = '#auth',
}) {
  const pointer = useSurfacePointer();

  const isGroup = Boolean(plan.seats);
  const cycleSummary =
    price.months === 1
      ? 'پرداخت ماهانه'
      : `پرداخت یک‌جا برای ${toFa(price.months)} ماه: ${formatToman(price.perSeatTotal)}`;

  return (
    <article
      className={`pr-card pr-card--${plan.accent} ${plan.recommended ? 'is-recommended' : ''} ${
        isSelected ? 'is-selected' : ''
      }`}
      ref={pointer.ref}
      onPointerMove={pointer.onPointerMove}
      onPointerLeave={pointer.onPointerLeave}
      aria-labelledby={`pr-plan-${plan.id}`}
    >
      {/*
        سطح کارت یک لایهٔ جداگانه است، نه پس‌زمینهٔ خودِ article.
        دلیلش لایهٔ Offset پلن پیشنهادی است: آن لایه با z-index منفی پشت
        سطح می‌نشیند تا فقط «لبهٔ بیرون‌زده» دیده شود، نه یک مستطیل روی کارت.
      */}
      <span className="pr-card__surface" aria-hidden="true" />
      <span className="pr-card__aura" aria-hidden="true" />
      <span className="pr-card__mesh" aria-hidden="true" />
      <span className="pr-card__edge" aria-hidden="true" />

      <div className="pr-card__tilt">
        <header className="pr-card__head">
          <div className="pr-card__identity">
            <span className="pr-card__kicker">{plan.kicker}</span>
            <h3 className="pr-card__name" id={`pr-plan-${plan.id}`}>
              {plan.name}
            </h3>
            <p className="pr-card__tagline">{plan.tagline}</p>
          </div>

          <button
            className="pr-card__select"
            type="button"
            aria-pressed={isSelected}
            aria-label={`انتخاب اشتراک ${plan.name}`}
            onClick={() => onSelect(plan.id)}
          >
            <span className="pr-card__select-dot" aria-hidden="true" />
            <span className="pr-card__select-text">{isSelected ? 'انتخاب‌شده' : 'انتخاب'}</span>
          </button>
        </header>

        <p className="pr-card__description">{plan.description}</p>

        <div className="pr-card__price">
          <div className="pr-card__price-main">
            <span className="pr-card__price-label">{isGroup ? 'هر نفر، ماهانه' : 'ماهانه'}</span>
            <span className="pr-card__price-value">
              <AnimatedNumber value={price.perMonth} />
              <small>{PRICING_META.currency}</small>
            </span>
          </div>

          <div className="pr-card__price-meta">
            <span>{cycleSummary}</span>
            {price.discountPercent > 0 && (
              <span className="pr-card__price-saving">
                {formatPercentFa(price.discountPercent)} تخفیف
                {price.savedPerMonth > 0 && ` · ${formatToman(price.savedPerMonth)} کمتر در هر ماه`}
              </span>
            )}
            {isGroup && <span>مجموع گروه: {formatToman(price.total)}</span>}
          </div>
        </div>

        {isGroup && <SeatSelector plan={plan} seats={seats} onSeatChange={onSeatChange} />}

        {plan.includesRef && (
          <p className="pr-card__includes">
            شامل همهٔ امکانات{' '}
            <span className="pr-card__includes-ref">
              {plan.includesRef === 'pro' ? 'اشتراک پرو' : 'اشتراک عادی'}
            </span>
          </p>
        )}

        <ul className="pr-card__features">
          {plan.features.map((feature, index) => (
            <li className="pr-feature" key={feature.id} style={{ '--pr-i': index }}>
              <span className="pr-feature__icon" aria-hidden="true">
                <CheckIcon />
              </span>
              <span className="pr-feature__text">{feature.label}</span>
            </li>
          ))}
        </ul>

        <div className="pr-card__cta">
          <a className="pr-cta" href={ctaHref} onClick={onCta}>
            <span className="pr-cta__label">{plan.cta.label}</span>
            <span className="pr-cta__icon" aria-hidden="true">
              <ArrowStartIcon />
            </span>
          </a>
          <span className="pr-card__cta-note">
            {isGroup
              ? `برای ${toFa(price.seats)} نفر · هر نفر ${formatNumberFa(price.perMonth)} ${PRICING_META.currency}`
              : `دورهٔ انتخابی: ${price.cycleLabel}`}
          </span>
        </div>
      </div>
    </article>
  );
}
