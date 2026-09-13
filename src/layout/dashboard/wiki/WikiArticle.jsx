/* ── صفحه اختصاصی هر موضوع ویکی تپش ──
   فلسفه Wikipedia (سلسله‌مراتب، TOC، ارجاع متقابل، ارجاعات) با UI مدرن تپش:
   فهرست شناور با تشخیص بخش فعال هنگام scroll، بلوک‌های ساختاریافته (تعریف/جدول/فرمول/
   نکته بالینی)، «شبکه دانش» مینیمال برای کشف، و اکشن‌های نشان/کپی/اشتراک. */

import { useEffect, useMemo, useState } from 'react';
import { useAsyncData } from '../league/useAsyncData';
import * as api from '../../../services/wiki/wikiService';
import {
  Chip,
  DifficultyBadge,
  getWikiScrollContainer,
  GoArrow,
  Icon,
  scrollWikiTop,
  SubjectTag,
  TypeBadge,
  toFa,
} from './wikiShared';

/* ── نمایش بلوک‌های محتوا ── */
function ContentBlock({ block }) {
  switch (block.type) {
    case 'p':
      return <p className="wiki-article__p">{block.text}</p>;

    case 'h':
      return <h3 className="wiki-article__h3">{block.text}</h3>;

    case 'list': {
      const items = block.items.map((item) => <li key={item}>{item}</li>);
      return block.ordered ? (
        <ol className="wiki-article__list">{items}</ol>
      ) : (
        <ul className="wiki-article__list">{items}</ul>
      );
    }

    case 'callout': {
      const variantLabels = {
        definition: 'تعریف',
        clinical: 'ارتباط بالینی',
        exam: 'نقطه امتحانی',
        keypoint: 'نکته کلیدی',
        warning: 'هشدار',
        important: 'مهم',
      };
      return (
        <aside className={`wiki-callout wiki-callout--${block.variant}`}>
          <span className="wiki-callout__tag">{variantLabels[block.variant] ?? 'نکته'}</span>
          {block.title && <strong className="wiki-callout__title">{block.title}</strong>}
          <p>{block.text}</p>
        </aside>
      );
    }

    case 'table':
      return (
        <figure className="wiki-table">
          <div className="wiki-table__scroll" tabIndex={0} role="region" aria-label={block.caption}>
            <table>
              <thead>
                <tr>
                  {block.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${block.caption}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${block.caption}-${rowIndex}-${cellIndex}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );

    case 'formula':
      return (
        <div className="wiki-formula">
          <span className="wiki-formula__expr" dir="ltr">
            {block.expr}
          </span>
          {block.note && <span className="wiki-formula__note">{block.note}</span>}
        </div>
      );

    case 'quote':
      return (
        <blockquote className="wiki-quote">
          <p>{block.text}</p>
          {block.cite && <cite>{block.cite}</cite>}
        </blockquote>
      );

    case 'divider':
      return <hr className="wiki-article__divider" />;

    default:
      return null;
  }
}

/* ── فهرست مطالب (دسکتاپ شناور، موبایل بازشو) ── */
function TableOfContents({ sections, activeId, onJump, mobile }) {
  const list = (
    <ol className="wiki-toc__list">
      {sections.map((section, index) => (
        <li key={section.id}>
          <button
            type="button"
            className={`wiki-toc__item ${activeId === section.id ? 'is-active' : ''}`}
            onClick={() => onJump(section.id)}
          >
            <span className="wiki-toc__num">{toFa(index + 1)}</span>
            {section.title}
          </button>
        </li>
      ))}
    </ol>
  );

  if (mobile) {
    return (
      <details className="wiki-toc wiki-toc--mobile">
        <summary>فهرست مطالب</summary>
        {list}
      </details>
    );
  }

  return (
    <nav className="wiki-toc" aria-label="فهرست مطالب مقاله">
      <h4>در این مقاله</h4>
      {list}
    </nav>
  );
}

/* ── شبکه دانش: گراف مینیمال دو حلقه‌ای (روابط خروجی و ارجاع‌های ورودی) ── */
function KnowledgeGraph({ center, related, backlinks, onOpen }) {
  const nodes = useMemo(() => {
    const neighbors = [
      ...related.map((item) => ({ ...item, side: 'out' })),
      ...backlinks.map((item) => ({ ...item, side: 'in' })),
    ];

    /* حذف تکراری‌ها (رابطه دوطرفه) و محدود کردن تعداد برای خوانایی */
    const seen = new Set([center.slug]);
    const unique = [];
    neighbors.forEach((node) => {
      if (seen.has(node.slug)) return;
      seen.add(node.slug);
      unique.push(node);
    });
    return unique.slice(0, 8);
  }, [center.slug, related, backlinks]);

  if (nodes.length === 0) return null;

  const W = 560;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2;

  /* چیدمان دو قوسی: روابط خروجی سمت راست، ارجاع‌های ورودی سمت چپ */
  const positioned = nodes.map((node, index) => {
    const sideNodes = nodes.filter((n) => n.side === node.side);
    const sideIndex = sideNodes.indexOf(node);
    const count = sideNodes.length;
    const angle = (Math.PI / (Math.max(count - 1, 1))) * sideIndex; // 0..π
    const rx = 210;
    const ry = 108;
    const x = node.side === 'out' ? cx + Math.cos(Math.PI - angle) * rx : cx - Math.cos(Math.PI - angle) * rx;
    const y = cy + ry - Math.sin(angle) * 2 * ry * 0.5;
    return { ...node, x, y };
  });

  return (
    <section className="wiki-graph" aria-label="شبکه دانش">
      <div className="wiki-section__head">
        <h2>شبکه دانش</h2>
        <p>این مفهوم در شبکه دانش تپش به این موضوعات وصل است؛ روی هر گره بزن.</p>
      </div>

      <div className="wiki-graph__stage" style={{ '--accent': api.subjectAccent(center.subject) }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`ارتباطات ${center.title}`}>
          {positioned.map((node) => (
            <g key={`edge-${node.slug}`}>
              <line
                x1={cx}
                y1={cy}
                x2={node.x}
                y2={node.y}
                className={`wiki-graph__edge ${node.side === 'in' ? 'wiki-graph__edge--in' : ''}`}
              />
            </g>
          ))}

          {positioned.map((node) => (
            <g
              key={`node-${node.slug}`}
              className={`wiki-graph__node ${node.side === 'in' ? 'wiki-graph__node--in' : ''}`}
              onClick={() => onOpen(node.slug)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(node.slug);
                }
              }}
            >
              <title>{`${node.relationLabel} — ${node.title}`}</title>
              <circle cx={node.x} cy={node.y} r="7" />
              <text
                x={node.x}
                y={node.y + (node.y > cy ? 22 : -14)}
                textAnchor="middle"
              >
                {node.title.length > 22 ? `${node.title.slice(0, 20)}…` : node.title}
              </text>
            </g>
          ))}

          <g className="wiki-graph__center">
            <circle cx={cx} cy={cy} r="30" />
            <text x={cx} y={cy + 4} textAnchor="middle">
              {center.title.length > 18 ? `${center.title.slice(0, 16)}…` : center.title}
            </text>
          </g>
        </svg>

        <div className="wiki-graph__legend">
          <span>
            <i className="wiki-graph__dot wiki-graph__dot--out" aria-hidden="true" />
            روابط خروجی
          </span>
          <span>
            <i className="wiki-graph__dot wiki-graph__dot--in" aria-hidden="true" />
            ارجاع از مقالات دیگر
          </span>
        </div>
      </div>
    </section>
  );
}

/* ── نمای کامل مقاله ── */
export default function WikiArticle({ slug, originLabel, onBack, onOpenArticle }) {
  const { data, loading, error, retry } = useAsyncData(() => api.getArticle(slug), [slug]);
  const [activeId, setActiveId] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [bookmarked, setBookmarked] = useState(() => api.isBookmarked(slug));
  const [toast, setToast] = useState(null);

  /* وضعیت نشان با تغییر مقاله همگام شود؛ هر مقاله از بالای ظرف اسکرول شروع می‌شود */
  useEffect(() => {
    setBookmarked(api.isBookmarked(slug));
    scrollWikiTop();
  }, [slug]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  /* تشخیص بخش فعال هنگام اسکرول (در ظرف داشبورد یا پنجره) + دکمه بازگشت به بالا */
  useEffect(() => {
    if (!data) return undefined;

    const container = getWikiScrollContainer();

    const topOf = (element) =>
      container
        ? element.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop
        : element.offsetTop;

    const handleScroll = () => {
      const scrolled = container ? container.scrollTop : window.scrollY;
      const fromTop = scrolled + 150;
      let current = data.article.sections[0]?.id;
      data.article.sections.forEach((section) => {
        const element = document.getElementById(`wiki-sec-${section.id}`);
        if (element && topOf(element) <= fromTop) current = section.id;
      });
      setActiveId(current);
      setShowBackToTop(scrolled > 700);
    };

    const scrollTarget = container ?? window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
  }, [data]);

  if (loading) {
    return (
      <div className="wiki-article" aria-hidden="true">
        <span className="wiki-skeleton wiki-article__crumb-sk" />
        <span className="wiki-skeleton wiki-article__title-sk" />
        <span className="wiki-skeleton wiki-article__meta-sk" />
        <div className="wiki-article__body">
          <div className="wiki-article__main">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="wiki-skeleton wiki-article__p-sk" />
            ))}
          </div>
          <span className="wiki-skeleton wiki-article__rail-sk" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wiki-article">
        <div className="wiki-empty">
          <h3>مقاله پیدا نشد</h3>
          <p>ممکن است این موضوع حذف یا منتقل شده باشد.</p>
          <button type="button" className="wiki-empty__dym" onClick={retry}>
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  const { article, related, backlinks } = data;
  const accent = api.subjectAccent(article.subject);

  const jumpTo = (sectionId) => {
    const element = document.getElementById(`wiki-sec-${sectionId}`);
    if (!element) return;
    const container = getWikiScrollContainer();
    if (container) {
      const top =
        element.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        110;
      container.scrollTo({ top, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: element.offsetTop - 120, behavior: 'smooth' });
    }
  };

  const handleBookmark = async () => {
    const next = await api.toggleBookmark(article.slug);
    setBookmarked(next);
    showToast(next ? 'در فهرست مطالعه ذخیره شد' : 'از فهرست مطالعه حذف شد');
  };

  const articleLink = () => {
    /* لینک معنایی مقاله — در نسخه عمومی سایت به مسیر واقعی تبدیل می‌شود */
    return `${window.location.origin}${window.location.pathname}#wiki/${article.slug}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(articleLink());
      showToast('لینک مقاله کپی شد');
    } catch {
      showToast('کپی لینک ممکن نشد');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${article.title} — ویکی تپش`, url: articleLink() });
      } catch {
        /* کاربر اشتراک را لغو کرد */
      }
      return;
    }
    handleCopy();
  };

  return (
    <div className="wiki-article" style={{ '--accent': accent }}>
      <div className="wiki-topbar">
        <button type="button" className="wiki-topbar__back" onClick={onBack}>
          <Icon name="back" size={17} />
          {originLabel}
        </button>
        <span className="wiki-topbar__crumb">
          ویکی تپش / {api.subjectLabel(article.subject)} / {article.title}
        </span>
      </div>

      {/* ── سربرگ مقاله ── */}
      <header className="wiki-article__header">
        <div className="wiki-article__chips">
          <TypeBadge type={article.type} subject={article.subject} />
          <SubjectTag subject={article.subject} />
          <Chip plain>{article.topic}</Chip>
        </div>

        <h1>{article.title}</h1>
        <p className="wiki-article__english" dir="ltr">
          {article.englishTitle}
          {article.abbreviations.length > 0 && (
            <span className="wiki-article__abbr"> · {article.abbreviations.join(' · ')}</span>
          )}
        </p>

        {article.aliases.length > 0 && (
          <p className="wiki-article__aliases">
            <span>سایر نام‌ها:</span>
            {article.aliases.slice(0, 4).map((alias) => (
              <Chip key={alias} plain>
                {alias}
              </Chip>
            ))}
          </p>
        )}

        <div className="wiki-article__metarow">
          <DifficultyBadge difficulty={article.difficulty} />
          <span className="wiki-article__metaitem">
            <Icon name="clock" size={15} />
            {toFa(article.readMinutes)} دقیقه مطالعه
          </span>
          <span className="wiki-article__metaitem">
            <Icon name="history" size={15} />
            به‌روزرسانی: {api.formatRelativeDays(article.lastUpdated)}
          </span>

          <div className="wiki-article__actions">
            <button
              type="button"
              className={`wiki-action-btn ${bookmarked ? 'is-active' : ''}`}
              aria-pressed={bookmarked}
              onClick={handleBookmark}
            >
              <Icon name={bookmarked ? 'bookmarkFilled' : 'bookmark'} size={16} />
              {bookmarked ? 'ذخیره شد' : 'ذخیره'}
            </button>
            <button type="button" className="wiki-action-btn" onClick={handleCopy}>
              <Icon name="copy" size={16} />
              کپی لینک
            </button>
            <button type="button" className="wiki-action-btn" onClick={handleShare}>
              <Icon name="share" size={16} />
              اشتراک
            </button>
          </div>
        </div>
      </header>

      {/* فهرست مطالب موبایل — بالای محتوا */}
      <TableOfContents
        mobile
        sections={article.sections}
        activeId={activeId}
        onJump={jumpTo}
      />

      <div className="wiki-article__body">
        {/* ── ستون محتوا ── */}
        <main className="wiki-article__main">
          <p className="wiki-article__lead">{article.summary}</p>

          {article.sections.map((section) => (
            <section key={section.id} id={`wiki-sec-${section.id}`} className="wiki-article__section">
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <ContentBlock key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}

          {/* ── شبکه دانش ── */}
          <KnowledgeGraph
            center={article}
            related={related}
            backlinks={backlinks}
            onOpen={(targetSlug) => onOpenArticle(targetSlug, { from: 'article' })}
          />

          {/* ── موضوعات مرتبط (کارت‌های سبک) ── */}
          {(related.length > 0 || backlinks.length > 0) && (
            <section className="wiki-related" aria-label="موضوعات مرتبط">
              <h2>موضوعات مرتبط را کشف کن</h2>
              <div className="wiki-related__grid">
                {[...related, ...backlinks].map((node, index) => (
                  <button
                    key={`${node.slug}-${node.side ?? ''}-${index}`}
                    type="button"
                    className="wiki-related__card"
                    style={{ '--accent': api.subjectAccent(node.subject) }}
                    onClick={() => onOpenArticle(node.slug, { from: 'article' })}
                  >
                    <span className="wiki-related__relation">{node.relationLabel}</span>
                    <strong>{node.title}</strong>
                    <span className="wiki-related__english">{node.englishTitle}</span>
                    <p>{node.summary}</p>
                    <GoArrow />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── ارجاعات ── */}
          {article.references.length > 0 && (
            <section className="wiki-references" aria-label="منابع">
              <h2>منابع</h2>
              <ol>
                {article.references.map((reference) => (
                  <li key={reference} dir="ltr">
                    {reference}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </main>

        {/* ── ستون کنار: فهرست + نکات کلیدی ── */}
        <aside className="wiki-article__rail">
          <TableOfContents sections={article.sections} activeId={activeId} onJump={jumpTo} />

          {article.keyFacts.length > 0 && (
            <div className="wiki-keyfacts" style={{ '--accent': accent }}>
              <h4>
                <Icon name="sparkle" size={15} />
                نکات کلیدی
              </h4>
              <ul>
                {article.keyFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* ── بازگشت به بالا ── */}
      {showBackToTop && (
        <button
          type="button"
          className="wiki-back-to-top"
          aria-label="بازگشت به بالای مقاله"
          onClick={() => {
            const container = getWikiScrollContainer();
            if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Icon name="arrowUp" size={17} />
        </button>
      )}

      {/* ── اعلان کوتاه ── */}
      {toast && (
        <div className="wiki-toast" role="status">
          <Icon name="check" size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
