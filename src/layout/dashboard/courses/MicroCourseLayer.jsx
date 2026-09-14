import { useEffect, useMemo, useRef, useState } from 'react';
import './microCourse.css';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* میکرو درسنامه: هر درس فقط ۳ نکتهٔ فشرده دارد؛ نوع نکته آیکن و برچسبش را تعیین می‌کند.
   رنگ (accent) و پیشرفت هر درس عمداً با درسنامه جامع یکی است تا دو لایه با هم بخوانند.
   SUBJECTS و NoteIcon در صفحه «دوره‌ها» هم برای کارت‌های «سه سوته» استفاده می‌شوند. */
export const SUBJECTS = [
  {
    id: 'anatomy', title: 'آناتومی', accent: '#5b8cc7', progress: 35, minutes: 4,
    notes: [
      { type: 'key', text: 'قلب ۴ حفره دارد و اندازه‌اش تقریباً برابر مشت صاحبش است.' },
      { type: 'warn', text: 'شایع‌ترین خطا: اشتباه گرفتن عصب رادیال با عصب عضلانی-پوستی در بازو.' },
      { type: 'idea', text: 'استخوان‌های مچ دست را با ترانهٔ «برخی عاشقند تپق دادن قایق حمید» مرور کن.' },
    ],
  },
  {
    id: 'physiology', title: 'فیزیولوژی', accent: '#ab8e7c', progress: 25, minutes: 5,
    notes: [
      { type: 'key', text: 'پمپ سدیم-پتاسیم در هر چرخه ۳ سدیم بیرون و ۲ پتاسیم داخل سلول می‌برد.' },
      { type: 'key', text: 'شیفت راست منحنی اکسی‌هموگلوبین: افزایش CO₂، اسید، دما و ۲,۳-BPG.' },
      { type: 'idea', text: 'برای شیفت راست به خاطر بسپار: «اسید و گرما، اکسیژن را رها می‌کند».' },
    ],
  },
  {
    id: 'biochemistry', title: 'بیوشیمی', accent: '#77b787', progress: 40, minutes: 4,
    notes: [
      { type: 'key', text: 'گلیکولیز در سیتوپلاسم رخ می‌دهد و خالص ۲ ATP و ۲ NADH می‌دهد.' },
      { type: 'key', text: 'آنزیم کلیدی و تنظیم‌کنندهٔ اصلی گلیکولیز، PFK-1 است.' },
      { type: 'warn', text: 'کمبود آنزیم G6PD باعث همولیز در تماس با باقلا می‌شود (فاویسم).' },
    ],
  },
  {
    id: 'genetics', title: 'ژنتیک', accent: '#937fcd', progress: 5, minutes: 3,
    notes: [
      { type: 'key', text: 'جهش نان‌سنس کدون پایان می‌سازد و پروتئین را کوتاه می‌کند.' },
      { type: 'key', text: 'فنیل‌کتونوری الگوی توارث اتوزومی مغلوب دارد.' },
      { type: 'idea', text: 'در پدیگری، رد شدن بیماری از یک نسل نشانهٔ توارث مغلوب است.' },
    ],
  },
  {
    id: 'immunology', title: 'ایمونولوژی', accent: '#937fcd', progress: 25, minutes: 4,
    notes: [
      { type: 'key', text: 'لنفوسیت B در مغز استخوان و لنفوسیت T در تیموس بالغ می‌شوند.' },
      { type: 'key', text: 'IgG تنها آنتی‌بادی‌ای است که از جفت رد می‌شود.' },
      { type: 'idea', text: 'IgA ترشحی محافظ مخاط‌هاست؛ به‌یادآور: «A مثل Airway».' },
    ],
  },
  {
    id: 'microbiology', title: 'میکروبیولوژی', accent: '#77b787', progress: 15, minutes: 4,
    notes: [
      { type: 'key', text: 'در رنگ‌آمیزی گرم، باکتری گرم‌مثبت بنفش و گرم‌منفی صورتی می‌ماند.' },
      { type: 'key', text: 'دیوارهٔ پپتیدوگلیکان هدف آنتی‌بیوتیک‌های بتالاکتام است.' },
      { type: 'warn', text: 'مایکوپلاما دیوارهٔ سلولی ندارد؛ پس پنی‌سیلین رویش بی‌اثر است.' },
    ],
  },
  {
    id: 'virology', title: 'ویروس‌شناسی', accent: '#ab8e7c', progress: 0, minutes: 3,
    notes: [
      { type: 'key', text: 'ویروس فقط با ماشین‌آلات سلول میزبان تکثیر می‌شود.' },
      { type: 'key', text: 'HIV یک رتروویروس است و با معکوس‌نویس RNA را به DNA تبدیل می‌کند.' },
      { type: 'idea', text: 'ویروس‌های DNA معمولاً در هسته تکثیر می‌شوند، به‌جز پوکس‌ویروس‌ها.' },
    ],
  },
  {
    id: 'mycology', title: 'قارچ‌شناسی', accent: '#5b8cc7', progress: 0, minutes: 3,
    notes: [
      { type: 'key', text: 'دیوارهٔ قارچ کیتینی است؛ داروهای ضدقارچ همین را هدف می‌گیرند.' },
      { type: 'key', text: 'کاندیدا آلبیکنس شایع‌ترین عفونت فرصت‌طلب بیماران ایمنی‌سرکوب‌شده است.' },
      { type: 'warn', text: 'در بیمار نوتروپنیک، آسپرژیلوس به‌سرعت تهاجمی و عروق‌خراش می‌شود.' },
    ],
  },
  {
    id: 'parasitology', title: 'انگل‌شناسی', accent: '#937fcd', progress: 10, minutes: 4,
    notes: [
      { type: 'key', text: 'مالاریا با پلاسمودیوم و نیش پشهٔ آنوفل منتقل می‌شود.' },
      { type: 'key', text: 'انتاموبا هیستولیتیکا زخم‌های قارچی‌شکل در روده می‌سازد.' },
      { type: 'idea', text: 'تشخیص استاندارد مالاریا: اسمیر خون محیطی با رنگ‌آمیزی گیمسا.' },
    ],
  },
  {
    id: 'histology', title: 'بافت‌شناسی', accent: '#77b787', progress: 100, minutes: 3,
    notes: [
      { type: 'key', text: 'میکروویلی‌های اپیتلیوم روده سطح جذب را چند برابر می‌کند.' },
      { type: 'key', text: 'کلاژن نوع I فراوان‌ترین کلاژن بدن است؛ در استخوان و پوست.' },
      { type: 'idea', text: 'غشای پایه = لامینا بازال + لامینا رتیکولار.' },
    ],
  },
  {
    id: 'embryology', title: 'جنین‌شناسی', accent: '#5b8cc7', progress: 0, minutes: 3,
    notes: [
      { type: 'key', text: 'لولهٔ عصبی از اکتودرم ساخته می‌شود و در هفتهٔ چهارم می‌بندد.' },
      { type: 'warn', text: 'نقص بسته‌شدن لولهٔ عصبی = اسپینا بیفیدا؛ اسیدفولیک پیشگیری می‌کند.' },
      { type: 'key', text: 'قلب جنین از ابتدای هفتهٔ چهارم تپیدن را آغاز می‌کند.' },
    ],
  },
  {
    id: 'pathology', title: 'پاتولوژی', accent: '#ab8e7c', progress: 0, minutes: 4,
    notes: [
      { type: 'key', text: 'نکروز کواگولاتیو شایع‌ترین نوع نکروز در انفارکتوس است.' },
      { type: 'key', text: 'التهاب حاد نوتروفیل‌محور است؛ مزمن لنفوسیت و ماکروفاژ.' },
      { type: 'idea', text: 'آپوپتوز مرگ برنامه‌ریزی‌شدهٔ سلول است و التهاب ایجاد نمی‌کند.' },
    ],
  },
  {
    id: 'pharmacology', title: 'فارماکولوژی', accent: '#937fcd', progress: 0, minutes: 5,
    notes: [
      { type: 'key', text: 'آگونیست کامل حداکثر اثر را می‌دهد؛ آنتاگونیست خودش اثری ندارد.' },
      { type: 'key', text: 'دوز بارگیری برای رسیدن سریع و دوز نگهدارنده برای ثابت ماندن غلظت است.' },
      { type: 'warn', text: 'تداخل وارفارین با القاکننده‌ها و مهارکننده‌های CYP خطر خونریزی دارد.' },
    ],
  },
  {
    id: 'entomology', title: 'حشره‌شناسی', accent: '#77b787', progress: 0, minutes: 2,
    notes: [
      { type: 'key', text: 'آرتروپودها اسکلت خارجی کیتینی و بدن بندبند دارند.' },
      { type: 'key', text: 'پشهٔ آنوفل ناقل مالاریا و فلبوتوموس ناقل لیشمانیاز است.' },
      { type: 'idea', text: 'دگردیسی کامل: تخم، لارو، شفیره، حشرهٔ بالغ.' },
    ],
  },
  {
    id: 'hygiene', title: 'بهداشت عمومی', accent: '#5b8cc7', progress: 20, minutes: 3,
    notes: [
      { type: 'key', text: 'پیشگیری اولیه مانع بروز بیماری می‌شود؛ ثانویه یعنی تشخیص زودهنگام.' },
      { type: 'key', text: 'برای ایمنی گروهی سرخک، بیش از ۹۵٪ جامعه باید واکسینه باشند.' },
      { type: 'idea', text: 'فلوراید آب آشامیدنی از پوسیدگی دندان پیشگیری می‌کند.' },
    ],
  },
  {
    id: 'english', title: 'زبان انگلیسی', accent: '#ab8e7c', progress: 60, minutes: 2,
    notes: [
      { type: 'key', text: 'پسوند -itis یعنی التهاب و پسوند -osis یعنی وضعیت غیرطبیعی.' },
      { type: 'idea', text: 'ریشه‌ها: cardio قلب، hepato کبد، nephro کلیه، neuro عصب.' },
      { type: 'key', text: 'در تست‌ها اول گزینه‌ها را با ریشه‌های یونانی-لاتین رمزگشایی کن.' },
    ],
  },
];

const FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'partial', label: 'در حال مرور' },
  { id: 'read', label: 'خوانده‌شده' },
  { id: 'new', label: 'شروع‌نشده' },
];

const NOTE_TYPES = {
  key: 'نکتهٔ کلیدی',
  idea: 'یادسپاری',
  warn: 'خطای رایج',
};

export function NoteIcon({ type }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.1,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (type === 'idea') {
    return (
      <svg {...common}>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.7.5 1.1 1.3 1.1 2.1h4.8c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z" />
      </svg>
    );
  }
  if (type === 'warn') {
    return (
      <svg {...common}>
        <path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 2l2.4 5.9L20 10l-5.6 2.1L12 18l-2.4-5.9L4 10l5.6-2.1z" />
    </svg>
  );
}

/* شمارندهٔ عددی زنده برای آمار هیرو */
function useCountUp(target, { duration = 1100, delay = 250 } = {}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    const tick = (now) => {
      if (start === undefined) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return value;
}

function SubjectRow({ subject, index, isOpen, isReviewed, onToggleHead, onToggleReview, registerRow }) {
  const status = subject.progress >= 100 || isReviewed ? 'read' : subject.progress > 0 ? 'partial' : 'new';
  const circumference = 2 * Math.PI * 15.5;

  return (
    <div
      className={`micr-row ${isOpen ? 'is-open' : ''}`}
      ref={(el) => registerRow(subject.id, el)}
      style={{ '--accent': subject.accent }}
    >
      <button
        type="button"
        className="micr-row__head"
        aria-expanded={isOpen}
        onClick={onToggleHead}
      >
        <span className="micr-row__index">{toFa(String(index + 1).padStart(2, '0'))}</span>

        <span className="micr-row__idbox">
          <span className="micr-row__title">{subject.title}</span>
          <span className="micr-row__meta">
            {toFa(subject.minutes)} دقیقه · {toFa(subject.notes.length)} نکته
            {isReviewed && subject.progress < 100 ? ' · مرور شد' : ''}
          </span>
        </span>

        {(status === 'read' || isReviewed) && (
          <span className="micr-row__readmark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
        )}

        <span className="micr-row__gauge">
          <svg className="micr-row__ring" viewBox="0 0 36 36" style={{ '--off': `${circumference * (1 - subject.progress / 100)}` }}>
            <circle className="micr-row__ring-track" cx="18" cy="18" r="15.5" />
            <circle
              className="micr-row__ring-fill"
              cx="18"
              cy="18"
              r="15.5"
              strokeDasharray={`${circumference} ${circumference}`}
            />
          </svg>
          <span className="micr-row__percent">{toFa(subject.progress)}٪</span>
        </span>

        <svg className="micr-row__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div className="micr-row__panel">
        <div className="micr-row__panel-inner">
          {isOpen && (
            <div className="micr-row__panel-body">
              <div className="micr-notes">
                {subject.notes.map((note, noteIndex) => (
                  <article className="micr-note" key={noteIndex} style={{ '--i': noteIndex }}>
                    <header className="micr-note__head">
                      <i className={`micr-note__icon micr-note__icon--${note.type}`}>
                        <NoteIcon type={note.type} />
                      </i>
                      <span className="micr-note__type">{NOTE_TYPES[note.type]}</span>
                    </header>
                    <p className="micr-note__text">{note.text}</p>
                  </article>
                ))}
              </div>
              <footer className="micr-row__foot">
                <span className="micr-row__time">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  زمان مرور: {toFa(subject.minutes)} دقیقه
                </span>
                {onToggleReview && (
                  <button
                    type="button"
                    className={`micr-done ${isReviewed ? 'is-active' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleReview(subject.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                    {isReviewed ? 'مرور شد' : 'خواندم'}
                  </button>
                )}
              </footer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MicroCourseLayer({ onBack, onOpenComprehensive, initialSubject = null }) {
  const [openId, setOpenId] = useState(
    SUBJECTS.some((subject) => subject.id === initialSubject) ? initialSubject : 'anatomy',
  );
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [reviewed, setReviewed] = useState(() => new Set());
  const [tipIndex, setTipIndex] = useState(0);
  const tipPausedRef = useRef(false);
  const rowRefs = useRef(new Map());

  const registerRow = (id, el) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onBack?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  /* ورود از کارت‌های «سه سوته» صفحه دوره‌ها: همان درس باز و وسط صفحه می‌آید */
  useEffect(() => {
    if (!initialSubject || !SUBJECTS.some((subject) => subject.id === initialSubject)) return undefined;
    const raf = requestAnimationFrame(() => {
      rowRefs.current.get(initialSubject)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [initialSubject]);

  /* «نکتهٔ امروز» هر چند ثانیه خودش عوض می‌شود؛ هاور موقتاً نگهش می‌دارد */
  const tips = useMemo(
    () =>
      SUBJECTS.flatMap((subject) =>
        subject.notes.map((note) => ({ ...note, subject: subject.title, accent: subject.accent })),
      ),
    [],
  );

  useEffect(() => {
    const id = setInterval(() => {
      if (!tipPausedRef.current) setTipIndex((i) => (i + 1) % tips.length);
    }, 5200);
    return () => clearInterval(id);
  }, [tips.length]);

  const handleToggleReview = (id) => {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatus = (subject) => {
    if (subject.progress >= 100 || reviewed.has(subject.id)) return 'read';
    if (subject.progress > 0) return 'partial';
    return 'new';
  };

  const visibleSubjects = useMemo(() => {
    const q = query.trim();
    return SUBJECTS.filter((subject) => filter === 'all' || getStatus(subject) === filter).filter(
      (subject) =>
        !q ||
        subject.title.includes(q) ||
        subject.notes.some((note) => note.text.includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query, reviewed]);

  const filterCounts = useMemo(
    () =>
      FILTERS.reduce((counts, item) => {
        counts[item.id] =
          item.id === 'all'
            ? SUBJECTS.length
            : SUBJECTS.filter((subject) => getStatus(subject) === item.id).length;
        return counts;
      }, {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviewed],
  );

  const overallProgress = Math.round(
    SUBJECTS.reduce((total, subject) => total + subject.progress, 0) / SUBJECTS.length,
  );
  const totalMinutes = SUBJECTS.reduce((total, subject) => total + subject.minutes, 0);
  const totalNotes = SUBJECTS.reduce((total, subject) => total + subject.notes.length, 0);

  const subjectsStat = useCountUp(SUBJECTS.length);
  const notesStat = useCountUp(totalNotes);
  const minutesStat = useCountUp(totalMinutes);
  const progressStat = useCountUp(overallProgress, { duration: 1400, delay: 350 });

  const handleChainClick = (id) => {
    setOpenId(id);
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const openSubject = SUBJECTS.find((subject) => subject.id === openId);
  const tip = tips[tipIndex];

  return (
    <section className="micr-layer" dir="rtl" aria-label="میکرو درسنامه علوم پایه">
      <div className="micr-layer__inner">
        <div className="micr-topbar">
          <button className="micr-topbar__back" type="button" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
            بازگشت به دوره‌ها
          </button>
          <span className="micr-topbar__crumb">دوره‌ها / میکرو درسنامه علوم پایه</span>
        </div>

        <header className="micr-hero dash-stagger">
          <div className="micr-hero__content">
            <span className="micr-chip">
              <i aria-hidden="true" />
              نسخهٔ فشرده برای مرور سریع
            </span>
            <h1 className="micr-hero__title">میکرو درسنامه</h1>
            <p className="micr-hero__kicker">علوم پایه — هر درس، فقط چند نکتهٔ همان‌جایی</p>
            <p className="micr-hero__subtitle">
              خلاصه‌های جمع‌وجور برای یک نگاه؛ مخصوص شب قبل از آزمون و مرورهای روزانه.
            </p>
          </div>

          <div className="micr-stats">
            <span className="micr-stats__orbit micr-stats__orbit--a" aria-hidden="true" />
            <span className="micr-stats__orbit micr-stats__orbit--b" aria-hidden="true" />
            <div className="micr-stats__row">
              <strong>{toFa(subjectsStat)}</strong>
              <span>درس</span>
            </div>
            <div className="micr-stats__row">
              <strong>{toFa(notesStat)}</strong>
              <span>نکتهٔ کلیدی</span>
            </div>
            <div className="micr-stats__row">
              <strong>{toFa(minutesStat)}</strong>
              <span>دقیقه مرور کل</span>
            </div>
          </div>
        </header>

        <div className="micr-tip dash-stagger" key={tipIndex % 2 === 0 ? 'tip-a' : 'tip-b'}>
          <button
            type="button"
            className="micr-tip__card"
            onMouseEnter={() => {
              tipPausedRef.current = true;
            }}
            onMouseLeave={() => {
              tipPausedRef.current = false;
            }}
          >
            <span className="micr-tip__badge">
              <i aria-hidden="true" />
              نکتهٔ امروز
            </span>
            <span className="micr-tip__content" style={{ '--accent': tip.accent }}>
              <span className="micr-tip__subject">{tip.subject}</span>
              <span className="micr-tip__text">{tip.text}</span>
            </span>
            <span className="micr-tip__nav" aria-hidden="true">
              <span className="micr-tip__counter">
                {toFa(tipIndex + 1)} / {toFa(tips.length)}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5m6-6-6 6 6 6" />
              </svg>
            </span>
          </button>
        </div>

        <div className="micr-chain dash-stagger">
          <div className="micr-chain__meta">
            <div>
              <strong className="micr-chain__value">{toFa(progressStat)}٪</strong>
              <span className="micr-chain__caption">پیشرفت کلی خلاصه‌خوانی</span>
            </div>
            <span className="micr-chain__hint">روی هر قطعه بزن تا همان درس باز شود</span>
          </div>
          <div className="micr-chain__strip" role="group" aria-label="پیشرفت هر درس">
            {SUBJECTS.map((subject, index) => (
              <button
                key={subject.id}
                type="button"
                className="micr-chain__seg"
                style={{ '--accent': subject.accent, '--i': index }}
                onClick={() => handleChainClick(subject.id)}
                title={`${subject.title} — ${toFa(subject.progress)}٪`}
                aria-label={`${subject.title}، پیشرفت ${toFa(subject.progress)} درصد`}
              >
                <span className="micr-chain__seg-fill" style={{ '--p': `${subject.progress}%` }} />
              </button>
            ))}
          </div>
        </div>

        <div className="micr-toolbar dash-stagger">
          <div className="micr-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجو در درس‌ها و نکته‌ها…"
              aria-label="جستجو در درس‌ها و نکته‌ها"
            />
            {query && (
              <button type="button" className="micr-search__clear" onClick={() => setQuery('')} aria-label="پاک کردن جستجو">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="micr-filters" role="tablist" aria-label="فیلتر درس‌ها">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`micr-filter ${filter === item.id ? 'is-active' : ''}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <i>{toFa(filterCounts[item.id])}</i>
              </button>
            ))}
          </div>
        </div>

        <div className="micr-ledger dash-stagger">
          {visibleSubjects.length === 0 ? (
            <div className="micr-empty">
              <strong>چیزی پیدا نشد</strong>
              <p>عبارت دیگری را جستجو کن یا فیلتر را عوض کن.</p>
            </div>
          ) : (
            visibleSubjects.map((subject, index) => (
              <SubjectRow
                key={subject.id}
                subject={subject}
                index={index}
                isOpen={openId === subject.id}
                isReviewed={reviewed.has(subject.id)}
                onToggleHead={() => setOpenId((current) => (current === subject.id ? null : subject.id))}
                onToggleReview={handleToggleReview}
                registerRow={registerRow}
              />
            ))
          )}
        </div>

        <section className="micr-cta dash-stagger">
          <h2>میکرو فقط شروع ماجراست</h2>
          <p>خلاصه‌ها برای مرورند؛ عمق کامل هر درس با درسنامه جامع تپش جلوتر منتظرت است.</p>
          <button type="button" onClick={onOpenComprehensive}>
            رفتن به درسنامه جامع
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </button>
        </section>
      </div>
    </section>
  );
}
