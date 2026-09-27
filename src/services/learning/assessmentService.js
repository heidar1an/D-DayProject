export const AssessmentService = {
  evaluateQuestion(question, selectedAnswer, responseTime = 0) {
    const correct = selectedAnswer === question.answer;
    const correctOption = question.options?.find((option) => option.id === question.answer);

    return {
      questionId: question.id,
      conceptId: question.conceptId,
      selectedAnswer,
      correctAnswer: question.answer,
      correctLabel: correctOption?.label ?? question.answer,
      correct,
      responseTime,
      attempts: 1,
      explanation: question.explanation,
      misconception: question.misconception,
      answeredAt: new Date().toISOString(),
    };
  },

  evaluateLabel(question, selectedAnswer, responseTime = 0) {
    return {
      questionId: question.id,
      conceptId: question.conceptId,
      selectedAnswer,
      correctAnswer: question.answer,
      correct: selectedAnswer === question.answer,
      responseTime,
      attempts: 1,
      explanation: question.explanation,
      misconception: 'در Label Quiz ابتدا جهت تصویر و سپس Landmarkهای همسایه را بررسی کن.',
      answeredAt: new Date().toISOString(),
    };
  },

  mergeAttempt(previousResult, nextResult) {
    if (!previousResult) return nextResult;
    return {
      ...nextResult,
      attempts: previousResult.attempts + 1,
      responseTime: Math.round((previousResult.responseTime + nextResult.responseTime) / 2),
    };
  },
};

export default AssessmentService;
