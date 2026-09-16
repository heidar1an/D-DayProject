import { useMemo } from 'react';

const headingClass =
  "text-lg md:text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]";

const tableHeadClass =
  "pb-3 text-xs font-normal text-[var(--copper-ink)] [font-family:'Doran','Vazir',Tahoma,sans-serif]";

// ساختار هر تراکنش: { id, title, amount, date, reference, status }
// status: 'paid' | 'unpaid' | 'pending'
const transactionGroups = [
  {
    id: 'paid',
    label: 'پرداخت شده',
    dotColor: '#67ba85',
    dotGlow: '0 0 12px rgba(103, 186, 133, 0.55)',
    actionLabel: 'مشاهده فاکتور',
    emptyMessage: 'هنوز تراکنش پرداخت‌شده‌ای ثبت نشده است.',
  },
  {
    id: 'unpaid',
    label: 'پرداخت نشده',
    dotColor: '#ff6969',
    dotGlow: '0 0 12px rgba(255, 105, 105, 0.55)',
    actionLabel: 'ادامه پرداخت',
    emptyMessage: 'هیچ تراکنش پرداخت‌نشده‌ای ندارید.',
  },
  {
    id: 'pending',
    label: 'در انتظار نهایی شدن',
    dotColor: '#ff9717',
    dotGlow: '0 0 12px rgba(255, 151, 23, 0.55)',
    actionLabel: 'جزئیات',
    emptyMessage: 'تراکنشی در انتظار نهایی شدن نیست.',
  },
];

const formatAmount = (amount) =>
  `${Number(amount || 0).toLocaleString('fa-IR')} تومان`;

const toPersianCount = (value) => Number(value || 0).toLocaleString('fa-IR');

function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="var(--faint)"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background)]">
        <ReceiptIcon />
      </span>
      <p className="max-w-[220px] text-sm leading-6 text-[var(--faint)]">{message}</p>
    </div>
  );
}

function TransactionsTable({ items, actionLabel }) {
  return (
    <div className="flex-1 overflow-x-auto">
      <table className="w-full border-collapse text-right text-sm">
        <thead>
          <tr>
            <th className={tableHeadClass}>عنوان</th>
            <th className={tableHeadClass}>مبلغ</th>
            <th className={tableHeadClass}>تاریخ</th>
            <th className={tableHeadClass}>شماره پیگیری</th>
            <th className={tableHeadClass} aria-label="عملیات" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-t border-white/5 transition-colors duration-200 hover:bg-white/[0.03]"
            >
              <td className="py-3 pl-3">{item.title}</td>
              <td className="whitespace-nowrap py-3">{formatAmount(item.amount)}</td>
              <td className="whitespace-nowrap py-3 text-[var(--muted)]">{item.date}</td>
              <td className="py-3 text-[var(--muted)]" dir="ltr">
                {item.reference}
              </td>
              <td className="py-3">
                <button
                  type="button"
                  className="rounded-full border border-[#b99a86]/40 px-4 py-1.5 text-xs text-[var(--copper-ink)] transition-colors duration-200 hover:bg-[var(--copper)] hover:text-white"
                >
                  {actionLabel}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Pays({ transactions = [] }) {
  const grouped = useMemo(() => {
    const map = { paid: [], unpaid: [], pending: [] };

    transactions.forEach((transaction) => {
      if (map[transaction?.status]) map[transaction.status].push(transaction);
    });

    return map;
  }, [transactions]);

  return (
    <section
      dir="rtl"
      aria-label="تراکنش ها"
      className="dash-stagger mx-auto w-[var(--content-width)] py-8 text-white md:py-10 [font-family:'Pinar','Vazir',Tahoma,sans-serif]"
    >
      <div className="grid gap-5 md:grid-cols-3 md:gap-6">
        {transactionGroups.map((group) => {
          const items = grouped[group.id] ?? [];

          return (
            <article
              key={group.id}
              className="flex min-h-[300px] flex-col rounded-[2.5rem] bg-[var(--surface-soft)] p-6 md:p-8"
            >
              <header className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: group.dotColor, boxShadow: group.dotGlow }}
                  aria-hidden="true"
                />
                <h3 className={`flex-1 ${headingClass}`}>{group.label}</h3>
                <span className="whitespace-nowrap rounded-full bg-[var(--background)] px-3 py-1 text-xs text-[var(--faint)]">
                  {toPersianCount(items.length)} تراکنش
                </span>
              </header>

              <div className="mt-6 flex flex-1 flex-col">
                {items.length > 0 ? (
                  <TransactionsTable items={items} actionLabel={group.actionLabel} />
                ) : (
                  <EmptyState message={group.emptyMessage} />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
