/*
 * ویرایشگر متن غنی پنل تپش.
 *
 * روی contentEditable بومی مرورگر ساخته شده و از execCommand استفاده می‌کند؛
 * دلیلش روشن است: هیچ وابستگی جدیدی به پروژه اضافه نمی‌شود (قانون ۳ پروژه).
 *
 * چرخهٔ امنیت:
 *   paste → پاک‌سازی فوری در کلاینت → ذخیره در سرور → پاک‌سازی دوباره در سرور
 *   → رندر با HTML پاک‌شده. یعنی حتی اگر کلاینت دور زده شود، دادهٔ ذخیره‌شده سالم نیست.
 *
 * واگرد/ازنو: پشتهٔ واگردِ بومی مرورگر با بازنویسی DOM توسط ری‌اکت (سوییچ مبحث،
 * درج کادر) ناسازگار است و یک قدم عقب می‌توانست کل متن را برگرداند. به همین دلیل
 * ویرایشگر پشتهٔ خودش را دارد (`historyRef`): هر تغییر یک snapshot از innerHTML،
 * تایپ پشت‌سرهم (تا ۸۰۰ms) در یک گام ادغام می‌شود، و Ctrl/Cmd+Z و Shift+Z / Y
 * دستی مدیریت می‌شوند. همگام‌سازی بیرونیِ `value` پشته را از نو می‌سازد تا واگرد
 * هرگز محتوای یک مبحث دیگر را روی این مبحث نیندازد.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { sanitizeHtml } from '../../services/admin/sanitizeHtml';
import MediaPicker from './MediaPicker';
import { Button, Input, Modal, toFa, useToast } from './adminShared';
import { IconImage, IconLink } from './adminIcons';

/* آیکون‌های اختصاصی نوار ابزار ویرایشگر */
const bar = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const Icons = {
  undo: () => <svg {...bar}><path d="M8 8H4v-4" /><path d="M4 8a8 8 0 1 1 3 6.2" /></svg>,
  redo: () => <svg {...bar}><path d="M16 8h4v-4" /><path d="M20 8a8 8 0 1 0-3 6.2" /></svg>,
  ul: () => <svg {...bar}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" fill="currentColor" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" /><circle cx="4.5" cy="18" r="1.2" fill="currentColor" /></svg>,
  ol: () => <svg {...bar}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 5h1v3M3.5 18h2M3.5 15h2v1l-2 2h2" /></svg>,
  quote: () => <svg {...bar}><path d="M7 15c-1.7 0-2.5-1.2-2.5-2.6C4.5 10.4 6 8.5 8.5 7l.7 1.3C7.6 9.2 7 10 7 11h1.6c1 0 1.7.7 1.7 1.8S9.3 15 7 15Z" /><path d="M15.5 15c-1.7 0-2.5-1.2-2.5-2.6 0-2 1.5-3.9 4-5.4l.7 1.3c-1.6.9-2.2 1.7-2.2 2.7h1.6c1 0 1.7.7 1.7 1.8S17.8 15 15.5 15Z" /></svg>,
  code: () => <svg {...bar}><path d="m9 8-4 4 4 4M15 8l4 4-4 4" /></svg>,
  table: () => <svg {...bar}><rect x="3.5" y="5" width="17" height="14" rx="1.5" /><path d="M3.5 10h17M9.5 5v14M15 5v14" /></svg>,
  alignRight: () => <svg {...bar}><path d="M4 6h16M8 12h12M4 18h16" /></svg>,
  alignCenter: () => <svg {...bar}><path d="M4 6h16M6.5 12h11M4 18h16" /></svg>,
  alignLeft: () => <svg {...bar}><path d="M4 6h16M4 12h12M4 18h16" /></svg>,
  erase: () => <svg {...bar}><path d="m6 15 6-6 5 5-4.5 4.5H8.5z" /><path d="M13 19h7" /></svg>,
};

const BLOCK_OPTIONS = [
  { value: 'P', label: 'پاراگراف' },
  { value: 'H2', label: 'تیتر ۲' },
  { value: 'H3', label: 'تیتر ۳' },
  { value: 'H4', label: 'تیتر ۴' },
];

/*
 * دکمهٔ نوار ابزار — **بیرون از کامپوننت** تعریف شده و باید همین‌جا بماند.
 *
 * اگر داخل `RichTextEditor` تعریف شود، هر رندر یک «نوع کامپوننت» تازه است و ری‌اکت
 * مجبور می‌شود همهٔ دکمه‌های نوار را از نو بسازد. آن نوسان DOM دو اثر بد داشت (هر دو
 * با پروب واقعی مرورگر تأیید شد): فوکوس ویرایشگر می‌رفت، و کلیک دومِ دابل‌کلیک روی متن
 * به دکمهٔ «واگرد» نسبت داده می‌شد ⇒ `undo` اجرا و آخرین تغییر کاربر پاک می‌شد.
 */
function ToolButton({ label, icon: Icon, isActive = false, wide = false, disabled = false, title, onClick }) {
  return (
    <button
      type="button"
      className={`ad-rte__btn${wide ? ' ad-rte__btn--text' : ''}${isActive ? ' is-active' : ''}`}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={isActive}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {Icon ? <Icon /> : <span className="ad-rte__letter">{label}</span>}
    </button>
  );
}

/*
 * متنِ راهنما را داخل ویرایشگر پیدا و انتخاب می‌کند تا کاربر با تایپ جایگزینش کند.
 * بدون این، متن راهنمای کادر («متن نکته را اینجا بنویسید…») می‌توانست اشتباهی منتشر شود.
 */
function selectTextIn(root, needle) {
  if (!root || !needle) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const at = node.textContent.indexOf(needle);
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + needle.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  return false;
}

/*
 * پوسته‌های بلوکیِ متن — همان کادرها و جدول‌هایی که از قبل داخل محتوا هستند.
 *
 * چرا لازم است: وقتی کاربر کل محتوای یک کادر را انتخاب و حذف می‌کند، مرورگر خودِ
 * `div` را نگه می‌دارد و فقط داخلش را خالی می‌کند. نتیجه یک «قاب خالی» است که نه
 * متنی دارد که کلیک شود و نه راهی برای انتخاب‌شدن — یعنی کادر حذف‌نشدنی می‌ماند.
 * پس حذفِ بلوکی را خودمان انجام می‌دهیم (پایین‌تر، `handleKeyDown`).
 *
 * کلاس‌های `ap-*` همان کادرها، جدول‌ها و تصویرهای مقاله‌اند؛ چون فقط داخل متنِ
 * مقالات پیدا می‌شوند، این گارد در بقیهٔ ویرایشگرهای پنل بی‌اثر می‌ماند (opt-in).
 */
const WRAPPER_SELECTOR = '.micr-callout, .micr-summary, .micr-table, .ap-callout, .ap-table-wrap, .ap-figure';

/* نزدیک‌ترین پوستهٔ بلوکیِ نگه‌دارندهٔ یک گره، محدود به خود ویرایشگر */
function wrapperOf(node, editor) {
  let current = node?.nodeType === 1 ? node : node?.parentElement;
  while (current && current !== editor) {
    if (current.matches?.(WRAPPER_SELECTOR)) return current;
    current = current.parentElement;
  }
  return null;
}

/* ── فهرست (ul/ol) — پیاده‌سازی DOMی، چون execCommandِ فهرست در برخی چیدمان‌ها
      بی‌صدا هیچ نمی‌کند. همین منطق «روشن/خاموش» استاندارد ویرایشگرهاست. ── */

const BLOCK_TAGS = 'p,h2,h3,h4,div,li,blockquote,pre';
const BLOCK_SET = new Set(['P', 'H2', 'H3', 'H4', 'DIV', 'LI', 'BLOCKQUOTE', 'PRE']);

/* درونی‌ترین بلوکِ پیرامون یک گره، محدود به ویرایشگر */
function leafBlockOf(node, editor) {
  let current = node?.nodeType === 1 ? node : node?.parentElement;
  let block = null;
  while (current && current !== editor) {
    if (BLOCK_SET.has(current.tagName)) block = current;
    current = current.parentElement;
  }
  return block;
}

function hasBlockChild(element) {
  return Boolean(element.querySelector?.('p,div,ul,ol,table,blockquote,pre,h2,h3,h4'));
}

function nearestListAncestor(node, editor) {
  let current = node?.nodeType === 1 ? node : node?.parentElement;
  while (current && current !== editor) {
    if (current.tagName === 'UL' || current.tagName === 'OL') return current;
    current = current.parentElement;
  }
  return null;
}

/* یک li را از فهرست بیرون می‌کشد: محتوایش می‌شود <p>، دنبالهٔ فهرست در فهرستِ تازه‌ای
   بعد از همان p می‌نشیند تا ترتیب آیتم‌ها به‌هم نخورد. */
function unwrapListItem(item) {
  const list = item.parentElement;
  if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) return;
  const paragraph = document.createElement('p');
  while (item.firstChild) paragraph.appendChild(item.firstChild);
  const rest = document.createElement(list.tagName);
  while (item.nextSibling) rest.appendChild(item.nextSibling);
  item.remove();
  list.after(paragraph);
  if (rest.childNodes.length) paragraph.after(rest);
  if (!list.querySelector('li')) list.remove();
}

/* کل فهرست را به نوع دیگر تبدیل می‌کند (تبدیل ol↔ul) */
function convertList(list, tag) {
  if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL') || list.tagName === tag) return;
  const fresh = document.createElement(tag);
  while (list.firstChild) fresh.appendChild(list.firstChild);
  list.replaceWith(fresh);
}

function placeCaretEnd(element) {
  const selection = window.getSelection();
  if (!element || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/* ── مرزهای واژه ──
   شکستن یک گرهِ متن در وسط واژه، اتصال حروف فارسی را می‌شکند: هر `span` یک قطعهٔ
   شکل‌گیری جداست، پس «سلام» اگر وسطش بریده شود دو تکهٔ جدا دیده می‌شود. بنابراین
   هر بازه‌ای که رنگ می‌گیرد یا رنگش برداشته می‌شود، اول تا مرزهای واژه بیرون کشیده
   می‌شود. نیم‌فاصله (`\u200c`) بخشی از واژه است و مرز واژه نیست. */
const WORD_SEPARATORS = new Set(Array.from(' \t\n.,;:!?؟،؛«»"\'`()[]{}<>/\\|…—–-ـ*_+=#@&^%~$'));
const isWordChar = (char) => Boolean(char) && !WORD_SEPARATORS.has(char) && !/\s/.test(char);

/* متنِ یک بلوک و نقشهٔ گره‌های متنی‌اش — برای رفت‌وبرگشت بین offset و (گره، offset) */
function textMapOf(block) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = '';
  let node;
  while ((node = walker.nextNode())) {
    nodes.push({ node, start: text.length });
    text += node.textContent;
  }
  return { text, nodes };
}

function pointAtOffset(map, offset) {
  for (const item of map.nodes) {
    const end = item.start + item.node.textContent.length;
    if (offset <= end) return { node: item.node, offset: Math.max(0, offset - item.start) };
  }
  const last = map.nodes[map.nodes.length - 1];
  return last ? { node: last.node, offset: last.node.textContent.length } : null;
}

/* درونی‌ترین بلوکِ پیرامون یک گره (نزدیک‌ترین بلوک به متن، نه دورترین) */
function innerBlockOf(node, editor) {
  let current = node?.nodeType === 1 ? node : node?.parentElement;
  while (current && current !== editor) {
    if (BLOCK_SET.has(current.tagName)) return current;
    current = current.parentElement;
  }
  return null;
}

/* بازه را تا مرزهای واژه بیرون می‌کشد — فقط اگر مرزی وسط واژه افتاده باشد.
   دامنهٔ کار، درونی‌ترین بلوکِ مشترک است: اگر گزینش چندبلوکی باشد یا بلوکی در کار
   نباشد، دست‌نخورده می‌ماند؛ وگرنه بیرون‌کشیدن مرز، بازه را چندبلوکی می‌کرد و رنگ روی
   محتوای بلوکی (مثل `<p>`) می‌نشست. */
function expandToWordEdges(range, editor) {
  const startBlock = innerBlockOf(range.startContainer, editor) || editor;
  const endBlock = innerBlockOf(range.endContainer, editor) || editor;
  if (startBlock !== endBlock) return range;

  const map = textMapOf(startBlock);
  if (!map.text) return range;

  const offsetOf = (node, offset) => {
    try {
      const probe = document.createRange();
      probe.selectNodeContents(startBlock);
      probe.setEnd(node, offset);
      return probe.toString().length;
    } catch {
      return null;
    }
  };

  const start = offsetOf(range.startContainer, range.startOffset);
  const end = offsetOf(range.endContainer, range.endOffset);
  if (start == null || end == null) return range;

  let from = start;
  let to = end;
  while (from > 0 && isWordChar(map.text[from - 1]) && isWordChar(map.text[from])) from -= 1;
  while (to < map.text.length && isWordChar(map.text[to - 1]) && isWordChar(map.text[to])) to += 1;
  if (from === start && to === end) return range;

  const head = pointAtOffset(map, from);
  const tail = pointAtOffset(map, to);
  if (!head || !tail) return range;
  try {
    range.setStart(head.node, head.offset);
    range.setEnd(tail.node, tail.offset);
  } catch {
    return range;
  }
  return range;
}

/* ── جدول — موتور کوچک گرید. هر عملیات، جدول را به ماتریس ارجاعِ سلول تبدیل
      می‌کند، ماتریس را عوض می‌کند و دوباره می‌نویسد؛ rowSpan/colSpan از هندسهٔ
      ماتریس ساخته می‌شود، پس ادغام/حذف/درج هرگز سلول‌ها را قفل نمی‌کند. ── */

function tableGrid(table) {
  const grid = [];
  Array.from(table.rows).forEach((row, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(row.cells).forEach((cell) => {
      while (grid[r][c]) c += 1;
      const rs = Math.max(1, cell.rowSpan || 1);
      const cs = Math.max(1, cell.colSpan || 1);
      for (let dr = 0; dr < rs; dr += 1) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < cs; dc += 1) grid[r + dr][c + dc] = cell;
      }
      c += cs;
    });
  });
  const width = Math.max(1, ...grid.map((line) => line.length));
  for (let r = 0; r < grid.length; r += 1) {
    grid[r] = Array.from({ length: width }, (_, c) => grid[r][c] || null);
  }
  return grid;
}

/* ماتریس را روی DOM جدول می‌نویسد: spanها از هندسه، سلول‌های بی‌خانه حذف،
   ردیف‌های خالی برداشته و ردیف‌های تازه سر جای خودشان ساخته می‌شوند. */
function writeGrid(table, model) {
  const info = new Map();
  model.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && !info.has(cell)) info.set(cell, { r0: r, c0: c, rs: 1, cs: 1 });
  }));
  info.forEach((box, cell) => {
    while ((model[box.r0 + box.rs] || [])[box.c0] === cell) box.rs += 1;
    while ((model[box.r0] || [])[box.c0 + box.cs] === cell) box.cs += 1;
  });

  const homes = model.map((row, r) => {
    const list = [];
    row.forEach((cell) => {
      if (cell && info.get(cell).r0 === r && !list.includes(cell)) list.push(cell);
    });
    return list;
  });

  const claimed = new Set();
  Array.from(table.rows).forEach((tr) => {
    const own = Array.from(tr.cells).filter((cell) => info.has(cell));
    if (!own.length) {
      Array.from(tr.cells).forEach((cell) => cell.remove());
      tr.remove();
      return;
    }
    let best = -1;
    let bestScore = 0;
    homes.forEach((list, r) => {
      const score = own.reduce((sum, cell) => sum + (list.includes(cell) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = r; }
    });
    if (best < 0) {
      own.forEach((cell) => cell.remove());
      tr.remove();
      return;
    }
    claimed.add(best);
    const list = homes[best];
    /* هر سلولی که خانه‌اش این ردیف نیست (یتیِ حذف‌شده یا سلولِ ردیف دیگر) بیرون می‌رود */
    Array.from(tr.cells).forEach((cell) => { if (!list.includes(cell)) cell.remove(); });
    list.forEach((cell) => {
      const box = info.get(cell);
      cell.rowSpan = box.rs;
      cell.colSpan = box.cs;
      tr.appendChild(cell);
    });
  });

  homes.forEach((list, r) => {
    if (claimed.has(r) || !list.length) return;
    const tr = document.createElement('tr');
    const existing = table.rows[r] || null;
    if (existing) existing.parentNode.insertBefore(tr, existing);
    else if (table.rows.length) table.rows[table.rows.length - 1].after(tr);
    else table.appendChild(tr);
    list.forEach((cell) => {
      const box = info.get(cell);
      cell.rowSpan = box.rs;
      cell.colSpan = box.cs;
      tr.appendChild(cell);
    });
  });

  /* ردیف‌هایی که با جابه‌جایی سلول‌ها خالی مانده‌اند حذف می‌شوند */
  Array.from(table.rows).forEach((tr) => { if (!tr.cells.length) tr.remove(); });
}

/* اجرای یک عملیات جدول؛ سلولی که باید نشانگر در آن بنشیند را برمی‌گرداند. */
function applyTableOp(table, kind, range) {
  const model = tableGrid(table);
  const anchorNode = range.startContainer?.nodeType === 1 ? range.startContainer : range.startContainer?.parentElement;
  const anchorCell = anchorNode?.closest?.('td,th');
  if (!anchorCell || !table.contains(anchorCell)) return null;

  const infoOf = (cell) => {
    let r0 = -1;
    let c0 = -1;
    for (let r = 0; r < model.length && r0 < 0; r += 1) {
      const c = model[r].indexOf(cell);
      if (c >= 0) { r0 = r; c0 = c; }
    }
    if (r0 < 0) return null;
    let rs = 1;
    while ((model[r0 + rs] || [])[c0] === cell) rs += 1;
    let cs = 1;
    while ((model[r0] || [])[c0 + cs] === cell) cs += 1;
    return { r0, c0, rs, cs };
  };
  const freshCell = (ref) => document.createElement(ref?.tagName === 'TH' ? 'th' : 'td');

  if (kind === 'merge' || kind === 'unmerge') {
    if (kind === 'merge') {
      const picked = [];
      model.forEach((row) => row.forEach((cell) => {
        if (cell && range.intersectsNode(cell) && !picked.includes(cell)) picked.push(cell);
      }));
      if (picked.length < 2) return null;
      let r0 = Infinity;
      let r1 = -1;
      let c0 = Infinity;
      let c1 = -1;
      picked.forEach((cell) => {
        const box = infoOf(cell);
        r0 = Math.min(r0, box.r0);
        c0 = Math.min(c0, box.c0);
        r1 = Math.max(r1, box.r0 + box.rs - 1);
        c1 = Math.max(c1, box.c0 + box.cs - 1);
      });
      /* کل مستطیل باید از سلول‌هایی پر شود که تمامشان داخل همان مستطیل‌اند */
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          const cell = (model[r] || [])[c];
          const box = cell && infoOf(cell);
          if (!box || box.r0 < r0 || box.c0 < c0 || box.r0 + box.rs - 1 > r1 || box.c0 + box.cs - 1 > c1) return null;
        }
      }
      const target = model[r0][c0];
      picked.forEach((cell) => {
        if (cell === target) return;
        if (target.childNodes.length && cell.childNodes.length) target.appendChild(document.createTextNode(' '));
        while (cell.firstChild) target.appendChild(cell.firstChild);
      });
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) model[r][c] = target;
      }
      writeGrid(table, model);
      return target;
    }

    const box = infoOf(anchorCell);
    if (box.rs < 2 && box.cs < 2) return null;
    for (let r = box.r0; r < box.r0 + box.rs; r += 1) {
      for (let c = box.c0; c < box.c0 + box.cs; c += 1) {
        model[r][c] = (r === box.r0 && c === box.c0) ? anchorCell : freshCell(anchorCell);
      }
    }
    writeGrid(table, model);
    return anchorCell;
  }

  const box = infoOf(anchorCell);

  if (kind === 'row-above' || kind === 'row-below') {
    const at = kind === 'row-above' ? box.r0 : box.r0 + box.rs;
    const width = Math.max(...model.map((row) => row.length));
    const newRow = [];
    for (let c = 0; c < width; c += 1) {
      const above = (model[at - 1] || [])[c];
      const below = (model[at] || [])[c];
      newRow.push(above && above === below ? above : freshCell(below || above));
    }
    model.splice(at, 0, newRow);
  } else if (kind === 'row-delete') {
    if (model.length <= 1) return null;
    model.splice(box.r0, 1);
  } else if (kind === 'col-before' || kind === 'col-after') {
    const at = kind === 'col-before' ? box.c0 : box.c0 + box.cs;
    for (let r = 0; r < model.length; r += 1) {
      const row = model[r];
      /* سلولی که خودش از مرز عبور می‌کند، خودبه‌خود یک ستون پهن‌تر می‌شود */
      if (row[at - 1] && row[at - 1] === row[at]) continue;
      row.splice(at, 0, freshCell(row[at] || row[at - 1]));
    }
  } else if (kind === 'col-delete') {
    const width = Math.max(...model.map((row) => row.length));
    if (width <= 1) return null;
    model.forEach((row) => { if (row.length > box.c0) row.splice(box.c0, 1); });
  } else {
    return null;
  }

  writeGrid(table, model);
  if (anchorCell.isConnected) return anchorCell;
  const row = model[Math.min(box.r0, model.length - 1)] || [];
  return row.find(Boolean) || null;
}

/*
 * دو ابزار اختیاری که فراخوان می‌تواند روشن کند:
 *   tones   — فهرست رنگ‌های متن `[{ value, label }]`؛ انتخاب کاربر را در
 *             `<span class="micr-tone--value">` می‌پیچد. `value` خالی رنگ را برمی‌دارد.
 *   inserts — دکمه‌های «کادر آماده» `[{ label, hint, html }]` که HTML را در محل نشانگر درج می‌کنند.
 * هر دو عمداً opt-in‌اند تا ویرایشگرهای دیگر پنل رفتارشان عوض نشود.
 *
 * چرا رنگ با کلاس و نه `execCommand('foreColor')`؟ چون پاک‌ساز (`database/sanitizeHtml.js`)
 * هر `style` را دور می‌ریزد و رنگِ درون‌خطی از ذخیره جان سالم نمی‌برد؛ کلاس از فهرست سفید
 * عبور می‌کند و از توکن‌های تم رنگ می‌گیرد، پس در هر دو تم درست می‌ماند.
 */
export default function RichTextEditor({
  value = '', onChange, placeholder = 'متن خود را اینجا بنویسید…', tones = null, inserts = null,
}) {
  const notify = useToast();
  const editorRef = useRef(null);
  const historyRef = useRef({ stack: [String(value ?? '')], index: 0, stamp: 0, source: '' });
  const refreshStateRef = useRef(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [block, setBlock] = useState('P');
  const [active, setActive] = useState({});
  const [tableCtx, setTableCtx] = useState(null);
  /* رنگ جاری = «حالت ماژیک»: هر گزینش تازه‌ای در متن همان رنگ را می‌گیرد
     (و اگر رنگ جاری «حذف رنگ» باشد، هایلایتِ گزینش برداشته می‌شود). `null` = خاموش. */
  const [tone, setTone] = useState(null);

  /* محتوای DOM فقط وقتی از بیرون بازنویسی می‌شود که واقعاً تفاوت داشته باشد؛
     وگرنه نشانگر متن هنگام تایپ می‌پرد. بازنویسی بیرونی یعنی مبحث/محتوا عوض شده —
     پس پشتهٔ واگرد هم از نو ساخته می‌شود. */
  useEffect(() => {
    const element = editorRef.current;
    if (!element) return;
    const next = value ?? '';
    if (element.innerHTML !== next) {
      element.innerHTML = next;
      historyRef.current = { stack: [next], index: 0, stamp: 0, source: 'reset' };
    }
  }, [value]);

  /* تایپ داخل ویرایشگر <p> بسازد نه <div> */
  useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* مرورگر قدیمی */ }
  }, []);

  const wordCount = useMemo(
    () => String(value ?? '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
    [value],
  );

  /* ثبت وضعیت فعلی DOM در پشتهٔ واگرد؛ تایپِ پیوسته در یک گام ادغام می‌شود */
  const record = useCallback((source) => {
    const element = editorRef.current;
    if (!element) return;
    const html = element.innerHTML;
    const history = historyRef.current;
    const now = Date.now();
    if (history.stack[history.index] === html) {
      history.source = source;
      history.stamp = now;
      return;
    }
    if (source === 'input' && history.source === 'input'
      && now - history.stamp < 800 && history.index === history.stack.length - 1) {
      history.stack[history.index] = html;
    } else {
      history.stack = history.stack.slice(0, history.index + 1);
      history.stack.push(html);
      if (history.stack.length > 150) history.stack.splice(0, history.stack.length - 150);
      history.index = history.stack.length - 1;
    }
    history.source = source;
    history.stamp = now;
  }, []);

  const emit = useCallback((source = 'api') => {
    const element = editorRef.current;
    if (!element) return;
    record(source);
    onChange?.(element.innerHTML);
  }, [onChange, record]);

  /* یک گام در پشتهٔ واگرد؛ DOM از snapshot بازسازی و به والد خبر داده می‌شود */
  const travel = useCallback((step) => {
    const element = editorRef.current;
    const history = historyRef.current;
    if (!element) return;
    const next = history.index + step;
    if (next < 0 || next >= history.stack.length) return;

    history.stack[history.index] = element.innerHTML;
    history.index = next;
    history.source = 'api';
    history.stamp = Date.now();
    element.innerHTML = history.stack[next];
    placeCaretEnd(element);
    onChange?.(history.stack[next]);
    refreshStateRef.current?.();
  }, [onChange]);

  const refreshState = useCallback(() => {
    const editor = editorRef.current;
    try {
      const nextBlock = String(document.queryCommandValue('formatBlock') || '').toUpperCase();
      setBlock(BLOCK_OPTIONS.some((option) => option.value === nextBlock) ? nextBlock : 'P');
      const selection = window.getSelection();
      const leaf = selection && selection.rangeCount > 0 && editor
        ? leafBlockOf(selection.getRangeAt(0).startContainer, editor)
        : null;
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        ul: Boolean(leaf?.closest?.('ul')),
        ol: Boolean(leaf?.closest?.('ol')),
      });

      /* نوار جدول فقط وقتی نشانگر داخل یک جدول است دیده می‌شود */
      let context = null;
      if (selection && selection.rangeCount > 0 && editor) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer?.nodeType === 1 ? range.startContainer : range.startContainer?.parentElement;
        const table = node?.closest?.('table');
        if (table && editor.contains(table)) {
          const picked = range.collapsed ? [] : Array.from(table.querySelectorAll('td,th'))
            .filter((cell) => range.intersectsNode(cell));
          const cell = node.closest?.('td,th') || null;
          context = {
            canMerge: picked.length > 1,
            canUnmerge: Boolean(cell) && ((cell.rowSpan || 1) > 1 || (cell.colSpan || 1) > 1),
          };
        }
      }
      setTableCtx(context);
    } catch {
      /* مرورگر از queryCommand پشتیبانی نکرد — وضعیت دکمه‌ها مهمان‌نواز می‌ماند */
    }
  }, []);

  refreshStateRef.current = refreshState;

  const exec = useCallback((command, commandValue = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emit();
    refreshState();
  }, [emit, refreshState]);

  /* درج HTML آماده. `select` متنِ راهنمای کادر است و بعد از درج انتخاب می‌شود تا
     کاربر فقط تایپ کند و جایگزین شود. */
  const insertHtml = useCallback((html, select) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('insertHTML', false, sanitizeHtml(html));
    if (select) selectTextIn(editor, select);
    emit();
  }, [emit]);

  /*
   * فهرست نقطه‌ای/شماره‌دار — روشن/خاموش با دست‌کاری مستقیم DOM.
   * execCommand این دو فرمان را در برخی چیدمان‌ها (متن داخل کادر، خط خالی، انتخاب
   * چندبلوکی) بی‌صدا رها می‌کند؛ اینجا سه مسیر روشن است: خاموش‌کردن (li → p)،
   * تبدیل نوع (ol↔ul) و روشن‌کردن (بلوک‌های برگِ انتخاب → li).
   */
  const toggleList = useCallback((type) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const tag = type === 'ol' ? 'OL' : 'UL';

    try {
      const startList = nearestListAncestor(range.startContainer, editor);

      if (startList) {
        const items = Array.from(editor.querySelectorAll('li'))
          .filter((item) => editor.contains(item) && range.intersectsNode(item));
        if (startList.tagName === tag) {
          items.forEach(unwrapListItem);
        } else {
          const lists = new Set(items.map((item) => item.parentElement).filter(Boolean));
          lists.forEach((list) => convertList(list, tag));
        }
        const last = items[items.length - 1] && items[items.length - 1].isConnected
          ? items[items.length - 1]
          : editor.querySelector('p') || editor;
        placeCaretEnd(last);
        emit();
        refreshState();
        return;
      }

      /* روشن‌کردن */
      const endList = nearestListAncestor(range.endContainer, editor);
      if (endList && endList.tagName !== tag) convertList(endList, tag);

      let blocks;
      if (range.collapsed) {
        const leaf = leafBlockOf(range.startContainer, editor);
        blocks = leaf ? [leaf] : [];
      } else {
        blocks = Array.from(editor.querySelectorAll(BLOCK_TAGS))
          .filter((el) => BLOCK_SET.has(el.tagName) && !hasBlockChild(el)
            && editor.contains(el) && range.intersectsNode(el) && el.tagName !== 'LI');
      }

      if (!blocks.length) {
        /* متن بی‌بلوک یا خط خالی — یک فهرست تازه در خود نقطهٔ نشانگر */
        const list = document.createElement(tag);
        const item = document.createElement('li');
        if (range.collapsed) {
          item.appendChild(document.createElement('br'));
          range.insertNode(list);
        } else {
          item.appendChild(range.extractContents());
          range.insertNode(list);
        }
        list.appendChild(item);
        placeCaretEnd(item);
        emit();
        refreshState();
        return;
      }

      blocks.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      let anchor = null;
      let groupParent = null;
      let list = null;
      blocks.forEach((element) => {
        if (groupParent !== element.parentElement || !list) {
          groupParent = element.parentElement;
          list = document.createElement(tag);
          groupParent.insertBefore(list, element);
        }
        const item = document.createElement('li');
        while (element.firstChild) item.appendChild(element.firstChild);
        if (!item.childNodes.length) item.appendChild(document.createElement('br'));
        list.appendChild(item);
        element.remove();
        anchor = item;
      });

      placeCaretEnd(anchor);
      emit();
      refreshState();
    } catch {
      /* راه دوم: فرمان بومی مرورگر */
      try {
        editor.focus();
        document.execCommand(type === 'ol' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
        emit();
        refreshState();
      } catch {
        notify('فهرست ساخته نشد', 'error');
      }
    }
  }, [emit, notify, refreshState]);

  /* رنگ متن: انتخاب فعلی در یک `span` با کلاس تُن پیچیده می‌شود. تُن‌های قبلیِ داخل انتخاب
     باز می‌شوند و اگر نقطهٔ درج خودش داخل یک پوستهٔ رنگ مانده باشد (مثل حذف رنگِ متنی که
     خودش رنگی است)، انتخاب از همهٔ پوسته‌های پیرامونش بیرون کشیده می‌شود — وگرنه رنگِ
     پوستهٔ بیرونی سر جایش می‌ماند و «حذف رنگ» بی‌اثر می‌شد.

     پیش از هر کار، بازه تا مرزهای واژه بیرون کشیده می‌شود؛ وگرنه برش وسط واژه هم متن را
     دو تکه می‌کند و هم دم/سرِ پوستهٔ رنگیِ پیرامون را دو `span` جدا می‌کند و اتصال حروف
     فارسی می‌شکند. با مرزِ واژه، انتخابِ نیمه‌واژه خودبه‌خود کل واژه را می‌گیرد. */
  const applyTone = useCallback((toneValue) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    /* انتخابِ خالی اینجا خطا نیست: رنگ فقط «جاری» می‌شود تا با گزینش بعدی بنشیند */
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;
    expandToWordEdges(range, editor);

    try {
      const content = range.extractContents();
      content.querySelectorAll('[class*="micr-tone--"]').forEach((node) => node.replaceWith(...node.childNodes));

      /* بیرون‌کشیدن از هر پوستهٔ رنگیِ پیرامون نقطهٔ درج */
      let span = nearestToneAncestor(range.startContainer, editor);
      while (span) {
        /* دم و سرِ پوسته جدا می‌شوند تا متنِ رنگیِ اطراف رنگش را نگه دارد */
        const tailRange = document.createRange();
        tailRange.selectNodeContents(span);
        tailRange.setStart(range.startContainer, range.startOffset);
        const tail = tailRange.extractContents();

        const headRange = document.createRange();
        headRange.selectNodeContents(span);
        headRange.setEnd(range.startContainer, range.startOffset);
        const head = headRange.extractContents();

        if (tail.firstChild) {
          const tailSpan = span.cloneNode(false);
          tailSpan.appendChild(tail);
          span.after(tailSpan);
        }
        if (head.firstChild) {
          const headSpan = span.cloneNode(false);
          headSpan.appendChild(head);
          span.before(headSpan);
        }

        const parent = span.parentNode;
        const index = Array.from(parent.childNodes).indexOf(span);
        span.remove();
        range.setStart(parent, index);
        range.collapse(true);
        span = nearestToneAncestor(range.startContainer, editor);
      }

      if (toneValue) {
        const fresh = document.createElement('span');
        fresh.className = `micr-tone--${toneValue}`;
        fresh.appendChild(content);
        range.insertNode(fresh);
        const next = document.createRange();
        next.selectNodeContents(fresh);
        selection.removeAllRanges();
        selection.addRange(next);
      } else {
        range.insertNode(content);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch {
      notify('رنگ‌کردن این بخش ممکن نشد', 'error');
      return;
    }

    emit();
  }, [emit, notify]);

  /*
   * انتخاب یک رنگ از پالت — «حالت ماژیک».
   *   • متنی گزینش شده باشد ⇒ همان‌جا اعمال می‌شود (با رنگ «حذف رنگ»، رنگِ همان گزینش
   *     برداشته می‌شود).
   *   • چیزی گزینش نباشد ⇒ آن رنگ «جاری» می‌شود و از این پس هر گزینش تازه‌ای در متن
   *     همان رنگ را می‌گیرد (با رنگ «حذف رنگ»، هایلایتِ گزینش برداشته می‌شود).
   *   • کلیک دوباره روی همان رنگِ جاری ⇒ حالت خاموش می‌شود تا گزینش‌های معمولی
   *     ناخواسته رنگ نگیرند.
   *
   * عمداً هرگز به «آخرین گزینشِ ذخیره‌شده» برنمی‌گردیم: اگر لحظهٔ کلیک گزینشِ زنده‌ای
   * در دست نباشد، کاربر چیزی برای رنگ‌کردن ندارد و برگشتن به گزینشِ کهنه فقط رنگِ یک
   * بخشِ قدیمیِ متن را برمی‌داشت (شکایت کاربر: «هایلایتِ قبلی‌ام پاک می‌شود»).
   */
  const pickTone = useCallback((colorValue) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const hasSelection = Boolean(editor && selection && selection.rangeCount > 0
      && !selection.isCollapsed && editor.contains(selection.anchorNode));

    if (!hasSelection) {
      setTone(colorValue === tone ? null : colorValue);
      return;
    }
    setTone(colorValue);
    applyTone(colorValue);
  }, [applyTone, tone]);

  /* هر گزینشی که در متن تمام شود، رنگ جاری را می‌گیرد (حالت ماژیک).
     گزینش چندسلولیِ داخل جدول کنار گذاشته می‌شود؛ آن گزینش برای ادغام سلول است. */
  const applyCurrentTone = useCallback(() => {
    if (tone === null) return;
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const holder = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (holder?.closest?.('table')) return;
    applyTone(tone);
  }, [applyTone, tone]);

  /* بعد از هر گزینش (ماوس یا کلید): اول رنگ جاری، بعد تازه‌سازی وضعیت نوار */
  const handleSelectionSettled = () => {
    applyCurrentTone();
    refreshState();
  };

  /* دابل‌کلیک روی یک واژه (یا جمله): مرورگر خودش واژه را انتخاب می‌کند و ما فقط
     رنگ جاری را روی همان انتخاب می‌نشانیم. */
  const handleDoubleClick = () => {
    if (tone === null) return;
    applyTone(tone);
  };

  /* عملیات جدول از نوار جدول */
  const tableOp = useCallback((kind) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer?.nodeType === 1 ? range.startContainer : range.startContainer?.parentElement;
    const table = node?.closest?.('table');
    if (!table || !editor.contains(table)) return;

    try {
      const focusCell = applyTableOp(table, kind, range);
      if (!focusCell) {
        notify(kind === 'merge' ? 'برای ادغام، دست‌کم دو سلول هم‌مستطیل را انتخاب کنید' : 'این کار روی جدول ممکن نشد', 'error');
        return;
      }
      placeCaretEnd(focusCell);
      emit();
      refreshState();
    } catch {
      notify('این کار روی جدول ممکن نشد', 'error');
    }
  }, [emit, notify, refreshState]);

  /*
   * حذف کادر به‌جای خالی‌کردنش.
   *
   * مرورگر وقتی محتوای یک `div` بلوکی حذف شود، خودِ `div` را نگه می‌دارد؛ آن قاب
   * خالی بعداً نه قابل کلیک است و نه قابل انتخاب، پس کاربر عملاً «نمی‌تواند کادر را
   * حذف کند». اینجا در دو حالت خودمان پوسته را برمی‌داریم:
   *
   *   ۱) کاربر کل محتوای کادر را انتخاب کرده و Backspace/Delete زده است.
   *   ۲) کادر همین حالا خالی است و نشانگر داخل آن نشسته است.
   *
   * حالت «کاراکتر‌به‌کاراکتر خالی می‌کنم تا دوباره بنویسم» عمداً دست‌نخورده می‌ماند؛
   * کادر فقط وقتی می‌رود که کاربر حذفِ کل بلوک را خواسته باشد.
   */
  const handleKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        travel(event.shiftKey ? 1 : -1);
        return;
      }
      if (key === 'y') {
        event.preventDefault();
        travel(1);
        return;
      }
    }

    if (event.key !== 'Backspace' && event.key !== 'Delete') return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const wrapper = wrapperOf(range.commonAncestorContainer, editor);
    if (!wrapper || !editor.contains(wrapper)) return;

    const boxText = wrapper.textContent.trim();
    const wholeBoxSelected = !range.collapsed && boxText === range.toString().trim();
    const emptyAndFocused = !boxText && wrapper.contains(range.commonAncestorContainer);
    if (!wholeBoxSelected && !emptyAndFocused) return;

    event.preventDefault();

    /* نشانگر باید جایی بنشیند که کادر بود؛ وگرنه ویرایشگر بی‌نشانگر می‌ماند */
    const parent = wrapper.parentNode;
    const index = Array.from(parent.childNodes).indexOf(wrapper);
    wrapper.remove();

    if (!editor.children.length) {
      const placeholderBlock = document.createElement('p');
      placeholderBlock.appendChild(document.createElement('br'));
      editor.appendChild(placeholderBlock);
    }

    const target = parent.childNodes[Math.min(index, parent.childNodes.length - 1)] || editor.lastElementChild || editor;
    const caret = document.createRange();
    caret.selectNodeContents(target);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);

    emit();
  };

  const handlePaste = (event) => {
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain');

    if (!html && !text) return;
    event.preventDefault();

    /* تصاویر و استایل بیرونی هرگز از کلیپ‌بورد عبور نمی‌کنند */
    insertHtml(html ? sanitizeHtml(html) : `<p>${String(text).replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))}</p>`);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;

    const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : `https://${url}`;
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed;

    if (hasSelection) {
      exec('createLink', safe);
    } else {
      insertHtml(`<a href="${safe}">${safe}</a>`);
    }

    setLinkUrl('');
    setLinkDialogOpen(false);
  };

  const insertTable = () => {
    const rows = Array.from({ length: 3 })
      .map(() => `<tr><td>سلول</td><td>سلول</td><td>سلول</td></tr>`)
      .join('');

    insertHtml(`<table><thead><tr><th>سرستون</th><th>سرستون</th><th>سرستون</th></tr></thead><tbody>${rows}</tbody></table><p></p>`);
  };

  return (
    <div
      className="ad-rte"
      /*
       * کلیک داخل ویرایشگر هرگز نباید به والد برسد.
       * اگر والد یک `<label>` باشد (مثل `Field`)، مرورگر کلیک روی محتوای غیرتعاملی را
       * به «کنترلِ» آن هم می‌فرستد و چون نخستین عنصر labelable داخل ویرایشگر، دکمهٔ
       * «واگرد» است، هر کلیک روی متن یک `undo` هم اجرا می‌کرد و تغییر کاربر پاک می‌شد.
       * این گارد ویرایشگر را از هر والدِ برچسب‌داری مستقل می‌کند.
       */
      onClick={(event) => event.stopPropagation()}
    >
      <div className="ad-rte__bar" role="toolbar" aria-label="ابزارهای ویرایش متن">
        <div className="ad-rte__group">
          <ToolButton label="واگرد" icon={Icons.undo} onClick={() => travel(-1)} />
          <ToolButton label="ازنو" icon={Icons.redo} onClick={() => travel(1)} />
        </div>

        <div className="ad-rte__group">
          <select
            className="ad-rte__select"
            value={block}
            onChange={(event) => { exec('formatBlock', event.target.value); setBlock(event.target.value); }}
            aria-label="سطح متن"
          >
            {BLOCK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="ad-rte__group">
          <ToolButton label="B" isActive={active.bold} onClick={() => exec('bold')} />
          <ToolButton label="I" isActive={active.italic} onClick={() => exec('italic')} />
          <ToolButton label="U" isActive={active.underline} onClick={() => exec('underline')} />
          <ToolButton label="S" isActive={active.strikeThrough} onClick={() => exec('strikeThrough')} />
        </div>

        <div className="ad-rte__group">
          <ToolButton label="فهرست نقطه‌ای" icon={Icons.ul} isActive={active.ul} onClick={() => toggleList('ul')} />
          <ToolButton label="فهرست شماره‌دار" icon={Icons.ol} isActive={active.ol} onClick={() => toggleList('ol')} />
          <ToolButton label="نقل‌قول" icon={Icons.quote} onClick={() => exec('formatBlock', 'BLOCKQUOTE')} />
          <ToolButton label="بلوک کد" icon={Icons.code} onClick={() => exec('formatBlock', 'PRE')} />
        </div>

        <div className="ad-rte__group">
          <ToolButton label="راست‌چین" icon={Icons.alignRight} onClick={() => exec('justifyRight')} />
          <ToolButton label="وسط‌چین" icon={Icons.alignCenter} onClick={() => exec('justifyCenter')} />
          <ToolButton label="چپ‌چین" icon={Icons.alignLeft} onClick={() => exec('justifyLeft')} />
        </div>

        <div className="ad-rte__group">
          <ToolButton label="افزودن لینک" icon={IconLink} onClick={() => setLinkDialogOpen(true)} />
          <ToolButton label="افزودن تصویر" icon={IconImage} onClick={() => setPickerOpen(true)} />
          <ToolButton label="افزودن جدول" icon={Icons.table} onClick={insertTable} />
          <ToolButton label="حذف قالب" icon={Icons.erase} onClick={() => exec('removeFormat')} />
        </div>

        {tones?.length ? (
          <div className="ad-rte__group" role="group" aria-label="رنگ متن">
            {tones.map((item) => (
              <button
                key={item.value || 'none'}
                type="button"
                className={`ad-rte__btn ad-rte__tone${item.value ? '' : ' ad-rte__tone--none'}${item.value === tone ? ' is-active' : ''}`}
                title={`${item.label} — با گزینشِ متن همان‌جا اعمال می‌شود؛ بدون گزینش، رنگِ جاری می‌شود (کلیک دوباره: خاموش)`}
                aria-label={`رنگ متن: ${item.label}`}
                aria-pressed={item.value === tone}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickTone(item.value)}
              >
                <span className={`ad-rte__letter${item.value ? ` micr-tone--${item.value}` : ''}`}>A</span>
              </button>
            ))}
          </div>
        ) : null}

        {inserts?.length ? (
          <div className="ad-rte__group" role="group" aria-label="کادرهای آماده">
            {inserts.map((item) => (
              <button
                key={item.label}
                type="button"
                className="ad-rte__btn ad-rte__btn--text"
                title={item.hint ?? item.label}
                aria-label={item.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertHtml(item.html, item.select)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tableCtx ? (
        <div className="ad-rte__bar ad-rte__tablebar" role="toolbar" aria-label="ابزار جدول">
          <span className="ad-rte__tablebar__title">جدول</span>
          <div className="ad-rte__group">
            <ToolButton label="ردیف بالاتر" wide title="افزودن ردیف بالای سلول جاری" onClick={() => tableOp('row-above')} />
            <ToolButton label="ردیف پایین‌تر" wide title="افزودن ردیف زیر سلول جاری" onClick={() => tableOp('row-below')} />
            <ToolButton label="حذف ردیف" wide title="حذف ردیف سلول جاری" onClick={() => tableOp('row-delete')} />
          </div>
          <div className="ad-rte__group">
            <ToolButton label="ستون پیش" wide title="افزودن ستون پیش از سلول جاری" onClick={() => tableOp('col-before')} />
            <ToolButton label="ستون پس" wide title="افزودن ستون پس از سلول جاری" onClick={() => tableOp('col-after')} />
            <ToolButton label="حذف ستون" wide title="حذف ستون سلول جاری" onClick={() => tableOp('col-delete')} />
          </div>
          <div className="ad-rte__group">
            <ToolButton label="ادغام" wide disabled={!tableCtx.canMerge} title="ادغام سلول‌های انتخاب‌شده (دست‌کم دو سلول را با ماوس انتخاب کنید)" onClick={() => tableOp('merge')} />
            <ToolButton label="جداسازی" wide disabled={!tableCtx.canUnmerge} title="بازکردن سلول ادغام‌شده" onClick={() => tableOp('unmerge')} />
          </div>
        </div>
      ) : null}

      <div
        ref={editorRef}
        className="ad-rte__area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="محتوای متن"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={() => emit('input')}
        onBlur={() => emit('input')}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onKeyUp={handleSelectionSettled}
        onMouseUp={handleSelectionSettled}
        onDoubleClick={handleDoubleClick}
      />

      <div className="ad-rte__foot">
        <span>{toFa(wordCount)} واژه</span>
        <span>محتوای چسبانده‌شده به‌صورت خودکار پاک‌سازی می‌شود</span>
      </div>

      <Modal
        open={linkDialogOpen}
        title="افزودن لینک"
        onClose={() => setLinkDialogOpen(false)}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setLinkDialogOpen(false)}>انصراف</Button>
            <Button onClick={applyLink} disabled={!linkUrl.trim()}>افزودن</Button>
          </>
        )}
      >
        <Input
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="https://example.com"
          dir="ltr"
          autoFocus
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } }}
        />
        <p className="ad-hint">فقط نشانی‌های http، https، mailto و tel پذیرفته می‌شوند.</p>
      </Modal>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        accept="image/*"
        onSelect={(item) => {
          insertHtml(`<img src="${item.url}" alt="${item.altText || item.originalName}" />`);
          notify('تصویر در متن درج شد');
        }}
      />
    </div>
  );
}

/* نزدیک‌ترین span رنگیِ پیرامون یک گره، محدود به ویرایشگر */
function nearestToneAncestor(node, editor) {
  let current = node?.nodeType === 1 ? node : node?.parentElement;
  while (current && current !== editor) {
    if (typeof current.className === 'string' && current.className.includes('micr-tone--')) return current;
    current = current.parentElement;
  }
  return null;
}
