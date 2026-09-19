/*
 * پنل اطلاعات ساختار — مستقل و قابل توسعه برای اتصال به دیتابیس آموزشی تپش.
 * فاز اول فقط شناسه/نام/دسته را نشان می‌دهد؛ فیلدهای پزشکی (Origin, Insertion, …)
 * بعداً به همین کامپوننت اضافه می‌شوند بدون تغییر Viewer.
 */

export default function StructureInfo({ structure, categoryFa, onClear }) {
  if (!structure) return null;

  const sideLabel = structure.side === 'R' ? '(راست)' : structure.side === 'L' ? '(چپ)' : '';

  return (
    <div className="anatomy-info" role="region" aria-label="اطلاعات ساختار انتخاب‌شده">
      <div className="anatomy-info__head">
        <span className="anatomy-info__badge" style={{ '--cat-color': structure.catColor }} aria-hidden="true" />
        <div className="anatomy-info__titles">
          <strong className="anatomy-info__fa">
            {structure.fa || '—'}
            {sideLabel ? <span className="anatomy-info__side"> {sideLabel}</span> : null}
          </strong>
          <span className="anatomy-info__en" dir="ltr">
            {structure.label}
            {structure.side ? ` (${structure.side})` : ''}
          </span>
        </div>
        <button type="button" className="anatomy-info__close" onClick={onClear} aria-label="بستن پنل اطلاعات">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="anatomy-info__meta">
        <span className="anatomy-info__chip">{categoryFa}</span>
        <span className="anatomy-info__chip anatomy-info__chip--state">انتخاب‌شده</span>
      </div>
    </div>
  );
}
