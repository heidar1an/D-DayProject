import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icons';
import { useReader } from './readerContext';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* فهرست مطالب: فصل‌ها و زیرمبحث‌های واقعی همان نسخهٔ منتشرشده */
export default function TableOfContents() {
  const {
    reference,
    chapters,
    chapterId,
    content,
    activeSectionId,
    openChapter,
    setActiveSectionId,
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
    if (id !== chapterId) openChapter(id);
    setExpanded((current) => {
      const next = new Set(current);
      if (id === chapterId && next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredChapters = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return chapters.map((chapter) => ({
      chapter,
      sections: chapter.topics ?? (chapterId === chapter.id ? content?.sections ?? [] : []),
    }));
    return chapters
      .map((chapter) => {
        const chapterMatch = chapter.title.toLowerCase().includes(term);
        const allSections = chapter.topics ?? (chapterId === chapter.id ? content?.sections ?? [] : []);
        const sections = chapterMatch ? allSections : allSections.filter((s) => s.title.toLowerCase().includes(term));
        if (chapterMatch || sections.length) return { chapter, sections };
        return null;
      })
      .filter(Boolean);
  }, [chapters, query, chapterId, content]);

  return (
    <nav className="rdr-toc" aria-label="فهرست مطالب مرجع">
      <div className="rdr-toc__head">
        <strong>{reference.title}</strong>
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
          const isOpen = Boolean(query.trim()) || expanded.has(chapter.id);
          return (
            <div className="rdr-toc__chapter" key={chapter.id}>
              <button
                type="button"
                className={`rdr-toc__chapter-row ${isCurrent ? 'is-current' : ''}`}
                onClick={() => toggleChapter(chapter.id)}
                aria-expanded={isOpen}
              >
                <Icon name="chevron" size={14} className={`rdr-toc__chev ${isOpen ? 'is-open' : ''}`} />
                <span className="rdr-toc__number">{toFa(chapter.number)}</span>
                <span className="rdr-toc__title">{chapter.title}</span>
              </button>

              {isOpen && sections.length > 0 && (
                <div className="rdr-toc__sections" aria-label={`زیرمبحث‌های ${chapter.title}`}>
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      data-current={section.id === activeSectionId || undefined}
                      className="rdr-toc__section"
                      onClick={() => {
                        if (isCurrent && section.id === activeSectionId) {
                          document.querySelector('.rdr-content')?.scrollTo({ top: 0, behavior: 'smooth' });
                        } else openChapter(chapter.id, { sectionId: section.id });
                        setActiveSectionId(section.id);
                      }}
                    >
                      <span className="rdr-toc__section-dot" aria-hidden="true" />
                      <span>{section.title}</span>
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
