/*
 * SavedExamsView — «آزمون‌های من»: آزمون‌های ذخیره‌شده با تعداد سؤال، مباحث،
 * وضعیت، روند تلاش‌ها و اکشن‌ها. هر آزمون چند Attempt دارد؛ روند پیشرفت از
 * نتیجهٔ واقعی سشن‌های بانک تست می‌آید.
 */
import { useState } from 'react';
import { deleteExam, fetchSavedExams } from '../../../../services/examBuilder/examBuilderService';
import { useAsyncData } from '../../league/useAsyncData';
import { EmptyState, Icon, Modal, Skeleton, formatAgo, faNum, toFa } from '../bank/bankShared';

function TrendBars({ trend }) {
  if (!trend?.length) return null;
  return (
    <div className="ex-trend" role="img" aria-label={`روند ${toFa(trend.length)} تلاش`}>
      {trend.slice(-6).map((point, index) => (
        <span
          key={index}
          className={`ex-trend__bar ${index === 0 && trend.length > 1 ? 'is-first' : ''}`}
          style={{ height: `${Math.max(point.percentage, 4)}%` }}
          title={`${toFa(point.percentage)}٪`}
        />
      ))}
    </div>
  );
}

function ExamRow({ exam, onAttempt, onOpenResult, onRegenerate, onDelete }) {
  const last = exam.lastAttempt;
  const lastAccent = last ? (last.percentage >= 60 ? '#61D192' : '#ef9196') : '#8a8a8a';

  return (
    <li className="rounded-[1.75rem] border border-white/8 bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14.5px] font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{exam.title}</h3>
            <span className="rounded-full bg-white/6 px-2.5 py-0.5 text-[10px] text-[var(--muted)]">
              {exam.attemptCount ? `${toFa(exam.attemptCount)} تلاش` : 'شروع‌نشده'}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--faint)]">
            {faNum(exam.questionCount)} سؤال
            {exam.durationMinutes ? ` · ${toFa(exam.durationMinutes)} دقیقه` : ' · بدون محدودیت'}
            {exam.topics.length ? ` · ${exam.topics.join('، ')}${exam.topicCount > 4 ? '…' : ''}` : ''}
            {' · '}
            {formatAgo(exam.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {exam.trend.length > 0 && <TrendBars trend={exam.trend} />}
          {last && (
            <div className="text-center">
              <strong className="block text-xl [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: lastAccent }}>
                {toFa(last.percentage)}٪
              </strong>
              <span className="text-[10px] text-[var(--faint)]">آخرین تلاش</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
        <button
          type="button"
          onClick={() => onAttempt(exam)}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--green-vivid)] px-4 py-2.5 text-xs font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[var(--green-vivid)]"
        >
          <Icon name="play" className="h-3.5 w-3.5" />
          {exam.attemptCount ? 'تلاش دوباره' : 'شروع آزمون'}
        </button>
        {last && (
          <button
            type="button"
            onClick={() => onOpenResult(last.sessionId)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/6 px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/12"
          >
            <Icon name="eye" className="h-3.5 w-3.5" />
            کارنامهٔ آخر
          </button>
        )}
        <button
          type="button"
          onClick={() => onRegenerate(exam)}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/6 px-4 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/12"
          title="همین تنظیمات با سؤال‌های تازه"
        >
          <Icon name="dice" className="h-3.5 w-3.5" />
          تولید با سؤال‌های جدید
        </button>
        <button
          type="button"
          onClick={() => onDelete(exam)}
          aria-label={`حذف ${exam.title}`}
          className="ms-auto cursor-pointer rounded-xl bg-white/6 p-2.5 text-[var(--faint)] transition-colors hover:bg-[#e26d6d]/15 hover:text-[var(--red-ink)]"
        >
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export default function SavedExamsView({ userId, onAttempt, onOpenResult, onRegenerate, onBackToBuilder }) {
  const { data, loading, retry } = useAsyncData(() => fetchSavedExams(userId), [userId]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteExam(userId, pendingDelete.id);
      setPendingDelete(null);
      retry();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-24 rounded-[2rem]" />
        <Skeleton className="h-24 rounded-[2rem]" />
        <Skeleton className="h-24 rounded-[2rem]" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon="card"
        title="هنوز آزمونی ذخیره نکرده‌ای"
        note="از آزمون‌ساز شخصی یک آزمون بساز و «ذخیره برای بعد» بزن؛ اینجا با روند پیشرفتت می‌ماند."
        action={
          <button
            type="button"
            onClick={onBackToBuilder}
            className="mt-3 cursor-pointer rounded-xl bg-[var(--green-vivid)] px-5 py-2.5 text-sm font-bold text-[#12271a] transition-transform hover:-translate-y-0.5"
          >
            ساختن اولین آزمون
          </button>
        }
      />
    );
  }

  return (
    <div className="ex-enter space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <Icon name="card" className="h-5 w-5 text-[var(--purple-ink)]" />
          آزمون‌های من
          <span className="rounded-full bg-white/6 px-2.5 py-0.5 text-xs text-[var(--muted)]">{toFa(data.length)}</span>
        </h2>
        <button
          type="button"
          onClick={onBackToBuilder}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--green-vivid)] px-4 py-2.5 text-xs font-bold text-[#12271a] transition-all hover:-translate-y-0.5"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          آزمون جدید
        </button>
      </header>

      <ul className="space-y-3">
        {data.map((exam) => (
          <ExamRow
            key={exam.id}
            exam={exam}
            onAttempt={onAttempt}
            onOpenResult={onOpenResult}
            onRegenerate={onRegenerate}
            onDelete={setPendingDelete}
          />
        ))}
      </ul>

      <Modal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="حذف آزمون" width="min(24rem, 100%)">
        <h3 className="flex items-center gap-2 text-base [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <Icon name="trash" className="h-5 w-5 text-[var(--red-ink)]" />
          این آزمون حذف شود؟
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--faint)]">
          «{pendingDelete?.title}» و تاریخچهٔ {toFa(pendingDelete?.attemptCount ?? 0)} تلاشش حذف می‌شود؛ کارنامه‌های سشن‌ها در تاریخچهٔ بانک می‌مانند.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="flex-1 cursor-pointer rounded-xl bg-[var(--red)] px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {deleting ? 'در حال حذف…' : 'حذف کن'}
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(null)}
            className="cursor-pointer rounded-xl bg-white/8 px-4 py-2.5 text-sm transition-colors hover:bg-white/12"
          >
            انصراف
          </button>
        </div>
      </Modal>
    </div>
  );
}
