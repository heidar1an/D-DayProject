import { useEffect, useRef } from 'react';
import Icon from './icons';
import { useReader } from './readerContext';
import {
  BlockSkeleton,
  CalloutBlock,
  DividerBlock,
  FormulaBlock,
  HeadingBlock,
  ImageBlock,
  QuoteBlock,
  TableBlock,
  TextBlock,
} from './ContentBlocks';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const LINE_HEIGHTS = { compact: 1.7, normal: 1.95, relaxed: 2.2 };
const WIDTHS = { narrow: 660, normal: 780, wide: 920 };

const BLOCK_RENDERERS = {
  p: TextBlock,
  h1: HeadingBlock,
  h2: HeadingBlock,
  h3: HeadingBlock,
  quote: QuoteBlock,
  formula: FormulaBlock,
  callout: CalloutBlock,
  image: ImageBlock,
  table: TableBlock,
  divider: DividerBlock,
};

/* ناحیه مطالعه: اسکرول، اسپای بخش‌ها، ذخیره پیشرفت و بازگشت به آخرین موقعیت */
export default function ReadingArea({ contentRef, progressRef }) {
  const {
    reference,
    chapter,
    content,
    chapterLoading,
    chapterError,
    activeSectionId,
    setActiveSectionId,
    markSectionSeen,
    savePosition,
    scrollRestore,
    settings,
    progress,
    openChapter,
    availableChapters,
  } = useReader();

  const scrollerRef = useRef(null);
  const lastSavedRef = useRef(0);
  const seenRef = useRef(new Set());

  /* بازگرداندن موقعیت مطالعه بعد از رندر فصل */
  useEffect(() => {
    if (!content || chapterLoading) return;
    const restore = scrollRestore.current;
    if (!restore) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    requestAnimationFrame(() => {
      if (restore.blockId) {
        const block = contentRef.current?.querySelector(`[data-block-id="${CSS.escape(restore.blockId)}"]`);
        if (block) {
          scroller.scrollTop = block.offsetTop - 96;
          return;
        }
      }
      if (restore.sectionId) {
        const section = contentRef.current?.querySelector(`[data-section-id="${CSS.escape(restore.sectionId)}"]`);
        if (section) {
          scroller.scrollTop = section.offsetTop - 84;
          return;
        }
      }
      if (restore.offset != null) {
        scroller.scrollTop = restore.offset * Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        return;
      }
      scroller.scrollTop = 0;
    });
    scrollRestore.current = null;
  }, [content, chapterLoading, contentRef, scrollRestore]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const ratio = max > 0 ? scroller.scrollTop / max : 0;

    if (progressRef.current) {
      progressRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0.02, ratio))})`;
    }

    /* ذخیره موقعیت (throttle نیم‌ثانیه) */
    const now = Date.now();
    if (now - lastSavedRef.current > 500) {
      lastSavedRef.current = now;
      savePosition(ratio);
    }
  };

  /* اسپای بخش‌ها + ثبت بخش‌های دیده‌شده برای پیشرفت فصل */
  useEffect(() => {
    if (!content || chapterLoading || !scrollerRef.current) return undefined;
    const sections = contentRef.current?.querySelectorAll('[data-section-id]');
    if (!sections?.length) return undefined;

    seenRef.current = new Set(progress[chapter.id]?.seen ?? []);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sectionId = entry.target.dataset.sectionId;
          setActiveSectionId(sectionId);
          if (!seenRef.current.has(sectionId)) {
            seenRef.current.add(sectionId);
            markSectionSeen(sectionId);
          }
        });
      },
      { root: scrollerRef.current, rootMargin: '-10% 0px -55% 0px', threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [content, chapterLoading, chapter, progress, contentRef, setActiveSectionId, markSectionSeen]);

  const chapterIndex = availableChapters.findIndex((ch) => ch.id === chapter?.id);
  const prevChapter = chapterIndex > 0 ? availableChapters[chapterIndex - 1] : null;
  const nextChapter =
    chapterIndex >= 0 && chapterIndex < availableChapters.length - 1
      ? availableChapters[chapterIndex + 1]
      : null;

  return (
    <main className="rdr-content" ref={scrollerRef} onScroll={handleScroll} tabIndex={-1}>
      <article
        className="rdr-article"
        ref={contentRef}
        style={{
          '--rdr-fs': `${settings.fontSize}px`,
          '--rdr-lh': LINE_HEIGHTS[settings.lineHeight],
          '--rdr-measure': `${WIDTHS[settings.width]}px`,
        }}
      >
        {chapter && (
          <header className="rdr-article__head">
            <span className="rdr-article__kicker">فصل {toFa(chapter.number)}</span>
            <h1>{chapter.title}</h1>
            <p className="rdr-article__meta">
              <Icon name="clock" size={14} />
              زمان مطالعه حدود {toFa(chapter.minutes)} دقیقه
              {progress[chapter.id]?.pct > 0 && (
                <em>پیشرفت شما در این فصل: {toFa(progress[chapter.id].pct)}٪</em>
              )}
            </p>
          </header>
        )}

        {chapterLoading && <BlockSkeleton />}

        {!chapterLoading && chapterError && (
          <div className="rdr-empty">
            <Icon name="book" size={34} />
            <h3>
              {chapterError === 'CONTENT_NOT_AVAILABLE'
                ? 'محتوای این فصل به‌زودی بارگذاری می‌شود'
                : 'خطا در بارگذاری محتوا'}
            </h3>
            <p>
              {chapterError === 'CONTENT_NOT_AVAILABLE'
                ? 'این فصل در حال دیجیتال‌سازی است؛ به‌محض انتشار، همین‌جا به‌صورت متنی در دسترس قرار می‌گیرد.'
                : 'اتصال خود را بررسی کنید و دوباره تلاش کنید.'}
            </p>
          </div>
        )}

        {!chapterLoading && !chapterError && content && (
          <>
            {content.sections.map((section, sectionIndex) => (
              <section
                className="rdr-section"
                key={section.id}
                data-section-id={section.id}
                aria-label={section.title}
              >
                <h2 className="rdr-section__title" data-section-title>
                  <span className="rdr-section__num">{toFa(sectionIndex + 1)}</span>
                  {section.title}
                </h2>
                {section.blocks.map((block) => {
                  const Renderer = BLOCK_RENDERERS[block.type];
                  if (!Renderer) return null;
                  return <Renderer key={block.id} block={block} />;
                })}
              </section>
            ))}

            <nav className="rdr-chapter-nav" aria-label="جابه‌جایی بین فصل‌ها">
              {prevChapter ? (
                <button type="button" className="rdr-chapter-nav__btn" onClick={() => openChapter(prevChapter.id)}>
                  <Icon name="arrowPrev" size={17} />
                  <span>
                    <small>فصل قبل</small>
                    <strong>
                      فصل {toFa(prevChapter.number)} — {prevChapter.title}
                    </strong>
                  </span>
                </button>
              ) : (
                <span />
              )}
              {nextChapter ? (
                <button type="button" className="rdr-chapter-nav__btn" onClick={() => openChapter(nextChapter.id)}>
                  <span>
                    <small>فصل بعد</small>
                    <strong>
                      فصل {toFa(nextChapter.number)} — {nextChapter.title}
                    </strong>
                  </span>
                  <Icon name="arrowNext" size={17} />
                </button>
              ) : (
                <span />
              )}
            </nav>
          </>
        )}
      </article>
    </main>
  );
}
