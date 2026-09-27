import Icon from './icons';
import { RichText } from './richText';
import { useReader } from './readerContext';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const CALLOUT_META = {
  important: { icon: 'bulb', label: 'نکته مهم' },
  exam: { icon: 'star', label: 'نقطه امتحانی' },
  clinical: { icon: 'cross', label: 'ارتباط بالینی' },
  warning: { icon: 'warn', label: 'هشدار' },
  definition: { icon: 'book', label: 'تعریف' },
  keypoint: { icon: 'keypoint', label: 'نکته کلیدی' },
};

/* هایلایت‌ها و نوت‌های همین بلوک + ترم برجسته‌شده جست‌وجو */
function useBlockMarks(blockId) {
  const { highlights, notes, flashTerm } = useReader();
  return [
    highlights.filter((h) => h.blockId === blockId),
    notes.filter((n) => n.blockId === blockId),
    flashTerm,
  ];
}

export function TextBlock({ block }) {
  const [blockHighlights, blockNotes, flashTerm] = useBlockMarks(block.id);
  return (
    <p className="rdr-p" data-block-id={block.id}>
      <RichText text={block.text} highlights={blockHighlights} notes={blockNotes} flashTerm={flashTerm} />
    </p>
  );
}

/* HTML متن مبحث در سرور هنگام ذخیره پاک‌سازی شده است. */
export function HtmlBlock({ block }) {
  return <div className="rdr-html" data-block-id={block.id} dangerouslySetInnerHTML={{ __html: block.html }} />;
}

export function HeadingBlock({ block }) {
  const Tag = block.type; // h1 | h2 | h3
  return (
    <Tag className={`rdr-h rdr-h--${block.type}`} data-block-id={block.id}>
      <RichText text={block.text} />
    </Tag>
  );
}

export function QuoteBlock({ block }) {
  return (
    <blockquote className="rdr-quote" data-block-id={block.id}>
      <p>
        <RichText text={block.text} />
      </p>
      {block.cite && <cite>{block.cite}</cite>}
    </blockquote>
  );
}

export function FormulaBlock({ block }) {
  return (
    <figure className="rdr-formula" data-block-id={block.id}>
      <span dir="ltr" className="rdr-formula__expr">
        {block.expr}
      </span>
      {block.note && <figcaption>{block.note}</figcaption>}
    </figure>
  );
}

export function CalloutBlock({ block }) {
  const meta = CALLOUT_META[block.variant] ?? CALLOUT_META.important;
  const [blockHighlights, blockNotes, flashTerm] = useBlockMarks(block.id);
  return (
    <aside className={`rdr-callout rdr-callout--${block.variant}`} data-block-id={block.id}>
      <span className="rdr-callout__head">
        <Icon name={meta.icon} size={17} />
        <strong>{block.title ?? meta.label}</strong>
      </span>
      <p>
        <RichText text={block.text} highlights={blockHighlights} notes={blockNotes} flashTerm={flashTerm} />
      </p>
    </aside>
  );
}

/* تصویر: بارگذاری تنبل + باز شدن در نمایشگر بزرگ‌نمایی */
export function ImageBlock({ block }) {
  const { setViewerImage } = useReader();
  return (
    <figure className="rdr-figure" data-block-id={block.id}>
      <button
        type="button"
        className="rdr-figure__zoom"
        onClick={() => setViewerImage(block)}
        title="مشاهده در اندازه بزرگ"
        aria-label={`بزرگ‌نمایی تصویر: ${block.caption ?? block.alt ?? ''}`}
      >
        <img src={block.src} alt={block.alt ?? ''} loading="lazy" draggable={false} />
        <span className="rdr-figure__hint" aria-hidden="true">
          <Icon name="expand" size={14} />
        </span>
      </button>
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  );
}

/* جدول: داخل قاب اسکرول افقی تا در موبایل هم خوانا بماند */
export function TableBlock({ block }) {
  return (
    <figure className="rdr-table" data-block-id={block.id}>
      {block.caption && <figcaption>{block.caption}</figcaption>}
      <div className="rdr-table__scroll" tabIndex={0} role="region" aria-label={block.caption ?? 'جدول'}>
        <table>
          <thead>
            <tr>
              {block.headers.map((header, i) => (
                <th key={i} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} data-latin={/^[\x20-\x7E]+$/.test(cell) || undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function DividerBlock() {
  return <hr className="rdr-divider" />;
}

/* کارت اسکلت هنگام بارگذاری فصل */
export function BlockSkeleton() {
  return (
    <div className="rdr-skeleton" aria-hidden="true">
      <span style={{ width: '46%', height: 30 }} />
      <span />
      <span style={{ width: '88%' }} />
      <span style={{ width: '72%' }} />
      <span style={{ width: '55%', height: 120 }} />
      <span style={{ width: '84%' }} />
      <span style={{ width: '63%' }} />
    </div>
  );
}

export const toFaNumber = toFa;
