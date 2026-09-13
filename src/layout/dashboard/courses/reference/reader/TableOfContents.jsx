import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icons';
import { useReader } from './readerContext';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* فهرست مطالب (سمت چپ): فصل‌ها + بخش‌ها، با جست‌وجو، درصد پیشرفت و نشانگر موقعیت جاری */
export default function TableOfContents() {
  const {
    reference,
    chapters,
    chapterId,
    content,
    activeSectionId,
    progress,
    openChapter,
    setActiveSectionId,
    setTocOpen,
  } = useReader();
  const [expanded, setExpanded] = useState(() => new Set([chapterId]));
  const [query, setQuery] = useState('');

  const scrollRef = useRef(null);

  useEffect(() => {
    setExpanded((current) => {
      if (current.has(chapterId)) return current;
      const next = new Set(current);
      next.add(chapterId);
      return next;
    });
  }, [chapterId]);

  /* هنگام تغییر بخش جاری، فهرست به همان آیتم اسکرول می‌شود */
  useEffect(() => {
    scrollRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeSectionId, chapterId]);

  const toggleChapter = (id) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredChapters = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return chapters.map((chapter) => ({ chapter, sections: null }));
    return chapters
      .map((chapter) => {
        const chapterMatch = chapter.title.toLowerCase().includes(term);
        const sections = (chapterId === chapter.id && content
          ? content.sections.map((s) => ({ id: s.id, title: s.title }))
          : []
        ).filter((s) => s.title.toLowerCase().includes(term));
        if (chapterMatch || sections.length) return { chapter, sections: sections.length ? sections : null };
        return null;
      })
      .filter(Boolean);
  }, [chapters, query, chapterId, content]);

  return (
    <nav className="rdr-toc" aria-label="فهرست مطالب مرجع">
      <div className="rdr-toc__head">
        <strong>{reference.title}</strong>
        <button
          type="button"
          className="rdr-icon-btn"
          onClick={() => setTocOpen(false)}
          title="بستن فهرست"
          aria-label="بستن فهرست مطالب"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="rdr-toc__search">
        <Icon name="search" size={15} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جست‌وجو در فهرست…"
          aria-label="جست‌وجو در فهرست مطالب"
        />
      </div>

      <div className="rdr-toc__scroll" ref={scrollRef}>
        {filteredChapters.map(({ chapter, sections }) => {
          const isCurrent = chapter.id === chapterId;
          const pct = progress[chapter.id]?.pct ?? 0;
          const isOpen = expanded.has(chapter.id) || isCurrent;
          return (
            <div className="rdr-toc__chapter" key={chapter.id}>
              <button
                type="button"
                className={`rdr-toc__chapter-row ${isCurrent ? 'is-current' : ''} ${chapter.available ? '' : 'is-locked'}`}
                onClick={() => (chapter.available ? toggleChapter(chapter.id) : toggleChapter(chapter.id))}
                aria-expanded={isOpen}
              >
                <Icon name="chevron" size={14} className={`rdr-toc__chev ${isOpen ? 'is-open' : ''}`} />
                <span className="rdr-toc__number">{toFa(chapter.number)}</span>
                <span className="rdr-toc__title">
                  {chapter.title}
                  {!chapter.available && <em>به‌زودی</em>}
                </span>
                <span className="rdr-toc__pct">{toFa(pct)}٪</span>
              </button>

              <span className="rdr-toc__bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>

              {isOpen && sections && (
                <div className="rdr-toc__sections">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      data-current={section.id === activeSectionId || undefined}
                      className="rdr-toc__section"
                      onClick={() => {
                        openChapter(chapter.id, { sectionId: section.id });
                        setActiveSectionId(section.id);
                      }}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredChapters.length === 0 && (
          <p className="rdr-toc__empty">نتیجه‌ای برای «{query}» پیدا نشد.</p>
        )}
      </div>
    </nav>
  );
}
