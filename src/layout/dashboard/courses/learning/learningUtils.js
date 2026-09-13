const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

export const formatMinutes = (minutes) => `${toFa(minutes)} دقیقه`;

export const getLearningStatus = (status) => {
  const statuses = {
    completed: { label: 'تکمیل‌شده', tone: 'green' },
    learning: { label: 'در حال یادگیری', tone: 'blue' },
    weak: { label: 'نیازمند مرور', tone: 'brown' },
    fresh: { label: 'شروع‌نشده', tone: 'muted' },
    locked: { label: 'قفل‌شده', tone: 'muted' },
  };
  return statuses[status] ?? statuses.fresh;
};

export const getConceptStatus = (status) => {
  const statuses = {
    NOT_STARTED: { label: 'شروع‌نشده', tone: 'muted' },
    LEARNING: { label: 'در حال یادگیری', tone: 'blue' },
    WEAK: { label: 'نیازمند مرور', tone: 'brown' },
    FAMILIAR: { label: 'آشنا', tone: 'purple' },
    MASTERED: { label: 'مسلط', tone: 'green' },
  };
  return statuses[status] ?? statuses.NOT_STARTED;
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
