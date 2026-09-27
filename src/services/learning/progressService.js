const STORAGE_PREFIX = 'tapesh:learning:v1';

const storageKey = (courseId, userId) => `${STORAGE_PREFIX}:${userId}:${courseId}`;

function createSeedState(course) {
  const firstUnit = course.unitsByModule['upper-limb']?.[0];

  return {
    version: 1,
    courseId: course.id,
    updatedAt: new Date().toISOString(),
    lastLocation: firstUnit
      ? {
          moduleId: 'upper-limb',
          unitId: firstUnit.id,
          unitTitle: firstUnit.title,
          stepId: 'learn',
          stepLabel: 'یادگیری',
          lessonIndex: 1,
          detail: 'میکرودرس ۲: ترقوه و کتف',
        }
      : null,
    units: firstUnit
      ? {
          [firstUnit.id]: {
            currentStep: 'learn',
            currentLesson: 1,
            completedSteps: ['activate'],
            completedLessons: ['bone-map'],
            exploredStructures: [],
            recallResponses: {},
            practiceResults: {},
            progress: firstUnit.progress,
            mastery: firstUnit.mastery,
            status: 'learning',
            lastActivity: new Date().toISOString(),
          },
        }
      : {},
  };
}

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
    /* پر شدن فضای localStorage نباید جریان یادگیری جاری را متوقف کند. */
  }
}

export const ProgressService = {
  load(course, userId = 'local-user') {
    const saved = safeRead(storageKey(course.id, userId));
    const seed = createSeedState(course);

    if (!saved || saved.version !== seed.version) return seed;

    return {
      ...seed,
      ...saved,
      units: { ...seed.units, ...saved.units },
    };
  },

  save(courseId, state, userId = 'local-user') {
    const nextState = { ...state, updatedAt: new Date().toISOString() };
    safeWrite(storageKey(courseId, userId), nextState);
    return nextState;
  },

  getUnitState(state, unit) {
    return {
      currentStep: 'activate',
      currentLesson: 0,
      completedSteps: [],
      completedLessons: [],
      exploredStructures: [],
      recallResponses: {},
      practiceResults: {},
      progress: unit.progress ?? 0,
      mastery: unit.mastery ?? 0,
      status: unit.status ?? 'fresh',
      lastActivity: null,
      ...(state.units?.[unit.id] ?? {}),
    };
  },

  updateUnit(state, unit, patch, locationPatch = {}) {
    const previous = this.getUnitState(state, unit);
    const nextUnitState = {
      ...previous,
      ...patch,
      lastActivity: new Date().toISOString(),
    };

    return {
      ...state,
      lastLocation: {
        ...state.lastLocation,
        moduleId: unit.moduleId,
        unitId: unit.id,
        unitTitle: unit.title,
        stepId: nextUnitState.currentStep,
        ...locationPatch,
      },
      units: {
        ...state.units,
        [unit.id]: nextUnitState,
      },
    };
  },

  resetUnit(state, unit) {
    const units = { ...state.units };
    delete units[unit.id];
    return {
      ...state,
      lastLocation: {
        moduleId: unit.moduleId,
        unitId: unit.id,
        unitTitle: unit.title,
        stepId: 'activate',
        stepLabel: 'فعال‌سازی',
        lessonIndex: 0,
        detail: 'شروع واحد',
      },
      units,
    };
  },

  getModuleSummary(course, state, moduleId) {
    const units = course.unitsByModule[moduleId] ?? [];
    const unitStates = units.map((unit) => this.getUnitState(state, unit));
    const completed = unitStates.filter((unitState) => unitState.status === 'completed').length;
    const learning = unitStates.filter((unitState) => unitState.status === 'learning').length;
    const remaining = Math.max(0, units.length - completed - learning);
    const progress = units.length
      ? Math.round(unitStates.reduce((sum, unitState) => sum + unitState.progress, 0) / units.length)
      : 0;
    const mastery = units.length
      ? Math.round(unitStates.reduce((sum, unitState) => sum + unitState.mastery, 0) / units.length)
      : 0;

    return { total: units.length, completed, learning, remaining, progress, mastery };
  },

  getCourseSummary(course, state) {
    const allUnits = Object.values(course.unitsByModule).flat();
    const unitStates = allUnits.map((unit) => this.getUnitState(state, unit));
    const completed = unitStates.filter((unitState) => unitState.status === 'completed').length;
    const progress = allUnits.length
      ? Math.round(unitStates.reduce((sum, unitState) => sum + unitState.progress, 0) / allUnits.length)
      : 0;
    const mastery = allUnits.length
      ? Math.round(unitStates.reduce((sum, unitState) => sum + unitState.mastery, 0) / allUnits.length)
      : 0;

    return { progress, mastery, completed };
  },
};

export default ProgressService;
