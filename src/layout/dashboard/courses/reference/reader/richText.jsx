/* ── موتور متن غنی Reader ──
   متن هر بلوک یک رشته ساده است؛ این ماژول روی همان رشته:
   ۱) بازه‌های هایلایت/نوت/نتیجه جست‌وجو را به segmentهای تو در تو تبدیل می‌کند،
   ۲) عبارت‌های لاتین را برای رندر LTR جدا می‌کند.
   چون هیچ کاراکتری به متن اضافه/کم نمی‌شود، محاسبه offset انتخاب متن
   (selectionToBlockRange) روی concatenation متن‌ nodes دقیقاً با داده ذخیره‌شده می‌خواند. */

import { Fragment } from 'react';

const LATIN_RUN = /([A-Za-z][A-Za-z0-9'’\-().]*(?:\s+[A-Za-z][A-Za-z0-9'’\-().]*)*)/;

const clamp = (value, length) => Math.max(0, Math.min(value ?? 0, length));

/* بازه‌های روی هم افتاده را به intervalهای غیر هم‌پوشان با رنگ/نوت/نتیجه جست‌وجو تبدیل می‌کند */
export function buildSegments(text, highlights = [], notes = [], flashTerm = null) {
  const length = text.length;
  const points = new Set([0, length]);
  const push = (start, end) => {
    const s = clamp(start, length);
    const e = clamp(end, length);
    if (e > s) {
      points.add(s);
      points.add(e);
    }
  };

  highlights.forEach((h) => push(h.start, h.end));
  notes.forEach((n) => push(n.start, n.end));

  const hits = [];
  if (flashTerm) {
    const needle = flashTerm.toLowerCase();
    const haystack = text.toLowerCase();
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      hits.push([at, at + needle.length]);
      push(at, at + needle.length);
      at = haystack.indexOf(needle, at + needle.length);
    }
  }

  const sorted = [...points].sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const highlight = highlights.find((h) => h.start <= start && end <= h.end);
    const note = notes.find((n) => n.start <= start && end <= n.end);
    const hit = hits.some(([s, e]) => s <= start && end <= e);
    segments.push({
      key: `${start}-${end}`,
      text: text.slice(start, end),
      color: highlight?.color,
      noteId: note?.id,
      hit,
    });
  }
  return segments;
}

/* عبارت لاتین داخل متن فارسی → span با dir=ltr و فونت سریف */
export function LatinText({ text }) {
  const parts = text.split(LATIN_RUN).filter(Boolean);
  if (parts.length === 1 && !LATIN_RUN.test(parts[0])) return parts[0];
  return parts.map((part, index) =>
    LATIN_RUN.test(part) ? (
      <span key={index} dir="ltr" className="rdr__en">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/* رندر یک رشته با اعمال segmentها */
export function RichText({ text, highlights, notes, flashTerm }) {
  const hasMarks = (highlights?.length ?? 0) + (notes?.length ?? 0) > 0 || flashTerm;
  if (!hasMarks) return <LatinText text={text} />;

  return buildSegments(text, highlights, notes, flashTerm).map((segment) => {
    const className = [
      segment.color ? `rdr__hl rdr__hl--${segment.color}` : '',
      segment.noteId ? 'rdr__note-anchor' : '',
      segment.hit ? 'rdr__hit' : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (!className) return <LatinText key={segment.key} text={segment.text} />;
    return (
      <span key={segment.key} className={className} data-note-id={segment.noteId}>
        <LatinText text={segment.text} />
      </span>
    );
  });
}

/* تبدیل انتخاب متن کاربر به بازه روی متن بلوک — هسته هایلایت/نوت */
export function selectionToBlockRange(contentEl) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);

  const toElement = (node) =>
    (node.nodeType === Node.TEXT_NODE ? node.parentElement : node)?.closest?.('[data-block-id]');
  const startBlock = toElement(range.startContainer);
  const endBlock = toElement(range.endContainer);
  if (!startBlock || !endBlock) return null;
  if (!contentEl.contains(startBlock) || !contentEl.contains(endBlock)) return null;
  if (startBlock !== endBlock) return { crossBlock: true, block: null };

  const offsetIn = (node, offsetInNode) => {
    const walker = document.createTreeWalker(startBlock, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let current = walker.nextNode();
    while (current) {
      if (current === node) return acc + offsetInNode;
      acc += current.textContent.length;
      current = walker.nextNode();
    }
    return null;
  };

  const start = offsetIn(range.startContainer, range.startOffset);
  const end = offsetIn(range.endContainer, range.endOffset);
  if (start == null || end == null || end <= start) return null;
  return { crossBlock: false, block: startBlock, blockId: startBlock.dataset.blockId, start, end };
}
