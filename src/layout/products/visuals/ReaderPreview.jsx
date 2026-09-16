import { getReaderPreview } from '../../../services/products/productsService';
import { toFa } from '../productsShared';

/*
 * ── پیش‌نمایش محیطِ درسنامه (Reader) ──
 *
 * این یک تصویر تزیینی نیست: همان چیزی است که کاربر داخل «درسنامهٔ جامع»
 * می‌بیند — فهرست فصل‌ها، متن، هایلایت، نکتهٔ مهم و نوار پیشرفت.
 *
 * پارالاکس با متغیر `--ps-progress` کار می‌کند که والد (نمای بزرگ) روی خودش
 * می‌نویسد؛ پس هیچ state و هیچ شنوندهٔ اسکرولی در این کامپوننت نیست.
 * برای صفحه‌خوان یک `role="img"` با یک برچسب است، چون محتوایش تکرارِ همان
 * چیزی است که در متن معرفی آمده.
 */

export default function ReaderPreview() {
  const data = getReaderPreview();

  return (
    <div
      className="ps-reader"
      role="img"
      aria-label={`پیش‌نمایش محیط درسنامه: ${data.title} — ${data.progress} درصد پیشرفت`}
    >
      <div className="ps-reader__bar">
        <span className="ps-reader__chapter">{data.chapter}</span>

        <span className="ps-reader__tools">
          <span className="ps-reader__tool ps-reader__tool--on" title="نشانک">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M7 4h10v16l-5-4-5 4z" />
            </svg>
          </span>
          <span className="ps-reader__tool" title="هایلایت">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 19h16M9 15l-2 2 1.5 1.5 2-2zM14.5 4.5l4 4-7 7-4-4z" />
            </svg>
          </span>
        </span>
      </div>

      <div className="ps-reader__body">
        <aside className="ps-reader__sidebar">
          <p className="ps-reader__sidebar-title">فهرست فصل</p>
          <ul>
            {data.sidebar.map((item) => (
              <li
                className={`ps-reader__item ${item.active ? 'is-active' : ''}`}
                key={item.label}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </aside>

        <div className="ps-reader__page">
          <h4 className="ps-reader__title">{data.title}</h4>

          <p className="ps-reader__paragraph">{data.paragraphs[0]}</p>

          <p className="ps-reader__highlight">{data.highlight}</p>

          <figure className="ps-reader__figure">
            <svg viewBox="0 0 240 72" focusable="false" aria-hidden="true">
              <path
                className="ps-reader__wave"
                d="M4 44h34l10-26 8 44 10-30 8 12h30l10-20 8 30 9-16h105"
              />
              <path className="ps-reader__axis" d="M4 58h232" />
            </svg>
            <figcaption>پتانسیل عمل میوکارد — فاز پلاتو</figcaption>
          </figure>

          <p className="ps-reader__paragraph">{data.paragraphs[1]}</p>

          <p className="ps-reader__note">{data.note}</p>
        </div>
      </div>

      <div className="ps-reader__foot">
        <span className="ps-reader__page-label">{data.pageLabel}</span>
        <span className="ps-reader__progress" aria-hidden="true">
          <span className="ps-reader__progress-fill" style={{ width: `${data.progress}%` }} />
        </span>
        <span className="ps-reader__progress-label">{toFa(data.progress)}٪</span>
      </div>
    </div>
  );
}
