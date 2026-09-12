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

export default function CoursesSection() {
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
            className="flex min-h-[180px] cursor-pointer flex-col justify-end rounded-[2rem] bg-[#2a2a2a] px-4 py-6 text-center shadow-none transition duration-200 hover:-translate-y-0.5 hover:bg-[#333333] hover:ring-1 hover:ring-[#2e4b75] md:min-h-[210px] md:rounded-[2.5rem] md:px-5 md:py-7"
          >
            <span className="text-sm leading-7 text-[#5b8cc7] md:text-base [font-family:'Doran',Tahoma,sans-serif]">
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