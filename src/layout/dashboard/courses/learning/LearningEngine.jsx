import { useEffect, useRef, useState } from 'react';
import { LEARNING_STEPS } from '../../../../data/learning/anatomyCourse';
import {
  AssessmentService,
  LearningService,
  ProgressService,
} from '../../../../services/learning';
import {
  AnatomyImageViewer,
  AnatomyLabelQuiz,
  MicroLesson,
  PracticeQuestion,
  PriorKnowledgeActivation,
  UnitCelebration,
  UnitTest,
} from './LearningActivities';
import {
  LearningNavigation,
  LearningStep,
  LearningStepper,
  UnitNotes,
  UnitReport,
} from './LearningPrimitives';
import { toFa } from './learningUtils';
import { FEEDBACK_SOURCES } from '../../../../services/feedback/userFeedback';
import { LAYER_IDS, useDashboardRoute } from '../../dashboardRoute';
import { ReviewNotebookService } from '../../../../services/reviewNotebook/reviewNotebookService';

export default function LearningEngine({
  course,
  unit,
  courseState,
  setCourseState,
  userId = 'local-user',
  initialStep,
  onCompleted,
  onBack,
  backLabel,
}) {
  const dashboardRoute = useDashboardRoute();
  const initialUnitState = ProgressService.getUnitState(courseState, unit);
  /* getStep برای شناسه‌های حذف‌شده (مثل orient در stateهای قدیمی) به activate برمی‌گردد */
  const [activeStep, setActiveStep] = useState(
    () => LearningService.getStep(initialStep || initialUnitState.currentStep || 'activate').id,
  );
  const practiceStartedAt = useRef(Date.now());
  const labelStartedAt = useRef(Date.now());
  const unitState = ProgressService.getUnitState(courseState, unit);
  const currentStep = LearningService.getStep(activeStep);
  const currentStepIndex = LearningService.getStepIndex(activeStep);

  const reviewSourceId = `${course.id}:${unit.id}`;
  const [reviewItemId, setReviewItemId] = useState(() => {
    const item = ReviewNotebookService.getAll(userId).find((entry) => entry.sourceId === reviewSourceId);
    return item?.id ?? null;
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  /* پاپ‌آپ تبریک — فقط لحظهٔ تکمیل واحد باز می‌شود، نه در ورودهای بعدی */
  const [celebrate, setCelebrate] = useState(false);

  const saveState = (updater) => {
    setCourseState((previousCourseState) => {
      const nextCourseState = typeof updater === 'function'
        ? updater(previousCourseState)
        : updater;
      return ProgressService.save(course.id, nextCourseState, userId);
    });
  };

  const patchUnit = (patch, locationPatch = {}) => {
    saveState((previousCourseState) => ProgressService.updateUnit(
      previousCourseState,
      unit,
      patch,
      {
        stepId: activeStep,
        stepLabel: currentStep.label,
        detail: currentStep.id === 'learn'
          ? `میکرودرس ${toFa((patch.currentLesson ?? unitState.currentLesson ?? 0) + 1)}: ${unit.learning.microLessons[patch.currentLesson ?? unitState.currentLesson ?? 0]?.title}`
          : `مرحله ${currentStep.label}`,
        ...locationPatch,
      },
    ));
  };

  /* ورود دوباره به واحد: بخش فعال‌سازی و بخش تمرین به حالت تازه برمی‌گردند
     (پاسخ‌های قبلی پاک می‌شوند) تا کاربر بتواند دوباره تمرین کند؛ ولی اگر یک بار
     به این بخش‌ها جواب داده شده باشد، تیکشان در نوار مراحل می‌ماند. */
  useEffect(() => {
    const answeredRecall = Object.keys(initialUnitState.recallResponses ?? {}).length > 0;
    const answeredPractice = Object.keys(initialUnitState.practiceResults ?? {}).length > 0;
    if (!answeredRecall && !answeredPractice) return;

    patchUnit({
      ...(answeredRecall ? { recallResponses: {} } : {}),
      ...(answeredPractice ? { practiceResults: {} } : {}),
      completedSteps: [...new Set([
        ...(initialUnitState.completedSteps ?? []),
        ...(answeredRecall ? ['activate'] : []),
        ...(answeredPractice ? ['practice'] : []),
      ])],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectStep = (stepId) => {
    const step = LearningService.getStep(stepId);
    setActiveStep(step.id);
    patchUnit({ currentStep: step.id }, { stepId: step.id, stepLabel: step.label, detail: `مرحله ${step.label}` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuestionAnswer = (question, selectedAnswer) => {
    const responseTime = Math.max(1, Math.round((Date.now() - practiceStartedAt.current) / 1000));
    const result = AssessmentService.evaluateQuestion(question, selectedAnswer, responseTime);
    const mergedResult = AssessmentService.mergeAttempt(unitState.practiceResults[question.id], result);
    patchUnit({
      practiceResults: {
        ...unitState.practiceResults,
        [question.id]: mergedResult,
      },
    });
    practiceStartedAt.current = Date.now();
  };

  const handleLabelAnswer = (selectedAnswer) => {
    const responseTime = Math.max(1, Math.round((Date.now() - labelStartedAt.current) / 1000));
    const question = unit.learning.labelQuiz;
    const result = AssessmentService.evaluateLabel(question, selectedAnswer, responseTime);
    const mergedResult = AssessmentService.mergeAttempt(unitState.practiceResults[question.id], result);
    patchUnit({
      practiceResults: {
        ...unitState.practiceResults,
        [question.id]: mergedResult,
      },
    });
    labelStartedAt.current = Date.now();
  };

  const handleExplore = (structureId) => {
    patchUnit({ exploredStructures: [...new Set([...unitState.exploredStructures, structureId])] });
  };

  /* دفترچهٔ مرور: همان رکورد واحدی که پس از تکمیل هم ثبت می‌شود (یک رکورد، بدون تکرار). */
  const toggleReview = () => {
    if (reviewItemId) {
      ReviewNotebookService.remove(userId, reviewItemId);
      setReviewItemId(null);
      return;
    }
    const item = ReviewNotebookService.add(userId, {
      sourceType: 'course-unit',
      sourceId: reviewSourceId,
      title: unit.title,
      subject: course.title,
      description: 'واحد درسنامهٔ جامع',
      activityType: 'learning',
      metadata: { courseId: course.id, moduleId: unit.moduleId, unitId: unit.id },
    });
    setReviewItemId(item.id);
  };

  /* پرس‌وجو با تپش هوشمند — رفتن به لایهٔ AI با پرامپت آمادهٔ همین واحد */
  const askTapeshAI = () => {
    const currentRoute = dashboardRoute.routeRef?.current;
    if (!dashboardRoute.push || !currentRoute) return;
    dashboardRoute.push({
      ...currentRoute,
      layer: LAYER_IDS.ai,
      view: {
        conversationId: null,
        prompt: `واحد «${unit.title}» از درسنامهٔ ${course.title} را توضیح بده؛ مفاهیم کلیدی، نکات پرتکرار آزمونی و اشتباه‌های رایج را بگو.`,
      },
      overlay: null,
    });
    window.scrollTo({ top: 0 });
  };

  const openNotes = () => {
    const currentRoute = dashboardRoute.routeRef?.current;
    if (!dashboardRoute.push || !currentRoute) return;
    dashboardRoute.push({ ...currentRoute, section: 'notes', layer: null, view: null, overlay: null });
    window.scrollTo({ top: 0 });
  };

  const goNext = () => {
    const completedState = LearningService.completeStep(unitState, activeStep);
    const nextStep = LearningService.getNextStep(activeStep);

    if (!nextStep) {
      const finalMastery = Math.max(completedState.mastery, 70);
      saveState((previousCourseState) => ProgressService.updateUnit(
        previousCourseState,
        unit,
        {
          ...completedState,
          currentStep: 'test',
          progress: 100,
          mastery: finalMastery,
          status: 'completed',
        },
        { stepId: 'test', stepLabel: 'تست', detail: 'واحد تکمیل شد' },
      ));
      ReviewNotebookService.registerLearning(userId, {
        sourceId: reviewSourceId,
        title: unit.title,
        subject: course.title,
        description: 'واحد تکمیل‌شده در درسنامه جامع',
        metadata: {
          courseId: course.id,
          moduleId: unit.moduleId,
          unitId: unit.id,
          mastery: finalMastery,
        },
      });
      setReviewItemId(ReviewNotebookService.getAll(userId).find((entry) => entry.sourceId === reviewSourceId)?.id ?? null);
      setCelebrate(true);
      onCompleted?.(unit.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    saveState((previousCourseState) => ProgressService.updateUnit(
      previousCourseState,
      unit,
      { ...completedState, currentStep: nextStep.id },
      { stepId: nextStep.id, stepLabel: nextStep.label, detail: `مرحله ${nextStep.label}` },
    ));
    setActiveStep(nextStep.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPrevious = () => {
    const previousStep = LearningService.getPreviousStep(activeStep);
    if (previousStep) selectStep(previousStep.id);
  };

  const resetUnit = () => {
    saveState((previousCourseState) => ProgressService.resetUnit(previousCourseState, unit));
    setActiveStep('activate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderStep = () => {
    switch (activeStep) {
      case 'activate':
        return <PriorKnowledgeActivation data={unit.learning.activate} activityState={unitState} onChange={patchUnit} />;
      case 'learn':
        return <MicroLesson lessons={unit.learning.microLessons} activityState={unitState} onChange={patchUnit} />;
      case 'visualize':
        return (
          <AnatomyImageViewer
            data={unit.learning.visualize}
            exploredStructures={unitState.exploredStructures}
            onExplore={handleExplore}
          />
        );
      case 'practice':
        return (
          <div className="practice-stack">
            {unit.learning.practice.map((question) => (
              <PracticeQuestion
                key={question.id}
                question={question}
                result={unitState.practiceResults[question.id]}
                onAnswer={(answer) => handleQuestionAnswer(question, answer)}
              />
            ))}
            {unit.learning.labelQuiz && (
              <AnatomyLabelQuiz
                question={unit.learning.labelQuiz}
                structures={unit.learning.visualize.structures}
                result={unitState.practiceResults[unit.learning.labelQuiz.id]}
                onAnswer={handleLabelAnswer}
              />
            )}
          </div>
        );
      case 'test':
        return (
          <UnitTest
            course={course}
            unit={unit}
            unitState={unitState}
            userId={userId}
            moduleTitle={course.modules?.find((module) => module.id === unit.moduleId)?.title}
            inReview={Boolean(reviewItemId)}
            onToggleReview={toggleReview}
            onOpenNotes={openNotes}
            onAskAI={askTapeshAI}
            onDeckCreated={(deckId) => patchUnit({ flashcardDeckId: deckId })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="learning-engine">
      <div className="learning-engine__cycle">
        <button type="button" className="learning-engine__back" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          {backLabel || 'بازگشت'}
        </button>

        <LearningStepper
          steps={LEARNING_STEPS}
          currentStep={activeStep}
          completedSteps={unitState.completedSteps}
          onStepSelect={selectStep}
        />

        <div className="learning-engine__tools">
          <button
            type="button"
            className={`learning-engine__tool ${notesOpen ? 'is-active' : ''}`}
            title="یادداشت این مرحله"
            aria-label="یادداشت این مرحله"
            aria-expanded={notesOpen}
            onClick={() => {
              setNotesOpen((current) => !current);
              setReportOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6l-3.9 1 1-3.9z" />
            </svg>
          </button>
          <button
            type="button"
            className={`learning-engine__tool ${reportOpen ? 'is-active' : ''}`}
            title="گزارش ایراد یا خطا"
            aria-label="گزارش ایراد یا خطا"
            aria-expanded={reportOpen}
            onClick={() => {
              setReportOpen((current) => !current);
              setNotesOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </button>
          <button type="button" className="learning-engine__reset" onClick={resetUnit}>
            <span aria-hidden="true">↺</span>
            شروع دوباره واحد
          </button>

          <UnitNotes
            open={notesOpen}
            onClose={() => setNotesOpen(false)}
            userId={userId}
            courseId={course.id}
            unitTitle={unit.title}
            onOpenNotes={openNotes}
          />
          <UnitReport
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            courseTitle={course.title}
            unitTitle={unit.title}
            source={FEEDBACK_SOURCES.comprehensive}
            meta={{ courseId: course.id, unitId: unit.id }}
          />
        </div>
      </div>

      <LearningStep step={currentStep}>{renderStep()}</LearningStep>

      <LearningNavigation
        onPrevious={currentStepIndex > 0 ? goPrevious : undefined}
        onNext={goNext}
        isLast={currentStepIndex === LEARNING_STEPS.length - 1}
      />

      <UnitCelebration open={celebrate} unit={unit} onClose={() => setCelebrate(false)} />
    </div>
  );
}

export { LearningEngine };
