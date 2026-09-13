export const RecommendationService = {
  forCourse(course, progressState) {
    const lastLocation = progressState.lastLocation;
    if (!lastLocation) {
      return {
        type: 'start',
        eyebrow: 'پیشنهاد بعدی تپش',
        title: 'مسیر را از اصول آناتومی آغاز کن',
        description: 'یک نقشه پایه از زبان و جهت‌های آناتومی، یادگیری تمام نواحی بعدی را سریع‌تر می‌کند.',
        action: 'شروع مسیر',
        target: { type: 'module', moduleId: 'upper-limb' },
      };
    }

    const unitState = progressState.units?.[lastLocation.unitId];
    const weak = unitState?.diagnosis?.weakConcepts?.[0];
    if (weak) {
      return {
        type: 'review',
        eyebrow: 'پیشنهاد بعدی تپش',
        title: `پیش از ادامه «${weak.title}» را مرور کن`,
        description: 'بر اساس پاسخ‌ها، یک مرور کوتاه اکنون بیشترین اثر را روی تسلط تو دارد.',
        action: 'مرور هدفمند',
        target: { type: 'unit', unitId: lastLocation.unitId, stepId: 'review' },
      };
    }

    return {
      type: 'continue',
      eyebrow: 'پیشنهاد بعدی تپش',
      title: `ادامه «${lastLocation.unitTitle}»`,
      description: `از ${lastLocation.detail || lastLocation.stepLabel || 'آخرین نقطه مطالعه'} ادامه بده و چرخه را کامل کن.`,
      action: 'ادامه یادگیری',
      target: { type: 'unit', unitId: lastLocation.unitId, stepId: lastLocation.stepId },
    };
  },

  forUnit(unit, diagnosis) {
    const weak = diagnosis?.weakConcepts?.[0];
    if (weak) {
      return {
        type: 'review',
        eyebrow: 'مرور پیشنهادی',
        title: `تمرکز دوباره روی «${weak.title}»`,
        description: 'یک فلش‌کارت، یک بازیابی بدون متن و سپس یک تست تازه انجام بده.',
        action: 'ساخت مرور کوتاه',
      };
    }

    if ((diagnosis?.mastery ?? 0) >= 80) {
      return {
        type: 'advance',
        eyebrow: 'گام بعدی',
        title: 'برای سؤال‌های ترکیبی آماده‌ای',
        description: 'تسلط فعلی اجازه می‌دهد با سناریوهای بالینی دشوارتر ادامه بدهی.',
        action: 'آزمون واحد',
      };
    }

    return {
      type: 'practice',
      eyebrow: 'گام پیشنهادی',
      title: `یک دور بازیابی دیگر برای «${unit.title}»`,
      description: 'پاسخ را بدون دیدن متن بازسازی کن و سپس با مدل پاسخ مقایسه کن.',
      action: 'شروع بازیابی',
    };
  },
};

export default RecommendationService;
