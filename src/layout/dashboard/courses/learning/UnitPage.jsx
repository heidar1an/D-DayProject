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
  return (
    <section className="unit-page">
      <LearningEngine
        course={course}
        unit={unit}
        courseState={progressState}
        setCourseState={setProgressState}
        userId={userId}
        initialStep={initialStep}
        onBack={onAnatomyBack}
        backLabel={`بازگشت به ${course.title}`}
      />
    </section>
  );
}

export { UnitPage };
