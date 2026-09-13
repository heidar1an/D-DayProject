/*
 * BlueprintCard — نمای دقیق آزمونی که قرار است ساخته شود. همهٔ اعداد از plan واقعی
 * موتور انتخاب می‌آید (نه تخمین): تفکیک درس، سطح سختی، وضعیت تست‌ها + هشدارهای
 * ساخت‌یافتهٔ موتور («فقط ۷ تست اشتباه در دسترس است» و…).
 */
import { DIFFICULTY_LABELS, Icon, STATUS_LABELS, faNum, toFa, warningText } from './builderShared';

const LEVEL_ACCENTS = { easy: '#77b787', medium: '#e0b45c', hard: '#ef9196', very_hard: '#e26d6d' };

function BlueprintRow({ label, value, total, accent = '#61D192', dot = true }) {
  return (
    <li className="flex items-center gap-2.5">
      {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#ccc]">{label}</span>
      <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/8 sm:block">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${total ? Math.max((value / total) * 100, 3) : 0}%`, background: accent }}
        />
      </div>
      <strong className="w-9 shrink-0 text-left text-[13px] [font-family:'Doran',Tahoma,sans-serif]" style={{ color: accent }}>
        {faNum(value)}
      </strong>
    </li>
  );
}

export default function BlueprintCard({ plan, subjects, config }) {
  const { breakdown, target, warnings, poolSize, suggestedDuration } = plan ?? {};
  const subjectName = (subjectId) => subjects?.find((subject) => subject.id === subjectId)?.name ?? subjectId;
  const subjectAccent = (subjectId) => subjects?.find((subject) => subject.id === subjectId)?.accent ?? '#9aa5b1';

  const subjectEntries = Object.entries(breakdown?.bySubject ?? {}).sort((a, b) => b[1] - a[1]);
  const statusEntries = [
    ['unsolved', breakdown?.byStatus?.unsolved ?? 0],
    ['wrong', breakdown?.byStatus?.wrong ?? 0],
    ['correct', breakdown?.byStatus?.correct ?? 0],
  ];
  const bookmarked = breakdown?.byStatus?.bookmarked ?? 0;
  const review = breakdown?.byStatus?.review ?? 0;

  return (
    <div className="space-y-4">
      {/* هشدارها — هرگز Silent Failure نداریم */}
      {warnings?.length > 0 && (
        <ul className="space-y-2" role="alert">
          {warnings.map((warning, index) => (
            <li key={index} className="flex items-start gap-2.5 rounded-2xl border border-[#e0b45c]/30 bg-[#e0b45c]/[0.07] px-4 py-3 text-[12.5px] leading-6 text-[#e0b45c]">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              {warningText(warning, subjectName(warning.subjectId))}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-[2rem] border border-white/8 bg-[#242426] p-5 md:p-6" aria-label="Blueprint آزمون">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
          <h3 className="flex items-center gap-2 text-sm font-bold [font-family:'Doran',Tahoma,sans-serif]">
            <Icon name="grid" className="h-4.5 w-4.5 text-[#937fcd]" />
            Blueprint آزمون
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="tb-badge" style={{ background: 'rgba(97,209,146,0.1)', color: '#61D192' }}>
              {faNum(target)} سؤال
            </span>
            <span className="tb-badge tb-badge--plain">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {config?.durationMode === 'custom' && config.durationMinutes
                ? `${toFa(config.durationMinutes)} دقیقه`
                : config?.durationMode === 'none'
                  ? 'بدون محدودیت'
                  : suggestedDuration
                    ? `پیشنهادی ${toFa(suggestedDuration)} دقیقه`
                    : '—'}
            </span>
            {poolSize > 0 && <span className="tb-badge tb-badge--plain">مخزن: {faNum(poolSize)} تست</span>}
          </div>
        </header>

        {target === 0 ? (
          <p className="py-8 text-center text-sm text-[#e26d6d]">
            آزمونی برای ساختن نیست — اول با تغییر درس/مبحث یا فیلترها مخزن را باز کن.
          </p>
        ) : (
          <div className="grid gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* درس‌ها */}
            {subjectEntries.length > 0 && (
              <div>
                <h4 className="mb-3 text-[11px] font-bold text-[#8a8a8a]">تفکیک درس‌ها</h4>
                <ul className="space-y-2.5">
                  {subjectEntries.map(([subjectId, count]) => (
                    <BlueprintRow key={subjectId} label={subjectName(subjectId)} value={count} total={target} accent={subjectAccent(subjectId)} />
                  ))}
                </ul>
              </div>
            )}

            {/* سطح سختی */}
            <div>
              <h4 className="mb-3 text-[11px] font-bold text-[#8a8a8a]">سطح سختی</h4>
              <ul className="space-y-2.5">
                {Object.entries(breakdown?.byDifficulty ?? {})
                  .filter(([, count]) => count > 0)
                  .map(([level, count]) => (
                    <BlueprintRow key={level} label={DIFFICULTY_LABELS[level] ?? level} value={count} total={target} accent={LEVEL_ACCENTS[level]} dot={false} />
                  ))}
              </ul>
            </div>

            {/* وضعیت تست‌ها */}
            <div>
              <h4 className="mb-3 text-[11px] font-bold text-[#8a8a8a]">وضعیت تست‌ها برای تو</h4>
              <ul className="space-y-2.5">
                {statusEntries
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <BlueprintRow
                      key={status}
                      label={STATUS_LABELS[status]}
                      value={count}
                      total={target}
                      accent={status === 'unsolved' ? '#5b8cc7' : status === 'wrong' ? '#e26d6d' : '#61D192'}
                      dot={false}
                    />
                  ))}
                {(bookmarked > 0 || review > 0) && (
                  <li className="flex gap-3 pt-1 text-[10.5px] text-[#777]">
                    {bookmarked > 0 && <span>{faNum(bookmarked)} نشان‌شده</span>}
                    {review > 0 && <span>{faNum(review)} نیاز به مرور</span>}
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
