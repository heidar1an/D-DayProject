import { LEARNING_STEPS } from '../../data/learning/anatomyCourse';

export const LearningService = {
  getStepIndex(stepId) {
    const index = LEARNING_STEPS.findIndex((step) => step.id === stepId);
    return index < 0 ? 0 : index;
  },

  getStep(stepId) {
    return LEARNING_STEPS.find((step) => step.id === stepId) ?? LEARNING_STEPS[0];
  },

  getNextStep(stepId) {
    return LEARNING_STEPS[this.getStepIndex(stepId) + 1] ?? null;
  },

  getPreviousStep(stepId) {
    return LEARNING_STEPS[this.getStepIndex(stepId) - 1] ?? null;
  },

  calculateProgress(unitState) {
    const completedCount = new Set(unitState.completedSteps ?? []).size;
    return Math.round((completedCount / LEARNING_STEPS.length) * 100);
  },

  canCompleteStep(stepId, unit, unitState) {
    switch (stepId) {
      case 'activate':
        return Boolean(unitState.acknowledgedSteps?.activate)
          || Object.values(unitState.recallResponses ?? {}).some((value) => value?.trim());
      case 'orient':
        return Boolean(unitState.acknowledgedSteps?.orient);
      case 'learn':
        return unit.learning.microLessons.every((lesson) => unitState.completedLessons?.includes(lesson.id));
      case 'visualize':
        return (unitState.exploredStructures?.length ?? 0) >= Math.min(2, unit.learning.visualize.structures.length);
      case 'connect':
        return Boolean(unitState.acknowledgedSteps?.connect);
      case 'practice': {
        const required = unit.learning.practice.length + (unit.learning.labelQuiz ? 1 : 0);
        return Object.keys(unitState.practiceResults ?? {}).length >= required;
      }
      case 'retrieve':
        return Object.values(unitState.retrievalResponses ?? {}).some((response) => response?.text?.trim());
      case 'diagnose':
        return Boolean(unitState.diagnosis && unitState.acknowledgedSteps?.diagnose);
      case 'review':
        return true;
      default:
        return false;
    }
  },

  completeStep(unitState, stepId) {
    const completedSteps = [...new Set([...(unitState.completedSteps ?? []), stepId])];
    const progress = Math.round((completedSteps.length / LEARNING_STEPS.length) * 100);
    return {
      ...unitState,
      completedSteps,
      progress,
      status: progress >= 100 ? 'completed' : 'learning',
    };
  },
};

export default LearningService;
