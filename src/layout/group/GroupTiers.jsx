import { formatPercentFa, formatToman, toFa } from '../../services/group/groupService';
import { CheckIcon, SegmentedControl, UsersIcon } from './groupShared';

/*
 * ── پله‌های تخفیف ──
 *
 * یک تعریف، دو مصرف: هم توضیح می‌دهد تخفیف گروهی چطور کار می‌کند، هم همان
 * انتخاب ظرفیتِ فرمِ ساخت گروه است. برای همین هر پله خودش یک `radio` است، نه
 * یک کارت تزیینی — انتخاب ظرفیت و انتخاب پله یکی است و دو حالت جدا نمی‌سازد.
 *
 * هیچ عددی این‌جا نیست: درصدها، مبلغ هر نفر، مجموع و صرفه‌جویی همه از
 * `getSeatTiers` می‌آیند که خودش از `quote()` تعرفه‌ها تغذیه می‌شود.
 */
export default function GroupTiers({ cycles, cycleId, onCycleChange, tiers, seats, onSelectSeats }) {
  return (
    <section
      className="grp-tiers section-shell"
      id="grp-plan"
      data-reveal
      aria-labelledby="grp-tiers-title"
    >
      <header className="grp-section-head">
        <span className="grp-eyebrow">پله‌های تخفیف</span>
        <h2 className="grp-section-title" id="grp-tiers-title">
          هر نفر بیشتر، تخفیف بیشتر
        </h2>
        <p className="grp-section-lead">
          ظرفیت گروه را انتخاب کن؛ تخفیف همان لحظه روی مبلغ هر نفر می‌نشیند. مبلغ
          گروه روی نفرات واقعی حساب می‌شود، نه روی ظرفیت خالی.
        </p>
      </header>

      <div className="grp-tiers__bar">
        <span className="grp-tiers__bar-label">دورهٔ پرداخت</span>
        <SegmentedControl
          label="دورهٔ پرداخت اشتراک گروهی"
          value={cycleId}
          onChange={onCycleChange}
          options={cycles.map((cycle) => ({
            id: cycle.id,
            label: cycle.label,
            hint: `${toFa(cycle.months)} ماه`,
          }))}
        />
      </div>

      <div className="grp-tiers__grid" role="radiogroup" aria-label="ظرفیت گروه">
        {tiers.map((tier) => {
          const isActive = tier.seats === seats;

          return (
            <button
              className={`grp-tier ${isActive ? 'is-active' : ''} ${tier.isBest ? 'is-best' : ''}`}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`اشتراک گروهی برای ${tier.label} — ${formatPercentFa(tier.discountPercent)} تخفیف`}
              key={tier.id}
              onClick={() => onSelectSeats(tier.seats)}
            >
              <span className="grp-tier__glow" aria-hidden="true" />

              <span className="grp-tier__head">
                <span className="grp-tier__seats">
                  <UsersIcon className="grp-tier__seats-icon" />
                  {tier.label}
                </span>

                {tier.isBest && <span className="grp-tier__badge">پیشنهاد تپش</span>}
              </span>

              <span className="grp-tier__discount">{formatPercentFa(tier.discountPercent)} تخفیف</span>

              <span className="grp-tier__price">
                <span className="grp-tier__price-value">{formatToman(tier.perMonth)}</span>
                <span className="grp-tier__price-unit">هر نفر، ماهانه</span>
              </span>

              <span className="grp-tier__meta">
                <span>
                  پیش از تخفیف: <s>{formatToman(tier.listPerMonth)}</s> هر نفر
                </span>
                <span>
                  مجموع {toFa(tier.seats)} نفر برای {toFa(tier.months)} ماه:{' '}
                  {formatToman(tier.total)}
                </span>
                {tier.savedTotal > 0 && (
                  <span className="grp-tier__saving">
                    {formatToman(tier.savedTotal)} صرفه‌جویی نسبت به اشتراک پرو
                  </span>
                )}
              </span>

              <span className="grp-tier__check" aria-hidden="true">
                {isActive && <CheckIcon className="grp-tier__check-icon" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
