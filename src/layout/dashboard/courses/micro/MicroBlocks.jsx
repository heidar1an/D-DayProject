/*
 * رندر blockهای میکرودرسنامه — از متن ساده تا مقایسه، جدول، فلش‌کارت و خودآزمایی.
 *
 * قواعد نمایش:
 *   • block با depth: 'extended' فقط در «مطالعهٔ عمیق» دیده می‌شود؛ در «درس سریع» جمع می‌شود.
 *   • متن‌های آموزشی هایلایت‌پذیرند: انتخاب متن، نوار رنگی شناور باز می‌کند و
 *     هایلایت‌ها (per page) در رندر متن اعمال می‌شوند. حذف با کلیک روی خود mark.
 *   • فلش‌کارت و quickQuestion تعامل «بازیابی فعال» را داخل همان صفحه می‌آورند.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import MicroFigure from './microDiagrams';
import { sanitizeHtml } from '../../../../services/admin/sanitizeHtml';
import { hasRichContent, interactiveBlocksOf } from '../../../../data/micro/blocksToHtml';

export const HIGHLIGHT_COLORS = {
  important: { label: 'مهم', css: 'var(--gold)' },
  review: { label: 'برای مرور', css: 'var(--red)' },
  question: { label: 'سؤال دارم', css: 'var(--purple-bright)' },
  personal: { label: 'نکتهٔ من', css: 'var(--green-bright)' },
};

/* متن با هایلایت‌های ذخیره‌شدهٔ کاربر؛ کلیک روی mark آن را حذف می‌کند */
export function HighlightedText({ text, highlights = [], onRemoveHighlight }) {
  const marks = [];
  for (const highlight of highlights) {
    if (!highlight.text) continue;
    let index = text.indexOf(highlight.text);
    let found = 0;
    while (index !== -1 && found < 4) {
      marks.push({ start: index, end: index + highlight.text.length, id: highlight.id, color: highlight.color });
      index = text.indexOf(highlight.text, index + highlight.text.length);
      found += 1;
    }
  }
  if (!marks.length) return text;

  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start < cursor) continue;
    accepted.push(mark);
    cursor = mark.end;
  }

  const parts = [];
  let position = 0;
  for (const mark of accepted) {
    if (position < mark.start) parts.push(text.slice(position, mark.start));
    parts.push(
      <mark
        key={`${mark.id}-${mark.start}`}
        className="micr-mark"
        style={{ '--mark': HIGHLIGHT_COLORS[mark.color]?.css ?? 'var(--gold)' }}
        title="حذف هایلایت"
        onClick={() => onRemoveHighlight?.(mark.id)}
      >
        {text.slice(mark.start, mark.end)}
      </mark>,
    );
    position = mark.end;
  }
  if (position < text.length) parts.push(text.slice(position));
  return parts;
}

/* فلش‌کارت درون صفحه — کلیک = برگشت کارت */
function Flashcards({ cards }) {
  const [flipped, setFlipped] = useState({});
  return (
    <div className="micr-flashcards">
      {cards.map((card, index) => {
        const key = `${index}-${card.front}`;
        const isFlipped = Boolean(flipped[key]);
        return (
          <button
            key={key}
            type="button"
            className={`micr-flashcard${isFlipped ? ' is-flipped' : ''}`}
            onClick={() => setFlipped((previous) => ({ ...previous, [key]: !previous[key] }))}
            aria-pressed={isFlipped}
          >
            <span className="micr-flashcard__face">{card.front}</span>
            <span className="micr-flashcard__back">{card.back}</span>
          </button>
        );
      })}
    </div>
  );
}

/* سؤال کوتاه خودآزمایی — اول فکر کن، بعد پاسخ را باز کن */
function QuickQuestion({ question, answer }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="micr-quickq">
      <p className="micr-quickq__q">{question}</p>
      <button type="button" className="micr-quickq__reveal" onClick={() => setRevealed(true)} disabled={revealed}>
        {revealed ? 'پاسخ را دیدی — حالا مقایسه کن' : 'اول خودت جواب بده، بعد باز کن'}
      </button>
      {revealed && <p className="micr-quickq__a">{answer}</p>}
    </div>
  );
}

function ComparisonBlock({ block, highlightProps }) {
  return (
    <div className="micr-compare">
      {block.title && <p className="micr-block__label">{block.title}</p>}
      <div className="micr-compare__grid">
        {[block.left, block.right].map((side, index) => (
          <div className="micr-compare__side" key={side.label} style={{ '--side': index }}>
            <h4>{side.label}</h4>
            <ul>
              {side.items.map((item) => (
                <li key={item}>
                  <HighlightedText text={item} {...highlightProps} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── نوار شناورِ ساخت هایلایت روی متن انتخاب‌شده ── */
function useSelectionToolbar({ containerRef, onAddHighlight }) {
  const [toolbar, setToolbar] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const handleMouseUp = (event) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!selection || selection.isCollapsed || text.length < 3 || text.length > 220) {
        setToolbar(null);
        return;
      }
      const anchor = selection.anchorNode;
      if (!anchor || !container.contains(anchor.nodeType === 1 ? anchor : anchor.parentElement)) {
        setToolbar(null);
        return;
      }
      const bounds = container.getBoundingClientRect();
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setToolbar({
        text,
        top: rect.top - bounds.top - 46,
        left: Math.max(12, rect.left - bounds.left + rect.width / 2 - 118),
      });
      event.preventDefault();
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [containerRef]);

  const reset = () => {
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  };

  return { toolbar, reset };
}

function SelectionToolbar({ toolbar, onPick }) {
  if (!toolbar) return null;
  return (
    <div className="micr-hlbar" style={{ top: toolbar.top, left: toolbar.left }} role="toolbar" aria-label="ساخت هایلایت">
      {Object.entries(HIGHLIGHT_COLORS).map(([color, meta]) => (
        <button
          key={color}
          type="button"
          style={{ '--hl': meta.css }}
          title={meta.label}
          aria-label={`هایلایت: ${meta.label}`}
          onClick={() => onPick(color)}
        >
          {meta.label}
        </button>
      ))}
    </div>
  );
}

/* متن آموزشی — در «درس سریع» متن‌های بلند فشرده می‌شوند و با یک کلیک باز می‌شوند */
const QUICK_CLAMP_LENGTH = 240;

function TextBlock({ text, highlightProps, clamped }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > QUICK_CLAMP_LENGTH;
  const showClamp = clamped && isLong && !expanded;

  return (
    <>
      <p className={`micr-text${showClamp ? ' is-clamped' : ''}`} data-highlightable="true">
        <HighlightedText text={text} {...highlightProps} />
      </p>
      {clamped && isLong && (
        <button type="button" className="micr-text__toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'جمع‌کردن متن' : 'نمایش کامل متن'}
        </button>
      )}
    </>
  );
}

/* ── رندر اصلی blockها ──
   deepMode = «مطالعهٔ عمیق»: همهٔ blockها دیده می‌شوند.
   quickMode = «درس سریع»: متن‌ها فشرده، بخش‌های تکمیلی (بالینی، ارتباط با درس‌های
   دیگر، متن‌های extended) پنهان — محتوای اصلی دست‌نخورده می‌ماند. */
export default function MicroBlocks({
  page,
  deepMode,
  highlights = [],
  onAddHighlight,
  onRemoveHighlight,
}) {
  const containerRef = useRef(null);
  const { toolbar, reset } = useSelectionToolbar({ containerRef, onAddHighlight });

  const highlightProps = {
    highlights,
    onRemoveHighlight,
  };

  /*
   * دو مدل محتوا، یک رندر:
   *   • صفحهٔ مهاجرت‌کرده → `page.content` (متن غنی از ویرایشگر پنل) منبع نمایش است
   *     و بلوک‌ها فقط برای چیزهایی می‌مانند که در HTML خالص قابل بیان نیستند
   *     (دیاگرام، فلش‌کارت، خودآزمایی) — پس هیچ محتوایی گم نمی‌شود.
   *   • صفحهٔ بلوکی قدیمی → همان مسیر قبلی، بدون تغییر.
   */
  const richContent = hasRichContent(page);
  const richHtml = useMemo(
    () => (richContent ? sanitizeHtml(page.content) : ''),
    [richContent, page.content],
  );
  const sourceBlocks = richContent ? interactiveBlocksOf(page) : page.blocks;

  /* blockهای فقط-عمیق: extended، clinical و crossCourse در درس سریع جمع می‌شوند */
  const quickHidden = new Set(['clinical', 'crossCourse']);
  const visibleBlocks = sourceBlocks.filter((block) => {
    if (deepMode) return true;
    if (block.depth === 'extended') return false;
    if (quickHidden.has(block.type)) return false;
    return true;
  });

  const renderBlock = (block, index) => {
    const key = `${block.type}-${index}`;
    switch (block.type) {
      case 'heading':
        return <h3 key={key} className="micr-h">{block.text}</h3>;
      case 'intro':
        return (
          <p key={key} className="micr-intro">
            <HighlightedText text={block.text} {...highlightProps} />
          </p>
        );
      case 'text':
        return (
          <TextBlock
            key={key}
            text={block.text}
            highlightProps={highlightProps}
            clamped={!deepMode}
          />
        );
      case 'keyPoint':
        return (
          <aside key={key} className="micr-callout micr-callout--key">
            <span className="micr-callout__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 5.9L20 10l-5.6 2.1L12 18l-2.4-5.9L4 10l5.6-2.1z" /></svg>
            </span>
            <div>
              <strong>نکتهٔ کلیدی</strong>
              <p><HighlightedText text={block.text} {...highlightProps} /></p>
            </div>
          </aside>
        );
      case 'definition':
        return (
          <aside key={key} className="micr-callout micr-callout--def">
            <div className="micr-callout__head">
              <strong>{block.term}</strong>
              {block.english && <small>{block.english}</small>}
            </div>
            <p><HighlightedText text={block.text} {...highlightProps} /></p>
          </aside>
        );
      case 'example':
        return (
          <aside key={key} className="micr-callout micr-callout--example">
            <strong>{block.title}</strong>
            <p><HighlightedText text={block.text} {...highlightProps} /></p>
          </aside>
        );
      case 'warning':
        return (
          <aside key={key} className="micr-callout micr-callout--warn">
            <span className="micr-callout__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
            </span>
            <div>
              <strong>هشدار / اشتباه رایج</strong>
              <p><HighlightedText text={block.text} {...highlightProps} /></p>
            </div>
          </aside>
        );
      case 'clinical':
        return (
          <aside key={key} className="micr-callout micr-callout--clinical">
            <span className="micr-callout__tag">ارتباط بالینی</span>
            <strong>{block.title}</strong>
            <p><HighlightedText text={block.text} {...highlightProps} /></p>
          </aside>
        );
      case 'crossCourse':
        return (
          <aside key={key} className="micr-callout micr-callout--cross">
            <strong>{block.title}</strong>
            <ul>
              {block.items.map((item) => (
                <li key={item.courseTitle + item.topic}>
                  <b>{item.courseTitle}</b>
                  <span>{item.topic}</span>
                </li>
              ))}
            </ul>
          </aside>
        );
      case 'comparison':
        return <ComparisonBlock key={key} block={block} highlightProps={highlightProps} />;
      case 'table':
        return (
          <div key={key} className="micr-table">
            {block.title && <p className="micr-block__label">{block.title}</p>}
            <div className="micr-table__scroll">
              <table>
                <thead>
                  <tr>{block.head.map((cell) => <th key={cell}>{cell}</th>)}</tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.join('|')}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`}>
                          <HighlightedText text={cell} {...highlightProps} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'figure':
        return (
          <MicroFigure
            key={key}
            diagram={block.diagram}
            title={block.title}
            caption={block.caption}
            /* دیاگرام‌های عمومی (flow/bars/cycle) شکلشان را از خودِ block می‌گیرند */
            data={block.data}
          />
        );
      case 'flashcards':
        return (
          <div key={key}>
            {block.title && <p className="micr-block__label">{block.title}</p>}
            <Flashcards cards={block.cards} />
          </div>
        );
      case 'quickQuestion':
        return <QuickQuestion key={key} question={block.question} answer={block.answer} />;
      case 'summary':
        return (
          <aside key={key} className="micr-summary">
            <strong>جمع‌بندی صفحه</strong>
            <ul>
              {block.items.map((item) => (
                <li key={item}>
                  <span aria-hidden="true">•</span>
                  <HighlightedText text={item} {...highlightProps} />
                </li>
              ))}
            </ul>
          </aside>
        );
      default:
        return null;
    }
  };

  return (
    <div className="micr-blocks" ref={containerRef}>
      {richContent ? (
        <div
          className="micr-rich"
          /* محتوا در سرور پاک‌سازی می‌شود (`database/sanitizeHtml.js`) و اینجا دوباره
             پیش از رندر؛ پس حتی اگر رکورد دستی دست‌کاری شده باشد چیزی اجرا نمی‌شود. */
          dangerouslySetInnerHTML={{ __html: richHtml }}
        />
      ) : null}
      {visibleBlocks.map(renderBlock)}
      <SelectionToolbar
        toolbar={toolbar}
        onPick={(color) => {
          onAddHighlight?.({ id: `hl-${Date.now().toString(36)}`, text: toolbar.text, color, at: Date.now() });
          reset();
        }}
      />
    </div>
  );
}
