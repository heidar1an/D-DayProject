/*
 * پل قیمت‌گذاری بین فرانت و v1 (فاز ۱۸) — تنها نقطهٔ تماس UI با
 * `/api/v1/pricing/*`.
 *
 * قرارداد v1:
 *   GET  /pricing/plans   → { currency, currencyLabel, amountsConfirmed, checkout, cycles, plans }
 *   POST /pricing/quote   → { quote }        بدنه فقط { planId, cycleId, seats }
 *
 * قواعدی که این پل رعایت می‌کند و چرا:
 *
 *   ۱. **هیچ مبلغی از کلاینت نمی‌رود.** بدنه فقط قصد است (محصول، چرخه، صندلی).
 *      اگر روزی کسی `amount` اضافه کند، سرور آن را نمی‌بیند.
 *   ۲. **سرور می‌گوید مبلغ قطعی است یا نه.** `amountsConfirmed` و
 *      `plans[].approved` عیناً منتقل می‌شوند؛ پل هیچ عددی را «قطعی» جا نمی‌زند
 *      و هیچ تخفیفی از خودش نمی‌سازد.
 *   ۳. **برچسب چرخه سمت فرانت می‌ماند.** سرور `id`/`months`/`discountPercent`
 *      می‌دهد؛ متن فارسی («ماهانه»/«سه‌ماهه») کپی UI است و اینجا ساخته نمی‌شود.
 *   ۴. **کاتالوگ با نبود درگاه هم می‌آید.** `checkout.configured:false` یعنی
 *      خرید فعال نیست، ولی ماتریس قیمت/قابلیت نمایشی است. پل این را صادقانه
 *      منتقل می‌کند تا UI بتواند پیام شفاف بدهد.
 *
 * ⚠️ UI فعلاً روی این پل سوئیچ **نشده** است. نگاشت به شکل مصرفی لایهٔ موجود
 * (`toLegacyQuote`) ساخته و قفل شده، ولی importها در cutover عوض می‌شوند تا
 * تغییر اتمی باشد.
 */

import { V1_REASON, v1Request } from '../api/v1';

export const PRICING_V1_REASON = V1_REASON;

/** وضعیت واقعی خرید — هیچ Secret در پاسخ نیست، پس اینجا هم نیست. */
function toCheckoutState(row) {
  return {
    enabled: row?.enabled === true,
    gateway: row?.gateway ?? null,
    configured: row?.configured === true,
  };
}

function toCycle(row) {
  return {
    id: row?.id ?? null,
    months: Number(row?.months ?? 0),
    discountPercent: Number(row?.discountPercent ?? 0),
  };
}

function toSeats(row) {
  if (!row || typeof row !== 'object') return null;

  return {
    min: Number(row.min ?? 1),
    max: Number(row.max ?? 1),
    defaultSeats: Number(row.default ?? row.min ?? 1),
    discounts: row.discounts ?? {},
  };
}

function toCapability(row) {
  return { code: row?.code ?? null, coverage: row?.coverage ?? null };
}

function toPlan(row) {
  return {
    id: row?.id ?? null,
    product: row?.product ?? null,
    name: row?.name ?? null,
    kind: row?.kind ?? null,
    currency: row?.currency ?? null,
    approved: row?.approved === true,
    purchasable: row?.purchasable === true,
    seats: toSeats(row?.seats),
    capabilities: (row?.capabilities ?? []).map(toCapability),
    cycles: (row?.cycles ?? []).map((cycle) => ({
      id: cycle?.id ?? null,
      months: Number(cycle?.months ?? 0),
      discountPercent: Number(cycle?.discountPercent ?? 0),
      priceMinor: Number(cycle?.priceMinor ?? 0),
      approved: cycle?.approved === true,
    })),
  };
}

/**
 * کاتالوگ قیمت. خروجی: `{ ok, reason?, catalog? }`.
 *
 * `reason === 'not_v1'` یعنی v1 روی این سرور سرو نمی‌شود ⇒ fallback مجاز است.
 * `reason === 'api'` یعنی سرور envelope معتبر با خطا داد ⇒ fallback مجاز نیست.
 */
export async function fetchPricingCatalog() {
  const result = await v1Request('/pricing/plans');

  if (!result.ok) {
    return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };
  }

  const row = result.data ?? {};

  return {
    ok: true,
    catalog: {
      currency: row.currency ?? null,
      currencyLabel: row.currencyLabel ?? null,
      amountsConfirmed: row.amountsConfirmed === true,
      checkout: toCheckoutState(row.checkout),
      cycles: (row.cycles ?? []).map(toCycle),
      plans: (row.plans ?? []).map(toPlan),
    },
  };
}

/**
 * محاسبهٔ مبلغ — تنها منبع عدد.
 *
 * `notFound: true` ⇒ طرح وجود ندارد (یا آرشیو است) ⇒ UI باید بازگردد.
 * `invalid: true`  ⇒ ترکیب چرخه/صندلی نامعتبر است (۴۲۲) ⇒ پیام روی همان فیلد.
 */
export async function fetchPricingQuote({ planId, cycleId, seats = 1 } = {}) {
  const result = await v1Request('/pricing/quote', {
    method: 'POST',
    body: { planId, cycleId, seats },
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
      invalid: result.status === 422,
      fields: result.fields ?? null,
    };
  }

  return { ok: true, quote: result.data?.quote ?? null };
}

/**
 * نگاشت مبلغ سرور به شکل مصرفی `pricingService.quote()`.
 *
 * چرا لازم است: UI فعلی با `planId`/`perMonth`/`total`/`currency` کار می‌کند.
 * این تابع همان شکل را می‌سازد تا cutover بدون بازنویسی کامپوننت‌ها ممکن باشد.
 * `currency` از **برچسب سرور** می‌آید (نه از ثابت سمت کلاینت) و `cycleLabel`
 * عمداً ساخته نمی‌شود — برچسب چرخه کپی UI است.
 */
export function toLegacyQuote(quote, { currencyLabel = null } = {}) {
  if (!quote) return null;

  const listPerMonth = Number(quote.list_per_month_minor ?? 0);
  const perMonth = Number(quote.per_month_minor ?? 0);

  return {
    planId: quote.plan ?? null,
    planName: quote.product_name ?? null,
    cycleId: quote.cycle ?? null,
    months: Number(quote.months ?? 0),
    seats: Number(quote.seats ?? 1),
    discountPercent: Number(quote.discount_percent ?? 0),
    listPerMonth,
    perMonth,
    perSeatTotal: Number(quote.per_seat_total_minor ?? 0),
    total: Number(quote.total_minor ?? 0),
    listTotal: Number(quote.list_total_minor ?? 0),
    savedTotal: Number(quote.saved_total_minor ?? 0),
    savedPerMonth: listPerMonth - perMonth,
    currency: currencyLabel ?? quote.currency ?? null,
    /* وضعیت واقعی خرید — UI باید بتواند صادقانه بگوید «فعلاً قابل خرید نیست». */
    approved: quote.approved === true,
    purchasable: quote.purchasable === true,
  };
}

/**
 * خوانندهٔ سازگار با `pricingService` — لایهٔ افزودنی روی fallback محلی.
 *
 * `dataStatus.pricingServer` منبع داده را صادقانه اعلام می‌کند:
 *   'connected'   ⇒ اعداد از سرور است
 *   'unavailable' ⇒ v1 روی این سرور نیست (fallback محلی)
 *   'error'       ⇒ سرور خطا داد (fallback محلی، ولی نباید بی‌صدا باشد)
 */
export function createPricingV1Reader({ fallback } = {}) {
  if (!fallback || typeof fallback.getCatalog !== 'function' || typeof fallback.quote !== 'function') {
    throw new Error('PRICING_V1_FALLBACK_REQUIRED');
  }

  return {
    async getCatalog(options = {}) {
      const base = await fallback.getCatalog(options);
      const result = await fetchPricingCatalog();

      if (!result.ok) {
        const unavailable = result.reason === V1_REASON.NOT_V1;

        return {
          ...base,
          dataStatus: { ...(base?.dataStatus ?? {}), pricingServer: unavailable ? 'unavailable' : 'error' },
        };
      }

      return {
        ...base,
        /* لایهٔ افزودنی — هیچ فیلد موجود UI را بازنویسی نمی‌کند. */
        serverPricing: { ...result.catalog, fetchedAt: new Date().toISOString() },
        dataStatus: { ...(base?.dataStatus ?? {}), pricingServer: 'connected' },
      };
    },

    async quote(input = {}) {
      const result = await fetchPricingQuote(input);

      if (!result.ok) {
        /* نبود طرح یا خطای اعتبارسنجی، محاسبهٔ محلی را توجیه نمی‌کند. */
        if (result.notFound || result.invalid || result.reason === V1_REASON.API) {
          return { ok: false, ...result };
        }

        return fallback.quote(input);
      }

      const catalog = await fallback.getCatalog({});

      return {
        ok: true,
        quote: toLegacyQuote(result.quote, { currencyLabel: catalog?.currencyLabel ?? null }),
        serverQuote: result.quote,
      };
    },
  };
}
