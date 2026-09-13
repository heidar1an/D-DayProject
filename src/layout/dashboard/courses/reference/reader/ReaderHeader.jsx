import Icon from './icons';
import { useReader } from './readerContext';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* هدر Reader: مسیر، نوار پیشرفت مطالعه، نشان و ابزارها */
export default function ReaderHeader({ progressRef }) {
  const {
    reference,
    chapter,
    chapterLoading,
    currentBookmark,
    toggleBookmark,
    setTocOpen,
    tocOpen,
    setAsideOpen,
    setAsideTab,
    setSettingsOpen,
    setMobilePanel,
    onExit,
  } = useReader();

  return (
    <header className="rdr-header">
      <div className="rdr-header__row">
        <div className="rdr-header__side">
          <button
            type="button"
            className="rdr-icon-btn"
            onClick={() => setTocOpen(!tocOpen)}
            title={tocOpen ? 'بستن فهرست مطالب' : 'نمایش فهرست مطالب'}
            aria-label="فهرست مطالب"
          >
            <Icon name="list" />
          </button>
          <button type="button" className="rdr-icon-btn" onClick={onExit} title="خروج از مطالعه" aria-label="خروج از مطالعه">
            <Icon name="exit" />
          </button>
        </div>

        <div className="rdr-header__crumb" aria-label="مسیر مطالعه">
          <span className="rdr-header__ref">{reference.title}</span>
          {chapter && (
            <>
              <span className="rdr-header__sep" aria-hidden="true">
                /
              </span>
              <strong className="rdr-header__chapter">
                فصل {toFa(chapter.number)} · {chapterLoading ? 'در حال بارگذاری…' : chapter.title}
              </strong>
            </>
          )}
        </div>

        <div className="rdr-header__side rdr-header__side--tools">
          <button
            type="button"
            className={`rdr-icon-btn ${currentBookmark ? 'is-on' : ''}`}
            onClick={toggleBookmark}
            title="نشان‌گذاری این بخش (Ctrl+B)"
            aria-label="بوکمارک"
          >
            <Icon name="bookmark" filled={Boolean(currentBookmark)} />
          </button>
          <button
            type="button"
            className="rdr-icon-btn"
            onClick={() => {
              setAsideTab('search');
              setAsideOpen(true);
              setMobilePanel('aside');
            }}
            title="جست‌وجو (Ctrl+F)"
            aria-label="جست‌وجو"
          >
            <Icon name="search" />
          </button>
          <button
            type="button"
            className="rdr-icon-btn"
            onClick={() => {
              setAsideTab('notes');
              setAsideOpen(true);
              setMobilePanel('aside');
            }}
            title="یادداشت‌ها و ابزارهای مطالعه"
            aria-label="ابزارهای مطالعه"
          >
            <Icon name="note" />
          </button>
          <button
            type="button"
            className="rdr-icon-btn"
            onClick={() => setSettingsOpen(true)}
            title="تنظیمات مطالعه — فونت، فاصله، تم"
            aria-label="تنظیمات مطالعه"
          >
            <Icon name="settings" />
          </button>
        </div>
      </div>

      {/* نوار پیشرفت مطالعه همین فصل — با ref بدون re-render به‌روز می‌شود */}
      <div className="rdr-progress" aria-hidden="true">
        <span className="rdr-progress__fill" ref={progressRef} />
      </div>
    </header>
  );
}
