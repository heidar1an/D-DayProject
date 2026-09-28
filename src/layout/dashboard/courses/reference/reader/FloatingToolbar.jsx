import { useEffect, useRef, useState } from 'react';
import Icon from './icons';
import { HIGHLIGHT_COLORS, useReader } from './readerContext';
import { selectionToBlockRange } from './richText';

const COLOR_LABELS = { yellow: 'زرد', green: 'سبز', blue: 'آبی', pink: 'صورتی' };

/* تولبار شناور روی متن انتخاب‌شده: هایلایت، یادداشت، نشان — و Copy غیرفعال (حفاظت محتوا) */
export default function FloatingToolbar({ contentRef }) {
  const { addHighlight, addNote, setAsideTab, setAsideOpen, setMobilePanel, toggleBookmark, showToast } =
    useReader();
  const [state, setState] = useState(null); // { x, y, mode: 'actions' | 'note', range }
  const [noteText, setNoteText] = useState('');
  const textareaRef = useRef(null);
  const hideTimer = useRef(null);

  const clearSelection = () => window.getSelection()?.removeAllRanges();

  const positionFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const anchor = selection.anchorNode;
    if (!anchor || !contentRef.current?.contains(anchor.nodeType === 1 ? anchor : anchor.parentElement)) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { x: rect.left + rect.width / 2, y: rect.top, mode: 'actions' };
  };

  /* انتخاب متن در ناحیه مطالعه → نمایش تولبار */
  useEffect(() => {
    const onSelectionChange = () => {
      if (state?.mode === 'note') return; // حین نوشتن یادداشت، تولبار جابه‌جا نشود
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        const position = positionFromSelection();
        setState(position);
      }, 60);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      clearTimeout(hideTimer.current);
    };
  }, [state?.mode, contentRef]);

  const applyHighlight = async (color) => {
    const result = selectionToBlockRange(contentRef.current);
    if (!result || result.crossBlock) {
      showToast(result?.crossBlock ? 'فعلاً هایلایت در محدوده یک بلوک ممکن است' : 'ابتدا متنی را انتخاب کنید', 'warning');
      return;
    }
    try {
      const ok = await addHighlight(result.blockId, result.start, result.end, color);
      if (ok) {
        clearSelection();
        setState(null);
      }
    } catch {
      showToast('هایلایت ذخیره نشد', 'warning');
    }
  };

  const openNote = () => {
    const result = selectionToBlockRange(contentRef.current);
    if (!result || result.crossBlock) return;
    setNoteText('');
    setState((current) => ({ ...current, mode: 'note', range: result }));
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const saveNote = async () => {
    const text = noteText.trim();
    if (!text || !state.range) return;
    await addNote(state.range.blockId, state.range.start, state.range.end, text);
    clearSelection();
    setState(null);
    setAsideTab('notes');
    setAsideOpen(true);
    setMobilePanel('aside');
  };

  const onCopyClick = () => showToast('کپی از محتوای مرجع غیرفعال است', 'warning');

  if (!state) return null;

  return (
    <div
      className="rdr-toolbar"
      style={{ left: state.x, top: state.y }}
      onMouseDown={(event) => event.preventDefault()} // تا انتخاب متن هنگام کلیک روی تولبار پاک نشود
      role="toolbar"
      aria-label="ابزارهای متن انتخاب‌شده"
    >
      {state.mode === 'note' ? (
        <div className="rdr-toolbar__note">
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) saveNote();
            }}
            rows={3}
            placeholder="یادداشت خود را بنویسید…"
            aria-label="متن یادداشت"
          />
          <div className="rdr-toolbar__note-actions">
            <button type="button" className="rdr-btn rdr-btn--primary" onClick={saveNote} disabled={!noteText.trim()}>
              ذخیره یادداشت
            </button>
            <button type="button" className="rdr-btn" onClick={() => setState(null)}>
              انصراف
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rdr-toolbar__colors">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`rdr-swatch rdr-swatch--${color}`}
                onClick={() => applyHighlight(color)}
                title={`هایلایت ${COLOR_LABELS[color]}`}
                aria-label={`هایلایت ${COLOR_LABELS[color]}`}
              />
            ))}
          </div>
          <span className="rdr-toolbar__sep" aria-hidden="true" />
          <button type="button" className="rdr-tool-btn" onClick={openNote} title="افزودن یادداشت">
            <Icon name="note" size={16} />
          </button>
          <button
            type="button"
            className="rdr-tool-btn"
            onClick={() => {
              toggleBookmark();
              setState(null);
              clearSelection();
            }}
            title="نشان‌گذاری بخش جاری"
          >
            <Icon name="bookmark" size={16} />
          </button>
          {/* گزینه کپی طبق سیاست حفاظت محتوا همیشه غیرفعال است */}
          <button type="button" className="rdr-tool-btn rdr-tool-btn--locked" onClick={onCopyClick} title="کپی محتوا غیرفعال است">
            <Icon name="info" size={16} />
          </button>
        </>
      )}
    </div>
  );
}
