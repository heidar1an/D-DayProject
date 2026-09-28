/*
 * بخش «ابلاغ‌ها» — پیگیری ابلاغ تسک‌ها به بخش‌ها، واحدها و افراد.
 *
 * هر ابلاغ یک چرخهٔ وضعیت دارد: ارسال → مشاهده → پذیرش / بازگشت / رد.
 * عملیات هر ردیف بر اساس همان چرخه فعال یا غیرفعال می‌شود تا دکمهٔ بی‌معنا
 * نمایش داده نشود.
 */

import { useCallback, useMemo, useState } from 'react';

import { Button, EmptyState, LoadingBlock, Modal, Textarea, useAsync, useToast } from '../../adminShared';
import { IconPlus, IconSend, IconTeam } from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import {
  ACCESS_LEVELS, ASSIGNMENT_STATES, ORG_LEVELS, PRIORITIES, REPORT_CYCLES,
  labelOf, toneOf,
} from '../../../../services/planning/planningTypes';
import { jalaliLabel, relativeFa, toFa } from '../../../../services/planning/jalali';
import {
  Empty, ExportMenu, Fieldset, Panel, Pill, Toolbar, ToolbarSpacer, exportCsv, exportExcel,
} from '../planningKit';
import AssignDialog from '../components/AssignDialog';

export default function AssignmentsSection() {
  const notify = useToast();

  const [filters, setFilters] = useState({ state: '', accessLevel: '', pending: false });
  const [showFilters, setShowFilters] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnNote, setReturnNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: projects } = useAsync(() => planning.org.projects(), []);
  const { data: users } = useAsync(() => planning.org.users(), []);
  const { data: units } = useAsync(() => planning.org.units(), []);
  const { data: tasks } = useAsync(() => planning.tasks.list({ perPage: 0 }), []);
  const { data: hierarchy } = useAsync(() => planning.org.hierarchy(), []);

  const loader = useCallback(() => planning.assignments.list({
    state: filters.state || undefined,
    accessLevel: filters.accessLevel || undefined,
    pending: filters.pending || undefined,
  }), [filters]);

  const { data: rows, loading, error, reload } = useAsync(loader, [loader]);

  const items = rows ?? [];

  const stats = useMemo(() => ({
    total: items.length,
    pending: items.filter((row) => row.state === 'sent').length,
    accepted: items.filter((row) => row.state === 'accepted').length,
    returned: items.filter((row) => row.state === 'returned').length,
    reports: items.filter((row) => row.requireReport).length,
  }), [items]);

  const act = async (action, id, message) => {
    setBusy(true);
    try {
      await action(id);
      notify(message);
      reload();
    } catch (actionError) {
      notify(actionError.message ?? 'عملیات ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitReturn = async () => {
    await act((id) => planning.assignments.returnForFix(id, returnNote), returnTarget.id, 'تسک برای اصلاح بازگردانده شد');
    setReturnTarget(null);
    setReturnNote('');
  };

  const columns = [
    { label: 'تسک', value: (row) => row.task?.title ?? '' },
    { label: 'گیرندگان', value: (row) => row.recipients.map((user) => user.name).join('، ') },
    { label: 'واحدها', value: (row) => row.recipientUnits.map((unit) => unit.name).join('، ') },
    { label: 'سطح دسترسی', value: (row) => labelOf(ACCESS_LEVELS, row.accessLevel) },
    { label: 'مهلت', value: (row) => row.dueDate },
    { label: 'وضعیت', value: (row) => labelOf(ASSIGNMENT_STATES, row.state) },
    { label: 'ابلاغ‌کننده', value: (row) => row.issuer?.name ?? '' },
    { label: 'زمان ابلاغ', value: (row) => row.issuedAt },
    { label: 'الزام گزارش', value: (row) => (row.requireReport ? labelOf(REPORT_CYCLES, row.reportCycle) : 'ندارد') },
  ];

  const handleExport = (format) => {
    const ok = format === 'csv'
      ? exportCsv('assignments', columns, items)
      : exportExcel('assignments', columns, items, 'فهرست ابلاغ‌ها');
    notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی نیست');
  };

  return (
    <div className="pl-stack">
      <Toolbar>
        <div className="pl-views">
          <button type="button" className={`pl-view ${!filters.pending ? 'is-active' : ''}`} onClick={() => setFilters((state) => ({ ...state, pending: false }))}>همهٔ ابلاغ‌ها</button>
          <button type="button" className={`pl-view ${filters.pending ? 'is-active' : ''}`} onClick={() => setFilters((state) => ({ ...state, pending: true }))}>
            منتظر اقدام {stats.pending ? <span className="pl-badge-count">{toFa(stats.pending)}</span> : null}
          </button>
          <button type="button" className={`pl-view ${showTree ? 'is-active' : ''}`} onClick={() => setShowTree((state) => !state)}>
            <IconTeam width={14} height={14} />
            سلسله‌مراتب سازمانی
          </button>
        </div>

        <ToolbarSpacer />

        <Button variant="ghost" size="sm" onClick={() => setShowFilters((state) => !state)}>فیلتر</Button>
        <ExportMenu disabled={!items.length} onExport={handleExport} />
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <IconPlus width={15} height={15} />
          ابلاغ تازه
        </Button>
      </Toolbar>

      <div className="pl-kpi-grid pl-kpi-grid--tight">
        <div className="pl-mini"><span className="pl-mini__label">کل ابلاغ‌ها</span><b className="pl-mini__value">{toFa(stats.total)}</b></div>
        <div className="pl-mini pl-mini--warn"><span className="pl-mini__label">منتظر مشاهده</span><b className="pl-mini__value">{toFa(stats.pending)}</b></div>
        <div className="pl-mini pl-mini--good"><span className="pl-mini__label">پذیرفته‌شده</span><b className="pl-mini__value">{toFa(stats.accepted)}</b></div>
        <div className="pl-mini pl-mini--critical"><span className="pl-mini__label">بازگشتی برای اصلاح</span><b className="pl-mini__value">{toFa(stats.returned)}</b></div>
        <div className="pl-mini"><span className="pl-mini__label">با الزام گزارش</span><b className="pl-mini__value">{toFa(stats.reports)}</b></div>
      </div>

      {showFilters ? (
        <Panel className="pl-filters" title="فیلتر ابلاغ‌ها">
          <div className="pl-filtergrid">
            <Fieldset label="وضعیت ابلاغ">
              <select className="pl-select" value={filters.state} onChange={(event) => setFilters((state) => ({ ...state, state: event.target.value }))}>
                <option value="">همهٔ وضعیت‌ها</option>
                {ASSIGNMENT_STATES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="سطح دسترسی">
              <select className="pl-select" value={filters.accessLevel} onChange={(event) => setFilters((state) => ({ ...state, accessLevel: event.target.value }))}>
                <option value="">همهٔ سطح‌ها</option>
                {ACCESS_LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Fieldset>
          </div>
        </Panel>
      ) : null}

      {showTree ? (
        <Panel title="سلسله‌مراتب سازمانی" description="هر سطح فقط تسک‌های مجاز خود را می‌بیند؛ مدیر کل همه، مدیر واحد زیرمجموعه و عضو تیم فقط تسک‌های خودش">
          <ul className="pl-orgtree">
            {(hierarchy ?? []).map((unit) => (
              <li key={unit.id}>
                <div className="pl-orgtree__unit">
                  <span className={`pl-orgtree__badge pl-orgtree__badge--${unit.level}`}>{labelOf(ORG_LEVELS, unit.level)}</span>
                  <strong>{unit.name}</strong>
                  <small>{unit.head ? `مسئول: ${unit.head.name}` : 'بدون مسئول'}</small>
                  <span className="pl-muted">{toFa(unit.members.length)} عضو</span>
                </div>

                {unit.children.length ? (
                  <ul className="pl-orgtree__children">
                    {unit.children.map((child) => (
                      <li key={child.id}>
                        <div className="pl-orgtree__unit">
                          <span className={`pl-orgtree__badge pl-orgtree__badge--${child.level}`}>{labelOf(ORG_LEVELS, child.level)}</span>
                          <strong>{child.name}</strong>
                          <small>{child.head ? `مسئول: ${child.head.name}` : 'بدون مسئول'}</small>
                          <span className="pl-muted">{toFa(child.members.length)} عضو</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {error ? (
        <div className="pl-inline-error" role="alert">
          <div><strong>ابلاغ‌ها خوانده نشد</strong><p>{error.message}</p></div>
          <button type="button" className="pl-linkbtn" onClick={() => reload()}>تلاش دوباره</button>
        </div>
      ) : null}

      {loading && !rows ? <LoadingBlock label="در حال خواندن ابلاغ‌ها…" rows={4} /> : null}

      {rows && items.length === 0 ? (
        <Empty
          title="ابلاغی با این فیلترها نیست"
          description="با دکمهٔ «ابلاغ تازه» یک تسک را به واحدها یا افراد پایین‌رده ابلاغ کنید."
          action={<Button size="sm" onClick={() => setDialogOpen(true)}>ابلاغ تازه</Button>}
        />
      ) : null}

      {rows && items.length > 0 ? (
        <div className="pl-assignlist">
          {items.map((row) => (
            <article key={row.id} className={`pl-assignrow pl-assignrow--${row.state}`}>
              <header className="pl-assignrow__head">
                <div>
                  <code className="pl-mono">{row.task?.code ?? '—'}</code>
                  <h4>{row.task?.title ?? 'تسک حذف‌شده'}</h4>
                </div>
                <Pill tone={toneOf(ASSIGNMENT_STATES, row.state)} soft={false}>{labelOf(ASSIGNMENT_STATES, row.state)}</Pill>
              </header>

              <div className="pl-assignrow__body">
                <dl className="pl-deflist pl-deflist--inline">
                  <div><dt>سطح دسترسی</dt><dd>{labelOf(ACCESS_LEVELS, row.accessLevel)}</dd></div>
                  <div><dt>مهلت انجام</dt><dd>{jalaliLabel(row.dueDate)}</dd></div>
                  <div><dt>ابلاغ‌کننده</dt><dd>{row.issuer?.name ?? '—'}</dd></div>
                  <div><dt>زمان ابلاغ</dt><dd>{relativeFa(row.issuedAt)}</dd></div>
                  <div><dt>مشاهده شد</dt><dd>{row.seenAt ? relativeFa(row.seenAt) : 'هنوز نه'}</dd></div>
                  <div><dt>پاسخ</dt><dd>{row.respondedAt ? relativeFa(row.respondedAt) : '—'}</dd></div>
                  <div><dt>گزارش پیشرفت</dt><dd>{row.requireReport ? labelOf(REPORT_CYCLES, row.reportCycle) : 'الزامی نیست'}</dd></div>
                  <div><dt>اعلان</dt><dd>{[row.notifyInApp ? 'داخل پنل' : null, row.notifyEmail ? 'ایمیل' : null].filter(Boolean).join(' + ') || 'بدون اعلان'}</dd></div>
                </dl>

                <div className="pl-assignrow__people">
                  <div>
                    <span className="pl-assignrow__label">گیرندگان</span>
                    <div className="pl-chips">
                      {row.recipients.length === 0 ? <span className="pl-muted">—</span> : row.recipients.map((user) => (
                        <span key={user.id} className="pl-chipuser">
                          <span className="pl-avatar pl-avatar--sm">{user.avatar}</span>
                          {user.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="pl-assignrow__label">واحدها</span>
                    <div className="pl-chips">
                      {row.recipientUnits.length === 0 ? <span className="pl-muted">—</span> : row.recipientUnits.map((unit) => (
                        <Pill key={unit.id} tone="info">{unit.name}</Pill>
                      ))}
                    </div>
                  </div>
                </div>

                {row.note ? <p className="pl-assignrow__note">{row.note}</p> : null}
                {row.returnNote ? <p className="pl-assignrow__return">دلیل بازگشت: {row.returnNote}</p> : null}
              </div>

              <footer className="pl-assignrow__foot">
                <Pill tone={toneOf(PRIORITIES, row.task?.priority)}>{labelOf(PRIORITIES, row.task?.priority ?? 'medium')}</Pill>

                <span className="pl-spacer" />

                {row.state === 'sent' ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => act((id) => planning.assignments.markSeen(id), row.id, 'ابلاغ مشاهده‌شده ثبت شد')}>
                    ثبت مشاهده
                  </Button>
                ) : null}

                {row.state !== 'accepted' ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => act((id) => planning.assignments.accept(id), row.id, 'ابلاغ پذیرفته شد')}>
                    پذیرش تسک
                  </Button>
                ) : null}

                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setReturnTarget(row)}>
                  بازگرداندن برای اصلاح
                </Button>

                <Button variant="ghost" size="sm" disabled={busy} onClick={() => act((id) => planning.assignments.reject(id, 'امکان انجام در مهلت تعیین‌شده نیست'), row.id, 'ابلاغ رد شد')}>
                  رد ابلاغ
                </Button>

                <Button size="sm" disabled={busy} onClick={() => act((id) => planning.assignments.remind(id), row.id, 'یادآوری برای گیرندگان ارسال شد')}>
                  <IconSend width={14} height={14} />
                  یادآوری
                </Button>
              </footer>
            </article>
          ))}
        </div>
      ) : null}

      <AssignDialog
        open={dialogOpen}
        tasks={tasks?.items ?? []}
        units={units ?? []}
        users={users ?? []}
        projects={projects ?? []}
        onClose={() => setDialogOpen(false)}
        onSaved={reload}
      />

      <Modal
        open={Boolean(returnTarget)}
        size="sm"
        title="بازگرداندن برای اصلاح"
        subtitle={returnTarget?.task?.title}
        onClose={() => setReturnTarget(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setReturnTarget(null)}>انصراف</Button>
            <Button onClick={submitReturn} loading={busy}>ثبت و ارسال اعلان</Button>
          </>
        )}
      >
        <Textarea
          rows={4}
          value={returnNote}
          onChange={(event) => setReturnNote(event.target.value)}
          placeholder="چه چیزی باید اصلاح شود؟ این متن برای گیرنده ارسال می‌شود."
        />
      </Modal>
    </div>
  );
}
