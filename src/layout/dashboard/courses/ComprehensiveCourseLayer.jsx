import { useEffect, useMemo, useRef, useState } from 'react';
import './comprehensiveCourse.css';

import anatomyImg from '../../../../images/courses/ChatGPT Image ۲۰ شهریور ۱۴۰۵، ۱۶_۴۴_۱۳.png';
import physiologyImg from '../../../../images/courses/ChatGPT Image ۲۰ شهریور ۱۴۰۵، ۱۶_۴۵_۱۹.png';
import biochemistryImg from '../../../../images/courses/ChatGPT Image ۲۲ شهریور ۱۴۰۵، ۱۰_۰۰_۰۸.png';
import microbiologyImg from '../../../../images/courses/ChatGPT Image ۲۲ شهریور ۱۴۰۵، ۱۰_۰۱_۳۴.png';
import parasitologyImg from '../../../../images/courses/ChatGPT Image ۲۲ شهریور ۱۴۰۵، ۱۰_۰۳_۱۴.png';
import histologyImg from '../../../../images/courses/QW2X7THz15isfPOypUmHX3UULX8-zM29LGSsSUChN3UXdLb3uQ.png';
import mycologyImg from '../../../../images/courses/QqVyc2R_BP6N6Tp05DDFVyP-Yiw-zCJJQASGSV6LQSjrdX1cXw.png';
import embryologyImg from '../../../../images/courses/Xl-anhwMGfYUHjBKcrVXxKV5D9A-lImzWgXHTKCbOIu437q6Kw.png';
import entomologyImg from '../../../../images/courses/Asset 4.webp';
import hygieneImg from '../../../../images/courses/Asset 5.webp';
import virologyImg from '../../../../images/courses/Asset 6.webp';
import englishImg from '../../../../images/courses/english.webp';
import immunologyImg from '../../../../images/courses/immono.webp';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const SUBJECTS = [
  { id: 'anatomy', title: 'آناتومی', image: anatomyImg, accent: '#5b8cc7', progress: 35, chapters: 12, lessons: 24, tests: 940 },
  { id: 'physiology', title: 'فیزیولوژی', image: physiologyImg, accent: '#ab8e7c', progress: 25, chapters: 10, lessons: 18, tests: 760 },
  { id: 'biochemistry', title: 'بیوشیمی', image: biochemistryImg, accent: '#77b787', progress: 40, chapters: 8, lessons: 14, tests: 620 },
  { id: 'genetics', title: 'ژنتیک', glyph: 'dna', accent: '#937fcd', progress: 5, chapters: 6, lessons: 9, tests: 380 },
  { id: 'immunology', title: 'ایمونولوژی', image: immunologyImg, accent: '#937fcd', progress: 25, chapters: 7, lessons: 11, tests: 450 },
  { id: 'microbiology', title: 'میکروبیولوژی', image: microbiologyImg, accent: '#77b787', progress: 15, chapters: 9, lessons: 13, tests: 540 },
  { id: 'virology', title: 'ویروس‌شناسی', image: virologyImg, accent: '#ab8e7c', progress: 0, chapters: 6, lessons: 8, tests: 320 },
  { id: 'mycology', title: 'قارچ‌شناسی', image: mycologyImg, accent: '#5b8cc7', progress: 0, chapters: 4, lessons: 6, tests: 240 },
  { id: 'parasitology', title: 'انگل‌شناسی', image: parasitologyImg, accent: '#937fcd', progress: 10, chapters: 7, lessons: 10, tests: 410 },
  { id: 'histology', title: 'بافت‌شناسی', image: histologyImg, accent: '#77b787', progress: 100, chapters: 6, lessons: 8, tests: 350 },
  { id: 'embryology', title: 'جنین‌شناسی', image: embryologyImg, accent: '#5b8cc7', progress: 0, chapters: 5, lessons: 7, tests: 290 },
  { id: 'pathology', title: 'پاتولوژی', glyph: 'microscope', accent: '#ab8e7c', progress: 0, chapters: 9, lessons: 12, tests: 580 },
  { id: 'pharmacology', title: 'فارماکولوژی', glyph: 'pill', accent: '#937fcd', progress: 0, chapters: 8, lessons: 11, tests: 520 },
  { id: 'entomology', title: 'حشره‌شناسی', image: entomologyImg, accent: '#77b787', progress: 0, chapters: 3, lessons: 4, tests: 160 },
  { id: 'hygiene', title: 'بهداشت عمومی', image: hygieneImg, accent: '#5b8cc7', progress: 20, chapters: 5, lessons: 6, tests: 220 },
  { id: 'english', title: 'زبان انگلیسی', image: englishImg, accent: '#ab8e7c', progress: 60, chapters: 4, lessons: 6, tests: 200 },
];

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
      {name === 'dna' && (
        <>
          <path d="M20 7c0 17 24 15 24 25s-24 8-24 25" />
          <path d="M44 7c0 17-24 15-24 25s24 8 24 25" />
          <path d="M25 15h14M22 26h20M25 38h14M22 49h20" opacity="0.55" />
        </>
      )}
      {name === 'microscope' && (
        <>
          <path d="M30 7l11 6-9 16-11-6z" />
          <path d="M26 27c-6 4-9 11-6 18" />
          <path d="M17 51c3-9 10-14 18-14 5 0 9-4 9-9" opacity="0.55" />
          <path d="M13 57h38" />
        </>
      )}
      {name === 'pill' && (
        <>
          <rect x="23" y="6" width="18" height="52" rx="9" />
          <path d="M23 32h18" />
          <path d="M23 15a9 9 0 0 1 18 0z" fill="currentColor" fillOpacity="0.22" stroke="none" />
          <path d="M48 46c5-9 13-10 10-18-7 2-11 8-10 18z" opacity="0.55" />
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

function SubjectCard({ subject, index }) {
  const status = getSubjectStatus(subject);

  return (
    <button
      type="button"
      className={`dars-card dars-card--${status}`}
      style={{
        '--accent': subject.accent,
        '--p': `${subject.progress}%`,
        '--fill-delay': `${0.45 + index * 0.055}s`,
        '--bob-delay': `${(index % 4) * 0.45}s`,
      }}
      aria-label={`${subject.title} — ${toFa(subject.chapters)} فصل، پیشرفت ${toFa(subject.progress)} درصد`}
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
          {toFa(subject.lessons)} درسنامه · {toFa(subject.tests)} تست
        </p>
        <div className="dars-card__bar">
          <span className="dars-card__bar-fill" />
        </div>
        <div className="dars-card__foot">
          <span className="dars-card__chapters">{toFa(subject.chapters)} فصل</span>
          <span className="dars-card__percent">
            {status === 'completed' ? '۱۰۰٪' : `${toFa(subject.progress)}٪`}
          </span>
        </div>
      </div>

      <span className="dars-card__go" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
      </span>
    </button>
  );
}

export default function ComprehensiveCourseLayer({ onBack }) {
  const [filter, setFilter] = useState('all');
  const gridRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onBack?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

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
          <span className="dars-topbar__crumb">دوره‌ها / درسنامه جامع علوم پایه</span>
        </div>

        <header className="dars-hero dash-stagger">
          <div className="dars-hero__content">
            <h1 className="dars-hero__title">
              <span className="dars-hero__title-top">درسنامه جامع</span>
              <span className="dars-hero__title-accent">علوم پایه</span>
            </h1>
            <p className="dars-hero__subtitle">
              همه چیز برای قبولی در علوم پایه، یکجا؛ درسنامه، تست، فلش‌کارت و آزمون — با پوشش کامل ۱۶ درس تخصصی.
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

        <div className="dars-grid dash-stagger" key={filter} ref={gridRef} onPointerMove={handleGridPointerMove}>
          {visibleSubjects.map((subject, index) => (
            <SubjectCard key={subject.id} subject={subject} index={index} />
          ))}
        </div>

        <section className="dars-cta dash-stagger">
          <div className="dars-cta__glow" aria-hidden="true" />
          <div className="dars-cta__copy">
            <h2>از همین امروز، مسیر قبولی‌تو شروع کن</h2>
            <p>با اشتراک پرو به هر ۱۶ درس، بیش از ۷۰۰ درسنامه و ۳۲ هزار تست دسترسی کامل داری.</p>
          </div>
          <div className="dars-cta__actions">
            <button className="dars-cta__primary" type="button">
              همین حالا شروع کنید
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5m6-6-6 6 6 6" />
              </svg>
            </button>
            <button className="dars-cta__ghost" type="button">
              مشاهده تعرفه‌ها
            </button>
          </div>
          <small className="dars-cta__trust">اعتماد بیش از ۳٬۵۰۰ دانشجوی پزشکی سراسر کشور</small>
        </section>
      </div>
    </section>
  );
}
