const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function nextReviewDate(mastery) {
  const date = new Date();
  const interval = mastery >= 80 ? 7 : mastery >= 60 ? 4 : mastery >= 40 ? 2 : 1;
  date.setDate(date.getDate() + interval);
  return date.toISOString();
}

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

  diagnose(unit, unitState) {
    const results = Object.values(unitState.practiceResults ?? {});
    const retrievals = Object.values(unitState.retrievalResponses ?? {}).filter((item) => item?.text?.trim());
    const correctCount = results.filter((result) => result.correct).length;
    const accuracy = results.length ? Math.round((correctCount / results.length) * 100) : 0;
    const attempts = results.reduce((sum, result) => sum + (result.attempts ?? 1), 0);
    const averageResponseTime = results.length
      ? Math.round(results.reduce((sum, result) => sum + (result.responseTime ?? 0), 0) / results.length)
      : 0;
    const confidence = retrievals.length
      ? Math.round(retrievals.reduce((sum, item) => sum + (item.confidence ?? 50), 0) / retrievals.length)
      : 35;
    const retrievalScore = retrievals.length ? Math.min(100, 45 + retrievals.length * 20) : 20;
    const mastery = clamp(Math.round(accuracy * 0.55 + confidence * 0.25 + retrievalScore * 0.2), 0, 100);

    const conceptResults = new Map();
    results.forEach((result) => {
      const key = result.conceptId || 'عمومی';
      const current = conceptResults.get(key) ?? { correct: 0, total: 0, mistakes: 0 };
      current.total += 1;
      current.correct += result.correct ? 1 : 0;
      current.mistakes += result.correct ? 0 : 1;
      conceptResults.set(key, current);
    });

    const resolveConceptTitle = (conceptId) => {
      const visualConcept = unit.learning.visualize.structures.find((structure) => structure.id === conceptId);
      const modeledConcept = unit.concepts.find((concept) => concept.id === conceptId || concept.title === conceptId);
      return visualConcept?.label ?? modeledConcept?.title ?? conceptId;
    };

    const concepts = [...conceptResults.entries()].map(([conceptId, metric]) => {
      const conceptAccuracy = Math.round((metric.correct / metric.total) * 100);
      const conceptMastery = clamp(Math.round(conceptAccuracy * 0.7 + confidence * 0.3), 0, 100);
      const status = conceptMastery >= 82
        ? 'MASTERED'
        : conceptMastery >= 64
          ? 'FAMILIAR'
          : conceptMastery >= 42
            ? 'LEARNING'
            : 'WEAK';

      return {
        conceptId,
        title: resolveConceptTitle(conceptId),
        accuracy: conceptAccuracy,
        attempts: metric.total,
        mistakeCount: metric.mistakes,
        confidence,
        mastery: conceptMastery,
        status,
        lastReviewed: new Date().toISOString(),
        nextReview: nextReviewDate(conceptMastery),
      };
    });

    const weakConcepts = concepts.filter((concept) => concept.status === 'WEAK' || concept.status === 'LEARNING');
    const strongConcepts = concepts.filter((concept) => concept.status === 'MASTERED' || concept.status === 'FAMILIAR');
    const fallbackWeak = unit.learning.review.keyConcepts.slice(0, 2).map((title) => ({
      conceptId: title,
      title,
      accuracy: 0,
      attempts: 0,
      mistakeCount: 0,
      confidence,
      mastery: Math.min(mastery, 38),
      status: 'LEARNING',
      lastReviewed: new Date().toISOString(),
      nextReview: nextReviewDate(mastery),
    }));
    const finalWeakConcepts = weakConcepts.length ? weakConcepts : results.length ? [] : fallbackWeak;
    const primaryWeak = finalWeakConcepts[0]?.title;
    const primaryStrong = strongConcepts[0]?.title;

    return {
      generatedAt: new Date().toISOString(),
      accuracy,
      attempts,
      averageResponseTime,
      confidence,
      mastery,
      mistakeCount: results.filter((result) => !result.correct).length,
      concepts,
      weakConcepts: finalWeakConcepts,
      strongConcepts,
      message: primaryWeak
        ? `در «${primaryWeak}» هنوز به یک مرور کوتاه نیاز داری${primaryStrong ? `؛ در «${primaryStrong}» عملکردت پایدارتر است` : ''}.`
        : 'پاسخ‌ها پایدارند؛ می‌توانی وارد سؤال‌های ترکیبی‌تر یا واحد بعد شوی.',
    };
  },
};

export default AssessmentService;
