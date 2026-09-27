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
