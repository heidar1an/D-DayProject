/*
 * بخش یادداشت تپش — دفترچهٔ شخصی دانشجوی پزشکی.
 *
 * ساختار (مستند کامل: README.md کنار همین پوشه):
 *   NotesSection ← پوسته: هیرو + آمار + جست‌وجو/فیلتر + دسته‌بندی تگ‌ها + گرید کارت‌ها
 *   NoteDetail   ← نمای کامل یادداشت (چک‌لیست، پرسش و پاسخ، جدول، منبع، تگ‌ها)
 *   NoteEditor   ← مودال ساخت/ویرایش (چهار حالت + موضوع + تگ دسته‌بندی‌شده + منبع)
 *   سرویس: src/services/notes (قرارداد API واقعی، فعلاً Mock + localStorage)
 *
 * تغییرات اپتیمستیک هستند: state محلی فوراً عوض می‌شود و سرویس در پس‌زمینه
 * می‌رود؛ بعد از هر تغییر یک refresh بی‌صدا داده‌ها را هم‌راستا می‌کند.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildSnippet,
  createNote,
  deleteNote,
  fetchNotes,
  filterNotes,
  groupTags,
  noteColor,
  noteMetrics,
  relativeEditedAt,
  runNoteAIOnNote,
  setNotePinned,
  tagAccent,
  toggleChecklistItem,
  updateNote,
} from '../../../services/notes/notesService';
import { SUBJECTS } from '../../../services/notes/mockData';
import { useAsyncData } from '../league/useAsyncData';
import { EmptyState, Skeleton, toFa } from '../league/leagueShared';
import NoteDetail from './NoteDetail';
import NoteEditor from './NoteEditor';
import { DeleteButton, Icon, KindBadge, SubjectChip, TagPill } from './notesShared';
import './notes.css';

const SORT_OPTIONS = [
  { id: 'updated', label: 'آخرین ویرایش' },
  { id: 'created', label: 'جدیدترین' },
  { id: 'title', label: 'بر اساس عنوان' },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[2.5rem] bg-[#282828] p-10 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#ff6969]/12 text-[#ff6969]">
        <Icon name="warn" size={26} />
      </span>
      <strong className="block text-lg [font-family:'Doran',Tahoma,sans-serif]">یادداشت‌ها همین لحظه در دسترس نیستند</strong>
      <p className="mt-2 text-sm text-[#8a8a8a]">اتصالت را چک کن و دوباره تلاش کن.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 cursor-pointer rounded-xl bg-[#5b8cc7] px-6 py-2.5 text-sm text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran',Tahoma,sans-serif]"
      >
        تلاش دوباره
      </button>
    </div>
  );
}

/* ── کارت یادداشت در گرید ── */
function NoteCard({ note, onOpen, onTogglePin, onEdit, onDelete }) {
  const metrics = noteMetrics(note);
  const color = noteColor(note);

  return (
    <article
      onClick={() => onOpen(note)}
      className="nt-card relative flex cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-white/6 bg-[#282828] p-5 transition-colors hover:border-white/12"
    >
      <span className="absolute inset-y-0 start-0 w-1" style={{ background: color }} aria-hidden="true" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <SubjectChip subjectId={note.subjectId} />
          <KindBadge kind={note.kind} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(note);
            }}
            aria-pressed={note.pinned}
            aria-label={note.pinned ? 'خروج از گلچین' : 'افزودن به گلچین'}
            className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg transition-colors ${
              note.pinned ? 'bg-[#e0b45c]/15 text-[#e0b45c]' : 'text-[#5c5c5c] hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <Icon name={note.pinned ? 'pinFilled' : 'pin'} size={14} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(note);
            }}
            aria-label="ویرایش یادداشت"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#5c5c5c] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="edit" size={14} />
          </button>
          <span onClick={(event) => event.stopPropagation()} role="presentation">
            <DeleteButton compact onConfirm={() => onDelete(note)} label={`حذف ${note.title || 'یادداشت'}`} />
          </span>
        </div>
      </div>

      <button type="button" onClick={() => onOpen(note)} className="mt-3 cursor-pointer text-right">
        <h3 className="text-base leading-7 transition-colors hover:text-[#9cc0e8] [font-family:'Doran',Tahoma,sans-serif]">
          {note.title || 'یادداشت بی‌عنوان'}
        </h3>
      </button>

      <p className="mt-2 flex-1 text-xs leading-6 text-[#8a8a8a]">{buildSnippet(note)}</p>

      {metrics.type === 'progress' && metrics.total > 0 && (
        <div className="mt-3 flex items-center gap-2.5">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8"
            role="progressbar"
            aria-valuenow={metrics.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="پیشرفت چک‌لیست"
          >
            <span className="block h-full rounded-full bg-[#77b787] transition-[width] duration-500" style={{ width: `${metrics.percent}%` }} />
          </div>
          <span className="text-[10px] text-[#6d6d6d]">
            {toFa(metrics.done)}/{toFa(metrics.total)}
          </span>
        </div>
      )}

      {metrics.type === 'count' && (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#6d6d6d]">
          <Icon name={metrics.icon} size={12} />
          {toFa(metrics.count)} {metrics.unit}
          {metrics.columns ? ` · ${toFa(metrics.columns)} ستون` : ''}
        </p>
      )}

      {note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {note.tags.slice(0, 3).map((tag) => (
            <TagPill key={tag} tag={tag} accent={tagAccent(tag)} />
          ))}
          {note.tags.length > 3 && (
            <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] text-[#6d6d6d]">
              +{toFa(note.tags.length - 3)}
            </span>
          )}
        </div>
      )}

      <footer className="mt-3 border-t border-white/5 pt-3 text-[10px] text-[#5c5c5c]">
        آخرین ویرایش {relativeEditedAt(note.updatedAt)}
      </footer>
    </article>
  );
}

/* ── دسته‌بندی تگ‌ها ──
   تگ‌ها زیر عنوان دستهٔ خودشان (فیزیولوژی، عمومی، …) می‌آیند تا فهرست تگ‌ها
   به‌هم‌ریخته نشود؛ کلیک روی هر تگ فهرست را فیلتر می‌کند. */
function TagBrowser({ groups, activeTag, onSelect }) {
  const [open, setOpen] = useState(false);
  const total = groups.reduce((sum, group) => sum + group.tags.length, 0);

  /* وقتی تگی فیلتر شده، پنل خودش باز می‌ماند تا فیلترِ فعال گم نشود */
  useEffect(() => {
    if (activeTag) setOpen(true);
  }, [activeTag]);

  if (groups.length === 0) return null;

  return (
    <section className="nt-tagbar" aria-label="دسته‌بندی تگ‌ها">
      <button
        type="button"
        className={`nt-tagbar__head ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex flex-wrap items-center gap-2">
          <Icon name="folder" size={14} />
          دسته‌بندی تگ‌ها
          <span className="text-[10px] font-normal text-[#6d6d6d]">
            {toFa(total)} تگ در {toFa(groups.length)} دسته
          </span>
        </span>
        <span className="flex items-center gap-2">
          {activeTag && <TagPill tag={activeTag} accent={tagAccent(activeTag)} />}
          <Icon name="chevron" size={16} className="nt-tagbar__chevron" />
        </span>
      </button>

      {open && (
        <div className="nt-tagbar__body">
          <div>
            <button
              type="button"
              aria-pressed={!activeTag}
              onClick={() => onSelect(null)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                !activeTag
                  ? 'border-white/25 bg-white/[0.1] text-white'
                  : 'border-white/8 bg-white/[0.03] text-[#8a8a8a] hover:bg-white/[0.06]'
              }`}
            >
              همهٔ تگ‌ها
            </button>
          </div>

          {groups.map((group) => (
            <div key={group.id} className="nt-taggroup" style={{ '--accent': group.accent }}>
              <span className="nt-taggroup__label">
                <Icon name="folder" size={12} />
                {group.label}
              </span>
              <div className="nt-taggroup__tags">
                {group.tags.map(({ tag, count }) => (
                  <TagPill
                    key={tag}
                    tag={tag}
                    accent={group.accent}
                    count={count}
                    active={activeTag === tag}
                    onClick={() => onSelect(activeTag === tag ? null : tag)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── اسکلت بارگذاری اولیه ── */
function SkeletonHome() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-64 rounded-[2rem]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-52 rounded-[2rem]" />
        ))}
      </div>
    </div>
  );
}

export default function NotesSection({ userData }) {
  const { data, error, retry } = useAsyncData(() => fetchNotes(userData), [userData]);

  /* state محلی برای رندر اپتیمستیک — بعد از هر mutation با refresh بی‌صدا هم‌راستا می‌شود */
  const [notes, setNotes] = useState(null);
  useEffect(() => {
    if (data) setNotes(data.notes);
  }, [data]);

  const [mode, setMode] = useState('home'); // home | note
  const [activeId, setActiveId] = useState(null);
  const [editor, setEditor] = useState(null); // null | { note: Note|null, saving: boolean }
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState(null);
  const [sort, setSort] = useState('updated');

  const goHome = useCallback(() => {
    setMode('home');
    setActiveId(null);
  }, []);

  /* refresh بی‌صدا: بدون روشن‌شدن اسکلت، دادهٔ واقعی localStorage را می‌آورد */
  const silentRefresh = useCallback(async () => {
    try {
      const fresh = await fetchNotes(userData);
      setNotes(fresh.notes);
    } catch {
      /* state محلی اپتیمستیک سر جایش می‌ماند */
    }
  }, [userData]);

  /* ── عملیات (اپتیمستیک + سرویس در پس‌زمینه) ── */

  const handleSave = useCallback(
    async (draft) => {
      setEditor((current) => ({ ...current, saving: true }));
      try {
        if (editor?.note) {
          const updated = await updateNote(userData, editor.note.id, draft);
          setNotes((current) =>
            current ? current.map((note) => (note.id === updated.id ? { ...updated, items: updated.items ?? [] } : note)) : current,
          );
        } else {
          const created = await createNote(userData, draft);
          setNotes((current) => (current ? [created, ...current] : current));
        }
        setEditor(null);
        silentRefresh();
      } catch {
        setEditor((current) => ({ ...current, saving: false }));
        /* در نسخهٔ واقعی اینجا Toast خطا می‌آید؛ فعلاً فرم باز می‌ماند */
      }
    },
    [editor, userData, silentRefresh],
  );

  const handleDelete = useCallback(
    async (note) => {
      setNotes((current) => (current ? current.filter((row) => row.id !== note.id) : current));
      if (activeId === note.id) goHome();
      try {
        await deleteNote(userData, note.id);
      } finally {
        silentRefresh();
      }
    },
    [activeId, goHome, userData, silentRefresh],
  );

  const handleTogglePin = useCallback(
    async (note) => {
      setNotes((current) =>
        current ? current.map((row) => (row.id === note.id ? { ...row, pinned: !row.pinned } : row)) : current,
      );
      try {
        await setNotePinned(userData, note.id, !note.pinned);
      } finally {
        silentRefresh();
      }
    },
    [userData, silentRefresh],
  );

  const handleToggleItem = useCallback(
    async (noteId, itemId) => {
      setNotes((current) =>
        current
          ? current.map((row) =>
              row.id === noteId
                ? {
                    ...row,
                    items: (row.items ?? []).map((item) =>
                      item.id === itemId ? { ...item, done: !item.done } : item,
                    ),
                  }
                : row,
            )
          : current,
      );
      try {
        await toggleChecklistItem(userData, noteId, itemId);
      } finally {
        silentRefresh();
      }
    },
    [userData, silentRefresh],
  );

  /* بازنویسی کل یادداشت با تپش هوشمند — نتیجه اپتیمستیک جایگزین و بعد ذخیره می‌شود */
  const handleRewrite = useCallback(
    async (note, action) => {
      const next = await runNoteAIOnNote({ note, action });
      const updated = await updateNote(userData, note.id, next);
      if (!updated) return null;
      setNotes((current) => (current ? current.map((row) => (row.id === updated.id ? updated : row)) : current));
      silentRefresh();
      return updated;
    },
    [userData, silentRefresh],
  );

  /* Escape در نمای یادداشت = بازگشت به فهرست (وقتی مودال باز نیست) */
  useEffect(() => {
    if (mode !== 'note') return undefined;
    const handleKey = (event) => {
      if (event.key !== 'Escape' || editor) return;
      goHome();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, editor, goHome]);

  const activeNote = useMemo(
    () => (mode === 'note' && notes ? notes.find((note) => note.id === activeId) ?? null : null),
    [mode, notes, activeId],
  );

  /* آمار کلی از همهٔ یادداشت‌ها — مستقل از فیلترهای جاری */
  const stats = useMemo(() => {
    const list = notes ?? [];
    const subjectsUsed = new Set(list.map((note) => note.subjectId));
    const thisWeek = list.filter((note) => Date.now() - new Date(note.updatedAt).getTime() < WEEK_MS).length;
    return {
      total: list.length,
      pinned: list.filter((note) => note.pinned).length,
      subjects: subjectsUsed.size,
      thisWeek,
    };
  }, [notes]);

  const filtered = useMemo(
    () => (notes ? filterNotes(notes, { query, subjectId: subjectFilter, tag: tagFilter, sort }) : []),
    [notes, query, subjectFilter, tagFilter, sort],
  );
  const pinnedNotes = filtered.filter((note) => note.pinned);
  const restNotes = filtered.filter((note) => !note.pinned);

  /* چیپ موضوع‌ها فقط برای موضوع‌هایی که یادداشت دارند */
  const usedSubjects = useMemo(() => {
    const counts = new Map();
    (notes ?? []).forEach((note) => counts.set(note.subjectId, (counts.get(note.subjectId) ?? 0) + 1));
    return SUBJECTS.filter((subject) => counts.has(subject.id)).map((subject) => ({
      ...subject,
      count: counts.get(subject.id),
    }));
  }, [notes]);

  /* تگ‌ها به تفکیک دسته (فیزیولوژی، آناتومی، …، عمومی) */
  const tagGroups = useMemo(() => groupTags(notes), [notes]);

  const isFiltering = query.trim() || subjectFilter !== 'all' || Boolean(tagFilter);

  const resetFilters = useCallback(() => {
    setQuery('');
    setSubjectFilter('all');
    setTagFilter(null);
  }, []);

  const renderGrid = (list) => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onOpen={(target) => {
            setActiveId(target.id);
            setMode('note');
          }}
          onTogglePin={handleTogglePin}
          onEdit={(target) => setEditor({ note: target, saving: false })}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );

  /* گارد render-before-effect: بین رسیدن data و اجرای effect یک فریم notes هنوز null است؛
     در آن فریم (و حالت خطا) اسکلت/خطا نشان بده، نه رندر فهرست. */
  if (notes === null) {
    return (
      <main dir="rtl" className="dash-stagger mx-auto w-[var(--content-width)] bg-black py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]">
        {error ? <ErrorState onRetry={retry} /> : <SkeletonHome />}
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="dash-stagger mx-auto w-[var(--content-width)] bg-black py-8 text-white md:py-10 [font-family:'Pinar',Tahoma,sans-serif]"
    >
      {mode === 'note' ? (
        <NoteDetail
          note={activeNote}
          onBack={goHome}
          onEdit={(target) => setEditor({ note: target, saving: false })}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
          onToggleItem={handleToggleItem}
          onRewrite={handleRewrite}
        />
      ) : (
        <div className="space-y-6">
          {/* ── هیرو — هم‌زبان بصری سرتیتر «درسنامه جامع» ── */}
          <header className="nt-hero dash-stagger" aria-label="دفترچهٔ یادداشت">
            <span className="nt-hero__glow" aria-hidden="true" />
            <div className="nt-hero__content">
              <h1 className="nt-hero__title">
                <span className="nt-hero__title-top">دفترچهٔ شخصی تپش</span>
                <span className="nt-hero__title-accent">یادداشت‌های من</span>
              </h1>
              <p className="nt-hero__subtitle">
                هر نکته، ترفند و برنامه‌ات یک‌جا؛ متن و چک‌لیست بنویس، با پرسش و پاسخ خودت را
                بسنج، مقایسه‌ها را در جدول بچین و بگذار تپش هوشمند مرتبشان کند.
              </p>

              <div className="nt-hero__stats">
                <span className="nt-hero__stat">
                  <Icon name="note" size={13} />
                  {toFa(stats.total)} یادداشت
                </span>
                <span className="nt-hero__stat">
                  <Icon name="pinFilled" size={13} />
                  {toFa(stats.pinned)} گلچین‌شده
                </span>
                <span className="nt-hero__stat">
                  <Icon name="tag" size={13} />
                  {toFa(stats.subjects)} موضوع
                </span>
                <span className="nt-hero__stat">
                  <Icon name="spark" size={13} />
                  {toFa(stats.thisWeek)} این هفته
                </span>
              </div>

              <div className="nt-hero__cta">
                <button type="button" onClick={() => setEditor({ note: null, saving: false })} className="nt-hero__create">
                  <Icon name="plus" size={16} />
                  ساخت یادداشت
                </button>
              </div>
            </div>
          </header>

          {notes.length === 0 ? (
            <EmptyState
              icon="note"
              title="هنوز یادداشتی نداری"
              note="اولین یادداشتت را بساز؛ یک نکتهٔ فیزیولوژی، یک برنامهٔ مرور یا هر چیزی که نباید فراموش کنی."
              action={
                <button
                  type="button"
                  onClick={() => setEditor({ note: null, saving: false })}
                  className="mt-3 cursor-pointer rounded-xl bg-[#5b8cc7] px-5 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran',Tahoma,sans-serif]"
                >
                  ساخت اولین یادداشت
                </button>
              }
            />
          ) : (
            <>
              {/* ── نوار ابزار: جست‌وجو + موضوع + مرتب‌سازی ── */}
              <section className="space-y-3" aria-label="جست‌وجو و فیلتر یادداشت‌ها">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-56 flex-1">
                    <span className="pointer-events-none absolute inset-y-0 start-4 grid place-items-center text-[#5c5c5c]">
                      <Icon name="search" size={15} />
                    </span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="در عنوان، متن، تگ‌ها و آیتم‌ها جست‌وجو کن…"
                      aria-label="جست‌وجو در یادداشت‌ها"
                      className="w-full rounded-2xl border border-white/8 bg-[#282828] py-3 pe-4 ps-11 text-sm text-white outline-none transition-colors placeholder:text-[#5c5c5c] focus:border-[#5b8cc7]/60"
                    />
                  </div>

                  <label className="relative">
                    <span className="sr-only">مرتب‌سازی</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                      className="cursor-pointer appearance-none rounded-2xl border border-white/8 bg-[#282828] py-3 pe-10 ps-4 text-xs text-[#aaa] outline-none transition-colors focus:border-[#5b8cc7]/60"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id} className="bg-[#282828]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 end-3.5 grid place-items-center text-[#5c5c5c]" aria-hidden="true">
                      ▾
                    </span>
                  </label>
                </div>

                {usedSubjects.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={subjectFilter === 'all'}
                      onClick={() => setSubjectFilter('all')}
                      className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                        subjectFilter === 'all'
                          ? 'border-white/25 bg-white/[0.1] text-white'
                          : 'border-white/8 bg-white/[0.03] text-[#8a8a8a] hover:bg-white/[0.06]'
                      }`}
                    >
                      همه
                    </button>
                    {usedSubjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        aria-pressed={subjectFilter === subject.id}
                        onClick={() => setSubjectFilter(subjectFilter === subject.id ? 'all' : subject.id)}
                        className="cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-colors"
                        style={
                          subjectFilter === subject.id
                            ? { background: `${subject.accent}2e`, borderColor: `${subject.accent}66`, color: subject.accent }
                            : { borderColor: 'rgba(255,255,255,0.08)', color: '#8a8a8a' }
                        }
                      >
                        {subject.label}
                        <span className="ms-1.5 text-[10px] opacity-70">{toFa(subject.count)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <TagBrowser groups={tagGroups} activeTag={tagFilter} onSelect={setTagFilter} />

              {filtered.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="چیزی پیدا نشد"
                  note="یادداشتی با این جست‌وجو یا فیلتر نداری. عبارت دیگری امتحان کن یا فیلترها را پاک کن."
                  action={
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-3 cursor-pointer rounded-xl bg-white/[0.06] px-5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-white/[0.1] hover:text-white"
                    >
                      پاک‌کردن فیلترها
                    </button>
                  }
                />
              ) : (
                <>
                  {pinnedNotes.length > 0 && (
                    <section aria-label="گلچین‌شده‌ها" className="space-y-3">
                      <h2 className="flex items-center gap-2 text-sm text-[#e0b45c] [font-family:'Doran',Tahoma,sans-serif]">
                        <Icon name="pinFilled" size={14} />
                        گلچین‌شده‌ها
                      </h2>
                      {renderGrid(pinnedNotes)}
                    </section>
                  )}

                  <section aria-label="همهٔ یادداشت‌ها" className="space-y-3">
                    {(pinnedNotes.length > 0 || isFiltering) && (
                      <h2 className="flex flex-wrap items-center gap-2 text-sm text-[#8a8a8a] [font-family:'Doran',Tahoma,sans-serif]">
                        {isFiltering ? 'نتیجه‌های دیگر' : 'همهٔ یادداشت‌ها'}
                        {tagFilter && (
                          <span className="flex items-center gap-1.5 text-[11px] text-[#6d6d6d]">
                            با تگ
                            <TagPill tag={tagFilter} accent={tagAccent(tagFilter)} />
                          </span>
                        )}
                      </h2>
                    )}
                    {renderGrid(restNotes)}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── مودال ساخت/ویرایش ── */}
      <NoteEditor
        open={Boolean(editor)}
        note={editor?.note ?? null}
        tagGroups={tagGroups}
        saving={Boolean(editor?.saving)}
        onSave={handleSave}
        onClose={() => {
          if (!editor?.saving) setEditor(null);
        }}
      />
    </main>
  );
}
