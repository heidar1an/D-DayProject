/*
 * سرویس پیشرفت میکرودرسنامه — تنها محل ذخیرهٔ وضعیت مطالعهٔ کاربر.
 *
 * الگوبرداری از ProgressService درسنامهٔ جامع: localStorage با کلید نسخه‌دار
 * «tapesh:micro:v1:<userId>:<courseId>» و ادغام امن seed با state ذخیره‌شده.
 * با اتصال Backend فقط load/save به fetch تبدیل می‌شود؛ شکل state قرارداد است.
 *
 * ذخیره‌شده‌ها: آخرین نقطهٔ مطالعه، وضعیت صفحه‌ها (خوانده‌شده/زمان/اعتماد/نشان‌دار/
 * یادداشت)، رخدادهای checkpoint (تلاش‌ها، recallها، تلاش مجدد)، پاسخ‌های بانک تست
 * (rollup هر سؤال)، هایلایت‌ها، حالت مطالعه (سریع/عمیق) و سشن‌های آزمون جمع‌بندی.
 */

const STORAGE_PREFIX = 'tapesh:micro:v1';

const storageKey = (courseId, userId) => `${STORAGE_PREFIX}:${userId}:${courseId}`;

function safeRead(key) {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* پر شدن localStorage نباید جریان مطالعه را متوقف کند */
  }
}

function createSeedState(course) {
  return {
    version: 1,
    courseId: course.id,
    updatedAt: null,
    studyMode: 'deep', // deep | quick
    lastLocation: null, // { unitId, pageId }
    units: {},
  };
}

/* وضعیت پیش‌فرض یک صفحهٔ واحد — پایهٔ ادغام با state ذخیره‌شده */
function emptyPageState() {
  return {
    status: 'unseen', // unseen | seen | completed
    readAt: null,
    revisits: 0,
    readingTimeSec: 0,
    confidence: null, // 1..5
    bookmark: false,
    note: '',
  };
}

function emptyUnitState() {
  return {
    startedAt: null,
    lastVisited: null,
    pages: {},
    checkpoints: {}, // cpId → { completed, requiredMet, attempts[], retests, weakAtClose }
    answers: {}, // bankQuestionId → rollup { attempts, correct, wrong, lastCorrect, lastAnsweredAt, correctAts[] }
    difficulty: 'medium', // دشواری تطبیقی جاری
    lastResults: [], // رکورد آخرین پاسخ‌ها [{correct}]
    weakConcepts: [], // آخرین مفهوم‌های ضعیف تشخیص‌داده‌شده
    assessments: [], // سشن‌های آزمون جمع‌بندی
  };
}

function emptyCheckpointState() {
  return {
    completed: false,
    requiredMet: false,
    attempts: [], // { questionId, selected, correct, answeredAt, responseTime }
    retests: 0,
    reviewedPages: [],
  };
}

export const MicroProgressService = {
  load(course, userId = 'local-user') {
    const saved = safeRead(storageKey(course.id, userId));
    const seed = createSeedState(course);
    if (!saved || saved.version !== seed.version) return seed;

    return {
      ...seed,
      ...saved,
      units: saved.units ?? {},
    };
  },

  save(courseId, state, userId = 'local-user') {
    const nextState = { ...state, updatedAt: new Date().toISOString() };
    safeWrite(storageKey(courseId, userId), nextState);
    return nextState;
  },

  /*
   * آیا کاربر خواندن این درسنامه را شروع کرده؟ بدون ساختن seed و بدون بارگذاری کل
   * محتوا — فقط نگاه می‌کند آیا واحدی شروع شده یا صفحه‌ای از «نادیده» گذشته است.
   * مصرف‌کننده: کارت «عملکرد بر اساس درس» در لایهٔ آنالیز وضعیت.
   */
  hasStartedReading(courseId, userId = 'local-user') {
    const saved = safeRead(storageKey(courseId, userId));
    if (!saved?.units) return false;
    return Object.values(saved.units).some(
      (unit) => Boolean(unit?.startedAt) || Object.values(unit?.pages ?? {}).some((page) => page?.status && page.status !== 'unseen'),
    );
  },

  getUnitState(state, unit) {
    return {
      ...emptyUnitState(),
      ...(state.units?.[unit.id] ?? {}),
    };
  },

  getPageState(unitState, page) {
    return {
      ...emptyPageState(),
      ...(unitState.pages?.[page.id] ?? {}),
    };
  },

  getCheckpointState(unitState, checkpoint) {
    return {
      ...emptyCheckpointState(),
      ...(unitState.checkpoints?.[checkpoint.id] ?? {}),
    };
  },

  /* به‌روزرسانی وضعیت یک واحد + ثبت آخرین نقطهٔ مطالعه */
  updateUnit(state, unit, patch, locationPatch = {}) {
    const previous = this.getUnitState(state, unit);
    const nextUnitState = {
      ...previous,
      ...patch,
      startedAt: previous.startedAt ?? new Date().toISOString(),
      lastVisited: new Date().toISOString(),
    };

    return {
      ...state,
      lastLocation: {
        unitId: unit.id,
        ...(state.lastLocation ?? {}),
        ...locationPatch,
      },
      units: {
        ...state.units,
        [unit.id]: nextUnitState,
      },
    };
  },

  markPageSeen(state, unit, pageId) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });
    if (pageState.status !== 'unseen') return state;

    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: { ...pageState, status: 'seen', readAt: new Date().toISOString() },
      },
    }, { pageId });
  },

  /* تکمیل صفحه: زمان مطالعه، اعتماد و یادداشت هم‌زمان ثبت می‌شوند */
  completePage(state, unit, pageId, { readingTimeSec = 0, confidence = null } = {}) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });

    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: {
          ...pageState,
          status: 'completed',
          readAt: pageState.readAt ?? new Date().toISOString(),
          revisits: pageState.status === 'seen' ? pageState.revisits : pageState.revisits + 1,
          readingTimeSec: pageState.readingTimeSec + Math.max(0, readingTimeSec),
          confidence: confidence ?? pageState.confidence,
        },
      },
    }, { pageId });
  },

  toggleBookmark(state, unit, pageId) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });
    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: { ...pageState, bookmark: !pageState.bookmark },
      },
    }, { pageId });
  },

  setPageNote(state, unit, pageId, note) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });
    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: { ...pageState, note },
      },
    });
  },

  addHighlight(state, unit, pageId, highlight) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });
    const highlights = [...(pageState.highlights ?? []), highlight];
    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: { ...pageState, highlights },
      },
    });
  },

  removeHighlight(state, unit, pageId, highlightId) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });
    const highlights = (pageState.highlights ?? []).filter((item) => item.id !== highlightId);
    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: { ...pageState, highlights },
      },
    });
  },

  /* فلش‌کارت‌های ساختهٔ خود کاربر روی هر صفحه */
  addFlashcard(state, unit, pageId, card) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });
    const flashcards = [...(pageState.flashcards ?? []), card];
    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: { ...pageState, flashcards },
      },
    });
  },

  removeFlashcard(state, unit, pageId, cardId) {
    const unitState = this.getUnitState(state, unit);
    const pageState = this.getPageState(unitState, { id: pageId });
    const flashcards = (pageState.flashcards ?? []).filter((item) => item.id !== cardId);
    return this.updateUnit(state, unit, {
      pages: {
        ...unitState.pages,
        [pageId]: { ...pageState, flashcards },
      },
    });
  },

  /* ثبت پاسخ checkpoint: تلاش در checkpoint + rollup سؤال + دشواری تطبیقی */
  recordCheckpointAnswer(state, unit, checkpointId, attempt) {
    const unitState = this.getUnitState(state, unit);
    const checkpointState = this.getCheckpointState(unitState, { id: checkpointId });
    const previousAnswer = unitState.answers[attempt.questionId] ?? {
      attempts: 0,
      correct: 0,
      wrong: 0,
      lastCorrect: null,
      lastAnsweredAt: 0,
      correctAts: [],
    };

    const nextAnswer = {
      attempts: previousAnswer.attempts + 1,
      correct: previousAnswer.correct + (attempt.correct ? 1 : 0),
      wrong: previousAnswer.wrong + (attempt.correct ? 0 : 1),
      lastCorrect: attempt.correct,
      lastAnsweredAt: attempt.answeredAt ?? Date.now(),
      correctAts: attempt.correct
        ? [...previousAnswer.correctAts, nextAnswer_timestamp()]
        : previousAnswer.correctAts,
    };

    return this.updateUnit(state, unit, {
      checkpoints: {
        ...unitState.checkpoints,
        [checkpointId]: {
          ...checkpointState,
          attempts: [...checkpointState.attempts, attempt],
        },
      },
      answers: {
        ...unitState.answers,
        [attempt.questionId]: nextAnswer,
      },
      lastResults: [...unitState.lastResults, { correct: attempt.correct }].slice(-4),
    });
  },

  closeCheckpoint(state, unit, checkpointId, { requiredMet, weakConcepts = [], reviewedPages = [] } = {}) {
    const unitState = this.getUnitState(state, unit);
    const checkpointState = this.getCheckpointState(unitState, { id: checkpointId });
    return this.updateUnit(state, unit, {
      checkpoints: {
        ...unitState.checkpoints,
        [checkpointId]: {
          ...checkpointState,
          completed: true,
          requiredMet: requiredMet ?? checkpointState.requiredMet,
          weakConcepts,
          reviewedPages: [...new Set([...checkpointState.reviewedPages, ...reviewedPages])],
          retests: weakConcepts.length ? checkpointState.retests + 1 : checkpointState.retests,
        },
      },
      weakConcepts,
    });
  },

  /* ثبت یک سشن آزمون جمع‌بندی + rollup پاسخ‌های بانک */
  recordAssessment(state, unit, assessment) {
    const unitState = this.getUnitState(state, unit);
    const answers = { ...unitState.answers };
    for (const attempt of assessment.attempts) {
      const previous = answers[attempt.questionId] ?? {
        attempts: 0,
        correct: 0,
        wrong: 0,
        lastCorrect: null,
        lastAnsweredAt: 0,
        correctAts: [],
      };
      answers[attempt.questionId] = {
        attempts: previous.attempts + 1,
        correct: previous.correct + (attempt.correct ? 1 : 0),
        wrong: previous.wrong + (attempt.correct ? 0 : 1),
        lastCorrect: attempt.correct,
        lastAnsweredAt: attempt.answeredAt ?? Date.now(),
        correctAts: attempt.correct ? [...previous.correctAts, nextAnswer_timestamp()] : previous.correctAts,
      };
    }

    return this.updateUnit(state, unit, {
      answers,
      lastResults: [...unitState.lastResults, ...assessment.attempts.map((attempt) => ({ correct: attempt.correct }))].slice(-4),
      assessments: [...unitState.assessments, assessment],
    });
  },

  setStudyMode(state, studyMode) {
    return { ...state, studyMode };
  },

  resetUnit(state, unit) {
    const units = { ...state.units };
    delete units[unit.id];
    return { ...state, units };
  },
};

function nextAnswer_timestamp() {
  return new Date().toISOString();
}

export default MicroProgressService;
