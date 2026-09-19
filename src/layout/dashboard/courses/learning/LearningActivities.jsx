import { useMemo, useRef, useState } from 'react';
import { CONCEPT_STATUSES } from '../../../../data/learning/anatomyCourse';
import { RecommendationCard } from './LearningPrimitives';
import { clamp, getConceptStatus, toFa } from './learningUtils';

export function PriorKnowledgeActivation({ data, activityState, onChange }) {
  const [visibleHint, setVisibleHint] = useState(null);
  const responses = activityState.recallResponses ?? {};
  const acknowledged = Boolean(activityState.acknowledgedSteps?.activate);

  const updateResponse = (promptId, value) => {
    onChange({ recallResponses: { ...responses, [promptId]: value } });
  };

  return (
    <div className="activate-panel">
      <div className="activate-panel__intro">
        <span aria-hidden="true">؟</span>
        <p>{data.intro}</p>
      </div>
      <div className="activate-panel__prompts">
        {data.prompts.map((item, index) => (
          <article className="recall-card" key={item.id}>
            <header>
              <span>{toFa(index + 1)}</span>
              <h3>{item.prompt}</h3>
            </header>
            <label htmlFor={item.id}>آنچه الان به یاد می‌آوری</label>
            <textarea
              id={item.id}
              value={responses[item.id] ?? ''}
              onChange={(event) => updateResponse(item.id, event.target.value)}
              placeholder="پاسخت را کوتاه و بدون جست‌وجو بنویس…"
              rows="3"
            />
            <button
              type="button"
              className="learn-text-button"
              aria-expanded={visibleHint === item.id}
              onClick={() => setVisibleHint(visibleHint === item.id ? null : item.id)}
            >
              {visibleHint === item.id ? 'بستن راهنما' : 'یک سرنخ کوچک'}
            </button>
            {visibleHint === item.id && <p className="recall-card__hint">{item.hint}</p>}
          </article>
        ))}
      </div>
      <button
        type="button"
        className={`learning-check ${acknowledged ? 'is-checked' : ''}`}
        onClick={() => onChange({
          acknowledgedSteps: { ...activityState.acknowledgedSteps, activate: !acknowledged },
        })}
      >
        <span aria-hidden="true">{acknowledged ? '✓' : ''}</span>
        برای مقایسه دانسته قبلی با آموزش آماده‌ام
      </button>
    </div>
  );
}

export function ConceptCard({ title, description, meta, status, mastery }) {
  const statusMeta = getConceptStatus(status);
  return (
    <article className="concept-card">
      <header>
        <h4>{title}</h4>
        {status && <span className={`status-pill status-pill--${statusMeta.tone}`}>{statusMeta.label}</span>}
      </header>
      {description && <p>{description}</p>}
      {typeof mastery === 'number' && (
        <div className="concept-card__mastery">
          <span><i style={{ width: `${mastery}%` }} /></span>
          <b>{toFa(mastery)}٪</b>
        </div>
      )}
      {meta && <small>{meta}</small>}
    </article>
  );
}

export function MicroLesson({ lessons, activityState, onChange }) {
  const activeIndex = clamp(activityState.currentLesson ?? 0, 0, lessons.length - 1);
  const lesson = lessons[activeIndex];
  const completedLessons = activityState.completedLessons ?? [];
  const isCompleted = completedLessons.includes(lesson.id);

  const selectLesson = (index) => {
    onChange(
      { currentLesson: index },
      { lessonIndex: index, detail: `میکرودرس ${toFa(index + 1)}: ${lessons[index].title}` },
    );
  };

  const toggleComplete = () => {
    const nextCompleted = isCompleted
      ? completedLessons.filter((lessonId) => lessonId !== lesson.id)
      : [...new Set([...completedLessons, lesson.id])];
    onChange({ completedLessons: nextCompleted });
    if (!isCompleted && activeIndex < lessons.length - 1) selectLesson(activeIndex + 1);
  };

  return (
    <div className="micro-lesson-layout">
      <aside className="micro-lesson-nav" aria-label="فهرست میکرودرس‌ها">
        <header>
          <strong>{toFa(completedLessons.length)} از {toFa(lessons.length)} کامل</strong>
        </header>
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
          <div>
            <small>میکرودرس {toFa(activeIndex + 1)}</small>
            <h3>{lesson.title}</h3>
          </div>
          <span>{toFa(activeIndex + 1)} / {toFa(lessons.length)}</span>
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

        <button
          type="button"
          className={`learning-check ${isCompleted ? 'is-checked' : ''}`}
          onClick={toggleComplete}
        >
          <span aria-hidden="true">{isCompleted ? '✓' : ''}</span>
          {isCompleted ? 'این میکرودرس تکمیل شده' : 'مفهوم را فهمیدم؛ ثبت شود'}
        </button>
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

export function ConceptMap({ relations, activityState, onChange }) {
  const [activeMap, setActiveMap] = useState(relations[0]?.id);
  const acknowledged = Boolean(activityState.acknowledgedSteps?.connect);
  return (
    <div className="concept-map-panel">
      <div className="concept-map-panel__tabs" role="tablist" aria-label="نقشه‌های ارتباط مفاهیم">
        {relations.map((relation) => (
          <button
            key={relation.id}
            type="button"
            role="tab"
            aria-selected={activeMap === relation.id}
            className={activeMap === relation.id ? 'is-active' : ''}
            onClick={() => setActiveMap(relation.id)}
          >
            {relation.title}
          </button>
        ))}
      </div>
      {relations.filter((relation) => relation.id === activeMap).map((relation) => (
        <section className="concept-map" key={relation.id} aria-label={relation.title}>
          <header>
            <h3>{relation.title}</h3>
          </header>
          <div className="concept-map__flow">
            {relation.nodes.map((node, index) => (
              <div key={`${node}-${index}`}>
                <span>{toFa(index + 1)}</span>
                <b>{node}</b>
                {index < relation.nodes.length - 1 && <i aria-hidden="true">←</i>}
              </div>
            ))}
          </div>
          <p>هر فلش را با جمله «باعث می‌شود / مرتبط است با» برای خودت توضیح بده.</p>
        </section>
      ))}
      <button
        type="button"
        className={`learning-check ${acknowledged ? 'is-checked' : ''}`}
        onClick={() => onChange({
          acknowledgedSteps: { ...activityState.acknowledgedSteps, connect: !acknowledged },
        })}
      >
        <span aria-hidden="true">{acknowledged ? '✓' : ''}</span>
        حداقل یک زنجیره را با صدای بلند توضیح دادم
      </button>
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

export function PracticeQuestion({ question, index, result, onAnswer }) {
  return (
    <article className="practice-question">
      <header>
        <div>
          <small>سؤال {toFa(index + 1)}</small>
          <h3>{question.question}</h3>
        </div>
        <span>{question.difficulty === 'clinical' ? 'بالینی' : 'مفهومی'}</span>
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
        <div>
          <h3>{question.prompt}</h3>
        </div>
        <span>یک نقطه را انتخاب کن</span>
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

export function RetrievalPrompt({ prompts, activityState, onChange }) {
  const [revealed, setRevealed] = useState({});
  const responses = activityState.retrievalResponses ?? {};

  const updateResponse = (promptId, patch) => {
    onChange({
      retrievalResponses: {
        ...responses,
        [promptId]: {
          text: '',
          confidence: 50,
          ...(responses[promptId] ?? {}),
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  return (
    <div className="retrieval-panel">
      <div className="retrieval-panel__notice">
        <span aria-hidden="true">↺</span>
        <p><b>کتاب را ببند.</b> هدف این مرحله تولید پاسخ کامل نیست؛ تلاش برای بازیابی، خودش حافظه را قوی می‌کند.</p>
      </div>
      {prompts.map((prompt, index) => {
        const response = responses[prompt.id] ?? { text: '', confidence: 50 };
        return (
          <article className="retrieval-card" key={prompt.id}>
            <header>
              <span>{toFa(index + 1)}</span>
              <h3>{prompt.prompt}</h3>
            </header>
            <textarea
              value={response.text}
              onChange={(event) => updateResponse(prompt.id, { text: event.target.value })}
              placeholder="پاسخ را از حافظه بازسازی کن…"
              rows="4"
            />
            <div className="retrieval-card__confidence">
              <label htmlFor={`${prompt.id}-confidence`}>اعتماد به پاسخ: <b>{toFa(response.confidence)}٪</b></label>
              <input
                id={`${prompt.id}-confidence`}
                type="range"
                min="0"
                max="100"
                step="10"
                value={response.confidence}
                onChange={(event) => updateResponse(prompt.id, { confidence: Number(event.target.value) })}
              />
            </div>
            <button
              type="button"
              className="learn-text-button"
              disabled={!response.text.trim()}
              onClick={() => setRevealed((current) => ({ ...current, [prompt.id]: !current[prompt.id] }))}
            >
              {revealed[prompt.id] ? 'پنهان‌کردن مدل پاسخ' : 'مقایسه با مدل پاسخ'}
            </button>
            {revealed[prompt.id] && (
              <aside className="retrieval-card__answer">
                <small>مدل پاسخ</small>
                <p>{prompt.modelAnswer}</p>
                <span>کلماتت لازم نیست عین همین باشد؛ رابطه‌های درست مهم‌اند.</span>
              </aside>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function LearningDiagnosis({ diagnosis, activityState, onChange }) {
  const acknowledged = Boolean(activityState.acknowledgedSteps?.diagnose);
  if (!diagnosis) return null;
  return (
    <div className="diagnosis-panel">
      <section className="diagnosis-panel__summary">
        <div className="diagnosis-panel__score" style={{ '--score': `${diagnosis.mastery * 3.6}deg` }}>
          <strong>{toFa(diagnosis.mastery)}٪</strong>
          <span>تسلط فعلی</span>
        </div>
        <div>
          <h3>{diagnosis.message}</h3>
          <p>این نتیجه از پاسخ‌ها، تعداد تلاش، زمان پاسخ و اعتماد اعلام‌شده ساخته شده است.</p>
        </div>
      </section>

      <div className="diagnosis-panel__metrics">
        <article><span>دقت</span><strong>{toFa(diagnosis.accuracy)}٪</strong></article>
        <article><span>تعداد تلاش</span><strong>{toFa(diagnosis.attempts)}</strong></article>
        <article><span>میانگین پاسخ</span><strong>{toFa(diagnosis.averageResponseTime)} ثانیه</strong></article>
        <article><span>اعتماد</span><strong>{toFa(diagnosis.confidence)}٪</strong></article>
        <article><span>خطا</span><strong>{toFa(diagnosis.mistakeCount)}</strong></article>
      </div>

      <section className="diagnosis-panel__concepts">
        <header>
          <div>
            <small>وضعیت مفهوم‌ها</small>
            <h3>نقشه تسلط</h3>
          </div>
          <span>از {CONCEPT_STATUSES.WEAK} تا {CONCEPT_STATUSES.MASTERED}</span>
        </header>
        <div>
          {(diagnosis.concepts.length ? diagnosis.concepts : diagnosis.weakConcepts).map((concept) => (
            <ConceptCard
              key={concept.conceptId}
              title={concept.title}
              description={`${CONCEPT_STATUSES[concept.status]} · ${toFa(concept.mistakeCount)} خطا`}
              status={concept.status}
              mastery={concept.mastery}
              meta={`مرور بعدی بر اساس فاصله‌گذاری تنظیم می‌شود`}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        className={`learning-check ${acknowledged ? 'is-checked' : ''}`}
        onClick={() => onChange({
          acknowledgedSteps: { ...activityState.acknowledgedSteps, diagnose: !acknowledged },
        })}
      >
        <span aria-hidden="true">{acknowledged ? '✓' : ''}</span>
        تشخیص را دیدم و می‌دانم چه چیزی نیاز به مرور دارد
      </button>
    </div>
  );
}

export function ReviewPanel({ unit, unitState, recommendation, onReview, onExam }) {
  const [flippedCards, setFlippedCards] = useState([]);
  const diagnosis = unitState.diagnosis;
  const mistakes = Object.values(unitState.practiceResults ?? {}).filter((result) => !result.correct);
  const weakConcepts = diagnosis?.weakConcepts ?? [];

  const toggleCard = (cardId) => {
    setFlippedCards((cards) => cards.includes(cardId) ? cards.filter((id) => id !== cardId) : [...cards, cardId]);
  };

  return (
    <div className="review-panel">
      <section className="review-panel__summary">
        <small>خلاصه واحد</small>
        <h3>تصویر بزرگ را یک بار دیگر ببین</h3>
        <p>{unit.learning.review.summary}</p>
        <div className="learning-tags">
          {unit.learning.review.keyConcepts.map((concept) => <span key={concept}>{concept}</span>)}
        </div>
      </section>

      <div className="review-panel__grid">
        <section>
          <header><span aria-hidden="true">!</span><h3>خطاها و نقاط مرور</h3></header>
          {mistakes.length || weakConcepts.length ? (
            <ul>
              {mistakes.map((mistake) => <li key={mistake.questionId}>{mistake.explanation}</li>)}
              {weakConcepts.map((concept) => <li key={concept.conceptId}>مرور دوباره «{concept.title}»</li>)}
            </ul>
          ) : <p>خطای ثبت‌شده‌ای باقی نمانده؛ برای تثبیت، یک بازیابی کوتاه انجام بده.</p>}
        </section>
        <section>
          <header><span aria-hidden="true">↺</span><h3>سؤال‌های بازیابی منتخب</h3></header>
          <ol>
            {unit.learning.review.selectedQuestions.map((question) => <li key={question}>{question}</li>)}
          </ol>
        </section>
      </div>

      <section className="review-panel__flashcards">
        <header>
          <div><h3>سه کارت برای تثبیت</h3></div>
          <span>برای دیدن پاسخ روی کارت بزن</span>
        </header>
        <div>
          {unit.learning.review.flashcards.map((card) => {
            const flipped = flippedCards.includes(card.id);
            return (
              <button
                type="button"
                key={card.id}
                className={flipped ? 'is-flipped' : ''}
                onClick={() => toggleCard(card.id)}
                aria-pressed={flipped}
              >
                <small>{flipped ? 'پاسخ' : 'پرسش'}</small>
                <strong>{flipped ? card.back : card.front}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <RecommendationCard recommendation={recommendation} compact />

      <div className="review-panel__actions">
        <button type="button" className="learn-button learn-button--soft" onClick={onReview}>مرور این واحد</button>
        <button type="button" className="learn-button learn-button--primary" onClick={onExam}>آزمون واحد</button>
      </div>
    </div>
  );
}
