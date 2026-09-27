import { useEffect, useRef } from 'react';
import ReaderHeader from './ReaderHeader';
import TableOfContents from './TableOfContents';
import ReadingArea from './ReadingArea';
import RightPanel from './RightPanel';
import FloatingToolbar from './FloatingToolbar';
import ImageViewer from './ImageViewer';
import ReadingSettings from './ReadingSettings';
import Toasts from './Toasts';
import { ReaderProvider, useReader } from './readerContext';
import './reader.css';

/* حفاظت محتوا (لایه UI): جلوگیری از کپی/کات، منوی راست‌کلیک و درگ متن داخل ناحیه مطالعه.
   انتخاب متن برای هایلایت/یادداشت باقی می‌ماند اما رویداد کپی مسدود است.
   یادآوری معماری: حفاظت کامل فقط با تحویل محتوا از بک‌اند (streaming/render سمت سرور)
   معنا دارد؛ این لایه جلوی کپیِ عادی کاربر را می‌گیرد. */
function useCopyProtection(rootRef, contentRef, showToast) {
  useEffect(() => {
    const inContent = (target) => Boolean(contentRef.current?.contains(target));

    const preventIfContent = (event) => {
      if (inContent(event.target)) event.preventDefault();
    };

    const onCopy = (event) => {
      const selection = window.getSelection();
      const anchor = selection?.anchorNode;
      const el = anchor ? (anchor.nodeType === 1 ? anchor : anchor.parentElement) : null;
      if (inContent(el)) {
        event.preventDefault();
        showToast('کپی از محتوای مرجع غیرفعال است', 'warning');
      }
    };

    const onDragStart = (event) => {
      if (inContent(event.target)) event.preventDefault();
    };

    const root = rootRef.current;
    root?.addEventListener('contextmenu', preventIfContent);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    root?.addEventListener('dragstart', onDragStart);
    return () => {
      root?.removeEventListener('contextmenu', preventIfContent);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      root?.removeEventListener('dragstart', onDragStart);
    };
  }, [rootRef, contentRef, showToast]);
}

function ReaderInner() {
  const {
    reference,
    settings,
    tocOpen,
    asideOpen,
    mobilePanel,
    setMobilePanel,
    settingsOpen,
    setSettingsOpen,
    setAsideTab,
    viewerImage,
    setViewerImage,
    toasts,
    showToast,
    onExit,
  } = useReader();

  const rootRef = useRef(null);
  const contentRef = useRef(null);
  const progressRef = useRef(null);

  useCopyProtection(rootRef, contentRef, showToast);

  /* میان‌برهای کیبورد: Ctrl+F جست‌وجو، Esc بستن لایه‌ها؛ کپی با رویداد copy مسدود می‌شود */
  useEffect(() => {
    const onKey = (event) => {
      const isTyping = event.target.closest?.('input, textarea');
      if (event.key === 'Escape' && !isTyping) {
        if (viewerImage) setViewerImage(null);
        else if (settingsOpen) setSettingsOpen(false);
        else if (mobilePanel) setMobilePanel(null);
        else onExit?.();
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || isTyping) return;
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setAsideTab('search');
        if (window.innerWidth < 900) setMobilePanel('aside');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerImage, settingsOpen, mobilePanel, setViewerImage, setSettingsOpen, setMobilePanel, setAsideTab, onExit]);

  return (
    <div
      className="rdr"
      ref={rootRef}
      data-rdr-theme={settings.theme}
      style={{ '--ref-accent': reference.accent }}
    >
      <ReaderHeader progressRef={progressRef} />

      <div className="rdr__body">
        {tocOpen && (
          <div className="rdr__toc-slot">
            <TableOfContents />
          </div>
        )}

        <ReadingArea contentRef={contentRef} progressRef={progressRef} />

        {asideOpen && (
          <div className="rdr__aside-slot">
            <RightPanel />
          </div>
        )}
      </div>

      {/* کشوهای موبایل */}
      {mobilePanel === 'toc' && (
        <div className="rdr-drawer" role="dialog" aria-modal="true" onClick={() => setMobilePanel(null)}>
          <div className="rdr-drawer__panel rdr-drawer__panel--toc" onClick={(event) => event.stopPropagation()}>
            <TableOfContents />
          </div>
        </div>
      )}
      {mobilePanel === 'aside' && (
        <div className="rdr-drawer" role="dialog" aria-modal="true" onClick={() => setMobilePanel(null)}>
          <div className="rdr-drawer__panel rdr-drawer__panel--aside" onClick={(event) => event.stopPropagation()}>
            <RightPanel />
          </div>
        </div>
      )}

      {settingsOpen && <ReadingSettings onClose={() => setSettingsOpen(false)} />}

      {viewerImage && <ImageViewer image={viewerImage} onClose={() => setViewerImage(null)} />}

      <FloatingToolbar contentRef={contentRef} />

      <Toasts toasts={toasts} />
    </div>
  );
}

/* ورودی کامل Reader — در ReferenceLayer با reference و موقعیت اولیه mount می‌شود */
export default function ReferenceReader({ reference, initialPosition, onExit }) {
  return (
    <ReaderProvider reference={reference} initialPosition={initialPosition} onExit={onExit}>
      <ReaderInner />
    </ReaderProvider>
  );
}
