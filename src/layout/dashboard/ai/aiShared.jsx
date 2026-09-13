import React from 'react';

/*
 * اجزای مشترک لایه AI — آیکون‌ها، رندرر Markdown و ثابت‌ها.
 * عمداً هیچ وابستگی خارجی (react-markdown و…) اضافه نشده؛ رندرر زیر فقط
 * React Element می‌سازد و هیچ‌وقت HTML خام تزریق نمی‌کند.
 */

/* ── آیکون‌ها (stroke ساده، ۲۴×۲۴) ───────────────────────────────────────── */

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

/* نشان AI — چهارپر ظریف، نه ربات و نه مغز دیجیتال */
export function SparkIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z" />
    </svg>
  );
}

export function SendIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  );
}

export function StopIcon(props) {
  return (
    <svg {...iconProps} fill="currentColor" stroke="none" {...props}>
      <rect x="7" y="7" width="10" height="10" rx="2.5" />
    </svg>
  );
}

export function AttachIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M20 11.5 12.4 19a4.6 4.6 0 0 1-6.5-6.5l7.3-7.3a3.1 3.1 0 0 1 4.4 4.4l-7.3 7.3a1.6 1.6 0 0 1-2.2-2.2l6.6-6.6" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CopyIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </svg>
  );
}

export function RefreshIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 3.5V7h-3.5" />
    </svg>
  );
}

export function LikeIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M7 11v9H4.5A1.5 1.5 0 0 1 3 18.5V12.5A1.5 1.5 0 0 1 4.5 11H7Zm0 0 3.8-6.8a1.7 1.7 0 0 1 3.2.8V9h4.2a2 2 0 0 1 2 2.4l-1.2 6a2 2 0 0 1-2 1.6H7" />
    </svg>
  );
}

export function DislikeIcon(props) {
  return (
    <svg {...iconProps} {...props} style={{ transform: 'scaleY(-1)', ...props.style }}>
      <path d="M7 11v9H4.5A1.5 1.5 0 0 1 3 18.5V12.5A1.5 1.5 0 0 1 4.5 11H7Zm0 0 3.8-6.8a1.7 1.7 0 0 1 3.2.8V9h4.2a2 2 0 0 1 2 2.4l-1.2 6a2 2 0 0 1-2 1.6H7" />
    </svg>
  );
}

export function ShareIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 3v11" />
      <path d="m8 6.5 4-3.5 4 3.5" />
      <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </svg>
  );
}

export function BookmarkIcon({ filled, ...props }) {
  return (
    <svg {...iconProps} fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="M6.5 4h11A1.5 1.5 0 0 1 19 5.5V21l-7-4-7 4V5.5A1.5 1.5 0 0 1 6.5 4Z" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function FileIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M13.5 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8L13.5 3Z" />
      <path d="M13.5 3v5H18.5" />
    </svg>
  );
}

export function ListIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

/* ── ثابت‌ها ──────────────────────────────────────────────────────────────── */

export const MAX_INPUT_LENGTH = 4000;

export const AI_MODES = [
  { id: 'general', label: 'عمومی', placeholder: 'هر چیزی می‌خواهی بپرس...' },
  { id: 'study', label: 'مطالعه', placeholder: 'برای مطالعه چه کمکی بخواهی؟' },
  { id: 'medical', label: 'پزشکی', placeholder: 'چه مفهوم پزشکی‌ای را توضیح بدهم؟' },
  { id: 'quiz', label: 'تست', placeholder: 'سؤال یا مبحث تست را بنویس...' },
];

/* ابزارهای Composer — ۳ تای اول داخل Toolbar و بقیه پشت «ابزارها» */
export const AI_TOOLS = [
  { id: 'search', label: 'جستجو در منابع', template: 'در منابع تپش جستجو کن: ' },
  { id: 'simple', label: 'توضیح ساده', template: 'این مفهوم را ساده توضیح بده: ' },
  { id: 'analyze', label: 'تحلیل سؤال', template: 'این سؤال را قدم‌به‌قدم تحلیل کن: ' },
  { id: 'solve', label: 'حل تست', template: 'این تست را حل کن: ' },
  { id: 'flashcards', label: 'ساخت فلش‌کارت', template: 'از این مبحث فلش‌کارت بساز: ' },
  { id: 'summarize', label: 'خلاصه‌سازی', template: 'این متن را خلاصه کن: ' },
  { id: 'quiz', label: 'ساخت آزمون', template: 'از این مبحث آزمون بساز: ' },
  { id: 'study', label: 'مطالعه با من', template: 'با من مطالعه کن، مبحث: ' },
];

export const PRIMARY_TOOL_COUNT = 3;

/* پیشنهادهای زیر پاسخ AI — Context-aware و کوتاه */
export const FOLLOW_UP_ACTIONS = [
  { id: 'simpler', label: 'ساده‌تر توضیح بده', prompt: 'ساده‌تر توضیح بده' },
  { id: 'continue', label: 'ادامه بده', prompt: 'ادامه بده' },
  { id: 'to-flashcards', label: 'به فلش‌کارت تبدیل کن', prompt: 'این پاسخ را به فلش‌کارت تبدیل کن' },
  { id: 'make-quiz', label: 'از این پاسخ تست بساز', prompt: 'از این پاسخ چند تست بساز' },
];

/* ── رندرر Markdown سبک ──────────────────────────────────────────────────── */

const INLINE_PATTERN = /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))/g;

function renderInline(text, keyBase) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyBase}-${key++}`} className="ai-md__code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*')) {
      nodes.push(<em key={`${keyBase}-${key++}`}>{token.slice(1, -1)}</em>);
    } else {
      const [, label, url] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
      if (label) {
        nodes.push(
          <a
            key={`${keyBase}-${key++}`}
            className="ai-md__link"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {label}
          </a>
        );
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const isTableSeparator = (cells) =>
  cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()));

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/*
 * پارسر بلاکی: هدر، لیست، جدول، نقل‌قول، کدبلاک، خط افقی و پاراگراف.
 * عمداً ساده نگه داشته شده — خروجی پاسخ مدل جریان داشتن دارد؛
 * وسط استریم هم همان‌قدر که آمده، درست رندر می‌شود.
 */
export function MarkdownLite({ text, className = '' }) {
  const lines = String(text ?? '').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    /* کدبلاک */
    if (line.trim().startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; /* بستن فنس */
      blocks.push(
        <pre key={key++} className="ai-md__pre" dir="ltr">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    /* هدر */
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level + 2}`; /* h3..h5 — سلسله‌مراتب صفحه را نمی‌شکند */
      blocks.push(
        <Tag key={key++} className={`ai-md__h ai-md__h--${level}`}>
          {renderInline(heading[2], `h${key}`)}
        </Tag>
      );
      i += 1;
      continue;
    }

    /* خط افقی */
    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      blocks.push(<hr key={key++} className="ai-md__hr" />);
      i += 1;
      continue;
    }

    /* جدول */
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('-')) {
      const headerCells = splitRow(line);
      const separatorCells = splitRow(lines[i + 1]);
      if (isTableSeparator(separatorCells)) {
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          rows.push(splitRow(lines[i]));
          i += 1;
        }
        blocks.push(
          <div key={key++} className="ai-md__table-wrap">
            <table className="ai-md__table">
              <thead>
                <tr>
                  {headerCells.map((cell, c) => (
                    <th key={c}>{renderInline(cell, `th${key}-${c}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c}>{renderInline(cell, `td${key}-${r}-${c}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    /* لیست‌ها */
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(isOrdered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-•*]\s+(.*)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        i += 1;
      }
      const Tag = isOrdered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={key++} className={`ai-md__list ${isOrdered ? 'ai-md__list--ol' : ''}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `li${key}-${idx}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    /* نقل‌قول */
    if (line.trim().startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote key={key++} className="ai-md__quote">
          {renderInline(quoteLines.join(' '), `q${key}`)}
        </blockquote>
      );
      continue;
    }

    /* پاراگراف — تا خط خالی یا شروع بلاک بعدی */
    const paragraphLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*([-•*]\s+|\d+[.)]\s+|#{1,3}\s+|>|\|)/.test(lines[i]) &&
      !lines[i].trim().startsWith('```')
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={key++} className="ai-md__p">
        {renderInline(paragraphLines.join(' '), `p${key}`)}
      </p>
    );
  }

  return <div className={`ai-md ${className}`}>{blocks}</div>;
}

export function toFaDigits(value) {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
