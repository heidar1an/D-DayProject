import { useMemo } from 'react';

import Icon from './icons';
import { RichText, snapToWordEdges } from './richText';
import { useReader } from './readerContext';

/*
 * هایلایت/نوت را داخل HTML غنی (بلوک‌های متنِ ویرایشگر پنل) نشان می‌دهد.
 * offsetهای ذخیره‌شده روی الحاقِ متن‌گره‌ها حساب شده‌اند؛ اینجا همان شمارش روی
 * DOM موقت انجام و بازه‌ها با span دور متن پیچیده می‌شود — از آخر به اول، تا
 * splitهای گرهِ متن offsetهای بازه‌های بعدی را به‌هم نریزد. خودِ متن هیچ
 * نویسه‌ای اضافه/کم نمی‌شود، پس انتخابِ بعدیِ کاربر همان offsetها را می‌دهد.
 * بازه‌ها هم مثل رندر متن ساده تا مرز واژه بیرون کشیده می‌شوند (`snapToWordEdges`)،
 * وگرنه برشِ وسط واژه اتصال حروف فارسی را می‌شکند.
 */
function markHtml(html, highlights = [], notes = []) {
  if (!html || (!highlights.length && !notes.length)) return html;
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
  let text = '';
  let node;
  while ((node = walker.nextNode())) text += node.textContent;
  if (!text.length) return html;

  /* بازه‌ها مثل رندر متن ساده تا مرز واژه بیرون کشیده می‌شوند؛ هایلایت‌های ذخیره‌شدهٔ
     قدیمی هم ممکن است وسط واژه باشند و برشِ وسط واژه، اتصال حروف فارسی را می‌شکند. */
  const ranges = [
    ...highlights.map((h) => {
      const [start, end] = snapToWordEdges(text, h.start, h.end);
      return { start, end, cls: `rdr__hl rdr__hl--${h.color}` };
    }),
    ...notes.map((n) => {
      const [start, end] = snapToWordEdges(text, n.start, n.end);
      return { start, end, cls: 'rdr__note-anchor', noteId: n.id };
    }),
  ]
    .filter((range) => range.end > range.start)
    .sort((a, b) => b.start - a.start || b.end - a.end);

  for (const range of ranges) {
    /* نقشهٔ گره‌ها بعد از هر برش از نو ساخته می‌شود: `splitText` گره‌ها را عوض می‌کند و
       نقشهٔ کهنه بازه‌های هم‌پوشان (هایلایت + یادداشت روی یک متن) را ناقص می‌پیچید.
       طول کل متن با نشانه‌گذاری عوض نمی‌شود، پس offsetهای کانونی معتبر می‌مانند. */
    const fresh = [];
    const scan = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
    let cursor = 0;
    let current = scan.nextNode();
    while (current) {
      fresh.push({ node: current, start: cursor });
      cursor += current.textContent.length;
      current = scan.nextNode();
    }
    for (const { node: textNode, start } of fresh) {
      const end = start + textNode.textContent.length;
      if (end <= range.start || start >= range.end) continue;
      let target = textNode;
      const to = range.end - start;
      if (to < target.textContent.length) target.splitText(to);
      const from = range.start - start;
      if (from > 0) target = target.splitText(from);
      const mark = document.createElement('span');
      mark.className = range.cls;
      if (range.noteId) mark.dataset.noteId = range.noteId;
      target.replaceWith(mark);
      mark.appendChild(target);
    }
  }
  return holder.innerHTML;
}

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

/* HTML متن مبحث در سرور هنگام ذخیره پاک‌سازی شده است. هایلایت/نوت داخل همین
   HTML با markHtml نشان داده می‌شود — روی متنِ ساده هم همان `RichText` است. */
export function HtmlBlock({ block }) {
  const [blockHighlights, blockNotes] = useBlockMarks(block.id);
  const html = useMemo(
    () => markHtml(block.html, blockHighlights, blockNotes),
    [block.html, blockHighlights, blockNotes],
  );
  return <div className="rdr-html" data-block-id={block.id} dangerouslySetInnerHTML={{ __html: html }} />;
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
