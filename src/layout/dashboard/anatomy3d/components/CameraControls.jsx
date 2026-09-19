/* کنترل دوربین — ریست و نمای‌های استاندارد */

const VIEWS = [
  { id: 'reset', fa: 'ریست', d: 'M12 4.2a7.8 7.8 0 1 1-7.8 7.8M4.2 4.2v4.6h4.6' },
  { id: 'front', fa: 'جلو', d: 'M12 3.4c3 0 5.4 2.4 5.4 5.4v6.4c0 3-2.4 5.4-5.4 5.4S6.6 18.2 6.6 15.2V8.8c0-3 2.4-5.4 5.4-5.4Z' },
  { id: 'back', fa: 'عقب', d: 'M12 3.4c3 0 5.4 2.4 5.4 5.4v6.4c0 3-2.4 5.4-5.4 5.4S6.6 18.2 6.6 15.2V8.8c0-3 2.4-5.4 5.4-5.4ZM9.5 7.5h5M9.5 10.5h5' },
  { id: 'left', fa: 'چپ', d: 'M9 3.4c-2.4.6-4 3-4 5.8v5.6c0 2.8 1.6 5.2 4 5.8M15 3.4c2.4.6 4 3 4 5.8v5.6c0 2.8-1.6 5.2-4 5.8' },
  { id: 'right', fa: 'راست', d: 'M15 3.4c2.4.6 4 3 4 5.8v5.6c0 2.8-1.6 5.2-4 5.8M9 3.4c-2.4.6-4 3-4 5.8v5.6c0 2.8 1.6 5.2 4 5.8' },
];

export default function CameraControls({ onView }) {
  return (
    <div className="anatomy-cameras" role="group" aria-label="نمای دوربین">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className="anatomy-cameras__btn"
          onClick={() => onView(v.id)}
          title={`نمای ${v.fa}`}
          aria-label={`نمای ${v.fa}`}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={v.d} />
          </svg>
          <span>{v.fa}</span>
        </button>
      ))}
    </div>
  );
}
