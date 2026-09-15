/*
 * BankSubject — نمای «داخل یک درس».
 * چیدمان: سمت چپ فقط بخش‌های همان درس (سایدبار اختصاصی)، سمت راست فهرست مباحث آن درس —
 * خودِ سؤال‌ها اینجا نمایش داده نمی‌شوند. کلیک روی هر مبحث، مستقیم سشن حل تست همان مبحث
 * را باز می‌کند و آنجا با «سؤال قبلی/بعدی» می‌شود بین سؤال‌ها چرخید.
 *
 * شمارش هر مبحث از یک فراخوان سرویس برای کل درس مشتق می‌شود (نه یک درخواست به‌ازای هر مبحث)
 * تا با لِیتنسی واقعی سرویس هم سریع بماند.
 */
import { useEffect, useMemo, useState } from 'react';
import { scopeToFilters, searchQuestions, SUBJECTS, TOPIC_TREE } from '../../../../services/testBank/testBankService';
import { EmptyState, Icon, Skeleton, toFa } from './bankShared';

const ALL_SECTIONS = '__all__';
const POOL_PAGE_SIZE = 500;

export default function BankSubject({ userId, scope, subjectId, subjectTitle = null, onStartTopic }) {
  const subject = useMemo(() => SUBJECTS.find((item) => item.id === subjectId) ?? null, [subjectId]);
  /* عنوان نمایشی از کارت درس می‌آید تا با لایهٔ «درسنامهٔ جامع» یکی بماند */
  const subjectName = subjectTitle ?? subject?.name ?? 'درس';
  const sections = useMemo(() => TOPIC_TREE[subjectId] ?? [], [subjectId]);

  const [activeSection, setActiveSection] = useState(ALL_SECTIONS);
  const [pool, setPool] = useState(null); // همهٔ سؤال‌های این درس، از سرویس

  useEffect(() => {
    let alive = true;
    setPool(null);
    setActiveSection(ALL_SECTIONS);
    searchQuestions(
      userId,
      { ...scopeToFilters(scope), subjectIds: [subjectId] },
      { page: 1, pageSize: POOL_PAGE_SIZE },
    )
      .then((result) => alive && setPool(result.items))
      .catch(() => alive && setPool([]));
    return () => {
      alive = false;
    };
  }, [userId, scope, subjectId]);

  /* شمارش سؤال‌های یک بخش یا یک مبحث داخل آن بخش */
  const countOf = (section, topic = null) =>
    (pool ?? []).filter((entry) => {
      const path = entry.question?.topicPath ?? [];
      if (path[0] !== section) return false;
      return topic ? path[1] === topic : true;
    }).length;

  const subjectTotal = (pool ?? []).length;
  const visibleSections = activeSection === ALL_SECTIONS ? sections : sections.filter((node) => node.name === activeSection);

  const startTopic = (section, topic) => {
    const count = countOf(section, topic);
    if (!count) return;
    onStartTopic?.({
      subjectId,
      subjectName,
      topic: section,
      subtopic: topic,
      count,
      shuffle: false,
    });
  };

  const sectionButton = (isActive) =>
    `flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right text-sm transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-[#bbb] hover:bg-white/[0.05] hover:text-white'
    }`;

  return (
    <div className="tb-subject-in grid gap-6 lg:grid-cols-[minmax(0,1fr)_264px]">
      {/* ── مباحث درس ── */}
      <div className="order-2 lg:order-1">
        <header className="mb-5">
          <h2 className="text-xl font-bold [font-family:'Doran',Tahoma,sans-serif] md:text-2xl">
            {activeSection === ALL_SECTIONS ? `مباحث ${subjectName}` : activeSection}
          </h2>
          <p className="mt-2 text-[13px] leading-7 text-[#8a8a8a]">
            روی هر مبحث بزن تا مستقیم وارد حل تست شوی؛ آن‌جا با «سؤال قبلی / سؤال بعدی» می‌توانی بین سؤال‌ها بچرخی.
          </p>
        </header>

        {pool === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : !visibleSections.length ? (
          <EmptyState
            icon="layers"
            title="مبحثی برای این درس ثبت نشده"
            note="برای این درس هنوز درخت مبحث تعریف نشده؛ از «کاوشگر بانک تست» یا «آزمون‌های سال به سال» وارد شو."
          />
        ) : (
          /* key={activeSection} باعث می‌شود با هر تغییر بخش، محتوا دوباره mount و انیمیشن ورود اجرا شود */
          <div key={activeSection} className="tb-topics-in space-y-6">
            {visibleSections.map((node) => {
              const topics = node.children?.length ? node.children : [null];
              const sectionCount = countOf(node.name);

              return (
                <section key={node.name} aria-label={node.name}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold [font-family:'Doran',Tahoma,sans-serif] md:text-lg">{node.name}</h3>
                    <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11.5px] text-[#aaa]">
                      {toFa(sectionCount)} سؤال
                    </span>
                    <span className="h-px flex-1 bg-white/8" aria-hidden="true" />
                    <button
                      type="button"
                      disabled={!sectionCount}
                      onClick={() => startTopic(node.name, null)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#61D192]/12 px-3.5 py-2 text-xs text-[#61D192] transition-colors hover:bg-[#61D192]/20 disabled:cursor-default disabled:opacity-40"
                    >
                      <Icon name="play" className="h-3 w-3" />
                      تمرین از کل بخش
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {topics.map((topic) => {
                      const count = countOf(node.name, topic);
                      const label = topic ?? node.name;
                      return (
                        <button
                          key={label}
                          type="button"
                          disabled={!count}
                          onClick={() => startTopic(node.name, topic)}
                          aria-label={`شروع حل تست ${label}`}
                          className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#242426] px-4 py-3.5 text-right transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#2a2a2c] disabled:cursor-default disabled:translate-y-0 disabled:opacity-40"
                        >
                          <span className="min-w-0">
                            <strong className="block truncate text-[15px] [font-family:'Doran',Tahoma,sans-serif] md:text-base">
                              {label}
                            </strong>
                            <span className="text-xs text-[#8a8a8a]">
                              {count ? `${toFa(count)} سؤال` : 'سؤالی ثبت نشده'}
                            </span>
                          </span>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#61D192]/12 text-[#61D192] transition-colors group-hover:bg-[#61D192] group-hover:text-[#12271a]">
                            <Icon name="play" className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* ── بخش‌های همین درس — سایدبار اختصاصی، سمت چپ ── */}
      <aside className="order-1 lg:order-2" aria-label={`بخش‌های ${subjectName}`}>
        <div className="sticky top-6 rounded-[1.75rem] border border-white/8 bg-[#242426] p-5">
          <div className="mb-4 flex items-center gap-2.5 border-b border-white/8 pb-4">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: subject?.accent ?? '#61D192' }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <strong className="block truncate text-base [font-family:'Doran',Tahoma,sans-serif]">
                {subjectName}
              </strong>
              <span className="text-xs text-[#8a8a8a]">
                {pool === null ? 'در حال شمارش…' : `${toFa(subjectTotal)} سؤال در بانک`}
              </span>
            </div>
          </div>

          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setActiveSection(ALL_SECTIONS)}
                aria-pressed={activeSection === ALL_SECTIONS}
                className={sectionButton(activeSection === ALL_SECTIONS)}
              >
                <span>همهٔ مباحث</span>
                <span className="shrink-0 text-xs text-[#777]">{toFa(subjectTotal)}</span>
              </button>
            </li>
            {sections.map((node) => (
              <li key={node.name}>
                <button
                  type="button"
                  onClick={() => setActiveSection(node.name)}
                  aria-pressed={activeSection === node.name}
                  className={sectionButton(activeSection === node.name)}
                >
                  <span className="truncate">{node.name}</span>
                  <span className="shrink-0 text-xs text-[#777]">{toFa(countOf(node.name))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
