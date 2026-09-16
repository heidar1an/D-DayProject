import { useEffect, useRef, useState } from 'react';

import { getCoordinatedExamPreview } from '../../../services/products/productsService';
import { toFa, useInView } from '../productsShared';

/*
 * ── پیش‌نمایش آزمون‌های هماهنگ ──
 *
 * شمارنده فقط وقتی در دید است کار می‌کند (`useInView`)؛ پس یک تایمرِ یک‌ثانیه‌ای
 * در پس‌زمینهٔ کل صفحه روشن نمی‌ماند. عددها با `toFa` فارسی می‌شوند و با صفرِ
 * پیش‌فرض (pad) دو رقمی نوشته می‌شوند تا هنگام تغییر، عرضِ بلوک نپرد.
 */

const pad = (value) => String(value).padStart(2, '0');

export default function CoordinatedExamPreview() {
  const data = getCoordinatedExamPreview();
  const rootRef = useRef(null);
  const inView = useInView(rootRef);

  const totalSeconds = data.days * 86400 + data.hours * 3600 + data.minutes * 60;
  const [left, setLeft] = useState(totalSeconds);

  useEffect(() => {
    if (!inView) return undefined;

    const timerId = window.setInterval(() => {
      setLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [inView]);

  const days = Math.floor(left / 86400);
  const hours = Math.floor((left % 86400) / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;

  return (
    <div className="ps-exam" ref={rootRef}>
      <p className="ps-exam__title">{data.title}</p>

      <div className="ps-exam__countdown" role="timer" aria-label="زمان باقی‌مانده تا آزمون">
        <span className="ps-exam__unit">
          <b>{toFa(pad(days))}</b>
          <small>روز</small>
        </span>
        <span className="ps-exam__sep">:</span>
        <span className="ps-exam__unit">
          <b>{toFa(pad(hours))}</b>
          <small>ساعت</small>
        </span>
        <span className="ps-exam__sep">:</span>
        <span className="ps-exam__unit">
          <b>{toFa(pad(minutes))}</b>
          <small>دقیقه</small>
        </span>
        <span className="ps-exam__sep">:</span>
        <span className="ps-exam__unit">
          <b>{toFa(pad(seconds))}</b>
          <small>ثانیه</small>
        </span>
      </div>

      <dl className="ps-exam__stats">
        <div className="ps-exam__stat">
          <dt>شرکت‌کننده</dt>
          <dd>{toFa(data.participants)}</dd>
        </div>
        <div className="ps-exam__stat">
          <dt>رتبهٔ شما</dt>
          <dd>{toFa(data.rank)}</dd>
        </div>
        <div className="ps-exam__stat">
          <dt>میانگین</dt>
          <dd>{data.average}</dd>
        </div>
      </dl>
    </div>
  );
}
