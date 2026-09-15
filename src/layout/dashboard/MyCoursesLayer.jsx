/*
 * لایهٔ اختصاصی «همهٔ دوره‌های من» — دید کامل از دروس کاربر.
 *
 * سینک‌شده با منبع واحد myCoursesCatalog: دروس از سه خانواده می‌آیند
 * (درسنامه جامع، میکرو درسنامه، دوره‌های بین‌الملل) و هر کدام هویت بصریِ
 * خودش را دارد تا کاربر نوع دوره را فوراً تشخیص بدهد.
 *
 * ساختار:
 *  ۱) سربرگ با دکمهٔ بازگشت و خلاصهٔ آماری
 *  ۲) فیلترِ نوع دوره (همه / جامع / میکرو / بین‌الملل) — راهنمای بصری هم هست
 *  ۳) کارت‌های مربعی دروسِ درحال انجام
 *  ۴) کارت‌های مربعی دروسِ تمام‌شده (در تهش)
 */

import { useMemo, useState } from 'react';
import {
  buildMyCourses,
  courseStatus,
  COURSE_KINDS,
  COURSE_KIND_ORDER,
  toFa,
} from './myCoursesCatalog';
import MyCoursesTile, { CourseKindLegend, KindIcon } from './MyCoursesTile';

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5m6-6-6 6 6 6" />
    </svg>
  );
}

/* فیلترِ نوع دوره — رنگ و آیکون هر گزینه همان چیزی است که روی کارت‌ها می‌بینی */
function KindFilter({ value, onChange, counts, total }) {
  const options = [
    { id: 'all', label: 'همه', accent: '#ffffff', icon: null, count: total },
    ...COURSE_KIND_ORDER.map((id) => ({
      id,
      label: COURSE_KINDS[id].label,
      accent: COURSE_KINDS[id].accent,
      icon: COURSE_KINDS[id].icon,
      count: counts[id] ?? 0,
    })),
  ];

  return (
    <div role="group" aria-label="فیلتر بر اساس نوع دوره" className="mb-8 flex flex-wrap items-center gap-2 md:mb-10">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={`myc-filter ${value === option.id ? 'is-active' : ''}`}
          style={{ '--kind': option.accent }}
        >
          {option.id === 'all' ? (
            <span className="myc-filter__dot" style={{ background: 'rgba(255,255,255,0.7)' }} />
          ) : (
            <KindIcon name={option.icon} className="h-3.5 w-3.5" style={{ color: option.accent }} />
          )}
          {option.label}
          <span className="myc-filter__count">{toFa(option.count)}</span>
        </button>
      ))}
    </div>
  );
}

export default function MyCoursesLayer({ onBack, onOpenCourse }) {
  const [activeKind, setActiveKind] = useState('all');

  /* دروس سینک‌شده با سه بخش: درسنامه جامع، میکرو درسنامه و دوره‌های بین‌الملل */
  const syncedCourses = useMemo(() => buildMyCourses(), []);

  /* فقط دروسی که شروع شده‌اند اینجا معنا دارند */
  const startedCourses = useMemo(
    () => syncedCourses.filter((course) => courseStatus(course) !== 'not_started'),
    [syncedCourses],
  );

  const countsByKind = useMemo(() => {
    const counts = {};
    for (const course of startedCourses) {
      counts[course.kind] = (counts[course.kind] ?? 0) + 1;
    }
    return counts;
  }, [startedCourses]);

  const visibleCourses = useMemo(
    () =>
      activeKind === 'all'
        ? startedCourses
        : startedCourses.filter((course) => course.kind === activeKind),
    [startedCourses, activeKind],
  );

  /* دروس درحال انجام — بیشترین پیشرفت اول */
  const inProgressCourses = useMemo(
    () =>
      visibleCourses
        .filter((course) => courseStatus(course) === 'in_progress')
        .sort((a, b) => b.progress - a.progress),
    [visibleCourses],
  );

  /* دروس تمام‌شده — در تهش نمایش داده می‌شوند */
  const completedCourses = useMemo(
    () => visibleCourses.filter((course) => courseStatus(course) === 'completed'),
    [visibleCourses],
  );

  const totalActive = visibleCourses.length;

  const handleOpen = (course) => {
    if (!onOpenCourse) return;
    onOpenCourse(course.courseId, course.target);
  };

  const emptyMessage =
    startedCourses.length === 0
      ? 'هنوز درسی شروع نکرده‌ای؛ از بخش «دوره‌ها» یکی از دروس را شروع کن تا اینجا ببینی.'
      : 'هیچ دوره‌ای از این نوع شروع نکرده‌ای؛ نوع دیگری را انتخاب کن.';

  return (
    <section
      dir="rtl"
      aria-label="همهٔ دوره‌های من"
      className="mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
    >
      {/* ── سربرگ ── */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/5 text-white transition-all duration-200 hover:-translate-x-0.5 hover:border-[#5b8cc7] hover:bg-[#5b8cc7]/15 hover:text-[#9cc0e8]"
            aria-label="بازگشت به داشبورد"
          >
            <BackIcon />
          </button>
          <div>
            <h1 className="text-2xl text-[#5b8cc7] md:text-3xl [font-family:'Doran',Tahoma,sans-serif]">
              همهٔ دوره‌های من
            </h1>
            <p className="mt-1 text-xs text-[#8a8a8a] md:text-sm">
              دروس درحال انجام و تمام‌شده از درسنامه جامع، میکرو درسنامه و دوره‌های بین‌الملل
            </p>
          </div>
        </div>

        {totalActive > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {inProgressCourses.length > 0 && (
              <span className="rounded-full border border-[#5b8cc7]/40 bg-[#5b8cc7]/15 px-3 py-1.5 text-[#9cc0e8]">
                <span className="font-semibold [font-family:'Doran',Tahoma,sans-serif]">{toFa(inProgressCourses.length)}</span> درحال انجام
              </span>
            )}
            {completedCourses.length > 0 && (
              <span className="rounded-full border border-[#77b787]/40 bg-[#77b787]/15 px-3 py-1.5 text-[#a3d8b5]">
                <span className="font-semibold [font-family:'Doran',Tahoma,sans-serif]">{toFa(completedCourses.length)}</span> تمام‌شده
              </span>
            )}
          </div>
        )}
      </header>

      {/* ── راهنما + فیلتر نوع دوره ── */}
      <KindFilter
        value={activeKind}
        onChange={setActiveKind}
        counts={countsByKind}
        total={startedCourses.length}
      />

      {/* ── کارت‌های درحال انجام ── */}
      {inProgressCourses.length > 0 && (
        <section className="mb-10 md:mb-12" aria-label="دروس درحال انجام">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {inProgressCourses.map((course) => (
              <MyCoursesTile
                key={course.key}
                course={course}
                onOpen={handleOpen}
                className="aspect-square"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── جداکننده بصری نرم بین دو دسته ── */}
      {inProgressCourses.length > 0 && completedCourses.length > 0 && (
        <span
          aria-hidden="true"
          className="mb-10 block h-px w-full bg-gradient-to-l from-transparent via-white/10 to-transparent md:mb-12"
        />
      )}

      {/* ── کارت‌های تمام‌شده (در تهش) ── */}
      {completedCourses.length > 0 && (
        <section aria-label="دروس تمام‌شده">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {completedCourses.map((course) => (
              <MyCoursesTile
                key={course.key}
                course={course}
                onOpen={handleOpen}
                className="aspect-square"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── حالت خالی ── */}
      {totalActive === 0 && (
        <div className="rounded-[2.5rem] border border-white/10 bg-[#282828]/80 p-10 text-center md:p-14">
          <h2 className="text-xl text-white md:text-2xl [font-family:'Doran',Tahoma,sans-serif]">
            {startedCourses.length === 0 ? 'هنوز درسی شروع نکرده‌ای' : 'دوره‌ای از این نوع نداری'}
          </h2>
          <p className="mt-3 text-sm text-[#8a8a8a]">{emptyMessage}</p>
          <CourseKindLegend className="mt-6 justify-center" />
        </div>
      )}
    </section>
  );
}
