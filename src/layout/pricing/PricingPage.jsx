import { useEffect, useMemo, useState } from 'react';

import {
  PRICING_META,
  clampSeats,
  getPlans,
  quote,
  toFa,
} from '../../services/pricing/pricingService';
import BillingToggle from './BillingToggle';
import FeatureMatrix from './FeatureMatrix';
import PricingCard from './PricingCard';
import ProductShowcase from './ProductShowcase';
import { ArrowStartIcon } from './pricingShared';
import { GROUP_PAGE_HASH } from '../../services/group/groupService';
import './pricing.css';

/*
 * ── لایهٔ تعرفه‌ها (صفحهٔ مستقل، مسیر `#pricing`) ──
 *
 * مفهوم طراحی: «تعرفه به‌مثابهٔ یک سطح چندلایه».
 *   · ساده در نگاه اول: یک هدر، یک معرفی محصول، یک کنترلر دوره و سه کارت.
 *   · عمیق در تعامل: نور کارت‌ها با اشاره‌گر حرکت می‌کند، قیمت‌ها نرم عوض
 *     می‌شوند، انتخاب پلن در ماتریس و بلوک مالی هم‌زمان اثر می‌گذارد و در
 *     موبایل ماتریس به تجربهٔ تک‌کارتی تبدیل می‌شود.
 *
 * ترتیب لایه‌ها عمدی است: اول محصول (چه چیزی می‌گیری)، بعد قیمت (چقدر).
 *
 * قاعدهٔ پروژه رعایت شده است: هیچ محاسبه‌ای در UI نیست (همه از سرویس)، هیچ
 * رنگ ثابتی در کد نیست (فقط توکن‌های `styles.css`)، هیچ وابستگی تازه‌ای
 * اضافه نشده و همهٔ حرکت‌ها گارد `prefers-reduced-motion` دارند.
 */

/* پلن پیش‌فرض همان پلن پیشنهادی است، ولی اگر داده عوض شد به اولی برمی‌گردد */
const DEFAULT_PLAN_ID = getPlans().find((plan) => plan.recommended)?.id ?? getPlans()[0].id;

export default function PricingPage({ hasAccount = false, onStart }) {
  const plans = getPlans();

  const [cycleId, setCycleId] = useState('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PLAN_ID);
  const [seats, setSeats] = useState(plans.find((plan) => plan.seats)?.seats.defaultSeats ?? 1);

  /*
   * لینک مستقیم به لنگر داخلی (`#pr-compare`) در بارگذاری تازه: مرورگر عنصر را
   * در لحظهٔ parse نمی‌بیند، پس خودمان یک‌بار اسکرول می‌کنیم.
   */
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === '#pricing') return;

    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;

    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }, []);

  /*
   * مبالغ همهٔ پلن‌ها یک‌جا و یک‌بار در هر تغییر محاسبه می‌شوند؛ هر کارت فقط
   * سهم خودش را می‌گیرد. هیچ محاسبه‌ای داخل JSX نیست.
   */
  const prices = useMemo(() => {
    const entries = plans.map((plan) => [
      plan.id,
      quote({ planId: plan.id, cycleId, seats: clampSeats(plan, seats) }),
    ]);

    return Object.fromEntries(entries);
  }, [plans, cycleId, seats]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const selectedPrice = prices[selectedPlan.id];
  const activeDiscount = selectedPrice?.discountPercent ?? 0;

  const selectPlan = (planId) => {
    setSelectedPlanId(planId);

    const plan = plans.find((item) => item.id === planId);
    if (plan?.seats) setSeats(clampSeats(plan, seats));
  };

  return (
    <main className="pr-page" id="pricing-page">
      {/* ── لایهٔ اول: هدر ── */}
      <section className="pr-hero section-shell" data-reveal="hero" aria-labelledby="pr-title">
        <span className="pr-hero__grid" aria-hidden="true" />

        <div className="pr-hero__copy">
          <span className="pr-eyebrow">تعرفه‌های تپش</span>
          <h1 className="pr-title" id="pr-title">
            تعرفه‌ای که با مسیر تو دقیق می‌شود
          </h1>
          <p className="pr-lead">
            یک اشتراک برای شروع منظم، یک اشتراک برای آمادگی کامل. مدت پرداخت را
            خودت انتخاب می‌کنی و هرچه جلوتر بروی، پوشش بیشتری از تپش در اختیارت است.
          </p>
        </div>
      </section>

      {/* ── لایهٔ دوم: معرفی محصولات، پیش از قیمت ── */}
      <ProductShowcase />

      {/* ── لایهٔ سوم: کنترلر دوره و کارت‌ها ── */}
      <section
        className="pr-plans section-shell"
        id="pr-plans"
        data-reveal
        aria-labelledby="pr-plans-title"
      >
        <div className="pr-plans__bar">
          <div className="pr-plans__bar-copy">
            <h2 className="pr-section-title" id="pr-plans-title">
              دورهٔ پرداخت را انتخاب کن
            </h2>
            <p className="pr-section-lead">
              تخفیف دوره‌های بلندتر، همان پلن را با هزینهٔ کمتر در ماه می‌دهد.
            </p>
          </div>

          <BillingToggle
            cycleId={cycleId}
            onChange={setCycleId}
            discountPercent={activeDiscount}
          />
        </div>

        <div className="pr-grid">
          {plans.map((plan) => {
            /*
             * مقصد CTA: پلن گروهی به لایهٔ واقعیِ خودش می‌رود (`#group`) و
             * بقیه به ورود/داشبورد. برای پلن گروهی `onCta` پاس داده نمی‌شود،
             * چون آن هندلر `preventDefault` می‌کند و مقصد را عوض می‌کرد.
             */
            const isGroupPlan = plan.cta?.mode === 'group';

            return (
              <PricingCard
                key={plan.id}
                plan={plan}
                price={prices[plan.id]}
                seats={plan.seats ? clampSeats(plan, seats) : 1}
                isSelected={plan.id === selectedPlanId}
                onSelect={selectPlan}
                onSeatChange={setSeats}
                ctaHref={isGroupPlan ? GROUP_PAGE_HASH : hasAccount ? '#dashboard' : '#auth'}
                onCta={isGroupPlan ? undefined : onStart}
              />
            );
          })}
        </div>
      </section>

      {/* ── لایهٔ چهارم: مقایسهٔ قابلیت‌ها ── */}
      <section
        className="pr-compare section-shell"
        id="pr-compare"
        data-reveal
        aria-labelledby="pr-compare-title"
      >
        <header className="pr-compare__head">
          <span className="pr-eyebrow pr-eyebrow--quiet">مقایسهٔ دقیق</span>
          <h2 className="pr-section-title" id="pr-compare-title">
            کدام قابلیت در کدام پلن
          </h2>
          <p className="pr-section-lead">
            ستون پلن را انتخاب کن تا همان ستون در سراسر جدول برجسته بماند.
          </p>
        </header>

        <FeatureMatrix
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={selectPlan}
        />
      </section>

      {/* ── لایهٔ پنجم: فراخوان پایانی ── */}
      <section className="pr-final section-shell" data-reveal aria-labelledby="pr-final-title">
        <div className="pr-final__panel">
          <div className="pr-final__copy">
            <h2 className="pr-final__title" id="pr-final-title">
              انتخاب کردی؟ بقیه‌اش با ما
            </h2>
            <p className="pr-final__lead">
              با اشتراک {selectedPlan.name} در دورهٔ {selectedPrice.cycleLabel} شروع کن؛
              اگر پشیمان شدی، پلن را عوض کن.
            </p>
          </div>

          <div className="pr-final__actions">
            <a
              className="pr-cta pr-cta--solid"
              href={hasAccount ? '#dashboard' : '#auth'}
              onClick={onStart}
            >
              <span className="pr-cta__label">
                {hasAccount ? 'رفتن به داشبورد' : `شروع اشتراک ${selectedPlan.name}`}
              </span>
              <span className="pr-cta__icon" aria-hidden="true">
                <ArrowStartIcon />
              </span>
            </a>
            <a className="pr-final__secondary" href="#pr-compare">
              دیدن مقایسهٔ کامل
            </a>
          </div>
        </div>

        {/*
          شفافیت مبالغ: تا وقتی مالک محصول اعداد را تأیید نکرده، این یادداشت
          می‌ماند. با true شدن پرچم، خودش ناپدید می‌شود.
        */}
        {!PRICING_META.amountsConfirmed && (
          <p className="pr-footnote">
            {PRICING_META.note} برای اطلاع از مبلغ نهایی با پشتیبانی تپش در تماس باش.
          </p>
        )}
      </section>
    </main>
  );
}
