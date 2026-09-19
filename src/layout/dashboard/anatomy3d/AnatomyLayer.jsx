/*
 * لایهٔ «آناتومی سه‌بعدی» — ورودی بخش از داشبورد تپش.
 * هدر باریک + Viewer تمام‌صفحه؛ هم‌الگو با لایه‌های دیگر (ویکی، هوش مصنوعی).
 */

import { useEffect } from 'react';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import AnatomyViewer from './AnatomyViewer';

const ANATOMY_VIEW = { mode: 'viewer' };

export default function AnatomyLayer({ onBack }) {
  useLayerRoute(LAYER_IDS.anatomy3d, ANATOMY_VIEW);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onBack?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <section className="anatomy-layer" dir="rtl" aria-label="آناتومی سه‌بعدی انسان">
      <header className="anatomy-layer__header">
        <button type="button" className="anatomy-layer__back" onClick={() => onBack?.()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m11 6-6 6 6 6" />
          </svg>
          بازگشت
        </button>

        <div className="anatomy-layer__title">
          <h1>آناتومی سه‌بعدی انسان</h1>
          <span className="anatomy-layer__subtitle">هستهٔ نمایش آناتومی تپش — فاز Viewer</span>
        </div>

        <span className="anatomy-layer__source" dir="ltr">Powered by Z-Anatomy models</span>
      </header>

      <div className="anatomy-layer__stage">
        <AnatomyViewer />
      </div>
    </section>
  );
}
