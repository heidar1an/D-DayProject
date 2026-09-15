/*
 * BankHome — داشبورد ورود به بانک تست. همهٔ مسیرهای تست‌زدن («چطور می‌خواهی تست بزنی؟»)
 * کارت‌های داده‌محورند و با افزودن آیتم جدید به آرایه، بدون تغییر UI اضافه می‌شوند.
 * فهرست دروس علوم پایه از لایهٔ «درسنامهٔ جامع» خوانده می‌شود تا نام‌گذاری هر دو بخش
 * یکی بماند؛ تعداد تست هر درس از خود بانک تست می‌آید.
 *
 * بالای صفحه، «انتخاب بانک» می‌نشیند: نوع بانک (کشوری / تألیفی) و رشته (پزشکی /
 * دندان‌پزشکی). این انتخاب دامنهٔ لایه است و همهٔ نماهای بعدی با آن فیلتر می‌شوند.
 */
import { BANK_KINDS, Icon, Skeleton, TRACKS, toFa } from './bankShared';
import { SUBJECTS as COMPREHENSIVE_SUBJECTS } from '../../courses/ComprehensiveCourseLayer';

/* نگاشت شناسهٔ درس‌های «درسنامهٔ جامع» به شناسهٔ درس‌های بانک تست؛
   فقط جاهایی که دو لایه هم‌نام نیستند اینجا نوشته می‌شوند. */
const BANK_SUBJECT_ID = { english: 'esl' };

/* چیپ مسیر — واحد تکرارشوندهٔ بخش «چطور می‌خواهی تست بزنی؟».
   همهٔ مسیرها در یک ردیف افقی می‌نشینند، پس چیپ فقط آیکن و عنوان را نگه می‌دارد. */
function PathChip({ icon, accent = '#61D192', title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex shrink-0 cursor-pointer snap-start items-center gap-2 whitespace-nowrap rounded-full border border-white/8 bg-[#242426] px-4 py-2.5 text-[13px] text-[#ddd] transition-colors hover:border-white/20 hover:bg-[#2a2a2c] hover:text-white"
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" style={{ color: accent }} />
      {title}
    </button>
  );
}

/* کادر مربعی درس — هم‌شکل کارت‌های لایهٔ «درسنامهٔ جامع» ولی بدون تصویر:
   عنوان، شمار جلسه/تست، نوار پیشرفت و پاصفحه. همهٔ درس‌ها فعال‌اند و کلیک،
   نمای مباحث همان درس را باز می‌کند. */
function SubjectTile({ subject, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${subject.title} — ${toFa(subject.questionCount)} تست در بانک`}
      className="group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#242426] px-3.5 py-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-white/16 hover:bg-[#2a2a2c]"
    >
      {/* هالهٔ رنگی درس — همان حس کارت‌های درسنامه، بدون تصویر */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-14 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full opacity-25 blur-3xl transition-opacity duration-300 group-hover:opacity-45"
        style={{ background: subject.accent }}
      />

      <h3
        className="relative text-2xl font-bold leading-9 [font-family:'Doran',Tahoma,sans-serif] md:text-3xl md:leading-10"
        style={{ color: subject.accent }}
      >
        {subject.title}
      </h3>

      <p className="relative mt-2 text-xs text-[#9a9a9a] md:text-[13px]">
        {toFa(subject.lessons)} درسنامه · {toFa(subject.questionCount)} تست
      </p>

      <span className="relative mt-5 h-1.5 w-2/5 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
        <span
          className="block h-full rounded-full transition-[width] duration-700"
          style={{ width: `${subject.progress}%`, background: subject.accent }}
        />
      </span>

      <span className="relative mt-2 text-xs font-bold" style={{ color: subject.accent }}>
        {toFa(subject.progress)}٪
      </span>
    </button>
  );
}

/* ── کارت انتخاب درس ── */
export function SubjectPicker({ overview, onPick }) {
  return (
    <div>
      <p className="mb-4 text-sm text-[#9a9a9a]">درس را انتخاب کن تا سؤال‌های همان درس باز شود.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {overview.subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            disabled={subject.questionCount === 0}
            onClick={() => onPick(subject.id)}
            className={`group flex items-center justify-between gap-2 rounded-2xl border border-white/8 bg-[#242426] px-4 py-3.5 text-right transition-colors ${
              subject.questionCount ? 'cursor-pointer hover:border-white/20 hover:bg-[#2a2a2c]' : 'cursor-default opacity-45'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject.accent }} aria-hidden="true" />
              <span className="truncate text-[13.5px] font-bold [font-family:'Doran',Tahoma,sans-serif]">{subject.name}</span>
            </span>
            <span className="shrink-0 text-[11px] text-[#888]">
              {subject.questionCount ? `${toFa(subject.questionCount)} سؤال` : 'به‌زودی'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── گزینهٔ یک محور انتخاب بانک ── */
function ScopeOption({ icon, title, hint, count, accent, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-right transition-colors ${
        active
          ? 'text-white'
          : 'border-white/8 bg-white/[0.02] text-[#bbb] hover:border-white/20 hover:bg-white/[0.06]'
      }`}
      style={active ? { borderColor: `${accent}80`, background: `${accent}1f` } : undefined}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
        style={{ background: `${accent}${active ? '2e' : '16'}`, color: accent }}
        aria-hidden="true"
      >
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] [font-family:'Doran',Tahoma,sans-serif]">{title}</strong>
        <span className="text-[10.5px] text-[#8a8a8a]">{count != null ? `${toFa(count)} سؤال` : hint}</span>
      </span>
      {active && <Icon name="check" className="h-4 w-4 shrink-0" style={{ color: accent }} />}
    </button>
  );
}

/* یک محور (نوع بانک یا رشته) — گزینهٔ «همه» همیشه اول است تا پیش‌فرض، کل بانک بماند */
function ScopeAxis({ label, icon, options, value, onPick, all }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-[#8a8a8a]">
        <Icon name={icon} className="h-3.5 w-3.5" style={{ color: '#61D192' }} />
        {label}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ScopeOption
          icon={all.icon}
          title={all.title}
          hint={all.hint}
          count={all.count}
          accent={all.accent}
          active={!value}
          onClick={() => onPick(null)}
        />
        {options.map((option) => (
          <ScopeOption
            key={option.id}
            icon={option.icon}
            title={option.title}
            hint={option.hint}
            count={option.count}
            accent={option.accent}
            active={value === option.id}
            onClick={() => onPick(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── «انتخاب بانک» — نوع بانک (کشوری/تألیفی) و رشته (پزشکی/دندان‌پزشکی) ──
   دو محور مستقل و ترکیب‌پذیر؛ نتیجه به‌شکل scope به سرویس می‌رود و همهٔ
   نمای‌های لایه (سال، مبحث، کاوشگر، سازنده) با همان دامنه ساخته می‌شوند. */
export function BankScopeSwitcher({ scope, onScopeChange, banks = [], tracks = [] }) {
  const total = banks.reduce((sum, entry) => sum + entry.questionCount, 0);
  const activeBank = banks.find((entry) => entry.id === scope.bankKind) ?? null;
  const activeTrack = tracks.find((entry) => entry.id === scope.track) ?? null;
  const activeLabel = [activeBank?.short, activeTrack?.short].filter(Boolean).join(' · ');

  return (
    <section
      aria-label="انتخاب بانک تست"
      className="dash-stagger rounded-[2rem] border border-white/8 bg-[#242426] p-5 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold [font-family:'Doran',Tahoma,sans-serif] md:text-lg">
            بانک تست را انتخاب کن
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-6 text-[#8a8a8a]">
            تست‌ها یا <b className="text-[#c9bdf0]">کشوری</b>‌اند یا <b className="text-[#7ee0ac]">تألیفی</b>؛ رشته هم
            علوم پایهٔ پزشکی یا دندان‌پزشکی. این انتخاب، دامنهٔ همهٔ بخش‌های بانک را تعیین می‌کند.
          </p>
        </div>
        {activeLabel && (
          <span className="tb-badge tb-badge--plain">
            <Icon name="filter" className="h-3.5 w-3.5" />
            دامنهٔ فعال: {activeLabel}
          </span>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <ScopeAxis
          label="نوع بانک"
          icon="shield"
          value={scope.bankKind}
          onPick={(id) => onScopeChange({ bankKind: id })}
          options={banks.map((entry) => ({
            id: entry.id,
            icon: entry.id === 'authored' ? 'pen' : 'shield',
            title: entry.short,
            hint: entry.label,
            count: entry.questionCount,
            accent: entry.accent,
          }))}
          all={{ icon: 'grid', title: 'همه', hint: 'هر دو بانک', count: total, accent: '#9aa5b1' }}
        />
        <ScopeAxis
          label="رشته"
          icon="stethoscope"
          value={scope.track}
          onPick={(id) => onScopeChange({ track: id })}
          options={tracks.map((entry) => ({
            id: entry.id,
            icon: entry.id === 'dentistry' ? 'tooth' : 'stethoscope',
            title: entry.short,
            hint: entry.label,
            count: entry.questionCount,
            accent: entry.accent,
          }))}
          all={{ icon: 'users', title: 'همه', hint: 'هر دو رشته', count: total, accent: '#9aa5b1' }}
        />
      </div>
    </section>
  );
}

/* ══════════════════════════ BankHome ══════════════════════════ */
export default function BankHome({ overview, scope, onScopeChange, onNavigate }) {
  if (!overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-52 rounded-[2.5rem]" />
        <Skeleton className="h-40 rounded-[2rem]" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-[1.75rem]" />
          ))}
        </div>
      </div>
    );
  }

  const { bank, user, tags } = overview;
  const banks = overview.banks ?? [];
  const tracks = overview.tracks ?? [];
  const authoredOnly = scope?.bankKind === 'authored';

  /* کادرهای مربعی دروس — عنوان، رنگ، جلسه‌ها، فصل‌ها و پیشرفت از لایهٔ «درسنامهٔ جامع»
     خوانده می‌شود تا با آن لایه هم‌شکل و هم‌نام بماند؛ تعداد تست از خود بانک تست می‌آید.
     دروسی که هنوز سؤالی در بانک ندارند کم‌رنگ و با برچسب «به‌زودی» نشان داده می‌شوند. */
  const subjectRail = COMPREHENSIVE_SUBJECTS.map((subject) => {
    const bankSubject =
      overview.subjects.find((item) => item.id === (BANK_SUBJECT_ID[subject.id] ?? subject.id)) ?? null;
    return {
      id: subject.id,
      title: subject.title,
      accent: subject.accent,
      lessons: subject.lessons,
      chapters: subject.chapters,
      progress: subject.progress,
      bankId: bankSubject?.id ?? null,
      questionCount: bankSubject?.questionCount ?? 0,
    };
  });

  const pathCards = [
    /* «سال‌به‌سال» فقط روی سؤال‌های رسمی معنا دارد؛ در بانک تألیفی این مسیر نمایش داده نمی‌شود. */
    ...(authoredOnly
      ? []
      : [
          {
            icon: 'calendar',
            title: 'آزمون‌های سال به سال',
            description: 'سؤال‌های رسمی آزمون علوم پایه، سال‌به‌سال و هم‌سو با سبک وزارت بهداشت',
            meta: `${toFa(bank.yearsCovered)} سال`,
            onClick: () => onNavigate('years'),
          },
        ]),
    {
      icon: 'layers',
      title: 'تست مبحثی',
      description: 'درس ← مبحث ← زیرمبحث را انتخاب کن و تمرین کن',
      onClick: () => onNavigate('topics'),
    },
    {
      icon: 'book',
      title: 'بر اساس درس',
      description: 'فیزیولوژی، آناتومی، بیوشیمی و سایر دروس علوم پایه',
      meta: `${toFa(bank.subjectsCovered)} درس`,
      onClick: () => onNavigate('subjects'),
    },
    {
      icon: 'spark',
      accent: '#937fcd',
      title: 'منتخب تپش',
      description: 'سؤال‌هایی که تیم محتوا برای مرور جدی انتخاب کرده است',
      meta: `${toFa(tags.featured)} سؤال`,
      onClick: () => onNavigate('browse', { filters: { tags: ['منتخب'] } }),
    },
    {
      icon: 'x',
      accent: '#e26d6d',
      title: 'غلط‌های من',
      description: user.wrongCount
        ? 'سؤال‌هایی که تا الان اشتباه زده‌ای؛ وقت مرورشان رسیده'
        : 'هنوز سؤالی اشتباه نزده‌ای',
      meta: user.wrongCount ? `${toFa(user.wrongCount)} سؤال` : null,
      onClick: () => user.wrongCount && onNavigate('browse', { filters: { status: 'wrong' } }),
    },
    {
      icon: 'heart',
      accent: '#ef9196',
      title: 'نشان‌شده‌ها',
      description: user.bookmarkCount ? 'گلچین‌های خودت برای مرور سریع' : 'سؤال‌های مهم را با قلب نشان بگیر',
      meta: user.bookmarkCount ? `${toFa(user.bookmarkCount)} سؤال` : null,
      onClick: () => user.bookmarkCount && onNavigate('browse', { filters: { status: 'bookmarked' } }),
    },
    {
      icon: 'target',
      accent: '#e0b45c',
      title: 'تست‌های پرتکرار',
      description: 'سؤال‌هایی که در آزمون‌های اخیر بیشترین تکرار را دارند',
      meta: `${toFa(tags.frequent)} سؤال`,
      onClick: () => onNavigate('browse', { filters: { tags: ['پرتکرار'] } }),
    },
    {
      icon: 'bolt',
      accent: '#ef9196',
      title: 'تست‌های چالشی',
      description: 'سخت و بسیار سخت؛ برای حس‌کردن سقف آمادگی',
      meta: `${toFa(tags.challenging)} سؤال`,
      onClick: () => onNavigate('browse', { filters: { difficulties: ['hard', 'very_hard'] } }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── سربرگ: هم‌اندازه و هم‌فونت هیرو «درسنامهٔ جامع» — خط کوچک + خط بزرگ گرادیانی ── */}
      <header className="dash-stagger flex justify-center pt-[clamp(30px,5.5vh,60px)] pb-2.5 text-center">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-col items-center gap-1.5 [font-family:'Doran',Tahoma,sans-serif]">
            <span className="text-[clamp(1.4rem,2.8vw,2.1rem)] font-medium text-[#d6d6d6]">بانک تست</span>
            <span className="text-[clamp(3rem,6.8vw,5.1rem)] font-extrabold leading-[1.3] text-[#61D192]">
              علوم پایه
            </span>
          </h1>
          <p className="mx-auto mt-3.5 max-w-[620px] text-[clamp(0.95rem,1.4vw,1.1rem)] leading-[2] text-[#b9b9b9]">
            بانک تست کشوری و تألیفی علوم پایه — پزشکی و دندان‌پزشکی، به همراه ابزارهای نوین تحلیل
          </p>
        </div>
      </header>

      {/* ── انتخاب بانک: نوع بانک (کشوری/تألیفی) × رشته (پزشکی/دندان‌پزشکی) ── */}
      <BankScopeSwitcher scope={scope} onScopeChange={onScopeChange} banks={banks} tracks={tracks} />

      {/* ── مسیرها: همه در یک ردیف افقی (بدون عنوان) ── */}
      <section aria-label="چطور می‌خواهی تست بزنی؟">
        {/* ردیف وسط‌چین؛ اگر از عرض صفحه بیشتر شد، از ابتدا اسکرول می‌شود */}
        <div className="dash-stagger overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-auto flex w-max gap-2.5">
            {pathCards.map((card) => (
              <PathChip key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      {/* ── کادرهای مربعی دروس — بدون عنوان؛ خط آخر وسط‌چین می‌شود ── */}
      <section aria-label="دروس علوم پایه">
        {/* چیدمان flex با justify-center: آیتم‌های خط آخر اگر به اندازهٔ عرض نرسیدند، وسط می‌مانند */}
        <div className="dash-stagger flex flex-wrap justify-center gap-3.5">
          {subjectRail.map((subject) => (
            <div
              key={subject.id}
              className="w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.62rem)] md:w-[calc(25%-0.7rem)] lg:w-[calc(20%-0.76rem)]"
            >
              <SubjectTile
                subject={subject}
                onOpen={() =>
                  onNavigate('subject', { subjectId: subject.bankId ?? subject.id, subjectTitle: subject.title })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
