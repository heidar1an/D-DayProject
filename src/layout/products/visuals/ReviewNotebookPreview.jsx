import { getReviewNotebookPreview } from '../../../services/products/productsService';
import { toFa } from '../productsShared';

/*
 * ── پیش‌نمایش دفترچهٔ مرور ──
 *
 * همان چیزی که کاربر داخل محصول می‌بیند: صفِ مرورِ امروز و نردبانِ پنج‌پله‌ای
 * مرور. پله‌ها از خودِ سرویس دفترچهٔ مرور می‌آیند (`G5_STAGES`)، پس اگر
 * فاصله‌های مرور عوض شوند این پیش‌نمایش هم خودکار عوض می‌شود.
 */

export default function ReviewNotebookPreview() {
  const data = getReviewNotebookPreview();
  const stageCount = Math.max(data.stages.length, 1);

  return (
    <div className="ps-review">
      <div className="ps-review__head">
        <span className="ps-review__due">
          <span className="ps-review__due-value">{toFa(data.dueToday)}</span>
          <span className="ps-review__due-label">مرور امروز</span>
        </span>

        <span className="ps-review__ladder" aria-hidden="true">
          {data.stages.map((label, index) => (
            <span className="ps-review__rung" key={label} style={{ '--ps-i': index }} />
          ))}
        </span>
      </div>

      <ul className="ps-review__items">
        {data.items.map((item) => (
          <li className="ps-review__item" key={item.id}>
            <span className="ps-review__item-main">
              <span className="ps-review__item-title">{item.title}</span>
              <span className="ps-review__item-subject">{item.subject}</span>
            </span>

            <span className="ps-review__item-side">
              <span
                className="ps-review__item-stage"
                aria-label={`پلهٔ ${toFa(item.stage)} از ${toFa(stageCount)}`}
              >
                {data.stages[item.stage - 1]}
              </span>
              <span className="ps-review__item-due">{item.due}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="ps-review__foot">
        {toFa(stageCount)} پلهٔ مرور برای هر مبحثی که یاد می‌گیری.
      </p>
    </div>
  );
}
