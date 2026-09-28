/*
 * بخش «مالی» — خلاصهٔ درآمد، هزینه و سود + ثبت دستی تراکنش.
 *
 * تعریف شاخص‌ها (همان چیزی که در سرویس محاسبه می‌شود):
 *   پول ورودی  = مجموع مبالغ دریافت‌شده
 *   سود ناخالص = درآمد − هزینهٔ مستقیم
 *   سود خالص   = درآمد − (هزینهٔ مستقیم + هزینهٔ غیرمستقیم)
 *
 * همهٔ ارقام با جداکنندهٔ فارسی و واحد تومان نمایش داده می‌شوند. مقایسه همیشه با
 * ماه قبل (اگر ماه انتخاب شده باشد) یا سال قبل انجام می‌شود.
 *
 * چون درگاه پرداخت آنلاین به پروژه وصل نیست، همهٔ ارقام از ثبت دستی می‌آیند؛
 * دکمه‌های «ثبت هزینه» و «ثبت درآمد» بالای همین صفحه‌اند و حالت پرداخت هر
 * تراکنش فقط «بانکی» یا «مستقیم» است.
 */

import { useCallback, useMemo, useState } from 'react';

import { Button, ConfirmDialog, EmptyState, IconButton, LoadingBlock, useAsync, useToast } from '../../adminShared';
import {
  IconCoins, IconCompare, IconEdit, IconPlus, IconReceipt, IconTrash, IconTrendUp, IconWallet,
} from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import {
  PAYMENT_MODES, TRANSACTION_KINDS, labelOf, toneOf,
} from '../../../../services/planning/planningTypes';
import {
  JALALI_MONTHS, faCompact, faNumber, faPercent, faToman, jalaliLabel, toFa, todayJalali,
} from '../../../../services/planning/jalali';
import {
  Bar, BarChart, Donut, ExportMenu, Kpi, Legend, LineChart, Panel, Pill,
  Toolbar, ToolbarSpacer, exportCsv, exportExcel,
} from '../planningKit';
import { JalaliMonthSelect, JalaliYearSelect } from '../components/calendar/JalaliDatePicker';
import TransactionDialog from '../components/finance/TransactionDialog';

export default function FinanceSection() {
  const notify = useToast();

  const [jy, setJy] = useState(() => todayJalali().jy);
  const [jm, setJm] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [detail, setDetail] = useState('');
  const [txKind, setTxKind] = useState('');
  const [txPayment, setTxPayment] = useState('');
  const [search, setSearch] = useState('');

  /* پنجرهٔ ثبت/ویرایش + تراکنشی که در حال حذف است */
  const [dialog, setDialog] = useState({ open: false, transaction: null, kind: '' });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: projects } = useAsync(() => planning.org.projects(), []);
  const { data: years, reload: reloadYears } = useAsync(() => planning.finance.years(), []);

  const params = useMemo(
    () => ({ jy, jm: jm ?? undefined, projectId: projectId || undefined }),
    [jy, jm, projectId],
  );

  const summaryLoader = useCallback(() => planning.finance.summary(params), [params]);
  const { data: summary, loading, error, reload } = useAsync(summaryLoader, [summaryLoader]);

  const compareLoader = useCallback(() => planning.finance.compare(params), [params]);
  const { data: compare } = useAsync(compareLoader, [compareLoader]);

  const seriesLoader = useCallback(() => planning.finance.series(params), [params]);
  const { data: series } = useAsync(seriesLoader, [seriesLoader]);

  const byProjectLoader = useCallback(() => planning.finance.byProject({ jy }), [jy]);
  const { data: byProject } = useAsync(byProjectLoader, [byProjectLoader]);

  const txLoader = useCallback(
    () => planning.finance.transactions({
      ...params, kind: txKind || undefined, payment: txPayment || undefined, search: search || undefined,
    }),
    [params, txKind, txPayment, search],
  );
  const { data: transactions, loading: txLoading, reload: reloadTx } = useAsync(txLoader, [txLoader]);

  /* پس از هر ثبت/ویرایش/حذف، همهٔ شاخص‌ها از نو خوانده می‌شوند */
  const refreshAll = useCallback(() => {
    reload();
    reloadTx();
    reloadYears();
  }, [reload, reloadTx, reloadYears]);

  const removeTransaction = async () => {
    setBusy(true);
    try {
      await planning.finance.remove(pendingDelete.id);
      notify('تراکنش حذف شد');
      setPendingDelete(null);
      refreshAll();
    } catch (error) {
      notify(error.message ?? 'حذف ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const months = series?.months ?? [];
  const previousMonths = series?.previous ?? [];

  /* ادغام سری امسال و پارسال برای نمودار مقایسه‌ای */
  const merged = useMemo(
    () => months.map((row, index) => ({
      ...row,
      prevIncome: previousMonths[index]?.income ?? 0,
      prevNet: previousMonths[index]?.net ?? 0,
      expenses: row.direct + row.indirect,
    })),
    [months, previousMonths],
  );

  const rangeLabel = jm ? `${JALALI_MONTHS[jm - 1]} ${toFa(jy)}` : `سال ${toFa(jy)}`;
  const payments = summary?.payments ?? { total: { bank: 0, direct: 0 }, income: { bank: 0, direct: 0 }, expense: { bank: 0, direct: 0 } };

  const columns = [
    { label: 'کد', value: (row) => row.code },
    { label: 'عنوان', value: (row) => row.title },
    { label: 'نوع', value: (row) => labelOf(TRANSACTION_KINDS, row.kind) },
    { label: 'مبلغ (تومان)', value: (row) => row.amount },
    { label: 'تاریخ', value: (row) => row.date },
    { label: 'پروژه', value: (row) => row.project?.title ?? '' },
    { label: 'حالت پرداخت', value: (row) => labelOf(PAYMENT_MODES, row.payment) },
    { label: 'طرف حساب', value: (row) => row.party ?? '' },
  ];

  const handleExport = (format) => {
    const ok = format === 'csv'
      ? exportCsv('finance', columns, transactions ?? [])
      : exportExcel('finance', columns, transactions ?? [], `تراکنش‌های ${rangeLabel}`);
    notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی نیست');
  };

  if (error) {
    return (
      <div className="pl-stack">
        <div className="pl-inline-error" role="alert">
          <div><strong>دادهٔ مالی خوانده نشد</strong><p>{error.message}</p></div>
          <button type="button" className="pl-linkbtn" onClick={() => reload()}>تلاش دوباره</button>
        </div>
      </div>
    );
  }

  if (loading && !summary) return <LoadingBlock label="در حال محاسبهٔ شاخص‌های مالی…" rows={5} />;

  const delta = compare?.delta ?? {};

  return (
    <div className="pl-stack">
      <Toolbar>
        <div className="pl-views">
          <button type="button" className={`pl-view ${!jm ? 'is-active' : ''}`} onClick={() => setJm(null)}>نمای سالانه</button>
          <button type="button" className={`pl-view ${jm ? 'is-active' : ''}`} onClick={() => setJm(todayJalali().jm)}>نمای ماهانه</button>
        </div>

        <ToolbarSpacer />

        <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, transaction: null, kind: 'direct-cost' })}>
          <IconPlus width={15} height={15} />
          ثبت هزینه
        </Button>
        <Button size="sm" onClick={() => setDialog({ open: true, transaction: null, kind: 'income' })}>
          <IconWallet width={15} height={15} />
          ثبت درآمد
        </Button>

        <JalaliYearSelect value={jy} onChange={setJy} />
        <JalaliMonthSelect value={jm} onChange={setJm} />

        <select className="pl-select pl-select--sm" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="پروژه">
          <option value="">همهٔ پروژه‌ها</option>
          {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>

        <ExportMenu disabled={!(transactions ?? []).length} onExport={handleExport} />
      </Toolbar>

      <div className="pl-finstats">
        <span>بازه: <b>{rangeLabel}</b></span>
        <span>مقایسه با: <b>{compare?.label ?? '—'}</b></span>
        <span className="pl-muted">مبالغ به تومان — ارقام از تراکنش‌های ثبت‌شده محاسبه می‌شوند</span>
      </div>

      {/* ── کارت‌های مدیریتی ── */}
      <div className="pl-kpi-grid">
        <Kpi
          label="مجموع پول ورودی"
          value={faToman(summary?.inflow, { unit: false })}
          unit="تومان"
          tone="green"
          icon={IconCoins}
          delta={delta.inflow}
          hint={`میانگین ماهانه ${faCompact(summary?.monthlyAverage)} تومان`}
          onClick={() => setDetail(detail === 'inflow' ? '' : 'inflow')}
        />
        <Kpi
          label="سود ناخالص"
          value={faToman(summary?.grossProfit, { unit: false })}
          unit="تومان"
          tone="accent"
          icon={IconTrendUp}
          delta={delta.grossProfit}
          hint={`درآمد منهای هزینهٔ مستقیم (${faCompact(summary?.directCost)} تومان)`}
          onClick={() => setDetail(detail === 'gross' ? '' : 'gross')}
        />
        <Kpi
          label="سود خالص"
          value={faToman(summary?.netProfit, { unit: false })}
          unit="تومان"
          tone={summary?.netProfit >= 0 ? 'blue' : 'danger'}
          delta={delta.netProfit}
          hint={`حاشیهٔ سود ${faPercent(summary?.margin)}`}
          onClick={() => setDetail(detail === 'net' ? '' : 'net')}
        />
        <Kpi
          label="مجموع هزینه‌ها"
          value={faToman(summary?.expenses, { unit: false })}
          unit="تومان"
          tone="gold"
          delta={delta.expenses}
          hint={`مستقیم ${faCompact(summary?.directCost)} · غیرمستقیم ${faCompact(summary?.indirectCost)}`}
          onClick={() => setDetail(detail === 'expenses' ? '' : 'expenses')}
        />
        <Kpi
          label="تعداد تراکنش‌ها"
          value={faNumber(summary?.transactions)}
          tone="neutral"
          delta={delta.transactions}
          hint={`${toFa(summary?.months ?? 0)} ماه دارای تراکنش`}
        />
        <Kpi
          label="میانگین درآمد ماهانه"
          value={faToman(summary?.monthlyAverage, { unit: false })}
          unit="تومان"
          tone="blue"
          hint="مجموع دریافتی تقسیم بر ماه‌های دارای تراکنش"
        />
        <Kpi
          label="درصد حاشیهٔ سود"
          value={faPercent(summary?.margin)}
          tone={summary?.margin >= 25 ? 'green' : summary?.margin >= 0 ? 'gold' : 'danger'}
          delta={delta.margin}
          hint="سود خالص تقسیم بر پول ورودی"
        />
      </div>

      {/* ── جزئیات شاخص انتخاب‌شده ── */}
      {detail ? (
        <Panel
          title={`جزئیات شاخص: ${
            detail === 'inflow' ? 'پول ورودی'
              : detail === 'gross' ? 'سود ناخالص'
                : detail === 'net' ? 'سود خالص' : 'مجموع هزینه‌ها'}`}
          description="تفکیک ماه‌به‌ماه همین شاخص در بازهٔ انتخاب‌شده"
          actions={<Button variant="ghost" size="sm" onClick={() => setDetail('')}>بستن</Button>}
        >
          <ul className="pl-detaillist">
            {months.map((row) => (
              <li key={row.label}>
                <span className="pl-detaillist__month">{row.label}</span>
                <Bar
                  value={detail === 'inflow' ? row.income
                    : detail === 'gross' ? row.gross
                      : detail === 'net' ? row.net
                        : row.direct + row.indirect}
                  max={Math.max(1, ...months.map((item) => item.income))}
                  tone={detail === 'expenses' ? 'gold' : detail === 'net' ? 'blue' : 'accent'}
                  label=""
                  valueLabel={faCompact(detail === 'inflow' ? row.income
                    : detail === 'gross' ? row.gross
                      : detail === 'net' ? row.net
                        : row.direct + row.indirect)}
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* ── نمودارها ── */}
      <div className="pl-chartgrid">
        <Panel title="روند درآمد" description={`پول ورودی ماهانه در ${rangeLabel} در مقایسه با سال قبل`}>
          <LineChart
            data={merged}
            height={220}
            format={faCompact}
            series={[
              { key: 'income', label: 'امسال', color: 'green' },
              { key: 'prevIncome', label: 'سال قبل', color: 'muted' },
            ]}
          />
        </Panel>

        <Panel title="ترکیب هزینه‌ها" description="هزینهٔ مستقیم و غیرمستقیم هر ماه">
          <BarChart
            data={merged}
            height={220}
            format={faCompact}
            series={[
              { key: 'direct', label: 'هزینهٔ مستقیم', color: 'gold' },
              { key: 'indirect', label: 'هزینهٔ غیرمستقیم', color: 'danger' },
            ]}
          />
        </Panel>

        <Panel title="سود ناخالص و خالص" description="روند سود در ماه‌های بازهٔ انتخابی">
          <LineChart
            data={merged}
            height={220}
            format={faCompact}
            series={[
              { key: 'gross', label: 'سود ناخالص', color: 'accent' },
              { key: 'net', label: 'سود خالص', color: 'blue' },
            ]}
          />
        </Panel>

        <Panel title="گردش مالی ماهانه" description="پول ورودی، هزینه و سود خالص در یک نگاه">
          <BarChart
            data={merged}
            height={220}
            format={faCompact}
            series={[
              { key: 'income', label: 'پول ورودی', color: 'green' },
              { key: 'expenses', label: 'هزینه‌ها', color: 'gold' },
              { key: 'net', label: 'سود خالص', color: 'accent' },
            ]}
          />
        </Panel>
      </div>

      <div className="pl-chartgrid pl-chartgrid--split">
        <Panel title="سهم پروژه‌ها از پول ورودی" description={`تفکیک سال ${toFa(jy)}`}>
          <div className="pl-splitview">
            <Donut
              size={160}
              slices={(byProject?.rows ?? []).filter((row) => row.inflow > 0).map((row) => ({
                label: row.project.title,
                value: row.inflow,
                color: row.project.color,
              }))}
              centerLabel="پول ورودی"
              centerValue={faCompact(summary?.inflow)}
            />
            <Legend
              items={(byProject?.rows ?? []).filter((row) => row.inflow > 0).map((row) => ({
                label: row.project.title,
                value: row.inflow,
                color: row.project.color,
              }))}
            />
          </div>
        </Panel>

        <Panel title="سوددهی پروژه‌ها" description="سود ناخالص، سود خالص و حاشیهٔ سود هر پروژه">
          <table className="pl-table pl-table--slim">
            <thead>
              <tr>
                <th>پروژه</th>
                <th>پول ورودی</th>
                <th>سود ناخالص</th>
                <th>سود خالص</th>
                <th>حاشیه</th>
              </tr>
            </thead>
            <tbody>
              {(byProject?.rows ?? []).map((row) => (
                <tr key={row.project.id}>
                  <td>
                    <span className="pl-celluser">
                      <span className="pl-dot" style={{ background: `var(--pl-tone-${row.project.color})` }} />
                      {row.project.title}
                    </span>
                  </td>
                  <td>{faCompact(row.inflow)}</td>
                  <td>{faCompact(row.grossProfit)}</td>
                  <td className={row.netProfit < 0 ? 'is-danger' : ''}>{faCompact(row.netProfit)}</td>
                  <td>{faPercent(row.margin, 0)}</td>
                </tr>
              ))}
              {byProject?.unassigned?.transactions ? (
                <tr>
                  <td>بدون پروژه</td>
                  <td>{faCompact(byProject.unassigned.inflow)}</td>
                  <td>{faCompact(byProject.unassigned.grossProfit)}</td>
                  <td>{faCompact(byProject.unassigned.netProfit)}</td>
                  <td>{faPercent(byProject.unassigned.margin, 0)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* ── تفکیک حالت پرداخت ── */}
      <div className="pl-chartgrid pl-chartgrid--split">
        <Panel title="تفکیک حالت پرداخت" description="سهم بانکی و مستقیم از گردش مالی همین بازه">
          <div className="pl-splitview">
            <Donut
              size={160}
              slices={PAYMENT_MODES.map((mode) => ({
                label: mode.label,
                value: payments.total[mode.value] ?? 0,
                color: mode.value === 'bank' ? 'blue' : 'accent',
              })).filter((slice) => slice.value > 0)}
              centerLabel="گردش مالی"
              centerValue={faCompact((payments.total.bank ?? 0) + (payments.total.direct ?? 0))}
            />
            <Legend
              items={PAYMENT_MODES.map((mode) => ({
                label: `${mode.label} — دریافتی ${faCompact(payments.income[mode.value] ?? 0)} · هزینه ${faCompact(payments.expense[mode.value] ?? 0)}`,
                value: payments.total[mode.value] ?? 0,
                color: mode.value === 'bank' ? 'blue' : 'accent',
              }))}
            />
          </div>
        </Panel>

        <Panel title="ثبت دستی تراکنش" description="مسیر ورود ارقام مالی به ماژول">
          <p className="pl-hint">
            درگاه پرداخت آنلاین به پروژه وصل نیست، پس ارقام این صفحه از ثبت دستی می‌آیند.
            هر تراکنش با نوع (درآمد، هزینهٔ مستقیم، هزینهٔ غیرمستقیم)، پروژه و حالت پرداخت
            (بانکی یا مستقیم) ثبت می‌شود و همان لحظه در همهٔ شاخص‌ها اثر می‌گذارد.
          </p>
          <div className="pl-quickactions">
            <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, transaction: null, kind: 'direct-cost' })}>
              <IconReceipt width={15} height={15} />
              هزینهٔ مستقیم
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, transaction: null, kind: 'indirect-cost' })}>
              <IconReceipt width={15} height={15} />
              هزینهٔ غیرمستقیم
            </Button>
            <Button size="sm" onClick={() => setDialog({ open: true, transaction: null, kind: 'income' })}>
              <IconWallet width={15} height={15} />
              درآمد
            </Button>
          </div>
        </Panel>
      </div>

      {/* ── تراکنش‌ها ── */}
      <Panel
        title="تراکنش‌ها"
        description={`${toFa((transactions ?? []).length)} تراکنش در ${rangeLabel}`}
        actions={(
          <>
            <input
              className="pl-input pl-input--sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجوی عنوان، کد، طرف حساب…"
              aria-label="جست‌وجوی تراکنش"
            />
            <select className="pl-select pl-select--sm" value={txKind} onChange={(event) => setTxKind(event.target.value)} aria-label="نوع تراکنش">
              <option value="">همهٔ نوع‌ها</option>
              {TRANSACTION_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
            <select className="pl-select pl-select--sm" value={txPayment} onChange={(event) => setTxPayment(event.target.value)} aria-label="حالت پرداخت">
              <option value="">همهٔ پرداخت‌ها</option>
              {PAYMENT_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
            <Button size="sm" onClick={() => setDialog({ open: true, transaction: null, kind: 'direct-cost' })}>
              <IconPlus width={15} height={15} />
              تراکنش تازه
            </Button>
          </>
        )}
      >
        {txLoading && !transactions ? <LoadingBlock label="در حال خواندن تراکنش‌ها…" rows={4} /> : null}

        {transactions && transactions.length === 0 ? (
          <EmptyState
            title="تراکنشی ثبت نشده"
            description="برای این بازه و فیلترها تراکنشی وجود ندارد. با «ثبت هزینه» یا «ثبت درآمد» اولین مورد را وارد کنید."
          />
        ) : null}

        {transactions && transactions.length > 0 ? (
          <div className="pl-tablewrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>کد</th>
                  <th>عنوان</th>
                  <th>نوع</th>
                  <th>مبلغ</th>
                  <th>تاریخ</th>
                  <th>پروژه</th>
                  <th>حالت پرداخت</th>
                  <th>طرف حساب</th>
                  <th aria-label="عملیات" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id}>
                    <td><code className="pl-mono">{row.code}</code></td>
                    <td>
                      {row.title}
                      {row.note ? <span className="pl-muted pl-cellsup">{row.note}</span> : null}
                    </td>
                    <td><Pill tone={toneOf(TRANSACTION_KINDS, row.kind)}>{labelOf(TRANSACTION_KINDS, row.kind)}</Pill></td>
                    <td className={row.kind === 'income' ? 'is-positive' : 'is-danger'}>{faToman(row.amount)}</td>
                    <td>{jalaliLabel(row.date, { short: true })}</td>
                    <td>{row.project?.title ?? '—'}</td>
                    <td><Pill tone={toneOf(PAYMENT_MODES, row.payment)}>{labelOf(PAYMENT_MODES, row.payment)}</Pill></td>
                    <td>{row.party || '—'}</td>
                    <td className="pl-cellactions">
                      <IconButton label="ویرایش" onClick={() => setDialog({ open: true, transaction: row, kind: row.kind })}>
                        <IconEdit width={14} height={14} />
                      </IconButton>
                      <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(row)}>
                        <IconTrash width={14} height={14} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {years?.length ? (
        <p className="pl-muted pl-finhint">
          <IconCompare width={14} height={14} />
          سال‌های دارای داده: {years.map((year) => toFa(year)).join('، ')}
        </p>
      ) : null}

      <TransactionDialog
        open={dialog.open}
        transaction={dialog.transaction}
        defaultKind={dialog.kind}
        projects={projects ?? []}
        onClose={() => setDialog({ open: false, transaction: null, kind: '' })}
        onSaved={refreshAll}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف تراکنش مالی"
        message={pendingDelete ? `تراکنش «${pendingDelete.title}» حذف می‌شود و شاخص‌های مالی از نو محاسبه می‌شوند.` : ''}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={removeTransaction}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
