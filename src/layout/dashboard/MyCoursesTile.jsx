/*
 * کارتِ مشترکِ «دوره‌های من» — هم در ریلِ بالای صفحهٔ دوره‌ها و هم در لایهٔ
 * «همهٔ دوره‌های من» استفاده می‌شود.
 *
 * تشخیص نوع دوره با چهار نشانهٔ هم‌زمان انجام می‌شود (فقط رنگ نیست، چون رنگِ
 * هر درس با خودِ درس عوض می‌شود):
 *   ۱) نوار رنگیِ لبهٔ کارت
 *   ۲) چیپِ نوع دوره با آیکونِ اختصاصی (کتاب / صاعقه / کرهٔ زمین)
 *   ۳) بافتِ پس‌زمینه (هاله / خط‌چین + هاشور / شبکه + اورب)
 *   ۴) مدلِ نمایشِ پیشرفت (نوار پیوسته / قطعه‌ای / مهره‌ای)
 */

import { COURSE_KINDS, relativeTime, toFa } from './myCoursesCatalog';
import './myCourses.css';

/* آیکون‌های نوع دوره — همان زبان تصویریِ لایه‌های مبدأ */
export function KindIcon({ name, className = 'h-3.5 w-3.5', style }) {
  const common = {
    className,
    style,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (name === 'bolt') {
    return (
      <svg {...common}>
        <path d="M13.2 2.5 5 13.6h5.6L9.6 21.5 18.4 10h-5.9z" />
      </svg>
    );
  }

  if (name === 'globe') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.8" />
        <path d="M3.6 12h16.8M12 3.2c2.1 2.3 3.2 5.2 3.2 8.8S14.1 18.5 12 20.8C9.9 18.5 8.8 15.6 8.8 12S9.9 5.5 12 3.2z" />
      </svg>
    );
  }

  /* book — پیش‌فرض: درسنامهٔ جامع */
  return (
    <svg {...common}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

/* راهنمای نوع دوره — همان سه نشانه‌ای که کارت‌ها هم استفاده می‌کنند */
export function CourseKindLegend({ className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {COURSE_KIND_ORDER.map((id) => {
        const kind = COURSE_KINDS[id];

        return (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 text-[10px] text-white/55 md:text-[11px]"
            style={{ '--kind': kind.accent }}
          >
            <span className="myc-filter__dot" />
            <KindIcon name={kind.icon} className="h-3 w-3" style={{ color: kind.accent }} />
            <span className="[font-family:'Doran','Vazir',Tahoma,sans-serif]">{kind.label}</span>
          </span>
        );
      })}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5m6-6-6 6 6 6" />
    </svg>
  );
}

/* پیشرفت: هر خانواده مدلِ نمایشِ خودش را دارد */
function ProgressMeter({ kind, progress }) {
  if (kind === 'segments') {
    const filled = Math.round(progress / 10);

    return (
      <span className="myc-meter myc-meter--segments" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <i key={index} className={index < filled ? 'is-on' : ''} />
        ))}
      </span>
    );
  }

  return (
    <span
      className={`myc-meter ${kind === 'beads' ? 'myc-meter--beads' : 'myc-meter--bar'}`}
      aria-hidden="true"
    >
      <span className="myc-meter__fill" style={{ width: `${progress}%` }}>
        {kind === 'beads' && progress > 0 && <span className="myc-meter__head" />}
      </span>
    </span>
  );
}

export default function MyCoursesTile({ course, onOpen, className = '' }) {
  const kind = COURSE_KINDS[course.kind] ?? COURSE_KINDS.comprehensive;
  const progress = Math.min(100, Math.max(0, course.progress ?? 0));
  const isCompleted = progress >= 100;

  const footnote = course.lastStudiedAt
    ? relativeTime(course.lastStudiedAt)
    : course.provider ?? '';

  return (
    <button
      type="button"
      onClick={() => onOpen?.(course)}
      aria-label={`${course.title} — ${kind.label}`}
      className={`myc-tile myc-tile--${course.kind} group ${className}`}
      style={{
        '--accent': course.accent,
        '--kind': kind.accent,
        '--soft': course.accentSoft ?? '#141b26',
      }}
    >
      <span className="myc-tile__texture" aria-hidden="true" />
      <span className="myc-tile__rail" aria-hidden="true" />

      <header className="myc-tile__head">
        <span className="myc-tile__kind" title={kind.label}>
          <KindIcon name={kind.icon} className="h-3 w-3" />
          {kind.shortLabel}
        </span>
        <span className={`myc-tile__status ${isCompleted ? 'myc-tile__status--done' : ''}`}>
          {isCompleted ? 'تمام شد' : 'درحال انجام'}
        </span>
      </header>

      <div className="myc-tile__body">
        <strong className="myc-tile__title">{course.title}</strong>
        <span className="myc-tile__tagline">{course.tagline}</span>

        <ProgressMeter kind={kind.meter} progress={progress} />

        <div className="myc-tile__foot">
          <span className="truncate">{footnote}</span>
          <span className="myc-tile__percent">{toFa(progress)}٪</span>
        </div>

        <span
          className="myc-tile__cta"
          style={{
            background: isCompleted
              ? 'linear-gradient(to left, #2f6147, #1d3a2c)'
              : `linear-gradient(to left, ${course.accent}, ${course.accent}aa)`,
          }}
        >
          {isCompleted ? kind.doneAction : kind.action}
          <ArrowIcon />
        </span>
      </div>
    </button>
  );
}
