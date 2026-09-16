/*
 * یادداشت‌های پنل — دفترچهٔ شخصی مدیر، هم‌زبان با بخش «یادداشت‌های من» داشبورد سایت.
 *
 * دو حالت نوشتن: «متنی» (متن آزاد) و «چک‌لیست» (آیتم‌های تیک‌خور، با نوار پیشرفت).
 * داده روی سرور و در `database/content/notes.json` می‌نشیند و هر مدیر فقط یادداشت‌های
 * خودش را می‌بیند (`authorId`)؛ همان تفکیکی که داشبورد با `userId` انجام می‌دهد.
 *
 * الگوها عیناً همان بقیهٔ صفحه‌های پنل است: `useAsync` برای بارگذاری، `reload` پس از هر
 * تغییر، مودال برای ساخت/ویرایش و `ConfirmDialog` برای حذف — هیچ state موازی‌ای ساخته نشده.
 */

import { useCallback, useState } from 'react';

import { notes as notesApi } from '../../../services/admin/adminService';
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, SearchInput, Select, Textarea, Toggle, relativeTime, toFa, useAsync, useToast,
} from '../adminShared';
import {
  IconCheck, IconEdit, IconList, IconNote, IconPin, IconPlus, IconTrash,
} from '../adminIcons';

const KIND_FILTERS = [
  { value: 'all', label: 'همهٔ حالت‌ها' },
  { value: 'text', label: 'متنی' },
  { value: 'checklist', label: 'چک‌لیست' },
];

const SORT_OPTIONS = [
  { value: 'updated', label: 'آخرین ویرایش' },
  { value: 'created', label: 'جدیدترین' },
  { value: 'title', label: 'بر اساس عنوان' },
];

const KIND_LABELS = { text: 'متنی', checklist: 'چک‌لیست' };
const MAX_CARD_ITEMS = 5;

const makeKey = () => `k-${Math.random().toString(36).slice(2, 9)}`;
const blankItem = () => ({ key: makeKey(), id: '', text: '', done: false });

function emptyDraft() {
  return {
    mode: 'create',
    form: { id: null, title: '', kind: 'text', body: '', pinned: false, items: [blankItem()] },
  };
}

function draftFrom(note) {
  if (!note) return emptyDraft();
  const items = note.items?.length ? note.items : [blankItem()];
  return {
    mode: 'edit',
    form: {
      id: note.id,
      title: note.title ?? '',
      kind: note.kind === 'checklist' ? 'checklist' : 'text',
      body: note.body ?? '',
      pinned: Boolean(note.pinned),
      items: items.map((item) => ({ key: makeKey(), id: item.id ?? '', text: item.text ?? '', done: Boolean(item.done) })),
    },
  };
}

function progressOf(note) {
  const items = note.items ?? [];
  const done = items.filter((item) => item.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/* ── کارت یادداشت در شبکه ── */
function NoteCard({ note, can, onEdit, onDelete, onTogglePin, onToggleItem }) {
  const progress = progressOf(note);
  const items = note.items ?? [];
  const shown = items.slice(0, MAX_CARD_ITEMS);
  const rest = items.length - shown.length;

  return (
    <article className={`ad-notecard ${note.pinned ? 'is-pinned' : ''}`}>
      <header className="ad-notecard__head">
        <span className={`ad-notekind ad-notekind--${note.kind}`}>
          {note.kind === 'checklist' ? <IconList width={14} height={14} /> : <IconNote width={14} height={14} />}
          {KIND_LABELS[note.kind] ?? 'متنی'}
        </span>

        <div className="ad-rowactions">
          {can('notes.update') ? (
            <IconButton
              label={note.pinned ? 'برداشتن از گلچین' : 'افزودن به گلچین'}
              tone={note.pinned ? 'warn' : 'neutral'}
              onClick={() => onTogglePin(note)}
            >
              <IconPin width={16} height={16} filled={note.pinned} />
            </IconButton>
          ) : null}
          {can('notes.update') ? (
            <IconButton label="ویرایش" onClick={() => onEdit(note)}><IconEdit width={16} height={16} /></IconButton>
          ) : null}
          {can('notes.delete') ? (
            <IconButton label="حذف" tone="danger" onClick={() => onDelete(note)}><IconTrash width={16} height={16} /></IconButton>
          ) : null}
        </div>
      </header>

      <button type="button" className="ad-notecard__title" onClick={() => onEdit(note)}>
        {note.title || 'یادداشت بی‌عنوان'}
      </button>

      {note.kind === 'checklist' ? (
        <ul className="ad-notecheck">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`ad-notecheck__tick ${item.done ? 'is-done' : ''}`}
                aria-pressed={item.done}
                aria-label={item.done ? `برداشتن تیک ${item.text}` : `تیک‌زدن ${item.text}`}
                disabled={!can('notes.update')}
                onClick={() => onToggleItem(note, item)}
              >
                <IconCheck width={12} height={12} />
              </button>
              <span className={item.done ? 'is-done' : ''}>{item.text}</span>
            </li>
          ))}
          {rest > 0 ? <li className="ad-notecheck__rest">و {toFa(rest)} آیتم دیگر</li> : null}
        </ul>
      ) : (
        <p className="ad-notecard__body">{note.body || '—'}</p>
      )}

      <footer className="ad-notecard__foot">
        {progress.total > 0 ? (
          <div className="ad-progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت چک‌لیست">
            <span className="ad-progress__bar" style={{ width: `${progress.percent}%` }} />
          </div>
        ) : null}

        <div className="ad-notecard__meta">
          {progress.total > 0 ? <span>{toFa(progress.done)}/{toFa(progress.total)} انجام شد</span> : null}
          <span>آخرین ویرایش {relativeTime(note.updatedAt)}</span>
        </div>
      </footer>
    </article>
  );
}

export default function AdminNotes({ admin }) {
  const notify = useToast();
  const can = (permission) => admin.permissions?.includes(permission);

  const [filters, setFilters] = useState({ search: '', kind: 'all', sort: 'updated' });
  const [editor, setEditor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload, setData } = useAsync(() => notesApi.list(filters), [filters]);

  const notes = data?.notes ?? [];
  const stats = data?.stats ?? { total: 0, checklists: 0, pinned: 0, doneItems: 0, totalItems: 0 };
  const isFiltering = Boolean(filters.search.trim()) || filters.kind !== 'all';

  /* ── عملیات ── */

  const submit = async () => {
    const { form, mode } = editor;
    const items = form.kind === 'checklist'
      ? form.items.filter((item) => item.text.trim()).map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        text: item.text.trim(),
        done: item.done,
      }))
      : [];

    if (!form.title.trim() && !form.body.trim() && items.length === 0) {
      notify('یادداشت خالی است؛ عنوان یا متن بنویسید', 'error');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: form.title,
        kind: form.kind,
        body: form.body,
        items,
        pinned: form.pinned,
      };

      if (mode === 'edit') {
        await notesApi.update(form.id, payload);
        notify('یادداشت ذخیره شد');
      } else {
        await notesApi.create(payload);
        notify('یادداشت ساخته شد');
      }

      setEditor(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await notesApi.remove(pendingDelete.id);
      notify('یادداشت حذف شد');
      setPendingDelete(null);
      reload();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /* تغییرات خرد (pin و تیک) اپتیمستیک‌اند تا کارت‌ها نپرند؛ بعد با سرور هم‌راستا می‌شوند */
  const togglePin = async (note) => {
    setData({
      ...data,
      notes: notes.map((row) => (row.id === note.id ? { ...row, pinned: !row.pinned } : row)),
    });
    try {
      await notesApi.setPinned(note.id, !note.pinned);
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      reload();
    }
  };

  const toggleItem = async (note, item) => {
    setData({
      ...data,
      notes: notes.map((row) => (row.id === note.id
        ? { ...row, items: row.items.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)) }
        : row)),
    });
    try {
      await notesApi.toggleItem(note.id, item.id);
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      reload();
    }
  };

  /* ── ویرایشگر آیتم‌های چک‌لیست ── */

  const updateForm = useCallback((patch) => {
    setEditor((current) => ({ ...current, form: { ...current.form, ...patch } }));
  }, []);

  const updateItem = useCallback((key, patch) => {
    setEditor((current) => ({
      ...current,
      form: {
        ...current.form,
        items: current.form.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      },
    }));
  }, []);

  const addItem = useCallback(() => {
    setEditor((current) => ({ ...current, form: { ...current.form, items: [...current.form.items, blankItem()] } }));
  }, []);

  const removeItem = useCallback((key) => {
    setEditor((current) => {
      const items = current.form.items.filter((item) => item.key !== key);
      return { ...current, form: { ...current.form, items: items.length ? items : [blankItem()] } };
    });
  }, []);

  /* ── نمایش ── */

  const renderGrid = (list) => (
    <div className="ad-notegrid">
      {list.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          can={can}
          onEdit={(target) => setEditor(draftFrom(target))}
          onDelete={setPendingDelete}
          onTogglePin={togglePin}
          onToggleItem={toggleItem}
        />
      ))}
    </div>
  );

  const form = editor?.form ?? null;

  return (
    <div className="ad-stack">
      <div className="ad-statgrid">
        <article className="ad-stat ad-stat--purple">
          <span className="ad-stat__icon"><IconNote width={20} height={20} /></span>
          <div>
            <span className="ad-stat__value">{toFa(stats.total)}</span>
            <span className="ad-stat__label">یادداشت</span>
            <small className="ad-stat__hint">{toFa(stats.pinned)} گلچین‌شده</small>
          </div>
        </article>

        <article className="ad-stat ad-stat--blue">
          <span className="ad-stat__icon"><IconList width={20} height={20} /></span>
          <div>
            <span className="ad-stat__value">{toFa(stats.checklists)}</span>
            <span className="ad-stat__label">چک‌لیست</span>
            <small className="ad-stat__hint">فهرست کارهای تیک‌خور</small>
          </div>
        </article>

        <article className="ad-stat ad-stat--green">
          <span className="ad-stat__icon"><IconCheck width={20} height={20} /></span>
          <div>
            <span className="ad-stat__value">{toFa(stats.doneItems)}</span>
            <span className="ad-stat__label">آیتم انجام‌شده</span>
            <small className="ad-stat__hint">از {toFa(stats.totalItems)} آیتم</small>
          </div>
        </article>
      </div>

      <Card
        title="دفترچهٔ یادداشت‌های من"
        description="نکته‌ها، ترفندها و برنامه‌هایت را اینجا بنویس؛ یادداشت‌ها فقط برای حساب خودت نمایش داده می‌شوند."
        actions={can('notes.create') ? (
          <Button onClick={() => setEditor(emptyDraft())}><IconPlus width={16} height={16} />یادداشت جدید</Button>
        ) : null}
      >
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingBlock label="در حال خواندن یادداشت‌ها…" rows={3} /> : null}

        {data ? (
          <div className="ad-stack">
            <div className="ad-toolbar">
              <SearchInput
                value={filters.search}
                placeholder="در عنوان، متن و آیتم‌ها جست‌وجو کن…"
                onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
              />
              <Select
                value={filters.kind}
                options={KIND_FILTERS}
                aria-label="حالت یادداشت"
                onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value }))}
              />
              <Select
                value={filters.sort}
                options={SORT_OPTIONS}
                aria-label="مرتب‌سازی"
                onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}
              />
              <span className="ad-toolbar__end ad-toolbar__hint">
                {toFa(notes.length)} یادداشت نمایش داده می‌شود
              </span>
            </div>

            {notes.length === 0 ? (
              <EmptyState
                title={isFiltering ? 'یادداشتی با این فیلتر پیدا نشد' : 'هنوز یادداشتی نساخته‌اید'}
                description={isFiltering
                  ? 'عبارت دیگری امتحان کنید یا فیلترها را پاک کنید.'
                  : 'اولین یادداشت را بنویسید؛ یک نکتهٔ کاری یا یک چک‌لیست کارهای عقب‌افتاده.'}
                action={isFiltering ? (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', kind: 'all', sort: 'updated' })}>
                    پاک‌کردن فیلترها
                  </Button>
                ) : can('notes.create') ? (
                  <Button size="sm" onClick={() => setEditor(emptyDraft())}>
                    <IconPlus width={16} height={16} />
                    ساخت یادداشت
                  </Button>
                ) : null}
              />
            ) : renderGrid(notes)}
          </div>
        ) : null}
      </Card>

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'edit' ? 'ویرایش یادداشت' : 'یادداشت جدید'}
        subtitle="متنی بنویس یا فهرست کارها را به چک‌لیست تبدیل کن."
        onClose={() => setEditor(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>انصراف</Button>
            <Button onClick={submit} loading={busy}>ذخیره</Button>
          </>
        )}
      >
        {form ? (
          <>
            <div className="ad-kindswitch" role="radiogroup" aria-label="حالت یادداشت">
              {['text', 'checklist'].map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={form.kind === kind}
                  className={`ad-kindswitch__item ${form.kind === kind ? 'is-active' : ''}`}
                  onClick={() => updateForm({ kind })}
                >
                  {kind === 'text' ? <IconNote width={15} height={15} /> : <IconList width={15} height={15} />}
                  {KIND_LABELS[kind]}
                </button>
              ))}
            </div>

            <Field label="عنوان" hint="اختیاری — اگر خالی بماند، کارت «یادداشت بی‌عنوان» می‌شود.">
              <Input
                value={form.title}
                autoFocus
                maxLength={140}
                onChange={(event) => updateForm({ title: event.target.value })}
              />
            </Field>

            {form.kind === 'text' ? (
              <Field label="متن یادداشت">
                <Textarea
                  rows={10}
                  value={form.body}
                  placeholder="نکته‌ها را همین‌جا بنویس…"
                  onChange={(event) => updateForm({ body: event.target.value })}
                />
              </Field>
            ) : (
              <Field label="آیتم‌های چک‌لیست" hint="هر خط یک کار؛ تیک‌ها بعداً روی کارت هم زده می‌شوند.">
                <div className="ad-checklist">
                  {form.items.map((item) => (
                    <div className="ad-checklist__row" key={item.key}>
                      <button
                        type="button"
                        className={`ad-notecheck__tick ${item.done ? 'is-done' : ''}`}
                        aria-pressed={item.done}
                        aria-label={item.done ? 'برداشتن تیک' : 'تیک‌زدن'}
                        onClick={() => updateItem(item.key, { done: !item.done })}
                      >
                        <IconCheck width={12} height={12} />
                      </button>

                      <Input
                        value={item.text}
                        maxLength={300}
                        placeholder="مثلاً: بنر صفحهٔ اصلی را عوض کن"
                        onChange={(event) => updateItem(item.key, { text: event.target.value })}
                      />

                      <IconButton label="حذف آیتم" tone="danger" onClick={() => removeItem(item.key)}>
                        <IconTrash width={16} height={16} />
                      </IconButton>
                    </div>
                  ))}

                  <Button variant="ghost" size="sm" onClick={addItem}>
                    <IconPlus width={15} height={15} />
                    افزودن آیتم
                  </Button>
                </div>
              </Field>
            )}

            <Toggle
              checked={form.pinned}
              label="گلچین"
              hint="یادداشت‌های گلچین‌شده بالای فهرست می‌مانند."
              onChange={(checked) => updateForm({ pinned: checked })}
            />
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف یادداشت"
        message={`«${pendingDelete?.title || 'یادداشت بی‌عنوان'}» برای همیشه حذف می‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
