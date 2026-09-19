/*
 * پایان میکرودرسنامه — نه فقط یک تیک سبز.
 * کارنامه: صفحات، زمان، سؤال‌ها، دقت، مفهوم‌های مسلط/ضعیف، پرچم اعتماد-عملکرد و
 * پیشنهاد مرور. سپس سه انتخاب: مرور نقاط ضعف، آزمون جمع‌بندی، ادامه (بازگشت به فهرست).
 *
 * آزمون جمع‌بندی (Mini Assessment): سؤال‌های انتخاب‌شده از بانک تست تپش با اولویت
 * دیده‌نشده‌ها — کپی سؤال‌های checkpoint نیست.
 */

import { useMemo, useState } from 'react';
import { toFa } from '../learning/learningUtils';
import { buildAIQuestionPrompt } from './MicroCheckpoint';

const minutesLabel = (seconds) => (seconds >= 60 ? `${toFa(Math.round(seconds / 60))} دقیقه` : `${toFa(seconds)} ثانیه`);

export function MicroCompletion({ summary, unit, onReviewWeak, onAssessment, onExit }) {
  const timeLabel = minutesLabel(summary.timeSpentSec);

  return (
    <section className="micr-done" aria-label="پایان میکرودرسنامه">
      <header className="micr-done__head">
        <span className="micr-done__ring" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </span>
        <h2>این بخش را تمام کردی!</h2>
        <p>کل زنجیرهٔ «چرخهٔ قلبی» را خواندی و تست زدی — حالا نقشهٔ واقعی یادگیری‌ت را ببین.</p>
      </header>

      <div className="micr-done__stats">
        <div><b>{toFa(summary.pagesCompleted)}</b><span>صفحهٔ خوانده‌شده</span></div>
        <div><b>{timeLabel}</b><span>زمان مطالعه</span></div>
        <div><b>{toFa(summary.questionsAnswered)}</b><span>سؤال پاسخ‌داده</span></div>
        <div><b>{toFa(summary.accuracy)}٪</b><span>دقت پاسخ‌ها</span></div>
        <div><b>{toFa(Math.round(summary.overall))}٪</b><span>امتیاز تسلط</span></div>
      </div>

      {summary.confidenceFlag && (
        <aside className={`micr-done__flag micr-done__flag--${summary.confidenceFlag.type}`}>
          <strong>{summary.confidenceFlag.type === 'overconfident' ? 'اعتماد بالا، دقت پایین' : 'دقت بالا، اعتماد پایین'}</strong>
          <p>{summary.confidenceFlag.message}</p>
        </aside>
      )}

      <div className="micr-done__concepts">
        <div className="micr-done__list">
          <h4>مسلط و در حال تمرین</h4>
          <ul>
            {summary.masteredConcepts.slice(0, 5).map((concept) => (
              <li key={concept.id} className="is-strong">{concept.title}</li>
            ))}
            {!summary.masteredConcepts.length && <li className="is-empty">هنوز مفهومی تثبیت نشده — با آزمون جمع‌بندی شروع کن.</li>}
          </ul>
        </div>
        <div className="micr-done__list">
          <h4>پیشنهاد مرور تپش</h4>
          <ul>
            {summary.weakConcepts.slice(0, 5).map((concept) => (
              <li key={concept.conceptId} className="is-weak">
                {concept.title}
                <small>{concept.attempts ? `دقت ${toFa(concept.accuracy)}٪` : 'تازه دیده‌شده'}</small>
              </li>
            ))}
            {!summary.weakConcepts.length && <li className="is-empty">نقطهٔ ضعف فعالی ثبت نشده؛ عالی!</li>}
          </ul>
        </div>
      </div>

      <div className="micr-done__actions">
        <button type="button" className="micr-button micr-button--primary" onClick={onReviewWeak} disabled={!summary.weakConcepts.length}>
          مرور نقاط ضعف
        </button>
        <button type="button" className="micr-button micr-button--soft" onClick={onAssessment}>
          آزمون جمع‌بندی ({toFa(unit.finalAssessment?.questionCount ?? 10)} سؤال)
        </button>
        <button type="button" className="micr-button micr-button--quiet" onClick={onExit}>
          ادامه به مبحث بعدی
        </button>
      </div>
    </section>
  );
}

/* آزمون جمع‌بندی — همان زبان checkpoint ولی همه‌جا واحد و با اولویت سؤال‌های تازه */
export function FinalAssessment({ questions, onAnswer, onFinish, attempts, deepMode, onAskAI }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const question = questions[index];
  const attempt = useMemo(
    () => attempts.find((item) => item.questionId === question?.id),
    [attempts, question],
  );

  if (!question) return null;
  const answered = revealed && attempt;

  return (
    <section className="micr-assess" aria-label="آزمون جمع‌بندی">
      <header className="micr-cp__head">
        <span className="micr-cp__badge">آزمون جمع‌بندی</span>
        <h2 className="micr-cp__title">ده سؤال از مهم‌ترین مفاهیم این بخش</h2>
        <p className="micr-cp__hint">سؤال‌ها از بانک تست تپش انتخاب شده‌اند؛ اولویت با سؤال‌هایی است که هنوز ندیده‌ای.</p>
      </header>

      <div className="micr-cpstack">
        <div className="micr-cpstack__meter">
          <i style={{ '--p': `${Math.round(((index + (answered ? 1 : 0)) / questions.length) * 100)}%` }} />
          <span>سؤال {toFa(index + 1)} از {toFa(questions.length)}</span>
        </div>

        <article className="micr-cpq">
          <p className="micr-cpq__stem">{question.stem}</p>

          <div className="micr-cpq__options" role="radiogroup" aria-label="گزینه‌ها">
            {question.options.map((option, optionIndex) => {
              const isSelected = attempt?.selectedAnswer === optionIndex;
              const isCorrect = answered && question.correctAnswer === optionIndex;
              const isWrongPick = answered && isSelected && question.correctAnswer !== optionIndex;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={answered}
                  className={`micr-cpq__option${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isWrongPick ? ' is-wrong' : ''}`}
                  onClick={() => { onAnswer(question, optionIndex); setRevealed(true); }}
                >
                  <i>{toFa(String.fromCharCode(65 + optionIndex).toLowerCase())}</i>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>

          {answered && attempt && (
            <div className={`micr-cpfeedback ${attempt.correct ? 'is-correct' : 'is-wrong'}`}>
              <p className="micr-cpfeedback__verdict">
                {attempt.correct ? 'درست بود!' : 'اشتباه بود'}
              </p>
              {question.explanation?.summary && (
                <p className="micr-cpfeedback__summary">{question.explanation.summary}</p>
              )}
              {deepMode && question.explanation?.keyPoint && (
                <p className="micr-cpfeedback__keypoint"><b>کلید:</b> {question.explanation.keyPoint}</p>
              )}
              <div className="micr-cpfeedback__related">
                <button type="button" className="micr-askai" onClick={() => onAskAI?.(buildAIQuestionPrompt(question, attempt))}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" /><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z" /></svg>
                  هنوز متوجه نشدی؟ از تپش هوشمند بپرس
                </button>
              </div>
            </div>
          )}
        </article>

        {answered && (
          <div className="micr-cpq__actions">
            {index + 1 < questions.length ? (
              <button type="button" className="micr-button micr-button--primary" onClick={() => { setIndex(index + 1); setRevealed(false); }}>
                سؤال بعدی
              </button>
            ) : (
              <button type="button" className="micr-button micr-button--primary" onClick={onFinish}>
                دیدن کارنامهٔ آزمون
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* کارنامهٔ آزمون جمع‌بندی */
export function AssessmentResult({ attempts, onExit }) {
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;

  return (
    <section className="micr-done" aria-label="کارنامهٔ آزمون جمع‌بندی">
      <header className="micr-done__head">
        <h2>کارنامهٔ آزمون جمع‌بندی</h2>
        <p>
          {toFa(correct)} از {toFa(attempts.length)} درست — دقت {toFa(accuracy)}٪
          {accuracy >= 80 ? '؛ این بخش را می‌توانی بسته اعلام کنی.' : '؛ مفهوم‌های اشتباه در چرخهٔ مرور تپش ثبت شدند.'}
        </p>
      </header>
      <div className="micr-done__actions">
        <button type="button" className="micr-button micr-button--primary" onClick={onExit}>
          پایان — بازگشت به فهرست
        </button>
      </div>
    </section>
  );
}
