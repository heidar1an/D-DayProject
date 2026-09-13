/*
 * «اشتباهات من» — یادگیری مبتنی بر خطا.
 * سؤال‌های غلط کاربر به تفکیک موضوع ضعیف نمایش داده می‌شود و مرور فقط روی همین‌ها انجام می‌شود.
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchMistakes } from '../../../services/international/internationalService';
import {
  DifficultyBadge,
  EmptyState,
  faNum,
  Icon,
  Skeleton,
  toFa,
} from './intlShared';

export default function MistakesView({ userData, onStartReview }) {
  const [data, setData] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchMistakes(userData?.id).then((payload) => alive && setData(payload));
    return () => {
      alive = false;
    };
  }, [userData?.id]);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    if (!activeTopic) return data.items;
    return data.items.filter((entry) => entry.question.subjectId === activeTopic);
  }, [data, activeTopic]);

  if (!data) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-28 rounded-[2rem]" />
        <Skeleton className="h-64 rounded-[2rem]" />
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon="check"
        title="اشتباهی در کار نیست!"
        note="یا هنوز آزمونی ندادی، یا همه را درست جواب دادی. هر وقت غلطی بخوری، اینجا جمعش می‌کنیم تا دوباره تمرینش کنی."
      />
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg [font-family:'Doran',Tahoma,sans-serif]">اشتباهات من</h2>
          <p className="mt-1 text-xs text-[#8a8a8a]">
            {faNum(data.items.length)} سؤال غلط — قوی‌ترین منبع یادگیری، اشتباه خودت است.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onStartReview(visibleItems.map((entry) => entry.question.id))}
          className="cursor-pointer rounded-xl bg-[#e26d6d]/15 px-5 py-2.5 text-sm font-bold text-[#ef9196] transition-transform hover:-translate-y-0.5"
        >
          مرور اشتباهات ({toFa(visibleItems.length)} سؤال)
        </button>
      </header>

      {/* موضوعات ضعیف */}
      {data.weakTopics.length > 0 && (
        <section className="rounded-[2rem] border border-white/8 bg-[#282828] p-5" aria-label="موضوعات ضعیف">
          <h3 className="flex items-center gap-2 text-sm [font-family:'Doran',Tahoma,sans-serif]">
            <Icon name="chart" className="h-4 w-4 text-[#ef9196]" />
            موضوعات ضعیف تو
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.weakTopics.map((topic) => (
              <button
                key={topic.subjectId}
                type="button"
                onClick={() => setActiveTopic((prev) => (prev === topic.subjectId ? null : topic.subjectId))}
                aria-pressed={activeTopic === topic.subjectId}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-right transition-colors ${
                  activeTopic === topic.subjectId
                    ? 'border-[#e26d6d]/50 bg-[#e26d6d]/10'
                    : 'border-white/6 bg-[#2a2a2a] hover:border-white/20'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${topic.subject?.accent ?? '#937fcd'}18`, color: topic.subject?.accent ?? '#937fcd' }}
                  >
                    <Icon name="book" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[13px]">{topic.subject?.nameFa ?? topic.subjectId}</strong>
                    <span className="text-[10px] text-[#8a8a8a]">
                      {topic.subject?.name} · {toFa(topic.count)} اشتباه
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-lg font-bold text-[#ef9196] [font-family:'Doran',Tahoma,sans-serif]">
                  {toFa(topic.count)}
                </span>
              </button>
            ))}
          </div>
          {activeTopic && (
            <button
              type="button"
              onClick={() => setActiveTopic(null)}
              className="mt-3 cursor-pointer text-xs text-[#937fcd] transition-colors hover:text-[#c9bdf0]"
            >
              حذف فیلتر موضوع
            </button>
          )}
        </section>
      )}

      {/* سؤال‌های غلط */}
      <section aria-label="سؤال‌های غلط">
        <ul className="space-y-2.5">
          {visibleItems.map(({ question, state, repeated }) => (
            <li key={question.id} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-[#2a2a2a] px-4 py-3.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ background: 'rgba(226,109,109,0.12)', color: '#ef9196' }}
              >
                <Icon name={repeated ? 'flame' : 'x'} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13.5px] leading-6 text-[#e6e6e6]" dir="ltr">
                  {question.stem}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <DifficultyBadge difficulty={question.difficulty} />
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#9a9a9a]">{question.topic.fa}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#9a9a9a]">
                    {state.attempts > 1 ? `${toFa(state.attempts)} بار حل‌شده` : 'یک بار غلط'}
                  </span>
                  {repeated && (
                    <span className="rounded-full bg-[#e26d6d]/12 px-2 py-0.5 text-[10px] text-[#ef9196]">
                      اشتباه تکراری — اولویت مرور
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
