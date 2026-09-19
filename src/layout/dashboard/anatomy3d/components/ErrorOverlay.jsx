/* روکش خطا — پیام فارسی + دکمهٔ تلاش مجدد؛ خطای فنی در console ثبت می‌شود */

export default function ErrorOverlay({ message, onRetry }) {
  return (
    <div className="anatomy-overlay" role="alert">
      <div className="anatomy-overlay__card anatomy-overlay__card--error">
        <div className="anatomy-overlay__glyph anatomy-overlay__glyph--error" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.6 21 19.2H3L12 3.6Z" />
            <path d="M12 9.6v4.2" />
            <path d="M12 16.9h.01" />
          </svg>
        </div>
        <h2 className="anatomy-overlay__title">بارگذاری مدل آناتومی با مشکل مواجه شد</h2>
        <p className="anatomy-overlay__hint">
          {message || 'اتصال اینترنت یا فایل‌های مدل را بررسی کنید.'}
        </p>
        {onRetry ? (
          <button type="button" className="anatomy-overlay__retry" onClick={onRetry}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 3.6v4.2h-4.2" />
            </svg>
            تلاش مجدد
          </button>
        ) : null}
      </div>
    </div>
  );
}
