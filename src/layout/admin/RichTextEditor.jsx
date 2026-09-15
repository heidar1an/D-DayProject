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

export default function RichTextEditor({ value = '', onChange, placeholder = 'متن خود را اینجا بنویسید…' }) {
  const notify = useToast();
  const editorRef = useRef(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [block, setBlock] = useState('P');
  const [active, setActive] = useState({});

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

  const insertHtml = useCallback((html) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, sanitizeHtml(html));
    emit();
  }, [emit]);

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

  const ToolButton = ({ label, command, commandValue, icon: Icon, isActive = false, onClick }) => (
    <button
      type="button"
      className={`ad-rte__btn ${isActive ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick ?? (() => exec(command, commandValue))}
    >
      {Icon ? <Icon /> : <span className="ad-rte__letter">{label}</span>}
    </button>
  );

  return (
    <div className="ad-rte">
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
          <ToolButton label="B" command="bold" isActive={active.bold} />
          <ToolButton label="I" command="italic" isActive={active.italic} />
          <ToolButton label="U" command="underline" isActive={active.underline} />
          <ToolButton label="S" command="strikeThrough" isActive={active.strikeThrough} />
        </div>

        <div className="ad-rte__group">
          <ToolButton label="فهرست نقطه‌ای" icon={Icons.ul} command="insertUnorderedList" isActive={active.insertUnorderedList} />
          <ToolButton label="فهرست شماره‌دار" icon={Icons.ol} command="insertOrderedList" isActive={active.insertOrderedList} />
          <ToolButton label="نقل‌قول" icon={Icons.quote} onClick={() => exec('formatBlock', 'BLOCKQUOTE')} />
          <ToolButton label="بلوک کد" icon={Icons.code} onClick={() => exec('formatBlock', 'PRE')} />
        </div>

        <div className="ad-rte__group">
          <ToolButton label="راست‌چین" icon={Icons.alignRight} command="justifyRight" />
          <ToolButton label="وسط‌چین" icon={Icons.alignCenter} command="justifyCenter" />
          <ToolButton label="چپ‌چین" icon={Icons.alignLeft} command="justifyLeft" />
        </div>

        <div className="ad-rte__group">
          <ToolButton label="افزودن لینک" icon={IconLink} onClick={() => setLinkDialogOpen(true)} />
          <ToolButton label="افزودن تصویر" icon={IconImage} onClick={() => setPickerOpen(true)} />
          <ToolButton label="افزودن جدول" icon={Icons.table} onClick={insertTable} />
          <ToolButton label="حذف قالب" icon={Icons.erase} onClick={() => exec('removeFormat')} />
        </div>
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
        onPaste={handlePaste}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
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
