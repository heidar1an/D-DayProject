import { useMemo, useRef, useState } from 'react';
import { MyCoursesService } from '../../services/learning';
import { SUBJECTS as COMPREHENSIVE_SUBJECTS } from './courses/ComprehensiveCourseLayer';
import { SUBJECTS as MICRO_SUBJECTS } from './courses/MicroCourseLayer';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const COURSES = [
  { id: "comprehensive", title: "درسنامه جامع علوم پایه" },
  { id: "micro", title: "میکرو درسنامه علوم پایه" },
  { id: "green-path", title: "مسیر سبز" },
  { id: "reference", title: "رفرنس" },
  { id: "international", title: "دوره های بین الملل" },
];

const subjectById = Object.fromEntries(COMPREHENSIVE_SUBJECTS.map((subject) => [subject.id, subject]));

/* «کار امروز را به فردا نسپار» — برنامه امروز.
   هر کارت یک درس اصلی است؛ کلیک روی آن به بخش مربوطه همان درس لینک می‌شود. */
const TODAY_LESSONS = [
  {
    subjectId: 'anatomy', moduleId: 'upper-limb', unitId: 'upper-limb-01', stepId: 'learn',
    time: 55, tests: 48, progress: 22,
  },
  { subjectId: 'physiology', time: 45, tests: 38 },
  { subjectId: 'biochemistry', time: 40, tests: 32 },
  { subjectId: 'immunology', time: 35, tests: 30 },
  { subjectId: 'histology', time: 30, tests: 24 },
  { subjectId: 'english', time: 25, tests: 20 },
];

/* نگاشت کاتالوگ به شناسه محتوایی دوره‌ها (کلیدهای localStorage پیشرفت) */
const CONTENT_COURSE_IDS = {
  comprehensive: 'anatomy',
};

/* در حالت جمع‌شده یک ردیف کامل از کارت‌های مربعی نمایش داده می‌شود */
const COLLAPSED_COUNT = 5;

const relativeTime = (isoDate) => {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return '';

  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'دیروز';
  if (days < 7) return `${toFa(days)} روز پیش`;
  return new Date(timestamp).toLocaleDateString('fa-IR');
};

function ClockIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ChevronIcon({ direction, className = 'h-4.5 w-4.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'left' ? <path d="M19 12H5m6-6-6 6 6 6" /> : <path d="M5 12h14m-6-6 6 6-6 6" />}
    </svg>
  );
}

/* ردیف افقی کارت‌ها؛ محتوا به سمت چپ سرریز می‌شود و با دکمه‌های سربرگ هم می‌شود چرخاند */
function LessonRail({ title, subtitle, ariaLabel, spaced = false, bodyClassName = 'mb-16 md:mb-24', children }) {
  const railRef = useRef(null);

  const nudge = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.75, behavior: 'smooth' });
  };

  return (
    <>
      <header className={`mb-6 flex items-end justify-between gap-4 text-right md:mb-8 ${spaced ? 'mt-16 md:mt-24' : ''}`}>
        <div>
          <h2 className="text-2xl text-[#5b8cc7] md:text-4xl [font-family:'Doran',Tahoma,sans-serif]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-white md:text-base">{subtitle}</p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            type="button"
            aria-label="کارت‌های قبلی"
            onClick={() => nudge(1)}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15"
          >
            <ChevronIcon direction="right" />
          </button>
          <button
            type="button"
            aria-label="کارت‌های بعدی"
            onClick={() => nudge(-1)}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15"
          >
            <ChevronIcon direction="left" />
          </button>
        </div>
      </header>

      <div className={`relative ${bodyClassName}`}>
        <div
          ref={railRef}
          role="group"
          aria-label={ariaLabel}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-4 md:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-black/85 to-transparent md:w-12" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-black/85 to-transparent md:w-12" />
      </div>
    </>
  );
}

function TodayLessonCard({ lesson, onOpen }) {
  const subject = subjectById[lesson.subjectId] ?? { title: lesson.subjectId, accent: '#5b8cc7' };
  const progress = lesson.progress ?? subject.progress ?? 0;
  /* برچسب بالای کارت: فقط «شروع کن» و «مرور کامل» نمایش داده می‌شود */
  const tag = progress >= 100 ? 'مرور کامل' : progress > 0 ? null : 'شروع کن';
  const target = {
    subject: lesson.subjectId,
    ...(lesson.moduleId ? { moduleId: lesson.moduleId } : {}),
    ...(lesson.unitId ? { unitId: lesson.unitId } : {}),
    ...(lesson.stepId ? { stepId: lesson.stepId } : {}),
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(target)}
      aria-label={`${subject.title} — شروع درس`}
      className="group relative aspect-[3/4] w-[248px] shrink-0 cursor-pointer snap-start overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#22262e] text-right transition duration-200 hover:-translate-y-1 hover:ring-1 hover:ring-[#5b8cc7] md:w-[304px] md:rounded-[2.75rem]"
    >
      {subject.image && (
        <img
          src={subject.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-75"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/60 to-[#0b0d12]/10" />

      {tag && (
        <span className="absolute top-4 right-4 rounded-full px-3 py-1.5 text-xs text-white backdrop-blur-sm" style={{ backgroundColor: `${subject.accent}d9` }}>
          {tag}
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 md:p-6">
        <strong className="line-clamp-2 text-xl leading-9 text-white [font-family:'Doran',Tahoma,sans-serif] md:text-2xl md:leading-10">
          {subject.title}
        </strong>
        <span className="flex items-center gap-2 text-xs text-white/70">
          <ClockIcon className="h-4 w-4" /> {toFa(lesson.time)} دقیقه
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/40" />
          {toFa(lesson.tests)} تست
        </span>

        <span className="mt-1 flex items-center gap-1.5 text-sm text-white/85 [font-family:'Doran',Tahoma,sans-serif]">
          از الان شروع کن
          <ChevronIcon direction="left" className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        </span>
      </span>
    </button>
  );
}

function MiniLessonCard({ subject, onOpen }) {
  const done = subject.progress >= 100;

  return (
    <button
      type="button"
      onClick={() => onOpen(subject.id)}
      aria-label={`مینی درسنامه ${subject.title}`}
      className="group relative flex aspect-[3/4] w-[224px] shrink-0 cursor-pointer snap-start flex-col items-stretch overflow-hidden rounded-[2rem] border border-white/10 p-4 text-right transition duration-200 hover:-translate-y-1 hover:ring-1 hover:ring-white/25 md:w-[264px] md:rounded-[2.25rem] md:p-5"
      style={{ '--accent': subject.accent, background: `linear-gradient(172deg, ${subject.accent}30, #14161c 60%)` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35"
        style={{ backgroundColor: subject.accent }}
      />

      <strong className="mt-auto truncate text-center text-xl font-bold leading-8 text-white [font-family:'Doran',Tahoma,sans-serif] md:text-2xl md:leading-9">
        {subject.title}
      </strong>

      <span className="mt-2 flex flex-col items-center gap-2.5 border-t border-white/10 pt-3 pb-1 text-[11px] text-white/60 transition-colors group-hover:text-white/90">
        <span
          className="text-3xl leading-none [font-family:'Doran',Tahoma,sans-serif] md:text-4xl"
          style={{ color: subject.accent }}
          aria-label={`پیشرفت ${toFa(subject.progress)} درصد`}
        >
          {toFa(subject.progress)}٪
        </span>

        <span className="flex w-full items-center justify-between">
          <span>{done ? 'خوانده شد؛ مرور دوباره' : 'همین سه سوته بخوان'}</span>
          <ChevronIcon direction="left" className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        </span>
      </span>
    </button>
  );
}

const courseActivityId = (course) => CONTENT_COURSE_IDS[course.id] ?? course.id;

export default function CoursesSection({ onOpenCourse }) {
  /* فعالیت واقعی کاربر هر بار که این بخش باز می‌شود (مثلاً بعد از بستن لایه دوره) دوباره خوانده می‌شود */
  const [activity] = useState(() => MyCoursesService.getActivity());
  const [isExpanded, setIsExpanded] = useState(false);

  /* دوره‌هایی که شروع شده یا پیشروی داشته‌اند می‌آیند سر لیست (بالا-راست شبکه) */
  const orderedCourses = useMemo(() => {
    const started = COURSES.filter((course) => activity[courseActivityId(course)]).sort(
      (a, b) =>
        new Date(activity[courseActivityId(b)].lastStudiedAt) -
        new Date(activity[courseActivityId(a)].lastStudiedAt),
    );
    const notStarted = COURSES.filter((course) => !activity[courseActivityId(course)]);
    return [...started, ...notStarted];
  }, [activity]);

  const hasStartedCourses = orderedCourses.some((course) => activity[courseActivityId(course)]);
  const visibleCourses = isExpanded ? orderedCourses : orderedCourses.slice(0, COLLAPSED_COUNT);
  const hiddenCoursesCount = orderedCourses.length - visibleCourses.length;

  const resumeCourse = orderedCourses[0] ?? null;
  const resumeActivity = resumeCourse ? activity[courseActivityId(resumeCourse)] : null;
  const resumeLessonLabel = [
    resumeActivity?.lastLocation?.unitTitle,
    resumeActivity?.lastLocation?.detail,
  ]
    .filter(Boolean)
    .join(' · ');
  const resumeTarget = resumeActivity?.lastLocation
    ? {
        subject: courseActivityId(resumeCourse),
        moduleId: resumeActivity.lastLocation.moduleId,
        unitId: resumeActivity.lastLocation.unitId,
        stepId: resumeActivity.lastLocation.stepId,
      }
    : null;

  const scrollToCatalog = () => {
    document
      .getElementById("courses-catalog")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      dir="rtl"
      aria-label="دوره ها"
      className="dash-stagger mx-auto w-[var(--content-width)] min-h-[calc(100vh-7rem)] bg-black py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
    >
      <h1 className="mb-16 text-right text-3xl text-[#5b8cc7] md:mb-24 md:text-4xl [font-family:'Doran',Tahoma,sans-serif]">
        دوره های من
      </h1>

      {/* ── وقتی دوره‌ای شروع شده باشد: کادر ادامه یادگیری با اطلاعات واقعی همان بالا دیده می‌شود ── */}
      {hasStartedCourses ? (
        <aside className="mb-14 flex flex-wrap items-center gap-4 rounded-[2rem] border border-white/10 bg-[#1d2b3d]/45 p-5 backdrop-blur-sm md:mb-16 md:rounded-[2.5rem] md:p-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#5b8cc7]/45 bg-[#5b8cc7]/15 text-[#9cc0e8]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
            </svg>
          </span>

          <div className="min-w-[220px] flex-1">
            <p className="text-xs text-[#8a8a8a]">ادامه از جایی که رها کردی</p>
            <strong className="mt-1 block truncate text-[#9cc0e8] [font-family:'Doran',Tahoma,sans-serif]">
              {resumeCourse.title}
              {resumeLessonLabel ? ` · ${resumeLessonLabel}` : ''}
            </strong>
            <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-gradient-to-l from-[#5b8cc7] to-[#937fcd]"
                style={{ width: `${resumeActivity?.progress ?? 0}%` }}
              />
            </span>
            <span className="mt-2 flex items-center gap-1.5 text-xs text-[#8a8a8a]">
              <ClockIcon className="h-3 w-3" />
              آخرین مطالعه: {relativeTime(resumeActivity?.lastStudiedAt)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenCourse?.(resumeCourse.id, resumeTarget)}
            className="cursor-pointer rounded-2xl bg-gradient-to-l from-[#3c6ea5] to-[#2e4b75] px-6 py-3 text-sm text-white transition-transform duration-200 hover:-translate-y-0.5 [font-family:'Doran',Tahoma,sans-serif]"
          >
            ادامه یادگیری
          </button>
        </aside>
      ) : (
        <div className="mb-16 flex flex-col items-center gap-3 text-center md:mb-24">
          <h2 className="text-xl text-white md:text-2xl [font-family:'Doran',Tahoma,sans-serif]">
            هنوز دوره ای را شروع نکردید
          </h2>
          <button
            type="button"
            onClick={scrollToCatalog}
            className="cursor-pointer text-lg text-[#5b8cc7] transition-colors hover:text-[#2e4b75] md:text-xl [font-family:'Doran',Tahoma,sans-serif]"
          >
            یک دوره را شروع کنید
          </button>
        </div>
      )}

      <div
        id="courses-catalog"
        className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:mb-10 md:gap-5 lg:grid-cols-5"
      >
        {visibleCourses.map((course, index) => {
          const courseActivity = activity[courseActivityId(course)];
          const isStarted = Boolean(courseActivity);
          const isMostRecent = isStarted && index === 0;

          return (
            <button
              key={course.id}
              type="button"
              onClick={() => onOpenCourse?.(course.id)}
              className={`relative flex aspect-square cursor-pointer flex-col justify-end rounded-[2rem] bg-[#2a2a2a] px-4 py-5 text-center transition duration-200 hover:-translate-y-0.5 hover:bg-[#333333] hover:ring-1 md:rounded-[2.5rem] md:px-5 md:py-6 ${
                isMostRecent
                  ? 'ring-1 ring-[#5b8cc7] shadow-[0_0_28px_rgba(91,140,199,0.22)] hover:ring-[#5b8cc7]'
                  : course.id === 'comprehensive'
                    ? 'ring-1 ring-[#5b8cc7]/60 bg-[#1d2b3d] hover:ring-[#5b8cc7]'
                    : 'hover:ring-[#2e4b75]'
              }`}
            >
              <span className="absolute inset-x-4 top-4 flex gap-2 md:inset-x-5 md:top-5">
                {isMostRecent && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#5b8cc7] px-3 py-1 text-xs text-white [font-family:'Doran',Tahoma,sans-serif]">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
                    آخرین فعالیت
                  </span>
                )}
                {course.id === 'comprehensive' && !isStarted && (
                  <span className="rounded-full bg-[#5b8cc7] px-3 py-1 text-xs text-white [font-family:'Doran',Tahoma,sans-serif]">
                    فعال شد
                  </span>
                )}
                {course.id === 'micro' && (
                  <span className="rounded-full bg-[#937fcd] px-3 py-1 text-xs text-white [font-family:'Doran',Tahoma,sans-serif]">
                    جدید
                  </span>
                )}
              </span>

              {isStarted && (
                <span className="mb-3 block w-full">
                  {courseActivity.progress != null && (
                    <span className="mb-2.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-gradient-to-l from-[#5b8cc7] to-[#937fcd]"
                        style={{ width: `${courseActivity.progress}%` }}
                      />
                    </span>
                  )}
                  <span className="flex items-center justify-center gap-1.5 text-[11px] text-[#8a9bb0] md:text-xs">
                    <ClockIcon className="h-3 w-3" />
                    آخرین مطالعه: {relativeTime(courseActivity.lastStudiedAt)}
                  </span>
                </span>
              )}

              <span
                className={`text-sm leading-7 md:text-base [font-family:'Doran',Tahoma,sans-serif] ${
                  isStarted || course.id === 'comprehensive' ? 'text-white' : 'text-[#5b8cc7]'
                }`}
              >
                {course.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── وقتی تعداد دوره‌ها از یک ردیف بیشتر شد، بخش با این دکمه باز و بسته می‌شود ── */}
      {hiddenCoursesCount > 0 && (
        <div className="mb-10 flex justify-center md:mb-14">
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-[#1d2b3d]/45 px-6 py-3 text-sm text-[#9cc0e8] transition-colors hover:border-[#5b8cc7]/50 hover:text-white [font-family:'Doran',Tahoma,sans-serif]"
          >
            {isExpanded ? 'نمایش کمتر' : `نمایش همه دوره‌ها (${toFa(hiddenCoursesCount)}+)`}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      <aside className="flex flex-col items-center rounded-[2.5rem] bg-[#ab8e7c] px-6 py-10 text-center md:rounded-[3rem] md:px-10 md:py-14">
        <h2 className="text-2xl leading-relaxed text-[#f4eee8] md:text-4xl md:leading-snug [font-family:'Doran',Tahoma,sans-serif]">
          همین حالا اشتراک پرو تپش را تهیه کنید
        </h2>
        <p className="mt-3 text-2xl leading-relaxed text-[#f4eee8] md:mt-4 md:text-4xl [font-family:'Doran',Tahoma,sans-serif]">
          با بیش از ۲۰٪ تخفیف تا پایان امروز
        </p>

        <button
          type="button"
          className="mt-8 cursor-pointer rounded-2xl border-2 border-[#604e42] px-8 py-3 text-sm text-[#f4eee8] transition-colors hover:bg-[#604e42] hover:text-white md:mt-10 md:rounded-[1.25rem] md:px-10 md:py-3.5 md:text-base"
        >
          اشتراک پرو را از اینجا دریافت کنید
        </button>
      </aside>

      {/* ── کار امروز را به فردا نسپار ── */}
      <LessonRail
        spaced
        title="کار امروز را به فردا نسپار"
        subtitle="درس خواندن را از الان شروع کن، درس مد نظر خودت را انتخاب کن"
        ariaLabel="درس‌های امروز"
      >
        {TODAY_LESSONS.map((lesson) => (
          <TodayLessonCard
            key={`${lesson.subjectId}-${lesson.title}`}
            lesson={lesson}
            onOpen={(target) => onOpenCourse?.('comprehensive', target)}
          />
        ))}
      </LessonRail>

      {/* ── سه سوته درس‌ها رو جمع کن ── */}
      <LessonRail
        title="سه سوته درس ها رو جمع کن"
        subtitle="با مینی درسنامه تو کمترین زمان، سخت ترین درس ها رو جمع کن"
        ariaLabel="مینی درسنامه‌ها"
        bodyClassName="mb-8 md:mb-10"
      >
        {MICRO_SUBJECTS.map((subject) => (
          <MiniLessonCard
            key={subject.id}
            subject={subject}
            onOpen={(subjectId) => onOpenCourse?.('micro', { subject: subjectId })}
          />
        ))}
      </LessonRail>

      {/* ── مسیر سبز ── */}
      <button
        type="button"
        className="flex min-h-[220px] w-full cursor-pointer items-center justify-center rounded-[2.5rem] bg-[#465c4d] px-6 py-16 transition duration-200 hover:bg-[#3d5244] md:min-h-[280px] md:rounded-[3rem] md:py-20"
      >
        <span className="text-base text-white md:text-lg [font-family:'Doran',Tahoma,sans-serif]">
          مسیر سبز
        </span>
      </button>
    </section>
  );
}
