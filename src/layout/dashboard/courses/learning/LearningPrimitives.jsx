import { toFa } from './learningUtils';

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
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <nav className="learning-stepper" aria-label="مراحل الگوریتم یادگیری">
      <div className="learning-stepper__track">
        {steps.map((step, index) => {
          const completed = completedSteps.includes(step.id);
          const active = step.id === currentStep;
          const reachable = completed || active || index <= currentIndex;
          return (
            <button
              key={step.id}
              type="button"
              className={`learning-stepper__step ${active ? 'is-active' : ''} ${completed ? 'is-complete' : ''}`}
              aria-current={active ? 'step' : undefined}
              disabled={!reachable}
              onClick={() => reachable && onStepSelect?.(step.id)}
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

export function LearningStep({ step, kicker, title, description, children, aside }) {
  return (
    <section className="learning-step" aria-labelledby={`learning-step-${step.id}`}>
      <header className="learning-step__header">
        <div>
          {kicker && <span className="learning-step__kicker">{kicker}</span>}
          <h2 id={`learning-step-${step.id}`}>{title || step.label}</h2>
          {description && <p>{description}</p>}
        </div>
        {aside}
      </header>
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

export function RecommendationCard({ recommendation, onAction, compact = false }) {
  if (!recommendation) return null;
  return (
    <aside className={`recommendation-card recommendation-card--${recommendation.type} ${compact ? 'recommendation-card--compact' : ''}`}>
      <span className="recommendation-card__spark" aria-hidden="true">✦</span>
      <div>
        <small>{recommendation.eyebrow}</small>
        <h3>{recommendation.title}</h3>
        <p>{recommendation.description}</p>
      </div>
      {onAction && (
        <button type="button" className="learn-button learn-button--soft" onClick={onAction}>
          {recommendation.action}
          <span aria-hidden="true">←</span>
        </button>
      )}
    </aside>
  );
}

export function LearningNavigation({
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  canContinue = true,
  isLast = false,
  hint,
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
      <div className="learning-navigation__hint" role="status">
        {!canContinue && (hint || 'برای ادامه، فعالیت کوتاه این مرحله را انجام بده.')}
      </div>
      <button
        type="button"
        className="learn-button learn-button--primary learning-navigation__next"
        onClick={onNext}
        disabled={!canContinue}
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
