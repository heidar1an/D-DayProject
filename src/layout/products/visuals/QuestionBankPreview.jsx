import { getQuestionBankPreview } from '../../../services/products/productsService';
import { toFa } from '../productsShared';

/*
 * ── پیش‌نمایش بانک تست ──
 *
 * چهار حالت دارد و حالتِ فعال از بیرون می‌آید (`stage`):
 *   question → سؤالِ ساده با زمان‌سنج
 *   answer   → پاسخ تشریحی
 *   analysis → تحلیل عملکرد
 *   trend    → روند پیشرفت
 *
 * چرا همهٔ پنل‌ها هم‌زمان رندر می‌شوند: جابه‌جایی فقط با opacity و transform
 * است، پس هیچ اندازه‌گیری و هیچ انیمیشنِ width/height در کار نیست. پنلِ غیرفعال
 * با `aria-hidden` از دسترس خارج می‌شود؛ هیچ المان فوکوس‌پذیری هم ندارد که
 * لازم باشد از چرخهٔ فوکوس بیرون گذاشته شود.
 */

function TrendSpark({ points }) {
  const width = 220;
  const height = 56;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;

  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      className="ps-qb__spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      focusable="false"
      aria-hidden="true"
    >
      <polyline className="ps-qb__spark-line" points={coords.join(' ')} vectorEffect="non-scaling-stroke" />
      <polyline
        className="ps-qb__spark-area"
        points={`0,${height} ${coords.join(' ')} ${width},${height}`}
      />
    </svg>
  );
}

export default function QuestionBankPreview({ stage = 'question' }) {
  const data = getQuestionBankPreview();
  const { analysis } = data;

  return (
    <div className="ps-qb" data-stage={stage}>
      <div className="ps-qb__head">
        <span className="ps-qb__topic">{data.topic}</span>
        <span className="ps-qb__meta">
          <span className="ps-qb__count">
            {toFa(data.number)} / {toFa(data.total)}
          </span>
          <span className={`ps-qb__difficulty ps-qb__difficulty--${data.difficulty === 'متوسط' ? 'mid' : 'low'}`}>
            {data.difficulty}
          </span>
          <span className="ps-qb__timer">{data.timer}</span>
        </span>
      </div>

      <div className="ps-qb__stage">
        <div
          className={`ps-qb__panel ${stage === 'question' ? 'is-active' : ''}`}
          aria-hidden={stage !== 'question'}
        >
          <p className="ps-qb__question">{data.question}</p>
          <ul className="ps-qb__options">
            {data.options.map((option) => (
              <li className="ps-qb__option" key={option.id}>
                <span className="ps-qb__key">{option.id.toUpperCase()}</span>
                <span>{option.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`ps-qb__panel ${stage === 'answer' ? 'is-active' : ''}`}
          aria-hidden={stage !== 'answer'}
        >
          <p className="ps-qb__question">{data.question}</p>
          <ul className="ps-qb__options">
            {data.options.map((option) => (
              <li
                className={`ps-qb__option ${
                  option.correct ? 'is-correct' : option.id === 'c' ? 'is-wrong' : ''
                }`}
                key={option.id}
              >
                <span className="ps-qb__key">{option.id.toUpperCase()}</span>
                <span>{option.text}</span>
              </li>
            ))}
          </ul>
          <p className="ps-qb__explain">
            فاز پلاتو با ورود کلسیم طولانی می‌شود و دورهٔ تحریک‌ناپذیری را تا پایان انقباض
            نگه می‌دارد؛ پس انقباض‌های پشت‌سرهم جمع نمی‌شوند.
          </p>
        </div>

        <div
          className={`ps-qb__panel ${stage === 'analysis' ? 'is-active' : ''}`}
          aria-hidden={stage !== 'analysis'}
        >
          <div className="ps-qb__grid">
            <div className="ps-qb__stat">
              <span className="ps-qb__stat-label">پاسخ صحیح</span>
              <span className="ps-qb__stat-value ps-qb__stat-value--good">
                {toFa(analysis.correctPercent)}٪
              </span>
            </div>
            <div className="ps-qb__stat">
              <span className="ps-qb__stat-label">زمان پاسخ‌گویی</span>
              <span className="ps-qb__stat-value">{analysis.responseTime}</span>
            </div>
            <div className="ps-qb__stat">
              <span className="ps-qb__stat-label">تست حل‌شده</span>
              <span className="ps-qb__stat-value">{toFa(analysis.solved)}</span>
            </div>
          </div>

          <div className="ps-qb__lists">
            <div>
              <p className="ps-qb__list-title">موضوعات ضعیف</p>
              <ul className="ps-qb__chips ps-qb__chips--weak">
                {analysis.weak.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="ps-qb__list-title">موضوعات قوی</p>
              <ul className="ps-qb__chips ps-qb__chips--strong">
                {analysis.strong.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div
          className={`ps-qb__panel ${stage === 'trend' ? 'is-active' : ''}`}
          aria-hidden={stage !== 'trend'}
        >
          <p className="ps-qb__list-title">روند پیشرفت — ۷ آزمون اخیر</p>
          <TrendSpark points={analysis.trend} />
          <div className="ps-qb__trend-foot">
            <span>از {toFa(analysis.trend[0])}٪</span>
            <span className="ps-qb__trend-now">
              تا {toFa(analysis.trend[analysis.trend.length - 1])}٪
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
