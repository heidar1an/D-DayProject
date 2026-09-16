import { useRef } from 'react';

import { getAboutFuture, getAboutMeta } from '../../services/about/aboutService';
import { useInView } from './aboutShared';

/*
 * ── «این پایان تپش نیست» ──
 *
 * آینده را با وعده نمی‌نویسیم. هر ردیف سه چیز دارد: وضعیت (در حال ساخت / در
 * حال آزمایش / ایده / آینده)، عنوان، و یک خط درباره‌اش. ردیف‌ها با ورود به دید
 * پله‌ای بالا می‌آیند و خطِ افق زیرشان با همان پیشروی کشیده می‌شود.
 *
 * ⚠️ عنوان‌ها نمونه‌اند و هیچ تعهد یا زمان‌بندی‌ای اعلام نمی‌کنند؛ تا وقتی
 * `futureConfirmed` در `aboutService` درست نشود، یادداشتِ پای بخش می‌ماند.
 */

export default function FutureSection() {
  const data = getAboutFuture();
  const meta = getAboutMeta();
  const listRef = useRef(null);
  const inView = useInView(listRef, { threshold: 0.15 });

  return (
    <section className="ab-future section-shell" aria-labelledby="ab-future-title">
      <header className="ab-future__head">
        <p className="ab-eyebrow">{data.eyebrow}</p>
        <h2 className="ab-title ab-title--wide" id="ab-future-title">
          {data.title}
        </h2>
        <p className="ab-lead">{data.lead}</p>
      </header>

      <ul className={`ab-future__rows ${inView ? 'is-in' : ''}`} ref={listRef}>
        {data.items.map((item, index) => {
          const status = data.statuses[item.status] ?? data.statuses.idea;

          return (
            <li className="ab-future__row" key={item.id} style={{ '--ab-i': index }}>
              <span className={`ab-future__status ab-accent-${status.accent}`}>{status.label}</span>
              <p className="ab-future__label">{item.label}</p>
              <p className="ab-future__text">{item.text}</p>
            </li>
          );
        })}
      </ul>

      <span className="ab-future__horizon" aria-hidden="true" />

      {!meta.futureConfirmed && <p className="ab-footnote">{meta.futureNote}</p>}
    </section>
  );
}
