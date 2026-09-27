/*
 * ویرایشگر متن غنی پنل تپش.
 *
 * روی contentEditable بومی مرورگر ساخته شده و از execCommand استفاده می‌کند؛
 * دلیلش روشن است: هیچ وابستگی جدیدی به پروژه اضافه نمی‌شود (قانون ۳ پروژه).
 *
 * چرخهٔ امنیت:
 *   paste → پاک‌سازی فوری در کلاینت → ذخیره در سرور → پاک‌سازی دوباره در سرور
 *   → رندر با HTML پاک‌شده. یعنی حتی اگر کلاینت دور زده شود، دادهٔ ذخیره‌شده سالم نیست.
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
function ToolButton({ label, icon: Icon, isActive = false, onClick }) {
  return (
    <button
      type="button"
      className={`ad-rte__btn ${isActive ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [block, setBlock] = useState('P');
  const [active, setActive] = useState({});
  /* رنگ جاری — با دکمه‌های رنگ «از قبل» تعیین می‌شود و دابل‌کلیک روی واژه‌ها آن را می‌نشاند */
  const [tone, setTone] = useState(null);

  /* محتوای DOM فقط وقتی از بیرون بازنویسی می‌شود که واقعاً تفاوت داشته باشد؛
     وگرنه نشانگر متن هنگام تایپ می‌پرد. */
  useEffect(() => {
    const element = editorRef.current;
    if (!element) return;
    const next = value ?? '';
    if (element.innerHTML !== next) element.innerHTML = next;
  }, [value]);

  const wordCount = useMemo(
    () => String(value ?? '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
    [value],
  );

  const emit = useCallback(() => {
    const element = editorRef.current;
    if (element) onChange?.(element.innerHTML);
  }, [onChange]);

  const refreshState = useCallback(() => {
    try {
      const nextBlock = String(document.queryCommandValue('formatBlock') || '').toUpperCase();
      setBlock(BLOCK_OPTIONS.some((option) => option.value === nextBlock) ? nextBlock : 'P');
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      /* مرورگر از queryCommand پشتیبانی نکرد — وضعیت دکمه‌ها مهمان‌نواز می‌ماند */
    }
  }, []);

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

  /* رنگ متن: انتخاب فعلی در یک `span` با کلاس تُن پیچیده می‌شود. تُن‌های قبلیِ داخل انتخاب
     باز می‌شوند تا رنگ تازه جای قبلی را بگیرد (وگرنه span داخلی‌تر برنده می‌شود). */
  const applyTone = useCallback((tone) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    /* انتخابِ خالی اینجا خطا نیست: رنگ فقط «جاری» می‌شود تا با دابل‌کلیک بنشیند */
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

    try {
      const content = range.extractContents();
      content.querySelectorAll('[class*="micr-tone--"]').forEach((node) => node.replaceWith(...node.childNodes));

      if (!tone) {
        range.insertNode(content);
        selection.removeAllRanges();
      } else {
        const span = document.createElement('span');
        span.className = `micr-tone--${tone}`;
        span.appendChild(content);
        range.insertNode(span);
        selection.removeAllRanges();
        const next = document.createRange();
        next.selectNodeContents(span);
        selection.addRange(next);
      }
    } catch {
      notify('رنگ‌کردن این بخش ممکن نشد', 'error');
      return;
    }

    emit();
  }, [emit, notify]);

  /*
   * انتخاب یک رنگ از پالت.
   *   • اگر متنی انتخاب باشد، همان‌جا اعمال می‌شود (رفتار قبلی).
   *   • اگر چیزی انتخاب نباشد، فقط رنگ «جاری» عوض می‌شود تا بعد با دابل‌کلیک روی
   *     هر واژه/جمله بنشیند — همان «تعیین رنگ از قبل» که کاربر خواست.
   */
  const pickTone = useCallback((value) => {
    setTone(value);
    const editor = editorRef.current;
    const selection = window.getSelection();
    const hasSelection = Boolean(editor && selection && !selection.isCollapsed
      && editor.contains(selection.anchorNode));
    if (hasSelection) applyTone(value);
  }, [applyTone]);

  /* دابل‌کلیک روی یک واژه (یا جمله): مرورگر خودش واژه را انتخاب می‌کند و ما فقط
     رنگ جاری را روی همان انتخاب می‌نشانیم. */
  const handleDoubleClick = () => {
    if (tone === null) return;
    applyTone(tone);
  };

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
          <ToolButton label="واگرد" icon={Icons.undo} onClick={() => exec('undo')} />
          <ToolButton label="ازنو" icon={Icons.redo} onClick={() => exec('redo')} />
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
          <ToolButton label="فهرست نقطه‌ای" icon={Icons.ul} isActive={active.insertUnorderedList} onClick={() => exec('insertUnorderedList')} />
          <ToolButton label="فهرست شماره‌دار" icon={Icons.ol} isActive={active.insertOrderedList} onClick={() => exec('insertOrderedList')} />
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
                title={`${item.label} — با دابل‌کلیک روی واژه‌ها هم می‌نشیند`}
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

      <div
        ref={editorRef}
        className="ad-rte__area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="محتوای متن"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
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
