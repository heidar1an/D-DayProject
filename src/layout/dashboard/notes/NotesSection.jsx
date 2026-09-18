/*
 * بخش یادداشت تپش — دفترچهٔ شخصی دانشجوی پزشکی.
 *
 * ساختار (مستند کامل: README.md کنار همین پوشه):
 *   NotesSection ← پوسته: نوار بالای لایه (بازگشت + ساخت یادداشت) + هیرو +
 *                  جست‌وجو/مرتب‌سازی + بخش واحد «موضوع و تگ» + گرید کارت‌ها
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
    <div className="rounded-[2.5rem] bg-[var(--surface-soft)] p-10 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#ff6969]/12 text-[var(--red-ink)]">
        <Icon name="warn" size={26} />
      </span>
      <strong className="block text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">یادداشت‌ها همین لحظه در دسترس نیستند</strong>
      <p className="mt-2 text-sm text-[var(--faint)]">اتصالت را چک کن و دوباره تلاش کن.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 cursor-pointer rounded-xl bg-[var(--blue-bright)] px-6 py-2.5 text-sm text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
      >
        تلاش دوباره
      </button>
    </div>
  );
}

/* ── نوار بالای لایه — همان چیدمان و همان دکمهٔ نوار فلش‌کارت ──
   دکمهٔ «ساخت یادداشت» اینجا می‌نشیند (نه در هیرو)، دقیقاً مثل «ساخت کارت» فلش‌کارت.
   مسیر متنی («داشبورد / یادداشت‌ها») عمداً نیست؛ بازگشت و دکمهٔ ساخت کافی‌اند. */
function LayerTopbar({ onBack, onCreate }) {
  return (
    <div className="nt-topbar dash-stagger">
      {onBack && (
        <button className="nt-topbar__back" type="button" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به داشبورد
        </button>
      )}
      <button type="button" onClick={onCreate} className="nt-topbar__create">
        <Icon name="plus" size={16} />
        ساخت یادداشت
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
      className="nt-card relative flex cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-white/6 bg-[var(--surface-soft)] p-5 transition-colors hover:border-white/12"
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
              note.pinned ? 'bg-[#e0b45c]/15 text-[var(--gold-ink)]' : 'text-[var(--ghost)] hover:bg-white/[0.06] hover:text-white'
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
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ghost)] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="edit" size={14} />
          </button>
          <span onClick={(event) => event.stopPropagation()} role="presentation">
            <DeleteButton compact onConfirm={() => onDelete(note)} label={`حذف ${note.title || 'یادداشت'}`} />
          </span>
        </div>
      </div>

      <button type="button" onClick={() => onOpen(note)} className="mt-3 cursor-pointer text-right">
        <h3 className="text-base leading-7 transition-colors hover:text-[var(--blue-soft-ink)] [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          {note.title || 'یادداشت بی‌عنوان'}
        </h3>
      </button>

      <p className="mt-2 flex-1 text-xs leading-6 text-[var(--faint)]">{buildSnippet(note)}</p>

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
            <span className="block h-full rounded-full bg-[var(--green-bright)] transition-[width] duration-500" style={{ width: `${metrics.percent}%` }} />
          </div>
          <span className="text-[10px] text-[var(--ghost)]">
            {toFa(metrics.done)}/{toFa(metrics.total)}
          </span>
        </div>
      )}

      {metrics.type === 'count' && (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--ghost)]">
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
            <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] text-[var(--ghost)]">
              +{toFa(note.tags.length - 3)}
            </span>
          )}
        </div>
      )}

      <footer className="mt-3 border-t border-white/5 pt-3 text-[10px] text-[var(--ghost)]">
        آخرین ویرایش {relativeEditedAt(note.updatedAt)}
      </footer>
    </article>
  );
}

/* ── نوار چیپ موضوع و تگ ──
   هم‌شکل ردیف مسیرهای «بانک تست علوم پایه» (`PathChip`): همهٔ چیپ‌ها در یک ردیف
   افقی، هر چیپ فقط آیکون + عنوان، بدون کادر و بدون گروه. گروه‌بندی تگ‌ها با رنگ
   آیکون باقی می‌ماند. کلیک روی چیپ درس، موضوع را فیلتر می‌کند، کلیک روی چیپ تگ
   فهرست را به همان تگ می‌برد و کلیک دوباره فیلتر را برمی‌دارد. */
function TopicChips({ rows, activeSubject, activeTag, onSelectSubject, onSelectTag, onClear, subjectCount }) {
  const subjects = rows.filter((row) => row.count > 0);
  const tags = rows.flatMap((row) => row.tags.map(({ tag }) => ({ tag, accent: row.accent })));

  if (subjects.length === 0 && tags.length === 0) return null;

  return (
    <section aria-label="موضوع‌ها و تگ‌ها">
      {/* ردیف وسط‌چین؛ اگر از عرض صفحه بیشتر شد، از ابتدا اسکرول می‌شود */}
      <div className="dash-stagger overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-max items-center gap-2.5">
          <button type="button" aria-pressed={activeSubject === 'all' && !activeTag} onClick={onClear} className="nt-chip">
            همه
          </button>

          {/* عدد آماری کنار همان چیزی است که می‌شمارد: موضوع‌ها */}
          <span className="nt-count">
            <Icon name="tag" size={12} />
            {toFa(subjectCount)} موضوع
          </span>

          {subjects.map((row) => (
            <button
              key={row.id}
              type="button"
              aria-pressed={activeSubject === row.id}
              onClick={() => onSelectSubject(activeSubject === row.id ? 'all' : row.id)}
              className="nt-chip"
            >
              <Icon name="folder" size={16} className="nt-chip__icon" style={{ color: row.accent }} />
              {row.label}
            </button>
          ))}

          {tags.map(({ tag, accent }) => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTag === tag}
              onClick={() => onSelectTag(activeTag === tag ? null : tag)}
              className="nt-chip"
            >
              <Icon name="tag" size={16} className="nt-chip__icon" style={{ color: accent }} />
              {tag}
            </button>
          ))}
        </div>
      </div>
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

export default function NotesSection({ userData, onBack }) {
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

  /* آمار کلی از همهٔ یادداشت‌ها — مستقل از فیلترهای جاری.
     این اعداد جای ردیف آماری هیرو را گرفته‌اند و هرکدام کنار بخش خودش نشان داده
     می‌شوند: «موضوع» کنار ردیف فیلتر موضوع و «این هفته» کنار نوار جست‌وجو. */
  const stats = useMemo(() => {
    const list = notes ?? [];
    return {
      subjects: new Set(list.map((note) => note.subjectId)).size,
      thisWeek: list.filter((note) => Date.now() - new Date(note.updatedAt).getTime() < WEEK_MS).length,
    };
  }, [notes]);

  const filtered = useMemo(
    () => (notes ? filterNotes(notes, { query, subjectId: subjectFilter, tag: tagFilter, sort }) : []),
    [notes, query, subjectFilter, tagFilter, sort],
  );
  const pinnedNotes = filtered.filter((note) => note.pinned);
  const restNotes = filtered.filter((note) => !note.pinned);

  /* تگ‌ها به تفکیک دسته (فیزیولوژی، آناتومی، …، عمومی) — ویرایشگر هم از همین می‌خواند */
  const tagGroups = useMemo(() => groupTags(notes), [notes]);

  /* ── ردیف‌های «موضوع + تگ» ──
     هر موضوع یک ردیف است: سرتیتر همان درس و تگ‌های همان درس هم‌ردیفش. موضوعی که
     تگ دارد ولی یادداشت ندارد هم می‌آید تا تگش بی‌صاحب نماند. */
  const topicRows = useMemo(() => {
    const noteCounts = new Map();
    (notes ?? []).forEach((note) => noteCounts.set(note.subjectId, (noteCounts.get(note.subjectId) ?? 0) + 1));

    const tagsByGroup = new Map(tagGroups.map((group) => [group.id, group.tags]));
    const rows = SUBJECTS.filter(
      (subject) => noteCounts.has(subject.id) || tagsByGroup.has(subject.id),
    ).map((subject) => ({
      id: subject.id,
      label: subject.label,
      accent: subject.accent,
      count: noteCounts.get(subject.id) ?? 0,
      tags: tagsByGroup.get(subject.id) ?? [],
    }));

    /* دستهٔ تگ‌های آزاد (خارج از فهرست پیش‌فرض) موضوع ندارد — ته فهرست می‌آید */
    tagGroups
      .filter((group) => !SUBJECTS.some((subject) => subject.id === group.id))
      .forEach((group) => rows.push({ id: group.id, label: group.label, accent: group.accent, count: 0, tags: group.tags }));

    return rows;
  }, [notes, tagGroups]);

  const isFiltering = query.trim() || subjectFilter !== 'all' || Boolean(tagFilter);

  const resetFilters = useCallback(() => {
    setQuery('');
    setSubjectFilter('all');
    setTagFilter(null);
  }, []);

  /* «همه» فقط موضوع و تگ را پاک می‌کند؛ عبارت جست‌وجو دست‌نخورده می‌ماند */
  const clearTopicFilters = useCallback(() => {
    setSubjectFilter('all');
    setTagFilter(null);
  }, []);

  /* کلید ورود کارت‌ها — با هر جابه‌جایی موضوع یا تگ عوض می‌شود تا گرید از نو بنشیند
     و انیمیشن پله‌ای `dash-stagger` (همان انیمیشن بلوک‌های داشبورد) دوباره اجرا شود. */
  const topicKey = `${subjectFilter}|${tagFilter ?? ''}`;

  const renderGrid = (list) => (
    <div key={topicKey} className="dash-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      <main dir="rtl" className="dash-stagger mx-auto w-[var(--content-width)] bg-[var(--background)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]">
        {/* نوار بالا در حالت بارگذاری هم هست تا آمدن داده، چیدمان را جابه‌جا نکند */}
        <LayerTopbar onBack={onBack} onCreate={() => setEditor({ note: null, saving: false })} />
        <div className="mt-6">{error ? <ErrorState onRetry={retry} /> : <SkeletonHome />}</div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="dash-stagger mx-auto w-[var(--content-width)] bg-[var(--background)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
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
          {/* نوار بالای لایه — دکمهٔ «ساخت یادداشت» با همان جای و همان شکل «ساخت کارت» فلش‌کارت */}
          <LayerTopbar onBack={onBack} onCreate={() => setEditor({ note: null, saving: false })} />

          {/* ── هیرو — فقط تیتر و توضیح؛ بدون هالهٔ نور و بدون ردیف آماری ── */}
          <header className="nt-hero dash-stagger" aria-label="دفترچهٔ یادداشت">
            <div className="nt-hero__content">
              <h1 className="nt-hero__title">
                <span className="nt-hero__title-top">دفترچهٔ شخصی تپش</span>
                <span className="nt-hero__title-accent">یادداشت‌های من</span>
              </h1>
              <p className="nt-hero__subtitle">
                هر نکته، ترفند و برنامه‌ات یک‌جا؛ متن و چک‌لیست بنویس، با پرسش و پاسخ خودت را
                بسنج، مقایسه‌ها را در جدول بچین و بگذار تپش هوشمند مرتبشان کند.
              </p>
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
                  className="mt-3 cursor-pointer rounded-xl bg-[var(--blue-bright)] px-5 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 [font-family:'Doran','Vazir',Tahoma,sans-serif]"
                >
                  ساخت اولین یادداشت
                </button>
              }
            />
          ) : (
            <>
              {/* ── نوار ابزار: جست‌وجو + مرتب‌سازی + شمارندهٔ «این هفته» ── */}
              <section className="space-y-3" aria-label="جست‌وجو و فیلتر یادداشت‌ها">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-56 flex-1">
                    <span className="pointer-events-none absolute inset-y-0 start-4 grid place-items-center text-[var(--ghost)]">
                      <Icon name="search" size={15} />
                    </span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="در عنوان، متن، تگ‌ها و آیتم‌ها جست‌وجو کن…"
                      aria-label="جست‌وجو در یادداشت‌ها"
                      className="w-full rounded-2xl border border-white/8 bg-[var(--surface-soft)] py-3 pe-4 ps-11 text-sm text-white outline-none transition-colors placeholder:text-[var(--ghost)] focus:border-[#5b8cc7]/60"
                    />
                  </div>

                  {/* «این هفته» از هیرو به همین نوار آمده؛ کنار جست‌وجو معنی پیدا می‌کند */}
                  <span className="nt-count">
                    <Icon name="spark" size={12} />
                    {toFa(stats.thisWeek)} این هفته
                  </span>

                  <label className="relative">
                    <span className="sr-only">مرتب‌سازی</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                      className="cursor-pointer appearance-none rounded-2xl border border-white/8 bg-[var(--surface-soft)] py-3 pe-10 ps-4 text-xs text-[var(--muted)] outline-none transition-colors focus:border-[#5b8cc7]/60"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id} className="bg-[var(--surface-soft)]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 end-3.5 grid place-items-center text-[var(--ghost)]" aria-hidden="true">
                      ▾
                    </span>
                  </label>
                </div>
              </section>

              {/* ── موضوع و تگ در یک ردیف چیپ — هم‌شکل بانک تست ── */}
              <TopicChips
                rows={topicRows}
                activeSubject={subjectFilter}
                activeTag={tagFilter}
                onSelectSubject={setSubjectFilter}
                onSelectTag={setTagFilter}
                onClear={clearTopicFilters}
                subjectCount={stats.subjects}
              />

              {filtered.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="چیزی پیدا نشد"
                  note="یادداشتی با این جست‌وجو یا فیلتر نداری. عبارت دیگری امتحان کن یا فیلترها را پاک کن."
                  action={
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-3 cursor-pointer rounded-xl bg-white/[0.06] px-5 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/[0.1] hover:text-white"
                    >
                      پاک‌کردن فیلترها
                    </button>
                  }
                />
              ) : (
                <>
                  {pinnedNotes.length > 0 && (
                    <section aria-label="گلچین‌شده‌ها" className="space-y-3">
                      <h2 className="nt-section-title nt-section-title--pinned">
                        <Icon name="pinFilled" size={14} />
                        گلچین‌شده‌ها
                        <span className="nt-section-title__count">{toFa(pinnedNotes.length)}</span>
                      </h2>
                      {renderGrid(pinnedNotes)}
                    </section>
                  )}

                  <section aria-label="همهٔ یادداشت‌ها" className="space-y-3">
                    {/* شمارندهٔ «یادداشت» از هیرو به همین سرتیتر آمده — عدد همان چیزی است
                        که در این بخش رندر می‌شود، نه یک عدد جدا از محتوا */}
                    <h2 className="nt-section-title">
                      {isFiltering ? 'نتیجه‌های دیگر' : 'همهٔ یادداشت‌ها'}
                      <span className="nt-section-title__count">{toFa(restNotes.length)}</span>
                    </h2>
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
