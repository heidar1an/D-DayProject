/*
 * پنل لایه‌های آناتومیک — کنترل visibility هر دسته + کنترل گروهی.
 * هر گزینه با رنگ دسته رنگ‌آمیزی می‌شود تا تطابق با رنگ مدل در صحنه معلوم باشد.
 */

import { ANATOMY_CATEGORIES } from '../data/anatomyCategories';

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      {off ? <path d="M4.5 19.5 19.5 4.5" /> : null}
    </svg>
  );
}

export default function LayerPanel({ visibility, onToggle, onShowAll, onHideAll, onReset }) {
  const shownCount = ANATOMY_CATEGORIES.filter((c) => visibility[c.id]).length;

  return (
    <div className="anatomy-panel" aria-label="کنترل لایه‌های آناتومیک">
      <div className="anatomy-panel__head">
        <h3 className="anatomy-panel__title">لایه‌های آناتومیک</h3>
        <span className="anatomy-panel__count">{shownCount}/{ANATOMY_CATEGORIES.length}</span>
      </div>

      <div className="anatomy-panel__group" role="group" aria-label="کنترل گروهی لایه‌ها">
        <button type="button" className="anatomy-panel__action" onClick={onShowAll}>
          نمایش همه
        </button>
        <button type="button" className="anatomy-panel__action" onClick={onHideAll}>
          مخفی کردن همه
        </button>
        <button type="button" className="anatomy-panel__action" onClick={onReset}>
          بازگردانی وضعیت اولیه
        </button>
      </div>

      <ul className="anatomy-panel__list">
        {ANATOMY_CATEGORIES.map((cat) => {
          const on = !!visibility[cat.id];
          return (
            <li key={cat.id}>
              <button
                type="button"
                className={`anatomy-layer-row${on ? ' is-on' : ''}`}
                onClick={() => onToggle(cat.id)}
                aria-pressed={on}
                title={`${cat.fa} — ${cat.en}`}
              >
                <span className="anatomy-layer-row__dot" style={{ '--cat-color': cat.color }} aria-hidden="true" />
                <span className="anatomy-layer-row__name">{cat.fa}</span>
                <span className="anatomy-layer-row__en">{cat.en}</span>
                <span className="anatomy-layer-row__eye" aria-hidden="true">
                  <EyeIcon off={!on} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
