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
    settingsOpen,
    setSettingsOpen,
    mobilePanel,
    setMobilePanel,
    onExit,
  } = useReader();

  return (
    <header className="rdr-header">
      <div className="rdr-header__row">
        <div className="rdr-header__side">
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
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setSettingsOpen((open) => !open)}
            title="تنظیمات مطالعه — فونت، فاصله، تم"
            aria-label="تنظیمات مطالعه"
            aria-expanded={settingsOpen}
          >
            <Icon name="settings" />
          </button>
          <button
            type="button"
            className="rdr-icon-btn"
            onClick={() => {
              if (window.innerWidth <= 900) setMobilePanel((panel) => panel === 'toc' ? null : 'toc');
              else setTocOpen((open) => !open);
            }}
            title="نمایش یا بستن فهرست مطالب"
            aria-label="فهرست مطالب"
            aria-expanded={window.innerWidth <= 900 ? mobilePanel === 'toc' : tocOpen}
          >
            <Icon name="list" />
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
