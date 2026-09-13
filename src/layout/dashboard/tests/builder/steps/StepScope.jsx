/*
 * Step 2 — انتخاب درس‌ها و مباحث. آمار هر درس (موجودی/حل‌شده/دقت) از کاتالوگ واقعی
 * می‌آید؛ «مباحث مرتبط را نیز اضافه کن» از دادهٔ واقعی بانک/درخت پیشنهاد می‌دهد
 * (قرارداد Knowledge Graph آینده) — نه لیست هاردکد.
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchRelatedTopics } from '../../../../../services/examBuilder/examBuilderService';
import TopicTree from '../TopicTree';
import { Icon, SectionCard, toFa } from '../builderShared';

function SubjectCard({ subject, selected, onToggle }) {
  const disabled = subject.questionCount === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(subject.id)}
      aria-pressed={selected}
      className={`group flex cursor-pointer flex-col gap-2.5 rounded-[1.4rem] border p-4 text-right transition-all ${
        disabled
          ? 'cursor-default border-white/6 opacity-40'
          : selected
            ? 'border-[#61D192]/60 bg-[#61D192]/[0.07] hover:-translate-y-0.5'
            : 'border-white/8 bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/20'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject.accent }} aria-hidden="true" />
          <strong className="truncate text-[13.5px] [font-family:'Doran',Tahoma,sans-serif]">{subject.name}</strong>
        </span>
        {selected && (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#61D192] text-[#12271a]">
            <Icon name="check" className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-full bg-white/6 px-2 py-0.5 text-[#bbb]">{toFa(subject.questionCount)} تست</span>
        {subject.solvedCount > 0 && <span className="rounded-full bg-white/6 px-2 py-0.5 text-[#bbb]">{toFa(subject.solvedCount)} حل‌شده</span>}
        {subject.accuracy !== null && (
          <span className="rounded-full px-2 py-0.5" style={{ background: 'rgba(97,209,146,0.1)', color: subject.accuracy >= 60 ? '#61D192' : '#ef9196' }}>
            دقت {toFa(subject.accuracy)}٪
          </span>
        )}
      </span>
    </button>
  );
}

export default function StepScope({ draft, update, catalog }) {
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [related, setRelated] = useState(null); // topic → {related, loading}
  const [loadingRelated, setLoadingRelated] = useState(false);

  const toggleSubject = (subjectId) => {
    const isRemoving = draft.subjectIds.includes(subjectId);
    const next = isRemoving
      ? draft.subjectIds.filter((id) => id !== subjectId)
      : [...draft.subjectIds, subjectId];

    /* درس حذف‌شده → مباحث همان درس هم از انتخاب خارج شوند */
    let nextTopics = draft.topicPaths;
    if (isRemoving) {
      const removedBranches = catalog.topicTree[subjectId] ?? [];
      nextTopics = draft.topicPaths.filter(
        (topic) =>
          !removedBranches.some(
            (branch) => branch.name === topic || branch.children.some((child) => child.name === topic),
          ),
      );
    }

    update({ subjectIds: next, topicPaths: nextTopics });
  };

  /* درخواست مباحث مرتبط از دادهٔ واقعی — فقط وقتی کاربر گزینه را فعال کند */
  useEffect(() => {
    if (!relatedOpen || !draft.topicPaths.length) return undefined;
    let alive = true;
    setLoadingRelated(true);
    Promise.all(draft.topicPaths.slice(0, 4).map((topic) => fetchRelatedTopics(topic)))
      .then((results) => {
        if (!alive) return;
        const merged = new Map();
        for (const result of results) {
          for (const item of result.related ?? []) {
            if (!merged.has(item.topic)) merged.set(item.topic, item);
          }
        }
        setRelated([...merged.values()].sort((a, b) => b.score - a.score).slice(0, 8));
      })
      .catch(() => alive && setRelated([]))
      .finally(() => alive && setLoadingRelated(false));
    return () => {
      alive = false;
    };
  }, [relatedOpen, draft.topicPaths]);

  const availableRelated = useMemo(
    () => (related ?? []).filter((item) => !draft.topicPaths.includes(item.topic)),
    [related, draft.topicPaths],
  );

  return (
    <div className="ex-enter space-y-4">
      <SectionCard
        icon="book"
        accent="#5b8cc7"
        title="از کدام درس‌ها؟"
        hint="یک یا چند درس — آمار از بانک تست و عملکرد خودت می‌آید."
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {(catalog?.subjects ?? []).map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              selected={draft.subjectIds.includes(subject.id)}
              onToggle={toggleSubject}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon="layers"
        accent="#937fcd"
        title="کدام مبحث‌ها؟"
        hint="می‌توانی یک مبحث، یک فصل یا کل درس را انتخاب کنی — یا خالی بگذاری تا کل درس بیاید."
      >
        <TopicTreeSlot draft={draft} update={update} catalog={catalog} />
      </SectionCard>

      {/* قلاب شبکهٔ دانش */}
      <div className="rounded-[2rem] border border-white/8 bg-[#242426] p-5">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-0.5 grid h-5.5 w-5.5 shrink-0 place-items-center rounded-lg transition-colors ${
                relatedOpen ? 'bg-[#937fcd] text-white' : 'border border-white/20 bg-white/5 text-transparent'
              }`}
              aria-hidden="true"
            >
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span>
              <strong className="block text-[13px] [font-family:'Doran',Tahoma,sans-serif]">مباحث مرتبط را نیز پیشنهاد بده</strong>
              <span className="mt-0.5 block text-[11px] leading-5 text-[#8a8a8a]">
                از شبکهٔ دانش تپش، مبحث‌های مرتبط با انتخابت (والد/فرزند/هم‌پوشان محتوایی) پیشنهاد می‌شود.
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={relatedOpen}
            onChange={(event) => setRelatedOpen(event.target.checked)}
          />
        </label>

        {relatedOpen && (
          <div className="ex-enter mt-4 border-t border-white/8 pt-4">
            {!draft.topicPaths.length ? (
              <p className="text-[11.5px] text-[#777]">برای پیشنهاد مرتبط‌ها، اول چند مبحث انتخاب کن.</p>
            ) : loadingRelated ? (
              <p className="text-[11.5px] text-[#777]">در حال بررسی شبکهٔ دانش…</p>
            ) : availableRelated.length ? (
              <div className="flex flex-wrap gap-2">
                {availableRelated.map((item) => (
                  <button
                    key={item.topic}
                    type="button"
                    onClick={() => update({ topicPaths: [...draft.topicPaths, item.topic] })}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#937fcd]/40 bg-[#937fcd]/10 px-3.5 py-2 text-[11.5px] text-[#cfc4f2] transition-colors hover:bg-[#937fcd]/20"
                  >
                    <Icon name="plus" className="h-3 w-3" />
                    {item.topic}
                    <span className="text-[9.5px] opacity-70">{item.reason}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11.5px] text-[#777]">مبحث مرتبط جدیدی پیدا نشد — انتخابت از الان هم پوشش خوبی دارد.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* اسلات درخت مبحث — انتخاب‌ها بین درس‌ها مشترک است */
function TopicTreeSlot({ draft, update, catalog }) {
  return <TopicTree topicTree={catalog?.topicTree ?? {}} subjectIds={draft.subjectIds} topicPaths={draft.topicPaths} onChange={(topicPaths) => update({ topicPaths })} />;
}
