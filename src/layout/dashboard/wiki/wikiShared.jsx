/* ── اجزای مشترک ویکی تپش ──
   آیکون‌های خطی سبک، چیپ‌ها و نشان‌های نوع/سطح — همه‌جا از یک منبع استفاده می‌کنند
   تا زبان بصری ویکی یکدست بماند. */

import {
  formatRelativeDays,
  subjectAccent,
  subjectLabel,
  typeLabel,
} from '../../../services/wiki/wikiService';

export const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* ── اسکرول در داشبورد دو ظرف دارد ──
   دسکتاپ (≥701px): کل داشبورد overflow:hidden است و .dashboard__section خودش اسکرول می‌شود؛
   موبایل: همان پنجره اسکرول می‌شود. هر جابه‌جایی عمودی ویکی باید هر دو را پوشش بدهد. */
export const getWikiScrollContainer = () => document.querySelector('.dashboard__section');

export const scrollWikiTop = () => {
  const container = getWikiScrollContainer();
  if (container) container.scrollTo({ top: 0, behavior: 'instant' });
  window.scrollTo({ top: 0, behavior: 'instant' });
};

/* ─────────────────────────── آیکون‌ها ─────────────────────────── */

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function Icon({ name, size = 18, className }) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.8-3.8" />
      </>
    ),
    back: <path d="M9 6l6 6-6 6" />,
    arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
    arrowUp: <path d="M12 19V5m-6 6 6-6 6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    bookmark: <path d="M6 4h12v17l-6-4.2L6 21V4z" />,
    bookmarkFilled: <path d="M6 4h12v17l-6-4.2L6 21V4z" fill="currentColor" />,
    share: (
      <>
        <circle cx="6" cy="12" r="2.4" />
        <circle cx="17.5" cy="6" r="2.4" />
        <circle cx="17.5" cy="18" r="2.4" />
        <path d="m8.2 10.8 7.1-3.6m-7.1 6 7.1 3.6" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2.4" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
      </>
    ),
    check: <path d="m5 13 4.2 4.2L19 7.5" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    filter: <path d="M4 6h16M7 12h10m-7 6h4" />,
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5z" />
        <path d="m3 13 9 5 9-5" opacity="0.6" />
      </>
    ),
    network: (
      <>
        <circle cx="12" cy="12" r="2.6" />
        <circle cx="5" cy="5.5" r="1.8" />
        <circle cx="19" cy="5.5" r="1.8" />
        <circle cx="5" cy="18.5" r="1.8" />
        <circle cx="19" cy="18.5" r="1.8" />
        <path d="M6.5 6.8 10 10.2m7.5-3.4L14 10.2M6.5 17.2 10 13.8m7.5 3.4L14 13.8" opacity="0.7" />
      </>
    ),
    flask: (
      <>
        <path d="M9.5 3h5M10.5 3v5.2L5.6 17a2.4 2.4 0 0 0 2.1 3.6h8.6a2.4 2.4 0 0 0 2.1-3.6l-4.9-8.8V3" />
        <path d="M7.8 14.5h8.4" opacity="0.6" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18.2l-1.8-5.6L4.7 10.8 10.2 9 12 3.5z" />
      </>
    ),
    history: (
      <>
        <path d="M4 12a8 8 0 1 1 2.3 5.7" />
        <path d="M4 13.5V9m0 4.5h4.5" opacity="0.8" />
        <path d="M12 8v4.4l2.8 1.7" />
      </>
    ),
    trend: (
      <>
        <path d="M4 17.5 10 11l3.4 3.4L20 7.5" />
        <path d="M15.5 7.5H20V12" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      {...strokeProps}
    >
      {paths[name] ?? null}
    </svg>
  );
}

/* نشان نوع محتوا (مفهوم/بیماری/دارو/...) با رنگ درس */
export function TypeBadge({ type, subject, className = '' }) {
  return (
    <span className={`wiki-type-badge ${className}`} style={{ '--accent': subjectAccent(subject) }}>
      {typeLabel(type)}
    </span>
  );
}

/* چیپ اطلاعات کوتاه */
export function Chip({ children, accent, plain, className = '', ...rest }) {
  return (
    <span
      className={`wiki-chip ${plain ? 'wiki-chip--plain' : ''} ${className}`}
      style={accent ? { '--accent': accent } : undefined}
      {...rest}
    >
      {children}
    </span>
  );
}

/* نشان سطح محتوا */
export function DifficultyBadge({ difficulty }) {
  const level = difficulty === 'پایه' ? 1 : difficulty === 'متوسط' ? 2 : 3;
  return (
    <span className="wiki-difficulty" title={`سطح: ${difficulty}`} aria-label={`سطح ${difficulty}`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < level ? 'is-on' : ''} aria-hidden="true" />
      ))}
      <span>{difficulty}</span>
    </span>
  );
}

/* متای خطی مقاله: زمان مطالعه، به‌روزرسانی، سطح */
export function ArticleMetaLine({ article }) {
  return (
    <span className="wiki-meta-line">
      <span>
        <Icon name="clock" size={15} />
        {toFa(article.readMinutes)} دقیقه مطالعه
      </span>
      <i aria-hidden="true" />
      <span>آخرین به‌روزرسانی: {formatRelativeDays(article.lastUpdated)}</span>
    </span>
  );
}

/* نشانگر «برو به مقاله» */
export function GoArrow({ className = '' }) {
  return (
    <span className={`wiki-go-arrow ${className}`} aria-hidden="true">
      <Icon name="arrowLeft" size={16} />
    </span>
  );
}

/* هاپرایت متن: هایلایت عبارت یافته‌شده داخل اسنیپت */
export function HighlightedText({ text, match }) {
  if (!match || !text.includes(match)) return <>{text}</>;
  const index = text.indexOf(match);
  return (
    <>
      {text.slice(0, index)}
      <mark>{match}</mark>
      {text.slice(index + match.length)}
    </>
  );
}

/* عنوان درس با رنگ اکسنت */
export function SubjectTag({ subject }) {
  return (
    <span className="wiki-subject-tag" style={{ '--accent': subjectAccent(subject) }}>
      {subjectLabel(subject)}
    </span>
  );
}
