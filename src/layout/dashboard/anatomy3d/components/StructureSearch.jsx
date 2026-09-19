/*
 * جست‌وجوی ساختار — فارسی و انگلیسی؛ نتیجهٔ انتخابی فوکوس دوربین + انتخاب می‌گیرد.
 * جست‌وجو روی ثبت ساختارهای موتور انجام می‌شود (که با بارگذاری تدریجی کامل می‌شود).
 */

import { useMemo, useState } from 'react';
import { normalizeQuery } from '../data/persianNames';

export default function StructureSearch({ engine, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = normalizeQuery(query);
    if (q.length < 2 || !engine) return [];
    const scored = [];
    for (const s of engine.listStructures()) {
      if (!s.selectable) continue;
      const en = s.label.toLowerCase();
      let score = 0;
      if (en === q || s.fa === q) score = 100;
      else if (en.startsWith(q)) score = 80;
      else if (s.fa?.startsWith(q)) score = 76;
      else if (en.includes(q)) score = 55;
      else if (s.fa?.includes(q)) score = 50;
      if (score > 0) scored.push({ s, score });
    }
    scored.sort((a, b) => b.score - a.score || a.s.label.length - b.s.label.length);
    return scored.slice(0, 12).map(({ s }) => s);
  }, [query, engine]);

  const handlePick = (structure) => {
    setOpen(false);
    setQuery('');
    onSelect?.(structure);
  };

  return (
    <div className="anatomy-search">
      <div className="anatomy-search__box">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.4" />
          <path d="m16 16 4.4 4.4" />
        </svg>
        <input
          type="search"
          dir="auto"
          className="anatomy-search__input"
          placeholder="جست‌وجوی ساختار… (مثلاً Biceps یا دوسر)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="جست‌وجوی ساختار آناتومیک"
        />
      </div>

      {open && results.length > 0 ? (
        <ul className="anatomy-search__results" role="listbox" aria-label="نتایج جست‌وجو">
          {results.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                className="anatomy-search__result"
                onMouseDown={(e) => e.preventDefault()} /* جلوگیری از بستن قبل از کلیک */
                onClick={() => handlePick(s)}
              >
                <span className="anatomy-search__dot" style={{ '--cat-color': s.catColor }} aria-hidden="true" />
                <span className="anatomy-search__fa">{s.fa || s.label}</span>
                <span className="anatomy-search__en" dir="ltr">{s.label}{s.side ? ` (${s.side})` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
