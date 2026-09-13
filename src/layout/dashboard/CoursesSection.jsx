const COURSES = [
  { id: "comprehensive", title: "درسنامه جامع علوم پایه" },
  { id: "micro", title: "میکرو درسنامه علوم پایه" },
  { id: "green-path", title: "مسیر سبز" },
  { id: "reference", title: "رفرنس" },
  { id: "international", title: "دوره های بین الملل" },
];
const TODAY_LESSONS = [
  { id: "today-1" },
  { id: "today-2" },
  { id: "today-3" },
  { id: "today-4" },
];

const MINI_LESSONS = [
  { id: "mini-1" },
  { id: "mini-2" },
  { id: "mini-3" },
  { id: "mini-4" },
];

/* اطلاعات «ادامه یادگیری» — فعلاً ثابت؛ بعداً از پیشرفت واقعی کاربر پر می‌شود */
const RESUME_LESSON = {
  subject: "آناتومی",
  lesson: "فصل ۵: سیستم عضلانی",
  progress: 35,
};

export default function CoursesSection({ onOpenCourse }) {
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

      {/* ── کادر ادامه یادگیری: درس آخر کاربر همان بالا دیده می‌شود ── */}
      <aside className="mb-14 flex flex-wrap items-center gap-4 rounded-[2rem] border border-white/10 bg-[#1d2b3d]/45 p-5 backdrop-blur-sm md:mb-16 md:rounded-[2.5rem] md:p-6">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#5b8cc7]/45 bg-[#5b8cc7]/15 text-[#9cc0e8]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
          </svg>
        </span>

        <div className="min-w-[220px] flex-1">
          <p className="text-xs text-[#8a8a8a]">ادامه از جایی که رها کردی</p>
          <strong className="mt-1 block truncate text-[#9cc0e8] [font-family:'Doran',Tahoma,sans-serif]">
            {RESUME_LESSON.subject} · {RESUME_LESSON.lesson}
          </strong>
          <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-gradient-to-l from-[#5b8cc7] to-[#937fcd]"
              style={{ width: `${RESUME_LESSON.progress}%` }}
            />
          </span>
        </div>

        <button
          type="button"
          className="cursor-pointer rounded-2xl bg-gradient-to-l from-[#3c6ea5] to-[#2e4b75] px-6 py-3 text-sm text-white transition-transform duration-200 hover:-translate-y-0.5 [font-family:'Doran',Tahoma,sans-serif]"
        >
          ادامه یادگیری
        </button>
      </aside>

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

      <div
        id="courses-catalog"
        className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:mb-10 md:gap-5 lg:grid-cols-5"
      >
        {COURSES.map((course) => (
          <button
            key={course.id}
            type="button"
            onClick={() => onOpenCourse?.(course.id)}
            className={`relative flex min-h-[180px] cursor-pointer flex-col justify-end rounded-[2rem] bg-[#2a2a2a] px-4 py-6 text-center transition duration-200 hover:-translate-y-0.5 hover:bg-[#333333] hover:ring-1 md:min-h-[210px] md:rounded-[2.5rem] md:px-5 md:py-7 ${
              course.id === "comprehensive"
                ? "ring-1 ring-[#5b8cc7]/60 bg-[#1d2b3d] hover:ring-[#5b8cc7]"
                : "hover:ring-[#2e4b75]"
            }`}
          >
            {course.id === "comprehensive" && (
              <span className="absolute top-4 right-4 rounded-full bg-[#5b8cc7] px-3 py-1 text-xs text-white [font-family:'Doran',Tahoma,sans-serif]">
                فعال شد
              </span>
            )}
            {course.id === "micro" && (
              <span className="absolute top-4 right-4 rounded-full bg-[#937fcd] px-3 py-1 text-xs text-white [font-family:'Doran',Tahoma,sans-serif]">
                جدید
              </span>
            )}
            <span
              className={`text-sm leading-7 md:text-base [font-family:'Doran',Tahoma,sans-serif] ${
                course.id === "comprehensive" ? "text-white" : "text-[#5b8cc7]"
              }`}
            >
              {course.title}
            </span>
          </button>
        ))}
      </div>

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

      <header className="mb-6 mt-16 text-right md:mb-8 md:mt-24">
        <h2 className="text-2xl text-[#5b8cc7] md:text-4xl [font-family:'Doran',Tahoma,sans-serif]">
          کار امروز را به فردا نسپار
        </h2>
        <p className="mt-2 text-sm text-white md:text-base">
          درس خواندن را از الان شروع کن، درس مد نظر خودت را انتخاب کن
        </p>
      </header>

      <div className="mb-16 grid grid-cols-2 gap-4 md:mb-24 md:grid-cols-4 md:gap-5">
        {TODAY_LESSONS.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            aria-label="انتخاب درس"
            className="aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-[2.25rem] bg-[#2a2a2a] transition duration-200 hover:-translate-y-0.5 hover:bg-[#333333] hover:ring-1 hover:ring-[#2e4b75] md:rounded-[2.5rem]"
          >
            {/* TODO: تصویر / عنوان درس را اینجا بگذار */}
          </button>
        ))}
      </div>

      {/* ── سه سوته درس‌ها رو جمع کن ── */}
      <header className="mb-6 text-right md:mb-8">
        <h2 className="text-2xl text-[#5b8cc7] md:text-4xl [font-family:'Doran',Tahoma,sans-serif]">
          سه سوته درس ها رو جمع کن
        </h2>
        <p className="mt-2 text-sm text-white md:text-base">
          با مینی درسنامه تو کمترین زمان، سخت ترین درس ها رو جمع کن
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 md:mb-10 md:grid-cols-4 md:gap-5">
        {MINI_LESSONS.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            aria-label="مینی درسنامه"
            className="aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-[2.25rem] bg-[#2a2a2a] transition duration-200 hover:-translate-y-0.5 hover:bg-[#333333] hover:ring-1 hover:ring-[#2e4b75] md:rounded-[2.5rem]"
          >
            {/* TODO: تصویر مینی درسنامه را اینجا بگذار */}
          </button>
        ))}
      </div>

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