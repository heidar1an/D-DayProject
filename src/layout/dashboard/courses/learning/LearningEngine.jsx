import { useEffect, useMemo, useRef, useState } from 'react';
import { LEARNING_STEPS } from '../../../../data/learning/anatomyCourse';
import {
  AssessmentService,
  LearningService,
  ProgressService,
  RecommendationService,
} from '../../../../services/learning';
import {
  AnatomyImageViewer,
  AnatomyLabelQuiz,
  ConceptMap,
  LearningDiagnosis,
  MicroLesson,
  PracticeQuestion,
  PriorKnowledgeActivation,
  RetrievalPrompt,
  ReviewPanel,
} from './LearningActivities';
import {
  LearningNavigation,
  LearningStep,
  LearningStepper,
} from './LearningPrimitives';
import { toFa } from './learningUtils';
import { ReviewNotebookService } from '../../../../services/reviewNotebook/reviewNotebookService';

const STEP_COPY = {
  activate: {
    title: 'دانسته‌های قبلی را روشن کن',
    description: 'قبل از دریافت اطلاعات تازه، مغزت را وادار کن نقشه‌ای که همین حالا دارد نشان دهد.',
    hint: 'یک پاسخ کوتاه بنویس یا آمادگی‌ات را تأیید کن.',
  },
  learn: {
    title: 'یادگیری در قطعه‌های کوچک',
    description: 'هر میکرودرس فقط یک هدف دارد؛ آن را بفهم، ثبت کن و سراغ قطعه بعد برو.',
    hint: 'همه میکرودرس‌های این واحد را به‌عنوان فهمیده‌شده ثبت کن.',
  },
  visualize: {
    title: 'ساختار را فضایی ببین',
    description: 'اطلس را لمس کن، Labelها و لایه‌ها را تغییر بده و Landmarkها را در فضا پیدا کن.',
    hint: 'حداقل دو ساختار را در اطلس انتخاب و بررسی کن.',
  },
  connect: {
    title: 'Factها را به شبکه تبدیل کن',
    description: 'ساختار، عصب، حرکت و پیامد بالینی را در زنجیره‌های قابل بازیابی ببین.',
    hint: 'یک زنجیره را توضیح بده و انجام آن را ثبت کن.',
  },
  practice: {
    title: 'بلافاصله به کار ببر',
    description: 'با MCQ و Label Quiz بررسی کن آیا می‌توانی مفهوم را در موقعیت تازه تشخیص دهی.',
    hint: 'به همه سؤال‌های چهارگزینه‌ای و تصویری پاسخ بده.',
  },
  retrieve: {
    title: 'بدون متن، از حافظه بساز',
    description: 'پاسخ را پیش از دیدن مدل پاسخ تولید کن و اعتماد خودت را هم ثبت کن.',
    hint: 'حداقل به یک سؤال بازیابی پاسخ بده.',
  },
  diagnose: {
    title: 'نقشه واقعی یادگیری‌ات را ببین',
    description: 'دقت، تلاش، زمان پاسخ و اعتماد کنار هم قرار می‌گیرند تا نقطه ضعف واقعی مشخص شود.',
    hint: 'تشخیص را بررسی و دریافت آن را تأیید کن.',
  },
  review: {
    title: 'فقط همان چیزی را مرور کن که لازم داری',
    description: 'خلاصه، خطاها، فلش‌کارت‌ها و سؤال‌های منتخب بر اساس عملکردت در یک جا جمع شده‌اند.',
    hint: '',
  },
};

export default function LearningEngine({
  course,
  unit,
  courseState,
  setCourseState,
  userId = 'local-user',
  initialStep,
  onCompleted,
}) {
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

  const selectStep = (stepId) => {
    const step = LearningService.getStep(stepId);
    setActiveStep(step.id);
    patchUnit({ currentStep: step.id }, { stepId: step.id, stepLabel: step.label, detail: `مرحله ${step.label}` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeStep !== 'diagnose' || unitState.diagnosis) return;
    const diagnosis = AssessmentService.diagnose(unit, unitState);
    patchUnit({ diagnosis, mastery: diagnosis.mastery, status: 'learning' });
    // تشخیص فقط هنگام ورود و نبودن داده ساخته می‌شود.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, unitState.diagnosis, unit]);

  const handleQuestionAnswer = (question, selectedAnswer) => {
    const responseTime = Math.max(1, Math.round((Date.now() - practiceStartedAt.current) / 1000));
    const result = AssessmentService.evaluateQuestion(question, selectedAnswer, responseTime);
    const mergedResult = AssessmentService.mergeAttempt(unitState.practiceResults[question.id], result);
    patchUnit({
      practiceResults: {
        ...unitState.practiceResults,
        [question.id]: mergedResult,
      },
      diagnosis: null,
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
      diagnosis: null,
    });
    labelStartedAt.current = Date.now();
  };

  const handleExplore = (structureId) => {
    patchUnit({ exploredStructures: [...new Set([...unitState.exploredStructures, structureId])] });
  };

  const canContinue = LearningService.canCompleteStep(activeStep, unit, unitState);
  const recommendation = useMemo(
    () => RecommendationService.forUnit(unit, unitState.diagnosis),
    [unit, unitState.diagnosis],
  );

  const goNext = () => {
    if (!canContinue) return;
    const completedState = LearningService.completeStep(unitState, activeStep);
    const nextStep = LearningService.getNextStep(activeStep);

    if (!nextStep) {
      const finalMastery = unitState.diagnosis?.mastery ?? Math.max(completedState.mastery, 70);
      saveState((previousCourseState) => ProgressService.updateUnit(
        previousCourseState,
        unit,
        {
          ...completedState,
          currentStep: 'review',
          progress: 100,
          mastery: finalMastery,
          status: 'completed',
        },
        { stepId: 'review', stepLabel: 'مرور', detail: 'واحد تکمیل شد' },
      ));
      ReviewNotebookService.registerLearning(userId, {
        sourceId: `${course.id}:${unit.id}`,
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
      case 'connect':
        return <ConceptMap relations={unit.learning.relations} activityState={unitState} onChange={patchUnit} />;
      case 'practice':
        return (
          <div className="practice-stack">
            {unit.learning.practice.map((question, index) => (
              <PracticeQuestion
                key={question.id}
                question={question}
                index={index}
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
      case 'retrieve':
        return <RetrievalPrompt prompts={unit.learning.retrieval} activityState={unitState} onChange={patchUnit} />;
      case 'diagnose':
        return <LearningDiagnosis diagnosis={unitState.diagnosis} activityState={unitState} onChange={patchUnit} />;
      case 'review':
        return (
          <ReviewPanel
            unit={unit}
            unitState={unitState}
            recommendation={recommendation}
            onReview={() => selectStep('retrieve')}
            onExam={() => selectStep('practice')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="learning-engine">
      <div className="learning-engine__cycle">
        <LearningStepper
          steps={LEARNING_STEPS}
          currentStep={activeStep}
          completedSteps={unitState.completedSteps}
          onStepSelect={selectStep}
        />
        <button type="button" className="learning-engine__reset" onClick={resetUnit}>
          <span aria-hidden="true">↺</span>
          شروع دوباره واحد
        </button>
      </div>

      <LearningStep
        step={currentStep}
        title={STEP_COPY[activeStep].title}
        description={STEP_COPY[activeStep].description}
      >
        {renderStep()}
      </LearningStep>

      <LearningNavigation
        onPrevious={currentStepIndex > 0 ? goPrevious : undefined}
        onNext={goNext}
        canContinue={canContinue}
        isLast={currentStepIndex === LEARNING_STEPS.length - 1}
        hint={STEP_COPY[activeStep].hint}
      />
    </div>
  );
}

export { LearningEngine };
