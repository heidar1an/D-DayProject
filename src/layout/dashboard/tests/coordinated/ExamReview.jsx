/*
 * ExamReview — مرور سؤال به سؤال بعد از آزمون.
 * برای هر سؤال: صورت، گزینهٔ صحیح، گزینهٔ انتخاب‌شده، توضیح، مبحث و پیوند به چرخهٔ
 * یادگیری: «افزودن به فلش‌کارت» مستقیم به سرویس فلش‌کارت تپش می‌رود (دک اختصاصی
 * مرور آزمون‌های هماهنگ ساخته/یافت می‌شود). لینک درسنامه و ویکی گام بعدی اتصال است.
 */
import { useMemo, useState } from 'react';
import {
  createCard,
  createDeck,
  fetchMyDecks,
} from '../../../../services/flashcards/flashcardService';
import { Icon, faNum, toFa } from './coordinatedShared';

const REVIEW_DECK_TITLE = 'مرور آزمون‌های هماهنگ';

const FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'correct', label: 'صحیح' },
  { id: 'wrong', label: 'غلط' },
  { id: 'unanswered', label: 'نزده' },
  { id: 'marked', label: 'علامت‌دار' },
];

const optionState = (index, question) => {
  const selected = question.userAnswer?.selected;
  if (index === question.correctAnswer) return 'correct';
  if (selected === index) return 'wrong';
  return 'neutral';
};

function ReviewQuestionCard({ question, index, userData, sourceMeta }) {
  const [cardState, setCardState] = useState('idle'); // idle | saving | saved
  const selected = question.userAnswer?.selected;
  const state =
    question.userAnswer == null
      ? { label: 'نزده', accent: '#e0b45c' }
      : selected === question.correctAnswer
        ? { label: 'پاسخ صحیح', accent: '#61D192' }
        : { label: 'پاسخ غلط', accent: '#e26d6d' };

  const addToFlashcards = async () => {
    if (cardState !== 'idle') return;
    setCardState('saving');
    try {
      const decks = await fetchMyDecks(userData);
      let deck = decks.userDecks.find((item) => item.title === REVIEW_DECK_TITLE);
      if (!deck) {
        deck = await createDeck(userData, {
          title: REVIEW_DECK_TITLE,
          description: 'نکته‌های کلیدی ذخیره‌شده از کارنامهٔ آزمون‌های هماهنگ تپش',
          cover: '#937fcd',
        });
      }
      await createCard(userData, deck.id, {
        front: question.stem,
        back: `${question.keyPoint ?? question.explanation}`,
        tags: [question.subject, question.topic].filter(Boolean),
        source: {
          sourceType: 'exam',
          sourceId: sourceMeta.examId,
          title: sourceMeta.examTitle,
          url: null,
        },
        language: 'fa',
      });
      setCardState('saved');
    } catch {
      setCardState('idle');
    }
  };

  return (
    <article className="overflow-hidden rounded-[1.8rem] border border-white/[0.06] bg-[#242426]">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-4 md:p-5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-xs font-bold text-[#ccc]">
          {toFa(index + 1)}
        </span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10.5px] text-[#9a9a9a]">{question.topic}</span>
        <span
          className="rounded-full px-2.5 py-1 text-[10.5px] font-bold"
          style={{ background: `${state.accent}16`, color: state.accent }}
        >
          {state.label}
        </span>
        {question.userAnswer?.marked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e0b45c]/12 px-2.5 py-1 text-[10.5px] text-[#e0b45c]">
            <Icon name="flag" className="h-3 w-3" />
            علامت‌دار
          </span>
        )}
      </header>

      <div className="space-y-4 p-4 md:p-5">
        <p className="text-sm leading-8 text-white">{question.stem}</p>

        <div className="space-y-2">
          {question.options.map((option, optionIndex) => {
            const optionStatus = optionState(optionIndex, question);
            return (
              <div
                key={optionIndex}
                className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-6 ${
                  optionStatus === 'correct'
                    ? 'border-[#61D192]/45 bg-[#61D192]/10 text-[#bfe8d2]'
                    : optionStatus === 'wrong'
                      ? 'border-[#e26d6d]/45 bg-[#e26d6d]/8 text-[#e3b8b8]'
                      : 'border-white/[0.06] bg-white/[0.02] text-[#9a9a9a]'
                }`}
              >
                <span className="mt-0.5 shrink-0 text-[11px] opacity-70">
                  {faNum(optionIndex + 1)})
                </span>
                <span className="flex-1">{option}</span>
                {optionStatus === 'correct' && <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-[#61D192]" />}
                {optionStatus === 'wrong' && <Icon name="x" className="mt-1 h-4 w-4 shrink-0 text-[#e26d6d]" />}
              </div>
            );
          })}
        </div>

        {selected !== undefined && selected !== question.correctAnswer && (
          <p className="text-[11.5px] text-[#8a8a8a]">
            انتخاب تو: گزینهٔ {faNum(selected + 1)}
          </p>
        )}

        <div className="rounded-2xl bg-black/30 p-4">
          <p className="flex items-start gap-2 text-[13px] leading-7 text-[#c9c9c9]">
            <Icon name="info" className="mt-1 h-4 w-4 shrink-0 text-[#937fcd]" />
            {question.explanation}
          </p>
          {question.keyPoint && (
            <p className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-7 text-[#a8d8bc]">
              <Icon name="spark" className="mt-1 h-4 w-4 shrink-0 text-[#61D192]" />
              نکتهٔ کلیدی: {question.keyPoint}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={addToFlashcards}
            disabled={cardState !== 'idle'}
            className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${
              cardState === 'saved'
                ? 'cursor-default bg-[#61D192]/15 text-[#61D192]'
                : 'bg-[#937fcd]/15 text-[#b7a6e8] hover:bg-[#937fcd]/25'
            }`}
          >
            <Icon name={cardState === 'saved' ? 'check' : 'card'} className="h-3.5 w-3.5" />
            {cardState === 'saved' ? 'به فلش‌کارت اضافه شد' : cardState === 'saving' ? 'در حال افزودن…' : 'افزودن به فلش‌کارت'}
          </button>
          {question.related?.lesson && (
            <span
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-4 py-2.5 text-xs text-[#8a8a8a]"
              title="اتصال به درسنامه و ویکی تپش به‌زودی فعال می‌شود"
            >
              <Icon name="book" className="h-3.5 w-3.5" />
              درسنامه: {question.related.lesson}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ExamReview({ exam, questions, userData, onBack }) {
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    let marked = 0;
    for (const question of questions) {
      if (!question.userAnswer) unanswered += 1;
      else if (question.userAnswer.selected === question.correctAnswer) correct += 1;
      else wrong += 1;
      if (question.userAnswer?.marked) marked += 1;
    }
    return { correct, wrong, unanswered, marked, all: questions.length };
  }, [questions]);

  const filtered = questions.filter((question) => {
    if (filter === 'correct') return question.userAnswer?.selected === question.correctAnswer;
    if (filter === 'wrong') return question.userAnswer && question.userAnswer.selected !== question.correctAnswer;
    if (filter === 'unanswered') return !question.userAnswer;
    if (filter === 'marked') return Boolean(question.userAnswer?.marked);
    return true;
  });

  return (
    <div className="dash-stagger space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#282828] px-3.5 py-2.5 text-xs text-[#aaa] transition-colors hover:bg-[#333] hover:text-white"
        >
          <Icon name="back" className="h-3.5 w-3.5" />
          بازگشت به کارنامه
        </button>
        <p className="text-xs text-[#8a8a8a]">
          مرور «{exam?.title}» — {faNum(counts.correct)} صحیح، {faNum(counts.wrong)} غلط، {faNum(counts.unanswered)} نزده
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="فیلتر سؤال‌ها">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs transition-colors [font-family:'Doran',Tahoma,sans-serif] ${
              filter === item.id ? 'bg-[#937fcd] text-white' : 'bg-[#242426] text-[#aaa] hover:bg-[#2e2e30] hover:text-white'
            }`}
          >
            {item.label}
            <span className="mr-1.5 text-[10px] opacity-60">({faNum(counts[item.id])})</span>
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((question) => (
            <ReviewQuestionCard
              key={question.id}
              question={question}
              index={questions.indexOf(question)}
              userData={userData}
              sourceMeta={{ examId: exam?.id, examTitle: exam?.title }}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/[0.02] p-8 text-center text-sm text-[#8a8a8a]">
          سؤالی در این دسته نیست.
        </p>
      )}
    </div>
  );
}
