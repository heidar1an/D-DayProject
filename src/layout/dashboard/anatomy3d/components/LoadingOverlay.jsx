/* روکش بارگذاری — درصد پیشرفت واقعی بر اساس بایت دانلودشدهٔ سیستم‌ها */

export default function LoadingOverlay({ percent, systemLabel }) {
  const rounded = Math.floor(percent ?? 0);
  return (
    <div className="anatomy-overlay" role="status" aria-live="polite">
      <div className="anatomy-overlay__card">
        <div className="anatomy-overlay__glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="4.6" r="2.1" />
            <path d="M12 6.7v6.1" />
            <path d="M12 8.5 6.8 10.9" />
            <path d="M12 8.5l5.2 2.4" />
            <path d="M12 12.8 9 19.4" />
            <path d="M12 12.8l3 6.6" />
          </svg>
        </div>
        <h2 className="anatomy-overlay__title">Loading 3D Anatomy</h2>
        <p className="anatomy-overlay__hint">در حال آماده‌سازی ساختارهای آناتومیک…</p>

        <div
          className="anatomy-overlay__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
        >
          <div className="anatomy-overlay__fill" style={{ width: `${rounded}%` }} />
        </div>
        <div className="anatomy-overlay__meta">
          <span>{rounded}٪</span>
          {systemLabel ? <span className="anatomy-overlay__system">{systemLabel}</span> : null}
        </div>
      </div>
    </div>
  );
}
