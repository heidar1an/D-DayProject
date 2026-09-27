import { useEffect, useState } from 'react';
import './reference.css';
import './referenceHome.css';
import ReferenceReader from './reference/reader/ReferenceReader';
import Icon from './reference/reader/icons';
import * as api from '../../../services/referencesApi';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';

/* نمای آغازین لایهٔ مراجع: قفسهٔ کتاب‌ها */
const REFERENCE_VIEW = { mode: 'shelf' };

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const relativeTime = (timestamp) => {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'دیروز' : `${toFa(days)} روز پیش`;
};

/* نقش‌برجسته (SVG) روی جلد هر کتاب */
function BookGlyph({ name }) {
  return (
    <svg
      className="ref-book__emblem"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'bone' && (
        <>
          <path d="M41 23c1.8-1.8 4.3-1 5.6-1a5.6 5.6 0 1 0 0-11.2h-.1a5.6 5.6 0 1 0-11.2 0c0 1.3.8 3.8-1 5.6l-11.8 11.8c-1.8 1.8-4.3 1-5.6 1a5.6 5.6 0 1 0 0 11.2h.1a5.6 5.6 0 1 0 11.2 0c0-1.3-.8-3.8 1-5.6z" />
          <path d="M25 33l7-7" opacity="0.55" />
        </>
      )}
      {name === 'cell' && (
        <>
          <circle cx="32" cy="32" r="21" />
          <circle cx="32" cy="32" r="8.5" />
          <circle cx="45" cy="22" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="21" cy="42" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="43" cy="41" r="2.4" fill="currentColor" stroke="none" />
        </>
      )}
      {name === 'heart' && (
        <>
          <path d="M32 52C21.5 43.5 13 35.5 13 24.5a10.5 10.5 0 0 1 19-6.2 10.5 10.5 0 0 1 19 6.2c0 11-8.5 19-19 27.5z" />
          <path d="M17 32h7l3.5-7 5 13 3.5-7h11" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

/* جلد کتاب — ابعادپذیر با --bw / --bh */
function BookFigure({ book }) {
  return (
    <span className="ref-book" aria-hidden="true">
      <span className="ref-book__pages" />
      <span className="ref-book__body" style={{ '--accent': book.accent }}>
        <span className="ref-book__frame" />
        <BookGlyph name={book.glyph} />
        <span className="ref-book__title">{book.title}</span>
        <span className="ref-book__latin">{book.latin}</span>
        <span className="ref-book__edition">{book.edition}</span>
      </span>
      <span className="ref-book__shadow" />
    </span>
  );
}

/* ── نمای قفسه: سه مرجع قابل انتخاب ── */
function ShelfView({ books, onOpen, loading }) {
  return (
    <div className="ref-view dash-stagger">
      <div className="ref-topbar">
        <button className="ref-topbar__back" type="button" onClick={onOpen.back}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به دوره‌ها
        </button>
      </div>

      <header className="ref-hero">
        <div className="ref-hero__content">
          <h1 className="ref-hero__title">
            <span className="ref-hero__title-top">کتابخانه تپش</span>
            <span className="ref-hero__title-accent">رفرنس‌های علوم پایه</span>
          </h1>
          <p className="ref-hero__subtitle">
            معتبرترین مراجع علوم پایه — آناتومی گری، بافت‌شناسی جان کوئیرا و فیزیولوژی گایتون —
            به‌صورت دیجیتال، فصل‌به‌فصل و قابل مطالعه، هایلایت و یادداشت.
          </p>
        </div>
      </header>

      <div className="ref-shelf">
        {!books.length && <p>{loading ? 'در حال بارگذاری رفرنس‌ها…' : 'هنوز رفرنسی منتشر نشده است.'}</p>}
        {books.map((book, index) => (
          <button
            key={book.id}
            type="button"
            className="ref-card"
            style={{
              '--accent': book.accent,
              '--bob-delay': `${(index % 3) * 0.5}s`,
            }}
            onClick={() => onOpen.book(book.id)}
            aria-label={`${book.title} — مشاهده فصل‌ها`}
          >
            <span className="ref-card__scene">
              <span className="ref-card__halo" aria-hidden="true" />
              <span className="ref-float">
                <BookFigure book={book} />
              </span>
            </span>

            <h3 className="ref-card__title">{book.title}</h3>
            <p className="ref-card__meta">{book.latin}</p>

            <span className="ref-card__foot">
              <span className="ref-chip">درس {book.subject}</span>
              <span className="ref-chip ref-chip--plain">{toFa(book.chapters.length)} فصل</span>
              <span className="ref-chip ref-chip--plain">{toFa(book.pages)} صفحه</span>
            </span>

            <span className="ref-card__go" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5m6-6-6 6 6 6" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <p className="ref-foot">
        هر فصل پس از انتشار، با ابزارهای مطالعه حرفه‌ای (هایلایت، یادداشت، نشان و جست‌وجو) در دسترس قرار می‌گیرد.
      </p>
    </div>
  );
}

/* ── نمای خانه مرجع: فصل‌ها، پیشرفت و ادامه مطالعه ── */
function BookHomeView({ book, onBack, onOpenChapter, onContinue, refreshKey }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getReference(book.id).then((data) => {
      if (alive) {
        setState(data);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [book.id, refreshKey]);

  const lastReadChapter = state?.lastRead
    ? book.chapters.find((chapter) => chapter.id === state.lastRead.chapterId)
    : null;

  return (
    <div className="ref-view dash-stagger">
      <div className="ref-topbar">
        <button className="ref-topbar__back" type="button" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به قفسه
        </button>
      </div>

      <header className="ref-home__head" style={{ '--accent': book.accent }}>
        <span className="ref-reader__book" aria-hidden="true">
          <BookFigure book={book} />
        </span>
        <div className="ref-home__info">
          <h2>{book.title}</h2>
          <p className="ref-home__latin">{book.latin} — {book.edition}</p>
          <span className="ref-reader__chips">
            <span className="ref-chip">درس {book.subject}</span>
            <span className="ref-chip ref-chip--plain">{book.authors}</span>
            <span className="ref-chip ref-chip--plain">{toFa(book.chapters.length)} فصل</span>
            <span className="ref-chip ref-chip--plain">{toFa(book.pages)} صفحه</span>
          </span>
        </div>
      </header>

      {loading ? (
        <div className="ref-home__loading" aria-hidden="true">
          <span /><span /><span />
        </div>
      ) : (
        <>
          {lastReadChapter && (
            <aside className="ref-continue" style={{ '--accent': book.accent }}>
              <span className="ref-continue__icon" aria-hidden="true">
                <Icon name="book" size={19} />
              </span>
              <div className="ref-continue__copy">
                <small>ادامه مطالعه · {relativeTime(state.lastRead.at)}</small>
                <strong>
                  فصل {toFa(lastReadChapter.number)} — {lastReadChapter.title}
                </strong>
              </div>
              <button
                type="button"
                className="ref-continue__btn"
                onClick={() => onContinue(state.lastRead)}
              >
                ادامه بده
                <Icon name="arrowPrev" size={16} />
              </button>
            </aside>
          )}

          <div className="ref-home__chapters-head">
            <h3>فصل‌های مرجع</h3>
            <span className="ref-sections__count">{toFa(book.chapters.length)} فصل</span>
          </div>

          <div className="ref-chapters">
            {book.chapters.map((chapter) => {
              const pct = state.progress[chapter.id]?.pct ?? 0;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  className="ref-chapter"
                  style={{ '--accent': book.accent }}
                  title="شروع مطالعه فصل"
                  onClick={() => onOpenChapter(chapter.id)}
                  aria-label={`فصل ${toFa(chapter.number)} — ${chapter.title}`}
                >
                  <span className="ref-chapter__num">{toFa(chapter.number)}</span>
                  <span className="ref-chapter__body">
                    <strong>{chapter.title}</strong>
                    <small>
                      {toFa(chapter.sections)} زیرمبحث
                    </small>
                    <span className="ref-chapter__bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span className="ref-chapter__side">
                    <em className="ref-chapter__pct">{pct > 0 ? `${toFa(pct)}٪` : 'شروع کن'}</em>
                    <Icon name="arrowPrev" size={16} className="ref-chapter__go" />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="ref-foot">
            فصل‌های در حال دیجیتال‌سازی به‌محض انتشار به همین فهرست اضافه می‌شوند.
          </p>
        </>
      )}
    </div>
  );
}

/* ── لایه اصلی: قفسه → خانه مرجع → Reader ── */
export default function ReferenceLayer({ onBack }) {
  /* view: shelf | home:bookId | reader:{bookId, position}
     روی مسیر داشبورد می‌نشیند تا Back/Forward و رفرش همان صفحهٔ کتاب را نگه دارند. */
  const [view, setView] = useLayerRoute(LAYER_IDS.reference, REFERENCE_VIEW);
  const [refreshKey, setRefreshKey] = useState(0);
  const [books, setBooks] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listReferences().then((references) => {
      if (alive) setBooks(references);
    }).finally(() => {
      if (alive) setLibraryLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && view.mode === 'shelf') onBack?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view.mode, onBack]);

  const activeBook = view.bookId ? books.find((book) => book.id === view.bookId) : null;

  /* Reader تمام‌عرض/تمام‌ارتفاع رندر می‌شود؛ خارج از قاب --content-width */
  if (view.mode === 'reader' && activeBook) {
    return (
      <ReferenceReader
        key={activeBook.id}
        reference={activeBook}
        initialPosition={view.position}
        onExit={() => {
          setView({ mode: 'home', bookId: activeBook.id });
          setRefreshKey((key) => key + 1);
        }}
      />
    );
  }

  return (
    <section
      className="ref-layer"
      dir="rtl"
      aria-label="رفرنس‌ها — کتابخانه مراجع علوم پایه"
      style={activeBook ? { '--accent': activeBook.accent } : undefined}
    >
      <div className="ref-layer__inner">
        {view.mode === 'shelf' && (
          <ShelfView
            books={books}
            loading={libraryLoading}
            onOpen={{
              back: onBack,
              book: (bookId) => setView({ mode: 'home', bookId }),
            }}
          />
        )}

        {view.mode === 'home' && activeBook && (
          <BookHomeView
            key={activeBook.id + refreshKey}
            book={activeBook}
            refreshKey={refreshKey}
            onBack={() => setView({ mode: 'shelf' })}
            onOpenChapter={(chapterId) => setView({ mode: 'reader', bookId: activeBook.id, position: { chapterId } })}
            onContinue={(lastRead) => setView({ mode: 'reader', bookId: activeBook.id, position: lastRead })}
          />
        )}
      </div>
    </section>
  );
}
