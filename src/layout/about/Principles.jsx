import { useRef } from 'react';

import { getAboutPrinciples } from '../../services/about/aboutService';
import { toFa, useInView } from './aboutShared';

/*
 * ── اصول تپش ──
 *
 * اینجا نه کارت است، نه شبکه. فقط تایپوگرافی و فضای خالی: هر اصل یک بلوکِ بلند
 * است که با رسیدن به مرکزِ دید، از پایین بالا می‌آید و خطِ زیرش کشیده می‌شود.
 * ترازِ بلوک‌ها یکی‌درمیان عوض می‌شود (راست / میان / چپ) تا ریتمِ عمودیِ صفحه
 * با بخش‌های دیگر یکسان نشود.
 */

function Principle({ text, index, total }) {
  const ref = useRef(null);
  const inView = useInView(ref, { threshold: 0.4 });

  return (
    <article
      className={`ab-principle ab-principle--${index % 3} ab-principle--motion-${index} ${
        inView ? 'is-in' : ''
      }`}
      ref={ref}
    >
      <span className="ab-principle__index">
        {toFa(index + 1)} <span aria-hidden="true">/</span> {toFa(total)}
      </span>
      <span className="ab-principle__signal" aria-hidden="true" />
      <p className="ab-principle__text">{text}</p>
      <span className="ab-principle__rule" aria-hidden="true" />
    </article>
  );
}

export default function Principles() {
  const data = getAboutPrinciples();

  return (
    <section className="ab-principles" aria-labelledby="ab-principles-title">
      <header className="ab-principles__head section-shell">
        <p className="ab-eyebrow" id="ab-principles-title">
          {data.eyebrow}
        </p>
      </header>

      <div className="ab-principles__list section-shell">
        {data.items.map((text, index) => (
          <Principle key={text} text={text} index={index} total={data.items.length} />
        ))}
      </div>
    </section>
  );
}
