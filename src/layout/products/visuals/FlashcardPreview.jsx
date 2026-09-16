import { useState } from 'react';

import { getFlashcardPreview } from '../../../services/products/productsService';
import { toFa } from '../productsShared';

/*
 * ── پیش‌نمایش فلش‌کارت ──
 *
 * برگرداندن دو راه دارد، چون یک راه کافی نیست:
 *   · روی نشانگرِ ماوس (hover) — فقط وقتی دستگاه hover دارد (media hover)
 *   · کلیک/اینتر — برای لمس و کیبورد، و برای «سنجاق‌کردن» کارت
 * پس هیچ ویژگی‌ای فقط با هاور در دسترس نیست؛ قانونِ بخش موبایل همین است.
 */

export default function FlashcardPreview() {
  const data = getFlashcardPreview();
  const [pinned, setPinned] = useState(false);

  return (
    <div className="ps-flash">
      <button
        type="button"
        className={`ps-flip ${pinned ? 'is-flipped' : ''}`}
        onClick={() => setPinned((value) => !value)}
        aria-pressed={pinned}
        aria-label="برگرداندن فلش‌کارت"
      >
        <span className="ps-flip__inner">
          <span className="ps-flip__face ps-flip__face--front">
            <span className="ps-flip__kind">اصطلاح</span>
            <span className="ps-flip__text">{data.front}</span>
            <span className="ps-flip__hint">برای دیدن تعریف کلیک کن</span>
          </span>

          <span className="ps-flip__face ps-flip__face--back">
            <span className="ps-flip__kind">تعریف</span>
            <span className="ps-flip__text">{data.back}</span>
          </span>
        </span>
      </button>

      <dl className="ps-flash__stats">
        <div className="ps-flash__stat">
          <dt>امروز</dt>
          <dd>
            {toFa(data.due)} <small>کارت</small>
          </dd>
        </div>
        <div className="ps-flash__stat">
          <dt>تسلط</dt>
          <dd>{toFa(data.mastery)}٪</dd>
        </div>
        <div className="ps-flash__stat">
          <dt>پیاپی</dt>
          <dd>
            {toFa(data.streak)} <small>روز</small>
          </dd>
        </div>
      </dl>
    </div>
  );
}
