/*
 * پل Commerce بین فرانت و v1 (فاز ۱۸) — تنها نقطهٔ تماس UI با سفارش/پرداخت/
 * اشتراک/دسترسی.
 *
 * قرارداد v1:
 *   POST /orders                          → { order }        (هدر Idempotency-Key)
 *   POST /orders/{id}/cancel              → { order }
 *   POST /orders/{orderId}/payments       → { payment, redirect_url, replayed }
 *   POST /payments/{id}/verify            → { payment }      (بدنه فقط signature)
 *   GET  /me/orders                       → { orders }  + meta
 *   GET  /me/orders/{id}                  → { order }
 *   GET  /me/payments                     → { payments } + meta
 *   GET  /me/subscriptions                → { subscriptions }
 *   GET  /me/entitlements                 → { entitlements, active_capabilities, enforced }
 *
 * سه قاعدهٔ غیرقابل‌مذاکره در این پل:
 *
 *   ۱. **هیچ مبلغی فرستاده نمی‌شود.** بدنهٔ ساخت سفارش فقط `planId`/`cycleId`/`seats`
 *      است. نه `amount`، نه `discount`، نه `paid`. سرور مبلغ را می‌سازد.
 *   ۲. **وضعیت `paid` هرگز از کلاینت نمی‌آید.** پل هیچ متدی برای «paid کردن»
 *      ندارد؛ تنها راه، `verifyPayment` با شاهد رمزنگاری‌شدهٔ درگاه است.
 *   ۳. **هویت از سشن است.** هیچ `userId` به سرور نمی‌رود و پاسخ‌ها هم `user_id`
 *      ندارند؛ سفارش/پرداخت دیگری ۴۰۴ می‌گیرد.
 *
 * ⚠️ UI فعلاً روی این پل سوئیچ **نشده** است (مثل بقیهٔ پل‌های v1): جریان خرید
 * اتمی است و در cutover با `startCheckout` جایگزین می‌شود.
 */

import { V1_REASON, newRequestKey, v1Request } from '../api/v1';

export const COMMERCE_V1_REASON = V1_REASON;

/* وضعیت‌های سفارش — آینهٔ enum سرور، فقط برای تصمیم‌های نمایشی. */
export const ORDER_STATUS = {
  PENDING: 'pending',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

/* وضعیت‌های پایانی — هیچ گذاری از آن‌ها بیرون نمی‌رود. */
export const TERMINAL_ORDER_STATUSES = [ORDER_STATUS.PAID, ORDER_STATUS.EXPIRED, ORDER_STATUS.CANCELLED];

function toOrderLine(row) {
  return {
    id: row?.id ?? null,
    productId: row?.product_id ?? null,
    planId: row?.plan_id ?? null,
    unitMinor: Number(row?.unit_minor ?? 0),
    quantity: Number(row?.quantity ?? 0),
    lineTotalMinor: Number(row?.line_total_minor ?? 0),
    snapshot: row?.snapshot ?? {},
  };
}

export function toOrder(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    status: row.status ?? null,
    totalMinor: Number(row.total_minor ?? 0),
    currency: row.currency ?? null,
    quoteSnapshot: row.quote_snapshot ?? {},
    expiresAt: row.expires_at ?? null,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at ?? null,
    lines: (row.lines ?? []).map(toOrderLine),
    isPaid: row.status === ORDER_STATUS.PAID,
    isTerminal: TERMINAL_ORDER_STATUSES.includes(row.status),
  };
}

export function toPayment(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    orderId: row.order_id ?? null,
    provider: row.provider ?? null,
    /* `authority` برای تکمیل پرداخت لازم است؛ رازِ درگاه نیست. */
    authority: row.authority ?? null,
    status: row.status ?? null,
    amountMinor: Number(row.amount_minor ?? 0),
    currency: row.currency ?? null,
    verifiedAt: row.verified_at ?? null,
    createdAt: row.created_at ?? null,
    isVerified: row.status === 'verified',
  };
}

export function toSubscription(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    status: row.status ?? null,
    /* محاسبهٔ سرور — «active ولی منقضی» برای کاربر یعنی غیرفعال. */
    effective: row.effective === true,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    plan: row.plan
      ? { code: row.plan.code ?? null, cycleMonths: Number(row.plan.cycle_months ?? 0), product: row.plan.product ?? null }
      : null,
  };
}

export function toEntitlement(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    capability: row.capability ?? null,
    active: row.active === true,
    revoked: row.revoked === true,
    sourceOrderId: row.source_order_id ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    revokedAt: row.revoked_at ?? null,
  };
}

/** صفحه‌بندی — شکل `meta` سرور عیناً حفظ می‌شود. */
function toMeta(meta) {
  return {
    page: Number(meta?.page ?? 1),
    perPage: Number(meta?.perPage ?? 0),
    total: Number(meta?.total ?? 0),
    lastPage: Number(meta?.lastPage ?? 1),
  };
}

/* ── سفارش ─────────────────────────────────────────────────────────── */

/**
 * ساخت سفارش — idempotent.
 *
 * `requestKey` باید در طول retry کاربر **ثابت** بماند تا سرور همان سفارش را
 * بازپخش کند، نه دومی بسازد. `conflict:true` (۴۰۹) یعنی همان کلید با payload
 * متفاوت استفاده شده — بازنویسی بی‌صدا هرگز.
 */
export async function createOrder({ planId, cycleId, seats = 1, requestKey } = {}) {
  const result = await v1Request('/orders', {
    method: 'POST',
    body: { planId, cycleId, seats },
    idempotencyKey: requestKey ?? newRequestKey('order'),
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      fields: result.fields ?? null,
      notFound: result.status === 404,
      conflict: result.status === 409,
      notConfigured: result.status === 503,
    };
  }

  return { ok: true, order: toOrder(result.data?.order) };
}

export async function cancelOrder(orderId, { requestKey } = {}) {
  const result = await v1Request(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    idempotencyKey: requestKey ?? newRequestKey('order-cancel'),
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
      conflict: result.status === 409,
    };
  }

  return { ok: true, order: toOrder(result.data?.order) };
}

/* ── پرداخت ────────────────────────────────────────────────────────── */

/**
 * شروع پرداخت برای سفارش. `replayed:true` یعنی تراکنش بازِ همان سفارش برگشت.
 */
export async function startPayment(orderId) {
  const result = await v1Request(`/orders/${encodeURIComponent(orderId)}/payments`, { method: 'POST' });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
      conflict: result.status === 409,
      notConfigured: result.status === 503,
    };
  }

  return {
    ok: true,
    payment: toPayment(result.data?.payment),
    redirectUrl: result.data?.redirect_url ?? null,
    replayed: result.data?.replayed === true,
  };
}

/**
 * تأیید پرداخت — تنها راه رسیدن به دسترسی.
 *
 * `signature` شاهد رمزنگاری‌شدهٔ درگاه است و از callback می‌آید. تأیید ناموفق
 * ⇒ ۴۲۲ و سفارش `failed` می‌شود؛ هیچ entitlement صادر نمی‌شود.
 */
export async function verifyPayment(paymentId, signature) {
  const result = await v1Request(`/payments/${encodeURIComponent(paymentId)}/verify`, {
    method: 'POST',
    body: { signature },
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
      conflict: result.status === 409,
      verificationFailed: result.status === 422,
    };
  }

  return { ok: true, payment: toPayment(result.data?.payment) };
}

/**
 * جریان کامل خرید: سفارش ⇒ پرداخت ⇒ آدرس درگاه.
 *
 * چرا یک تابع: UI نباید ترتیب را بداند و نباید بتواند فقط نیمی از جریان را
 * اجرا کند. اگر پرداخت ساخته نشد، سفارش باز می‌ماند و کاربر می‌تواند لغوش کند.
 */
export async function startCheckout({ planId, cycleId, seats = 1, requestKey } = {}) {
  const order = await createOrder({ planId, cycleId, seats, requestKey });

  if (!order.ok) return { ok: false, stage: 'order', ...order };

  const payment = await startPayment(order.order.id);

  if (!payment.ok) return { ok: false, stage: 'payment', order: order.order, ...payment };

  return { ok: true, order: order.order, payment: payment.payment, redirectUrl: payment.redirectUrl };
}

/* ── دادهٔ تجاری کاربر جاری ────────────────────────────────────────── */

export async function fetchMyOrders({ page = 1, perPage = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  const result = await v1Request(`/me/orders?${params}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, orders: (result.data?.orders ?? []).map(toOrder), meta: toMeta(result.meta) };
}

export async function fetchMyOrder(orderId) {
  const result = await v1Request(`/me/orders/${encodeURIComponent(orderId)}`);

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
    };
  }

  return { ok: true, order: toOrder(result.data?.order) };
}

export async function fetchMyPayments({ page = 1, perPage = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  const result = await v1Request(`/me/payments?${params}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, payments: (result.data?.payments ?? []).map(toPayment), meta: toMeta(result.meta) };
}

export async function fetchMySubscriptions() {
  const result = await v1Request('/me/subscriptions');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, subscriptions: (result.data?.subscriptions ?? []).map(toSubscription) };
}

/**
 * قابلیت‌های فعال کاربر جاری.
 *
 * `enforced:false` یعنی دروازه‌بانی هنوز روشن نشده و محتوا مثل قبل باز است —
 * این وضعیت **صادقانه** منتقل می‌شود تا UI اشتباه ادعا نکند «اشتراک فعال است».
 */
export async function fetchMyEntitlements() {
  const result = await v1Request('/me/entitlements');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    entitlements: (result.data?.entitlements ?? []).map(toEntitlement),
    activeCapabilities: result.data?.active_capabilities ?? [],
    enforced: result.data?.enforced === true,
  };
}

/**
 * «آیا کاربر این قابلیت را دارد؟» — تصمیم نهایی سرور است، ولی UI برای پنهان‌کردن
 * قفل باید **همین حالا** بداند. `enforced:false` ⇒ همه‌چیز باز است (رفتار مستند).
 */
export async function hasCapability(capability) {
  const result = await fetchMyEntitlements();

  if (!result.ok) return { ok: false, reason: result.reason, allowed: false, enforced: false };

  return {
    ok: true,
    allowed: result.enforced === false || result.activeCapabilities.includes(capability),
    enforced: result.enforced,
    capabilities: result.activeCapabilities,
  };
}
