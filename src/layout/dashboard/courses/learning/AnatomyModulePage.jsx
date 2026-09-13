import { useMemo, useState } from 'react';
import { ProgressService, RecommendationService } from '../../../../services/learning';
import {
  Breadcrumb,
  ContinueLearning,
  LearningProgress,
  MasteryIndicator,
  RecommendationCard,
} from './LearningPrimitives';
import { formatMinutes, getLearningStatus, toFa } from './learningUtils';

const UNIT_FILTERS = [
  { id: 'all', label: 'همه واحدها' },
  { id: 'learning', label: 'در حال یادگیری' },
  { id: 'completed', label: 'تکمیل‌شده' },
  { id: 'fresh', label: 'شروع‌نشده' },
];

export function UnitCard({ unit, state, onOpen }) {
  const statusMeta = getLearningStatus(state.status);
  return (
    <article className={`unit-card unit-card--${state.status}`}>
      <div className="unit-card__number">
        <small>UNIT</small>
        <strong>{toFa(String(unit.order).padStart(2, '0'))}</strong>
      </div>
      <div className="unit-card__content">
        <header>
          <div>
            <span className={`status-pill status-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
            <h3>{unit.title}</h3>
          </div>
          <MasteryIndicator value={state.mastery} size="small" label="تسلط" />
        </header>
        <p>{unit.description}</p>
        <div className="unit-card__meta">
          <span><b>{formatMinutes(unit.estimatedTime)}</b> زمان یادگیری</span>
          <span><b>{toFa(unit.sectionCount)}</b> مرحله محتوایی</span>
          <span><b>{toFa(unit.tests)}</b> تمرین و تست</span>
        </div>
        <LearningProgress value={state.progress} label="پیشرفت واحد" compact />
        <footer>
          <span><small>آخرین فعالیت</small>{state.lastActivity ? 'ذخیره‌شده در مسیر یادگیری' : unit.lastActivity}</span>
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

export default function AnatomyModulePage({ course, module, units, progressState, onBack, onCourseBack, onOpenUnit, onRestartUnit }) {
  const [filter, setFilter] = useState('all');
  const summary = ProgressService.getModuleSummary(course, progressState, module.id);
  const unitStates = useMemo(
    () => Object.fromEntries(units.map((unit) => [unit.id, ProgressService.getUnitState(progressState, unit)])),
    [progressState, units],
  );
  const visibleUnits = filter === 'all' ? units : units.filter((unit) => unitStates[unit.id].status === filter);
  const lastUnit = units.find((unit) => unit.id === progressState.lastLocation?.unitId) || units[0];
  const recommendation = RecommendationService.forCourse(course, progressState);

  return (
    <section className="anatomy-module-page">
      <Breadcrumb items={[
        { label: 'درسنامه جامع', onClick: onCourseBack },
        { label: 'آناتومی', onClick: onBack },
        { label: module.title },
      ]} />

      <header className="module-hero">
        <div className="module-hero__number">{toFa(String(module.order).padStart(2, '0'))}</div>
        <div className="module-hero__copy">
          <small>LEARNING MODULE</small>
          <h1>{module.title}</h1>
          <p>ساختار، روابط، عصب‌رسانی، خون‌رسانی و کاربردهای بالینی اندام فوقانی</p>
          <div className="learning-tags">
            <span>{toFa(units.length)} واحد آموزشی</span>
            <span>{toFa(units.reduce((sum, unit) => sum + unit.tests, 0))} تست و تمرین</span>
            <span>چرخه ۹ مرحله‌ای</span>
          </div>
        </div>
        <MasteryIndicator value={summary.mastery} label="تسلط این بخش" />
      </header>

      <section className="module-progress-overview" aria-labelledby="module-progress-title">
        <header>
          <div><small>PROGRESS OVERVIEW</small><h2 id="module-progress-title">نمای پیشرفت اندام فوقانی</h2></div>
          <LearningProgress value={summary.progress} label="پیشرفت کل بخش" compact />
        </header>
        <div>
          <article className="is-complete"><small>تکمیل‌شده</small><strong>{toFa(summary.completed)}</strong><span>واحد</span></article>
          <article className="is-learning"><small>در حال مطالعه</small><strong>{toFa(summary.learning)}</strong><span>واحد</span></article>
          <article><small>باقی‌مانده</small><strong>{toFa(summary.remaining)}</strong><span>واحد</span></article>
          <article><small>تسلط تخمینی</small><strong>{toFa(summary.mastery)}٪</strong><span>بر اساس عملکرد</span></article>
          <article className="module-progress-overview__last">
            <small>آخرین واحد مطالعه‌شده</small>
            <strong>{lastUnit.title}</strong>
            <span>{progressState.lastLocation?.detail || lastUnit.lastActivity}</span>
          </article>
        </div>
      </section>

      {progressState.lastLocation?.moduleId === module.id && (
        <ContinueLearning
          location={progressState.lastLocation}
          onContinue={() => onOpenUnit(progressState.lastLocation.unitId, progressState.lastLocation.stepId)}
          onRestart={() => onRestartUnit(lastUnit)}
          compact
        />
      )}

      <RecommendationCard
        recommendation={recommendation}
        compact
        onAction={() => onOpenUnit(recommendation.target?.unitId || lastUnit.id, recommendation.target?.stepId)}
      />

      <section className="units-catalog" aria-labelledby="units-title">
        <header className="anatomy-section-heading">
          <div>
            <small>UNIT ROADMAP</small>
            <h2 id="units-title">واحدهای آموزشی اندام فوقانی</h2>
            <p>هر واحد یک مسیر کامل از فعال‌سازی دانش قبلی تا تشخیص و مرور هوشمند دارد.</p>
          </div>
          <div className="anatomy-filters" role="tablist" aria-label="فیلتر واحدها">
            {UNIT_FILTERS.map((item) => {
              const count = item.id === 'all' ? units.length : units.filter((unit) => unitStates[unit.id].status === item.id).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={filter === item.id ? 'is-active' : ''}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}<span>{toFa(count)}</span>
                </button>
              );
            })}
          </div>
        </header>
        {visibleUnits.length ? (
          <UnitList units={visibleUnits} progressState={progressState} onOpenUnit={onOpenUnit} />
        ) : (
          <div className="anatomy-catalog__empty">واحدی با این وضعیت وجود ندارد.</div>
        )}
      </section>
    </section>
  );
}

export { AnatomyModulePage };
