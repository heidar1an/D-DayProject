import { useEffect, useMemo, useRef, useState } from 'react';
import { clamp, toFa } from './learningUtils';
import { createCard, createDeck } from '../../../../services/flashcards/flashcardService';

export function PriorKnowledgeActivation({ data, activityState, onChange }) {
  const responses = activityState.recallResponses ?? {};

  const selectOption = (test, optionId) => {
    if (responses[test.id]?.correct) return;
    onChange({
      recallResponses: {
        ...responses,
        [test.id]: {
          selectedAnswer: optionId,
          correct: optionId === test.answer,
          correctLabel: test.options.find((option) => option.id === test.answer)?.label,
          explanation: test.explanation,
        },
      },
    });
  };

  return (
    <div className="activate-panel">
      {data.tests.map((test) => (
        <PracticeQuestion
          key={test.id}
          question={test}
          result={responses[test.id]}
          onAnswer={(answer) => selectOption(test, answer)}
        />
      ))}
    </div>
  );
}

export function MicroLesson({ lessons, activityState, onChange }) {
  const activeIndex = clamp(activityState.currentLesson ?? 0, 0, lessons.length - 1);
  const lesson = lessons[activeIndex];
  const completedLessons = activityState.completedLessons ?? [];

  const selectLesson = (index) => {
    onChange(
      { currentLesson: index },
      { lessonIndex: index, detail: `میکرودرس ${toFa(index + 1)}: ${lessons[index].title}` },
    );
  };

  return (
    <div className="micro-lesson-layout">
      <aside className="micro-lesson-nav" aria-label="فهرست میکرودرس‌ها">
        {lessons.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`${index === activeIndex ? 'is-active' : ''} ${completedLessons.includes(item.id) ? 'is-complete' : ''}`}
            onClick={() => selectLesson(index)}
          >
            <span>{completedLessons.includes(item.id) ? '✓' : toFa(index + 1)}</span>
            <b>{item.title}</b>
          </button>
        ))}
      </aside>

      <article className="micro-lesson" key={lesson.id}>
        <header className="micro-lesson__header">
          <h3>{lesson.title}</h3>
        </header>

        <section className="micro-lesson__objective">
          <span aria-hidden="true">◎</span>
          <div>
            <small>هدف یادگیری</small>
            <p>{lesson.objective}</p>
          </div>
        </section>

        <div className="micro-lesson__content">
          <section>
            <h4>تصویر ساده مفهوم</h4>
            <p>{lesson.simple}</p>
          </section>
          <section>
            <h4>جزئیات علمی</h4>
            <p>{lesson.scientific}</p>
          </section>
          <aside className="micro-lesson__highlight">
            <small>نکته مهم</small>
            <p>{lesson.highlight}</p>
          </aside>
          {lesson.facts && (
            <div className="micro-lesson__table-wrap">
              <table>
                <thead>
                  <tr><th>ناحیه</th><th>استخوان‌ها</th><th>نقش</th></tr>
                </thead>
                <tbody>
                  {lesson.facts.map((row) => (
                    <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="micro-lesson__pair">
            <section>
              <small>مثال</small>
              <p>{lesson.example}</p>
            </section>
            <section>
              <small>اتصال به قبل</small>
              <p>{lesson.connection}</p>
            </section>
          </div>
          <div className="learning-tags">
            {lesson.concepts.map((concept) => <span key={concept}>{concept}</span>)}
          </div>
        </div>
      </article>
    </div>
  );
}

function ArmSkeleton({ showRelations = true }) {
  return (
    <svg className="anatomy-schematic" viewBox="0 0 100 112" role="img" aria-label="طرح شماتیک استخوان‌های اندام فوقانی">
      <g className="anatomy-schematic__bone">
        <path d="M49 14 C42 11 34 12 27 16" />
        <path d="M28 16 C23 20 22 28 27 33 C31 37 37 33 40 27 C43 22 41 18 36 17" />
        <path d="M43 25 C47 25 50 29 50 34 L50 56 C50 60 48 62 47 64" />
        <path d="M46 64 C43 70 40 79 39 88" />
        <path d="M50 64 C53 71 54 80 52 89" />
        <path d="M38 89 C35 92 36 96 39 98 C42 100 47 99 50 98 C54 97 56 94 53 90" />
        <path d="M40 98 L37 109 M43 99 L42 110 M47 99 L48 110 M50 98 L53 108 M53 96 L57 105" />
        <circle cx="47" cy="31" r="4" />
        <path d="M43 58 C45 60 50 60 53 57" />
      </g>
      {showRelations && (
        <g className="anatomy-schematic__relations">
          <path d="M26 17 C31 12 41 10 49 14" />
          <path d="M40 27 C42 26 44 26 47 27" />
          <path d="M39 88 C44 91 48 91 52 89" />
        </g>
      )}
    </svg>
  );
}

export function AnatomyImageViewer({ data, exploredStructures = [], onExplore }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [activeStructure, setActiveStructure] = useState(data.structures[0]?.id ?? null);
  const [layers, setLayers] = useState(() => Object.fromEntries(data.layers.map((layer) => [layer.id, true])));
  const dragRef = useRef(null);
  const active = data.structures.find((structure) => structure.id === activeStructure);

  const selectStructure = (structureId) => {
    setActiveStructure(structureId);
    onExplore?.(structureId);
  };

  const changeZoom = (delta) => setZoom((current) => clamp(Number((current + delta).toFixed(1)), 0.8, 2.2));

  const handlePointerDown = (event) => {
    if (event.target.closest('button')) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, startX: offset.x, startY: offset.y };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    setOffset({
      x: clamp(dragRef.current.startX + event.clientX - dragRef.current.x, -110, 110),
      y: clamp(dragRef.current.startY + event.clientY - dragRef.current.y, -90, 90),
    });
  };

  const stopDrag = () => { dragRef.current = null; };

  return (
    <div className="anatomy-viewer">
      <div className="anatomy-viewer__toolbar">
        <div className="anatomy-viewer__zoom" aria-label="کنترل بزرگ‌نمایی">
          <button type="button" onClick={() => changeZoom(0.2)} aria-label="بزرگ‌نمایی">+</button>
          <span>{toFa(Math.round(zoom * 100))}٪</span>
          <button type="button" onClick={() => changeZoom(-0.2)} aria-label="کوچک‌نمایی">−</button>
          <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>بازنشانی</button>
        </div>
        <label className="learning-toggle">
          <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
          <span aria-hidden="true" />
          نمایش Labelها
        </label>
      </div>

      <div className="anatomy-viewer__main">
        <aside className="anatomy-viewer__layers">
          <small>لایه‌ها</small>
          {data.layers.map((layer) => (
            <label key={layer.id}>
              <input
                type="checkbox"
                checked={layers[layer.id]}
                onChange={(event) => setLayers((current) => ({ ...current, [layer.id]: event.target.checked }))}
              />
              <span>{layer.label}</span>
            </label>
          ))}
          <p>{toFa(exploredStructures.length)} ساختار کاوش شده</p>
        </aside>

        <div
          className="anatomy-viewer__viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <div
            className={`anatomy-viewer__canvas ${layers.skeleton === false ? 'is-skeleton-hidden' : ''}`}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          >
            <ArmSkeleton showRelations={layers.relations !== false} />
            {layers.landmarks !== false && data.structures.map((structure, index) => (
              <button
                key={structure.id}
                type="button"
                className={`anatomy-marker ${activeStructure === structure.id ? 'is-active' : ''} ${exploredStructures.includes(structure.id) ? 'is-seen' : ''}`}
                style={{ left: `${structure.x}%`, top: `${structure.y}%` }}
                onClick={() => selectStructure(structure.id)}
                aria-label={`نمایش ${structure.label}`}
              >
                <span>{toFa(index + 1)}</span>
                {showLabels && <b>{structure.label}</b>}
              </button>
            ))}
          </div>
          <span className="anatomy-viewer__drag-hint">برای جابه‌جایی بکش</span>
        </div>

        <aside className="anatomy-viewer__detail" aria-live="polite">
          <small>ساختار انتخاب‌شده</small>
          <h3>{active?.label || 'یک ساختار را انتخاب کن'}</h3>
          <p>{active?.detail || data.instruction}</p>
          {active && <span>Landmark {toFa(data.structures.indexOf(active) + 1)}</span>}
        </aside>
      </div>
    </div>
  );
}

export function QuestionFeedback({ result }) {
  if (!result) return null;
  return (
    <aside className={`question-feedback ${result.correct ? 'is-correct' : 'is-wrong'}`} role="status" aria-live="polite">
      <span className="question-feedback__icon" aria-hidden="true">{result.correct ? '✓' : '!'}</span>
      <div>
        <h4>{result.correct ? 'درست تحلیل کردی' : 'هنوز یک اتصال جا افتاده'}</h4>
        {!result.correct && result.correctLabel && <p><b>پاسخ صحیح:</b> {result.correctLabel}</p>}
        <p>{result.explanation}</p>
        {!result.correct && result.misconception && <small><b>چرا این خطا رخ می‌دهد؟</b> {result.misconception}</small>}
      </div>
    </aside>
  );
}

export function PracticeQuestion({ question, result, onAnswer }) {
  return (
    <article className="practice-question">
      <header>
        <h3>{question.question}</h3>
      </header>
      <div className="practice-question__options">
        {question.options.map((option, optionIndex) => {
          const selected = result?.selectedAnswer === option.id;
          const correct = result && option.id === question.answer;
          return (
            <button
              key={option.id}
              type="button"
              className={`${selected ? 'is-selected' : ''} ${result?.correct && correct ? 'is-correct' : ''}`}
              onClick={() => onAnswer(option.id)}
              disabled={Boolean(result?.correct)}
            >
              <span>{toFa(optionIndex + 1)}</span>
              {option.label}
            </button>
          );
        })}
      </div>
      <QuestionFeedback result={result} />
    </article>
  );
}

export function AnatomyLabelQuiz({ question, structures, result, onAnswer }) {
  const markerPool = useMemo(() => {
    const target = structures.find((structure) => structure.id === question.answer);
    const others = structures.filter((structure) => structure.id !== question.answer).slice(0, 3);
    return target ? [target, ...others].sort((a, b) => a.y - b.y) : structures.slice(0, 4);
  }, [question.answer, structures]);

  return (
    <article className="label-quiz">
      <header>
        <h3>{question.prompt}</h3>
      </header>
      <div className="label-quiz__stage">
        <ArmSkeleton />
        {markerPool.map((structure, index) => (
          <button
            key={structure.id}
            type="button"
            style={{ left: `${structure.x}%`, top: `${structure.y}%` }}
            className={`${result?.selectedAnswer === structure.id ? 'is-selected' : ''} ${result?.correct && structure.id === question.answer ? 'is-correct' : ''}`}
            onClick={() => onAnswer(structure.id)}
            disabled={Boolean(result?.correct)}
            aria-label={`انتخاب نقطه ${toFa(index + 1)}`}
          >
            {toFa(index + 1)}
          </button>
        ))}
      </div>
      <QuestionFeedback result={result} />
    </article>
  );
}

const FLASHCARD_TYPES = [
  { id: 'basic', label: 'ساده' },
  { id: 'basic-hint', label: 'با راهنما' },
  { id: 'cloze', label: 'کلوز (جای خالی)' },
  { id: 'mcq', label: 'چهارگزینه‌ای' },
];

/* ساخت فلش‌کارت از همین واحد — با همان استانداردهای بخش فلش‌کارت: نوع کارت، صورت/پاسخ،
   راهنما، تگ، گزینه‌های کارت چهارگزینه‌ای و source از نوع lesson برای برگشت به همین واحد. */
function UnitFlashcards({ course, unit, userId, deckId, onDeckCreated }) {
  const [type, setType] = useState('basic');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [hint, setHint] = useState('');
  const [tags, setTags] = useState('');
  const [optionLines, setOptionLines] = useState('');
  const [correctIndex, setCorrectIndex] = useState(0);
  const [state, setState] = useState('idle'); /* idle | saving | saved | error */

  const options = optionLines.split('\n').map((line) => line.trim()).filter(Boolean);
  const needsBack = type !== 'cloze' && type !== 'mcq';
  const ready = front.trim() && (!needsBack || back.trim()) && (type !== 'mcq' || options.length >= 2);

  const save = async () => {
    if (!ready || state === 'saving') return;
    setState('saving');
    try {
      let targetDeck = deckId;
      if (!targetDeck) {
        const deck = await createDeck({ id: userId }, {
          title: `فلش‌کارت‌های ${unit.title}`,
          description: `ساخته‌شده از واحد «${unit.title}» در درسنامهٔ ${course.title}`,
          subjectId: course.id,
        });
        targetDeck = deck.id;
        onDeckCreated?.(deck.id);
      }

      await createCard({ id: userId }, targetDeck, {
        type,
        front,
        back,
        hint: type === 'basic-hint' ? hint : null,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        subjectId: course.id,
        topicId: unit.moduleId,
        source: { sourceType: 'lesson', sourceId: `${course.id}:${unit.id}`, title: unit.title, url: null },
        ...(type === 'mcq'
          ? { options: options.map((text, index) => ({ text, correct: index === correctIndex })) }
          : {}),
      });

      setFront('');
      setBack('');
      setHint('');
      setTags('');
      setOptionLines('');
      setState('saved');
    } catch {
      setState('error');
    }
  };

  return (
    <section className="unit-flashcards">
      <header>
        <h3>فلش‌کارت این واحد</h3>
        <p>کارت‌ها در مجموعهٔ «فلش‌کارت‌های {unit.title}» ذخیره می‌شوند و به همین واحد وصل می‌مانند.</p>
      </header>

      <div className="unit-flashcards__types">
        {FLASHCARD_TYPES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === type ? 'is-active' : ''}
            aria-pressed={item.id === type}
            onClick={() => setType(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="unit-field">
        <span>{type === 'cloze' ? 'صورت کارت (جای خالی را با {{c1::…}} بنویس)' : 'صورت کارت'}</span>
        <textarea rows={2} value={front} onChange={(event) => setFront(event.target.value)} />
      </label>

      {type === 'basic-hint' && (
        <label className="unit-field">
          <span>راهنما</span>
          <input type="text" value={hint} onChange={(event) => setHint(event.target.value)} />
        </label>
      )}

      {type === 'mcq' ? (
        <>
          <label className="unit-field">
            <span>گزینه‌ها (هر خط یک گزینه)</span>
            <textarea rows={4} value={optionLines} onChange={(event) => setOptionLines(event.target.value)} />
          </label>
          <label className="unit-field">
            <span>شمارهٔ گزینهٔ درست</span>
            <select value={correctIndex} onChange={(event) => setCorrectIndex(Number(event.target.value))}>
              {options.map((option, index) => (
                <option key={`${option}-${index}`} value={index}>{toFa(index + 1)} — {option}</option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="unit-field">
          <span>{type === 'cloze' ? 'توضیح پاسخ (اختیاری)' : 'پاسخ کارت'}</span>
          <textarea rows={2} value={back} onChange={(event) => setBack(event.target.value)} />
        </label>
      )}

      <label className="unit-field">
        <span>تگ‌ها (با کاما جدا کن)</span>
        <input type="text" value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>

      <div className="unit-flashcards__actions">
        <button type="button" className="learn-button learn-button--primary" onClick={save} disabled={!ready || state === 'saving'}>
          {state === 'saving' ? 'در حال ذخیره…' : 'افزودن کارت'}
        </button>
        {state === 'saved' && <small className="is-ok">کارت در مجموعهٔ این واحد ذخیره شد.</small>}
        {state === 'error' && <small className="is-error">ذخیره نشد؛ دوباره تلاش کن.</small>}
      </div>
    </section>
  );
}

/* آزمون از این واحد — حالت آزمون: بدون بازخورد لحظه‌ای، با تایمر و کارنامهٔ کوتاه. */
function UnitExam({ questions }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (finished) return undefined;
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [finished]);

  const question = questions[index];
  const correctCount = questions.filter((item) => answers[item.id] === item.answer).length;
  const percent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const answeredCount = Object.keys(answers).length;

  const restart = () => {
    setAnswers({});
    setIndex(0);
    setElapsed(0);
    setFinished(false);
  };

  if (!questions.length) {
    return <p className="unit-exam__empty">برای این واحد سؤالی ثبت نشده است.</p>;
  }

  if (finished) {
    return (
      <section className="unit-exam">
        <header className="unit-exam__result">
          <div className="unit-test__score" style={{ '--score': `${percent * 3.6}deg` }}>
            <strong>{toFa(percent)}٪</strong>
            <span>نتیجه آزمون</span>
          </div>
          <div>
            <h3>به {toFa(correctCount)} سؤال از {toFa(questions.length)} سؤال درست پاسخ دادی.</h3>
            <p>زمان آزمون: {toFa(Math.floor(elapsed / 60))}:{toFa(String(elapsed % 60).padStart(2, '0'))}</p>
          </div>
        </header>

        <ul className="unit-exam__review">
          {questions.map((item) => {
            const correctOption = item.options.find((option) => option.id === item.answer);
            const givenOption = item.options.find((option) => option.id === answers[item.id]);
            const isRight = answers[item.id] === item.answer;
            return (
              <li key={item.id} className={isRight ? 'is-correct' : 'is-wrong'}>
                <b>{item.question || item.prompt}</b>
                <p>پاسخ تو: {givenOption?.label ?? 'بی‌پاسخ'}</p>
                {!isRight && <p>پاسخ درست: {correctOption?.label}</p>}
              </li>
            );
          })}
        </ul>

        <div className="unit-exam__actions">
          <button type="button" className="learn-button learn-button--primary" onClick={restart}>آزمون دوباره</button>
        </div>
      </section>
    );
  }

  return (
    <section className="unit-exam">
      <header className="unit-exam__bar">
        <span>سؤال {toFa(index + 1)} از {toFa(questions.length)}</span>
        <span className="unit-exam__timer">
          {toFa(Math.floor(elapsed / 60))}:{toFa(String(elapsed % 60).padStart(2, '0'))}
        </span>
      </header>

      <h3 className="unit-exam__prompt">{question.question || question.prompt}</h3>

      <div className="unit-exam__options">
        {question.options.map((option, optionIndex) => (
          <button
            key={option.id}
            type="button"
            className={answers[question.id] === option.id ? 'is-selected' : ''}
            aria-pressed={answers[question.id] === option.id}
            onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
          >
            <span>{toFa(optionIndex + 1)}</span>
            {option.label}
          </button>
        ))}
      </div>

      <div className="unit-exam__actions">
        <button
          type="button"
          className="learn-button learn-button--quiet"
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
          disabled={index === 0}
        >
          سؤال قبلی
        </button>
        <small>{toFa(answeredCount)} پاسخ ثبت شده</small>
        {index < questions.length - 1 ? (
          <button
            type="button"
            className="learn-button learn-button--primary"
            onClick={() => setIndex((current) => Math.min(questions.length - 1, current + 1))}
          >
            سؤال بعدی
          </button>
        ) : (
          <button type="button" className="learn-button learn-button--primary" onClick={() => setFinished(true)}>
            پایان آزمون
          </button>
        )}
      </div>
    </section>
  );
}

/* مرحلهٔ «تست» = میز کنش‌ها: تست‌های بخش، دفترچهٔ مرور، آزمون واحد، فلش‌کارت، تپش هوشمند. */
export function UnitTest({
  course,
  unit,
  unitState,
  userId,
  onOpenTests,
  onOpenNotes,
  onAskAI,
  onToggleReview,
  onDeckCreated,
  inReview,
}) {
  const [panel, setPanel] = useState(null); /* null | exam | flashcards */

  const questions = [
    ...(unit.learning.practice ?? []),
    ...(unit.learning.labelQuiz
      ? [{
          ...unit.learning.labelQuiz,
          question: unit.learning.labelQuiz.prompt,
          options: (unit.learning.visualize?.structures ?? []).map((structure) => ({ id: structure.id, label: structure.label })),
        }]
      : []),
  ];

  /* هر کنش رنگِ بخش مقصدش را می‌گیرد: تست‌ها سبز، مرور آبی، آزمون طلایی، فلش‌کارت بنفش، تپش هوشمند مسی. */
  const actions = [
    {
      id: 'tests',
      accent: 'green',
      icon: '✓',
      title: 'تست‌های این بخش',
      hint: `${toFa(questions.length)} سؤال چهارگزینه‌ای و برچسب‌گذاری همین واحد؛ پاسخ‌ها با توضیح بلافاصله باز می‌شوند.`,
      label: 'زدن تست‌ها',
      onClick: onOpenTests,
    },
    {
      id: 'review',
      accent: 'blue',
      icon: '↻',
      title: 'دفترچهٔ مرور',
      hint: inReview
        ? 'این واحد در دفترچهٔ مرور ثبت شده و طبق برنامهٔ G5 به تو یادآوری می‌شود.'
        : 'این واحد را به مرورهای فاصله‌دار G5 اضافه کن تا فراموشش نکنی.',
      label: inReview ? 'حذف از دفترچهٔ مرور' : 'افزودن به دفترچهٔ مرور',
      onClick: onToggleReview,
    },
    {
      id: 'exam',
      accent: 'gold',
      icon: '◷',
      title: 'آزمون از این واحد',
      hint: 'حالت آزمون: بدون بازخورد لحظه‌ای، با تایمر و کارنامهٔ کوتاه در پایان.',
      label: panel === 'exam' ? 'بستن آزمون' : 'شروع آزمون',
      onClick: () => setPanel((current) => (current === 'exam' ? null : 'exam')),
    },
    {
      id: 'flashcards',
      accent: 'purple',
      icon: '▤',
      title: 'ساخت فلش‌کارت',
      hint: 'کارت استاندارد تپش (ساده، با راهنما، کلوز یا چهارگزینه‌ای) با اتصال به همین واحد.',
      label: panel === 'flashcards' ? 'بستن' : 'ساخت فلش‌کارت',
      onClick: () => setPanel((current) => (current === 'flashcards' ? null : 'flashcards')),
    },
    {
      id: 'ai',
      accent: 'copper',
      icon: '✦',
      title: 'پرس‌وجو با تپش هوشمند',
      hint: 'ابهام همین واحد را با پرامپت آماده از هوش مصنوعی بپرس و جواب بگیر.',
      label: 'پرسیدن از تپش',
      onClick: onAskAI,
    },
  ];

  return (
    <div className="unit-test">
      <div className="unit-actions">
        {actions.map((action) => (
          <article key={action.id} className={`unit-action unit-action--${action.accent}`}>
            <span className="unit-action__icon" aria-hidden="true">{action.icon}</span>
            <div className="unit-action__copy">
              <h3>{action.title}</h3>
              <p>{action.hint}</p>
            </div>
            <button type="button" className="learn-button learn-button--soft" onClick={action.onClick}>
              {action.label}
            </button>
          </article>
        ))}
      </div>

      {panel === 'exam' && <UnitExam questions={questions} />}

      {panel === 'flashcards' && (
        <UnitFlashcards
          course={course}
          unit={unit}
          userId={userId}
          deckId={unitState.flashcardDeckId}
          onDeckCreated={onDeckCreated}
        />
      )}
    </div>
  );
}

