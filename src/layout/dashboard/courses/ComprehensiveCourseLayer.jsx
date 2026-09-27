import { useEffect, useMemo } from 'react';
import './comprehensiveCourse.css';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import { ContentService } from '../../../services/learning';
import AnatomyLearningLayer from './learning/AnatomyLearningLayer';

import anatomyImg from '../../../../images/courses/QqVyc2R_BP6N6Tp05DDFVyP-Yiw-zCJJQASGSV6LQSjrdX1cXw.png';
import physiologyImg from '../../../../images/courses/ChatGPT Image ۲۰ شهریور ۱۴۰۵، ۱۶_۴۴_۱۳.png';
import biochemistryImg from '../../../../images/courses/ChatGPT Image ۲۰ شهریور ۱۴۰۵، ۱۶_۴۵_۱۹.png';
import bacteriologyImg from '../../../../images/courses/ChatGPT Image ۲۲ شهریور ۱۴۰۵، ۱۰_۰۰_۰۸.png';
import parasitologyImg from '../../../../images/courses/ChatGPT Image ۲۲ شهریور ۱۴۰۵، ۱۰_۰۱_۳۴.png';
import mycologyImg from '../../../../images/courses/ChatGPT Image ۲۲ شهریور ۱۴۰۵، ۱۰_۰۳_۱۴.png';
import histologyImg from '../../../../images/courses/QW2X7THz15isfPOypUmHX3UULX8-zM29LGSsSUChN3UXdLb3uQ.png';
import embryologyImg from '../../../../images/courses/Xl-anhwMGfYUHjBKcrVXxKV5D9A-lImzWgXHTKCbOIu437q6Kw.png';
import entomologyImg from '../../../../images/courses/Asset 4.webp';
import hygieneImg from '../../../../images/courses/Asset 5.webp';
import virologyImg from '../../../../images/courses/Asset 6.webp';
import englishImg from '../../../../images/courses/english.webp';
import immunologyImg from '../../../../images/courses/immono.webp';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* نمای آغازین لایهٔ درسنامهٔ جامع: شبکهٔ درس‌ها، بدون فیلتر و بدون لینک عمیق.
   `subject` درسِ بازشده است و مسیر داخلی هر درس با slot هم‌نام خودش ذخیره می‌شود. */
const COMPREHENSIVE_VIEW = { filter: 'all', subject: null, deep: null };

/* SUBJECTS در صفحه «دوره‌ها» هم برای کارت‌های «کار امروز» استفاده می‌شود تا تصویر،
   رنگ و پیشرفت کارت‌ها با خود درسنامه یکی بماند. */
const SUBJECT_LIST = [
  { id: 'anatomy', title: 'آناتومی', image: anatomyImg, accent: '#5b8cc7', progress: 35, chapters: 12, tests: 940 },
  { id: 'physiology', title: 'فیزیولوژی', image: physiologyImg, accent: '#ab8e7c', progress: 25, chapters: 10, tests: 760 },
  { id: 'biochemistry', title: 'بیوشیمی', image: biochemistryImg, accent: '#77b787', progress: 40, chapters: 8, tests: 620 },
  { id: 'immunology', title: 'ایمونولوژی', image: immunologyImg, accent: '#937fcd', progress: 25, chapters: 7, tests: 450 },
  { id: 'microbiology', title: 'باکتری‌شناسی', image: bacteriologyImg, accent: '#77b787', progress: 15, chapters: 9, tests: 540 },
  { id: 'virology', title: 'ویروس‌شناسی', image: virologyImg, accent: '#ab8e7c', progress: 0, chapters: 6, tests: 320 },
  { id: 'mycology', title: 'قارچ‌شناسی', image: mycologyImg, accent: '#5b8cc7', progress: 0, chapters: 4, tests: 240 },
  { id: 'parasitology', title: 'انگل‌شناسی', image: parasitologyImg, accent: '#937fcd', progress: 10, chapters: 7, tests: 410 },
  { id: 'histology', title: 'بافت‌شناسی', image: histologyImg, accent: '#77b787', progress: 100, chapters: 6, tests: 350 },
  { id: 'embryology', title: 'جنین‌شناسی', image: embryologyImg, accent: '#5b8cc7', progress: 0, chapters: 5, tests: 290 },
  { id: 'entomology', title: 'حشره‌شناسی', image: entomologyImg, accent: '#77b787', progress: 0, chapters: 3, tests: 160 },
  { id: 'hygiene', title: 'بهداشت عمومی', image: hygieneImg, accent: '#5b8cc7', progress: 20, chapters: 5, tests: 220 },
  { id: 'epidemiology', title: 'اپیدمیولوژی', glyph: 'epidemiology', accent: '#937fcd', progress: 0, chapters: 5, tests: 240 },
  { id: 'english', title: 'زبان انگلیسی', image: englishImg, accent: '#ab8e7c', progress: 60, chapters: 4, tests: 200 },
];

/* «تعداد درسنامه» هر درس = تعداد کادرهای سرتیتر (بخش‌های) ستون راست لایهٔ همان درس؛
   از خودِ محتوای لایه شمرده می‌شود، نه دستی. درسی که لایه‌اش ساخته نشده صفر می‌ماند. */
export const SUBJECTS = SUBJECT_LIST.map((subject) => ({
  ...subject,
  lessons: ContentService.countSections(subject.id),
}));

const FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'learning', label: 'در حال یادگیری' },
  { id: 'completed', label: 'تکمیل‌شده' },
  { id: 'fresh', label: 'شروع‌نشده' },
];

const WEEKLY_UPDATES = [
  { id: 'u1', text: '۱۲ درسنامه جدید به بخش آناتومی اضافه شد', accent: '#5b8cc7' },
  { id: 'u2', text: '۳۲۰ تست جدید فیزیولوژی بارگذاری شد', accent: '#77b787' },
  { id: 'u3', text: 'آزمون جامع علوم پایه — شنبه ساعت ۱۸', accent: '#ab8e7c' },
  { id: 'u4', text: 'فلش‌کارت‌های بیوشیمی به‌روزرسانی شد', accent: '#77b787' },
  { id: 'u5', text: 'ویدیوهای جدید ایمونولوژی منتشر شد', accent: '#937fcd' },
  { id: 'u6', text: 'خلاصه نکات ویروس‌شناسی بازنویسی شد', accent: '#937fcd' },
  { id: 'u7', text: 'پاسخ‌نامه تشریحی آزمون هفته گذشته اضافه شد', accent: '#5b8cc7' },
];

function SubjectGlyph({ name }) {
  return (
    <svg
      className="dars-card__glyph-svg"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* اپیدمیولوژی — ذره‌بینِ رصد با منحنی همه‌گیری درون لنز */}
      {name === 'epidemiology' && (
        <>
          <circle cx="27" cy="27" r="15" />
          <path d="M38 38l14 14" />
          <path d="M20 33h14" opacity="0.4" />
          <path d="M21 31l5-7 4 4 7-9" />
        </>
      )}
    </svg>
  );
}

function getSubjectStatus(subject) {
  if (subject.progress >= 100) return 'completed';
  if (subject.progress > 0) return 'learning';
  return 'fresh';
}

/* لینک عمیق {subject, moduleId?} کارت‌های «کار امروز» و «دوره‌های من» → مسیر داخلی لایهٔ
   همان درس. بدون moduleId، خودِ نمای کل درسنامه‌ها (overview) باز می‌شود. */
function deepLinkToRoute(deepLink) {
  if (!deepLink?.moduleId || !ContentService.hasCourse(deepLink.subject)) return null;
  return { name: 'overview', moduleId: deepLink.moduleId };
}

function SubjectCard({ subject, index, onOpen }) {
  const status = getSubjectStatus(subject);

  return (
    <button
      type="button"
      className={`dars-card dars-card--${status}`}
      onClick={() => onOpen?.(subject.id)}
      style={{
        '--accent': subject.accent,
        '--p': `${subject.progress}%`,
        '--fill-delay': `${0.45 + index * 0.055}s`,
        '--bob-delay': `${(index % 4) * 0.45}s`,
      }}
      aria-label={`${subject.title} — پیشرفت ${toFa(subject.progress)} درصد`}
    >
      {status === 'completed' && (
        <span className="dars-card__done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          تکمیل شد
        </span>
      )}

      <div className="dars-card__visual">
        <span className="dars-card__halo" aria-hidden="true" />
        {subject.image ? (
          <img src={subject.image} alt="" loading="lazy" />
        ) : (
          <SubjectGlyph name={subject.glyph} />
        )}
      </div>

      <div className="dars-card__body">
        <h3 className="dars-card__title">{subject.title}</h3>
        <p className="dars-card__meta">
          {toFa(subject.lessons)} درسنامه
        </p>
        {/* عدد پیشرفت پشتِ خودِ نوار می‌نشیند (نه در ردیف جدا) و نوار از رویش رد می‌شود */}
        <div className="dars-card__progress">
          <span className="dars-card__percent">
            {status === 'completed' ? '۱۰۰٪' : `${toFa(subject.progress)}٪`}
          </span>
          <div className="dars-card__bar">
            <span className="dars-card__bar-fill" />
          </div>
          <span className="dars-card__go" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  );
}

export default function ComprehensiveCourseLayer({ onBack, userId = 'local-user' }) {
  /* نمای لایه (شبکهٔ درس‌ها ↔ درسنامهٔ یک درس) روی مسیر داشبورد می‌نشیند تا Back/Forward
     و رفرش همان‌جا بمانند؛ `deep` همان لینک عمیق کارت‌های «کار امروز»/«دوره‌های من» است. */
  const [view, , patchView] = useLayerRoute(LAYER_IDS.comprehensive, COMPREHENSIVE_VIEW, {
    screenOf: (current) => (current?.subject ? `subject:${current.subject}` : 'grid'),
  });
  const filter = view.filter ?? 'all';
  const deepLink = view.deep ?? null;
  const openSubject = view.subject
    ?? (ContentService.hasCourse(deepLink?.subject) ? deepLink.subject : null);
  const subjectRoute = deepLinkToRoute(deepLink);
  const setFilter = (next) => patchView({ filter: next });
  /* ورود/خروج از درسنامهٔ یک درس، لینک عمیق و مسیر داخلی همان درس را هم صفر می‌کند؛
     وگرنه بازگشت از لایهٔ درس دوباره همان‌جا باز می‌شد. */
  const setOpenSubject = (next) => patchView({
    subject: next,
    deep: null,
    ...(openSubject ? { [openSubject]: null } : {}),
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !openSubject) onBack?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, openSubject]);

  /* نقطه نور کارت‌ها با حرکت اشاره‌گر جابه‌جا می‌شود تا حس زنده بودن بدهد */
  const handleGridPointerMove = (event) => {
    const card = event.target.closest?.('.dars-card');
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--my', `${event.clientY - bounds.top}px`);
  };

  const visibleSubjects = useMemo(() => {
    if (filter === 'all') return SUBJECTS;
    return SUBJECTS.filter((subject) => getSubjectStatus(subject) === filter);
  }, [filter]);

  const filterCounts = useMemo(
    () =>
      FILTERS.reduce((counts, item) => {
        counts[item.id] =
          item.id === 'all'
            ? SUBJECTS.length
            : SUBJECTS.filter((subject) => getSubjectStatus(subject) === item.id).length;
        return counts;
      }, {}),
    [],
  );

  const overallProgress = Math.round(
    SUBJECTS.reduce((total, subject) => total + subject.progress, 0) / SUBJECTS.length,
  );
  const startedCount = SUBJECTS.filter((subject) => subject.progress > 0).length;

  /* درسنامهٔ هر درسی که لایه دارد باز می‌شود — آناتومی با مسیر یادگیری کامل، بقیه با
     ساختار برگرفته از میکرودرسنامهٔ همان درس. تم لایه از رنگ همان کارت می‌آید. */
  const openSubjectMeta = SUBJECTS.find((subject) => subject.id === openSubject) ?? null;
  if (openSubject && ContentService.hasCourse(openSubject)) {
    return (
      <AnatomyLearningLayer
        subjectId={openSubject}
        subjectTitle={openSubjectMeta?.title}
        accent={openSubjectMeta?.accent}
        userId={userId}
        onBack={() => setOpenSubject(null)}
        initialRoute={subjectRoute ?? undefined}
      />
    );
  }

  return (
    <section className="dars-layer" dir="rtl" aria-label="درسنامه جامع علوم پایه">
      <div className="dars-layer__inner">
        <div className="dars-topbar">
          <button className="dars-topbar__back" type="button" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
            بازگشت به دوره‌ها
          </button>
        </div>

        <header className="dars-hero dash-stagger">
          <div className="dars-hero__content">
            <h1 className="dars-hero__title">
              <span className="dars-hero__title-top">درسنامه جامع</span>
              <span className="dars-hero__title-accent">علوم پایه</span>
            </h1>
            <p className="dars-hero__subtitle">
              همه چیز برای قبولی در علوم پایه، یکجا؛ درسنامه، تست، فلش‌کارت و آزمون — با پوشش کامل ۱۴ درس تخصصی.
            </p>
          </div>
        </header>

        <div className="dars-ticker" aria-label="تغییرات هفتگی دوره">
          <span className="dars-ticker__badge">
            <i aria-hidden="true" />
            تغییرات هفتگی
          </span>
          <div className="dars-ticker__viewport">
            <div className="dars-ticker__track">
              {[0, 1].map((copy) => (
                <div className="dars-ticker__group" key={copy} aria-hidden={copy === 1 || undefined}>
                  {WEEKLY_UPDATES.map((update) => (
                    <span className="dars-ticker__item" key={`${copy}-${update.id}`}>
                      <i className="dars-ticker__dot" style={{ '--accent': update.accent }} aria-hidden="true" />
                      {update.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dars-overview dash-stagger">
          <div className="dars-overview__copy">
            <h2>پیشرفت کلی شما</h2>
            <p>
              {toFa(startedCount)} درس از {toFa(SUBJECTS.length)} درس را آغاز کرده‌ای؛ ادامه بده!
            </p>
          </div>
          <div className="dars-overview__meter">
            <span className="dars-overview__track">
              <span className="dars-overview__fill" style={{ '--p': `${overallProgress}%` }} />
            </span>
            <strong className="dars-overview__value">{toFa(overallProgress)}٪</strong>
          </div>
        </div>

        <div className="dars-toolbar">
          <div className="dars-filters" role="tablist" aria-label="فیلتر درس‌ها">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`dars-filter ${filter === item.id ? 'is-active' : ''}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <i>{toFa(filterCounts[item.id])}</i>
              </button>
            ))}
          </div>
        </div>

        <div className="dars-grid dash-stagger" key={filter} onPointerMove={handleGridPointerMove}>
          {visibleSubjects.map((subject, index) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              index={index}
              onOpen={(subjectId) => {
                /* درسی که لایهٔ درسنامه ندارد (مثل اپیدمیولوژی) در همین شبکه می‌ماند */
                if (!ContentService.hasCourse(subjectId)) return;
                setOpenSubject(subjectId);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
