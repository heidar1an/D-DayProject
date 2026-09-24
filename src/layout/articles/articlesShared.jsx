/* اجزای مشترک بخش مقالات: کارت Masonry، کاور، آیکون‌ها، متادیتا، هایلایت متن و ابزار اعداد فارسی */

import { useEffect, useSyncExternalStore } from 'react';

import heartbeatMark from '../../../images/pictures/600ppi/logo-mark.webp';
import { categoryAccent, categoryLabel, getAuthorById } from '../../services/articles/articlesService';
import { getArticleHighlights, getArticleUserState, subscribe, toggleBookmark } from '../../services/articles/userState';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

export const faDate = (isoDate) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long' }).format(new Date(`${isoDate}T00:00:00`));

export const faNumber = (value) => new Intl.NumberFormat('fa-IR').format(value);

export const faCompact = (value) =>
  new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/* درصد فارسی؛ ورودی ۰ تا ۱ */
export const faPercent = (ratio) => `${toFa(Math.round(ratio * 100))}٪`;

export const SITE_TITLE = 'تپش | یادگیری پزشکی ساده‌تر';
export const SITE_DESCRIPTION = 'تپش؛ پلتفرم یادگیری پزشکی و آمادگی برای آزمون‌های علوم پزشکی';

const BASE_ORIGIN = typeof window === 'undefined' ? '' : window.location.origin;

/* ── متادیتای صفحه: عنوان، توضیح، Open Graph، canonical و داده ساختاریافته ── */
export function usePageMeta({ title, description, ogType = 'website', path, jsonLd } = {}) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  /* عنوان هر صفحه روی توقف/سوییچ بروز می‌شود و فقط هنگام خروج کامل به پیش‌فرض برمی‌گردد */
  useEffect(() => {
    document.title = title ?? SITE_TITLE;

    const createdNodes = [];

    const ensureMeta = (attribute, key, content) => {
      if (!content) return;
      let node = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!node) {
        node = document.createElement('meta');
        node.setAttribute(attribute, key);
        document.head.appendChild(node);
        createdNodes.push(node);
      }
      node.setAttribute('content', content);
    };

    if (description) ensureMeta('name', 'description', description);
    ensureMeta('property', 'og:type', ogType);
    if (title) ensureMeta('property', 'og:title', title);
    if (description) ensureMeta('property', 'og:description', description);
    ensureMeta('property', 'og:locale', 'fa_IR');
    ensureMeta('property', 'og:site_name', 'تپش');

    let canonicalNode = null;
    if (path) {
      canonicalNode = document.head.querySelector('link[rel="canonical"]');
      if (!canonicalNode) {
        canonicalNode = document.createElement('link');
        canonicalNode.rel = 'canonical';
        document.head.appendChild(canonicalNode);
        createdNodes.push(canonicalNode);
      }
      canonicalNode.href = `${BASE_ORIGIN}${path}`;
    }

    let jsonLdNode = null;
    if (jsonLdKey) {
      jsonLdNode = document.createElement('script');
      jsonLdNode.type = 'application/ld+json';
      jsonLdNode.textContent = jsonLdKey;
      document.head.appendChild(jsonLdNode);
      createdNodes.push(jsonLdNode);
    }

    return () => {
      createdNodes.forEach((node) => node.remove());
    };
  }, [title, description, ogType, path, jsonLdKey]);

  useEffect(() => () => {
    document.title = SITE_TITLE;
  }, []);
}

/* ── وضعیت کاربر روی یک مقاله (بوکمارک/پیشرفت) به‌صورت reactive ── */
export function useUserArticleState(articleId) {
  return useSyncExternalStore(
    subscribe,
    () => getArticleUserState(articleId),
    () => null,
  );
}

export function useArticleHighlights(articleId) {
  return useSyncExternalStore(
    subscribe,
    () => getArticleHighlights(articleId),
    () => [],
  );
}

/* ── متن با پشتیبانی **درشت** و *مورب* ── */
const RICH_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

function renderInline(parts) {
  return parts.map((part, index) => {
    if (part.bold) return <strong key={index}>{part.text}</strong>;
    if (part.italic) return <em key={index}>{part.text}</em>;
    return <span key={index}>{part.text}</span>;
  });
}

export function Rich({ text }) {
  const parts = String(text)
    .split(RICH_PATTERN)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { text: part.slice(2, -2), bold: true };
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return { text: part.slice(1, -1), italic: true };
      }
      return { text: part };
    });

  return <>{renderInline(parts)}</>;
}

/*
 * نسخه هایلایت‌پذیر Rich:
 * متن خام به توکن‌های موقعیت‌دار تبدیل می‌شود (موقعیت روی «متن سادهٔ رندرشده» است،
 * همان اندیسی که هنگام انتخاب متن کاربر از DOM خوانده می‌شود) و بازه‌های
 * هایلایت‌شده داخل <mark> پیچیده می‌شوند.
 */
export function RichWithHighlights({ text, highlights }) {
  if (!highlights?.length) return <Rich text={text} />;

  const raw = String(text);

  /* توکن‌ها با موقعیت ابتدا و انتهای متن ساده */
  const tokens = [];
  let plainLength = 0;

  raw.split(RICH_PATTERN).forEach((chunk) => {
    if (!chunk) return;
    let bold = false;
    let italic = false;
    let content = chunk;

    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      bold = true;
      content = chunk.slice(2, -2);
    } else if (chunk.startsWith('*') && chunk.endsWith('*')) {
      italic = true;
      content = chunk.slice(1, -1);
    }

    tokens.push({
      text: content,
      bold,
      italic,
      start: plainLength,
      end: plainLength + content.length,
    });
    plainLength += content.length;
  });

  /* مرزهای برش: ابتدا/انتهای هر هایلایت */
  const bounds = new Set([0, plainLength]);
  highlights.forEach(({ start, end }) => {
    bounds.add(Math.max(0, Math.min(start, plainLength)));
    bounds.add(Math.max(0, Math.min(end, plainLength)));
  });
  const cuts = [...bounds].sort((a, b) => a - b);

  const isMarked = (position) =>
    highlights.some(({ start, end }) => position >= start && position < end);

  const output = [];
  let markedRun = null;

  tokens.forEach((token) => {
    /* برش توکن روی مرزها */
    let pieceStart = token.start;
    while (pieceStart < token.end) {
      const nextCut = cuts.find((cut) => cut > pieceStart) ?? token.end;
      const pieceEnd = Math.min(nextCut, token.end);
      const pieceText = token.text.slice(pieceStart - token.start, pieceEnd - token.start);
      const piece = { text: pieceText, bold: token.bold, italic: token.italic, marked: isMarked(pieceStart) };

      if (piece.marked) {
        markedRun = markedRun ?? [];
        markedRun.push(piece);
      } else {
        if (markedRun) {
          output.push({ marked: true, parts: markedRun });
          markedRun = null;
        }
        output.push({ marked: false, parts: [piece] });
      }

      pieceStart = pieceEnd;
    }
  });

  if (markedRun) {
    output.push({ marked: true, parts: markedRun });
  }

  return (
    <>
      {output.map((group, groupIndex) =>
        group.marked ? (
          /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
          <mark key={groupIndex} className="ap-hl">
            {renderInline(group.parts)}
          </mark>
        ) : (
          <span key={groupIndex}>{renderInline(group.parts)}</span>
        ),
      )}
    </>
  );
}

/* ── نشان برند روی کاور جایگزین (پس‌زمینه گرادیان از والد می‌آید) ── */
export function CoverMark() {
  return <img className="ap-cover-art__mark" src={heartbeatMark} alt="" loading="lazy" />;
}

export function ArticleCover({ article, eager = false }) {
  if (article.cover) {
    return (
      <img
        className={`ap-cover-img${article.coverFit === 'contain' ? ' ap-cover-img--contain' : ''}`}
        src={article.cover}
        alt={article.coverAlt ?? ''}
        loading={eager ? 'eager' : 'lazy'}
      />
    );
  }
  return <CoverMark />;
}

/* ── کارت مقاله برای چیدمان Masonry ──
 * تصویر و عنوان قهرمان کارت‌اند؛ متادیتا ظریف است و بوکمارک روی hover/لمس ظاهر می‌شود.
 */
export function ArticleCard({ article, showAuthor = true }) {
  const userEntry = useUserArticleState(article.id);
  const bookmarked = Boolean(userEntry?.bookmarked);
  const progress = userEntry?.progress ?? 0;
  const completed = Boolean(userEntry?.completedAt);
  const author = showAuthor ? getAuthorById(article.author) : null;

  return (
    <article className={`ap-card${article.cover ? '' : ' ap-card--art'}`}>
      <a className="ap-card__link" href={`#articles/${article.slug}`} aria-label={`مطالعه مقاله ${article.title}`}>
        <div
          className={`ap-card__media ap-cover-art--${categoryAccent(article.category)}`}
          style={{ '--ap-ratio': article.coverRatio ?? '16 / 10' }}
        >
          <ArticleCover article={article} />
          {completed && (
            <span className="ap-card__state" aria-label="خوانده‌شده">
              <CheckIcon />
              خوانده شد
            </span>
          )}
        </div>
        <div className="ap-card__body">
          <span className={`ap-card__category ap-card__category--${categoryAccent(article.category)}`}>
            {categoryLabel(article.category)}
          </span>
          <h3 className="ap-card__title">{article.title}</h3>
          <p className="ap-card__excerpt">{article.excerpt}</p>
          <div className="ap-card__meta">
            {author && (
              <span className="ap-card__author" title={author.name}>
                <span className={`ap-author-chip__avatar ap-author-chip__avatar--${author.accent}`} aria-hidden="true">
                  {author.initials}
                </span>
                {author.name}
              </span>
            )}
            <span className="ap-card__dot" aria-hidden="true">
              ·
            </span>
            <span>{toFa(article.readingTime)} دقیقه</span>
            <span className="ap-card__views" title="بازدید">
              <EyeIcon />
              {faCompact(article.views)}
            </span>
          </div>
        </div>
      </a>

      <button
        type="button"
        className={`ap-card__bookmark${bookmarked ? ' is-active' : ''}`}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? `حذف ${article.title} از لیست مطالعه` : `ذخیره ${article.title} در لیست مطالعه`}
        title={bookmarked ? 'حذف از ذخیره‌شده‌ها' : 'ذخیره برای بعد'}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleBookmark(article.id);
        }}
      >
        <BookmarkIcon filled={bookmarked} />
      </button>

      {progress > 0.02 && !completed && (
        <span className="ap-card__progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </span>
      )}
    </article>
  );
}

export function AuthorChip({ article }) {
  const author = getAuthorById(article.author);
  if (!author) return null;

  return (
    <span className={`ap-author-chip ap-author-chip--${author.accent}`}>
      <span className="ap-author-chip__avatar" aria-hidden="true">
        {author.initials}
      </span>
      <span>{author.name}</span>
    </span>
  );
}

/* ── آیکون‌ها ── */
export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function BookmarkIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12v17l-6-4.2L6 21V4Z" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function FocusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
      <path d="M10 10h4v4h-4z" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 5.4" />
      <path d="M14 10a5 5 0 0 0-7.07 0L4.1 12.83a5 5 0 0 0 7.07 7.07l1.32-1.3" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

export function HighlighterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m14 5 5 5-8.5 8.5H6L4.5 20 3 18.5 4.5 14 13 5.5Z" />
      <path d="m12 7 5 5" />
    </svg>
  );
}

export function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" />
      <path d="M17.8 3.7a1.9 1.9 0 0 1 2.7 2.7L12 14.8l-3.8 1 1-3.8 8.6-8.3Z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
    </svg>
  );
}

export function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.6 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-.9.5l.3-4.5L18.2 7c.4-.3-.1-.5-.6-.2L7.3 13.3l-4.3-1.4c-.9-.3-.9-.9.2-1.3l17-6.5c.8-.3 1.5.2 1.2 1.3Z" />
    </svg>
  );
}

export function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 2a9.9 9.9 0 0 0-8.6 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.1 8.1 0 1 1 12 20.2Zm4.5-6c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.1-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.6.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.2Z" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.3 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.7H5.9l10.5 14.4Z" />
    </svg>
  );
}
