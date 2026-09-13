/*
 * BankHistory — تاریخچهٔ کامل سشن‌ها + دسترسی به نشان‌شده‌ها و «نیاز به مرور».
 */
import { useEffect, useState } from 'react';
import { fetchHistory } from '../../../../services/testBank/testBankService';
import { EmptyState, Icon, Skeleton, faNum, formatAgo, toFa } from './bankShared';

const MODE_LABEL = { practice: 'تمرین', exam: 'آزمون', review: 'مرور' };

export default function BankHistory({ userId, onNavigate, onOpenResult }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchHistory(userId)
      .then((payload) => alive && setData(payload))
      .catch(() => alive && setData({ items: [], bookmarks: [], review: [] }));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-[1.5rem]" />
        ))}
      </div>
    );
  }

  const listSection = (title, icon, rows, onOpen) => (
    <section className="mt-6" aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold [font-family:'Doran',Tahoma,sans-serif]">
        <Icon name={icon} className="h-4 w-4 text-[#61D192]" />
        {title}
        <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-[#aaa]">{toFa(rows.length)}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-xs text-[#777]">
          فعلاً خالی است.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((question) => (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onOpen(question.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#242426] px-4 py-3.5 text-right transition-colors hover:border-white/16"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-[#ddd]">{question.stem}</span>
                  <span className="text-[11px] text-[#777]">{question.topicPath.join(' › ')}</span>
                </span>
                <Icon name="chevron" className="h-4 w-4 shrink-0 -rotate-90 text-[#666]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold [font-family:'Doran',Tahoma,sans-serif]">تاریخچهٔ تست‌زدن</h2>

      {data.items.length === 0 ? (
        <EmptyState
          icon="history"
          title="هنوز کارنامه‌ای ثبت نشده"
          note="بعد از اولین تمرین یا آزمون، همه‌چیز اینجا جمع می‌شود."
          action={
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="mt-3 cursor-pointer rounded-xl bg-[#61D192] px-5 py-2.5 text-sm font-bold text-[#12271a]"
            >
              شروع تمرین
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-white/6 overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#242426]">
          {data.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenResult(item.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-right transition-colors hover:bg-white/[0.03]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      item.mode === 'exam' ? 'bg-[#937fcd]/15 text-[#c9bdf0]' : 'bg-[#61D192]/12 text-[#61D192]'
                    }`}
                  >
                    <Icon name={item.mode === 'exam' ? 'timer' : 'book'} className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[13.5px] [font-family:'Doran',Tahoma,sans-serif]">{item.title}</strong>
                    <span className="text-[11px] text-[#8a8a8a]">
                      {MODE_LABEL[item.mode] ?? item.mode} · {faNum(item.correct)} صحیح از {faNum(item.total)} · {formatAgo(item.submittedAt)}
                    </span>
                  </span>
                </span>
                {item.percentage !== null && (
                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold [font-family:'Doran',Tahoma,sans-serif] ${
                      item.percentage >= 60 ? 'bg-[#61D192]/12 text-[#61D192]' : 'bg-[#e26d6d]/12 text-[#ef9196]'
                    }`}
                  >
                    {toFa(item.percentage)}٪
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {listSection('نشان‌شده‌ها', 'heart', data.bookmarks, (questionId) => onNavigate('browse', { filters: { status: 'bookmarked' } }))}
      {listSection('نیاز به مرور', 'refresh', data.review, (questionId) => onNavigate('browse', { filters: { status: 'review' } }))}
    </div>
  );
}
