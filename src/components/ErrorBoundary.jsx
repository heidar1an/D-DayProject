/*
 * مرز خطای React — فاز ۶.
 *
 * چرا لازم بود: هیچ Error Boundary واقعی در `src` نبود. هر استثنای رندر
 * (پراپ غلط، دادهٔ ناقص از API، خطای یک لایهٔ عمیق) کل درخت را از بین می‌برد و
 * کاربر **صفحهٔ سفید** می‌دید؛ بدون پیام، بدون راه بازگشت و بدون هیچ ردی در لاگ
 * برای کسی که پشت تلفن است.
 *
 * سه سطح، طبق خواستهٔ فاز:
 *   • `scope="root"`      — دور کل اپ (در `main.jsx`).
 *   • `scope="dashboard"` — دور داشبورد؛ خطای یک لایه، هدر/فوتر سایت را نمی‌کشد.
 *   • `scope="admin"`     — دور پنل؛ خطای یک صفحهٔ پنل، خروج از پنل را ممکن
 *                            می‌گذارد.
 *
 * قواعد سختِ این فایل:
 *   ۱. **هیچ** stack trace، پیام داخلی، نام فایل یا مقدار حساسی به کاربر نشان
 *      داده نمی‌شود. فقط یک شناسهٔ کوتاه برای پیگیری.
 *   ۲. لاگ امن است: پیام و stack فقط به `console.error` می‌رود، نه به DOM.
 *   ۳. بازیابی ممکن است: دکمهٔ «تلاش دوباره» state را پاک می‌کند و اگر
 *      `resetKey` عوض شود (مثلاً مسیر)، خودکار پاک می‌شود.
 */

import { Component } from 'react';

/** برچسب و پیام هر سطح — پیام‌ها عمداً کلی‌اند و جزئیات داخلی را لو نمی‌دهند. */
const SCOPE_COPY = {
  root: {
    title: 'مشکلی پیش آمد',
    body: 'نمایش این بخش با خطا متوقف شد. می‌توانی دوباره تلاش کنی؛ اگر تکرار شد، صفحه را بازخوانی کن.',
    accent: 'var(--red, #e26d6d)',
  },
  dashboard: {
    title: 'داشبورد بالا نیامد',
    body: 'این بخش از داشبورد با خطا روبه‌رو شد. بقیهٔ سایت سالم است و می‌توانی دوباره تلاش کنی.',
    accent: 'var(--gold, #e0b45c)',
  },
  admin: {
    title: 'این صفحهٔ پنل بالا نیامد',
    body: 'خطا فقط در همین صفحهٔ پنل رخ داده. می‌توانی دوباره تلاش کنی یا به فهرست پنل برگردی.',
    accent: 'var(--purple-bright, #937fcd)',
  },
};

let errorCounter = 0;

/**
 * ثبت امن خطا.
 *
 * چه چیزی ثبت می‌شود: نوع خطا، پیام، stack، scope و شناسه.
 * چه چیزی **نمی‌شود**: هیچ دادهٔ فرم، توکن، شماره، ایمیل یا محتوای کاربر.
 * (پیام خطای React ممکن است شامل نام کامپوننت باشد؛ همان هم فقط به کنسول
 * می‌رود، نه به UI.)
 */
export function reportError(error, info, scope = 'root') {
  errorCounter += 1;
  const id = `E-${Date.now().toString(36)}-${errorCounter}`;

  try {
    console.error(`[tapesh:error-boundary:${scope}] ${id}`, error, info?.componentStack ?? '');
  } catch {
    /* کنسول در دسترس نیست؛ ادامه می‌دهیم */
  }

  /* نقطهٔ تزریق اختیاری برای فرستادن به سرویس رهگیری خطا در آینده */
  try {
    if (typeof window !== 'undefined' && typeof window.__tapeshErrorSink === 'function') {
      window.__tapeshErrorSink({ id, scope, name: error?.name ?? 'Error', message: String(error?.message ?? '') });
    }
  } catch {
    /* سینک خطا خودش نباید خطا بسازد */
  }

  return id;
}

/** رابط کاربری خطا — مستقل از مرز، تا بشود جدا هم استفاده کرد. */
export function ErrorFallback({ scope = 'root', errorId = null, onRetry = null, onExit = null, exitLabel = 'بازگشت به صفحهٔ اصلی' }) {
  const copy = SCOPE_COPY[scope] ?? SCOPE_COPY.root;

  return (
    <div
      data-error-boundary={scope}
      role="alert"
      dir="rtl"
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--background, #181818)',
        color: 'var(--white, #ffffff)',
        fontFamily: "'Pinar', 'Vazir', Tahoma, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: 'var(--surface, #242426)',
          border: '1px solid var(--border-solid, #3f3f47)',
          borderRadius: 20,
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: copy.accent,
            opacity: 0.9,
          }}
        />
        <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700 }}>{copy.title}</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.9, color: 'var(--muted, #d0d0d0)' }}>{copy.body}</p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              style={{
                border: 'none',
                cursor: 'pointer',
                borderRadius: 12,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
                background: 'var(--light-fill, #d4d4d4)',
                color: 'var(--ink-deep, #111114)',
              }}
            >
              تلاش دوباره
            </button>
          ) : null}

          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              style={{
                cursor: 'pointer',
                borderRadius: 12,
                padding: '10px 20px',
                fontSize: 14,
                fontFamily: 'inherit',
                background: 'transparent',
                color: 'var(--muted, #d0d0d0)',
                border: '1px solid var(--border-solid, #3f3f47)',
              }}
            >
              {exitLabel}
            </button>
          ) : null}
        </div>

        {/*
          شناسهٔ پیگیری: فقط یک کد کوتاه. نه stack، نه پیام خطا، نه نام فایل.
          کاربر می‌تواند همین را به پشتیبانی بدهد و ما در کنسول سرور پیدایش کنیم.
        */}
        {errorId ? (
          <p style={{ margin: '18px 0 0', fontSize: 11, color: 'var(--ghost, #707070)' }}>
            شناسهٔ پیگیری: <span dir="ltr">{errorId}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { errorId: null };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError() {
    /* فقط «خطا هست/نیست» — پیام خطا هرگز وارد state رابط کاربری نمی‌شود. */
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    this.setState({ errorId: reportError(error, info, this.props.scope ?? 'root') });
  }

  componentDidUpdate(prevProps) {
    /* تغییر کلید بازنشانی (مثلاً مسیر) ⇒ مرز خودش پاک می‌شود */
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) this.handleRetry();
  }

  handleRetry() {
    this.setState({ hasError: false, errorId: null });
    this.props.onReset?.();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <ErrorFallback
        scope={this.props.scope ?? 'root'}
        errorId={this.state.errorId}
        onRetry={this.handleRetry}
        onExit={this.props.onExit ?? null}
        exitLabel={this.props.exitLabel}
      />
    );
  }
}

export default ErrorBoundary;
