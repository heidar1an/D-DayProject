/* صفحه مطالعه مقاله: تایپوگرافی متمرکز، پیشرفت مطالعه، هایلایت/یادداشت، حالت فوکوس،
   فهرست هوشمند، اتصال به یادگیری و مقالات مرتبط */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  getArticleBySlug,
  getRelatedArticles,
  getArticlesByAuthor,
  categoryAccent,
  categoryLabel,
  getAuthorById,
} from '../../services/articles/articlesService';
import {
  addHighlight,
  ensureStarted,
  getProgress,
  removeHighlight,
  saveProgress,
  toggleBookmark,
} from '../../services/articles/userState';
import {
  ArticleCard,
  ArticleCover,
  BookmarkIcon,
  ChevronIcon,
  CopyIcon,
  FocusIcon,
  HighlighterIcon,
  LinkIcon,
  NoteIcon,
  Rich,
  RichWithHighlights,
  SearchIcon,
  TelegramIcon,
  TrashIcon,
  WhatsAppIcon,
  XIcon,
  faDate,
  faPercent,
  toFa,
  useArticleHighlights,
  usePageMeta,
  useUserArticleState,
} from './articlesShared';

/* ── نوار پیشرفت مطالعه: بسیار نازک، بالای صفحه، بدون مزاحمت ── */
function ReadingProgress({ onRatioChange }) {
  const barRef = useRef(null);
  const ratioRef = useRef(0);

  useEffect(() => {
    const update = () => {
      const bar = barRef.current;
      if (!bar) return;

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
      bar.style.transform = `scaleX(${ratio})`;

      if (Math.abs(ratio - ratioRef.current) > 0.005) {
        ratioRef.current = ratio;
        onRatioChange?.(ratio);
      }
    };

    update();
    /* رویداد scroll خودش با نرخ فریم می‌آید؛ آپدیت مستقیم سبک و مطمئن‌تر است */
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [onRatioChange]);

  return (
    <div className="ap-progress" aria-hidden="true">
      <span ref={barRef} />
    </div>
  );
}

const SHARE_NETWORKS = [
  { key: 'telegram', label: 'اشتراک در تلگرام', Icon: TelegramIcon, build: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { key: 'whatsapp', label: 'اشتراک در واتس‌اپ', Icon: WhatsAppIcon, build: (url, title) => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} ${url}`)}` },
  { key: 'x', label: 'اشتراک در ایکس', Icon: XIcon, build: (url, title) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
];

function ShareRow({ title }) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const copyLink = async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* مرورگرهای قدیمی‌تر: مسیر جایگزین */
      const helper = document.createElement('textarea');
      helper.value = url;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }

    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ap-share">
      <span className="ap-share__label">اشتراک‌گذاری</span>
      <div className="ap-share__row">
        {SHARE_NETWORKS.map(({ key, label, Icon, build }) => (
          <a key={key} className="ap-share__button" href={build(window.location.href, title)} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
            <Icon />
          </a>
        ))}
        <button type="button" className={`ap-share__button ${copied ? 'is-copied' : ''}`} onClick={copyLink} aria-live="polite" aria-label="کپی لینک مقاله" title="کپی لینک">
          {copied ? <span className="ap-share__copied">کپی شد</span> : <LinkIcon />}
        </button>
      </div>
    </div>
  );
}

/* ── فهرست مطالب: دسکتاپ چسبان، موبایل جمع‌شونده ── */
function TocList({ items, activeId, onJump }) {
  return (
    <ol className="ap-toc__list">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={activeId === item.id ? 'is-active' : ''}
            aria-current={activeId === item.id ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onJump(item.id);
            }}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

function TableOfContents({ items, activeId, onJump, variant }) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) return null;

  const heading = (
    <>
      <span className="ap-toc__title">در این مقاله می‌خوانید</span>
      {variant === 'mobile' && (
        <span className={`ap-toc__chevron ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
          <ChevronIcon />
        </span>
      )}
    </>
  );

  return (
    <nav className={`ap-toc ap-toc--${variant}`} aria-label="فهرست مطالب مقاله">
      {variant === 'mobile' ? (
        <>
          <button type="button" className="ap-toc__toggle" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
            {heading}
          </button>
          <div className={`ap-toc__collapse ${isOpen ? 'is-open' : ''}`}>
            <TocList items={items} activeId={activeId} onJump={onJump} />
          </div>
        </>
      ) : (
        <>
          {heading}
          <TocList items={items} activeId={activeId} onJump={onJump} />
        </>
      )}
    </nav>
  );
}

/* ── بلوک سوال آموزشی: پل مقاله → یادگیری ── */
function QuestionBlock({ block }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside className={`ap-question ${isOpen ? 'is-open' : ''}`}>
      <span className="ap-question__label">سوال</span>
      <p className="ap-question__text">{block.question}</p>
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        {isOpen ? 'پنهان‌کردن پاسخ' : 'نمایش پاسخ'}
        <span className={`ap-question__chevron ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
      <div className="ap-question__collapse">
        <div className="ap-question__answer">
          <Rich text={block.answer} />
        </div>
      </div>
    </aside>
  );
}

/* ── رندر بلوک‌های محتوا با پشتیبانی هایلایت ── */
const CALLOUT_LABELS = {
  important: 'نکته مهم',
  exam: 'نقطه امتحانی',
  clinical: 'ارتباط بالینی',
  warning: 'هشدار',
  definition: 'تعریف',
};

function HighlightableText({ blockId, text, highlights }) {
  const blockHighlights = useMemo(
    () => highlights.filter((item) => item.blockId === blockId),
    [highlights, blockId],
  );

  return <RichWithHighlights text={text} highlights={blockHighlights} />;
}

function ContentBlocks({ blocks, highlights }) {
  let headingIndex = 0;

  return blocks.map((block, index) => {
    switch (block.type) {
      case 'h2': {
        const id = `sec-${headingIndex}`;
        headingIndex += 1;
        return (
          <h2 key={index} id={id} data-block-id={index}>
            <HighlightableText blockId={index} text={block.text} highlights={highlights} />
          </h2>
        );
      }
      case 'h3':
        return (
          <h3 key={index} data-block-id={index}>
            <HighlightableText blockId={index} text={block.text} highlights={highlights} />
          </h3>
        );
      case 'p':
        return (
          <p key={index} data-block-id={index}>
            <HighlightableText blockId={index} text={block.text} highlights={highlights} />
          </p>
        );
      case 'quote':
        return (
          <blockquote key={index} data-block-id={index}>
            <p>
              <HighlightableText blockId={index} text={block.text} highlights={highlights} />
            </p>
            {block.cite && <cite>{block.cite}</cite>}
          </blockquote>
        );
      case 'list':
        return (
          <ul key={index} data-block-id={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <HighlightableText blockId={index} text={item} highlights={highlights} />
              </li>
            ))}
          </ul>
        );
      case 'olist':
        return (
          <ol key={index} data-block-id={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <HighlightableText blockId={index} text={item} highlights={highlights} />
              </li>
            ))}
          </ol>
        );
      case 'callout':
        return (
          <aside key={index} className={`ap-callout ap-callout--${block.variant}`} data-block-id={index}>
            <strong className="ap-callout__label">{block.title ?? CALLOUT_LABELS[block.variant] ?? 'نکته'}</strong>
            <p>
              <HighlightableText blockId={index} text={block.text} highlights={highlights} />
            </p>
          </aside>
        );
      case 'question':
        return <QuestionBlock key={index} block={block} />;
      case 'divider':
        return <hr key={index} className="ap-divider" />;
      case 'table':
        return (
          <div key={index} className="ap-table-wrap">
            <table>
              <caption>{block.caption}</caption>
              <thead>
                <tr>
                  {block.head.map((cell, cellIndex) => (
                    <th key={cellIndex} scope="col">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'image':
        return (
          <figure key={index} className="ap-figure">
            <img src={block.src} alt={block.alt ?? ''} loading="lazy" />
            {block.caption && <figcaption>{block.caption}</figcaption>}
          </figure>
        );
      default:
        return null;
    }
  });
}

/* ── Popover انتخاب متن: هایلایت، یادداشت، کپی ── */
function SelectionPopover({ anchor, mode, note, busy, onHighlight, onCopy, onSwitchToNote, onNoteChange, onNoteSave, onClose }) {
  if (!anchor) return null;

  if (mode === 'note') {
    return (
      <div className="ap-selection-popover ap-selection-popover--note" style={{ top: anchor.top, left: anchor.left }}>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="یادداشتت را بنویس..."
          rows={3}
          autoFocus
        />
        <div className="ap-selection-popover__actions">
          <button type="button" className="is-primary" onClick={onNoteSave} disabled={busy || note.trim().length === 0}>
            ذخیره یادداشت
          </button>
          <button type="button" onClick={onClose}>
            انصراف
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-selection-popover" style={{ top: anchor.top, left: anchor.left }} role="toolbar" aria-label="ابزار متن انتخاب‌شده">
      <button type="button" onClick={onHighlight} disabled={busy}>
        <HighlighterIcon />
        هایلایت
      </button>
      <button type="button" onClick={onSwitchToNote} disabled={busy}>
        <NoteIcon />
        یادداشت
      </button>
      <button type="button" onClick={onCopy} disabled={busy}>
        <CopyIcon />
        کپی
      </button>
    </div>
  );
}

/* ── اسکلت بارگذاری مقاله ── */
function ArticleSkeleton() {
  return (
    <div className="ap-article-skeleton ap-layer-reveal" aria-hidden="true">
      <div className="ap-shell">
        <div className="ap-article-skeleton__inner">
          <span className="ap-skeleton-line" style={{ width: '120px' }} />
          <span className="ap-skeleton-line ap-skeleton-line--title" />
          <span className="ap-skeleton-line" style={{ width: '70%' }} />
          <span className="ap-skeleton-line" style={{ width: '45%' }} />
          <div className="ap-skeleton-block" />
          <div className="ap-skeleton-block" style={{ width: '60%' }} />
          <div className="ap-skeleton-block" />
        </div>
      </div>
    </div>
  );
}

function ArticleNotFound() {
  return (
    <main className="articles-page">
      <div className="ap-shell">
        <div className="ap-empty ap-empty--page">
          <span className="ap-empty__icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <h3>مقاله‌ای که دنبالش بودی پیدا نشد.</h3>
          <p>ممکن است آدرس تغییر کرده باشد؛ از فهرست مقالات سر بزن.</p>
          <a href="#articles">بازگشت به مقالات</a>
        </div>
      </div>
    </main>
  );
}

/* محدوده مجاز انتخاب متن برای هایلایت */
const HIGHLIGHTABLE_SELECTOR = '[data-block-id]';

function getPlainOffset(blockEl, boundary, isStart) {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();

  while (node) {
    if (node === (isStart ? boundary.startContainer : boundary.endContainer)) {
      return offset + (isStart ? boundary.startOffset : boundary.endOffset);
    }
    offset += node.textContent.length;
    node = walker.nextNode();
  }

  return null;
}

export default function ArticlePage({ slug }) {
  const [article, setArticle] = useState(null); // null: در حال بارگذاری، undefined: پیدا نشد
  const [related, setRelated] = useState(null);
  const [activeHeading, setActiveHeading] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const contentRef = useRef(null);

  /* ادامه مطالعه */
  const savedProgressRef = useRef(0);
  const [resumeOffer, setResumeOffer] = useState(null); // { progress }
  const userEntry = useUserArticleState(article?.id);

  /* انتخاب متن و popover */
  const [selection, setSelection] = useState(null); // { top, left, blockId, start, end, text }
  const [noteMode, setNoteMode] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const highlights = useArticleHighlights(article?.id);

  useEffect(() => {
    let isActive = true;
    setArticle(null);
    setRelated(null);
    setActiveHeading(null);
    setSelection(null);
    setResumeOffer(null);

    getArticleBySlug(slug).then(async (found) => {
      if (!isActive) return;
      setArticle(found ?? undefined);
      if (found) {
        ensureStarted(found.id);
        const saved = getProgress(found.id);
        savedProgressRef.current = saved;
        if (saved > 0.04 && saved < 0.9) setResumeOffer({ progress: saved });
        setRelated(await getRelatedArticles(found, 3));
      }
    });

    return () => {
      isActive = false;
    };
  }, [slug]);

  /* ذخیره پیشرفت (throttle سمت والد با rAF در ReadingProgress انجام می‌شود) */
  const handleProgress = useMemo(
    () => (ratio) => {
      if (!article) return;
      saveProgress(article.id, ratio, { silent: true });
    },
    [article],
  );

  /* فهرست مطالب از همین ایندکس‌بلوک‌های h2 که در رندر استفاده می‌شود */
  const tocItems = useMemo(() => {
    if (!article) return [];
    return article.content
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'h2')
      .map(({ block }, order) => ({ id: `sec-${order}`, text: block.text }));
  }, [article]);

  const jumpToHeading = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* اسکرول‌اسپای: مشخص‌کردن تیتر فعال هنگام مطالعه */
  useEffect(() => {
    if (!article || tocItems.length === 0) return undefined;

    let ticking = false;

    const update = () => {
      ticking = false;
      const container = contentRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      let current = null;

      tocItems.forEach((item) => {
        const element = document.getElementById(item.id);
        if (!element) return;
        if (element.getBoundingClientRect().top <= containerRect.top + 140) {
          current = item.id;
        }
      });

      setActiveHeading(current);
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });

    return () => window.removeEventListener('scroll', requestUpdate);
  }, [article, tocItems]);

  /* حالت فوکوس: پنهان‌کردن عناصر غیرمطالعه */
  useEffect(() => {
    if (!focusMode) return undefined;

    document.body.classList.add('ap-reading-mode');
    return () => document.body.classList.remove('ap-reading-mode');
  }, [focusMode]);

  /* Popover انتخاب متن */
  useEffect(() => {
    if (!article) return undefined;

    const onPointerUp = (event) => {
      if (event.target.closest('.ap-selection-popover')) return;

      const activeSelection = window.getSelection();
      if (!activeSelection || activeSelection.isCollapsed) {
        if (!event.target.closest('.ap-selection-popover')) setSelection(null);
        return;
      }

      const range = activeSelection.getRangeAt(0);
      const blockEl = range.commonAncestorContainer.parentElement?.closest(HIGHLIGHTABLE_SELECTOR);
      if (!blockEl || !contentRef.current?.contains(blockEl)) {
        setSelection(null);
        return;
      }

      const text = activeSelection.toString().trim();
      if (text.length < 3) {
        setSelection(null);
        return;
      }

      const start = getPlainOffset(blockEl, range, true);
      const end = getPlainOffset(blockEl, range, false);
      if (start === null || end === null || end <= start) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      setNoteMode(false);
      setNoteDraft('');
      setSelection({
        top: Math.max(rect.top - 52, 12),
        left: Math.max(Math.min(rect.left + rect.width / 2, window.innerWidth - 150), 150),
        blockId: Number(blockEl.dataset.blockId),
        start,
        end,
        text,
        center: rect.left + rect.width / 2,
      });
    };

    const onScrollHide = () => {
      setSelection((current) => (current && !noteMode ? null : current));
    };

    document.addEventListener('pointerup', onPointerUp);
    window.addEventListener('scroll', onScrollHide, { passive: true });

    return () => {
      document.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('scroll', onScrollHide);
    };
  }, [article, noteMode]);

  const popoverLeft = selection ? Math.min(Math.max(selection.center, 170), window.innerWidth - 170) : 0;

  const createHighlight = (withNote = false) => {
    if (!selection || !article) return;
    setBusy(true);
    addHighlight(article.id, {
      blockId: selection.blockId,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      note: withNote ? noteDraft.trim() : null,
    });
    setBusy(false);
    setSelection(null);
    setNoteMode(false);
    setNoteDraft('');
    window.getSelection()?.removeAllRanges();
  };

  const copySelection = async () => {
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection.text);
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 1600);
    } catch {
      /* بی‌صدا */
    }
    setSelection(null);
  };

  const jumpToSavedPosition = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: savedProgressRef.current * maxScroll, behavior: 'smooth' });
    setResumeOffer(null);
  };

  const jsonLd = article
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt ?? article.publishedAt,
        inLanguage: 'fa-IR',
        author: { '@type': 'Person', name: getAuthorById(article.author)?.name ?? 'تیم تپش' },
        publisher: { '@type': 'Organization', name: 'تپش' },
        mainEntityOfPage: `${window.location.origin}/#${window.location.hash}`,
      }
    : null;

  usePageMeta({
    title: article ? `${article.title} | مقالات تپش` : null,
    description: article?.excerpt,
    ogType: 'article',
    path: `/#articles/${slug}`,
    jsonLd,
  });

  if (article === undefined) return <ArticleNotFound />;

  if (!article) return <ArticleSkeleton />;

  const author = getAuthorById(article.author);
  const authorArticles = author ? getArticlesByAuthor(author.id, { excludeSlug: article.slug }).slice(0, 2) : [];
  const bookmarked = Boolean(userEntry?.bookmarked);
  const currentProgress = userEntry?.progress ?? 0;

  return (
    <main className={`ap-article ap-layer-reveal${focusMode ? ' ap-article--focus' : ''}`} key={slug}>
      <ReadingProgress onRatioChange={handleProgress} />

      <article className="ap-stagger">
        <header className="ap-article__header ap-shell">
          <a className="ap-back" href="#articles">
            <span aria-hidden="true">→</span>
            همه مقالات
          </a>
          <div className="ap-article__head-row">
            <div className="ap-article__head-main">
              <span className={`ap-card__category ap-card__category--${categoryAccent(article.category)}`}>
                {categoryLabel(article.category)}
              </span>
              <h1>{article.title}</h1>
              <p className="ap-article__lead">{article.excerpt}</p>
            </div>
          </div>
          <div className="ap-article__meta">
            {author && (
              <span className={`ap-author-chip ap-author-chip--${author.accent}`}>
                <span className="ap-author-chip__avatar" aria-hidden="true">
                  {author.initials}
                </span>
                {author.name}
              </span>
            )}
            <span className="ap-article__meta-item">
              <time dateTime={article.publishedAt}>{faDate(article.publishedAt)}</time>
            </span>
            <span className="ap-article__meta-item" aria-hidden="true">·</span>
            <span className="ap-article__meta-item">{toFa(article.readingTime)} دقیقه مطالعه</span>
            {article.updatedAt && (
              <span className="ap-article__meta-item">بروزرسانی {faDate(article.updatedAt)}</span>
            )}
          </div>
          <div className="ap-article__toolbar">
            <button
              type="button"
              className={`ap-tool-button${bookmarked ? ' is-active' : ''}`}
              aria-pressed={bookmarked}
              onClick={() => toggleBookmark(article.id)}
            >
              <BookmarkIcon filled={bookmarked} />
              {bookmarked ? 'ذخیره شد' : 'ذخیره'}
            </button>
            <button
              type="button"
              className={`ap-tool-button${focusMode ? ' is-active' : ''}`}
              aria-pressed={focusMode}
              onClick={() => setFocusMode((value) => !value)}
            >
              <FocusIcon />
              {focusMode ? 'خروج از حالت مطالعه' : 'حالت مطالعه'}
            </button>
            {currentProgress > 0.02 && (
              <span className="ap-tool-progress" aria-label={`پیشرفت مطالعه ${faPercent(currentProgress)}`}>
                {currentProgress >= 0.95 ? 'خوانده شد' : `${faPercent(currentProgress)} خوانده شده`}
              </span>
            )}
          </div>
        </header>

        <figure className={`ap-article__cover ap-shell${article.coverFit === 'contain' ? ` ap-article__cover--tint ap-cover-art--${categoryAccent(article.category)}` : ''}`}>
          <ArticleCover article={article} eager />
        </figure>

        <div className="ap-article__layout ap-shell">
          <div className="ap-article__content" ref={contentRef}>
            <TableOfContents items={tocItems} activeId={activeHeading} onJump={jumpToHeading} variant="mobile" />

            <div className="ap-article__blocks">
              <ContentBlocks blocks={article.content} highlights={highlights} />
            </div>

            {highlights.length > 0 && (
              <section className="ap-notes" aria-label="نکته‌ها و یادداشت‌های من">
                <h3>نکته‌ها و یادداشت‌های من</h3>
                <ul>
                  {highlights.map((item) => (
                    <li key={item.id}>
                      <blockquote>«{item.text}»</blockquote>
                      {item.note && <p className="ap-notes__note">{item.note}</p>}
                      <button
                        type="button"
                        className="ap-notes__remove"
                        aria-label="حذف هایلایت"
                        onClick={() => removeHighlight(article.id, item.id)}
                      >
                        <TrashIcon />
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {article.tags.length > 0 && (
              <div className="ap-tags" aria-label="موضوع‌های مرتبط">
                {article.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      window.sessionStorage.setItem('tapesh:articles:pendingQuery', tag);
                      window.location.hash = 'articles';
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            <div className="ap-share-inline">
              <ShareRow title={article.title} />
            </div>

            {author && (
              <section className="ap-author" aria-label="درباره نویسنده">
                <span className={`ap-author__avatar ap-author__avatar--${author.accent}`} aria-hidden="true">
                  {author.initials}
                </span>
                <div>
                  <strong>{author.name}</strong>
                  <span className="ap-author__role">{author.role}</span>
                  <p>{author.bio}</p>
                  {authorArticles.length > 0 && (
                    <div className="ap-author__more">
                      <span>از همین نویسنده:</span>
                      {authorArticles.map((item) => (
                        <a href={`#articles/${item.slug}`} key={item.slug}>
                          {item.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            <aside className="ap-learning">
              <h3>می‌خواهی این موضوع را عمیق‌تر یاد بگیری؟</h3>
              <p>
                {article.learning
                  ? `این مقاله بخشی از مسیر «${article.learning.topic}» در تپش است.`
                  : 'همین مسیر در درسنامه‌ها و بانک تست تپش ادامه دارد.'}
              </p>
              <div className="ap-learning__links">
                <a href="#courses">
                  <span>{article.learning?.lessonTitle ?? 'درسنامه‌های جامع تپش'}</span>
                  <span className="ap-learning__hint" aria-hidden="true">←</span>
                </a>
                {article.learning?.questions > 0 && (
                  <a href="#courses">
                    <span>{toFa(article.learning.questions)} تست مرتبط</span>
                    <span className="ap-learning__hint" aria-hidden="true">←</span>
                  </a>
                )}
                {article.learning?.flashcards > 0 && (
                  <a href="#courses">
                    <span>{toFa(article.learning.flashcards)} فلش‌کارت مرتبط</span>
                    <span className="ap-learning__hint" aria-hidden="true">←</span>
                  </a>
                )}
              </div>
            </aside>
          </div>

          <aside className="ap-article__aside">
            <div className="ap-article__aside-sticky">
              <TableOfContents items={tocItems} activeId={activeHeading} onJump={jumpToHeading} variant="desktop" />
              <ShareRow title={article.title} />
            </div>
          </aside>
        </div>

        {related && related.length > 0 && (
          <section className="ap-related ap-shell" aria-labelledby="ap-related-title">
            <h2 id="ap-related-title">شاید این‌ها هم برایت جالب باشد</h2>
            <div className="ap-related__grid">
              {related.map((item) => (
                <ArticleCard key={item.slug} article={item} showAuthor={false} />
              ))}
            </div>
          </section>
        )}
      </article>

      {focusMode && (
        <button type="button" className="ap-focus-exit" onClick={() => setFocusMode(false)}>
          خروج از حالت مطالعه
        </button>
      )}

      {resumeOffer && !focusMode && (
        <div className="ap-resume" role="status">
          <span>ادامه مطالعه از {faPercent(resumeOffer.progress)}</span>
          <button type="button" onClick={jumpToSavedPosition}>
            ادامه بده
          </button>
          <button type="button" className="ap-resume__close" aria-label="بستن" onClick={() => setResumeOffer(null)}>
            ×
          </button>
        </div>
      )}

      {selection && (
        <SelectionPopover
          anchor={{ top: selection.top, left: popoverLeft }}
          mode={noteMode ? 'note' : 'actions'}
          note={noteDraft}
          busy={busy}
          onHighlight={() => createHighlight(false)}
          onCopy={copySelection}
          onSwitchToNote={() => setNoteMode(true)}
          onNoteChange={setNoteDraft}
          onNoteSave={() => createHighlight(true)}
          onClose={() => {
            setSelection(null);
            setNoteMode(false);
          }}
        />
      )}

      {copiedFeedback && (
        <div className="ap-toast" role="status">
          متن کپی شد
        </div>
      )}
    </main>
  );
}
