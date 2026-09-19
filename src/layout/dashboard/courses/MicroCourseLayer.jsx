import { useEffect, useMemo, useState } from 'react';
import './microCourse.css';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import MicroCourseReader from './micro/MicroCourseReader';
import MicroTopics from './micro/MicroTopics';
import { MicroContentService } from '../../../services/micro/microContentService';

/* جریان لایهٔ میکرودرسنامه: شبکهٔ درس‌ها ← فهرست مبحث‌ها (topics) ← خوانندهٔ صفحه‌به‌صفحه (reader).
   همهٔ درس‌ها به همین سیستم وصل‌اند؛ درس‌های بدون مبحث منتشرشده در فهرست مبحث‌ها
   حالت «در حال ساخت» می‌بینند. */
const MICRO_VIEW = { filter: 'all', subject: null, deep: null, topics: null, reader: null };

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

/* کارت مربعی هر درس: کلیک یعنی ورود به فهرست مبحث‌های میکرودرسنامهٔ همان درس */
function SubjectRow({ subject, onOpenSubject, hasMicro = false }) {
  const circumference = 2 * Math.PI * 15.5;

  return (
    <button
      type="button"
      className="micr-row"
      style={{ '--accent': subject.accent }}
      onClick={() => onOpenSubject(subject.id)}
      title={`میکرودرسنامهٔ ${subject.title}`}
    >
      {hasMicro && <span className="micr-row__micro">میکرودرس فعال</span>}
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

      <span className="micr-row__idbox">
        <span className="micr-row__title">{subject.title}</span>
        <span className="micr-row__meta">
          {toFa(subject.minutes)} دقیقه · {toFa(subject.notes.length)} نکته
        </span>
      </span>
    </button>
  );
}

export default function MicroCourseLayer({ onBack, userId = 'local-user' }) {
  /* فیلتر و درسِ لینک‌شده روی مسیر داشبورد می‌نشینند؛ متن کادر جست‌وجو محلی می‌ماند */
  const [view, , patchView] = useLayerRoute(LAYER_IDS.micro, MICRO_VIEW);
  const filter = view.filter ?? 'all';
  const topicsView = view.topics ?? null;
  const readerView = view.reader ?? null;
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (event) => {
      /* وقتی مبحث‌ها یا خواننده باز است، Escape مال خودش است تا پله‌پله برگردد */
      if (event.key === 'Escape' && !readerView && !topicsView) onBack?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, readerView, topicsView]);

  /* ورود به فهرست مبحث‌های درس — تنها مقصد کلیک روی کارت‌های این لایه */
  const openSubject = (subjectId) => {
    if (!subjectId) return;
    patchView({
      topics: { courseId: MicroContentService.courseIdForSubject(subjectId) ?? subjectId },
      subject: null,
      deep: null,
    });
    window.scrollTo({ top: 0 });
  };

  /* لینک عمیق مسیر سبز و کارت‌های «کار امروز» (subject در نمای لایه) → فهرست مبحث‌ها */
  useEffect(() => {
    if (topicsView || readerView) return;
    const deepSubject = view.deep?.subject ?? view.subject;
    if (!deepSubject) return;
    openSubject(deepSubject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.deep, view.subject, topicsView, readerView]);

  const getStatus = (subject) => {
    if (subject.progress >= 100) return 'read';
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
  }, [filter, query]);

  const filterCounts = useMemo(
    () =>
      FILTERS.reduce((counts, item) => {
        counts[item.id] =
          item.id === 'all'
            ? SUBJECTS.length
            : SUBJECTS.filter((subject) => getStatus(subject) === item.id).length;
        return counts;
      }, {}),
    [],
  );

  /* اولین میکرودرسنامهٔ منتشرشده — برای CTA پایین صفحه */
  const publishedCourse = MicroContentService.firstPublishedCourse();

  /* ── لایهٔ مبحث‌ها و خواننده — بعد از همهٔ هوک‌ها تا ترتیب هوک‌ها پایدار بماند ── */
  if (readerView) {
    return (
      <MicroCourseReader
        courseId={readerView.courseId}
        userId={userId}
        view={readerView}
        patchView={(partial) => patchView({ reader: { ...readerView, ...partial } })}
        onExit={() => patchView({ reader: null })}
      />
    );
  }

  if (topicsView) {
    const topicCourse = MicroContentService.getCourseSync(topicsView.courseId);
    const subjectTitle = SUBJECTS.find((subject) => subject.id === topicsView.courseId)?.title;
    return (
      <MicroTopics
        course={topicCourse}
        subjectTitle={subjectTitle}
        onBack={() => patchView({ topics: null })}
        onOpenTopic={(topic) => patchView({
          reader: { courseId: topicCourse?.id ?? topicsView.courseId, topicId: topic.id },
        })}
      />
    );
  }

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
        </header>

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
            visibleSubjects.map((subject) => (
              <SubjectRow
                key={subject.id}
                subject={subject}
                onOpenSubject={openSubject}
                hasMicro={MicroContentService.hasCourseForSubject(subject.id)}
              />
            ))
          )}
        </div>

        <section className="micr-cta dash-stagger">
          {publishedCourse ? (
            <>
              <h2>میکرودرسنامهٔ فعال تپش</h2>
              <p>
                «{publishedCourse.title}» صفحه‌به‌صفحه، با تست‌های میان راه از بانک تست تپش و نقشهٔ تسلط واقعی — همین حالا شروع کن.
              </p>
              <button type="button" onClick={() => openSubject(publishedCourse.subjectId)}>
                ورود به میکرودرسنامهٔ {publishedCourse.title}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5m6-6-6 6 6 6" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <h2>میکرودرسنامه‌ها در راه‌اند</h2>
              <p>خوانندهٔ صفحه‌به‌صفحهٔ تپش با تست‌های میان راه و نقشهٔ تسلط به‌زودی برای همهٔ درس‌ها منتشر می‌شود.</p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
