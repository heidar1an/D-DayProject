import { useMemo, useRef } from 'react';
import { SUBJECTS as COMPREHENSIVE_SUBJECTS } from './courses/ComprehensiveCourseLayer';
import { SUBJECTS as MICRO_SUBJECTS } from './courses/MicroCourseLayer';
import { buildMyCourses, courseStatus } from './myCoursesCatalog';
import MyCoursesTile, { CourseKindLegend } from './MyCoursesTile';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

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

/* پنج دورهٔ اصلی کاتالوگ — ثابت و مستقل از فعّالیّت کاربر.
   همین آرایه هم نوار زیر هیروی صفحهٔ اصلی را می‌سازد؛ پس تنها منبع حقیقتِ
   عنوان/اکسنت/توضیح این پنج کارت همین‌جاست و دو نسخه نمی‌شود. */
export const CATALOG_COURSES = [
  { id: 'comprehensive', title: 'درسنامه جامع', accent: '#5b8cc7', tagline: 'پوشش کامل دروس پایه با درسنامه و تست' },
  { id: 'micro', title: 'میکرو درسنامه', accent: '#937fcd', tagline: 'خلاصهٔ سریع درس‌ها برای مرور فشرده' },
  { id: 'green-path', title: 'مسیر سبز', accent: '#77b787', tagline: 'مسیر ساختار‌یافته برای معدل الف' },
  { id: 'reference', title: 'رفرنس', accent: '#e0b45c', tagline: 'مرجع کامل نکات و جدول‌ها' },
  { id: 'international', title: 'دوره‌های بین الملل', accent: '#61d192', tagline: 'یادگیری توسط بهترین اساتید دنیا.' },
];

/* در حالت جمع‌شده یک ردیف کامل از کارت‌های مربعی نمایش داده می‌شود */
const COLLAPSED_COUNT = 5;

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

/* آیکن «سرعت» برای کارت‌های سه سوته */
function BoltIcon({ className = 'h-3 w-3' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 3 6.8 12.4h4.4L10.5 21l6.7-9.4h-4.4z" />
    </svg>
  );
}

/* جرقهٔ چهارپر — نشان مینیمال بخش پرو */
function SparkIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.6c1.1 6 3.3 8.2 9.4 9.4-6.1 1.2-8.3 3.4-9.4 9.4-1.1-6-3.3-8.2-9.4-9.4 6.1-1.2 8.3-3.4 9.4-9.4z" />
    </svg>
  );
}

/* لوگوی هر کارتِ کاتالوگ — پنج دورهٔ کاتالوگ + سه محصولِ سرصفحهٔ سایت.
   همهٔ شکل‌ها با currentColor رسم می‌شوند تا رنگ کارت (accent) خودکار روی لوگو بنشیند.
   این آیکن بیرون از این بخش هم مصرف می‌شود (نوار دوره‌های صفحهٔ اصلی، کادرهای تبلیغی
   محصولات و پاپ‌آپ ثبت‌نام). */
export function CatalogIcon({ name, className = 'h-7 w-7' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    /* درسنامه جامع — کتابِ بازِ کامل با متن در هر دو صفحه */
    case 'comprehensive':
      return (
        <svg {...common}>
          <path d="M12 6.7C10.3 5.2 8.2 4.5 5.7 4.5H4.1A1.6 1.6 0 0 0 2.5 6.1v10.3a1.6 1.6 0 0 0 1.6 1.6h1.6c2.5 0 4.6.7 6.3 2.2" />
          <path d="M12 6.7c1.7-1.5 3.8-2.2 6.3-2.2h1.6a1.6 1.6 0 0 1 1.6 1.6v10.3a1.6 1.6 0 0 1-1.6 1.6h-1.6c-2.5 0-4.6.7-6.3 2.2" />
          <path d="M12 6.7v13.5" />
          <path d="M5.6 8.9h3.1M5.6 11.9h3.1M15.3 8.9h3.1M15.3 11.9h3.1" />
        </svg>
      );

    /* میکرو درسنامه — برگهٔ فشرده با نشانهٔ سرعت */
    case 'micro':
      return (
        <svg {...common}>
          <rect x="4.2" y="2.8" width="15.6" height="18.4" rx="3.6" />
          <path d="M7.4 7.6h3M7.4 11.2h2M7.4 14.8h2" />
          <path d="M14.6 6.4 11.4 11h3.1l-1.3 4.6" />
        </svg>
      );

    /* مسیر سبز — پله‌های ساختار‌یافته تا پرچم قله */
    case 'green-path':
      return (
        <svg {...common}>
          <path d="M3.4 20.6h4.3v-4.4h4.3v-4.4h4.3V7.4" />
          <path d="M16.3 7.4V2.9" />
          <path d="M16.3 3h4.3l-1.4 2.2 1.4 2.2h-4.3z" />
        </svg>
      );

    /* رفرنس — مرجع نکات و جدول‌ها */
    case 'reference':
      return (
        <svg {...common}>
          <path d="M5.6 2.6h8.6l5 5v12.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 20V4.2a1.6 1.6 0 0 1 1.6-1.6z" />
          <path d="M14.2 2.6v5h5" />
          <path d="M7.6 12.4h8.8M7.6 15.8h8.8M12 12.4v6.6" />
        </svg>
      );

    /* دوره‌های بین‌الملل — کرهٔ زمین با کلاه دانش‌آموختگی */
    case 'international':
      return (
        <svg {...common}>
          <path d="M12 2.4 7 4.6l5 2.2 5-2.2z" />
          <path d="M16.6 5v3.2" />
          <circle cx="16.6" cy="9" r=".9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="15.2" r="6.6" />
          <path d="M5.4 15.2h13.2" />
          <ellipse cx="12" cy="15.2" rx="3" ry="6.6" />
        </svg>
      );

    /* بانک تست — برگهٔ آزمون با تیکِ بزرگ */
    case 'test-bank':
      return (
        <svg {...common}>
          <rect x="4.4" y="2.8" width="15.2" height="18.4" rx="3.4" />
          <path d="M8 11.2l2.4 2.4L16 8.4" />
          <path d="M8 16.6h8" />
        </svg>
      );

    /* تپش هوشمند — حباب گفت‌وگو با جرقهٔ درونش */
    case 'tapesh-ai':
      return (
        <svg {...common}>
          <rect x="3.6" y="4.2" width="16.8" height="12.4" rx="4.4" />
          <path d="M8.6 16.6 7.4 20.4l3.4-3.8" />
          <path d="M12 7.2c.39 2.1 1.16 2.87 3.3 3.3-2.14.43-2.91 1.2-3.3 3.3-.39-2.1-1.16-2.87-3.3-3.3 2.14-.43 2.91-1.2 3.3-3.3z" />
        </svg>
      );

    /* ویکی تپش — ذره‌بین روی سطرهای متن */
    case 'wiki':
      return (
        <svg {...common}>
          <circle cx="10.7" cy="10.7" r="6.3" />
          <path d="M15.3 15.3 20.6 20.6" />
          <path d="M7.9 8.7h5.6M7.9 12.4h3.7" />
        </svg>
      );

    /* شبکه دانش — گرهٔ مرکزی و چهار گرهِ پیوسته */
    case 'knowledge':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.7" />
          <circle cx="5.1" cy="6.2" r="1.9" />
          <circle cx="18.9" cy="6.2" r="1.9" />
          <circle cx="5.1" cy="17.8" r="1.9" />
          <circle cx="18.9" cy="17.8" r="1.9" />
          <path d="M6.6 7.5 9.9 10.3M17.4 7.5 14.1 10.3M6.6 16.5 9.9 13.7M17.4 16.5 14.1 13.7" />
        </svg>
      );

    default:
      return null;
  }
}

/*
 * اندازهٔ کارت کاتالوگ — یک تعریف، دو اندازه.
 *
 * `md` همان اندازهٔ کاتالوگِ داشبورد است. `lg` نسخهٔ بزرگ‌ترِ نوار زیر هیروی
 * صفحهٔ اصلی است و فقط از `2xl` (۱۵۳۶px) به بعد بزرگ می‌شود؛ چرا: تا آن عرض،
 * نوار صفحهٔ اصلی از سقف قبلی‌اش (۱۱۸۰px) پهن‌تر نمی‌شد و کارتِ بلندتر آن‌جا
 * فقط لاغر و کشیده به نظر می‌رسید. این‌طوری هر دو مصرف‌کننده یک مارک‌آپ دارند و
 * فقط اندازهٔ کارتِ صفحهٔ اصلی عوض می‌شود — کارت داشبورد دست‌نخورده می‌ماند.
 */
const CARD_SIZE_MD = {
  root: 'min-h-[200px] rounded-[2rem] px-4 py-5 md:min-h-[300px] md:rounded-[2.5rem] md:px-5 md:py-8',
  tile: 'h-14 w-14 rounded-[1.25rem] md:h-24 md:w-24 md:rounded-[1.9rem]',
  glyph: 'h-8 w-8 md:h-14 md:w-14',
  title: 'text-sm leading-6 md:text-xl md:leading-9',
  tagline: 'text-[10px] leading-5 md:text-xs md:leading-6',
};

const CARD_SIZE_LG = {
  root: `${CARD_SIZE_MD.root} 2xl:min-h-[380px] 2xl:rounded-[3rem] 2xl:px-7 2xl:py-11`,
  tile: `${CARD_SIZE_MD.tile} 2xl:h-[7.5rem] 2xl:w-[7.5rem] 2xl:rounded-[2.3rem]`,
  glyph: `${CARD_SIZE_MD.glyph} 2xl:h-16 2xl:w-16`,
  title: `${CARD_SIZE_MD.title} 2xl:text-[1.6rem] 2xl:leading-[3rem]`,
  tagline: `${CARD_SIZE_MD.tagline} 2xl:text-[0.85rem] 2xl:leading-7`,
};

const CATALOG_CARD_SIZES = { md: CARD_SIZE_MD, lg: CARD_SIZE_LG };

/* کارت کاتالوگ — یک تعریف، دو مصرف: شبکهٔ بخش دوره‌های داشبورد و نوار زیر هیروی
   صفحهٔ اصلی. مارک‌آپ یکی است تا کارتِ صفحهٔ اصلی هرگز از کارتِ داشبورد جدا نیفتد. */
export function CatalogCourseCard({ course, onOpen, size = 'md' }) {
  const scale = CATALOG_CARD_SIZES[size] ?? CARD_SIZE_MD;

  return (
    <button
      type="button"
      onClick={() => onOpen(course.id)}
      aria-label={`ورود به ${course.title}`}
      className={`group relative flex cursor-pointer flex-col items-center justify-between overflow-hidden bg-[var(--surface)] text-center transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--surface-soft)] hover:ring-1 hover:ring-white/20 ${scale.root}`}
      style={{ '--accent': course.accent }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-25 blur-3xl transition-opacity duration-300 group-hover:opacity-45"
        style={{ backgroundColor: course.accent }}
      />

      {/* لوگوی اختصاصی دوره — بزرگ و وسط‌چین */}
      <span
        className={`relative mx-auto grid shrink-0 place-items-center transition-transform duration-300 group-hover:scale-105 ${scale.tile}`}
        style={{
          color: course.accent,
          backgroundColor: `${course.accent}1f`,
          border: `1px solid ${course.accent}3d`,
        }}
      >
        <CatalogIcon name={course.id} className={scale.glyph} />
      </span>

      <span className="relative flex w-full flex-col items-center gap-1.5">
        <span
          className={`block [font-family:'Doran','Vazir',Tahoma,sans-serif] ${scale.title}`}
          style={{ color: course.accent }}
        >
          {course.title}
        </span>
        <span className={`block text-[var(--faint)] ${scale.tagline}`}>
          {course.tagline}
        </span>
      </span>
    </button>
  );
}

/* ردیف افقی کارت‌ها؛ محتوا به سمت چپ سرریز می‌شود و با دکمه‌های سربرگ هم می‌شود چرخاند.
   `action` یک عنصر اختیاری است که کنار دکمه‌های ناوبری در سربرگ نشانده می‌شود. */
function LessonRail({ title, subtitle, ariaLabel, spaced = false, bodyClassName = 'mb-16 md:mb-24', action = null, meta = null, children }) {
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
          <h2 className="text-2xl text-[var(--blue-ink)] md:text-4xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-white md:text-base">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {action}
          <div className="hidden items-center gap-2 sm:flex">
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
      className="group relative aspect-[3/4] w-[248px] shrink-0 cursor-pointer snap-start overflow-hidden rounded-[2.25rem] border border-white/10 bg-[var(--blue-deep)] text-right transition duration-200 hover:-translate-y-1 hover:ring-1 hover:ring-[var(--blue-bright)] md:w-[304px] md:rounded-[2.75rem]"
    >
      {subject.image && (
        <img
          src={subject.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-75"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-[var(--blue-deep)] via-[#0b0d12]/60 to-[#0b0d12]/10" />

      {tag && (
        <span className="absolute top-4 right-4 rounded-full px-3 py-1.5 text-xs text-white backdrop-blur-sm" style={{ backgroundColor: `${subject.accent}d9` }}>
          {tag}
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 md:p-6">
        <strong className="line-clamp-2 text-xl leading-9 text-white [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-2xl md:leading-10">
          {subject.title}
        </strong>
        <span className="flex items-center gap-2 text-xs text-white/70">
          <ClockIcon className="h-4 w-4" /> {toFa(lesson.time)} دقیقه
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/40" />
          {toFa(lesson.tests)} تست
        </span>

        <span className="mt-1 flex items-center gap-1.5 text-sm text-white/85 [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          از الان شروع کن
          <ChevronIcon direction="left" className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        </span>
      </span>
    </button>
  );
}

/* کارت «سه سوته» — نمایندهٔ میکرو درسنامه.
   استعارهٔ بصری: سه برگهٔ نکته که روی هم جمع شده‌اند و برگهٔ رویی، جمع‌بندی رنگی است.
   با hover، دستهٔ برگه‌ها کمی باز می‌شود تا مفهوم «جمع کردن» حس شود. */
function MiniLessonCard({ subject, onOpen }) {
  const done = subject.progress >= 100;

  return (
    <button
      type="button"
      onClick={() => onOpen(subject.id)}
      aria-label={`میکرو درسنامه ${subject.title}`}
      className="group relative flex aspect-[3/4] w-[236px] shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--blue-deep)] p-5 text-right transition duration-200 hover:-translate-y-1 hover:border-white/25 md:w-[276px] md:rounded-[2.25rem] md:p-6"
      style={{ '--accent': subject.accent }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-20 h-44 opacity-[0.18] blur-3xl transition-opacity duration-300 group-hover:opacity-35"
        style={{ background: `radial-gradient(50% 60% at 50% 50%, ${subject.accent}, transparent 72%)` }}
      />

      {/* سربرگ: برچسب «سه سوته» */}
      <span className="relative flex items-center justify-between">
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] md:text-[11px] [font-family:'Doran','Vazir',Tahoma,sans-serif]"
          style={{ backgroundColor: `${subject.accent}26`, color: subject.accent }}
        >
          <BoltIcon className="h-3 w-3" />
          سه سوته
        </span>
      </span>

      {/* دستهٔ سه برگهٔ نکته */}
      <span aria-hidden="true" className="relative mx-auto my-auto block h-[112px] w-[94px] md:h-[128px] md:w-[108px]">
        <span className="absolute inset-0 origin-bottom rotate-[-13deg] rounded-2xl border border-white/10 bg-white/[0.05] transition-transform duration-300 group-hover:-translate-x-3.5 group-hover:rotate-[-18deg]" />
        <span className="absolute inset-0 origin-bottom rotate-[-5deg] rounded-2xl border border-white/10 bg-white/[0.09] transition-transform duration-300 group-hover:-translate-x-1.5 group-hover:rotate-[-8deg]" />
        <span
          className="absolute inset-0 flex origin-bottom rotate-[3deg] flex-col justify-center gap-2 rounded-2xl border px-3.5 transition-transform duration-300 group-hover:rotate-[6deg]"
          style={{ borderColor: `${subject.accent}66`, background: `linear-gradient(158deg, ${subject.accent}3d, #191c23 72%)` }}
        >
          <span className="block h-1.5 rounded-full" style={{ backgroundColor: subject.accent, width: '84%' }} />
          <span className="block h-1.5 w-[62%] rounded-full bg-white/25" />
          <span className="block h-1.5 w-[74%] rounded-full bg-white/20" />
        </span>
      </span>

      {/* پانوشت: نام درس، زمان و پیشرفت */}
      <span className="relative mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-3.5">
        <strong className="text-lg leading-7 text-white [font-family:'Doran','Vazir',Tahoma,sans-serif] md:text-xl md:leading-8">
          {subject.title}
        </strong>

        <span className="flex items-center justify-between text-[11px] text-white/60 md:text-xs">
          <span className="flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5" />
            {toFa(subject.minutes)} دقیقه
          </span>
          <span>{done ? 'مرور دوباره' : 'همین حالا بخوان'}</span>
        </span>

        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full transition-[width] duration-500"
            style={{ width: `${subject.progress}%`, backgroundColor: subject.accent }}
          />
        </span>
      </span>
    </button>
  );
}

export default function CoursesSection({ onOpenCourse, onOpenAllCourses }) {
  /* دروس درحال انجام مستقیماً از دروس دو بخش «درسنامه جامع» و «میکرو درسنامه» خوانده می‌شوند */
  const syncedCourses = useMemo(() => buildMyCourses(), []);

  const inProgressCourses = useMemo(
    () =>
      syncedCourses
        .filter((course) => courseStatus(course) === 'in_progress')
        .sort((a, b) => b.progress - a.progress),
    [syncedCourses],
  );
  const hasStartedCourses = inProgressCourses.length > 0;

  /* هر دوره به لایهٔ خودش و همان درس/دوره لینک می‌شود */
  const handleOpenCourse = (course) => {
    if (!onOpenCourse) return;
    onOpenCourse(course.courseId, course.target);
  };

  /* هر کارت کاتالوگ به مقصد واقعی خودش می‌رود؛ مسیر سبز دیگر لنگر یا بخش تزئینی نیست. */
  const handleOpenCatalog = (courseId) => {
    onOpenCourse?.(courseId);
  };

  /* دکمهٔ «همه دوره‌های من» — داخل سربرگ بخش «دوره‌های من» می‌نشیند */
  const allCoursesButton = (
    <button
      type="button"
      onClick={onOpenAllCourses}
      aria-label="مشاهده همه دوره‌های من"
      className="group flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#5b8cc7]/40 bg-gradient-to-l from-[#3c6ea5]/30 to-[#2e4b75]/30 px-4 py-2 text-xs text-[var(--blue-soft-ink)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--blue-bright)] hover:text-white hover:shadow-[0_0_24px_rgba(91,140,199,0.28)] md:px-5 md:py-2.5 md:text-sm [font-family:'Doran','Vazir',Tahoma,sans-serif]"
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 place-items-center rounded-full bg-[#5b8cc7]/25 transition-colors group-hover:bg-[#5b8cc7]/45"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </span>
      همه دوره‌های من
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-1">
        <path d="M19 12H5m6-6-6 6 6 6" />
      </svg>
    </button>
  );

  return (
    <section
      dir="rtl"
      aria-label="دوره ها"
      className="dash-stagger mx-auto w-[var(--content-width)] min-h-[calc(100vh-7rem)] bg-[var(--background)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
    >
      {/* ── ۱) دوره‌های من: دروس درحال انجام در یک ردیف افقی با فلش اسکرول ── */}
      {hasStartedCourses ? (
        <LessonRail
          title="دوره‌های من"
          subtitle="درس‌هایی که الان مشغول یادگیری آن‌ها هستی"
          ariaLabel="دوره‌های درحال انجام"
          bodyClassName="mb-10 md:mb-14"
          action={allCoursesButton}
        >
          {inProgressCourses.map((course) => (
            <MyCoursesTile
              key={course.key}
              course={course}
              onOpen={handleOpenCourse}
              className="aspect-square w-[220px] shrink-0 snap-start md:w-[260px]"
            />
          ))}
        </LessonRail>
      ) : (
        <section className="mb-10 md:mb-12" aria-label="دوره‌های من">
          <header className="flex flex-wrap items-end justify-between gap-4 text-right">
            <div>
              <h2 className="text-2xl text-[var(--blue-ink)] md:text-4xl [font-family:'Doran','Vazir',Tahoma,sans-serif]">
                دوره‌های من
              </h2>
              <p className="mt-2 text-sm text-white md:text-base">
                هنوز درسی را شروع نکرده‌ای؛ یکی از دوره‌های زیر را انتخاب کن
              </p>
            </div>
            {allCoursesButton}
          </header>
        </section>
      )}

      {/* ── ۲) کاتالوگ: پنج دورهٔ اصلی (درسنامه جامع، میکرو درسنامه، مسیر سبز، رفرنس، بین‌الملل) ── */}
      <section className="mb-10 md:mb-12" aria-label="کاتالوگ دوره‌ها">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-5">
          {CATALOG_COURSES.map((course) => (
            <CatalogCourseCard key={course.id} course={course} onOpen={handleOpenCatalog} />
          ))}
        </div>
      </section>

      {/* ── آگهی پرو ── */}
      <aside className="relative overflow-hidden rounded-[2.5rem] border border-[#e0b45c]/20 bg-[var(--blue-deep)] md:rounded-[3rem]">
        {/* هالهٔ نرم طلایی */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: 'radial-gradient(50% 50% at 50% 50%, var(--gold), transparent 72%)' }}
        />

        {/* الگوی مینیمال: کمان‌های نازک */}
        <svg
          aria-hidden="true"
          viewBox="0 0 260 260"
          className="pointer-events-none absolute -bottom-24 -left-20 h-[280px] w-[280px] opacity-[0.13] md:-bottom-32 md:-left-24 md:h-[380px] md:w-[380px]"
        >
          <g fill="none" stroke="var(--gold-ink)" strokeWidth="1">
            <circle cx="130" cy="130" r="52" />
            <circle cx="130" cy="130" r="84" />
            <circle cx="130" cy="130" r="116" />
          </g>
        </svg>

        <div className="relative flex flex-col items-center gap-8 px-6 py-10 text-center md:flex-row md:items-center md:justify-between md:gap-12 md:px-14 md:py-12 md:text-right">
          <div className="flex flex-col items-center md:items-start">
            <span className="flex items-center gap-2 rounded-full border border-[#e0b45c]/30 bg-[#e0b45c]/10 px-3.5 py-1.5 text-[11px] text-[var(--gold-ink)] md:text-xs [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <SparkIcon className="h-3.5 w-3.5" />
              پرو تپش
            </span>

            <h2 className="mt-4 text-2xl leading-9 text-white md:mt-5 md:text-[2rem] md:leading-[3rem] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              همین حالا اشتراک پرو تپش را تهیه کنید
            </h2>

            <p className="mt-2 text-sm text-white/55 md:mt-3 md:text-lg">
              با بیش از ۲۰٪ تخفیف تا پایان امروز
            </p>

            <button
              type="button"
              className="mt-7 cursor-pointer rounded-2xl bg-[var(--gold)] px-7 py-3 text-sm text-[#1c1508] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 md:mt-8 md:rounded-[1.25rem] md:px-9 md:py-3.5 md:text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]"
            >
              اشتراک پرو را از اینجا دریافت کنید
            </button>
          </div>

          {/* نشان مینیمال پرو */}
          <div aria-hidden="true" className="relative grid h-32 w-32 shrink-0 place-items-center md:h-44 md:w-44">
            <span
              className="absolute inset-0 rounded-full opacity-30 blur-2xl"
              style={{ background: 'radial-gradient(50% 50% at 50% 50%, var(--gold), transparent 70%)' }}
            />
            <svg viewBox="0 0 160 160" className="relative h-full w-full">
              <circle cx="80" cy="80" r="62" fill="none" stroke="var(--gold-ink)" strokeOpacity="0.22" strokeWidth="1" />
              <circle cx="80" cy="80" r="48" fill="none" stroke="var(--gold-ink)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 7" />
              <path
                d="M80 50c3.4 18.6 11 26.2 29.6 29.6C91 83 83.4 90.6 80 109.2 76.6 90.6 69 83 50.4 79.6 69 76.2 76.6 68.6 80 50z"
                fill="var(--gold-ink)"
                fillOpacity="0.9"
              />
            </svg>
          </div>
        </div>
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

      {/* ── کادر تبلیغی مسیر سبز ── */}
      <aside className="relative overflow-hidden rounded-[2.5rem] border border-[var(--green-ink)]/20 bg-[var(--green-deep)] md:rounded-[3rem]">
        {/* هالهٔ نرم سبز */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl"
          style={{ background: 'radial-gradient(50% 50% at 50% 50%, var(--green-bright), transparent 72%)' }}
        />

        <div className="relative flex flex-col items-center gap-8 px-6 py-12 text-center md:flex-row md:items-center md:justify-between md:gap-12 md:px-14 md:py-14 md:text-right">
          <div className="flex flex-col items-center md:items-start">
            <span className="flex items-center gap-2 rounded-full border border-[var(--green-ink)]/30 bg-[var(--green-ink)]/10 px-3.5 py-1.5 text-[11px] text-[var(--green-soft-ink)] md:text-xs [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              <CatalogIcon name="green-path" className="h-3.5 w-3.5" />
              مسیر سبز
            </span>

            <h2 className="mt-4 text-2xl leading-9 text-white md:mt-5 md:text-[2rem] md:leading-[3rem] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              برنامه‌ات را به مسیر سبز بسپار
            </h2>

            <p className="mt-2 max-w-md text-sm text-white/55 md:mt-3 md:text-lg">
              یک نقشهٔ راه روزانه و ساختار‌یافته که قدم‌به‌قدم تا رسیدن به معدل الف جلوی روت را باز می‌کند
            </p>

            <button
              type="button"
              onClick={() => onOpenCourse?.('green-path')}
              className="mt-7 flex cursor-pointer items-center gap-2 rounded-2xl bg-[var(--green-bright)] px-7 py-3 text-sm text-[#0f2018] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 md:mt-8 md:rounded-[1.25rem] md:px-9 md:py-3.5 md:text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]"
            >
              ورود به مسیر سبز
              <ChevronIcon direction="left" className="h-4 w-4" />
            </button>
          </div>

          {/* نشان مینیمال مسیر سبز — نقشهٔ قله: خطوط تراز، مسیر نقطه‌چین و پرچم */}
          <div aria-hidden="true" className="relative grid h-44 w-44 shrink-0 place-items-center md:h-72 md:w-72">
            <span
              className="absolute inset-4 rounded-full opacity-25 blur-2xl"
              style={{ background: 'radial-gradient(50% 50% at 50% 50%, var(--green-bright), transparent 70%)' }}
            />
            <svg viewBox="0 0 200 200" className="relative h-full w-full">
              {/* خطوط تراز زمین — حلقه‌های هم‌مرکز و منظم دور پرچمِ قله */}
              <g fill="none" stroke="var(--green-ink)" strokeWidth="1">
                <ellipse cx="134" cy="52" rx="26" ry="18" opacity="0.26" />
                <ellipse cx="134" cy="52" rx="46" ry="32" opacity="0.16" />
                <ellipse cx="134" cy="52" rx="64" ry="44" opacity="0.09" />
              </g>

              {/* مسیر پیچ‌درپیچ نقطه‌چین از پایین تا قله */}
              <path
                d="M40 172 Q88 156 92 128 Q96 100 70 92 Q44 84 78 64 Q104 50 134 58"
                fill="none"
                stroke="var(--green-bright)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="0.1 8"
                opacity="0.85"
              />

              {/* نقاط علامت‌گذاری مسیر — نقطهٔ شروع با تپش ملایم */}
              <circle cx="40" cy="172" r="4" fill="var(--green-bright)" className="animate-pulse" />
              <circle cx="92" cy="128" r="3.2" fill="var(--green-ink)" fillOpacity="0.55" />
              <circle cx="70" cy="92" r="3.2" fill="var(--green-ink)" fillOpacity="0.75" />
              <circle cx="134" cy="58" r="4" fill="var(--green-bright)" />

              {/* پرچم قله */}
              <path d="M134 58V34" stroke="var(--green-bright)" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M134 34h15l-5.5 7 5.5 7h-15z" fill="var(--green-bright)" fillOpacity="0.9" />
            </svg>
          </div>
        </div>
      </aside>
    </section>
  );
}
