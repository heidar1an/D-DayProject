import { useMemo, useState } from 'react';
import { ContentService, ProgressService } from '../../../../services/learning';
import { formatMinutes, toFa } from './learningUtils';

/* هیروی وسط‌چین لایه — هم‌خانوادهٔ هیروی فلش‌کارت و درسنامه جامع */
export function AnatomyModuleHeader({ title, subtitle, eyebrow = 'درسنامه جامع · علوم پایه' }) {
  return (
    <header className="anatomy-hero">
      <h1 className="anatomy-hero__title">
        <span className="anatomy-hero__title-top">{eyebrow}</span>
        <span className="anatomy-hero__title-accent">{title}</span>
      </h1>
      {subtitle && <p className="anatomy-hero__subtitle">{subtitle}</p>}
    </header>
  );
}

/* کادر پپی‌شکل بخش — سبک چیپ‌های بانک تست؛ انتخاب هر کادر محتوایش را در ستون چپ نشان می‌دهد */
export function AnatomyModuleCard({ module, isActive = false, onSelect, style }) {
  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      className={`anatomy-module-card anatomy-module-card--${module.status}${isActive ? ' is-active' : ''}`}
      style={style}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.();
        }
      }}
    >
      <h3>{module.title}</h3>
      <b className={`anatomy-module-card__percent${module.progress >= 100 ? ' is-complete' : ''}`}>
        {toFa(module.progress)}٪
      </b>
    </article>
  );
}

/* کادر مربعی واحد — تایم بالا-راست، عنوان در مرکز، درصد پیشرفت بالا-چپ */
export function UnitCard({ unit, state, onOpen }) {
  return (
    <article className={`unit-card unit-card--${state.status}`}>
      <div className="unit-card__content">
        <header>
          <small className="unit-card__time">{formatMinutes(unit.estimatedTime)}</small>
          <b className="unit-card__progress-num">{toFa(state.progress)}٪</b>
        </header>
        <h3>{unit.title}</h3>
        <footer>
          <button type="button" className="learn-button learn-button--soft" onClick={() => onOpen(unit.id)}>
            {state.status === 'fresh' ? 'شروع واحد' : state.status === 'completed' ? 'مرور واحد' : 'ادامه یادگیری'}
            <span aria-hidden="true">←</span>
          </button>
        </footer>
      </div>
    </article>
  );
}

export function UnitList({ units, progressState, onOpenUnit }) {
  return (
    <div className="unit-list">
      {units.map((unit) => (
        <UnitCard
          key={unit.id}
          unit={unit}
          state={ProgressService.getUnitState(progressState, unit)}
          onOpen={onOpenUnit}
        />
      ))}
    </div>
  );
}

export default function AnatomyOverview({ course, progressState, initialModuleId, onBack, onOpenUnit }) {
  /* بخش انتخاب‌شده در ستون راست؛ محتوایش در ستون چپ رندر می‌شود */
  const [selectedId, setSelectedId] = useState(initialModuleId ?? 'upper-limb');
  const upperSummary = ProgressService.getModuleSummary(course, progressState, 'upper-limb');
  const modules = useMemo(
    () => course.modules.map((module) => module.id === 'upper-limb'
      ? {
          ...module,
          progress: Math.max(module.progress, upperSummary.progress),
          status: upperSummary.completed === upperSummary.total && upperSummary.total ? 'completed' : upperSummary.learning ? 'learning' : module.status,
        }
      : module),
    [course.modules, upperSummary.completed, upperSummary.learning, upperSummary.progress, upperSummary.total],
  );
  const selectedModule = modules.find((module) => module.id === selectedId) ?? modules[0];
  const selectedUnits = ContentService.getUnits(course, selectedModule.id);

  return (
    <section className="anatomy-overview">
      {/* نوار بالای لایه — هم‌خانوادهٔ درسنامه جامع و فلش‌کارت */}
      <div className="anatomy-topbar">
        <button className="anatomy-topbar__back" type="button" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به درسنامه
        </button>
      </div>

      <AnatomyModuleHeader title={course.title} subtitle={course.subtitle} />

      <div className="anatomy-split">
        {/* کادرهای بخش‌ها — ستون راست */}
        <div className="anatomy-split__cards" aria-label="بخش‌های آناتومی">
          {modules.map((module, index) => (
            <AnatomyModuleCard
              key={module.id}
              module={module}
              isActive={module.id === selectedModule.id}
              onSelect={() => setSelectedId(module.id)}
              style={{ '--stagger': index }}
            />
          ))}
        </div>

        {/* محتوای بخش انتخاب‌شده — ستون چپ (key باعث انیمیشن ورود با هر انتخاب است) */}
        <div className="anatomy-split__content" key={selectedModule.id}>
          {selectedUnits.length ? (
            <UnitList units={selectedUnits} progressState={progressState} onOpenUnit={onOpenUnit} />
          ) : (
            <div className="anatomy-catalog__empty">
              واحدهای این بخش هنوز منتشر نشده است؛ فعلاً از بخش‌های دیگر شروع کن.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
