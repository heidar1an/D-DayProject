import { useEffect, useRef } from 'react';
import Icon from './icons';
import { useReader } from './readerContext';
import {
  BlockSkeleton,
  CalloutBlock,
  DividerBlock,
  FormulaBlock,
  HeadingBlock,
  HtmlBlock,
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
  html: HtmlBlock,
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
    chapter,
    content,
    chapterLoading,
    chapterError,
    activeSectionId,
    markSectionSeen,
    savePosition,
    scrollRestore,
    settings,
    openChapter,
  } = useReader();

  const scrollerRef = useRef(null);
  const lastSavedRef = useRef(0);
  const sectionIndex = content?.sections.findIndex((section) => section.id === activeSectionId) ?? -1;
  const currentIndex = sectionIndex < 0 ? 0 : sectionIndex;
  const currentSection = content?.sections[currentIndex];

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
  }, [content, activeSectionId, chapterLoading, contentRef, scrollRestore]);

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

  /* هر زیرمبحث یک صفحه است؛ ورود به همان صفحه پیشرفت را ثبت می‌کند. */
  useEffect(() => {
    if (currentSection && !chapterLoading) markSectionSeen(currentSection.id);
  }, [currentSection?.id, chapterLoading, markSectionSeen]);

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
        {chapterLoading && <BlockSkeleton />}

        {!chapterLoading && chapterError && (
          <div className="rdr-empty">
            <Icon name="book" size={34} />
            <h3>
              {chapterError === 'CONTENT_NOT_AVAILABLE'
                ? 'متن این فصل هنوز آماده نشده'
                : 'خطا در بارگذاری محتوا'}
            </h3>
            <p>
              {chapterError === 'CONTENT_NOT_AVAILABLE'
                ? 'همهٔ فصل‌ها باز و قابل ورودند؛ فصلی که متنش نوشته نشده، به‌محض آماده شدن همین‌جا نمایش داده می‌شود.'
                : 'اتصال خود را بررسی کنید و دوباره تلاش کنید.'}
            </p>
          </div>
        )}

        {!chapterLoading && !chapterError && content && (
          <>
            {currentSection && (
              <section
                className="rdr-section"
                key={currentSection.id}
                data-section-id={currentSection.id}
                aria-label={currentSection.title}
              >
                <h2 className="rdr-section__title" data-section-title>
                  <span className="rdr-section__num">{toFa(currentIndex + 1)}</span>
                  {currentSection.title}
                </h2>
                {currentSection.blocks.map((block) => {
                  const Renderer = BLOCK_RENDERERS[block.type];
                  if (!Renderer) return null;
                  return <Renderer key={block.id} block={block} />;
                })}
              </section>
            )}

            <nav className="rdr-chapter-nav" aria-label="جابه‌جایی بین زیرمبحث‌ها">
              {currentIndex > 0 ? (
                <button type="button" className="rdr-chapter-nav__btn" onClick={() =>
                  openChapter(chapter.id, { sectionId: content.sections[currentIndex - 1].id })}>
                  <Icon name="arrowNext" size={17} />
                  <span>
                    <small>زیرمبحث قبل</small>
                    <strong>{content.sections[currentIndex - 1].title}</strong>
                  </span>
                </button>
              ) : (
                <span />
              )}
              {currentIndex < content.sections.length - 1 ? (
                <button type="button" className="rdr-chapter-nav__btn" onClick={() =>
                  openChapter(chapter.id, { sectionId: content.sections[currentIndex + 1].id })}>
                  <span>
                    <small>زیرمبحث بعد</small>
                    <strong>{content.sections[currentIndex + 1].title}</strong>
                  </span>
                  <Icon name="arrowPrev" size={17} />
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
