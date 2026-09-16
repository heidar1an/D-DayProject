import { useMemo, useState } from 'react';

import { getWikiPreview } from '../../../services/products/productsService';

/*
 * ── پیش‌نمایش ویکی تپش ──
 *
 * این یک «انیمیشنِ تایپ‌شدنِ قلابی» نیست: یک جست‌وجوی واقعی روی همان فهرستی
 * است که در سرویس آمده. پس کاربر می‌تواند هرچه دلش خواست بنویسد و نتیجه منطقی
 * می‌گیرد — حتی «نتیجه‌ای پیدا نشد».
 *
 * نتایج با تأخیرِ پله‌ای (`--ps-i`) وارد می‌شوند؛ انیمیشن فقط روی opacity و
 * transform است و در `prefers-reduced-motion` کاملاً خاموش می‌شود.
 */

export default function WikiPreview() {
  const data = getWikiPreview();
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!needle) return [];

    return data.terms.filter(
      (term) =>
        term.title.toLowerCase().includes(needle) ||
        term.subtitle.toLowerCase().includes(needle) ||
        term.topics.some((topic) => topic.toLowerCase().includes(needle)),
    );
  }, [data.terms, needle]);

  return (
    <div className="ps-wiki">
      <div className="ps-wiki__search">
        <span className="ps-wiki__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
        </span>

        <input
          className="ps-wiki__input"
          type="search"
          dir="auto"
          value={query}
          placeholder={data.placeholder}
          aria-label="جست‌وجو در ویکی تپش"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {!needle ? (
        <ul className="ps-wiki__suggest">
          {data.terms.slice(0, 3).map((term) => (
            <li key={term.id}>
              <button type="button" onClick={() => setQuery(term.title)}>
                {term.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {needle && results.length > 0 ? (
        <ul className="ps-wiki__results">
          {results.map((term, index) => (
            <li className="ps-wiki__result" key={term.id} style={{ '--ps-i': index }}>
              <span className="ps-wiki__result-title">{term.title}</span>
              <span className="ps-wiki__result-sub">{term.subtitle}</span>
              <span className="ps-wiki__result-topics">{term.topics.join(' · ')}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {needle && results.length === 0 ? (
        <p className="ps-wiki__empty">نتیجه‌ای برای این عبارت پیدا نشد.</p>
      ) : null}
    </div>
  );
}
