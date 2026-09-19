/*
 * Checkpoint میکرودرسنامه — تست داخل جریان مطالعه، نه بیرون آن.
 *
 * فازها:
 *   question  — سؤال‌های انتخاب‌شده از بانک تست، یکی‌یکی با بازخورد کامل و ناوبری
 *   result    — کارنامهٔ checkpoint + تشخیص ضعف
 *   review    — «مرور کوتاه ۴۰ ثانیه‌ای» برای checkpointهای required با عملکرد ضعیف
 *
 * هر ورود به checkpoint، سؤال‌ها دوباره برای حل‌کردن نمایش داده می‌شوند (تمرین مجدد).
 * چرخهٔ Learn → Test → Detect Weakness → Review → Retest همین‌جا کامل می‌شود و
 * سؤال‌های گیج‌کننده با یک کلیک به «تپش هوشمند» ارسال می‌شوند.
 */

import { useMemo, useState } from 'react';
import { toFa } from '../learning/learningUtils';

const REQUIRED_THRESHOLD = 50; // حداقل دقت برای عبور آزاد از checkpoint اجباری

/* پرامپت ارسالی به تپش هوشمند از دل پاسخنامه — با بافت کامل سؤال و پاسخ کاربر */
export function buildAIQuestionPrompt(question, attempt) {
  const correctOption = question.options[question.correctAnswer] ?? '';
  if (attempt.correct) {
    return `سلام تپش هوشمند! در میکرودرسنامهٔ تپش به این تست درست پاسخ دادم: «${question.stem}» — گزینهٔ درست «${correctOption}» است. لطفاً توضیح بده چرا بقیهٔ گزینه‌ها غلط‌اند و این مفهوم را عمیق‌تر براي من باز کن.`;
  }
  const userOption = question.options[attempt.selectedAnswer] ?? 'بی‌پاسخ';
  return `سلام تپش هوشمند! در میکرودرسنامهٔ تپش به این تست اشتباه پاسخ دادم: «${question.stem}» من گزینهٔ «${userOption}» را انتخاب کرده بودم، ولی پاسخ درست «${correctOption}» است. لطفاً قدم‌به‌قدم و ساده توضیح بده چرا پاسخ من غلط است و مفهوم درست چیست.`;
}

/* بازخورد کامل یک پاسخ: توضیح، چرا بقیه غلط‌اند، مرور صفحه و پرش به تپش هوشمند */
function FeedbackPanel({ question, attempt, deepMode, pageConcepts, onReviewPage, onAskAI }) {
  const relatedPageId = attempt.conceptIds
    .map((conceptId) => pageConcepts.get(conceptId)?.[0])
    .find(Boolean);

  return (
    <div className={`micr-cpfeedback ${attempt.correct ? 'is-correct' : 'is-wrong'}`}>
      <p className="micr-cpfeedback__verdict">
        {attempt.correct ? 'درست بود!' : 'اشتباه بود'}
        <span>{attempt.correct ? 'این مفهوم را خوب فهمیده‌ای.' : 'بازخورد را کامل بخوان تا در تلاش بعدی درست جواب بدهی.'}</span>
      </p>

      {attempt.explanation && (
        <div className="micr-cpfeedback__explain">
          <p className="micr-cpfeedback__summary">{attempt.explanation.summary}</p>
          {deepMode && attempt.explanation.deep && <p className="micr-cpfeedback__deep">{attempt.explanation.deep}</p>}
          {attempt.explanation.keyPoint && (
            <p className="micr-cpfeedback__keypoint"><b>کلید:</b> {attempt.explanation.keyPoint}</p>
          )}
          {deepMode && attempt.explanation.trap && (
            <p className="micr-cpfeedback__trap"><b>دام کنکوری:</b> {attempt.explanation.trap}</p>
          )}
          {deepMode && attempt.explanation.whyWrong?.length > 0 && (
            <ul className="micr-cpfeedback__whywrong">
              {attempt.explanation.whyWrong.map((item) => (
                <li key={item.index}>
                  <b>گزینه {toFa(item.index + 1)}</b>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="micr-cpfeedback__related">
        <button type="button" className="micr-askai" onClick={() => onAskAI?.(buildAIQuestionPrompt(question, attempt))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" /><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z" /></svg>
          هنوز متوجه نشدی؟ از تپش هوشمند بپرس
        </button>
        {relatedPageId && (
          <button type="button" className="micr-cpfeedback__review" onClick={() => onReviewPage(relatedPageId)}>
            مرور مفهوم — برگرد به صفحهٔ درسنامه
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ question, attempt, deepMode, pageConcepts, onAnswer, onReviewPage, onAskAI }) {
  const [selected, setSelected] = useState(null);
  const answered = Boolean(attempt);

  const submit = () => {
    if (selected === null || answered) return;
    onAnswer(selected);
  };

  return (
    <article className="micr-cpq">
      <p className="micr-cpq__stem">{question.stem}</p>

      <div className="micr-cpq__options" role="radiogroup" aria-label="گزینه‌ها">
        {question.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrect = answered && question.correctAnswer === index;
          const isWrongPick = answered && isSelected && question.correctAnswer !== index;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={answered}
              className={`micr-cpq__option${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isWrongPick ? ' is-wrong' : ''}`}
              onClick={() => setSelected(index)}
            >
              <i>{toFa(String.fromCharCode(65 + index).toLowerCase())}</i>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {!answered ? (
        <div className="micr-cpq__actions">
          <button type="button" className="micr-button micr-button--primary" onClick={submit} disabled={selected === null}>
            ثبت پاسخ
          </button>
        </div>
      ) : (
        <FeedbackPanel
          question={question}
          attempt={attempt}
          deepMode={deepMode}
          pageConcepts={pageConcepts}
          onReviewPage={onReviewPage}
          onAskAI={onAskAI}
        />
      )}
    </article>
  );
}

/* کارت مرور کوتاه — نکات کلیدی صفحه‌های scope بدون بازگشت به متن */
function ReviewCard({ unit, checkpoint, onFullPage }) {
  const keyPoints = useMemo(() => {
    const items = [];
    for (const page of unit.pages) {
      if (!checkpoint.scopePages?.includes(page.id)) continue;
      const keyPoint = page.blocks.find((block) => block.type === 'keyPoint');
      if (keyPoint) items.push({ pageId: page.id, pageTitle: page.title, text: keyPoint.text });
    }
    return items;
  }, [unit, checkpoint]);

  return (
    <div className="micr-cpreview">
      <strong>این مفهوم‌ها هنوز تثبیت نشده‌اند — یک مرور ۴۰ ثانیه‌ای</strong>
      <p>قبل از تلاش مجدد، فقط نکته‌های کلیدی را بخوان؛ بدون سرزنش، بدون قفل‌شدن صفحه.</p>
      <ul>
        {keyPoints.map((item) => (
          <li key={item.pageId}>
            <span>{item.text}</span>
            <button type="button" onClick={() => onFullPage(item.pageId)}>مرور کامل صفحه</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MicroCheckpoint({
  checkpoint,
  unit,
  questions,
  deepMode,
  pageConcepts,
  onAnswer,
  onComplete,
  onNext,
  onReviewPage,
  onRetestStart,
  onAskAI,
}) {
  /* هر ورود به checkpoint، حلِ مجدد سؤال‌ها از فاز سؤال شروع می‌شود */
  const [phase, setPhase] = useState('question');
  const [qIndex, setQIndex] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [retestMode, setRetestMode] = useState(false);
  const [closeRegistered, setCloseRegistered] = useState(false);

  /* دقت این دور از حل — تلاش‌های قبلی در rollup پیشرفت جدا جمع می‌شوند */
  const accuracy = attempts.length
    ? Math.round((attempts.filter((attempt) => attempt.correct).length / attempts.length) * 100)
    : 0;

  const weakConceptIds = () => {
    const ids = new Set();
    for (const attempt of attempts) if (!attempt.correct) attempt.conceptIds.forEach((id) => ids.add(id));
    return [...ids];
  };

  const currentQuestion = questions[qIndex];
  const currentAttempt = attempts.find((attempt) => attempt.questionId === currentQuestion?.id);

  const handleAnswer = (selectedAnswer) => {
    if (!currentQuestion || currentAttempt) return;
    const attempt = {
      questionId: currentQuestion.id,
      selectedAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      correct: selectedAnswer === currentQuestion.correctAnswer,
      conceptIds: currentQuestion.conceptIds ?? [],
      explanation: currentQuestion.explanation,
      answeredAt: Date.now(),
      retest: retestMode,
    };
    setAttempts((previous) => [...previous, attempt]);
    onAnswer?.(attempt);
  };

  const goPrevQuestion = () => setQIndex((index) => Math.max(0, index - 1));
  const goNextQuestion = () => {
    if (qIndex + 1 < questions.length) setQIndex(qIndex + 1);
    else setPhase('result');
  };

  const finishCheckpoint = ({ requiredMet }) => {
    if (!closeRegistered) {
      onComplete?.({ requiredMet, weakConcepts: weakConceptIds() });
      setCloseRegistered(true);
    }
    onNext?.();
  };

  const requiredFailed = checkpoint.required && accuracy < REQUIRED_THRESHOLD && !retestMode;

  return (
    <section className="micr-cp" aria-label={`Checkpoint ${checkpoint.id}`}>
      {/* فاز سؤال‌ها — با ناوبری آزاد میان سؤال‌ها */}
      {phase === 'question' && currentQuestion && (
        <div className="micr-cpstack">
          <div className="micr-cpstack__meter">
            <i style={{ '--p': `${Math.round(((qIndex + (currentAttempt ? 1 : 0)) / questions.length) * 100)}%` }} />
          </div>
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            attempt={currentAttempt}
            deepMode={deepMode}
            pageConcepts={pageConcepts}
            onAnswer={handleAnswer}
            onReviewPage={onReviewPage}
            onAskAI={onAskAI}
          />
          <div className="micr-cpnav">
            <button
              type="button"
              className="micr-button micr-button--quiet"
              onClick={goPrevQuestion}
              disabled={qIndex === 0}
            >
              سؤال قبلی
            </button>
            <span className="micr-cpnav__count">سؤال {toFa(qIndex + 1)} از {toFa(questions.length)}</span>
            {/* حرکت آزاد: حتی بدون پاسخ‌دادن هم می‌توان بین سؤال‌ها رفت */}
            <button type="button" className="micr-button micr-button--soft" onClick={goNextQuestion}>
              {qIndex + 1 < questions.length ? 'سؤال بعدی' : 'دیدن نتیجه'}
            </button>
          </div>
        </div>
      )}

      {/* فاز نتیجه و تصمیم */}
      {phase === 'result' && (
        <div className="micr-cpresult">
          <div className="micr-cpresult__score">
            <strong>{toFa(accuracy)}٪</strong>
            <span>
              {toFa(attempts.filter((attempt) => attempt.correct).length)} از {toFa(attempts.length)} پاسخ درست
            </span>
          </div>

          {requiredFailed ? (
            <>
              <p className="micr-cpresult__message">
                این checkpoint برای ادامه مهم است؛ یک مرور کوتاه انجام بده و دوباره امتحان کن.
              </p>
              <ReviewCard unit={unit} checkpoint={checkpoint} onFullPage={onReviewPage} />
              <div className="micr-cpresult__actions">
                <button
                  type="button"
                  className="micr-button micr-button--primary"
                  onClick={() => { onRetestStart?.(); setRetestMode(true); setQIndex(0); setPhase('question'); }}
                  disabled={!questions.length}
                >
                  آماده‌ام، تلاش مجدد
                </button>
                <button
                  type="button"
                  className="micr-button micr-button--soft"
                  onClick={() => finishCheckpoint({ requiredMet: false })}
                >
                  فعلاً ادامه بده
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="micr-cpresult__message">
                {attempts.length === 0
                  ? 'به هیچ سؤالی پاسخ ندادی؛ این مفهوم‌ها در مرورهای بعدی دوباره سراغت می‌آیند.'
                  : accuracy >= 85
                    ? 'عالی بود — این مفهوم‌ها در حال تثبیت‌شدن‌اند.'
                    : accuracy >= REQUIRED_THRESHOLD
                      ? 'عملکرد خوبی بود؛ مفهوم‌های اشتباه در چرخهٔ مرور تپش ثبت شدند.'
                      : 'ادامه بده؛ این مفهوم‌ها در مرورهای بعدی دوباره سراغت می‌آیند.'}
              </p>
              <div className="micr-cpresult__actions">
                <button
                  type="button"
                  className="micr-button micr-button--primary"
                  onClick={() => finishCheckpoint({ requiredMet: true })}
                >
                  ادامهٔ یادگیری
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
