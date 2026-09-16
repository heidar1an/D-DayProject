import { useRef } from 'react';

import { getAboutClosing } from '../../services/about/aboutService';
import { AboutArrow, useInView } from './aboutShared';

/*
 * ── پایان روایت ──
 *
 * نه بنرِ تبلیغاتی، نه دکمهٔ رنگیِ بزرگ. دو جمله و یک لینکِ ساده که با همان
 * handlerِ بقیهٔ سایت کار می‌کند: اگر وارد شده‌ای می‌روی داشبورد، وگرنه
 * ورود/ثبت‌نام.
 */

export default function AboutCTA({ hasAccount = false, onStart }) {
  const data = getAboutClosing();
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { threshold: 0.3 });

  return (
    <section
      className={`ab-closing ${inView ? 'is-in' : ''}`}
      ref={rootRef}
      aria-labelledby="ab-closing-first"
    >
      <div className="ab-closing__inner section-shell">
        <p className="ab-closing__first" id="ab-closing-first">
          {data.first}
        </p>
        <p className="ab-closing__second">{data.second}</p>

        <a
          className="ab-closing__cta"
          href={hasAccount ? '#dashboard' : '#auth'}
          onClick={onStart}
        >
          <span>{data.cta}</span>
          <AboutArrow />
        </a>

        <a className="ab-closing__secondary" href="#products">
          {data.secondary}
        </a>
      </div>
    </section>
  );
}
