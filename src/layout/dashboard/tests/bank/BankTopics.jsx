/*
 * BankTopics — نمای «تست مبحثی»: درس ← مبحث ← زیرمبحث ← تعداد تست.
 * شمارش نتایج همیشه از سرویس می‌آید (searchQuestions) تا UI به دادهٔ خام وابسته نماند.
 * دامنهٔ فعال (نوع بانک/رشته) روی شمارش و شروع سشن اعمال می‌شود تا عدد نمایش‌داده‌شده
 * دقیقاً همان چیزی باشد که کاربر می‌گیرد.
 */
import { useEffect, useMemo, useState } from 'react';
import { scopeToFilters, searchQuestions, SUBJECTS, TOPIC_TREE } from '../../../../services/testBank/testBankService';
import { Icon, Skeleton, toFa } from './bankShared';

const COUNT_OPTIONS = [5, 10, 20, null]; // null = همه

export default function BankTopics({ userId, scope, initialSubjectId = null, onStartPractice }) {
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? 'physiology');
  const [topic, setTopic] = useState(null);
  const [subtopic, setSubtopic] = useState(null);
  const [count, setCount] = useState(10);
  const [pool, setPool] = useState(null); // تعداد سؤال‌های منطبق

  const subjects = useMemo(() => SUBJECTS.filter((subject) => TOPIC_TREE[subject.id]), []);
  const tree = useMemo(() => TOPIC_TREE[subjectId] ?? [], [subjectId]);

  /* تغییر درس → پاک‌کردن مبحث‌ها */
  useEffect(() => {
    setTopic(null);
    setSubtopic(null);
  }, [subjectId]);

  useEffect(() => {
    setSubtopic(null);
  }, [topic]);

  /* شمارش مخزن فعلی از سرویس — داخل دامنهٔ فعال */
  useEffect(() => {
    let alive = true;
    setPool(null);
    searchQuestions(
      userId,
      {
        ...scopeToFilters(scope),
        subjectIds: [subjectId],
        topicPaths: topic ? (subtopic ? [topic, subtopic] : [topic]) : [],
      },
      { page: 1, pageSize: 1 },
    )
      .then((result) => alive && setPool(result.total))
      .catch(() => alive && setPool(0));
    return () => {
      alive = false;
    };
  }, [userId, scope, subjectId, topic, subtopic]);

  const subject = subjects.find((item) => item.id === subjectId);

  const start = (shuffle) => {
    if (!pool) return;
    onStartPractice({
      subjectName: subject?.name ?? '',
      subjectId,
      topic,
      subtopic,
      count: count === null ? pool : Math.min(count, pool),
      shuffle,
    });
  };

  const canStart = pool !== null && pool > 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">تست مبحثی</h2>
        <p className="mt-1.5 text-sm text-[var(--faint)]">درس را انتخاب کن، بعد مبحث و در صورت تمایل زیرمبحث را مشخص کن.</p>
      </div>

      {/* مرحله ۱ — درس */}
      <section aria-label="انتخاب درس">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#61D192]/15 text-[11px] text-[var(--green-ink)]">۱</span>
          درس
        </h3>
        <div className="flex flex-wrap gap-2">
          {subjects.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubjectId(item.id)}
              aria-pressed={subjectId === item.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] transition-colors ${
                subjectId === item.id ? 'border-transparent text-white' : 'border-white/10 bg-white/[0.03] text-[var(--muted)] hover:border-white/25'
              }`}
              style={subjectId === item.id ? { background: `${item.accent}26`, borderColor: `${item.accent}80` } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: item.accent }} aria-hidden="true" />
              {item.name}
            </button>
          ))}
        </div>
      </section>

      {/* مرحله ۲ — مبحث */}
      {tree.length > 0 && (
        <section className="mt-6" aria-label="انتخاب مبحث">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#61D192]/15 text-[11px] text-[var(--green-ink)]">۲</span>
            مبحث
            <span className="text-[11px] font-normal text-[var(--faint)]">(اختیاری — بدون انتخاب از کل درس سؤال می‌آید)</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {tree.map((node) => (
              <button
                key={node.name}
                type="button"
                onClick={() => setTopic(topic === node.name ? null : node.name)}
                aria-pressed={topic === node.name}
                className={`cursor-pointer rounded-full border px-4 py-2 text-[13px] transition-colors ${
                  topic === node.name
                    ? 'border-[#937fcd]/70 bg-[#937fcd]/15 text-[var(--purple-soft-ink)]'
                    : 'border-white/10 bg-white/[0.03] text-[var(--muted)] hover:border-white/25'
                }`}
              >
                {node.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* مرحله ۳ — زیرمبحث */}
      {topic && (tree.find((node) => node.name === topic)?.children.length ?? 0) > 0 && (
        <section className="mt-6" aria-label="انتخاب زیرمبحث">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#61D192]/15 text-[11px] text-[var(--green-ink)]">۳</span>
            زیرمبحث
          </h3>
          <div className="flex flex-wrap gap-2">
            {(tree.find((node) => node.name === topic)?.children ?? []).map((child) => (
              <button
                key={child}
                type="button"
                onClick={() => setSubtopic(subtopic === child ? null : child)}
                aria-pressed={subtopic === child}
                className={`cursor-pointer rounded-full border px-4 py-2 text-[13px] transition-colors ${
                  subtopic === child
                    ? 'border-[#937fcd]/70 bg-[#937fcd]/15 text-[var(--purple-soft-ink)]'
                    : 'border-white/10 bg-white/[0.03] text-[var(--muted)] hover:border-white/25'
                }`}
              >
                {child}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* مرحله ۴ — تعداد و شروع */}
      <section className="mt-8 rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5" aria-label="تعداد سؤال و شروع">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--faint)]">تعداد تست:</span>
            {COUNT_OPTIONS.map((option) => {
              const label = option === null ? 'همه' : toFa(option);
              const disabled = option !== null && pool !== null && option > pool;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => setCount(option)}
                  aria-pressed={count === option}
                  className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm transition-colors disabled:cursor-default disabled:opacity-35 ${
                    count === option ? 'bg-[var(--green-vivid)] font-bold text-[#12271a]' : 'bg-white/6 text-[var(--muted)] hover:bg-white/12'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--faint)]">
            <Icon name="layers" className="h-4 w-4 shrink-0 text-[var(--green-ink)]" />
            مخزن فعلی:{' '}
            {pool === null ? <Skeleton className="inline-block h-4 w-10 align-middle" /> : `${toFa(pool)} سؤال`}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!canStart}
            onClick={() => start(false)}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--green-vivid)] py-3.5 text-sm font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[var(--green-vivid)] disabled:cursor-default disabled:translate-y-0 disabled:opacity-40"
          >
            <Icon name="play" className="h-4 w-4" />
            شروع تمرین (بازخورد فوری)
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={() => start(true)}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 py-3.5 text-sm font-bold transition-colors hover:bg-white/12 disabled:cursor-default disabled:opacity-40"
          >
            <Icon name="shuffle" className="h-4 w-4 text-[var(--purple-ink)]" />
            تست تصادفی از این مبحث
          </button>
        </div>

        {pool === 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#e0b45c]/10 px-4 py-2.5 text-xs text-[var(--gold-ink)]" role="alert">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            برای این ترکیب فعلاً سؤالی در بانک نیست؛ ترکیب دیگری امتحان کن.
          </p>
        )}
      </section>
    </div>
  );
}
