import { ProgressService } from '../../../../services/learning';
import LearningEngine from './LearningEngine';
import { Breadcrumb, LearningObjective } from './LearningPrimitives';
import { formatMinutes, getLearningStatus, toFa } from './learningUtils';

export default function UnitPage({
  course,
  module,
  unit,
  progressState,
  setProgressState,
  userId,
  initialStep,
  onBack,
  onAnatomyBack,
  onCourseBack,
}) {
  const state = ProgressService.getUnitState(progressState, unit);
  const status = getLearningStatus(state.status);

  return (
    <section className="unit-page">
      <Breadcrumb items={[
        { label: 'درسنامه جامع', onClick: onCourseBack },
        { label: 'آناتومی', onClick: onAnatomyBack },
        { label: module.title, onClick: onBack },
        { label: unit.title },
      ]} />

      <header className="unit-hero">
        <div className="unit-hero__main">
          <span className="unit-hero__number"><small>UNIT</small>{toFa(String(unit.order).padStart(2, '0'))}</span>
          <div>
            <span className={`status-pill status-pill--${status.tone}`}>{status.label}</span>
            <h1>{unit.title}</h1>
            <p>{unit.description}</p>
            <div className="unit-hero__meta">
              <span>{formatMinutes(unit.estimatedTime)}</span>
              <span>{toFa(unit.learning.microLessons.length)} میکرودرس</span>
              <span>{toFa(unit.tests)} تمرین و تست</span>
              <span>تسلط {toFa(state.mastery)}٪</span>
            </div>
          </div>
        </div>
        <section className="unit-hero__objectives" aria-labelledby="unit-objectives-title">
          <small>LEARNING OBJECTIVES</small>
          <h2 id="unit-objectives-title">در پایان این واحد می‌توانی</h2>
          <ol>
            {unit.objectives.map((objective, index) => (
              <LearningObjective key={objective} index={index}>{objective}</LearningObjective>
            ))}
          </ol>
        </section>
      </header>

      {state.currentStep !== 'activate' && state.status !== 'completed' && (
        <aside className="unit-resume-note">
          <span aria-hidden="true">↺</span>
          <p><b>ادامه خودکار:</b> این واحد از آخرین نقطه ذخیره‌شده، مرحله «{progressState.lastLocation?.stepLabel || 'یادگیری'}»، باز شده است.</p>
        </aside>
      )}

      <LearningEngine
        course={course}
        unit={unit}
        courseState={progressState}
        setCourseState={setProgressState}
        userId={userId}
        initialStep={initialStep}
        onBack={onBack}
      />
    </section>
  );
}

export { UnitPage };
