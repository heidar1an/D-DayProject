/*
 * BankExplorer — کاوشگر بانک تست: جستجو + Filter Builder حرفه‌ای.
 * فیلترها ترکیب‌پذیرند (نوع بانک × رشته × درس × مبحث × سال × منبع × نوع × سختی ×
 * وضعیت کاربر × متن) و به شکل Chip قابل حذف مستقل نمایش داده می‌شوند. فیلتر ذخیره‌شده
 * («آزمون من») همان blueprint سشن است و مستقیم به startPractice/startExam می‌رود.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activeFilterCount,
  deleteFilterPreset,
  fetchSavedFilters,
  normalizeFilters,
  saveFilterPreset,
  searchQuestions,
  toggleBookmark,
  BANK_KINDS,
  BANK_YEARS,
  QUESTION_TYPES,
  SOURCES,
  SUBJECTS,
  TOPIC_TREE,
  TRACKS,
  bankKindOf,
  trackOf,
} from '../../../../services/testBank/testBankService';
import {
  BankKindBadge,
  DifficultyBadge,
  EmptyState,
  Icon,
  Modal,
  Skeleton,
  SourceBadge,
  TrackBadge,
  TypeBadge,
  faNum,
  toFa,
} from './bankShared';

const STATUS_OPTIONS = [
  { value: null, label: 'همه' },
  { value: 'unsolved', label: 'حل‌نشده' },
  { value: 'solved', label: 'حل‌شده' },
  { value: 'wrong', label: 'غلط‌زده' },
  { value: 'weak', label: 'دقت پایین من' },
  { value: 'bookmarked', label: 'نشان‌شده' },
  { value: 'review', label: 'نیاز به مرور' },
];

const PAGE_SIZE = 8;

/* ── یک ستون فیلتر چک‌باکس‌محور ── */
function CheckboxGroup({ title, options, selected, onChange }) {
  const toggle = (value) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold text-[#bbb] [font-family:'Doran',Tahoma,sans-serif]">{title}</legend>
      <div className="space-y-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] transition-colors ${
              selected.includes(option.value)
                ? 'border-[#61D192]/40 bg-[#61D192]/[0.07] text-white'
                : 'border-transparent text-[#bbb] hover:bg-white/[0.04]'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="h-3.5 w-3.5 accent-[#61D192]"
            />
            <span className="flex-1">{option.label}</span>
            {option.count != null && <span className="text-[11px] text-[#777]">{toFa(option.count)}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ── چیپ‌های چندانتخابی فشرده (نوع سؤال/سختی/مبحث) ── */
function ChipGroup({ title, options, selected, onChange }) {
  const toggle = (value) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold text-[#bbb] [font-family:'Doran',Tahoma,sans-serif]">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            aria-pressed={selected.includes(option.value)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors ${
              selected.includes(option.value)
                ? 'border-[#61D192]/50 bg-[#61D192]/12 text-[#7ee0ac]'
                : 'border-white/10 bg-white/[0.03] text-[#aaa] hover:border-white/25'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/* ── پنل فیلتر (سایدبار دسکتاپ / دراور موبایل) ── */
function FilterPanel({ filters, setFilters, subjectsMeta, saved, onApplySaved, onDeleteSaved, onSaveCurrent }) {
  const patch = (partial) => setFilters((prev) => ({ ...normalizeFilters(prev), ...partial }));

  /* مباحث قابل انتخاب = مباحث درس‌های انتخاب‌شده (یا همه) */
  const selectedSubjects = filters.subjectIds.length ? filters.subjectIds : SUBJECTS.map((subject) => subject.id);
  const topicOptions = selectedSubjects
    .flatMap((subjectId) => TOPIC_TREE[subjectId] ?? [])
    .map((node) => ({ value: node.name, label: node.name, children: node.children }));

  const selectedTopics = filters.topicPaths.length ? filters.topicPaths : topicOptions.map((node) => node.value);
  const subtopicOptions = topicOptions
    .filter((node) => selectedTopics.includes(node.value))
    .flatMap((node) => node.children.map((child) => ({ value: child, label: child })));

  return (
    <div className="space-y-6">
      {/* دو محور سطح بالا — هم‌راستا با «انتخاب بانک» در خانه؛ اینجا قابل ترکیب و تغییرند */}
      <ChipGroup
        title="نوع بانک"
        options={Object.entries(BANK_KINDS).map(([value, meta]) => ({ value, label: meta.short }))}
        selected={filters.bankKinds}
        onChange={(bankKinds) => patch({ bankKinds })}
      />

      <ChipGroup
        title="رشته"
        options={Object.entries(TRACKS).map(([value, meta]) => ({ value, label: meta.short }))}
        selected={filters.tracks}
        onChange={(tracks) => patch({ tracks })}
      />

      <CheckboxGroup
        title="درس"
        options={SUBJECTS.filter((subject) => subjectsMeta[subject.id] > 0).map((subject) => ({
          value: subject.id,
          label: subject.name,
          count: subjectsMeta[subject.id],
        }))}
        selected={filters.subjectIds}
        onChange={(subjectIds) => patch({ subjectIds, topicPaths: [] })}
      />

      {topicOptions.length > 0 && (
        <ChipGroup
          title="مبحث"
          options={topicOptions.map(({ value, label }) => ({ value, label }))}
          selected={filters.topicPaths.filter((path) => topicOptions.some((node) => node.value === path))}
          onChange={(topics) => patch({ topicPaths: topics })}
        />
      )}

      {subtopicOptions.length > 0 && (
        <ChipGroup
          title="زیرمبحث"
          options={subtopicOptions}
          selected={filters.topicPaths.filter((path) => subtopicOptions.some((node) => node.value === path))}
          onChange={(subtopics) => patch({ topicPaths: [...filters.topicPaths.filter((path) => topicOptions.some((node) => node.value === path)), ...subtopics] })}
        />
      )}

      {/* سال — بازه از/تا */}
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-[#bbb] [font-family:'Doran',Tahoma,sans-serif]">سال</legend>
        <div className="flex items-center gap-2">
          <select
            value={filters.yearFrom ?? ''}
            onChange={(event) => patch({ yearFrom: event.target.value ? Number(event.target.value) : null })}
            aria-label="از سال"
            className="w-full cursor-pointer rounded-xl border border-white/10 bg-[#2a2a2a] px-2.5 py-2 text-[13px] text-white focus:border-[#61D192]/50 focus:outline-none"
          >
            <option value="">از ابتدا</option>
            {BANK_YEARS.map((year) => (
              <option key={year} value={year}>{toFa(year)}</option>
            ))}
          </select>
          <span className="text-[#666]">تا</span>
          <select
            value={filters.yearTo ?? ''}
            onChange={(event) => patch({ yearTo: event.target.value ? Number(event.target.value) : null })}
            aria-label="تا سال"
            className="w-full cursor-pointer rounded-xl border border-white/10 bg-[#2a2a2a] px-2.5 py-2 text-[13px] text-white focus:border-[#61D192]/50 focus:outline-none"
          >
            <option value="">انتها</option>
            {BANK_YEARS.map((year) => (
              <option key={year} value={year}>{toFa(year)}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <CheckboxGroup
        title="منبع"
        options={Object.entries(SOURCES).map(([value, meta]) => ({ value, label: meta.label }))}
        selected={filters.sources}
        onChange={(sources) => patch({ sources })}
      />

      <ChipGroup
        title="نوع سؤال"
        options={Object.entries(QUESTION_TYPES).map(([value, meta]) => ({ value, label: meta.label }))}
        selected={filters.types}
        onChange={(types) => patch({ types })}
      />

      <ChipGroup
        title="سطح سختی"
        options={[
          { value: 'easy', label: 'آسان' },
          { value: 'medium', label: 'متوسط' },
          { value: 'hard', label: 'سخت' },
          { value: 'very_hard', label: 'بسیار سخت' },
        ]}
        selected={filters.difficulties}
        onChange={(difficulties) => patch({ difficulties })}
      />

      <fieldset>
        <legend className="mb-2 text-xs font-bold text-[#bbb] [font-family:'Doran',Tahoma,sans-serif]">وضعیت من</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => patch({ status: option.value })}
              aria-pressed={filters.status === option.value}
              className={`cursor-pointer rounded-xl px-2.5 py-2 text-xs transition-colors ${
                filters.status === option.value ? 'bg-[#937fcd] font-bold text-white' : 'bg-white/5 text-[#aaa] hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* فیلترهای ذخیره‌شده */}
      <div className="border-t border-white/8 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <legend className="text-xs font-bold text-[#bbb] [font-family:'Doran',Tahoma,sans-serif]">آزمون‌های من</legend>
          <button
            type="button"
            onClick={onSaveCurrent}
            className="flex cursor-pointer items-center gap-1 text-[11px] text-[#61D192] transition-colors hover:text-[#7ee0ac]"
          >
            <Icon name="plus" className="h-3 w-3" />
            ذخیرهٔ فیلتر فعلی
          </button>
        </div>
        {!saved.length ? (
          <p className="text-[11px] leading-5 text-[#777]">ترکیب فیلتر موردعلاقه‌ات را ذخیره کن تا همیشه همین‌جا باشد.</p>
        ) : (
          <ul className="space-y-1.5">
            {saved.map((preset) => (
              <li key={preset.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onApplySaved(preset)}
                  className="min-w-0 flex-1 cursor-pointer truncate rounded-xl bg-white/5 px-3 py-2 text-right text-xs transition-colors hover:bg-white/10"
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSaved(preset.id)}
                  aria-label={`حذف ${preset.name}`}
                  className="cursor-pointer rounded-lg p-1.5 text-[#777] transition-colors hover:bg-[#e26d6d]/10 hover:text-[#ef9196]"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── کارت پیش‌نمایش سؤال در نتایج ── */
function QuestionResultCard({ entry, onSolve, onToggleBookmark }) {
  const { question, userStat, bookmarked } = entry;
  const subject = SUBJECTS.find((item) => item.id === question.subject);
  const statusBadge = !userStat
    ? { label: 'جدید', className: 'bg-white/6 text-[#9a9a9a]' }
    : userStat.lastCorrect
      ? { label: 'حل‌شده ✓', className: 'bg-[#61D192]/12 text-[#61D192]' }
      : { label: 'غلط‌زده', className: 'bg-[#e26d6d]/12 text-[#ef9196]' };

  return (
    <article className="group rounded-[1.75rem] border border-white/8 bg-[#242426] p-5 transition-colors hover:border-white/16">
      <header className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: subject?.accent }}>
          <span className="h-2 w-2 rounded-full" style={{ background: subject?.accent }} aria-hidden="true" />
          {subject?.name}
        </span>
        <span className="text-[11px] text-[#777]">{question.topicPath.join(' › ')}</span>
        <span className="ms-auto flex items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-[10px] ${statusBadge.className}`}>{statusBadge.label}</span>
          <DifficultyBadge difficulty={question.difficulty} />
        </span>
      </header>

      <p className="mt-3 line-clamp-2 text-[14px] leading-7 text-[#e3e3e3]">{question.stem}</p>

      <footer className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-[#8a8a8a]">
        <TypeBadge type={question.type} />
        <BankKindBadge kind={bankKindOf(question)} />
        <TrackBadge track={trackOf(question)} />
        {question.figure && (
          <span className="rounded-full bg-white/6 px-2.5 py-1 text-[10px]">شکل‌دار</span>
        )}
        <span className="rounded-full bg-white/6 px-2.5 py-1 text-[10px]">{toFa(question.year)}</span>
        <SourceBadge source={question.source} className="!px-2.5 !py-1 !text-[10px]" />
        <span className="flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 text-[10px]">
          <Icon name="users" className="h-3 w-3" />
          {toFa(question.stats.correctPercent)}٪ پاسخ صحیح
        </span>

        <span className="ms-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleBookmark(question.id)}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? 'حذف از نشان‌شده‌ها' : 'افزودن به نشان‌شده‌ها'}
            className={`cursor-pointer rounded-xl p-2 transition-colors ${
              bookmarked ? 'bg-[#e26d6d]/15 text-[#ef9196]' : 'bg-white/5 text-[#777] hover:text-white'
            }`}
          >
            <Icon name={bookmarked ? 'heartFilled' : 'heart'} className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSolve(question.id)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#61D192]/12 px-3.5 py-2 text-[11px] font-bold text-[#61D192] transition-all hover:-translate-y-0.5 hover:bg-[#61D192]/20"
          >
            <Icon name="play" className="h-3 w-3" />
            حل
          </button>
        </span>
      </footer>
    </article>
  );
}

/* ══════════════════════════ BankExplorer ══════════════════════════ */
export default function BankExplorer({
  userId,
  overview,
  initialFilters = {},
  onSolve,
  onStartPractice,
  onStartExam,
}) {
  const [filters, setFilters] = useState(() => normalizeFilters(initialFilters));
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appending, setAppending] = useState(false);
  const [saved, setSaved] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debounceRef = useRef(null);

  /* شمارش درس‌ها از نمای کلی بانک (سرویس) — فقط برای لیبل سایدبار */
  const subjectCounts = useMemo(() => {
    const counts = {};
    for (const subject of overview?.subjects ?? []) counts[subject.id] = subject.questionCount;
    return counts;
  }, [overview]);

  /* بارگذاری نتایج — با debounce روی تغییر فیلتر */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      let alive = true;
      searchQuestions(userId, filters, { page: 1, pageSize: PAGE_SIZE })
        .then((result) => {
          if (!alive) return;
          setItems(result.items);
          setTotal(result.total);
          setHasMore(result.hasMore);
          setPage(1);
          setLoading(false);
        })
        .catch(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, filters]);

  const loadMore = async () => {
    setAppending(true);
    try {
      const result = await searchQuestions(userId, filters, { page: page + 1, pageSize: PAGE_SIZE });
      setItems((prev) => [...(prev ?? []), ...result.items]);
      setHasMore(result.hasMore);
      setPage((prev) => prev + 1);
    } finally {
      setAppending(false);
    }
  };

  const refreshSaved = useCallback(() => {
    fetchSavedFilters(userId).then(setSaved).catch(() => {});
  }, [userId]);

  useEffect(refreshSaved, [refreshSaved]);

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    await saveFilterPreset(userId, { name: presetName, blueprint: filters });
    setPresetName('');
    setSaveOpen(false);
    refreshSaved();
  };

  const handleBookmark = async (questionId) => {
    const isOn = await toggleBookmark(userId, questionId);
    setItems((prev) =>
      prev?.map((entry) => (entry.question.id === questionId ? { ...entry, bookmarked: isOn } : entry)),
    );
  };

  /* چیپ‌های فعال — هر فیلتر قابل حذف مستقل */
  const activeChips = useMemo(() => {
    const chips = [];
    const subjectName = (id) => SUBJECTS.find((subject) => subject.id === id)?.name ?? id;
    for (const kind of filters.bankKinds) {
      chips.push({ key: `bank-${kind}`, label: BANK_KINDS[kind]?.label ?? kind, remove: () => setFilters((prev) => ({ ...prev, bankKinds: prev.bankKinds.filter((item) => item !== kind) })) });
    }
    for (const track of filters.tracks) {
      chips.push({ key: `track-${track}`, label: TRACKS[track]?.label ?? track, remove: () => setFilters((prev) => ({ ...prev, tracks: prev.tracks.filter((item) => item !== track) })) });
    }
    for (const id of filters.subjectIds) {
      chips.push({ key: `subject-${id}`, label: subjectName(id), remove: () => setFilters((prev) => ({ ...prev, subjectIds: prev.subjectIds.filter((item) => item !== id) })) });
    }
    for (const topic of filters.topicPaths) {
      chips.push({ key: `topic-${topic}`, label: topic, remove: () => setFilters((prev) => ({ ...prev, topicPaths: prev.topicPaths.filter((item) => item !== topic) })) });
    }
    if (filters.yearFrom || filters.yearTo) {
      const label = `سال ${filters.yearFrom ? toFa(filters.yearFrom) : '…'} تا ${filters.yearTo ? toFa(filters.yearTo) : '…'}`;
      chips.push({ key: 'year', label, remove: () => setFilters((prev) => ({ ...prev, yearFrom: null, yearTo: null })) });
    }
    for (const source of filters.sources) {
      chips.push({ key: `source-${source}`, label: SOURCES[source]?.label ?? source, remove: () => setFilters((prev) => ({ ...prev, sources: prev.sources.filter((item) => item !== source) })) });
    }
    for (const type of filters.types) {
      chips.push({ key: `type-${type}`, label: QUESTION_TYPES[type]?.label ?? type, remove: () => setFilters((prev) => ({ ...prev, types: prev.types.filter((item) => item !== type) })) });
    }
    for (const difficulty of filters.difficulties) {
      chips.push({ key: `diff-${difficulty}`, label: { easy: 'آسان', medium: 'متوسط', hard: 'سخت', very_hard: 'بسیار سخت' }[difficulty], remove: () => setFilters((prev) => ({ ...prev, difficulties: prev.difficulties.filter((item) => item !== difficulty) })) });
    }
    for (const tag of filters.tags) {
      chips.push({ key: `tag-${tag}`, label: tag, remove: () => setFilters((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) })) });
    }
    if (filters.status) {
      chips.push({
        key: 'status',
        label: STATUS_OPTIONS.find((option) => option.value === filters.status)?.label ?? filters.status,
        remove: () => setFilters((prev) => ({ ...prev, status: null })),
      });
    }
    if (filters.search) {
      chips.push({ key: 'search', label: `«${filters.search}»`, remove: () => setFilters((prev) => ({ ...prev, search: '' })) });
    }
    return chips;
  }, [filters]);

  const hasAnyFilter = activeFilterCount(filters) > 0;

  const panel = (
    <FilterPanel
      filters={filters}
      setFilters={setFilters}
      subjectsMeta={subjectCounts}
      saved={saved}
      onApplySaved={(preset) => setFilters(normalizeFilters(preset.blueprint))}
      onDeleteSaved={async (presetId) => {
        await deleteFilterPreset(userId, presetId);
        refreshSaved();
      }}
      onSaveCurrent={() => setSaveOpen(true)}
    />
  );

  return (
    <div>
      {/* نوار ابزار */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Icon name="search" className="pointer-events-none absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#777]" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="جستجو در متن سؤال، مبحث یا درس…"
            aria-label="جستجو در نتایج"
            className="w-full rounded-2xl border border-white/8 bg-[#2a2a2a] py-3 pe-4 ps-11 text-sm text-white placeholder:text-[#666] focus:border-[#61D192]/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-2xl bg-white/6 px-4 py-3 text-sm transition-colors hover:bg-white/12 lg:hidden"
        >
          <Icon name="filter" className="h-4 w-4" />
          فیلترها
          {hasAnyFilter && <span className="grid h-5 w-5 place-items-center rounded-full bg-[#61D192] text-[10px] font-bold text-[#12271a]">{toFa(activeFilterCount(filters))}</span>}
        </button>
      </div>

      {/* چیپ‌های فیلتر فعال */}
      {activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" onClick={chip.remove} className="tb-chip cursor-pointer">
              {chip.label}
              <Icon name="x" className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilters(normalizeFilters({}))}
            className="cursor-pointer rounded-full px-3 py-1.5 text-xs text-[#888] transition-colors hover:text-[#ef9196]"
          >
            حذف همهٔ فیلترها
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[276px_minmax(0,1fr)]">
        {/* سایدبار دسکتاپ */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[1.75rem] border border-white/8 bg-[#242426] p-5" aria-label="پنل فیلتر">
            {panel}
          </div>
        </aside>

        {/* نتایج */}
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#9a9a9a]" role="status">
              {loading ? 'در حال جستجو…' : hasAnyFilter ? `${faNum(total)} سؤال با این ترکیب پیدا شد` : `${faNum(total)} سؤال در بانک`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!total}
                onClick={() => onStartPractice(filters)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#61D192] px-4 py-2.5 text-xs font-bold text-[#12271a] transition-all hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-40 disabled:translate-y-0"
              >
                <Icon name="play" className="h-3.5 w-3.5" />
                تمرین از این نتایج
              </button>
              <button
                type="button"
                disabled={!total}
                onClick={() => onStartExam(filters)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#937fcd]/40 bg-[#937fcd]/10 px-4 py-2.5 text-xs font-bold text-[#c9bdf0] transition-all hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-40 disabled:translate-y-0"
              >
                <Icon name="timer" className="h-3.5 w-3.5" />
                آزمون از این نتایج
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-44 rounded-[1.75rem]" />
              ))}
            </div>
          ) : !items?.length ? (
            <EmptyState
              icon="search"
              title="تستی با این ترکیب پیدا نشد"
              note="فیلترها را تغییر بده یا چند مورد را بردار تا نتایج بیشتری ببینی."
              action={
                <button
                  type="button"
                  onClick={() => setFilters(normalizeFilters({}))}
                  className="mt-3 cursor-pointer rounded-xl bg-[#61D192] px-5 py-2.5 text-sm font-bold text-[#12271a]"
                >
                  حذف همهٔ فیلترها
                </button>
              }
            />
          ) : (
            <>
              <div className="space-y-4">
                {items.map((entry) => (
                  <QuestionResultCard
                    key={entry.question.id}
                    entry={entry}
                    onSolve={onSolve}
                    onToggleBookmark={handleBookmark}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={appending}
                  className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 text-sm transition-colors hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {appending ? 'در حال بارگذاری…' : 'نمایش بیشتر'}
                  <Icon name="chevron" className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* دراور فیلتر موبایل */}
      {drawerOpen && (
        <>
          <div className="tb-drawer__scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="tb-drawer" role="dialog" aria-label="فیلترها">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm [font-family:'Doran',Tahoma,sans-serif]">فیلترها</h3>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="بستن" className="cursor-pointer rounded-lg bg-white/6 p-1.5">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            {panel}
          </div>
        </>
      )}

      {/* مودال ذخیرهٔ فیلتر */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="ذخیرهٔ فیلتر">
        <h3 className="text-base [font-family:'Doran',Tahoma,sans-serif]">ذخیره به‌عنوان «آزمون من»</h3>
        <p className="mt-1.5 text-xs leading-6 text-[#8a8a8a]">
          {faNum(total)} سؤال با این ترکیب پیدا می‌شود. اسم دلخواه بده تا در پنل فیلترها همیشه در دسترس باشد.
        </p>
        <input
          type="text"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
          placeholder="مثلاً: فیزیو قلب سخت ۱۴۰۲-۱۴۰۵"
          className="mt-4 w-full rounded-xl border border-white/10 bg-[#2a2a2a] px-3.5 py-2.5 text-sm text-white placeholder:text-[#666] focus:border-[#61D192]/50 focus:outline-none"
          autoFocus
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSavePreset}
            disabled={!presetName.trim()}
            className="flex-1 cursor-pointer rounded-xl bg-[#61D192] px-4 py-2.5 text-sm font-bold text-[#12271a] transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-50"
          >
            ذخیره
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(false)}
            className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-sm transition-colors hover:bg-white/12"
          >
            انصراف
          </button>
        </div>
      </Modal>
    </div>
  );
}
