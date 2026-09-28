/*
 * پنجرهٔ ثبت و ویرایش تراکنش مالی.
 *
 * ثبت دستی، مسیر رسمی ورود ارقام مالی به ماژول است: تا وقتی درگاه پرداخت
 * آنلاین به پروژه وصل نشده، همهٔ دریافت‌ها و هزینه‌ها از همین فرم وارد
 * می‌شوند. حالت پرداخت عمداً فقط دو گزینه دارد — «بانکی» و «مستقیم» — چون
 * درگاه آنلاین هنوز وجود ندارد و گزینهٔ سومی برای گزارش معنادار نیست.
 *
 * مبلغ همیشه به تومان و به‌صورت عدد صحیح ذخیره می‌شود؛ ارقام با جداکنندهٔ
 * فارسی فقط در نمایش می‌آیند، نه در داده.
 */

import { useEffect, useMemo, useState } from 'react';

import { Button, ConfirmDialog, Field, Input, Modal, Select, Textarea, useToast } from '../../../adminShared';
import { IconBank, IconHandCoins, IconWallet } from '../../../adminIcons';
import {
  DEFAULT_PAYMENT_MODE, PAYMENT_MODES, TRANSACTION_KINDS, labelOf,
} from '../../../../../services/planning/planningTypes';
import { planning } from '../../../../../services/planning/planningService';
import { faToman, isoDate } from '../../../../../services/planning/jalali';
import JalaliDatePicker from '../calendar/JalaliDatePicker';

const EMPTY = {
  title: '',
  kind: 'direct-cost',
  amount: '',
  date: '',
  projectId: '',
  payment: DEFAULT_PAYMENT_MODE,
  party: '',
  reference: '',
  note: '',
};

/* آیکون هر حالت پرداخت — برای اینکه تفاوت دو گزینه در یک نگاه دیده شود */
const PAYMENT_ICON = { bank: IconBank, direct: IconHandCoins };

export default function TransactionDialog({
  open, transaction, projects = [], defaultKind = '', onClose, onSaved,
}) {
  const notify = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setForm({ ...EMPTY, ...transaction, amount: String(transaction.amount ?? '') });
    } else {
      setForm({
        ...EMPTY,
        kind: defaultKind || 'direct-cost',
        date: isoDate(new Date()),
      });
    }
    setErrors({});
  }, [open, transaction, defaultKind]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const amountNumber = Number(form.amount);
  const amountHint = useMemo(
    () => (Number.isFinite(amountNumber) && amountNumber > 0 ? faToman(amountNumber) : 'مبلغ را به تومان وارد کنید'),
    [amountNumber],
  );

  const isIncome = form.kind === 'income';

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        projectId: form.projectId || null,
      };
      const saved = transaction
        ? await planning.finance.update(transaction.id, payload)
        : await planning.finance.create(payload);

      notify(transaction ? 'تراکنش به‌روزرسانی شد' : 'تراکنش ثبت شد');
      onSaved?.(saved);
      onClose?.();
    } catch (error) {
      setErrors(error.fields ?? {});
      notify(error.message ?? 'ذخیرهٔ تراکنش ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await planning.finance.remove(transaction.id);
      notify('تراکنش حذف شد');
      setConfirmDelete(false);
      onSaved?.(null);
      onClose?.();
    } catch (error) {
      notify(error.message ?? 'حذف ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        size="lg"
        title={transaction ? 'ویرایش تراکنش مالی' : 'ثبت تراکنش مالی'}
        subtitle={isIncome
          ? 'مبلغ دریافتی در «پول ورودی» همین بازه جمع می‌شود'
          : 'مبلغ هزینه در سود ناخالص و خالص همین بازه اثر می‌گذارد'}
        onClose={busy ? undefined : onClose}
        footer={(
          <>
            {transaction ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
                حذف
              </Button>
            ) : null}
            <span className="pl-spacer" />
            <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
            <Button onClick={submit} loading={busy}>
              <IconWallet width={15} height={15} />
              {transaction ? 'ذخیرهٔ تغییرات' : 'ثبت تراکنش'}
            </Button>
          </>
        )}
      >
        <div className="pl-form">
          <Field label="عنوان تراکنش" required error={errors.title}>
            <Input
              value={form.title}
              onChange={(event) => set({ title: event.target.value })}
              placeholder="مثلاً خرید فضای ابرابی یا شهریهٔ دورهٔ بین‌الملل"
            />
          </Field>

          <div className="pl-form__row">
            <Field label="نوع تراکنش" required error={errors.kind}>
              <Select
                value={form.kind}
                onChange={(event) => set({ kind: event.target.value })}
                options={TRANSACTION_KINDS.map((kind) => ({ value: kind.value, label: kind.label }))}
              />
            </Field>

            <Field label="مبلغ (تومان)" required error={errors.amount} hint={amountHint}>
              <Input
                type="number"
                min="1"
                step="1000"
                inputMode="numeric"
                value={form.amount}
                onChange={(event) => set({ amount: event.target.value })}
                placeholder="مثلاً 2500000"
              />
            </Field>

            <Field label="تاریخ" required error={errors.date}>
              <JalaliDatePicker value={form.date} onChange={(iso) => set({ date: iso })} allowClear={false} />
            </Field>
          </div>

          {/* ── حالت پرداخت: فقط بانکی و مستقیم ── */}
          <Field label="حالت پرداخت" required error={errors.payment} hint="درگاه پرداخت آنلاین هنوز متصل نیست؛ تسویه فقط بانکی یا مستقیم انجام می‌شود">
            <div className="pl-paymodes">
              {PAYMENT_MODES.map((mode) => {
                const Icon = PAYMENT_ICON[mode.value] ?? IconWallet;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    className={`pl-paymode ${form.payment === mode.value ? 'is-on' : ''}`}
                    onClick={() => set({ payment: mode.value })}
                    aria-pressed={form.payment === mode.value}
                  >
                    <Icon width={17} height={17} />
                    <span>
                      <b>{mode.label}</b>
                      <small>{mode.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="pl-form__row">
            <Field label="پروژه / بخش" hint="با انتخاب پروژه، واحد سازمانی گزارش هم مشخص می‌شود">
              <Select
                value={form.projectId}
                onChange={(event) => set({ projectId: event.target.value })}
                options={[
                  { value: '', label: 'بدون پروژه' },
                  ...projects.map((project) => ({ value: project.id, label: project.title })),
                ]}
              />
            </Field>

            <Field label="طرف حساب">
              <Input
                value={form.party}
                onChange={(event) => set({ party: event.target.value })}
                placeholder={isIncome ? 'نام پرداخت‌کننده' : 'نام دریافت‌کننده'}
              />
            </Field>

            <Field label="شمارهٔ پیگیری / سند">
              <Input
                value={form.reference}
                onChange={(event) => set({ reference: event.target.value })}
                placeholder="شمارهٔ فیش یا حواله"
              />
            </Field>
          </div>

          <Field label="توضیحات">
            <Textarea
              rows={3}
              value={form.note}
              onChange={(event) => set({ note: event.target.value })}
              placeholder="بابت چه چیزی، برای کدام بازه یا کدام قرارداد…"
            />
          </Field>

          {!isIncome ? (
            <p className="pl-hint">
              «{labelOf(TRANSACTION_KINDS, form.kind)}» در محاسبهٔ
              <b> سود ناخالص </b>
              {form.kind === 'direct-cost' ? 'و' : ''}
              <b> سود خالص </b>
              کسر می‌شود.
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف تراکنش مالی"
        message={`تراکنش «${form.title}» از دفتر مالی حذف می‌شود و همهٔ شاخص‌ها از نو محاسبه می‌شوند. این کار برگشت‌پذیر نیست.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
