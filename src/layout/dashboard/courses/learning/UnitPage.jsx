import { ProgressService } from '../../../../services/learning';
import LearningEngine from './LearningEngine';

export default function UnitPage({
  course,
  unit,
  progressState,
  setProgressState,
  userId,
  initialStep,
  onAnatomyBack,
}) {
  const state = ProgressService.getUnitState(progressState, unit);

  return (
    <section className="unit-page">
      <div className="unit-backbar">
        <button type="button" className="unit-backbar__back" onClick={onAnatomyBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          بازگشت به {course.title}
        </button>
      </div>

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
      />
    </section>
  );
}

export { UnitPage };
