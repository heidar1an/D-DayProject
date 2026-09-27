/* ── هسته وضعیت Reader ──
   همه وضعیت خواندن (فصل جاری، تنظیمات، هایلایت‌ها، نوت‌ها، بوکمارک‌ها، پیشرفت، پنل‌ها)
   اینجا متمرکز است تا کامپوننت‌ها فقط از useReader استفاده کنند.
   داده‌های کاربر از طریق لایه referencesApi ذخیره می‌شوند (امروز localStorage، فردا API واقعی). */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../../../../services/referencesApi';
import { getTheme } from '../../../../../services/theme/themeService';

const ReaderContext = createContext(null);

export const useReader = () => {
  const context = useContext(ReaderContext);
  if (!context) throw new Error('useReader must be used inside <ReaderProvider>');
  return context;
};

export const DEFAULT_SETTINGS = {
  fontSize: 17,
  lineHeight: 'normal', // compact | normal | relaxed
  width: 'normal', // narrow | normal | wide
  theme: 'dark', // light | dark | sepia
};

/*
 * تم پیش‌فرض مطالعه از تم خود سایت می‌آید تا کسی که سایت را روشن کرده
 * با باز کردن یک مرجع، غافلگیر نشود. انتخاب صریح کاربر در تنظیمات مطالعه
 * همیشه برنده است، چون از state ذخیره‌شده روی این پیش‌فرض می‌نشیند.
 * «سپیا» فقط انتخاب دستی است و پیش‌فرض هیچ‌وقت نمی‌شود.
 */
function readerDefaults() {
  return { ...DEFAULT_SETTINGS, theme: getTheme() === 'light' ? 'light' : 'dark' };
}

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'];

export function ReaderProvider({ reference, initialPosition, onExit, children }) {
  /* همهٔ فصل‌ها فعال‌اند (حالت «به‌زودی» از کل لایه برداشته شد)، پس فصل شروع
     یا موقعیت ذخیره‌شده است یا اولین فصل کتاب. */
  const [chapterId, setChapterId] = useState(
    initialPosition?.chapterId ?? reference.chapters[0]?.id ?? null,
  );
  const [contentRevision, setContentRevision] = useState(0);
  const [content, setContent] = useState(null);
  const [chapterLoading, setChapterLoading] = useState(true);
  const [chapterError, setChapterError] = useState(null);
  const chapter = useMemo(
    () => reference.chapters.find((ch) => ch.id === chapterId) ?? null,
    [reference, chapterId],
  );

  /* داده‌های کاربر */
  const [settings, setSettings] = useState(readerDefaults);
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [progress, setProgress] = useState({});
  const [lastRead, setLastRead] = useState(null);

  /* پنل‌ها و ابزارها */
  const [tocOpen, setTocOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 1240);
  const [asideOpen, setAsideOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 1240);
  const [asideTab, setAsideTab] = useState('notes'); // notes | highlights | bookmarks | search
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null); // toc | aside
  const [viewerImage, setViewerImage] = useState(null);
  const [flashTerm, setFlashTerm] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);

  const flashTimer = useRef(null);
  const toastTimer = useRef(null);

  /* موقعیتی که بعد از رندر فصل باید به آن اسکرول شود (بخش/بلوک/درصد) */
  const scrollRestore = useRef(initialPosition ?? null);

  /* بارگذاری وضعیت کاربر */
  useEffect(() => {
    let alive = true;
    api.loadReaderState(reference.id).then((state) => {
      if (!alive) return;
      setSettings({ ...readerDefaults(), ...(state.settings ?? {}) });
      setHighlights(state.highlights);
      setNotes(state.notes);
      setBookmarks(state.bookmarks);
      setProgress(state.progress);
      setLastRead(state.lastRead);
    });
    return () => {
      alive = false;
    };
  }, [reference.id]);

  /* بارگذاری محتوای فصل (lazy — فقط فصل جاری) */
  useEffect(() => {
    if (!chapterId) return;
    let alive = true;
    setChapterLoading(true);
    setChapterError(null);
    api
      .getChapterContent(reference.id, chapterId)
      .then((data) => {
        if (alive) {
          setContent(data);
          setActiveSectionId((current) =>
            data.sections.some((section) => section.id === scrollRestore.current?.sectionId)
              ? scrollRestore.current.sectionId
              : data.sections.some((section) => section.id === current)
                ? current : data.sections[0]?.id ?? null);
        }
      })
      .catch((error) => {
        if (alive) {
          setContent(null);
          setChapterError(error.code ?? error.message ?? 'UNKNOWN');
        }
      })
      .finally(() => {
        if (alive) setChapterLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reference.id, chapterId, contentRevision]);

  const showToast = useCallback((message, variant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { id, message, variant }]);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  /* ── تنظیمات خواندن ── */
  const updateSettings = useCallback(
    (patch) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        api.saveSettings(next);
        return next;
      });
    },
    [],
  );

  /* ── هایلایت ── */
  const addHighlight = useCallback(
    async (blockIdValue, start, end, color) => {
      const overlaps = highlights.some(
        (h) => h.blockId === blockIdValue && start < h.end && end > h.start,
      );
      if (overlaps) {
        showToast('این بخش با هایلایت فعلی هم‌پوشانی دارد', 'warning');
        return false;
      }
      const quote =
        content
          ?.sections.flatMap((s) => s.blocks)
          .find((b) => b.id === blockIdValue)?.text?.slice(start, end) ?? '';
      const created = await api.saveHighlight(reference.id, { blockId: blockIdValue, start, end, color, quote });
      setHighlights((current) => [...current, created]);
      showToast('هایلایت ذخیره شد', 'success');
      return true;
    },
    [highlights, content, reference.id, showToast],
  );

  const removeHighlight = useCallback(
    async (id) => {
      await api.deleteHighlight(reference.id, id);
      setHighlights((current) => current.filter((h) => h.id !== id));
      showToast('هایلایت حذف شد', 'info');
    },
    [reference.id, showToast],
  );

  /* ── یادداشت ── */
  const addNote = useCallback(
    async (blockIdValue, start, end, text) => {
      const created = await api.saveNote(reference.id, {
        blockId: blockIdValue,
        start,
        end,
        text,
        quote: content
          ?.sections.flatMap((s) => s.blocks)
          .find((b) => b.id === blockIdValue)?.text?.slice(start, end) ?? '',
      });
      setNotes((current) => [...current, created]);
      showToast('یادداشت ذخیره شد', 'success');
      return created;
    },
    [content, reference.id, showToast],
  );

  const removeNote = useCallback(
    async (id) => {
      await api.deleteNote(reference.id, id);
      setNotes((current) => current.filter((n) => n.id !== id));
      showToast('یادداشت حذف شد', 'info');
    },
    [reference.id, showToast],
  );

  /* ── بوکمارک ── */
  const currentBookmark = useMemo(
    () => bookmarks.find((b) => b.chapterId === chapterId && b.sectionId === activeSectionId) ?? null,
    [bookmarks, chapterId, activeSectionId],
  );

  const toggleBookmark = useCallback(() => {
    if (!chapter || !activeSectionId) return;
    if (currentBookmark) {
      api.deleteBookmark(reference.id, currentBookmark.id);
      setBookmarks((current) => current.filter((b) => b.id !== currentBookmark.id));
      showToast('نشان برداشته شد', 'info');
      return;
    }
    const section = content?.sections.find((s) => s.id === activeSectionId);
    api
      .saveBookmark(reference.id, {
        chapterId,
        sectionId: activeSectionId,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        sectionTitle: section?.title ?? '',
      })
      .then((created) => {
        setBookmarks((current) => [...current, created]);
        showToast('نشان ثبت شد', 'success');
      });
  }, [chapter, chapterId, content, currentBookmark, activeSectionId, reference.id, showToast]);

  const removeBookmark = useCallback(
    async (id) => {
      await api.deleteBookmark(reference.id, id);
      setBookmarks((current) => current.filter((b) => b.id !== id));
      showToast('نشان حذف شد', 'info');
    },
    [reference.id, showToast],
  );

  /* ── پیشرفت و آخرین مطالعه ── */
  const markSectionSeen = useCallback(
    (sectionId) => {
      if (!chapterId || !sectionId) return;
      setProgress((current) => {
        const seen = current[chapterId]?.seen ?? [];
        if (seen.includes(sectionId)) return current;
        const nextSeen = [...seen, sectionId];
        const total = content?.sections.length ?? 1;
        const pct = Math.round((nextSeen.length / total) * 100);
        api.saveProgress(reference.id, chapterId, nextSeen);
        return { ...current, [chapterId]: { seen: nextSeen, pct } };
      });
    },
    [chapterId, content, reference.id],
  );

  const savePosition = useCallback(
    (offset) => {
      api.saveLastRead(reference.id, {
        chapterId,
        sectionId: activeSectionId,
        offset,
      });
    },
    [chapterId, activeSectionId, reference.id],
  );

  /* ── ناوبری فصل‌ها ── */
  const openChapter = useCallback((targetChapterId, position) => {
    if (targetChapterId !== chapterId) {
      setChapterId(targetChapterId);
      setContent(null);
    } else {
      setContentRevision((revision) => revision + 1);
    }
    setActiveSectionId(position?.sectionId ?? null);
    scrollRestore.current = position ?? { top: 0 };
  }, [chapterId]);

  const goToBlock = useCallback((targetBlockId) => {
    const [targetChapter, targetSection] = String(targetBlockId).split('|');
    if (targetChapter !== chapterId) {
      setChapterId(targetChapter);
      setActiveSectionId(targetSection);
      setContent(null);
      scrollRestore.current = { sectionId: targetSection, blockId: targetBlockId };
    } else {
      setActiveSectionId(targetSection);
      scrollRestore.current = { sectionId: targetSection, blockId: targetBlockId };
    }
  }, [chapterId]);

  /* بازگرداندن مقدار جست‌وجوی برجسته‌شده در متن؛ بعد از چند ثانیه پاک می‌شود */
  const flashSearchTerm = useCallback((term) => {
    setFlashTerm(term);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashTerm(null), 3000);
  }, []);

  const value = {
    reference,
    chapters: reference.chapters,
    chapter,
    chapterId,
    content,
    chapterLoading,
    chapterError,
    activeSectionId,
    setActiveSectionId,
    scrollRestore,
    settings,
    updateSettings,
    highlights,
    notes,
    bookmarks,
    progress,
    lastRead,
    tocOpen,
    setTocOpen,
    asideOpen,
    setAsideOpen,
    asideTab,
    setAsideTab,
    settingsOpen,
    setSettingsOpen,
    mobilePanel,
    setMobilePanel,
    viewerImage,
    setViewerImage,
    flashTerm,
    flashSearchTerm,
    toasts,
    showToast,
    addHighlight,
    removeHighlight,
    addNote,
    removeNote,
    currentBookmark,
    toggleBookmark,
    removeBookmark,
    markSectionSeen,
    savePosition,
    openChapter,
    goToBlock,
    onExit,
  };

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}
