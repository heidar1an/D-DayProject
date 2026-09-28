/*
 * بخش «SOPها» — فهرست استانداردهای اجرایی و ویرایشگر آن‌ها.
 *
 * فهرست، کارت‌های فشرده است (کد، واحد مالک، نسخه، وضعیت، بازبینی بعدی و
 * پیشرفت چک‌لیست) و با انتخاب هر کارت، ویرایشگر تمام‌عرض باز می‌شود. برای
 * «مشاهدهٔ نسخه‌های قبلی» و «تأیید/رد/درخواست اصلاح» داخل ویرایشگر دکمه هست.
 */

import { useCallback, useMemo, useState } from 'react';

import {
  Button, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, Select, useAsync, useToast,
} from '../../adminShared';
import { IconPlus, IconStandard, IconTrash } from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import { SOP_STATUSES, labelOf, toneOf } from '../../../../services/planning/planningTypes';
import { diffDays, isoDate, jalaliLabel, parseISODate, relativeFa, toFa } from '../../../../services/planning/jalali';
import {
  ExportMenu, Fieldset, Meter, Pill, Toolbar, ToolbarSpacer, exportCsv, exportExcel,
} from '../planningKit';
import SopEditor from '../components/sop/SopEditor';
import JalaliDatePicker from '../components/calendar/JalaliDatePicker';

export default function SopSection() {
  const notify = useToast();

  const [filters, setFilters] = useState({ search: '', status: '', unitId: '', reviewDue: false });
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    title: '', code: '', unitId: '', authorId: '', reviewerId: '', version: '۱٫۰', nextReviewAt: '',
  });

  const { data: units } = useAsync(() => planning.org.units(), []);
  const { data: users } = useAsync(() => planning.org.users(), []);

  const loader = useCallback(() => planning.sop.list({
    search: filters.search || undefined,
    status: filters.status || undefined,
    unitId: filters.unitId || undefined,
    reviewDue: filters.reviewDue || undefined,
  }), [filters]);

  const { data: rows, loading, error, reload } = useAsync(loader, [loader]);
  const items = rows ?? [];

  const stats = useMemo(() => ({
    total: items.length,
    approved: items.filter((row) => row.status === 'approved').length,
    review: items.filter((row) => row.status === 'review').length,
    dueSoon: items.filter((row) => {
      const next = parseISODate(row.nextReviewAt);
      return next && diffDays(next, new Date()) <= 60;
    }).length,
  }), [items]);

  const openCreate = () => {
    setDraft({
      title: '',
      code: `SOP-${new Date().getFullYear()}-${String(items.length + 1).padStart(3, '0')}`,
      unitId: units?.[0]?.id ?? '',
      authorId: users?.[0]?.id ?? '',
      reviewerId: users?.[0]?.id ?? '',
      version: '۱٫۰',
      nextReviewAt: isoDate(new Date(Date.now() + 365 * 86_400_000)),
    });
    setCreateOpen(true);
  };

  const create = async () => {
    setBusy(true);
    try {
      const created = await planning.sop.create(draft);
      notify('SOP ساخته شد');
      setCreateOpen(false);
      await reload();
      setEditing(created.id);
    } catch (createError) {
      notify(createError.message ?? 'ساخت SOP ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await planning.sop.remove(deleteTarget.id);
      notify('SOP حذف شد');
      setDeleteTarget(null);
      reload();
    } finally {
      setBusy(false);
    }
  };

  /* ویرایشگر تمام‌عرض */
  if (editing) {
    const current = items.find((row) => row.id === editing) ?? null;
    if (!current) {
      return (
        <div className="pl-stack">
          <EmptyState
            title="این SOP پیدا نشد"
            description="ممکن است حذف شده باشد."
            action={<Button size="sm" onClick={() => setEditing(null)}>بازگشت به فهرست</Button>}
          />
        </div>
      );
    }

    return (
      <SopEditor
        sop={current}
        units={units ?? []}
        users={users ?? []}
        onBack={() => setEditing(null)}
        onChanged={() => reload()}
      />
    );
  }

  const columns = [
    { label: 'کد', value: (row) => row.code },
    { label: 'عنوان', value: (row) => row.title },
    { label: 'واحد مالک', value: (row) => row.unit?.name ?? '' },
    { label: 'نویسنده', value: (row) => row.author?.name ?? '' },
    { label: 'ناظر', value: (row) => row.reviewer?.name ?? '' },
    { label: 'نسخه', value: (row) => row.version },
    { label: 'وضعیت', value: (row) => labelOf(SOP_STATUSES, row.status) },
    { label: 'بازبینی بعدی', value: (row) => row.nextReviewAt },
    { label: 'چک‌لیست', value: (row) => `${row.checklistDone}/${row.checklistTotal}` },
  ];

  const handleExport = (format) => {
    const ok = format === 'csv'
      ? exportCsv('sop', columns, items)
      : exportExcel('sop', columns, items, 'فهرست SOPها');
    notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی نیست');
  };

  return (
    <div className="pl-stack">
      <Toolbar>
        <div className="pl-views">
          <button type="button" className={`pl-view ${!filters.status && !filters.reviewDue ? 'is-active' : ''}`} onClick={() => setFilters((state) => ({ ...state, status: '', reviewDue: false }))}>همه</button>
          {SOP_STATUSES.map((status) => (
            <button
              key={status.value}
              type="button"
              className={`pl-view ${filters.status === status.value ? 'is-active' : ''}`}
              onClick={() => setFilters((state) => ({ ...state, status: state.status === status.value ? '' : status.value, reviewDue: false }))}
            >
              {status.label}
            </button>
          ))}
          <button
            type="button"
            className={`pl-view ${filters.reviewDue ? 'is-active' : ''}`}
            onClick={() => setFilters((state) => ({ ...state, reviewDue: !state.reviewDue, status: '' }))}
          >
            بازبینی نزدیک
          </button>
        </div>

        <ToolbarSpacer />

        <input
          className="pl-input pl-input--search"
          value={filters.search}
          placeholder="جست‌وجوی عنوان یا کد…"
          onChange={(event) => setFilters((state) => ({ ...state, search: event.target.value }))}
        />

        <Button variant="ghost" size="sm" onClick={() => setShowFilters((state) => !state)}>فیلتر واحد</Button>
        <ExportMenu disabled={!items.length} onExport={handleExport} />
        <Button size="sm" onClick={openCreate}>
          <IconPlus width={15} height={15} />
          SOP تازه
        </Button>
      </Toolbar>

      <div className="pl-kpi-grid pl-kpi-grid--tight">
        <div className="pl-mini"><span className="pl-mini__label">کل اسناد</span><b className="pl-mini__value">{toFa(stats.total)}</b></div>
        <div className="pl-mini pl-mini--good"><span className="pl-mini__label">تأییدشده</span><b className="pl-mini__value">{toFa(stats.approved)}</b></div>
        <div className="pl-mini pl-mini--warn"><span className="pl-mini__label">در حال بررسی</span><b className="pl-mini__value">{toFa(stats.review)}</b></div>
        <div className="pl-mini pl-mini--critical"><span className="pl-mini__label">بازبینی نزدیک</span><b className="pl-mini__value">{toFa(stats.dueSoon)}</b></div>
      </div>

      {showFilters ? (
        <div className="pl-filters pl-filters--plain">
          <Fieldset label="واحد مالک">
            <select className="pl-select" value={filters.unitId} onChange={(event) => setFilters((state) => ({ ...state, unitId: event.target.value }))}>
              <option value="">همهٔ واحدها</option>
              {(units ?? []).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </Fieldset>
          <button type="button" className="pl-linkbtn" onClick={() => setFilters({ search: '', status: '', unitId: '', reviewDue: false })}>پاک کردن فیلترها</button>
        </div>
      ) : null}

      {error ? (
        <div className="pl-inline-error" role="alert">
          <div><strong>فهرست SOPها خوانده نشد</strong><p>{error.message}</p></div>
          <button type="button" className="pl-linkbtn" onClick={() => reload()}>تلاش دوباره</button>
        </div>
      ) : null}

      {loading && !rows ? <LoadingBlock label="در حال خواندن اسناد…" rows={4} /> : null}

      {rows && items.length === 0 ? (
        <EmptyState
          title="سندی با این فیلترها نیست"
          description="نخستین SOP را بسازید و مراحل فرایند را مستند کنید."
          action={<Button size="sm" onClick={openCreate}>SOP تازه</Button>}
        />
      ) : null}

      {rows && items.length > 0 ? (
        <div className="pl-sopgrid">
          {items.map((row) => {
            const next = parseISODate(row.nextReviewAt);
            const dueSoon = next && diffDays(next, new Date()) <= 60;

            return (
              <article key={row.id} className={`pl-sopcard pl-sopcard--${row.status}`}>
                <header className="pl-sopcard__head">
                  <span className="pl-sopcard__icon" aria-hidden="true"><IconStandard width={18} height={18} /></span>
                  <div>
                    <code className="pl-mono">{row.code}</code>
                    <h4>{row.title}</h4>
                  </div>
                  <Pill tone={toneOf(SOP_STATUSES, row.status)} soft={false}>{labelOf(SOP_STATUSES, row.status)}</Pill>
                </header>

                <p className="pl-sopcard__purpose">{row.purpose || 'هدف ثبت نشده است.'}</p>

                <dl className="pl-deflist pl-deflist--inline">
                  <div><dt>واحد مالک</dt><dd>{row.unit?.name ?? '—'}</dd></div>
                  <div><dt>نویسنده</dt><dd>{row.author?.name ?? '—'}</dd></div>
                  <div><dt>ناظر</dt><dd>{row.reviewer?.name ?? '—'}</dd></div>
                  <div><dt>نسخه</dt><dd>{row.version}</dd></div>
                  <div><dt>بازبینی بعدی</dt><dd className={dueSoon ? 'is-danger' : ''}>{jalaliLabel(row.nextReviewAt)}</dd></div>
                  <div><dt>آخرین ویرایش</dt><dd>{relativeFa(row.updatedAt)}</dd></div>
                </dl>

                {row.checklistTotal ? (
                  <Meter
                    value={row.checklistDone}
                    max={row.checklistTotal}
                    tone={row.checklistDone === row.checklistTotal ? 'green' : 'accent'}
                    label={`چک‌لیست ${toFa(row.checklistDone)} از ${toFa(row.checklistTotal)}`}
                  />
                ) : null}

                <footer className="pl-sopcard__foot">
                  <span className="pl-muted">{toFa((row.versions ?? []).length)} نسخهٔ بایگانی</span>
                  <span className="pl-spacer" />
                  <Button variant="ghost" size="sm" onClick={() => setEditing(row.id)}>مشاهده و ویرایش</Button>
                  <button
                    type="button"
                    className="pl-iconbtn pl-iconbtn--sm pl-iconbtn--danger"
                    onClick={() => setDeleteTarget(row)}
                    aria-label="حذف SOP"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      ) : null}

      <Modal
        open={createOpen}
        title="SOP تازه"
        subtitle="پس از ساخت، ویرایشگر کامل باز می‌شود"
        onClose={() => setCreateOpen(false)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>انصراف</Button>
            <Button onClick={create} loading={busy} disabled={!draft.title.trim() || !draft.code.trim()}>ساخت و ویرایش</Button>
          </>
        )}
      >
        <div className="pl-form">
          <Field label="عنوان SOP" required>
            <Input value={draft.title} onChange={(event) => setDraft((state) => ({ ...state, title: event.target.value }))} placeholder="مثلاً فرایند انتشار محتوای آموزشی" />
          </Field>

          <div className="pl-form__row">
            <Field label="کد SOP" required>
              <Input value={draft.code} onChange={(event) => setDraft((state) => ({ ...state, code: event.target.value }))} dir="ltr" />
            </Field>
            <Field label="نسخه">
              <Input value={draft.version} onChange={(event) => setDraft((state) => ({ ...state, version: event.target.value }))} />
            </Field>
            <Field label="بازبینی بعدی">
              <JalaliDatePicker value={draft.nextReviewAt} onChange={(iso) => setDraft((state) => ({ ...state, nextReviewAt: iso }))} allowClear={false} />
            </Field>
          </div>

          <div className="pl-form__row">
            <Field label="واحد مالک">
              <Select value={draft.unitId} onChange={(event) => setDraft((state) => ({ ...state, unitId: event.target.value }))} options={(units ?? []).map((unit) => ({ value: unit.id, label: unit.name }))} />
            </Field>
            <Field label="نویسنده">
              <Select value={draft.authorId} onChange={(event) => setDraft((state) => ({ ...state, authorId: event.target.value }))} options={(users ?? []).map((user) => ({ value: user.id, label: user.name }))} />
            </Field>
            <Field label="ناظر / تأییدکننده">
              <Select value={draft.reviewerId} onChange={(event) => setDraft((state) => ({ ...state, reviewerId: event.target.value }))} options={(users ?? []).map((user) => ({ value: user.id, label: user.name }))} />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف SOP"
        message={`سند «${deleteTarget?.title ?? ''}» با همهٔ نسخه‌ها و کامنت‌هایش حذف می‌شود. این کار برگشت‌پذیر نیست.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
