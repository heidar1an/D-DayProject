import { useMemo, useState } from 'react';
import Icon from './icons';
import { useReader } from './readerContext';
import * as api from '../../../../../services/referencesApi';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const relativeTime = (timestamp) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'دیروز' : `${toFa(days)} روز پیش`;
};

/* حذف دومرحله‌ای (کلیک اول ← تایید) برای جلوگیری از پاک شدن اشتباهی */
function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className="rdr-row-btn"
        onClick={() => setConfirming(true)}
        title="حذف"
        aria-label="حذف"
      >
        <Icon name="trash" size={15} />
      </button>
    );
  }
  return (
    <span className="rdr-row-confirm">
      <button type="button" className="rdr-row-btn rdr-row-btn--danger" onClick={onConfirm} title="تایید حذف">
        <Icon name="check" size={15} />
      </button>
      <button type="button" className="rdr-row-btn" onClick={() => setConfirming(false)} title="انصراف" aria-label="انصراف">
        <Icon name="close" size={15} />
      </button>
    </span>
  );
}

function PanelItem({ meta, quote, text, onJump, onDelete, color }) {
  return (
    <div className={`rdr-panel-item ${color ? `rdr-panel-item--${color}` : ''}`}>
      <button type="button" className="rdr-panel-item__body" onClick={onJump}>
        <small className="rdr-panel-item__meta">{meta}</small>
        {quote && <p className="rdr-panel-item__quote">«{quote}»</p>}
        {text && <p className="rdr-panel-item__text">{text}</p>}
      </button>
      <div className="rdr-panel-item__actions">
        <DeleteButton onConfirm={onDelete} />
      </div>
    </div>
  );
}

/* پنل راست: یادداشت‌ها، هایلایت‌ها، نشان‌ها و جست‌وجو */
export default function RightPanel() {
  const {
    reference,
    chapters,
    highlights,
    notes,
    bookmarks,
    removeHighlight,
    removeNote,
    removeBookmark,
    openChapter,
    goToBlock,
    asideTab,
    setAsideTab,
    flashSearchTerm,
    setMobilePanel,
  } = useReader();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const jumpTo = (item) => {
    goToBlock(item.blockId);
    setMobilePanel(null);
  };

  const chapterById = useMemo(
    () => Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

  const runSearch = async (event) => {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    setSearching(true);
    try {
      setResults(await api.searchReference(reference.id, term));
    } finally {
      setSearching(false);
    }
  };

  const tabs = [
    { id: 'notes', label: 'یادداشت‌ها', count: notes.length },
    { id: 'highlights', label: 'هایلایت‌ها', count: highlights.length },
    { id: 'bookmarks', label: 'نشان‌ها', count: bookmarks.length },
    { id: 'search', label: 'جست‌وجو', count: null },
  ];

  return (
    <aside className="rdr-aside" aria-label="ابزارهای مطالعه">
      <div className="rdr-aside__tabs" role="tablist" aria-label="ابزارهای مطالعه">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={asideTab === tab.id}
            className={`rdr-aside__tab ${asideTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setAsideTab(tab.id)}
          >
            {tab.label}
            {tab.count != null && <i>{toFa(tab.count)}</i>}
          </button>
        ))}
      </div>

      <PanelBody
        tab={asideTab}
        query={query}
        setQuery={setQuery}
        runSearch={runSearch}
        searching={searching}
        results={results}
        jumpTo={jumpTo}
        chapterById={chapterById}
        notes={notes}
        highlights={highlights}
        bookmarks={bookmarks}
        removeNote={removeNote}
        removeHighlight={removeHighlight}
        removeBookmark={removeBookmark}
        flashSearchTerm={flashSearchTerm}
        setAsideTab={setAsideTab}
      />
    </aside>
  );
}

function EmptyState({ icon, title, hint }) {
  return (
    <div className="rdr-aside__empty">
      <Icon name={icon} size={30} />
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}

function PanelBody({
  tab,
  query,
  setQuery,
  runSearch,
  searching,
  results,
  jumpTo,
  chapterById,
  notes,
  highlights,
  bookmarks,
  removeNote,
  removeHighlight,
  removeBookmark,
  flashSearchTerm,
  setAsideTab,
}) {
  if (tab === 'notes') {
    if (!notes.length) {
      return (
        <EmptyState
          icon="note"
          title="هنوز یادداشتی ندارید"
          hint="متنی را انتخاب کنید و از تولبار، یادداشت اضافه کنید."
        />
      );
    }
    return (
      <div className="rdr-aside__list">
        {[...notes].reverse().map((note) => (
          <PanelItem
            key={note.id}
            meta={`${chapterById[note.blockId.split('|')[0]]?.title ?? ''} · ${relativeTime(note.createdAt)}`}
            quote={note.quote}
            text={note.text}
            onJump={() => jumpTo(note)}
            onDelete={() => removeNote(note.id)}
          />
        ))}
      </div>
    );
  }

  if (tab === 'highlights') {
    if (!highlights.length) {
      return (
        <EmptyState
          icon="highlighter"
          title="هایلایتی ثبت نشده"
          hint="متنی را انتخاب کنید و یکی از چهار رنگ هایلایت را بزنید."
        />
      );
    }
    return (
      <div className="rdr-aside__list">
        {[...highlights].reverse().map((highlight) => (
          <PanelItem
            key={highlight.id}
            color={highlight.color}
            meta={`${chapterById[highlight.blockId.split('|')[0]]?.title ?? ''} · ${relativeTime(highlight.createdAt)}`}
            quote={highlight.quote}
            onJump={() => jumpTo(highlight)}
            onDelete={() => removeHighlight(highlight.id)}
          />
        ))}
      </div>
    );
  }

  if (tab === 'bookmarks') {
    if (!bookmarks.length) {
      return (
        <EmptyState
          icon="bookmark"
          title="نشان‌گذاری انجام نشده"
          hint="با آیکون نشان در هدر یا کلید Ctrl+B، بخش جاری را نشان کنید."
        />
      );
    }
    return (
      <div className="rdr-aside__list">
        {[...bookmarks].reverse().map((bookmark) => (
          <PanelItem
            key={bookmark.id}
            meta={`فصل ${toFa(bookmark.chapterNumber)} · ${relativeTime(bookmark.createdAt)}`}
            text={bookmark.sectionTitle}
            onJump={() => {
              openChapter(bookmark.chapterId, { sectionId: bookmark.sectionId });
              setMobilePanel(null);
            }}
            onDelete={() => removeBookmark(bookmark.id)}
          />
        ))}
      </div>
    );
  }

  /* tab === search */
  return (
    <div className="rdr-aside__search">
      <form onSubmit={runSearch}>
        <Icon name="search" size={15} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جست‌وجو در کل مرجع…"
          aria-label="جست‌وجو در مرجع"
          autoFocus
        />
      </form>

      {searching && <p className="rdr-aside__hint">در حال جست‌وجو…</p>}

      {results && !searching && results.length === 0 && (
        <EmptyState icon="search" title="نتیجه‌ای یافت نشد" hint="عبارت دیگری را امتحان کنید." />
      )}

      {!!results?.length && (
        <div className="rdr-aside__list">
          {results.map((result) => (
            <button
              key={result.blockId}
              type="button"
              className="rdr-search-hit"
              onClick={() => {
                flashSearchTerm(query.trim());
                goToBlock(result.blockId);
                setMobilePanel(null);
              }}
            >
              <small>
                فصل {toFa(result.chapterNumber)} — {result.sectionTitle}
              </small>
              <p>{result.snippet}</p>
            </button>
          ))}
        </div>
      )}

      {!results && !searching && (
        <EmptyState
          icon="search"
          title="جست‌وجو در کل مرجع"
          hint="عبارت مورد نظر را بنویسید؛ نتیجه‌ها به محل دقیق در متن می‌روند."
        />
      )}
    </div>
  );
}
