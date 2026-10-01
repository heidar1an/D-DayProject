import { useState } from 'react';
import { toFa } from './learningUtils';
import { createNote } from '../../../../services/notes/notesService';
import { FEEDBACK_SOURCES, sendFeedback } from '../../../../services/feedback/userFeedback';

export function LearningProgress({ value = 0, label = 'پیشرفت', detail, compact = false }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`learn-progress ${compact ? 'learn-progress--compact' : ''}`}>
      <div className="learn-progress__header">
        <span>{label}</span>
        <strong>{toFa(safeValue)}٪</strong>
      </div>
      <span
        className="learn-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={safeValue}
      >
        <span className="learn-progress__fill" style={{ '--progress': `${safeValue}%` }} />
      </span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function MasteryIndicator({ value = 0, size = 'regular', label = 'تسلط تخمینی' }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`mastery-indicator mastery-indicator--${size}`}>
      <span className="mastery-indicator__ring" style={{ '--mastery': `${safeValue * 3.6}deg` }}>
        <strong>{toFa(safeValue)}٪</strong>
      </span>
      <span className="mastery-indicator__label">{label}</span>
    </div>
  );
}

export function LearningObjective({ children, index }) {
  return (
    <li className="learning-objective">
      <span>{toFa(index + 1)}</span>
      <p>{children}</p>
    </li>
  );
}

export function LearningStepper({ steps, currentStep, completedSteps, onStepSelect }) {
  return (
    <nav className="learning-stepper" aria-label="مراحل الگوریتم یادگیری">
      <div className="learning-stepper__track">
        {steps.map((step, index) => {
          const completed = completedSteps.includes(step.id);
          const active = step.id === currentStep;
          return (
            <button
              key={step.id}
              type="button"
              className={`learning-stepper__step ${active ? 'is-active' : ''} ${completed ? 'is-complete' : ''}`}
              aria-current={active ? 'step' : undefined}
              onClick={() => onStepSelect?.(step.id)}
              title={step.action}
            >
              <span className="learning-stepper__number" aria-hidden="true">
                {completed ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 4 4 10-10" />
                  </svg>
                ) : toFa(index + 1)}
              </span>
              <span className="learning-stepper__copy">
                <b>{step.label}</b>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* قاب مرحله: بدون سرتیتر — محتوای هر مرحله خودش گویاست و عنوان مرحله در نوار بالا هست. */
export function LearningStep({ step, children }) {
  return (
    <section className="learning-step" aria-label={step.label}>
      <div className="learning-step__body">{children}</div>
    </section>
  );
}

export function ContinueLearning({ location, onContinue, onRestart, compact = false }) {
  if (!location) return null;
  return (
    <aside className={`continue-learning ${compact ? 'continue-learning--compact' : ''}`}>
      <span className="continue-learning__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 5.5v13L19 12z" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <div className="continue-learning__copy">
        <small>ادامه از آخرین نقطه</small>
        <strong>{location.unitTitle}</strong>
        <p>آخرین بار در {location.detail || location.stepLabel || 'مسیر یادگیری'} بودی.</p>
      </div>
      <div className="continue-learning__actions">
        <button type="button" className="learn-button learn-button--primary" onClick={onContinue}>
          ادامه یادگیری
        </button>
        {onRestart && (
          <button type="button" className="learn-button learn-button--quiet" onClick={onRestart}>
            شروع از ابتدا
          </button>
        )}
      </div>
    </aside>
  );
}

export function LearningNavigation({
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  isLast = false,
}) {
  return (
    <footer className="learning-navigation">
      <button
        type="button"
        className="learn-button learn-button--quiet learning-navigation__previous"
        onClick={onPrevious}
        disabled={!onPrevious}
      >
        <span aria-hidden="true">→</span>
        {previousLabel || 'مرحله قبلی'}
      </button>
      <button
        type="button"
        className="learn-button learn-button--primary learning-navigation__next"
        onClick={onNext}
      >
        {isLast ? 'تکمیل واحد' : nextLabel || 'ثبت و مرحله بعد'}
        <span aria-hidden="true">←</span>
      </button>
    </footer>
  );
}

export function LearningStatePanel({ state, title, description, onRetry }) {
  return (
    <div className={`learning-state learning-state--${state}`} role={state === 'error' ? 'alert' : 'status'}>
      {state === 'loading' ? (
        <span className="learning-state__loader" aria-hidden="true" />
      ) : (
        <span className="learning-state__icon" aria-hidden="true">{state === 'error' ? '!' : '—'}</span>
      )}
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && (
        <button type="button" className="learn-button learn-button--soft" onClick={onRetry}>
          تلاش دوباره
        </button>
      )}
    </div>
  );
}

export function Breadcrumb({ items }) {
  return (
    <nav className="learning-breadcrumb" aria-label="مسیر صفحه">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.onClick ? (
              <button type="button" onClick={item.onClick}>{item.label}</button>
            ) : (
              <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
            )}
            {index < items.length - 1 && <i aria-hidden="true">←</i>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* یادداشت این مرحله — پاپ‌آپ شناور کنار ردیف بالای واحد؛ روی محتوای مرحله نمی‌افتد.
   یادداشت با همان قرارداد سرویس یادداشت ساخته می‌شود و بلافاصله در بخش «یادداشت‌ها» می‌نشیند. */
export function UnitNotes({ open, onClose, userId, courseId, unitTitle, onOpenNotes }) {
  const [title, setTitle] = useState(`${unitTitle} — یادداشت`);
  const [body, setBody] = useState('');
  const [state, setState] = useState('idle'); /* idle | saving | saved | error */

  if (!open) return null;

  const save = async () => {
    if (!body.trim() || state === 'saving') return;
    setState('saving');
    try {
      await createNote({ id: userId }, {
        title,
        kind: 'text',
        body,
        subjectId: courseId,
        tags: ['یادداشت درس'],
        sourceType: 'lesson',
        sourceTitle: unitTitle,
      });
      setBody('');
      setState('saved');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="unit-pop" role="dialog" aria-label="یادداشت این مرحله">
      <header className="unit-pop__head">
        <b>یادداشت این مرحله</b>
        {state === 'saved' && <em>ذخیره شد</em>}
        <button type="button" className="unit-pop__close" onClick={onClose} aria-label="بستن یادداشت">×</button>
      </header>
      <div className="unit-pop__body">
        <input
          type="text"
          aria-label="عنوان یادداشت"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="عنوان یادداشت"
        />
        <textarea
          rows={5}
          aria-label="متن یادداشت"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (state !== 'saving') setState('idle');
          }}
          placeholder="نکته‌ای که می‌خواهی بماند…"
        />
        <div className="unit-notes__actions">
          <button
            type="button"
            className="learn-button learn-button--primary"
            onClick={save}
            disabled={!body.trim() || state === 'saving'}
          >
            {state === 'saving' ? 'در حال ذخیره…' : 'افزودن به یادداشت‌ها'}
          </button>
          <button type="button" className="learn-button learn-button--quiet" onClick={onOpenNotes}>
            مشاهدهٔ یادداشت‌ها
          </button>
        </div>
        {state === 'error' && <p className="unit-notes__error">ذخیره نشد؛ دوباره تلاش کن.</p>}
      </div>
    </div>
  );
}

const REPORT_KINDS = ['گزارش اشکال محتوایی', 'خطای فنی', 'پیشنهاد بهبود'];

/* گزارش ایراد/خطای همین واحد — هم رکورد محلی (tapesh:support-requests) می‌ماند و
   هم نسخهٔ سروری با منبع دقیق (درسنامه جامع / میکرو درسنامه) می‌رود تا پنل ببیندش. */
export function UnitReport({ open, onClose, courseTitle, unitTitle, source, meta }) {
  const [kind, setKind] = useState(REPORT_KINDS[0]);
  const [note, setNote] = useState('');
  const [state, setState] = useState('idle'); /* idle | sent | error */

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!note.trim() || state === 'sending') return;
    setState('sending');

    try {
      const stored = JSON.parse(window.localStorage.getItem('tapesh:support-requests') || '[]');
      stored.push({
        subject: `گزارش ایراد — ${unitTitle}`,
        category: 'گزارش اشکال',
        message: `${kind}\n${note.trim()}\n\n— از واحد «${unitTitle}» در درسنامهٔ ${courseTitle}`,
        createdAt: new Date().toISOString(),
      });
      window.localStorage.setItem('tapesh:support-requests', JSON.stringify(stored));
    } catch {
      /* حافظهٔ محلی در دسترس نبود؛ ارسال سروری ادامه دارد */
    }

    const sent = await sendFeedback({
      source,
      subject: `گزارش ایراد — ${unitTitle}`,
      category: kind,
      message: `${note.trim()}\n\n— از واحد «${unitTitle}» در درسنامهٔ ${courseTitle}`,
      meta,
    });

    if (!sent) {
      setState('error');
      return;
    }

    setNote('');
    setState('sent');
  };

  return (
    <div className="unit-pop" role="dialog" aria-label="گزارش ایراد یا خطا">
      <header className="unit-pop__head">
        <b>گزارش ایراد یا خطا</b>
        {state === 'sent' && <em>ثبت شد</em>}
        <button type="button" className="unit-pop__close" onClick={onClose} aria-label="بستن گزارش">×</button>
      </header>
      <form className="unit-pop__body" onSubmit={submit}>
        <label className="unit-field">
          <span>نوع گزارش</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            {REPORT_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="unit-field">
          <span>توضیح</span>
          <textarea
            rows={4}
            aria-label="متن گزارش"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              if (state !== 'sending') setState('idle');
            }}
            placeholder={`چه ایرادی در «${unitTitle}» دیدی؟`}
          />
        </label>
        <div className="unit-notes__actions">
          <button type="submit" className="learn-button learn-button--primary" disabled={!note.trim()}>
            ارسال گزارش
          </button>
        </div>
        {state === 'error' && <p className="unit-notes__error">ثبت نشد؛ دوباره تلاش کن.</p>}
      </form>
    </div>
  );
}
