import { useMemo, useState } from 'react';
import './internationalCourses.css';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* نمای پیش‌فرض لایه — کاتالوگ با فیلتر «همه دوره‌ها» و بدون دورهٔ باز.
   باید ثابت و بیرون از کامپوننت بماند (قرارداد useLayerRoute). */
const INTL_COURSES_VIEW = { filter: 'all', featured: false, courseId: null, deep: null };

const FILTERS = [
  { id: 'all', label: 'همه دوره‌ها' },
  { id: 'medicine', label: 'پزشکی و سلامت' },
  { id: 'science', label: 'علوم پایه' },
  { id: 'skills', label: 'مهارت‌های دانشگاهی' },
  { id: 'media', label: 'رسانه و تفکر' },
];

/* فهرست دوره‌ها — از «دوره‌های من» هم به همین منبع لینک می‌شود */
export const COURSES = [
  {
    id: 'global-health',
    title: 'نگاهی جهانی به سلامت',
    provider: 'دانشگاه هاروارد',
    providerEn: 'Harvard University',
    category: 'medicine',
    categoryLabel: 'پزشکی و سلامت',
    level: 'مقدماتی',
    duration: 8,
    lessons: 24,
    progress: 64,
    accent: '#5b8cc7',
    accentSoft: '#1d314a',
    badge: 'پربازدید',
    description: 'در این مسیر با چالش‌های سلامت عمومی، نابرابری‌های درمانی و راهکارهای اثرگذار در جوامع مختلف آشنا می‌شوی.',
    tags: ['سلامت عمومی', 'اپیدمیولوژی', 'جامعه'],
    modules: ['مقدمه‌ای بر سلامت جهانی', 'نابرابری در دسترسی به درمان', 'سیاست‌گذاری سلامت', 'پروژه پایانی'],
  },
  {
    id: 'visual-science',
    title: 'علم را چطور ببینیم؟',
    provider: 'موسسه فناوری ماساچوست',
    providerEn: 'MIT OpenCourseWare',
    category: 'science',
    categoryLabel: 'علوم پایه',
    level: 'متوسط',
    duration: 6,
    lessons: 18,
    progress: 18,
    accent: '#937fcd',
    accentSoft: '#2d2744',
    badge: 'جدید',
    description: 'یک دوره تصویری برای فهم بهتر مدل‌ها، آزمایش‌ها و ایده‌های علمی؛ از مشاهده دقیق تا ساختن یک توضیح قابل اعتماد.',
    tags: ['تفکر علمی', 'مدل‌سازی', 'آزمایش'],
    modules: ['مشاهده و پرسش‌گری', 'ساخت مدل ذهنی', 'خواندن یک آزمایش', 'توضیح دادن علم'],
  },
  {
    id: 'scientific-english',
    title: 'انگلیسی برای مطالعه علمی',
    provider: 'دانشگاه کمبریج',
    providerEn: 'University of Cambridge',
    category: 'skills',
    categoryLabel: 'مهارت‌های دانشگاهی',
    level: 'متوسط',
    duration: 5,
    lessons: 16,
    progress: 0,
    accent: '#77b787',
    accentSoft: '#20392a',
    badge: 'پیشنهاد تپش',
    description: 'واژگان و الگوهای ضروری برای خواندن مقاله، دنبال کردن ویدیوهای دانشگاهی و نوشتن خلاصه‌های دقیق.',
    tags: ['Academic English', 'مقاله‌خوانی', 'واژگان'],
    modules: ['ساختار مقاله علمی', 'واژگان پرتکرار', 'یادداشت‌برداری از ویدیو', 'خلاصه‌نویسی'],
  },
  {
    id: 'media-literacy',
    title: 'سواد رسانه‌ای در عصر داده',
    provider: 'بی‌بی‌سی ماندارین',
    providerEn: 'BBC Learning',
    category: 'media',
    categoryLabel: 'رسانه و تفکر',
    level: 'مقدماتی',
    duration: 4,
    lessons: 12,
    progress: 0,
    accent: '#ab8e7c',
    accentSoft: '#3b2e28',
    badge: 'کوتاه و کاربردی',
    description: 'با چند ابزار ساده، خبرها و محتوای آنلاین را دقیق‌تر بخوان، منبع را ارزیابی کن و گرفتار شایعه نشو.',
    tags: ['خبرخوانی', 'منبع‌شناسی', 'داده'],
    modules: ['خبر چگونه ساخته می‌شود؟', 'تشخیص منبع معتبر', 'الگوریتم و حباب اطلاعاتی', 'تمرین تحلیل خبر'],
  },
  {
    id: 'neuroscience',
    title: 'مغز، یادگیری و حافظه',
    provider: 'دانشگاه تورنتو',
    providerEn: 'University of Toronto',
    category: 'medicine',
    categoryLabel: 'پزشکی و سلامت',
    level: 'متوسط',
    duration: 7,
    lessons: 21,
    progress: 0,
    accent: '#5b8cc7',
    accentSoft: '#1d314a',
    badge: 'منتخب سردبیر',
    description: 'سفر تصویری از نورون تا رفتار؛ سازوکارهای یادگیری، حافظه و شکل‌گیری عادت‌ها را با مثال‌های روزمره دنبال کن.',
    tags: ['علوم اعصاب', 'یادگیری', 'حافظه'],
    modules: ['نورون و شبکه عصبی', 'توجه و حافظه کاری', 'حافظه بلندمدت', 'عادت و تغییر'],
  },
  {
    id: 'research-methods',
    title: 'از سؤال تا پژوهش معتبر',
    provider: 'دانشگاه آکسفورد',
    providerEn: 'University of Oxford',
    category: 'skills',
    categoryLabel: 'مهارت‌های دانشگاهی',
    level: 'پیشرفته',
    duration: 9,
    lessons: 28,
    progress: 0,
    accent: '#77b787',
    accentSoft: '#20392a',
    badge: 'پیشرفته',
    description: 'از تبدیل یک ایده به سؤال پژوهشی تا طراحی مطالعه، خواندن نتایج و ارائه یک نتیجه‌گیری مسئولانه.',
    tags: ['روش تحقیق', 'نقد مقاله', 'داده‌خوانی'],
    modules: ['صورت‌بندی مسئله', 'انتخاب روش مناسب', 'خطا و سوگیری', 'ارائه نتیجه'],
  },
];

const STATS = [
  { value: 18, label: 'دانشگاه و رسانه معتبر', icon: 'globe' },
  { value: 76, label: 'دوره و مجموعه آموزشی', icon: 'book' },
  { value: 420, label: 'ساعت محتوای ویدیویی', icon: 'play' },
];

function Icon({ name, className = 'h-5 w-5' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (name === 'back') return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></svg>;
  if (name === 'play') return <svg {...common}><path d="m9 6 9 6-9 6z" fill="currentColor" stroke="none" /></svg>;
  if (name === 'pause') return <svg {...common}><path d="M8 6v12M16 6v12" strokeWidth="2.4" /></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="8.7" /><path d="M12 7v5l3.2 2" /></svg>;
  if (name === 'book') return <svg {...common}><path d="M5 5.8A2.8 2.8 0 0 1 7.8 3H19v16H7.8A2.8 2.8 0 0 0 5 21.8z" /><path d="M5 5.8v16M8 7h7" /></svg>;
  if (name === 'globe') return <svg {...common}><circle cx="12" cy="12" r="8.8" /><path d="M3.6 12h16.8M12 3.2c2.1 2.3 3.2 5.2 3.2 8.8S14.1 18.5 12 20.8C9.9 18.5 8.8 15.6 8.8 12S9.9 5.5 12 3.2z" /></svg>;
  if (name === 'bookmark') return <svg {...common}><path d="M6.5 4.2A1.7 1.7 0 0 1 8.2 2.5h7.6a1.7 1.7 0 0 1 1.7 1.7v17.3L12 18.2l-5.5 3.3z" /></svg>;
  if (name === 'check') return <svg {...common}><path d="m5 12.5 4.2 4.2L19 7" /></svg>;
  if (name === 'arrow') return <svg {...common}><path d="M19 12H5m6-6-6 6 6 6" /></svg>;
  if (name === 'spark') return <svg {...common}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" /></svg>;
  return null;
}

function CourseArtwork({ course, compact = false }) {
  return (
    <div className={`intl-courses-artwork ${compact ? 'intl-courses-artwork--compact' : ''}`} style={{ '--course-accent': course.accent, '--course-soft': course.accentSoft }} aria-hidden="true">
      <span className="intl-courses-artwork__orb intl-courses-artwork__orb--one" />
      <span className="intl-courses-artwork__orb intl-courses-artwork__orb--two" />
      <span className="intl-courses-artwork__grid" />
      <span className="intl-courses-artwork__label">{course.providerEn}</span>
      <span className="intl-courses-artwork__title">{course.title}</span>
      <span className="intl-courses-artwork__line" />
      <span className="intl-courses-artwork__code">TAPESH / INTL</span>
    </div>
  );
}

function CourseCard({ course, onOpen }) {
  return (
    <article className="intl-courses-card" style={{ '--course-accent': course.accent, '--course-soft': course.accentSoft }}>
      <div className="intl-courses-card__artwork-wrap">
        <CourseArtwork course={course} compact />
        <span className="intl-courses-card__badge">{course.badge}</span>
        <button type="button" className="intl-courses-card__save" aria-label={`ذخیره ${course.title}`}>
          <Icon name="bookmark" className="h-4 w-4" />
        </button>
      </div>

      <div className="intl-courses-card__body">
        <div className="intl-courses-card__provider">
          <span className="intl-courses-provider-mark">{course.provider.slice(0, 2)}</span>
          <span>{course.provider}</span>
        </div>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <div className="intl-courses-card__meta">
          <span><Icon name="clock" className="h-3.5 w-3.5" /> {toFa(course.duration)} ساعت</span>
          <span><Icon name="play" className="h-3.5 w-3.5" /> {toFa(course.lessons)} ویدیو</span>
          <span>{course.level}</span>
        </div>
        {course.progress > 0 && (
          <div className="intl-courses-card__progress" aria-label={`پیشرفت ${toFa(course.progress)} درصد`}>
            <div><span>پیشرفت تو</span><strong>{toFa(course.progress)}٪</strong></div>
            <span className="intl-courses-card__progress-track"><span style={{ width: `${course.progress}%` }} /></span>
          </div>
        )}
        <button type="button" className="intl-courses-card__cta" onClick={() => onOpen(course)}>
          {course.progress > 0 ? 'ادامه تماشا' : 'مشاهده دوره'}
          <Icon name="arrow" className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function DetailView({ course, onBack }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeModule, setActiveModule] = useState(0);

  return (
    <div className="intl-courses-detail">
      <div className="intl-courses-detail__topbar">
        <button type="button" className="intl-courses-back" onClick={onBack}>
          <Icon name="back" className="h-4 w-4" />
          بازگشت به دوره‌ها
        </button>
      </div>

      <div className="intl-courses-detail__hero">
        <div className="intl-courses-detail__copy">
          <div className="intl-courses-eyebrow"><span>{course.categoryLabel}</span><i /> <span>{course.providerEn}</span></div>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="intl-courses-detail__tags">
            {course.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <div className="intl-courses-detail__actions">
            <button type="button" className="intl-courses-primary-button" onClick={() => setIsPlaying((value) => !value)}>
              <Icon name={isPlaying ? 'pause' : 'play'} className="h-4 w-4" />
              {isPlaying ? 'توقف پخش' : course.progress > 0 ? 'ادامه ویدیوی آخر' : 'شروع دوره'}
            </button>
            <button type="button" className="intl-courses-secondary-button"><Icon name="bookmark" className="h-4 w-4" /> ذخیره دوره</button>
          </div>
        </div>
        <CourseArtwork course={course} />
      </div>

      <div className="intl-courses-detail__stats">
        <span><strong>{toFa(course.lessons)}</strong> ویدیوی آموزشی</span>
        <span><strong>{toFa(course.duration)}</strong> ساعت محتوای منتخب</span>
        <span><strong>{course.level}</strong> سطح دوره</span>
      </div>

      <div className="intl-courses-player-layout">
        <div className={`intl-courses-player ${isPlaying ? 'is-playing' : ''}`}>
          <div className="intl-courses-player__topline"><span>ویدیوی {toFa(activeModule + 1)} از {toFa(course.lessons)}</span><span>{course.providerEn}</span></div>
          <div className="intl-courses-player__screen">
            <span className="intl-courses-player__scanline" />
            <span className="intl-courses-player__watermark">TAPESH</span>
            <div className="intl-courses-player__center">
              <button type="button" className="intl-courses-player__play" onClick={() => setIsPlaying((value) => !value)} aria-label={isPlaying ? 'توقف پخش' : 'پخش ویدیو'}>
                <Icon name={isPlaying ? 'pause' : 'play'} className="h-7 w-7" />
              </button>
              <strong>{isPlaying ? 'پخش نمونه ویدیو' : 'برای شروع، پخش را بزن'}</strong>
              <span>این قاب برای اتصال به سرویس ویدیوی دوره آماده است.</span>
            </div>
            <div className="intl-courses-player__controls"><span className="intl-courses-player__timeline"><i style={{ width: isPlaying ? '34%' : `${course.progress}%` }} /></span><span>۰۱:۲۴ / ۱۲:۴۸</span><Icon name="play" className="h-4 w-4" /></div>
          </div>
        </div>

        <aside className="intl-courses-syllabus">
          <div className="intl-courses-syllabus__heading"><div><span>فهرست دوره</span><strong>{toFa(course.modules.length)} فصل</strong></div><span>{toFa(course.lessons)} ویدیو</span></div>
          <div className="intl-courses-syllabus__list">
            {course.modules.map((module, index) => (
              <button type="button" key={module} className={`intl-courses-syllabus__item ${activeModule === index ? 'is-active' : ''}`} onClick={() => setActiveModule(index)}>
                <span className="intl-courses-syllabus__number">{index < 1 && course.progress > 0 ? <Icon name="check" className="h-3.5 w-3.5" /> : toFa(index + 1)}</span>
                <span><strong>{module}</strong><small>{toFa(index + 3)} ویدیو · {toFa(index + 12)} دقیقه</small></span>
                <Icon name="arrow" className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function InternationalCoursesLayer({ onBack }) {
  /* صفحهٔ لایه (کاتالوگ ↔ جزئیات دوره) روی مسیر داشبورد می‌نشیند؛ متن کادر جست‌وجو محلی می‌ماند */
  const [view, , patchView] = useLayerRoute(LAYER_IDS.intlCourses, INTL_COURSES_VIEW, {
    screenOf: (current) =>
      current?.courseId || current?.deep?.courseId ? 'detail' : 'catalog',
  });
  const [query, setQuery] = useState('');
  /* لینک عمیق از «دوره‌های من»: مستقیم وارد جزئیات همان دوره می‌شود */
  const courseId = view.courseId ?? view.deep?.courseId ?? null;
  const selectedCourse = courseId ? COURSES.find((course) => course.id === courseId) ?? null : null;
  const activeFilter = view.filter ?? 'all';
  const showFeaturedOnly = view.featured ?? false;
  const setActiveFilter = (filter) => patchView({ filter });
  const setShowFeaturedOnly = () => patchView({ featured: !showFeaturedOnly });
  /* بازگشت از جزئیات باید deep را هم پاک کند، وگرنه courseId دوباره از لینک عمیق
     خوانده می‌شود و همان دوره باز می‌ماند. */
  const setSelectedCourse = (course) => patchView({ courseId: course?.id ?? null, deep: null });

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    return COURSES.filter((course) => {
      const matchesFilter = activeFilter === 'all' || course.category === activeFilter;
      const matchesQuery = !normalizedQuery || [course.title, course.provider, course.providerEn, ...course.tags].some((value) => value.toLocaleLowerCase('fa').includes(normalizedQuery));
      const matchesFeatured = !showFeaturedOnly || course.badge === 'منتخب سردبیر' || course.badge === 'پربازدید';
      return matchesFilter && matchesQuery && matchesFeatured;
    });
  }, [activeFilter, query, showFeaturedOnly]);

  if (selectedCourse) {
    return <DetailView course={selectedCourse} onBack={() => setSelectedCourse(null)} />;
  }

  return (
    <section dir="rtl" aria-label="دوره‌های بین‌الملل" className="intl-courses-layer">
      <header className="intl-courses-header">
        <div className="intl-courses-header__left">
          <button type="button" className="intl-courses-back" onClick={onBack}>
            <Icon name="back" className="h-4 w-4" />
            بازگشت به دوره‌ها
          </button>
        </div>
      </header>

      <div className="intl-courses-hero">
        <div className="intl-courses-hero__copy">
          <span className="intl-courses-kicker"><Icon name="globe" className="h-4 w-4" /> یادگیری فراتر از مرزها</span>
          <h1>دانش جهانی،<br /><em>به زبان تپش</em></h1>
          <p>ویدیوها و دوره‌های آموزشی منتخب از دانشگاه‌ها و رسانه‌های معتبر جهان؛ یک‌جا، دسته‌بندی‌شده و آماده برای یادگیری عمیق.</p>
          <div className="intl-courses-hero__actions">
            <button type="button" className="intl-courses-primary-button" onClick={() => document.getElementById('intl-course-catalog')?.scrollIntoView({ behavior: 'smooth' })}>کشف دوره‌ها <Icon name="arrow" className="h-4 w-4" /></button>
            <button type="button" className="intl-courses-hero__text-button" onClick={() => setShowFeaturedOnly()}><Icon name="spark" className="h-4 w-4" /> {showFeaturedOnly ? 'نمایش همه دوره‌ها' : 'منتخب سردبیر'}</button>
          </div>
        </div>
        <div className="intl-courses-hero__visual" aria-hidden="true">
          <div className="intl-courses-orbit intl-courses-orbit--one" />
          <div className="intl-courses-orbit intl-courses-orbit--two" />
          <div className="intl-courses-hero__globe"><Icon name="globe" className="h-24 w-24" /><span>INTL<br /><small>LEARNING</small></span></div>
          <span className="intl-courses-floating-label intl-courses-floating-label--one">UNIVERSITIES</span>
          <span className="intl-courses-floating-label intl-courses-floating-label--two">OPEN MEDIA</span>
          <span className="intl-courses-floating-label intl-courses-floating-label--three">420 H</span>
        </div>
      </div>

      <div className="intl-courses-stats" aria-label="آمار دوره‌های بین‌الملل">
        {STATS.map((stat) => <div className="intl-courses-stat" key={stat.label}><span className="intl-courses-stat__icon"><Icon name={stat.icon} className="h-4 w-4" /></span><strong>{toFa(stat.value)}+</strong><span>{stat.label}</span></div>)}
      </div>

      <section className="intl-courses-featured" aria-labelledby="intl-featured-title">
        <div className="intl-courses-featured__visual"><CourseArtwork course={COURSES[0]} /></div>
        <div className="intl-courses-featured__copy">
          <span className="intl-courses-section-kicker">شروع پیشنهادی تپش</span>
          <h2 id="intl-featured-title">نگاهی جهانی به سلامت</h2>
          <p>یک مسیر هشت‌ساعته برای فهم چالش‌های سلامت عمومی از نگاه دانشگاه هاروارد؛ مناسب برای شروع سفر یادگیری بین‌المللی.</p>
          <div className="intl-courses-featured__meta"><span><Icon name="clock" className="h-4 w-4" /> ۸ ساعت</span><span><Icon name="play" className="h-4 w-4" /> ۲۴ ویدیو</span><span><Icon name="book" className="h-4 w-4" /> سطح مقدماتی</span></div>
          <button type="button" className="intl-courses-featured__button" onClick={() => setSelectedCourse(COURSES[0])}>ورود به دوره <Icon name="arrow" className="h-4 w-4" /></button>
        </div>
      </section>

      <section id="intl-course-catalog" className="intl-courses-catalog" aria-labelledby="intl-catalog-title">
        <div className="intl-courses-catalog__heading"><div><span className="intl-courses-section-kicker">کتابخانه بین‌المللی</span><h2 id="intl-catalog-title">دوره مناسب خودت را پیدا کن</h2></div><span className="intl-courses-catalog__count">{toFa(filteredCourses.length)} دوره قابل نمایش</span></div>
        <div className="intl-courses-toolbar">
          <label className="intl-courses-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی دوره، دانشگاه یا موضوع..." aria-label="جست‌وجوی دوره‌ها" /></label>
          <div className="intl-courses-filters" role="tablist" aria-label="دسته‌بندی دوره‌ها">{FILTERS.map((filter) => <button type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? 'is-active' : ''} key={filter.id} onClick={() => setActiveFilter(filter.id)}>{filter.label}</button>)}</div>
        </div>
        {filteredCourses.length > 0 ? <div className="intl-courses-grid">{filteredCourses.map((course) => <CourseCard key={course.id} course={course} onOpen={setSelectedCourse} />)}</div> : <div className="intl-courses-empty"><Icon name="search" className="h-7 w-7" /><strong>دوره‌ای با این مشخصات پیدا نشد</strong><span>عبارت جست‌وجو یا فیلتر را تغییر بده و دوباره امتحان کن.</span></div>}
      </section>

      <section className="intl-courses-sources" aria-labelledby="intl-sources-title">
        <div><span className="intl-courses-section-kicker">منابع قابل اعتماد</span><h2 id="intl-sources-title">یادگیری از جایی که اعتبار دارد</h2><p>هر دوره با نام منبع، زبان محتوا و مسیر یادگیری مشخص وارد کتابخانه تپش می‌شود تا بدانی چه چیزی می‌بینی و از کجا آمده است.</p></div>
        <div className="intl-courses-source-list"><span>HARVARD</span><span>MIT OCW</span><span>CAMBRIDGE</span><span>OXFORD</span><span>BBC LEARNING</span></div>
      </section>
    </section>
  );
}
