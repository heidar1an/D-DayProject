/*
 * لایهٔ «دوره‌های بین‌الملل» — کاتالوگ، صفحهٔ دوره و لایهٔ منبع (دانشگاه).
 *
 * دادهٔ این لایه از پنل می‌آید: `loadIntlCatalog()` مسیر عمومی
 * `/api/public/intl-courses/library` را می‌خواند و نسخهٔ منتشرشدهٔ پنل **جای**
 * کاتالوگ ثابت را می‌گیرد (همان قرارداد `/api/public/micro/library`). تا وقتی
 * پاسخ سرور نرسیده — یا سرور در دسترس نیست — کاتالوگ ثابت `intlCatalog.js`
 * رندر می‌شود تا لایه هرگز خالی نماند.
 *
 * آدرس تصویر و لوگو دو جا می‌تواند باشد: فایل آپلودی پنل (`image`/`logo`) یا
 * دارایی باندل‌شدهٔ خود پروژه (`imageKey`/`logoKey`). حل این آدرس در
 * `intlAssets.js` انجام می‌شود و `intlCoursesService` آن را روی هر رکورد
 * می‌نشاند، پس این فایل با آدرس آماده کار می‌کند.
 *
 * ویدیو: هر بخش (ویدیو) ممکن است `videoUrl` داشته باشد. اگر داشته باشد پخش‌کنندهٔ
 * واقعی `<video>` با مسیرهای زیرنویس همان بخش رندر می‌شود؛ اگر نداشته باشد
 * قاب تصویری قبلی می‌ماند تا صفحه خالی نشود.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './internationalCourses.css';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import { createNote } from '../../../services/notes/notesService';
import { catalogFilters, loadIntlCatalog, staticCatalog } from '../../../services/international/intlCoursesService';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/* سرعت‌های پخش‌کنندهٔ داخلی سایت */
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

/*
 * ارتفاع متن زیرنویس روی ویدیو — درصد از **بالای** قاب.
 *
 * مرورگر با `line: auto` زیرنویس را می‌چسباند به پایین قاب، یعنی دقیقاً روی نوار
 * کنترل؛ عددی که می‌دهیم فقط وقتی به‌عنوان درصد حساب می‌شود که `snapToLines`
 * خاموش باشد. ۷۴٪ یعنی بالای نوار کنترل و با فاصلهٔ راحت از لبهٔ پایین.
 */
const SUBTITLE_LINE_PERCENT = 74;

/* زمان ویدیو به شکل `mm:ss` (یا `h:mm:ss`) با رقم فارسی */
function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const pad = (value) => String(value).padStart(2, '0');
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const hours = Math.floor(total / 3600);
  return toFa(hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`);
}

/* نمای پیش‌فرض لایه — کاتالوگ با فیلتر «همه دوره‌ها».
   باید ثابت و بیرون از کامپوننت بماند (قرارداد useLayerRoute). */
const INTL_COURSES_VIEW = { name: 'catalog', filter: 'all' };

/*
 * فهرست ثابت دوره‌ها — از «دوره‌های من» هم به همین منبع لینک می‌شود
 * (`myCoursesCatalog.js`). شکل خروجی همان کاتالوگ باندل‌شده است، نه نسخهٔ
 * پنل؛ این فهرست فقط برای اتصال‌های همگام (سینک) لازم است.
 */
export const COURSES = staticCatalog().courses;

/* نوار بی‌پایان: فهرست **چهار بار** تکرار می‌شود و انیمیشن فقط به اندازهٔ یک نسخه
   (۲۵٪ کل ترک) جابه‌جا می‌شود. با دو نسخه، به‌ازای صفحه‌های پهن، «یک نسخه» از پنجرهٔ
   دید باریک‌تر می‌شد و انتهای چرخه جای خالی دیده می‌شد. */
const MARQUEE_REPEAT = 4;

/* منبع‌هایی که در نوار می‌آیند، به ترتیب `marqueeOrder` (صفر یعنی در نوار نیاید) */
function marqueeSources(providers) {
  return providers
    .filter((provider) => Number(provider.marqueeOrder) > 0 && provider.logo)
    .sort((a, b) => Number(a.marqueeOrder) - Number(b.marqueeOrder));
}

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
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="8.7" /><path d="M12 7v5l3.2 2" /></svg>;
  if (name === 'pause') return <svg {...common}><path d="M9 6v12M15 6v12" /></svg>;
  if (name === 'volume') return <svg {...common}><path d="M5 10v4h3l4 3V7l-4 3H5Z" /><path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.2 7.2 0 0 1 0 10" /></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3.1" /><path d="M12 3v2.4M12 18.6V21M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /></svg>;
  if (name === 'chevron') return <svg {...common}><path d="M15 6l-6 6 6 6" /></svg>;
  if (name === 'more') return <svg {...common}><circle cx="6" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="18" cy="12" r="1" fill="currentColor" /></svg>;
  if (name === 'heart') return <svg {...common}><path d="M20.8 8.7c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" /></svg>;
  if (name === 'flag') return <svg {...common}><path d="M6 21V4" /><path d="M6 4h11l-2.2 4L17 12H6" /></svg>;
  if (name === 'expand') return <svg {...common}><path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" /></svg>;
  if (name === 'speed') return <svg {...common}><path d="M12 20a8 8 0 1 1 8-8" /><path d="m12 12 3.6-3.6" /></svg>;
  if (name === 'bright') return <svg {...common}><circle cx="12" cy="12" r="3.8" /><path d="M12 2.9v2M12 19.1v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.9 12h2M19.1 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (name === 'subtitle') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2.4" /><path d="M6.6 14h4.2M13.2 14h4.2" /></svg>;
  if (name === 'note') return <svg {...common}><path d="M4 20h4L18 10l-4-4L4 16v4Z" /><path d="m14.4 5.6 4 4" /></svg>;
  return null;
}

function CourseCard({ course, onOpen }) {
  return (
    <article className="intl-courses-card" style={{ '--course-accent': course.accent, '--course-soft': course.accentSoft }}>
      {/* بخش تصویر کارت: تصویر واقعی دوره + پردهٔ تیره تا عنوان روی آن خوانا بماند */}
      <div className="intl-courses-card__artwork-wrap">
        {course.image ? (
          <img className="intl-courses-card__photo" src={course.image} alt="" loading="lazy" decoding="async" />
        ) : null}
        <span className="intl-courses-card__shade" aria-hidden="true" />
        <span className="intl-courses-card__title">{course.title}</span>
      </div>

      <div className="intl-courses-card__body">
        <div className="intl-courses-card__provider">
          {course.providerLogo ? (
            <img className="intl-courses-card__provider-logo" src={course.providerLogo} alt="" loading="lazy" decoding="async" />
          ) : null}
          <span>{course.provider || 'منبع بین‌الملل'}</span>
        </div>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <div className="intl-courses-card__meta">
          <span><Icon name="clock" className="h-3.5 w-3.5" /> {toFa(course.duration)} ساعت</span>
          <span><Icon name="play" className="h-3.5 w-3.5" /> {toFa(course.lessons)} ویدیو</span>
          {course.progress > 0 && (
            <div className="intl-courses-card__progress-track" aria-label={`پیشرفت ${toFa(course.progress)} درصد`}>
              <i style={{ width: `${course.progress}%` }} />
            </div>
          )}
        </div>
        <button type="button" className="intl-courses-card__enter" onClick={() => onOpen(course.id)}>
          <Icon name="play" className="h-3.5 w-3.5" />
          ورود به دوره
        </button>
      </div>
    </article>
  );
}

/*
 * انیمیشن کوتاه تعویض آیکون (پخش ⇄ توقف).
 *
 * با Web Animations API انجام می‌شود، نه با `animation` در CSS: گارد
 * `prefers-reduced-motion` این لایه همهٔ انیمیشن‌های CSS را خاموش می‌کند و روی
 * مکِ کاربر «کاهش حرکت» روشن است ⇒ انیمیشن CSS اصلاً دیده نمی‌شد.
 */
function pulseIcon(node) {
  if (!node?.animate) return;
  node.animate(
    [{ opacity: 0, transform: 'scale(0.55)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: 260, easing: 'ease-out' },
  );
}

function PlayGlyph({ playing, className = 'h-4 w-4' }) {
  const ref = useRef(null);
  useEffect(() => { pulseIcon(ref.current); }, [playing]);
  return (
    <span className="intl-course-player__glyph" ref={ref}>
      <Icon name={playing ? 'pause' : 'play'} className={className} />
    </span>
  );
}

/*
 * تنظیم عددی (صدا/نور) — آیکون در نوار کنترل می‌ماند و با کلیک، یک نوار
 * **عمودی** بالای همان آیکون باز می‌شود؛ درصد بالای نوار نوشته می‌شود.
 */
function PlayerSlider({ label, icon, value, onChange, open, onToggle, min = 0, max = 100 }) {
  return (
    <span className="intl-course-player__popover">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        className={open ? 'is-active' : ''}
        onClick={onToggle}
      >
        <Icon name={icon} className="h-4 w-4" />
      </button>
      {open && (
        <span className="intl-course-player__slider" role="group" aria-label={label}>
          <span className="intl-course-player__slider-value">{toFa(Math.round(value))}٪</span>
          <input
            type="range"
            className="intl-course-player__range"
            min={min}
            max={max}
            step={5}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label={label}
          />
        </span>
      )}
    </span>
  );
}

/*
 * پخش‌کنندهٔ ویدیو.
 *
 * اگر برای این بخش ویدیویی در پنل بارگذاری شده باشد، پخش‌کنندهٔ واقعی مرورگر
 * می‌آید و هر زیرنویسِ همان بخش یک `<track>` می‌شود. اگر نه، همان قاب تصویری
 * قبلی با کنترل‌های نمایشی می‌ماند تا دوره‌های بدون ویدیو هم قابل مرور باشند.
 */
function CoursePlayer({ course, lesson, lessonIndex, sectionCount }) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [brightness, setBrightness] = useState(100);
  const [subtitle, setSubtitle] = useState(null);
  const [rate, setRate] = useState(1);
  /*
   * فقط **یک** کادر شناور هم‌زمان باز است: `'volume' | 'bright' | 'subtitle' | 'rate'`.
   * چون همه از یک state می‌خوانند، باز کردن هر کدام، قبلی را خودکار می‌بندد.
   */
  const [panel, setPanel] = useState(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const shellRef = useRef(null);
  const videoRef = useRef(null);
  const subtitleRef = useRef(null);
  const trackListRef = useRef([]);

  /*
   * زیرنویس‌های همین بخش — تنها مرجع فهرست زیرنویس‌ها.
   * هر زبانی که مدیر بارگذاری کرده باشد اینجا هست و هر زبانی که فایل ندارد
   * اصلاً دیده نمی‌شود؛ پس منو همیشه با واقعیتِ بارگذاری‌شده یکی است.
   */
  const lessonTracks = lesson.subtitles ?? [];

  /*
   * زیرنویس واقعی: هر `<track>` یک کانال مرورگر است و فقط یکی می‌تواند
   * `showing` باشد. انتخاب با **ترتیب** انجام می‌شود (نه با `track.language`)
   * چون زبان کانال تا لود شدن فایل خالی است و تطبیق با زبان، بی‌صدا شکست
   * می‌خورد. حالت‌ها از همین‌جا ست می‌شوند، نه با اتریبیوت `default`.
   */
  /*
   * جای متن زیرنویس و چیدمانش را روی خود کانال‌ها می‌نشانیم.
   *
   * `::cue` فقط ظاهر (فونت/رنگ/پس‌زمینه) را عوض می‌کند و راهی برای جابه‌جایی
   * ندارد؛ مکان با ویژگی‌های خودِ `VTTCue` تعیین می‌شود. `snapToLines = false`
   * لازم است وگرنه `line` به‌جای درصد، شمارهٔ خط از پایین حساب می‌شود.
   */
  const styleCues = useCallback((node) => {
    const tracks = node?.textTracks ?? [];
    for (let index = 0; index < tracks.length; index += 1) {
      const cues = tracks[index].cues;
      if (!cues) continue;
      for (let position = 0; position < cues.length; position += 1) {
        const cue = cues[position];
        cue.snapToLines = false;
        cue.line = SUBTITLE_LINE_PERCENT;
        cue.position = 50;
        cue.size = 88;
        cue.align = 'center';
      }
    }
  }, []);

  const applySubtitle = useCallback((value) => {
    const node = videoRef.current;
    if (!node) return;
    const list = trackListRef.current ?? [];
    const index = value ? list.findIndex((item) => item.lang === value) : -1;
    const tracks = node.textTracks ?? [];
    for (let position = 0; position < tracks.length; position += 1) {
      const track = tracks[position];
      track.mode = position === index ? 'showing' : 'disabled';
      /*
       * فایل زیرنویس ممکن است بعد از `canplay` برسد؛ با هر بار عوض شدن کوی فعال
       * دوباره جای‌گذاری می‌کنیم تا کوی اول هم جابه‌جا شود.
       */
      if (position === index && !track.tapeshCueStyled) {
        track.tapeshCueStyled = true;
        track.addEventListener('cuechange', () => styleCues(node));
      }
    }
    styleCues(node);
  }, [styleCues]);

  /* با عوض شدن ویدیو، فهرست کانال‌ها به‌روز و اولین زیرنویس روشن می‌شود */
  useEffect(() => {
    trackListRef.current = lessonTracks;
    setSubtitle(lessonTracks[0]?.lang ?? null);
  }, [lesson.id, lessonTracks.length]);

  /*
   * موتور پخش: همهٔ حالت‌ها از رویدادهای خود عنصر ویدیو می‌آیند.
   * وابستگی به `lesson.id` عمدی است — با عوض شدن ویدیو، عنصر با `key` نو
   * ساخته می‌شود و باید دوباره به رویدادها وصل شویم.
   */
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return undefined;

    const sync = () => {
      setPlaying(!node.paused && !node.ended);
      setCurrent(node.currentTime || 0);
      setDuration(Number.isFinite(node.duration) ? node.duration : 0);
    };
    const syncBuffered = () => {
      const ranges = node.buffered;
      setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
    };
    const onWaiting = () => setWaiting(true);
    const onReady = () => { setWaiting(false); applySubtitle(subtitleRef.current); };

    node.addEventListener('timeupdate', sync);
    node.addEventListener('durationchange', sync);
    node.addEventListener('loadedmetadata', sync);
    node.addEventListener('play', sync);
    node.addEventListener('pause', sync);
    node.addEventListener('ended', sync);
    node.addEventListener('progress', syncBuffered);
    node.addEventListener('waiting', onWaiting);
    node.addEventListener('playing', onReady);
    node.addEventListener('canplay', onReady);
    node.addEventListener('loadeddata', onReady);

    /* عنصری که از قبل بافر شده باشد رویداد تازه نمی‌دهد */
    if (node.readyState >= 1) { sync(); syncBuffered(); }

    return () => {
      node.removeEventListener('timeupdate', sync);
      node.removeEventListener('durationchange', sync);
      node.removeEventListener('loadedmetadata', sync);
      node.removeEventListener('play', sync);
      node.removeEventListener('pause', sync);
      node.removeEventListener('ended', sync);
      node.removeEventListener('progress', syncBuffered);
      node.removeEventListener('waiting', onWaiting);
      node.removeEventListener('playing', onReady);
      node.removeEventListener('canplay', onReady);
      node.removeEventListener('loadeddata', onReady);
    };
  }, [lesson.id, applySubtitle]);

  /* ویدیوی تازه = پخش‌کننده از صفر */
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setBuffered(0);
    setWaiting(false);
  }, [lesson.id]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    node.volume = Math.min(1, Math.max(0, volume / 100));
    node.muted = volume === 0;
  }, [volume, lesson.id]);

  useEffect(() => {
    const node = videoRef.current;
    if (node) node.playbackRate = rate;
  }, [rate, lesson.id]);

  useEffect(() => {
    subtitleRef.current = subtitle;
    applySubtitle(subtitle);
  }, [subtitle, applySubtitle]);

  /*
   * کلیک بیرون ⇒ بستن کادر شناور.
   *
   * روی `document` گوش می‌دهیم (نه روی خود پخش‌کننده) تا کلیک روی هر جای دیگر
   * صفحه هم ببندد. اگر هدف کلیک داخل یک دکمهٔ بازکننده یا داخل خود کادر باشد،
   * دست نمی‌زنیم: کلیک روی دکمه باید خودش خاموش/روشن کند و کشیدن نوار عمودی هم
   * نباید وسط کار کادر را ببندد.
   */
  useEffect(() => {
    if (!panel) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.intl-course-player__popover, .intl-course-player__subtitle')) return;
      setPanel(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [panel]);

  const togglePanel = (name) => setPanel((current) => (current === name ? null : name));

  const togglePlay = () => {
    const node = videoRef.current;
    /* قاب بدون ویدیو فقط نمایشی است؛ آنجا حالت محلی کافی است */
    if (!node) { setPlaying((value) => !value); return; }
    if (node.paused || node.ended) node.play().catch(() => { /* سیاست پخش مرورگر */ });
    else node.pause();
  };

  /*
   * کلیک روی سطح ویدیو: اگر کادری باز است فقط همان را می‌بندد، وگرنه پخش/توقف.
   * وگرنه کاربری که برای بستن کادر صدا روی ویدیو کلیک می‌کند، ناخواسته ویدیو را
   * هم متوقف می‌کرد.
   */
  const onSurfaceClick = () => (panel ? setPanel(null) : togglePlay());

  const toggleFullscreen = () => {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else node.requestFullscreen?.();
  };

  /* جابه‌جایی روی خط زمان. نوار `direction: ltr` است، پس نسبت از لبهٔ چپ است. */
  const seekTo = (ratio) => {
    const node = videoRef.current;
    const total = Number.isFinite(node?.duration) ? node.duration : 0;
    if (!node || !total) return;
    const next = Math.min(total, Math.max(0, ratio * total));
    node.currentTime = next;
    setCurrent(next);
  };

  const seekFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    seekTo((event.clientX - rect.left) / rect.width);
  };

  const seekByStep = (event) => {
    if (!duration) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); seekTo((current + 5) / duration); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); seekTo((current - 5) / duration); }
    else if (event.key === 'Home') { event.preventDefault(); seekTo(0); }
    else if (event.key === 'End') { event.preventDefault(); seekTo(1); }
  };

  const elapsedPercent = duration ? Math.min(100, (current / duration) * 100) : 0;
  const bufferedPercent = duration ? Math.min(100, (buffered / duration) * 100) : 0;
  const rateMenu = (
    <span className="intl-course-player__popover">
      <button
        type="button"
        aria-label="سرعت پخش"
        aria-expanded={panel === 'rate'}
        className={rate !== 1 ? 'is-active' : ''}
        onClick={() => togglePanel('rate')}
      >
        <Icon name="speed" className="h-4 w-4" />
      </button>
      {panel === 'rate' && (
        <span className="intl-course-player__menu" role="menu" aria-label="انتخاب سرعت پخش">
          {PLAYBACK_RATES.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitemradio"
              aria-checked={rate === item}
              onClick={() => { setRate(item); setPanel(null); }}
            >
              {toFa(String(item))}×
            </button>
          ))}
        </span>
      )}
    </span>
  );

  /* ── پخش‌کنندهٔ داخلی سایت (ویدیوی واقعی، کنترل‌های خودمان) ── */
  if (lesson.videoUrl) {
    return (
      <div className="intl-course-player intl-course-player--video" ref={shellRef}>
        <video
          key={lesson.id}
          ref={videoRef}
          className="intl-course-player__video"
          src={lesson.videoUrl}
          poster={course.image || undefined}
          preload="metadata"
          playsInline
          style={{ filter: `brightness(${brightness / 100})` }}
          onClick={onSurfaceClick}
        >
          {lessonTracks.map((track) => (
            <track
              key={track.lang}
              kind="subtitles"
              src={track.url}
              srcLang={track.lang}
              label={track.label || track.lang}
            />
          ))}
        </video>

        {/*
          لایهٔ روی ویدیو: دکمهٔ بزرگ پخش وقتی متوقف است، و پیام بارگذاری.
          هر دو از خود عنصر ویدیو خبر می‌گیرند، نه از حالت حدسی.
        */}
        {!playing && (
          <button
            type="button"
            className="intl-course-player__play"
            aria-label="پخش ویدیو"
            onClick={onSurfaceClick}
          >
            <PlayGlyph playing={playing} className="h-8 w-8" />
          </button>
        )}
        {waiting && <span className="intl-course-player__caption">در حال بارگذاری…</span>}

        {/*
          چیدمان نوار (راست‌به‌چپ: اولین عنصر در DOM، سمت راست می‌نشیند):
          تنظیم‌های پخش (صدا، نور، سرعت) سمت **راست**، خط زمان میانه، و
          پخش/توقف + زمان + زیرنویس + تمام‌صفحه سمت **چپ**.
        */}
        <div className="intl-course-player__controls">
          <PlayerSlider
            label="صدا"
            icon="volume"
            value={volume}
            onChange={setVolume}
            open={panel === 'volume'}
            onToggle={() => togglePanel('volume')}
          />
          <PlayerSlider
            label="نور"
            icon="bright"
            value={brightness}
            onChange={setBrightness}
            min={50}
            open={panel === 'bright'}
            onToggle={() => togglePanel('bright')}
          />
          {rateMenu}

          {/* خط زمان: کلیک و کلیدهای جهت‌دار برای جابه‌جایی */}
          <div
            className="intl-course-player__progress is-live"
            role="slider"
            tabIndex={0}
            aria-label="نوار پیشرفت ویدیو"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            aria-valuetext={`${formatClock(current)} از ${formatClock(duration)}`}
            onClick={seekFromPointer}
            onKeyDown={seekByStep}
          >
            <i className="intl-course-player__buffered" style={{ width: `${bufferedPercent}%` }} />
            <span style={{ width: `${elapsedPercent}%` }} />
          </div>

          {/* پخش/توقف کنار زمان ویدیو */}
          <button type="button" aria-label={playing ? 'توقف ویدیو' : 'پخش ویدیو'} aria-pressed={playing} onClick={togglePlay}>
            <PlayGlyph playing={playing} />
          </button>
          <span className="intl-course-player__time">
            {formatClock(current)} / {duration ? formatClock(duration) : lesson.time || '—'}
          </span>

          {/* آیکون زیرنویس همیشه در نوار هست؛ داخل منو فقط زیرنویس‌های
              بارگذاری‌شده می‌آید تا فهرست با واقعیت یکی بماند. */}
          <span className="intl-course-player__subtitle">
            <button
              type="button"
              aria-label="زیرنویس"
              aria-expanded={panel === 'subtitle'}
              className={subtitle ? 'is-active' : ''}
              onClick={() => togglePanel('subtitle')}
            >
              <Icon name="subtitle" className="h-4 w-4" />
            </button>
            {panel === 'subtitle' && (
              <span className="intl-course-player__menu" role="menu" aria-label="انتخاب زبان زیرنویس">
                {lessonTracks.length === 0 ? (
                  <span className="intl-course-player__menu-empty">زیرنویسی برای این ویدیو بارگذاری نشده است</span>
                ) : (
                  <>
                    <button type="button" role="menuitemradio" aria-checked={!subtitle} onClick={() => { setSubtitle(null); setPanel(null); }}>خاموش</button>
                    {lessonTracks.map((track) => (
                      <button
                        key={track.lang}
                        type="button"
                        role="menuitemradio"
                        aria-checked={subtitle === track.lang}
                        onClick={() => { setSubtitle(track.lang); setPanel(null); }}
                      >
                        {track.label || track.lang}
                      </button>
                    ))}
                  </>
                )}
              </span>
            )}
          </span>

          <button type="button" aria-label="تمام‌صفحه" onClick={toggleFullscreen}><Icon name="expand" className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  /* ── قاب تصویری (دورهٔ بدون ویدیوی بارگذاری‌شده) ── */
  return (
    <div className="intl-course-player" aria-label={`پخش ${lesson.title}`} ref={shellRef}>
      {course.image ? (
        <img
          className="intl-course-player__image"
          src={course.image}
          alt=""
          style={{ filter: `brightness(${brightness / 100})` }}
        />
      ) : null}
      <span className="intl-course-player__shade" aria-hidden="true" />
      <button
        type="button"
        className="intl-course-player__play"
        aria-label={playing ? 'توقف ویدیو' : 'پخش ویدیو'}
        aria-pressed={playing}
        onClick={onSurfaceClick}
      >
        <PlayGlyph playing={playing} className="h-8 w-8" />
      </button>

      {/* همان چیدمان نوار ویدیوی واقعی: تنظیم‌ها راست، پخش/زمان چپ */}
      <div className="intl-course-player__controls">
        <PlayerSlider
          label="صدا"
          icon="volume"
          value={volume}
          onChange={setVolume}
          open={panel === 'volume'}
          onToggle={() => togglePanel('volume')}
        />
        <PlayerSlider
          label="نور"
          icon="bright"
          value={brightness}
          onChange={setBrightness}
          min={50}
          open={panel === 'bright'}
          onToggle={() => togglePanel('bright')}
        />

        <div className="intl-course-player__progress" aria-hidden="true">
          <span style={{ width: `${Math.round(((lessonIndex + 1) / Math.max(1, sectionCount)) * 100)}%` }} />
        </div>

        {/* پخش/توقف کنار زمان ویدیو */}
        <button type="button" aria-label={playing ? 'توقف ویدیو' : 'پخش ویدیو'} aria-pressed={playing} onClick={togglePlay}>
          <PlayGlyph playing={playing} />
        </button>
        <span className="intl-course-player__time">{lesson.time}</span>

        <span className="intl-course-player__subtitle">
          <button
            type="button"
            aria-label="زیرنویس"
            aria-expanded={panel === 'subtitle'}
            className={subtitle ? 'is-active' : ''}
            onClick={() => togglePanel('subtitle')}
          >
            <Icon name="subtitle" className="h-4 w-4" />
          </button>
          {panel === 'subtitle' && (
            <span className="intl-course-player__menu" role="menu" aria-label="انتخاب زبان زیرنویس">
              {lessonTracks.length === 0 ? (
                <span className="intl-course-player__menu-empty">زیرنویسی برای این ویدیو بارگذاری نشده است</span>
              ) : (
                <>
                  <button type="button" role="menuitemradio" aria-checked={!subtitle} onClick={() => { setSubtitle(null); setPanel(null); }}>خاموش</button>
                  {lessonTracks.map((track) => (
                    <button
                      key={track.lang}
                      type="button"
                      role="menuitemradio"
                      aria-checked={subtitle === track.lang}
                      onClick={() => { setSubtitle(track.lang); setPanel(null); }}
                    >
                      {track.label || track.lang}
                    </button>
                  ))}
                </>
              )}
            </span>
          )}
        </span>
        <button type="button" aria-label="تمام‌صفحه" onClick={toggleFullscreen}><Icon name="expand" className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/* زیر ویدیو: عنوان و توضیح همان ویدیو + یادداشت‌برداری */
function LessonInfo({ course, lesson, userId }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!body.trim()) return;
    await createNote({ id: userId }, {
      title: `یادداشت — ${lesson.title}`,
      kind: 'text',
      body,
      subjectId: course.id,
      tags: ['یادداشت ویدیو'],
      sourceType: 'lesson',
      sourceTitle: `${course.title} · ${lesson.title}`,
    });
    setBody('');
    setOpen(false);
    setSaved(true);
  };

  return (
    <section className="intl-course-lesson" aria-label="اطلاعات این ویدیو">
      <div className="intl-course-lesson__head">
        <h2>{lesson.title}</h2>
        <button type="button" className={`intl-course-lesson__note${open ? ' is-active' : ''}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); setSaved(false); }}>
          <Icon name="note" className="h-4 w-4" />
          یادداشت‌برداری
        </button>
      </div>
      <p>{lesson.desc}</p>

      {lesson.subtitles.length > 0 && (
        <p className="intl-course-lesson__subtitles">
          <Icon name="subtitle" className="h-4 w-4" />
          زیرنویس‌های این ویدیو: {lesson.subtitles.map((track) => track.label || track.lang).join(' · ')}
        </p>
      )}

      {open && (
        <div className="intl-course-lesson__form">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="نکته‌ای که می‌خواهی بمانَد…" aria-label="متن یادداشت" />
          <div>
            <button type="button" className="is-primary" onClick={save} disabled={!body.trim()}>ذخیره در یادداشت‌ها</button>
            <button type="button" onClick={() => setOpen(false)}>انصراف</button>
          </div>
        </div>
      )}
      {saved && !open && <p className="intl-course-lesson__saved">یادداشت ذخیره شد؛ در بخش «یادداشت‌ها» پیدایش می‌کنی.</p>}
    </section>
  );
}

/* سرصفحهٔ دوره — کادر اطلاعات (هشتک‌ها، عنوان، ناشر، کنش‌ها).
   طبق بازخورد کاربر این کادر **بالای ویدیوهای دوره** می‌نشیند. */
function CourseInfoHead({ course, liked, onToggleLike, onOpenProvider }) {
  return (
    <header className="intl-course-detail__head">
      <div className="intl-course-detail__tags">
        {course.tags.map((tag) => <span key={tag}>{tag}</span>)}
        <span>{course.categoryLabel}</span>
      </div>
      <h1>{course.title}</h1>
      <p className="intl-course-detail__lead">{course.description}</p>
      <div className="intl-course-detail__meta-row">
        <button type="button" className="intl-course-detail__author" onClick={() => onOpenProvider(course.providerId)}>
          {course.providerLogo ? <img src={course.providerLogo} alt="" /> : null}
          <span><strong>{course.provider || 'منبع بین‌الملل'}</strong><small>{course.providerEn}</small></span>
          <Icon name="chevron" className="h-4 w-4" />
        </button>
        <div className="intl-course-detail__actions">
          <button type="button" className={liked ? 'is-active' : ''} aria-pressed={liked} onClick={onToggleLike}>
            <Icon name="heart" className="h-4 w-4" />
            <span>{liked ? 'پسندیده شد' : 'پسندیدن'}</span>
          </button>
          <button type="button">
            <Icon name="flag" className="h-4 w-4" />
            <span>گزارش</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function CourseDetailView({ course, courses, userId, onBack, onOpenCourse, onOpenProvider }) {
  const [lessonIndex, setLessonIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const sections = course.sections ?? [];
  const lesson = sections[lessonIndex] ?? sections[0] ?? { id: 'empty', title: 'ویدیویی ثبت نشده', desc: 'برای این دوره هنوز ویدیویی در پنل بارگذاری نشده است.', time: '', subtitles: [] };
  const suggestedCourse = courses.find((item) => item.id !== course.id);

  return (
    <section className="intl-course-detail" aria-label={`دورهٔ ${course.title}`} style={{ '--course-accent': course.accent }}>
      <div className="intl-course-detail__topbar">
        <button type="button" className="intl-course-detail__back" onClick={onBack}>
          <Icon name="back" className="h-4 w-4" />
          بازگشت به دوره‌ها
        </button>
        <span className="intl-course-detail__crumb">دوره‌های بین‌الملل <b>/</b> {course.provider}</span>
      </div>

      <CourseInfoHead
        course={course}
        liked={liked}
        onToggleLike={() => setLiked((value) => !value)}
        onOpenProvider={onOpenProvider}
      />

      <div className="intl-course-detail__layout">
        <main className="intl-course-detail__main">
          <CoursePlayer course={course} lesson={lesson} lessonIndex={lessonIndex} sectionCount={sections.length} />
          <LessonInfo course={course} lesson={lesson} userId={userId} />
        </main>

        <aside className="intl-course-detail__aside">
          <section className="intl-course-playlist" aria-labelledby="intl-playlist-title">
            <header>
              <div><h2 id="intl-playlist-title">محتوای دوره</h2><span>{toFa(sections.length)} ویدیو · {course.level}</span></div>
              <button type="button" aria-label="گزینه‌های فهرست"><Icon name="more" className="h-4 w-4" /></button>
            </header>
            {sections.length > 0 ? (
              <ol>
                {sections.map((item, index) => (
                  <li key={item.id} className={index === lessonIndex ? 'is-active' : ''}>
                    <button type="button" onClick={() => setLessonIndex(index)} aria-current={index === lessonIndex ? 'true' : undefined}>
                      <span className="intl-course-playlist__frame">
                        {course.image ? <img src={course.image} alt="" /> : null}
                        <span className="intl-course-playlist__time">{item.time}</span>
                        {item.videoUrl ? <span className="intl-course-playlist__ready">ویدیو آماده</span> : null}
                      </span>
                      <span className="intl-course-playlist__title">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="intl-course-playlist__empty">برای این دوره هنوز بخشی ثبت نشده است.</p>
            )}
          </section>

          <section className="intl-course-suggestions" aria-labelledby="intl-suggestions-title">
            <h2 id="intl-suggestions-title">دوره‌های پیشنهادی</h2>
            {suggestedCourse && (
              <button type="button" className="intl-course-suggestion" onClick={() => onOpenCourse(suggestedCourse.id)}>
                {suggestedCourse.image ? <img src={suggestedCourse.image} alt="" /> : null}
                <span><strong>{suggestedCourse.title}</strong><small>{suggestedCourse.description}</small></span>
              </button>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

/* لایهٔ «منبع» — با کلیک روی نام دانشگاه/نهاد باز می‌شود: معرفی منبع + دوره‌های همان منبع در تپش. */
function ProviderView({ provider, courses, onBack, onOpenCourse }) {
  const ownCourses = courses.filter((course) => course.providerId === provider.id);
  const head = ownCourses[0];
  const siblingCourses = head
    ? courses.filter((course) => course.providerId !== provider.id && course.category === head.category)
    : [];

  return (
    <section className="intl-provider" aria-label={`منبع ${provider.name}`} style={{ '--course-accent': head?.accent ?? provider.accent }}>
      <div className="intl-course-detail__topbar">
        <button type="button" className="intl-course-detail__back" onClick={onBack}>
          <Icon name="back" className="h-4 w-4" />
          بازگشت
        </button>
        <span className="intl-course-detail__crumb">منابع بین‌الملل <b>/</b> {provider.name}</span>
      </div>

      <header className="intl-provider__hero">
        {provider.logo ? <img className="intl-provider__logo" src={provider.logo} alt="" /> : null}
        <div className="intl-provider__identity">
          <h1>{provider.name}</h1>
          <span>{provider.nameEn}</span>
          <div className="intl-provider__facts">
            {provider.country ? <span>کشور: {provider.country}</span> : null}
            {provider.founded ? <span>سال بنیان: {provider.founded}</span> : null}
            <span>{toFa(ownCourses.length)} دوره در تپش</span>
          </div>
        </div>
        {provider.description ? <p className="intl-provider__description">{provider.description}</p> : null}
        {provider.focus.length > 0 && (
          <div className="intl-provider__focus">
            {provider.focus.map((item) => <span key={item}>{item}</span>)}
          </div>
        )}
      </header>

      {ownCourses.length > 0 && (
        <section className="intl-provider__courses" aria-labelledby="intl-provider-courses-title">
          <h2 id="intl-provider-courses-title">دوره‌های این منبع در تپش</h2>
          <div className="intl-courses-grid">
            {ownCourses.map((course) => <CourseCard key={course.id} course={course} onOpen={onOpenCourse} />)}
          </div>
        </section>
      )}

      {siblingCourses.length > 0 && (
        <section className="intl-provider__courses" aria-labelledby="intl-provider-related-title">
          <h2 id="intl-provider-related-title">دوره‌های مرتبط در همین حوزه</h2>
          <div className="intl-courses-grid">
            {siblingCourses.map((course) => <CourseCard key={course.id} course={course} onOpen={onOpenCourse} />)}
          </div>
        </section>
      )}
    </section>
  );
}

export default function InternationalCoursesLayer({ userId = 'guest', onBack }) {
  /* فیلتر و دورهٔ باز روی مسیر داشبورد می‌نشینند؛ متن کادر جست‌وجو محلی می‌ماند */
  const [view, setView, patchView] = useLayerRoute(LAYER_IDS.intlCourses, INTL_COURSES_VIEW);
  const [query, setQuery] = useState('');
  /* شروع با کاتالوگ ثابت (بدون پرش)، بعد نسخهٔ پنل جای آن را می‌گیرد */
  const [catalog, setCatalog] = useState(staticCatalog);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;

    loadIntlCatalog({ force: refreshKey > 0 })
      .then((next) => { if (alive) setCatalog(next); })
      .catch(() => { /* کاتالوگ ثابت سرجایش می‌ماند */ });

    return () => { alive = false; };
  }, [refreshKey]);

  const courses = catalog.courses;
  const providers = catalog.providers;
  const filters = useMemo(() => catalogFilters(courses), [courses]);

  const activeFilter = filters.some((filter) => filter.id === view.filter) ? view.filter : 'all';
  const selectedCourse = view.name === 'detail' ? courses.find((course) => course.id === view.courseId) : null;
  const selectedProvider = view.name === 'provider' ? providers.find((provider) => provider.id === view.providerId) : null;

  const setActiveFilter = (filter) => patchView({ name: 'catalog', filter });
  const openCourse = (courseId) => setView({ name: 'detail', courseId, filter: activeFilter });
  const closeCourse = () => setView({ name: 'catalog', filter: activeFilter });
  const openProvider = (providerId) => setView({ name: 'provider', providerId, fromCourseId: view.courseId, filter: activeFilter });
  const closeProvider = () => setView(
    view.fromCourseId
      ? { name: 'detail', courseId: view.fromCourseId, filter: activeFilter }
      : { name: 'catalog', filter: activeFilter },
  );

  /* جابه‌جایی نماها باید از بالای لایه شروع شود؛ اسکرول باید **بعد از** رندر انجام شود،
     وگرنه مرورگر ارتفاع صفحهٔ قبلی را نگه می‌دارد و نما از میان لایه باز می‌شود. */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view.name, view.courseId, view.providerId]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    return courses.filter((course) => {
      const matchesFilter = activeFilter === 'all' || course.category === activeFilter;
      const matchesQuery = !normalizedQuery || [course.title, course.provider, course.providerEn, ...course.tags]
        .some((value) => String(value ?? '').toLocaleLowerCase('fa').includes(normalizedQuery));
      return matchesFilter && matchesQuery;
    });
  }, [courses, activeFilter, query]);

  const sources = useMemo(() => marqueeSources(providers), [providers]);
  /* نوار بی‌پایان: فهرست چند بار تکرار می‌شود (توضیح `MARQUEE_REPEAT`) */
  const marqueeLogos = useMemo(
    () => Array.from({ length: MARQUEE_REPEAT }).flatMap(() => sources),
    [sources],
  );

  if (selectedCourse) {
    return (
      <section dir="rtl" aria-label={`دورهٔ ${selectedCourse.title}`} className="intl-courses-layer">
        <CourseDetailView
          course={selectedCourse}
          courses={courses}
          userId={userId}
          onBack={closeCourse}
          onOpenCourse={openCourse}
          onOpenProvider={openProvider}
        />
      </section>
    );
  }

  if (selectedProvider) {
    return (
      <section dir="rtl" aria-label="منبع بین‌الملل" className="intl-courses-layer">
        <ProviderView provider={selectedProvider} courses={courses} onBack={closeProvider} onOpenCourse={openCourse} />
      </section>
    );
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

      {/* سربرگ وسط‌چین — عین تیتر هیروی بخش فلش‌کارت */}
      <header className="intl-courses-hero dash-stagger">
        <h1 className="intl-courses-hero__title">
          <span className="intl-courses-hero__title-top">یادگیری فراتر از مرزها</span>
          <span className="intl-courses-hero__title-accent">دانش جهانی، به زبان تپش</span>
        </h1>
        <p className="intl-courses-hero__subtitle">ویدیوها و دوره‌های آموزشی منتخب از دانشگاه‌ها و رسانه‌های معتبر جهان؛ یک‌جا، دسته‌بندی‌شده و آماده برای یادگیری عمیق.</p>
      </header>

      {/* نوار لوگوهای متحرک — یک ردیف بی‌پایان از مراجع آموزش پزشکی جهان.
          `loading="lazy"` اینجا ممنوع است: مرورگر تصمیم تنبل‌بودن را از **جای چیدمانی**
          تصویر می‌گیرد و ترکِ نوار با `transform` جابه‌جا می‌شود، پس تصویرهایی که در
          چیدمان بیرون از پنجره‌اند هیچ‌وقت وارد پنجره نمی‌شوند و هرگز بارگذاری نمی‌شوند
          (نتیجه: انتهای هر نسخه خالی می‌ماند و نوار «تمام» به نظر می‌رسد). */}
      {marqueeLogos.length > 0 && (
        <div className="intl-courses-marquee" aria-label="دانشگاه‌ها و مراجع آموزش پزشکی جهان">
          <div className="intl-courses-marquee__track">
            {marqueeLogos.map((source, index) => (
              <span className="intl-courses-marquee__logo" key={`${source.id}-${index}`} aria-hidden={index >= sources.length ? 'true' : undefined}>
                <img src={source.logo} alt={source.name} loading="eager" decoding="async" />
              </span>
            ))}
          </div>
        </div>
      )}

      <section id="intl-course-catalog" className="intl-courses-catalog" aria-labelledby="intl-catalog-title">
        <div className="intl-courses-catalog__heading"><h2 id="intl-catalog-title">دوره مناسب خودت را پیدا کن</h2></div>
        <div className="intl-courses-toolbar">
          <label className="intl-courses-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی دوره، دانشگاه یا موضوع..." aria-label="جست‌وجوی دوره‌ها" /></label>
          <div className="intl-courses-filters" role="tablist" aria-label="دسته‌بندی دوره‌ها">
            {filters.map((filter) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.id}
                className={activeFilter === filter.id ? 'is-active' : ''}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {filteredCourses.length > 0 ? (
          <div className="intl-courses-grid">
            {filteredCourses.map((course) => <CourseCard key={course.id} course={course} onOpen={openCourse} />)}
          </div>
        ) : (
          <div className="intl-courses-empty">
            <Icon name="search" className="h-7 w-7" />
            <strong>دوره‌ای با این مشخصات پیدا نشد</strong>
            <span>عبارت جست‌وجو یا فیلتر را تغییر بده و دوباره امتحان کن.</span>
          </div>
        )}
      </section>
    </section>
  );
}
